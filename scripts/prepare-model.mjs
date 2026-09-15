// Prepares the self-hosted assets for the background remover (runs before `npm run dev` and `npm run build`).
//  1. Copies the ONNX Runtime Web loader module the webgpu bundle references into public/ort/ and writes its wasm
//     binary there as 16 MB parts (the client reassembles it and hands it to ORT as wasmBinary).
//  2. Fetches the pinned ISNet general-use ONNX weights (DIS, Apache-2.0) once into node_modules/.cache, verifies the
//     SHA-256, derives the float16 variant with onnx-fp16.mjs, and writes each served variant to
//     public/models/isnet/<variant>/ as 16 MB parts with a manifest, so static hosts with per-file limits can serve
//     them and the browser can fetch parts in parallel. The licence notice ships next to the weights.
// RATIO_MODEL_VARIANTS=fp16,fp32 chooses the served variants (default fp16; fp32 is the untouched checkpoint);
// RATIO_MODEL_SOURCE_fp32=/path/to/isnet-general-use.onnx uses a local copy instead of downloading.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { toFloat16Model } from './onnx-fp16.mjs';
const root = path.resolve(import.meta.dirname, '..');
const MODEL = { name: 'isnet', inputSize: 1024, output: 'output_image', upstream: 'https://github.com/xuebinqin/DIS', license: 'Apache-2.0' };
// fp32 is the untouched general-use checkpoint published with rembg (MIT project, Apache-2.0 weights). fp16 is derived
// from it here: only the fused prediction output kept, weights and compute in float16, inputs/outputs float32, Resize
// fenced in float32. Its digest is pinned as a regression check; update it when onnx-fp16.mjs changes on purpose.
const FP16_SHA256 = 'fd3157904827f5850a8c585c5f3c3f5a8814c46cf4b133005c5267aa13b19aa0'; // digest of the derived fp16 file; update when onnx-fp16.mjs changes on purpose
const SOURCE = { url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx', sha256: '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a', bytes: 178648008 };
const VARIANTS = {
  fp32: { sha256: SOURCE.sha256, bytes: SOURCE.bytes, note: 'untouched checkpoint' },
  fp16: { sha256: process.env.RATIO_MODEL_FP16_SHA256 ?? FP16_SHA256, bytes: 0, note: 'derived: output_image only, float16 weights and compute, float32 interface' },
};
const requested = (process.env.RATIO_MODEL_VARIANTS ?? 'fp16').split(',').map(v => v.trim()).filter(Boolean);
const PART_BYTES = 16 * 1024 * 1024;
const LICENSE = `ISNet general-use weights from Dichotomous Image Segmentation (DIS), Qin et al., ECCV 2022.
${MODEL.upstream}
Downloaded from the rembg project's model release (https://github.com/danielgatis/rembg, MIT). The fp16 variant is the
same network with the training-time side outputs removed and weights and compute converted to float16 (inputs and
outputs kept float32) by scripts/onnx-fp16.mjs in this repository.

Copyright 2022 Xuebin Qin and the DIS authors.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
`;
function split(bytes) {
  const parts = Array.from({ length: Math.ceil(bytes.byteLength / PART_BYTES) }, (_, i) => `part${String(i).padStart(2, '0')}`);
  return parts.map((name, i) => [name, bytes.subarray(i * PART_BYTES, Math.min((i + 1) * PART_BYTES, bytes.byteLength))]);
}
async function prepareRuntime() {
  const dist = path.join(root, 'node_modules/onnxruntime-web/dist'), out = path.join(root, 'public/ort'), manifestPath = path.join(out, 'runtime.json');
  const version = JSON.parse(await readFile(path.join(root, 'node_modules/onnxruntime-web/package.json'), 'utf8')).version;
  const bundle = await readFile(path.join(dist, 'ort.webgpu.bundle.min.mjs'), 'utf8');
  const names = [...new Set(bundle.match(/ort-wasm-simd-threaded(?:\.[a-z]+)?\.wasm/g))];
  if (names.length === 0) throw new Error('No wasm binary referenced by onnxruntime-web webgpu bundle');
  const [wasm] = names, mjs = wasm.replace(/\.wasm$/, '.mjs');
  const binary = new Uint8Array(await readFile(path.join(dist, wasm))), sha256 = createHash('sha256').update(binary).digest('hex');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.version === version && manifest.wasm?.sha256 === sha256 && existsSync(path.join(out, mjs))) { console.log(`ort: ${version} ${wasm} in public/ort (up to date)`); return; }
  }
  await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
  await copyFile(path.join(dist, mjs), path.join(out, mjs));
  const parts = split(binary);
  for (const [name, chunk] of parts) await writeFile(path.join(out, `${wasm}.${name}`), chunk);
  const manifest = { version, mjs, wasm: { name: wasm, bytes: binary.byteLength, sha256, partBytes: PART_BYTES, parts: parts.map(([name]) => `${wasm}.${name}`) } };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`ort: ${version} ${wasm} written to public/ort as ${parts.length} parts`);
}
let sourceBytes;
async function loadSource() {
  if (sourceBytes) return sourceBytes;
  const local = process.env.RATIO_MODEL_SOURCE_fp32, cacheDir = path.join(root, 'node_modules/.cache/ratio-models'), cached = path.join(cacheDir, 'isnet-general-use.onnx');
  const verify = (bytes, where) => {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (bytes.byteLength !== SOURCE.bytes || sha256 !== SOURCE.sha256) throw new Error(`Checkpoint at ${where} does not match the pinned digest: got ${sha256} (${bytes.byteLength} bytes), expected ${SOURCE.sha256} (${SOURCE.bytes} bytes)`);
    return bytes;
  };
  if (local) { console.log(`model: reading checkpoint ${local}`); return sourceBytes = verify(new Uint8Array(await readFile(local)), local); }
  if (existsSync(cached) && (await stat(cached)).size === SOURCE.bytes) { try { return sourceBytes = verify(new Uint8Array(await readFile(cached)), cached); } catch (e) { console.warn(String(e.message)); } }
  console.log(`model: downloading checkpoint, ${(SOURCE.bytes / 1048576).toFixed(0)} MB from ${SOURCE.url}`);
  const response = await fetch(SOURCE.url);
  if (!response.ok) throw new Error(`Checkpoint download failed: ${response.status} ${response.statusText}`);
  const bytes = verify(new Uint8Array(await response.arrayBuffer()), SOURCE.url);
  await mkdir(cacheDir, { recursive: true }); await writeFile(cached, bytes);
  return sourceBytes = bytes;
}
async function prepareVariant(variant) {
  const spec = VARIANTS[variant];
  if (!spec) throw new Error(`Unknown model variant ${variant}; known: ${Object.keys(VARIANTS).join(', ')}`);
  const dir = path.join(root, 'public/models', MODEL.name, variant), manifestPath = path.join(dir, 'manifest.json');
  if (existsSync(manifestPath) && spec.sha256) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    let complete = manifest.sha256 === spec.sha256;
    for (const [i, part] of manifest.parts.entries()) {
      const file = path.join(dir, part), expected = Math.min(PART_BYTES, manifest.bytes - i * PART_BYTES);
      if (!existsSync(file) || (await stat(file)).size !== expected) complete = false;
    }
    if (complete) { console.log(`model: ${MODEL.name} ${variant} in public/models/${MODEL.name}/${variant} (up to date)`); return; }
  }
  const source = await loadSource();
  let bytes = source;
  if (variant === 'fp16') { const t = Date.now(); bytes = toFloat16Model(source, { keepOutputs: [MODEL.output] }); console.log(`model: derived fp16 in ${Date.now() - t} ms`); }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (spec.sha256 && sha256 !== spec.sha256) throw new Error(`Model ${variant} digest mismatch: got ${sha256} (${bytes.byteLength} bytes), expected ${spec.sha256}. If onnx-fp16.mjs changed on purpose, update FP16_SHA256.`);
  const parts = split(bytes), partNames = parts.map(([name]) => `model.${name}`);
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  for (const [i, [, chunk]] of parts.entries()) await writeFile(path.join(dir, partNames[i]), chunk);
  const manifest = { name: MODEL.name, variant, inputSize: MODEL.inputSize, bytes: bytes.byteLength, sha256, partBytes: PART_BYTES, parts: partNames, license: MODEL.license, source: SOURCE.url, upstream: MODEL.upstream, note: spec.note };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(dir, 'LICENSE.txt'), LICENSE);
  console.log(`model: wrote ${partNames.length} parts and manifest to public/models/${MODEL.name}/${variant} (${(bytes.byteLength / 1048576).toFixed(1)} MB, sha256 ${sha256})`);
}
await prepareRuntime();
for (const variant of requested) await prepareVariant(variant);
