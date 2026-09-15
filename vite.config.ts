import { defineConfig, type Plugin } from 'vitest/config';
// onnxruntime-web references its wasm binaries with `new URL(..., import.meta.url)`, so Vite copies them into dist/assets.
// The background remover points ort.env.wasm.wasmPaths at public/ort/ instead (see scripts/prepare-model.mjs and
// src/app/tools/background.ts), leaving that copy as dead weight in the static bundle. Drop it.
const dropUnusedOrtWasm: Plugin = { name: 'drop-unused-ort-wasm', generateBundle(_, bundle) { for (const name of Object.keys(bundle)) if (/^assets\/ort-wasm-.*\.(wasm|mjs)$/.test(name)) delete bundle[name]; } };
export default defineConfig({ plugins: [dropUnusedOrtWasm], test: { include: ['tests/**/*.test.ts'], coverage: { provider: 'v8', include: ['src/core/**/*.ts'], thresholds: { lines: 100 } } } });
