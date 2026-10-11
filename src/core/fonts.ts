import type { FontId } from './document';
// Typefaces for document text (D-049). All OFL-1.1, bundled from @fontsource and served from the app's own origin.
// Space Grotesk stays the default; a font id absent from a node means Space Grotesk. Single-weight faces draw
// their one weight instead of a synthesized bold.
export type FontDef = { id: FontId; name: string; family: string; weights: readonly (400 | 700)[]; fallback: string };
export const FONTS: readonly FontDef[] = [
  { id: 'grotesk', name: 'Space Grotesk', family: 'Space Grotesk', weights: [400, 700], fallback: 'system-ui, sans-serif' },
  { id: 'poppins', name: 'Poppins', family: 'Poppins', weights: [400, 700], fallback: 'system-ui, sans-serif' },
  { id: 'playfair', name: 'Playfair Display', family: 'Playfair Display', weights: [400, 700], fallback: 'Georgia, serif' },
  { id: 'lora', name: 'Lora', family: 'Lora', weights: [400, 700], fallback: 'Georgia, serif' },
  { id: 'bebas', name: 'Bebas Neue', family: 'Bebas Neue', weights: [400], fallback: 'Impact, sans-serif' },
  { id: 'caveat', name: 'Caveat', family: 'Caveat', weights: [400, 700], fallback: 'cursive' },
  { id: 'mono', name: 'Space Mono', family: 'Space Mono', weights: [400, 700], fallback: 'ui-monospace, monospace' },
];
export const FONT_LICENCE = 'OFL-1.1';
export const fontById = (id: FontId | undefined): FontDef => FONTS.find(f => f.id === id) ?? FONTS[0];
export const drawnWeight = (font: FontId | undefined, weight: 400 | 700): 400 | 700 => { const w = fontById(font).weights; return w.includes(weight) ? weight : w[0]; };
