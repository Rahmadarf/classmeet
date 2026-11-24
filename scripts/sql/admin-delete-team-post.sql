-- Hapus tim dan hapus pos oleh admin: `admin_delete_team(uuid)` dan `admin_delete_post(uuid)`. Aman dijalankan ulang (create or replace).
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/admin-delete-team-post.sql
-- Syarat: skema dasar + analysis.sql, trading-shop.sql, event-dividend-suspend.sql sudah dimuat (tabel `transactions`,
-- `analysis_purchases`, `dividends` dibaca fungsi ini; trading-shop.sql juga membuang `orders`, `trades`, dan `teams.locked_cash`). Dijalankan sebagai pemilik yang boleh menghapus baris di `auth.users`
-- (supabase_admin), sama seperti fungsi lain di folder ini.
--
-- ATURAN: keduanya HANYA boleh dipakai saat status game `setup`. Selain itu (`open`, `paused`, `finished`) ditolak
-- `game_not_setup`. Ini penegakan sebenarnya; tombol yang diblokir di UI hanya kemudahan.
--
-- KEPUTUSAN PER RELASI (dibaca dari skema; semua FK ke `teams`/`posts`/`profiles` dibuat TANPA cascade kecuali yang tertulis):
--   Akun Auth      : tim dan penjaga masing-masing punya satu akun `auth.users` (dibuat bersama tim/pos oleh server action).
--                    Akun ikut DIHAPUS di dalam fungsi yang sama (satu transaksi, atomik): `auth.users` → `profiles` → `teams`
--                    berantai lewat `on delete cascade`. Tidak ada akun yatim, dan kegagalan di tengah jalan membatalkan semuanya.
--   Tim, aman      : `holdings` (cascade; baris qty 0) dan `leaderboard_snapshot` (data turunan) ikut dibersihkan.
--   Tim, DIBLOKIR  : `team_has_activity` bila tim punya saldo (`cash` ≠ 0), kepemilikan (qty > 0), `transactions`, `payouts`,
--                    `dividends`, atau `analysis_purchases`. (Order book lama sudah dibuang oleh trading-shop.sql: tabel
--                    `orders`/`trades` dan kolom `teams.locked_cash` tidak ada lagi, jadi tidak diperiksa.) Menghapusnya diam-diam berarti uang atau riwayat hilang tanpa jejak. Setelah
--                    "Reset game" semuanya kosong dan saldo 0, jadi tim yang belum dipakai bisa dihapus.
--   Pos, DIBLOKIR  : `post_has_payouts` bila pos pernah memberi hadiah (`payouts.post_id`); sebabnya sama.
--   Penjaga        : akun penjaga (role `guard`) dihapus bersama posnya; dilewati (tetap ada) hanya bila masih memegang pos lain
--                    atau punya `payouts` (tidak mungkin terjadi lewat aplikasi; penjagaan berlapis).
--   `audit_log`    : baris lama yang pelakunya akun terhapus (`actor_id`) dilepas ke NULL supaya FK tidak menghalangi, dan
--                    identitas pelaku disimpan di `payload.actor_deleted` (id, username, nama). Isi log tidak hilang.
--                    Penghapusan itu sendiri dicatat sebagai `delete_team` / `delete_post` (pelaku = admin).
--   Konkurensi     : status game dibaca dengan `for share` supaya `admin_set_game_state` menunggu sampai penghapusan selesai
--                    (game tidak bisa dibuka di tengah penghapusan); baris tim/pos dikunci `for update`.
-- Kode galat: forbidden, invalid_input, game_not_setup, team_not_found / post_not_found, team_has_activity / post_has_payouts.
-- Setiap UPDATE/DELETE punya WHERE (pg_safeupdate; lihat fix-safeupdate-game-settings.sql).

create or replace function public.admin_delete_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_state    game_state;
  v_name     text;
  v_cash     bigint;
  v_username text;
  v_role     app_role;
  v_audit    int;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if p_team_id is null then raise exception 'invalid_input'; end if;

  select state into v_state from game_settings for share;
  if v_state is distinct from 'setup' then raise exception 'game_not_setup'; end if;

  select t.name, t.cash, p.username, p.role
    into v_name, v_cash, v_username, v_role
    from teams t join profiles p on p.id = t.id
   where t.id = p_team_id
     for update of t;
  if not found or v_role is distinct from 'team' then raise exception 'team_not_found'; end if;

  if v_cash <> 0
     or exists (select 1 from holdings where team_id = p_team_id and qty > 0)
     or exists (select 1 from transactions where team_id = p_team_id)
     or exists (select 1 from payouts where team_id = p_team_id)
     or exists (select 1 from dividends where team_id = p_team_id)
     or exists (select 1 from analysis_purchases where team_id = p_team_id) then
    raise exception 'team_has_activity';
  end if;

  delete from holdings where team_id = p_team_id;
  delete from leaderboard_snapshot where team_id = p_team_id;

  update audit_log
     set actor_id = null,
         payload  = payload || jsonb_build_object('actor_deleted',
                      jsonb_build_object('id', p_team_id, 'username', v_username, 'name', v_name))
   where actor_id = p_team_id;
  get diagnostics v_audit = row_count;

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'delete_team',
          jsonb_build_object('team_id', p_team_id, 'name', v_name, 'username', v_username, 'audit_rows_detached', v_audit));

  delete from auth.users where id = p_team_id;       -- cascade: profiles → teams
end $$;

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

  -- Akun penjaga ikut dihapus bila memang akun `guard` yang tidak memegang pos lain dan tidak punya hadiah tercatat.
  v_remove := coalesce(v_role = 'guard', false)
              and not exists (select 1 from posts where guard_id = v_guard)
              and not exists (select 1 from payouts where guard_id = v_guard);
  if v_remove then
    update audit_log
       set actor_id = null,
           payload  = payload || jsonb_build_object('actor_deleted',
                        jsonb_build_object('id', v_guard, 'username', v_username, 'role', 'guard'))
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

revoke all on function public.admin_delete_team(uuid) from public, anon;
revoke all on function public.admin_delete_post(uuid) from public, anon;
grant execute on function public.admin_delete_team(uuid) to authenticated;
grant execute on function public.admin_delete_post(uuid) to authenticated;
notify pgrst, 'reload schema';

-- ---------- pemeriksaan (harus: dua baris, anon_exec = false, auth_exec = true) ----------
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('admin_delete_team', 'admin_delete_post')
 order by 1;
