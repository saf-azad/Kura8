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
it('aligns to key blocks (locked ones) when given', () => {
  expect(align([a, b], 'hcenter', canvas, [{ x: 0, y: 0, w: 334, h: 500 }])).toEqual({ a: { dx: 17, dy: 0 }, b: { dx: -333, dy: 0 } });
});
