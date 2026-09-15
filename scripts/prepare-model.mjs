// Prepares the self-hosted assets for the background remover (runs before `npm run dev` and `npm run build`).
//  1. Copies the ONNX Runtime Web loader module the webgpu bundle references into public/ort/ and writes its wasm
//     binary there as 16 MB parts (the client reassembles it and hands it to ORT as wasmBinary).
//  2. Fetches the pinned ISNet general-use ONNX weights (DIS, Apache-2.0) for each served variant, verifies the SHA-256,
//     and writes them to public/models/isnet/<variant>/ as 16 MB parts with a manifest, so static hosts with per-file
//     limits can serve them and the browser can fetch parts in parallel. The licence notice ships next to the weights.
// RATIO_MODEL_VARIANTS=fp32,fp16 chooses the variants (default: all with a source);
// RATIO_MODEL_SOURCE_<variant>=/path/to/model.onnx uses a local copy instead of downloading;
// RATIO_MODEL_FP16_URL=https://... serves the float16 conversion (scripts/to_fp16.py) from a release of this repo.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const MODEL = { name: 'isnet', inputSize: 1024, upstream: 'https://github.com/xuebinqin/DIS', license: 'Apache-2.0' };
// fp32 is the untouched general-use checkpoint published with rembg (MIT project, Apache-2.0 weights). fp16 is the same
// network converted with onnxconverter-common (keep_io_types) for half the download; it needs a hosted URL or a local copy.
const VARIANTS = {
  fp32: { source: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx', sha256: '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a', bytes: 178648008 },
  fp16: { source: process.env.RATIO_MODEL_FP16_URL, sha256: '1e00f2f0b23dea1b687ff90652263144fdb98af942aaa0cae8630c49159b18f0', bytes: 90661254 },
};
const requested = (process.env.RATIO_MODEL_VARIANTS ?? 'fp32,fp16').split(',').map(v => v.trim()).filter(Boolean);
const PART_BYTES = 16 * 1024 * 1024;
const LICENSE = `ISNet general-use weights from Dichotomous Image Segmentation (DIS), Qin et al., ECCV 2022.
${MODEL.upstream}
Downloaded from the rembg project's model release (https://github.com/danielgatis/rembg, MIT); the fp16 variant is the
same network converted to float16 with onnxconverter-common, inputs and outputs kept float32.

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
async function prepareVariant(variant) {
  const spec = VARIANTS[variant], local = process.env[`RATIO_MODEL_SOURCE_${variant}`];
  if (!spec) throw new Error(`Unknown model variant ${variant}; known: ${Object.keys(VARIANTS).join(', ')}`);
  const dir = path.join(root, 'public/models', MODEL.name, variant), manifestPath = path.join(dir, 'manifest.json');
  const expectedParts = spec.bytes ? Math.ceil(spec.bytes / PART_BYTES) : 0;
  if (existsSync(manifestPath) && spec.sha256) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    let complete = manifest.sha256 === spec.sha256 && manifest.parts.length === expectedParts;
    for (const [i, part] of manifest.parts.entries()) {
      const file = path.join(dir, part), expected = Math.min(PART_BYTES, spec.bytes - i * PART_BYTES);
      if (!existsSync(file) || (await stat(file)).size !== expected) complete = false;
    }
    if (complete) { console.log(`model: ${MODEL.name} ${variant} in public/models/${MODEL.name}/${variant} (up to date)`); return; }
  }
  if (!spec.source && !local) { console.log(`model: ${variant} skipped (no source; set RATIO_MODEL_FP16_URL or RATIO_MODEL_SOURCE_${variant}); the app falls back to another variant`); return; }
  let bytes;
  if (local) { bytes = new Uint8Array(await readFile(local)); console.log(`model: ${variant} reading ${local}`); }
  else {
    console.log(`model: ${variant} downloading ${(spec.bytes / 1048576).toFixed(0)} MB from ${spec.source}`);
    const response = await fetch(spec.source);
    if (!response.ok) throw new Error(`Model download failed: ${response.status} ${response.statusText}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (spec.sha256 && (bytes.byteLength !== spec.bytes || sha256 !== spec.sha256)) throw new Error(`Model ${variant} checksum mismatch: got ${sha256} (${bytes.byteLength} bytes), expected ${spec.sha256} (${spec.bytes} bytes)`);
  const parts = split(bytes), partNames = parts.map(([name]) => `model.${name}`);
  await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  for (const [i, [, chunk]] of parts.entries()) await writeFile(path.join(dir, partNames[i]), chunk);
  const manifest = { name: MODEL.name, variant, inputSize: MODEL.inputSize, bytes: bytes.byteLength, sha256, partBytes: PART_BYTES, parts: partNames, license: MODEL.license, source: spec.source ?? 'local', upstream: MODEL.upstream };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(path.join(dir, 'LICENSE.txt'), LICENSE);
  console.log(`model: wrote ${partNames.length} parts and manifest to public/models/${MODEL.name}/${variant} (sha256 ${sha256})`);
}
await prepareRuntime();
for (const variant of requested) await prepareVariant(variant);
