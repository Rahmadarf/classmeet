-- Admin melihat aset dan persen perubahan dari berita yang sedang tampil (19 Nov).
-- Jalankan SETELAH news-engine-v2.sql. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/news-effects-admin.sql
--
-- `admin_current_news_effects()` (hanya admin) mengembalikan efek berita TERBARU yang sedang tayang (`live`) atau sudah berlaku
-- (`applied`), karena sesudah game dibuka tabel `news_effects` disembunyikan dari admin lewat RLS:
--   kind = 'effect'    value = perubahan harga dalam bps (+250 = +2,5 %)
--          'bankrupt'  value = nilai likuidasi dalam bps dari harga acuan
--          'dividend'  value = dividen dalam bps dari harga acuan per unit
--          'suspend'   value = menit suspensi
-- TIDAK mengembalikan waktu berlakunya efek (`effect_at`): admin tetap tidak tahu KAPAN harga berubah. Catatan: untuk berita
-- yang masih `live`, admin kini bisa tahu APA yang akan berubah sebelum berlaku; ini mengubah aturan docs/07 §3.7.
create or replace function public.admin_current_news_effects()
returns table (news_id uuid, status text, kind text, symbol text, name text, value int)
language plpgsql stable security definer set search_path = public as $$
declare v_id uuid; v_status news_status;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  select n.id, n.status into v_id, v_status from news n
   where n.status in ('live', 'applied') order by n.published_at desc nulls last limit 1;
  if v_id is null then return; end if;
  return query
    select v_id, v_status::text, 'bankrupt'::text, a.symbol, a.name, b.liquidation_bps
      from news_bankruptcies b join assets a on a.id = b.asset_id where b.news_id = v_id
    union all
    select v_id, v_status::text, ev.kind, a.symbol, a.name, ev.amount
      from news_events ev join assets a on a.id = ev.asset_id where ev.news_id = v_id
    union all
    select v_id, v_status::text, 'effect'::text, a.symbol, a.name, e.pct_bps
      from news_effects e join assets a on a.id = e.asset_id where e.news_id = v_id;
end $$;

revoke all on function public.admin_current_news_effects() from public, anon;
grant execute on function public.admin_current_news_effects() to authenticated;
