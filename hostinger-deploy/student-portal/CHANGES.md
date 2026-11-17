# What changed for Hostinger — change tracking

**Pages, forms, fee logic, receipts, reports, Excel tracker, permissions and design are unchanged.**
The front end is the same React code as the live portal (claude.ai artifact v53).
The only change is *where records are kept and who checks the password*: on Hostinger that is the backend + MySQL,
instead of the claude.ai database. Every changed line is listed in `frontend-changes.diff`.

## Front end (`frontend/src`) — 7 files touched, storage/sign-in plumbing only

| File | Change | UI / logic effect |
|---|---|---|
| `store.jsx` | When the page is served by the backend, use `ApiBackend` (MySQL through `/api`) instead of the claude.ai database; on a real website without its backend, refuse to keep records in one browser (`NoServerBackend`); `useStore()` exposes `me`, `login`, `changeLogin`, `recover`, `importAll` when the backend is there | none — same pages, same data shape |
| `pages/Login.jsx` | With the backend, the password is sent to the server (`/api/login`), which checks it, applies the 5-tries lock and writes the Audit Log | same screen, same messages |
| `os/LoginSetup.jsx` | Changing the owner / employee login and "Forgot password?" go to the server (`/api/credentials`, `/api/recover`) | same forms, same rules, same recovery-code window |
| `App.jsx` | Log out also ends the session on the server; the signed-in check uses the server's answer; the red "starting password" warning reads a `weak` flag from the server (hashes never reach the browser) | same |
| `os/Settings.jsx` | Restore sends the backup to the server in one request (all or nothing); "Where records are saved" shows *MySQL database on your server*; one line in "How the logins are protected" | text only |
| `os/gsheet.js` | Google Sheets actions go to the backend (service account) when not on claude.ai — same five actions, same tabs, same Backup tab | same sync result |
| `os/GoogleSheet.jsx` | Shows the service-account email to share the sheet with; auto-sync also runs for an owner signed in to the backend | text only |

Other front-end files: unchanged. Build config: `vite.config.js` makes a normal multi-file build (`frontend/dist`) instead of one HTML file, and adds the `@connectivity` alias. `vite-plugin-singlefile` and `build-artifact.mjs` (claude.ai only) were removed from this copy.

## New: `backend/` (Node.js + Express)
Ported from the earlier PostgreSQL server (removed 13 Nov) and switched to MySQL. Same rules as the page: employees can't touch owner data, decided discounts, counted payments, a set fee or a student ID; owner-only data is never sent to the employee login; password hashes never leave the server; HMAC-signed 12-hour sessions; logout revokes the token; 5 wrong tries → 10-minute lock per login and per address; Audit Log entries for every change and every sign-in; security headers (CSP, HSTS, no framing); automatic JSON backups every 6 hours.

## New: `connectivity/`
- `config/` — `.env` settings (database, port, first logins, Google key path).
- `database/` — MySQL schema (`portal_records` + report views), connection pool, `npm run db:setup`, starting lists.
- `google-sheets/` — service-account client used by the backend.
- `api-client/` — the front end's link to the backend (bundled into the React app).
- `deploy/` — nginx site, PM2 file, nightly mysqldump, VPS preparation script.

## Not carried over (claude.ai only)
The claude.ai artifact database, the claude.ai Google Sheets connector and the single-file artifact build. The live claude.ai portal keeps working as it is.

## 17 Nov — runs as a Hostinger Business "Node.js web app" (MySQL) as well as on a VPS
Backend/config only; pages, forms, fee logic and design unchanged.
- `connectivity/config/env.js`: settings can come from hPanel Environment Variables only; on a web app (build folder under `hbuilds/`) server files go to `<domain>/portal-data` (kept across redeploys); listens on the port Hostinger gives; `DB_HOST` defaults to `localhost`; Google key from `GOOGLE_SERVICE_ACCOUNT_JSON` or `portal-data/service-account.json`.
- `connectivity/database/bootstrap.js` (new): first start on an empty database loads the starting lists and first logins — used by the server on start and by `npm run db:setup`.
- `connectivity/database/db.js`: report views are optional (skipped with a warning if the database user may not create views).
- `backend/server.js`: runs the start-up set-up; closes the live-update stream after 100 s on a web app (Hostinger's 120 s request limit; the page reconnects); clearer start-up messages.
- `connectivity/google-sheets/sheets.js`: accepts the key from `GOOGLE_SERVICE_ACCOUNT_JSON`.
- `package.json`: `build` script (installs and builds the front end) and `main`.
