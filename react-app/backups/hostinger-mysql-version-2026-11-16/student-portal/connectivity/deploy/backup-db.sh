#!/usr/bin/env bash
# Nightly MySQL dump (second copy next to the portal's own JSON backups). Keeps 30 days.
# Install:  chmod +x connectivity/deploy/backup-db.sh
#           crontab -e   →   30 2 * * * /var/www/student-portal/connectivity/deploy/backup-db.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . connectivity/config/.env; set +a
mkdir -p backups/mysql && chmod 700 backups backups/mysql
f="backups/mysql/student_portal-$(date +%F).sql.gz"
MYSQL_PWD="$DB_PASSWORD" mysqldump --single-transaction --routines -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" "$DB_NAME" | gzip > "$f"
chmod 600 "$f"
find backups/mysql -name 'student_portal-*.sql.gz' -mtime +30 -delete
echo "Saved $f"
