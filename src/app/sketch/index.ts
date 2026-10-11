import type { DocNode, InkForm, InkNode, KuraDoc } from '../../core/document';
import type { Point } from '../../core/geometry';
import { absolutePaths, classify, inkFrame, inPoly, isScribble, resample, smooth, touches, bbox, type P, type Recognised } from '../../core/ink';
import { addNodes, removeNodes, updateNodes } from '../../core/ops';
import { layerName } from '../editor';
import { LINE_HEIGHT } from '../../core/fit';
import { newId } from '../store';
import { emptyLive, type Editor } from '../editor';
// Sketch tools (M12): the pen cleans a stroke when you hold still at its end (420 ms), scribbling over objects deletes
// them, a rectangle crossed by both diagonals becomes an image frame, a wave becomes a text line; eraser and lasso.
// Recognition is deterministic geometry (src/core/ink.ts); handwriting is not built (D-030).
export type SketchTools = { down(e: PointerEvent, p: Point): boolean; move(e: PointerEvent, p: Point): void; up(e: PointerEvent, p: Point): void; leave(): void; active(): boolean };
type PenDrag = { kind: 'pen'; pts: P[]; ax: number; ay: number; done: boolean; rec: Recognised | null; recAt: number };
type Drag = PenDrag | { kind: 'erase'; before: KuraDoc; hit: boolean } | { kind: 'lasso'; pts: P[] };
export function installSketch(ed: Editor): SketchTools {
  let drag: Drag | null = null, holdTimer = 0;
  const crossed = new Map<string, { id: string; dir: 0 | 1 }>();
  const pt = (p: Point): P => [p.x, p.y];
  const toPoints = (pts: P[]) => pts.map(([x, y]) => ({ x, y }));
  const show = (pts: P[] | undefined) => { ed.live = { ...emptyLive(), sketch: { live: pts && toPoints(pts) } }; ed.invalidate(); };
  const inks = () => ed.visible().filter((n): n is InkNode => n.kind === 'ink').map(n => { const f = ed.frame(n); return { id: n.id, form: n.form, rect: f.rect, rot: f.rot, paths: absolutePaths(n.paths, f.rect, f.rot), ...(crossed.has(n.id) ? { cross: crossed.get(n.id) } : {}) }; });
  const context = () => {
    const c = ed.canvas(), boxes = ed.visible().map(n => ed.box(n)), lines = ed.anchors().flatMap(a => a.kind === 'line' ? [a] : []);
    return {
      scale: ed.scale, inks: inks(),
      tx: [0, c.w / 2, c.w, ...lines.filter(l => l.axis === 'x').map(l => l.at), ...boxes.flatMap(b => [b.x, b.x + b.w / 2, b.x + b.w])],
      ty: [0, c.h / 2, c.h, ...lines.filter(l => l.axis === 'y').map(l => l.at), ...boxes.flatMap(b => [b.y, b.y + b.h / 2, b.y + b.h])],
    };
  };
  const arm = () => { clearTimeout(holdTimer); holdTimer = window.setTimeout(hold, 420); };
  function hold(): void {
    const d = drag;
    if (d?.kind !== 'pen' || d.done || d.pts.length < 4) return;
    const r = classify(resample(d.pts, 96), context());
    if (!r) return;
    d.done = true; d.rec = r; d.recAt = performance.now();
    try { navigator.vibrate?.(6); } catch { /* not supported */ }
    // Morph the drawn stroke into its clean form over 240 ms.
    const t0 = performance.now(), step = (now: number) => {
      if (drag !== d) return;
      const t = Math.min(1, (now - t0) / 240), k = 1 - (1 - t) ** 3;
      show(r.raw.map((p, i) => [p[0] + (r.clean[i][0] - p[0]) * k, p[1] + (r.clean[i][1] - p[1]) * k]));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const inkNode = (paths: P[][], stroke: number, form?: InkForm, id = newId()): InkNode => {
    const f = inkFrame(paths, stroke);
    return { id, kind: 'ink', paths: f.paths, stroke, fill: { role: 'ink' }, ...(form ? { form } : {}), frames: ed.framesFor(f.rect) };
  };
  function commitRecognised(r: Recognised): void {
    const doc = ed.doc, stroke = ed.inkWidth();
    if (r.type === 'wave') {
      const size = ed.typeScale().body, node: DocNode = { id: newId(), kind: 'text', text: 'Text', weight: 400, align: 'start', fill: { role: 'ink' }, frames: ed.framesFor({ x: r.l, y: r.cy - size * LINE_HEIGHT / 2, w: Math.max(r.r - r.l, size * 3), h: size * LINE_HEIGHT }, { fontSize: size }) };
      ed.commit(addNodes(doc, [node]), 'Text line'); return;
    }
    if (r.type === 'head') {
      const line = doc.nodes.find(n => n.id === r.line);
      if (line?.kind === 'ink') {
        const f = ed.frame(line), merged = inkNode([...absolutePaths(line.paths, f.rect, f.rot), r.clean], line.stroke, 'arrow', line.id), a = f.rect, b = merged.frames[ed.sizeId].rect;
        // The paths are shared by every size: move each other size's frame by the same relative change as this one.
        const frames = Object.fromEntries(Object.entries(line.frames).map(([id, o]) => [id, id === ed.sizeId ? { ...o, rect: b } : { ...o, rect: {
          x: o.rect.x + (b.x - a.x) * o.rect.w / a.w, y: o.rect.y + (b.y - a.y) * o.rect.h / a.h, w: b.w * o.rect.w / a.w, h: b.h * o.rect.h / a.h } }]));
        ed.commit(updateNodes(doc, [line.id], n => ({ ...merged, fill: (n as InkNode).fill, frames })), 'Arrow'); return;
      }
    }
    if (r.type === 'line' && r.rect) {
      const rect = doc.nodes.find(n => n.id === r.rect), first = crossed.get(r.rect);
      if (rect && first && first.dir !== r.dir && doc.nodes.some(n => n.id === first.id)) {
        const frame: DocNode = { id: newId(), kind: 'image', asset: null, frames: ed.framesFor({ ...ed.frame(rect).rect }) };
        crossed.delete(r.rect);
        ed.commit(addNodes(removeNodes(doc, [rect.id, first.id]), [frame]), 'Image frame'); ed.select([frame.id]); return;
      }
      const line = inkNode([r.clean], stroke, 'line');
      crossed.set(r.rect, { id: line.id, dir: r.dir ?? 0 });
      ed.commit(addNodes(doc, [line]), 'Line'); return;
    }
    const closed = r.type === 'rect' || r.type === 'ellipse' || r.type === 'tri';
    const form: InkForm = r.type === 'head' ? 'line' : r.type as InkForm;
    ed.commit(addNodes(doc, [inkNode([closed ? [...r.clean, r.clean[0]] : r.clean], stroke, form)]), r.name);
  }
  function eraseAt(p: Point, d: { before: KuraDoc; hit: boolean }): void {
    const r = 12 / ed.scale, kill = ed.visible().filter(n => n.kind === 'ink' && !n.locked && touches(absolutePaths(n.paths, ed.frame(n).rect, ed.frame(n).rot), pt(p), r, n.stroke)).map(n => n.id);
    if (!kill.length) return;
    d.hit = true; ed.store.set(removeNodes(ed.doc, kill)); ed.store.setUI({ sel: ed.store.ui.sel.filter(id => !kill.includes(id)) });
  }
  return {
    active: () => drag !== null,
    down(e, p) {
      const tool = ed.store.ui.tool;
      if (tool === 'pen') { drag = { kind: 'pen', pts: [pt(p)], ax: e.clientX, ay: e.clientY, done: false, rec: null, recAt: 0 }; arm(); ed.store.setUI({ sel: [] }); show(drag.pts); return true; }
      if (tool === 'erase') { const d = { kind: 'erase' as const, before: ed.doc, hit: false }; drag = d; ed.live = { ...emptyLive(), sketch: { eraser: p } }; eraseAt(p, d); return true; }
      const hit = ed.hitTest(p);
      if (hit && ed.store.ui.sel.includes(hit.id) && !hit.locked) return false;
      drag = { kind: 'lasso', pts: [pt(p)] }; ed.store.setUI({ sel: [] }); return true;
    },
    move(e, p) {
      const d = drag;
      if (!d) { if (ed.store.ui.tool === 'erase') { ed.live = { ...emptyLive(), sketch: { eraser: p } }; ed.invalidate(); } return; }
      if (d.kind === 'erase') { ed.live = { ...emptyLive(), sketch: { eraser: p } }; eraseAt(p, d); ed.invalidate(); return; }
      const last = d.pts[d.pts.length - 1], far = Math.hypot(p.x - last[0], p.y - last[1]) * ed.scale;
      if (d.kind === 'pen') {
        if (d.done) return;
        if (Math.hypot(e.clientX - d.ax, e.clientY - d.ay) > 3) { d.ax = e.clientX; d.ay = e.clientY; arm(); }
        if (far < 1.5) return;
        d.pts.push(pt(p)); show(d.pts); return;
      }
      if (far < 3) return;
      d.pts.push(pt(p));
      const sel = d.pts.length > 3 ? ed.visible().filter(n => { const c = ed.centreOf(n); return inPoly([c.x, c.y], d.pts); }).map(n => n.id) : [];
      ed.live = { ...emptyLive(), sketch: { lasso: toPoints(d.pts) } }; ed.store.setUI({ sel });
    },
    up() {
      const d = drag; drag = null; clearTimeout(holdTimer);
      if (!d) return;
      if (d.kind === 'erase') { ed.live = emptyLive(); if (d.hit) ed.store.commit(ed.doc, { before: d.before }); ed.invalidate(); return; }
      if (d.kind === 'lasso') { ed.live = emptyLive(); ed.invalidate(); return; }
      if (d.pts.length < 3) { show(undefined); return; }
      if (d.rec) { const r = d.rec; setTimeout(() => { show(undefined); commitRecognised(r); }, Math.max(0, 250 - (performance.now() - d.recAt))); return; }
      const P = resample(d.pts, 96);
      if (isScribble(P)) {
        const b = bbox(P), area = Math.max(1, b.w * b.h);
        const share = (n: DocNode) => { const r = ed.box(n); return P.filter(q => q[0] >= r.x && q[0] <= r.x + r.w && q[1] >= r.y && q[1] <= r.y + r.h).length / P.length; };
        let kill = ed.visible().filter(n => { const r = ed.box(n); return !n.locked && share(n) > .25 && r.w * r.h < area * 4; });
        if (!kill.length) { const top = [...ed.visible()].reverse().find(n => !n.locked && share(n) > .5); if (top) kill = [top]; }
        if (kill.length) { show(undefined); ed.commit(removeNodes(ed.doc, kill.map(n => n.id)), `Scribbled out ${kill.length > 1 ? `${kill.length} objects` : layerName(kill[0])} · Undo brings it back`); ed.select([]); return; }
      }
      show(undefined);
      ed.commit(addNodes(ed.doc, [inkNode([smooth(d.pts)], ed.inkWidth())]));
    },
    leave() { if (!drag && ed.live.sketch.eraser) { ed.live = emptyLive(); ed.invalidate(); } },
  };
}
