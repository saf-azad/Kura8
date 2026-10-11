import type { FontId } from './document';
// Typefaces for document text (D-049). All OFL-1.1, bundled from @fontsource and served from the app's own origin.
// Space Grotesk stays the default; a font id absent from a node means Space Grotesk. Single-weight faces draw
// their one weight instead of a synthesized bold.
/** Scripts a face draws beyond Latin and Latin Extended, as bundled (D-077). */
export type Coverage = 'vietnamese' | 'cyrillic' | 'devanagari';
export type FontDef = { id: FontId; name: string; family: string; weights: readonly (400 | 700)[]; fallback: string; covers: readonly Coverage[] };
export const FONTS: readonly FontDef[] = [
  { id: 'grotesk', name: 'Space Grotesk', family: 'Space Grotesk', weights: [400, 700], fallback: 'system-ui, sans-serif', covers: ['vietnamese'] },
  { id: 'poppins', name: 'Poppins', family: 'Poppins', weights: [400, 700], fallback: 'system-ui, sans-serif', covers: ['devanagari'] },
  { id: 'playfair', name: 'Playfair Display', family: 'Playfair Display', weights: [400, 700], fallback: 'Georgia, serif', covers: ['cyrillic', 'vietnamese'] },
  { id: 'lora', name: 'Lora', family: 'Lora', weights: [400, 700], fallback: 'Georgia, serif', covers: ['cyrillic', 'vietnamese'] },
  { id: 'bebas', name: 'Bebas Neue', family: 'Bebas Neue', weights: [400], fallback: 'Impact, sans-serif', covers: [] },
  { id: 'caveat', name: 'Caveat', family: 'Caveat', weights: [400, 700], fallback: 'cursive', covers: ['cyrillic'] },
  { id: 'mono', name: 'Space Mono', family: 'Space Mono', weights: [400, 700], fallback: 'ui-monospace, monospace', covers: ['vietnamese'] },
];
export const FONT_LICENCE = 'OFL-1.1';
export const fontById = (id: FontId | undefined): FontDef => FONTS.find(f => f.id === id) ?? FONTS[0];
export const drawnWeight = (font: FontId | undefined, weight: 400 | 700): 400 | 700 => { const w = fontById(font).weights; return w.includes(weight) ? weight : w[0]; };
// Vietnamese letters missing from Latin Extended (the ones with two marks and the dotted-below vowels).
const NEEDS: [Coverage, RegExp, string][] = [['vietnamese', /[\u1EA0-\u1EF1]/, 'Vietnamese'], ['cyrillic', /\p{Script=Cyrillic}/u, 'Cyrillic'], ['devanagari', /\p{Script=Devanagari}/u, 'Devanagari']];
/** The name of a script in `text` the face has no letters for, so the system font would draw them; null when it has them all. */
export function lacks(font: FontId | undefined, text: string): string | null {
  const def = fontById(font);
  return NEEDS.find(([c, re]) => re.test(text) && !def.covers.includes(c))?.[2] ?? null;
}
