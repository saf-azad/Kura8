import type { Guide, Anchor } from './types';
import { grid } from './grid';
export const PHI = (1 + Math.sqrt(5)) / 2;
export const golden: Guide = { id: 'golden', name: 'Golden ratio', generate(canvas) {
  const { w, h } = canvas;
  const gh = Math.min(h, w / PHI), gw = Math.min(w, h / PHI);
  const extra: Anchor[] = [
    { kind: 'region', id: 'region-golden-top', rect: { x: 0, y: 0, w, h: gh } },
    { kind: 'region', id: 'region-golden-bottom', rect: { x: 0, y: h - gh, w, h: gh } },
    { kind: 'region', id: 'region-golden-left', rect: { x: 0, y: 0, w: gw, h } },
    { kind: 'region', id: 'region-golden-right', rect: { x: w - gw, y: 0, w: gw, h } },
  ];
  return [...grid(canvas, [1 - 1 / PHI, 1 / PHI], true), ...extra.filter(a => a.kind === 'region' && !(a.rect.w === w && a.rect.h === h))];
} };
