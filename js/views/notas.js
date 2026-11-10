// Notas: guardar cualquier cosa (ideas, links, datos) con etiquetas, búsqueda y fijadas arriba.
import { h, I, esc, uid, dayLabel, iso } from '../ui.js';
import { S, save } from '../store.js';

const COLORS = [null, '#2a6cf0', '#30b158', '#ff9f0a', '#ff5d8f', '#bf5af2', '#e5484d'];
let query = '', tagFilter = null;

const linkify = s => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
const parseTags = s => [...new Set(s.split(/[,#]/).map(x => x.trim().toLowerCase()).filter(Boolean))];
const noteDate = n => dayLabel(iso(new Date(n.updated)));

export function newNote(fields = {}) {
  const n = { id: uid('n'), title: '', body: '', tags: [], pinned: false, color: null, created: Date.now(), updated: Date.now(), ...fields };
  S.notes.unshift(n); save(); return n;
}

export function openEditor(n, onClose) {
  const title = h('input', { class: 'title-in', placeholder: 'Título', value: n.title, 'aria-label': 'Título' });
  const body = h('textarea', { placeholder: 'Escribe lo que quieras guardar: ideas, links, datos, listas…', 'aria-label': 'Contenido' });
  body.value = n.body;
  const tags = h('input', { class: 'field', placeholder: 'Etiquetas: trabajo, ideas, compras', value: n.tags.join(', '), 'aria-label': 'Etiquetas' });
  const pin = h('button', { class: 'icon-btn', title: n.pinned ? 'Desfijar' : 'Fijar arriba', html: `<span class="ic">${I.pin}</span>`, style: n.pinned ? { color: 'var(--accent)' } : {} });
  const colors = h('div', { class: 'colors', 'aria-label': 'Color' }, ...COLORS.map(c => h('button', { 'aria-pressed': n.color === c ? 'true' : 'false', title: c ? 'Color' : 'Sin color', style: { background: c || 'var(--line)' }, onclick: e => { n.color = c; touch(); colors.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); } })));
  const touch = () => { n.updated = Date.now(); save(); };
  title.addEventListener('input', () => { n.title = title.value; touch(); });
  body.addEventListener('input', () => { n.body = body.value; touch(); });
  tags.addEventListener('input', () => { n.tags = parseTags(tags.value); touch(); });
  pin.addEventListener('click', () => { n.pinned = !n.pinned; pin.style.color = n.pinned ? 'var(--accent)' : ''; pin.title = n.pinned ? 'Desfijar' : 'Fijar arriba'; touch(); });
  const close = () => {
    bg.remove(); document.removeEventListener('keydown', onKey);
    if (!n.title.trim() && !n.body.trim()) { S.notes = S.notes.filter(x => x !== n); save(); }   // nota vacía = no se guarda
    onClose?.();
  };
  const del = h('button', { class: 'icon-btn danger', title: 'Eliminar nota', html: `<span class="ic">${I.trash}</span>`, onclick: () => { if ((n.title || n.body) && !confirm('¿Eliminar esta nota?')) return; S.notes = S.notes.filter(x => x !== n); save(); n.title = n.body = ''; close(); } });
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nota' },
    h('div', { class: 'mh' }, h('span', { class: 'when' }, `Editada ${noteDate(n).toLowerCase()}`), pin, del, h('button', { class: 'icon-btn', title: 'Cerrar (Esc)', html: `<span class="ic">${I.x}</span>`, onclick: () => close() })),
    title, body,
    h('div', { class: 'mf' }, tags, colors));
  const bg = h('div', { class: 'modal-bg', onclick: e => { if (e.target === bg) close(); } }, modal);
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  (n.title ? body : title).focus();
}

export default {
  render(root, { rerender }) {
    root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Notas'), h('span', { class: 'sub' }, 'Guarda ideas, links, datos y lo que necesites tener a mano')));
    const search = h('input', { class: 'field', type: 'search', placeholder: 'Buscar en tus notas…', value: query, 'aria-label': 'Buscar' });
    const tagsBox = h('div', { class: 'tags' });
    const add = h('button', { class: 'btn primary', onclick: () => openEditor(newNote(tagFilter ? { tags: [tagFilter] } : {}), rerender) }, h('span', { class: 'ic', html: I.plus }), 'Nota');
    root.append(h('div', { class: 'ntools' }, h('label', { class: 'search' }, h('span', { class: 'ic', html: I.search }), search), add, tagsBox));
    const out = h('div');
    root.append(out);

    function paint() {
      const all = [...new Set(S.notes.flatMap(n => n.tags))].sort();
      if (tagFilter && !all.includes(tagFilter)) tagFilter = null;
      tagsBox.replaceChildren(...(all.length ? [h('button', { class: 'tag', 'aria-pressed': !tagFilter ? 'true' : 'false', onclick: () => { tagFilter = null; paint(); } }, 'Todas'), ...all.map(t => h('button', { class: 'tag', 'aria-pressed': tagFilter === t ? 'true' : 'false', onclick: () => { tagFilter = tagFilter === t ? null : t; paint(); } }, `#${t}`))] : []));
      const q = query.trim().toLowerCase();
      const list = S.notes.filter(n => (!tagFilter || n.tags.includes(tagFilter)) && (!q || `${n.title} ${n.body} ${n.tags.join(' ')}`.toLowerCase().includes(q)))
        .sort((a, b) => b.updated - a.updated);
      out.innerHTML = '';
      if (!S.notes.length) { out.append(h('div', { class: 'card', style: { padding: '28px', textAlign: 'center' } }, h('b', {}, 'Todavía no hay notas'), h('div', { class: 'hint', style: { marginTop: '4px' } }, 'Crea una con «+ Nota». Puedes pegar links, listas o lo que quieras recordar.'))); return; }
      if (!list.length) { out.append(h('div', { class: 'empty-note' }, 'Nada coincide con la búsqueda.')); return; }
      const pinned = list.filter(n => n.pinned), rest = list.filter(n => !n.pinned);
      const section = (name, items) => { if (!items.length) return; if (pinned.length) out.append(h('div', { class: 'nsec' }, name)); out.append(h('div', { class: 'ncols' }, ...items.map(card))); };
      section('Fijadas', pinned); section('Otras', rest);
    }
    function card(n) {
      const short = n.body.length < 260;
      return h('div', { class: 'card ncard', role: 'button', tabindex: 0, onclick: () => openEditor(n, rerender), onkeydown: e => { if (e.key === 'Enter') openEditor(n, rerender); } },
        n.color ? h('div', { class: 'bar', style: { background: n.color } }) : null,
        n.title ? h('h3', {}, n.pinned ? h('span', { class: 'ic', html: I.pin }) : null, n.title) : null,
        n.body ? h('div', { class: 'body' + (short ? ' short' : ''), html: linkify(n.body.slice(0, 900)) }) : null,
        h('div', { class: 'foot' }, ...n.tags.map(t => h('span', { class: 'pill' }, `#${t}`)), h('span', { class: 'when' }, noteDate(n))));
    }
    // los links de una tarjeta abren el link y no la nota
    out.addEventListener('click', e => { if (e.target.closest('a')) e.stopPropagation(); }, true);
    search.addEventListener('input', () => { query = search.value; paint(); });
    paint();
  },
};

export const recentNotes = (k = 4) => S.notes.slice().sort((a, b) => (b.pinned - a.pinned) || b.updated - a.updated).slice(0, k);
