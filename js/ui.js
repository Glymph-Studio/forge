/* ============================================================
   forge · ui.js · panels, sliders, upload, png maker, toasts
   ============================================================ */

Forge.UI = (function () {
  const S = () => Forge.state;
  const $ = id => document.getElementById(id);

  const pct = v => Math.round(v * 100) + '%';
  const px  = v => Math.round(v) + 'px';
  const int = v => String(Math.round(v));

  const SLIDERS = [
    // stamp
    { key: 'spacing',    label: 'Spacing',     min: 0.1, max: 2,   step: 0.01, group: 'stamp',  fmt: v => (+v).toFixed(2) + 'x' },
    { key: 'size',       label: 'Size',        min: 10,  max: 300, step: 1,    group: 'stamp',  fmt: px },
    { key: 'sizeJitter', label: 'Size jitter', min: 0,   max: 1,   step: 0.01, group: 'stamp',  fmt: pct },
    { key: 'scatter',    label: 'Scatter',     min: 0,   max: 200, step: 1,    group: 'stamp',  fmt: px },
    { key: 'opacity',    label: 'Opacity',     min: 0.05, max: 1,  step: 0.01, group: 'stamp',  fmt: pct },
    { key: 'count',      label: 'Count',       min: 1,   max: 12,  step: 1,    group: 'stamp',  fmt: int },
    // flow
    { key: 'flowSize',   label: 'Flow size',   min: 10,  max: 300, step: 1,    group: 'flow',   fmt: px },
    { key: 'flowSpeed',  label: 'Flow speed',  min: 0.5, max: 5,   step: 0.05, group: 'flow',   fmt: v => (+v).toFixed(2) + 'x' },
    { key: 'smoothing',  label: 'Smoothing',   min: 0,   max: 1,   step: 0.01, group: 'flow',   fmt: pct },
    { key: 'flowScatter',label: 'Scatter',     min: 0,   max: 100, step: 1,    group: 'flow',   fmt: px },
    { key: 'flowOpacity',label: 'Opacity',     min: 0.05, max: 1,  step: 0.01, group: 'flow',   fmt: pct },
    // shared
    { key: 'pressureSens', label: 'Pressure',  min: 0,   max: 1,   step: 0.01, group: 'shared', fmt: pct },
    // radial only
    { key: 'symmetryCount', label: 'Count',    min: 2,   max: 8,   step: 1,    group: 'radial', fmt: int }
  ];

  const inputs = {};
  let toastTimer = null;

  const GROUP_EL = { stamp: 'groupStamp', flow: 'groupFlow', shared: 'groupShared', radial: 'groupRadial' };

  /* ~~~~~~~~~~~~~~~~ sliders ~~~~~~~~~~~~~~~~ */

  function buildSliders() {
    for (const cfg of SLIDERS) {
      const row = document.createElement('div');
      row.className = 'row';

      const top = document.createElement('div');
      top.className = 'row-top';
      const lab = document.createElement('label');
      lab.textContent = cfg.label;
      const val = document.createElement('span');
      val.className = 'val';
      top.append(lab, val);

      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.step;
      inp.value = S()[cfg.key];

      const paint = () => {
        const v = parseFloat(inp.value);
        val.textContent = cfg.fmt(v);
        inp.style.setProperty('--fill', ((v - cfg.min) / (cfg.max - cfg.min)) * 100 + '%');
      };

      inp.addEventListener('input', () => {
        S()[cfg.key] = parseFloat(inp.value);
        paint();
        if (cfg.key === 'size' || cfg.key === 'flowSize') Forge.Engine.updateRing();
      });

      row.append(top, inp);
      $(GROUP_EL[cfg.group]).appendChild(row);
      inputs[cfg.key] = { inp, paint };
      paint();
    }
  }

  /* rotation row + random toggle (stamp engine) */
  function buildRotation() {
    const row = document.createElement('div');
    row.className = 'row only-stamp';

    const top = document.createElement('div');
    top.className = 'row-top';
    const lab = document.createElement('label');
    lab.textContent = 'Rotation';
    const right = document.createElement('span');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    const val = document.createElement('span');
    val.className = 'val';
    const rnd = document.createElement('button');
    rnd.type = 'button';
    rnd.className = 'mini-toggle';
    rnd.textContent = 'random';
    rnd.title = 'Random rotation per stamp';
    right.append(val, rnd);
    top.append(lab, right);

    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = 0; inp.max = 360; inp.step = 1;
    inp.value = S().rotation;

    const paint = () => {
      val.textContent = Math.round(+inp.value) + '\u00B0';
      inp.style.setProperty('--fill', (+inp.value / 360) * 100 + '%');
    };
    const paintRandom = () => {
      rnd.classList.toggle('active', S().rotationRandom);
      inp.disabled = S().rotationRandom;
    };

    inp.addEventListener('input', () => { S().rotation = parseFloat(inp.value); paint(); });
    rnd.addEventListener('click', () => {
      S().rotationRandom = !S().rotationRandom;
      paintRandom();
    });

    row.append(top, inp);
    $('groupStamp').appendChild(row);
    inputs.rotation = { inp, paint };
    inputs._rotationRandom = { paint: paintRandom };
    paint(); paintRandom();
  }

  /* ~~~~~~~~~~~~~~~~ mode + symmetry ~~~~~~~~~~~~~~~~ */

  function setMode(m) {
    S().mode = m;
    document.body.dataset.mode = m;
    document.querySelectorAll('[data-mode-btn]').forEach(b => {
      const on = b.dataset.modeBtn === m;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    Forge.Engine.updateRing();
  }

  function setSym(sym) {
    S().symmetryMode = sym;
    document.body.dataset.sym = sym;
    document.querySelectorAll('.sym-seg button').forEach(b =>
      b.classList.toggle('active', b.dataset.sym === sym));
  }

  /* ~~~~~~~~~~~~~~~~ undo / redo buttons ~~~~~~~~~~~~~~~~ */

  function syncHistoryButtons() {
    const u = $('undoBtn'), r = $('redoBtn');
    if (u) u.disabled = !Forge.Engine.canUndo();
    if (r) r.disabled = !Forge.Engine.canRedo();
  }

  /* ~~~~~~~~~~~~~~~~ png maker (cutout) ~~~~~~~~~~~~~~~~ */

  function refreshCutTol() {
    const inp = $('cutTol');
    $('cutTolVal').textContent = Math.round(+inp.value * 100) + '%';
    inp.style.setProperty('--fill', ((+inp.value - 0.02) / 0.98) * 100 + '%');
  }

  function applyTipCanvas(c, msg) {
    S().tipCanvas = c;
    Forge.Engine.rebuildTintedTip();
    Forge.Flow.samplePalette(c);
    Forge.UI.onTipChanged();
    if (msg) Forge.UI.toast(msg);
  }

  function wireCutout() {
    const pv = $('tipPreviewCanvas');

    pv.addEventListener('click', e => {
      if (!S().tipCanvas) { toast('Load a tip first, then tap a color here'); return; }
      if (!Forge.Cutout.hasOriginal()) return;
      const r = pv.getBoundingClientRect();
      const nx = (e.clientX - r.left) * (256 / Math.max(1, r.width));
      const ny = (e.clientY - r.top) * (256 / Math.max(1, r.height));
      const tol = parseFloat($('cutTol').value);
      const out = Forge.Cutout.eraseAt(nx, ny, tol);
      if (!out) { toast('That spot is already empty, try a colored area'); return; }
      applyTipCanvas(out, 'Background erased, your PNG is ready to export');
    });

    $('cutTol').addEventListener('input', refreshCutTol);

    $('cutResetBtn').addEventListener('click', () => {
      if (!Forge.Cutout.hasOriginal()) { toast('Load a tip first'); return; }
      applyTipCanvas(Forge.Cutout.restore(), 'Original image back');
    });

    refreshCutTol();
  }

  /* ~~~~~~~~~~~~~~~~ splitter: drag to resize the canvas ~~~~~~~~~~~~~~~~ */

  function initSplitter() {
    const app = $('app');
    const sp = $('splitter');
    const mid = document.querySelector('.panel.mid');
    if (!app || !sp || !mid) return;

    const STORE = 'forge.midWidth';
    try {
      const saved = parseInt(localStorage.getItem(STORE), 10);
      if (saved >= 210 && saved <= 560) mid.style.flexBasis = saved + 'px';
    } catch (_) {}

    let dragging = false;

    sp.addEventListener('pointerdown', e => {
      dragging = true;
      sp.classList.add('dragging');
      document.body.classList.add('col-dragging');
      try { sp.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    sp.addEventListener('pointermove', e => {
      if (!dragging) return;
      const left = mid.getBoundingClientRect().left;
      const maxW = Math.min(560, app.getBoundingClientRect().width - 500);
      const w = Forge.clamp(e.clientX - left, 210, Math.max(210, maxW));
      mid.style.flexBasis = w + 'px';
    });
    const stop = e => {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('dragging');
      document.body.classList.remove('col-dragging');
      try { sp.releasePointerCapture(e.pointerId); } catch (_) {}
      try { localStorage.setItem(STORE, String(mid.getBoundingClientRect().width)); } catch (_) {}
    };
    sp.addEventListener('pointerup', stop);
    sp.addEventListener('pointercancel', stop);
  }

  /* ~~~~~~~~~~~~~~~~ starter tips ~~~~~~~~~~~~~~~~ */

  function buildStarterTips() {
    const grid = $('tipsGrid');
    for (const t of Forge.StarterTips.all()) {
      const b = document.createElement('button');
      b.className = 'tip-thumb';
      b.title = t.name;
      b.draggable = true;

      const img = document.createElement('img');
      img.src = t.canvas.toDataURL();
      img.alt = t.name;
      img.draggable = false;
      b.appendChild(img);

      b.addEventListener('click', () => loadStarterTip(t.id));
      b.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/x-forge-tip', t.id);
        e.dataTransfer.effectAllowed = 'copy';
      });
      grid.appendChild(b);
    }
  }

  function loadStarterTip(id) {
    const t = Forge.StarterTips.get(id);
    if (!t) return;
    Forge.setTip(t.canvas, t.id);
    Forge.UI.toast('Tip loaded: ' + t.name);
  }

  /* ~~~~~~~~~~~~~~~~ file upload ~~~~~~~~~~~~~~~~ */

  function handleFiles(files) {
    const f = files && files[0];
    if (!f) return;
    const ok = /^image\/(png|jpe?g|svg\+xml)$/i.test(f.type) || /\.(png|jpe?g|svg)$/i.test(f.name);
    if (!ok) { toast('That file type does not work, use PNG, JPG or SVG'); return; }

    const base = f.name.replace(/\.[^.]+$/, '') || 'upload';
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth && /svg/i.test(f.type + f.name)) fixSvgSize(f, base);
      else { Forge.setTip(img, base); toast('Brush tip loaded: ' + base); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image'); };
    img.src = url;
  }

  /* SVGs without intrinsic dimensions get a viewport injected */
  async function fixSvgSize(file, base) {
    try {
      const txt = await file.text();
      const patched = /<svg[^>]*\swidth=/i.test(txt)
        ? txt
        : txt.replace(/<svg/i, '<svg width="512" height="512"');
      const b = new Blob([patched], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(b);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); Forge.setTip(img, base); toast('Brush tip loaded: ' + base); };
      img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that SVG'); };
      img.src = url;
    } catch (_) { toast('Could not read that SVG'); }
  }

  function wireUpload() {
    const z = $('uploadZone');
    const openPicker = () => $('fileInput').click();
    z.addEventListener('click', openPicker);
    z.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
    });
    $('fileInput').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

    ['dragenter', 'dragover'].forEach(ev =>
      z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev =>
      z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('dragover'); }));

    z.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('text/x-forge-tip');
      if (id) { loadStarterTip(id); return; }
      handleFiles(e.dataTransfer.files);
    });
  }

  /* ~~~~~~~~~~~~~~~~ saved brushes ~~~~~~~~~~~~~~~~ */

  const LINK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';

  function renderSaved() {
    const list = Forge.Saved.list();
    const el = $('savedList');
    el.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'nothing saved yet';
      el.appendChild(empty);
      return;
    }

    list.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'saved-row';

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      name.title = item.name;

      const copy = document.createElement('button');
      copy.className = 'icon-btn';
      copy.innerHTML = LINK_SVG;
      copy.title = 'Copy brush link';
      copy.addEventListener('click', () => copyText(item.url, 'Link copied'));

      const del = document.createElement('button');
      del.className = 'icon-btn';
      del.textContent = '\u00D7';
      del.title = 'Remove from list';
      del.addEventListener('click', () => { Forge.Saved.remove(i); renderSaved(); });

      row.append(name, copy, del);
      el.appendChild(row);
    });
  }

  /* ~~~~~~~~~~~~~~~~ clipboard / share modal ~~~~~~~~~~~~~~~~ */

  function copyText(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => toast(msg || 'Copied'))
        .catch(() => openShareModal(text));
    } else {
      openShareModal(text);
    }
  }

  function openShareModal(url) {
    $('shareUrlInput').value = url;
    $('shareModal').classList.add('open');
    $('shareUrlInput').select();
  }

  function wireModal() {
    $('shareCopyBtn').addEventListener('click', () => {
      const v = $('shareUrlInput').value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(() => toast('Link copied'));
      } else {
        $('shareUrlInput').select();
        try { document.execCommand('copy'); toast('Link copied'); } catch (_) {}
      }
    });
    $('shareCloseBtn').addEventListener('click', () => $('shareModal').classList.remove('open'));
    $('shareModal').addEventListener('click', e => {
      if (e.target === $('shareModal')) $('shareModal').classList.remove('open');
    });
  }

  /* ~~~~~~~~~~~~~~~~ flow palette strip ~~~~~~~~~~~~~~~~ */

  function drawPaletteStrip() {
    const c = $('paletteStrip');
    const pal = Forge.Flow.palette;
    if (!c || !pal.length) return;
    const W = Math.min(512, Math.max(64, pal.length));
    c.width = W; c.height = 12;
    const x = c.getContext('2d');
    for (let i = 0; i < W; i++) {
      const col = pal[Math.floor((i / W) * pal.length)];
      x.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
      x.fillRect(i, 0, 1, c.height);
    }
  }

  /* ~~~~~~~~~~~~~~~~ toast ~~~~~~~~~~~~~~~~ */

  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2300);
  }

  /* ~~~~~~~~~~~~~~~~ preview canvas ~~~~~~~~~~~~~~~~ */

  function drawPreview() {
    const pv = $('tipPreviewCanvas');
    if (!pv) return;
    const x = pv.getContext('2d');
    x.clearRect(0, 0, pv.width, pv.height);
    if (S().tipCanvas) x.drawImage(S().tipCanvas, 0, 0, pv.width, pv.height);
  }

  /* ~~~~~~~~~~~~~~~~ refresh (used by URL restore) ~~~~~~~~~~~~~~~~ */

  function refreshAll() {
    for (const k in inputs) {
      if (k[0] === '_') continue;
      if (k === 'rotation') {
        inputs.rotation.inp.value = S().rotation;
        inputs.rotation.paint();
        inputs._rotationRandom.paint();
        continue;
      }
      inputs[k].inp.value = S()[k];
      inputs[k].paint();
    }
    setMode(S().mode);
    setSym(S().symmetryMode);
    $('colorInput').value = S().color;
    $('colorSwatch').style.background = S().color;
    $('bgInput').value = S().bg;
    $('bgSwatch').style.background = S().bg;
    $('canvasWrap').style.background = S().bg;
    drawPaletteStrip();
    Forge.Engine.updateRing();
    syncHistoryButtons();
    if (S().tipCanvas) onTipChanged();
  }

  function onTipChanged() {
    const S = Forge.state;
    if (!S.tipCanvas) return;
    $('tipNameLabel').textContent = S.tipName || 'no tip yet';
    drawPreview();
    drawPaletteStrip();
    Forge.Engine.updateRing();
  }

  /* ~~~~~~~~~~~~~~~~ init ~~~~~~~~~~~~~~~~ */

  function init() {
    buildSliders();
    buildRotation();
    buildStarterTips();
    wireUpload();
    wireModal();
    wireCutout();
    initSplitter();
    renderSaved();

    document.querySelectorAll('[data-mode-btn]').forEach(b =>
      b.addEventListener('click', () => setMode(b.dataset.modeBtn)));

    document.querySelectorAll('.sym-seg button').forEach(b =>
      b.addEventListener('click', () => setSym(b.dataset.sym)));

    $('clearBtn').addEventListener('click', () => Forge.Engine.clear());
    $('undoBtn').addEventListener('click', () => Forge.Engine.undo());
    $('redoBtn').addEventListener('click', () => Forge.Engine.redo());

    $('colorInput').addEventListener('input', e => {
      S().color = e.target.value;
      $('colorSwatch').style.background = S().color;
      Forge.Engine.rebuildTintedTip();
    });
    $('bgInput').addEventListener('input', e => {
      S().bg = e.target.value;
      $('bgSwatch').style.background = S().bg;
      $('canvasWrap').style.background = S().bg;
    });

    $('exportTipPng').addEventListener('click', () => Forge.Export.exportTipPNG());
    $('exportGbr').addEventListener('click', () => Forge.Export.exportGBR());
    $('exportKpp').addEventListener('click', () => Forge.Export.exportKPP());
    $('exportCanvasPng').addEventListener('click', () => Forge.Export.exportCanvasPNG());
    $('shareBtn').addEventListener('click', () => Forge.Share.share());

    window.addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        Forge.Engine.undo();
      } else if (((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey)))) {
        e.preventDefault();
        Forge.Engine.redo();
      }
    });

    $('colorSwatch').style.background = S().color;
    $('bgSwatch').style.background = S().bg;
    syncHistoryButtons();
  }

  return {
    init, toast, renderSaved, refreshAll, onTipChanged, copyText,
    setMode, setSym, loadStarterTip, drawPaletteStrip,
    syncHistoryButtons
  };
})();
