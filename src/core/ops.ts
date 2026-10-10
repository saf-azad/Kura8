import type { ColourRef, DocNode, Frame, KuraDoc } from './document';
// Pure document edits. Locked nodes refuse geometry, property, delete and duplicate edits but stay selectable.
// Every op that creates nodes takes an injected `newId`.
const has = (ids: string[]) => { const set = new Set(ids); return (n: DocNode) => set.has(n.id); };
const unlocked = (ids: string[]) => { const pick = has(ids); return (n: DocNode) => pick(n) && !n.locked; };
export const nodeById = (doc: KuraDoc, id: string): DocNode | undefined => doc.nodes.find(n => n.id === id);
export const addNodes = (doc: KuraDoc, nodes: DocNode[]): KuraDoc => ({ ...doc, nodes: [...doc.nodes, ...nodes] });
export function removeNodes(doc: KuraDoc, ids: string[]): KuraDoc {
  const gone = unlocked(ids);
  return { ...doc, nodes: doc.nodes.filter(n => !gone(n)) };
}
/** Applies `fn` to the unlocked nodes among `ids`. */
export function updateNodes(doc: KuraDoc, ids: string[], fn: (n: DocNode) => DocNode): KuraDoc {
  const pick = unlocked(ids);
  return { ...doc, nodes: doc.nodes.map(n => pick(n) ? fn(n) : n) };
}
export function setFrames(doc: KuraDoc, sizeId: string, frames: Record<string, Frame>): KuraDoc {
  return updateNodes(doc, Object.keys(frames), n => ({ ...n, frames: { ...n.frames, [sizeId]: frames[n.id] } }));
}
export function nudge(doc: KuraDoc, sizeId: string, ids: string[], dx: number, dy: number): KuraDoc {
  return updateNodes(doc, ids, n => { const f = n.frames[sizeId]; return { ...n, frames: { ...n.frames, [sizeId]: { ...f, rect: { ...f.rect, x: f.rect.x + dx, y: f.rect.y + dy } } } }; });
}
/** Fill for shapes, text and ink; images have no fill. */
export function setFill(doc: KuraDoc, ids: string[], fill: ColourRef): KuraDoc {
  return updateNodes(doc, ids, n => n.kind === 'image' ? n : { ...n, fill });
}
export const setGround = (doc: KuraDoc, ground: ColourRef | null): KuraDoc => ({ ...doc, ground });
/** Lock toggles always apply, so a locked node can be unlocked. */
export function setLocked(doc: KuraDoc, ids: string[], locked: boolean): KuraDoc {
  const pick = has(ids);
  return { ...doc, nodes: doc.nodes.map(n => { if (!pick(n)) return n; const next = { ...n }; if (locked) next.locked = true; else delete next.locked; return next; }) };
}
/** Hides or shows nodes in one size only; `hidden` is frame geometry, so locked nodes refuse it. */
export function setHidden(doc: KuraDoc, sizeId: string, ids: string[], hidden: boolean): KuraDoc {
  const pick = unlocked(ids);
  return { ...doc, nodes: doc.nodes.map(n => { if (!pick(n)) return n; const f = { ...n.frames[sizeId] }; if (hidden) f.hidden = true; else delete f.hidden; return { ...n, frames: { ...n.frames, [sizeId]: f } }; }) };
}
export type Order = 'front' | 'back' | 'forward' | 'backward';
/** Z-order is the shared array order: front/back move the selection to the ends, forward/backward swap one step past an unselected neighbour. */
export function reorder(doc: KuraDoc, ids: string[], mode: Order): KuraDoc {
  const pick = has(ids);
  let a = [...doc.nodes];
  if (mode === 'front') a = [...a.filter(n => !pick(n)), ...a.filter(pick)];
  else if (mode === 'back') a = [...a.filter(pick), ...a.filter(n => !pick(n))];
  else if (mode === 'forward') { for (let i = a.length - 2; i >= 0; i--) if (pick(a[i]) && !pick(a[i + 1])) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
  else for (let i = 1; i < a.length; i++) if (pick(a[i]) && !pick(a[i - 1])) [a[i], a[i - 1]] = [a[i - 1], a[i]];
  return { ...doc, nodes: a };
}
/** Copies with new ids, offset in every size, unlocked and untagged so a relayout leaves them where they are. Frames missing for a size (the clip came from before a size was added) copy the first frame. */
export function cloneNodes(doc: KuraDoc, nodes: DocNode[], newId: () => string, offset: number): DocNode[] {
  return nodes.map(n => {
    const first = Object.values(n.frames)[0], frames: Record<string, Frame> = {};
    for (const s of doc.sizes) { const f = n.frames[s.id] ?? first; frames[s.id] = { ...f, rect: { ...f.rect, x: f.rect.x + offset, y: f.rect.y + offset } }; }
    const copy = { ...structuredClone(n), id: newId(), frames };
    delete copy.locked; delete copy.slot;
    return copy;
  });
}
export function duplicateNodes(doc: KuraDoc, ids: string[], newId: () => string, offset = 20): { doc: KuraDoc; ids: string[] } {
  const copies = cloneNodes(doc, doc.nodes.filter(unlocked(ids)), newId, offset);
  return { doc: addNodes(doc, copies), ids: copies.map(n => n.id) };
}
export function pasteNodes(doc: KuraDoc, clip: DocNode[], newId: () => string, count: number): { doc: KuraDoc; ids: string[] } {
  const copies = cloneNodes(doc, clip, newId, 20 * count);
  return { doc: addNodes(doc, copies), ids: copies.map(n => n.id) };
}
