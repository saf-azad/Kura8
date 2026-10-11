import { FONTS, fontById, lacks } from '../../../core/fonts';
import type { FontId } from '../../../core/document';
import type { Editor } from '../../editor';
import { h } from '../../ui';
// Typefaces (D-049): each face named in itself; a click sets it on the selected text. All OFL-1.1, from this origin.
export function fontsPanel(ed: Editor): HTMLElement {
  const list = h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, ...FONTS.map(f => {
    const b = h('button', { type: 'button', className: 'font-choice', 'data-font': f.id, 'aria-pressed': 'false', style: `font-family:"${f.family}",${f.fallback}` },
      h('span', { className: 'sample' }, 'Aa'), h('span', {}, f.name), h('span', { className: 'muted lack', style: 'font:11px "Space Grotesk",system-ui,sans-serif;margin-left:auto' }, f.weights.length < 2 ? 'one weight' : ''));
    b.addEventListener('click', () => void ed.setFont(f.id));
    return b;
  }));
  const script = h('div', { className: 'icon-note hidden' });
  const panel = h('div', { className: 'panel fonts-panel', hidden: true, role: 'dialog', 'aria-label': 'Typeface' }, h('h3', {}, 'Typeface'), list, script,
    h('div', { className: 'icon-note' }, 'Open Font Licence faces, embedded in SVG exports.'));
  // Scripts none of the faces draw, found anywhere in the text (a Latin line with a Devanagari one counts, D-077).
  const NONE: [string, RegExp][] = [['Chinese', /\p{Script=Han}/u], ['Japanese', /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ['Korean', /\p{Script=Hangul}/u], ['Arabic', /\p{Script=Arabic}/u],
    ['Hebrew', /\p{Script=Hebrew}/u], ['Thai', /\p{Script=Thai}/u], ['Greek', /\p{Script=Greek}/u]];
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'fonts';
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    const one = ed.one(), current = one?.kind === 'text' ? fontById(one.font).id : null, text = ed.texts().map(n => n.text).join('\n');
    // Letters a face lacks are drawn in the system's font: each face says which, and scripts no face has are named (F11, D-077).
    const other = NONE.filter(([, re]) => re.test(text)).map(([name]) => name);
    script.classList.toggle('hidden', !other.length); script.textContent = other.length ? `${other.join(' and ')} letters use your system’s font; these faces change the Latin letters.` : '';
    list.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
      const def = fontById(b.dataset.font as FontId), miss = lacks(def.id, text);
      b.setAttribute('aria-pressed', String(b.dataset.font === current));
      b.querySelector('.lack')!.textContent = miss ? `no ${miss}` : def.weights.length < 2 ? 'one weight' : '';
    });
  } });
  return panel;
}
