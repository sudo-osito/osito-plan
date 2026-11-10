// Organizador: navegación entre vistas (hash) y arranque.
import { h, $, I, closeMenu } from './ui.js';
import { load } from './store.js';
import { backupBlock, setOnImported, refreshBackupStatus } from './backup.js';
import inicio from './views/inicio.js';
import tareas from './views/tareas.js';
import metas from './views/metas.js';
import notas from './views/notas.js';
import horario from './views/horario.js';
import dinero from './views/dinero.js';

load();

const ROUTES = [
  { id: 'inicio', label: 'Inicio', icon: I.home, view: inicio },
  { id: 'tareas', label: 'Tareas', icon: I.tasks, view: tareas },
  { id: 'metas', label: 'Metas', icon: I.goals, view: metas },
  { id: 'notas', label: 'Notas', icon: I.notes, view: notas },
  { id: 'horario', label: 'Horario', icon: I.week, view: horario },
  { id: 'dinero', label: 'Dinero', icon: I.money, view: dinero },
];

const root = $('#view');
let cleanup = null, current = null;

const navLink = (r, cls) => h('a', { href: `#/${r.id}`, class: cls, 'data-id': r.id }, h('span', { class: 'ic', html: r.icon }), h('span', { class: 'lbl' }, r.label));
$('#nav').append(...ROUTES.map(r => navLink(r, 'nav-item')));
$('#tabbar').append(...ROUTES.map(r => navLink(r, 'tab')));
$('#navFoot').append(backupBlock());

function routeId() { const id = location.hash.replace(/^#\/?/, '').split('/')[0]; return ROUTES.some(r => r.id === id) ? id : 'inicio'; }

export function render(keepScroll = false) {
  closeMenu();
  const id = routeId();
  const r = ROUTES.find(x => x.id === id);
  const y = scrollY;
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  root.innerHTML = '';
  root.dataset.view = id;
  document.querySelectorAll('[data-id]').forEach(a => a.classList.toggle('on', a.dataset.id === id));
  document.title = id === 'inicio' ? 'Organizador' : `${r.label} · Organizador`;
  cleanup = r.view.render(root, { rerender: () => render(true), go: to => { location.hash = `#/${to}`; } });
  if (keepScroll && current === id) scrollTo(0, y); else scrollTo(0, 0);
  current = id;
  refreshBackupStatus();
}

addEventListener('hashchange', () => render());
setOnImported(() => render(true));
render();
