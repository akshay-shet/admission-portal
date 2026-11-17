# Student Portal on Hostinger (VPS) — deployment guide

```
student-portal/
├── frontend/        React app (Vite). npm run build → frontend/dist
├── backend/         Node.js + Express API: sign-in, rules, records, backups, Google Sheets proxy
├── connectivity/    everything that connects the parts
│   ├── config/          .env settings (database, port, first logins, Google key)
│   ├── database/        PostgreSQL schema, connection, setup (npm run db:setup), starting lists
│   ├── google-sheets/   service-account link to your spreadsheet
│   ├── api-client/      the front end's link to the backend (built into the React app)
│   └── deploy/          nginx, PM2, nightly PostgreSQL backup, VPS preparation
├── package.json     backend scripts (start, db:setup, …)
├── CHANGES.md       what changed compared with the claude.ai portal (UI and logic: nothing)
└── frontend-changes.diff   every changed front-end line
```

How it fits together: **browser → nginx (HTTPS) → backend (port 3000) → PostgreSQL**. The backend also serves the built React app,
so there is one address for everything. Google Sheets is reached by the backend with your service account.

---

## 1. Prepare the VPS (once)
In hPanel → VPS → choose **Ubuntu 22.04 or 24.04**, note the IP and root password. Point your domain or a sub-domain
(e.g. `portal.yourdomain.com`) to that IP: hPanel → Domains → DNS → **A record**.

```bash
ssh root@YOUR_VPS_IP
mkdir -p /var/www && cd /var/www
# upload this folder as /var/www/student-portal (WinSCP / FileZilla / scp / git clone)
cd student-portal
bash connectivity/deploy/setup-vps.sh        # Node.js 20, PostgreSQL, nginx, PM2, certbot, firewall
```

## 2. Install the packages and build the front end
```bash
npm run install:all          # backend packages + frontend packages
npm run build:frontend       # creates frontend/dist  (a ready-built copy is already included)
```

## 3. Create the PostgreSQL database and user
Pick a strong password (letters and numbers only, at least 16 characters):
```bash
sudo -u postgres psql -c "CREATE USER portal WITH PASSWORD 'A-STRONG-PASSWORD';" \
  -c "CREATE DATABASE student_portal OWNER portal ENCODING 'UTF8' TEMPLATE template0;"
```

## 4. Settings
```bash
cp connectivity/config/.env.example connectivity/config/.env
nano connectivity/config/.env        # DB_PASSWORD=…  (and FIRST_OWNER_PASSWORD / FIRST_EMPLOYEE_PASSWORD if you want other first logins)
chmod 600 connectivity/config/.env
```

## 5. Create the tables and first logins
```bash
npm run db:setup
```
First logins are **admin / admin** (owner) and **employee / employee** — the same as the portal today — unless you set others in `.env`.
**Change both right after the first sign-in** (Settings › Login & security; save the recovery code).

## 6. Start it and keep it running
```bash
pm2 start connectivity/deploy/ecosystem.config.cjs
pm2 save && pm2 startup              # restart automatically after a reboot
pm2 logs student-portal              # see what it is doing
```

## 7. Your domain + HTTPS
```bash
sudo cp connectivity/deploy/nginx-student-portal.conf /etc/nginx/sites-available/student-portal
sudo nano /etc/nginx/sites-available/student-portal        # change portal.example.com to your domain
sudo ln -s /etc/nginx/sites-available/student-portal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d portal.yourdomain.com             # free HTTPS certificate, renews itself
```
Open `https://portal.yourdomain.com` and sign in.

## 8. Google Sheet link
Follow `connectivity/google-sheets/README.md` (service-account key on the server, share the sheet with its email), then
`pm2 restart student-portal` and in the portal: Settings › Google Sheet › **Sync now**.

## 9. Backups
- Automatic: every start and every 6 hours → `backups/portal-backup-YYYY-MM-DD.json` (60 days kept).
- Nightly PostgreSQL dump (pg_dump): `crontab -e` → `30 2 * * * /var/www/student-portal/connectivity/deploy/backup-db.sh`
- Google Sheet: every sync also fills the **Backup (do not edit)** tab.
- In the portal: Settings › Data & backup (download / restore / Google Sheet).

## Moving your current records from the claude.ai portal
On claude.ai: Settings › Data & backup › **Download backup (.json)**. On Hostinger, either sign in as owner → Settings › Data & backup → **Restore from backup**,
or on the server: `npm run db:import -- /path/to/Student_Portal_Backup.json`. Logins are never taken from a backup file.

## Updating later
```bash
cd /var/www/student-portal
# copy the new files over (keep connectivity/config/.env, the key file and backups/)
npm run install:all && npm run build:frontend && pm2 restart student-portal
```

## If something goes wrong
| You see | Do this |
|---|---|
| `Could not connect to PostgreSQL` in `pm2 logs` | check DB_* in `connectivity/config/.env`; `sudo systemctl status postgresql` |
| Page says the server could not be reached | `pm2 status`; `pm2 restart student-portal` |
| 502 Bad Gateway | the backend is not running — `pm2 logs student-portal` |
| Owner password and recovery code both lost | `npm run reset-login` on the server |
| Google Sheet: "cannot edit this spreadsheet" | share the sheet with the service-account email as Editor |

Keep private: `connectivity/config/.env`, `connectivity/config/.secret`, `connectivity/google-sheets/service-account.json`, `backups/`.
