import { describe, it, expect } from 'vitest';
import { layout, starterNodes, compositionFit, slotRect, STARTER } from '../src/core/compositions';
import { compIds, guideIds, ratioIds, validateDocument } from '../src/core/document';
import { canvasSize } from '../src/core/ratios';
import { fractionsOf } from '../src/core/guides';
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
