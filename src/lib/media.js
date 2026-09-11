/* ============================================================
   media.js — the placeholder fallback for media slots.

   src:null, or an image that fails to load, renders as a stone matte at
   the declared ratio with the alt text set in Micro tier — the same
   footprint the photograph would have occupied, so nothing shifts.
   ============================================================ */

export function mountMedia(root = document) {
  for (const slot of root.querySelectorAll('.ds-media')) {
    if (slot.closest('[data-card]')) continue; // card image: starts blank by design, JS fills it
    const img = slot.querySelector('img');
    if (!img) continue;

    const fallback = () => {
      slot.classList.add('ds-media--empty');
      const span = document.createElement('span');
      span.className = 'ds-media__alt';
      span.textContent = img.alt || '';
      img.replaceWith(span);
    };

    if (!img.getAttribute('src')) fallback();
    else img.addEventListener('error', fallback, { once: true });
  }
}
