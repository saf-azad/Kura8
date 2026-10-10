import type { Editor } from '../../editor';
import { h, iconButton, ICON, MOD, SHIFT, textButton } from '../../ui';
// Position (D-045): align to the page (one object) or to each other, space evenly, group, order, flip and fill the page.
export function arrangePanel(ed: Editor): HTMLElement {
  const alignRow = h('div', { className: 'actions' },
    iconButton('Align left', ICON.alignLeft, () => ed.align('left')), iconButton('Align centre', ICON.alignCentre, () => ed.align('centre')), iconButton('Align right', ICON.alignRight, () => ed.align('right')),
    iconButton('Align top', ICON.alignTop, () => ed.align('top')), iconButton('Align middle', ICON.alignMiddle, () => ed.align('middle')), iconButton('Align bottom', ICON.alignBottom, () => ed.align('bottom')));
  const spaceRow = h('div', { className: 'actions' }, iconButton('Distribute horizontally', ICON.spaceX, () => ed.distribute('x')), iconButton('Distribute vertically', ICON.spaceY, () => ed.distribute('y')),
    iconButton('Flip horizontal', ICON.flipX, () => ed.flip('x')), iconButton('Flip vertical', ICON.flipY, () => ed.flip('y')));
  const group = textButton('Group', 'Group', () => ed.group(), `Group (${MOD} G)`), ungroup = textButton('Ungroup', 'Ungroup', () => ed.ungroup(), `Ungroup (${SHIFT} ${MOD} G)`);
  const order = h('div', { className: 'actions' }, textButton('Bring to front', 'To front', () => ed.reorder('front')), textButton('Bring forward', 'Forward', () => ed.reorder('forward')),
    textButton('Send backward', 'Backward', () => ed.reorder('backward')), textButton('Send to back', 'To back', () => ed.reorder('back')));
  const note = h('div', { className: 'icon-note' });
  const fill = textButton('Fill page', 'Fill page', () => ed.fillPage(), 'Set as background: fill the page and send to back');
  const panel = h('div', { className: 'panel arrange-panel', hidden: true, role: 'dialog', 'aria-label': 'Position' },
    h('h3', {}, 'Align'), alignRow, note, h('h3', {}, 'Space evenly and flip'), spaceRow, h('h3', {}, 'Group and order'), h('div', { className: 'actions' }, group, ungroup, fill), order);
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'arrange', sel = ed.selected();
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    panel.classList.toggle('faded', !sel.length);
    const units = new Set(sel.map(n => n.group ?? n.id)).size;
    note.textContent = units === 1 ? 'One object aligns to the page.' : 'Several objects align to each other.';
    group.disabled = sel.length < 2; ungroup.disabled = !sel.some(n => n.group); fill.disabled = sel.length !== 1 || sel[0].kind === 'text';
    spaceRow.querySelectorAll<HTMLButtonElement>('button').forEach((b, i) => { b.disabled = i < 2 ? units < 3 : sel.every(n => n.kind === 'text'); });
  } });
  return panel;
}
