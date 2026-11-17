#!/usr/bin/env bash
# One-time preparation of a fresh Hostinger VPS (Ubuntu 22.04 / 24.04). Run as root:  bash connectivity/deploy/setup-vps.sh
# Installs Node.js 20, MySQL, nginx, PM2 and certbot. Read README-HOSTINGER.md for the steps around it.
set -euo pipefail
apt-get update
apt-get install -y curl ca-certificates gnupg nginx mysql-server certbot python3-certbot-nginx ufw
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2
systemctl enable --now mysql nginx
# firewall: only SSH and web (MySQL stays private on this machine)
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
echo
echo "Done. Next: create the database and user (README-HOSTINGER.md step 3):"
echo "  sudo mysql -e \"CREATE DATABASE student_portal CHARACTER SET utf8mb4; CREATE USER 'portal'@'localhost' IDENTIFIED BY 'A-STRONG-PASSWORD'; GRANT ALL ON student_portal.* TO 'portal'@'localhost'; FLUSH PRIVILEGES;\""
