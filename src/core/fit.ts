import type { Measure, Rect, Size } from './geometry';
import type { Frame, KuraDoc, TextNode } from './document';
import type { GuideId } from './guides/types';
import { scaleFactorOf } from './guides';
import { canvasSize } from './ratios';
export const LINE_HEIGHT = 1.15;
export const textHeight = (lines: number, size: number): number => Math.max(1, lines) * size * LINE_HEIGHT;
/** Guide-derived type scale: body base (28 units, less on short canvases) times the guide factor 1.5, φ or √2; no guide uses 1.25. */
export type TypeScale = { factor: number; body: number; headline: number; steps: number[] };
export function typeScale(guide: GuideId | null, canvas: Size): TypeScale {
  const factor = guide ? scaleFactorOf(guide) : 1.25, body = Math.min(28, canvas.h * .06);
  return { factor, body, headline: body * factor ** 2, steps: Array.from({ length: 8 }, (_, k) => body * factor ** (k - 1)) };
}
const EPS = 1e-6;
/** Autofit (5q): from `size`, step down the type scale until the text fits `height`, stopping at body size; past that it overflows and the block grows. */
export function fitText(o: { text: string; weight: 400 | 700; width: number; height: number; size: number; scale: TypeScale; measure: Measure }): { size: number; lines: string[]; overflow: boolean } {
  const floor = Math.min(o.size, o.scale.body), sizes = [o.size, ...o.scale.steps.filter(s => s < o.size - EPS && s >= floor - EPS).reverse()];
  for (const size of sizes) {
    const lines = o.measure(o.text, size, o.weight, o.width);
    if (textHeight(lines.length, size) <= o.height + EPS) return { size, lines, overflow: false };
  }
  const size = sizes[sizes.length - 1];
  return { size, lines: o.measure(o.text, size, o.weight, o.width), overflow: true };
}
export type TextBox = { size: number; lines: string[]; rect: Rect; overflow: boolean };
/** Effective text geometry in one size: wrapped lines, font size after autofit, and the drawn box (the frame grown to fit its text). */
export function textBox(node: TextNode, frame: Frame, measure: Measure, scale: TypeScale): TextBox {
  const set = frame.fontSize ?? scale.body, { rect } = frame;
  if (node.fit) {
    const fitted = fitText({ text: node.text, weight: node.weight, width: rect.w, height: rect.h, size: set, scale, measure });
    return { size: fitted.size, lines: fitted.lines, overflow: fitted.overflow, rect: { ...rect, h: Math.max(rect.h, textHeight(fitted.lines.length, fitted.size)) } };
  }
  const lines = measure(node.text, set, node.weight, rect.w);
  return { size: set, lines, overflow: false, rect: { ...rect, h: textHeight(lines.length, set) } };
}
/** After a content, weight or size edit, the stored height of non-autofit text follows its measured lines in every size. */
export function syncTextHeights(doc: KuraDoc, ids: string[], measure: Measure): KuraDoc {
  const pick = new Set(ids);
  return { ...doc, nodes: doc.nodes.map(n => {
    if (!pick.has(n.id) || n.kind !== 'text' || n.fit) return n;
    const frames = { ...n.frames };
    for (const s of doc.sizes) { const f = frames[s.id]; if (f) frames[s.id] = { ...f, rect: textBox(n, f, measure, typeScale(s.guide, canvasSize(s.ratio))).rect }; }
    return { ...n, frames };
  }) };
}
/** First horizontal guide line (or the bottom edge) a grown text block crosses below its box, for the overlay mark (5q). */
export function crossing(box: Rect, height: number, lines: { id: string; at: number }[]): { id: string; at: number } | null {
  const hit = lines.filter(l => l.at > box.y + box.h + EPS && l.at < box.y + height - EPS).sort((a, b) => a.at - b.at)[0];
  return hit ?? null;
}
