/* Academy OS: shared summaries (top bar, notifications) */
import { allStudents, feeAccount, TODAY, INR, isoDate } from './data.js';
import { canMoney, permitted } from './permissions.js';

export function academySettings(data) {
  return (data.settings || []).find((r) => r.id === 'academy-settings')?.academy || {};
}

/** Alerts worked out from the records, limited to what the role may open: [priority, text, owner, date, route] */
export function computeAlerts(data, role) {
  const today = TODAY();
  const open = (e) => !['Converted', 'Closed'].includes(e.status);
  const list = [
    ...(canMoney(role) ? allStudents(data).map((s) => ({ s, f: feeAccount(data, s) })).filter((x) => x.f.followUp)
      .map(({ s, f }) => ['High', `Payment follow-up due · ${s.student_name} (${INR(f.balance)} left, promised ${f.next.split('-').reverse().join('-')})`, 'Accounts', f.next, { page: 'inst-student', studentId: s.student_id }]) : []),
    ...(data.documents || []).filter((d) => ['Missing', 'Pending'].includes(d.verification))
      .map((d) => [d.verification === 'Missing' ? 'High' : 'Medium', `${d.document || 'Document'} ${String(d.verification).toLowerCase()} · ${d.student_name || ''}`, 'Admissions', d.submitted_on, { page: 'os', key: 'documents' }]),
    ...(data.enquiries || []).filter((e) => isoDate(e.follow_up) && isoDate(e.follow_up) <= today && open(e))
      .map((e) => ['Medium', `Follow up enquiry · ${e.name || ''} (${e.interest || ''})`, e.assigned || 'Counsellor', e.follow_up, { page: 'os', key: 'enquiries' }]),
    ...(data.exams || []).filter((x) => x.registration === 'Pending')
      .map((x) => ['Medium', `Exam registration pending · ${x.student_name || ''} (${x.exam || ''})`, 'Academics', x.exam_date, { page: 'os', key: 'exams' }]),
    ...[...(data.approvals || []), ...(data.discounts || [])].filter((x) => x.status === 'Pending')
      .map((x) => ['High', `Approval waiting · ${x.request_no || ''} ${x.type || ''}`, 'Owner', '', { page: 'os', key: 'approvals' }]),
    ...(data.expenses || []).filter((x) => ['Submitted', 'Pending'].includes(x.status))
      .map((x) => ['Medium', `Expense waiting for approval · ${x.expense_no || ''} ${x.expense || ''}`, 'Owner', x.expense_date, { page: 'os', key: 'approvals' }]),
  ];
  return list.filter((a) => permitted(a[4].page === 'os' ? a[4].key : 'installments', role));
}

export function notificationCount(data, role) {
  return computeAlerts(data, role).length + (data.notifications || []).filter((x) => x.status !== 'Done').length;
}
