#!/usr/bin/env bash
# Muat hasil dump ke database Supabase Docker lokal.
#
#   ./30-restore-local.sh [--with-data]
#
# Urutan: ekstensi -> skema public -> (akun Auth -> data public, bila --with-data) -> job cron -> tabel Realtime ->
# muat ulang skema PostgREST. Berhenti pada galat pertama (ON_ERROR_STOP). Hanya menyentuh database LOKAL.
# Bila database lokal sudah berisi tabel Classmeet, skrip menolak (hindari menimpa); hapus dulu dengan
#   ./10-up.sh down && rm -rf stack/volumes/db/data && ./10-up.sh
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack

WITH_DATA=0
for a in "$@"; do
  case "$a" in
    --with-data) WITH_DATA=1 ;;
    *) die "pilihan tidak dikenal: $a" ;;
  esac
done

[ -f "$DUMP/10-schema-public.sql" ] || die "dump belum ada. Jalankan ./20-dump-cloud.sh dulu."
if [ "$WITH_DATA" = 1 ]; then
  [ -f "$DUMP/20-auth.sql" ] && [ -f "$DUMP/30-data-public.sql" ] \
    || die "dump data belum ada. Jalankan ./20-dump-cloud.sh --with-data."
fi
docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null | grep -q healthy \
  || die "database lokal belum berjalan/sehat. Jalankan ./10-up.sh dulu."

existing="$(local_psql -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_name='teams'")"
[ "$existing" = "0" ] || die "database lokal sudah berisi tabel Classmeet (teams). Kosongkan dulu (lihat komentar di atas)."

info "Ekstensi ..."
local_psql -q <<'SQL'
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron;
SQL

# Image Supabase memasang hak akses bawaan (ALTER DEFAULT PRIVILEGES) yang memberi anon/authenticated/service_role semua
# hak pada tiap fungsi/tabel/sekuens BARU di schema public. Dump hanya memuat GRANT untuk peran yang ada di ACL cloud
# (tanpa REVOKE untuk yang tidak ada), jadi tanpa langkah ini objek hasil restore bocor hak (mis. anon bisa menjalankan
# fungsi admin_*). Cabut dulu hak bawaan; GRANT eksplisit dari dump lalu membentuk ACL persis seperti cloud, dan dump
# sendiri memasang kembali hak bawaan di akhir (sama seperti cloud).
info "Menetralkan hak akses bawaan sebelum memuat skema ..."
local_psql -q <<'SQL'
alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
SQL

info "Skema public ..."
local_psql -q < "$DUMP/10-schema-public.sql"

if [ "$WITH_DATA" = 1 ]; then
  # Tabel auth dibuat GoTrue saat pertama berjalan; tunggu sampai ada.
  for _ in $(seq 1 30); do
    [ "$(local_psql -Atqc "select to_regclass('auth.users') is not null")" = "t" ] && break
    sleep 2
  done
  [ "$(local_psql -Atqc "select to_regclass('auth.users') is not null")" = "t" ] \
    || die "auth.users belum ada: layanan auth belum selesai migrasi. Lihat ./10-up.sh logs"
  info "Akun Auth ..."
  { echo "set session_replication_role = replica;"; cat "$DUMP/20-auth.sql"; } | local_psql -q
  info "Data public ..."
  { echo "set session_replication_role = replica;"; cat "$DUMP/30-data-public.sql"; } | local_psql -q
fi

if [ "$WITH_DATA" = 0 ]; then
  # Pengaturan game adalah satu baris (id = true) yang semua kolomnya punya nilai bawaan: mulai bersih (state `setup`,
  # belum dimulai). Pengaturan yang pernah diubah admin di cloud tidak ikut; atur ulang di halaman Status, atau pakai --with-data.
  info "Baris pengaturan game (bawaan) ..."
  local_psql -q -c "insert into public.game_settings default values on conflict do nothing;"
fi

info "Job cron ..."
if [ -s "$DUMP/50-cron.sql" ]; then local_psql -q < "$DUMP/50-cron.sql" >/dev/null; else echo "    (tidak ada job)"; fi

info "Tabel Realtime ..."
local_psql -q -c "do \$\$ begin if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if; end \$\$;"
if [ -s "$DUMP/60-realtime.sql" ]; then local_psql -q < "$DUMP/60-realtime.sql"; fi

info "Memuat ulang skema PostgREST ..."
local_psql -q -c "notify pgrst, 'reload schema';"

echo
if [ "$WITH_DATA" = 1 ]; then
  echo "Selesai (skema + data + akun). Berikutnya: ./40-verify.sh"
else
  echo "Selesai (skema saja). Buat akun dan data uji dengan skrip seed, lalu ./40-verify.sh:"
  echo "  NEXT_PUBLIC_SUPABASE_URL=\$(./50-app-env.sh --url) SUPABASE_SERVICE_ROLE_KEY=... npm run seed   (lihat README)"
fi
