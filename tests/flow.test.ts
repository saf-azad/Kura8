import { it, expect } from 'vitest';
import { flowText } from '../src/core/flow';
import { updateNodes } from '../src/core/ops';
import type { KuraDoc } from '../src/core/document';
import { doc, frame, rectNode, textNode, fakeMeasure } from './helpers';
// Headline 50 units (line 57.5) in a 300-wide box: "Hello" is one line, "Hello there friend" three.
const stack = (): KuraDoc => doc([
  textNode('h', frame(0, 0, 300, 57.5, { fontSize: 50 }), 'Hello'),
  textNode('b', frame(0, 87.5, 300, 23, { fontSize: 20 }), 'Body'),
  textNode('c', frame(100, 120, 300, 23, { fontSize: 20 }), 'Under the body'),
  textNode('far', frame(0, 500, 300, 23, { fontSize: 20 }), 'Far below'),
  textNode('side', frame(400, 90, 200, 23, { fontSize: 20 }), 'Beside'),
  rectNode('shape', frame(0, 90, 300, 50)),
]);
const retext = (d: KuraDoc, text: string) => updateNodes(d, ['h'], n => ({ ...n, text }));
const ys = (d: KuraDoc) => Object.fromEntries(d.nodes.map(n => [n.id, n.frames.main.rect.y]));
it('moves the text stacked under a growing block, cascading down the stack', () => {
  const before = stack(), out = flowText(before, retext(before, 'Hello there friend'), 'h', fakeMeasure);
  expect(ys(out)).toEqual({ h: 0, b: 87.5 + 115, c: 120 + 115, far: 500, side: 90, shape: 90 });
});
it('moves stacked text back up when the block shrinks', () => {
  const grown = retext(stack(), 'Hello there friend'), moved = flowText(stack(), grown, 'h', fakeMeasure);
  expect(ys(flowText(moved, retext(moved, 'Hi'), 'h', fakeMeasure))).toEqual(ys(stack()));
});
it('leaves locked, rotated and hidden text where it is', () => {
  const before = updateNodes(stack(), ['b'], n => ({ ...n, locked: true }));
  expect(ys(flowText(before, retext(before, 'Hello there friend'), 'h', fakeMeasure)).b).toBe(87.5);
  const turned = updateNodes(stack(), ['b'], n => ({ ...n, frames: { main: { ...n.frames.main, rot: 5 } } }));
  expect(ys(flowText(turned, retext(turned, 'Hello there friend'), 'h', fakeMeasure)).b).toBe(87.5);
  const hidden = updateNodes(stack(), ['b'], n => ({ ...n, frames: { main: { ...n.frames.main, hidden: true } } }));
  expect(ys(flowText(hidden, retext(hidden, 'Hello there friend'), 'h', fakeMeasure)).b).toBe(87.5);
});
it('flows in every size the text is in, by that size’s own wrapping', () => {
  const base = stack(), two: KuraDoc = { ...base, sizes: [...base.sizes, { id: 'wide', ratio: 'landscape', guide: null, comp: null }],
    nodes: base.nodes.map(n => ({ ...n, frames: { ...n.frames, wide: { ...n.frames.main, rect: { ...n.frames.main.rect, w: n.id === 'h' ? 900 : n.frames.main.rect.w } } } })) };
  const out = flowText(two, retext(two, 'Hello there friend'), 'h', fakeMeasure), b = out.nodes.find(n => n.id === 'b')!;
  expect(b.frames.main.rect.y).toBe(87.5 + 115); expect(b.frames.wide.rect.y).toBe(87.5);
});
it('returns the edited document unchanged when the height holds, the block is rotated or it is not text', () => {
  const before = stack(), same = retext(before, 'Howdy');
  expect(flowText(before, same, 'h', fakeMeasure)).toBe(same);
  const turned = updateNodes(before, ['h'], n => ({ ...n, frames: { main: { ...n.frames.main, rot: 10 } } }));
  const grown = retext(turned, 'Hello there friend');
  expect(flowText(turned, grown, 'h', fakeMeasure)).toBe(grown);
  expect(flowText(before, before, 'shape', fakeMeasure)).toBe(before);
  expect(flowText(before, before, 'missing', fakeMeasure)).toBe(before);
});
