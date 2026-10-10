# Persona sweep — 2026-10-10

Exploratory browser runs after the Phase 1 merge, one scripted person per job, against `vite preview` in Chromium. Each persona drives the real UI and records soft findings; every finding was reproduced in isolation before it counted. Real bugs were patched and the persona re-run until it came back clean. Harness: `scripts/persona_sweep.py` (run it like the audit).

## Personas

| Round | Persona | Job |
| --- | --- | --- |
| 1 | Maya | Café social posts: square, linked Story, photo, PNG/JPG, remove a size |
| 1 | Priya | A4 gig poster: 300 dpi PDF/PNG, grid nudge, locks, autofit, Shift rotation, change ratio |
| 1 | Layla | Bilingual text: Arabic, Hebrew, Japanese, emoji, long words, SVG |
| 1 | Kai | Keyboard only: Tab, tools, nudge undo, z-order, select all, shortcuts sheet, export |
| 1 | Sam | Sketching: freehand, hold-to-clean, scribble delete, eraser, lasso |
| 1 | Cleo | Colour: hex, add as hue, dark ground, contrast fix, no hue, armed paint |
| 1 | Pat | Fast editing: Shift-drag, paste offsets, text corner and side handles, hide, marquee |
| 1 | Ren | Returning: reload, dial round trip with a ratio change, New and undo |
| 1 | Sol | Small window (900 × 560): dial, toolbar, every panel on screen |
| 1 | Chaos | 260 random keys, clicks, drags and toolbar presses with invariant checks |
| 2 | Ines | Photographer: three images dropped at once, non-image drop, 5000 px photo, replace, delete/undo, clipboard paste, picker |
| 2 | Tom | Teacher worksheet: multi-line text, Larger/Smaller, align, bold, empty text, click-away, dial mid-edit, resize mid-edit, undo storms |
| 2 | Ivy | Icons: search, synonyms, nonsense, Escape, arrows in search, library shape, SVG licences |
| 2 | Max | Four linked sizes: hide per size, text added in a banner, ratio change, remove/undo a size, export each, Go on one size |
| 2 | Quinn | Full storage: save warning, recovery after space frees, reload |
| 2 | Ula | Changing their mind mid-gesture: undo, Delete and Escape during drags, undo/redo storms |
| 2 | Dee | Dark ground: hold-to-preview light, tap, undo, JPG ground |
| 3 | Rio | Rotation: rotated text editing, Shift rotate, rotated side handle, PNG and SVG |
| 3 | Vic | A Phase 0 document: migration, editing, dial, export |
| 3 | Ari | Ink annotations: held line, arrowhead merge, recolour, SVG, a linked square size |
| 3 | Gus | Grid: snapping to 20, setting kept over reload, slider keys |
| 3 | Hana | Opt-in help bar: hover help, sketch hint, closing |
| 3 | Zed | 280+ objects: drag, select all, nudge, undo, saved size |
| 3 | Lou | Layers by keyboard: Enter selects, lock, Delete refused, reorder |
| 3 | Nia | Re-ratio flags, then fixing the flagged object |
| 4 | Tess | Two tabs on the same document |
| 4 | Theo | Touchscreen: tap, drag, double tap, pen |
| 4 | Eve | A busy design exported to PNG and SVG, compared pixel by pixel |
| 4 | Mo | Reduced motion: first open, Go, hold-to-clean |
| 4 | Bea | Background removal on one of two copies of a photo |
| 5 | Kim | Dial: wrap-around, scroll, any-colour accent, Go after turning the colour ring |
| 5 | Fay | Type extremes: 60 × Larger, minimum size, 20-unit width, blank and trailing lines |
| 5 | Lin | A locked headline inside select-all drags, nudges, recolours, duplicates, deletes, bold |
| 5 | Pia | Every export: disabled sizes and their reason, notes, file names, No ground then JPG, filled ground, A4 default |
| 5 | Ola | Undo across sizes, custom hues and ratio changes |
| 5 | Uma | Cover crops of a wide photo, corner resize |
| 5 | Xia | Dial buttons from the keyboard: wordmark, Back to canvas, New |
| 6 | Ken | 2× display, large window: canvas resolution, handles, rotate knob, export size |
| 6 | Rae | Long copy edited in a square, checked in a linked banner |
| 6 | Sid | Clicking again before things finish: double-click Download, delete during background removal |

## Bugs fixed

- **B1** (Priya) After a mouse click on a toolbar button, focus stayed on it, so Enter pressed it again: clicking Fit then Enter turned Fit back off instead of editing the text. Mouse clicks on toolbar and corner buttons now hand focus back to the canvas; dial buttons drop focus after a mouse click so Enter still starts. Keyboard activation keeps focus. `src/main.ts`, `src/app/dial/index.ts`.
- **B2** (Pat) Shift on an already-selected object removed it from the selection on press, so a Shift-drag to constrain the axis did nothing unless Shift came after the drag started. Shift now removes a selected object on release, and only when the pointer did not move. `src/app/canvas/interaction.ts`.
- **B3** (Tom) The stored height of text went stale after Larger, Smaller and Bold, and a text edit in one size left the other sizes' heights behind. `syncTextHeights` (core, tested) now runs after every text edit, in every size. `src/core/fit.ts`, `src/app/editor.ts`.
- **B4** (Tom) A new text box left empty disappeared, but Undo then brought back a box reading "Text". A new box now records no history until it is finished with some text. `src/app/editor.ts`.
- **B5** (Ula) Escape during a drag deselected the object while the drag carried on and was committed on release. Escape now cancels the gesture: move, resize and rotate restore the document, a marquee restores the selection, a pen stroke is dropped and the eraser gives back what it took. `src/app/canvas/interaction.ts`, `src/app/sketch/index.ts`.
- **B6** (Ines) Dropping several images at once stacked them 20 units apart from one cell, so near an edge they ran off the canvas. Each image now takes the next nearest free cell; past the last cell they step down-right and stay on the canvas. `src/app/editor.ts`.
- **B7** (Ivy) Closing a panel while focus was inside it (Escape in the icon search) left focus in the hidden field, so a quick next key was typed into it instead of running its shortcut. Closing a panel that holds focus now returns focus to the canvas. `src/app/editor.ts`.
- **B8** (Nia) A re-ratio flag kept its dashed outline after the object was moved back onto the canvas. Flags are now drawn only while the object still sits off the canvas or overflows. `src/app/editor.ts`.
- **B9** (Hana) Faded controls ignored the pointer, so neither their tooltip nor the help bar could explain them, and the export sheet's "Larger than browsers can export" note on disabled sizes never showed. Faded controls are hoverable again; disabled buttons still ignore clicks and a faded segment group stays inert. `src/style.css`.
- **B10** (Eve) SVG text sat about 7 % of its size lower than in the editor and the PNG: the canvas drew lines on `textBaseline = 'middle'` and the SVG on `dominant-baseline="central"`, which Chromium places from different font metrics. Both now draw on the alphabetic baseline at one position from the scene (`baseline`, from Space Grotesk's em square, `BASELINE` in `src/core/fit.ts`), so the PNG is unchanged and the SVG matches it. `src/core/scene.ts`, `src/core/export.ts`, `src/app/canvas/renderer.ts`.
- **B11** (Eve, then measured) Text jumped down by the same 7 % when editing started, because the HTML editor sets lines by CSS line-box rules. The editor is lifted by the difference, rotation origin included. `src/app/editor.ts`.
- **B12** (Tess) With Kura8 open in two tabs, an edit in the stale tab saved over the other tab's work. Every tab now follows the latest save: it takes the other tab's document, drops its own undo history and pending save, and says "Updated from another tab". `src/app/store.ts`, `src/main.ts`.
- **B13** (Theo) A double tap with a finger or pen did not open text for editing or an empty frame's picker; browsers do not reliably send `dblclick` for taps. Two taps on the same object, released without moving within 400 ms, now count as a double-click. `src/app/canvas/interaction.ts`.
- **B14** (Bea) Removing the background of one copy of a photo switched every copy of it to the cut-out. Only the image it was asked for switches; the cut-out is stored once, so the copies can show it with their own After toggle. `src/app/editor.ts`.
- **B15** (Sid) When background removal finished after its image had been deleted, it still recorded an empty undo step (the first Undo then did nothing) and said "Background removed"; a picture read into a frame deleted meanwhile did the same with "Filled". Both now check the image is still there and unlocked; a removed image keeps its stored cut-out for later. `src/app/editor.ts`.
- **B16** (Sid) A double-click on Download saved two files. The second click of a double-click is ignored. `src/app/tools/panels/export.ts`.
- The sketch clean-up morph is skipped under reduced motion, like the lift and the Go tween.
- The dial's any-colour picker now also releases its listeners on `pointercancel`.

## Checked and left as designed

- The accent row is the complementary hue (hue + 180°), as in the prototype.
- Autofit stops at body size; longer text then overflows with the crossing mark (5q).
- Enter on selected text opens it with all text selected.
- The colour panel covers the top-left of tall canvases; canvas taps underneath it reach the panel.
- A version 1 document without images stays in its old form in storage until the first save (any edit, or leaving the page); it migrates again on every load until then.
- Background removal on the WASM path (no WebGPU) holds the main thread for several seconds, so the scan line, input and autosave wait until it ends; nothing is lost. Recorded under Deferred (run inference in a worker).
- Handles more than 64 px outside the canvas are out of reach (the overlay margin); the object can still be moved back with a drag or the arrows. Recorded under Deferred.
