const W = 1200, Hh = 800;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, Hh); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a2e33');
const pm = new THREE.PMREMGenerator(renderer); // entorno suave para reflejos (sala neutra)
const env = new THREE.Scene(); env.add(new THREE.HemisphereLight(0xffffff, 0x60656c, 3)); const panel = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff })); panel.position.set(0, 3, 1); panel.lookAt(0, 0, 0); env.add(panel);
scene.environment = pm.fromScene(env, 0.04).texture;
scene.add(new THREE.HemisphereLight(0xeef2ff, 0x4a4540, 0.45));
const sun = new THREE.DirectionalLight(0xffefd8, 3.3); sun.position.set(2.2, 4.5, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: 0.5, far: 12 }); scene.add(sun);
const rim = new THREE.DirectionalLight(0xbfd8ff, 1.8); rim.position.set(-3, 2.5, -3); scene.add(rim); const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); fill.position.set(-2.5, 1.5, 3); scene.add(fill);
// suelo de baldosas y pared con zócalo, como la sala del juego
const tileC = document.createElement('canvas'); tileC.width = tileC.height = 256; { const x = tileC.getContext('2d'); x.fillStyle = '#c2c4c6'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#a6a9ac'; x.lineWidth = 4; for (let i = 0; i <= 256; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); } }
const tt = new THREE.CanvasTexture(tileC); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(4, 4); tt.colorSpace = THREE.SRGBColorSpace;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 0.12), new THREE.MeshStandardMaterial({ color: '#cfd2d6', roughness: 0.8 })); wall.position.set(0, 1.2, -1.2); wall.receiveShadow = true; scene.add(wall);
const dado = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.14), new THREE.MeshStandardMaterial({ color: '#3e4146', roughness: 0.7 })); dado.position.set(0, 0.4, -1.19); scene.add(dado);
const strip = new THREE.Mesh(new THREE.BoxGeometry(4, 0.04, 0.145), new THREE.MeshStandardMaterial({ color: '#c94a43', roughness: 0.5 })); strip.position.set(0, 0.81, -1.19); scene.add(strip);
const camera = new THREE.PerspectiveCamera(30, W / Hh, 0.05, 50);
const chars = []; const T0 = performance.now();
function place(def, x, z, ry, mode) { const c = buildCharacter(def); c.root.position.set(x, 0, z); c.root.rotation.y = ry; scene.add(c.root); c.mode = mode; chars.push(c); return c; }
window.__build = () => {
  const a = place(scientist(), -0.45, 0, 0.35, 'idle'); const b = place(guard(), 0.45, 0, -0.3, 'idle');
  window.__stats = { buildMs: Math.round(performance.now() - T0), parts: [...a.stats, ...b.stats].map(([id, s]) => id + ':' + s.tris + 't/' + Math.round(s.ms) + 'ms'), tris: [...a.stats, ...b.stats].reduce((n, [, s]) => n + s.tris, 0) };
};
window.__shot = (view, t = 1.3, modes) => {
  if (modes) chars.forEach((c, i) => (c.mode = modes[i]));
  chars.forEach((c, i) => animate(c, t, c.mode, i * 1.7));
  if (view === 'close') { camera.position.set(0, 1.62, 2.1); camera.lookAt(0, 1.2, 0); camera.fov = 30; }
  else if (view === 'face') { camera.position.set(-0.32, 1.66, 0.75); camera.lookAt(-0.42, 1.63, 0); camera.fov = 22; }
  else if (view === 'face2') { camera.position.set(0.32, 1.66, 0.75); camera.lookAt(0.43, 1.63, 0); camera.fov = 22; }
  else { const d = 9; camera.position.set(d * 0.55, d * 0.62, d * 0.56); camera.lookAt(0, 0.8, 0); camera.fov = 18; } // cámara isométrica habitual del juego
  camera.updateProjectionMatrix(); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');
};
// ───────── Visor interactivo (al abrir el archivo) ─────────
window.addEventListener('load', () => {
  if (window.__NOAUTO) return;
  const ui = document.createElement('div'); ui.style.cssText = 'position:fixed;left:12px;top:12px;display:flex;gap:6px;flex-wrap:wrap;font:13px system-ui;color:#e8ecef;z-index:2';
  const msg = document.createElement('div'); msg.textContent = 'Esculpiendo personajes…'; msg.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font:16px system-ui;color:#e8ecef'; document.body.append(ui, msg);
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight;
  setTimeout(() => {
    window.__build(); msg.remove();
    let yaw = 0.6, pitch = 0.5, dist = 3.2, target = new THREE.Vector3(0, 1.0, 0), mode = 'idle';
    const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'background:#23272d;color:#e8ecef;border:1px solid #3a3f47;border-radius:6px;padding:6px 10px;cursor:pointer'; b.onclick = fn; ui.append(b); };
    btn('Cuerpo entero', () => { dist = 3.2; target.set(0, 1.0, 0); pitch = 0.3; }); btn('Caras', () => { dist = 1.1; target.set(0, 1.62, 0); pitch = 0.1; }); btn('Cámara del juego', () => { dist = 9; target.set(0, 0.8, 0); pitch = 0.68; yaw = 0.78; });
    btn('Reposo', () => (mode = 'idle')); btn('Andar', () => (mode = 'walk')); btn('Susto', () => (mode = 'fear'));
    let drag = null; renderer.domElement.addEventListener('pointerdown', (e) => (drag = [e.clientX, e.clientY])); addEventListener('pointerup', () => (drag = null));
    addEventListener('pointermove', (e) => { if (!drag) return; yaw -= (e.clientX - drag[0]) * 0.006; pitch = clamp(pitch + (e.clientY - drag[1]) * 0.004, -0.2, 1.3); drag = [e.clientX, e.clientY]; });
    addEventListener('wheel', (e) => { dist = clamp(dist * (e.deltaY > 0 ? 1.1 : 0.9), 0.5, 14); });
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    const loop = () => { const t = performance.now() / 1000; chars.forEach((c, i) => animate(c, t, mode, i * 1.7)); camera.fov = 30; camera.position.set(target.x + dist * Math.cos(pitch) * Math.sin(yaw), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(pitch) * Math.cos(yaw)); camera.lookAt(target); camera.updateProjectionMatrix(); renderer.render(scene, camera); requestAnimationFrame(loop); };
    loop();
  }, 50);
});
