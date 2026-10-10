import { PAPER } from './paper-icons';
// Small DOM helpers shared by the chrome: element builder, icons, toasts, tooltips and the opt-in help bar.
type Attr = string | number | boolean | undefined | null | ((e: never) => void);
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener);
    else if (k === 'className') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style') el.style.cssText = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
/** Stroke icons on a 22-unit grid, 2px strokes like the prototype. */
const stroke = (inner: string, view = 22) => `<svg viewBox="0 0 ${view} ${view}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const paper = (name: string) => { const [vb, markup] = PAPER[name]; return `<svg viewBox="${vb}" fill="currentColor" aria-hidden="true">${markup}</svg>`; };
export const ICON: Record<string, string> = {
  text: '<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="6" width="20" height="3" rx="1.5" fill="currentColor"/><rect x="1" y="13" width="14" height="3" rx="1.5" fill="currentColor"/></svg>',
  shapes: paper('venn'), pen: paper('note-edit'), cutout: paper('blob-two'), remove: paper('x-circle'), close: paper('x-circle'), go: paper('arrow-right'), check: paper('check'),
  image: '<svg viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="3" width="20" height="16" rx="4" fill="rgba(156,171,194,.35)" stroke="#9CABC2" stroke-width="2"/></svg>',
  erase: stroke('<path d="M8 18L3.5 13.5a1.5 1.5 0 0 1 0-2.1L11 4a1.5 1.5 0 0 1 2.1 0l5 5a1.5 1.5 0 0 1 0 2.1L11 18H8Z"/><path d="M7 9.5L12.5 15"/><path d="M11 18H19"/>'),
  lasso: stroke('<path d="M7 15.5C3.8 14.4 2 12.4 2 10C2 6.1 6 3 11 3S20 6.1 20 10S16 17 11 17C10 17 9 16.9 8 16.6"/><path d="M8 13.5C6 14.5 5.5 17 7.5 19"/>'),
  duplicate: stroke('<rect x="3" y="3" width="11" height="11" rx="3"/><rect x="8" y="8" width="11" height="11" rx="3" fill="var(--paper)"/>'),
  lock: stroke('<rect x="4" y="10" width="14" height="10" rx="2"/><path d="M7 10V7a4 4 0 0 1 8 0v3"/>'),
  undo: stroke('<path d="M8 5L4 9L8 13"/><path d="M4 9H13A5 5 0 0 1 13 19H9"/>'),
  redo: stroke('<path d="M14 5L18 9L14 13"/><path d="M18 9H9A5 5 0 0 0 9 19H13"/>'),
  keys: stroke('<rect x="1" y="4" width="20" height="14" rx="3"/><path d="M7 14h8"/>'),
  minus: stroke('<path d="M5 11h12"/>'), plus: stroke('<path d="M5 11h12M11 5v12"/>'),
  guides: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" aria-hidden="true"><rect x="1" y="1" width="16" height="16" stroke-width="2"/><path d="M7 1V17M11 1V17M1 7H17M1 11H17" stroke-width="1"/></svg>',
  layers: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M9 2L16 6L9 10L2 6Z"/><path d="M2 10L9 14L16 10"/></svg>',
  grid: '<svg viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">' + [3, 9, 15].flatMap(y => [3, 9, 15].map(x => `<circle cx="${x}" cy="${y}" r="1.6"/>`)).join('') + '</svg>',
  up: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8L6 4L10 8"/></svg>',
  down: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4L6 8L10 4"/></svg>',
  eye: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M1 8C3 4.5 5.5 3 8 3S13 4.5 15 8C13 11.5 10.5 13 8 13S3 11.5 1 8Z"/><circle cx="8" cy="8" r="2"/></svg>',
  padlock: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="10" height="7" rx="1.5"/><path d="M4.5 6V4.5A2.5 2.5 0 0 1 9.5 4.5V6"/></svg>',
  sliders: stroke('<path d="M4 6H18M4 16H18"/><circle cx="8" cy="6" r="2.5" fill="var(--paper)"/><circle cx="14" cy="16" r="2.5" fill="var(--paper)"/>'),
  effects: stroke('<rect x="3" y="3" width="12" height="12" rx="3"/><path d="M8 19H16A3 3 0 0 0 19 16V8"/>'),
  position: stroke('<path d="M3 3V19"/><rect x="6" y="5" width="13" height="4" rx="1.5"/><rect x="6" y="13" width="8" height="4" rx="1.5"/>'),
  dropper: stroke('<path d="M13 5L17 9"/><path d="M15 3.5A2.1 2.1 0 0 1 18.5 7L16 9.5L12.5 6Z"/><path d="M12.5 7.5L5 15V17H7L14.5 9.5"/>'),
  flipX: stroke('<path d="M11 2V20" stroke-dasharray="2 3"/><path d="M8 5L3 17H8Z"/><path d="M14 5L19 17H14Z" fill="currentColor"/>'),
  flipY: stroke('<path d="M2 11H20" stroke-dasharray="2 3"/><path d="M5 8L17 3V8Z"/><path d="M5 14L17 19V14Z" fill="currentColor"/>'),
  crop: stroke('<path d="M6 2V16H20"/><path d="M2 6H16V20"/>'),
  alignLeft: stroke('<path d="M3 2V20"/><rect x="6" y="5" width="13" height="4" rx="1.5"/><rect x="6" y="13" width="8" height="4" rx="1.5"/>'),
  alignCentre: stroke('<path d="M11 2V20"/><rect x="4" y="5" width="14" height="4" rx="1.5"/><rect x="7" y="13" width="8" height="4" rx="1.5"/>'),
  alignRight: stroke('<path d="M19 2V20"/><rect x="3" y="5" width="13" height="4" rx="1.5"/><rect x="8" y="13" width="8" height="4" rx="1.5"/>'),
  alignTop: stroke('<path d="M2 3H20"/><rect x="5" y="6" width="4" height="13" rx="1.5"/><rect x="13" y="6" width="4" height="8" rx="1.5"/>'),
  alignMiddle: stroke('<path d="M2 11H20"/><rect x="5" y="4" width="4" height="14" rx="1.5"/><rect x="13" y="7" width="4" height="8" rx="1.5"/>'),
  alignBottom: stroke('<path d="M2 19H20"/><rect x="5" y="3" width="4" height="13" rx="1.5"/><rect x="13" y="8" width="4" height="8" rx="1.5"/>'),
  spaceX: stroke('<path d="M2 3V19M20 3V19"/><rect x="8" y="6" width="6" height="10" rx="1.5"/>'),
  spaceY: stroke('<path d="M3 2H19M3 20H19"/><rect x="6" y="8" width="10" height="6" rx="1.5"/>'),
};
export function iconButton(label: string, icon: string, onClick: (e: MouseEvent) => void, className = 'btn'): HTMLButtonElement {
  const b = h('button', { type: 'button', className, title: label, 'aria-label': label.replace(/\s*\(.*\)$/, '') });
  b.innerHTML = icon; b.addEventListener('click', onClick); return b;
}
/** Toasts confirm and report errors; one at a time, bottom centre. */
let toastEl: HTMLElement | undefined, toastTimer = 0;
export function toast(message: string, ms = 1300): void {
  toastEl ??= document.body.appendChild(h('div', { className: 'toast', role: 'status', 'aria-live': 'polite' }));
  toastEl.textContent = message; toastEl.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toastEl!.classList.remove('on'), ms);
}
const HELP: Record<string, string> = {
  'Text': 'Adds a text box. Double-click it on the canvas to type.',
  'Shapes': 'Opens basic shapes and a searchable library of free icons. Click one to drop it on the canvas.',
  'Search icons': 'Type a word like rocket or coffee. Icons come from Phosphor, free to use under the MIT licence.',
  'Image': 'Adds an empty image frame. Drop a picture on it to fill it, or drop anywhere to add one at the nearest cell.',
  'Colour': 'Pick a role, a shade or any colour. With something selected it fills it; with nothing selected it arms paint. Esc disarms.',
  'Drag to pick any colour': 'Left to right is saturation, top to bottom is brightness.',
  'Drag to change hue': 'Slides through every hue on the colour wheel.',
  'Drag to set the accent to any colour': 'Sets the accent colour your layout starts with.',
  'Sketch': 'Draw freehand. Hold still at the end of a stroke to clean it into a line, arrow or shape. Scribble over something to delete it.',
  'Eraser': 'Drag across ink strokes to remove them.',
  'Lasso': 'Draw around objects to select them.',
  'Bold': 'Toggles heavy weight on the selected text.',
  'Align': 'Cycles start, centre and end. Start follows the writing direction.',
  'Autofit': 'Steps the size down the type scale until the text fits its box, stopping at body size.',
  'Duplicate': 'Copies the selection and offsets it slightly.',
  'Lock': 'Stops an object from being moved or edited.',
  'Unlock': 'Lets this object be moved and edited again.',
  'Delete': 'Removes the selection.',
  'Undo': 'Steps back one change.',
  'Redo': 'Steps forward again.',
  'Remove background': 'Cuts the background out of the selected image on this computer. The original is kept: switch Before and After on the image.',
  'Export': 'Saves your design as PNG, JPG, SVG or PDF.',
  'Guides': 'Shows or hides the composition guide lines.',
  'Layers': 'Lists every object, top first. Reorder, hide, lock or select from here.',
  'Bring forward': 'Moves this object one step up the stack.',
  'Send backward': 'Moves this object one step down the stack.',
  'Hide': 'Hides the object in this size and leaves it out of exports.',
  'Show': 'Makes the hidden object visible again.',
  'Snap grid': 'Turns on a grid that objects snap to when dragged, and sets its size.',
  'Turn grid snapping on or off': 'When on, dragged objects pull towards the nearest grid line.',
  'Distance between grid lines': 'Smaller numbers give a finer grid.',
  'Change ratio': 'Switches the canvas shape. Blocks keep their guide lines; anything that no longer fits is flagged.',
  'Add a linked size': 'Adds another size of the same design. Text and colour stay linked; positions stay local.',
  'Light ground': 'Uses a light background with dark ink. Hold to preview.',
  'Dark ground': 'Uses a dark background with light ink. Hold to preview.',
  'Start': 'Builds a starting layout from your dial choices and opens the editor.',
  'Go': 'Re-lays your content on the dial’s geometry.',
  'Back to the dial': 'Returns to the dial with your canvas in the hub. Go re-lays the same content.',
  'Close': 'Closes this panel.',
  'Help': 'Turns this help bar on or off. Hover anything to learn what it does.',
  'Keyboard shortcuts': 'Lists every shortcut.',
  'Edit image': 'Filters, adjustments, duotone and shape frames for the selected photo. The original is never changed.',
  'Crop': 'Drag inside the photo to move it, its round corners to zoom, the frame’s handles to crop. Enter or Esc finishes.',
  'Effects': 'Transparency, drop shadow, border and flip for the selection, and copy or paste a style.',
  'Position': 'Align to the page or to each other, space evenly, group, order, flip and fill the page.',
  'Font': 'Choose one of six open-source fonts, italic, underline, uppercase and spacing.',
  'Pick from canvas': 'Click anywhere on the canvas to take the colour drawn there.',
  'Gradient': 'Runs the selected shape from its fill to a second colour. Choose End to set the second colour.',
  'Flip horizontal': 'Mirrors the selection left to right.',
  'Flip vertical': 'Mirrors the selection top to bottom.',
  'Copy style': 'Copies colour, font and effects from the selection.',
  'Paste style': 'Gives the selection the copied style. Its text and pictures stay.',
  'Fill page': 'Sets the object as the background: it fills the page and goes to the back.',
  'Replace image': 'Picks another picture for this frame.',
  'Reset photo': 'Removes filters, adjustments, duotone, shape frame, crop and flips.',
  'Group': 'Joins the selection so it selects, moves and aligns as one. Click again to pick one member.',
  'Ungroup': 'Splits the selected group.',
};
/** Native titles become a Paper tooltip below the control; the opt-in help bar explains the hovered control. */
export function installTips(): { setHelp(on: boolean): void; hint(title: string, body: string): void } {
  const tip = document.body.appendChild(h('div', { className: 'tip', role: 'tooltip' }));
  const button = h('button', { type: 'button', 'aria-pressed': 'false', title: 'Help' }, '?');
  const box = h('div', { className: 'help-box', hidden: true, 'aria-live': 'polite' }, h('b'), h('span'));
  document.body.append(h('div', { className: 'help' }, button, box));
  let help = false, hinted: [string, string] | null = null;
  const fill = (title: string, body: string) => { box.querySelector('b')!.textContent = title; box.querySelector('span')!.textContent = body; };
  const idle = () => hinted ? fill(...hinted) : fill('Help is on', 'Hover over any button or control to see what it does.');
  const setHelp = (on: boolean) => { help = on; button.setAttribute('aria-pressed', String(on)); box.hidden = !on; idle(); };
  button.addEventListener('click', () => setHelp(!help));
  document.addEventListener('pointerover', e => {
    const el = (e.target as Element).closest?.('[title],[data-tip]');
    if (!el) return;
    if (el.hasAttribute('title')) { el.setAttribute('data-tip', el.getAttribute('title')!); el.removeAttribute('title'); }
    const text = el.getAttribute('data-tip')!, r = el.getBoundingClientRect();
    tip.textContent = text; tip.style.left = `${r.left + r.width / 2}px`; tip.style.top = `${Math.min(innerHeight - 30, r.bottom + 8)}px`; tip.classList.add('on');
    if (help) { const name = text.replace(/\s*\(.*\)\s*$/, ''); fill(name, HELP[text] ?? HELP[name] ?? 'Its shortcut is shown in the tooltip.'); }
  });
  document.addEventListener('pointerout', e => { const el = (e.target as Element).closest?.('[data-tip]'); if (el && !el.contains(e.relatedTarget as Node)) { tip.classList.remove('on'); if (help) idle(); } });
  document.addEventListener('pointerdown', () => tip.classList.remove('on'), true);
  return { setHelp, hint(title, body) { hinted = title ? [title, body] : null; if (help) idle(); } };
}
export const isMac = (platform: string): boolean => /Mac|iPhone|iPad|iPod/i.test(platform);
export const MOD = isMac(navigator.platform) ? '⌘' : 'Ctrl';
export const SHIFT = isMac(navigator.platform) ? '⇧' : 'Shift';
export const ALT = isMac(navigator.platform) ? '⌥' : 'Alt';
/** A labelled range row: the input's accessible name is `label`; arrows and Escape stay with the slider. */
export function slider(label: string, o: { min: number; max: number; step: number; format?: (v: number) => string; set: (v: number) => void }): { el: HTMLElement; input: HTMLInputElement; show(v: number): void } {
  const input = h('input', { type: 'range', min: o.min, max: o.max, step: o.step, 'aria-label': label }), value = h('span', { className: 'muted' });
  const format = o.format ?? (v => String(Math.round(v)));
  input.addEventListener('input', () => { value.textContent = format(Number(input.value)); o.set(Number(input.value)); });
  input.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
  const el = h('label', { className: 'slider' }, h('span', { className: 'row' }, h('span', {}, label), value), input);
  return { el, input, show(v) { if (document.activeElement !== input) input.value = String(v); value.textContent = format(v); } };
}
/** A small text button for panel actions. */
export function textButton(label: string, text: string, onClick: () => void, title = label): HTMLButtonElement {
  const b = h('button', { type: 'button', className: 'chip-button', 'aria-label': label, title }, text);
  b.addEventListener('click', onClick); return b;
}
