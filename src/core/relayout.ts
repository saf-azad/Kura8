import type { Measure } from './geometry';
import type { CompId, Frame, KuraDoc, RatioId, Slot } from './document';
import type { GuideId } from './guides/types';
import { canvasSize } from './ratios';
import { layout, slotRect, STARTER } from './compositions';
import { flagsFor, reRatioFrames, type Flag } from './reratio';
export type Move = { id: string; from: Frame; to: Frame };
/** Go from the dial with content kept (5f): slot-tagged nodes move into the new layout's slots, everything else re-ratios; a slot without a node stays empty. */
export function relayout(doc: KuraDoc, sizeId: string, to: { ratio: RatioId; guide: GuideId; comp: CompId }, measure: Measure): { doc: KuraDoc; moves: Move[]; flags: Flag[] } {
  const from = doc.sizes.find(s => s.id === sizeId)!;
  const text = (slot: Slot, fallback: string) => { const n = doc.nodes.find(n => n.slot === slot && n.kind === 'text'); return n?.kind === 'text' ? n.text : fallback; };
  const slots = layout({ canvas: canvasSize(to.ratio), guide: to.guide, comp: to.comp, measure, headline: text('headline', STARTER.headline), body: text('body', STARTER.body) });
  const { frames } = reRatioFrames(doc, from, to, measure), claimed = new Set<Slot>(), moves: Move[] = [], canvas = canvasSize(to.ratio);
  const nodes = doc.nodes.map(n => {
    let next = frames[n.id];
    // A locked node keeps its place and claims no slot; only a new ratio moves it, as Change ratio does.
    const target = n.slot && !n.locked && !claimed.has(n.slot) ? slotRect(slots, n.slot) : null;
    if (n.locked && from.ratio === to.ratio) next = n.frames[sizeId];
    else if (n.slot && target) {
      claimed.add(n.slot);
      next = { ...n.frames[sizeId], rect: { ...target.rect }, rot: 0, ...(target.fontSize ? { fontSize: target.fontSize } : {}) };
    }
    moves.push({ id: n.id, from: n.frames[sizeId], to: next });
    return { ...n, frames: { ...n.frames, [sizeId]: next } };
  });
  // Flags describe where everything ended up, slot nodes included: long copy can still run off the new canvas.
  const flags = nodes.flatMap(n => flagsFor(n, n.frames[sizeId], measure, canvas, to.guide));
  return { doc: { ...doc, sizes: doc.sizes.map(s => s.id === sizeId ? { ...s, ...to } : s), nodes }, moves, flags };
}
