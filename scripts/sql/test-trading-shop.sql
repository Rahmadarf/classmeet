-- Tes SQL trading model toko (docs/17). Berjalan di dalam transaksi yang di-ROLLBACK: tidak mengubah data.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-trading-shop.sql
-- Syarat: database sudah memuat scripts/sql/trading-shop.sql, game berstatus `open`, ada tim dan aset aktif.
begin;
set client_min_messages = notice;

create function pg_temp.sys() returns void language sql as $$ select set_config('classmeet.system', 'on', true) $$;
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
  v_team  uuid;  v_admin uuid;
  a       public.assets;  a2 public.assets;
  g       public.game_settings;
  tx      public.transactions;  tx2 public.transactions;
  c0 bigint; c1 bigint; h0 int; h1 int; s0 int; s1 int; f0 int; f1 int; lp0 bigint; lp1 bigint; cb0 bigint; cb1 bigint;
  v_cap int; v_n int; v_inv0 int; v_inv1 int; v_liq bigint;
  r record;
begin
  select * into g from game_settings;
  perform pg_temp.ok(g.state = 'open', 'game berstatus open (syarat tes)');
  select id into v_team from teams order by name limit 1;
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform pg_temp.sys();
  update teams set cash = 50000000 where id = v_team;
  delete from holdings where team_id = v_team;

  -- aset uji: aktif, stok >= 20, tanpa suspensi, harga tayang = acuan, faktor 0
  select * into a from assets where is_active and stock >= 20 and suspended_until is null and init_stock >= 30 order by symbol limit 1;
  perform pg_temp.ok(a.id is not null, 'ada aset uji ' || a.symbol);
  update assets set price_factor_bps = 0 where id = a.id;
  select * into a from assets where id = a.id;
  perform pg_temp.ok(a.last_price = public.shop_price(a.price, 0, a.min_price, a.max_price), 'harga tayang = acuan saat faktor 0');
  perform pg_temp.ok(a.rank_price = a.last_price, 'rank_price mengikuti harga tayang');
  v_inv0 := a.stock + coalesce((select sum(qty) from holdings where asset_id = a.id), 0);

  perform pg_temp.as_user(v_team);

  -- 1. beli
  select cash into c0 from teams where id = v_team; s0 := a.stock; f0 := a.price_factor_bps; lp0 := a.last_price;
  tx := public.buy_asset(gen_random_uuid(), a.id, 2);
  perform pg_temp.sys();
  select * into a from assets where id = a.id;
  select cash into c1 from teams where id = v_team;
  perform pg_temp.ok(tx.side = 'buy' and tx.qty = 2 and tx.list_price = lp0
                      and tx.total = lp0 + public.shop_price(a.price, f0 + g.pressure_bps_per_unit, a.min_price, a.max_price)
                      and tx.unit_price = round(tx.total / 2.0), 'beli 2: unit pertama harga tayang, unit kedua naik satu langkah tekanan, unit_price = rata-rata');
  perform pg_temp.ok(c0 - c1 = tx.total, 'beli: saldo turun sebesar total');
  perform pg_temp.ok((select qty from holdings where team_id = v_team and asset_id = a.id) = 2, 'beli: kepemilikan 2');
  perform pg_temp.ok((select cost_basis from holdings where team_id = v_team and asset_id = a.id) = tx.total, 'beli: cost_basis = total');
  perform pg_temp.ok(a.stock = s0 - 2, 'beli: stok pasar turun 2');
  perform pg_temp.ok(a.price_factor_bps = f0 + 2 * g.pressure_bps_per_unit, 'beli: tekanan naik 2 x 0,2 %');
  perform pg_temp.ok(a.last_price > lp0 and a.last_price = public.shop_price(a.price, a.price_factor_bps, a.min_price, a.max_price), 'beli: harga tayang naik mengikuti tekanan');

  -- 2. idempoten dan konflik
  perform pg_temp.as_user(v_team);
  tx2 := public.buy_asset(tx.request_id, a.id, 2);
  perform pg_temp.sys();
  perform pg_temp.ok(tx2.id = tx.id and (select cash from teams where id = v_team) = c1, 'request_id sama: hasil sama, saldo tidak berubah');
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(%L, %L, 3)', tx.request_id, a.id), 'request_id_conflict');

  -- 3. jual
  perform pg_temp.sys();
  select * into a from assets where id = a.id; lp0 := a.last_price; f0 := a.price_factor_bps; s0 := a.stock;
  select cash into c0 from teams where id = v_team;
  select cost_basis into cb0 from holdings where team_id = v_team and asset_id = a.id;
  perform pg_temp.as_user(v_team);
  tx := public.sell_asset(gen_random_uuid(), a.id, 1);
  perform pg_temp.sys();
  select * into a from assets where id = a.id;
  select cash into c1 from teams where id = v_team;
  select cost_basis into cb1 from holdings where team_id = v_team and asset_id = a.id;
  perform pg_temp.ok(tx.side = 'sell' and tx.list_price = lp0 and tx.unit_price = public.shop_sell_price(lp0), 'jual: harga = tayang dikurangi selisih');
  perform pg_temp.ok(tx.unit_price < tx.list_price and tx.unit_price >= floor(lp0 * 0.98 / g.price_step) * g.price_step - g.price_step, 'jual: selisih sekitar 2 %');
  perform pg_temp.ok(c1 - c0 = tx.total, 'jual: saldo naik sebesar total');
  perform pg_temp.ok((select qty from holdings where team_id = v_team and asset_id = a.id) = 1, 'jual: kepemilikan 1');
  perform pg_temp.ok(cb1 = cb0 - (cb0::numeric * 1 / 2)::bigint, 'jual: cost_basis berkurang proporsional');
  perform pg_temp.ok(a.stock = s0 + 1 and a.price_factor_bps = f0 - g.pressure_bps_per_unit, 'jual: stok kembali dan tekanan turun');
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.sell_asset(gen_random_uuid(), %L, 5)', a.id), 'insufficient_holdings');

  -- 4. invarian stok + kepemilikan
  perform pg_temp.sys();
  v_inv1 := a.stock + coalesce((select sum(qty) from holdings where asset_id = a.id), 0);
  perform pg_temp.ok(v_inv1 = v_inv0, 'invarian: stok + total kepemilikan tetap');

  -- 5. batas pegang (30 % stok awal)
  select * into a2 from assets where is_active and init_stock = 10 and suspended_until is null and stock >= 5 order by symbol limit 1;
  if a2.id is not null then
    perform pg_temp.sys();
    v_cap := greatest(1, floor(a2.init_stock * g.hold_cap_pct / 100.0)::int);
    perform pg_temp.as_user(v_team);
    perform public.buy_asset(gen_random_uuid(), a2.id, v_cap);
    perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', a2.id), 'hold_cap_exceeded');
    perform pg_temp.ok(true, format('batas pegang %s unit untuk %s (stok awal 10)', v_cap, a2.symbol));
  end if;

  -- 6. stok habis
  perform pg_temp.sys();
  select * into a2 from assets where is_active and id <> a.id and init_stock >= 30 and suspended_until is null order by symbol desc limit 1;
  update assets set stock = 1 where id = a2.id;
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 2)', a2.id), 'insufficient_stock');

  -- 7. saldo kurang
  perform pg_temp.sys();
  update teams set cash = 10 where id = v_team;
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', a.id), 'insufficient_cash');
  perform pg_temp.sys();
  update teams set cash = 50000000 where id = v_team;

  -- 8. suspensi
  update assets set suspended_until = now() + interval '10 minutes' where id = a.id;
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', a.id), 'asset_suspended');
  perform pg_temp.expect_err(format('select public.sell_asset(gen_random_uuid(), %L, 1)', a.id), 'asset_suspended');
  perform pg_temp.sys();
  update assets set suspended_until = null where id = a.id;

  -- 9. pasar tidak open
  update game_settings set state = 'paused' where true;
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', a.id), 'market_closed');
  perform pg_temp.expect_err(format('select public.sell_asset(gen_random_uuid(), %L, 1)', a.id), 'market_closed');
  perform pg_temp.sys();
  update game_settings set state = 'open' where true;

  -- 10. peran
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', a.id), 'forbidden');
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.expect_err(format('select public.sell_asset(gen_random_uuid(), %L, 1)', a.id), 'forbidden');
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 0)', a.id), 'invalid_input');
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', gen_random_uuid()), 'asset_not_found');

  -- 11. tekanan dibatasi dan pulih
  perform pg_temp.sys();
  update assets set price_factor_bps = g.pressure_cap_bps - 10, stock = 30 where id = a.id;
  perform pg_temp.as_user(v_team);
  perform public.buy_asset(gen_random_uuid(), a.id, 3);
  perform pg_temp.sys();
  select * into a from assets where id = a.id;
  perform pg_temp.ok(a.price_factor_bps = g.pressure_cap_bps, 'tekanan tidak melewati batas ' || g.pressure_cap_bps);
  perform pg_temp.ok(a.last_price <= a.price * 1.15 + g.price_step, 'harga tayang tidak lewat +15 % dari acuan');
  update shop_clock set pressure_at = now() - interval '30 seconds' where true;
  perform public.process_market_cycle();
  select price_factor_bps into f1 from assets where id = a.id;
  perform pg_temp.ok(f1 = g.pressure_cap_bps - ceil(g.pressure_cap_bps * 30 / (g.pressure_decay_minutes * 60.0))::int, 'siklus pasar: tekanan turun linear (' || f1 || ')');
  perform pg_temp.sys();
  update assets set price_factor_bps = -20 where id = a.id;
  update shop_clock set pressure_at = now() - interval '30 seconds' where true;
  perform public.process_market_cycle();
  perform pg_temp.ok((select price_factor_bps from assets where id = a.id) = 0, 'siklus pasar: tekanan negatif kembali ke 0 tanpa melewati');

  -- 12. harga tayang mengikuti berita (harga acuan berubah)
  perform pg_temp.sys();
  update assets set price = least(max_price, price + 5000), price_factor_bps = 100 where id = a.id;
  select * into a from assets where id = a.id;
  perform pg_temp.ok(a.last_price = public.shop_price(a.price, 100, a.min_price, a.max_price) and a.rank_price = a.last_price, 'perubahan acuan/faktor memperbarui harga tayang dan rank_price');

  -- 13. suspend dan bangkrut tanpa order book
  perform pg_temp.sys();
  perform public.suspend_asset(a.id, 5, null);
  perform pg_temp.ok((select suspended_until from assets where id = a.id) > now(), 'suspend_asset berjalan tanpa order book');
  update assets set suspended_until = null where id = a.id;
  select cash into c0 from teams where id = v_team;
  select qty into h0 from holdings where team_id = v_team and asset_id = a.id;
  perform public.bankrupt_asset(a.id, 1000, null);
  perform pg_temp.sys();
  select * into a from assets where id = a.id;
  select cash into c1 from teams where id = v_team;
  perform pg_temp.ok(not a.is_active and a.liquidation_price is not null, 'bankrupt_asset: aset nonaktif');
  perform pg_temp.ok(c1 - c0 = h0 * a.liquidation_price and (select qty from holdings where team_id = v_team and asset_id = a.id) = 0, 'bankrupt_asset: kepemilikan dilikuidasi ke saldo');
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err(format('select public.buy_asset(gen_random_uuid(), %L, 1)', a.id), 'asset_not_found');

  -- 14. ringkasan pasar, status pasar mesin berita
  perform pg_temp.as_user(v_team);
  select count(*) into v_n from public.get_market_summary();
  perform pg_temp.ok(v_n > 0, 'get_market_summary mengembalikan ' || v_n || ' aset');
  perform pg_temp.ok((select freq from public.get_market_summary() where symbol = a2.symbol) >= 0, 'get_market_summary membaca transactions');
  perform pg_temp.sys();
  select count(*) into v_n from public.market_state();
  perform pg_temp.ok(v_n > 0 and (select max(trades_10m) from public.market_state()) >= 1, 'market_state menghitung trades_10m dari transactions');
  perform pg_temp.ok((select sum(h.qty * coalesce(x.rank_price, x.price)) from holdings h join assets x on x.id = h.asset_id where h.team_id = v_team) is not null, 'nilai aset memakai harga tayang');

  -- 14b. RPC admin/display untuk transaksi
  perform pg_temp.as_user(v_admin);
  perform pg_temp.ok((select coalesce(sum(n), 0) from public.admin_transaction_summary()) >= 1, 'admin_transaction_summary menghitung transaksi');
  perform pg_temp.ok((select count(*) from public.get_last_transactions(5)) >= 1, 'get_last_transactions (admin) mengembalikan transaksi terbaru');
  perform pg_temp.as_user((select id from profiles where role = 'display' limit 1));
  perform pg_temp.ok((select count(*) from public.get_last_transactions(5)) >= 1, 'get_last_transactions (display) tanpa nama tim');
  perform pg_temp.expect_err('select * from public.admin_transaction_summary()', 'forbidden');
  perform pg_temp.as_user(v_team);
  perform pg_temp.expect_err('select * from public.get_last_transactions(5)', 'forbidden');

  -- 15. nilai tim dan pengaturan
  perform pg_temp.as_user(v_team);
  perform pg_temp.ok((select net_worth from public.get_my_summary()) > 0, 'get_my_summary berjalan');
  perform set_config('classmeet.system', 'off', true);
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err('select public.admin_set_trade_settings(300, 20, 1500, 10, 30)', 'game_started_locked');
end $t$;

-- tulis langsung ke transactions oleh klien harus ditolak
do $t2$
begin
  set local role authenticated;
  begin
    insert into public.transactions (request_id, team_id, asset_id, side, qty, unit_price, list_price, total)
    select gen_random_uuid(), (select id from public.teams limit 1), (select id from public.assets limit 1), 'buy', 1, 1, 1, 1;
    raise exception 'GAGAL: klien bisa menulis transactions';
  exception when insufficient_privilege then
    raise notice 'OK    klien tidak bisa menulis transactions';
  end;
  reset role;
end $t2$;

-- Tekanan harga DI DALAM transaksi (scripts/sql/trading-impact.sql): bolak-balik beli lalu jual tidak boleh menguntungkan
do $t3$
declare
  v_team uuid; g public.game_settings; a public.assets; n int; cap int; c0 bigint; c1 bigint; loss bigint; paid bigint;
  tx public.transactions; tx2 public.transactions; k int; round_no int; worst numeric := 0; checks int := 0;
begin
  select * into g from game_settings;
  select id into v_team from teams order by name limit 1;
  perform pg_temp.sys();
  update teams set cash = 1000000000 where id = v_team;
  delete from holdings where team_id = v_team;
  k := g.pressure_bps_per_unit;
  for a in select * from assets where is_active and suspended_until is null and init_stock >= 30 order by symbol limit 6 loop
    update assets set price_factor_bps = 0 where id = a.id;
    select * into a from assets where id = a.id;
    cap := greatest(1, floor(a.init_stock * g.hold_cap_pct / 100.0)::int);
    foreach n in array array[1, 2, 5, 10, 20, cap] loop
      if n > cap or n > a.stock then continue; end if;
      perform pg_temp.sys();
      select * into a from assets where id = a.id;
      select cash into c0 from teams where id = v_team;
      perform pg_temp.as_user(v_team);
      tx := public.buy_asset(gen_random_uuid(), a.id, n);
      tx2 := public.sell_asset(gen_random_uuid(), a.id, n);
      perform pg_temp.sys();
      select cash into c1 from teams where id = v_team;
      loss := c0 - c1; paid := tx.total;
      perform pg_temp.ok(loss > 0, format('%s bolak-balik %s unit: selalu rugi (rugi %s)', a.symbol, n, loss));
      perform pg_temp.ok(loss * 10000 >= paid * 150, format('%s bolak-balik %s unit: rugi >= 1,5 %% dari yang dibayar (%s dari %s)', a.symbol, n, loss, paid));
      worst := greatest(worst, 0);
      checks := checks + 1;
      perform set_config('classmeet.system', 'on', true);
      update assets set price_factor_bps = 0 where id = a.id;
    end loop;
    -- diulang beberapa kali pada tekanan penuh: kerugian terus bertambah, tidak ada yang bisa "diperah"
    select * into a from assets where id = a.id;
    select cash into c0 from teams where id = v_team;
    for round_no in 1..3 loop
      perform pg_temp.as_user(v_team);
      perform public.buy_asset(gen_random_uuid(), a.id, least(cap, a.stock));
      perform public.sell_asset(gen_random_uuid(), a.id, least(cap, a.stock));
    end loop;
    perform pg_temp.sys();
    select cash into c1 from teams where id = v_team;
    perform pg_temp.ok(c1 < c0, format('%s: 3 putaran beli-jual penuh tetap rugi (%s)', a.symbol, c0 - c1));
    update assets set price_factor_bps = 0 where id = a.id;
  end loop;
  perform pg_temp.ok(checks >= 20, format('cukup banyak kombinasi aset x jumlah diuji (%s)', checks));

  -- jual n unit menerima jumlah menurun per unit; beli n unit membayar jumlah naik per unit
  select * into a from assets where is_active and suspended_until is null and init_stock >= 30 order by symbol limit 1;
  update assets set price_factor_bps = 0 where id = a.id;
  select * into a from assets where id = a.id;
  perform pg_temp.as_user(v_team);
  tx := public.buy_asset(gen_random_uuid(), a.id, 5);
  perform pg_temp.sys();
  perform pg_temp.ok(tx.total = (select sum(public.shop_price(a.price, i * k, a.min_price, a.max_price)) from generate_series(0, 4) i),
                     'beli 5: total = jumlah harga tiap unit pada tingkat tekanan naik satu langkah per unit');
  perform pg_temp.ok(tx.total > 5 * tx.list_price, 'beli 5: total lebih mahal daripada 5 x harga tayang awal');
  select * into a from assets where id = a.id;
  perform pg_temp.as_user(v_team);
  tx2 := public.sell_asset(gen_random_uuid(), a.id, 5);
  perform pg_temp.sys();
  perform pg_temp.ok(tx2.total = (select sum(public.shop_sell_price(public.shop_price(a.price, a.price_factor_bps - j * k, a.min_price, a.max_price)))
                                   from generate_series(0, 4) j),
                     'jual 5: total = jumlah harga jual tiap unit pada tingkat tekanan turun satu langkah per unit');

  -- pengaturan: selisih jual harus lebih besar dari tekanan per unit
  perform set_config('classmeet.system', 'off', true);
  perform pg_temp.as_user((select id from profiles where role = 'admin' limit 1));
  perform pg_temp.expect_err(format('select public.admin_set_trade_settings(%s, %s, 1500, 10, 30)', k, k), 'invalid_input');
  perform pg_temp.expect_err('select public.admin_set_trade_settings(10, 20, 1500, 10, 30)', 'invalid_input');
  perform pg_temp.sys();
  begin
    update game_settings set sell_spread_bps = 10 where true;
    raise exception 'GAGAL: constraint selisih > tekanan tidak berlaku';
  exception when check_violation then
    raise notice 'OK    constraint basis data: selisih jual harus > tekanan per unit';
  end;
end $t3$;

rollback;
