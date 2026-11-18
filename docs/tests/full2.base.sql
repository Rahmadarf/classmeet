
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
create publication supabase_realtime;
create type app_role      as enum ('admin', 'guard', 'team', 'display');
create type game_state    as enum ('setup', 'open', 'paused', 'finished');
-- draft: bisa disunting | ready: masuk kumpulan, dipilih acak oleh sistem | live: sudah tampil,
-- efek harga menunggu | applied: harga sudah berubah | cancelled: tidak dipakai lagi (tidak ada jalur yang membatalkan)
-- Tidak ada status 'queued': panitia tidak bisa memilih berita (diputuskan 17 Nov).
create type news_status   as enum ('draft', 'ready', 'live', 'applied', 'cancelled');

-- Bentuk hasil fungsi baca. Memakai tipe komposit agar nama kolom hasil
-- tidak bentrok dengan nama kolom tabel di dalam fungsi plpgsql.
create type leaderboard_row as (
  rank int, team_id uuid, team_name text,
  cash bigint, holdings_value bigint, net_worth bigint
);
-- cash = saldo yang bebas dipakai; locked_cash = saldo yang tertahan di order beli antre
create type my_summary as (cash bigint, holdings_value bigint, net_worth bigint, locked_cash bigint);
create type team_ref   as (team_id uuid, team_name text, cash bigint);  -- cash: saldo tim, ditampilkan ke penjaga saat form hadiah
create type post_payout_row as (
  id bigint, team_name text, amount bigint, created_at timestamptz
);

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,32}$'),
  role         app_role not null,
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- Helper peran. Jangan beri nama "current_role" (kata kunci SQL).
-- security definer agar bisa membaca profiles tanpa memicu RLS rekursif
-- saat dipakai di kebijakan tabel lain.
create or replace function public.app_role()
returns app_role
language sql stable security definer
set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create table teams (
  id         uuid primary key references profiles(id) on delete cascade,
  name       text not null unique,
  cash       bigint not null default 0 check (cash >= 0),          -- saldo bebas
  locked_cash bigint not null default 0 check (locked_cash >= 0),  -- tertahan di order beli yang antre
  qr_token   uuid not null unique default gen_random_uuid(),
  short_code text not null unique check (short_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

create table posts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text not null,
  guard_id    uuid not null unique references profiles(id),
  is_open     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table assets (
  id             uuid primary key default gen_random_uuid(),
  symbol         text not null unique check (symbol ~ '^[A-Z0-9]{2,8}$'),
  name           text not null,
  sector         text not null,
  price          bigint not null check (price > 0),
  min_price      bigint not null check (min_price > 0),
  max_price      bigint not null,
  stock          int not null check (stock >= 0),     -- persediaan BANDAR (panitia); stok awal seluruhnya dipegang bandar
  last_price     bigint check (last_price > 0),       -- harga transaksi terakhir; null sebelum ada transaksi/berita. Inilah harga yang tampil dan dihitung
  rank_price     bigint check (rank_price > 0),       -- harga PERINGKAT: VWAP jendela waktu (game_settings.rank_window_minutes), dilapis harga peringkat sebelumnya bila volume tipis. Dipakai net worth dan leaderboard; null sebelum ada transaksi
  last_trade_at  timestamptz,
  base_price     bigint check (base_price > 0),       -- harga acuan saat pasar pertama dibuka, penyebut indeks IKC
  init_stock     int check (init_stock >= 0),         -- stok awal bandar, dasar lot per level kuotasi
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  check (max_price >= min_price),
  check (price between min_price and max_price)
);
create index on assets (sector);

create table holdings (
  team_id    uuid not null references teams(id) on delete cascade,
  asset_id   uuid not null references assets(id),
  qty        int not null check (qty >= 0),            -- total milik tim, TERMASUK yang terkunci di order jual
  locked_qty int not null default 0 check (locked_qty >= 0 and locked_qty <= qty),
  cost_basis bigint not null check (cost_basis >= 0),  -- total biaya kepemilikan saat ini
  primary key (team_id, asset_id)
);

create table orders (
  id           bigint generated always as identity primary key,   -- urutan id = prioritas waktu
  request_id   uuid unique,                                       -- idempotensi; null untuk order bandar
  team_id      uuid references teams(id),                         -- null = bandar
  asset_id     uuid not null references assets(id),
  side         text not null check (side in ('buy', 'sell')),
  kind         text not null check (kind in ('limit', 'market')),
  price        bigint check (price > 0),
  qty          int not null check (qty >= 1),
  remaining    int not null check (remaining >= 0 and remaining <= qty),
  lock_per_lot bigint not null default 0 check (lock_per_lot >= 0),  -- beli limit: harga + biaya per lot yang ditahan
  status       text not null default 'open' check (status in ('open', 'partial', 'filled', 'cancelled')),
  is_house     boolean not null default false,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz,
  check ((is_house and team_id is null) or (not is_house and team_id is not null)),
  check (kind <> 'limit' or price is not null),
  check (status not in ('open', 'partial') or remaining > 0),
  check (status <> 'filled' or remaining = 0)
);
create index orders_book on orders (asset_id, side, price, id) where status in ('open', 'partial');
create index orders_team on orders (team_id, id desc);

create table trades (
  id            bigint generated always as identity primary key,
  asset_id      uuid not null references assets(id),
  price         bigint not null check (price > 0),     -- harga order yang sudah antre (maker)
  qty           int not null check (qty > 0),
  buy_order_id  bigint not null references orders(id),
  sell_order_id bigint not null references orders(id),
  buyer_id      uuid references teams(id),             -- null = bandar
  seller_id     uuid references teams(id),
  buyer_fee     bigint not null default 0 check (buyer_fee >= 0),
  seller_fee    bigint not null default 0 check (seller_fee >= 0),
  taker_side    text not null check (taker_side in ('buy', 'sell')),
  created_at    timestamptz not null default now(),
  check (buyer_id is not null or seller_id is not null)
);
create index on trades (asset_id, id desc);
create index on trades (buyer_id, id desc);
create index on trades (seller_id, id desc);

create table payouts (
  id          bigint generated always as identity primary key,
  request_id  uuid not null unique,                 -- kunci idempotensi dari klien penjaga
  post_id     uuid not null references posts(id),
  team_id     uuid not null references teams(id),
  guard_id    uuid not null references profiles(id),
  amount      bigint not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now()
);
create index on payouts (team_id, created_at desc);
create index on payouts (post_id, team_id);

create table news (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  body              text not null,
  status            news_status not null default 'draft',
  published_at      timestamptz,          -- saat berita tampil ke peserta
  effect_at         timestamptz,          -- saat harga akan berubah (terbit + jeda acak 3-15 menit, diundi sistem)
  effect_applied_at timestamptz,
  created_by        uuid not null references profiles(id),
  created_at        timestamptz not null default now(),
  check (status not in ('live', 'applied') or (published_at is not null and effect_at is not null)),
  check (status <> 'applied' or effect_applied_at is not null)
);
-- paling banyak satu berita live pada satu waktu
create unique index news_one_live on news ((true)) where status = 'live';

create table news_effects (
  news_id  uuid not null references news(id) on delete cascade,
  asset_id uuid not null references assets(id),
  pct_bps  int  not null check (pct_bps between -9000 and 100000),   -- 100 bps = 1 %
  primary key (news_id, asset_id)                                    -- satu aset sekali per berita
);

-- Yang dilihat peserta. Terpisah dari `news` agar waktu efek (effect_at) tidak ikut terbaca.
create table news_feed (
  news_id      uuid primary key references news(id),
  title        text not null,
  body         text not null,
  published_at timestamptz not null
);

create table price_history (
  id         bigint generated always as identity primary key,
  asset_id   uuid not null references assets(id),
  price      bigint not null check (price > 0),
  news_id    uuid references news(id),
  reason     text,              -- 'berita' (tidak ada jalur manual setelah game dibuka)
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index on price_history (asset_id, created_at);

create table game_settings (
  id                        boolean primary key default true check (id),  -- memaksa satu baris
  state                     game_state not null default 'setup',
  sell_fee_bps              int not null default 0 check (sell_fee_bps between 0 and 5000),  -- tidak dipakai lagi (diganti fee_bps)
  fee_bps                   int not null default 25 check (fee_bps between 0 and 1000),      -- biaya per sisi per pencocokan, dibulatkan ke atas
  band_bps                  int not null default 1500 check (band_bps between 100 and 5000), -- ARA/ARB: +/- dari harga acuan
  house_levels              int not null default 5 check (house_levels between 1 and 10),    -- jumlah level bid dan offer bandar
  sweep_levels              int not null default 5 check (sweep_levels between 1 and 10),    -- level maksimum yang disapu satu order market
  rank_window_minutes       int not null default 10 check (rank_window_minutes between 1 and 120),  -- jendela VWAP harga peringkat
  rank_min_lots             int not null default 5 check (rank_min_lots between 1 and 100),         -- volume jendela minimum; kekurangannya diisi harga peringkat sebelumnya
  house_refresh_seconds     int not null default 300 check (house_refresh_seconds >= 10),
  house_refreshed_at        timestamptz,
  house_cash                bigint not null default 0,   -- selisih uang bandar: terima (+) dan bayar (-) termasuk biaya; uang tim + house_cash = hadiah + koreksi
  price_step                int not null default 100 check (price_step >= 1),
  news_delay_min_minutes    int not null default 3  check (news_delay_min_minutes >= 1),
  news_delay_max_minutes    int not null default 15,
  news_gap_minutes          int not null default 0  check (news_gap_minutes >= 0),
  started_at                timestamptz,          -- terisi saat pasar dibuka pertama kali; sesudahnya harga dan berita terkunci
  news_next_allowed_at      timestamptz,          -- berita berikutnya baru boleh terbit setelah waktu ini
  paused_at                 timestamptz,
  min_news_assets           int not null default 4 check (min_news_assets >= 1),
  max_news_assets           int not null default 7,
  max_effect_bps            int not null default 1500 check (max_effect_bps between 100 and 9000),
  leaderboard_visible       boolean not null default true,
  leaderboard_frozen_at     timestamptz,
  updated_at                timestamptz not null default now(),
  check (max_news_assets >= min_news_assets),
  check (news_delay_max_minutes >= news_delay_min_minutes)
);
insert into game_settings default values;

create table audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references profiles(id),
  action     text not null,        -- mis. 'payout_awarded', 'adjust_cash', 'set_price', 'set_state'
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
create index on audit_log (created_at desc);

create table leaderboard_snapshot (
  team_id        uuid primary key references teams(id),
  rank           int    not null,
  cash           bigint not null,
  holdings_value bigint not null,
  net_worth      bigint not null,
  frozen_at      timestamptz not null default now()
);

create or replace function public.game_is_locked() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select started_at is not null from game_settings), false) $$;

create or replace function public.guard_game_lock() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.game_is_locked() and coalesce(current_setting('classmeet.system', true), '') <> 'on' then
    raise exception 'game_started_locked';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger assets_price_lock
  before update on assets for each row
  when (old.price     is distinct from new.price
     or old.min_price is distinct from new.min_price
     or old.max_price is distinct from new.max_price
     or old.is_active is distinct from new.is_active
     or old.last_price is distinct from new.last_price
     or old.rank_price is distinct from new.rank_price
     or old.last_trade_at is distinct from new.last_trade_at
     or old.base_price is distinct from new.base_price
     or old.init_stock is distinct from new.init_stock)
  execute function public.guard_game_lock();
create trigger assets_ins_del_lock
  before insert or delete on assets for each statement
  execute function public.guard_game_lock();
create trigger news_lock
  before insert or update or delete on news for each statement
  execute function public.guard_game_lock();
create trigger news_effects_lock
  before insert or update or delete on news_effects for each statement
  execute function public.guard_game_lock();
create trigger price_history_lock
  before insert or update or delete on price_history for each statement
  execute function public.guard_game_lock();
create trigger game_settings_news_lock
  before update on game_settings for each row
  when (old.price_step is distinct from new.price_step
     or old.max_effect_bps is distinct from new.max_effect_bps
     or old.min_news_assets is distinct from new.min_news_assets
     or old.max_news_assets is distinct from new.max_news_assets
     or old.news_delay_min_minutes is distinct from new.news_delay_min_minutes
     or old.news_delay_max_minutes is distinct from new.news_delay_max_minutes
     or old.news_gap_minutes is distinct from new.news_gap_minutes
     or old.fee_bps is distinct from new.fee_bps
     or old.band_bps is distinct from new.band_bps
     or old.house_levels is distinct from new.house_levels
     or old.sweep_levels is distinct from new.sweep_levels
     or old.rank_window_minutes is distinct from new.rank_window_minutes
     or old.rank_min_lots is distinct from new.rank_min_lots
     or old.house_refresh_seconds is distinct from new.house_refresh_seconds
     or old.house_refreshed_at is distinct from new.house_refreshed_at
     or old.house_cash is distinct from new.house_cash)
  execute function public.guard_game_lock();
-- Order book: hanya fungsi sistem (place_order, cancel_order, process_house_quotes) yang menulis
create trigger orders_lock
  before insert or update or delete on orders for each statement
  execute function public.guard_game_lock();
create trigger trades_lock
  before insert or update or delete on trades for each statement
  execute function public.guard_game_lock();

create or replace view v_team_net_worth as
select t.id as team_id,
       t.name,
       (t.cash + t.locked_cash)::bigint as cash,
       coalesce(sum(h.qty * coalesce(a.rank_price, a.price)), 0)::bigint as holdings_value,
       (t.cash + t.locked_cash + coalesce(sum(h.qty * coalesce(a.rank_price, a.price)), 0))::bigint as net_worth,
       t.cash as avail_cash,
       t.locked_cash
from teams t
left join holdings h on h.team_id = t.id and h.qty > 0
left join assets a on a.id = h.asset_id
group by t.id, t.name, t.cash, t.locked_cash;

-- WAJIB: view dimiliki postgres sehingga MELEWATI RLS. Tanpa cabut ini,
-- tim mana pun bisa membaca saldo dan kekayaan semua tim.
revoke all on v_team_net_worth from anon, authenticated;

alter table profiles             enable row level security;
alter table teams                enable row level security;
alter table posts                enable row level security;
alter table assets               enable row level security;
alter table holdings             enable row level security;
alter table orders               enable row level security;
alter table trades               enable row level security;
alter table payouts               enable row level security;
alter table news                 enable row level security;
alter table news_feed            enable row level security;
alter table news_effects         enable row level security;
alter table price_history        enable row level security;
alter table game_settings        enable row level security;
alter table audit_log            enable row level security;
alter table leaderboard_snapshot enable row level security;

-- Cabut semua hak tulis langsung dari klien
revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
-- Snapshot hanya lewat get_leaderboard()
revoke all on leaderboard_snapshot from authenticated;

create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid() or app_role() = 'admin');

create policy teams_read on teams for select to authenticated
  using (id = auth.uid() or app_role() = 'admin');

create policy posts_read on posts for select to authenticated
  using (true);

create policy assets_read on assets for select to authenticated
  using (true);

create policy holdings_read on holdings for select to authenticated
  using (team_id = auth.uid() or app_role() = 'admin');

create policy orders_read on orders for select to authenticated
  using (team_id = auth.uid() or app_role() = 'admin');

create policy trades_read on trades for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or app_role() = 'admin');

create policy payouts_read on payouts for select to authenticated
  using (
    team_id = auth.uid()
    or app_role() = 'admin'
    or post_id in (select id from posts where guard_id = auth.uid())
  );

-- Admin hanya boleh membaca kumpulan SEBELUM game dibuka. Sesudahnya isi kumpulan, status, dan effect_at
-- tertutup untuk semua orang, supaya urutan dan waktu perubahan harga tidak bisa bocor dari panitia.
create policy news_read on news for select to authenticated
  using (app_role() = 'admin' and not public.game_is_locked());

create policy news_feed_read on news_feed for select to authenticated
  using (true);

create policy news_effects_read on news_effects for select to authenticated
  using (app_role() = 'admin' and not public.game_is_locked());

create policy price_history_read on price_history for select to authenticated
  using (true);

create policy game_settings_read on game_settings for select to authenticated
  using (true);

create policy audit_log_read on audit_log for select to authenticated
  using (app_role() = 'admin');

alter publication supabase_realtime add table assets, news_feed, game_settings, payouts, posts;

-- ---------- helper murni ----------
create or replace function public.tick_for(p bigint) returns int
language sql immutable
as $$ select case when p < 200000 then 500 when p < 500000 then 1000 else 2500 end $$;

create or replace function public.floor_tick(p bigint) returns bigint
language sql immutable
as $$ select (p / public.tick_for(p)) * public.tick_for(p)::bigint $$;

create or replace function public.ceil_tick(p bigint) returns bigint
language sql immutable
as $$ select ((p + public.tick_for(p) - 1) / public.tick_for(p)) * public.tick_for(p)::bigint $$;

create or replace function public.round_tick(p bigint) returns bigint
language sql immutable
as $$ select greatest(((p + public.tick_for(p) / 2) / public.tick_for(p)) * public.tick_for(p)::bigint,
                      public.tick_for(p)::bigint) $$;

-- biaya: dibulatkan ke atas
create or replace function public.ob_fee(p_price bigint, p_qty int, p_bps int) returns bigint
language sql immutable
as $$ select (p_price * p_qty * p_bps + 9999) / 10000 $$;

-- batas ARB/ARA terhadap harga acuan
create or replace function public.order_band(p_asset uuid)
returns table (lo bigint, hi bigint)
language sql stable security definer set search_path = public
as $$
  select greatest(public.ceil_tick((a.price * (10000 - g.band_bps) + 9999) / 10000), a.min_price),
         least(public.floor_tick((a.price * (10000 + g.band_bps)) / 10000), a.max_price)
    from assets a, game_settings g where a.id = p_asset
$$;

-- ---------- kunci serialisasi ----------
create or replace function public.ob_lock() returns void
language sql security definer set search_path = public
as $$ select pg_advisory_xact_lock(7001) $$;

-- ---------- pembatalan satu order (internal) ----------
create or replace function public.ob_cancel(p_order bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare o public.orders;
begin
  perform set_config('classmeet.system', 'on', true);
  select * into o from orders where id = p_order and status in ('open', 'partial') for update;
  if not found then return; end if;
  if not o.is_house then
    if o.side = 'buy' and o.lock_per_lot > 0 then
      update teams set locked_cash = locked_cash - o.lock_per_lot * o.remaining,
                       cash        = cash        + o.lock_per_lot * o.remaining
       where id = o.team_id;
    elsif o.side = 'sell' then
      update holdings set locked_qty = locked_qty - o.remaining
       where team_id = o.team_id and asset_id = o.asset_id;
    end if;
  end if;
  update orders set status = 'cancelled', closed_at = now() where id = o.id;
end $$;

create or replace function public.ob_cancel_all() returns void
language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  for r in select id from orders where status in ('open', 'partial') order by id loop
    perform public.ob_cancel(r.id);
  end loop;
end $$;

-- ---------- pencocokan (internal; dipanggil place_order dan process_house_quotes) ----------
create or replace function public.ob_match(p_order bigint) returns void
language plpgsql security definer set search_path = public
as $$
declare
  o         public.orders;
  m         public.orders;
  v_fee     int;
  v_sweep   int;
  v_n       int;
  v_cost    bigint;
  v_fb      bigint;
  v_fs      bigint;
  v_blpl    bigint;
  v_buyer   uuid;
  v_seller  uuid;
  v_buy_ord bigint;
  v_sell_ord bigint;
  v_cash    bigint;
  v_stock   int;
  v_oldq    int;
  v_oldc    bigint;
  v_out     bigint;
  v_levels  int := 0;
  v_lastp   bigint;
  v_lastfill bigint;
  v_win     int;
  v_minlots int;
  v_filled  int := 0;
  v_house   bigint := 0;
begin
  perform set_config('classmeet.system', 'on', true);
  select * into o from orders where id = p_order for update;
  select fee_bps, sweep_levels, rank_window_minutes, rank_min_lots into v_fee, v_sweep, v_win, v_minlots from game_settings;

  loop
    exit when o.remaining = 0;

    if o.side = 'buy' then
      select * into m from orders x
       where x.asset_id = o.asset_id and x.side = 'sell' and x.status in ('open', 'partial')
         and x.team_id is distinct from o.team_id
         and (o.kind = 'market' or x.price <= o.price)
       order by x.price asc, x.id asc limit 1 for update;
    else
      select * into m from orders x
       where x.asset_id = o.asset_id and x.side = 'buy' and x.status in ('open', 'partial')
         and x.team_id is distinct from o.team_id
         and (o.kind = 'market' or x.price >= o.price)
       order by x.price desc, x.id asc limit 1 for update;
    end if;
    exit when not found;

    if m.price is distinct from v_lastp then v_levels := v_levels + 1; v_lastp := m.price; end if;
    exit when o.kind = 'market' and v_levels > v_sweep;

    v_n := least(o.remaining, m.remaining);

    -- offer bandar dibatasi persediaan
    if m.is_house and m.side = 'sell' then
      select stock into v_stock from assets where id = o.asset_id;
      v_n := least(v_n, v_stock);
      if v_n < 1 then
        update orders set status = 'cancelled', closed_at = now() where id = m.id;
        continue;
      end if;
    end if;

    -- order market beli: hanya sebanyak yang mampu dibayar
    if o.kind = 'market' and o.side = 'buy' and o.team_id is not null then
      select cash into v_cash from teams where id = o.team_id;
      while v_n > 0 and m.price * v_n + public.ob_fee(m.price, v_n, v_fee) > v_cash loop
        v_n := v_n - 1;
      end loop;
      exit when v_n < 1;
    end if;

    v_cost := m.price * v_n;
    if o.side = 'buy' then
      v_buyer := o.team_id; v_buy_ord := o.id; v_blpl := o.lock_per_lot;
      v_seller := m.team_id; v_sell_ord := m.id;
    else
      v_buyer := m.team_id; v_buy_ord := m.id; v_blpl := m.lock_per_lot;
      v_seller := o.team_id; v_sell_ord := o.id;
    end if;
    v_fb := case when v_buyer  is not null then public.ob_fee(m.price, v_n, v_fee) else 0 end;
    v_fs := case when v_seller is not null then public.ob_fee(m.price, v_n, v_fee) else 0 end;

    -- pembeli
    if v_buyer is not null then
      update teams set locked_cash = locked_cash - v_blpl * v_n,
                       cash        = cash + v_blpl * v_n - v_cost - v_fb
       where id = v_buyer;
      insert into holdings (team_id, asset_id, qty, cost_basis)
      values (v_buyer, o.asset_id, v_n, v_cost + v_fb)
      on conflict (team_id, asset_id)
      do update set qty = holdings.qty + excluded.qty,
                    cost_basis = holdings.cost_basis + excluded.cost_basis;
    else
      update assets set stock = stock + v_n where id = o.asset_id;
      v_house := v_house - v_cost;
    end if;

    -- penjual
    if v_seller is not null then
      select qty, cost_basis into v_oldq, v_oldc
        from holdings where team_id = v_seller and asset_id = o.asset_id for update;
      v_out := (v_oldc * v_n) / v_oldq;
      update holdings set qty = qty - v_n, locked_qty = locked_qty - v_n, cost_basis = cost_basis - v_out
       where team_id = v_seller and asset_id = o.asset_id;
      update teams set cash = cash + v_cost - v_fs where id = v_seller;
    else
      update assets set stock = stock - v_n where id = o.asset_id;
      v_house := v_house + v_cost;
    end if;
    v_house := v_house + v_fb + v_fs;

    insert into trades (asset_id, price, qty, buy_order_id, sell_order_id, buyer_id, seller_id, buyer_fee, seller_fee, taker_side)
    values (o.asset_id, m.price, v_n, v_buy_ord, v_sell_ord, v_buyer, v_seller, v_fb, v_fs, o.side);

    update orders
       set remaining = remaining - v_n,
           status    = case when remaining - v_n = 0 then 'filled' else 'partial' end,
           closed_at = case when remaining - v_n = 0 then now() else null end
     where id = m.id;

    o.remaining := o.remaining - v_n;
    v_filled := v_filled + v_n;
    v_lastfill := m.price;
  end loop;

  -- nasib order penyerang
  if o.remaining = 0 then
    update orders set remaining = 0, status = 'filled', closed_at = now() where id = o.id;
  elsif o.kind = 'market' then
    if o.side = 'sell' and o.team_id is not null then
      update holdings set locked_qty = locked_qty - o.remaining
       where team_id = o.team_id and asset_id = o.asset_id;
    end if;
    update orders set remaining = o.remaining, status = 'cancelled', closed_at = now() where id = o.id;
  else
    update orders set remaining = o.remaining,
                      status = case when v_filled > 0 then 'partial' else 'open' end
     where id = o.id;
  end if;

  if v_lastfill is not null then
    -- harga peringkat: VWAP jendela (termasuk pencocokan ini) dilapis harga peringkat sebelumnya bila volume < rank_min_lots
    update assets a
       set last_price = v_lastfill, last_trade_at = now(),
           rank_price = round((w.pq + coalesce(a.rank_price, a.price)::numeric * greatest(v_minlots - w.q, 0))
                              / greatest(w.q, v_minlots))
      from (select coalesce(sum(t.price * t.qty), 0)::numeric as pq, coalesce(sum(t.qty), 0) as q
              from trades t
             where t.asset_id = o.asset_id
               and t.created_at >= now() - make_interval(mins => v_win)) w
     where a.id = o.asset_id;
  end if;
  if v_house <> 0 then
    update game_settings set house_cash = house_cash + v_house;
  end if;
end $$;

-- ---------- pasang order (tim) ----------
create or replace function public.place_order(
  p_request_id uuid,
  p_asset_id   uuid,
  p_side       text,
  p_kind       text,
  p_price      bigint,
  p_qty        int
) returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_state game_state;
  v_fee   int;
  v_a     public.assets;
  v_lo    bigint;
  v_hi    bigint;
  v_lock  bigint := 0;
  v_ex    public.orders;
  v_ord   public.orders;
  v_id    bigint;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  if p_request_id is null or p_asset_id is null
     or p_side not in ('buy', 'sell') or p_kind not in ('limit', 'market')
     or p_qty is null or p_qty < 1 or p_qty > 100000
     or (p_kind = 'limit'  and (p_price is null or p_price < 1))
     or (p_kind = 'market' and p_price is not null) then
    raise exception 'invalid_input';
  end if;

  perform public.ob_lock();
  perform 1 from teams where id = v_uid for update;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_ex from orders where request_id = p_request_id;
  if found then
    if v_ex.team_id = v_uid and v_ex.asset_id = p_asset_id and v_ex.side = p_side
       and v_ex.kind = p_kind and v_ex.qty = p_qty and v_ex.price is not distinct from p_price then
      return v_ex;                                 -- permintaan ulang yang sama
    end if;
    raise exception 'request_id_conflict';
  end if;

  select state, fee_bps into v_state, v_fee from game_settings;
  if v_state <> 'open' then raise exception 'market_closed'; end if;

  select * into v_a from assets where id = p_asset_id for update;
  if not found or not v_a.is_active then raise exception 'asset_not_found'; end if;

  perform set_config('classmeet.system', 'on', true);

  if p_kind = 'limit' then
    if p_price % public.tick_for(p_price) <> 0 then raise exception 'invalid_tick'; end if;
    select lo, hi into v_lo, v_hi from public.order_band(p_asset_id);
    if p_price < v_lo or p_price > v_hi then raise exception 'price_out_of_range'; end if;
  end if;

  if p_side = 'buy' then
    if p_kind = 'limit' then
      v_lock := p_price + public.ob_fee(p_price, 1, v_fee);
      update teams set cash = cash - v_lock * p_qty, locked_cash = locked_cash + v_lock * p_qty
       where id = v_uid and cash >= v_lock * p_qty;
      if not found then raise exception 'insufficient_cash'; end if;
    else
      perform 1 from teams where id = v_uid and cash > 0;
      if not found then raise exception 'insufficient_cash'; end if;
    end if;
  else
    update holdings set locked_qty = locked_qty + p_qty
     where team_id = v_uid and asset_id = p_asset_id and qty - locked_qty >= p_qty;
    if not found then raise exception 'insufficient_holdings'; end if;
  end if;

  insert into orders (request_id, team_id, asset_id, side, kind, price, qty, remaining, lock_per_lot)
  values (p_request_id, v_uid, p_asset_id, p_side, p_kind, p_price, p_qty, p_qty, v_lock)
  returning id into v_id;

  perform public.ob_match(v_id);

  select * into v_ord from orders where id = v_id;
  perform set_config('classmeet.system', 'off', true);
  return v_ord;
end $$;

-- ---------- batalkan order (tim) ----------
create or replace function public.cancel_order(p_order_id bigint)
returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_state game_state;
  v_ord   public.orders;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  if p_order_id is null then raise exception 'invalid_input'; end if;

  perform public.ob_lock();
  perform 1 from teams where id = v_uid for update;
  if not found then raise exception 'team_not_found'; end if;

  select state into v_state from game_settings;
  if v_state <> 'open' then raise exception 'market_closed'; end if;

  select * into v_ord from orders where id = p_order_id and team_id = v_uid for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_ord.status not in ('open', 'partial') then raise exception 'order_not_open'; end if;

  perform public.ob_cancel(p_order_id);
  perform set_config('classmeet.system', 'off', true);
  select * into v_ord from orders where id = p_order_id;
  return v_ord;
end $$;

-- ---------- kuotasi bandar (sistem) ----------
create or replace function public.process_house_quotes(p_asset uuid default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  g      public.game_settings;
  a      public.assets;
  v_ref  bigint;
  v_lo   bigint;
  v_hi   bigint;
  v_p    bigint;
  v_lot  int;
  v_bud  int;
  v_q    int;
  v_k    int;
  v_id   bigint;
begin
  perform public.ob_lock();
  select * into g from game_settings;
  if g.state <> 'open' then return; end if;
  perform set_config('classmeet.system', 'on', true);

  for a in select * from assets where is_active and (p_asset is null or id = p_asset) order by id loop
    if a.init_stock is null then
      update assets set init_stock = stock, base_price = price where id = a.id returning * into a;
    end if;

    update orders set status = 'cancelled', closed_at = now()
     where asset_id = a.id and is_house and status in ('open', 'partial');

    select lo, hi into v_lo, v_hi from public.order_band(a.id);
    v_ref := public.round_tick(a.price);
    v_lot := greatest(ceil(a.init_stock / 10.0)::int, 1);

    -- offer: persediaan menjadi batas
    v_p := v_ref; v_bud := a.stock;
    for v_k in 1 .. g.house_levels loop
      v_p := v_p + public.tick_for(v_p);
      exit when v_p > v_hi;
      v_q := least(v_lot, v_bud);
      exit when v_q < 1;
      insert into orders (asset_id, side, kind, price, qty, remaining, is_house)
      values (a.id, 'sell', 'limit', v_p, v_q, v_q, true) returning id into v_id;
      perform public.ob_match(v_id);
      v_bud := v_bud - v_q;
    end loop;

    -- bid
    v_p := v_ref;
    for v_k in 1 .. g.house_levels loop
      v_p := v_p - public.tick_for(v_p - 1);
      exit when v_p < v_lo or v_p < 1;
      insert into orders (asset_id, side, kind, price, qty, remaining, is_house)
      values (a.id, 'buy', 'limit', v_p, v_lot, v_lot, true) returning id into v_id;
      perform public.ob_match(v_id);
    end loop;
  end loop;

  update game_settings set house_refreshed_at = now();
  perform set_config('classmeet.system', 'off', true);
end $$;

-- dipanggil penjadwal tiap 10 detik, bersama process_news_cycle()
create or replace function public.process_market_cycle() returns text
language plpgsql security definer set search_path = public
as $$
declare g public.game_settings;
begin
  perform public.ob_lock();
  select * into g from game_settings;
  if g.state <> 'open' then return 'idle'; end if;
  if g.house_refreshed_at is null or now() >= g.house_refreshed_at + make_interval(secs => g.house_refresh_seconds) then
    perform public.process_house_quotes();
    return 'refreshed';
  end if;
  return 'idle';
end $$;

-- order book 5 level per sisi, hanya untuk tim. `mine` = lot milik tim pemanggil di level itu
create or replace function public.get_order_book(p_asset_id uuid)
returns table (side text, price bigint, lots bigint, freq bigint, mine bigint)
language plpgsql stable security definer set search_path = public
as $$
declare v_lv int;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  select house_levels into v_lv from game_settings;
  return query
    with l as (
      select o.side as s, o.price as p, sum(o.remaining)::bigint as lots, count(*)::bigint as freq,
             coalesce(sum(o.remaining) filter (where o.team_id = auth.uid()), 0)::bigint as mine
        from orders o
       where o.asset_id = p_asset_id and o.status in ('open', 'partial')
       group by o.side, o.price
    ), r as (
      select l.*, row_number() over (partition by l.s order by case when l.s = 'sell' then l.p end asc,
                                                               case when l.s = 'buy'  then l.p end desc) as rn
        from l
    )
    select r.s, r.p, r.lots, r.freq, r.mine from r where r.rn <= v_lv
     order by r.s desc, case when r.s = 'sell' then r.p end asc, case when r.s = 'buy' then r.p end desc;
end $$;

-- ringkasan pasar per aset: acuan, harga terakhir, OHLC, Lot, Val, Avg, Freq (dari tabel trades)
create or replace function public.get_market_summary()
returns table (asset_id uuid, symbol text, ref_price bigint, last_price bigint,
               open_price bigint, high_price bigint, low_price bigint,
               lot bigint, val bigint, avg_price bigint, freq bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is null or app_role() not in ('team', 'admin', 'display') then raise exception 'forbidden'; end if;
  return query
    select a.id, a.symbol, a.price, coalesce(a.last_price, a.price),
           (select t.price from trades t where t.asset_id = a.id order by t.id asc  limit 1),
           (select max(t.price) from trades t where t.asset_id = a.id),
           (select min(t.price) from trades t where t.asset_id = a.id),
           coalesce((select sum(t.qty) from trades t where t.asset_id = a.id), 0)::bigint,
           coalesce((select sum(t.price * t.qty) from trades t where t.asset_id = a.id), 0)::bigint,
           (select (sum(t.price * t.qty) / nullif(sum(t.qty), 0))::bigint from trades t where t.asset_id = a.id),
           (select count(*) from trades t where t.asset_id = a.id)::bigint
      from assets a where a.is_active order by a.symbol;
end $$;

-- IKC (semua aset) dan indeks sektor: rata-rata sama rata (harga terakhir / harga awal) x 1000
create or replace function public.get_market_index()
returns table (scope text, value numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is null or app_role() not in ('team', 'admin', 'display') then raise exception 'forbidden'; end if;
  return query
    select 'IKC'::text, round(avg(coalesce(a.last_price, a.price)::numeric / coalesce(a.base_price, a.price)) * 1000, 2)
      from assets a where a.is_active
    union all
    select 'sektor:' || a.sector, round(avg(coalesce(a.last_price, a.price)::numeric / coalesce(a.base_price, a.price)) * 1000, 2)
      from assets a where a.is_active group by a.sector
    order by 1;
end $$;

create or replace function public.resolve_team_qr(p_qr uuid)
returns public.team_ref
language plpgsql stable security definer set search_path = public
as $$
declare v_ref public.team_ref;
begin
  if coalesce(app_role()::text, '') not in ('guard', 'admin') then raise exception 'forbidden'; end if;
  select t.id, t.name, t.cash into v_ref from teams t where t.qr_token = p_qr;
  if v_ref.team_id is null then raise exception 'team_not_found'; end if;
  return v_ref;
end $$;

create or replace function public.resolve_team_code(p_code text)
returns public.team_ref
language plpgsql stable security definer set search_path = public
as $$
declare v_ref public.team_ref;
begin
  if coalesce(app_role()::text, '') not in ('guard', 'admin') then raise exception 'forbidden'; end if;
  select t.id, t.name, t.cash into v_ref from teams t where t.short_code = upper(btrim(p_code));
  if v_ref.team_id is null then raise exception 'team_not_found'; end if;
  return v_ref;
end $$;

create or replace function public.award_payout(
  p_request_id uuid,
  p_team_id    uuid,
  p_amount     bigint,
  p_note       text default null
) returns public.payouts
language plpgsql security definer set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_post     public.posts;
  v_state    game_state;
  v_existing public.payouts;
  v_row      public.payouts;
begin
  if app_role() is distinct from 'guard' then raise exception 'forbidden'; end if;

  select * into v_post from posts where guard_id = v_uid;
  if not found then raise exception 'forbidden'; end if;

  -- kunci tim tujuan: menserialkan hadiah dengan transaksi dan dengan penutupan game
  perform 1 from teams where id = p_team_id for update;
  if not found then raise exception 'team_not_found'; end if;

  -- idempotensi: kirim ulang dari antrean offline mengembalikan hasil lama
  select * into v_existing from payouts where request_id = p_request_id;
  if found then
    if v_existing.guard_id = v_uid and v_existing.team_id = p_team_id
       and v_existing.amount = p_amount then
      return v_existing;
    end if;
    raise exception 'request_id_conflict';
  end if;

  select state into v_state from game_settings;
  if v_state not in ('open', 'paused') then raise exception 'game_not_active'; end if;
  if not v_post.is_open then raise exception 'post_closed'; end if;

  -- satu-satunya pemeriksaan nominal: bilangan bulat positif (tanpa batas atas, diputuskan)
  if p_amount is null or p_amount < 1 then raise exception 'invalid_amount'; end if;

  insert into payouts (request_id, post_id, team_id, guard_id, amount, note)
  values (p_request_id, v_post.id, p_team_id, v_uid, p_amount, p_note)
  on conflict (request_id) do nothing
  returning * into v_row;
  if not found then raise exception 'request_id_conflict'; end if;

  update teams set cash = cash + p_amount where id = p_team_id;

  insert into audit_log (actor_id, action, payload)
  values (v_uid, 'payout_awarded',
          jsonb_build_object('payout_id', v_row.id, 'team_id', p_team_id,
                             'post_id', v_post.id, 'amount', p_amount));
  return v_row;
end $$;

create or replace function public.get_post_payouts(p_limit int default 50)
returns setof public.post_payout_row
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'guard' then raise exception 'forbidden'; end if;
  return query
    select pr.id, t.name, pr.amount, pr.created_at
      from payouts pr
      join teams t on t.id = pr.team_id
      join posts p on p.id = pr.post_id
     where p.guard_id = auth.uid()
     order by pr.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

create or replace function public.guard_set_post_open(p_open boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_post  public.posts;
  v_state game_state;
begin
  if app_role() is distinct from 'guard' then raise exception 'forbidden'; end if;
  if p_open is null then raise exception 'invalid_argument'; end if;

  -- kunci baris pos sendiri; satu penjaga hanya bisa mengubah posnya
  select * into v_post from posts where guard_id = v_uid for update;
  if not found then raise exception 'forbidden'; end if;

  select state into v_state from game_settings;
  if v_state = 'finished' then raise exception 'game_not_active'; end if;

  if v_post.is_open is distinct from p_open then
    update posts set is_open = p_open where id = v_post.id;
    insert into audit_log (actor_id, action, payload)
    values (v_uid, 'guard_set_post_open',
            jsonb_build_object('post_id', v_post.id, 'is_open', p_open));
  end if;
  return p_open;
end $$;

create or replace function public.get_post_list()
returns table (id uuid, name text, location text, is_open boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is null then raise exception 'forbidden'; end if;
  return query select p.id, p.name, p.location, p.is_open from posts p order by p.name;
end $$;

create or replace function public.freeze_leaderboard_internal()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from leaderboard_snapshot where true;
  insert into leaderboard_snapshot (team_id, rank, cash, holdings_value, net_worth)
  select v.team_id,
         (rank() over (order by v.net_worth desc, v.cash desc))::int,
         v.cash, v.holdings_value, v.net_worth
    from v_team_net_worth v;
  update game_settings set leaderboard_frozen_at = now(), updated_at = now();
end $$;

create or replace function public.admin_set_game_state(
  p_state game_state
) returns game_state
language plpgsql security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_cur     game_state;
  v_news    int;
  v_paused  timestamptz;
  v_shift   interval;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.ob_lock();                          -- urutan kunci: ob_lock lebih dulu (lihat 3.1)

  -- menutup game: kunci SEMUA tim (urut id) agar tidak ada transaksi nyelip
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
    -- berita yang sudah tayang tapi harganya belum berubah: tidak boleh dibatalkan siapa pun, tunggu sampai berlaku
    select count(*) into v_news from news where status = 'live';
    if v_news > 0 then
      raise exception 'news_pending';
    end if;
    perform public.ob_cancel_all();                  -- pasar ditutup: semua order antre dibatalkan, kunci dikembalikan
    perform set_config('classmeet.system', 'off', true);
    perform public.freeze_leaderboard_internal();
  end if;

  -- jeda: timer efek dan jeda berita ikut berhenti. Saat dilanjutkan, semua tenggat digeser
  -- sebesar lamanya jeda, sehingga sisa waktu tidak berubah.
  if p_state = 'open' and v_cur = 'paused' and v_paused is not null then
    v_shift := now() - v_paused;
    perform set_config('classmeet.system', 'on', true);                 -- pergeseran waktu oleh sistem, bukan pengaturan panitia
    update news set effect_at = effect_at + v_shift where status = 'live';
    perform set_config('classmeet.system', 'off', true);
    update game_settings set news_next_allowed_at = news_next_allowed_at + v_shift
     where news_next_allowed_at is not null;
  end if;

  update game_settings
     set state = p_state,
         paused_at = case when p_state = 'paused' then now() else null end,
         started_at = case when v_cur = 'setup' and p_state = 'open' then now() else started_at end,  -- terkunci sejak pembukaan pertama
         updated_at = now();

  insert into audit_log (actor_id, action, payload)
  values (v_uid, 'set_state', jsonb_build_object('from', v_cur, 'to', p_state));

  -- pasar dibuka / dilanjutkan: siklus langsung berjalan (memilih berita dari kumpulan bila jeda sudah lewat)
  if p_state = 'open' then
    perform public.process_news_cycle();
    perform public.process_house_quotes();           -- bandar memasang kuotasi saat pasar dibuka / dilanjutkan
  end if;
  return p_state;
end $$;

create or replace function public.admin_freeze_leaderboard() returns void
language plpgsql security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.freeze_leaderboard_internal();
  insert into audit_log (actor_id, action, payload) values (auth.uid(), 'freeze_leaderboard', '{}'::jsonb);
end $$;

create or replace function public.admin_unfreeze_leaderboard() returns void
language plpgsql security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  delete from leaderboard_snapshot where true;
  update game_settings set leaderboard_frozen_at = null, updated_at = now();
  insert into audit_log (actor_id, action, payload) values (auth.uid(), 'unfreeze_leaderboard', '{}'::jsonb);
end $$;

create or replace function public.admin_set_leaderboard_visible(p_visible boolean) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_visible is null then raise exception 'invalid_input'; end if;
  update game_settings set leaderboard_visible = p_visible, updated_at = now();
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'leaderboard_visible', jsonb_build_object('visible', p_visible));
end $$;

create or replace function public.get_leaderboard()
returns setof public.leaderboard_row
language plpgsql security definer set search_path = public
as $$
declare
  v_role    app_role := app_role();
  v_visible boolean;
  v_frozen  timestamptz;
begin
  -- Leaderboard tampil di ruang publik. Akun tim dan penjaga TIDAK boleh memanggilnya.
  if v_role is null or v_role not in ('admin', 'display') then raise exception 'forbidden'; end if;

  select leaderboard_visible, leaderboard_frozen_at into v_visible, v_frozen from game_settings;

  if v_role = 'display' and not v_visible then raise exception 'leaderboard_hidden'; end if;

  if v_role = 'display' and v_frozen is not null then
    return query
      select s.rank, s.team_id, t.name, s.cash, s.holdings_value, s.net_worth
        from leaderboard_snapshot s join teams t on t.id = s.team_id
       order by s.rank, t.name;
    return;
  end if;

  return query
    select (rank() over (order by v.net_worth desc, v.cash desc))::int,
           v.team_id, v.name, v.cash, v.holdings_value, v.net_worth
      from v_team_net_worth v
     order by 1, v.name;
end $$;

create or replace function public.get_my_summary()
returns public.my_summary
language plpgsql stable security definer set search_path = public
as $$
declare v_row public.my_summary;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  select v.avail_cash, v.holdings_value, v.net_worth, v.locked_cash into v_row
    from v_team_net_worth v where v.team_id = auth.uid();
  return v_row;
end $$;

create or replace function public.check_news_effects(p_news_id uuid)
returns void
language plpgsql stable security definer set search_path = public
as $$
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
  if v_active <> v_n then raise exception 'news_invalid_effects'; end if;   -- ada aset nonaktif
  if v_bad > 0 then raise exception 'news_invalid_effects'; end if;         -- nol atau melebihi batas
end $$;

create or replace function public.admin_save_news(
  p_news_id uuid,            -- null = berita baru
  p_title   text,
  p_body    text,
  p_effects jsonb            -- [{"asset_id": "...", "pct_bps": 500}, ...]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id     uuid;
  v_status news_status;
  e        jsonb;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;   -- kumpulan terkunci sejak pembukaan pertama
  if p_title is null or btrim(p_title) = '' or p_body is null or btrim(p_body) = ''
     or p_effects is null or jsonb_typeof(p_effects) <> 'array' then
    raise exception 'invalid_input';
  end if;

  if p_news_id is null then
    insert into news (title, body, created_by)
    values (btrim(p_title), btrim(p_body), auth.uid())
    returning id into v_id;
  else
    select id, status into v_id, v_status from news where id = p_news_id for update;
    if not found then raise exception 'news_not_found'; end if;
    if v_status <> 'draft' then raise exception 'news_wrong_status'; end if;   -- antre/tayang tidak boleh diubah
    update news set title = btrim(p_title), body = btrim(p_body) where id = v_id;
    delete from news_effects where news_id = v_id;
  end if;

  for e in select * from jsonb_array_elements(p_effects) loop
    if (e->>'asset_id') is null or (e->>'pct_bps') is null then raise exception 'invalid_input'; end if;
    if exists (select 1 from news_effects where news_id = v_id and asset_id = (e->>'asset_id')::uuid) then
      raise exception 'news_invalid_effects';                                 -- aset ganda
    end if;
    insert into news_effects (news_id, asset_id, pct_bps)
    values (v_id, (e->>'asset_id')::uuid, (e->>'pct_bps')::int);
  end loop;

  perform public.check_news_effects(v_id);       -- gagal = seluruh penyimpanan dibatalkan
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'save_news', jsonb_build_object('news_id', v_id));
  return v_id;
end $$;


create or replace function public.admin_set_news_ready(p_news_id uuid, p_ready boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_state  game_state;
  v_status news_status;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_ready is null then raise exception 'invalid_input'; end if;
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;

  select state into v_state from game_settings for update;          -- game_settings dulu, lalu news
  if v_state = 'finished' then raise exception 'game_finished'; end if;

  select status into v_status from news where id = p_news_id for update;
  if not found then raise exception 'news_not_found'; end if;

  if p_ready then
    if v_status <> 'draft' then raise exception 'news_wrong_status'; end if;
    perform public.check_news_effects(p_news_id);                   -- valid sekarang, diperiksa lagi saat terbit
    update news set status = 'ready' where id = p_news_id;
  else
    if v_status <> 'ready' then raise exception 'news_wrong_status'; end if;
    update news set status = 'draft' where id = p_news_id;
  end if;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'set_news_ready', jsonb_build_object('news_id', p_news_id, 'ready', p_ready));
end $$;

-- Internal: apakah menerapkan berita ini sekarang membuat harga aset aktif mana pun menabrak batas?
create or replace function public.news_would_hit_bounds(p_news_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from news_effects e
      join assets a on a.id = e.asset_id
      join game_settings g on true
     where e.news_id = p_news_id and a.is_active
       and (((a.price * (10000 + e.pct_bps)) / 10000 + g.price_step / 2) / g.price_step) * g.price_step
           not between a.min_price and a.max_price
  );
$$;

create or replace function public.get_news_pool_status()
returns table (draft_count int, ready_count int, eligible_count int, live_count int, applied_count int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query select
    (select count(*)::int from news where status = 'draft'),
    (select count(*)::int from news where status = 'ready'),
    (select count(*)::int from news where status = 'ready' and not public.news_would_hit_bounds(id)),
    (select count(*)::int from news where status = 'live'),
    (select count(*)::int from news where status = 'applied');
end $$;

create or replace function public.process_news_cycle()
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_state   game_state;
  v_dmin    int;
  v_dmax    int;
  v_gap     int;
  v_allowed timestamptz;
  v_step    int;
  v_live    public.news;
  v_pick    public.news;
  r         record;
  v_new     bigint;
  v_found   boolean;
  v_secs    int;
  v_result  text := 'idle';
begin
  perform public.ob_lock();                         -- urutan kunci: ob_lock lebih dulu (lihat 3.1)
  select state, news_delay_min_minutes, news_delay_max_minutes, news_gap_minutes, news_next_allowed_at, price_step
    into v_state, v_dmin, v_dmax, v_gap, v_allowed, v_step
    from game_settings for update;                  -- serialisasi: dua pemanggil tidak menerapkan dua kali
  if v_state <> 'open' then return 'idle'; end if;  -- jeda dan selesai membekukan siklus

  perform set_config('classmeet.system', 'on', true);   -- hanya fungsi ini yang boleh mengubah harga dan berita sesudah game dibuka

  -- 1) terapkan efek berita yang waktunya sudah tiba
  select * into v_live from news where status = 'live' for update;
  if found and v_live.effect_at <= now() then
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
        update assets set last_price = price, rank_price = price where id = r.asset_id;   -- harga tampil dan peringkat menyusul acuan baru
        insert into price_history (asset_id, price, news_id, reason)
        values (r.asset_id, v_new, v_live.id, 'berita');
      end if;
    end loop;

    update news set status = 'applied', effect_applied_at = now() where id = v_live.id;
    v_allowed := now() + make_interval(mins => v_gap);
    update game_settings set news_next_allowed_at = v_allowed, updated_at = now();
    v_result := 'applied';
    v_live := null;
  elsif found then
    perform set_config('classmeet.system', 'off', true);
    return 'waiting';                               -- efek belum jatuh tempo
  end if;

  -- 2) pilih berita acak dari kumpulan `ready` bila jeda antar-berita sudah habis.
  --    Calon yang aman bagi batas harga didahulukan; bila tidak ada, pilih acak dari semua yang `ready`
  --    (harga dijepit di batas) agar pasar tidak macet, karena panitia tidak bisa memperbaiki harga.
  if v_allowed is null or now() >= v_allowed then
    select * into v_pick from news
     where status = 'ready' and not public.news_would_hit_bounds(id)
     order by random() limit 1 for update;
    if not found then
      select * into v_pick from news where status = 'ready' order by random() limit 1 for update;
    end if;
    if found then
      begin
        perform public.check_news_effects(v_pick.id);
        -- jeda acak dalam DETIK: min..(maks - 10 dtk), karena penjadwal berjalan tiap 10 dtk
        v_secs := v_dmin * 60 + floor(random() * (greatest(v_dmax * 60 - 10, v_dmin * 60) - v_dmin * 60 + 1))::int;
        update news
           set status = 'live', published_at = now(),
               effect_at = now() + make_interval(secs => v_secs)
         where id = v_pick.id;
        insert into news_feed (news_id, title, body, published_at)
        select id, title, body, published_at from news where id = v_pick.id;
        v_result := case when v_result = 'applied' then 'applied+launched' else 'launched' end;
      exception when others then
        -- aturan tidak lagi terpenuhi: kembalikan ke draf dan catat; jangan macet
        update news set status = 'draft' where id = v_pick.id;
        insert into audit_log (action, payload)
        values ('news_launch_failed', jsonb_build_object('news_id', v_pick.id));
      end;
    end if;
  end if;
  if v_result like 'applied%' then
    perform public.process_house_quotes();          -- bandar memusatkan kuotasi ke acuan baru
  end if;
  perform set_config('classmeet.system', 'off', true);
  return v_result;
end $$;

create or replace function public.admin_adjust_cash(
  p_team_id uuid,
  p_delta   bigint,
  p_reason  text
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_before bigint;
  v_after  bigint;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_delta is null or p_delta = 0 or p_reason is null or btrim(p_reason) = '' then
    raise exception 'invalid_input';
  end if;

  select cash into v_before from teams where id = p_team_id for update;
  if not found then raise exception 'team_not_found'; end if;
  if v_before + p_delta < 0 then raise exception 'insufficient_cash'; end if;

  update teams set cash = cash + p_delta where id = p_team_id returning cash into v_after;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'adjust_cash',
          jsonb_build_object('team_id', p_team_id, 'delta', p_delta,
                             'before', v_before, 'after', v_after, 'reason', p_reason));
  return v_after;
end $$;

create or replace function public.admin_rotate_team_qr(p_team_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_new uuid;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  update teams set qr_token = gen_random_uuid() where id = p_team_id returning qr_token into v_new;
  if not found then raise exception 'team_not_found'; end if;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'rotate_qr', jsonb_build_object('team_id', p_team_id));
  return v_new;
end $$;

create or replace function public.log_kiosk_event(p_event text, p_device text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  if p_event is null or p_event not in ('login', 'logout', 'idle_logout')
     or length(coalesce(p_device, '')) > 40 then
    raise exception 'invalid_input';
  end if;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'kiosk_' || p_event, jsonb_build_object('device', p_device));
end $$;

alter default privileges in schema public revoke execute on functions from public;

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;

-- Fungsi internal: hanya pemilik (postgres) dan pg_cron
revoke execute on function public.process_news_cycle()          from authenticated;
revoke execute on function public.check_news_effects(uuid)      from authenticated;
revoke execute on function public.news_would_hit_bounds(uuid)   from authenticated;
revoke execute on function public.freeze_leaderboard_internal() from authenticated;
revoke execute on function public.ob_lock()                     from authenticated;
revoke execute on function public.ob_match(bigint)              from authenticated;
revoke execute on function public.ob_cancel(bigint)             from authenticated;
revoke execute on function public.ob_cancel_all()               from authenticated;
revoke execute on function public.process_house_quotes(uuid)    from authenticated;
revoke execute on function public.process_market_cycle()        from authenticated;
