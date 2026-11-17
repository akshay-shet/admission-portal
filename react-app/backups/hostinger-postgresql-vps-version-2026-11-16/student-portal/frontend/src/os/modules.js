/* Academy OS: record modules (fields of each form and columns of each list) */
const PROGRAMS = ['SSLC', 'PUC Science', 'PUC Commerce', 'PUC Arts', 'Degree', 'PG', 'Other'];

export const MODULES = {
  enquiries: {
    collection: 'enquiries', filters: ['interest'], title: 'Enquiries', single: 'Enquiry', addLabel: 'Add Enquiry', numberField: 'enquiry_no', prefix: 'ENQ-',
    defaults: { status: 'New' }, filterKey: 'status', filterOptions: ['New', 'Contacted', 'Follow-up', 'Converted', 'Closed'],
    fields: [
      { name: 'enquiry_no', label: 'Enquiry ID', readOnly: true },
      { name: 'name', label: 'Prospect name', required: true },
      { name: 'mobile', label: 'Mobile' },
      { name: 'guardian', label: 'Parent / Guardian' },
      { name: 'interest', label: 'Interested in', type: 'select', options: PROGRAMS },
      { name: 'source', label: 'Lead source', type: 'select', options: ['Walk-in', 'Meta Ads', 'WhatsApp', 'Phone', 'Referral', 'Website', 'Other'] },
      { name: 'assigned', label: 'Assigned counsellor', type: 'staff' },
      { name: 'follow_up', label: 'Next follow-up', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['New', 'Contacted', 'Follow-up', 'Converted', 'Closed'] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { title: 'ID', key: 'enquiry_no' }, { title: 'Enquiry', key: 'name' }, { title: 'Mobile', key: 'mobile' },
      { title: 'Interest', key: 'interest' }, { title: 'Source', key: 'source' }, { title: 'Assigned', key: 'assigned' },
      { title: 'Follow-up', key: 'follow_up', date: true }, { title: 'Status', key: 'status', chip: true },
    ],
  },

  documents: {
    collection: 'documents', filters: ['document'], title: 'Student Documents', single: 'Document', addLabel: 'Add Document Record',
    defaults: { verification: 'Pending' }, filterKey: 'verification', filterOptions: ['Pending', 'Verified', 'Rejected', 'Missing'],
    fields: [
      { name: 'student', label: 'Student', type: 'student', required: true, full: true },
      { name: 'document', label: 'Document', type: 'select', required: true, options: ['Transfer Certificate (TC)', 'Marks Card', 'Aadhar Card', 'Study Certificate', 'Income & Caste Certificate', 'Birth Certificate', 'Photo', 'Migration Certificate', 'Other'] },
      { name: 'submitted_on', label: 'Submitted on', type: 'date', today: true },
      { name: 'verification', label: 'Verification', type: 'select', options: ['Pending', 'Verified', 'Rejected', 'Missing'] },
      { name: 'verified_by', label: 'Verified by', type: 'staff' },
      { name: 'notes', label: 'Remarks', type: 'textarea' },
    ],
    columns: [
      { title: 'Student', key: 'student_name' }, { title: 'Admission no', key: 'admission_number' }, { title: 'Program', key: 'program' },
      { title: 'Document', key: 'document' }, { title: 'Submitted', key: 'submitted_on', date: true },
      { title: 'Verification', key: 'verification', chip: true }, { title: 'Verified by', key: 'verified_by' },
    ],
  },

  exams: {
    collection: 'exams', filters: ['result'], title: 'Examinations', single: 'Exam Record', addLabel: 'Add Exam Record',
    defaults: { registration: 'Pending', result: 'Awaited' }, filterKey: 'registration', filterOptions: ['Pending', 'Submitted', 'Confirmed'],
    fields: [
      { name: 'student', label: 'Student', type: 'student', required: true, full: true },
      { name: 'exam', label: 'Exam', required: true },
      { name: 'registration', label: 'Registration', type: 'select', options: ['Pending', 'Submitted', 'Confirmed'] },
      { name: 'exam_fee', label: 'Exam fee (₹)', type: 'amount' },
      { name: 'exam_date', label: 'Exam date', type: 'date' },
      { name: 'hall_ticket', label: 'Hall ticket no' },
      { name: 'result', label: 'Result', type: 'select', options: ['Awaited', 'Pass', 'Fail', 'Absent'] },
      { name: 'marks', label: 'Marks / Grade' },
      { name: 'notes', label: 'Remarks', type: 'textarea' },
    ],
    columns: [
      { title: 'Student', key: 'student_name' }, { title: 'Program', key: 'program' }, { title: 'Exam', key: 'exam' },
      { title: 'Registration', key: 'registration', chip: true }, { title: 'Exam Date', key: 'exam_date', date: true },
      { title: 'Hall ticket', key: 'hall_ticket' }, { title: 'Result', key: 'result', chip: true }, { title: 'Marks', key: 'marks' },
    ],
  },

  fee_plans: {
    collection: 'fee_plans', filters: ['program'], title: 'Fee Plans', single: 'Fee Plan', addLabel: 'New Fee Plan',
    defaults: { status: 'Active' }, filterKey: 'status',
    fields: [
      { name: 'plan', label: 'Plan name', required: true },
      { name: 'program', label: 'Program', type: 'select', options: PROGRAMS },
      { name: 'total', label: 'Actual fee (₹)', type: 'amount', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { title: 'Plan', key: 'plan' }, { title: 'Program', key: 'program' }, { title: 'Actual fee', key: 'total', amount: true },
      { title: 'Notes', key: 'notes' }, { title: 'Status', key: 'status', chip: true },
    ],
  },

  fee_dues: {
    collection: 'fee_dues', filters: ['program'], title: 'Installment Due Schedule', single: 'Due Installment', addLabel: 'Add Due',
    sort: (a, b) => String(a.student_name || '').localeCompare(String(b.student_name || '')) || String(a.due_date || '').localeCompare(String(b.due_date || '')),
    fields: [
      { name: 'student', label: 'Student', type: 'student', required: true, full: true },
      { name: 'installment_no', label: 'Installment no' },
      { name: 'due_date', label: 'Due date', type: 'date', required: true },
      { name: 'amount', label: 'Amount (₹)', type: 'amount', required: true },
      { name: 'plan', label: 'Fee plan' },
    ],
    columns: [],
  },

  discounts: {
    collection: 'discounts', filters: ['type'], title: 'Discounts & Refunds', single: 'Request', addLabel: 'New Request', numberField: 'request_no', prefix: 'REQ-',
    defaults: { status: 'Pending', type: 'Discount' }, filterKey: 'status', filterOptions: ['Pending', 'Approved', 'Rejected'],
    fields: [
      { name: 'request_no', label: 'Request ID', readOnly: true },
      { name: 'type', label: 'Type', type: 'select', options: ['Discount', 'Scholarship', 'Waiver', 'Refund'] },
      { name: 'student', label: 'Student', type: 'student', required: true, full: true },
      { name: 'amount', label: 'Amount (₹)', type: 'amount', required: true },
      { name: 'requested_by', label: 'Requested by', type: 'staff' },
      { name: 'reason', label: 'Reason', type: 'textarea', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
    columns: [
      { title: 'Request', key: 'request_no' }, { title: 'Student', key: 'student_name' }, { title: 'Type', key: 'type' },
      { title: 'Amount', key: 'amount', amount: true }, { title: 'Reason', key: 'reason' }, { title: 'Requested by', key: 'requested_by' },
      { title: 'Status', key: 'status', chip: true },
    ],
  },

  expenses: {
    collection: 'expenses', filters: ['category'], title: 'Expenses & Vendors', single: 'Expense', addLabel: 'New Expense', numberField: 'expense_no', prefix: 'EXP-',
    defaults: { status: 'Submitted' }, filterKey: 'status', filterOptions: ['Submitted', 'Pending', 'Approved', 'Paid', 'Rejected'],
    // Settings > expense approval threshold: new expenses up to that amount are approved automatically
    beforeSave: (row, data, isNew) => {
      const lim = Number((data.settings || []).find((r) => r.id === 'academy-settings')?.academy?.expense_threshold || 0);
      return isNew && lim > 0 && row.status === 'Submitted' && Number(row.amount || 0) <= lim ? { ...row, status: 'Approved' } : row;
    },
    fields: [
      { name: 'expense_no', label: 'Expense ID', readOnly: true },
      { name: 'expense', label: 'Expense', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Board / Exam Fees', 'Rent', 'Salary', 'Utilities', 'Marketing', 'Stationery', 'Maintenance', 'Travel', 'Other'] },
      { name: 'vendor', label: 'Vendor / Payee' },
      { name: 'amount', label: 'Amount (₹)', type: 'amount', required: true },
      { name: 'expense_date', label: 'Date', type: 'date', today: true },
      { name: 'paid_via', label: 'Paid via', type: 'select', options: ['Cash', 'Bank', 'UPI', 'Card', 'Cheque'] },
      { name: 'requested_by', label: 'Requested by', type: 'staff' },
      { name: 'status', label: 'Status', type: 'select', options: ['Submitted', 'Pending', 'Approved', 'Paid', 'Rejected'] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { title: 'ID', key: 'expense_no' }, { title: 'Expense', key: 'expense' }, { title: 'Category', key: 'category' },
      { title: 'Vendor', key: 'vendor' }, { title: 'Amount', key: 'amount', amount: true }, { title: 'Date', key: 'expense_date', date: true },
      { title: 'Paid via', key: 'paid_via' }, { title: 'Status', key: 'status', chip: true },
    ],
  },

  cash_bank: {
    collection: 'cash_bank',  title: 'Cash & Bank Entries', single: 'Entry', addLabel: 'New Entry',
    defaults: { account: 'Cash', match: 'Unreconciled' }, filterKey: 'account', filterLabel: 'All accounts',
    fields: [
      { name: 'entry_date', label: 'Date', type: 'date', today: true, required: true },
      { name: 'account', label: 'Account', type: 'select', options: ['Cash', 'Bank'] },
      { name: 'transaction', label: 'Transaction', required: true },
      { name: 'debit', label: 'Money out (₹)', type: 'amount' },
      { name: 'credit', label: 'Money in (₹)', type: 'amount' },
      { name: 'reference', label: 'Reference' },
      { name: 'match', label: 'Match status', type: 'select', options: ['Unreconciled', 'Reconciled'] },
    ],
    columns: [
      { title: 'Date', key: 'entry_date', date: true }, { title: 'Account', key: 'account' }, { title: 'Transaction', key: 'transaction' },
      { title: 'Money out', key: 'debit', amount: true }, { title: 'Money in', key: 'credit', amount: true },
      { title: 'Reference', key: 'reference' }, { title: 'Match', key: 'match', chip: true },
    ],
  },

  approvals: {
    collection: 'approvals', filters: ['type'], title: 'Approval Requests', single: 'Approval Request', addLabel: 'New Request', numberField: 'request_no', prefix: 'APR-',
    defaults: { status: 'Pending' }, filterKey: 'status', filterOptions: ['Pending', 'Approved', 'Rejected'],
    fields: [
      { name: 'request_no', label: 'Request ID', readOnly: true },
      { name: 'type', label: 'Type', type: 'select', required: true, options: ['Fee Discount', 'Refund', 'Expense', 'Document', 'Admission', 'Other'] },
      { name: 'amount', label: 'Amount (₹)', type: 'amount' },
      { name: 'submitted_by', label: 'Submitted by', type: 'staff' },
      { name: 'details', label: 'Details', type: 'textarea', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
    ],
    columns: [
      { title: 'Request', key: 'request_no' }, { title: 'Type', key: 'type' }, { title: 'Amount', key: 'amount', amount: true },
      { title: 'Submitted by', key: 'submitted_by' }, { title: 'Details', key: 'details' }, { title: 'Status', key: 'status', chip: true },
    ],
  },

  employees: {
    collection: 'employees',  title: 'Employees', single: 'Employee', addLabel: 'Add Employee',
    defaults: { status: 'Active' }, filterKey: 'role', filterLabel: 'All roles',
    fields: [
      { name: 'name', label: 'Name', required: true },
      { name: 'role', label: 'Job role', type: 'select', required: true, options: ['Founder', 'Academy Manager', 'Admissions', 'Accounts', 'Counsellor', 'Fee Collector', 'Teacher', 'Other'] },
      { name: 'department', label: 'Department', type: 'select', options: ['All', 'Operations', 'Counselling', 'Finance', 'Academics', 'Other'] },
      { name: 'mobile', label: 'Mobile' },
      { name: 'email', label: 'Email' },
      { name: 'joined_on', label: 'Joined on', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
    ],
    columns: [
      { title: 'Name', key: 'name' }, { title: 'Job role', key: 'role' }, { title: 'Department', key: 'department' },
      { title: 'Mobile', key: 'mobile' }, { title: 'Email', key: 'email' }, { title: 'Joined', key: 'joined_on', date: true },
      { title: 'Status', key: 'status', chip: true },
    ],
  },

  notifications: {
    collection: 'notifications', filters: ['priority'], title: 'Notes & Reminders', single: 'Reminder', addLabel: 'Add Reminder',
    defaults: { priority: 'Medium', status: 'Pending' }, filterKey: 'status', filterOptions: ['Pending', 'Done'],
    fields: [
      { name: 'alert', label: 'Reminder', required: true, full: true },
      { name: 'priority', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'] },
      { name: 'owner', label: 'Owner', type: 'staff' },
      { name: 'due', label: 'Due', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Done'] },
    ],
    columns: [
      { title: 'Priority', key: 'priority', chip: true }, { title: 'Reminder', key: 'alert' }, { title: 'Owner', key: 'owner' },
      { title: 'Due', key: 'due', date: true }, { title: 'Status', key: 'status', chip: true },
    ],
  },
};
