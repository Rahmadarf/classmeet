-- Tes SQL role PIC lomba (scripts/sql/pic-role.sql + pic-lomba.sql). Berjalan di dalam transaksi yang di-ROLLBACK:
-- tidak ada data, status game, atau akun uji yang tersisa.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-pic-lomba.sql
-- Syarat: pic-role.sql, pic-lomba.sql, dan admin-delete-team-post.sql sudah dimuat; ada minimal satu admin.
-- Yang dibuktikan: PIC memberi hadiah atas lombanya sendiri (saldo tim naik, tercatat di payouts dan audit_log, idempotent);
-- guard dan PIC tidak bisa saling memakai fungsi hadiah; PIC bisa memindai kartu dan melihat hadiahnya sendiri; lomba tidak punya
-- saklar buka/tutup; admin_upsert_post mencocokkan jenis pos dengan role pemegang; penghapusan lomba; hak eksekusi; guard tetap bekerja.
begin;
set client_min_messages = notice;

create function pg_temp.as_user(p uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as
$$ begin if c then raise notice 'OK    %', msg; else raise exception 'GAGAL: %', msg; end if; end $$;
-- Jalankan SQL dan kembalikan pesan galatnya (null bila berhasil). Perubahan sebagian dibatalkan oleh blok exception.
create function pg_temp.err(q text) returns text language plpgsql as
$$ begin execute q; return null; exception when others then return sqlerrm; end $$;
create function pg_temp.expect_err(q text, code text) returns void language plpgsql as
$$ declare e text := pg_temp.err(q);
begin
  if e is not distinct from code then raise notice 'OK    galat % sesuai', code;
  else raise exception 'GAGAL: diharapkan galat %, dapat % (%)', code, coalesce(e, 'berhasil'), q; end if;
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
  c_team  constant uuid := '00000000-0000-4000-8000-0000000000a1';
  c_g1    constant uuid := '00000000-0000-4000-8000-0000000000c1';   -- guard, pos rally
  c_p1    constant uuid := '00000000-0000-4000-8000-0000000000d1';   -- pic, lomba dengan hadiah
  c_p2    constant uuid := '00000000-0000-4000-8000-0000000000d2';   -- pic, lomba bersih (dihapus)
  c_p3    constant uuid := '00000000-0000-4000-8000-0000000000d3';   -- pic tanpa lomba
  v_admin uuid;
  v_post_r uuid; v_post_l uuid; v_post_l2 uuid;
  v_req uuid := gen_random_uuid();
  v_req_g uuid := gen_random_uuid();
  v_qr uuid; v_code text;
  v_row public.payouts; v_ref public.team_ref;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform pg_temp.ok(v_admin is not null, 'ada akun admin');

  perform pg_temp.mkuser(c_g1, 'ujiguardpic1', 'guard');
  perform pg_temp.mkuser(c_p1, 'ujipic1', 'pic');
  perform pg_temp.mkuser(c_p2, 'ujipic2', 'pic');
  perform pg_temp.mkuser(c_p3, 'ujipic3', 'pic');
  insert into auth.users (id, aud, role, email) values (c_team, 'authenticated', 'authenticated', 'uji-timpic@classmeet.local');
  insert into profiles (id, username, role, display_name) values (c_team, 'ujitimpic', 'team', 'Tim Uji PIC');
  insert into teams (id, name, cash, short_code) values (c_team, 'Tim Uji PIC', 0, 'UP0001')
    returning qr_token, short_code into v_qr, v_code;

  -- ---- admin_upsert_post: jenis pos harus cocok dengan role pemegang ----
  perform pg_temp.as_user(v_admin);
  v_post_r := public.admin_upsert_post(null, 'Pos 91 · Uji Rally', 'Lapangan A', c_g1, 'rally');
  perform pg_temp.ok((select kind from posts where id = v_post_r) = 'rally', 'pos rally dibuat dengan kind rally');
  v_post_l := public.admin_upsert_post(null, 'Lomba 91 · Uji Futsal', 'Aula', c_p1, 'lomba');
  perform pg_temp.ok((select kind from posts where id = v_post_l) = 'lomba'
                     and (select is_open from posts where id = v_post_l) = false, 'lomba dibuat dengan kind lomba');
  v_post_l2 := public.admin_upsert_post(null, 'Lomba 92 · Uji Bersih', 'Aula', c_p2, 'lomba');
  perform pg_temp.expect_err(format('select public.admin_upsert_post(null, %L, %L, %L, %L)', 'Lomba 93', 'Aula', c_g1, 'lomba'),
                             'guard_invalid');   -- role guard tidak boleh memegang lomba (dan sudah memegang pos lain)
  perform pg_temp.expect_err(format('select public.admin_upsert_post(null, %L, %L, %L, %L)', 'Pos 93', 'Lap', c_p3, 'rally'),
                             'guard_invalid');   -- role pic tidak boleh memegang pos rally
  perform pg_temp.expect_err(format('select public.admin_upsert_post(null, %L, %L, %L)', 'Pos 94', 'Lap', c_p3),
                             'guard_invalid');   -- tanpa p_kind = rally; pic tetap ditolak
  perform pg_temp.expect_err(format('select public.admin_upsert_post(null, %L, %L, %L, %L)', 'X', 'Y', c_p3, 'lain'),
                             'invalid_input');   -- jenis tidak dikenal
  perform pg_temp.expect_err(format('select public.admin_upsert_post(null, %L, %L, %L, %L)', 'Lomba 95', 'Aula', c_p1, 'lomba'),
                             'guard_invalid');   -- satu pic satu lomba
  perform pg_temp.as_user(c_g1);
  perform pg_temp.expect_err(format('select public.admin_upsert_post(null, %L, %L, %L, %L)', 'Lomba 96', 'Aula', c_p3, 'lomba'),
                             'forbidden');       -- bukan admin

  -- ---- get_post_list membawa kolom kind ----
  perform pg_temp.as_user(c_p1);
  perform pg_temp.ok((select count(*) from public.get_post_list() g where g.id = v_post_l and g.kind = 'lomba') = 1
                     and (select count(*) from public.get_post_list() g where g.id = v_post_r and g.kind = 'rally') = 1,
                     'get_post_list mengembalikan kind');

  -- ---- game belum dimulai ----
  perform pg_temp.set_state('setup');
  perform pg_temp.as_user(c_p1);
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 100000, null)', gen_random_uuid(), c_team),
                             'game_not_active');

  -- ---- game berjalan: PIC memberi hadiah ----
  perform pg_temp.set_state('open');
  perform pg_temp.as_user(c_p1);
  v_ref := public.resolve_team_qr(v_qr);
  perform pg_temp.ok(v_ref.team_id = c_team and v_ref.cash = 0, 'PIC memindai kartu: resolve_team_qr');
  v_ref := public.resolve_team_code(v_code);
  perform pg_temp.ok(v_ref.team_id = c_team, 'PIC memakai kode cadangan: resolve_team_code');

  v_row := public.award_pic_payout(v_req, c_team, 150000, null);
  perform pg_temp.ok(v_row.post_id = v_post_l and v_row.guard_id = c_p1 and v_row.amount = 150000,
                     'hadiah PIC tercatat atas lomba dan akun PIC');
  perform pg_temp.ok((select cash from teams where id = c_team) = 150000, 'saldo tim naik 150.000');
  perform pg_temp.ok(exists (select 1 from audit_log where actor_id = c_p1 and action = 'payout_awarded'
                              and (payload ->> 'payout_id')::bigint = v_row.id and payload ->> 'kind' = 'lomba'),
                     'audit_log payout_awarded dicatat');

  -- idempotensi: kirim ulang dengan request_id dan nilai sama tidak menggandakan
  v_row := public.award_pic_payout(v_req, c_team, 150000, null);
  perform pg_temp.ok((select cash from teams where id = c_team) = 150000
                     and (select count(*) from payouts where request_id = v_req) = 1, 'kirim ulang: saldo tidak berlipat');
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 999, null)', v_req, c_team), 'request_id_conflict');
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 0, null)', gen_random_uuid(), c_team), 'invalid_amount');
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 1000, null)', gen_random_uuid(), gen_random_uuid()),
                             'team_not_found');

  -- PIC tanpa lomba tidak bisa memberi hadiah
  perform pg_temp.as_user(c_p3);
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 1000, null)', gen_random_uuid(), c_team), 'forbidden');

  -- ---- guard dan PIC tidak bisa saling memakai fungsi hadiah ----
  perform pg_temp.as_user(c_g1);
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 1000, null)', gen_random_uuid(), c_team), 'forbidden');
  perform pg_temp.as_user(c_p1);
  perform pg_temp.expect_err(format('select public.award_payout(%L, %L, 1000, null)', gen_random_uuid(), c_team), 'forbidden');
  perform pg_temp.as_user(c_team);
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 1000, null)', gen_random_uuid(), c_team), 'forbidden');
  perform pg_temp.expect_err(format('select public.resolve_team_qr(%L)', v_qr), 'forbidden');

  -- ---- guard tetap bekerja seperti semula ----
  perform pg_temp.as_user(c_g1);
  v_row := public.award_payout(v_req_g, c_team, 50000, null);
  perform pg_temp.ok(v_row.post_id = v_post_r and (select cash from teams where id = c_team) = 200000,
                     'guard tetap bisa memberi hadiah (award_payout)');

  -- ---- daftar hadiah per akun ----
  perform pg_temp.as_user(c_p1);
  perform pg_temp.ok((select count(*) from public.get_post_payouts(50)) = 1
                     and (select amount from public.get_post_payouts(50) limit 1) = 150000, 'PIC hanya melihat hadiahnya sendiri');
  perform pg_temp.as_user(c_g1);
  perform pg_temp.ok((select count(*) from public.get_post_payouts(50)) = 1
                     and (select amount from public.get_post_payouts(50) limit 1) = 50000, 'guard hanya melihat hadiahnya sendiri');
  perform pg_temp.as_user(c_team);
  perform pg_temp.expect_err('select * from public.get_post_payouts(50)', 'forbidden');

  -- ---- lomba tidak punya saklar buka/tutup ----
  perform pg_temp.as_user(c_p1);
  perform pg_temp.expect_err('select public.guard_set_post_open(true)', 'forbidden');   -- hanya role guard
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err(format('select public.admin_set_post_open(%L, true)', v_post_l), 'not_applicable');
  perform pg_temp.ok(public.admin_set_post_open(v_post_r, true) = true, 'admin tetap bisa membuka pos rally');

  -- ---- buku besar: saldo tim = jumlah hadiah ----
  perform pg_temp.ok((select cash from teams where id = c_team) = (select sum(amount) from payouts where team_id = c_team),
                     'saldo tim = jumlah hadiah (guard + PIC)');

  -- ---- game selesai: hadiah ditolak ----
  perform pg_temp.set_state('finished');
  perform pg_temp.as_user(c_p1);
  perform pg_temp.expect_err(format('select public.award_pic_payout(%L, %L, 1000, null)', gen_random_uuid(), c_team),
                             'game_not_active');

  -- ---- penghapusan (hanya saat setup) ----
  perform pg_temp.set_state('setup');
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err(format('select public.admin_delete_post(%L)', v_post_l), 'post_has_payouts');
  perform public.admin_delete_post(v_post_l2);
  perform pg_temp.ok(not exists (select 1 from posts where id = v_post_l2)
                     and not exists (select 1 from auth.users where id = c_p2)
                     and not exists (select 1 from profiles where id = c_p2), 'lomba bersih dihapus beserta akun PIC');
  perform pg_temp.ok(exists (select 1 from posts where id = v_post_l) and exists (select 1 from auth.users where id = c_p1),
                     'lomba berhadiah dan akun PIC-nya tidak tersentuh');

  -- ---- hak eksekusi ----
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.award_pic_payout(uuid, uuid, bigint, text)', 'execute')
                     and not has_function_privilege('anon', 'public.award_pic_payout(uuid, uuid, bigint, text)', 'execute'),
                     'award_pic_payout: authenticated ya, anon tidak');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.admin_upsert_post(uuid, text, text, uuid, text)', 'execute')
                     and not has_function_privilege('anon', 'public.admin_upsert_post(uuid, text, text, uuid, text)', 'execute'),
                     'admin_upsert_post: authenticated ya, anon tidak');
end $t$;

rollback;
