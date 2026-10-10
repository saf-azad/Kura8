// Undo history over immutable snapshots: recording is just keeping a reference. Edits with the same key inside the
// coalescing window (nudges, typing, dragging a colour) fold into one step.
export type History<T> = { past: T[]; future: T[]; last?: { key: string; at: number } };
export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] });
export function record<T>(h: History<T>, prev: T, o: { now: number; key?: string; limit?: number; window?: number }): History<T> {
  const limit = o.limit ?? 80, window = o.window ?? 700;
  if (o.key && h.last && h.last.key === o.key && o.now - h.last.at <= window) return { ...h, future: [], last: { key: o.key, at: o.now } };
  return { past: [...h.past, prev].slice(-limit), future: [], ...(o.key ? { last: { key: o.key, at: o.now } } : {}) };
}
export function undo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (!h.past.length) return null;
  return { history: { past: h.past.slice(0, -1), future: [...h.future, current] }, value: h.past[h.past.length - 1] };
}
export function redo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (!h.future.length) return null;
  return { history: { past: [...h.past, current], future: h.future.slice(0, -1) }, value: h.future[h.future.length - 1] };
}
