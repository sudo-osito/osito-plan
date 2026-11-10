// Horario semanal en bloques de 30 min, de lunes a domingo, con varios horarios guardados.
import { h, I, esc, fmt, lum, ampm, slotTime, DAYS, menu, inlineEdit, uid, toast } from '../ui.js';
import { S, save, SLOTS, PALETTE, activeSchedule, scheduleCounts, newSchedule, blankGrid, uniqueName } from '../store.js';

const hrs = n => fmt(n / 2) + ' h';            // n = bloques de 30 min

export default {
  render(root, { rerender }) {
    let sch = activeSchedule();
    const undoStack = [];
    const touch = () => { sch.updated = Date.now(); save(); };
    const pushUndo = () => { undoStack.push(JSON.stringify({ grid: sch.grid, cats: sch.cats })); if (undoStack.length > 80) undoStack.shift(); undoBtn.disabled = false; };
    const undo = () => { const s = undoStack.pop(); if (!s) return; const o = JSON.parse(s); sch.grid = o.grid; sch.cats = o.cats; touch(); rerender(); };
    const catById = id => sch.cats.find(c => c.id === id);

    /* ---------- cabecera + horarios guardados ---------- */
    const undoBtn = h('button', { class: 'btn sm', title: 'Deshacer (⌘Z)', disabled: true, onclick: undo }, h('span', { class: 'ic', html: I.undo }), 'Deshacer');
    root.append(h('div', { class: 'page-head' },
      h('h1', {}, 'Horario'),
      h('span', { class: 'sub' }, 'Lunes a domingo · bloques de 30 min'),
      h('span', { class: 'spacer' }),
      undoBtn,
      h('span', { class: 'hint' }, 'Arrastra para pintar · ', h('kbd', {}, '1'), '–', h('kbd', {}, '9'), ' categoría · ', h('kbd', {}, '0'), ' borrar')));

    const profiles = h('div', { class: 'profiles', role: 'tablist', 'aria-label': 'Mis horarios' });
    function switchTo(id) { S.schedules.active = id; save(); rerender(); }
    function addSchedule(from) {
      const n = newSchedule(uniqueName(from ? `${from.name} (copia)` : 'Nuevo horario', S.schedules.list), from || { cats: sch.cats, grid: blankGrid(), brush: sch.brush });
      S.schedules.list.push(n); switchTo(n.id); toast(from ? 'Copia guardada' : 'Horario nuevo creado');
    }
    function renameChip(p, chip) {
      const span = chip.querySelector('.nm');
      inlineEdit(span, p.name, v => { if (v) { p.name = v; p.updated = Date.now(); save(); } rerender(); });
    }
    for (const p of S.schedules.list) {
      const on = p.id === sch.id;
      const chip = h('div', { class: 'pchip' + (on ? ' on' : ''), role: 'tab', tabindex: 0, 'aria-selected': on ? 'true' : 'false', title: on ? 'Horario activo' : `Cambiar a «${p.name}»` }, h('span', { class: 'nm' }, p.name));
      if (on) {
        const more = h('button', { class: 'icon-btn', 'aria-label': 'Opciones del horario', html: `<span class="ic">${I.more}</span>` });
        more.addEventListener('click', e => {
          e.stopPropagation();
          menu(more, [
            { label: 'Renombrar', icon: I.edit, onClick: () => renameChip(p, chip) },
            { label: 'Guardar una copia', icon: I.dup, onClick: () => addSchedule(p) },
            S.schedules.list.length > 1 && { sep: true },
            S.schedules.list.length > 1 && { label: 'Eliminar este horario', icon: I.trash, danger: true, onClick: () => {
              if (!confirm(`¿Eliminar «${p.name}»? No se puede deshacer.`)) return;
              S.schedules.list = S.schedules.list.filter(x => x !== p);
              S.schedules.active = S.schedules.list.slice().sort((a, b) => b.updated - a.updated)[0].id;
              save(); rerender();
            } },
          ]);
        });
        chip.append(more);
        chip.addEventListener('dblclick', () => renameChip(p, chip));
      } else { chip.addEventListener('click', () => switchTo(p.id)); chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTo(p.id); } }); }
      profiles.append(chip);
    }
    const addChip = h('button', { class: 'pchip add', 'aria-haspopup': 'menu' }, h('span', { class: 'ic', html: I.plus }), 'Agregar horario');
    addChip.addEventListener('click', () => menu(addChip, [
      { label: 'Nuevo horario' },
      { label: 'En blanco (mismas categorías)', icon: I.plus, onClick: () => addSchedule(null) },
      { label: `Copia de «${sch.name}»`, icon: I.dup, onClick: () => addSchedule(sch) },
    ], { align: 'left' }));
    profiles.append(addChip);
    root.append(profiles);

    /* ---------- grilla ---------- */
    const grid = h('div', { class: 'grid' });
    const side = h('aside', { class: 'hside' });
    root.append(h('div', { class: 'hlayout' }, h('div', { class: 'card gridwrap' }, grid), side));

    let cells = [];
    function buildGrid() {
      grid.style.gridTemplateColumns = `52px repeat(7, minmax(0,1fr))`;
      grid.innerHTML = '';
      cells = Array.from({ length: 7 }, () => []);
      grid.append(h('div'));
      for (let d = 0; d < 7; d++) {
        const btn = h('button', { class: 'icon-btn', 'aria-label': `Opciones de ${DAYS[d]}`, html: `<span class="ic">${I.more}</span>` });
        btn.addEventListener('click', e => { e.stopPropagation(); dayMenu(d, btn); });
        grid.append(h('div', { class: 'dh', 'data-d': d }, h('div', { class: 'row' }, h('span', { class: 'name' }, DAYS[d]), btn), h('span', { class: 'sum' }), h('div', { class: 'stack' })));
      }
      for (let s = 0; s < SLOTS; s++) {
        grid.append(h('div', { class: 'hr' + (s === 0 ? ' first' : '') }, s % 2 === 0 ? ampm(s / 2) : ''));
        for (let d = 0; d < 7; d++) {
          const c = h('div', { class: 'cell' + (s % 2 ? ' half' : ''), 'data-d': d, 'data-s': s, title: `${DAYS[d]} ${slotTime(s)}` }, h('div', { class: 'b' }));
          grid.append(c); cells[d][s] = c;
        }
      }
      grid.append(h('div', { class: 'now', id: 'nowLine' }));
      grid.append(h('div', { class: 'gempty' }, h('div', {}, h('b', {}, 'Pinta tu semana'), 'Elige una categoría a la derecha y arrastra sobre las horas. Cada fila es media hora; arrastrar en diagonal pinta varios días a la vez.')));
    }
    function paintGrid() {
      let any = false;
      for (let d = 0; d < 7; d++) {
        const col = sch.grid[d];
        for (let s = 0; s < SLOTS; s++) {
          const v = col[s], c = cells[d][s], b = c.firstChild, cat = v && catById(v);
          if (!cat) { c.classList.remove('f'); b.style.display = 'none'; c.title = `${DAYS[d]} ${slotTime(s)}`; continue; }
          any = true;
          const start = s === 0 || col[s - 1] !== v, end = s === SLOTS - 1 || col[s + 1] !== v;
          c.classList.toggle('f', !start);
          b.style.display = 'flex'; b.style.background = cat.color;
          b.className = 'b' + (start ? ' s' : '') + (end ? ' e' : '') + (lum(cat.color) > 0.45 ? ' dark' : '');
          if (start) {
            let len = 1; while (s + len < SLOTS && col[s + len] === v) len++;
            b.replaceChildren(cat.name, h('small', {}, len === 1 ? '30 min' : hrs(len)));
            c.title = `${DAYS[d]} · ${cat.name} · ${slotTime(s)} – ${slotTime(s + len)}`;
          } else b.textContent = '';
        }
      }
      grid.querySelector('.gempty').style.display = any ? 'none' : 'flex';
    }

    // pintar arrastrando: rectángulo entre el bloque inicial y el actual; arrastrar sobre lo mismo lo borra
    let drag = null;
    const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); return el?.closest?.('.cell'); };
    grid.addEventListener('pointerdown', e => {
      const c = e.target.closest('.cell'); if (!c || e.button !== 0) return;
      const d = +c.dataset.d, s = +c.dataset.s;
      pushUndo();
      const value = sch.brush && sch.grid[d][s] === sch.brush ? null : sch.brush;
      drag = { d0: d, s0: s, d1: d, s1: s, value, snap: sch.grid.map(col => col.slice()) };
      grid.setPointerCapture(e.pointerId);
      applyDrag(); e.preventDefault();
    });
    grid.addEventListener('pointermove', e => {
      if (!drag) return;
      const c = cellAt(e.clientX, e.clientY); if (!c) return;
      const d = +c.dataset.d, s = +c.dataset.s;
      if (d === drag.d1 && s === drag.s1) return;
      drag.d1 = d; drag.s1 = s; applyDrag();
    });
    const endDrag = () => { if (!drag) return; drag = null; touch(); renderStats(); };
    grid.addEventListener('pointerup', endDrag);
    grid.addEventListener('pointercancel', endDrag);
    function applyDrag() {
      const { d0, s0, d1, s1, value, snap } = drag;
      sch.grid = snap.map(col => col.slice());
      for (let d = Math.min(d0, d1); d <= Math.max(d0, d1); d++)
        for (let s = Math.min(s0, s1); s <= Math.max(s0, s1); s++) sch.grid[d][s] = value;
      paintGrid(); renderStats();
    }

    function placeNow() {
      const el = grid.querySelector('#nowLine'); if (!el) return;
      const dt = new Date(), d = (dt.getDay() + 6) % 7, m = dt.getHours() * 60 + dt.getMinutes();
      grid.querySelectorAll('.dh').forEach(x => x.classList.toggle('today', +x.dataset.d === d));
      const c = cells[d][Math.floor(m / 30)];
      Object.assign(el.style, { left: c.offsetLeft + 3 + 'px', width: c.offsetWidth - 6 + 'px', top: c.offsetTop + c.offsetHeight * (m % 30) / 30 - 1 + 'px' });
    }

    function dayMenu(d, btn) {
      const others = [0, 1, 2, 3, 4, 5, 6].filter(i => i !== d);
      const act = fn => () => { pushUndo(); fn(); touch(); paintGrid(); renderStats(); };
      menu(btn, [
        { label: `Copiar ${DAYS[d].toLowerCase()} a toda la semana`, icon: I.dup, onClick: act(() => others.forEach(i => (sch.grid[i] = sch.grid[d].slice()))) },
        { label: 'Copiar a lunes–viernes', icon: I.dup, onClick: act(() => [0, 1, 2, 3, 4].filter(i => i !== d).forEach(i => (sch.grid[i] = sch.grid[d].slice()))) },
        { label: 'Copiar a sábado y domingo', icon: I.dup, onClick: act(() => [5, 6].filter(i => i !== d).forEach(i => (sch.grid[i] = sch.grid[d].slice()))) },
        d < 6 && { label: `Copiar a ${DAYS[d + 1].toLowerCase()}`, icon: I.right, onClick: act(() => (sch.grid[d + 1] = sch.grid[d].slice())) },
        { sep: true },
        { label: `Limpiar ${DAYS[d].toLowerCase()}`, icon: I.trash, danger: true, onClick: act(() => (sch.grid[d] = Array(SLOTS).fill(null))) },
      ]);
    }

    /* ---------- panel lateral ---------- */
    const kpis = h('div', { class: 'kpis' });
    const catsBox = h('div');
    const free = h('div', { class: 'free' });
    const eraser = h('div', { class: 'erase', onclick: () => setBrush(null) }, h('span', { class: 'k', style: { width: '18px' } }, '0'), h('span', { class: 'sw' }), h('span', {}, 'Borrador'));
    side.append(kpis,
      h('div', { class: 'card cats' },
        h('div', { class: 'head' }, h('span', { style: { textAlign: 'left' } }, 'Categoría'), h('span', {}, 'Semana'), h('span', {}, 'Al día'), h('span', {}, '%')),
        catsBox, free, eraser,
        h('div', { class: 'foot' },
          h('button', { class: 'btn sm', onclick: addCat }, h('span', { class: 'ic', html: I.plus }), 'Categoría'),
          h('button', { class: 'btn sm', onclick: () => { if (!confirm(`¿Borrar todo lo pintado en «${sch.name}»?`)) return; pushUndo(); sch.grid = blankGrid(); touch(); paintGrid(); renderStats(); } }, h('span', { class: 'ic', html: I.trash }), 'Limpiar'))));

    function setBrush(id) { sch.brush = id; save(); renderCats(); renderStats(); }
    function addCat() {
      pushUndo();
      const used = new Set(sch.cats.map(c => c.color));
      const c = { id: uid('c'), name: 'Nueva', color: PALETTE.find(p => !used.has(p)) || PALETTE[sch.cats.length % PALETTE.length] };
      sch.cats.push(c); sch.brush = c.id; touch(); renderCats(); renderStats();
      const nm = catsBox.lastElementChild.querySelector('.nm-in'); nm.focus(); nm.select();
    }
    function renderCats() {
      catsBox.innerHTML = '';
      sch.cats.forEach((c, i) => {
        const nm = h('input', { class: 'nm-in', value: c.name, 'aria-label': 'Nombre' });
        const col = h('input', { type: 'color', value: c.color, 'aria-label': 'Color' });
        const dot = h('span', { class: 'dot', style: { background: c.color } }, col);
        const bar = h('i', { style: { background: c.color } });
        const row = h('div', { class: 'cat' + (sch.brush === c.id ? ' on' : ''), 'data-id': c.id },
          h('span', { class: 'k' }, i < 9 ? i + 1 : ''), dot, nm, h('span', { class: 'n' }), h('span', { class: 'n2' }), h('span', { class: 'p' }), h('div', { class: 'bar' }, bar),
          h('button', { class: 'xbtn', title: 'Eliminar categoría', onclick: () => {
            const used = sch.grid.flat().filter(v => v === c.id).length;
            if (used && !confirm(`«${c.name}» tiene ${hrs(used)} pintadas. ¿Eliminarla igual?`)) return;
            pushUndo();
            sch.cats = sch.cats.filter(x => x.id !== c.id);
            sch.grid = sch.grid.map(cc => cc.map(v => (v === c.id ? null : v)));
            if (sch.brush === c.id) sch.brush = sch.cats[0]?.id || null;
            touch(); renderCats(); paintGrid(); renderStats();
          } }, '×'));
        row.addEventListener('click', e => { if (e.target.closest('.xbtn,.dot')) return; if (sch.brush !== c.id) setBrush(c.id); });
        nm.addEventListener('input', () => { c.name = nm.value || 'Sin nombre'; touch(); paintGrid(); renderDayHeads(); });
        nm.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') nm.blur(); });
        col.addEventListener('input', () => { c.color = col.value; dot.style.background = col.value; bar.style.background = col.value; paintGrid(); renderDayHeads(); });
        col.addEventListener('change', touch);
        catsBox.append(row);
      });
      eraser.classList.toggle('on', sch.brush === null);
    }
    function renderStats() {
      const { per, perDay } = scheduleCounts(sch);
      const total = 7 * SLOTS, used = Object.values(per).reduce((a, b) => a + b, 0), max = Math.max(1, ...Object.values(per));
      catsBox.querySelectorAll('.cat').forEach(row => {
        const v = per[row.dataset.id] || 0;
        row.querySelector('.n').textContent = v ? hrs(v) : '–';
        row.querySelector('.n2').textContent = v ? hrs(v / 7) : '';
        row.querySelector('.p').textContent = v ? Math.round(v / total * 100) + '%' : '';
        row.querySelector('.bar i').style.width = (v / max) * 100 + '%';
      });
      const fr = total - used;
      free.innerHTML = `<span></span><span></span><span>Sin asignar</span><span class="n">${hrs(fr)}</span><span class="n2">${hrs(fr / 7)}</span><span class="p">${Math.round(fr / total * 100)}%</span>`;
      const sleep = sch.cats.find(c => c.id === 'dormir');
      const k = [];
      if (sleep) {
        const v = per[sleep.id] || 0, avg = v / 2 / 7, nights = perDay.map(p => (p[sleep.id] || 0) / 2);
        const lo = Math.min(...nights), hi = Math.max(...nights);
        k.push(`<div class="card kpi${v && avg < 7 ? ' warn' : ''}"><div class="l">${esc(sleep.name)} por día</div><div class="v">${v ? fmt(avg) : '–'}<small>h</small></div><div class="d">${v ? (lo === hi ? `${fmt(lo)} h todos los días` : `entre ${fmt(lo)} y ${fmt(hi)} h`) : 'Pinta tus horas de sueño'}</div></div>`);
      }
      const top = sch.cats.filter(c => c !== sleep && per[c.id]).sort((a, b) => per[b.id] - per[a.id])[0];
      k.push(top
        ? `<div class="card kpi"><div class="l">${esc(top.name)} en la semana</div><div class="v">${fmt(per[top.id] / 2)}<small>h</small></div><div class="d">${hrs(per[top.id] / 7)} al día</div></div>`
        : `<div class="card kpi"><div class="l">Horas pintadas</div><div class="v">${fmt(used / 2)}<small>/ 168 h</small></div><div class="d">7 días × 24 h</div></div>`);
      kpis.innerHTML = k.join('');
      renderDayHeads(perDay);
    }
    function renderDayHeads(perDay = scheduleCounts(sch).perDay) {
      grid.querySelectorAll('.dh').forEach(x => {
        const p = perDay[+x.dataset.d] || {}, sleep = p.dormir || 0, used = Object.values(p).reduce((a, b) => a + b, 0);
        x.querySelector('.sum').textContent = sleep ? `${hrs(sleep)} sueño` : used ? hrs(used) : '';
        x.querySelector('.stack').innerHTML = sch.cats.filter(c => p[c.id]).map(c => `<i style="width:${p[c.id] / SLOTS * 100}%;background:${c.color}" title="${esc(c.name)}: ${hrs(p[c.id])}"></i>`).join('');
      });
    }

    buildGrid(); paintGrid(); renderCats(); renderStats();
    requestAnimationFrame(placeNow);

    const onKey = e => {
      if (e.target.matches('input,textarea')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '0' || e.key.toLowerCase() === 'e') { setBrush(null); return; }
      const i = +e.key; if (i >= 1 && i <= 9 && sch.cats[i - 1]) setBrush(sch.cats[i - 1].id);
    };
    document.addEventListener('keydown', onKey);
    addEventListener('resize', placeNow);
    const t = setInterval(placeNow, 60000);
    return () => { document.removeEventListener('keydown', onKey); removeEventListener('resize', placeNow); clearInterval(t); };
  },
};
