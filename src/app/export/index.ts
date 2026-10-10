import type { KuraDoc } from '../../core/document';
import type { Size } from '../../core/geometry';
import { buildScene, type SceneOp } from '../../core/scene';
import { exportSize, ratioById, type ExportScale } from '../../core/ratios';
import { svg, pdf, pageSize, licences } from '../../core/export';
import { scriptOf } from '../../core/script';
import { measure } from '../measure';
import { Canvas2DRenderer, type ImageSource } from '../canvas/renderer';
import * as assets from '../assets';
import grotesk400 from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import grotesk700 from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2?url';
import groteskExt400 from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-400-normal.woff2?url';
import groteskExt700 from '@fontsource/space-grotesk/files/space-grotesk-latin-ext-700-normal.woff2?url';
import f_bebas_neue_latin_400_normal from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import f_caveat_latin_400_normal from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import f_caveat_latin_700_normal from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import f_montserrat_latin_400_italic from '@fontsource/montserrat/files/montserrat-latin-400-italic.woff2?url';
import f_montserrat_latin_400_normal from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url';
import f_montserrat_latin_700_italic from '@fontsource/montserrat/files/montserrat-latin-700-italic.woff2?url';
import f_montserrat_latin_700_normal from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import f_playfair_display_latin_400_italic from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import f_playfair_display_latin_400_normal from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import f_playfair_display_latin_700_italic from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url';
import f_playfair_display_latin_700_normal from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import f_space_mono_latin_400_italic from '@fontsource/space-mono/files/space-mono-latin-400-italic.woff2?url';
import f_space_mono_latin_400_normal from '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2?url';
import f_space_mono_latin_700_italic from '@fontsource/space-mono/files/space-mono-latin-700-italic.woff2?url';
import f_space_mono_latin_700_normal from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
import { lookKey, type Look } from '../../core/look';
import { fontById } from '../../core/script';
import { withLook } from '../looks';
/** Latin faces of the extra fonts (D-045), embedded in SVG exports only when the design uses them. */
const FACES: [string, number, boolean, string][] = [
  ['bebas-neue', 400, false, f_bebas_neue_latin_400_normal],
  ['caveat', 400, false, f_caveat_latin_400_normal],
  ['caveat', 700, false, f_caveat_latin_700_normal],
  ['montserrat', 400, true, f_montserrat_latin_400_italic],
  ['montserrat', 400, false, f_montserrat_latin_400_normal],
  ['montserrat', 700, true, f_montserrat_latin_700_italic],
  ['montserrat', 700, false, f_montserrat_latin_700_normal],
  ['playfair-display', 400, true, f_playfair_display_latin_400_italic],
  ['playfair-display', 400, false, f_playfair_display_latin_400_normal],
  ['playfair-display', 700, true, f_playfair_display_latin_700_italic],
  ['playfair-display', 700, false, f_playfair_display_latin_700_normal],
  ['space-mono', 400, true, f_space_mono_latin_400_italic],
  ['space-mono', 400, false, f_space_mono_latin_400_normal],
  ['space-mono', 700, true, f_space_mono_latin_700_italic],
  ['space-mono', 700, false, f_space_mono_latin_700_normal],
];
// Offscreen export (M14): PNG, JPG and PDF render the scene at the export size with full-resolution originals (5n);
// SVG writes the scene with Space Grotesk embedded and icon licences in metadata (5u). Hidden objects and empty
// image frames are left out and counted (5y); PNG can leave an unfilled ground transparent (5z).
export type Format = 'png' | 'jpg' | 'svg' | 'pdf';
export type ExportChoice = { format: Format; scale: ExportScale; ground: boolean };
export function summary(doc: KuraDoc, sizeId: string): { hidden: number; empty: number; icons: number; otherScripts: boolean } {
  const scene = buildScene(doc, sizeId, measure);
  return { hidden: scene.hidden, empty: scene.empty, icons: licences(doc, sizeId).length, otherScripts: doc.nodes.some(n => n.kind === 'text' && !n.frames[sizeId]?.hidden && scriptOf(n.text) !== 'latin') };
}
export function fileName(doc: KuraDoc, sizeId: string, c: ExportChoice): string {
  const ratio = doc.sizes.find(s => s.id === sizeId)!.ratio, suffix = 'dpi' in c.scale ? `-${c.scale.dpi}dpi` : c.scale.scale > 1 ? `@${c.scale.scale}x` : '';
  return `kura8-${ratio}${c.format === 'svg' ? '' : suffix}.${c.format}`;
}
const bitmapKey = (asset: string, cutout: boolean, look?: Look | null) => `${asset}#${cutout ? 'cutout' : 'original'}${look ? `|${lookKey(look)}` : ''}`;
/** Full-resolution bitmaps for the visible image ops, decoded no larger than they will be drawn, with their photo looks applied (D-045). */
async function originals(ops: SceneOp[], pixelsPerUnit: number): Promise<Map<string, ImageBitmap>> {
  const out = new Map<string, ImageBitmap>();
  for (const o of ops) {
    if (o.kind !== 'image' || !o.asset) continue;
    const key = bitmapKey(o.asset, o.cutout), styled = bitmapKey(o.asset, o.cutout, o.look);
    if (out.has(styled)) continue;
    if (!out.has(key)) {
      const record = await assets.getRecord(o.asset).catch(() => undefined);
      const blob = record && (o.cutout ? record.cutout ?? record.working : record.original);
      if (!blob) continue;
      const natural = o.cutout ? record!.work : record!.natural, zoom = o.zoom ?? 1, k = Math.min(1, Math.max(o.rect.w * pixelsPerUnit / natural.w, o.rect.h * pixelsPerUnit / natural.h) * zoom * 1.05);
      out.set(key, k < .999 ? await createImageBitmap(blob, { resizeWidth: Math.max(1, Math.round(natural.w * k)), resizeHeight: Math.max(1, Math.round(natural.h * k)), resizeQuality: 'high' }) : await createImageBitmap(blob));
    }
    if (o.look) out.set(styled, await withLook(out.get(key)!, o.look));
  }
  return out;
}
async function raster(doc: KuraDoc, sizeId: string, pixels: Size, transparent: boolean): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas'), scene = buildScene(doc, sizeId, measure), scale = pixels.w / scene.size.w, bitmaps = await originals(scene.ops, scale);
  try { new Canvas2DRenderer(canvas).render(doc, { sizeId, scale, pixels, measure, transparent, image: (asset, cutout, look) => bitmaps.get(bitmapKey(asset, cutout, look)) }); }
  finally { bitmaps.forEach(b => b.close()); }
  return canvas;
}
const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Export failed')), type, quality));
/** The extra faces a size's visible text uses, as family, weight and italic. */
function facesUsed(doc: KuraDoc, sizeId: string): typeof FACES {
  const used = doc.nodes.flatMap(n => n.kind === 'text' && n.font && n.font !== 'space-grotesk' && !n.frames[sizeId]?.hidden ? [[n.font, n.weight, !!n.italic] as const] : []);
  return FACES.filter(([fam, w, italic]) => used.some(([f, uw, ui]) => f === fam && ui === italic && (uw === w || !FACES.some(x => x[0] === fam && x[1] === uw && x[2] === ui))));
}
async function fontCss(extra: typeof FACES = []): Promise<string> {
  const data = async (url: string) => assets.blobToDataUrl(await (await fetch(url)).blob());
  const more = await Promise.all(extra.map(async ([fam, weight, italic, url]) => `@font-face{font-family:${fontById(fam).family};font-weight:${weight};font-style:${italic ? 'italic' : 'normal'};src:url(${await data(url)}) format("woff2")}`));
  const face = async (url: string, weight: number, range: string) => `@font-face{font-family:"Space Grotesk";font-weight:${weight};src:url(${await data(url)}) format("woff2");unicode-range:${range}}`;
  const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', ext = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  return (await Promise.all([face(grotesk400, 400, latin), face(grotesk700, 700, latin), face(groteskExt400, 400, ext), face(groteskExt700, 700, ext)])).join('') + more.join('');
}
export async function render(doc: KuraDoc, sizeId: string, c: ExportChoice): Promise<Blob> {
  const ratio = doc.sizes.find(s => s.id === sizeId)!.ratio, pixels = exportSize(ratio, c.scale);
  if (c.format === 'svg') {
    const scene = buildScene(doc, sizeId, measure), hrefs = new Map<string, { href: string; natural: Size }>();
    for (const o of scene.ops) if (o.kind === 'image' && o.asset) {
      const key = bitmapKey(o.asset, o.cutout, o.look);
      if (hrefs.has(key)) continue;
      const r = await assets.getRecord(o.asset).catch(() => undefined), blob = r && (o.cutout ? r.cutout ?? r.working : r.original);
      if (!r || !blob) continue;
      if (!o.look) { hrefs.set(key, { href: await assets.blobToDataUrl(blob), natural: o.cutout ? r.work : r.natural }); continue; }
      // A photo look is pixels, so the SVG carries the adjusted picture as PNG.
      const base = await createImageBitmap(blob), styled = await withLook(base, o.look), c2 = new OffscreenCanvas(styled.width, styled.height);
      c2.getContext('2d')!.drawImage(styled, 0, 0); base.close(); styled.close();
      hrefs.set(key, { href: await assets.blobToDataUrl(await c2.convertToBlob({ type: 'image/png' })), natural: { w: c2.width, h: c2.height } });
    }
    const text = svg(scene, { pixels: exportSize(ratio, { scale: 1 }), ground: c.ground, fontCss: await fontCss(facesUsed(doc, sizeId)), licences: licences(doc, sizeId), image: o => hrefs.get(bitmapKey(o.asset!, o.cutout, o.look)) });
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
export function preview(doc: KuraDoc, sizeId: string, canvas: HTMLCanvasElement, transparent: boolean, image: ImageSource): void {
  const scene = buildScene(doc, sizeId, measure), k = 180 / Math.max(scene.size.w, scene.size.h), dpr = window.devicePixelRatio || 1;
  new Canvas2DRenderer(canvas).render(doc, { sizeId, scale: k * dpr, measure, transparent, image });
  canvas.style.width = `${scene.size.w * k}px`; canvas.style.height = `${scene.size.h * k}px`;
}
