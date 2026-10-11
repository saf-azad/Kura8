# Kura8 user-test primer (for simulated student sessions)

Kura8 is a browser design editor (vanilla TS, canvas). You open on a **dial** (four rings: ratio, layout, guide, colour)
and press **Start** to get a pre-arranged, fully editable canvas: an empty image frame, an accent block, a "Headline"
text (opens in edit mode with text selected, so typing replaces it) and a "Body text" text.

App under test: a frozen copy of `dist/` served by `npx vite preview --port 4181 --outDir <copy>` so rebuilding does not disturb a run; set `KURA_BASE=http://127.0.0.1:4181/` (default 4173).
Harness: `scripts/usertest/kura.py` (Python Playwright). Read it first. Put persona scripts next to it (or anywhere with it on `sys.path`) and run `KURA_BASE=http://127.0.0.1:4181/ python3 your_script.py`.
Sample files go in `private/usertest/samples/` (ignored; `KURA_SAMPLES` overrides): OpenCV's public `samples/data` photos (fruits, home, building, butterfly, starry_night, messi5…) fetched from raw.githubusercontent.com, GitHub explore topic logos as transparent PNGs, and generated ones (a 12 MP phone photo, a transparent wordmark, an SVG logo). Runs land in `private/usertest/runs/<session>/`. You may generate more with Pillow
(e.g. a CMYK JPEG, a huge PNG, a tall screenshot, an SVG logo, a HEIC-named file) into your own folder.
Screenshots: use `s.shot('label')`, then LOOK at the PNG with your image Read tool — judge it like a student would.

## Ratios (dial ratio ring / corner pill)
square 1:1 "Post" (1080²), portrait 4:5 (1080×1350), landscape 16:9 "Slide" (1920×1080), story 9:16 (1080×1920),
a4 "Print" (2480×3508 at 300 dpi), banner 3:1 (1500×500). Layouts: cover, split, stack, poster, frame, band.
Guides: thirds, golden, divisions ("Quarters"). Hue: 0–330 step 30 or null (neutral). `dark: true` = dark ground.
`s.dial(ratio=..., comp=..., guide=..., hue=..., dark=...)` presets the dial; `s.start()` presses Start.

## Unit space
Canvas is always 1000 units wide; height = 1000·h/w. `s.at(x, y)` converts to screen px; `s.click/dblclick/drag` take units.
`s.doc()` reads the autosaved document JSON (nodes with `frames[sizeId].rect`, `kind`, `text`, `fill`, `slot`).

## Controls (accessible names / tooltips; `s.press(label)` clicks them)
Toolbar (top): `Text (T)`, `Shapes (S)` (panel: 41 shapes + icon search box "Search icons"), `Image (I)` (adds an empty
frame, or with an empty frame selected opens the file picker), `Sketch (P)` → `Eraser (E)`, `Lasso (L)`, `Colour` (C)
panel (roles Ground/Ink/Accent, shades, 12 hues, SV picker, input "Hex colour", "+ Add as hue", Light/Dark ground),
angle readout, text group (`Smaller`, size readout, `Larger`, `Bold`, `Align`, `Autofit`), `Remove background`,
`Duplicate`, `Lock`, `Delete`, `Undo`, `Redo`, `Keyboard shortcuts`, `Export` (sheet: PNG/JPG/SVG/PDF, 1×/2×/3× or
300 dpi, "No ground" switch, Download button `button.download`).
Corner (top right): `Guides (G)` toggle, size pill (click = "Change ratio" wheel), `Add a linked size` (+), `Layers`,
`Snap grid`. Wordmark "Kura8" (top left) = back to the dial (Go re-lays content; New starts fresh, Undo restores).
Bottom-left `?` = opt-in help bar.

## Gestures
Click selects; Shift+click multi; drag empty canvas = marquee; drag object = move (snaps to guides/edges/objects;
hold Alt to bypass); 8 handles resize (images keep aspect; text corners scale font, e/w rewrap); knob above = rotate.
Double-click text = edit (Escape or Mod+Enter finishes); double-click image frame = file picker. Drop image files on a
frame to fill it, elsewhere to add at the nearest guide cell. Mod = ⌘ on Mac (`mac=True`), Ctrl otherwise.
Shortcuts: Mod+Z/Shift+Z/Y, Mod+C/X/V/D/A, Mod+B bold, Mod+Shift+L lock, Mod+Shift+E export, Mod+]/[ order,
arrows nudge (Shift ×10), Delete, Enter edits text, Escape, T R O S I P E L C G ?.

## Known by design (do not report as bugs)
No handwriting, no user zoom/pan, no groups, no free crop, no file open/save, no accounts/collaboration, one current
document autosaved in the browser. No AI features. These are deliberate exclusions — but DO tell us if a student's
task is seriously blocked by one of them (we log those for the product owner).

## New in loop 2 (built from loop-1 findings)
- Text: **Typeface** button ("Aa", aria-label starts "Typeface") opens 7 OFL faces (Space Grotesk, Poppins, Playfair Display,
  Lora, Bebas Neue, Caveat, Space Mono). The **Font size** and **Angle** readouts are inputs you can type into (Enter applies).
  Text controls act on every selected text block. Text under a growing text block moves down with it. Poster/stack headlines
  autofit to their room; autofit avoids splitting words. Each paragraph takes its own direction (Arabic line in English text).
  Text that runs off the canvas is flagged ("!") and noted in Export. Mod+B works while typing; Mod+Z before typing undoes.
- Pasting plain text (copied from Docs) on the canvas makes a text block (`s.paste_text`). Mod+C writes text to the clipboard.
- Images: **Image (I)** opens the file picker (PNG/JPEG/WebP/GIF/SVG; HEIC gets a message). Several pictures spread over the
  emptiest guide cells, under the text, uncropped. An empty frame is "+ Image frame" in the Shapes panel. Selecting an image
  shows an on-image bar: **Replace**, **Reposition** (or double-click; drag the picture inside its frame; Done/Enter/Esc),
  **Fit** (frame takes the picture's proportions), Before/After for cut-outs. Transparent logos dropped on a photo go on top.
- **Arrange** toolbar button: align left/centres/right/top/middles/bottom (one object → canvas, several → each other) and
  space evenly across/down (3+). The old text "Align" button is now "Text align".
- Colour panel: **Opacity** slider for the selection. Contrast hint checks against the block behind the text.
- Layers: double-click a layer name to rename. Alt-click (no drag) selects the block underneath.
- Export: files named after the headline (e.g. `little-ember-is-now-open-square.png`), "No ground" for every PNG,
  **All sizes** switch → one .zip when the design has linked sizes. A4 offers 300 dpi, 1×, 3×.
- Change ratio round trips no longer shrink things. New keeps the replaced design one Undo away even after reload.
  A second tab's save is picked up ("Updated from another tab").
- Still by design: no zoom/pan, no groups, one current document, no multi-page.
