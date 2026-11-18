-- Pemeriksaan pg_cron dan Realtime di Supabase asli (classmeet-staging). Jalankan sebagai tiga kueri terpisah
-- (alat hanya menampilkan hasil kueri terakhir dalam satu panggilan).

-- 1) Jadwal: tunggu >= 40 detik setelah migrasi 05_pg_cron_jadwal. Harapan: 2 pekerjaan, active=true,
--    status=succeeded, n >= 4 (pg_cron 1.6.4 mendukung interval detik).
select j.jobname, j.schedule, j.active, d.status, count(*) n, min(d.start_time) first_run, max(d.start_time) last_run
from cron.job j left join cron.job_run_details d on d.jobid = j.jobid
group by 1,2,3,4 order by 1;

-- 2) Hak eksekusi: anon harus false untuk SEMUA fungsi; 10 fungsi internal juga false untuk authenticated.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by anon_exec desc, auth_exec, p.proname;

-- 3) Realtime: pengiriman Broadcast dari database tidak error, dan publikasi berisi tabel yang diharapkan
--    (assets, game_settings, news_feed, payouts, posts). Pengiriman ke KLIEN belum teruji.
select realtime.send(jsonb_build_object('asset','test'), 'book_changed', 'market:test', false);
select pubname, string_agg(tablename, ', ' order by tablename) from pg_publication_tables
where pubname = 'supabase_realtime' group by 1;
