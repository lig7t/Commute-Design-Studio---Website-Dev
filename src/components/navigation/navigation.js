/* ============================================================
   navigation.js — the sticky bar: height, anchors, active state, hide.

   The bar is one row wide and two rows narrow, so its height is measured
   rather than assumed. sections/work/work.css reads --nav-h to keep the
   pinned interiors headline clear of it; a hardcoded value under-clears on
   mobile.
   ============================================================ */

import { gsap, hasGsap, reduced } from '../../lib/motion.js';

export function mountNavHeight() {
  const nav = document.querySelector('.ds-nav');
  if (!nav) return;

  const apply = () => {
    const h = nav.getBoundingClientRect().height;
    if (h > 0) document.documentElement.style.setProperty('--nav-h', `${Math.round(h)}px`);
  };

  apply();
  if ('ResizeObserver' in window) new ResizeObserver(apply).observe(nav);
  else window.addEventListener('resize', apply);
}

export function mountAnchors() {
  if (!hasGsap || reduced || !gsap.plugins?.scrollTo) return;

  for (const a of document.querySelectorAll('a[href^="#"]')) {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      gsap.to(window, {
        duration: 1.15,
        ease: 'power2.inOut',
        scrollTo: { y: el, autoKill: true },
      });
    });
  }
}

export function mountNav() {
  const links = [...document.querySelectorAll('.ds-navlink[data-section]')];
  if (!links.length || !('IntersectionObserver' in window)) return;

  const sections = links.map((l) => document.getElementById(l.dataset.section)).filter(Boolean);
  if (!sections.length) return;

  const visible = new Map();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
        else visible.delete(e.target.id);
      }
      let best = null,
        ratio = 0;
      for (const [id, r] of visible)
        if (r > ratio) {
          best = id;
          ratio = r;
        }
      for (const link of links) {
        if (best && link.dataset.section === best) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },
    { threshold: [0.15, 0.4, 0.7] },
  );

  sections.forEach((s) => io.observe(s));
}

export function mountDrawer() {
  const burger = document.querySelector('[data-nav-burger]');
  const drawer = document.querySelector('[data-nav-drawer]');
  if (!burger || !drawer) return;

  const backdrop = drawer.querySelector('[data-drawer-backdrop]');
  const panel = drawer.querySelector('.ds-drawer__panel');
  const links = drawer.querySelectorAll('.ds-drawer__link');
  const socialLinks = drawer.querySelectorAll('.ds-drawer__social-link');
  const toggle = drawer.querySelector('.ds-toggle--drawer');
  let isOpen = false;
  const mq = matchMedia('(max-width:760px)');

  const rule = drawer.querySelector('.ds-drawer__rule');
  const staggerEls = [rule, toggle, ...socialLinks].filter(Boolean);

  const arm = () => {
    gsap.set(backdrop, { autoAlpha: 0 });
    gsap.set(panel, { autoAlpha: 0 });
    gsap.set(links, { autoAlpha: 0, y: 20 });
    gsap.set(staggerEls, { autoAlpha: 0, y: 12 });
  };
  if (mq.matches) arm();

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.documentElement.style.overflow = 'hidden';

    gsap.set(drawer, { pointerEvents: 'auto' });
    gsap.to(backdrop, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' });
    gsap.set(panel, { autoAlpha: 1 });
    gsap.to(links, {
      autoAlpha: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.07,
      delay: 0.15,
      ease: 'power3.out',
    });
    gsap.to(staggerEls, {
      autoAlpha: 1,
      y: 0,
      duration: 0.45,
      stagger: 0.06,
      delay: 0.35,
      ease: 'power3.out',
    });
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.documentElement.style.overflow = '';

    gsap.to(backdrop, {
      autoAlpha: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        gsap.set(panel, { autoAlpha: 0 });
        gsap.set(links, { autoAlpha: 0, y: 20 });
        gsap.set(staggerEls, { autoAlpha: 0, y: 12 });
        gsap.set(drawer, { pointerEvents: 'none' });
      },
    });
  };

  burger.addEventListener('click', () => (isOpen ? close() : open()));

  backdrop?.addEventListener('click', close);

  links.forEach((link) => link.addEventListener('click', () => close()));
  socialLinks.forEach((link) => link.addEventListener('click', () => close()));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });
}
