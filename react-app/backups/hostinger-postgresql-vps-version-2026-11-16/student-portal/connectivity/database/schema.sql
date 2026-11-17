-- Student Portal — PostgreSQL schema (run automatically by `npm run db:setup`; safe to run again)
-- Every portal record is one row: its record type (collection), its id and the record itself as JSON —
-- exactly the shape the React front end saves, so nothing about the portal's logic changes.

CREATE TABLE IF NOT EXISTS portal_records (
  collection  VARCHAR(40)  NOT NULL,
  id          VARCHAR(120) NOT NULL,
  data        JSONB        NOT NULL,
  created_at  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  created_by  VARCHAR(120) NULL,
  updated_by  VARCHAR(120) NULL,
  student_id  TEXT GENERATED ALWAYS AS (data->>'student_id') STORED,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_student ON portal_records (collection, student_id);
CREATE INDEX IF NOT EXISTS idx_created ON portal_records (collection, created_at);

-- keeps updated_at current on every change
CREATE OR REPLACE FUNCTION portal_records_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS portal_records_touch ON portal_records;
CREATE TRIGGER portal_records_touch BEFORE UPDATE ON portal_records FOR EACH ROW EXECUTE FUNCTION portal_records_touch();

-- Read-only views for reports in pgAdmin / Excel (the portal itself does not use them)
CREATE OR REPLACE VIEW v_students AS
  SELECT replace(collection, '_students', '') AS level, id,
         data->>'student_id'        AS student_id,
         data->>'admission_number'  AS admission_number,
         data->>'student_name'      AS student_name,
         data->>'mobile'            AS mobile,
         data->>'actual_fee'        AS actual_fee,
         data->>'next_payment_date' AS next_payment_date,
         created_at, updated_at
  FROM portal_records WHERE collection IN ('sslc_students', 'puc_students', 'degree_students', 'pg_students');

CREATE OR REPLACE VIEW v_payments AS
  SELECT id,
         data->>'student_id'     AS student_id,
         data->>'student_name'   AS student_name,
         data->>'payment_date'   AS payment_date,
         data->>'installment_no' AS payment_no,
         data->>'amount'         AS amount,
         data->>'payment_mode'   AS payment_mode,
         data->>'status'         AS status,
         created_at
  FROM portal_records WHERE collection = 'installments';
