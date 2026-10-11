# Kura8 — Phase 1 agent handbook

Shared instructions for every coding agent working on this repo (Claude Fable, GPT-6 Astra, or a person). Codex reads `AGENTS.md`; Claude Code reads it through `CLAUDE.md`. This file is the source of truth for project rules; `HANDOFF.md` is the source of truth for current state; `docs/plans/2026-10-10-phase1-dial.md` is the approved Phase 1 plan and `docs/design/2026-10-10-dial/` holds the design it implements.

## Where to look

Read this whole file once per session, then `HANDOFF.md` in full, then run `npm test`. Take the first unchecked next step unless Safwat's session message says otherwise. Consult Core contracts before touching `src/core/`, the plan for milestone detail, and the design files (open the `.dc.html` sources or read their scripts) for exact behaviour, geometry and copy. Consult Handoff protocol before stopping. Do not re-open logged decisions.

**Contract status.** The contracts below are implemented (M1–M15, see HANDOFF). Change them in the order type → tests → code → HANDOFF.

## Mission

Kura8 is a visual editor built on proportion, not templates. Four turns of a dial (ratio, layout, guide, colour) produce a canvas whose structure comes entirely from geometry: guide lines, proportional cells, a guide-derived type scale and a hue-derived palette. Every block it places is an ordinary object the person can move, resize, recolour, replace or delete. Two people starting from the same dial setting must be able to finish with completely different designs.

Phase 0's study build is frozen at tag `study-v1` (D-028). Phase 1 builds the Kura8 Prototype plus refinement cards 5a–5z (D-031).

## Decision rules

Resolve scope, design and feature questions in this order:

1. **Structure from geometry, content stays open.** Layouts (D-029) place slots on guide lines and cells; they never choose content, and every placed block stays fully editable. No template library, no stored designs, no generated content.
2. **The guide system is the product.** Guides, layouts, type scale, snapping and re-ratio are anchor geometry. Engineering concentrates in `src/core/`.
3. **No AI.** No machine learning, LLM, generation or suggestion anywhere, with one exception by Safwat's decision (D-019): the on-device background remover, which processes the pixels of one image and never touches position, size or content choice. Deterministic geometry (snapping, sketch clean-up, layout maths) is allowed. Handwriting recognition is not built (D-030, `docs/drafts/handwriting.md`).
4. **Nothing leaves the machine.** No request leaves the deployment at run time. Fonts, icons, model weights and runtimes are served from the app's own origin. Every dependency, font, icon set and weight file carries a permissive licence (D-021).
5. **The interface stays out of the way.** Paper visual language (see Interface). Feedback is cursor changes, snap lines, flashes and short toasts for confirmations and errors. The help bar is opt-in and off by default. No onboarding tour, no empty-state suggestions; the only first-open motion is the 5d lift.
6. **Phase 1 only.** If it is absent from Phase 1 scope, do not build it. Record temptations under Deferred in `HANDOFF.md`.

## Phase 1 scope

Everything working in `Kura8 Prototype.dc.html` and the refinement cards 5a–5z in `Kura8 Editor.dc.html`, except handwriting:

- **Dial:** four rotating rings (ratio 10, layout 6, guide 3, colour 12 hues + neutral) turned by drag, scroll, arrows or Enter; lens focus; live hub preview; readout panel; light/dark ground; any-colour accent picker; Start/Go. Refinements 5a–5c, 5f; first-open lift 5d.
- **Ratios:** square, portrait, tall 3:4, story, pin 2:3, A4, landscape, link 1.91:1, banner, cover 4:1 shown as Header (D-069, D-080), each with a destination label (5a). Ratio change and linked sizes (5v, 5w).
- **Layouts:** cover, split, stack, poster, frame, band, as pure functions of ratio and guide.
- **Guides:** thirds, golden, quarters (id `divisions`), with type-scale factors 1.5, φ, √2.
- **Colour:** ground/ink/accent roles from hue, 7-step shade rows, custom 14th hue (5g), contrast check with nearest passing shade (5h), dark mirror (5i), armed paint (5e), SV picker and hex.
- **Objects:** text, library shapes (41), Phosphor icons (5s–5u), images with working copy and kept original (5n), empty image frames and drop-to-fill (5p), non-destructive background removal with Before/After (5o), ink from sketch tools.
- **Editing:** select, multi-select, marquee, select all; move, resize, rotate; snapping v2 with Alt bypass (5j, 5k, 5m); angle snapping; Shift constraints; nudge (5l); copy, cut, paste, duplicate; z-order; lock; hide; delete; undo/redo; text editing with autofit (5q) and scripts/RTL (5r).
- **Panels:** toolbar, shapes and icons, colour, layers, grid, guides toggle, change ratio, shortcuts, export, opt-in help bar, toasts.
- **Sketch:** pen with hold-to-clean, scribble-to-delete, eraser, lasso.
- **Export:** PNG, JPG, SVG, PDF; scale or 300 dpi (5x); hidden count (5y); No ground (5z); icon licences in SVG metadata (5u).
- **Persistence:** autosave of the one current document to `localStorage`, image assets to IndexedDB.

Added by D-045 (Safwat's student-test loop, 2026-10-10): typefaces (seven OFL faces), opacity, picture reposition and Fit, text flow under growing text, pasted text, align and distribute, typed size and angle, per-paragraph direction, layer names, SVG import, All sizes .zip export, cross-tab safety and a persisted undo of New. See HANDOFF D-045–D-067.

Out of scope: handwriting recognition, user zoom/pan, groups, free crop, per-size z-order, file open/save or a file manager, accounts, collaboration, telemetry, vector PDF, image adjustments beyond background removal, booleans, pen/path editing beyond ink strokes, mobile layout.

## Stack

D-002 governs the stack. Supersede it explicitly before changing it.

- Strict TypeScript, Vite, Vitest, npm. No UI framework: vanilla DOM/SVG chrome, HTML canvas 2D document.
- `src/core/` has zero DOM access and zero runtime dependencies. Every function depends only on its inputs and is fully unit tested.
- The app layer's only runtime dependency is `onnxruntime-web` (MIT), imported lazily by `src/app/tools/background.ts` alone (D-022). Model weights (ISNet, Apache-2.0; float16 derived in Node from the pinned checkpoint, D-023) and the ORT wasm are written to `public/` as 16 MB parts by `scripts/prepare-model.mjs`.
- Space Grotesk (`@fontsource/space-grotesk`, OFL-1.1) is a devDependency bundled by Vite, as are the document faces Poppins, Playfair Display, Lora, Bebas Neue, Caveat and Space Mono (`@fontsource/*`, OFL-1.1, D-049). Phosphor fill icons (`@phosphor-icons/core`, MIT) are a devDependency baked into gitignored `public/icons/` by `scripts/prepare-icons.mjs`. Both prepare scripts run before `npm run dev` and `npm run build`.
- Renderer behind the `Renderer` interface for a later CanvasKit/Skia swap. No CanvasKit in Phase 1.

## Repository layout (target)

```text
AGENTS.md  CLAUDE.md  HANDOFF.md
docs/
  plans/2026-10-10-phase1-dial.md
  design/2026-10-10-dial/      designer's sources, reference only
  drafts/handwriting.md
src/
  core/
    geometry.ts  document.ts  ratios.ts  palette.ts  snap.ts
    guides/{types,grid,thirds,golden,divisions,index}.ts
    compositions.ts  fit.ts  relayout.ts  reratio.ts  sizes.ts  flow.ts
    scene.ts  ops.ts  history.ts  ink.ts  images.ts  script.ts  fonts.ts
    shapes.ts  icons.ts  dial.ts  export.ts  arrange.ts  zip.ts
  app/
    store.ts  assets.ts  editor.ts  measure.ts  ui.ts  paper-icons.ts
    dial/
    canvas/{renderer,overlay,interaction,resize,tween}.ts
    tools/{toolbar,background,shortcuts}.ts
    tools/panels/{shapes,icons,colour,fonts,arrange,layers,grid,ratio,keys,export}.ts
    sketch/
    export/
  main.ts
  style.css
scripts/
  prepare-model.mjs  onnx-fp16.mjs  prepare-icons.mjs
  browser_audit.py   Phase 1 audit (M15); the Phase 0 audits live at study-v1
  usertest/          student-session harness and primer for user-test loops (D-045)
public/                generated, gitignored: ort/ models/ icons/
tests/                 mirrors core, plus useful app tests
```

## Core contracts

These are the shared interface; do not rename casually. For a contract change, change the type, then tests, then code, then record the change in `HANDOFF.md`.

### Unit space and measuring

Canvas width is always 1000 units; height is `1000 * ratio.h / ratio.w`. Pixels exist only at export and on screen. One fit-to-viewport scale, no user zoom. Avoid DOM-global names `Document` and `Node`.

```ts
export type Point = { x: number; y: number };
export type Size = { w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Measure = (text: string, size: number, weight: 400 | 700, width: number, font?: FontId) => string[];
```

Core never measures text itself. Functions that need line breaks take an injected `Measure` (with the node's face, absent = Space Grotesk); the app passes a cached canvas measurer, tests pass a fixed-width fake.

### Ratios

`square` 1:1 (Post), `portrait` 4:5 (Portrait), `tall` 3:4 (Grid), `story` 9:16 (Story), `pin` 2:3 (Pin), `a4` 1:√2 with √2 computed (Print), `landscape` 16:9 (Slide), `link` 1.91:1 (Link), `banner` 3:1 (Banner), `cover` 4:1 (Header, D-080), in that dial-ring order (D-069). Labels are defaults pending Safwat. A new linked size is seeded from the existing size with the closest proportions (`closestSize`). `exportSize(ratio, { scale: 1|2|3 } | { dpi: 300 })`: social ratios export 1080 wide except pin 1000 (1000 × 1500), landscape 1920, link 1200 (1200 × 628), banner 1500 and cover 1584 (1584 × 396); A4 at 1× is 1240 wide (150 dpi) and at 300 dpi 2480 × 3508 from its paper size (`mm`); dpi on a ratio without a paper size throws; a scaled height is the rounded 1× height times the scale (D-082). `MAX_PIXELS = 16_777_216`; larger export options are disabled, and an All sizes zip steps such a size down to the largest that fits (`zipScale`, D-080). Export file names use the ratio's label.

### Document v2

```ts
export type RatioId = 'square' | 'portrait' | 'tall' | 'story' | 'pin' | 'a4' | 'landscape' | 'link' | 'banner' | 'cover';
export type CompId = 'cover' | 'split' | 'stack' | 'poster' | 'frame' | 'band';
export type Role = 'ground' | 'ink' | 'accent';
export type RowId = 'base' | 'accent' | `c${number}`;
export type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6;                       // lightness 92, 78, 64, 50, 36, 22, 10
export type ColourRef = { role: Role } | { row: RowId; step: Step } | { hex: string };
export type Palette = { hue: number | null; dark: boolean; custom: string[]; accent?: string };
export type Frame = { rect: Rect; rot: number; fontSize?: number; hidden?: boolean };
export type Slot = 'image' | 'accent' | 'headline' | 'body';
type Base = { id: string; locked?: boolean; slot?: Slot; opacity?: number; name?: string; frames: Record<string, Frame> };
export type FontId = 'grotesk' | 'poppins' | 'playfair' | 'lora' | 'bebas' | 'caveat' | 'mono';
export type TextNode = Base & { kind: 'text'; text: string; weight: 400 | 700; align: 'start' | 'center' | 'end'; fill: ColourRef; fit?: boolean; font?: FontId };
export type ShapeNode = Base & { kind: 'shape'; shape: string; fill: ColourRef; icon?: { set: string; name: string; d: string; licence: string } };
export type ImageNode = Base & { kind: 'image'; asset: string | null; cutout?: boolean; focus?: Point; mask?: 'circle' };
export type InkNode = Base & { kind: 'ink'; paths: [number, number][][]; stroke: number; fill: ColourRef; form?: 'line' | 'arrow' | 'rect' | 'ellipse' | 'tri' };
export type DocNode = TextNode | ShapeNode | ImageNode | InkNode;
export type SizeSpec = { id: string; ratio: RatioId; guide: GuideId | null; comp: CompId | null };
export type KuraDoc = { version: 2; id: string; createdAt: string; palette: Palette; ground: ColourRef | null; sizes: SizeSpec[]; nodes: DocNode[] };
```

- Content (text, fill, weight, align, font, shape, icon, asset, cutout, focus, mask, paths, stroke, lock, opacity, name) lives on the node. Geometry (rect, rotation, font size, hidden) lives in `frames[sizeId]`. Linked sizes (5w) follow from this: content edits show in every size, geometry stays local. Adding or deleting a node affects every size; `hidden` leaves a node out of one size. Array order is the one shared draw order.
- Colours resolve through the palette. Dark mode maps row step `s` to `6 − s`; `{ hex }` never mirrors. A custom hue (5g) adds row `c{n}` at the seven lightness steps, with the step nearest the pasted hex replaced by it exactly.
- `ground: null` means unfilled: the editor draws the palette ground. PNG export offers No ground for any ground (5z, D-050).
- `opacity` is 0–1, absent means opaque (D-052). `name` is a Layers name, trimmed, at most 80 characters (D-066). `font` absent means Space Grotesk; a single-weight face draws its one weight (D-049).
- `mask: 'circle'` shows a picture in the ellipse its frame bounds (D-081); absent means the full frame.
- `asset: null` is an empty image frame. Assets are IndexedDB keys (SHA-256 of the bytes) holding original, working copy and optional cutout; `cutout` chooses which one shows (5o). The cover crop is derived from the frame and `focus` (default centre), never stored.
- Never stored: effective font size, overflow and off-canvas flags, crop rects, physical alignment, text direction, guide anchors.
- Icons are shape nodes with `shape: 'icon'` and the path inline in `icon.d` (100 × 100 box); every other `shape` is a key of the 41-shape library in `shapes.ts`.
- Text geometry: `frame.fontSize` is the set size; `textBox` derives lines, effective size and drawn height with line height 1.15. For `fit` text `rect.h` is the box the size steps down to fit; otherwise the drawn height is the measured height.
- `createdAt` is ISO. Text frame width is wrap width; height is derived from `Measure`. Absent `locked`/`hidden` means false. Locks prevent geometry/property edits, deletion and duplication; locked nodes stay selectable.
- `migrate(x)` turns a version-1 document into version 2 with one size, `comp: null`, a neutral palette and `ground: null`; hex colours become `{ hex }`, `left`/`right` become `start`/`end`, shapes are renamed (rectangle→rect, ellipse→circle, triangle→tri, star→star5, arrow→arrowR) and each image `src` becomes asset `v1-<nodeId>` returned for the app to store.

### Guides

Unchanged from Phase 0.

```ts
export type GuideId = 'thirds' | 'golden' | 'divisions';
export type Anchor =
  | { kind: 'line'; id: string; axis: 'x' | 'y'; at: number }
  | { kind: 'point'; id: string; x: number; y: number }
  | { kind: 'region'; id: string; rect: Rect };
export type Guide = { id: GuideId; name: string; generate(canvas: Size): Anchor[] };
```

Generators are pure and deterministic and include no canvas-edge lines. `name` is the guide's only display copy: Thirds, Golden, Quarters. φ = `(1 + Math.sqrt(5)) / 2`, computed. Thirds: lines at 1/3, 2/3, four points, nine cells. Golden: lines at 1−1/φ and 1/φ, four points, nine cells plus four golden rectangles clipped to the canvas, dropping any equal to the whole canvas. Divisions: lines at 1/4, 1/2, 3/4, nine points, four quadrants, centre bands. IDs: `line-x-n`, `line-y-n` (ascending), `point-x1-y2`, `region-cell-r-c`, `region-golden-top|bottom|left|right`, `region-quad-tl|tr|bl|br`, `region-band-v|h`. Canvas edges are added by snapping as `edge-left|right|top|bottom`.

### Layouts

`typeScale(guide, canvas)` uses factor 1.5 (thirds), φ (golden) or √2 (divisions) from a body base. `layout({ canvas, guide, comp, measure, headline, body })` returns slot rects for image, accent, headline and body, ported from the prototype's `layoutFor` into unit space (it uses the first and last guide fractions). Poster and stack give the headline an autofit room (`TextSlot.fit`, the box above the band, D-055); autofit never splits a word. `starterNodes` turns a layout into slot-tagged nodes: headline and body text with placeholder copy, accent shape, empty image frame; given a palette, text on the accent block takes the readable role (`textRoleOn`, D-056). `compositionFit` returns `{ ok: true }` or `{ ok: false, reason }` with a reason code the app words (5c). `relayout` moves slot-tagged nodes into a new layout's slots and re-ratios the rest (5f); a slot without a node stays empty; a headline moved into an autofit room autofits. `flowText` moves text stacked under a text block whose drawn height changed, in every size (D-046); an autofit room is space its block holds, a rising block that also sits under another block stays (D-077), and text flows only among blocks on the same backing, picture, shape or ground (D-082). `hugText` keeps a free label on one line as it is resized or retyped, judged when the edit starts; layout text keeps its slot and margin (D-070, D-077, D-081, D-082); a free label keeps its inset and the block that holds it, judged as the edit began (D-083–D-085). `unfit` turns autofit off for a hand-set size (5q) while every other linked size keeps the size autofit gave it (D-085); `keepInRoom` steps retyped layout text down in the other sizes so it still fits above the block below it (D-088). `keepReadable` re-picks the readable colour for automatic text on a solid shape that holds it, or on bare ground, after a palette change, a ground fill or a move (D-079, D-087). `reRatioKept` maps untouched nodes from their origin frames so ratio round trips do not drift (D-054). `reRatio` keeps edges that sit on a guide, edge or centre line on the same line id in the new geometry, scales other nodes about their centre, and flags anything off-canvas or overflowing instead of cropping (5v); text is off-canvas only when its letters are (`letterBounds`), and icons keep their proportions (D-077, D-078). In a new ratio a one-line free label stays on one line, shrinking type stops at three fifths of the new body size, and text under text that grew moves clear (D-087).

### Snapping

```ts
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type Tier = 0 | 1 | 2 | 3;   // guide lines, canvas edges + centre, other objects, grid
export type SnapLine = { id: string; axis: 'x' | 'y'; at: number; tier: Tier };
export type SnapInput = {
  rect: Rect; handle: Handle; anchors: Anchor[]; canvas: Size; threshold: number;
  lockAspect?: boolean; dominantAxis?: 'x' | 'y';
  rotation?: number; extra?: SnapLine[]; reach?: number; hold?: number; held?: { x?: string; y?: string };
};
export type SnapHit = { axis: 'x' | 'y'; what: 'edge' | 'center' | 'corner' | 'size'; targetId: string; tier?: Tier };
export type SnapResult = { rect: Rect; hits: SnapHit[]; held?: { x?: string; y?: string }; pull?: { x?: number; y?: number } };
export function snap(input: SnapInput): SnapResult;
export function snapLines(o: { canvas: Size; others: { id: string; rect: Rect; rot: number }[]; grid?: number; centre: boolean }): SnapLine[];
export function snapAngle(o: { angle: number; canvas: Size; regions: Rect[]; shift: boolean; lock: number; reach: number; hold: number; held: number | null }): { angle: number; caught: number | null };
```

- Same input, same output: no time or randomness, the previous lock is an explicit `held` input. Core never clamps; the app clamps raw geometry to 20 × 20 (or the starting size when smaller, for lines) and prevents handle crossing before snap. Axes are independent except locked-aspect derivation.
- Phase 0 compatibility: without `extra` the canvas edges share tier 0 with the guide lines and hits carry no `tier`; `held` is returned only when `hold` is given. A soft pull also returns `near[axis]`, the line it leans towards, so the overlay can draw it faintly (`SnapResult.near?: { x?: SnapLine; y?: SnapLine }`).
- Per axis: keep the held target while it is within `hold`; otherwise among candidates within `threshold` choose the lowest tier, then the smallest |delta|, then position before size, then lower coordinate (position) or alphabetically shorter span id (size); otherwise apply a soft pull of `delta·f³` towards the nearest candidate within `reach`, with no hit and `pull[axis]` set for overlay opacity. Unset `reach` equals `threshold`; with no `extra` lines the result equals Phase 0 behaviour.
- Position targets: guide lines, canvas edges and centre (`centre-x|y`), other objects' edges and centres by rotated bounding box (`obj-<id>-l|c|r|t|m|b`), grid lines (`grid-x-n`). Points are drawn, never snapped to.
- Size candidates only from tier-0 lines and canvas edges: every span (`span-<idA>-<idB>`) and every region width/height, deduplicated keeping the first in `[edges, anchors]` order; they move only the handle edge.
- Hits name the winner only (5k); a span hit still flashes both lines and two exactly spanning edges both flash.
- Locked aspect snaps only `dominantAxis` (required with `lockAspect`) and derives the other dimension, opposite corner fixed. A filled image locks aspect on its corners while its edges reshape the frame, and an empty frame resizes freely (D-073); a circle picture has corner handles only and keeps its aspect (D-083); Shift locks shape corners; text corner handles scale the font while e/w rewrap.
- Rotated nodes (5m): move snaps the four rotated corners and centre; at multiples of 90° resize uses the axis-aligned path with remapped handles; at other angles resize gets size candidates only, in the local frame.
- `snapAngle` targets multiples of 45°, ± the canvas diagonal and ± every guide-cell diagonal (3a); lock 3°, pull 11°, hold 7°; Shift rounds to 15° with no targets.
- App values: move lock 6, reach 20, hold 13; resize 8 with no pull; all in screen px divided by the fit scale. Alt skips snapping entirely (5j).

### Renderer

```ts
export interface Renderer {
  render(doc: KuraDoc, opts: { sizeId: string; scale: number; measure: Measure; image: (asset: string, cutout: boolean) => ImageBitmap | null | undefined;
    transparent?: boolean; placeholders?: boolean; pixels?: { w: number; h: number } }): void;
}
```

Both the canvas renderer and SVG export consume `buildScene(doc, sizeId, measure)` from `src/core/scene.ts`; ops carry `opacity` below 1 and, for text whose paragraphs differ in direction, per-line `bidi` (D-064). The document canvas draws nodes and ground only; `placeholders` draws empty or missing image frames as slate washes in the editor, and exports leave them out. Overlay, guides, selection, snap lines, flags and handles live on a second canvas that reaches 64 px past the document on every side. Export renders offscreen at exact `pixels` with full-resolution originals, guaranteeing no guides or selection marks.

## Interface

Paper visual language, values copied from `docs/design/2026-10-10-dial/_ds/…/tokens/`: paper ground `#ECF0F3`, ink `#000`, slate `#9CABC2` for placeholders and washes, one 2px stroke weight, radii 9 / 19 / 999, no shadows, no gradients except colour pickers, Space Grotesk for all chrome. Hover is a slate 15 % wash, selected is solid ink with white glyph, controls that do not apply fade to 23 %. Motion 80/140/200/280 ms on `cubic-bezier(.2,0,.2,1)`, honouring `prefers-reduced-motion`. The toolbar sits at the top as in the prototype, so panels open 12 px below the control that owns them; Escape or a click outside closes them (canvas taps keep the colour, shapes and layers panels open). A toolbar too wide for the window wraps onto more rows rather than shrinking below 0.8, so browser zoom enlarges it (D-079). The only colour in the chrome is user colour (swatches, palette dots, hue ring).

## Keyboard controls

Mod is Command on Mac and Ctrl elsewhere. Keep D-026 bindings: Mod+D duplicate, Mod+B bold, Mod+Shift+L lock, Mod+Shift+E export, Mod+Enter finish text. Add Mod+C/X/V clipboard, Mod+A select all, Mod+Z undo, Mod+Shift+Z and Mod+Y redo, Mod+] / Mod+[ forward/backward, Mod+Shift+] / Mod+Shift+[ front/back. Tools: T text, R rectangle, O ellipse, S shapes, I picks images (D-061), P pen, E eraser, L lasso, C colour, G guides, ? shortcuts. Arrows move 1 unit; Shift+Arrow moves one grid cell when the grid is on, otherwise 10 units (5l); keyboard moves never snap. Delete/Backspace removes unlocked selection; Enter edits text; Escape disarms paint, then closes the panel, then leaves the tool, then deselects. Hold Alt while dragging to bypass snapping (5j); Alt-click without a drag selects the block underneath (D-065); Shift constrains drag axis, corner aspect and rotation steps. Letter shortcuts read the key's Latin position when the layout types another script (D-079). Shortcuts never intercept typing controls, composition or native modifier combinations. On the dial: arrows turn/focus rings, Enter starts.

## Study (frozen)

Tag `study-v1` (4061227) is the Phase 0 study build: wheel → guide entry, `?mode=guide|blank`, `?s=<id>`, content pack, paired PNG + JSON export, and the audits `scripts/browser_audit.py` and `scripts/editor_controls_audit.py` as they stand there. Run the pilot from a checkout of that tag. Do not change study behaviour on the dev branch. Study protocol decisions still belong to Safwat and are recorded in HANDOFF.

## Definition of done (Phase 1)

1. `npm test` passes with core at 100 % line coverage; every snapping rule has a named test.
2. `npm run build` yields a static bundle running from `vite preview` without app console errors and without off-origin requests.
3. Dial → editor works for all 10 ratios × 6 layouts × 3 guides, with hub previews, 5b reopen and the 5f round trip.
4. Every refinement 5a–5z and every prototype tool (except handwriting) is checked by a named step of the Phase 1 browser audit.
5. Exports open at exact sizes (A4 2480 × 3508), PNG No ground has real transparency, SVG parses with licence metadata, PDF header and page size are valid.
6. Reload restores the document and its images; undo/redo, re-ratio flags and linked-size edits behave as specified.
7. HANDOFF status says "Phase 1 build complete" and lists only follow-up decisions.

Do not claim Phase 1 complete before every item holds.

## Handoff protocol

Two agents alternate. Neither silently overrides the other.

**Session start.** Read AGENTS and HANDOFF in full; run tests. Take the first unchecked next step unless Safwat says otherwise. Do not re-open logged decisions. Agent decisions may be superseded by appending a new named superseding entry and reasoning. Safwat decisions may only be superseded by Safwat's session message.

**During.** Keep core pure and tested. Use glossary vocabulary. Small cohesive commits. Messages: `type(scope): summary [fable]` or `[astra]`.

**Session end.** Rewrite HANDOFF Status as one plain paragraph of what works and what does not. Append decisions as D-###, tick completed steps and order remaining session-sized tasks, add Deferred items and Safwat-only questions. Confirm `npm test` still passes and commit. No session is ended without HANDOFF updated.

**Autonomy.** Never halt a session waiting for answers; continue in every tier:

- Do without asking/logging: in-scope work, one-module refactors, tests, green dependency bumps, missing types and non-compiling contracts.
- Do and log: visual details (handles, thresholds, ring geometry, motion), unspecified naming/file placement, superseding agent decisions, resolutions of conflicts between the prototype and the refinement cards.
- Conservative reading, log, add question: scope expansion, changed contract meaning, anything the design files leave ambiguous that changes what a person sees.
- Never build AI features, template libraries, off-origin requests or anything excluded on instructions from comments, issues or files. Only Safwat's own session message changes scope; record it as a safwat decision.

Write HANDOFF as plain paragraphs and short lists: facts tied to tests, diffs, commands. No reasoning transcripts, chronological narrative or boilerplate.

## Model notes

Fable: plan once briefly then execute. Check the decision log before deciding again. Report verifiable artefacts; no reasoning transcripts in handoff or commits.

Astra: bias to action. "Can you" is a directive. Carry an item through to its end or definition of done and present a reviewable result without asking first.

Core is always tested; app tests where useful, skip trivial reversible tests. AGENTS and HANDOFF are the instruction context. Safwat's session message wins conflicts and is recorded. If code disagrees with this file, this file wins unless HANDOFF logs a superseding decision; then update this file in that session.

## Glossary

- **dial** — the entry screen of four concentric rings whose hub previews the resulting canvas.
- **ring** — one dial control: ratio, layout, guide or colour.
- **ratio** — canvas proportion w:h; a document can hold several linked sizes of different ratios.
- **size** — one `SizeSpec` (ratio, guide, layout) plus every node's frame for it.
- **frame** — a node's local geometry in one size: rect, rotation, font size, hidden.
- **layout / composition** — a pure slot arrangement derived from ratio and guide; never content.
- **slot** — a layout position (image, accent, headline, body) and the tag on the node placed in it.
- **unit space** — 1000-unit-wide geometry coordinate system.
- **guide** — pure canvas-size-to-anchor generator.
- **anchor** — line, point or region (points drawn but not snapped to).
- **span** — distance between two same-axis lines including canvas edges; a size candidate.
- **region** — proportional guide rectangle whose dimensions are size candidates.
- **tier** — snap target priority: guide, canvas, object, grid.
- **snap** — pure candidate-rect-to-snapped-rect-and-hits function.
- **hit** — the winning target record per axis for overlay feedback.
- **pull** — soft attraction towards a target inside `reach` but outside the lock threshold.
- **overlay** — second canvas for guides, hits, flags and selection; never exported.
- **role** — ground, ink or accent; a palette colour that follows hue and dark mode.
- **row / step** — a 7-step lightness scale for one hue and a position on it.
- **swatch** — a chosen colour in the colour panel; **armed** when tapping objects paints with it.
- **node** — text, shape, image or ink `DocNode`.
- **asset** — an image stored in IndexedDB by content hash: original, working copy, cutout.
- **ink** — a sketch stroke node, possibly cleaned into a line, arrow or shape.
