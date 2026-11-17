/* Automatic drafts: every form keeps what has been typed in this browser's storage the moment it changes,
   so a closed tab, a crash, a power cut, a dead battery or a sleeping screen never loses it.
   Opening the same form again brings the draft back (with a "Discard" button). Saving the form removes the draft.
   Passwords are never put in drafts. */
import { useEffect, useRef, useState } from 'react';
import { fmtDateTime } from '../utils.js';
import Icon from './Icon.jsx';

const PREFIX = 'student-portal-draft:';
const who = () => { try { return sessionStorage.getItem('student-portal-admin') || 'user'; } catch { return 'user'; } };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
function write(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch {
    // storage full: drop the oldest drafts and try once more
    try {
      const old = Object.keys(localStorage).filter((x) => x.startsWith(PREFIX)).map((x) => [x, read(x)?.at || 0]).sort((a, b) => a[1] - b[1]);
      old.slice(0, Math.max(1, Math.floor(old.length / 2))).forEach(([x]) => { if (x !== k) localStorage.removeItem(x); });
      localStorage.setItem(k, JSON.stringify(v)); return true;
    } catch { return false; }
  }
}
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
/* files still uploading (File objects) cannot be kept — only finished uploads */
const storable = (v) => JSON.parse(JSON.stringify(v, (key, x) => (typeof File !== 'undefined' && x instanceof File ? undefined : x)));

/** drafts older than 60 days are removed */
try { const lim = Date.now() - 60 * 864e5; Object.keys(localStorage).filter((x) => x.startsWith(PREFIX)).forEach((x) => { if ((read(x)?.at || 0) < lim) drop(x); }); } catch { /* ignore */ }

/**
 * useDraft('student:add:sslc', {vals, plan}, (d) => { setVals(d.vals); setPlan(d.plan); })
 * returns { restored (time or null), savedAt, clear() after a successful save, discard() }
 */
export function useDraft(key, value, apply, enabled = true) {
  const full = key && enabled ? `${PREFIX}${who()}:${key}` : null;
  const initial = useRef(null);
  if (initial.current === null) initial.current = JSON.stringify(storable(value));
  const done = useRef(false);
  const applyRef = useRef(apply); applyRef.current = apply;
  const [restored, setRestored] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const json = JSON.stringify(storable(value));

  useEffect(() => { // bring a draft back once, when the form opens
    if (!full) return;
    const d = read(full);
    if (d && d.value && JSON.stringify(d.value) !== initial.current) { applyRef.current(d.value); setRestored(d.at); }
  }, [full]);
  useEffect(() => { // keep every change at once (synchronous storage write: survives a power cut a moment later)
    if (!full || done.current) return;
    if (json === initial.current && !read(full)) return;
    if (json === initial.current) { drop(full); setSavedAt(null); return; }
    if (write(full, { at: Date.now(), value: JSON.parse(json) })) setSavedAt(Date.now());
  }, [full, json]);
  useEffect(() => { // last chance when the tab is hidden, closed or frozen (screen off, low battery, app switch)
    if (!full) return undefined;
    const flush = () => { if (!done.current && json !== initial.current) write(full, { at: Date.now(), value: JSON.parse(json) }); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('freeze', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); window.removeEventListener('beforeunload', flush); document.removeEventListener('freeze', flush); };
  }, [full, json]);

  return {
    restored, savedAt,
    clear: () => { done.current = true; if (full) drop(full); },
    discard: () => { if (full) drop(full); setRestored(null); setSavedAt(null); applyRef.current(JSON.parse(initial.current)); },
  };
}

/** "Unsaved changes were brought back" line + quiet "Draft saved" note */
export function DraftBanner({ draft }) {
  if (draft.restored) {
    return (
      <div className="draft-banner" role="status">
        <Icon name="check" size={15} />
        <span>Your unsaved changes from <b>{fmtDateTime(new Date(draft.restored).toISOString())}</b> were brought back. Press <b>Save</b> to keep them.</span>
        <button type="button" className="btn btn-link btn-sm p-0 ms-auto" onClick={draft.discard}>Discard</button>
      </div>
    );
  }
  return draft.savedAt ? <div className="draft-note">Draft saved automatically on this computer · {new Date(draft.savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div> : null;
}
