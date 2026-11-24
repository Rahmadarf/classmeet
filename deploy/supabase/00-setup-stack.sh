#!/usr/bin/env bash
# Siapkan tumpukan Supabase self-hosted (Docker) di deploy/supabase/stack.
#
#   ./00-setup-stack.sh [URL_PUBLIK_SUPABASE] [URL_APLIKASI]
#   contoh lokal (bawaan): ./00-setup-stack.sh http://localhost:8000 http://localhost:3000
#   untuk acara (Cloudflare Tunnel): jalankan tanpa argumen, lalu ./55-tunnel-env.sh app.<domain> api.<domain> (lihat README)
#
# Mengunduh berkas resmi supabase/supabase (folder docker/, commit yang dipin), membuat .env dengan rahasia acak
# memakai skrip resmi utils/generate-keys.sh (keluarannya dibuang, tidak dicetak), lalu menyesuaikan beberapa nilai.
# TIDAK menjalankan kontainer apa pun.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

PUBLIC_URL="${1:-http://localhost:8000}"
APP_URL="${2:-http://localhost:3000}"

need git openssl docker sed
[ ! -e "$STACK" ] || die "$STACK sudah ada. Hapus folder itu bila ingin memulai ulang (data DB lama ikut hilang bila volumes/db/data dihapus)."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

info "Mengunduh berkas resmi Supabase self-hosted (commit ${STACK_PIN:0:7}) ..."
git -C "$tmp" init -q repo
git -C "$tmp/repo" remote add origin https://github.com/supabase/supabase.git
git -C "$tmp/repo" sparse-checkout set docker
git -C "$tmp/repo" fetch -q --depth 1 --filter=blob:none origin "$STACK_PIN"
git -C "$tmp/repo" checkout -q FETCH_HEAD
cp -R "$tmp/repo/docker" "$STACK"
echo "$STACK_PIN" > "$STACK/.supabase-version"

info "Membuat .env dengan rahasia acak ..."
cp "$STACK/.env.example" "$STACK/.env"
(cd "$STACK" && sh utils/generate-keys.sh --update-env >/dev/null)

info "Menyesuaikan konfigurasi untuk Classmeet ..."
set_env SUPABASE_PUBLIC_URL "$PUBLIC_URL"
set_env API_EXTERNAL_URL "${PUBLIC_URL}/auth/v1"
set_env SITE_URL "$APP_URL"
# Akun dibuat panitia lewat skrip seed (service role), bukan pendaftaran mandiri.
set_env DISABLE_SIGNUP true
set_env ENABLE_EMAIL_AUTOCONFIRM true
set_env ENABLE_PHONE_SIGNUP false
set_env ENABLE_PHONE_AUTOCONFIRM false
set_env ENABLE_ANONYMOUS_USERS false

cat <<MSG

Selesai. Tumpukan ada di: $STACK
  - Rahasia ada di $STACK/.env (tidak di-commit; jangan dibagikan, jangan dicetak ke log).
  - Studio (dasbor) memakai DASHBOARD_USERNAME/DASHBOARD_PASSWORD dari berkas itu.
Berikutnya: ./10-up.sh
MSG
