# HANDOFF

Rolling state for the Kura8 build (Phase 1; the Phase 0 study is frozen at tag `study-v1`). Read in full at session start; rewrite Status and append to the rest at session end. Rules are in AGENTS.md → Handoff protocol.

## Status

Phase 1 build complete. The dev branch is the Kura8 dial editor (M1–M15): the dial turns four rings (ratio, layout, guide, colour) with a live hub preview and opens a pre-arranged, fully editable canvas; the editor has the Paper toolbar and corner controls, multi-select, marquee, move/resize/rotate with snapping v2 (tiers, hold, soft pull, rotated corners, angle snapping, Alt bypass), undo/redo, clipboard, z-order, lock, hide, layers, grid, shortcuts, toasts and the opt-in help bar; colour roles with dark mirror, shade rows, custom hues, contrast hint and armed paint; images in IndexedDB with working copies, drop-to-fill and on-device background removal with Before/After; the 41-shape library and 1,512 Phosphor fill icons with synonym search; autofit and right-to-left text; sketch pen with hold-to-clean, scribble delete, eraser and lasso; change ratio with flags and linked sizes; PNG/JPG/SVG/PDF export. `npm test` passes 198 tests with `src/core` at 100 % line coverage (the fp16 converter tests now run on Node 22 because vitest workers get `--js-float16array`). `npx tsc --noEmit` and `npm run build` pass. `python3 scripts/browser_audit.py` passes all 43 named steps against `vite preview` with no app console errors and no off-origin requests, including all 6 ratios × 6 layouts × 3 guides, every card 5a–5z, exact export sizes (A4 2480 × 3508), transparent No ground PNG, SVG licence metadata, PDF page size, reload with images and v1 migration. Vercel (projects `kura8` and `kura8-lgqp`) deploys previews from pull requests and production from `main`. What does not exist by design: handwriting (D-030), user zoom/pan, groups, free crop, file open/save. The `study-v1` tag is still local only.

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

- **D-028** 2026-10-10 safwat — Freeze the Phase 0 study build at tag `study-v1` (4061227) for the pilot and start Phase 1 on the dev branch. The guide/blank arms and `?mode=`/`?s=` leave the new code and live on at the tag. Why: explicit session answer when the designer's Kura8 dial handoff arrived; the new scope cannot share a build with an unrun study.
- **D-029** 2026-10-10 safwat — Include the dial's Layout ring (cover, split, stack, poster, frame, band), which opens the canvas pre-arranged on the chosen guide. Supersedes decision rule 1 ("no preset arrangement of content"). Why: explicit session answer.
- **D-030** 2026-10-10 safwat — Drop the prototype's handwriting tool for now and keep its spec as a draft document in the repo. Rule 4 (no LLM) stands. Why: explicit session answer; the prototype's recogniser calls an LLM that only exists inside Claude artifacts.
- **D-031** 2026-10-10 safwat — Phase 1 scope is everything working in the Kura8 Prototype plus the refinement cards 5a–5z. Why: explicit session answer. The Paper visual language (Space Grotesk, #ECF0F3 ground, 2px strokes) is assumed from the prototype and is part of the plan awaiting approval.

- **D-032** 2026-10-10 safwat — Approved docs/plans/2026-10-10-phase1-dial.md, milestones M0–M15 including its resolutions of conflicts between the prototype and the refinement cards. The three marked defaults (starting copy, ratio labels, 16:9 export width) stand until Safwat answers the open questions. Why: explicit session approval of the plan.
- **D-033** 2026-10-10 fable — Phase 1 core contracts are the v2 set in AGENTS.md → Core contracts: document v2 with content on nodes and geometry in per-size frames, palette colour refs, injected `Measure`, snapping tiers with hold and soft pull, rotated-corner snapping and `snapAngle`. Supersedes D-006 (no object or grid snapping) and D-011 (neutral default placement), and the Phase 0 contract text. Why: linked sizes, dark mode and custom hues fall out of the data model without sync code; snapping stays deterministic because the previous lock is an input.
- **D-034** 2026-10-10 fable — Resolutions of conflicts inside the designs: Alt bypasses snapping and duplicate-drag is dropped (5j); Shift+Arrow moves one grid cell with the grid on, otherwise 10 units (5l); keep D-026 Mod+Shift+L and Mod+Shift+E; toasts for confirmations and errors, help bar opt-in, no tour (5d); resize keeps size snapping; only the winning snap line draws (5k); thresholds stay in screen px and user zoom stays out; once a document exists the hub relayouts instead of wiping; a swatch with a selection fills it, with nothing selected it arms paint (5e); change ratio converts the active size, add size creates a linked one (5v/5w); a manual font size change turns autofit off (5q). Why: refinement cards are the later design word; browser-reserved shortcuts and logged decisions win over the prototype.
- **D-035** 2026-10-10 fable — Commit the designer's handoff unchanged under docs/design/2026-10-10-dial/ as reference (never served or linked). Retire the study harness from the dev branch: no `?mode`/`?s`, document id generated by `newDocumentId()` and kept out of the URL, autosave key `kura8:doc`, PNG-only export `kura8-<ratio>.png`, page title Kura8 with an empty favicon so headless runs log no 404. Why: later sessions need the design source without the upload; the study lives on at `study-v1`.

- **D-036** 2026-10-10 fable — Snapping v2 keeps Phase 0 callers unchanged: without `extra` lines the canvas edges share tier 0 with the guide lines and hits carry no `tier`; `held` is returned only when `hold` is given. With `extra` the edges are tier 1, so a guide within the threshold beats a nearer canvas edge (5k). A soft pull also returns `near[axis]`, the line it leans towards, for the faint overlay line. At non-quarter rotations a local dimension is matched against the screen axis it lies closest to. Why: the twelve Phase 0 tests stay unchanged (one of them has a guide and a canvas edge both in range) while the app gets the 5k ranking.
- **D-037** 2026-10-10 fable — Interface details: the toolbar sits at the top as in the prototype, so panels open 12 px below the control that owns them; canvas taps keep the colour, shapes and layers panels open; a stage tap outside the canvas deselects. The overlay canvas reaches 64 px past the document so edge handles and the rotate knob (44 px above the top edge) stay grabbable. Handles are 12 px paper squares with 2 px strokes; the winning snap line runs 12 px past the canvas; pull lines draw at f² × 0.4 opacity. The 5d lift staggers blocks by 120 ms, each lifting 2 screen px over 280 ms, once per browser (`kura8:lifted`). Start opens the headline in edit with its text selected, so typing replaces it. The Image tool fills a selected empty frame, otherwise adds one. Toasts last 1.3 s (errors 2–3 s). Why: prototype layout and visual details are agent decisions under AGENTS → Autonomy.
- **D-038** 2026-10-10 fable — Palette: rows are seven steps at lightness 92…10; the base row uses the hue at 40 % saturation, the accent row the complement at 55 %, neutral rows are grey. Roles: ground = base step 0, ink = base step 6, accent = accent step 3 (neutral: step 6, so accent is ink); dark mode mirrors step s to 6 − s. A custom accent from the dial's any-colour picker replaces the accent row with the row built from that hex. Neutral light ground is therefore #EBEBEB rather than the prototype's white. Why: 5i asks for roles that keep their names and mirror on the 7-step scale; one rule for every row.
- **D-039** 2026-10-10 fable — Text and layouts: line height 1.15 for all text; the type-scale body is 28 units (6 % of the canvas height when that is smaller), headline = body × factor², no guide uses factor 1.25. Layouts port `layoutFor` into unit space and step the headline down the scale when headline plus body would pass the bottom margin. `compositionFit` reasons: `narrow` (image column thinner than 1:4), `shallow` (image band flatter than 4:1), `overflow` (text past the bottom); the app words them as "Columns too narrow at 9:16" and so on. A manual size change (corner scaling, Smaller/Larger) turns autofit off; turning autofit on keeps today's box height. Why: one readable line height for headline and body; dimming follows the shape of the slots rather than a word count.
- **D-040** 2026-10-10 fable — Images and export: working copies are at most twice the largest 1× export side of the document's sizes; originals are decoded at their drawn size for raster export; cut-outs are made from the working copy. A4 at 1× is 1240 px wide (150 dpi), 300 dpi comes from the paper size. PDF pages use the paper size for print ratios and 0.75 pt per pixel otherwise. Empty image frames are drawn as slate placeholders in the editor only and are counted in the export notes, like hidden objects (5y). SVG embeds Space Grotesk 400/700 (Latin and Latin Extended) as data URLs. Why: memory and file size stay bounded; exports never contain placeholders.
- **D-041** 2026-10-10 fable — Icon search (`src/core/icons.ts`): synonyms work one step in each direction (a key finds its words and a word finds its key, not its siblings); ranking is exact name, name prefix, name word prefix, tag, synonym, then inside a word, with all-word matches first; matching ignores case, accents, plurals and hyphens; no match shows the nearest category by letter-trigram similarity. An icon counts as flattened (toast note, 5t) when its source has several paths or opacity. The index drops tag words reachable another way to stay under 90 KB; path chunks are per first letter. Why: "coffee", "café" and "mug" all find coffee without "coffee" returning cocktails.
- **D-042** 2026-10-10 fable — Sketch: recognition runs only after holding still for 420 ms at the end of a stroke, as in the prototype; a wave becomes a body-size text node "Text"; an arrowhead drawn at a line's end merges into it as an arrow; the first diagonal across a rectangle stroke is remembered in memory only, and the second diagonal turns both into an empty image frame. Why: no new document fields for transient sketch state.
- **D-043** 2026-10-10 fable — Retire the Phase 0 editor controls audit from the dev branch (it lives at `study-v1`) and rewrite `scripts/browser_audit.py` for Phase 1. Supersedes D-024's audit scope for the dev branch. Why: the old audits drive the study arms, which no longer exist here.
- **D-044** 2026-10-10 safwat — "Execute plan and merge and deploy": build M1–M15 in one session, merge to `main` and deploy. Deployment is the existing Vercel Git integration, which builds `main` for production. Why: explicit session request.
- **D-045** 2026-10-10 safwat — "Run these debugs and loop: imagine different people using this for different cases; whenever you find a bug, log it, patch it, keep going." Persona sweep after the Phase 1 merge; findings are logged in `docs/qa/2026-10-10-persona-sweep.md` and the harness is `scripts/persona_sweep.py`. Why: explicit session request.
- **D-046** 2026-10-10 fable — Gestures: Escape during a move, resize or rotate restores the document; during a marquee it restores the selection from before the marquee; during a pen stroke it drops the stroke and the eraser gives back what it took. Shift on an already-selected object drops it from the selection on release, and only when the pointer did not move, so Shift-drag constrains the selection instead. Two finger or pen taps on one object within 400 ms count as a double-click. Why: persona sweep B2, B5, B13.
- **D-047** 2026-10-10 fable — Text baseline: canvas and SVG set every line on the alphabetic baseline `BASELINE` em below the line's middle (the middle of Space Grotesk's em square, ascent 0.98, descent 0.29), carried in the text scene op as `baseline`; the HTML text editor is lifted by the CSS difference. Supersedes SVG `dominant-baseline="central"`. Why: the SVG sat 7 % of the size lower than the PNG and text jumped on edit (B10, B11).
- **D-048** 2026-10-10 fable — Two tabs: a tab follows the other tab's save (the `storage` event): it takes that document, drops its undo history and any pending save, and says "Updated from another tab". Why: a stale tab silently saved over newer work (B12).
- **D-049** 2026-10-10 fable — Small editing rules from the sweep: new text boxes record history only when finished with text; text heights are re-measured in every size after text edits; several dropped images take distinct nearest cells; background removal switches only the image it ran on (the cut-out stays stored per asset); async results whose image was deleted or locked meanwhile record nothing; closing a panel that holds focus, or a mouse click on a toolbar, corner or dial button, gives the keyboard back to the canvas or dial; faded controls keep their tooltips; re-ratio flags draw only while still true. Why: persona sweep B1, B3, B4, B6–B9, B14, B15.

## Next steps

Phase 1, in plan order (details per milestone in docs/plans/2026-10-10-phase1-dial.md):

- [x] M0 Freeze and re-charter: tag `study-v1`, design sources, handwriting draft, study harness removed, AGENTS.md for Phase 1, decisions D-028–D-035.
- [x] M1 Document v2: types, validation, `migrate` with v1 fixtures, rotation geometry, ratios with A4 and labels, `exportSize`, `MAX_PIXELS`.
- [x] M2 Palette, shapes, scene and renderer v2 (rotation, colour refs, ground, empty frames, ink, library shapes); Paper CSS and Space Grotesk.
- [x] M3 Snapping v2 and `snapAngle`, one named test per rule, Phase 0 snap tests unchanged.
- [x] M4 History, ops, store and interaction v2: multi-select, marquee, rotate, Alt bypass, nudge, clipboard, z-order, lock, hide, undo/redo, keyboard map.
- [x] M5 Paper chrome: toolbar, toasts, opt-in help bar, shortcuts, layers, grid, guides toggle.
- [x] M6 Layout engine: compositions, fit, typeScale, compositionFit.
- [x] M7 Dial: four rings, hub, readout, light/dark, any colour, Start/Go; 5a–5d and the 5f round trip.
- [x] M8 Colour panel, armed paint, custom hue, contrast hint, dark hold preview (5e, 5g–5i).
- [x] M9 Images: assets, drop/paste, working copy and original, focus crop, drop-on-frame, remover Before/After (5n–5p).
- [x] M10 Shape library and Phosphor icons: prepare-icons, search with synonyms, flatten note, licences (5s–5u).
- [x] M11 Text: rotated frames, start/end and RTL, script fonts, autofit with crossing mark (5q, 5r).
- [x] M12 Sketch: ink port, pen hold-to-clean, scribble delete, eraser, lasso.
- [x] M13 Re-ratio flags and linked sizes (5v, 5w).
- [x] M14 Export sheet: PNG/JPG/SVG/PDF, scale and dpi, hidden count, No ground (5x–5z, 5u).
- [x] M15 Performance, memory, Phase 1 browser audit, Definition of done.

Follow-ups, each session-sized:

- [ ] Safwat answers the open questions below; apply the answers (copy, labels, export widths).
- [ ] Push the `study-v1` tag once Safwat agrees.
- [ ] Test on Safari and Firefox (the audit covers Chromium only): IndexedDB in private mode, `OffscreenCanvas.convertToBlob`, canvas `direction`, `roundRect`.
- [ ] A focus-point control for image crops (the document already stores `focus`).
- [ ] Run `scripts/persona_sweep.py` next to the audit before each merge; add a persona for each new feature.

### Study (frozen at `study-v1`)

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

- Starting copy for layouts: default is "Headline" and "Body text" placeholders with empty image frames. Keep, or use real sample copy?
- Destination labels for the six ratios (5a only names four): default is Post 1:1, Portrait 4:5, Slide 16:9, Story 9:16, Print A4, Banner 3:1.
- 5x says social ratios export 1080 wide; default keeps 16:9 at 1920 and banner at 1500, with A4 at 300 dpi (2480 × 3508).
- Pushing the `study-v1` tag to GitHub needs your OK.
- A4 at 1× exports 1240 px wide (150 dpi) with 300 dpi as its default; keep that ladder?

- Study (applies to `study-v1`): participants per condition, raters, scale and margin for the thesis holding.
- Whether study needs undo. It remains out of scope. Run a pilot of two or three people without it and decide from behaviour.
- Approve the concrete fictional exhibition content pack before recruiting participants; it is identical in both modes.

- The pack staircase photograph has no separable subject, so the remover turns it into a near-transparent ghost. Keep the tool in the study as is, remove it from the study build, or change the pack image to one with a subject? It is identical in both arms either way.

- Study build only: should a bad cut-out be recoverable there? (Phase 1 keeps the original and shows Before/After, 5o.)
- Neutral ground: the 7-step scale makes the neutral light ground #EBEBEB instead of the prototype's white (D-038). Keep, or special-case white?

## Deferred

- User zoom and pan, groups, free crop, file open/save, accounts, collaboration, telemetry, vector PDF, image adjustments, booleans and path editing stay out of Phase 1 (AGENTS → Phase 1 scope).
- Cross-origin isolation headers would allow multithreaded WASM inference for background removal where WebGPU is unavailable.
- A smaller CPU model for background removal needs static quantisation; revisit BiRefNet_lite when ORT's WebGPU EP splits wide Concat nodes.
- Autosave failures now show a toast; quota behaviour with many large images is untested beyond the audit.
- Background removal on the WASM path runs on the main thread, so for several seconds the scan line, input and autosave wait; running ORT in a worker (`env.wasm.proxy`) needs the runtime loader rework.
- Handles more than 64 px outside the canvas are out of reach (the overlay margin); the object can still be dragged or nudged back.
- Pasting plain text from the system clipboard does nothing; the prototype's paste is Kura8's own clipboard only.

## Browser audit

Run `npm run build`, start `npm run preview -- --port 4173`, then `python3 scripts/browser_audit.py` (optional base URL argument; `ONLY=<step function name>` runs one step; `CHROMIUM=/path` picks the browser, otherwise `/opt/pw-browsers/chromium-*` or Playwright's own). Requires Python Playwright and Pillow, which are audit tools, not app dependencies. Each run uses a fresh browser context, writes screenshots of failures, downloads and `report.json` under ignored `private/browser-audit/`, and exits non-zero on any failed step, app console error or off-origin request. The 2026-10-10 run passed 43/43 steps in about seven minutes, including a real background removal (WASM, no WebGPU in headless Chromium).

The sections below record Phase 0 work; their audits run from a checkout of `study-v1`.

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
