export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
export type Rect = Point & Size;
export const center = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const contains = (r: Rect, p: Point): boolean => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
