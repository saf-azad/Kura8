import type { Measure, Rect, Size } from './geometry';
import type { ColourRef, CompId, DocNode, Palette, Slot } from './document';
import { contrast, resolve } from './palette';
import { contains } from './geometry';
import type { GuideId } from './guides/types';
import { fractionsOf } from './guides';
import { textHeight, typeScale } from './fit';
// Layouts place four slots (image, accent, headline, body) on the guide's first and last lines. They are pure
// functions of ratio and guide, ported from the prototype's layoutFor into unit space; they never choose content.
/** `fit` marks a headline box that autofits (5q) to the room the layout gives it (D-055). */
export type TextSlot = { rect: Rect; fontSize: number; fit?: boolean };
export type Layout = { image: Rect | null; accent: Rect; headline: TextSlot; body: TextSlot };
export type LayoutInput = { canvas: Size; guide: GuideId; comp: CompId; measure: Measure; headline: string; body: string };
export const STARTER = { headline: 'Headline', body: 'Body text' };
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export function layout(o: LayoutInput): Layout {
  const W = o.canvas.w, H = o.canvas.h, F = fractionsOf(o.guide), a = F[0], b = F[F.length - 1], scale = typeScale(o.guide, o.canvas);
  const pad = Math.min(W, H) * .045, ax = a * W, bx = b * W, ay = a * H, by = b * H;
  let fs = Math.min(scale.headline, H * .075), image: Rect | null = null, accent: Rect, cap = 0;
  let head: { x: number; y: number; w: number }, body: { x: number; y: number; w: number } | null = null;
  switch (o.comp) {
    case 'cover': image = R(0, 0, W, by); accent = R(pad, pad, ax - 2 * pad, ay * .5); head = { x: ax, y: by + pad, w: W - ax - pad }; break;
    case 'split': image = R(0, 0, ax, H); accent = R(bx, by, W - bx, H - by); head = { x: ax + pad, y: ay, w: W - ax - 2 * pad }; break;
    case 'stack': image = R(0, ay, W, by - ay); accent = R(bx + pad, pad, W - bx - 2 * pad, ay - 2 * pad); head = { x: pad, y: pad, w: bx - 2 * pad }; cap = ay - 2 * pad; body = { x: pad, y: by + pad, w: W - 2 * pad }; break;
    case 'poster': accent = R(0, by, W, H - by); head = { x: pad, y: pad, w: W - 2 * pad }; fs = (W - 2 * pad) / 4.8; cap = by - 2 * pad; body = { x: pad, y: by + pad, w: W - 2 * pad }; break;
    case 'frame': { image = R(ax, ay, bx - ax, by - ay); const s = Math.min(ax, ay) - 2 * pad; accent = R(pad, pad, s, s); head = { x: pad, y: by + pad, w: W - 2 * pad }; body = { x: bx + pad, y: pad, w: W - bx - 2 * pad }; break; }
    default: image = R(bx, 0, W - bx, H); accent = R(pad, ay - pad * 1.8, pad * 3, pad * .7); head = { x: pad, y: ay, w: bx - 2 * pad };
  }
  // Poster and stack give the headline a fixed room above the band: it becomes an autofit box of that height (D-055).
  if (cap && body) return { image, accent, headline: { rect: R(head.x, head.y, head.w, cap), fontSize: fs, fit: true }, body: { rect: R(body.x, body.y, body.w, textHeight(o.measure(o.body, scale.body, 400, body.w).length, scale.body)), fontSize: scale.body } };
  let lines = o.measure(o.headline, fs, 700, head.w).length;
  // Short canvases: step the headline down until headline and body clear the bottom margin, never below body size.
  let bodySize = scale.body, bodyLines = 1;
  const place = () => {
    const headH = textHeight(lines, fs), at = body ?? { x: head.x, y: head.y + headH + pad, w: head.w };
    bodyLines = o.measure(o.body, bodySize, 400, at.w).length;
    return { headH, at };
  };
  let placed = place();
  while (!body && placed.at.y + textHeight(bodyLines, bodySize) > H - pad && fs > scale.body * 1.0001) {
    fs = Math.max(scale.body, fs / scale.factor); lines = o.measure(o.headline, fs, 700, head.w).length; placed = place();
  }
  return { image, accent, headline: { rect: R(head.x, head.y, head.w, placed.headH), fontSize: fs }, body: { rect: R(placed.at.x, placed.at.y, placed.at.w, textHeight(bodyLines, bodySize)), fontSize: bodySize } };
}
/** Text that sits on the accent block (the poster band) takes ink or ground, whichever reads better on the accent (D-056). */
export function textRoleOn(slots: Layout, text: Rect, palette: Palette): ColourRef {
  const inside = contains(slots.accent, { x: text.x, y: text.y }) && contains(slots.accent, { x: text.x + text.w, y: text.y + text.h });
  if (!inside) return { role: 'ink' };
  // Ink or ground first; a mid-tone accent (lightness 50) can defeat both, and every palette shade, so the last resort
  // is black or white, one of which always reaches 4.5 : 1 (D-076).
  const accent = resolve({ role: 'accent' }, palette), score = (c: ColourRef) => contrast(resolve(c, palette), accent);
  const pick = (refs: ColourRef[]) => refs.reduce((a, b) => score(b) > score(a) ? b : a), best = pick([{ role: 'ink' }, { role: 'ground' }]);
  return score(best) >= 4.5 ? best : pick([{ hex: '#000000' }, { hex: '#ffffff' }]);
}
/** Slot-tagged starter nodes for a layout: empty image frame, accent block, headline and body text. */
export function starterNodes(slots: Layout, o: { sizeId: string; newId: () => string; headline?: string; body?: string; palette?: Palette }): DocNode[] {
  const frames = (rect: Rect, fontSize?: number) => ({ [o.sizeId]: { rect: { ...rect }, rot: 0, ...(fontSize ? { fontSize } : {}) } });
  const out: DocNode[] = [];
  if (slots.image) out.push({ id: o.newId(), kind: 'image', slot: 'image', asset: null, frames: frames(slots.image) });
  out.push({ id: o.newId(), kind: 'shape', slot: 'accent', shape: 'rect', fill: { role: 'accent' }, frames: frames(slots.accent) });
  out.push({ id: o.newId(), kind: 'text', slot: 'headline', text: o.headline ?? STARTER.headline, weight: 700, align: 'start', fill: { role: 'ink' }, ...(slots.headline.fit ? { fit: true } : {}), frames: frames(slots.headline.rect, slots.headline.fontSize) });
  out.push({ id: o.newId(), kind: 'text', slot: 'body', text: o.body ?? STARTER.body, weight: 400, align: 'start', fill: o.palette ? textRoleOn(slots, slots.body.rect, o.palette) : { role: 'ink' }, frames: frames(slots.body.rect, slots.body.fontSize) });
  return out;
}
export const slotRect = (slots: Layout, slot: Slot): { rect: Rect; fontSize?: number } | null =>
  slot === 'image' ? slots.image && { rect: slots.image } : slot === 'accent' ? { rect: slots.accent } : slots[slot];
/** Why a layout does not suit a ratio (5c): an image column too narrow, an image band too shallow, or text running off the canvas. */
export type FitReason = 'narrow' | 'shallow' | 'overflow';
export function compositionFit(o: LayoutInput): { ok: true } | { ok: false; reason: FitReason } {
  const slots = layout(o), { canvas } = o;
  if (slots.image && Math.min(slots.image.w, slots.image.h) / Math.max(slots.image.w, slots.image.h) < .25) return { ok: false, reason: slots.image.w < slots.image.h ? 'narrow' : 'shallow' };
  const bottom = Math.max(slots.headline.rect.y + slots.headline.rect.h, slots.body.rect.y + slots.body.rect.h);
  if (bottom > canvas.h + 1e-6) return { ok: false, reason: 'overflow' };
  return { ok: true };
}
