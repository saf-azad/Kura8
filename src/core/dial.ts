import { modn, norm } from './geometry';
import { ratioIds } from './document';
// Dial geometry: four concentric rings in a 640-unit SVG, each turned in detents. Rotation is the ring's angle in
// degrees; the selected segment sits under the pointer at the top.
export type RingKey = 'ratio' | 'comp' | 'guide' | 'hue';
export type Ring = { key: RingKey; n: number; ro: number; ri: number; name: string };
export const RINGS: Ring[] = [
  { key: 'ratio', n: ratioIds.length, ro: 318, ri: 270, name: 'Ratio' }, { key: 'comp', n: 6, ro: 266, ri: 190, name: 'Layout' },
  { key: 'guide', n: 3, ro: 186, ri: 144, name: 'Guide' }, { key: 'hue', n: 13, ro: 140, ri: 110, name: 'Colour' },
];
const n2 = (v: number) => +v.toFixed(3);
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
/** Annular segment `i` of `n`, centred on the top for i = 0, with its label centre `c`. */
export function ringPath(cx: number, cy: number, ro: number, ri: number, i: number, n: number): { d: string; c: [number, number] } {
  const step = 2 * Math.PI / n, a0 = -Math.PI / 2 - step / 2 + i * step, a1 = a0 + step;
  const [x0, y0] = polar(cx, cy, ro, a0), [x1, y1] = polar(cx, cy, ro, a1), [x2, y2] = polar(cx, cy, ri, a1), [x3, y3] = polar(cx, cy, ri, a0);
  const large = step > Math.PI ? 1 : 0, c = polar(cx, cy, (ro + ri) / 2, (a0 + a1) / 2);
  return { d: `M${n2(x0)} ${n2(y0)}A${ro} ${ro} 0 ${large} 1 ${n2(x1)} ${n2(y1)}L${n2(x2)} ${n2(y2)}A${ri} ${ri} 0 ${large} 0 ${n2(x3)} ${n2(y3)}Z`, c: [n2(c[0]), n2(c[1])] };
}
export const stepOf = (n: number): number => 360 / n;
/** Rotation that brings segment `index` to the top, turning the short way from `current`. */
export const rotationFor = (current: number, index: number, n: number): number => current + norm(-index * stepOf(n) - current);
/** The segment under the pointer at a rotation. */
export const indexAt = (rotation: number, n: number): number => modn(Math.round(-rotation / stepOf(n)), n);
/** While dragging, the ring sticks near each detent and moves quickly between them. */
export function detent(raw: number, n: number): number {
  const step = stepOf(n), target = Math.round(raw / step) * step, u = (raw - target) / (step / 2);
  return target + step / 2 * Math.sign(u) * Math.abs(u) ** 2.6;
}
export const settle = (raw: number, n: number): number => Math.round(raw / stepOf(n)) * stepOf(n);
