import type { Rect } from './geometry';
import type { InkForm } from './document';
/** Sketch recogniser: classifies one pen stroke as a line, arrow, closed shape, text-line wave or arrowhead, and cleans it towards that form. */
export type P = [number, number];
/** Existing ink strokes the recogniser can attach to: rect is the frame rect in unit space, rot degrees, paths absolute in unit space. */
export type InkTarget = { id: string; form?: InkForm; rect: Rect; rot: number; paths: P[][]; cross?: { id: string; dir: 0 | 1 } };
/** scale = screen px per unit; tx/ty = candidate snap coordinates (guide lines, canvas edges/centre, other objects' edges). */
export type InkContext = { scale: number; tx: number[]; ty: number[]; inks: InkTarget[] };
type Kind =
  | { type: 'line'; rect?: string; dir?: 0 | 1 }
  | { type: 'arrow' }
  | { type: 'rect' } | { type: 'ellipse' } | { type: 'tri' }
  | { type: 'wave'; l: number; r: number; cy: number }
  | { type: 'head'; line: string };
export type Recognised = { raw: P[]; clean: P[]; name: string } & Kind;
/** How much of the hand-drawn wobble a cleaned stroke keeps. */
const WOB = .2;
const copy = (p: P): P => [p[0], p[1]];
export const dist = (a: P, b: P): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const plen = (pts: P[]): number => { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; };
export function bbox(pts: P[]): { x0: number; y0: number; x1: number; y1: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
/** Nearest point to `p` on segment ab. */
export function segP(p: P, a: P, b: P): P {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}
const nearest = (p: P, segs: [P, P][]): P => segs.map(([a, c]) => segP(p, a, c)).reduce((m, q) => dist(p, q) < dist(p, m) ? q : m);
/** `n` points evenly spaced along the polyline, first and last kept. */
export function resample(pts: P[], n: number): P[] {
  const L = plen(pts); if (!L || pts.length < 2) return pts.map(copy);
  const step = L / (n - 1), out: P[] = [copy(pts[0])]; let acc = 0, prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i]; let d = dist(prev, cur);
    while (d > 0 && acc + d >= step && out.length < n) { const q = lerp(prev, cur, (step - acc) / d); out.push(q); prev = q; d = dist(prev, cur); acc = 0; }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push(copy(pts[pts.length - 1]));
  return out;
}
/** Ramer–Douglas–Peucker simplification: indices of the points kept. */
export function rdp(pts: P[], eps: number): number[] {
  if (pts.length < 3) return pts.map((_, i) => i);
  const a = pts[0], z = pts[pts.length - 1]; let m = 0, id = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], segP(pts[i], a, z)); if (d > m) { m = d; id = i; } }
  if (m <= eps) return [0, pts.length - 1];
  return [...rdp(pts.slice(0, id + 1), eps).slice(0, -1), ...rdp(pts.slice(id), eps).map(i => i + id)];
}
/** Direction reversals of a 1-D signal, ignoring swings no larger than `th`. */
const revs = (vals: number[], th: number) => {
  let r = 0, dir = 0, ext = vals[0];
  for (const v of vals) { if (!dir) { if (Math.abs(v - ext) > th) { dir = Math.sign(v - ext); ext = v; } } else if ((v - ext) * dir > 0) ext = v; else if ((ext - v) * dir > th) { r++; dir = -dir; ext = v; } }
  return r;
};
/** The nearest target strictly within `thr`, else `v`. */
const snapV = (v: number, T: number[], thr: number) => { let b: number | null = null; for (const t of T) if (Math.abs(t - v) < thr && (b === null || Math.abs(t - v) < Math.abs(b - v))) b = t; return b ?? v; };
/** Smallest offset (under `thr`) that lands any of `vals` on a target, else 0. */
const shift = (vals: number[], T: number[], thr: number) => { let b: number | null = null; for (const v of vals) for (const t of T) { const df = t - v; if (Math.abs(df) < thr && (b === null || Math.abs(df) < Math.abs(b))) b = df; } return b || 0; };
const rotv = (v: P, deg: number): P => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
/** Even-odd point-in-polygon test. */
export function inPoly(pt: P, poly: P[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
}
/** Within 7° of a multiple of 45° the segment turns about its midpoint onto it; horizontal and vertical ends then snap to targets. */
function snapSeg(a: P, b: P, TX: number[], TY: number[], thr: number): [P, P] {
  let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; const q = Math.round(ang / 45) * 45, len = dist(a, b);
  if (Math.abs(ang - q) < 7) { const m = lerp(a, b, .5), r = q * Math.PI / 180, hx = Math.cos(r) * len / 2, hy = Math.sin(r) * len / 2; a = [m[0] - hx, m[1] - hy]; b = [m[0] + hx, m[1] + hy]; ang = q; }
  const md = ((Math.round(ang) % 180) + 180) % 180;
  if (md === 0) { const y = snapV(a[1], TY, thr); return [[snapV(a[0], TX, thr), y], [snapV(b[0], TX, thr), y]]; }
  if (md === 90) { const x = snapV(a[0], TX, thr); return [[x, snapV(a[1], TY, thr)], [x, snapV(b[1], TY, thr)]]; }
  return [a, b];
}
/** A back-and-forth stroke: long for its size, with at least four reversals on one axis. */
export function isScribble(pts: P[]): boolean {
  const b = bbox(pts), diag = Math.hypot(b.w, b.h) || 1;
  if (plen(pts) / diag < 3.5) return false;
  return revs(pts.map(p => p[0]), .2 * b.w) >= 4 || revs(pts.map(p => p[1]), .2 * b.h) >= 4;
}
/** Recognise a resampled stroke against lines, arrows, closed shapes, text-line waves and arrowheads for existing lines; null when nothing fits. */
export function classify(pts: P[], ctx: InkContext): Recognised | null {
  const n = pts.length, b = bbox(pts), diag = Math.hypot(b.w, b.h) || 1, Lp = plen(pts), s = 1 / ctx.scale, thr = 10 * s, TX = ctx.tx, TY = ctx.ty;
  if (diag < 10 * s) return null;
  const A = pts[0], B = pts[n - 1], chord = dist(A, B);
  // Clean = projection plus a share of the raw wobble; open strokes keep none at their ends.
  const mk = (proj: (p: P, i: number) => P, open: boolean, kind: Kind & { name: string }, wob = WOB): Recognised => ({ raw: pts.map(copy), clean: pts.map((p, i) => {
    const q = proj(p, i), w = open ? wob * Math.sin(Math.PI * i / (n - 1)) : wob;
    return [q[0] + (p[0] - q[0]) * w, q[1] + (p[1] - q[1]) * w];
  }), ...kind });
  if (chord / Lp > .94) {
    for (const t of ctx.inks) {
      if (t.form !== 'rect' || t.rot) continue;
      const { x, y, w, h } = t.rect, tol = .22 * Math.hypot(w, h), c: P[] = [[x, y], [x + w, y + h], [x + w, y], [x, y + h]];
      for (const [dir, i, j] of [[0, 0, 1], [1, 2, 3]] as const) {
        const fw = dist(A, c[i]) < tol && dist(B, c[j]) < tol, bw = dist(A, c[j]) < tol && dist(B, c[i]) < tol;
        if (fw || bw) { const a = fw ? c[i] : c[j], z = fw ? c[j] : c[i]; return mk((_p, k) => lerp(a, z, k / (n - 1)), true, { type: 'line', rect: t.id, dir, name: 'Line' }); }
      }
    }
    const [a, z] = snapSeg(A, B, TX, TY, thr);
    return mk((_p, i) => lerp(a, z, i / (n - 1)), true, { type: 'line', name: 'Line' });
  }
  let ti = 0, md = 0; pts.forEach((p, i) => { const d = dist(A, p); if (d > md) { md = d; ti = i; } });
  if (ti > n * .45 && ti < n - 6) {
    const tip = pts[ti], tm = Math.max(...pts.slice(ti).map(p => dist(p, tip)));
    if (md / plen(pts.slice(0, ti + 1)) > .93 && tm > .08 * md && tm < .55 * md) {
      const [a, z] = snapSeg(A, tip, TX, TY, thr), L0 = dist(a, z) || 1, back: P = [(a[0] - z[0]) / L0, (a[1] - z[1]) / L0], hl = Math.max(.12 * md, Math.min(.3 * md, tm));
      const r1 = rotv(back, 30), r2 = rotv(back, -30), b1: P = [z[0] + r1[0] * hl, z[1] + r1[1] * hl], b2: P = [z[0] + r2[0] * hl, z[1] + r2[1] * hl];
      return mk((p, i) => i <= ti ? lerp(a, z, i / ti) : nearest(p, [[z, b1], [z, b2]]), true, { type: 'arrow', name: 'Arrow' });
    }
  }
  if (chord < Math.max(.3 * Math.max(b.w, b.h), 14 * s) && Lp > 2.2 * Math.max(b.w, b.h)) {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, rx = Math.max(1, b.w / 2), ry = Math.max(1, b.h / 2);
    const eP = (p: P, X: number, Y: number, RX: number, RY: number): P => { const a = Math.atan2((p[1] - Y) / RY, (p[0] - X) / RX); return [X + RX * Math.cos(a), Y + RY * Math.sin(a)]; };
    // Clamp into the rectangle, then push interior points to the nearest side.
    const rP = (p: P, l: number, t: number, r: number, bt: number): P => {
      let x = Math.max(l, Math.min(r, p[0])), y = Math.max(t, Math.min(bt, p[1]));
      if (x > l && x < r && y > t && y < bt) { const m = Math.min(x - l, r - x, y - t, bt - y); if (m === x - l) x = l; else if (m === r - x) x = r; else if (m === y - t) y = t; else y = bt; }
      return [x, y];
    };
    const mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    const far = (f: P) => pts.reduce((m, p) => dist(p, f) > dist(m, f) ? p : m);
    const v1 = far([mx, my]), v2 = far(v1), ar = (q: P) => Math.abs((v2[0] - v1[0]) * (q[1] - v1[1]) - (v2[1] - v1[1]) * (q[0] - v1[0])), v3 = pts.reduce((m, p) => ar(p) > ar(m) ? p : m);
    const tri = (V: P[]): [P, P][] => [[V[0], V[1]], [V[1], V[2]], [V[2], V[0]]];
    const err = (f: (p: P) => P) => pts.reduce((a, p) => a + dist(p, f(p)), 0) / n / diag;
    const eE = err(p => eP(p, cx, cy, rx, ry)), rE = err(p => rP(p, b.x0, b.y0, b.x1, b.y1)), tE = err(p => nearest(p, tri([v1, v2, v3]))) * 1.15, best = Math.min(eE, rE, tE);
    if (best > .06) return null;
    if (best === rE) {
      let l = b.x0, t = b.y0, r = b.x1, bt = b.y1, name = 'Rectangle';
      if (Math.abs(b.w - b.h) / Math.max(b.w, b.h) < .1) { const h2 = (b.w + b.h) / 4, dx = shift([cx - h2, cx, cx + h2], TX, thr), dy = shift([cy - h2, cy, cy + h2], TY, thr); l = cx - h2 + dx; r = cx + h2 + dx; t = cy - h2 + dy; bt = cy + h2 + dy; name = 'Square'; }
      else { l = snapV(l, TX, thr); r = snapV(r, TX, thr); t = snapV(t, TY, thr); bt = snapV(bt, TY, thr); }
      return mk(p => rP(p, l, t, r, bt), false, { type: 'rect', name });
    }
    if (best === eE) {
      let RX = rx, RY = ry, name = 'Ellipse';
      if (Math.abs(rx - ry) / Math.max(rx, ry) < .14) { RX = RY = (rx + ry) / 2; name = 'Circle'; }
      const X = cx + shift([cx - RX, cx, cx + RX], TX, thr), Y = cy + shift([cy - RY, cy, cy + RY], TY, thr);
      return mk(p => eP(p, X, Y, RX, RY), false, { type: 'ellipse', name });
    }
    // Level any two vertices that are nearly at the same height.
    const V = [v1, v2, v3].map(copy);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(V[i][1] - V[j][1]) < .08 * diag) V[i][1] = V[j][1] = (V[i][1] + V[j][1]) / 2;
    return mk(p => nearest(p, tri(V)), false, { type: 'tri', name: 'Triangle' });
  }
  const ys = pts.map(p => p[1]);
  if (b.h / Math.max(b.w, 1) < .45 && b.w > 30 * s && revs(ys, .18 * b.h) >= 3 && revs(pts.map(p => p[0]), .25 * b.w) < 1) {
    const cy = snapV(ys.reduce((a, v) => a + v, 0) / n, TY, thr), l = snapV(b.x0, TX, thr), r = snapV(b.x1, TX, thr);
    return mk(p => [Math.max(l, Math.min(r, p[0])), cy], true, { type: 'wave', l, r, cy, name: 'Text line' }, .05);
  }
  const vi = rdp(pts, .15 * diag);
  if (vi.length !== 3) return null;
  const mi = vi[1], m = pts[mi], u1: P = [A[0] - m[0], A[1] - m[1]], u2: P = [B[0] - m[0], B[1] - m[1]];
  const ang = Math.acos(Math.max(-1, Math.min(1, (u1[0] * u2[0] + u1[1] * u2[1]) / ((Math.hypot(...u1) * Math.hypot(...u2)) || 1)))) * 180 / Math.PI;
  if (ang >= 110) return null;
  // A V drawn at the end of an existing line becomes that line's arrowhead.
  const hl = (dist(A, m) + dist(B, m)) / 2;
  for (const t of ctx.inks) {
    if (t.form !== 'line') continue;
    const pa = t.paths[0], e0 = pa[0], e1 = pa[pa.length - 1];
    for (const [E, O] of [[e0, e1], [e1, e0]]) {
      const L0 = dist(E, O) || 1;
      if (dist(E, m) > Math.max(24 * s, .6 * hl) || hl > .6 * L0) continue;
      const back: P = [(O[0] - E[0]) / L0, (O[1] - E[1]) / L0], r1 = rotv(back, 30), r2 = rotv(back, -30), w1: P = [E[0] + r1[0] * hl, E[1] + r1[1] * hl], w2: P = [E[0] + r2[0] * hl, E[1] + r2[1] * hl];
      const [b1, b2] = dist(A, w2) < dist(A, w1) ? [w2, w1] : [w1, w2];
      return mk((_p, i) => i <= mi ? lerp(b1, E, i / mi) : lerp(E, b2, (i - mi) / (n - 1 - mi)), true, { type: 'head', line: t.id, name: 'Arrow' });
    }
  }
  return null;
}
/** Frame rect (padded to at least `stroke` in each dimension) and the paths normalised to 0..1 within it, rounded to 1e-4. */
export function inkFrame(paths: P[][], stroke: number): { rect: Rect; paths: P[][] } {
  const b = bbox(paths.flat()); let x = b.x0, y = b.y0, w = b.w, h = b.h;
  if (w < stroke) { x -= (stroke - w) / 2; w = stroke; }
  if (h < stroke) { y -= (stroke - h) / 2; h = stroke; }
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  return { rect: { x, y, w, h }, paths: paths.map(p => p.map(([u, v]): P => [r4((u - x) / w), r4((v - y) / h)])) };
}
/** Normalised paths of a frame rect rotated `rot` degrees about its centre, in absolute unit coordinates. */
export function absolutePaths(paths: P[][], rect: Rect, rot: number): P[][] {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, a = rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
  return paths.map(p => p.map(([u, v]): P => { const dx = rect.x + u * rect.w - cx, dy = rect.y + v * rect.h - cy; return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs]; }));
}
/** Eraser hit test: does a circle of radius `r` at `p` touch any segment of the paths, widened by half the stroke? */
export const touches = (paths: P[][], p: P, r: number, stroke: number): boolean => paths.some(pa => pa.some((q, i) => i > 0 && dist(segP(p, pa[i - 1], q), p) < r + stroke / 2));
/** 1-2-1 moving average applied to strokes that are not recognised; ends average with themselves. */
export const smooth = (pts: P[]): P[] => pts.map((p, i) => {
  const q = pts[Math.max(0, i - 1)], z = pts[Math.min(pts.length - 1, i + 1)];
  return [(q[0] + p[0] * 2 + z[0]) / 4, (q[1] + p[1] * 2 + z[1]) / 4];
});
