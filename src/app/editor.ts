import type { AdjustKey, ColourRef, DocNode, Duotone, FontId, Frame, ImageNode, KuraDoc, Outline, Palette, RatioId, Shadow, SizeSpec, TextNode } from '../core/document';
import { center, containsRotated, intersects, rotatedBounds, type Point, type Rect, type Size } from '../core/geometry';
import type { Anchor } from '../core/guides/types';
import { guideById } from '../core/guides';
import { canvasSize, ratioById, ratioNumbers } from '../core/ratios';
import { resolve } from '../core/palette';
import { defaultShapeSize, shapeLibrary, ICON_SHAPE } from '../core/shapes';
import { LINE_HEIGHT, textBox, typeScale, crossing, type TypeScale } from '../core/fit';
import { addNodes, duplicateNodes, nodeById, nudge, pasteNodes, removeNodes, reorder, setFill, setGround, setHidden, setLocked, updateNodes, type Order } from '../core/ops';
import { reRatio, flagsFor } from '../core/reratio';
import { buildScene } from '../core/scene';
import { addSize, removeSize } from '../core/sizes';
import { containIn, collageCells, placement, fromPlacement, CENTRE } from '../core/images';
import { align, distribute, unitsOf, offsetFrames, groupNodes, ungroupNodes, withGroups, fillPage, type AlignMode } from '../core/arrange';
import { styleOf, applyStyle, type Style } from '../core/style';
import { cleanAdjust, lookKey, FILTERS, type Look } from '../core/look';
import { fontById } from '../core/script';
import { direction, fontStack, physicalAlign } from '../core/script';
import { exportSize } from '../core/ratios';
import type { SnapHit, SnapLine } from '../core/snap';
import { Store, newId, type PanelId, type Tool } from './store';
import { measure } from './measure';
import * as assets from './assets';
import { Canvas2DRenderer } from './canvas/renderer';
import { drawOverlay, MARGIN, type Box, type HandleSet } from './canvas/overlay';
import { Tween } from './canvas/tween';
import { h, toast } from './ui';
import { removeBackground as runRemoval, preloadBackgroundRemoval } from './tools/background';
import { LookCache, withLook } from './looks';
import { ensureFont, onFontReady } from './fonts';
import { fontFor } from './measure';
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
  readonly cutouts = new Set<string>();
  private missing = new Set<string>();
  private renderer: Canvas2DRenderer;
  private raf = 0;
  private scan: { id: string; t0: number } | null = null;
  private file: HTMLInputElement;
  private fillTarget: string | null = null;
  textarea: HTMLTextAreaElement | null = null;
  private textBefore: KuraDoc | null = null;
  readonly beforeAfter: HTMLDivElement;
  readonly cropBar: HTMLDivElement;
  readonly info: HTMLDivElement;
  private looks = new LookCache(() => this.invalidate());
  /** Copied style (D-045), pasted with Mod+Alt+V or the Effects panel. */ styleClip: Style | null = null;
  /** Colour panel: swatches set the gradient's end colour rather than the fill. */ gradientEnd = false;
  /** The crop session: the document before it started, so the whole session is one undo step. */ private cropBefore: KuraDoc | null = null;
  constructor(root: HTMLElement, store: Store) {
    this.root = root; this.store = store;
    this.docCanvas = h('canvas', { className: 'doc', 'aria-label': 'Document' });
    this.overlay = h('canvas', { className: 'overlay', tabindex: 0, 'aria-label': 'Canvas: click to select, drag to move, double-click text to edit' });
    this.beforeAfter = h('div', { className: 'seg before-after hidden' }, h('button', { type: 'button', 'data-cut': '0' }, 'Before'), h('button', { type: 'button', 'data-cut': '1' }, 'After'));
    const zoom = h('input', { type: 'range', min: 1, max: 5, step: .01, 'aria-label': 'Zoom', title: 'Zoom the photo in its frame' });
    zoom.addEventListener('input', () => this.setZoom(Number(zoom.value)));
    zoom.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); this.endCrop(); this.overlay.focus(); } else e.stopPropagation(); });
    const resetCrop = h('button', { type: 'button', 'aria-label': 'Reset crop' }, 'Reset'), done = h('button', { type: 'button', 'aria-label': 'Done cropping', 'aria-pressed': 'true' }, 'Done');
    resetCrop.addEventListener('click', () => this.resetCrop()); done.addEventListener('click', () => this.endCrop());
    this.cropBar = h('div', { className: 'seg crop-bar hidden', role: 'group', 'aria-label': 'Crop' }, h('span', { className: 'muted', style: 'font-size:12px;padding:0 4px 0 10px' }, 'Zoom'), zoom, resetCrop, done);
    this.stack = h('div', { className: 'canvas-stack' }, this.docCanvas, this.overlay, this.beforeAfter, this.cropBar);
    this.info = h('div', { className: 'info' });
    this.file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, className: 'hidden' });
    const stage = h('div', { className: 'stage' }, this.stack);
    root.append(stage, this.info, this.file);
    stage.addEventListener('pointerdown', e => { if (e.target !== stage) return; this.finishText(); this.store.setUI({ sel: [], panel: null }); });
    this.renderer = new Canvas2DRenderer(this.docCanvas);
    this.beforeAfter.addEventListener('click', e => { const b = (e.target as Element).closest('button'); if (b) this.setCutout(b.dataset.cut === '1'); });
    this.file.addEventListener('change', () => { const files = [...this.file.files ?? []]; this.file.value = ''; const target = this.fillTarget; this.fillTarget = null; void this.placeFiles(files, null, target); });
    new ResizeObserver(() => this.fit()).observe(root);
    onFontReady(() => { this.invalidate(); this.positionTextarea(); });
    let evict = 0;
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
    const sel = this.selected().filter(n => !this.frame(n).hidden && n.id !== this.store.ui.editing && n.id !== this.store.ui.crop), single = sel.length === 1 && !this.store.ui.armed && !this.store.ui.tool;
    return sel.map(n => {
      const handles: HandleSet = !single ? 'none' : n.kind === 'image' ? 'corners' : n.kind === 'text' ? (n.fit ? 'fit' : 'text') : 'all';
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
  /** The editor's picture of an asset: the working copy or cut-out, with a photo look applied at screen size (D-045). */
  image = (asset: string, cutout: boolean, look?: Look | null): ImageBitmap | null | undefined => {
    const base = this.decoded(asset, cutout);
    if (!look || !base) return base;
    const key = assets.bitmapKey(asset, cutout ? 'cutout' : 'working');
    return this.looks.get(key, `${key}|${lookKey(look)}`, () => withLook(base, look, 1600)) ?? base;
  };
  private decoded(asset: string, cutout: boolean): ImageBitmap | null | undefined {
    const variant = cutout ? 'cutout' : 'working', key = assets.bitmapKey(asset, variant);
    if (this.bitmaps.has(key)) return this.bitmaps.get(key);
    if (!this.loading.has(key)) {
      this.loading.add(key);
      void assets.bitmap(asset, variant).then(b => {
        this.bitmaps.set(key, b); this.loading.delete(key);
        if (b && cutout) this.cutouts.add(asset);
        if (!b && !cutout && !this.missing.has(asset)) { this.missing.add(asset); toast('An image is missing from this browser’s storage', 2400); }
        this.invalidate();
      });
    }
    return undefined;
  }
  forgetBitmap(asset: string): void { for (const v of ['working', 'cutout'] as const) { const k = assets.bitmapKey(asset, v); this.bitmaps.delete(k); this.looks.forget(k); } this.missing.delete(asset); }
  /** Closes decoded bitmaps of assets the document no longer uses; undo reloads them from IndexedDB when needed. */
  evictBitmaps(): void {
    const keep = new Set(this.doc.nodes.flatMap(n => n.kind === 'image' && n.asset ? [n.asset] : []));
    for (const key of [...this.bitmaps.keys()]) {
      const asset = key.split('#')[0];
      if (keep.has(asset)) continue;
      this.bitmaps.delete(key); this.looks.forget(key); assets.release(asset);
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
      crop: this.cropView(),
    });
    if (this.scan) this.invalidate();
    this.updateBeforeAfter(); this.updateCropBar(); this.updateInfo();
    for (const c of this.chrome) c.update();
  }
  inkWidth(): number { const c = this.canvas(); return Math.max(2, Math.min(c.w, c.h) * .005); }
  private updateInfo(): void {
    const sel = this.selected(), one = sel.length === 1 ? sel[0] : undefined;
    if (!sel.length) { this.info.style.opacity = '0'; return; }
    this.info.style.opacity = '1';
    const b = one && this.box(one);
    this.info.replaceChildren(h('span', {}, one ? layerName(one) : `${sel.length} selected`), h('span', { className: 'muted' }, b ? `${Math.round(b.w)} × ${Math.round(b.h)}` : ''));
  }
  private updateBeforeAfter(): void {
    const n = this.one(), show = n?.kind === 'image' && !!n.asset && this.cutouts.has(n.asset) && !this.display && !this.store.ui.tool && !this.store.ui.crop;
    this.beforeAfter.classList.toggle('hidden', !show);
    if (!show || n?.kind !== 'image') return;
    const b = rotatedBounds(this.box(n), this.frame(n).rot);
    this.beforeAfter.style.left = `${(b.x + b.w / 2) * this.scale}px`; this.beforeAfter.style.top = `${(b.y + b.h) * this.scale}px`;
    this.beforeAfter.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', String((btn.dataset.cut === '1') === !!n.cutout)));
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
  /** Image tool: with an empty frame selected it picks a file for it, otherwise it adds an empty frame. */
  addImageFrame(): void {
    const one = this.one();
    if (one?.kind === 'image' && !one.asset && !one.locked) { this.pickImage(one.id); return; }
    const c = this.canvas(); this.add([{ id: newId(), kind: 'image', asset: null, frames: this.framesFor(this.centred(c.w * .5, c.h * .35)) }], 'Image frame · drop a picture on it');
  }
  pickImage(target: string | null = null): void { this.fillTarget = target; this.file.click(); }
  maxExport(): number { return Math.max(...this.doc.sizes.map(s => { const e = exportSize(s.ratio, { scale: 1 }); return Math.max(e.w, e.h); })); }
  /** Drop, paste or pick (5p): onto an image block it fills it, cropped to cover; elsewhere a new image fills the nearest cell. */
  async placeFiles(files: File[], at: Point | null, target: string | null = null): Promise<void> {
    const images = files.filter(f => /^image\/(png|jpeg|webp|gif)$/.test(f.type));
    if (!images.length) { if (files.length) toast('Choose a PNG, JPEG, WebP or GIF image'); return; }
    const hit = target ? nodeById(this.doc, target) : at ? this.hitTest(at) : undefined;
    // Several photos at once make a collage (D-045): each takes its own cell, nearest the drop point first.
    const c = this.canvas(), p = at ?? { x: c.w / 2, y: c.h / 2 }, cells = this.cells(), fills = hit?.kind === 'image' && !hit.locked;
    const slots = collageCells(p, cells, images.length - (fills ? 1 : 0), c), added: string[] = [];
    for (const [i, file] of images.entries()) {
      let stored: { key: string; natural: Size };
      try { stored = await assets.putImage(file, this.maxExport()); } catch { toast('That image could not be read'); continue; }
      if (i === 0 && fills) { this.commit(updateNodes(this.doc, [hit.id], n => ({ ...n, asset: stored.key, cutout: false, focus: CENTRE }) as ImageNode), 'Filled'); added.push(hit.id); continue; }
      const slot = slots[i - (fills ? 1 : 0)], rect = cells.length ? slot : containIn(slot, stored.natural), id = newId();
      this.commit(addNodes(this.doc, [{ id, kind: 'image', asset: stored.key, frames: this.framesFor(rect) }]), images.length > 1 ? `${images.length} photos` : 'Image'); added.push(id);
    }
    if (added.length) this.store.setUI({ sel: added, armed: null });
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
  copy(message: string | null = 'Copied'): void { const s = this.selected(); if (!s.length) return; this.clip = structuredClone(s); this.pasteCount = 0; if (message) toast(message); }
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
    // With the gradient's end chosen in the colour panel, swatches set where the gradient ends (D-045).
    if (this.gradientEnd && sel.some(n => n.kind === 'shape' && n.gradient)) { this.setGradient({ to: ref }); this.store.setUI({ armed: null }); return; }
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
  editOne(fn: (n: DocNode) => DocNode, key?: string): void { const n = this.one(); if (n && !n.locked) this.store.commit(updateNodes(this.doc, [n.id], fn), { key }); }
  fontStep(dir: 1 | -1): void {
    const n = this.one(); if (n?.kind !== 'text') return;
    const f = this.frame(n), size = textBox(n, f, measure, this.typeScale()).size, next = Math.max(6, size + dir * Math.max(2, Math.round(size * .1)));
    this.editOne(x => { const t = { ...x, frames: { ...x.frames, [this.sizeId]: { ...f, fontSize: next } } } as TextNode; delete t.fit; return t; }, 'font');
  }
  toggleBold(): void { this.editOne(n => n.kind === 'text' ? { ...n, weight: n.weight === 700 ? 400 : 700 } : n); }
  cycleAlign(): void { this.editOne(n => n.kind === 'text' ? { ...n, align: n.align === 'start' ? 'center' : n.align === 'center' ? 'end' : 'start' } : n); }
  /** Autofit on keeps today's box; the size then steps down the type scale as text grows (5q). */
  toggleFit(): void {
    this.editOne(n => {
      if (n.kind !== 'text') return n;
      if (n.fit) { const t = { ...n }; delete t.fit; return t; }
      const f = this.frame(n), b = this.box(n);
      return { ...n, fit: true, frames: { ...n.frames, [this.sizeId]: { ...f, rect: { ...f.rect, h: b.h } } } };
    });
  }
  undo(): void { if (this.store.undo()) toast('Undo'); else toast('Nothing to undo'); }
  redo(): void { if (this.store.redo()) toast('Redo'); else toast('Nothing to redo'); }
  // sizes and ratio (5v, 5w)
  changeRatio(ratio: RatioId): void {
    if (ratio === this.spec().ratio) return;
    const { doc, flags } = reRatio(this.doc, this.sizeId, { ratio }, measure);
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
  setTool(tool: Tool | null): void { this.finishText(); this.live = emptyLive(); this.store.setUI({ tool, panel: null, armed: null, sel: tool ? [] : this.store.ui.sel }); }
  // Canva-parity editing (D-045): photo adjustments, filters, duotone, shape frames, crop, effects, text styles,
  // arranging, groups and copy style. Every edit skips locked nodes and is one undo step (slider drags coalesce).
  /** Sets text frame heights to their measured height in every size, as finishing an edit does. */
  syncText(doc: KuraDoc, ids: string[]): KuraDoc {
    return updateNodes(doc, ids, n => {
      if (n.kind !== 'text' || n.fit) return n;
      const frames = { ...n.frames };
      for (const s of doc.sizes) { const f = frames[s.id]; frames[s.id] = { ...f, rect: { ...f.rect, h: textBox(n, f, measure, typeScale(s.guide, canvasSize(s.ratio))).rect.h } }; }
      return { ...n, frames };
    });
  }
  /** Applies `fn` to every unlocked selected node; `message` toasts once. */
  editSel(fn: (n: DocNode) => DocNode, o: { key?: string; message?: string } = {}): void {
    const ids = this.selected().filter(n => !n.locked).map(n => n.id);
    if (!ids.length) return;
    this.store.commit(this.syncText(updateNodes(this.doc, ids, fn), ids), { key: o.key });
    if (o.message) toast(o.message);
  }
  private unit(): number { const c = this.canvas(); return Math.min(c.w, c.h) / 1000; }
  setAdjust(key: AdjustKey, value: number): void {
    this.editSel(n => { if (n.kind !== 'image') return n; const next = { ...n }, adjust = cleanAdjust({ ...n.adjust, [key]: value }); if (adjust) next.adjust = adjust; else delete next.adjust; return next; }, { key: `adjust-${key}` });
  }
  applyFilter(id: string): void {
    const f = FILTERS.find(x => x.id === id); if (!f) return;
    this.editSel(n => { if (n.kind !== 'image') return n; const next = { ...n }, adjust = cleanAdjust(f.adjust); if (adjust) next.adjust = adjust; else delete next.adjust; return next; }, { message: f.id === 'none' ? 'No filter' : f.name });
  }
  setDuotone(d: Duotone | null): void { this.editSel(n => { if (n.kind !== 'image') return n; const next = { ...n }; if (d) next.duotone = d; else delete next.duotone; return next; }, { message: d ? 'Duotone' : 'No duotone' }); }
  setMask(key: string | null): void {
    this.editSel(n => { if (n.kind !== 'image') return n; const next = { ...n }; if (key) next.mask = key; else delete next.mask; return next; }, { message: key ? `${shapeLibrary[key].name} frame` : 'No frame shape' });
  }
  resetImage(): void {
    this.editSel(n => { if (n.kind !== 'image') return n; const next = { ...n }; for (const k of ['adjust', 'duotone', 'mask', 'zoom', 'focus', 'flipX', 'flipY'] as const) delete next[k]; return next; }, { message: 'Photo reset' });
  }
  flip(axis: 'x' | 'y'): void {
    const key = axis === 'x' ? 'flipX' : 'flipY';
    this.editSel(n => { if (n.kind === 'text') return n; const next = { ...n }; if (n[key]) delete next[key]; else next[key] = true; return next; }, { message: axis === 'x' ? 'Flipped horizontally' : 'Flipped vertically' });
  }
  setOpacity(value: number): void { this.editSel(n => { const next = { ...n }; if (value >= 1) delete next.opacity; else next.opacity = Math.max(0, +value.toFixed(3)); return next; }, { key: 'opacity' }); }
  defaultShadow(): Shadow { const u = this.unit(); return { x: 10 * u, y: 14 * u, blur: 24 * u, fill: { role: 'ink' }, alpha: .4 }; }
  toggleShadow(): void {
    const on = !this.selected().every(n => n.shadow), shadow = this.defaultShadow();
    this.editSel(n => { const next = { ...n }; if (on) next.shadow = n.shadow ?? shadow; else delete next.shadow; return next; }, { message: on ? 'Shadow' : 'No shadow' });
  }
  setShadow(patch: Partial<Shadow>): void { this.editSel(n => n.shadow ? { ...n, shadow: { ...n.shadow, ...patch } } : n, { key: `shadow-${Object.keys(patch).join()}` }); }
  outlined(n: DocNode): n is Exclude<DocNode, { kind: 'ink' }> { return n.kind !== 'ink'; }
  toggleOutline(): void {
    const sel = this.selected().filter(n => this.outlined(n)), on = !sel.every(n => n.outline), outline: Outline = { fill: { role: 'ink' }, width: Math.max(1, 6 * this.unit()) };
    this.editSel(n => { if (n.kind === 'ink') return n; const next = { ...n }; if (on) next.outline = n.outline ?? outline; else delete next.outline; return next; }, { message: on ? 'Border' : 'No border' });
  }
  setOutline(patch: Partial<Outline>): void { this.editSel(n => n.kind !== 'ink' && n.outline ? { ...n, outline: { ...n.outline, ...patch } } as DocNode : n, { key: `outline-${Object.keys(patch).join()}` }); }
  toggleGradient(): void {
    const shapes = this.selected().filter(n => n.kind === 'shape'), on = !shapes.every(n => n.kind === 'shape' && n.gradient);
    this.editSel(n => {
      if (n.kind !== 'shape') return n;
      const next = { ...n }, to: ColourRef = 'role' in n.fill && n.fill.role === 'accent' ? { role: 'ink' } : { role: 'accent' };
      if (on) next.gradient = n.gradient ?? { to, angle: 90 }; else delete next.gradient;
      return next;
    }, { message: on ? 'Gradient' : 'Solid fill' });
  }
  setGradient(patch: Partial<{ to: ColourRef; angle: number }>): void { this.editSel(n => n.kind === 'shape' && n.gradient ? { ...n, gradient: { ...n.gradient, ...patch } } : n, { key: 'gradient' }); }
  setFont(font: FontId): void {
    const def = fontById(font);
    for (const w of [400, 700] as const) ensureFont(fontFor('Aa', 40, w, { font }));
    this.editSel(n => { if (n.kind !== 'text') return n; const next = { ...n }; if (font === 'space-grotesk') delete next.font; else next.font = font; return next; }, { message: def.name });
  }
  toggleText(key: 'italic' | 'underline' | 'upper'): void {
    const texts = this.selected().filter((n): n is TextNode => n.kind === 'text'), on = !texts.every(n => n[key]);
    this.editSel(n => { if (n.kind !== 'text') return n; const next = { ...n }; if (on) next[key] = true; else delete next[key]; return next; });
  }
  setSpacing(value: number): void { this.editSel(n => { if (n.kind !== 'text') return n; const next = { ...n }; if (value) next.spacing = Math.round(value); else delete next.spacing; return next; }, { key: 'spacing' }); }
  setLeading(value: number): void { this.editSel(n => { if (n.kind !== 'text') return n; const next = { ...n }; if (Math.abs(value - LINE_HEIGHT) < 1e-6) delete next.leading; else next.leading = +value.toFixed(2); return next; }, { key: 'leading' }); }
  /** Units to arrange: each selected node, groups collapsed, by its drawn, rotated box. */
  private units() { return unitsOf(this.selected().filter(n => !this.frame(n).hidden).map(n => ({ id: n.id, group: n.group, box: rotatedBounds(this.box(n), this.frame(n).rot) }))); }
  align(mode: AlignMode): void {
    const units = this.units(); if (!units.length) return;
    this.commit(offsetFrames(this.doc, this.sizeId, align(units, mode, this.canvas())), units.length === 1 ? `Aligned ${mode} to the page` : `Aligned ${mode}`);
  }
  distribute(axis: 'x' | 'y'): void {
    const units = this.units(); if (units.length < 3) { toast('Select three or more to space evenly'); return; }
    this.commit(offsetFrames(this.doc, this.sizeId, distribute(units, axis)), 'Spaced evenly');
  }
  group(): void {
    const ids = this.store.ui.sel; if (ids.length < 2) { toast('Select two or more to group'); return; }
    this.commit(groupNodes(this.doc, ids, newId()), 'Grouped');
  }
  ungroup(): void {
    if (!this.selected().some(n => n.group)) { toast('Nothing grouped'); return; }
    this.commit(ungroupNodes(this.doc, this.store.ui.sel), 'Ungrouped');
  }
  /** Selection expanded to whole groups. */
  withGroups(ids: string[]): string[] { return withGroups(this.doc, ids); }
  fillPage(): void { const n = this.one(); if (!n || n.locked) return; this.commit(fillPage(this.doc, this.sizeId, n.id, this.canvas()), 'Set as background'); }
  copyStyle(): void { const n = this.one() ?? this.selected()[0]; if (!n) return; this.styleClip = styleOf(n); toast('Style copied'); }
  pasteStyle(): void { const clip = this.styleClip; if (!clip) { toast('Copy a style first'); return; } this.editSel(n => applyStyle(n, clip), { message: 'Style pasted' }); }
  /** Eyedropper: the colour drawn on the document canvas under a pointer. */
  pickAt(e: { clientX: number; clientY: number }): void {
    const r = this.docCanvas.getBoundingClientRect(), k = this.docCanvas.width / r.width, x = Math.floor((e.clientX - r.left) * k), y = Math.floor((e.clientY - r.top) * k);
    this.store.setUI({ picking: false });
    if (x < 0 || y < 0 || x >= this.docCanvas.width || y >= this.docCanvas.height) return;
    const [red, g, b] = this.docCanvas.getContext('2d')!.getImageData(x, y, 1, 1).data, hex = `#${[red, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    this.applySwatch({ hex }); toast(`Picked ${hex.toUpperCase()}`);
  }
  // crop (D-045): double-click a photo; drag inside to move it, its corners to zoom, the frame's handles to crop.
  /** The photo being cropped with its frame, picture size and placement in frame-local units. */
  cropInfo(): { node: ImageNode; frame: Frame; natural: Size; place: Rect; bitmap: ImageBitmap } | null {
    const id = this.store.ui.crop, node = id ? nodeById(this.doc, id) : undefined;
    if (node?.kind !== 'image' || !node.asset) return null;
    const bitmap = this.image(node.asset, !!node.cutout, null);
    if (!bitmap) return null;
    const frame = this.frame(node), natural = { w: bitmap.width, h: bitmap.height };
    return { node, frame, natural, place: placement(natural, frame.rect, node.focus, node.zoom), bitmap };
  }
  private cropView() {
    const c = this.cropInfo(); if (!c) return null;
    const look = c.node.adjust || c.node.duotone ? (() => { const s = buildScene({ ...this.doc, nodes: [c.node] }, this.sizeId, measure).ops[0]; return s?.kind === 'image' ? s.look ?? null : null; })() : null;
    return { rect: c.frame.rect, rot: c.frame.rot, place: c.place, bitmap: (c.node.asset && this.image(c.node.asset, !!c.node.cutout, look)) || c.bitmap, flip: [!!c.node.flipX, !!c.node.flipY] as [boolean, boolean] };
  }
  startCrop(id = this.one()?.id): void {
    const n = id ? nodeById(this.doc, id) : undefined;
    if (n?.kind !== 'image' || !n.asset || n.locked) return;
    if (!this.image(n.asset, !!n.cutout, null)) { toast('The photo is still loading'); return; }
    this.finishText(); this.cropBefore = this.doc;
    this.store.setUI({ crop: n.id, sel: [n.id], panel: null, tool: null, armed: null });
  }
  /** Live crop change without a history step; endCrop records the session. */
  setCrop(frame: Frame, place: Rect): void {
    const c = this.cropInfo(); if (!c) return;
    const { focus, zoom } = fromPlacement(c.natural, frame.rect, place);
    this.store.set(updateNodes(this.doc, [c.node.id], n => {
      const next = { ...n, focus, frames: { ...n.frames, [this.sizeId]: frame } } as ImageNode;
      if (zoom > 1 + 1e-6) next.zoom = +zoom.toFixed(4); else delete next.zoom;
      return next;
    }));
  }
  setZoom(zoom: number): void {
    const n = this.one(); if (n?.kind !== 'image' || n.locked) return;
    const next = updateNodes(this.doc, [n.id], x => { const y = { ...x } as ImageNode; if (zoom > 1) y.zoom = zoom; else delete y.zoom; return y; });
    if (this.store.ui.crop) this.store.set(next); else this.store.commit(next, { key: 'zoom' });
  }
  resetCrop(): void { const c = this.cropInfo(); if (!c) return; this.store.set(updateNodes(this.doc, [c.node.id], n => { const y = { ...n } as ImageNode; delete y.zoom; delete y.focus; return y; })); }
  endCrop(): void {
    if (!this.store.ui.crop) return;
    const before = this.cropBefore; this.cropBefore = null;
    this.store.setUI({ crop: null });
    if (before && before !== this.doc && JSON.stringify(before.nodes) !== JSON.stringify(this.doc.nodes)) { this.store.commit(this.doc, { before }); toast('Cropped'); }
  }
  private updateCropBar(): void {
    const c = this.store.ui.crop ? this.cropInfo() : null;
    this.cropBar.classList.toggle('hidden', !c);
    if (!c) return;
    const b = rotatedBounds(c.frame.rect, c.frame.rot), zoom = this.cropBar.querySelector('input')!;
    this.cropBar.style.left = `${(b.x + b.w / 2) * this.scale}px`; this.cropBar.style.top = `${(b.y + b.h) * this.scale}px`;
    if (document.activeElement !== zoom) zoom.value = String(c.node.zoom ?? 1);
  }
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
      this.commit(updateNodes(this.doc, this.doc.nodes.filter(x => x.kind === 'image' && x.asset === asset).map(x => x.id), x => ({ ...x, cutout: true }) as ImageNode), 'Background removed');
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
    this.positionTextarea(); area.focus(); area.select();
    area.addEventListener('input', () => { const cur = nodeById(this.doc, id); if (cur?.kind === 'text') { this.store.set(updateNodes(this.doc, [id], n => ({ ...n, text: area.value }))); this.positionTextarea(); } });
    area.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); this.finishText(); this.overlay.focus(); } });
    area.addEventListener('blur', () => this.finishText());
    this.textBefore = before;
  }
  positionTextarea(): void {
    const area = this.textarea, id = this.store.ui.editing, node = id && this.store.doc ? nodeById(this.doc, id) : undefined;
    if (!area || node?.kind !== 'text') return;
    const f = this.frame(node), box = textBox(node, f, measure, this.typeScale()), k = this.scale, dir = direction(node.text || 'a');
    area.style.cssText = `left:${box.rect.x * k}px;top:${box.rect.y * k}px;width:${box.rect.w * k}px;height:${(box.rect.h + box.size * .4) * k}px;transform:rotate(${f.rot}deg);transform-origin:${box.rect.w * k / 2}px ${box.rect.h * k / 2}px;`
      + `font:${node.italic ? 'italic ' : ''}${node.weight} ${box.size * k}px ${fontStack(node.text, node.font)};line-height:${node.leading ?? LINE_HEIGHT};text-align:${physicalAlign(node.align, dir)};color:${this.colour(node.fill)};caret-color:${this.colour(node.fill)};`
      + `letter-spacing:${(node.spacing ?? 0) / 1000 * box.size * k}px;text-decoration:${node.underline ? 'underline' : 'none'};text-transform:${node.upper ? 'uppercase' : 'none'}`;
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
  within(m: Rect): string[] { return this.visible().filter(n => intersects(rotatedBounds(this.box(n), this.frame(n).rot), m)).map(n => n.id); }
  centreOf(n: DocNode): Point { return center(this.box(n)); }
}
export const title = (name: string): string => name.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
export function layerName(n: DocNode): string {
  if (n.kind === 'shape') return n.icon ? title(n.icon.name) : shapeLibrary[n.shape]?.name ?? 'Shape';
  if (n.kind === 'text') return n.text.split('\n')[0] || 'Text';
  if (n.kind === 'image') return n.asset ? (n.cutout ? 'Cut-out' : 'Image') : 'Image frame';
  return n.form ? { line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', tri: 'Triangle' }[n.form] : 'Ink';
}
