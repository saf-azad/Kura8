import type { DocNode, Frame, KuraDoc, TextNode } from '../../core/document';
import { center, rotatedBounds, rotatePoint, unionRect, norm, type Point, type Rect } from '../../core/geometry';
import { resizeLocal } from './resize';
import { snap, snapAngle, snapLines, type Handle, type SnapLine } from '../../core/snap';
import { setFrames } from '../../core/ops';
import { textBox } from '../../core/fit';
import { measure } from '../measure';
import { handlePoints, HANDLE_PX, pageToCrop, cropCorners } from './overlay';
import { coverPlacement } from '../../core/images';
import { emptyLive, type Editor } from '../editor';
import type { SketchTools } from '../sketch';
// Pointer interaction on the overlay canvas: select, shift-select, marquee, move (snapping v2 with hold and pull),
// resize in the node's own frame, rotate with angle snapping, armed paint, double-click to edit. Alt skips
// snapping (5j); Shift constrains the drag axis, corner aspect and rotation steps.
// `last` is the document this drag last wrote; anything else committed meanwhile (Delete, undo, a finished background
// removal) ends the drag rather than being overwritten from `before`.
type Drag =
  | { kind: 'move'; ids: string[]; start: Point; before: KuraDoc; last?: KuraDoc; frames: Record<string, Frame>; box: Rect; rot: number; moved: boolean; held?: { x?: string; y?: string }; click: string[] }
  | { kind: 'resize'; id: string; handle: Handle; before: KuraDoc; last?: KuraDoc; frame: Frame; box: Rect; size: number; moved: boolean }
  | { kind: 'rotate'; id: string; c: Point; a0: number; r0: number; before: KuraDoc; last?: KuraDoc; held: number | null; moved: boolean }
  | { kind: 'marquee'; start: Point; base: string[] }
  | { kind: 'crop'; mode: 'pan' | 'zoom' | Handle; start: Point; frame: Frame; place: Rect; corner?: Point };
const MIN = 20;
const CURSORS: Record<string, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', rotate: 'grab' };
export function installInteraction(ed: Editor, sketch: SketchTools): void {
  const el = ed.overlay;
  let drag: Drag | null = null;
  const px = () => 1 / ed.scale;
  const lines = (moving: Set<string>): SnapLine[] => {
    const ui = ed.store.ui, others = ed.visible().filter(n => !moving.has(n.id)).map(n => ({ id: n.id, rect: ed.box(n), rot: ed.frame(n).rot }));
    return snapLines({ canvas: ed.canvas(), others, grid: ui.grid.on ? ui.grid.size : undefined, centre: true });
  };
  const allLines = (extra: SnapLine[]): SnapLine[] => {
    const c = ed.canvas();
    return [{ id: 'edge-left', axis: 'x', at: 0, tier: 1 }, { id: 'edge-right', axis: 'x', at: c.w, tier: 1 }, { id: 'edge-top', axis: 'y', at: 0, tier: 1 }, { id: 'edge-bottom', axis: 'y', at: c.h, tier: 1 },
      ...ed.anchors().flatMap(a => a.kind === 'line' ? [{ id: a.id, axis: a.axis, at: a.at, tier: 0 as const }] : []), ...extra];
  };
  const handleAt = (p: Point): { id: string; handle: Handle | 'rotate' } | null => {
    for (const box of ed.boxes()) for (const { handle, at } of handlePoints(box, ed.scale)) if (Math.hypot(at.x - p.x, at.y - p.y) <= (HANDLE_PX / 2 + 4) * px()) return { id: box.id, handle };
    return null;
  };
  /** Crop mode: a frame handle crops, a picture corner zooms, inside the picture pans; elsewhere ends the session. */
  const cropDown = (e: PointerEvent, p: Point): boolean => {
    const c = ed.cropInfo();
    if (!c) { ed.endCrop(); return false; }
    const v = { rect: c.frame.rect, rot: c.frame.rot, flip: [!!c.node.flipX, !!c.node.flipY] as [boolean, boolean], place: c.place, bitmap: c.bitmap }, near = (q: Point) => Math.hypot(q.x - p.x, q.y - p.y) <= (HANDLE_PX / 2 + 4) * px();
    const swap: Record<string, string> = { e: 'w', w: 'e', n: 's', s: 'n' }, mirror = (h: Handle) => h.split('').map(ch => (ch === 'e' || ch === 'w') && v.flip[0] || (ch === 'n' || ch === 's') && v.flip[1] ? swap[ch] : ch).join('') as Handle;
    const handle = handlePoints({ id: '', rect: v.rect, rot: v.rot, handles: 'all', locked: false }, ed.scale).find(x => x.handle !== 'rotate' && near(x.at));
    const corners = cropCorners(v), corner = corners.findIndex(near), q = pageToCrop(v, p);
    let mode: 'pan' | 'zoom' | Handle | null = null, fixed: Point | undefined;
    if (handle) mode = mirror(handle.handle as Handle);
    else if (corner >= 0) { mode = 'zoom'; const o = [[1, 1], [0, 1], [0, 0], [1, 0]][corner]; fixed = { x: c.place.x + o[0] * c.place.w, y: c.place.y + o[1] * c.place.h }; }
    else if (q.x >= c.place.x && q.y >= c.place.y && q.x <= c.place.x + c.place.w && q.y <= c.place.y + c.place.h) mode = 'pan';
    if (!mode) { ed.endCrop(); return false; }
    drag = { kind: 'crop', mode, start: q, frame: c.frame, place: c.place, corner: fixed };
    el.setPointerCapture(e.pointerId); e.preventDefault();
    return true;
  };
  const cropMove = (d: Extract<Drag, { kind: 'crop' }>, p: Point, shift: boolean) => {
    const c = ed.cropInfo(); if (!c) return;
    const v = { rect: d.frame.rect, rot: d.frame.rot, flip: [!!c.node.flipX, !!c.node.flipY] as [boolean, boolean] }, q = pageToCrop(v, p), P = d.place, F = d.frame.rect;
    if (d.mode === 'pan') { ed.setCrop(d.frame, coverPlacement(F, { ...P, x: P.x + q.x - d.start.x, y: P.y + q.y - d.start.y })); return; }
    if (d.mode === 'zoom') {
      const o = d.corner!, k = Math.max(Math.abs(q.x - o.x) / P.w, Math.abs(q.y - o.y) / P.h, .05), w = P.w * k, h = P.h * k;
      const x = o.x > P.x + P.w / 2 - 1e-9 ? o.x - w : o.x, y = o.y > P.y + P.h / 2 - 1e-9 ? o.y - h : o.y;
      ed.setCrop(d.frame, coverPlacement(F, { x, y, w, h })); return;
    }
    // Cropping: edges move inside the picture; the picture stays where it is on the page.
    const min = 10 * px(), hd = d.mode;
    let x0 = 0, y0 = 0, x1 = F.w, y1 = F.h;
    if (hd.includes('w')) x0 = Math.min(x1 - min, Math.max(P.x, q.x)); if (hd.includes('e')) x1 = Math.max(x0 + min, Math.min(P.x + P.w, q.x));
    if (hd.includes('n')) y0 = Math.min(y1 - min, Math.max(P.y, q.y)); if (hd.includes('s')) y1 = Math.max(y0 + min, Math.min(P.y + P.h, q.y));
    if (shift && hd.length === 2) { const k = Math.min((x1 - x0) / F.w, (y1 - y0) / F.h); if (hd.includes('w')) x0 = x1 - F.w * k; else x1 = x0 + F.w * k; if (hd.includes('n')) y0 = y1 - F.h * k; else y1 = y0 + F.h * k; }
    // The new box in content coordinates, back to a page rect turned about its own centre.
    const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, cx = v.flip[0] ? F.w - mid.x : mid.x, cy = v.flip[1] ? F.h - mid.y : mid.y;
    const centre = rotatePoint({ x: F.x + cx, y: F.y + cy }, center(F), v.rot), w = x1 - x0, h = y1 - y0;
    ed.setCrop({ ...d.frame, rect: { x: centre.x - w / 2, y: centre.y - h / 2, w, h } }, { ...P, x: P.x - x0, y: P.y - y0 });
  };
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    const p = ed.toUnits(e), ui = ed.store.ui;
    el.focus({ preventScroll: true });
    if (ed.textarea) ed.finishText();
    if (ui.picking) { ed.pickAt(e); return; }
    if (ui.crop && cropDown(e, p)) return;
    if (ui.tool && sketch.down(e, p)) { el.setPointerCapture(e.pointerId); return; }
    if (ui.armed) { ed.paintAt(ed.hitTest(p)); return; }
    const knob = handleAt(p);
    if (knob) {
      const node = ed.doc.nodes.find(n => n.id === knob.id)!, f = ed.frame(node);
      if (knob.handle === 'rotate') { const c = center(ed.box(node)); drag = { kind: 'rotate', id: node.id, c, a0: Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI, r0: f.rot, before: ed.doc, held: null, moved: false }; }
      else drag = { kind: 'resize', id: node.id, handle: knob.handle, before: ed.doc, frame: f, box: ed.box(node), size: node.kind === 'text' ? textBox(node, f, measure, ed.typeScale()).size : 0, moved: false };
      el.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const hit = ed.hitTest(p);
    const keepPanel = ui.panel === 'shapes' || ui.panel === 'layers' || ui.panel === 'colour' ? ui.panel : null;
    if (!hit) {
      const base = e.shiftKey ? ui.sel : [];
      ed.store.setUI({ sel: base, panel: keepPanel });
      drag = { kind: 'marquee', start: p, base }; el.setPointerCapture(e.pointerId); return;
    }
    // Groups (D-045): a click selects the whole group; a click on a member of the selected group selects just it.
    let sel = ui.sel;
    const members = ed.withGroups([hit.id]), groupOnly = members.length > 1 && sel.length === members.length && members.every(id => sel.includes(id));
    const click = groupOnly ? [hit.id] : members;
    if (e.shiftKey) sel = sel.includes(hit.id) ? sel.filter(x => !members.includes(x)) : [...sel, ...members.filter(x => !sel.includes(x))];
    else if (!sel.includes(hit.id)) sel = members;
    ed.store.setUI({ sel, panel: keepPanel });
    void ed.checkCutout(hit);
    if (hit.kind === 'image' && hit.asset) ed.preloadRemoval();
    if (!sel.includes(hit.id)) return;
    const movers = ed.doc.nodes.filter(n => sel.includes(n.id) && !n.locked && !ed.frame(n).hidden);
    if (!movers.length) return;
    const frames = Object.fromEntries(movers.map(n => [n.id, ed.frame(n)]));
    const single = movers.length === 1 ? movers[0] : null;
    const box = single ? ed.box(single) : unionRect(movers.map(n => rotatedBounds(ed.box(n), ed.frame(n).rot)));
    drag = { kind: 'move', ids: movers.map(n => n.id), start: p, before: ed.doc, frames, box, rot: single ? ed.frame(single).rot : 0, moved: false, click };
    el.setPointerCapture(e.pointerId); e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    const p = ed.toUnits(e), ui = ed.store.ui;
    if (ui.tool && !drag) { sketch.move(e, p); return; }
    if (!drag) { hover(p); return; }
    const snapping = !e.altKey;
    if (drag.kind === 'crop') { cropMove(drag, p, e.shiftKey); return; }
    if (drag.kind !== 'marquee' && drag.last && ed.doc !== drag.last) { drag = null; ed.live = emptyLive(); ed.invalidate(); return; }
    if (drag.kind === 'marquee') {
      const m = { x: Math.min(p.x, drag.start.x), y: Math.min(p.y, drag.start.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) };
      if (m.w * ed.scale < 2 && m.h * ed.scale < 2) return;
      ed.live = { ...emptyLive(), marquee: m }; ed.store.setUI({ sel: [...new Set([...drag.base, ...ed.withGroups(ed.within(m))])] }); return;
    }
    if (drag.kind === 'move') {
      let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) * ed.scale < 3) return;
      drag.moved = true;
      const axis = e.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null;
      if (axis === 'x') dy = 0; if (axis === 'y') dx = 0;
      const moving = new Set(drag.ids), extra = lines(moving), rect = { ...drag.box, x: drag.box.x + dx, y: drag.box.y + dy };
      const k = px();
      if (snapping) {
        const r = snap({ rect, handle: 'move', anchors: ed.anchors(), canvas: ed.canvas(), threshold: 6 * k, reach: 20 * k, hold: 13 * k, held: drag.held, extra, rotation: drag.rot });
        if (axis !== 'y') dx = r.rect.x - drag.box.x; if (axis !== 'x') dy = r.rect.y - drag.box.y;
        drag.held = r.held;
        const keep = (a: 'x' | 'y') => !axis || axis === a;
        ed.live = { ...emptyLive(), hits: r.hits.filter(h => keep(h.axis)), lines: allLines(extra), near: r.near, pull: r.pull && { x: keep('x') ? r.pull.x : undefined, y: keep('y') ? r.pull.y : undefined } };
      } else { ed.live = emptyLive(); drag.held = undefined; }
      const next: Record<string, Frame> = {};
      for (const id of drag.ids) { const f = drag.frames[id]; next[id] = { ...f, rect: { ...f.rect, x: f.rect.x + dx, y: f.rect.y + dy } }; }
      drag.last = setFrames(drag.before, ed.sizeId, next); ed.store.set(drag.last); return;
    }
    if (drag.kind === 'resize') {
      drag.moved = true;
      const id = drag.id, node = drag.before.nodes.find(n => n.id === id)!, f = drag.frame, corner = drag.handle.length === 2;
      const lockAspect = node.kind === 'image' || node.kind === 'text' && corner || e.shiftKey && corner;
      const min = { w: Math.min(MIN, drag.box.w), h: Math.min(MIN, drag.box.h) };
      const raw = resizeLocal(drag.box, f.rot, drag.handle, p, { lockAspect, min });
      let rect = raw.rect;
      if (snapping) {
        const extra = lines(new Set([node.id]));
        const r = snap({ rect, handle: drag.handle, anchors: ed.anchors(), canvas: ed.canvas(), threshold: 8 * px(), extra, rotation: f.rot, lockAspect, dominantAxis: raw.dominantAxis });
        if (r.rect.w >= min.w - 1e-9 && r.rect.h >= min.h - 1e-9) { rect = r.rect; ed.live = { ...emptyLive(), hits: r.hits, lines: allLines(extra) }; } else ed.live = emptyLive();
      } else ed.live = emptyLive();
      let frame: Frame = { ...f, rect }, unfit = false;
      if (node.kind === 'text') {
        // Corners scale the font (a manual size change turns autofit off); e/w rewrap; n/s move an autofit box's bottom.
        const scale = ed.typeScale();
        if (corner) { frame = { ...frame, fontSize: drag.size * rect.w / drag.box.w }; unfit = !!node.fit; }
        if (!node.fit || corner) frame = { ...frame, rect: { ...frame.rect, h: textBox({ ...node, fit: undefined }, frame, measure, scale).rect.h } };
        else if (drag.handle === 'e' || drag.handle === 'w') frame = { ...frame, rect: { ...frame.rect, h: f.rect.h } };
      }
      let doc = setFrames(drag.before, ed.sizeId, { [node.id]: frame });
      if (unfit) doc = { ...doc, nodes: doc.nodes.map(n => { if (n.id !== node.id) return n; const t = { ...n } as TextNode; delete t.fit; return t; }) };
      drag.last = doc; ed.store.set(doc); return;
    }
    drag.moved = true;
    const a = Math.atan2(p.y - drag.c.y, p.x - drag.c.x) * 180 / Math.PI;
    let angle = norm(drag.r0 + a - drag.a0), caught: number | null = null;
    if (snapping || e.shiftKey) {
      const regions = ed.anchors().flatMap(x => x.kind === 'region' ? [x.rect] : []);
      const r = snapAngle({ angle, canvas: ed.canvas(), regions, shift: e.shiftKey, lock: 3, reach: 11, hold: 7, held: snapping ? drag.held : null });
      angle = r.angle; caught = snapping ? r.caught : null;
    }
    drag.held = caught;
    ed.live = { ...emptyLive(), angle: caught === null ? null : { deg: caught, centre: drag.c } };
    const id = drag.id, node = drag.before.nodes.find(n => n.id === id)!, f = node.frames[ed.sizeId];
    drag.last = setFrames(drag.before, ed.sizeId, { [node.id]: { ...f, rot: Math.abs(angle) < 1e-9 ? 0 : angle } }); ed.store.set(drag.last);
  });
  const finish = (e: PointerEvent) => {
    if (sketch.active()) { sketch.up(e, ed.toUnits(e)); return; }
    const d = drag; drag = null; ed.live = emptyLive();
    if (!d) return;
    if (d.kind === 'marquee' || d.kind === 'crop') { ed.invalidate(); return; }
    if (d.last && ed.doc !== d.last) { ed.invalidate(); return; }
    if (d.moved && ed.doc !== d.before) ed.store.commit(ed.doc, { before: d.before });
    else if (d.kind === 'move' && !e.shiftKey && JSON.stringify(ed.store.ui.sel) !== JSON.stringify(d.click)) ed.select(d.click);
    ed.invalidate();
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('pointerleave', () => { if (ed.store.ui.tool) sketch.leave(); });
  el.addEventListener('dblclick', e => {
    if (ed.store.ui.tool || ed.store.ui.armed || ed.store.ui.crop || ed.store.ui.picking) return;
    const n: DocNode | undefined = ed.hitTest(ed.toUnits(e));
    if (n?.kind === 'text' && !n.locked) ed.editText(n.id);
    else if (n?.kind === 'image' && !n.locked) { if (n.asset) ed.startCrop(n.id); else ed.pickImage(n.id); }
  });
  function hover(p: Point): void {
    const ui = ed.store.ui;
    if (ui.picking) { el.style.cursor = 'crosshair'; return; }
    if (ui.crop) { el.style.cursor = 'move'; return; }
    if (ui.armed) { el.style.cursor = paintCursor(ed.colour(ui.armed)); return; }
    const knob = handleAt(p);
    if (knob) { el.style.cursor = CURSORS[knob.handle]; return; }
    const n = ed.hitTest(p);
    el.style.cursor = n && !n.locked ? 'move' : 'default';
  }
  // Images dropped on a block fill it; elsewhere they go to the nearest cell (5p).
  const stage = ed.root;
  stage.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  stage.addEventListener('drop', e => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    const p = ed.toUnits(e), c = ed.canvas(), inside = p.x >= 0 && p.y >= 0 && p.x <= c.w && p.y <= c.h;
    void ed.placeFiles([...e.dataTransfer.files], inside ? p : null);
  });
}
/** The armed swatch rides on the cursor as a ring (5e). */
export function paintCursor(hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="10" fill="none" stroke="#000" stroke-width="2"/><circle cx="14" cy="14" r="7" fill="none" stroke="${hex}" stroke-width="4"/><circle cx="14" cy="14" r="1.5" fill="#000"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 14 14, copy`;
}
