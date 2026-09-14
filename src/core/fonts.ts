// Bundled typeface library. Pure registry: no DOM, no loading. The app declares
// the @font-face rules (src/style.css) and preloads families before measuring.
export type FontId = 'space-grotesk' | 'acthirey' | 'bandito' | 'bitsand' | 'hugos' | 'kylora' | 'malam-poek';
export type Font = {
  id: FontId;
  /** Display name and CSS font-family. */
  name: string;
  /** File under /fonts/. */
  file: string;
  /** Available weight range; weights outside it are synthesised by the renderer. */
  weights: [number, number];
  /** True when the bundled file is a demo licensed for personal, non-commercial use only. */
  demo: boolean;
};
export const fonts: readonly Font[] = [
  { id: 'space-grotesk', name: 'Space Grotesk', file: 'space-grotesk.woff2', weights: [300, 700], demo: false },
  { id: 'acthirey', name: 'Acthirey', file: 'acthirey.ttf', weights: [400, 400], demo: true },
  { id: 'bandito', name: 'Bandito', file: 'bandito.ttf', weights: [300, 900], demo: true },
  { id: 'bitsand', name: 'Bitsand', file: 'bitsand.ttf', weights: [400, 400], demo: true },
  { id: 'hugos', name: 'Hugos', file: 'hugos.ttf', weights: [400, 400], demo: true },
  { id: 'kylora', name: 'Kylora', file: 'kylora.ttf', weights: [400, 400], demo: true },
  { id: 'malam-poek', name: 'Malam Poek', file: 'malam-poek.ttf', weights: [400, 400], demo: false },
];
export const fontIds: readonly FontId[] = fonts.map(f => f.id);
export const DEFAULT_FONT: FontId = 'space-grotesk';
export const isFontId = (x: unknown): x is FontId => typeof x === 'string' && (fontIds as readonly string[]).includes(x);
export function fontById(id: FontId): Font { return fonts.find(f => f.id === id)!; }
/** CSS font-family list: the chosen family first, then the system sans fallback. */
export function fontStack(id: FontId): string { return `"${fontById(id).name}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; }
