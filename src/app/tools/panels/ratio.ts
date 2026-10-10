import { ratios, ratioNumbers, canvasSize, exportSize } from '../../../core/ratios';
import { ringPath } from '../../../core/dial';
import type { RatioId } from '../../../core/document';
import type { Editor } from '../../editor';
import { h } from '../../ui';
// Change ratio converts the active size and flags what no longer fits (5v); in add mode the same wheel adds a
// linked size (5w). A size can be removed while another remains.
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag: string, attrs: Record<string, string | number>) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };
export function ratioPanel(ed: Editor): HTMLElement {
  const wheel = svg('svg', { width: 260, height: 260, viewBox: '0 0 260 260', role: 'group', 'aria-label': 'Ratios' }) as SVGSVGElement;
  const name = h('div', { style: 'font-size:20px' }), sub = h('div', { className: 'muted', style: 'font-size:11px' }), px = h('div', { className: 'muted', style: 'font-size:11px' });
  const label = h('div', { className: 'mini-label' }, name, sub, px);
  const heading = h('div', { style: 'font-size:12px;align-self:stretch;display:flex;justify-content:space-between;align-items:center;gap:8px' });
  const remove = h('button', { type: 'button', className: 'pill', style: 'height:32px', title: 'Remove this size' }, 'Remove size');
  remove.addEventListener('click', () => { ed.removeSize(ed.sizeId); ed.openPanel(null); });
  const panel = h('div', { className: 'panel ratio-panel', hidden: true, role: 'dialog', 'aria-label': 'Ratio' }, heading, h('div', { style: 'position:relative;width:260px;height:260px' }, wheel, label), remove);
  let hover: RatioId | null = null, built = '';
  const show = (id: RatioId) => { const r = ratios.find(x => x.id === id)!, e = exportSize(id, { scale: 1 }); name.textContent = ratioNumbers(id); sub.textContent = r.label; px.textContent = `${e.w} × ${e.h} px`; };
  ed.chrome.push({ update() {
    const ui = ed.store.ui, open = ui.panel === 'ratio';
    panel.hidden = !open;
    if (!open) return;
    const current = ed.spec().ratio, add = ui.ratioMode === 'add', key = `${current}|${add}|${hover}|${ed.doc.sizes.length}`;
    heading.replaceChildren(h('span', { className: 'muted' }, add ? 'Add a linked size' : 'Change this size'));
    remove.classList.toggle('hidden', add || ed.doc.sizes.length < 2);
    show(hover ?? current);
    if (key === built) return;
    built = key;
    wheel.replaceChildren(svg('path', { d: 'M124 -8H136L130 0Z', fill: '#000' }));
    ratios.forEach((r, i) => {
      const { d, c } = ringPath(130, 130, 126, 86, i, ratios.length), on = !add && r.id === current, c0 = canvasSize(r.id), k = 22 / Math.max(c0.w, c0.h);
      const g = svg('g', { role: 'button', tabindex: 0, 'aria-label': `${add ? 'Add' : 'Change to'} ${r.label} ${ratioNumbers(r.id)}`, style: 'cursor:pointer' });
      g.append(svg('path', { d, fill: on ? '#000' : hover === r.id ? 'rgba(156,171,194,.15)' : 'rgba(236,240,243,0)', stroke: '#000', 'stroke-width': 2 }));
      g.append(svg('rect', { x: c[0] - c0.w * k / 2, y: c[1] - c0.h * k / 2, width: c0.w * k, height: c0.h * k, fill: 'none', stroke: on ? '#fff' : '#000', 'stroke-width': 2 }));
      const go = () => { if (add) { ed.addSize(r.id); ed.openPanel(null); } else ed.changeRatio(r.id); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      g.addEventListener('pointerenter', () => { hover = r.id; ed.invalidate(); });
      g.addEventListener('pointerleave', () => { hover = null; ed.invalidate(); });
      wheel.append(g);
    });
    wheel.append(svg('circle', { cx: 130, cy: 130, r: 80, fill: '#ECF0F3', stroke: '#000', 'stroke-width': 2 }));
  } });
  return panel;
}
