#!/usr/bin/env bash
# Jalankan layanan Supabase yang dipakai Classmeet dan tunggu sampai database sehat.
#   ./10-up.sh            jalankan (HTTP; gerbang API di port 8000; hanya untuk mencoba di satu laptop)
#   ./10-up.sh --tunnel   jalankan dengan Cloudflare Tunnel (butuh internet; lihat README, bagian Cloudflare Tunnel)
#   ./10-up.sh --server   seperti --tunnel, ditambah aplikasi Classmeet sebagai kontainer di port 8111 (server sekolah)
#   ./10-up.sh down       hentikan (data tetap di stack/volumes/db/data)
#   ./10-up.sh logs       ikuti log
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack

MODE="${1:-up}"
case "$MODE" in
  down) dc down; exit 0 ;;
  logs) dc logs -f --tail 100 "${SERVICES[@]}"; exit 0 ;;
  up|--tunnel|--server) ;;
  --https) die "mode HTTPS LAN (Caddy) sudah dihapus; pakai --tunnel (Cloudflare Tunnel). Lihat README." ;;
  *) die "pilihan: up | --tunnel | --server | down | logs" ;;
esac

if [ "$MODE" = "--tunnel" ] || [ "$MODE" = "--server" ]; then
  [ "$(get_env SUPABASE_PUBLIC_URL | cut -c1-8)" = "https://" ] \
    || die "SUPABASE_PUBLIC_URL harus https://api.<domain>. Jalankan ./55-tunnel-env.sh app.<domain> api.<domain>."
  [ -n "$(get_env TUNNEL_TOKEN)" ] || die "TUNNEL_TOKEN belum diisi di stack/.env (lihat README, bagian Cloudflare Tunnel)."
  cp "$HERE/docker-compose.tunnel.yml" "$STACK/docker-compose.tunnel.yml"
  set_env COMPOSE_FILE "docker-compose.yml:docker-compose.tunnel.yml"
  # Kontainer Caddy lama (mode HTTPS LAN yang sudah dihapus), bila masih ada, dihentikan supaya tidak menahan port 443/3443.
  docker stop supabase-caddy >/dev/null 2>&1 || true
  SERVICES+=(cloudflared)
fi

if [ "$MODE" = "--server" ]; then
  [ -f "$HERE/../../.env.local" ] || die ".env.local aplikasi belum ada di akar repo (lihat README, bagian Server sekolah)."
  cp "$HERE/docker-compose.app.yml" "$STACK/docker-compose.app.yml"
  set_env COMPOSE_FILE "docker-compose.yml:docker-compose.tunnel.yml:docker-compose.app.yml"
  SERVICES+=(app)
fi

[ "$MODE" = "--server" ] && { info "Membangun image aplikasi (pertama kali beberapa menit) ..."; dc build app; }

info "Menjalankan: ${SERVICES[*]} (pertama kali mengunduh image, bisa beberapa GB) ..."
dc up -d "${SERVICES[@]}"

info "Menunggu database sehat ..."
for _ in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo none)"
  [ "$state" = "healthy" ] && break
  sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo none)" = "healthy" ] \
  || die "database belum sehat. Lihat: ./10-up.sh logs"

dc ps
echo
echo "Berikutnya: dump dari cloud (./20-dump-cloud.sh) lalu ./30-restore-local.sh"
