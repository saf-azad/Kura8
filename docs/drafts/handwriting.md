# Draft — handwriting to text

Status: **not built** (D-030). Kept so the idea can be picked up later without re-reading the prototype. Nothing in `src/` refers to it.

## What the prototype does

Source: `readHw()`, `skDown`/`skMove`/`skUp` (`write` branch) and the `hw` state in `docs/design/2026-10-10-dial/Kura8 Prototype.dc.html`.

1. Tool **Handwriting**, key `W`, sits in the sketch group beside pen, eraser and lasso.
2. Each pointer stroke is appended to `hw.strokes` in document units. The strokes draw live in ink colour with a box around their bounds.
3. One second after the last pointer-up the strokes are read. Switching tools reads them at once.
4. Reading rasterises the strokes onto a white canvas, longest side 640 px, 6 px black round strokes with 8 % padding. While it reads, strokes fade to 35 %.
5. The PNG goes to `window.claude.complete` with the instruction to transcribe exactly, keep line breaks, and answer `?` when unreadable.
6. A result becomes a bold text node over the stroke bounds: font size = bounds height ÷ lines × 0.95, width = max(bounds width, widest line) × 1.04, fill = ink role. The strokes are discarded.
7. An empty or `?` result discards the strokes and toasts "Couldn't read that". Strokes smaller than 6 screen px are ignored.

## Why it is not built

- `window.claude.complete` exists only inside Claude-hosted artifacts. A deployed Kura8 has no such function.
- Any hosted model breaks two standing rules: no ML or LLM except D-019, and no request leaving the deployment at run time.

## Ways it could come back

Each needs a Safwat decision recorded in HANDOFF before work starts.

- **Browser handwriting API** (`navigator.createHandwritingRecognizer`). On-device and model-free, but only available on some platforms; needs a capability check and a hidden tool where unsupported. Check current browser support first.
- **On-device recogniser via `onnxruntime-web`**, which the background remover already ships. Candidates such as TrOCR-small (handwritten) would have to pass the D-021 licence check for both code and weights, be pinned by digest and served from the app's origin like the ISNet weights (D-022/D-023). Expect a model of tens of MB and line-level, not paragraph-level, recognition.
- **Template matching** ($P/$Q point-cloud recognisers) for single characters or digits only. Pure geometry, could live in `src/core/`, but too limited for words.

Whatever route is chosen, keep the prototype's UX contract above so the tool behaves identically to the design.
