import { it, expect } from 'vitest';
import { emptyHistory, record, undo, redo } from '../src/core/history';
it('records snapshots, undoes and redoes, and clears the future on a new edit', () => {
  let h = emptyHistory<number>();
  h = record(h, 1, { now: 0 }); h = record(h, 2, { now: 1 });
  expect(h.past).toEqual([1, 2]);
  const u = undo(h, 3)!; expect(u.value).toBe(2); expect(u.history).toEqual({ past: [1], future: [3] });
  const r = redo(u.history, 2)!; expect(r.value).toBe(3); expect(r.history).toEqual({ past: [1, 2], future: [] });
  expect(record(u.history, 2, { now: 5 }).future).toEqual([]);
  expect(undo(emptyHistory<number>(), 0)).toBeNull(); expect(redo(emptyHistory<number>(), 0)).toBeNull();
});
it('coalesces same-key edits inside the window and caps the length', () => {
  let h = emptyHistory<number>();
  h = record(h, 1, { now: 0, key: 'nudge' }); h = record(h, 2, { now: 500, key: 'nudge' }); h = record(h, 3, { now: 1100, key: 'nudge' });
  expect(h.past).toEqual([1]);
  h = record(h, 4, { now: 1900, key: 'nudge' }); expect(h.past).toEqual([1, 4]);
  h = record(h, 5, { now: 1950, key: 'type' }); expect(h.past).toEqual([1, 4, 5]);
  h = record(h, 6, { now: 2000, key: 'type', window: 10 }); expect(h.past).toEqual([1, 4, 5, 6]);
  let big = emptyHistory<number>(); for (let i = 0; i < 100; i++) big = record(big, i, { now: i });
  expect(big.past).toHaveLength(80); expect(big.past[0]).toBe(20);
  expect(record(big, 1, { now: 0, limit: 3 }).past).toEqual([98, 99, 1]);
});
