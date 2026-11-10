// Agregar rápido (⌘K o el botón): una tarea, una nota o una meta sin salir de donde estás.
import { h, I, today, addDays, monthKey, uid, toast } from './ui.js';
import { S, save } from './store.js';

let open = null;
let afterSave = () => {};
export const setAfterQuickSave = fn => { afterSave = fn; };

export function quickAdd(kind = 'tarea') {
  if (open) { open.querySelector('input').focus(); return; }
  let when = 'hoy', urgent = false;
  const input = h('input', { class: 'q-in', placeholder: '', 'aria-label': 'Qué quieres agregar' });
  const seg = h('div', { class: 'seg' });
  const opts = h('div', { class: 'q-opts' });
  const kinds = [['tarea', 'Tarea'], ['nota', 'Nota'], ['meta', 'Meta del mes']];
  const ph = { tarea: 'Nueva tarea…  (empieza con ! para urgente)', nota: 'Escribe la nota…', meta: 'Nueva meta para este mes…' };
  function paint() {
    seg.replaceChildren(...kinds.map(([k, l]) => h('button', { 'aria-pressed': kind === k ? 'true' : 'false', onclick: () => { kind = k; paint(); input.focus(); } }, l)));
    input.placeholder = ph[kind];
    opts.replaceChildren();
    if (kind === 'tarea') {
      opts.append(h('div', { class: 'seg' }, ...[['hoy', 'Hoy'], ['manana', 'Mañana'], ['nada', 'Sin fecha']].map(([k, l]) => h('button', { 'aria-pressed': when === k ? 'true' : 'false', onclick: () => { when = k; paint(); input.focus(); } }, l))),
        h('button', { class: 'toggle-urg', 'aria-pressed': urgent ? 'true' : 'false', onclick: () => { urgent = !urgent; paint(); input.focus(); } }, h('span', { class: 'ic', html: I.fire }), 'Urgente'));
    }
  }
  paint();
  const close = () => { bg.remove(); open = null; document.removeEventListener('keydown', onKey, true); };
  const commit = () => {
    let v = input.value.trim(); if (!v) return;
    if (kind === 'tarea') {
      let u = urgent; if (v.startsWith('!')) { u = true; v = v.slice(1).trim(); }
      const date = when === 'hoy' ? today() : when === 'manana' ? addDays(today(), 1) : null;
      S.tasks.push({ id: uid('t'), title: v, date, urgent: u, done: false, created: Date.now() });
      toast(u ? 'Tarea urgente agregada' : 'Tarea agregada');
    } else if (kind === 'nota') {
      const [first, ...rest] = v.split(/\n/);
      S.notes.unshift({ id: uid('n'), title: rest.length ? first : '', body: rest.length ? rest.join('\n') : v, tags: [], pinned: false, color: null, created: Date.now(), updated: Date.now() });
      toast('Nota guardada');
    } else {
      S.goals.push({ id: uid('g'), title: v, scope: 'mes', period: monthKey(today()), kind: 'check', done: false, created: Date.now() });
      toast('Meta agregada a este mes');
    }
    save(); input.value = ''; afterSave();
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); commit(); if (!e.shiftKey) close(); }
    if (e.key === 'Tab' && document.activeElement === input) { e.preventDefault(); kind = kinds[(kinds.findIndex(k => k[0] === kind) + (e.shiftKey ? 2 : 1)) % 3][0]; paint(); }
  };
  const box = h('div', { class: 'quick-box', role: 'dialog', 'aria-label': 'Agregar rápido' },
    h('div', { class: 'q-top' }, h('span', { class: 'ic', html: I.plus }), input),
    h('div', { class: 'q-bar' }, seg, opts, h('span', { class: 'spacer' }), h('span', { class: 'hint' }, h('kbd', {}, 'Tab'), ' cambia · ', h('kbd', {}, '↵'), ' guarda')));
  const bg = h('div', { class: 'quick-bg', onpointerdown: e => { if (e.target === bg) close(); } }, box);
  document.body.append(bg); open = bg;
  document.addEventListener('keydown', onKey, true);
  input.focus();
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); quickAdd(); }
});
