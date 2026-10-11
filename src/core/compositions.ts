import type { Measure, Rect, Size } from './geometry';
import type { ColourRef, CompId, DocNode, KuraDoc, Palette, Slot } from './document';
import { contrast, resolve } from './palette';
import { contains } from './geometry';
import { ICON_SHAPE } from './shapes';
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
/** A layout's margin: 4.5 % of the canvas's shorter side. */
export const layoutPad = (canvas: Size): number => Math.min(canvas.w, canvas.h) * .045;
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
export function layout(o: LayoutInput): Layout {
  const W = o.canvas.w, H = o.canvas.h, F = fractionsOf(o.guide), a = F[0], b = F[F.length - 1], scale = typeScale(o.guide, o.canvas);
  const pad = layoutPad(o.canvas), ax = a * W, bx = b * W, ay = a * H, by = b * H;
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
  const headY = head.y;
  const place = () => {
    const headH = textHeight(lines, fs);
    // Split: the headline and body rise together, as far as the margin, so two lines of body clear the accent block (D-090).
    head.y = o.comp === 'split' ? Math.max(pad, Math.min(headY, by - pad / 2 - textHeight(2, bodySize) - pad - headH)) : headY;
    const at = body ?? { x: head.x, y: head.y + headH + pad, w: head.w };
    bodyLines = o.measure(o.body, bodySize, 400, at.w).length;
    return { headH, at };
  };
  let placed = place();
  while (!body && placed.at.y + textHeight(bodyLines, bodySize) > H - pad && fs > scale.body * 1.0001) {
    fs = Math.max(scale.body, fs / scale.factor); lines = o.measure(o.headline, fs, 700, head.w).length; placed = place();
  }
  return { image, accent, headline: { rect: R(head.x, head.y, head.w, placed.headH), fontSize: fs }, body: { rect: R(placed.at.x, placed.at.y, placed.at.w, textHeight(bodyLines, bodySize)), fontSize: bodySize } };
}
/** Ink or ground, whichever reads better on `bg`; when a mid-tone defeats both, black or white (D-056, D-076). */
function readableOn(bg: string, palette: Palette): ColourRef {
  const score = (c: ColourRef) => contrast(resolve(c, palette), bg);
  const pick = (refs: ColourRef[]) => refs.reduce((a, b) => score(b) > score(a) ? b : a), best = pick([{ role: 'ink' }, { role: 'ground' }]);
  return score(best) >= 4.5 ? best : pick([{ hex: '#000000' }, { hex: '#ffffff' }]);
}
const readableOnAccent = (palette: Palette): ColourRef => readableOn(resolve({ role: 'accent' }, palette), palette);
/** Text that sits on the accent block (the poster band) takes ink or ground, whichever reads better on the accent (D-056). */
export function textRoleOn(slots: Layout, text: Rect, palette: Palette): ColourRef {
  const inside = contains(slots.accent, { x: text.x, y: text.y }) && contains(slots.accent, { x: text.x + text.w, y: text.y + text.h });
  return inside ? readableOnAccent(palette) : { role: 'ink' };
}
/** An automatic text colour: ink, ground, or the black or white chosen for a band; anything else was the person's choice. */
export const autoFill = (fill: ColourRef): boolean => 'role' in fill && fill.role !== 'accent' || 'hex' in fill && /^#(000000|ffffff)$/i.test(fill.hex);
/**
 * After a palette or ground change (a hue, Dark ground, a filled ground) or a move, text in an automatic colour that no
 * longer reaches 4.5 : 1 on what lies behind it takes the readable colour again (D-077, D-081): on a solid shape that
 * holds it in an unturned size (a band, a pill), that shape's colour (D-087); on nothing but the ground and other text in
 * every size, the ground (D-083). Text that still reads, text over pictures or partly over blocks, and chosen colours stay.
 */
export function keepReadable(doc: KuraDoc): KuraDoc {
  const ground = resolve(doc.ground ?? { role: 'ground' }, doc.palette);
  const inside = (outer: Rect, inner: Rect) => contains(outer, { x: inner.x, y: inner.y }) && contains(outer, { x: inner.x + inner.w, y: inner.y + inner.h });
  const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const nodes = doc.nodes.map((n, i) => {
    // Black or white counts as automatic only on layout text (the band's fallback); on a free label it was chosen (D-082),
    // unless it has become nearly invisible where it now sits (under 3 : 1, a label dragged off a band, D-090).
    if (n.kind !== 'text' || !autoFill(n.fill)) return n;
    const chosen = 'hex' in n.fill && !n.slot;
    const below = doc.nodes.slice(0, i), sizes = doc.sizes.filter(({ id }) => n.frames[id] && !n.frames[id].hidden);
    let onBand: string | null = null;
    for (const { id } of sizes) {
      const t = n.frames[id];
      const back = t.rot ? undefined : [...below].reverse().find(b => { const f = b.frames[id]; return b.kind === 'shape' && b.shape !== ICON_SHAPE && (b.opacity ?? 1) >= 1 && f && !f.hidden && !f.rot && inside(f.rect, t.rect); });
      if (back?.kind === 'shape') { onBand = resolve(back.fill, doc.palette); break; }
    }
    // An empty picture frame is a placeholder the export leaves out: text over it sits on the ground (D-089).
    const bare = !onBand && sizes.length > 0 && sizes.every(({ id }) => below.every(b => { const f = b.frames[id]; return !f || f.hidden || b.kind === 'ink' || b.kind === 'text' || b.kind === 'image' && !b.asset || !meets(f.rect, n.frames[id].rect); }));
    const bg = onBand ?? (bare ? ground : null);
    return bg && contrast(resolve(n.fill, doc.palette), bg) < (chosen ? 3 : 4.5) ? { ...n, fill: readableOn(bg, doc.palette) } : n;
  });
  return nodes.some((n, i) => n !== doc.nodes[i]) ? { ...doc, nodes } : doc;
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
