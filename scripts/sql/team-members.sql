-- Anggota tim (25 Nov): daftar peserta tiap tim, diisi admin di /admin/teams (satu per satu atau impor CSV). Aman dijalankan ulang.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/team-members.sql
--
-- Data pribadi: nama dan kelas peserta HANYA bisa dibaca dan ditulis admin (RLS + fungsi `security definer`). Tidak tampil di layar
-- publik atau akun tim. Audit mencatat jumlah dan id, TIDAK PERNAH nama atau kelas.
-- Tidak menyentuh uang, harga, atau berita, jadi boleh dipakai di status game apa pun. `admin_reset_game` tidak menghapus anggota
-- (seperti tim). Hapus tim (`admin_delete_team`) ikut menghapus anggotanya lewat `on delete cascade`.
--
-- Isi skrip:
--   1. Tabel team_members (nama unik per tim tanpa membedakan huruf besar/kecil).
--   2. admin_import_team_members(p_rows): MENGGANTI seluruh anggota tiap tim yang tercantum (tim lain tidak tersentuh), satu transaksi.
--      p_rows = array objek {team, name, class?, captain?}. Nama tim dicocokkan tanpa membedakan huruf besar/kecil dan spasi ganda.
--   3. admin_upsert_team_member / admin_delete_team_member: kelola satu anggota.
--   4. admin_member_counts(): jumlah anggota per tim (untuk kolom "Anggota"; menghindari batas 1.000 baris REST).
-- Kode galat: forbidden, invalid_input, team_not_found, member_not_found, member_exists.
-- Setiap UPDATE/DELETE punya WHERE (pg_safeupdate; lihat fix-safeupdate-game-settings.sql).

-- ---------- 1. tabel ----------
create table if not exists public.team_members (
  id         bigint generated always as identity primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80 and name = btrim(name)),
  class_name text check (class_name is null or (char_length(class_name) between 1 and 40 and class_name = btrim(class_name))),
  is_captain boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists team_members_team_name_key on public.team_members (team_id, lower(name));

alter table public.team_members enable row level security;
revoke all on table public.team_members from public, anon, authenticated;
grant select on table public.team_members to authenticated;

drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated
  using (app_role() = 'admin');

-- ---------- 2. impor: ganti seluruh anggota tim yang tercantum ----------
create or replace function public.admin_import_team_members(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_n int; v_teams int; v_removed int; v_added int;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'invalid_input'; end if;
  v_n := jsonb_array_length(p_rows);
  if v_n < 1 or v_n > 2000 then raise exception 'invalid_input'; end if;

  drop table if exists pg_temp._imp;
  create temp table _imp on commit drop as
    select btrim(regexp_replace(coalesce(r.team, ''), '\s+', ' ', 'g'))  as team,
           btrim(regexp_replace(coalesce(r.name, ''), '\s+', ' ', 'g'))  as name,
           nullif(btrim(regexp_replace(coalesce(r.class, ''), '\s+', ' ', 'g')), '') as class_name,
           coalesce(r.captain, false) as is_captain
      from jsonb_to_recordset(p_rows) as r(team text, name text, class text, captain boolean);

  if exists (select 1 from _imp
              where team = '' or name = '' or char_length(name) > 80 or char_length(coalesce(class_name, '')) > 40) then
    raise exception 'invalid_input';
  end if;
  if exists (select 1 from _imp group by lower(team), lower(name) having count(*) > 1) then
    raise exception 'invalid_input';                 -- nama kembar dalam satu tim
  end if;

  drop table if exists pg_temp._imp_team;
  create temp table _imp_team on commit drop as
    select distinct on (lower(i.team)) lower(i.team) as key, t.id as team_id
      from _imp i
      left join teams t on lower(btrim(regexp_replace(t.name, '\s+', ' ', 'g'))) = lower(i.team)
     order by lower(i.team), t.id;
  if exists (select 1 from _imp_team where team_id is null) then raise exception 'team_not_found'; end if;
  select count(*) into v_teams from _imp_team;

  -- kunci baris tim (urut id supaya dua impor bersamaan tidak saling menunggu)
  perform 1 from teams where id in (select team_id from _imp_team) order by id for update;

  delete from team_members where team_id in (select team_id from _imp_team);
  get diagnostics v_removed = row_count;

  insert into team_members (team_id, name, class_name, is_captain)
  select it.team_id, i.name, i.class_name, i.is_captain
    from _imp i join _imp_team it on it.key = lower(i.team);
  get diagnostics v_added = row_count;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'import_members',
          jsonb_build_object('teams', v_teams, 'removed', v_removed, 'added', v_added));
  return jsonb_build_object('teams', v_teams, 'removed', v_removed, 'added', v_added);
end $$;

-- ---------- 3. kelola satu anggota ----------
create or replace function public.admin_upsert_team_member(
  p_member_id bigint, p_team_id uuid, p_name text, p_class text default null, p_captain boolean default false
) returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_name  text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_class text := nullif(btrim(regexp_replace(coalesce(p_class, ''), '\s+', ' ', 'g')), '');
  v_id    bigint;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_team_id is null or v_name = '' or char_length(v_name) > 80 or char_length(coalesce(v_class, '')) > 40 then
    raise exception 'invalid_input';
  end if;
  perform 1 from teams where id = p_team_id for update;
  if not found then raise exception 'team_not_found'; end if;

  begin
    if p_member_id is null then
      insert into team_members (team_id, name, class_name, is_captain)
      values (p_team_id, v_name, v_class, coalesce(p_captain, false))
      returning id into v_id;
    else
      update team_members
         set team_id = p_team_id, name = v_name, class_name = v_class, is_captain = coalesce(p_captain, false)
       where id = p_member_id
      returning id into v_id;
      if v_id is null then raise exception 'member_not_found'; end if;
    end if;
  exception when unique_violation then
    raise exception 'member_exists';
  end;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'upsert_member',
          jsonb_build_object('team_id', p_team_id, 'member_id', v_id, 'created', p_member_id is null));
  return v_id;
end $$;

create or replace function public.admin_delete_team_member(p_member_id bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_team uuid;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_member_id is null then raise exception 'invalid_input'; end if;
  delete from team_members where id = p_member_id returning team_id into v_team;
  if v_team is null then raise exception 'member_not_found'; end if;
  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'delete_member', jsonb_build_object('team_id', v_team, 'member_id', p_member_id));
end $$;

-- ---------- 4. jumlah anggota per tim ----------
create or replace function public.admin_member_counts()
returns table (team_id uuid, member_count int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  return query select m.team_id, count(*)::int from team_members m group by m.team_id;
end $$;

-- ---------- hak eksekusi ----------
revoke all on function public.admin_import_team_members(jsonb) from public, anon;
revoke all on function public.admin_upsert_team_member(bigint, uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_delete_team_member(bigint) from public, anon;
revoke all on function public.admin_member_counts() from public, anon;
grant execute on function public.admin_import_team_members(jsonb) to authenticated;
grant execute on function public.admin_upsert_team_member(bigint, uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_team_member(bigint) to authenticated;
grant execute on function public.admin_member_counts() to authenticated;
