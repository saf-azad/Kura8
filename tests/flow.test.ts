import { it, expect } from 'vitest';
import { flowText, hugText, oneLineWidth, roomFor, wholeWordSize } from '../src/core/flow';
import { updateNodes } from '../src/core/ops';
import type { KuraDoc, TextNode } from '../src/core/document';
import { doc, frame, rectNode, textNode, fakeMeasure, charMeasure } from './helpers';
// Headline 50 units (line 57.5) in a 300-wide box: "Hello" is one line, "Hello there friend" three.
const stack = (): KuraDoc => doc([
  textNode('h', frame(0, 0, 300, 57.5, { fontSize: 50 }), 'Hello'),
  textNode('b', frame(0, 87.5, 300, 23, { fontSize: 20 }), 'Body'),
  textNode('c', frame(100, 120, 300, 23, { fontSize: 20 }), 'Under the body'),
  textNode('far', frame(0, 500, 300, 23, { fontSize: 20 }), 'Far below'),
  textNode('side', frame(400, 90, 200, 23, { fontSize: 20 }), 'Beside'),
  rectNode('shape', frame(0, 90, 300, 50)),
]);
const retext = (d: KuraDoc, text: string) => updateNodes(d, ['h'], n => ({ ...n, text }));
const ys = (d: KuraDoc) => Object.fromEntries(d.nodes.map(n => [n.id, n.frames.main.rect.y]));
it('moves the text stacked under a growing block, cascading down the stack', () => {
  const before = stack(), out = flowText(before, retext(before, 'Hello there friend'), 'h', fakeMeasure);
  expect(ys(out)).toEqual({ h: 0, b: 87.5 + 115, c: 120 + 115, far: 500, side: 90, shape: 90 });
});
it('moves stacked text back up when the block shrinks', () => {
  const grown = retext(stack(), 'Hello there friend'), moved = flowText(stack(), grown, 'h', fakeMeasure);
  expect(ys(flowText(moved, retext(moved, 'Hi'), 'h', fakeMeasure))).toEqual(ys(stack()));
});
it('leaves locked, rotated and hidden text where it is', () => {
  const before = updateNodes(stack(), ['b'], n => ({ ...n, locked: true }));
  expect(ys(flowText(before, retext(before, 'Hello there friend'), 'h', fakeMeasure)).b).toBe(87.5);
  const turned = updateNodes(stack(), ['b'], n => ({ ...n, frames: { main: { ...n.frames.main, rot: 5 } } }));
  expect(ys(flowText(turned, retext(turned, 'Hello there friend'), 'h', fakeMeasure)).b).toBe(87.5);
  const hidden = updateNodes(stack(), ['b'], n => ({ ...n, frames: { main: { ...n.frames.main, hidden: true } } }));
  expect(ys(flowText(hidden, retext(hidden, 'Hello there friend'), 'h', fakeMeasure)).b).toBe(87.5);
});
it('flows in every size the text is in, by that size’s own wrapping', () => {
  const base = stack(), two: KuraDoc = { ...base, sizes: [...base.sizes, { id: 'wide', ratio: 'landscape', guide: null, comp: null }],
    nodes: base.nodes.map(n => ({ ...n, frames: { ...n.frames, wide: { ...n.frames.main, rect: { ...n.frames.main.rect, w: n.id === 'h' ? 900 : n.frames.main.rect.w } } } })) };
  const out = flowText(two, retext(two, 'Hello there friend'), 'h', fakeMeasure), b = out.nodes.find(n => n.id === 'b')!;
  expect(b.frames.main.rect.y).toBe(87.5 + 115); expect(b.frames.wide.rect.y).toBe(87.5);
});
it('returns the edited document unchanged when the height holds, the block is rotated or it is not text', () => {
  const before = stack(), same = retext(before, 'Howdy');
  expect(flowText(before, same, 'h', fakeMeasure)).toBe(same);
  const turned = updateNodes(before, ['h'], n => ({ ...n, frames: { main: { ...n.frames.main, rot: 10 } } }));
  const grown = retext(turned, 'Hello there friend');
  expect(flowText(turned, grown, 'h', fakeMeasure)).toBe(grown);
  expect(flowText(before, before, 'shape', fakeMeasure)).toBe(before);
  expect(flowText(before, before, 'missing', fakeMeasure)).toBe(before);
});
it('keeps one-line text on one line when its size or face changes (D-070)', () => {
  // charMeasure: 0.6 em per character, so "+142%" at 50 is 150 wide.
  const hug = doc([textNode('n', frame(100, 0, 153, 57.5, { fontSize: 50 }), '+142%')]), wide = doc([textNode('n', frame(100, 0, 600, 57.5, { fontSize: 50 }), '+142%')]);
  const grow = (d: KuraDoc, size: number) => updateNodes(d, ['n'], n => ({ ...n, frames: { main: { ...n.frames.main, fontSize: size } } }));
  const w = (d: KuraDoc) => d.nodes[0].frames.main.rect;
  expect(oneLineWidth('+142%', 50, 400, charMeasure)).toBeCloseTo(150, 0);
  expect(w(hugText(hug, grow(hug, 150), 'n', charMeasure)).w).toBeCloseTo(450 * 1.02, 0);
  expect(w(hugText(hug, grow(hug, 20), 'n', charMeasure)).w).toBeCloseTo(60 * 1.02, 0);
  expect(w(hugText(wide, grow(wide, 20), 'n', charMeasure)).w).toBe(600);
  expect(w(hugText(wide, grow(wide, 250), 'n', charMeasure))).toMatchObject({ x: 100 });
  expect(w(hugText(wide, grow(wide, 250), 'n', charMeasure)).w).toBeCloseTo(765, 0);
  const centred = updateNodes(hug, ['n'], n => ({ ...n, align: 'center', frames: { main: { ...n.frames.main, rect: { ...n.frames.main.rect, x: 400 } } } }));
  const c = w(hugText(centred, grow(centred, 150), 'n', charMeasure)); expect(c.x + c.w / 2).toBeCloseTo(400 + 153 / 2, 5);
  expect(w(hugText(hug, updateNodes(grow(hug, 150), ['n'], n => ({ ...n, align: 'center' })), 'n', charMeasure)).x).toBe(0);
  // A free label slides back to stay on the canvas, up to the canvas width (D-070, D-081).
  const huge = grow(hug, 400); expect(w(hugText(hug, huge, 'n', charMeasure))).toMatchObject({ x: 0, w: 1000 });
  const two = updateNodes(hug, ['n'], n => ({ ...n, text: 'a\nb' }));
  expect(hugText(two, grow(two, 150), 'n', charMeasure)).toEqual(grow(two, 150));
  expect(hugText(hug, hug, 'missing', charMeasure)).toBe(hug);
});
it('moves text further down than one line when the block above jumps past it in one step (D-070)', () => {
  // Body 150 below a one-line headline: typing one line at a time would reach it; a pasted paragraph must too.
  const d = doc([textNode('h', frame(0, 0, 300, 57.5, { fontSize: 50 }), 'Hello'), textNode('b', frame(0, 207.5, 300, 23, { fontSize: 20 }), 'Body')]);
  const pasted = updateNodes(d, ['h'], n => ({ ...n, text: 'Hello there friend of mine' }));
  expect(flowText(d, pasted, 'h', fakeMeasure).nodes[1].frames.main.rect.y).toBe(207.5 + 172.5);
});
it('follows the lines of autofit text, not its room, so the band under a poster headline stays put (D-076)', () => {
  // Autofit room 0–600 holding one line at 50 (57.5 tall); the body sits on a band at 700.
  const d = doc([textNode('h', frame(0, 0, 300, 600, { fontSize: 50 }), 'Hello', { fit: true } as Partial<TextNode>), textNode('b', frame(0, 700, 300, 23, { fontSize: 20 }), 'Body')]);
  const unfit = updateNodes(d, ['h'], n => { const t = { ...n, frames: { main: { ...n.frames.main, fontSize: 40 } } } as TextNode; delete t.fit; return t; });
  expect(flowText(d, unfit, 'h', fakeMeasure).nodes[1].frames.main.rect.y).toBe(700);
});
it('keeps the text under an autofit room where it is while the room holds or autofit ends (D-077)', () => {
  // Room 0–600 at 200 (one 230-tall line), body on the band 50 under the room: inside one line of the letters.
  const d = doc([textNode('h', frame(0, 0, 1000, 600, { fontSize: 200 }), 'Hi', { fit: true } as Partial<TextNode>), textNode('b', frame(0, 650, 300, 23, { fontSize: 20 }), 'Body')]);
  const typed = updateNodes(d, ['h'], n => ({ ...n, text: 'Open Studio Night' }));
  expect(flowText(d, typed, 'h', fakeMeasure).nodes[1].frames.main.rect.y).toBe(650);
  const smaller = updateNodes(d, ['h'], n => { const t = { ...n, frames: { main: { ...n.frames.main, fontSize: 150 } } } as TextNode; delete t.fit; return t; });
  expect(flowText(d, smaller, 'h', fakeMeasure).nodes[1].frames.main.rect.y).toBe(650);
});
it('leaves a footer under two columns with the longer column when the other shrinks (D-077)', () => {
  // Columns of two lines (46 tall at 20), a footer 10 under both; the right column drops to one line.
  const d = doc([textNode('l', frame(0, 0, 150, 46, { fontSize: 20 }), 'Doors open at 7PM'), textNode('r', frame(200, 0, 150, 46, { fontSize: 20 }), 'Free entry for everyone'),
    textNode('f', frame(0, 56, 350, 23, { fontSize: 20 }), 'Footer')]);
  const short = updateNodes(d, ['r'], n => ({ ...n, text: 'Free' }));
  expect(flowText(d, short, 'r', fakeMeasure).nodes[2].frames.main.rect.y).toBe(56);
  const long = updateNodes(d, ['r'], n => ({ ...n, text: 'Free entry for everyone in the building' }));
  expect(flowText(d, long, 'r', fakeMeasure).nodes[2].frames.main.rect.y).toBe(56 + 46);
  expect(flowText(d, updateNodes(d, ['l'], n => ({ ...n, text: 'Doors' })), 'l', fakeMeasure).nodes[2].frames.main.rect.y).toBe(56);
});
it('lets a hugging label follow retyped text, and widens a wide box only to save a word (D-077)', () => {
  const hug = doc([textNode('n', frame(100, 0, 294, 69, { fontSize: 60 }), 'Open now')]), w = (d: KuraDoc) => d.nodes[0].frames.main.rect;
  const retype = (d: KuraDoc, text: string) => updateNodes(d, ['n'], n => ({ ...n, text }));
  expect(w(hugText(hug, retype(hug, 'Open now until late'), 'n', charMeasure)).w).toBeCloseTo(19 * 36 * 1.02, 0);
  expect(w(hugText(hug, retype(hug, 'Open'), 'n', charMeasure)).w).toBeCloseTo(4 * 36 * 1.02, 0);
  // A column box (a split layout's headline) wraps between words instead of growing across the picture.
  const column = doc([textNode('n', frame(378, 0, 570, 69, { fontSize: 60 }), 'Marcus', { slot: 'headline' } as Partial<TextNode>)]);
  expect(w(hugText(column, retype(column, 'Marcus Lee Digital Marketing'), 'n', charMeasure)).w).toBe(570);
  expect(w(hugText(column, retype(column, 'Communications'), 'n', charMeasure)).w).toBe(570);
  // Layout text keeps its margin too (D-081): a word longer than the slot breaks inside it rather than crossing the margin.
  expect(w(hugText(column, retype(column, 'Communicationsandmarketing'), 'n', charMeasure))).toMatchObject({ x: 378, w: 570 });
  const roomy = doc([textNode('n', frame(45, 0, 570, 69, { fontSize: 60 }), 'Marcus', { slot: 'headline' } as Partial<TextNode>)]);
  expect(w(hugText(roomy, retype(roomy, 'Communicationsandmarketing'), 'n', charMeasure))).toMatchObject({ x: 45, w: 910 });
});
it('grows a right-aligned label to the left and a turned label from its aligned edge (D-077)', () => {
  const right = doc([textNode('n', frame(700, 0, 92, 57.5, { fontSize: 50 }), '+142', { align: 'end' } as Partial<TextNode>)]);
  const big = updateNodes(right, ['n'], n => ({ ...n, frames: { main: { ...n.frames.main, fontSize: 100 } } }));
  const r = hugText(right, big, 'n', charMeasure).nodes[0].frames.main.rect; expect(r.x + r.w).toBeCloseTo(792, 5);
  const turned = doc([textNode('n', frame(100, 300, 153, 57.5, { fontSize: 50, rot: -8 }), '+142%')]);
  const grown = updateNodes(turned, ['n'], n => ({ ...n, frames: { main: { ...n.frames.main, fontSize: 150 } } }));
  const t = hugText(turned, grown, 'n', charMeasure).nodes[0].frames.main.rect, rad = -8 * Math.PI / 180;
  const leftMid = (q: { x: number; y: number; w: number; h: number }) => ({ x: q.x + q.w / 2 - Math.cos(rad) * q.w / 2, y: q.y + q.h / 2 - Math.sin(rad) * q.w / 2 });
  expect(t.w).toBeCloseTo(450 * 1.02, 0);
  expect(leftMid(t).x).toBeCloseTo(leftMid(turned.nodes[0].frames.main.rect).x, 5); expect(leftMid(t).y).toBeCloseTo(leftMid(turned.nodes[0].frames.main.rect).y, 5);
});
it('finds the largest size that keeps every word whole, and the room a block may grow into (D-077)', () => {
  // charMeasure: 0.6 em a character, so "Summer" fills 1000 at 277.8.
  expect(wholeWordSize('Summer', 200, 1000, 700, charMeasure)).toBe(200);
  expect(wholeWordSize('Summer', 400, 1000, 700, charMeasure)).toBe(277.5);
  expect(wholeWordSize('Summer sale', 400, 1000, 700, charMeasure)).toBe(277.5);
  // Layout text keeps the margin it has from the nearer edge (here 100 on the right); a free label may use the canvas.
  const t = textNode('n', frame(300, 0, 600, 50), 'Hi', { slot: 'headline' } as Partial<TextNode>) as TextNode, canvas = { w: 1000, h: 1000 };
  expect(roomFor(t, t.frames.main, canvas)).toBe(600);
  expect(roomFor({ ...t, align: 'end' }, t.frames.main, canvas)).toBe(800);
  expect(roomFor({ ...t, align: 'center' }, t.frames.main, canvas)).toBe(600);
  expect(roomFor(t, { ...t.frames.main, rot: 10 }, canvas)).toBe(1000);
  expect(roomFor({ ...t, slot: undefined }, t.frames.main, canvas)).toBe(1000);
});
it('keeps layout text in its slot when retyped, and slides a free label at the left edge back on (D-081)', () => {
  // The starter headline nearly fills its slot, so it looked like a hugging label and grew across the picture column.
  const slot = doc([textNode('h', frame(378, 0, 400, 69, { fontSize: 60 }), 'Headline', { slot: 'headline' } as Partial<TextNode>)]);
  const retyped = updateNodes(slot, ['h'], n => ({ ...n, text: 'Graduate Showcase at Western Sydney University' }));
  expect(hugText(slot, retyped, 'h', charMeasure)).toBe(retyped);
  const label = doc([textNode('a', frame(20, 0, 123, 57.5, { fontSize: 50 }), '+142', { align: 'end' } as Partial<TextNode>)]);
  const big = updateNodes(label, ['a'], n => ({ ...n, frames: { main: { ...n.frames.main, fontSize: 100 } } }));
  expect(hugText(label, big, 'a', charMeasure).nodes[0].frames.main.rect).toMatchObject({ x: 0 });
  expect(hugText(label, big, 'a', charMeasure).nodes[0].frames.main.rect.w).toBeCloseTo(240 * 1.02, 0);
});
