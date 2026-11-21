-- Pemberitahuan "Bangkrut" di Pasar hanya tampil sampai efek berita BERIKUTNYA diterapkan (docs/17).
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -1 < scripts/sql/bankrupt-notice.sql
-- Aset tetap bangkrut selamanya (is_active = false); yang hilang hanya notifnya. Tim tidak boleh membaca `news`
-- (RLS admin), jadi daftar notif lewat fungsi security definer ini.

create or replace function public.get_bankrupt_notices()
returns table(asset_id uuid, symbol text, name text, liquidation_price bigint, bankrupt_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if app_role() is null or app_role() not in ('team', 'admin', 'display') then raise exception 'forbidden'; end if;
  return query
    select a.id, a.symbol, a.name, a.liquidation_price::bigint, a.bankrupt_at
      from assets a
      left join news_bankruptcies nb on nb.asset_id = a.id
     where a.bankrupt_at is not null
       and not exists (
         select 1 from news n
          where n.status = 'applied'
            and n.effect_applied_at > a.bankrupt_at
            and n.id is distinct from nb.news_id)
     order by a.bankrupt_at desc;
end $$;

revoke all on function public.get_bankrupt_notices() from public;
grant execute on function public.get_bankrupt_notices() to authenticated, service_role;
notify pgrst, 'reload schema';
