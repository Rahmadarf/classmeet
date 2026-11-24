#!/usr/bin/env bash
# `npm start`: jalankan stack Supabase + Cloudflare Tunnel (deploy/supabase/10-up.sh --tunnel), lalu `next start` di terminal
# yang sama. Saat dihentikan dengan Ctrl+C (atau proses ditutup), stack ikut dimatikan (10-up.sh down; data database tetap
# aman di stack/volumes/db/data), jadi tidak perlu terminal kedua.
#   npm start               stack nyala, Next jalan; Ctrl+C mematikan keduanya
#   npm run start:next      hanya `next start` (stack dibiarkan seperti keadaannya)
#   KEEP_STACK=1 npm start  Ctrl+C hanya mematikan Next; stack tetap menyala
# Butuh `npm run build` lebih dulu. Argumen tambahan diteruskan ke `next start` (mis. `npm start -- -p 3001`).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

STACK_SCRIPT="${STACK_SCRIPT:-deploy/supabase/10-up.sh}"
NEXT_BIN="${NEXT_BIN:-node_modules/.bin/next}"

say() { printf '[start] %s\n' "$*"; }

stack_started=0
cleanup() {
  trap - EXIT INT TERM
  if [ "$stack_started" = 1 ] && [ "${KEEP_STACK:-0}" != 1 ]; then
    echo
    say "Mematikan stack Supabase + tunnel ..."
    bash "$STACK_SCRIPT" down || say "Gagal mematikan stack; matikan manual: npm run stack:down"
  elif [ "$stack_started" = 1 ]; then
    echo
    say "KEEP_STACK=1: stack dibiarkan menyala (matikan dengan: npm run stack:down)."
  fi
}
# INT/TERM: keluar dengan kode standar; trap EXIT di atas yang membereskan.
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

say "Menjalankan stack Supabase + tunnel ..."
if bash "$STACK_SCRIPT" --tunnel; then
  stack_started=1
else
  say "Stack gagal jalan (lihat galat di atas); next start tetap dilanjutkan."
  stack_started=1   # sebagian kontainer mungkin sudah naik; tetap dimatikan saat keluar
fi

"$NEXT_BIN" start "$@"
status=$?
exit "$status"
