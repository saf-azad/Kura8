import type { AdjustKey, ColourRef, Duotone, ImageNode } from '../../../core/document';
import { adjustKeys, adjustMin } from '../../../core/document';
import { FILTERS, filterOf, applyLook, lookOf, type Look } from '../../../core/look';
import { shapeLibrary, shapeOutline } from '../../../core/shapes';
import type { Editor } from '../../editor';
import { h, iconButton, ICON, slider, textButton } from '../../ui';
// Edit image (D-045): one-tap filters with live thumbnails, eight adjustments, duotone in palette colours, shape frames,
// crop, flip, replace, set as background and reset. Deterministic pixel maths (src/core/look.ts); nothing is generated.
const NAMES: Record<AdjustKey, string> = { brightness: 'Brightness', contrast: 'Contrast', saturation: 'Saturation', warmth: 'Warmth', tint: 'Tint', blur: 'Blur', sharpen: 'Sharpen', vignette: 'Vignette' };
export const DUOTONES: { name: string; tone: Duotone }[] = [
  { name: 'Ink and ground', tone: { dark: { role: 'ink' }, light: { role: 'ground' } } },
  { name: 'Ink and accent', tone: { dark: { role: 'ink' }, light: { role: 'accent' } } },
  { name: 'Accent and ground', tone: { dark: { role: 'accent' }, light: { role: 'ground' } } },
  { name: 'Deep and pale accent', tone: { dark: { row: 'accent', step: 6 }, light: { row: 'accent', step: 1 } } },
  { name: 'Deep base and pale accent', tone: { dark: { row: 'base', step: 5 }, light: { row: 'accent', step: 0 } } },
];
export const MASKS = ['rounded', 'circle', 'pill', 'heart', 'star5', 'hex', 'diamond', 'tri', 'drop', 'arch'].filter(k => k in shapeLibrary);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function imagePanel(ed: Editor): HTMLElement {
  const one = (): ImageNode | undefined => { const n = ed.one(); return n?.kind === 'image' && n.asset ? n : undefined; };
  const filters = h('div', { className: 'filters' }), thumbs = new Map<string, HTMLCanvasElement>();
  for (const f of FILTERS) {
    const c = h('canvas', { width: 52, height: 52 }), b = h('button', { type: 'button', 'aria-label': f.name, 'aria-pressed': 'false', 'data-filter': f.id }, c, h('span', {}, f.name));
    b.addEventListener('click', () => ed.applyFilter(f.id)); thumbs.set(f.id, c); filters.append(b);
  }
  const sliders = adjustKeys.map(k => ({ k, s: slider(NAMES[k], { min: adjustMin[k], max: 100, step: 1, set: v => ed.setAdjust(k, v) }) }));
  const swatch = (ref: ColourRef) => ed.colour(ref);
  const duo = h('div', { className: 'duotones' }), none = h('button', { type: 'button', 'aria-label': 'No duotone', title: 'No duotone', className: 'none' });
  none.addEventListener('click', () => ed.setDuotone(null));
  const duoButtons = DUOTONES.map(d => { const b = h('button', { type: 'button', 'aria-label': d.name, title: d.name }); b.addEventListener('click', () => ed.setDuotone(d.tone)); return b; });
  duo.append(none, ...duoButtons);
  const masks = h('div', { className: 'masks' }), noMask = h('button', { type: 'button', 'aria-label': 'No shape', title: 'No shape', className: 'none' });
  noMask.addEventListener('click', () => ed.setMask(null));
  const maskButtons = MASKS.map(key => {
    const def = shapeLibrary[key], o = shapeOutline(def, 24 * Math.min(1, def.ar), 24 / Math.max(1, def.ar)), b = h('button', { type: 'button', 'aria-label': def.name, title: def.name });
    b.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><g transform="translate(${(24 - 24 * Math.min(1, def.ar)) / 2} ${(24 - 24 / Math.max(1, def.ar)) / 2})"><path fill="currentColor" fill-rule="evenodd"${o.scale ? ` transform="scale(${o.scale[0]} ${o.scale[1]})"` : ''} d="${o.d}"/></g></svg>`;
    b.addEventListener('click', () => ed.setMask(key)); return b;
  });
  masks.append(noMask, ...maskButtons);
  const actions = h('div', { className: 'actions' },
    iconButton('Crop (double-click the photo)', ICON.crop, () => ed.startCrop()), iconButton('Flip horizontal', ICON.flipX, () => ed.flip('x')), iconButton('Flip vertical', ICON.flipY, () => ed.flip('y')),
    textButton('Replace image', 'Replace', () => { const n = one(); if (n) ed.pickImage(n.id); }), textButton('Fill page', 'Fill page', () => ed.fillPage(), 'Set as background: fill the page and send to back'),
    textButton('Reset photo', 'Reset', () => ed.resetImage(), 'Remove filters, adjustments, duotone, shape and crop'));
  const panel = h('div', { className: 'panel image-panel', hidden: true, role: 'dialog', 'aria-label': 'Edit image' },
    actions, h('h3', {}, 'Filters'), filters, h('h3', {}, 'Adjust'), h('div', { className: 'sliders' }, ...sliders.map(x => x.s.el)),
    h('h3', {}, 'Duotone'), duo, h('h3', {}, 'Shape'), masks);
  let thumbFor = '';
  /** Filter thumbnails: the photo itself, small, through each filter. */
  const drawThumbs = (n: ImageNode, look: Look | null) => {
    const bitmap = n.asset ? ed.image(n.asset, !!n.cutout, null) : null, key = `${n.asset}|${n.cutout}|${JSON.stringify(look?.duotone)}`;
    if (!bitmap || key === thumbFor) return;
    thumbFor = key;
    const side = Math.min(bitmap.width, bitmap.height), sx = (bitmap.width - side) / 2, sy = (bitmap.height - side) / 2;
    for (const f of FILTERS) {
      const c = thumbs.get(f.id)!, x = c.getContext('2d', { willReadFrequently: true })!;
      x.clearRect(0, 0, 52, 52); x.drawImage(bitmap, sx, sy, side, side, 0, 0, 52, 52);
      if (f.id === 'none') continue;
      const data = x.getImageData(0, 0, 52, 52); applyLook(data.data, 52, 52, { adjust: f.adjust }); x.putImageData(data, 0, 0);
    }
  };
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'image', n = one();
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    panel.style.maxHeight = `${window.innerHeight - 120}px`;
    panel.classList.toggle('faded', !n || !!n.locked);
    if (!n) return;
    const look = lookOf(n, ed.palette()), active = filterOf(n.adjust);
    drawThumbs(n, look);
    filters.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === active)));
    for (const { k, s } of sliders) s.show(n.adjust?.[k] ?? 0);
    none.setAttribute('aria-pressed', String(!n.duotone));
    DUOTONES.forEach((d, i) => { const b = duoButtons[i]; b.style.background = `linear-gradient(135deg,${swatch(d.tone.dark)} 50%,${swatch(d.tone.light)} 50%)`; b.setAttribute('aria-pressed', String(same(n.duotone, d.tone))); });
    noMask.setAttribute('aria-pressed', String(!n.mask));
    MASKS.forEach((k, i) => maskButtons[i].setAttribute('aria-pressed', String(n.mask === k)));
  } });
  return panel;
}
