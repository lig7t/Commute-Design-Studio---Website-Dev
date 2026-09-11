/* ============================================================
   hero.config.js — the tuning surface for the pinned hero sequence.

   Every number the choreography is timed against lives here so the
   sequence can be re-paced without reading the maths in hero.js.

   TIMELINE values are fractions of the pin's own progress (0 → 1) and are
   ordered as they occur. They overlap on purpose: the hero type starts
   leaving (heroFade) while the reel is still flattening, and the interiors
   begin arriving before the type has finished going. Changing one boundary
   without checking its neighbour is how the sequence develops a visible seam.
   ============================================================ */

/** A curated subset, not the whole pool: six frames spread across the
    library give the reel a deliberate pace, and keep it independent of both
    the full works manifest and the gallery's project list. */
export const HERO_REEL_IDS = ['003', '011', '025', '043', '065', '073'];

export const PIN = {
  end: '+=500%',
  // A full second of catch-up reads as the page running behind the wheel
  // rather than as weight. 0.5 keeps the smoothing while letting the
  // sequence track the gesture.
  scrub: 0.5,
};

export const TIMELINE = {
  reelPlayEnd: 0.45, // reel turns from 0 to here
  flattenSpan: 0.17, // then straightens into a band over this much

  heroFadeStart: 0.38, // wordmark begins leaving
  heroFadeSpan: 0.17,
  // The two drifts hand off with no discontinuity: at heroFadeStart the exit
  // has travelled 0 and the pre-drift has travelled its full amount, so both
  // branches agree; by the end of the fade the total is preDrift + exitDrift.
  heroPreDrift: -40, // px the type drifts up before the exit proper begins
  heroExitDrift: -70, // px more, during the exit itself

  transitionStart: 0.55, // canvas out, interiors in from the right
  transitionSpan: 0.23,

  revealStart: 0.6, // interiors items begin arriving
  revealSpan: 0.14,
  revealStagger: 0.005, // per-item delay; small enough that the last item's
  // reveal still lands before scatterBase

  scatterBase: 0.78, // the section begins to fly apart
  scatterSpan: 0.11, // per-element, settled to gone
};

/** Settle-phase parallax amplitude, in px — small on purpose. */
export const SETTLE_DRIFT_PX = 14;

/** Window over which the interiors photographs drift inside their frames. */
export const IMG_DRIFT = { start: 0.55, span: 0.45 };
