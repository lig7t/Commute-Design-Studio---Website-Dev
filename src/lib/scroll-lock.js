/* ============================================================
   scroll-lock.js — one owner for documentElement's overflow.

   WHY THIS EXISTS. Two features lock page scroll, and they can now be held at
   the same time: the mobile drawer locks while the menu is open, and the
   project card locks while a card is open. Before this module they each wrote
   `document.documentElement.style.overflow` directly, which is two writers on
   one property — the thing CLAUDE.md's ownership rule exists to prevent.

   The failure was concrete, not theoretical. Opening a card from inside the
   open drawer meant the card's unlockScroll() ran on close and set overflow
   back to '' while the drawer was still up, so the page scrolled freely behind
   a menu that believed it had the scroll locked.

   A COUNT, NOT A BOOLEAN. Whoever locks must unlock, and the page is only
   released when the last holder has let go. A boolean would have the same bug
   in a different shape: the second release would win regardless of who else
   was still holding.

   Not reference-counted per caller, deliberately — callers are trusted to
   pair their calls, exactly as they already were with the raw assignments. The
   count only fixes the overlap, it is not a safety harness.

   NOTE: loader.js does NOT use this. Its boot lock cancels input events
   instead of touching overflow, because changing the document height while
   ScrollTrigger is measuring pins would corrupt every trigger on the page. See
   the long comment in loader.js — that difference is load-bearing, not an
   inconsistency to tidy up.
   ============================================================ */

let holders = 0;

/** Take a lock. Idempotent per caller only in the sense that every call must
    be matched by exactly one release(). */
export function lockScroll() {
  holders += 1;
  if (holders === 1) document.documentElement.style.overflow = 'hidden';
}

/** Release one lock. The page scrolls again only when none are left. */
export function unlockScroll() {
  if (holders === 0) return; // an unmatched release must not go negative
  holders -= 1;
  if (holders === 0) document.documentElement.style.overflow = '';
}

/** Whether anything currently holds the page. Read-only; for callers that need
    to reason about their own state, never to decide whether to release. */
export function scrollLocked() {
  return holders > 0;
}
