#!/usr/bin/env bash
# Fungsi bersama skrip deploy/supabase. Di-source, bukan dijalankan langsung.
# Tidak ada skrip di sini yang mencetak rahasia (kata sandi, JWT secret, service-role key).

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK="$HERE/stack"
DUMP="$HERE/dump"
# Versi berkas resmi Supabase self-hosted yang diuji (commit repo supabase/supabase, folder docker/).
STACK_PIN="f1e7e6e339173fbf41aaad1e2bbd9e5382924348"
# Layanan yang dipakai Classmeet. Storage, Edge Functions, imgproxy, dan pooler tidak dipakai (tidak ada
# bucket, fungsi edge, maupun koneksi Postgres langsung dari aplikasi); tanpa mereka tumpukan jauh lebih ringan.
SERVICES=(db meta studio api-gw auth rest realtime)
DB_CONTAINER="supabase-db"

die() { echo "Galat: $*" >&2; exit 1; }
info() { echo "==> $*"; }

need() {
  for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "perintah '$c' tidak ditemukan"; done
}

need_stack() {
  [ -f "$STACK/docker-compose.yml" ] || die "tumpukan belum disiapkan. Jalankan ./00-setup-stack.sh dulu."
  [ -f "$STACK/.env" ] || die "$STACK/.env tidak ada. Jalankan ./00-setup-stack.sh dulu."
}

# Ganti/isi KEY=VALUE di $STACK/.env tanpa mencetak nilainya.
set_env() {
  local key="$1" value="$2" file="$STACK/.env"
  if grep -q "^${key}=" "$file"; then
    # Pemisah '#' supaya URL aman; nilai tidak pernah mengandung '#'.
    sed -i.bak "s#^${key}=.*#${key}=${value}#" "$file" && rm -f "$file.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# Baca satu nilai dari $STACK/.env (untuk dipakai di skrip, jangan dicetak bila rahasia).
get_env() {
  grep "^$1=" "$STACK/.env" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'
}

dc() { (cd "$STACK" && docker compose "$@"); }

# psql di dalam kontainer database lokal sebagai supabase_admin (superuser; dibutuhkan untuk memuat data).
local_psql() { docker exec -i "$DB_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"; }

# Jalankan perintah klien Postgres 17 terhadap DB cloud. Alamat (berisi kata sandi) lewat variabel lingkungan
# kontainer, tidak muncul di daftar proses atau riwayat shell.
cloud_pg() {
  [ -n "${CLOUD_DB_URL:-}" ] || die "CLOUD_DB_URL belum diisi (lihat README, bagian 'Dump dari cloud')."
  docker run --rm -i -e CLOUD_DB_URL postgres:17 "$@"
}
