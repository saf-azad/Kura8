import type { RatioId } from './document';
import type { Size } from './geometry';
/** `name` is the canvas shape, `label` the destination the dial names under the number (5a), `mm` the print size. */
export type Ratio = { id: RatioId; name: string; label: string; w: number; h: number; exportWidth: number; mm?: Size };
export const ratios: Ratio[] = [
  { id: 'square', name: 'Square', label: 'Post', w: 1, h: 1, exportWidth: 1080 },
  { id: 'portrait', name: 'Portrait', label: 'Portrait', w: 4, h: 5, exportWidth: 1080 },
  { id: 'landscape', name: 'Landscape', label: 'Slide', w: 16, h: 9, exportWidth: 1920 },
  { id: 'story', name: 'Story', label: 'Story', w: 9, h: 16, exportWidth: 1080 },
  { id: 'a4', name: 'A4', label: 'Print', w: 1, h: Math.SQRT2, exportWidth: 1240, mm: { w: 210, h: 297 } },
  { id: 'banner', name: 'Banner', label: 'Banner', w: 3, h: 1, exportWidth: 1500 },
];
export const ratioById = (id: RatioId): Ratio => ratios.find(r => r.id === id)!;
export const canvasSize = (id: RatioId): Size => { const r = ratioById(id); return { w: 1000, h: 1000 * r.h / r.w }; };
/** The number shown for a ratio: `4:5`, or the paper name for print sizes. */
export const ratioNumbers = (id: RatioId): string => { const r = ratioById(id); return r.mm ? r.name : `${r.w}:${r.h}`; };
/** Largest export the app offers, in pixels (the 16.7 MP canvas limit of mobile browsers). */
export const MAX_PIXELS = 16_777_216;
export type ExportScale = { scale: 1 | 2 | 3 } | { dpi: 300 };
/** Export pixel size: social ratios scale their export width; print sizes also take a dpi. */
export function exportSize(id: RatioId, option: ExportScale): Size {
  const r = ratioById(id);
  if ('dpi' in option) {
    if (!r.mm) throw new Error(`${id} has no print size`);
    return { w: Math.round(r.mm.w / 25.4 * option.dpi), h: Math.round(r.mm.h / 25.4 * option.dpi) };
  }
  const w = r.exportWidth * option.scale;
  return { w, h: Math.round(w * r.h / r.w) };
}
export const withinPixelLimit = (s: Size): boolean => s.w * s.h <= MAX_PIXELS;
