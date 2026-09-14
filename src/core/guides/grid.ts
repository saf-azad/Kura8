import type { Size } from '../geometry';
import type { Anchor } from './types';
export function grid(canvas: Size, fractions: number[], cells: boolean): Anchor[] {
  const xs = fractions.map(f => f * canvas.w), ys = fractions.map(f => f * canvas.h);
  const result: Anchor[] = [
    ...xs.map((at, i): Anchor => ({ kind: 'line', id: `line-x-${i + 1}`, axis: 'x', at })),
    ...ys.map((at, i): Anchor => ({ kind: 'line', id: `line-y-${i + 1}`, axis: 'y', at })),
  ];
  xs.forEach((x, c) => ys.forEach((y, r) => result.push({ kind: 'point', id: `point-x${c + 1}-y${r + 1}`, x, y })));
  if (cells) {
    const xx = [0, ...xs, canvas.w], yy = [0, ...ys, canvas.h];
    for (let r = 0; r < yy.length - 1; r++) for (let c = 0; c < xx.length - 1; c++)
      result.push({ kind: 'region', id: `region-cell-${r}-${c}`, rect: { x: xx[c], y: yy[r], w: xx[c + 1] - xx[c], h: yy[r + 1] - yy[r] } });
  }
  return result;
}
