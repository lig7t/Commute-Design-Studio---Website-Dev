/* ============================================================
   theme-toggle.js — the two-label pill that switches the surface.

   The control, not the state: it writes through setTheme() and reads back
   through onThemeChange(), so the pressed state stays correct even if the
   surface is changed by something other than a click.

   aria-pressed is a held state here, not a transient — it reflects which
   surface is active, which is why it is re-applied on every change rather
   than toggled on click.
   ============================================================ */

import { getTheme, setTheme, onThemeChange } from '../../lib/theme.js';

export function mountThemeToggle() {
  const buttons = [...document.querySelectorAll('[data-theme-option]')];
  if (!buttons.length) return;

  const reflect = (theme) => {
    for (const btn of buttons) {
      btn.setAttribute('aria-pressed', String(btn.dataset.themeOption === theme));
    }
  };

  reflect(getTheme());
  onThemeChange(reflect);

  for (const btn of buttons) {
    btn.addEventListener('click', () => setTheme(btn.dataset.themeOption));
  }
}
