export const LEVELS = {
  sslc: { table: 'sslc_students', prefix: 'SSL', label: 'SSLC' },
  puc: { table: 'puc_students', prefix: 'PUC', label: 'PUC' },
  degree: { table: 'degree_students', prefix: 'DEG', label: 'Degree' },
  pg: { table: 'pg_students', prefix: 'PGO', label: 'PG' },
};

export function calcAge(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '';
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
  return age >= 0 && age < 150 ? String(age) : '';
}

export function nextStudentId(rows, prefix) {
  let max = 0;
  for (const r of rows) {
    if (typeof r.student_id === 'string' && r.student_id.startsWith(prefix)) {
      const n = parseInt(r.student_id.slice(prefix.length), 10);
      if (n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(3, '0');
}

/** Shrink an image file to a JPEG blob (keeps documents readable, records small). */
function shrinkImage(file, maxSide, quality) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.onerror = () => reject(new Error('Could not read the file'));
  fr.readAsDataURL(blob);
});

/**
 * Store an uploaded file and return {name, asset} (artifact file storage) or {name, url} (data URL).
 * Photos are shrunk to 400px; certificates to 1600px so text stays legible.
 */
export async function storeUpload(file, kind = 'document') {
  if (!file) return null;
  const isImage = file.type.startsWith('image/') && file.type !== 'image/svg+xml';
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isImage && !isPdf) throw new Error(`${file.name}: upload an image (JPG/PNG) or a PDF.`);
  const blob = isImage ? await shrinkImage(file, kind === 'photo' ? 400 : 1600, kind === 'photo' ? 0.82 : 0.75) : file;
  const name = isImage ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;

  if (window.claude?.use) {
    const assets = await window.claude.use('assets');
    if (assets) {
      const res = await assets.upload(blob);
      return { name, asset: res.id };
    }
  }
  if (blob.size > 900 * 1024) throw new Error(`${file.name} is too large to keep in this browser (max about 900 KB). Use a smaller scan.`);
  return { name, url: await blobToDataUrl(blob) };
}

/** Display URL for a stored file */
export const fileUrl = (f) => (!f ? '' : f.url || (f.asset ? '/_blob/' + f.asset : ''));

export const inRange = (dateStr, from, to) => {
  const d = (dateStr || '').slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

export const fmt0 = (n) => num(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const fmt2 = (n) => num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ₹1,25,000 (paise shown only when there are any) */
export const fmtINR = (n) => { const v = num(n); return (v < 0 ? '−₹' : '₹') + (Number.isInteger(v) ? fmt0(Math.abs(v)) : fmt2(Math.abs(v))); };
/** 2026-11-11T09:04:00Z -> 11-11-2026, 02:34 PM */
export function fmtDateTime(d) {
  const t = new Date(d);
  if (!d || Number.isNaN(t.getTime())) return String(d ?? '');
  const p = (x) => String(x).padStart(2, '0');
  const h = t.getHours() % 12 || 12;
  return `${p(t.getDate())}-${p(t.getMonth() + 1)}-${t.getFullYear()}, ${p(h)}:${p(t.getMinutes())} ${t.getHours() < 12 ? 'AM' : 'PM'}`;
}
const SMALL = new Set(['of', 'and', 'or', 'to', 'by', 'in', 'for', 'the', 'a', 'an', 'on', 'at', 'per', 'vs']);
/** Column / field headings in one style: "SL.no" -> "Sl. No.", "Admission no" -> "Admission No.", "aadhar no" -> "Aadhaar No." */
export function niceTitle(t) {
  if (typeof t !== 'string') return t;
  const s0 = t.trim();
  if (/^(sl|s)\.?\s*no\.?$/i.test(s0) || s0 === '#') return 'Sl. No.';
  const s = s0.replace(/\baadhar\b/gi, 'Aadhaar').replace(/\bno\.?(?=\s|$)/gi, 'No.');
  return s.split(/(\s+|\/|\(|\)|-)/).map((w, i) => {
    if (!w || /^(\s+|\/|\(|\)|-)$/.test(w)) return w;
    if (w === 'No.') return w;
    if (/[A-Z]/.test(w) && w === w.toUpperCase()) return w; // SSLC, PUC, TC, ID…
    if (/[a-z][A-Z]/.test(w)) return w; // WhatsApp
    if (i > 0 && SMALL.has(w.toLowerCase())) return w.toLowerCase();
    return w[0].toUpperCase() + w.slice(1);
  }).join('');
}

/* ---------- dropdown lists ---------- */
export const BOARDS = ['BISE', 'BOSSE'];
export const MEDIUMS = ['KN', 'EN'];
/* Medium is stored as KN / EN. Older records and imported sheets may say "Kannada Medium" etc. */
export const MEDIUM_FIELDS = ['medium', 'prev_medium', 'sslc_medium', 'puc_medium'];
export function normMedium(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'kn' || s.startsWith('kannada')) return 'KN';
  if (s === 'en' || s.startsWith('english')) return 'EN';
  return String(v).trim();
}
export const CATEGORIES = ['GM', 'OBC', 'SC', 'ST'];
export const PUC_YEARS = ['1', '2'];
export const PUC_BRANCHES = ['Science', 'Commerce', 'Arts'];
export const PUC_COURSES = {
  Science: ['PCMB', 'PCMC', 'PCME'],
  Commerce: ['CEBA', 'SEBA', 'HEBA', 'CSBA'],
  Arts: ['HEBS', 'HEPK', 'HEBA', 'HESP'],
};

/* Optional subjects in each PUC combination. Edit here if your college uses different subjects. */
export const PUC_COMBINATION_SUBJECTS = {
  PCMB: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
  PCMC: ['Physics', 'Chemistry', 'Mathematics', 'Computer Science'],
  PCME: ['Physics', 'Chemistry', 'Mathematics', 'Electronics'],
  CEBA: ['Computer Science', 'Economics', 'Business Studies', 'Accountancy'],
  SEBA: ['Statistics', 'Economics', 'Business Studies', 'Accountancy'],
  HEBA: ['History', 'Economics', 'Business Studies', 'Accountancy'],
  CSBA: ['Computer Science', 'Statistics', 'Business Studies', 'Accountancy'],
  HEBS: ['History', 'Economics', 'Basic Mathematics', 'Sociology'],
  HEPK: ['History', 'Economics', 'Political Science', 'Kannada (Optional)'],
  HESP: ['History', 'Economics', 'Sociology', 'Political Science'],
};

const firstLangs = (medium) => (normMedium(medium) === 'KN' ? ['Kannada', 'English'] : normMedium(medium) === 'EN' ? ['English', 'Kannada'] : []);

/** SSLC subjects by medium of instruction -> [{role, name}] */
export function sslcSubjects(medium) {
  const langs = firstLangs(medium);
  if (!langs.length) return [];
  return [
    { role: 'First Language', name: langs[0] }, { role: 'Second Language', name: langs[1] }, { role: 'Third Language', name: 'Hindi' },
    ...['Mathematics', 'Science', 'Social Science'].map((name) => ({ role: 'Core Subject', name })),
  ];
}

/** PUC subjects: two languages by medium + the four subjects of the chosen course */
export function pucSubjects(medium, course) {
  const langs = firstLangs(medium);
  return [
    ...langs.map((name, i) => ({ role: i === 0 ? 'First Language' : 'Second Language', name })),
    ...(PUC_COMBINATION_SUBJECTS[course] || []).map((name) => ({ role: 'Optional Subject', name })),
  ];
}

/* ---------- admission ---------- */
export const BATCHES = [
  { value: '1', label: '1 (Dec – Feb)' },
  { value: '2', label: '2 (Feb – June)' },
  { value: '3', label: '3 (June – Oct)' },
  { value: '4', label: '4 (Oct – Dec)' },
];
export const batchLabel = (v) => (BATCHES.find((b) => b.value === String(v))?.label || v || '');

/** Batch for today's date: Dec–Jan 1, Feb–May 2, Jun–Sep 3, Oct–Nov 4 */
export function currentBatch(d = new Date()) {
  const m = d.getMonth() + 1;
  if (m === 12 || m === 1) return '1';
  if (m <= 5) return '2';
  if (m <= 9) return '3';
  return '4';
}

/** Current year and the next four (keeps an older stored year visible when editing) */
export function admissionYears(current) {
  const y = new Date().getFullYear();
  const years = [0, 1, 2, 3, 4].map((n) => String(y + n));
  if (current && !years.includes(String(current))) years.unshift(String(current));
  return years;
}

/** Course part of the admission number for each level */
export function admissionCourse(level, v) {
  if (level === 'sslc') return 'SSLC';
  if (level === 'puc') return v.combination_id || '';
  return v.course_id || '';
}

/** e.g. year 2027, batch 2, course PCME -> "2027-2-PCME-" ('' until all three are chosen) */
export function admissionPrefix(level, v) {
  const course = String(admissionCourse(level, v)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!v.admission_year || !v.admission_batch || !course) return '';
  return `${v.admission_year}-${v.admission_batch}-${course}-`;
}

/** Next free number for a prefix across all students: 2027-2-PCME-001, -002, … (continues after the highest used) */
export function nextAdmissionNumber(allStudents, prefix, excludeId) {
  let max = 0;
  const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d{3,})$');
  for (const r of allStudents) {
    if (excludeId && r.id === excludeId) continue; // (rows not saved yet have no id and must still count)
    const m = re.exec(String(r.admission_number || '').toUpperCase());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + String(max + 1).padStart(3, '0');
}

/* ---------- Degree / PG course details ---------- */
export const UNIVERSITY_MODES = ['Online', 'Offline'];
export const ONLINE_UNIVERSITIES = ['Alliance University', 'GLA University'];
export const OFFLINE_UNIVERSITY = 'KSOU';
export const UG_BATCHES = [{ value: '1', label: '1 (Jan – Mar)' }, { value: '2', label: '2 (June – Aug)' }];

/* Courses offered, by level and university type. Edit these lists if a university adds or drops a course. */
export const DEGREE_COURSES = {
  online: ['BBA', 'BCA', 'B.Com (Hons)'],
  KSOU: ['BA', 'B.Com', 'B.Sc - General & IT', 'BBA', 'BCA', 'BSW', 'B.Lib.I.Sc', 'B.Ed', 'B.Tech', 'BE', 'B.Sc'],
};
export const PG_COURSES = {
  online: ['MBA', 'MCA'],
  KSOU: ['MA', 'M.Com', 'MBA', 'M.Lib.I.Sc', 'M.Sc'],
};
/* M.Sc subjects (shown only when the PG course is M.Sc) */
export const MSC_SUBJECTS = [
  'Mathematics', 'Physics', 'Chemistry', 'Botany', 'Zoology & Life Science', 'Environmental Science',
  'Geography', 'Computer Science', 'Information Technology', 'Data Science',
];

/* Number of semesters per course (programme length x 2). Anything not listed: 6 for degree, 4 for PG. */
export const COURSE_SEMESTERS = {
  BA: 6, 'B.Com': 6, 'B.Com (Hons)': 8, 'B.Sc': 6, 'B.Sc - General & IT': 6, BBA: 6, BCA: 6, BSW: 6,
  'B.Lib.I.Sc': 2, 'B.Ed': 4, 'B.Tech': 8, BE: 8,
  MA: 4, 'M.Com': 4, 'M.Sc': 4, MBA: 4, MCA: 4, MSW: 4, 'M.Lib.I.Sc': 2, 'M.Ed': 4,
};

export function universityCourses(level, v) {
  const table = level === 'pg' ? PG_COURSES : DEGREE_COURSES;
  if (v.university_mode === 'Offline' || v.board_id === OFFLINE_UNIVERSITY) return table.KSOU;
  if (ONLINE_UNIVERSITIES.includes(v.board_id)) return table.online;
  return [];
}

export function courseSemesters(level, course) {
  if (!course) return [];
  const n = COURSE_SEMESTERS[course] || (level === 'pg' ? 4 : 6);
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

/* ---------- installments ---------- */
/** 2026-10-01 -> 01-10-2026 */
export const fmtDate = (d) => {
  const m = isoDate(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(d ?? '');
};
/** Any stored date (2026-10-01, 01/10/2026, 01-10-2026, Excel day number) -> 2026-10-01; '' when unknown */
export function isoDate(d) {
  if (d === null || d === undefined || d === '') return '';
  if (typeof d === 'number' && d > 20000 && d < 80000) {
    const t = new Date(Date.UTC(1899, 11, 30) + d * 86400000);
    return t.toISOString().slice(0, 10);
  }
  const s = String(d).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
/** Money typed or imported as "30,000", "₹ 5,000.50" or a number -> 30000 / 5000.5 (0 when not a number) */
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
/** Class from the student code: SSL… SSLC, PUC… PUC, DEG… Degree, PGO… PG */
export function studentClass(studentId) {
  const s = String(studentId || '').toUpperCase();
  if (s.startsWith('SSL')) return 'SSLC';
  if (s.startsWith('PUC')) return 'PUC';
  if (s.startsWith('DEG')) return 'Degree';
  if (s.startsWith('PGO')) return 'PG';
  return '';
}
/** All installments of one student, oldest first, with paid total and balance */
/**
 * Fee position of one student.
 * total = total fees on the latest installment; paid = installments not marked Pending, minus approved refunds;
 * discount = approved discounts / scholarships / waivers (from Discounts & Refunds); balance = total - discount - paid.
 */
/** A payment counts as money received unless it is still Pending (awaiting verification) or was Rejected */
export const isReceived = (r) => !['Pending', 'Rejected'].includes(r?.status);

/** actualFee: the student's own fee (pay as you go); when not set, the fee typed on the latest payment is used */
export function feeSummary(installments, studentId, discounts = [], actualFee = 0) {
  const list = (installments || [])
    .filter((r) => r.student_id === studentId)
    .sort((a, b) => isoDate(a.payment_date).localeCompare(isoDate(b.payment_date)) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const latest = [...list].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || list[list.length - 1];
  const total = num(actualFee) || num(latest?.total_fees);
  const mine = (discounts || []).filter((d) => d.student_id === studentId && d.status === 'Approved');
  const refund = mine.filter((d) => d.type === 'Refund').reduce((a, d) => a + num(d.amount), 0);
  const discount = mine.filter((d) => d.type !== 'Refund').reduce((a, d) => a + num(d.amount), 0);
  const pending = list.filter((r) => r.status === 'Pending').reduce((a, r) => a + num(r.amount), 0);
  const paid = list.filter(isReceived).reduce((a, r) => a + num(r.amount), 0) - refund;
  return { list, total, paid, pending, discount, refund, balance: Math.max(0, round2(total - discount - paid)) };
}
const round2 = (n) => Math.round(n * 100) / 100;
/** Money for lists: 10,000 for whole amounts, 7,500.55 when there are paise */
export const fmtAmt = (n) => (Number.isInteger(num(n)) ? fmt0(num(n)) : fmt2(num(n)));

/** Aadhaar shown in lists: only the last 4 digits (XXXX XXXX 1234) */
export function maskAadhaar(v) {
  const s = String(v ?? '').trim();
  const d = s.replace(/\D/g, '');
  return d.length >= 8 ? `XXXX XXXX ${d.slice(-4)}` : s;
}
