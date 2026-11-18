#!/usr/bin/env bash
# Cadangan database Docker (skema public + akun Auth) ke dump/backup-<waktu>.sql. Jalankan berkala selama acara
# (mis. tiap jam) dan sebelum mengubah apa pun. Berkas BERISI DATA SENSITIF (qr_token, hash kata sandi); tidak di-commit.
#   ./70-backup.sh
# Pulihkan: kosongkan database lalu muat berkas itu dengan psql (lihat README, bagian Pencadangan).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack
mkdir -p "$DUMP"
chmod 700 "$DUMP"
umask 077
out="$DUMP/backup-$(date +%Y%m%d-%H%M%S).sql"
docker exec "$DB_CONTAINER" pg_dump -U supabase_admin -d postgres --no-owner \
  --schema=public -t auth.users -t auth.identities > "$out"
echo "Tersimpan: $out ($(du -h "$out" | cut -f1))"
