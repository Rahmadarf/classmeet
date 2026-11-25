#!/usr/bin/env bash
# Muat kumpulan berita TULIS TANGAN (docs/berita-650/*.md via scripts/build-news-from-markdown.ts) LANGSUNG ke database Docker, berstatus `ready`.
#   npm run load-news               menambah berita yang judulnya belum ada
#   npm run load-news -- --replace  MENGGANTI semua berita ready/draft dengan kumpulan terbaru (isi + efek); yang sudah terbit tidak disentuh
# Untuk database Docker lokal saja. Melewati penguncian game (classmeet.system = on), jadi bisa dipakai juga saat game
# sudah berjalan (uji). Idempoten: berita yang judulnya sudah ada dilewati. Untuk game BARU sebelum dibuka, cara resminya
# adalah `npm run seed` (lewat RPC admin). Sesudah memuat, mesin berita akan mulai menerbitkan berita bila pasar `open`.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SQL="$(mktemp -t newspool.XXXXXX).sql"
trap 'rm -f "$SQL"' EXIT
npx tsx scripts/build-news-from-markdown.ts --sql "$SQL" "$@" >/dev/null
{
  echo "select set_config('classmeet.system','on',false);"
  cat "$SQL"
  echo "select set_config('classmeet.system','off',false);"
} | docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q >/dev/null
docker exec supabase-db psql -U postgres -d postgres -At -c "select status||': '||count(*) from news group by status order by status"
