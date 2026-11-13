#!/bin/sh
# Daily database dump (in addition to the portal's own JSON backups). crontab -e:  15 2 * * * /var/www/student-portal/deploy/backup-db.sh
set -e
DIR=/var/backups/student-portal; mkdir -p "$DIR"; chmod 700 "$DIR"
sudo -u postgres pg_dump -Fc student_portal > "$DIR/student_portal-$(date +%F).dump"
find "$DIR" -name '*.dump' -mtime +30 -delete
