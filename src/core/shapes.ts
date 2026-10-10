// The shape library (41 shapes in five groups), ported from the prototype's SHAPES. Path shapes are drawn in a
// 100 × 100 box and stretched to the frame; box shapes (css) are built at the frame size so radii and ring
// thickness stay round.
export type BoxShape = 'rect' | 'rounded' | 'pill' | 'circle' | 'ring' | 'frame';
export type ShapeDef = { key: string; name: string; group: string; ar: number; css?: BoxShape; d?: string };
type Pt = [number, number];
const n2 = (v: number) => +v.toFixed(2);
const toD = (pts: Pt[]) => 'M' + pts.map(p => `${n2(p[0])} ${n2(p[1])}`).join('L') + 'Z';
function poly(pts: Pt[], ar?: number): { d: string; ar: number } {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { d: toD(pts.map(([x, y]) => [(x - x0) / (x1 - x0) * 100, (y - y0) / (y1 - y0) * 100])), ar: ar ?? (x1 - x0) / (y1 - y0) };
}
const regular = (n: number, a0: number): Pt[] => Array.from({ length: n }, (_, i) => { const a = (a0 + i * 360 / n) * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; });
const star = (n: number, r: number): Pt[] => Array.from({ length: 2 * n }, (_, i) => { const a = (-90 + i * 180 / n) * Math.PI / 180, q = i % 2 ? r : 1; return [q * Math.cos(a), q * Math.sin(a)]; });
const turn = (pts: Pt[], deg: number): Pt[] => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
const plus: Pt[] = ([[35, 0], [65, 0], [65, 35], [100, 35], [100, 65], [65, 65], [65, 100], [35, 100], [35, 65], [0, 65], [0, 35], [35, 35]] as Pt[]).map(([x, y]) => [x - 50, y - 50]);
const arrow: Pt[] = ([[0, 30], [58, 30], [58, 5], [100, 50], [58, 95], [58, 70], [0, 70]] as Pt[]).map(([x, y]) => [x - 50, y - 50]);
const scallop = (() => {
  const n = 10, r = 38.5, pts = Array.from({ length: n }, (_, i) => { const a = (-90 + i * 360 / n) * Math.PI / 180; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; }), ch = r * Math.sin(Math.PI / n);
  return 'M' + pts[0].map(v => v.toFixed(2)).join(' ') + pts.map((_, i) => { const q = pts[(i + 1) % n]; return `A${ch.toFixed(2)} ${ch.toFixed(2)} 0 0 1 ${q[0].toFixed(2)} ${q[1].toFixed(2)}`; }).join('') + 'Z';
})();
type Entry = [string, string, { css?: BoxShape; d?: string; ar: number }];
const groups: [string, Entry[]][] = [
  ['Basic', [['rect', 'Rectangle', { css: 'rect', ar: 1.25 }], ['rounded', 'Rounded', { css: 'rounded', ar: 1.25 }], ['pill', 'Pill', { css: 'pill', ar: 2.4 }], ['circle', 'Circle', { css: 'circle', ar: 1 }], ['ring', 'Ring', { css: 'ring', ar: 1 }], ['frame', 'Frame', { css: 'frame', ar: 1 }], ['semi', 'Half circle', { d: 'M0 100A50 100 0 0 1 100 100Z', ar: 2 }], ['quarter', 'Quarter', { d: 'M0 0A100 100 0 0 1 100 100H0Z', ar: 1 }], ['arch', 'Arch', { d: 'M0 100V50A50 50 0 0 1 100 50V100Z', ar: .8 }]]],
  ['Polygons', [['tri', 'Triangle', poly([[50, 0], [100, 100], [0, 100]], 1.15)], ['rtri', 'Right triangle', poly([[0, 0], [100, 100], [0, 100]], 1)], ['diamond', 'Diamond', poly([[50, 0], [100, 50], [50, 100], [0, 50]], .8)], ['pent', 'Pentagon', poly(regular(5, -90))], ['hex', 'Hexagon', poly(regular(6, 0))], ['oct', 'Octagon', poly(regular(8, 22.5))], ['pgram', 'Parallelogram', poly([[25, 0], [100, 0], [75, 100], [0, 100]], 1.5)], ['trap', 'Trapezoid', poly([[22, 0], [78, 0], [100, 100], [0, 100]], 1.5)]]],
  ['Stars', [['star4', 'Star 4', poly(star(4, .42))], ['star5', 'Star 5', poly(star(5, .45))], ['star6', 'Star 6', poly(star(6, .55))], ['star8', 'Star 8', poly(star(8, .62))], ['burst', 'Burst', poly(star(16, .8))], ['sparkle', 'Sparkle', { d: 'M50 0Q56 44 100 50Q56 56 50 100Q44 56 0 50Q44 44 50 0Z', ar: 1 }], ['plus', 'Plus', poly(plus)], ['cross', 'Cross', poly(turn(plus, 45))]]],
  ['Arrows and lines', [['arrowR', 'Arrow right', poly(arrow, 1.4)], ['arrowL', 'Arrow left', poly(turn(arrow, 180), 1.4)], ['arrowU', 'Arrow up', poly(turn(arrow, -90), 1 / 1.4)], ['arrowD', 'Arrow down', poly(turn(arrow, 90), 1 / 1.4)], ['chevron', 'Chevron', poly([[0, 0], [60, 0], [100, 50], [60, 100], [0, 100], [40, 50]], .8)], ['double', 'Double arrow', poly([[0, 50], [28, 10], [28, 32], [72, 32], [72, 10], [100, 50], [72, 90], [72, 68], [28, 68], [28, 90]], 2)], ['arrowline', 'Arrow line', poly([[0, 44], [84, 44], [84, 28], [100, 50], [84, 72], [84, 56], [0, 56]], 7)], ['line', 'Line', { css: 'rect', ar: 60 }]]],
  ['Organic', [['drop', 'Drop', { d: 'M50 0C62 22 88 44 88 64A38 36 0 0 1 12 64C12 44 38 22 50 0Z', ar: .8 }], ['heart', 'Heart', { d: 'M50 94C24 74 0 56 0 30A26 26 0 0 1 50 16A26 26 0 0 1 100 30C100 56 76 74 50 94Z', ar: 1.08 }], ['bubble', 'Speech bubble', { d: 'M10 0H90A10 10 0 0 1 100 10V65A10 10 0 0 1 90 75H40L20 100V75H10A10 10 0 0 1 0 65V10A10 10 0 0 1 10 0Z', ar: 1.25 }], ['crescent', 'Crescent', { d: 'M70 4A50 50 0 1 0 70 96A48 48 0 0 1 70 4Z', ar: 1 }], ['blob', 'Blob', { d: 'M56 3C82 6 99 28 95 54C91 80 70 99 44 96C18 93 1 72 5 46C9 20 30 0 56 3Z', ar: 1 }], ['wave', 'Wave', { d: 'M0 30C16 10 34 10 50 30S84 50 100 30V100H0Z', ar: 2 }], ['leaf', 'Leaf', { d: 'M0 100C0 45 45 0 100 0C100 55 55 100 0 100Z', ar: 1 }], ['scallop', 'Scallop', { d: scallop, ar: 1 }]]],
];
export const shapeGroups: { name: string; keys: string[] }[] = groups.map(([name, list]) => ({ name, keys: list.map(e => e[0]) }));
export const shapeLibrary: Record<string, ShapeDef> = Object.fromEntries(groups.flatMap(([group, list]) => list.map(([key, name, def]): [string, ShapeDef] => [key, { key, name, group, ...def }])));
/** Node shape value used for icons; the path travels inline on the node. */
export const ICON_SHAPE = 'icon';
export const isShape = (key: string): boolean => key in shapeLibrary;
/** Outline of a box shape at its real size, or a path shape in its 100-unit box with the scale to stretch it to `w` × `h`. Fill with even-odd. */
export function shapeOutline(def: { css?: BoxShape; d?: string }, w: number, h: number): { d: string; scale?: [number, number] } {
  if (def.d) return { d: def.d, scale: [w / 100, h / 100] };
  const m = Math.min(w, h), t = m * .18;
  const rect = (x: number, y: number, rw: number, rh: number) => `M${n2(x)} ${n2(y)}H${n2(x + rw)}V${n2(y + rh)}H${n2(x)}Z`;
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${n2(cx - rx)} ${n2(cy)}A${n2(rx)} ${n2(ry)} 0 1 0 ${n2(cx + rx)} ${n2(cy)}A${n2(rx)} ${n2(ry)} 0 1 0 ${n2(cx - rx)} ${n2(cy)}Z`;
  const rounded = (r: number) => `M${n2(r)} 0H${n2(w - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(w)} ${n2(r)}V${n2(h - r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(w - r)} ${n2(h)}H${n2(r)}A${n2(r)} ${n2(r)} 0 0 1 0 ${n2(h - r)}V${n2(r)}A${n2(r)} ${n2(r)} 0 0 1 ${n2(r)} 0Z`;
  switch (def.css) {
    case 'rounded': return { d: rounded(t) };
    case 'pill': return { d: rounded(m / 2) };
    case 'circle': return { d: ellipse(w / 2, h / 2, w / 2, h / 2) };
    case 'ring': return { d: ellipse(w / 2, h / 2, w / 2, h / 2) + ellipse(w / 2, h / 2, Math.max(.5, w / 2 - t), Math.max(.5, h / 2 - t)) };
    case 'frame': return { d: rect(0, 0, w, h) + rect(t, t, w - 2 * t, h - 2 * t) };
    default: return { d: rect(0, 0, w, h) };
  }
}
/** Default frame size for a new shape of aspect `ar` on a `canvas`: about a third of the short side, lines half the width. */
export function defaultShapeSize(ar: number, canvas: { w: number; h: number }): { w: number; h: number } {
  const base = Math.min(canvas.w, canvas.h) * .32;
  if (ar > 5) { const w = canvas.w * .5; return { w, h: Math.max(4, w / ar) }; }
  return ar >= 1 ? { w: base, h: base / ar } : { w: base * ar, h: base };
}
