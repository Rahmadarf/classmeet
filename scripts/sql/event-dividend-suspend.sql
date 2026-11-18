-- Event "dividen" dan "suspensi" (18 Nov), sejalan dengan event bangkrut (event-bankruptcy.sql, jalankan LEBIH DULU).
-- BELUM diterapkan; pengguna yang menjalankannya di SQL Editor.
--
-- APA YANG TERJADI (saat efek berita yang membawa event itu berlaku, status `applied`, dalam transaksi yang sama):
--   DIVIDEN   Tiap tim yang memegang aset itu menerima uang = unit (termasuk yang terkunci di order jual) × dividen per unit.
--             Dividen per unit = harga acuan sekarang × bps / 10000 (dibulatkan, minimal Rp 1); bps 10-1000 (0,1-10 %).
--             Uang dari panitia (jumlah uang beredar bertambah; sama seperti hadiah pos dan likuidasi bangkrut).
--             Harga TIDAK dipotong (efek harga tetap hanya dari efek berita). Tiap pembayaran dicatat di `dividends`
--             (tim membaca baris miliknya; admin semuanya) dan di `audit_log` (`asset_dividend`).
--   SUSPENSI  Aset tidak bisa diorder selama N menit (1-30): order baru tim ditolak (`asset_suspended`), bandar menarik
--             kuotasi aset itu. Membatalkan order antre TETAP boleh. Setelah waktunya habis, `process_market_cycle`
--             (cron 10 detik yang sudah ada) membuka lagi aset itu dan bandar memasang kuotasi baru (`asset_resumed`).
--             Waktu suspensi berjalan juga saat pasar dijeda (waktunya mutlak, bukan hitung mundur).
--   Satu berita boleh membawa beberapa event (mis. dividen aset A dan suspensi aset B) di samping 4-7 efek harga.
--   Satu aset tidak boleh membawa event dan bangkrut di berita yang sama.
--
-- DESAIN (supaya aman)
--   * `process_news_cycle()` TIDAK diubah: event dijalankan trigger AFTER UPDATE pada `news` (seperti event bangkrut).
--     Galat per event ditangkap (`asset_event_failed` di audit) sehingga siklus berita tidak macet; tiap event atomik.
--   * `place_order()` TIDAK diubah: penolakan order saat suspensi dilakukan trigger BEFORE INSERT pada `orders`
--     (hanya order tim; order bandar tidak dicegat karena `process_house_quotes` melewati aset yang disuspensi).
--   * Diubah (create or replace, badan lama dipertahankan + satu tambahan): `check_news_effects` (validasi event),
--     `process_house_quotes` (melewati aset yang sedang disuspensi), `process_market_cycle` (memanggil process_suspensions).
--   * Tabel/kolom baru ikut penguncian game (berita dan event hanya bisa disiapkan sebelum `started_at`).
--   * Setiap UPDATE ber-WHERE (pg_safeupdate di Supabase hosted).
--
-- Jalankan sebagai pemilik di SQL Editor Supabase. Aman dijalankan berulang.

-- ---------- 1. kolom dan tabel ----------
alter table public.assets add column if not exists suspended_until timestamptz;

create table if not exists public.news_events (
  news_id  uuid not null references public.news (id) on delete cascade,
  asset_id uuid not null references public.assets (id),
  kind     text not null check (kind in ('dividend', 'suspend')),
  amount   int  not null,
  primary key (news_id, asset_id, kind),
  check ((kind = 'dividend' and amount between 10 and 1000) or (kind = 'suspend' and amount between 1 and 30))
);

alter table public.news_events enable row level security;
drop policy if exists news_events_read on public.news_events;
create policy news_events_read on public.news_events
  for select to authenticated
  using (app_role() = 'admin' and not game_is_locked());
revoke all on public.news_events from public, anon, authenticated;
grant select on public.news_events to authenticated;

drop trigger if exists news_events_lock on public.news_events;
create trigger news_events_lock
  before insert or update or delete on public.news_events
  for each statement execute function public.guard_game_lock();

create table if not exists public.dividends (
  id       bigint generated always as identity primary key,
  news_id  uuid references public.news (id),
  asset_id uuid not null references public.assets (id),
  team_id  uuid not null references public.teams (id),
  qty      int    not null check (qty > 0),
  per_unit bigint not null check (per_unit > 0),
  amount   bigint not null check (amount > 0),
  paid_at  timestamptz not null default now()
);
create index if not exists dividends_team_paid_idx on public.dividends (team_id, paid_at desc);

alter table public.dividends enable row level security;
drop policy if exists dividends_read on public.dividends;
create policy dividends_read on public.dividends
  for select to authenticated
  using (team_id = auth.uid() or app_role() = 'admin');
revoke all on public.dividends from public, anon, authenticated;
grant select on public.dividends to authenticated;

-- ---------- 2. validasi berita: tambahkan pemeriksaan event (badan sebelumnya dipertahankan) ----------
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
  if v_active <> v_n then raise exception 'news_invalid_effects'; end if;
  if v_bad > 0 then raise exception 'news_invalid_effects'; end if;

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

-- ---------- 3. admin: pasang / lepas event pada berita draf ----------
-- p_amount null = lepas event (jenis + aset itu). Dividen: bps 10-1000. Suspensi: menit 1-30.
create or replace function public.admin_set_news_event(p_news_id uuid, p_asset_id uuid, p_kind text, p_amount int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_status news_status;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;
  if p_news_id is null or p_asset_id is null or p_kind not in ('dividend', 'suspend') then
    raise exception 'invalid_input';
  end if;

  select status into v_status from news where id = p_news_id for update;
  if not found then raise exception 'news_not_found'; end if;
  if v_status <> 'draft' then raise exception 'news_wrong_status'; end if;

  if p_amount is null then
    delete from news_events where news_id = p_news_id and asset_id = p_asset_id and kind = p_kind;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'set_news_event',
            jsonb_build_object('news_id', p_news_id, 'asset_id', p_asset_id, 'kind', p_kind, 'amount', null));
    return;
  end if;

  if (p_kind = 'dividend' and p_amount not between 10 and 1000)
     or (p_kind = 'suspend' and p_amount not between 1 and 30) then
    raise exception 'invalid_input';
  end if;
  perform 1 from assets where id = p_asset_id and is_active;
  if not found then raise exception 'asset_not_found'; end if;
  if exists (select 1 from news_bankruptcies where news_id = p_news_id and asset_id = p_asset_id) then
    raise exception 'news_invalid_effects';
  end if;

  insert into news_events (news_id, asset_id, kind, amount)
  values (p_news_id, p_asset_id, p_kind, p_amount)
  on conflict (news_id, asset_id, kind) do update set amount = excluded.amount;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'set_news_event',
          jsonb_build_object('news_id', p_news_id, 'asset_id', p_asset_id, 'kind', p_kind, 'amount', p_amount));
end $$;

-- ---------- 4. internal: bayar dividen ----------
create or replace function public.pay_dividend(p_asset_id uuid, p_bps int, p_news_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a         public.assets;
  v_prev    text := coalesce(current_setting('classmeet.system', true), '');
  v_per     bigint;
  v_pay     bigint;
  v_total   bigint := 0;
  v_holders jsonb := '[]'::jsonb;
  h         record;
begin
  perform public.ob_lock();
  perform set_config('classmeet.system', 'on', true);

  select * into a from assets where id = p_asset_id and is_active for update;
  if not found then
    perform set_config('classmeet.system', v_prev, true);
    return;
  end if;

  v_per := greatest((a.price * p_bps + 5000) / 10000, 1);

  for h in select team_id, qty from holdings where asset_id = a.id and qty > 0 order by team_id for update loop
    v_pay := h.qty * v_per;
    update teams set cash = cash + v_pay where id = h.team_id;
    insert into dividends (news_id, asset_id, team_id, qty, per_unit, amount)
    values (p_news_id, a.id, h.team_id, h.qty, v_per, v_pay);
    v_total := v_total + v_pay;
    v_holders := v_holders || jsonb_build_object('team_id', h.team_id, 'qty', h.qty, 'amount', v_pay);
  end loop;

  insert into audit_log (action, payload)
  values ('asset_dividend',
          jsonb_build_object('asset_id', a.id, 'symbol', a.symbol, 'news_id', p_news_id, 'bps', p_bps,
                             'ref_price', a.price, 'per_unit', v_per, 'total_paid', v_total, 'holders', v_holders));

  perform set_config('classmeet.system', v_prev, true);
end $$;

-- ---------- 5. internal: suspensi ----------
create or replace function public.suspend_asset(p_asset_id uuid, p_minutes int, p_news_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a       public.assets;
  v_prev  text := coalesce(current_setting('classmeet.system', true), '');
  v_until timestamptz;
  v_cancel int := 0;
  o       record;
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

  -- bandar menarik kuotasi aset ini (order antre tim tetap, dan boleh dibatalkan)
  for o in select id from orders where asset_id = a.id and is_house and status in ('open', 'partial') order by id loop
    perform public.ob_cancel(o.id);
    v_cancel := v_cancel + 1;
  end loop;

  insert into audit_log (action, payload)
  values ('asset_suspended',
          jsonb_build_object('asset_id', a.id, 'symbol', a.symbol, 'news_id', p_news_id,
                             'minutes', p_minutes, 'until', v_until, 'house_orders_cancelled', v_cancel));

  perform set_config('classmeet.system', v_prev, true);
end $$;

-- Membuka kembali aset yang waktu suspensinya habis (dipanggil process_market_cycle tiap 10 detik, hanya saat pasar buka).
create or replace function public.process_suspensions()
returns int
language plpgsql security definer set search_path = public
as $$
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
    perform public.process_house_quotes(a.id);      -- bandar memasang kuotasi baru
    v_n := v_n + 1;
  end loop;
  perform set_config('classmeet.system', v_prev, true);
  return v_n;
end $$;

-- ---------- 6. pemicu: jalankan event saat efek berita berlaku ----------
create or replace function public.trg_news_events()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare ev record;
begin
  for ev in select asset_id, kind, amount from news_events where news_id = new.id order by kind, asset_id loop
    begin
      if ev.kind = 'dividend' then
        perform public.pay_dividend(ev.asset_id, ev.amount, new.id);
      else
        perform public.suspend_asset(ev.asset_id, ev.amount, new.id);
      end if;
    exception when others then
      insert into audit_log (action, payload)
      values ('asset_event_failed',
              jsonb_build_object('news_id', new.id, 'asset_id', ev.asset_id, 'kind', ev.kind, 'error', sqlerrm));
    end;
  end loop;
  return null;
end $$;

drop trigger if exists news_events_apply on public.news;
create trigger news_events_apply
  after update of status on public.news
  for each row
  when (old.status is distinct from 'applied' and new.status = 'applied')
  execute function public.trg_news_events();

-- ---------- 7. tolak order TIM saat aset disuspensi (place_order tidak diubah) ----------
create or replace function public.trg_orders_suspended()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not new.is_house
     and exists (select 1 from assets a where a.id = new.asset_id and a.suspended_until > now()) then
    raise exception 'asset_suspended';
  end if;
  return new;
end $$;

drop trigger if exists orders_suspended_guard on public.orders;
create trigger orders_suspended_guard
  before insert on public.orders
  for each row execute function public.trg_orders_suspended();

-- ---------- 8. bandar melewati aset yang disuspensi (badan lama + satu syarat) ----------
create or replace function public.process_house_quotes(p_asset uuid default null::uuid)
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

  for a in select * from assets
            where is_active and (p_asset is null or id = p_asset)
              and (suspended_until is null or suspended_until <= now())      -- BARU: lewati aset yang disuspensi
            order by id loop
    if a.init_stock is null then
      update assets set init_stock = stock, base_price = price where id = a.id returning * into a;
    end if;

    update orders set status = 'cancelled', closed_at = now()
     where asset_id = a.id and is_house and status in ('open', 'partial');

    select lo, hi into v_lo, v_hi from public.order_band(a.id);
    v_ref := public.round_tick(a.price);
    v_lot := greatest(ceil(a.init_stock / 10.0)::int, 1);

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

    v_p := v_ref;
    for v_k in 1 .. g.house_levels loop
      v_p := v_p - public.tick_for(v_p - 1);
      exit when v_p < v_lo or v_p < 1;
      insert into orders (asset_id, side, kind, price, qty, remaining, is_house)
      values (a.id, 'buy', 'limit', v_p, v_lot, v_lot, true) returning id into v_id;
      perform public.ob_match(v_id);
    end loop;
  end loop;

  update game_settings set house_refreshed_at = now() where true;
  perform set_config('classmeet.system', 'off', true);
end $$;

-- ---------- 9. siklus pasar: buka kembali aset yang suspensinya habis (badan lama + satu panggilan) ----------
create or replace function public.process_market_cycle()
returns text
language plpgsql security definer set search_path = public
as $$
declare g public.game_settings;
begin
  perform public.ob_lock();
  select * into g from game_settings;
  if g.state <> 'open' then return 'idle'; end if;
  perform public.process_suspensions();                                       -- BARU
  if g.house_refreshed_at is null or now() >= g.house_refreshed_at + make_interval(secs => g.house_refresh_seconds) then
    perform public.process_house_quotes();
    return 'refreshed';
  end if;
  return 'idle';
end $$;

-- ---------- hak eksekusi ----------
revoke all on function public.admin_set_news_event(uuid, uuid, text, int) from public, anon;
grant execute on function public.admin_set_news_event(uuid, uuid, text, int) to authenticated;
revoke all on function public.pay_dividend(uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.suspend_asset(uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.process_suspensions() from public, anon, authenticated;
revoke all on function public.trg_news_events() from public, anon, authenticated;
revoke all on function public.trg_orders_suspended() from public, anon, authenticated;

-- ---------- pemeriksaan ----------
-- Harus: admin_set_news_event auth_exec = true, anon_exec = false; semua yang lain false.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('admin_set_news_event', 'pay_dividend', 'suspend_asset', 'process_suspensions',
                     'trg_news_events', 'trg_orders_suspended')
 order by 1;
