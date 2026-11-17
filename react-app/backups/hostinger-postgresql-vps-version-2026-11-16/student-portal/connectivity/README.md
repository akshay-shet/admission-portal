# Connectivity

Everything that connects the front end, the backend, PostgreSQL and Google Sheets — kept apart so it is easy to configure.

| Folder | What |
|---|---|
| `config/` | `.env.example` → copy to `.env` (database, port, first logins, Google key). `env.js` reads it. |
| `database/` | `schema.sql` (table `portal_records` + views), `db.js` (PostgreSQL pool + record helpers), `setup.js` (`npm run db:setup`), `initial-data.json` (name, logo, boards, courses, combinations) |
| `google-sheets/` | `sheets.js` (service account → Google Sheets API), `README.md` (how to share the sheet) |
| `api-client/` | `apiBackend.js` — the React app's link to the backend (sign-in token, records, live updates, offline queue) |
| `deploy/` | nginx site, PM2 file, nightly `pg_dump`, VPS preparation |
