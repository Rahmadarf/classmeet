-- Smoke test order book di Supabase asli (classmeet-staging).
-- Jalankan lewat SQL editor / execute_sql. Satu transaksi yang SELALU di-rollback (raise exception di akhir),
-- jadi tidak meninggalkan data. Hasil ada di pesan error "HASIL: {...}".
-- Harapan: kuotasi_bandar=10, A_market_beli_status=filled (A_terisi=3), A_jual_limit_status=open,
-- B_beli_limit_status=filled (B_terisi=2), B_lihat_orderbook_baris=10, admin_orderbook=forbidden,
-- anon_place=permission denied for function place_order, A_baca_order_B=0,
-- invarian_uang=true, invarian_unit=true, rank_sesuai_rumus=true, networth_pakai_rank=true
-- (rank_price terisi dan berbeda dari last_price bila volume < 5 lot).
do $$
declare
  adm uuid := gen_random_uuid(); ta uuid := gen_random_uuid(); tb uuid := gen_random_uuid();
  a1 uuid; r jsonb := '{}'::jsonb; o public.orders; v bigint; cnt int;
  tot_before bigint; tot_after bigint; stk int; hold int; init_s int; rp bigint; lp bigint; exp_rp numeric; nw_hv bigint; nw_exp bigint;
begin
  insert into auth.users(id) values (adm),(ta),(tb);
  insert into profiles(id,username,role,display_name) values
    (adm,'adm_t','admin','Admin'),(ta,'tim_a','team','Tim A'),(tb,'tim_b','team','Tim B');
  insert into teams(id,name,cash,short_code) values (ta,'Tim A',10000000,'AAAAAA'),(tb,'Tim B',10000000,'BBBBBB');
  insert into assets(symbol,name,sector,price,min_price,max_price,stock)
    values ('AP','Apple','Teknologi',700000,110000,800000,100) returning id into a1;

  perform set_config('request.jwt.claim.sub', adm::text, true);
  set local role authenticated;
  perform public.admin_set_game_state('open');
  reset role;
  select count(*) into cnt from orders where is_house and status in ('open','partial');
  r := r || jsonb_build_object('kuotasi_bandar', cnt);
  select sum(cash+locked_cash) into tot_before from teams;

  perform set_config('request.jwt.claim.sub', ta::text, true);
  set local role authenticated;
  select * into o from public.place_order(gen_random_uuid(), a1, 'buy', 'market', null, 3);
  r := r || jsonb_build_object('A_market_beli_status', o.status, 'A_terisi', o.qty-o.remaining);
  select * into o from public.place_order(gen_random_uuid(), a1, 'sell', 'limit', 710000, 2);
  r := r || jsonb_build_object('A_jual_limit_status', o.status);
  perform set_config('request.jwt.claim.sub', tb::text, true);
  select * into o from public.place_order(gen_random_uuid(), a1, 'buy', 'limit', 710000, 2);
  r := r || jsonb_build_object('B_beli_limit_status', o.status, 'B_terisi', o.qty-o.remaining);
  select count(*) into cnt from public.get_order_book(a1);
  r := r || jsonb_build_object('B_lihat_orderbook_baris', cnt);
  reset role;

  perform set_config('request.jwt.claim.sub', adm::text, true);
  set local role authenticated;
  begin perform * from public.get_order_book(a1); r := r || jsonb_build_object('admin_orderbook','BOCOR');
  exception when others then r := r || jsonb_build_object('admin_orderbook', sqlerrm); end;
  reset role; set local role anon;
  begin perform public.place_order(gen_random_uuid(), a1, 'buy','market',null,1); r := r || jsonb_build_object('anon_place','BOCOR');
  exception when others then r := r || jsonb_build_object('anon_place', sqlerrm); end;
  reset role;
  perform set_config('request.jwt.claim.sub', ta::text, true);
  set local role authenticated;
  select count(*) into cnt from orders where team_id = tb;
  r := r || jsonb_build_object('A_baca_order_B', cnt);
  reset role;

  -- harga peringkat (VWAP 10 menit + pengisi 5 lot) dan net worth
  select rank_price, last_price into rp, lp from assets where id = a1;
  select round((sum(price*qty)::numeric + 700000*greatest(5-sum(qty),0))/greatest(sum(qty),5)) into exp_rp
    from trades where asset_id = a1 and created_at >= now() - interval '10 minutes';
  select holdings_value into nw_hv from v_team_net_worth where team_id = ta;
  select qty * coalesce(rank_price, price) into nw_exp from holdings h join assets a on a.id = h.asset_id where h.team_id = ta and h.asset_id = a1;
  r := r || jsonb_build_object('rank_price', rp, 'last_price', lp, 'rank_sesuai_rumus', (rp = exp_rp),
        'networth_pakai_rank', (nw_hv = nw_exp));
  select sum(cash+locked_cash) into tot_after from teams;
  select house_cash into v from game_settings;
  select stock into stk from assets where id=a1;
  select coalesce(sum(qty),0) into hold from holdings where asset_id=a1;
  select init_stock into init_s from assets where id=a1;
  r := r || jsonb_build_object('uang_tim_sebelum', tot_before, 'uang_tim_sesudah', tot_after, 'house_cash', v,
        'invarian_uang', (tot_after + v = 20000000), 'stok', stk, 'dipegang', hold, 'stok_awal', init_s,
        'invarian_unit', (stk + hold = init_s), 'jumlah_trade', (select count(*) from trades));
  raise exception 'HASIL: %', r::text;
end $$;
