#!/usr/bin/env bash
# Dump database Supabase CLOUD ke deploy/supabase/dump (HANYA BACA terhadap cloud; tidak mengubah apa pun di sana).
#
#   read -rs CLOUD_DB_URL && export CLOUD_DB_URL      # tempel connection string lalu Enter (tidak tampil di layar)
#   ./20-dump-cloud.sh [--with-data]
#
# CLOUD_DB_URL: Supabase Dashboard > Connect > "Session pooler" (postgresql://postgres.<ref>:<sandi>@...:5432/postgres).
# JANGAN menempelkannya ke chat, ke berkas, atau ke riwayat shell.
#
# Tanpa --with-data: hanya skema + job cron + daftar tabel Realtime (akun dan data dibuat ulang lewat `npm run seed`).
# Dengan --with-data: ditambah data tabel public dan akun Auth (auth.users, auth.identities) apa adanya, sehingga
# kartu QR yang sudah dicetak tetap berlaku (kata sandi tim = qr_token; hash bcrypt ikut disalin).
#
# BERKAS DI dump/ BERISI DATA SENSITIF (qr_token tim, hash kata sandi). Tidak di-commit (.gitignore); hapus bila selesai.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker

WITH_DATA=0
for a in "$@"; do
  case "$a" in
    --with-data) WITH_DATA=1 ;;
    *) die "pilihan tidak dikenal: $a" ;;
  esac
done

mkdir -p "$DUMP"
chmod 700 "$DUMP"
umask 077

info "Memeriksa koneksi ke cloud ..."
cloud_pg sh -c 'psql "$CLOUD_DB_URL" -Atqc "select current_database(), version()"' >/dev/null \
  || die "tidak bisa terhubung. Periksa CLOUD_DB_URL (pakai Session pooler, port 5432)."

info "Skema public (tabel, fungsi, trigger, RLS, hak akses) ..."
# --no-owner: pemilik di Docker adalah postgres/supabase_admin. Hak akses (GRANT/REVOKE) SENGAJA ikut: aplikasi
# bergantung padanya. Tanpa ekstensi: pg_cron dan pgcrypto dibuat oleh 30-restore-local.sh.
cloud_pg sh -c 'pg_dump "$CLOUD_DB_URL" --schema-only --schema=public --no-owner --no-comments' \
  | sed '/^CREATE SCHEMA public;$/d' > "$DUMP/10-schema-public.sql"

info "Job cron (pg_cron) ..."
cloud_pg sh -c "psql \"\$CLOUD_DB_URL\" -Atq -c \"select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobid\"" \
  > "$DUMP/50-cron.sql"

info "Tabel Realtime ..."
cloud_pg sh -c "psql \"\$CLOUD_DB_URL\" -Atq -c \"select format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename) from pg_publication_tables where pubname = 'supabase_realtime' order by 1\"" \
  > "$DUMP/60-realtime.sql"

if [ "$WITH_DATA" = 1 ]; then
  info "Akun Auth (auth.users, auth.identities) ..."
  # --column-inserts: tahan terhadap beda urutan/kolom antar versi GoTrue. Kolom turunan (confirmed_at) tidak ikut.
  cloud_pg sh -c 'pg_dump "$CLOUD_DB_URL" --data-only --column-inserts --no-owner -t auth.users -t auth.identities' \
    > "$DUMP/20-auth.sql"
  info "Data tabel public ..."
  cloud_pg sh -c 'pg_dump "$CLOUD_DB_URL" --data-only --schema=public --no-owner' > "$DUMP/30-data-public.sql"
fi

info "Selesai. Isi $DUMP:"
ls -l "$DUMP" | sed 's/^/    /'
echo
echo "Berikutnya: ./30-restore-local.sh$([ "$WITH_DATA" = 1 ] && echo ' --with-data')"
