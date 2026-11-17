/* Front end ↔ backend link (bundled into the React app through the "@connectivity" alias in frontend/vite.config.js).
   Gives frontend/src/store.jsx two storage "backends" with the same methods it already uses for claude.ai and the browser:
   subscribe / snapshot / add / update / remove / put — so the pages, forms and fee logic stay exactly the same.
   Sign-in token: kept in this tab only (sessionStorage), sent as "Authorization: Bearer …", never in a web address. */

export const TOKEN_KEY = 'student-portal-token';
const OUTBOX_KEY = 'student-portal-outbox-server';
const newClientId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const saveToken = (t) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };

function signOutExpired() {
  try {
    ['student-portal-admin', 'student-portal-role', TOKEN_KEY, 'student-portal-ver', 'student-portal-since'].forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.setItem('login-note', 'Your session ended. Please sign in again.');
  } catch { /* ignore */ }
  window.location.reload();
}

/** one call to the backend; errors carry .status and .code */
export async function api(path, opts = {}) {
  const t = readToken();
  let res;
  try {
    res = await fetch(path, { ...opts, cache: 'no-store', credentials: 'same-origin', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) } });
  } catch (e) { const err = new Error('The server could not be reached — check the internet connection.'); err.code = 'network'; err.offline = true; throw err; }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && t && !path.startsWith('/api/login') && !path.startsWith('/api/recover')) signOutExpired();
    const e = new Error(j.error || `Server error (${res.status})`); e.status = res.status; e.code = j.code || (res.status === 403 ? 'invalid_argument' : ''); throw e;
  }
  return j;
}

/** is this page served by the portal backend? */
export async function serverAvailable() {
  if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return false;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000);
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: ctl.signal });
    return (res.headers.get('content-type') || '').includes('application/json') && (res.ok || res.status === 503);
  } catch { return false; } finally { clearTimeout(tm); }
}

/** log out on the server too (the token stops working at once); never blocks the logout */
export function serverLogout() {
  const t = readToken();
  if (!t) return;
  try { fetch('/api/logout', { method: 'POST', keepalive: true, headers: { authorization: `Bearer ${t}` } }).catch(() => {}); } catch { /* ignore */ }
}

/** Before sign-in: only the name / logo / colours for the login page, plus sign-in and "forgot password" */
export class PublicApiBackend {
  constructor(collections) {
    this.kind = 'server'; this.publicOnly = true;
    this.data = Object.fromEntries(collections.map((c) => [c, []]));
    this.ready = new Set(); this.listeners = new Set(); this.error = null;
    api('/api/public').then((j) => {
      this.data = { ...this.data, settings: [{ id: 'academy-settings', academy: j.academy || {} }] };
      this.ready.add('settings'); this.emit();
    }).catch((e) => { this.error = e; this.emit(); });
  }
  emit() { this.listeners.forEach((fn) => fn()); }
  subscribe(fn) { this.listeners.add(fn); fn(); return () => this.listeners.delete(fn); }
  snapshot() { return this.data; }
  async login(kind, username, password) {
    const j = await api('/api/login', { method: 'POST', body: JSON.stringify({ kind, username, password }) });
    saveToken(j.token);
    return j;
  }
  async recover(username, code, next) { return api('/api/recover', { method: 'POST', body: JSON.stringify({ username, code, next }) }); }
  async add() { throw new Error('Please sign in first.'); }
  async update() { throw new Error('Please sign in first.'); }
  async remove() { throw new Error('Please sign in first.'); }
  async put() { throw new Error('Please sign in first.'); }
}

/** Signed in: every record comes from and goes to PostgreSQL through the backend; changes from other computers arrive live */
export class ApiBackend {
  constructor(collections) {
    this.kind = 'server'; this.collections = collections;
    this.data = Object.fromEntries(collections.map((c) => [c, []]));
    this.ready = new Set(); this.listeners = new Set(); this.error = null; this.me = null;
    this.pending = new Map();
    try { this.outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { this.outbox = []; }
    this.onOnline = () => this.flush();
    if (typeof window !== 'undefined') window.addEventListener('online', this.onOnline);
    this.timer = setInterval(() => this.flush(), 20000);
    this.load().then(() => this.flush());
  }
  async load() {
    try {
      const j = await api('/api/data');
      this.data = { ...this.data, ...j.collections };
      this.me = { user: j.user, role: j.role };
      this.collections.forEach((c) => this.ready.add(c));
      this.error = null; this.view = null;
      this.emit(); this.listen();
    } catch (e) { if (e.status !== 401) { this.error = e; this.emit(); setTimeout(() => !this.closed && this.load(), 10000); } }
  }
  /* live updates: a one-use ticket opens the stream */
  async listen() {
    if (typeof EventSource === 'undefined' || this.closed || this.es || !readToken()) return;
    let ticket;
    try { ticket = (await api('/api/events/ticket', { method: 'POST' })).ticket; } catch { setTimeout(() => this.listen(), 10000); return; }
    if (this.closed) return;
    this.es = new EventSource(`/api/events?ticket=${encodeURIComponent(ticket)}`);
    this.es.onerror = () => { this.es?.close(); this.es = null; if (!this.closed) setTimeout(() => { this.listen(); this.refreshAll(); }, 5000); };
    this.es.addEventListener('bye', () => { this.es?.close(); this.es = null; });
    this.es.addEventListener('change', (ev) => {
      let c = ''; try { c = JSON.parse(ev.data).collection; } catch { return; }
      if (!this.collections.includes(c) || this.pending.has(c)) return;
      this.pending.set(c, setTimeout(async () => {
        this.pending.delete(c);
        try { this.set(c, await api(`/api/c/${c}`)); } catch { /* the next change retries */ }
      }, 150));
    });
  }
  /** after a lost connection: fetch everything again so nothing changed meanwhile is missed */
  async refreshAll() { try { const j = await api('/api/data'); this.data = { ...this.data, ...j.collections }; this.view = null; this.emit(); } catch { /* later */ } }
  set(c, rows) { this.data = { ...this.data, [c]: rows }; this.view = null; this.emit(); }
  close() { this.closed = true; this.es?.close(); this.es = null; clearInterval(this.timer); if (typeof window !== 'undefined') window.removeEventListener('online', this.onOnline); }
  emit() { this.listeners.forEach((fn) => fn()); }
  subscribe(fn) { this.listeners.add(fn); fn(); return () => this.listeners.delete(fn); }
  /* ---- saves: straight to the server; if it cannot be reached they wait on this computer and upload by themselves (same as on claude.ai) ---- */
  snapshot() {
    if (!this.outbox?.length) return this.data;
    if (this.view) return this.view;
    const v = { ...this.data };
    for (const w of this.outbox) {
      const rows = (v[w.c] || []).filter((r) => r.id !== w.id);
      v[w.c] = w.op === 'delete' ? rows : [...rows, { ...(w.full || w.row), id: w.id }];
    }
    this.view = v; return v;
  }
  async send(w) {
    const url = `/api/c/${w.c}/${encodeURIComponent(w.id)}`;
    if (w.op === 'delete') { await api(url, { method: 'DELETE' }); this.set(w.c, this.data[w.c].filter((r) => r.id !== w.id)); return null; }
    const j = await api(url, { method: w.op === 'patch' ? 'PATCH' : 'PUT', body: JSON.stringify({ row: w.row }) });
    this.set(w.c, this.data[w.c].some((r) => r.id === w.id) ? this.data[w.c].map((r) => (r.id === w.id ? j.row : r)) : [...this.data[w.c], j.row]);
    return j.row;
  }
  queue(w) {
    this.outbox = [...(this.outbox || []).filter((x) => !(x.c === w.c && x.id === w.id && w.op !== 'patch')), { ...w, at: Date.now() }];
    try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.outbox)); } catch { /* storage full */ }
    this.view = null; this.emit();
  }
  async write(w) {
    if ((this.outbox || []).some((x) => x.c === w.c && x.id === w.id) || (typeof navigator !== 'undefined' && navigator.onLine === false)) { this.queue(w); return null; }
    try { return await this.send(w); } catch (e) { if (!e.offline && !(e.status >= 500)) throw e; this.queue(w); return null; }
  }
  async flush() {
    if (this.flushing || !this.outbox?.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    this.flushing = true;
    try {
      while (this.outbox.length) {
        try { await this.send(this.outbox[0]); } catch (e) { if (e.offline || e.status >= 500) break; /* refused by the server: dropped */ }
        this.outbox = this.outbox.slice(1);
        try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.outbox)); } catch { /* ignore */ }
        this.view = null;
      }
    } finally { this.flushing = false; this.emit(); }
  }
  async add(c, row) { const id = newClientId(); await this.write({ op: 'put', c, id, row, full: row }); return id; }
  async update(c, id, row) { const cur = this.snapshot()[c].find((r) => r.id === id) || {}; await this.write({ op: 'patch', c, id, row, full: { ...cur, ...row } }); }
  async remove(c, id) { await this.write({ op: 'delete', c, id }); }
  async put(c, id, row) { await this.write({ op: 'put', c, id, row, full: row }); }
  /** Owner: change the owner or employee login (checked by the server) */
  async changeLogin(kind, username, current, next, opts = {}) {
    const j = await api('/api/credentials', { method: 'POST', body: JSON.stringify({ kind, username, current, next, new_code: !!opts.newCode, disable: !!opts.disable }) });
    if (j.token) { saveToken(j.token); try { sessionStorage.setItem('student-portal-admin', j.user); } catch { /* ignore */ } }
    return j;
  }
  /** Owner: restore a backup file in one go (all or nothing) */
  async importAll(data) { const j = await api('/api/import', { method: 'POST', body: JSON.stringify({ data }) }); await this.load(); return j.records; }
}
