#!/usr/bin/env bash
# Simulasi mesin berita v2 di database Docker (TIDAK mengubah data: semuanya di-ROLLBACK).
#   scripts/sim-news-engine.sh [hari=3] [suhu_milli=80] [benih=0.42] [intensitas_persen=100] [pengali_efek=1]
# Perlu: docker (supabase-db jalan), berita tulis tangan di docs/berita-650 (dibaca langsung oleh scripts/build-news-from-markdown.ts).
# Menahan kunci baris game_settings selama simulasi (beberapa detik): jangan dijalankan saat acara berlangsung.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
DAYS="${1:-3}"; TEMP="${2:-80}"; SEED="${3:-0.42}"; INT="${4:-100}"; SCALE="${5:-}"
POOL="$(mktemp -t newspool.XXXXXX).sql"
trap 'rm -f "$POOL"' EXIT
# --replace: ganti berita siap yang ada (di dalam transaksi yang di-ROLLBACK) supaya efek memakai pengali skala yang diminta
npx tsx scripts/build-news-from-markdown.ts --sql "$POOL" --replace ${SCALE:+--scale "$SCALE"} >/dev/null
{
  echo "begin;"
  echo "select set_config('classmeet.system','on',true);"
  cat "$POOL"
  echo "select set_config('sim.days','$DAYS',true), set_config('sim.temp','$TEMP',true), set_config('sim.intensity','$INT',true);"
  sed -e "s/:'sim_seed'/'$SEED'/" "$(dirname "${BASH_SOURCE[0]}")/sql/sim-news-engine.sql"
  echo "rollback;"
} | docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q
