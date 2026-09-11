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

    this.panel = this.root.querySelector('.card__panel');

    this.root.querySelectorAll('[data-card-close]').forEach((btn) => {
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
      // fade-in: the title, then every image in the grid, staggered
      .to(metaEls, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }, 0.55)
      .to(
        gridItems,
        { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04 },
        0.75,
      );

    return this.tl;
  }

  /** Morph the card back into its slide. */
  close() {
    if (this.state === 'opening') {
      this.state = 'closing';
      if (!this.tl) {
        this.reset();
        return;
      }
      this.tl.reverse();
      return;
    }
    if (this.state !== 'open') return;
    this.state = 'closing';

    const wrapper = this.slide.querySelector('.gallery__img-wrapper');
    const others = this.slides.filter((s) => s !== this.slide);
    const caption = this.slide.querySelector('figcaption');
    const metaEls = Object.values(this.fields).filter(Boolean);
    const gridItems = [...this.gridEl.children];

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
    this.unlockScroll();

    this.slide = null;
    this.tl = null;
    this.state = 'closed';
  }

  // Freeze the page (and the pinned gallery behind it) while the card is
  // open — same effect as the tutorial's slider.stop()/start(), reached
  // here by blocking scroll input rather than disabling an Observer.
  lockScroll() {
    document.documentElement.style.overflow = 'hidden';
  }
  unlockScroll() {
    document.documentElement.style.overflow = '';
  }
}

export default Card;
