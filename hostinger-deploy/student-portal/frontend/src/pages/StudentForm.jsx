import { useDraft, DraftBanner } from '../components/draft.jsx';
import { useMemo, useState } from 'react';
import { FormShell, useNav } from '../components/Layout.jsx';
import ScanButton from '../components/ScanButton.jsx';
import { FeeFields } from '../os/FeeSchedule.jsx';
import CustomizeButton, { useCustomization, applyFormCustom, FIRST_SECTION } from '../components/Customize.jsx';
import { useStore } from '../store.jsx';
import { LEVELS, calcAge, nextStudentId, storeUpload, fileUrl, BOARDS, MEDIUMS, CATEGORIES, PUC_YEARS, PUC_BRANCHES, PUC_COURSES, BATCHES, currentBatch, admissionYears, admissionPrefix, nextAdmissionNumber, sslcSubjects, pucSubjects, UNIVERSITY_MODES, ONLINE_UNIVERSITIES, OFFLINE_UNIVERSITY, UG_BATCHES, universityCourses, courseSemesters, MSC_SUBJECTS, MEDIUM_FIELDS, normMedium, niceTitle, num, fmtINR } from '../utils.js';
import { notify } from '../components/toast.jsx';
import { feeAccount, programOf, nextNumber } from '../os/data.js';
import { currentRole } from '../os/permissions.js';

/* ---------- field-spec helpers (layouts mirror the original add/edit pages) ---------- */
const F = (col, label, name, extra = {}) => ({ t: 'f', col, label, name, ...extra });
const H = (text) => ({ t: 'h5', text });
const HR = { t: 'hr' };
const G = (col = 'col-md-4') => ({ t: 'gender', col, req: true });
const S = (col, label, name, kind, ph, extra = {}) => ({ t: 'sel', col, label, name, kind, ph, ...extra });
const FILE = (col, label, name) => F(col, label, name, { type: 'file' });
const O = (col, label, name, options, ph, extra = {}) => ({ t: 'opt', col, label, name, options, ph, ...extra });
/* Year box: digits only, no up/down spinner */
const YEAR = { inputMode: 'numeric', maxLength: 4, ph: 'YYYY', digits: true };
/* Marks / percentage / CGPA boxes: numbers with an optional decimal, no spinner */
const MARKS = { inputMode: 'decimal', maxLength: 7, ph: 'Marks obtained' };
const PERCENT = { inputMode: 'decimal', maxLength: 6, ph: '%' };
const CGPA = { inputMode: 'decimal', maxLength: 5, ph: 'e.g. 8.25' };
const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

/* Mandatory on every form: Name, Father Name, Mother Name, Gender, Mobile */
const basic = (nameLabel = 'Name') => [
  F('col-md-6', nameLabel, 'student_name', { req: true }), F('col-md-6', 'Father Name', 'father_name', { req: true }),
  F('col-md-6', 'Mother Name', 'mother_name', { req: true }), F('col-md-3', 'DOB', 'dob', { type: 'date' }), F('col-md-3', 'Age', 'age', { ro: true }),
  O('col-md-4', 'Category', 'category', CATEGORIES, 'Select Category'), F('col-md-4', 'Caste', 'caste'), F('col-md-4', 'Subcaste', 'subcaste'),
  G(), O('col-md-4', 'Physically Handicapped', 'physically_handicapped', ['No', 'Yes']),
];
const contact = (wa = 'WhatsApp') => [
  F('col-md-6', 'Mobile', 'mobile', { type: 'tel', req: true }), F('col-md-6', 'Mobile 2', 'phone2', { type: 'tel' }),
  F('col-md-6', wa, 'whatsapp'), F('col-md-6', 'Email', 'email'),
  F('col-md-4', 'Nationality', 'nationality'), F('col-md-4', 'Religion', 'religion'), F('col-md-4', 'Mother Tongue', 'mother_tongue'),
];
const personal = (mode, aLabel) => [
  ...basic(mode === 'edit' ? 'Student Name' : 'Name'), F('col-md-4', aLabel, 'aadhar_card'), ...contact(),
  F('col-md-12', 'Address', 'address', { type: 'textarea' }), FILE('col-md-6', mode === 'edit' ? 'Student Photo' : 'Photo', 'photo'),
];
/* SSLC Details: same block on the PUC, Degree and PG forms */
const sslcDetails = [
  HR, H('SSLC Details'), F('col-md-3', 'SSLC Register Number', 'sslc_register_number'),
  F('col-md-3', 'SSLC Passed Year', 'sslc_passed_year', YEAR),
  O('col-md-3', 'SSLC Board', 'sslc_board_name', BOARDS, 'Select Board'),
  O('col-md-3', 'SSLC Medium', 'sslc_medium', MEDIUMS, 'Select Medium'),
  F('col-md-3', 'SSLC Marks', 'sslc_marks', MARKS), F('col-md-3', 'Percentage', 'sslc_percentage', PERCENT),
  FILE('col-md-6', 'SSLC Marks Card', 'sslc_marks_card'),
];
/* PUC Details: on the Degree and PG forms */
const pucDetails = [
  HR, H('PUC Details'), F('col-md-3', 'PUC Register Number', 'puc_register_number'),
  F('col-md-3', 'PUC Passed Year', 'puc_passed_year', YEAR),
  O('col-md-3', 'PUC Board', 'puc_board_name', BOARDS, 'Select Board'),
  O('col-md-3', 'PUC Medium', 'puc_medium', MEDIUMS, 'Select Medium'),
  F('col-md-3', 'PUC Marks', 'puc_marks', MARKS), F('col-md-3', 'Percentage', 'puc_percentage', PERCENT),
  FILE('col-md-6', 'PUC Marks Card', 'puc_marks_card'),
];
/* Bachelor's Details: on the PG form */
const bachelorDetails = [
  HR, H("Bachelor's Details"), F('col-md-3', "Bachelor's Register Number", 'degree_register_number'),
  F('col-md-3', "Bachelor's Passed Year", 'degree_passed_year', YEAR),
  O('col-md-3', "Bachelor's Mode", 'degree_mode', UNIVERSITY_MODES, 'Select Mode'),
  O('col-md-3', "Bachelor's University", 'degree_board_name',
    (v) => (v.degree_mode === 'Offline' ? [OFFLINE_UNIVERSITY] : v.degree_mode === 'Online' ? ONLINE_UNIVERSITIES : []),
    (v) => (v.degree_mode === 'Offline' ? null : v.degree_mode ? 'Select University' : 'Select Mode first')),
  F('col-md-3', "Bachelor's CGPA", 'degree_cgpa', CGPA),
  FILE('col-md-6', "Bachelor's Marks Card", 'degree_marks_card'),
];
const prevDetails = (p, P) => [HR, H(`${P} Details`), F('col-md-3', `${P} Register Number`, `${p}_register_number`),
  F('col-md-3', `${P} Passed Year`, `${p}_passed_year`, YEAR), F('col-md-3', `${P} Board Name`, `${p}_board_name`),
  FILE('col-md-3', `${P} Marks Card`, `${p}_marks_card`)];

/* Course Details for Degree and PG: University type -> Board -> Year / Batch -> Course -> Semester */
const higherCourse = (level, heading) => [
  HR, H(heading),
  O('col-md-4', 'Mode', 'university_mode', UNIVERSITY_MODES, 'Select Mode'),
  O('col-md-4', 'University', 'board_id',
    (v) => (v.university_mode === 'Offline' ? [OFFLINE_UNIVERSITY] : v.university_mode === 'Online' ? ONLINE_UNIVERSITIES : []),
    (v) => (v.university_mode === 'Offline' ? null : v.university_mode ? 'Select University' : 'Select Mode first')),
  O('col-md-4', 'Year', 'year', (v) => admissionYears(v.year), 'Select Year'),
  O('col-md-4', 'Batch', 'batch', UG_BATCHES, 'Select Batch'),
  O('col-md-4', 'Course', 'course_id', (v) => universityCourses(level, v), (v) => (v.board_id ? 'Select Course' : 'Select University first')),
  O('col-md-4', 'Semester', 'sem', (v) => courseSemesters(level, v.course_id).map((n) => ({ value: n, label: `Semester ${n}` })),
    (v) => (v.course_id ? 'Select Semester' : 'Select Course first')),
  ...(level === 'pg'
    ? [O('col-md-4', 'M.Sc Subject', 'msc_subject', MSC_SUBJECTS, 'Select Subject', { show: (v) => v.course_id === 'M.Sc' })]
    : []),
];

/* Admission sits last, after Course Details. Admission No is generated: year + batch + course + 001… */
/* Documents: on the PUC, Degree and PG forms */
const documents = [
  HR, H('Documents'),
  FILE('col-md-6', 'Transfer Certificate', 'tc_certificate'),
  FILE('col-md-6', 'Income and Caste Certificate', 'income_caste_certificate'),
  FILE('col-md-6', 'Aadhar Card', 'aadhar_card_file'),
  FILE('col-md-6', 'Study Certificate', 'study_certificate'),
];

const admission = [
  HR, H('Admission Details'),
  O('col-md-3', 'Admission Year', 'admission_year', (v) => admissionYears(v.admission_year), 'Select Year'),
  O('col-md-3', 'Admission Batch', 'admission_batch', BATCHES, 'Select Batch'),
  { t: 'admno', col: 'col-md-3' },
  F('col-md-3', 'Register Number', 'register_number'),
];

const FORMS = {
  sslc: {
    add: { title: 'Add SSLC Student', h4: 'mb-3', save: 'Save Student', back: true },
    edit: { title: 'Edit SSLC Student', h4: 'mb-3', save: 'Update Student', back: true },
    fields: (mode) => [
      ...personal(mode, 'Aadhar Card Number'),
      HR, H('Previous Qualification Details'),
      O('col-md-3', 'Class', 'prev_class', CLASSES, 'Select Class'),
      O('col-md-3', 'Medium', 'prev_medium', MEDIUMS, 'Select Medium'),
      F('col-md-3', 'Register Number / TC Number', 'prev_register_number'),
      F('col-md-3', 'Year of Passing', 'prev_passing_year', YEAR),
      FILE('col-md-6', 'Transfer Certificate', 'tc_certificate'), FILE('col-md-6', 'Study Certificate', 'study_certificate'),
      FILE('col-md-6', 'Birth Certificate / Caste Certificate', 'birth_caste_certificate'),
      FILE('col-md-6', 'Income Certificate', 'income_certificate'),
      HR, H('Course Details'),
      O('col-md-6', 'Board', 'board_id', BOARDS, 'Select Board'),
      O('col-md-6', 'Medium', 'medium', MEDIUMS, 'Select Medium'),
      { t: 'subjects', kind: 'sslc' },
      ...admission,
    ],
  },
  puc: {
    add: { title: 'Add PUC Student', h4: 'mb-3', save: 'Save Student', back: true },
    edit: { title: 'Edit PUC Student', h4: 'mb-3', save: 'Update Student', back: true },
    fields: (mode) => [
      ...personal(mode, 'Aadhar Card'),
      ...sslcDetails,
      HR, H('Course Details'),
      O('col-md-3', 'Board', 'board_id', BOARDS, 'Select Board'),
      O('col-md-3', 'PUC', 'puc_year', PUC_YEARS, 'Select PUC'),
      O('col-md-3', 'Branch', 'course_id', PUC_BRANCHES, 'Select Branch'),
      O('col-md-3', 'Course Name', 'combination_id', (v) => PUC_COURSES[v.course_id] || [], (v) => (v.course_id ? 'Select Course' : 'Select Branch first')),
      O('col-md-6', 'Medium', 'medium', MEDIUMS, 'Select Medium'),
      { t: 'subjects', kind: 'puc' },
      ...documents,
      ...admission,
    ],
  },
  degree: {
    add: { title: 'Add Degree Student', h4: 'mb-3', save: 'Save Student', back: true },
    edit: { title: 'Edit Degree Student', h4: 'mb-3', save: 'Update Student', back: true },
    fields: (mode) => [
      ...personal(mode, 'Aadhar Number'),
      ...sslcDetails, ...pucDetails,
      ...higherCourse('degree', 'Course Details'),
      ...documents,
      ...admission,
    ],
  },
  pg: {
    add: { title: 'Add PG Student', h4: 'mb-3', save: 'Save Student', back: true },
    edit: { title: 'Edit PG Student', h4: 'mb-3', save: 'Update Student', back: true },
    fields: (mode) => [
      ...personal(mode, 'Aadhar'),
      ...sslcDetails, ...pucDetails, ...bachelorDetails,
      S('col-md-6', "Bachelor's Course", 'degree_course_id', 'courses', 'Select Course'),
      S('col-md-6', "Bachelor's Combination", 'degree_combination_id', 'combinations', 'Select Combination'),
      ...higherCourse('pg', 'PG Course Details'),
      ...documents,
      ...admission,
    ],
  },
};

/** Every typed field on a level's form as {name, label}: used to match spreadsheet columns on import */
/** Items shown in the form's Customize panel */
export function formCustomItems(level) {
  const out = [];
  const seen = new Set();
  let section = FIRST_SECTION;
  for (const f of FORMS[level].fields('add')) {
    if (f.t === 'h5') { section = f.text; continue; }
    const id = f.name || (f.t === 'gender' ? 'gender' : f.t === 'admno' ? 'admission_number' : null);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = f.label || (typeof f.ph === 'string' ? f.ph : '') || (f.t === 'gender' ? 'Gender' : f.t === 'admno' ? 'Admission Number' : id);
    const push = (o) => out.push({ ...o, section });
    if (f.t === 'gender') push({ id, label, type: 'fixed', note: 'Dropdown: Male / Female / Other' });
    else if (f.t === 'admno') push({ id, label, type: 'fixed', note: 'Filled automatically' });
    else if (f.type === 'file') push({ id, label, type: 'fixed', note: 'File upload / Scan' });
    else if (id === 'age') push({ id, label, type: 'fixed', note: 'Worked out from DOB' });
    else if (f.t === 'opt' && typeof f.options === 'function') push({ id, label, type: 'select', options: [], note: 'Linked dropdown' });
    else if (f.t === 'opt') push({ id, label, type: 'select', options: f.options.map((o) => (typeof o === 'string' ? o : o.value)) });
    else if (f.t === 'sel') push({ id, label, type: 'select', options: [] });
    else push({ id, label, type: 'text' });
  }
  return out;
}

export function formFields(level, custom) {
  const out = [];
  for (const f of applyFormCustom(FORMS[level].fields('add'), custom)) {
    if (f.t === 'gender') out.push({ name: 'gender', label: 'Gender' });
    else if (f.t === 'admno') out.push({ name: 'admission_number', label: 'Admission Number' });
    else if ((f.t === 'f' || f.t === 'opt' || f.t === 'sel') && f.name && f.type !== 'file' && f.name !== 'age') {
      out.push({ name: f.name, label: f.label || (typeof f.ph === 'string' ? f.ph : f.name) });
    }
  }
  return out;
}

const LOOKUP_NAME = { boards: 'board_name', courses: 'course_name', combinations: 'combination_name' };

export default function StudentForm({ level, id, prefill }) {
  const store = useStore();
  const { back } = useNav();
  const goBack = () => back({ page: 'dashboard', tab: level });
  const L = LEVELS[level];
  const mode = id ? 'edit' : 'add';
  const existing = id ? store.data[L.table].find((r) => r.id === id) : null;
  const cfg = FORMS[level][mode];
  const [custom] = useCustomization(`form-${level}`);
  const fields = useMemo(() => applyFormCustom(FORMS[level].fields(mode), custom), [level, mode, custom]);
  const [vals, setVals] = useState(() => (existing
    ? { physically_handicapped: 'No', ...existing, ...Object.fromEntries(MEDIUM_FIELDS.filter((k) => existing[k]).map((k) => [k, normMedium(existing[k])])) }
    : { gender: '', physically_handicapped: 'No', admission_year: String(new Date().getFullYear()), admission_batch: currentBatch(), ...(prefill || {}) }));

  // Admission number: kept while year/batch/course are unchanged, otherwise the next free serial
  const allStudents = useMemo(() => Object.values(LEVELS).flatMap((x) => store.data[x.table]), [store.data]);
  const prefix = admissionPrefix(level, vals);
  const storedNo = String(existing?.admission_number || '').toUpperCase();
  const keepsStored = existing && prefix && storedNo.startsWith(prefix) && /^\d{3,}$/.test(storedNo.slice(prefix.length));
  const admissionNo = !prefix ? (existing?.admission_number || '') : keepsStored ? existing.admission_number : nextAdmissionNumber(allStudents, prefix, id);
  const [files, setFiles] = useState({});
  // pay as you go: the student's actual fee and (optional) their own next payment date — no fixed installments
  const knownFee = existing ? feeAccount(store.data, { ...existing, level }).total : 0;
  const [plan, setPlan] = useState(() => ({ actual_fee: existing ? String(num(existing.actual_fee) || knownFee || '') : '', next_payment_date: existing?.next_payment_date || '' }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Discount on the total fee (₹): kept as an approved discount, so balance, fee pages, reports and Excel all use it
  const formDisc = existing ? (store.data.discounts || []).find((d) => d.student_id === existing.student_id && d.source === 'student-form') : null;
  const [disc, setDisc] = useState(() => ({ amount: formDisc ? String(formDisc.amount ?? '') : '', reason: formDisc?.reason || '' }));
  const draft = useDraft(`student:${mode}:${level}:${id || 'new'}`, { vals, files, plan, disc }, (d) => { if (d.vals) setVals(d.vals); if (d.files) setFiles(d.files); if (d.plan) setPlan(d.plan); if (d.disc) setDisc(d.disc); });
  const emp = currentRole() === 'Employee';
  const discLocked = emp && !!formDisc && formDisc.status !== 'Pending'; // decided by the owner
  const discPending = emp ? num(disc.amount) > 0 : formDisc?.status === 'Pending';
  const feeLocked = emp && knownFee > 0; // an employee can't change a fee that is already set
  const feeTotal = feeLocked ? knownFee : num(plan.actual_fee);

  if (id && !existing) {
    return <FormShell><h4>Student not found</h4><p>This record may have been deleted.</p>
      <div><button type="button" className="btn btn-outline-secondary" onClick={goBack}>Back</button></div></FormShell>;
  }

  const f_digitsOnly = (name) => /_passed_year$|^prev_passing_year$/.test(name);
  const set = (name, value) => setVals((v) => {
    if (name === 'dob') return { ...v, dob: value, age: calcAge(value) };
    if (f_digitsOnly(name)) return { ...v, [name]: value.replace(/\D/g, '').slice(0, 4) };
    if (/_marks$|_percentage$|_cgpa$/.test(name)) {
      const clean = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
      if (name.endsWith('_percentage') && Number(clean) > 100) return v;
      if (name.endsWith('_cgpa') && Number(clean) > 10) return v;
      return { ...v, [name]: clean };
    }
    if (level === 'puc' && name === 'course_id') {
      const keep = (PUC_COURSES[value] || []).includes(v.combination_id);
      return { ...v, course_id: value, combination_id: keep ? v.combination_id : '' };
    }
    if (level === 'degree' || level === 'pg') {
      // University -> Board -> Course -> Semester: clear anything that no longer fits
      let n = { ...v, [name]: value };
      if (name === 'university_mode') n.board_id = value === 'Offline' ? OFFLINE_UNIVERSITY : (ONLINE_UNIVERSITIES.includes(v.board_id) && value === 'Online' ? v.board_id : '');
      if (name === 'degree_mode') n.degree_board_name = value === 'Offline' ? OFFLINE_UNIVERSITY : (ONLINE_UNIVERSITIES.includes(v.degree_board_name) && value === 'Online' ? v.degree_board_name : '');
      if (!universityCourses(level, n).includes(n.course_id)) n.course_id = '';
      if (!courseSemesters(level, n.course_id).includes(n.sem)) n.sem = '';
      if (n.course_id !== 'M.Sc') n.msc_subject = '';
      return n;
    }
    return { ...v, [name]: value };
  });

  const onFile = async (name, file) => {
    setError('');
    if (!file) return;
    try { setFiles((f) => ({ ...f, [name]: file })); const up = await storeUpload(file, name === 'photo' ? 'photo' : 'document'); setFiles((f) => ({ ...f, [name]: up })); }
    catch (e) { setError(e?.code ? `Could not upload ${file.name} (${e.code}).` : e.message); setFiles((f) => { const n = { ...f }; delete n[name]; return n; }); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (Object.values(files).some((f) => f instanceof File)) { setError('Please wait, files are still uploading.'); return; }
    if (num(disc.amount) < 0 || (feeTotal > 0 && num(disc.amount) > feeTotal)) { setError(`Discount cannot be more than the actual fee (${fmtINR(feeTotal)}).`); return; }
    setSaving(true);
    // Admission number is generated only once year, batch and course are chosen; otherwise keep whatever is stored.
    const row = { ...vals, ...files, age: calcAge(vals.dob), admission_number: admissionNo || existing?.admission_number || '',
      actual_fee: feeLocked ? (num(existing?.actual_fee) || knownFee) : (num(plan.actual_fee) || ''), next_payment_date: plan.next_payment_date || '' };
    try {
      if (mode === 'add') {
        row.student_id = nextStudentId(store.data[L.table], L.prefix);
        row.created_at = new Date().toISOString();
        await store.add(L.table, row);
      } else {
        await store.update(L.table, id, row);
      }
      if (!discLocked) await saveFormDiscount(store, level, row, disc, emp ? 'Pending' : 'Approved');
      notify(mode === 'add' ? `Student ${row.student_name || ''} added` : 'Student details updated');
      draft.clear();
      goBack();
    } catch (err) {
      setError(err?.code === 'invalid_argument' ? 'You do not have permission to change records in this portal.' : `Could not save: ${err?.message || err}`);
      setSaving(false);
    }
  };

  const options = (kind) => store.data[kind].map((r) => r[LOOKUP_NAME[kind]]).sort();

  const renderField = (f, i) => {
    if (f.show && !f.show(vals)) return null;
    if (f.t === 'h5') return <h5 key={i}>{f.text}</h5>;
    if (f.t === 'hr') return <hr key={i} />;
    const fid = `f_${f.name || 'gender'}`;
    const label = f.label && <label className="form-label" htmlFor={fid}>{niceTitle(f.label)}{f.req && <span className="req"> *</span>}</label>;
    if (f.t === 'admno') {
      return (
        <div className={f.col} key={i}>
          <label className="form-label" htmlFor="f_admission_number">Admission Number</label>
          <input id="f_admission_number" className="form-control admno" readOnly value={admissionNo} />
        </div>
      );
    }
    if (f.t === 'gender') {
      return (
        <div className={f.col} key={i}>
          <label className="form-label" htmlFor={fid}>Gender<span className="req"> *</span></label>
          <select id={fid} name="gender" className="form-select" required value={vals.gender || ''} onChange={(e) => set('gender', e.target.value)}>
            <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      );
    }
    if (f.t === 'subjects') {
      const subs = f.kind === 'puc' ? pucSubjects(vals.medium, vals.combination_id) : sslcSubjects(vals.medium);
      const need = f.kind === 'puc'
        ? (!vals.medium && !vals.combination_id ? 'Choose a course name and medium to see the subjects'
          : !vals.medium ? 'Choose a medium to see the languages' : !vals.combination_id ? 'Choose a course name to see the optional subjects' : '')
        : (!vals.medium ? 'Choose a medium to see the subjects' : '');
      return (
        <div className="col-12" key={i}>
          <div className="subject-board">
            <div className="subject-board-head">
              <strong>Subjects</strong>
              <span>{[f.kind === 'puc' && vals.combination_id, vals.medium].filter(Boolean).join(' · ') || need}</span>
            </div>
            {subs.length > 0 && need && <div className="subject-hint">{need}</div>}
            {subs.length > 0 && (
              <ol className="subject-list">
                {subs.map((sub, k) => (
                  <li key={sub.name + k}><span className="subject-role">{sub.role}</span><span className="subject-name">{sub.name}</span></li>
                ))}
              </ol>
            )}
          </div>
        </div>
      );
    }
    if (f.t === 'opt') {
      const optList = (typeof f.options === 'function' ? f.options(vals) : f.options).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
      const optValues = optList.map((o) => o.value);
      const ph = typeof f.ph === 'function' ? f.ph(vals) : f.ph;
      return (
        <div className={f.col} key={i}>
          {label}
          <select id={fid} name={f.name} className="form-select" required={f.req} value={vals[f.name] || ''} onChange={(e) => set(f.name, e.target.value)}>
            {ph && <option value="">{ph}</option>}
            {vals[f.name] && !optValues.includes(vals[f.name]) && <option value={vals[f.name]}>{vals[f.name]}</option>}
            {optList.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );
    }
    if (f.t === 'sel') {
      const opts = options(f.kind);
      const cur = vals[f.name] || '';
      return (
        <div className={f.col} key={i}>
          {label}
          <select id={fid} name={f.name} className="form-select" required={f.req} value={cur} onChange={(e) => set(f.name, e.target.value)}>
            <option value="">{f.ph}</option>
            {cur && !opts.includes(cur) && <option value={cur}>{cur}</option>}
            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }
    if (f.type === 'file') {
      const cur = files[f.name] || vals[f.name];
      return (
        <div className={f.col} key={i}>
          {label}
          <ScanButton name={f.name} label={f.label} disabled={cur instanceof File} onScanned={(file) => onFile(f.name, file)}>
            <input id={fid} type="file" name={f.name} className="form-control" accept="image/*,application/pdf" onChange={(e) => onFile(f.name, e.target.files[0])} />
          </ScanButton>
          {cur instanceof File && <small className="text-muted d-block mt-1">Uploading {cur.name}…</small>}
          {fileUrl(cur) && <small className="d-block mt-1"><a href={fileUrl(cur)} target="_blank" rel="noreferrer">View {cur.name}</a></small>}
        </div>
      );
    }
    if (f.name === 'age') {
      // Always worked out from DOB, shown in years
      const yrs = calcAge(vals.dob);
      return (
        <div className={f.col} key={i}>
          {label}
          <input id={fid} className="form-control" readOnly tabIndex={-1} value={yrs !== '' ? `${yrs} ${yrs === '1' ? 'year' : 'years'}` : ''} />
        </div>
      );
    }
    const common = {
      id: fid, name: f.name, className: 'form-control', placeholder: f.ph, required: f.req, readOnly: f.ro,
      value: vals[f.name] ?? '', onChange: (e) => set(f.name, e.target.value), min: f.min, max: f.max, inputMode: f.inputMode, maxLength: f.maxLength,
    };
    return (
      <div className={f.col} key={i}>
        {label}
        {f.type === 'textarea' ? <textarea {...common} /> : <input type={f.type || 'text'} {...common} />}
      </div>
    );
  };

  return (
    <FormShell>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h1 className="page-title m-0">{cfg.title}</h1>
        <CustomizeButton pageKey={`form-${level}`} title={`${LEVELS[level].label} student form`} mode="form" items={formCustomItems(level)} />
      </div>
      <DraftBanner draft={draft} />
      <form className="row g-3" onSubmit={submit}>
        {fields.map(renderField)}
        {vals.extra_details && Object.keys(vals.extra_details).length > 0 && (
          <>
            <hr />
            <h5>Other Details</h5>
            <p className="text-muted small mb-0 col-12">Extra columns from an imported sheet that don’t have their own box on this form.</p>
            {Object.entries(vals.extra_details).map(([k, val]) => (
              <div className="col-md-4" key={k}>
                <label className="form-label" htmlFor={`x_${k}`}>{k}</label>
                <input id={`x_${k}`} className="form-control" value={val}
                  onChange={(e) => setVals((v) => ({ ...v, extra_details: { ...v.extra_details, [k]: e.target.value } }))} />
              </div>
            ))}
          </>
        )}
        <hr />
        <h5>Fee <small className="text-muted fw-normal">· pay as you go (optional)</small></h5>
        <p className="text-muted small mb-0 col-12">No fixed installments: the student pays any amount whenever they can, and each payment is taken off the total fee. Add a next payment date only if this student agreed one.</p>
        <div className="col-12"><FeeFields value={feeLocked ? { ...plan, actual_fee: String(knownFee) } : plan} onChange={setPlan} idPrefix="newplan" lockFee={feeLocked} /></div>
        <div className="col-12">
          <div className="row g-2 disc-row">
            <div className="col-md-3">
              <label className="form-label" htmlFor="f_discount">Discount on actual fee (₹)</label>
              <input id="f_discount" className="form-control" inputMode="decimal" placeholder="0" value={disc.amount}
                onChange={(e) => setDisc({ ...disc, amount: e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') })} disabled={discLocked} />
            </div>
            <div className="col-md-5">
              <label className="form-label" htmlFor="f_discount_reason">Reason for discount</label>
              <input id="f_discount_reason" className="form-control" placeholder="e.g. Sibling concession, early payment, scholarship" value={disc.reason}
                onChange={(e) => setDisc({ ...disc, reason: e.target.value })} disabled={!num(disc.amount) || discLocked} />
            </div>
            <div className="col-md-4">
              <div className="disc-sum">
                <span>Actual fee <b>{feeTotal ? fmtINR(feeTotal) : '—'}</b></span>
                <span>Discount <b className="text-success">{num(disc.amount) ? `− ${fmtINR(disc.amount)}` : '—'}</b></span>
                <span>Total fee <b className={feeTotal && num(disc.amount) > feeTotal ? 'text-danger' : ''}>{feeTotal ? fmtINR(Math.max(0, feeTotal - num(disc.amount))) : '—'}</b></span>
              </div>
            </div>
          </div>
          {discLocked && <div className="form-text text-success fw-semibold">This discount was {String(formDisc.status).toLowerCase()} by the owner. Only the owner can change it.</div>}
          {!discLocked && discPending && <div className="form-text text-warning fw-semibold">{emp ? 'The discount is sent to the owner for approval. The fee changes after it is approved.' : 'This discount is waiting for approval in Approvals / Discounts & Refunds.'}</div>}
          <div className="form-text">Leave empty for no discount. Total fee = actual fee − discount; the balance is the total fee minus everything paid so far.</div>
        </div>
        {error && <div className="col-12"><div className="alert alert-danger mb-0">{error}</div></div>}
        <div className="col-12">
          <button type="submit" name={mode === 'add' ? 'save' : 'update'} disabled={saving}
            className="btn btn-primary">
            {saving ? 'Saving…' : cfg.save}
          </button>
          {cfg.back && <>{' '}<button type="button" className="btn btn-outline-secondary" onClick={goBack}>Cancel</button></>}
          {!cfg.back && <>{' '}<button type="button" className="btn btn-outline-secondary" onClick={goBack}>Back</button></>}
        </div>
      </form>
    </FormShell>
  );
}

/** Create, change or remove the discount typed on the student form (one per student, marked source: 'student-form') */
async function saveFormDiscount(store, level, s, disc, status = 'Approved') {
  const mine = (store.data.discounts || []).filter((d) => d.student_id === s.student_id && d.source === 'student-form');
  const amount = Math.round(num(disc.amount) * 100) / 100;
  if (!amount) {
    for (const d of mine) await store.remove('discounts', d.id); // eslint-disable-line no-await-in-loop
    return;
  }
  const row = {
    student_id: s.student_id, student_name: s.student_name || '', program: programOf(level, s), admission_number: s.admission_number || '',
    type: 'Discount', amount, reason: (disc.reason || '').trim() || 'Discount given on the student form', status,
    requested_by: status === 'Pending' ? 'Student form (employee)' : 'Student form', source: 'student-form', ...(status === 'Approved' ? { decided_at: new Date().toISOString() } : {}),
  };
  if (mine.length) {
    const [first, ...extra] = mine;
    if (num(first.amount) !== amount || first.reason !== row.reason || first.student_name !== row.student_name || first.program !== row.program || first.admission_number !== row.admission_number) {
      await store.update('discounts', first.id, row);
    }
    for (const d of extra) await store.remove('discounts', d.id); // eslint-disable-line no-await-in-loop
  } else {
    await store.add('discounts', { ...row, request_no: nextNumber(store.data.discounts || [], 'request_no', 'REQ-'), created_at: new Date().toISOString() });
  }
}
