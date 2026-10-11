import type { Measure, Rect, Size } from './geometry';
import type { Frame, KuraDoc, TextNode } from './document';
import { canvasSize } from './ratios';
import { LINE_HEIGHT, splitsWord, textBox, textHeight, typeScale, type TextBox } from './fit';
import { drawnWeight } from './fonts';
import { direction, physicalAlign } from './script';
import { nudge } from './ops';
import { layoutPad } from './compositions';
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
const inside = (outer: Rect, r: Rect) => r.x >= outer.x - EPS && r.y >= outer.y - EPS && r.x + r.w <= outer.x + outer.w + EPS && r.y + r.h <= outer.y + outer.h + EPS;
/**
 * What a text block sits on in a size: the topmost unturned picture or shape under its top-left corner, else the ground
 * (null). Text flows only among blocks on the same thing, so the poster's band text never follows the headline above the
 * band, in any ratio (D-082); a caption that grows past its photo still sits on the photo (D-083).
 */
export function sitsOn(doc: KuraDoc, id: string, sizeId: string, r: Rect, whole = false): string | null {
  const probe = whole ? r : { x: r.x + .5, y: r.y + .5, w: 0, h: 0 };
  for (let j = doc.nodes.findIndex(n => n.id === id) - 1; j >= 0; j--) {
    const b = doc.nodes[j], f = b.frames[sizeId];
    if (b.kind !== 'text' && b.kind !== 'ink' && f && !f.hidden && !f.rot && inside(f.rect, probe)) return b.id;
  }
  return null;
}
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
    const stack = new Map<string, { rect: Rect; line: number }>(), others: { id: string; rect: Rect }[] = [], on = sitsOn(doc, id, spec.id, b0.rect);
    for (const n of doc.nodes) {
      const f = n.frames[spec.id];
      if (n.id === id || n.kind !== 'text' || !f || f.hidden || f.rot) continue;
      const b = held(n as TextNode, textBox(n as TextNode, f, measure, scale));
      others.push({ id: n.id, rect: b.rect });
      if (!n.locked && sitsOn(doc, n.id, spec.id, b.rect) === on) stack.set(n.id, { rect: b.rect, line: b.size * LINE_HEIGHT });
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
    // Text is never pushed past the canvas bottom: a stack that would leave the canvas stops at its edge (D-086).
    const canvas = canvasSize(spec.ratio), lowest = Math.max(...moving.map(m => { const n = doc.nodes.find(x => x.id === m) as TextNode; return held(n, textBox(n, n.frames[spec.id], measure, scale)).rect; }).map(r => r.y + r.h));
    const step = dy > 0 && moving.length ? Math.max(0, Math.min(dy, canvas.h - lowest)) : dy;
    if (moving.length && Math.abs(step) > EPS) doc = nudge(doc, spec.id, moving, 0, step);
  }
  return doc;
}
/**
 * Autofit off for a text block (a hand-set size, 5q): each size keeps the size autofit gave it, so no other linked size
 * jumps to the larger set size (D-085). `except` is the size whose new size the caller sets.
 */
export function unfit(doc: KuraDoc, id: string, measure: Measure, except?: string): KuraDoc {
  const n = doc.nodes.find(x => x.id === id);
  if (n?.kind !== 'text' || !n.fit) return doc;
  const frames = { ...n.frames };
  for (const s of doc.sizes) {
    const f = frames[s.id]; if (!f || s.id === except) continue;
    const b = textBox(n, f, measure, typeScale(s.guide, canvasSize(s.ratio)));
    frames[s.id] = { ...f, fontSize: b.size, rect: { ...f.rect, h: textHeight(b.lines.length, b.size) } };
  }
  const t = { ...n, frames } as TextNode; delete t.fit;
  return { ...doc, nodes: doc.nodes.map(x => x.id === id ? t : x) };
}
/** The narrowest width that keeps a text on one line (a word wider than the line counts as wrapping). */
export function oneLineWidth(text: string, size: number, weight: 400 | 700, measure: Measure, font?: TextNode['font'], max = 8000): number {
  // One character never wraps, so its width is half the narrowest line that keeps it doubled (D-086).
  const t = text.trim();
  if ([...t].length === 1) return oneLineWidth(t + t, size, weight, measure, font, max) / 2;
  let lo = 0, hi = max;
  if (measure(text, size, weight, hi, font).length > 1) return hi;
  while (hi - lo > .25) { const mid = (lo + hi) / 2; if (measure(text, size, weight, mid, font).length === 1 && !splitsWord(text, measure(text, size, weight, mid, font))) hi = mid; else lo = mid; }
  return hi;
}
/**
 * How wide a text block may grow: a free label (or a turned block) the canvas width, since it slides back on; layout text
 * from its aligned edge to the canvas edge it grows towards, less the margin it keeps from the nearer edge (D-081).
 */
export function roomFor(n: TextNode, f: Frame, canvas: Size): number {
  const r = f.rect, side = physicalAlign(n.align, direction(n.text)), cx = r.x + r.w / 2, m = Math.max(0, Math.min(r.x, canvas.w - r.x - r.w));
  if (f.rot || !n.slot) return canvas.w;
  return side === 'left' ? canvas.w - r.x - m : side === 'right' ? r.x + r.w - m : 2 * (Math.min(cx, canvas.w - cx) - m);
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
 * One-line text keeps its shape (D-070, D-077, D-081): when a size, face, weight or text change alters a block that was a
 * single line, a free label (no layout slot) whose box hugged its words (within 15 %) follows them like an auto-width
 * label, growing away from its aligned edge and sliding back to stay on the canvas; beyond the canvas width it wraps.
 * Layout text keeps its slot: it widens only when a word would otherwise break, and only towards the canvas edge on its
 * growing side, so it never crosses back over a picture column. Rotated labels keep their aligned edge's point. A
 * hugging label given several paragraphs (a pasted paragraph) widens to its widest one (D-082). Autofit text, and
 * multi-paragraph text that did not hug, keep their width. Applied in every size.
 */
export function hugText(before: KuraDoc, after: KuraDoc, id: string, measure: Measure): KuraDoc {
  const was = before.nodes.find(n => n.id === id), now = after.nodes.find(n => n.id === id);
  if (was?.kind !== 'text' || now?.kind !== 'text' || now.fit || !now.text.trim()) return after;
  const paragraphs = now.text.includes('\n');
  let doc = after;
  for (const spec of after.sizes) {
    const f0 = was.frames[spec.id], f1 = now.frames[spec.id];
    if (!f0 || !f1) continue;
    const scale = typeScale(spec.guide, canvasSize(spec.ratio)), b0 = textBox(was, f0, measure, scale), oneLine = b0.lines.length === 1;
    const w0 = drawnWeight(was.font, was.weight), w1 = drawnWeight(now.font, now.weight), s1 = f1.fontSize ?? scale.body;
    const natural0 = oneLineWidth(was.text, b0.size, w0, measure, was.font), natural1 = Math.max(...now.text.split('\n').map(p => p.trim() ? oneLineWidth(p, s1, w1, measure, now.font) : 0)) * 1.02;
    const free = !now.slot, hugging = free && oneLine && f0.rect.w <= natural0 * 1.15 + 1, r = f1.rect, lines = measure(now.text, s1, w1, r.w, now.font);
    // A free label that already wraps only widens when its new copy would split a word (D-087).
    if (!oneLine && (!free || !splitsWord(now.text, lines))) continue;
    if (!hugging && (paragraphs || lines.length < 2 || !splitsWord(now.text, lines))) continue;
    const canvas = canvasSize(spec.ratio), side = physicalAlign(now.align, direction(now.text)), whole = { x: 0, y: 0, ...canvas };
    // A free label keeps the inset it has from the canvas edge, or from the block it sits on (a badge, a photo caption),
    // up to a twentieth of that width, on both sides, so it never grows flush against an edge or out of its block (D-083).
    // Both are judged from the box as the edit began, so a label sliding along while it grows keeps its bounds; it sits on
    // a block only when the block holds all of it, and only while the block is wide enough for its longest word (D-085).
    const g = f0.rect, inset = (b: Rect) => Math.max(0, Math.min(g.x - b.x, b.x + b.w - g.x - g.w, b.w / 20));
    const on = free && !f0.rot ? sitsOn(before, id, spec.id, g, true) : null;
    const longest = free ? Math.max(0, ...now.text.split(/\s+/).filter(Boolean).sort((p, q) => q.length - p.length).slice(0, 3).map(word => oneLineWidth(word, s1, w1, measure, now.font))) * 1.02 : 0;
    let b = on ? before.nodes.find(n => n.id === on)!.frames[spec.id]?.rect ?? whole : whole;
    // It grows from its aligned edge and wraps there when that side has at least three tenths of its bounds and the copy
    // stays on the canvas (always from half); a label near the far edge slides back instead to keep one line, or wraps at
    // three fifths of its bounds, never narrower than its longest word (D-084, D-087).
    const gx = g.x + g.w / 2, down = (width: number) => g.y + textHeight(measure(now.text, s1, w1, Math.max(1, width), now.font).length, s1) <= canvas.h;
    const roomIn = (lo: number, hi: number) => {
      const span = hi - lo, aligned = Math.max(0, side === 'left' ? hi - Math.max(lo, g.x) : side === 'right' ? Math.min(hi, g.x + g.w) - lo : 2 * Math.min(gx - lo, hi - gx));
      const wrap = natural1 <= aligned || aligned >= span / 2 || aligned >= span * .3 && down(aligned);
      return Math.max(Math.min(longest, span), wrap ? aligned : natural1 <= span ? span : span * .6);
    };
    /** Whether the copy, in these bounds, stays above the canvas bottom. */
    const holds = (lo: number, hi: number) => down(Math.min(natural1, roomIn(lo, hi)));
    // A block too narrow for its longest word, or one its copy would run off the canvas bottom from while the canvas would
    // hold it, gives way to the canvas (D-086, D-087).
    const mw = inset(whole);
    if (b !== whole && (longest > b.w - 2 * inset(b) || !holds(b.x + inset(b), b.x + b.w - inset(b)) && holds(mw, canvas.w - mw))) b = whole;
    const m = inset(b);
    let lo = b.x + m, hi = b.x + b.w - m;
    // Blocks beside it on its first line (a photo column, the accent block, other text) bound it too, unless that leaves
    // no room for its longest word, or would wrap it off the canvas bottom where its wider bounds would not (D-086, D-087).
    if (free && !f0.rot) {
      const gap = layoutPad(canvas) / 2;
      let l = lo, h = hi;
      for (const o of before.nodes) {
        const of = o.frames[spec.id];
        if (o.id === id || o.id === on || o.kind === 'ink' || !of || of.hidden || of.rot) continue;
        const r = o.kind === 'text' ? textBox(o, of, measure, typeScale(spec.guide, canvas)).rect : of.rect;
        if (r.y >= g.y + g.h - EPS || r.y + r.h <= g.y + EPS) continue;
        if (r.x + r.w <= g.x + EPS) l = Math.max(l, r.x + r.w + gap);
        else if (r.x >= g.x + g.w - EPS) h = Math.min(h, r.x - gap);
      }
      if (h - l >= longest && (holds(l, h) || !holds(lo, hi))) { lo = l; hi = h; }
    }
    const room = free ? (f1.rot ? canvas.w : roomIn(lo, hi)) : roomFor(now, f1, canvas);
    const floor = hugging ? Math.min(natural1, f0.rect.w) : r.w, cap = Math.max(room, floor), w = Math.max(floor, Math.min(natural1, cap));
    // Keep the aligned edge's point fixed on the page: the centre moves along the box's own x axis. A free label is placed
    // from its box as the edit began, so typing key by key ends where a paste does (D-085).
    const base = free ? { ...g, y: r.y, h: r.h } : r, cx = base.x + base.w / 2;
    const a = (width: number) => side === 'left' ? -width / 2 : side === 'right' ? width / 2 : 0, t = f1.rot * Math.PI / 180, d = a(base.w) - a(w);
    const c = { x: cx + d * Math.cos(t), y: base.y + base.h / 2 + d * Math.sin(t) };
    // A free label near an edge (an Arabic label against the left edge) slides back rather than wrapping.
    const x = free && !f1.rot ? Math.max(Math.min(c.x - w / 2, hi - w), Math.min(lo, g.x)) : c.x - w / 2;
    if (Math.abs(w - r.w) < 1e-6 && Math.abs(x - r.x) < 1e-6) continue;
    doc = { ...doc, nodes: doc.nodes.map(n => n.id === id ? { ...n, frames: { ...n.frames, [spec.id]: { ...f1, rect: { ...r, x, y: c.y - r.h / 2, w } } } } : n) };
  }
  return doc;
}
