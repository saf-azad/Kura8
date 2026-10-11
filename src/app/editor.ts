import type { ColourRef, DocNode, FontId, Frame, ImageNode, KuraDoc, Palette, RatioId, SizeSpec, TextNode } from '../core/document';
import { center, containsRotated, intersects, norm, rotatedBounds, type Point, type Rect, type Size } from '../core/geometry';
import type { Anchor } from '../core/guides/types';
import { guideById } from '../core/guides';
import { canvasSize, ratioById, ratioNumbers } from '../core/ratios';
import { contrast, resolve } from '../core/palette';
import { defaultShapeSize, shapeLibrary, ICON_SHAPE } from '../core/shapes';
import { LINE_HEIGHT, roomSize, splitsWord, textBox, textHeight, typeScale, crossing, type TypeScale } from '../core/fit';
import { addNodes, addUnderText, setName, duplicateNodes, nodeById, nudge, pasteNodes, removeNodes, reorder, setFill, setFrames, setGround, setHidden, setLocked, updateNodes, type Order } from '../core/ops';
import { reRatioKept, flagsFor, type RatioOrigin } from '../core/reratio';
import { flowText, hugText, sitsOn, unfit } from '../core/flow';
import { keepReadable, layoutPad } from '../core/compositions';
import { align, distribute, matchSize, type AlignMode } from '../core/arrange';
import { drawnWeight, fontById } from '../core/fonts';
import { letterOf } from './tools/shortcuts';
import { addSize, removeSize } from '../core/sizes';
import { containIn, CENTRE, freeSpot, fullImageRect, panFocus, spreadCells, tiles } from '../core/images';
import { direction, fontStack, physicalAlign } from '../core/script';
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
  /** Another tab's save that arrived while typing; taken in, with the typed text on top, when the edit ends. */
  foreign: KuraDoc | null = null;
  /** Presses anywhere are ignored until then: the second click of a double-click on Start (D-062). */
  ignorePointerUntil = 0;
  /** Where the click that started it was, in window pixels; the guard covers only clicks near it (D-086). */
  ignorePointerAt: { x: number; y: number } | null = null;
  /** A block the Text tool just added: while it is first typed it pushes no other text, which was not stacked under it (D-083). */
  private fresh: string | null = null;
  /** True while a click places a just-added label: the editor's blur is not a finish (D-086). */
  private placing = false;
  /** The just-added label was put where the person clicked: it stays there (D-086). */
  private placed = false;
  /** A repeated Enter or Space from Start or Go is ignored until then, or until another key is typed. */
  ignoreKeysUntil = 0;
  private textBefore: KuraDoc | null = null;
  /** The document a label's growth is judged from: as the edit began, or as a click placed the just-added label (D-087). */
  private hugBase: KuraDoc | null = null;
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
      h('button', { type: 'button', 'data-act': 'fill', title: 'Fill the whole canvas, behind everything else' }, 'Fill canvas'),
      h('button', { type: 'button', 'data-act': 'circle', title: 'Show the picture in a circle', 'aria-pressed': 'false' }, 'Circle'),
      h('span', { className: 'cut' }, h('button', { type: 'button', 'data-cut': '0' }, 'Before'), h('button', { type: 'button', 'data-cut': '1' }, 'After')));
    this.stack = h('div', { className: 'canvas-stack' }, this.docCanvas, this.overlay, this.imageBar);
    this.info = h('div', { className: 'info' });
    this.file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg,image/heic,image/heif,.heic,.heif', multiple: true, className: 'hidden' });
    const stage = h('div', { className: 'stage' }, this.stack);
    root.append(stage, this.info, this.file);
    stage.addEventListener('pointerdown', e => { if (e.target !== stage) return; this.finishText(); this.store.setUI({ sel: [], panel: null }); });
    // The second click of a double-click on Start lands wherever the Start button was, on the canvas or the stage around a
    // wide one: it must not close the headline editor (D-062, D-077). Controls answer at once (D-083).
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick'] as const) {
      document.addEventListener(type, e => {
        const t = e.target instanceof Element ? e.target : null;
        // Only near where the Start or Go click was: a click anywhere else is a choice and answers at once (D-086).
        const near = !this.ignorePointerAt || Math.hypot((e as MouseEvent).clientX - this.ignorePointerAt.x, (e as MouseEvent).clientY - this.ignorePointerAt.y) < 60;
        if (performance.now() < this.ignorePointerUntil && near && t !== this.textarea && t?.closest('.stage') && !t.closest('button, input')) { e.preventDefault(); e.stopPropagation(); }
      }, true);
    }
    // Likewise a second Enter or Space on Start would put an empty line or a space at the start of the headline.
    // Only until another key is typed, so a fast typist's first space is kept (D-083).
    document.addEventListener('keydown', e => {
      if (performance.now() >= this.ignoreKeysUntil) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); } else this.ignoreKeysUntil = 0;
    }, true);
    this.renderer = new Canvas2DRenderer(this.docCanvas);
    this.imageBar.addEventListener('click', e => {
      const b = (e.target as Element).closest('button'), n = this.one();
      if (b?.dataset.act === 'circle' && this.pictures()) { const sel = this.selected(), open = sel.filter(x => !x.locked && !this.frame(x).hidden); this.toggleCircle(open.map(x => x.id)); if (open.length < sel.length) toast(`${sel.length - open.length} locked or hidden left as they are`); return; }
      if (!b || n?.kind !== 'image') return;
      if (b.dataset.act === 'pick') { this.finishReposition(); this.pickImage(n.id); }
      else if (b.dataset.act === 'move') { if (this.store.ui.reposition) this.finishReposition(); else this.startReposition(n.id); }
      else if (b.dataset.act === 'fit') this.fitFrame(n.id);
      else if (b.dataset.act === 'fill') this.fillCanvas(n.id);
      else if (b.dataset.act === 'circle') this.toggleCircle([n.id]);
      else this.setCutout(b.dataset.cut === '1');
    });
    this.file.addEventListener('change', () => { const files = [...this.file.files ?? []]; this.file.value = ''; const target = this.fillTarget; this.fillTarget = null; void this.placeFiles(files, null, target); });
    new ResizeObserver(() => this.fit()).observe(root);
    let evict = 0;
    // A flagged block that is back on the canvas (moved, restyled, undone) loses its flag.
    store.on(c => {
      const flags = store.ui.flags;
      if (!c.doc || !flags.length || !store.doc) return;
      const spec = this.spec(), canvas = canvasSize(spec.ratio), still = flags.filter(f => { const n = nodeById(store.doc!, f.id), fr = n?.frames[spec.id]; return !!n && !!fr && flagsFor(n, fr, measure, canvas, spec.guide).some(x => x.kind === f.kind); });
      if (still.length !== flags.length) store.setUI({ flags: still });
    });
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
  cells(sizeId = this.sizeId): Rect[] {
    const s = this.doc.sizes.find(x => x.id === sizeId) ?? this.spec();
    return s.guide ? guideById(s.guide).generate(canvasSize(s.ratio)).flatMap(a => a.kind === 'region' && (a.id.startsWith('region-cell') || a.id.startsWith('region-quad')) ? [a.rect] : []) : [];
  }
  typeScale(): TypeScale { return typeScale(this.spec().guide, this.canvas()); }
  frame(n: DocNode): Frame { return n.frames[this.sizeId] ?? Object.values(n.frames)[0]; }
  /** The drawn box of a node in the active size (text grows to its lines). */
  box(n: DocNode, doc = this.doc): Rect { const f = n.frames[this.spec(doc).id]; return n.kind === 'text' ? textBox(n, f, measure, typeScale(this.spec(doc).guide, canvasSize(this.spec(doc).ratio))).rect : f.rect; }
  visible(doc = this.doc): DocNode[] { return doc.nodes.filter(n => !n.frames[this.spec(doc).id]?.hidden); }
  selected(): DocNode[] { const s = new Set(this.store.ui.sel); return this.doc.nodes.filter(n => s.has(n.id)); }
  one(): DocNode | undefined { const s = this.selected(); return s.length === 1 ? s[0] : undefined; }
  /** Several unlocked pictures selected (a tiled team page): the picture bar offers Circle for all of them (D-083). */
  pictures(): boolean { const s = this.selected(); return s.length > 1 && s.every(n => n.kind === 'image') && s.filter(n => !n.locked && !this.frame(n).hidden).length > 0; }
  palette(): Palette { const p = this.doc.palette, d = this.store.ui.previewDark; return d === null ? p : { ...p, dark: d }; }
  colour(ref: ColourRef): string { return resolve(ref, this.palette()); }
  /** Unit-space point under a pointer event. */
  toUnits(e: { clientX: number; clientY: number }): Point { const r = this.overlay.getBoundingClientRect(); return { x: (e.clientX - r.left - MARGIN) / this.scale, y: (e.clientY - r.top - MARGIN) / this.scale }; }
  hitTest(p: Point): DocNode | undefined { return [...this.visible()].reverse().find(n => containsRotated(this.box(n), this.frame(n).rot, p)); }
  /** Alt+click (D-065): the block under the selected one at this point, cycling back to the top. */
  hitBelow(p: Point): DocNode | undefined {
    const all = [...this.visible()].reverse().filter(n => containsRotated(this.box(n), this.frame(n).rot, p)), at = all.findIndex(n => this.store.ui.sel.includes(n.id));
    return at < 0 ? all[0] : all[(at + 1) % all.length];
  }
  boxes(): Box[] {
    const sel = this.selected().filter(n => !this.frame(n).hidden && n.id !== this.store.ui.editing), single = sel.length === 1 && !this.store.ui.armed && !this.store.ui.tool;
    return sel.map(n => {
      const handles: HandleSet = !single || n.id === this.store.ui.reposition ? 'none' : n.kind === 'image' ? (n.mask === 'circle' ? 'corners' : 'all') : n.kind === 'shape' && n.icon ? 'corners' : n.kind === 'text' ? (n.fit ? 'fit' : 'text') : 'all';
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
    const n = this.one(), ui = this.store.ui, free = !this.display && !ui.tool && !ui.armed, show = n?.kind === 'image' && !n.locked && free;
    const many = !show && free && this.pictures();
    this.imageBar.classList.toggle('hidden', !show && !many);
    this.imageBar.classList.toggle('many', many);
    if (many) {
      const sel = this.selected(), all = sel.every(x => x.kind === 'image' && x.mask === 'circle'), b = sel.map(x => rotatedBounds(this.box(x), this.frame(x).rot));
      const x0 = Math.min(...b.map(r => r.x)), x1 = Math.max(...b.map(r => r.x + r.w)), y1 = Math.max(...b.map(r => r.y + r.h));
      this.imageBar.querySelector('[data-act="circle"]')!.setAttribute('aria-pressed', String(all));
      this.imageBar.classList.remove('inside');
      this.imageBar.style.left = `${(x0 + x1) / 2 * this.scale}px`; this.imageBar.style.top = `${Math.min(y1, this.canvas().h) * this.scale}px`;
      return;
    }
    if (!show || n?.kind !== 'image') return;
    const moving = ui.reposition === n.id, cut = !!n.asset && this.cutouts.has(n.asset) && !moving, [pick, move, fit, fill, circle] = [...this.imageBar.querySelectorAll<HTMLButtonElement>('[data-act]')];
    const natural = this.natural(n), r = this.frame(n).rect;
    fit.classList.toggle('hidden', moving || n.mask === 'circle' || !natural || Math.abs(Math.log((r.w / r.h) / (natural.w / natural.h))) < .01);
    pick.textContent = n.asset ? 'Replace' : 'Choose picture'; pick.classList.toggle('hidden', moving);
    fill.classList.toggle('hidden', moving || this.isBackground(n) && this.doc.nodes[0]?.id === n.id && !n.mask);
    circle.classList.toggle('hidden', moving); circle.setAttribute('aria-pressed', String(n.mask === 'circle'));
    const fitted = !!natural && Math.abs(Math.log((r.w / r.h) / (natural.w / natural.h))) < .01;
    move.textContent = moving ? 'Done' : 'Reposition'; move.classList.toggle('hidden', !n.asset || fitted && !moving); move.setAttribute('aria-pressed', String(moving));
    this.imageBar.querySelector('.cut')!.classList.toggle('hidden', !cut);
    const b = rotatedBounds(this.box(n), this.frame(n).rot);
    // Inside the picture's bottom edge when it is tall enough, so the bar does not cover what sits under it.
    this.imageBar.classList.toggle('inside', b.h * this.scale > 120);
    this.imageBar.style.left = `${(b.x + b.w / 2) * this.scale}px`; this.imageBar.style.top = `${Math.min(b.y + b.h, this.canvas().h) * this.scale}px`;
    this.imageBar.querySelectorAll<HTMLButtonElement>('[data-cut]').forEach(btn => btn.setAttribute('aria-pressed', String((btn.dataset.cut === '1') === !!n.cutout)));
  }
  /** A picture whose frame is the whole canvas, unturned, in the active size: a background. */
  private isBackground(n: DocNode): boolean { const f = this.frame(n), r = f.rect, c = this.canvas(); return !f.rot && Math.abs(r.x) < .5 && Math.abs(r.y) < .5 && Math.abs(r.w - c.w) < .5 && Math.abs(r.h - c.h) < .5; }
  /** Fit (D-048): the frame shrinks to the picture's proportions inside its current box, so the whole picture shows. */
  fitFrame(id: string): void {
    const n = nodeById(this.doc, id); if (n?.kind !== 'image' || n.locked) return;
    const natural = this.natural(n), f = this.frame(n); if (!natural) return;
    this.finishReposition();
    this.commit(setFrames(updateNodes(this.doc, [id], x => ({ ...x, focus: CENTRE }) as ImageNode), this.sizeId, { [id]: { ...f, rect: containIn(f.rect, natural) } }), 'Fitted to the picture');
  }
  /** Fill canvas (D-077, D-081): the frame becomes the whole canvas in every size, unturned, and goes behind everything; the picture covers it. */
  fillCanvas(id: string): void {
    const n = nodeById(this.doc, id); if (n?.kind !== 'image' || n.locked) return;
    this.finishReposition();
    // Every size: a background is a background in each linked size (D-081).
    const frames = Object.fromEntries(this.doc.sizes.filter(s => n.frames[s.id]).map(s => [s.id, { ...n.frames[s.id], rot: 0, rect: { x: 0, y: 0, ...canvasSize(s.ratio) } }]));
    // A background is a rectangle: Fill canvas drops the circle (D-083).
    const fill = (x: DocNode): DocNode => { const m = { ...x, frames: { ...x.frames, ...frames } } as ImageNode; delete m.mask; return m; };
    this.commit(reorder({ ...this.doc, nodes: this.doc.nodes.map(x => x.id === id ? fill(x) : x) }, [id], 'back'), 'Fills the canvas · sent to the back');
  }
  /** Circle (D-081): the picture shows in the ellipse its frame bounds; turning it on squares the frame about its centre in this size. */
  toggleCircle(ids: string[]): void {
    const pics = ids.map(id => nodeById(this.doc, id)).filter((n): n is ImageNode => n?.kind === 'image' && !n.locked); if (!pics.length) return;
    const on = !pics.every(n => n.mask === 'circle');
    let doc = updateNodes(this.doc, pics.map(n => n.id), x => { const m = { ...x } as ImageNode; if (on) m.mask = 'circle'; else delete m.mask; return m; });
    // A circle is round in every linked size (D-083): each frame becomes the square centred in it.
    if (on) for (const n of pics) for (const s of doc.sizes) {
      const f = n.frames[s.id]; if (!f || n.mask === 'circle') continue;
      const side = Math.min(f.rect.w, f.rect.h);
      doc = setFrames(doc, s.id, { [n.id]: { ...f, rect: { x: f.rect.x + (f.rect.w - side) / 2, y: f.rect.y + (f.rect.h - side) / 2, w: side, h: side } } });
    }
    this.commit(doc, on ? 'Circle' : 'Full frame');
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
  /** A picture whose frame shows all of it (after Fit, or placed whole). */
  fitted(n: ImageNode): boolean { const a = this.natural(n), r = this.frame(n).rect; return !!a && r.h > 0 && Math.abs(Math.log((r.w / r.h) / (a.w / a.h))) < .01; }
  natural(n: ImageNode): Size | null { const b = n.asset ? this.image(n.asset, !!n.cutout) : null; return b ? { w: b.width, h: b.height } : null; }
  nudgePicture(id: string, dx: number, dy: number): void { const n = nodeById(this.doc, id); if (n?.kind === 'image') this.panPicture(id, n.focus ?? CENTRE, { x: dx, y: dy }); }
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
    // New text in an automatic colour reads on the ground it lands on (a dark filled ground, D-081).
    this.commit(keepReadable(addNodes(this.doc, nodes)), message);
    this.store.setUI({ sel: nodes.map(n => n.id), armed: null, panel: this.store.ui.panel === 'colour' ? null : this.store.ui.panel });
  }
  centred(w: number, hgt: number): Rect { const c = this.canvas(), o = this.nextOffset(); return { x: (c.w - w) / 2 + o, y: (c.h - hgt) / 2 + o, w, h: hgt }; }
  /**
   * The Text tool adds a label (D-083): one step above body size, regular weight, hugging its word so it grows as it is
   * typed, in the spot the blocks in each size cover least, so it never lands on a face, a number or the headline.
   */
  addText(): void {
    const node: TextNode = { id: newId(), kind: 'text', text: 'Text', weight: 400, align: 'start', fill: { role: 'ink' }, frames: {} };
    // One step above body, but in a short size (Header, Banner) never above what its layout gives a headline (D-085).
    const step = (c: Size, ts: TypeScale) => Math.max(ts.body, Math.min(ts.steps[2], c.h * .06)), c0 = this.canvas(), here = step(c0, this.typeScale());
    for (const s of this.doc.sizes) {
      // Another linked size scales it as Change ratio would scale text from this one, so it never outsizes text there (D-086).
      const c = canvasSize(s.ratio), ts = typeScale(s.guide, c), k = Math.min(c.w / c0.w, c.h / c0.h), grow = k >= 1 ? Math.max(1, ts.body / this.typeScale().body) : k;
      const size = s.id === this.sizeId ? here : Math.max(ts.body * .75, Math.min(step(c, ts), here * grow)), w = textWidth(node.text, size, 400) * 1.02, h = textHeight(1, size);
      const at = freeSpot({ size: { w: Math.min(c.w * .4, w * 4), h }, canvas: c, cells: this.cells(s.id), ...this.occupied(s.id), pad: Math.min(c.w, c.h) * .045 });
      node.frames[s.id] = { rect: { x: at.x, y: at.y, w, h }, rot: 0, fontSize: size };
    }
    this.add([node]); this.editText(node.id); this.fresh = node.id; this.placed = false;
  }
  addShape(key: string): void {
    const def = shapeLibrary[key], s = defaultShapeSize(def.ar, this.canvas()), swatch = this.store.ui.swatch, rect = this.centred(s.w, s.h);
    let fill: ColourRef = 'role' in swatch && swatch.role === 'ground' ? { role: 'accent' } : swatch;
    // A shape the same colour as what it lands on would vanish: it takes ink, or accent on ink.
    const under = this.colourUnder(center(rect));
    if (contrast(this.colour(fill), under) < 1.5) fill = contrast(this.colour({ role: 'ink' }), under) >= 1.5 ? { role: 'ink' } : { role: 'accent' };
    this.add([{ id: newId(), kind: 'shape', shape: key, fill, frames: this.framesFor(rect) }], def.name);
  }
  /** The colour at a point: the topmost solid shape there, else the ground (pictures count as unknown and give the ground). */
  colourUnder(p: Point): string {
    for (const n of [...this.visible()].reverse()) if (n.kind === 'shape' && !n.icon && (n.opacity ?? 1) >= 1 && containsRotated(this.box(n), this.frame(n).rot, p)) return this.colour(n.fill);
    return this.colour(this.doc.ground ?? { role: 'ground' });
  }
  /** Icons arrive small, in the spot the blocks cover least in each size, not on the centre over the layout (D-077). */
  addIcon(name: string, d: string, flattened: boolean): void {
    const frames: Record<string, Frame> = {};
    for (const s of this.doc.sizes) {
      const c = canvasSize(s.ratio), side = Math.min(c.w, c.h) * .16;
      frames[s.id] = { rect: { ...freeSpot({ size: { w: side, h: side }, canvas: c, cells: this.cells(s.id), ...this.occupied(s.id), pad: Math.min(c.w, c.h) * .045 }), w: side, h: side }, rot: 0 };
    }
    this.add([{ id: newId(), kind: 'shape', shape: ICON_SHAPE, fill: { role: 'ink' }, icon: { set: 'phosphor', name, d, licence: 'MIT' }, frames }],
      flattened ? `${title(name)} · flattened to one ink` : title(name));
  }
  /** Image tool (D-061): picks pictures from the computer, for a selected empty frame or as new images. */
  imageTool(): void {
    // A selected empty frame, else the layout's empty frame takes the first picture, whatever is selected (D-076, D-077).
    const one = this.one(), empty = (n: DocNode | undefined) => n?.kind === 'image' && !n.asset && !n.locked;
    const frame = empty(one) ? one!.id : this.visible().find(n => empty(n))?.id ?? null;
    this.pickImage(frame);
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
    let hit = target ? nodeById(this.doc, target) : at ? this.hitTest(at) : undefined;
    const added: { key: string; natural: Size; name: string }[] = [], skipped: string[] = [];
    // A picture is named after its file in Layers, so a mood board's rows tell apart (D-086).
    const stem = (f: File) => f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80);
    // A drop on a background picture (Fill canvas) adds a picture instead of swapping the background; Replace swaps it (D-083).
    if (!target && hit?.kind === 'image' && hit.asset && this.doc.nodes[0]?.id === hit.id && this.isBackground(hit)) hit = undefined;
    if (!target && hit?.locked && (hit.kind === 'image' || hit.kind === 'shape' && hit.shape === 'circle')) skipped.push('the frame under it is locked');
    // A pick or drop of several files is one undo step (D-083).
    let first = true;
    const put = (doc: KuraDoc, message?: string): void => { this.store.commit(doc, first ? {} : { before: null }); first = false; if (message) toast(message); };
    if (files.length > images.length) skipped.push(`${files.length - images.length} not an image`);
    // The Image tool fills its frame, then the other empty frames in order, before adding new pictures (D-077); a drop
    // fills only the block under it.
    const fills = target ? [target, ...this.visible().filter(n => n.kind === 'image' && !n.asset && !n.locked && n.id !== target).map(n => n.id)] : hit ? [hit.id] : [];
    // Several pictures for one empty frame share it as tiles (a team page, a mood board) instead of piling up (D-081).
    let shared: ImageNode | null = null, filled = 0;
    // A picture dropped on a circle shape takes its place as a circle picture (D-081).
    let ring = !target && hit?.kind === 'shape' && hit.shape === 'circle' && !hit.locked ? hit : null;
    for (const original of images) {
      let stored: { key: string; natural: Size }, clear = false, file: Blob = original;
      try {
        // SVG logos are drawn once at twice the largest export size; nothing they reference is fetched (D-059).
        if (kind(original) === 'svg') file = await assets.svgToPng(original, Math.min(4096, 2 * this.maxExport()));
        stored = await assets.putImage(file, this.maxExport()); clear = await assets.hasTransparency(file);
      } catch (e) {
        skipped.push((e as Error)?.message === 'Empty SVG' ? `${original.name || 'one SVG'} draws nothing` : kind(original) === 'heic' ? 'HEIC: save it as JPEG (iPhone: Share → Options → Most Compatible)' : kind(original) === 'svg' && /foreignObject/i.test(await original.text().catch(() => '')) ? 'SVG with embedded HTML: export it as PNG' : `${original.name || 'one file'} could not be read`);
        continue;
      }
      // A see-through picture (logo, sticker) dropped on a photo goes on top of it; onto an empty frame it fills the
      // frame and the frame takes the picture's proportions, so a logo is never cropped (D-047).
      if (ring) {
        // An oval circle shape gives a round picture centred in it, in every size (D-085).
        const frames = Object.fromEntries(Object.entries(ring.frames).map(([k, f]) => { const side = Math.min(f.rect.w, f.rect.h); return [k, { ...f, rect: { x: f.rect.x + (f.rect.w - side) / 2, y: f.rect.y + (f.rect.h - side) / 2, w: side, h: side } }]; }));
        const img: ImageNode = { id: newId(), kind: 'image', asset: stored.key, mask: 'circle', frames, ...(stem(original) ? { name: stem(original) } : {}), ...(ring.opacity !== undefined ? { opacity: ring.opacity } : {}) };
        const id = ring.id; ring = null; fills.length = 0;
        // More pictures dropped with it share the circle as round tiles, as in a circle frame (D-086).
        if (images.length > 1) shared = img;
        put({ ...this.doc, nodes: this.doc.nodes.map(n => n.id === id ? img : n) }, 'Filled the circle'); this.select([img.id]); continue;
      }
      const into = fills.length ? nodeById(this.doc, fills.shift()!) : undefined;
      if (into?.kind === 'image' && !into.locked && !(clear && into.asset && !target)) {
        if (!into.asset && !shared && images.length > 1) shared = into;
        const f = this.frame(into), rect = clear ? containIn(f.rect, stored.natural) : f.rect;
        filled++;
        put(setFrames(updateNodes(this.doc, [into.id], n => ({ ...n, asset: stored.key, cutout: false, focus: CENTRE, ...(!n.name && stem(original) ? { name: stem(original) } : {}) }) as ImageNode), this.sizeId, { [into.id]: { ...f, rect } }), 'Filled');
        this.select([into.id]); continue;
      }
      if (!target) fills.length = 0;
      added.push({ ...stored, name: stem(original) });
    }
    // Skipped files are named in the closing toast, so a batch never hides them (D-074).
    const note = skipped.length ? ` · skipped ${skipped.join('; ')}` : '';
    if (!added.length) { if (skipped.length) toast(`${filled ? `Filled ${filled === 1 ? 'the frame' : `${filled} frames`}` : 'Nothing added'}${note}`, 3600); return; }
    if (shared) {
      // The frame and the pictures left over split the frame's area in every size; each picture covers its tile. A
      // turned frame turns its tiles about its own centre, and a circle frame gives round tiles (D-083).
      const n = 1 + added.length, ids = added.map(() => newId()), frames: Record<string, Record<string, Frame>> = Object.fromEntries([shared.id, ...ids].map(id => [id, {}]));
      const round = shared.mask === 'circle';
      for (const s of this.doc.sizes) {
        const f = shared.frames[s.id]; if (!f) continue;
        const c = canvasSize(s.ratio), t = tiles(f.rect, n, Math.min(c.w, c.h) * .015), o = center(f.rect), th = f.rot * Math.PI / 180;
        [shared.id, ...ids].forEach((id, i) => {
          const side = Math.min(t[i].w, t[i].h), w = round ? side : t[i].w, h = round ? side : t[i].h, d = { x: t[i].x + t[i].w / 2 - o.x, y: t[i].y + t[i].h / 2 - o.y };
          const cx = o.x + d.x * Math.cos(th) - d.y * Math.sin(th), cy = o.y + d.x * Math.sin(th) + d.y * Math.cos(th);
          frames[id][s.id] = { ...f, rect: { x: cx - w / 2, y: cy - h / 2, w, h } };
        });
      }
      const doc = { ...this.doc, nodes: this.doc.nodes.map(n => n.id === shared!.id ? { ...n, frames: { ...n.frames, ...frames[n.id] } } : n) };
      const nodes: DocNode[] = added.map((a, i) => ({ id: ids[i], kind: 'image', asset: a.key, frames: frames[ids[i]], ...(a.name ? { name: a.name } : {}), ...(round ? { mask: 'circle' as const } : {}), ...(shared!.opacity !== undefined ? { opacity: shared!.opacity } : {}) }));
      const at = doc.nodes.findIndex(n => n.id === shared!.id) + 1;
      put({ ...doc, nodes: [...doc.nodes.slice(0, at), ...nodes, ...doc.nodes.slice(at)] }, `${n} pictures share the frame${note}`);
      this.store.setUI({ sel: [shared.id, ...ids], armed: null }); return;
    }
    // New pictures spread over the emptiest guide cells (the drop point's cell first), keep their own proportions
    // inside them, and go under the text (D-047, D-058); one picture dropped at a point goes where it was put, on top, so
    // a logo dropped over the headline is the block a press there takes (D-087). One undo step for the batch.
    const c = this.canvas(), p = at ?? { x: c.w / 2, y: c.h / 2 }, taken = this.taken();
    const boxes = spreadCells(p, this.cells(), taken, added.length, c, !!at, added.length > 1 ? this.occupied().text : []);
    const nodes: DocNode[] = added.map((a, i) => ({ id: newId(), kind: 'image', asset: a.key, frames: this.framesFor(containIn(boxes[i], a.natural)), ...(a.name ? { name: a.name } : {}) }));
    // A small file drawn much larger than its pixels (a 240 px logo across a slide) is said to look soft (D-086).
    const px = exportSize(this.spec().ratio, { scale: 1 }).w / c.w, soft = added.filter((a, i) => containIn(boxes[i], a.natural).w * px > a.natural.w * 1.5).length;
    const small = soft ? ` · ${soft === 1 && added.length === 1 ? 'it is' : soft === 1 ? 'one is' : `${soft} are`} small and may look soft` : '';
    put(at && nodes.length === 1 ? addNodes(this.doc, nodes) : addUnderText(this.doc, nodes)); toast(`${nodes.length > 1 ? `${nodes.length} images` : 'Image'}${small}${note}`, note || small ? 3600 : 1300);
    this.store.setUI({ sel: nodes.map(n => n.id), armed: null });
  }
  remove(): void {
    this.finishReposition();
    const ids = this.selected().filter(n => !n.locked).map(n => n.id);
    if (!ids.length) return;
    this.commit(removeNodes(this.doc, ids), this.doc.sizes.length > 1 ? 'Deleted from every size · Hide in Layers keeps it in the others' : 'Deleted'); this.select([]);
  }
  duplicate(): void {
    const r = duplicateNodes(this.doc, this.store.ui.sel, newId);
    if (!r.ids.length) return;
    this.commit(r.doc, 'Duplicated'); this.select(r.ids);
  }
  /** What occupies the canvas for placing new things: blocks' rotated bounds, text by the extent of its lines rather than its box (an autofit room is mostly empty). */
  taken(sizeId = this.sizeId): Rect[] {
    return this.doc.nodes.filter(n => n.frames[sizeId] && !n.frames[sizeId].hidden).map(n => rotatedBounds(n.kind === 'text' ? this.extent(n, sizeId) : n.frames[sizeId].rect, n.frames[sizeId].rot));
  }
  /** What occupies a size, text apart from pictures and blocks, for placing pasted copy and icons (D-081). */
  occupied(sizeId = this.sizeId, skip?: string): { taken: Rect[]; text: Rect[] } {
    const { taken, text } = this.blocks(sizeId, skip);
    return { taken, text };
  }
  /** The blocks shown in a size: pictures and shapes, text, and the unturned shapes a label may sit on (`backs`, a subset of `taken`). */
  private blocks(sizeId: string, skip?: string): { taken: Rect[]; text: Rect[]; backs: Rect[] } {
    const shown = this.doc.nodes.filter(n => n.id !== skip && n.frames[sizeId] && !n.frames[sizeId].hidden), bounds = (n: DocNode) => rotatedBounds(n.kind === 'text' ? this.extent(n, sizeId) : n.frames[sizeId].rect, n.frames[sizeId].rot);
    const solid = shown.filter(n => n.kind !== 'text').map(n => ({ n, r: bounds(n) }));
    return { taken: solid.map(x => x.r), text: shown.filter(n => n.kind === 'text').map(bounds),
      backs: solid.filter(({ n }) => n.kind === 'shape' && n.shape !== ICON_SHAPE && !n.frames[sizeId].rot).map(x => x.r) };
  }
  /** Where a text block's letters are: its lines' height and widest line, on the side its alignment puts them. */
  extent(n: TextNode, sizeId = this.sizeId): Rect {
    const s = this.doc.sizes.find(x => x.id === sizeId) ?? this.spec(), b = textBox(n, n.frames[sizeId] ?? this.frame(n), measure, typeScale(s.guide, canvasSize(s.ratio))), w = Math.min(b.rect.w, Math.max(0, ...b.lines.map(l => textWidth(l, b.size, drawnWeight(n.font, n.weight), n.font))));
    const side = physicalAlign(n.align, direction(n.text)), x = side === 'left' ? b.rect.x : side === 'center' ? b.rect.x + (b.rect.w - w) / 2 : b.rect.x + b.rect.w - w;
    return { x, y: b.rect.y, w, h: Math.min(b.rect.h, b.lines.length * b.size * LINE_HEIGHT) };
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
    // Pasted copy arrives at body size (D-074): it hugs its widest line, and longer copy wraps at 60 % of the width, so a
    // pasted price list is no wider than its prices (D-087). In every size it takes that size's body size and the spot the
    // blocks there cover least, so several pastes never pile up and a paste in one size does not land on another size's
    // headline (D-077).
    const node: TextNode = { id: newId(), kind: 'text', text, weight: 400, align: 'start', fill: { role: 'ink' }, frames: {} }, long = text.length > 40 || text.includes('\n');
    for (const s of this.doc.sizes) {
      const c = canvasSize(s.ratio), size = typeScale(s.guide, c).body, widest = Math.max(...text.split('\n').map(p => textWidth(p.trim(), size, 400)));
      const w = Math.min(long ? c.w * .6 : c.w * .8, Math.max(widest * 1.02, size));
      const h = textHeight(measure(text, size, 400, w).length, size), at = freeSpot({ size: { w, h }, canvas: c, cells: this.cells(s.id), ...this.occupied(s.id), pad: Math.min(c.w, c.h) * .045 });
      node.frames[s.id] = { rect: { ...at, w, h }, rot: 0, fontSize: size };
    }
    this.add([node], 'Pasted text'); this.flagText([node.id]);
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
  rename(id: string, name: string): void { const next = setName(this.doc, id, name); if (JSON.stringify(next) !== JSON.stringify(this.doc)) this.commit(next, 'Renamed'); }
  setLock(id: string, lock: boolean): void { this.commit(setLocked(this.doc, [id], lock), lock ? 'Locked' : 'Unlocked'); }
  setHidden(id: string, hidden: boolean): void { this.commit(setHidden(this.doc, this.sizeId, [id], hidden), (hidden ? 'Hidden' : 'Shown') + (this.doc.sizes.length > 1 ? ' in this size' : '')); if (hidden) this.select(this.store.ui.sel.filter(x => x !== id)); }
  reorder(mode: Order, ids = this.store.ui.sel): void {
    if (!ids.length) return;
    const next = reorder(this.doc, ids, mode);
    if (next.nodes.every((n, i) => n === this.doc.nodes[i])) { if (ids.every(id => nodeById(this.doc, id)?.locked)) toast('Locked · unlock it to change its order'); return; }
    this.commit(next, { front: 'Brought to front', back: 'Sent to back', forward: 'Brought forward', backward: 'Sent backward' }[mode]);
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
  /** A colour for some blocks only (the failing text of a selection, D-082), whatever else is selected. */
  /** Each unlocked block takes its own colour, in one step (the contrast fix, D-083). */
  fillEach(refs: Record<string, ColourRef>): void {
    let doc = this.doc;
    for (const [id, ref] of Object.entries(refs)) if (!nodeById(doc, id)?.locked) doc = setFill(doc, [id], ref);
    if (doc !== this.doc) this.commit(doc);
  }
  /** The ground takes a colour directly (Colour panel, D-077), and paint stops. */
  fillGround(ref: ColourRef): void { this.store.setUI({ armed: null }); this.commit(keepReadable(setGround(this.doc, ref)), 'Ground filled'); }
  paintAt(node: DocNode | undefined): void {
    const armed = this.store.ui.armed; if (!armed) return;
    if (!node) { this.commit(keepReadable(setGround(this.doc, armed)), 'Ground filled'); return; }
    if (node.kind === 'image' || node.locked) return;
    this.commit(setFill(this.doc, [node.id], armed));
  }
  /** A palette change; text on an accent block that would stop reading takes the readable colour again (D-077). */
  setPalette(patch: Partial<Palette>, message?: string): void { this.commit(keepReadable({ ...this.doc, palette: { ...this.doc.palette, ...patch } }), message); }
  /** Edits the one selected node; text that changes height moves the text stacked under it (D-046). */
  editOne(fn: (n: DocNode) => DocNode, key?: string): void {
    const n = this.one(); if (!n || n.locked) return;
    const next = updateNodes(this.doc, [n.id], fn);
    this.store.commit(n.kind === 'text' ? flowText(this.doc, next, n.id, measure) : next, { key });
    if (n.kind === 'text') this.flagAllText();
  }
  /** Selected unlocked text blocks; text controls apply to all of them (D-063). */
  texts(): TextNode[] { return this.selected().filter((n): n is TextNode => n.kind === 'text' && !n.locked); }
  /** Edits every selected text block; text under each one follows its new height and off-canvas text is flagged. */
  editTexts(fn: (n: TextNode) => TextNode, key?: string): void {
    const ids = this.texts().map(n => n.id); if (!ids.length) return;
    let doc = this.doc;
    for (const id of ids) doc = flowText(doc, hugText(doc, updateNodes(doc, [id], n => fn(n as TextNode)), id, measure), id, measure);
    this.store.commit(doc, { key }); this.flagAllText();
  }
  fontStep(dir: 1 | -1): void {
    const r = this.resizeTexts(current => Math.max(6, current + dir * Math.max(2, Math.round(current * .1))));
    if (!r) return;
    this.store.commit(r.doc, { key: 'font' }); this.flagAllText();
    if (r.note) toast(r.note, 1800);
  }
  private withSize(doc: KuraDoc, id: string, size: number): KuraDoc {
    return updateNodes(doc, [id], x => ({ ...x, frames: { ...x.frames, [this.sizeId]: { ...x.frames[this.sizeId], fontSize: size } } }) as TextNode);
  }
  /**
   * Where a text block's bottom may grow to in the active size: for layout text, above the first unturned picture or
   * shape below it (the poster band); else the canvas bottom; less the layout margin (D-085). A free label is bounded by
   * the canvas only, so a label just above a block can still grow (D-086).
   */
  private bottomLimit(doc: KuraDoc, n: TextNode): number {
    const s = this.spec(doc), c = canvasSize(s.ratio), pad = layoutPad(c), b = textBox(n, n.frames[s.id], measure, typeScale(s.guide, c)).rect;
    let limit = c.h - pad;
    for (const o of doc.nodes) {
      const f = o.frames[s.id];
      if (!n.slot || o.id === n.id || o.kind === 'text' || o.kind === 'ink' || !f || f.hidden || f.rot) continue;
      const r = f.rect;
      if (r.x < b.x + b.w && b.x < r.x + r.w && r.y >= b.y + b.h - 1e-6) limit = Math.min(limit, r.y - pad);
    }
    return limit;
  }
  /**
   * The size a text block can take when asked for `want` (Larger or a typed size). An autofit block stops at the
   * largest size its room holds (`roomSize`). Other text stops where a word would break, at the width it would really
   * grow to, or where its bottom would pass the block below it or the canvas bottom (D-077, D-081, D-085). A block whose
   * word already breaks keeps its size rather than shrinking (D-083).
   */
  private sizeCap(doc: KuraDoc, id: string, want: number, current: number): { size: number; note: string } {
    if (want <= current + 1e-6) return { size: want, note: '' };
    const n = nodeById(doc, id) as TextNode, f = n.frames[this.sizeId], scale = this.typeScale();
    if (n.fit) {
      const got = roomSize({ text: n.text, size: want, width: f.rect.w, height: f.rect.h, weight: drawnWeight(n.font, n.weight), measure, font: n.font });
      return got < want - 1e-6 ? { size: Math.max(got, current), note: 'Largest size that fits its space' } : { size: want, note: '' };
    }
    const b0 = textBox(n, f, measure, scale).rect, limit = Math.max(this.bottomLimit(doc, n), b0.y + b0.h);
    // A free label on a block (a photo caption, a pill) grows only as far as the block holds it (D-083, D-087).
    const on = !n.slot && !f.rot ? sitsOn(doc, id, this.sizeId, f.rect, true) : null, block = on ? nodeById(doc, on)!.frames[this.sizeId].rect : null;
    const held = (r: Rect) => !block || r.x >= block.x - .5 && r.y >= block.y - .5 && r.x + r.w <= block.x + block.w + .5 && r.y + r.h <= block.y + block.h + .5;
    const test = (size: number) => {
      const d = hugText(doc, this.withSize(doc, id, size), id, measure), m = nodeById(d, id) as TextNode, g = m.frames[this.sizeId], b = textBox(m, g, measure, scale);
      return { whole: !splitsWord(m.text, b.lines), fits: !!g.rot || b.rect.y + b.rect.h <= limit + 1e-6 && held(b.rect) };
    };
    const top = test(want);
    if (top.whole && top.fits) return { size: want, note: '' };
    if (!test(current).whole) return { size: current, note: 'A word is already wider than the box' };
    let lo = current, hi = want;
    while (hi - lo > .5) { const mid = (lo + hi) / 2, t = test(mid); if (t.whole && t.fits) lo = mid; else hi = mid; }
    // The note names what stops it just past the size it gets, and how a free label gets more room (D-087).
    const stop = test(hi), space = n.slot ? 'Largest size that fits its space' : block ? 'Largest size that fits on its block' : 'Largest size that fits above the canvas bottom · move it up for more';
    return { size: Math.max(current, Math.floor(lo * 2) / 2), note: stop.fits ? 'Largest size that keeps every word whole' : space };
  }
  /**
   * Resizes every selected unlocked text block to `want(current)`, capped (`sizeCap`). A hand-set size turns autofit off
   * (5q, D-034), and every other linked size keeps the size autofit gave it (`unfit`, D-085).
   */
  private resizeTexts(want: (current: number) => number): { doc: KuraDoc; first: number; note: string } | null {
    const ids = this.texts().filter(n => !n.locked).map(n => n.id);
    if (!ids.length) return null;
    let doc = this.doc, first: number | null = null, note = '';
    // Blocks that share a size keep sharing it: the one with least room sets it for all (four names, D-087).
    const now = (d: KuraDoc, id: string) => { const n = nodeById(d, id) as TextNode; return textBox(n, n.frames[this.sizeId], measure, this.typeScale()).size; };
    const sizes = ids.map(id => now(doc, id)), same = sizes.every(x => Math.abs(x - sizes[0]) < .5);
    const shared = same && ids.length > 1 ? Math.min(...ids.map((id, i) => this.sizeCap(doc, id, want(sizes[i]), sizes[i]).size)) : null;
    for (const id of ids) {
      const current = now(doc, id), w = want(current), r = this.sizeCap(doc, id, shared ?? w, current);
      if (r.size < w - 1e-6 && !note) note = shared !== null && shared < w - 1e-6 ? 'Largest size that fits them all' : r.note;
      first ??= r.size;
      doc = flowText(doc, hugText(doc, this.withSize(unfit(doc, id, measure, this.sizeId), id, r.size), id, measure), id, measure);
    }
    return { doc, first: first!, note };
  }
  /** Sets the typeface of every selected unlocked text block; text under each one follows its new height (D-046). */
  async setFont(font: FontId): Promise<void> {
    const ids = this.selected().filter(n => n.kind === 'text' && !n.locked).map(n => n.id);
    if (!ids.length) return;
    // Measure in the real face, so the text under it moves by the right amount.
    await Promise.all([loadFont(font, 400), loadFont(font, 700)]);
    let doc = this.doc;
    for (const id of ids) doc = flowText(doc, hugText(doc, updateNodes(doc, [id], n => { const t = { ...n, font } as TextNode; if (font === 'grotesk') delete t.font; return t; }), id, measure), id, measure);
    this.store.commit(doc, {}); this.flagAllText();
  }
  /** Marks text that runs off the canvas after an edit (the 5v flag), and clears the mark once it fits again. */
  flagText(ids: string[]): void {
    const c = this.canvas(), guide = this.spec().guide, set = new Set(ids);
    const fresh = this.doc.nodes.filter(n => set.has(n.id) && n.kind === 'text' && n.frames[this.sizeId]).flatMap(n => flagsFor(n, n.frames[this.sizeId], measure, c, guide));
    this.store.setUI({ flags: [...this.store.ui.flags.filter(f => !set.has(f.id)), ...fresh] });
  }
  /** A typed font size for the selected text (D-060); a manual size turns autofit off, like Smaller and Larger. */
  setFontSize(value: number): number | null {
    const want = Math.max(4, Math.min(2000, value)), r = this.resizeTexts(() => want);
    if (!r) return null;
    if (r.note) toast(`${r.note}: ${Math.round(r.first * 10) / 10}`, 2200);
    this.store.commit(r.doc, {}); this.flagAllText();
    return r.first;
  }
  /** A typed angle for the selection, about each block's centre (D-060). */
  setAngle(deg: number): number | null {
    const ids = this.selected().filter(n => !n.locked).map(n => n.id), rot = norm(deg);
    if (!ids.length) return null;
    this.store.commit(setFrames(this.doc, this.sizeId, Object.fromEntries(ids.map(id => { const f = nodeById(this.doc, id)!.frames[this.sizeId]; return [id, { ...f, rot: Math.abs(rot) < 1e-9 ? 0 : rot }]; }))), {});
    return Math.abs(rot) < 1e-9 ? 0 : rot;
  }
  /** Re-checks every text block in this size after an edit, so text pushed off the canvas is flagged and text back on it is not. */
  flagAllText(): void { this.flagText(this.doc.nodes.filter(n => n.kind === 'text').map(n => n.id)); }
  toggleBold(): void {
    // A single-weight face (Bebas Neue) has no bold to switch to; say so rather than change a weight nobody sees.
    const texts = this.texts(), two = texts.filter(n => fontById(n.font).weights.length > 1);
    if (texts.length && !two.length) { toast(`${fontById(texts[0].font).name} has one weight`); return; }
    const weight = two.every(n => n.weight === 700) ? 400 : 700, ids = new Set(two.map(n => n.id));
    this.editTexts(n => ids.has(n.id) ? { ...n, weight } : n);
  }
  cycleAlign(): void { const a = this.texts()[0]?.align, align = a === 'start' ? 'center' : a === 'center' ? 'end' : 'start'; this.editTexts(n => ({ ...n, align })); }
  /** Autofit on keeps today's box; the size then steps down the type scale as text grows (5q). */
  toggleFit(): void {
    const on = !this.texts()[0]?.fit;
    // Off: every size keeps the size autofit gave it (D-085).
    if (!on) { let doc = this.doc; for (const n of this.texts().filter(x => !x.locked)) doc = unfit(doc, n.id, measure); if (doc !== this.doc) this.store.commit(doc, {}); return; }
    this.editTexts(n => {
      // The box keeps today's height, but never more than the space above the block below it or the canvas bottom (D-085).
      const f = this.frame(n), b = this.box(n), room = this.bottomLimit(this.doc, n) - f.rect.y;
      return { ...n, fit: true, frames: { ...n.frames, [this.sizeId]: { ...f, rect: { ...f.rect, h: Math.max(Math.min(b.h, room), this.typeScale().body * LINE_HEIGHT) } } } };
    });
  }
  /** Align or distribute the selection (D-063): one block to the canvas, several to their joint bounds. */
  arrange(mode: AlignMode | 'spread-x' | 'spread-y'): void {
    const shown = this.selected().filter(n => !this.frame(n).hidden), sel = shown.filter(n => !n.locked);
    if (!sel.length) return;
    // Unturned text lines up by its letters, not the empty part of its box (a price list aligned to its end, D-087).
    const bounds = (n: DocNode) => n.kind === 'text' && !this.frame(n).rot ? this.extent(n) : rotatedBounds(this.box(n), this.frame(n).rot), boxes = sel.map(n => ({ id: n.id, rect: bounds(n) }));
    if (mode.startsWith('spread') && shown.length < 3) { toast('Select three or more to space evenly'); return; }
    // Locked blocks in the selection stay put: the others line up with them (D-072) and space evenly around them (D-077).
    // With none, centring several blocks keeps the largest still and brings the others onto it (an icon onto a circle, D-086).
    const locked = shown.filter(n => n.locked).map(bounds), area = (n: DocNode) => { const r = bounds(n); return r.w * r.h; };
    const largest = (mode === 'hcenter' || mode === 'vcenter') && !locked.length && sel.length > 1 ? [...sel].sort((a, b) => area(b) - area(a))[0] : null;
    const key = largest ? [bounds(largest)] : locked;
    const moves = mode === 'spread-x' || mode === 'spread-y' ? distribute(shown.map(n => ({ id: n.id, rect: bounds(n) })), mode === 'spread-x' ? 'x' : 'y', shown.filter(n => n.locked).map(n => n.id)) : align(boxes, mode, { x: 0, y: 0, ...this.canvas() }, key);
    // Nothing to move is said, not recorded as a step (D-083).
    if (sel.every(n => { const m = moves[n.id]; return !m || Math.abs(m.dx) < 1e-6 && Math.abs(m.dy) < 1e-6; })) { toast(mode.startsWith('spread') ? 'Already evenly spaced' : 'Already aligned'); return; }
    const frames = Object.fromEntries(sel.map(n => { const f = this.frame(n), m = moves[n.id] ?? { dx: 0, dy: 0 }; return [n.id, { ...f, rect: { ...f.rect, x: f.rect.x + m.dx, y: f.rect.y + m.dy } }]; }));
    // A block sent past the canvas edge is said so, since it would be cut from the export (D-087).
    const next = setFrames(this.doc, this.sizeId, frames), c = this.canvas(), off = Object.keys(frames).filter(id => {
      const n = nodeById(next, id)!, b = rotatedBounds(n.kind === 'text' ? this.extent(n, this.sizeId) : n.frames[this.sizeId].rect, n.frames[this.sizeId].rot);
      return b.x < -.5 || b.y < -.5 || b.x + b.w > c.w + .5 || b.y + b.h > c.h + .5;
    }).length;
    this.commit(next, (mode.startsWith('spread') ? 'Spaced evenly' : largest ? 'Centred on the largest block' : key.length ? 'Aligned to the locked block' : sel.length === 1 ? 'Aligned to the canvas' : 'Aligned')
      + (off ? ` · ${off === 1 ? 'one block runs' : `${off} blocks run`} past the canvas edge` : ''));
    this.flagText(Object.keys(frames));
  }
  /** Same width or height (D-077): the selection takes the locked block's size, else the first one picked; text takes widths only; pictures match exactly and re-cover their frames, so equal tiles are possible (D-081). */
  matchSize(mode: 'w' | 'h'): void {
    const shown = this.selected().filter(n => !this.frame(n).hidden);
    if (shown.length < 2) { toast('Select two or more to match sizes'); return; }
    // Text that takes its height from its lines neither gives nor takes a height (D-083).
    const lines = (n: DocNode) => mode === 'h' && n.kind === 'text' && !n.fit, order = this.store.ui.sel;
    const key = shown.find(n => n.locked && !lines(n)) ?? [...shown].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).find(n => !lines(n));
    const others = key ? shown.filter(n => n !== key && !n.locked && !lines(n)) : [];
    if (!key || !others.length) { toast(mode === 'h' ? 'Text takes its height from its lines' : 'Nothing to match'); return; }
    const rects = matchSize(others.map(n => ({ id: n.id, rect: this.frame(n).rect, keepAspect: n.kind === 'shape' && !!n.icon || n.kind === 'image' && n.mask === 'circle', rot: this.frame(n).rot })), this.frame(key).rect, mode);
    // Pictures match exactly and re-cover their frames (D-081); one that showed whole now crops, which is said (D-084).
    const cropped = others.filter(n => n.kind === 'image' && n.mask !== 'circle' && this.fitted(n)).map(n => n.id);
    const doc = setFrames(this.doc, this.sizeId, Object.fromEntries(others.map(n => [n.id, { ...this.frame(n), rect: rects[n.id] }])));
    const crops = cropped.filter(id => { const n = nodeById(doc, id); return n?.kind === 'image' && !this.fitted({ ...n, frames: n.frames }); }).length;
    this.commit(doc, `${mode === 'w' ? 'Same width' : 'Same height'}${crops ? ` · ${crops === 1 ? 'a picture now crops' : `${crops} pictures now crop`}; Fit shows it whole` : ''}`);
    this.flagAllText();
  }
  // A step that swaps whole designs (across New, or the one Undo kept after a reload) says so (D-077).
  undo(): void { this.finishReposition(); const id = this.doc.id; if (this.store.undo()) toast(this.doc.id !== id ? 'Undo · back to the previous design' : 'Undo', this.doc.id !== id ? 2200 : undefined); else toast('Nothing to undo'); }
  redo(): void { this.finishReposition(); const id = this.doc.id; if (this.store.redo()) toast(this.doc.id !== id ? 'Redo · back to the newer design' : 'Redo', this.doc.id !== id ? 2200 : undefined); else toast('Nothing to redo'); }
  // sizes and ratio (5v, 5w)
  changeRatio(ratio: RatioId): void {
    if (ratio === this.spec().ratio) return;
    if (!this.ratioOrigins.size) this.loadOrigins();
    const { doc, flags, origin } = reRatioKept(this.doc, this.sizeId, { ratio }, measure, this.ratioOrigins.get(this.sizeId));
    this.ratioOrigins.set(this.sizeId, origin); this.saveOrigins();
    this.store.commit(doc, {}); this.store.setUI({ flags });
    const r = ratioById(ratio);
    toast(flags.length ? `${r.label} ${ratioNumbers(ratio)} · ${new Set(flags.map(f => f.id)).size} flagged` : `${r.label} ${ratioNumbers(ratio)}`, 1800);
  }
  /** Ratio origins outlive a reload (D-076): kept per document in the browser, never in the document. */
  private loadOrigins(): void { try { const v = JSON.parse(localStorage.getItem('kura8:origins') ?? 'null'); if (v?.doc === this.doc.id) this.ratioOrigins = new Map(Object.entries(v.sizes as Record<string, RatioOrigin>)); } catch { /* none */ } }
  private saveOrigins(): void { try { localStorage.setItem('kura8:origins', JSON.stringify({ doc: this.doc.id, sizes: Object.fromEntries(this.ratioOrigins) })); } catch { /* full: round trips start fresh */ } }
  addSize(ratio: RatioId): void {
    const id = newId(), { doc, flags } = addSize(this.doc, ratio, id, measure);
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
    // It runs on this computer and can take up to a minute; say so while the scan line runs (D-086).
    toast('Removing the background on this computer · up to a minute', 4000);
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
    // Whether the block hugs its words is judged as the edit began, not at each keystroke: a column whose line happens to
    // fill its box while typing must not start growing (D-082).
    area.addEventListener('input', e => {
      const cur = nodeById(this.doc, id); if (cur?.kind !== 'text') return;
      let prev = this.doc;
      // A paragraph pasted into the label the Text tool just added arrives at body size in every size, as pasted copy does (D-074, D-087).
      if (id === this.fresh && (e as InputEvent).inputType === 'insertFromPaste' && (area.value.length > 40 || area.value.includes('\n'))) {
        prev = updateNodes(prev, [id], n => ({ ...n, frames: Object.fromEntries(Object.entries(n.frames).map(([sid, f]) => {
          const spec = prev.sizes.find(x => x.id === sid), body = spec ? typeScale(spec.guide, canvasSize(spec.ratio)).body : f.fontSize;
          return [sid, { ...f, fontSize: Math.min(f.fontSize ?? Infinity, body ?? Infinity) }];
        })) }));
      }
      const next = hugText(this.hugBase ?? before, updateNodes(prev, [id], n => ({ ...n, text: area.value })), id, measure);
      this.store.set(id === this.fresh ? next : flowText(prev, next, id, measure)); this.positionTextarea();
    });
    area.addEventListener('keydown', e => {
      const mod = (e.metaKey || e.ctrlKey) && !e.altKey;
      // Undo before typing anything leaves the text and undoes the last change (e.g. New); Mod+B bolds the block being typed.
      if (mod && letterOf(e) === 'z' && !e.shiftKey && area.value === node.text) { e.preventDefault(); e.stopPropagation(); this.finishText(); this.undo(); return; }
      if (mod && letterOf(e) === 'b') { e.preventDefault(); e.stopPropagation(); const cur = nodeById(this.doc, id); if (cur?.kind === 'text' && fontById(cur.font).weights.length < 2) { toast(`${fontById(cur.font).name} has one weight`); return; } if (cur?.kind === 'text') { this.store.set(updateNodes(this.doc, [id], n => ({ ...n, weight: (n as TextNode).weight === 700 ? 400 : 700 }) as TextNode)); this.positionTextarea(); } return; }
      if (e.key === 'Escape' || e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); this.finishText(); this.overlay.focus({ preventScroll: true }); } });
    // A click on the untouched placeholder keeps it selected, so typing replaces "Text" rather than splitting it (D-087).
    area.addEventListener('mousedown', e => { if (id === this.fresh && area.value === 'Text') { e.preventDefault(); area.focus({ preventScroll: true }); area.select(); } });
    area.addEventListener('blur', () => { if (!this.placing) this.finishText(); });
    this.textBefore = before; this.hugBase = before;
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
    // A label the Text tool just added is one undo step with its first typing (D-085).
    this.textarea = null; const id = this.store.ui.editing, fresh = id !== null && id === this.fresh, before = this.textBefore; this.textBefore = null; this.hugBase = null; this.fresh = null;
    area.remove(); this.store.setUI({ editing: null });
    const node = id ? nodeById(this.doc, id) : undefined;
    if (!node || node.kind !== 'text') return;
    const foreign = this.foreign; this.foreign = null;
    if (foreign) {
      // Another tab saved while this one typed (D-062): its document wins, with the typed text merged in. A New there
      // keeps this design one Undo away; a block deleted there comes back, since this tab was still writing it (D-077).
      if (foreign.id !== this.doc.id) { this.store.commit(foreign, { before: this.doc }); toast('Another tab started a new design · Undo brings this one back', 3200); return; }
      const there = nodeById(foreign, node.id), empty = !node.text.trim();
      let merged = foreign;
      // Emptying the block removes it, unless the other tab rewrote it meanwhile: the newer words stay (D-082).
      const started = before ? nodeById(before, node.id) : undefined, rewritten = there?.kind === 'text' && started?.kind === 'text' && there.text !== started.text;
      if (empty) merged = there && !rewritten ? removeNodes(foreign, [node.id]) : foreign;
      else if (there?.kind === 'text') merged = flowText(foreign, updateNodes(foreign, [node.id], n => ({ ...n, text: node.text })), node.id, measure);
      else if (!there) {
        const first = node.frames[this.sizeId] ?? Object.values(node.frames)[0], frames = Object.fromEntries(foreign.sizes.map(s => [s.id, node.frames[s.id] ?? first]));
        const nodes = [...foreign.nodes]; nodes.splice(Math.min(this.doc.nodes.findIndex(n => n.id === node.id), nodes.length), 0, { ...node, frames });
        merged = { ...foreign, nodes };
      }
      this.store.commit(merged, { before: before ?? undefined }); toast(empty ? 'Updated from another tab' : 'Updated from another tab · your text is kept', 2400); return;
    }
    // A label added and left untouched (T, then Escape) goes again, as if never added (D-086).
    if (fresh && before && node.text === 'Text') { this.store.undo(); this.select([]); return; }
    if (!node.text.trim()) { this.store.commit(removeNodes(this.doc, [node.id]), { before: before ?? undefined }); this.select([]); return; }
    const f = this.frame(node), b = this.box(node);
    let synced = node.fit ? this.doc : updateNodes(this.doc, [node.id], n => ({ ...n, frames: { ...n.frames, [this.sizeId]: { ...f, rect: { ...f.rect, h: b.h } } } }));
    if (fresh) synced = keepReadable(this.placed ? synced : this.settle(synced, node.id));
    this.placed = false;
    if (before && JSON.stringify(nodeById(before, node.id)) !== JSON.stringify(nodeById(synced, node.id))) this.store.commit(synced, { before: fresh ? null : before }); else this.store.set(synced);
    this.flagAllText();
  }
  /**
   * A just-added label that its first typing grew over other blocks (a pasted paragraph over the headline) moves, in each
   * size, to the spot its new size covers least, when that covers less (D-086).
   */
  private settle(doc: KuraDoc, id: string): KuraDoc {
    const n = nodeById(doc, id); if (n?.kind !== 'text') return doc;
    let out = doc, moved = false;
    const overlap = (a: Rect, t: Rect) => Math.max(0, Math.min(a.x + a.w, t.x + t.w) - Math.max(a.x, t.x)) * Math.max(0, Math.min(a.y + a.h, t.y + t.h) - Math.max(a.y, t.y));
    const within = (t: Rect, r: Rect) => r.x >= t.x - 1e-6 && r.y >= t.y - 1e-6 && r.x + r.w <= t.x + t.w + 1e-6 && r.y + r.h <= t.y + t.h + 1e-6;
    // A band or pill that holds the whole label costs nothing; one it straddles counts (D-087).
    const cover = (r: Rect, o: { taken: Rect[]; text: Rect[]; backs: Rect[] }, c: Size) => o.taken.reduce((a, t) => a + (o.backs.includes(t) && within(t, r) ? 0 : overlap(r, t)), 0)
      + 10 * o.text.reduce((a, t) => a + overlap(r, t), 0) + (r.y + r.h > c.h ? r.w * (r.y + r.h - c.h) * 10 : 0);
    for (const s of doc.sizes) {
      const f = n.frames[s.id]; if (!f || f.hidden || f.rot) continue;
      const c = canvasSize(s.ratio), r = textBox(n, f, measure, typeScale(s.guide, c)).rect, o = this.blocks(s.id, id), pad = layoutPad(c);
      const now = cover(r, o, c);
      if (now < 1) continue;
      // The spot its new size covers least, or the same place lifted onto the canvas when it runs off the bottom (D-087).
      const at = freeSpot({ size: { w: r.w, h: r.h }, canvas: c, cells: this.cells(s.id), ...o, pad });
      const options = [{ x: at.x, y: at.y }, ...r.y + r.h > c.h - pad && r.h <= c.h - 2 * pad ? [{ x: r.x, y: c.h - pad - r.h }] : []];
      const best = options.map(p => ({ p, k: cover({ ...r, ...p }, o, c) })).sort((a, b) => a.k - b.k)[0];
      if (best.k < now) { out = setFrames(out, s.id, { [id]: { ...f, rect: { ...f.rect, x: f.rect.x + best.p.x - r.x, y: best.p.y } } }); moved ||= s.id === this.sizeId; }
    }
    if (moved) toast('Moved where it has room');
    return out;
  }
  /** T, then a click on the canvas: the label just added moves to the click and stays in editing (Canva habit, D-086). */
  placeFresh(p: Point): boolean {
    const id = this.store.ui.editing, area = this.textarea;
    if (!area || !id || id !== this.fresh || area.value !== 'Text') return false;
    const n = nodeById(this.doc, id); if (n?.kind !== 'text') return false;
    const f = this.frame(n), c = this.canvas();
    this.store.set(setFrames(this.doc, this.sizeId, { [id]: { ...f, rect: { ...f.rect, x: Math.max(0, Math.min(p.x, c.w - f.rect.w)), y: Math.max(0, Math.min(p.y, c.h - f.rect.h)) } } }));
    // Its growth is judged from where it was put, so the first key does not send it back (D-087).
    this.hugBase = this.doc;
    this.placing = true; this.placed = true; this.positionTextarea();
    requestAnimationFrame(() => { area.focus({ preventScroll: true }); area.select(); this.placing = false; });
    return true;
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
  if (n.name) return n.name;
  if (n.kind === 'shape') return n.icon ? title(n.icon.name) : shapeLibrary[n.shape]?.name ?? 'Shape';
  if (n.kind === 'text') return n.text.split('\n')[0] || 'Text';
  if (n.kind === 'image') return n.asset ? (n.cutout ? 'Cut-out' : 'Image') : 'Image frame';
  return n.form ? { line: 'Line', arrow: 'Arrow', rect: 'Rectangle', ellipse: 'Ellipse', tri: 'Triangle' }[n.form] : 'Ink';
}
