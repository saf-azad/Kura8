import { it, expect } from 'vitest';
import { resizeRect } from '../src/app/canvas/interaction';
import { handles } from '../src/app/canvas/overlay';
const rect = { x: 100, y: 200, w: 300, h: 200 };
it('clamps before crossing the opposite edge and keeps the opposite corner fixed', () => {
  expect(resizeRect(rect, 'nw', 500, 500, false).rect).toEqual({ x: 380, y: 380, w: 20, h: 20 });
  expect(resizeRect(rect, 'se', -500, -500, false).rect).toEqual({ ...rect, w: 20, h: 20 });
  expect(resizeRect(rect, 'move', -500, 500, false).rect).toEqual({ ...rect, x: -400, y: 700 });
});
it('preserves image aspect and minimum size for both dominant axes', () => {
  for (const [dx, dy] of [[100, 10], [10, 100], [-1000, -1000]]) {
    const r = resizeRect(rect, 'se', dx, dy, true).rect;
    expect(r.w / r.h).toBeCloseTo(1.5); expect(r.w).toBeGreaterThanOrEqual(20); expect(r.h).toBeGreaterThanOrEqual(20);
  }
});
it('restricts text handles to east/west and images to corners', () => {
  expect(handles({ id: 't', type: 'text', rect, text: '', fontSize: 30, weight: 400, align: 'left', color: '#000000' }).map(h => h.handle)).toEqual(['w', 'e']);
  expect(handles({ id: 'i', type: 'image', rect, src: '', naturalSize: rect }).map(h => h.handle)).toEqual(['nw', 'ne', 'sw', 'se']);
  expect(handles({ id: 'r', type: 'rect', rect, fill: '#000000' })).toHaveLength(8);
});
