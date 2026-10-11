import { h, iconButton, ICON, MOD, SHIFT } from '../ui';
import { ARRANGE_ICON } from './panels/arrange';
import type { Editor } from '../editor';
import { ratioById, ratioNumbers } from '../../core/ratios';
import { canvasSize } from '../../core/ratios';
import { textBox } from '../../core/fit';
import { fontById } from '../../core/fonts';
import { direction, physicalAlign } from '../../core/script';
import { measure } from '../measure';
// The Paper toolbar (top centre) and the corner controls (guides, sizes and ratio, layers, grid). Controls that do
// not apply fade to 23 %. Panels hang 12 px below the control that owns them.
export type Panels = { shapes: HTMLElement; colour: HTMLElement; fonts: HTMLElement; arrange: HTMLElement; layers: HTMLElement; grid: HTMLElement; ratio: HTMLElement };
export function toolbar(ed: Editor, panels: Panels): HTMLElement {
  const ui = () => ed.store.ui;
  const tool = (name: 'pen' | 'erase' | 'lasso') => () => ed.setTool(ui().tool === name ? (name === 'pen' ? null : 'pen') : name);
  const text = iconButton('Text (T)', ICON.text, () => ed.addText());
  const shapes = iconButton('Shapes (S)', ICON.shapes, () => ed.openPanel('shapes'));
  const image = iconButton('Image (I)', ICON.image, () => ed.imageTool());
  const pen = iconButton('Sketch (P)', ICON.pen, tool('pen'));
  const erase = iconButton('Eraser (E)', ICON.erase, tool('erase')), lasso = iconButton('Lasso (L)', ICON.lasso, tool('lasso'));
  const sketchGroup = h('div', { className: 'group' }, erase, lasso);
  const chip = h('span', { className: 'chip' }), hex = h('span', { className: 'readout hex' });
  const colour = h('button', { type: 'button', className: 'swatch-button', title: 'Colour (C)', 'aria-label': 'Colour' }, chip, hex);
  colour.addEventListener('click', () => ed.openPanel('colour'));
  // Readouts take a typed value: Enter or leaving applies it, Escape restores (D-060).
  const readout = (title: string, apply: (v: number) => void) => {
    const el = h('input', { className: 'readout', title, 'aria-label': title, inputmode: 'decimal', spellcheck: 'false', size: 4 });
    let shown = '';
    el.addEventListener('focus', () => { shown = el.value; el.select(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); el.value = shown; el.blur(); } });
    el.addEventListener('change', () => { const v = parseFloat(el.value.replace(/[^0-9.\-]/g, '')); if (Number.isFinite(v)) apply(v); else el.value = shown; });
    return el;
  };
  const angle = readout('Angle', v => ed.setAngle(v));
  const size = readout('Font size', v => ed.setFontSize(v));
  const smaller = iconButton('Smaller', ICON.minus, () => ed.fontStep(-1), 'btn small'), larger = iconButton('Larger', ICON.plus, () => ed.fontStep(1), 'btn small');
  const bold = h('button', { type: 'button', className: 'btn', title: `Bold (${MOD} B)`, style: 'font-weight:700;font-size:16px' }, 'B');
  bold.addEventListener('click', () => ed.toggleBold());
  const align = iconButton('Text align', '', () => ed.cycleAlign());
  const fit = h('button', { type: 'button', className: 'btn', title: 'Autofit', style: 'font-size:12px' }, 'Fit');
  fit.addEventListener('click', () => ed.toggleFit());
  const face = h('button', { type: 'button', className: 'btn face', title: 'Typeface', 'aria-label': 'Typeface', 'aria-expanded': 'false' }, 'Aa');
  face.addEventListener('click', () => ed.openPanel('fonts'));
  const textGroup = h('div', { className: 'group' }, face, smaller, size, larger, bold, align, fit);
  const cut = iconButton('Remove background', ICON.cutout, () => void ed.removeBackground());
  const arrange = iconButton('Arrange: align and space evenly', ARRANGE_ICON, () => ed.openPanel('arrange'));
  const dup = iconButton(`Duplicate (${MOD} D)`, ICON.duplicate, () => ed.duplicate());
  const lock = iconButton(`Lock (${MOD} ${SHIFT} L)`, ICON.lock, () => ed.toggleLock());
  const del = iconButton('Delete (Delete)', ICON.remove, () => ed.remove());
  const undo = iconButton(`Undo (${MOD} Z)`, ICON.undo, () => ed.undo()), redo = iconButton(`Redo (${SHIFT} ${MOD} Z)`, ICON.redo, () => ed.redo());
  const keys = iconButton('Keyboard shortcuts (?)', ICON.keys, () => ed.openPanel('keys'));
  const exp = iconButton(`Export (${MOD} ${SHIFT} E)`, ICON.go, () => ed.openPanel('export'), 'btn solid-btn');
  exp.style.cssText = 'background:#000;color:#fff';
  const anchor = h('div', { className: 'toolbar-anchor' }, panels.shapes, panels.colour, panels.fonts, panels.arrange);
  panels.shapes.style.left = '0'; panels.colour.style.left = '110px';
  const bar = h('div', { className: 'toolbar', role: 'toolbar', 'aria-label': 'Tools' }, text, shapes, image, pen, sketchGroup, h('span', { className: 'sep' }), colour, angle, textGroup, h('span', { className: 'sep' }), cut, arrange, dup, lock, del, h('span', { className: 'sep' }), undo, redo, h('span', { className: 'sep' }), keys, exp, anchor);
  const pressed = (b: HTMLElement, on: boolean, attr = 'aria-pressed') => b.setAttribute(attr, String(on));
  const fade = (b: HTMLElement, on: boolean) => { b.classList.toggle('faded', !on); if (b instanceof HTMLButtonElement) b.disabled = !on; };
  ed.chrome.push({ update() {
    const u = ui(), sel = ed.selected(), texts = ed.texts(), one = sel.length === 1 ? sel[0] : texts[0], isText = texts.length > 0, unlocked = sel.some(n => !n.locked);
    pressed(shapes, u.panel === 'shapes', 'aria-expanded'); pressed(colour, u.panel === 'colour', 'aria-expanded'); pressed(keys, u.panel === 'keys', 'aria-expanded');
    pressed(pen, u.tool === 'pen'); pressed(erase, u.tool === 'erase'); pressed(lasso, u.tool === 'lasso');
    sketchGroup.classList.toggle('hidden', !u.tool);
    const swatch = one && one.kind !== 'image' ? one.fill : u.armed ?? u.swatch, value = ed.colour(swatch);
    chip.style.background = value; hex.textContent = value.toUpperCase();
    if (document.activeElement !== angle) angle.value = one ? `${Math.round(ed.frame(one).rot)}°` : '—';
    angle.classList.toggle('faded', !one); angle.disabled = !one || !!one.locked;
    textGroup.classList.toggle('faded', !isText || !!one?.locked);
    for (const b of [face, smaller, larger, bold, align, fit]) b.disabled = !isText || !!one?.locked;
    const def = fontById(one?.kind === 'text' ? one.font : undefined);
    face.style.fontFamily = `"${def.family}", ${def.fallback}`; face.title = isText ? `Typeface: ${def.name}` : 'Typeface'; pressed(face, u.panel === 'fonts', 'aria-expanded');
    if (isText && def.weights.length < 2) bold.disabled = true;
    panels.fonts.style.left = `${face.offsetLeft}px`;
    if (document.activeElement !== size) size.value = one?.kind === 'text' ? String(Math.round(textBox(one, ed.frame(one), measure, ed.typeScale()).size)) : '—';
    size.disabled = !isText || !!one?.locked;
    if (one?.kind === 'text') {
      pressed(bold, one.weight === 700); pressed(fit, !!one.fit);
      // The icon shows where the lines actually sit: start is right in right-to-left text.
      const a = one.align, side = physicalAlign(a, direction(one.text)), x = side === 'left' ? [2, 2, 2] : side === 'center' ? [1, 5, 3] : [0, 8, 4];
      align.innerHTML = `<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="${1 + x[0]}" y="5" width="20" height="2" fill="currentColor"/><rect x="${1 + x[1]}" y="10" width="12" height="2" fill="currentColor"/><rect x="${1 + x[2]}" y="15" width="16" height="2" fill="currentColor"/></svg>`;
      align.title = `Text align: ${a}`;
    } else { pressed(bold, false); pressed(fit, false); align.innerHTML = '<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="3" y="5" width="16" height="2" fill="currentColor"/><rect x="3" y="10" width="10" height="2" fill="currentColor"/><rect x="3" y="15" width="14" height="2" fill="currentColor"/></svg>'; }
    fade(cut, one?.kind === 'image' && !!one.asset && !one.locked && !u.removing);
    fade(dup, unlocked); fade(del, unlocked); fade(lock, sel.length > 0); fade(arrange, unlocked);
    pressed(arrange, u.panel === 'arrange', 'aria-expanded'); panels.arrange.style.left = `${arrange.offsetLeft - 60}px`;
    pressed(lock, sel.length > 0 && sel.every(n => n.locked)); lock.title = sel.length && sel.every(n => n.locked) ? `Unlock (${MOD} ${SHIFT} L)` : `Lock (${MOD} ${SHIFT} L)`;
    fade(undo, ed.store.history.past.length > 0); fade(redo, ed.store.history.future.length > 0);
    // Fit between the wordmark and the corner controls: centred, scaled down on narrow windows.
    const side = Math.max(130, (document.querySelector<HTMLElement>('.corner')?.offsetWidth ?? 0) + 60), room = window.innerWidth - 2 * side;
    bar.style.transform = `translateX(-50%) scale(${Math.max(.45, Math.min(1, room / Math.max(1, bar.offsetWidth)))})`;
  } });
  return bar;
}
export function corner(ed: Editor, panels: Panels): HTMLElement {
  const ui = () => ed.store.ui;
  const guides = iconButton('Guides (G)', ICON.guides, () => ed.setGuides(!ui().guides), 'round');
  const sizes = h('div', { className: 'sizes' });
  const add = iconButton('Add a linked size', ICON.plus, () => { ed.store.setUI({ ratioMode: 'add', panel: ui().panel === 'ratio' && ui().ratioMode === 'add' ? null : 'ratio' }); }, 'round');
  const layers = iconButton('Layers', ICON.layers, () => ed.openPanel('layers'), 'round');
  const grid = iconButton('Snap grid', ICON.grid, () => ed.openPanel('grid'), 'round');
  const wrap = (button: HTMLElement, panel: HTMLElement) => { panel.style.cssText = 'right:52px;top:0;transform-origin:90% 0'; return h('div', { style: 'position:relative' }, button, panel); };
  panels.ratio.style.cssText = 'right:0;top:52px;transform-origin:90% 0';
  const top = h('div', { className: 'corner' }, guides, h('div', { style: 'position:relative;display:flex;gap:5px' }, sizes, add, panels.ratio));
  const stack = h('div', { className: 'corner-stack' }, wrap(layers, panels.layers), wrap(grid, panels.grid));
  let last = '';
  ed.chrome.push({ update() {
    const u = ui(), doc = ed.doc;
    guides.setAttribute('aria-pressed', String(u.guides)); layers.setAttribute('aria-expanded', String(u.panel === 'layers'));
    grid.setAttribute('aria-pressed', String(u.grid.on)); grid.setAttribute('aria-expanded', String(u.panel === 'grid'));
    add.setAttribute('aria-expanded', String(u.panel === 'ratio' && u.ratioMode === 'add'));
    const key = JSON.stringify([doc.sizes, u.size, u.panel === 'ratio' && u.ratioMode === 'change']);
    if (key === last) return;
    last = key;
    sizes.replaceChildren(...doc.sizes.map(s => {
      const r = ratioById(s.ratio), c = canvasSize(s.ratio), k = 16 / Math.max(c.w, c.h), active = s.id === u.size;
      const b = h('button', { type: 'button', className: `pill${active && u.panel === 'ratio' && u.ratioMode === 'change' ? ' on' : ''}`, title: active ? 'Change ratio' : `Switch to ${r.label} ${ratioNumbers(s.ratio)}`, 'aria-pressed': String(active), style: active ? '' : 'opacity:.6' },
        h('span', { className: 'ratio-glyph', style: `width:${Math.max(6, c.w * k)}px;height:${Math.max(6, c.h * k)}px` }), h('span', {}, ratioNumbers(s.ratio)));
      b.addEventListener('click', () => { const cur = ui(); if (active) ed.store.setUI({ ratioMode: 'change', panel: cur.panel === 'ratio' && cur.ratioMode === 'change' ? null : 'ratio' }); else ed.switchSize(s.id); });
      return b;
    }));
  } });
  return h('div', {}, top, stack);
}
