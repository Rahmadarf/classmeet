-- Simulasi mesin berita v2 (uji, tidak mengubah data: semuanya di dalam transaksi yang di-ROLLBACK).
-- Jalankan lewat scripts/sim-news-engine.sh (memuat kumpulan berita ke dalam transaksi dulu).
--   variabel psql: sim_days (hari), sim_temp (pick_temperature_milli), sim_seed (0..1), sim_intensity (persen)
-- Memajukan jam lewat GUC `classmeet.now` (cm_now) dan memanggil process_news_cycle tiap 10 detik jam simulasi,
-- 08:00-19:00 WIB per hari. Hasil berupa ringkasan metrik.
select set_config('classmeet.system', 'on', true);
select setseed(:'sim_seed'::float);

create temp table sim_log (t timestamptz, day int, kind text, asset text, fit numeric, n_eff int);
create temp table sim_px (t timestamptz, asset text, cum numeric);

-- berita yang sedang tayang/terpakai pada data asli dikembalikan ke `ready` DI DALAM transaksi ini (di-ROLLBACK), supaya siklus tidak menunggu berita itu
update news set status = 'ready', published_at = null, effect_at = null, effect_applied_at = null where status in ('live', 'applied');

do $sim$
declare
  t0   timestamptz := '2026-11-20 08:00+07';
  d    int;
  s    int;
  ts   timestamptz;
  res  text;
  v_id uuid;
  v_fit numeric;
  v_kind text; v_asset text; v_n int;
begin
  update assets set price = base_price, last_price = base_price, rank_price = base_price,
         suspended_until = null, is_active = true, bankrupt_at = null, liquidation_price = null where true;
  delete from price_history where true;
  delete from market_event_log where true;
  update game_settings
     set state = 'open', news_gap_minutes = 0, news_next_allowed_at = null, paused_at = null,
         pick_temperature_milli = current_setting('sim.temp')::int,
         event_intensity_pct = current_setting('sim.intensity')::int
   where true;

  for d in 0..(current_setting('sim.days')::int - 1) loop
    update game_settings set market_opened_at = t0 + d * interval '1 day' where true;
    for s in 0..(11 * 360) loop
      ts := t0 + d * interval '1 day' + s * interval '10 seconds';
      perform set_config('classmeet.now', ts::text, true);
      res := public.process_news_cycle();
      if res like '%launched%' then
        select n.id into v_id from news n where n.status = 'live';
        select np.kind, (select symbol from assets where id = np.asset_id), np.n_effects
          into v_kind, v_asset, v_n from public.news_pool() np where np.news_id = v_id;
        select avg(-sign(e.pct_bps) * greatest(-0.5, least(0.5, st.cum)) * abs(e.pct_bps) / 10000.0 * 4)
          into v_fit from news_effects e join public.market_state() st on st.asset_id = e.asset_id
         where e.news_id = v_id;
        insert into sim_log values (ts, d + 1, v_kind, v_asset, v_fit, v_n);
      end if;
      if res like 'applied%' then
        insert into sim_px select ts, symbol, cum from public.market_state();
      end if;
    end loop;
  end loop;
end $sim$;

\echo '== peluncuran per jenis (rata-rata fit harga: makin tinggi makin "cocok" dgn kondisi pasar)'
select kind, count(*) n, round(avg(fit)::numeric, 4) avg_fit, round(avg(n_eff), 1) avg_aset from sim_log group by kind order by kind;
\echo '== peluncuran per hari'
select day, count(*) total, count(*) filter (where kind <> 'price') event from sim_log group by day order by day;
\echo '== event paling awal tiap hari (menit sejak pasar dibuka; harus >= 30)'
select day, round(extract(epoch from (min(t) filter (where kind <> 'price') - (timestamptz '2026-11-20 08:00+07' + (day - 1) * interval '1 day'))) / 60) as menit from sim_log group by day order by day;
\echo '== bangkrut'
select l.day, l.asset, to_char(l.t at time zone 'Asia/Jakarta', 'HH24:MI') jam,
       (select round(x.cum, 2) from sim_px x where x.asset = l.asset and x.t <= l.t order by x.t desc limit 1) cum_sebelum
  from sim_log l where l.kind = 'bankrupt' order by l.t;
\echo '== jumlah aset yang pernah kena tiap jenis event'
select kind, count(distinct asset) aset from sim_log where kind <> 'price' group by kind order by kind;
\echo '== sebaran perubahan harga akhir (cum) dan ekstrem sepanjang permainan'
select round(min(cum), 2) min_akhir, round(max(cum), 2) max_akhir, round(stddev(cum), 2) sd_akhir,
       (select round(min(cum), 2) from sim_px) min_sepanjang, (select round(max(cum), 2) from sim_px) max_sepanjang
  from public.market_state();
\echo '== aset di batas harga (30% / 300%) pada akhir'
select count(*) filter (where price <= min_price or price >= max_price) di_batas, count(*) aktif from assets where is_active;
\echo '== sisa kumpulan berita (ready)'
select kind, count(*) sisa from public.news_pool() where status = 'ready' group by kind order by kind;
