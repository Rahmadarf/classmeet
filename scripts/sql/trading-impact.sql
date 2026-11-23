-- Tekanan harga DI DALAM transaksi (23 Nov): menutup arbitrase beli lalu jual langsung. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 < scripts/sql/trading-impact.sql
--
-- Masalah (ditemukan 23 Nov): `buy_asset`/`sell_asset` membayar SEMUA unit pada harga tayang sebelum transaksi, baru sesudahnya
-- tekanan stok menaikkan/menurunkan harga. Beli n unit sekaligus lalu jual n unit langsung memberi untung tanpa risiko
-- (mis. IN dan SM beli 35 lalu jual 35: +4,8 %), dan bisa diulang terus karena tekanan kembali ke nol sesudah dijual.
--
-- Perbaikan: harga bergerak SATU LANGKAH TEKANAN (`pressure_bps_per_unit`) per unit di dalam transaksi itu sendiri.
--   Beli  : unit ke-i (mulai 0) dibayar `shop_price(acuan, min(batas, faktor + i x langkah))`.
--   Jual  : unit ke-j (mulai 0) diterima `shop_sell_price(shop_price(acuan, maks(-batas, faktor - j x langkah)))`.
--   Total = jumlah harga tiap unit; `unit_price` = rata-rata (dibulatkan); `list_price` = harga tayang sebelum transaksi.
--   n = 1 TIDAK berubah (harga tayang / harga jual yang tampil). Bolak-balik n unit selalu rugi karena tiap unit dijual pada
--   tingkat harga yang sama dengan saat dibeli, atau lebih tinggi hanya satu langkah, sedangkan selisih jual harus > langkah:
--   syarat itu ditegakkan (`game_settings_spread_gt_pressure` dan `admin_set_trade_settings`).
select set_config('classmeet.system', 'on', false);

-- Selisih jual harus lebih besar dari langkah tekanan per unit (kalau tidak, satu langkah bisa melampaui selisih = arbitrase).
alter table public.game_settings drop constraint if exists game_settings_spread_gt_pressure;
alter table public.game_settings add constraint game_settings_spread_gt_pressure
  check (sell_spread_bps > pressure_bps_per_unit);

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
  -- harga naik satu langkah tekanan per unit di dalam transaksi ini (unit pertama = harga tayang)
  select coalesce(sum(public.shop_price(a.price, least(g.pressure_cap_bps, a.price_factor_bps + i * g.pressure_bps_per_unit),
                                        a.min_price, a.max_price)), 0)::bigint
    into v_total from generate_series(0, p_qty - 1) as i;
  v_price := round(v_total::numeric / p_qty)::bigint;          -- harga rata-rata per unit
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
  values (p_request_id, v_uid, a.id, 'buy', p_qty, v_price, a.last_price, v_total)
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
  -- harga turun satu langkah tekanan per unit di dalam transaksi ini (unit pertama = harga jual yang tampil)
  select coalesce(sum(public.shop_sell_price(public.shop_price(a.price,
                        greatest(-g.pressure_cap_bps, a.price_factor_bps - j * g.pressure_bps_per_unit), a.min_price, a.max_price))), 0)::bigint
    into v_total from generate_series(0, p_qty - 1) as j;
  v_price := round(v_total::numeric / p_qty)::bigint;          -- harga rata-rata per unit

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

-- Pengaturan toko: selisih jual harus > tekanan per unit (pesan jelas sebelum constraint basis data menolak).
create or replace function public.admin_set_trade_settings(p_sell_spread_bps integer, p_pressure_bps_per_unit integer,
  p_pressure_cap_bps integer, p_pressure_decay_minutes integer, p_hold_cap_pct integer)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_sell_spread_bps not between 0 and 2000 or p_pressure_bps_per_unit not between 0 and 500
     or p_pressure_cap_bps not between 0 and 5000 or p_pressure_decay_minutes < 1 or p_hold_cap_pct not between 1 and 100
     or p_sell_spread_bps <= p_pressure_bps_per_unit then
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

revoke all on function public.buy_asset(uuid, uuid, integer), public.sell_asset(uuid, uuid, integer),
  public.admin_set_trade_settings(integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.buy_asset(uuid, uuid, integer), public.sell_asset(uuid, uuid, integer),
  public.admin_set_trade_settings(integer, integer, integer, integer, integer) to authenticated;
notify pgrst, 'reload schema';

select set_config('classmeet.system', 'off', false);
