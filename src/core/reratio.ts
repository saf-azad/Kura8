import { rotatedBounds, type Measure, type Rect, type Size } from './geometry';
import type { DocNode, Frame, KuraDoc, RatioId, SizeSpec, TextNode } from './document';
import type { GuideId } from './guides/types';
import { canvasSize } from './ratios';
import { guideById } from './guides';
import { textBox, textHeight, typeScale } from './fit';
import { oneLineWidth, sitsOn } from './flow';
import { drawnWeight } from './fonts';
import { direction, physicalAlign } from './script';
import { layoutPad } from './compositions';
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
    // Going to a size at least as big both ways (a Header to a Post), text grows by the two sizes' body type rather than
    // keeping the small type of the wide size (D-081); shrinking still follows the geometry.
    // Shrinking, small text stops at three fifths of the new size's body type, so a Post's label stays legible in a Header (D-087).
    const body1 = typeScale(to.guide, c1).body, k0 = node.kind === 'text' && s >= 1 - 1e-9 ? Math.max(1, body1 / typeScale(from.guide, c0).body) : s;
    const fontSize = f.fontSize === undefined ? undefined : node.kind === 'text' ? Math.max(f.fontSize * k0, Math.min(f.fontSize, body1 * .6)) : f.fontSize * k0;
    const k = fontSize !== undefined && f.fontSize ? fontSize / f.fontSize : k0;
    const w = L !== null && Rr !== null && Rr - L > 1 ? Rr - L : Math.min(c1.w, f.rect.w * k);
    let h = T !== null && B !== null && B - T > 1 ? B - T : f.rect.h * s;
    const next: Frame = { ...f, rect: { x: 0, y: 0, w, h }, ...(fontSize === undefined ? {} : { fontSize }) };
    if (node.kind === 'text' && !node.fit) h = boxOf(node, next, measure, c1, to.guide).h;
    // Free text keeps its aligned edge's share of the width, so a left-aligned stack stays aligned (D-082); others centre.
    const side = node.kind === 'text' ? physicalAlign(node.align, direction(node.text)) : 'center';
    const free = side === 'left' ? box.x / c0.w * c1.w : side === 'right' ? (box.x + box.w) / c0.w * c1.w - w : cx - w / 2;
    next.rect = { x: L !== null ? L : Rr !== null ? Rr - w : free, y: T !== null ? T : B !== null ? B - h : cy - h / 2, w, h };
    // Left-aligned text at a thin left margin (a Header's) takes the new size's layout margin, like its right one (D-086).
    if (node.kind === 'text' && !f.rot && L === null && side === 'left') {
      const pad0 = layoutPad(c0), lm = Math.max(box.x / c0.w * c1.w, Math.min(Math.max(0, box.x), pad0) / pad0 * layoutPad(c1));
      if (next.rect.x < lm - 1e-6) next.rect = { ...next.rect, x: lm };
    }
    // Text that grew (wide to tall) stops at its right margin rather than running off the canvas; a margin up to the
    // layout's becomes the new size's layout margin, so a Header's thin margin is not carried into a Post (D-083). Free
    // text away from the edges may grow up to the new size's layout margin (D-087).
    if (node.kind === 'text' && !f.rot) {
      const m0 = Math.max(0, Math.min(box.x, c0.w - box.x - box.w)), pad0 = layoutPad(c0);
      const m = !node.slot && m0 > pad0 ? layoutPad(c1) : Math.max(m0 / c0.w * c1.w, Math.min(m0, pad0) / pad0 * layoutPad(c1));
      const r = next.rect, room = c1.w - m - r.x;
      if (r.x + r.w > c1.w - m + 1e-6 && room >= 20) {
        const nh = node.fit ? r.h : boxOf(node, { ...next, rect: { ...r, w: room } }, measure, c1, to.guide).h;
        next.rect = { ...r, w: room, h: nh, y: T === null && B !== null ? B - nh : r.y };
      }
    }
    // A one-line free label stays on one line in the new size, within its layout margins, keeping its aligned edge where
    // it can: type that grew is never split mid-word (D-087).
    if (node.kind === 'text' && !node.fit && !node.slot && !f.rot && !node.text.includes('\n') && textBox(node, f, measure, typeScale(from.guide, c0)).lines.length === 1) {
      const r = next.rect, b1 = textBox(node, next, measure, typeScale(to.guide, c1)), pad1 = layoutPad(c1);
      const natural = oneLineWidth(node.text, b1.size, drawnWeight(node.font, node.weight), measure, node.font) * 1.02;
      if (b1.lines.length > 1 && natural > r.w && natural <= c1.w - 2 * pad1) {
        const w2 = Math.min(natural, c1.w - 2 * pad1), x0 = side === 'left' ? r.x : side === 'right' ? r.x + r.w - w2 : r.x + (r.w - w2) / 2;
        const x = Math.max(Math.min(x0, c1.w - pad1 - w2), Math.min(pad1, r.x)), nr = { ...r, x, w: w2 };
        next.rect = { ...nr, h: boxOf(node, { ...next, rect: nr }, measure, c1, to.guide).h };
      }
    }
    // An icon, a loose picture (a logo, a photo placed by hand) or a circle picture keeps its proportions (D-077, D-081,
    // D-083): it fits the mapped box, against the edges that stayed on a line, else centred. A layout's picture slot
    // takes the new slot's shape.
    if ((node.kind === 'shape' && node.icon || node.kind === 'image' && (!node.slot || node.mask === 'circle')) && f.rect.h > 0) {
      const a = f.rect.w / f.rect.h, r = next.rect, iw = Math.min(r.w, r.h * a), ih = iw / a;
      const place = (start: number, span: number, size: number, lo: number | null, hi: number | null) => lo !== null && hi === null ? start : hi !== null && lo === null ? start + span - size : start + (span - size) / 2;
      next.rect = { x: place(r.x, r.w, iw, L, Rr), y: place(r.y, r.h, ih, T, B), w: iw, h: ih };
    }
    frames[node.id] = next;
  }
  // Text whose type grew more than its canvas (Banner to Link) can reach the text it stood above: what stood under it,
  // on the same backing, moves down to keep clear, top to bottom (D-087).
  const texts = doc.nodes.filter(n => n.kind === 'text' && !n.frames[from.id].rot && !n.frames[from.id].hidden && !frames[n.id].rot)
    .map(n => ({ n, b0: boxOf(n, n.frames[from.id], measure, c0, from.guide), on: sitsOn(doc, n.id, from.id, n.frames[from.id].rect) }))
    .sort((a, b) => a.b0.y - b.b0.y);
  for (const lower of texts) {
    for (const upper of texts) {
      const a0 = upper.b0, b0 = lower.b0;
      if (upper === lower || upper.on !== lower.on || a0.y + a0.h > b0.y + TOLERANCE || a0.x >= b0.x + b0.w || b0.x >= a0.x + a0.w) continue;
      const a1 = boxOf(upper.n, frames[upper.n.id], measure, c1, to.guide), f1 = frames[lower.n.id], gap = Math.max(0, b0.y - a0.y - a0.h) * s;
      if (a1.x >= f1.rect.x + f1.rect.w || f1.rect.x >= a1.x + a1.w || a1.y + a1.h <= f1.rect.y + TOLERANCE) continue;
      frames[lower.n.id] = { ...f1, rect: { ...f1.rect, y: a1.y + a1.h + gap } };
    }
  }
  for (const node of doc.nodes) flags.push(...flagsFor(node, frames[node.id], measure, c1, to.guide));
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
