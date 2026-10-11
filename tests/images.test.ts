import { it, expect } from 'vitest';
import { coverCrop, workingSize, nearestCell, containIn, CENTRE, panFocus, fullImageRect } from '../src/core/images';
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
