-- Tes SQL admin_skip_news. Berjalan di dalam transaksi yang di-ROLLBACK: tidak mengubah data.
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q < scripts/sql/test-news-skip.sql
-- Syarat: sudah memuat news-skip.sql; ada >= 1 tim, 1 admin, dan berita `ready`.
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
  v_admin uuid; t1 uuid;
  v_live public.news; v_after public.news; v_title text;
  v_applied_before int; v_applied_after int; v_hist_before bigint; v_hist_after bigint;
begin
  select id into t1 from teams order by name limit 1;
  select id into v_admin from profiles where role = 'admin' limit 1;

  perform pg_temp.sys();
  update game_settings set state = 'open', started_at = now(), news_next_allowed_at = null where true;
  -- pastikan ada satu berita tayang (bila belum, biarkan siklus meluncurkannya)
  if not exists (select 1 from news where status = 'live') then perform process_news_cycle(); end if;
  select * into v_live from news where status = 'live';
  perform pg_temp.ok(v_live.id is not null, 'ada berita tayang sebelum dilewati');
  perform pg_temp.ok(v_live.effect_at > now(), 'efek berita tayang belum berlaku');
  select count(*) into v_applied_before from news where status = 'applied';
  select count(*) into v_hist_before from price_history where news_id = v_live.id;
  perform pg_temp.nosys();

  -- bukan admin
  perform pg_temp.as_user(t1);
  perform pg_temp.expect_err('select admin_skip_news()', 'forbidden');

  -- admin: efek diterapkan sekarang
  perform pg_temp.as_user(v_admin);
  v_title := admin_skip_news();
  perform pg_temp.ok(v_title = v_live.title, 'mengembalikan judul berita yang dilewati');
  perform pg_temp.sys();
  select * into v_after from news where id = v_live.id;
  perform pg_temp.ok(v_after.status = 'applied' and v_after.effect_applied_at is not null, 'berita jadi applied');
  select count(*) into v_applied_after from news where status = 'applied';
  perform pg_temp.ok(v_applied_after = v_applied_before + 1, 'tepat satu berita ikut terpakai');
  select count(*) into v_hist_after from price_history where news_id = v_live.id;
  perform pg_temp.ok(v_hist_after > v_hist_before, 'riwayat harga tercatat untuk berita itu');
  perform pg_temp.ok(
    exists (select 1 from audit_log where action = 'skip_news' and payload->>'news_id' = v_live.id::text and actor_id = v_admin),
    'audit skip_news tercatat'
  );
  perform pg_temp.ok(
    exists (select 1 from news where status = 'live' and id <> v_live.id and effect_at > now()),
    'berita berikutnya langsung tayang dengan jeda efek normal'
  );

  -- tidak ada berita tayang
  update news set status = 'ready', published_at = null, effect_at = null where status = 'live';
  update game_settings set news_next_allowed_at = now() + interval '1 hour' where true;
  perform pg_temp.nosys();
  perform pg_temp.as_user(v_admin);
  perform pg_temp.expect_err('select admin_skip_news()', 'no_live_news');

  -- game bukan open
  perform pg_temp.sys();
  update game_settings set state = 'paused' where true;
  perform pg_temp.nosys();
  perform pg_temp.expect_err('select admin_skip_news()', 'game_not_active');
end $t$;
rollback;
