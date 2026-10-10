import type { Frame, KuraDoc } from '../../core/document';
import { norm } from '../../core/geometry';
// Moves nodes between two documents over 280 ms on cubic-bezier(.2,0,.2,1): rect, rotation and font size.
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, t: number) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t * t + t ** 3;
  return x => {
    if (x <= 0 || x >= 1) return Math.max(0, Math.min(1, x));
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (at(x1, x2, t) < x) lo = t; else hi = t; }
    return at(y1, y2, t);
  };
}
export const ease = bezier(.2, 0, .2, 1);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpFrame(a: Frame, b: Frame, t: number): Frame {
  return { ...b, rect: { x: mix(a.rect.x, b.rect.x, t), y: mix(a.rect.y, b.rect.y, t), w: mix(a.rect.w, b.rect.w, t), h: mix(a.rect.h, b.rect.h, t) }, rot: a.rot + norm(b.rot - a.rot) * t,
    ...(b.fontSize !== undefined ? { fontSize: mix(a.fontSize ?? b.fontSize, b.fontSize, t) } : {}) };
}
/** `to` with every node that also exists in `from` placed part-way between its two frames in one size. */
export function lerpDoc(from: KuraDoc, to: KuraDoc, sizeId: string, t: number): KuraDoc {
  const before = new Map(from.nodes.map(n => [n.id, n.frames[sizeId]]));
  return { ...to, nodes: to.nodes.map(n => { const a = before.get(n.id), b = n.frames[sizeId]; return a && b ? { ...n, frames: { ...n.frames, [sizeId]: lerpFrame(a, b, t) } } : n; }) };
}
export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Runs one tween at a time; `frame` receives the display document, `done` fires at the end or on cancel. */
export class Tween {
  private raf = 0;
  private finish?: () => void;
  get running(): boolean { return this.raf !== 0; }
  start(from: KuraDoc, to: KuraDoc, sizeId: string, frame: (doc: KuraDoc) => void, done: () => void, ms = 280): void {
    this.cancel();
    if (reducedMotion()) { done(); return; }
    const t0 = performance.now();
    this.finish = done;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      if (t >= 1) { this.raf = 0; this.finish = undefined; done(); return; }
      frame(lerpDoc(from, to, sizeId, ease(t))); this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  cancel(): void { if (!this.raf) return; cancelAnimationFrame(this.raf); this.raf = 0; const f = this.finish; this.finish = undefined; f?.(); }
}
