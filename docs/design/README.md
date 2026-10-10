# Design sources

Reference material only. Nothing here is served, bundled or linked by the app.

## 2026-10-10-dial

The designer's Kura8 dial handoff, committed unchanged from `Dial-based_design_without_templates.zip` (D-035). Open the `.dc.html` files in a browser from this folder; they load `support.js` and the Paper design system under `_ds/`, and `fonts.css` pulls Space Grotesk from Google Fonts (the app self-hosts it instead).

- `Kura8 Prototype.dc.html` is the working dial and editor that Phase 1 implements. Its script holds the reference logic for layouts (`layoutFor`), sketch recognition (`INK`), re-ratio, magnetic snapping (`move`), rotation snapping, the shape library and the keyboard map.
- `Kura8 Editor.dc.html` holds design turns 2a–4c and the refinement cards 5a–5z, each referenced by id in `docs/plans/2026-10-10-phase1-dial.md`.
- `Kura8 UI Kit.dc.html` documents the Phase 0 chrome (frozen at tag `study-v1`).
- `_ds/…/tokens/*.css` are the Paper tokens that `src/style.css` copies values from.
- The prototype's handwriting tool is not implemented; see `docs/drafts/handwriting.md`.
