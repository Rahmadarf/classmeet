-- Tes SQL get_market_snapshot() (scripts/sql/market-snapshot.sql). Berjalan di dalam transaksi yang di-ROLLBACK.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-market-snapshot.sql
-- Syarat: market-snapshot.sql sudah dimuat; ada minimal satu tim dan satu admin.
-- Intinya: tiap bagian snapshot HARUS sama dengan keluaran fungsi/tabel lama yang dipakai jalur cadangan di aplikasi.
begin;
set client_min_messages = notice;

create function pg_temp.as_user(p uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as
$$ begin if c then raise notice 'OK    %', msg; else raise exception 'GAGAL: %', msg; end if; end $$;

-- A. Kesamaan dengan jalur lama (sebagai superuser; RLS tidak berlaku, jadi `holdings` diuji lewat filter auth.uid()).
do $t$
declare
  v_team uuid; v_admin uuid;
  s jsonb;
  n_hold int;
begin
  -- Tim uji = tim dengan kepemilikan terbanyak (supaya bagian `holdings` benar-benar teruji); cadangan: tim pertama.
  select team_id into v_team from holdings where qty > 0 group by team_id order by count(*) desc limit 1;
  if v_team is null then select id into v_team from teams order by name limit 1; end if;
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform pg_temp.ok(v_team is not null and v_admin is not null, 'ada tim dan admin uji');

  perform pg_temp.as_user(v_team);
  s := public.get_market_snapshot();

  perform pg_temp.ok(s ?& array['game','assets','summary','day_open','bankrupt','holdings','analysis'], 'ketujuh bagian ada');
  perform pg_temp.ok(jsonb_typeof(s->'game') = 'object', 'game berupa objek');
  perform pg_temp.ok(jsonb_typeof(s->'assets') = 'array' and jsonb_array_length(s->'assets') > 0, 'assets: array tak kosong');
  perform pg_temp.ok((s->'assets') = (select coalesce(jsonb_agg(to_jsonb(a) order by a.symbol), '[]')
                       from (select id, symbol, name, sector, price, last_price, min_price, max_price, suspended_until,
                                    stock, init_stock, price_factor_bps from assets where is_active) a),
                     'assets = aset aktif (kolom yang dibaca fetchMarket)');
  perform pg_temp.ok((s->'summary') = (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.get_market_summary() x),
                     'summary = get_market_summary()');
  perform pg_temp.ok((s->'day_open') = (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.get_day_open_prices() x),
                     'day_open = get_day_open_prices()');
  perform pg_temp.ok((s->'bankrupt') = (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.get_bankrupt_notices() x),
                     'bankrupt = get_bankrupt_notices()');
  perform pg_temp.ok((s->'analysis') = (select to_jsonb(x) from public.get_analysis_offer() x limit 1),
                     'analysis = get_analysis_offer()');
  perform pg_temp.ok((s->'game') = (select to_jsonb(g) from (select state, sell_spread_bps, hold_cap_pct, stock_mid_pct,
                       stock_low_pct, price_step, pressure_bps_per_unit, pressure_cap_bps from game_settings limit 1) g),
                     'game = game_settings (8 kolom fetchGame)');

  select count(*) into n_hold from holdings where team_id = v_team and qty > 0;
  perform pg_temp.ok(jsonb_array_length(s->'holdings') = n_hold, 'holdings: jumlah = baris tim ini (' || n_hold || ')');
  perform pg_temp.ok((s->'holdings') = (select coalesce(jsonb_agg(to_jsonb(h) order by h.asset_id), '[]')
                       from (select asset_id, qty, cost_basis from holdings where team_id = v_team and qty > 0) h),
                     'holdings: isi (aset, qty, cost_basis) persis sama dengan tabel milik tim ini');
  perform pg_temp.ok(not exists (select 1 from jsonb_array_elements(s->'holdings') h
                                  where not exists (select 1 from holdings x where x.team_id = v_team and x.qty > 0
                                                     and x.asset_id = (h->>'asset_id')::uuid and x.qty = (h->>'qty')::int
                                                     and x.cost_basis = (h->>'cost_basis')::bigint)),
                     'holdings: tidak ada baris yang bukan milik tim ini (qty dan cost_basis cocok)');
  -- Peran selain tim ditolak (get_analysis_offer: forbidden).
  perform pg_temp.as_user(v_admin);
  begin
    perform public.get_market_snapshot();
    raise exception 'GAGAL: admin seharusnya ditolak';
  exception when others then
    if sqlerrm = 'forbidden' then raise notice 'OK    admin ditolak (forbidden)';
    else raise; end if;
  end;

  perform set_config('test.team', v_team::text, true);
end $t$;

-- B. Sebagai peran Postgres `authenticated` (RLS dan hak eksekusi sungguhan).
set local role authenticated;
do $t$
declare
  v_team uuid := current_setting('test.team')::uuid;
  s jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_team, 'role', 'authenticated')::text, true);
  s := public.get_market_snapshot();
  if jsonb_array_length(s->'assets') = 0 then raise exception 'GAGAL: authenticated melihat 0 aset'; end if;
  if jsonb_array_length(s->'holdings') <> (select count(*) from holdings where qty > 0) then
    raise exception 'GAGAL: holdings melihat baris selain milik tim (RLS)';
  end if;
  raise notice 'OK    authenticated bisa memanggil; holdings hanya milik tim (RLS)';
end $t$;

-- C. anon tidak boleh memanggil.
reset role;
set local role anon;
do $t$
begin
  begin
    perform public.get_market_snapshot();
    raise exception 'GAGAL: anon seharusnya ditolak';
  exception when insufficient_privilege then
    raise notice 'OK    anon ditolak (hak eksekusi)';
  end;
end $t$;

reset role;
rollback;
