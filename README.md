# Student Portal (Admission Portal)

PHP + MySQL admin panel: SSLC / PUC / Degree / PG student records and fee installments.

## Setup (XAMPP / WAMP / any PHP 7.4+ host)
1. Copy this folder into your web root (e.g. `C:\xampp\htdocs\admission-portal`).
2. Import `database.sql` in phpMyAdmin (creates the `student_portal` database with tables, lookups and 4 sample students).
3. Edit `config.php` with your MySQL host/user/password. If the app lives in a sub-folder, set `BASE_URL`
   (e.g. `define('BASE_URL', '/admission-portal');`).
4. Open the site and log in with **admin / admin** – change the password afterwards:
   `UPDATE admins SET password = '<output of password_hash()>' WHERE username='admin';`
5. Make sure the `uploads/` folder is writable (photos and marks cards are saved there).

## Pages
| URL | Purpose |
|---|---|
| `/` (index.php) | Admin login |
| `dashboard.php?tab=sslc / puc / degree / pg` | Student lists with date filter + DataTables export (Copy/CSV/Excel/PDF/Print) |
| `sslc|puc|degree|pg/add.php, edit.php?id=, delete.php?id=` | Student CRUD (photo & marks-card uploads, auto age from DOB) |
| `installments/manage_installments.php` | Fee installments list, filters (last week/month, dates, board, course, combination), footer totals |
| `installments/add_installment.php, edit_installment.php?id=, delete_installment.php?id=` | Installment CRUD (Cash / Online / UPI / Cash+Online split) |
| `installments/get_student_paid.php`, `get_installment_paid.php` | JSON helpers for live balance calculation |
| `boards/`, `courses/`, `combinations/` manage/add/edit | Lookup tables (hidden from the sidebar, as in the original) |
| `logout.php` | Sign out |

Student codes are generated automatically: SSL001, PUC001, DEG001, PGO001.
