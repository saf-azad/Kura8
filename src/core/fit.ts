import type { Measure, Rect, Size } from './geometry';
import type { FontId, Frame, TextNode } from './document';
import { drawnWeight } from './fonts';
import type { GuideId } from './guides/types';
import { scaleFactorOf } from './guides';
export const LINE_HEIGHT = 1.15;
export const textHeight = (lines: number, size: number): number => Math.max(1, lines) * size * LINE_HEIGHT;
/** Guide-derived type scale: body base (28 units, less on short canvases) times the guide factor 1.5, φ or √2; no guide uses 1.25. */
export type TypeScale = { factor: number; body: number; headline: number; steps: number[] };
export function typeScale(guide: GuideId | null, canvas: Size): TypeScale {
  const factor = guide ? scaleFactorOf(guide) : 1.25, body = Math.min(28, canvas.h * .06);
  return { factor, body, headline: body * factor ** 2, steps: Array.from({ length: 8 }, (_, k) => body * factor ** (k - 1)) };
}
const EPS = 1e-6;
/** Whether wrapping broke a word across lines (a word wider than the line). Text in scripts written without spaces wraps anywhere and never counts. */
export function splitsWord(text: string, lines: string[]): boolean {
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u.test(text)) return false;
  // A break where `BREAK_AFTER` allows one ("late-" / "afternoon", "linktr.ee/" / "unswms") is not a broken word (D-086, D-088).
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/(?<=[\p{L}\p{N}]{2}-|[/_]|\p{L}\.) /gu, '');
  return flat(lines.join(' ')) !== flat(text);
}
/**
 * The pieces a text never breaks inside (D-088): words, split after a hyphen that follows a letter or digit and after a
 * slash, and single characters in scripts written without spaces. A minus sign ("-12") stays with its number.
 */
export function pieces(text: string): string[] {
  return text.split(/\s+/).filter(Boolean).flatMap(word => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u.test(word) ? [...word] : word.split(BREAK_AFTER));
}
/**
 * Where a word may break between lines: after a hyphen that follows a letter or digit, and after a slash (D-086, D-088);
 * in a link also after an underscore and after a dot between letters ("usyd." / "marketing", D-089). A hyphen after a
 * single letter ("O-Week", "e-mail") does not break (D-090).
 */
export const BREAK_AFTER = /(?<=[\p{L}\p{N}]{2}-|[/_])(?=.)|(?<=\p{L}\.)(?=\p{L})/u;
/** Autofit (5q): from `size`, step down the type scale until the text fits `height` without breaking a word (D-055), stopping at body size; past that it overflows and the block grows. */
export function fitText(o: { text: string; weight: 400 | 700; width: number; height: number; size: number; scale: TypeScale; measure: Measure; font?: FontId }): { size: number; lines: string[]; overflow: boolean } {
  const floor = Math.min(o.size, o.scale.body), sizes = [o.size, ...o.scale.steps.filter(s => s < o.size - EPS && s >= floor - EPS).reverse()];
  for (const size of sizes) {
    const lines = o.measure(o.text, size, o.weight, o.width, o.font);
    if (textHeight(lines.length, size) <= o.height + EPS && !splitsWord(o.text, lines)) return { size, lines, overflow: false };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: o.measure(o.text, size, o.weight, o.width, o.font), overflow: true };
}
/** The largest size up to `size` (to half a unit) at which the text fits `height` within `width` without breaking a word; 0 when none does (D-083). */
export function roomSize(o: { text: string; size: number; width: number; height: number; weight: 400 | 700; measure: Measure; font?: FontId }): number {
  const fits = (s: number) => { const lines = o.measure(o.text, s, o.weight, o.width, o.font); return textHeight(lines.length, s) <= o.height + EPS && !splitsWord(o.text, lines); };
  if (fits(o.size)) return o.size;
  let lo = 0, hi = o.size;
  while (hi - lo > .5) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
  return Math.floor(lo * 2) / 2;
}
export type TextBox = { size: number; lines: string[]; rect: Rect; overflow: boolean };
/** Effective text geometry in one size: wrapped lines, font size after autofit, and the drawn box (the frame grown to fit its text). */
export function textBox(node: TextNode, frame: Frame, measure: Measure, scale: TypeScale): TextBox {
  const set = frame.fontSize ?? scale.body, { rect } = frame, weight = drawnWeight(node.font, node.weight);
  if (node.fit) {
    const fitted = fitText({ text: node.text, weight, width: rect.w, height: rect.h, size: set, scale, measure, font: node.font });
    return { size: fitted.size, lines: fitted.lines, overflow: fitted.overflow, rect: { ...rect, h: Math.max(rect.h, textHeight(fitted.lines.length, fitted.size)) } };
  }
  const lines = measure(node.text, set, weight, rect.w, node.font);
  return { size: set, lines, overflow: false, rect: { ...rect, h: textHeight(lines.length, set) } };
}
/** First horizontal guide line (or the bottom edge) a grown text block crosses below its box, for the overlay mark (5q). */
export function crossing(box: Rect, height: number, lines: { id: string; at: number }[]): { id: string; at: number } | null {
  const hit = lines.filter(l => l.at > box.y + box.h + EPS && l.at < box.y + height - EPS).sort((a, b) => a.at - b.at)[0];
  return hit ?? null;
}
