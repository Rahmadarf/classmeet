#!/usr/bin/env bash
# Cetak baris .env.local untuk aplikasi (URL + anon key, keduanya PUBLIK). Tidak pernah mencetak service-role key.
#   ./50-app-env.sh          cetak dua baris NEXT_PUBLIC_*
#   ./50-app-env.sh --url    cetak URL saja
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_stack
URL="$(get_env SUPABASE_PUBLIC_URL)"
case "${1:-}" in
  --url) echo "$URL" ;;
  "") echo "NEXT_PUBLIC_SUPABASE_URL=$URL"; echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(get_env ANON_KEY)" ;;
  *) die "pilihan: --url" ;;
esac
