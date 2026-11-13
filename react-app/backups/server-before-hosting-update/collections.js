/* The portal's record types (one PostgreSQL table each) — same list as src/store.jsx */
export const STUDENT_TABLES = ['sslc_students', 'puc_students', 'degree_students', 'pg_students'];
export const LEVEL_OF = { sslc_students: 'sslc', puc_students: 'puc', degree_students: 'degree', pg_students: 'pg' };
/* records that belong to one student (linked through student_registry) */
export const LINKED = ['installments', 'fee_dues', 'discounts', 'documents', 'exams'];
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
