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

/* Resolve once every image in `images` has actually painted, reporting
   fractional progress as they land.

   WHY THIS EXISTS. window 'load' is not enough on this page. The gallery's
   slides are built by JS at the end of an async chain, so their <img>s do not
   exist when 'load' fires and are not covered by it. Waiting on them here is
   what stops the boot screen lifting onto a grid of grey .ds-media mattes.

   `complete` alone is also not enough: it goes true when the bytes are in, not
   when the frame is decoded and paintable, so a large WebP can be `complete`
   and still flash grey for a frame or two. decode() is the only thing that
   answers the question the reader is actually asking.

   FAILURE IS PROGRESS. A broken or 404 image resolves rather than rejects —
   mountMedia() already swaps those for a labelled matte, so they are handled,
   and one bad asset must never be able to hold the overlay up.

   The timeout is a per-call ceiling and NOT the real safety net: loader.js's
   SAFETY_MS still backstops the whole screen. This one exists so a single
   pathological image degrades to "carry on without it" rather than spending
   the entire safety budget. */
export function decodeAll(images, onProgress, timeoutMs = 9000) {
  const list = [...images].filter((img) => img && img.getAttribute('src'));

  if (!list.length) {
    onProgress?.(1);
    return Promise.resolve();
  }

  let done = 0;
  const bump = () => onProgress?.(++done / list.length);

  const settled = (img) => {
    // Decoded and paintable: decode() resolves immediately on an image the
    // browser already has, so this is not a second network trip.
    if (img.complete && img.naturalWidth > 0) {
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    }
    return new Promise((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  };

  const all = Promise.all(list.map((img) => settled(img).then(bump, bump)));

  return Promise.race([
    all,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    // Whichever wins, the caller is told the wait is over — otherwise a
    // timeout would leave the counter stranded below 100 with nothing left
    // to advance it.
  ]).then(() => onProgress?.(1));
}
