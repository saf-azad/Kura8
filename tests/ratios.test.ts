import { it, expect } from 'vitest';
import { ratios, ratioById, canvasSize } from '../src/core/ratios';
it('pins all five ratios and export widths', () => {
  expect(ratios.map(r => [r.id, r.w, r.h, r.exportWidth])).toEqual([['square', 1, 1, 1080], ['portrait', 4, 5, 1080], ['landscape', 16, 9, 1920], ['story', 9, 16, 1080], ['banner', 3, 1, 1500]]);
  ratios.forEach(r => { expect(ratioById(r.id)).toEqual(r); expect(canvasSize(r.id)).toEqual({ w: 1000, h: 1000 * r.h / r.w }); });
});
