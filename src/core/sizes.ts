import type { Measure } from './geometry';
import type { KuraDoc, RatioId } from './document';
import { reRatioFrames, type Flag } from './reratio';
import { canvasSize } from './ratios';
// Linked sizes (5w): content lives on the node and geometry in frames[sizeId], so a new size is just a new frame
// per node, seeded by re-ratio from an existing size. Text and colour edits then carry across with no sync code.
/** The size whose proportions are closest to a ratio (D-069): seeding a linked size from it shrinks the least. */
export function closestSize(doc: KuraDoc, ratio: RatioId): string {
  const aspect = (r: RatioId) => { const c = canvasSize(r); return Math.log(c.w / c.h); }, target = aspect(ratio);
  return doc.sizes.reduce((best, s) => Math.abs(aspect(s.ratio) - target) < Math.abs(aspect(best.ratio) - target) ? s : best).id;
}
export function addSize(doc: KuraDoc, ratio: RatioId, id: string, measure: Measure, fromId = closestSize(doc, ratio)): { doc: KuraDoc; flags: Flag[] } {
  const from = doc.sizes.find(s => s.id === fromId)!, { frames, flags } = reRatioFrames(doc, from, { ratio, guide: from.guide }, measure);
  return {
    doc: { ...doc, sizes: [...doc.sizes, { id, ratio, guide: from.guide, comp: from.comp }], nodes: doc.nodes.map(n => ({ ...n, frames: { ...n.frames, [id]: frames[n.id] } })) },
    flags,
  };
}
/** Removes a size and its frames; the last size stays. */
export function removeSize(doc: KuraDoc, id: string): KuraDoc {
  if (doc.sizes.length < 2 || !doc.sizes.some(s => s.id === id)) return doc;
  return { ...doc, sizes: doc.sizes.filter(s => s.id !== id), nodes: doc.nodes.map(n => { const frames = { ...n.frames }; delete frames[id]; return { ...n, frames }; }) };
}
