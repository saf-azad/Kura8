import { it, expect } from 'vitest';
import { nodeById, addNodes, removeNodes, updateNodes, setFrames, nudge, setFill, setGround, setLocked, setHidden, reorder, cloneNodes, duplicateNodes, pasteNodes } from '../src/core/ops';
import { validateDocument } from '../src/core/document';
import { doc, frame, rectNode, textNode, ids } from './helpers';
const base = () => doc([rectNode('a', frame(0, 0, 10, 10)), rectNode('b', frame(10, 10, 10, 10), { locked: true }), textNode('c', frame(0, 0, 50, 20)), { id: 'i', kind: 'image', asset: null, frames: { main: frame(0, 0, 5, 5) } }]);
const order = (d: ReturnType<typeof base>) => d.nodes.map(n => n.id).join('');
it('adds, finds and removes nodes, refusing locked ones', () => {
  const d = base();
  expect(nodeById(d, 'c')?.kind).toBe('text'); expect(nodeById(d, 'z')).toBeUndefined();
  expect(order(addNodes(d, [rectNode('z', frame(0, 0, 1, 1))]))).toBe('abciz');
  expect(order(removeNodes(d, ['a', 'b']))).toBe('bci');
});
it('edits geometry and properties of unlocked nodes only', () => {
  const d = base();
  expect(updateNodes(d, ['a', 'b'], n => ({ ...n, slot: 'accent' })).nodes.map(n => n.slot)).toEqual(['accent', undefined, undefined, undefined]);
  expect(setFrames(d, 'main', { a: frame(5, 5, 5, 5), b: frame(5, 5, 5, 5) }).nodes.map(n => n.frames.main.rect.x)).toEqual([5, 10, 0, 0]);
  expect(nudge(d, 'main', ['a', 'b', 'c'], 3, -2).nodes.map(n => [n.frames.main.rect.x, n.frames.main.rect.y])).toEqual([[3, -2], [10, 10], [3, -2], [0, 0]]);
  const filled = setFill(d, ['a', 'b', 'c', 'i'], { hex: '#ff0000' });
  expect(filled.nodes.map(n => n.kind === 'image' ? 'none' : n.fill)).toEqual([{ hex: '#ff0000' }, { role: 'accent' }, { hex: '#ff0000' }, 'none']);
  expect(setGround(d, { role: 'accent' }).ground).toEqual({ role: 'accent' });
});
it('locks, unlocks and hides per size', () => {
  const d = base();
  const locked = setLocked(d, ['a'], true); expect(locked.nodes[0].locked).toBe(true);
  expect('locked' in setLocked(locked, ['a', 'b'], false).nodes[1]).toBe(false);
  const hidden = setHidden(d, 'main', ['a', 'b'], true); expect(hidden.nodes[0].frames.main.hidden).toBe(true);
  expect(hidden.nodes[1].frames.main.hidden).toBeUndefined();   // locked: hidden is frame geometry
  expect('hidden' in setHidden(hidden, 'main', ['a'], false).nodes[0].frames.main).toBe(false);
  expect(validateDocument(hidden)).toBe(true);
});
it('reorders by the shared array order', () => {
  const d = base();
  expect(order(reorder(d, ['a'], 'front'))).toBe('bcia'); expect(order(reorder(d, ['i'], 'back'))).toBe('iabc');
  expect(order(reorder(d, ['a'], 'forward'))).toBe('baci'); expect(order(reorder(d, ['i'], 'forward'))).toBe('abci');
  expect(order(reorder(d, ['c'], 'backward'))).toBe('acbi'); expect(order(reorder(d, ['a', 'b'], 'backward'))).toBe('abci');
});
it('duplicates and pastes unlocked, untagged copies offset in every size', () => {
  const d = { ...base(), sizes: [...base().sizes, { id: 's2', ratio: 'story' as const, guide: null, comp: null }] };
  d.nodes = d.nodes.map(n => ({ ...n, slot: 'body' as const, frames: { ...n.frames, s2: frame(1, 1, 2, 2) } }));
  const { doc: out, ids: copies } = duplicateNodes(d, ['a', 'b'], ids());
  expect(copies).toEqual(['n1']); expect(out.nodes[4]).toMatchObject({ id: 'n1', frames: { main: frame(20, 20, 10, 10), s2: frame(21, 21, 2, 2) } });
  expect(out.nodes[4].slot).toBeUndefined();
  const clip = [rectNode('x', frame(0, 0, 4, 4), { locked: true })];
  const pasted = pasteNodes(d, clip, ids(), 2);
  expect(pasted.doc.nodes[4]).toMatchObject({ frames: { main: frame(40, 40, 4, 4), s2: frame(40, 40, 4, 4) } }); expect(pasted.doc.nodes[4].locked).toBeUndefined();
  expect(validateDocument(pasted.doc)).toBe(true);
  expect(cloneNodes(base(), [d.nodes[0]], () => 'q', 0)[0].frames).toEqual({ main: frame(0, 0, 10, 10) });
});
