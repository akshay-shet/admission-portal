SET client_min_messages = warning;
-- Student Portal · PostgreSQL schema
-- Every record type is a table: id + the record as JSONB (so fields added with "Customize" are kept) +
-- typed columns PostgreSQL works out from the record for linking, searching and reports.
-- Safe to run again: everything is CREATE ... IF NOT EXISTS / CREATE OR REPLACE.

-- ---------- helpers: turn the stored text into numbers and dates ----------
CREATE OR REPLACE FUNCTION sp_num(t text) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL THEN NULL
    ELSE NULLIF(regexp_replace(t, '[^0-9.\-]', '', 'g'), '')::numeric END $$;
CREATE OR REPLACE FUNCTION sp_date(t text) RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
  IF t ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN substr(t, 1, 10)::date; END IF;
  IF t ~ '^\d{2}[-/]\d{2}[-/]\d{4}' THEN RETURN make_date(substr(t, 7, 4)::int, substr(t, 4, 2)::int, substr(t, 1, 2)::int); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- ---------- one row per student id, used by every linked record ----------
CREATE TABLE IF NOT EXISTS student_registry (
  student_id       text PRIMARY KEY,
  level            text,          -- sslc / puc / degree / pg / unknown
  source_table     text,
  record_id        text,
  student_name     text,
  admission_number text,
  deleted          boolean NOT NULL DEFAULT false,   -- student removed; their payments etc. stay linked
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------- record tables ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sslc_students','puc_students','degree_students','pg_students','installments','boards','courses',
    'combinations','settings','enquiries','documents','exams','fee_plans','fee_dues','discounts','expenses','cash_bank',
    'approvals','employees','notifications','audit_logs'] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I (
      id text PRIMARY KEY,
      data jsonb NOT NULL DEFAULT ''{}''::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_by text, updated_by text)', t);
  END LOOP;
END $$;

-- typed columns (generated from the JSON, always in step with it)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sslc_students','puc_students','degree_students','pg_students'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS student_id text GENERATED ALWAYS AS (data->>''student_id'') STORED', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS student_name text GENERATED ALWAYS AS (data->>''student_name'') STORED', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS admission_number text GENERATED ALWAYS AS (data->>''admission_number'') STORED', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS mobile text GENERATED ALWAYS AS (data->>''mobile'') STORED', t);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (student_id) WHERE student_id IS NOT NULL', t || '_student_id_uq', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (admission_number)', t || '_admno_ix', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['installments','fee_dues','discounts','documents','exams'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS student_id text GENERATED ALWAYS AS (NULLIF(data->>''student_id'', '''')) STORED', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (student_id)', t || '_student_ix', t);
  END LOOP;
END $$;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS amount numeric GENERATED ALWAYS AS (sp_num(data->>'amount')) STORED;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS total_fees numeric GENERATED ALWAYS AS (sp_num(data->>'total_fees')) STORED;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS (COALESCE(NULLIF(data->>'status', ''), 'Paid')) STORED;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS payment_date date GENERATED ALWAYS AS (sp_date(data->>'payment_date')) STORED;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS payment_mode text GENERATED ALWAYS AS (data->>'payment_mode') STORED;
ALTER TABLE fee_dues ADD COLUMN IF NOT EXISTS amount numeric GENERATED ALWAYS AS (sp_num(data->>'amount')) STORED;
ALTER TABLE fee_dues ADD COLUMN IF NOT EXISTS due_date date GENERATED ALWAYS AS (sp_date(data->>'due_date')) STORED;
ALTER TABLE fee_dues ADD COLUMN IF NOT EXISTS installment_no text GENERATED ALWAYS AS (data->>'installment_no') STORED;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS amount numeric GENERATED ALWAYS AS (sp_num(data->>'amount')) STORED;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS type text GENERATED ALWAYS AS (data->>'type') STORED;
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS (data->>'status') STORED;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount numeric GENERATED ALWAYS AS (sp_num(data->>'amount')) STORED;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status text GENERATED ALWAYS AS (data->>'status') STORED;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date date GENERATED ALWAYS AS (sp_date(data->>'expense_date')) STORED;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS at text GENERATED ALWAYS AS (data->>'at') STORED; -- ISO time, sorts correctly as text
CREATE INDEX IF NOT EXISTS installments_date_ix ON installments (payment_date);
CREATE INDEX IF NOT EXISTS fee_dues_date_ix ON fee_dues (due_date);
CREATE INDEX IF NOT EXISTS audit_logs_at_ix ON audit_logs (at DESC);

-- ---------- keep student_registry in step with the four student tables ----------
CREATE OR REPLACE FUNCTION sp_student_sync() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lvl text := CASE TG_TABLE_NAME WHEN 'sslc_students' THEN 'sslc' WHEN 'puc_students' THEN 'puc' WHEN 'degree_students' THEN 'degree' ELSE 'pg' END;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE student_registry SET deleted = true, updated_at = now() WHERE student_id = OLD.data->>'student_id';
    RETURN OLD;
  END IF;
  IF NEW.data->>'student_id' IS NOT NULL AND NEW.data->>'student_id' <> '' THEN
    INSERT INTO student_registry (student_id, level, source_table, record_id, student_name, admission_number, deleted, updated_at)
    VALUES (NEW.data->>'student_id', lvl, TG_TABLE_NAME, NEW.id, NEW.data->>'student_name', NEW.data->>'admission_number', false, now())
    ON CONFLICT (student_id) DO UPDATE SET level = EXCLUDED.level, source_table = EXCLUDED.source_table, record_id = EXCLUDED.record_id,
      student_name = EXCLUDED.student_name, admission_number = EXCLUDED.admission_number, deleted = false, updated_at = now();
  END IF;
  RETURN NEW;
END $$;

-- a payment / due / discount / document / exam for a student id nobody has registered yet still gets a registry row
CREATE OR REPLACE FUNCTION sp_link_student() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data->>'student_id' IS NOT NULL AND NEW.data->>'student_id' <> '' THEN
    INSERT INTO student_registry (student_id, level, student_name, admission_number)
    VALUES (NEW.data->>'student_id', 'unknown', NEW.data->>'student_name', NEW.data->>'admission_number')
    ON CONFLICT (student_id) DO NOTHING;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sslc_students','puc_students','degree_students','pg_students'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_sync', t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION sp_student_sync()', t || '_sync', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['installments','fee_dues','discounts','documents','exams'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_link', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sp_link_student()', t || '_link', t);
    -- the link itself: every linked record points at a registered student
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_student_fk') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (student_id) REFERENCES student_registry (student_id)', t, t || '_student_fk');
    END IF;
  END LOOP;
END $$;

-- ---------- views: the linked data, ready for reports (pgAdmin, Excel, Power BI …) ----------
DROP VIEW IF EXISTS v_unlinked_records, v_due_schedule, v_payments, v_fee_accounts, v_students CASCADE;

CREATE VIEW v_students AS
  SELECT r.student_id, r.level, r.student_name, r.admission_number, r.deleted,
         s.data->>'mobile' AS mobile, s.data->>'admission_year' AS admission_year, s.data->>'admission_batch' AS admission_batch,
         s.data->>'course_id' AS course, sp_num(s.data->>'actual_fee') AS actual_fee, sp_date(s.data->>'next_payment_date') AS next_payment_date,
         s.data AS record
  FROM student_registry r
  LEFT JOIN (
    SELECT id, data FROM sslc_students UNION ALL SELECT id, data FROM puc_students
    UNION ALL SELECT id, data FROM degree_students UNION ALL SELECT id, data FROM pg_students
  ) s ON s.id = r.record_id;

-- PAY AS YOU GO, same rules as the portal: actual fee (the student's own fee; else the fee on their latest payment; else an old due schedule)
-- − approved discount = total fee; balance = total fee − paid. No fixed installments: a follow-up is due when the
-- student's own next payment date has passed (after the grace days in Settings) and money is still owed.
CREATE VIEW v_fee_accounts AS
  WITH last_pay AS (
    SELECT DISTINCT ON (student_id) student_id, total_fees FROM installments
    WHERE student_id IS NOT NULL ORDER BY student_id, data->>'created_at' DESC NULLS LAST, created_at DESC
  ), dues AS (SELECT student_id, SUM(amount) AS scheduled FROM fee_dues GROUP BY student_id),
  paid AS (SELECT student_id,
                  SUM(amount) FILTER (WHERE status NOT IN ('Pending', 'Rejected')) AS received,
                  SUM(amount) FILTER (WHERE status = 'Pending') AS pending,
                  COUNT(*) FILTER (WHERE status NOT IN ('Pending', 'Rejected') AND amount > 0) AS payments,
                  MAX(payment_date) FILTER (WHERE status NOT IN ('Pending', 'Rejected') AND amount > 0) AS last_payment_date
           FROM installments GROUP BY student_id),
  disc AS (SELECT student_id, SUM(amount) FILTER (WHERE status = 'Approved' AND type IS DISTINCT FROM 'Refund') AS discount,
                  SUM(amount) FILTER (WHERE status = 'Approved' AND type = 'Refund') AS refund FROM discounts GROUP BY student_id),
  grace AS (SELECT COALESCE(sp_num((SELECT data->'academy'->>'grace_days' FROM settings WHERE id = 'academy-settings')), 0)::int AS days),
  base AS (
    SELECT s.student_id, s.student_name, s.admission_number, s.level, s.deleted, s.next_payment_date,
           COALESCE(NULLIF(s.actual_fee, 0), NULLIF(lp.total_fees, 0), d.scheduled, 0) AS actual_fee,
           COALESCE(di.discount, 0) AS discount, COALESCE(p.received, 0) - COALESCE(di.refund, 0) AS paid,
           COALESCE(p.pending, 0) AS awaiting_verification, COALESCE(p.payments, 0) AS payments, p.last_payment_date
    FROM v_students s
    LEFT JOIN last_pay lp ON lp.student_id = s.student_id
    LEFT JOIN dues d ON d.student_id = s.student_id
    LEFT JOIN paid p ON p.student_id = s.student_id
    LEFT JOIN disc di ON di.student_id = s.student_id
  )
  SELECT b.student_id, b.student_name, b.admission_number, b.level, b.deleted,
         b.actual_fee, b.discount, GREATEST(0, b.actual_fee - b.discount) AS total_fee, b.paid, b.awaiting_verification,
         GREATEST(0, b.actual_fee - b.discount - b.paid) AS balance,
         CASE WHEN GREATEST(0, b.actual_fee - b.discount) > 0 THEN ROUND(100 * b.paid / GREATEST(0, b.actual_fee - b.discount), 1) END AS paid_pct,
         b.payments, CASE WHEN b.payments > 0 THEN ROUND(b.paid / b.payments, 2) END AS average_payment,
         b.last_payment_date, CURRENT_DATE - b.last_payment_date AS days_since_last_payment,
         CASE WHEN GREATEST(0, b.actual_fee - b.discount - b.paid) > 0 THEN b.next_payment_date END AS next_payment_date,
         (GREATEST(0, b.actual_fee - b.discount - b.paid) > 0 AND b.next_payment_date IS NOT NULL AND b.next_payment_date < CURRENT_DATE - (SELECT days FROM grace)) AS follow_up_due,
         CASE WHEN b.actual_fee = 0 THEN 'No Fee Set'
              WHEN GREATEST(0, b.actual_fee - b.discount - b.paid) = 0 THEN 'Fully Paid'
              WHEN b.next_payment_date IS NOT NULL AND b.next_payment_date < CURRENT_DATE - (SELECT days FROM grace) THEN 'Follow-up due'
              WHEN b.paid > 0 THEN 'Part Paid' ELSE 'Unpaid' END AS status
  FROM base b;

CREATE VIEW v_payments AS
  SELECT i.id, i.student_id, r.student_name, r.admission_number, r.level, i.payment_date, i.amount, i.payment_mode, i.status,
         i.data->>'installment_no' AS installment_no, i.data->>'reference' AS reference, i.created_by, i.created_at
  FROM installments i LEFT JOIN student_registry r ON r.student_id = i.student_id;

-- old installment plans made before pay-as-you-go (kept for history only)
CREATE VIEW v_due_schedule AS
  SELECT f.id, f.student_id, r.student_name, r.admission_number, f.installment_no, f.due_date, f.amount
  FROM fee_dues f LEFT JOIN student_registry r ON r.student_id = f.student_id;

-- records whose student was deleted or never registered (kept on purpose, listed here for checking)
CREATE VIEW v_unlinked_records AS
  SELECT 'installments' AS record_type, i.id, i.student_id, r.level, r.deleted FROM installments i JOIN student_registry r USING (student_id) WHERE r.deleted OR r.level = 'unknown'
  UNION ALL SELECT 'fee_dues', f.id, f.student_id, r.level, r.deleted FROM fee_dues f JOIN student_registry r USING (student_id) WHERE r.deleted OR r.level = 'unknown'
  UNION ALL SELECT 'discounts', d.id, d.student_id, r.level, r.deleted FROM discounts d JOIN student_registry r USING (student_id) WHERE r.deleted OR r.level = 'unknown'
  UNION ALL SELECT 'documents', d.id, d.student_id, r.level, r.deleted FROM documents d JOIN student_registry r USING (student_id) WHERE r.deleted OR r.level = 'unknown'
  UNION ALL SELECT 'exams', e.id, e.student_id, r.level, r.deleted FROM exams e JOIN student_registry r USING (student_id) WHERE r.deleted OR r.level = 'unknown';
