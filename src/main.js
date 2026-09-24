/* ============================================================
   main.js — boot for the Commute studio page.

   The only place the mount order is decided. Everything here is
   additive: with motion disabled, or with WebGL unavailable, or with
   the manifest unreachable, the page still reads top to bottom.

   The order below is load-bearing, not stylistic — see the comments
   inside the loadWorks() chain.
   ============================================================ */

import { ScrollTrigger, hasGsap, reduced } from './lib/motion.js';
import { initTheme } from './lib/theme.js';
import { mountMedia } from './lib/media.js';
import { loadWorks } from './lib/works.js';
import { armChoreography, mountChoreography } from './lib/reveal.js';
import { mountParallax } from './lib/parallax.js';

import { mountLoader, dismissLoader } from './components/loader/loader.js';
import { mountThemeToggle } from './components/theme-toggle/theme-toggle.js';
import {
  mountNavHeight,
  mountNav,
  mountAnchors,
  mountDrawer,
} from './components/navigation/navigation.js';

import { mountReel, closeSeam, pickHeroFrames } from './sections/hero/hero.js';
import { initGallery } from './sections/gallery/gallery.js';

// First, before anything else: the boot screen has to cover the whole mount,
// and it takes the scroll lock before any of the code below can move the page.
mountLoader();

initTheme();
mountThemeToggle();
mountMedia();
mountNavHeight();
mountNav();
mountAnchors();
mountDrawer();
armChoreography();

loadWorks()
  .then(async (works) => {
    document.documentElement.classList.toggle('has-works', works.length > 0);
    const stageST = await mountReel(pickHeroFrames(works));
    // Closes the dead-scroll gap left between the stage's pin-spacer and the
    // gallery's own pin. Must run BEFORE initGallery() — see closeSeam()'s
    // own comment for why.
    closeSeam(stageST);
    // Create the gallery pin AFTER the stage pin so it inherits the stage's
    // pin-spacing when computing its own start (pins must init in DOM order).
    initGallery();
    // mountParallax() also needs both pins already in the DOM — same reason.
    mountParallax();
    // Reveal triggers last, for that same reason: built any earlier they measure
    // against a document that has not yet grown by the two pins' spacing.
    mountChoreography();
    if (hasGsap && !reduced) ScrollTrigger.refresh();
  })
  // loadWorks() resolves to [] rather than rejecting, so only the mount chain
  // above can land here — a WebGL context that failed, say. The page is
  // additive and still reads top to bottom, so this is logged, not fatal.
  .catch((err) => console.error('[commute] mount chain failed', err))
  // Last, and on both paths. The loader only leaves once the page behind it is
  // fully mounted and measured, which is why this is here and not earlier —
  // but a failed mount must never be able to leave the overlay standing.
  .finally(dismissLoader);
