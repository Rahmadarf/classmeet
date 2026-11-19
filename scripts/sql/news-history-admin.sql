-- Riwayat berita yang sudah berlaku untuk admin (19 Nov). Jalankan SETELAH news-effects-admin.sql. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/news-history-admin.sql
--
-- Sesudah game dibuka admin tidak bisa membaca tabel `news` (RLS). Dua fungsi ini hanya mengembalikan berita yang SUDAH berlaku
-- (`applied`, sudah diterapkan ke harga): tidak ada berita yang belum terbit atau belum berlaku, dan tidak ada `effect_at`.
--   admin_applied_news(p_limit)       daftar berita berlaku terbaru dulu: waktu terbit, waktu berlaku, jumlah aset, event
--   admin_news_effects(p_news_id)     efek (persen per aset) dan event satu berita; ditolak bila belum `applied`
create or replace function public.admin_applied_news(p_limit int default 200)
returns table (news_id uuid, title text, published_at timestamptz, applied_at timestamptz, n_assets int,
               event_kind text, event_symbol text)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query
    select n.id, n.title, n.published_at, n.effect_applied_at,
           (select count(*)::int from news_effects e where e.news_id = n.id),
           coalesce(case when b.news_id is not null then 'bankrupt' end, ev.kind),
           (select a.symbol from assets a where a.id = coalesce(b.asset_id, ev.asset_id))
      from news n
      left join news_bankruptcies b on b.news_id = n.id
      left join lateral (select e.kind, e.asset_id from news_events e where e.news_id = n.id order by e.kind limit 1) ev on true
     where n.status = 'applied'
     order by n.effect_applied_at desc nulls last
     limit greatest(least(p_limit, 500), 1);
end $$;

create or replace function public.admin_news_effects(p_news_id uuid)
returns table (news_id uuid, status text, kind text, symbol text, name text, value int)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if not exists (select 1 from news n where n.id = p_news_id and n.status = 'applied') then
    raise exception 'news_wrong_status';   -- hanya berita yang sudah berlaku
  end if;
  return query
    select p_news_id, 'applied'::text, 'bankrupt'::text, a.symbol, a.name, b.liquidation_bps
      from news_bankruptcies b join assets a on a.id = b.asset_id where b.news_id = p_news_id
    union all
    select p_news_id, 'applied'::text, ev.kind, a.symbol, a.name, ev.amount
      from news_events ev join assets a on a.id = ev.asset_id where ev.news_id = p_news_id
    union all
    select p_news_id, 'applied'::text, 'effect'::text, a.symbol, a.name, e.pct_bps
      from news_effects e join assets a on a.id = e.asset_id where e.news_id = p_news_id;
end $$;

revoke all on function public.admin_applied_news(int) from public, anon;
grant execute on function public.admin_applied_news(int) to authenticated;
revoke all on function public.admin_news_effects(uuid) from public, anon;
grant execute on function public.admin_news_effects(uuid) to authenticated;
