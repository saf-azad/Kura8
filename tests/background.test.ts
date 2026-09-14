import { it, expect, vi } from 'vitest';
import { progressFraction, progressTracker } from '../src/app/tools/background';
it('aggregates download progress across resources and ignores compute steps', () => {
  expect(progressFraction([])).toBe(0);
  expect(progressFraction([{ key: 'models/isnet_fp16', current: 20, total: 80 }, { key: 'onnxruntime-web/ort.wasm', current: 10, total: 20 }])).toBeCloseTo(0.3);
  expect(progressFraction([{ key: 'compute:inference', current: 1, total: 4 }, { key: 'models/isnet_fp16', current: 80, total: 80 }])).toBe(1);
  expect(progressFraction([{ key: 'a', current: 5, total: 0 }])).toBe(0);
  expect(progressFraction([{ key: 'a', current: 9, total: 4 }])).toBe(1);
});
it('reports the latest state per key to the listener', () => {
  const listen = vi.fn<(fraction: number) => void>(), track = progressTracker(listen);
  track('a', 0, 10); track('b', 0, 10); track('a', 10, 10); track('a', 10, 10);
  expect(listen.mock.calls.map(([f]) => f)).toEqual([0, 0, 0.5, 0.5]);
});
