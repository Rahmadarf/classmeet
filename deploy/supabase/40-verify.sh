#!/usr/bin/env bash
# Periksa database Docker. Bila CLOUD_DB_URL diisi, bandingkan inventarisnya dengan cloud (harus sama).
#   ./40-verify.sh
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack

mkdir -p "$DUMP"
umask 077
info "Inventaris database Docker ..."
local_psql -Atq -F ' | ' < "$HERE/sql/inventory.sql" > "$DUMP/inventory-local.txt"
cat "$DUMP/inventory-local.txt"

echo
if [ -n "${CLOUD_DB_URL:-}" ]; then
  info "Inventaris cloud ..."
  cloud_pg sh -c 'psql "$CLOUD_DB_URL" -Atq -F " | "' < "$HERE/sql/inventory.sql" > "$DUMP/inventory-cloud.txt"
  # Baris "info:" dan jumlah akun boleh berbeda (mode tanpa --with-data).
  if diff <(grep -v '^info:' "$DUMP/inventory-cloud.txt" | grep -v '^akun auth') \
          <(grep -v '^info:' "$DUMP/inventory-local.txt" | grep -v '^akun auth'); then
    echo "SAMA: skema, kebijakan RLS, trigger, cron, Realtime, dan hak eksekusi cocok dengan cloud."
  else
    die "ada perbedaan dengan cloud (lihat diff di atas: '<' = cloud, '>' = Docker)."
  fi
else
  echo "(CLOUD_DB_URL tidak diisi: perbandingan dengan cloud dilewati.)"
  echo "Periksa sendiri: 'anon bisa eksekusi fungsi public' harus '-', dan 'authenticated bisa eksekusi fungsi internal' harus '-'."
fi

info "Cek gerbang API lokal ..."
PUB="$(get_env SUPABASE_PUBLIC_URL)"
ANON="$(get_env ANON_KEY)"
code="$(curl -ks -o /dev/null -w '%{http_code}' -H "apikey: $ANON" "$PUB/rest/v1/game_settings?select=state&limit=1" || true)"
echo "    GET $PUB/rest/v1/game_settings (anon) -> HTTP $code   (200 atau 401/403/[] sama-sama wajar tergantung RLS)"
code="$(curl -ks -o /dev/null -w '%{http_code}' "$PUB/auth/v1/health" -H "apikey: $ANON" || true)"
echo "    GET $PUB/auth/v1/health -> HTTP $code   (harus 200)"
