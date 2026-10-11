import type { KuraDoc } from '../../core/document';
import type { Measure } from '../../core/geometry';
import { buildScene, type SceneOp } from '../../core/scene';
import { coverCrop } from '../../core/images';
// The document canvas draws ground and nodes only, from the same scene the SVG export uses. Overlay marks live on
// a second canvas; export renders offscreen through this same class.
export type RenderOptions = {
  sizeId: string; scale: number; measure: Measure;
  /** Exact output size in pixels (exports); the scale then differs per axis by the rounding of the print size. */ pixels?: { w: number; h: number };
  image: (asset: string, cutout: boolean) => ImageBitmap | null | undefined;
  /** Leave the ground transparent (5z). */ transparent?: boolean;
  /** Draw empty and missing image frames as slate placeholders (editor only). */ placeholders?: boolean;
};
export interface Renderer { render(doc: KuraDoc, opts: RenderOptions): void }
const paths = new Map<string, Path2D>();
const path2d = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); if (paths.size > 500) paths.clear(); paths.set(d, p); } return p; };
export function drawOp(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, o: SceneOp, opts: RenderOptions): void {
  const { rect: r } = o;
  ctx.save();
  if (o.opacity !== undefined) ctx.globalAlpha = o.opacity;
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2); if (o.rot) ctx.rotate(o.rot * Math.PI / 180); ctx.translate(-r.w / 2, -r.h / 2);
  if (o.kind === 'shape') { ctx.fillStyle = o.fill; if (o.scale) ctx.scale(o.scale[0], o.scale[1]); ctx.fill(path2d(o.d), 'evenodd'); }
  else if (o.kind === 'text') {
    ctx.fillStyle = o.fill; ctx.font = `${o.weight} ${o.size}px ${o.font}`; ctx.textBaseline = 'middle'; ctx.textAlign = o.align;
    if ('direction' in ctx) ctx.direction = o.dir;
    const x = o.align === 'left' ? 0 : o.align === 'center' ? r.w / 2 : r.w;
    o.lines.forEach((line, i) => ctx.fillText(line, x, i * o.lineHeight + o.lineHeight / 2));
  } else if (o.kind === 'ink') {
    ctx.strokeStyle = o.fill; ctx.lineWidth = o.stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    for (const p of o.paths) p.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  } else {
    const bitmap = o.asset ? opts.image(o.asset, o.cutout) : undefined;
    if (bitmap) {
      const c = coverCrop({ w: bitmap.width, h: bitmap.height }, r, o.focus);
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, c.x, c.y, c.w, c.h, 0, 0, r.w, r.h);
    } else if (opts.placeholders) {
      const line = 2 / opts.scale;
      ctx.fillStyle = 'rgba(156,171,194,.35)'; ctx.fillRect(0, 0, r.w, r.h);
      ctx.strokeStyle = '#9CABC2'; ctx.lineWidth = line; ctx.strokeRect(line / 2, line / 2, r.w - line, r.h - line);
    }
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
