/* ============================================================
   project-card.js — the Flip-morphed project detail card.

   Adapted from the Codrops tutorial's Transition module: a single
   reusable overlay Flip-morphs from whichever gallery slide was
   opened (Flip.from on open, Flip.fit on close), guarded by the same
   four-state machine (closed | opening | open | closing).

   SplitText isn't vendored, so the tutorial's line/char text reveal
   is a manual staggered fade here instead — applied to the project
   title and to every image in the grid beside the hero, so nothing
   in the card just pops in.
   ============================================================ */

import { gsap, Flip, reduced } from '../../lib/motion.js';
import { asset as resolve } from '../../lib/works.js';
import {
  lockScroll as lockPageScroll,
  unlockScroll as unlockPageScroll,
} from '../../lib/scroll-lock.js';

// Reduced motion keeps the detail card but shortens the morph, per the spec's
// "shorten/soften the Flip morph" — the transition still explains where the
// card came from, it just stops being a travelling animation.

const OPEN_DURATION = reduced ? 0.3 : 1.1;
const CLOSE_DURATION = reduced ? 0.25 : 0.9;
const DECODE_TIMEOUT_MS = 600; // ceiling on the pre-morph image decode

export class Card {
  constructor() {
    this.root = document.querySelector('[data-card]');
    if (!this.root) return;

    this.image = this.root.querySelector('[data-card-image]');
    this.mediaBox = this.root.querySelector('.card__media .ds-media');
    this.gridEl = this.root.querySelector('[data-card-grid]');
    // The card shows the project name and nothing else — discipline,
    // description, location and year were dropped from both the markup and
    // gallery.data.js. Kept as a map rather than a bare `this.title` because
    // open()/close() stagger over Object.values(this.fields), so restoring a
    // field is an entry here plus an element, with no timeline change.
    this.fields = {
      title: this.root.querySelector('[data-card-title]'),
    };

    this.slides = [];
    this.slide = null;
    this.tl = null;
    this.state = 'closed'; // closed | opening | open | closing

    /* Resolvers waiting for this card to finish closing. The mobile drawer
       needs it: it hides itself while a card is up and brings itself back when
       the card is gone, so it has to be able to ask "tell me when you are
       done" without knowing anything about Flip timelines or which of the two
       close paths ran. Flushed in reset(), which is the single point every
       close path funnels through. */
    this.closeWaiters = [];
    this.closeFallbackId = 0;

    this.panel = this.root.querySelector('.card__panel');

    // Held, not re-queried: open() animates them, so they are a target list
    // rather than just a click surface. This class is the only writer of
    // scale/alpha on them — same one-writer rule the gallery's hint follows.
    this.closeBtns = [...this.root.querySelectorAll('[data-card-close]')];
    this.closeBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.close());
    });
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root || e.target === this.panel) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  setSlides(slides) {
    this.slides = slides;
  }

  /** Resolves once the card is fully closed and reset. Resolves immediately if
      it is already closed, so a caller can await it unconditionally without
      first having to check state. */
  onceClosed() {
    if (this.state === 'closed') return Promise.resolve();
    return new Promise((resolve) => this.closeWaiters.push(resolve));
  }

  /** Animate a slide's thumbnail into the full detail card. */
  async open(slide, index, project) {
    if (!this.root || this.state !== 'closed') return;
    if (!project) return;
    this.state = 'opening';
    this.slide = slide;

    // fill() awaits a decode. Scroll stays live until that has settled: locking
    // first meant any stall in decode() left the page with overflow:hidden, no
    // card on screen, and state pinned at 'opening' so every later click was
    // swallowed too. decode() can stall indefinitely rather than reject — a
    // backgrounded tab alone is enough to trigger it.
    await this.fill(project);

    // A close() landed while the image was decoding — bail without animating.
    if (this.state !== 'opening') return;

    this.lockScroll();

    const wrapper = slide.querySelector('.gallery__img-wrapper');
    const flipId = `slide-${index}`;
    wrapper.dataset.flipId = flipId;
    this.mediaBox.dataset.flipId = flipId;

    const state = Flip.getState(wrapper);

    gsap.set(this.root, { display: 'block' });
    this.root.setAttribute('aria-hidden', 'false');
    gsap.killTweensOf(wrapper);
    gsap.set(wrapper, { autoAlpha: 0 });

    const others = this.slides.filter((s) => s !== slide);
    const caption = slide.querySelector('figcaption');
    const metaEls = Object.values(this.fields).filter(Boolean);
    const gridItems = [...this.gridEl.children];

    gsap.set(this.image, { scale: 1.2 });
    gsap.set([...metaEls, ...gridItems], { autoAlpha: 0, y: 12 });
    // Parked for the same pop the gallery's hint pill uses. transformOrigin is
    // the left edge, because that is the edge the sticky button is anchored to
    // — the pill grows out of the corner it is pinned to, and this is the same
    // idea applied to a left-aligned control.
    gsap.set(this.closeBtns, { autoAlpha: 0, scale: 0.4, transformOrigin: '0% 50%' });

    this.tl = gsap
      .timeline({
        onComplete: () => {
          this.state = 'open';
        },
        onReverseComplete: () => this.reset(),
      })
      .to(others, { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, 0)
      .to(caption, { autoAlpha: 0, duration: 0.3, ease: 'power2.out' }, 0)
      .add(
        Flip.from(state, {
          targets: this.mediaBox,
          duration: OPEN_DURATION,
          ease: 'power4.inOut',
          absolute: true,
        }),
        0,
      )
      .to(this.image, { scale: 1, duration: OPEN_DURATION, ease: 'power4.inOut' }, 0)
      // The close pill pops in, borrowing the gallery hint's ease and scale
      // exactly (back.out(2) from 0.4) so the two read as the same object.
      // Just ahead of the title, so the way out is offered before the content
      // finishes arriving rather than after it.
      .to(this.closeBtns, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0.45)
      // fade-in: the title, then every image in the grid, staggered
      .to(metaEls, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.55)
      .to(
        gridItems,
        { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04 },
        0.75,
      );

    return this.tl;
  }

  /** Open the card with no slide to morph from — the path the navigation's
      project list uses.

      WHY NOT JUST REUSE open(). Two reasons, and the second is the dangerous
      one:

      1. Flip.from() needs the slide's wrapper as a live FROM state. The desktop
         gallery is a pinned loop whose slides sit at yPercents reaching ±1600%,
         so the project the reader named from the nav is usually nowhere near
         the viewport, and morphing from there would fly the image in from off
         screen for no reason.

      2. open() writes autoAlpha 0 to the slide's wrapper, and reset() restores
         it to 1 unconditionally. That is only safe because a click PROVES the
         slide was visible — reset()'s own comment says so. Opening from the nav
         destroys that proof: the slide may be one the loop currently has
         hidden, and restoring it to 1 on close would strand it visible inside a
         loop whose state says it is not.

      So this path never touches a slide. `this.slide` stays null, which
      reset()'s `if (this.slide)` guard and close()'s branch below both already
      read as "there is nothing to morph back into". */
  async openDetached(index, project) {
    if (!this.root || this.state !== 'closed') return;
    if (!project) return;
    this.state = 'opening';

    // Same ordering rule as open(): decode before locking scroll, so a stalled
    // decode cannot strand the page with overflow:hidden and no card.
    await this.fill(project);
    if (this.state !== 'opening') return;

    this.lockScroll();

    gsap.set(this.root, { display: 'block' });
    this.root.setAttribute('aria-hidden', 'false');

    const metaEls = Object.values(this.fields).filter(Boolean);
    const gridItems = [...this.gridEl.children];

    gsap.set(this.mediaBox, { autoAlpha: 0, scale: 0.94, transformOrigin: '50% 50%' });
    gsap.set(this.image, { scale: 1.12 });
    gsap.set([...metaEls, ...gridItems], { autoAlpha: 0, y: 12 });
    gsap.set(this.closeBtns, { autoAlpha: 0, scale: 0.4, transformOrigin: '0% 50%' });

    // Beats deliberately identical to open()'s (0.45 / 0.55 / 0.75) so arriving
    // from the nav and arriving from a picture feel like the same card.
    this.tl = gsap
      .timeline({
        onComplete: () => {
          this.state = 'open';
        },
        onReverseComplete: () => this.reset(),
      })
      .to(
        this.mediaBox,
        { autoAlpha: 1, scale: 1, duration: OPEN_DURATION, ease: 'power4.inOut' },
        0,
      )
      .to(this.image, { scale: 1, duration: OPEN_DURATION, ease: 'power4.inOut' }, 0)
      .to(this.closeBtns, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0.45)
      .to(metaEls, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.55)
      .to(
        gridItems,
        { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04 },
        0.75,
      );

    return this.tl;
  }

  /** Morph the card back into its slide, or simply fade it out when it was
      opened detached and has no slide to return to. */
  close() {
    if (this.state === 'opening') {
      this.state = 'closing';
      if (!this.tl) {
        this.reset();
        return;
      }
      this.tl.reverse();
      this.armCloseFallback();
      return;
    }
    if (this.state !== 'open') return;
    this.state = 'closing';

    const metaEls = Object.values(this.fields).filter(Boolean);
    const gridItems = [...this.gridEl.children];

    // Opened from the nav: there is no slide, so there is nothing to fit back
    // into and — critically — no slide visibility to restore. Mirror of
    // openDetached(), same reasoning as its comment.
    if (!this.slide) {
      this.tl = gsap
        .timeline({ onComplete: () => this.reset() })
        .to(
          [...gridItems, ...metaEls],
          { autoAlpha: 0, duration: 0.3, stagger: 0.015, ease: 'power1.out' },
          0,
        )
        .to(this.closeBtns, { autoAlpha: 0, scale: 0.4, duration: 0.25, ease: 'power2.in' }, 0)
        .to(
          this.mediaBox,
          { autoAlpha: 0, scale: 0.94, duration: CLOSE_DURATION, ease: 'power3.inOut' },
          0.1,
        )
        .to(this.image, { scale: 1.12, duration: CLOSE_DURATION, ease: 'power3.inOut' }, 0.1);
      this.armCloseFallback();
      return;
    }

    const wrapper = this.slide.querySelector('.gallery__img-wrapper');
    const others = this.slides.filter((s) => s !== this.slide);
    const caption = this.slide.querySelector('figcaption');

    this.tl = gsap
      .timeline({ onComplete: () => this.reset() })
      .to(
        [...gridItems, ...metaEls],
        { autoAlpha: 0, duration: 0.3, stagger: 0.015, ease: 'power1.out' },
        0,
      )
      .add(
        Flip.fit(this.mediaBox, wrapper, {
          duration: CLOSE_DURATION,
          ease: 'power3.inOut',
          absolute: true,
        }),
        0.1,
      )
      .to(this.image, { scale: 1.2, duration: CLOSE_DURATION, ease: 'power3.inOut' }, 0.1)
      .to(others, { autoAlpha: 1, duration: 0.5, ease: 'power2.out' }, 0.45)
      .to(caption, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 0.5);
    this.armCloseFallback();
  }

  /* The close animation is the only thing that calls reset(), and reset() is
     what unlocks page scroll, restores the slide, and releases everyone waiting
     on onceClosed() — including the mobile drawer, which stays hidden until it
     resolves.

     GSAP timelines advance on requestAnimationFrame, and rAF does not fire while
     the document is hidden. A tab backgrounded mid-close would therefore be left
     with the card on screen, the page unscrollable, the menu invisible, and
     nothing running that could ever undo any of it.

     Same shape and the same lesson as loader.js's exit: whatever can rescue the
     page must OUTLIVE the step it is rescuing. So this is armed after the
     timeline exists, and cleared inside reset() rather than before it. The delay
     is read off the timeline's own measured duration instead of restating
     CLOSE_DURATION and the stagger offsets, which would be a second opinion
     about a number that lives three lines up. */
  armCloseFallback() {
    clearTimeout(this.closeFallbackId);
    const seconds = (this.tl?.duration() ?? CLOSE_DURATION) + 0.35;
    this.closeFallbackId = setTimeout(() => {
      if (this.state !== 'closed') this.reset();
    }, seconds * 1000);
  }

  /** Populate the card from the project data; wait for the image to decode
      so the Flip morph doesn't paint a blank frame. */
  async fill(project) {
    this.image.src = resolve(project.mainImage);
    this.image.alt = project.title;
    // Raced, not just try/caught: decode() rejects on a broken image but simply
    // never settles on a page the browser isn't painting, and an un-raced await
    // would park the whole open() there forever.
    await Promise.race([
      this.image.decode().catch(() => {}),
      new Promise((r) => setTimeout(r, DECODE_TIMEOUT_MS)),
    ]);

    this.fields.title.textContent = project.title;

    this.gridEl.innerHTML = '';
    project.galleryImages.forEach((src) => {
      const fig = document.createElement('figure');
      const media = document.createElement('div');
      media.className = 'ds-media';
      const img = document.createElement('img');
      img.src = resolve(src);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      media.appendChild(img);
      fig.appendChild(media);
      this.gridEl.appendChild(fig);
    });
  }

  reset() {
    /* Idempotent: reachable from onComplete, onReverseComplete and the fallback
       above, and two of those can land for the same close if the timeline
       finishes just after the timeout fired. After a reset, state is 'closed'
       and tl is null — that pair is the marker, so no extra flag is needed. */
    if (this.state === 'closed' && this.tl === null) return;

    clearTimeout(this.closeFallbackId);
    this.closeFallbackId = 0;

    if (this.slide) {
      const wrapper = this.slide.querySelector('.gallery__img-wrapper');
      delete wrapper.dataset.flipId;
      // Scroll is locked for the whole open/close lifecycle, so the slide's
      // Reveal-visibility can't have changed underneath us — it was shown
      // when the card opened, so it's safe to restore it unconditionally.
      gsap.set(wrapper, { autoAlpha: 1 });
    }
    delete this.mediaBox.dataset.flipId;
    gsap.set(this.root, { display: 'none' });
    this.root.setAttribute('aria-hidden', 'true');
    gsap.set(this.mediaBox, { clearProps: 'all' });
    gsap.set(this.image, { clearProps: 'all' });
    // Cleared too, or the next open inherits the last one's scale and the pop
    // plays from 1 to 1 — invisible, and only on the second open onwards.
    gsap.set(this.closeBtns, { clearProps: 'all' });
    this.unlockScroll();

    this.slide = null;
    this.tl = null;
    this.state = 'closed';

    // Taken and cleared before calling, so a waiter that re-opens the card
    // synchronously cannot be resolved twice by this same flush.
    const waiters = this.closeWaiters;
    this.closeWaiters = [];
    for (const resolve of waiters) resolve();
  }

  // Freeze the page (and the pinned gallery behind it) while the card is
  // open — same effect as the tutorial's slider.stop()/start(), reached
  // here by blocking scroll input rather than disabling an Observer.
  /* Delegated to lib/scroll-lock.js. The card is no longer the only thing that
     can be holding the page: a card opened from the mobile drawer's project
     list is open WHILE the drawer is, and writing overflow directly here used
     to release the drawer's lock on close. */
  lockScroll() {
    lockPageScroll();
  }
  unlockScroll() {
    unlockPageScroll();
  }
}

export default Card;
