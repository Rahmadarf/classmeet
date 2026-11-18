#!/usr/bin/env bash
# Kosongkan data Classmeet di database Docker LEWAT SQL (schema public, akun Auth, job cron, tabel Realtime), tanpa
# menghapus berkas volume. Dipakai sebelum memuat ulang dengan ./30-restore-local.sh. HANYA database lokal.
#   ./35-reset-db.sh --yes
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need docker
need_stack
[ "${1:-}" = "--yes" ] || die "ini MENGHAPUS schema public, akun Auth, dan job cron di database Docker lokal. Ulangi dengan --yes."
docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null | grep -q healthy || die "database lokal belum sehat."

info "Mengosongkan database Docker lokal ..."
local_psql -q <<'SQL'
select cron.unschedule(jobid) from cron.job;
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' loop
    execute format('alter publication supabase_realtime drop table %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;
drop schema public cascade;
create schema public;
alter schema public owner to pg_database_owner;
truncate auth.identities, auth.users cascade;
SQL
echo "Selesai. Muat ulang dengan ./30-restore-local.sh [--with-data]"
