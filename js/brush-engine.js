/* ============================================================
   FORGE — brush-engine.js
   Canvas manager · STAMP engine · symmetry · undo · pointer I/O
   Pointer Events only (mouse / touch / stylus).
   ============================================================ */

Forge.Engine = (function () {
  const S = () => Forge.state;
  const clamp = Forge.clamp;

  let canvas, ctx, wrap, ring;
  let dpr = 1, cssW = 0, cssH = 0;
  let drawing = false;
  let lastPos = null;        // last pointer position (css px)
  let lastPointer = null;    // for the ring, even when not drawing
  let spacingCarry = 0;      // px left until the next stamp
  let speed = 0;             // smoothed pointer speed, px/ms
  let lastMoveTime = 0;
  let history = [];
  const MAX_HISTORY = 20;
  const tinted = document.createElement('canvas'); // color-multiplied tip
  let tintedValid = false;
  let ready = false;

  /* ---------------- setup ---------------- */

  function attach(canvasEl, wrapEl, ringEl) {
    canvas = canvasEl; wrap = wrapEl; ring = ringEl;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerenter', () => { if (lastPointer) placeRing(lastPointer); });
    canvas.addEventListener('pointerleave', () => { if (ring) ring.style.display = 'none'; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(wrap);
    window.addEventListener('resize', resize);

    resize();
    ready = true;
  }

  function resize() {
    if (!wrap || !canvas) return;
    const r = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);

    // preserve existing art across resizes
    let prev = null;
    if (canvas.width > 1 && canvas.height > 1) {
      prev = document.createElement('canvas');
      prev.width = canvas.width; prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    cssW = w; cssH = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (prev) ctx.drawImage(prev, 0, 0, w, h);
  }

  /* ---------------- pointer I/O ---------------- */

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onDown(e) {
    if (!e.isPrimary) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}

    const p = pos(e);
    lastPointer = p; placeRing(p);
    drawing = true;
    lastPos = p;
    speed = 0;
    lastMoveTime = e.timeStamp;
    pushHistory(); // pre-stroke snapshot

    if (S().mode === 'stamp') {
      stampAt(p);
      spacingCarry = stampSpacing();
    } else {
      Forge.Flow.resetStroke();
      withSymmetry(() => Forge.Flow.drawDot(ctx, p, Forge.Flow.colorAt(0)));
    }
  }

  function onMove(e) {
    const p = pos(e);
    lastPointer = p; placeRing(p);
    if (!drawing) return;

    const dt = Math.max(1, e.timeStamp - lastMoveTime);
    const d = Math.hypot(p.x - lastPos.x, p.y - lastPos.y);
    speed = speed * 0.6 + (d / dt) * 0.4; // smoothed px/ms
    lastMoveTime = e.timeStamp;

    if (S().mode === 'stamp') stampSegment(lastPos, p);
    else Forge.Flow.step(lastPos, p, fn => withSymmetry(fn));

    lastPos = p;
  }

  function onUp(e) {
    drawing = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  /* ---------------- pressure simulation ---------------- */

  function pressure() {
    // 1 at rest → drops toward 0 as pointer speed approaches MAX_SPEED
    return 1 - S().pressureSens * clamp(speed / S().MAX_SPEED, 0, 1);
  }

  /* ---------------- symmetry ----------------
     Every draw call is re-run under each transform, same frame. */
  function withSymmetry(fn) {
    const st = S();
    if (st.symmetryMode === 'off') { fn(); return; }

    if (st.symmetryMode === 'mirror') {
      fn();
      ctx.save();
      ctx.translate(cssW, 0); ctx.scale(-1, 1);
      fn();
      ctx.restore();
      return;
    }

    // radial — N copies rotated around canvas center
    const n = Math.max(2, Math.round(st.symmetryCount));
    for (let i = 0; i < n; i++) {
      ctx.save();
      if (i > 0) {
        ctx.translate(cssW / 2, cssH / 2);
        ctx.rotate((360 / n) * i * Math.PI / 180);
        ctx.translate(-cssW / 2, -cssH / 2);
      }
      fn();
      ctx.restore();
    }
  }

  /* ---------------- STAMP ENGINE ---------------- */

  function stampSpacing() {
    return Math.max(0.5, S().spacing * S().size);
  }

  function stampSegment(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const seg = Math.hypot(dx, dy);
    if (seg <= 0) return;

    const spacing = stampSpacing();
    let need = spacingCarry > 0 ? spacingCarry : spacing;
    let d = 0;

    while (d + need <= seg) {
      d += need;
      const t = d / seg;
      stampAt({ x: from.x + dx * t, y: from.y + dy * t });
      need = spacing;
    }
    spacingCarry = need - (seg - d);
  }

  function stampAt(pos) {
    withSymmetry(() => {
      for (let i = 0; i < Math.max(1, Math.round(S().count)); i++) stampOnce(pos);
    });
  }

  function stampOnce(pos) {
    const st = S();
    const pressure = Forge.Engine.pressure();

    const angle = st.rotationRandom ? Math.random() * 360 : st.rotation;
    const scale = Math.max(1, (st.size + (Math.random() * 2 - 1) * st.sizeJitter * st.size) * pressure);
    const alpha = clamp(st.opacity * (0.5 + pressure * 0.5), 0, 1);

    const ox = (Math.random() * 2 - 1) * st.scatter;
    const oy = (Math.random() * 2 - 1) * st.scatter;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(pos.x + ox, pos.y + oy);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(tipSource(), -scale / 2, -scale / 2, scale, scale);
    ctx.restore();
  }

  function tipSource() {
    const st = S();
    return (tintedValid && st.color && st.color.toLowerCase() !== '#ffffff') ? tinted : st.tipCanvas;
  }

  /* COLOR swatch tints the tip (multiply keeps shading, white = no-op). */
  function rebuildTintedTip() {
    const st = S();
    if (!st.tipCanvas) return;
    tinted.width = st.tipCanvas.width;
    tinted.height = st.tipCanvas.height;
    const t = tinted.getContext('2d');
    t.clearRect(0, 0, tinted.width, tinted.height);
    t.drawImage(st.tipCanvas, 0, 0);
    t.globalCompositeOperation = 'multiply';
    t.fillStyle = st.color || '#ffffff';
    t.fillRect(0, 0, tinted.width, tinted.height);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(st.tipCanvas, 0, 0);
    t.globalCompositeOperation = 'source-over';
    tintedValid = true;
  }

  /* ---------------- brush ring ---------------- */

  function placeRing(p) {
    if (!ring) return;
    ring.style.display = 'block';
    ring.style.left = p.x + 'px';
    ring.style.top = p.y + 'px';
  }

  function updateRing() {
    if (!ring) return;
    const sz = S().mode === 'stamp' ? S().size : S().flowSize;
    ring.style.width = sz + 'px';
    ring.style.height = sz + 'px';
  }

  /* ---------------- undo ---------------- */

  function pushHistory() {
    let im;
    try { im = ctx.getImageData(0, 0, canvas.width, canvas.height); }
    catch (_) { return; }
    history.push(im);
    historyBytes += im.data.length;
    while (history.length > MAX_HISTORY ||
           (history.length > 1 && historyBytes > HISTORY_BUDGET)) {
      historyBytes -= history.shift().data.length;
    }
  }

  function undo() {
    if (!ready) return;
    const im = history.pop();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (im) ctx.putImageData(im, 0, 0);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function clearCanvas() {
    if (!ready) return;
    pushHistory(); // so Ctrl+Z brings it back
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  /* ---------------- public API ---------------- */

  return {
    attach, resize, undo, clear: clearCanvas,
    updateRing, rebuildTintedTip, pressure,
    context: () => ctx,
    canvasEl: () => canvas,
    ready: () => ready
  };
})();
