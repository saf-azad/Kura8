import { it, expect } from 'vitest';
import { setOpacity } from '../src/core/ops';
import { buildScene } from '../src/core/scene';
import { svg } from '../src/core/export';
import { validateDocument } from '../src/core/document';
import { doc, frame, rectNode, textNode, fakeMeasure } from './helpers';
const base = () => doc([rectNode('a', frame(0, 0, 10, 10)), rectNode('b', frame(0, 0, 10, 10), { locked: true }), textNode('t', frame(0, 0, 100, 20))]);
it('sets, clamps and clears opacity on unlocked nodes (D-052)', () => {
  const d = setOpacity(base(), ['a', 'b', 't'], .4);
  expect(d.nodes.map(n => n.opacity)).toEqual([.4, undefined, .4]);
  expect(setOpacity(d, ['a'], 1.5).nodes[0]).not.toHaveProperty('opacity');
  expect(setOpacity(d, ['a'], -1).nodes[0].opacity).toBe(0);
  expect(validateDocument(d)).toBe(true);
  expect(validateDocument({ ...d, nodes: [{ ...d.nodes[0], opacity: 2 }] })).toBe(false);
});
it('carries opacity below 1 into the scene and the SVG', () => {
  const d = setOpacity(base(), ['t'], .5), scene = buildScene(d, 'main', fakeMeasure);
  expect(scene.ops.map(o => o.opacity)).toEqual([undefined, undefined, .5]);
  const out = svg(scene, { pixels: { w: 1080, h: 1080 }, ground: true, licences: [], image: () => undefined });
  expect(out.match(/opacity="0.5"/g)).toHaveLength(1);
});
