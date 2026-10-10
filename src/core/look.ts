import type { Adjust, AdjustKey, ImageNode, Palette } from './document';
import { adjustKeys } from './document';
import { resolve } from './palette';
// Photo looks (D-045): adjustments, one-tap filters and duotone as pure pixel maths on unpremultiplied RGBA. The app
// runs them on decoded bitmaps (screen-sized while editing, full size on export); radii are fractions of the image's
// long side so a look reads the same at every resolution. Deterministic image processing, no learned models.
export type Look = { adjust: Adjust; duotone?: [string, string] };
/** Drops zero values; undefined when nothing is left. */
export function cleanAdjust(a: Adjust | undefined): Adjust | undefined {
  const out: Adjust = {};
  for (const k of adjustKeys) if (a?.[k]) out[k] = a[k];
  return Object.keys(out).length ? out : undefined;
}
/** The resolved look of an image node, or null when it draws its pixels unchanged. */
export function lookOf(n: Pick<ImageNode, 'adjust' | 'duotone'>, p: Palette): Look | null {
  const adjust = cleanAdjust(n.adjust), duotone = n.duotone && [resolve(n.duotone.dark, p), resolve(n.duotone.light, p)] as [string, string];
  if (!adjust && !duotone) return null;
  return { adjust: adjust ?? {}, ...(duotone ? { duotone } : {}) };
}
export const lookKey = (look: Look | null): string => look ? adjustKeys.map(k => look.adjust[k] ?? 0).join(',') + (look.duotone ? `|${look.duotone.join(',')}` : '') : '';
/** One-tap filters: named adjustment sets. Choosing one replaces the adjustments; the sliders then fine-tune it. */
export const FILTERS: { id: string; name: string; adjust: Adjust }[] = [
  { id: 'none', name: 'None', adjust: {} },
  { id: 'mono', name: 'Mono', adjust: { saturation: -100, contrast: 10 } },
  { id: 'noir', name: 'Noir', adjust: { saturation: -100, contrast: 45, brightness: -10, vignette: 40 } },
  { id: 'warm', name: 'Warm', adjust: { warmth: 35, saturation: 10 } },
  { id: 'cool', name: 'Cool', adjust: { warmth: -35, tint: -5 } },
  { id: 'vivid', name: 'Vivid', adjust: { saturation: 45, contrast: 20 } },
  { id: 'fade', name: 'Fade', adjust: { contrast: -35, brightness: 12, saturation: -20 } },
  { id: 'dusk', name: 'Dusk', adjust: { warmth: 20, tint: 25, contrast: 10, vignette: 25 } },
  { id: 'retro', name: 'Retro', adjust: { warmth: 25, contrast: -15, saturation: -25, vignette: 30 } },
  { id: 'soft', name: 'Soft', adjust: { blur: 8, brightness: 8, contrast: -10 } },
];
/** The filter whose adjustments equal `a` exactly, or null for hand-set values. */
export function filterOf(a: Adjust | undefined): string | null {
  const key = (x: Adjust | undefined) => adjustKeys.map(k => x?.[k] ?? 0).join();
  return FILTERS.find(f => key(f.adjust) === key(a))?.id ?? null;
}
const hexRgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const clamp = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v;
/** Separable box blur, run three times (close to a Gaussian), on premultiplied channels so transparent edges do not darken. */
function blurPremultiplied(src: Float32Array, w: number, h: number, r: number): Float32Array {
  let a: Float32Array = src, b: Float32Array = new Float32Array(src.length);
  const pass = (from: Float32Array, to: Float32Array, horizontal: boolean) => {
    const len = horizontal ? w : h, lines = horizontal ? h : w, step = horizontal ? 4 : 4 * w, size = 2 * r + 1;
    for (let line = 0; line < lines; line++) {
      const base = horizontal ? line * w * 4 : line * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += from[base + Math.min(len - 1, Math.max(0, i)) * step + c];
        for (let i = 0; i < len; i++) {
          to[base + i * step + c] = sum / size;
          sum += from[base + Math.min(len - 1, i + r + 1) * step + c] - from[base + Math.max(0, i - r) * step + c];
        }
      }
    }
  };
  for (let k = 0; k < 3; k++) { pass(a, b, true); [a, b] = [b, a]; pass(a, b, false); [a, b] = [b, a]; }
  return a;
}
function premultiply(px: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(px.length);
  for (let i = 0; i < px.length; i += 4) { const k = px[i + 3] / 255; out[i] = px[i] * k; out[i + 1] = px[i + 1] * k; out[i + 2] = px[i + 2] * k; out[i + 3] = px[i + 3]; }
  return out;
}
const unpremultiplied = (f: Float32Array, i: number, c: number) => f[i + 3] > 0 ? f[i + c] * 255 / f[i + 3] : 0;
/** Blur radius in pixels for an amount 0–100 on a `w` × `h` image: up to 3 % of the long side. */
export const blurRadius = (amount: number, w: number, h: number): number => Math.round(amount / 100 * .03 * Math.max(w, h));
/** Applies a look in place: blur, then sharpen (unsharp mask), then light and colour, then duotone, then vignette. Alpha is kept. */
export function applyLook(px: Uint8ClampedArray, w: number, h: number, look: Look): void {
  const a = (k: AdjustKey) => look.adjust[k] ?? 0;
  const blur = blurRadius(a('blur'), w, h);
  if (blur > 0) {
    const out = blurPremultiplied(premultiply(px), w, h, blur);
    for (let i = 0; i < px.length; i += 4) { for (let c = 0; c < 3; c++) px[i + c] = unpremultiplied(out, i, c); px[i + 3] = out[i + 3]; }
  }
  if (a('sharpen') > 0) {
    const soft = blurPremultiplied(premultiply(px), w, h, Math.max(1, Math.round(.002 * Math.max(w, h)))), amount = a('sharpen') / 100 * 2;
    for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = clamp(px[i + c] + amount * (px[i + c] - unpremultiplied(soft, i, c)));
  }
  const bright = a('brightness') * 1.2, con = a('contrast'), factor = con >= 0 ? 1 + con / 100 * 1.5 : 1 + con / 100, sat = 1 + a('saturation') / 100;
  const warm = a('warmth') * .3, tint = a('tint') * .3, duo = look.duotone && look.duotone.map(hexRgb);
  const colour = bright || con || sat !== 1 || warm || tint || duo;
  if (colour) for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    r = (r + bright - 128) * factor + 128; g = (g + bright - 128) * factor + 128; b = (b + bright - 128) * factor + 128;
    const l = .2126 * r + .7152 * g + .0722 * b;
    r = l + (r - l) * sat + warm + tint / 3; g = l + (g - l) * sat - tint; b = l + (b - l) * sat - warm + tint / 3;
    if (duo) { const t = clamp(.2126 * r + .7152 * g + .0722 * b) / 255; r = duo[0][0] + (duo[1][0] - duo[0][0]) * t; g = duo[0][1] + (duo[1][1] - duo[0][1]) * t; b = duo[0][2] + (duo[1][2] - duo[0][2]) * t; }
    px[i] = clamp(r); px[i + 1] = clamp(g); px[i + 2] = clamp(b);
  }
  if (a('vignette') > 0) {
    const v = a('vignette') / 100 * .85, cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.sqrt((((x + .5 - cx) / cx) ** 2 + ((y + .5 - cy) / cy) ** 2) / 2), t = Math.min(1, Math.max(0, (d - .35) / .65)), k = 1 - v * t * t * (3 - 2 * t), i = (y * w + x) * 4;
      px[i] *= k; px[i + 1] *= k; px[i + 2] *= k;
    }
  }
}
