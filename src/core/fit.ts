import type { Measure, Rect, Size, TextStyle } from './geometry';
import type { Frame, TextNode } from './document';
import type { GuideId } from './guides/types';
import { scaleFactorOf } from './guides';
export const LINE_HEIGHT = 1.15;
export const textHeight = (lines: number, size: number, leading = LINE_HEIGHT): number => Math.max(1, lines) * size * leading;
/** The characters drawn: uppercase applies at draw time and the stored text keeps its case. */
export const displayText = (n: Pick<TextNode, 'text' | 'upper'>): string => n.upper ? n.text.toLocaleUpperCase() : n.text;
/** Measuring style of a text node, or undefined for the default face. */
export function textStyle(n: Pick<TextNode, 'font' | 'italic' | 'spacing'>): TextStyle | undefined {
  const s: TextStyle = {};
  if (n.font && n.font !== 'space-grotesk') s.font = n.font;
  if (n.italic) s.italic = true;
  if (n.spacing) s.spacing = n.spacing;
  return Object.keys(s).length ? s : undefined;
}
/** Guide-derived type scale: body base (28 units, less on short canvases) times the guide factor 1.5, φ or √2; no guide uses 1.25. */
export type TypeScale = { factor: number; body: number; headline: number; steps: number[] };
export function typeScale(guide: GuideId | null, canvas: Size): TypeScale {
  const factor = guide ? scaleFactorOf(guide) : 1.25, body = Math.min(28, canvas.h * .06);
  return { factor, body, headline: body * factor ** 2, steps: Array.from({ length: 8 }, (_, k) => body * factor ** (k - 1)) };
}
const EPS = 1e-6;
/** Autofit (5q): from `size`, step down the type scale until the text fits `height`, stopping at body size; past that it overflows and the block grows. */
export function fitText(o: { text: string; weight: 400 | 700; width: number; height: number; size: number; scale: TypeScale; measure: Measure; leading?: number; style?: TextStyle }): { size: number; lines: string[]; overflow: boolean } {
  const floor = Math.min(o.size, o.scale.body), sizes = [o.size, ...o.scale.steps.filter(s => s < o.size - EPS && s >= floor - EPS).reverse()];
  const measure = (size: number) => o.style ? o.measure(o.text, size, o.weight, o.width, o.style) : o.measure(o.text, size, o.weight, o.width);
  for (const size of sizes) {
    const lines = measure(size);
    if (textHeight(lines.length, size, o.leading) <= o.height + EPS) return { size, lines, overflow: false };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: measure(size), overflow: true };
}
export type TextBox = { size: number; lines: string[]; rect: Rect; overflow: boolean };
/** Effective text geometry in one size: wrapped lines, font size after autofit, and the drawn box (the frame grown to fit its text). */
export function textBox(node: TextNode, frame: Frame, measure: Measure, scale: TypeScale): TextBox {
  const set = frame.fontSize ?? scale.body, { rect } = frame, text = displayText(node), style = textStyle(node), leading = node.leading ?? LINE_HEIGHT;
  if (node.fit) {
    const fitted = fitText({ text, weight: node.weight, width: rect.w, height: rect.h, size: set, scale, measure, leading, style });
    return { size: fitted.size, lines: fitted.lines, overflow: fitted.overflow, rect: { ...rect, h: Math.max(rect.h, textHeight(fitted.lines.length, fitted.size, leading)) } };
  }
  const lines = style ? measure(text, set, node.weight, rect.w, style) : measure(text, set, node.weight, rect.w);
  return { size: set, lines, overflow: false, rect: { ...rect, h: textHeight(lines.length, set, leading) } };
}
/** First horizontal guide line (or the bottom edge) a grown text block crosses below its box, for the overlay mark (5q). */
export function crossing(box: Rect, height: number, lines: { id: string; at: number }[]): { id: string; at: number } | null {
  const hit = lines.filter(l => l.at > box.y + box.h + EPS && l.at < box.y + height - EPS).sort((a, b) => a.at - b.at)[0];
  return hit ?? null;
}
