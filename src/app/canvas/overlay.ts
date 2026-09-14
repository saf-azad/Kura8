import type { Anchor } from '../../core/guides/types';
import type { DocNode } from '../../core/document';
import type { Handle, SnapHit } from '../../core/snap';
import type { Point, Size } from '../../core/geometry';
export function handles(node: DocNode): { handle: Handle; point: Point }[] {
  const { x, y, w, h } = node.rect;
  const list: { handle: Handle; point: Point }[] = [
    { handle: 'nw', point: { x, y } }, { handle: 'ne', point: { x: x + w, y } },
    { handle: 'sw', point: { x, y: y + h } }, { handle: 'se', point: { x: x + w, y: y + h } },
    { handle: 'n', point: { x: x + w / 2, y } }, { handle: 's', point: { x: x + w / 2, y: y + h } },
    { handle: 'w', point: { x, y: y + h / 2 } }, { handle: 'e', point: { x: x + w, y: y + h / 2 } },
  ];
  return list.filter(p => node.type === 'rect' || (node.type === 'image' ? p.handle.length === 2 : p.handle === 'w' || p.handle === 'e'));
}
export function drawOverlay(canvas: HTMLCanvasElement, size: Size, scale: number, anchors: Anchor[], hits: SnapHit[], selected?: DocNode): void {
  const dpr = window.devicePixelRatio || 1; canvas.width = Math.round(size.w * scale * dpr); canvas.height = Math.round(size.h * scale * dpr);
  const ctx = canvas.getContext('2d')!; ctx.scale(scale * dpr, scale * dpr);
  const isHit = (id: string) => hits.some(h => h.targetId === id || h.targetId.startsWith('span-') && h.targetId.includes(id));
  const line = (axis: 'x' | 'y', at: number) => { ctx.beginPath(); ctx.moveTo(axis === 'x' ? at : 0, axis === 'y' ? at : 0); ctx.lineTo(axis === 'x' ? at : size.w, axis === 'y' ? at : size.h); ctx.stroke(); };
  for (const a of anchors) {
    const active = isHit(a.id); ctx.strokeStyle = active ? '#111' : 'rgba(0,0,0,.19)'; ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = (active ? 1.5 : 0.7) / scale; ctx.setLineDash([]);
    if (a.kind === 'line') line(a.axis, a.at);
    if (a.kind === 'point') { ctx.beginPath(); ctx.arc(a.x, a.y, 2 / scale, 0, Math.PI * 2); ctx.fill(); }
    if (a.kind === 'region' && active) { ctx.setLineDash([4 / scale, 3 / scale]); ctx.strokeRect(a.rect.x, a.rect.y, a.rect.w, a.rect.h); }
  }
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2 / scale; ctx.setLineDash([]);
  for (const [id, axis, at] of [['edge-left', 'x', 0], ['edge-right', 'x', size.w], ['edge-top', 'y', 0], ['edge-bottom', 'y', size.h]] as const) if (isHit(id)) line(axis, at);
  if (selected) {
    const r = selected.rect; ctx.strokeStyle = '#111'; ctx.lineWidth = 1 / scale; ctx.strokeRect(r.x, r.y, r.w, r.h);
    for (const { point } of handles(selected)) { const s = 7 / scale; ctx.fillStyle = '#fff'; ctx.fillRect(point.x - s / 2, point.y - s / 2, s, s); ctx.strokeRect(point.x - s / 2, point.y - s / 2, s, s); }
  }
}
