-- Fungsi admin yang baru berupa spesifikasi di docs/04 §3.9 dan belum ada di database:
--   admin_set_stock, admin_set_post_open, admin_upsert_asset, admin_upsert_post, admin_set_news_settings.
-- Dengan ini halaman admin Aset, Pos, dan Berita (persiapan) bisa diberi tombol ubah/tambah/buka-tutup.
--
-- KONVENSI (sama dengan fungsi yang sudah ada, docs/04 §1):
--   * `security definer`, `set search_path = public`, peran dicek di awal dengan app_role() (hanya admin).
--   * Urutan kunci: ob_lock() lebih dulu bila menyentuh stok/aset (stok juga diubah ob_match).
--   * Setiap UPDATE punya WHERE (Supabase hosted menolak UPDATE tanpa WHERE: lihat fix-safeupdate-game-settings.sql).
--   * Setiap perubahan ditulis ke audit_log (nama aksi: set_stock, set_post_open, upsert_asset, upsert_post, set_news_settings).
--   * Hak EXECUTE: dicabut dari PUBLIC/anon, diberikan ke authenticated (docs/04 §6).
--   * Penguncian game tetap berlaku: harga, rentang, status aktif, tambah/hapus aset, dan pengaturan berita hanya
--     SEBELUM game dibuka (trigger guard_game_lock; di sini dicek lebih dulu supaya galatnya jelas: `game_started_locked`).
--
-- Jalankan sebagai pemilik di SQL Editor Supabase. Aman dijalankan berulang (create or replace).
-- Catatan stok: `admin_set_stock` mengubah persediaan BANDAR (`assets.stock`) tanpa mengubah `init_stock`, sehingga
-- invarian "stok + Σ holdings = stok awal" tidak lagi berlaku untuk aset itu (disengaja: koreksi stok oleh panitia).

-- ---------- 1. stok bandar (boleh kapan saja, termasuk sesudah game dibuka) ----------
create or replace function public.admin_set_stock(p_asset_id uuid, p_stock int, p_reason text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_before int;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_asset_id is null or p_stock is null or p_stock < 0 or p_reason is null or btrim(p_reason) = '' then
    raise exception 'invalid_input';
  end if;

  perform public.ob_lock();                          -- stok juga diubah ob_match: serialkan dengan order book
  select stock into v_before from assets where id = p_asset_id for update;
  if not found then raise exception 'asset_not_found'; end if;

  if v_before is distinct from p_stock then
    update assets set stock = p_stock where id = p_asset_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'set_stock',
            jsonb_build_object('asset_id', p_asset_id, 'before', v_before, 'after', p_stock, 'reason', btrim(p_reason)));
  end if;
  return p_stock;
end $$;

-- ---------- 2. buka/tutup pos oleh admin ----------
create or replace function public.admin_set_post_open(p_post_id uuid, p_open boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_before boolean;
  v_state  game_state;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_post_id is null or p_open is null then raise exception 'invalid_input'; end if;

  select state into v_state from game_settings;
  if v_state = 'finished' then raise exception 'game_not_active'; end if;   -- sama dengan guard_set_post_open

  select is_open into v_before from posts where id = p_post_id for update;
  if not found then raise exception 'post_not_found'; end if;

  if v_before is distinct from p_open then
    update posts set is_open = p_open where id = p_post_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'set_post_open', jsonb_build_object('post_id', p_post_id, 'is_open', p_open, 'by', 'admin'));
  end if;
  return p_open;
end $$;

-- ---------- 3. tambah/ubah aset (HANYA sebelum game dibuka) ----------
-- p_asset_id null → tambah aset baru; terisi → ubah aset itu. Harga acuan harus di dalam rentang [min, maks].
create or replace function public.admin_upsert_asset(
  p_asset_id  uuid,
  p_symbol    text,
  p_name      text,
  p_sector    text,
  p_price     bigint,
  p_min_price bigint,
  p_max_price bigint,
  p_stock     int,
  p_is_active boolean
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id     uuid;
  v_before jsonb;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;

  if p_symbol is null or p_symbol !~ '^[A-Z0-9]{2,8}$'
     or p_name is null or btrim(p_name) = '' or p_sector is null or btrim(p_sector) = ''
     or p_price is null or p_min_price is null or p_max_price is null or p_stock is null or p_is_active is null
     or p_min_price <= 0 or p_max_price < p_min_price
     or p_price < p_min_price or p_price > p_max_price
     or p_stock < 0 then
    raise exception 'invalid_input';
  end if;

  perform public.ob_lock();

  if p_asset_id is null then
    if exists (select 1 from assets where symbol = p_symbol) then raise exception 'symbol_taken'; end if;
    insert into assets (symbol, name, sector, price, min_price, max_price, stock, is_active)
    values (p_symbol, btrim(p_name), btrim(p_sector), p_price, p_min_price, p_max_price, p_stock, p_is_active)
    returning id into v_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'upsert_asset',
            jsonb_build_object('asset_id', v_id, 'created', true, 'symbol', p_symbol, 'price', p_price,
                               'min_price', p_min_price, 'max_price', p_max_price, 'stock', p_stock, 'is_active', p_is_active));
  else
    select to_jsonb(a) into v_before from assets a where a.id = p_asset_id for update;
    if v_before is null then raise exception 'asset_not_found'; end if;
    if exists (select 1 from assets where symbol = p_symbol and id <> p_asset_id) then raise exception 'symbol_taken'; end if;
    update assets
       set symbol = p_symbol, name = btrim(p_name), sector = btrim(p_sector), price = p_price,
           min_price = p_min_price, max_price = p_max_price, stock = p_stock, is_active = p_is_active
     where id = p_asset_id;
    v_id := p_asset_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'upsert_asset',
            jsonb_build_object('asset_id', v_id, 'created', false, 'symbol', p_symbol,
                               'before', jsonb_build_object('price', v_before -> 'price', 'min_price', v_before -> 'min_price',
                                                            'max_price', v_before -> 'max_price', 'stock', v_before -> 'stock',
                                                            'is_active', v_before -> 'is_active'),
                               'after', jsonb_build_object('price', p_price, 'min_price', p_min_price, 'max_price', p_max_price,
                                                           'stock', p_stock, 'is_active', p_is_active)));
  end if;
  return v_id;
end $$;

-- ---------- 4. tambah/ubah pos (boleh kapan saja; pos baru selalu mulai Tidak tersedia) ----------
-- Satu penjaga memegang satu pos (posts.guard_id unik); penjaga harus berperan `guard`.
create or replace function public.admin_upsert_post(p_post_id uuid, p_name text, p_location text, p_guard_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_name is null or btrim(p_name) = '' or p_location is null or btrim(p_location) = '' or p_guard_id is null then
    raise exception 'invalid_input';
  end if;
  perform 1 from profiles where id = p_guard_id and role = 'guard';
  if not found then raise exception 'guard_invalid'; end if;
  if exists (select 1 from posts where guard_id = p_guard_id and id is distinct from p_post_id) then
    raise exception 'guard_invalid';                -- penjaga sudah memegang pos lain
  end if;

  if p_post_id is null then
    insert into posts (name, location, guard_id, is_open)
    values (btrim(p_name), btrim(p_location), p_guard_id, false)
    returning id into v_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'upsert_post', jsonb_build_object('post_id', v_id, 'created', true, 'name', btrim(p_name), 'guard_id', p_guard_id));
  else
    perform 1 from posts where id = p_post_id for update;
    if not found then raise exception 'post_not_found'; end if;
    update posts set name = btrim(p_name), location = btrim(p_location), guard_id = p_guard_id where id = p_post_id;
    v_id := p_post_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'upsert_post', jsonb_build_object('post_id', v_id, 'created', false, 'name', btrim(p_name), 'guard_id', p_guard_id));
  end if;
  return v_id;
end $$;

-- ---------- 5. pengaturan berita (HANYA sebelum game dibuka) ----------
create or replace function public.admin_set_news_settings(
  p_delay_min       int,
  p_delay_max       int,
  p_gap             int,
  p_min_assets      int,
  p_max_assets      int,
  p_max_effect_bps  int
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;
  if p_delay_min is null or p_delay_max is null or p_gap is null or p_min_assets is null or p_max_assets is null
     or p_max_effect_bps is null
     or p_delay_min < 1 or p_delay_max < p_delay_min or p_gap < 0
     or p_min_assets < 1 or p_max_assets < p_min_assets
     or p_max_effect_bps < 100 or p_max_effect_bps > 9000 then
    raise exception 'invalid_input';
  end if;

  update game_settings
     set news_delay_min_minutes = p_delay_min,
         news_delay_max_minutes = p_delay_max,
         news_gap_minutes       = p_gap,
         min_news_assets        = p_min_assets,
         max_news_assets        = p_max_assets,
         max_effect_bps         = p_max_effect_bps,
         updated_at             = now()
   where true;                                       -- satu baris; WHERE wajib di Supabase hosted

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'set_news_settings',
          jsonb_build_object('delay_min', p_delay_min, 'delay_max', p_delay_max, 'gap', p_gap,
                             'min_assets', p_min_assets, 'max_assets', p_max_assets, 'max_effect_bps', p_max_effect_bps));
end $$;

-- ---------- hak eksekusi ----------
revoke all on function public.admin_set_stock(uuid, int, text) from public, anon;
revoke all on function public.admin_set_post_open(uuid, boolean) from public, anon;
revoke all on function public.admin_upsert_asset(uuid, text, text, text, bigint, bigint, bigint, int, boolean) from public, anon;
revoke all on function public.admin_upsert_post(uuid, text, text, uuid) from public, anon;
revoke all on function public.admin_set_news_settings(int, int, int, int, int, int) from public, anon;
grant execute on function public.admin_set_stock(uuid, int, text) to authenticated;
grant execute on function public.admin_set_post_open(uuid, boolean) to authenticated;
grant execute on function public.admin_upsert_asset(uuid, text, text, text, bigint, bigint, bigint, int, boolean) to authenticated;
grant execute on function public.admin_upsert_post(uuid, text, text, uuid) to authenticated;
grant execute on function public.admin_set_news_settings(int, int, int, int, int, int) to authenticated;

-- ---------- pemeriksaan (harus: lima baris, anon_exec = false, auth_exec = true) ----------
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('admin_set_stock', 'admin_set_post_open', 'admin_upsert_asset', 'admin_upsert_post', 'admin_set_news_settings')
 order by 1;
