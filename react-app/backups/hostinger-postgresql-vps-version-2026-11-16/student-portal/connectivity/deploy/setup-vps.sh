#!/usr/bin/env bash
# One-time preparation of a fresh Hostinger VPS (Ubuntu 22.04 / 24.04). Run as root:  bash connectivity/deploy/setup-vps.sh
# Installs Node.js 20, PostgreSQL, nginx, PM2 and certbot. Read README-HOSTINGER.md for the steps around it.
set -euo pipefail
apt-get update
apt-get install -y curl ca-certificates gnupg nginx postgresql postgresql-contrib certbot python3-certbot-nginx ufw
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2
systemctl enable --now postgresql nginx
# firewall: only SSH and web (PostgreSQL listens on this machine only — Ubuntu's default)
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
echo
echo "Done. Next: create the database and user (README-HOSTINGER.md step 3) — use letters and numbers only in the password:"
echo "  sudo -u postgres psql -c \"CREATE USER portal WITH PASSWORD 'A-STRONG-PASSWORD';\" -c \"CREATE DATABASE student_portal OWNER portal ENCODING 'UTF8' TEMPLATE template0;\""
