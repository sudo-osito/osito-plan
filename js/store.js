// Estado de la app. Todo vive en el navegador (localStorage); nada sale a internet.
import { uid, today } from './ui.js';

const KEY = 'organizador.v1';
export const SLOTS = 48;   // bloques de 30 min por día

// colores de sistema de Apple en modo oscuro
export const PALETTE = ['#5e5ce6', '#0a84ff', '#ff9f0a', '#30d158', '#ffd60a', '#8e8e93', '#ff375f', '#40c8e0', '#bf5af2', '#ff453a', '#64d2ff', '#ac8e68'];
export const DEFAULT_CATS = [
  { id: 'dormir', name: 'Dormir', color: '#5e5ce6' },
  { id: 'trabajo', name: 'Trabajo', color: '#0a84ff' },
  { id: 'hobby', name: 'Hobby', color: '#ff9f0a' },
  { id: 'ejercicio', name: 'Ejercicio', color: '#30d158' },
  { id: 'comida', name: 'Comida', color: '#ffd60a' },
  { id: 'traslado', name: 'Traslado', color: '#8e8e93' },
  { id: 'social', name: 'Familia y amigos', color: '#ff375f' },
  { id: 'personal', name: 'Personal', color: '#40c8e0' },
];
const DEFAULT_MONEY = () => ({
  incomes: [{ id: 'i1', name: 'Sueldo', amount: 0 }],
  dests: [
    { id: 'd1', name: 'Gastos fijos', pct: 0, color: '#0a84ff' },
    { id: 'd2', name: 'Ahorro', pct: 0, color: '#30d158', saving: true },
    { id: 'd3', name: 'Inversión', pct: 0, color: '#40c8e0', saving: true },
    { id: 'd4', name: 'Gustos', pct: 0, color: '#ff9f0a' },
  ],
});
export const blankGrid = () => Array.from({ length: 7 }, () => Array(SLOTS).fill(null));

export function newSchedule(name, from) {
  return normalizeSchedule({
    id: uid('h'), name, updated: Date.now(),
    cats: from ? from.cats.map(c => ({ ...c })) : DEFAULT_CATS.map(c => ({ ...c })),
    grid: from ? from.grid.map(c => c.slice()) : blankGrid(),
    brush: from?.brush ?? 'dormir',
  });
}
export function normalizeSchedule(s) {
  s = s || {};
  if (!Array.isArray(s.cats) || !s.cats.length) s.cats = DEFAULT_CATS.map(c => ({ ...c }));
  if (!Array.isArray(s.grid)) s.grid = blankGrid();
  s.grid = s.grid.map(col => (col.length === 24 ? col.flatMap(v => [v, v]) : col.slice(0, SLOTS)));   // versión por hora → 30 min
  s.grid = s.grid.map(col => col.concat(Array(Math.max(0, SLOTS - col.length)).fill(null)));
  while (s.grid.length < 7) s.grid.push(Array(SLOTS).fill(null));
  s.grid.length = 7;
  s.id ||= uid('h'); s.name ||= 'Mi semana'; s.updated ||= Date.now();
  if (s.brush === undefined) s.brush = s.cats[0]?.id ?? null;
  return s;
}

function fresh() {
  const sch = newSchedule('Mi semana');
  return { app: 'organizador', v: 1, schedules: { active: sch.id, list: [sch] }, money: DEFAULT_MONEY(), savings: { goals: {}, months: {} }, ledger: [], tasks: [], habits: [], goals: [], notes: [], ui: {} };
}
export function normalize(o) {
  const f = fresh();
  if (!o || typeof o !== 'object') return f;
  for (const k of Object.keys(f)) if (o[k] == null) o[k] = f[k];
  if (!Array.isArray(o.schedules.list) || !o.schedules.list.length) o.schedules = f.schedules;
  o.schedules.list = o.schedules.list.map(normalizeSchedule);
  if (!o.schedules.list.some(s => s.id === o.schedules.active)) o.schedules.active = o.schedules.list[0].id;
  o.money.incomes ||= []; o.money.dests ||= [];
  o.savings.goals ||= {}; o.savings.months ||= {};
  for (const k of ['tasks', 'habits', 'goals', 'notes', 'ledger']) if (!Array.isArray(o[k])) o[k] = [];
  return o;
}

export let S = null;
export function load() {
  let o = null;
  try { o = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* almacenamiento bloqueado */ }
  S = normalize(o);
  return S;
}
let timer = null;
export function save() { clearTimeout(timer); timer = setTimeout(flush, 120); }
export function flush() { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ } }
addEventListener('pagehide', flush);
addEventListener('beforeunload', flush);

/* ---------- horarios ---------- */
export const activeSchedule = () => S.schedules.list.find(s => s.id === S.schedules.active) || S.schedules.list[0];
export function scheduleCounts(sch) {
  const per = {}, perDay = Array.from({ length: 7 }, () => ({}));
  const ids = new Set(sch.cats.map(c => c.id));
  for (let d = 0; d < 7; d++) for (let s = 0; s < SLOTS; s++) {
    const v = sch.grid[d][s]; if (!v || !ids.has(v)) continue;
    per[v] = (per[v] || 0) + 1; perDay[d][v] = (perDay[d][v] || 0) + 1;
  }
  return { per, perDay };
}
export const uniqueName = (base, list) => { let n = base, i = 2; while (list.some(x => x.name === n)) n = `${base} ${i++}`; return n; };

/* ---------- dinero (cada destino se fija por % o por monto) ---------- */
export const incomeTotal = () => S.money.incomes.reduce((a, i) => a + (+i.amount || 0), 0);
export const isAmt = d => d.mode === 'amt';
export const pctOf = (d, t = incomeTotal()) => (isAmt(d) ? (t ? (+d.amount || 0) / t * 100 : 0) : (+d.pct || 0));
export const amtOf = (d, t = incomeTotal()) => (isAmt(d) ? (+d.amount || 0) : t * (+d.pct || 0) / 100);
export const pctTotal = () => { const t = incomeTotal(); return S.money.dests.reduce((a, d) => a + pctOf(d, t), 0); };
export const yearSavings = y => Object.entries(S.savings.months).filter(([k]) => k.startsWith(y + '-')).reduce((a, [, m]) => a + (+m.saved || 0), 0);

/* ---------- respaldo ---------- */
export function exportData() {
  flush();
  S.ui.lastBackup = Date.now(); flush();
  return JSON.stringify({ ...S, exported: new Date().toISOString() }, null, 1);
}
// Acepta: respaldo del Organizador, el archivo de la herramienta anterior «Mi semana» (todos los perfiles) o un solo perfil.
export function importData(o) {
  if (o && o.app === 'organizador') { S = normalize(o); flush(); return { mode: 'replace' }; }
  let profiles = [];
  if (o && Array.isArray(o.list)) profiles = o.list.map(p => ({ name: p.name, data: p.data, active: p.id === o.active }));
  else if (o && Array.isArray(o.grid)) profiles = [{ name: 'Mi semana', data: o, active: true }];
  else throw new Error('formato');
  let money = null;
  // si el único horario que hay es el de partida y está vacío, se reemplaza en vez de dejarlo de sobra
  if (S.schedules.list.length === 1 && S.schedules.list[0].grid.every(c => c.every(v => !v))) S.schedules.list = [];
  for (const p of profiles) {
    if (!p.data) continue;
    const sch = normalizeSchedule({ name: uniqueName(p.name || 'Horario', S.schedules.list), cats: p.data.cats, grid: p.data.grid, brush: p.data.brush, updated: Date.now() });
    sch.id = uid('h');
    S.schedules.list.push(sch);
    if (p.active || !money) { if (p.data.money) money = p.data.money; S.schedules.active = sch.id; }
  }
  if (!S.schedules.list.length) { const s = newSchedule('Mi semana'); S.schedules.list.push(s); S.schedules.active = s.id; }
  if (money && incomeTotal() === 0) S.money = { incomes: money.incomes || [], dests: money.dests || [] };
  flush();
  return { mode: 'merge', count: profiles.length };
}

export const isToday = s => s === today();

/* ---------- conexiones entre secciones ---------- */
// Un destino del presupuesto cuenta como ahorro si se marcó (o, por defecto, si se llama Ahorro/Inversión).
export const isSavingDest = d => d.saving ?? /ahorro|inversi/i.test(d.name || '');
export const budgetSavings = () => { const t = incomeTotal(); return S.money.dests.filter(isSavingDest).reduce((a, d) => a + amtOf(d, t), 0); };
export const monthSaved = key => +S.savings.months[key]?.saved || 0;

// Metas: el avance puede venir de un número manual, de tareas, de un hábito o del ahorro.
export function goalCurrent(g) {
  if (g.kind === 'tasks') return S.tasks.filter(t => t.goalId === g.id && t.done).length;
  if (g.kind === 'habit') {
    const hb = S.habits.find(x => x.id === g.habitId); if (!hb) return 0;
    return Object.keys(hb.log).filter(d => d.startsWith(g.period)).length;
  }
  if (g.kind === 'saving') return g.scope === 'mes' ? monthSaved(g.period) : yearSavings(g.period);
  return +g.current || 0;
}
export function goalTarget(g) {
  if (g.kind === 'tasks') return S.tasks.filter(t => t.goalId === g.id).length;
  return +g.target || 0;
}
export const goalProgress = g => (g.kind === 'check' ? (g.done ? 1 : 0) : goalTarget(g) ? Math.max(0, Math.min(1, goalCurrent(g) / goalTarget(g))) : 0);
export const goalDone = g => (g.kind === 'check' ? !!g.done : goalTarget(g) > 0 && goalCurrent(g) >= goalTarget(g));
export const goalsFor = (sc, p) => S.goals.filter(g => g.scope === sc && g.period === p);
export const goalById = id => S.goals.find(g => g.id === id);

/* ---------- contabilidad: movimientos (gastos e ingresos) ---------- */
// { id, type: 'gasto'|'ingreso', amount, what, cat, date: 'AAAA-MM-DD', fixed?, from?, created }
export const ledgerMonth = key => S.ledger.filter(m => m.date.startsWith(key));
export function monthTotals(key) {
  let inc = 0, exp = 0, toSaving = 0;
  const byCat = {};
  for (const m of ledgerMonth(key)) {
    if (m.type === 'ingreso') { inc += m.amount; continue; }
    exp += m.amount; byCat[m.cat || ''] = (byCat[m.cat || ''] || 0) + m.amount;
    const d = S.money.dests.find(x => x.id === m.cat);
    if (d && isSavingDest(d)) toSaving += m.amount;
  }
  // lo que de verdad se ahorró: lo que entró menos lo gastado (mandar plata a un destino de ahorro no es gasto)
  return { inc, exp, toSaving, spent: exp - toSaving, saved: inc - (exp - toSaving), byCat, count: ledgerMonth(key).length };
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
// adivina la categoría por lo que escribiste antes con el mismo motivo
export function guessCat(what, type) {
  const w = norm(what); if (!w) return null;
  const prev = S.ledger.slice().reverse().find(m => m.type === type && norm(m.what) === w && m.cat);
  if (prev) return prev.cat;
  const first = w.split(/\s+/)[0];
  const prev2 = first.length > 3 && S.ledger.slice().reverse().find(m => m.type === type && norm(m.what).split(/\s+/)[0] === first && m.cat);
  return prev2 ? prev2.cat : null;
}
// «5000 almuerzo», «12k uber», «almuerzo 4.500 #gustos» → { amount, what, cat }
export function parseMovement(text, type = 'gasto') {
  let t = ' ' + String(text) + ' ';
  let amount = 0;
  const mm = t.match(/[\s$](\d[\d.]*(?:,\d+)?)\s*(k|mil|lucas?)?(?=\s)/i);
  if (mm) {
    amount = parseFloat(mm[1].replace(/\./g, '').replace(',', '.')) || 0;
    if (mm[2]) amount *= 1000;
    t = t.replace(mm[0], ' ');
  }
  let cat = null;
  const tag = t.match(/#(\S+)/);
  if (tag) {
    const list = type === 'gasto' ? S.money.dests : S.money.incomes;
    const hit = list.find(x => norm(x.name).startsWith(norm(tag[1])));
    if (hit) cat = hit.id;
    t = t.replace(tag[0], ' ');
  }
  const what = t.replace(/\s+/g, ' ').trim();
  return { amount: Math.round(amount), what, cat: cat || guessCat(what, type) };
}
export function addMovement({ type, amount, what, cat = null, date, fixed = false, from }) {
  const m = { id: uid('m'), type, amount: Math.round(+amount || 0), what: (what || '').trim(), cat, date: date || today(), fixed, created: Date.now() };
  if (from) m.from = from;
  S.ledger.push(m); save(); return m;
}
export const catName = (m) => {
  const list = m.type === 'gasto' ? S.money.dests : S.money.incomes;
  return list.find(x => x.id === m.cat)?.name || 'Sin categoría';
};
export const catColor = (m) => (m.type === 'gasto' ? S.money.dests.find(x => x.id === m.cat)?.color : null) || (m.type === 'ingreso' ? '#30d158' : '#8e8e93');
