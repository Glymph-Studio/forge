# FORGE — by Glymph Studio

Turn any image into a configurable digital brush. Test it live. Export it to real drawing apps.

Two engines, one tip:

- **STAMP** — classical stamp-along-path. Spacing, size jitter, scatter, rotation (or random), opacity, count.
- **FLOW** — the headline. Forge samples the image's palette **in sequence** and smears those exact colors along your stroke, like dragging wet paint made of the image's pigments. The image is the palette — not a filter, not a recolor.

## Run it

```bash
cd forge
python3 -m http.server 8000
# → http://localhost:8000
```

(Opening `index.html` directly also works; internet is only needed for fonts + JSZip CDN.)

## Deploy

Static. No backend, no build step. Drop the `forge/` folder on Vercel / Netlify / GitHub Pages and you're live.

## Files

```
index.html          layout — 3 panels, mobile blocker, share modal
style.css           dark terminal theme, electric lime #c8ff00
js/state.js         shared settings + helpers
js/starter-tips.js  8 programmatic brush tips (no external images)
js/flow-mode.js     palette sampling + smear engine (headline feature)
js/brush-engine.js  canvas manager, stamp engine, symmetry, undo, pointer I/O
js/export.js        PNG tip · GIMP .gbr (hand-built binary) · Krita .kpp (JSZip) · canvas PNG
js/share.js         brush ⇄ URL-hash encoding + saved brush list
js/ui.js            sliders, toggles, upload zone, toasts
js/main.js          bootstrap
```

## Controls

- Draw: pointer / touch / stylus (Pointer Events only)
- `Ctrl+Z` / UNDO — 20-step history
- CLEAR / UNDO / COLOR (stamp tint) / BG — top-right over the canvas
- SYMMETRY — OFF · MIRROR · RADIAL (2–8 copies), applied live
- Starter tips: click to load, **or drag onto the upload zone**
- SHARE THIS BRUSH — encodes the full brush (tip image + every setting) into the URL hash and copies the link

## Exports

| Format | What |
| --- | --- |
| `*-brush-tip.png` | tip resampled to 128×128 |
| `.gbr` | GIMP brush v2, big-endian, `GIMP` magic + spacing field, raw RGBA body — built byte-by-byte with `DataView` |
| `.kpp` | Krita preset — ZIP (JSZip) containing `name.png` + preset XML |
| `forge-canvas.png` | flattened canvas (background + art) |

## Notes

- GIMP: drop the `.gbr` into `~/.config/GIMP/2.10/brushes/` (or Brushes → Import).
- Krita: drop the `.kpp` + `.png` into `~/.local/share/krita/brushes/` (Linux) or the equivalent presets folder, then restart Krita.
- Shared links carry the tip inside the hash — nothing is uploaded anywhere.

FORGE — *the image is the palette.*
