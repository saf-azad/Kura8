import type { KuraDoc } from '../../core/document';
import type { Size } from '../../core/geometry';
import { buildScene, type SceneOp } from '../../core/scene';
import { exportSize, ratioById, type ExportScale } from '../../core/ratios';
import { svg, pdf, pageSize, licences } from '../../core/export';
import { scriptOf } from '../../core/script';
import { measure } from '../measure';
import { Canvas2DRenderer } from '../canvas/renderer';
import * as assets from '../assets';
import grotesk400 from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import grotesk700 from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url';
import groteskExt400 from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff2?url';
import groteskExt700 from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-700-normal.woff2?url';
import groteskViet400 from '@fontsource/space-grotesk/files/space-grotesk-vietnamese-400-normal.woff2?url';
import groteskViet700 from '@fontsource/space-grotesk/files/space-grotesk-vietnamese-700-normal.woff2?url';
// Offscreen export (M14): PNG, JPG and PDF render the scene at the export size with full-resolution originals (5n);
// SVG writes the scene with Space Grotesk (Latin, Latin Extended, Vietnamese) embedded and icon licences in metadata (5u). Hidden objects and empty
// image frames are left out and counted (5y); PNG can leave an unfilled ground transparent (5z).
export type Format = 'png' | 'jpg' | 'svg' | 'pdf';
export type ExportChoice = { format: Format; scale: ExportScale; ground: boolean };
export function summary(doc: KuraDoc, sizeId: string): { hidden: number; empty: number; icons: number; otherScripts: boolean } {
  const scene = buildScene(doc, sizeId, measure);
  return { hidden: scene.hidden, empty: scene.empty, icons: licences(doc, sizeId).length, otherScripts: doc.nodes.some(n => n.kind === 'text' && !n.frames[sizeId]?.hidden && scriptOf(n.text) !== 'latin') };
}
/** kura8-<ratio>[-<n> when linked sizes share the ratio][-300dpi | @2x].<format> */
export function fileName(doc: KuraDoc, sizeId: string, c: ExportChoice): string {
  const ratio = doc.sizes.find(s => s.id === sizeId)!.ratio, suffix = 'dpi' in c.scale ? `-${c.scale.dpi}dpi` : c.scale.scale > 1 ? `@${c.scale.scale}x` : '';
  const same = doc.sizes.filter(s => s.ratio === ratio), n = same.length > 1 ? `-${same.findIndex(s => s.id === sizeId) + 1}` : '';
  return `kura8-${ratio}${n}${c.format === 'svg' ? '' : suffix}.${c.format}`;
}
/** Full-resolution bitmaps for the visible image ops, decoded no larger than the largest copy of each will be drawn. */
async function originals(ops: SceneOp[], pixelsPerUnit: number): Promise<Map<string, ImageBitmap>> {
  const largest = new Map<string, { asset: string; cutout: boolean; w: number; h: number }>();
  for (const o of ops) {
    if (o.kind !== 'image' || !o.asset) continue;
    const key = `${o.asset}#${o.cutout ? 'cutout' : 'original'}`, seen = largest.get(key);
    largest.set(key, { asset: o.asset, cutout: o.cutout, w: Math.max(seen?.w ?? 0, o.rect.w), h: Math.max(seen?.h ?? 0, o.rect.h) });
  }
  const out = new Map<string, ImageBitmap>();
  for (const [key, o] of largest) {
    const record = await assets.getRecord(o.asset).catch(() => undefined);
    const blob = record && (o.cutout ? record.cutout ?? record.working : record.original);
    if (!blob) continue;
    const natural = o.cutout ? record!.work : record!.natural, k = Math.min(1, Math.max(o.w * pixelsPerUnit / natural.w, o.h * pixelsPerUnit / natural.h) * 1.05);
    out.set(key, k < .999 ? await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(natural.w * k)), resizeHeight: Math.max(1, Math.round(natural.h * k)), resizeQuality: 'high' }) : await createImageBitmap(blob));
  }
  return out;
}
async function raster(doc: KuraDoc, sizeId: string, pixels: Size, transparent: boolean): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas'), scene = buildScene(doc, sizeId, measure), scale = pixels.w / scene.size.w, bitmaps = await originals(scene.ops, scale);
  try { new Canvas2DRenderer(canvas).render(doc, { sizeId, scale, pixels, measure, transparent, image: (asset, cutout) => bitmaps.get(`${asset}#${cutout ? 'cutout' : 'original'}`) }); }
  finally { bitmaps.forEach(b => b.close()); }
  return canvas;
}
const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Export failed')), type, quality));
async function fontCss(): Promise<string> {
  const face = async (url: string, weight: number, range: string) => `@font-face{font-family:"Space Grotesk";font-weight:${weight};src:url(${await assets.blobToDataUrl(await (await fetch(url)).blob())}) format("woff2");unicode-range:${range}}`;
  const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', ext = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const viet = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
  return (await Promise.all([face(grotesk400, 400, latin), face(grotesk700, 700, latin), face(groteskExt400, 400, ext), face(groteskExt700, 700, ext), face(groteskViet400, 400, viet), face(groteskViet700, 700, viet)])).join('');
}
export async function render(doc: KuraDoc, sizeId: string, c: ExportChoice): Promise<Blob> {
  const ratio = doc.sizes.find(s => s.id === sizeId)!.ratio, pixels = exportSize(ratio, c.scale);
  if (c.format === 'svg') {
    const scene = buildScene(doc, sizeId, measure), hrefs = new Map<string, { href: string; natural: Size }>();
    for (const o of scene.ops) if (o.kind === 'image' && o.asset) {
      const r = await assets.getRecord(o.asset).catch(() => undefined), blob = r && (o.cutout ? r.cutout ?? r.working : r.original);
      if (r && blob) hrefs.set(`${o.asset}#${o.cutout}`, { href: await assets.blobToDataUrl(blob), natural: o.cutout ? r.work : r.natural });
    }
    const text = svg(scene, { pixels: exportSize(ratio, { scale: 1 }), ground: c.ground, fontCss: await fontCss(), licences: licences(doc, sizeId), image: o => hrefs.get(`${o.asset}#${o.cutout}`) });
    return new Blob([text], { type: 'image/svg+xml' });
  }
  const canvas = await raster(doc, sizeId, pixels, c.format === 'png' && !c.ground);
  if (c.format === 'png') return toBlob(canvas, 'image/png');
  const jpeg = await toBlob(canvas, 'image/jpeg', .92);
  if (c.format === 'jpg') return jpeg;
  const bytes = pdf(new Uint8Array(await jpeg.arrayBuffer()), pixels, pageSize(pixels, ratioById(ratio).mm), fileName(doc, sizeId, c).replace(/\.pdf$/, ''));
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
/** Small preview for the export sheet, using the working copies. */
export function preview(doc: KuraDoc, sizeId: string, canvas: HTMLCanvasElement, transparent: boolean, image: (asset: string, cutout: boolean) => ImageBitmap | null | undefined): void {
  const scene = buildScene(doc, sizeId, measure), k = 180 / Math.max(scene.size.w, scene.size.h), dpr = window.devicePixelRatio || 1;
  new Canvas2DRenderer(canvas).render(doc, { sizeId, scale: k * dpr, measure, transparent, image });
  canvas.style.width = `${scene.size.w * k}px`; canvas.style.height = `${scene.size.h * k}px`;
}
