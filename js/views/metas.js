// Metas del mes y del año. El avance puede ser manual o venir solo de otra sección:
// tareas (las que cuelgan de la meta), un hábito de la rutina (días marcados) o el ahorro anotado en Dinero.
import { h, I, uid, fmt, clp, digits, today, monthKey, monthName, shiftMonth, inlineEdit, toast, moneyField } from '../ui.js';
import { S, save, goalsFor, goalProgress, goalDone, goalCurrent, goalTarget } from '../store.js';
import { taskRow, addTask } from './tareas.js';

let scope = 'mes';
const period = { mes: null, año: null };
const KINDS = [['check', 'Cumplir'], ['num', 'Número'], ['tasks', 'Tareas'], ['habit', 'Hábito'], ['saving', 'Ahorro']];
const KIND_HINT = {
  check: 'Se marca cuando la cumples.',
  num: 'Avanzas con + y − hasta llegar al objetivo.',
  tasks: 'Divide la meta en tareas; avanza sola al completarlas (también aparecen en Tareas).',
  habit: 'Cuenta los días que marcas un hábito de tu rutina diaria.',
  saving: 'Sigue lo que anotas como ahorrado en Dinero.',
};
const numFmt = (n, unit) => (unit === '$' ? clp(n) : `${fmt(n, 2)}${unit ? ' ' + unit : ''}`);
const daysIn = p => (p.length === 7 ? new Date(+p.slice(0, 4), +p.slice(5, 7), 0).getDate() : 365);

export { goalsFor, goalProgress, goalDone };

export default {
  render(root, { rerender, go }) {
    period.mes ??= monthKey(today());
    period.año ??= today().slice(0, 4);
    const p = period[scope];
    const label = scope === 'mes' ? monthName(p) : `Año ${p}`;
    const prev = scope === 'mes' ? shiftMonth(p, -1) : String(+p - 1);
    const move = n => { period[scope] = scope === 'mes' ? shiftMonth(p, n) : String(+p + n); rerender(); };
    const isNow = p === (scope === 'mes' ? monthKey(today()) : today().slice(0, 4));

    root.append(h('div', { class: 'page-head' },
      h('h1', {}, 'Metas'),
      h('div', { class: 'seg' }, ...[['mes', 'Del mes'], ['año', 'Del año']].map(([k, l]) => h('button', { 'aria-pressed': scope === k ? 'true' : 'false', onclick: () => { scope = k; rerender(); } }, l))),
      h('span', { class: 'spacer' }),
      h('span', { class: 'period' },
        h('button', { class: 'icon-btn', 'aria-label': 'Anterior', html: `<span class="ic">${I.left}</span>`, onclick: () => move(-1) }),
        h('span', { class: 'lbl' }, label),
        h('button', { class: 'icon-btn', 'aria-label': 'Siguiente', html: `<span class="ic">${I.right}</span>`, onclick: () => move(1) }),
        !isNow ? h('button', { class: 'btn sm', onclick: () => { period[scope] = scope === 'mes' ? monthKey(today()) : today().slice(0, 4); rerender(); } }, 'Hoy') : null)));

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
        for (const g of pending) {
          const n = { ...g, id: uid('g'), period: p, from: g.id, created: Date.now(), done: false };
          S.goals.push(n);
          if (g.kind === 'tasks') for (const t of S.tasks.filter(t => t.goalId === g.id && !t.done)) t.goalId = n.id;   // las tareas pendientes se van con la meta
        }
        save(); toast(`${pending.length} meta${pending.length === 1 ? '' : 's'} traída${pending.length === 1 ? '' : 's'}`); rerender();
      } }, h('span', { class: 'ic', html: I.down }), `Traer ${pending.length} pendiente${pending.length === 1 ? '' : 's'} de ${scope === 'mes' ? monthName(prev) : prev}`)));

    const grid = h('div', { class: 'ggrid' });
    root.append(grid);

    // la meta de ahorro anual de Dinero aparece sola en el año
    if (scope === 'año' && +S.savings.goals[p] && !list.some(g => g.kind === 'saving')) {
      const fake = { kind: 'saving', scope: 'año', period: p, target: +S.savings.goals[p] };
      const pr = goalProgress(fake);
      grid.append(h('a', { class: 'card goal auto' + (pr >= 1 ? ' done' : ''), href: '#/dinero', style: { textDecoration: 'none' } },
        h('div', { class: 'gt' }, h('span', { class: 'title' }, `Ahorrar ${clp(fake.target)}`), h('span', { class: 'pill' }, 'desde Dinero')),
        h('div', { class: 'pbar' + (pr >= 1 ? ' done' : '') }, h('i', { style: { width: pr * 100 + '%' } })),
        h('div', { class: 'gnum' }, h('span', { class: 'of' }, h('b', {}, clp(goalCurrent(fake))), ` de ${clp(fake.target)}`), h('span', { class: 'pct' }, `${fmt(pr * 100, 0)}%`))));
    }

    grid.prepend(newGoalCard(p, rerender));
    for (const g of list.slice().sort((a, b) => goalDone(a) - goalDone(b) || a.created - b.created)) grid.append(goalCard(g, rerender, go));
  },
};

function goalCard(g, rerender, go) {
  const isDone = goalDone(g), pr = goalProgress(g);
  const title = h('span', { class: 'title' }, g.title);
  title.addEventListener('click', () => inlineEdit(title, g.title, v => { if (v) { g.title = v; save(); } rerender(); }));
  const card = h('div', { class: 'card goal' + (isDone ? ' done' : '') });
  const kindPill = { tasks: 'tareas', habit: 'hábito', saving: 'ahorro' }[g.kind];
  const acts = h('span', { class: 'acts' }, h('button', { class: 'icon-btn danger', title: 'Eliminar meta', html: `<span class="ic">${I.trash}</span>`, onclick: () => {
    if (!confirm(`¿Eliminar «${g.title}»?`)) return;
    S.goals = S.goals.filter(x => x !== g);
    for (const t of S.tasks) if (t.goalId === g.id) delete t.goalId;   // las tareas se quedan, sin meta
    save(); rerender();
  } }));
  const bar = h('div', { class: 'pbar' + (isDone ? ' done' : '') }, h('i', { style: { width: pr * 100 + '%' } }));
  const head = h('div', { class: 'gt' }, title, kindPill ? h('span', { class: 'pill' }, kindPill) : null);
  const pctEl = h('span', { class: 'pct' }, `${fmt(pr * 100, 0)}%`);

  if (g.kind === 'check') {
    const chk = h('input', { type: 'checkbox', class: 'chk', checked: !!g.done, 'aria-label': 'Cumplida' });
    chk.addEventListener('change', () => { g.done = chk.checked; save(); if (chk.checked) toast('¡Meta cumplida!'); rerender(); });
    head.prepend(chk);
    card.append(head, bar, acts);
  } else if (g.kind === 'num') {
    const cur = h('input', { class: 'cur', inputmode: 'decimal', value: fmt(+g.current || 0, 2), 'aria-label': 'Avance' });
    cur.addEventListener('focus', () => cur.select());
    cur.addEventListener('keydown', e => { if (e.key === 'Enter') cur.blur(); });
    cur.addEventListener('change', () => { g.current = Math.max(0, parseFloat(cur.value.replace(/\./g, '').replace(',', '.')) || 0); save(); rerender(); });
    const step = g.step || 1;
    const bump = n => { g.current = Math.max(0, (+g.current || 0) + n); save(); if (goalDone(g) && !isDone) toast('¡Meta cumplida!'); rerender(); };
    card.append(head, bar,
      h('div', { class: 'gnum' },
        h('button', { class: 'icon-btn', title: `−${step}`, onclick: () => bump(-step) }, '−'), cur,
        h('button', { class: 'icon-btn', title: `+${step}`, onclick: () => bump(step) }, '+'),
        h('span', { class: 'of' }, 'de ', h('b', {}, numFmt(g.target, g.unit))), pctEl), acts);
  } else if (g.kind === 'tasks') {
    const tasks = S.tasks.filter(t => t.goalId === g.id).sort((a, b) => a.done - b.done || a.created - b.created);
    const list = h('div', { class: 'gtasks' }, ...tasks.map(t => taskRow(t, { onChange: rerender, showDate: !!t.date, inGoal: true })));
    const add = h('input', { class: 'field', placeholder: 'Agregar un paso…', 'aria-label': 'Nueva tarea de la meta' });
    add.addEventListener('keydown', e => { if (e.key === 'Enter' && add.value.trim()) { const t = addTask(add.value, null, false); t.goalId = g.id; save(); rerender(); } });
    card.append(head, bar,
      h('div', { class: 'gnum' }, h('span', { class: 'of' }, h('b', {}, `${goalCurrent(g)} de ${goalTarget(g)}`), ' tareas hechas'), pctEl),
      list, add, acts);
  } else if (g.kind === 'habit') {
    const hb = S.habits.find(x => x.id === g.habitId);
    card.append(head, bar,
      h('div', { class: 'gnum' }, hb ? h('span', { class: 'of' }, h('b', {}, `${goalCurrent(g)} de ${g.target}`), ` días de «${hb.title}»`) : h('span', { class: 'of' }, 'El hábito ya no existe'), pctEl),
      h('a', { class: 'glink', href: '#/tareas' }, 'Marcar en la rutina diaria →'), acts);
  } else if (g.kind === 'saving') {
    card.append(head, bar,
      h('div', { class: 'gnum' }, h('span', { class: 'of' }, h('b', {}, clp(goalCurrent(g))), ` de ${clp(g.target)}`), pctEl),
      h('a', { class: 'glink', href: '#/dinero' }, g.scope === 'mes' ? 'Anotar el ahorro del mes en Dinero →' : 'Ver el ahorro del año en Dinero →'), acts);
  }
  return card;
}

function newGoalCard(p, rerender) {
  let kind = 'check', savingTarget = 0;
  const title = h('input', { class: 'field', placeholder: scope === 'mes' ? 'Nueva meta del mes…' : 'Nueva meta del año…', 'aria-label': 'Meta' });
  const target = h('input', { class: 'field', inputmode: 'decimal', placeholder: 'Objetivo (ej. 12)', 'aria-label': 'Objetivo' });
  const unit = h('input', { class: 'field', placeholder: 'Unidad (km, libros…)', 'aria-label': 'Unidad' });
  const habitSel = h('select', { class: 'field', 'aria-label': 'Hábito' });
  const days = h('input', { class: 'field', inputmode: 'numeric', 'aria-label': 'Días', value: scope === 'mes' ? Math.min(20, daysIn(p)) : 200 });
  const money = moneyField(() => savingTarget, v => { savingTarget = v; }, { class: 'field amt', placeholder: 'Monto a ahorrar' });
  const extra = h('div', { class: 'row' });
  const hint = h('div', { class: 'hint' });
  const seg = h('div', { class: 'seg seg-wrap' });
  const paint = () => {
    seg.replaceChildren(...KINDS.map(([k, l]) => h('button', { 'aria-pressed': kind === k ? 'true' : 'false', onclick: () => { kind = k; paint(); title.focus(); } }, l)));
    hint.textContent = KIND_HINT[kind];
    extra.replaceChildren();
    if (kind === 'num') extra.append(target, unit);
    if (kind === 'habit') {
      habitSel.replaceChildren(...(S.habits.length ? S.habits.map(hb => h('option', { value: hb.id }, hb.title)) : [h('option', { value: '' }, 'Primero crea un hábito en Tareas')]));
      extra.append(habitSel, h('span', { class: 'hint' }, 'días:'), days);
    }
    if (kind === 'saving') extra.append(money);
    extra.style.display = extra.childElementCount ? '' : 'none';
  };
  paint();
  const add = () => {
    const t = title.value.trim(); if (!t) { title.focus(); return; }
    const g = { id: uid('g'), title: t, scope, period: p, kind, done: false, created: Date.now() };
    if (kind === 'num') {
      g.target = parseFloat(target.value.replace(/\./g, '').replace(',', '.')) || 0;
      if (!g.target) { target.focus(); return; }
      g.unit = unit.value.trim(); g.current = 0;
      g.step = g.target >= 100 ? Math.round(g.target / 20) : 1;
    }
    if (kind === 'habit') { g.habitId = habitSel.value; g.target = digits(days.value) || 1; if (!g.habitId) { location.hash = '#/tareas'; return; } }
    if (kind === 'saving') { g.target = savingTarget; if (!g.target) { money.focus(); return; } }
    S.goals.push(g); save(); rerender();
  };
  for (const el of [title, target, unit, days, money]) el.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'card goal-new' },
    h('div', { class: 'row' }, title, seg, h('button', { class: 'btn primary', onclick: add }, h('span', { class: 'ic', html: I.plus }), 'Agregar')),
    h('div', { class: 'row' }, extra, hint));
}
