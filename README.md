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

Double clicking `index.html` works too. You need internet the first time for fonts
and the zip library.

## Things to try

- Drop any photo into the upload zone, switch to **Flow**, and draw. The stroke
  bleeds the photo's colors in order.
- Drag the little handle between the panels to make the canvas wider or narrower.
- On phones the canvas docks to the top and stays there while you scroll the tools.
- Tap **Share this brush** and send the link to someone. The whole brush, tip image
  included, is encoded inside the link.
- **Mirror** and **Radial** symmetry apply while you draw, same frame.
- Starter tips are draggable straight onto the upload zone.

## Exports

| File | What it is |
| --- | --- |
| tip PNG | the brush tip at 128x128 |
| `.gbr` | GIMP brush, version 2 binary written byte by byte, drops into your brushes folder |
| `.kpp` | Krita preset, a zip with the tip PNG and the preset XML |
| canvas PNG | your artwork flattened on its background |

## The code

```
index.html          layout
style.css           crayon theme, responsive rules
js/state.js         shared settings
js/starter-tips.js  eight tips drawn in code at load
js/flow-mode.js     palette sampling and the smear engine
js/brush-engine.js  canvas, stamp engine, symmetry, undo, pointer input
js/export.js        PNG, GBR, KPP and canvas export
js/share.js         brush to URL encoding and the saved list
js/ui.js            sliders, upload, splitter, toasts
js/main.js          boot
```

No framework, no build step. Vanilla JS and the Pointer Events API, so mouse, touch
and stylus all work. Deploy anywhere static: Vercel, Netlify, GitHub Pages.

## License

MIT
