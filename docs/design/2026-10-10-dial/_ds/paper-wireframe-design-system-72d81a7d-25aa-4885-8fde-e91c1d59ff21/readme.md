# Paper — a minimalist wireframe design system

Paper is a low-fidelity mobile wireframing system. It is not a consumer product brand: it
is the visual language you draw *other* products in. Everything is rendered as flat
outlines on a pale grey sheet — content is stood in for rather than shown, so the layout,
hierarchy and interaction model of a screen can be reviewed before anyone commits to
copy, colour or photography.

The system covers 69 mobile screens across three flow sets, all at 375 × 812.

---

## Index

| File / folder | What it holds |
|---|---|
| `styles.css` | The single entry point consumers link. `@import` lines only. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `geometry.css`, `motion.css`, `base.css`. |
| `components/` | 39 React primitives in 7 groups — see **Components** below. |
| `ui_kits/mobile-flows/` | Six source screens rebuilt as one click-through. |
| `guidelines/` | 19 foundation specimen cards (Colors, Type, Spacing, Geometry, Brand). |
| `assets/icons/` | 29 line-art glyphs, extracted from the source files. |
| `assets/screens/` | All 69 source screen exports, kept as the ground truth. |
| `thumbnail.html` | The system's homepage tile. |
| `SKILL.md` | Agent-skill wrapper, for use outside this project. |

## Sources

Everything in this system was derived from a set of 138 uploaded files — 69 mobile screens
exported twice each, once as SVG and once as PNG, at 375 × 812:

- `uploads/000.svg`–`010.svg` — flow set A: onboarding, sign-in, dashboards, lists, media detail, timer, select grid, adjust sheet, browse, profile, feed.
- `uploads/100.svg`–`110.svg` — flow set B: media confirm, settings sheet, profile settings, split list, keypad sheet, add-to-list, article, mixer sheet, date/segment picker, long-read, adjust panel.
- `uploads/210.svg`–`212.svg` and `200.svg`–`209.svg` — flow set C: category rails, feed cards, expandable cards, radio lists, checklist panel, diamond browser, gallery, catalogue rows, saved panel, date picker, cart panel, keyboard sheet, keypad sheet.
- Matching `.png` rasters of each.

No codebase, Figma file, brand guidelines document or slide deck was supplied. The SVG
exports were read directly — every colour, radius, stroke weight, coordinate and glyph
outline in this system is lifted verbatim from them rather than eyeballed from the PNGs.
The source files are preserved in `uploads/` and copied into `assets/screens/`.

**There is no logo in the source.** No mark was supplied and none has been invented.
Wherever a brand mark would go, the word *Paper* is set in type (see
`guidelines/brand-wordmark.html`).

---

## Content fundamentals

Paper has almost no words in it, and that is the point. Copy is *deferred*, not written.

**Prose is drawn, not set.** Every string in the source is a flat bar. A 5px bar is a
heading; a 3px bar is a line of body copy. Width carries the meaning:

- `135px` then `105px`, 5px tall, 10px apart → the screen title and its subtitle. This pair
  opens 46 of the 69 screens.
- `135px` then `105px`, 3px tall, 11px apart → a list-row label and its secondary line.
- `165px`, 3px tall, centred → the value inside a text field.
- `285px` / `246px` alternating, 3px tall, 13px apart → a paragraph.

**Two tones of bar, and they mean different things.** A grey bar (black at 50–60%) is
interface text: titles, labels, row headings. A slate bar (`#9CABC2`, solid) is *content*
text: article bodies, product descriptions, the copy the user wrote. Never mix them within
one block.

**Real type appears in exactly three places** — keyboard letters, keypad digits, and
date-grid numerals. It is Space Grotesk, 13–20px, regular weight, never bold, never
tracked out. Nothing else in the system is typeset.

**Buttons are unlabelled.** The primary action is a solid ink pill, 255 × 60. It says
nothing. If a mock genuinely needs a word on a button, use sentence case, one or two words,
no punctuation, no exclamation. Keep it a verb: `Continue`, `Save`, `Add`.

**Tone, when words are eventually added.** Plain, second person, present tense, sentence
case. No exclamation marks, no rhetorical questions, no marketing adjectives. Labels are
nouns (`Delivery address`), actions are verbs (`Add address`), and nothing is capitalised
for emphasis. Titles never end in a full stop.

**No emoji, ever.** The source contains none, and the icon set covers everything emoji
would be reached for. Unicode is not used as decoration either — no bullets, arrows or
dingbats standing in for glyphs. If something needs an icon, it gets an SVG from
`assets/icons/`.

**Nothing is numbered for effect.** There are no stat badges, no counts, no "12 new"
pills. The only numerals in the system are dates and keypad digits. Resist adding figures
to make a screen look substantial.

---

## Visual foundations

### Colour

Five values carry the whole system.

| Token | Value | Role |
|---|---|---|
| `--paper` | `#ECF0F3` | The screen. Every frame is filled with it; there is no white background anywhere. |
| `--ink` | `#000000` | Every stroke, every filled control, every glyph. |
| `--slate` | `#9CABC2` | The one accent. Placeholder media and placeholder prose. |
| `--fill` | `#D0D8E2` | Opaque placeholder — keyboard keys, thumbnails, slider tracks. |
| `--white` | `#FFFFFF` | Only as a lift inside an ink panel or on an ink-filled control. |

Grey is never a hex value. It is always black or slate at an opacity, and only at the four
stops the source actually uses: `.15` (empty cell), `.35` (media fill), `.5`/`.6` (text
bars). `#DCE0E9`, `#CCD1D9` and `#92A0A9` exist only as gradient stops and one row fill.

The palette is **cool and desaturated** — a blue-grey paper stock. There is no warm tone in
the system at all, and no saturated colour of any kind. Nothing is red, nothing is green;
error and success states are not colour-coded, because the kit has no semantic colour.

### Type

Space Grotesk, and only Space Grotesk. This is not a guess: the keyboard and keypad glyphs
in the source SVGs are Space Grotesk outlines, so the letterforms were read off the source
itself. Weights 300 / 400 / 500 / 700 are declared; 400 is used almost exclusively.
Tracking is normal or very slightly tight (`-0.01em`); the wordmark is set at `-0.045em`.
There is no italic and no all-caps setting anywhere in the source — the uppercase labels on
the specimen cards in `guidelines/` are annotation, not part of the language.

### Spacing and layout

Every coordinate in all 69 files is a multiple of 5. The scale runs 5 · 10 · 15 · 20 · 25 ·
30 · 40 · 45 · 60 · 70.

- Screen is 375 × 812.
- Content sits in a **285px column inset 45px** from each edge.
- The first title bar sits at **y = 80**.
- Horizontal rails break the column: they start at **x = 40** (5px further out) and run off
  the right edge so the last item is visibly clipped. That clipping *is* the scroll
  affordance — there are no arrows, no fades, no dots on rails.
- Vertical rhythm is by pitch, not by divider: **70px** for list rows, **60px** for
  settings rows, **45px** for compact rows, **22px** gap between cards, **66px** between
  tab-bar icons. There is not a single horizontal rule in the source.
- Fixed elements: the tab bar (icon centreline at y = 740), the bottom sheet, the keyboard
  and the keypad. Everything else scrolls under them.

### Borders, corners, depth

One stroke weight: **2px**, ink, on everything. The only exceptions are the two progress
rings (10px and 30px) and 1px hairlines used for alignment marks.

Radii, in order of how often they appear: **19** (tiles, thumbnails, dock buttons, media
squares — by far the most common), **9** (fields, keys, date cells), **29 / 29.5** (list and
product cards, ink panels), **49 / 50** (device shell, bottom sheet), **39** (dock capsule),
**40** (hero media), **999** (buttons, switches, search, split pills), **2.5** (sheet handle).

**There are no shadows.** Not soft ones, not inner ones, not a 1px lift. `--shadow-none` is
the entire elevation system. Depth is communicated three ways only: a 2px outline, a fill
change, or one surface overlapping another. The bottom sheet's edge simply cuts across the
media block behind it — no scrim, no dim, no blur. `backdrop-filter` appears nowhere.

**What a card looks like:** a 2px ink outline, radius 29, no fill, no shadow, no header
divider. Its content is a media tile at radius 19 and two bars. That is the whole recipe.

### Backgrounds and imagery

No photography, no illustration, no pattern, no texture, no grain. Imagery is always a
placeholder: `--slate` at 35% with a matching stroke for hero blocks, opaque `#D0D8E2` for
thumbnails and card headers. Full-bleed treatment appears once — the gallery screen, where
the media block runs to the device edge and the caption sheet overlaps it.

**Gradients appear exactly twice** in 69 screens, both on tracks: `slate → paper` across a
horizontal slider, and a `#92A0A9 → #DCE0E9` sweep on the thick progress ring. Anywhere
else, a gradient is wrong.

### Transparency and blur

Transparency is used only to mix the two greys — black or slate at a fixed opacity stop.
It is never used to layer surfaces, and blur is never used at all. A sheet over a screen is
opaque paper.

### Motion, hover, press

The source is a static export, so motion is defined conservatively and kept flat:
80ms press, 140ms state swap, 200ms bar and knob travel, 280ms sheet rise, all on
`cubic-bezier(.2,0,.2,1)`. No bounce, no spring, no overshoot, no fade-in-up.

- **Hover** — an outlined element gains a `--slate-a15` wash. Ink-filled elements do not
  change on hover.
- **Press** — the wash deepens to `--slate-a35`; ink-filled elements lighten one step to
  `--steel`. A 0.98 scale is available but used sparingly.
- **Selected** — the element fills solid ink and its glyph or numeral flips to white. This
  is the only selection idiom in the system: never a colour, never a border weight change,
  never a checkmark *and* a fill.
- **Disabled** — opaque `#D0D8E2`, stroke removed, glyph at 50% ink.

---

## Iconography

The source contains a real line-art icon set, and it was extracted programmatically from
the SVG exports rather than substituted. All 29 glyphs live in `assets/icons/` as
individual SVGs with `currentColor` paint, and are compiled into the `Icon` component so
they can be tinted and sized without touching files.

**Style:** single-weight outline, ~2px stroke at 24px, rounded joins and caps, no fill
except where a glyph is intentionally solid (`heart-filled`, `caret-down`, `venn`,
`blob-two`, `blossom`). Optical size is 22–34px; the food glyphs are drawn larger (34px)
because they sit inside 80px diamond tiles.

**The set:**

- *Navigation* — `arrow-left`, `arrow-right`, `chevron-right`, `caret-down`
- *Status* — `check`, `check-circle`, `check-circle-sm`, `x-circle`, `message-x`
- *Action* — `plus`, `refresh`, `heart`, `heart-filled`
- *Tab bar* — `home`, `note-edit`, `chef-hat`, `cart`
- *Keyboard* — `shift`, `backspace`
- *Category (food)* — `cherries`, `cocktail`, `drumstick`, `carrot`, `jar`, `bottle`,
  `asterisk`
- *Abstract* — `venn`, `blob-two`, `blossom`

**No icon font, no sprite sheet, no CDN library.** Do not import Lucide, Heroicons,
Material or Feather into a Paper design — the stroke weights and corner treatments will not
match. If a glyph is genuinely missing, say so rather than substituting.

**Known gap:** the source draws the stepper's minus as a bare rectangle, not a path, so
there is no `minus.svg`. `Stepper` renders it as a 12 × 2 ink rule, which is the same
weight as every other stroke in the kit.

**Emoji and Unicode symbols are never used as icons.**

---

## Components

39 primitives in 7 groups. Each directory holds `<Name>.jsx`, `<Name>.d.ts`, a
`.prompt.md` for the group, and one `@dsCard`-tagged HTML.

**`components/frame/`** — `PhoneFrame`, `ScreenHeader`, `BottomSheet`, `TabBar`,
`Keyboard`, `Keypad`

**`components/text/`** — `TextBar`, `TitleBlock`, `TextBlock`

**`components/surfaces/`** — `Card`, `Panel`, `Tile`, `DiamondTile`

**`components/media/`** — `MediaBlock`, `MediaCard`, `Carousel`, `ProgressRing`

**`components/controls/`** — `Button`, `IconButton`, `Input`, `SearchBar`, `CodeInput`,
`Switch`, `CheckCircle`, `ChoiceRow`, `ProgressPill`, `Slider`, `VerticalSlider`,
`RangeSlider`, `Stepper`, `NumberGrid`

**`components/collections/`** — `ListRow`, `ProductRow`, `SelectGrid`, `TileRow`,
`DiamondGrid`, `Rating`, `StatRow`

**`components/icon/`** — `Icon` (plus `glyphs` and `glyphNames`)

### Intentional additions

Three components have no single counterpart in the source and were added to make the set
usable:

- **`Icon`** — a wrapper over the extracted glyph set, so screens do not inline path data.
- **`PhoneFrame`** — the source draws the device shell inline on every screen; this factors
  it out along with the 45px gutter and 80px top inset.
- **`TextBlock`** — the source repeats individual 3px bars; this generates the ragged
  paragraph pattern rather than making callers place each line.

Everything else maps one-to-one onto a shape that appears in the uploaded screens.

---

## Using the system

Link one file:

```html
<link rel="stylesheet" href="styles.css">
```

Then compose:

```jsx
<PhoneFrame>
  <ScreenHeader back avatar />
  <TitleBlock style={{ marginTop: 32 }} />
  <MediaBlock h={295} radius={40} style={{ marginTop: 30 }} />
  <TextBlock lines={6} style={{ marginTop: 30 }} />
  <Button full style={{ marginTop: 40 }} />
  <TabBar active={0} />
</PhoneFrame>
```

Three rules that keep a design on-system: **one stroke weight**, **no shadows**, and
**never write copy you were not given** — leave it as a bar.
