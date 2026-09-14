// On-device background removal for image nodes.
// Segmentation runs entirely in the participant's browser (ISNet via ONNX Runtime Web: WebGPU when
// available, WASM otherwise). Model and runtime files are fetched once from IMG.LY's static CDN and
// cached by the browser; no image ever leaves the machine. The library is AGPL-3.0 (see HANDOFF).
import type { Config } from '@imgly/background-removal';
export type Progress = { key: string; current: number; total: number };
export type ProgressListener = (fraction: number) => void;
const config: Config = { device: 'gpu', model: 'isnet_fp16', output: { format: 'image/png', quality: 1 } };
/** Fraction of all known downloads completed, 0..1. Compute steps are excluded so the bar only reports transfer. */
export function progressFraction(steps: Iterable<Progress>): number {
  let current = 0, total = 0;
  for (const step of steps) if (!step.key.startsWith('compute:') && step.total > 0) { current += Math.min(step.current, step.total); total += step.total; }
  return total > 0 ? current / total : 0;
}
/** Collects per-resource progress callbacks into one aggregate fraction. */
export function progressTracker(listen: ProgressListener): (key: string, current: number, total: number) => void {
  const steps = new Map<string, Progress>();
  return (key, current, total) => { steps.set(key, { key, current, total }); listen(progressFraction(steps.values())); };
}
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unreadable image'));
    reader.onerror = () => reject(reader.error ?? new Error('Unreadable image'));
    reader.readAsDataURL(blob);
  });
}
let loader: Promise<typeof import('@imgly/background-removal')> | undefined;
const library = () => loader ??= import('@imgly/background-removal').catch(e => { loader = undefined; throw e; });
let ready: Promise<void> | undefined;
/** Fetch model and runtime ahead of the first use. Idempotent; a failed attempt is retried on the next call. */
export function preloadBackgroundRemoval(listen?: ProgressListener): Promise<void> {
  return ready ??= library().then(lib => lib.preload({ ...config, progress: listen && progressTracker(listen) })).catch(e => { ready = undefined; throw e; });
}
/** Replace the background of a raster data URL with transparency; resolves to a PNG data URL of the same pixel size. */
export async function removeBackground(src: string, listen?: ProgressListener): Promise<string> {
  await preloadBackgroundRemoval(listen);
  const lib = await library();
  const blob = await lib.removeBackground(src, { ...config, progress: listen && progressTracker(listen) });
  return blobToDataUrl(blob);
}
