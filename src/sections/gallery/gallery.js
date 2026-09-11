/* ============================================================
   gallery.js — the Selected Work infinite scroll gallery.

   Adapted from the Codrops "Infinite GSAP Scroll Gallery" tutorial
   (Slider / Reveal / verticalLoop). Kept faithful to the mechanics;
   adapted to this vanilla, single-page, pinned-scroll site:

   - verticalLoop: ported as-is (yPercent loop + gsap.utils.wrap seam).
   - Slider  -> driven by a pinned ScrollTrigger (scrub) instead of the
     Observer wheel-hijack (Observer isn't vendored, and native scroll
     through a pin fits a long page cleanly). Parallax + reveal kept.
   - Reveal  -> autoAlpha image fade + caption char-stagger, but split
     manually (see text.js).
   - Parallax -> state-driven: the per-tick render pass derives every slide's
     position from explicit state, and measures the DOM only for the geometry
     it cannot own (see the coordinate-system map above class Gallery).

   The modules stay separate internally, mirroring the tutorial.
   ============================================================ */

import { gsap, ScrollTrigger, Flip, reduced } from '../../lib/motion.js';
import { splitChars } from '../../lib/text.js';
import { asset } from '../../lib/works.js';
import { Card } from '../../components/project-card/project-card.js';
import { projects } from './gallery.data.js';

/* ---------- verticalLoop (ported from the tutorial) ----------
   A paused timeline whose playhead is the scroll position. Each item
   travels up until off the top, then re-enters from the bottom. */

function verticalLoop(items, config) {
  items = gsap.utils.toArray(items);
  config = config || {};

  const tl = gsap.timeline({
    repeat: config.repeat,
    paused: config.paused,
    defaults: { ease: 'none' },
    onReverseComplete: () => tl.totalTime(tl.rawTime() + tl.duration() * 100),
  });

  const length = items.length;
  const startY = 0;
  const heights = [];
  const yPercents = [];
  const pixelsPerSecond = (config.speed || 1) * 100;
  const snap = config.snap === false ? (v) => v : gsap.utils.snap(config.snap || 1);

  gsap.set(items, {
    yPercent: (i, el) => {
      const h = (heights[i] = parseFloat(gsap.getProperty(el, 'height', 'px')));
      yPercents[i] = snap(
        (parseFloat(gsap.getProperty(el, 'y', 'px')) / h) * 100 + gsap.getProperty(el, 'yPercent'),
      );
      return yPercents[i];
    },
  });
  gsap.set(items, { y: 0 });

  const totalHeight =
    items[length - 1].offsetTop +
    (yPercents[length - 1] / 100) * heights[length - 1] -
    startY +
    items[length - 1].offsetHeight * gsap.getProperty(items[length - 1], 'scaleY') +
    (parseFloat(config.paddingBottom) || 0);

  for (let i = 0; i < length; i++) {
    const item = items[i];
    const curY = (yPercents[i] / 100) * heights[i];
    const distanceToStart = item.offsetTop + curY - startY;
    const distanceToLoop = distanceToStart + heights[i] * gsap.getProperty(item, 'scaleY');

    tl.to(
      item,
      {
        yPercent: snap(((curY - distanceToLoop) / heights[i]) * 100),
        duration: distanceToLoop / pixelsPerSecond,
      },
      0,
    ).fromTo(
      item,
      {
        yPercent: snap(((curY - distanceToLoop + totalHeight) / heights[i]) * 100),
      },
      {
        yPercent: yPercents[i],
        duration: (totalHeight - distanceToLoop) / pixelsPerSecond,
        immediateRender: false,
      },
      distanceToLoop / pixelsPerSecond,
    );
  }

  tl.progress(1, true).progress(0, true);
  return tl;
}

/* ---------- build slides from the data (drop-in swap) ---------- */

function buildSlides(track) {
  const frag = document.createDocumentFragment();
  const slides = projects.map((p, i) => {
    const fig = document.createElement('figure');
    fig.className = 'gallery__slide';
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', `${p.title} — view project`);
    fig.dataset.index = String(i);

    const wrap = document.createElement('div');
    wrap.className = 'gallery__img-wrapper';
    const img = document.createElement('img');
    img.src = asset(p.mainImage);
    img.alt = p.title;
    img.loading = 'eager'; // preload so the entrance isn't spent on network
    img.decoding = 'async';
    wrap.appendChild(img);

    const cap = document.createElement('figcaption');
    cap.className = 'ds-micro';
    cap.textContent = p.title;

    fig.append(wrap, cap);
    frag.appendChild(fig);
    return fig;
  });
  track.appendChild(frag);
  return slides;
}

/* ---------- Reveal (rise + fade image, caption char stagger) ---------- */

// How far below rest each image starts before rising in. Matches the
// sitewide "up" reveal distance (page.js's FROM.up) for consistency.
const REVEAL_RISE = 48;

class Reveal {
  constructor(slides) {
    this.items = new Map();
    slides.forEach((slide) => {
      const wrapper = slide.querySelector('.gallery__img-wrapper');
      const chars = splitChars(slide.querySelector('figcaption'));
      gsap.set(wrapper, { autoAlpha: 0, y: REVEAL_RISE });
      gsap.set(chars, { autoAlpha: 0 });
      this.items.set(slide, { wrapper, chars });
    });
  }

  toggle(changes, immediate = false) {
    changes
      .filter((c) => c.visible)
      .sort((a, b) => a.top - b.top)
      .forEach((c, i) => this.show(c.el, i * 0.12, immediate));
    changes.filter((c) => !c.visible).forEach((c) => this.hide(c.el));
  }

  // Animates the WRAPPER's own y, not the parent .gallery__slide's — that
  // parent gets a continuous parallax y every tick (see renderSlides), and
  // fighting that with a second tween on the same property would have the
  // parallax overwrite the rise before it could read. The two compose
  // instead: the slide keeps drifting while the picture inside it rises in.
  show(slide, delay, immediate = false) {
    const { wrapper, chars } = this.items.get(slide);
    if (immediate) {
      gsap.set([wrapper, ...chars], { autoAlpha: 1, overwrite: true });
      gsap.set(wrapper, { y: 0 });
      return;
    }
    gsap.fromTo(
      wrapper,
      { y: REVEAL_RISE, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 1,
        ease: 'power2.out',
        delay,
        overwrite: true,
        force3D: true,
      },
    );
    gsap.to(chars, {
      autoAlpha: 1,
      duration: 0.4,
      ease: 'none',
      stagger: 0.025,
      delay: delay + 0.2,
      overwrite: true,
    });
  }

  // Instant reset, no exit animation (per spec) — but the wrapper's y is
  // parked back below rest too, so a slide cycling around the infinite loop
  // replays the rise on its next entry instead of just fading in place.
  hide(slide) {
    const { wrapper, chars } = this.items.get(slide);
    gsap.set(wrapper, { autoAlpha: 0, y: REVEAL_RISE, overwrite: true });
    gsap.set(chars, { autoAlpha: 0, overwrite: true });
  }
}

/* ---------- image drift ----------

   The photograph is oversized inside its frame (gallery.css gives
   .gallery__img-wrapper img an --overhang top and bottom) and drifts within
   it as the frame crosses the viewport — depth, not a sliding plate. Same
   composition and the same units as the design system's masked images: see
   the long note above @property --drift in elements/media.css.

   GAL_DRIFT is the nominal amplitude, as a % of the image's OWN height. */
const GAL_DRIFT = 15;

// Only reached if the custom property can't be read at all.
const GAL_OVERHANG_FALLBACK = 24;

/* The hard ceiling is NOT a second tuning value — it is whatever the CSS
   overhang can actually hide, so it is derived from that overhang instead of
   restated here where it would rot the next time the CSS changes. An overhang
   of o% on each edge makes the image (100 + 2o)% of the frame's height, so it
   can travel o / (100 + 2o) of its own height before an edge shows: 24% ->
   16.2%, which is the headroom GAL_DRIFT's 15 sits under.

   Read once (per rebuild), never per frame. --overhang must stay a percentage
   for this to mean anything; media.css documents the same constraint.

   Floored to the same 2dp the written value is rounded to, so rounding can
   never nudge a clamped drift back out past the edge it was clamped to. */
function driftCeiling(img) {
  const declared = img && parseFloat(getComputedStyle(img).getPropertyValue('--overhang'));
  const overhang = Number.isFinite(declared) ? declared : GAL_OVERHANG_FALLBACK;
  return Math.floor((overhang / (100 + 2 * overhang)) * 100 * 100) / 100;
}

/* ---------- Gallery (loop + parallax + pin), scrub-driven ----------

   COORDINATE SYSTEMS. Five of them, and the whole point of this class is that
   they stay five. Each has exactly one owner, one renderer, and one direction
   of dependency — nothing downstream is ever fed back upstream:

     loopTop         the slide's pure position in the infinite loop, in
                     viewport space with the arrival translation removed.
                     = pinned stage top + static layout offset + loop travel.
                     Owned by the loop timeline (which renders it as the
                     slide's yPercent). Never contains parallax or drift.

     parallaxOffset  the per-slide depth offset, derived FROM loopTop.
                     Rendered as the slide's own y. Output only: nothing is
                     ever derived from it, which is what makes the render pass
                     idempotent and keeps per-frame error from accumulating.

     arrivalY        the whole column's eased rise from below the fold.
                     Rendered as the TRACK's y — one transform for twelve
                     slides, and deliberately outside the parallax factor so a
                     factor of ±0.3 can never multiply the arrival distance
                     and splay the column apart while it rises in.

     screenTop       loopTop + parallaxOffset + arrivalY. What the reader
                     actually sees, and the only coordinate visibility and
                     image drift are allowed to read.

     imageDrift      derived from screenTop, written as a CSS custom property
                     that the image's own CSS transform composes. Never
                     touches slide position.

   TRANSFORM OWNERSHIP follows from that, one writer per element per property:

     .gallery__track          y        -> arrival (this class)
     .gallery__slide          yPercent -> loop position (verticalLoop timeline)
                              y        -> parallaxOffset (this class)
     .gallery__img-wrapper    y, alpha -> reveal (Reveal, and Flip on card open)
     .gallery__img-wrapper img --drift -> image drift (CSS composes it)

   STATE IS THE SOURCE OF TRUTH. The render pass reads the DOM for exactly two
   things it does not own — where ScrollTrigger has put the pinned stage, and
   how big the viewport is — and takes them once per frame, before any write.
   It never measures a slide to recover a position it applied itself. */

class Gallery {
  constructor(section, slides, reveal) {
    this.section = section;
    this.slides = slides;
    this.reveal = reveal;
    this.LAPS = 1; // one full loop across the pinned distance
    this.INERTIA_TAU = 0.35; // weight of the coast — bigger = heavier/slower to catch up
    this.ENTER = 0.12; // share of the pinned distance spent arriving from below the fold
    this.track = section.querySelector('.gallery__track');

    // Arrival, as state: the target the pin sets, and the eased value actually
    // rendered. Kept apart from the loop's own coordinate system throughout.
    this.arrivalRemaining = 1; // 1 = fully below the fold, 0 = home
    this.arrivalY = window.innerHeight; // px, the eased value the track holds
    this.setArrivalY = gsap.quickSetter(this.track, 'y', 'px');
    // Parked below the fold before the pin ever engages, so there's no flash
    // of the column sitting at rest before the first scroll tick moves it.
    this.setArrivalY(this.arrivalY);

    // The frame's DOM measurements, allocated once and overwritten in place —
    // readFrame() runs every tick and this is the hot path (see readFrame).
    this.frame = { vh: window.innerHeight, trackTop: 0 };

    this.createLoop();
    this.createSlideState();
    this.createScrub();
    this.createPin();
    this.bindResize();
  }

  createLoop() {
    const gap = parseFloat(getComputedStyle(this.track).rowGap) || 0;
    this.loop = verticalLoop(this.slides, { repeat: -1, paused: true, paddingBottom: gap });
    this.wrap = gsap.utils.wrap(0, this.loop.duration());
  }

  /* One state object per slide — everything the render pass needs, so it never
     queries the DOM and never reads back its own transforms. Every field is
     initialised here rather than left undefined, so the first render has no
     special case: it is the same pass as the ten-thousandth. */
  createSlideState() {
    const speeds = [1.3, 0.8, 1.15, 0.7, 1.25, 0.85];
    this.slideState = this.slides.map((el, i) => {
      // Bound once. renderSlides() runs every tick, so neither the element
      // lookup nor GSAP's target resolution belongs inside it.
      const prop = gsap.getProperty(el);
      return {
        el,
        img: el.querySelector('.gallery__img-wrapper img'),
        factor: speeds[i % speeds.length] - 1,

        // Measured geometry, refreshed by measure().
        layoutTop: 0, // static offset within the track, before any transform
        height: 0,

        // State. See the coordinate-system map above for what each one means;
        // the names are the contract.
        loopTop: 0,
        parallaxOffset: 0,
        screenTop: 0,
        visible: false, // committed — reveal only ever hears about changes
        drift: null, // last value written to --drift; null = never written

        // Per-frame scratch: CALCULATE writes it, WRITE commits it into
        // `visible`. Held on the item so the hot loop allocates nothing.
        nextVisible: false,

        /* Loop position is read from GSAP's in-memory transform cache, not from
           the DOM: the timeline is the loop's source of truth, and asking it
           what it just rendered costs a property lookup and forces no layout.
           Deliberately NOT recomputed from verticalLoop's own maths — that
           would be a second source of truth for the same value. */
        loopYPercent: () => prop('yPercent'),

        // quickSetter, not gsap.set(): a tween object per slide per frame is
        // pure churn for a value we already know. Composes with the loop's
        // yPercent and the CSS --stagger x, which live in the same cache.
        setY: gsap.quickSetter(el, 'y', 'px'),
      };
    });

    // main.css is a blocking <link> (see index.html), so the overhang is
    // resolvable by the time this runs.
    const ceiling = driftCeiling(this.slideState[0]?.img);
    this.clampDrift = gsap.utils.clamp(-ceiling, ceiling);

    this.measure();
    this.refresh();
  }

  /* The two geometry sources are deliberately different, and the reason is not
     obvious enough to leave implicit:

     layoutTop <- offsetTop. Pure layout, so the transforms this class writes
     cannot pollute it, which is what lets measure() run at any moment — even
     mid-resize with the loop in flight — rather than only while the slides sit
     at identity. It is also the exact basis verticalLoop() measures on. It
     rounds to whole pixels, and that is fine: it is ADDED once.

     height <- rect.height. Sub-pixel, because height is MULTIPLIED: the
     browser resolves the loop's yPercent against the element's real fractional
     height, and yPercent reaches ±1600% by the far end of the column. Rounding
     here would therefore land ~16x amplified — up to 8px of phantom loop
     travel. Measured, this drops loopTop's worst-case error from 8.06px to
     0.49px. The cost is that rect.height would include a scale on the slide,
     so: nothing may ever scale .gallery__slide (see the transform-ownership
     map above — the reveal and Flip both work on the wrapper inside it). */
  measure() {
    this.trackOffsetTop = this.track.offsetTop; // track within .gallery
    for (const item of this.slideState) {
      item.layoutTop = item.el.offsetTop; // slide within .gallery__track
      item.height = item.el.getBoundingClientRect().height;
    }
  }

  /* READ — the frame's only DOM measurement, and the only one there is: where
     ScrollTrigger has put the pinned stage, and how tall the viewport is.
     Neither is ours to own; everything else the render pass needs is state.
     Called before any write in the tick, so no write below it can turn a later
     read into a forced synchronous layout. */
  readFrame() {
    this.frame.vh = window.innerHeight;
    this.frame.trackTop = this.section.getBoundingClientRect().top + this.trackOffsetTop;
  }

  /* Cold path — initialisation and rebuild, where no frame is in flight. The
     per-tick path splits these two deliberately (see _tick); these callers
     have nothing to interleave with, so they read and render in one call. */
  refresh(immediate = false) {
    this.readFrame();
    this.renderSlides(immediate);
  }

  /* CALCULATE, then WRITE. Precondition: readFrame() has already run for this
     frame — _tick guarantees it, refresh() is the safe entry for anyone else.

     Two passes over twelve items rather than one fused pass, so the phases are
     literal and not merely intended: nothing in the first pass touches the
     DOM, and nothing in the second recomputes. Both write into the state
     objects, so neither allocates.

     `immediate` is forwarded to Reveal.toggle() untouched — true snaps
     on-screen slides straight to their revealed state instead of replaying the
     rise-and-stagger. Only rebuild() passes it: a resize must not read as
     twelve fresh arrivals. */
  renderSlides(immediate = false) {
    const { vh, trackTop } = this.frame;

    // ---------- CALCULATE — state in, state out, no DOM ----------
    for (const item of this.slideState) {
      // Pure loop position, composed from measured geometry and the loop's own
      // rendered travel. Nothing our own render pass wrote is read back here,
      // so a frame's rounding cannot leak into the next one and accumulate.
      item.loopTop = trackTop + item.layoutTop + (item.loopYPercent() / 100) * item.height;

      // Derived from the PURE position — which is the whole reason loopTop is
      // kept clean. Multiply arrivalY by factor and the column splays apart as
      // it rises in; multiply drift into it and the frame chases the picture.
      item.parallaxOffset = item.factor * (item.loopTop + item.height);

      // Arrival folded back in only now, unscaled. This is the visible one.
      item.screenTop = item.loopTop + item.parallaxOffset + this.arrivalY;
      item.nextVisible = item.screenTop < vh && item.screenTop + item.height > 0;
    }

    // ---------- WRITE ----------
    let changes = null; // allocated only when visibility actually changes
    for (const item of this.slideState) {
      item.setY(item.parallaxOffset);

      /* Drift reads screenTop, not loopTop, and that is the correct space for
         it: the effect is a photograph lagging inside a frame that is CROSSING
         THE VIEWPORT, so it has to answer to where the frame actually is —
         arrival and parallax included — not to where the loop alone would put
         it. Driving it from loopTop instead would hold the picture still while
         the column visibly rose past it during arrival.

         Skipped while off-screen: an invisible image drifting is eight style
         invalidations a frame that nothing can see. Safe to skip because the
         frame a slide becomes visible in is also a frame this writes. */
      if (item.img && item.nextVisible) {
        const norm = (item.screenTop + item.height / 2 - vh / 2) / vh;
        // Clamped to what the CSS overhang can hide. Only bites while a slide
        // is part-way off an edge, where the raw ramp overshoots the mask.
        const drift = Math.round(this.clampDrift(-norm * 2 * GAL_DRIFT) * 100) / 100;
        if (drift !== item.drift) {
          item.drift = drift;
          item.img.style.setProperty('--drift', `${drift}%`);
        }
      }

      // Reveal hears about edges, never states — anything else would restart
      // the entrance on every tick a slide spent on screen.
      if (item.nextVisible !== item.visible) {
        item.visible = item.nextVisible;
        changes ??= [];
        changes.push({ el: item.el, visible: item.visible, top: item.screenTop });
      }
    }

    if (changes) this.reveal.toggle(changes, immediate);
  }

  /** An eased "playhead" the loop is actually driven from — this, not
      ScrollTrigger's own scrub, is what gives the gallery real inertia.
      Every scroll update just retargets it; it keeps easing toward that
      target on its own per-tick clock (gsap.ticker, not a raw scroll
      listener), so a burst of scroll input keeps gliding for a beat
      rather than the loop snapping 1:1 to raw scroll position — the
      "weight" the reference tutorial's wheel-driven scrub proxy has,
      adapted for native page scroll instead of a hijacked wheel event. */
  createScrub() {
    this.target = 0;
    this.playhead = 0;
    this._tick = (time, deltaMs) => {
      // Gate on the pin actually being engaged — the ticker runs for the
      // gallery's whole lifetime (including before its pin ever starts), and
      // trackTop is the stage's REAL viewport position, so without this a
      // slide already overlapping the viewport pre-pin (e.g. during the blank
      // hold just above the gallery) would reveal early.
      if (!this.st?.isActive) return;

      // READ — every DOM measurement for the frame, taken before the first
      // write so that none of the writes below can force a layout.
      this.readFrame();

      // CALCULATE — advance the two eased values on their own per-tick clock.
      // Both are pure state; neither is read back off the DOM next frame.
      const dt = Math.min(deltaMs / 1000, 0.05);
      const follow = 1 - Math.exp(-dt / this.INERTIA_TAU);
      this.playhead += (this.target - this.playhead) * follow;
      this.arrivalY += (this.arrivalRemaining * this.frame.vh - this.arrivalY) * follow;

      // WRITE — arrival on the track, then the loop timeline (which renders
      // the slides' yPercent), then everything derived from both. No DOM read
      // follows, which is what keeps this frame free of a sync layout.
      this.setArrivalY(this.arrivalY);
      this.loop.time(this.wrap(this.playhead));
      this.renderSlides();
    };
    gsap.ticker.add(this._tick);
  }

  createPin() {
    this.st = ScrollTrigger.create({
      trigger: this.section,
      start: 'top top',
      end: '+=300%',
      pin: true,
      pinSpacing: true,
      scrub: true, // raw — inertia comes from the playhead above, not a second smoothing layer stacked on this
      onUpdate: (self) => {
        const p = self.progress;
        // Arrival owns the first ENTER of the pin; the loop is frozen until the
        // column has actually reached the screen, so it always enters from the
        // bottom rather than mid-cycle.
        const e = Math.min(p / this.ENTER, 1);
        this.arrivalRemaining = Math.pow(1 - e, 3); // easeOutCubic, as remaining distance
        const lp = Math.max((p - this.ENTER) / (1 - this.ENTER), 0);
        this.target = lp * this.LAPS * this.loop.duration();
      },
      onLeaveBack: () => this.reset(),
    });
  }

  // Scrolled back up out of the gallery: hide every slide so the reveal
  // replays on the next entry (onUpdate does not fire above the pin start),
  // and park the track back below the fold so scrolling down into the pin
  // again arrives fresh from the bottom instead of resuming mid-flight.
  reset() {
    for (const item of this.slideState) item.visible = false;
    this.slides.forEach((slide) => this.reveal.hide(slide));
    this.arrivalRemaining = 1;
    this.arrivalY = window.innerHeight;
    this.setArrivalY(this.arrivalY);
  }

  bindResize() {
    let id;
    window.addEventListener('resize', () => {
      // Leading edge: slide heights are width-derived (aspect-ratio), so
      // re-measure immediately rather than letting state describe the
      // pre-resize layout for the whole debounce window. Cheap next to the
      // debounced rebuild() below — geometry only, no loop teardown.
      this.measure();
      clearTimeout(id);
      id = setTimeout(() => this.rebuild(), 200);
    });
  }

  rebuild() {
    const progress = this.loop.progress();
    this.loop.kill();
    gsap.set(this.slides, { clearProps: 'transform' });
    this.createLoop();
    // verticalLoop() re-measures each slide's offsetTop; re-assert the track's
    // own transform so the arrival offset stays present and unchanged across
    // that (clearProps above only ever targeted the slides, not the track).
    this.setArrivalY(this.arrivalY);
    this.loop.progress(progress, true);
    // Resync the playhead to the rebuilt loop's timing so the eased
    // follow doesn't glide from a stale pre-resize value.
    const t = progress * this.loop.duration();
    this.playhead = t;
    this.target = t;
    // clearProps above zeroed every slide's y, so mirror that in state instead
    // of leaving a parallaxOffset that no longer describes the DOM. Hygiene,
    // not correctness — and that is exactly the point. The old architecture
    // NEEDED this line, because the next frame measured a rect and subtracted
    // this value back out of it; now nothing is derived from it at all.
    for (const item of this.slideState) item.parallaxOffset = 0;
    this.measure();
    this.refresh(true); // snap on-screen slides, don't replay
    if (this.st) this.st.refresh();
  }
}

/* ---------- mobile gallery (no loop, no pin) ----------
   On narrow viewports the infinite scroll is replaced by a plain vertical
   stack that the reader scrolls through naturally. Each slide still gets the
   reveal entrance and the per-image parallax drift — only the recycling loop
   and the pinned scrub are dropped, so the gallery lives in normal document
   flow. */

function initMobileGallery(section, slides) {
  const firstImg = slides[0]?.querySelector('.gallery__img-wrapper img');
  const ceiling = driftCeiling(firstImg);
  const clamp = gsap.utils.clamp(-ceiling, ceiling);
  const opacityRamp = gsap.utils.clamp(0, 1);

  slides.forEach((slide) => {
    const wrapper = slide.querySelector('.gallery__img-wrapper');
    const img = slide.querySelector('.gallery__img-wrapper img');
    const chars = splitChars(slide.querySelector('figcaption'));

    gsap.set(wrapper, { autoAlpha: 0 });
    gsap.set(chars, { autoAlpha: 0 });

    ScrollTrigger.create({
      trigger: slide,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const p = self.progress;
        // Fade in: 0 opacity until 8% progress, full opacity at 28%.
        // Fade out: full until 75%, gone by 92%.
        const fadeIn = opacityRamp((p - 0.08) / 0.2);
        const fadeOut = opacityRamp((0.92 - p) / 0.17);
        const alpha = Math.min(fadeIn, fadeOut);

        gsap.set(wrapper, { autoAlpha: alpha });
        gsap.set(chars, { autoAlpha: alpha });

        if (!img) return;
        const norm = p - 0.5;
        const drift = Math.round(clamp(-norm * 2 * GAL_DRIFT) * 100) / 100;
        img.style.setProperty('--drift', `${drift}%`);
      },
    });
  });
}

/* ---------- init ---------- */

/** Click / tap / Enter / Space -> Flip card. Used by the animated AND the
    reduced-motion path: buildSlides() gives every slide role="button",
    tabindex and an aria-label, so the affordance has to lead somewhere in
    both. Reduced motion softens the morph (see components/project-card) rather than
    removing the detail view. */
function wireCard(slides) {
  const card = new Card();
  card.setSlides(slides);

  slides.forEach((slide, index) => {
    const activate = () => {
      if (card.state !== 'closed') return; // guards double-clicks / rapid-fire
      card.open(slide, index, projects[index]);
    };
    slide.addEventListener('click', activate);
    slide.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });

  return card;
}

/** No Flip plugin — take the button affordance back off rather than leaving
    twelve focusable controls that answer to nothing. */
function stripSlideAffordances(slides) {
  slides.forEach((slide) => {
    slide.removeAttribute('role');
    slide.removeAttribute('tabindex');
    slide.removeAttribute('aria-label');
    slide.style.cursor = 'default';
  });
}

export function initGallery() {
  const section = document.querySelector('[data-gallery]');
  if (!section) return null;
  const track = section.querySelector('.gallery__track');
  if (!track) return null;

  const slides = buildSlides(track);
  const canCard = Boolean(gsap && Flip);

  // Reduced motion / no GSAP: show a plain static column, no loop. The card
  // still opens on demand.
  if (reduced || !gsap || !ScrollTrigger) {
    if (gsap) gsap.set(section.querySelectorAll('.gallery__img-wrapper'), { autoAlpha: 1 });
    if (canCard) wireCard(slides);
    else stripSlideAffordances(slides);
    return null;
  }

  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  if (isMobile) {
    initMobileGallery(section, slides);
    if (canCard) wireCard(slides);
    else stripSlideAffordances(slides);
    return null;
  }

  const reveal = new Reveal(slides);
  const gallery = new Gallery(section, slides, reveal);

  // Click/tap/Enter/Space opens the Flip detail card. No slide
  // opens itself; every card view is a deliberate action.
  if (canCard) {
    wireCard(slides);
  } else {
    stripSlideAffordances(slides);
  }

  return gallery;
}

export default initGallery;
