/* ============================================================
   parallax.js — scroll-linked depth.

   Masked images now drift by a percentage of their OWN rendered height
   (media.css's --drift, a <length-percentage>) and unmasked blocks
   drift by yPercent — both are percentages of the element's own box, so
   neither needs measuring or a resize recompute; only the text layer
   below still reads a px amount and converts it (see build()). Wrapped in
   gsap.matchMedia() so it reacts live to a prefers-reduced-motion change,
   not just a load-time snapshot.

   Scope note: content inside the pinned hero→interiors stage is still left
   out here — a normal scroll-scrub trigger built inside a pin reads a
   frozen bounding rect for the whole pinned range (verified — its progress
   reads a constant across the entire pin) and would never animate. That
   content isn't simply skipped, though: the four interiors photographs and
   the two split text items get their own pin-driven drift and word stagger
   inside sections/hero/hero.js's own onUpdate, reusing the same already-smoothed
   progress the rest of that sequence reads — the hero's static fallback
   strip lives in the same pin and never carries data-parallax at all (see
   index.html), so it needs no exclusion here beyond the container check.
   The gallery is excluded for a different reason: it runs its own per-tick
   drift off gsap.ticker (renderSlides() in gallery.js), not a
   ScrollTrigger scrub, so wiring it here would just be a second,
   independently-timed layer fighting the first.

   Must be built AFTER the stage + gallery pins exist: a trigger created
   before their pin-spacers are in the DOM computes start/end against a
   much shorter document than the final one, and a later
   ScrollTrigger.refresh() does not correct it, even called directly.
   Only rebuilding fixes it, so resize is handled the same way
   (kill + recreate) rather than by refreshing.
   ============================================================ */

import { gsap, hasGsap } from './motion.js';
import { REVEAL_SKIP_CONTAINER, DRIFT } from './config.js';

// Total px travel per text tier, converted to yPercent inside build() —
// the label rides furthest, body copy barely moves. First match wins per
// element (see the comment inside build()): a <p class="ds-meta"> would
// otherwise also match the bare `p` in the body-copy group below it.
const TEXT_DRIFT = [
  ['.ds-meta, .ds-micro', 100], // labels ride furthest
  ['.ds-display, .ds-headline, .ds-title', 60],
  ['.ds-body, p', 30], // body copy barely moves
];

export function mountParallax() {
  if (!hasGsap) return;

  let ctx = null;

  const build = () => {
    ctx?.revert();
    ctx = gsap.context(() => {
      // Same containers the reveal sweep excludes (REVEAL_SKIP_CONTAINER in
      // config.js): pinned content and the gallery drive their own motion
      // (see the scope note above), the card is closed off-screen, and the
      // nav/skip-link/footer either never move or can never scrub cleanly.
      const inFlow = (el) => !el.closest(REVEAL_SKIP_CONTAINER);

      /* ---------- masked images — .ds-media img[data-parallax], in-flow only ----------
         No measuring: --drift is a percentage of the image's own height
         (media.css), so one DRIFT value works at any container size. */
      for (const img of document.querySelectorAll('.ds-media img[data-parallax]')) {
        if (!inFlow(img)) continue; // the four interiors photographs are pin-driven in sections/hero/hero.js instead
        const container = img.closest('.ds-media');
        gsap.fromTo(
          img,
          { '--drift': `${DRIFT}%` },
          {
            '--drift': `${-DRIFT}%`,
            ease: 'none',
            scrollTrigger: {
              trigger: container,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.1,
            },
          },
        );
      }

      /* ---------- unmasked blocks — [data-parallax] elements that aren't masked images ----------
         e.g. .lighting__object (data-parallax="40"). yPercent is already a
         percentage of the element's own height, so again no measuring: a
         value of 40 means 40% of its own height of total travel, split
         +pct/2 to -pct/2 around rest. */
      for (const el of document.querySelectorAll('[data-parallax]')) {
        if (el.matches('.ds-media img') || !inFlow(el)) continue;
        const pct = parseFloat(el.dataset.parallax) || 15;
        gsap.fromTo(
          el,
          { yPercent: pct / 2 },
          {
            yPercent: -pct / 2,
            ease: 'none',
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
          },
        );
      }

      /* ---------- text layers — label rides furthest, body copy least ----------
         CRITICAL: yPercent, never y. reveal.js (the reveal system)
         writes x/y in px on these exact elements; GSAP composes y + yPercent
         into one matrix rather than one overwriting the other, so the two
         systems can only coexist if this one stays off the y property
         entirely. Writing y here would have the reveal and this parallax
         stomp on each other every tick instead. */
      const claimed = new Set();
      for (const [selector, px] of TEXT_DRIFT) {
        for (const el of document.querySelectorAll(selector)) {
          // First match wins; skip anything already handled by the two
          // image/block passes above, or sitting inside an excluded container.
          if (claimed.has(el) || el.hasAttribute('data-parallax') || !inFlow(el)) continue;
          claimed.add(el);
          // offsetHeight is read here, inside build(), which already reruns
          // on resize — so a layout change keeps this conversion correct
          // with no separate resize handling of its own.
          const half = (px / 2 / (el.offsetHeight || 1)) * 100;
          gsap.fromTo(
            el,
            { yPercent: half },
            {
              yPercent: -half,
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
            },
          );
        }
      }
    });
  };

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    build();
    let id;
    const onResize = () => {
      clearTimeout(id);
      id = setTimeout(build, 200);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      ctx?.revert();
    };
  });
}
