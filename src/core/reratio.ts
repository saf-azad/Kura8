import { rotatedBounds, type Measure, type Rect, type Size } from './geometry';
import type { DocNode, Frame, KuraDoc, RatioId, SizeSpec, TextNode } from './document';
import type { GuideId } from './guides/types';
import { canvasSize } from './ratios';
import { guideById } from './guides';
import { textBox, textHeight, typeScale } from './fit';
import { oneLineWidth } from './flow';
import { drawnWeight } from './fonts';
import { direction, physicalAlign } from './script';
// Re-ratio (5v): an edge that sits on a guide line, a canvas edge or the centre line keeps that line id in the new
// geometry; everything else scales about its centre. Anything off the canvas or overflowing is flagged, never cropped.
export type Flag = { id: string; kind: 'off-canvas' | 'overflow' };
type Line = { id: string; at: number };
const TOLERANCE = .5;
export function anchorLines(canvas: Size, guide: GuideId | null): { x: Line[]; y: Line[] } {
  const anchors = guide ? guideById(guide).generate(canvas) : [];
  const axis = (a: 'x' | 'y', length: number): Line[] => [
    { id: `edge-${a === 'x' ? 'left' : 'top'}`, at: 0 }, { id: `centre-${a}`, at: length / 2 }, { id: `edge-${a === 'x' ? 'right' : 'bottom'}`, at: length },
    ...anchors.flatMap(l => l.kind === 'line' && l.axis === a ? [{ id: l.id, at: l.at }] : []),
  ];
  return { x: axis('x', canvas.w), y: axis('y', canvas.h) };
}
const onLine = (v: number, from: Line[], to: Line[]): number | null => {
  const line = from.find(l => Math.abs(l.at - v) < TOLERANCE);
  return line ? to.find(l => l.id === line.id)?.at ?? null : null;
};
/** Effective box of a node in a frame (text grows to its measured height). */
export function boxOf(node: DocNode, frame: Frame, measure: Measure, canvas: Size, guide: GuideId | null): Rect {
  return node.kind === 'text' ? textBox(node, frame, measure, typeScale(guide, canvas)).rect : frame.rect;
}
/** Maps every node's frame from one size to a new ratio and guide; returns the new frames by node id and the flags. */
export function reRatioFrames(doc: KuraDoc, from: SizeSpec, to: { ratio: RatioId; guide: GuideId | null }, measure: Measure): { frames: Record<string, Frame>; flags: Flag[] } {
  const c0 = canvasSize(from.ratio), c1 = canvasSize(to.ratio), s = Math.min(c1.w / c0.w, c1.h / c0.h);
  const l0 = anchorLines(c0, from.guide), l1 = anchorLines(c1, to.guide), frames: Record<string, Frame> = {}, flags: Flag[] = [];
  for (const node of doc.nodes) {
    const f = node.frames[from.id], box = boxOf(node, f, measure, c0, from.guide);
    const cx = (box.x + box.w / 2) / c0.w * c1.w, cy = (box.y + box.h / 2) / c0.h * c1.h;
    const pin = !f.rot, L = pin ? onLine(box.x, l0.x, l1.x) : null, Rr = pin ? onLine(box.x + box.w, l0.x, l1.x) : null;
    const T = pin ? onLine(box.y, l0.y, l1.y) : null, B = pin ? onLine(box.y + box.h, l0.y, l1.y) : null;
    const w = L !== null && Rr !== null && Rr - L > 1 ? Rr - L : f.rect.w * s;
    const fontSize = f.fontSize === undefined ? undefined : f.fontSize * s;
    let h = T !== null && B !== null && B - T > 1 ? B - T : f.rect.h * s;
    const next: Frame = { ...f, rect: { x: 0, y: 0, w, h }, ...(fontSize === undefined ? {} : { fontSize }) };
    if (node.kind === 'text' && !node.fit) h = boxOf(node, next, measure, c1, to.guide).h;
    next.rect = { x: L !== null ? L : Rr !== null ? Rr - w : cx - w / 2, y: T !== null ? T : B !== null ? B - h : cy - h / 2, w, h };
    frames[node.id] = next;
    flags.push(...flagsFor(node, next, measure, c1, to.guide));
  }
  return { frames, flags };
}
/** Where a text block's letters reach: each line's width on the side its alignment puts it, turned with the box (D-077). */
export function letterBounds(node: TextNode, frame: Frame, measure: Measure, canvas: Size, guide: GuideId | null): Rect {
  const b = textBox(node, frame, measure, typeScale(guide, canvas)), weight = drawnWeight(node.font, node.weight);
  const w = Math.min(b.rect.w, Math.max(0, ...b.lines.map(l => oneLineWidth(l, b.size, weight, measure, node.font, b.rect.w))));
  const side = physicalAlign(node.align, direction(node.text)), x = side === 'left' ? b.rect.x : side === 'center' ? b.rect.x + (b.rect.w - w) / 2 : b.rect.x + b.rect.w - w;
  const r = { x, y: b.rect.y, w, h: Math.min(b.rect.h, textHeight(b.lines.length, b.size)) };
  if (!frame.rot) return r;
  const c = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 }, t = frame.rot * Math.PI / 180, cos = Math.cos(t), sin = Math.sin(t);
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([px, py]) => ({ x: c.x + (px - c.x) * cos - (py - c.y) * sin, y: c.y + (px - c.x) * sin + (py - c.y) * cos }));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
const outside = (b: Rect, canvas: Size) => b.x < -TOLERANCE || b.y < -TOLERANCE || b.x + b.w > canvas.w + TOLERANCE || b.y + b.h > canvas.h + TOLERANCE;
export function flagsFor(node: DocNode, frame: Frame, measure: Measure, canvas: Size, guide: GuideId | null): Flag[] {
  if (frame.hidden) return [];
  // Text is off the canvas only when its letters are: an empty stretch of its box past the edge is not flagged (D-077).
  const out: Flag[] = [], b = rotatedBounds(boxOf(node, frame, measure, canvas, guide), frame.rot);
  if (outside(b, canvas) && (node.kind !== 'text' || outside(letterBounds(node, frame, measure, canvas, guide), canvas))) out.push({ id: node.id, kind: 'off-canvas' });
  if (node.kind === 'text' && node.fit && textBox(node, frame, measure, typeScale(guide, canvas)).overflow) out.push({ id: node.id, kind: 'overflow' });
  return out;
}
/** Change ratio (5v): converts the size in place and reports what no longer fits. */
export function reRatio(doc: KuraDoc, sizeId: string, to: { ratio: RatioId; guide?: GuideId | null }, measure: Measure): { doc: KuraDoc; flags: Flag[] } {
  const from = doc.sizes.find(s => s.id === sizeId)!, guide = to.guide === undefined ? from.guide : to.guide;
  const { frames, flags } = reRatioFrames(doc, from, { ratio: to.ratio, guide }, measure);
  return {
    doc: { ...doc, sizes: doc.sizes.map(s => s.id === sizeId ? { ...s, ratio: to.ratio, guide } : s), nodes: doc.nodes.map(n => ({ ...n, frames: { ...n.frames, [sizeId]: frames[n.id] } })) },
    flags,
  };
}
/** Where each node's geometry in a size came from before the latest ratio changes, and the frame the last change gave it (D-054). */
export type RatioOrigin = Record<string, { ratio: RatioId; guide: GuideId | null; frame: Frame; last: Frame }>;
/**
 * Change ratio without drift (D-054): a node left untouched since the last change is mapped from its frame at its
 * origin ratio, so Post → Story → Banner → Post returns it exactly instead of shrinking at every step. A node edited
 * since (or new) is mapped from where it is now, which becomes its origin. Returns the origin for the next change.
 */
export function reRatioKept(doc: KuraDoc, sizeId: string, to: { ratio: RatioId; guide?: GuideId | null }, measure: Measure, origin: RatioOrigin = {}): { doc: KuraDoc; flags: Flag[]; origin: RatioOrigin } {
  const from = doc.sizes.find(s => s.id === sizeId)!, guide = to.guide === undefined ? from.guide : to.guide;
  // Untouched since the last change: map from the origin. Only moved (same size, angle and type size): map from the
  // origin moved by the same share of the canvas, so a nudge does not cost the original size (D-076).
  // A text block's height follows its lines, so retyping it (two lines to one) is not a geometry edit (D-077).
  const c0 = canvasSize(from.ratio), shape = (n: DocNode, f: Frame) => n.kind === 'text' && !n.fit ? { ...f, rect: { ...f.rect, h: 0 } } : f;
  const key = (n: DocNode, f: Frame) => JSON.stringify(shape(n, f)), still = (n: DocNode, f: Frame) => { const g = shape(n, f); return JSON.stringify({ ...g, rect: { ...g.rect, x: 0, y: 0 } }); };
  const start = (n: DocNode) => {
    const o = origin[n.id], f = n.frames[sizeId];
    if (o && key(n, o.last) === key(n, f)) return o;
    if (o && still(n, o.last) === still(n, f)) {
      const co = canvasSize(o.ratio), r = o.frame.rect, dx = (f.rect.x - o.last.rect.x) * co.w / c0.w, dy = (f.rect.y - o.last.rect.y) * co.h / c0.h;
      return { ...o, frame: { ...o.frame, rect: { ...r, x: r.x + dx, y: r.y + dy } } };
    }
    return { ratio: from.ratio, guide: from.guide, frame: f, last: f };
  };
  const starts = new Map(doc.nodes.map(n => [n.id, start(n)])), mapped = new Map<string, Record<string, Frame>>();
  const frameFor = (n: DocNode): Frame => {
    const o = starts.get(n.id)!;
    if (o.ratio === to.ratio && o.guide === guide) return o.frame;
    const key = `${o.ratio}|${o.guide}`;
    if (!mapped.has(key)) {
      const base: KuraDoc = { ...doc, nodes: doc.nodes.map(m => { const p = starts.get(m.id)!; return p.ratio === o.ratio && p.guide === o.guide ? { ...m, frames: { ...m.frames, [sizeId]: p.frame } } : m; }) };
      mapped.set(key, reRatioFrames(base, { ...from, ratio: o.ratio, guide: o.guide }, { ratio: to.ratio, guide }, measure).frames);
    }
    return mapped.get(key)![n.id];
  };
  const frames = Object.fromEntries(doc.nodes.map(n => [n.id, frameFor(n)])), c1 = canvasSize(to.ratio);
  const out: KuraDoc = { ...doc, sizes: doc.sizes.map(s => s.id === sizeId ? { ...s, ratio: to.ratio, guide } : s), nodes: doc.nodes.map(n => ({ ...n, frames: { ...n.frames, [sizeId]: frames[n.id] } })) };
  return { doc: out, flags: out.nodes.flatMap(n => flagsFor(n, frames[n.id], measure, c1, guide)), origin: Object.fromEntries(doc.nodes.map(n => { const o = starts.get(n.id)!; return [n.id, { ratio: o.ratio, guide: o.guide, frame: o.frame, last: frames[n.id] }]; })) };
}
