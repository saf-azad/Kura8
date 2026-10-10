import { it, expect } from 'vitest';
import { ratios, ratioById, canvasSize, exportSize, ratioNumbers, MAX_PIXELS, withinPixelLimit } from '../src/core/ratios';
it('pins all six ratios, destination labels and export widths', () => {
  expect(ratios.map(r => [r.id, r.label, r.w, r.h, r.exportWidth])).toEqual([['square', 'Post', 1, 1, 1080], ['portrait', 'Portrait', 4, 5, 1080], ['landscape', 'Slide', 16, 9, 1920], ['story', 'Story', 9, 16, 1080], ['a4', 'Print', 1, Math.SQRT2, 1240], ['banner', 'Banner', 3, 1, 1500]]);
  ratios.forEach(r => { expect(ratioById(r.id)).toEqual(r); expect(canvasSize(r.id)).toEqual({ w: 1000, h: 1000 * r.h / r.w }); });
  expect(canvasSize('a4').h).toBeCloseTo(1414.2136);
  expect(ratios.map(r => ratioNumbers(r.id))).toEqual(['1:1', '4:5', '16:9', '9:16', 'A4', '3:1']);
});
it('sizes exports by scale or print dpi and limits pixels', () => {
  expect(exportSize('square', { scale: 1 })).toEqual({ w: 1080, h: 1080 });
  expect(exportSize('portrait', { scale: 2 })).toEqual({ w: 2160, h: 2700 });
  expect(exportSize('landscape', { scale: 1 })).toEqual({ w: 1920, h: 1080 });
  expect(exportSize('story', { scale: 1 })).toEqual({ w: 1080, h: 1920 });
  expect(exportSize('banner', { scale: 3 })).toEqual({ w: 4500, h: 1500 });
  expect(exportSize('a4', { dpi: 300 })).toEqual({ w: 2480, h: 3508 });
  expect(exportSize('a4', { scale: 1 })).toEqual({ w: 1240, h: 1754 });
  expect(() => exportSize('square', { dpi: 300 })).toThrow('no print size');
  expect(MAX_PIXELS).toBe(16_777_216);
  expect(withinPixelLimit(exportSize('landscape', { scale: 2 }))).toBe(true);
  expect(withinPixelLimit(exportSize('landscape', { scale: 3 }))).toBe(false);
  expect(withinPixelLimit(exportSize('a4', { scale: 3 }))).toBe(false);
});
