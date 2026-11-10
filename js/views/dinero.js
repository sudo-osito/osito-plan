// Dinero: presupuesto del mes (repartir lo que entra, por % o por monto fijo) y el año (lo que entró y lo que ahorré mes a mes).
import { h, I, esc, fmt, clp, digits, MONTHS, MONTHS_S, moneyField, today, monthKey, uid } from '../ui.js';
import { S, save, PALETTE, incomeTotal, isAmt, pctOf, amtOf, pctTotal, activeSchedule, scheduleCounts } from '../store.js';

let viewYear = null;
const pctFmt = p => fmt(p, 1);

export default {
  render(root, { rerender }) {
    const M = S.money;
    viewYear ??= +today().slice(0, 4);

    /* =============== presupuesto del mes =============== */
    root.append(h('div', { class: 'page-head' }, h('h1', {}, 'Dinero'), h('span', { class: 'sub' }, 'Tu presupuesto del mes y cómo va el año')));
    root.append(h('div', { class: 'msec-h' },
      h('h2', {}, 'Presupuesto del mes'),
      h('span', { class: 'hint' }, 'El candado fija cada destino por % o por monto'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn sm', title: '50 % necesidades, 30 % gustos, 20 % ahorro', onclick: rule503020 }, 'Regla 50/30/20'),
      h('button', { class: 'btn sm', onclick: spreadRest }, 'Repartir lo que falta')));

    const incs = h('div'), incTot = h('span', { class: 'tot' });
    const dsts = h('div'), dstLeft = h('span', { class: 'muted' }), dstTot = h('span', { class: 'tot' }), dstHint = h('span');
    const sum = h('div', { class: 'card sum-card' });
    root.append(h('div', { class: 'mgrid' },
      h('div', { class: 'card mcard inc' }, h('h3', {}, 'Lo que entra ', h('span', {}, 'al mes')), incs,
        h('div', { class: 'mfoot' }, h('button', { class: 'btn sm', onclick: () => { M.incomes.push({ id: uid('i'), name: 'Otro ingreso', amount: 0 }); save(); renderLists(); const n = incs.lastElementChild.querySelector('.nm-in'); n.focus(); n.select(); } }, h('span', { class: 'ic', html: I.plus }), 'Ingreso'), incTot)),
      h('div', { class: 'card mcard dst' }, h('h3', {}, 'A dónde va ', dstHint), dsts,
        h('div', { class: 'mfoot' }, h('button', { class: 'btn sm', onclick: addDest }, h('span', { class: 'ic', html: I.plus }), 'Destino'), dstLeft, dstTot)),
      sum));

    function addDest() {
      const used = new Set(M.dests.map(d => d.color));
      M.dests.push({ id: uid('d'), name: 'Nuevo destino', pct: 0, color: PALETTE.find(p => !used.has(p)) || PALETTE[M.dests.length % PALETTE.length] });
      save(); renderLists(); const n = dsts.lastElementChild.querySelector('.nm-in'); n.focus(); n.select();
    }
    function rule503020() {
      if (M.dests.some(d => pctOf(d) > 0) && !confirm('Esto reemplaza tus destinos por Necesidades 50 %, Gustos 30 % y Ahorro 20 %. ¿Seguir?')) return;
      M.dests = [
        { id: uid('d'), name: 'Necesidades', pct: 50, color: '#2a6cf0' },
        { id: uid('d'), name: 'Gustos', pct: 30, color: '#ff9f0a' },
        { id: uid('d'), name: 'Ahorro', pct: 20, color: '#30b158' },
      ];
      save(); renderLists();
    }
    function spreadRest() {
      const left = 100 - pctTotal(); if (left <= 0.001) return;
      const byPct = M.dests.filter(d => !isAmt(d));          // los montos fijos no se tocan
      const empty = byPct.filter(d => !d.pct), targets = empty.length ? empty : byPct;
      if (!targets.length) return;
      const each = Math.floor((left / targets.length) * 10) / 10;
      targets.forEach(d => (d.pct = +(d.pct + each).toFixed(1)));
      const rest = +(100 - pctTotal()).toFixed(1); if (rest > 0) targets[0].pct = +(targets[0].pct + rest).toFixed(1);
      save(); renderLists();
    }

    function renderLists() {
      incs.innerHTML = '';
      for (const inc of M.incomes) {
        const nm = h('input', { class: 'nm-in', value: inc.name, 'aria-label': 'Nombre del ingreso' });
        nm.addEventListener('input', () => { inc.name = nm.value; save(); });
        incs.append(h('div', { class: 'mrow' }, nm, moneyField(() => inc.amount, v => { inc.amount = v; save(); renderStats(); }, { 'aria-label': 'Monto' }),
          h('button', { class: 'xbtn', title: 'Eliminar', onclick: () => { M.incomes = M.incomes.filter(x => x !== inc); save(); renderLists(); } }, '×')));
      }
      dsts.innerHTML = '';
      for (const d of M.dests) {
        const nm = h('input', { class: 'nm-in', value: d.name, 'aria-label': 'Destino' });
        const rg = h('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': 'Porcentaje' });
        const pc = h('input', { class: 'pct', inputmode: 'decimal', placeholder: '0', 'aria-label': 'Porcentaje' });
        const am = h('input', { class: 'amt val', inputmode: 'numeric', placeholder: '$0', 'aria-label': 'Monto' });
        const lp = h('button', { class: 'lock', 'data-mode': 'pct' }), la = h('button', { class: 'lock', 'data-mode': 'amt' });
        const col = h('input', { type: 'color', value: d.color, 'aria-label': 'Color' });
        const dot = h('span', { class: 'dot', style: { background: d.color } }, col);
        const row = h('div', { class: 'mrow', 'data-id': d.id }, dot, nm, rg,
          h('span', { class: 'fld fp pctw' }, lp, pc), h('span', { class: 'fld fa' }, la, am),
          h('button', { class: 'xbtn', title: 'Eliminar', onclick: () => { M.dests = M.dests.filter(x => x !== d); save(); renderLists(); } }, '×'));
        // escribir en cualquiera de los dos campos funciona; el candado decide cuál se mantiene si cambia el ingreso
        const setPct = v => { const t = incomeTotal(); if (isAmt(d)) d.amount = Math.round(t * v / 100); else d.pct = v; };
        const setAmt = v => { const t = incomeTotal(); if (isAmt(d)) d.amount = v; else d.pct = t ? Math.min(100, v / t * 100) : 0; };
        nm.addEventListener('input', () => { d.name = nm.value; save(); renderStats(); });
        rg.addEventListener('input', () => { setPct(+rg.value); save(); renderStats(); });
        pc.addEventListener('input', () => { setPct(Math.max(0, Math.min(100, parseFloat(pc.value.replace(',', '.')) || 0))); save(); renderStats(); });
        am.addEventListener('input', () => { const v = digits(am.value); am.value = v ? clp(v) : ''; setAmt(v); save(); renderStats(); });
        for (const el of [pc, am]) { el.addEventListener('focus', () => el.select()); el.addEventListener('blur', renderStats); }
        for (const b of [lp, la]) b.addEventListener('click', () => {
          const t = incomeTotal();
          if (b.dataset.mode === 'amt' && !isAmt(d)) { d.amount = Math.round(amtOf(d, t)); d.mode = 'amt'; }
          else if (b.dataset.mode === 'pct' && isAmt(d)) { d.pct = pctOf(d, t); d.mode = 'pct'; }
          save(); renderStats();
        });
        col.addEventListener('input', () => { d.color = col.value; dot.style.background = col.value; renderStats(); });
        col.addEventListener('change', save);
        dsts.append(row);
      }
      renderStats();
    }

    function renderStats() {
      const total = incomeTotal(), pt = pctTotal(), left = 100 - pt, over = pt > 100.001;
      incTot.textContent = clp(total);
      dstTot.textContent = pctFmt(pt) + '%'; dstTot.classList.toggle('over', over);
      dstLeft.textContent = over ? `te pasas ${pctFmt(-left)}% (${clp(total * -left / 100)})` : left > 0.001 ? `faltan ${pctFmt(left)}% · ${clp(total * left / 100)}` : 'todo repartido';
      dstLeft.classList.toggle('over', over);
      dstHint.textContent = total ? '' : 'pon primero lo que entra';
      for (const r of dsts.querySelectorAll('.mrow')) {
        const d = M.dests.find(x => x.id === r.dataset.id); if (!d) continue;
        const p = pctOf(d, total), a = Math.round(amtOf(d, total));
        const am = r.querySelector('.val'), pc = r.querySelector('.pct'), rg = r.querySelector('input[type=range]');
        if (document.activeElement !== am) am.value = a ? clp(a) : '';
        if (document.activeElement !== pc) pc.value = p ? pctFmt(p) : '';
        if (document.activeElement !== rg) rg.value = p;
        const fp = r.querySelector('.fp'), fa = r.querySelector('.fa');
        fp.classList.toggle('locked', !isAmt(d)); fa.classList.toggle('locked', isAmt(d));
        fp.querySelector('.lock').innerHTML = isAmt(d) ? I.unlock : I.lock;
        fa.querySelector('.lock').innerHTML = isAmt(d) ? I.lock : I.unlock;
        fp.querySelector('.lock').title = isAmt(d) ? 'Fijar el porcentaje (el monto sigue al ingreso)' : 'Fijado por porcentaje';
        fa.querySelector('.lock').title = isAmt(d) ? 'Fijado por monto (no cambia si cambia el ingreso)' : 'Fijar el monto (el % se ajusta al ingreso)';
      }
      const ds = M.dests.filter(d => pctOf(d, total) > 0), scale = Math.max(100, pt);
      const bar = ds.map(d => `<i style="width:${pctOf(d, total) / scale * 100}%;background:${d.color}" title="${esc(d.name)}: ${pctFmt(pctOf(d, total))}%"></i>`).join('');
      const leg = ds.map(d => `<div><b style="background:${d.color}"></b><span>${esc(d.name || 'Sin nombre')}${isAmt(d) ? ' <small style="color:var(--ink-3)">· fijo</small>' : ''}</span><span>${clp(amtOf(d, total))}</span><span>${pctFmt(pctOf(d, total))}%</span></div>`).join('')
        + (left > 0.001 ? `<div style="color:var(--ink-3)"><b style="background:var(--line)"></b><span>Sin repartir</span><span>${clp(total * left / 100)}</span><span>${pctFmt(left)}%</span></div>` : '');
      const sch = activeSchedule(), { per } = scheduleCounts(sch);
      const work = sch.cats.find(c => c.id === 'trabajo'), wWeek = work ? (per[work.id] || 0) / 2 : 0, wMonth = wWeek * 52 / 12;
      const hourVal = total && wMonth ? total / wMonth : 0;
      sum.innerHTML = `
        <div class="stat-row">
          <div class="stat"><div class="l">Entra al mes</div><div class="v">${clp(total)}</div><div class="d">${clp(total * 12)} al año</div></div>
          <div class="stat${over ? ' warn' : ''}"><div class="l">${over ? 'Te pasas' : 'Sin repartir'}</div><div class="v">${clp(Math.abs(total * left / 100))}</div><div class="d">${pctFmt(Math.abs(left))}% de lo que entra</div></div>
        </div>
        <div class="bigbar">${bar}</div>
        <div class="legend">${leg || '<div style="color:var(--ink-3);display:block">Mueve los porcentajes para repartir.</div>'}</div>
        <div class="stat-row">
          <div class="stat"><div class="l">Tu hora de ${esc(work ? work.name.toLowerCase() : 'trabajo')} vale</div><div class="v">${hourVal ? clp(hourVal) : '–'}</div><div class="d">${wWeek ? `${fmt(wWeek)} h/semana en «${esc(sch.name)}»` : 'Pinta tus horas de trabajo en Horario'}</div></div>
          <div class="stat"><div class="l">Al día (30 días)</div><div class="v">${clp(total / 30)}</div><div class="d">lo que entra, día a día</div></div>
        </div>`;
    }
    renderLists();

    /* =============== el año =============== */
    const Y = String(viewYear), curKey = monthKey(today());
    const yearHead = h('div', { class: 'msec-h' },
      h('h2', {}, `Año ${Y}`),
      h('span', { class: 'hint' }, 'Anota lo que entró y lo que ahorraste cada mes'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'period' },
        h('button', { class: 'icon-btn', 'aria-label': 'Año anterior', html: `<span class="ic">${I.left}</span>`, onclick: () => { viewYear--; rerender(); } }),
        h('button', { class: 'icon-btn', 'aria-label': 'Año siguiente', html: `<span class="ic">${I.right}</span>`, onclick: () => { viewYear++; rerender(); } })));
    root.append(yearHead);

    const tbody = h('tbody'), tfoot = h('tfoot');
    const chart = h('div', { class: 'chart' });
    const ysum = h('div', { class: 'goalbox' });
    root.append(h('div', { class: 'ygrid' },
      h('div', { class: 'card' }, h('table', { class: 'ytable' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Mes'), h('th', {}, 'Entró'), h('th', {}, 'Ahorré'), h('th', {}, '% ahorro'))), tbody, tfoot)),
      h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('h2', {}, 'Ahorro del año')), h('div', { class: 'card-b' }, ysum, chart))));

    const mrec = k => (S.savings.months[k] ||= { income: 0, saved: 0 });
    const pctCell = [];
    MONTHS.forEach((m, i) => {
      const k = `${Y}-${String(i + 1).padStart(2, '0')}`;
      const has = () => S.savings.months[k];
      const inc = moneyField(() => has()?.income, v => { mrec(k).income = v; save(); renderYear(); }, { 'aria-label': `Entró en ${m}` });
      const sav = moneyField(() => has()?.saved, v => { mrec(k).saved = v; save(); renderYear(); }, { 'aria-label': `Ahorré en ${m}` });
      const pc = h('td', { class: 'r' });
      pctCell.push([k, pc]);
      const fillBtn = k === curKey && incomeTotal() ? h('button', { class: 'pill btnish', title: 'Usar lo que entra según tu presupuesto', onclick: () => { mrec(k).income = incomeTotal(); save(); rerender(); } }, 'usar presupuesto') : null;
      tbody.append(h('tr', { class: (k === curKey ? 'cur' : '') + (k > curKey ? ' future' : '') },
        h('td', {}, m, fillBtn ? ' ' : '', fillBtn), h('td', {}, inc), h('td', {}, sav), pc));
    });

    const goalIn = moneyField(() => S.savings.goals[Y], v => { S.savings.goals[Y] = v; save(); renderYear(); }, { 'aria-label': 'Meta de ahorro del año' });
    function renderYear() {
      let inc = 0, sav = 0, months = 0;
      const vals = [];
      MONTHS.forEach((_, i) => {
        const k = `${Y}-${String(i + 1).padStart(2, '0')}`, r = S.savings.months[k];
        const a = +r?.income || 0, s = +r?.saved || 0;
        inc += a; sav += s; if (a || s) months++;
        vals.push([k, s]);
      });
      for (const [k, td] of pctCell) { const r = S.savings.months[k]; td.textContent = r?.income ? `${fmt((r.saved || 0) / r.income * 100, 0)}%` : ''; }
      tfoot.innerHTML = `<tr><td>Total</td><td class="r">${clp(inc)}</td><td class="r">${clp(sav)}</td><td class="r">${inc ? fmt(sav / inc * 100, 0) + '%' : ''}</td></tr>`;
      const goal = +S.savings.goals[Y] || 0, avg = months ? sav / months : 0, proj = avg * 12;
      const p = goal ? Math.min(100, sav / goal * 100) : 0;
      ysum.replaceChildren(
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('div', { class: 'l' }, 'Ahorrado en el año'), h('div', { class: 'v' }, clp(sav)), h('div', { class: 'd' }, months ? `promedio ${clp(avg)} al mes` : 'Anota tus meses en la tabla')),
          h('div', { class: 'stat' }, h('div', { class: 'l' }, 'Si sigues así'), h('div', { class: 'v' }, months ? clp(proj) : '–'), h('div', { class: 'd' }, 'proyección a diciembre'))),
        h('div', { class: 'row' }, h('span', { class: 'hint', style: { flex: 1 } }, 'Meta de ahorro del año'), goalIn),
        goal ? h('div', {}, h('div', { class: 'pbar' + (p >= 100 ? ' done' : '') }, h('i', { style: { width: p + '%' } })),
          h('div', { class: 'hint', style: { marginTop: '6px' } }, p >= 100 ? '¡Meta cumplida!' : `${fmt(p, 0)}% · te faltan ${clp(goal - sav)}${months && proj < goal ? ' · a este ritmo no llegas' : months ? ' · vas bien' : ''}`)) : null);
      const max = Math.max(1, ...vals.map(([, s]) => Math.abs(s)));
      chart.replaceChildren(...vals.map(([k, s], i) => h('div', { class: 'col' + (k === curKey ? ' cur' : '') + (s < 0 ? ' neg' : ''), title: `${MONTHS[i]}: ${clp(s)}` }, h('i', { style: { height: `${Math.abs(s) / max * 100}%` } }), h('span', {}, MONTHS_S[i]))));
    }
    renderYear();
  },
};

