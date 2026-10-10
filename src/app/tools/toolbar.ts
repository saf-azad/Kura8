import { h, iconButton, ICON, MOD, SHIFT } from '../ui';
import type { Editor } from '../editor';
import { ratioById, ratioNumbers } from '../../core/ratios';
import { canvasSize } from '../../core/ratios';
import { textBox } from '../../core/fit';
import { measure } from '../measure';
import { fontById } from '../../core/script';
// The Paper toolbar (top centre) and the corner controls (guides, sizes and ratio, layers, grid). Controls that do
// not apply fade to 23 %. Panels hang 12 px below the control that owns them.
export type Panels = { shapes: HTMLElement; colour: HTMLElement; layers: HTMLElement; grid: HTMLElement; ratio: HTMLElement; image: HTMLElement; effects: HTMLElement; font: HTMLElement; arrange: HTMLElement };
export function toolbar(ed: Editor, panels: Panels): HTMLElement {
  const ui = () => ed.store.ui;
  const tool = (name: 'pen' | 'erase' | 'lasso') => () => ed.setTool(ui().tool === name ? (name === 'pen' ? null : 'pen') : name);
  const text = iconButton('Text (T)', ICON.text, () => ed.addText());
  const shapes = iconButton('Shapes (S)', ICON.shapes, () => ed.openPanel('shapes'));
  const image = iconButton('Image (I)', ICON.image, () => ed.addImageFrame());
  const pen = iconButton('Sketch (P)', ICON.pen, tool('pen'));
  const erase = iconButton('Eraser (E)', ICON.erase, tool('erase')), lasso = iconButton('Lasso (L)', ICON.lasso, tool('lasso'));
  const sketchGroup = h('div', { className: 'group' }, erase, lasso);
  const chip = h('span', { className: 'chip' }), hex = h('span', { className: 'readout hex' });
  const colour = h('button', { type: 'button', className: 'swatch-button', title: 'Colour (C)', 'aria-label': 'Colour' }, chip, hex);
  colour.addEventListener('click', () => ed.openPanel('colour'));
  const angle = h('span', { className: 'readout', title: 'Angle' });
  const size = h('span', { className: 'readout', title: 'Font size' });
  const smaller = iconButton('Smaller', ICON.minus, () => ed.fontStep(-1), 'btn small'), larger = iconButton('Larger', ICON.plus, () => ed.fontStep(1), 'btn small');
  const font = h('button', { type: 'button', className: 'font-button', title: 'Font', 'aria-label': 'Font' }, 'Space Grotesk');
  font.addEventListener('click', () => ed.openPanel('font'));
  const bold = h('button', { type: 'button', className: 'btn', title: `Bold (${MOD} B)`, 'aria-label': 'Bold', style: 'font-weight:700;font-size:16px' }, 'B');
  bold.addEventListener('click', () => ed.toggleBold());
  const align = iconButton('Align', '', () => ed.cycleAlign());
  const fit = h('button', { type: 'button', className: 'btn', title: 'Autofit', style: 'font-size:12px' }, 'Fit');
  fit.addEventListener('click', () => ed.toggleFit());
  const textGroup = h('div', { className: 'group' }, font, smaller, size, larger, bold, align, fit);
  // With one photo selected, its controls take the text group's place (D-045).
  const edit = iconButton('Edit image', ICON.sliders, () => ed.openPanel('image')), crop = iconButton('Crop (double-click the photo)', ICON.crop, () => ed.startCrop());
  const imageGroup = h('div', { className: 'group hidden' }, edit, crop);
  const cut = iconButton('Remove background', ICON.cutout, () => void ed.removeBackground());
  const effects = iconButton('Effects', ICON.effects, () => ed.openPanel('effects')), position = iconButton('Position', ICON.position, () => ed.openPanel('arrange'));
  const dup = iconButton(`Duplicate (${MOD} D)`, ICON.duplicate, () => ed.duplicate());
  const lock = iconButton(`Lock (${MOD} ${SHIFT} L)`, ICON.lock, () => ed.toggleLock());
  const del = iconButton('Delete (Delete)', ICON.remove, () => ed.remove());
  const undo = iconButton(`Undo (${MOD} Z)`, ICON.undo, () => ed.undo()), redo = iconButton(`Redo (${SHIFT} ${MOD} Z)`, ICON.redo, () => ed.redo());
  const keys = iconButton('Keyboard shortcuts (?)', ICON.keys, () => ed.openPanel('keys'));
  const exp = iconButton(`Export (${MOD} ${SHIFT} E)`, ICON.go, () => ed.openPanel('export'), 'btn solid-btn');
  exp.style.cssText = 'background:#000;color:#fff';
  const anchor = h('div', { className: 'toolbar-anchor' }, panels.shapes, panels.colour, panels.image, panels.effects, panels.font, panels.arrange);
  panels.shapes.style.left = '0'; panels.colour.style.left = '110px';
  const bar = h('div', { className: 'toolbar', role: 'toolbar', 'aria-label': 'Tools' }, text, shapes, image, pen, sketchGroup, h('span', { className: 'sep' }), colour, angle, textGroup, imageGroup, h('span', { className: 'sep' }), cut, effects, position, dup, lock, del, h('span', { className: 'sep' }), undo, redo, h('span', { className: 'sep' }), keys, exp, anchor);
  /** Panels hang below the control that owns them, kept inside the toolbar's width. */
  const hang = (panel: HTMLElement, owner: HTMLElement) => { panel.style.left = `${Math.max(0, Math.min(owner.offsetLeft + (owner.parentElement === bar ? 0 : owner.parentElement!.offsetLeft), bar.offsetWidth - panel.offsetWidth))}px`; };
  const pressed = (b: HTMLElement, on: boolean, attr = 'aria-pressed') => b.setAttribute(attr, String(on));
  const fade = (b: HTMLElement, on: boolean) => { b.classList.toggle('faded', !on); if (b instanceof HTMLButtonElement) b.disabled = !on; };
  ed.chrome.push({ update() {
    const u = ui(), sel = ed.selected(), one = sel.length === 1 ? sel[0] : undefined, isText = one?.kind === 'text', unlocked = sel.some(n => !n.locked);
    pressed(shapes, u.panel === 'shapes', 'aria-expanded'); pressed(colour, u.panel === 'colour', 'aria-expanded'); pressed(keys, u.panel === 'keys', 'aria-expanded');
    pressed(pen, u.tool === 'pen'); pressed(erase, u.tool === 'erase'); pressed(lasso, u.tool === 'lasso');
    sketchGroup.classList.toggle('hidden', !u.tool);
    const swatch = one && one.kind !== 'image' ? one.fill : u.armed ?? u.swatch, value = ed.colour(swatch);
    chip.style.background = value; hex.textContent = value.toUpperCase();
    angle.textContent = one ? `${Math.round(ed.frame(one).rot)}°` : '—'; angle.classList.toggle('faded', !one);
    const isImage = one?.kind === 'image';
    textGroup.classList.toggle('hidden', isImage); imageGroup.classList.toggle('hidden', !isImage);
    fade(edit, isImage && !!one.asset && !one.locked); fade(crop, isImage && !!one.asset && !one.locked);
    pressed(edit, u.panel === 'image', 'aria-expanded'); pressed(effects, u.panel === 'effects', 'aria-expanded'); pressed(position, u.panel === 'arrange', 'aria-expanded'); pressed(font, u.panel === 'font', 'aria-expanded');
    pressed(crop, !!u.crop);
    fade(effects, unlocked); fade(position, sel.length > 0);
    font.textContent = one?.kind === 'text' ? fontById(one.font).name : 'Font';
    if (one?.kind === 'text') font.style.fontFamily = `${fontById(one.font).family}, ${fontById(one.font).generic}`; else font.style.fontFamily = '';
    if (u.panel === 'image') hang(panels.image, imageGroup); if (u.panel === 'effects') hang(panels.effects, effects);
    if (u.panel === 'font') hang(panels.font, textGroup); if (u.panel === 'arrange') hang(panels.arrange, position);
    textGroup.classList.toggle('faded', !isText || !!one?.locked);
    for (const b of [font, smaller, larger, bold, align, fit]) b.disabled = !isText || !!one?.locked;
    size.textContent = one?.kind === 'text' ? String(Math.round(textBox(one, ed.frame(one), measure, ed.typeScale()).size)) : '—';
    if (one?.kind === 'text') {
      pressed(bold, one.weight === 700); pressed(fit, !!one.fit);
      const a = one.align, x = a === 'start' ? [2, 2, 2] : a === 'center' ? [1, 5, 3] : [0, 8, 4];
      align.innerHTML = `<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="${1 + x[0]}" y="5" width="20" height="2" fill="currentColor"/><rect x="${1 + x[1]}" y="10" width="12" height="2" fill="currentColor"/><rect x="${1 + x[2]}" y="15" width="16" height="2" fill="currentColor"/></svg>`;
      align.title = `Align ${a}`;
    } else { pressed(bold, false); pressed(fit, false); align.innerHTML = '<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="3" y="5" width="16" height="2" fill="currentColor"/><rect x="3" y="10" width="10" height="2" fill="currentColor"/><rect x="3" y="15" width="14" height="2" fill="currentColor"/></svg>'; }
    fade(cut, one?.kind === 'image' && !!one.asset && !one.locked && !u.removing);
    fade(dup, unlocked); fade(del, unlocked); fade(lock, sel.length > 0);
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
