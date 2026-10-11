import type { AlignMode } from '../../../core/arrange';
import type { Editor } from '../../editor';
import { h } from '../../ui';
// Arrange (D-063): align one block to the canvas or several to each other, and space three or more evenly.
const bar = (x: number, y: number, w: number, hh: number) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="1.5" fill="currentColor"/>`;
const line = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
const svg = (inner: string) => `<svg viewBox="0 0 22 22" aria-hidden="true">${inner}</svg>`;
export const ARRANGE_ICON = svg(line(3, 2, 3, 20) + bar(6, 5, 13, 4) + bar(6, 13, 8, 4));
const MODES: [AlignMode | 'spread-x' | 'spread-y', string, string][] = [
  ['left', 'Align left', svg(line(3, 2, 3, 20) + bar(6, 5, 13, 4) + bar(6, 13, 8, 4))],
  ['hcenter', 'Align centres', svg(line(11, 2, 11, 20) + bar(4, 5, 14, 4) + bar(6.5, 13, 9, 4))],
  ['right', 'Align right', svg(line(19, 2, 19, 20) + bar(3, 5, 13, 4) + bar(8, 13, 8, 4))],
  ['top', 'Align top', svg(line(2, 3, 20, 3) + bar(5, 6, 4, 13) + bar(13, 6, 4, 8))],
  ['vcenter', 'Align middles', svg(line(2, 11, 20, 11) + bar(5, 4, 4, 14) + bar(13, 6.5, 4, 9))],
  ['bottom', 'Align bottom', svg(line(2, 19, 20, 19) + bar(5, 3, 4, 13) + bar(13, 8, 4, 8))],
  ['spread-x', 'Space evenly across', svg(bar(2, 6, 4, 10) + bar(9, 6, 4, 10) + bar(16, 6, 4, 10))],
  ['spread-y', 'Space evenly down', svg(bar(6, 2, 10, 4) + bar(6, 9, 10, 4) + bar(6, 16, 10, 4))],
];
export function arrangePanel(ed: Editor): HTMLElement {
  const title = h('h3', {}, 'Align');
  const buttons = MODES.map(([mode, label, icon]) => { const b = h('button', { type: 'button', className: 'btn', title: label, 'aria-label': label, html: icon }); b.addEventListener('click', () => ed.arrange(mode)); return b; });
  const panel = h('div', { className: 'panel arrange-panel', hidden: true, role: 'dialog', 'aria-label': 'Arrange' }, title,
    h('div', { className: 'arrange-grid' }, ...buttons.slice(0, 6)), h('h3', {}, 'Space evenly'), h('div', { className: 'arrange-grid' }, ...buttons.slice(6)));
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'arrange';
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    const n = ed.selected().filter(x => !x.locked).length;
    title.textContent = n > 1 ? 'Align to each other' : 'Align to the canvas';
    buttons.forEach((b, i) => { b.disabled = !n || i >= 6 && n < 3; b.classList.toggle('faded', b.disabled); });
  } });
  return panel;
}
