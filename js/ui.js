/* ============================================================
   FORGE — ui.js — panels, sliders, upload, saved brushes, toasts
   ============================================================ */

Forge.UI = (function () {
  const S = () => Forge.state;
  const $ = id => document.getElementById(id);

  const pct = v => Math.round(v * 100) + '%';
  const px  = v => Math.round(v) + 'px';
  const int = v => String(Math.round(v));

  const SLIDERS = [
    // STAMP
    { key: 'spacing',    label: 'SPACING',     min: 0.1, max: 2,   step: 0.01, group: 'stamp',  fmt: v => (+v).toFixed(2) + '×' },
    { key: 'size',       label: 'SIZE',        min: 10,  max: 300, step: 1,    group: 'stamp',  fmt: px },
    { key: 'sizeJitter', label: 'SIZE JITTER', min: 0,   max: 1,   step: 0.01, group: 'stamp',  fmt: pct },
    { key: 'scatter',    label: 'SCATTER',     min: 0,   max: 200, step: 1,    group: 'stamp',  fmt: px },
    { key: 'opacity',    label: 'OPACITY',     min: 0.05, max: 1,  step: 0.01, group: 'stamp',  fmt: pct },
    { key: 'count',      label: 'COUNT',       min: 1,   max: 12,  step: 1,    group: 'stamp',  fmt: int },
    // FLOW
    { key: 'flowSize',   label: 'FLOW SIZE',   min: 10,  max: 300, step: 1,    group: 'flow',   fmt: px },
    { key: 'flowSpeed',  label: 'FLOW SPEED',  min: 0.5, max: 5,   step: 0.05, group: 'flow',   fmt: v => (+v).toFixed(2) + '×' },
    { key: 'smoothing',  label: 'SMOOTHING',   min: 0,   max: 1,   step: 0.01, group: 'flow',   fmt: pct },
    { key: 'flowScatter',label: 'SCATTER',     min: 0,   max: 100, step: 1,    group: 'flow',   fmt: px },
    { key: 'flowOpacity',label: 'OPACITY',     min: 0.05, max: 1,  step: 0.01, group: 'flow',   fmt: pct },
    // SHARED
    { key: 'pressureSens', label: 'PRESSURE SENS', min: 0, max: 1,  step: 0.01, group: 'shared', fmt: pct },
    // RADIAL only
    { key: 'symmetryCount', label: 'COUNT',     min: 2,   max: 8,   step: 1,    group: 'radial', fmt: int }
  ];

  const inputs = {};
  let toastTimer = null;

  const GROUP_EL = { stamp: 'groupStamp', flow: 'groupFlow', shared: 'groupShared', radial: 'groupRadial' };

  /* ---------------- sliders ---------------- */

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

  /* ROTATION row + RANDOM toggle (stamp engine) */
  function buildRotation() {
    const row = document.createElement('div');
    row.className = 'row only-stamp';

    const top = document.createElement('div');
    top.className = 'row-top';
    const lab = document.createElement('label');
    lab.textContent = 'ROTATION';
    const right = document.createElement('span');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';
    const val = document.createElement('span');
    val.className = 'val';
    const rnd = document.createElement('button');
    rnd.type = 'button';
    rnd.className = 'rnd-btn';
    rnd.textContent = 'RND';
    rnd.title = 'Random rotation per stamp';
    right.append(val, rnd);
    top.append(lab, right);

    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = 0; inp.max = 360; inp.step = 1;
    inp.value = S().rotation;

    const paint = () => {
      val.textContent = Math.round(+inp.value) + '°';
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

  /* ---------------- mode + symmetry ---------------- */

  function setMode(m) {
    S().mode = m;
    document.body.dataset.mode = m;
    $('modeStamp').classList.toggle('active', m === 'stamp');
    $('modeFlow').classList.toggle('active', m === 'flow');
    Forge.Engine.updateRing();
  }

  function setSym(sym) {
    S().symmetryMode = sym;
    document.body.dataset.sym = sym;
    document.querySelectorAll('.sym-seg button').forEach(b =>
      b.classList.toggle('active', b.dataset.sym === sym));
  }

  /* ---------------- starter tips ---------------- */

  function buildStarterTips() {
    const grid = $('tipsGrid');
    for (const t of Forge.StarterTips.all()) {
      const b = document.createElement('button');
      b.className = 'tip-thumb';
      b.title = t.name + ' — click to load, or drag onto the upload zone';
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

  /* ---------------- file upload ---------------- */

  function handleFiles(files) {
    const f = files && files[0];
    if (!f) return;
    const ok = /^image\/(png|jpe?g|svg\+xml)$/i.test(f.type) || /\.(png|jpe?g|svg)$/i.test(f.name);
    if (!ok) { toast('Unsupported file — PNG, JPG or SVG'); return; }

    const base = f.name.replace(/\.[^.]+$/, '') || 'upload';
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth && /svg/i.test(f.type + f.name)) fixSvgSize(f, base);
      else { Forge.setTip(img, base); toast('Brush tip loaded: ' + base); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read image'); };
    img.src = url;
  }

  /* SVGs without intrinsic dimensions get a 512 viewport injected. */
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
      img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read SVG'); };
      img.src = url;
    } catch (_) { toast('Could not read SVG'); }
  }

  function wireUpload() {
    const z = $('uploadZone');
    z.addEventListener('click', () => $('fileInput').click());
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

  /* ---------------- saved brushes ---------------- */

  const LINK_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';

  function renderSaved() {
    const list = Forge.Saved.list();
    const el = $('savedList');
    el.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No saved brushes yet';
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
      del.textContent = '×';
      del.title = 'Remove from list';
      del.addEventListener('click', () => { Forge.Saved.remove(i); renderSaved(); });

      row.append(name, copy, del);
      el.appendChild(row);
    });
  }

  /* ---------------- clipboard / share modal ---------------- */

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

  /* ---------------- flow palette strip ---------------- */

  function drawPaletteStrip() {
    const c = $('paletteStrip');
    const pal = Forge.Flow.palette;
    if (!c || !pal.length) return;
    const W = Math.min(512, Math.max(64, pal.length));
    c.width = W; c.height = 10;
    const x = c.getContext('2d');
    for (let i = 0; i < W; i++) {
      const col = pal[Math.floor((i / W) * pal.length)];
      x.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
      x.fillRect(i, 0, 1, c.height);
    }
  }

  /* ---------------- toast ---------------- */

  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2300);
  }

  /* ---------------- refresh (used by URL restore) ---------------- */

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
    if (S().tipCanvas) onTipChanged();
  }

  function onTipChanged() {
    const S = Forge.state;
    if (!S.tipCanvas) return;
    $('tipPreviewImg').src = S.tipCanvas.toDataURL();
    $('tipNameLabel').textContent = S.tipName || '—';
    drawPaletteStrip();
    Forge.Engine.updateRing();
  }

  /* ---------------- init ---------------- */

  function init() {
    buildSliders();
    buildRotation();
    buildStarterTips();
    wireUpload();
    wireModal();
    renderSaved();

    // mode toggle
    $('modeStamp').addEventListener('click', () => setMode('stamp'));
    $('modeFlow').addEventListener('click', () => setMode('flow'));

    // symmetry
    document.querySelectorAll('.sym-seg button').forEach(b =>
      b.addEventListener('click', () => setSym(b.dataset.sym)));

    // topbar
    $('clearBtn').addEventListener('click', () => Forge.Engine.clear());
    $('undoBtn').addEventListener('click', () => Forge.Engine.undo());

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

    // exports + share
    $('exportTipPng').addEventListener('click', () => Forge.Export.exportTipPNG());
    $('exportGbr').addEventListener('click', () => Forge.Export.exportGBR());
    $('exportKpp').addEventListener('click', () => Forge.Export.exportKPP());
    $('exportCanvasPng').addEventListener('click', () => Forge.Export.exportCanvasPNG());
    $('shareBtn').addEventListener('click', () => Forge.Share.share());

    // undo shortcut
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        Forge.Engine.undo();
      }
    });

    // initial swatches
    $('colorSwatch').style.background = S().color;
    $('bgSwatch').style.background = S().bg;
  }

  return {
    init, toast, renderSaved, refreshAll, onTipChanged, copyText,
    setMode, setSym, loadStarterTip, drawPaletteStrip
  };
})();
