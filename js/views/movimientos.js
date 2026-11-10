// Contabilidad personal: anotar gastos e ingresos en segundos y ver el mes contra el presupuesto.
import { h, I, esc, fmt, clp, digits, today, addDays, monthKey, monthName, shiftMonth, dayLabel, fromISO, inlineEdit, menu, toast } from '../ui.js';
import { S, save, incomeTotal, amtOf, isSavingDest, ledgerMonth, monthTotals, guessCat, parseMovement, addMovement, catName, catColor } from '../store.js';

let month = null, type = 'gasto', filter = null, query = '';
const nMov = n => `${n} movimiento${n === 1 ? '' : 's'}`;

export function renderMovs(root, { rerender, head }) {
  const t0 = today();
  month ??= monthKey(t0);
  const isCur = month === monthKey(t0);
  const tot = monthTotals(month);

  head.append(h('span', { class: 'period' },
    h('button', { class: 'icon-btn', 'aria-label': 'Mes anterior', html: `<span class="ic">${I.left}</span>`, onclick: () => { month = shiftMonth(month, -1); rerender(); } }),
    h('span', { class: 'lbl' }, monthName(month)),
    h('button', { class: 'icon-btn', 'aria-label': 'Mes siguiente', html: `<span class="ic">${I.right}</span>`, onclick: () => { month = shiftMonth(month, 1); rerender(); } }),
    !isCur ? h('button', { class: 'btn sm', onclick: () => { month = monthKey(t0); rerender(); } }, 'Hoy') : null));

  /* ---------- anotar ---------- */
  let cat = null, catTouched = false, fixed = false;
  const amount = h('input', { class: 'q-amt', inputmode: 'numeric', placeholder: '$0', 'aria-label': 'Monto' });
  const what = h('input', { class: 'field q-what', placeholder: type === 'gasto' ? '¿En qué fue? (almuerzo, uber, super…)' : '¿De dónde vino? (sueldo, venta, devolución…)', 'aria-label': 'Motivo' });
  const date = h('input', { type: 'date', class: 'date-in', value: isCur ? t0 : `${month}-01`, 'aria-label': 'Fecha' });
  const chips = h('div', { class: 'cchips' });
  const fixBtn = h('button', { class: 'tagbtn', title: 'Se repite cada mes (arriendo, plan del celular…). El próximo mes te ofrezco anotarlo de nuevo.' }, 'Fijo mensual');
  const typeSeg = h('div', { class: 'seg tseg' }, ...[['gasto', 'Gasto'], ['ingreso', 'Ingreso']].map(([k, l]) => h('button', { 'data-k': k, 'aria-pressed': type === k ? 'true' : 'false', onclick: () => { type = k; rerender(); } }, l)));
  const list = () => (type === 'gasto' ? S.money.dests : S.money.incomes);
  function paintChips() {
    chips.replaceChildren(...list().map(d => { const b = h('button', { class: 'cchip', 'aria-pressed': cat === d.id ? 'true' : 'false', onclick: () => { cat = cat === d.id ? null : d.id; catTouched = true; paintChips(); what.focus(); } }, h('b'), d.name || 'Sin nombre'); b.style.setProperty('--c', d.color || '#30d158'); return b; }),
      ...(!list().length ? [h('span', { class: 'hint' }, type === 'gasto' ? 'Crea destinos en Presupuesto para usarlos como categorías.' : 'Agrega tus ingresos en Presupuesto para usarlos aquí.')] : []));
  }
  paintChips();
  amount.addEventListener('focus', () => amount.select());
  amount.addEventListener('input', () => {
    // también se puede escribir todo junto: «5000 almuerzo»
    const raw = amount.value;
    if (/[a-zA-Záéíóúñ#]/.test(raw)) { const p = parseMovement(raw, type); amount.value = p.amount ? clp(p.amount) : ''; if (p.what) what.value = p.what; if (p.cat && !catTouched) { cat = p.cat; paintChips(); } what.focus(); return; }
    const v = digits(raw); amount.value = v ? clp(v) : '';
  });
  what.addEventListener('input', () => { if (catTouched) return; const g = guessCat(what.value, type); if (g !== cat) { cat = g; paintChips(); } });
  fixBtn.addEventListener('click', () => { fixed = !fixed; fixBtn.setAttribute('aria-pressed', fixed); });
  const commit = () => {
    const v = digits(amount.value);
    if (!v) { amount.focus(); return; }
    addMovement({ type, amount: v, what: what.value || (type === 'gasto' ? 'Gasto' : 'Ingreso'), cat, date: date.value || t0, fixed });
    toast(`${type === 'gasto' ? 'Gasto' : 'Ingreso'} de ${clp(v)} anotado`);
    rerender();
    requestAnimationFrame(() => document.querySelector('.q-amt')?.focus());
  };
  for (const el of [amount, what]) el.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); });

  root.append(h('div', { class: 'card qentry ' + type },
    h('div', { class: 'qe-row' }, typeSeg, amount, what, h('button', { class: 'btn primary', onclick: commit }, h('span', { class: 'ic', html: I.plus }), 'Anotar')),
    h('div', { class: 'qe-row2' }, chips, h('span', { class: 'spacer' }), fixBtn, date)));

  /* ---------- resumen del mes ---------- */
  const daysPassed = isCur ? +t0.slice(8) : new Date(+month.slice(0, 4), +month.slice(5), 0).getDate();
  const planned = (() => { const t = incomeTotal(); return S.money.dests.filter(d => !isSavingDest(d)).reduce((a, d) => a + amtOf(d, t), 0); })();
  const seg = (l, v, d, cls = '') => h('div', { class: 'ms ' + cls }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, v), h('div', { class: 'd' }, d));
  root.append(h('div', { class: 'card mstrip' },
    seg('Ingresos', clp(tot.inc), nMov(ledgerMonth(month).filter(m => m.type === 'ingreso').length), tot.inc ? 'good' : ''),
    seg('Gastos', clp(tot.spent), tot.toSaving ? `+ ${clp(tot.toSaving)} a ahorro` : nMov(ledgerMonth(month).filter(m => m.type === 'gasto').length)),
    seg('Balance', (tot.saved < 0 ? '−' : '') + clp(Math.abs(tot.saved)), tot.inc ? `${fmt(tot.saved / tot.inc * 100, 0)}% de lo que entró` : 'ingresos − gastos', tot.saved < 0 ? 'bad' : tot.saved > 0 ? 'good' : ''),
    seg('Gasto por día', clp(daysPassed ? tot.spent / daysPassed : 0), isCur ? `en ${daysPassed} días del mes` : 'promedio del mes'),
    seg('Vs presupuesto', planned ? `${fmt(tot.spent / planned * 100, 0)}%` : '–', planned ? `${clp(tot.spent)} de ${clp(planned)} en gastos` : 'arma tu presupuesto', planned && tot.spent > planned ? 'bad' : '')));

  /* ---------- lista + presupuesto vs real ---------- */
  const left = h('div', { class: 'card' }), right = h('div', { class: 'mv-side' });
  root.append(h('div', { class: 'mvgrid' }, left, right));

  // fijos del mes anterior que faltan
  const prev = shiftMonth(month, -1);
  const pendingFixed = ledgerMonth(prev).filter(m => m.fixed && !S.ledger.some(x => x.from === m.id));
  if (pendingFixed.length) right.append(h('div', { class: 'card fixed-card' },
    h('div', { class: 'card-h' }, h('h2', {}, 'Fijos por anotar'), h('span', { class: 'meta' }, monthName(prev).split(' ')[0])),
    h('div', { class: 'card-b' },
      ...pendingFixed.map(m => h('div', { class: 'fx' }, h('span', {}, m.what), h('b', {}, clp(m.amount)))),
      h('button', { class: 'btn sm', style: { marginTop: '10px' }, onclick: () => {
        for (const m of pendingFixed) addMovement({ type: m.type, amount: m.amount, what: m.what, cat: m.cat, date: `${month}-${m.date.slice(8)}` > `${month}-28` ? `${month}-28` : `${month}-${m.date.slice(8)}`, fixed: true, from: m.id });
        toast(`${pendingFixed.length} fijo${pendingFixed.length === 1 ? '' : 's'} anotado${pendingFixed.length === 1 ? '' : 's'}`); rerender();
      } }, h('span', { class: 'ic', html: I.plus }), `${pendingFixed.length === 1 ? 'Anotarlo' : `Anotar los ${pendingFixed.length}`} en ${monthName(month).split(' ')[0]}`))));

  // presupuesto vs real por destino
  const t = incomeTotal();
  const rows = S.money.dests.map(d => ({ d, spent: tot.byCat[d.id] || 0, plan: amtOf(d, t) }));
  const unc = (tot.byCat[''] || 0) + Object.entries(tot.byCat).filter(([k]) => k && !S.money.dests.some(d => d.id === k)).reduce((a, [, v]) => a + v, 0);
  right.append(h('div', { class: 'card' },
    h('div', { class: 'card-h' }, h('h2', {}, 'Presupuesto vs real'), h('a', { class: 'meta', href: '#/dinero', onclick: e => { e.preventDefault(); setTab('plan'); } }, 'Editar →')),
    h('div', { class: 'card-b bvr' },
      ...rows.map(({ d, spent, plan }) => {
        const p = plan ? spent / plan : spent ? 1.01 : 0, over = plan && spent > plan, sv = isSavingDest(d);
        return h('button', { class: 'bvr-row' + (filter === d.id ? ' on' : ''), title: 'Filtrar la lista por esta categoría', onclick: () => { filter = filter === d.id ? null : d.id; rerender(); } },
          h('div', { class: 'bt' }, h('b', { style: { background: d.color } }), h('span', {}, d.name), h('span', { class: 'bn' + (over && !sv ? ' over' : '') }, clp(spent), h('small', {}, plan ? ` / ${clp(plan)}` : ''))),
          h('div', { class: 'pbar' + (sv && p >= 1 ? ' done' : '') }, h('i', { style: { width: Math.min(100, p * 100) + '%', background: over && !sv ? 'var(--bad)' : d.color } })),
          h('div', { class: 'bd' }, !plan ? 'sin monto en el presupuesto' : sv ? (spent >= plan ? 'meta de ahorro cumplida ✓' : `faltan ${clp(plan - spent)} por apartar`) : over ? `te pasaste ${clp(spent - plan)}` : `quedan ${clp(plan - spent)}`));
      }),
      unc ? h('div', { class: 'bvr-row static' }, h('div', { class: 'bt' }, h('b', { style: { background: '#8e8e93' } }), h('span', {}, 'Sin categoría'), h('span', { class: 'bn' }, clp(unc)))) : null,
      !rows.length ? h('div', { class: 'empty-note' }, 'Cuando armes tu presupuesto, aquí ves cuánto llevas gastado de cada parte.') : null)));

  // lista del mes
  const search = h('input', { class: 'field', type: 'search', placeholder: 'Buscar movimientos…', value: query, 'aria-label': 'Buscar' });
  const box = h('div', { class: 'mvlist' });
  left.append(h('div', { class: 'card-h' }, h('h2', {}, 'Movimientos'),
    filter ? h('button', { class: 'pill btnish', onclick: () => { filter = null; rerender(); } }, `${S.money.dests.find(d => d.id === filter)?.name || 'Filtro'} ×`) : null,
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn sm', title: 'Descargar el mes en CSV (Excel, Numbers, Sheets)', onclick: () => exportCSV(month) }, h('span', { class: 'ic', html: I.save }), 'CSV')),
    h('div', { class: 'card-b', style: { paddingBottom: '6px' } }, search), box);
  function paintList() {
    const q = query.trim().toLowerCase();
    const items = ledgerMonth(month).filter(m => (!filter || m.cat === filter) && (!q || `${m.what} ${catName(m)} ${m.amount}`.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);
    box.replaceChildren();
    if (!items.length) { box.append(h('div', { class: 'card-b' }, h('div', { class: 'empty-note' }, ledgerMonth(month).length ? 'Nada coincide.' : 'Todavía no hay movimientos este mes. Anota el primero arriba: escribe el monto y en qué fue, y Enter.'))); return; }
    let day = null, group = null;
    for (const m of items) {
      if (m.date !== day) {
        day = m.date;
        const dayItems = items.filter(x => x.date === day);
        const out = dayItems.filter(x => x.type === 'gasto').reduce((a, x) => a + x.amount, 0), inn = dayItems.filter(x => x.type === 'ingreso').reduce((a, x) => a + x.amount, 0);
        group = h('div', { class: 'mvday' }, h('div', { class: 'mvd-h' }, h('span', {}, dayLabel(day)), h('span', {}, [inn ? `+${clp(inn)}` : '', out ? `−${clp(out)}` : ''].filter(Boolean).join('  '))));
        box.append(group);
      }
      group.append(movRow(m, rerender));
    }
  }
  search.addEventListener('input', () => { query = search.value; paintList(); });
  paintList();
  requestAnimationFrame(() => { if (matchMedia('(hover: hover)').matches) amount.focus({ preventScroll: true }); });
}

function movRow(m, rerender) {
  const amt = h('button', { class: 'mv-amt ' + m.type, title: 'Cambiar monto' }, (m.type === 'gasto' ? '−' : '+') + clp(m.amount));
  const what = h('span', { class: 'mv-what', title: 'Clic para editar' }, m.what);
  const catBtn = h('button', { class: 'pill btnish mv-cat', title: 'Cambiar categoría' }, h('b', { style: { background: catColor(m) } }), catName(m));
  const dateIn = h('input', { type: 'date', value: m.date, tabindex: -1, 'aria-hidden': 'true', class: 'hidden-date' });
  const row = h('div', { class: 'mvrow' }, h('span', { class: 'mv-dot', style: { background: catColor(m) } }), what, m.fixed ? h('span', { class: 'pill' }, 'fijo') : null, catBtn, amt, dateIn,
    h('span', { class: 'acts' },
      h('button', { class: 'icon-btn', title: 'Cambiar fecha', html: `<span class="ic">${I.week}</span>`, onclick: () => { try { dateIn.showPicker(); } catch (e) { dateIn.focus(); } } }),
      h('button', { class: 'icon-btn danger', title: 'Eliminar', html: `<span class="ic">${I.trash}</span>`, onclick: () => {
        const i = S.ledger.indexOf(m); S.ledger.splice(i, 1); save(); rerender();
        toast('Movimiento eliminado');
      } })));
  what.addEventListener('click', () => inlineEdit(what, m.what, v => { if (v) { m.what = v; save(); } rerender(); }));
  amt.addEventListener('click', () => inlineEdit(amt, clp(m.amount), v => { const n = digits(v || ''); if (n) { m.amount = n; save(); } rerender(); }));
  catBtn.addEventListener('click', () => {
    const list = m.type === 'gasto' ? S.money.dests : S.money.incomes;
    menu(catBtn, [{ label: 'Categoría' }, ...list.map(d => ({ label: d.name, onClick: () => { m.cat = d.id; save(); rerender(); } })), { sep: true }, { label: 'Sin categoría', onClick: () => { m.cat = null; save(); rerender(); } },
      { label: m.fixed ? 'Ya no es fijo mensual' : 'Marcar como fijo mensual', onClick: () => { m.fixed = !m.fixed; save(); rerender(); } }]);
  });
  dateIn.addEventListener('change', () => { if (dateIn.value) { m.date = dateIn.value; save(); rerender(); } });
  return row;
}

function exportCSV(key) {
  const rows = [['Fecha', 'Tipo', 'Motivo', 'Categoría', 'Monto', 'Fijo']];
  for (const m of ledgerMonth(key).sort((a, b) => a.date.localeCompare(b.date))) rows.push([m.date, m.type, m.what, catName(m), (m.type === 'gasto' ? -1 : 1) * m.amount, m.fixed ? 'sí' : '']);
  const csv = '﻿' + rows.map(r => r.map(c => /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `movimientos-${key}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let setTab = () => {};
export const bindSetTab = fn => { setTab = fn; };
export const movMonth = () => month;
