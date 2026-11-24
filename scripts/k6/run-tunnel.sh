#!/usr/bin/env bash
# Menjalankan skenario k6 lewat tunnel. Alamat dan kunci PUBLIK dibaca dari .env.local (tidak dicetak).
#   npm run load-test:k6                            # bawaan: 30 VU tim, 2 display, 8 halaman, 3 menit
#   npm run load-test:k6 -- -e TEAM_VUS=60 -e DURATION=5m
#   npm run load-test:k6 -- -e TRADES=1             # termasuk beli/jual (MENGUBAH data staging)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
command -v k6 >/dev/null || { echo "k6 belum terpasang (macOS: brew install k6; lihat scripts/k6/README.md)" >&2; exit 1; }
[ -f .env.local ] || { echo ".env.local tidak ada di akar repo" >&2; exit 1; }
get() { grep -E "^$1=" .env.local | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }
URL="$(get NEXT_PUBLIC_SUPABASE_URL)"
KEY="$(get NEXT_PUBLIC_SUPABASE_ANON_KEY)"
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY kosong di .env.local" >&2; exit 1; }
# Alamat aplikasi = host publik pertama di CLASSMEET_PUBLIC_HOSTS (mis. classmeet.<domain>); BUKAN selalu app.<domain>.
HOST="$(get CLASSMEET_PUBLIC_HOSTS | cut -d, -f1 | tr -d ' ')"
APP_ARGS=()
[ -n "$HOST" ] && APP_ARGS=(-e APP_URL="https://$HOST")
case "$URL" in https://*) ;; *) echo "SUPABASE_URL harus alamat tunnel https://api.<domain> (sekarang: $URL)" >&2; exit 1 ;; esac
# ${APP_ARGS[@]+...}: aman untuk array kosong di bash 3.2 (macOS) dengan `set -u`. `-e APP_URL=...` dari pemakai menimpa yang bawaan.
exec k6 run -e SUPABASE_URL="$URL" -e ANON_KEY="$KEY" ${APP_ARGS[@]+"${APP_ARGS[@]}"} "$@" scripts/k6/tunnel.js
