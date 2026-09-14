import { describe, it, expect } from 'vitest';
import { guides, guideById } from '../../src/core/guides';
import { canvasSize } from '../../src/core/ratios';
import { PHI } from '../../src/core/guides/golden';
import type { Anchor } from '../../src/core/guides/types';
for (const ratio of ['square', 'story', 'banner'] as const) for (const guide of guides) describe(`${guide.id} on ${ratio}`, () => {
  it('pins every line, intersection and region by id', () => {
    const { w, h } = canvasSize(ratio), actual = guide.generate({ w, h });
    const fractions = guide.id === 'thirds' ? [1 / 3, 2 / 3] : guide.id === 'golden' ? [1 - 1 / PHI, 1 / PHI] : [0.25, 0.5, 0.75];
    const expected: Anchor[] = [];
    for (const axis of ['x', 'y'] as const) fractions.forEach((f, i) => expected.push({ kind: 'line', id: `line-${axis}-${i + 1}`, axis, at: f * (axis === 'x' ? w : h) }));
    fractions.forEach((x, c) => fractions.forEach((y, r) => expected.push({ kind: 'point', id: `point-x${c + 1}-y${r + 1}`, x: x * w, y: y * h })));
    const region = (id: string, x: number, y: number, rw: number, rh: number) => expected.push({ kind: 'region', id, rect: { x, y, w: rw, h: rh } });
    if (guide.id !== 'divisions') {
      const f = [0, ...fractions, 1];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) region(`region-cell-${r}-${c}`, f[c] * w, f[r] * h, (f[c + 1] - f[c]) * w, (f[r + 1] - f[r]) * h);
      if (guide.id === 'golden') {
        if (w / PHI < h) { region('region-golden-top', 0, 0, w, w / PHI); region('region-golden-bottom', 0, h - w / PHI, w, w / PHI); }
        if (h / PHI < w) { region('region-golden-left', 0, 0, h / PHI, h); region('region-golden-right', w - h / PHI, 0, h / PHI, h); }
      }
    } else {
      region('region-quad-tl', 0, 0, w / 2, h / 2); region('region-quad-tr', w / 2, 0, w / 2, h / 2);
      region('region-quad-bl', 0, h / 2, w / 2, h / 2); region('region-quad-br', w / 2, h / 2, w / 2, h / 2);
      region('region-band-v', w / 4, 0, w / 2, h); region('region-band-h', 0, h / 4, w, h / 2);
    }
    expect(actual.map(a => a.id)).toEqual(expected.map(a => a.id));
    actual.forEach((a, i) => {
      const e = expected[i]; expect(a.kind).toBe(e.kind);
      if (a.kind === 'line' && e.kind === 'line') { expect(a.axis).toBe(e.axis); expect(a.at).toBeCloseTo(e.at); }
      if (a.kind === 'point' && e.kind === 'point') { expect(a.x).toBeCloseTo(e.x); expect(a.y).toBeCloseTo(e.y); }
      if (a.kind === 'region' && e.kind === 'region') for (const key of ['x', 'y', 'w', 'h'] as const) expect(a.rect[key]).toBeCloseTo(e.rect[key]);
    });
    expect(guideById(guide.id)).toBe(guide); expect(guide.generate({ w, h })).toEqual(actual);
  });
});
