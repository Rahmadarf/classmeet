-- Perbaikan: Supabase hosted menolak UPDATE tanpa WHERE ("UPDATE requires a WHERE clause", ekstensi pg_safeupdate)
-- pada sesi PostgREST. Tujuh fungsi mengubah baris tunggal `game_settings` tanpa WHERE, jadi gagal saat dipanggil
-- dari aplikasi: admin_set_game_state (membuka pasar), admin_set_leaderboard_visible, admin_unfreeze_leaderboard,
-- freeze_leaderboard_internal, ob_match (house_cash; dipanggil place_order tiap pencocokan),
-- process_house_quotes, process_news_cycle.
--
-- Efek: hanya menambahkan `where true` pada UPDATE game_settings yang belum punya WHERE. Perilaku, aturan, dan kontrak
-- RPC tidak berubah (game_settings memang satu baris). Aman dijalankan berulang: pernyataan yang sudah punya WHERE
-- tidak disentuh, dan hak EXECUTE yang ada dipertahankan (CREATE OR REPLACE).
--
-- Jalankan sebagai pemilik (SQL Editor Supabase). Setelah itu, samakan blok SQL di docs/04-rpc-contracts.md
-- (§3.1 ob_match / process_house_quotes, §3.3, §3.4 process_news_cycle) dengan menambah `where true` di UPDATE itu.
do $$
declare
  r     record;
  v_def text;
  v_new text;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('admin_set_game_state', 'admin_set_leaderboard_visible', 'admin_unfreeze_leaderboard',
                         'freeze_leaderboard_internal', 'ob_match', 'process_house_quotes', 'process_news_cycle')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(
      v_def,
      '(update\s+game_settings\s+set(?:(?!\mwhere\M)[^;])*)(;)',
      E'\\1 where true\\2',
      'gi'
    );
    if v_new <> v_def then
      execute v_new;
      raise notice 'diperbaiki: %', r.proname;
    end if;
  end loop;
end $$;

-- Pemeriksaan: harus mengembalikan 0 baris.
select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and exists (
     select 1
       from regexp_matches(pg_get_functiondef(p.oid), '(update\s+game_settings\s+set[^;]*;)', 'gi') m
      where m[1] !~* '\mwhere\M'
   );
