import type { Anchor } from '../../core/guides/types';
import type { Handle, SnapHit, SnapLine } from '../../core/snap';
import { center, corners, rotatePoint, type Point, type Rect, type Size } from '../../core/geometry';
// The overlay canvas: guides, grid, the winning snap line, pull lines, caught angle, selection boxes and handles,
// marquee, re-ratio flags, text crossing marks and sketch feedback. Never exported.
export type HandleSet = 'all' | 'corners' | 'text' | 'fit' | 'none';
export type Box = { id: string; rect: Rect; rot: number; handles: HandleSet; locked: boolean };
export type OverlayState = {
  size: Size; scale: number;
  guides: Anchor[] | null; guideInk: string; grid: number | null; dark: boolean;
  hits: SnapHit[]; lines: SnapLine[]; near?: { x?: SnapLine; y?: SnapLine }; pull?: { x?: number; y?: number };
  angle: { deg: number; centre: Point } | null;
  boxes: Box[]; marquee: Rect | null; flags: { rect: Rect; rot: number }[]; crossings: { x: number; w: number; y: number }[];
  sketch: { live?: Point[]; stroke: number; ink: string; lasso?: Point[]; eraser?: Point | null };
  scan: { rect: Rect; rot: number; t: number } | null;
  /** Repositioning a picture: the whole picture (frame-local) drawn faintly around its frame. */ reposition?: { rect: Rect; rot: number; full: Rect; bitmap: ImageBitmap | null | undefined } | null;
};
export const HANDLE_PX = 12, ROTATE_PX = 44;
/** The overlay reaches this far past the canvas on every side, so handles and knobs at the edges stay visible and grabbable. */
export const MARGIN = 64;
const LETTERS: Record<HandleSet, Handle[]> = { all: ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'], corners: ['nw', 'ne', 'se', 'sw'], text: ['nw', 'ne', 'se', 'sw', 'w', 'e'], fit: ['nw', 'ne', 'se', 'sw', 'n', 'e', 's', 'w'], none: [] };
/** Handle positions in unit space on the rotated box, plus the rotate knob above the top edge (`scale` is px per unit). */
export function handlePoints(box: Box, scale: number): { handle: Handle | 'rotate'; at: Point }[] {
  if (box.locked || box.handles === 'none') return [];
  const { rect: r, rot } = box, c = center(r), at = (u: number, v: number) => rotatePoint({ x: r.x + u * r.w, y: r.y + v * r.h }, c, rot);
  const pos: Record<Handle, Point> = { nw: at(0, 0), ne: at(1, 0), se: at(1, 1), sw: at(0, 1), n: at(.5, 0), e: at(1, .5), s: at(.5, 1), w: at(0, .5), move: c };
  // Near the top of the canvas the knob would sit under the toolbar: it hangs below the box instead.
  let knob = rotatePoint({ x: c.x, y: r.y - ROTATE_PX / scale }, c, rot);
  if (knob.y * scale < -20) knob = rotatePoint({ x: c.x, y: r.y + r.h + ROTATE_PX / scale }, c, rot);
  return [...LETTERS[box.handles].map(handle => ({ handle, at: pos[handle] })), { handle: 'rotate' as const, at: knob }];
}
export function drawOverlay(canvas: HTMLCanvasElement, s: OverlayState): void {
  const dpr = window.devicePixelRatio || 1, w = Math.round((s.size.w * s.scale + 2 * MARGIN) * dpr), h = Math.round((s.size.h * s.scale + 2 * MARGIN) * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d')!, px = 1 / s.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.setTransform(s.scale * dpr, 0, 0, s.scale * dpr, MARGIN * dpr, MARGIN * dpr);
  const line = (axis: 'x' | 'y', at: number, over = 0) => { ctx.beginPath(); if (axis === 'x') { ctx.moveTo(at, -over); ctx.lineTo(at, s.size.h + over); } else { ctx.moveTo(-over, at); ctx.lineTo(s.size.w + over, at); } ctx.stroke(); };
  if (s.grid) {
    ctx.strokeStyle = s.dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)'; ctx.lineWidth = px;
    for (let x = s.grid; x < s.size.w; x += s.grid) line('x', x);
    for (let y = s.grid; y < s.size.h; y += s.grid) line('y', y);
  }
  if (s.guides) {
    ctx.globalAlpha = .35; ctx.strokeStyle = s.guideInk; ctx.lineWidth = px;
    for (const a of s.guides) if (a.kind === 'line') line(a.axis, a.at);
    ctx.globalAlpha = .5; ctx.fillStyle = s.guideInk;
    for (const a of s.guides) if (a.kind === 'point') { ctx.beginPath(); ctx.arc(a.x, a.y, 3 * px, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // Only the winner draws (5k); a span names both of its lines, a region draws dashed.
  ctx.strokeStyle = '#000'; ctx.lineWidth = px;
  const byId = new Map(s.lines.map(l => [l.id, l]));
  for (const hit of s.hits) {
    const direct = byId.get(hit.targetId);
    if (direct) { line(direct.axis, direct.at, 12 * px); continue; }
    const span = s.lines.filter(l => hit.targetId.startsWith('span-') && hit.targetId.includes(l.id) && l.axis === hit.axis && l.tier <= 1);
    span.forEach(l => line(l.axis, l.at, 12 * px));
    const region = s.guides?.find(a => a.kind === 'region' && a.id === hit.targetId);
    if (region?.kind === 'region') { ctx.setLineDash([4 * px, 3 * px]); ctx.strokeRect(region.rect.x, region.rect.y, region.rect.w, region.rect.h); ctx.setLineDash([]); }
  }
  for (const axis of ['x', 'y'] as const) {
    const near = s.near?.[axis], f = s.pull?.[axis];
    if (near && f !== undefined && near.id.indexOf('span-') !== 0) { ctx.globalAlpha = f * f * .4; line(axis, near.at, 12 * px); ctx.globalAlpha = 1; }
  }
  if (s.angle) {
    const len = 2 * Math.hypot(s.size.w, s.size.h), a = s.angle.deg * Math.PI / 180, { x, y } = s.angle.centre;
    ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2); ctx.lineTo(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2); ctx.stroke();
  }
  ctx.lineWidth = 2 * px;
  for (const f of s.flags) {
    const p = corners(f.rect, f.rot); ctx.setLineDash([6 * px, 4 * px]); ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    const at = p[0], r = 11 * px; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${14 * px}px "Space Grotesk", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', at.x, at.y + px);
  }
  for (const c of s.crossings) { ctx.setLineDash([3 * px, 3 * px]); ctx.beginPath(); ctx.moveTo(c.x - 10 * px, c.y); ctx.lineTo(c.x + c.w + 10 * px, c.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(c.x - 10 * px, c.y - 6 * px); ctx.lineTo(c.x - 10 * px, c.y + 6 * px); ctx.stroke(); }
  if (s.scan) { const { rect: r } = s.scan, c = center(r); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(s.scan.rot * Math.PI / 180); ctx.fillStyle = '#000'; ctx.fillRect(-r.w / 2, -r.h / 2 + r.h * s.scan.t - px, r.w, 2 * px); ctx.restore(); }
  if (s.reposition) {
    const { rect: r, rot, full, bitmap } = s.reposition, c = center(r);
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(rot * Math.PI / 180); ctx.translate(-r.w / 2, -r.h / 2);
    ctx.save(); ctx.beginPath(); ctx.rect(full.x, full.y, full.w, full.h); ctx.rect(0, 0, r.w, r.h); ctx.clip('evenodd');
    if (bitmap) { ctx.globalAlpha = .4; ctx.drawImage(bitmap, full.x, full.y, full.w, full.h); ctx.globalAlpha = 1; }
    ctx.restore();
    ctx.strokeStyle = '#000'; ctx.lineWidth = px; ctx.setLineDash([4 * px, 3 * px]); ctx.strokeRect(full.x, full.y, full.w, full.h); ctx.setLineDash([]);
    ctx.lineWidth = 2 * px; ctx.strokeRect(0, 0, r.w, r.h); ctx.restore();
  }
  for (const b of s.boxes) {
    const p = corners(b.rect, b.rot);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2 * px; ctx.setLineDash(b.locked ? [5 * px, 4 * px] : []);
    ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    if (b.locked) {
      const at = p[1], r = 11 * px; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(at.x, at.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * px; ctx.strokeRect(at.x - 4 * px, at.y - 1 * px, 8 * px, 6 * px); ctx.beginPath(); ctx.arc(at.x, at.y - 1 * px, 2.5 * px, Math.PI, 0); ctx.stroke();
    }
    const points = handlePoints(b, s.scale);
    if (!points.length) continue;
    const knob = points[points.length - 1].at, c = center(b.rect), ends = [rotatePoint({ x: c.x, y: b.rect.y }, c, b.rot), rotatePoint({ x: c.x, y: b.rect.y + b.rect.h }, c, b.rot)];
    const top = Math.hypot(ends[0].x - knob.x, ends[0].y - knob.y) <= Math.hypot(ends[1].x - knob.x, ends[1].y - knob.y) ? ends[0] : ends[1];
    ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(knob.x, knob.y); ctx.stroke();
    ctx.fillStyle = '#ECF0F3'; ctx.beginPath(); ctx.arc(knob.x, knob.y, 8 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (const { handle, at } of points) {
      if (handle === 'rotate') continue;
      const half = HANDLE_PX / 2 * px;
      ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(b.rot * Math.PI / 180);
      ctx.beginPath(); ctx.roundRect(-half, -half, 2 * half, 2 * half, 2.5 * px); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }
  if (s.marquee) { const m = s.marquee; ctx.fillStyle = 'rgba(156,171,194,.15)'; ctx.fillRect(m.x, m.y, m.w, m.h); ctx.lineWidth = px; ctx.strokeRect(m.x, m.y, m.w, m.h); }
  const path = (pts: Point[], close: boolean) => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); if (close) ctx.closePath(); };
  if (s.sketch.live && s.sketch.live.length > 1) { ctx.strokeStyle = s.sketch.ink; ctx.lineWidth = s.sketch.stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; path(s.sketch.live, false); ctx.stroke(); }
  if (s.sketch.lasso && s.sketch.lasso.length > 1) { ctx.fillStyle = 'rgba(156,171,194,.15)'; ctx.strokeStyle = '#000'; ctx.lineWidth = px; path(s.sketch.lasso, true); ctx.fill(); ctx.stroke(); }
  if (s.sketch.eraser) { ctx.fillStyle = 'rgba(156,171,194,.15)'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(s.sketch.eraser.x, s.sketch.eraser.y, 12 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
}
