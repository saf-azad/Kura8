import type { Rect, Size } from './geometry';
import type { Anchor } from './guides/types';
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type SnapInput = { rect: Rect; handle: Handle; anchors: Anchor[]; canvas: Size; threshold: number; lockAspect?: boolean; dominantAxis?: 'x' | 'y' };
export type SnapHit = { axis: 'x' | 'y'; what: 'edge' | 'center' | 'size'; targetId: string };
export type SnapResult = { rect: Rect; hits: SnapHit[] };
type Target = { id: string; at: number };
type Candidate = { delta: number; coordinate: number; hit: SnapHit };
const EPS = 1e-9;
function targets(input: SnapInput, axis: 'x' | 'y'): Target[] {
  return [{ id: axis === 'x' ? 'edge-left' : 'edge-top', at: 0 }, { id: axis === 'x' ? 'edge-right' : 'edge-bottom', at: axis === 'x' ? input.canvas.w : input.canvas.h },
    ...input.anchors.filter((a): a is Extract<Anchor, { kind: 'line' }> => a.kind === 'line' && a.axis === axis).map(a => ({ id: a.id, at: a.at }))];
}
function sizes(input: SnapInput, lines: Target[], dimension: 'w' | 'h'): Target[] {
  const result: Target[] = [];
  const add = (t: Target) => { if (t.at > 0 && !result.some(r => Math.abs(r.at - t.at) < EPS)) result.push(t); };
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++)
    add({ id: `span-${lines[i].id}-${lines[j].id}`, at: Math.abs(lines[j].at - lines[i].at) });
  input.anchors.forEach(a => { if (a.kind === 'region') add({ id: a.id, at: a.rect[dimension] }); });
  return result;
}
function choose(candidates: Candidate[], threshold: number): Candidate[] {
  const valid = candidates.filter(c => Math.abs(c.delta) <= threshold);
  valid.sort((a, b) => {
    const distance = Math.abs(a.delta) - Math.abs(b.delta);
    if (Math.abs(distance) > EPS) return distance;
    if ((a.hit.what === 'size') !== (b.hit.what === 'size')) return a.hit.what === 'size' ? 1 : -1;
    return a.hit.what === 'size' ? a.hit.targetId.localeCompare(b.hit.targetId) : a.coordinate - b.coordinate;
  });
  return valid.length ? valid.filter(c => Math.abs(c.delta - valid[0].delta) < EPS) : [];
}
export function snap(input: SnapInput): SnapResult {
  const { handle, rect, threshold, lockAspect, dominantAxis } = input;
  const result: SnapResult = { rect: { ...rect }, hits: [] };
  if (lockAspect && !dominantAxis) throw new Error('lockAspect requires dominantAxis');
  for (const axis of ['x', 'y'] as const) {
    const dimension = axis === 'x' ? 'w' : 'h';
    const low = axis === 'x' ? 'w' : 'n', high = axis === 'x' ? 'e' : 's';
    if (handle !== 'move' && (!handle.includes(low) && !handle.includes(high) || lockAspect && axis !== dominantAxis)) continue;
    const lines = targets(input, axis), candidates: Candidate[] = [];
    const start = rect[axis], length = rect[dimension], negative = handle.includes(low);
    const subjects = handle === 'move' ? [{ at: start, what: 'edge' as const }, { at: start + length / 2, what: 'center' as const }, { at: start + length, what: 'edge' as const }] : [{ at: negative ? start : start + length, what: 'edge' as const }];
    for (const subject of subjects) for (const target of lines) candidates.push({ delta: target.at - subject.at, coordinate: target.at, hit: { axis, what: subject.what, targetId: target.id } });
    if (handle !== 'move') for (const target of sizes(input, lines, dimension)) candidates.push({ delta: (target.at - length) * (negative ? -1 : 1), coordinate: target.at, hit: { axis, what: 'size', targetId: target.id } });
    const hits = choose(candidates, threshold);
    if (!hits.length) continue;
    const delta = hits[0].delta;
    if (handle === 'move') result.rect[axis] += delta;
    else { result.rect[dimension] += negative ? -delta : delta; if (negative) result.rect[axis] += delta; }
    result.hits.push(...hits.map(c => c.hit).filter((hit, i, all) => all.findIndex(h => h.targetId === hit.targetId && h.what === hit.what) === i));
  }
  if (lockAspect && handle !== 'move') {
    if (dominantAxis === 'x') { result.rect.h = result.rect.w * rect.h / rect.w; if (handle.includes('n')) result.rect.y = rect.y + rect.h - result.rect.h; }
    else { result.rect.w = result.rect.h * rect.w / rect.h; if (handle.includes('w')) result.rect.x = rect.x + rect.w - result.rect.w; }
  }
  return result;
}
