#!/usr/bin/env bash
# Ekspor database Docker lokal ke SATU berkas SQL untuk dipindah ke server lain (mis. server sekolah): skema public lengkap
# (tabel, fungsi, pemicu, RLS, hak akses), job cron, tabel Realtime, dan HANYA akun yang dipilih (bawaan: admin). Tidak ada
# data game (tim, saldo, order, berita, aset); pasar dimulai bersih dan baris pengaturan game dibuat bawaan di server tujuan.
#   ./80-export-bundle.sh                    hanya akun admin
#   ./80-export-bundle.sh --roles admin,display   tambah akun layar publik (dibutuhkan /display tanpa login)
# Hasil: bundle/migrasi-<waktu>.sql (berisi hash kata sandi; izin 600; tidak di-commit). Muat di server dengan ./85-import-bundle.sh.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack

ROLES="admin"
while [ $# -gt 0 ]; do
  case "$1" in
    --roles) ROLES="${2:-}"; shift 2 ;;
    *) die "pilihan: --roles admin[,display]" ;;
  esac
done
[[ "$ROLES" =~ ^(admin|display)(,(admin|display))*$ ]] || die "--roles hanya boleh admin dan/atau display (akun lain butuh data pos/tim)."
docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null | grep -q healthy \
  || die "database lokal belum berjalan/sehat (cukup: cd stack && docker compose up -d db)."

psql_q() { docker exec -i "$DB_CONTAINER" psql -U supabase_admin -d postgres -Atq "$@"; }
IN_LIST="$(echo "$ROLES" | sed "s/[a-z]*/'&'/g")"          # 'admin','display'
IDS="select id from public.profiles where role in ($IN_LIST)"
[ "$(psql_q -c "select count(*) from public.profiles where role in ($IN_LIST)")" -ge 1 ] \
  || die "tidak ada akun dengan peran $ROLES di database lokal."
# Kolom yang bukan kolom turunan (email/confirmed_at di auth.* dihasilkan otomatis dan tidak boleh diisi).
cols() { psql_q -c "select string_agg(quote_ident(column_name), ', ' order by ordinal_position) from information_schema.columns where table_schema='$1' and table_name='$2' and is_generated='NEVER'"; }
copy_rows() { # $1 tabel, $2 skema, $3 nama, $4 kondisi where
  local c; c="$(cols "$2" "$3")"
  echo "copy $1 ($c) from stdin;"
  psql_q -c "copy (select $c from $1 where $4) to stdout"
  echo '\.'
}

BUNDLE="$HERE/bundle"; mkdir -p "$BUNDLE"; chmod 700 "$BUNDLE"; umask 077
out="$BUNDLE/migrasi-$(date +%Y%m%d-%H%M%S).sql"
info "Menulis $out (peran akun: $ROLES) ..."
{
  echo "-- Classmeet: paket migrasi (skema + job cron + Realtime + akun: $ROLES). Dibuat $(date '+%F %T'). Muat dengan ./85-import-bundle.sh"
  echo "select set_config('classmeet.system', 'on', false);"
  echo "create extension if not exists pgcrypto with schema extensions;"
  echo 'create extension if not exists "uuid-ossp" with schema extensions;'
  echo "create extension if not exists pg_cron;"
  # Hak bawaan image Supabase memberi anon/authenticated/service_role semua hak pada objek baru di public; cabut dulu supaya
  # GRANT eksplisit dari dump membentuk ACL persis seperti sumber (lihat komentar di 30-restore-local.sh).
  for r in supabase_admin postgres; do
    for k in functions tables sequences; do
      echo "alter default privileges for role $r in schema public revoke all on $k from anon, authenticated, service_role;"
    done
  done
  echo "-- ===== SKEMA public ====="
  docker exec "$DB_CONTAINER" pg_dump -U supabase_admin -d postgres --schema-only --schema=public --no-owner --no-comments \
    | sed '/^CREATE SCHEMA public;$/d'   # schema public sudah ada di database tujuan
  echo "select pg_catalog.set_config('search_path', 'public, extensions', false);"
  echo "-- ===== AKUN ($ROLES) ====="
  echo "set session_replication_role = replica;"
  copy_rows auth.users auth users "id in ($IDS)"
  copy_rows auth.identities auth identities "user_id in ($IDS)"
  copy_rows public.profiles public profiles "role in ($IN_LIST)"
  echo "set session_replication_role = origin;"
  echo "-- ===== PENGATURAN GAME (bawaan: state setup) ====="
  echo "insert into public.game_settings default values on conflict do nothing;"
  echo "-- ===== JOB CRON ====="
  psql_q -c "select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobid"
  echo "-- ===== TABEL REALTIME ====="
  echo "do \$\$ begin if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then create publication supabase_realtime; end if; end \$\$;"
  psql_q -c "select format('do \$\$ begin if not exists (select 1 from pg_publication_tables where pubname = ''supabase_realtime'' and schemaname = %L and tablename = %L) then alter publication supabase_realtime add table %I.%I; end if; end \$\$;', schemaname, tablename, schemaname, tablename) from pg_publication_tables where pubname = 'supabase_realtime' order by 1"
  echo "select set_config('classmeet.system', 'off', false);"
  echo "notify pgrst, 'reload schema';"
} > "$out"
chmod 600 "$out"
echo "Tersimpan: $out ($(du -h "$out" | cut -f1)); job cron: $(grep -c '^select cron.schedule' "$out"); tabel Realtime: $(grep -c 'alter publication supabase_realtime add table' "$out")"
echo "Salin berkas ini ke server (SFTP) ke folder deploy/supabase/bundle/ lalu jalankan: ./85-import-bundle.sh bundle/$(basename "$out")"
