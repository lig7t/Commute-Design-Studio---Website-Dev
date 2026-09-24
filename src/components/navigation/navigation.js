/* ============================================================
   navigation.js — the sticky bar: height, anchors, active state, hide.

   The bar is one row wide and two rows narrow, so its height is measured
   rather than assumed. sections/work/work.css reads --nav-h to keep the
   pinned interiors headline clear of it; a hardcoded value under-clears on
   mobile.
   ============================================================ */

import { gsap, hasGsap, reduced } from '../../lib/motion.js';
import { lockScroll, unlockScroll } from '../../lib/scroll-lock.js';

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
      /* A link that owns a drawer sub-view is not a jump link any more — it
         opens a menu level, and mountNavProjects scrolls the background itself
         to a place this generic handler cannot compute. Checked at click time,
         not bind time, because the attribute is added later.

         It matters concretely: #work resolves to document y=0, because .work is
         absolutely positioned inside the pinned stage. Letting this run would
         scroll the page to the TOP while the reader was asking for interiors. */
      if (a.hasAttribute('aria-expanded')) return;
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

/* Which section the reader is currently in, and who wants to know.

   One owner, because two things now depend on it: the nav links' aria-current,
   and the project list below. A second IntersectionObserver watching the same
   sections would be a second opinion about the same fact, and the two would
   disagree at exactly the thresholds where it matters. Subscribers are called
   immediately on subscribe so a late subscriber is never a frame behind. */
let activeSection = null;
const sectionSubscribers = new Set();

function setActiveSection(id) {
  if (id === activeSection) return;
  activeSection = id;
  for (const fn of sectionSubscribers) fn(id);
}

export function onSectionChange(fn) {
  sectionSubscribers.add(fn);
  fn(activeSection);
  return () => sectionSubscribers.delete(fn);
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
      setActiveSection(best);
    },
    { threshold: [0.15, 0.4, 0.7] },
  );

  sections.forEach((s) => io.observe(s));
}

/* Anything that needs to unwind when the drawer closes. A Set rather than a
   single callback because the drawer is shared furniture and more than one
   feature can own state inside it; mountNavProjects uses this to put the menu
   back on its top level. Registered before mountDrawer() runs in some orders
   and after in others, so the Set lives at module scope rather than inside
   either function. */
const drawerCloseHooks = new Set();

export function onDrawerClose(fn) {
  drawerCloseHooks.add(fn);
  return () => drawerCloseHooks.delete(fn);
}

/* Suspend/resume, as opposed to close/open.

   The drawer has to get out of the way while a project card is up and come
   back when it goes, WITHOUT unwinding: isOpen stays true, the sub-view stays
   on level two, and the close hooks do not run — so the reader returns to the
   project list they picked from rather than to the top of the menu.

   Assigned by mountDrawer() because the real work needs its closure (isOpen,
   the panel, the lock). Exported as thin wrappers so callers do not have to
   care whether the drawer was ever mounted. */
let suspendImpl = null;
let resumeImpl = null;

export function suspendDrawer() {
  suspendImpl?.();
}
export function resumeDrawer() {
  resumeImpl?.();
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
  /* Declared up here with isOpen, not beside suspendImpl below, because the
     Escape handler closes over it. Same class of ordering hazard as the
     reveal.js TDZ bug: harmless today only because nothing reads it before
     this line runs, which is exactly the kind of "fine until it isn't" this
     repo has already paid for once. */
  let suspended = false;
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
    lockScroll();

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
    for (const fn of drawerCloseHooks) fn();
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    unlockScroll();

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

  links.forEach((link) =>
    link.addEventListener('click', () => {
      // A link that owns a sub-view opens a menu level instead of navigating,
      // so closing here would shut the menu the reader just drilled into.
      if (link.hasAttribute('aria-expanded')) return;
      close();
    }),
  );
  socialLinks.forEach((link) => link.addEventListener('click', () => close()));

  document.addEventListener('keydown', (e) => {
    // Not while suspended: the card is on top and owns Escape. Both closing at
    // once would race the card's resume against the drawer's teardown.
    if (e.key === 'Escape' && isOpen && !suspended) close();
  });

  /* Step aside for an overlay, and come back when it has gone. isOpen is
     untouched, the close hooks do not run, and the sub-view keeps its level —
     so the reader lands back on the project list they picked from. */
  suspendImpl = () => {
    if (!isOpen || suspended) return;
    suspended = true;
    drawer.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    gsap.set(drawer, { pointerEvents: 'none' });
    gsap.to(drawer, { autoAlpha: 0, duration: 0.25, ease: 'power2.in' });
  };

  resumeImpl = () => {
    if (!isOpen || !suspended) return;
    suspended = false;
    drawer.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    gsap.set(drawer, { pointerEvents: 'auto' });
    gsap.to(drawer, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
  };
}

/* ---------- the section's own sub-list (the projects under "Interiors") ----

   Generic on purpose. This function is handed a list of {index, title} and a
   callback, and has no idea what a project, a gallery or a card is — which is
   what keeps it inside the dependency rule in CLAUDE.md: components must not
   import sections. main.js owns the coupling and passes the data down.

   TWO SURFACES, TWO RULES.

     Desktop   a panel under the nav link, shown while that section is the one
               the reader is in, and also on hover/focus of the link so it is
               reachable from anywhere on the page rather than only once you
               have scrolled far enough to trigger it.
     Drawer    a second level the reader has to ask for. Tapping the section's
               link opens a sub-view listing its projects, with a breadcrumb
               back to the top-level menu. It is NEVER opened by scroll
               position — on a phone the menu is a place you went on purpose,
               and finding it already two levels deep because of where the
               page happened to be scrolled is disorienting. The section-active
               signal drives the desktop panel and nothing else.

   BUTTONS, NOT LINKS. These open an overlay in place; they do not navigate and
   there is no URL to give them. An <a href="#work"> that opened a card would
   lie to middle-click, to "copy link", and to a screen reader. */
export function mountNavProjects({ sectionId, items, onSelect, onSectionOpen } = {}) {
  if (!sectionId || !items?.length || typeof onSelect !== 'function') return;

  const build = (listClass, itemClass, insideDrawer) => {
    const list = document.createElement('ul');
    list.className = listClass;

    for (const item of items) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = itemClass;
      btn.textContent = item.title;
      btn.addEventListener('click', async () => {
        /* In the drawer the menu does NOT close — it stands aside for the card
           and comes back when the card does. onSelect resolves on close, which
           is the whole reason it is a promise: this code never learns that a
           card exists, only that the thing it opened has finished.

           try/finally, because a rejected or guarded open must still give the
           reader their menu back rather than leaving it invisible with the
           scroll still locked. */
        if (!insideDrawer) {
          onSelect(item.index);
          return;
        }
        suspendDrawer();
        try {
          await onSelect(item.index);
        } finally {
          resumeDrawer();
        }
      });
      li.appendChild(btn);
      list.appendChild(li);
    }
    return list;
  };

  // --- desktop ---
  const navLink = document.querySelector(`.ds-navlink[data-section="${sectionId}"]`);
  const host = navLink?.parentElement; // the <li>, which the CSS makes the containing block
  if (host) {
    const panel = build('ds-nav__projects', 'ds-nav__project');
    host.appendChild(panel);
    // Hover/focus is CSS (:hover / :focus-within on the li). This class is the
    // scroll-driven half, and the two are OR'd in the stylesheet rather than
    // here so the pointer path costs no JS at all.
    onSectionChange((id) => host.classList.toggle('is-current-section', id === sectionId));
  }

  // --- drawer: a second level, reached on purpose ---
  const drawerLink = document.querySelector(`.ds-drawer__link[data-section="${sectionId}"]`);
  const rootView = drawerLink?.closest('nav');
  const panel = drawerLink?.closest('.ds-drawer__panel');
  if (!drawerLink || !rootView || !panel) return;

  const sub = document.createElement('div');
  sub.className = 'ds-drawer__sub';
  sub.hidden = true;

  /* A real <nav>/<ol> breadcrumb rather than a lone back arrow: it says where
     you are as well as offering the way out, which is the whole point of
     asking for breadcrumbs on a menu that can now be two deep. */
  const crumbNav = document.createElement('nav');
  crumbNav.className = 'ds-drawer__crumbs';
  crumbNav.setAttribute('aria-label', 'Breadcrumb');
  const crumbList = document.createElement('ol');

  const backLi = document.createElement('li');
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'ds-drawer__crumb';
  back.textContent = 'Menu';
  backLi.appendChild(back);

  const hereLi = document.createElement('li');
  hereLi.className = 'ds-drawer__crumb-current';
  hereLi.setAttribute('aria-current', 'page');
  hereLi.textContent = drawerLink.textContent.trim();

  crumbList.append(backLi, hereLi);
  crumbNav.appendChild(crumbList);

  /* The section itself is still reachable. Tapping the top-level link now
     opens this view instead of navigating, so the navigation it used to do has
     to reappear somewhere or it is simply lost — a reader who wants the
     section rather than one project would otherwise have no route to it. */
  const all = document.createElement('a');
  all.className = 'ds-drawer__link ds-drawer__link--all';
  all.href = `#${sectionId}`;
  all.textContent = `All ${drawerLink.textContent.trim().toLowerCase()}`;

  sub.append(crumbNav, all, build('ds-drawer__projects', 'ds-drawer__project', true));
  panel.insertBefore(sub, rootView.nextSibling);

  const showSub = (on) => {
    rootView.hidden = on;
    sub.hidden = !on;
    drawerLink.setAttribute('aria-expanded', String(on));
    // Focus follows the view, or a keyboard reader is left on a control that
    // is now display:none and loses their place entirely.
    if (on) back.focus();
    else drawerLink.focus();
  };

  drawerLink.setAttribute('aria-expanded', 'false');
  drawerLink.addEventListener('click', (e) => {
    // Only intercepts where the second level exists. The drawer is the only
    // surface that renders it, and the drawer is mobile-only.
    e.preventDefault();
    showSub(true);
    /* Move the page behind the open menu, so dismissing the menu leaves the
       reader on the section they asked for rather than wherever they were.
       Delegated: #work's own offset is 0 (it is absolutely positioned inside
       the pinned stage), so the real target is a progress through that pin,
       which only the hero can compute. Scrolling works even though the drawer
       holds the page — overflow:hidden stops the reader scrolling, not us. */
    onSectionOpen?.();
  });
  back.addEventListener('click', () => showSub(false));
  // Picking "All <section>" navigates for real, so the menu must not be left
  // parked on level two for the next open.
  all.addEventListener('click', (e) => {
    // Never bound by mountAnchors — it was created after that ran — so the
    // scroll is ours to do, and the href stays for semantics and no-JS.
    e.preventDefault();
    rootView.hidden = false;
    sub.hidden = true;
    drawerLink.setAttribute('aria-expanded', 'false');
    document.querySelector('[data-nav-burger]')?.click(); // closes the drawer
    onSectionOpen?.();
  });

  /* Reset on close, without focus moving. The drawer going away is not a
     "back" gesture — the reader should simply find the menu at its top level
     next time they open it, and calling showSub(false) here would yank focus
     onto a link inside a drawer that is closing. */
  onDrawerClose(() => {
    rootView.hidden = false;
    sub.hidden = true;
    drawerLink.setAttribute('aria-expanded', 'false');
  });
}
