import { it, expect } from 'vitest';
import { align, distribute, unionOf } from '../src/core/arrange';
const canvas = { x: 0, y: 0, w: 1000, h: 500 };
const a = { id: 'a', rect: { x: 100, y: 50, w: 100, h: 50 } }, b = { id: 'b', rect: { x: 400, y: 200, w: 200, h: 100 } }, c = { id: 'c', rect: { x: 700, y: 120, w: 100, h: 40 } };
it('aligns one block to the canvas and several to their joint bounds (D-063)', () => {
  expect(align([a], 'hcenter', canvas)).toEqual({ a: { dx: 350, dy: 0 } });
  expect(align([a], 'bottom', canvas)).toEqual({ a: { dx: 0, dy: 400 } });
  expect(align([a, b], 'left', canvas)).toEqual({ a: { dx: 0, dy: 0 }, b: { dx: -300, dy: 0 } });
  expect(align([a, b], 'right', canvas)).toEqual({ a: { dx: 400, dy: 0 }, b: { dx: 0, dy: 0 } });
  expect(align([a, b], 'top', canvas).b).toEqual({ dx: 0, dy: -150 });
  expect(align([a, b], 'vcenter', canvas).a).toEqual({ dx: 0, dy: 100 });
  expect(unionOf([a.rect, b.rect])).toEqual({ x: 100, y: 50, w: 500, h: 250 });
});
it('spreads three or more blocks to equal gaps, keeping the outermost two', () => {
  expect(distribute([c, a, b], 'x')).toEqual({ a: { dx: 0, dy: 0 }, b: { dx: -50, dy: 0 }, c: { dx: 0, dy: 0 } });
  expect(distribute([a, b, c], 'y')).toEqual({ a: { dx: 0, dy: 0 }, c: { dx: 0, dy: 10 }, b: { dx: 0, dy: 0 } });
  expect(distribute([a, b], 'x')).toEqual({});
});
it('spaces evenly around a pinned (locked) block, which stays put (D-077)', () => {
  const box = (id: string, x: number) => ({ id, rect: { x, y: 0, w: 100, h: 100 } });
  // Ends at 0 and 900; the locked block at 300 splits the stretch: 0–300 holds one block, 300–900 two.
  const m = distribute([box('a', 0), box('b', 120), box('lock', 300), box('c', 420), box('d', 520), box('e', 900)], 'x', ['lock']);
  expect(m.lock).toEqual({ dx: 0, dy: 0 }); expect(m.b.dx).toBeCloseTo(30); expect(m.c.dx).toBeCloseTo(80); expect(m.d.dx).toBeCloseTo(180); expect(m.e.dx).toBe(0);
  expect(distribute([box('lock', 0), box('b', 120), box('c', 900)], 'x', ['lock']).b.dx).toBeCloseTo(330);
});
it('aligns to key blocks (locked ones) when given', () => {
  expect(align([a, b], 'hcenter', canvas, [{ x: 0, y: 0, w: 334, h: 500 }])).toEqual({ a: { dx: 17, dy: 0 }, b: { dx: -333, dy: 0 } });
});
