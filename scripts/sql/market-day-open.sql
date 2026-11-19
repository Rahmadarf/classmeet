-- Harga open hari ini untuk persen perubahan di halaman Pasar (19 Nov).
-- Aman dijalankan ulang.  docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/market-day-open.sql
--
-- Sebelumnya persen = harga transaksi terakhir vs harga acuan SEKARANG. Karena bandar mengutip di sekitar acuan, hasilnya sering
-- 0,0 %. Sekarang pembandingnya **harga open hari ini** = harga acuan saat hari (WIB) itu dimulai, yaitu harga acuan terakhir
-- sebelum 00.00 WIB (dari `price_history`), atau harga dasar bila belum ada riwayat (hari pertama). Pasar tutup malam hari dan
-- harga hanya berubah lewat berita saat pasar buka, jadi nilainya sama dengan harga acuan pada pukul 08.00.
create or replace function public.get_day_open_prices()
returns table (asset_id uuid, open_price bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_t0 timestamptz := date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
begin
  if app_role() is null or app_role() not in ('team', 'admin', 'display') then raise exception 'forbidden'; end if;
  return query
    select a.id,
           coalesce((select h.price from price_history h
                      where h.asset_id = a.id and h.created_at < v_t0
                      order by h.created_at desc, h.id desc limit 1),
                    a.base_price, a.price)
      from assets a where a.is_active order by a.symbol;
end $$;

revoke all on function public.get_day_open_prices() from public, anon;
grant execute on function public.get_day_open_prices() to authenticated;
