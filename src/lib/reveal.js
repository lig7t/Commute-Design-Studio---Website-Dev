/* ============================================================
   reveal.js — the sitewide two-pass reveal choreography.

   Pass 1 (armChoreography) parks everything at its pre-reveal state
   immediately. Pass 2 (mountChoreography) builds the triggers, and MUST
   run after both pins exist — see the comment above mountChoreography.
   The two passes share revealSets / WORDS / armTimer, which is why they
   live in one module rather than two.
   ============================================================ */

import { gsap, ScrollTrigger, hasGsap, reduced } from './motion.js';
import { REVEAL_SKIP_CONTAINER } from './config.js';
import { splitWords } from './text.js';

export const FROM = {
  left: { x: -64, y: 0 },
  right: { x: 64, y: 0 },
  up: { x: 0, y: 48 },
  down: { x: 0, y: -40 },
  none: { x: 0, y: 0 },
};

/* Every element in a reveal set fades in as it enters the viewport and fades
   back out as it leaves — in BOTH scroll directions, so the page reads the
   same going up as coming down.

   The directional slide (data-in="left|right|up|down") REPLAYS on every
   entry, not just the first — the reader scrolling back over the same
   paragraph a second time sees the same motion again, not a plain cross-fade.
   hide()'s onComplete is what makes the replay possible: it snaps the
   element back to its FROM offset while invisible, so the next show() has
   somewhere to slide from.

   Split headlines (see SPLIT_SELECTOR / armChoreography) carry their opacity
   on the WORDS, never on the element itself — the element only ever tweens
   x. If both the element and its words faded, the two opacities would
   multiply into a mushy double fade instead of one clean one.

   No clearProps here — the tween has to stay reversible, and clearing the
   transform would strand the element at whatever offset it last held.

   Fade-out is opacity only, and its window (`bottom 6%`) is deliberately late:
   the element is essentially off-screen before it starts dimming, so nothing
   dissolves while it is still being read. */

/* clamp() keeps both edges inside the scrollable range. Without it the last
   block on the page can want a start past the maximum scroll — the footer
   asked for 9219 on a document that stops at 9202 — and simply never
   reveals, because the reader cannot scroll far enough to cross it. */
const REVEAL_START = 'clamp(top 88%)';
const REVEAL_END = 'clamp(bottom 6%)';

/* Structural sweep, replacing a hand-marked [data-in] on every element: a
   section reveals because it IS a display/headline/body/etc., not because
   someone remembered to tag it. New content is covered with no markup. */
const REVEAL_CANDIDATES =
  '.ds-display, .ds-headline, .ds-title, .ds-body, .ds-meta, .ds-micro, .ds-rule, figure, p, h1, h2, h3, dl, [data-in]';

/* Elements this automatic sweep found, grouped so a natural cluster (an
   explicit [data-in-group], or several candidates sharing a parent) reveals
   as one staggered unit. Collected once and shared by both passes below. */
function collectRevealSets() {
  const candidates = new Set(
    [...document.querySelectorAll(REVEAL_CANDIDATES)]
      .filter((el) => !el.closest(REVEAL_SKIP_CONTAINER))
      .filter((el) => !el.matches('[data-no-in]')),
  );

  // The outermost candidate wins — otherwise a figure and its own
  // figcaption.ds-micro would both be candidates and the caption would
  // double-fade (once with the figure, once on its own).
  for (const el of [...candidates]) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (candidates.has(p)) {
        candidates.delete(el);
        break;
      }
    }
  }

  const sets = [];

  // An explicit [data-in-group] wins over parent-grouping where present.
  for (const group of document.querySelectorAll('[data-in-group]')) {
    if (group.closest(REVEAL_SKIP_CONTAINER)) continue;
    const items = [...group.querySelectorAll('[data-in]')].filter((el) => candidates.has(el));
    if (!items.length) continue;
    items.forEach((el) => candidates.delete(el));
    sets.push({ targets: items, trigger: group, stagger: 0.04 });
  }

  // Whatever's left groups by parent: two-or-more surviving siblings reveal
  // together, which covers clusters like .lighting__copy / .contact__inner
  // with no markup. A lone candidate gets its own trigger — triggering a
  // single element off its parent's box would fire it far too early for a
  // tall wrapper like .lighting__inner.
  const byParent = new Map();
  for (const el of candidates) {
    if (!byParent.has(el.parentElement)) byParent.set(el.parentElement, []);
    byParent.get(el.parentElement).push(el);
  }
  for (const els of byParent.values()) {
    if (els.length >= 2) sets.push({ targets: els, trigger: els[0].parentElement, stagger: 0.04 });
    else sets.push({ targets: els, trigger: els[0], stagger: 0 });
  }

  return sets;
}

let revealSets = [];

// Split headlines (armChoreography) keep their word spans here — element ->
// spans — so mountChoreography()'s show()/hide() can reach them without
// re-querying or re-splitting.
const WORDS = new WeakMap();
const SPLIT_SELECTOR = '.ds-display, .ds-headline, .ds-title';

// Insurance against a mid-boot throw leaving the page invisible: arming
// parks everything at opacity 0, and mountChoreography() (which actually
// shows things) only runs at the end of an async boot chain, after a
// fetch. If that chain never completes, force-show everything rather than
// leave the page permanently blank. Not part of the normal reveal path —
// mountChoreography() cancels it the moment it runs.
let armTimer = 0;

/** Pass 1, immediate: park everything at its pre-reveal state, so content is
    never painted at full opacity and then pulled away once triggers land.

    Headline-tier targets are split into words here (splitWords is a no-op on
    a second call, but arming only ever runs once). Body copy is deliberately
    NOT split — hundreds of spans, and it fights text-wrap: pretty from
    design-system/base/base.css. Split targets park their WORDS at opacity 0
    and leave the element itself at opacity 1 / x-only — see the comment above
    REVEAL_START for why the two must not both carry opacity. */
export function armChoreography() {
  if (!hasGsap || reduced) return;
  revealSets = collectRevealSets();

  for (const set of revealSets) {
    const splitTargets = set.targets.filter((el) => el.matches(SPLIT_SELECTOR));
    const plainTargets = set.targets.filter((el) => !splitTargets.includes(el));

    for (const el of splitTargets) {
      WORDS.set(el, splitWords(el));
    }

    if (splitTargets.length) {
      gsap.set(splitTargets, {
        opacity: 1,
        x: (i, el) => (FROM[el.dataset.in] || FROM.up).x,
      });
      for (const el of splitTargets) {
        gsap.set(WORDS.get(el), { opacity: 0, y: 24 });
      }
    }

    if (plainTargets.length) {
      gsap.set(plainTargets, {
        opacity: 0,
        x: (i, el) => (FROM[el.dataset.in] || FROM.up).x,
        y: (i, el) => (FROM[el.dataset.in] || FROM.up).y,
      });
    }
  }

  armTimer = setTimeout(() => {
    for (const { targets } of revealSets) {
      gsap.set(targets, { opacity: 1, x: 0, y: 0 });
      for (const el of targets) {
        const words = WORDS.get(el);
        if (words) gsap.set(words, { opacity: 1, y: 0 });
      }
    }
  }, 4000);
}

/** Pass 2, and it MUST run after both pins exist. A reveal trigger built
    before them measures its start against a document ~8000px shorter, and a
    later ScrollTrigger.refresh() does not correct it — verified: start stayed
    at 998 for an element sitting at 8990, through refresh() and refresh(true)
    alike, because a trigger refreshes ahead of pins created after it and so
    never picks up their pin-spacing. The failure mode is a reveal parked
    permanently past its own end: every section fades out once and never
    returns. Same ordering constraint mountParallax() documents. */
export function mountChoreography() {
  if (!hasGsap || reduced) return;
  clearTimeout(armTimer); // triggers are live — cancel the force-show safety net

  for (const { targets, trigger, stagger } of revealSets) {
    const splitTargets = targets.filter((el) => WORDS.has(el));
    const plainTargets = targets.filter((el) => !WORDS.has(el));

    const show = () => {
      if (splitTargets.length) {
        gsap.to(splitTargets, {
          x: 0,
          duration: 0.72,
          ease: 'power3.out',
          stagger,
          overwrite: 'auto',
          force3D: true,
        });
        for (const el of splitTargets) {
          gsap.to(WORDS.get(el), {
            opacity: 1,
            y: 0,
            duration: 0.72,
            ease: 'power3.out',
            stagger: 0.03,
            overwrite: 'auto',
            force3D: true,
          });
        }
      }
      if (plainTargets.length) {
        gsap.to(plainTargets, {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.72,
          ease: 'power3.out',
          stagger,
          overwrite: 'auto',
          force3D: true,
        });
      }
    };

    // The reset (back to the FROM offset) lands in onComplete, once fully
    // faded out, so it is invisible — without it the replayed slide (see the
    // comment above REVEAL_START) has nowhere to come from and only
    // cross-fades. overwrite: 'auto' on show() is what makes the replay
    // safe: it kills a mid-flight hide() before its onComplete can strand
    // the element parked at its FROM offset while show() thinks it's live.
    //
    // Split targets never tween the element's own opacity (see the comment
    // above REVEAL_START), so their fade-out runs on the WORDS instead; the
    // element only ever has its x reset once the words are invisible.
    const hide = () => {
      if (plainTargets.length) {
        gsap.to(plainTargets, {
          opacity: 0,
          duration: 0.15,
          ease: 'power2.in',
          overwrite: 'auto',
          force3D: true,
          onComplete: () => {
            gsap.set(plainTargets, {
              x: (i, el) => (FROM[el.dataset.in] || FROM.up).x,
              y: (i, el) => (FROM[el.dataset.in] || FROM.up).y,
            });
          },
        });
      }
      for (const el of splitTargets) {
        const words = WORDS.get(el);
        gsap.to(words, {
          opacity: 0,
          duration: 0.15,
          ease: 'power2.in',
          overwrite: 'auto',
          force3D: true,
          onComplete: () => {
            gsap.set(el, { x: (FROM[el.dataset.in] || FROM.up).x });
            gsap.set(words, { y: 24 });
          },
        });
      }
    };

    // onLeave is guarded rather than symmetric with onLeaveBack. Content in
    // the final viewport cannot be scrolled past the top, so clamp() collapses
    // its end onto its start and the trigger reports "left" the instant it is
    // reached — the footer would fade in and straight back out with the reader
    // sitting there looking at it. If the end is pinned to the document bottom,
    // nothing has actually left.
    // `self`, not the `st` binding below: ScrollTrigger.create() runs its first
    // refresh/update synchronously inside the constructor, so a trigger that is
    // already scrolled past fires onLeave BEFORE `const st` has been
    // initialised — a TDZ ReferenceError that aborted the rest of
    // mountChoreography(), leaving every later reveal with no trigger at all
    // and skipping main.js's closing refresh(). It read as "reveals below the
    // fold never arrive", and it was invisible until main.js grew a .catch.
    // The callback argument is the same instance, and it is always bound.
    const st = ScrollTrigger.create({
      trigger,
      start: REVEAL_START,
      end: REVEAL_END,
      onEnter: show,
      onEnterBack: show,
      onLeaveBack: hide,
      onLeave: (self) => {
        if (self.end < ScrollTrigger.maxScroll(window) - 2) hide();
      },
    });

    // A set already on screen when the trigger is built crosses nothing.
    if (st.isActive) show();
  }
}
