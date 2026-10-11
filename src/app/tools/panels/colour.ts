import type { ColourRef, DocNode, Palette, RowId, Step } from '../../../core/document';
import { containsRotated, type Point } from '../../../core/geometry';
import { setOpacity } from '../../../core/ops';
import { addCustom, contrast, hexToHsv, hsvToHex, hueSwatch, HUES, passingShade, rows, resolve } from '../../../core/palette';
import type { Editor } from '../../editor';
import { h, toast } from '../../ui';
// Colour (M8): roles, the 7-step shade row, the 12 hues plus neutral and custom hues (5g), any colour by SV picker or
// hex, the contrast check with the nearest passing shade (5h), and the light/dark ground with a hold preview (5i).
// A swatch fills the selection; with nothing selected it arms paint (5e).
const ROLES = [['ground', 'Ground'], ['ink', 'Ink'], ['accent', 'Accent']] as const;
export function colourPanel(ed: Editor): HTMLElement {
  const roleButtons = ROLES.map(([role, name]) => {
    const b = h('button', { type: 'button', 'aria-pressed': 'false' }, h('span', { className: 'big' }), h('span', {}, name), h('span', { className: 'muted' }));
    b.addEventListener('click', () => { ed.store.setUI({ row: role === 'accent' ? 'accent' : 'base' }); ed.applySwatch({ role }); });
    return b;
  });
  const shades = h('div', { className: 'shades' }), hues = h('div', { className: 'hues' });
  const sv = h('div', { className: 'sv', title: 'Drag to pick any colour' }, h('i')), hueBar = h('div', { className: 'hue-bar', title: 'Drag to change hue' }, h('i'));
  const hex = h('input', { className: 'field', 'aria-label': 'Hex colour', spellcheck: 'false', maxlength: 7 });
  const addHue = h('button', { type: 'button', className: 'pill', title: 'Add as hue', style: 'height:32px' }, '+ Add as hue');
  // A typed brand colour can become the accent role itself, so the accent block and everything in Accent follow (D-077).
  const asAccent = h('button', { type: 'button', className: 'pill', title: 'Set as accent', style: 'height:32px' }, 'Set as accent');
  const hexRow = h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, hex, addHue, asAccent);
  const contrastBox = h('div', { className: 'contrast hidden' });
  // Opacity of the selection (D-052), coalesced into one undo step while dragging.
  const opacity = h('input', { type: 'range', min: 5, max: 100, step: 5, 'aria-label': 'Opacity', title: 'Opacity', style: 'flex:1' }), opacityValue = h('span', { style: 'width:38px;text-align:right' });
  const opacityRow = h('div', { className: 'row', style: 'font-size:12px;gap:10px' }, h('span', { className: 'muted' }, 'Opacity'), opacity, opacityValue);
  let slidingOpacity = false;
  opacity.addEventListener('pointerdown', () => { slidingOpacity = true; }); opacity.addEventListener('pointerup', () => { slidingOpacity = false; }); opacity.addEventListener('blur', () => { slidingOpacity = false; });
  opacity.addEventListener('input', () => { const ids = ed.selected().filter(n => !n.locked).map(n => n.id); if (ids.length) ed.store.commit(setOpacity(ed.doc, ids, Number(opacity.value) / 100), { key: 'opacity' }); });
  // Arrow keys step the slider rather than nudging the selection; Escape still closes the panel.
  opacity.addEventListener('keydown', e => { if (e.key.startsWith('Arrow')) e.stopPropagation(); });
  const light = h('button', { type: 'button', title: 'Light ground', style: 'background:#ECF0F3' }), dark = h('button', { type: 'button', title: 'Dark ground', style: 'background:#000' });
  const hint = h('div', { className: 'muted' });
  // With nothing selected, the current colour fills the ground in one tap instead of arming paint (D-077).
  const fillGround = h('button', { type: 'button', className: 'pill', title: 'Fill the ground with this colour', style: 'height:28px;font-size:12px' }, 'Fill ground');
  const panel = h('div', { className: 'panel colour-panel', hidden: true, role: 'dialog', 'aria-label': 'Colour' },
    h('div', { className: 'roles' }, ...roleButtons), shades, hues, sv, hueBar, hexRow, opacityRow, contrastBox, h('div', { className: 'grounds' }, hint, fillGround, h('div', { className: 'pair' }, light, dark)));
  let pick = { h: 210, s: 60, v: 70 }, editingHex = false, sliding = false, focusValue = '', built = '';
  const current = (): ColourRef => { const one = ed.one(); return one && one.kind !== 'image' ? one.fill : ed.store.ui.armed ?? ed.store.ui.swatch; };
  const drag = (el: HTMLElement, kind: 'sv' | 'h') => el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); sliding = true;
    const r = el.getBoundingClientRect();
    const at = (ev: PointerEvent) => {
      const fx = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), fy = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      pick = kind === 'sv' ? { ...pick, s: Math.round(fx * 100), v: Math.round((1 - fy) * 100) } : { ...pick, h: Math.round(fx * 359) };
      ed.store.setUI({ swatch: { hex: hsvToHex(pick.h, pick.s, pick.v) } });
    };
    at(e);
    const move = (ev: PointerEvent) => at(ev), up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      if (ev.type === 'pointerup') at(ev);
      sliding = false; ed.applySwatch({ hex: hsvToHex(pick.h, pick.s, pick.v) });
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  drag(sv, 'sv'); drag(hueBar, 'h');
  const typed = () => { const v = hex.value.trim().replace(/^#/, ''); return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null; };
  hex.addEventListener('focus', () => { editingHex = true; focusValue = hex.value.trim().toLowerCase().replace(/^#/, ''); });
  hex.addEventListener('input', () => { const v = typed(); addHue.classList.toggle('hidden', !v || Object.values(rows(ed.palette())).some(r => r.includes(v))); });
  hex.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); hex.blur(); } if (e.key === 'Escape') { editingHex = false; hex.blur(); } });
  hex.addEventListener('blur', () => { const v = editingHex ? typed() : null; editingHex = false; if (v && v.slice(1) !== focusValue) { ed.applySwatch({ hex: v }); pick = hexToHsv(v); } ed.invalidate(); });
  addHue.addEventListener('pointerdown', e => e.preventDefault());
  addHue.addEventListener('click', () => {
    const v = typed() ?? (('hex' in current()) ? (current() as { hex: string }).hex : null);
    if (!v) return;
    const { palette, ref } = addCustom(ed.doc.palette, v);
    if (palette !== ed.doc.palette) ed.setPalette({ custom: palette.custom }, 'Added as a hue');
    editingHex = false; hex.blur(); ed.store.setUI({ row: ref.row }); ed.applySwatch(ref);
  });
  asAccent.addEventListener('pointerdown', e => e.preventDefault());
  asAccent.addEventListener('click', () => {
    const v = typed() ?? (('hex' in current()) ? (current() as { hex: string }).hex : null);
    if (!v) return;
    editingHex = false; hex.blur(); ed.setPalette({ accent: v }, 'Accent set');
  });
  fillGround.addEventListener('click', () => { const ref = typed() ? { hex: typed()! } : current(); editingHex = false; hex.blur(); ed.fillGround(ref); });
  // 5i: tap a ground to switch; hold it to preview the other ground and let go to return.
  const ground = (b: HTMLElement, isDark: boolean) => {
    let t0 = 0;
    b.addEventListener('pointerdown', e => { e.preventDefault(); t0 = performance.now(); if (ed.doc.palette.dark !== isDark) ed.store.setUI({ previewDark: isDark }); });
    const end = (commit: boolean) => () => {
      if (!t0) return;
      const held = performance.now() - t0; t0 = 0; ed.store.setUI({ previewDark: null });
      if (commit && held < 350 && ed.doc.palette.dark !== isDark) ed.setPalette({ dark: isDark }, isDark ? 'Dark ground' : 'Light ground');
    };
    b.addEventListener('pointerup', end(true)); b.addEventListener('pointerleave', end(false));
  };
  ground(light, false); ground(dark, true);
  const backdrop = (t: DocNode, p: Palette, c: Point): string | null => {
    const nodes = ed.doc.nodes;
    for (let i = nodes.indexOf(t) - 1; i >= 0; i--) {
      const n = nodes[i], f = ed.frame(n);
      if (f.hidden || !containsRotated(ed.box(n), f.rot, c)) continue;
      if (n.kind === 'image') { if (n.asset) return null; continue; }
      if (n.kind === 'shape' && !n.icon && (n.opacity ?? 1) >= 1) return resolve(n.fill, p);
    }
    return resolve(ed.doc.ground ?? { role: 'ground' }, p);
  };
  ed.chrome.push({ update() {
    const ui = ed.store.ui, open = ui.panel === 'colour';
    panel.hidden = !open; panel.inert = !open;
    if (!open) return;
    const p = ed.palette(), all = rows(p), ref = current(), value = resolve(ref, p);
    ROLES.forEach(([role], i) => {
      const b = roleButtons[i], hexValue = resolve({ role }, p);
      b.setAttribute('aria-pressed', String('role' in ref && ref.role === role));
      (b.children[0] as HTMLElement).style.background = hexValue; b.children[2].textContent = hexValue.toUpperCase();
    });
    const rowId: RowId = all[ui.row] ? ui.row : 'base', row = all[rowId], key = JSON.stringify([p, rowId, value]);
    if (key !== built) { built = key;
    shades.replaceChildren(...row.map((c, i) => {
      const step = (p.dark ? 6 - i : i) as Step, b = h('button', { type: 'button', 'aria-label': `Shade ${i + 1}`, 'aria-pressed': String(c === value), style: `background:${c}` });
      b.addEventListener('click', () => ed.applySwatch({ row: rowId, step }));
      return b;
    }));
    const hueDot = (bg: string, on: boolean, label: string, go: () => void) => { const b = h('button', { type: 'button', 'aria-label': label, title: label, 'aria-pressed': String(on), style: `background:${bg}` }); b.addEventListener('click', go); return b; };
    hues.replaceChildren(
      ...HUES.map(hue => hueDot(hueSwatch(hue), p.hue === hue && !p.accent, `Hue ${hue}°`, () => ed.setPalette({ hue, accent: undefined }))),
      hueDot(hueSwatch(null), p.hue === null, 'No hue', () => ed.setPalette({ hue: null, accent: undefined })),
      ...p.custom.map((c, i) => hueDot(c, rowId === `c${i}`, `Custom hue ${c.toUpperCase()}`, () => { ed.store.setUI({ row: `c${i}` }); ed.applySwatch({ row: `c${i}`, step: 3 }); })),
    ); }
    if (!editingHex) hex.value = value.toUpperCase();
    if (!editingHex && !sliding) pick = { ...hexToHsv(value), h: hexToHsv(value).s ? hexToHsv(value).h : pick.h };
    const inRows = Object.values(all).some(r => r.includes(typed() ?? value));
    addHue.classList.toggle('hidden', inRows);
    const candidate = typed() ?? ('hex' in ref ? ref.hex : null);
    asAccent.classList.toggle('hidden', !candidate || candidate.toLowerCase() === resolve({ role: 'accent' }, p).toLowerCase());
    fillGround.classList.toggle('hidden', !!ed.selected().length);
    sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,${hsvToHex(pick.h, 100, 100)})`;
    const svDot = sv.firstElementChild as HTMLElement; svDot.style.left = `${pick.s}%`; svDot.style.top = `${100 - pick.v}%`; svDot.style.background = value;
    (hueBar.firstElementChild as HTMLElement).style.left = `${pick.h / 3.59}%`;
    const sel = ed.selected(), first = sel[0];
    opacityRow.classList.toggle('hidden', !sel.length);
    if (first && !slidingOpacity) opacity.value = String(Math.round((first.opacity ?? 1) * 100));
    opacityValue.textContent = `${opacity.value}%`;
    // 5h: text below 4.5:1 against what is behind it (the topmost solid block under its centre, else the ground) shows
    // its ratio and the nearest passing shade; over a picture the check is left to the eye (D-053).
    // Every selected text block is checked at nine points over its lines, so a second line running onto a dark block
    // counts, and the worst one is shown (D-077).
    let worst: { text: DocNode & { kind: 'text' }; bg: string; ratio: number } | null = null;
    for (const t of sel) {
      if (t.kind !== 'text') continue;
      const e = ed.extent(t);
      for (const fx of [.15, .5, .85]) for (const fy of [.2, .5, .8]) {
        const bg = backdrop(t, p, { x: e.x + e.w * fx, y: e.y + e.h * fy }), ratio = bg ? contrast(resolve(t.fill, p), bg) : Infinity;
        if (bg && (!worst || ratio < worst.ratio)) worst = { text: t, bg, ratio };
      }
    }
    if (worst) {
      const { text, bg, ratio } = worst, fix = passingShade(text.fill, bg, p);
      contrastBox.classList.toggle('hidden', ratio >= 4.5);
      if (ratio < 4.5) {
        const use = h('button', { type: 'button', title: 'Use the nearest passing shade' }, 'use');
        use.addEventListener('click', () => { if (fix) { ed.applySwatch(fix.ref); toast(`Contrast ${fix.ratio.toFixed(1)} : 1`); } });
        contrastBox.replaceChildren(h('span', { className: 'muted' }, 'Contrast'), h('span', {}, `${ratio.toFixed(1)} : 1  fails`), h('span'),
          ...(fix ? [h('span', { className: 'muted' }, 'Nearest pass'), h('span', {}, `${fix.ratio.toFixed(1)} : 1`), use] : [h('span', { className: 'muted' }, 'No shade on this row passes')]));
      }
    } else contrastBox.classList.add('hidden');
    light.setAttribute('aria-pressed', String(!p.dark)); dark.setAttribute('aria-pressed', String(p.dark));
    hint.textContent = ui.armed ? 'Tap anything to fill it · Esc stops' : ed.selected().length ? 'Swatches fill the selection' : 'Pick a swatch, then tap to fill';
  } });
  return panel;
}
