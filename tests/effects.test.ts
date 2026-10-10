import { describe, it, expect } from 'vitest';
import { validateDocument, type DocNode } from '../src/core/document';
import { placement, fromPlacement, coverPlacement, rebase, coverCrop, collageCells } from '../src/core/images';
import { textBox, typeScale, displayText, textStyle, fitText, LINE_HEIGHT } from '../src/core/fit';
import { fontStack, fontById, FONTS } from '../src/core/script';
import { buildScene, gradientLine, rgba } from '../src/core/scene';
import { svg } from '../src/core/export';
import { scalePath } from '../src/core/shapes';
import { resolve } from '../src/core/palette';
import { rotatePoint, center, type Measure, type TextStyle } from '../src/core/geometry';
import { doc, frame, rectNode, textNode, fakeMeasure } from './helpers';
const f = frame(10, 20, 300, 200), shadow = { x: 4, y: 6, blur: 10, fill: { role: 'ink' as const }, alpha: .5 }, outline = { fill: { role: 'accent' as const }, width: 3 };
const image = (extra: object = {}): DocNode => ({ id: 'i', kind: 'image', asset: 'a', frames: { main: f }, ...extra } as DocNode);
describe('document fields for photo editing and design (D-045)', () => {
  it('accepts every new optional field', () => {
    const nodes: DocNode[] = [
      textNode('t', f, 'Hi', { font: 'playfair-display', italic: true, underline: true, upper: true, spacing: -200, leading: 3, outline, group: 'g', opacity: 0, shadow, flipX: true, flipY: false } as Partial<DocNode>),
      rectNode('r', f, { gradient: { to: { hex: '#ff0000' }, angle: -45 }, outline, group: 'g' } as Partial<DocNode>),
      image({ zoom: 10, adjust: { brightness: -100, blur: 100, vignette: 0 }, duotone: { dark: { role: 'ink' }, light: { row: 'base', step: 0 } }, mask: 'heart', outline }),
      { id: 'k', kind: 'ink', paths: [[[0, 0]]], stroke: 2, fill: { role: 'ink' }, shadow, opacity: 1, frames: { main: f } },
    ];
    expect(validateDocument(doc(nodes))).toBe(true);
  });
  it('rejects out-of-range or misplaced values', () => {
    const t = textNode('t', f), r = rectNode('r', f), i = image(), k: DocNode = { id: 'k', kind: 'ink', paths: [[[0, 0]]], stroke: 2, fill: { role: 'ink' }, frames: { main: f } };
    const bad: unknown[] = [{ ...r, group: '' }, { ...r, group: 3 }, { ...r, opacity: 1.5 }, { ...r, opacity: -.1 }, { ...r, shadow: { ...shadow, alpha: 2 } }, { ...r, shadow: { ...shadow, blur: -1 } }, { ...r, shadow: { ...shadow, fill: 'x' } },
      { ...r, shadow: 'x' }, { ...r, flipX: 1 }, { ...r, flipY: 'y' }, { ...r, outline: { ...outline, width: 0 } }, { ...r, outline: { width: 2, fill: {} } }, { ...k, outline },
      { ...r, gradient: { to: { role: 'ink' }, angle: NaN } }, { ...r, gradient: { to: 'x', angle: 0 } },
      { ...t, font: 'comic' }, { ...t, italic: 1 }, { ...t, underline: 'x' }, { ...t, upper: 0 }, { ...t, spacing: 900 }, { ...t, spacing: -201 }, { ...t, leading: .4 }, { ...t, leading: 3.1 },
      { ...i, zoom: .9 }, { ...i, zoom: 11 }, { ...i, adjust: { sharpness: 5 } }, { ...i, adjust: { blur: -1 } }, { ...i, adjust: { brightness: 101 } }, { ...i, adjust: 'x' },
      { ...i, duotone: { dark: { role: 'ink' } } }, { ...i, duotone: 3 }, { ...i, mask: 'nothing' }, { ...i, mask: 4 }];
    for (const n of bad) expect(validateDocument(doc([n as DocNode]))).toBe(false);
  });
});
describe('crop placement (D-045)', () => {
  const natural = { w: 800, h: 1000 }, frameSize = { w: 333, h: 1000 };
  it('places the whole picture for a cover crop, a zoom and a focus, and inverts it', () => {
    expect(placement(natural, frameSize)).toEqual({ x: -233.5, y: 0, w: 800, h: 1000 });
    expect(coverCrop(natural, frameSize, { x: .5, y: .5 }, 2)).toEqual({ x: 316.75, y: 250, w: 166.5, h: 500 });
    const p = placement(natural, frameSize, { x: .3, y: .6 }, 2.5), back = fromPlacement(natural, frameSize, p);
    expect(back.zoom).toBeCloseTo(2.5); expect(back.focus.x).toBeCloseTo(.3); expect(back.focus.y).toBeCloseTo(.6);
    expect(fromPlacement(natural, frameSize, { x: 0, y: 0, w: 799, h: 999 }).zoom).toBe(1);
    expect(fromPlacement(natural, frameSize, { x: 900, y: -5000, w: 800, h: 1000 }).focus).toEqual({ x: 0, y: 1 });
  });
  it('grows and shifts a placement until it covers the frame', () => {
    expect(coverPlacement({ w: 100, h: 100 }, { x: 10, y: -20, w: 200, h: 200 })).toEqual({ x: 0, y: -20, w: 200, h: 200 });
    expect(coverPlacement({ w: 100, h: 100 }, { x: -150, y: 0, w: 200, h: 200 })).toEqual({ x: -100, y: 0, w: 200, h: 200 });
    expect(coverPlacement({ w: 100, h: 100 }, { x: 0, y: 0, w: 50, h: 25 })).toEqual({ x: -75, y: 0, w: 200, h: 100 });
  });
  it('keeps the picture fixed on the page when the frame moves, rotated or not', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 }, b = { x: 20, y: 0, w: 80, h: 100 }, p = { x: -50, y: -10, w: 200, h: 150 };
    expect(rebase(p, a, b, 0)).toEqual({ x: -70, y: -10, w: 200, h: 150 });
    const q = rebase(p, a, b, 30), page = (r: typeof a, pl: typeof p) => rotatePoint({ x: r.x + pl.x, y: r.y + pl.y }, center(r), 30);
    expect(page(b, q).x).toBeCloseTo(page(a, p).x); expect(page(b, q).y).toBeCloseTo(page(a, p).y);
  });
});
describe('text styles (D-045)', () => {
  const scale = typeScale('thirds', { w: 1000, h: 1000 });
  it('measures with the face, italic and spacing, draws uppercase and spaces lines', () => {
    const calls: (TextStyle | undefined)[] = [], spy: Measure = (t, s, w, width, style) => { calls.push(style); return fakeMeasure(t, s, w, width); };
    const n = textNode('t', f, 'one two', { font: 'caveat', italic: true, spacing: 100, upper: true, leading: 2 } as Partial<DocNode>);
    const box = textBox(n as never, frame(0, 0, 60, 10, { fontSize: 50 }), spy, scale);
    expect(box.lines).toEqual(['ONE', 'TWO']); expect(box.rect.h).toBe(200); expect(calls[0]).toEqual({ font: 'caveat', italic: true, spacing: 100 });
    const fitted = textBox({ ...(n as object), fit: true } as never, frame(0, 0, 60, 400, { fontSize: 50 }), spy, scale);
    expect(fitted.size).toBe(50); expect(calls.at(-1)).toEqual({ font: 'caveat', italic: true, spacing: 100 });
    expect(fitText({ text: 'a', weight: 400, width: 100, height: 100, size: 20, scale, measure: spy }).lines).toEqual(['a']); expect(calls.at(-1)).toBeUndefined();
    expect(displayText({ text: 'straße', upper: true })).toBe('STRASSE'); expect(textStyle({ font: 'space-grotesk' })).toBeUndefined();
    expect(textBox(textNode('p', f, 'x') as never, frame(0, 0, 60, 10, { fontSize: 10 }), fakeMeasure, scale).rect.h).toBeCloseTo(10 * LINE_HEIGHT);
  });
  it('stacks each face in front of the script fallbacks', () => {
    expect(fontStack('Hello')).toBe('"Space Grotesk", system-ui, sans-serif'); expect(fontStack('Hello', 'space-grotesk')).toBe(fontStack('Hello'));
    expect(fontStack('مرحبا', 'playfair-display').startsWith('"Playfair Display", "Space Grotesk", "Noto Sans Arabic"')).toBe(true);
    expect(fontById('nope').id).toBe('space-grotesk'); expect(FONTS).toHaveLength(6);
  });
});
describe('effects in the scene and SVG (D-045)', () => {
  const p = doc().palette;
  const nodes = (): DocNode[] => [
    rectNode('r', frame(0, 0, 200, 100), { gradient: { to: { role: 'ink' }, angle: 90 }, outline, opacity: .5, shadow } as Partial<DocNode>),
    { id: 's', kind: 'shape', shape: 'heart', fill: { role: 'ink' }, outline, flipX: true, frames: { main: frame(0, 0, 200, 100) } },
    textNode('t', frame(0, 0, 600, 10, { fontSize: 20 }), 'Hi', { italic: true, underline: true, spacing: 100, leading: 2, outline, font: 'bebas-neue', flipY: true } as Partial<DocNode>),
    image({ zoom: 2, adjust: { warmth: 30 }, mask: 'circle', outline, focus: { x: .5, y: .5 } }), image({ id: 'j' }),
    { id: 'k', kind: 'ink', paths: [[[0, 0], [1, 1]]], stroke: 2, fill: { role: 'ink' }, opacity: 1, frames: { main: frame(0, 0, 10, 10) } },
  ];
  it('resolves effects onto ops only when set', () => {
    const s = buildScene(doc(nodes()), 'main', fakeMeasure), [r, h, t, i, j, k] = s.ops;
    expect(r).toMatchObject({ gradient: { from: resolve({ role: 'accent' }, p), to: resolve({ role: 'ink' }, p), angle: 90 }, fx: { opacity: .5, shadow: { x: 4, y: 6, blur: 10, colour: resolve({ role: 'ink' }, p), alpha: .5 }, outline: { colour: resolve({ role: 'accent' }, p), width: 3 } } });
    expect(h.fx).toEqual({ flip: [true, false], outline: { colour: resolve({ role: 'accent' }, p), width: 3 } });
    expect(t).toMatchObject({ italic: true, underline: true, spacing: 2, lineHeight: 40, font: '"Bebas Neue", "Space Grotesk", system-ui, sans-serif', fx: { flip: [false, true] } });
    expect(i).toMatchObject({ zoom: 2, look: { adjust: { warmth: 30 } }, mask: { d: expect.stringContaining('A150 100') } });
    expect(Object.keys(j)).toEqual(['kind', 'id', 'rect', 'rot', 'asset', 'cutout', 'focus']); expect(k.fx).toBeUndefined();
    expect(rgba('#102030', .5)).toBe('rgba(16,32,48,0.5)');
    expect(gradientLine(200, 100, 0)).toEqual([0, 50, 200, 50]); expect(gradientLine(200, 100, 90).map(v => Math.round(v * 1e6) / 1e6 + 0)).toEqual([100, 0, 100, 100]);
  });
  it('writes gradients, borders, masks, shadows, opacity, flips and text styles into SVG', () => {
    const s = buildScene(doc(nodes()), 'main', fakeMeasure), out = svg(s, { pixels: { w: 100, h: 100 }, ground: false, licences: [], image: o => o.id === 'i' ? { href: 'data:x', natural: { w: 400, h: 400 } } : undefined });
    expect(out).toContain('<defs><linearGradient id="k1" gradientUnits="userSpaceOnUse" x1="100" y1="0" x2="100" y2="100">');
    expect(out).toContain('<g opacity="0.5" filter="url(#k3)">'); expect(out).toContain('<feDropShadow dx="4" dy="6" stdDeviation="5"');
    expect(out).toContain('fill="url(#k1)"'); expect(out).toContain('stroke-width="6" clip-path="url(#k2)"');
    expect(out).toContain('rotate(0) scale(-1 1) translate'); expect(out).toContain('rotate(0) scale(1 -1) translate');
    expect(out).toContain('font-style="italic" text-decoration="underline" letter-spacing="2" stroke="'); expect(out).toContain('paint-order="stroke"');
    expect(out).toContain('<clipPath id="k5"><path d="M0 100A150 100'); expect(out).toContain('<g clip-path="url(#k5)"><svg width="300" height="200" viewBox="100 133.33 200 133.33"');
    expect(svg({ ...s, ops: [s.ops[4]] }, { pixels: { w: 1, h: 1 }, ground: false, licences: [], image: () => undefined })).not.toContain('<defs>');
  });
  it('scales path coordinates for even strokes', () => {
    expect(scalePath('M0 0L100 50H20V10C1 2 3 4 5 6A10 20 30 1 0 40 50ZM1.5-2e1q1 2 3 4', 2, 3)).toBe('M0 0L200 150H40V30C2 6 6 12 10 18A20 60 30 1 0 80 150ZM3 -60q2 6 6 12');
    expect(scalePath('', 2, 2)).toBe('');
  });
});
describe('collage (D-045)', () => {
  it('gives each dropped photo its own cell, nearest first, then steps past the last', () => {
    const cells = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => ({ x: c * 100, y: r * 100, w: 100, h: 100 }))), quads = [{ x: 0, y: 0, w: 150, h: 150 }];
    expect(collageCells({ x: 10, y: 10 }, cells, 3, { w: 300, h: 300 })).toEqual([cells[0], cells[1], cells[3]]);
    expect(collageCells({ x: 10, y: 10 }, quads, 2, { w: 300, h: 300 })).toEqual([quads[0], { x: 20, y: 20, w: 150, h: 150 }]);
    expect(collageCells({ x: 10, y: 10 }, [], 1, { w: 300, h: 300 })).toEqual([{ x: 75, y: 75, w: 150, h: 150 }]);
  });
});
