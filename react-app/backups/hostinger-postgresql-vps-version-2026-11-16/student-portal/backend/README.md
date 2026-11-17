# Backend (Node.js + Express)

- `server.js` — the API (`/api/...`), live updates, security headers, and the built React app.
- `auth.js` — password hashing (PBKDF2-SHA256), signed sessions, logout, sign-in limits, recovery codes.
- `rules.js` — what the Employee login may and may not change (checked on every save).
- `backup.js` — automatic JSON backups. `import.js` — `npm run db:import -- file.json`. `reset-login.js` — `npm run reset-login`.

Uses `connectivity/config` (settings), `connectivity/database` (PostgreSQL) and `connectivity/google-sheets` (Sheets).
Start: `npm start` in the project folder (PM2 in production).
