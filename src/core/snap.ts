import { center, corners, quarterTurn, rotatedBounds, norm, modn, type Rect, type Size } from './geometry';
import type { Anchor } from './guides/types';
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
/** Snap target priority: guide lines, canvas edges and centre, other objects, grid. */
export type Tier = 0 | 1 | 2 | 3;
export type SnapLine = { id: string; axis: 'x' | 'y'; at: number; tier: Tier };
export type SnapInput = {
  rect: Rect; handle: Handle; anchors: Anchor[]; canvas: Size; threshold: number;
  lockAspect?: boolean; dominantAxis?: 'x' | 'y';
  rotation?: number; extra?: SnapLine[]; reach?: number; hold?: number; held?: { x?: string; y?: string };
};
export type SnapHit = { axis: 'x' | 'y'; what: 'edge' | 'center' | 'corner' | 'size'; targetId: string; tier?: Tier };
/** `near` names the line a soft pull leans towards, so the overlay can draw it faintly (`pull` is the 0..1 strength). */
export type SnapResult = { rect: Rect; hits: SnapHit[]; held?: { x?: string; y?: string }; pull?: { x?: number; y?: number }; near?: { x?: SnapLine; y?: SnapLine } };
type Axis = 'x' | 'y';
type Candidate = { delta: number; coordinate: number; tier: Tier; hit: SnapHit };
type Subject = { at: number; what: SnapHit['what'] };
type Choice = { hits: Candidate[]; locked: boolean; pull?: number };
const EPS = 1e-9;
const dimOf = (axis: Axis) => axis === 'x' ? 'w' as const : 'h' as const;

/** Guide lines and canvas edges; with `extra` lines the edges rank as tier 1, without them (Phase 0 callers) they share tier 0 with the guide. */
function targets(input: SnapInput, axis: Axis): SnapLine[] {
  const edge: Tier = input.extra ? 1 : 0;
  return [{ id: axis === 'x' ? 'edge-left' : 'edge-top', axis, at: 0, tier: edge }, { id: axis === 'x' ? 'edge-right' : 'edge-bottom', axis, at: axis === 'x' ? input.canvas.w : input.canvas.h, tier: edge },
    ...input.anchors.filter((a): a is Extract<Anchor, { kind: 'line' }> => a.kind === 'line' && a.axis === axis).map(a => ({ id: a.id, axis, at: a.at, tier: 0 as Tier })),
    ...(input.extra ?? []).filter(l => l.axis === axis)];
}
/** Spans between guide lines and canvas edges, then region dimensions, deduplicated keeping the first. */
function sizes(input: SnapInput, axis: Axis): SnapLine[] {
  const lines = targets({ ...input, extra: undefined }, axis), result: SnapLine[] = [];
  const add = (t: SnapLine) => { if (t.at > 0 && !result.some(r => Math.abs(r.at - t.at) < EPS)) result.push(t); };
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++)
    add({ id: `span-${lines[i].id}-${lines[j].id}`, axis, at: Math.abs(lines[j].at - lines[i].at), tier: 0 });
  input.anchors.forEach(a => { if (a.kind === 'region') add({ id: a.id, axis, at: a.rect[dimOf(axis)], tier: 0 }); });
  return result;
}
const order = (a: Candidate, b: Candidate) => {
  if (a.tier !== b.tier) return a.tier - b.tier;
  const distance = Math.abs(a.delta) - Math.abs(b.delta);
  if (Math.abs(distance) > EPS) return distance;
  if ((a.hit.what === 'size') !== (b.hit.what === 'size')) return a.hit.what === 'size' ? 1 : -1;
  return a.hit.what === 'size' ? a.hit.targetId.localeCompare(b.hit.targetId) : a.coordinate - b.coordinate;
};
const ties = (sorted: Candidate[]) => sorted.filter(c => c.tier === sorted[0].tier && Math.abs(c.delta - sorted[0].delta) < EPS);
/** Per axis: keep the held target inside `hold`; else lowest tier, nearest, position before size, lower coordinate; else a soft pull inside `reach`. */
function choose(candidates: Candidate[], input: SnapInput, axis: Axis): Choice | undefined {
  const held = input.held?.[axis];
  if (held !== undefined && input.hold !== undefined) {
    const kept = candidates.filter(c => c.hit.targetId === held && Math.abs(c.delta) <= input.hold!).sort(order);
    if (kept.length) return { hits: ties(kept), locked: true };
  }
  const valid = candidates.filter(c => Math.abs(c.delta) <= input.threshold).sort(order);
  if (valid.length) return { hits: ties(valid), locked: true };
  const reach = input.reach ?? input.threshold;
  if (reach <= input.threshold) return undefined;
  const near = candidates.filter(c => Math.abs(c.delta) <= reach).sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.tier - b.tier || a.coordinate - b.coordinate);
  if (!near.length) return undefined;
  const f = 1 - (Math.abs(near[0].delta) - input.threshold) / (reach - input.threshold);
  return { hits: [near[0]], locked: false, pull: f };
}
function moveSubjects(rect: Rect, rotation: number, axis: Axis): Subject[] {
  if (rotation && !quarterTurn(rotation)) return [...corners(rect, rotation).map(p => ({ at: p[axis], what: 'corner' as const })), { at: center(rect)[axis], what: 'center' }];
  const b = rotation ? rotatedBounds(rect, rotation) : rect, start = b[axis], length = b[dimOf(axis)];
  return [{ at: start, what: 'edge' }, { at: start + length / 2, what: 'center' }, { at: start + length, what: 'edge' }];
}
const lineOf = (c: Candidate, axis: Axis, all: SnapLine[]): SnapLine => all.find(l => l.id === c.hit.targetId) ?? { id: c.hit.targetId, axis, at: c.coordinate, tier: c.tier };
/** Axis-aligned snapping of a move or a resize (the Phase 0 algorithm with tiers, hold and pull). */
function snapAligned(input: SnapInput, rotation: number): SnapResult {
  const { handle, rect, lockAspect, dominantAxis } = input;
  const result: SnapResult = { rect: { ...rect }, hits: [] };
  const held: { x?: string; y?: string } = {}, pull: { x?: number; y?: number } = {}, near: { x?: SnapLine; y?: SnapLine } = {};
  for (const axis of ['x', 'y'] as const) {
    const dimension = dimOf(axis), low = axis === 'x' ? 'w' : 'n', high = axis === 'x' ? 'e' : 's';
    if (handle !== 'move' && (!handle.includes(low) && !handle.includes(high) || lockAspect && axis !== dominantAxis)) continue;
    const lines = targets(input, axis), candidates: Candidate[] = [];
    const start = rect[axis], length = rect[dimension], negative = handle.includes(low);
    const subjects = handle === 'move' ? moveSubjects(rect, rotation, axis) : [{ at: negative ? start : start + length, what: 'edge' as const }];
    for (const subject of subjects) for (const target of lines) candidates.push({ delta: target.at - subject.at, coordinate: target.at, tier: target.tier, hit: { axis, what: subject.what, targetId: target.id } });
    if (handle !== 'move') for (const target of sizes(input, axis)) candidates.push({ delta: (target.at - length) * (negative ? -1 : 1), coordinate: target.at, tier: target.tier, hit: { axis, what: 'size', targetId: target.id } });
    const choice = choose(candidates, input, axis);
    if (!choice) continue;
    const delta = choice.hits[0].delta * (choice.locked ? 1 : choice.pull! ** 3);
    if (handle === 'move') result.rect[axis] += delta;
    else { result.rect[dimension] += negative ? -delta : delta; if (negative) result.rect[axis] += delta; }
    if (!choice.locked) { pull[axis] = choice.pull; near[axis] = lineOf(choice.hits[0], axis, [...lines, ...sizes(input, axis)]); continue; }
    held[axis] = choice.hits[0].hit.targetId;
    result.hits.push(...choice.hits.map(c => input.extra ? { ...c.hit, tier: c.tier } : c.hit).filter((hit, i, all) => all.findIndex(h => h.targetId === hit.targetId && h.what === hit.what) === i));
  }
  if (lockAspect && handle !== 'move') {
    if (dominantAxis === 'x') { result.rect.h = result.rect.w * rect.h / rect.w; if (handle.includes('n')) result.rect.y = rect.y + rect.h - result.rect.h; }
    else { result.rect.w = result.rect.h * rect.w / rect.h; if (handle.includes('w')) result.rect.x = rect.x + rect.w - result.rect.w; }
  }
  if (input.hold !== undefined) result.held = held;
  if (pull.x !== undefined || pull.y !== undefined) { result.pull = pull; result.near = near; }
  return result;
}
const TURN: Record<string, string> = { n: 'e', e: 's', s: 'w', w: 'n' };
/** The on-screen handle of a local handle after `quarters` clockwise quarter turns. */
export function turnHandle(handle: Handle, quarters: number): Handle {
  if (handle === 'move') return handle;
  let letters = handle.split('');
  for (let i = 0; i < modn(quarters, 4); i++) letters = letters.map(l => TURN[l]);
  return letters.sort((a, b) => 'ns'.includes(a) ? -1 : 'ns'.includes(b) ? 1 : 0).join('') as Handle;
}
/** Resize of a node rotated by a non-quarter angle: only size candidates, in the node's own frame, opposite edge fixed in place. */
function snapRotatedResize(input: SnapInput, rotation: number): SnapResult {
  const { rect, handle, lockAspect, dominantAxis } = input;
  const result: SnapResult = { rect: { ...rect }, hits: [] }, held: { x?: string; y?: string } = {};
  const upright = Math.abs(modn(rotation, 180) - 90) > 45, size = { w: rect.w, h: rect.h };
  for (const axis of ['x', 'y'] as const) {
    const dimension = dimOf(axis), low = axis === 'x' ? 'w' : 'n', high = axis === 'x' ? 'e' : 's';
    if (!handle.includes(low) && !handle.includes(high) || lockAspect && axis !== dominantAxis) continue;
    const visual: Axis = upright ? axis : axis === 'x' ? 'y' : 'x';
    const candidates = sizes(input, visual).map((t): Candidate => ({ delta: t.at - rect[dimension], coordinate: t.at, tier: t.tier, hit: { axis: visual, what: 'size', targetId: t.id } }));
    const choice = choose(candidates, { ...input, reach: undefined }, visual);
    if (!choice) continue;
    size[dimension] += choice.hits[0].delta; held[visual] = choice.hits[0].hit.targetId;
    result.hits.push(...choice.hits.map(c => input.extra ? { ...c.hit, tier: c.tier } : c.hit));
  }
  if (lockAspect) { if (dominantAxis === 'x') size.h = size.w * rect.h / rect.w; else size.w = size.h * rect.w / rect.h; }
  // Keep the corner or edge opposite the handle where it was: shift the centre by half the growth along the local axes.
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0, sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const lx = sx * (size.w - rect.w) / 2, ly = sy * (size.h - rect.h) / 2, a = rotation * Math.PI / 180, c = center(rect);
  const cx = c.x + lx * Math.cos(a) - ly * Math.sin(a), cy = c.y + lx * Math.sin(a) + ly * Math.cos(a);
  result.rect = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
  if (input.hold !== undefined) result.held = held;
  return result;
}
/** Snaps a candidate rect. Pure: same input, same output; the previous lock is the explicit `held` input; never clamps. */
export function snap(input: SnapInput): SnapResult {
  if (input.lockAspect && !input.dominantAxis) throw new Error('lockAspect requires dominantAxis');
  const rotation = input.rotation ?? 0;
  if (!rotation || input.handle === 'move') return snapAligned(input, rotation);
  if (!quarterTurn(rotation)) return snapRotatedResize(input, rotation);
  // Quarter turns resize on screen axes: snap the visible box with the visible handle, then map back to the frame.
  const quarters = Math.round(rotation / 90), odd = modn(quarters, 2) === 1, box = rotatedBounds(input.rect, rotation);
  const dominantAxis = input.dominantAxis && (odd ? (input.dominantAxis === 'x' ? 'y' : 'x') : input.dominantAxis);
  const out = snapAligned({ ...input, rect: box, handle: turnHandle(input.handle, quarters), dominantAxis }, 0);
  const c = center(out.rect), w = odd ? out.rect.h : out.rect.w, h = odd ? out.rect.w : out.rect.h;
  return { ...out, rect: { x: c.x - w / 2, y: c.y - h / 2, w, h } };
}
/** Extra snap lines: canvas centre (tier 1), other objects' rotated bounding boxes (tier 2), grid (tier 3). */
export function snapLines(o: { canvas: Size; others: { id: string; rect: Rect; rot: number }[]; grid?: number; centre: boolean }): SnapLine[] {
  const out: SnapLine[] = [];
  if (o.centre) out.push({ id: 'centre-x', axis: 'x', at: o.canvas.w / 2, tier: 1 }, { id: 'centre-y', axis: 'y', at: o.canvas.h / 2, tier: 1 });
  for (const other of o.others) {
    const b = rotatedBounds(other.rect, other.rot);
    out.push({ id: `obj-${other.id}-l`, axis: 'x', at: b.x, tier: 2 }, { id: `obj-${other.id}-c`, axis: 'x', at: b.x + b.w / 2, tier: 2 }, { id: `obj-${other.id}-r`, axis: 'x', at: b.x + b.w, tier: 2 },
      { id: `obj-${other.id}-t`, axis: 'y', at: b.y, tier: 2 }, { id: `obj-${other.id}-m`, axis: 'y', at: b.y + b.h / 2, tier: 2 }, { id: `obj-${other.id}-b`, axis: 'y', at: b.y + b.h, tier: 2 });
  }
  if (o.grid && o.grid > 0) for (const axis of ['x', 'y'] as const) {
    const length = axis === 'x' ? o.canvas.w : o.canvas.h;
    for (let n = 1; n * o.grid < length - EPS; n++) out.push({ id: `grid-${axis}-${n}`, axis, at: n * o.grid, tier: 3 });
  }
  return out;
}
/** Angle targets: multiples of 45°, ± the canvas diagonal and ± every region diagonal (3a), each also mirrored through 180°. */
export function angleTargets(canvas: Size, regions: Rect[]): number[] {
  const out: number[] = [];
  const add = (a: number) => { const v = norm(a); if (!out.some(t => Math.abs(norm(t - v)) < 1e-6)) out.push(v); };
  for (let a = -135; a <= 180; a += 45) add(a);
  for (const r of [{ w: canvas.w, h: canvas.h }, ...regions]) { const d = Math.atan2(r.h, r.w) * 180 / Math.PI; add(d); add(-d); add(180 - d); add(d - 180); }
  return out;
}
/** Rotation snapping: Shift rounds to 15° with no target; otherwise hold the caught angle within `hold`, lock within `lock`, pull within `reach`. */
export function snapAngle(o: { angle: number; canvas: Size; regions: Rect[]; shift: boolean; lock: number; reach: number; hold: number; held: number | null }): { angle: number; caught: number | null } {
  const angle = norm(o.angle);
  if (o.shift) return { angle: norm(Math.round(angle / 15) * 15), caught: null };
  if (o.held !== null && Math.abs(norm(o.held - angle)) < o.hold) return { angle: o.held, caught: o.held };
  let best: { target: number; delta: number } | null = null;
  for (const target of angleTargets(o.canvas, o.regions)) {
    const delta = norm(target - angle);
    if (Math.abs(delta) <= o.reach && (!best || Math.abs(delta) < Math.abs(best.delta) - 1e-9)) best = { target, delta };
  }
  if (!best) return { angle, caught: null };
  if (Math.abs(best.delta) <= o.lock) return { angle: best.target, caught: best.target };
  const f = 1 - (Math.abs(best.delta) - o.lock) / (o.reach - o.lock);
  return { angle: norm(angle + best.delta * f ** 3), caught: null };
}
