import { describe, it, expect } from 'vitest';
import { reRatio, reRatioFrames, reRatioKept, anchorLines, flagsFor, boxOf } from '../src/core/reratio';
import { relayout } from '../src/core/relayout';
import { addSize, removeSize, closestSize } from '../src/core/sizes';
import { layout, starterNodes } from '../src/core/compositions';
import { canvasSize } from '../src/core/ratios';
import { validateDocument, type KuraDoc } from '../src/core/document';
import { fakeMeasure, doc, frame, rectNode, textNode, ids, size } from './helpers';
describe('re-ratio (5v)', () => {
  it('lists edge, centre and guide lines per axis', () => {
    const l = anchorLines({ w: 1000, h: 500 }, 'thirds');
    expect(l.x.map(a => a.id)).toEqual(['edge-left', 'centre-x', 'edge-right', 'line-x-1', 'line-x-2']);
    expect(l.y.find(a => a.id === 'line-y-2')!.at).toBeCloseTo(1000 / 3);
    expect(anchorLines({ w: 10, h: 10 }, null).x).toHaveLength(3);
  });
  it('keeps edges on the same guide intersection and scales the rest about the centre', () => {
    const d = doc([rectNode('a', frame(1000 / 3, 1000 / 3, 1000 / 3, 1000 / 3)), rectNode('b', frame(100, 100, 50, 50)), rectNode('c', frame(0, 900, 200, 100))]);
    const { doc: out, flags } = reRatio(d, 'main', { ratio: 'story' }, fakeMeasure);
    const h = canvasSize('story').h;
    expect(out.nodes[0].frames.main.rect).toEqual({ x: 1000 / 3, y: h / 3, w: 1000 / 3, h: h / 3 });
    expect(out.nodes[1].frames.main.rect).toEqual({ x: 100, y: 125 * h / 1000 - 25, w: 50, h: 50 });
    expect(out.nodes[2].frames.main.rect).toEqual({ x: 0, y: h - 100, w: 200, h: 100 });
    expect(flags).toEqual([]); expect(out.sizes[0]).toMatchObject({ ratio: 'story', guide: 'thirds' });
    expect(validateDocument(out)).toBe(true);
  });
  it('shrinks by the smaller axis factor, rescales text and pins text to a bottom line', () => {
    const d = doc([textNode('t', frame(0, 0, 1000, 40, { fontSize: 40 }), 'Hi')]);
    const { doc: out } = reRatio(d, 'main', { ratio: 'banner' }, fakeMeasure);
    const f = out.nodes[0].frames.main;
    expect(f.fontSize).toBeCloseTo(40 / 3); expect(f.rect.w).toBe(1000); expect(f.rect.x).toBe(0); expect(f.rect.y).toBe(0);
    const bottom = doc([textNode('t', frame(10, 1000 - 46, 500, 46, { fontSize: 40 }), 'Hi')]);
    const moved = reRatio(bottom, 'main', { ratio: 'portrait' }, fakeMeasure).doc.nodes[0].frames.main;
    expect(moved.rect.y + moved.rect.h).toBeCloseTo(1250);
  });
  it('flags anything off the canvas or overflowing instead of cropping', () => {
    const d = doc([rectNode('off', frame(0, 900, 100, 400)), textNode('t', frame(0, 0, 100, 30, { fontSize: 28 }), 'word '.repeat(40).trim(), { fit: true }), rectNode('hidden', frame(-500, 0, 10, 10, { hidden: true }))]);
    const { flags } = reRatio(d, 'main', { ratio: 'portrait', guide: 'golden' }, fakeMeasure);
    expect(flags).toEqual([{ id: 'off', kind: 'off-canvas' }, { id: 't', kind: 'off-canvas' }, { id: 't', kind: 'overflow' }]);
    expect(flagsFor(d.nodes[0], frame(0, -10, 5, 5, { rot: 0 }), fakeMeasure, { w: 1000, h: 1000 }, null)).toEqual([{ id: 'off', kind: 'off-canvas' }]);
    expect(boxOf(d.nodes[0], d.nodes[0].frames.main, fakeMeasure, { w: 1000, h: 1000 }, null)).toEqual(d.nodes[0].frames.main.rect);
  });
  it('treats rotated nodes as free and changes the guide when asked', () => {
    const d = doc([rectNode('r', frame(0, 0, 100, 100, { rot: 30 }))]);
    const out = reRatioFrames(d, d.sizes[0], { ratio: 'landscape', guide: null }, fakeMeasure);
    expect(out.frames.r.rect.x).toBeCloseTo(50 - 56.25 / 2); expect(out.frames.r.rot).toBe(30);
    expect(reRatio(d, 'main', { ratio: 'square', guide: null }).doc.sizes[0].guide).toBeNull();
  });
});
describe('relayout (5f)', () => {
  const start = () => {
    const spec = size({ ratio: 'portrait', guide: 'golden', comp: 'cover' });
    const nodes = starterNodes(layout({ canvas: canvasSize('portrait'), guide: 'golden', comp: 'cover', measure: fakeMeasure, headline: 'Headline', body: 'Body text' }), { sizeId: 'main', newId: ids() });
    return doc([...nodes, rectNode('free', frame(100, 100, 50, 50))], spec);
  };
  it('moves slot-tagged nodes into the new layout and keeps their content', () => {
    const d = start(); (d.nodes[2] as { text: string }).text = 'My title';
    const { doc: out, moves } = relayout(d, 'main', { ratio: 'square', guide: 'thirds', comp: 'split' }, fakeMeasure);
    const target = layout({ canvas: canvasSize('square'), guide: 'thirds', comp: 'split', measure: fakeMeasure, headline: 'My title', body: 'Body text' });
    expect(out.nodes[0].frames.main.rect).toEqual(target.image); expect(out.nodes[1].frames.main.rect).toEqual(target.accent);
    expect(out.nodes[2].frames.main).toMatchObject({ rect: target.headline.rect, fontSize: target.headline.fontSize });
    expect(out.nodes[2]).toMatchObject({ text: 'My title' }); expect(out.sizes[0]).toEqual({ id: 'main', ratio: 'square', guide: 'thirds', comp: 'split' });
    expect(moves).toHaveLength(5); expect(moves[0].from).toBe(d.nodes[0].frames.main);
    expect(validateDocument(out)).toBe(true);
  });
  it('turns autofit on for a headline moved into a poster room (D-055)', () => {
    const { doc: out } = relayout(start(), 'main', { ratio: 'a4', guide: 'golden', comp: 'poster' }, fakeMeasure);
    expect(out.nodes.find(n => n.slot === 'headline')).toMatchObject({ fit: true });
    expect(out.nodes.find(n => n.slot === 'body')).not.toHaveProperty('fit');
    const again = relayout(out, 'main', { ratio: 'a4', guide: 'golden', comp: 'stack' }, fakeMeasure).doc;
    expect(again.nodes.find(n => n.slot === 'headline')).toMatchObject({ fit: true });
  });
  it('re-ratios untagged nodes, leaves a slot without a node empty, and lets only the first claimant take a slot', () => {
    const d = start(); d.nodes.splice(0, 1);
    d.nodes.push({ ...d.nodes[0], id: 'dup' } as KuraDoc['nodes'][number]);
    const { doc: out } = relayout(d, 'main', { ratio: 'square', guide: 'thirds', comp: 'poster' }, fakeMeasure);
    expect(out.nodes.some(n => n.kind === 'image')).toBe(false);
    expect(out.nodes.find(n => n.id === 'dup')!.frames.main.rect).not.toEqual(out.nodes[0].frames.main.rect);
    const noText = doc([rectNode('a', frame(0, 0, 10, 10), { slot: 'accent' })], size({ comp: 'cover' }));
    expect(relayout(noText, 'main', { ratio: 'square', guide: 'thirds', comp: 'band' }, fakeMeasure).doc.nodes[0].frames.main.rect.w).toBeCloseTo(45 * 3);
  });
});
describe('linked sizes (5w)', () => {
  it('adds a size seeded by re-ratio and removes it again, keeping the last one', () => {
    const d = doc([rectNode('a', frame(0, 0, 1000, 1000 / 3)), textNode('t', frame(0, 0, 500, 40, { fontSize: 40 }))]);
    const { doc: two, flags } = addSize(d, 'story', 's2', fakeMeasure);
    expect(two.sizes.map(s => [s.id, s.ratio, s.guide])).toEqual([['main', 'square', 'thirds'], ['s2', 'story', 'thirds']]);
    expect(two.nodes[0].frames.s2.rect.h).toBeCloseTo(canvasSize('story').h / 3); expect(flags).toEqual([]);
    expect(validateDocument(two)).toBe(true);
    const one = removeSize(two, 's2'); expect(one.sizes).toHaveLength(1); expect(Object.keys(one.nodes[0].frames)).toEqual(['main']);
    expect(removeSize(one, 'main')).toBe(one); expect(removeSize(two, 'nope')).toBe(two);
    expect(addSize(two, 'banner', 's3', fakeMeasure, 's2').doc.sizes[2].ratio).toBe('banner');
  });
});
describe('change ratio without drift (D-054)', () => {
  const start = () => doc([rectNode('a', frame(1000 / 3, 1000 / 3, 1000 / 3, 1000 / 3)), rectNode('b', frame(100, 100, 50, 50)), textNode('t', frame(50, 600, 500, 46, { fontSize: 40 }), 'Hello there')]);
  it('returns untouched nodes exactly after a round trip through several ratios', () => {
    const d = start(); let r = reRatioKept(d, 'main', { ratio: 'story' }, fakeMeasure);
    r = reRatioKept(r.doc, 'main', { ratio: 'banner' }, fakeMeasure, r.origin);
    const banner = reRatio(reRatio(d, 'main', { ratio: 'story' }, fakeMeasure).doc, 'main', { ratio: 'banner' }, fakeMeasure).doc;
    expect(r.doc.nodes[1].frames.main.rect.w).toBeGreaterThan(banner.nodes[1].frames.main.rect.w - 1e-9);
    r = reRatioKept(r.doc, 'main', { ratio: 'square' }, fakeMeasure, r.origin);
    expect(r.doc.nodes.map(n => n.frames.main)).toEqual(d.nodes.map(n => n.frames.main));
    expect(r.doc.sizes[0].ratio).toBe('square'); expect(r.flags).toEqual([]);
  });
  it('maps an edited or new node from where it is now and keeps it there on the way back', () => {
    const d = start(); let r = reRatioKept(d, 'main', { ratio: 'story' }, fakeMeasure);
    const moved = { ...r.doc, nodes: [...r.doc.nodes.map(n => n.id === 'b' ? { ...n, frames: { main: frame(10, 10, 80, 80) } } : n), rectNode('new', frame(0, 0, 40, 40))] };
    r = reRatioKept(moved, 'main', { ratio: 'square' }, fakeMeasure, r.origin);
    expect(r.doc.nodes[0].frames.main).toEqual(d.nodes[0].frames.main);
    expect(r.doc.nodes[1].frames.main).toEqual(reRatio(moved, 'main', { ratio: 'square' }, fakeMeasure).doc.nodes[1].frames.main);
    expect(r.origin.new.ratio).toBe('story');
    expect(reRatioKept(r.doc, 'main', { ratio: 'story' }, fakeMeasure, r.origin).doc.nodes[1].frames.main).toEqual(frame(10, 10, 80, 80));
  });
  it('honours a guide change', () => {
    const r = reRatioKept(start(), 'main', { ratio: 'square', guide: 'golden' }, fakeMeasure);
    expect(r.doc.sizes[0].guide).toBe('golden'); expect(r.origin.a.guide).toBe('thirds');
  });
});
describe('linked sizes seed from the closest proportions (D-069)', () => {
  it('picks the existing size nearest in aspect', () => {
    const d: KuraDoc = doc([rectNode('a', frame(0, 0, 100, 100))], size({ ratio: 'link' }));
    const two = addSize(d, 'pin', 'tall', fakeMeasure).doc;
    expect(closestSize(two, 'tall')).toBe('tall'); expect(closestSize(two, 'cover')).toBe('main');
    expect(addSize(two, 'cover', 'c', fakeMeasure).doc.nodes[0].frames.c).toEqual(addSize(two, 'cover', 'c', fakeMeasure, 'main').doc.nodes[0].frames.c);
  });
});
