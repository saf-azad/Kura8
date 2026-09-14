import { describe, it, expect } from 'vitest';
import { center, contains } from '../src/core/geometry';
describe('geometry', () => { it('uses unit space and inclusive boundaries', () => {
  const r = { x: 10, y: 20, w: 100, h: 200 };
  expect(center(r)).toEqual({ x: 60, y: 120 });
  expect(contains(r, { x: 110, y: 220 })).toBe(true);
  for (const p of [{ x: 9, y: 20 }, { x: 10, y: 19 }, { x: 111, y: 20 }, { x: 10, y: 221 }]) expect(contains(r, p)).toBe(false);
}); });
