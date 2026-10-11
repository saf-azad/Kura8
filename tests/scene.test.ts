import { it, expect } from 'vitest';
import { buildScene } from '../src/core/scene';
import { svg, pdf, licences, escapeXml, pageSize } from '../src/core/export';
import { resolve } from '../src/core/palette';
import { LINE_HEIGHT } from '../src/core/fit';
import { fakeMeasure, doc, frame, rectNode, textNode } from './helpers';
import type { DocNode } from '../src/core/document';
const icon: DocNode = { id: 'o', kind: 'shape', shape: 'icon', fill: { hex: '#123456' }, icon: { set: 'phosphor', name: 'coffee', d: 'M0 0L100 100Z', licence: 'MIT' }, frames: { main: frame(0, 0, 50, 50) } };
const nodes = (): DocNode[] => [
  rectNode('r', frame(10, 20, 100, 50, { rot: 15 })), rectNode('h', frame(0, 0, 1, 1, { hidden: true })),
  textNode('t', frame(0, 0, 60, 10, { fontSize: 50 }), 'one two'), textNode('a', frame(0, 0, 500, 10, { fontSize: 20 }), 'مساحة بين <&>'),
  { id: 'i', kind: 'image', asset: 'k', cutout: true, frames: { main: frame(0, 0, 200, 100) } }, { id: 'e', kind: 'image', asset: null, focus: { x: 0, y: 0 }, frames: { main: frame(0, 0, 10, 10) } },
  { id: 'k', kind: 'ink', paths: [[[0, 0], [1, .5]]], stroke: 4, fill: { role: 'ink' }, frames: { main: frame(0, 0, 100, 40) } }, icon,
  { ...rectNode('bad', frame(0, 0, 9, 9)), shape: 'icon' } as DocNode,
];
it('builds a draw list with resolved colours, wrapped text, physical alignment and local paths', () => {
  const d = doc(nodes()), s = buildScene(d, 'main', fakeMeasure);
  expect(s.size).toEqual({ w: 1000, h: 1000 }); expect(s.filled).toBe(false); expect(s.ground).toBe(resolve({ role: 'ground' }, d.palette));
  expect(s.hidden).toBe(1); expect(s.empty).toBe(1);
  expect(s.ops.map(o => o.id)).toEqual(['r', 't', 'a', 'i', 'e', 'k', 'o', 'bad']);
  expect(s.ops[0]).toEqual({ kind: 'shape', id: 'r', rect: { x: 10, y: 20, w: 100, h: 50 }, rot: 15, fill: resolve({ role: 'accent' }, d.palette), d: 'M0 0H100V50H0Z' });
  expect(s.ops[1]).toMatchObject({ kind: 'text', lines: ['one', 'two'], align: 'left', dir: 'ltr', size: 50, lineHeight: 50 * LINE_HEIGHT, rect: { h: 100 * LINE_HEIGHT } });
  expect(s.ops[2]).toMatchObject({ align: 'right', dir: 'rtl' });
  expect(s.ops[3]).toEqual({ kind: 'image', id: 'i', rect: { x: 0, y: 0, w: 200, h: 100 }, rot: 0, asset: 'k', cutout: true, focus: { x: .5, y: .5 } });
  expect(s.ops[5]).toMatchObject({ kind: 'ink', stroke: 4, paths: [[[0, 0], [100, 20]]] });
  expect(s.ops[6]).toMatchObject({ d: 'M0 0L100 100Z', scale: [.5, .5], fill: '#123456' });
  expect(s.ops[7]).toMatchObject({ d: 'M0 0H9V9H0Z' });
  const filled = buildScene({ ...d, ground: { hex: '#ff0000' }, sizes: [{ ...d.sizes[0], ratio: 'banner' }] }, 'other', fakeMeasure);
  expect(filled.ground).toBe('#ff0000'); expect(filled.filled).toBe(true); expect(filled.size.h).toBeCloseTo(1000 / 3);
});
it('writes SVG with explicit tspans, licence metadata (5u) and optional ground (5z)', () => {
  const d = doc(nodes()), s = buildScene(d, 'main', fakeMeasure), l = licences(d, 'main');
  expect(l).toEqual([{ name: 'coffee', set: 'phosphor', licence: 'MIT', source: 'https://github.com/phosphor-icons/core' }]);
  const out = svg(s, { pixels: { w: 1080, h: 1080 }, ground: true, fontCss: '@font-face{}', licences: l, image: o => o.asset === 'k' ? { href: 'data:image/png;base64,AA', natural: { w: 400, h: 400 } } : undefined });
  expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1000 1000">')).toBe(true);
  expect(out).toContain('<metadata><licences xmlns="urn:kura8:licences"><icon name="coffee" set="phosphor" licence="MIT" source="https://github.com/phosphor-icons/core"/></licences></metadata>');
  expect(out).toContain('<defs><style>@font-face{}</style></defs>'); expect(out).toContain(`<rect width="1000" height="1000" fill="${s.ground}"/>`);
  expect(out).toContain('<tspan x="0" y="28.75">one</tspan><tspan x="0" y="86.25">two</tspan>');
  expect(out).toContain('direction="rtl"'); expect(out).toContain('مساحة بين &lt;&amp;&gt;'); expect(out).toContain(`font-family="'Space Grotesk', system-ui, sans-serif"`);
  expect(out).toContain('viewBox="0 100 400 200" preserveAspectRatio="none"><image href="data:image/png;base64,AA" width="400" height="400"/>');
  expect(out).toContain('d="M0 0L100 20"'); expect(out).toContain('transform="scale(0.5 0.5)"');
  const bare = svg(s, { pixels: { w: 10, h: 10 }, ground: false, licences: [], image: () => undefined });
  expect(bare).not.toContain('<metadata>'); expect(bare).not.toContain('<rect width'); expect(bare).not.toContain('<image');
  const anchors = buildScene(doc([textNode('c', frame(0, 0, 100, 10), 'x', { align: 'center' }), textNode('e', frame(0, 0, 100, 10), 'x', { align: 'end' }), textNode('r', frame(0, 0, 100, 10), 'שלום', { align: 'start' }), textNode('l', frame(0, 0, 100, 10), 'שלום', { align: 'end' })]), 'main', fakeMeasure);
  expect(svg(anchors, { pixels: { w: 1, h: 1 }, ground: false, licences: [], image: () => undefined }).match(/text-anchor="(\w+)"/g)).toEqual(['text-anchor="middle"', 'text-anchor="end"', 'text-anchor="start"', 'text-anchor="end"']);
  expect(licences(doc([icon, { ...icon, id: 'o2' }, { ...icon, id: 'o3', icon: { set: 'other', name: 'x', d: 'M0 0', licence: 'CC0' }, frames: { main: frame(0, 0, 1, 1, { hidden: true }) } }]), 'main')).toHaveLength(1);
  expect(licences(doc([{ ...icon, icon: { ...(icon as { icon: object }).icon, set: 'tabler' } } as DocNode]), 'main')[0].source).toBe('tabler');
  expect(escapeXml('"a"')).toBe('&quot;a&quot;');
});
it('writes a valid one-page PDF around a JPEG with a correct xref', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), bytes = pdf(jpeg, { w: 2480, h: 3508 }, pageSize({ w: 2480, h: 3508 }, { w: 210, h: 297 }), 'kura8 (a4)\\é');
  const text = new TextDecoder('latin1').decode(bytes);
  expect(text.startsWith('%PDF-1.4\n')).toBe(true); expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  expect(text).toContain('/MediaBox [0 0 595.28 841.89]'); expect(text).toContain('/Width 2480 /Height 3508'); expect(text).toContain('/Filter /DCTDecode /Length 4');
  expect(text).toContain('/Title (kura8 \\(a4\\)\\\\?)');
  const startxref = Number(text.match(/startxref\n(\d+)/)![1]); expect(text.slice(startxref, startxref + 4)).toBe('xref');
  const offsets = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map(m => Number(m[1]));
  offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  const at = text.indexOf('stream\n') + 7; expect(Array.from(bytes.slice(at, at + 4))).toEqual([0xff, 0xd8, 0xff, 0xd9]);
  expect(pageSize({ w: 1080, h: 1350 })).toEqual({ w: 810, h: 1012.5 });
  expect(new TextDecoder('latin1').decode(pdf(jpeg, { w: 1, h: 1 }, { w: 1, h: 1 }))).toContain('/Title (Kura8)');
});
it('gives each paragraph its own direction in a mixed block (D-064)', () => {
  const d = doc([textNode('t', frame(0, 0, 900, 40, { fontSize: 20 }), 'Iftar night\nإفطار جماعي\n2026', { align: 'start' } as never)]);
  const op = buildScene(d, 'main', fakeMeasure).ops[0];
  expect(op.kind === 'text' && op.bidi).toEqual([{ dir: 'ltr', align: 'left' }, { dir: 'rtl', align: 'right' }, { dir: 'ltr', align: 'left' }]);
  const out = svg(buildScene(d, 'main', fakeMeasure), { pixels: { w: 1080, h: 1080 }, ground: true, licences: [], image: () => undefined });
  expect(out).toContain('x="900" y="34.5" text-anchor="start" dominant-baseline="central" direction="rtl"');
  expect(out.match(/<text /g)).toHaveLength(3);
  const shifted = svg(buildScene(d, 'main', fakeMeasure), { pixels: { w: 1080, h: 1080 }, ground: true, licences: [], image: () => undefined, textShift: o => o.size * .3 });
  expect(shifted).toContain('y="40.5"'); expect(shifted).not.toContain('dominant-baseline');
  expect(buildScene(doc([textNode('u', frame(0, 0, 900, 40), 'One\nTwo')]), 'main', fakeMeasure).ops[0]).not.toHaveProperty('bidi');
});
it('carries a circle mask into the scene and clips SVG pictures to the ellipse (D-081)', () => {
  const d = doc([{ id: 'c', kind: 'image', asset: 'k', mask: 'circle', frames: { main: frame(100, 100, 200, 100) } } as DocNode]);
  const s = buildScene(d, 'main', fakeMeasure);
  expect(s.ops[0]).toMatchObject({ kind: 'image', circle: true });
  const out = svg(s, { pixels: { w: 1000, h: 1000 }, ground: true, licences: [], image: () => ({ href: 'data:image/png;base64,AA', natural: { w: 400, h: 400 } }) });
  expect(out).toContain('<clipPath id="m-c"><ellipse cx="100" cy="50" rx="100" ry="50"/></clipPath>'); expect(out).toContain('clip-path="url(#m-c)"');
});
