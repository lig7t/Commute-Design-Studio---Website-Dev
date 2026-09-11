/* ============================================================
   theme.js — the light/dark surface, as state.

   The initial surface is already resolved by the inline script in
   index.html, before first paint, so the page never flashes. This module
   owns it from then on: what the current surface is, how it changes, and
   who gets told.

   It deliberately knows nothing about the control that drives it (see
   components/theme-toggle) or about the consumers that follow it (the
   WebGL reel sets its fog from the surface). Both subscribe. Importing
   them here instead would make this module a cycle.
   ============================================================ */

const STORAGE_KEY = 'commute:theme';

const listeners = new Set();

/** The current surface, read from the DOM so it agrees with the pre-paint script. */
export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Subscribe to surface changes. Returns an unsubscribe function. */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  for (const fn of listeners) fn(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
}

/** Resolve the starting surface: stored choice, else the OS preference. */
export function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
  const initial =
    stored === 'light' || stored === 'dark'
      ? stored
      : matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  setTheme(initial);
}
