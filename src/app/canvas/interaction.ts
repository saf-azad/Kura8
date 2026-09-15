import type { DocNode, RatioDoc } from '../../core/document';
import { contains, type Point, type Rect, type Size } from '../../core/geometry';
import { snap, type Handle, type SnapHit } from '../../core/snap';
import type { Anchor } from '../../core/guides/types';
import { shapeContains } from './shapes';
import { handles } from './overlay';
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, lockAspect: boolean): { rect: Rect; dominantAxis: 'x' | 'y' } {
  const dominantAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  if (handle === 'move') return { rect: { ...start, x: start.x + dx, y: start.y + dy }, dominantAxis };
  let w = handle.includes('e') ? start.w + dx : handle.includes('w') ? start.w - dx : start.w;
  let h = handle.includes('s') ? start.h + dy : handle.includes('n') ? start.h - dy : start.h;
  if (lockAspect) {
    const aspect = start.w / start.h;
    if (dominantAxis === 'x') { w = Math.max(20, 20 * aspect, w); h = w / aspect; }
    else { h = Math.max(20, 20 / aspect, h); w = h * aspect; }
  } else { w = Math.max(20, w); h = Math.max(20, h); }
  return { rect: { x: handle.includes('w') ? start.x + start.w - w : start.x, y: handle.includes('n') ? start.y + start.h - h : start.y, w, h }, dominantAxis };
}
type Config = { canvas: HTMLCanvasElement; doc: RatioDoc; size: Size; anchors: Anchor[]; snapping: boolean; scale(): number; selected(): DocNode | undefined; select(id?: string): void; change(hits: SnapHit[]): void; edit(node: DocNode): void };
export function installInteraction(config: Config): void {
  const { canvas, doc } = config;
  const hitContext = document.createElement('canvas').getContext('2d')!;
  const hit = (node: DocNode, p: Point) => node.type === 'rect' ? shapeContains(hitContext, node, p) : contains(node.rect, p);
  let drag: { pointer: number; node: DocNode; handle: Handle; start: Point; rect: Rect } | undefined;
  const point = (e: PointerEvent | MouseEvent): Point => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / config.scale(), y: (e.clientY - r.top) / config.scale() }; };
  const handleAt = (p: Point): Handle | undefined => { const node = config.selected(); return node && handles(node).find(h => Math.hypot(h.point.x - p.x, h.point.y - p.y) <= 10 / config.scale())?.handle; };
  canvas.onpointerdown = e => {
    if (e.button !== 0 || drag) return;
    const p = point(e), handle = handleAt(p);
    const node = handle ? config.selected() : [...doc.nodes].reverse().find(n => hit(n, p));
    config.select(node?.id);
    if (!node || node.locked) return;
    drag = { pointer: e.pointerId, node, handle: handle || 'move', start: p, rect: { ...node.rect } }; canvas.setPointerCapture(e.pointerId); e.preventDefault();
  };
  canvas.onpointermove = e => {
    const p = point(e);
    if (!drag) { const handle = handleAt(p); canvas.style.cursor = handle ? `${handle}-resize` : doc.nodes.some(n => !n.locked && hit(n, p)) ? 'move' : 'default'; return; }
    if (drag.node.locked) { drag = undefined; config.change([]); return; }
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    const axisLock = e.shiftKey && drag.handle === 'move' ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : undefined;
    if (axisLock === 'x') dy = 0;
    if (axisLock === 'y') dx = 0;
    const lockAspect = drag.node.type === 'image' || (e.shiftKey && drag.node.type === 'rect' && drag.handle.length === 2);
    const raw = resizeRect(drag.rect, drag.handle, dx, dy, lockAspect);
    const result = config.snapping ? snap({ ...raw, handle: drag.handle, anchors: config.anchors, canvas: config.size, threshold: 8 / config.scale(), lockAspect, dominantAxis: raw.dominantAxis }) : { rect: raw.rect, hits: [] };
    if (axisLock) {
      const fixed = axisLock === 'x' ? 'y' : 'x';
      result.rect[fixed] = drag.rect[fixed]; result.hits = result.hits.filter(h => h.axis === axisLock);
    }
    // Reject snaps that would violate the app's minimum size; core never clamps.
    const valid = result.rect.w >= 20 && result.rect.h >= 20;
    drag.node.rect = valid ? result.rect : raw.rect; config.change(valid ? result.hits : []);
  };
  const finish = () => { drag = undefined; config.change([]); };
  canvas.onpointerup = finish; canvas.onpointercancel = finish; canvas.onlostpointercapture = finish;
  canvas.ondblclick = e => { const p = point(e), n = [...doc.nodes].reverse().find(n => hit(n, p)); if (n && !n.locked) config.edit(n); };
}
