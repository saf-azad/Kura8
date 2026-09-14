import type { RatioId } from './document';
import type { Size } from './geometry';
export const ratios: { id: RatioId; name: string; w: number; h: number; exportWidth: number }[] = [
  { id: 'square', name: 'Square', w: 1, h: 1, exportWidth: 1080 },
  { id: 'portrait', name: 'Portrait', w: 4, h: 5, exportWidth: 1080 },
  { id: 'landscape', name: 'Landscape', w: 16, h: 9, exportWidth: 1920 },
  { id: 'story', name: 'Story', w: 9, h: 16, exportWidth: 1080 },
  { id: 'banner', name: 'Banner', w: 3, h: 1, exportWidth: 1500 },
];
export const ratioById = (id: RatioId) => ratios.find(r => r.id === id)!;
export const canvasSize = (id: RatioId): Size => { const r = ratioById(id); return { w: 1000, h: 1000 * r.h / r.w }; };
