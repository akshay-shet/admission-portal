import { notify } from './components/toast.jsx';
import { verifyHash } from './os/auth.js';
import { GoogleSheetAutoSync } from './os/GoogleSheet.jsx';
import { FirstSetup, setSessionVer, getSessionVer, verOf, SESSION_VER } from './os/LoginSetup.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavCtx } from './components/Layout.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { academySettings } from './os/summary.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StudentForm from './pages/StudentForm.jsx';
import Installments from './pages/Installments.jsx';
import InstallmentForm from './pages/InstallmentForm.jsx';
import StudentInstallments from './pages/StudentInstallments.jsx';
import { LookupList, LookupForm } from './pages/Lookups.jsx';
import OSPage, { OS_KEYS, PageGuard, RootGuard } from './os/index.jsx';
import { readRole, saveRole, permitted, routeKey, homeRoute } from './os/permissions.js';

// Plain #names map to the main screens (e.g. #puc, #installments, #boards)
const HASH = {
  sslc: { page: 'dashboard', tab: 'sslc' }, puc: { page: 'dashboard', tab: 'puc' },
  degree: { page: 'dashboard', tab: 'degree' }, pg: { page: 'dashboard', tab: 'pg' },
  installments: { page: 'installments' },
  boards: { page: 'lookup', kind: 'boards' }, courses: { page: 'lookup', kind: 'courses' },
  combinations: { page: 'lookup', kind: 'combinations' },
};
const hashOf = (r) => (r.page === 'os' ? 'os-' + r.key : Object.keys(HASH).find((k) => HASH[k].page === r.page && (HASH[k].tab === r.tab) && (HASH[k].kind === r.kind)));
const fromHash = () => {
  const h = (window.location.hash || '').slice(1);
  if (h.startsWith('os-') && OS_KEYS.includes(h.slice(3))) return { page: 'os', key: h.slice(3) };
  return HASH[h] || HASH.sslc;
};

const SESSION_KEY = 'student-portal-admin';
const readSession = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } };

export default function App() {
  const [user, setUser] = useState(readSession);
  const [route, setRoute] = useState(fromHash);
  const [role, setRoleState] = useState(readRole);

  // Pages visited in this session (for the Back buttons): newest last
  const stack = useRef([route]);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  useEffect(() => {
    const onHash = () => {
      const r = fromHash();
      setRoute((cur) => {
        if (same(cur, r) || hashOf(cur) === hashOf(r)) return cur;
        stack.current = [...stack.current, r];
        return r;
      });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const nav = useMemo(() => ({
    route,
    user,
    role,
    canGoBack: stack.current.length > 1,
    previous: stack.current[stack.current.length - 2] || null,
    /** Back to the page this one was opened from; `fallback` when there is none */
    back: (fallback) => {
      const s = stack.current;
      const r = s.length > 1 ? s[s.length - 2] : fallback;
      if (!r) return;
      stack.current = s.length > 1 ? s.slice(0, -1) : [r];
      setRoute(r);
      const h = hashOf(r);
      if (h && window.location.hash !== '#' + h) { try { history.replaceState(null, '', '#' + h); } catch { /* ignore */ } }
      window.scrollTo(0, 0);
    },
    go: (r) => {
      if (!same(stack.current[stack.current.length - 1], r)) stack.current = [...stack.current.slice(-49), r];
      setRoute(r);
      const h = hashOf(r);
      if (h && window.location.hash !== '#' + h) {
        try { history.replaceState(null, '', '#' + h); } catch { /* ignore */ }
      }
      window.scrollTo(0, 0);
    },
    logout: () => { try { [SESSION_KEY, 'student-portal-role', SESSION_VER, 'student-portal-since'].forEach((k) => sessionStorage.removeItem(k)); } catch { /* ignore */ } setUser(null); },
    /** the owner changed their own username: stay signed in under the new name */
    relogin: (u) => { try { sessionStorage.setItem(SESSION_KEY, u); } catch { /* ignore */ } setUser(u); },
  }), [route, user, role]);

  if (!user) {
    return (
      <RootGuard><StoreProvider key="login">
        <Login onLogin={(u, r, ver) => {
          setSessionVer(ver);
          try { sessionStorage.setItem('student-portal-since', String(Date.now())); } catch { /* ignore */ }
          saveRole(r); setRoleState(r === 'Employee' ? 'Employee' : 'Owner');
          const home = homeRoute(r);
          stack.current = [home]; setRoute(home);
          try { sessionStorage.setItem(SESSION_KEY, u); sessionStorage.setItem('go-start', '1'); history.replaceState(null, '', '#' + hashOf(home)); } catch { /* ignore */ }
          setUser(u);
        }} />
      </StoreProvider></RootGuard>
    );
  }

  let page;
  switch (route.page) {
    case 'student-add': page = <StudentForm key={'a' + route.level + (route.prefill?.student_name || '')} level={route.level} prefill={route.prefill} />; break;
    case 'student-edit': page = <StudentForm key={'e' + route.id} level={route.level} id={route.id} />; break;
    case 'installments': page = <Installments />; break;
    case 'inst-add': page = <InstallmentForm key={'new' + (route.studentId || '')} studentId={route.studentId} back={route.back} />; break;
    case 'inst-edit': page = <InstallmentForm key={route.id} id={route.id} back={route.back} />; break;
    case 'inst-student': page = <StudentInstallments key={route.studentId} studentId={route.studentId} />; break;
    case 'lookup': page = <LookupList kind={route.kind} />; break;
    case 'lookup-add': page = <LookupForm key="new" kind={route.kind} />; break;
    case 'lookup-edit': page = <LookupForm key={route.id} kind={route.kind} id={route.id} />; break;
    case 'os': page = <OSPage key={route.key + (route.q || '')} k={route.key} />; break;
    default: page = <Dashboard tab={route.tab || 'sslc'} />;
  }
  // pages the login may not open are hidden completely: show its home page instead
  if (!permitted(routeKey(route), role)) {
    const home = homeRoute(role);
    page = <OSPage key={'home' + home.key} k={home.key} />;
    queueMicrotask(() => { try { if (window.location.hash !== '#' + hashOf(home)) history.replaceState(null, '', '#' + hashOf(home)); } catch { /* ignore */ } });
  }

  return (
    <RootGuard>
    <StoreProvider key={`app-${user}-${role}`}>
      <NavCtx.Provider value={nav}><SessionHelpers logout={nav.logout} role={role} user={user} /><GoogleSheetAutoSync /><DefaultLoginWarning role={role} go={nav.go} /><SetupGate role={role} nav={nav}><PageGuard key={JSON.stringify(route)} go={nav.go}>{page}</PageGuard></SetupGate></NavCtx.Provider>
    </StoreProvider>
    </RootGuard>
  );
}

/* After login: open the start page chosen in Settings > Display. While logged in: automatic logout after inactivity. */
function SessionHelpers({ logout, role, user }) {
  const store = useStore();
  const a = academySettings(store.data);
  const start = a.start_page;
  const idleMin = Number(a.auto_logout_min) || 0;
  // the login type in this tab must belong to the signed-in name: an Employee session can never be turned into an Owner one
  const ownerName = String((a.auth?.hash && a.auth?.username) || 'admin').toLowerCase();
  const empName = String((a.employee_auth?.hash && a.employee_auth?.username) || 'employee').toLowerCase();
  const me = String(user || '').toLowerCase();
  // on this page the tab's own record of who signed in (updated at once when the owner renames their login)
  let meHere = me; try { meHere = String(sessionStorage.getItem(SESSION_KEY) || user || '').toLowerCase(); } catch { /* ignore */ }
  // the login's details changed since this tab signed in (new password set elsewhere, employee login changed or turned off)
  const ver = getSessionVer();
  const curAuth = role === 'Employee' ? a.employee_auth : a.auth;
  const sameVer = ver == null || ver === verOf(curAuth);
  const empOk = role !== 'Employee' || !!curAuth?.hash || !curAuth?.disabled;
  const valid = (role === 'Employee' ? meHere === empName : meHere === ownerName) && sameVer && empOk;
  useEffect(() => {
    if (store.settingsReady && !valid) { try { sessionStorage.setItem('login-note', 'Signed out because the login details changed. Please sign in again.'); } catch { /* ignore */ } logout(); }
  }, [store.settingsReady, valid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let flag = null;
    try { flag = sessionStorage.getItem('go-start'); } catch { /* ignore */ }
    if (!flag) return undefined;
    const done = () => { try { sessionStorage.removeItem('go-start'); } catch { /* ignore */ } };
    const startKey = String(start || '').startsWith('os-') ? String(start).slice(3) : start === 'installments' ? 'installments' : 'students';
    if (start && permitted(startKey, role)) { done(); if (window.location.hash.slice(1) !== start) window.location.hash = start; return undefined; }
    if (start) { done(); return undefined; }
    const t = setTimeout(done, 4000); // settings not saved yet: stay on the default page
    return () => clearTimeout(t);
  }, [start, role]);
  useEffect(() => {
    if (!idleMin) return undefined;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, idleMin * 60000); };
    const ev = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    ev.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); ev.forEach((e) => window.removeEventListener(e, reset)); };
  }, [idleMin, logout]);
  useEffect(() => { // a sign-in lasts at most 12 hours, then the login is asked again
    const check = () => {
      let since = 0; try { since = Number(sessionStorage.getItem('student-portal-since') || 0); } catch { /* ignore */ }
      if (since && Date.now() - since > 12 * 3600e3) { try { sessionStorage.setItem('login-note', 'Signed out after 12 hours. Please sign in again.'); } catch { /* ignore */ } logout(); }
    };
    check(); const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [logout]);
  return null;
}

/* Owner signed in with the starting login (admin / admin): choose an own login before anything else */
function SetupGate({ role, nav, children }) {
  const store = useStore();
  const a = academySettings(store.data);
  const needs = false; // admin / admin may be used as it is (Settings › Login & security changes it)
  const [hold, setHold] = useState(false);
  if (needs && !hold) setHold(true);
  if (needs || hold) {
    return <FirstSetup store={store} logout={nav.logout} onDone={(r) => { notify('Owner login saved — use it from now on'); setHold(false); nav.relogin(r.username); }} />;
  }
  return children;
}

/* Owner: a clear warning while a login still uses its well-known starting password */
function DefaultLoginWarning({ role, go }) {
  const store = useStore();
  const a = academySettings(store.data);
  const [weak, setWeak] = useState([]);
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('weak-login-hidden') === '1'; } catch { return false; } });
  useEffect(() => {
    let on = true;
    (async () => {
      const out = [];
      const own = a.auth; const emp = a.employee_auth;
      if (!own?.hash || (String(own.username).toLowerCase() === 'admin' && await verifyHash('admin', own.hash))) out.push('owner (admin / admin)');
      if (!emp?.disabled && (!emp?.hash || (String(emp.username).toLowerCase() === 'employee' && await verifyHash('employee', emp.hash)))) out.push('employee (employee / employee)');
      if (on) setWeak(out);
    })();
    return () => { on = false; };
  }, [a.auth?.hash, a.employee_auth?.hash, a.employee_auth?.disabled]); // eslint-disable-line react-hooks/exhaustive-deps
  if (role !== 'Owner' || !store.settingsReady || !weak.length || hidden) return null;
  return (
    <div className="weak-login" role="alert">
      <span><b>Security:</b> the {weak.join(' and ')} login{weak.length > 1 ? 's use' : ' uses'} the well-known starting password — anyone who knows it can sign in.</span>
      <button type="button" className="btn btn-sm btn-light" onClick={() => { try { sessionStorage.setItem('settings-tab', 'security'); } catch { /* ignore */ } go({ page: 'os', key: 'settings' }); }}>Change now</button>
      <button type="button" className="btn btn-sm btn-link text-white" onClick={() => { setHidden(true); try { sessionStorage.setItem('weak-login-hidden', '1'); } catch { /* ignore */ } }}>Hide</button>
    </div>
  );
}
