/* ============================================================
   loader.js — the full-bleed loading screen and its 0 -> 100 counter.

   Its purpose is to buy time, not to report progress. It holds the first
   frame back until the document has parsed, the images are in, and the
   page's own choreography has mounted and measured, so the reader's first
   unobstructed frame is a finished page rather than a half-built one.

   ---- The two clocks ----

   The number is driven by TIME. It is not a progress bar and must never
   pretend to be one: there is no honest single percentage to report across
   a fetch, a WebGL context, two pins and a ScrollTrigger.refresh().

   Dismissal is gated on REAL READINESS. The counter may reach 99 whenever
   its own clock says so, but it may only reach 100 and leave once all of:

     minElapsed   the minimum duration has run (the counter has finished)
     loadReady    window 'load' has fired, so images are decoded and in
     mountReady   main.js's loadWorks() chain has finished, refresh included

   Each is a one-way latch, and every setter funnels through finish(), so
   the order they arrive in does not matter.

   ---- Coordinate systems / ownership ----

     elapsedMs     ms since the counter started, from performance.now()
     countProgress elapsedMs / MIN_DURATION_MS, clamped 0..1 — pure time
     countEased    countProgress cubed — the slow-to-fast curve
     countShown    the integer actually written to the DOM

   This module is the only writer of `.loader`'s opacity and transform (it
   owns them via the `loader--out` class, never inline), the only writer of
   `html.is-loading`, the only owner of the boot scroll lock, and the only
   writer of `inert` on the body's children. Nothing else on the page
   touches any of those.

   ---- Failure modes this guards against ----

   A single stalled image would otherwise hold 'load' forever and lock the
   reader out of a site that is, in every other respect, ready. SAFETY_MS
   dismisses regardless. Treat that timeout as load-bearing: removing it
   turns one slow asset into a blank page with no way out.

   Likewise, if loadWorks() rejects, main.js still calls dismissLoader() —
   the page is additive and reads top to bottom without works.json, so a
   rejected chain must never leave the overlay standing.

   And the exit itself must not depend on a rendered frame.
   requestAnimationFrame does not fire while the document is hidden, so a tab
   that finished loading in the background would sit behind an opaque overlay,
   counter frozen on 100, until the reader came back to it. startExit() races
   the frame against a timeout for that reason.

   The through-line in all three: whatever can rescue the page must outlive
   the step it is rescuing. finish() used to clear SAFETY_MS one statement
   before scheduling an rAF that could never arrive, which disarmed the net
   and the exit in the same breath. The net is now cleared in remove(), once
   the overlay is genuinely gone.
   ============================================================ */

import { ScrollTrigger, hasGsap, reduced } from '../../lib/motion.js';

/* 2.2s. Long enough that a fast connection still gets a beat of held
   stillness rather than a flicker, short enough to stay under the ~3s where
   a splash stops reading as composure and starts reading as a stall. With
   the cubic ease below, ~80% of that time is spent under 50, so the visible
   rush to 99 lands close to where a real first load actually completes. */
const MIN_DURATION_MS = 2200;

/* Hard ceiling on the whole screen, measured from mount. See the failure
   mode above: this is the only thing standing between a hung request and a
   reader who cannot reach the site at all. */
const SAFETY_MS = 8000;

/* The counter stops here. 100 is reserved for "actually ready", so the last
   digit flip is the one honest frame in the whole animation. */
const HOLD_AT = 99;

/* How long the exit will wait for a rendered frame before going ahead without
   one. Only ever consumed on the path where requestAnimationFrame does not
   fire at all — see startExit() for why that path has to exist. Short enough
   that a foregrounded tab always wins the race on the rAF instead. */
const EXIT_FRAME_WAIT_MS = 100;

const el = document.querySelector('[data-loader]');
const countEl = document.querySelector('[data-loader-count]');

let startMs = 0;
let countShown = -1;
let rafId = 0;
let safetyId = 0;

/* The exit owns three of its own handles. exitRafId and exitWaitId race each
   other (startExit), and whichever arrives first cancels the other; removed
   makes the teardown idempotent, because with two possible callers it now has
   more than one way to be reached. */
let exitRafId = 0;
let exitWaitId = 0;
let exitMs = 0;
let exitStarted = false;
let removed = false;

let minElapsed = false;
let loadReady = false;
let mountReady = false;
let finished = false;

/* power3.in, written out rather than imported: the counter must still run
   if GSAP failed to load, since the overlay it drives is what is covering
   the page. Slow-to-fast is the whole point — a linear count reads as a
   progress bar and invites the reader to check it against reality. */
const easeIn = (t) => t * t * t;

/* ---------- scroll lock ----------

   Deliberately NOT `overflow:hidden` on html/body, and deliberately not a
   position:fixed body. Both change the document's scroll height, and every
   pin on this page measures the document: ScrollTrigger instances are
   created (hero pin, gallery pin, parallax, reveals) while this overlay is
   still up, so a lock that alters the height would have them all measure a
   document that does not exist once the lock is released.

   Cancelling the input events instead leaves the document exactly as tall
   as it really is, and the fixed, inset:0 overlay adds no height of its own.
   The trade is that we cannot block scrollbar dragging — which is the right
   trade, because that path is deliberate and rare, and it still cannot
   desync anything: main.js refreshes after mounting, and release() refreshes
   again once the overlay is gone. */

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
]);

const blockDefault = (e) => e.preventDefault();
const blockScrollKeys = (e) => {
  if (SCROLL_KEYS.has(e.key)) e.preventDefault();
};

function lockScroll() {
  // Browsers restore the previous scroll position asynchronously, after our
  // scrollTo(0, 0) below would have run. Left on 'auto' a reload would drop
  // the reader mid-document behind the overlay. Not restored on dismiss: the
  // app owns where a load starts, and the next reload gets this same screen.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  window.addEventListener('wheel', blockDefault, { passive: false });
  window.addEventListener('touchmove', blockDefault, { passive: false });
  window.addEventListener('keydown', blockScrollKeys);
}

function releaseScroll() {
  window.removeEventListener('wheel', blockDefault, { passive: false });
  window.removeEventListener('touchmove', blockDefault, { passive: false });
  window.removeEventListener('keydown', blockScrollKeys);
}

/* ---------- boot interaction lock ----------

   The scroll lock above only cancels input the reader aims at the document,
   which quietly assumes a mouse or a finger. A keyboard reader has no such
   aim: the overlay is aria-hidden and covers the page visually only, so Tab
   still walks the skip link, the nav links and the burger underneath it, and
   there is no cue to wait.

   Both of the things that can then be reached bypass the lock completely:

     Enter on a nav anchor hands mountAnchors() a real click, and its
     gsap.to(window, { scrollTo }) is a programmatic scrollTop write — no
     preventDefault can see it. The document would scroll off the top that
     lockScroll() exists to guarantee, invisibly, while the hero and gallery
     pins are still being created against it.

     Enter on the burger opens the drawer, which sets overflow:hidden on
     documentElement — precisely the document-height change the comment above
     says must never happen while those pins are measuring.

   inert is the only lever that takes an element out of focus order, click
   handling and the accessibility tree at once, so the lock means the same
   thing for every input method. Browsers without it assign a harmless
   expando and land on today's behaviour rather than a broken page.

   Only the elements this module actually flipped are restored, so if anything
   else ever owns inert on one of these nodes, release does not clear it. */

let inertedByLoader = [];

function lockInteraction() {
  // Every body child except the overlay itself — the overlay holds nothing
  // focusable, and inerting it would be inerting the thing doing the locking.
  inertedByLoader = [...document.body.children].filter((node) => node !== el && !node.inert);
  for (const node of inertedByLoader) node.inert = true;
}

function releaseInteraction() {
  for (const node of inertedByLoader) node.inert = false;
  inertedByLoader = [];
}

/* ---------- the counter ---------- */

function paint(n) {
  // Write-cache, not state: `n` is derived from the clock every frame, so
  // this only suppresses redundant DOM writes between digit changes.
  if (n === countShown) return;
  countShown = n;

  // The counter is a decoration; the dismissal is a safety mechanism. If the
  // count markup is ever dropped or renamed, the clock, the readiness gate and
  // SAFETY_MS must all still run — otherwise the overlay, which CSS shows off
  // `is-loading` alone, outlives the only code that can take it down. See the
  // guard in mountLoader().
  if (countEl) countEl.textContent = String(n);
}

/* One frame: READ the clock, CALCULATE, WRITE. Nothing is measured off the
   DOM and nothing accumulates — countShown is recomputed from elapsedMs
   every tick, so a dropped frame or a backgrounded tab cannot drift it, and
   monotonic time through a monotonic ease is what guarantees the number can
   never go backwards. */
function tick(now) {
  const elapsedMs = now - startMs;
  const countProgress = Math.min(elapsedMs / MIN_DURATION_MS, 1);
  const countEased = easeIn(countProgress);

  paint(Math.floor(countEased * HOLD_AT));

  if (countProgress < 1) {
    rafId = requestAnimationFrame(tick);
    return;
  }

  rafId = 0;
  minElapsed = true;
  finish();
}

/* ---------- exit ---------- */

function finish() {
  if (finished) return;
  if (!(minElapsed && loadReady && mountReady)) return;
  finished = true;

  if (rafId) cancelAnimationFrame(rafId);
  // safetyId is deliberately NOT cleared here. It used to be, and that was the
  // bug: it disarmed the only rescue one statement before the fragile step
  // that needed it. It is cleared in remove(), once the overlay is actually
  // gone — the net has to outlive the thing it is protecting against.

  // READ before the write below, per the house rule — this is the only DOM
  // read on the exit path, so taking it first keeps the frame free of a forced
  // synchronous layout that paint()'s textContent write would otherwise cause.
  //
  // The exit duration lives in loader.css, so read it back off the element
  // rather than restating it here — a JS constant that only agrees with a
  // stylesheet by convention is a bug with a delay on it. This also gets
  // reduced motion for free: the design system's reduced-motion rule
  // collapses transition-duration to ~0, so the parse returns ~0 and the
  // overlay is gone on the next frame with no fade. Computed
  // transition-duration is always normalised to seconds.
  exitMs = parseFloat(getComputedStyle(el).transitionDuration) * 1000 || 0;

  paint(100);

  // Two racers, because a rendered frame is desirable but must not be
  // REQUIRED. See startExit().
  exitRafId = requestAnimationFrame(startExit);
  exitWaitId = setTimeout(startExit, EXIT_FRAME_WAIT_MS);
}

/* Begins the fade, from whichever of the two racers in finish() arrives first.

   The rAF exists so the 100 gets one painted frame before the fade begins.
   The timeout exists because requestAnimationFrame DOES NOT FIRE AT ALL while
   the document is hidden, and a tab can finish loading in the background — the
   reader opened the site in a new tab and is still reading something else.
   Left as the only path to remove(), that leaves an opaque overlay sealing a
   fully-built page, with the counter frozen on 100, for as long as the tab
   stays hidden. Verified: a rAF queued in a hidden tab was still unfired
   minutes later, while the page behind it was complete.

   Timers are throttled in a background tab but they do run, so the timeout is
   the path that always completes. The frame is an optimisation; the removal is
   a guarantee. Never make the removal depend on the frame again. */
function startExit() {
  if (exitStarted) return;
  exitStarted = true;

  if (exitRafId) cancelAnimationFrame(exitRafId);
  if (exitWaitId) clearTimeout(exitWaitId);

  el.classList.add('loader--out');
  setTimeout(remove, exitMs);
}

function remove() {
  if (removed) return;
  removed = true;

  // Only now — the overlay is off the page, so nothing is left for the safety
  // net to rescue. Clearing it any earlier is what caused the bug above.
  if (safetyId) clearTimeout(safetyId);

  releaseScroll();
  releaseInteraction();
  el.remove();
  document.documentElement.classList.remove('is-loading');

  // Removed from the DOM outright, not hidden: nothing decorative is left in
  // the accessibility tree, and with no focusable descendants there was
  // never a trap to release. The page behind it becomes reachable again in
  // the same frame, via releaseInteraction() above.

  // The document is now at its true final height with the overlay gone. The
  // refresh main.js already ran measured a correct height too (the overlay
  // is fixed and adds none), so this is belt-and-braces against anything the
  // exit changed — cheap, and it runs once.
  if (hasGsap && !reduced) ScrollTrigger.refresh();
}

/* ---------- public surface ---------- */

/** Mount FIRST in main.js, before anything else, so the screen covers the
    whole boot. Returns immediately if the overlay element or the `is-loading`
    class is absent — with JS disabled the class never lands, and the overlay is
    inert markup that CSS never shows.

    Those two are the only conditions that may bail, and both are cases where
    nothing is covering the page. A missing `[data-loader-count]` is NOT one:
    the overlay would still be up (CSS shows it off `is-loading` and the
    `.loader` element alone), so bailing there would skip the 'load' listener
    and the SAFETY_MS timeout and leave an opaque, unscrollable screen with
    nothing left running that could ever remove it. It degrades to a silent
    counter instead — see paint(). Never widen this guard back. */
export function mountLoader() {
  if (!el) return;
  if (!document.documentElement.classList.contains('is-loading')) return;

  lockScroll();
  lockInteraction();

  // If the module was parsed after 'load' (cached reload, bfcache), the
  // event will never fire again — readyState is the only truth here.
  if (document.readyState === 'complete') loadReady = true;
  else window.addEventListener('load', () => ((loadReady = true), finish()), { once: true });

  safetyId = setTimeout(() => {
    minElapsed = loadReady = mountReady = true;
    finish();
    // finish() is latched. If it had already run and the exit was still in
    // flight, the line above is a no-op and this is the last thing that can
    // take the overlay down — so the net covers the exit as well as the gates,
    // not just the gates. Both calls are idempotent; whichever is redundant
    // returns immediately.
    startExit();
  }, SAFETY_MS);

  if (reduced) {
    // No count-up theatre: the screen is shown, the number is simply already
    // there, and the readiness gate is still honoured in full.
    paint(HOLD_AT);
    minElapsed = true;
    finish();
    return;
  }

  startMs = performance.now();
  rafId = requestAnimationFrame(tick);
}

/** Call at the END of main.js's loadWorks() chain — after mountChoreography()
    and the ScrollTrigger.refresh() — including on the rejection path. This
    only latches the last gate; the overlay leaves when the other two agree. */
export function dismissLoader() {
  mountReady = true;
  finish();
}
