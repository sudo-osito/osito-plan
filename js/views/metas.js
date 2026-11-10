// Metas del mes y del año: de cumplir (sí/no) o con número (avance hacia un objetivo).
import { h, I, uid, fmt, clp, today, monthKey, monthName, shiftMonth, inlineEdit, toast } from '../ui.js';
import { S, save, yearSavings } from '../store.js';

let scope = 'mes';
let period = { mes: null, año: null };

export const goalProgress = g => (g.kind === 'num' ? (g.target ? Math.max(0, Math.min(1, (+g.current || 0) / g.target)) : 0) : g.done ? 1 : 0);
export const goalDone = g => (g.kind === 'num' ? g.target > 0 && (+g.current || 0) >= g.target : !!g.done);
export const goalsFor = (sc, p) => S.goals.filter(g => g.scope === sc && g.period === p);
const numFmt = (n, unit) => (unit === '$' ? clp(n) : `${fmt(n, 2)}${unit ? ' ' + unit : ''}`);

export default {
  render(root, { rerender }) {
    period.mes ??= monthKey(today());
    period.año ??= today().slice(0, 4);
    const p = period[scope];
    const label = scope === 'mes' ? monthName(p) : `Año ${p}`;
    const prev = scope === 'mes' ? shiftMonth(p, -1) : String(+p - 1);
    const move = n => { period[scope] = scope === 'mes' ? shiftMonth(p, n) : String(+p + n); rerender(); };

    root.append(h('div', { class: 'page-head' },
      h('h1', {}, 'Metas'),
      h('div', { class: 'seg' }, ...[['mes', 'Del mes'], ['año', 'Del año']].map(([k, l]) => h('button', { 'aria-pressed': scope === k ? 'true' : 'false', onclick: () => { scope = k; rerender(); } }, l))),
      h('span', { class: 'spacer' }),
      h('span', { class: 'period' },
        h('button', { class: 'icon-btn', 'aria-label': 'Anterior', html: `<span class="ic">${I.left}</span>`, onclick: () => move(-1) }),
        h('span', { class: 'lbl' }, label),
        h('button', { class: 'icon-btn', 'aria-label': 'Siguiente', html: `<span class="ic">${I.right}</span>`, onclick: () => move(1) }))));

    const list = goalsFor(scope, p);
    const done = list.filter(goalDone).length;
    const avg = list.length ? list.reduce((a, g) => a + goalProgress(g), 0) / list.length : 0;
    if (list.length) root.append(h('div', { class: 'card goal-sum' },
      h('div', {}, h('div', { class: 'big' }, `${done} de ${list.length}`), h('div', { class: 'hint' }, done === list.length ? '¡Todas cumplidas!' : 'metas cumplidas')),
      h('div', { class: 'pbar' + (avg >= 1 ? ' done' : '') }, h('i', { style: { width: avg * 100 + '%' } })),
      h('b', {}, `${fmt(avg * 100, 0)}%`)));

    // traer las pendientes del período anterior
    const pending = goalsFor(scope, prev).filter(g => !goalDone(g) && !list.some(x => x.from === g.id));
    if (pending.length) root.append(h('div', { style: { marginBottom: '16px' } },
      h('button', { class: 'btn sm', onclick: () => {
        for (const g of pending) S.goals.push({ ...g, id: uid('g'), period: p, from: g.id, created: Date.now(), done: false });
        save(); toast(`${pending.length} meta${pending.length === 1 ? '' : 's'} traída${pending.length === 1 ? '' : 's'}`); rerender();
      } }, h('span', { class: 'ic', html: I.down }), `Traer ${pending.length} pendiente${pending.length === 1 ? '' : 's'} de ${scope === 'mes' ? monthName(prev) : prev}`)));

    const grid = h('div', { class: 'ggrid' });
    root.append(grid);

    // meta automática: ahorro del año (sale de Dinero)
    if (scope === 'año' && S.savings.goals[p]) {
      const goal = +S.savings.goals[p], sav = yearSavings(p), pr = Math.min(1, sav / goal);
      grid.append(h('a', { class: 'card goal auto' + (pr >= 1 ? ' done' : ''), href: '#/dinero', style: { textDecoration: 'none' } },
        h('div', { class: 'gt' }, h('span', { class: 'title' }, `Ahorrar ${clp(goal)}`), h('span', { class: 'pill' }, 'desde Dinero')),
        h('div', { class: 'pbar' + (pr >= 1 ? ' done' : '') }, h('i', { style: { width: pr * 100 + '%' } })),
        h('div', { class: 'gnum' }, h('span', { class: 'of' }, h('b', {}, clp(sav)), ` de ${clp(goal)}`), h('span', { class: 'pct' }, `${fmt(pr * 100, 0)}%`))));
    }

    for (const g of list.slice().sort((a, b) => goalDone(a) - goalDone(b) || a.created - b.created)) grid.append(goalCard(g, rerender));
    grid.append(newGoalCard(p, rerender));
  },
};

function goalCard(g, rerender) {
  const isDone = goalDone(g), pr = goalProgress(g);
  const title = h('span', { class: 'title' }, g.title);
  title.addEventListener('click', () => inlineEdit(title, g.title, v => { if (v) { g.title = v; save(); } rerender(); }));
  const card = h('div', { class: 'card goal' + (isDone ? ' done' : '') });
  const acts = h('span', { class: 'acts' }, h('button', { class: 'icon-btn danger', title: 'Eliminar meta', html: `<span class="ic">${I.trash}</span>`, onclick: () => { if (!confirm(`¿Eliminar «${g.title}»?`)) return; S.goals = S.goals.filter(x => x !== g); save(); rerender(); } }));
  if (g.kind === 'num') {
    const cur = h('input', { class: 'cur', inputmode: 'decimal', value: fmt(+g.current || 0, 2), 'aria-label': 'Avance' });
    const pbar = h('i', { style: { width: pr * 100 + '%' } }), pct = h('span', { class: 'pct' }, `${fmt(pr * 100, 0)}%`);
    const set = v => { g.current = Math.max(0, v); save(); const q = goalProgress(g); pbar.style.width = q * 100 + '%'; pct.textContent = `${fmt(q * 100, 0)}%`; card.classList.toggle('done', goalDone(g)); pbar.parentElement.classList.toggle('done', goalDone(g)); };
    cur.addEventListener('focus', () => cur.select());
    cur.addEventListener('input', () => set(parseFloat(cur.value.replace(/\./g, '').replace(',', '.')) || 0));
    cur.addEventListener('blur', () => rerender());
    const step = g.step || 1;
    const bump = n => { set((+g.current || 0) + n); rerender(); };
    card.append(
      h('div', { class: 'gt' }, title),
      h('div', { class: 'pbar' + (isDone ? ' done' : '') }, pbar),
      h('div', { class: 'gnum' },
        h('button', { class: 'icon-btn', title: `−${step}`, onclick: () => bump(-step) }, '−'),
        cur,
        h('button', { class: 'icon-btn', title: `+${step}`, onclick: () => bump(step) }, '+'),
        h('span', { class: 'of' }, 'de ', h('b', {}, numFmt(g.target, g.unit))),
        pct),
      acts);
  } else {
    const chk = h('input', { type: 'checkbox', class: 'chk', checked: !!g.done, 'aria-label': 'Cumplida' });
    chk.addEventListener('change', () => { g.done = chk.checked; save(); if (chk.checked) toast('¡Meta cumplida!'); rerender(); });
    card.append(h('div', { class: 'gt' }, chk, title), h('div', { class: 'pbar' + (isDone ? ' done' : '') }, h('i', { style: { width: pr * 100 + '%' } })), acts);
  }
  return card;
}

function newGoalCard(p, rerender) {
  let kind = 'check';
  const title = h('input', { class: 'field', placeholder: scope === 'mes' ? 'Nueva meta del mes…' : 'Nueva meta del año…', 'aria-label': 'Meta' });
  const target = h('input', { class: 'field', inputmode: 'decimal', placeholder: 'Objetivo (ej. 12)', style: { maxWidth: '150px' }, 'aria-label': 'Objetivo' });
  const unit = h('input', { class: 'field', placeholder: 'Unidad (km, libros, $)', style: { maxWidth: '170px' }, 'aria-label': 'Unidad' });
  const numRow = h('div', { class: 'row', style: { display: 'none' } }, target, unit);
  const seg = h('div', { class: 'seg' });
  const paint = () => {
    seg.replaceChildren(...[['check', 'Cumplir'], ['num', 'Con número']].map(([k, l]) => h('button', { 'aria-pressed': kind === k ? 'true' : 'false', onclick: () => { kind = k; paint(); } }, l)));
    numRow.style.display = kind === 'num' ? '' : 'none';
  };
  paint();
  const add = () => {
    const t = title.value.trim(); if (!t) { title.focus(); return; }
    const g = { id: uid('g'), title: t, scope, period: p, kind, done: false, created: Date.now() };
    if (kind === 'num') {
      g.target = parseFloat(target.value.replace(/\./g, '').replace(',', '.')) || 0;
      if (!g.target) { target.focus(); return; }
      g.unit = unit.value.trim(); g.current = 0;
      g.step = g.unit === '$' ? Math.max(1, Math.round(g.target / 20)) : g.target >= 100 ? Math.round(g.target / 20) : 1;
    }
    S.goals.push(g); save(); rerender();
  };
  for (const el of [title, target, unit]) el.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'card goal-new' }, title, h('div', { class: 'row' }, seg, h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: add }, h('span', { class: 'ic', html: I.plus }), 'Agregar')), numRow);
}
