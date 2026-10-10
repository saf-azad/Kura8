import type { DocNode, Frame, KuraDoc } from './document';
import { unionRect, type Point, type Rect, type Size } from './geometry';
import { updateNodes } from './ops';
// Arranging (D-045): align and distribute by drawn, rotated bounding boxes, groups and filling the page. A group is
// a shared `group` id on its members; it moves, aligns and selects as one unit and has no geometry of its own.
export type AlignMode = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
/** One thing to arrange: a single node or a whole group, with the bounding box of its drawn, rotated blocks. */
export type Unit = { ids: string[]; box: Rect };
/** Collapses group members into one unit each, in first-seen order. */
export function unitsOf(items: { id: string; group?: string; box: Rect }[]): Unit[] {
  const out: (Unit & { key: string })[] = [];
  for (const it of items) {
    const key = it.group ?? `#${it.id}`, at = out.find(u => u.key === key);
    if (at) { at.ids.push(it.id); at.box = unionRect([at.box, it.box]); } else out.push({ key, ids: [it.id], box: { ...it.box } });
  }
  return out.map(({ ids, box }) => ({ ids, box }));
}
/** Offsets per node id. One unit aligns to `page`; several align to their shared bounds. */
export function align(units: Unit[], mode: AlignMode, page: Size): Record<string, Point> {
  const target = units.length === 1 ? { x: 0, y: 0, ...page } : unionRect(units.map(u => u.box)), out: Record<string, Point> = {};
  for (const u of units) {
    const b = u.box, dx = mode === 'left' ? target.x - b.x : mode === 'centre' ? target.x + target.w / 2 - (b.x + b.w / 2) : mode === 'right' ? target.x + target.w - (b.x + b.w) : 0;
    const dy = mode === 'top' ? target.y - b.y : mode === 'middle' ? target.y + target.h / 2 - (b.y + b.h / 2) : mode === 'bottom' ? target.y + target.h - (b.y + b.h) : 0;
    for (const id of u.ids) out[id] = { x: dx, y: dy };
  }
  return out;
}
/** Equal gaps between three or more units along an axis; the outermost two stay where they are. */
export function distribute(units: Unit[], axis: 'x' | 'y'): Record<string, Point> {
  const out: Record<string, Point> = {};
  if (units.length < 3) return out;
  const pos = (r: Rect) => axis === 'x' ? r.x : r.y, len = (r: Rect) => axis === 'x' ? r.w : r.h;
  const sorted = [...units].sort((a, b) => pos(a.box) - pos(b.box) || pos(a.box) + len(a.box) - pos(b.box) - len(b.box));
  const first = sorted[0].box, last = sorted[sorted.length - 1].box, total = sorted.reduce((s, u) => s + len(u.box), 0);
  const gap = (pos(last) + len(last) - pos(first) - total) / (sorted.length - 1);
  let at = pos(first);
  for (const u of sorted) { const d = at - pos(u.box); for (const id of u.ids) out[id] = axis === 'x' ? { x: d, y: 0 } : { x: 0, y: d }; at += len(u.box) + gap; }
  return out;
}
/** Moves unlocked nodes by per-id offsets in one size. */
export function offsetFrames(doc: KuraDoc, sizeId: string, offsets: Record<string, Point>): KuraDoc {
  return updateNodes(doc, Object.keys(offsets).filter(id => offsets[id].x || offsets[id].y), n => {
    const f = n.frames[sizeId], d = offsets[n.id];
    return { ...n, frames: { ...n.frames, [sizeId]: { ...f, rect: { ...f.rect, x: f.rect.x + d.x, y: f.rect.y + d.y } } } };
  });
}
/** Ids plus every member of their groups, in document order. */
export function withGroups(doc: KuraDoc, ids: string[]): string[] {
  const picked = new Set(ids), groups = new Set(doc.nodes.flatMap(n => picked.has(n.id) && n.group ? [n.group] : []));
  return doc.nodes.filter(n => picked.has(n.id) || n.group !== undefined && groups.has(n.group)).map(n => n.id);
}
/** Puts two or more nodes in one new group (members of other groups move over). Locked nodes join too: grouping is not an edit. */
export function groupNodes(doc: KuraDoc, ids: string[], group: string): KuraDoc {
  if (ids.length < 2) return doc;
  const picked = new Set(ids);
  return { ...doc, nodes: doc.nodes.map(n => picked.has(n.id) ? { ...n, group } : n) };
}
export function ungroupNodes(doc: KuraDoc, ids: string[]): KuraDoc {
  const groups = new Set(doc.nodes.flatMap(n => ids.includes(n.id) && n.group ? [n.group] : []));
  return { ...doc, nodes: doc.nodes.map(n => { if (n.group === undefined || !groups.has(n.group)) return n; const next = { ...n }; delete next.group; return next; }) };
}
/** Set as background: the node fills the canvas of this size, unrotated, and goes to the back. */
export function fillPage(doc: KuraDoc, sizeId: string, id: string, canvas: Size): KuraDoc {
  const node = doc.nodes.find(n => n.id === id);
  if (!node || node.locked) return doc;
  const f: Frame = { ...node.frames[sizeId], rect: { x: 0, y: 0, w: canvas.w, h: canvas.h }, rot: 0 }, next: DocNode = { ...node, frames: { ...node.frames, [sizeId]: f } };
  return { ...doc, nodes: [next, ...doc.nodes.filter(n => n.id !== id)] };
}
