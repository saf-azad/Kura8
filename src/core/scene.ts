import type { Measure, Point, Rect, Size } from './geometry';
import type { KuraDoc } from './document';
import { canvasSize } from './ratios';
import { resolve } from './palette';
import { shapeLibrary, shapeOutline, ICON_SHAPE } from './shapes';
import { BASELINE, LINE_HEIGHT, textBox, typeScale } from './fit';
import { direction, fontStack, physicalAlign } from './script';
import { CENTRE } from './images';
// The draw list both the canvas renderer and SVG export consume: colours resolved, text wrapped, alignment made
// physical, paths in each node's local box. Every op draws in a box of rect.w × rect.h rotated `rot` degrees about the rect centre.
export type SceneOp =
  | { kind: 'shape'; id: string; rect: Rect; rot: number; fill: string; d: string; scale?: [number, number] }
  | { kind: 'text'; id: string; rect: Rect; rot: number; fill: string; size: number; weight: 400 | 700; align: 'left' | 'center' | 'right'; dir: 'ltr' | 'rtl'; font: string; lines: string[]; lineHeight: number; /** Line top to alphabetic baseline. */ baseline: number }
  | { kind: 'image'; id: string; rect: Rect; rot: number; asset: string | null; cutout: boolean; focus: Point }
  | { kind: 'ink'; id: string; rect: Rect; rot: number; fill: string; stroke: number; paths: [number, number][][] };
/** `filled` is false when the ground was never filled (5z); `hidden` counts nodes hidden in this size (5y); `empty` counts empty image frames. */
export type Scene = { size: Size; ground: string; filled: boolean; ops: SceneOp[]; hidden: number; empty: number };
export function buildScene(doc: KuraDoc, sizeId: string, measure: Measure): Scene {
  const spec = doc.sizes.find(s => s.id === sizeId) ?? doc.sizes[0], size = canvasSize(spec.ratio), scale = typeScale(spec.guide, size), p = doc.palette;
  const ops: SceneOp[] = [];
  let hidden = 0, empty = 0;
  for (const n of doc.nodes) {
    const f = n.frames[spec.id];
    if (f.hidden) { hidden++; continue; }
    const { rect, rot } = f;
    if (n.kind === 'shape') {
      const outline = n.shape === ICON_SHAPE && n.icon ? { d: n.icon.d, scale: [rect.w / 100, rect.h / 100] as [number, number] } : shapeOutline(shapeLibrary[n.shape] ?? shapeLibrary.rect, rect.w, rect.h);
      ops.push({ kind: 'shape', id: n.id, rect, rot, fill: resolve(n.fill, p), ...outline });
    } else if (n.kind === 'text') {
      const box = textBox(n, f, measure, scale), dir = direction(n.text);
      ops.push({ kind: 'text', id: n.id, rect: box.rect, rot, fill: resolve(n.fill, p), size: box.size, weight: n.weight, align: physicalAlign(n.align, dir), dir, font: fontStack(n.text), lines: box.lines, lineHeight: box.size * LINE_HEIGHT, baseline: box.size * (LINE_HEIGHT / 2 + BASELINE) });
    } else if (n.kind === 'image') {
      if (!n.asset) empty++;
      ops.push({ kind: 'image', id: n.id, rect, rot, asset: n.asset, cutout: !!n.cutout, focus: n.focus ?? CENTRE });
    } else ops.push({ kind: 'ink', id: n.id, rect, rot, fill: resolve(n.fill, p), stroke: n.stroke, paths: n.paths.map(path => path.map(([u, v]): [number, number] => [u * rect.w, v * rect.h])) });
  }
  return { size, ground: resolve(doc.ground ?? { role: 'ground' }, p), filled: doc.ground !== null, ops, hidden, empty };
}
