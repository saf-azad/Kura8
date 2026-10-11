import type { Measure, Rect, Size } from './geometry';
import type { Frame, KuraDoc, TextNode } from './document';
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
/**
 * The space a block holds: its lines, or for autofit text its whole room, which the layout keeps clear under the letters
 * (the poster's band sits under the room, D-076/D-077).
 */
const held = (n: TextNode, b: TextBox): TextBox => n.fit ? b : extent(b);
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS;
export function flowText(before: KuraDoc, after: KuraDoc, id: string, measure: Measure): KuraDoc {
  const was = before.nodes.find(n => n.id === id), now = after.nodes.find(n => n.id === id);
  if (was?.kind !== 'text' || now?.kind !== 'text') return after;
  let doc = after;
  for (const spec of after.sizes) {
    const f0 = was.frames[spec.id], f1 = now.frames[spec.id];
    if (!f0 || !f1 || f0.hidden || f1.hidden || f0.rot || f1.rot) continue;
    const scale = typeScale(spec.guide, canvasSize(spec.ratio)), b0 = held(was, textBox(was, f0, measure, scale)), b1 = held(now, textBox(now, f1, measure, scale));
    const dy = b1.rect.y + b1.rect.h - (b0.rect.y + b0.rect.h);
    // A room gives nothing back: leaving autofit (Smaller on a poster headline) never pulls the text under it up (D-077).
    if (Math.abs(dy) < EPS || (was.fit && dy < 0)) continue;
    const stack = new Map<string, { rect: Rect; line: number }>(), others: { id: string; rect: Rect }[] = [];
    for (const n of doc.nodes) {
      const f = n.frames[spec.id];
      if (n.id === id || n.kind !== 'text' || !f || f.hidden || f.rot) continue;
      const b = held(n as TextNode, textBox(n as TextNode, f, measure, scale));
      others.push({ id: n.id, rect: b.rect });
      if (!n.locked) stack.set(n.id, { rect: b.rect, line: b.size * LINE_HEIGHT });
    }
    const queue = [{ rect: b0.rect, line: b0.size * LINE_HEIGHT }], moving: string[] = [];
    while (queue.length) {
      const above = queue.shift()!, bottom = above.rect.y + above.rect.h;
      for (const [nid, below] of stack) {
        const r = below.rect;
        // A big jump (a pasted paragraph) reaches blocks further down than one line: they follow too (D-070).
        if (!overlaps(r, above.rect) || r.y < bottom - EPS || r.y > bottom + Math.max(above.line, dy) + EPS) continue;
        // Rising, a block also sitting under another block that stays (a footer under two columns) stays with it (D-077).
        if (dy < 0 && others.some(o => o.id !== nid && !moving.includes(o.id) && overlaps(o.rect, r) && o.rect.y + o.rect.h <= r.y + EPS && o.rect.y + o.rect.h > bottom + dy + EPS)) continue;
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
/** How wide a text block may grow from its aligned edge to the canvas edge it grows towards; a turned block may use the canvas width. */
export function roomFor(n: TextNode, f: Frame, canvas: Size): number {
  const r = f.rect, side = physicalAlign(n.align, direction(n.text)), cx = r.x + r.w / 2;
  return f.rot ? canvas.w : side === 'left' ? canvas.w - r.x : side === 'right' ? r.x + r.w : 2 * Math.min(cx, canvas.w - cx);
}
/** The largest size up to `size` at which no word of the text breaks across lines `width` wide (to half a unit). */
export function wholeWordSize(text: string, size: number, width: number, weight: 400 | 700, measure: Measure, font?: TextNode['font']): number {
  const whole = (s: number) => !splitsWord(text, measure(text, s, weight, width, font));
  if (whole(size)) return size;
  let lo = 0, hi = size;
  while (hi - lo > .5) { const mid = (lo + hi) / 2; if (whole(mid)) lo = mid; else hi = mid; }
  return Math.floor(lo * 2) / 2;
}
/**
 * One-line text keeps its shape (D-070, D-077): when a size, face, weight or text change alters a block that was a single
 * line, a box that hugged its words (within 15 %) follows them, growing or shrinking like an auto-width label, and a wider
 * box widens only when a word would otherwise break. The aligned edge stays where it is, rotated or not (the box grows
 * away from it, never back over what lies on that side), and the box never grows past the canvas: beyond that it wraps.
 * Autofit and multi-paragraph text keep their width. Applied in every size.
 */
export function hugText(before: KuraDoc, after: KuraDoc, id: string, measure: Measure): KuraDoc {
  const was = before.nodes.find(n => n.id === id), now = after.nodes.find(n => n.id === id);
  if (was?.kind !== 'text' || now?.kind !== 'text' || now.fit || now.text.includes('\n') || !now.text.trim()) return after;
  let doc = after;
  for (const spec of after.sizes) {
    const f0 = was.frames[spec.id], f1 = now.frames[spec.id];
    if (!f0 || !f1) continue;
    const scale = typeScale(spec.guide, canvasSize(spec.ratio)), b0 = textBox(was, f0, measure, scale);
    if (b0.lines.length !== 1) continue;
    const w0 = drawnWeight(was.font, was.weight), w1 = drawnWeight(now.font, now.weight), s1 = f1.fontSize ?? scale.body;
    const natural0 = oneLineWidth(was.text, b0.size, w0, measure, was.font), natural1 = oneLineWidth(now.text, s1, w1, measure, now.font) * 1.02;
    const hugging = f0.rect.w <= natural0 * 1.15 + 1, r = f1.rect, lines = measure(now.text, s1, w1, r.w, now.font);
    if (!hugging && (lines.length < 2 || !splitsWord(now.text, lines))) continue;
    const side = physicalAlign(now.align, direction(now.text)), cx = r.x + r.w / 2, room = roomFor(now, f1, canvasSize(spec.ratio));
    const cap = Math.max(room, hugging ? 0 : r.w), w = Math.max(hugging ? 0 : r.w, Math.min(natural1, cap));
    if (Math.abs(w - r.w) < 1e-6) continue;
    // Keep the aligned edge's point fixed on the page: the centre moves along the box's own x axis.
    const a = (width: number) => side === 'left' ? -width / 2 : side === 'right' ? width / 2 : 0, t = f1.rot * Math.PI / 180, d = a(r.w) - a(w);
    const c = { x: cx + d * Math.cos(t), y: r.y + r.h / 2 + d * Math.sin(t) };
    doc = { ...doc, nodes: doc.nodes.map(n => n.id === id ? { ...n, frames: { ...n.frames, [spec.id]: { ...f1, rect: { ...r, x: c.x - w / 2, y: c.y - r.h / 2, w } } } } : n) };
  }
  return doc;
}
