import { describe, it, expect } from 'vitest';
import { createDocument, validateDocument, serialiseDocument, parseDocument, migrate, validColour, frameOf, sizeOf, neutralPalette, type KuraDoc, type DocNode } from '../src/core/document';
import { doc, frame, rectNode, textNode } from './helpers';
const f = frame(10, 20, 300, 200);
const all = (): DocNode[] => [
  rectNode('r', f, { locked: true, slot: 'accent' }),
  textNode('t', frame(10, 20, 300, 40, { fontSize: 40, rot: 15 }), 'Hello', { fit: true, slot: 'headline' }),
  { id: 'i', kind: 'image', asset: 'abc', cutout: true, focus: { x: .2, y: 1 }, slot: 'image', frames: { main: frame(0, 0, 10, 10, { hidden: true }) } },
  { id: 'e', kind: 'image', asset: null, frames: { main: f } },
  { id: 'k', kind: 'ink', paths: [[[0, 0], [1, 1]]], stroke: 3, fill: { row: 'c0', step: 6 }, form: 'arrow', frames: { main: f } },
  { id: 'o', kind: 'shape', shape: 'icon', fill: { hex: '#AABBCC' }, icon: { set: 'phosphor', name: 'coffee', d: 'M0 0L1 1Z', licence: 'MIT' }, frames: { main: f } },
];
describe('document v2', () => {
  it('creates pure documents and round-trips every node kind, colour ref and frame field', () => {
    const d = doc(all());
    expect(parseDocument(serialiseDocument(d))).toEqual(d);
    expect(createDocument('k3f9', '2026-10-10T00:00:00.000Z', { id: 'main', ratio: 'a4', guide: null, comp: 'band' })).toEqual({ version: 2, id: 'k3f9', createdAt: '2026-10-10T00:00:00.000Z', palette: neutralPalette(), ground: null, sizes: [{ id: 'main', ratio: 'a4', guide: null, comp: 'band' }], nodes: [] });
    expect(validateDocument({ ...d, ground: { role: 'ground' }, palette: { hue: 210, dark: true, custom: ['#123456'], accent: '#ff0000' } })).toBe(true);
    expect(frameOf(d.nodes[0], 'main')).toEqual(f);
    expect(sizeOf(d, 'main').ratio).toBe('square'); expect(sizeOf(d, 'missing').id).toBe('main');
  });
  it('requires one frame per size and accepts linked sizes', () => {
    const two: KuraDoc = { ...doc([rectNode('r', f)]), sizes: [{ id: 'main', ratio: 'square', guide: 'thirds', comp: null }, { id: 's2', ratio: 'story', guide: 'golden', comp: 'cover' }] };
    expect(validateDocument(two)).toBe(false);
    two.nodes = [{ ...two.nodes[0], frames: { main: f, s2: f } }];
    expect(validateDocument(two)).toBe(true);
    expect(validateDocument({ ...two, sizes: [two.sizes[0], { ...two.sizes[1], id: 'main' }] })).toBe(false);
    expect(validateDocument({ ...two, nodes: [{ ...two.nodes[0], frames: { main: f, other: f } }] })).toBe(false);
  });
  it('rejects invalid JSON and invalid documents', () => {
    expect(() => parseDocument('{')).toThrow(); expect(() => parseDocument('{}')).toThrow();
    expect(() => serialiseDocument({} as KuraDoc)).toThrow();
    const d = doc();
    for (const v of [null, [], {}, { ...d, version: 1 }, { ...d, id: 'BAD' }, { ...d, createdAt: 'x' }, { ...d, createdAt: '2026-99-99T00:00:00.000Z' }, { ...d, nodes: {} },
      { ...d, palette: null }, { ...d, palette: { ...d.palette, hue: 360 } }, { ...d, palette: { ...d.palette, dark: 1 } }, { ...d, palette: { ...d.palette, custom: ['red'] } }, { ...d, palette: { ...d.palette, accent: 'x' } },
      { ...d, ground: { role: 'paper' } }, { ...d, sizes: [] }, { ...d, sizes: {} }, { ...d, sizes: [{ id: '', ratio: 'square', guide: null, comp: null }] }, { ...d, sizes: [{ id: 'm', ratio: 'x', guide: null, comp: null }] },
      { ...d, sizes: [{ id: 'm', ratio: 'square', guide: 'x', comp: null }] }, { ...d, sizes: [{ id: 'm', ratio: 'square', guide: null, comp: 'x' }] }]) expect(validateDocument(v)).toBe(false);
  });
  it('rejects malformed nodes, frames, colours and duplicate ids', () => {
    const r = rectNode('r', f), t = textNode('t', f), i = all()[2], k = all()[4], o = all()[5];
    const bad: unknown[] = [null, {}, { ...r, kind: 'other' }, { ...r, id: '' }, { ...r, locked: 'yes' }, { ...r, slot: 'hero' }, { ...r, frames: null }, { ...r, frames: { main: null } },
      { ...r, frames: { main: { ...f, rect: { ...f.rect, w: 0 } } } }, { ...r, frames: { main: { ...f, rect: { ...f.rect, x: NaN } } } }, { ...r, frames: { main: { ...f, rot: Infinity } } }, { ...r, frames: { main: { ...f, fontSize: 0 } } }, { ...r, frames: { main: { ...f, hidden: 1 } } },
      { ...r, fill: { hex: 'red' } }, { ...r, fill: { role: 'ink', hex: '#000000' } }, { ...r, fill: { row: 'base', step: 7 } }, { ...r, fill: { row: 'x', step: 1 } }, { ...r, shape: 'heart2' }, { ...r, shape: 7 }, { ...r, icon: o.kind === 'shape' && o.icon },
      { ...o, icon: undefined }, { ...o, icon: { set: 'phosphor', name: '', d: 'M0 0', licence: 'MIT' } },
      { ...t, text: 4 }, { ...t, weight: 500 }, { ...t, align: 'left' }, { ...t, fit: 'yes' },
      { ...i, asset: '' }, { ...i, asset: 5 }, { ...i, cutout: 1 }, { ...i, focus: { x: 2, y: 0 } }, { ...i, focus: { x: 0, y: -1 } }, { ...i, focus: 'centre' }, { ...i, mask: 'square' },
      { ...k, paths: [] }, { ...k, paths: [[]] }, { ...k, paths: [[[0]]] }, { ...k, paths: [[[0, 'a']]] }, { ...k, paths: 'x' }, { ...k, paths: ['x'] }, { ...k, stroke: 0 }, { ...k, form: 'star' }];
    for (const n of bad) expect(validateDocument({ ...doc(), nodes: [n] })).toBe(false);
    expect(validateDocument(doc([r, r]))).toBe(false);
    expect(validateDocument({ ...doc(), nodes: [{ ...i, mask: 'circle' }] })).toBe(true);
  });
  it('validates colour references exactly', () => {
    expect([{ role: 'ink' }, { row: 'base', step: 0 }, { row: 'accent', step: 6 }, { row: 'c12', step: 3 }, { hex: '#a1B2c3' }].every(validColour)).toBe(true);
    expect([null, 'ink', {}, { role: 'x' }, { row: 'base', step: 1.5 }, { row: 'base', step: -1 }, { row: 'c', step: 1 }, { hex: '#abc' }, { hex: '#abcdef', role: 'ink' }].some(validColour)).toBe(false);
  });
});
describe('migrate', () => {
  const v1 = {
    version: 1, id: 'k3f9', ratio: 'portrait', guide: 'golden', createdAt: '2026-09-14T00:00:00.000Z', nodes: [
      { id: 'r', type: 'rect', rect: { x: 1, y: 2, w: 3, h: 4 }, fill: '#AABBCC', shape: 'star', locked: true },
      { id: 'p', type: 'rect', rect: { x: 1, y: 2, w: 3, h: 4 }, fill: '#000000' },
      { id: 't', type: 'text', rect: { x: 5, y: 6, w: 7, h: 8 }, text: 'Hi', fontSize: 40, weight: 700, align: 'right', color: '#111111' },
      { id: 'c', type: 'text', rect: { x: 5, y: 6, w: 7, h: 8 }, text: 'Hi', fontSize: 40, weight: 400, align: 'center', color: '#111111' },
      { id: 'l', type: 'text', rect: { x: 5, y: 6, w: 7, h: 8 }, text: 'Hi', fontSize: 40, weight: 400, align: 'left', color: '#111111' },
      { id: 'i', type: 'image', rect: { x: 9, y: 9, w: 9, h: 9 }, src: 'data:image/png;base64,YQ==', naturalSize: { w: 2, h: 1 } },
    ],
  };
  it('turns a version 1 document into one size with a neutral palette and inline images to store', () => {
    const { doc: d, inline } = migrate(v1);
    expect(d.version).toBe(2); expect(d.ground).toBeNull(); expect(d.palette).toEqual(neutralPalette());
    expect(d.sizes).toEqual([{ id: 'main', ratio: 'portrait', guide: 'golden', comp: null }]);
    expect(d.nodes[0]).toEqual({ id: 'r', locked: true, kind: 'shape', shape: 'star5', fill: { hex: '#aabbcc' }, frames: { main: { rect: { x: 1, y: 2, w: 3, h: 4 }, rot: 0 } } });
    expect(d.nodes[1]).toMatchObject({ shape: 'rect' });
    expect(d.nodes[2]).toEqual({ id: 't', kind: 'text', text: 'Hi', weight: 700, align: 'end', fill: { hex: '#111111' }, frames: { main: { rect: { x: 5, y: 6, w: 7, h: 8 }, rot: 0, fontSize: 40 } } });
    expect(d.nodes.slice(3, 5).map(n => n.kind === 'text' && n.align)).toEqual(['center', 'start']);
    expect(d.nodes[5]).toEqual({ id: 'i', kind: 'image', asset: 'v1-i', frames: { main: { rect: { x: 9, y: 9, w: 9, h: 9 }, rot: 0 } } });
    expect(inline).toEqual([{ asset: 'v1-i', dataUrl: 'data:image/png;base64,YQ==' }]);
    expect(validateDocument(d)).toBe(true);
  });
  it('renames every Phase 0 shape and defaults missing fields', () => {
    const names = ['rectangle', 'ellipse', 'triangle', 'diamond', 'star', 'arrow'].map(shape => { const r = migrate({ ...v1, nodes: [{ ...v1.nodes[0], shape }] }); return r.doc.nodes[0].kind === 'shape' && r.doc.nodes[0].shape; });
    expect(names).toEqual(['rect', 'circle', 'tri', 'diamond', 'star5', 'arrowR']);
    const bare = migrate({ ...v1, guide: undefined, nodes: [{ id: 'a', type: 'rect', rect: { x: 0, y: 0, w: 1, h: 1 } }, { id: 'b', type: 'text', rect: { x: 0, y: 0, w: 1, h: 1 } }, { id: 'c', type: 'image', rect: { x: 0, y: 0, w: 1, h: 1 } }, { id: 'd', type: 'rect', shape: 'blob', rect: { x: 0, y: 0, w: 1, h: 1 } }] });
    expect(bare.doc.sizes[0].guide).toBeNull();
    expect(bare.doc.nodes.map(n => n.kind === 'shape' ? n.shape : n.kind === 'text' ? [n.text, n.weight, n.align] : n.kind)).toEqual(['rect', ['', 400, 'start'], 'image', 'rect']);
    expect(bare.inline).toEqual([{ asset: 'v1-c', dataUrl: '' }]);
  });
  it('passes version 2 through and rejects unknown input', () => {
    const d = doc([rectNode('r', f)]);
    expect(migrate(d)).toEqual({ doc: d, inline: [] });
    for (const x of [null, {}, { version: 3, nodes: [] }, { version: 1 }]) expect(() => migrate(x)).toThrow('Unknown');
    expect(() => migrate({ ...v1, ratio: 'huge' })).toThrow('Invalid version 1');
    expect(migrate(v1, 's1').doc.sizes[0].id).toBe('s1');
  });
});
