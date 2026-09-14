import type { DocNode, TextNode } from '../../core/document';
import { fonts, type FontId } from '../../core/fonts';
import { shapes, shapeOutline, type ShapeId } from '../../core/shapes';
export const icons = {
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  rect: '<rect x="5" y="5" width="14" height="14"/>',
  image: '<rect x="3" y="4" width="18" height="16"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 4"/>',
  delete: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  align: '<path d="M3 5h18M3 10h12M3 15h18M3 20h12"/>',
  paragraph: '<path d="M14 21V3h4v18M14 3H9a5 5 0 0 0 0 10h5"/>',
};
/** Monochrome 24-unit icon drawn from the shape's own outline, so icon and canvas always agree. */
export function shapeIcon(id: ShapeId): string {
  const outline = shapeOutline(id, { x: 4, y: 4, w: 16, h: 16 });
  if (!outline) return '<ellipse cx="12" cy="12" rx="8" ry="8"/>';
  return `<path d="${outline.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}Z"/>`;
}
export function button(label: string, icon: string, action: () => void): HTMLButtonElement {
  const el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', label); el.title = label;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square">${icon}</svg>`;
  el.onclick = action; return el;
}
type Actions = { addText(): void; addShape(shape: ShapeId): void; addImage(): void; delete(): void; export(): void; update(): void; selected(): DocNode | undefined; };
export function toolbar(host: HTMLElement, actions: Actions): { refresh(): void; exportButton: HTMLButtonElement } {
  host.className = 'toolbar'; host.setAttribute('role', 'toolbar'); host.setAttribute('aria-label', 'Document tools');
  host.append(button('Add text', icons.text, actions.addText));
  // Shape picker: one button opens a flat panel of the shape library; choosing a shape adds it and closes the panel.
  const shapeHost = document.createElement('div'); shapeHost.className = 'shape-picker';
  const panel = document.createElement('div'); panel.className = 'shape-panel'; panel.hidden = true; panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', 'Shapes');
  const openShapes = button('Add shape', icons.rect, () => { panel.hidden = !panel.hidden; openShapes.setAttribute('aria-expanded', String(!panel.hidden)); });
  openShapes.setAttribute('aria-haspopup', 'menu'); openShapes.setAttribute('aria-expanded', 'false');
  for (const shape of shapes) {
    const b = button(`Add ${shape.name.toLowerCase()}`, shapeIcon(shape.id), () => { panel.hidden = true; openShapes.setAttribute('aria-expanded', 'false'); actions.addShape(shape.id); });
    b.setAttribute('role', 'menuitem'); b.dataset.shape = shape.id; panel.append(b);
  }
  shapeHost.append(openShapes, panel); host.append(shapeHost);
  document.addEventListener('pointerdown', e => { if (!panel.hidden && !shapeHost.contains(e.target as Node)) { panel.hidden = true; openShapes.setAttribute('aria-expanded', 'false'); } });
  host.append(button('Add image', icons.image, actions.addImage));
  const sep = () => { const s = document.createElement('span'); s.className = 'separator'; host.append(s); }; sep();
  const colour = document.createElement('input'); colour.type = 'color'; colour.setAttribute('aria-label', 'Object colour'); colour.title = 'Colour';
  colour.oninput = () => { const n = actions.selected(); if (n?.type === 'rect') n.fill = colour.value; if (n?.type === 'text') n.color = colour.value; actions.update(); }; host.append(colour);
  const family = document.createElement('select'); family.setAttribute('aria-label', 'Typeface'); family.title = 'Typeface';
  for (const f of fonts) { const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; o.style.fontFamily = `"${f.name}"`; family.append(o); }
  family.onchange = () => { const n = actions.selected(); if (n?.type === 'text') n.font = family.value as FontId; actions.update(); };
  host.append(family);
  const font = document.createElement('input'); font.type = 'number'; font.min = '1'; font.max = '500'; font.setAttribute('aria-label', 'Font size'); font.title = 'Font size';
  font.onchange = () => { const n = actions.selected(); if (n?.type === 'text') n.fontSize = Math.max(1, Math.min(500, Number(font.value) || 40)); actions.update(); }; host.append(font);
  const weight = button('Bold', '<path stroke-width="2" d="M7 4h6a4 4 0 0 1 0 8H7V4Zm0 8h7a4 4 0 0 1 0 8H7v-8Z"/>', () => { const n = actions.selected(); if (n?.type === 'text') { n.weight = n.weight === 400 ? 700 : 400; actions.update(); } }); host.append(weight);
  const align = button('Text alignment', icons.align, () => { const n = actions.selected(); if (n?.type === 'text') { const values: TextNode['align'][] = ['left', 'center', 'right']; n.align = values[(values.indexOf(n.align) + 1) % 3]; actions.update(); } }); host.append(align); sep();
  const del = button('Delete selected object', icons.delete, actions.delete); host.append(del); sep();
  const exp = button('Export PNG and JSON', icons.export, actions.export); host.append(exp);
  return { exportButton: exp, refresh() {
    const n = actions.selected(); colour.disabled = !n || n.type === 'image'; colour.value = n?.type === 'rect' ? n.fill : n?.type === 'text' ? n.color : '#000000';
    font.disabled = family.disabled = weight.disabled = align.disabled = n?.type !== 'text';
    if (n?.type === 'text') family.value = n.font; font.value = n?.type === 'text' ? String(n.fontSize) : '—';
    weight.setAttribute('aria-pressed', String(n?.type === 'text' && n.weight === 700));
    align.setAttribute('aria-label', `Text alignment: ${n?.type === 'text' ? n.align : 'left'}`);
    align.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 5h18M${n?.type === 'text' && n.align === 'center' ? 6 : n?.type === 'text' && n.align === 'right' ? 9 : 3} 10h12M3 15h18M${n?.type === 'text' && n.align === 'center' ? 6 : n?.type === 'text' && n.align === 'right' ? 9 : 3} 20h12"/></svg>`;
    del.disabled = !n;
  } };
}
