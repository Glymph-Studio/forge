/* ============================================================
   forge · brush-engine.js
   canvas manager · stamp engine · symmetry · history · pointer I/O
   Pointer Events only (mouse, touch, stylus).

   History design (the "undo actually works" edition):
   · a snapshot is taken the moment a stroke FINISHES, not when it starts
   · the stack starts with the blank canvas, so undo always has a floor
   · a cursor walks the stack: undo steps back, redo steps forward
   · clear pushes a snapshot too, so clearing is itself undoable
   ============================================================ */

Forge.Engine = (function () {
  const S = () => Forge.state;
  const clamp = Forge.clamp;

  let canvas, ctx, wrap, ring;
  let dpr = 1, cssW = 0, cssH = 0;
  let drawing = false;
  let strokeDirty = false;   // did this stroke actually paint anything
  let lastPos = null;
  let lastPointer = null;
  let spacingCarry = 0;
  let speed = 0;
  let lastMoveTime = 0;
  let ready = false;

  /* the color-multiplied copy of the tip used by the color swatch */
  const tinted = document.createElement('canvas');
  let tintedValid = false;

  /* ~~~~~~~~~~~~~~~~ history ~~~~~~~~~~~~~~~~ */

  let history = [];
  let histIndex = -1;
  let historyBytes = 0;
  const MAX_HISTORY = 30;
  const HISTORY_BUDGET = 320 * 1024 * 1024; // bytes, keeps hi-dpi sane

  function syncButtons() {
    if (Forge.UI && Forge.UI.syncHistoryButtons) Forge.UI.syncHistoryButtons();
  }

  function pushSnapshot() {
    if (!ready) return;
    let im;
    try { im = ctx.getImageData(0, 0, canvas.width, canvas.height); }
    catch (_) { return; }

    // drop any redo tail
    while (history.length > histIndex + 1) {
      historyBytes -= history.pop().data.length;
    }

    history.push(im);
    histIndex++;
    historyBytes += im.data.length;

    // trim the oldest end, keeping the cursor aligned
    while (history.length > 1 &&
           (history.length > MAX_HISTORY || historyBytes > HISTORY_BUDGET)) {
      historyBytes -= history.shift().data.length;
      histIndex--;
    }
    syncButtons();
  }

  function restoreSnapshot(im) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(im, 0, 0);
    ctx.restore();
  }

  function undo() {
    if (!ready || histIndex <= 0) {
      if (Forge.UI) Forge.UI.toast('Nothing left to undo');
      return false;
    }
    histIndex--;
    restoreSnapshot(history[histIndex]);
    syncButtons();
    return true;
  }

  function redo() {
    if (!ready || histIndex >= history.length - 1) {
      if (Forge.UI) Forge.UI.toast('Nothing to redo');
      return false;
    }
    histIndex++;
    restoreSnapshot(history[histIndex]);
    syncButtons();
    return true;
  }

  function canUndo() { return ready && histIndex > 0; }
  function canRedo() { return ready && histIndex < history.length - 1; }

  /* ~~~~~~~~~~~~~~~~ setup ~~~~~~~~~~~~~~~~ */

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
    pushSnapshot(); // floor of the stack: the blank canvas
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

  /* ~~~~~~~~~~~~~~~~ pointer I/O ~~~~~~~~~~~~~~~~ */

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
    strokeDirty = false;
    lastPos = p;
    speed = 0;
    lastMoveTime = e.timeStamp;

    if (S().mode === 'stamp') {
      stampAt(p);
      strokeDirty = true;
      spacingCarry = stampSpacing();
    } else {
      Forge.Flow.resetStroke();
      withSymmetry(() => Forge.Flow.drawDot(ctx, p, Forge.Flow.colorAt(0)));
      strokeDirty = true;
    }
  }

  function onMove(e) {
    const p = pos(e);
    lastPointer = p; placeRing(p);
    if (!drawing) return;

    const dt = Math.max(1, e.timeStamp - lastMoveTime);
    const d = Math.hypot(p.x - lastPos.x, p.y - lastPos.y);
    if (d > 0) strokeDirty = true;
    speed = speed * 0.6 + (d / dt) * 0.4; // smoothed px per ms
    lastMoveTime = e.timeStamp;

    if (S().mode === 'stamp') stampSegment(lastPos, p);
    else Forge.Flow.step(lastPos, p, fn => withSymmetry(fn));

    lastPos = p;
  }

  function onUp(e) {
    if (drawing && strokeDirty) pushSnapshot(); // one snapshot per finished stroke
    drawing = false;
    strokeDirty = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  }

  /* ~~~~~~~~~~~~~~~~ pressure simulation ~~~~~~~~~~~~~~~~ */

  function pressure() {
    // 1 at rest, drops toward 0 as the pointer approaches MAX_SPEED
    return 1 - S().pressureSens * clamp(speed / S().MAX_SPEED, 0, 1);
  }

  /* ~~~~~~~~~~~~~~~~ symmetry ~~~~~~~~~~~~~~~~
     every draw call re-runs under each transform, same frame */
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

    // radial · N copies rotated around the canvas center
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

  /* ~~~~~~~~~~~~~~~~ stamp engine ~~~~~~~~~~~~~~~~ */

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

  /* the color swatch tints the tip (multiply keeps shading, white is a no-op) */
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

  /* ~~~~~~~~~~~~~~~~ brush ring ~~~~~~~~~~~~~~~~ */

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

  /* ~~~~~~~~~~~~~~~~ clear ~~~~~~~~~~~~~~~~ */

  function clearCanvas() {
    if (!ready) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    pushSnapshot(); // clearing is undoable like anything else
    if (Forge.UI) Forge.UI.toast('Canvas cleared');
  }

  /* ~~~~~~~~~~~~~~~~ public api ~~~~~~~~~~~~~~~~ */

  return {
    attach, resize, undo, redo, clear: clearCanvas,
    canUndo, canRedo,
    updateRing, rebuildTintedTip, pressure,
    context: () => ctx,
    canvasEl: () => canvas,
    ready: () => ready
  };
})();
