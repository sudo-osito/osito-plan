// Tareas con fecha y urgencia + rutina diaria (hábitos que se marcan día a día).
import { h, I, uid, today, addDays, weekStart, dayLabel, inlineEdit, DAYS_1, DAYS, toast } from '../ui.js';
import { S, save } from '../store.js';

/* ---------- lógica compartida con Inicio ---------- */
export function addTask(title, date = null, urgent = false) {
  const t = { id: uid('t'), title: title.trim(), date, urgent, done: false, created: Date.now() };
  S.tasks.push(t); save(); return t;
}
export const sortTasks = list => list.slice().sort((a, b) => (b.urgent - a.urgent) || ((a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : 0) || a.created - b.created);
export function toggleTask(t, done) { t.done = done; t.doneAt = done ? today() : null; save(); }
export const isLate = t => !t.done && t.date && t.date < today();

export function taskRow(t, { onChange, showDate = true } = {}) {
  const chk = h('input', { type: 'checkbox', class: 'chk' + (t.urgent ? ' urgent' : ''), checked: t.done, 'aria-label': 'Hecha' });
  const title = h('span', { class: 'tt' }, t.title);
  const dateIn = h('input', { type: 'date', value: t.date || '', tabindex: -1, 'aria-hidden': 'true' });
  const datePill = h('button', { class: 'pill btnish' + (isLate(t) ? ' late' : ''), title: 'Cambiar fecha' }, t.date ? dayLabel(t.date) : 'Sin fecha');
  const urg = h('button', { class: 'icon-btn' + (t.urgent ? ' on' : ''), title: t.urgent ? 'Quitar urgente' : 'Marcar urgente', html: `<span class="ic">${I.fire}</span>` });
  const del = h('button', { class: 'icon-btn danger', title: 'Eliminar', html: `<span class="ic">${I.trash}</span>` });
  const row = h('div', { class: 'trow' + (t.done ? ' done' : '') }, chk, title,
    showDate || isLate(t) || !t.date ? datePill : null, dateIn,
    h('span', { class: 'acts' }, urg, del));
  chk.addEventListener('change', () => { toggleTask(t, chk.checked); row.classList.toggle('done', chk.checked); setTimeout(onChange, chk.checked ? 380 : 0); });
  title.addEventListener('click', () => { if (t.done) return; inlineEdit(title, t.title, v => { if (v) { t.title = v; save(); } onChange(); }); });
  datePill.addEventListener('click', () => { try { dateIn.showPicker(); } catch (e) { dateIn.focus(); dateIn.click(); } });
  dateIn.addEventListener('change', () => { t.date = dateIn.value || null; save(); onChange(); });
  urg.addEventListener('click', () => { t.urgent = !t.urgent; save(); onChange(); });
  del.addEventListener('click', () => {
    const i = S.tasks.indexOf(t); S.tasks.splice(i, 1); save(); onChange();
    toast('Tarea eliminada');
  });
  return row;
}

/* ---------- hábitos ---------- */
export function habitStreak(hb) {
  // días seguidos marcados hacia atrás (si hoy todavía no se marca, se cuenta desde ayer)
  let d = today(), n = 0;
  if (!hb.log[d]) d = addDays(d, -1);
  while (hb.log[d]) { n++; d = addDays(d, -1); }
  return n;
}
export function toggleHabit(hb, day) { if (hb.log[day]) delete hb.log[day]; else hb.log[day] = true; save(); }

let showDone = false;

export default {
  render(root, { rerender }) {
    const t0 = today();
    root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Tareas'), h('span', { class: 'sub' }, 'Lo urgente arriba; lo de hoy, a la vista')));
    const main = h('div'), sideCol = h('div');
    root.append(h('div', { class: 'tgrid' }, main, sideCol));

    /* agregar */
    let when = 'hoy', custom = '', urgent = false;
    const input = h('input', { class: 'field big', placeholder: 'Nueva tarea…  (Enter para guardar)', 'aria-label': 'Nueva tarea' });
    const seg = h('div', { class: 'seg' });
    const custIn = h('input', { type: 'date', class: 'date-in', 'aria-label': 'Fecha', value: addDays(t0, 2) });
    const urgBtn = h('button', { class: 'toggle-urg', 'aria-pressed': 'false' }, h('span', { class: 'ic', html: I.fire }), 'Urgente');
    const opts = [['hoy', 'Hoy'], ['manana', 'Mañana'], ['fecha', 'Otra fecha'], ['nada', 'Sin fecha']];
    function paintSeg() {
      seg.replaceChildren(...opts.map(([k, l]) => h('button', { 'aria-pressed': when === k ? 'true' : 'false', onclick: () => { when = k; paintSeg(); if (k === 'fecha') { try { custIn.showPicker(); } catch (e) { custIn.focus(); } } input.focus(); } }, l)));
      custIn.style.display = when === 'fecha' ? '' : 'none';
    }
    paintSeg();
    urgBtn.addEventListener('click', () => { urgent = !urgent; urgBtn.setAttribute('aria-pressed', urgent); input.focus(); });
    const doAdd = () => {
      const v = input.value.trim(); if (!v) return;
      const date = when === 'hoy' ? t0 : when === 'manana' ? addDays(t0, 1) : when === 'fecha' ? (custIn.value || null) : null;
      addTask(v, date, urgent); input.value = ''; renderList(); input.focus();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    main.append(h('div', { class: 'card adder' }, input,
      h('div', { class: 'row' }, seg, custIn, urgBtn, h('span', { class: 'spacer' }), h('button', { class: 'btn primary sm', onclick: doAdd }, h('span', { class: 'ic', html: I.plus }), 'Agregar'))));

    /* lista agrupada */
    const list = h('div');
    main.append(list);
    function renderList() {
      list.innerHTML = '';
      const open = S.tasks.filter(t => !t.done);
      const end = addDays(weekStart(t0), 6);
      const groups = [
        ['Atrasadas', 'late', open.filter(t => t.date && t.date < t0)],
        ['Hoy', '', open.filter(t => t.date === t0)],
        ['Mañana', '', open.filter(t => t.date === addDays(t0, 1))],
        ['Esta semana', '', open.filter(t => t.date > addDays(t0, 1) && t.date <= end)],
        ['Más adelante', '', open.filter(t => t.date > end && t.date > addDays(t0, 1))],
        ['Sin fecha', '', open.filter(t => !t.date)],
      ];
      for (const [name, cls, items] of groups) {
        if (!items.length && name !== 'Hoy') continue;
        const card = h('div', { class: 'card tgroup ' + cls }, h('div', { class: 'card-h' }, h('h2', {}, name), h('span', { class: 'count' }, items.length || '')));
        if (!items.length) card.append(h('div', { class: 'card-b' }, h('div', { class: 'empty-note' }, 'Nada para hoy. Agrega algo arriba.')));
        for (const t of sortTasks(items)) card.append(taskRow(t, { onChange: renderList, showDate: name !== 'Hoy' && name !== 'Mañana' }));
        list.append(card);
      }
      const done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '') || b.created - a.created);
      if (done.length) {
        const card = h('div', { class: 'card tgroup' }, h('div', { class: 'card-h' }, h('h2', {}, 'Hechas'), h('span', { class: 'count' }, done.length),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: () => { if (!confirm(`¿Borrar las ${done.length} tareas hechas?`)) return; S.tasks = S.tasks.filter(t => !t.done); save(); renderList(); } }, 'Vaciar')));
        if (showDone) for (const t of done.slice(0, 60)) card.append(taskRow(t, { onChange: renderList }));
        card.append(h('button', { class: 'more', onclick: () => { showDone = !showDone; renderList(); } }, showDone ? 'Ocultar' : `Ver las ${done.length} hechas`));
        list.append(card);
      }
    }
    renderList();

    /* rutina diaria */
    const ws = weekStart(t0), days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const hbox = h('div');
    const hin = h('input', { class: 'field', placeholder: 'Nuevo hábito (leer, entrenar, agua…)', 'aria-label': 'Nuevo hábito' });
    hin.addEventListener('keydown', e => { if (e.key === 'Enter' && hin.value.trim()) { S.habits.push({ id: uid('r'), title: hin.value.trim(), log: {}, created: Date.now() }); hin.value = ''; save(); renderHabits(); } });
    sideCol.append(h('div', { class: 'card habits' },
      h('div', { class: 'card-h' }, h('h2', {}, 'Rutina diaria'), h('span', { class: 'meta' }, 'esta semana')),
      h('div', { class: 'hh head' }, h('span'), ...days.map((d, i) => h('span', { class: d === t0 ? 'today' : '', title: DAYS[i] }, DAYS_1[i])), h('span', { style: { textAlign: 'right' } }, 'racha')),
      hbox,
      h('div', { class: 'card-b', style: { paddingTop: '10px' } }, hin)));
    function renderHabits() {
      hbox.innerHTML = '';
      if (!S.habits.length) hbox.append(h('div', { class: 'card-b' }, h('div', { class: 'empty-note' }, 'Lo que quieres hacer todos los días. Se marca con un toque y lleva la racha.')));
      for (const hb of S.habits) {
        const nm = h('span', { class: 'hname', title: 'Clic para renombrar' }, hb.title);
        nm.addEventListener('click', () => inlineEdit(nm, hb.title, v => { if (v) { hb.title = v; save(); } renderHabits(); }));
        const st = habitStreak(hb);
        hbox.append(h('div', { class: 'hh hrow' }, nm,
          ...days.map((d, i) => h('button', { class: 'hdot' + (hb.log[d] ? ' on' : '') + (d > t0 ? ' future' : '') + (d === t0 ? ' today' : ''), title: `${DAYS[i]}${d === t0 ? ' (hoy)' : ''}`, 'aria-pressed': hb.log[d] ? 'true' : 'false', onclick: () => { toggleHabit(hb, d); renderHabits(); } })),
          h('span', { class: 'streak' + (st >= 3 ? ' hot' : '') }, st ? `${st} d` : '–'),
          h('button', { class: 'icon-btn danger', title: 'Eliminar hábito', html: `<span class="ic">${I.x}</span>`, onclick: () => { if (!confirm(`¿Eliminar «${hb.title}» y su historial?`)) return; S.habits = S.habits.filter(x => x !== hb); save(); renderHabits(); } })));
      }
    }
    renderHabits();
    if (matchMedia('(hover: hover)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true }));
  },
};
