// ───────── Personajes esculpidos (prototipo Fase 59) ─────────
// Cada material es un campo de distancia (SDF) hecho de primitivas fundidas con unión suave; se poligoniza una vez
// (surface nets) con normales del gradiente, se pesa a un esqueleto y se anima en la GPU.
const V3 = (x, y, z) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mixf = (a, b, t) => a + (b - a) * t;
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { return -smin(-a, -b, k); }
function sph(p, c, r) { return len(sub(p, c)) - r; }
function cap(p, a, b, ra, rb, sz = 1) { // cono redondeado; sz aplasta en z (secciones ovaladas)
  const pa = [p[0] - a[0], p[1] - a[1], (p[2] - a[2]) * sz], ba = [b[0] - a[0], b[1] - a[1], (b[2] - a[2]) * sz];
  const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1); return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]) - mixf(ra, rb, h);
}
function ell(p, c, r) { const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]]; const k0 = len(q); const k1 = len([q[0] / r[0], q[1] / r[1], q[2] / r[2]]); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(...r); }
function rbox(p, c, b, r) { const q = [Math.abs(p[0] - c[0]) - b[0] + r, Math.abs(p[1] - c[1]) - b[1] + r, Math.abs(p[2] - c[2]) - b[2] + r]; return len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0) - r; }

/** Surface nets: devuelve { pos, nrm, idx } para el campo f dentro de la caja [lo, hi] con paso h. */
function polygonize(f, lo, hi, h) {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1, ny = Math.ceil((hi[1] - lo[1]) / h) + 1, nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const F = new Float32Array(nx * ny * nz); const I = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[I(i, j, k)] = f([lo[0] + i * h, lo[1] + j * h, lo[2] + k * h]);
  const vid = new Int32Array(nx * ny * nz).fill(-1); const pos = [], nrm = [], idx = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0; for (let c = 0; c < 8; c++) { v[c] = F[I(i + C[c][0], j + C[c][1], k + C[c][2])]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx += C[a][0] + (C[b][0] - C[a][0]) * t; sy += C[a][1] + (C[b][1] - C[a][1]) * t; sz += C[a][2] + (C[b][2] - C[a][2]) * t; n++; }
    const p = [lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h];
    vid[I(i, j, k)] = pos.length / 3; pos.push(p[0], p[1], p[2]);
    const e = h * 0.5; const g = [f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]), f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]), f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])]; const gl = len(g) || 1; nrm.push(g[0] / gl, g[1] / gl, g[2] / gl);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[I(i, j, k)] < 0;
    // aristas en +x, +y, +z que cruzan la superficie → un quad con las 4 celdas que la comparten
    if (i < nx - 1 && a !== (F[I(i + 1, j, k)] < 0)) quad(vid[I(i, j - 1, k - 1)], vid[I(i, j, k - 1)], vid[I(i, j, k)], vid[I(i, j - 1, k)], a);
    if (j < ny - 1 && a !== (F[I(i, j + 1, k)] < 0)) quad(vid[I(i - 1, j, k - 1)], vid[I(i - 1, j, k)], vid[I(i, j, k)], vid[I(i, j, k - 1)], a);
    if (k < nz - 1 && a !== (F[I(i, j, k + 1)] < 0)) quad(vid[I(i - 1, j - 1, k)], vid[I(i, j - 1, k)], vid[I(i, j, k)], vid[I(i - 1, j, k)], a);
  }
  function quad(a, b, c, d, flip) { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }
  return { pos, nrm, idx };
}
