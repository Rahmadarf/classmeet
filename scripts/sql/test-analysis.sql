-- Tes SQL Analisa Pasar (pay to win). Berjalan di dalam transaksi yang di-ROLLBACK: tidak mengubah data.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-analysis.sql
-- Syarat: sudah memuat analysis.sql dan game-reset.sql; ada >= 3 tim, 1 admin, dan berita berstatus `ready`.
begin;
set client_min_messages = notice;

create function pg_temp.sys() returns void language sql as $$ select set_config('classmeet.system', 'on', true) $$;
create function pg_temp.nosys() returns void language sql as $$ select set_config('classmeet.system', 'off', true) $$;
create function pg_temp.as_user(p uuid) returns void language sql as
$$ select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as
$$ begin if c then raise notice 'OK    %', msg; else raise exception 'GAGAL: %', msg; end if; end $$;
create function pg_temp.expect_err(p_sql text, p_code text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_code then raise notice 'OK    galat % sesuai', p_code; return; end if;
    raise exception 'GAGAL: diharapkan galat %, dapat % (%)', p_code, sqlerrm, p_sql;
  end;
  raise exception 'GAGAL: diharapkan galat %, tetapi berhasil (%)', p_code, p_sql;
end $$;

do $t$
declare
  t1 uuid; t2 uuid; t3 uuid; v_admin uuid; v_display uuid;
  n public.news; n2 public.news;
  g public.game_settings;
  p public.analysis_purchases; p2 public.analysis_purchases; p3 public.analysis_purchases;
  o record;
  c0 bigint; c1 bigint; v_cnt int;
begin
  select id into t1 from teams order by name limit 1;
  select id into t2 from teams order by name offset 1 limit 1;
  select id into t3 from teams order by name offset 2 limit 1;
  select id into v_admin from profiles where role = 'admin' limit 1;
  select id into v_display from profiles where role = 'display' limit 1;

  perform pg_temp.sys();
  update game_settings set state = 'open', started_at = now(), analysis_price = 200000, analysis_enabled = true where true;
  update teams set cash = 1000000 where id in (t1, t2);
  update teams set cash = 50000 where id = t3;                      -- saldo kurang
  select * into g from game_settings;

  -- berita live uji (efek 10 menit lagi) + laporan
  update news set status = 'ready', published_at = null, effect_at = null, effect_applied_at = null where status = 'live';
  select * into n from news where status = 'ready' order by id limit 1;
  update news set status = 'live', published_at = now(), effect_at = now() + interval '9 minutes 30 seconds' where id = n.id;
  insert into news_analysis (news_id, paragraphs) values (n.id,
    array['Efek berlaku {waktu} lagi.', 'Ciri naik.', 'Ciri turun.', 'Catatan.'])
  on conflict (news_id) do update set paragraphs = excluded.paragraphs;

  -- 0. penawaran dan peran
  perform pg_temp.as_user(t1);
  select * into o from public.get_analysis_offer();
  perform pg_temp.ok(o.can_buy and o.reason = 'ok' and o.price = 200000 and not o.owned and o.news_title = n.title, 'tawaran: bisa beli, harga 200.000, belum dimiliki');
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'forbidden');
  perform pg_temp.expect_err('select * from public.get_analysis_offer()', 'forbidden');
  perform pg_temp.expect_err('select * from public.get_my_analyses()', 'forbidden');
  perform pg_temp.as_user(v_display);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'forbidden');
  perform pg_temp.as_user(t1);
  perform pg_temp.expect_err('select * from public.buy_analysis(null)', 'invalid_input');
  perform pg_temp.expect_err('select public.admin_set_analysis_settings(1, true)', 'forbidden');
  perform pg_temp.expect_err('select * from public.admin_analysis_log()', 'forbidden');

  -- 1. beli
  perform pg_temp.as_user(t1);
  select cash into c0 from teams where id = t1;
  p := public.buy_analysis(gen_random_uuid());
  select cash into c1 from teams where id = t1;
  perform pg_temp.ok(c0 - c1 = 200000 and p.price = 200000 and p.team_id = t1 and p.news_id = n.id, 'beli: saldo turun 200.000, baris tersimpan');
  perform pg_temp.ok(cardinality(p.paragraphs) = 4 and p.paragraphs[1] not like '%{waktu}%' and p.paragraphs[1] like 'Efek berlaku sekitar 9 sampai 11 menit lagi.', 'beli: 4 paragraf, {waktu} diganti rentang 2 menit (sisa 9 mnt 30 dtk -> 9 sampai 11)');
  perform pg_temp.ok(p.news_title = n.title, 'beli: judul berita tersimpan');

  -- 2. idempoten, konflik, sudah dimiliki
  p2 := public.buy_analysis(p.request_id);
  perform pg_temp.ok(p2.id = p.id and (select cash from teams where id = t1) = c1, 'request_id sama: hasil sama, saldo tidak berubah');
  p2 := public.buy_analysis(gen_random_uuid());
  perform pg_temp.ok(p2.id = p.id and (select cash from teams where id = t1) = c1, 'beli lagi berita yang sama: laporan lama, tanpa biaya');
  perform pg_temp.as_user(t2);
  perform pg_temp.expect_err(format('select * from public.buy_analysis(%L)', p.request_id), 'request_id_conflict');
  perform pg_temp.as_user(t1);
  select * into o from public.get_analysis_offer();
  perform pg_temp.ok(o.owned and o.can_buy and o.reason = 'ok', 'tawaran: ditandai sudah dimiliki');
  perform pg_temp.ok((select count(*) from public.get_my_analyses()) = 1, 'get_my_analyses: 1 laporan');

  -- 3. tim lain, saldo kurang
  perform pg_temp.as_user(t3);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'insufficient_cash');
  perform pg_temp.ok((select cash from teams where id = t3) = 50000, 'saldo kurang: saldo tidak berubah');
  perform pg_temp.ok(not exists (select 1 from analysis_purchases where team_id = t3), 'saldo kurang: tidak ada pembelian');

  -- 4. harga diubah admin: berlaku untuk pembelian berikutnya (game sudah dimulai tetap boleh)
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err('select public.admin_set_analysis_settings(-1, true)', 'invalid_input');
  perform pg_temp.expect_err('select public.admin_set_analysis_settings(200000001, true)', 'invalid_input');
  perform pg_temp.expect_err('select public.admin_set_analysis_settings(1000, null)', 'invalid_input');
  perform public.admin_set_analysis_settings(75000, true);
  perform pg_temp.ok((select analysis_price from game_settings) = 75000, 'admin: harga diubah saat game berjalan');
  perform pg_temp.ok(exists (select 1 from audit_log where action = 'set_analysis_settings' and (payload->>'price')::bigint = 75000), 'admin: tercatat di audit');
  perform pg_temp.ok((select analysis_price from game_settings) = 75000 and (select price from analysis_purchases where team_id = t1 and news_id = n.id) = 200000, 'harga lama pembeli sebelumnya tidak berubah');
  perform pg_temp.sys();
  update teams set cash = 100000 where id = t3;
  perform pg_temp.as_user(t3);
  p3 := public.buy_analysis(gen_random_uuid());
  perform pg_temp.ok(p3.price = 75000 and (select cash from teams where id = t3) = 25000, 'harga baru 75.000 dipakai, saldo 100.000 -> 25.000');

  -- 5. keadaan yang menolak
  perform pg_temp.sys();
  update game_settings set state = 'paused' where true;
  perform pg_temp.as_user(t2);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'market_closed');
  perform pg_temp.ok((select reason from public.get_analysis_offer()) = 'market_closed', 'tawaran: pasar tutup');
  perform pg_temp.sys();
  update game_settings set state = 'open' where true;

  perform pg_temp.as_user(v_admin);
  perform public.admin_set_analysis_settings(75000, false);
  perform pg_temp.as_user(t2);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'feature_disabled');
  perform pg_temp.ok((select reason from public.get_analysis_offer()) = 'feature_disabled', 'tawaran: fitur dimatikan');
  perform pg_temp.as_user(v_admin);
  perform public.admin_set_analysis_settings(75000, true);

  perform pg_temp.sys();
  update news set status = 'ready', published_at = null, effect_at = null where id = n.id;
  perform pg_temp.as_user(t2);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'no_live_news');
  perform pg_temp.ok((select reason from public.get_analysis_offer()) = 'no_live_news', 'tawaran: tidak ada berita tayang');
  perform pg_temp.sys();
  update news set status = 'live', published_at = now(), effect_at = now() + interval '20 seconds' where id = n.id;
  perform pg_temp.as_user(t2);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'window_closed');
  perform pg_temp.ok((select reason from public.get_analysis_offer()) = 'window_closed', 'tawaran: jendela tertutup (sisa 20 dtk < 30 dtk)');
  perform pg_temp.as_user(t1);
  perform pg_temp.ok((public.buy_analysis(gen_random_uuid())).id = p.id and (select reason from public.get_analysis_offer()) = 'ok', 'pemilik tetap bisa melihat laporan walau jendela tertutup');
  perform pg_temp.sys();
  update news set effect_at = now() + interval '9 minutes 30 seconds' where id = n.id;
  delete from news_analysis where news_id = n.id;
  perform pg_temp.as_user(t2);
  perform pg_temp.expect_err('select * from public.buy_analysis(gen_random_uuid())', 'analysis_unavailable');
  perform pg_temp.ok((select reason from public.get_analysis_offer()) = 'analysis_unavailable', 'tawaran: laporan belum ada');
  perform pg_temp.ok((select cash from teams where id = t2) = 1000000, 'semua penolakan: saldo tidak berubah');
  perform pg_temp.sys();
  insert into news_analysis (news_id, paragraphs) values (n.id, array['Efek berlaku {waktu} lagi.', 'Ciri naik.', 'Ciri turun.', 'Catatan.']);

  -- 6. tim kedua membeli
  perform pg_temp.as_user(t2);
  p2 := public.buy_analysis(gen_random_uuid());
  perform pg_temp.ok(p2.price = 75000 and (select cash from teams where id = t2) = 925000 and p2.id <> p.id, 'tim kedua: beli 75.000, saldo 1.000.000 -> 925.000');

  -- 7. berita kedua dan harga 0
  perform pg_temp.sys();
  update news set status = 'ready', published_at = null, effect_at = null where id = n.id;
  select * into n2 from news where status = 'ready' and id <> n.id order by id limit 1;
  update news set status = 'live', published_at = now(), effect_at = now() + interval '4 minutes 30 seconds' where id = n2.id;
  insert into news_analysis (news_id, paragraphs) values (n2.id, array['Efek berlaku {waktu} lagi.', 'Ciri naik.', 'Ciri turun.', 'Catatan.'])
  on conflict (news_id) do update set paragraphs = excluded.paragraphs;
  perform pg_temp.as_user(v_admin);
  perform public.admin_set_analysis_settings(0, true);
  perform pg_temp.as_user(t1);
  select cash into c0 from teams where id = t1;
  p3 := public.buy_analysis(gen_random_uuid());
  perform pg_temp.ok(p3.news_id = n2.id and p3.price = 0 and (select cash from teams where id = t1) = c0, 'berita kedua, harga 0: beli gratis, saldo tetap');
  perform pg_temp.ok(p3.paragraphs[1] = 'Efek berlaku sekitar 4 sampai 6 menit lagi.', 'sisa 4 mnt 30 dtk -> "sekitar 4 sampai 6 menit"');
  perform pg_temp.ok((select count(*) from public.get_my_analyses()) = 2 and (select news_id from public.get_my_analyses(1)) = n2.id, 'get_my_analyses: 2 laporan, terbaru lebih dulu, batas jumlah berlaku');

  -- 8. log dan ringkasan admin (tanpa isi laporan)
  perform pg_temp.as_user(v_admin);
  perform pg_temp.ok((select count(*) from public.admin_analysis_log()) = 4, 'log admin: 4 pembelian');
  perform pg_temp.ok(not (select to_jsonb(l) ? 'paragraphs' from public.admin_analysis_log(1) l), 'log admin: tidak memuat isi laporan');
  perform pg_temp.ok((select purchases = 4 and buyers = 3 and revenue = 350000 from public.admin_analysis_summary()), 'ringkasan admin: 4 pembelian, 3 tim, pendapatan 350.000');
  perform pg_temp.as_user(t1);
  perform pg_temp.expect_err('select * from public.admin_analysis_summary()', 'forbidden');
end $t$;

-- RLS: klien membaca baris sendiri saja; admin tidak membaca isi; tidak ada tulis langsung
do $t2$
declare t1 uuid; t2 uuid; v_admin uuid; v_cnt int;
begin
  select id into t1 from teams order by name limit 1;
  select id into t2 from teams order by name offset 1 limit 1;
  select id into v_admin from profiles where role = 'admin' limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', t1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_cnt from public.analysis_purchases;
  if v_cnt <> 2 then raise exception 'GAGAL: tim 1 melihat % baris (harus 2, miliknya)', v_cnt; end if;
  raise notice 'OK    RLS: tim hanya melihat pembeliannya sendiri (2 baris)';
  select count(*) into v_cnt from public.analysis_purchases where team_id = t2;
  if v_cnt <> 0 then raise exception 'GAGAL: tim 1 melihat pembelian tim 2'; end if;
  raise notice 'OK    RLS: pembelian tim lain tidak terlihat';
  select count(*) into v_cnt from public.news_analysis;
  if v_cnt <> 0 then raise exception 'GAGAL: tim membaca news_analysis'; end if;
  raise notice 'OK    RLS: tim tidak membaca news_analysis';
  begin
    insert into public.analysis_purchases (request_id, team_id, news_id, news_title, price, paragraphs)
    select gen_random_uuid(), t1, (select id from public.news limit 1), 'x', 0, array['a','b','c','d'];
    raise exception 'GAGAL: klien bisa menulis analysis_purchases';
  exception when insufficient_privilege then
    raise notice 'OK    klien tidak bisa menulis analysis_purchases';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_cnt from public.analysis_purchases;
  if v_cnt <> 0 then raise exception 'GAGAL: admin membaca isi analysis_purchases (% baris)', v_cnt; end if;
  raise notice 'OK    RLS: admin tidak membaca analysis_purchases (isi laporan)';
  select count(*) into v_cnt from public.news_analysis;
  if v_cnt <> 0 then raise exception 'GAGAL: admin membaca news_analysis setelah game dibuka'; end if;
  raise notice 'OK    RLS: admin tidak membaca news_analysis setelah game dibuka';
  reset role;
end $t2$;

-- Reset game: pembelian dikosongkan, pengaturan dan teks laporan tetap
do $t3$
declare v_admin uuid; r jsonb; v_cnt int;
begin
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  r := public.admin_reset_game();
  select count(*) into v_cnt from public.analysis_purchases;
  if v_cnt <> 0 then raise exception 'GAGAL: reset tidak mengosongkan analysis_purchases'; end if;
  raise notice 'OK    reset game: pembelian analisa dikosongkan';
  if (select analysis_price from public.game_settings) <> 0 or (select count(*) from public.news_analysis) < 2 then
    raise exception 'GAGAL: reset mengubah pengaturan atau teks laporan';
  end if;
  raise notice 'OK    reset game: harga dan teks laporan tetap';
  if (select state from public.game_settings) <> 'setup' then raise exception 'GAGAL: status bukan setup'; end if;
  raise notice 'OK    reset game: status setup';
end $t3$;

rollback;
