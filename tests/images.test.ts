import { describe, it, expect } from 'vitest';
import { coverCrop, workingSize, nearestCell, containIn, CENTRE, panFocus, fullImageRect, spreadCells, freeSpot, tiles } from '../src/core/images';
it('crops to cover around the focus point, clamped inside the image', () => {
  expect(coverCrop({ w: 2000, h: 1000 }, { w: 100, h: 100 })).toEqual({ x: 500, y: 0, w: 1000, h: 1000 });
  expect(coverCrop({ w: 2000, h: 1000 }, { w: 100, h: 100 }, { x: 0, y: .5 })).toEqual({ x: 0, y: 0, w: 1000, h: 1000 });
  expect(coverCrop({ w: 2000, h: 1000 }, { w: 100, h: 100 }, { x: 1, y: 0 })).toEqual({ x: 1000, y: 0, w: 1000, h: 1000 });
  expect(coverCrop({ w: 1000, h: 1000 }, { w: 200, h: 100 }, CENTRE)).toEqual({ x: 0, y: 250, w: 1000, h: 500 });
});
it('downscales the working copy to twice the export size, never upscaling (5n)', () => {
  expect(workingSize({ w: 6000, h: 4000 }, 1080)).toEqual({ w: 2160, h: 1440 });
  expect(workingSize({ w: 800, h: 600 }, 1080)).toEqual({ w: 800, h: 600 });
  expect(workingSize({ w: 9000, h: 1 }, 1000, 1)).toEqual({ w: 1000, h: 1 });
});
it('drops onto the nearest cell (5p)', () => {
  const cells = [{ x: 0, y: 0, w: 500, h: 500 }, { x: 500, y: 0, w: 500, h: 500 }, { x: 100, y: 100, w: 100, h: 100 }];
  expect(nearestCell({ x: 150, y: 150 }, cells, { w: 1000, h: 1000 })).toEqual(cells[2]);
  expect(nearestCell({ x: 900, y: 900 }, cells, { w: 1000, h: 1000 })).toEqual(cells[1]);
  expect(nearestCell({ x: 9, y: 9 }, [], { w: 1000, h: 800 })).toEqual({ x: 250, y: 200, w: 500, h: 400 });
  expect(containIn({ x: 0, y: 0, w: 100, h: 100 }, { w: 200, h: 100 })).toEqual({ x: 0, y: 25, w: 100, h: 50 });
});
it('pans the picture inside its frame by moving the focus, never past the picture’s edges (D-048)', () => {
  // A 2000 × 1000 picture in a 100 × 100 frame shows a 1000-wide crop at 10 px per unit.
  const natural = { w: 2000, h: 1000 }, frame = { w: 100, h: 100 };
  expect(panFocus(natural, frame, CENTRE, { x: 10, y: 0 })).toEqual({ x: .45, y: .5 });
  expect(panFocus(natural, frame, CENTRE, { x: -20, y: 30 })).toEqual({ x: .6, y: .5 });
  expect(panFocus(natural, frame, CENTRE, { x: 500, y: 0 })).toEqual({ x: .25, y: .5 });
  expect(panFocus(natural, frame, { x: 0, y: .5 }, { x: -10, y: 0 })).toEqual({ x: .3, y: .5 });
  expect(fullImageRect(natural, frame, CENTRE)).toEqual({ x: -50, y: 0, w: 200, h: 100 });
  expect(fullImageRect(natural, frame, { x: 1, y: 0 })).toEqual({ x: -100, y: 0, w: 200, h: 100 });
});
it('spreads several new pictures over the emptiest cells, the drop cell first (D-058)', () => {
  const canvas = { w: 900, h: 300 }, cells = [0, 300, 600].map(x => ({ x, y: 0, w: 300, h: 300 })), taken = [{ x: 0, y: 0, w: 300, h: 300 }];
  expect(spreadCells({ x: 50, y: 50 }, cells, taken, 2, canvas, true)).toEqual([cells[0], cells[1]]);
  expect(spreadCells({ x: 450, y: 150 }, cells, taken, 3, canvas, false)).toEqual([cells[1], cells[2], cells[0]]);
  expect(spreadCells({ x: 450, y: 150 }, cells, [], 4, canvas, false)[3]).toEqual({ x: 320, y: 0, w: 300, h: 300 });
  expect(spreadCells({ x: 0, y: 0 }, [{ x: 600, y: 0, w: 300, h: 300 }], [], 2, canvas, false)[1]).toEqual({ x: 600, y: 0, w: 300, h: 300 });
  expect(spreadCells({ x: 0, y: 0 }, [], taken, 2, canvas, true)).toEqual([{ x: 225, y: 75, w: 450, h: 150 }, { x: 245, y: 95, w: 450, h: 150 }]);
});
describe('a free spot for pasted copy and icons (D-077)', () => {
  const canvas = { w: 900, h: 900 }, cells = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => ({ x: c * 300, y: r * 300, w: 300, h: 300 })));
  it('takes the emptiest cell, inset by the pad', () => {
    expect(freeSpot({ size: { w: 100, h: 30 }, canvas, cells, taken: [], pad: 20 })).toEqual({ x: 20, y: 20 });
    expect(freeSpot({ size: { w: 100, h: 30 }, canvas, cells, taken: [{ x: 0, y: 0, w: 600, h: 300 }], pad: 20 })).toEqual({ x: 620, y: 20 });
  });
  it('never lands exactly on an earlier paste, even on a full canvas', () => {
    const taken = cells.map(c => ({ ...c, w: c.w - 40, h: c.h - 40 })), spots: { x: number; y: number }[] = [];
    for (let i = 0; i < 5; i++) { const p = freeSpot({ size: { w: 120, h: 30 }, canvas, cells, taken, pad: 20 }); spots.push(p); taken.push({ ...p, w: 120, h: 30 }); }
    expect(new Set(spots.map(p => `${p.x},${p.y}`)).size).toBe(5);
  });
  it('moves wide copy clear of a headline when there is room, and stays on the canvas', () => {
    const headline = { x: 400, y: 0, w: 500, h: 200 }, p = freeSpot({ size: { w: 540, h: 100 }, canvas, cells, taken: [headline], pad: 20 });
    expect(p.y >= headline.y + headline.h || p.x + 540 <= headline.x).toBe(true); expect(p.x + 540).toBeLessThanOrEqual(900);
    expect(freeSpot({ size: { w: 2000, h: 100 }, canvas, cells: [], taken: [], pad: 20 })).toEqual({ x: 0, y: 20 });
  });
});
it('tiles several pictures into one frame, closest to square, the last row filling its width (D-081)', () => {
  const t = tiles({ x: 0, y: 0, w: 1000, h: 500 }, 4, 10);
  expect(t).toHaveLength(4); expect(t.every(r => r.y === 0 && Math.abs(r.w - 242.5) < 1e-9 && r.h === 500)).toBe(true);
  const six = tiles({ x: 0, y: 0, w: 600, h: 900 }, 5, 0);
  expect(six.map(r => [r.x, r.y, r.w, r.h])).toEqual([[0, 0, 300, 300], [300, 0, 300, 300], [0, 300, 300, 300], [300, 300, 300, 300], [0, 600, 600, 300]]);
  expect(tiles({ x: 5, y: 5, w: 100, h: 100 }, 1, 4)).toEqual([{ x: 5, y: 5, w: 100, h: 100 }]);
});
it('puts copy over a photo before it puts it over other copy, keeping clear of text (D-081)', () => {
  const canvas = { w: 1000, h: 1000 }, photo = { x: 0, y: 0, w: 1000, h: 600 }, words = { x: 0, y: 600, w: 1000, h: 400 };
  const p = freeSpot({ size: { w: 300, h: 40 }, canvas, cells: [], taken: [photo], text: [words], pad: 40 });
  expect(p.y + 40).toBeLessThanOrEqual(580);
  const q = freeSpot({ size: { w: 300, h: 40 }, canvas, cells: [], taken: [], text: [{ x: 0, y: 0, w: 1000, h: 100 }], pad: 40 });
  expect(q.y).toBeGreaterThanOrEqual(120);
});
