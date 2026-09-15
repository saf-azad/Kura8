import type { RectNode, ShapeKind } from '../../core/document';
import type { Point } from '../../core/geometry';

export const shapeIcons: Record<ShapeKind, string> = {
  rectangle: '<rect x="4" y="6" width="16" height="12"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
  triangle: '<path d="M12 4 21 20H3Z"/>',
  diamond: '<path d="m12 3 9 9-9 9-9-9Z"/>',
  star: '<path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>',
  arrow: '<path d="M3 9h10V4l8 8-8 8v-5H3Z"/>',
};

export function shapePath(node: RectNode): Path2D {
  const { x, y, w, h } = node.rect, path = new Path2D();
  const shape = node.shape ?? 'rectangle';
  if (shape === 'rectangle') { path.rect(x, y, w, h); return path; }
  if (shape === 'ellipse') { path.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); return path; }
  const points: number[][] = shape === 'triangle' ? [[.5, 0], [1, 1], [0, 1]]
    : shape === 'diamond' ? [[.5, 0], [1, .5], [.5, 1], [0, .5]]
    : shape === 'arrow' ? [[0, .3], [.6, .3], [.6, 0], [1, .5], [.6, 1], [.6, .7], [0, .7]]
    : Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 ? .22 : .5;
      return [.5 + Math.cos(angle) * radius, .5 + Math.sin(angle) * radius];
    });
  // Fit polygon extrema to the same bounding box used by handles and snapping.
  const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
  const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
  points.forEach(([px, py], i) => {
    const tx = x + (px - minX) / (maxX - minX) * w, ty = y + (py - minY) / (maxY - minY) * h;
    if (i) path.lineTo(tx, ty); else path.moveTo(tx, ty);
  });
  path.closePath(); return path;
}

export function shapeContains(ctx: CanvasRenderingContext2D, node: RectNode, point: Point): boolean {
  return ctx.isPointInPath(shapePath(node), point.x, point.y);
}
