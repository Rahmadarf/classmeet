-- Hapus tim (19 Nov): "soft delete" yang menjaga riwayat. Jalankan SETELAH news-engine-v2.sql. Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/team-delete.sql
--
-- Tim tidak benar-benar dihapus dari tabel: order, transaksi, hadiah, dan dividennya saling terkait dengan tim lain dan dengan
-- statistik pasar, jadi baris dan riwayatnya dipertahankan. `admin_delete_team(p_team_id)` (hanya admin) melakukan:
--   * membatalkan semua order antre tim itu (saldo/unit yang terkunci dikembalikan lebih dulu oleh `ob_cancel`);
--   * menandai `teams.deleted_at`, mengganti `qr_token` (kartu QR lama mati) dan menambahkan penanda "[dihapus ...]" pada nama
--     (nama asli bisa dipakai tim baru);
--   * tim hilang dari peringkat (view `v_team_net_worth`, snapshot), pencarian kartu (`resolve_team_qr/code`), hadiah pos
--     (`award_payout`), dan tidak bisa memasang order baru (trigger `orders_deleted_team_guard`).
-- Akun loginnya dinonaktifkan oleh server action (service role). Dicatat di audit (`delete_team`).
select set_config('classmeet.system', 'on', false);

alter table public.teams add column if not exists deleted_at timestamptz;

create or replace view public.v_team_net_worth as
 SELECT t.id AS team_id,
    t.name,
    t.cash + t.locked_cash AS cash,
    COALESCE(sum(h.qty * COALESCE(a.rank_price, a.price)), 0::numeric)::bigint AS holdings_value,
    ((t.cash + t.locked_cash)::numeric + COALESCE(sum(h.qty * COALESCE(a.rank_price, a.price)), 0::numeric))::bigint AS net_worth,
    t.cash AS avail_cash,
    t.locked_cash
   FROM teams t
     LEFT JOIN holdings h ON h.team_id = t.id AND h.qty > 0
     LEFT JOIN assets a ON a.id = h.asset_id
  WHERE t.deleted_at IS NULL
  GROUP BY t.id, t.name, t.cash, t.locked_cash;


CREATE OR REPLACE FUNCTION public.get_leaderboard()
 RETURNS SETOF leaderboard_row
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role    app_role := app_role();
  v_visible boolean;
  v_frozen  timestamptz;
begin
  if v_role is null or v_role not in ('admin', 'display') then raise exception 'forbidden'; end if;

  select leaderboard_visible, leaderboard_frozen_at into v_visible, v_frozen from game_settings;

  if v_role = 'display' and not v_visible then raise exception 'leaderboard_hidden'; end if;

  if v_role = 'display' and v_frozen is not null then
    return query
      select s.rank, s.team_id, t.name, s.cash, s.holdings_value, s.net_worth
        from leaderboard_snapshot s join teams t on t.id = s.team_id and t.deleted_at is null
       order by s.rank, t.name;
    return;
  end if;

  return query
    select (rank() over (order by v.net_worth desc, v.cash desc))::int,
           v.team_id, v.name, v.cash, v.holdings_value, v.net_worth
      from v_team_net_worth v
     order by 1, v.name;
end $function$;

CREATE OR REPLACE FUNCTION public.resolve_team_qr(p_qr uuid)
 RETURNS team_ref
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ref public.team_ref;
begin
  if coalesce(app_role()::text, '') not in ('guard', 'admin') then raise exception 'forbidden'; end if;
  select t.id, t.name, t.cash into v_ref from teams t where t.qr_token = p_qr and t.deleted_at is null;
  if v_ref.team_id is null then raise exception 'team_not_found'; end if;
  return v_ref;
end $function$;

CREATE OR REPLACE FUNCTION public.resolve_team_code(p_code text)
 RETURNS team_ref
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ref public.team_ref;
begin
  if coalesce(app_role()::text, '') not in ('guard', 'admin') then raise exception 'forbidden'; end if;
  select t.id, t.name, t.cash into v_ref from teams t where t.short_code = upper(btrim(p_code)) and t.deleted_at is null;
  if v_ref.team_id is null then raise exception 'team_not_found'; end if;
  return v_ref;
end $function$;

CREATE OR REPLACE FUNCTION public.award_payout(p_request_id uuid, p_team_id uuid, p_amount bigint, p_note text DEFAULT NULL::text)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid      uuid := auth.uid();
  v_post     public.posts;
  v_state    game_state;
  v_existing public.payouts;
  v_row      public.payouts;
begin
  if app_role() is distinct from 'guard' then raise exception 'forbidden'; end if;

  select * into v_post from posts where guard_id = v_uid;
  if not found then raise exception 'forbidden'; end if;

  perform 1 from teams where id = p_team_id and deleted_at is null for update;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_existing from payouts where request_id = p_request_id;
  if found then
    if v_existing.guard_id = v_uid and v_existing.team_id = p_team_id
       and v_existing.amount = p_amount then
      return v_existing;
    end if;
    raise exception 'request_id_conflict';
  end if;

  select state into v_state from game_settings;
  if v_state not in ('open', 'paused') then raise exception 'game_not_active'; end if;

  if p_amount is null or p_amount < 1 then raise exception 'invalid_amount'; end if;

  insert into payouts (request_id, post_id, team_id, guard_id, amount, note)
  values (p_request_id, v_post.id, p_team_id, v_uid, p_amount, p_note)
  on conflict (request_id) do nothing
  returning * into v_row;
  if not found then raise exception 'request_id_conflict'; end if;

  update teams set cash = cash + p_amount where id = p_team_id;

  insert into audit_log (actor_id, action, payload)
  values (v_uid, 'payout_awarded',
          jsonb_build_object('payout_id', v_row.id, 'team_id', p_team_id,
                             'post_id', v_post.id, 'amount', p_amount));
  return v_row;
end $function$;

create or replace function public.trg_orders_deleted_team()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_house and exists (select 1 from teams t where t.id = new.team_id and t.deleted_at is not null) then
    raise exception 'forbidden';
  end if;
  return new;
end $$;
drop trigger if exists orders_deleted_team_guard on public.orders;
create trigger orders_deleted_team_guard before insert on public.orders
  for each row execute function public.trg_orders_deleted_team();

create or replace function public.admin_delete_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare t public.teams; o record; v_cancel int := 0;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  perform public.ob_lock();
  select * into t from teams where id = p_team_id and deleted_at is null for update;
  if not found then raise exception 'team_not_found'; end if;
  perform set_config('classmeet.system', 'on', true);
  for o in select id from orders where team_id = p_team_id and status in ('open', 'partial') order by id loop
    perform public.ob_cancel(o.id);
    v_cancel := v_cancel + 1;
  end loop;
  update teams
     set deleted_at = now(),
         qr_token = gen_random_uuid(),
         name = left(t.name, 40) || ' [dihapus ' || to_char(now() at time zone 'Asia/Jakarta', 'DD/MM HH24:MI:SS') || ']'
   where id = p_team_id;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'delete_team',
          jsonb_build_object('team_id', p_team_id, 'name', t.name, 'cash', t.cash + t.locked_cash, 'orders_cancelled', v_cancel));
  perform set_config('classmeet.system', 'off', true);
end $$;

revoke all on function public.admin_delete_team(uuid) from public, anon;
grant execute on function public.admin_delete_team(uuid) to authenticated;
revoke all on function public.trg_orders_deleted_team() from public, anon, authenticated;

select set_config('classmeet.system', 'off', false);
