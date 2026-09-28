/* ============================================================
   FORGE — share.js — URL-hash brush encoding + saved brushes
   The tip image travels INSIDE the URL hash, so a shared link
   works on anyone's machine. localStorage only remembers the
   encoded URLs for the local SAVED BRUSHES list.
   ============================================================ */

/* Saved brushes — list of {name, url, ts}. Hardened against
   sandboxed iframes where localStorage throws. */
Forge.Saved = {
  KEY: 'forge.savedBrushes.v1',
  _mem: [],

  list() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch (_) { return this._mem; }
  },
  add(entry) {
    const l = this.list();
    l.unshift(entry);
    while (l.length > 30) l.pop();
    try { localStorage.setItem(this.KEY, JSON.stringify(l)); }
    catch (_) { this._mem = l; }
  },
  remove(i) {
    const l = this.list();
    l.splice(i, 1);
    try { localStorage.setItem(this.KEY, JSON.stringify(l)); }
    catch (_) { this._mem = l; }
  }
};

Forge.Share = {
  /* Entire brush state + tip dataURL → base64 hash payload. */
  encode() {
    const S = Forge.state;
    const state = {
      mode: S.mode,
      spacing: S.spacing, size: S.size, sizeJitter: S.sizeJitter,
      scatter: S.scatter, rotation: S.rotation, rotationRandom: S.rotationRandom,
      opacity: S.opacity, count: S.count,
      flowSize: S.flowSize, flowSpeed: S.flowSpeed, smoothing: S.smoothing,
      flowScatter: S.flowScatter, flowOpacity: S.flowOpacity,
      pressureSens: S.pressureSens,
      symmetryMode: S.symmetryMode, symmetryCount: S.symmetryCount,
      tipName: S.tipName,
      tip: S.tipCanvas ? S.tipCanvas.toDataURL('image/png') : null
    };
    return btoa(encodeURIComponent(JSON.stringify(state)));
  },

  /* SHARE THIS BRUSH — set hash, copy link, save to list. */
  share() {
    if (!Forge.state.tipCanvas) { Forge.UI.toast('Load a brush tip first'); return; }
    const enc = this.encode();
    const url = location.href.split('#')[0] + '#' + enc;
    try { history.replaceState(null, '', '#' + enc); } catch (_) {}

    Forge.Saved.add({
      name: (Forge.state.tipName || 'brush') + ' · ' + Forge.state.mode,
      url,
      ts: Date.now()
    });
    Forge.UI.renderSaved();
    Forge.UI.copyText(url, 'Link copied — brush saved');
  },

  /* On page load: restore a shared brush from location.hash. */
  applyFromHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return false;

    const st = JSON.parse(decodeURIComponent(atob(h)));
    const S = Forge.state;

    const NUMS = ['spacing', 'size', 'sizeJitter', 'scatter', 'rotation',
      'opacity', 'count', 'flowSize', 'flowSpeed', 'smoothing',
      'flowScatter', 'flowOpacity', 'pressureSens', 'symmetryCount'];
    for (const k of NUMS) {
      if (typeof st[k] === 'number' && isFinite(st[k])) S[k] = st[k];
    }
    if (st.mode === 'stamp' || st.mode === 'flow') S.mode = st.mode;
    if (['off', 'mirror', 'radial'].includes(st.symmetryMode)) S.symmetryMode = st.symmetryMode;
    if (typeof st.rotationRandom === 'boolean') S.rotationRandom = st.rotationRandom;
    if (typeof st.tipName === 'string' && st.tipName) S.tipName = st.tipName;

    Forge.UI.refreshAll();

    if (typeof st.tip === 'string' && st.tip.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        Forge.setTip(img, S.tipName || 'shared');
        Forge.UI.toast('Shared brush loaded');
      };
      img.onerror = () => Forge.UI.toast('Shared tip image failed to load');
      img.src = st.tip;
    } else {
      Forge.UI.toast('Shared brush loaded');
    }
    return true;
  }
};
