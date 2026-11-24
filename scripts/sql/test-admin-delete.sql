-- Tes SQL admin_delete_team() dan admin_delete_post() (scripts/sql/admin-delete-team-post.sql). Berjalan di dalam transaksi
-- yang di-ROLLBACK: tidak ada data yang tersisa, termasuk status game dan akun uji.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-admin-delete.sql
-- Syarat: admin-delete-team-post.sql sudah dimuat; ada minimal satu admin dan satu aset.
-- Yang dibuktikan: hanya admin; hanya saat `setup` (ditolak `open`/`paused`/`finished`, data tetap); akun Auth ikut hilang;
-- tim/pos yang punya saldo, riwayat, atau hadiah DIBLOKIR; log audit lama tidak hilang; hak eksekusi.
begin;
set client_min_messages = notice;

create function pg_temp.as_user(p uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as
$$ begin if c then raise notice 'OK    %', msg; else raise exception 'GAGAL: %', msg; end if; end $$;
-- Jalankan SQL dan kembalikan pesan galatnya (null bila berhasil). Perubahan sebagian dibatalkan oleh blok exception.
create function pg_temp.err(q text) returns text language plpgsql as
$$ begin execute q; return null; exception when others then return sqlerrm; end $$;
create function pg_temp.mkteam(p_id uuid, p_no int, p_cash bigint default 0) returns void language plpgsql as
$$ begin
  insert into auth.users (id, aud, role, email) values (p_id, 'authenticated', 'authenticated', 'uji-tim' || p_no || '@classmeet.local');
  insert into profiles (id, username, role, display_name) values (p_id, 'ujitim' || p_no, 'team', 'Tim Uji ' || p_no);
  insert into teams (id, name, cash, short_code) values (p_id, 'Tim Uji ' || p_no, p_cash, 'UJ' || lpad(p_no::text, 4, '0'));
end $$;
create function pg_temp.mkpost(p_id uuid, p_guard uuid, p_no int) returns void language plpgsql as
$$ begin
  insert into auth.users (id, aud, role, email) values (p_guard, 'authenticated', 'authenticated', 'uji-guard' || p_no || '@classmeet.local');
  insert into profiles (id, username, role, display_name) values (p_guard, 'ujiguard' || p_no, 'guard', 'Penjaga Uji ' || p_no);
  insert into posts (id, name, location, guard_id) values (p_id, 'Pos 9' || p_no || ' · Uji', 'Lapangan ' || p_no, p_guard);
end $$;
create function pg_temp.set_state(s game_state) returns void language plpgsql as
$$ begin update game_settings set state = s where true; end $$;

-- Fixture: dua tim bersih, tim bersaldo, tim berkepemilikan, tim berhadiah; dua pos bersih (satu untuk uji non-setup), pos berhadiah.
do $t$
declare
  v_admin uuid; v_asset uuid;
  c_team1 constant uuid := '00000000-0000-4000-8000-0000000000a1';   -- bersih (dihapus di setup)
  c_team2 constant uuid := '00000000-0000-4000-8000-0000000000a2';   -- bersih (ditolak di non-setup)
  c_team3 constant uuid := '00000000-0000-4000-8000-0000000000a3';   -- bersaldo
  c_team4 constant uuid := '00000000-0000-4000-8000-0000000000a4';   -- punya kepemilikan
  c_team5 constant uuid := '00000000-0000-4000-8000-0000000000a5';   -- menerima hadiah
  c_team6 constant uuid := '00000000-0000-4000-8000-0000000000a6';   -- punya transaksi
  c_team7 constant uuid := '00000000-0000-4000-8000-0000000000a7';   -- punya pembelian analisa
  c_team8 constant uuid := '00000000-0000-4000-8000-0000000000a8';   -- punya dividen
  c_post1 constant uuid := '00000000-0000-4000-8000-0000000000b1';   -- bersih
  c_post2 constant uuid := '00000000-0000-4000-8000-0000000000b2';   -- bersih (ditolak di non-setup)
  c_post3 constant uuid := '00000000-0000-4000-8000-0000000000b3';   -- sudah memberi hadiah
  c_g1 constant uuid := '00000000-0000-4000-8000-0000000000c1';
  c_g2 constant uuid := '00000000-0000-4000-8000-0000000000c2';
  c_g3 constant uuid := '00000000-0000-4000-8000-0000000000c3';
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  select id into v_asset from assets limit 1;
  perform pg_temp.ok(v_admin is not null and v_asset is not null, 'ada admin dan aset uji');

  perform pg_temp.mkteam(c_team1, 1); perform pg_temp.mkteam(c_team2, 2); perform pg_temp.mkteam(c_team3, 3, 500);
  perform pg_temp.mkteam(c_team4, 4); perform pg_temp.mkteam(c_team5, 5); perform pg_temp.mkteam(c_team6, 6);
  perform pg_temp.mkteam(c_team7, 7); perform pg_temp.mkteam(c_team8, 8);
  perform pg_temp.mkpost(c_post1, c_g1, 1); perform pg_temp.mkpost(c_post2, c_g2, 2); perform pg_temp.mkpost(c_post3, c_g3, 3);

  insert into holdings (team_id, asset_id, qty, cost_basis) values (c_team4, v_asset, 3, 300);
  insert into payouts (request_id, post_id, team_id, guard_id, amount) values (gen_random_uuid(), c_post3, c_team5, c_g3, 1000);
  insert into transactions (request_id, team_id, asset_id, side, qty, unit_price, list_price, total)
    values (gen_random_uuid(), c_team6, v_asset, 'buy', 1, 100, 100, 100);
  insert into analysis_purchases (request_id, team_id, news_id, news_title, price, paragraphs)
    select gen_random_uuid(), c_team7, n.id, 'x', 0, array['a','b','c','d'] from news n limit 1;
  insert into dividends (asset_id, team_id, qty, per_unit, amount) values (v_asset, c_team8, 1, 1, 1);
  -- baris audit lama milik tim 1 dan penjaga 1 (harus tetap ada setelah akunnya dihapus)
  insert into audit_log (actor_id, action, payload) values (c_team1, 'uji_lama_tim', '{"k":1}'), (c_g1, 'uji_lama_guard', '{"k":2}');

  perform set_config('test.admin', v_admin::text, true);
end $t$;

-- A. Penolakan: bukan admin, dan status game selain setup. Semua kasus ini TIDAK boleh mengubah data.
do $t$
declare
  v_admin uuid := current_setting('test.admin')::uuid;
  s game_state;
begin
  -- bukan admin (tim, penjaga) → forbidden; pada status setup sekalipun
  perform pg_temp.set_state('setup');
  perform pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a2')$q$) = 'forbidden', 'tim biasa ditolak (hapus tim): forbidden');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_post('00000000-0000-4000-8000-0000000000b2')$q$) = 'forbidden', 'tim biasa ditolak (hapus pos): forbidden');
  perform pg_temp.as_user('00000000-0000-4000-8000-0000000000c1');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a2')$q$) = 'forbidden', 'penjaga ditolak (hapus tim): forbidden');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_post('00000000-0000-4000-8000-0000000000b1')$q$) = 'forbidden', 'penjaga ditolak (hapus pos): forbidden');
  perform pg_temp.as_user(gen_random_uuid());
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a2')$q$) = 'forbidden', 'tanpa profil ditolak: forbidden');

  -- admin pada tiap status selain setup → game_not_setup, data tetap
  perform pg_temp.as_user(v_admin);
  foreach s in array array['open', 'paused', 'finished']::game_state[] loop
    perform pg_temp.set_state(s);
    perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a2')$q$) = 'game_not_setup', 'hapus tim ditolak saat ' || s || ': game_not_setup');
    perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_post('00000000-0000-4000-8000-0000000000b2')$q$) = 'game_not_setup', 'hapus pos ditolak saat ' || s || ': game_not_setup');
    perform pg_temp.ok(exists (select 1 from teams where id = '00000000-0000-4000-8000-0000000000a2')
                       and exists (select 1 from profiles where id = '00000000-0000-4000-8000-0000000000a2')
                       and exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000a2'),
                       'tim dan akunnya utuh setelah ditolak saat ' || s);
    perform pg_temp.ok(exists (select 1 from posts where id = '00000000-0000-4000-8000-0000000000b2')
                       and exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c2'),
                       'pos dan akun penjaganya utuh setelah ditolak saat ' || s);
  end loop;
  -- status dicek sebelum "tidak ditemukan": id acak saat open juga game_not_setup
  perform pg_temp.set_state('open');
  perform pg_temp.ok(pg_temp.err(format('select public.admin_delete_team(%L)', gen_random_uuid())) = 'game_not_setup', 'id tak dikenal saat open tetap game_not_setup');
  perform pg_temp.set_state('setup');
end $t$;

-- B. Hapus tim pada status setup.
do $t$
declare
  v_admin uuid := current_setting('test.admin')::uuid;
  v_n int;
begin
  perform pg_temp.set_state('setup');
  perform pg_temp.as_user(v_admin);

  perform pg_temp.ok(pg_temp.err('select public.admin_delete_team(null)') = 'invalid_input', 'id null: invalid_input');
  perform pg_temp.ok(pg_temp.err(format('select public.admin_delete_team(%L)', gen_random_uuid())) = 'team_not_found', 'id tak dikenal: team_not_found');
  perform pg_temp.ok(pg_temp.err(format('select public.admin_delete_team(%L)', v_admin)) = 'team_not_found', 'akun admin tidak bisa dihapus lewat fungsi ini: team_not_found');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000c1')$q$) = 'team_not_found', 'akun penjaga bukan tim: team_not_found');
  perform pg_temp.ok(exists (select 1 from profiles where id = v_admin) and exists (select 1 from auth.users where id = v_admin), 'akun admin utuh');

  -- tim bersih berhasil dihapus: tim, profil, dan akun Auth hilang
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a1')$q$) is null, 'tim bersih dihapus saat setup');
  perform pg_temp.ok(not exists (select 1 from teams where id = '00000000-0000-4000-8000-0000000000a1'), 'baris teams hilang');
  perform pg_temp.ok(not exists (select 1 from profiles where id = '00000000-0000-4000-8000-0000000000a1'), 'baris profiles hilang');
  perform pg_temp.ok(not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000a1'), 'akun auth.users hilang');
  perform pg_temp.ok(exists (select 1 from teams where id = '00000000-0000-4000-8000-0000000000a2'), 'tim lain tidak tersentuh');

  -- audit: satu baris delete_team oleh admin; baris lama tetap ada, pelakunya dilepas dan identitasnya tersimpan
  perform pg_temp.ok(exists (select 1 from audit_log where action = 'delete_team' and actor_id = v_admin
                              and payload->>'team_id' = '00000000-0000-4000-8000-0000000000a1'
                              and payload->>'name' = 'Tim Uji 1' and payload->>'username' = 'ujitim1'
                              and (payload->>'audit_rows_detached')::int = 1), 'audit delete_team tercatat (nama, username, 1 baris dilepas)');
  select count(*) into v_n from audit_log where action = 'uji_lama_tim' and actor_id is null
     and payload->'actor_deleted'->>'id' = '00000000-0000-4000-8000-0000000000a1' and payload->>'k' = '1';
  perform pg_temp.ok(v_n = 1, 'baris audit lama tetap ada: actor_id NULL, payload.actor_deleted berisi identitas, isi lama utuh');

  -- dihapus dua kali → tidak ditemukan
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a1')$q$) = 'team_not_found', 'hapus ulang: team_not_found');

  -- diblokir bila ada saldo atau riwayat; tidak ada yang berubah
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a3')$q$) = 'team_has_activity', 'tim bersaldo diblokir');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a4')$q$) = 'team_has_activity', 'tim berkepemilikan diblokir');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a5')$q$) = 'team_has_activity', 'tim penerima hadiah diblokir');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a6')$q$) = 'team_has_activity', 'tim bertransaksi diblokir');
  if exists (select 1 from analysis_purchases where team_id = '00000000-0000-4000-8000-0000000000a7') then
    perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a7')$q$) = 'team_has_activity', 'tim pembeli analisa diblokir');
  else
    raise notice 'LEWAT tim pembeli analisa (tidak ada berita di database ini untuk fixture)';
  end if;
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a8')$q$) = 'team_has_activity', 'tim penerima dividen diblokir');
  perform pg_temp.ok((select count(*) from teams where id in (
      '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a5',
      '00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-0000000000a8')) = 5, 'tim yang diblokir tetap ada');
  perform pg_temp.ok((select count(*) from auth.users where id in (
      '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a5')) = 3, 'akun tim yang diblokir tetap ada');
  perform pg_temp.ok((select qty from holdings where team_id = '00000000-0000-4000-8000-0000000000a4') = 3, 'kepemilikan tim yang diblokir tetap');

  -- setelah saldo dinolkan (mis. lewat Koreksi saldo / Reset game), tim itu bisa dihapus
  update teams set cash = 0 where id = '00000000-0000-4000-8000-0000000000a3';
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a3')$q$) is null, 'tim dengan saldo 0 bisa dihapus');
  -- baris holdings qty 0 ikut dibersihkan, bukan penghalang
  update holdings set qty = 0, cost_basis = 0 where team_id = '00000000-0000-4000-8000-0000000000a4';
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_team('00000000-0000-4000-8000-0000000000a4')$q$) is null, 'baris holdings qty 0 tidak menghalangi dan ikut hilang');
  perform pg_temp.ok(not exists (select 1 from holdings where team_id = '00000000-0000-4000-8000-0000000000a4'), 'holdings tim terhapus bersih');
end $t$;

-- C. Hapus pos pada status setup.
do $t$
declare
  v_admin uuid := current_setting('test.admin')::uuid;
begin
  perform pg_temp.set_state('setup');
  perform pg_temp.as_user(v_admin);

  perform pg_temp.ok(pg_temp.err('select public.admin_delete_post(null)') = 'invalid_input', 'id pos null: invalid_input');
  perform pg_temp.ok(pg_temp.err(format('select public.admin_delete_post(%L)', gen_random_uuid())) = 'post_not_found', 'id pos tak dikenal: post_not_found');

  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_post('00000000-0000-4000-8000-0000000000b1')$q$) is null, 'pos bersih dihapus saat setup');
  perform pg_temp.ok(not exists (select 1 from posts where id = '00000000-0000-4000-8000-0000000000b1'), 'baris posts hilang');
  perform pg_temp.ok(not exists (select 1 from profiles where id = '00000000-0000-4000-8000-0000000000c1'), 'profil penjaga hilang');
  perform pg_temp.ok(not exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c1'), 'akun auth penjaga hilang');
  perform pg_temp.ok(exists (select 1 from posts where id = '00000000-0000-4000-8000-0000000000b2')
                     and exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c2'), 'pos dan penjaga lain tidak tersentuh');
  perform pg_temp.ok(exists (select 1 from audit_log where action = 'delete_post' and actor_id = v_admin
                              and payload->>'post_id' = '00000000-0000-4000-8000-0000000000b1'
                              and payload->>'guard_username' = 'ujiguard1' and (payload->>'guard_deleted')::boolean
                              and (payload->>'audit_rows_detached')::int = 1), 'audit delete_post tercatat (penjaga ikut dihapus, 1 baris dilepas)');
  perform pg_temp.ok(exists (select 1 from audit_log where action = 'uji_lama_guard' and actor_id is null
                              and payload->'actor_deleted'->>'username' = 'ujiguard1' and payload->>'k' = '2'), 'baris audit lama penjaga tetap ada dan identitasnya tersimpan');
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_post('00000000-0000-4000-8000-0000000000b1')$q$) = 'post_not_found', 'hapus ulang: post_not_found');

  -- pos yang pernah memberi hadiah diblokir; semuanya utuh
  perform pg_temp.ok(pg_temp.err($q$select public.admin_delete_post('00000000-0000-4000-8000-0000000000b3')$q$) = 'post_has_payouts', 'pos berhadiah diblokir');
  perform pg_temp.ok(exists (select 1 from posts where id = '00000000-0000-4000-8000-0000000000b3')
                     and exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000000c3')
                     and exists (select 1 from payouts where post_id = '00000000-0000-4000-8000-0000000000b3'), 'pos berhadiah, penjaga, dan hadiahnya utuh');
end $t$;

-- D. Sebagai peran Postgres `authenticated` (hak eksekusi dan RLS sungguhan); `anon` tidak boleh memanggil.
do $t$ begin
  perform pg_temp.set_state('setup');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.admin_delete_team(uuid)', 'execute')
                     and not has_function_privilege('anon', 'public.admin_delete_post(uuid)', 'execute'), 'anon tidak punya hak execute');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.admin_delete_team(uuid)', 'execute')
                     and has_function_privilege('authenticated', 'public.admin_delete_post(uuid)', 'execute'), 'authenticated punya hak execute');
end $t$;
set local role authenticated;
do $t$
declare
  v_admin uuid := current_setting('test.admin')::uuid;
  e text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform public.admin_delete_team('00000000-0000-4000-8000-0000000000a2');
  perform public.admin_delete_post('00000000-0000-4000-8000-0000000000b2');
  raise notice 'OK    admin (peran authenticated) menghapus tim dan pos saat setup';
  -- ditolak lagi untuk non-admin pada peran yang sama
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a5', 'role', 'authenticated')::text, true);
  begin
    perform public.admin_delete_team('00000000-0000-4000-8000-0000000000a5');
    raise exception 'GAGAL: tim seharusnya ditolak';
  exception when others then
    get stacked diagnostics e = message_text;
    if e <> 'forbidden' then raise; end if;
    raise notice 'OK    tim (peran authenticated) ditolak: forbidden';
  end;
end $t$;
reset role;
do $t$ begin
  perform pg_temp.ok(not exists (select 1 from teams where id = '00000000-0000-4000-8000-0000000000a2')
                     and not exists (select 1 from posts where id = '00000000-0000-4000-8000-0000000000b2'), 'hasil penghapusan oleh authenticated tercatat');
end $t$;

rollback;
