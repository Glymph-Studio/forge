/* forge · pixel level simulation
   Boots the real app in a headless DOM with a real canvas engine, then
   paints, undoes, redoes, clears, mirrors, flows, resizes and cuts out.

   Run it:
     npm install jsdom canvas
     node tests/simulate.js
*/
const { JSDOM } = require('jsdom');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const errors = [];

JSDOM.fromFile(path.join(ROOT, 'index.html'), {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: new (require('jsdom').VirtualConsole)(),
  beforeParse(window) {
    window.Element.prototype.getBoundingClientRect = function () {
      return { left: 0, top: 0, width: 1280, height: 800, right: 1280, bottom: 800, x: 0, y: 0 };
    };
    window.HTMLCanvasElement.prototype.toBlob = function (cb, t) {
      try { cb(Buffer.from(this.toDataURL(t || 'image/png').split(',')[1], 'base64')); }
      catch (e) { cb(null); }
    };
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    let n = 0;
    window.URL.createObjectURL = () => 'blob:mock-' + (++n);
    window.URL.revokeObjectURL = () => {};
    window.addEventListener('error', e =>
      errors.push('onerror: ' + e.message + ' @ ' + (e.filename || '?').split('/').pop() + ':' + e.lineno));
  }
}).then(dom => {
  const w = dom.window, d = w.document;
  const results = [];
  const check = (name, ok, extra) =>
    results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  [' + extra + ']' : ''));

  setTimeout(() => {
    try {
      const F = w.Forge;
      const canvas = d.getElementById('canvas');
      const ctx = canvas.getContext('2d');

      const painted = () => {
        const im = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let n = 0;
        for (let i = 3; i < im.length; i += 16) if (im[i] > 8) n++;
        return n;
      };
      const alphaAt = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
      const pev = (type, x, y) => {
        const ev = new w.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
        Object.defineProperty(ev, 'isPrimary', { value: true });
        Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
        Object.defineProperty(ev, 'pointerId', { value: 7 });
        return ev;
      };
      const stroke = (pts) => {
        canvas.dispatchEvent(pev('pointerdown', pts[0][0], pts[0][1]));
        for (let i = 1; i < pts.length; i++) canvas.dispatchEvent(pev('pointermove', pts[i][0], pts[i][1]));
        canvas.dispatchEvent(pev('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1]));
      };
      const btn = id => d.getElementById(id);

      /* boot */
      check('boot: engine ready', F.Engine.ready());
      check('boot: tip loaded (diamond)', !!F.state.tipCanvas && F.state.tipName === 'diamond');
      check('boot: starter tips built', d.querySelectorAll('#tipsGrid .tip-thumb').length === 8);
      check('boot: flow palette sampled', F.Flow.palette.length > 100);

      /* blank floor */
      check('boot: canvas starts blank', painted() === 0);
      check('history: undo disabled at floor', btn('undoBtn').disabled === true);

      /* stamp stroke paints */
      stroke([[200, 400], [260, 410], [330, 420], [420, 430], [500, 440]]);
      const afterStamp = painted();
      check('stamp: stroke paints pixels', afterStamp > 50, afterStamp);
      check('history: undo enabled after stroke', btn('undoBtn').disabled === false);

      /* undo removes the stroke */
      F.Engine.undo();
      check('undo: canvas back to blank', painted() === 0);
      check('history: undo disabled again', btn('undoBtn').disabled === true);

      /* undo at floor is a safe no-op */
      F.Engine.undo();
      check('undo: no-op at floor is safe', painted() === 0);

      /* redo brings it back */
      F.Engine.redo();
      check('redo: stroke restored', painted() === afterStamp);
      check('history: redo disabled at top', btn('redoBtn').disabled === true);

      /* clear is undoable */
      F.Engine.clear();
      check('clear: canvas blank', painted() === 0);
      F.Engine.undo();
      check('clear: undo restores the art', painted() === afterStamp);
      F.Engine.redo();
      check('clear: redo re-clears', painted() === 0);

      /* multi step walk */
      F.Engine.undo();
      stroke([[600, 300], [700, 320], [800, 340]]);
      const two = painted();
      stroke([[600, 600], [700, 620]]);
      const three = painted();
      check('multi: each stroke grows the canvas', three > two && two > afterStamp, three + '>' + two + '>' + afterStamp);
      F.Engine.undo();
      check('multi: undo #1', painted() === two);
      F.Engine.undo();
      check('multi: undo #2', painted() === afterStamp);
      F.Engine.undo();
      check('multi: undo #3 back to blank', painted() === 0);
      F.Engine.redo(); F.Engine.redo(); F.Engine.redo();
      check('multi: 3 redos restore all', painted() === three);

      /* flow mode */
      F.UI.setMode('flow');
      stroke([[150, 650], [300, 660], [500, 680], [760, 700]]);
      check('flow: stroke paints', painted() > 50);
      const im = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let colorful = 0;
      for (let i = 0; i < im.length; i += 16) {
        if (im[i + 3] > 100 && (Math.abs(im[i] - im[i + 1]) > 40 || Math.abs(im[i + 1] - im[i + 2]) > 40)) colorful++;
      }
      check('flow: pixels carry palette color', colorful > 10, colorful);

      /* mirror symmetry */
      F.UI.setMode('stamp');
      F.UI.setSym('mirror');
      canvas.dispatchEvent(pev('pointerdown', 300, 200));
      canvas.dispatchEvent(pev('pointerup', 300, 200));
      check('mirror: both sides painted', alphaAt(300, 200) > 8 && alphaAt(1280 - 300, 200) > 8);
      F.UI.setSym('off');

      /* resize keeps art */
      w.Element.prototype.getBoundingClientRect = function () {
        return { left: 0, top: 0, width: 900, height: 700, right: 900, bottom: 700, x: 0, y: 0 };
      };
      F.Engine.resize();
      check('resize: art preserved', painted() > three * 0.8);

      /* png maker */
      const N = 256;
      const orig = d.createElement('canvas');
      orig.width = N; orig.height = N;
      const oc = orig.getContext('2d');
      oc.fillStyle = '#f2f2ee'; oc.fillRect(0, 0, N, N);
      oc.fillStyle = '#d43a3a'; oc.fillRect(96, 96, 64, 64);
      F.Cutout.setOriginal(orig);
      const out = F.Cutout.eraseAt(8, 8, 0.12);
      check('cutout: erase returns a canvas', !!out);
      const od = out.getContext('2d').getImageData(0, 0, N, N).data;
      const a = (x, y) => od[(y * N + x) * 4 + 3];
      check('cutout: background gone', a(8, 8) === 0 && a(90, 128) === 0);
      check('cutout: subject kept', a(128, 128) === 255 && a(100, 100) === 255);
      const back = F.Cutout.restore().getContext('2d').getImageData(0, 0, N, N).data;
      check('cutout: restore brings original back', back[(8 * N + 8) * 4 + 3] === 255);

      /* share + exports */
      const enc = F.Share.encode();
      const back2 = JSON.parse(decodeURIComponent(w.atob(enc)));
      check('share: state survives encoding', back2.mode === F.state.mode && back2.size === F.state.size);
      F.Export.exportTipPNG();
      F.Export.exportGBR();
      check('export: tip png + gbr run clean', errors.length === 0);
    } catch (e) {
      results.push('FAIL harness crashed: ' + e.message);
    }

    console.log(results.join('\n'));
    console.log('=== page errors during entire session ===');
    console.log(errors.length ? errors.join('\n') : '(none)');
    const fails = results.filter(r => r.startsWith('FAIL')).length;
    console.log('=== ' + (fails ? fails + ' FAILURES' : 'ALL PASS') + ' ===');
    process.exit(fails ? 1 : 0);
  }, 2600);
}).catch(e => { console.log('HARNESS BOOT FAIL:', e.message); process.exit(1); });
