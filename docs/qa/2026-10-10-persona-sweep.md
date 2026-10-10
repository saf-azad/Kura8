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
- The dial's any-colour picker now also releases its listeners on `pointercancel`.

## Checked and left as designed

- The accent row is the complementary hue (hue + 180°), as in the prototype.
- Autofit stops at body size; longer text then overflows with the crossing mark (5q).
- Enter on selected text opens it with all text selected.
- The colour panel covers the top-left of tall canvases; canvas taps underneath it reach the panel.
- A version 1 document without images stays in its old form in storage until the first save (any edit, or leaving the page); it migrates again on every load until then.
- Handles more than 64 px outside the canvas are out of reach (the overlay margin); the object can still be moved back with a drag or the arrows. Recorded under Deferred.
