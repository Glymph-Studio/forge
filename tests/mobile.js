/* forge · mobile chrome simulation
   Checks the phone layout wiring: bottom tabs switch panes, the share
   button in the mobile header opens the share modal, action row intact.

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

  const tabs = d.querySelectorAll('.mobile-tabs [data-mtab]');
  ok('3 tab buttons exist', tabs.length === 3);
  ok('default tab is brush', d.body.dataset.mtab === 'brush');

  tabs[1].click();
  ok('image tab switches pane', d.body.dataset.mtab === 'image');
  ok('image tab marks its button active', tabs[1].classList.contains('active') && !tabs[0].classList.contains('active'));

  tabs[2].click();
  ok('export tab switches pane', d.body.dataset.mtab === 'export');
  tabs[0].click();
  ok('back to brush tab', d.body.dataset.mtab === 'brush');

  const shareM = d.querySelector('.mobile-head [data-share]');
  ok('mobile header has a share button', !!shareM);
  shareM.click();
  ok('mobile share opens the share modal', d.getElementById('shareModal').classList.contains('open'));
  ok('share modal has the encoded url', d.getElementById('shareUrlInput').value.includes('#'));
  d.getElementById('shareCloseBtn').click();
  ok('modal closes', !d.getElementById('shareModal').classList.contains('open'));

  ok('canvas actions row has 5 controls',
     d.querySelectorAll('.canvas-actions .tbtn, .canvas-actions label.tbtn').length === 5);
  ok('no leftover bar-spacer', !d.querySelector('.bar-spacer'));
  ok('phone panes exist', !!d.querySelector('.pane-brush') && !!d.querySelector('.pane-export'));

  console.log(r.join('\n'));
  console.log('=== page errors ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  const fails = r.filter(x => x.startsWith('FAIL')).length + errors.length;
  console.log('=== ' + (fails ? fails + ' FAILURES' : 'ALL PASS') + ' ===');
  process.exit(fails ? 1 : 0);
}, 2600)).catch(e => { console.log('BOOT FAIL', e.message); process.exit(1); });
