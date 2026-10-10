import { contains, center, rotatePoint, type Point, type Rect, type Size } from './geometry';
// Image placement maths. The cover crop is derived from the frame and the focus point, never stored (AGENTS: Document v2).
export const CENTRE: Point = { x: .5, y: .5 };
/** Source rectangle (in natural pixels) that covers a frame of `frame` proportions, `zoom` times closer than a plain cover, centred on `focus` and clamped inside the image. */
export function coverCrop(natural: Size, frame: Size, focus: Point = CENTRE, zoom = 1): Rect {
  const scale = Math.max(frame.w / natural.w, frame.h / natural.h) * Math.max(1, zoom), w = Math.min(natural.w, frame.w / scale), h = Math.min(natural.h, frame.h / scale);
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return { x: clamp(focus.x * natural.w - w / 2, natural.w - w), y: clamp(focus.y * natural.h - h / 2, natural.h - h), w, h };
}
/** Working-copy size (5n): longest side at most `factor` × the largest export side, never upscaled. */
export function workingSize(natural: Size, maxExport: number, factor = 2): Size {
  const k = Math.min(1, factor * maxExport / Math.max(natural.w, natural.h));
  return { w: Math.max(1, Math.round(natural.w * k)), h: Math.max(1, Math.round(natural.h * k)) };
}
/** Where a dropped image lands (5p): the smallest cell containing the point, else the cell with the nearest centre; without cells, the middle half of the canvas. */
export function nearestCell(p: Point, cells: Rect[], canvas: Size): Rect {
  const inside = cells.filter(c => contains(c, p)).sort((a, b) => a.w * a.h - b.w * b.h);
  if (inside.length) return { ...inside[0] };
  const d = (c: Rect) => Math.hypot(center(c).x - p.x, center(c).y - p.y);
  const near = [...cells].sort((a, b) => d(a) - d(b))[0];
  return near ? { ...near } : { x: canvas.w / 4, y: canvas.h / 4, w: canvas.w / 2, h: canvas.h / 2 };
}
/** A frame of the image's proportions centred in `box` (contain), used for images added without a target cell. */
export function containIn(box: Rect, natural: Size): Rect {
  const k = Math.min(box.w / natural.w, box.h / natural.h), w = natural.w * k, h = natural.h * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
/** Where the whole picture sits in frame-local units (frame top-left at 0, 0) for a cover crop with `focus` and `zoom`. */
export function placement(natural: Size, frame: Size, focus: Point = CENTRE, zoom = 1): Rect {
  const c = coverCrop(natural, frame, focus, zoom), s = frame.w / c.w;
  return { x: 0 - c.x * s, y: 0 - c.y * s, w: natural.w * s, h: natural.h * s };
}
/** The focus and zoom that reproduce a placement covering the frame (the inverse of `placement`). */
export function fromPlacement(natural: Size, frame: Size, p: Rect): { focus: Point; zoom: number } {
  const s = p.w / natural.w, cover = Math.max(frame.w / natural.w, frame.h / natural.h), clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { focus: { x: clamp((-p.x + frame.w / 2) / s / natural.w), y: clamp((-p.y + frame.h / 2) / s / natural.h) }, zoom: Math.max(1, s / cover) };
}
/** A placement grown about its centre until it covers the frame, then shifted so no frame edge shows past the picture. */
export function coverPlacement(frame: Size, p: Rect): Rect {
  const k = Math.max(1, frame.w / p.w, frame.h / p.h), w = p.w * k, h = p.h * k;
  const x = Math.min(0, Math.max(frame.w - w, p.x + p.w / 2 - w / 2)), y = Math.min(0, Math.max(frame.h - h, p.y + p.h / 2 - h / 2));
  return { x, y, w, h };
}
/** Keeps the picture fixed on the page while its frame changes from `a` to `b` (both turned `rot` about their centres): the placement in b's local units. */
export function rebase(p: Rect, a: Rect, b: Rect, rot: number): Rect {
  const corner = rotatePoint({ x: a.x + p.x, y: a.y + p.y }, center(a), rot), local = rotatePoint(corner, center(b), -rot);
  return { x: local.x - b.x, y: local.y - b.y, w: p.w, h: p.h };
}
