import type { Measure, Rect } from './geometry';
import type { KuraDoc, TextNode } from './document';
import { canvasSize } from './ratios';
import { LINE_HEIGHT, splitsWord, textBox, textHeight, typeScale, type TextBox } from './fit';
import { drawnWeight } from './fonts';
import { direction, physicalAlign } from './script';
import { nudge } from './ops';
// Stacked text follows (D-046): when an edit changes a text block's drawn height, unlocked text blocks that sat just
// under it move by the same amount, and the blocks under those follow in turn. "Just under" means unrotated, sharing
// some width, with a top no further below the old bottom than one line of the block above (or than the growth). Applied in every size,
// since text is linked across sizes and wraps differently in each.
const EPS = 1e-6;
/** A text box cut to its lines. */
const extent = (b: TextBox): TextBox => ({ ...b, rect: { ...b.rect, h: textHeight(b.lines.length, b.size) } });
export function flowText(before: KuraDoc, after: KuraDoc, id: string, measure: Measure): KuraDoc {
  const was = before.nodes.find(n => n.id === id), now = after.nodes.find(n => n.id === id);
  if (was?.kind !== 'text' || now?.kind !== 'text') return after;
  let doc = after;
  for (const spec of after.sizes) {
    const f0 = was.frames[spec.id], f1 = now.frames[spec.id];
    if (!f0 || !f1 || f0.hidden || f1.hidden || f0.rot || f1.rot) continue;
    // Flow follows the lines, not the box: an autofit room is mostly empty, and turning autofit off or shrinking its
    // text must not pull the text under the room (the poster's band) up to the letters (D-076).
    const scale = typeScale(spec.guide, canvasSize(spec.ratio)), b0 = extent(textBox(was, f0, measure, scale)), b1 = extent(textBox(now, f1, measure, scale));
    const dy = b1.rect.y + b1.rect.h - (b0.rect.y + b0.rect.h);
    if (Math.abs(dy) < EPS) continue;
    const stack = new Map<string, { rect: Rect; line: number }>();
    for (const n of doc.nodes) {
      const f = n.frames[spec.id];
      if (n.id === id || n.kind !== 'text' || n.locked || !f || f.hidden || f.rot) continue;
      const b = extent(textBox(n as TextNode, f, measure, scale));
      stack.set(n.id, { rect: b.rect, line: b.size * LINE_HEIGHT });
    }
    const queue = [{ rect: b0.rect, line: b0.size * LINE_HEIGHT }], moving: string[] = [];
    while (queue.length) {
      const above = queue.shift()!, bottom = above.rect.y + above.rect.h;
      for (const [nid, below] of stack) {
        const r = below.rect, sharesWidth = r.x < above.rect.x + above.rect.w - EPS && above.rect.x < r.x + r.w - EPS;
        // A big jump (a pasted paragraph) reaches blocks further down than one line: they follow too (D-070).
        if (!sharesWidth || r.y < bottom - EPS || r.y > bottom + Math.max(above.line, dy) + EPS) continue;
        stack.delete(nid); moving.push(nid); queue.push(below);
      }
    }
    if (moving.length) doc = nudge(doc, spec.id, moving, 0, dy);
  }
  return doc;
}
/** The narrowest width that keeps a text on one line (a word wider than the line counts as wrapping). */
export function oneLineWidth(text: string, size: number, weight: 400 | 700, measure: Measure, font?: TextNode['font'], max = 8000): number {
  let lo = 0, hi = max;
  if (measure(text, size, weight, hi, font).length > 1) return hi;
  while (hi - lo > .25) { const mid = (lo + hi) / 2; if (measure(text, size, weight, mid, font).length === 1 && !splitsWord(text, measure(text, size, weight, mid, font))) hi = mid; else lo = mid; }
  return hi;
}
/**
 * One-line text keeps its shape (D-070): when a size, face or weight change alters a block that was a single line,
 * a box that hugged its words (within 15 %) hugs them again, and a wider box that would now wrap widens to keep the
 * line, never past the canvas. The box grows from its aligned edge. Autofit, rotated and multi-paragraph text keep
 * their width. Applied in every size.
 */
export function hugText(before: KuraDoc, after: KuraDoc, id: string, measure: Measure): KuraDoc {
  const was = before.nodes.find(n => n.id === id), now = after.nodes.find(n => n.id === id);
  if (was?.kind !== 'text' || now?.kind !== 'text' || now.fit || now.text.includes('\n') || !now.text.trim()) return after;
  let doc = after;
  for (const spec of after.sizes) {
    const f0 = was.frames[spec.id], f1 = now.frames[spec.id];
    if (!f0 || !f1 || f1.rot) continue;
    const scale = typeScale(spec.guide, canvasSize(spec.ratio)), b0 = textBox(was, f0, measure, scale);
    if (b0.lines.length !== 1) continue;
    const w0 = drawnWeight(was.font, was.weight), w1 = drawnWeight(now.font, now.weight), s1 = f1.fontSize ?? scale.body;
    const natural0 = oneLineWidth(was.text, b0.size, w0, measure, was.font), natural1 = oneLineWidth(now.text, s1, w1, measure, now.font) * 1.02;
    const hugging = f0.rect.w <= natural0 * 1.15 + 1, wraps = measure(now.text, s1, w1, f1.rect.w, now.font).length > 1;
    if (!hugging && !wraps) continue;
    const canvas = canvasSize(spec.ratio), w = Math.min(natural1, canvas.w), r = f1.rect, side = physicalAlign(now.align, direction(now.text));
    let x = side === 'left' ? r.x : side === 'center' ? r.x + r.w / 2 - w / 2 : r.x + r.w - w;
    x = Math.max(Math.min(x, canvas.w - w), Math.min(0, r.x));
    doc = { ...doc, nodes: doc.nodes.map(n => n.id === id ? { ...n, frames: { ...n.frames, [spec.id]: { ...f1, rect: { ...r, x, w } } } } : n) };
  }
  return doc;
}
