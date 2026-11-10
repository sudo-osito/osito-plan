// Utilidades de interfaz: DOM, formato, fechas, íconos y menús.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value' || k === 'checked') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : String(c));
  }
  return el;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const uid = (p = 'x') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const fmt = (n, d = 1) => (+n || 0).toLocaleString('es-CL', { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const clp = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n) || 0).toLocaleString('es-CL');
export const digits = s => +String(s).replace(/\D/g, '') || 0;
export const lum = hex => {
  const x = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(x.substr(i, 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/* ---------- fechas (siempre en hora local, formato AAAA-MM-DD) ---------- */
const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
export const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
export const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const dow = s => (fromISO(s).getDay() + 6) % 7;              // lunes = 0
export const weekStart = s => addDays(s, -dow(s));
export const monthKey = s => s.slice(0, 7);
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MONTHS_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAYS_1 = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const monthName = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
export const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
export function dayLabel(s) {
  const t = today();
  if (s === t) return 'Hoy';
  if (s === addDays(t, 1)) return 'Mañana';
  if (s === addDays(t, -1)) return 'Ayer';
  const d = fromISO(s);
  const lbl = d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  return d.getFullYear() !== new Date().getFullYear() ? `${lbl} ${d.getFullYear()}` : lbl;
}
export const longDate = (d = new Date()) => d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
export const ampm = h => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
export const slotTime = s => { s = ((s % 48) + 48) % 48; const hh = Math.floor(s / 2); return `${hh % 12 === 0 ? 12 : hh % 12}:${s % 2 ? '30' : '00'} ${hh < 12 ? 'AM' : 'PM'}`; };

/* ---------- íconos (trazo 1.6, heredan el color) ---------- */
const sv = (p, extra = '') => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
export const I = {
  home: sv('<path d="M3.5 9 10 3.5 16.5 9v7a1 1 0 0 1-1 1h-3.5v-5h-4v5H4.5a1 1 0 0 1-1-1z"/>'),
  tasks: sv('<rect x="3.5" y="3.5" width="13" height="13" rx="3.5"/><path d="m7 10 2 2 4-4.5"/>'),
  goals: sv('<circle cx="10" cy="10" r="6.5"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r=".6" fill="currentColor"/>'),
  notes: sv('<path d="M5 3.5h7l3.5 3.5v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-11.5a1 1 0 0 1 1-1z"/><path d="M12 3.5V7h3.5M7 10.5h6M7 13.5h4"/>'),
  week: sv('<rect x="3" y="4.5" width="14" height="12" rx="2.5"/><path d="M3 8.5h14M7 3v3M13 3v3M6.5 11.5h2M11.5 11.5h2M6.5 14h2"/>'),
  money: sv('<rect x="2.5" y="5.5" width="15" height="10" rx="2.5"/><path d="M14.5 10.5h.01M2.5 8.5h15"/>'),
  plus: sv('<path d="M10 4.5v11M4.5 10h11"/>'),
  x: sv('<path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/>'),
  trash: sv('<path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6"/>'),
  edit: sv('<path d="m12.5 4 3.5 3.5-8.5 8.5H4v-3.5z"/>'),
  dup: sv('<rect x="6.5" y="6.5" width="10" height="10" rx="2.2"/><path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5"/>'),
  more: sv('<circle cx="5" cy="10" r=".9" fill="currentColor"/><circle cx="10" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/>'),
  left: sv('<path d="m12 5-5 5 5 5"/>'),
  right: sv('<path d="m8 5 5 5-5 5"/>'),
  down: sv('<path d="m5.5 8 4.5 4.5L14.5 8"/>'),
  pin: sv('<path d="M7.5 3.5h5l-.8 4.3 2.8 2.7v1.5h-9v-1.5l2.8-2.7z"/><path d="M10 12v4.5"/>'),
  flag: sv('<path d="M5 17V3.5M5 4h9l-2 3.5 2 3.5H5"/>'),
  search: sv('<circle cx="9" cy="9" r="5"/><path d="m16 16-3.4-3.4"/>'),
  lock: sv('<rect x="4.5" y="9" width="11" height="8" rx="2" fill="currentColor" stroke="none"/><path d="M7 9V6.8a3 3 0 0 1 6 0V9"/>'),
  unlock: sv('<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.8a3 3 0 0 1 5.8-1"/>'),
  undo: sv('<path d="M7.5 5 4 8.5 7.5 12"/><path d="M4 8.5h7.5a4.5 4.5 0 0 1 0 9H9"/>'),
  save: sv('<path d="M10 3.5v9M6.5 9 10 12.5 13.5 9"/><path d="M4 14v1.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V14"/>'),
  upload: sv('<path d="M10 12.5v-9M6.5 7 10 3.5 13.5 7"/><path d="M4 14v1.5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V14"/>'),
  check: sv('<path d="m5 10.5 3.2 3.2L15 6.5"/>'),
  fire: sv('<path d="M10 17c-3 0-5-2-5-4.8 0-3.2 3-4.6 3-8.2 2.6 1.4 4 3.6 3.8 6 1-.5 1.6-1.5 1.7-2.6C15 9 15 10.8 15 12.2 15 15 13 17 10 17z"/>'),
};

/* ---------- menú contextual (uno abierto a la vez) ---------- */
let openMenuEl = null, openAnchor = null;
export function closeMenu() {
  if (openMenuEl) openMenuEl.remove();
  if (openAnchor) openAnchor.setAttribute('aria-expanded', 'false');
  openMenuEl = openAnchor = null;
}
export function menu(anchor, items, { align = 'right' } = {}) {
  if (openAnchor === anchor) { closeMenu(); return; }
  closeMenu();
  const el = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { el.append(h('hr')); continue; }
    if (it.label && !it.onClick) { el.append(h('div', { class: 'menu-lbl' }, it.label)); continue; }
    el.append(h('button', { class: it.danger ? 'danger' : '', role: 'menuitem', onclick: e => { e.stopPropagation(); closeMenu(); it.onClick(); } }, it.icon ? h('span', { class: 'ic', html: it.icon }) : null, it.label));
  }
  document.body.append(el);
  const r = anchor.getBoundingClientRect();
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let left = align === 'left' ? r.left : r.right - w;
  left = Math.max(8, Math.min(innerWidth - w - 8, left));
  let top = r.bottom + 6;
  if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
  el.style.left = left + 'px'; el.style.top = top + 'px';
  anchor.setAttribute('aria-expanded', 'true');
  openMenuEl = el; openAnchor = anchor;
}
document.addEventListener('pointerdown', e => { if (openMenuEl && !openMenuEl.contains(e.target) && !openAnchor?.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
addEventListener('resize', closeMenu);
addEventListener('hashchange', closeMenu);

/* ---------- campo de texto que se edita en el lugar ---------- */
export function inlineEdit(span, value, onDone) {
  const inp = h('input', { class: 'inline-in', value });
  span.replaceWith(inp); inp.focus(); inp.select();
  let finished = false;
  const done = ok => { if (finished) return; finished = true; onDone(ok ? inp.value.trim() : null); };
  inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
  inp.addEventListener('blur', () => done(true));
  return inp;
}

/* ---------- campo de monto en pesos ---------- */
export function moneyField(get, set, attrs = {}) {
  const el = h('input', { class: 'amt', inputmode: 'numeric', placeholder: '$0', ...attrs });
  el.value = get() ? clp(get()) : '';
  el.addEventListener('focus', () => el.select());
  el.addEventListener('input', () => { const v = digits(el.value); el.value = v ? clp(v) : ''; set(v); });
  return el;
}

export function toast(msg) {
  document.querySelectorAll('.toast').forEach(x => x.remove());   // uno a la vez
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 2600);
}
