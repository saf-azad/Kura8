import { shapeGroups, shapeLibrary, shapeOutline } from '../../../core/shapes';
import type { Editor } from '../../editor';
import { title } from '../../editor';
import { h, toast } from '../../ui';
import { findIcons, iconPath } from './icons';
// Shapes and icons (5s–5u): the 41 library shapes and a search over the Phosphor fill set (MIT). Search matches
// synonyms; an empty result shows the nearest category. Every icon carries its licence onto the node.
const preview = (d: string, w: number, h2: number, scale?: [number, number]) => `<svg width="${w}" height="${h2}" viewBox="0 0 ${w} ${h2}" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd"${scale ? ` transform="scale(${scale[0]} ${scale[1]})"` : ''} d="${d}"/></svg>`;
export function shapesPanel(ed: Editor): HTMLElement {
  const search = h('input', { className: 'field search', placeholder: 'Search icons', title: 'Search icons', 'aria-label': 'Search icons', spellcheck: 'false' });
  const groups = shapeGroups.map(g => h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, h('h3', {}, g.name), h('div', { className: 'shape-grid' }, ...g.keys.map(key => {
    const def = shapeLibrary[key], w = Math.max(3, def.ar >= 1 ? 28 : 28 * def.ar), hh = Math.max(3, def.ar >= 1 ? 28 / def.ar : 28), o = shapeOutline(def, w, hh);
    const b = h('button', { type: 'button', title: def.name, 'aria-label': def.name, html: preview(o.d, w, hh, o.scale) });
    b.addEventListener('click', () => ed.addShape(key));
    return b;
  }))));
  const iconTitle = h('h3', {}, 'Icons'), iconGrid = h('div', { className: 'shape-grid' }), note = h('div', { className: 'icon-note' }, 'Phosphor icons, MIT licence. The licence travels into SVG exports.');
  const panel = h('div', { className: 'panel shapes-panel', hidden: true, role: 'dialog', 'aria-label': 'Shapes and icons' }, search, ...groups, h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, iconTitle, iconGrid, note));
  let query = '', ticket = 0;
  async function show(): Promise<void> {
    const mine = ++ticket, result = await findIcons(query);
    if (mine !== ticket) return;
    if (!result) { iconTitle.textContent = 'Icons'; iconGrid.replaceChildren(h('span', { className: 'icon-note' }, 'Icons are not available in this build.')); return; }
    const q = query.trim();
    iconTitle.textContent = !q ? 'Icons' : result.category ? `Nothing for “${q}”. Nearest: ${title(result.category)}` : `Icons matching “${q}”`;
    iconGrid.replaceChildren(...result.names.map(name => {
      const b = h('button', { type: 'button', title: title(name), 'aria-label': title(name) }, h('span', { style: 'width:20px;height:20px;border-radius:6px;background:rgba(156,171,194,.35)' }));
      void iconPath(name).then(p => { if (p) b.innerHTML = preview(p.d, 28, 28, [.28, .28]); });
      b.addEventListener('click', async () => { const p = await iconPath(name); if (p) ed.addIcon(name, p.d, p.flattened); else toast('That icon is missing'); });
      return b;
    }));
  }
  search.addEventListener('input', () => { query = search.value; void show(); });
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); if (search.value) { search.value = ''; query = ''; void show(); } else ed.openPanel(null); } });
  let shown = false;
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'shapes';
    panel.hidden = !open; panel.inert = !open;
    panel.style.maxHeight = `${window.innerHeight - 120}px`;
    if (open && !shown) void show();
    shown = open;
  } });
  return panel;
}
