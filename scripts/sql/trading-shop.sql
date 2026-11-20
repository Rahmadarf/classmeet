-- Trading model toko (docs/17): beli dan jual langsung ke pasar pada satu harga, menggantikan order book (docs/12).
-- Migrasi SEKALI untuk database Docker lokal (tidak ke cloud). Jalankan SESUDAH semua skrip SQL lain (berkas ini menimpa
-- admin_set_game_state, process_suspensions, process_news_cycle, market_state, bankrupt_asset, suspend_asset,
-- process_market_cycle). Aman dijalankan ulang (bagian migrasi dan penghapusan hanya jalan bila orders masih ada).
--
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 < scripts/sql/trading-shop.sql
--
-- Harga:
--   assets.price            harga acuan, digeser berita (tidak berubah)
--   assets.price_factor_bps tekanan stok (+ saat dibeli, - saat dijual), kembali ke 0 oleh process_market_cycle
--   assets.last_price       HARGA TAYANG = shop_price(price, factor); dijaga trigger assets_tayang, juga rank_price
--   harga jual              shop_sell_price(last_price) = tayang - sell_spread_bps
-- Kolom lama (fee_bps, band_bps, house_*, rank_*, sell_fee_bps, locked_cash, locked_qty) dibiarkan sementara sebagai
-- usang (nilai 0/diabaikan); dibuang pada tahap pembersihan setelah UI baru.
select set_config('classmeet.system', 'on', false);

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Parameter dan kolom
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.game_settings
  add column if not exists sell_spread_bps int not null default 200 check (sell_spread_bps between 0 and 2000),
  add column if not exists pressure_bps_per_unit int not null default 20 check (pressure_bps_per_unit between 0 and 500),
  add column if not exists pressure_cap_bps int not null default 1500 check (pressure_cap_bps between 0 and 5000),
  add column if not exists pressure_decay_minutes int not null default 10 check (pressure_decay_minutes >= 1),
  add column if not exists hold_cap_pct int not null default 30 check (hold_cap_pct between 1 and 100),
  add column if not exists stock_mid_pct int not null default 50 check (stock_mid_pct between 1 and 100),
  add column if not exists stock_low_pct int not null default 20 check (stock_low_pct between 1 and 100);

drop trigger if exists game_settings_news_lock on public.game_settings;
CREATE TRIGGER game_settings_news_lock BEFORE UPDATE ON public.game_settings FOR EACH ROW WHEN (((old.price_step IS DISTINCT FROM new.price_step) OR (old.max_effect_bps IS DISTINCT FROM new.max_effect_bps) OR (old.min_news_assets IS DISTINCT FROM new.min_news_assets) OR (old.max_news_assets IS DISTINCT FROM new.max_news_assets) OR (old.news_delay_min_minutes IS DISTINCT FROM new.news_delay_min_minutes) OR (old.news_delay_max_minutes IS DISTINCT FROM new.news_delay_max_minutes) OR (old.news_gap_minutes IS DISTINCT FROM new.news_gap_minutes) OR (old.fee_bps IS DISTINCT FROM new.fee_bps) OR (old.band_bps IS DISTINCT FROM new.band_bps) OR (old.house_levels IS DISTINCT FROM new.house_levels) OR (old.sweep_levels IS DISTINCT FROM new.sweep_levels) OR (old.rank_window_minutes IS DISTINCT FROM new.rank_window_minutes) OR (old.rank_min_lots IS DISTINCT FROM new.rank_min_lots) OR (old.house_refresh_seconds IS DISTINCT FROM new.house_refresh_seconds) OR (old.house_refreshed_at IS DISTINCT FROM new.house_refreshed_at) OR (old.house_cash IS DISTINCT FROM new.house_cash)) OR (old.sell_spread_bps IS DISTINCT FROM new.sell_spread_bps) OR (old.pressure_bps_per_unit IS DISTINCT FROM new.pressure_bps_per_unit) OR (old.pressure_cap_bps IS DISTINCT FROM new.pressure_cap_bps) OR (old.pressure_decay_minutes IS DISTINCT FROM new.pressure_decay_minutes) OR (old.hold_cap_pct IS DISTINCT FROM new.hold_cap_pct) OR (old.stock_mid_pct IS DISTINCT FROM new.stock_mid_pct) OR (old.stock_low_pct IS DISTINCT FROM new.stock_low_pct)) EXECUTE FUNCTION guard_game_lock();

alter table public.assets
  add column if not exists price_factor_bps int not null default 0 check (price_factor_bps between -5000 and 5000);

-- Jam pemulihan tekanan; tabel sendiri supaya tidak memicu Realtime game_settings tiap 10 detik.
create table if not exists public.shop_clock (
  id boolean primary key default true check (id),
  pressure_at timestamptz not null default now()
);
insert into public.shop_clock (id) values (true) on conflict do nothing;
alter table public.shop_clock enable row level security;
revoke all on public.shop_clock from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Harga tayang
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.shop_price(p_ref bigint, p_factor int, p_min bigint, p_max bigint)
returns bigint
language sql stable set search_path = public as $$
  select greatest(p_min, least(p_max,
           (round(p_ref * (10000 + p_factor) / 10000.0 / g.price_step) * g.price_step)::bigint))
    from game_settings g
$$;

create or replace function public.shop_sell_price(p_price bigint)
returns bigint
language sql stable set search_path = public as $$
  select greatest(g.price_step, (floor(p_price * (10000 - g.sell_spread_bps) / 10000.0 / g.price_step) * g.price_step)::bigint)
    from game_settings g
$$;

create or replace function public.trg_assets_tayang()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.last_price := public.shop_price(new.price, new.price_factor_bps, new.min_price, new.max_price);
  new.rank_price := new.last_price;
  return new;
end $$;

drop trigger if exists assets_tayang on public.assets;
create trigger assets_tayang before update on public.assets
  for each row when (old.price is distinct from new.price or old.price_factor_bps is distinct from new.price_factor_bps)
  execute function public.trg_assets_tayang();

-- Aset yang belum punya stok/harga awal (dibuat sesudah pembukaan awal) diinisialisasi saat pasar dibuka.
create or replace function public.shop_init_assets()
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('classmeet.system', 'on', true);
  update assets set init_stock = stock, base_price = price where init_stock is null;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Transaksi
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.transactions (
  id          bigint generated always as identity primary key,
  request_id  uuid not null unique,
  team_id     uuid not null references public.teams(id),
  asset_id    uuid not null references public.assets(id),
  side        text not null check (side in ('buy', 'sell')),
  qty         int  not null check (qty > 0),
  unit_price  bigint not null check (unit_price > 0),   -- harga yang dibayar (beli) / diterima (jual)
  list_price  bigint not null check (list_price > 0),   -- harga tayang saat transaksi
  total       bigint not null check (total > 0),
  created_at  timestamptz not null default now()
);
create index if not exists transactions_asset_idx on public.transactions (asset_id, created_at desc);
create index if not exists transactions_team_idx on public.transactions (team_id, created_at desc);
alter table public.transactions enable row level security;
drop policy if exists transactions_read on public.transactions;
create policy transactions_read on public.transactions for select
  using (team_id = auth.uid() or app_role() = 'admin');
revoke all on public.transactions from anon, authenticated;
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Migrasi dari order book (sekali): kembalikan kunci, harga tayang awal, lalu buang tabel order
-- ---------------------------------------------------------------------------------------------------------------------
do $mig$
begin
  if to_regclass('public.orders') is not null then
    update public.teams set cash = cash + locked_cash, locked_cash = 0 where locked_cash > 0;
    update public.holdings set locked_qty = 0 where locked_qty > 0;
    update public.assets a
       set last_price = public.shop_price(a.price, a.price_factor_bps, a.min_price, a.max_price),
           rank_price = public.shop_price(a.price, a.price_factor_bps, a.min_price, a.max_price);
    update public.assets set init_stock = stock, base_price = price where init_stock is null;
  end if;
end $mig$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Beli dan jual
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.buy_asset(p_request_id uuid, p_asset_id uuid, p_qty integer)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  g       public.game_settings;
  a       public.assets;
  v_ex    public.transactions;
  v_tx    public.transactions;
  v_hold  int;
  v_cap   int;
  v_price bigint;
  v_total bigint;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  if p_request_id is null or p_asset_id is null or p_qty is null or p_qty < 1 or p_qty > 100000 then
    raise exception 'invalid_input';
  end if;

  perform public.ob_lock();                                   -- satu kunci pasar: transaksi diserialkan
  perform 1 from teams where id = v_uid for update;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_ex from transactions where request_id = p_request_id;
  if found then
    if v_ex.team_id = v_uid and v_ex.asset_id = p_asset_id and v_ex.side = 'buy' and v_ex.qty = p_qty then
      return v_ex;                                            -- pengiriman ulang: hasil yang sama
    end if;
    raise exception 'request_id_conflict';
  end if;

  select * into g from game_settings;
  if g.state <> 'open' then raise exception 'market_closed'; end if;

  select * into a from assets where id = p_asset_id for update;
  if not found or not a.is_active then raise exception 'asset_not_found'; end if;
  if a.suspended_until is not null and a.suspended_until > public.cm_now() then raise exception 'asset_suspended'; end if;

  v_cap := greatest(1, floor(coalesce(a.init_stock, a.stock) * g.hold_cap_pct / 100.0)::int);
  select coalesce(max(qty), 0) into v_hold from holdings where team_id = v_uid and asset_id = a.id;
  if v_hold + p_qty > v_cap then raise exception 'hold_cap_exceeded'; end if;
  if p_qty > a.stock then raise exception 'insufficient_stock'; end if;

  perform set_config('classmeet.system', 'on', true);
  v_price := a.last_price;
  v_total := v_price * p_qty;
  update teams set cash = cash - v_total where id = v_uid and cash >= v_total;
  if not found then raise exception 'insufficient_cash'; end if;

  insert into holdings (team_id, asset_id, qty, cost_basis) values (v_uid, a.id, p_qty, v_total)
  on conflict (team_id, asset_id)
  do update set qty = holdings.qty + p_qty, cost_basis = holdings.cost_basis + v_total;

  update assets
     set stock = stock - p_qty,
         price_factor_bps = least(g.pressure_cap_bps, price_factor_bps + p_qty * g.pressure_bps_per_unit),
         last_trade_at = now()
   where id = a.id;

  insert into transactions (request_id, team_id, asset_id, side, qty, unit_price, list_price, total)
  values (p_request_id, v_uid, a.id, 'buy', p_qty, v_price, v_price, v_total)
  returning * into v_tx;

  perform set_config('classmeet.system', 'off', true);
  return v_tx;
end $$;

create or replace function public.sell_asset(p_request_id uuid, p_asset_id uuid, p_qty integer)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  g       public.game_settings;
  a       public.assets;
  v_ex    public.transactions;
  v_tx    public.transactions;
  v_hold  int;
  v_cost  bigint;
  v_list  bigint;
  v_price bigint;
  v_total bigint;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  if p_request_id is null or p_asset_id is null or p_qty is null or p_qty < 1 or p_qty > 100000 then
    raise exception 'invalid_input';
  end if;

  perform public.ob_lock();
  perform 1 from teams where id = v_uid for update;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_ex from transactions where request_id = p_request_id;
  if found then
    if v_ex.team_id = v_uid and v_ex.asset_id = p_asset_id and v_ex.side = 'sell' and v_ex.qty = p_qty then
      return v_ex;
    end if;
    raise exception 'request_id_conflict';
  end if;

  select * into g from game_settings;
  if g.state <> 'open' then raise exception 'market_closed'; end if;

  select * into a from assets where id = p_asset_id for update;
  if not found or not a.is_active then raise exception 'asset_not_found'; end if;
  if a.suspended_until is not null and a.suspended_until > public.cm_now() then raise exception 'asset_suspended'; end if;

  select qty, cost_basis into v_hold, v_cost from holdings
   where team_id = v_uid and asset_id = a.id for update;
  if v_hold is null or v_hold < p_qty then raise exception 'insufficient_holdings'; end if;

  perform set_config('classmeet.system', 'on', true);
  v_list := a.last_price;
  v_price := public.shop_sell_price(v_list);
  v_total := v_price * p_qty;

  update teams set cash = cash + v_total where id = v_uid;
  update holdings
     set qty = qty - p_qty,
         cost_basis = greatest(0, cost_basis - (v_cost::numeric * p_qty / v_hold)::bigint)
   where team_id = v_uid and asset_id = a.id;
  update assets
     set stock = stock + p_qty,
         price_factor_bps = greatest(-g.pressure_cap_bps, price_factor_bps - p_qty * g.pressure_bps_per_unit),
         last_trade_at = now()
   where id = a.id;

  insert into transactions (request_id, team_id, asset_id, side, qty, unit_price, list_price, total)
  values (p_request_id, v_uid, a.id, 'sell', p_qty, v_price, v_list, v_total)
  returning * into v_tx;

  perform set_config('classmeet.system', 'off', true);
  return v_tx;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Ringkasan pasar, siklus pasar (pemulihan tekanan), pengaturan admin
-- ---------------------------------------------------------------------------------------------------------------------
drop function if exists public.get_market_summary();
create function public.get_market_summary()
returns table(asset_id uuid, symbol text, ref_price bigint, last_price bigint, sell_price bigint, stock int, init_stock int,
              price_factor_bps int, open_price bigint, high_price bigint, low_price bigint, lot bigint, val bigint,
              avg_price bigint, freq bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is null or app_role() not in ('team', 'admin', 'display') then raise exception 'forbidden'; end if;
  return query
    select a.id, a.symbol, a.price, a.last_price, public.shop_sell_price(a.last_price), a.stock,
           coalesce(a.init_stock, a.stock), a.price_factor_bps,
           (select t.list_price from transactions t where t.asset_id = a.id order by t.id asc limit 1),
           (select max(t.list_price) from transactions t where t.asset_id = a.id),
           (select min(t.list_price) from transactions t where t.asset_id = a.id),
           coalesce((select sum(t.qty) from transactions t where t.asset_id = a.id), 0)::bigint,
           coalesce((select sum(t.total) from transactions t where t.asset_id = a.id), 0)::bigint,
           (select (sum(t.total) / nullif(sum(t.qty), 0))::bigint from transactions t where t.asset_id = a.id),
           (select count(*) from transactions t where t.asset_id = a.id)::bigint
      from assets a where a.is_active order by a.symbol;
end $$;

create or replace function public.process_market_cycle()
returns text
language plpgsql security definer set search_path = public as $$
declare
  g      public.game_settings;
  v_last timestamptz;
  v_el   numeric;
  v_step int;
  v_n    int := 0;
begin
  perform public.ob_lock();
  select * into g from game_settings;
  select pressure_at into v_last from shop_clock;
  update shop_clock set pressure_at = now() where true;
  if g.state <> 'open' then return 'idle'; end if;             -- jeda: jam pemulihan berhenti (pressure_at tetap diperbarui)

  perform public.process_suspensions();

  -- tekanan stok kembali ke 0 secara linear: penuh pulih dalam pressure_decay_minutes
  v_el := least(extract(epoch from now() - v_last), 30);
  v_step := ceil(g.pressure_cap_bps * v_el / (g.pressure_decay_minutes * 60.0))::int;
  if v_step > 0 then
    perform set_config('classmeet.system', 'on', true);
    update assets
       set price_factor_bps = case when price_factor_bps > 0 then greatest(0, price_factor_bps - v_step)
                                   else least(0, price_factor_bps + v_step) end
     where is_active and price_factor_bps <> 0;
    get diagnostics v_n = row_count;
    perform set_config('classmeet.system', 'off', true);
  end if;
  return case when v_n > 0 then 'decayed' else 'idle' end;
end $$;

-- Transaksi terakhir untuk layar display (akun display tidak bisa membaca `transactions` langsung): tanpa nama tim.
create or replace function public.get_last_transactions(p_limit integer default 6)
returns table(symbol text, side text, qty integer, unit_price bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is null or app_role() not in ('admin', 'display') then raise exception 'forbidden'; end if;
  return query
    select a.symbol, t.side, t.qty, t.unit_price, t.created_at
      from transactions t join assets a on a.id = t.asset_id
     order by t.id desc
     limit greatest(1, least(coalesce(p_limit, 6), 30));
end $$;

-- Ringkasan transaksi per aset untuk admin (seluruh transaksi, bukan hanya yang terbaru).
create or replace function public.admin_transaction_summary()
returns table(asset_id uuid, bought bigint, sold bigint, volume bigint, n bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query
    select t.asset_id,
           coalesce(sum(t.qty) filter (where t.side = 'buy'), 0)::bigint,
           coalesce(sum(t.qty) filter (where t.side = 'sell'), 0)::bigint,
           coalesce(sum(t.total), 0)::bigint,
           count(*)::bigint
      from transactions t group by t.asset_id;
end $$;

create or replace function public.admin_set_trade_settings(
  p_sell_spread_bps int, p_pressure_bps_per_unit int, p_pressure_cap_bps int, p_pressure_decay_minutes int, p_hold_cap_pct int)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_sell_spread_bps not between 0 and 2000 or p_pressure_bps_per_unit not between 0 and 500
     or p_pressure_cap_bps not between 0 and 5000 or p_pressure_decay_minutes < 1 or p_hold_cap_pct not between 1 and 100 then
    raise exception 'invalid_input';
  end if;
  update game_settings
     set sell_spread_bps = p_sell_spread_bps, pressure_bps_per_unit = p_pressure_bps_per_unit,
         pressure_cap_bps = p_pressure_cap_bps, pressure_decay_minutes = p_pressure_decay_minutes,
         hold_cap_pct = p_hold_cap_pct, updated_at = now()
   where true;                                                  -- dikunci setelah game dimulai (trigger game_settings_news_lock)
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'set_trade_settings', jsonb_build_object('sell_spread_bps', p_sell_spread_bps,
          'pressure_bps_per_unit', p_pressure_bps_per_unit, 'pressure_cap_bps', p_pressure_cap_bps,
          'pressure_decay_minutes', p_pressure_decay_minutes, 'hold_cap_pct', p_hold_cap_pct));
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Fungsi lama yang disesuaikan (tanpa order book / bandar)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_game_state(p_state game_state)
 RETURNS game_state
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    perform public.shop_init_assets();
  end if;
  return p_state;
end $function$;

CREATE OR REPLACE FUNCTION public.process_suspensions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a      record;
  v_n    int := 0;
  v_prev text := coalesce(current_setting('classmeet.system', true), '');
begin
  perform public.ob_lock();
  perform set_config('classmeet.system', 'on', true);
  for a in select id, symbol from assets
            where is_active and suspended_until is not null and suspended_until <= now()
            order by id for update loop
    update assets set suspended_until = null where id = a.id;
    insert into audit_log (action, payload)
    values ('asset_resumed', jsonb_build_object('asset_id', a.id, 'symbol', a.symbol));
    v_n := v_n + 1;
  end loop;
  perform set_config('classmeet.system', v_prev, true);
  return v_n;
end $function$;

CREATE OR REPLACE FUNCTION public.process_news_cycle()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  perform set_config('classmeet.system', 'off', true);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.market_state()
 RETURNS TABLE(asset_id uuid, symbol text, sector text, price bigint, base_price bigint, cum numeric, up_streak integer, vol numeric, trades_10m integer, last_event_at timestamp with time zone, last_dividend_at timestamp with time zone, suspended boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
         (select count(*)::int from transactions t
           where t.asset_id = a.id and t.created_at > public.cm_now() - interval '10 minutes'),
         (select max(l.at) from market_event_log l where l.asset_id = a.id),
         (select max(l.at) from market_event_log l where l.asset_id = a.id and l.kind = 'dividend'),
         (a.suspended_until is not null and a.suspended_until > public.cm_now())
    from assets a left join agg g on g.asset_id = a.id
   where a.is_active
$function$;

CREATE OR REPLACE FUNCTION public.bankrupt_asset(p_asset_id uuid, p_bps integer, p_news_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a         public.assets;
  v_prev    text := coalesce(current_setting('classmeet.system', true), '');
  v_step    int;
  v_liq     bigint;
  v_total   bigint := 0;
  v_pay     bigint;
  v_holders jsonb := '[]'::jsonb;
  h         record;
begin
  perform public.ob_lock();                                  -- urutan kunci: ob_lock lebih dulu
  perform set_config('classmeet.system', 'on', true);

  select * into a from assets where id = p_asset_id and is_active for update;
  if not found then
    perform set_config('classmeet.system', v_prev, true);
    return;                                                  -- sudah nonaktif/bangkrut: tidak melakukan apa pun
  end if;

  select price_step into v_step from game_settings;
  if p_bps > 0 then
    v_liq := greatest(((a.price * p_bps / 10000 + v_step / 2) / v_step) * v_step, v_step);
  end if;

  -- 1) likuidasi unit tim menjadi uang
  for h in select team_id, qty from holdings where asset_id = a.id and qty > 0 order by team_id for update loop
    v_pay := h.qty * coalesce(v_liq, 0);
    if v_pay > 0 then
      update teams set cash = cash + v_pay where id = h.team_id;
    end if;
    update holdings set qty = 0, cost_basis = 0
     where team_id = h.team_id and asset_id = a.id;
    v_total := v_total + v_pay;
    v_holders := v_holders || jsonb_build_object('team_id', h.team_id, 'qty', h.qty, 'proceeds', v_pay);
  end loop;

  -- 2) nonaktifkan aset
  update assets
     set is_active = false, bankrupt_at = now(), liquidation_price = v_liq
   where id = a.id;

  if v_liq is not null then
    insert into price_history (asset_id, price, news_id, reason) values (a.id, v_liq, p_news_id, 'bangkrut');
  end if;

  insert into audit_log (action, payload)
  values ('asset_bankrupt',
          jsonb_build_object('asset_id', a.id, 'symbol', a.symbol, 'news_id', p_news_id,
                             'ref_price', a.price, 'liquidation_price', v_liq,
                             'total_paid', v_total, 'holders', v_holders));

  perform set_config('classmeet.system', v_prev, true);
end $function$;

CREATE OR REPLACE FUNCTION public.suspend_asset(p_asset_id uuid, p_minutes integer, p_news_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a       public.assets;
  v_prev  text := coalesce(current_setting('classmeet.system', true), '');
  v_until timestamptz;
begin
  perform public.ob_lock();
  perform set_config('classmeet.system', 'on', true);

  select * into a from assets where id = p_asset_id and is_active for update;
  if not found then
    perform set_config('classmeet.system', v_prev, true);
    return;
  end if;

  v_until := greatest(coalesce(a.suspended_until, now()), now() + make_interval(mins => p_minutes));
  update assets set suspended_until = v_until where id = a.id;

  insert into audit_log (action, payload)
  values ('asset_suspended',
          jsonb_build_object('asset_id', a.id, 'symbol', a.symbol, 'news_id', p_news_id,
                             'minutes', p_minutes, 'until', v_until));

  perform set_config('classmeet.system', v_prev, true);
end $function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Buang order book
-- ---------------------------------------------------------------------------------------------------------------------
drop table if exists public.trades;
-- fungsi yang bergantung pada tipe `orders` harus dibuang lebih dulu, lalu tabel (pemicunya ikut), lalu sisanya
do $drop$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('place_order', 'cancel_order', 'get_order_book', 'ob_cancel', 'ob_cancel_all', 'ob_match',
                                'ob_fee', 'order_band', 'process_house_quotes')
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $drop$;
drop table if exists public.orders;
do $drop$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('trg_orders_suspended', 'tick_for', 'round_tick', 'ceil_tick', 'floor_tick')
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $drop$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Hak akses
-- ---------------------------------------------------------------------------------------------------------------------
revoke all on function public.buy_asset(uuid, uuid, integer) from public, anon;
grant execute on function public.buy_asset(uuid, uuid, integer) to authenticated, service_role;
revoke all on function public.sell_asset(uuid, uuid, integer) from public, anon;
grant execute on function public.sell_asset(uuid, uuid, integer) to authenticated, service_role;
revoke all on function public.get_market_summary() from public, anon;
grant execute on function public.get_market_summary() to authenticated, service_role;
revoke all on function public.admin_transaction_summary() from public, anon;
grant execute on function public.admin_transaction_summary() to authenticated, service_role;
revoke all on function public.get_last_transactions(integer) from public, anon;
grant execute on function public.get_last_transactions(integer) to authenticated, service_role;
revoke all on function public.admin_set_trade_settings(int, int, int, int, int) from public, anon;
grant execute on function public.admin_set_trade_settings(int, int, int, int, int) to authenticated, service_role;
revoke all on function public.shop_init_assets() from public, anon, authenticated;
revoke all on function public.shop_price(bigint, int, bigint, bigint) from public, anon;
revoke all on function public.shop_sell_price(bigint) from public, anon;
revoke all on function public.process_market_cycle() from public, anon, authenticated;
revoke all on function public.process_suspensions() from public, anon, authenticated;
revoke all on function public.process_news_cycle() from public, anon, authenticated;
revoke all on function public.market_state() from public, anon, authenticated;
revoke all on function public.bankrupt_asset(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.suspend_asset(uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_set_game_state(game_state) from public, anon;
grant execute on function public.admin_set_game_state(game_state) to authenticated;

select set_config('classmeet.system', 'off', false);
notify pgrst, 'reload schema';
