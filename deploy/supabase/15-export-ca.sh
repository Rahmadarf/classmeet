#!/usr/bin/env bash
# Ekspor sertifikat akar CA internal Caddy (HTTPS LAN) ke stack/caddy-root.crt, untuk dipasang di perangkat
# (laptop kiosk, ponsel penjaga, layar display). Berisi sertifikat PUBLIK saja, bukan kunci privat.
#   ./15-export-ca.sh
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack
docker inspect supabase-caddy >/dev/null 2>&1 || die "kontainer Caddy belum berjalan. Jalankan ./10-up.sh --https dulu."
for _ in $(seq 1 20); do
  docker exec supabase-caddy test -f /data/caddy/pki/authorities/local/root.crt && break
  sleep 1
done
docker cp supabase-caddy:/data/caddy/pki/authorities/local/root.crt "$STACK/caddy-root.crt"
echo "Tersimpan: $STACK/caddy-root.crt"
echo "Pasang sebagai CA tepercaya di tiap perangkat (lihat README, bagian HTTPS)."
