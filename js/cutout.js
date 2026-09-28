/* ============================================================
   forge · cutout.js · the png maker
   Click a color on the tip preview and that connected patch turns
   transparent, with softened edges. Point it at a photo on a flat
   background and out comes a clean transparent PNG you can export,
   draw with, or hand to GIMP and Krita.
   ============================================================ */

Forge.Cutout = {
  N: 256,
  original: null,   // the untouched canvas from load time

  setOriginal(canvas) { this.original = canvas; },
  hasOriginal() { return !!this.original; },

  /* Erase everything connected to (nx, ny) whose color sits within
     tol01 of the sampled color. Kept pixels hugging the erased area
     fade out by how close their own color is, which kills the halo
     a hard edge would leave. Returns the new canvas. */
  eraseAt(nx, ny, tol01) {
    const N = this.N;
    if (!this.original) return null;

    const x0 = Forge.clamp(Math.round(nx), 0, N - 1);
    const y0 = Forge.clamp(Math.round(ny), 0, N - 1);

    const src = this.original.getContext('2d').getImageData(0, 0, N, N);
    const d = src.data;

    const start = (y0 * N + x0) * 4;
    if (d[start + 3] === 0) return null; // that spot is already empty

    const kr = d[start], kg = d[start + 1], kb = d[start + 2];
    const maxDist = 8 + tol01 * 200;
    const soft = Math.max(12, maxDist * 0.45);

    const dist = p => {
      const dr = d[p * 4] - kr, dg = d[p * 4 + 1] - kg, db = d[p * 4 + 2] - kb;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    // flood fill from the clicked pixel
    const visited = new Uint8Array(N * N);
    const stack = new Int32Array(N * N);
    let sp = 0;
    stack[sp++] = y0 * N + x0;
    visited[y0 * N + x0] = 1;

    const removed = [];
    while (sp > 0) {
      const p = stack[--sp];
      removed.push(p);
      d[p * 4 + 3] = 0;
      const px = p % N, py = (p / N) | 0;

      if (px > 0     && !visited[p - 1] && dist(p - 1) <= maxDist) { visited[p - 1] = 1; stack[sp++] = p - 1; }
      if (px < N - 1 && !visited[p + 1] && dist(p + 1) <= maxDist) { visited[p + 1] = 1; stack[sp++] = p + 1; }
      if (py > 0     && !visited[p - N] && dist(p - N) <= maxDist) { visited[p - N] = 1; stack[sp++] = p - N; }
      if (py < N - 1 && !visited[p + N] && dist(p + N) <= maxDist) { visited[p + N] = 1; stack[sp++] = p + N; }
    }

    // soften the cut edge: kept neighbours fade by their own color distance
    const fade = new Float32Array(N * N).fill(1);
    for (const p of removed) {
      const px = p % N, py = (p / N) | 0;
      const nbs = [];
      if (px > 0) nbs.push(p - 1);
      if (px < N - 1) nbs.push(p + 1);
      if (py > 0) nbs.push(p - N);
      if (py < N - 1) nbs.push(p + N);
      for (const q of nbs) {
        if (d[q * 4 + 3] === 0) continue; // already erased
        const dd = dist(q);
        if (dd <= maxDist + soft) {
          const m = Forge.clamp((dd - maxDist) / soft, 0, 1);
          if (m < fade[q]) fade[q] = m;
        }
      }
    }
    for (let q = 0; q < N * N; q++) {
      if (fade[q] < 1 && d[q * 4 + 3] > 0) {
        d[q * 4 + 3] = Math.round(d[q * 4 + 3] * fade[q]);
      }
    }

    const out = document.createElement('canvas');
    out.width = N; out.height = N;
    out.getContext('2d').putImageData(src, 0, 0);
    return out;
  },

  restore() { return this.original; }
};
