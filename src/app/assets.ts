import type { Size } from '../core/geometry';
import { workingSize } from '../core/images';
// Image assets in IndexedDB, keyed by the SHA-256 of the original bytes: the original (kept for full-resolution
// export, 5n), a working copy at most twice the export size, and an optional cut-out (5o). Decoded bitmaps are cached.
export type AssetRecord = { key: string; natural: Size; work: Size; original: Blob; working: Blob; cutout?: Blob };
export type Variant = 'working' | 'cutout' | 'original';
const DB = 'kura8', STORE = 'assets';
let db: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  return db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result); req.onerror = () => { db = undefined; reject(req.error); };
  });
}
async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await open()).transaction(STORE, mode).objectStore(STORE);
  return new Promise((resolve, reject) => { const r = run(store); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export const getRecord = (key: string): Promise<AssetRecord | undefined> => tx<AssetRecord | undefined>('readonly', s => s.get(key));
const put = (record: AssetRecord) => tx('readwrite', s => s.put(record));
export async function hashOf(blob: Blob): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
}
const bitmaps = new Map<string, Promise<ImageBitmap | null>>();
export const bitmapKey = (asset: string, variant: Variant) => variant === 'working' ? asset : `${asset}#${variant}`;
async function encode(bitmap: ImageBitmap, size: Size, type: string): Promise<Blob> {
  const c = new OffscreenCanvas(size.w, size.h), x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high'; x.drawImage(bitmap, 0, 0, size.w, size.h);
  return c.convertToBlob({ type: type === 'image/jpeg' ? 'image/jpeg' : 'image/png', quality: .92 });
}
/** Stores an image file once (same bytes, same key) and returns its key and natural size. */
export async function putImage(file: Blob, maxExport: number, key?: string): Promise<{ key: string; natural: Size }> {
  const id = key ?? await hashOf(file), existing = await getRecord(id).catch(() => undefined);
  if (existing) return { key: id, natural: existing.natural };
  const bitmap = await createImageBitmap(file);
  try {
    const natural = { w: bitmap.width, h: bitmap.height }, work = workingSize(natural, maxExport);
    const working = work.w === natural.w && work.h === natural.h ? file : await encode(bitmap, work, file.type);
    await put({ key: id, natural, work, original: file, working });
    bitmaps.set(id, Promise.resolve(work.w === natural.w ? await createImageBitmap(file) : await createImageBitmap(working)));
    return { key: id, natural };
  } finally { bitmap.close(); }
}
export async function setCutout(key: string, cutout: Blob): Promise<void> {
  const record = await getRecord(key);
  if (!record) throw new Error('Image missing');
  await put({ ...record, cutout });
  bitmaps.get(bitmapKey(key, 'cutout'))?.then(b => b?.close());
  bitmaps.delete(bitmapKey(key, 'cutout'));
}
/** Decoded bitmap of an asset variant, or null when the asset (or that variant) is missing. */
export function bitmap(key: string, variant: Variant = 'working'): Promise<ImageBitmap | null> {
  const id = bitmapKey(key, variant);
  let p = bitmaps.get(id);
  if (!p) {
    p = getRecord(key).then(r => { const blob = r && (variant === 'cutout' ? r.cutout : variant === 'original' ? r.original : r.working); return blob ? createImageBitmap(blob) : null; }).catch(() => null);
    if (variant !== 'original') bitmaps.set(id, p);
  }
  return p;
}
/** Closes and forgets the decoded bitmaps of an asset (the stored blobs stay). */
export function release(key: string): void {
  for (const variant of ['working', 'cutout'] as const) {
    const id = bitmapKey(key, variant), p = bitmaps.get(id);
    if (p) { bitmaps.delete(id); void p.then(b => b?.close()); }
  }
}
/** Deletes assets no document references any more. */
export async function gc(keep: Set<string>): Promise<void> {
  const keys = await tx<IDBValidKey[]>('readonly', s => s.getAllKeys()).catch(() => [] as IDBValidKey[]);
  for (const key of keys) if (!keep.has(String(key))) await tx('readwrite', s => s.delete(key)).catch(() => {});
}
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> { return (await fetch(dataUrl)).blob(); }
export const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
