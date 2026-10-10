import { describe, it, expect } from 'vitest';
import { center, contains, intersects, norm, modn, rotatePoint, corners, boundsOf, rotatedBounds, containsRotated, unionRect, quarterTurn } from '../src/core/geometry';
describe('geometry', () => {
  it('uses unit space and inclusive boundaries', () => {
    const r = { x: 10, y: 20, w: 100, h: 200 };
    expect(center(r)).toEqual({ x: 60, y: 120 });
    expect(contains(r, { x: 110, y: 220 })).toBe(true);
    for (const p of [{ x: 9, y: 20 }, { x: 10, y: 19 }, { x: 111, y: 20 }, { x: 10, y: 221 }]) expect(contains(r, p)).toBe(false);
  });
  it('normalises angles and wraps indices', () => {
    expect([norm(190), norm(-190), norm(180), norm(-180), norm(720), norm(45)]).toEqual([-170, 170, 180, 180, 0, 45]);
    expect([modn(-1, 6), modn(7, 6), modn(0, 3)]).toEqual([5, 1, 0]);
  });
  it('rotates clockwise on screen and finds rotated corners and bounds', () => {
    const p = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90); expect(p.x).toBeCloseTo(0); expect(p.y).toBeCloseTo(10);
    const r = { x: 0, y: 0, w: 100, h: 50 };
    expect(corners(r, 0)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }]);
    const b = rotatedBounds(r, 90); expect(b.x).toBeCloseTo(25); expect(b.y).toBeCloseTo(-25); expect(b.w).toBeCloseTo(50); expect(b.h).toBeCloseTo(100);
    expect(rotatedBounds(r, 0)).toEqual(r);
    expect(boundsOf([{ x: 3, y: 9 }, { x: -1, y: 4 }])).toEqual({ x: -1, y: 4, w: 4, h: 5 });
  });
  it('hit-tests rotated rects, intersections and unions', () => {
    const r = { x: 0, y: 0, w: 100, h: 10 };
    expect(containsRotated(r, 0, { x: 90, y: 5 })).toBe(true);
    expect(containsRotated(r, 90, { x: 90, y: 5 })).toBe(false);
    expect(containsRotated(r, 90, { x: 50, y: 40 })).toBe(true);
    expect(intersects(r, { x: 99, y: 9, w: 5, h: 5 })).toBe(true);
    expect(intersects(r, { x: 100, y: 0, w: 5, h: 5 })).toBe(false);
    expect(unionRect([r, { x: 50, y: 50, w: 10, h: 10 }])).toEqual({ x: 0, y: 0, w: 100, h: 60 });
    expect([quarterTurn(0), quarterTurn(-270), quarterTurn(45), quarterTurn(90.0001)]).toEqual([true, true, false, false]);
  });
});
