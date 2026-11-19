-- Tombol "Mulai ulang berita" (19 Nov): kembalikan kumpulan berita ke keadaan belum terpakai.
-- Jalankan SETELAH news-engine-v2.sql. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/news-restart.sql
--
-- `admin_restart_news()` (hanya admin; game belum `finished`), dalam satu transaksi:
--   * semua berita `applied` dan `live` kembali `ready` bila efek aktifnya 10-15 aset, selain itu `draft` (berita yang sedang
--     tayang dibatalkan: efeknya TIDAK diterapkan); mengembalikan jumlah berita `ready` sesudahnya;
--   * daftar berita yang dilihat tim (`news_feed`) dikosongkan;
--   * catatan event (`market_event_log`) dikosongkan, jadi batas bangkrut dan jeda event mulai dari nol;
--   * jeda antar-berita dihapus dan masa tenang event dimulai lagi dari sekarang (`market_opened_at`).
-- TIDAK diubah: harga aset, saldo, order, dividen yang sudah dibayar, aset yang sudah bangkrut (berita bangkrutnya tetap
-- tidak bisa terbit karena asetnya nonaktif). Dicatat di audit (`restart_news`).
-- Catatan: ini mengubah aturan docs/07 §3.7 ("admin tidak punya tombol untuk berita"); tombol ini hanya mengembalikan kumpulan
-- dan tidak memilih, mempercepat, atau menunda berita tertentu.
select set_config('classmeet.system', 'on', false);

create or replace function public.admin_restart_news()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_state game_state;
  v_n     int;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.ob_lock();
  select state into v_state from game_settings for update;
  if v_state = 'finished' then raise exception 'game_finished'; end if;

  perform set_config('classmeet.system', 'on', true);
  -- yang efek aktifnya memenuhi 10-15 aset kembali `ready`; sisanya (mis. berita lama 4-7 aset) jadi `draft` supaya tidak gagal terbit
  update news n
     set status = case when p.n_active between g.min_news_assets and g.max_news_assets then 'ready' else 'draft' end::news_status,
         published_at = null, effect_at = null, effect_applied_at = null
    from public.news_pool() p, game_settings g
   where p.news_id = n.id and n.status in ('live', 'applied');
  select count(*)::int into v_n from news where status = 'ready';
  delete from news_feed where true;
  delete from market_event_log where true;
  update game_settings
     set news_next_allowed_at = null, market_opened_at = now(), updated_at = now()
   where true;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'restart_news', jsonb_build_object('restored', v_n));
  perform set_config('classmeet.system', 'off', true);
  return v_n;
end $$;

revoke all on function public.admin_restart_news() from public, anon;
grant execute on function public.admin_restart_news() to authenticated;

select set_config('classmeet.system', 'off', false);
