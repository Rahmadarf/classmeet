#!/usr/bin/env bash
# Muat paket migrasi (dibuat ./80-export-bundle.sh) ke database Supabase Docker di mesin ini. Hanya untuk database BARU
# (kosong dari tabel Classmeet); menolak bila tabel teams sudah ada supaya tidak menimpa data.
#   ./85-import-bundle.sh bundle/migrasi-<waktu>.sql
# Syarat: stack sudah jalan (./10-up.sh --server atau --tunnel) dan layanan auth sudah membuat tabel auth.*.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack
FILE="${1:-}"
[ -n "$FILE" ] || die "pemakaian: ./85-import-bundle.sh bundle/migrasi-<waktu>.sql"
[ -f "$FILE" ] || FILE="$HERE/$FILE"
[ -f "$FILE" ] || die "berkas tidak ditemukan: $1"

docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null | grep -q healthy \
  || die "database belum berjalan/sehat. Jalankan ./10-up.sh --server dulu."
[ "$(local_psql -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_name='teams'")" = "0" ] \
  || die "database ini sudah berisi tabel Classmeet (teams); impor ditolak agar data tidak tertimpa."

info "Menunggu tabel auth.* dari layanan auth ..."
for _ in $(seq 1 45); do
  [ "$(local_psql -Atqc "select to_regclass('auth.users') is not null and to_regclass('auth.identities') is not null")" = "t" ] && break
  sleep 2
done
[ "$(local_psql -Atqc "select to_regclass('auth.users') is not null")" = "t" ] \
  || die "auth.users belum ada: layanan auth belum selesai migrasi. Lihat ./10-up.sh logs"

info "Memuat $(basename "$FILE") ..."
local_psql -q < "$FILE" > /dev/null

info "Pemeriksaan:"
local_psql -Atq <<'SQL'
select '  tabel public: ' || count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';
select '  fungsi public: ' || count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
select '  job cron: ' || string_agg(jobname || ' (' || schedule || ')', ', ' order by jobname) from cron.job;
select '  tabel Realtime: ' || string_agg(tablename, ', ' order by tablename) from pg_publication_tables where pubname='supabase_realtime';
select '  akun: ' || string_agg(role || ' ' || username, ', ' order by role) from public.profiles;
select '  pengaturan game: ' || count(*) || ' baris, state ' || min(state::text) from public.game_settings;
SQL
echo
echo "Selesai. Mulai ulang Realtime agar membaca publikasi baru: docker restart realtime-dev.supabase-realtime"
echo "Berikutnya: login admin di aplikasi; data tim/pos/aset/berita diisi menyusul (tidak ikut dipindah)."
