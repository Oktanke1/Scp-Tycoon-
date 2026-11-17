// ───────── Construcción con Three.js ─────────
const MATS = { // materiales físicos: rugosidad / metalicidad / brillo
  skin: { roughness: 0.6, metalness: 0, sheen: 0.35, sheenColor: '#ff9f86', tex: 'skin', ns: 0.025 }, cloth: { roughness: 0.92, metalness: 0, sheen: 0.12, sheenColor: '#8f959c', tex: 'cloth', ns: 0.28 },
  leather: { roughness: 0.42, metalness: 0.02, clearcoat: 0.25, tex: 'leather', ns: 0.5 }, plastic: { roughness: 0.34, metalness: 0.02, clearcoat: 0.4, tex: 'grain', ns: 0.06 },
  rubber: { roughness: 0.8, metalness: 0, tex: 'grain', ns: 0.4 }, hair: { roughness: 0.5, metalness: 0, sheen: 0.6, sheenColor: '#d8c0a0', tex: 'hair', ns: 0.3 }, metal: { roughness: 0.3, metalness: 0.85 },
};
// mapas de relieve procedurales (tejido, cuero, piel, pelo, grano) → normales; las mallas llevan UV por proyección en caja
const TEXC = {};
function bumpTex(kind) {
  if (TEXC[kind]) return TEXC[kind];
  const N = 256, h = new Float32Array(N * N); const rnd = (i) => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
  const noise = (x, y, f) => { const xi = Math.floor(x * f), yi = Math.floor(y * f), xf = x * f - xi, yf = y * f - yi; const v = (a, b) => rnd(((a % f) + f) % f * 57 + ((b % f) + f) % f * 131 + f); const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf); return mixf(mixf(v(xi, yi), v(xi + 1, yi), sx), mixf(v(xi, yi + 1), v(xi + 1, yi + 1), sx), sy); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N, v = y / N; let z = 0;
    if (kind === 'cloth') z = 0.5 * Math.abs(Math.sin(u * Math.PI * 64)) * (Math.floor(v * 64) % 2 ? 1 : 0.6) + 0.5 * Math.abs(Math.sin(v * Math.PI * 64)) * (Math.floor(u * 64) % 2 ? 0.6 : 1) + noise(u, v, 16) * 0.5;
    else if (kind === 'leather') z = Math.pow(noise(u, v, 32), 2) + noise(u, v, 64) * 0.4;
    else if (kind === 'skin') z = noise(u, v, 64) * 0.6 + noise(u, v, 16) * 0.4;
    else if (kind === 'hair') z = Math.sin(u * Math.PI * 90 + noise(u, v, 8) * 6) * 0.5 + noise(u, v, 32) * 0.3;
    else z = noise(u, v, 48) * 0.6 + noise(u, v, 128) * 0.4;
    h[y * N + x] = z; }
  const c = document.createElement('canvas'); c.width = c.height = N; const x2 = c.getContext('2d'); const img = x2.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)], dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]; const l = Math.hypot(dx, dy, 0.5); const i = (y * N + x) * 4; img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (0.5 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255; }
  x2.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return (TEXC[kind] = t);
}
function material(kind, color, extra = {}) {
  const m = MATS[kind] ?? MATS.cloth;
  const o = { color, roughness: m.roughness, metalness: m.metalness, sheen: m.sheen ?? 0, sheenColor: new THREE.Color(m.sheenColor ?? '#ffffff'), sheenRoughness: 0.6, clearcoat: m.clearcoat ?? 0, clearcoatRoughness: 0.4 };
  if (m.tex && extra.vertexColors) { o.normalMap = bumpTex(m.tex); o.normalScale = new THREE.Vector2(m.ns, m.ns); }
  return new THREE.MeshPhysicalMaterial({ ...o, ...extra });
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
  for (let i = 0; i < n; i++) { let occ = 0, w = 1; for (let s = 1; s <= 5; s++) { const hh = s * 0.012; const q = [P[i * 3] + N[i * 3] * hh, P[i * 3 + 1] + N[i * 3 + 1] * hh, P[i * 3 + 2] + N[i * 3 + 2] * hh]; occ += (hh - all(q)) * w; w *= 0.6; } const ao = clamp(1 - occ * 6, 0.45, 1); const pc = part.paint ? part.paint([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]) : [1, 1, 1]; col[i * 3] = ao * pc[0]; col[i * 3 + 1] = ao * pc[1]; col[i * 3 + 2] = ao * pc[2]; }
  const uv = new Float32Array(n * 2); const US = part.mat === 'skin' ? 10 : part.mat === 'hair' ? 9 : part.mat === 'cloth' ? 16 : 10; for (let i = 0; i < n; i++) { const ax = Math.abs(N[i * 3]), ay = Math.abs(N[i * 3 + 1]), az = Math.abs(N[i * 3 + 2]); const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (ay >= ax && ay >= az) { uv[i * 2] = x * US; uv[i * 2 + 1] = z * US; } else if (ax >= az) { uv[i * 2] = z * US; uv[i * 2 + 1] = y * US; } else { uv[i * 2] = x * US; uv[i * 2 + 1] = y * US; } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nrm, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); geo.setIndex(I);
  const mt = material(part.mat, part.color, { vertexColors: true }); const m = window.NOSKIN ? new THREE.Mesh(geo, mt) : new THREE.SkinnedMesh(geo, mt); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  m.userData.stats = { tris: I.length / 3, ms: performance.now() - t0 };
  return m;
}
function irisTexture(col) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 6, 64, 64, 62); g.addColorStop(0, '#0b0807'); g.addColorStop(0.3, '#0b0807'); g.addColorStop(0.33, new THREE.Color(col).offsetHSL(0, 0, 0.12).getStyle()); g.addColorStop(0.62, new THREE.Color(col).offsetHSL(0, 0.15, 0.06).getStyle()); g.addColorStop(0.86, col); g.addColorStop(0.95, new THREE.Color(col).offsetHSL(0, 0, -0.2).getStyle()); g.addColorStop(1, '#1a1210');
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
    const eye = new THREE.Group(); eye.position.copy(rel(s * 0.035, H[1] + 0.02, H[2] + 0.072)); head.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0185, 32, 20), white); eye.add(ball);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0108, 40), irisMat); iris.position.z = 0.0168; eye.add(iris);
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.011, 24, 12, 0, Math.PI * 2, 0, 0.9), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0, clearcoat: 1 })); cornea.rotation.x = Math.PI / 2; cornea.position.z = 0.0105; eye.add(cornea);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0205, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), skin); lid.rotation.x = -0.4; eye.add(lid); rig.lids.push(lid);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.0196, 32, 12, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), skin); eye.add(lower);
    const curve = new THREE.CatmullRomCurve3([rel(s * 0.016, H[1] + 0.045, H[2] + 0.088), rel(s * 0.036, H[1] + 0.051, H[2] + 0.088), rel(s * 0.056, H[1] + 0.045, H[2] + 0.076)]);
    const brow = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.0042, 8), material('hair', def.hairCol)); head.add(brow); rig.brows.push({ m: brow, s });
  }
  { // boca: línea oscura y labios que siguen la superficie de la cara (se leen bien y permiten expresiones)
    const skinF = def.parts.find((q) => q.id === 'skin').f; const surfZ = (x, y) => { let z = H[2] + 0.16; for (let i = 0; i < 80 && skinF([x, y, z]) > 0.0005; i++) z -= Math.max(0.0008, skinF([x, y, z])); return z; };
    const sm = def.smile ?? 0; const curve = (dy, off, wd) => new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((u) => { const x = u * wd, y = H[1] - 0.057 + dy + sm * u * u; return rel(x, y, surfZ(x, y) + off); }));
    const lipM = material('skin', def.lip ?? '#b06a60', { roughness: 0.45 });
    head.add(new THREE.Mesh(new THREE.TubeGeometry(curve(0, 0.0012, 0.02), 24, 0.0013, 6), new THREE.MeshStandardMaterial({ color: '#4a2224', roughness: 0.7 })));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(curve(0.0028, -0.0008, 0.018), 24, 0.0026, 8), lipM));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(curve(-0.0038, -0.0008, 0.015), 24, 0.0033, 8), lipM));
  }
  if (def.extras === 'scientist') { // gafas de pasta
    const fr = material('plastic', '#2b2f36', { roughness: 0.3 });
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0025, 8, 32), fr); r.scale.y = 0.78; r.position.copy(rel(s * 0.036, H[1] + 0.02, H[2] + 0.1)); head.add(r);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.1, 6), fr); arm.rotation.x = Math.PI / 2; arm.position.copy(rel(s * 0.06, H[1] + 0.024, H[2] + 0.06)); head.add(arm); }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 6), fr); br.rotation.z = Math.PI / 2; br.position.copy(rel(0, H[1] + 0.028, H[2] + 0.101)); head.add(br);
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
  if (def.extras === 'guard') { // carabina sujeta con las dos manos (posición de «listo bajo») y radio
    const g = new THREE.Group(); const mm = material('metal', '#3d4a55'), pm = material('plastic', '#25282d');
    const add = (geo, mt, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
    add(new THREE.BoxGeometry(0.05, 0.075, 0.3), pm, 0, 0, 0); add(new THREE.CylinderGeometry(0.011, 0.011, 0.24, 12), mm, 0, 0.012, 0.27, Math.PI / 2);
    add(new THREE.BoxGeometry(0.056, 0.06, 0.16), pm, 0, 0.005, 0.12); add(new THREE.BoxGeometry(0.03, 0.12, 0.045), pm, 0, -0.085, 0.03, 0.25);
    add(new THREE.BoxGeometry(0.028, 0.08, 0.035), pm, 0, -0.06, -0.075, -0.35); add(new THREE.BoxGeometry(0.045, 0.07, 0.17), pm, 0, -0.01, -0.23); add(new THREE.BoxGeometry(0.02, 0.03, 0.1), mm, 0, 0.055, -0.0);
    g.position.set(0.0, 1.06 - J.chest[1], 0.24); g.rotation.set(0.55, 0.95, 0); sk.byName.chest.add(g);
    g.userData.grip = new THREE.Vector3(0, -0.07, -0.085); g.userData.fore = new THREE.Vector3(0, -0.035, 0.15); sk.rifle = g;
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.022), pm); radio.position.set(-0.12, 1.36 - J.chest[1], 0.13); sk.byName.chest.add(radio);
  }
  if (def.extras === 'scientist') { // tableta en la mano izquierda
    const tab = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.23), material('plastic', '#2b2f36')); b.castShadow = true; tab.add(b);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshBasicMaterial({ color: '#7fd8f0' })); scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0065; tab.add(scr);
    sk.tablet = tab;
  }
}
function buildCharacter(def) {
  const sk = buildSkeleton(); const root = new THREE.Group(); root.add(sk.bones[0]);
  root.updateMatrixWorld(true); sk.skeleton.calculateInverses(); // reposo con los huesos ya colocados
  const all = (p) => { let d = 1e9; for (const q of def.parts) { const lo = q.lo, hi = q.hi; if (p[0] < lo[0] - 0.06 || p[0] > hi[0] + 0.06 || p[1] < lo[1] - 0.06 || p[1] > hi[1] + 0.06 || p[2] < lo[2] - 0.06 || p[2] > hi[2] + 0.06) continue; d = Math.min(d, q.f(p)); } return d; };
  for (const part of def.parts) if (part.hideIn) { const f0 = part.f, cov = part.hideIn.map((id) => def.parts.find((q) => q.id === id)?.f).filter(Boolean); part.f = (p) => { let d = f0(p); for (const g of cov) d = Math.max(d, -(g(p) + 0.006)); return d; }; }
  const stats = []; for (const part of def.parts) { const m = meshFromSDF(part, def.rules[part.id], sk, all); root.add(m); m.updateMatrixWorld(true); if (m.isSkinnedMesh) m.bind(sk.skeleton, m.matrixWorld); stats.push([part.id, m.userData.stats]); }
  const rig = faceRig(def, sk.byName.head); attachProps(def, sk); if (sk.tablet) root.add(sk.tablet);
  return { root, sk, rig, stats, def };
}
// ───────── Animación (estilo EG2: cadera que se balancea, hombros que contrarrotan, pies que ruedan, gestos) ─────────
const _v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const REST = { uL: _v(sub(J.elL, J.shL)).normalize(), fL: _v(sub(J.wrL, J.elL)).normalize(), uR: _v(sub(J.elR, J.shR)).normalize(), fR: _v(sub(J.wrR, J.elR)).normalize(),
  L1: len(sub(J.elL, J.shL)), L2: len(sub(J.wrL, J.elL)) };
/** IK de dos huesos: lleva la muñeca del brazo `s` (1 izq., -1 der.) al punto T (espacio del personaje) con el codo hacia `pole`. */
function reach(ch, s, T, pole) {
  const b = ch.sk.byName, root = ch.root; const ua = b[s > 0 ? 'uarmL' : 'uarmR'], fa = b[s > 0 ? 'farmL' : 'farmR'];
  root.updateMatrixWorld(true); const inv = root.matrixWorld.clone().invert();
  const S = ua.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); const L1 = REST.L1, L2 = REST.L2;
  const toT = T.clone().sub(S); const d = Math.min(toT.length(), L1 + L2 - 1e-3); const dir = toT.normalize();
  const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  const pb = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(L1 * ca)).add(pb.multiplyScalar(L1 * sa)); const W = S.clone().add(dir.clone().multiplyScalar(d));
  const qRoot = new THREE.Quaternion(); root.getWorldQuaternion(qRoot); const qChest = new THREE.Quaternion(); b.chest.getWorldQuaternion(qChest); const qC = qRoot.clone().invert().multiply(qChest);
  const qU = new THREE.Quaternion().setFromUnitVectors(s > 0 ? REST.uL : REST.uR, E.clone().sub(S).normalize());
  const fr = (s > 0 ? REST.fL : REST.fR).clone().applyQuaternion(qU); const qF = new THREE.Quaternion().setFromUnitVectors(fr, W.clone().sub(E).normalize()).multiply(qU);
  ua.quaternion.copy(qC.clone().invert().multiply(qU)); fa.quaternion.copy(qU.clone().invert().multiply(qF));
}
const local = (ch, obj, v) => { ch.root.updateMatrixWorld(true); return obj.localToWorld(v.clone()).applyMatrix4(ch.root.matrixWorld.clone().invert()); };
function animate(ch, t, mode, ph = 0) {
  const b = ch.sk.byName; const R = (bn, x = 0, y = 0, z = 0) => b[bn].rotation.set(x, y, z);
  for (const k in b) b[k].rotation.set(0, 0, 0); b.hips.position.set(J.hips[0], J.hips[1], J.hips[2]);
  const armed = !!ch.sk.rifle; const breathe = Math.sin(t * 2.1 + ph);
  R('chest', -0.02 - breathe * 0.012); R('uarmL', 0, 0, 0.07); R('uarmR', 0, 0, -0.07); R('farmL', -0.22); R('farmR', -0.22);
  if (mode === 'walk') {
    const w = t * 6.6 + ph, s = Math.sin(w), c = Math.cos(w);
    b.hips.position.y = J.hips[1] - 0.012 - Math.abs(c) * 0.026; b.hips.position.x = s * 0.018;                 // rebote y vaivén
    R('hips', 0.04, s * 0.14, -s * 0.055); R('spine', 0.03, -s * 0.12, s * 0.03); R('chest', 0.05, -s * 0.1, s * 0.02);
    R('thighL', -s * 0.55); R('thighR', s * 0.55);
    R('shinL', Math.max(0, -c) * 0.95 + 0.06); R('shinR', Math.max(0, c) * 0.95 + 0.06);                          // rodilla en el paso
    R('footL', s * 0.35 - Math.max(0, -c) * 0.5); R('footR', -s * 0.35 - Math.max(0, c) * 0.5);                  // el pie rueda: talón → punta
    R('uarmL', s * 0.5, 0, 0.09); R('uarmR', -s * 0.5, 0, -0.09);
    R('farmL', -0.32 - Math.max(0, Math.sin(w - 0.5)) * 0.4); R('farmR', -0.32 - Math.max(0, -Math.sin(w - 0.5)) * 0.4); // codo con retraso
    R('head', -0.03, s * 0.08, -s * 0.02);
  } else if (mode === 'fear') {
    const sh = Math.sin(t * 31) * 0.02; b.hips.position.y = J.hips[1] - 0.07;
    R('thighL', -0.35); R('thighR', -0.3); R('shinL', 0.6); R('shinR', 0.55); R('footL', -0.25); R('footR', -0.25); R('spine', 0.22 + sh); R('chest', 0.15);
    R('head', 0.2 + sh, Math.sin(t * 5 + ph) * 0.35, 0);
  } else { // reposo: cambio de peso con una rodilla floja y la cabeza que mira alrededor
    const ws = Math.sin(t * 0.55 + ph); b.hips.position.x = ws * 0.03; R('hips', 0, ws * 0.05, ws * 0.045); R('spine', 0, -ws * 0.04, -ws * 0.035);
    R('shinL', Math.max(0, ws) * 0.16); R('thighL', -Math.max(0, ws) * 0.08); R('shinR', Math.max(0, -ws) * 0.16); R('thighR', -Math.max(0, -ws) * 0.08);
    const look = Math.sin(t * 0.33 + ph * 2); R('head', 0.03 + Math.sin(t * 0.8) * 0.03, look * 0.5 + Math.sin(t * 1.7) * 0.04, 0);
  }
  // manos: arma sujeta con las dos manos; tableta y gesto de subirse las gafas
  if (armed) {
    const g = ch.sk.rifle; if (mode === 'fear') g.rotation.set(1.0, 0.95, 0); else g.rotation.set(0.55, 0.95, 0);
    reach(ch, -1, local(ch, g, g.userData.grip), new THREE.Vector3(-1, -0.6, -0.4)); reach(ch, 1, local(ch, g, g.userData.fore), new THREE.Vector3(1, -1, -0.2));
  } else if (ch.sk.tablet) {
    const tab = ch.sk.tablet; const chestP = local(ch, b.chest, new THREE.Vector3(0, 0, 0));
    if (mode === 'fear') { reach(ch, 1, chestP.clone().add(new THREE.Vector3(0.12, 0.28, 0.22)), new THREE.Vector3(1, -0.5, 0)); reach(ch, -1, chestP.clone().add(new THREE.Vector3(-0.12, 0.28, 0.22)), new THREE.Vector3(-1, -0.5, 0)); }
    else {
      const T = chestP.clone().add(new THREE.Vector3(0.11, -0.3 + (mode === 'walk' ? Math.sin(t * 6.6 + ph) * 0.01 : 0), 0.3)); reach(ch, 1, T, new THREE.Vector3(1, -1, -0.4)); // la tableta en el brazo de su lado
      tab.position.copy(T).add(new THREE.Vector3(-0.03, 0.025, 0.02)); tab.rotation.set(-1.05, 0.35, 0.05);
      const cyc = (t + ph) % 7; // cada 7 s se sube las gafas; el resto del tiempo la otra mano descansa
      if (mode !== 'walk' && cyc > 5) { const head = local(ch, b.head, new THREE.Vector3(0.0, 0.05, 0.12)); reach(ch, -1, head.add(new THREE.Vector3(-0.012, -0.035, 0.035)), new THREE.Vector3(-1, -1, 0)); }
    }
  }
  // parpadeo y expresión
  const blink = (t * 1000 + ph * 500) % 4200 < 130; const lidRx = blink ? 1.3 : mode === 'fear' ? -0.6 : -0.4;
  for (const l of ch.rig.lids) l.rotation.x = lidRx;
  for (const { m, s: sd } of ch.rig.brows) { m.rotation.z = mode === 'fear' ? -sd * 0.12 : 0; m.position.y = mode === 'fear' ? 0.006 : 0; }
}
