import { describe, it, expect } from 'vitest';
import { typeScale, fitText, textBox, crossing, textHeight, roomSize, LINE_HEIGHT } from '../src/core/fit';
import { PHI } from '../src/core/guides/golden';
import { fakeMeasure, charMeasure, frame } from './helpers';
import type { TextNode } from '../src/core/document';
const text = (t: string, fit?: boolean): TextNode => ({ id: 't', kind: 'text', text: t, weight: 700, align: 'start', fill: { role: 'ink' }, frames: {}, ...(fit ? { fit } : {}) });
describe('type scale', () => {
  it('uses 1.5, φ or √2 from a 28-unit body, less on short canvases', () => {
    expect(typeScale('thirds', { w: 1000, h: 1000 })).toMatchObject({ factor: 1.5, body: 28, headline: 63 });
    expect(typeScale('golden', { w: 1000, h: 1000 }).factor).toBe(PHI);
    expect(typeScale('divisions', { w: 1000, h: 1000 }).headline).toBeCloseTo(56);
    expect(typeScale(null, { w: 1000, h: 1000 }).factor).toBe(1.25);
    expect(typeScale('thirds', { w: 1000, h: 1000 / 3 }).body).toBeCloseTo(20);
    const s = typeScale('thirds', { w: 1000, h: 1000 }); expect(s.steps[0]).toBeCloseTo(28 / 1.5); expect(s.steps[1]).toBe(28); expect(s.steps).toHaveLength(8);
    expect(textHeight(0, 10)).toBeCloseTo(10 * LINE_HEIGHT); expect(textHeight(3, 10)).toBeCloseTo(30 * LINE_HEIGHT);
  });
});
describe('autofit (5q)', () => {
  const scale = typeScale('thirds', { w: 1000, h: 1000 });
  it('keeps the set size when it fits', () => {
    expect(fitText({ text: 'Hi', weight: 700, width: 500, height: 100, size: 63, scale, measure: fakeMeasure })).toEqual({ size: 63, lines: ['Hi'], overflow: false });
  });
  it('steps down the type scale until it fits', () => {
    const r = fitText({ text: 'A long event title here', weight: 700, width: 600, height: 80, size: 94.5, scale, measure: fakeMeasure });
    expect(r.overflow).toBe(false); expect([63, 42]).toContain(Math.round(r.size)); expect(textHeight(r.lines.length, r.size)).toBeLessThanOrEqual(80);
  });
  it('stops at body size and overflows past it', () => {
    const r = fitText({ text: 'word '.repeat(60).trim(), weight: 700, width: 300, height: 50, size: 63, scale, measure: fakeMeasure });
    expect(r.size).toBe(28); expect(r.overflow).toBe(true);
    expect(fitText({ text: 'word '.repeat(60).trim(), weight: 700, width: 300, height: 10, size: 12, scale, measure: fakeMeasure }).size).toBe(12);
  });
  it('derives the drawn box: plain text grows to its lines, fitted text keeps at least its box', () => {
    expect(textBox(text('one two'), frame(0, 0, 60, 999, { fontSize: 50 }), fakeMeasure, scale)).toEqual({ size: 50, lines: ['one', 'two'], overflow: false, rect: { x: 0, y: 0, w: 60, h: 2 * 50 * LINE_HEIGHT } });
    const fitted = textBox(text('Hi', true), frame(0, 0, 500, 200, { fontSize: 63 }), fakeMeasure, scale);
    expect(fitted.rect.h).toBe(200); expect(fitted.size).toBe(63);
    const grown = textBox(text('word '.repeat(60).trim(), true), frame(0, 0, 300, 50), fakeMeasure, scale);
    expect(grown.overflow).toBe(true); expect(grown.rect.h).toBeGreaterThan(50); expect(grown.size).toBe(28);
  });
  it('marks the first guide line a grown block crosses', () => {
    const lines = [{ id: 'line-y-2', at: 666 }, { id: 'line-y-1', at: 333 }, { id: 'edge-bottom', at: 1000 }];
    expect(crossing({ x: 0, y: 100, w: 10, h: 200 }, 600, lines)).toEqual({ id: 'line-y-1', at: 333 });
    expect(crossing({ x: 0, y: 100, w: 10, h: 200 }, 200, lines)).toBeNull();
  });
});
it('finds the largest size that fits a room without breaking a word (D-083)', () => {
  const o = { text: 'Spring showcase', size: 200, width: 600, height: 300, weight: 700 as const, measure: charMeasure };
  // 0.6 em per character: "showcase" (8 characters) stays whole up to 125; two lines of 1.15 em fit 300 up to 130.4.
  expect(roomSize(o)).toBe(125);
  expect(roomSize({ ...o, size: 40 })).toBe(40);
  expect(roomSize({ ...o, height: 0 })).toBe(0);
});
