import { it, expect } from 'vitest';
import { RINGS, ringPath, stepOf, rotationFor, indexAt, detent, settle } from '../src/core/dial';
it('defines four rings: ratio 10 (D-069), layout 6, guide 3, colour 13', () => {
  expect(RINGS.map(r => [r.key, r.n])).toEqual([['ratio', 10], ['comp', 6], ['guide', 3], ['hue', 13]]);
  for (let i = 1; i < RINGS.length; i++) expect(RINGS[i].ro).toBeLessThan(RINGS[i - 1].ri);
});
it('draws annular segments centred on the top for index 0', () => {
  const s = ringPath(320, 320, 318, 270, 0, 6);
  expect(s.c[0]).toBeCloseTo(320); expect(s.c[1]).toBeCloseTo(320 - 294);
  expect(s.d.startsWith('M')).toBe(true); expect(s.d).toContain('A318 318 0 0 1');
  expect(ringPath(0, 0, 10, 5, 0, 1).d).toContain('A10 10 0 1 1');
});
it('turns the short way to a segment and reads the segment back', () => {
  expect(stepOf(6)).toBe(60);
  expect(rotationFor(0, 1, 6)).toBe(-60); expect(rotationFor(0, 5, 6)).toBe(60); expect(rotationFor(350, 0, 6)).toBe(360);
  expect([indexAt(-60, 6), indexAt(60, 6), indexAt(-120, 3), indexAt(0, 13)]).toEqual([1, 5, 1, 0]);
});
it('sticks near detents while dragging and settles on release', () => {
  expect(detent(60, 6)).toBe(60); expect(detent(75, 6)).toBeLessThan(75); expect(detent(75, 6)).toBeGreaterThan(60); expect(detent(45, 6)).toBeGreaterThan(45);
  expect(settle(29, 6)).toBe(0); expect(settle(31, 6)).toBe(60);
});
