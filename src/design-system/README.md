# Commute Design Studio — Design System

Commute Design Studio is an interior design and lighting practice. Its public surface is a single product: a **one-page scroll narrative portfolio site** — hero reel, selected work, a project detail, studio, services, a material/craft mosaic, one dark lighting-and-objects passage, contact, footer.

The feeling the system is built to produce: quiet, precise, tactile, intentional, deep, confident, restrained, crafted. Luxury comes from composition and material, never from decoration.

**Ten non-negotiables**

1. Less, but better.
2. Imagery dominates; UI recedes.
3. Negative space is an active element — never fill space just because it exists.
4. Typography behaves architecturally: placed, aligned, structural.
5. Motion explains spatial relationships. Nothing animates without a reason.
6. 3D creates depth, not spectacle.
7. Every section has one clear visual idea. If you can't name it in five words, cut it.
8. Asymmetry over symmetry. Controlled imbalance creates tension.
9. Expensive, not ostentatious.
10. When unsure: remove.

## Provenance

The system derives from the studio's written spec, a reference specimen, and
three composition studies (hero, craft mosaic, material moodboard). Those
source documents are not in this repository — they live in the project archive
alongside it, under `specs/`, `moodboards/` and `references/`.

Two constraints from that material carry forward and should not be quietly
reversed:

**There is no logo asset, by design.** The wordmark is the name set in Archivo,
uppercase, `0.16em` tracking — that is the mark. Use `.ds-wordmark` wherever a
logo would go. Do not draw one.

**Archivo is a substitution, and a deliberate one.** It is the family the spec
names, served from Google Fonts (`theme/fonts.css`) as the variable face,
weight 100–900, width 62–125. If the studio licenses the premium upgrade path —
Söhne, Neue Haas Grotesk Display, or Suisse Int'l — those are drop-in with no
metric changes, and the swap is one line.

---

## Content fundamentals

**Voice.** Declarative and material-first. Sentences state what a thing is made of and how it was made, then stop. No marketing register, no persuasion, no adjective stacking.

- Studio line: "Interiors and objects defined by clarity, restraint, and the tactile beauty of craft."
- Studio belief: "We believe in the integrity of raw materials, shaped with intention and longevity."
- Process line: "Our process: from concept to site specificity."

**Person.** "We" for the studio, never "I". The reader is addressed rarely and never as "you" in a sales sense. Project descriptions are third-person and factual: 1–3 sentences, no claims that can't be photographed.

**Casing.** Sentence case for headlines and body. UPPERCASE only for Metadata and Micro tiers — section labels, project metadata, captions, footer cells, nav links. Never uppercase a body paragraph. Headlines may be set in uppercase where they act structurally (the hero wordmark, the studio headline "THE TACTILE BEAUTY OF CRAFT.") but never mid-paragraph.

**Punctuation and separators.** A double slash separates subject from detail in captions: `Custom millwork // joinery detail`, `Brass fabrication // patina & form`, `Textile // weave analysis`. A single slash with spaces separates metadata fields: `Project 01 / Residence, Toronto / 2025`. Section footers read `02 // Craft`. Em dashes are used sparingly, in captions, for an appositive: `Artisanal plaster — texture study`.

**Numerals.** Zero-padded ordinals for sections and projects (`01`, `02`). Years are bare four digits. Metadata numerals are tabular.

**No emoji. Ever.** No exclamation marks. No questions as headlines. No "let's", no "we're excited", no startup register.

**Never invent content.** No fake clients, awards, statistics, testimonials, or project names. Copy stays generic — "Project title", "Residence, Toronto" — until the studio supplies real material. An empty-looking section is correct; a padded one is not.

---

## Visual foundations

**Colour.** Eight tokens, no more. Warm ivory `#F1EFE3` is the surface; deep aubergine `#1D1117` is the dark surface and the deepest text; marble charcoal `#342E2D` is body text. Stone beige `#B8AEA2` makes rules, mattes and image placeholders; slate grey `#625E5B` is secondary text; glass sage `#789D96` is a rare tint. Velvet teal `#008DA8` is an architectural accent and bright teal `#16B5C8` is interactive-only.

The **proportion law** is enforced per viewport, not per page: base neutrals ~92%, supporting tones ~7%, teal ≤1%. Teal is a hairline underline, a 6px marker, an active nav state, a focus ring. Never a filled button, never a background, never a heading, never a gradient. Two teal elements visible at once means one comes out.

**Dark inversion.** The lighting/objects passage swaps token roles — no new hues enter. What dark mode adds that light mode has not is _light itself_: a soft radial pool (`--light-pool`, 40–60% viewport radius, ≤12% luminance lift), specular edges, a reflected floor gradient. No glow, no bloom, no neon.

**Type.** One family, Archivo variable. No second family, no monospace. Six tiers: Display / Headline / Title / Body / Metadata / Micro — see `theme/typography.css`. Only one Display element per viewport. Body measure caps at 62ch. Metadata is differentiated by case, size and tracking, never by typeface. Never accent a single word in a headline with colour, italic or weight. Hyphenation off; set explicit line breaks in display copy rather than accept an orphan.

**Layout.** 12 columns, max 1680px, gutter `clamp(16px, 1.4vw, 28px)`, page margin `clamp(20px, 6vw, 120px)` — the large margin is a primary brand signal, not padding to be trimmed. A bleed track sits outside the margin: images may occupy it, type may not. Mobile drops to 4 columns, 20px margin, 16px gutter. Never centre a full section; anchor to columns 1–7 or 6–12 and leave the counterweight empty. Every section earns either one controlled overlap or one deliberate void column, never both. Space scale is 4px-based: 4·8·12·16·24·32·48·64·96·128·192·256.

**Backgrounds.** Flat surface colour. No gradients on light sections, no textures, no repeating patterns, no illustration. The only gradient in the entire system is the radial light pool in the dark passage. Sections flow into one another on the shared ivory ground — no cards, no containers, no hard dividers except the single dark passage, and even that interpolates over ~40vh of scroll.

**Imagery.** Interior photography, warm-neutral, natural light, low saturation — plaster, rift oak, patinated brass, linen, travertine. No grain filter, no duotone, no stock business imagery. Ratios in order of preference: 4:5, 3:4, 16:9, 21:9; 1:1 only inside material/detail grids. Every slot is ratio-locked, so dropping real photography into a placeholder does not shift the layout.

**Placeholders.** `src: null` renders stone at 14% opacity at the declared ratio, with the alt text set in Micro tier, bottom-left.

**Borders and radii.** Hairlines are `1px solid var(--rule)` and mark structural boundaries only — a list row, a section head. Corner radius is **0px everywhere**. The single exception is the pill-form theme toggle at `999px`.

**Shadows.** None. There is no shadow system, inner or outer. Depth comes from scale, blur falloff and opacity in the 3D reel, and from the light pool in the dark passage.

**Transparency and blur.** Used only for depth in the hero reel (planes recede via opacity falloff and a sub-1px-per-step blur) and in the `color-mix` alpha of rules and mattes. No glassmorphism, no frosted panels, no backdrop filters over content.

**Cards.** There are none. If content feels like it wants a card, it wants a hairline and a column instead.

**Motion.** `--dur-fast 180ms` / `--dur-base 420ms` / `--dur-slow 760ms` / `--dur-scene 1200ms`; `--ease-out cubic-bezier(.22,1,.36,1)` for entrances, `--ease-inout cubic-bezier(.65,0,.35,1)` for scroll-linked movement. One orchestrated moment per section, not a fade-up on every element. Reveal is `opacity 0→1` plus `translateY(20px→0)` at `--dur-slow`, stagger 70ms, four items maximum. Scroll-linked motion is preferred over triggered: parallax depth offsets, image scale `1.06→1.0`, mask reveals — it should read as camera movement through a space. Never animate the colour of a large surface; never loop anything on the light sections. No cursor followers, particles, magnetic buttons, marquees or letter scrambles.

**Hover states.** One behaviour per component type, at `--dur-fast`. Images scale to `1.02`. Nav links shift from slate to aubergine and grow a `--accent-live` hairline underline. Text links shift to teal and brighten their underline. Nothing changes opacity on hover; nothing lifts.

**Press states.** The system has no filled buttons, so there is no press-shrink. The theme toggle's pressed state is a solid `--text-hi` pill with `--surface` label, held while `aria-pressed="true"` — a state, not a transient.

**Focus.** `2px solid var(--accent-live)` at `3px` offset, visible everywhere, never removed. `#16B5C8` must always pair with a non-colour cue.

**Fixed elements.** Only the header sticks. No floating action buttons, no sticky sidebars, no back-to-top chip, no cookie bar treatment in the system.

**Registration marks.** Small `+` crosses, ~12–13px, stone, marking genuine alignment intersections. Two per viewport maximum, always `aria-hidden`.

---

## Iconography

**There is no icon set, and that is deliberate.** No source supplied an icon font, an SVG sprite, or PNG glyphs, and the spec's DON'T list rules out icon grids. Nothing in the supplied screenshots uses a pictographic icon: navigation is text, the theme toggle is two named labels ("Stone beige" / "Velvet teal"), and captions carry meaning that elsewhere would be delegated to a glyph.

What stands in for iconography:

- **Registration marks** — the `+` cross drawn from two 1px stone rules (`RegistrationMark`). Structural, not semantic; always `aria-hidden`.
- **The hairline rule** — the system's way of saying "boundary".
- **Case and tracking** — uppercase, 0.09–0.12em, is how metadata announces itself.
- **The double slash** `//` — the caption's only ornament.

No emoji, ever. No unicode dingbats as icons. If a future need genuinely requires a glyph (an external-link mark, a play control), it should be drawn as a 1px-stroke figure on the same 12–13px module as the registration mark and added here — not pulled from Lucide, Heroicons, or any set with its own personality. Nothing has been substituted from a CDN, because nothing was missing.

---

## Index

This system ships as plain CSS, not React. The spec expressed it as a set of
JSX components with typed props; those are transcribed here as `ds-*` classes
with identical tokens and values, so a static page can consume the system with
no build-time component layer.

| File             | What it is                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| `index.css`      | The single entry point consumers link. `@import` lines only, in cascade order. |
| `README.md`      | This file.                                                                     |
| `thumbnail.html` | Homepage tile. Not part of the site build.                                     |

**Theme** — the custom properties everything else consumes.
`theme/fonts.css`, `theme/colors.css`, `theme/typography.css`,
`theme/spacing.css` (which also carries the ≤760px grid override),
`theme/motion.css`.

**Base** — `base/base.css`. Element defaults: reset, link and focus
treatment, `text-wrap: pretty`.

**Components** — nine files, each one component group from the original
React inventory.

| File                               | Classes                                                                               | Was                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `components/typography.css`        | `.ds-display` `.ds-headline` `.ds-title` `.ds-body` `.ds-meta` `.ds-micro` `.ds-word` | the six type tiers                                  |
| `components/layout.css`            | `.ds-section` `.ds-grid` `.ds-sectionhead` `.ds-rule` `.ds-gap-*`                     | `Section` `Grid` `Col` `Stack` `Rule` `SectionHead` |
| `components/navigation.css`        | `.ds-wordmark` `.ds-nav` `.ds-navlink` `.ds-skip`                                     | `Navigation` `Wordmark` `TextLink`                  |
| `components/theme-toggle.css`      | `.ds-toggle` `.ds-toggle__btn`                                                        | `ThemeToggle` — the one 999px radius                |
| `components/media.css`             | `.ds-media` `.ds-figure` `.ds-caption`                                                | `MediaSlot` `Figure` `Caption`                      |
| `components/project-row.css`       | `.ds-project-row`                                                                     | `ProjectRow`                                        |
| `components/structural-list.css`   | `.ds-list`                                                                            | `StructuralList`                                    |
| `components/registration-mark.css` | `.ds-reg`                                                                             | `RegistrationMark`                                  |
| `components/reveal.css`            | `.ds-reveal`                                                                          | the armed/entered reveal states                     |

**Import order is load-bearing.** `theme` → `base` → `components`, and within
components the order in `index.css`. Several rules resolve ties by source
order rather than specificity — see the `:not([data-parallax])` comment in the
consuming site's `styles/sections/work.css` for the one place that was
deliberately rewritten to avoid depending on it.

**No Button, Input, Card, Badge, Tab, Dialog, Toast or Tooltip exists**,
because the studio's surface has none and the DON'T list forbids most of them.
If content feels like it wants a card, it wants a hairline and a column.

**Consumed by** — `../main.css`, which imports this system first and
then layers the site's own section layout on top.
