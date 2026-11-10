// Estado de la app. Todo vive en el navegador (localStorage); nada sale a internet.
import { uid, today } from './ui.js';

const KEY = 'organizador.v1';
export const SLOTS = 48;   // bloques de 30 min por día

export const PALETTE = ['#5e5ce6', '#2a6cf0', '#ff9f0a', '#30b158', '#e5b400', '#8e8e93', '#ff5d8f', '#14b8a6', '#bf5af2', '#ff453a', '#64d2ff', '#a2845e'];
export const DEFAULT_CATS = [
  { id: 'dormir', name: 'Dormir', color: '#5e5ce6' },
  { id: 'trabajo', name: 'Trabajo', color: '#2a6cf0' },
  { id: 'hobby', name: 'Hobby', color: '#ff9f0a' },
  { id: 'ejercicio', name: 'Ejercicio', color: '#30b158' },
  { id: 'comida', name: 'Comida', color: '#e5b400' },
  { id: 'traslado', name: 'Traslado', color: '#8e8e93' },
  { id: 'social', name: 'Familia y amigos', color: '#ff5d8f' },
  { id: 'personal', name: 'Personal', color: '#14b8a6' },
];
const DEFAULT_MONEY = () => ({
  incomes: [{ id: 'i1', name: 'Sueldo', amount: 0 }],
  dests: [
    { id: 'd1', name: 'Gastos fijos', pct: 0, color: '#2a6cf0' },
    { id: 'd2', name: 'Ahorro', pct: 0, color: '#30b158' },
    { id: 'd3', name: 'Inversión', pct: 0, color: '#14b8a6' },
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
  return { app: 'organizador', v: 1, schedules: { active: sch.id, list: [sch] }, money: DEFAULT_MONEY(), savings: { goals: {}, months: {} }, tasks: [], habits: [], goals: [], notes: [], ui: {} };
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
  for (const k of ['tasks', 'habits', 'goals', 'notes']) if (!Array.isArray(o[k])) o[k] = [];
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
