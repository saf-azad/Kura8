import { contains, center, type Point, type Rect, type Size } from './geometry';
// Image placement maths. The cover crop is derived from the frame and the focus point, never stored (AGENTS: Document v2).
export const CENTRE: Point = { x: .5, y: .5 };
/** Source rectangle (in natural pixels) that covers a frame of `frame` proportions, centred on `focus` and clamped inside the image. */
export function coverCrop(natural: Size, frame: Size, focus: Point = CENTRE): Rect {
  const scale = Math.max(frame.w / natural.w, frame.h / natural.h), w = Math.min(natural.w, frame.w / scale), h = Math.min(natural.h, frame.h / scale);
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return { x: clamp(focus.x * natural.w - w / 2, natural.w - w), y: clamp(focus.y * natural.h - h / 2, natural.h - h), w, h };
}
/** Working-copy size (5n): longest side at most `factor` × the largest export side, never upscaled. */
export function workingSize(natural: Size, maxExport: number, factor = 2): Size {
  const k = Math.min(1, factor * maxExport / Math.max(natural.w, natural.h));
  return { w: Math.max(1, Math.round(natural.w * k)), h: Math.max(1, Math.round(natural.h * k)) };
}
/** Where a dropped image lands (5p): the smallest cell containing the point, else the cell with the nearest centre; without cells, the middle half of the canvas. */
export function nearestCell(p: Point, cells: Rect[], canvas: Size): Rect {
  const inside = cells.filter(c => contains(c, p)).sort((a, b) => a.w * a.h - b.w * b.h);
  if (inside.length) return { ...inside[0] };
  const d = (c: Rect) => Math.hypot(center(c).x - p.x, center(c).y - p.y);
  const near = [...cells].sort((a, b) => d(a) - d(b))[0];
  return near ? { ...near } : { x: canvas.w / 4, y: canvas.h / 4, w: canvas.w / 2, h: canvas.h / 2 };
}
/** A frame of the image's proportions centred in `box` (contain), used for images added without a target cell. */
export function containIn(box: Rect, natural: Size): Rect {
  const k = Math.min(box.w / natural.w, box.h / natural.h), w = natural.w * k, h = natural.h * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
/** Where the whole picture lies, frame-local, when `frame` shows its cover crop: drawn faintly while repositioning. */
export function fullImageRect(natural: Size, frame: Size, focus: Point = CENTRE): Rect {
  const crop = coverCrop(natural, frame, focus), k = frame.w / crop.w;
  return { x: 0 - crop.x * k, y: 0 - crop.y * k, w: natural.w * k, h: natural.h * k };
}
/** Reposition (D-048): the focus after the picture is dragged `delta` frame-local units inside its frame, kept where the crop stays inside the picture. */
export function panFocus(natural: Size, frame: Size, focus: Point, delta: Point): Point {
  const crop = coverCrop(natural, frame, focus), k = frame.w / crop.w;
  const axis = (start: number, span: number, total: number, d: number) => { const half = span / 2 / total; return Math.max(half, Math.min(1 - half, (start + span / 2) / total - d / k / total)); };
  return { x: axis(crop.x, crop.w, natural.w, delta.x), y: axis(crop.y, crop.h, natural.h, delta.y) };
}
/** Covered share of a cell by other blocks' boxes (overlaps may double-count; only the order matters). */
const occupancy = (cell: Rect, taken: Rect[]): number => taken.reduce((s, t) => {
  const w = Math.min(cell.x + cell.w, t.x + t.w) - Math.max(cell.x, t.x), h = Math.min(cell.y + cell.h, t.y + t.h) - Math.max(cell.y, t.y);
  return s + (w > 0 && h > 0 ? w * h : 0);
}, 0) / (cell.w * cell.h);
/**
 * Boxes for several new pictures (D-058): a drop point's own cell first, then the emptiest cells nearest the point
 * (ties to the nearer one), so a batch spreads over free cells instead of piling up. Past the last cell the order
 * repeats, cascading 20 units each round. Without cells every picture gets the middle half of the canvas, cascaded.
 */
export function spreadCells(p: Point, cells: Rect[], taken: Rect[], count: number, canvas: Size, dropped: boolean): Rect[] {
  const d = (c: Rect) => Math.hypot(center(c).x - p.x, center(c).y - p.y);
  const first = dropped && cells.length ? nearestCell(p, cells, canvas) : null;
  const order = [...(first ? [first] : []), ...cells.filter(c => !first || c.x !== first.x || c.y !== first.y || c.w !== first.w || c.h !== first.h)
    .map(c => ({ c, o: occupancy(c, taken), d: d(c) })).sort((a, b) => a.o - b.o || a.d - b.d).map(x => x.c)];
  const pool = order.length ? order : [nearestCell(p, [], canvas)];
  // Cascaded rounds stay inside the canvas.
  return Array.from({ length: count }, (_, i) => { const c = pool[i % pool.length], k = Math.floor(i / pool.length) * 20; return { ...c, x: Math.min(c.x + k, Math.max(c.x, canvas.w - c.w)), y: Math.min(c.y + k, Math.max(c.y, canvas.h - c.h)) }; });
}
/** Area two rectangles share. */
const shared = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/**
 * Where a new block of `size` goes (D-077): pasted copy and icons look for the spot that overlaps the blocks already
 * there the least, trying each guide cell's corner (inset by `pad`) and rows down it, then the canvas in rows; ties go
 * to the emptiest cell first, then reading order. On a full canvas the least covered spot still wins, so repeated
 * pastes and icons never land exactly on one another. Covering text (`text`, kept `pad` / 2 clear) counts ten times as
 * much as covering pictures or blocks, so copy goes over a photo before it goes over other copy (D-081). The box stays
 * inside the canvas.
 */
export function freeSpot(o: { size: Size; canvas: Size; cells: Rect[]; taken: Rect[]; pad: number; text?: Rect[] }): Point {
  const { size, canvas, pad } = o, w = Math.min(size.w, canvas.w), h = Math.min(size.h, canvas.h);
  const fit = (x: number, y: number): Point => ({ x: Math.max(0, Math.min(x, canvas.w - w)), y: Math.max(0, Math.min(y, canvas.h - h)) });
  const cells = [...o.cells].map(c => ({ c, o: occupancy(c, o.taken) })).sort((a, b) => a.o - b.o).map(x => x.c);
  const step = Math.max(h, 10), spots: Point[] = [];
  for (const c of cells) for (let y = c.y + pad; y === c.y + pad || y + h <= c.y + c.h - pad + 1e-6; y += step) spots.push(fit(c.x + pad, y));
  for (let y = pad; y === pad || y + h <= canvas.h - pad + 1e-6; y += step) for (let x = pad; x === pad || x + w <= canvas.w - pad + 1e-6; x += Math.max(w / 2, 10)) spots.push(fit(x, y));
  const gap = pad / 2, text = (o.text ?? []).map(t => ({ x: t.x - gap, y: t.y - gap, w: t.w + 2 * gap, h: t.h + 2 * gap }));
  let best = spots[0], least = Infinity;
  for (const p of spots) {
    const box = { ...p, w, h }, cover = o.taken.reduce((s, t) => s + shared(box, t), 0) + text.reduce((s, t) => s + 10 * shared(box, t), 0);
    if (cover < least - 1e-6) { least = cover; best = p; }
  }
  return best;
}
/**
 * Tiles for several pictures sharing one frame (D-081): a grid in reading order,
 * `gap` apart; the last row's tiles widen to fill it.
 */
export function tiles(rect: Rect, n: number, gap: number): Rect[] {
  // Columns whose tiles come closest to square, a part-filled last row costing a little; ties go to more columns.
  const score = (c: number) => Math.abs(Math.log((rect.w / c) / (rect.h / Math.ceil(n / c)))) + (n % c ? .5 : 0);
  let cols = 1;
  for (let c = 2; c <= n; c++) if (score(c) <= score(cols) + 1e-9) cols = c;
  const rows = Math.ceil(n / cols), h = (rect.h - gap * (rows - 1)) / rows, out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    const k = r < rows - 1 ? cols : n - cols * (rows - 1), w = (rect.w - gap * (k - 1)) / k;
    for (let c = 0; c < k; c++) out.push({ x: rect.x + c * (w + gap), y: rect.y + r * (h + gap), w, h });
  }
  return out;
}
