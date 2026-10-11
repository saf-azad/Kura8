import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { chunkOf, flattenSvg, scalePath, searchIcons, SYNONYMS, type IconIndex } from '../src/core/icons';
// @ts-expect-error plain ESM build script without type declarations
import * as baked from '../scripts/prepare-icons.mjs';

const svg = (...paths: string[]) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor">${paths.join('')}</svg>`;
const PATHS = ['M10 20L30 40Z', 'm10 20l-4 6h8v-2z', 'A8,8,0,0,1,16,16', 'a10 20 45 1 0 30 40 5 5 0 0 1 10 10', 'a8 8 0 018 8', 'M1e2 -5E-1', 'M1 2', 'M.5.5', 'M-0.001 0', 'C1 2 3 4 5 6S7 8 9 10Q1 1 2 2T3 3', 'M0 0 # ; 10'];
const SVGS = [svg('<path d="M0 0H10V10Z"/>'), svg('<path d="M0 0H10V10Z"/>', `<path d='m5 5 10 0 0 10z'/>`, '<path d="mz"/>'), svg('<path d="M0 0H1Z" opacity="0.2"/>'), svg('<path id="x"/>'), '<svg/>'];

describe('scalePath', () => {
  it('scales absolute and relative commands alike', () => {
    expect(scalePath('M10 20L30 40Z', 0.5)).toBe('M5 10L15 20Z');
    expect(scalePath('m10 20l-4 6h8v-2z', 0.5)).toBe('m5 10l-2 3h4v-1z');
    expect(scalePath('C1 2 3 4 5 6S7 8 9 10Q1 1 2 2T3 3', 2)).toBe('C2 4 6 8 10 12S14 16 18 20Q2 2 4 4T6 6');
  });
  it('scales arc radii and end points but leaves rotation and flags untouched', () => {
    expect(scalePath('A8,8,0,0,1,16,16', 0.5)).toBe('A4 4 0 0 1 8 8');
    expect(scalePath('a10 20 45 1 0 30 40 5 5 0 0 1 10 10', 0.5)).toBe('a5 10 45 1 0 15 20 2.5 2.5 0 0 1 5 5');
    expect(scalePath('a8 8 0 018 8', 2)).toBe('a16 16 0 0 1 16 16');
    expect(scalePath('M0 0A8 8 30 1 1 16 16L4 4', 2)).toBe('M0 0A16 16 30 1 1 32 32L8 8');
  });
  it('reads exponents, packed decimals and signs, and rounds to 2 decimals without negative zero', () => {
    expect(scalePath('M1e2 -5E-1', 0.5)).toBe('M50-0.25');
    expect(scalePath('M1 2', 1 / 3)).toBe('M0.33 0.67');
    expect(scalePath('M.5.5', 2)).toBe('M1 1');
    expect(scalePath('M-0.001 0', 1)).toBe('M0 0');
    expect(scalePath('M0 0 # ; 10', 1)).toBe('M0 0 10');
    expect(scalePath('', 2)).toBe('');
  });
  it('normalises a Phosphor fill path from the 256 box to the 100 box', () => {
    expect(scalePath('M128,232a8,8,0,0,1-8-8V32a8,8,0,0,1,16,0V224A8,8,0,0,1,128,232Z', 100 / 256)).toBe('M50 90.63a3.13 3.13 0 0 1-3.13-3.13V12.5a3.13 3.13 0 0 1 6.25 0V87.5A3.13 3.13 0 0 1 50 90.63Z');
  });
});

describe('flattenSvg', () => {
  it('keeps a single path as it is', () => {
    expect(flattenSvg(SVGS[0])).toEqual({ d: 'M0 0H10V10Z', flattened: false });
  });
  it('joins several paths into one ink and flags it, making a leading relative moveto absolute', () => {
    expect(flattenSvg(SVGS[1])).toEqual({ d: 'M0 0H10V10Z M5 5l10 0 0 10z Mz', flattened: true });
    expect(flattenSvg(svg('<path d="m1 2z"/>', '<path d=" m3 4 "/>', '<path d="mz"/>'))).toEqual({ d: 'M1 2z M3 4 Mz', flattened: true });
  });
  it('keeps the implicit linetos after an absolute moveto absolute (pen-nib drew spikes)', () => {
    expect(flattenSvg(svg('<path d="M95.04,31.78,163.25,36.73Z"/>')).d).toBe('M95.04 31.78L163.25 36.73Z');
    expect(flattenSvg(svg('<path d="m1 2 3 4z"/>')).d).toBe('M1 2l3 4z');
  });
  it('flags opacity and fill-opacity variations even on one path', () => {
    expect(flattenSvg(SVGS[2])).toEqual({ d: 'M0 0H1Z', flattened: true });
    expect(flattenSvg(svg('<path style="fill-opacity: .5" d="M0 0H1Z"/>')).flattened).toBe(true);
  });
  it('ignores paths without data', () => {
    expect(flattenSvg(SVGS[3])).toEqual({ d: '', flattened: false });
    expect(flattenSvg(SVGS[4])).toEqual({ d: '', flattened: false });
  });
});

describe('chunkOf', () => {
  it('buckets by first letter, everything else in 0', () => {
    expect(['heart', 'Arrow', 'x', '3d-box', '', 'ébène'].map(chunkOf)).toEqual(['h', 'a', 'x', '0', '0', '0']);
  });
});

const index: IconIndex = {
  categories: ['arrows', 'commerce', 'weather & nature', 'games'],
  picks: ['heart', 'sun', 'coffee'],
  icons: [
    ['arrow-left', 0, 'back previous'], ['arrow-right', 0, 'forward next'],
    ['coffee', 1, 'tea java drinks cafe'], ['coffee-bean', 1, 'roast'], ['shopping-bag', 1, 'store purchase'], ['tea-bag', 1, 'drinks'],
    ['clover', 2, 'luck plant'], ['cloud-rain', 2, 'storm wet'], ['sun', 2, 'day sunny'],
    ['hand-heart', 3, 'charity'], ['heart', 3, 'love like favorites'], ['heart-break', 3, 'broken sad'],
  ],
};
const names = (q: string, synonyms?: Record<string, string[]>, limit?: number) => searchIcons(index, q, synonyms, limit).names;

describe('searchIcons (5s)', () => {
  it('ranks the exact name, then name prefixes, then a name word', () => {
    expect(names('heart')).toEqual(['heart', 'heart-break', 'hand-heart']);
    expect(names('hea')).toEqual(['heart', 'heart-break', 'hand-heart']);
  });
  it('matches tags by prefix, below names', () => {
    expect(names('java')).toEqual(['coffee']);
    expect(names('stor')).toEqual(['cloud-rain', 'shopping-bag']);
  });
  it('is case-, accent-, hyphen- and space-insensitive and stems plurals', () => {
    expect(names('CAFÉ', {})).toEqual(['coffee']);
    expect(names('Café')).toEqual(names('cafe'));
    for (const q of ['tea-bag', 'tea bag', 'teabag', 'Tea_Bag']) expect(names(q)[0]).toBe('tea-bag');
    expect(names('hearts')[0]).toBe('heart');
  });
  it('puts icons matching every word before icons matching some', () => {
    expect(names('break heart')).toEqual(['heart-break', 'heart', 'hand-heart']);
    expect(names('heart zebra')).toEqual(['heart', 'hand-heart', 'heart-break']);
  });
  it('finds synonyms both ways: coffee finds a cup, mug finds coffee', () => {
    const cups: IconIndex = { categories: ['commerce', 'weather'], picks: [], icons: [['cup', 0, 'beverage'], ['umbrella', 1, 'rain']] };
    expect(searchIcons(cups, 'coffee')).toEqual({ names: ['cup'] });
    expect(names('mug')).toEqual(['coffee', 'tea-bag', 'coffee-bean']);
    expect(names('Café')).toEqual(['coffee', 'coffee-bean']);
    expect(names('drizzle', { rain: ['drizzle'] })).toEqual(['cloud-rain']);
    expect(names('drizzles', { drizzle: ['rain', 'wet weather'] })).toEqual(['cloud-rain']);
  });
  it('ranks synonyms above a word found inside a name word', () => {
    expect(names('love', {})).toEqual(['heart', 'clover']);
    expect(names('love', { love: ['heart'] })).toEqual(['heart', 'hand-heart', 'heart-break', 'clover']);
  });
  it('returns the picks for an empty query', () => {
    expect(searchIcons(index, '')).toEqual({ names: index.picks });
    expect(searchIcons(index, '  - ', SYNONYMS, 2)).toEqual({ names: ['heart', 'sun'] });
  });
  it('shows the nearest category instead of nothing, its picks first', () => {
    expect(searchIcons(index, 'wether')).toEqual({ names: ['sun', 'clover', 'cloud-rain'], category: 'weather & nature' });
    expect(searchIcons(index, 'chairty')).toEqual({ names: ['heart', 'hand-heart', 'heart-break'], category: 'games' });
    expect(searchIcons(index, 'mug', {}).category).toBe('commerce');
  });
  it('breaks a nearest-category tie by picks, then by order', () => {
    expect(searchIcons(index, 'qqqq')).toEqual({ names: ['coffee', 'coffee-bean', 'shopping-bag', 'tea-bag'], category: 'commerce' });
    expect(searchIcons({ ...index, picks: [] }, 'qqqq').category).toBe('arrows');
  });
  it('orders equal matches by name length, then alphabetically', () => {
    const jugs: IconIndex = { categories: ['commerce'], picks: [], icons: [['mug', 0, 'beverage'], ['cup', 0, 'beverage'], ['carafe', 0, 'beverage'], ['jug', 0, 'beverage']] };
    expect(searchIcons(jugs, 'beverage', {}).names).toEqual(['cup', 'jug', 'mug', 'carafe']);
  });
  it('respects the limit', () => {
    expect(names('heart', SYNONYMS, 1)).toEqual(['heart']);
    expect(searchIcons(index, 'wether', SYNONYMS, 1)).toEqual({ names: ['sun'], category: 'weather & nature' });
  });
});

describe('prepare-icons mirror', () => {
  it('bakes paths exactly as core reads them', () => {
    for (const d of PATHS) for (const k of [1, 0.5, 100 / 256]) expect(baked.scalePath(d, k)).toBe(scalePath(d, k));
    for (const s of SVGS) expect(baked.flattenSvg(s)).toEqual(flattenSvg(s));
    for (const n of ['heart', 'Arrow', '3d-box', '']) expect(baked.chunkOf(n)).toBe(chunkOf(n));
  });
  it('keeps only tag words search cannot reach another way', () => {
    const entry = { name: 'coin', tags: ['*new*', '*updated*', 'coins', 'money', 'Fast Food', 'foods', 'payment', 'pay'], alias: { name: 'cash-coin' } };
    expect(baked.tagWords(entry, new Set(['money']))).toBe('fast food payment pay cash');
    expect(baked.tagWords({ name: 'sun', tags: ['day'] })).toBe('day');
  });
});

// The real catalog, when `node scripts/prepare-icons.mjs` has baked it (it runs before dev and build).
const baking = new URL('../public/icons/', import.meta.url);
const real = existsSync(new URL('index.json', baking)) ? JSON.parse(readFileSync(new URL('index.json', baking), 'utf8')) as IconIndex & { version: string; licence: string } : null;
describe.runIf(real)('baked Phosphor catalog', () => {
  const catalog = real!;
  it('holds the fill set with MIT licence, categories and picks', () => {
    expect(catalog.licence).toBe('MIT');
    expect(catalog.icons.length).toBeGreaterThan(1500);
    expect(catalog.icons.every(([, c]) => catalog.categories[c] !== undefined)).toBe(true);
    expect(catalog.picks.every(p => catalog.icons.some(([n]) => n === p))).toBe(true);
    expect(readFileSync(new URL('index.json', baking)).byteLength).toBeLessThan(92 * 1024);
  });
  it('answers coffee, café and mug with the coffee icon, and every synonym with real icons', () => {
    expect(searchIcons(catalog, 'coffee').names[0]).toBe('coffee');
    expect(searchIcons(catalog, 'café').names).toContain('coffee');
    expect(searchIcons(catalog, 'mug').names).toContain('coffee');
    for (const key of Object.keys(SYNONYMS)) expect(searchIcons(catalog, key).category, key).toBeUndefined();
    expect(searchIcons(catalog, 'wether').category).toBe('weather & nature');
    // Loop-3 searches (D-077): the expected icon leads.
    for (const [q, first] of [['search', 'magnifying-glass'], ['tick', 'check'], ['study', 'book-open'], ['growth', 'chart-line-up']]) expect(searchIcons(catalog, q).names[0], q).toBe(first);
  });
  it('stores each path as core normalises it', () => {
    for (const name of ['heart', 'coffee', 'stack', 'lasso', 'music-notes-minus']) {
      const source = readFileSync(new URL(`../node_modules/@phosphor-icons/core/assets/fill/${name}-fill.svg`, import.meta.url), 'utf8'), flat = flattenSvg(source);
      const chunk = JSON.parse(readFileSync(new URL(`paths-${chunkOf(name)}.json`, baking), 'utf8'));
      expect(chunk[name]).toEqual([scalePath(flat.d, 100 / 256), flat.flattened ? 1 : 0]);
    }
  });
});
describe('curated synonym answers (D-074)', () => {
  it('ranks a synonym key’s listed answers above icons that only carry the word as a tag', () => {
    const places: IconIndex = { categories: ['places'], picks: [], icons: [['bed', 0, 'location hotel'], ['bus', 0, 'location transit'], ['map-pin', 0, 'marker']] };
    expect(searchIcons(places, 'location', { location: ['map pin'] }).names).toEqual(['map-pin', 'bed', 'bus']);
    expect(searchIcons(places, 'location', {}).names).toEqual(['bed', 'bus']);
  });
});
