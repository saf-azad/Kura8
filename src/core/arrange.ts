import type { Rect } from './geometry';
// Align and distribute (D-063). Works on drawn, rotated bounds and returns a move per block; the app applies the
// moves to every size's own frame only in the active size. One block aligns to the canvas, several to their joint
// bounds; distributing needs three or more and keeps the outermost two where they are.
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export type DistributeMode = 'x' | 'y';
export type Move = { dx: number; dy: number };
export const unionOf = (rects: Rect[]): Rect => {
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y));
  return { x, y, w: Math.max(...rects.map(r => r.x + r.w)) - x, h: Math.max(...rects.map(r => r.y + r.h)) - y };
};
/** `key`: blocks that stay put and set the target (locked blocks in the selection), as a key object does in Illustrator. */
export function align(boxes: { id: string; rect: Rect }[], mode: AlignMode, canvas: Rect, key: Rect[] = []): Record<string, Move> {
  const t = key.length ? unionOf(key) : boxes.length === 1 ? canvas : unionOf(boxes.map(b => b.rect)), out: Record<string, Move> = {};
  for (const { id, rect: r } of boxes) {
    const dx = mode === 'left' ? t.x - r.x : mode === 'right' ? t.x + t.w - r.x - r.w : mode === 'hcenter' ? t.x + t.w / 2 - r.x - r.w / 2 : 0;
    const dy = mode === 'top' ? t.y - r.y : mode === 'bottom' ? t.y + t.h - r.y - r.h : mode === 'vcenter' ? t.y + t.h / 2 - r.y - r.h / 2 : 0;
    out[id] = { dx, dy };
  }
  return out;
}
export function distribute(boxes: { id: string; rect: Rect }[], mode: DistributeMode): Record<string, Move> {
  const out: Record<string, Move> = {};
  if (boxes.length < 3) return out;
  const pos = (r: Rect) => mode === 'x' ? r.x : r.y, len = (r: Rect) => mode === 'x' ? r.w : r.h;
  const sorted = [...boxes].sort((a, b) => pos(a.rect) + len(a.rect) / 2 - (pos(b.rect) + len(b.rect) / 2));
  const first = sorted[0].rect, last = sorted[sorted.length - 1].rect;
  const gap = (pos(last) + len(last) - pos(first) - sorted.reduce((s, b) => s + len(b.rect), 0)) / (sorted.length - 1);
  let at = pos(first);
  for (const { id, rect } of sorted) { const d = at - pos(rect); out[id] = mode === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d }; at += len(rect) + gap; }
  return out;
}
