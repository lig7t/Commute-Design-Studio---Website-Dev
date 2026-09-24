/* ============================================================
   hero.config.js — the tuning surface for the pinned hero sequence.

   Every number the choreography is timed against lives here so the
   sequence can be re-paced without reading the maths in hero.js.

   TIMELINE values are fractions of the pin's own progress (0 → 1) and are
   ordered as they occur. They overlap on purpose: the hero type starts
   leaving (heroFade) while the reel is still flattening, and the interiors
   begin arriving before the type has finished going. Changing one boundary
   without checking its neighbour is how the sequence develops a visible seam.

   ---- Two pacings, not one ----

   There are two complete sets of these numbers: PIN/TIMELINE/IMG_DRIFT for
   desktop, and MOBILE_PIN/MOBILE_TIMELINE/MOBILE_IMG_DRIFT for viewports
   matching MOBILE_QUERY. They are separate objects with the same key set
   rather than one set with mobile multipliers, because the beats do not
   scale together — the mobile re-pace lengthens two specific holds and
   leaves the rest roughly where they were.

   WHY mobile needs its own: on a phone the viewport shows one section at a
   time, with no neighbouring content in frame to carry the reader while a
   beat resolves. The same progress fraction that reads as a deliberate hold
   on desktop — where the next section is already partly visible and the eye
   has somewhere to go — reads as a wipe on a phone, because the thing being
   held is the ONLY thing on screen and it leaves before it has been read.
   So each beat needs more of the pin's scroll distance, and the pin itself
   is longer (+=520% vs +=500%) to pay for it.

   The two beats the mobile numbers deliberately lengthen:
     - the hero (wordmark + reel) holds as the primary thing in frame before
       it starts leaving: heroFadeStart moves 0.38 → 0.52,
     - the .work interiors sit settled and alone before they scatter: see
       the settled-window arithmetic recorded on MOBILE_TIMELINE.

   hero.js resolves ONE of each triple at mount and binds it to a local; the
   per-tick onUpdate never branches on viewport and never calls matchMedia.
   ============================================================ */

/** A curated subset, not the whole pool: six frames spread across the
    library give the reel a deliberate pace, and keep it independent of both
    the full works manifest and the gallery's project list. */
export const HERO_REEL_IDS = ['003', '011', '025', '043', '065', '073'];

/** The single definition of "mobile" for the hero sequence — both the reel's
    frame count and the pacing choice must agree on it. Two matchMedia strings
    that drift apart would give a phone the desktop pacing with the mobile
    3-frame reel, which plays out in half the scroll it was timed for. */
export const MOBILE_QUERY = '(max-width: 760px)';

export const PIN = {
  end: '+=500%',
  // A full second of catch-up reads as the page running behind the wheel
  // rather than as weight. 0.5 keeps the smoothing while letting the
  // sequence track the gesture.
  scrub: 0.5,
};

/** Mobile pin. Longer travel than desktop so the lengthened holds below buy
    real scroll distance rather than just a larger share of the same distance.
    scrub matches PIN.scrub deliberately: the smoothing is about how the page
    tracks the gesture, which is the same gesture on both viewports. */
export const MOBILE_PIN = {
  end: '+=520%',
  scrub: PIN.scrub,
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
  // Reach of the per-item scatter delay: item i of N waits
  // (i / (N - 1)) * scatterStagger, so the LAST item's window is
  // scatterBase + scatterStagger → + scatterSpan. That sum must land at or
  // below ~0.97, not 1.0: scrub lag means progress 1.0 is reached after the
  // wheel has already moved past the pin's end, so anything still in flight
  // at 1.0 is debris left on screen when the gallery's pin occludes the
  // stage (see closeSeam()).
  // verified: 0.78 + 0.08 + 0.11 = 0.97.
  scatterStagger: 0.08,
};

/** Mobile pacing. Same key set as TIMELINE — hero.js binds one or the other
    to a single local, so a missing key here is a NaN in the onUpdate, not a
    fallback to the desktop value. */
export const MOBILE_TIMELINE = {
  reelPlayEnd: 0.55, // reel turns for longer before flattening
  flattenSpan: 0.14,

  // The hero's exit is the first of the two beats this re-pace lengthens:
  // the wordmark + reel now hold as the primary thing in frame until 0.52
  // (desktop 0.38) before beginning to leave.
  heroFadeStart: 0.52,
  heroFadeSpan: 0.15,
  heroPreDrift: -40,
  heroExitDrift: -70,

  transitionStart: 0.7,
  transitionSpan: 0.15,

  revealStart: 0.72,
  revealSpan: 0.1,
  // Invariant (see TIMELINE.revealStagger): the LAST item's reveal window must
  // end before scatterBase, or that item's scatter branch takes over mid-reveal
  // and snaps its opacity/position instead of continuing from where the reveal
  // had got to. N = 6 [data-in] items in the .work section of index.html
  // (.ds-meta, .work__title, three .work__img figures, .work__right).
  // verified: 0.72 + 5*0.005 + 0.10 = 0.845 < 0.88.
  revealStagger: 0.005,

  // The settled window — the second beat this re-pace lengthens, and the
  // value to turn if the user asks for more (or less) of it. It is
  // scatterBase minus the last item's reveal end:
  //   verified: 0.88 - 0.845 = 0.035 of the pin (desktop: 0.78 - 0.765 = 0.015).
  // In scroll distance that is 0.035 × 520% ≈ 18% of a viewport against
  // desktop's 0.015 × 500% ≈ 8%, so the interiors still sit settled and alone
  // for ~2.4x as long as on desktop.
  //
  // scatterBase is bounded from BOTH sides and there is no slack left between
  // the bounds, which is why the settled window is 0.035 and not more:
  //   - below, by the reveal invariant above (must stay above 0.845),
  //   - above, by the end-margin invariant on TIMELINE.scatterStagger —
  //     scatterBase + scatterStagger + scatterSpan must land at/below ~0.97.
  //     verified: 0.88 + 0.03 + 0.06 = 0.97, matching desktop's margin exactly.
  // Raising scatterBase without paying for it out of scatterStagger or
  // scatterSpan pushes the last item's exit past the end of the pin, and it
  // is then still on screen, near-opaque, when the gallery's pin takes over.
  scatterBase: 0.88,
  // Shorter reach than desktop's 0.08 — the settled window is bought out of
  // this budget. 0.03 against a 0.06 span still means the last item starts
  // leaving only halfway through the first one's exit, so the section comes
  // apart as debris rather than as a single wipe.
  scatterStagger: 0.03,
  scatterSpan: 0.06,
};

/** Settle-phase parallax amplitude, in px — small on purpose. */
export const SETTLE_DRIFT_PX = 14;

/** Window over which the interiors photographs drift inside their frames. */
export const IMG_DRIFT = { start: 0.55, span: 0.45 };

/** Mobile equivalent — starts with the mobile transition (0.70, where the
    interiors actually arrive on screen) and runs to the end of the pin, so the
    photographs are never drifting while their frames are still off-stage. */
export const MOBILE_IMG_DRIFT = { start: 0.7, span: 0.3 };
