/* Portal colours: title bar, top navigation bar, side navigation bar, highlight. Text colours are chosen automatically for contrast. */
export const DEFAULT_THEME = { inst_bg: '#ffffff', top_bg: '#0f172a', side_bg: '#0f172a', accent: '#3b82f6' };

export const THEME_PRESETS = [
  { name: 'Classic Navy', theme: DEFAULT_THEME },
  { name: 'Royal Blue', theme: { inst_bg: '#ffffff', top_bg: '#1e3a8a', side_bg: '#172554', accent: '#60a5fa' } },
  { name: 'Emerald', theme: { inst_bg: '#ffffff', top_bg: '#064e3b', side_bg: '#022c22', accent: '#10b981' } },
  { name: 'Maroon', theme: { inst_bg: '#fff7ed', top_bg: '#7f1d1d', side_bg: '#450a0a', accent: '#f59e0b' } },
  { name: 'Purple', theme: { inst_bg: '#ffffff', top_bg: '#4c1d95', side_bg: '#2e1065', accent: '#a78bfa' } },
  { name: 'Charcoal & Gold', theme: { inst_bg: '#111827', top_bg: '#1f2937', side_bg: '#111827', accent: '#e5ad24' } },
  { name: 'Light', theme: { inst_bg: '#ffffff', top_bg: '#f8fafc', side_bg: '#ffffff', accent: '#2563eb' } },
  { name: 'Teal', theme: { inst_bg: '#f0fdfa', top_bg: '#115e59', side_bg: '#134e4a', accent: '#2dd4bf' } },
];

const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? m[1] : null; };
const rgb = (h) => { const x = hex(h); return x ? [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) : null; };
const lum = (h) => { const c = rgb(h); if (!c) return 0; const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const isLight = (h) => lum(h) > 0.45;
const shade = (h, amt) => { const c = rgb(h); if (!c) return h; return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v + amt * (amt < 0 ? v : 255 - v)))).toString(16).padStart(2, '0')).join(''); };

/** CSS variables for a theme */
export function themeVars(t0) {
  const t = { ...DEFAULT_THEME, ...(t0 || {}) };
  const inst = hex(t.inst_bg) ? t.inst_bg : DEFAULT_THEME.inst_bg;
  const top = hex(t.top_bg) ? t.top_bg : DEFAULT_THEME.top_bg;
  const side = hex(t.side_bg) ? t.side_bg : DEFAULT_THEME.side_bg;
  const acc = hex(t.accent) ? t.accent : DEFAULT_THEME.accent;
  const iL = isLight(inst); const tL = isLight(top); const sL = isLight(side);
  return {
    '--inst-bg': inst, '--inst-fg': iL ? '#0f172a' : '#ffffff', '--inst-muted': iL ? '#64748b' : 'rgba(255,255,255,.72)', '--inst-line': iL ? '#e2e8f0' : 'rgba(255,255,255,.12)',
    '--top-bg': top, '--top-fg': tL ? '#0f172a' : '#ffffff', '--top-muted': tL ? '#64748b' : '#94a3b8', '--top-chip': tL ? 'rgba(15,23,42,.06)' : 'rgba(148,163,184,.12)', '--top-line': tL ? '#e2e8f0' : 'rgba(148,163,184,.16)',
    '--side-bg': side, '--side-bg2': sL ? shade(side, -0.03) : shade(side, 0.06), '--side-fg': sL ? '#334155' : '#cbd5e1', '--side-strong': sL ? '#0f172a' : '#ffffff',
    '--side-muted': sL ? '#94a3b8' : '#64748b', '--side-hover': sL ? 'rgba(15,23,42,.06)' : 'rgba(148,163,184,.12)', '--side-line': sL ? '#e2e8f0' : 'rgba(148,163,184,.16)',
    '--accent': acc,
  };
}

/** Put the theme on the page */
export function applyTheme(t) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(themeVars(t)).forEach(([k, v]) => root.style.setProperty(k, v));
}
