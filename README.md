# Commute Design Studio

A one-page scroll narrative for an interior design and lighting practice in
Toronto. The hero is a WebGL film reel of the studio's work that turns as you
scroll, flattens into a band, and hands off to the interiors section; below it
an infinite gallery pins and loops, and any slide morphs into a detail card.

Static site — no framework, no server. Vanilla ES modules, GSAP for
choreography, Three.js for the reel, built with Vite.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>.

| Script            | What it does                             |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Vite dev server with HMR                 |
| `npm run build`   | Production build to `dist/`              |
| `npm run preview` | Serve the built `dist/` locally          |
| `npm run works`   | Regenerate image derivatives (see below) |

## Structure

```
index.html                    the page — the only HTML that ships
public/                       served verbatim, never hashed
  favicon.png · robots.txt
  images/works/               works.json + 81 reel/ + 81 full/ webp
src/
  main.js                     boot: decides mount order, nothing else
  main.css                    the stylesheet entry: import order, top to bottom

  design-system/              the brand layer — portable, no site specifics
    index.css                 import chain: theme -> base -> elements
    theme/                    colours, type scale, spacing, motion, fonts
    base/                     element defaults
    elements/                 the ds-* primitives
    README.md                 the design system's own rules

  components/                 shared UI — script and styles together
    navigation/               navigation.js · navigation.css
    theme-toggle/             theme-toggle.js · theme-toggle.css
    project-card/             project-card.js · project-card.css

  sections/                   one folder per section of the page
    hero/                     hero.js · hero.css · hero.config.js · hero-reel.js
    work/                     work.css
    gallery/                  gallery.js · gallery.css · gallery.data.js
    lighting/ contact/ footer/

  lib/                        cross-cutting engine
    motion.js                 GSAP registration + reduced-motion
    reveal.js  parallax.js    scroll choreography
    theme.js                  light/dark surface, as state
    text.js  works.js  config.js  media.js

scripts/build-works.sh        image pipeline
```

Four kinds of thing, and the distinction is what keeps the tree navigable:

- **`design-system/`** — brand rules. Knows nothing about this site, and could
  be lifted into the next Commute project unchanged.
- **`components/`** — reusable UI that carries behaviour. Script and styles sit
  together, so a component is one folder you can read or move in one piece.
- **`sections/`** — one folder per section of the page, same co-location rule.
  A section may add `.config.js` for its tuning values or `.data.js` for its
  content, as `hero/` and `gallery/` do.
- **`lib/`** — the cross-cutting engine: GSAP setup, the scroll systems, theme
  state, the asset resolver. Imported by sections and components, never the
  reverse.

Dependencies only ever point downward through that list, which is why there are
no import cycles.

The conventions the scroll and animation code is held to — state ownership,
coordinate systems, transform ownership, read/write phasing — are documented
internally, with
[`src/sections/gallery/gallery.js`](src/sections/gallery/gallery.js) as the
worked example.

**Why the works images live in `public/`.** Their paths are built as runtime
strings (`images/works/full/${id}.webp`), which no bundler can see or rewrite.
`public/` is copied through without hashing, so those URLs stay valid. Moving
them into `src/` would hash their filenames and break all 162 of them.
`asset()` in [`src/lib/works.js`](src/lib/works.js) is the single place
a manifest path becomes a URL.

## Mount order is load-bearing

[`src/main.js`](src/main.js) mounts in a specific sequence, and it is not
stylistic. ScrollTrigger measures against the document as it exists when a
trigger is created, and a later `refresh()` does **not** correct a trigger that
was built before a pin it should have accounted for. So: the stage pin, then
`closeSeam()`, then the gallery pin, then parallax, then the reveal triggers.
The comments in `main.js` say which constraint each step satisfies. Reordering
them silently breaks the scroll narrative.

## Content status

**The project copy is provisional.** [`src/sections/gallery/gallery.data.js`](src/sections/gallery/gallery.data.js)
holds twelve placeholder entries so the gallery and detail card are exercisable
end to end; the titles, years and descriptions there are stand-ins and are not
claims about real work. The photography is real. Replacing the placeholders is
a data-only change — swap the fields and the image ids, and nothing else moves.

The design system forbids inventing project claims, which is also why the image
pipeline only derives a caption where the source filename carries a real project
name, and leaves the rest untitled.

## Regenerating images

The raw photography (~116 MB) is deliberately **not** in this repo — it would
bloat git history permanently. It lives alongside the repo:

```
commute-design-studio/          this repo
commute-design-studio-source/   raws, sketches, vectors, references, specs
```

```bash
npm run works
```

That derives `reel/` (640×360 centre-crop, WebGL textures) and `full/`
(1600px long edge) plus `works.json`, into `public/images/works/`. Point it
elsewhere with `ROOT_SRC=/path/to/photography-raw npm run works`.

Captions are only derived where the source filename carries a real project
name. The design system forbids fabricating project claims, so the rest stay
untitled until real copy arrives.

## Deploying

Vercel auto-detects Vite: build `npm run build`, output `dist/`. No config
file needed while the site is served from a domain root. For a sub-path
deploy, set `base` in [`vite.config.js`](vite.config.js) — `asset()` already
reads `import.meta.env.BASE_URL`, so nothing else changes.

## Accessibility and motion

Everything is additive. With `prefers-reduced-motion: reduce`, with WebGL
unavailable, or with `works.json` unreachable, the page still reads top to
bottom — the pins are never created, the sections stack, and every
choreographed element sits at full opacity.
