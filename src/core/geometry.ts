import type { FontId } from './document';
export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
export type Rect = Point & Size;
/** Injected line breaker: core never measures text itself. Returns the wrapped lines of `text` at `size` and `weight` within `width`. */
/** Line breaks for text at a size, weight and wrap width; `font` absent means Space Grotesk (D-049). */
export type Measure = (text: string, size: number, weight: 400 | 700, width: number, font?: FontId) => string[];
export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const contains = (r: Rect, p: Point): boolean => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
export const intersects = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** Degrees into (-180, 180]. */
export const norm = (deg: number): number => { const a = ((deg % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
export const modn = (a: number, n: number): number => ((a % n) + n) % n;
/** Rotate `p` about `c` by `deg` degrees (clockwise on screen, where y points down). */
export function rotatePoint(p: Point, c: Point, deg: number): Point {
  const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}
/** The four corners of `r` rotated about its centre: nw, ne, se, sw. */
export function corners(r: Rect, rot: number): Point[] {
  const c = center(r);
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }].map(p => rot ? rotatePoint(p, c, rot) : p);
}
export function boundsOf(points: Point[]): Rect {
  const xs = points.map(p => p.x), ys = points.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** Axis-aligned bounding box of `r` rotated about its centre. */
export const rotatedBounds = (r: Rect, rot: number): Rect => rot ? boundsOf(corners(r, rot)) : { ...r };
/** Hit test against `r` rotated about its centre. */
export const containsRotated = (r: Rect, rot: number, p: Point): boolean => contains(r, rot ? rotatePoint(p, center(r), -rot) : p);
export const unionRect = (rects: Rect[]): Rect => boundsOf(rects.flatMap(r => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]));
/** True when `deg` is a whole multiple of 90 degrees. */
export const quarterTurn = (deg: number): boolean => Math.abs(deg / 90 - Math.round(deg / 90)) < 1e-9;
