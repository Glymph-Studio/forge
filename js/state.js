/* ============================================================
   forge · state.js · shared state + tiny helpers
   ============================================================ */

window.Forge = window.Forge || {};

Forge.state = {
  mode: 'stamp',

  // stamp engine
  spacing: 0.25,        // ratio of tip size
  size: 90,             // px
  sizeJitter: 0.25,     // 0 to 1
  scatter: 0,           // px (stamp)
  rotation: 0,          // degrees
  rotationRandom: false,
  opacity: 1.0,
  count: 1,

  // flow engine
  flowSize: 64,         // px (smear dot size)
  flowSpeed: 1.0,       // color cycle speed per px traveled
  smoothing: 0.85,      // lerp between sampled colors
  flowScatter: 0,       // px (flow)
  flowOpacity: 0.9,

  // shared
  pressureSens: 0.5,    // how much speed affects size and opacity
  symmetryMode: 'off',  // off | mirror | radial
  symmetryCount: 6,

  // runtime
  color: '#ffffff',     // stamp tint (multiply)
  bg: '#ffffff',        // paper white
  tipName: 'diamond',
  tipCanvas: null,      // normalized 256x256 canvas
  MAX_SPEED: 3.0        // px/ms treated as full speed
};

Forge.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
Forge.lerp  = (a, b, t) => a + (b - a) * t;

Forge.slug = s =>
  String(s || 'brush').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'brush';
