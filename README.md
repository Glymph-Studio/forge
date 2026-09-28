# forge 🖍️

Turn any image into a digital brush. Paint with it right in the browser, then take it
to GIMP or Krita. Made by [Glymph Studio](https://github.com/Glymph-Studio).

Two engines live under one brush tip:

- **Stamp** is the classic: the tip gets stamped along your stroke with control over
  spacing, size, jitter, scatter, rotation and opacity.
- **Flow** is the fun one: forge reads the colors of your image in order and smears
  them along the stroke, like dragging wet paint made from that image's pigments.
  The image is the palette, not a filter.

## Run it

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The server has to run inside the folder that contains `index.html`. If you see a
file listing instead of the app, you are one folder up.

No server around? Run `python3 build-standalone.py` once, then just double click
`forge-standalone.html`. It packs everything into one file that works offline.

If an orange box appears saying forge did not fully load, read it: it lists
exactly which script failed and the first error, so the cause is right there.
It usually means the `js` folder did not make it next to `index.html`.

Double clicking `index.html` itself works in most browsers too. You need internet
the first time for fonts, and for the Krita export which fetches the zip library.

## Things to try

- Drop any photo into the upload zone, switch to **Flow**, and draw. The stroke
  bleeds the photo's colors in order.
- **PNG maker**: click a color on the image preview and forge erases that whole
  patch, edge softened, giving you a transparent PNG. Flat backgrounds come out
  surprisingly clean. The eraser reach slider decides how far the color match
  spreads, and one button brings the original back.
- Drag the little handle between the panels to make the canvas wider or narrower.
- On phones the canvas docks to the top and stays there while you scroll the tools.
- Tap **Share this brush** and send the link to someone. The whole brush, tip image
  included, is encoded inside the link.
- **Mirror** and **Radial** symmetry apply while you draw, same frame.
- Undo and redo just work: one snapshot per stroke, up to 30 steps, clear is
  undoable too. Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z on desktop.
- Starter tips are draggable straight onto the upload zone.

## Exports

| File | What it is |
| --- | --- |
| tip PNG | the brush tip at 128x128, transparent if you used the png maker |
| `.gbr` | GIMP brush, version 2 binary written byte by byte, drops into your brushes folder |
| `.kpp` | Krita preset, a zip with the tip PNG and the preset XML |
| canvas PNG | your artwork flattened on its background |

## The code

```
index.html          layout
style.css           crayon theme, responsive rules
js/state.js         shared settings
js/starter-tips.js  eight tips drawn in code at load
js/cutout.js        the png maker, background eraser
js/flow-mode.js     palette sampling and the smear engine
js/brush-engine.js  canvas, stamp engine, symmetry, history, pointer input
js/export.js        PNG, GBR, KPP and canvas export
js/share.js         brush to URL encoding and the saved list
js/ui.js            sliders, upload, splitter, toasts
js/main.js          boot
```

No framework, no build step. Vanilla JS and the Pointer Events API, so mouse, touch
and stylus all work. Deploy anywhere static: Vercel, Netlify, GitHub Pages.

## Testing

Two headless simulations live in `tests/`. They boot the real files in a DOM with
a real canvas engine and click through everything:

```bash
npm install jsdom canvas
node tests/simulate.js   # painting, undo, redo, clear, symmetry, flow, png maker
node tests/mobile.js     # phone tabs, share from the mobile header
```

If you change the brush engine, run them again.
