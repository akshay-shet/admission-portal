import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SEED } from './seed.js';
import { currentRole } from './os/permissions.js';
import { notify } from './components/toast.jsx';
import { allStudents, feeAccount } from './os/data.js';
import { num } from './utils.js';

/**
 * Data layer.
 * - Published as a claude.ai Artifact: records live in the artifact's shared `db`
 *   (one collection per table, live-updating for everyone who opens it).
 * - Anywhere else (npm run dev, a plain web host): records live in localStorage,
 *   starting with the boards / courses / combinations from seed.js (no students).
 * There is no database server: these two are the only places records are kept.
 */
export const COLLECTIONS = [
  'sslc_students', 'puc_students', 'degree_students', 'pg_students',
  'installments', 'boards', 'courses', 'combinations',
  'settings', // page customisations (renamed / hidden / added fields and columns)
  // Academy OS modules
  'enquiries', 'documents', 'exams', 'fee_plans', 'fee_dues', 'discounts', 'expenses',
  'cash_bank', 'approvals', 'employees', 'notifications', 'audit_logs',
];

/* Every add / edit / delete (except page layouts and the log itself) is written to audit_logs */
const NO_AUDIT = new Set(['audit_logs', 'settings']);
const rowLabel = (r = {}) => r.student_name || r.name || r.expense || r.plan || r.transaction || r.account || r.document || r.alert
  || r.enquiry_no || r.request_no || r.expense_no || r.entry_no || r.board_name || r.course_name || r.combination_name || '';
function audit(backend, collection, action, row) {
  if (NO_AUDIT.has(collection)) return;
  let actor = ''; let role = '';
  try { actor = sessionStorage.getItem('student-portal-admin') || ''; role = sessionStorage.getItem('student-portal-role') === 'Employee' ? 'Employee' : 'Owner'; } catch { /* ignore */ }
  const extra = collection === 'installments' && row?.amount ? ` · ₹${row.amount}` : '';
  backend.add('audit_logs', { at: new Date().toISOString(), actor, role, collection, action, label: rowLabel(row) + extra }).catch(() => {});
}

/*
 * Employee guard (applies to every save, whatever page it comes from):
 * - owner-only records: settings, expenses, cash & bank, approvals, fee plans (templates), audit log
 * - discounts: an employee's request is always Pending; approved / rejected ones can't be changed or deleted
 * - payments: an employee records Paid or Pending; can't reject, can't verify (Pending -> Paid), and can change or
 *   delete a payment only while it is Pending; the actual fee on a payment can't be lowered below the student's fee
 * - due schedule rows can't be edited one by one (a plan is replaced as a whole, keeping the same fee)
 * - a student who has payments can't be deleted
 */
const OWNER_WRITES = new Set(['settings', 'expenses', 'cash_bank', 'approvals', 'fee_plans', 'audit_logs']);
const NO = (msg) => ({ ok: false, msg });
function employeeGuard(data, c, op, row, cur) {
  if (currentRole() !== 'Employee') return { ok: true, row };
  if (OWNER_WRITES.has(c)) return NO('Only the owner can change this.');
  if (c === 'discounts') {
    if (cur && cur.status !== 'Pending') return NO('This discount was already decided by the owner. Ask the owner to change it.');
    if (op === 'remove') return { ok: true };
    return { ok: true, row: { ...row, status: 'Pending' } };
  }
  if (c === 'installments') {
    if (op === 'remove') return cur && cur.status !== 'Pending' ? NO('Only the owner can delete a payment that is already counted.') : { ok: true };
    if (cur && cur.status !== 'Pending') return NO('Only the owner can change a payment that is already counted.');
    const status = row.status === 'Rejected' ? null : row.status;
    if (status === null) return NO('Only the owner can reject a payment.');
    if (cur && cur.status === 'Pending' && (status || 'Paid') !== 'Pending') return NO('Only the owner can verify a payment.');
    // the fee on a payment can't go below what the student owes in total (no hidden discount)
    const s = allStudents(data).find((x) => x.student_id === (row.student_id || cur?.student_id));
    const total = s ? feeAccount(data, s).total : 0;
    const out = { ...row };
    if (total > 0 && num(out.total_fees) !== total) out.total_fees = total;
    return { ok: true, row: out };
  }
  if (c === 'fee_dues' && op === 'update') return NO('Only the owner can change this.');
  // pay as you go: the student's actual fee, once set, is the owner's to change
  if (['sslc_students', 'puc_students', 'degree_students', 'pg_students'].includes(c) && (op === 'update' || op === 'put') && cur && row && 'actual_fee' in row) {
    const s = allStudents(data).find((x) => x.student_id === cur.student_id);
    const fee = s ? feeAccount(data, s).total : 0;
    if (fee > 0 && num(row.actual_fee) !== fee) return { ok: true, row: { ...row, actual_fee: num(cur.actual_fee) || fee } };
  }
  if (['sslc_students', 'puc_students', 'degree_students', 'pg_students'].includes(c) && op === 'remove'
    && (data.installments || []).some((x) => x.student_id === cur?.student_id)) return NO('Only the owner can delete a student who has payments.');
  return { ok: true, row };
}
const blocked = (g) => { notify(g.msg, 'error', 5000); return false; };
/* a failed save: show why, carry on */
const failed = (e) => { if (e?.status === 401) return false; if (e?.status >= 400 && e?.status < 500) { notify(e.message, 'error', 5000); return false; } throw e; };

const LS_KEY = 'student-portal-data-v1';

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

class LocalBackend {
  constructor() {
    this.kind = 'local';
    this.listeners = new Set();
    let data = null;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { data = null; }
    this.data = data || structuredClone(SEED);
    for (const c of COLLECTIONS) this.data[c] ||= [];
  }
  persist() {
    this.snap = null;
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch { /* storage full or blocked */ }
    this.listeners.forEach((fn) => fn());
  }
  subscribe(fn) { this.listeners.add(fn); fn(); return () => this.listeners.delete(fn); }
  snapshot() { if (!this.snap) this.snap = Object.fromEntries(COLLECTIONS.map((c) => [c, this.data[c]])); return this.snap; }
  async add(c, row) { const id = newId(); this.data[c] = [...this.data[c], { ...row, id }]; this.persist(); return id; }
  async update(c, id, row) { this.data[c] = this.data[c].map((r) => (r.id === id ? { ...r, ...row, id } : r)); this.persist(); }
  async remove(c, id) { this.data[c] = this.data[c].filter((r) => r.id !== id); this.persist(); }
  async put(c, id, row) { this.data[c] = [...this.data[c].filter((r) => r.id !== id), { ...row, id }]; this.persist(); }
}

/* ---------- saves that could not reach the server (no internet, site down) wait here and upload by themselves ---------- */
const OUTBOX_KEY = 'student-portal-outbox';
const readOutbox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; } };
const writeOutbox = (q) => { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(q)); } catch { /* storage full */ } };
const refused = (e) => /invalid_argument|permission|not_granted|not_writer|unauthenticated/i.test(`${e?.code || ''} ${e?.message || ''}`);
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

class ArtifactBackend {
  constructor(db) {
    this.kind = 'artifact';
    this.db = db;
    this.data = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    this.ready = new Set();
    this.listeners = new Set();
    this.error = null;
    this.outbox = readOutbox();
    this.view = null;
    this.unsubs = COLLECTIONS.map((c) =>
      db.collection(c).onSnapshot(
        (snap) => {
          this.data = { ...this.data, [c]: snap.docs.map((d) => ({ ...d.data(), id: d.id })) };
          if (!snap.metadata.fromCache) this.ready.add(c);
          this.view = null;
          this.emit();
        },
        (e) => { this.error = e; this.emit(); },
      ),
    );
    this.onOnline = () => this.flush();
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
    this.timer = setInterval(() => this.flush(), 20000);
    setTimeout(() => this.flush(), 3000);
  }
  close() { clearInterval(this.timer); if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline); }
  emit() { this.listeners.forEach((fn) => fn()); }
  subscribe(fn) { this.listeners.add(fn); fn(); return () => this.listeners.delete(fn); }
  /** saved records, with any changes still waiting to upload shown on top */
  snapshot() {
    if (!this.outbox.length) return this.data;
    if (this.view) return this.view;
    const v = { ...this.data };
    for (const w of this.outbox) {
      const rows = (v[w.c] || []).filter((r) => r.id !== w.id);
      v[w.c] = w.op === 'delete' ? rows : [...rows, { ...w.row, id: w.id }];
    }
    this.view = v;
    return v;
  }
  clean(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) if (k !== 'id' && v !== undefined) out[k] = v;
    return out;
  }
  async send(w) {
    const ref = this.db.collection(w.c).doc(w.id);
    await withTimeout(w.op === 'delete' ? ref.delete() : ref.set(w.row), 15000);
  }
  queue(w) {
    this.outbox = [...this.outbox.filter((x) => !(x.c === w.c && x.id === w.id)), { ...w, at: Date.now() }];
    writeOutbox(this.outbox); this.view = null; this.emit();
    if (!this.warned) { this.warned = true; notify('No connection right now — the change is kept on this computer and will upload by itself.', 'error', 6000); }
  }
  /** one save: straight to the server, or into the waiting list if the server cannot be reached */
  async write(w) {
    if (this.outbox.some((x) => x.c === w.c && x.id === w.id) || (typeof navigator !== 'undefined' && navigator.onLine === false)) { this.queue(w); return; }
    try { await this.send(w); } catch (e) { if (refused(e)) throw e; this.queue(w); }
  }
  /** upload the waiting changes, oldest first */
  async flush() {
    if (this.flushing || !this.outbox.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    this.flushing = true;
    try {
      while (this.outbox.length) {
        const w = this.outbox[0];
        try { await this.send(w); } catch (e) {
          if (!refused(e)) break; // still offline: try again later
          notify('A change saved while offline was refused by the portal and was not uploaded.', 'error', 6000);
        }
        this.outbox = this.outbox.slice(1); writeOutbox(this.outbox); this.view = null;
      }
      if (!this.outbox.length && this.warned) { this.warned = false; notify('All changes made offline are now uploaded.'); }
    } finally { this.flushing = false; this.emit(); }
  }
  async add(c, row) { const id = this.db.collection(c).doc().id; await this.write({ op: 'set', c, id, row: this.clean(row) }); return id; }
  async update(c, id, row) {
    const cur = this.snapshot()[c].find((r) => r.id === id) || {};
    await this.write({ op: 'set', c, id, row: this.clean({ ...cur, ...row }) });
  }
  async remove(c, id) { await this.write({ op: 'delete', c, id }); }
  async put(c, id, row) { await this.write({ op: 'set', c, id, row: this.clean(row) }); }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [backend, setBackend] = useState(null);
  const [version, force] = useState(0);
  const [slow, setSlow] = useState(false);

  // Pick the backend once.
  useEffect(() => {
    let cancelled = false; let created = null;
    (async () => {
      let db = null;
      if (typeof window !== 'undefined' && window.claude?.use) {
        try { db = await window.claude.use('db'); } catch { db = null; }
      }
      let b = null;
      if (db) b = new ArtifactBackend(db);
      else b = new LocalBackend();
      created = b;
      if (!cancelled) setBackend(b); else b.close?.();
    })();
    return () => { cancelled = true; created?.close?.(); };
  }, []);

  useEffect(() => {
    if (!backend) return undefined;
    const unsub = backend.subscribe(() => force((n) => n + 1));
    const t = setTimeout(() => setSlow(true), 10000);
    return () => { unsub(); clearTimeout(t); };
  }, [backend]);

  // `version` changes on every data change so every page using useStore() re-renders with fresh rows
  const value = useMemo(() => ({ backend, version }), [backend, version]);
  return (
    <StoreCtx.Provider value={value}>
      {children}
      {backend?.kind === 'artifact' && slow && backend.ready.size < COLLECTIONS.length && !backend.error && (
        <div className="store-note">Still connecting to saved records; the lists may be incomplete.</div>
      )}
      {backend?.outbox?.length > 0 && <div className="offline-bar" role="status">{backend.outbox.length} change{backend.outbox.length > 1 ? 's' : ''} kept on this computer — uploading as soon as the connection is back</div>}
      {backend?.error && <div className="store-note">Saved records could not be reached. Reload the page to try again.</div>}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const { backend } = useContext(StoreCtx);
  const data = backend ? backend.snapshot() : Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  return {
    ready: !!backend,
    // settings (logins) are loaded from the saved records: until then nobody can sign in with stale defaults
    settingsReady: !!backend && (backend.kind === 'local' || backend.ready.has('settings')),
    kind: backend?.kind,
    data,
    add: async (c, row) => {
      const g = employeeGuard(data, c, 'add', row, null); if (!g.ok) return blocked(g);
      let id; try { id = await backend.add(c, g.row); } catch (e) { return failed(e); }
      audit(backend, c, 'Created', g.row); return id;
    },
    update: async (c, id, row) => {
      const cur = (data[c] || []).find((r) => r.id === id);
      const g = employeeGuard(data, c, 'update', row, cur || {}); if (!g.ok) return blocked(g);
      try { await backend.update(c, id, g.row); } catch (e) { return failed(e); }
      audit(backend, c, 'Updated', { ...cur, ...g.row }); return true;
    },
    remove: async (c, id) => {
      const cur = (data[c] || []).find((r) => r.id === id);
      const g = employeeGuard(data, c, 'remove', null, cur || {}); if (!g.ok) return blocked(g);
      try { await backend.remove(c, id); } catch (e) { return failed(e); }
      audit(backend, c, 'Deleted', cur); return true;
    },
    put: (c, id, row) => {
      const g = employeeGuard(data, c, 'put', row, null); if (!g.ok) return Promise.resolve(blocked(g));
      return backend.put(c, id, row).then(() => true, (e) => failed(e));
    },
  };
}

/** downloads: artifact `downloads` capability when present, otherwise a normal browser download */
export async function saveFile(filename, data) {
  if (window.claude?.use) {
    const dl = await window.claude.use('downloads');
    if (dl) {
      try { await dl.save({ filename, data }); } catch (e) { if (e?.code !== 'declined') console.warn(e); }
      return;
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export const inArtifact = () => typeof window !== 'undefined' && !!window.claude?.use;
