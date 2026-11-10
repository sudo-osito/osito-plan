// Dinero: presupuesto del mes (repartir lo que entra) y el año mes a mes.
// Conectado con Horario (valor de tu hora), Metas (metas de ahorro) e Inicio.
import { h, I, esc, fmt, clp, digits, MONTHS, MONTHS_S, moneyField, today, monthKey, uid, toast } from '../ui.js';
import { S, save, PALETTE, incomeTotal, isAmt, pctOf, amtOf, pctTotal, activeSchedule, scheduleCounts, isSavingDest, budgetSavings, yearSavings } from '../store.js';

let viewYear = null, selMonth = null;
const pctFmt = p => fmt(p, 1);

export default {
  render(root, { rerender }) {
    const M = S.money;
    const t0 = today();
    viewYear ??= +t0.slice(0, 4);
    selMonth ??= monthKey(t0);

    root.append(h('div', { class: 'page-head' },
      h('h1', {}, 'Dinero'),
      h('span', { class: 'sub' }, 'Reparte lo que entra cada mes y sigue tu ahorro del año')));

    /* =============== resumen arriba =============== */
    const strip = h('div', { class: 'card mstrip' });
    root.append(strip);

    /* =============== presupuesto =============== */
    const incs = h('div', { class: 'mlist' }), dsts = h('div', { class: 'mlist' });
    const incTot = h('b'), dstState = h('span', { class: 'mstate' });
    const donut = h('div', { class: 'donut-wrap' });
    root.append(h('div', { class: 'bgrid' },
      h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h2', {}, 'Lo que entra'), h('span', { class: 'meta' }, 'al mes · ', incTot)),
        incs,
        h('div', { class: 'card-b mfoot2' }, h('button', { class: 'btn sm', onclick: () => { M.incomes.push({ id: uid('i'), name: 'Otro ingreso', amount: 0 }); save(); renderLists(); const n = incs.lastElementChild.querySelector('.nm-in'); n.focus(); n.select(); } }, h('span', { class: 'ic', html: I.plus }), 'Ingreso'))),
      h('div', { class: 'card' },
        h('div', { class: 'card-h' }, h('h2', {}, 'A dónde va'), dstState),
        dsts,
        h('div', { class: 'card-b mfoot2' },
          h('button', { class: 'btn sm', onclick: addDest }, h('span', { class: 'ic', html: I.plus }), 'Destino'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn sm', onclick: spreadRest, title: 'Divide el % que falta entre los destinos vacíos' }, 'Repartir lo que falta'),
          h('button', { class: 'btn sm', onclick: rule503020, title: '50 % necesidades, 30 % gustos, 20 % ahorro' }, '50/30/20'))),
      h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h2', {}, 'Así se reparte')), h('div', { class: 'card-b' }, donut))));

    function addDest() {
      const used = new Set(M.dests.map(d => d.color));
      M.dests.push({ id: uid('d'), name: 'Nuevo destino', pct: 0, color: PALETTE.find(p => !used.has(p)) || PALETTE[M.dests.length % PALETTE.length] });
      save(); renderLists(); const n = dsts.lastElementChild.querySelector('.nm-in'); n.focus(); n.select();
    }
    function rule503020() {
      if (M.dests.some(d => pctOf(d) > 0) && !confirm('Esto reemplaza tus destinos por Necesidades 50 %, Gustos 30 % y Ahorro 20 %. ¿Seguir?')) return;
      M.dests = [
        { id: uid('d'), name: 'Necesidades', pct: 50, color: '#0a84ff' },
        { id: uid('d'), name: 'Gustos', pct: 30, color: '#ff9f0a' },
        { id: uid('d'), name: 'Ahorro', pct: 20, color: '#30d158', saving: true },
      ];
      save(); renderLists();
    }
    function spreadRest() {
      const left = 100 - pctTotal(); if (left <= 0.001) { toast('Ya está todo repartido'); return; }
      const byPct = M.dests.filter(d => !isAmt(d));                 // los montos fijos no se tocan
      const empty = byPct.filter(d => !d.pct), targets = empty.length ? empty : byPct;
      if (!targets.length) return;
      const each = Math.floor((left / targets.length) * 10) / 10;
      targets.forEach(d => (d.pct = +(d.pct + each).toFixed(1)));
      const rest = 100 - pctTotal(); targets[0].pct = Math.max(0, targets[0].pct + rest);
      save(); renderLists();
    }

    function renderLists() {
      incs.innerHTML = '';
      for (const inc of M.incomes) {
        const nm = h('input', { class: 'nm-in', value: inc.name, 'aria-label': 'Nombre del ingreso' });
        nm.addEventListener('input', () => { inc.name = nm.value; save(); });
        incs.append(h('div', { class: 'irow' }, h('span', { class: 'ic', html: I.money }), nm,
          moneyField(() => inc.amount, v => { inc.amount = v; save(); renderStats(); }, { 'aria-label': 'Monto' }),
          h('button', { class: 'icon-btn danger', title: 'Eliminar', html: `<span class="ic">${I.x}</span>`, onclick: () => { M.incomes = M.incomes.filter(x => x !== inc); save(); renderLists(); } })));
      }
      if (!M.incomes.length) incs.append(h('div', { class: 'card-b' }, h('div', { class: 'empty-note' }, 'Agrega tu sueldo y otros ingresos.')));
      dsts.innerHTML = '';
      for (const d of M.dests) {
        const nm = h('input', { class: 'nm-in', value: d.name, 'aria-label': 'Destino' });
        const rg = h('input', { type: 'range', class: 'rng', min: 0, max: 100, step: 1, 'aria-label': 'Porcentaje' });
        const pc = h('input', { class: 'pct', inputmode: 'decimal', placeholder: '0', 'aria-label': 'Porcentaje' });
        const am = h('input', { class: 'amt big-amt', inputmode: 'numeric', placeholder: '$0', 'aria-label': 'Monto' });
        const fix = h('div', { class: 'seg mini', title: 'Qué se mantiene si cambia lo que entra' });
        const sav = h('button', { class: 'tagbtn', title: 'Cuenta como ahorro (se usa en el año y en tus metas de ahorro)' }, 'Ahorro');
        const col = h('input', { type: 'color', value: d.color, 'aria-label': 'Color' });
        const dot = h('span', { class: 'dot', style: { background: d.color } }, col);
        const row = h('div', { class: 'drow', 'data-id': d.id },
          h('div', { class: 'l1' }, dot, nm, am, h('button', { class: 'icon-btn danger', title: 'Eliminar', html: `<span class="ic">${I.x}</span>`, onclick: () => { M.dests = M.dests.filter(x => x !== d); save(); renderLists(); } })),
          h('div', { class: 'l2' }, rg, h('span', { class: 'pctw' }, pc), fix, sav));
        row.style.setProperty('--c', d.color);
        // escribir en cualquiera de los dos campos funciona; «fijar» decide qué se mantiene si cambia el ingreso
        const setPct = v => { const t = incomeTotal(); if (isAmt(d)) d.amount = Math.round(t * v / 100); else d.pct = v; };
        const setAmt = v => { const t = incomeTotal(); if (isAmt(d)) d.amount = v; else d.pct = t ? Math.min(100, v / t * 100) : 0; };
        nm.addEventListener('input', () => { d.name = nm.value; save(); renderStats(); });
        rg.addEventListener('input', () => { setPct(+rg.value); save(); renderStats(); });
        pc.addEventListener('input', () => { setPct(Math.max(0, Math.min(100, parseFloat(pc.value.replace(',', '.')) || 0))); save(); renderStats(); });
        am.addEventListener('input', () => { const v = digits(am.value); am.value = v ? clp(v) : ''; setAmt(v); save(); renderStats(); });
        for (const el of [pc, am]) { el.addEventListener('focus', () => el.select()); el.addEventListener('blur', renderStats); }
        fix.append(...[['pct', '% fijo'], ['amt', '$ fijo']].map(([k, l]) => h('button', { 'data-k': k, onclick: () => {
          const t = incomeTotal();
          if (k === 'amt' && !isAmt(d)) { d.amount = Math.round(amtOf(d, t)); d.mode = 'amt'; }
          else if (k === 'pct' && isAmt(d)) { d.pct = pctOf(d, t); d.mode = 'pct'; }
          save(); renderStats();
        } }, l)));
        sav.addEventListener('click', () => { d.saving = !isSavingDest(d); save(); renderStats(); });
        col.addEventListener('input', () => { d.color = col.value; dot.style.background = col.value; row.style.setProperty('--c', col.value); renderStats(); });
        col.addEventListener('change', save);
        dsts.append(row);
      }
      renderStats();
    }

    function renderStats() {
      const total = incomeTotal(), pt0 = pctTotal(), pt = Math.abs(pt0 - 100) < 0.05 ? 100 : pt0, left = 100 - pt, over = pt > 100.05;
      incTot.textContent = clp(total);
      dstState.className = 'mstate' + (over ? ' over' : left < 0.01 ? ' ok' : '');
      dstState.textContent = !total ? 'pon primero lo que entra' : over ? `te pasas ${pctFmt(-left)}% · ${clp(total * -left / 100)}` : left > 0.01 ? `faltan ${pctFmt(left)}% · ${clp(total * left / 100)}` : 'todo repartido ✓';
      for (const r of dsts.querySelectorAll('.drow')) {
        const d = M.dests.find(x => x.id === r.dataset.id); if (!d) continue;
        const p = pctOf(d, total), a = Math.round(amtOf(d, total));
        const am = r.querySelector('.big-amt'), pc = r.querySelector('.pct'), rg = r.querySelector('.rng');
        if (document.activeElement !== am) am.value = a ? clp(a) : '';
        if (document.activeElement !== pc) pc.value = p ? pctFmt(p) : '';
        if (document.activeElement !== rg) rg.value = p;
        rg.style.setProperty('--p', Math.min(100, p) + '%');
        r.querySelectorAll('.seg.mini button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.k === 'amt') === isAmt(d) ? 'true' : 'false'));
        r.querySelector('.tagbtn').setAttribute('aria-pressed', isSavingDest(d) ? 'true' : 'false');
      }
      // donut
      const ds = M.dests.filter(d => pctOf(d, total) > 0), scale = Math.max(100, pt);
      const C = 2 * Math.PI * 64; let off = 0;
      const arcs = ds.map(d => { const len = pctOf(d, total) / scale * C; const s = `<circle r="64" cx="80" cy="80" fill="none" stroke="${d.color}" stroke-width="18" stroke-dasharray="${Math.max(0, len - 2)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`; off += len; return s; }).join('');
      donut.innerHTML = `
        <svg viewBox="0 0 160 160" class="donut" role="img" aria-label="Reparto del presupuesto"><circle r="64" cx="80" cy="80" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="18"/>${arcs}
          <text x="80" y="76" text-anchor="middle" class="d-big">${total ? pctFmt(Math.min(pt, 999)) + '%' : '–'}</text><text x="80" y="96" text-anchor="middle" class="d-sm">${over ? 'te pasas' : 'repartido'}</text></svg>
        <div class="legend">${ds.map(d => `<div><b style="background:${d.color}"></b><span>${esc(d.name || 'Sin nombre')}${isSavingDest(d) ? ' <small class="lg-tag">ahorro</small>' : ''}</span><span>${clp(amtOf(d, total))}</span><span>${pctFmt(pctOf(d, total))}%</span></div>`).join('')}
          ${left > 0.01 && total ? `<div class="muted-row"><b style="background:rgba(255,255,255,.12)"></b><span>Sin repartir</span><span>${clp(total * left / 100)}</span><span>${pctFmt(left)}%</span></div>` : ''}
          ${!ds.length ? '<div class="empty-note" style="display:block">Mueve los porcentajes o escribe montos para repartir.</div>' : ''}</div>`;
      // resumen arriba
      const sch = activeSchedule(), { per } = scheduleCounts(sch);
      const work = sch.cats.find(c => c.id === 'trabajo'), wWeek = work ? (per[work.id] || 0) / 2 : 0, wMonth = wWeek * 52 / 12;
      const hourVal = total && wMonth ? total / wMonth : 0, bs = budgetSavings();
      const y = String(viewYear), ys = yearSavings(y), yg = +S.savings.goals[y] || 0;
      const seg = (l, v, d, cls = '') => `<div class="ms ${cls}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
      strip.innerHTML =
        seg('Entra al mes', clp(total), total ? `${clp(total * 12)} al año` : 'agrega tus ingresos abajo') +
        seg(over ? 'Te pasas' : 'Sin repartir', clp(Math.abs(total * left / 100)), `${pctFmt(Math.abs(left))}% de lo que entra`, over ? 'bad' : left < 0.01 && total ? 'good' : '') +
        seg('Va a ahorro', clp(bs), bs ? `${clp(bs * 12)} al año si lo cumples` : 'marca tus destinos de ahorro', bs ? 'good' : '') +
        seg(`Ahorrado ${y}`, clp(ys), yg ? `${fmt(Math.min(100, ys / yg * 100), 0)}% de la meta de ${clp(yg)}` : 'sin meta del año') +
        seg(`Tu hora de ${esc(work ? work.name.toLowerCase() : 'trabajo')}`, hourVal ? clp(hourVal) : '–', wWeek ? `${fmt(wWeek)} h/semana en «${esc(sch.name)}»` : 'pinta tu trabajo en Horario');
    }
    renderLists();

    /* =============== el año =============== */
    const Y = String(viewYear), curKey = monthKey(t0);
    if (!selMonth.startsWith(Y)) selMonth = Y === t0.slice(0, 4) ? curKey : `${Y}-01`;
    root.append(h('div', { class: 'msec-h' },
      h('h2', {}, `Año ${Y}`),
      h('span', { class: 'hint' }, 'Elige un mes para anotar lo que entró y lo que ahorraste'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'period' },
        h('button', { class: 'icon-btn', 'aria-label': 'Año anterior', html: `<span class="ic">${I.left}</span>`, onclick: () => { viewYear--; rerender(); } }),
        h('button', { class: 'icon-btn', 'aria-label': 'Año siguiente', html: `<span class="ic">${I.right}</span>`, onclick: () => { viewYear++; rerender(); } }))));

    const tiles = h('div', { class: 'mtiles' }), editor = h('div', { class: 'meditor' }), ysum = h('div', { class: 'goalbox' }), chart = h('div', { class: 'chart' });
    root.append(h('div', { class: 'ygrid' },
      h('div', { class: 'card' }, h('div', { class: 'card-b', style: { paddingTop: '16px' } }, tiles, editor)),
      h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h2', {}, 'Ahorro del año')), h('div', { class: 'card-b' }, ysum, chart))));

    const key = i => `${Y}-${String(i + 1).padStart(2, '0')}`;
    const rec = k => S.savings.months[k];
    const mrec = k => (S.savings.months[k] ||= { income: 0, saved: 0 });

    function paintTiles() {
      const maxS = Math.max(1, ...MONTHS.map((_, i) => +rec(key(i))?.saved || 0));
      tiles.replaceChildren(...MONTHS.map((m, i) => {
        const k = key(i), r = rec(k), s = +r?.saved || 0, inc = +r?.income || 0;
        return h('button', { class: 'mtile' + (k === selMonth ? ' sel' : '') + (k === curKey ? ' cur' : '') + (k > curKey ? ' future' : '') + (r && (s || inc) ? ' has' : ''), onclick: () => { selMonth = k; paintTiles(); paintEditor(); } },
          h('span', { class: 'mn' }, MONTHS_S[i]),
          h('span', { class: 'mv' }, s ? clp(s) : '–'),
          h('span', { class: 'md' }, inc ? `${fmt(s / inc * 100, 0)}% de ${clp(inc)}` : k === curKey ? 'este mes' : ''),
          h('span', { class: 'mb' }, h('i', { style: { width: (s / maxS) * 100 + '%' } })));
      }));
    }
    function paintEditor() {
      const k = selMonth, i = +k.slice(5) - 1;
      const inc = moneyField(() => rec(k)?.income, v => { mrec(k).income = v; save(); paintTiles(); paintYear(); }, { 'aria-label': 'Entró' });
      const sav = moneyField(() => rec(k)?.saved, v => { mrec(k).saved = v; save(); paintTiles(); paintYear(); }, { 'aria-label': 'Ahorré' });
      editor.replaceChildren(
        h('div', { class: 'me-h' }, h('b', {}, `${MONTHS[i][0].toUpperCase() + MONTHS[i].slice(1)} ${Y}`), k === curKey ? h('span', { class: 'pill' }, 'este mes') : null),
        h('div', { class: 'me-row' },
          h('label', {}, h('span', {}, 'Entró'), inc),
          h('label', {}, h('span', {}, 'Ahorré'), sav),
          h('button', { class: 'btn sm', title: 'Entró = tu presupuesto; Ahorré = tus destinos marcados como ahorro', onclick: () => {
            if (!incomeTotal()) { toast('Primero pon lo que entra arriba'); return; }
            mrec(k).income = incomeTotal(); mrec(k).saved = Math.round(budgetSavings()); save(); toast('Mes llenado con tu presupuesto'); paintTiles(); paintEditor(); paintYear(); renderStats();
          } }, 'Usar mi presupuesto')));
    }
    const goalIn = moneyField(() => S.savings.goals[Y], v => { S.savings.goals[Y] = v; save(); paintYear(); renderStats(); }, { 'aria-label': 'Meta de ahorro del año' });
    function paintYear() {
      let inc = 0, sav = 0, months = 0; const vals = [];
      MONTHS.forEach((_, i) => { const r = rec(key(i)), a = +r?.income || 0, s = +r?.saved || 0; inc += a; sav += s; if (a || s) months++; vals.push(s); });
      const goal = +S.savings.goals[Y] || 0, avg = months ? sav / months : 0, proj = Y === t0.slice(0, 4) ? sav + avg * (12 - (+curKey.slice(5))) : sav;
      const p = goal ? Math.min(100, sav / goal * 100) : 0;
      ysum.replaceChildren(
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('div', { class: 'l' }, 'Ahorrado'), h('div', { class: 'v' }, clp(sav)), h('div', { class: 'd' }, months ? `${inc ? fmt(sav / inc * 100, 0) + '% de lo que entró · ' : ''}promedio ${clp(avg)}/mes` : 'Anota tus meses a la izquierda')),
          h('div', { class: 'stat' }, h('div', { class: 'l' }, 'A diciembre'), h('div', { class: 'v' }, months ? clp(proj) : '–'), h('div', { class: 'd' }, 'si sigues a este ritmo'))),
        h('div', { class: 'row' }, h('span', { class: 'hint', style: { flex: 1 } }, 'Meta de ahorro del año'), goalIn),
        goal ? h('div', {}, h('div', { class: 'pbar' + (p >= 100 ? ' done' : '') }, h('i', { style: { width: p + '%' } })),
          h('div', { class: 'hint', style: { marginTop: '6px' } }, p >= 100 ? '¡Meta cumplida!' : `${fmt(p, 0)}% · te faltan ${clp(goal - sav)}${months ? (proj < goal ? ' · a este ritmo no llegas' : ' · a este ritmo llegas') : ''}`)) : h('div', { class: 'hint' }, 'Con una meta, también aparece en Metas del año.'));
      const max = Math.max(1, ...vals.map(Math.abs));
      chart.replaceChildren(...vals.map((s, i) => h('div', { class: 'col' + (key(i) === curKey ? ' cur' : '') + (s < 0 ? ' neg' : ''), title: `${MONTHS[i]}: ${clp(s)}` }, h('i', { style: { height: `${Math.abs(s) / max * 100}%` } }), h('span', {}, MONTHS_S[i][0].toUpperCase()))));
    }
    paintTiles(); paintEditor(); paintYear();
  },
};
