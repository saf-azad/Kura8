import { it, expect } from 'vitest';
import { ratios, ratioById, canvasSize, exportSize, ratioNumbers, MAX_PIXELS, withinPixelLimit, zipScale, formats, formatById, formatFor } from '../src/core/ratios';
it('names Instagram and LinkedIn formats for the ratios they use (D-092)', () => {
  expect(formats.map(f => [f.id, f.platform, f.kind, f.ratio])).toEqual([['ig-post', 'instagram', 'Post', 'portrait'], ['ig-square', 'instagram', 'Square', 'square'], ['ig-story', 'instagram', 'Story', 'story'], ['ig-grid', 'instagram', 'Grid', 'tall'],
    ['li-post', 'linkedin', 'Post', 'square'], ['li-link', 'linkedin', 'Link', 'link'], ['li-banner', 'linkedin', 'Banner', 'cover']]);
  expect(formatById('ig-story')?.name).toBe('Instagram story'); expect(formatById('nope')).toBeUndefined();
  expect([formatFor('square')?.id, formatFor('square', 'li-post')?.id, formatFor('square', 'ig-story')?.id, formatFor('pin')]).toEqual(['ig-square', 'li-post', 'ig-square', null]);
});
it('pins all ten ratios, destination labels and export widths (D-069)', () => {
  expect(ratios.map(r => [r.id, r.label, r.w, r.h, r.exportWidth])).toEqual([['square', 'Post', 1, 1, 1080], ['portrait', 'Portrait', 4, 5, 1080], ['tall', 'Grid', 3, 4, 1080], ['story', 'Story', 9, 16, 1080],
    ['pin', 'Pin', 2, 3, 1000], ['a4', 'Print', 1, Math.SQRT2, 1240], ['landscape', 'Slide', 16, 9, 1920], ['link', 'Link', 1.91, 1, 1200], ['banner', 'Banner', 3, 1, 1500], ['cover', 'Header', 4, 1, 1584]]);
  ratios.forEach(r => { expect(ratioById(r.id)).toEqual(r); expect(canvasSize(r.id)).toEqual({ w: 1000, h: 1000 * r.h / r.w }); });
  expect(canvasSize('a4').h).toBeCloseTo(1414.2136);
  expect(ratios.map(r => ratioNumbers(r.id))).toEqual(['1:1', '4:5', '3:4', '9:16', '2:3', 'A4', '16:9', '1.91:1', '3:1', '4:1']);
});
it('sizes exports by scale or print dpi and limits pixels', () => {
  expect(exportSize('square', { scale: 1 })).toEqual({ w: 1080, h: 1080 });
  expect(exportSize('portrait', { scale: 2 })).toEqual({ w: 2160, h: 2700 });
  expect(exportSize('landscape', { scale: 1 })).toEqual({ w: 1920, h: 1080 });
  expect(exportSize('story', { scale: 1 })).toEqual({ w: 1080, h: 1920 });
  expect(exportSize('banner', { scale: 3 })).toEqual({ w: 4500, h: 1500 });
  expect(exportSize('a4', { dpi: 300 })).toEqual({ w: 2480, h: 3508 });
  expect(exportSize('tall', { scale: 1 })).toEqual({ w: 1080, h: 1440 }); expect(exportSize('pin', { scale: 1 })).toEqual({ w: 1000, h: 1500 });
  expect(exportSize('link', { scale: 1 })).toEqual({ w: 1200, h: 628 }); expect(exportSize('cover', { scale: 1 })).toEqual({ w: 1584, h: 396 });
  expect(exportSize('a4', { scale: 1 })).toEqual({ w: 1240, h: 1754 });
  expect(() => exportSize('square', { dpi: 300 })).toThrow('no print size');
  expect(MAX_PIXELS).toBe(16_777_216);
  expect(withinPixelLimit(exportSize('landscape', { scale: 2 }))).toBe(true);
  expect(withinPixelLimit(exportSize('landscape', { scale: 3 }))).toBe(false);
  expect(withinPixelLimit(exportSize('a4', { scale: 3 }))).toBe(false);
});
it('steps an All sizes export down to the largest scale that fits, not to 1× (D-077)', () => {
  expect(zipScale('story', { scale: 3 })).toEqual({ scale: 2 });
  expect(zipScale('square', { scale: 3 })).toEqual({ scale: 3 });
  expect(zipScale('a4', { scale: 3 })).toEqual({ dpi: 300 });
  expect(zipScale('a4', { scale: 2 })).toEqual({ dpi: 300 }); expect(zipScale('a4', { scale: 1 })).toEqual({ scale: 1 });
  expect(zipScale('square', { dpi: 300 })).toEqual({ scale: 2 }); expect(zipScale('a4', { dpi: 300 })).toEqual({ dpi: 300 });
  expect(zipScale('square', { scale: 1 })).toEqual({ scale: 1 });
});
it('scales the rounded 1× height, so 3× is exactly three times 1× (D-082)', () => {
  expect(exportSize('link', { scale: 1 })).toEqual({ w: 1200, h: 628 }); expect(exportSize('link', { scale: 3 })).toEqual({ w: 3600, h: 1884 });
});
