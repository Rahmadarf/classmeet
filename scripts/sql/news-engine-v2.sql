-- Mesin berita v2 (19 Nov): 10-15 aset per berita, event berbasis peluang, pemilihan berita menurut kondisi pasar.
-- BELUM diterapkan ke cloud; jalankan di SQL Editor (cloud) atau
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/news-engine-v2.sql
-- Jalankan SETELAH event-bankruptcy.sql dan event-dividend-suspend.sql. Aman dijalankan ulang (create or replace / if not exists).
--
-- PERUBAHAN ATURAN
--   1. Efek harga per berita: 10-15 aset (game_settings.min_news_assets / max_news_assets; sebelumnya 4-7).
--   2. Event (bangkrut, suspensi, dividen) TIDAK lagi menempel pada berita yang dipilih acak begitu saja. Sistem menghitung
--      PELUANG tiap aset dari kondisi pasar sekarang (`market_state`, `event_chances`):
--        - bangkrut: kecil; naik bila aset sudah naik jauh sejak harga dasar atau naik berturut-turut;
--        - suspensi: naik bila harga bergejolak, transaksi melonjak, atau jatuh dalam;
--        - dividen : naik bila harga stabil / naik sedang dan sudah lama tidak membayar.
--      Berita event hanya terbit bila peluang jatuh DAN ada berita event yang belum terpakai untuk aset + jenis itu.
--   3. Tiap aset sebaiknya punya >= 1 berita per jenis event di kumpulan (lihat `news_pool_coverage`, hanya sebelum game
--      dibuka). Tidak semua berita membawa event: berita tanpa event (jenis `price`) tetap mayoritas. Satu berita membawa
--      paling banyak SATU event (diperiksa `check_news_effects`).
--   4. Tidak ada event sebelum masa tenang (game_settings.event_warmup_minutes, bawaan 30 menit) sejak pasar dibuka
--      (`market_opened_at`: pembukaan pertama, atau dibuka lagi sesudah dijeda > 60 menit) dan tidak ada event bila ada
--      event lain dalam `event_gap_minutes` (15) terakhir; per aset ada jeda `event_asset_gap_minutes` (60); bangkrut dibatasi
--      `bankrupt_max_total` (4) per game dan `bankrupt_max_per_day` (2) per hari WIB.
--   5. Berita TIDAK ditentukan sebelumnya. Tidak ada antrean atau kolom "berita berikutnya": `pick_next_news()` dipanggil
--      hanya saat berita diterbitkan. Tanpa event, tiap berita `price` yang belum terpakai diberi skor kecocokan terhadap
--      kondisi sekarang (aset yang sudah naik jauh cocok dengan berita negatif, dan sebaliknya; aset yang baru saja kena
--      berita dikurangi; harga yang menabrak batas dihindari), lalu dipilih ACAK berbobot (softmax, suhu
--      `pick_temperature_milli`), bukan yang tertinggi.
--
-- DESAIN
--   * `cm_now()` = now(), kecuali GUC `classmeet.now` diisi (hanya untuk simulasi/uji; produksi tidak mengisinya).
--   * Fungsi internal (market_state, event_chances, pick_next_news, news_pool) tidak bisa dipanggil klien.
--   * Berita yang memuat aset yang sudah nonaktif (bangkrut) dipangkas efek aset itu saat terbit selama sisanya >= minimum;
--     bila kurang dari minimum, berita itu tidak dipilih.
--   * Bila pemilihan gagal atau kumpulan `price` habis, jatuh ke berita lain yang layak; bila tidak ada, siklus idle.
--   * Setiap UPDATE ber-WHERE (pg_safeupdate di Supabase hosted).

-- Game yang sudah dibuka mengunci tabel pengaturan/berita; skrip ini sah mengubahnya (hanya selama sesi ini).
select set_config('classmeet.system', 'on', false);

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. Jam yang bisa dimajukan untuk simulasi
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.cm_now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('classmeet.now', true), '')::timestamptz, now())
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Pengaturan baru
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.game_settings add column if not exists market_opened_at timestamptz;
alter table public.game_settings add column if not exists event_warmup_minutes int not null default 30;
alter table public.game_settings add column if not exists event_gap_minutes int not null default 15;
alter table public.game_settings add column if not exists event_asset_gap_minutes int not null default 60;
alter table public.game_settings add column if not exists event_intensity_pct int not null default 100;
alter table public.game_settings add column if not exists bankrupt_max_total int not null default 4;
alter table public.game_settings add column if not exists bankrupt_max_per_day int not null default 2;
alter table public.game_settings add column if not exists pick_temperature_milli int not null default 50;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_settings_event_knobs_check') then
    alter table public.game_settings add constraint game_settings_event_knobs_check check (
      event_warmup_minutes between 0 and 600 and event_gap_minutes between 0 and 600
      and event_asset_gap_minutes between 0 and 1440 and event_intensity_pct between 0 and 1000
      and bankrupt_max_total between 0 and 30 and bankrupt_max_per_day between 0 and 30
      and pick_temperature_milli between 10 and 5000);
  end if;
end $$;

-- 10-15 aset per berita. Game yang sudah berjalan: masa tenang dihitung dari saat skrip ini dijalankan.
update public.game_settings
   set min_news_assets = 10, max_news_assets = 15,
       market_opened_at = coalesce(market_opened_at, case when started_at is not null then now() end),
       updated_at = now()
 where true;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Catatan event (untuk jeda dan batas bangkrut)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.market_event_log (
  id       bigint generated always as identity primary key,
  asset_id uuid not null references public.assets(id),
  kind     text not null check (kind in ('bankrupt', 'suspend', 'dividend')),
  news_id  uuid references public.news(id),
  at       timestamptz not null default public.cm_now()
);
create index if not exists market_event_log_at_idx on public.market_event_log (at desc);
create index if not exists market_event_log_asset_idx on public.market_event_log (asset_id, at desc);
alter table public.market_event_log enable row level security;
revoke all on public.market_event_log from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Peta kumpulan berita: jenis, aset sasaran, dan apakah masih layak terbit
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.news_pool()
returns table (news_id uuid, status news_status, kind text, asset_id uuid, amount int,
               n_effects int, n_active int, usable boolean)
language sql stable security definer set search_path = public as $$
  select n.id, n.status,
         coalesce(case when b.news_id is not null then 'bankrupt' end, ev.kind, 'price'),
         coalesce(b.asset_id, ev.asset_id),
         coalesce(b.liquidation_bps, ev.amount),
         ef.n, ef.n_active,
         (ef.n_active >= (select min_news_assets from game_settings)
          and (coalesce(b.asset_id, ev.asset_id) is null
               or exists (select 1 from assets a where a.id = coalesce(b.asset_id, ev.asset_id) and a.is_active))
          -- petunjuk di teks berita menyebut ciri aset yang efeknya terbesar; bila salah satunya sudah bangkrut (nonaktif),
          -- efeknya dibuang saat terbit dan petunjuk menyesatkan, jadi berita itu tidak dipilih (aturan docs/15 §3a)
          and coalesce(hint.all_active, true))
    from news n
    left join news_bankruptcies b on b.news_id = n.id
    left join lateral (select e.kind, e.asset_id, e.amount from news_events e
                        where e.news_id = n.id order by e.kind, e.asset_id limit 1) ev on true
    left join lateral (select count(*)::int as n, (count(*) filter (where a.is_active))::int as n_active
                         from news_effects x join assets a on a.id = x.asset_id
                        where x.news_id = n.id) ef on true
    -- aset berpetunjuk = 2 naik + 2 turun dengan |efek| terbesar (minimal 100 bps), selain subjek event; rank() mengikutkan
    -- yang seri sehingga himpunannya selalu mencakup yang dipakai pembuat berita (scripts/news-pool-lib.ts: HINT_MIN_BPS, HINT_PER_SIDE)
    left join lateral (
      select bool_and(h.is_active) as all_active
        from (select a.is_active,
                     rank() over (partition by (x.pct_bps > 0) order by abs(x.pct_bps) desc) as rk
                from news_effects x join assets a on a.id = x.asset_id
               where x.news_id = n.id and abs(x.pct_bps) >= 100
                 and x.asset_id is distinct from coalesce(b.asset_id, ev.asset_id)) h
       where h.rk <= 2) hint on true
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Validasi berita: tambah "paling banyak satu event per berita" (badan lama dipertahankan)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.check_news_effects(p_news_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_min int; v_max int; v_cap int;
  v_n int; v_active int; v_bad int;
begin
  select min_news_assets, max_news_assets, max_effect_bps into v_min, v_max, v_cap from game_settings;

  select count(*),
         count(*) filter (where a.is_active),
         count(*) filter (where e.pct_bps = 0 or abs(e.pct_bps) > v_cap)
    into v_n, v_active, v_bad
    from news_effects e join assets a on a.id = e.asset_id
   where e.news_id = p_news_id;

  if v_n < v_min or v_n > v_max then raise exception 'news_invalid_effects'; end if;
  if v_active <> v_n then raise exception 'news_invalid_effects'; end if;
  if v_bad > 0 then raise exception 'news_invalid_effects'; end if;

  -- paling banyak SATU event (bangkrut, dividen, atau suspensi) per berita
  if (select count(*) from news_bankruptcies where news_id = p_news_id)
     + (select count(*) from news_events where news_id = p_news_id) > 1 then
    raise exception 'news_invalid_effects';
  end if;

  -- bangkrut: aset harus aktif dan tidak boleh sekaligus punya efek harga di berita yang sama
  if exists (select 1 from news_bankruptcies b join assets a on a.id = b.asset_id
              where b.news_id = p_news_id and not a.is_active) then
    raise exception 'news_invalid_effects';
  end if;
  if exists (select 1 from news_bankruptcies b
               join news_effects e on e.news_id = b.news_id and e.asset_id = b.asset_id
              where b.news_id = p_news_id) then
    raise exception 'news_invalid_effects';
  end if;

  -- dividen/suspensi: aset harus aktif dan tidak boleh sekaligus bangkrut di berita yang sama
  if exists (select 1 from news_events ev join assets a on a.id = ev.asset_id
              where ev.news_id = p_news_id and not a.is_active) then
    raise exception 'news_invalid_effects';
  end if;
  if exists (select 1 from news_events ev
               join news_bankruptcies b on b.news_id = ev.news_id and b.asset_id = ev.asset_id
              where ev.news_id = p_news_id) then
    raise exception 'news_invalid_effects';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Kondisi pasar sekarang per aset aktif
-- ---------------------------------------------------------------------------------------------------------------------
--   cum        perubahan harga acuan sejak harga dasar (0,25 = naik 25 %)
--   up_streak  berapa berita terakhir berturut-turut yang menaikkan harga aset ini
--   vol        simpangan baku perubahan 6 berita terakhir (pecahan; 0,05 = 5 %)
--   trades_10m jumlah transaksi 10 menit terakhir
create or replace function public.market_state()
returns table (asset_id uuid, symbol text, sector text, price bigint, base_price bigint, cum numeric,
               up_streak int, vol numeric, trades_10m int, last_event_at timestamptz,
               last_dividend_at timestamptz, suspended boolean)
language sql stable security definer set search_path = public as $$
  with moves as (
    select h.asset_id,
           h.price::numeric / nullif(lag(h.price, 1, coalesce(a.base_price, a.price)) over w, 0) - 1 as chg,
           row_number() over (partition by h.asset_id order by h.created_at desc, h.id desc) as rn
      from price_history h join assets a on a.id = h.asset_id
     where h.reason = 'berita'
    window w as (partition by h.asset_id order by h.created_at, h.id)
  ),
  agg as (
    select m.asset_id,
           coalesce(min(m.rn) filter (where m.chg <= 0) - 1, count(*))::int as up_streak,
           stddev_samp(m.chg) filter (where m.rn <= 6) as vol
      from moves m group by m.asset_id
  )
  select a.id, a.symbol, a.sector, a.price, coalesce(a.base_price, a.price),
         a.price::numeric / coalesce(a.base_price, a.price) - 1,
         coalesce(g.up_streak, 0), g.vol,
         (select count(*)::int from trades t
           where t.asset_id = a.id and t.created_at > public.cm_now() - interval '10 minutes'),
         (select max(l.at) from market_event_log l where l.asset_id = a.id),
         (select max(l.at) from market_event_log l where l.asset_id = a.id and l.kind = 'dividend'),
         (a.suspended_until is not null and a.suspended_until > public.cm_now())
    from assets a left join agg g on g.asset_id = a.id
   where a.is_active
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Peluang event per aset dan jenis (hanya yang masih punya berita event layak di kumpulan)
-- ---------------------------------------------------------------------------------------------------------------------
-- Besaran peluang per giliran penerbitan berita (angka awal; disetel lewat simulasi):
--   dividen  0,15 % dasar; +0,2 % bila harga stabil (vol < 4 %); +0,15 % bila naik sedang (0 < cum < 40 %);
--            +0,1 % bila > 60 menit sejak dividen terakhir; setengahnya bila sudah naik > 80 %.
--   suspensi 0,15 % dasar; +0,4 % bila bergejolak (vol > 4 %); +0,2 % bila >= 5 transaksi/10 menit; +0,3 % bila jatuh > 15 %.
--   bangkrut 0,03 % dasar; sampai +0,8 % menurut seberapa jauh naik di atas +15 % (penuh di +60 %); +0,04 % per berita
--            naik berturut-turut di atas 2 (maks. +0,16 %; hanya bila harga di atas harga dasar). Total maksimum 4 per game
--            dan 2 per hari.
create or replace function public.event_chances()
returns table (asset_id uuid, kind text, p numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  g        public.game_settings;
  v_today  timestamptz;
  v_b_all  int;
  v_b_day  int;
begin
  select * into g from game_settings;
  v_today := date_trunc('day', public.cm_now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  select count(*) into v_b_all from market_event_log where market_event_log.kind = 'bankrupt';
  select count(*) into v_b_day from market_event_log where market_event_log.kind = 'bankrupt' and at >= v_today;

  return query
  with s as (select * from public.market_state() ms where not ms.suspended),
  avail as (
    select np.asset_id, np.kind from public.news_pool() np
     where np.status = 'ready' and np.usable and np.kind <> 'price'
     group by np.asset_id, np.kind
  ),
  raw as (
    select s.asset_id, 'dividend'::text as kind,
           least(0.02, (0.0015
             + case when coalesce(s.vol, 0) < 0.04 then 0.002 else 0 end
             + case when s.cum > 0 and s.cum < 0.4 then 0.0015 else 0 end
             + case when s.last_dividend_at is null or s.last_dividend_at < public.cm_now() - interval '60 minutes'
                    then 0.001 else 0 end)
             * case when s.cum > 0.8 then 0.5 else 1 end) as p
      from s
    union all
    select s.asset_id, 'suspend',
           least(0.02, 0.0015
             + case when coalesce(s.vol, 0) > 0.04 then 0.004 else 0 end
             + case when s.trades_10m >= 5 then 0.002 else 0 end
             + case when s.cum < -0.15 then 0.003 else 0 end)
      from s
    union all
    select s.asset_id, 'bankrupt',
           least(0.02, 0.0003
             + 0.008 * least(1, greatest(0, s.cum - 0.15) / 0.45)
             + case when s.cum > 0 then 0.0004 * least(4, greatest(0, s.up_streak - 2)) else 0 end)
      from s
  )
  select r.asset_id, r.kind, r.p * g.event_intensity_pct / 100.0
    from raw r
    join avail v on v.asset_id = r.asset_id and v.kind = r.kind
    join s on s.asset_id = r.asset_id
   where (s.last_event_at is null
          or s.last_event_at < public.cm_now() - make_interval(mins => g.event_asset_gap_minutes))
     and (r.kind <> 'bankrupt' or (v_b_all < g.bankrupt_max_total and v_b_day < g.bankrupt_max_per_day));
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Pemilihan berita berikutnya (dipanggil HANYA saat berita diterbitkan)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.pick_next_news()
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  g        public.game_settings;
  v_now    timestamptz := public.cm_now();
  v_event_ok boolean;
  v_total  numeric;
  v_roll   numeric;
  v_acc    numeric := 0;
  ch       record;
  v_asset  uuid;
  v_kind   text;
  v_id     uuid;
  v_temp   numeric;
  v_draw   numeric := random();
begin
  select * into g from game_settings;
  v_temp := g.pick_temperature_milli / 1000.0;

  -- 1) giliran ini membawa event? Hanya sesudah masa tenang dan di luar jeda antar-event.
  v_event_ok := g.market_opened_at is not null
            and v_now >= g.market_opened_at + make_interval(mins => g.event_warmup_minutes)
            and not exists (select 1 from market_event_log where at >= v_now - make_interval(mins => g.event_gap_minutes));
  if v_event_ok then
    select coalesce(sum(p), 0) into v_total from public.event_chances();
    if v_total > 0 and random() < least(v_total, 0.40) then
      v_roll := random() * v_total;
      for ch in select ec.asset_id, ec.kind, ec.p from public.event_chances() ec order by ec.asset_id, ec.kind loop
        v_acc := v_acc + ch.p;
        if v_roll <= v_acc then v_asset := ch.asset_id; v_kind := ch.kind; exit; end if;
      end loop;
      if v_asset is not null then
        select np.news_id into v_id from public.news_pool() np
         where np.status = 'ready' and np.usable and np.kind = v_kind and np.asset_id = v_asset
         order by random() limit 1;
        if v_id is not null then return v_id; end if;
      end if;
    end if;
  end if;

  -- 2) berita harga: skor kecocokan terhadap kondisi sekarang, lalu pilih acak berbobot (softmax).
  with st as (select * from public.market_state()),
  recent as (
    select e.asset_id, count(*)::numeric as hits
      from news_effects e
      join (select id from news where status in ('live', 'applied')
             order by published_at desc nulls last limit 3) r on r.id = e.news_id
     group by e.asset_id
  ),
  cand as (select np.news_id from public.news_pool() np where np.status = 'ready' and np.kind = 'price' and np.usable),
  sc as (
    select c.news_id,
           avg( -sign(e.pct_bps) * greatest(-0.5, least(0.5, st.cum)) * abs(e.pct_bps) / 10000.0 * 4
                - 0.03 * coalesce(r.hits, 0) ) - case when public.news_would_hit_bounds(c.news_id) then 0.5 else 0 end as score
      from cand c
      join news_effects e on e.news_id = c.news_id
      join st on st.asset_id = e.asset_id
      left join recent r on r.asset_id = e.asset_id
     group by c.news_id
  ),
  w as (select news_id, exp((score - max(score) over ()) / v_temp) as wt from sc),
  cw as (select news_id, sum(wt) over (order by news_id) as cum_w, sum(wt) over () as tot from w)
  select news_id into v_id from cw
   where cum_w >= v_draw * tot       -- satu undian acak untuk seluruh daftar (bukan per baris)
   order by cum_w limit 1;
  if v_id is not null then return v_id; end if;

  -- 3) cadangan: berita apa pun yang layak (berita event hanya sesudah masa tenang), supaya pasar tidak macet.
  select np.news_id into v_id from public.news_pool() np
   where np.status = 'ready' and np.usable and (np.kind = 'price' or v_event_ok)
   order by random() limit 1;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Siklus berita: pemilihan lewat pick_next_news (badan lama dipertahankan selain langkah 2 dan jam)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.process_news_cycle()
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_state   game_state;
  v_dmin    int;
  v_dmax    int;
  v_gap     int;
  v_allowed timestamptz;
  v_step    int;
  v_live    public.news;
  v_pick    public.news;
  v_pid     uuid;
  v_now     timestamptz := public.cm_now();
  r         record;
  v_new     bigint;
  v_found   boolean;
  v_secs    int;
  v_result  text := 'idle';
begin
  perform public.ob_lock();
  select state, news_delay_min_minutes, news_delay_max_minutes, news_gap_minutes, news_next_allowed_at, price_step
    into v_state, v_dmin, v_dmax, v_gap, v_allowed, v_step
    from game_settings for update;
  if v_state <> 'open' then return 'idle'; end if;

  perform set_config('classmeet.system', 'on', true);

  -- 1) terapkan efek berita yang waktunya sudah tiba
  select * into v_live from news where status = 'live' for update;
  if found and v_live.effect_at <= v_now then
    for r in
      select e.asset_id, e.pct_bps from news_effects e
       where e.news_id = v_live.id order by e.asset_id
    loop
      update assets
         set price = greatest(min_price, least(max_price,
               (((price * (10000 + r.pct_bps)) / 10000 + v_step / 2) / v_step) * v_step))
       where id = r.asset_id and is_active
       returning price into v_new;
      get diagnostics v_found = row_count;
      if v_found then
        update assets set last_price = price, rank_price = price where id = r.asset_id;
        insert into price_history (asset_id, price, news_id, reason, created_at)
        values (r.asset_id, v_new, v_live.id, 'berita', v_now);
      end if;
    end loop;

    update news set status = 'applied', effect_applied_at = v_now where id = v_live.id;
    v_allowed := v_now + make_interval(mins => v_gap);
    update game_settings set news_next_allowed_at = v_allowed, updated_at = now() where true;
    v_result := 'applied';
    v_live := null;
  elsif found then
    perform set_config('classmeet.system', 'off', true);
    return 'waiting';
  end if;

  -- 2) pilih berita berikutnya HANYA sekarang, menurut kondisi pasar (pick_next_news), bila jeda sudah habis.
  if v_allowed is null or v_now >= v_allowed then
    begin
      v_pid := public.pick_next_news();
    exception when others then
      v_pid := null;
      insert into audit_log (action, payload) values ('news_pick_failed', jsonb_build_object('error', sqlerrm));
    end;
    if v_pid is not null then
      select * into v_pick from news where id = v_pid and status = 'ready' for update;
      if found then
        begin
          -- buang efek pada aset yang sudah nonaktif (bangkrut); sisanya harus tetap memenuhi minimum
          delete from news_effects e using assets a
           where e.news_id = v_pick.id and a.id = e.asset_id and not a.is_active;
          perform public.check_news_effects(v_pick.id);
          v_secs := v_dmin * 60 + floor(random() * (greatest(v_dmax * 60 - 10, v_dmin * 60) - v_dmin * 60 + 1))::int;
          update news
             set status = 'live', published_at = v_now,
                 effect_at = v_now + make_interval(secs => v_secs)
           where id = v_pick.id;
          insert into news_feed (news_id, title, body, published_at)
          select id, title, body, published_at from news where id = v_pick.id;
          insert into market_event_log (asset_id, kind, news_id, at)
          select np.asset_id, np.kind, np.news_id, v_now from public.news_pool() np
           where np.news_id = v_pick.id and np.kind <> 'price' and np.asset_id is not null;
          v_result := case when v_result = 'applied' then 'applied+launched' else 'launched' end;
        exception when others then
          update news set status = 'draft' where id = v_pick.id;
          insert into audit_log (action, payload)
          values ('news_launch_failed', jsonb_build_object('news_id', v_pick.id));
        end;
      end if;
    end if;
  end if;
  if v_result like 'applied%' then
    perform public.process_house_quotes();
  end if;
  perform set_config('classmeet.system', 'off', true);
  return v_result;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Status game: catat `market_opened_at` (pembukaan pertama, atau dibuka lagi sesudah dijeda > 60 menit)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.admin_set_game_state(p_state game_state)
returns game_state
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_cur     game_state;
  v_news    int;
  v_paused  timestamptz;
  v_shift   interval;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.ob_lock();

  if p_state = 'finished' then
    perform 1 from teams order by id for update;
  end if;

  select state, paused_at into v_cur, v_paused from game_settings for update;

  if not ((v_cur = 'setup'  and p_state = 'open')
       or (v_cur = 'open'   and p_state in ('paused', 'finished'))
       or (v_cur = 'paused' and p_state in ('open', 'finished'))) then
    raise exception 'invalid_state_transition';
  end if;

  if p_state = 'finished' then
    select count(*) into v_news from news where status = 'live';
    if v_news > 0 then
      raise exception 'news_pending';
    end if;
    perform public.ob_cancel_all();
    perform set_config('classmeet.system', 'off', true);
    perform public.freeze_leaderboard_internal();
  end if;

  if p_state = 'open' and v_cur = 'paused' and v_paused is not null then
    v_shift := now() - v_paused;
    perform set_config('classmeet.system', 'on', true);
    update news set effect_at = effect_at + v_shift where status = 'live';
    perform set_config('classmeet.system', 'off', true);
    update game_settings set news_next_allowed_at = news_next_allowed_at + v_shift
     where news_next_allowed_at is not null;
  end if;

  update game_settings
     set state = p_state,
         paused_at = case when p_state = 'paused' then now() else null end,
         started_at = case when v_cur = 'setup' and p_state = 'open' then now() else started_at end,
         market_opened_at = case
           when p_state = 'open' and (v_cur = 'setup' or v_paused is null or v_paused < now() - interval '60 minutes')
             then now() else market_opened_at end,
         updated_at = now() where true;

  insert into audit_log (actor_id, action, payload)
  values (v_uid, 'set_state', jsonb_build_object('from', v_cur, 'to', p_state));

  if p_state = 'open' then
    perform public.process_news_cycle();
    perform public.process_house_quotes();
  end if;
  return p_state;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Untuk admin: cakupan kumpulan (HANYA sebelum game dibuka) dan jumlah per jenis (kapan saja, tanpa isi)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.news_pool_coverage()
returns table (asset_id uuid, symbol text, bankrupt int, suspend int, dividend int)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  -- Sesudah game dibuka admin tidak boleh tahu aset mana yang masih punya berita event.
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;
  return query
  select a.id, a.symbol,
         (count(*) filter (where np.kind = 'bankrupt'))::int,
         (count(*) filter (where np.kind = 'suspend'))::int,
         (count(*) filter (where np.kind = 'dividend'))::int
    from assets a
    left join public.news_pool() np on np.asset_id = a.id and np.status = 'ready'
   where a.is_active
   group by a.id, a.symbol
   order by a.symbol;
end $$;

create or replace function public.get_news_pool_kinds()
returns table (kind text, ready_count int)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query
  select k.kind, (count(np.news_id))::int
    from (values ('price'), ('bankrupt'), ('suspend'), ('dividend')) as k(kind)
    left join public.news_pool() np on np.kind = k.kind and np.status = 'ready'
   group by k.kind
   order by array_position(array['price', 'bankrupt', 'suspend', 'dividend'], k.kind);
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 11. Hak akses
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.cm_now() from public, anon, authenticated;
revoke all on function public.news_pool() from public, anon, authenticated;
revoke all on function public.market_state() from public, anon, authenticated;
revoke all on function public.event_chances() from public, anon, authenticated;
revoke all on function public.pick_next_news() from public, anon, authenticated;
revoke all on function public.check_news_effects(uuid) from public, anon, authenticated;
revoke all on function public.process_news_cycle() from public, anon, authenticated;
revoke all on function public.news_pool_coverage() from public, anon;
grant execute on function public.news_pool_coverage() to authenticated;
revoke all on function public.get_news_pool_kinds() from public, anon;
grant execute on function public.get_news_pool_kinds() to authenticated;
revoke all on function public.admin_set_game_state(game_state) from public, anon;
grant execute on function public.admin_set_game_state(game_state) to authenticated;

select set_config('classmeet.system', 'off', false);
