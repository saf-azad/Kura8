import type { ColourRef, DocNode, Frame, ImageNode, KuraDoc, Palette, RatioId, SizeSpec, TextNode } from '../core/document';
import { center, containsRotated, intersects, rotatedBounds, type Point, type Rect, type Size } from '../core/geometry';
import type { Anchor } from '../core/guides/types';
import { guideById } from '../core/guides';
import { canvasSize, ratioById, ratioNumbers } from '../core/ratios';
import { resolve } from '../core/palette';
import { defaultShapeSize, shapeLibrary, ICON_SHAPE } from '../core/shapes';
import { LINE_HEIGHT, textBox, typeScale, crossing, syncTextHeights, type TypeScale } from '../core/fit';
import { addNodes, duplicateNodes, nodeById, nudge, pasteNodes, removeNodes, reorder, setFill, setGround, setHidden, setLocked, updateNodes, type Order } from '../core/ops';
import { reRatio, flagsFor } from '../core/reratio';
import { addSize, removeSize } from '../core/sizes';
import { nearestCell, containIn, CENTRE } from '../core/images';
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
  readonly info: HTMLDivElement;
  constructor(root: HTMLElement, store: Store) {
    this.root = root; this.store = store;
    this.docCanvas = h('canvas', { className: 'doc', 'aria-label': 'Document' });
    this.overlay = h('canvas', { className: 'overlay', tabindex: 0, 'aria-label': 'Canvas: click to select, drag to move, double-click text to edit' });
    this.beforeAfter = h('div', { className: 'seg before-after hidden' }, h('button', { type: 'button', 'data-cut': '0' }, 'Before'), h('button', { type: 'button', 'data-cut': '1' }, 'After'));
    this.stack = h('div', { className: 'canvas-stack' }, this.docCanvas, this.overlay, this.beforeAfter);
    this.info = h('div', { className: 'info' });
    this.file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true, className: 'hidden' });
    const stage = h('div', { className: 'stage' }, this.stack);
    root.append(stage, this.info, this.file);
    stage.addEventListener('pointerdown', e => { if (e.target !== stage) return; this.finishText(); this.store.setUI({ sel: [], panel: null }); });
    this.renderer = new Canvas2DRenderer(this.docCanvas);
    this.beforeAfter.addEventListener('click', e => { const b = (e.target as Element).closest('button'); if (b) this.setCutout(b.dataset.cut === '1'); });
    this.file.addEventListener('change', () => { const files = [...this.file.files ?? []]; this.file.value = ''; const target = this.fillTarget; this.fillTarget = null; void this.placeFiles(files, null, target); });
    new ResizeObserver(() => this.fit()).observe(root);
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
    const sel = this.selected().filter(n => !this.frame(n).hidden && n.id !== this.store.ui.editing), single = sel.length === 1 && !this.store.ui.armed && !this.store.ui.tool;
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
  image = (asset: string, cutout: boolean): ImageBitmap | null | undefined => {
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
  };
  forgetBitmap(asset: string): void { for (const v of ['working', 'cutout'] as const) { const k = assets.bitmapKey(asset, v); this.bitmaps.delete(k); } this.missing.delete(asset); }
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
      flags: this.doc.nodes.filter(n => flagged.has(n.id) && flagsFor(n, this.frame(n), measure, this.canvas(), this.spec().guide).length).map(n => ({ rect: this.box(n), rot: this.frame(n).rot })), crossings,
      sketch: { ...this.live.sketch, stroke: this.inkWidth(), ink: this.colour({ role: 'ink' }) },
      scan: scan ? { rect: this.box(scan), rot: this.frame(scan).rot, t: ((performance.now() - this.scan!.t0) % 900) / 900 } : null,
    });
    if (this.scan) this.invalidate();
    this.updateBeforeAfter(); this.updateInfo();
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
    const n = this.one(), show = n?.kind === 'image' && !!n.asset && this.cutouts.has(n.asset) && !this.display && !this.store.ui.tool;
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
  /** A new text box records no history until it is finished with some text; left empty it simply goes away. */
  addText(): void {
    this.finishText();
    const c = this.canvas(), size = this.typeScale().headline, w = c.w * .5, node: TextNode = { id: newId(), kind: 'text', text: 'Text', weight: 700, align: 'start', fill: { role: 'ink' }, frames: this.framesFor(this.centred(w, size * LINE_HEIGHT), { fontSize: size }) };
    const before = this.doc;
    this.store.set(addNodes(before, [node]));
    this.store.setUI({ sel: [node.id], armed: null, panel: this.store.ui.panel === 'colour' ? null : this.store.ui.panel });
    this.editText(node.id, before);
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
    const hit = target ? nodeById(this.doc, target) : at ? this.hitTest(at) : undefined, c = this.canvas(), p = at ?? { x: c.w / 2, y: c.h / 2 };
    // Several images go to the nearest cells, one each; past the last cell they step down-right, kept on the canvas.
    let free = this.cells(), added = 0;
    for (const [i, file] of images.entries()) {
      let stored: { key: string; natural: Size };
      try { stored = await assets.putImage(file, this.maxExport()); } catch { toast('That image could not be read'); continue; }
      if (i === 0 && hit?.kind === 'image' && !hit.locked) { this.commit(updateNodes(this.doc, [hit.id], n => ({ ...n, asset: stored.key, cutout: false, focus: CENTRE }) as ImageNode), 'Filled'); this.select([hit.id]); continue; }
      let rect: Rect;
      if (free.length) { rect = nearestCell(p, free, c); free = free.filter(r => r.x !== rect.x || r.y !== rect.y || r.w !== rect.w || r.h !== rect.h); }
      else {
        rect = this.cells().length ? nearestCell(p, this.cells(), c) : containIn(nearestCell(p, [], c), stored.natural);
        const o = 20 * added; rect = { ...rect, x: Math.max(0, Math.min(c.w - rect.w, rect.x + o)), y: Math.max(0, Math.min(c.h - rect.h, rect.y + o)) };
      }
      added++;
      this.add([{ id: newId(), kind: 'image', asset: stored.key, frames: this.framesFor(rect) }], 'Image');
    }
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
  editOne(fn: (n: DocNode) => DocNode, key?: string): void { const n = this.one(); if (n && !n.locked) this.store.commit(syncTextHeights(updateNodes(this.doc, [n.id], fn), [n.id], measure), { key }); }
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
  /** Opens a panel, or closes it when it is already open. Focus left inside a closing panel goes back to the canvas, so the
   * next key is a shortcut rather than typing into a hidden field. */
  openPanel(panel: PanelId | null): void {
    const next = this.store.ui.panel === panel ? null : panel, a = document.activeElement;
    if (next !== this.store.ui.panel && a instanceof HTMLElement && a.closest('.panel, .sheet, .modal')) this.overlay.focus({ preventScroll: true });
    this.store.setUI({ panel: next });
  }
  setTool(tool: Tool | null): void { this.finishText(); this.live = emptyLive(); this.store.setUI({ tool, panel: null, armed: null, sel: tool ? [] : this.store.ui.sel }); }
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
  editText(id: string, from?: KuraDoc): void {
    const node = nodeById(this.doc, id);
    if (node?.kind !== 'text' || node.locked) return;
    this.finishText();
    const before = from ?? this.doc, area = h('textarea', { className: 'text-editor', 'aria-label': 'Edit text', spellcheck: 'false', dir: 'auto' });
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
      + `font:${node.weight} ${box.size * k}px ${fontStack(node.text)};line-height:${LINE_HEIGHT};text-align:${physicalAlign(node.align, dir)};color:${this.colour(node.fill)};caret-color:${this.colour(node.fill)}`;
  }
  finishText(): void {
    const area = this.textarea;
    if (!area) return;
    this.textarea = null; const id = this.store.ui.editing, before = this.textBefore; this.textBefore = null;
    area.remove(); this.store.setUI({ editing: null });
    const node = id ? nodeById(this.doc, id) : undefined;
    if (!node || node.kind !== 'text') return;
    if (!node.text.trim()) {
      const next = removeNodes(this.doc, [node.id]);
      if (before && !nodeById(before, node.id)) this.store.set(next); else this.store.commit(next, { before: before ?? undefined });
      this.select([]); return;
    }
    const synced = syncTextHeights(this.doc, [node.id], measure);
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
