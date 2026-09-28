/* ============================================================
   FORGE — flow-mode.js — THE HEADLINE FEATURE
   The image is the palette. Colors are sampled in sequence from
   the brush tip and smeared along the stroke as you draw — like
   dragging wet paint made of the image's pigments.
   ============================================================ */

Forge.Flow = {
  palette: [],        // [{r,g,b,a}] × 256, in image order
  strokeDistance: 0,  // total px traveled since stroke began
  traveled: 0,        // sub-px accumulator (one dot per px)

  /* ----------------------------------------------------------
     4.1 — Color sampling (runs once on image load / mode switch)
     Scan horizontally across the vertical center of the image.
     If a sample lands on transparency, hunt up/down that column
     for the nearest opaque pixel so wide/tall images still give
     a full-bleed palette. Falls back to a grid scan, then to a
     built-in gradient so Flow mode NEVER strobes out empty.
     ---------------------------------------------------------- */
  samplePalette(tipCanvas) {
    const w = tipCanvas.width, h = tipCanvas.height;
    const data = tipCanvas.getContext('2d').getImageData(0, 0, w, h).data;
    const N = 256, y = (h / 2) | 0;
    const out = [];

    for (let i = 0; i < N; i++) {
      const x = Math.min(w - 1, Math.floor((i / N) * w));
      const c = this._pickOpaque(data, w, h, x, y);
      if (c) out.push(c);
    }

    if (out.length < 16) {
      // column fallback failed (very sparse tip) → grid scan
      out.length = 0;
      const G = 48;
      for (let gy = 0; gy < G; gy++) {
        for (let gx = 0; gx < G; gx++) {
          const x = Math.min(w - 1, Math.floor((gx / G) * w));
          const yy = Math.min(h - 1, Math.floor((gy / G) * h));
          const c = this._at(data, w, x, yy);
          if (c && c.a >= 10) out.push(c);
        }
      }
    }

    if (out.length < 2) {
      // absolute fallback: lime → white → violet
      out.length = 0;
      for (let i = 0; i < 256; i++) {
        const t = i / 255;
        let r, g, b;
        if (t < 0.5) {
          const k = t * 2;
          r = Forge.lerp(200, 255, k); g = 255; b = Forge.lerp(0, 255, k);
        } else {
          const k = (t - 0.5) * 2;
          r = Forge.lerp(255, 168, k); g = Forge.lerp(255, 85, k); b = Forge.lerp(255, 247, k);
        }
        out.push({ r: Math.round(r), g: Math.round(g), b: Math.round(b), a: 255 });
      }
    }

    this.palette = out;
    return out;
  },

  _at(data, w, x, y) {
    const i = (y * w + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
  },

  _pickOpaque(data, w, h, x, y) {
    let c = this._at(data, w, x, y);
    if (c.a >= 10) return c;
    const maxR = (h / 2) | 0;
    for (let r = 1; r <= maxR; r++) {
      if (y - r >= 0) { c = this._at(data, w, x, y - r); if (c.a >= 10) return c; }
      if (y + r <  h) { c = this._at(data, w, x, y + r); if (c.a >= 10) return c; }
    }
    return null;
  },

  resetStroke() {
    this.strokeDistance = 0;
    this.traveled = 0;
  },

  /* Color at a given distance along the stroke.
     paletteT = (strokeDistance * flowSpeed) % palette.length
     Smoothing lerps between adjacent palette entries — without it
     the stroke strobes; with it you get a wet-paint gradient. */
  colorAt(sd) {
    const S = Forge.state, pal = this.palette;
    if (!pal.length) return { r: 255, g: 255, b: 255, a: 255 };
    const paletteT = (sd * S.flowSpeed) % pal.length;
    const i0 = Math.floor(paletteT);
    const i1 = (i0 + 1) % pal.length;
    const t = paletteT - i0;
    const k = S.smoothing * t;                 // smoothing × t
    const a = pal[i0], b = pal[i1];
    return {
      r: Math.round(Forge.lerp(a.r, b.r, k)),
      g: Math.round(Forge.lerp(a.g, b.g, k)),
      b: Math.round(Forge.lerp(a.b, b.b, k)),
      a: Forge.lerp(a.a, b.a, k)
    };
  },

  /* ----------------------------------------------------------
     4.2 — Drawing loop. Advances along the segment one px at a
     time, drawing a soft radial dot at the interpolated position
     with the palette color at that exact distance. `wrapper`
     re-draws each dot under every symmetry transform.
     ---------------------------------------------------------- */
  step(from, to, wrapper) {
    const seg = Math.hypot(to.x - from.x, to.y - from.y);
    if (seg <= 0 || !this.palette.length) return;

    this.traveled += seg;
    let consumed = 0;

    while (this.traveled >= 1) {
      this.traveled -= 1;
      consumed += 1;

      const cc = Math.min(consumed, seg);
      const t = cc / seg;
      const pos = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t
      };
      const col = this.colorAt(this.strokeDistance + consumed);
      const ctx = Forge.Engine.context();
      wrapper(() => this.drawDot(ctx, pos, col));

      if (consumed >= seg) break; // remainder carries into next segment
    }

    this.strokeDistance += seg;
  },

  /* Soft round smear dot — hard color center bleeding to nothing. */
  drawDot(ctx, pos, color) {
    const S = Forge.state;
    const pressure = Forge.Engine.pressure();
    const r = (S.flowSize / 2) * pressure;
    if (r < 0.4) return;

    const ox = (Math.random() * 2 - 1) * S.flowScatter;
    const oy = (Math.random() * 2 - 1) * S.flowScatter;
    const x = pos.x + ox, y = pos.y + oy;
    const alpha = Forge.clamp(S.flowOpacity * (color.a / 255), 0, 1);

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${alpha})`);
    grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
};
