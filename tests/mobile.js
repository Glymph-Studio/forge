/* forge · phone shell simulation
   Checks the mobile app wiring: the dock, the bottom sheet tabs,
   the scrim close, the share button in the phone header.

   Run it:
     npm install jsdom
     node tests/mobile.js
*/
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const errors = [];

JSDOM.fromFile(path.join(ROOT, 'index.html'), {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
  beforeParse(w) {
    const noop = () => {};
    const fakeCtx = () => {
      const g = {};
      ['setTransform','clearRect','drawImage','fillRect','beginPath','arc','fill','stroke','moveTo','lineTo',
       'bezierCurveTo','quadraticCurveTo','closePath','save','restore','translate','rotate','scale','fillText',
       'clip','rect','ellipse','putImageData'].forEach(k => g[k] = noop);
      g.createLinearGradient = () => ({ addColorStop: noop });
      g.createRadialGradient = () => ({ addColorStop: noop });
      g.getImageData = (x, y, iw, ih) => ({ data: new Uint8ClampedArray(Math.max(4, (iw || 1) * (ih || 1) * 4)) });
      return g;
    };
    w.HTMLCanvasElement.prototype.getContext = function () { return fakeCtx(); };
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,x';
    w.HTMLCanvasElement.prototype.toBlob = cb => cb(null);
    w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    let n = 0;
    w.URL.createObjectURL = () => 'blob:mock-' + (++n);
    w.URL.revokeObjectURL = () => {};
    w.addEventListener('error', e =>
      errors.push(e.message + ' @ ' + (e.filename || '?').split('/').pop() + ':' + e.lineno));
  }
}).then(dom => setTimeout(() => {
  const w = dom.window, d = w.document;
  const r = [];
  const ok = (name, cond) => r.push((cond ? 'PASS ' : 'FAIL ') + name);

  /* the chrome exists */
  ok('phone header exists', !!d.querySelector('.mobile-head'));
  ok('dock exists with mode + tools', !!d.querySelector('.m-dock .mode-seg') && !!d.querySelector('[data-sheet-open]'));
  ok('scrim exists', !!d.querySelector('.m-scrim'));
  ok('two sheet heads (image + brush panels)', d.querySelectorAll('.sheet-head').length === 2);
  ok('each sheet head has 3 tabs + a close', (() => {
    const heads = d.querySelectorAll('.sheet-head');
    return [...heads].every(h =>
      h.querySelectorAll('[data-sheet-tab]').length === 3 &&
      h.querySelectorAll('[data-sheet-close]').length === 1);
  })());
  ok('desktop wordmark kept in the left panel', !!d.querySelector('.panel.left .wordmark'));

  /* sheet starts closed */
  ok('sheet starts closed', d.body.dataset.sheet === 'none');

  /* open image sheet */
  d.querySelector('.sheet-head [data-sheet-tab="image"]').click();
  ok('image tab opens the image sheet', d.body.dataset.sheet === 'image');
  ok('image tabs marked active in both heads',
     [...d.querySelectorAll('[data-sheet-tab="image"]')].every(b => b.classList.contains('active')));

  /* brush tab also switches the mid pane */
  d.querySelector('.sheet-head [data-sheet-tab="brush"]').click();
  ok('brush tab opens brush sheet', d.body.dataset.sheet === 'brush');
  ok('brush tab sets the mid pane', d.body.dataset.mtab === 'brush');

  d.querySelector('.sheet-head [data-sheet-tab="export"]').click();
  ok('export tab opens export sheet', d.body.dataset.sheet === 'export');
  ok('export tab sets the mid pane', d.body.dataset.mtab === 'export');

  /* close via the ✕ */
  d.querySelector('.sheet-head [data-sheet-close]').click();
  ok('close button shuts the sheet', d.body.dataset.sheet === 'none');

  /* dock tools button reopens the sheet you used last */
  d.querySelector('[data-sheet-open]').click();
  ok('tools button reopens the last sheet', d.body.dataset.sheet === 'export');
  d.querySelector('.m-scrim').click();
  ok('tapping the scrim closes the sheet', d.body.dataset.sheet === 'none');
  d.querySelector('[data-sheet-open]').click();
  ok('tools button remembers across closes', d.body.dataset.sheet === 'export');
  d.querySelector('.m-scrim').click();

  /* dock mode toggle drives the brush mode */
  d.querySelector('.m-dock [data-mode-btn="flow"]').click();
  ok('dock flow button switches mode', d.body.dataset.mode === 'flow');
  ok('mode pills follow in both places',
     [...d.querySelectorAll('[data-mode-btn="flow"]')].every(b => b.classList.contains('active')));
  d.querySelector('.m-dock [data-mode-btn="stamp"]').click();
  ok('dock stamp button switches back', d.body.dataset.mode === 'stamp');

  /* phone header share */
  d.querySelector('.mobile-head [data-share]').click();
  ok('phone share opens the modal', d.getElementById('shareModal').classList.contains('open'));
  ok('share url carries the brush', d.getElementById('shareUrlInput').value.includes('#'));
  d.getElementById('shareCloseBtn').click();

  /* canvas floating controls intact */
  ok('canvas action row has 5 controls',
     d.querySelectorAll('.canvas-actions .tbtn, .canvas-actions label.tbtn').length === 5);
  ok('color labels present for desktop', d.querySelectorAll('.canvas-actions .tlabel').length === 2);

  console.log(r.join('\n'));
  console.log('=== page errors ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  const fails = r.filter(x => x.startsWith('FAIL')).length + errors.length;
  console.log('=== ' + (fails ? fails + ' FAILURES' : 'ALL PASS') + ' ===');
  process.exit(fails ? 1 : 0);
}, 2600)).catch(e => { console.log('BOOT FAIL', e.message); process.exit(1); });
