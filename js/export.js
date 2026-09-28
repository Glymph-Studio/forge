/* ============================================================
   FORGE — export.js — PNG tip · GIMP .GBR · Krita .KPP · canvas
   ============================================================ */

Forge.Export = {
  download(blob, name) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  slug() { return Forge.slug(Forge.state.tipName); },

  /* Tip resampled to 128×128 — the interchange size for GBR/KPP. */
  tip128() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    c.getContext('2d').drawImage(Forge.state.tipCanvas, 0, 0, 128, 128);
    return c;
  },

  guard() {
    if (!Forge.state.tipCanvas) { Forge.UI.toast('Load a brush tip first'); return false; }
    return true;
  },

  /* ---------------- 8.1 PNG brush tip ---------------- */

  exportTipPNG() {
    if (!this.guard()) return;
    this.tip128().toBlob(blob => {
      if (!blob) { Forge.UI.toast('PNG export failed'); return; }
      this.download(blob, this.slug() + '-brush-tip.png');
      Forge.UI.toast('Brush tip PNG exported');
    }, 'image/png');
  },

  /* ---------------- 8.2 GIMP .gbr — v2 binary, big-endian ----------------
     Built with DataView against GIMP's own spec (devel-docs/gbr.txt):
       [0-3]   header_size  = 28 + name_len + 1
       [4-7]   version      = 2
       [8-11]  width        = 128
       [12-15] height       = 128
       [16-19] bytes        = 4 (RGBA)
       [20-23] magic        = 'G','I','M','P'   ← GIMP identifies GBR by this
       [24-27] spacing      = % of brush width
       [28..]  brush name   (UTF-8, NUL-terminated)
       [header_size..] raw RGBA pixels, row-major, top-to-bottom
     ---------------------------------------------------------------------- */

  exportGBR() {
    if (!this.guard()) return;
    const SIZE = 128;
    const px = this.tip128().getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
    const name = this.slug().slice(0, 63);
    const nameBytes = new TextEncoder().encode(name);

    const headerSize = 28 + nameBytes.length + 1;
    const buf = new ArrayBuffer(headerSize + px.length);
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);

    dv.setUint32(0, headerSize);              // header_size
    dv.setUint32(4, 2);                       // version
    dv.setUint32(8, SIZE);                    // width
    dv.setUint32(12, SIZE);                   // height
    dv.setUint32(16, 4);                      // bytes (RGBA)
    u8[20] = 0x47; u8[21] = 0x49; u8[22] = 0x4D; u8[23] = 0x50; // "GIMP"
    dv.setUint32(24, Forge.clamp(Math.round(Forge.state.spacing * 100), 1, 1000)); // spacing %
    u8.set(nameBytes, 28);                    // brush name
    u8[28 + nameBytes.length] = 0;            // NUL terminator
    u8.set(px, headerSize);                   // raw RGBA

    this.download(new Blob([buf], { type: 'application/octet-stream' }), name + '.gbr');
    Forge.UI.toast('.GBR exported — GIMP → Brushes → Import');
  },

  /* JSZip is fetched only when needed, so the app never depends on the CDN to boot */
  _loadJsZip() {
    return new Promise((resolve, reject) => {
      if (window.JSZip) return resolve(window.JSZip);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => resolve(window.JSZip);
      s.onerror = () => reject(new Error('offline'));
      document.head.appendChild(s);
    });
  },

  /* ---------------- 8.3 Krita .kpp — ZIP via JSZip ---------------- */

  async exportKPP() {
    if (!this.guard()) return;
    let JSZip;
    try { JSZip = await this._loadJsZip(); }
    catch (_) { Forge.UI.toast('Krita export needs internet once, to fetch the zip library'); return; }
    if (!JSZip) { Forge.UI.toast('The zip library failed to load, try again'); return; }

    const name = this.slug();
    const zip = new JSZip();

    const pngBlob = await new Promise(res => this.tip128().toBlob(res, 'image/png'));
    zip.file(name + '.png', pngBlob);

    const spacing = (+Forge.state.spacing).toFixed(2);
    const opacity = (+Forge.state.opacity).toFixed(2);

    const xml =
`<!DOCTYPE preset>
<Preset version="5.0" name="${name}" paintopid="paintbrush">
 <params>
  <param name="brush_definition">
   <brush_definition brush_type="image" angle="0"
    use_color_as_mask="false" name="${name}"
    filename="${name}.png" spacing="${spacing}">
    <BrushTip>
     <scale>1.0</scale><angle>0.0</angle>
     <mirrorX>false</mirrorX><mirrorY>false</mirrorY>
    </BrushTip>
   </brush_definition>
  </param>
  <param name="Opacity"><curve><point x="0" y="${opacity}"/></curve></param>
 </params>
</Preset>
`;
    zip.file(name + '.kpp', xml);

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    this.download(blob, name + '.kpp');
    Forge.UI.toast('.KPP exported — drop into Krita');
  },

  /* ---------------- 8.4 Canvas PNG (bg + art flattened) ---------------- */

  exportCanvasPNG() {
    const src = Forge.Engine.canvasEl();
    if (!src) return;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    x.fillStyle = Forge.state.bg;
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0);
    c.toBlob(blob => {
      if (!blob) { Forge.UI.toast('Canvas export failed'); return; }
      this.download(blob, 'forge-canvas.png');
      Forge.UI.toast('Canvas PNG exported');
    }, 'image/png');
  }
};
