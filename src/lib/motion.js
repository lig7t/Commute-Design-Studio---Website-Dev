/* ============================================================
   motion.js — GSAP registration and the motion environment.

   Every module that animates imports from here rather than reaching for
   GSAP itself, so plugin registration happens exactly once and the
   reduced-motion query is read from a single place.

   `hasGsap` looks redundant against static imports, and it is kept
   deliberately: every consumer branches on it, which is what keeps the
   no-motion fallback paths exercised instead of rotting into dead code.
   ============================================================ */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, Flip);

// Mobile browsers fire resize every time the URL bar slides; each one
// rebuilds both pins and re-measures every trigger, which is exactly the
// stutter it looks like. Height-only resizes are ignored.
ScrollTrigger.config({ ignoreMobileResize: true });

// Keep one scroll read per tick shared by every trigger instead of letting
// each one sample the scroller itself.
ScrollTrigger.defaults({ fastScrollEnd: true });

const hasGsap = Boolean(gsap && ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export { gsap, ScrollTrigger, ScrollToPlugin, Flip, hasGsap, reduced };
