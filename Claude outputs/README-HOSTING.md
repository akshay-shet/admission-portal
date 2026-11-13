# Student Portal — putting it on Hostinger

## 0. Pick the right Hostinger plan (important)

The portal needs **Node.js + PostgreSQL**.

- **Hostinger VPS (KVM, Ubuntu)** — recommended. You install Node.js and PostgreSQL on it; everything below is written for this.
- **Shared / Business / Cloud web hosting** — gives MySQL, not PostgreSQL (check hPanel before buying). It only works if the Node.js app feature is on your plan **and** you use an outside PostgreSQL service (with `?sslmode=require`).
- **Never** upload only `Student-Portal.html` / `dist/index.html` to `public_html`. Without the server the page falls back to "this browser only" storage: no shared data and no real login protection.

## 1. What to upload (and what NOT to)

Upload: `server/` (the .js, schema.sql, initial-data.json files), `dist/index.html`, `package.json`, `package-lock.json`, `deploy/`, `src/`, `index.html`, `vite.config.js` (only needed if you build on the server), the `.bat` files are not needed.

Do **NOT** upload: `node_modules/`, `backups/`, `server/.env`, `server/.secret`, `server/CLEAR_ALL_RECORDS.*`, `testdata-tmp/`, `dist-artifact/`, `Student-Portal.html`, `scanner/`.
Put the app in `/var/www/student-portal` — **not** inside `public_html` or any web folder. If a host forces a web folder, copy `deny.htaccess` as `.htaccess` into `server/` and `backups/`.

## 2. One-time set-up on the VPS (Ubuntu)

```bash
# Node.js 20 LTS, PostgreSQL, nginx, pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx
sudo npm i -g pm2

# database + its own user (use a NEW long password)
sudo -u postgres psql -c "CREATE USER portal_app WITH PASSWORD 'CHANGE_THIS_LONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE student_portal OWNER portal_app;"

# the app
cd /var/www/student-portal
npm install --omit=dev express@4.22.3 pg@8.23.1 --save-exact   # versions with no known security problems
cp server/.env.production.example server/.env && nano server/.env   # fill every CHANGE_THIS
chmod 600 server/.env
npm run db:setup          # tables, links, views
pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup

# web address + HTTPS
sudo cp deploy/nginx-student-portal.conf /etc/nginx/sites-available/student-portal   # edit the domain first
sudo ln -s /etc/nginx/sites-available/student-portal /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d portal.yourdomain.com

# firewall: only SSH + web; PostgreSQL stays private
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Turn on `FORCE_HTTPS=1` only **after** certbot has added HTTPS (otherwise the browser loops).

## 3. First sign-in on the host

1. Open `https://portal.yourdomain.com` → **Owner Login**, username `admin`, password = the `FIRST_OWNER_PASSWORD` from `server/.env`.
   (On the internet admin / admin is refused — nobody else can take the owner login before you.)
2. Choose your own owner username + password and **save the recovery code**.
3. Delete the `FIRST_OWNER_PASSWORD` line from `server/.env` and run `pm2 restart student-portal`.
4. Settings › Login & security → set the **Employee login**.

## 4. Moving your data from the PC (optional)

On the PC portal: Settings › Data & backup › **Download backup** → on the host (owner): Settings › Data & backup › **Restore from backup**. Logins are never copied by a backup; set them on the host as in step 3.

## 5. Backups

- The portal writes `backups/portal-backup-YYYY-MM-DD.json` on start and every 6 hours (60 days kept).
- Also add the database dump: `crontab -e` → `15 2 * * * /var/www/student-portal/deploy/backup-db.sh`
- Copy a backup off the server every week (it holds personal data — keep it private).

## 6. Forgotten passwords on the host

- Owner: login page › Forgot password? (recovery code).
- Owner without code: `ssh` to the VPS → `cd /var/www/student-portal && node server/reset-login.js`.
- Employee: the owner sets a new one in Settings.

## 7. Updating later

Upload the new files (same exclusions), then `npm install --omit=dev` and `pm2 restart student-portal`. Data stays in PostgreSQL.
