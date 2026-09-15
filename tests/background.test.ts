import { it, expect, vi } from 'vitest';
import { progressFraction, progressTracker, planeFromRgba, alphaFromScores, applyMask, MODEL } from '../src/app/tools/background';
it('aggregates download progress across parts', () => {
  expect(progressFraction([])).toBe(0);
  expect(progressFraction([{ key: 'model.part00', current: 20, total: 80 }, { key: 'model.part01', current: 10, total: 20 }])).toBeCloseTo(0.3);
  expect(progressFraction([{ key: 'a', current: 5, total: 0 }])).toBe(0);
  expect(progressFraction([{ key: 'a', current: 9, total: 4 }])).toBe(1);
});
it('reports the latest state per key to the listener', () => {
  const listen = vi.fn<(fraction: number) => void>(), track = progressTracker(listen);
  track('a', 0, 10); track('b', 0, 10); track('a', 10, 10); track('a', 10, 10);
  expect(listen.mock.calls.map(([f]) => f)).toEqual([0, 0, 0.5, 0.5]);
});
it('normalises RGBA into channel-major planes with the model mean and std', () => {
  const rgba = [255, 0, 128, 255, 0, 255, 0, 0];
  const plane = planeFromRgba(rgba, 2, MODEL.mean, MODEL.std);
  expect(plane).toHaveLength(6);
  expect(plane[0]).toBeCloseTo(0.5); expect(plane[1]).toBeCloseTo(-0.5);
  expect(plane[2]).toBeCloseTo(-0.5); expect(plane[3]).toBeCloseTo(0.5);
  expect(plane[4]).toBeCloseTo(128 / 255 - 0.5); expect(plane[5]).toBeCloseTo(-0.5);
  expect(planeFromRgba(rgba, 2, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225])[0]).toBeCloseTo((1 - 0.485) / 0.229);
});
it('keeps existing transparency when applying the mask and only ever removes more', () => {
  const rgba = new Uint8ClampedArray([9, 9, 9, 0, 9, 9, 9, 255, 9, 9, 9, 128, 9, 9, 9, 255]);
  applyMask(rgba, [255, 255, 128, 0]);
  expect(Array.from(rgba.filter((_, i) => i % 4 === 3))).toEqual([0, 255, 64, 0]);
  expect(Array.from(rgba.filter((_, i) => i % 4 !== 3))).toEqual(Array(12).fill(9));
});
it('turns scores into a stretched 0..255 alpha, with or without a sigmoid, and survives a flat map', () => {
  expect(Array.from(alphaFromScores([-20, 0, 20], true))).toEqual([0, 128, 255]);
  expect(Array.from(alphaFromScores([-4, -2], true))).toEqual([0, 255]);
  expect(Array.from(alphaFromScores([0, 0], true))).toEqual([128, 128]);
  expect(Array.from(alphaFromScores([0.2, 0.6, 1], false))).toEqual([0, 128, 255]);
  expect(Array.from(alphaFromScores([0.5, 0.5], false))).toEqual([128, 128]);
  expect(MODEL.sigmoid).toBe(false);
});
