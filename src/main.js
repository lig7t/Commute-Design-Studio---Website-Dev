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
import { mountMedia, decodeAll } from './lib/media.js';
import { loadWorks } from './lib/works.js';
import { armChoreography, mountChoreography } from './lib/reveal.js';
import { mountParallax } from './lib/parallax.js';

import { mountLoader, dismissLoader, setAssetProgress } from './components/loader/loader.js';
import { mountThemeToggle } from './components/theme-toggle/theme-toggle.js';
import {
  mountNavHeight,
  mountNav,
  mountNavProjects,
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
    const gallery = initGallery();
    // The nav's project list under "Interiors". This coupling lives HERE and
    // nowhere else: navigation.js is a component and gallery.js is a section,
    // and components must not import sections (CLAUDE.md, dependencies point
    // downward only). main.js already imports both, so it is the one place
    // allowed to introduce them — the nav receives plain data and a callback
    // and stays ignorant of what a project is.
    //
    // Safe to run before the reveal pass below: it only appends to the nav,
    // which is inside REVEAL_SKIP_CONTAINER and sits outside both pins, so it
    // adds no document height for a later trigger to have mismeasured.
    if (gallery?.canOpen()) {
      mountNavProjects({
        sectionId: 'work',
        items: gallery.projects,
        onSelect: gallery.openProject,
      });
    }
    // mountParallax() also needs both pins already in the DOM — same reason.
    mountParallax();
    // Reveal triggers last, for that same reason: built any earlier they measure
    // against a document that has not yet grown by the two pins' spacing.
    mountChoreography();
    if (hasGsap && !reduced) ScrollTrigger.refresh();

    /* Hold the boot screen until the pictures are actually paintable.

       This has to come AFTER initGallery(), because that is what creates the
       gallery's <img> elements in the first place — they do not exist during
       window 'load', which is exactly why the overlay used to lift onto a grid
       of grey mattes.

       Scoped to what the reader meets first rather than all 162 files: the
       gallery slides, the interiors section, and any markup image already in
       the page. The card's own images are excluded — it starts blank by
       design and fills on open, so waiting on them would hold the screen for
       pictures nobody has asked to see yet.

       Awaited inside the chain so .finally below still runs on every path,
       and so a rejection here cannot skip the dismissal. */
    const above = [...document.querySelectorAll('.gallery__slide img, .work img, .ds-media img')];
    await decodeAll(
      above.filter((img) => !img.closest('[data-card]')),
      setAssetProgress,
    );
  })
  // loadWorks() resolves to [] rather than rejecting, so only the mount chain
  // above can land here — a WebGL context that failed, say. The page is
  // additive and still reads top to bottom, so this is logged, not fatal.
  .catch((err) => console.error('[commute] mount chain failed', err))
  // Last, and on both paths. The loader only leaves once the page behind it is
  // fully mounted and measured, which is why this is here and not earlier —
  // but a failed mount must never be able to leave the overlay standing.
  .finally(dismissLoader);
