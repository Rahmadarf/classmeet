-- Analisa Pasar (pay to win), tahap 1: SQL. Aman dijalankan ulang. Jalankan SEBELUM game-reset.sql (reset memakai tabel ini).
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 < scripts/sql/analysis.sql
--
-- Tim membeli laporan analisa (4 paragraf) untuk berita yang SEDANG TAYANG (efek harganya belum berlaku). Laporan dibuat
-- bersama berita (tahap 2) dan disimpan di `news_analysis` (hanya admin sebelum game dibuka, sama seperti `news`). Saat dibeli,
-- salinannya disimpan di `analysis_purchases` (hanya terbaca oleh tim pembeli) dan saldo dipotong.
--   * Satu tim hanya membeli SEKALI per berita; membeli lagi mengembalikan laporan yang sama tanpa memotong saldo.
--   * Harga dan saklar di `game_settings` (analysis_price, analysis_enabled); admin boleh mengubah KAPAN SAJA
--     (kolom ini sengaja tidak masuk penjaga `game_settings_news_lock`).
--   * Admin TIDAK boleh membaca isi laporan (isinya membocorkan efek berita); hanya log pembelian tanpa isi.
-- Galat: forbidden, invalid_input, team_not_found, request_id_conflict, market_closed, feature_disabled, no_live_news,
--        window_closed (sisa waktu efek < 30 dtk), analysis_unavailable, insufficient_cash.
select set_config('classmeet.system', 'on', false);

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Pengaturan
-- ---------------------------------------------------------------------------------------------------------------------
alter table public.game_settings
  add column if not exists analysis_price   bigint  not null default 200000,
  add column if not exists analysis_enabled boolean not null default true;
alter table public.game_settings drop constraint if exists game_settings_analysis_price_check;
alter table public.game_settings add constraint game_settings_analysis_price_check
  check (analysis_price >= 0 and analysis_price <= 100000000);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Laporan per berita (dimuat bersama kumpulan berita)
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.news_analysis (
  news_id    uuid primary key references public.news (id) on delete cascade,
  paragraphs text[] not null check (cardinality(paragraphs) = 4),
  created_at timestamptz not null default now()
);
alter table public.news_analysis enable row level security;
drop policy if exists news_analysis_read on public.news_analysis;
create policy news_analysis_read on public.news_analysis for select to authenticated
  using (app_role() = 'admin' and not game_is_locked());
revoke all on public.news_analysis from anon, authenticated;
grant select on public.news_analysis to authenticated;
grant all on public.news_analysis to service_role;
drop trigger if exists news_analysis_lock on public.news_analysis;
create trigger news_analysis_lock before insert or update or delete on public.news_analysis
  for each statement execute function public.guard_game_lock();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Pembelian
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.analysis_purchases (
  id          bigint generated always as identity primary key,
  request_id  uuid not null unique,
  team_id     uuid not null references public.teams (id),
  news_id     uuid not null references public.news (id) on delete cascade,
  news_title  text not null,
  price       bigint not null check (price >= 0),
  paragraphs  text[] not null check (cardinality(paragraphs) = 4),
  created_at  timestamptz not null default now(),
  unique (team_id, news_id)
);
create index if not exists analysis_purchases_team_idx on public.analysis_purchases (team_id, created_at desc);
alter table public.analysis_purchases enable row level security;
drop policy if exists analysis_purchases_read on public.analysis_purchases;
create policy analysis_purchases_read on public.analysis_purchases for select to authenticated
  using (team_id = auth.uid());                                   -- admin sengaja tidak termasuk (lihat admin_analysis_log)
revoke all on public.analysis_purchases from anon, authenticated;
grant select on public.analysis_purchases to authenticated;
grant all on public.analysis_purchases to service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Tawaran (untuk tombol di Pasar): tanpa membocorkan waktu efek
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.get_analysis_offer()
returns table (price bigint, can_buy boolean, reason text, owned boolean, news_title text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  g public.game_settings;
  n public.news;
  v_owned boolean := false;
  v_reason text := 'ok';
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  select * into g from game_settings;
  select * into n from news where status = 'live';
  if g.state <> 'open' then v_reason := 'market_closed';
  elsif not g.analysis_enabled then v_reason := 'feature_disabled';
  elsif n.id is null then v_reason := 'no_live_news';
  else
    v_owned := exists (select 1 from analysis_purchases p where p.team_id = v_uid and p.news_id = n.id);
    if not v_owned then
      if n.effect_at is null or n.effect_at <= public.cm_now() + interval '30 seconds' then v_reason := 'window_closed';
      elsif not exists (select 1 from news_analysis a where a.news_id = n.id) then v_reason := 'analysis_unavailable';
      end if;
    end if;
  end if;
  return query select g.analysis_price, (v_reason = 'ok'), v_reason, v_owned, n.title;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Beli
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.buy_analysis(p_request_id uuid)
returns public.analysis_purchases
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  g      public.game_settings;
  n      public.news;
  an     public.news_analysis;
  v_ex   public.analysis_purchases;
  v_row  public.analysis_purchases;
  v_min  int;
  v_wait text;
  v_par  text[];
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  if p_request_id is null then raise exception 'invalid_input'; end if;

  perform public.ob_lock();                                       -- satu kunci pasar, serial dengan beli/jual
  perform 1 from teams where id = v_uid for update;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_ex from analysis_purchases where request_id = p_request_id;
  if found then
    if v_ex.team_id = v_uid then return v_ex; end if;             -- pengiriman ulang: hasil yang sama
    raise exception 'request_id_conflict';
  end if;

  select * into g from game_settings;
  if g.state <> 'open' then raise exception 'market_closed'; end if;
  if not g.analysis_enabled then raise exception 'feature_disabled'; end if;
  select * into n from news where status = 'live';
  if n.id is null then raise exception 'no_live_news'; end if;

  select * into v_ex from analysis_purchases where team_id = v_uid and news_id = n.id;
  if found then return v_ex; end if;                              -- sudah dibeli untuk berita ini: tanpa biaya

  if n.effect_at is null or n.effect_at <= public.cm_now() + interval '30 seconds' then raise exception 'window_closed'; end if;
  select * into an from news_analysis where news_id = n.id;
  if not found then raise exception 'analysis_unavailable'; end if;

  update teams set cash = cash - g.analysis_price where id = v_uid and cash >= g.analysis_price;
  if not found then raise exception 'insufficient_cash'; end if;

  -- perkiraan sisa waktu: rentang selebar 2 menit yang pasti memuat sisa waktu sebenarnya
  v_min := floor(extract(epoch from (n.effect_at - public.cm_now())) / 60)::int;
  v_wait := case when v_min < 1 then 'kurang dari 2 menit' else format('sekitar %s sampai %s menit', v_min, v_min + 2) end;
  v_par := array(select replace(p, '{waktu}', v_wait) from unnest(an.paragraphs) with ordinality as t(p, i) order by i);

  insert into analysis_purchases (request_id, team_id, news_id, news_title, price, paragraphs)
  values (p_request_id, v_uid, n.id, n.title, g.analysis_price, v_par)
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Laporan yang sudah dibeli tim
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.get_my_analyses(p_limit int default 20)
returns setof public.analysis_purchases
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  return query select * from analysis_purchases where team_id = auth.uid()
                order by created_at desc, id desc limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Admin: pengaturan dan log (tanpa isi laporan)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.admin_set_analysis_settings(p_price bigint, p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_price is null or p_enabled is null or p_price < 0 or p_price > 100000000 then raise exception 'invalid_input'; end if;
  update game_settings set analysis_price = p_price, analysis_enabled = p_enabled, updated_at = now() where true;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'set_analysis_settings', jsonb_build_object('price', p_price, 'enabled', p_enabled));
end $$;

create or replace function public.admin_analysis_log(p_limit int default 100)
returns table (id bigint, created_at timestamptz, team_id uuid, team_name text, news_title text, price bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query
    select p.id, p.created_at, p.team_id, t.name, p.news_title, p.price
      from analysis_purchases p join teams t on t.id = p.team_id
     order by p.id desc limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

create or replace function public.admin_analysis_summary()
returns table (purchases bigint, buyers bigint, revenue bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query select count(*), count(distinct p.team_id), coalesce(sum(p.price), 0)::bigint from analysis_purchases p;
end $$;

revoke all on function public.get_analysis_offer(), public.buy_analysis(uuid), public.get_my_analyses(int),
  public.admin_set_analysis_settings(bigint, boolean), public.admin_analysis_log(int), public.admin_analysis_summary()
  from public, anon;
grant execute on function public.get_analysis_offer(), public.buy_analysis(uuid), public.get_my_analyses(int),
  public.admin_set_analysis_settings(bigint, boolean), public.admin_analysis_log(int), public.admin_analysis_summary()
  to authenticated;
notify pgrst, 'reload schema';

select set_config('classmeet.system', 'off', false);
