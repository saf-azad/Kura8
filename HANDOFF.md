# HANDOFF

Rolling state for the Ratio Phase 0 build. Read in full at session start; rewrite Status and append to the rest at session end. Rules are in AGENTS.md → Handoff protocol.

## Status

Phase 0 build complete; ready for study. All 37 tests pass with 100% core line coverage and the production build succeeds. The Chromium audit against vite preview passes all 15 ratio/guide wheel paths, square centre entry, paired PNG/JSON downloads, all five export dimensions, overlay-free PNGs and exported JSON reload through document validation. Both conditions pass rectangle move/resize/delete, text editing/wrapping/movement, locked-aspect image resizing, real file-picker upload with raster normalisation, autosave recovery and identical content-pack checks, with no browser console errors. Screenshots confirm visible snapping feedback and blank mode without guides. Chrome must allow automatic multiple downloads to receive both export files. The existing private demo remains at https://ratio-phase-zero.alazadsafwat.chatgpt.site; application source is unchanged in this audit session. Remaining main-branch work is Safwat's study protocol, content approval and pilot. PR #1 was merged on GitHub as 0c21093 on 2026-09-15 at 12:34 UTC. The merged background.ts:157 still overwrites source alpha, so the previously reproduced transparency corruption remains unfixed. This local main retains the separate browser audit and review commits; its handoff and D-019 entry still need reconciliation with remote main when integrating.

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

- **D-019** 2026-09-15 astra — Keep a repeatable production-browser audit in scripts/browser_audit.py. Use a fresh temporary Chromium profile with automatic multiple downloads allowed, without changing the user's browser preferences. Why: paired downloads require browser permission, and the 15-path audit must be reproducible. No application or core contract change was needed.

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
- [ ] Safwat: approve the fixed content pack and define participants per condition, blinded raters, rating scale and success margin.
- [ ] Run the pilot with those criteria; enable multiple downloads in each study browser and collect both PNG and JSON per participant.

## Open questions for Safwat

- Study protocol: participants per condition, raters, scale and margin for the thesis holding.
- Whether study needs undo. It remains out of scope. Run a pilot of two or three people without it and decide from behaviour.
- Approve the concrete fictional exhibition content pack before recruiting participants; it is identical in both modes.

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
- Integration: PR #1 branches from a96acfa, before main's local c292e66 browser audit. Both branches use D-019 for different decisions; preserve both entries under unique IDs and update references when integrating.

## PR recheck — 2026-09-15, 12:36 UTC

GitHub reports PR #1 merged at 12:34:20 UTC, unchanged head 0e19437, remote main 0c21093. No open PRs. Read the merged background.ts directly: line 157 is identical to the reviewed implementation, with no alpha-preservation fix. The prior browser reproduction therefore still applies; no repeat browser run was needed. Local main still passes all 37 tests. No application changes, merge or deployment performed in this recheck.
