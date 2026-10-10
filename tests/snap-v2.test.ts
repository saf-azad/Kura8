import { describe, it, expect } from 'vitest';
import { snap, snapLines, snapAngle, angleTargets, turnHandle, type SnapInput, type SnapLine } from '../src/core/snap';
import type { Anchor } from '../src/core/guides/types';
import { guideById } from '../src/core/guides';
// One named test per snapping rule in AGENTS.md → Snapping. The Phase 0 tests in snap.test.ts stay unchanged.
const line = (id: string, at: number, axis: 'x' | 'y' = 'x'): Anchor => ({ kind: 'line', id, at, axis });
const extra = (id: string, at: number, tier: SnapLine['tier'], axis: 'x' | 'y' = 'x'): SnapLine => ({ id, at, axis, tier });
const canvas = { w: 1000, h: 1000 };
const base: SnapInput = { rect: { x: 101, y: 137, w: 203, h: 107 }, handle: 'move', anchors: [], canvas, threshold: 8, extra: [] };
describe('snapping v2 rules', () => {
  it('rule: same input gives the same output; the previous lock is an explicit input', () => {
    const input = { ...base, anchors: [line('g', 100)], hold: 13, held: { x: 'g' } };
    expect(snap(input)).toEqual(snap(input));
  });
  it('rule: core never clamps', () => {
    expect(snap({ ...base, rect: { x: -900, y: -900, w: 1, h: 1 }, reach: 20, hold: 13 }).rect).toEqual({ x: -900, y: -900, w: 1, h: 1 });
  });
  it('rule: axes are independent', () => {
    const r = snap({ ...base, extra: [extra('obj-a-l', 103, 2), extra('obj-a-t', 300, 2, 'y')] });
    expect(r.rect).toEqual({ ...base.rect, x: 103 }); expect(r.hits.map(h => h.axis)).toEqual(['x']);
  });
  it('rule: the held target is kept while within hold', () => {
    const input = { ...base, rect: { ...base.rect, x: 111 }, anchors: [line('g', 100)], extra: [extra('obj-a-l', 112, 2)], hold: 13, held: { x: 'g' } };
    const r = snap(input);
    expect(r.rect.x).toBe(100); expect(r.held).toEqual({ x: 'g' }); expect(r.hits[0]).toEqual({ axis: 'x', what: 'edge', targetId: 'g', tier: 0 });
    expect(snap({ ...input, rect: { ...input.rect, x: 114 } }).rect.x).toBe(112);
    expect(snap({ ...input, held: {} }).rect.x).toBe(112);
  });
  it('rule: lowest tier wins within threshold (guide, then canvas, then objects, then grid)', () => {
    const r = snap({ ...base, rect: { ...base.rect, x: 3 }, anchors: [line('g', 9)], extra: [extra('obj-a-l', 3.5, 2), extra('grid-x-1', 3, 3)] });
    expect(r.rect.x).toBe(9); expect(r.hits).toEqual([{ axis: 'x', what: 'edge', targetId: 'g', tier: 0 }]);
    const canvasWins = snap({ ...base, rect: { ...base.rect, x: 4 }, extra: [extra('obj-a-l', 4, 2), extra('grid-x-1', 4, 3)] });
    expect(canvasWins.rect.x).toBe(0); expect(canvasWins.hits[0].tier).toBe(1);
    expect(snap({ ...base, rect: { ...base.rect, x: 500 }, extra: [extra('obj-a-l', 499, 2), extra('grid-x-1', 500, 3)] }).hits[0].targetId).toBe('obj-a-l');
  });
  it('rule: within a tier the smallest |delta| wins, then position before size, then lower coordinate', () => {
    expect(snap({ ...base, extra: [extra('obj-a-l', 103, 2), extra('obj-b-l', 98, 2)] }).hits[0].targetId).toBe('obj-a-l');
    expect(snap({ ...base, extra: [extra('obj-a-l', 104, 2), extra('obj-b-l', 98, 2)] }).hits[0].targetId).toBe('obj-b-l');
    expect(snap({ ...base, rect: { ...base.rect, w: 200 }, extra: [extra('obj-a-l', 100, 2), extra('obj-b-r', 300, 2)] }).rect.x).toBe(100);
    const r = snap({ ...base, handle: 'e', anchors: [line('position', 306), { kind: 'region', id: 'size', rect: { x: 0, y: 0, w: 205, h: 1 } }] });
    expect(r.hits.map(h => h.what)).toEqual(['edge', 'size']); expect(r.hits[0].targetId).toBe('position');
  });
  it('rule: outside the threshold a soft pull of delta·f³ leans towards the nearest candidate within reach, with no hit', () => {
    const r = snap({ ...base, extra: [extra('obj-a-l', 115, 2)], threshold: 6, reach: 20, hold: 13 });
    const f = 1 - (14 - 6) / (20 - 6);
    expect(r.rect.x).toBeCloseTo(101 + 14 * f ** 3); expect(r.hits).toEqual([]); expect(r.pull?.x).toBeCloseTo(f);
    expect(r.near?.x).toEqual(extra('obj-a-l', 115, 2)); expect(r.held).toEqual({});
    expect(snap({ ...base, extra: [extra('obj-a-l', 125, 2)], threshold: 6, reach: 20 }).rect.x).toBe(101);
    expect(snap({ ...base, handle: 'e', anchors: [{ kind: 'region', id: 'r', rect: { x: 0, y: 0, w: 215, h: 1 } }], threshold: 6, reach: 20 }).near?.x?.id).toBe('r');
  });
  it('rule: unset reach equals threshold, so there is no pull', () => {
    const r = snap({ ...base, extra: [extra('obj-a-l', 115, 2)], threshold: 6 });
    expect(r.rect).toEqual(base.rect); expect(r.pull).toBeUndefined();
  });
  it('rule: with no extra lines the result equals Phase 0 behaviour (no tier on hits, no held)', () => {
    const { extra: _, ...v1 } = base;
    expect(snap({ ...v1, anchors: [line('x', 100)] })).toEqual({ rect: { ...base.rect, x: 100 }, hits: [{ axis: 'x', what: 'edge', targetId: 'x' }] });
  });
  it('rule: position targets include canvas centre, other objects by rotated box and grid via snapLines', () => {
    const lines = snapLines({ canvas: { w: 1000, h: 500 }, others: [{ id: 'a', rect: { x: 0, y: 0, w: 100, h: 50 }, rot: 90 }], grid: 300, centre: true });
    expect(lines.filter(l => l.tier === 1)).toEqual([extra('centre-x', 500, 1), extra('centre-y', 250, 1, 'y')]);
    const obj = lines.filter(l => l.tier === 2);
    expect(obj.map(l => l.id)).toEqual(['obj-a-l', 'obj-a-c', 'obj-a-r', 'obj-a-t', 'obj-a-m', 'obj-a-b']);
    expect(obj[0].at).toBeCloseTo(25); expect(obj[3].at).toBeCloseTo(-25);
    expect(lines.filter(l => l.tier === 3).map(l => `${l.id}@${l.at}`)).toEqual(['grid-x-1@300', 'grid-x-2@600', 'grid-x-3@900', 'grid-y-1@300']);
    expect(snapLines({ canvas, others: [], centre: false })).toEqual([]);
    expect(snapLines({ canvas, others: [], grid: 0, centre: false })).toEqual([]);
  });
  it('rule: points are drawn, never snapped to', () => {
    expect(snap({ ...base, anchors: [{ kind: 'point', id: 'p', x: 102, y: 138 }] }).hits).toEqual([]);
  });
  it('rule: size candidates come only from tier-0 lines and canvas edges, deduplicated in [edges, anchors] order', () => {
    const r = snap({ ...base, handle: 'e', extra: [extra('obj-a-l', 500, 2), extra('obj-b-l', 703, 2)] });
    expect(r.rect.w).toBe(203); expect(r.hits).toEqual([]);
    const s = snap({ ...base, handle: 'e', anchors: [line('a', 200), line('b', 400)] });
    expect(s.hits).toEqual([{ axis: 'x', what: 'size', targetId: 'span-edge-left-a', tier: 0 }]);
  });
  it('rule: a size snap moves only the handle edge', () => {
    const r = snap({ ...base, handle: 'w', anchors: [line('a', 200), line('b', 400)] });
    expect(r.rect.x + r.rect.w).toBe(304); expect(r.rect.w).toBe(200);
  });
  it('rule: hits name the winner only; a span hit still names both lines and two exactly spanning edges both flash', () => {
    const r = snap({ ...base, rect: { ...base.rect, w: 200 }, anchors: [line('a', 100)], extra: [extra('obj-z-r', 300, 2)] });
    expect(r.hits.map(h => h.targetId)).toEqual(['a']);
    const both = snap({ ...base, rect: { ...base.rect, w: 200 }, anchors: [line('a', 100), line('b', 300)] });
    expect(both.hits.map(h => h.targetId)).toEqual(['a', 'b']);
    expect(snap({ ...base, handle: 'e', anchors: [line('a', 200)] }).hits[0].targetId).toBe('span-edge-left-a');
  });
  it('rule: locked aspect snaps only the dominant axis and derives the other with the opposite corner fixed', () => {
    const r = snap({ ...base, handle: 'nw', lockAspect: true, dominantAxis: 'y', anchors: [line('x', 100), line('y', 135, 'y')] });
    expect(r.hits.every(h => h.axis === 'y')).toBe(true); expect(r.rect.w / r.rect.h).toBeCloseTo(203 / 107);
    expect(r.rect.x + r.rect.w).toBeCloseTo(304); expect(r.rect.y + r.rect.h).toBeCloseTo(244);
  });
  it('rule: a rotated move snaps the four rotated corners and the centre (5m)', () => {
    const rect = { x: 400, y: 400, w: 200, h: 100 }, r = snap({ ...base, rect, rotation: 30, anchors: [line('g', 390)] });
    const sw = 500 - 100 * Math.cos(Math.PI / 6) - 50 * Math.sin(Math.PI / 6);
    expect(r.hits[0].what).toBe('corner'); expect(r.rect.x).toBeCloseTo(400 + 390 - sw);
    expect(snap({ ...base, rect, rotation: 30, anchors: [line('c', 503)] }).hits[0].what).toBe('center');
  });
  it('rule: a quarter-turned move snaps its visible box edges', () => {
    const r = snap({ ...base, rect: { x: 400, y: 400, w: 200, h: 100 }, rotation: 90, anchors: [line('g', 452)] });
    expect(r.rect.x).toBeCloseTo(402); expect(r.hits[0].what).toBe('edge');
  });
  it('rule: at multiples of 90° resize uses the axis-aligned path with remapped handles', () => {
    expect([turnHandle('e', 1), turnHandle('ne', 1), turnHandle('nw', 2), turnHandle('s', 3), turnHandle('move', 1), turnHandle('w', -1)]).toEqual(['s', 'se', 'se', 'e', 'move', 's']);
    // A 200 × 100 box turned 90° shows as 100 wide × 200 tall; its local east handle is the visible south edge.
    const rect = { x: 400, y: 400, w: 200, h: 100 }, r = snap({ ...base, rect, rotation: 90, handle: 'e', anchors: [line('y', 552, 'y')] });
    expect(r.rect.w).toBeCloseTo(202); expect(r.hits[0]).toEqual({ axis: 'y', what: 'edge', targetId: 'y', tier: 0 });
    expect(r.rect.x + r.rect.w / 2).toBeCloseTo(500); expect(r.rect.y + r.rect.h / 2).toBeCloseTo(451);
    const locked = snap({ ...base, rect, rotation: 270, handle: 'se', lockAspect: true, dominantAxis: 'x', anchors: [line('y', 345, 'y'), line('x', 556)] });
    expect(locked.rect.w / locked.rect.h).toBeCloseTo(2); expect(locked.hits.every(h => h.axis === 'y')).toBe(true);
    expect(snap({ ...base, rect, rotation: 180, handle: 'e', anchors: [line('x', 397)] }).rect).toEqual({ x: 397, y: 400, w: 203, h: 100 });
  });
  it('rule: at other angles resize gets size candidates only, in the local frame, opposite edge fixed', () => {
    const rect = { x: 400, y: 400, w: 203, h: 100 }, input = { ...base, rect, rotation: 30, handle: 'e' as const, anchors: [line('a', 200), line('b', 600)] };
    const r = snap(input);
    expect(r.rect.w).toBeCloseTo(200); expect(r.hits).toEqual([{ axis: 'x', what: 'size', targetId: 'span-edge-left-a', tier: 0 }]);
    const west = (q: typeof rect) => ({ x: q.x + q.w / 2 - q.w / 2 * Math.cos(Math.PI / 6), y: q.y + q.h / 2 - q.w / 2 * Math.sin(Math.PI / 6) });
    expect(west(r.rect).x).toBeCloseTo(west(rect).x); expect(west(r.rect).y).toBeCloseTo(west(rect).y);
    expect(snap({ ...input, anchors: [line('pos', 610)] }).hits).toEqual([]);
    const steep = snap({ ...input, rotation: 80, handle: 'n', anchors: [line('a', 103, 'x'), line('ya', 105, 'y')], hold: 13 });
    expect(steep.rect.h).toBeCloseTo(103); expect(steep.held).toEqual({ x: 'span-edge-left-a' });
    const aspect = snap({ ...input, handle: 'se', lockAspect: true, dominantAxis: 'x' }); expect(aspect.rect.w / aspect.rect.h).toBeCloseTo(2.03);
    const tall = snap({ ...input, handle: 'sw', lockAspect: true, dominantAxis: 'y', anchors: [{ kind: 'region', id: 'r', rect: { x: 0, y: 0, w: 1, h: 98 } }] });
    expect(tall.rect.h).toBeCloseTo(98); expect(tall.rect.w).toBeCloseTo(203 * .98);
    expect(snap({ ...input, extra: undefined }).hits[0]).toEqual({ axis: 'x', what: 'size', targetId: 'span-edge-left-a' });
    expect(snap({ ...input, anchors: [] }).rect).toEqual(rect);
  });
  it('rule: lockAspect requires dominantAxis', () => {
    expect(() => snap({ ...base, lockAspect: true })).toThrow('dominantAxis');
  });
});
describe('angle snapping (3a)', () => {
  const o = { canvas, regions: [], shift: false, lock: 3, reach: 11, hold: 7, held: null };
  it('rule: targets are multiples of 45°, ± the canvas diagonal and ± every guide-cell diagonal', () => {
    const t = angleTargets({ w: 1000, h: 500 }, []), d = Math.atan2(500, 1000) * 180 / Math.PI;
    for (const a of [0, 45, 90, 135, 180, -45, -90, -135, d, -d, 180 - d, d - 180]) expect(t.some(v => Math.abs(v - a) < 1e-9)).toBe(true);
    expect(t).toHaveLength(12);
    const cells = guideById('golden').generate(canvas).flatMap(a => a.kind === 'region' ? [a.rect] : []);
    expect(angleTargets(canvas, cells).length).toBeGreaterThan(12);
  });
  it('rule: lock within 3°, pull within 11°, nothing beyond', () => {
    expect(snapAngle({ ...o, angle: 47 })).toEqual({ angle: 45, caught: 45 });
    const f = 1 - (7 - 3) / 8, pulled = snapAngle({ ...o, angle: 97 });
    expect(pulled.caught).toBeNull(); expect(pulled.angle).toBeCloseTo(97 - 7 * f ** 3);
    expect(snapAngle({ ...o, angle: 22.5 })).toEqual({ angle: 22.5, caught: null });
    expect(snapAngle({ ...o, angle: 362 }).angle).toBe(0);
  });
  it('rule: the caught angle holds within 7°', () => {
    expect(snapAngle({ ...o, angle: 51, held: 45 })).toEqual({ angle: 45, caught: 45 });
    expect(snapAngle({ ...o, angle: 53, held: 45 }).caught).toBeNull();
  });
  it('rule: Shift rounds to 15° with no target', () => {
    expect(snapAngle({ ...o, angle: 52, shift: true })).toEqual({ angle: 45, caught: null });
    expect(snapAngle({ ...o, angle: 173, shift: true }).angle).toBe(180);
  });
});
