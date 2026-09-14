import { describe, it, expect } from 'vitest';
import { createDocument, validateDocument, serialiseDocument, parseDocument, type RatioDoc } from '../src/core/document';
const create = () => createDocument('k3f9', 'square', 'thirds', '2026-09-14T00:00:00.000Z');
const rect = { x: 10, y: 20, w: 300, h: 200 };
describe('document', () => {
  it('creates pure documents and round-trips all node types and the blank condition', () => {
    const d = create(); d.nodes = [
      { id: 'r', type: 'rect', rect, fill: '#ffffff' },
      { id: 't', type: 'text', rect, text: 'Hello', fontSize: 40, weight: 700, align: 'center', color: '#000000' },
      { id: 'i', type: 'image', rect, src: 'data:image/png;base64,YQ==', naturalSize: { w: 2, h: 1 } },
    ];
    expect(parseDocument(serialiseDocument(d))).toEqual(d);
    d.guide = null; expect(validateDocument(d)).toBe(true);
    expect(create()).toEqual(create());
  });
  it('rejects invalid JSON and invalid documents', () => {
    expect(() => parseDocument('{')).toThrow(); expect(() => parseDocument('{}')).toThrow();
    expect(() => serialiseDocument({} as RatioDoc)).toThrow();
    for (const v of [null, [], {}, { ...create(), version: 2 }, { ...create(), id: 'BAD' }, { ...create(), ratio: 'x' }, { ...create(), guide: 'x' }, { ...create(), createdAt: 'x' }, { ...create(), createdAt: '2026-99-99T00:00:00.000Z' }, { ...create(), nodes: {} }]) expect(validateDocument(v)).toBe(false);
  });
  it('rejects malformed nodes, geometry, colours, image sources and duplicate ids', () => {
    const r = { id: 'r', type: 'rect', rect, fill: '#ffffff' };
    const t = { id: 't', type: 'text', rect, text: 'X', fontSize: 40, weight: 400, align: 'left', color: '#000000' };
    for (const n of [null, {}, { ...r, type: 'other' }, { ...r, id: '' }, { ...r, rect: null }, { ...r, rect: { ...rect, w: 0 } }, { ...r, rect: { ...rect, x: NaN } }, { ...r, rect: { ...rect, y: Infinity } }, { ...r, fill: 'red' }, { ...t, text: 4 }, { ...t, fontSize: -1 }, { ...t, weight: 500 }, { ...t, align: 'justify' }, { ...t, color: '' }, { id: 'i', type: 'image', rect, src: 'https://x', naturalSize: { w: 1, h: 1 } }]) expect(validateDocument({ ...create(), nodes: [n] })).toBe(false);
    expect(validateDocument({ ...create(), nodes: [r, r] })).toBe(false);
  });
});
