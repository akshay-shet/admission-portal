/* System Map: generated from the real menu and permissions, separately for the Owner login and the Employee login */
import { useState } from 'react';
import { useNav } from '../components/Layout.jsx';
import { useStore } from '../store.jsx';
import Icon from '../components/Icon.jsx';
import { NAV, OS_TITLES, OWNER_ONLY, permitted, isOwner } from './permissions.js';
import { allStudents, feeAccount } from './data.js';
import { isReceived } from '../utils.js';
import { academySettings } from './summary.js';
import { DEFAULT_BRAND } from '../components/Layout.jsx';
import { PageHead, Metric, Card, Chip } from './ui.jsx';

const LEVEL = { sslc: 'SSLC Students', puc: 'PUC Students', degree: 'Degree Students', pg: 'PG Students' };
const TITLE = (kind, key) => (kind === 'students' ? LEVEL[key] : kind === 'collect' ? 'Collect Fee' : kind === 'installments' ? 'Manage Installments' : OS_TITLES[key]);
const PERM = (kind, key) => (kind === 'students' ? 'students' : kind === 'collect' ? 'collect' : kind === 'installments' ? 'installments' : key);
const ROUTE = (kind, key) => (kind === 'students' ? { page: 'dashboard', tab: key } : kind === 'collect' ? { page: 'inst-add' } : kind === 'installments' ? { page: 'installments' } : { page: 'os', key });

/* what each page is for */
const PURPOSE = {
  overview: 'Totals, collections, attention list and quick actions',
  'system-map': 'This page: how the portal is organised',
  enquiries: 'Prospects, follow-ups and converting them to admissions',
  'new-admission': 'Pick the level and open the admission form',
  'all-students': 'One directory of every student with a 360° profile',
  sslc: 'SSLC admission list, form, import and Excel',
  puc: 'PUC admission list, form, import and Excel',
  degree: 'Degree admission list, form, import and Excel',
  pg: 'PG admission list, form, import and Excel',
  documents: 'Certificates received, missing and verified',
  exams: 'Exam registrations, hall tickets and results',
  'fee-dashboard': 'Collections by month and mode, outstanding and overdue',
  'fee-accounts': 'Actual fee, discount, total fee, paid and balance per student',
  'fee-plans': 'Standard fee per program; apply one to a student',
  collect: 'Record a payment against a student',
  installments: 'Every payment by student (pay as you go), receipts and balance',
  payments: 'Receipt register, verify or reject payments',
  'pending-fees': 'Who still owes, paid %, last payment and follow-ups',
  discounts: 'Discounts, scholarships, waivers and refunds',
  expenses: 'Academy expenses, vendors and payment status',
  'cash-bank': 'Cash book and bank register',
  'finance-reports': 'Program, aging, ledger and expense reports in Excel',
  approvals: 'Approve or reject discounts, expenses and requests',
  employees: 'Staff list and what each login can open',
  notifications: 'Reminders and automatic alerts',
  settings: 'Branding, colours, fees, logins and backup',
  'audit-logs': 'Who added, changed or deleted every record',
};

function useCounts() {
  const { data } = useStore();
  const st = allStudents(data);
  const n = (c) => (data[c] || []).length;
  const lv = (l) => st.filter((s) => s.level === l).length;
  const due = st.map((s) => feeAccount(data, s)).filter((f) => f.balance > 0).length;
  const paid = (data.installments || []).filter(isReceived).length;
  return {
    data, students: st.length, payments: paid,
    of: (key) => ({
      enquiries: `${n('enquiries')} enquiries`, 'all-students': `${st.length} students`, sslc: `${lv('sslc')} students`, puc: `${lv('puc')} students`,
      degree: `${lv('degree')} students`, pg: `${lv('pg')} students`, documents: `${n('documents')} records`, exams: `${n('exams')} records`,
      'fee-accounts': `${st.length} accounts`, 'fee-plans': `${n('fee_plans')} plans`, installments: `${n('installments')} payments`,
      payments: `${paid} receipts`, 'pending-fees': `${due} with balance`, discounts: `${n('discounts')} requests`, expenses: `${n('expenses')} expenses`,
      'cash-bank': `${n('cash_bank')} entries`, approvals: `${n('approvals')} requests`, employees: `${n('employees')} staff`,
      notifications: `${n('notifications')} reminders`, 'audit-logs': `${n('audit_logs')} entries`,
    }[key] || ''),
  };
}

/* the day-to-day path through the portal for each login */
const FLOW = {
  Owner: [
    ['Enquiry', 'Enquiries', 'Record the prospect and follow up'],
    ['Admission', 'SSLC / PUC / Degree / PG form', 'Student details, actual fee and any discount'],
    ['Set the fee', 'Student form · Fee Plans', 'Actual fee − discount = total fee (no fixed installments)'],
    ['Collect any amount', 'Collect Fee', 'Pay as you go: each payment is taken off the balance'],
    ['Verify & receipt', 'Payments & Receipts', 'Verify, then print the receipt'],
    ['Follow up dues', 'Pending Fees · Notifications', 'Overdue list and reminders'],
    ['Approve', 'Approvals', 'Discounts, refunds and expenses'],
    ['Money out', 'Expenses · Cash & Bank', 'Spending and cash / bank book'],
    ['Review', 'Dashboard · Fee Dashboard · Reports', 'Totals, trends and Excel'],
    ['Check', 'Audit Logs', 'Every change with who did it'],
  ],
  Employee: [
    ['Enquiry', 'Enquiries', 'Record the prospect and follow up'],
    ['Admission', 'SSLC / PUC / Degree / PG form', 'Student details, actual fee and any discount'],
    ['Documents & exams', 'Student Documents · Examinations', 'Certificates and exam records'],
    ['Set the fee', 'Student form · Fee Plans', 'Actual fee − discount = total fee (no fixed installments)'],
    ['Collect any amount', 'Collect Fee', 'Pay as you go: each payment is taken off the balance'],
    ['Receipt', 'Payments & Receipts', 'Print the receipt for the student'],
    ['Follow up dues', 'Pending Fees · Notifications', 'Overdue list, call or WhatsApp'],
    ['Discount request', 'Discounts & Refunds', 'Owner approves the request'],
  ],
};

/* records → where they are created → where they show up (only pages the login can open are listed) */
const LINKS = [
  ['Student', 'Student forms / New Admission', ['all-students', 'fee-accounts', 'pending-fees', 'overview']],
  ['Actual fee & discount', 'Student form · Discounts & Refunds', ['fee-accounts', 'pending-fees', 'fee-dashboard', 'finance-reports']],
  ['Next payment date (optional, per student)', 'Student form · Collect Fee · fee page', ['pending-fees', 'notifications', 'fee-dashboard']],
  ['Payment', 'Collect Fee · Manage Installments', ['payments', 'installments', 'pending-fees', 'cash-bank', 'fee-dashboard']],
  ['Enquiry', 'Enquiries', ['new-admission', 'notifications']],
  ['Document / exam', 'Student Documents · Examinations', ['all-students', 'notifications']],
  ['Expense', 'Expenses & Vendors', ['approvals', 'cash-bank', 'finance-reports']],
  ['Every change', 'Any page', ['audit-logs']],
];

export default function SystemMap() {
  const nav = useNav();
  const owner = isOwner(nav.role);
  const [view, setView] = useState(owner ? 'Owner' : 'Employee');
  const role = owner ? view : 'Employee';
  const c = useCounts();
  const a = academySettings(c.data);
  const sections = NAV.map((sec) => ({
    name: sec.section,
    items: sec.items.filter(([kind, key]) => permitted(PERM(kind, key), role)).map(([kind, key, icon]) => ({ kind, key, icon, title: TITLE(kind, key) })),
  })).filter((s) => s.items.length);
  const pages = sections.reduce((x, s) => x + s.items.length, 0);
  const hidden = NAV.flatMap((sec) => sec.items.filter(([, key]) => OWNER_ONLY.has(key)).map(([kind, key, icon]) => ({ kind, key, icon, title: TITLE(kind, key), sec: sec.section })));
  const allItems = NAV.flatMap((sec) => sec.items.map(([kind, key, icon]) => ({ kind, key, icon, title: TITLE(kind, key), sec: sec.section })));
  const titleOf = (k) => (LEVEL[k] || OS_TITLES[k] || { installments: 'Manage Installments', collect: 'Collect Fee' }[k] || k);
  const canOpen = (kind, key) => permitted(PERM(kind, key), nav.role);
  return (
    <>
      <PageHead title="System Map" sub={`How the portal is organised for the ${role} login — every page it can open, what each holds and how the records connect`}>
        {owner && (
          <div className="sm-switch" role="tablist" aria-label="Login">
            {['Owner', 'Employee'].map((r) => <button key={r} type="button" role="tab" aria-selected={view === r} className={view === r ? 'on' : ''} onClick={() => setView(r)}>{r} login</button>)}
          </div>
        )}
      </PageHead>

      <div className="os-grid four mb-3">
        <Metric label="Pages available" value={pages} note={`in ${sections.length} sections`} em />
        {owner
          ? <Metric label={role === 'Owner' ? 'Access' : 'Hidden from employees'} value={role === 'Owner' ? 'Full' : hidden.length} note={role === 'Owner' ? 'Every page and setting' : 'Owner-only pages, not shown at all'} />
          : <Metric label="Work steps" value={FLOW.Employee.length} note="From enquiry to fee follow-up" />}
        <Metric label="Students" value={c.students} note="Across SSLC, PUC, Degree and PG" />
        <Metric label="Receipts issued" value={c.payments} note="Verified payments" />
      </div>

      {/* tree */}
      <div className="os-card os-cardbody mb-3">
        <div className="sm-root">
          <span className="sm-root-ico"><Icon name="cap" size={20} /></span>
          <div><b>{a.inst_title || DEFAULT_BRAND.title}</b><small>{role} login · {role === 'Owner' ? 'full access' : 'day-to-day work'}</small></div>
        </div>
        <div className="sm-stem" />
        <div className="sm-tree">
          {sections.map((s) => (
            <div className="sm-sec" key={s.name}>
              <div className="sm-sechead"><span>{s.name}</span><small>{s.items.length} page{s.items.length > 1 ? 's' : ''}</small></div>
              {s.items.map((it) => {
                const cnt = c.of(it.key);
                const open = canOpen(it.kind, it.key);
                return (
                  <button type="button" key={it.key} className="sm-item" disabled={!open} onClick={() => open && nav.go(ROUTE(it.kind, it.key))} title={open ? `Open ${it.title}` : undefined}>
                    <span className="sm-ico"><Icon name={it.icon} size={16} /></span>
                    <span className="sm-txt"><span className="sm-line"><b>{it.title}</b>{cnt && <span className="sm-cnt">{cnt}</span>}</span><small>{PURPOSE[it.key]}</small></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sm-stem" />
        <div className="os-foundation"><b>Shared foundation</b><div className="os-sub">One student record used by every page · {role === 'Owner' ? 'Owner & Employee logins · Settings & branding · Audit log of every change' : 'Employee login · every change is recorded with your name'} · Excel tracker</div></div>
      </div>

      <div className="os-grid two mb-3">
        <Card title={`Work flow — ${role} login`}>
          <ol className="sm-flow">
            {FLOW[role].map(([step, where, what], i) => (
              <li key={step}><span className="sm-num">{i + 1}</span><div><b>{step}</b><small>{where} — {what}</small></div></li>
            ))}
          </ol>
        </Card>
        <Card title="How the records connect" pad={false}>
          <table className="table os-table mb-0">
            <thead><tr><th>Record</th><th>Created on</th><th>Shows up on</th></tr></thead>
            <tbody>
              {LINKS.map(([rec, made, shows]) => {
                const vis = shows.filter((k) => permitted(k, role));
                if (!vis.length) return null;
                return <tr key={rec}><td><b>{rec}</b></td><td className="sm-wrap">{made}</td><td className="sm-wrap">{vis.map(titleOf).join(' · ')}</td></tr>;
              })}
            </tbody>
          </table>
        </Card>
      </div>

      {owner && role === 'Employee' && (
        <Card title={`Hidden from the Employee login (${hidden.length} pages)`}>
          <div className="os-sub mb-2">These pages are not in the employee menu and cannot be opened by typing their address — the employee is taken to All Students instead.</div>
          <div className="sm-hidden">{hidden.map((h) => <span key={h.key}><Icon name={h.icon} size={14} /> {h.title} <small>{h.sec}</small></span>)}</div>
        </Card>
      )}

      {owner && (
        <div className="mt-3">
          <Card title="Access by login — every page" pad={false}>
            <div className="table-responsive">
              <table className="table os-table mb-0">
                <thead><tr><th>Section</th><th>Page</th><th>What it is for</th><th>Owner login</th><th>Employee login</th></tr></thead>
                <tbody>{allItems.map((it) => (
                  <tr key={it.key}><td className="text-muted">{it.sec}</td><td><Icon name={it.icon} size={14} /> <b>{it.title}</b></td><td className="sm-wrap">{PURPOSE[it.key]}</td>
                    <td><Chip t="Allowed" /></td><td><Chip t={permitted(PERM(it.kind, it.key), 'Employee') ? 'Allowed' : 'Hidden'} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
