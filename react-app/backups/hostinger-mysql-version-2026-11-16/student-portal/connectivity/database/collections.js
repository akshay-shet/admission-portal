/* The portal's record types — the same list as frontend/src/store.jsx (COLLECTIONS) */
export const STUDENT_TABLES = ['sslc_students', 'puc_students', 'degree_students', 'pg_students'];
export const COLLECTIONS = [
  ...STUDENT_TABLES,
  'installments', 'boards', 'courses', 'combinations', 'settings',
  'enquiries', 'documents', 'exams', 'fee_plans', 'fee_dues', 'discounts', 'expenses',
  'cash_bank', 'approvals', 'employees', 'notifications', 'audit_logs',
];
/* Employee login: these are not even sent to the browser */
export const OWNER_READ = new Set(['expenses', 'cash_bank', 'approvals', 'audit_logs']);
/* Employee login: these can't be changed */
export const OWNER_WRITE = new Set(['settings', 'expenses', 'cash_bank', 'approvals', 'fee_plans', 'audit_logs']);
