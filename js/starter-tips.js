/* ============================================================
   forge · starter-tips.js · eight tips drawn in code
   Each is a 128x128 canvas. Colors are laid out so Flow mode has
   interesting palettes out of the box.
   ============================================================ */

Forge.StarterTips = (function () {
  const S = 128, C = 64;
  const tips = [];

  function make(id, name, draw) {
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d');
    draw(x);
    tips.push({ id, name, canvas: c });
  }

  function linH(x, stops) {
    if (!x || typeof x.createLinearGradient !== 'function') {
      console.warn('linH got a bad context, using a flat color instead');
      return '#ffd66e';
    }
    const grad = x.createLinearGradient(0, 0, S, 0);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    return grad;
  }

  /* splat · 20 to 35 random circles (r 2 to 15) within 60px of center, half opacity.
     Hue follows x-position so the flow palette sweeps through the spectrum. */
  make('splat', 'Splatter', x => {
    const n = 20 + Math.floor(Math.random() * 16);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * 60;
      const px = C + Math.cos(a) * rr;
      const py = C + Math.sin(a) * rr;
      x.globalAlpha = 0.5;
      x.fillStyle = `hsl(${Math.round((px / S) * 320)} 85% 60%)`;
      x.beginPath();
      x.arc(px, py, 2 + Math.random() * 13, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
  });

  /* leaf · 30x80 ellipse, pointed via beziers, transparency gradient center to edge */
  make('leaf', 'Leaf', x => {
    const g = x.createLinearGradient(C - 15, 0, C + 15, 0);
    g.addColorStop(0,   'rgba(46,160,67,0.55)');
    g.addColorStop(0.5, 'rgba(130,225,130,0.95)');
    g.addColorStop(1,   'rgba(20,110,50,0.55)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(C, 24);
    x.bezierCurveTo(C + 16, 40, C + 16, 88, C, 104);
    x.bezierCurveTo(C - 16, 88, C - 16, 40, C, 24);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.25)';
    x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(C, 30); x.lineTo(C, 98); x.stroke();
  });

  /* diamond · rotated square, 60px across, blue to white to purple */
  make('diamond', 'Diamond', x => {
    x.fillStyle = linH(x, [[0, '#3b6cff'], [0.5, '#ffffff'], [1, '#a855f7']]);
    x.beginPath();
    x.moveTo(C, C - 30); x.lineTo(C + 30, C);
    x.lineTo(C, C + 30); x.lineTo(C - 30, C);
    x.closePath(); x.fill();
  });

  /* star · 5 point, 50px outer radius, amber */
  make('star', 'Star', x => {
    x.fillStyle = linH(x, [[0, '#ffd23f'], [1, '#ff7a00']]);
    const outer = 50, inner = 21;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = C + Math.cos(a) * r, py = C + Math.sin(a) * r;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath(); x.fill();
  });

  /* circle · soft center fading to 0 opacity at 60px radius, teal to pink */
  make('circle', 'Soft Circle', x => {
    x.fillStyle = linH(x, [[0, '#22d3ee'], [1, '#e879f9']]);
    x.beginPath(); x.arc(C, C, 60, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'destination-in';
    const m = x.createRadialGradient(C, C, 18, C, C, 60);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(0.55, 'rgba(0,0,0,1)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = m;
    x.beginPath(); x.arc(C, C, 60, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-over';
  });

  /* cross · two 8px thick bars, 60px long, brand lime */
  make('cross', 'Cross Mark', x => {
    x.fillStyle = '#c8ff00';
    x.fillRect(C - 30, C - 4, 60, 8);
    x.fillRect(C - 4, C - 30, 8, 60);
  });

  /* blob · organic closed bezier, roughly 70px across, indigo to magenta */
  make('blob', 'Ink Blob', x => {
    const radii = [34, 28, 36, 27, 33, 30, 35, 26];
    const n = radii.length;
    const pts = radii.map((r, i) => {
      const a = (i / n) * Math.PI * 2;
      return [C + Math.cos(a) * r, C + Math.sin(a) * r * 0.92];
    });
    const g = x.createLinearGradient(C - 30, C - 30, C + 30, C + 30);
    g.addColorStop(0, '#6d28d9');
    g.addColorStop(1, '#d946ef');
    x.fillStyle = g;
    x.beginPath();
    const mx = (pts[n - 1][0] + pts[0][0]) / 2, my = (pts[n - 1][1] + pts[0][1]) / 2;
    x.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    x.closePath(); x.fill();
  });

  /* crystal · six thin lines radiating from center, small snowflake branches */
  make('crystal', 'Crystal', x => {
    x.strokeStyle = '#cfe8ff';
    x.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const dx = Math.cos(a), dy = Math.sin(a);
      const len = 52;
      x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(C, C); x.lineTo(C + dx * len, C + dy * len); x.stroke();
      x.lineWidth = 1.4;
      const bx = C + dx * len * 0.6, by = C + dy * len * 0.6;
      for (const s of [-1, 1]) {
        const ba = a + s * Math.PI / 4;
        x.beginPath();
        x.moveTo(bx, by);
        x.lineTo(bx + Math.cos(ba) * 12, by + Math.sin(ba) * 12);
        x.stroke();
      }
    }
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(C, C, 3, 0, Math.PI * 2); x.fill();
  });

  return {
    all: () => tips,
    get: id => tips.find(t => t.id === id)
  };
})();
