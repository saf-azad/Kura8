import { modn, norm } from './geometry';
import type { RatioId } from './document';
import { ratioIds } from './document';
import { formats, formatById, formatFor, type FormatId } from './ratios';
// Dial geometry: four concentric rings in a 640-unit SVG, each turned in detents. Rotation is the ring's angle in
// degrees; the selected segment sits under the pointer at the top.
/**
 * The ratio ring's stops (D-092, Safwat): Instagram and LinkedIn formats share one Social segment, which opens into a
 * stop per format; the ratios no platform format uses (Pin, Print, Slide, Banner) keep their own segments.
 */
export type StopId = 'social' | FormatId | RatioId;
export const PLAIN_RATIOS: RatioId[] = ratioIds.filter(id => !formats.some(f => f.ratio === id));
export const ratioStops = (open: boolean): StopId[] => [...(open ? formats.map(f => f.id) : ['social' as const]), ...PLAIN_RATIOS];
export type RingKey = 'ratio' | 'comp' | 'guide' | 'hue';
export type Ring = { key: RingKey; n: number; ro: number; ri: number; name: string };
export const RINGS: Ring[] = [
  { key: 'ratio', n: ratioStops(false).length, ro: 318, ri: 270, name: 'Ratio' }, { key: 'comp', n: 6, ro: 266, ri: 190, name: 'Layout' },
  { key: 'guide', n: 3, ro: 186, ri: 144, name: 'Guide' }, { key: 'hue', n: 13, ro: 140, ri: 110, name: 'Colour' },
];
const n2 = (v: number) => +v.toFixed(3);
const polar = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
/** Annular segment from angle `from` to `to` (degrees clockwise from the top), with its label centre `c`. */
export function arcPath(cx: number, cy: number, ro: number, ri: number, from: number, to: number): { d: string; c: [number, number] } {
  const a0 = (from - 90) * Math.PI / 180, a1 = (to - 90) * Math.PI / 180;
  const [x0, y0] = polar(cx, cy, ro, a0), [x1, y1] = polar(cx, cy, ro, a1), [x2, y2] = polar(cx, cy, ri, a1), [x3, y3] = polar(cx, cy, ri, a0);
  const large = to - from > 180 ? 1 : 0, c = polar(cx, cy, (ro + ri) / 2, (a0 + a1) / 2);
  return { d: `M${n2(x0)} ${n2(y0)}A${ro} ${ro} 0 ${large} 1 ${n2(x1)} ${n2(y1)}L${n2(x2)} ${n2(y2)}A${ri} ${ri} 0 ${large} 0 ${n2(x3)} ${n2(y3)}Z`, c: [n2(c[0]), n2(c[1])] };
}
/** Annular segment `i` of `n`, centred on the top for i = 0, with its label centre `c`. */
export const ringPath = (cx: number, cy: number, ro: number, ri: number, i: number, n: number): { d: string; c: [number, number] } =>
  arcPath(cx, cy, ro, ri, (i - .5) * 360 / n, (i + .5) * 360 / n);
/** The stop that shows a ratio (and the remembered format) on the ring. */
export function stopOf(stops: StopId[], ratio: RatioId, format?: string): number {
  const f = formatFor(ratio, format);
  return stops.indexOf(!f ? ratio : stops.includes(f.id) ? f.id : 'social');
}
/** The setting a stop picks; Social picks the remembered format, the first when none is. */
export function settingFor(stop: StopId, remembered?: string): { ratio: RatioId; format?: FormatId } {
  const f = stop === 'social' ? formatById(remembered) ?? formats[0] : formatById(stop);
  return f ? { ratio: f.ratio, format: f.id } : { ratio: stop as RatioId };
}
/**
 * Each open stop's span (degrees clockwise from the top) as Social opens: at t = 0 the formats share Social's segment
 * of the closed ring and the other ratios sit in theirs; at t = 1 every stop has an equal share of the open ring.
 */
export function ratioSpans(t: number): { id: StopId; from: number; to: number }[] {
  const open = ratioStops(true), closed = ratioStops(false).length, s0 = 360 / closed, s1 = 360 / open.length, k = formats.length;
  return open.map((id, i) => {
    const a = i < k ? -s0 / 2 + i * s0 / k : (i - k + .5) * s0, w0 = i < k ? s0 / k : s0;
    return { id, from: a + (i * s1 - s1 / 2 - a) * t, to: a + w0 + (i * s1 + s1 / 2 - a - w0) * t };
  });
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
