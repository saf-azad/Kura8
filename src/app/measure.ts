import type { Measure } from '../core/geometry';
import type { FontId } from '../core/document';
import { fontStack } from '../core/script';
import { fontById } from '../core/fonts';
// The app's text measurer: canvas metrics with the face's font stack, greedy word wrap, and character breaks for
// words (or unspaced scripts) wider than the line. Cached; cleared when web fonts arrive. A face is loaded the
// first time text is measured in it (D-049), and `onFontLoad` hears when it lands so the canvas can redraw.
const ctx = document.createElement('canvas').getContext('2d')!;
const cache = new Map<string, string[]>();
const requested = new Map<string, Promise<void>>(), listeners = new Set<() => void>();
export const onFontLoad = (fn: () => void): void => { listeners.add(fn); };
/** Loads a face and weight from the app's own origin; resolves once it can be drawn. */
export function loadFont(font: FontId | undefined, weight: 400 | 700): Promise<void> {
  const def = fontById(font), key = `${def.id}|${weight}`;
  if (!document.fonts?.load) return Promise.resolve();
  let p = requested.get(key);
  if (!p) { p = document.fonts.load(`${weight} 16px "${def.family}"`).then(() => { cache.clear(); listeners.forEach(fn => fn()); }, () => {}); requested.set(key, p); }
  return p;
}
export const fontFor = (text: string, size: number, weight: 400 | 700, font?: FontId) => `${weight} ${size}px ${fontStack(text, font)}`;
export const measure: Measure = (text, size, weight, width, font) => {
  const key = `${font ?? ''}|${weight}|${size.toFixed(3)}|${Math.round(width * 10)}|${text}`, hit = cache.get(key);
  if (hit) return hit;
  if (font && font !== 'grotesk') void loadFont(font, weight);
  ctx.font = fontFor(text, size, weight, font);
  const fits = (s: string) => ctx.measureText(s).width <= width, out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) { line = next; continue; }
      // A hyphenated word breaks after a hyphen before it breaks inside a part ("late-" / "afternoon", D-086).
      const parts = word.split(/(?<=-)(?=.)/);
      parts.forEach((part, i) => {
        const joined = i === 0 ? (line ? `${line} ${part}` : part) : line + part;
        if (fits(joined)) { line = joined; return; }
        if (line) { out.push(line); line = ''; }
        if (fits(part)) { line = part; return; }
        for (const char of part) { if (line && !fits(line + char)) { out.push(line); line = ''; } line += char; }
      });
    }
    out.push(line);
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
};
export const clearMeasureCache = (): void => cache.clear();
/** Width of one unwrapped line of text in units. */
export const textWidth = (text: string, size: number, weight: 400 | 700, font?: FontId): number => { ctx.font = fontFor(text, size, weight, font); return ctx.measureText(text).width; };
