-- Tombol "Lewati berita" (24 Nov): terapkan efek berita yang sedang tayang SEKARANG (untuk pengujian), lalu berita berikutnya
-- diluncurkan seperti biasa. Jalankan SETELAH news-engine-v2.sql. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/news-skip.sql
--
-- `admin_skip_news()` (hanya admin; game harus `open`), dalam satu transaksi:
--   * kunci `ob_lock()`, ambil berita `live` (galat `no_live_news` bila tidak ada);
--   * majukan `effect_at` ke sekarang, lalu jalankan `process_news_cycle()` SEKARANG juga (bukan menunggu cron 10 dtk): efek
--     berita diterapkan lewat jalur yang sama dengan biasa (harga, riwayat harga, event bangkrut/dividen/suspensi lewat pemicu,
--     jeda antar-berita) dan berita berikutnya dipilih menurut kondisi pasar dan tayang dengan jeda efek normal (3-15 menit);
--   * mencatat audit `skip_news` (id dan judul berita). Mengembalikan judul berita yang dilewati.
-- Tidak memilih berita tertentu: pemilihan berita berikutnya tetap sepenuhnya oleh mesin.
select set_config('classmeet.system', 'on', false);

create or replace function public.admin_skip_news()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_state game_state;
  v_live  public.news;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.ob_lock();
  select state into v_state from game_settings for update;
  if v_state is distinct from 'open' then raise exception 'game_not_active'; end if;
  select * into v_live from news where status = 'live' for update;
  if not found then raise exception 'no_live_news'; end if;

  perform set_config('classmeet.system', 'on', true);
  update news set effect_at = least(effect_at, public.cm_now()) where id = v_live.id;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'skip_news', jsonb_build_object('news_id', v_live.id, 'title', v_live.title));
  perform public.process_news_cycle();
  perform set_config('classmeet.system', 'off', true);
  return v_live.title;
end $$;

revoke all on function public.admin_skip_news() from public, anon;
grant execute on function public.admin_skip_news() to authenticated;

select set_config('classmeet.system', 'off', false);
notify pgrst, 'reload schema';
