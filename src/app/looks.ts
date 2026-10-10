import { applyLook, type Look } from '../core/look';
// Photo looks on decoded bitmaps (D-045): the pure pixel maths from src/core/look.ts run on an OffscreenCanvas copy.
// Editing works on a copy no larger than `maxSide`; exports pass the full-resolution original and no limit.
export async function withLook(bitmap: ImageBitmap, look: Look, maxSide = Infinity): Promise<ImageBitmap> {
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height)), w = Math.max(1, Math.round(bitmap.width * k)), h = Math.max(1, Math.round(bitmap.height * k));
  const canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  applyLook(data.data, w, h, look);
  ctx.putImageData(data, 0, 0);
  return createImageBitmap(canvas);
}
/** Keeps a handful of processed bitmaps, newest last; evicted ones are closed. */
export class LookCache {
  private done = new Map<string, ImageBitmap>();
  private queue: { key: string; base: string; run: () => Promise<ImageBitmap> }[] = [];
  private busy = false;
  private onReady: () => void;
  private limit: number;
  constructor(onReady: () => void, limit = 12) { this.onReady = onReady; this.limit = limit; }
  /** The processed bitmap for `key`, or the newest finished one for the same picture while it is being made. */
  get(base: string, key: string, run: () => Promise<ImageBitmap>): ImageBitmap | undefined {
    const hit = this.done.get(key);
    if (hit) { this.done.delete(key); this.done.set(key, hit); return hit; }
    if (!this.queue.some(q => q.key === key)) { this.queue = this.queue.filter(q => q.base !== base); this.queue.push({ key, base, run }); void this.pump(); }
    const stale = [...this.done.keys()].reverse().find(k => k.startsWith(`${base}|`));
    return stale ? this.done.get(stale) : undefined;
  }
  forget(base: string): void { for (const [k, b] of [...this.done]) if (k.startsWith(`${base}|`)) { b.close(); this.done.delete(k); } }
  private async pump(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length) {
      const job = this.queue.shift()!;
      try {
        const bitmap = await job.run();
        this.done.set(job.key, bitmap);
        while (this.done.size > this.limit) { const [k, b] = this.done.entries().next().value!; this.done.delete(k); b.close(); }
      } catch (e) { console.warn('Look failed', e); }
      this.onReady();
    }
    this.busy = false;
  }
}
