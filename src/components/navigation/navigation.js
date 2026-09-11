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

/* mountNavHide removed — nav is always visible (position:fixed, z-index:20). */
