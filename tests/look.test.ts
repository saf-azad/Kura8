import { describe, it, expect } from 'vitest';
import { applyLook, cleanAdjust, filterOf, lookOf, lookKey, blurRadius, FILTERS } from '../src/core/look';
import { neutralPalette } from '../src/core/document';
import { resolve } from '../src/core/palette';
/** A w × h RGBA image filled by `fn(x, y)`. */
const image = (w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(fn(x, y), (y * w + x) * 4);
  return px;
};
const at = (px: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(px.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
const flat = (rgb: [number, number, number], a = 255) => image(4, 4, () => [...rgb, a]);
const std = (v: number[]) => { const m = v.reduce((s, x) => s + x, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); };
describe('photo looks (D-045)', () => {
  it('cleans adjustments, keys looks and finds the matching filter', () => {
    expect(cleanAdjust({ brightness: 0, blur: 0 })).toBeUndefined(); expect(cleanAdjust(undefined)).toBeUndefined();
    expect(cleanAdjust({ brightness: 10, contrast: 0 })).toEqual({ brightness: 10 });
    const p = neutralPalette();
    expect(lookOf({}, p)).toBeNull(); expect(lookOf({ adjust: { blur: 0 } }, p)).toBeNull();
    expect(lookOf({ adjust: { warmth: 5 } }, p)).toEqual({ adjust: { warmth: 5 } });
    const duo = lookOf({ duotone: { dark: { role: 'ink' }, light: { role: 'ground' } } }, p)!;
    expect(duo).toEqual({ adjust: {}, duotone: [resolve({ role: 'ink' }, p), resolve({ role: 'ground' }, p)] });
    expect(lookKey(null)).toBe(''); expect(lookKey({ adjust: { warmth: 5 } })).toBe('0,0,0,5,0,0,0,0'); expect(lookKey(duo)).toContain('|#');
    expect(filterOf(undefined)).toBe('none'); expect(filterOf({ saturation: -100, contrast: 10 })).toBe('mono'); expect(filterOf({ saturation: -99 })).toBeNull();
    expect(new Set(FILTERS.map(f => f.id)).size).toBe(FILTERS.length);
    expect(blurRadius(100, 1000, 500)).toBe(30); expect(blurRadius(0, 1000, 500)).toBe(0);
  });
  it('brightens, darkens and changes contrast about mid grey', () => {
    const b = flat([100, 100, 100]); applyLook(b, 4, 4, { adjust: { brightness: 50 } }); expect(at(b, 4, 0, 0)).toEqual([160, 160, 160, 255]);
    const d = flat([100, 100, 100]); applyLook(d, 4, 4, { adjust: { brightness: -100 } }); expect(at(d, 4, 1, 1)[0]).toBe(0);
    const c = flat([178, 78, 128]); applyLook(c, 4, 4, { adjust: { contrast: 100 } }); expect(at(c, 4, 0, 0)).toEqual([253, 3, 128, 255]);
    const f = flat([178, 78, 128]); applyLook(f, 4, 4, { adjust: { contrast: -100 } }); expect(at(f, 4, 0, 0)).toEqual([128, 128, 128, 255]);
  });
  it('desaturates to grey, saturates, warms and tints, keeping alpha', () => {
    const g = flat([200, 80, 40], 90); applyLook(g, 4, 4, { adjust: { saturation: -100 } }); const [r, gg, b, a] = at(g, 4, 2, 2);
    expect(r).toBe(gg); expect(gg).toBe(b); expect(a).toBe(90);
    const s = flat([200, 80, 40]); applyLook(s, 4, 4, { adjust: { saturation: 50 } }); expect(at(s, 4, 0, 0)[0] - at(s, 4, 0, 0)[2]).toBeGreaterThan(160);
    const w = flat([100, 100, 100]); applyLook(w, 4, 4, { adjust: { warmth: 100 } }); expect(at(w, 4, 0, 0)).toEqual([130, 100, 70, 255]);
    const t = flat([100, 100, 100]); applyLook(t, 4, 4, { adjust: { tint: 30 } }); expect(at(t, 4, 0, 0)).toEqual([103, 91, 103, 255]);
  });
  it('maps luminance between two colours for duotone', () => {
    const px = image(2, 1, x => x ? [255, 255, 255, 255] : [0, 0, 0, 255]); applyLook(px, 2, 1, { adjust: {}, duotone: ['#102030', '#f0e0d0'] });
    expect(at(px, 2, 0, 0)).toEqual([16, 32, 48, 255]); expect(at(px, 2, 1, 0)).toEqual([240, 224, 208, 255]);
  });
  it('blurs stripes towards their mean without darkening transparent edges', () => {
    const w = 120, h = 20, stripes = () => image(w, h, x => (x >> 2) % 2 ? [40, 40, 40, 255] : [220, 220, 220, 255]);
    const px = stripes(), before = std(Array.from({ length: w }, (_, x) => at(px, w, x, 10)[0]));
    applyLook(px, w, h, { adjust: { blur: 100 } });
    expect(std(Array.from({ length: w }, (_, x) => at(px, w, x, 10)[0]))).toBeLessThan(before * .2);
    const edge = image(40, 4, x => x < 20 ? [255, 0, 0, 255] : [0, 0, 0, 0]); applyLook(edge, 40, 4, { adjust: { blur: 100 } });
    const soft = at(edge, 40, 20, 1); expect(soft[3]).toBeGreaterThan(0); expect(soft[3]).toBeLessThan(255); expect(soft[0]).toBe(255);
    expect(at(edge, 40, 39, 1)).toEqual([0, 0, 0, 0]);
    const tiny = flat([10, 20, 30]); applyLook(tiny, 4, 4, { adjust: { blur: 1 } }); expect(at(tiny, 4, 0, 0)).toEqual([10, 20, 30, 255]);
  });
  it('sharpens edges with an unsharp mask', () => {
    const w = 60, h = 4, px = image(w, h, x => x < 30 ? [100, 100, 100, 255] : [150, 150, 150, 255]);
    applyLook(px, w, h, { adjust: { sharpen: 100 } });
    expect(at(px, w, 29, 1)[0]).toBeLessThan(100); expect(at(px, w, 30, 1)[0]).toBeGreaterThan(150); expect(at(px, w, 5, 1)[0]).toBe(100);
  });
  it('darkens corners for a vignette and leaves the centre', () => {
    const w = 41, px = image(w, w, () => [200, 200, 200, 255]); applyLook(px, w, w, { adjust: { vignette: 100 } });
    expect(at(px, w, 20, 20)[0]).toBe(200); expect(at(px, w, 0, 0)[0]).toBeLessThan(60);
  });
});
