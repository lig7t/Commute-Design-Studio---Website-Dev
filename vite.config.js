import { defineConfig } from 'vite';

export default defineConfig({
  // public/ is copied through verbatim, never hashed. That is deliberate and
  // load-bearing: every works image is referenced by a runtime-built string
  // (see modules/works.js), which no bundler can see or rewrite. Moving those
  // files into src/ would hash their names and break all 162 of them.
  publicDir: 'public',

  build: {
    outDir: 'dist',
    // The reel ships the whole of three; without this the default 500 kB
    // warning fires on every build and trains you to ignore it.
    chunkSizeWarningLimit: 900,
  },

  server: {
    port: 5173,
    open: false,
  },
});
