-- Tombol "Reset game" (21 Nov): kembalikan game ke keadaan sebelum dimulai. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/game-reset.sql
--
-- `admin_reset_game()` (hanya admin; boleh di status mana pun, termasuk `finished`), satu transaksi:
--   DIKOSONGKAN : transaksi, kepemilikan (holdings), hadiah pos (payouts), dividen, riwayat harga (price_history),
--                 grafik IKC (index_history), peringkat beku (leaderboard_snapshot), daftar berita tim (news_feed),
--                 catatan event (market_event_log).
--   DIKEMBALIKAN: saldo semua tim = Rp 0; tiap aset = harga awal (base_price), stok awal (init_stock), tekanan stok 0,
--                 aktif lagi (bangkrut dan suspensi dicabut); berita `live`/`applied` kembali `ready` (efek 10-15 aset) atau
--                 `draft`; status game `setup`, `started_at`/`paused_at`/`market_opened_at`/pembekuan dikosongkan, jeda berita dan
--                 jam tekanan stok diulang. Karena `started_at` kosong, harga, berita, dan pengaturan bisa diedit lagi.
--   TIDAK DIUBAH: akun, tim (nama, QR), pos, daftar aset (kode, nama, batas harga), isi berita dan event-nya, pengaturan
--                 trading/berita, dan log audit (ditambah satu baris `reset_game`).
select set_config('classmeet.system', 'on', false);

create or replace function public.admin_reset_game()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tx int; v_hold int; v_pay int; v_div int; v_ph int; v_idx int; v_news int; v_teams int;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.ob_lock();
  perform set_config('classmeet.system', 'on', true);

  delete from transactions where true;          get diagnostics v_tx = row_count;
  delete from holdings where true;              get diagnostics v_hold = row_count;
  delete from payouts where true;               get diagnostics v_pay = row_count;
  delete from dividends where true;             get diagnostics v_div = row_count;
  delete from price_history where true;         get diagnostics v_ph = row_count;
  delete from index_history where true;         get diagnostics v_idx = row_count;
  delete from leaderboard_snapshot where true;
  delete from news_feed where true;
  delete from market_event_log where true;

  update teams set cash = 0 where true;         get diagnostics v_teams = row_count;

  update assets
     set price = base_price, last_price = base_price, rank_price = base_price,
         stock = coalesce(init_stock, stock), price_factor_bps = 0, last_trade_at = null,
         is_active = true, bankrupt_at = null, liquidation_price = null, suspended_until = null
   where base_price is not null;

  -- berita: sesudah aset aktif lagi supaya news_pool() menghitung efek aktif dengan benar
  update news n
     set status = case when p.n_active between g.min_news_assets and g.max_news_assets then 'ready' else 'draft' end::news_status,
         published_at = null, effect_at = null, effect_applied_at = null
    from public.news_pool() p, game_settings g
   where p.news_id = n.id and n.status in ('live', 'applied');
  select count(*)::int into v_news from news where status = 'ready';

  update game_settings
     set state = 'setup', started_at = null, paused_at = null, market_opened_at = null,
         news_next_allowed_at = null, leaderboard_frozen_at = null, updated_at = now()
   where true;
  update shop_clock set pressure_at = now() where true;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'reset_game', jsonb_build_object(
    'transactions', v_tx, 'holdings', v_hold, 'payouts', v_pay, 'dividends', v_div,
    'price_history', v_ph, 'index_history', v_idx, 'teams', v_teams, 'news_ready', v_news));
  perform set_config('classmeet.system', 'off', true);
  return jsonb_build_object('teams', v_teams, 'transactions', v_tx, 'payouts', v_pay, 'news_ready', v_news);
end $$;

revoke all on function public.admin_reset_game() from public, anon;
grant execute on function public.admin_reset_game() to authenticated;
notify pgrst, 'reload schema';

select set_config('classmeet.system', 'off', false);
