-- Satu panggilan untuk seluruh data papan Pasar tim (menggantikan 7 panggilan tiap 5 detik).
-- Aman dijalankan ulang.  docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/market-snapshot.sql
-- Syarat: database sudah memuat trading-shop.sql, market-day-open.sql, bankrupt-notice.sql, dan analysis.sql.
--
-- Isinya hanya MENGGABUNGKAN fungsi dan tabel yang sudah ada (tanpa menyalin logikanya), dalam bentuk yang sama dengan
-- yang dibaca aplikasi sekarang, sehingga `mergeMarket` dan pemeta lain di lib/market tidak berubah:
--   game      = game_settings (8 kolom yang dibaca fetchGame)
--   assets    = aset aktif (kolom yang dibaca fetchMarket)
--   summary   = get_market_summary()
--   day_open  = get_day_open_prices()
--   bankrupt  = get_bankrupt_notices()
--   holdings  = kepemilikan TIM PEMANGGIL (qty > 0)
--   analysis  = get_analysis_offer() (satu baris, atau null)
--
-- SECURITY INVOKER (bukan definer): `holdings` harus lewat RLS dan filter `team_id = auth.uid()`. Fungsi lama yang
-- security definer tetap berjalan dari dalam dan memeriksa `app_role()` sendiri; `get_analysis_offer()` menolak selain
-- peran `team`, jadi fungsi ini hanya untuk akun tim (display dan admin memakai jalur mereka sendiri).
-- Satu pernyataan = satu snapshot database: harga, stok, dan kepemilikan berasal dari instan yang sama.
create or replace function public.get_market_snapshot()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'game', (select to_jsonb(g)
               from (select state, sell_spread_bps, hold_cap_pct, stock_mid_pct, stock_low_pct,
                            price_step, pressure_bps_per_unit, pressure_cap_bps
                       from game_settings limit 1) g),
    'assets', coalesce((select jsonb_agg(to_jsonb(a) order by a.symbol)
                          from (select id, symbol, name, sector, price, last_price, min_price, max_price,
                                       suspended_until, stock, init_stock, price_factor_bps
                                  from assets where is_active) a), '[]'::jsonb),
    'summary', coalesce((select jsonb_agg(to_jsonb(s)) from public.get_market_summary() s), '[]'::jsonb),
    'day_open', coalesce((select jsonb_agg(to_jsonb(d)) from public.get_day_open_prices() d), '[]'::jsonb),
    'bankrupt', coalesce((select jsonb_agg(to_jsonb(b)) from public.get_bankrupt_notices() b), '[]'::jsonb),
    'holdings', coalesce((select jsonb_agg(to_jsonb(h) order by h.asset_id)
                            from (select asset_id, qty, cost_basis
                                    from holdings where team_id = auth.uid() and qty > 0) h), '[]'::jsonb),
    'analysis', (select to_jsonb(o) from public.get_analysis_offer() o limit 1)
  )
$$;

revoke all on function public.get_market_snapshot() from public, anon;
grant execute on function public.get_market_snapshot() to authenticated;
notify pgrst, 'reload schema';
