import type { Measure } from './geometry';
import type { CompId, Frame, KuraDoc, RatioId, Slot } from './document';
import type { GuideId } from './guides/types';
import { canvasSize } from './ratios';
import { autoFill, layout, slotRect, textRoleOn, STARTER } from './compositions';
import { reRatioFrames, type Flag } from './reratio';
export type Move = { id: string; from: Frame; to: Frame };
/** Go from the dial with content kept (5f): slot-tagged nodes move into the new layout's slots, everything else re-ratios; a slot without a node stays empty. */
export function relayout(doc: KuraDoc, sizeId: string, to: { ratio: RatioId; guide: GuideId; comp: CompId }, measure: Measure): { doc: KuraDoc; moves: Move[]; flags: Flag[] } {
  const from = doc.sizes.find(s => s.id === sizeId)!;
  const text = (slot: Slot, fallback: string) => { const n = doc.nodes.find(n => n.slot === slot && n.kind === 'text'); return n?.kind === 'text' ? n.text : fallback; };
  const slots = layout({ canvas: canvasSize(to.ratio), guide: to.guide, comp: to.comp, measure, headline: text('headline', STARTER.headline), body: text('body', STARTER.body) });
  const { frames, flags } = reRatioFrames(doc, from, to, measure), claimed = new Set<Slot>(), moved = new Set<string>(), moves: Move[] = [];
  const nodes = doc.nodes.map(n => {
    let next = frames[n.id];
    const target = n.slot && !claimed.has(n.slot) ? slotRect(slots, n.slot) : null;
    if (n.slot && target) {
      claimed.add(n.slot); moved.add(n.id);
      next = { ...n.frames[sizeId], rect: { ...target.rect }, rot: 0, ...(target.fontSize ? { fontSize: target.fontSize } : {}) };
    }
    moves.push({ id: n.id, from: n.frames[sizeId], to: next });
    // A headline moved into an autofit room (poster, stack) autofits there (D-055).
    const fit = n.kind === 'text' && target && 'fit' in target && target.fit && !n.fit ? { fit: true } : {};
    // Body text in an automatic colour (ink, ground, or the black or white chosen for the band) takes the readable one
    // for where it lands (D-056, D-076); a colour the person chose stays.
    const fill = n.kind === 'text' && autoFill(n.fill) && n.slot === 'body' && target ? { fill: textRoleOn(slots, target.rect, doc.palette) } : {};
    return { ...n, ...fit, ...fill, frames: { ...n.frames, [sizeId]: next } };
  });
  return { doc: { ...doc, sizes: doc.sizes.map(s => s.id === sizeId ? { ...s, ...to } : s), nodes }, moves, flags: flags.filter(f => !moved.has(f.id)) };
}
