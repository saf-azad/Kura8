import { describe, it, expect } from 'vitest';
import { snap, type SnapInput, type Handle } from '../src/core/snap';
import type { Anchor } from '../src/core/guides/types';
const line = (id: string, at: number, axis: 'x' | 'y' = 'x'): Anchor => ({ kind: 'line', id, at, axis });
const base: SnapInput = { rect: { x: 101, y: 137, w: 203, h: 107 }, handle: 'move', anchors: [line('x', 100)], canvas: { w: 1000, h: 1000 }, threshold: 8 };
describe('move snapping', () => {
  it('snaps either edge, the centre and canvas edges', () => {
    expect(snap(base).rect.x).toBe(100);
    expect(snap({ ...base, anchors: [line('x', 300)] }).rect.x).toBe(97);
    expect(snap({ ...base, anchors: [line('x', 200)] }).hits).toContainEqual({ axis: 'x', what: 'center', targetId: 'x' });
    expect(snap({ ...base, rect: { ...base.rect, x: 3 } }).rect.x).toBe(0);
    expect(snap({ ...base, rect: { ...base.rect, x: 799 } }).rect.x).toBe(797);
  });
  it('includes the <= threshold boundary and excludes larger distances', () => {
    expect(snap({ ...base, rect: { ...base.rect, x: 108 } }).rect.x).toBe(100);
    expect(snap({ ...base, rect: { ...base.rect, x: 108.001 } }).rect.x).toBe(108.001);
  });
  it('keeps axes independent and ignores points and other objects', () => {
    const r = snap({ ...base, anchors: [line('y', 140, 'y'), { kind: 'point', id: 'p', x: 100, y: 137 }] });
    expect(r.rect.x).toBe(101); expect(r.rect.y).toBe(140);
    expect(snap({ ...base, anchors: [] })).toEqual({ rect: base.rect, hits: [] });
  });
  it('returns all hits at the chosen delta and resolves opposite ties by lower coordinate', () => {
    const r = snap({ ...base, rect: { x: 101, y: 137, w: 200, h: 107 }, anchors: [line('a', 100), line('b', 300)] });
    expect(r.hits).toHaveLength(2);
    expect(snap({ ...base, anchors: [line('high', 102), line('low', 100)] }).rect.x).toBe(100);
  });
});
describe('resize snapping', () => {
  it.each<Handle>(['e', 'w', 'n', 's', 'ne', 'nw', 'se', 'sw'])('moves only the %s handle edges and preserves the opposite edges', handle => {
    const r = snap({ ...base, handle, anchors: [line('x1', 100), line('x2', 305), line('y1', 135, 'y'), line('y2', 245, 'y')] }).rect;
    if (handle.includes('w')) expect(r.x + r.w).toBe(304); else expect(r.x).toBe(101);
    if (handle.includes('n')) expect(r.y + r.h).toBe(244); else expect(r.y).toBe(137);
  });
  it('snaps to span sizes and deduplicates equal lengths in edges-then-anchors order', () => {
    const r = snap({ ...base, handle: 'e', anchors: [line('a', 200), line('b', 400), { kind: 'region', id: 'duplicate', rect: { x: 0, y: 0, w: 200, h: 500 } }] });
    expect(r.rect.w).toBe(200); expect(r.hits).toEqual([{ axis: 'x', what: 'size', targetId: 'span-edge-left-a' }]);
  });
  it('snaps width and height to region sizes', () => {
    const anchors: Anchor[] = [{ kind: 'region', id: 'region', rect: { x: 0, y: 0, w: 205, h: 110 } }];
    const r = snap({ ...base, handle: 'se', anchors }); expect(r.rect.w).toBe(205); expect(r.rect.h).toBe(110); expect(r.hits.every(h => h.what === 'size')).toBe(true);
  });
  it('position wins an equal-distance size tie', () => {
    const r = snap({ ...base, handle: 'e', anchors: [line('position', 306), { kind: 'region', id: 'size', rect: { x: 0, y: 0, w: 201, h: 100 } }] });
    expect(r.rect.w).toBe(205); expect(r.hits[0].targetId).toBe('position');
  });
  it('same-kind size ties use alphabetical target ids', () => {
    const r = snap({ ...base, handle: 'e', anchors: [{ kind: 'region', id: 'z', rect: { x: 0, y: 0, w: 201, h: 100 } }, { kind: 'region', id: 'a', rect: { x: 0, y: 0, w: 205, h: 100 } }] });
    expect(r.rect.w).toBe(205);
  });
  it('reports position and size hits sharing the chosen delta', () => {
    const r = snap({ ...base, handle: 'e', anchors: [line('position', 306), { kind: 'region', id: 'size', rect: { x: 0, y: 0, w: 205, h: 100 } }] });
    expect(r.hits.map(h => h.what)).toEqual(['edge', 'size']);
  });
  it('text e/w handles never snap height', () => {
    for (const handle of ['e', 'w'] as const) { const r = snap({ ...base, handle, anchors: [line('y', 245, 'y')] }); expect(r.rect.h).toBe(107); expect(r.hits.some(h => h.axis === 'y')).toBe(false); }
  });
  it('lockAspect snaps only the dominant axis and fixes the opposite corner', () => {
    for (const dominantAxis of ['x', 'y'] as const) for (const handle of ['nw', 'se'] as const) {
      const r = snap({ ...base, handle, lockAspect: true, dominantAxis, anchors: [line('x', 100), line('y', 135, 'y'), line('right', 305), line('bottom', 245, 'y')] });
      expect(r.rect.w / r.rect.h).toBeCloseTo(base.rect.w / base.rect.h);
      expect(r.hits.every(h => h.axis === dominantAxis)).toBe(true);
      if (handle === 'nw') { expect(r.rect.x + r.rect.w).toBeCloseTo(304); expect(r.rect.y + r.rect.h).toBeCloseTo(244); }
      else { expect(r.rect.x).toBe(101); expect(r.rect.y).toBe(137); }
    }
    expect(() => snap({ ...base, lockAspect: true })).toThrow('dominantAxis');
  });
  it('never clamps, mutates input or uses time/randomness', () => {
    const input = { ...base, handle: 'e' as const, anchors: [], threshold: 0 }; const copy = structuredClone(input);
    expect(snap(input)).toEqual(snap(input)); expect(input).toEqual(copy);
    expect(snap({ ...input, rect: { x: -500, y: -500, w: 10, h: 10 } }).rect).toEqual({ x: -500, y: -500, w: 10, h: 10 });
  });
});
