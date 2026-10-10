import { describe, it, expect } from 'vitest';
import { absolutePaths, addStroke, refitFrame, bbox, classify, dist, inkFrame, inPoly, isScribble, plen, rdp, resample, segP, smooth, touches, type InkContext, type InkTarget, type P, type Recognised } from '../src/core/ink';
const ctx = (o: Partial<InkContext> = {}): InkContext => ({ scale: 1, tx: [], ty: [], inks: [], ...o });
/** Deterministic hand wobble on a densely sampled polyline through `corners`. */
const stroke = (corners: P[], a = 2): P[] => resample(corners, 400).map(([x, y], i): P => [x + a * Math.sin(i * .05), y + a * Math.cos(i * .07)]);
const oval = (cx: number, cy: number, rx: number, ry: number, a = 2): P[] => Array.from({ length: 201 }, (_, i): P => {
  const t = -Math.PI / 2 + 2 * Math.PI * i / 200;
  return [cx + rx * Math.cos(t) + a * Math.sin(i * .05), cy + ry * Math.sin(t) + a * Math.cos(i * .07)];
});
const wave = (x0: number, x1: number, y: number, amp: number, periods: number): P[] => Array.from({ length: 301 }, (_, i): P => [x0 + i * (x1 - x0) / 300, y + amp * Math.sin(i / 300 * periods * 2 * Math.PI)]);
const rec = (pts: P[], c = ctx()) => classify(resample(pts, 96), c);
const lineTarget: InkTarget = { id: 'L', form: 'line', rect: { x: 100, y: 298, w: 400, h: 4 }, rot: 0, paths: [[[100, 300], [500, 300]]] };
const rectTarget: InkTarget = { id: 'R', form: 'rect', rect: { x: 100, y: 100, w: 300, h: 200 }, rot: 0, paths: [[[100, 100], [400, 100], [400, 300], [100, 300], [100, 100]]] };
const close = (a: P, b: P, tol = 1e-6) => expect(dist(a, b)).toBeLessThan(tol);
const centre = (pts: P[]): P => { const b = bbox(pts); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; };
/** Recover the pure projection from a cleaned stroke: closed forms keep 20% of the wobble everywhere. */
const unmix = (r: Recognised): P[] => r.clean.map((c, i): P => [(c[0] - .2 * r.raw[i][0]) / .8, (c[1] - .2 * r.raw[i][1]) / .8]);

describe('ink helpers', () => {
  it('measures distance, polyline length and bounds', () => {
    expect(dist([0, 0], [3, 4])).toBe(5);
    expect(plen([[0, 0], [3, 4], [3, 10]])).toBe(11);
    expect(plen([[1, 1]])).toBe(0);
    expect(bbox([[1, 5], [4, 2], [3, 9]])).toEqual({ x0: 1, y0: 2, x1: 4, y1: 9, w: 3, h: 7 });
  });
  it('finds the nearest point on a segment, clamped to its ends', () => {
    expect(segP([5, 5], [0, 0], [10, 0])).toEqual([5, 0]);
    expect(segP([-5, 3], [0, 0], [10, 0])).toEqual([0, 0]);
    expect(segP([15, 3], [0, 0], [10, 0])).toEqual([10, 0]);
    expect(segP([7, 7], [2, 2], [2, 2])).toEqual([2, 2]);
  });
  it('resamples to n evenly spaced points keeping both ends, without mutating the input', () => {
    const src: P[] = [[0, 0], [100, 0], [100, 50]], before = JSON.stringify(src), r = resample(src, 31);
    expect(r).toHaveLength(31);
    expect(r[0]).toEqual([0, 0]); close(r[30], [100, 50], 1e-9);
    for (let i = 1; i < 31; i++) expect(dist(r[i - 1], r[i])).toBeCloseTo(5, 6);
    expect(JSON.stringify(src)).toBe(before);
    expect(r[0]).not.toBe(src[0]);
  });
  it('copies degenerate strokes unchanged', () => {
    const one: P[] = [[3, 4]], same: P[] = [[3, 4], [3, 4]];
    expect(resample(one, 8)).toEqual(one); expect(resample(one, 8)[0]).not.toBe(one[0]);
    expect(resample(same, 8)).toEqual(same);
  });
  it('simplifies with Ramer–Douglas–Peucker', () => {
    expect(rdp([[0, 0], [1, 1]], 1)).toEqual([0, 1]);
    expect(rdp([[0, 0], [1, .1], [2, 0], [3, .1], [4, 0]], .5)).toEqual([0, 4]);
    expect(rdp([[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]], .5)).toEqual([0, 2, 4]);
    expect(rdp([[0, 0], [5, 5], [10, 0], [15, 5], [20, 0]], 1)).toEqual([0, 1, 2, 3, 4]);
  });
  it('tests points against a polygon by the even-odd rule', () => {
    const sq: P[] = [[0, 0], [10, 0], [10, 10], [0, 10]], u: P[] = [[0, 0], [30, 0], [30, 30], [20, 30], [20, 10], [10, 10], [10, 30], [0, 30]];
    expect(inPoly([5, 5], sq)).toBe(true);
    expect(inPoly([15, 5], sq)).toBe(false);
    expect(inPoly([5, 20], u)).toBe(true);
    expect(inPoly([15, 20], u)).toBe(false);
  });
  it('detects scribbles by length and reversals on either axis', () => {
    const zig: P[] = Array.from({ length: 10 }, (_, i): P => [i % 2 ? 300 : 100, 100 + i * 8]);
    expect(isScribble(resample(zig, 96))).toBe(true);
    expect(isScribble(resample(zig.map(([x, y]): P => [y, x]), 96))).toBe(true);
    expect(isScribble(resample([[0, 0], [300, 10]], 96))).toBe(false);
    expect(isScribble(resample(oval(500, 500, 100, 100, 0), 96))).toBe(false);
    expect(isScribble([[5, 5], [5, 5], [5, 5]])).toBe(false);
    // Long for its size but only one reversal: a hairpin.
    expect(isScribble(resample([[0, 0], [400, 0], [400, 4], [0, 4], [0, 8], [200, 8]], 96))).toBe(false);
  });
  it('smooths with a 1-2-1 moving average, ends averaging with themselves', () => {
    const src: P[] = [[0, 0], [4, 0], [4, 4]];
    expect(smooth(src)).toEqual([[1, 0], [3, 1], [4, 3]]);
    expect(src).toEqual([[0, 0], [4, 0], [4, 4]]);
    expect(smooth([[2, 3]])).toEqual([[2, 3]]);
  });
  it('hit-tests the eraser circle against path segments widened by half the stroke', () => {
    const paths: P[][] = [[[0, 0], [100, 0]], [[200, 200]]];
    expect(touches(paths, [50, 13], 12, 4)).toBe(true);
    expect(touches(paths, [50, 14], 12, 4)).toBe(false);
    expect(touches(paths, [-10, 0], 12, 4)).toBe(true);
    expect(touches(paths, [200, 200], 12, 4)).toBe(false);
  });
});

describe('ink frames', () => {
  it('normalises paths into their bounds, rounded to 1e-4', () => {
    expect(inkFrame([[[10, 20], [110, 70]]], 4)).toEqual({ rect: { x: 10, y: 20, w: 100, h: 50 }, paths: [[[0, 0], [1, 1]]] });
    expect(inkFrame([[[0, 0], [30, 30]], [[10, 20]]], 4).paths[1]).toEqual([[.3333, .6667]]);
  });
  it('pads a frame thinner than the stroke about its centre', () => {
    expect(inkFrame([[[10, 20], [110, 20]]], 4)).toEqual({ rect: { x: 10, y: 18, w: 100, h: 4 }, paths: [[[0, .5], [1, .5]]] });
    expect(inkFrame([[[10, 20], [10, 120]]], 6)).toEqual({ rect: { x: 7, y: 20, w: 6, h: 100 }, paths: [[[.5, 0], [.5, 1]]] });
  });
  it('round-trips through absolutePaths and rotates about the frame centre', () => {
    const src: P[][] = [[[12, 30], [140, 77], [60, 200]]], f = inkFrame(src, 4), back = absolutePaths(f.paths, f.rect, 0);
    back[0].forEach((p, i) => close(p, src[0][i], .05));
    const [[p]] = absolutePaths([[[0, 0]]], { x: 0, y: 0, w: 100, h: 50 }, 90);
    close(p, [75, -25]);
    const turned = absolutePaths(f.paths, f.rect, 180), c: P = [f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2];
    turned[0].forEach((q, i) => close(q, [2 * c[0] - back[0][i][0], 2 * c[1] - back[0][i][1]], 1e-9));
  });
});

describe('classify: lines', () => {
  it('ignores strokes smaller than 10 screen px', () => {
    expect(rec(stroke([[100, 100], [106, 104]]))).toBeNull();
    expect(rec(stroke([[100, 100], [140, 120]], .5), ctx({ scale: .2 }))).toBeNull();
    expect(rec(stroke([[100, 100], [140, 120]], .5), ctx({ scale: 1 }))).not.toBeNull();
  });
  it('straightens a near-horizontal stroke and snaps its ends to targets within 10 px', () => {
    const src = stroke([[100, 100], [400, 112]]), before = JSON.stringify(src), raw = resample(src, 96);
    const r = classify(raw, ctx({ tx: [104, 402], ty: [97] }))!;
    expect(r).toMatchObject({ type: 'line', name: 'Line' });
    expect(r.raw).toEqual(raw); expect(r.clean).toHaveLength(r.raw.length);
    close(r.clean[0], [104, 97]); close(r.clean[95], [402, 97]);
    r.clean.forEach(p => expect(Math.abs(p[1] - 97)).toBeLessThan(.2 * 20));
    expect(JSON.stringify(src)).toBe(before);
    expect('rect' in r).toBe(false);
  });
  it('rounds to horizontal about the midpoint and leaves far targets alone', () => {
    const r = rec(stroke([[100, 100], [400, 112]]), ctx({ tx: [80], ty: [80] }))!;
    expect(r.clean[0][1]).toBeCloseTo(r.clean[95][1], 9);
    expect(r.clean[0][1]).toBeGreaterThan(104); expect(r.clean[0][1]).toBeLessThan(110);
    // At 2 px per unit the 10 px threshold is 5 units.
    const z = rec(stroke([[100, 100], [400, 100]], 0), ctx({ scale: 2, tx: [94], ty: [106] }))!;
    expect(z.clean[0][0]).toBeCloseTo(100, 6); expect(z.clean[0][1]).toBeCloseTo(100, 6);
  });
  it('picks the nearest of several targets inside the threshold', () => {
    const r = rec(stroke([[100, 100], [400, 100]], 0), ctx({ tx: [93, 98, 102, 395, 403, 406], ty: [91, 96, 108] }))!;
    close(r.clean[0], [98, 96]); close(r.clean[95], [403, 96]);
    const sq = rec(stroke([[100, 100], [300, 100], [300, 300], [100, 300], [100, 102]], 0), ctx({ tx: [94, 203, 207] }))!, q = bbox(unmix(sq));
    expect((q.x0 + q.x1) / 2).toBeCloseTo(203, 9);
  });
  it('snaps vertical strokes on x, then each end on y', () => {
    const r = rec(stroke([[300, 100], [306, 400]]), ctx({ tx: [298], ty: [95, 405] }))!;
    expect(r.type).toBe('line');
    close(r.clean[0], [298, 95]); close(r.clean[95], [298, 405]);
  });
  it('turns strokes within 7° of a diagonal onto 45°, keeping midpoint and length', () => {
    const raw = resample(stroke([[100, 100], [300, 290]], 0), 96), r = classify(raw, ctx({ tx: [100], ty: [100] }))!;
    const [a, z] = [r.clean[0], r.clean[95]];
    expect(z[0] - a[0]).toBeCloseTo(z[1] - a[1], 9);
    expect(dist(a, z)).toBeCloseTo(dist(raw[0], raw[95]), 9);
    close([(a[0] + z[0]) / 2, (a[1] + z[1]) / 2], [(raw[0][0] + raw[95][0]) / 2, (raw[0][1] + raw[95][1]) / 2], 1e-9);
  });
  it('keeps the drawn angle when no multiple of 45° is within 7°', () => {
    const end: P = [100 + 300 * Math.cos(Math.PI / 9), 100 + 300 * Math.sin(Math.PI / 9)];
    const raw = resample(stroke([[100, 100], end], 0), 96), r = classify(raw, ctx({ tx: [101], ty: [101] }))!;
    expect(r.clean[0]).toEqual(raw[0]); close(r.clean[95], raw[95], 1e-9);
  });
});

describe('classify: rectangle diagonals', () => {
  const c = ctx({ inks: [{ ...lineTarget, form: 'ellipse' }, { ...rectTarget, id: 'turned', rot: 15 }, rectTarget] });
  it('attaches a corner-to-corner stroke to an unrotated rectangle with its direction', () => {
    const r = rec(stroke([[105, 102], [398, 297]]), c)!;
    expect(r).toMatchObject({ type: 'line', rect: 'R', dir: 0, name: 'Line' });
    expect(r.clean).toHaveLength(96);
    expect(r.clean[0]).toEqual([100, 100]); expect(r.clean[95]).toEqual([400, 300]);
  });
  it('accepts either drawing direction and the other diagonal', () => {
    const back = rec(stroke([[398, 297], [105, 102]]), c)!;
    expect(back).toMatchObject({ rect: 'R', dir: 0 });
    expect(back.clean[0]).toEqual([400, 300]); expect(back.clean[95]).toEqual([100, 100]);
    const other = rec(stroke([[396, 104], [103, 298]]), c)!;
    expect(other).toMatchObject({ rect: 'R', dir: 1 });
    expect(other.clean[0]).toEqual([400, 100]); expect(other.clean[95]).toEqual([100, 300]);
    const otherBack = rec(stroke([[103, 298], [396, 104]]), c)!;
    expect(otherBack).toMatchObject({ rect: 'R', dir: 1 });
    expect(otherBack.clean[0]).toEqual([100, 300]);
  });
  it('ignores rotated rectangles, other forms and ends beyond 22% of the diagonal', () => {
    const r = rec(stroke([[105, 102], [398, 297]]), ctx({ inks: [{ ...rectTarget, rot: 15 }, { ...rectTarget, form: undefined }] }))!;
    expect(r.type).toBe('line'); expect('rect' in r).toBe(false);
    const far = rec(stroke([[190, 160], [398, 297]]), c)!;
    expect(far.type).toBe('line'); expect('rect' in far).toBe(false);
  });
});

describe('classify: arrows', () => {
  it('reads a line with a short hook back at the end as an arrow with 30° barbs', () => {
    const r = rec(stroke([[100, 300], [500, 300], [450, 330]]), ctx({ tx: [100, 500], ty: [300] }))!;
    expect(r).toMatchObject({ type: 'arrow', name: 'Arrow' });
    expect(r.clean).toHaveLength(r.raw.length);
    close(r.clean[0], [100, 300]);
    expect(Math.max(...r.clean.map(p => p[0]))).toBeCloseTo(500, 0);
    const end = r.clean[95], dx = end[0] - 500, dy = end[1] - 300;
    expect(dx).toBeLessThan(0); expect(Math.abs(dy / dx)).toBeCloseTo(Math.tan(Math.PI / 6), 6);
    // Shaft points stay on the shaft line.
    r.clean.filter(p => p[0] < 400).forEach(p => expect(Math.abs(p[1] - 300)).toBeLessThan(1));
  });
  it('clamps the barbs to 30% of the shaft and rejects hooks over 55%', () => {
    const long = rec(stroke([[100, 300], [500, 300], [350, 400]], 0), ctx({ tx: [500] }))!;
    expect(long.type).toBe('arrow');
    const md = Math.max(...long.raw.map(p => dist(p, long.raw[0]))), tip = long.raw.find(p => dist(p, long.raw[0]) === md)!;
    expect(dist(long.clean[95], [500, (long.raw[0][1] + tip[1]) / 2])).toBeCloseTo(.3 * md, 9);
    expect(rec(stroke([[100, 300], [500, 300], [465, 320]], 0))!.type).toBe('arrow');
    expect(rec(stroke([[100, 300], [500, 300], [300, 400]], 0))).toBeNull();
  });
  it('survives a shaft whose ends snap onto the same target', () => {
    const r = rec(stroke([[300, 93], [300, 107], [296, 104]], 0), ctx({ tx: [300], ty: [100] }))!;
    expect(r.type).toBe('arrow');
    r.clean.forEach(p => expect(Number.isFinite(p[0] + p[1])).toBe(true));
  });
});

describe('classify: closed shapes', () => {
  it('cleans a closed oblong into a rectangle snapped to targets', () => {
    const r = rec(stroke([[100, 100], [400, 100], [400, 300], [100, 300], [100, 102]]), ctx({ tx: [98, 405], ty: [103, 296] }))!, q = unmix(r);
    expect(r).toMatchObject({ type: 'rect', name: 'Rectangle' });
    expect(r.clean).toHaveLength(r.raw.length);
    Object.entries({ x0: 98, y0: 103, x1: 405, y1: 296 }).forEach(([k, v]) => expect(bbox(q)[k as 'x0']).toBeCloseTo(v, 9));
    q.forEach(([x, y]) => expect(Math.min(Math.abs(x - 98), Math.abs(x - 405), Math.abs(y - 103), Math.abs(y - 296))).toBeLessThan(1e-9));
    r.clean.forEach((c, i) => expect(dist(c, q[i])).toBeCloseTo(.2 * dist(r.raw[i], q[i]), 9));
  });
  it('evens a nearly square rectangle and shifts it whole onto the nearest target', () => {
    const r = rec(stroke([[100, 100], [300, 100], [300, 308], [100, 308], [100, 102]]), ctx({ tx: [205] }))!, q = bbox(unmix(r)), raw = bbox(r.raw);
    expect(r).toMatchObject({ type: 'rect', name: 'Square' });
    expect(q.w).toBeCloseTo(q.h, 9); expect(q.w).toBeCloseTo((raw.w + raw.h) / 2, 9);
    expect((q.x0 + q.x1) / 2).toBeCloseTo(205, 9); expect((q.y0 + q.y1) / 2).toBeCloseTo((raw.y0 + raw.y1) / 2, 9);
  });
  it('cleans a closed round stroke into a circle shifted onto targets', () => {
    const r = rec(oval(500, 500, 150, 146), ctx({ tx: [345], ty: [505] }))!, b = bbox(r.raw), R = (b.w + b.h) / 4;
    expect(r).toMatchObject({ type: 'ellipse', name: 'Circle' });
    expect(r.clean).toHaveLength(r.raw.length);
    unmix(r).forEach(p => expect(dist(p, [345 + R, 505])).toBeCloseTo(R, 9));
  });
  it('keeps distinct radii as an ellipse', () => {
    const r = rec(oval(500, 500, 200, 100))!, b = bbox(r.raw), [cx, cy] = centre(r.raw);
    expect(r).toMatchObject({ type: 'ellipse', name: 'Ellipse' });
    unmix(r).forEach(([x, y]) => expect(Math.hypot((x - cx) / (b.w / 2), (y - cy) / (b.h / 2))).toBeCloseTo(1, 9));
  });
  it('cleans a closed three-cornered stroke into a triangle with its near-level base levelled', () => {
    const r = rec(stroke([[100, 400], [300, 100], [500, 412], [102, 400]]))!, q = unmix(r), level = Math.max(...q.map(p => p[1]));
    expect(r).toMatchObject({ type: 'tri', name: 'Triangle' });
    expect(r.clean).toHaveLength(r.raw.length);
    const base = q.filter(p => Math.abs(p[1] - level) < 1e-9).map(p => p[0]);
    expect(Math.min(...base)).toBeLessThan(150); expect(Math.max(...base)).toBeGreaterThan(450);
    expect(level).toBeGreaterThan(403); expect(level).toBeLessThan(409);
  });
  it('rejects closed strokes that fit no shape', () => {
    const star = Array.from({ length: 11 }, (_, i): P => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 60 : 200; return [500 + r * Math.cos(a), 500 + r * Math.sin(a)]; });
    expect(rec(resample(star, 400))).toBeNull();
  });
});

describe('classify: text-line waves', () => {
  it('reads a flat wave with three or more reversals as a text line', () => {
    const r = rec(wave(103, 597, 304, 30, 4), ctx({ tx: [100, 600], ty: [300] }))!;
    expect(r).toMatchObject({ type: 'wave', name: 'Text line', l: 100, r: 600, cy: 300 });
    expect(r.clean).toHaveLength(r.raw.length);
    r.clean.forEach(([x, y]) => { expect(Math.abs(y - 300)).toBeLessThanOrEqual(.05 * 35); expect(x).toBeGreaterThanOrEqual(100); expect(x).toBeLessThanOrEqual(600); });
    close(r.clean[0], [103, 300]); close(r.clean[95], [597, 300], 1e-6);
  });
  it('needs a wide enough wave', () => {
    const r = rec(wave(103, 597, 304, 30, 4), ctx({ scale: .05 }));
    expect(r).toBeNull();
  });
});

describe('classify: arrowheads', () => {
  const c = ctx({ inks: [rectTarget, lineTarget] });
  it('turns a V drawn at the end of a line into that line’s arrowhead', () => {
    const r = rec(stroke([[460, 270], [505, 300], [460, 330]], 0), c)!;
    expect(r).toMatchObject({ type: 'head', line: 'L', name: 'Arrow' });
    expect(r.clean).toHaveLength(r.raw.length);
    const hl = (dist(r.raw[0], r.raw[48]) + dist(r.raw[95], r.raw[48])) / 2;
    expect(dist(r.clean[0], [500, 300])).toBeCloseTo(hl, 0);
    expect(dist(r.clean[95], [500, 300])).toBeCloseTo(hl, 0);
    expect(r.clean[0][1]).toBeLessThan(300); expect(r.clean[95][1]).toBeGreaterThan(300);
    expect((300 - r.clean[0][1]) / (500 - r.clean[0][0])).toBeCloseTo(Math.tan(Math.PI / 6), 6);
    expect(Math.min(...r.clean.map(p => dist(p, [500, 300])))).toBeLessThan(2);
  });
  it('starts the cleaned head at the barb nearest the first point', () => {
    const r = rec(stroke([[460, 330], [505, 300], [460, 270]], 0), c)!;
    expect(r.type).toBe('head');
    expect(r.clean[0][1]).toBeGreaterThan(300); expect(r.clean[95][1]).toBeLessThan(300);
  });
  it('attaches to the start of a line too', () => {
    const r = rec(stroke([[140, 270], [95, 300], [140, 330]], 0), c)!;
    expect(r).toMatchObject({ type: 'head', line: 'L' });
    expect(Math.min(...r.clean.map(p => p[0]))).toBeGreaterThan(98);
  });
  it('skips zero-length lines', () => {
    expect(rec(stroke([[460, 270], [505, 300], [460, 330]], 0), ctx({ inks: [{ ...lineTarget, paths: [[[500, 300], [500, 300]]] }] }))).toBeNull();
  });
  it('rejects heads that are too big, too far, too open or have no line', () => {
    const v: P[] = [[460, 270], [505, 300], [460, 330]];
    expect(rec(stroke(v, 0), ctx({ inks: [{ ...lineTarget, paths: [[[420, 300], [500, 300]]] }] }))).toBeNull();
    expect(rec(stroke(v.map(([x, y]): P => [x, y + 100]), 0), c)).toBeNull();
    expect(rec(stroke([[418.4, 250], [505, 300], [591.6, 250]], 0), c)).toBeNull();
    expect(rec(stroke(v, 0), ctx({ inks: [rectTarget] }))).toBeNull();
  });
});

describe('classify: unrecognised', () => {
  it('returns null for zig-zags, curls and degenerate strokes', () => {
    expect(rec(resample([[100, 100], [150, 300], [200, 150], [250, 300], [300, 100]], 400))).toBeNull();
    expect(rec(resample([[100, 100], [300, 100], [300, 300], [150, 300], [150, 180]], 400))).toBeNull();
    expect(classify([[0, 0], [0, 0], [0, 0]], ctx({ scale: 20 }))).toBeNull();
  });
});
describe('adding a stroke to a rotated ink node', () => {
  it('keeps the drawn strokes and the new stroke where they appear, in the edited size and in another size', () => {
    const f = { rect: { x: 100, y: 300, w: 200, h: 4 }, rot: 90 }, paths: P[][] = [[[0, .5], [1, .5]]];
    const before = absolutePaths(paths, f.rect, f.rot), end = before[0][1], head: P[] = [[end[0] - 20, end[1] - 20], end, [end[0] + 20, end[1] - 20]];
    const out = addStroke(paths, f, head, 4), frame = refitFrame(f, f.rect, out.rect), after = absolutePaths(out.paths, frame.rect, frame.rot);
    expect(frame.rot).toBe(90);
    after[0].forEach((q, i) => { expect(q[0]).toBeCloseTo(before[0][i][0], 2); expect(q[1]).toBeCloseTo(before[0][i][1], 2); });
    after[1].forEach((q, i) => { expect(q[0]).toBeCloseTo(head[i][0], 2); expect(q[1]).toBeCloseTo(head[i][1], 2); });
    const other = { rect: { x: 10, y: 20, w: 100, h: 2 }, rot: 0 }, moved = refitFrame(other, f.rect, out.rect);
    expect(moved.rect.w).toBeCloseTo(out.rect.w / 2); expect(moved.rect.h).toBeCloseTo(out.rect.h / 2);
    const same = refitFrame(other, f.rect, f.rect); expect(same.rect.x).toBeCloseTo(10); expect(same.rect.y).toBeCloseTo(20);
  });
});
