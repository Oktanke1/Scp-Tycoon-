// ───────── Esqueleto en reposo (metros; y arriba, z adelante) ─────────
const J = {
  hips: V3(0, 0.95, 0), spine: V3(0, 1.1, 0), chest: V3(0, 1.28, 0), neck: V3(0, 1.47, 0), head: V3(0, 1.56, 0),
  shL: V3(0.2, 1.42, 0), elL: V3(0.27, 1.16, -0.02), wrL: V3(0.3, 0.92, 0.02), haL: V3(0.31, 0.83, 0.03),
  shR: V3(-0.2, 1.42, 0), elR: V3(-0.27, 1.16, -0.02), wrR: V3(-0.3, 0.92, 0.02), haR: V3(-0.31, 0.83, 0.03),
  hiL: V3(0.1, 0.92, 0), knL: V3(0.105, 0.5, 0.01), anL: V3(0.105, 0.09, -0.01), toL: V3(0.11, 0.03, 0.14),
  hiR: V3(-0.1, 0.92, 0), knR: V3(-0.105, 0.5, 0.01), anR: V3(-0.105, 0.09, -0.01), toR: V3(-0.11, 0.03, 0.14),
};
const H0 = V3(0, 1.645, 0.0); // centro de la cabeza
const BONES = [ // nombre, padre, articulación, segmento para el pesado
  ['hips', null, 'hips', ['hiR', 'hiL']], ['spine', 'hips', 'spine', ['spine', 'chest']], ['chest', 'spine', 'chest', ['chest', 'neck']], ['neck', 'chest', 'neck', ['neck', 'head']], ['head', 'neck', 'head', null],
  ['uarmL', 'chest', 'shL', ['shL', 'elL']], ['farmL', 'uarmL', 'elL', ['elL', 'wrL']], ['handL', 'farmL', 'wrL', ['wrL', 'haL']],
  ['uarmR', 'chest', 'shR', ['shR', 'elR']], ['farmR', 'uarmR', 'elR', ['elR', 'wrR']], ['handR', 'farmR', 'wrR', ['wrR', 'haR']],
  ['thighL', 'hips', 'hiL', ['hiL', 'knL']], ['shinL', 'thighL', 'knL', ['knL', 'anL']], ['footL', 'shinL', 'anL', ['anL', 'toL']],
  ['thighR', 'hips', 'hiR', ['hiR', 'knR']], ['shinR', 'thighR', 'knR', ['knR', 'anR']], ['footR', 'shinR', 'anR', ['anR', 'toR']],
];
function segDist(p, a, b) { const pa = sub(p, a), ba = sub(b, a); const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1); return len([pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h]); }
/** Pesos de piel: las 2 articulaciones más cercanas; la cabeza y la falda de la bata se atan rígidas. */
function weigh(p, rule) {
  if (len(sub(p, H0)) < 0.16 && p[1] > 1.5) return [[4, 1]];
  if (rule === 'skirt' && p[1] < 1.02 && Math.min(segDist(p, J.elL, J.wrL), segDist(p, J.elR, J.wrR), segDist(p, J.wrL, J.haL), segDist(p, J.wrR, J.haR)) > 0.075) { const t = clamp((1.02 - p[1]) / 0.42, 0, 1) * 0.75; return [[0, 1 - t], [p[0] > 0 ? 11 : 14, t]]; }
  const allow = rule === 'torso' ? (i) => i <= 2 : () => true; // equipo rígido: solo cadera, columna y pecho
  // hueso más cercano (por segmento) y mezcla suave con el padre o el hijo cerca de la articulación
  let best = -1, bd = 1e9, bt = 0;
  for (let i = 0; i < BONES.length; i++) { if (!allow(i)) continue; const sg = BONES[i][3]; if (!sg) continue; const a = J[sg[0]], b = J[sg[1]]; const pa = sub(p, a), ba = sub(b, a); const t = clamp(dot(pa, ba) / dot(ba, ba), 0, 1); const dd = len([pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2] - ba[2] * t]); if (dd < bd) { bd = dd; best = i; bt = t; } }
  const par = BONES.findIndex((x) => x[0] === BONES[best][1]); const kid = BONES.findIndex((x) => x[1] === BONES[best][0] && x[3] && allow(BONES.indexOf(x)) && len(sub(J[x[3][0]], J[BONES[best][3][1]])) < 0.02);
  const sm = (x) => x * x * (3 - 2 * x);
  if (bt < 0.3 && par >= 0 && allow(par)) { const w = 0.5 + 0.5 * sm(bt / 0.3); return [[best, w], [par, 1 - w]]; }
  if (bt > 0.7 && kid >= 0) { const w = 0.5 + 0.5 * sm((1 - bt) / 0.3); return [[best, w], [kid, 1 - w]]; }
  return [[best, 1]];
}
// ───────── Piezas comunes ─────────
function lipsSDF(o) { // labios con arco de Cupido, labio inferior más lleno y comisuras
  const H = H0, sm = o.smile ?? 0;
  return (p) => {
    const x = p[0]; const bow = 0.003 * Math.exp(-Math.pow(x / 0.008, 2));
    let up = cap(p, [-0.02, H[1] - 0.051 + sm, H[2] + 0.086], [0, H[1] - 0.049 + bow, H[2] + 0.091], 0.0042, 0.0056);
    up = Math.min(up, cap(p, [0, H[1] - 0.049 + bow, H[2] + 0.091], [0.02, H[1] - 0.051 + sm, H[2] + 0.086], 0.0056, 0.0042));
    let lo = cap(p, [-0.015, H[1] - 0.061 + sm * 0.4, H[2] + 0.085], [0, H[1] - 0.063, H[2] + 0.0905], 0.0046, 0.0066);
    lo = Math.min(lo, cap(p, [0, H[1] - 0.063, H[2] + 0.0905], [0.015, H[1] - 0.061 + sm * 0.4, H[2] + 0.085], 0.0066, 0.0046));
    let d = smin(up, lo, 0.006);
    d = smax(d, -cap(p, [-0.026, H[1] - 0.0565 + sm * 0.7, H[2] + 0.099], [0.026, H[1] - 0.0565 + sm * 0.7, H[2] + 0.099], 0.0024, 0.0024), 0.0015);
    return d;
  };
}
function skinPaint(p) {
  const H = H0; let r = 1, g = 1, b = 1; const bl = (c, rad, k) => { const d = len(sub(p, c)); const w = Math.max(0, 1 - d / rad) * k; r -= w * 0.02; g -= w * 0.16; b -= w * 0.12; };
  for (const s of [-1, 1]) { bl([s * 0.055, H[1] - 0.015, H[2] + 0.07], 0.035, 1); bl([s * 0.095, H[1], H[2] - 0.01], 0.04, 0.8); const u = len(sub(p, [s * 0.036, H[1] + 0.0, H[2] + 0.09])); if (u < 0.022) { const w = (1 - u / 0.022) * 0.12; r -= w; g -= w; b -= w * 0.6; } }
  bl([0, H[1] - 0.025, H[2] + 0.12], 0.025, 0.9);
  return [r, g, b];
}
function headSDF(o) { // cara estilizada y sencilla: óvalo, mandíbula fina, nariz pequeña, orejas y cuello
  const H = H0, jw = o.jaw ?? 0.068, ns = (o.nose ?? 1) * 0.8;
  return (p) => {
    let d = ell(p, [H[0], H[1] + 0.025, H[2] - 0.01], [0.088, 0.108, 0.098]);              // cráneo
    d = smin(d, ell(p, [H[0], H[1] - 0.04, H[2] + 0.018], [jw, 0.062, 0.074]), 0.035);       // mandíbula
    d = smin(d, sph(p, [0, H[1] - 0.086, H[2] + 0.05], 0.022), 0.025);                      // mentón
    for (const s of [-1, 1]) d = smax(d, -sph(p, [s * 0.035, H[1] + 0.02, H[2] + 0.088], 0.02), 0.008); // cuencas suaves
    d = smin(d, cap(p, [0, H[1] + 0.02, H[2] + 0.088], [0, H[1] - 0.02, H[2] + 0.104 + 0.004 * ns], 0.008 * ns, 0.013 * ns), 0.012); // nariz
    d = smin(d, sph(p, [0, H[1] - 0.022, H[2] + 0.104 + 0.004 * ns], 0.014 * ns), 0.008);
    d = smin(d, ell(p, [0, H[1] - 0.056, H[2] + 0.08], [0.026, 0.016, 0.012]), 0.015);        // base de la boca
    for (const s of [-1, 1]) { d = smin(d, ell(p, [s * 0.088, H[1] + 0.0, H[2] - 0.008], [0.014, 0.03, 0.022]), 0.01); d = smax(d, -ell(p, [s * 0.095, H[1], H[2] - 0.003], [0.006, 0.017, 0.011]), 0.003); }
    d = smin(d, cap(p, [0, 1.43, -0.005], [0, H[1] - 0.06, H[2] - 0.02], 0.052, 0.048), 0.025);
    return d;
  };
}
function handSDF(s, curl = 0.5) { // mano estilizada: palma, bloque de dedos con surcos y pulgar
  const w = J[s > 0 ? 'wrL' : 'wrR'];
  return (p) => {
    let d = rbox(p, [w[0] + s * 0.004, w[1] - 0.05, w[2] + 0.008], [0.017, 0.038, 0.036], 0.015);                     // palma
    const fy = w[1] - 0.1, fz = w[2] + 0.008 + curl * 0.012;
    let f = rbox(p, [w[0] + s * (0.006 + curl * 0.006), fy, fz], [0.014, 0.03, 0.033], 0.012);                         // dedos juntos
    for (let k = 1; k < 4; k++) f = smax(f, -rbox(p, [w[0] + s * (0.006 + curl * 0.006), fy - 0.012, w[2] - 0.025 + k * 0.0165 + curl * 0.012], [0.02, 0.022, 0.0012], 0.001), 0.002); // separación entre dedos
    d = smin(d, f, 0.012);
    d = smin(d, cap(p, [w[0] - s * 0.008, w[1] - 0.04, w[2] + 0.036], [w[0] - s * 0.008, w[1] - 0.075, w[2] + 0.06], 0.011, 0.0095), 0.01); // pulgar
    return d;
  };
}
const armSeg = (p, s, r0, r1, r2, sz = 1) => smin(cap(p, J[s > 0 ? 'shL' : 'shR'], J[s > 0 ? 'elL' : 'elR'], r0, r1, sz), cap(p, J[s > 0 ? 'elL' : 'elR'], J[s > 0 ? 'wrL' : 'wrR'], r1 * 0.98, r2, sz), 0.03);
const legSeg = (p, s, r0, r1, r2) => smin(cap(p, J[s > 0 ? 'hiL' : 'hiR'], J[s > 0 ? 'knL' : 'knR'], r0, r1), cap(p, J[s > 0 ? 'knL' : 'knR'], J[s > 0 ? 'anL' : 'anR'], r1 * 0.98, r2), 0.035);
const both = (fn) => (p) => Math.min(fn(p, 1), fn(p, -1));
const fold = (p, amp, freq) => { const s = Math.sin(p[0] * freq * 0.8 + p[2] * freq * 0.6 + Math.sin(p[1] * freq * 0.3) * 1.6); return amp * (Math.pow(1 - Math.abs(s), 3) - 0.25); }; // pliegues con arista
const crease = (p, c, amp) => { const d = len(sub(p, c)); return d < 0.09 ? amp * Math.pow(Math.max(0, Math.sin(Math.atan2(p[0] - c[0], p[2] - c[2]) * 5 + p[1] * 90)), 6) * (1 - d / 0.09) : 0; }; // arrugas de codo y rodilla
const joints = (p) => crease(p, J.elL, 0.006) + crease(p, J.elR, 0.006) + crease(p, J.knL, 0.006) + crease(p, J.knR, 0.006);
function torsoSDF(p, w = 1, dz = 0.74) { // tronco con pecho, cintura y hombros, sección ovalada
  let d = cap(p, [0, 0.94, 0], [0, 1.1, 0], 0.16 * w, 0.145 * w, 1 / dz);
  d = smin(d, cap(p, [0, 1.1, 0.0], [0, 1.33, 0.012], 0.145 * w, 0.17 * w, 1 / dz), 0.06);
  d = smin(d, cap(p, [-0.15 * w, 1.405, 0], [0.15 * w, 1.405, 0], 0.062, 0.062, 1.2), 0.07);
  return d;
}
function shoeSDF(s, hi = 0) { const a = J[s > 0 ? 'anL' : 'anR']; return (p) => { let d = ell(p, [a[0], 0.045, a[2] + 0.05], [0.052, 0.05, 0.12]); d = smin(d, cap(p, [a[0], 0.04, a[2] - 0.02], [a[0], 0.1 + hi, a[2] - 0.01], 0.052, 0.05 + hi * 0.06), 0.03); return smax(d, -p[1] + 0.0, 0.005); }; }
function soleSDF(s) { const a = J[s > 0 ? 'anL' : 'anR']; return (p) => smax(ell(p, [a[0], 0.02, a[2] + 0.05], [0.056, 0.03, 0.126]), Math.max(-p[1], p[1] - 0.018), 0.004); }
function hairSDF(style) {
  const H = H0;
  return (p) => {
    let d = ell(p, [0, H[1] + 0.045, H[2] - 0.018], [0.097, 0.1, 0.108]);
    if (style === 'part') d = smin(d, ell(p, [-0.03, H[1] + 0.11, H[2] + 0.035], [0.075, 0.035, 0.07]), 0.03);
    d += 0.0025 * Math.sin(p[0] * 160 + p[2] * 60) * Math.sin(p[1] * 140); // mechones
    const hl = (p[1] - (H[1] + 0.06)) * 0.8 - (p[2] - H[2]) * 0.6 + 0.02; // nacimiento del pelo (frente)
    const side = p[1] - (H[1] + 0.0) + Math.max(0, p[2] - H[2] - 0.02) * 0.4;  // patillas
    return smax(d, -Math.max(hl, side * 1.0), 0.012);
  };
}

// ───────── Personajes de prueba ─────────
function scientist() {
  const coat = '#f3f5f7', coatD = '#dfe4e9';
  const torsoC = (p) => { // bata: tronco algo más holgado + faldón acampanado, abierta por delante en V, con pliegues
    let d = torsoSDF(p, 1.06, 0.78) - 0.006;
    d = smin(d, cap(p, [0, 1.1, 0], [0, 0.6, -0.01], 0.165, 0.215, 1 / 0.8), 0.06);
    const w = 0.022 + Math.max(0, 1.4 - p[1]) * 0.09; const open = Math.max(Math.abs(p[0]) - w, -(p[2] - 0.05)); d = smax(d, -open, 0.014);
    d = smax(d, 0.6 - p[1], 0.004);                                                         // dobladillo recto
    d += p[1] < 1.05 ? -fold(p, 0.0045, 32) * clamp((1.05 - p[1]) * 4, 0, 1) : 0;
    return d;
  };
  return {
    rules: { coat: 'skirt', tie: 'torso', shirt: 'torso' },
    parts: [
      { id: 'skin', color: '#e7b48f', mat: 'skin', h: 0.0035, lo: [-0.13, 1.42, -0.14], hi: [0.13, 1.82, 0.16], f: headSDF({ jaw: 0.072, nose: 1.1, cheek: 0.035 }), paint: skinPaint },
      { id: 'handL', color: '#e7b48f', mat: 'skin', h: 0.004, lo: [0.22, 0.72, -0.06], hi: [0.4, 0.95, 0.11], f: handSDF(1) },
      { id: 'handR', color: '#e7b48f', mat: 'skin', h: 0.004, lo: [-0.4, 0.72, -0.06], hi: [-0.22, 0.95, 0.11], f: handSDF(-1) },
      { id: 'hair', color: '#5a3d2b', mat: 'hair', h: 0.004, lo: [-0.13, 1.58, -0.15], hi: [0.13, 1.8, 0.12], f: hairSDF('part') },
      { id: 'shirt', color: '#8ea7da', mat: 'cloth', h: 0.01, lo: [-0.22, 0.9, -0.18], hi: [0.22, 1.5, 0.2], f: (p) => { let d = smin(torsoSDF(p, 1, 0.74) - 0.002, cap(p, [0, 1.42, 0.0], [0, 1.49, 0.0], 0.068, 0.062), 0.012); for (const s of [-1, 1]) d = Math.min(d, cap(p, [s * 0.02, 1.48, 0.065], [s * 0.05, 1.43, 0.11], 0.012, 0.008, 1)); return d; } },
      { id: 'tie', color: '#3d5a8a', mat: 'cloth', h: 0.004, lo: [-0.05, 1.12, 0.06], hi: [0.05, 1.47, 0.18], f: (p) => smin(cap(p, [0, 1.44, 0.135], [0, 1.16, 0.15], 0.012, 0.022, 3), sph(p, [0, 1.445, 0.128], 0.016), 0.01) },
      { id: 'coat', color: coat, mat: 'cloth', h: 0.0075, lo: [-0.3, 0.55, -0.24], hi: [0.3, 1.52, 0.25], f: (p) => smin(torsoC(p), Math.min(armSeg(p, 1, 0.06, 0.052, 0.047), armSeg(p, -1, 0.06, 0.052, 0.047)) - joints(p) * 0.6, 0.03) },
      { id: 'pants', color: '#5d5967', mat: 'cloth', h: 0.011, lo: [-0.2, 0.05, -0.12], hi: [0.2, 1.02, 0.12], f: (p) => smin(both((q, s) => legSeg(q, s, 0.082, 0.062, 0.054))(p) - joints(p), cap(p, [-0.08, 0.93, 0], [0.08, 0.93, 0], 0.12, 0.12, 1.25), 0.05) },
      { id: 'shoes', color: '#3a2e2a', mat: 'leather', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.18, 0.2], f: (p) => Math.min(shoeSDF(1)(p), shoeSDF(-1)(p)) },
      { id: 'soles', color: '#1d1a19', mat: 'rubber', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.05, 0.2], f: (p) => Math.min(soleSDF(1)(p), soleSDF(-1)(p)) },
    ],
    extras: 'scientist', iris: '#2f8fd8', lip: '#b56a62', smile: 0.004, hairCol: '#5a3d2b', skin: '#e7b48f',
  };
}
function guard() {
  const suit = '#c3c8ce', vest = '#2c2f34';
  const vestF = (p) => { // portaplacas con placa frontal, laterales y hombreras
    let d = rbox(p, [0, 1.235, 0.005], [0.165, 0.18, 0.128], 0.024);
    d = smax(d, -cap(p, [0, 1.5, 0.0], [0, 1.42, 0.04], 0.075, 0.075), 0.02);                            // escote
    for (const s of [-1, 1]) d = smax(d, -ell(p, [s * 0.215, 1.34, 0], [0.07, 0.12, 0.1]), 0.02);          // sisas
    d = Math.min(d, rbox(p, [0, 1.22, 0.112], [0.12, 0.13, 0.03], 0.012));                                // placa frontal
    for (let r = 0; r < 3; r++) d = smax(d, -rbox(p, [0, 1.3 - r * 0.045, 0.142], [0.11, 0.0035, 0.01], 0.002), 0.002); // cintas MOLLE
    return d;
  };
  const pouches = (p) => { let d = 1; for (const x of [-0.11, 0, 0.11]) { d = Math.min(d, rbox(p, [x, 1.13, 0.16], [0.045, 0.055, 0.028], 0.006)); d = Math.min(d, rbox(p, [x, 1.18, 0.168], [0.048, 0.018, 0.026], 0.005)); d = smax(d, -rbox(p, [x, 1.162, 0.195], [0.05, 0.002, 0.01], 0.001), 0.001); }
    d = Math.min(d, rbox(p, [0, 1.335, 0.155], [0.12, 0.025, 0.02], 0.005)); return d; };
  return {
    rules: { vest: 'torso', pouch: 'torso', belt: 'torso', collar: 'torso' },
    parts: [
      { id: 'skin', color: '#c98f6a', mat: 'skin', h: 0.0035, lo: [-0.13, 1.42, -0.14], hi: [0.13, 1.82, 0.16], f: headSDF({ jaw: 0.082, nose: 0.95, cheek: 0.032 }), paint: skinPaint },
      { id: 'suit', color: suit, mat: 'cloth', hideIn: ['vest', 'gloves', 'boots'], h: 0.011, lo: [-0.3, 0.05, -0.2], hi: [0.3, 1.52, 0.2], f: (p) => smin(Math.min(torsoSDF(p, 1.04, 0.76), armSeg(p, 1, 0.062, 0.054, 0.047), armSeg(p, -1, 0.062, 0.054, 0.047)), both((q, s) => legSeg(q, s, 0.086, 0.065, 0.056))(p), 0.05) - fold(p, 0.0016, 60) - joints(p) },
      { id: 'vest', color: vest, mat: 'plastic', h: 0.01, lo: [-0.26, 0.98, -0.18], hi: [0.26, 1.5, 0.2], f: vestF },
      { id: 'pouch', color: '#3c3f45', mat: 'cloth', h: 0.008, lo: [-0.2, 1.04, 0.09], hi: [0.2, 1.38, 0.2], f: pouches },
      { id: 'belt', color: '#1c1d20', mat: 'leather', h: 0.008, lo: [-0.22, 0.88, -0.18], hi: [0.22, 1.0, 0.2], f: (p) => Math.max(cap(p, [0, 0.9, 0], [0, 1.0, 0], 0.168, 0.162, 1 / 0.78), Math.abs(p[1] - 0.95) - 0.026) },
      { id: 'pads', color: '#2f3136', mat: 'plastic', h: 0.008, lo: [-0.2, 0.4, -0.04], hi: [0.2, 0.6, 0.12], f: both((p, s) => smin(rbox(p, [s * 0.105, 0.5, 0.062], [0.048, 0.058, 0.026], 0.012), rbox(p, [s * 0.105, 0.5, 0.04], [0.06, 0.012, 0.03], 0.004), 0.004)) },
      { id: 'gloves', color: '#2b2d31', mat: 'leather', h: 0.004, lo: [-0.4, 0.72, -0.06], hi: [0.4, 0.97, 0.11], f: (p) => Math.min(handSDF(1, 0.6)(p) - 0.003, handSDF(-1, 0.6)(p) - 0.003, both((q, s) => smax(cap(q, J[s > 0 ? 'wrL' : 'wrR'], [J[s > 0 ? 'wrL' : 'wrR'][0], J[s > 0 ? 'wrL' : 'wrR'][1] + 0.07, J[s > 0 ? 'wrL' : 'wrR'][2]], 0.054, 0.058), J[s > 0 ? 'wrL' : 'wrR'][1] + 0.07 - q[1] > 0 ? -1 : q[1] - J[s > 0 ? 'wrL' : 'wrR'][1] - 0.07, 0.002))(p)) },
      { id: 'boots', color: '#202226', mat: 'leather', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.3, 0.2], f: (p) => Math.min(shoeSDF(1, 0.14)(p), shoeSDF(-1, 0.14)(p)) },
      { id: 'soles', color: '#121315', mat: 'rubber', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.05, 0.2], f: (p) => Math.min(soleSDF(1)(p), soleSDF(-1)(p)) },
      { id: 'helmet', color: '#4a4e55', mat: 'plastic', h: 0.004, lo: [-0.15, 1.6, -0.16], hi: [0.15, 1.83, 0.16], f: (p) => { let d = ell(p, [0, H0[1] + 0.07, H0[2] - 0.01], [0.112, 0.105, 0.12]); d = Math.min(d, cap(p, [0, H0[1] + 0.045, -0.005], [0, H0[1] + 0.056, -0.005], 0.126, 0.123, 0.95)); for (const s of [-1, 1]) d = Math.min(d, rbox(p, [s * 0.112, H0[1] + 0.07, -0.01], [0.006, 0.012, 0.05], 0.003)); return smax(d, -(p[1] - (H0[1] + 0.04)), 0.002); } },
      { id: 'collar', color: '#1f2125', mat: 'cloth', h: 0.004, lo: [-0.09, 1.4, -0.09], hi: [0.09, 1.52, 0.09], f: (p) => cap(p, [0, 1.42, 0], [0, 1.5, 0.005], 0.064, 0.06) },
    ],
    extras: 'guard', iris: '#3f9a52', lip: '#93574a', smile: -0.002, hairCol: '#2a1d17', skin: '#c98f6a',
  };
}
