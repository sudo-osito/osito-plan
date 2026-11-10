// Respaldo: exportar todo a un archivo e importarlo (también el archivo de «Mi semana»).
import { h, I, toast } from './ui.js';
import { S, exportData, importData } from './store.js';

let onImported = () => {};
export const setOnImported = fn => { onImported = fn; };

export function doExport() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
  a.download = `osito-plan-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  refreshBackupStatus();
  toast('Respaldo descargado');
}

const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
document.body.append(fileInput);
fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0]; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (o.app === 'organizador' && !confirm('Este respaldo reemplaza todo lo que tienes ahora en Osito Plan. ¿Seguir?')) return;
    const r = importData(o);
    onImported();
    toast(r.mode === 'replace' ? 'Respaldo restaurado' : `Listo: ${r.count} horario${r.count === 1 ? '' : 's'} importado${r.count === 1 ? '' : 's'}`);
  } catch (e) {
    alert('Ese archivo no es un respaldo válido de Osito Plan ni de «Mi semana».');
  } finally { fileInput.value = ''; }
});
export const doImport = () => fileInput.click();

export function backupStatusText() {
  const t = S.ui.lastBackup;
  if (!t) return 'Sin respaldo todavía';
  const days = Math.floor((Date.now() - t) / 864e5);
  return days === 0 ? 'Respaldo de hoy' : days === 1 ? 'Respaldo de ayer' : `Último respaldo hace ${days} días`;
}
const statusEls = new Set();
export function refreshBackupStatus() {
  const stale = !S.ui.lastBackup || Date.now() - S.ui.lastBackup > 14 * 864e5;
  for (const el of statusEls) {
    if (!el.isConnected && el.dataset.shown) { statusEls.delete(el); continue; }   // ya se mostró y salió de la pantalla
    if (el.isConnected) el.dataset.shown = '1';
    el.textContent = backupStatusText(); el.classList.toggle('stale', stale);
  }
}
export function backupBlock() {
  const st = h('div', { class: 'bk-status' });
  statusEls.add(st);
  const el = h('div', { class: 'backup' },
    h('div', { class: 'bk-title' }, 'Tus datos viven en este navegador'),
    st,
    h('div', { class: 'bk-btns' },
      h('button', { class: 'btn sm', onclick: doExport, title: 'Descarga un archivo con todo' }, 'Respaldar'),
      h('button', { class: 'btn sm', onclick: doImport, title: 'Restaurar un respaldo o traer el archivo de «Mi semana»' }, 'Importar')));
  refreshBackupStatus();
  return el;
}
