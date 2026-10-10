import type { Editor } from '../../editor';
import { h } from '../../ui';
// Snap grid: on/off, size slider and presets. Grid lines are the lowest snap tier and set Shift+Arrow steps (5l).
export function gridPanel(ed: Editor): HTMLElement {
  const toggle = h('button', { type: 'button', className: 'switch', role: 'switch', 'aria-checked': 'false', title: 'Turn grid snapping on or off', 'aria-label': 'Snap to grid' });
  const value = h('span'), range = h('input', { type: 'range', min: 5, max: 200, step: 5, title: 'Distance between grid lines', 'aria-label': 'Grid size' });
  const presets = [10, 20, 40, 80].map(n => { const b = h('button', { type: 'button', 'aria-pressed': 'false' }, String(n)); b.addEventListener('click', () => ed.store.setUI({ grid: { on: true, size: n } })); return b; });
  toggle.addEventListener('click', () => ed.store.setUI({ grid: { ...ed.store.ui.grid, on: !ed.store.ui.grid.on } }));
  range.addEventListener('input', () => ed.store.setUI({ grid: { on: true, size: Number(range.value) } }));
  range.addEventListener('keydown', e => e.stopPropagation());
  const panel = h('div', { className: 'panel grid-panel', hidden: true, role: 'dialog', 'aria-label': 'Snap grid' },
    h('div', { className: 'row' }, h('span', {}, 'Snap to grid'), toggle), h('div', { className: 'row', style: 'font-size:12px' }, h('span', { className: 'muted' }, 'Grid size'), value), range, h('div', { className: 'presets' }, ...presets));
  ed.chrome.push({ update() {
    const g = ed.store.ui.grid; panel.hidden = ed.store.ui.panel !== 'grid'; panel.inert = panel.hidden;
    toggle.setAttribute('aria-checked', String(g.on)); value.textContent = `${g.size} units`;
    if (document.activeElement !== range) range.value = String(g.size);
    presets.forEach(b => b.setAttribute('aria-pressed', String(Number(b.textContent) === g.size)));
  } });
  return panel;
}
