import type { Measure } from '../core/geometry';
import { fontStack } from '../core/script';
// The app's text measurer: canvas metrics with the script's font stack, greedy word wrap, and character breaks for
// words (or unspaced scripts) wider than the line. Cached; cleared when web fonts arrive.
const ctx = document.createElement('canvas').getContext('2d')!;
const cache = new Map<string, string[]>();
export const fontFor = (text: string, size: number, weight: 400 | 700) => `${weight} ${size}px ${fontStack(text)}`;
export const measure: Measure = (text, size, weight, width) => {
  const key = `${weight}|${size.toFixed(3)}|${Math.round(width * 10)}|${text}`, hit = cache.get(key);
  if (hit) return hit;
  ctx.font = fontFor(text, size, weight);
  const fits = (s: string) => ctx.measureText(s).width <= width, out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (fits(next)) { line = next; continue; }
      if (line) { out.push(line); line = ''; }
      for (const char of word) { if (line && !fits(line + char)) { out.push(line); line = ''; } line += char; }
    }
    out.push(line);
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
};
export const clearMeasureCache = (): void => cache.clear();
