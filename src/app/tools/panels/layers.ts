import type { Editor } from '../../editor';
import { layerName } from '../../editor';
import { h, ICON } from '../../ui';
// Layers: every object top first; select (Shift adds), bring forward, send backward, hide in this size, lock.
export function layersPanel(ed: Editor): HTMLElement {
  const list = h('div', { style: 'display:flex;flex-direction:column;gap:2px' });
  const panel = h('div', { className: 'panel layers-panel', hidden: true, role: 'dialog', 'aria-label': 'Layers' }, h('h3', { style: 'padding:4px 8px 6px' }, 'Top of the stack first'), list);
  let built = '';
  const mini = (label: string, icon: string, on: boolean, go: () => void) => { const b = h('button', { type: 'button', title: label, 'aria-label': label, className: on ? '' : 'off', html: icon }); b.addEventListener('click', e => { e.stopPropagation(); go(); }); return b; };
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'layers';
    panel.hidden = !open; panel.style.maxHeight = `${window.innerHeight - 160}px`;
    if (!open) return;
    const doc = ed.doc, sel = new Set(ed.store.ui.sel), key = JSON.stringify([doc.nodes.map(n => [n.id, layerName(n), n.locked, ed.frame(n).hidden, n.kind !== 'image' && ed.colour(n.fill)]), [...sel]]);
    if (key === built) return;
    built = key;
    if (!doc.nodes.length) { list.replaceChildren(h('div', { className: 'muted', style: 'font-size:12px;padding:8px' }, 'Nothing on the canvas yet')); return; }
    list.replaceChildren(...[...doc.nodes].reverse().map((n, ri) => {
      const i = doc.nodes.length - 1 - ri, hidden = !!ed.frame(n).hidden, row = h('div', { className: `layer${sel.has(n.id) ? ' on' : ''}`, role: 'button', tabindex: 0 },
        h('span', { className: 'chip', style: `background:${n.kind === 'image' ? 'rgba(156,171,194,.35)' : ed.colour(n.fill)}` }),
        h('span', { className: 'name', style: hidden ? 'opacity:.45' : '' }, layerName(n)),
        mini('Bring forward', ICON.up, i < doc.nodes.length - 1, () => ed.reorder('forward', [n.id])),
        mini('Send backward', ICON.down, i > 0, () => ed.reorder('backward', [n.id])),
        mini(hidden ? 'Show' : 'Hide', ICON.eye, !hidden, () => ed.setHidden(n.id, !hidden)),
        mini(n.locked ? 'Unlock' : 'Lock', ICON.padlock, !!n.locked, () => ed.setLock(n.id, !n.locked)));
      const pick = (shift: boolean) => ed.select(shift ? (sel.has(n.id) ? [...sel].filter(x => x !== n.id) : [...sel, n.id]) : [n.id]);
      row.addEventListener('click', e => pick(e.shiftKey));
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e.shiftKey); } });
      return row;
    }));
  } });
  return panel;
}
