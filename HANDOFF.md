# HANDOFF

Rolling state for the Ratio Phase 0 build. Read in full at session start; rewrite Status and append to the rest at session end. Rules are in AGENTS.md → Handoff protocol.

## Status

Phase 0 build complete; ready for study. Strict TypeScript/Vite, pure core at 100% line coverage (42 tests), three guide generators, move/size snapping, both SVG wheels, Canvas2DRenderer with a separate overlay, text/shape/image nodes, bundled seven-typeface font library (default Space Grotesk) and six-shape shape library, identical content pack, localStorage recovery and paired export. The definition-of-done browser audit ran against the production build in headless Chromium with 34 checks and 0 failures: all 15 ratio × guide wheel paths plus the centre path open the right document with the right canvas aspect; every ratio exports a PNG at its fixed width (1080 × 1080, 1080 × 1350, 1920 × 1080, 1080 × 1920, 1500 × 500) with white pixels on the guide-line positions and a JSON twin named `<id>-<mode>`; in guide mode a rectangle's left edge snaps to line-x-1 and its width to a third with y untouched; delete, pack insertion, locked-aspect image resize and the image file picker work; blank mode shows no wheel, no overlay, square, guide null, identical pack buttons, raw unsnapped movement, and survives reload; zero console errors. Every exported JSON parses and round-trips through `parseDocument`/`serialiseDocument`. `npm test` and `npm run build` pass. The private Sites demo at https://ratio-phase-zero.alazadsafwat.chatgpt.site predates the font and shape libraries and must be redeployed from the current build before participants use it.

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
- **D-019** 2026-09-14 safwat — Load a font library and a shape library into Phase 0. Why: explicit session request; supersedes the D-001/AGENTS restriction to one system sans and rectangles only.
- **D-020** 2026-09-14 fable — Fonts are Safwat's seven personal typefaces (Space Grotesk, Acthirey, Bandito, Bitsand, Hugos, Kylora, Malam Poek) bundled under `public/fonts/` with their licence files, declared via `@font-face`, registered in pure `src/core/fonts.ts`. Default for all new text, including the content pack, is Space Grotesk. Why: Space Grotesk is OFL, body-capable and the only family with a real weight range besides Bandito; a fixed default keeps both study arms identical. Five bundled files are personal-use demo versions; the renderer synthesises bold for single-weight families.
- **D-021** 2026-09-14 fable — Shapes extend the existing `rect` node with a `shape` field rather than adding a node type: rectangle, ellipse, triangle, diamond, hexagon, star. Every shape fills its rect exactly (pure `shapeOutline` in `src/core/shapes.ts`), so handles, hit testing and snapping stay bounding-box based and unchanged. Why: smallest contract change; no snapping semantics touched, which protects the study attribution.
- **D-022** 2026-09-14 fable — `font` and `shape` are required fields; no migration of pre-existing autosaves. Why: no participant data existed and a lenient validator would weaken the JSON export contract.
- **D-023** 2026-09-14 safwat — Proposed a future "human interaction token": count/log substantial user edits per document as a provenance signal of real human design effort, distinct from trivial pointer noise or untouched default placement. Why deferred: not scoped, and telemetry beyond study export is explicitly excluded from Phase 0 (Mission; Phase 0 scope). Idea only, no implementation; captured so it isn't lost before Phase 1 planning.

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
- [x] Font library (seven bundled families, typeface select) and shape library (six shapes, shape panel) with core tests.
- [ ] Redeploy the Sites demo from the current build so the hosted version carries fonts and shapes.
- [x] Definition-of-done browser audit: 15 wheel paths, centre path, snapping, blank-condition interaction, image file picker, per-ratio PNG dimensions and overlay-free pixels, guide-mode and blank-mode paired download, JSON round-trip.
- [ ] Safwat: define participant count, blinded raters, scale and success margin; run the pilot.

## Open questions for Safwat

- Study protocol: participants per condition, raters, scale and margin for the thesis holding.
- Whether D-010 (centre still chooses a guide) is acceptable. Square default is now explicit in the supplied handbook.
- Whether study needs undo. It remains out of scope. Run a pilot of two or three people without it and decide from behaviour.
- Approve the concrete fictional exhibition content pack before recruiting participants; it is identical in both modes.
- Font licences: Acthirey, Bandito, Bitsand, Hugos and Kylora are demo files licensed for personal, non-commercial use. Fine for the study prototype; anything commercial needs paid licences or a cut to Space Grotesk and Malam Poek.
- Whether the typeface and shape choice should be available in both study arms (currently yes, identical) or held back so layout stays the only variable.
- Human interaction token (D-023): define what counts as a "substantial edit" and whether the count needs tamper-evidence to mean anything as an authenticity signal, before Phase 1 scoping starts.

## Deferred

- Per-shape stroke/outline styles, corner radius and line shapes stay out; the shape library is fills only.
- Font weight stays the 400/700 toggle; the variable axes of Space Grotesk and Bandito are not exposed.

- Undo and all Phase 1 editor features remain out of scope.
- Study-readiness label is withheld until the full browser audit and paired-download permission check pass.
- Browser storage quota failure is caught so editing/export remain usable, but the app does not yet expose failed autosave visibly (no toasts per handbook). Check quota behaviour in the pilot with several large images.
- Human interaction token (D-023): per-document count or log of substantial edits (moves/resizes past a threshold, content/style changes — not selection, hover, or untouched pack placement) as a graphic-design-authenticity signal. No data model, threshold, storage, or display surface defined yet.
