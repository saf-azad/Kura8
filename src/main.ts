import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/700.css';
// Typefaces for document text (D-049), OFL-1.1, served from this origin and loaded when first used.
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/700.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/700.css';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './style.css';
import { createDocument, type KuraDoc } from './core/document';
import { canvasSize } from './core/ratios';
import { keepReadable, layout, starterNodes, STARTER } from './core/compositions';
import { relayout } from './core/relayout';
import { Store, loadDocument, loadPrevious, keepPrevious, DOC_KEY, newDocumentId, newId, type DialSettings } from './app/store';
import { migrate } from './core/document';
import { Editor } from './app/editor';
import { measure, clearMeasureCache, onFontLoad } from './app/measure';
import * as assets from './app/assets';
import { installInteraction } from './app/canvas/interaction';
import { installSketch } from './app/sketch';
import { installShortcuts } from './app/tools/shortcuts';
import { toolbar, corner } from './app/tools/toolbar';
import { shapesPanel } from './app/tools/panels/shapes';
import { colourPanel } from './app/tools/panels/colour';
import { fontsPanel } from './app/tools/panels/fonts';
import { arrangePanel } from './app/tools/panels/arrange';
import { layersPanel } from './app/tools/panels/layers';
import { gridPanel } from './app/tools/panels/grid';
import { ratioPanel } from './app/tools/panels/ratio';
import { keysPanel } from './app/tools/panels/keys';
import { exportSheet } from './app/tools/panels/export';
import { showDial } from './app/dial';
import { h, installTips, toast } from './app/ui';
// Boot: restore the one current document (migrating version 1 and its inline images), then show the editor when a
// document exists, otherwise the dial. The Kura8 wordmark goes back to the dial with the canvas in the hub (5f).
const app = document.querySelector<HTMLDivElement>('#app')!;
const tips = installTips();
const loaded = loadDocument();
const store = new Store(loaded?.doc ?? null);
// The design New replaced stays one Undo away, also after a reload (D-057).
const previous = loadPrevious();
// The slot always holds the other design: the one left behind whenever the current design's id changes (New, Undo or
// Redo across New, another tab), so Undo and Redo across New survive a reload too (D-072).
if (previous && store.doc && previous.id !== store.doc.id) store.history = { past: [previous], future: [] };
let shown = store.doc;
store.on(() => { if (store.doc && shown && store.doc.id !== shown.id) keepPrevious(shown); shown = store.doc; });
// Another tab saved the design: take its version (one Undo brings this tab's back) instead of overwriting it later.
addEventListener('storage', e => {
  if (e.key !== DOC_KEY || !e.newValue || !store.doc || e.newValue === JSON.stringify(store.doc)) return;
  let next;
  try { next = migrate(JSON.parse(e.newValue)).doc; } catch { return; }
  // While this tab is typing, the other tab's save waits and the typed text is laid over it when the edit ends (D-072).
  if (editor?.textarea) { editor.foreign = next; return; }
  store.commit(next, {}); toast('Updated from another tab', 2000);
});
void navigator.storage?.persist?.().catch(() => false);
addEventListener('pagehide', () => store.save());
let saveWarned = false;
store.on(() => { if (store.saveFailed && !saveWarned) { saveWarned = true; toast('Couldn’t save in this browser; export to keep your work', 3000); } if (!store.saveFailed) saveWarned = false; });
/** Writes a migrated version 1 document's inline images to IndexedDB; the v2 document is saved only when all of them landed. */
async function restoreAssets(): Promise<void> {
  if (!loaded) return;
  let ok = true;
  for (const { asset, dataUrl } of loaded.inline) {
    try { await assets.putImage(await assets.dataUrlToBlob(dataUrl), 2160, asset); editor?.forgetBitmap(asset); }
    catch { ok = false; }
  }
  if (loaded.inline.length) {
    if (ok) store.save(); else { store.keepSaved = true; toast('Some images could not be stored; the old document is kept', 3000); }
    editor?.invalidate();
  }
  if (store.doc && ok) void assets.gc(new Set([...store.doc.nodes, ...previous?.nodes ?? []].flatMap(n => n.kind === 'image' && n.asset ? [n.asset] : [])));
}
const editorRoot = h('div', { className: 'screen', style: 'position:absolute;inset:0' }), dialRoot = h('div', { className: 'screen', style: 'position:absolute;inset:0' });
app.append(editorRoot, dialRoot);
// The app never scrolls; focusing something near an edge must not shift the whole interface.
app.addEventListener('scroll', () => { app.scrollTop = 0; app.scrollLeft = 0; });
let editor: Editor | null = null, dial: { paint(): void; destroy(): void } | null = null;
const settingsOf = (doc: KuraDoc, sizeId: string): Partial<DialSettings> => {
  const spec = doc.sizes.find(s => s.id === sizeId) ?? doc.sizes[0], p = doc.palette;
  return { ratio: spec.ratio, ...(spec.guide ? { guide: spec.guide } : {}), ...(spec.comp ? { comp: spec.comp } : {}), hue: p.hue, dark: p.dark, accent: p.accent };
};
function starter(s: DialSettings): { doc: KuraDoc; headline: string } {
  const canvas = canvasSize(s.ratio), palette = { hue: s.hue, dark: s.dark, custom: [], ...(s.accent ? { accent: s.accent } : {}) }, nodes = starterNodes(layout({ canvas, guide: s.guide, comp: s.comp, measure, headline: STARTER.headline, body: STARTER.body }), { sizeId: 'main', newId, palette });
  const doc = createDocument(newDocumentId(), new Date().toISOString(), { id: 'main', ratio: s.ratio, guide: s.guide, comp: s.comp }, palette);
  return { doc: { ...doc, nodes }, headline: nodes.find(n => n.slot === 'headline')!.id };
}
/** The document the dial would make: the current canvas re-laid on the dial's geometry (5f), or a fresh starter. */
function preview(s: DialSettings): KuraDoc {
  const doc = store.doc;
  if (!doc) return starter(s).doc;
  const sizeId = store.ui.size, spec = doc.sizes.find(x => x.id === sizeId) ?? doc.sizes[0], palette = { ...doc.palette, hue: s.hue, dark: s.dark, accent: s.accent };
  const same = spec.ratio === s.ratio && spec.guide === s.guide && spec.comp === s.comp;
  const out = same ? doc : relayout({ ...doc, palette }, spec.id, { ratio: s.ratio, guide: s.guide, comp: s.comp }, measure).doc;
  return { ...out, palette, sizes: [out.sizes.find(x => x.id === spec.id)!] };
}
function ensureEditor(): Editor {
  if (editor) return editor;
  const ed = editor = new Editor(editorRoot, store);
  installInteraction(ed, installSketch(ed));
  installShortcuts(ed);
  const panels = { shapes: shapesPanel(ed), colour: colourPanel(ed), fonts: fontsPanel(ed), arrange: arrangePanel(ed), layers: layersPanel(ed), grid: gridPanel(ed), ratio: ratioPanel(ed) };
  const word = h('button', { type: 'button', className: 'wordmark', title: 'Back to the dial' }, 'Kura8');
  word.addEventListener('click', () => toDial());
  const hint = h('button', { type: 'button', className: 'shortcut-hint', title: 'Keyboard shortcuts' }, h('span', { className: 'muted' }, 'Shortcuts'), h('span', { className: 'key' }, '?'));
  hint.addEventListener('click', () => ed.openPanel('keys'));
  editorRoot.append(word, toolbar(ed, panels), corner(ed, panels), hint, keysPanel(ed), exportSheet(ed));
  // Escape or a click outside closes a panel; clicks on the canvas keep the colour, shapes and layers panels open.
  document.addEventListener('pointerdown', e => {
    const t = e.target as Element, panel = store.ui.panel;
    if (!panel || store.ui.screen !== 'editor' || t.closest('.panel, .modal, .sheet, .toolbar, .corner, .corner-stack, .help, .shortcut-hint')) return;
    if (t === ed.overlay && (panel === 'colour' || panel === 'shapes' || panel === 'layers' || panel === 'fonts' || panel === 'arrange')) return;
    ed.openPanel(null);
  });
  let tool = store.ui.tool;
  store.on(() => {
    if (store.ui.tool !== tool) {
      tool = store.ui.tool;
      tips.hint(tool === 'pen' ? 'Sketch' : tool === 'erase' ? 'Eraser' : tool === 'lasso' ? 'Lasso' : '', tool === 'pen' ? 'Hold still at the end of a stroke to clean it into a line, arrow or shape. Scribble over something to delete it.' : tool === 'erase' ? 'Drag across ink strokes to remove them.' : tool === 'lasso' ? 'Draw around objects to select them.' : '');
    }
  });
  return ed;
}
function toDial(): void {
  editor?.finishText();
  if (store.doc) store.setDial(settingsOf(store.doc, store.ui.size));
  store.setUI({ screen: 'dial', panel: null, tool: null, armed: null, sel: [] });
}
function route(): void {
  const onDial = store.ui.screen === 'dial' || !store.doc;
  dialRoot.hidden = !onDial; editorRoot.hidden = onDial;
  if (onDial) {
    dial ??= showDial(dialRoot, {
      settings: () => store.dial, set: patch => store.setDial(patch), hasDoc: () => !!store.doc, preview,
      image: (asset, cutout) => editor?.image(asset, cutout), start: go, fresh, back: () => store.setUI({ screen: 'editor' }),
    });
    dial.paint();
  } else {
    dial?.destroy(); dial = null; dialRoot.replaceChildren();
    ensureEditor().fit();
  }
}
/** Start (no document) or Go: re-lay the current content on the dial's geometry with a tween, undoable. */
function go(): void {
  const s = store.dial;
  if (!store.doc) { fresh(); return; }
  const before = store.doc, sizeId = store.ui.size, spec = before.sizes.find(x => x.id === sizeId) ?? before.sizes[0];
  const same = spec.ratio === s.ratio && spec.guide === s.guide && spec.comp === s.comp;
  const palette = { ...before.palette, hue: s.hue, dark: s.dark, ...(s.accent ? { accent: s.accent } : {}) };
  if (!s.accent) delete palette.accent;
  const out = same ? { doc: before, flags: [] } : relayout({ ...before, palette }, spec.id, { ratio: s.ratio, guide: s.guide, comp: s.comp }, measure);
  const next = keepReadable({ ...out.doc, palette });
  store.setUI({ screen: 'editor', size: spec.id });
  route();
  // A double press on Go lands on the dial's empty editor, not on a block (D-083).
  const guarded = ensureEditor(); guarded.ignorePointerUntil = guarded.ignoreKeysUntil = performance.now() + 650;
  if (next !== before && JSON.stringify(next) !== JSON.stringify(before)) {
    store.commit(next, {}); store.setUI({ flags: out.flags });
    const ed = ensureEditor();
    if (spec.ratio === s.ratio && !same) { store.paused = true; ed.tween.start(before, next, spec.id, d => { ed.display = d; ed.invalidate(); }, () => { ed.display = null; store.paused = false; ed.invalidate(); }); }
  }
}
function fresh(): void {
  const had = !!store.doc, { doc, headline } = starter(store.dial);
  store.commit(doc, { before: store.doc });
  store.setUI({ screen: 'editor', size: 'main', sel: [], flags: [] });
  route();
  const ed = ensureEditor();
  if (had) toast('New design · Undo brings the last one back', 2200);
  ed.lift();
  // A slow second click on Start (up to a second and a half) still leaves the headline editor open (D-083, D-086).
  ed.editText(headline); ed.ignorePointerUntil = performance.now() + 1500; ed.ignoreKeysUntil = performance.now() + 1500;
}
let screen = '';
store.on(() => {
  const now = store.ui.screen === 'dial' || !store.doc ? 'dial' : 'editor';
  if (now !== screen) { screen = now; route(); } else if (now === 'dial') dial?.paint();
});
screen = store.ui.screen === 'dial' || !store.doc ? 'dial' : 'editor';
const restored = restoreAssets();
if (loaded?.inline.length) void restored.finally(() => { route(); editor?.invalidate(); }); else route();
if (store.doc && store.ui.screen === 'editor' && !loaded?.inline.length) ensureEditor().lift();
document.fonts?.ready.then(() => { clearMeasureCache(); editor?.invalidate(); dial?.paint(); });
onFontLoad(() => { editor?.invalidate(); editor?.positionTextarea(); });
