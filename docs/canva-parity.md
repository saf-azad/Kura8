# Canva parity: photo editing and graphic design

Safwat's request (2026-10-10, D-045): list the 30–40 things people do most in Canva for photo editing and graphic design, try each one in Kura8, add whatever is missing, and test again. `scripts/canva_audit.py` checks each task as a named browser step against the built app. The first run was against the Phase 1 build (`7caf1f3`). The second run was after the work recorded in D-045–D-048.

## How to run

`npm run build`, then `npm run preview -- --port 4173`, then `python3 scripts/canva_audit.py`. Use `ONLY=<step>` to run one step, for example `ONLY=p03`. The script reuses the Phase 1 audit's harness, so a run fails on any app console error or any request that leaves the origin.

## Results

Status before: ✓ worked, ◐ partly, ✗ missing. "Now" is the result of the second run, where every listed task passes. Steps are named after the task number.

### Photo editing

| # | Task in Canva | Before | Now | How in Kura8 |
|---|---|---|---|---|
| P01 | Upload a photo from the computer | ✓ | ✓ | Image tool (I), drop, paste, or double-click an empty frame |
| P02 | Drop a photo onto a frame to replace it | ✓ | ✓ | Drop on a photo or frame (5p); also Edit image → Replace |
| P03 | Crop with handles | ✗ | ✓ | Double-click the photo (or the crop button): drag the frame's handles; the picture stays put |
| P04 | Move and zoom the photo inside its frame | ✗ | ✓ | In crop mode: drag inside to move, drag a round corner or use the Zoom slider |
| P05 | Flip horizontally or vertically | ✗ | ✓ | Edit image, Effects or Position → Flip |
| P06 | Rotate or straighten | ◐ | ✓ | Rotate knob with angle snapping. Before, the knob of a photo at the top edge was under the toolbar; it now drops below the box |
| P07 | Brightness and contrast | ✗ | ✓ | Edit image → Adjust |
| P08 | Saturation, black and white | ✗ | ✓ | Edit image → Saturation (−100 is black and white) |
| P09 | Warmth and tint | ✗ | ✓ | Edit image → Warmth, Tint |
| P10 | Blur | ✗ | ✓ | Edit image → Blur |
| P11 | Sharpen | ✗ | ✓ | Edit image → Sharpen (unsharp mask) |
| P12 | Vignette | ✗ | ✓ | Edit image → Vignette |
| P13 | One-tap filters | ✗ | ✓ | Edit image → Filters: ten presets with live thumbnails of the photo itself |
| P14 | Duotone | ✗ | ✓ | Edit image → Duotone, in palette roles, so it follows hue and dark mode |
| P15 | Transparency | ✗ | ✓ | Effects → Opacity, for any object |
| P16 | Remove background | ✓ | ✓ | On-device remover with Before/After (D-019, 5o) |
| P17 | Photo in a shape frame, rounded corners | ✗ | ✓ | Edit image → Shape: rounded, circle, pill, heart, star, hexagon, diamond, triangle, drop, arch |
| P18 | Border around a photo | ✗ | ✓ | Effects → Border: width and colour role |
| P19 | Drop shadow | ✗ | ✓ | Effects → Shadow: blur, distance, angle, strength, colour role; follows a cut-out's outline |
| P20 | Set a photo as the background | ✗ | ✓ | Edit image or Position → Fill page |
| P21 | Photo grid or collage | ◐ | ✓ | Drop several photos at once: each fills its own guide cell, nearest first. Before, they stacked 20 units apart in one cell |

### Graphic design

| # | Task in Canva | Before | Now | How in Kura8 |
|---|---|---|---|---|
| G01 | Start from a template | ✓ | ✓ | By design, the dial's six layouts instead of a template library (decision rule 1) |
| G02 | Resize for another format | ✓ | ✓ | Change ratio or add a linked size (5v, 5w) |
| G03 | Add and edit text | ✓ | ✓ | Text tool (T), double-click to edit |
| G04 | Change the font | ✗ | ✓ | Font button: Space Grotesk, Montserrat, Playfair Display, Bebas Neue, Space Mono, Caveat (all OFL-1.1, served from the app) |
| G05 | Size, weight and alignment | ✓ | ✓ | Toolbar (the audit found the Bold button had no accessible name; fixed) |
| G06 | Italic, underline, uppercase | ✗ | ✓ | Font panel, or Mod+I and Mod+U |
| G07 | Letter spacing and line spacing | ✗ | ✓ | Font panel sliders |
| G08 | Text effects: shadow and outline | ✗ | ✓ | Effects → Shadow, Border on text |
| G09 | Shapes and lines | ✓ | ✓ | 41-shape library, sketch clean-up |
| G10 | Icons and graphics | ✓ | ✓ | 1,512 Phosphor icons with synonym search |
| G11 | Recolour with brand colours | ✓ | ✓ | Palette roles, shade rows, custom hues |
| G12 | Background colour | ✓ | ✓ | Armed paint on the ground |
| G13 | Gradient fill | ✗ | ✓ | Colour panel → Gradient on a shape: Start and End stops and an angle. Fill page on a gradient shape gives a gradient background |
| G14 | Eyedropper | ✗ | ✓ | Colour panel → Pick from canvas |
| G15 | Align to the page or to each other | ✗ | ✓ | Position → Align (one object aligns to the page, several to each other) |
| G16 | Space evenly | ✗ | ✓ | Position → Distribute horizontally or vertically |
| G17 | Group and ungroup | ✗ | ✓ | Mod+G and Shift+Mod+G, or Position. A click selects the group; a second click picks one member |
| G18 | Layers, order, lock, duplicate, undo | ✓ | ✓ | Layers panel and shortcuts |
| G19 | Copy style | ✗ | ✓ | Mod+Alt+C and Mod+Alt+V, or Effects → Copy style and Paste style |
| G20 | Download PNG, JPG, PDF, SVG with effects | ◐ | ✓ | Every effect exports: rasters at full resolution; SVG with clip paths, gradients, drop-shadow filters and the fonts it uses |

The first run passed 11 of 41 steps. Three more tasks worked but failed on audit timing or labels (P01, G05, and P06 because of the knob bug). Two were partial (P21, and G20, which had nothing to export).

## Not built, and why

These are among the things people do most in Canva. Each one conflicts with a rule in AGENTS.md, so none was built without Safwat's say-so. Each is listed as an open question in HANDOFF.

- **Magic Eraser, Magic Expand, Magic Edit, Magic Grab, Enhance and upscale.** These are generative or learned models (rule 3: no AI; D-019's only exception is the background remover). Magic Eraser could be approximated by a deterministic patch fill, but that still invents pixels, so it needs a decision.
- **Text to image, Magic Write, Magic Design, Magic Media.** These are generative AI and are excluded by rules 3 and 4.
- **A template library.** Kura8's product rule 1 is structure from geometry. The dial's layouts are the Kura8 answer (G01).
- **Stock photos, elements, audio and video libraries.** These would mean requests leaving the machine (rule 4) or bundling a content library (rule 1).
- **Several pages, animation, video, presenting.** These are outside Phase 1. Kura8 documents have linked sizes, not pages.
- **Sharing, comments, real-time collaboration, brand kit sync.** These need accounts, collaboration and servers (out of scope, rule 4).
- **Charts, tables, QR codes and other apps.** These are not in Phase 1 scope. They are candidates if Safwat wants them.
- **Curved text.** This is deferred: it needs path-based text layout in the measurer, the renderer and the SVG writer.
