import { exportSize, ratioById, ratioNumbers, withinPixelLimit, type ExportScale } from '../../../core/ratios';
import type { Editor } from '../../editor';
import { h, iconButton, ICON, toast } from '../../ui';
import { download, fileName, preview, render, summary, type ExportChoice, type Format } from '../../export';
import { zip, uniqueNames } from '../../../core/zip';
import { nameStem } from '../../../core/export';
// The export sheet (M14): PNG, JPG, SVG or PDF; 1×–3× or 300 dpi with print sizes defaulting to 300 dpi (5x);
// sizes over the canvas pixel limit are disabled; notes say what is left out (5y); PNG offers No ground (5z), also
// over a painted ground (D-050).
const FORMATS: [Format, string][] = [['png', 'PNG'], ['jpg', 'JPG'], ['svg', 'SVG'], ['pdf', 'PDF']];
export function exportSheet(ed: Editor): HTMLElement {
  const canvas = h('canvas'), box = h('div', { className: 'preview' }, canvas);
  const formatSeg = h('div', { className: 'seg', role: 'group', 'aria-label': 'Format' }), scaleSeg = h('div', { className: 'seg', role: 'group', 'aria-label': 'Size' });
  const sizeText = h('div', { className: 'muted', style: 'font-size:13px' }), notes = h('div', { className: 'notes' });
  const noGround = h('button', { type: 'button', className: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': 'No ground' });
  const groundRow = h('div', { className: 'row', style: 'justify-content:start' }, noGround, h('span', {}, 'No ground'), h('span', { className: 'muted', style: 'font-size:12px' }, 'transparent background'));
  // All sizes (D-067): every linked size in one .zip, each at the chosen format and scale where it applies.
  const allSizes = h('button', { type: 'button', className: 'switch', role: 'switch', 'aria-checked': 'false', 'aria-label': 'All sizes' });
  const allRow = h('div', { className: 'row', style: 'justify-content:start' }, allSizes, h('span', {}, 'All sizes'), h('span', { className: 'muted', style: 'font-size:12px' }, 'one .zip'));
  let all = false;
  allSizes.addEventListener('click', () => { all = !all; ed.invalidate(); });
  const label = h('span', {}, 'Download'), button = h('button', { type: 'button', className: 'download' }, h('i'), label);
  const close = iconButton('Close (Esc)', ICON.close, () => ed.openPanel(null), 'close');
  const title = h('span', {}, 'Export');
  const sheet = h('div', { className: 'sheet', hidden: true, role: 'dialog', 'aria-label': 'Export' }, h('div', { className: 'grabber' }),
    h('div', { className: 'body' }, box, h('div', { className: 'controls' }, h('header', {}, title, close), formatSeg, scaleSeg, sizeText, groundRow, allRow, notes, button)));
  let format: Format = 'png', scale: ExportScale | null = null, transparent = false, working = false, wasOpen = false;
  // No ground is offered for every PNG, painted ground or not (D-050).
  const choice = (): ExportChoice => ({ format, scale: scale!, ground: !(format === 'png' && transparent) });
  noGround.addEventListener('click', () => { transparent = !transparent; ed.invalidate(); });
  button.addEventListener('click', () => void go());
  sheet.addEventListener('keydown', e => { if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement && e.target !== button)) { e.preventDefault(); void go(); } });
  async function go(): Promise<void> {
    if (working || !scale || ed.store.ui.panel !== 'export') return;
    working = true; button.classList.add('working'); label.textContent = 'Exporting';
    try {
      const c = choice(), doc = ed.doc;
      if (all && doc.sizes.length > 1) {
        const files: { name: string; data: Uint8Array }[] = [];
        for (const s of doc.sizes) {
          const own = 'dpi' in c.scale && !ratioById(s.ratio).mm || !withinPixelLimit(exportSize(s.ratio, c.scale)) ? { ...c, scale: { scale: 1 } as ExportScale } : c;
          files.push({ name: fileName(doc, s.id, own), data: new Uint8Array(await (await render(doc, s.id, own)).arrayBuffer()) });
        }
        // Two sizes of one ratio get -2, -3 … so none is lost when unzipping.
        uniqueNames(files.map(f => f.name)).forEach((name, i) => { files[i].name = name; });
        download(new Blob([zip(files).buffer as ArrayBuffer], { type: 'application/zip' }), `${nameStem(doc)}-all-sizes.zip`);
      } else download(await render(doc, ed.sizeId, c), fileName(doc, ed.sizeId, c));
      label.textContent = 'Saved'; toast('Saved');
      setTimeout(() => { if (!working) label.textContent = 'Download'; }, 2400);
    } catch (e) { console.warn(e); label.textContent = 'Download'; toast('Export failed', 2000); }
    finally { working = false; button.classList.remove('working'); }
  }
  let built = '';
  ed.chrome.push({ update() {
    const open = ed.store.ui.panel === 'export';
    sheet.hidden = !open; sheet.inert = !open;
    if (!open) { wasOpen = false; return; }
    const ratio = ed.spec().ratio, r = ratioById(ratio);
    if (!wasOpen) { wasOpen = true; scale = r.mm ? { dpi: 300 } : { scale: 1 }; setTimeout(() => button.focus({ preventScroll: true }), 0); }
    // Print sizes skip 2×, which is all but the same as 300 dpi.
    const options: [ExportScale, string][] = [...(r.mm ? [[{ dpi: 300 }, '300 dpi'] as [ExportScale, string]] : []), [{ scale: 1 }, '1×'], ...(r.mm ? [] : [[{ scale: 2 }, '2×'] as [ExportScale, string]]), [{ scale: 3 }, '3×']];
    if (!scale || !withinPixelLimit(exportSize(ratio, scale))) scale = options.find(([o]) => withinPixelLimit(exportSize(ratio, o)))![0];
    const vector = format === 'svg', s = summary(ed.doc, ed.sizeId), unfilled = ed.doc.ground === null;
    const key = JSON.stringify([format, scale, transparent, all, ratio, s, unfilled, ed.doc.sizes.length]);
    title.textContent = ed.doc.sizes.length > 1 ? `Export ${r.label} ${ratioNumbers(ratio)}` : 'Export';
    const clear = format === 'png' && transparent;
    box.classList.toggle('checker', clear);
    preview(ed.doc, ed.sizeId, canvas, clear, ed.image);
    if (key === built) return;
    built = key;
    formatSeg.replaceChildren(...FORMATS.map(([f, name]) => { const b = h('button', { type: 'button', 'aria-pressed': String(f === format) }, name); b.addEventListener('click', () => { format = f; ed.invalidate(); }); return b; }));
    scaleSeg.replaceChildren(...options.map(([o, name]) => {
      const px = exportSize(ratio, o), ok = withinPixelLimit(px), on = JSON.stringify(o) === JSON.stringify(scale);
      const b = h('button', { type: 'button', 'aria-pressed': String(on), disabled: !ok, title: ok ? `${px.w} × ${px.h} px` : 'Larger than browsers can export' }, name);
      b.addEventListener('click', () => { scale = o; ed.invalidate(); });
      return b;
    }));
    scaleSeg.classList.toggle('faded', vector);
    const px = exportSize(ratio, scale);
    sizeText.textContent = vector ? `${exportSize(ratio, { scale: 1 }).w} × ${exportSize(ratio, { scale: 1 }).h}, vector` : format === 'pdf' && r.mm ? `${r.name} page · ${'dpi' in scale ? '300 dpi · ' : ''}${px.w} × ${px.h} px` : `${px.w} × ${px.h} px`;
    groundRow.classList.toggle('hidden', format !== 'png');
    allRow.classList.toggle('hidden', ed.doc.sizes.length < 2); allSizes.setAttribute('aria-checked', String(all));
    noGround.setAttribute('aria-checked', String(transparent));
    const lines: string[] = [];
    if (s.hidden) lines.push(`${s.hidden} hidden object${s.hidden > 1 ? 's' : ''} not included`);
    if (s.offText) lines.push(`${s.offText} text block${s.offText > 1 ? 's run' : ' runs'} past the canvas edge`);
    if (s.empty) lines.push(`${s.empty} empty image frame${s.empty > 1 ? 's' : ''} not included`);
    if (vector && s.icons) lines.push('Icon licences are written into the file');
    if (vector && s.otherScripts) lines.push('Text in other scripts uses the viewer’s system fonts');
    notes.replaceChildren(...lines.map(t => h('div', {}, t)));
  } });
  return sheet;
}
