/* Academy OS: Owner / Employee logins, navigation map and page permissions */
/* Two logins: Owner (everything) and Employee (day-to-day work; owner-only pages are hidden completely) */
export const ROLES = ['Owner', 'Employee'];
export const ROLE_KEY = 'student-portal-role';
export const readRole = () => { try { return sessionStorage.getItem(ROLE_KEY) === 'Employee' ? 'Employee' : 'Owner'; } catch { return 'Owner'; } };
export const saveRole = (r) => { try { sessionStorage.setItem(ROLE_KEY, r === 'Employee' ? 'Employee' : 'Owner'); } catch { /* ignore */ } };

export const OS_TITLES = {
  overview: 'Dashboard', 'system-map': 'System Map', enquiries: 'Enquiries', 'new-admission': 'New Admission',
  'all-students': 'All Students', documents: 'Student Documents', exams: 'Examinations',
  'fee-dashboard': 'Fee Dashboard', 'fee-accounts': 'Student Fee Accounts', 'fee-plans': 'Fee Plans',
  payments: 'Payments & Receipts', 'pending-fees': 'Pending Fees', discounts: 'Discounts & Refunds',
  expenses: 'Expenses & Vendors', 'cash-bank': 'Cash & Bank', 'finance-reports': 'Finance Reports',
  approvals: 'Approvals', employees: 'Employees & Roles', notifications: 'Notifications', settings: 'Settings', 'audit-logs': 'Audit Logs',
};

/** Sidebar: new Academy OS sections around the existing student and installment screens */
export const NAV = [
  { section: 'Overview', items: [['os', 'overview', 'dashboard'], ['os', 'system-map', 'map']] },
  { section: 'Admissions', items: [['os', 'enquiries', 'enquiry'], ['os', 'new-admission', 'userPlus'], ['os', 'all-students', 'users']] },
  { section: 'Students', items: [['students', 'sslc', 'school'], ['students', 'puc', 'book'], ['students', 'degree', 'cap'], ['students', 'pg', 'award']] },
  { section: 'Academics', items: [['os', 'documents', 'file'], ['os', 'exams', 'exam']] },
  {
    section: 'Fees & Finance',
    items: [['os', 'fee-dashboard', 'chart'], ['os', 'fee-accounts', 'wallet'], ['os', 'fee-plans', 'layers'], ['collect', 'collect', 'rupee'],
      ['installments', 'installments', 'list'], ['os', 'payments', 'receipt'], ['os', 'pending-fees', 'clock'], ['os', 'discounts', 'undo'],
      ['os', 'expenses', 'trend'], ['os', 'cash-bank', 'bank'], ['os', 'finance-reports', 'report']],
  },
  { section: 'Management', items: [['os', 'approvals', 'check'], ['os', 'employees', 'idcard'], ['os', 'notifications', 'bell'], ['os', 'settings', 'settings'], ['os', 'audit-logs', 'history']] },
];

/** Pages an Employee login can never see (not in the menu, not by link) */
export const OWNER_ONLY = new Set(['overview', 'fee-dashboard', 'fee-accounts', 'cash-bank', 'expenses', 'finance-reports', 'approvals', 'settings', 'audit-logs']);

/** key of a route for permission checks */
export function routeKey(r) {
  if (r.page === 'os') return r.key;
  if (r.page === 'installments' || r.page?.startsWith('inst')) return r.page === 'inst-add' && !r.studentId ? 'collect' : 'installments';
  return 'students';
}

export function permitted(key, role) {
  return role !== 'Employee' || !OWNER_ONLY.has(key);
}
export const canMoney = () => true; // both logins collect fees and see payments
export const isOwner = (role) => role !== 'Employee';
/** First page after login / when a page is not allowed */
export const homeRoute = (role) => (role === 'Employee' ? { page: 'os', key: 'all-students' } : { page: 'os', key: 'overview' });

/** Login type of this browser tab (used outside React, e.g. by the data layer) */
export const currentRole = () => readRole();
/** Payments: an employee may change or delete a payment only while it is still waiting for the owner's check */
export const employeeMayChangePayment = (r) => !r || r.status === 'Pending';
/** Discounts: an employee's requests stay Pending until the owner approves them; decided ones are owner-only */
export const employeeMayChangeDiscount = (r) => !r || r.status === 'Pending';
