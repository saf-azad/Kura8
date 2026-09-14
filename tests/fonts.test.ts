import { describe, it, expect } from 'vitest';
import { fonts, fontIds, fontById, fontStack, isFontId, DEFAULT_FONT } from '../src/core/fonts';
describe('fonts', () => {
  it('registers seven unique families with files, weight ranges and a licence flag', () => {
    expect(fonts).toHaveLength(7);
    expect(new Set(fontIds).size).toBe(7);
    expect(new Set(fonts.map(f => f.file)).size).toBe(7);
    for (const f of fonts) { expect(f.file).toMatch(/^[a-z-]+\.(ttf|woff2)$/); expect(f.weights[0]).toBeLessThanOrEqual(f.weights[1]); expect(typeof f.demo).toBe('boolean'); }
  });
  it('defaults to an openly licensed family and resolves ids to stacks', () => {
    expect(fontById(DEFAULT_FONT).demo).toBe(false);
    expect(fontStack('kylora')).toBe('"Kylora", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
    expect(fontStack('malam-poek').startsWith('"Malam Poek"')).toBe(true);
    for (const id of fontIds) expect(isFontId(id)).toBe(true);
    for (const bad of ['arial', '', 4, null, 'Space Grotesk']) expect(isFontId(bad)).toBe(false);
  });
});
