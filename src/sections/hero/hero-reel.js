/* ============================================================
   hero-reel.js — the hero film reel (clean frames, no sprocket rails).

   A strip of frames wraps a gentle arc around the camera. Scroll
   turns the reel; frames rise from the haze, pass the wordmark,
   and sink back. At the hand-off the arc straightens and slides
   left where the interiors section takes over.

   Geometry is virtualised: a fixed ring of segments carries a
   moving window of image indices, so 81 photographs cost the
   same as 8.
   ============================================================ */

import * as THREE from 'three';

import { gsap } from '../../lib/motion.js';

/* ---------- shape ---------- */

const SEGMENTS = 22;
const CENTRE = 10;
const FRAME_W = 3;
const FRAME_H = (FRAME_W * 9) / 16;
const GAP = 0.2;
const PITCH = FRAME_W + GAP;
const RADIUS = 11;
const D_THETA = PITCH / RADIUS;
const CAM_Z = 10;
const TEX_BUDGET = 44;

const REEL_TILT_X = -0.08;
const REEL_TILT_Z = 0.02;
const REEL_Y = -0.6;

const FOG_LIGHT = 0xf1efe3;
const FOG_DARK = 0x1d1117;

export function createReel({ canvas, frames, onIndex, motion = true }) {
  const count = frames.length;
  if (!count) return null;

  /* ---------- context ---------- */

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !motion,
    });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  // 22 textured planes redraw every frame while the reel idles, so fragment
  // cost is what this scene actually spends. At DPR 2 on a HiDPI panel that is
  // 4x the fragments of DPR 1 for photographs that are already soft with fog
  // and mipmapping — 1.5 is the point where the extra samples stop showing.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_LIGHT, 0.042);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 0.9, CAM_Z);
  camera.lookAt(0, 0, -1.5);

  const reel = new THREE.Group();
  reel.rotation.set(REEL_TILT_X, 0, REEL_TILT_Z);
  reel.position.y = REEL_Y;
  scene.add(reel);

  const frameGeo = new THREE.PlaneGeometry(FRAME_W, FRAME_H);

  /* ---------- segments ---------- */

  const segs = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const group = new THREE.Group();

    const img = new THREE.Mesh(
      frameGeo,
      new THREE.MeshBasicMaterial({
        color: 0xb8aea2,
        transparent: true,
        opacity: 1,
        fog: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );

    group.add(img);
    reel.add(group);
    segs.push({ group, img, index: -1 });
  }

  /* ---------- textures ---------- */

  const loader = new THREE.TextureLoader();
  const cache = new Map();
  const order = [];

  function texture(i, apply) {
    const hit = cache.get(i);
    if (hit && hit !== 'pending') {
      apply(hit);
      return;
    }
    if (hit === 'pending') return;

    cache.set(i, 'pending');
    loader.load(
      frames[i].reel,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        cache.set(i, tex);
        order.push(i);

        while (order.length > TEX_BUDGET) {
          const old = order.shift();
          if (segs.some((s) => s.index === old)) {
            order.push(old);
            continue;
          }
          cache.get(old)?.dispose?.();
          cache.delete(old);
        }
        apply(tex);
      },
      undefined,
      () => cache.delete(i),
    );
  }

  /* ---------- layout ---------- */

  let target = 0;
  let progress = 0;
  let flat = 0;
  let sway = 0;
  let bob = 0;
  let announced = -1;

  const _arc = new THREE.Vector3();
  const _lin = new THREE.Vector3();

  function layout() {
    const settled = 1 - flat;
    reel.rotation.x = (REEL_TILT_X + bob * 0.06) * settled;
    reel.rotation.z = (REEL_TILT_Z + bob * 0.04) * settled;
    reel.position.y = REEL_Y * settled + bob * 0.16 * settled;

    const head = progress * (count - 1) + sway * settled;
    const frac = head - Math.floor(head);
    const base = Math.floor(head);

    for (let i = 0; i < SEGMENTS; i++) {
      const seg = segs[i];
      const slot = i - frac;
      const idx = (((base + i - CENTRE) % count) + count) % count;

      if (seg.index !== idx) {
        seg.index = idx;
        seg.img.material.map = null;
        seg.img.material.needsUpdate = true;
        texture(idx, (tex) => {
          if (seg.index !== idx) return;
          seg.img.material.map = tex;
          seg.img.material.color.setHex(0xffffff);
          seg.img.material.needsUpdate = true;
          dirty = true;
          if (!running) repaint();
        });
      }

      const theta = (slot - CENTRE) * D_THETA;

      _arc.set(
        Math.sin(theta) * RADIUS,
        (1 - Math.cos(theta)) * 0.18,
        Math.cos(theta) * RADIUS - RADIUS,
      );

      _lin.set((slot - CENTRE) * PITCH - flat * 3.2, 0.9, 4.6);

      seg.group.position.lerpVectors(_arc, _lin, flat);
      seg.group.rotation.y = theta * (1 - flat);

      const near = Math.abs(theta);
      const fade = THREE.MathUtils.clamp(1 - (near - 0.7) * 0.5, 0.05, 1);
      seg.img.material.opacity = THREE.MathUtils.lerp(fade, 1, flat);
    }

    const centre = ((base % count) + count) % count;
    if (centre !== announced) {
      announced = centre;
      onIndex?.(centre);
    }
  }

  /* ---------- frame loop ----------
     Driven by gsap.ticker rather than a raw requestAnimationFrame chain:
     more robust scheduling, and it keeps the reel on the exact same
     per-tick clock as every other GSAP-driven visual on the page.

     progress tracks target directly — no separate lerp here. The stage's
     own ScrollTrigger (scrub:1) already smooths scroll into target; a
     second smoothing pass on top of that only adds lag and desyncs the
     reel from the hero fade / canvas fade / interiors slide, which all
     read that same progress value with no extra filtering of their own.

     Visibility pausing is a throttled getBoundingClientRect() check run
     from inside this same ticker, not IntersectionObserver — its first
     callback can report a canvas as non-intersecting while it plainly
     overlaps the viewport, permanently freezing the loop with no
     recovery path (stop() is called, nothing ever calls start() again).
     A ~4x/second direct geometry check is cheap and self-correcting. */

  const SWAY_RATE = 0.13;
  const SWAY_AMP = 0.07; // scales with frame count — the curated reel carries ~9x fewer frames than the full library
  const BOB_RATE = 0.09;
  const VIS_CHECK_MS = 250;

  let running = true,
    onScreen = true,
    dirty = true;
  let clock = 0,
    visAccum = 0;

  function repaint() {
    layout();
    renderer.render(scene, camera);
    dirty = false;
  }

  function checkOnScreen() {
    const r = canvas.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }

  function tick(time, deltaMs) {
    if (!running) return;

    visAccum += deltaMs;
    if (visAccum >= VIS_CHECK_MS) {
      visAccum = 0;
      onScreen = checkOnScreen();
    }
    if (!onScreen) return;

    const dt = Math.min(deltaMs / 1000, 0.05);
    clock += dt;

    if (motion) {
      sway = Math.sin(clock * SWAY_RATE * Math.PI * 2) * SWAY_AMP;
      bob = Math.sin(clock * BOB_RATE * Math.PI * 2);
      dirty = true;
    }
    if (progress !== target) {
      progress = target;
      dirty = true;
    }

    if (dirty) repaint();
  }

  gsap.ticker.add(tick);

  function resize() {
    const w = canvas.clientWidth || 1,
      h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = CAM_Z * THREE.MathUtils.clamp(1.45 - camera.aspect * 0.28, 1, 1.7);
    camera.updateProjectionMatrix();
    dirty = true;
    if (!running) repaint();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    setProgress(p) {
      target = THREE.MathUtils.clamp(p, 0, 1);
      if (!motion) progress = target;
      dirty = true;
    },
    setFlat(t) {
      flat = THREE.MathUtils.clamp(t, 0, 1);
      dirty = true;
    },
    setTheme(theme) {
      scene.fog.color.setHex(theme === 'dark' ? FOG_DARK : FOG_LIGHT);
      dirty = true;
    },
    freeze() {
      progress = target;
      sway = 0;
      bob = 0;
      running = false;
      repaint();
    },
    dispose() {
      running = false;
      gsap.ticker.remove(tick);
      ro.disconnect();
      cache.forEach((t) => t !== 'pending' && t.dispose?.());
      frameGeo.dispose();
      segs.forEach((s) => {
        s.img.material.dispose();
      });
      renderer.dispose();
    },
  };
}
