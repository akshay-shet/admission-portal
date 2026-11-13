# Student Portal – React

React (Vite) rebuild of the Student Admin Panel.
Login: **admin / admin**

## Run it
- **Quickest:** double-click `Student-Portal.html` (a ready-built, single-file copy of the app; data is saved in your browser).
- **Dev server:** install Node.js 18+, then in this folder:
  ```
  npm install
  npm run dev
  ```
  and open the URL it prints (usually http://localhost:5173).
- **Production build:** `npm run build` → `dist/index.html` (one self-contained file you can host anywhere).

## Screens
SSLC / PUC / Degree / PG student lists (date filter, search, sort, paging, Copy/CSV/Excel/PDF/Print),
add / edit / delete for each level (photo + marks-card upload, auto age), Manage Installments
(filters, page totals, Cash / Online / UPI / Cash+Online split, live balance), and Boards / Courses /
Combinations (hidden from the sidebar like the original; open them with `#boards`, `#courses`, `#combinations`).

## Data
There is no database server (the PostgreSQL connection was removed on 13 Nov 2026; the old files are in
`backups/removed-postgresql-2026-11-13/`). `src/store.jsx` is the only place that touches storage:
- running as a claude.ai Artifact → the artifact's shared database (live for everyone with access)
- opened anywhere else (Student-Portal.html, npm run dev) → this browser's localStorage only, starting with
  the boards / courses / combinations from `src/seed.js` and no students

Use Settings › Data & backup to download a backup file regularly and to restore it.

Logins are checked in the page against stored password hashes (PBKDF2). This is a front-door lock, not server-side security.

## Scanning documents
Every upload box has a **Scan** button next to **Choose File**.
1. Connect and switch on the scanner (it must work with the Windows "Scan" / WIA driver).
2. Double-click `scanner\Start-Scanner.bat` and keep that window open.
3. In the portal, press **Scan**. The Windows scan window opens (it can appear behind the browser):
   pick the scanner, preview, then Scan. The page is attached to that field as a JPEG.
If the helper isn't running, the portal offers **Use camera instead** (useful on phones and tablets).
Scanning works from `Student-Portal.html` or `npm run dev` on the PC with the scanner. The hosted
claude.ai page can't reach the scanner; use Choose File there.
