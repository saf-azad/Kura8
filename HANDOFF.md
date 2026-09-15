# HANDOFF

Rolling state for the Ratio Phase 0 build. Read in full at session start; rewrite Status and append to the rest at session end. Rules are in AGENTS.md → Handoff protocol.

## Status

The merged editor includes the six-shape library, colour picker plus validated hex entry, object locks, platform-aware keyboard controls and Shift drag/resize constraints. All 50 unit tests pass with 100% core line coverage, and the production build succeeds. Chromium checks cover all 15 ratio/guide paths, both original study-condition interaction flows, all export sizes and JSON reload without console errors. The new controls audit verifies all six coloured shape PNG/JSON exports, Mac and PC shortcut dispatch/labels, locks and reload recovery, text input guards, and Shift constraints in both conditions. Screenshots are under private/editor-controls-audit/. The existing private demo at https://ratio-phase-zero.alazadsafwat.chatgpt.site has not been redeployed with these changes. Remote main's background remover and transparency fix are now integrated; locked images cannot start removal and any in-flight result is discarded if the image becomes locked. Local decision IDs were reconciled with the remote log (D-027). Study protocol, content approval and pilot remain Safwat's next decisions.

## Decision log

Append-only. New entries supersede named old entries; do not edit history. Format: id, date, who, decision, why.

- **D-001** 2026-09-14 safwat — Phase 0 is the guide-and-snap wedge plus a study harness, nothing else. Why: prove the thesis before building the editor (project brief, first principles).
- **D-002** 2026-09-14 fable — Stack is TypeScript + Vite + Vitest, vanilla DOM/SVG for chrome, HTML canvas 2D for the document, behind a Renderer interface. Why: Phase 0 is a layout test; CanvasKit adds a 7 MB WASM dependency and path/boolean ops nobody uses until Phase 2. The interface keeps the swap cheap.
- **D-003** 2026-09-14 fable — All geometry lives in a 1000-unit-wide unit space; pixels appear only at export and on screen. Why: brief requires resolution-independent documents; one fixed width keeps thresholds and tests simple.
- **D-004** 2026-09-14 fable — Guide generators emit no canvas-edge lines; the snapping engine adds edges itself. Why: keeps generators purely about proportion and stops every generator duplicating the same four lines.
- **D-005** 2026-09-14 fable — Size snapping candidates are spans between lines (edges included) and region dimensions; on a tie with a position candidate, position wins. Why: gives the guide control over dimensions as the brief demands; the tie rule is the simplest deterministic choice and can be tuned after the study.
- **D-006** 2026-09-14 fable — No object-to-object snapping and no pixel grid in Phase 0, even though the brief's full priority order includes both. Why: the study must attribute any layout improvement to guide anchors alone.
- **D-007** 2026-09-14 fable — Autosave to localStorage and a fixed content pack are in Phase 0. Why: test validity, not features. A tester losing work to a reload, or typing skill varying between participants, would contaminate the comparison.
- **D-008** 2026-09-14 fable — Ratio presets: square 1:1, portrait 4:5, landscape 16:9, story 9:16, banner 3:1. Export widths 1080, 1080, 1920, 1080, 1500 px. Why: common social sizes; banner is a guess and is the easiest to change.
- **D-009** 2026-09-14 fable — Guide region sets are as specified in AGENTS.md → Guides (cells for thirds and golden, four golden rectangles, quadrants and centre bands for divisions). Points are drawn but never snapped to. Why: regions are what make size snapping proportional rather than a side effect of line spans; points add no position information lines don't already carry.
- **D-010** 2026-09-14 fable — In guide mode the wheel centre skips only the ratio choice; the guide wheel still follows, so a guide-mode document always has a guide. The brief's centre goes straight to a blank canvas is deferred to Phase 1. Why: a no-guide path inside the guide condition would confound the study.
- **D-011** 2026-09-14 fable — Every new node is placed centred at a fixed default size, identically in both conditions. Why: the study needs a neutral start that cannot be read as a layout suggestion; identical placement in both arms cancels it out.
- **D-012** 2026-09-14 safwat — Execute beyond the first scaffold item and make a working MVP demo now. Why: explicit session request.
- **D-013** 2026-09-14 astra — Wheel uses equal radial sectors, 262/85 outer/inner radii in a 600-unit SVG; resize handles are 7 screen px with a 10 px hit radius. Keep specified 8 px snapping threshold. Why: restrained geometry and usable desktop hit targets.
- **D-014** 2026-09-14 astra — Add guides/grid.ts for shared line/intersection/cell generation; document APIs are createDocument, validateDocument, serialiseDocument and parseDocument. Why: shared deterministic generation without runtime dependencies; explicit document vocabulary.
- **D-015** 2026-09-14 astra — Fixed pack is SPACE BETWEEN, a short fictional architecture exhibition paragraph, and Mauro Lima's staircase photograph from https://unsplash.com/photos/b5YlVPjRH3A embedded as JPEG. Headline 72/700, paragraph 28/400; generic text 56/400. Why: fixed study content with distinct headline/body roles and no supplied layout. Subject is fictional, not an event listing.
- **D-016** 2026-09-14 astra — Text editing opens an inline textarea on add, double-click, or Enter on selection; Escape or Cmd/Ctrl+Enter closes it. Browser-measured height is written back before save/export. Why: text must be editable without adding a properties panel.
- **D-017** 2026-09-14 astra — Image imports are normalised to raster data URLs with a maximum 1600 px longest side. Validation accepts six-digit hex colours and base64 PNG/JPEG/WebP/GIF data URLs emitted by the app. Why: bounded browser storage, predictable rendering, no remote image fetch at export. This is import normalisation, not an image-adjustment UI.
- **D-018** 2026-09-14 astra — Private Sites hosting uses the prescribed vanilla Vite static build; no Sites React scaffold or WebMCP/AI-facing actions are added. Why: Safwat's explicit stack and no-AI scope take precedence over generic hosting skill recommendations.

- **D-019** 2026-09-15 safwat — Add a background remover tool for image nodes, using a neural segmentation model that runs on the end user's machine. Why: explicit session request. This expands Phase 0 scope and carves one exception out of rule 4 (no AI): the model processes pixels of one image and never touches position, size, or content choice. Present identically in both study arms.
- **D-020** 2026-09-15 fable — Implementation: `@imgly/background-removal` 1.7.0 with `onnxruntime-web` 1.21 as peer; model `isnet_fp16` (~80 MB); device `gpu` (WebGPU when available, WASM otherwise); model and runtime files fetched from IMG.LY's static CDN on first use and cached by the browser, so no image leaves the machine. Library loaded lazily and preloaded once when an image node is first selected. Module `src/app/tools/background.ts`; toolbar button enabled only for a selected image. Feedback is the progress cursor, a one-pixel download line inside the button, and a dashed outline plus title on failure. Operation is one-way; delete and re-add restores the pack image. Output is a PNG data URL at the source pixel size; `naturalSize` is refreshed from the result. A Vite plugin drops the unused 24 MB ORT wasm copy from dist. Why: smallest working path with a purpose-built salient-object model; feedback stays within the cursor/flash vocabulary; no document schema change.
- **D-021** 2026-09-15 safwat — The background remover must be releasable publicly, so its dependencies and weights must carry permissive licences. Why: explicit session request after D-020 flagged the AGPL-3.0 library. Supersedes the library choice in D-020; the UI and document behaviour of D-020 stand.
- **D-022** 2026-09-15 fable — Public-release stack: `onnxruntime-web` 1.29 (MIT, native WebGPU EP, single-thread WASM fallback) running the ISNet general-use checkpoint from DIS (Apache-2.0, downloaded from rembg's model release and pinned by SHA-256), preprocessing (x/255 − 0.5), output taken from the sigmoid `output_image` and min-max stretched to alpha, as rembg does. `scripts/prepare-model.mjs` runs before dev and build: it copies ORT's loader module, writes the 26 MB wasm and the weights to `public/` as 16 MB parts with manifests and the licence notice; the client fetches parts in parallel through the Cache API, verifies the digest, hands the wasm to ORT as `wasmBinary` and the loader as a blob URL, and prefers the fp16 variant (91 MB, `scripts/to_fp16.py`, max abs diff 1.6e-4 vs fp32) over fp32 (179 MB). Rejected: BiRefNet_lite (MIT) because its Swin export concatenates 16–64 tensors and exceeds WebGPU storage-buffer limits in ORT 1.22 and 1.29, fp16 BiRefNet on CPU took over ten minutes, and dynamic uint8 quantisation left it at 200 MB; ORT 1.22 because its JSEP WebGPU rejects ISNet's ceil-mode MaxPool. Why: every served file stays under common static-host limits, no third-party request at run time, and the permissive licences hold for weights, runtime and code.
- **D-023** 2026-09-15 fable — The fp16 weights are derived at prepare time by `scripts/onnx-fp16.mjs` (onnx-proto, MIT): the eleven training-time outputs are pruned, weights and compute go to float16 with the interface kept float32, and Resize stays float32 between Cast nodes, mirroring onnxconverter-common with keep_io_types. Output is byte-deterministic and pinned by digest in `prepare-model.mjs`; the ONNX checker passes and the mask differs from fp32 by at most 5e-5. Default served variant is fp16 only. Supersedes the hosting step implied by D-022. Why: a fresh clone must build the fast variant from the pinned Apache-2.0 download alone, without Python or a hand-hosted file.

- **D-024** 2026-09-15 astra — Keep a repeatable production-browser audit in scripts/browser_audit.py. Use a fresh temporary Chromium profile with automatic multiple downloads allowed, without changing the user's browser preferences. Why: paired downloads require browser permission, and the 15-path audit must be reproducible. No application or core contract change was needed.

- **D-025** 2026-09-16 safwat — Extend the editor with a shape library, colour customisation, Mac Command / PC Ctrl shortcuts and object locks plus Shift constraints. Safwat confirmed “all” when asked about locks and keyboard controls. Supersedes D-001's feature freeze for these additions only; both study conditions receive identical controls.
- **D-026** 2026-09-16 astra — Six shapes reuse rect nodes with optional shape; optional locked applies to every node, retaining version-1 compatibility. Locks prevent geometry/property edits, deletion and duplication while allowing selection/unlock. Shift constrains movement axis and shape corner aspect. Command/Ctrl+D duplicates by 20 units; B toggles text weight; Shift+L locks; Shift+E exports. Arrows move 1 unit (Shift: 10) without snapping so repeated key movement remains predictable. Add a compact shortcut reference and exact six-digit hex entry alongside the native colour picker. New shapes retain the neutral 300 × 200 start. Why: fulfil the authorised controls with reusable geometry/export and no dependencies.

- **D-027** 2026-09-16 astra — Integrate remote main before the authorised push. Preserve remote D-019–D-023; renumber the colliding local audit/shapes entries to D-024–D-026 and update their references. Preserve both feature sets; locked images disable removal and discard any in-flight cut-out result. Why: merge the two independently completed branches without dropping history or bypassing object locks.

## Next steps

- [x] Scaffold Vite vanilla-ts, Vitest, strict tsconfig, scripts and folder layout.
- [x] geometry.ts, ratios.ts, document.ts with create/validate/round-trip tests.
- [x] Three guide generators and registry; every anchor pinned by id on square/story/banner, including dropped regions.
- [x] Move snapping: all edges/centre/canvas edges, threshold boundary, independent axes, ties and no-snap.
- [x] Resize snapping: position/span/region sizes, dedupe/ties, lockAspect/dominantAxis and text handles; core 100% line coverage.
- [x] Renderer and store: viewport fit and condition-separated autosave.
- [x] Interaction and overlay: select/move/resize, per-type handles, min-size clamp, anchor drawing and hit feedback.
- [x] Toolbar: text/rect/image, colour, font size/weight/align, delete, export.
- [x] SVG ratio wheel and guide wheel; centre keeps square and still goes through guide choice.
- [x] Offscreen PNG and validated JSON exports, named by id and mode.
- [x] Study mode/session handling and identical fixed content pack.
- [x] Finish the definition-of-done browser audit: all 15 wheel paths, both-condition interactions, image file picker, all ratio PNG dimensions and paired downloads with Chrome permission enabled.
- [x] Shape library, exact colour input, object locks, platform-aware shortcuts and Shift constraints (D-025/D-026).
- [ ] Safwat: approve the fixed content pack and define participants per condition, blinded raters, rating scale and success margin.
- [ ] Run the pilot with those criteria; enable multiple downloads in each study browser and collect both PNG and JSON per participant.

## Open questions for Safwat

- Study protocol: participants per condition, raters, scale and margin for the thesis holding.
- Whether study needs undo. It remains out of scope. Run a pilot of two or three people without it and decide from behaviour.
- Approve the concrete fictional exhibition content pack before recruiting participants; it is identical in both modes.

- The pack staircase photograph has no separable subject, so the remover turns it into a near-transparent ghost. Keep the tool in the study as is, remove it from the study build, or change the pack image to one with a subject? It is identical in both arms either way.

- Should a bad cut-out be recoverable? Restoring the original needs the original data URL stored in the document (schema change) or undo, which remains out of scope.

## Deferred

- Undo and all Phase 1 editor features remain out of scope.
- Browser storage quota failure is caught so editing/export remain usable, but the app does not yet expose failed autosave visibly (no toasts per handbook). Check quota behaviour in the pilot with several large images.

## Browser audit

Run `npm run build`, start `npm run preview -- --port 4173`, then `python3 scripts/browser_audit.py`. Requires Python Playwright, its Chromium browser and Pillow; these are audit tools, not application dependencies. An optional first argument selects another base URL. The script creates a fresh browser profile and writes screenshots and paired exports under ignored `private/browser-audit/`. The 2026-09-15 run passed the complete matrix and both-condition interaction checks. Export sizes verified: square 1080 × 1080, portrait 1080 × 1350, landscape 1920 × 1080, story 1080 × 1920, banner 1500 × 500.

For the pilot, allow automatic multiple downloads for the site before collecting results; the application intentionally exports two separate files per the study contract. The audit explicitly enables that browser permission and verifies both actual download events and saved files.

## PR review — 2026-09-15

Reviewed the sole open PR, #1 (`0e19437254874b61f50960858378621c2ef29bbd`, on-device background remover). GitHub has no review comments, check runs or commit statuses. Main passes 37 tests; the existing PR worktree passes 46 tests with 100% core line coverage and `npm run build`. No application source was changed and no GitHub review, merge or deployment was submitted.

- Confirmed bug: `src/app/tools/background.ts:157` overwrites source alpha with the model mask. A transparent hole in a PNG changed from alpha 0 to 248; 5,145 previously transparent pixels became visible. Multiply source alpha by mask alpha / 255 and cover transparent inputs and repeat removal with regression tests before merging.
- Production Chromium check with WebGPU disabled completed in 10.3 seconds, no page errors, unchanged node rect. Evidence and reproduction script are in ignored `private/pr-review/` (transparent-input.png, transparent-output.png, remover.png, check_remover.py). This checks a synthetic transparent input, not photographic segmentation quality or WebGPU performance.
- The PR records that the fixed staircase pack becomes near-transparent. Resolve the pack/tool study question already raised in its handoff before piloting the remover.
- Integration: PR #1 branches from a96acfa, before main's local c292e66 browser audit. Both branches originally used D-019 for different decisions; reconciled on integration under D-027, retaining the remote decision and renumbering the local audit to D-024.

## PR recheck — 2026-09-15, 12:36 UTC

GitHub reports PR #1 merged at 12:34:20 UTC, unchanged head 0e19437, remote main 0c21093. No open PRs. Read the merged background.ts directly: line 157 is identical to the reviewed implementation, with no alpha-preservation fix. The prior browser reproduction therefore still applies; no repeat browser run was needed. Local main still passes all 37 tests. No application changes, merge or deployment performed in this recheck.

## Transparency fix verified — 2026-09-16

PR #2 is merged into remote main (9874066; fix e9b30e4). applyMask multiplies existing alpha by mask / 255; a regression test covers transparent, opaque and partial-alpha pixels. The matching local PR worktree passes all 47 tests with 100% core line coverage and npm run build. Repeated the original production Chromium reproduction with WebGPU disabled: hole alpha remains 0, zero previously transparent pixels become visible (formerly 5,145), geometry unchanged, no page errors, 10.4 s. Updated evidence is in private/pr-review/. The original alpha finding is resolved. No application edits or deployment performed.

## Editor controls audit — 2026-09-16

Run `npm run build`, start `npm run preview -- --port 4175`, then `python3 scripts/editor_controls_audit.py`. Uses Python Playwright and Pillow with an isolated Chromium profile. MacIntel and Win32 navigator settings exercise the platform branches on the local Chromium runtime; this is not native Windows or Safari testing. The test spaces paired downloads to avoid Chromium's rapid-download limit and captures a frame to complete headless canvas encoding. Evidence is ignored under `private/editor-controls-audit/`. Original regression audit also passes against port 4175. No deployment was requested or performed.

- Cross-origin isolation headers (COOP/COEP) would enable multithreaded WASM inference where WebGPU is unavailable (about 9 s single-threaded today). Everything is same-origin now, so only the host's headers stand in the way.

- A genuinely small CPU variant needs static (calibrated) quantisation; dynamic uint8 quantisation does not touch convolutions. Revisit BiRefNet_lite when ORT's WebGPU EP splits wide Concat nodes.

- Keeping the original image for a toggle back is a document schema change; deferred with undo.

## Repository integration — 2026-09-16

Merged origin/main (9874066) with the local editor work before pushing main, preserving both histories. All 50 tests pass with 100% core line coverage; production build passes using the existing pinned local model checkpoint. The merged controls audit passes MacIntel/Win32 in both conditions. The merged WASM background-removal reproduction passes in 10.3 seconds: locked image button disabled, unlock restores it, source-alpha holes stay transparent, geometry unchanged and no browser errors. Browser evidence is in private/pr-review/ and private/editor-controls-audit/. No live-site deployment performed.
