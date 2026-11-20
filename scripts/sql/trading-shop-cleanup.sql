-- Pembersihan setelah trading toko (docs/17 tahap 6): buang kolom order book yang sudah tidak dipakai.
-- Jalankan SESUDAH trading-shop.sql dan setelah UI baru berjalan. Aman dijalankan ulang (drop ... if exists).
--
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 < scripts/sql/trading-shop-cleanup.sql
--
-- Dibuang:
--   teams.locked_cash, holdings.locked_qty                    (tidak ada lagi order antre yang mengunci)
--   game_settings.fee_bps, sell_fee_bps, band_bps, house_levels, sweep_levels, house_refresh_seconds,
--   house_refreshed_at, house_cash, rank_window_minutes, rank_min_lots
-- Disesuaikan: v_team_net_worth (tanpa avail_cash/locked_cash), tipe my_summary dan get_my_summary (tanpa locked_cash),
--   pemicu game_settings_news_lock (daftar kolom terkunci).
select set_config('classmeet.system', 'on', false);

-- 1. Tampilan nilai tim dan ringkasan saya: tanpa kolom kunci
drop view if exists public.v_team_net_worth;
create view public.v_team_net_worth as
select t.id as team_id,
       t.name,
       t.cash,
       coalesce(sum(h.qty * coalesce(a.rank_price, a.price)), 0)::bigint as holdings_value,
       (t.cash + coalesce(sum(h.qty * coalesce(a.rank_price, a.price)), 0))::bigint as net_worth
  from public.teams t
  left join public.holdings h on h.team_id = t.id and h.qty > 0
  left join public.assets a on a.id = h.asset_id
 group by t.id, t.name, t.cash;
revoke all on public.v_team_net_worth from public, anon, authenticated;
grant all on public.v_team_net_worth to service_role;

do $ty$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.my_summary'::regclass and attname = 'locked_cash' and not attisdropped) then
    alter type public.my_summary drop attribute locked_cash;
  end if;
end $ty$;

create or replace function public.get_my_summary()
returns public.my_summary
language plpgsql stable security definer set search_path = public as $$
declare v_row public.my_summary;
begin
  if app_role() is distinct from 'team' then raise exception 'forbidden'; end if;
  select v.cash, v.holdings_value, v.net_worth into v_row
    from v_team_net_worth v where v.team_id = auth.uid();
  return v_row;
end $$;
revoke all on function public.get_my_summary() from public, anon;
grant execute on function public.get_my_summary() to authenticated, service_role;

-- 2. Kolom usang
alter table public.teams drop column if exists locked_cash;
alter table public.holdings drop column if exists locked_qty;

drop trigger if exists game_settings_news_lock on public.game_settings;
alter table public.game_settings
  drop column if exists fee_bps,
  drop column if exists sell_fee_bps,
  drop column if exists band_bps,
  drop column if exists house_levels,
  drop column if exists sweep_levels,
  drop column if exists house_refresh_seconds,
  drop column if exists house_refreshed_at,
  drop column if exists house_cash,
  drop column if exists rank_window_minutes,
  drop column if exists rank_min_lots;

create trigger game_settings_news_lock before update on public.game_settings
  for each row when (
       old.price_step is distinct from new.price_step
    or old.max_effect_bps is distinct from new.max_effect_bps
    or old.min_news_assets is distinct from new.min_news_assets
    or old.max_news_assets is distinct from new.max_news_assets
    or old.news_delay_min_minutes is distinct from new.news_delay_min_minutes
    or old.news_delay_max_minutes is distinct from new.news_delay_max_minutes
    or old.news_gap_minutes is distinct from new.news_gap_minutes
    or old.sell_spread_bps is distinct from new.sell_spread_bps
    or old.pressure_bps_per_unit is distinct from new.pressure_bps_per_unit
    or old.pressure_cap_bps is distinct from new.pressure_cap_bps
    or old.pressure_decay_minutes is distinct from new.pressure_decay_minutes
    or old.hold_cap_pct is distinct from new.hold_cap_pct
    or old.stock_mid_pct is distinct from new.stock_mid_pct
    or old.stock_low_pct is distinct from new.stock_low_pct)
  execute function public.guard_game_lock();

select set_config('classmeet.system', 'off', false);
notify pgrst, 'reload schema';
