#!/usr/bin/env bash
# Jalankan `npm run seed` terhadap database Docker (akun admin/display/penjaga/tim, pos, aset, berita uji).
# Kunci service_role dibaca dari stack/.env HANYA untuk proses seed ini (tidak dicetak, tidak ditulis ke berkas/.env.local).
#
#   ./60-seed-local.sh
#
# Catatan: kata sandi admin/display dipakai ulang dari scripts/.seed-output.local.json bila ada. QR tim BARU dibuat
# (token acak) untuk tim yang belum ada di database ini: cetak ulang kartu (`npm run print-qr`).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_stack
ROOT="$(cd "$HERE/../.." && pwd)"

URL="$(get_env SUPABASE_PUBLIC_URL)"
# Skrip seed menolak project selain staging kecuali SEED_ALLOW_ANY_PROJECT=1 (database ini memang bukan staging cloud).
# Variabel yang sudah ada di lingkungan didahulukan atas .env.local (perilaku `node --env-file`).
cd "$ROOT"
# HTTPS lokal: percayai CA internal Caddy bila sudah diekspor (./15-export-ca.sh).
[ -f "$STACK/caddy-root.crt" ] && export NODE_EXTRA_CA_CERTS="$STACK/caddy-root.crt"
NEXT_PUBLIC_SUPABASE_URL="$URL" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(get_env ANON_KEY)" \
SUPABASE_SERVICE_ROLE_KEY="$(get_env SERVICE_ROLE_KEY)" \
SEED_ALLOW_ANY_PROJECT=1 \
  npm run seed
