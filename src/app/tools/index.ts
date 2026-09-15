import { shapeIcons } from '../canvas/shapes';
import { shortcutLabel } from './shortcuts';
import { shapeKinds, type ShapeKind, type DocNode, type TextNode } from '../../core/document';
export const icons = {
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  rect: '<rect x="5" y="5" width="14" height="14"/>',
  image: '<rect x="3" y="4" width="18" height="16"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 4"/>',
  delete: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  align: '<path d="M3 5h18M3 10h12M3 15h18M3 20h12"/>',
  paragraph: '<path d="M14 21V3h4v18M14 3H9a5 5 0 0 0 0 10h5"/>',
};
export function button(label: string, icon: string, action: () => void): HTMLButtonElement {
  const el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', label); el.title = label;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square">${icon}</svg>`;
  el.onclick = action; return el;
}
type Actions = { addText(): void; addRect(): void; addShape(shape: ShapeKind): void; toggleLock(): void; duplicate(): void; mac: boolean; addImage(): void; delete(): void; export(): void; update(): void; selected(): DocNode | undefined; };
export function toolbar(host: HTMLElement, actions: Actions): { refresh(): void; exportButton: HTMLButtonElement } {
  host.className = 'toolbar'; host.setAttribute('role', 'toolbar'); host.setAttribute('aria-label', 'Document tools');
  host.append(button('Add text', icons.text, actions.addText), button('Add rectangle', icons.rect, actions.addRect), button('Add image', icons.image, actions.addImage));
  const shapePanel = document.createElement('div'); shapePanel.className = 'tool-panel shape-library'; shapePanel.hidden = true; shapePanel.setAttribute('role', 'group'); shapePanel.setAttribute('aria-label', 'Shape library');
  const shapes = button('Shape library', '<circle cx="8" cy="8" r="5"/><path d="m15 10 7 11H8Z"/>', () => { shapePanel.hidden = !shapePanel.hidden; shapes.setAttribute('aria-expanded', String(!shapePanel.hidden)); if (!shapePanel.hidden) shapePanel.querySelector('button')?.focus(); });
  shapes.setAttribute('aria-expanded', 'false'); host.insertBefore(shapes, host.children[2]); host.append(shapePanel);
  for (const shape of shapeKinds) {
    const item = button(`Add ${shape}`, shapeIcons[shape], () => { actions.addShape(shape); shapePanel.hidden = true; shapes.setAttribute('aria-expanded', 'false'); shapes.focus(); });
    const label = document.createElement('span'); label.textContent = shape[0].toUpperCase() + shape.slice(1); item.append(label); shapePanel.append(item);
  }
  const dismiss = () => { shapePanel.hidden = true; shapes.setAttribute('aria-expanded', 'false'); };
  document.addEventListener('pointerdown', e => { if (e.target instanceof Node && !shapePanel.contains(e.target) && !shapes.contains(e.target)) dismiss(); });
  host.addEventListener('keydown', e => { if (e.key === 'Escape' && !shapePanel.hidden) { e.stopPropagation(); dismiss(); shapes.focus(); } });
  const sep = () => { const s = document.createElement('span'); s.className = 'separator'; host.append(s); }; sep();
  const colour = document.createElement('input'); colour.type = 'color'; colour.setAttribute('aria-label', 'Object colour'); colour.title = 'Colour';
  colour.oninput = () => { const n = actions.selected(); if (!n || n.locked) return; if (n.type === 'rect') n.fill = colour.value; if (n.type === 'text') n.color = colour.value; actions.update(); }; host.append(colour);
  const hex = document.createElement('input'); hex.type = 'text'; hex.className = 'hex-colour'; hex.maxLength = 7; hex.setAttribute('aria-label', 'Hex colour'); hex.spellcheck = false;
  hex.oninput = () => hex.setCustomValidity('');
  hex.onchange = () => {
    const value = '#' + hex.value.trim().replace(/^#/, '');
    if (!/^#[0-9a-f]{6}$/i.test(value)) { hex.setCustomValidity('Enter a six-digit hex colour, such as #336699.'); hex.reportValidity(); return; }
    const n = actions.selected(); if (!n || n.locked) return;
    if (n.type === 'rect') n.fill = value.toLowerCase(); if (n.type === 'text') n.color = value.toLowerCase(); actions.update();
  }; host.append(hex);
  const font = document.createElement('input'); font.type = 'number'; font.min = '1'; font.max = '500'; font.setAttribute('aria-label', 'Font size'); font.title = 'Font size';
  font.onchange = () => { const n = actions.selected(); if (n?.type === 'text' && !n.locked) n.fontSize = Math.max(1, Math.min(500, Number(font.value) || 40)); actions.update(); }; host.append(font);
  const weight = button('Bold', '<path stroke-width="2" d="M7 4h6a4 4 0 0 1 0 8H7V4Zm0 8h7a4 4 0 0 1 0 8H7v-8Z"/>', () => { const n = actions.selected(); if (n?.type === 'text' && !n.locked) { n.weight = n.weight === 400 ? 700 : 400; actions.update(); } }); host.append(weight);
  const align = button('Text alignment', icons.align, () => { const n = actions.selected(); if (n?.type === 'text' && !n.locked) { const values: TextNode['align'][] = ['left', 'center', 'right']; n.align = values[(values.indexOf(n.align) + 1) % 3]; actions.update(); } }); host.append(align); sep();
  const duplicate = button('Duplicate selected object', '<rect x="8" y="8" width="13" height="13"/><path d="M16 8V3H3v13h5"/>', actions.duplicate); host.append(duplicate);
  const lock = button('Lock selected object', '<rect x="5" y="10" width="14" height="11"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>', actions.toggleLock); host.append(lock);
  const del = button('Delete selected object', icons.delete, actions.delete); host.append(del); sep();
  const exp = button('Export PNG and JSON', icons.export, actions.export); host.append(exp);
  const help = document.createElement('div'); help.className = 'tool-panel shortcut-help'; help.hidden = true; help.setAttribute('role', 'group'); help.setAttribute('aria-label', 'Keyboard shortcuts');
  const helpButton = button('Keyboard shortcuts', '<rect x="2" y="5" width="20" height="14"/><path d="M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M7 16h10"/>', () => { help.hidden = !help.hidden; helpButton.setAttribute('aria-expanded', String(!help.hidden)); });
  helpButton.setAttribute('aria-expanded', 'false'); host.append(helpButton, help);
  for (const [name, keys] of [['Duplicate', 'Mod+D'], ['Lock / unlock', 'Mod+Shift+L'], ['Bold text', 'Mod+B'], ['Export PNG + JSON', 'Mod+Shift+E'], ['Move', 'Arrow keys'], ['Move 10 units', 'Shift+Arrow keys'], ['Constrain drag / corner resize', 'Shift+Drag'], ['Delete', 'Backspace / Delete'], ['Edit text', 'Enter'], ['Finish editing', 'Mod+Enter'], ['Deselect / close', 'Escape']]) {
    const row = document.createElement('div'), key = document.createElement('kbd'); row.textContent = name; key.textContent = shortcutLabel(keys, actions.mac); row.append(key); help.append(row);
  }
  host.addEventListener('keydown', e => { if (e.key === 'Escape' && !help.hidden) { e.stopPropagation(); help.hidden = true; helpButton.setAttribute('aria-expanded', 'false'); helpButton.focus(); } });
  document.addEventListener('pointerdown', e => { if (e.target instanceof Node && !help.contains(e.target) && !helpButton.contains(e.target)) { help.hidden = true; helpButton.setAttribute('aria-expanded', 'false'); } });
  for (const [control, keys] of [[duplicate, 'Mod+D'], [lock, 'Mod+Shift+L'], [weight, 'Mod+B'], [exp, 'Mod+Shift+E']] as const) control.title += ` (${shortcutLabel(keys, actions.mac)})`;
  return { exportButton: exp, refresh() {
    const n = actions.selected(); colour.disabled = hex.disabled = !n || n.type === 'image' || !!n.locked; colour.value = n?.type === 'rect' ? n.fill : n?.type === 'text' ? n.color : '#000000';
    if (document.activeElement !== hex) { hex.value = colour.value; hex.setCustomValidity(''); }
    lock.disabled = !n; lock.setAttribute('aria-pressed', String(!!n?.locked)); lock.setAttribute('aria-label', n?.locked ? 'Unlock selected object' : 'Lock selected object'); lock.title = `${n?.locked ? 'Unlock' : 'Lock'} selected object (${shortcutLabel('Mod+Shift+L', actions.mac)})`;
    duplicate.disabled = !n || !!n.locked;
    font.disabled = weight.disabled = align.disabled = n?.type !== 'text' || !!n.locked; font.value = n?.type === 'text' ? String(n.fontSize) : '—';
    weight.setAttribute('aria-pressed', String(n?.type === 'text' && n.weight === 700));
    align.setAttribute('aria-label', `Text alignment: ${n?.type === 'text' ? n.align : 'left'}`);
    align.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 5h18M${n?.type === 'text' && n.align === 'center' ? 6 : n?.type === 'text' && n.align === 'right' ? 9 : 3} 10h12M3 15h18M${n?.type === 'text' && n.align === 'center' ? 6 : n?.type === 'text' && n.align === 'right' ? 9 : 3} 20h12"/></svg>`;
    del.disabled = !n || !!n.locked;
  } };
}
