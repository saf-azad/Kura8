import type { KuraDoc } from '../../core/document';
import type { Measure } from '../../core/geometry';
import { buildScene, gradientLine, rgba, type SceneOp } from '../../core/scene';
import { coverCrop } from '../../core/images';
import type { Look } from '../../core/look';
// The document canvas draws ground and nodes only, from the same scene the SVG export uses. Overlay marks live on
// a second canvas; export renders offscreen through this same class. Effects (D-045): opacity, page-fixed drop
// shadows, mirroring, inside borders, gradients, shape masks and photo looks.
export type ImageSource = (asset: string, cutout: boolean, look?: Look | null) => ImageBitmap | null | undefined;
export type RenderOptions = {
  sizeId: string; scale: number; measure: Measure;
  /** Exact output size in pixels (exports); the scale then differs per axis by the rounding of the print size. */ pixels?: { w: number; h: number };
  /** Decoded picture of an asset with a look applied; undefined while it is still loading. */ image: ImageSource;
  /** Leave the ground transparent (5z). */ transparent?: boolean;
  /** Draw empty and missing image frames as slate placeholders (editor only). */ placeholders?: boolean;
};
export interface Renderer { render(doc: KuraDoc, opts: RenderOptions): void }
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const paths = new Map<string, Path2D>();
/** A path, optionally stretched out of its 100-unit box, cached by data and scale. */
export function pathOf(d: string, scale?: [number, number]): Path2D {
  const key = scale ? `${scale[0]},${scale[1]}|${d}` : d;
  let p = paths.get(key);
  if (!p) {
    const raw = new Path2D(d);
    if (scale) { p = new Path2D(); p.addPath(raw, new DOMMatrix([scale[0], 0, 0, scale[1], 0, 0])); } else p = raw;
    if (paths.size > 500) paths.clear();
    paths.set(key, p);
  }
  return p;
}
/** An inside border: the outline stroked twice as wide and clipped to itself. */
function border(ctx: Ctx, path: Path2D, o: SceneOp): void {
  const b = o.fx?.outline;
  if (!b) return;
  ctx.save(); ctx.clip(path, 'evenodd'); ctx.strokeStyle = b.colour; ctx.lineWidth = 2 * b.width; ctx.lineJoin = 'round'; ctx.stroke(path); ctx.restore();
}
/** Draws an op in its own unrotated box (top-left at 0, 0), mirrored when flipped. */
function drawBody(ctx: Ctx, o: SceneOp, opts: RenderOptions): void {
  const { rect: r } = o, flip = o.fx?.flip;
  if (flip) { ctx.translate(flip[0] ? r.w : 0, flip[1] ? r.h : 0); ctx.scale(flip[0] ? -1 : 1, flip[1] ? -1 : 1); }
  if (o.kind === 'shape') {
    const path = pathOf(o.d, o.scale);
    if (o.gradient) { const [x0, y0, x1, y1] = gradientLine(r.w, r.h, o.gradient.angle), g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, o.gradient.from); g.addColorStop(1, o.gradient.to); ctx.fillStyle = g; }
    else ctx.fillStyle = o.fill;
    ctx.fill(path, 'evenodd'); border(ctx, path, o);
  } else if (o.kind === 'text') {
    ctx.font = `${o.italic ? 'italic ' : ''}${o.weight} ${o.size}px ${o.font}`; ctx.textBaseline = 'middle'; ctx.textAlign = o.align;
    if ('direction' in ctx) ctx.direction = o.dir;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${o.spacing ?? 0}px`;
    const x = o.align === 'left' ? 0 : o.align === 'center' ? r.w / 2 : r.w, b = o.fx?.outline;
    if (b) { ctx.strokeStyle = b.colour; ctx.lineWidth = 2 * b.width; ctx.lineJoin = 'round'; o.lines.forEach((line, i) => ctx.strokeText(line, x, i * o.lineHeight + o.lineHeight / 2)); }
    ctx.fillStyle = o.fill;
    o.lines.forEach((line, i) => {
      const y = i * o.lineHeight + o.lineHeight / 2;
      ctx.fillText(line, x, y);
      if (o.underline && line) {
        const w = ctx.measureText(line).width, left = o.align === 'left' ? 0 : o.align === 'center' ? x - w / 2 : x - w;
        ctx.fillRect(left, y + o.size * .36, w, Math.max(1, o.size * .06));
      }
    });
  } else if (o.kind === 'ink') {
    ctx.strokeStyle = o.fill; ctx.lineWidth = o.stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (const p of o.paths) p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  } else {
    const bitmap = o.asset ? opts.image(o.asset, o.cutout, o.look) : undefined, outline = o.mask ? pathOf(o.mask.d, o.mask.scale) : null;
    if (bitmap) {
      const c = coverCrop({ w: bitmap.width, h: bitmap.height }, r, o.focus, o.zoom);
      ctx.save(); if (outline) ctx.clip(outline, 'evenodd');
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, c.x, c.y, c.w, c.h, 0, 0, r.w, r.h);
      ctx.restore();
    } else if (opts.placeholders) {
      const line = 2 / opts.scale;
      ctx.save(); if (outline) ctx.clip(outline, 'evenodd');
      ctx.fillStyle = 'rgba(156,171,194,.35)'; ctx.fillRect(0, 0, r.w, r.h);
      ctx.strokeStyle = '#9CABC2'; ctx.lineWidth = line; ctx.strokeRect(line / 2, line / 2, r.w - line, r.h - line);
      ctx.restore();
    }
    if (bitmap || opts.placeholders) { const p = outline ?? new Path2D(); if (!outline) p.rect(0, 0, r.w, r.h); border(ctx, p, o); }
  }
}
const layerCanvas = (w: number, h: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
export function drawOp(ctx: Ctx, o: SceneOp, opts: RenderOptions): void {
  const { rect: r, fx } = o;
  // Device pixels per unit before this op's own transform: shadows are set in device pixels and stay page-fixed.
  const m = ctx.getTransform(), k = Math.hypot(m.a, m.b);
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2); if (o.rot) ctx.rotate(o.rot * Math.PI / 180); ctx.translate(-r.w / 2, -r.h / 2);
  // A shadow, or opacity over overlapping parts (a border on a fill), draws the op once into a layer first.
  if (fx?.shadow || fx?.opacity !== undefined && fx.outline) {
    const pad = 8 + (fx.outline?.width ?? 0) + (o.kind === 'ink' ? o.stroke : 0) + (o.kind === 'text' ? o.size * .4 : 0);
    const w = Math.max(1, Math.ceil((r.w + 2 * pad) * k)), h = Math.max(1, Math.ceil((r.h + 2 * pad) * k)), layer = layerCanvas(w, h), lc = layer.getContext('2d') as Ctx;
    lc.setTransform(k, 0, 0, k, pad * k, pad * k);
    drawBody(lc, o, { ...opts, scale: k });
    if (fx.shadow) { ctx.shadowColor = rgba(fx.shadow.colour, fx.shadow.alpha); ctx.shadowBlur = fx.shadow.blur * k; ctx.shadowOffsetX = fx.shadow.x * k; ctx.shadowOffsetY = fx.shadow.y * k; }
    if (fx.opacity !== undefined) ctx.globalAlpha = fx.opacity;
    ctx.drawImage(layer, -pad, -pad, w / k, h / k);
  } else {
    if (fx?.opacity !== undefined) ctx.globalAlpha = fx.opacity;
    drawBody(ctx, o, opts);
  }
  ctx.restore();
}
export class Canvas2DRenderer implements Renderer {
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) { this.canvas = canvas; }
  render(doc: KuraDoc, opts: RenderOptions): void {
    const scene = buildScene(doc, opts.sizeId, opts.measure), w = opts.pixels?.w ?? Math.round(scene.size.w * opts.scale), h = opts.pixels?.h ?? Math.round(scene.size.h * opts.scale);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.setTransform(opts.pixels ? w / scene.size.w : opts.scale, 0, 0, opts.pixels ? h / scene.size.h : opts.scale, 0, 0);
    if (!opts.transparent) { ctx.fillStyle = scene.ground; ctx.fillRect(0, 0, scene.size.w, scene.size.h); }
    for (const o of scene.ops) drawOp(ctx, o, opts);
  }
}
