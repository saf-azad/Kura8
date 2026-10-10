import { it, expect } from 'vitest';
import { styleOf, applyStyle } from '../src/core/style';
import { frame, rectNode, textNode } from './helpers';
import type { DocNode } from '../src/core/document';
const shadow = { x: 4, y: 6, blur: 10, fill: { role: 'ink' as const }, alpha: .5 }, outline = { fill: { role: 'accent' as const }, width: 3 };
const text = textNode('t', frame(0, 0, 10, 10), 'Hi', { font: 'caveat', italic: true, spacing: 50, weight: 700, opacity: .5, shadow, outline, fill: { hex: '#112233' } } as Partial<DocNode>);
const shape = rectNode('s', frame(0, 0, 10, 10), { gradient: { to: { role: 'ink' }, angle: 90 }, outline } as Partial<DocNode>);
const image: DocNode = { id: 'i', kind: 'image', asset: 'a', adjust: { warmth: 20 }, mask: 'circle', shadow, frames: { main: frame(0, 0, 10, 10) } };
const ink: DocNode = { id: 'k', kind: 'ink', paths: [[[0, 0]]], stroke: 2, fill: { role: 'ink' }, frames: { main: frame(0, 0, 10, 10) } };
it('copies the look of a text onto another text, replacing what the source lacks (D-045)', () => {
  const plain = textNode('u', frame(5, 5, 20, 20), 'Other', { underline: true } as Partial<DocNode>), out = applyStyle(plain, styleOf(text));
  expect(out).toMatchObject({ id: 'u', text: 'Other', font: 'caveat', italic: true, spacing: 50, weight: 700, opacity: .5, shadow, outline, fill: { hex: '#112233' } });
  expect('underline' in out).toBe(false); expect(out.frames).toBe(plain.frames);
  expect(styleOf(text).shadow).not.toBe(shadow);
});
it('carries only the keys both kinds have', () => {
  const onShape = applyStyle(shape, styleOf(text));
  expect(onShape).toMatchObject({ fill: { hex: '#112233' }, opacity: .5, shadow, outline }); expect('gradient' in onShape).toBe(false); expect('font' in onShape).toBe(false);
  expect(applyStyle(rectNode('r', frame(0, 0, 1, 1)), styleOf(shape))).toMatchObject({ gradient: { to: { role: 'ink' }, angle: 90 }, outline });
  const onImage = applyStyle({ ...image, id: 'j', adjust: undefined, mask: undefined, outline } as DocNode, styleOf(image));
  expect(onImage).toMatchObject({ adjust: { warmth: 20 }, mask: 'circle', shadow }); expect('outline' in onImage).toBe(false);
  const fromImage = applyStyle(shape, styleOf(image)); expect(fromImage.kind === 'shape' && fromImage.fill).toEqual({ role: 'accent' }); expect('outline' in fromImage).toBe(false);
  const onInk = applyStyle(ink, styleOf(text)); expect(onInk).toMatchObject({ fill: { hex: '#112233' }, shadow }); expect('outline' in onInk).toBe(false);
  expect(applyStyle(shape, styleOf(ink))).toMatchObject({ outline }); expect(styleOf(ink).fill).toEqual({ role: 'ink' });
  expect(applyStyle(image, styleOf(text))).toMatchObject({ adjust: { warmth: 20 }, mask: 'circle' });
});
