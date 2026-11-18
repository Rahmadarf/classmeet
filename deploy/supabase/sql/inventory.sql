-- Inventaris database untuk membandingkan cloud dan Docker. Hanya baca. Keluaran: "kunci | nilai" satu baris per
-- hal; kedua sisi harus sama (kecuali baris yang berawalan "info:").
select 'tabel public' k, count(*)::text v from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
union all select 'fungsi public', count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all select 'trigger public', count(*)::text from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
union all select 'kebijakan RLS', count(*)::text from pg_policies where schemaname = 'public'
union all select 'tabel RLS aktif', count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
union all select 'tabel public tanpa RLS', coalesce(string_agg(c.relname, ',' order by c.relname), '-') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all select 'job cron', coalesce(string_agg(jobname || ' ' || schedule, '; ' order by jobname), '-') from cron.job
union all select 'tabel Realtime', coalesce(string_agg(tablename, ',' order by tablename), '-') from pg_publication_tables where pubname = 'supabase_realtime'
union all select 'akun auth', count(*)::text from auth.users
union all select 'ekstensi', string_agg(extname, ',' order by extname) from pg_extension where extname in ('pg_cron', 'pgcrypto', 'uuid-ossp')
-- Hak eksekusi fungsi yang menentukan batas peran: anon tidak boleh menjalankan satu pun; authenticated hanya yang disengaja.
union all select 'anon bisa eksekusi fungsi public', coalesce(string_agg(p.proname, ',' order by p.proname), '-')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
union all select 'authenticated bisa eksekusi fungsi internal', coalesce(string_agg(p.proname, ',' order by p.proname), '-')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
   and p.proname in ('process_news_cycle', 'process_market_cycle', 'process_house_quotes', 'ob_match', 'ob_cancel',
                     'bankrupt_asset', 'pay_dividend', 'suspend_asset', 'process_suspensions')
union all select 'info: ukuran DB', pg_size_pretty(pg_database_size(current_database()))
order by 1;
