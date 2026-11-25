-- PIC lomba (langkah 2 dari 2). Aman dijalankan ulang. Jalankan SESUDAH pic-role.sql dan admin-delete-team-post.sql.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/pic-lomba.sql
--
-- Latar: rally (pos) hanya di hari ke-2; hari 1 dan 3 ada lomba di luar rally. Hadiah lomba diberikan PIC lomba, bukan guard.
-- PIC adalah role `pic`: memindai kartu tim lalu memberi hadiah, sama seperti guard, tetapi TANPA saklar buka/tutup pos.
-- Guard tidak berubah: `award_payout` dan `guard_set_post_open` tidak disentuh. Aturan hari (rally hari 2, lomba hari 1 dan 3)
-- adalah aturan lapangan, TIDAK ditegakkan sistem.
--
-- Data: akun PIC memegang satu baris `posts` berjenis `lomba` (posts.guard_id = id profil PIC; satu PIC satu lomba). Hadiah
-- PIC ditulis ke tabel `payouts` yang sama, jadi riwayat tim, papan Hadiah admin, buku besar, reset, dan penghapusan tidak berubah.
--
-- Isi skrip:
--   1. posts.kind ('rally' default | 'lomba'): hanya untuk menyaring tampilan (layar publik, daftar admin) dan menolak saklar lomba.
--   2. award_pic_payout(request_id, team_id, amount, note): salinan award_payout yang hanya menerima role `pic`.
--   3. resolve_team_qr / resolve_team_code / get_post_payouts: izinkan juga `pic`.
--   4. get_post_list: kolom baru `kind`.
--   5. admin_upsert_post: parameter baru `p_kind` (pemegang pos: guard untuk rally, pic untuk lomba).
--   6. admin_set_post_open: menolak pos lomba (`not_applicable`).
--   7. admin_delete_post: akun `pic` ikut dihapus bersama lombanya, seperti akun guard.
-- Kode galat baru: not_applicable.

-- ---------- 1. posts.kind ----------
alter table public.posts add column if not exists kind text not null default 'rally';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_kind_check' and conrelid = 'public.posts'::regclass) then
    alter table public.posts add constraint posts_kind_check check (kind in ('rally', 'lomba'));
  end if;
end $$;

-- ---------- 2. hadiah oleh PIC ----------
create or replace function public.award_pic_payout(p_request_id uuid, p_team_id uuid, p_amount bigint, p_note text default null)
returns public.payouts
language plpgsql security definer set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_post     public.posts;
  v_state    game_state;
  v_existing public.payouts;
  v_row      public.payouts;
begin
  if app_role() is distinct from 'pic' then raise exception 'forbidden'; end if;

  select * into v_post from posts where guard_id = v_uid and kind = 'lomba';
  if not found then raise exception 'forbidden'; end if;

  -- kunci tim tujuan: menserialkan hadiah dengan transaksi dan dengan penutupan game
  perform 1 from teams where id = p_team_id for update;
  if not found then raise exception 'team_not_found'; end if;

  -- idempotensi: kirim ulang dari antrean offline mengembalikan hasil lama
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
                             'post_id', v_post.id, 'amount', p_amount, 'kind', 'lomba'));
  return v_row;
end $$;

-- ---------- 3. pindai kartu dan daftar hadiah: guard, pic (dan admin untuk pindai) ----------
create or replace function public.resolve_team_qr(p_qr uuid)
returns public.team_ref
language plpgsql stable security definer set search_path = public
as $$
declare v_ref public.team_ref;
begin
  if coalesce(app_role()::text, '') not in ('guard', 'pic', 'admin') then raise exception 'forbidden'; end if;
  select t.id, t.name, t.cash into v_ref from teams t where t.qr_token = p_qr;
  if v_ref.team_id is null then raise exception 'team_not_found'; end if;
  return v_ref;
end $$;

create or replace function public.resolve_team_code(p_code text)
returns public.team_ref
language plpgsql stable security definer set search_path = public
as $$
declare v_ref public.team_ref;
begin
  if coalesce(app_role()::text, '') not in ('guard', 'pic', 'admin') then raise exception 'forbidden'; end if;
  select t.id, t.name, t.cash into v_ref from teams t where t.short_code = upper(btrim(p_code));
  if v_ref.team_id is null then raise exception 'team_not_found'; end if;
  return v_ref;
end $$;

create or replace function public.get_post_payouts(p_limit int default 50)
returns setof public.post_payout_row
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce(app_role()::text, '') not in ('guard', 'pic') then raise exception 'forbidden'; end if;
  return query
    select pr.id, t.name, pr.amount, pr.created_at
      from payouts pr
      join teams t on t.id = pr.team_id
      join posts p on p.id = pr.post_id
     where p.guard_id = auth.uid()
     order by pr.created_at desc
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- ---------- 4. daftar pos: kolom `kind` ----------
drop function if exists public.get_post_list();
create function public.get_post_list()
returns table (id uuid, name text, location text, is_open boolean, kind text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if app_role() is null then raise exception 'forbidden'; end if;
  return query select p.id, p.name, p.location, p.is_open, p.kind from posts p order by p.name;
end $$;

-- ---------- 5. tambah/ubah pos atau lomba ----------
-- Pemegang harus berperan `guard` untuk kind 'rally' dan `pic` untuk kind 'lomba'. Satu akun memegang satu pos (posts.guard_id unik).
drop function if exists public.admin_upsert_post(uuid, text, text, uuid);
create or replace function public.admin_upsert_post(
  p_post_id uuid, p_name text, p_location text, p_guard_id uuid, p_kind text default 'rally'
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_kind text := coalesce(p_kind, 'rally');
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_name is null or btrim(p_name) = '' or p_location is null or btrim(p_location) = '' or p_guard_id is null
     or v_kind not in ('rally', 'lomba') then
    raise exception 'invalid_input';
  end if;
  perform 1 from profiles where id = p_guard_id and role = (case v_kind when 'lomba' then 'pic' else 'guard' end)::app_role;
  if not found then raise exception 'guard_invalid'; end if;
  if exists (select 1 from posts where guard_id = p_guard_id and id is distinct from p_post_id) then
    raise exception 'guard_invalid';                -- akun itu sudah memegang pos/lomba lain
  end if;

  if p_post_id is null then
    insert into posts (name, location, guard_id, is_open, kind)
    values (btrim(p_name), btrim(p_location), p_guard_id, false, v_kind)
    returning id into v_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'upsert_post', jsonb_build_object('post_id', v_id, 'created', true, 'name', btrim(p_name),
                                                           'guard_id', p_guard_id, 'kind', v_kind));
  else
    perform 1 from posts where id = p_post_id for update;
    if not found then raise exception 'post_not_found'; end if;
    update posts set name = btrim(p_name), location = btrim(p_location), guard_id = p_guard_id, kind = v_kind
     where id = p_post_id;
    v_id := p_post_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'upsert_post', jsonb_build_object('post_id', v_id, 'created', false, 'name', btrim(p_name),
                                                           'guard_id', p_guard_id, 'kind', v_kind));
  end if;
  return v_id;
end $$;

-- ---------- 6. saklar pos oleh admin: tidak berlaku untuk lomba ----------
create or replace function public.admin_set_post_open(p_post_id uuid, p_open boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_before boolean;
  v_kind   text;
  v_state  game_state;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_post_id is null or p_open is null then raise exception 'invalid_input'; end if;

  select state into v_state from game_settings;
  if v_state = 'finished' then raise exception 'game_not_active'; end if;   -- sama dengan guard_set_post_open

  select is_open, kind into v_before, v_kind from posts where id = p_post_id for update;
  if not found then raise exception 'post_not_found'; end if;
  if v_kind = 'lomba' then raise exception 'not_applicable'; end if;        -- lomba tidak punya saklar buka/tutup

  if v_before is distinct from p_open then
    update posts set is_open = p_open where id = p_post_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'set_post_open', jsonb_build_object('post_id', p_post_id, 'is_open', p_open, 'by', 'admin'));
  end if;
  return p_open;
end $$;

-- ---------- 7. hapus pos/lomba: akun pemegang (guard atau pic) ikut dihapus ----------
create or replace function public.admin_delete_post(p_post_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_state    game_state;
  v_name     text;
  v_location text;
  v_guard    uuid;
  v_username text;
  v_role     app_role;
  v_remove   boolean;
  v_audit    int := 0;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_post_id is null then raise exception 'invalid_input'; end if;

  select state into v_state from game_settings for share;
  if v_state is distinct from 'setup' then raise exception 'game_not_setup'; end if;

  select name, location, guard_id into v_name, v_location, v_guard from posts where id = p_post_id for update;
  if not found then raise exception 'post_not_found'; end if;

  if exists (select 1 from payouts where post_id = p_post_id) then raise exception 'post_has_payouts'; end if;

  select username, role into v_username, v_role from profiles where id = v_guard;

  delete from posts where id = p_post_id;

  -- Akun pemegang ikut dihapus bila memang akun `guard`/`pic` yang tidak memegang pos lain dan tidak punya hadiah tercatat.
  v_remove := coalesce(v_role in ('guard', 'pic'), false)
              and not exists (select 1 from posts where guard_id = v_guard)
              and not exists (select 1 from payouts where guard_id = v_guard);
  if v_remove then
    update audit_log
       set actor_id = null,
           payload  = payload || jsonb_build_object('actor_deleted',
                        jsonb_build_object('id', v_guard, 'username', v_username, 'role', v_role::text))
     where actor_id = v_guard;
    get diagnostics v_audit = row_count;
  end if;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'delete_post',
          jsonb_build_object('post_id', p_post_id, 'name', v_name, 'location', v_location, 'guard_id', v_guard,
                             'guard_username', v_username, 'guard_deleted', v_remove, 'audit_rows_detached', v_audit));

  if v_remove then
    delete from auth.users where id = v_guard;       -- cascade: profiles
  end if;
end $$;

-- ---------- hak eksekusi ----------
revoke all on function public.award_pic_payout(uuid, uuid, bigint, text) from public, anon;
revoke all on function public.get_post_list() from public, anon;
revoke all on function public.admin_upsert_post(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.award_pic_payout(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.get_post_list() to authenticated;
grant execute on function public.admin_upsert_post(uuid, text, text, uuid, text) to authenticated;
