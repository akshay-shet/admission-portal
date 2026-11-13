# Student Portal on PostgreSQL

The portal now saves every record in a PostgreSQL database through a small Node.js server
(`server/` folder). Open the portal at **http://localhost:3000** — every computer on your network
can use the same data at **http://<this-PC's-IP>:3000**.

## One-time setup (Windows)

1. **Install PostgreSQL** (skip if it is already installed)
   - Download the Windows installer from https://www.postgresql.org/download/windows/ (version 14 or newer).
   - Keep the defaults (port **5432**, user **postgres**) and write down the password you choose.
2. **Install Node.js 20 or newer** (skip if `node -v` already works) — https://nodejs.org (LTS).
3. **Double-click `setup-database.bat`** in `D:\Admission Portal\react-app` and type your PostgreSQL password when asked.
   It saves the connection in `server\.env`, installs the packages, creates the `student_portal` database with all
   tables, links and views, **loads the records copied from the online portal** (`server\initial-data.json`, only into an
   empty database) and builds the page.
4. (Skipped — step 3 does it.)
5. **Double-click `start-portal.bat`** and open **http://localhost:3000**.
   First login: Owner **admin / admin**, Employee **employee / employee** — change both in Settings › Login & security.

## Bring your existing records across

The records from the online portal (as of 12-11-2026, including the logo and photos) are already loaded by `setup-database.bat`.
To copy anything added later:


1. In the portal you used until now (the online one or the old copy), go to **Settings › Data & backup › Download backup (.json)**.
2. In the new portal (http://localhost:3000), sign in as Owner → **Settings › Data & backup › Restore from backup** and pick that file.
   Or from a command window: `npm run db:import -- "C:\Users\you\Downloads\Student_Portal_Backup_2026-11-12.json"`

Logins are never copied from a backup file — the database keeps its own.

## What is in the database

| Table | What it holds |
|---|---|
| `sslc_students`, `puc_students`, `degree_students`, `pg_students` | Student admissions (one table per level) |
| `student_registry` | One row per student ID — every payment, due date, discount, document and exam is **linked** to it (foreign key) |
| `installments` | Payments (amount, status, date, mode are real columns) |
| `fee_dues` | Installment plan due dates |
| `discounts` | Discounts, scholarships, waivers, refunds |
| `fee_plans`, `enquiries`, `documents`, `exams`, `expenses`, `cash_bank`, `approvals`, `employees`, `notifications`, `settings`, `boards`, `courses`, `combinations` | The other portal modules |
| `audit_logs` | Written by the server: who (and Owner/Employee) added, changed or deleted what |

Each table keeps the full record in a `data` (JSONB) column, so fields added with **Customize** are saved too,
plus typed columns for linking and reports (`student_id`, `amount`, `status`, `payment_date`, `due_date` …),
and `created_at / updated_at / created_by / updated_by`.

Ready-made views (open them in pgAdmin, Excel or Power BI):

- `v_students` — every student with level and main details
- `v_fee_accounts` — actual fee, discount, total fee, paid, awaiting verification and balance per student (same rules as the portal)
- `v_payments` — payments with the student's name and admission number
- `v_due_schedule` — installment due dates per student
- `v_unlinked_records` — payments etc. whose student was deleted or never added (kept on purpose, listed for checking)

## Security

- Passwords are checked by the server; the browser never receives the password hashes.
- After sign-in the server issues a signed session (12 hours). Changing a login's password signs out everyone using it.
- **Every save is checked by the server** with the Owner / Employee rules (employees can't change settings, expenses,
  cash & bank, approvals, fee plan prices or the audit log; can't verify, reject, edit or delete counted payments;
  discounts they enter stay Pending; they can't lower a student's fee; can't delete a student who has payments).
- Expenses, Cash & Bank, Approvals and the Audit Log are not even sent to an Employee's browser.
- 8 wrong passwords from one computer → 10-minute wait.

## Every day

- Start: double-click `start-portal.bat` (keep the black window open while the portal is in use).
- Back up: PostgreSQL's own backup (`pg_dump student_portal > backup.sql`) or the portal's **Download backup**.
- Development: `npm start` (server, port 3000) and `npm run dev` (page with live reload; `/api` is passed to the server).

## If something goes wrong

| Message | Fix |
|---|---|
| `Could not connect to PostgreSQL: password authentication failed` | Wrong password in `server\.env` |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running — start the "postgresql" service (Windows Services) |
| `Run "npm run build" first` | Double-click `setup-database.bat` again |
| Other computers can't open it | Allow port 3000 in Windows Firewall, use `http://<this-PC's-IP>:3000` |

## Logins and security (12 Nov 2026)

- **First sign-in:** Owner Login with `admin` / `admin`. The portal then makes you choose your own owner username and password (8+ characters, letters and numbers) and shows a **recovery code**. Save that code. After this, admin / admin stops working.
- **Employee login:** there is no starting employee login. The owner sets it in Settings › Login & security (and can change it or turn it off there). Changing it signs out staff who used the old details.
- **Forgot the owner password:** Owner Login › *Forgot password?* → owner username + recovery code → new password (a new recovery code is shown).
- **Lost both password and recovery code:** on this PC double-click `reset-owner-login.bat`.
- Passwords are stored only as PBKDF2 hashes and never leave the server. 5 wrong tries → 10-minute wait.
- Logging out never deletes data. Settings saves, backups and restores never change the logins.

## Automatic backups

Every start of the portal, and every 6 hours while it runs, all records are saved to `backups\portal-backup-YYYY-MM-DD.json` (last 60 days kept). To restore: Settings › Data & backup › Restore from backup.

## One-time clean-up

`server\CLEAR_ALL_RECORDS.flag` tells the server to remove all old/test records (students, payments, etc.) on its next start, after saving a full backup in `backups\`. Settings, logins, boards, courses and combinations are kept. The file then renames itself to `CLEAR_ALL_RECORDS.done-<date>.txt`.
