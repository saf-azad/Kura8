import type { Guide } from './types';
import { grid } from './grid';
export const divisions: Guide = { id: 'divisions', name: 'Simple divisions', generate(canvas) {
  const { w, h } = canvas;
  return [...grid(canvas, [1 / 4, 1 / 2, 3 / 4], false),
    ...['tl', 'tr', 'bl', 'br'].map((name, i) => ({ kind: 'region' as const, id: `region-quad-${name}`, rect: { x: i % 2 * w / 2, y: Math.floor(i / 2) * h / 2, w: w / 2, h: h / 2 } })),
    { kind: 'region', id: 'region-band-v', rect: { x: w / 4, y: 0, w: w / 2, h } },
    { kind: 'region', id: 'region-band-h', rect: { x: 0, y: h / 4, w, h: h / 2 } },
  ];
} };
