// On-device background removal for image nodes.
// ISNet (DIS, Apache-2.0) runs in the participant's browser through ONNX Runtime Web (MIT): WebGPU when available, WASM
// otherwise. Weights and the wasm runtime are served from this app's own origin (public/models, public/ort; see
// scripts/prepare-model.mjs) and cached by the browser, so no pixels and no requests leave the deployment.
import type * as ORT from 'onnxruntime-web';
export type Progress = { key: string; current: number; total: number };
export type ProgressListener = (fraction: number) => void;
export type Chunked = { bytes: number; sha256: string; parts: string[] };
export type Manifest = Chunked & { name: string; variant: string; inputSize: number };
export type Runtime = { version: string; mjs: string; wasm: Chunked & { name: string } };
export const MODEL = { path: 'models/isnet/', input: 'input_image', output: 'output_image', mean: [0.5, 0.5, 0.5], std: [1, 1, 1], sigmoid: false } as const;
/** Preferred weight variants in order; the first one the server has wins. fp16 halves the download, fp32 is the untouched checkpoint. */
export const variantsFor = (_webgpu: boolean): string[] => ['fp16', 'fp32'];
const CACHE = 'ratio-model-v1';
/** Fraction of all known downloads completed, 0..1. */
export function progressFraction(steps: Iterable<Progress>): number {
  let current = 0, total = 0;
  for (const step of steps) if (step.total > 0) { current += Math.min(step.current, step.total); total += step.total; }
  return total > 0 ? current / total : 0;
}
/** Collects per-resource progress into one aggregate fraction for the listener. */
export function progressTracker(listen: ProgressListener): (key: string, current: number, total: number) => void {
  const steps = new Map<string, Progress>();
  return (key, current, total) => { steps.set(key, { key, current, total }); listen(progressFraction(steps.values())); };
}
/** RGBA pixels → normalised planar float input [3, pixels] (channel-major), as the model expects. */
export function planeFromRgba(rgba: ArrayLike<number>, pixels: number, mean: readonly number[], std: readonly number[]): Float32Array {
  const out = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) for (let c = 0; c < 3; c++) out[c * pixels + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c];
  return out;
}
/** Model scores → alpha 0..255: optional sigmoid, then stretched so the least confident pixel is 0 and the most confident 255. */
export function alphaFromScores(scores: ArrayLike<number>, sigmoid: boolean): Uint8ClampedArray {
  const n = scores.length, p = new Float32Array(n);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) { const v = sigmoid ? 1 / (1 + Math.exp(-scores[i])) : scores[i]; p[i] = v; if (v < min) min = v; if (v > max) max = v; }
  const range = max - min, out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) out[i] = Math.round((range > 1e-6 ? (p[i] - min) / range : p[i]) * 255);
  return out;
}
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable image'));
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable image'));
    reader.readAsDataURL(blob);
  });
}
const base = import.meta.env.BASE_URL;
async function json<T>(url: string, what: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${what} missing (${response.status}); run npm run model`);
  return response.json() as Promise<T>;
}
type Report = (key: string, current: number, total: number) => void;
let runtime: Promise<typeof ORT> | undefined;
// The wasm loader module is handed to ORT as a blob URL (served as a plain file it would be rewritten by the dev server,
// and bundlers cannot see a URL only known at run time); the wasm binary arrives in parts and is passed as wasmBinary.
const loadRuntime = (report: Report) => runtime ??= (async () => {
  const [ort, files] = await Promise.all([import('onnxruntime-web/webgpu'), json<Runtime>(`${base}ort/runtime.json`, 'ONNX runtime manifest')]);
  const [loader, binary] = await Promise.all([fetch(`${base}ort/${files.mjs}`), fetchChunked(`${base}ort/`, files.wasm, report)]);
  if (!loader.ok) throw new Error(`ONNX runtime loader missing (${loader.status}); run npm run model`);
  ort.env.wasm.wasmPaths = { mjs: URL.createObjectURL(new Blob([await loader.text()], { type: 'text/javascript' })) };
  ort.env.wasm.wasmBinary = binary.buffer;
  return ort;
})().catch(e => { runtime = undefined; throw e; });
async function readAll(response: Response, key: string, expected: number, report: Report): Promise<Uint8Array<ArrayBuffer>> {
  const total = Number(response.headers.get('content-length')) || expected, chunks: Uint8Array[] = [];
  let received = 0; report(key, 0, total);
  if (!response.body) { const bytes = new Uint8Array(await response.arrayBuffer()); report(key, bytes.length, total); return bytes; }
  const reader = response.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); received += value.length; report(key, received, total); }
  const bytes = new Uint8Array(received); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
async function loadManifest(variants: string[]): Promise<Manifest> {
  for (const [i, variant] of variants.entries()) {
    const response = await fetch(`${base}${MODEL.path}${variant}/manifest.json`);
    if (response.ok) return response.json() as Promise<Manifest>;
    if (i === variants.length - 1) throw new Error(`Model manifest missing (${response.status}); run npm run model`);
  }
  throw new Error('No model variants');
}
/** Fetch a file served as parts (see scripts/prepare-model.mjs), through the Cache API when available, and verify its digest. */
async function fetchChunked(dir: string, file: Chunked, report: Report): Promise<Uint8Array<ArrayBuffer>> {
  const cache = typeof caches === 'undefined' ? undefined : await caches.open(CACHE).catch(() => undefined);
  const partBytes = Math.ceil(file.bytes / file.parts.length);
  const parts = await Promise.all(file.parts.map(async (part, i) => {
    const url = `${dir}${part}`, expected = Math.min(partBytes, file.bytes - i * partBytes);
    const cached = await cache?.match(url);
    if (cached) return readAll(cached, url, expected, report);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${part} missing (${response.status}); run npm run model`);
    const bytes = await readAll(response, url, expected, report);
    await cache?.put(url, new Response(bytes, { headers: { 'content-length': String(bytes.length) } })).catch(() => {});
    return bytes;
  }));
  const bytes = new Uint8Array(file.bytes); let offset = 0;
  for (const part of parts) { bytes.set(part.subarray(0, Math.max(0, file.bytes - offset)), offset); offset += part.length; }
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (offset !== file.bytes || digest !== file.sha256) {
    for (const part of file.parts) await cache?.delete(`${dir}${part}`).catch(() => {});
    throw new Error(`${dir} download was incomplete or corrupt; cleared the cache, try again`);
  }
  return bytes;
}
async function loadModel(variants: string[], report: Report): Promise<{ bytes: Uint8Array; manifest: Manifest }> {
  const manifest = await loadManifest(variants);
  return { bytes: await fetchChunked(`${base}${MODEL.path}${manifest.variant}/`, manifest, report), manifest };
}
type Engine = { ort: typeof ORT; session: ORT.InferenceSession; size: number; webgpu: boolean; variant: string };
const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
async function createSession(ort: typeof ORT, bytes: Uint8Array, webgpu: boolean): Promise<ORT.InferenceSession> {
  return ort.InferenceSession.create(bytes, { executionProviders: webgpu ? ['webgpu', 'wasm'] : ['wasm'], graphOptimizationLevel: 'all' });
}
let weights: Uint8Array | undefined, ready: Promise<Engine> | undefined;
async function createEngine(listen?: ProgressListener, prefer?: string[]): Promise<Engine> {
  const webgpu = !!gpu && !!(await gpu.requestAdapter().catch(() => null)), report = progressTracker(listen ?? (() => {}));
  const [ort, model] = await Promise.all([loadRuntime(report), loadModel(prefer ?? variantsFor(webgpu), report)]);
  weights = model.bytes;
  const engine = { ort, size: model.manifest.inputSize, variant: model.manifest.variant };
  try { return { ...engine, session: await createSession(ort, model.bytes, webgpu), webgpu }; }
  catch (e) { if (!webgpu) throw e; console.warn('WebGPU session failed, using WASM', e); }
  return { ...engine, session: await createSession(ort, model.bytes, false), webgpu: false };
}
/** Fetch runtime and weights and build the session ahead of the first use. Idempotent; a failed attempt is retried on the next call. */
export function preloadBackgroundRemoval(listen?: ProgressListener, prefer?: string[]): Promise<Engine> {
  return ready ??= createEngine(listen, prefer).catch(e => { ready = undefined; throw e; });
}
async function infer(engine: Engine, input: ORT.Tensor): Promise<Float32Array> {
  try { return (await engine.session.run({ [MODEL.input]: input }, [MODEL.output]))[MODEL.output].data as Float32Array; }
  catch (e) {
    if (!engine.webgpu || !weights) throw e;
    console.warn('WebGPU inference failed, using WASM', e);
    await engine.session.release().catch(() => {});
    engine.session = await createSession(engine.ort, weights, false); engine.webgpu = false;
    return (await engine.session.run({ [MODEL.input]: input }, [MODEL.output]))[MODEL.output].data as Float32Array;
  }
}
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })!] as const; };
/** Replace the background of a raster data URL with transparency; resolves to a PNG data URL of the same pixel size. */
export async function removeBackground(src: string, listen?: ProgressListener): Promise<string> {
  const engine = await preloadBackgroundRemoval(listen);
  const bitmap = await createImageBitmap(await (await fetch(src)).blob());
  try {
    const { width, height } = bitmap, size = engine.size, pixels = size * size;
    const [, small] = canvas(size, size); small.drawImage(bitmap, 0, 0, size, size);
    const input = new engine.ort.Tensor('float32', planeFromRgba(small.getImageData(0, 0, size, size).data, pixels, MODEL.mean, MODEL.std), [1, 3, size, size]);
    const alpha = alphaFromScores(await infer(engine, input), MODEL.sigmoid);
    const [maskCanvas, mask] = canvas(size, size), grey = mask.createImageData(size, size);
    for (let i = 0; i < pixels; i++) { grey.data[i * 4] = grey.data[i * 4 + 1] = grey.data[i * 4 + 2] = alpha[i]; grey.data[i * 4 + 3] = 255; }
    mask.putImageData(grey, 0, 0);
    const [, scaled] = canvas(width, height); scaled.imageSmoothingQuality = 'high'; scaled.drawImage(maskCanvas, 0, 0, width, height);
    const cover = scaled.getImageData(0, 0, width, height).data;
    const [outCanvas, out] = canvas(width, height); out.drawImage(bitmap, 0, 0); const image = out.getImageData(0, 0, width, height);
    for (let i = 0; i < width * height; i++) image.data[i * 4 + 3] = cover[i * 4];
    out.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => outCanvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG encode failed')), 'image/png'));
    return blobToDataUrl(blob);
  } finally { bitmap.close(); }
}
