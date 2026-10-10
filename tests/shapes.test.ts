import { it, expect } from 'vitest';
import { shapeGroups, shapeLibrary, shapeOutline, isShape, defaultShapeSize, ICON_SHAPE } from '../src/core/shapes';
it('holds the 41 library shapes in five groups', () => {
  expect(shapeGroups.map(g => [g.name, g.keys.length])).toEqual([['Basic', 9], ['Polygons', 8], ['Stars', 8], ['Arrows and lines', 8], ['Organic', 8]]);
  expect(Object.keys(shapeLibrary)).toHaveLength(41);
  for (const s of Object.values(shapeLibrary)) { expect(s.ar).toBeGreaterThan(0); expect(!!s.css !== !!s.d).toBe(true); }
  expect(isShape('star5')).toBe(true); expect(isShape(ICON_SHAPE)).toBe(false);
  expect(shapeLibrary.tri.d).toBe('M50 0L100 100L0 100Z');
});
it('builds box outlines at real size and stretches path shapes from their 100-unit box', () => {
  expect(shapeOutline(shapeLibrary.rect, 20, 10)).toEqual({ d: 'M0 0H20V10H0Z' });
  expect(shapeOutline(shapeLibrary.frame, 100, 100).d).toBe('M0 0H100V100H0ZM18 18H82V82H18Z');
  expect(shapeOutline(shapeLibrary.pill, 100, 40).d).toContain('A20 20');
  expect(shapeOutline(shapeLibrary.rounded, 100, 100).d).toContain('A18 18');
  expect(shapeOutline(shapeLibrary.circle, 100, 50).d).toBe('M0 25A50 25 0 1 0 100 25A50 25 0 1 0 0 25Z');
  expect(shapeOutline(shapeLibrary.ring, 100, 100).d.match(/M/g)).toHaveLength(2);
  expect(shapeOutline(shapeLibrary.ring, 1, 1).d).toContain('A0.5 0.5');
  expect(shapeOutline(shapeLibrary.heart, 200, 50)).toEqual({ d: shapeLibrary.heart.d, scale: [2, .5] });
  expect(shapeOutline({ css: undefined }, 5, 5)).toEqual({ d: 'M0 0H5V5H0Z' });
});
it('sizes new shapes from the canvas short side', () => {
  expect(defaultShapeSize(1.25, { w: 1000, h: 1000 })).toEqual({ w: 320, h: 256 });
  expect(defaultShapeSize(.5, { w: 1000, h: 500 })).toEqual({ w: 80, h: 160 });
  expect(defaultShapeSize(60, { w: 1000, h: 1000 })).toEqual({ w: 500, h: 500 / 60 });
  expect(defaultShapeSize(500, { w: 1000, h: 1000 }).h).toBe(4);
});
