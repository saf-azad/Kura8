import { rotatedBounds, type Measure, type Rect, type Size } from './geometry';
import type { DocNode, Frame, KuraDoc, RatioId, SizeSpec } from './document';
import type { GuideId } from './guides/types';
import { canvasSize } from './ratios';
import { guideById } from './guides';
import { textBox, typeScale } from './fit';
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
export function flagsFor(node: DocNode, frame: Frame, measure: Measure, canvas: Size, guide: GuideId | null): Flag[] {
  if (frame.hidden) return [];
  const out: Flag[] = [], b = rotatedBounds(boxOf(node, frame, measure, canvas, guide), frame.rot);
  if (b.x < -TOLERANCE || b.y < -TOLERANCE || b.x + b.w > canvas.w + TOLERANCE || b.y + b.h > canvas.h + TOLERANCE) out.push({ id: node.id, kind: 'off-canvas' });
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
