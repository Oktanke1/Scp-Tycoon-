// ───────── Construcción con Three.js ─────────
const MATS = { // materiales físicos: rugosidad / metalicidad / brillo
  skin: { roughness: 0.55, metalness: 0, sheen: 0.25 }, cloth: { roughness: 0.88, metalness: 0, sheen: 0.4 }, leather: { roughness: 0.5, metalness: 0.05 },
  plastic: { roughness: 0.42, metalness: 0.05 }, rubber: { roughness: 0.75, metalness: 0 }, hair: { roughness: 0.6, metalness: 0, sheen: 0.5 }, metal: { roughness: 0.32, metalness: 0.85 },
};
function material(kind, color, extra = {}) {
  const m = MATS[kind] ?? MATS.cloth;
  return new THREE.MeshPhysicalMaterial({ color, roughness: m.roughness, metalness: m.metalness, sheen: m.sheen ?? 0, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8, ...extra });
}
function buildSkeleton() {
  const bones = []; const byName = {};
  for (const [name, parent, j] of BONES) { const b = new THREE.Bone(); b.name = name; const p = J[j]; const pp = parent ? J[BONES.find((x) => x[0] === parent)[2]] : [0, 0, 0]; b.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); if (parent) byName[parent].add(b); bones.push(b); byName[name] = b; }
  return { bones, byName, skeleton: new THREE.Skeleton(bones) };
}
function meshFromSDF(part, rule, skel, all) {
  const t0 = performance.now(); const g = polygonize(part.f, part.lo, part.hi, part.h);
  const n = g.pos.length / 3; const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const w = weigh([g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]], rule); for (let k = 0; k < w.length; k++) { si[i * 4 + k] = w[k][0]; sw[i * 4 + k] = w[k][1]; } }
  // orientación de los triángulos según la normal del campo
  const P = g.pos, N = g.nrm, I = g.idx;
  for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2]; const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx; if (fx * (N[a] + N[b] + N[c]) + fy * (N[a + 1] + N[b + 1] + N[c + 1]) + fz * (N[a + 2] + N[b + 2] + N[c + 2]) < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; } }
  const col = new Float32Array(n * 3); // AO: cuánto «se cierra» el campo al alejarse por la normal
  for (let i = 0; i < n; i++) { let occ = 0, w = 1; for (let s = 1; s <= 5; s++) { const hh = s * 0.012; const q = [P[i * 3] + N[i * 3] * hh, P[i * 3 + 1] + N[i * 3 + 1] * hh, P[i * 3 + 2] + N[i * 3 + 2] * hh]; occ += (hh - all(q)) * w; w *= 0.6; } const ao = clamp(1 - occ * 7, 0.35, 1); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nrm, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setIndex(I);
  const mt = material(part.mat, part.color, { vertexColors: true }); const m = window.NOSKIN ? new THREE.Mesh(geo, mt) : new THREE.SkinnedMesh(geo, mt); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  m.userData.stats = { tris: I.length / 3, ms: performance.now() - t0 };
  return m;
}
function irisTexture(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, '#0b0807'); g.addColorStop(0.38, '#0b0807'); g.addColorStop(0.41, new THREE.Color(col).offsetHSL(0, 0, 0.12).getStyle()); g.addColorStop(0.8, col); g.addColorStop(0.95, new THREE.Color(col).offsetHSL(0, 0, -0.2).getStyle()); g.addColorStop(1, '#1a1210');
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1.2; for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.283; x.beginPath(); x.moveTo(64 + Math.cos(a) * 22, 64 + Math.sin(a) * 22); x.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Ojos (blanco, iris con pupila, córnea brillante), párpados, cejas y accesorios, colgados del hueso de la cabeza. */
function faceRig(def, head) {
  const H = H0, hb = J.head; const rel = (x, y, z) => new THREE.Vector3(x - hb[0], y - hb[1], z - hb[2]);
  const rig = { lids: [], brows: [] };
  const white = material('plastic', '#f5f1ea', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }); const skin = material('skin', def.skin);
  const irisMat = new THREE.MeshPhysicalMaterial({ map: irisTexture(def.iris), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.copy(rel(s * 0.036, H[1] + 0.02, H[2] + 0.079)); head.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 32, 20), white); eye.add(ball);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 32), irisMat); iris.position.z = 0.0176; eye.add(iris);
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.011, 24, 12, 0, Math.PI * 2, 0, 0.9), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0, clearcoat: 1 })); cornea.rotation.x = Math.PI / 2; cornea.position.z = 0.0105; eye.add(cornea);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0205, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), skin); lid.rotation.x = -0.12; eye.add(lid); rig.lids.push(lid);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.0196, 32, 12, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), skin); eye.add(lower);
    const curve = new THREE.CatmullRomCurve3([rel(s * 0.016, H[1] + 0.047, H[2] + 0.097), rel(s * 0.038, H[1] + 0.054, H[2] + 0.096), rel(s * 0.058, H[1] + 0.047, H[2] + 0.084)]);
    const brow = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.0042, 8), material('hair', def.hairCol)); head.add(brow); rig.brows.push({ m: brow, s });
  }
  if (def.extras === 'scientist') { // gafas de pasta
    const fr = material('plastic', '#2b2f36', { roughness: 0.3 });
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0025, 8, 32), fr); r.scale.y = 0.78; r.position.copy(rel(s * 0.037, H[1] + 0.022, H[2] + 0.108)); head.add(r);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.1, 6), fr); arm.rotation.x = Math.PI / 2; arm.position.copy(rel(s * 0.06, H[1] + 0.024, H[2] + 0.06)); head.add(arm); }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 6), fr); br.rotation.z = Math.PI / 2; br.position.copy(rel(0, H[1] + 0.03, H[2] + 0.11)); head.add(br);
  }
  if (def.extras === 'guard') { // visor amarillo curvo
    const vis = new THREE.Mesh(new THREE.SphereGeometry(0.136, 40, 12, Math.PI / 2 - 0.9, 1.8, 1.24, 0.34), new THREE.MeshPhysicalMaterial({ color: 0xf2c230, transparent: true, opacity: 0.82, roughness: 0.08, metalness: 0.2, clearcoat: 1, side: THREE.DoubleSide }));
    vis.rotation.y = Math.PI / 2 - Math.PI / 2; vis.position.copy(rel(0, H[1] - 0.012, H[2] - 0.0)); vis.rotation.y = 0; head.add(vis);
  }
  return rig;
}
function attachProps(def, sk) {
  if (def.extras === 'scientist') { // credencial con pinza y bolígrafo en el bolsillo
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.068, 0.004), material('plastic', '#f4f6f8')); card.position.set(0.09, 1.31 - J.chest[1], 0.165); card.rotation.x = -0.12; sk.byName.chest.add(card);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.0045), material('plastic', '#33bccf')); band.position.set(0.09, 1.338 - J.chest[1], 0.1655); band.rotation.x = -0.12; sk.byName.chest.add(band);
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), material('plastic', '#2f5aa8')); pen.position.set(-0.1, 1.33 - J.chest[1], 0.16); sk.byName.chest.add(pen);
  }
  if (def.extras === 'guard') { // carabina en bandolera, linterna, radio
    const g = new THREE.Group(); const mm = material('metal', '#3d4a55'), pm = material('plastic', '#25282d');
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    add(new THREE.BoxGeometry(0.05, 0.08, 0.32), pm, 0, 0, 0); add(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), mm, 0, 0.015, 0.28).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.03, 0.11, 0.045), pm, 0, -0.08, 0.05).rotation.x = 0.25; add(new THREE.BoxGeometry(0.045, 0.06, 0.16), pm, 0, -0.01, -0.22); add(new THREE.BoxGeometry(0.02, 0.025, 0.12), mm, 0, 0.055, 0.02);
    g.position.set(0.02, 1.13 - J.chest[1], 0.2); g.rotation.set(0.15, 0, -0.85); sk.byName.chest.add(g);
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.022), pm); radio.position.set(-0.12, 1.36 - J.chest[1], 0.13); sk.byName.chest.add(radio);
  }
}
function buildCharacter(def) {
  const sk = buildSkeleton(); const root = new THREE.Group(); root.add(sk.bones[0]);
  root.updateMatrixWorld(true); sk.skeleton.calculateInverses(); // reposo con los huesos ya colocados
  const all = (p) => { let d = 1e9; for (const q of def.parts) { const lo = q.lo, hi = q.hi; if (p[0] < lo[0] - 0.06 || p[0] > hi[0] + 0.06 || p[1] < lo[1] - 0.06 || p[1] > hi[1] + 0.06 || p[2] < lo[2] - 0.06 || p[2] > hi[2] + 0.06) continue; d = Math.min(d, q.f(p)); } return d; };
  const stats = []; for (const part of def.parts) { const m = meshFromSDF(part, def.rules[part.id], sk, all); root.add(m); m.updateMatrixWorld(true); if (m.isSkinnedMesh) m.bind(sk.skeleton, m.matrixWorld); stats.push([part.id, m.userData.stats]); }
  const rig = faceRig(def, sk.byName.head); attachProps(def, sk);
  return { root, sk, rig, stats, def };
}
// ───────── Animación (mismas poses que el juego: reposo, andar, trabajar, susto) ─────────
function animate(ch, t, mode, ph = 0) {
  const b = ch.sk.byName; const s = Math.sin(t * 7.5 + ph);
  for (const k in b) b[k].rotation.set(0, 0, 0);
  const breathe = Math.sin(t * 2.2 + ph) * 0.02;
  b.chest.rotation.x = -breathe * 0.5; b.head.rotation.y = Math.sin(t * 0.4 + ph) * 0.35; b.head.rotation.x = Math.sin(t * 0.7 + ph) * 0.04;
  b.uarmL.rotation.z = 0.06; b.uarmR.rotation.z = -0.06; b.farmL.rotation.x = -0.18; b.farmR.rotation.x = -0.18;
  if (mode === 'walk') {
    b.thighL.rotation.x = -s * 0.5; b.thighR.rotation.x = s * 0.5; b.shinL.rotation.x = Math.max(0, s) * 0.7; b.shinR.rotation.x = Math.max(0, -s) * 0.7;
    b.uarmL.rotation.x = s * 0.45; b.uarmR.rotation.x = -s * 0.45; b.farmL.rotation.x = -0.35 - Math.max(0, s) * 0.3; b.farmR.rotation.x = -0.35 - Math.max(0, -s) * 0.3;
    b.spine.rotation.y = s * 0.12; b.hips.rotation.y = -s * 0.08; b.hips.position.y = J.hips[1] - Math.abs(s) * 0.02; b.head.rotation.y = -s * 0.08;
  } else if (mode === 'fear') {
    b.uarmL.rotation.x = -2.4; b.uarmR.rotation.x = -2.4; b.uarmL.rotation.z = 0.5; b.uarmR.rotation.z = -0.5; b.farmL.rotation.x = -1.2; b.farmR.rotation.x = -1.2; b.head.rotation.x = 0.15; b.head.rotation.y = Math.sin(t * 6) * 0.3;
  } else { b.hips.position.x = Math.sin(t * 0.6 + ph) * 0.012; }
  // parpadeo y expresión
  const blink = (t * 1000 + ph * 500) % 4200 < 130; const lidRx = blink ? 1.3 : mode === 'fear' ? -0.45 : -0.12;
  for (const l of ch.rig.lids) l.rotation.x = lidRx;
  for (const { m, s: sd } of ch.rig.brows) { m.rotation.z = mode === 'fear' ? -sd * 0.12 : 0; m.position.y = mode === 'fear' ? 0.006 : 0; }
}
