/* ============================================================
   works.js — the works manifest, and the one place asset URLs are built.

   Image paths are constructed as runtime strings, so a bundler can never
   see or rewrite them. That is why every works image lives in public/ —
   Vite copies that directory through untouched, with no hashing — and why
   asset() is the only thing that turns a manifest path into a URL.

   Keep it that way: a second place that builds these URLs is a second
   place to get the deployment base wrong.
   ============================================================ */

/** Resolve a manifest-relative path ("images/works/full/001.webp") against
    the deployment base. BASE_URL is "/" on Vercel; setting `base` in
    vite.config.js for a sub-path deploy is all this needs to keep working. */
export const asset = (p) => `${import.meta.env.BASE_URL}${p}`;

export async function loadWorks() {
  try {
    const res = await fetch(asset('images/works/works.json'));
    if (!res.ok) throw new Error(res.status);
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list.map((w) => ({
      ...w,
      reel: asset(w.reel),
      full: asset(w.full),
    }));
  } catch {
    return [];
  }
}
