import { it, expect } from 'vitest';
import { RINGS, ringPath, arcPath, stepOf, rotationFor, indexAt, detent, settle, ratioStops, PLAIN_RATIOS, stopOf, settingFor, ratioSpans } from '../src/core/dial';
it('defines four rings: ratio 5 stops (Social and four ratios, D-092), layout 6, guide 3, colour 13', () => {
  expect(RINGS.map(r => [r.key, r.n])).toEqual([['ratio', 5], ['comp', 6], ['guide', 3], ['hue', 13]]);
  for (let i = 1; i < RINGS.length; i++) expect(RINGS[i].ro).toBeLessThan(RINGS[i - 1].ri);
});
it('draws annular segments centred on the top for index 0', () => {
  const s = ringPath(320, 320, 318, 270, 0, 6);
  expect(s.c[0]).toBeCloseTo(320); expect(s.c[1]).toBeCloseTo(320 - 294);
  expect(s.d.startsWith('M')).toBe(true); expect(s.d).toContain('A318 318 0 0 1');
  expect(ringPath(0, 0, 10, 5, 0, 1).d).toContain('A10 10 0 1 1');
  expect(arcPath(320, 320, 318, 270, -30, 30)).toEqual(ringPath(320, 320, 318, 270, 0, 6));
  expect(arcPath(0, 0, 10, 5, 80, 100).c).toEqual([7.5, 0]);
});
it('groups Instagram and LinkedIn formats into one Social stop that opens (D-092)', () => {
  expect(PLAIN_RATIOS).toEqual(['pin', 'a4', 'landscape', 'banner']);
  expect(ratioStops(false)).toEqual(['social', 'pin', 'a4', 'landscape', 'banner']);
  expect(ratioStops(true)).toEqual(['ig-post', 'ig-square', 'ig-story', 'ig-grid', 'li-post', 'li-link', 'li-banner', 'pin', 'a4', 'landscape', 'banner']);
  const closed = ratioStops(false), open = ratioStops(true);
  expect([stopOf(closed, 'story'), stopOf(closed, 'a4'), stopOf(open, 'story'), stopOf(open, 'square', 'li-post'), stopOf(open, 'square', 'ig-post'), stopOf(open, 'banner')]).toEqual([0, 2, 2, 4, 1, 10]);
  expect(settingFor('social')).toEqual({ ratio: 'portrait', format: 'ig-post' });
  expect(settingFor('social', 'li-banner')).toEqual({ ratio: 'cover', format: 'li-banner' });
  expect(settingFor('ig-story', 'li-post')).toEqual({ ratio: 'story', format: 'ig-story' });
  expect(settingFor('pin', 'li-post')).toEqual({ ratio: 'pin' });
});
it('opens Social by fanning its formats out of its segment (D-092)', () => {
  const at0 = ratioSpans(0), at1 = ratioSpans(1), w = 360 / 11;
  expect(at0[0]).toEqual({ id: 'ig-post', from: -36, to: -36 + 72 / 7 });
  expect(at0[6].to).toBeCloseTo(36); expect(at0[7]).toEqual({ id: 'pin', from: 36, to: 108 }); expect(at0[10]).toEqual({ id: 'banner', from: 252, to: 324 });
  at1.forEach((s, i) => { expect(s.from).toBeCloseTo(i * w - w / 2); expect(s.to).toBeCloseTo(i * w + w / 2); });
  const mid = ratioSpans(.5);
  for (let i = 1; i < mid.length; i++) expect(mid[i].from).toBeCloseTo(mid[i - 1].to);
});
it('turns the short way to a segment and reads the segment back', () => {
  expect(stepOf(6)).toBe(60);
  expect(rotationFor(0, 1, 6)).toBe(-60); expect(rotationFor(0, 5, 6)).toBe(60); expect(rotationFor(350, 0, 6)).toBe(360);
  expect([indexAt(-60, 6), indexAt(60, 6), indexAt(-120, 3), indexAt(0, 13)]).toEqual([1, 5, 1, 0]);
});
it('sticks near detents while dragging and settles on release', () => {
  expect(detent(60, 6)).toBe(60); expect(detent(75, 6)).toBeLessThan(75); expect(detent(75, 6)).toBeGreaterThan(60); expect(detent(45, 6)).toBeGreaterThan(45);
  expect(settle(29, 6)).toBe(0); expect(settle(31, 6)).toBe(60);
});
