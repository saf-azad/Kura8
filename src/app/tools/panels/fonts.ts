import { FONTS, fontById } from '../../../core/fonts';
import type { Editor } from '../../editor';
import { h } from '../../ui';
// Typefaces (D-049): each face named in itself; a click sets it on the selected text. All OFL-1.1, from this origin.
export function fontsPanel(ed: Editor): HTMLElement {
  const list = h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, ...FONTS.map(f => {
    const b = h('button', { type: 'button', className: 'font-choice', 'data-font': f.id, 'aria-pressed': 'false', style: `font-family:"${f.family}",${f.fallback}` },
      h('span', { className: 'sample' }, 'Aa'), h('span', {}, f.name), f.weights.length < 2 ? h('span', { className: 'muted', style: 'font:11px "Space Grotesk",system-ui,sans-serif;margin-left:auto' }, 'one weight') : null);
    b.addEventListener('click', () => void ed.setFont(f.id));
    return b;
  }));
  const panel = h('div', { className: 'panel fonts-panel', hidden: true, role: 'dialog', 'aria-label': 'Typeface' }, h('h3', {}, 'Typeface'), list,
    h('div', { className: 'icon-note' }, 'Open Font Licence faces, embedded in SVG exports.'));
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'fonts';
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    const one = ed.one(), current = one?.kind === 'text' ? fontById(one.font).id : null;
    list.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.font === current)));
  } });
  return panel;
}
