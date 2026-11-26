-- Tes SQL anggota tim (scripts/sql/team-members.sql). Berjalan di dalam transaksi yang di-ROLLBACK: tidak ada data uji yang tersisa.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-team-members.sql
-- Syarat: team-members.sql dan admin-delete-team-post.sql sudah dimuat; ada minimal satu admin.
-- Yang dibuktikan: hanya admin; impor MENGGANTI anggota tim yang tercantum dan tidak menyentuh tim lain; nama tim dicocokkan tanpa
-- membedakan huruf dan spasi ganda; impor atomik (satu tim tak dikenal membatalkan semuanya); nama kembar ditolak; RLS membaca;
-- tambah/ubah/hapus satu anggota; audit tanpa nama; anggota ikut terhapus bersama tim; hak eksekusi.
begin;
set client_min_messages = notice;

create function pg_temp.as_user(p uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as
$$ begin if c then raise notice 'OK    %', msg; else raise exception 'GAGAL: %', msg; end if; end $$;
create function pg_temp.err(q text) returns text language plpgsql as
$$ begin execute q; return null; exception when others then return sqlerrm; end $$;
create function pg_temp.expect_err(q text, code text) returns void language plpgsql as
$$ declare e text := pg_temp.err(q);
begin
  if e is not distinct from code then raise notice 'OK    galat % sesuai', code;
  else raise exception 'GAGAL: diharapkan galat %, dapat % (%)', code, coalesce(e, 'berhasil'), q; end if;
end $$;
create function pg_temp.mkteam(p_id uuid, p_no int, p_name text) returns void language plpgsql as
$$ begin
  insert into auth.users (id, aud, role, email) values (p_id, 'authenticated', 'authenticated', 'uji-tm' || p_no || '@classmeet.local');
  insert into profiles (id, username, role, display_name) values (p_id, 'ujitm' || p_no, 'team', p_name);
  insert into teams (id, name, cash, short_code) values (p_id, p_name, 0, 'TM' || lpad(p_no::text, 4, '0'));
end $$;
create function pg_temp.mkuser(p_id uuid, p_username text, p_role app_role) returns void language plpgsql as
$$ begin
  insert into auth.users (id, aud, role, email) values (p_id, 'authenticated', 'authenticated', p_username || '@classmeet.local');
  insert into profiles (id, username, role, display_name) values (p_id, p_username, p_role, 'Uji ' || p_username);
end $$;
create function pg_temp.set_state(s game_state) returns void language plpgsql as
$$ begin update game_settings set state = s where true; end $$;

do $t$
declare
  c_t1 constant uuid := '00000000-0000-4000-8000-0000000000e1';
  c_t2 constant uuid := '00000000-0000-4000-8000-0000000000e2';
  c_t3 constant uuid := '00000000-0000-4000-8000-0000000000e3';
  c_g  constant uuid := '00000000-0000-4000-8000-0000000000e4';
  v_admin uuid; v_res jsonb; v_id bigint; v_id2 bigint; v_n int;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform pg_temp.ok(v_admin is not null, 'ada akun admin');
  perform pg_temp.mkteam(c_t1, 1, 'Uji Elang');
  perform pg_temp.mkteam(c_t2, 2, 'Uji Naga');
  perform pg_temp.mkteam(c_t3, 3, 'Uji Harimau');
  perform pg_temp.mkuser(c_g, 'ujigardtm', 'guard');

  -- ---- hanya admin ----
  perform pg_temp.as_user(c_g);
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[{"team":"Uji Elang","name":"A"}]'::jsonb)$q$, 'forbidden');
  perform pg_temp.expect_err(format('select public.admin_upsert_team_member(null, %L, %L)', c_t1, 'A'), 'forbidden');
  perform pg_temp.expect_err('select public.admin_delete_team_member(1)', 'forbidden');
  perform pg_temp.as_user(c_t1);
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[{"team":"Uji Elang","name":"A"}]'::jsonb)$q$, 'forbidden');

  -- ---- impor pertama: dua tim ----
  perform pg_temp.as_user(v_admin);
  v_res := public.admin_import_team_members($j$[
    {"team":"Uji Elang","name":"Budi Santoso","class":"XI IPA 1","captain":true},
    {"team":"Uji Elang","name":"Siti Aminah","class":"XI IPA 2"},
    {"team":"Uji Naga","name":"Rina Putri","class":"X IPA 1","captain":true}
  ]$j$::jsonb);
  perform pg_temp.ok((v_res ->> 'teams')::int = 2 and (v_res ->> 'removed')::int = 0 and (v_res ->> 'added')::int = 3,
                     'impor pertama: 2 tim, 3 ditambah, 0 dihapus');
  perform pg_temp.ok((select count(*) from team_members where team_id = c_t1) = 2
                     and (select is_captain from team_members where team_id = c_t1 and name = 'Budi Santoso')
                     and (select class_name from team_members where name = 'Rina Putri') = 'X IPA 1', 'anggota tersimpan lengkap');

  -- ---- impor kedua MENGGANTI tim yang tercantum; tim lain tidak tersentuh ----
  perform public.admin_upsert_team_member(null, c_t3, 'Agus Setiawan', 'XII IPA 1', true);
  v_res := public.admin_import_team_members($j$[
    {"team":"  uji   ELANG ","name":"Andi  Wijaya","class":""},
    {"team":"uji elang","name":"Dewi Lestari","class":"XI IPA 1"}
  ]$j$::jsonb);
  perform pg_temp.ok((v_res ->> 'teams')::int = 1 and (v_res ->> 'removed')::int = 2 and (v_res ->> 'added')::int = 2,
                     'impor kedua: nama tim dicocokkan tanpa membedakan huruf dan spasi ganda; 2 diganti');
  perform pg_temp.ok((select array_agg(name order by name) from team_members where team_id = c_t1) = array['Andi Wijaya', 'Dewi Lestari']
                     and (select class_name from team_members where name = 'Andi Wijaya') is null,
                     'Tim Elang kini persis seperti berkas (spasi dirapikan, kelas kosong jadi null)');
  perform pg_temp.ok((select count(*) from team_members where team_id = c_t2) = 1
                     and (select count(*) from team_members where team_id = c_t3) = 1, 'tim yang tidak ada di berkas tidak berubah');

  -- ---- atomik dan validasi ----
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[{"team":"Uji Elang","name":"Baru"},{"team":"Tim Tak Ada","name":"X"}]'::jsonb)$q$,
                             'team_not_found');
  perform pg_temp.ok((select array_agg(name order by name) from team_members where team_id = c_t1) = array['Andi Wijaya', 'Dewi Lestari'],
                     'galat membatalkan seluruh impor (Tim Elang utuh)');
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[{"team":"Uji Elang","name":"Dobel"},{"team":"uji elang","name":"DOBEL"}]'::jsonb)$q$,
                             'invalid_input');
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[{"team":"Uji Elang","name":"  "}]'::jsonb)$q$, 'invalid_input');
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[{"team":"","name":"X"}]'::jsonb)$q$, 'invalid_input');
  perform pg_temp.expect_err($q$select public.admin_import_team_members('[]'::jsonb)$q$, 'invalid_input');
  perform pg_temp.expect_err($q$select public.admin_import_team_members('{"a":1}'::jsonb)$q$, 'invalid_input');
  perform pg_temp.expect_err($q$select public.admin_import_team_members(null)$q$, 'invalid_input');
  perform pg_temp.expect_err(format('select public.admin_import_team_members(%L::jsonb)',
                                    (select jsonb_agg(jsonb_build_object('team', 'Uji Elang', 'name', 'N' || g)) from generate_series(1, 2001) g)),
                             'invalid_input');
  perform pg_temp.expect_err(format('select public.admin_import_team_members(%L::jsonb)',
                                    jsonb_build_array(jsonb_build_object('team', 'Uji Elang', 'name', repeat('x', 81)))),
                             'invalid_input');

  -- ---- satu anggota: tambah, ubah, duplikat, hapus ----
  v_id := public.admin_upsert_team_member(null, c_t2, 'Maya Sari', 'X IPA 1', false);
  perform pg_temp.ok(exists (select 1 from team_members where id = v_id and team_id = c_t2 and class_name = 'X IPA 1'), 'tambah satu anggota');
  perform pg_temp.expect_err(format('select public.admin_upsert_team_member(null, %L, %L)', c_t2, 'maya   SARI'), 'member_exists');
  v_id2 := public.admin_upsert_team_member(v_id, c_t2, 'Maya Sari Dewi', null, true);
  perform pg_temp.ok(v_id2 = v_id and (select name from team_members where id = v_id) = 'Maya Sari Dewi'
                     and (select is_captain from team_members where id = v_id) and (select class_name from team_members where id = v_id) is null,
                     'ubah nama, kelas, dan peran');
  perform pg_temp.expect_err(format('select public.admin_upsert_team_member(999999999, %L, %L)', c_t2, 'Siapa'), 'member_not_found');
  perform pg_temp.expect_err(format('select public.admin_upsert_team_member(null, %L, %L)', gen_random_uuid(), 'Siapa'), 'team_not_found');
  perform pg_temp.expect_err(format('select public.admin_upsert_team_member(null, %L, %L)', c_t2, '   '), 'invalid_input');
  perform public.admin_delete_team_member(v_id);
  perform pg_temp.ok(not exists (select 1 from team_members where id = v_id), 'hapus satu anggota');
  perform pg_temp.expect_err(format('select public.admin_delete_team_member(%s)', v_id), 'member_not_found');

  -- ---- audit: hanya jumlah dan id, tanpa nama ----
  perform pg_temp.ok(exists (select 1 from audit_log where actor_id = v_admin and action = 'import_members'
                              and (payload ->> 'added')::int = 2 and (payload ->> 'removed')::int = 2),
                     'audit import_members mencatat jumlah');
  perform pg_temp.ok(not exists (select 1 from audit_log
                                  where action in ('import_members', 'upsert_member', 'delete_member')
                                    and (payload::text ilike '%Andi%' or payload::text ilike '%Maya%' or payload::text ilike '%Dewi%')),
                     'audit tidak memuat nama anggota');

  -- ---- RLS: hanya admin yang bisa membaca ----
  perform pg_temp.as_user(v_admin);
  execute 'set local role authenticated';
  select count(*) into v_n from team_members;
  perform pg_temp.ok(v_n >= 3, 'admin (peran authenticated) membaca anggota');
  perform pg_temp.as_user(c_t1);
  select count(*) into v_n from team_members;
  perform pg_temp.ok(v_n = 0, 'akun tim tidak melihat anggota (RLS)');
  perform pg_temp.as_user(c_g);
  select count(*) into v_n from team_members;
  perform pg_temp.ok(v_n = 0, 'penjaga tidak melihat anggota (RLS)');
  perform pg_temp.expect_err(format('insert into team_members (team_id, name) values (%L, %L)', c_t1, 'Langsung'), 'permission denied for table team_members');
  execute 'reset role';

  -- ---- jumlah anggota per tim ----
  perform pg_temp.as_user(v_admin);
  perform pg_temp.ok((select member_count from public.admin_member_counts() where team_id = c_t1) = 2
                     and (select member_count from public.admin_member_counts() where team_id = c_t3) = 1
                     and not exists (select 1 from public.admin_member_counts() where team_id = c_g), 'admin_member_counts');
  perform pg_temp.as_user(c_g);
  perform pg_temp.expect_err('select * from public.admin_member_counts()', 'forbidden');
  perform pg_temp.as_user(v_admin);

  -- ---- hapus tim: anggota ikut hilang (cascade) ----
  perform pg_temp.set_state('setup');
  perform pg_temp.as_user(v_admin);
  perform public.admin_delete_team(c_t1);
  perform pg_temp.ok(not exists (select 1 from team_members where team_id = c_t1) and not exists (select 1 from teams where id = c_t1),
                     'hapus tim ikut menghapus anggotanya');
  perform pg_temp.ok((select count(*) from team_members where team_id = c_t2) = 1, 'anggota tim lain utuh');

  -- ---- hak eksekusi ----
  perform pg_temp.ok(not has_function_privilege('anon', 'public.admin_import_team_members(jsonb)', 'execute')
                     and has_function_privilege('authenticated', 'public.admin_import_team_members(jsonb)', 'execute')
                     and not has_function_privilege('anon', 'public.admin_upsert_team_member(bigint, uuid, text, text, boolean)', 'execute')
                     and not has_function_privilege('anon', 'public.admin_delete_team_member(bigint)', 'execute'),
                     'hak eksekusi: authenticated ya, anon tidak');
end $t$;

rollback;
