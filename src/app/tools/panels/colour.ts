import type { ColourRef, RowId, Step } from '../../../core/document';
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
  const hexRow = h('div', { style: 'display:flex;gap:8px;align-items:center' }, hex, addHue);
  const contrastBox = h('div', { className: 'contrast hidden' });
  const light = h('button', { type: 'button', title: 'Light ground', style: 'background:#ECF0F3' }), dark = h('button', { type: 'button', title: 'Dark ground', style: 'background:#000' });
  const hint = h('div', { className: 'muted' });
  const panel = h('div', { className: 'panel colour-panel', hidden: true, role: 'dialog', 'aria-label': 'Colour' },
    h('div', { className: 'roles' }, ...roleButtons), shades, hues, sv, hueBar, hexRow, contrastBox, h('div', { className: 'grounds' }, hint, h('div', { className: 'pair' }, light, dark)));
  let pick = { h: 210, s: 60, v: 70 }, editingHex = false, built = '';
  const current = (): ColourRef => { const one = ed.one(); return one && one.kind !== 'image' ? one.fill : ed.store.ui.armed ?? ed.store.ui.swatch; };
  const drag = (el: HTMLElement, kind: 'sv' | 'h') => el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const at = (ev: PointerEvent) => {
      const fx = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), fy = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      pick = kind === 'sv' ? { ...pick, s: Math.round(fx * 100), v: Math.round((1 - fy) * 100) } : { ...pick, h: Math.round(fx * 359) };
      ed.store.setUI({ swatch: { hex: hsvToHex(pick.h, pick.s, pick.v) } });
    };
    at(e);
    const move = (ev: PointerEvent) => at(ev), up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); ed.applySwatch({ hex: hsvToHex(pick.h, pick.s, pick.v) }); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
  });
  drag(sv, 'sv'); drag(hueBar, 'h');
  const typed = () => { const v = hex.value.trim().replace(/^#/, ''); return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null; };
  hex.addEventListener('focus', () => { editingHex = true; });
  hex.addEventListener('input', () => { const v = typed(); addHue.classList.toggle('hidden', !v || Object.values(rows(ed.palette())).some(r => r.includes(v))); });
  hex.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); hex.blur(); } if (e.key === 'Escape') { editingHex = false; hex.blur(); } });
  hex.addEventListener('blur', () => { const v = editingHex ? typed() : null; editingHex = false; if (v) { ed.applySwatch({ hex: v }); pick = hexToHsv(v); } ed.invalidate(); });
  addHue.addEventListener('pointerdown', e => e.preventDefault());
  addHue.addEventListener('click', () => {
    const v = typed() ?? (('hex' in current()) ? (current() as { hex: string }).hex : null);
    if (!v) return;
    const { palette, ref } = addCustom(ed.doc.palette, v);
    if (palette !== ed.doc.palette) ed.setPalette({ custom: palette.custom }, 'Added as a hue');
    editingHex = false; hex.blur(); ed.store.setUI({ row: ref.row }); ed.applySwatch(ref);
  });
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
  ed.chrome.push({ update() {
    const ui = ed.store.ui, open = ui.panel === 'colour';
    panel.hidden = !open;
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
    if (!editingHex) { hex.value = value.toUpperCase(); pick = { ...hexToHsv(value), h: hexToHsv(value).s ? hexToHsv(value).h : pick.h }; }
    const inRows = Object.values(all).some(r => r.includes(typed() ?? value));
    addHue.classList.toggle('hidden', inRows);
    sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,${hsvToHex(pick.h, 100, 100)})`;
    const svDot = sv.firstElementChild as HTMLElement; svDot.style.left = `${pick.s}%`; svDot.style.top = `${100 - pick.v}%`; svDot.style.background = value;
    (hueBar.firstElementChild as HTMLElement).style.left = `${pick.h / 3.59}%`;
    // 5h: text below 4.5:1 against the ground shows its ratio and the nearest passing shade from the same row.
    const text = ed.selected().find(n => n.kind === 'text');
    const bg = resolve(ed.doc.ground ?? { role: 'ground' }, p);
    if (text?.kind === 'text') {
      const ratio = contrast(resolve(text.fill, p), bg), fix = passingShade(text.fill, bg, p);
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
