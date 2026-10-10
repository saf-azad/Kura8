import type { Editor } from '../../editor';
import { h, iconButton, ICON, MOD, SHIFT, ALT } from '../../ui';
// The shortcuts sheet (?), three columns, as in the prototype with the D-026/D-034 bindings.
export const KEY_GROUPS: [string, [string, string[]][]][] = [
  ['Edit', [['Copy', [MOD, 'C']], ['Cut', [MOD, 'X']], ['Paste', [MOD, 'V']], ['Duplicate', [MOD, 'D']], ['Delete', ['Delete']], ['Select all', [MOD, 'A']], ['Undo', [MOD, 'Z']], ['Redo', [SHIFT, MOD, 'Z']], ['Bold', [MOD, 'B']], ['Italic', [MOD, 'I']], ['Underline', [MOD, 'U']], ['Copy style', [MOD, ALT, 'C']], ['Paste style', [MOD, ALT, 'V']], ['Edit text', ['Enter']], ['Finish text', [MOD, 'Enter']]]],
  ['Arrange', [['Nudge', ['Arrows']], ['Nudge 10 or one grid cell', [SHIFT, 'Arrows']], ['Bring forward', [MOD, ']']], ['Send backward', [MOD, '[']], ['Bring to front', [SHIFT, MOD, ']']], ['Send to back', [SHIFT, MOD, '[']], ['Group', [MOD, 'G']], ['Ungroup', [SHIFT, MOD, 'G']], ['Lock', [SHIFT, MOD, 'L']], ['Drag without snapping', [ALT, 'Drag']], ['Constrain', [SHIFT, 'Drag']]]],
  ['Tools', [['Text', ['T']], ['Rectangle', ['R']], ['Ellipse', ['O']], ['Shapes', ['S']], ['Image', ['I']], ['Sketch', ['P']], ['Eraser', ['E']], ['Lasso', ['L']], ['Colour', ['C']], ['Guides', ['G']], ['Export', [SHIFT, MOD, 'E']], ['Shortcuts', ['?']], ['Stop, close, deselect', ['Esc']]]],
];
export function keysPanel(ed: Editor): HTMLElement {
  const close = iconButton('Close (Esc)', ICON.close, () => ed.openPanel(null), 'close');
  const modal = h('div', { className: 'modal', hidden: true, role: 'dialog', 'aria-label': 'Keyboard shortcuts' }, h('header', {}, h('span', {}, 'Keyboard shortcuts'), close),
    h('div', { className: 'keys' }, ...KEY_GROUPS.map(([name, rows]) => h('div', {}, h('h3', { style: 'font-size:11px;font-weight:400;opacity:.6;margin:0' }, name),
      ...rows.map(([label, keys]) => h('div', { className: 'row' }, h('span', {}, label), h('span', {}, ...keys.map(k => h('span', { className: 'key' }, k)))))))));
  ed.chrome.push({ update() { modal.hidden = ed.store.ui.panel !== 'keys'; modal.inert = modal.hidden; } });
  return modal;
}
