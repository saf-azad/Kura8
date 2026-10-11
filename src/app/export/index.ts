import type { KuraDoc } from '../../core/document';
import type { Size } from '../../core/geometry';
import { buildScene, type SceneOp } from '../../core/scene';
import { exportSize, ratioById, type ExportScale } from '../../core/ratios';
import { svg, pdf, pageSize, licences, nameStem, type TextShift } from '../../core/export';
import { scriptOf } from '../../core/script';
import { flagsFor } from '../../core/reratio';
import { measure, loadFont } from '../measure';
import { FONT_FILES } from './fonts';
import { fontById, drawnWeight } from '../../core/fonts';
import type { FontId } from '../../core/document';
import { Canvas2DRenderer } from '../canvas/renderer';
import * as assets from '../assets';
import grotesk400 from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import grotesk700 from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url';
import groteskExt400 from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff2?url';
import groteskExt700 from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-700-normal.woff2?url';
import groteskViet400 from '@fontsource/space-grotesk/files/space-grotesk-vietnamese-400-normal.woff2?url';
import groteskViet700 from '@fontsource/space-grotesk/files/space-grotesk-vietnamese-700-normal.woff2?url';
// Offscreen export (M14): PNG, JPG and PDF render the scene at the export size with full-resolution originals (5n);
// SVG writes the scene with Space Grotesk embedded and icon licences in metadata (5u). Hidden objects and empty
// image frames are left out and counted (5y); PNG can leave an unfilled ground transparent (5z).
export type Format = 'png' | 'jpg' | 'svg' | 'pdf';
export type ExportChoice = { format: Format; scale: ExportScale; ground: boolean };
export function summary(doc: KuraDoc, sizeId: string): { hidden: number; empty: number; icons: number; offText: number; otherScripts: boolean } {
  const scene = buildScene(doc, sizeId, measure), size = scene.size;
  // By the letters, like the canvas flag, so an empty stretch of a box past the edge is not reported (D-077).
  const spec = doc.sizes.find(s => s.id === sizeId)!, offText = doc.nodes.filter(n => n.kind === 'text' && n.frames[sizeId] && flagsFor(n, n.frames[sizeId], measure, size, spec.guide).some(f => f.kind === 'off-canvas')).length;
  return { hidden: scene.hidden, empty: scene.empty, icons: licences(doc, sizeId).length, offText, otherScripts: doc.nodes.some(n => n.kind === 'text' && !n.frames[sizeId]?.hidden && scriptOf(n.text) !== 'latin') };
}
/** File name: the headline's words, the ratio as the dial names it (post, grid, print …), scale and transparency (D-077). */
export function fileName(doc: KuraDoc, sizeId: string, c: ExportChoice, stem = nameStem(doc, sizeId)): string {
  const ratio = ratioById(doc.sizes.find(s => s.id === sizeId)!.ratio).label.toLowerCase(), suffix = 'dpi' in c.scale ? `-${c.scale.dpi}dpi` : c.scale.scale > 1 ? `@${c.scale.scale}x` : '';
  return `${stem}-${ratio}${c.format === 'svg' ? '' : suffix}${c.format === 'png' && !c.ground ? '-transparent' : ''}.${c.format}`;
}
/** Full-resolution bitmaps for the visible image ops, decoded no larger than they will be drawn. */
async function originals(ops: SceneOp[], pixelsPerUnit: number): Promise<Map<string, ImageBitmap>> {
  const out = new Map<string, ImageBitmap>();
  for (const o of ops) {
    if (o.kind !== 'image' || !o.asset) continue;
    const key = `${o.asset}#${o.cutout ? 'cutout' : 'original'}`;
    if (out.has(key)) continue;
    const record = await assets.getRecord(o.asset).catch(() => undefined);
    const blob = record && (o.cutout ? record.cutout ?? record.working : record.original);
    if (!blob) continue;
    const natural = o.cutout ? record!.work : record!.natural, k = Math.min(1, Math.max(o.rect.w * pixelsPerUnit / natural.w, o.rect.h * pixelsPerUnit / natural.h) * 1.05);
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
/** Faces and drawn weights of the visible text in a size (D-049). */
function usedFaces(doc: KuraDoc, sizeId: string): { font: FontId; weight: 400 | 700 }[] {
  const out = new Map<string, { font: FontId; weight: 400 | 700 }>();
  for (const n of doc.nodes) if (n.kind === 'text' && n.font && n.font !== 'grotesk' && !n.frames[sizeId]?.hidden) { const weight = drawnWeight(n.font, n.weight); out.set(`${n.font}|${weight}`, { font: n.font, weight }); }
  return [...out.values()];
}
/** Vietnamese letters, whose glyphs live in their own subset files (D-077). */
export const VIETNAMESE = /[\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9\u20AB]/;
async function fontCss(faces: { font: FontId; weight: 400 | 700 }[], viet: boolean, cyrillic = false): Promise<string> {
  const face = async (url: string, weight: number, range: string, family = 'Space Grotesk') => `@font-face{font-family:"${family}";font-weight:${weight};src:url(${await assets.blobToDataUrl(await (await fetch(url)).blob())}) format("woff2");unicode-range:${range}}`;
  const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', ext = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const vi = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
  const cy = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
  const more = FONT_FILES.filter(f => faces.some(u => u.font === f.font && u.weight === f.weight) && (viet || f.subset !== 'vietnamese') && (cyrillic || f.subset !== 'cyrillic'))
    .map(f => face(f.url, f.weight, f.subset === 'latin' ? latin : f.subset === 'vietnamese' ? vi : f.subset === 'cyrillic' ? cy : ext, fontById(f.font).family));
  const own = [face(grotesk400, 400, latin), face(grotesk700, 700, latin), face(groteskExt400, 400, ext), face(groteskExt700, 700, ext), ...(viet ? [face(groteskViet400, 400, vi), face(groteskViet700, 700, vi)] : [])];
  return (await Promise.all([...own, ...more])).join('');
}
/** How far below the canvas's middle line the alphabetic baseline sits for an op's face and size, so SVG text lands where the canvas draws it (D-075). */
const metrics = document.createElement('canvas').getContext('2d')!;
const textShift: TextShift = o => {
  metrics.font = `${o.weight} ${o.size}px ${o.font}`;
  metrics.textBaseline = 'middle'; const middle = metrics.measureText('H').actualBoundingBoxAscent;
  metrics.textBaseline = 'alphabetic'; const alphabetic = metrics.measureText('H').actualBoundingBoxAscent;
  return alphabetic - middle;
};
export async function render(doc: KuraDoc, sizeId: string, c: ExportChoice): Promise<Blob> {
  const ratio = doc.sizes.find(s => s.id === sizeId)!.ratio, pixels = exportSize(ratio, c.scale), faces = usedFaces(doc, sizeId);
  await Promise.all(faces.map(f => loadFont(f.font, f.weight)));
  if (c.format === 'svg') {
    const scene = buildScene(doc, sizeId, measure), hrefs = new Map<string, { href: string; natural: Size }>();
    for (const o of scene.ops) if (o.kind === 'image' && o.asset) {
      const r = await assets.getRecord(o.asset).catch(() => undefined), blob = r && (o.cutout ? r.cutout ?? r.working : r.original);
      if (r && blob) hrefs.set(`${o.asset}#${o.cutout}`, { href: await assets.blobToDataUrl(blob), natural: o.cutout ? r.work : r.natural });
    }
    const text = svg(scene, { pixels: exportSize(ratio, { scale: 1 }), ground: c.ground, fontCss: await fontCss(faces, scene.ops.some(o => o.kind === 'text' && o.lines.some(l => VIETNAMESE.test(l))), scene.ops.some(o => o.kind === 'text' && o.lines.some(l => /\p{Script=Cyrillic}/u.test(l)))), licences: licences(doc, sizeId), image: o => hrefs.get(`${o.asset}#${o.cutout}`), textShift });
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
