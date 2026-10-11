import { describe, it, expect } from 'vitest';
import { layout, layoutPad, starterNodes, compositionFit, slotRect, textRoleOn, keepReadable, STARTER } from '../src/core/compositions';
import { compIds, guideIds, ratioIds, validateDocument, type DocNode, type KuraDoc, type Palette, type TextNode } from '../src/core/document';
import { canvasSize } from '../src/core/ratios';
import { fractionsOf } from '../src/core/guides';
import { fitText, splitsWord, textHeight, typeScale } from '../src/core/fit';
import { contrast, resolve } from '../src/core/palette';
import { fakeMeasure, doc, ids } from './helpers';
const inside = (r: { x: number; y: number; w: number; h: number }, c: { w: number; h: number }) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= c.w + 1e-6 && r.y + r.h <= c.h + 1e-6 && r.w > 0 && r.h > 0;
describe('layouts', () => {
  it('keeps every slot inside the canvas for all 6 ratios × 6 layouts × 3 guides', () => {
    for (const ratio of ratioIds) for (const comp of compIds) for (const guide of guideIds) {
      const canvas = canvasSize(ratio), l = layout({ canvas, guide, comp, measure: fakeMeasure, headline: STARTER.headline, body: STARTER.body });
      for (const r of [l.image, l.accent, l.headline.rect, l.body.rect]) if (r) expect(inside(r, canvas), `${ratio} ${comp} ${guide} ${JSON.stringify(r)}`).toBe(true);
      expect(l.headline.fontSize).toBeGreaterThan(0); expect(l.body.fontSize).toBeGreaterThan(0);
    }
  });
  it('places slots on the guide lines (cover on golden square)', () => {
    const [a, b] = fractionsOf('golden'), l = layout({ canvas: { w: 1000, h: 1000 }, guide: 'golden', comp: 'cover', measure: fakeMeasure, headline: 'Headline', body: 'Body' });
    expect(l.image).toEqual({ x: 0, y: 0, w: 1000, h: b * 1000 });
    expect(l.headline.rect.x).toBeCloseTo(a * 1000); expect(l.headline.rect.y).toBeCloseTo(b * 1000 + 45);
    expect(layout({ canvas: { w: 1000, h: 1000 }, guide: 'thirds', comp: 'poster', measure: fakeMeasure, headline: 'H', body: 'B' }).image).toBeNull();
    const split = layout({ canvas: { w: 1000, h: 1000 }, guide: 'divisions', comp: 'split', measure: fakeMeasure, headline: 'H', body: 'B' });
    expect(split.image).toEqual({ x: 0, y: 0, w: 250, h: 1000 }); expect(split.accent).toEqual({ x: 750, y: 750, w: 250, h: 250 });
  });
  it('caps a long headline by the space above the image and steps it down on short canvases', () => {
    const long = 'A very long headline that wraps over many lines indeed';
    const stack = layout({ canvas: canvasSize('square'), guide: 'thirds', comp: 'stack', measure: fakeMeasure, headline: long, body: 'B' });
    expect(stack.headline.rect.y + stack.headline.rect.h).toBeLessThanOrEqual(1000 / 3 + 1e-6);
    const band = layout({ canvas: canvasSize('banner'), guide: 'thirds', comp: 'band', measure: fakeMeasure, headline: long, body: long });
    expect(band.headline.fontSize).toBeLessThan(28 * 1.5 * 1.5);
  });
  it('turns a layout into slot-tagged starter nodes that make a valid document', () => {
    const l = layout({ canvas: canvasSize('portrait'), guide: 'golden', comp: 'frame', measure: fakeMeasure, headline: 'H', body: 'B' });
    const nodes = starterNodes(l, { sizeId: 'main', newId: ids() });
    expect(nodes.map(n => [n.kind, n.slot])).toEqual([['image', 'image'], ['shape', 'accent'], ['text', 'headline'], ['text', 'body']]);
    expect(nodes[0]).toMatchObject({ asset: null }); expect(nodes[2]).toMatchObject({ text: STARTER.headline, weight: 700, fill: { role: 'ink' } });
    expect(nodes[2].frames.main.fontSize).toBe(l.headline.fontSize);
    expect(validateDocument(doc(nodes, { id: 'main', ratio: 'portrait', guide: 'golden', comp: 'frame' }))).toBe(true);
    const poster = starterNodes(layout({ canvas: canvasSize('square'), guide: 'thirds', comp: 'poster', measure: fakeMeasure, headline: 'H', body: 'B' }), { sizeId: 's', newId: ids(), headline: 'Mine', body: 'Copy' });
    expect(poster.map(n => n.kind)).toEqual(['shape', 'text', 'text']); expect(poster[1]).toMatchObject({ text: 'Mine' });
    expect(slotRect(l, 'image')?.rect).toEqual(l.image); expect(slotRect(l, 'accent')?.rect).toEqual(l.accent); expect(slotRect(l, 'body')).toBe(l.body);
    expect(slotRect({ ...l, image: null }, 'image')).toBeNull();
  });
  it('explains why a layout does not suit a ratio (5c)', () => {
    const fit = (ratio: Parameters<typeof canvasSize>[0], comp: typeof compIds[number], guide: typeof guideIds[number] = 'golden', headline = 'Headline') => compositionFit({ canvas: canvasSize(ratio), guide, comp, measure: fakeMeasure, headline, body: 'Body' });
    expect(fit('square', 'cover')).toEqual({ ok: true });
    expect(fit('story', 'split')).toEqual({ ok: false, reason: 'narrow' });
    expect(fit('banner', 'stack')).toEqual({ ok: false, reason: 'shallow' });
    expect(fit('square', 'frame', 'divisions')).toEqual({ ok: true });
    expect(compositionFit({ canvas: canvasSize('banner'), guide: 'golden', comp: 'band', measure: fakeMeasure, headline: 'H', body: 'Body text that keeps going and going well past the bottom of a short banner canvas. '.repeat(6) })).toEqual({ ok: false, reason: 'overflow' });
    const rows = ratioIds.map(r => compIds.map(c => { const f = fit(r, c); return f.ok ? '.' : f.reason[0]; }).join(''));
    expect(rows).toMatchSnapshot();
  });
});
describe('autofit headline rooms (D-055)', () => {
  it('gives poster and stack headlines an autofit box filling the room above the band', () => {
    const c = canvasSize('a4'), poster = layout({ canvas: c, guide: 'golden', comp: 'poster', measure: fakeMeasure, headline: 'Careers Fair 2026: meet forty employers in one afternoon', body: 'B' });
    expect(poster.headline.fit).toBe(true); expect(poster.headline.rect.y + poster.headline.rect.h).toBeLessThanOrEqual(poster.accent.y + 1e-6);
    const nodes = starterNodes(poster, { sizeId: 'main', newId: ids() });
    expect(nodes.find(n => n.slot === 'headline')).toMatchObject({ fit: true });
    expect(layout({ canvas: c, guide: 'golden', comp: 'cover', measure: fakeMeasure, headline: 'H', body: 'B' }).headline.fit).toBeUndefined();
  });
  it('steps autofit text down rather than breaking a word', () => {
    const scale = typeScale('thirds', { w: 1000, h: 1000 });
    // Breaks words wider than the line into characters, as the app's measurer does.
    const chars = (text: string, size: number, _w: 400 | 700, width: number) => text.split(' ').flatMap(w => w.match(new RegExp(`.{1,${Math.max(1, Math.floor(width / (size * .6)))}}`, 'g'))!);
    const out = fitText({ text: 'Rebranding', weight: 700, width: 300, height: 1000, size: scale.steps[6], scale, measure: chars });
    expect(splitsWord('Rebranding', out.lines)).toBe(false); expect(out.size).toBeLessThan(scale.steps[6]);
    expect(splitsWord('你好世界你好', ['你好世', '界你好'])).toBe(false);
    expect(splitsWord('Two words', ['Two', 'words'])).toBe(false); expect(splitsWord('LETTERS', ['LETTER', 'S'])).toBe(true);
  });
});
describe('readable text on the accent band (D-056)', () => {
  const poster = () => layout({ canvas: canvasSize('portrait'), guide: 'golden', comp: 'poster', measure: fakeMeasure, headline: 'H', body: 'B' });
  it('gives body text on the band the role that reads better on the accent', () => {
    expect(textRoleOn(poster(), poster().body.rect, { hue: null, dark: false, custom: [] })).toEqual({ role: 'ground' });
    expect(textRoleOn(poster(), poster().body.rect, { hue: null, dark: true, custom: [] })).toEqual({ role: 'ground' });
    expect(textRoleOn(poster(), poster().headline.rect, { hue: null, dark: false, custom: [] })).toEqual({ role: 'ink' });
    const nodes = starterNodes(poster(), { sizeId: 'main', newId: ids(), palette: { hue: null, dark: false, custom: [] } });
    expect(nodes.find(n => n.slot === 'body')).toMatchObject({ fill: { role: 'ground' } });
    expect(starterNodes(poster(), { sizeId: 'main', newId: ids() }).find(n => n.slot === 'body')).toMatchObject({ fill: { role: 'ink' } });
  });
});
describe('readable band text for every hue (D-076)', () => {
  it('reaches 4.5 : 1 on the accent band, using an accent shade when neither ink nor ground does', () => {
    const slots = layout({ canvas: canvasSize('portrait'), guide: 'golden', comp: 'poster', measure: fakeMeasure, headline: 'H', body: 'B' });
    const fails: string[] = [];
    for (const hue of [...Array.from({ length: 12 }, (_, i) => i * 30), null]) for (const dark of [false, true]) {
      const p = { hue, dark, custom: [] }, ref = textRoleOn(slots, slots.body.rect, p);
      if (contrast(resolve(ref, p), resolve({ role: 'accent' }, p)) < 4.5) fails.push(`${hue}/${dark}`);
    }
    expect(fails).toEqual([]);
    expect(textRoleOn(slots, slots.body.rect, { hue: 120, dark: false, custom: [] })).toEqual({ hex: '#000000' });
    expect(textRoleOn(slots, slots.body.rect, { hue: 150, dark: false, custom: [] })).toEqual({ hex: '#ffffff' });
  });
});
describe('band text stays readable when the palette changes in the editor (D-077)', () => {
  const slots = layout({ canvas: canvasSize('square'), guide: 'golden', comp: 'poster', measure: fakeMeasure, headline: 'H', body: 'B' });
  const start = (p: Palette): KuraDoc => ({ version: 2, id: 'd', createdAt: '', palette: p, ground: null, sizes: [{ id: 'main', ratio: 'square', guide: 'golden', comp: 'poster' }], nodes: starterNodes(slots, { sizeId: 'main', newId: ids(), palette: p }) });
  const reads = (d: KuraDoc) => { const b = d.nodes.find(n => n.slot === 'body')!; return contrast(resolve((b as TextNode).fill, d.palette), resolve({ role: 'accent' }, d.palette)); };
  it('recolours automatic band text that would fail and leaves the rest', () => {
    for (const [from, to] of [[{ hue: 0, dark: false }, { hue: 0, dark: true }], [{ hue: 0, dark: false }, { hue: 60, dark: false }], [{ hue: 90, dark: false }, { hue: 300, dark: false }]] as const) {
      const d = start({ ...from, custom: [] }), next = { ...d, palette: { ...d.palette, ...to } };
      expect(reads(keepReadable(next))).toBeGreaterThanOrEqual(4.5);
    }
    const d = start({ hue: 0, dark: false, custom: [] });
    expect(keepReadable(d)).toBe(d);
    const chosen = { ...d, palette: { ...d.palette, dark: true }, nodes: d.nodes.map(n => n.slot === 'body' ? { ...n, fill: { row: 'base', step: 3 } } as DocNode : n) };
    expect(keepReadable(chosen)).toBe(chosen);
    // The headline sits on the ground, not the band: it keeps ink.
    const dark = keepReadable({ ...d, palette: { ...d.palette, dark: true } });
    expect(dark.nodes.find(n => n.slot === 'headline')).toMatchObject({ fill: { role: 'ink' } });
  });
});
describe('text on a filled ground stays readable (D-081)', () => {
  it('re-picks automatic text on bare ground after a dark fill, and leaves text on blocks and chosen colours', () => {
    const p: Palette = { hue: 210, dark: false, custom: [] }, t = (id: string, x: number, extra = {}) => ({ id, kind: 'text', text: 'Hi', weight: 400, align: 'start', fill: { role: 'ink' }, frames: { main: { rect: { x, y: 600, w: 100, h: 30 }, rot: 0 } }, ...extra }) as DocNode;
    const photo = { id: 'p', kind: 'image', asset: 'a', frames: { main: { rect: { x: 500, y: 500, w: 400, h: 400 }, rot: 0 } } } as DocNode;
    const d: KuraDoc = { version: 2, id: 'd', createdAt: '', palette: p, ground: { hex: '#1b1f3b' }, sizes: [{ id: 'main', ratio: 'square', guide: null, comp: null }], nodes: [photo, t('bare', 50), t('over', 600), t('chosen', 250, { fill: { hex: '#202020' } })] };
    const out = keepReadable(d), fill = (id: string) => (out.nodes.find(n => n.id === id) as TextNode).fill;
    expect(contrast(resolve(fill('bare'), p), '#1b1f3b')).toBeGreaterThanOrEqual(4.5);
    expect(fill('over')).toEqual({ role: 'ink' }); expect(fill('chosen')).toEqual({ hex: '#202020' });
    expect(keepReadable({ ...d, ground: null })).toEqual({ ...d, ground: null });
  });
});
it('keeps black or white chosen for a free label on the band (D-082)', () => {
  const p: Palette = { hue: 60, dark: false, custom: [] }, band = { id: 'band', kind: 'shape', shape: 'rect', fill: { role: 'accent' }, frames: { main: { rect: { x: 0, y: 500, w: 1000, h: 300 }, rot: 0 } } } as DocNode;
  const label = { id: 'l', kind: 'text', text: 'Hi', weight: 400, align: 'start', fill: { hex: '#ffffff' }, frames: { main: { rect: { x: 50, y: 600, w: 100, h: 30 }, rot: 0 } } } as DocNode;
  const d: KuraDoc = { version: 2, id: 'd', createdAt: '', palette: { ...p, dark: true }, ground: null, sizes: [{ id: 'main', ratio: 'square', guide: null, comp: null }], nodes: [band, label] };
  expect(keepReadable(d)).toBe(d);
});
it('re-picks text that lies over other text on a filled ground, as a label pasted into a headline room (D-083)', () => {
  const p: Palette = { hue: 210, dark: false, custom: [] }, t = (id: string, y: number) => ({ id, kind: 'text', text: 'Hi', weight: 400, align: 'start', fill: { role: 'ink' }, frames: { main: { rect: { x: 50, y, w: 600, h: 300 }, rot: 0 } } }) as DocNode;
  const d: KuraDoc = { version: 2, id: 'd', createdAt: '', palette: p, ground: { hex: '#0a0a0a' }, sizes: [{ id: 'main', ratio: 'square', guide: null, comp: null }], nodes: [t('room', 50), t('label', 100)] };
  const out = keepReadable(d);
  expect(contrast(resolve((out.nodes[1] as TextNode).fill, p), '#0a0a0a')).toBeGreaterThanOrEqual(4.5);
});
it('re-picks an automatic label on a pill or an ink block for that block’s colour, and leaves a turned or see-through one (D-087)', () => {
  const p: Palette = { hue: 90, dark: false, custom: [] }, shape = (id: string, s: string, fill: object, extra = {}) => ({ id, kind: 'shape', shape: s, fill, frames: { main: { rect: { x: 0, y: 500, w: 600, h: 200 }, rot: 0 } }, ...extra }) as DocNode;
  const label = { id: 'l', kind: 'text', text: 'Apply by Fri', weight: 400, align: 'start', fill: { role: 'ink' }, frames: { main: { rect: { x: 50, y: 550, w: 300, h: 30 }, rot: 0 } } } as DocNode;
  const on = (back: DocNode) => { const d: KuraDoc = { version: 2, id: 'd', createdAt: '', palette: p, ground: null, sizes: [{ id: 'main', ratio: 'square', guide: null, comp: null }], nodes: [back, label] }; return keepReadable(d).nodes[1] as TextNode; };
  expect(contrast(resolve(on(shape('pill', 'pill', { role: 'ink' })).fill, p), resolve({ role: 'ink' }, p))).toBeGreaterThanOrEqual(4.5);
  expect(contrast(resolve(on(shape('pill', 'pill', { row: 'accent', step: 5 })).fill, p), resolve({ row: 'accent', step: 5 }, p))).toBeGreaterThanOrEqual(4.5);
  expect(on(shape('pill', 'pill', { role: 'ink' }, { opacity: .5 })).fill).toEqual({ role: 'ink' });
  expect(on(shape('pill', 'icon', { role: 'ink' })).fill).toEqual({ role: 'ink' });
});
it('treats text over an empty picture frame as text on the ground, since the export leaves the frame out (D-089)', () => {
  const p: Palette = { hue: 210, dark: false, custom: [] }, frameNode = { id: 'f', kind: 'image', asset: null, frames: { main: { rect: { x: 0, y: 0, w: 1000, h: 1000 }, rot: 0 } } } as DocNode;
  const label = { id: 'l', kind: 'text', text: 'Register now', weight: 400, align: 'start', fill: { role: 'ground' }, frames: { main: { rect: { x: 450, y: 440, w: 271, h: 48 }, rot: 0 } } } as DocNode;
  const d: KuraDoc = { version: 2, id: 'd', createdAt: '', palette: p, ground: null, sizes: [{ id: 'main', ratio: 'square', guide: null, comp: null }], nodes: [frameNode, label] };
  expect(contrast(resolve((keepReadable(d).nodes[1] as TextNode).fill, p), resolve({ role: 'ground' }, p))).toBeGreaterThanOrEqual(4.5);
});
it('keeps two lines of body clear of the accent block in split layouts (D-090)', () => {
  for (const ratio of ['square', 'portrait', 'tall', 'pin', 'a4', 'landscape', 'link'] as const) for (const guide of ['thirds', 'golden', 'divisions'] as const) {
    const c = canvasSize(ratio), slots = layout({ canvas: c, guide, comp: 'split', measure: fakeMeasure, headline: 'Headline', body: 'Body text' }), ts = typeScale(guide, c);
    expect(slots.body.rect.y + textHeight(2, ts.body)).toBeLessThanOrEqual(slots.accent.y + 1e-6);
    expect(slots.headline.rect.y).toBeGreaterThanOrEqual(layoutPad(c) - 1e-6);
  }
});
it('re-picks a free label’s black or white only when it has become nearly invisible where it sits (D-090)', () => {
  const p: Palette = { hue: 120, dark: true, custom: [] }, at = (fill: object) => ({ id: 'l', kind: 'text', text: 'Dragged off', weight: 400, align: 'start', fill, frames: { main: { rect: { x: 50, y: 600, w: 200, h: 30 }, rot: 0 } } }) as DocNode;
  const d = (fill: object): KuraDoc => ({ version: 2, id: 'd', createdAt: '', palette: p, ground: null, sizes: [{ id: 'main', ratio: 'square', guide: null, comp: null }], nodes: [at(fill)] });
  const ground = resolve({ role: 'ground' }, p), out = keepReadable(d({ hex: '#000000' })).nodes[0] as TextNode;
  expect(contrast(resolve(out.fill, p), ground)).toBeGreaterThanOrEqual(4.5);
  expect(keepReadable(d({ hex: '#ffffff' })).nodes[0]).toMatchObject({ fill: { hex: '#ffffff' } });
});
