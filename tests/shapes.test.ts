import { describe, it, expect } from 'vitest';
import { shapes, shapeIds, shapeById, shapeOutline, isShapeId, DEFAULT_SHAPE } from '../src/core/shapes';
const rect = { x: 100, y: 50, w: 300, h: 200 };
describe('shapes', () => {
  it('registers six unique shapes with rectangle as default', () => {
    expect(shapes).toHaveLength(6); expect(new Set(shapeIds).size).toBe(6);
    expect(DEFAULT_SHAPE).toBe('rectangle'); expect(shapeById('star').name).toBe('Star');
    for (const id of shapeIds) expect(isShapeId(id)).toBe(true);
    for (const bad of ['circle', '', 1, undefined]) expect(isShapeId(bad)).toBe(false);
  });
  it('fills the node rect exactly for every polygon so the bounding box is unchanged', () => {
    for (const id of shapeIds) {
      const outline = shapeOutline(id, rect);
      if (id === 'ellipse') { expect(outline).toBeNull(); continue; }
      const xs = outline!.map(p => p.x), ys = outline!.map(p => p.y);
      expect(outline!.length).toBeGreaterThanOrEqual(3);
      expect(Math.min(...xs)).toBeCloseTo(rect.x); expect(Math.max(...xs)).toBeCloseTo(rect.x + rect.w);
      expect(Math.min(...ys)).toBeCloseTo(rect.y); expect(Math.max(...ys)).toBeCloseTo(rect.y + rect.h);
    }
  });
  it('is deterministic and gives the rectangle its four corners in draw order', () => {
    expect(shapeOutline('star', rect)).toEqual(shapeOutline('star', rect));
    expect(shapeOutline('rectangle', rect)).toEqual([{ x: 100, y: 50 }, { x: 400, y: 50 }, { x: 400, y: 250 }, { x: 100, y: 250 }]);
    expect(shapeOutline('triangle', rect)![0]).toEqual({ x: 250, y: 50 });
    expect(shapeOutline('star', rect)).toHaveLength(10); expect(shapeOutline('hexagon', rect)).toHaveLength(6);
  });
});
