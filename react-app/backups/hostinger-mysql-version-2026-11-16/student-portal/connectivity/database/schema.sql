-- Student Portal — MySQL / MariaDB schema (run automatically by `npm run db:setup`; safe to run again)
-- Every portal record is one row: its record type (collection), its id and the record itself as JSON —
-- exactly the shape the React front end saves, so nothing about the portal's logic changes.

CREATE TABLE IF NOT EXISTS portal_records (
  collection  VARCHAR(40)  NOT NULL,
  id          VARCHAR(120) NOT NULL,
  data        JSON         NOT NULL,
  created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  created_by  VARCHAR(120) NULL,
  updated_by  VARCHAR(120) NULL,
  student_id  VARCHAR(64)  AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.student_id'))) STORED,
  PRIMARY KEY (collection, id),
  KEY idx_student (collection, student_id),
  KEY idx_created (collection, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Read-only views for reports in phpMyAdmin / Excel (the portal itself does not use them)
CREATE OR REPLACE VIEW v_students AS
  SELECT REPLACE(collection, '_students', '') AS level, id,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.student_id'))       AS student_id,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.admission_number')) AS admission_number,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.student_name'))     AS student_name,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.mobile'))           AS mobile,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.actual_fee'))       AS actual_fee,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.next_payment_date')) AS next_payment_date,
         created_at, updated_at
  FROM portal_records WHERE collection IN ('sslc_students', 'puc_students', 'degree_students', 'pg_students');

CREATE OR REPLACE VIEW v_payments AS
  SELECT id,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.student_id'))     AS student_id,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.student_name'))   AS student_name,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.payment_date'))   AS payment_date,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.installment_no')) AS payment_no,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.amount'))         AS amount,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.payment_mode'))   AS payment_mode,
         JSON_UNQUOTE(JSON_EXTRACT(data, '$.status'))         AS status,
         created_at
  FROM portal_records WHERE collection = 'installments';
