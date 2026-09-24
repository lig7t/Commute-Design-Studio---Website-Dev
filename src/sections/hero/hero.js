/* ============================================================
   hero.js — the reel, its hand-off, and the interiors transition.

   The stage pins; scroll first turns the reel, then flattens it and
   slides the interiors section in from the left. The effect is one
   continuous viewport that transforms between hero and work.

   Every timing constant lives in hero.config.js, in two pacings — desktop and
   mobile. mountReel() resolves exactly one of them at mount and binds it to a
   local; nothing below the top of that function branches on viewport.

   closeSeam() lives here too: it depends on the pin this module creates
   and must run before the gallery builds its own pin.
   ============================================================ */

import { gsap, ScrollTrigger, hasGsap, reduced } from '../../lib/motion.js';
import { DRIFT } from '../../lib/config.js';
import { splitWords } from '../../lib/text.js';
import { getTheme, onThemeChange } from '../../lib/theme.js';
import { createReel } from './hero-reel.js';
import {
  HERO_REEL_IDS,
  MOBILE_QUERY,
  PIN,
  MOBILE_PIN,
  TIMELINE,
  MOBILE_TIMELINE,
  SETTLE_DRIFT_PX,
  IMG_DRIFT,
  MOBILE_IMG_DRIFT,
} from './hero.config.js';

export function pickHeroFrames(works) {
  if (!works.length) return works;
  const byId = new Map(works.map((w) => [w.id, w]));
  const picked = HERO_REEL_IDS.map((id) => byId.get(id)).filter(Boolean);
  const frames = picked.length ? picked : works.slice(0, 10);
  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  return mobile ? frames.slice(0, 3) : frames;
}

/* Deterministic seeded PRNG (mulberry32). The interiors exit uses this so
   every element scatters on the same trajectory on every visit — not a
   fresh Math.random() per render. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function mountReel(works) {
  const canvas = document.querySelector('[data-reel-canvas]');
  const stage = document.querySelector('.stage');
  const heroEl = document.querySelector('.hero');
  const workEl = document.querySelector('.work');
  if (!canvas || !stage || !works.length) return null;

  // Resolve the pacing ONCE, here, and bind it to locals the onUpdate closes
  // over. The per-tick body must never branch on viewport or call matchMedia:
  // a media query evaluated per frame is both a needless cost and a source of
  // a mid-scroll discontinuity, since a rotation or a resize would swap
  // timelines underneath a progress value that was scrubbed against the other
  // one. Resizing across the breakpoint re-paces on the next mount, not
  // mid-pin — the same coarse behaviour pickHeroFrames() already has for the
  // reel's frame count, which reads the same MOBILE_QUERY.
  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  const timeline = mobile ? MOBILE_TIMELINE : TIMELINE;
  const pinCfg = mobile ? MOBILE_PIN : PIN;
  const imgDrift = mobile ? MOBILE_IMG_DRIFT : IMG_DRIFT;

  const reel = createReel({
    canvas,
    frames: works,
    motion: !reduced,
    onIndex: (i) => {
      const out = document.querySelector('[data-reel-index]');
      if (out) out.textContent = String(i + 1).padStart(2, '0');
    },
  });

  if (!reel) return null;
  canvas.closest('[data-reel]')?.setAttribute('data-reel', 'live');

  // Subscribe rather than letting theme.js reach in here — the reel's fog
  // follows the surface, and this direction is what keeps the two modules
  // acyclic.
  reel.setTheme(getTheme());
  onThemeChange((theme) => reel.setTheme(theme));

  if (reduced || !hasGsap) {
    reel.setProgress(0.06);
    reel.freeze();
    if (workEl) gsap?.set(workEl, { x: 0, opacity: 1 });
    return null;
  }

  const heroType = heroEl?.querySelector('.hero__type');
  const heroReg = heroEl?.querySelector('.hero__reg');
  const heroFade = [heroType, heroReg].filter(Boolean);
  const workItems = workEl ? [...workEl.querySelectorAll('[data-in]')] : [];
  const N = workItems.length;

  // Interiors photographs — these carry a bare data-parallax (no
  // value; see index.html) precisely so mountParallax() leaves them
  // alone and this pin drives them instead, off the same already-smoothed
  // `p` as everything else here. A seeded factor per image (reusing
  // mulberry32 with its own offset, distinct from the scatter trajectory's)
  // keeps the four from drifting as one plate: 0.6–1.0 magnitude, sign
  // alternating on odd indices.
  const workImgs = workEl ? [...workEl.querySelectorAll('.ds-media img[data-parallax]')] : [];
  const imgFactor = workImgs.map((_, i) => {
    const rnd = mulberry32((i + 1) * 0x2545f491);
    const factor = 0.6 + rnd() * 0.4;
    return i % 2 ? -factor : factor;
  });

  // Word stagger — split once, up front, into a Map so the
  // onUpdate loop below never re-queries or re-splits. splitWords()
  // preserves the <br> inside .work__title (it only ever touches text
  // nodes; see text.js), so the two-line headline still breaks correctly.
  const splitItems = new Map(
    ['.ds-meta', '.work__title']
      .map((sel) => workEl?.querySelector(sel))
      .filter(Boolean)
      .map((el) => [el, splitWords(el)]),
  );

  // Every hero element fades IN on load (rather than popping in on paint),
  // then fades OUT together as the transition into interiors begins.
  // Held so the scroll handler can kill it: the intro tween and the pin's
  // onUpdate both write opacity on these same nodes, and a reader who starts
  // scrolling inside the first second would otherwise see the intro tween
  // overwrite the scroll-driven fade on every tick.
  const heroIntro = gsap.from(heroFade, {
    opacity: 0,
    y: 16,
    duration: 1,
    ease: 'power3.out',
    stagger: 0.08,
    delay: 0.15,
  });

  // The exit — a deterministic seeded trajectory per element, stored as
  // viewport-relative vectors and resolved to px per frame (so a resize needs
  // no recompute). On the desktop pacing reveal owns 60→78% of the pin and the
  // scatter owns 78→~97%, finishing early rather than at 1.0 so scrub's lag
  // can't leave debris mid-flight once the gallery's pin occludes the stage
  // (see closeSeam()).
  //
  // `stag` scales the item's index by timeline.scatterStagger rather than by a
  // constant here: the last item's window is scatterBase + scatterStagger →
  // + scatterSpan, so the reach is one of the three terms that decide whether
  // the exit finishes inside the pin. A literal in this file would leave that
  // sum unbalanceable from the pacing objects where the rest of it lives —
  // which is exactly how the mobile pacing came to overrun the end of its pin.
  // Both pacings verify to 0.97; the arithmetic is recorded on
  // TIMELINE/MOBILE_TIMELINE.scatterStagger in hero.config.js.
  const traj = workItems.map((el, i) => {
    const rnd = mulberry32((i + 1) * 0x9e3779b1);
    const angle = rnd() * Math.PI * 2;
    const reach = 0.75 + rnd() * 0.6; // 0.75–1.35 viewports out
    return {
      ax: Math.cos(angle) * reach,
      ay: Math.sin(angle) * reach,
      rot: (rnd() * 2 - 1) * (8 + rnd() * 12), // ±8–20°
      scale: 0.85 + rnd() * 0.25, // 0.85–1.10× — scale carries the depth cue
      stag: N > 1 ? (i / (N - 1)) * timeline.scatterStagger : 0, // debris, not a wipe
      // Once revealed, each item drifts toward its OWN scatter direction at a
      // small fraction of that trajectory — a whisper of depth while the
      // section is settled, before the scatter takes over.
      // A generic ScrollTrigger can't drive this (these elements sit inside
      // the pinned stage, where a normal scrub trigger reads a frozen rect
      // for the whole pin); this reuses the same already-smoothed `p`
      // everything else in this onUpdate reads, so it can't desync the way a
      // second independent scrub layer would.
      pFactor: 0.35 + rnd() * 0.35, // 0.35–0.70 of the seeded direction
    };
  });

  gsap.set(workEl, { xPercent: 100, opacity: 0 });
  workItems.forEach((el) => gsap.set(el, { opacity: 0, y: 24 }));

  const stageST = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: pinCfg.end,
    pin: true,
    pinSpacing: true,
    scrub: pinCfg.scrub,
    onUpdate: (self) => {
      const p = self.progress;
      const vw = window.innerWidth,
        vh = window.innerHeight;

      // Hand opacity control to the scroll the moment the reader moves.
      if (p > 0.001 && heroIntro.isActive()) heroIntro.kill();

      // Reel plays, then flattens into a band.
      reel.setProgress(Math.min(p / timeline.reelPlayEnd, 1) * 0.5);
      reel.setFlat(
        p < timeline.reelPlayEnd
          ? 0
          : Math.min((p - timeline.reelPlayEnd) / timeline.flattenSpan, 1),
      );

      // Hero elements fade up and disappear together, led into by a slow
      // pre-drift so the two hand off with no discontinuity (see the note on
      // heroPreDrift in hero.config.js).
      if (heroFade.length) {
        const t =
          p < timeline.heroFadeStart
            ? 0
            : Math.min((p - timeline.heroFadeStart) / timeline.heroFadeSpan, 1);
        const pre = Math.min(p / timeline.heroFadeStart, 1) * timeline.heroPreDrift;
        if (heroType) gsap.set(heroType, { opacity: 1 - t, y: pre + t * timeline.heroExitDrift });
        if (heroReg) gsap.set(heroReg, { opacity: 1 - t });
      }

      // Canvas fades out, interiors slides in from the right.
      const trans =
        p < timeline.transitionStart
          ? 0
          : Math.min((p - timeline.transitionStart) / timeline.transitionSpan, 1);
      gsap.set(canvas, { opacity: 1 - trans });
      gsap.set(workEl, { xPercent: 100 - trans * 100, opacity: trans });

      // Interiors items reveal with a stagger, then each flies apart on its
      // own seeded trajectory.
      workItems.forEach((el, i) => {
        const tr = traj[i];
        if (p < timeline.scatterBase) {
          // Small enough that even the last item's reveal window
          // (revealStart + revealSpan) safely lands before scatterBase —
          // otherwise its scatter branch takes over before its OWN reveal
          // finishes, snapping opacity/position rather than continuing
          // from wherever the reveal had actually gotten to. The arithmetic is
          // verified per pacing where the numbers live — see the notes on
          // TIMELINE/MOBILE_TIMELINE.revealStagger in hero.config.js.
          const revealStart = timeline.revealStart + i * timeline.revealStagger;
          const revealSpan = timeline.revealSpan;
          const t = p < revealStart ? 0 : Math.min((p - revealStart) / revealSpan, 1);
          const eased = 1 - Math.pow(1 - t, 3);

          // Once revealed, drift toward the item's own eventual scatter
          // direction at a small fraction of it — settles to exactly the
          // scatter branch's own starting offset (see settleFade below),
          // so there's no snap at the handoff between the two branches.
          const settleWindow = Math.max(timeline.scatterBase - (revealStart + revealSpan), 0.001);
          const settleT = Math.min(Math.max((p - (revealStart + revealSpan)) / settleWindow, 0), 1);
          const driftX = tr.ax * SETTLE_DRIFT_PX * tr.pFactor * settleT;
          const driftY = tr.ay * SETTLE_DRIFT_PX * tr.pFactor * settleT;

          const words = splitItems.get(el);
          if (words) {
            // Split items carry their fade and rise on the WORDS,
            // never the element — the element only ever gets opacity 1 and
            // the settle drift's own y. Applying `eased` opacity or the 24px
            // rise here too would double the motion and multiply the two
            // opacities into a mushy fade instead of one clean one (the same
            // rule reveal.js already follows for split headlines elsewhere
            // on the page).
            gsap.set(el, { opacity: 1, x: driftX, y: driftY, rotation: 0, scale: 1 });

            // Each word reveals over its own sub-window of this item's t
            // (raw, not eased) — SPREAD is the share of the item's reveal
            // spent staggering across the words, so the whole word set still
            // finishes exactly when the item's own reveal does.
            const SPREAD = 0.5;
            const total = words.length;
            words.forEach((word, j) => {
              const frac = total > 1 ? j / (total - 1) : 0;
              const wt = Math.min(Math.max((t - frac * SPREAD) / (1 - SPREAD), 0), 1);
              const we = 1 - Math.pow(1 - wt, 3);
              gsap.set(word, { opacity: we, y: 24 * (1 - we) });
            });
          } else {
            gsap.set(el, {
              opacity: eased,
              x: driftX,
              y: 24 * (1 - eased) + driftY,
              rotation: 0,
              scale: 1,
            });
          }
        } else {
          const s = Math.min(
            Math.max((p - timeline.scatterBase - tr.stag) / timeline.scatterSpan, 0),
            1,
          );
          const e = s * s * s;
          const settleFade = 1 - e; // the settle-drift's own offset, fading out as the scatter's much larger motion takes over
          gsap.set(el, {
            x: tr.ax * vw * e + tr.ax * SETTLE_DRIFT_PX * tr.pFactor * settleFade,
            y: tr.ay * vh * e + tr.ay * SETTLE_DRIFT_PX * tr.pFactor * settleFade,
            rotation: tr.rot * e,
            scale: 1 + (tr.scale - 1) * e,
            opacity: 1 - e,
            force3D: true,
          });
        }
      });

      // Interiors photographs: additive to the settle drift and
      // fly-apart above — the FRAME travels (workItems' own x/y), and the
      // PHOTOGRAPH moves independently inside it, over the window where the
      // interiors are actually on screen. Reuses this same smoothed `p`
      // rather than a second ScrollTrigger, for the same reason the settle
      // drift above does — no second scrub layer to desync from this one.
      if (workImgs.length) {
        const tp = Math.min(Math.max((p - imgDrift.start) / imgDrift.span, 0), 1);
        workImgs.forEach((img, i) => {
          img.style.setProperty('--drift', `${(1 - 2 * tp) * DRIFT * imgFactor[i]}%`);
        });
      }
    },
  });

  return stageST;
}

/* ---------- the seam ----------
   The stage's pin-spacer reserves its scroll distance PLUS its own 100svh,
   so once the fly-apart finishes there is a full leftover viewport of plain
   scroll before the gallery's own pin can engage — the blank hold that read
   as the page stalling between the two sections.

   Measured rather than hardcoded: `+=500%` resolves against innerHeight
   while .stage is sized in svh, and on mobile those are different numbers,
   so a static -100svh in CSS closes the gap on desktop and misses on phones.

   Must run BEFORE initGallery() builds the gallery's pin. After that the
   element lives inside a pin-spacer that owns its margins, and writing
   marginTop on the element itself would push it around inside the spacer
   instead of moving where the pin starts. */
export function closeSeam(stageST) {
  const el = document.querySelector('.gallery');
  if (!stageST || !el) return;
  const top = el.getBoundingClientRect().top + window.scrollY; // where its pin will start
  const gap = top - stageST.end;
  if (gap <= 2) return;
  const current = parseFloat(getComputedStyle(el).marginTop) || 0;
  el.style.marginTop = `${current - gap}px`;
}

/** The scroll position at which the interiors are settled on screen.

    WHY THIS IS NOT JUST `#work`'s OFFSET. `.work` is position:absolute inset:0
    inside the pinned .stage, so its document offset is 0 — an anchor jump to
    `#work` lands on the hero, not on the interiors. The interiors are not at a
    place in the document at all; they are at a PROGRESS through the stage pin,
    driven by that pin's onUpdate. So the only honest answer is to convert the
    beat back into a scroll position using the pin's own measured range.

    0.92 of the way through the slide-in rather than all of it: the transition
    completes exactly at scatterBase on desktop (0.55 + 0.23 = 0.78 =
    scatterBase), so landing on completion lands on the frame the section starts
    flying apart. Stopping just short puts the reader on settled interiors in
    both pacings — mobile's 0.7 + 0.15 * 0.92 = 0.838, comfortably below its
    own scatterBase of 0.88.

    Reads the pin's live start/end rather than recomputing from PIN.end, because
    the pin's real range is what ScrollTrigger measured after closeSeam() and
    any refresh — restating '+=500%' here would be a second opinion about it. */
export function interiorsScrollY(stageST) {
  if (!stageST) return 0;
  const mobile = window.matchMedia(MOBILE_QUERY).matches;
  const timeline = mobile ? MOBILE_TIMELINE : TIMELINE;
  const span = stageST.end - stageST.start;
  const settled = timeline.transitionStart + timeline.transitionSpan * 0.92;
  return Math.round(stageST.start + settled * span);
}
