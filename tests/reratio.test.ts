import { describe, it, expect } from 'vitest';
import { reRatio, reRatioFrames, reRatioKept, anchorLines, flagsFor, boxOf, letterBounds } from '../src/core/reratio';
import { relayout } from '../src/core/relayout';
import { addSize, removeSize, closestSize } from '../src/core/sizes';
import { layout, starterNodes } from '../src/core/compositions';
import { canvasSize } from '../src/core/ratios';
import { validateDocument, type DocNode, type KuraDoc, type TextNode } from '../src/core/document';
import { textBox, typeScale } from '../src/core/fit';
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
  it('flags text by its letters, not by an empty stretch of its box past the edge (D-077)', () => {
    // fakeMeasure: 0.6 em a character; "Opal" at 40 is 96 wide in a 300-wide box starting at 800.
    const t = textNode('t', frame(800, 0, 300, 46, { fontSize: 40 }), 'Opal'), canvas = { w: 1000, h: 1000 };
    expect(flagsFor(t, t.frames.main, fakeMeasure, canvas, null)).toEqual([]);
    expect(letterBounds(t, t.frames.main, fakeMeasure, canvas, null)).toMatchObject({ x: 800, y: 0, h: 46 });
    expect(letterBounds({ ...t, align: 'end' }, t.frames.main, fakeMeasure, canvas, null).x).toBeCloseTo(1100 - letterBounds(t, t.frames.main, fakeMeasure, canvas, null).w, 5);
    expect(flagsFor({ ...t, align: 'end' }, t.frames.main, fakeMeasure, canvas, null)).toEqual([{ id: 't', kind: 'off-canvas' }]);
    expect(flagsFor({ ...t, align: 'center' }, { ...t.frames.main, rect: { ...t.frames.main.rect, x: 760 } }, fakeMeasure, canvas, null)).toEqual([]);
    const turned = { ...t.frames.main, rot: 90, rect: { ...t.frames.main.rect, x: 700 } }, b = letterBounds(t, turned, fakeMeasure, canvas, null);
    expect(b.w).toBeCloseTo(46, 5); expect(b.h).toBeLessThan(100);
  });
  it('keeps an icon square when its edges sit on guide lines (D-077)', () => {
    const icon = { ...rectNode('i', frame(1000 / 3, 1000 / 3, 1000 / 3, 1000 / 3)), shape: 'icon', icon: { set: 'phosphor', name: 'star', d: 'M0 0Z', licence: 'MIT' } };
    const left = { ...icon, id: 'l', frames: { main: frame(1000 / 3, 400, 100, 100) } }, free = { ...icon, id: 'f', frames: { main: frame(400, 400, 100, 100) } };
    const d = doc([icon, left, free]);
    for (const ratio of ['cover', 'story', 'link'] as const) {
      const out = reRatio(d, 'main', { ratio }, fakeMeasure).doc, c = canvasSize(ratio);
      for (const n of out.nodes) expect(n.frames.main.rect.w / n.frames.main.rect.h, `${ratio} ${n.id}`).toBeCloseTo(1, 6);
      // The centred icon stays centred in its cell; the one pinned on the left line keeps that edge.
      const r = out.nodes[0].frames.main.rect; expect(r.x + r.w / 2).toBeCloseTo(c.w / 2, 6); expect(r.y + r.h / 2).toBeCloseTo(c.h / 2, 6);
      expect(out.nodes[1].frames.main.rect.x).toBeCloseTo(c.w / 3, 6);
    }
  });
  it('keeps a loose picture’s proportions but lets a layout picture take its slot (D-081)', () => {
    const logo: DocNode = { id: 'logo', kind: 'image', asset: 'a', frames: { main: frame(600, 30, 318, 95) } }, slotted: DocNode = { id: 's', kind: 'image', asset: 'b', slot: 'image', frames: { main: frame(0, 0, 1000 / 3, 250) } };
    const out = reRatio(doc([logo, slotted], size({ ratio: 'cover' })), 'main', { ratio: 'square' }, fakeMeasure).doc;
    const l = out.nodes[0].frames.main.rect, sl = out.nodes[1].frames.main.rect;
    expect(l.w / l.h).toBeCloseTo(318 / 95, 6); expect(sl.w / sl.h).not.toBeCloseTo(1000 / 3 / 250, 1);
  });
  it('grows text by the body-type ratio going from a wide size to a taller one, and shrinks with the geometry (D-081)', () => {
    const t = textNode('t', frame(100, 100, 300, 20, { fontSize: 16.7 }), 'Hi'), header = doc([t], size({ ratio: 'cover' }));
    const post = reRatio(header, 'main', { ratio: 'square' }, fakeMeasure).doc.nodes[0].frames.main;
    expect(post.fontSize).toBeCloseTo(16.7 * 28 / 15, 6); expect(post.rect.w).toBeCloseTo(300 * 28 / 15, 6);
    // Shrinking follows the geometry down to three fifths of the Header's body type (15), so it stays legible (D-087).
    const back = reRatio(doc([t]), 'main', { ratio: 'cover' }, fakeMeasure).doc.nodes[0].frames.main;
    expect(back.fontSize).toBeCloseTo(9, 6);
    const big = reRatio(doc([{ ...t, frames: { main: { ...t.frames.main, fontSize: 80 } } }]), 'main', { ratio: 'cover' }, fakeMeasure).doc.nodes[0].frames.main;
    expect(big.fontSize).toBeCloseTo(20, 6);
  });
  it('keeps a stack of left- or right-aligned labels aligned in a new ratio (D-082)', () => {
    const d = doc([textNode('a', frame(120, 400, 300, 23, { fontSize: 20 }), 'Teams of 4'), textNode('b', frame(120, 440, 160, 23, { fontSize: 20 }), 'RSVP'),
      textNode('c', frame(520, 400, 300, 23, { fontSize: 20 }), 'Right', { align: 'end' } as Partial<DocNode>), textNode('e', frame(660, 440, 160, 23, { fontSize: 20 }), 'Too', { align: 'end' } as Partial<DocNode>)]);
    const out = reRatio(d, 'main', { ratio: 'cover' }, fakeMeasure).doc.nodes.map(n => n.frames.main.rect);
    expect(out[0].x).toBeCloseTo(out[1].x, 6); expect(out[2].x + out[2].w).toBeCloseTo(out[3].x + out[3].w, 6);
  });
  it('keeps grown text inside its right margin going from a Header to a Post (D-083)', () => {
    const d = doc([textNode('t', frame(345, 100, 640, 20, { fontSize: 15 }), 'Careers fair 2026 meet forty employers')], size({ ratio: 'cover' }));
    const out = reRatio(d, 'main', { ratio: 'square' }, fakeMeasure).doc, r = out.nodes[0].frames.main.rect;
    // The Header's thin margin becomes the Post's layout margin (45); the one-line label slides back to stay one line (D-087).
    expect(r.x + r.w).toBeLessThanOrEqual(1000 - 45 + 1e-6); expect(r.x).toBeLessThan(345);
    expect(textBox(out.nodes[0] as TextNode, out.nodes[0].frames.main, fakeMeasure, typeScale('thirds', { w: 1000, h: 1000 })).lines).toHaveLength(1);
    // Copy too long for one line in the Post keeps its place and wraps at the margin.
    const long = doc([textNode('t', frame(345, 100, 640, 20, { fontSize: 9 }), 'Careers fair 2026 meet forty employers in the Roundhouse')], size({ ratio: 'cover' }));
    const q = reRatio(long, 'main', { ratio: 'square' }, fakeMeasure).doc.nodes[0].frames.main.rect;
    expect(q.x).toBeCloseTo(345, 6); expect(q.x + q.w).toBeCloseTo(955, 6);
  });
  it('gives text at a Header’s thin left margin the Post’s layout margin (D-086)', () => {
    const d = doc([textNode('t', frame(11.25, 150, 900, 20, { fontSize: 15 }), 'Careers fair 2026 meet forty employers')], size({ ratio: 'cover' }));
    const r = reRatio(d, 'main', { ratio: 'square' }, fakeMeasure).doc.nodes[0].frames.main.rect;
    expect(r.x).toBeCloseTo(45, 6); expect(r.x + r.w).toBeLessThanOrEqual(955 + 1e-6);
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
  it('treats retyped text whose height followed its lines as untouched (D-077)', () => {
    const d = start(); let r = reRatioKept(d, 'main', { ratio: 'cover' }, fakeMeasure);
    const retyped = { ...r.doc, nodes: r.doc.nodes.map(n => n.id === 't' ? { ...n, text: 'Hi', frames: { main: { ...n.frames.main, rect: { ...n.frames.main.rect, h: 3 } } } } : n) };
    r = reRatioKept(retyped, 'main', { ratio: 'square' }, fakeMeasure, r.origin);
    expect(r.doc.nodes[2].frames.main).toEqual(d.nodes[2].frames.main);
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
describe('ratio origins survive a nudge (D-076)', () => {
  it('maps a moved node from its origin size, moved by the same share of the canvas', () => {
    const d = doc([rectNode('b', frame(100, 100, 200, 200))]);
    let r = reRatioKept(d, 'main', { ratio: 'story' }, fakeMeasure);
    const story = r.doc.nodes[0].frames.main.rect, h = canvasSize('story').h;
    const nudged = { ...r.doc, nodes: r.doc.nodes.map(n => ({ ...n, frames: { main: { ...n.frames.main, rect: { ...story, y: story.y + h / 10 } } } })) };
    r = reRatioKept(nudged, 'main', { ratio: 'square' }, fakeMeasure, r.origin);
    expect(r.doc.nodes[0].frames.main.rect).toEqual({ x: 100, y: 200, w: 200, h: 200 });
  });
});
describe('band text colour on relayout (D-076)', () => {
  it('turns band black or white back into ink off the band, and keeps a chosen colour', () => {
    const spec = size({ ratio: 'portrait', guide: 'golden', comp: 'poster' }), palette = { hue: 120, dark: false, custom: [] };
    const nodes = starterNodes(layout({ canvas: canvasSize('portrait'), guide: 'golden', comp: 'poster', measure: fakeMeasure, headline: 'H', body: 'B' }), { sizeId: 'main', newId: ids(), palette });
    const d: KuraDoc = { ...doc(nodes, spec), palette };
    expect(d.nodes.find(n => n.slot === 'body')).toMatchObject({ fill: { hex: '#000000' } });
    const out = relayout(d, 'main', { ratio: 'portrait', guide: 'golden', comp: 'cover' }, fakeMeasure).doc;
    expect(out.nodes.find(n => n.slot === 'body')).toMatchObject({ fill: { role: 'ink' } });
    const mine = { ...d, nodes: d.nodes.map(n => n.slot === 'body' ? { ...n, fill: { hex: '#123456' } } : n) };
    expect(relayout(mine, 'main', { ratio: 'portrait', guide: 'golden', comp: 'cover' }, fakeMeasure).doc.nodes.find(n => n.slot === 'body')).toMatchObject({ fill: { hex: '#123456' } });
  });
});
describe('linked sizes keep labels whole and text clear (D-087)', () => {
  const scale = (r: 'square' | 'cover' | 'banner' | 'landscape' | 'link') => typeScale('thirds', canvasSize(r));
  it('keeps a row of one-line labels on one line in a Banner and a Slide made from a Header', () => {
    const words = ['Analytics', 'Content', 'Social'], d = doc(words.map((w, i) => textNode(`l${i}`, frame(600 + i * 120, 140, w.length * 18 * .6 * 1.02, 21, { fontSize: 18 }), w)), size({ ratio: 'cover' }));
    for (const ratio of ['banner', 'landscape'] as const) {
      const out = addSize(d, ratio, 'b', fakeMeasure).doc;
      for (const n of out.nodes) expect(textBox(n as TextNode, n.frames.b, fakeMeasure, scale(ratio)).lines).toHaveLength(1);
    }
  });
  it('moves text that stood under a growing headline down to keep clear, on the same backing only', () => {
    const d = doc([textNode('h', frame(45, 40, 700, 58, { fontSize: 50.5 }), 'Đêm hội Trăng Rằm 2026', { slot: 'headline' } as Partial<DocNode>),
      textNode('b', frame(45, 110, 600, 23, { fontSize: 20 }), 'Hội trường lớn', { slot: 'body' } as Partial<DocNode>)], size({ ratio: 'banner' }));
    const out = addSize(d, 'link', 'k', fakeMeasure).doc, [h, b] = out.nodes, hb = textBox(h as TextNode, h.frames.k, fakeMeasure, scale('link'));
    expect(b.frames.k.rect.y).toBeGreaterThanOrEqual(hb.rect.y + hb.rect.h - 1e-6);
    // Text on a band under the headline is not pushed by it.
    const band = rectNode('band', frame(0, 100, 1000, 233)), onBand = doc([band, ...d.nodes], size({ ratio: 'banner' }));
    const kept = addSize(onBand, 'link', 'k', fakeMeasure).doc, kh = textBox(kept.nodes[1] as TextNode, kept.nodes[1].frames.k, fakeMeasure, scale('link'));
    expect(kept.nodes[2].frames.k.rect.y).toBeLessThan(kh.rect.y + kh.rect.h);
  });
});
