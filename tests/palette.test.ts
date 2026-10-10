import { describe, it, expect } from 'vitest';
import { hsl, hslOf, rgbOf, hsvToHex, hexToHsv, hueSwatch, paletteFor, rowFromHex, rows, roleRef, placeOf, resolve, addCustom, contrast, luminance, passingShade, LIGHTNESS, HUES } from '../src/core/palette';
import type { Palette } from '../src/core/document';
const light: Palette = { hue: 210, dark: false, custom: [] }, dark: Palette = { ...light, dark: true }, neutral: Palette = { hue: null, dark: false, custom: [] };
describe('colour maths', () => {
  it('converts between hex, HSL and HSV', () => {
    expect([hsl(0, 100, 50), hsl(120, 100, 25), hsl(0, 0, 100), hsl(0, 0, 0)]).toEqual(['#ff0000', '#008000', '#ffffff', '#000000']);
    expect(rgbOf('#0080ff')).toEqual([0, 128, 255]);
    const back = hslOf(hsl(210, 40, 64)); expect(back.h).toBeCloseTo(210, 0); expect(back.s).toBeCloseTo(40, 0); expect(back.l).toBeCloseTo(64, 0);
    expect(hslOf('#808080')).toEqual({ h: 0, s: 0, l: 128 / 255 * 100 });
    expect(hslOf('#00ff00').h).toBeCloseTo(120); expect(hslOf('#0000ff').h).toBeCloseTo(240); expect(hslOf('#ff00ff').h).toBeCloseTo(300);
    expect([hsvToHex(0, 100, 100), hsvToHex(240, 100, 50), hsvToHex(0, 0, 100)]).toEqual(['#ff0000', '#000080', '#ffffff']);
    expect([hexToHsv('#ff0000'), hexToHsv('#00ff00'), hexToHsv('#0000ff'), hexToHsv('#000000'), hexToHsv('#ff00ff')]).toEqual([{ h: 0, s: 100, v: 100 }, { h: 120, s: 100, v: 100 }, { h: 240, s: 100, v: 100 }, { h: 0, s: 0, v: 0 }, { h: 300, s: 100, v: 100 }]);
    expect(hueSwatch(null)).toBe('#ecf0f3'); expect(hueSwatch(0)).toBe(hsl(0, 55, 50));
    expect(paletteFor(30, true)).toEqual({ hue: 30, dark: true, custom: [] });
    expect(HUES).toHaveLength(12); expect(LIGHTNESS).toEqual([92, 78, 64, 50, 36, 22, 10]);
  });
  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21); expect(contrast('#ffffff', '#000000')).toBeCloseTo(21); expect(contrast('#777777', '#777777')).toBe(1);
    expect(luminance('#ffffff')).toBeCloseTo(1); expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 1);
  });
});
describe('palette', () => {
  it('builds base and complementary rows at the seven lightness steps', () => {
    const r = rows(light);
    expect(r.base).toEqual(LIGHTNESS.map(l => hsl(210, 40, l)));
    expect(r.accent).toEqual(LIGHTNESS.map(l => hsl(30, 55, l)));
    expect(rows(neutral).base).toEqual(LIGHTNESS.map(l => hsl(0, 0, l)));
  });
  it('places roles on rows and mirrors every row reference in dark mode (5i)', () => {
    expect([roleRef('ground', light), roleRef('ink', light), roleRef('accent', light), roleRef('accent', neutral)]).toEqual([{ row: 'base', step: 0 }, { row: 'base', step: 6 }, { row: 'accent', step: 3 }, { row: 'accent', step: 6 }]);
    expect(resolve({ role: 'ground' }, light)).toBe(hsl(210, 40, 92)); expect(resolve({ role: 'ground' }, dark)).toBe(hsl(210, 40, 10));
    expect(resolve({ role: 'ink' }, dark)).toBe(hsl(210, 40, 92));
    expect(resolve({ row: 'base', step: 1 }, dark)).toBe(resolve({ row: 'base', step: 5 }, light));
    expect(placeOf({ hex: '#123456' }, dark)).toBeNull(); expect(resolve({ hex: '#ABCDEF' }, dark)).toBe('#abcdef');
    expect(resolve({ row: 'c9', step: 2 }, light)).toBe(rows(light).base[2]);
  });
  it('lets a custom accent replace the complementary row and the accent role', () => {
    const p = { ...light, accent: '#e63946' };
    expect(resolve({ role: 'accent' }, p)).toBe('#e63946');
    expect(rows(p).accent).toEqual(rowFromHex('#e63946'));
  });
  it('turns a pasted hex into a custom row with the nearest step replaced exactly (5g)', () => {
    const row = rowFromHex('#9CABC2');
    expect(row).toHaveLength(7); expect(row[2]).toBe('#9cabc2'); expect(row[0]).toBe(hsl(hslOf('#9cabc2').h, hslOf('#9cabc2').s, 92));
    const added = addCustom(light, '#9CABC2');
    expect(added.palette.custom).toEqual(['#9cabc2']); expect(added.ref).toEqual({ row: 'c0', step: 2 });
    expect(resolve(added.ref, added.palette)).toBe('#9cabc2');
    const again = addCustom(added.palette, '#9cabc2'); expect(again.palette).toBe(added.palette); expect(again.ref.row).toBe('c0');
    expect(addCustom(added.palette, '#000000').ref).toEqual({ row: 'c1', step: 6 });
  });
  it('offers the nearest passing shade from the same row when text falls below 4.5:1 (5h)', () => {
    const bg = resolve({ role: 'ground' }, light);
    expect(passingShade({ role: 'ink' }, bg, light)).toBeNull();
    const fix = passingShade({ row: 'base', step: 1 }, bg, light)!;
    expect('row' in fix.ref && fix.ref.row).toBe('base'); expect(fix.ratio).toBeGreaterThanOrEqual(4.5);
    expect(contrast(resolve(fix.ref, light), bg)).toBeCloseTo(fix.ratio);
    const darkBg = resolve({ role: 'ground' }, dark), darkFix = passingShade({ row: 'base', step: 1 }, darkBg, dark)!;
    expect(contrast(resolve(darkFix.ref, dark), darkBg)).toBeGreaterThanOrEqual(4.5);
    const hexFix = passingShade({ hex: '#dddddd' }, '#ffffff', light)!;
    expect('hex' in hexFix.ref).toBe(true); expect(hexFix.ratio).toBeGreaterThanOrEqual(4.5);
    expect(passingShade({ hex: '#808080' }, '#808080', light, 30)).toBeNull();
  });
});
