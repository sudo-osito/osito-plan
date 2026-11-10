// Inicio: todo lo de hoy en una pantalla (ahora, urgente, tareas, rutina, metas, dinero, semana y notas).
import { h, I, fmt, clp, today, monthKey, monthName, longDate, slotTime, ampm } from '../ui.js';
import { S, SLOTS, activeSchedule, scheduleCounts, incomeTotal, pctTotal, yearSavings } from '../store.js';
import { addTask, taskRow, sortTasks, habitStreak, toggleHabit, isLate } from './tareas.js';
import { goalsFor, goalProgress, goalDone } from './metas.js';
import { recentNotes, openEditor, newNote } from './notas.js';
import { backupBlock } from '../backup.js';

const hrs = n => fmt(n / 2) + ' h';

export default {
  render(root, { rerender }) {
    const t0 = today(), now = new Date();
    const hr = now.getHours();
    const greet = hr < 6 ? 'Buenas noches' : hr < 12 ? 'Buenos días' : hr < 20 ? 'Buenas tardes' : 'Buenas noches';
    root.append(h('div', { class: 'hello' }, h('h1', {}, greet), h('div', { class: 'date' }, longDate(now).replace(/^./, c => c.toUpperCase()))));
    const dash = h('div', { class: 'dash' });
    root.append(dash);

    const card = (cls, title, link, ...body) => h('section', { class: `card ${cls}` },
      h('div', { class: 'card-h' }, h('h2', {}, title), link ? h('a', { class: 'meta', href: `#/${link[0]}` }, link[1]) : null),
      h('div', { class: 'card-b' }, ...body));

    /* ---------- ahora (horario activo) ---------- */
    const sch = activeSchedule(), d = (now.getDay() + 6) % 7, m = hr * 60 + now.getMinutes(), s = Math.floor(m / 30);
    const col = sch.grid[d], cat = id => sch.cats.find(c => c.id === id);
    const cur = cat(col[s]);
    let end = s; while (end < SLOTS && col[end] === col[s]) end++;
    let nx = end; while (nx < SLOTS && !cat(col[nx])) nx++;
    const next = nx < SLOTS ? cat(col[nx]) : null;
    const strip = h('div', { class: 'daystrip', title: `Hoy en «${sch.name}»` },
      ...col.map((v, i) => h('i', { style: { background: cat(v)?.color || 'transparent' }, title: cat(v) ? `${cat(v).name} · ${slotTime(i)}` : slotTime(i) })),
      h('span', { class: 'mark-now', style: { left: `${m / 1440 * 100}%` } }));
    dash.append(h('section', { class: 'card c-now' },
      h('div', { class: 'card-h' }, h('h2', {}, 'Ahora'), h('a', { class: 'meta', href: '#/horario' }, `${sch.name} →`)),
      h('div', { class: 'now-big' },
        h('div', {}, h('div', { class: 'cap' }, `Son las ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`),
          h('div', { class: 'v' }, cur ? h('b', { style: { background: cur.color } }) : null, cur ? cur.name : 'Libre'),
          h('div', { class: 'd' }, cur ? `hasta las ${slotTime(end)}` : next ? `hasta las ${slotTime(nx)}` : 'el resto del día')),
        next ? h('div', { class: 'next' }, h('div', { class: 'cap' }, 'Después'), h('div', { class: 'v' }, h('b', { style: { background: next.color } }), next.name), h('div', { class: 'd' }, `a las ${slotTime(nx)}`)) : null),
      strip,
      h('div', { class: 'daystrip-l' }, ...[0, 6, 12, 18, 24].map(x => h('span', {}, x === 24 ? '12 AM' : ampm(x))))));

    /* ---------- urgente + atrasado ---------- */
    const urgList = h('div', { class: 'mini-list' });
    const paintUrg = () => {
      const items = sortTasks(S.tasks.filter(t => !t.done && (t.urgent || isLate(t))));
      urgList.replaceChildren(...(items.length ? items.slice(0, 7).map(t => taskRow(t, { onChange: () => { paintUrg(); paintToday(); } })) : [h('div', { class: 'empty-note' }, 'Nada urgente ni atrasado. Bien ahí.')]));
    };
    dash.append(card('c-urg', 'Urgente y atrasado', ['tareas', 'Tareas →'], urgList));

    /* ---------- hoy ---------- */
    const todayList = h('div', { class: 'mini-list' });
    const qa = h('input', { class: 'field', placeholder: 'Agregar tarea para hoy…', 'aria-label': 'Tarea para hoy' });
    qa.addEventListener('keydown', e => { if (e.key === 'Enter' && qa.value.trim()) { addTask(qa.value, t0, false); qa.value = ''; paintToday(); } });
    const paintToday = () => {
      const items = sortTasks(S.tasks.filter(t => t.date === t0 && (!t.done || t.doneAt === t0)));
      const done = items.filter(t => t.done).length;
      todayList.replaceChildren(...(items.length ? items.map(t => taskRow(t, { onChange: () => { paintToday(); paintUrg(); }, showDate: false })) : [h('div', { class: 'empty-note' }, 'Sin tareas para hoy.')]));
      todayMeta.textContent = items.length ? `${done} de ${items.length}` : '';
    };
    const todayMeta = h('span', { class: 'meta' });
    dash.append(h('section', { class: 'card c-today' }, h('div', { class: 'card-h' }, h('h2', {}, 'Hoy'), todayMeta), h('div', { class: 'card-b' }, h('div', { class: 'quick' }, qa), todayList)));

    /* ---------- rutina de hoy ---------- */
    const hbList = h('div', { class: 'mini-list' });
    const paintHabits = () => {
      hbList.replaceChildren(...(S.habits.length ? S.habits.map(hb => {
        const chk = h('input', { type: 'checkbox', class: 'chk', checked: !!hb.log[t0], 'aria-label': hb.title });
        chk.addEventListener('change', () => { toggleHabit(hb, t0); paintHabits(); });
        const st = habitStreak(hb);
        return h('label', { class: 'trow', style: { paddingLeft: 0, paddingRight: 0, cursor: 'pointer' } }, chk, h('span', { class: 'tt', style: { cursor: 'pointer' } }, hb.title), h('span', { class: 'streak' + (st >= 3 ? ' hot' : '') }, st ? `${st} d` : ''));
      }) : [h('div', { class: 'empty-note' }, 'Crea tus hábitos en Tareas → Rutina diaria.')]));
    };
    dash.append(card('c-habit', 'Rutina de hoy', ['tareas', 'Editar →'], hbList));

    /* ---------- metas del mes ---------- */
    const mk = monthKey(t0), goals = goalsFor('mes', mk);
    const gdone = goals.filter(goalDone).length;
    dash.append(card('c-goals', `Metas de ${monthName(mk).split(' ')[0]}`, ['metas', goals.length ? `${gdone} de ${goals.length} →` : 'Metas →'],
      goals.length ? h('div', { class: 'mini-list' }, ...goals.slice().sort((a, b) => goalDone(a) - goalDone(b)).slice(0, 5).map(g => h('div', { class: 'mini-goal' },
        h('div', { class: 't' }, h('span', {}, g.title), h('span', {}, `${fmt(goalProgress(g) * 100, 0)}%`)),
        h('div', { class: 'pbar' + (goalDone(g) ? ' done' : '') }, h('i', { style: { width: goalProgress(g) * 100 + '%' } })))))
        : h('div', { class: 'empty-note' }, 'Sin metas este mes. Defínelas en Metas.')));

    /* ---------- dinero ---------- */
    const inc = incomeTotal(), left = 100 - pctTotal(), y = t0.slice(0, 4), ys = yearSavings(y), yg = +S.savings.goals[y] || 0;
    dash.append(card('c-money', 'Dinero', ['dinero', 'Dinero →'],
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' }, h('div', { class: 'l' }, 'Entra al mes'), h('div', { class: 'v' }, inc ? clp(inc) : '–'), h('div', { class: 'd' }, inc ? (Math.abs(left) < 0.01 ? 'todo repartido' : left > 0 ? `${clp(inc * left / 100)} sin repartir` : `te pasas ${clp(inc * -left / 100)}`) : 'arma tu presupuesto')),
        h('div', { class: 'stat' }, h('div', { class: 'l' }, `Ahorro ${y}`), h('div', { class: 'v' }, clp(ys)), h('div', { class: 'd' }, yg ? `${fmt(Math.min(100, ys / yg * 100), 0)}% de ${clp(yg)}` : 'sin meta del año'))),
      yg ? h('div', { class: 'pbar' + (ys >= yg ? ' done' : ''), style: { marginTop: '12px' } }, h('i', { style: { width: Math.min(100, ys / yg * 100) + '%' } })) : null));

    /* ---------- semana ---------- */
    const { per } = scheduleCounts(sch);
    const sleep = sch.cats.find(c => c.id === 'dormir'), work = sch.cats.find(c => c.id === 'trabajo');
    const sl = sleep ? (per[sleep.id] || 0) / 2 / 7 : 0, wk = work ? (per[work.id] || 0) / 2 : 0;
    const top = sch.cats.filter(c => per[c.id]).sort((a, b) => per[b.id] - per[a.id]).slice(0, 5);
    dash.append(card('c-week', 'Tu semana', ['horario', 'Horario →'],
      h('div', { class: 'stat-row' },
        h('div', { class: 'stat' + (sl && sl < 7 ? ' warn' : '') }, h('div', { class: 'l' }, 'Sueño por día'), h('div', { class: 'v' }, sl ? fmt(sl) : '–', h('small', {}, 'h'))),
        h('div', { class: 'stat' }, h('div', { class: 'l' }, 'Trabajo'), h('div', { class: 'v' }, wk ? fmt(wk) : '–', h('small', {}, 'h/sem')))),
      top.length ? h('div', { class: 'bigbar', style: { marginTop: '12px', height: '10px' } }, ...top.map(c => h('i', { style: { width: per[c.id] / (7 * SLOTS) * 100 + '%', background: c.color }, title: `${c.name}: ${hrs(per[c.id])}` }))) : null,
      top.length ? h('div', { class: 'legend', style: { marginTop: '10px' } }, ...top.map(c => h('div', {}, h('b', { style: { background: c.color } }), h('span', {}, c.name), h('span', {}, hrs(per[c.id])), h('span', {}, `${fmt(per[c.id] / 14, 1)}/d`)))) : h('div', { class: 'empty-note' }, 'Pinta tu semana en Horario.')));

    /* ---------- notas ---------- */
    const notes = recentNotes(4);
    dash.append(card('c-notes', 'Notas', ['notas', 'Notas →'],
      notes.length ? h('div', { class: 'mini-list' }, ...notes.map(n => h('a', { class: 'note-mini', href: '#/notas', onclick: e => { e.preventDefault(); openEditor(n, rerender); } }, h('b', {}, (n.title || n.body.split('\n')[0] || 'Sin título')), h('span', {}, n.title ? n.body.split('\n')[0] : '')))) : h('div', { class: 'empty-note' }, 'Guarda ideas y links en Notas.'),
      h('button', { class: 'btn sm', style: { marginTop: '10px' }, onclick: () => openEditor(newNote(), rerender) }, h('span', { class: 'ic', html: I.plus }), 'Nota rápida')));

    paintUrg(); paintToday(); paintHabits();

    // en el celular el respaldo vive aquí (la barra lateral no se ve)
    root.append(h('div', { class: 'mobile-only', style: { marginTop: '24px' } }, backupBlock()));

    const t = setInterval(() => { if (new Date().getMinutes() % 30 === 0) rerender(); }, 60000);
    return () => clearInterval(t);
  },
};
