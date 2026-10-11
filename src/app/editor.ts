import type { ColourRef, DocNode, FontId, Frame, ImageNode, KuraDoc, Palette, RatioId, SizeSpec, TextNode } from '../core/document';
import { center, containsRotated, intersects, norm, rotatedBounds, type Point, type Rect, type Size } from '../core/geometry';
import type { Anchor } from '../core/guides/types';
import { guideById } from '../core/guides';
import { canvasSize, ratioById, ratioNumbers } from '../core/ratios';
import { resolve } from '../core/palette';
import { defaultShapeSize, shapeLibrary, ICON_SHAPE } from '../core/shapes';
import { LINE_HEIGHT, textBox, typeScale, crossing, type TypeScale } from '../core/fit';
import { addNodes, addUnderText, duplicateNodes, nodeById, nudge, pasteNodes, removeNodes, reorder, setFill, setFrames, setGround, setHidden, setLocked, updateNodes, type Order } from '../core/ops';
import { reRatioKept, flagsFor, type RatioOrigin } from '../core/reratio';
import { flowText } from '../core/flow';
import { align, distribute, type AlignMode } from '../core/arrange';
import { drawnWeight } from '../core/fonts';
import { addSize, removeSize } from '../core/sizes';
import { containIn, CENTRE, fullImageRect, panFocus, spreadCells } from '../core/images';
import { fontStack } from '../core/script';
import { exportSize } from '../core/ratios';
import type { SnapHit, SnapLine } from '../core/snap';
import { Store, newId, type PanelId, type Tool } from './store';
import { measure, loadFont, textWidth } from './measure';
import * as assets from './assets';
import { Canvas2DRenderer } from './canvas/renderer';
import { drawOverlay, MARGIN, type Box, type HandleSet } from './canvas/overlay';
import { Tween } from './canvas/tween';
import { h, toast } from './ui';
import { removeBackground as runRemoval, preloadBackgroundRemoval } from './tools/background';
// The editor: one canvas for the document, one for the overlay, the chrome around them, and every editing action.
export type Live = {
  hits: SnapHit[]; lines: SnapLine[]; near?: { x?: SnapLine; y?: SnapLine }; pull?: { x?: number; y?: number };
  angle: { deg: number; centre: Point } | null; marquee: Rect | null;
  sketch: { live?: Point[]; lasso?: Point[]; eraser?: Point | null };
};
export const emptyLive = (): Live => ({ hits: [], lines: [], angle: null, marquee: null, sketch: {} });
export type Chrome = { update(): void };
export class Editor {
  readonly root: HTMLElement;
  readonly store: Store;
  readonly stack: HTMLDivElement;
  readonly docCanvas: HTMLCanvasElement;
  readonly overlay: HTMLCanvasElement;
  scale = 1;
  live: Live = emptyLive();
  readonly chrome: Chrome[] = [];
  readonly tween = new Tween();
  /** Shown instead of the store document while a tween or a lift runs. */ display: KuraDoc | null = null;
  clip: DocNode[] = [];
  private pasteCount = 0;
  private addCount = 0;
  private bitmaps = new Map<string, ImageBitmap | null>();
  private loading = new Set<string>();
  private generation = new Map<string, number>();
  /** Per size, where each node's geometry came from before ratio changes, so round trips do not drift (D-054). */
  private ratioOrigins = new Map<string, RatioOrigin>();
  readonly cutouts = new Set<string>();
  private missing = new Set<string>();
  private renderer: Canvas2DRenderer;
  private raf = 0;
  private scan: { id: string; t0: number } | null = null;
  private file: HTMLInputElement;
  private fillTarget: string | null = null;
  textarea: HTMLTextAreaElement | null = null;
  /** Presses on the canvas are ignored until then: the second click of a double-click on Start (D-062). */
  ignorePointerUntil = 0;
  private textBefore: KuraDoc | null = null;
  /** On-image controls: choose or replace the picture, reposition it, and Before/After for a cut-out (5o). */
  readonly imageBar: HTMLDivElement;
  private repositionBefore: KuraDoc | null = null;
  readonly info: HTMLDivElement;
  constructor(root: HTMLElement, store: Store) {
    this.root = root; this.store = store;
    this.docCanvas = h('canvas', { className: 'doc', 'aria-label': 'Document' });
    this.overlay = h('canvas', { className: 'overlay', tabindex: 0, 'aria-label': 'Canvas: click to select, drag to move, double-click text to edit' });
    this.imageBar = h('div', { className: 'seg image-bar hidden' }, h('button', { type: 'button', 'data-act': 'pick', title: 'Replace the picture' }, 'Replace'), h('button', { type: 'button', 'data-act': 'move', title: 'Drag the picture inside its frame' }, 'Reposition'),
      h('button', { type: 'button', 'data-act': 'fit', title: 'Fit the frame to the whole picture' }, 'Fit'),
      h('span', { className: 'cut' }, h('button', { type: 'button', 'data-cut': '0' }, 'Before'), h('button', { type: 'button', 'data-cut': '1' }, 'After')));
    this.stack = h('div', { className: 'canvas-stack' }, this.docCanvas, this.overlay, this.imageBar);
    this.info = h('div', { className: 'info' });
    this.file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg,image/heic,image/heif,.heic,.heif', multiple: true, className: 'hidden' });
    const stage = h('div', { className: 'stage' }, this.stack);
    root.append(stage, this.info, this.file);
    stage.addEventListener('pointerdown', e => { if (e.target !== stage) return; this.finishText(); this.store.setUI({ sel: [], panel: null }); });
    this.renderer = new Canvas2DRenderer(this.docCanvas);
    this.imageBar.addEventListener('click', e => {
      const b = (e.target as Element).closest('button'), n = this.one();
      if (!b || n?.kind !== 'image') return;
      if (b.dataset.act === 'pick') { this.finishReposition(); this.pickImage(n.id); }
      else if (b.dataset.act === 'move') { if (this.store.ui.reposition) this.finishReposition(); else this.startReposition(n.id); }
      else if (b.dataset.act === 'fit') this.fitFrame(n.id);
      else this.setCutout(b.dataset.cut === '1');
    });
    this.file.addEventListener('change', () => { const files = [...this.file.files ?? []]; this.file.value = ''; const target = this.fillTarget; this.fillTarget = null; void this.placeFiles(files, null, target); });
    new ResizeObserver(() => this.fit()).observe(root);
    let evict = 0;
    // Selecting something else ends a reposition.
    store.on(() => { const r = store.ui.reposition; if (r && (store.ui.sel.length !== 1 || store.ui.sel[0] !== r)) this.finishReposition(); });
    store.on(c => { this.invalidate(); if (c.doc) { clearTimeout(evict); evict = window.setTimeout(() => { if (this.store.doc) this.evictBitmaps(); }, 2000); } });
    this.fit();
  }
  get doc(): KuraDoc { return this.store.doc!; }
  get sizeId(): string { return this.store.ui.size; }
  spec(doc = this.doc): SizeSpec { return doc.sizes.find(s => s.id === this.sizeId) ?? doc.sizes[0]; }
  canvas(): Size { return canvasSize(this.spec().ratio); }
  anchors(): Anchor[] { const g = this.spec().guide; return g ? guideById(g).generate(this.canvas()) : []; }
  cells(): Rect[] { return this.anchors().flatMap(a => a.kind === 'region' && (a.id.startsWith('region-cell') || a.id.startsWith('region-quad')) ? [a.rect] : []); }
  typeScale(): TypeScale { return typeScale(this.spec().guide, this.canvas()); }
  frame(n: DocNode): Frame { return n.frames[this.sizeId] ?? Object.values(n.frames)[0]; }
  /** The drawn box of a node in the active size (text grows to its lines). */
  box(n: DocNode, doc = this.doc): Rect { const f = n.frames[this.spec(doc).id]; return n.kind === 'text' ? textBox(n, f, measure, typeScale(this.spec(doc).guide, canvasSize(this.spec(doc).ratio))).rect : f.rect; }
  visible(doc = this.doc): DocNode[] { return doc.nodes.filter(n => !n.frames[this.spec(doc).id]?.hidden); }
  selected(): DocNode[] { const s = new Set(this.store.ui.sel); return this.doc.nodes.filter(n => s.has(n.id)); }
  one(): DocNode | undefined { const s = this.selected(); return s.length === 1 ? s[0] : undefined; }
  palette(): Palette { const p = this.doc.palette, d = this.store.ui.previewDark; return d === null ? p : { ...p, dark: d }; }
  colour(ref: ColourRef): string { return resolve(ref, this.palette()); }
  /** Unit-space point under a pointer event. */
  toUnits(e: { clientX: number; clientY: number }): Point { const r = this.overlay.getBoundingClientRect(); return { x: (e.clientX - r.left - MARGIN) / this.scale, y: (e.clientY - r.top - MARGIN) / this.scale }; }
  hitTest(p: Point): DocNode | undefined { return [...this.visible()].reverse().find(n => containsRotated(this.box(n), this.frame(n).rot, p)); }
  boxes(): Box[] {
    const sel = this.selected().filter(n => !this.frame(n).hidden && n.id !== this.store.ui.editing), single = sel.length === 1 && !this.store.ui.armed && !this.store.ui.tool;
    return sel.map(n => {
      const handles: HandleSet = !single || n.id === this.store.ui.reposition ? 'none' : n.kind === 'image' ? 'corners' : n.kind === 'text' ? (n.fit ? 'fit' : 'text') : 'all';
      return { id: n.id, rect: this.box(n), rot: this.frame(n).rot, handles, locked: !!n.locked };
    });
  }
  // rendering
  fit(): void {
    const stage = this.root.querySelector<HTMLElement>('.stage');
    if (!stage || !this.store.doc) return;
    const c = this.canvas(), style = getComputedStyle(stage);
    const w = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), hgt = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    this.scale = Math.max(.05, Math.min(w / c.w, hgt / c.h));
    this.stack.style.width = `${c.w * this.scale}px`; this.stack.style.height = `${c.h * this.scale}px`;
    this.positionTextarea(); this.invalidate();
  }
  invalidate(): void { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); }); }
  image = (asset: string, cutout: boolean): ImageBitmap | null | undefined => {
    const variant = cutout ? 'cutout' : 'working', key = assets.bitmapKey(asset, variant);
    if (this.bitmaps.has(key)) return this.bitmaps.get(key);
    if (!this.loading.has(key)) {
      this.loading.add(key);
      const generation = this.generation.get(asset) ?? 0;
      void assets.bitmap(asset, variant).then(b => {
        // A load that started before the asset changed (a new cut-out) is stale: drop it and let the next draw ask again.
        if ((this.generation.get(asset) ?? 0) !== generation) return;
        this.bitmaps.set(key, b); this.loading.delete(key);
        if (b && cutout) this.cutouts.add(asset);
        if (!b && !cutout && !this.missing.has(asset)) { this.missing.add(asset); toast('An image is missing from this browser’s storage', 2400); }
        this.invalidate();
      });
    }
    return undefined;
  };
  forgetBitmap(asset: string): void { for (const v of ['working', 'cutout'] as const) { const k = assets.bitmapKey(asset, v); this.bitmaps.delete(k); this.loading.delete(k); } this.missing.delete(asset); this.generation.set(asset, (this.generation.get(asset) ?? 0) + 1); }
  /** Closes decoded bitmaps of assets the document no longer uses; undo reloads them from IndexedDB when needed. */
  evictBitmaps(): void {
    const keep = new Set(this.doc.nodes.flatMap(n => n.kind === 'image' && n.asset ? [n.asset] : []));
    for (const key of [...this.bitmaps.keys()]) {
      const asset = key.split('#')[0];
      if (keep.has(asset)) continue;
      this.bitmaps.delete(key); assets.release(asset);
    }
  }
  private draw(): void {
    if (!this.store.doc || this.store.ui.screen !== 'editor') return;
    if (Math.abs(this.canvas().w * this.scale - parseFloat(this.stack.style.width)) > .5 || Math.abs(this.canvas().h * this.scale - parseFloat(this.stack.style.height)) > .5) this.fit();
    const dpr = window.devicePixelRatio || 1, ui = this.store.ui;
    let doc = this.display ?? this.doc;
    if (ui.editing) doc = { ...doc, nodes: doc.nodes.filter(n => n.id !== ui.editing) };
    if (ui.previewDark !== null) doc = { ...doc, palette: { ...doc.palette, dark: ui.previewDark } };
    this.renderer.render(doc, { sizeId: this.sizeId, scale: this.scale * dpr, measure, image: this.image, placeholders: true });
    const scan = this.scan && nodeById(this.doc, this.scan.id);
    const flagged = new Set(ui.flags.map(f => f.id));
    const crossings = this.visible().flatMap(n => {
      if (n.kind !== 'text' || !n.fit) return [];
      const f = this.frame(n), b = this.box(n), at = f.rot ? null : crossing(f.rect, b.h, this.anchors().flatMap(a => a.kind === 'line' && a.axis === 'y' ? [{ id: a.id, at: a.at }] : []).concat([{ id: 'edge-bottom', at: this.canvas().h }]));
      return at ? [{ x: b.x, w: b.w, y: at.at }] : [];
    });
    drawOverlay(this.overlay, {
      size: this.canvas(), scale: this.scale, guides: ui.guides ? this.anchors() : null, guideInk: this.colour({ role: 'ink' }), grid: ui.grid.on ? ui.grid.size : null, dark: this.palette().dark,
      hits: this.live.hits, lines: this.live.lines, near: this.live.near, pull: this.live.pull, angle: this.live.angle,
      boxes: this.display ? [] : this.boxes(), marquee: this.live.marquee,
      flags: this.doc.nodes.filter(n => flagged.has(n.id) && !this.frame(n).hidden).map(n => ({ rect: this.box(n), rot: this.frame(n).rot })), crossings,
      sketch: { ...this.live.sketch, stroke: this.inkWidth(), ink: this.colour({ role: 'ink' }) },
      scan: scan ? { rect: this.box(scan), rot: this.frame(scan).rot, t: ((performance.now() - this.scan!.t0) % 900) / 900 } : null,
      reposition: this.repositionView(),
    });
    if (this.scan) this.invalidate();
    this.updateImageBar(); this.updateInfo();
    for (const c of this.chrome) c.update();
  }
  private repositionView(): { rect: Rect; rot: number; full: Rect; bitmap: ImageBitmap | null | undefined } | null {
    const id = this.store.ui.reposition, n = id ? nodeById(this.doc, id) : undefined;
    if (n?.kind !== 'image' || !n.asset) return null;
    const f = this.frame(n), bitmap = this.image(n.asset, !!n.cutout), natural = this.natural(n);
    return natural ? { rect: f.rect, rot: f.rot, full: fullImageRect(natural, f.rect, n.focus ?? CENTRE), bitmap } : null;
  }
  inkWidth(): number { const c = this.canvas(); return Math.max(2, Math.min(c.w, c.h) * .005); }
  private updateInfo(): void {
    const sel = this.selected(), one = sel.length === 1 ? sel[0] : undefined;
    if (!sel.length) { this.info.style.opacity = '0'; return; }
    this.info.style.opacity = '1';
    const b = one && this.box(one);
    this.info.replaceChildren(h('span', {}, one ? layerName(one) : `${sel.length} selected`), h('span', { className: 'muted' }, b ? `${Math.round(b.w)} × ${Math.round(b.h)}` : ''));
  }
  private updateImageBar(): void {
    const n = this.one(), ui = this.store.ui, show = n?.kind === 'image' && !n.locked && !this.display && !ui.tool && !ui.armed;
    this.imageBar.classList.toggle('hidden', !show);
    if (!show || n?.kind !== 'image') return;
    const moving = ui.reposition === n.id, cut = !!n.asset && this.cutouts.has(n.asset) && !moving, [pick, move, fit] = [...this.imageBar.querySelectorAll<HTMLButtonElement>('[data-act]')];
    const natural = this.natural(n), r = this.frame(n).rect;
    fit.classList.toggle('hidden', moving || !natural || Math.abs(Math.log((r.w / r.h) / (natural.w / natural.h))) < .01);
    pick.textContent = n.asset ? 'Replace' : 'Choose picture'; pick.classList.toggle('hidden', moving);
    move.textContent = moving ? 'Done' : 'Reposition'; move.classList.toggle('hidden', !n.asset); move.setAttribute('aria-pressed', String(moving));
    this.imageBar.querySelector('.cut')!.classList.toggle('hidden', !cut);
    const b = rotatedBounds(this.box(n), this.frame(n).rot);
    // Inside the picture's bottom edge when it is tall enough, so the bar does not cover what sits under it.
    this.imageBar.classList.toggle('inside', b.h * this.scale > 120);
    this.imageBar.style.left = `${(b.x + b.w / 2) * this.scale}px`; this.imageBar.style.top = `${Math.min(b.y + b.h, this.canvas().h) * this.scale}px`;
    this.imageBar.querySelectorAll<HTMLButtonElement>('[data-cut]').forEach(btn => btn.setAttribute('aria-pressed', String((btn.dataset.cut === '1') === !!n.cutout)));
  }
  /** Fit (D-048): the frame shrinks to the picture's proportions inside its current box, so the whole picture shows. */
  fitFrame(id: string): void {
    const n = nodeById(this.doc, id); if (n?.kind !== 'image' || n.locked) return;
    const natural = this.natural(n), f = this.frame(n); if (!natural) return;
    this.finishReposition();
    this.commit(setFrames(updateNodes(this.doc, [id], x => ({ ...x, focus: CENTRE }) as ImageNode), this.sizeId, { [id]: { ...f, rect: containIn(f.rect, natural) } }), 'Fitted to the picture');
  }
  /** Reposition (D-048): dragging moves the picture inside its frame; the frame stays where it is. */
  startReposition(id: string): void {
    const n = nodeById(this.doc, id);
    if (n?.kind !== 'image' || !n.asset || n.locked) return;
    this.finishText(); this.repositionBefore = this.doc; this.store.setUI({ reposition: id, sel: [id], panel: null });
  }
  finishReposition(): void {
    const before = this.repositionBefore; this.repositionBefore = null;
    if (!this.store.ui.reposition) return;
    this.store.setUI({ reposition: null });
    if (before && before !== this.doc) this.store.commit(this.doc, { before });
  }
  /** The picture's natural proportions (its working copy) when it is loaded. */
  natural(n: ImageNode): Size | null { const b = n.asset ? this.image(n.asset, !!n.cutout) : null; return b ? { w: b.width, h: b.height } : null; }
  panPicture(id: string, focus0: Point, delta: Point): void {
    const n = nodeById(this.doc, id); if (n?.kind !== 'image') return;
    const natural = this.natural(n), f = this.frame(n); if (!natural) return;
    const a = -f.rot * Math.PI / 180, local = { x: delta.x * Math.cos(a) - delta.y * Math.sin(a), y: delta.x * Math.sin(a) + delta.y * Math.cos(a) };
    this.store.set(updateNodes(this.doc, [id], x => ({ ...x, focus: panFocus(natural, f.rect, focus0, local) }) as ImageNode));
  }
  // editing actions
  commit(doc: KuraDoc, message?: string, key?: string): void { this.store.commit(doc, { key }); if (message) toast(message); }
  select(ids: string[]): void { this.store.setUI({ sel: ids }); }
  private nextOffset(): number { return (this.addCount++ % 6) * 20; }
  /** Frames for a new node in every size: the rect in the active size, its vertical position scaled in the others. */
  framesFor(rect: Rect, extra: Partial<Frame> = {}): Record<string, Frame> {
    const out: Record<string, Frame> = {};
    for (const s of this.doc.sizes) { const c = canvasSize(s.ratio), k = c.h / this.canvas().h; out[s.id] = { rect: s.id === this.sizeId ? { ...rect } : { ...rect, y: rect.y * k }, rot: 0, ...extra }; }
    return out;
  }
  add(nodes: DocNode[], message?: string): void {
    this.commit(addNodes(this.doc, nodes), message);
    this.store.setUI({ sel: nodes.map(n => n.id), armed: null, panel: this.store.ui.panel === 'colour' ? null : this.store.ui.panel });
  }
  centred(w: number, hgt: number): Rect { const c = this.canvas(), o = this.nextOffset(); return { x: (c.w - w) / 2 + o, y: (c.h - hgt) / 2 + o, w, h: hgt }; }
  addText(): void {
    const c = this.canvas(), size = this.typeScale().headline, w = c.w * .5, node: TextNode = { id: newId(), kind: 'text', text: 'Text', weight: 700, align: 'start', fill: { role: 'ink' }, frames: this.framesFor(this.centred(w, size * LINE_HEIGHT), { fontSize: size }) };
    this.add([node]); this.editText(node.id);
  }
  addShape(key: string): void {
    const def = shapeLibrary[key], s = defaultShapeSize(def.ar, this.canvas()), swatch = this.store.ui.swatch;
    const fill: ColourRef = 'role' in swatch && swatch.role === 'ground' ? { role: 'accent' } : swatch;
    this.add([{ id: newId(), kind: 'shape', shape: key, fill, frames: this.framesFor(this.centred(s.w, s.h)) }], def.name);
  }
  addIcon(name: string, d: string, flattened: boolean): void {
    const c = this.canvas(), side = Math.min(c.w, c.h) * .32;
    this.add([{ id: newId(), kind: 'shape', shape: ICON_SHAPE, fill: { role: 'ink' }, icon: { set: 'phosphor', name, d, licence: 'MIT' }, frames: this.framesFor(this.centred(side, side)) }],
      flattened ? `${title(name)} · flattened to one ink` : title(name));
  }
  /** Image tool (D-061): picks pictures from the computer, for a selected empty frame or as new images. */
  imageTool(): void {
    const one = this.one();
    this.pickImage(one?.kind === 'image' && !one.asset && !one.locked ? one.id : null);
  }
  /** An empty image frame to drop a picture on later (Shapes panel). */
  addImageFrame(): void {
    const c = this.canvas(); this.add([{ id: newId(), kind: 'image', asset: null, frames: this.framesFor(this.centred(c.w * .5, c.h * .35)) }], 'Image frame · drop a picture on it');
  }
  pickImage(target: string | null = null): void { this.fillTarget = target; this.file.click(); }
  maxExport(): number { return Math.max(...this.doc.sizes.map(s => { const e = exportSize(s.ratio, { scale: 1 }); return Math.max(e.w, e.h); })); }
  /** Drop, paste or pick (5p): onto an image block it fills it, cropped to cover; elsewhere a new image fills the nearest cell. */
  async placeFiles(files: File[], at: Point | null, target: string | null = null): Promise<void> {
    const kind = (f: File) => /^image\/(png|jpeg|webp|gif)$/.test(f.type) ? 'raster' : f.type === 'image/svg+xml' || /\.svg$/i.test(f.name) ? 'svg' : /^image\/hei[cf]$/.test(f.type) || /\.hei[cf]$/i.test(f.name) ? 'heic' : null;
    const images = files.filter(f => kind(f));
    if (!images.length) { if (files.length) toast('Choose a PNG, JPEG, WebP, GIF or SVG image', 2200); return; }
    const hit = target ? nodeById(this.doc, target) : at ? this.hitTest(at) : undefined, added: { key: string; natural: Size }[] = [];
    for (const [i, original] of images.entries()) {
      let stored: { key: string; natural: Size }, clear = false, file: Blob = original;
      try {
        // SVG logos are drawn once at twice the largest export size; nothing they reference is fetched (D-059).
        if (kind(original) === 'svg') file = await assets.svgToPng(original, Math.min(4096, 2 * this.maxExport()));
        stored = await assets.putImage(file, this.maxExport()); clear = await assets.hasTransparency(file);
      } catch {
        toast(kind(original) === 'heic' ? 'This browser can’t open HEIC photos. Save it as JPEG (iPhone: Share → Options → Most Compatible) and try again' : 'That image could not be read', 3200);
        continue;
      }
      // A see-through picture (logo, sticker) dropped on a photo goes on top of it; onto an empty frame it fills the
      // frame and the frame takes the picture's proportions, so a logo is never cropped (D-047).
      if (i === 0 && hit?.kind === 'image' && !hit.locked && !(clear && hit.asset && !target)) {
        const f = this.frame(hit), rect = clear ? containIn(f.rect, stored.natural) : f.rect;
        this.commit(setFrames(updateNodes(this.doc, [hit.id], n => ({ ...n, asset: stored.key, cutout: false, focus: CENTRE }) as ImageNode), this.sizeId, { [hit.id]: { ...f, rect } }), 'Filled');
        this.select([hit.id]); continue;
      }
      added.push(stored);
    }
    if (!added.length) return;
    // New pictures spread over the emptiest guide cells (the drop point's cell first), keep their own proportions
    // inside them, and go under the text (D-047, D-058). One undo step for the batch.
    const c = this.canvas(), p = at ?? { x: c.w / 2, y: c.h / 2 }, taken = this.visible().map(n => rotatedBounds(this.box(n), this.frame(n).rot));
    const boxes = spreadCells(p, this.cells(), taken, added.length, c, !!at);
    const nodes: DocNode[] = added.map((a, i) => ({ id: newId(), kind: 'image', asset: a.key, frames: this.framesFor(containIn(boxes[i], a.natural)) }));
    this.commit(addUnderText(this.doc, nodes), nodes.length > 1 ? `${nodes.length} images` : 'Image');
    this.store.setUI({ sel: nodes.map(n => n.id), armed: null });
  }
  remove(): void {
    const ids = this.selected().filter(n => !n.locked).map(n => n.id);
    if (!ids.length) return;
    this.commit(removeNodes(this.doc, ids), 'Deleted'); this.select([]);
  }
  duplicate(): void {
    const r = duplicateNodes(this.doc, this.store.ui.sel, newId);
    if (!r.ids.length) return;
    this.commit(r.doc, 'Duplicated'); this.select(r.ids);
  }
  /** Plain text the last copy wrote to the system clipboard; null when the browser gave no copy event to write it. */
  clipText: string | null = null;
  copy(message: string | null = 'Copied'): void { const s = this.selected(); if (!s.length) return; this.clip = structuredClone(s); this.clipText = null; this.pasteCount = 0; if (message) toast(message); }
  /** What a copy puts on the system clipboard: the text of the copied blocks, else their layer names. */
  clipboardText(): string { const text = this.clip.flatMap(n => n.kind === 'text' ? [n.text] : []); return (text.length ? text : this.clip.map(layerName)).join('\n\n'); }
  /** Text pasted from another app becomes a text block: one line at headline size, longer copy at body size. */
  addPastedText(raw: string): void {
    const text = raw.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').trim();
    if (!text) return;
    // One short line hugs its words; longer copy wraps at 60 % of the canvas width.
    const c = this.canvas(), scale = this.typeScale(), long = text.length > 40 || text.includes('\n'), size = long ? scale.body : scale.headline;
    const w = long ? c.w * .6 : Math.min(c.w * .8, textWidth(text, size, 700) + size * .3);
    const node: TextNode = { id: newId(), kind: 'text', text, weight: long ? 400 : 700, align: 'start', fill: { role: 'ink' }, frames: {} };
    const rect = this.centred(w, size * LINE_HEIGHT), frames = this.framesFor(rect, { fontSize: size });
    for (const id of Object.keys(frames)) frames[id].rect.h = textBox(node, frames[id], measure, this.typeScale()).rect.h;
    this.add([{ ...node, frames }], 'Pasted text'); this.flagText([node.id]);
  }
  cut(): void { if (!this.selected().length) return; this.copy(null); this.remove(); toast('Cut'); }
  paste(): void {
    if (!this.clip.length) { toast('Nothing to paste'); return; }
    const r = pasteNodes(this.doc, this.clip, newId, ++this.pasteCount);
    this.commit(r.doc, 'Pasted'); this.select(r.ids);
  }
  selectAll(): void { this.select(this.visible().map(n => n.id)); }
  toggleLock(): void {
    const s = this.selected(); if (!s.length) return;
    const lock = !s.every(n => n.locked); this.commit(setLocked(this.doc, s.map(n => n.id), lock), lock ? 'Locked' : 'Unlocked');
  }
  setLock(id: string, lock: boolean): void { this.commit(setLocked(this.doc, [id], lock), lock ? 'Locked' : 'Unlocked'); }
  setHidden(id: string, hidden: boolean): void { this.commit(setHidden(this.doc, this.sizeId, [id], hidden), hidden ? 'Hidden' : 'Shown'); if (hidden) this.select(this.store.ui.sel.filter(x => x !== id)); }
  reorder(mode: Order, ids = this.store.ui.sel): void {
    if (!ids.length) return;
    this.commit(reorder(this.doc, ids, mode), { front: 'Brought to front', back: 'Sent to back', forward: 'Brought forward', backward: 'Sent backward' }[mode]);
  }
  /** Keyboard moves never snap; quick repeats fold into one undo step. */
  nudge(dx: number, dy: number): void {
    const ids = this.selected().filter(n => !n.locked).map(n => n.id);
    if (ids.length) this.store.commit(nudge(this.doc, this.sizeId, ids, dx, dy), { key: 'nudge' });
  }
  /** A swatch fills the selection; with nothing selected it arms paint (5e). */
  applySwatch(ref: ColourRef): void {
    this.store.setUI({ swatch: ref });
    const sel = this.selected(), ids = sel.filter(n => n.kind !== 'image' && !n.locked).map(n => n.id);
    if (ids.length) { this.store.commit(setFill(this.doc, ids, ref), { key: 'fill' }); this.store.setUI({ armed: null }); }
    else if (!sel.length) this.store.setUI({ armed: ref });
  }
  paintAt(node: DocNode | undefined): void {
    const armed = this.store.ui.armed; if (!armed) return;
    if (!node) { this.commit(setGround(this.doc, armed), 'Ground filled'); return; }
    if (node.kind === 'image' || node.locked) return;
    this.commit(setFill(this.doc, [node.id], armed));
  }
  setPalette(patch: Partial<Palette>, message?: string): void { this.commit({ ...this.doc, palette: { ...this.doc.palette, ...patch } }, message); }
  /** Edits the one selected node; text that changes height moves the text stacked under it (D-046). */
  editOne(fn: (n: DocNode) => DocNode, key?: string): void {
    const n = this.one(); if (!n || n.locked) return;
    const next = updateNodes(this.doc, [n.id], fn);
    this.store.commit(n.kind === 'text' ? flowText(this.doc, next, n.id, measure) : next, { key });
    if (n.kind === 'text') this.flagText([n.id]);
  }
  /** Selected unlocked text blocks; text controls apply to all of them (D-063). */
  texts(): TextNode[] { return this.selected().filter((n): n is TextNode => n.kind === 'text' && !n.locked); }
  /** Edits every selected text block; text under each one follows its new height and off-canvas text is flagged. */
  editTexts(fn: (n: TextNode) => TextNode, key?: string): void {
    const ids = this.texts().map(n => n.id); if (!ids.length) return;
    let doc = this.doc;
    for (const id of ids) doc = flowText(doc, updateNodes(doc, [id], n => fn(n as TextNode)), id, measure);
    this.store.commit(doc, { key }); this.flagText(ids);
  }
  fontStep(dir: 1 | -1): void {
    this.editTexts(n => {
      const f = this.frame(n), size = textBox(n, f, measure, this.typeScale()).size, next = Math.max(6, size + dir * Math.max(2, Math.round(size * .1)));
      const t = { ...n, frames: { ...n.frames, [this.sizeId]: { ...f, fontSize: next } } }; delete t.fit; return t;
    }, 'font');
  }
  /** Sets the typeface of every selected unlocked text block; text under each one follows its new height (D-046). */
  async setFont(font: FontId): Promise<void> {
    const ids = this.selected().filter(n => n.kind === 'text' && !n.locked).map(n => n.id);
    if (!ids.length) return;
    // Measure in the real face, so the text under it moves by the right amount.
    await Promise.all([loadFont(font, 400), loadFont(font, 700)]);
    let doc = this.doc;
    for (const id of ids) doc = flowText(doc, updateNodes(doc, [id], n => { const t = { ...n, font } as TextNode; if (font === 'grotesk') delete t.font; return t; }), id, measure);
    this.store.commit(doc, {});
  }
  /** Marks text that runs off the canvas after an edit (the 5v flag), and clears the mark once it fits again. */
  flagText(ids: string[]): void {
    const c = this.canvas(), guide = this.spec().guide, set = new Set(ids);
    const fresh = this.doc.nodes.filter(n => set.has(n.id) && n.kind === 'text' && n.frames[this.sizeId]).flatMap(n => flagsFor(n, n.frames[this.sizeId], measure, c, guide));
    this.store.setUI({ flags: [...this.store.ui.flags.filter(f => !set.has(f.id)), ...fresh] });
  }
  /** A typed font size for the selected text (D-060); a manual size turns autofit off, like Smaller and Larger. */
  setFontSize(value: number): void {
    const size = Math.max(4, Math.min(2000, value)), ids = this.selected().filter(n => n.kind === 'text' && !n.locked).map(n => n.id);
    let doc = this.doc;
    for (const id of ids) doc = flowText(doc, updateNodes(doc, [id], n => { const t = { ...n, frames: { ...n.frames, [this.sizeId]: { ...n.frames[this.sizeId], fontSize: size } } } as TextNode; delete t.fit; return t; }), id, measure);
    if (ids.length) { this.store.commit(doc, {}); this.flagText(ids); }
  }
  /** A typed angle for the selection, about each block's centre (D-060). */
  setAngle(deg: number): void {
    const ids = this.selected().filter(n => !n.locked).map(n => n.id), rot = norm(deg);
    if (ids.length) this.store.commit(setFrames(this.doc, this.sizeId, Object.fromEntries(ids.map(id => { const f = nodeById(this.doc, id)!.frames[this.sizeId]; return [id, { ...f, rot: Math.abs(rot) < 1e-9 ? 0 : rot }]; }))), {});
  }
  toggleBold(): void { const weight = this.texts().every(n => n.weight === 700) ? 400 : 700; this.editTexts(n => ({ ...n, weight })); }
  cycleAlign(): void { const a = this.texts()[0]?.align, align = a === 'start' ? 'center' : a === 'center' ? 'end' : 'start'; this.editTexts(n => ({ ...n, align })); }
  /** Autofit on keeps today's box; the size then steps down the type scale as text grows (5q). */
  toggleFit(): void {
    const on = !this.texts()[0]?.fit;
    this.editTexts(n => {
      if (!on) { const t = { ...n }; delete t.fit; return t; }
      // The box keeps today's height, but never more than the room left above the canvas bottom.
      const f = this.frame(n), b = this.box(n), c = this.canvas(), room = c.h - f.rect.y - Math.min(c.w, c.h) * .045;
      return { ...n, fit: true, frames: { ...n.frames, [this.sizeId]: { ...f, rect: { ...f.rect, h: Math.max(Math.min(b.h, room), this.typeScale().body * LINE_HEIGHT) } } } };
    });
  }
  /** Align or distribute the selection (D-063): one block to the canvas, several to their joint bounds. */
  arrange(mode: AlignMode | 'spread-x' | 'spread-y'): void {
    const sel = this.selected().filter(n => !n.locked && !this.frame(n).hidden);
    if (!sel.length) return;
    const boxes = sel.map(n => ({ id: n.id, rect: rotatedBounds(this.box(n), this.frame(n).rot) }));
    if (mode.startsWith('spread') && boxes.length < 3) { toast('Select three or more to space evenly'); return; }
    const moves = mode === 'spread-x' || mode === 'spread-y' ? distribute(boxes, mode === 'spread-x' ? 'x' : 'y') : align(boxes, mode, { x: 0, y: 0, ...this.canvas() });
    const frames = Object.fromEntries(sel.map(n => { const f = this.frame(n), m = moves[n.id] ?? { dx: 0, dy: 0 }; return [n.id, { ...f, rect: { ...f.rect, x: f.rect.x + m.dx, y: f.rect.y + m.dy } }]; }));
    this.commit(setFrames(this.doc, this.sizeId, frames), mode.startsWith('spread') ? 'Spaced evenly' : sel.length === 1 ? 'Aligned to the canvas' : 'Aligned');
  }
  undo(): void { this.finishReposition(); if (this.store.undo()) toast('Undo'); else toast('Nothing to undo'); }
  redo(): void { this.finishReposition(); if (this.store.redo()) toast('Redo'); else toast('Nothing to redo'); }
  // sizes and ratio (5v, 5w)
  changeRatio(ratio: RatioId): void {
    if (ratio === this.spec().ratio) return;
    const { doc, flags, origin } = reRatioKept(this.doc, this.sizeId, { ratio }, measure, this.ratioOrigins.get(this.sizeId));
    this.ratioOrigins.set(this.sizeId, origin);
    this.store.commit(doc, {}); this.store.setUI({ flags });
    const r = ratioById(ratio);
    toast(flags.length ? `${r.label} ${ratioNumbers(ratio)} · ${new Set(flags.map(f => f.id)).size} flagged` : `${r.label} ${ratioNumbers(ratio)}`, 1800);
  }
  addSize(ratio: RatioId): void {
    const id = newId(), { doc, flags } = addSize(this.doc, ratio, id, measure, this.sizeId);
    this.store.commit(doc, {}); this.store.setUI({ size: id, flags, sel: [] });
    toast(`Linked size ${ratioNumbers(ratio)}${flags.length ? ` · ${new Set(flags.map(f => f.id)).size} flagged` : ''}`, 1800);
  }
  removeSize(id: string): void { if (this.doc.sizes.length < 2) return; const next = removeSize(this.doc, id); this.store.commit(next, {}); this.store.setUI({ size: next.sizes[0].id, flags: [] }); toast('Size removed'); }
  switchSize(id: string): void {
    const spec = this.doc.sizes.find(s => s.id === id); if (!spec) return;
    const c = canvasSize(spec.ratio), flags = this.doc.nodes.flatMap(n => flagsFor(n, n.frames[id], measure, c, spec.guide));
    this.store.setUI({ size: id, flags, sel: [] });
  }
  setGuides(on: boolean): void { this.store.setUI({ guides: on }); toast(on ? 'Guides on' : 'Guides off'); }
  openPanel(panel: PanelId | null): void { this.store.setUI({ panel: this.store.ui.panel === panel ? null : panel }); }
  setTool(tool: Tool | null): void { this.finishText(); this.finishReposition(); this.live = emptyLive(); this.store.setUI({ tool, panel: null, armed: null, sel: tool ? [] : this.store.ui.sel }); }
  // background removal (5o)
  async removeBackground(): Promise<void> {
    const n = this.one();
    if (n?.kind !== 'image' || !n.asset || n.locked || this.scan) return;
    const asset = n.asset, record = await assets.getRecord(asset);
    if (!record) { toast('Image missing'); return; }
    if (record.cutout) { this.cutouts.add(asset); this.setCutout(true); return; }
    this.scan = { id: n.id, t0: performance.now() }; this.store.setUI({ removing: n.id });
    try {
      const blob = await runRemoval(record.working);
      await assets.setCutout(asset, blob); this.forgetBitmap(asset); this.cutouts.add(asset);
      // The picture may have been deleted or replaced meanwhile: then the cut-out is only kept for later.
      const ids = this.doc.nodes.filter(x => x.kind === 'image' && x.asset === asset && !x.locked).map(x => x.id);
      if (ids.length) this.commit(updateNodes(this.doc, ids, x => ({ ...x, cutout: true }) as ImageNode), 'Background removed');
    } catch (e) { console.warn(e); toast('Background removal is unavailable here', 2200); }
    finally { this.scan = null; this.store.setUI({ removing: null }); }
  }
  preloadRemoval(): void { void preloadBackgroundRemoval().catch(() => {}); }
  setCutout(on: boolean): void { this.editOne(n => n.kind === 'image' ? { ...n, cutout: on } : n); }
  async checkCutout(n: DocNode | undefined): Promise<void> {
    if (n?.kind !== 'image' || !n.asset || this.cutouts.has(n.asset)) return;
    const r = await assets.getRecord(n.asset).catch(() => undefined);
    if (r?.cutout) { this.cutouts.add(n.asset); this.invalidate(); }
  }
  // text editing
  editText(id: string): void {
    const node = nodeById(this.doc, id);
    if (node?.kind !== 'text' || node.locked) return;
    this.finishText();
    const before = this.doc, area = h('textarea', { className: 'text-editor', 'aria-label': 'Edit text', spellcheck: 'false', dir: 'auto' });
    area.value = node.text; this.textarea = area; this.stack.append(area);
    this.store.setUI({ editing: id, sel: [id], armed: null });
    this.positionTextarea(); area.focus({ preventScroll: true }); area.select();
    area.addEventListener('input', () => { const cur = nodeById(this.doc, id), prev = this.doc; if (cur?.kind === 'text') { this.store.set(flowText(prev, updateNodes(prev, [id], n => ({ ...n, text: area.value })), id, measure)); this.positionTextarea(); } });
    area.addEventListener('keydown', e => {
      const mod = (e.metaKey || e.ctrlKey) && !e.altKey;
      // Undo before typing anything leaves the text and undoes the last change (e.g. New); Mod+B bolds the block being typed.
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && area.value === node.text) { e.preventDefault(); e.stopPropagation(); this.finishText(); this.undo(); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); e.stopPropagation(); const cur = nodeById(this.doc, id); if (cur?.kind === 'text') { this.store.set(updateNodes(this.doc, [id], n => ({ ...n, weight: (n as TextNode).weight === 700 ? 400 : 700 }) as TextNode)); this.positionTextarea(); } return; }
      if (e.key === 'Escape' || e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); this.finishText(); this.overlay.focus({ preventScroll: true }); } });
    area.addEventListener('blur', () => this.finishText());
    this.textBefore = before;
  }
  positionTextarea(): void {
    const area = this.textarea, id = this.store.ui.editing, node = id && this.store.doc ? nodeById(this.doc, id) : undefined;
    if (!area || node?.kind !== 'text') return;
    const f = this.frame(node), box = textBox(node, f, measure, this.typeScale()), k = this.scale;
    area.style.cssText = `left:${box.rect.x * k}px;top:${box.rect.y * k}px;width:${box.rect.w * k}px;height:${(box.rect.h + box.size * .4) * k}px;transform:rotate(${f.rot}deg);transform-origin:${box.rect.w * k / 2}px ${box.rect.h * k / 2}px;`
      + `font:${drawnWeight(node.font, node.weight)} ${box.size * k}px ${fontStack(node.text, node.font)};line-height:${LINE_HEIGHT};text-align:${node.align};unicode-bidi:plaintext;color:${this.colour(node.fill)};caret-color:${this.colour(node.fill)}`;
  }
  finishText(): void {
    const area = this.textarea;
    if (!area) return;
    this.textarea = null; const id = this.store.ui.editing, before = this.textBefore; this.textBefore = null;
    area.remove(); this.store.setUI({ editing: null });
    const node = id ? nodeById(this.doc, id) : undefined;
    if (!node || node.kind !== 'text') return;
    if (!node.text.trim()) { this.store.commit(removeNodes(this.doc, [node.id]), { before: before ?? undefined }); this.select([]); return; }
    const f = this.frame(node), b = this.box(node);
    const synced = node.fit ? this.doc : updateNodes(this.doc, [node.id], n => ({ ...n, frames: { ...n.frames, [this.sizeId]: { ...f, rect: { ...f.rect, h: b.h } } } }));
    if (before && JSON.stringify(nodeById(before, node.id)) !== JSON.stringify(nodeById(synced, node.id))) this.store.commit(synced, { before }); else this.store.set(synced);
    this.flagText([node.id]);
  }
  // 5d: on the first open ever, blocks lift 2px one after another, once.
  lift(): void {
    if (Store.lifted() || matchMedia('(prefers-reduced-motion: reduce)').matches) { Store.markLifted(); return; }
    Store.markLifted();
    const ids = this.visible().map(n => n.id), step = 120, up = 2 / this.scale, t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0, base = this.doc;
      if (t > ids.length * step + 280) { this.display = null; this.invalidate(); return; }
      this.display = { ...base, nodes: base.nodes.map(n => {
        const i = ids.indexOf(n.id); if (i < 0) return n;
        const local = (t - i * step) / 280, dy = local <= 0 || local >= 1 ? 0 : -up * Math.sin(Math.PI * local), f = n.frames[this.sizeId];
        return dy ? { ...n, frames: { ...n.frames, [this.sizeId]: { ...f, rect: { ...f.rect, y: f.rect.y + dy } } } } : n;
      }) };
      this.invalidate(); requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  /** Nodes whose rotated box meets a rect (marquee). */
  within(m: Rect, skipLocked = false): string[] { return this.visible().filter(n => !(skipLocked && n.locked) && intersects(rotatedBounds(this.box(n), this.frame(n).rot), m)).map(n => n.id); }
  centreOf(n: DocNode): Point { return center(this.box(n)); }
}
export const title = (name: string): string => name.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
export function layerName(n: DocNode): string {
  if (n.kind === 'shape') return n.icon ? title(n.icon.name) : shapeLibrary[n.shape]?.name ?? 'Shape';
  if (n.kind === 'text') return n.text.split('\n')[0] || 'Text';
  if (n.kind === 'image') return n.asset ? (n.cutout ? 'Cut-out' : 'Image') : 'Image frame';
  return n.form ? { line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', tri: 'Triangle' }[n.form] : 'Ink';
}
