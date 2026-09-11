/* ============================================================
   text.js — hand-rolled text splitting.

   These two functions stand in for GSAP's SplitText. splitChars() is used
   by the gallery caption reveal (gallery.js); splitWords() is used by the
   sitewide headline reveal (reveal.js) and by the pinned interiors word
   stagger (sections/hero/hero.js). Both mutate the element's DOM directly rather than
   returning a copy — callers hold the returned spans and animate them.
   ============================================================ */

/* ---------- splitChars ----------
   One span per character. Fine for a short, single-line caption where
   the element has no meaningful child structure to preserve. */

export function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [];
  for (const ch of text) {
    const span = document.createElement('span');
    span.textContent = ch;
    span.style.display = 'inline-block';
    span.style.whiteSpace = 'pre';
    el.appendChild(span);
    chars.push(span);
  }
  return chars;
}

/* ---------- splitWords ----------
   One span per word, for headlines. Unlike splitChars this cannot just
   flatten el.textContent — a headline like ".work__title" is markup
   ("The Tactile Beauty<br>of Craft."), and a naive rebuild would drop the
   <br> and collapse the line. So this walks the existing child nodes and
   only ever replaces TEXT nodes, recursing into element children but
   leaving a <br> (and everything else that isn't text) untouched in place.

   The inter-word whitespace is re-emitted as real text nodes between the
   spans, not discarded — the spans are display:inline-block (see
   .ds-word in design-system/elements/typography.css), and without the
   whitespace nodes the
   words would run together with no possible line break between them. */

export function splitWords(el) {
  if (el.dataset.split) return [...el.querySelectorAll('.ds-word')];

  const text = el.textContent;
  const words = [];

  function walk(parent) {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const span = document.createElement('span');
            span.className = 'ds-word';
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          }
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    }
  }

  walk(el);

  // Chopping the heading into word spans would otherwise leave assistive
  // tech reading it word-by-word (or not at all, for the two targets that
  // are referenced elsewhere via aria-labelledby) — pin the clean string
  // captured before the split as the element's accessible name.
  el.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim());
  el.dataset.split = 'words';
  return words;
}
