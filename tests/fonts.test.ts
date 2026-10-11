import { it, expect } from 'vitest';
import { FONTS, fontById, drawnWeight } from '../src/core/fonts';
import { fontStack } from '../src/core/script';
import { textBox, typeScale } from '../src/core/fit';
import { buildScene } from '../src/core/scene';
import { validateDocument, fontIds, type TextNode } from '../src/core/document';
import type { Measure } from '../src/core/geometry';
import { doc, frame, textNode, fakeMeasure } from './helpers';
it('lists every font id once, Space Grotesk first and the default (D-049)', () => {
  expect(FONTS.map(f => f.id)).toEqual(fontIds);
  expect(fontById(undefined).family).toBe('Space Grotesk'); expect(fontById('bebas').family).toBe('Bebas Neue');
});
it('draws the one weight of a single-weight face instead of a synthesized bold', () => {
  expect(drawnWeight('bebas', 700)).toBe(400); expect(drawnWeight('playfair', 700)).toBe(700); expect(drawnWeight(undefined, 400)).toBe(400);
});
it('puts the chosen face before the script fallbacks', () => {
  expect(fontStack('Hello')).toBe('"Space Grotesk", system-ui, sans-serif');
  expect(fontStack('Hello', 'playfair')).toBe('"Playfair Display", Georgia, serif');
  expect(fontStack('مرحبا', 'poppins')).toBe('"Poppins", "Noto Sans Arabic", "Geeza Pro", "Segoe UI", Tahoma, sans-serif');
  expect(fontStack('你好', 'grotesk')).toBe(fontStack('你好'));
});
it('validates the font field', () => {
  const d = doc([textNode('t', frame(0, 0, 100, 20), 'Hi', { font: 'caveat' } as Partial<TextNode>)]);
  expect(validateDocument(d)).toBe(true);
  expect(validateDocument({ ...d, nodes: [{ ...d.nodes[0], font: 'comic-sans' }] })).toBe(false);
});
it('measures and draws text in its face and drawn weight', () => {
  const calls: unknown[][] = [], spy: Measure = (...a) => { calls.push(a); return fakeMeasure(...a); };
  const node = textNode('t', frame(0, 0, 300, 20, { fontSize: 40 }), 'Big news', { font: 'bebas', weight: 700 } as Partial<TextNode>) as TextNode;
  textBox(node, node.frames.main, spy, typeScale('thirds', { w: 1000, h: 1000 }));
  expect(calls[0]).toEqual(['Big news', 40, 400, 300, 'bebas']);
  textBox({ ...node, fit: true }, node.frames.main, spy, typeScale('thirds', { w: 1000, h: 1000 }));
  expect(calls[calls.length - 1][4]).toBe('bebas');
  const op = buildScene(doc([node]), 'main', fakeMeasure).ops[0];
  expect(op).toMatchObject({ kind: 'text', weight: 400, font: '"Bebas Neue", Impact, sans-serif' });
});
