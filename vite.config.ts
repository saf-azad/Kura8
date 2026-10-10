import { defineConfig, type Plugin } from 'vitest/config';
// onnxruntime-web references its wasm binaries with `new URL(..., import.meta.url)`, so Vite copies them into dist/assets.
// The background remover points ort.env.wasm.wasmPaths at public/ort/ instead (see scripts/prepare-model.mjs and
// src/app/tools/background.ts), leaving that copy as dead weight in the static bundle. Drop it.
const dropUnusedOrtWasm: Plugin = { name: 'drop-unused-ort-wasm', generateBundle(_, bundle) { for (const name of Object.keys(bundle)) if (/^assets\/ort-wasm-.*\.(wasm|mjs)$/.test(name)) delete bundle[name]; } };
// Float16Array ships in Node 24; on older Node the fp16 converter tests need V8's flag in the test workers.
const float16 = typeof (globalThis as { Float16Array?: unknown }).Float16Array === 'undefined' ? ['--js-float16array'] : [];
export default defineConfig({ plugins: [dropUnusedOrtWasm], test: { include: ['tests/**/*.test.ts'], poolOptions: { forks: { execArgv: float16 } }, coverage: { provider: 'v8', include: ['src/core/**/*.ts'], thresholds: { lines: 100 } } } });
