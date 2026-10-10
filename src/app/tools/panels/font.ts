import type { TextNode } from '../../../core/document';
import { FONTS } from '../../../core/script';
import { LINE_HEIGHT } from '../../../core/fit';
import type { Editor } from '../../editor';
import { h, slider } from '../../ui';
// Font (D-045): six OFL faces served from the app, italic, underline, uppercase, letter spacing and line spacing.
export function fontPanel(ed: Editor): HTMLElement {
  const texts = () => ed.selected().filter((n): n is TextNode => n.kind === 'text' && !n.locked);
  const list = h('div', { className: 'fonts' }, ...FONTS.map(f => {
    const b = h('button', { type: 'button', 'aria-label': f.name, 'aria-pressed': 'false', 'data-font': f.id, style: `font-family:${f.family}, ${f.generic}` }, f.name);
    b.addEventListener('click', () => ed.setFont(f.id)); return b;
  }));
  const flag = (key: 'italic' | 'underline' | 'upper', label: string, glyph: string, css: string) => {
    const b = h('button', { type: 'button', className: 'btn', 'aria-label': label, title: label, 'aria-pressed': 'false', style: css }, glyph);
    b.addEventListener('click', () => ed.toggleText(key)); return { key, b };
  };
  const flags = [flag('italic', 'Italic', 'I', 'font-style:italic;font-family:serif;font-size:18px'), flag('underline', 'Underline', 'U', 'text-decoration:underline;font-size:16px'), flag('upper', 'Uppercase', 'AA', 'font-size:13px')];
  const spacing = slider('Letter spacing', { min: -200, max: 800, step: 10, set: v => ed.setSpacing(v) });
  const leading = slider('Line spacing', { min: .8, max: 3, step: .05, format: v => v.toFixed(2), set: v => ed.setLeading(v) });
  const panel = h('div', { className: 'panel font-panel', hidden: true, role: 'dialog', 'aria-label': 'Font' },
    h('h3', {}, 'Font'), list, h('div', { className: 'actions' }, ...flags.map(f => f.b)), spacing.el, leading.el, h('div', { className: 'icon-note' }, 'Fonts are open source (SIL Open Font Licence) and come with Kura8.'));
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'font', all = texts(), n = all[0];
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    panel.classList.toggle('faded', !n);
    if (!n) return;
    list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.font === (n.font ?? 'space-grotesk'))));
    for (const f of flags) f.b.setAttribute('aria-pressed', String(all.every(x => x[f.key])));
    spacing.show(n.spacing ?? 0); leading.show(n.leading ?? LINE_HEIGHT);
  } });
  return panel;
}
