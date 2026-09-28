/* ============================================================
   FORGE — main.js — bootstrap
   ============================================================ */

/* Central "load a tip" routine: normalize to 256×256 (contain-fit,
   alpha preserved), resample the flow palette, refresh the UI. */
Forge.setTip = function (source, name) {
  const S = Forge.state;
  const N = 256;

  const iw = source.naturalWidth || source.width;
  const ih = source.naturalHeight || source.height;
  if (!iw || !ih) return;

  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const x = c.getContext('2d');
  const sc = Math.min(N / iw, N / ih);
  const w = iw * sc, h = ih * sc;
  x.drawImage(source, (N - w) / 2, (N - h) / 2, w, h);

  S.tipCanvas = c;
  S.tipName = name || S.tipName || 'brush';

  Forge.Engine.rebuildTintedTip();
  Forge.Flow.samplePalette(c);
  Forge.UI.onTipChanged();
};

(function () {
  function boot() {
    Forge.UI.init();
    Forge.Engine.attach(
      document.getElementById('canvas'),
      document.getElementById('canvasWrap'),
      document.getElementById('brushRing')
    );

    // shared brush in the URL hash beats the default tip
    let loaded = false;
    if (location.hash.length > 1) {
      try { loaded = Forge.Share.applyFromHash(); }
      catch (_) { Forge.UI.toast('Could not load shared brush'); }
    }
    if (!loaded) {
      const d = Forge.StarterTips.get('diamond');
      Forge.setTip(d.canvas, d.id);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
