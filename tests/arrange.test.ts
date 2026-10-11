import { it, expect } from 'vitest';
import { align, distribute, matchSize, unionOf } from '../src/core/arrange';
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
it('gives every block the key’s width or height, scaling pictures in proportion (D-077)', () => {
  const key = { x: 0, y: 0, w: 300, h: 188 }, photo = { id: 'p', rect: { x: 400, y: 10, w: 291, h: 182 }, keepAspect: true }, box = { id: 'b', rect: { x: 0, y: 300, w: 100, h: 50 }, keepAspect: false };
  const w = matchSize([photo, box], key, 'w');
  expect(w.p).toEqual({ x: 400, y: 10, w: 300, h: 182 * 300 / 291 }); expect(w.b).toEqual({ x: 0, y: 300, w: 300, h: 50 });
  const hgt = matchSize([photo, box], key, 'h');
  expect(hgt.p.h).toBe(188); expect(hgt.p.w).toBeCloseTo(291 * 188 / 182); expect(hgt.b).toEqual({ x: 0, y: 300, w: 100, h: 188 });
});
it('leaves a locked background out of the row when spacing evenly (D-082)', () => {
  const c = (id: string, x: number) => ({ id, rect: { x, y: 200, w: 100, h: 100 } }), bg = { id: 'bg', rect: { x: 0, y: 0, w: 1000, h: 562 } };
  const m = distribute([bg, c('a', 60), c('b', 240), c('c', 500), c('d', 820)], 'x', ['bg']);
  expect(m.bg).toEqual({ dx: 0, dy: 0 }); expect(m.a.dx).toBeCloseTo(0); expect(m.d.dx).toBeCloseTo(0);
  const gap = (920 - 60 - 400) / 3; expect(m.b.dx).toBeCloseTo(160 + gap - 240); expect(m.c.dx).toBeCloseTo(260 + 2 * gap - 500);
  expect(distribute([bg, c('a', 60), c('b', 240)], 'x', ['bg'])).toEqual({ bg: { dx: 0, dy: 0 } });
});
it('keeps a turned block centred when it takes the key size (D-082)', () => {
  const m = matchSize([{ id: 't', rect: { x: 400, y: 400, w: 200, h: 100 }, keepAspect: false, rot: 45 }], { x: 0, y: 0, w: 100, h: 300 }, 'h');
  expect(m.t).toEqual({ x: 400, y: 300, w: 200, h: 300 });
});
