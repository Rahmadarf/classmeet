#!/usr/bin/env bash
# Setel alamat publik Cloudflare Tunnel di stack/.env lalu cetak baris .env.local untuk aplikasi.
#   ./55-tunnel-env.sh app.contoh.com api.contoh.com
# Mengubah SUPABASE_PUBLIC_URL, API_EXTERNAL_URL, SITE_URL. Setelah itu: ./10-up.sh --tunnel (auth perlu dimulai ulang).
# Tidak mencetak rahasia apa pun (anon key bersifat publik).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_stack
APP="${1:-}"; API="${2:-}"
[[ "$APP" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ && "$API" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] \
  || die "pemakaian: ./55-tunnel-env.sh app.<domain> api.<domain> (hanya nama host, tanpa https://)"
set_env SUPABASE_PUBLIC_URL "https://$API"
set_env API_EXTERNAL_URL "https://$API/auth/v1"
set_env SITE_URL "https://$APP"
info "stack/.env diperbarui. Salin ke .env.local aplikasi:"
echo "NEXT_PUBLIC_SUPABASE_URL=https://$API"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(get_env ANON_KEY)"
echo "CLASSMEET_PUBLIC_HOSTS=$APP"
echo
echo "Berikutnya: isi TUNNEL_TOKEN di stack/.env, lalu ./10-up.sh --tunnel, lalu jalankan aplikasi dengan: npm run dev"
