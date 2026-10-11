import type { Measure, Rect } from './geometry';
import type { KuraDoc, TextNode } from './document';
import { canvasSize } from './ratios';
import { LINE_HEIGHT, textBox, typeScale } from './fit';
import { nudge } from './ops';
// Stacked text follows (D-046): when an edit changes a text block's drawn height, unlocked text blocks that sat just
// under it move by the same amount, and the blocks under those follow in turn. "Just under" means unrotated, sharing
// some width, with a top no further below the old bottom than one line of the block above. Applied in every size,
// since text is linked across sizes and wraps differently in each.
const EPS = 1e-6;
export function flowText(before: KuraDoc, after: KuraDoc, id: string, measure: Measure): KuraDoc {
  const was = before.nodes.find(n => n.id === id), now = after.nodes.find(n => n.id === id);
  if (was?.kind !== 'text' || now?.kind !== 'text') return after;
  let doc = after;
  for (const spec of after.sizes) {
    const f0 = was.frames[spec.id], f1 = now.frames[spec.id];
    if (!f0 || !f1 || f0.hidden || f1.hidden || f0.rot || f1.rot) continue;
    const scale = typeScale(spec.guide, canvasSize(spec.ratio)), b0 = textBox(was, f0, measure, scale), b1 = textBox(now, f1, measure, scale);
    const dy = b1.rect.y + b1.rect.h - (b0.rect.y + b0.rect.h);
    if (Math.abs(dy) < EPS) continue;
    const stack = new Map<string, { rect: Rect; line: number }>();
    for (const n of doc.nodes) {
      const f = n.frames[spec.id];
      if (n.id === id || n.kind !== 'text' || n.locked || !f || f.hidden || f.rot) continue;
      const b = textBox(n as TextNode, f, measure, scale);
      stack.set(n.id, { rect: b.rect, line: b.size * LINE_HEIGHT });
    }
    const queue = [{ rect: b0.rect, line: b0.size * LINE_HEIGHT }], moving: string[] = [];
    while (queue.length) {
      const above = queue.shift()!, bottom = above.rect.y + above.rect.h;
      for (const [nid, below] of stack) {
        const r = below.rect, sharesWidth = r.x < above.rect.x + above.rect.w - EPS && above.rect.x < r.x + r.w - EPS;
        if (!sharesWidth || r.y < bottom - EPS || r.y > bottom + above.line + EPS) continue;
        stack.delete(nid); moving.push(nid); queue.push(below);
      }
    }
    if (moving.length) doc = nudge(doc, spec.id, moving, 0, dy);
  }
  return doc;
}
