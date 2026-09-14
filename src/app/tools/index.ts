import type { DocNode, TextNode } from '../../core/document';
export const icons = {
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  rect: '<rect x="5" y="5" width="14" height="14"/>',
  image: '<rect x="3" y="4" width="18" height="16"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 4"/>',
  delete: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  align: '<path d="M3 5h18M3 10h12M3 15h18M3 20h12"/>',
  paragraph: '<path d="M14 21V3h4v18M14 3H9a5 5 0 0 0 0 10h5"/>',
  background: '<rect x="3" y="4" width="18" height="16" stroke-dasharray="2 2"/><path d="m4 18 6-6 4 4 3-3 4 4"/><circle cx="8" cy="9" r="1.5"/>',
};
export function button(label: string, icon: string, action: () => void): HTMLButtonElement {
  const el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', label); el.title = label;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="square">${icon}</svg>`;
  el.onclick = action; return el;
}
type Actions = { addText(): void; addRect(): void; addImage(): void; removeBackground(): void; delete(): void; export(): void; update(): void; selected(): DocNode | undefined; };
export function toolbar(host: HTMLElement, actions: Actions): { refresh(): void; exportButton: HTMLButtonElement; backgroundButton: HTMLButtonElement } {
  host.className = 'toolbar'; host.setAttribute('role', 'toolbar'); host.setAttribute('aria-label', 'Document tools');
  host.append(button('Add text', icons.text, actions.addText), button('Add rectangle', icons.rect, actions.addRect), button('Add image', icons.image, actions.addImage));
  const sep = () => { const s = document.createElement('span'); s.className = 'separator'; host.append(s); }; sep();
  const colour = document.createElement('input'); colour.type = 'color'; colour.setAttribute('aria-label', 'Object colour'); colour.title = 'Colour';
  colour.oninput = () => { const n = actions.selected(); if (n?.type === 'rect') n.fill = colour.value; if (n?.type === 'text') n.color = colour.value; actions.update(); }; host.append(colour);
  const font = document.createElement('input'); font.type = 'number'; font.min = '1'; font.max = '500'; font.setAttribute('aria-label', 'Font size'); font.title = 'Font size';
  font.onchange = () => { const n = actions.selected(); if (n?.type === 'text') n.fontSize = Math.max(1, Math.min(500, Number(font.value) || 40)); actions.update(); }; host.append(font);
  const weight = button('Bold', '<path stroke-width="2" d="M7 4h6a4 4 0 0 1 0 8H7V4Zm0 8h7a4 4 0 0 1 0 8H7v-8Z"/>', () => { const n = actions.selected(); if (n?.type === 'text') { n.weight = n.weight === 400 ? 700 : 400; actions.update(); } }); host.append(weight);
  const align = button('Text alignment', icons.align, () => { const n = actions.selected(); if (n?.type === 'text') { const values: TextNode['align'][] = ['left', 'center', 'right']; n.align = values[(values.indexOf(n.align) + 1) % 3]; actions.update(); } }); host.append(align);
  const background = button('Remove image background', icons.background, actions.removeBackground); background.className = 'background'; host.append(background); sep();
  const del = button('Delete selected object', icons.delete, actions.delete); host.append(del); sep();
  const exp = button('Export PNG and JSON', icons.export, actions.export); host.append(exp);
  return { exportButton: exp, backgroundButton: background, refresh() {
    const n = actions.selected(); colour.disabled = !n || n.type === 'image'; colour.value = n?.type === 'rect' ? n.fill : n?.type === 'text' ? n.color : '#000000';
    font.disabled = weight.disabled = align.disabled = n?.type !== 'text'; font.value = n?.type === 'text' ? String(n.fontSize) : '—';
    weight.setAttribute('aria-pressed', String(n?.type === 'text' && n.weight === 700));
    align.setAttribute('aria-label', `Text alignment: ${n?.type === 'text' ? n.align : 'left'}`);
    align.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 5h18M${n?.type === 'text' && n.align === 'center' ? 6 : n?.type === 'text' && n.align === 'right' ? 9 : 3} 10h12M3 15h18M${n?.type === 'text' && n.align === 'center' ? 6 : n?.type === 'text' && n.align === 'right' ? 9 : 3} 20h12"/></svg>`;
    background.disabled = n?.type !== 'image' || background.getAttribute('aria-busy') === 'true';
    del.disabled = !n;
  } };
}
