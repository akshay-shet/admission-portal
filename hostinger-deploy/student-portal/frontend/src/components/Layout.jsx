import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { fileUrl } from '../utils.js';
import { useStore } from '../store.jsx';
import { NAV, OS_TITLES, permitted } from '../os/permissions.js';
import { academySettings, notificationCount } from '../os/summary.js';
import { applyTheme } from '../os/theme.js';
import { setReceiptBranding } from './printStatement.js';
import Icon from './Icon.jsx';
import { Toaster } from './toast.jsx';

export const NavCtx = createContext(null);
export const useNav = () => useContext(NavCtx);

/** <a> that navigates inside the app (keeps the look of the original links) */
export function Link({ to, className, children, onClick }) {
  const { go } = useNav();
  return (
    <a
      href="#"
      className={className}
      onClick={(e) => { e.preventDefault(); onClick?.(); go(to); }}
    >
      {children}
    </a>
  );
}

const PAGE_TITLES = {
  dashboard: (r) => `${{ sslc: 'SSLC', puc: 'PUC', degree: 'Degree', pg: 'PG' }[r.tab || 'sslc']} Students`,
  'student-add': (r) => `${{ sslc: 'SSLC', puc: 'PUC', degree: 'Degree', pg: 'PG' }[r.level]} Students`,
  'student-edit': (r) => `${{ sslc: 'SSLC', puc: 'PUC', degree: 'Degree', pg: 'PG' }[r.level]} Students`,
  installments: () => 'Installments', 'inst-add': () => 'Installments', 'inst-edit': () => 'Installments', 'inst-student': () => 'Installments',
  os: (r) => OS_TITLES[r.key] || '',
  lookup: (r) => r.kind[0].toUpperCase() + r.kind.slice(1), 'lookup-add': (r) => r.kind[0].toUpperCase() + r.kind.slice(1),
  'lookup-edit': (r) => r.kind[0].toUpperCase() + r.kind.slice(1),
};

export function Navbar() {
  const { user, route, role, go } = useNav();
  const store = useStore();
  const [q, setQ] = useState('');
  const section = PAGE_TITLES[route.page]?.(route) || '';
  const year = academySettings(store.data).academic_year;
  const bell = notificationCount(store.data, role);
  return (
    <nav className="topbar">
      <div className="topbar-title">
        <span className="topbar-app">Student Admin Panel</span>
        {section && <><span className="topbar-sep" aria-hidden="true">/</span><span className="topbar-section">{section}</span></>}
      </div>
      <div className="topbar-user">
        <input className="topbar-search" placeholder="Search students…" value={q} aria-label="Search students"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { go({ page: 'os', key: 'all-students', q: q.trim() }); setQ(''); } }} />
        {year && <span className="topbar-pill topbar-hide">Year: <b>{year}</b></span>}
        <span className={`topbar-pill topbar-role role-${role === 'Employee' ? 'emp' : 'own'}`} title={role === 'Employee' ? 'Employee login: owner-only pages are hidden' : 'Owner login: full access'}>{role === 'Employee' ? 'Employee' : 'Owner'}</span>
        <button type="button" className="topbar-pill topbar-bell" onClick={() => go({ page: 'os', key: 'notifications' })} aria-label={`Notifications: ${bell}`}><Icon name="bell" size={16} />{bell > 0 && <b>{bell}</b>}</button>
        <span className="topbar-welcome topbar-hide">Welcome, <strong>{user}</strong></span>
        <span className="topbar-avatar" aria-hidden="true">{(user || '?').slice(0, 1).toUpperCase()}</span>
      </div>
    </nav>
  );
}

const LEVEL_LINK = { sslc: 'SSLC Students', puc: 'PUC Students', degree: 'Degree Students', pg: 'PG Students' };

// Sidebar scroll position survives page changes (each page draws its own frame)
let sideScroll = 0;

export function Sidebar() {
  const { route, logout, role } = useNav();
  const [open, setOpen] = useState(false);
  const asideRef = useRef(null);
  useLayoutEffect(() => { if (asideRef.current) asideRef.current.scrollTop = sideScroll; }, []);
  const lv = route.level || route.tab;
  const isStudents = (t) => (['dashboard', 'student-add', 'student-edit'].includes(route.page) && lv === t ? 'active' : '');
  const isInst = route.page.startsWith('inst') && !(route.page === 'inst-add' && !route.studentId) ? 'active' : '';
  const isCollect = route.page === 'inst-add' && !route.studentId ? 'active' : '';
  const close = () => setOpen(false);
  const item = ([kind, key, icon]) => {
    const g = <Icon name={icon} size={17} className="nav-ico" />;
    if (kind === 'students') return <Link key={key} to={{ page: 'dashboard', tab: key }} className={isStudents(key)} onClick={close}>{g}{LEVEL_LINK[key]}</Link>;
    if (kind === 'installments') return permitted('installments', role) && <Link key={key} to={{ page: 'installments' }} className={isInst} onClick={close}>{g}Manage Installments</Link>;
    if (kind === 'collect') return permitted('collect', role) && <Link key={key} to={{ page: 'inst-add' }} className={isCollect} onClick={close}>{g}Collect Fee</Link>;
    return permitted(key, role) && (
      <Link key={key} to={{ page: 'os', key }} className={route.page === 'os' && route.key === key ? 'active' : ''} onClick={close}>
        {g}{OS_TITLES[key]}
      </Link>
    );
  };
  return (
    <aside ref={asideRef} className={`sidebar ${open ? 'open' : ''}`} onScroll={(e) => { sideScroll = e.currentTarget.scrollTop; }}>
      <div className="logo">
        <span className="logo-mark" aria-hidden="true"><Icon name="cap" size={18} /></span>
        <span className="logo-text">Student Portal</span>
        <button type="button" className="menu-toggle" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}><Icon name="menu" size={18} /></button>
      </div>
      <nav className="sidebar-links">
        {NAV.map((sec) => {
          const links = sec.items.map(item).filter(Boolean);
          return links.length > 0 && <div key={sec.section} className="nav-group"><div className="nav-label">{sec.section}</div>{links}</div>;
        })}

        {/* Management links (hidden in the original portal):
        <Link to={{ page: 'lookup', kind: 'courses' }}>📘 Manage Courses</Link>
        <Link to={{ page: 'lookup', kind: 'combinations' }}>🧩 Manage Combinations</Link>
        <Link to={{ page: 'lookup', kind: 'boards' }}>🏫 Manage Boards</Link> */}

        <div className="sidebar-foot">
          <a href="#" className="logout" onClick={(e) => { e.preventDefault(); logout(); }}><Icon name="logout" size={16} className="nav-ico" />Log out</a>
        </div>
      </nav>
    </aside>
  );
}

/** Page shell: one dark frame (fixed sidebar + top bar) around the content */
/* Institution bar: the academy's own logo and name above everything (set in Settings > Institution branding) */
export const DEFAULT_BRAND = { title: 'Student Admission Portal', tagline: 'Admissions · Students · Fees' };
export function InstitutionBar() {
  const store = useStore();
  const a = academySettings(store.data);
  const title = a.inst_title || DEFAULT_BRAND.title;
  const tagline = a.inst_tagline ?? DEFAULT_BRAND.tagline;
  const logo = fileUrl(a.inst_logo);
  const themeKey = JSON.stringify(a.theme || {});
  useLayoutEffect(() => { applyTheme(a.theme); }, [themeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  setReceiptBranding({ title, tagline, logo, phone: a.phone, email: a.email, address: a.address, website: a.website, footer: a.receipt_footer, signatures: a.show_signatures !== 'No' });
  return (
    <header className="inst-bar">
      {logo ? <img className="inst-logo" src={logo} alt="" /> : <span className="inst-logo inst-logo-default" aria-hidden="true"><Icon name="cap" size={22} /></span>}
      <div className="inst-text">
        <div className="inst-title">{title}</div>
        {tagline && <div className="inst-tagline">{tagline}</div>}
      </div>
    </header>
  );
}

/* Pages opened from another page get a Back button; where it leads if there is no previous page */
const PARENT = {
  'student-add': (r) => ({ page: 'dashboard', tab: r.level }), 'student-edit': (r) => ({ page: 'dashboard', tab: r.level }),
  'inst-add': (r) => r.back || { page: 'installments' }, 'inst-edit': (r) => r.back || { page: 'installments' },
  'inst-student': () => ({ page: 'installments' }),
  'lookup-add': (r) => ({ page: 'lookup', kind: r.kind }), 'lookup-edit': (r) => ({ page: 'lookup', kind: r.kind }),
};
const OS_PARENT = { 'new-admission': { page: 'os', key: 'all-students' } };
function parentOf(r) {
  if (r.page === 'os') return OS_PARENT[r.key] || null;
  return PARENT[r.page]?.(r) || null;
}
export const titleOf = (r) => (r ? PAGE_TITLES[r.page]?.(r) || '' : '');

function BackBar() {
  const { route, back, previous } = useNav();
  const parent = parentOf(route);
  // also offer Back on any page reached from somewhere other than the sidebar when the page has a natural parent
  if (!parent) return null;
  const target = previous || parent;
  const label = titleOf(target);
  return (
    <div className="page-back">
      <button type="button" className="btn btn-sm btn-light page-back-btn" onClick={() => back(parent)}><Icon name="back" size={14} /> Back{label ? ` to ${label}` : ''}</button>
    </div>
  );
}

export function Shell({ children }) {
  return (
    <div className="app-frame">
      <InstitutionBar />
      <Sidebar />
      <div className="app-body">
        <Navbar />
        <main className="main-content"><BackBar />{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

/** Same frame for the add/edit student forms, content inside a card */
export function FormShell({ children }) {
  return (
    <Shell>
      <div className="card page-card form-card">{children}</div>
    </Shell>
  );
}

/** Replacement for window.confirm(), which is blocked inside artifacts */
export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (message) => new Promise((resolve) => setState({ message, resolve }));
  const done = (v) => { state.resolve(v); setState(null); };
  const dialog = state && (
    <div className="confirm-backdrop" role="dialog" aria-modal="true" onClick={() => done(false)}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-title"><Icon name="alert" size={18} /> Please confirm</div>
        <p className="confirm-msg">{state.message}</p>
        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="btn btn-outline-secondary" onClick={() => done(false)}>Cancel</button>
          <button type="button" className={`btn ${/delete|remove|replace|reject/i.test(state.message) ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => done(true)}>{/delete/i.test(state.message) ? 'Delete' : /remove/i.test(state.message) ? 'Remove' : 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
  return [ask, dialog];
}
