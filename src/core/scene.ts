import type { Measure, Point, Rect, Size } from './geometry';
import type { DocNode, KuraDoc, Palette } from './document';
import { canvasSize } from './ratios';
import { resolve, rgbOf } from './palette';
import { shapeLibrary, shapeOutline, ICON_SHAPE } from './shapes';
import { LINE_HEIGHT, textBox, typeScale } from './fit';
import { direction, fontStack, physicalAlign } from './script';
import { CENTRE } from './images';
import { lookOf, type Look } from './look';
// The draw list both the canvas renderer and SVG export consume: colours resolved, text wrapped, alignment made
// physical, paths in each node's local box. Every op draws in a box of rect.w × rect.h rotated `rot` degrees about the rect centre.
/** Effects shared by every kind (D-045); present only when set. Shadow offsets are page-fixed; outline widths are in units. */
export type Fx = { opacity?: number; shadow?: { x: number; y: number; blur: number; colour: string; alpha: number }; flip?: [boolean, boolean]; outline?: { colour: string; width: number } };
export type Outline = { d: string; scale?: [number, number] };
export type SceneOp = (
  | { kind: 'shape'; id: string; rect: Rect; rot: number; fill: string; d: string; scale?: [number, number]; gradient?: { from: string; to: string; angle: number } }
  | { kind: 'text'; id: string; rect: Rect; rot: number; fill: string; size: number; weight: 400 | 700; align: 'left' | 'center' | 'right'; dir: 'ltr' | 'rtl'; font: string; lines: string[]; lineHeight: number;
      italic?: boolean; underline?: boolean; spacing?: number }
  | { kind: 'image'; id: string; rect: Rect; rot: number; asset: string | null; cutout: boolean; focus: Point; zoom?: number; look?: Look; mask?: Outline }
  | { kind: 'ink'; id: string; rect: Rect; rot: number; fill: string; stroke: number; paths: [number, number][][] }
) & { fx?: Fx };
/** `filled` is false when the ground was never filled (5z); `hidden` counts nodes hidden in this size (5y); `empty` counts empty image frames. */
export type Scene = { size: Size; ground: string; filled: boolean; ops: SceneOp[]; hidden: number; empty: number };
export const rgba = (hex: string, alpha: number): string => `rgba(${rgbOf(hex).join(',')},${+alpha.toFixed(3)})`;
function fxOf(n: DocNode, p: Palette): Fx | undefined {
  const fx: Fx = {}, outline = n.kind === 'ink' ? undefined : n.outline;
  if (n.opacity !== undefined && n.opacity < 1) fx.opacity = n.opacity;
  if (n.shadow) fx.shadow = { x: n.shadow.x, y: n.shadow.y, blur: n.shadow.blur, colour: resolve(n.shadow.fill, p), alpha: n.shadow.alpha };
  if (n.flipX || n.flipY) fx.flip = [!!n.flipX, !!n.flipY];
  if (outline) fx.outline = { colour: resolve(outline.fill, p), width: outline.width };
  return Object.keys(fx).length ? fx : undefined;
}
export function buildScene(doc: KuraDoc, sizeId: string, measure: Measure): Scene {
  const spec = doc.sizes.find(s => s.id === sizeId) ?? doc.sizes[0], size = canvasSize(spec.ratio), scale = typeScale(spec.guide, size), p = doc.palette;
  const ops: SceneOp[] = [];
  let hidden = 0, empty = 0;
  for (const n of doc.nodes) {
    const f = n.frames[spec.id];
    if (f.hidden) { hidden++; continue; }
    const { rect, rot } = f, fx = fxOf(n, p), extra = fx ? { fx } : {};
    if (n.kind === 'shape') {
      const outline = n.shape === ICON_SHAPE && n.icon ? { d: n.icon.d, scale: [rect.w / 100, rect.h / 100] as [number, number] } : shapeOutline(shapeLibrary[n.shape] ?? shapeLibrary.rect, rect.w, rect.h);
      const fill = resolve(n.fill, p), gradient = n.gradient ? { gradient: { from: fill, to: resolve(n.gradient.to, p), angle: n.gradient.angle } } : {};
      ops.push({ kind: 'shape', id: n.id, rect, rot, fill, ...outline, ...gradient, ...extra });
    } else if (n.kind === 'text') {
      const box = textBox(n, f, measure, scale), dir = direction(n.text);
      const style = { ...(n.italic ? { italic: true } : {}), ...(n.underline ? { underline: true } : {}), ...(n.spacing ? { spacing: n.spacing / 1000 * box.size } : {}) };
      ops.push({ kind: 'text', id: n.id, rect: box.rect, rot, fill: resolve(n.fill, p), size: box.size, weight: n.weight, align: physicalAlign(n.align, dir), dir, font: fontStack(n.text, n.font), lines: box.lines,
        lineHeight: box.size * (n.leading ?? LINE_HEIGHT), ...style, ...extra });
    } else if (n.kind === 'image') {
      if (!n.asset) empty++;
      const look = lookOf(n, p), mask = n.mask ? shapeOutline(shapeLibrary[n.mask], rect.w, rect.h) : undefined;
      ops.push({ kind: 'image', id: n.id, rect, rot, asset: n.asset, cutout: !!n.cutout, focus: n.focus ?? CENTRE, ...(n.zoom && n.zoom !== 1 ? { zoom: n.zoom } : {}), ...(look ? { look } : {}), ...(mask ? { mask } : {}), ...extra });
    } else ops.push({ kind: 'ink', id: n.id, rect, rot, fill: resolve(n.fill, p), stroke: n.stroke, paths: n.paths.map(path => path.map(([u, v]): [number, number] => [u * rect.w, v * rect.h])), ...extra });
  }
  return { size, ground: resolve(doc.ground ?? { role: 'ground' }, p), filled: doc.ground !== null, ops, hidden, empty };
}
/** Gradient end points in a w × h box for an angle (0° left to right, 90° top to bottom), spanning the box's projection. */
export function gradientLine(w: number, h: number, angle: number): [number, number, number, number] {
  const a = angle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return [w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half];
}
