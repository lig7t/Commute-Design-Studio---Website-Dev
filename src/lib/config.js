/* ============================================================
   config.js — the two constants that cross module boundaries.

   Everything else stays local to the module that owns it. These two
   do not, and duplicating them is how the reveal sweep and the
   parallax layer would silently drift apart.
   ============================================================ */

/* Containers that either run their own choreography or can never usefully
   reveal at all:
     .stage         — its content is driven by the pin's own choreography,
                       and a scrub trigger built inside a pin reads a frozen
                       rect anyway.
     [data-gallery] — has its own Reveal class (gallery.js).
     [data-card]    — the detail modal; project-card.js animates it on open.
     .ds-nav        — the fixed bar, always visible.
     .ds-skip       — the skip-to-content link, hidden until focused.
     .foot          — the footer row sits inside the final viewport, so it
                       can never cross a reveal threshold, and clamp()
                       collapses its end onto its start.

   Shared by reveal.js (which excludes these from the reveal sweep) and
   parallax.js (which excludes exactly the same set, for the same reasons). */
export const REVEAL_SKIP_CONTAINER =
  '.stage, [data-gallery], [data-card], .ds-nav, .ds-skip, .foot';

/* % of the image's own height that a masked .ds-media img[data-parallax]
   safely drifts — the most an 18.75%-rounded-to-18 overhang
   (design-system/elements/media.css) hides before exposing a mask edge.
   Shared because both in-flow images (parallax.js) and the four pin-driven
   interiors photographs (sections/hero/hero.js) work to that same ceiling. */
export const DRIFT = 18;
