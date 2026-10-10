import { center, type Point, type Rect } from '../../core/geometry';
import type { Handle } from '../../core/snap';
/** Raw resize in the node's frame: the corner or edge opposite the handle stays put on screen (prototype `resize`). */
export function resizeLocal(box: Rect, rot: number, handle: Handle, p: Point, o: { lockAspect: boolean; min: { w: number; h: number } }): { rect: Rect; dominantAxis: 'x' | 'y' } {
  const th = rot * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), c0 = center(box);
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0, sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const ox = -sx * box.w / 2, oy = -sy * box.h / 2, A = { x: c0.x + cs * ox - sn * oy, y: c0.y + sn * ox + cs * oy };
  const vx = p.x - A.x, vy = p.y - A.y, lx = cs * vx + sn * vy, ly = -sn * vx + cs * vy;
  let w = sx ? Math.max(o.min.w, sx * lx) : box.w, h = sy ? Math.max(o.min.h, sy * ly) : box.h;
  const dominantAxis = Math.abs(w / box.w - 1) >= Math.abs(h / box.h - 1) ? 'x' : 'y';
  if (o.lockAspect && sx && sy) { const s = Math.max(w / box.w, h / box.h, o.min.w / box.w, o.min.h / box.h); w = box.w * s; h = box.h * s; }
  const hx = sx * w / 2, hy = sy * h / 2, cx = A.x + cs * hx - sn * hy, cy = A.y + sn * hx + cs * hy;
  return { rect: { x: cx - w / 2, y: cy - h / 2, w, h }, dominantAxis };
}
