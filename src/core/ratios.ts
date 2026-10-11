import type { RatioId } from './document';
import type { Size } from './geometry';
/** `name` is the canvas shape, `label` the destination the dial names under the number (5a), `mm` the print size. */
export type Ratio = { id: RatioId; name: string; label: string; w: number; h: number; exportWidth: number; mm?: Size };
// Social formats added by D-069: 3:4 (Instagram's grid, 1080 × 1440), 2:3 (Pinterest pin, 1000 × 1500),
// 1.91:1 (link posts and Facebook event covers, 1200 × 628) and 4:1 (LinkedIn banner, 1584 × 396). The 4:1 is shown as
// Header so it is not confused with the Cover layout (D-077); its id stays `cover`.
export const ratios: Ratio[] = [
  { id: 'square', name: 'Square', label: 'Post', w: 1, h: 1, exportWidth: 1080 },
  { id: 'portrait', name: 'Portrait', label: 'Portrait', w: 4, h: 5, exportWidth: 1080 },
  { id: 'tall', name: 'Tall', label: 'Grid', w: 3, h: 4, exportWidth: 1080 },
  { id: 'story', name: 'Story', label: 'Story', w: 9, h: 16, exportWidth: 1080 },
  { id: 'pin', name: 'Pin', label: 'Pin', w: 2, h: 3, exportWidth: 1000 },
  { id: 'a4', name: 'A4', label: 'Print', w: 1, h: Math.SQRT2, exportWidth: 1240, mm: { w: 210, h: 297 } },
  { id: 'landscape', name: 'Landscape', label: 'Slide', w: 16, h: 9, exportWidth: 1920 },
  { id: 'link', name: 'Link', label: 'Link', w: 1.91, h: 1, exportWidth: 1200 },
  { id: 'banner', name: 'Banner', label: 'Banner', w: 3, h: 1, exportWidth: 1500 },
  { id: 'cover', name: 'Header', label: 'Header', w: 4, h: 1, exportWidth: 1584 },
];
export const ratioById = (id: RatioId): Ratio => ratios.find(r => r.id === id)!;
/** A platform destination for one ratio, offered by the dial's Social segment (D-092, Safwat). */
export type Platform = 'instagram' | 'linkedin';
export type FormatId = 'ig-post' | 'ig-square' | 'ig-story' | 'ig-grid' | 'li-post' | 'li-link' | 'li-banner';
/** `kind` is the word the ring shows under the platform's logo; `name` is the full destination. */
export type Format = { id: FormatId; platform: Platform; name: string; kind: string; ratio: RatioId };
export const formats: Format[] = [
  { id: 'ig-post', platform: 'instagram', name: 'Instagram post', kind: 'Post', ratio: 'portrait' },
  { id: 'ig-square', platform: 'instagram', name: 'Instagram square', kind: 'Square', ratio: 'square' },
  { id: 'ig-story', platform: 'instagram', name: 'Instagram story', kind: 'Story', ratio: 'story' },
  { id: 'ig-grid', platform: 'instagram', name: 'Instagram grid', kind: 'Grid', ratio: 'tall' },
  { id: 'li-post', platform: 'linkedin', name: 'LinkedIn post', kind: 'Post', ratio: 'square' },
  { id: 'li-link', platform: 'linkedin', name: 'LinkedIn link', kind: 'Link', ratio: 'link' },
  { id: 'li-banner', platform: 'linkedin', name: 'LinkedIn banner', kind: 'Banner', ratio: 'cover' },
];
export const formatById = (id: string | undefined): Format | undefined => formats.find(f => f.id === id);
/** The format a ratio shows as: the remembered one when it has that ratio, else the first that does; null when no platform format uses it. */
export const formatFor = (ratio: RatioId, remembered?: string): Format | null => {
  const f = formatById(remembered);
  return f?.ratio === ratio ? f : formats.find(x => x.ratio === ratio) ?? null;
};
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
  // The 1× height rounded once, then scaled, so 3× is exactly three times 1× (Link 3× is 3600 × 1884, D-082).
  return { w: r.exportWidth * option.scale, h: Math.round(r.exportWidth * r.h / r.w) * option.scale };
}
export const withinPixelLimit = (s: Size): boolean => s.w * s.h <= MAX_PIXELS;
/**
 * The scale one size of an All sizes export takes for the chosen one (D-077): 300 dpi on a print ratio, 2× elsewhere;
 * a scale past the pixel limit steps down to the largest that fits (a print ratio's 3× to 300 dpi) instead of 1×.
 */
export function zipScale(id: RatioId, chosen: ExportScale): ExportScale {
  const print = !!ratioById(id).mm, k = 'dpi' in chosen ? 2 : chosen.scale;
  const steps: ExportScale[] = print ? (k >= 3 ? [{ scale: 3 }, { dpi: 300 }, { scale: 1 }] : k === 2 ? [{ dpi: 300 }, { scale: 1 }] : [{ scale: 1 }])
    : ([3, 2, 1] as const).filter(s => s <= k).map(scale => ({ scale }));
  return steps.find(s => withinPixelLimit(exportSize(id, s))) ?? { scale: 1 };
}
