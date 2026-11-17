#!/usr/bin/env bash
# Nightly PostgreSQL dump (second copy next to the portal's own JSON backups). Keeps 30 days.
# Install:  chmod +x connectivity/deploy/backup-db.sh
#           crontab -e   →   30 2 * * * /var/www/student-portal/connectivity/deploy/backup-db.sh
# Restore one:  gunzip -c backups/postgres/student_portal-DATE.sql.gz | PGPASSWORD=... psql -h 127.0.0.1 -U portal -d student_portal
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . connectivity/config/.env; set +a
mkdir -p backups/postgres && chmod 700 backups backups/postgres
f="backups/postgres/student_portal-$(date +%F).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump --no-owner --clean --if-exists -h "${DB_HOST:-127.0.0.1}" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" | gzip > "$f"
chmod 600 "$f"
find backups/postgres -name 'student_portal-*.sql.gz' -mtime +30 -delete
echo "Saved $f"
