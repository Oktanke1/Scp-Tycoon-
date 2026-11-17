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
  if (rule === 'skirt' && p[1] < 1.02) return [[0, 1]];
  const allow = rule === 'torso' ? (i) => i <= 2 : () => true; // equipo rígido: solo cadera, columna y pecho
  const d = BONES.map(([, , j, s], i) => [i, s ? segDist(p, J[s[0]], J[s[1]]) : len(sub(p, H0)) + 0.05]);
  const dd = d.filter(([i]) => allow(i)); d.length = 0; d.push(...dd); d.sort((a, b) => a[1] - b[1]); const w0 = 1 / Math.pow(d[0][1] + 0.01, 4), w1 = 1 / Math.pow(d[1][1] + 0.01, 4);
  return [[d[0][0], w0 / (w0 + w1)], [d[1][0], w1 / (w0 + w1)]];
}

// ───────── Piezas comunes ─────────
function lipsSDF(o) { // labios con arco de Cupido, labio inferior más lleno y comisuras
  const H = H0, sm = o.smile ?? 0;
  return (p) => {
    const x = p[0]; const bow = 0.003 * Math.exp(-Math.pow(x / 0.008, 2));
    let up = cap(p, [-0.024, H[1] - 0.052 + sm, H[2] + 0.096], [0, H[1] - 0.049 + bow, H[2] + 0.104], 0.0055, 0.0075);
    up = Math.min(up, cap(p, [0, H[1] - 0.049 + bow, H[2] + 0.104], [0.024, H[1] - 0.052 + sm, H[2] + 0.096], 0.0075, 0.0055));
    let lo = cap(p, [-0.017, H[1] - 0.064 + sm * 0.4, H[2] + 0.096], [0, H[1] - 0.066, H[2] + 0.104], 0.006, 0.0088);
    lo = Math.min(lo, cap(p, [0, H[1] - 0.066, H[2] + 0.104], [0.017, H[1] - 0.064 + sm * 0.4, H[2] + 0.096], 0.0088, 0.006));
    let d = smin(up, lo, 0.006);
    d = smax(d, -cap(p, [-0.028, H[1] - 0.0585 + sm * 0.7, H[2] + 0.108], [0.028, H[1] - 0.0585 + sm * 0.7, H[2] + 0.108], 0.0022, 0.0022), 0.002);
    return d;
  };
}
function headSDF(o) { // rostro esculpido: cráneo, mandíbula, mentón, pómulos, nariz, labios, arco de las cejas, orejas y cuello
  const H = H0, jw = o.jaw ?? 0.074, ns = (o.nose ?? 1) * 0.9, ck = o.cheek ?? 0.034;
  return (p) => {
    let d = ell(p, [H[0], H[1] + 0.03, H[2] - 0.012], [0.09, 0.108, 0.102]);
    d = smin(d, ell(p, [H[0], H[1] - 0.042, H[2] + 0.022], [jw, 0.064, 0.08]), 0.05);
    d = smin(d, sph(p, [0, H[1] - 0.092, H[2] + 0.058], 0.027), 0.035);
    for (const s of [-1, 1]) d = smin(d, sph(p, [s * 0.05, H[1] - 0.006, H[2] + 0.066], ck), 0.035);
    d = smin(d, cap(p, [-0.05, H[1] + 0.046, H[2] + 0.078], [0.05, H[1] + 0.046, H[2] + 0.078], 0.017, 0.017), 0.035);
    for (const s of [-1, 1]) d = smax(d, -sph(p, [s * 0.036, H[1] + 0.02, H[2] + 0.092], 0.0235), 0.01); // cuencas
    d = smin(d, cap(p, [0, H[1] + 0.03, H[2] + 0.094], [0, H[1] - 0.018, H[2] + 0.112 + 0.006 * ns], 0.011 * ns, 0.017 * ns), 0.016); // puente
    d = smin(d, sph(p, [0, H[1] - 0.022, H[2] + 0.113 + 0.006 * ns], 0.019 * ns), 0.012);
    for (const s of [-1, 1]) d = smin(d, sph(p, [s * 0.017 * ns, H[1] - 0.031, H[2] + 0.1], 0.013), 0.01); // aletas
    d = smin(d, ell(p, [0, H[1] - 0.058, H[2] + 0.086], [0.03, 0.02, 0.014]), 0.02);                     // boca (base de los labios)
    for (const s of [-1, 1]) { d = smin(d, ell(p, [s * 0.091, H[1] + 0.0, H[2] - 0.01], [0.017, 0.034, 0.025]), 0.014); d = smax(d, -ell(p, [s * 0.099, H[1] + 0.0, H[2] - 0.004], [0.008, 0.02, 0.013]), 0.004); }
    d = smin(d, cap(p, [0, 1.43, -0.005], [0, H[1] - 0.06, H[2] - 0.02], 0.056, 0.05), 0.03);
    return d;
  };
}
function handSDF(s, curl = 0.6) { // palma, cuatro dedos algo curvados y pulgar
  const w = J[s > 0 ? 'wrL' : 'wrR'];
  return (p) => {
    let d = ell(p, [w[0] + s * 0.004, w[1] - 0.046, w[2] + 0.008], [0.03, 0.05, 0.047]);
    for (let f = 0; f < 4; f++) { const z = w[2] + 0.036 - f * 0.021; const a = [w[0] + s * 0.004, w[1] - 0.075, z], b = [w[0] + s * (0.008 + curl * 0.01), w[1] - 0.122 + f * 0.006 + curl * 0.014, z + curl * 0.016]; d = smin(d, cap(p, a, b, 0.0125, 0.0108), 0.014); }
    d = smin(d, cap(p, [w[0] - s * 0.012, w[1] - 0.04, w[2] + 0.035], [w[0] - s * 0.01, w[1] - 0.085, w[2] + 0.062], 0.012, 0.0105), 0.014);
    return d;
  };
}
const armSeg = (p, s, r0, r1, r2, sz = 1) => smin(cap(p, J[s > 0 ? 'shL' : 'shR'], J[s > 0 ? 'elL' : 'elR'], r0, r1, sz), cap(p, J[s > 0 ? 'elL' : 'elR'], J[s > 0 ? 'wrL' : 'wrR'], r1 * 0.98, r2, sz), 0.03);
const legSeg = (p, s, r0, r1, r2) => smin(cap(p, J[s > 0 ? 'hiL' : 'hiR'], J[s > 0 ? 'knL' : 'knR'], r0, r1), cap(p, J[s > 0 ? 'knL' : 'knR'], J[s > 0 ? 'anL' : 'anR'], r1 * 0.98, r2), 0.035);
const both = (fn) => (p) => Math.min(fn(p, 1), fn(p, -1));
const fold = (p, amp, freq) => amp * Math.sin(p[0] * freq + Math.sin(p[1] * freq * 0.5) * 1.3) * Math.sin(p[1] * freq * 0.37 + 1.1); // arrugas suaves de tela
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
    const w = 0.022 + Math.max(0, 1.4 - p[1]) * 0.09; const open = Math.max(Math.abs(p[0]) - w, -(p[2] - 0.05)); d = smax(d, -open, 0.006);
    d += p[1] < 1.05 ? fold(p, 0.006, 55) * clamp((1.05 - p[1]) * 4, 0, 1) : fold(p, 0.0025, 45);
    for (const s of [-1, 1]) d = smin(d, cap(p, [s * 0.04, 1.43, 0.09], [s * (0.03 + 0.09 * 0.55), 1.2, 0.15], 0.012, 0.01), 0.012); // solapas
    d = smax(d, -rbox(p, [0.11, 0.86, 0.165], [0.045, 0.004, 0.03], 0.002), 0.003); d = smax(d, -rbox(p, [-0.11, 0.86, 0.165], [0.045, 0.004, 0.03], 0.002), 0.003); // bolsillos
    return d;
  };
  return {
    rules: { coat: 'skirt', tie: 'torso', shirt: 'torso' },
    parts: [
      { id: 'skin', color: '#e7b48f', mat: 'skin', h: 0.0035, lo: [-0.13, 1.42, -0.14], hi: [0.13, 1.82, 0.16], f: headSDF({ jaw: 0.072, nose: 1.1, cheek: 0.035 }) },
      { id: 'lips', color: '#c27b72', mat: 'skin', h: 0.0022, lo: [-0.04, 1.565, 0.07], hi: [0.04, 1.61, 0.12], f: lipsSDF({ smile: 0.002 }) },
      { id: 'handL', color: '#e7b48f', mat: 'skin', h: 0.004, lo: [0.22, 0.72, -0.06], hi: [0.4, 0.95, 0.11], f: handSDF(1) },
      { id: 'handR', color: '#e7b48f', mat: 'skin', h: 0.004, lo: [-0.4, 0.72, -0.06], hi: [-0.22, 0.95, 0.11], f: handSDF(-1) },
      { id: 'hair', color: '#5a3d2b', mat: 'hair', h: 0.004, lo: [-0.13, 1.58, -0.15], hi: [0.13, 1.8, 0.12], f: hairSDF('part') },
      { id: 'shirt', color: '#8ea7da', mat: 'cloth', h: 0.01, lo: [-0.22, 0.9, -0.18], hi: [0.22, 1.5, 0.2], f: (p) => smin(torsoSDF(p, 1, 0.74) - 0.002, cap(p, [0, 1.42, 0.0], [0, 1.49, 0.0], 0.068, 0.062), 0.02) },
      { id: 'tie', color: '#3d5a8a', mat: 'cloth', h: 0.004, lo: [-0.05, 1.12, 0.06], hi: [0.05, 1.47, 0.18], f: (p) => smin(cap(p, [0, 1.44, 0.135], [0, 1.16, 0.15], 0.012, 0.022, 3), sph(p, [0, 1.445, 0.128], 0.016), 0.01) },
      { id: 'coat', color: coat, mat: 'cloth', h: 0.011, lo: [-0.3, 0.55, -0.24], hi: [0.3, 1.52, 0.25], f: (p) => smin(torsoC(p), Math.min(armSeg(p, 1, 0.06, 0.052, 0.047), armSeg(p, -1, 0.06, 0.052, 0.047)) - fold(p, 0.003, 70), 0.03) },
      { id: 'cuffs', color: coatD, mat: 'cloth', h: 0.004, lo: [-0.38, 0.86, -0.06], hi: [0.38, 1.0, 0.09], f: both((p, s) => { const e = J[s > 0 ? 'elL' : 'elR'], w = J[s > 0 ? 'wrL' : 'wrR']; return cap(p, [w[0] + (e[0] - w[0]) * 0.18, w[1] + (e[1] - w[1]) * 0.18, w[2] + (e[2] - w[2]) * 0.18], w, 0.051, 0.05); }) },
      { id: 'pants', color: '#5d5967', mat: 'cloth', h: 0.011, lo: [-0.2, 0.05, -0.12], hi: [0.2, 1.02, 0.12], f: (p) => smin(both((q, s) => legSeg(q, s, 0.082, 0.062, 0.054))(p) - fold(p, 0.002, 80), cap(p, [-0.08, 0.93, 0], [0.08, 0.93, 0], 0.12, 0.12, 1.25), 0.05) },
      { id: 'shoes', color: '#3a2e2a', mat: 'leather', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.18, 0.2], f: (p) => Math.min(shoeSDF(1)(p), shoeSDF(-1)(p)) },
      { id: 'soles', color: '#1d1a19', mat: 'rubber', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.05, 0.2], f: (p) => Math.min(soleSDF(1)(p), soleSDF(-1)(p)) },
    ],
    extras: 'scientist', iris: '#4f7d4a', hairCol: '#5a3d2b', skin: '#e7b48f',
  };
}
function guard() {
  const suit = '#c3c8ce', vest = '#2c2f34';
  const vestF = (p) => { // portaplacas con placa frontal, laterales y hombreras
    let d = rbox(p, [0, 1.235, 0.005], [0.165, 0.18, 0.128], 0.05);
    d = smax(d, -cap(p, [0, 1.5, 0.0], [0, 1.42, 0.04], 0.075, 0.075), 0.02);                            // escote
    for (const s of [-1, 1]) d = smax(d, -ell(p, [s * 0.215, 1.34, 0], [0.07, 0.12, 0.1]), 0.02);          // sisas
    d = smin(d, rbox(p, [0, 1.22, 0.11], [0.12, 0.13, 0.03], 0.03), 0.015);                               // placa frontal
    return d;
  };
  const pouches = (p) => { let d = 1; for (const x of [-0.11, 0, 0.11]) d = Math.min(d, rbox(p, [x, 1.13, 0.155], [0.045, 0.055, 0.03], 0.012)); d = Math.min(d, rbox(p, [0, 1.33, 0.15], [0.12, 0.025, 0.022], 0.01)); return d; };
  return {
    rules: { vest: 'torso', pouch: 'torso', belt: 'torso', collar: 'torso' },
    parts: [
      { id: 'skin', color: '#c98f6a', mat: 'skin', h: 0.0035, lo: [-0.13, 1.42, -0.14], hi: [0.13, 1.82, 0.16], f: headSDF({ jaw: 0.082, nose: 0.95, cheek: 0.032 }) },
      { id: 'lips', color: '#a86452', mat: 'skin', h: 0.0022, lo: [-0.04, 1.565, 0.07], hi: [0.04, 1.61, 0.12], f: lipsSDF({ smile: -0.001 }) },
      { id: 'suit', color: suit, mat: 'cloth', h: 0.011, lo: [-0.3, 0.05, -0.2], hi: [0.3, 1.52, 0.2], f: (p) => smin(Math.min(torsoSDF(p, 1.04, 0.76), armSeg(p, 1, 0.062, 0.054, 0.047), armSeg(p, -1, 0.062, 0.054, 0.047)), both((q, s) => legSeg(q, s, 0.086, 0.065, 0.056))(p), 0.05) - fold(p, 0.0028, 70) },
      { id: 'vest', color: vest, mat: 'plastic', h: 0.01, lo: [-0.26, 0.98, -0.18], hi: [0.26, 1.5, 0.2], f: vestF },
      { id: 'pouch', color: '#3c3f45', mat: 'cloth', h: 0.008, lo: [-0.2, 1.04, 0.09], hi: [0.2, 1.38, 0.2], f: pouches },
      { id: 'belt', color: '#1c1d20', mat: 'leather', h: 0.008, lo: [-0.22, 0.88, -0.18], hi: [0.22, 1.0, 0.2], f: (p) => Math.max(cap(p, [0, 0.9, 0], [0, 1.0, 0], 0.168, 0.162, 1 / 0.78), Math.abs(p[1] - 0.95) - 0.026) },
      { id: 'pads', color: '#2f3136', mat: 'plastic', h: 0.008, lo: [-0.2, 0.4, -0.04], hi: [0.2, 0.6, 0.12], f: both((p, s) => rbox(p, [s * 0.105, 0.5, 0.06], [0.05, 0.06, 0.03], 0.025)) },
      { id: 'gloves', color: '#2b2d31', mat: 'leather', h: 0.004, lo: [-0.4, 0.72, -0.06], hi: [0.4, 0.97, 0.11], f: (p) => Math.min(handSDF(1, 0.7)(p) - 0.003, handSDF(-1, 0.7)(p) - 0.003, both((q, s) => cap(q, J[s > 0 ? 'wrL' : 'wrR'], [J[s > 0 ? 'wrL' : 'wrR'][0], J[s > 0 ? 'wrL' : 'wrR'][1] + 0.05, J[s > 0 ? 'wrL' : 'wrR'][2]], 0.05, 0.052))(p)) },
      { id: 'boots', color: '#202226', mat: 'leather', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.3, 0.2], f: (p) => Math.min(shoeSDF(1, 0.14)(p), shoeSDF(-1, 0.14)(p)) },
      { id: 'soles', color: '#121315', mat: 'rubber', h: 0.008, lo: [-0.18, -0.01, -0.1], hi: [0.18, 0.05, 0.2], f: (p) => Math.min(soleSDF(1)(p), soleSDF(-1)(p)) },
      { id: 'helmet', color: '#4a4e55', mat: 'plastic', h: 0.004, lo: [-0.15, 1.6, -0.16], hi: [0.15, 1.83, 0.16], f: (p) => { let d = ell(p, [0, H0[1] + 0.07, H0[2] - 0.01], [0.112, 0.105, 0.12]); d = smin(d, cap(p, [0, H0[1] + 0.045, -0.005], [0, H0[1] + 0.055, -0.005], 0.125, 0.122, 0.95), 0.01); return smax(d, -(p[1] - (H0[1] + 0.04)), 0.006); } },
      { id: 'collar', color: '#1f2125', mat: 'cloth', h: 0.004, lo: [-0.09, 1.4, -0.09], hi: [0.09, 1.52, 0.09], f: (p) => cap(p, [0, 1.42, 0], [0, 1.5, 0.005], 0.064, 0.06) },
    ],
    extras: 'guard', iris: '#5a3a22', hairCol: '#2a1d17', skin: '#c98f6a',
  };
}
