-- Riwayat IKC di server (19 Nov): grafik Display pasar tidak lagi bergantung pada browser layar yang menyampel sendiri.
-- Aman dijalankan ulang.  docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/index-history.sql
--
--   * tabel `index_history` (waktu, nilai IKC); hanya dibaca lewat `get_index_history()` (tim/admin/display), ditulis oleh
--     `record_index_sample()`;
--   * pg_cron `index-sample` tiap 30 detik: mencatat IKC saat pasar `open`, hanya bila nilainya berubah atau sudah >= 5 menit
--     sejak catatan terakhir (membatasi jumlah baris: <= ±40 ribu untuk 3 hari);
--   * `get_index_history(p_max)` mengembalikan seluruh riwayat, dijarangkan di server bila lebih dari `p_max` titik (bawaan 1200);
--   * isi awal dari `price_history` (IKC sesudah tiap perubahan harga oleh berita) bila tabel masih kosong, supaya grafik langsung
--     punya masa lalu. Rumus IKC sama dengan `get_market_index()`: rata-rata (harga terakhir / harga dasar) x 1000.
create table if not exists public.index_history (
  id    bigint generated always as identity primary key,
  at    timestamptz not null default now(),
  value numeric not null
);
create index if not exists index_history_at_idx on public.index_history (at);
alter table public.index_history enable row level security;
revoke all on public.index_history from public, anon, authenticated;

create or replace function public.record_index_sample()
returns void
language plpgsql security definer set search_path = public as $$
declare v numeric; l public.index_history;
begin
  if (select state from game_settings) <> 'open' then return; end if;
  select round(avg(coalesce(a.last_price, a.price)::numeric / coalesce(a.base_price, a.price)) * 1000, 2)
    into v from assets a where a.is_active;
  if v is null then return; end if;
  select * into l from index_history order by id desc limit 1;
  if l.id is null or l.value <> v or l.at < now() - interval '5 minutes' then
    insert into index_history (value) values (v);
  end if;
end $$;

create or replace function public.get_index_history(p_max int default 1200)
returns table (at timestamptz, value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is null or app_role() not in ('team', 'admin', 'display') then raise exception 'forbidden'; end if;
  return query
    with s as (
      select h.at, h.value, row_number() over (order by h.at, h.id) rn, count(*) over () n from index_history h
    )
    select s.at, s.value from s
     where s.n <= greatest(p_max, 2) or s.rn = s.n or s.rn = 1
        or s.rn % ceil(s.n::numeric / greatest(p_max, 2))::int = 0
     order by s.at, s.rn;
end $$;

revoke all on function public.record_index_sample() from public, anon, authenticated;
revoke all on function public.get_index_history(int) from public, anon;
grant execute on function public.get_index_history(int) to authenticated;

-- isi awal dari riwayat harga oleh berita (hanya bila kosong)
insert into public.index_history (at, value)
select t.at,
       round(avg((select h.price from price_history h
                   where h.asset_id = a.id and h.created_at <= t.at order by h.created_at desc, h.id desc limit 1)::numeric
                 / coalesce(a.base_price, a.price)) * 1000, 2)
  from (select distinct created_at as at from price_history where reason = 'berita') t
  cross join assets a
 where a.is_active and not exists (select 1 from public.index_history)
 group by t.at
having avg((select h.price from price_history h
             where h.asset_id = a.id and h.created_at <= t.at order by h.created_at desc, h.id desc limit 1)) is not null
 order by t.at;

-- pencatat berkala
do $$
begin
  if exists (select 1 from cron.job where jobname = 'index-sample') then perform cron.unschedule('index-sample'); end if;
  perform cron.schedule('index-sample', '30 seconds', 'select public.record_index_sample()');
end $$;
