/* Academy OS: sample records for testing every page. Every record carries is_test: true so it can be removed in one go. */
import { LEVELS, nextStudentId, admissionPrefix, nextAdmissionNumber, PUC_COURSES, sslcSubjects } from '../utils.js';

const FIRST = ['Ananya', 'Rahul', 'Priya', 'Kiran', 'Sneha', 'Arjun', 'Divya', 'Manoj', 'Kavya', 'Suresh', 'Pooja', 'Vikram', 'Meghana', 'Naveen', 'Lakshmi', 'Rohit', 'Shruti', 'Ganesh', 'Bhavya', 'Harish'];
const LAST = ['Rao', 'Gowda', 'Shetty', 'Kumar', 'Hegde', 'Naik', 'Patil', 'Reddy', 'Bhat', 'Murthy'];
const PARENT = ['Ramesh', 'Mahesh', 'Srinivas', 'Prakash', 'Venkatesh', 'Nagaraj', 'Shankar', 'Manjunath', 'Ravi', 'Krishna'];
const MOTHER = ['Sudha', 'Geetha', 'Asha', 'Rekha', 'Shobha', 'Usha', 'Kamala', 'Savitha', 'Latha', 'Vani'];
const pick = (a, i) => a[i % a.length];
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const stamp = (offset) => new Date(Date.now() + offset * 86400000).toISOString();

/** Returns { collection: [rows without id] } — 20 students plus 20 records for every other module */
export function buildTestData(data) {
  const out = {};
  const push = (c, row) => { (out[c] ||= []).push({ ...row, is_test: true }); };
  const students = [];
  const levels = ['sslc', 'puc', 'degree', 'pg'];
  const pucCourses = Object.entries(PUC_COURSES).flatMap(([branch, list]) => list.map((c) => [branch, c]));
  const all = levels.flatMap((l) => data[LEVELS[l].table] || []);

  for (let i = 0; i < 20; i++) {
    const level = levels[i % 4];
    const L = LEVELS[level];
    const name = `TEST ${pick(FIRST, i)} ${pick(LAST, i * 3)}`.toUpperCase();
    const gender = i % 2 ? 'Male' : 'Female';
    const year = String(new Date().getFullYear());
    const batch = String((i % 4) + 1);
    const base = {
      student_name: name, father_name: `${pick(PARENT, i)} ${pick(LAST, i * 3)}`, mother_name: `${pick(MOTHER, i)}`,
      gender, dob: `${2008 - (level === 'sslc' ? 0 : level === 'puc' ? 2 : level === 'degree' ? 5 : 8)}-${pad((i % 12) + 1)}-${pad((i % 27) + 1)}`,
      category: ['GM', 'OBC', 'SC', 'ST'][i % 4], physically_handicapped: i === 7 ? 'Yes' : 'No', caste: 'Test caste', aadhar_card: `9${String(100000000000 + i * 7919).slice(1)}`,
      mobile: `90000${String(10000 + i).slice(-5)}`, phone2: i % 3 ? '' : `80000${String(20000 + i).slice(-5)}`, email: `test${i + 1}@example.com`,
      nationality: 'INDIAN', religion: 'Test', address: `${i + 1}, Test Street, Bengaluru`,
      admission_year: year, admission_batch: batch, created_at: stamp(-i),
    };
    let row;
    if (level === 'sslc') {
      row = { ...base, board_id: i % 8 ? 'BOSSE' : 'BISE', medium: i % 3 ? 'KN' : 'EN', prev_class: '9', prev_medium: 'KN', prev_register_number: `TC${1000 + i}`, prev_passing_year: String(Number(year) - 1) };
      row.subjects = sslcSubjects(row.medium).join(', ');
    } else if (level === 'puc') {
      const [branch, course] = pick(pucCourses, i);
      row = { ...base, board_id: i % 8 ? 'BISE' : 'BOSSE', puc_year: String((i % 2) + 1), course_id: branch, combination_id: course, medium: i % 3 ? 'EN' : 'KN',
        sslc_board_name: 'BOSSE', sslc_register_number: `SR${5000 + i}`, sslc_passed_year: String(Number(year) - 1), sslc_medium: 'KN', sslc_percentage: String(60 + i) };
    } else {
      const online = i % 3 === 0;
      const course = level === 'degree' ? (online ? 'BBA' : ['BA', 'B.Com', 'BBA', 'BCA'][i % 4]) : (online ? 'MBA' : ['MA', 'M.Com', 'MBA'][i % 3]);
      row = { ...base, university_mode: online ? 'Online' : 'Offline', board_id: online ? 'Alliance University' : 'KSOU', year, batch: String((i % 2) + 1), course_id: course, sem: '1',
        sslc_board_name: 'BOSSE', sslc_register_number: `SR${6000 + i}`, sslc_passed_year: String(Number(year) - 4), sslc_medium: 'KN',
        puc_board_name: 'BISE', puc_register_number: `PR${7000 + i}`, puc_passed_year: String(Number(year) - 2), puc_medium: 'EN' };
      if (level === 'pg') Object.assign(row, { degree_register_number: `DR${8000 + i}`, degree_passed_year: String(Number(year) - 1), degree_mode: 'Offline', degree_board_name: 'KSOU', degree_course_id: 'B.Com', degree_cgpa: '7.5' });
    }
    row.student_id = nextStudentId([...all, ...students.filter((s) => s.level === level)], L.prefix);
    const prefix = admissionPrefix(level, row);
    row.admission_number = prefix ? nextAdmissionNumber([...all, ...students], prefix) : '';
    students.push({ ...row, level });
    push(L.table, row);
  }

  // Installments: varied totals, modes, a few Pending, some fully paid
  const modes = ['Cash', 'UPI', 'Card'];
  students.forEach((s, i) => {
    const total = [30000, 25000, 45000, 60000][i % 4];
    const count = i % 5 === 0 ? 0 : (i % 3) + 1;
    let paid = 0;
    for (let k = 0; k < count; k++) {
      const amount = i % 7 === 1 && k === count - 1 ? total - paid : Math.round(total / 4);
      const status = i % 6 === 2 && k === count - 1 ? 'Pending' : 'Paid';
      if (status === 'Paid') paid += amount;
      push('installments', {
        student_id: s.student_id, student_name: s.student_name, admission_number: s.admission_number, admission_year: s.admission_year, admission_batch: s.admission_batch,
        phone: s.mobile, course: LEVELS[s.level].label, board_id: s.board_id || '', course_id: s.course_id || '', combination_id: s.combination_id || '',
        total_fees: total, installment_no: k + 1, amount, balance: Math.max(0, total - paid), payment_date: day(-60 + k * 20 + i), status,
        payment_mode: pick(modes, i + k), reference: pick(modes, i + k) === 'Cash' ? '' : `UTR${100000 + i * 10 + k}`, cash_amount: null, online_amount: null, created_at: stamp(-60 + k * 20 + i),
      });
    }
  });

  // Fee plans and a due schedule for 20 dues (5 students x 4)
  ['SSLC', 'PUC Science', 'PUC Commerce', 'PUC Arts', 'Degree', 'PG'].forEach((p, i) => push('fee_plans', { plan: `TEST ${p} Plan`, program: p, total: [30000, 45000, 40000, 35000, 60000, 80000][i], installments: '4', gap_months: '1', status: 'Active', created_at: stamp(-30) }));
  students.slice(0, 5).forEach((s, i) => { for (let k = 0; k < 4; k++) push('fee_dues', { student_id: s.student_id, student_name: s.student_name, program: s.level.toUpperCase(), admission_number: s.admission_number, installment_no: String(k + 1), due_date: day(-75 + k * 30 + i), amount: 7500, plan: 'TEST Plan', created_at: stamp(-30) }); });

  const sref = (i) => { const s = students[i % 20]; return { student_id: s.student_id, student_name: s.student_name, program: s.level === 'puc' ? `PUC ${s.course_id}` : s.level.toUpperCase(), admission_number: s.admission_number }; };
  const enqStatus = ['New', 'Contacted', 'Follow-up', 'Converted', 'Closed'];
  const staff = ['TEST Counsellor 1', 'TEST Counsellor 2', 'TEST Accounts', 'TEST Manager'];
  for (let i = 0; i < 20; i++) {
    push('enquiries', { enquiry_no: `ENQ-T${pad(i + 1)}`, name: `TEST PROSPECT ${pick(FIRST, i + 5).toUpperCase()}`, mobile: `70000${String(30000 + i).slice(-5)}`, guardian: pick(PARENT, i + 2),
      interest: ['SSLC', 'PUC Science', 'PUC Commerce', 'PUC Arts', 'Degree', 'PG'][i % 6], source: ['Walk-in', 'Meta Ads', 'WhatsApp', 'Phone', 'Referral'][i % 5], assigned: pick(staff, i % 2),
      follow_up: day(-5 + i), status: pick(enqStatus, i), notes: 'Test enquiry', created_at: stamp(-i) });
    push('documents', { ...sref(i), document: ['Transfer Certificate (TC)', 'Marks Card', 'Aadhar Card', 'Study Certificate', 'Income & Caste Certificate'][i % 5], submitted_on: day(-i), verification: ['Pending', 'Verified', 'Verified', 'Missing', 'Rejected'][i % 5], verified_by: i % 5 === 1 ? 'TEST Manager' : '', created_at: stamp(-i) });
    push('exams', { ...sref(i), exam: ['Annual Examination', 'Supplementary Exam', 'Semester 1', 'Practical Exam'][i % 4], registration: ['Pending', 'Submitted', 'Confirmed'][i % 3], exam_fee: 500 + (i % 4) * 250, exam_date: day(10 + i * 3), hall_ticket: i % 3 === 2 ? `HT${9000 + i}` : '', result: ['Awaited', 'Pass', 'Fail', 'Absent'][i % 4], marks: i % 4 === 1 ? String(55 + i) : '', created_at: stamp(-i) });
    push('discounts', { request_no: `REQ-T${pad(i + 1)}`, type: ['Discount', 'Scholarship', 'Waiver', 'Refund'][i % 4], ...sref(i), amount: 500 + (i % 5) * 500, requested_by: pick(staff, i), reason: 'Test request', status: ['Pending', 'Approved', 'Rejected'][i % 3], created_at: stamp(-i) });
    push('expenses', { expense_no: `EXP-T${pad(i + 1)}`, expense: ['Board exam fee', 'Office rent', 'Staff salary', 'Electricity bill', 'Meta ads', 'Stationery', 'Repairs'][i % 7], category: ['Board / Exam Fees', 'Rent', 'Salary', 'Utilities', 'Marketing', 'Stationery', 'Maintenance'][i % 7],
      vendor: `TEST Vendor ${(i % 6) + 1}`, amount: [3000, 20000, 15000, 2500, 5000, 800, 1200][i % 7], expense_date: day(-40 + i * 2), paid_via: ['Cash', 'Bank', 'UPI'][i % 3], requested_by: pick(staff, i), status: ['Submitted', 'Pending', 'Approved', 'Paid', 'Rejected'][i % 5], created_at: stamp(-i) });
    push('cash_bank', { entry_date: day(-30 + i), account: i % 2 ? 'Bank' : 'Cash', transaction: ['Opening balance', 'Bank charges', 'Owner deposit', 'Petty cash'][i % 4], debit: i % 4 === 1 || i % 4 === 3 ? 100 + i * 10 : '', credit: i % 4 === 0 || i % 4 === 2 ? 5000 + i * 100 : '', reference: `REF${i + 1}`, match: i % 3 ? 'Reconciled' : 'Unreconciled', created_at: stamp(-i) });
    const amt = 1000 + Math.floor(i / 2) * 500; // each debit has a matching credit
    push('approvals', { request_no: `APR-T${pad(i + 1)}`, type: ['Fee Discount', 'Refund', 'Expense', 'Document', 'Admission'][i % 5], amount: i % 5 === 3 ? '' : 1000 + i * 100, submitted_by: pick(staff, i), details: 'Test approval request', status: ['Pending', 'Approved', 'Rejected'][i % 3], created_at: stamp(-i) });
    push('employees', { name: i < 4 ? staff[i] : `TEST ${pick(FIRST, i + 3)} ${pick(LAST, i)}`, role: ['Counsellor', 'Counsellor', 'Accounts', 'Academy Manager', 'Admissions', 'Fee Collector', 'Teacher'][i % 7], department: ['Counselling', 'Counselling', 'Finance', 'Operations', 'Counselling', 'Finance', 'Academics'][i % 7],
      mobile: `60000${String(40000 + i).slice(-5)}`, email: `staff${i + 1}@example.com`, joined_on: day(-400 + i * 10), status: i % 9 === 8 ? 'Inactive' : 'Active', created_at: stamp(-i) });
    push('notifications', { alert: `TEST reminder ${i + 1}: ${['Call parent about fees', 'Collect TC', 'Book exam hall', 'Renew rent agreement'][i % 4]}`, priority: ['High', 'Medium', 'Low'][i % 3], owner: pick(staff, i), due: day(-3 + i), status: i % 4 === 3 ? 'Done' : 'Pending', created_at: stamp(-i) });
  }
  return out;
}

export const TEST_COLLECTIONS = ['sslc_students', 'puc_students', 'degree_students', 'pg_students', 'installments', 'fee_plans', 'fee_dues', 'enquiries', 'documents', 'exams', 'discounts', 'expenses', 'cash_bank', 'approvals', 'employees', 'notifications'];
