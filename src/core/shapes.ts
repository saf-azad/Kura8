import type { Point, Rect } from './geometry';
// Shape library for rect nodes. Every shape fills its node rect exactly, so the
// bounding box (and therefore hit testing, handles and snapping) is unchanged.
export type ShapeId = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'hexagon' | 'star';
export type Shape = { id: ShapeId; name: string };
export const shapes: readonly Shape[] = [
  { id: 'rectangle', name: 'Rectangle' }, { id: 'ellipse', name: 'Ellipse' }, { id: 'triangle', name: 'Triangle' },
  { id: 'diamond', name: 'Diamond' }, { id: 'hexagon', name: 'Hexagon' }, { id: 'star', name: 'Star' },
];
export const shapeIds: readonly ShapeId[] = shapes.map(s => s.id);
export const DEFAULT_SHAPE: ShapeId = 'rectangle';
export const isShapeId = (x: unknown): x is ShapeId => typeof x === 'string' && (shapeIds as readonly string[]).includes(x);
export function shapeById(id: ShapeId): Shape { return shapes.find(s => s.id === id)!; }
/** Unit-square vertices (0..1) for polygon shapes; ellipses are drawn analytically. */
function unitPolygon(id: Exclude<ShapeId, 'ellipse'>): Point[] {
  switch (id) {
    case 'rectangle': return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    case 'triangle': return [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    case 'diamond': return [{ x: 0.5, y: 0 }, { x: 1, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }];
    case 'hexagon': return [{ x: 0.25, y: 0 }, { x: 0.75, y: 0 }, { x: 1, y: 0.5 }, { x: 0.75, y: 1 }, { x: 0.25, y: 1 }, { x: 0, y: 0.5 }];
    case 'star': {
      // Five-point star, outer radius 0.5, inner radius chosen so the outline stays regular; then normalised to fill the unit square.
      const raw: Point[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 === 0 ? 0.5 : 0.5 * 0.382;
        raw.push({ x: 0.5 + r * Math.cos(angle), y: 0.5 + r * Math.sin(angle) });
      }
      const xs = raw.map(p => p.x), ys = raw.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      return raw.map(p => ({ x: (p.x - minX) / (maxX - minX), y: (p.y - minY) / (maxY - minY) }));
    }
  }
}
/** Polygon vertices in unit space for the shape inscribed in `rect`, or null for the ellipse. */
export function shapeOutline(id: ShapeId, rect: Rect): Point[] | null {
  if (id === 'ellipse') return null;
  return unitPolygon(id).map(p => ({ x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h }));
}
