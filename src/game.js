const THREE = window.THREE;   // three.js r160 (UMD) is loaded by a plain <script> before this module
const S = window.Sim;
const $ = s => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem('pw.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem('pw.' + k, JSON.stringify(v)); } catch {} } };

// ============================================================ state
let spec = store.get('spec', { ...S.PRESETS['Air65 Racing'] });
let tune = Object.assign(S.defaultTune(), store.get('tune', {}));
const world = S.buildPlayground();
let params = S.buildDrone(spec);
const drone = new S.Drone(params, tune, world);
const detector = new S.TrickDetector(world);
let score = new S.ScoreKeeper();
let mode = 'menu';           // menu | fly | paused
let session = null;          // {timeLeft} for 2-minute runs
let camMode = 'fpv';

// ============================================================ renderer / scene
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc7ae8c, 28, 110);
const fpvCam = new THREE.PerspectiveCamera(90, 1, 0.004, 400);
const chaseCam = new THREE.PerspectiveCamera(70, 1, 0.01, 400);

// ============================================================ procedural textures
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function speckle(g, w, h, n, cols, smin = 1, smax = 3, a = 0.25) {
  for (let i = 0; i < n; i++) { g.globalAlpha = a * rnd(); g.fillStyle = cols[(rnd() * cols.length) | 0]; const s = smin + rnd() * (smax - smin); g.fillRect(rnd() * w, rnd() * h, s, s); }
  g.globalAlpha = 1;
}
function stains(g, w, h, n, col, rmin, rmax, a = 0.18) {
  for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = rmin + rnd() * (rmax - rmin); const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col.replace('A', a * (0.4 + rnd() * 0.6))); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
}
function cracks(g, w, h, n, col = 'rgba(15,12,10,0.55)') {
  g.strokeStyle = col; g.lineCap = 'round';
  for (let i = 0; i < n; i++) { let x = rnd() * w, y = rnd() * h, a = rnd() * 6.28; g.lineWidth = 0.6 + rnd() * 1.6; g.beginPath(); g.moveTo(x, y);
    const L = 8 + rnd() * 30; for (let k = 0; k < L; k++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y); if (rnd() < 0.06) { g.stroke(); g.beginPath(); g.moveTo(x, y); a += 1.2; } } g.stroke(); }
}
function drips(g, w, y0, n, col) { g.strokeStyle = col; for (let i = 0; i < n; i++) { const x = rnd() * w, L = 10 + rnd() * 80; g.lineWidth = 1 + rnd() * 3; g.globalAlpha = 0.15 + rnd() * 0.25; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (rnd() - 0.5) * 3, y0 + L); g.stroke(); } g.globalAlpha = 1; }
function tex(c, rep = 1, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(rep, rep); return t; }
const TX = {};
function makeTextures() {
  let c, g;
  // asphalt
  [c, g] = cnv(512, 512); g.fillStyle = '#4a4744'; g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 512, 26000, ['#2b2a28', '#6b6660', '#57524c', '#3a3835', '#7d776f'], 1, 3, 0.5);
  stains(g, 512, 512, 14, 'rgba(10,8,6,A)', 20, 90, 0.35); stains(g, 512, 512, 6, 'rgba(120,110,95,A)', 30, 90, 0.15); cracks(g, 512, 512, 7);
  TX.asphalt = tex(c);
  // concrete
  [c, g] = cnv(512, 512); g.fillStyle = '#9b958b'; g.fillRect(0, 0, 512, 512);
  speckle(g, 512, 512, 18000, ['#7f7a72', '#b3ada3', '#8c867d', '#6d685f'], 1, 2.5, 0.35);
  stains(g, 512, 512, 18, 'rgba(40,35,28,A)', 20, 110, 0.25); drips(g, 512, 0, 60, '#3b352c'); cracks(g, 512, 512, 4, 'rgba(40,36,30,0.5)');
  g.strokeStyle = 'rgba(50,46,40,0.45)'; g.lineWidth = 2; for (let x = 0; x <= 512; x += 256) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  TX.concrete = tex(c);
  // brick
  [c, g] = cnv(512, 512); g.fillStyle = '#5b5148'; g.fillRect(0, 0, 512, 512);
  const bw = 64, bh = 24;
  for (let y = 0; y < 512; y += bh) for (let x = -bw; x < 512; x += bw) {
    const ox = ((y / bh) % 2) * bw / 2; const r = 120 + rnd() * 50, gg = 52 + rnd() * 25, b = 38 + rnd() * 20;
    g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(x + ox + 2, y + 2, bw - 4, bh - 4);
  }
  speckle(g, 512, 512, 14000, ['#2a1d16', '#a76a4f', '#5c3b2c'], 1, 2, 0.35); stains(g, 512, 512, 20, 'rgba(15,10,6,A)', 20, 120, 0.3); drips(g, 512, 0, 40, '#2a1f18');
  TX.brick = tex(c);
  // rubber playground mat
  [c, g] = cnv(256, 256); g.fillStyle = '#8a3a2e'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 12000, ['#5d241c', '#a85042', '#3b2a22', '#c06b4d'], 1, 2, 0.6); stains(g, 256, 256, 6, 'rgba(20,10,5,A)', 20, 60, 0.3); TX.rubberMat = tex(c);
  [c, g] = cnv(256, 256); g.fillStyle = '#b79e76'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 14000, ['#8c7656', '#d4bf98', '#6e5c44'], 1, 2, 0.6); TX.sand = tex(c);
  // court (asphalt w/ faded green + lines)
  [c, g] = cnv(512, 512); g.drawImage(TX.asphalt.image, 0, 0); g.fillStyle = 'rgba(52,84,66,0.55)'; g.fillRect(0, 0, 512, 512); speckle(g, 512, 512, 6000, ['#2c2b29', '#7d776f'], 1, 3, 0.5);
  g.strokeStyle = 'rgba(225,215,190,0.55)'; g.lineWidth = 7; g.strokeRect(20, 20, 472, 472); g.beginPath(); g.arc(256, 20, 150, 0, Math.PI); g.stroke(); g.strokeRect(186, 20, 140, 180); cracks(g, 512, 512, 5);
  TX.court = tex(c, 1);
  // painted metal (base color + chips + rust)
  const paint = (hex) => { const [c2, g2] = cnv(256, 256); g2.fillStyle = hex; g2.fillRect(0, 0, 256, 256); speckle(g2, 256, 256, 3000, ['#ffffff', '#000000'], 1, 2, 0.12);
    for (let i = 0; i < 60; i++) { g2.fillStyle = ['#6b3a1c', '#8a4b22', '#3d2617', '#b3a89a'][(rnd() * 4) | 0]; g2.globalAlpha = 0.5 + rnd() * 0.5; g2.beginPath(); g2.ellipse(rnd() * 256, rnd() * 256, 1 + rnd() * 7, 1 + rnd() * 4, rnd() * 3, 0, 7); g2.fill(); }
    g2.globalAlpha = 1; stains(g2, 256, 256, 8, 'rgba(70,35,15,A)', 10, 50, 0.35); return tex(c2); };
  TX.paintRed = paint('#a8322a'); TX.paintBlue = paint('#2e5f9a'); TX.paintGreen = paint('#3f7a3a'); TX.paintOrange = paint('#c9662a'); TX.plasticYellow = paint('#d8a92a');
  TX.rust = paint('#6e3b1f'); TX.dumpster = paint('#2f5b3a'); TX.bin = paint('#3a3f44');
  [c, g] = cnv(256, 256); g.fillStyle = '#8d9296'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 5000, ['#c9ced2', '#5e6367', '#a0a4a6'], 1, 3, 0.3); stains(g, 256, 256, 10, 'rgba(60,50,40,A)', 10, 50, 0.3); TX.galv = tex(c);
  [c, g] = cnv(256, 256); g.fillStyle = '#b8bcc0'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 3) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.15})`; g.fillRect(0, y, 256, 1); } stains(g, 256, 256, 10, 'rgba(50,40,30,A)', 10, 60, 0.3); TX.metalSlide = tex(c);
  [c, g] = cnv(256, 256); g.fillStyle = '#6a6e70'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 2; for (let i = -256; i < 512; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); } stains(g, 256, 256, 8, 'rgba(70,35,15,A)', 10, 50, 0.4); TX.metalPlate = tex(c);
  [c, g] = cnv(256, 256); g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 32) { g.fillStyle = `rgb(${110 + rnd() * 30 | 0},${80 + rnd() * 20 | 0},${50 + rnd() * 15 | 0})`; g.fillRect(0, y + 2, 256, 28); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(40,25,15,0.3)'; g.fillRect(rnd() * 256, y + 2 + rnd() * 28, 20 + rnd() * 60, 1); } } stains(g, 256, 256, 8, 'rgba(20,15,10,A)', 10, 60, 0.4); TX.wood = tex(c);
  // chain link
  [c, g] = cnv(128, 128); g.clearRect(0, 0, 128, 128); g.strokeStyle = 'rgba(160,165,168,0.95)'; g.lineWidth = 2.2; for (let i = -128; i < 256; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); } TX.chainlink = tex(c);
  [c, g] = cnv(128, 128); g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(20,15,10,0.5)'; g.fillRect(rnd() * 128, 0, 2 + rnd() * 3, 128); } TX.bark = tex(c);
  [c, g] = cnv(256, 256); g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, 256, 256); stains(g, 256, 256, 20, 'rgba(60,50,40,A)', 10, 60, 0.35); g.strokeStyle = '#c4462c'; g.lineWidth = 8; g.strokeRect(78, 120, 100, 80); g.strokeRect(8, 8, 240, 240); TX.backboard = tex(c, 1);
}

// ---- graffiti
const GRAF_WORDS = ['WHOOP', 'PROPWASH', '1S LIFE', 'SEND IT', 'BRAAP', 'TURTLE', 'DSHOT', '65MM', 'AIRMODE', 'POWERLOOP', 'GYRO', 'NO FLY ZONE', 'MATTY', 'BUMP', 'RIP BATT', 'ARMED'];
const GRAF_PAL = [['#f2c230', '#e0472e', '#111'], ['#59d3e8', '#2a5bd7', '#0b0b0b'], ['#9be35a', '#1e8a52', '#101010'], ['#ff7ac8', '#8a2be2', '#120812'], ['#ffffff', '#e2312b', '#000'], ['#ffd27a', '#ff6a00', '#1a0f05'], ['#c9f', '#5b2ad1', '#0a0614']];
function bubble(g, word, x, y, size, pal, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.font = `${size}px "Sedgwick Ave Display", "Permanent Marker", Impact, sans-serif`; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.textAlign = 'center';
  g.fillStyle = pal[2]; for (let i = 1; i <= size / 10; i++) g.fillText(word, i, i);                    // 3D drop
  g.strokeStyle = pal[2]; g.lineWidth = size * 0.22; g.strokeText(word, 0, 0);
  g.strokeStyle = '#fff'; g.lineWidth = size * 0.12; g.strokeText(word, 0, 0);
  const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); g.fillStyle = gr; g.fillText(word, 0, 0);
  g.globalAlpha = 0.7; g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse((rnd() - 0.5) * size * word.length * 0.45, -size * 0.18, size * 0.04, size * 0.09, 0.4, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.strokeStyle = pal[1]; const w = g.measureText(word).width;
  for (let i = 0; i < word.length * 1.5; i++) { const dx = (rnd() - 0.5) * w, L = size * (0.2 + rnd() * 0.8); g.lineWidth = 2 + rnd() * size * 0.04; g.beginPath(); g.moveTo(dx, size * 0.3); g.lineTo(dx, size * 0.3 + L); g.stroke(); g.beginPath(); g.arc(dx, size * 0.3 + L, g.lineWidth * 0.8, 0, 7); g.fillStyle = pal[1]; g.fill(); }
  g.restore();
}
function tag(g, x, y, size, col) { g.save(); g.translate(x, y); g.rotate((rnd() - 0.5) * 0.5); g.font = `${size}px "Permanent Marker", cursive`; g.fillStyle = col; g.globalAlpha = 0.85;
  const w = ['krz', 'TPW', 'whp!', 'Ø65', 'acro', 'yaw', 'zap', 'fpv', 'nrv', 'sk8'][(rnd() * 10) | 0]; g.fillText(w, 0, 0); g.lineWidth = 2; g.strokeStyle = col; g.beginPath(); g.moveTo(0, size * 0.25); g.quadraticCurveTo(size, size * 0.6, size * 2, size * 0.1); g.stroke(); g.restore(); }
function stencil(g, x, y, size, text) { g.save(); g.font = `bold ${size}px "Bungee", Impact`; g.fillStyle = 'rgba(20,20,20,0.82)'; g.fillText(text, x, y); g.restore(); }
function graffitiTexture(wM, hM, density = 1, opts = {}) {
  const ppm = opts.ppm || 64; const W = Math.min(4096, Math.round(wM * ppm)), H = Math.min(2048, Math.round(hM * ppm));
  const [c, g] = cnv(W, H);
  const n = Math.max(1, Math.round(wM / 6 * density));
  const sx = W / wM, sy = H / hM;
  for (let i = 0; i < n; i++) {
    const word = GRAF_WORDS[(rnd() * GRAF_WORDS.length) | 0], pal = GRAF_PAL[(rnd() * GRAF_PAL.length) | 0];
    const size = (0.6 + rnd() * 0.9) * sy * (opts.big || 1);
    const yM = opts.top ? hM * 0.5 : Math.min(hM - 0.8, 0.9 + rnd() * 1.6);
    bubble(g, word, (i + 0.5 + (rnd() - 0.5) * 0.6) * W / n, H - yM * sy, size, pal, (rnd() - 0.5) * 0.15);
  }
  for (let i = 0; i < n * 5; i++) tag(g, rnd() * W, H - (0.3 + rnd() * 2.2) * sy, (0.15 + rnd() * 0.25) * sy, ['#111', '#e8e8e8', '#d23', '#2ad', '#fd3'][(rnd() * 5) | 0]);
  if (opts.stencil) stencil(g, W * 0.1, H - 2.4 * sy, 0.45 * sy, opts.stencil);
  if (opts.heaven) bubble(g, 'OPEN PRO WHOOPER', W * 0.5, H * 0.18, H * 0.14, ['#ffe14a', '#ff3d2e', '#111'], -0.03);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ============================================================ materials & geometry helpers
const MAT = {};
function mats() {
  const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0.0, ...o });
  MAT.asphalt = std(TX.asphalt); MAT.concrete = std(TX.concrete); MAT.brick = std(TX.brick); MAT.rubberMat = std(TX.rubberMat); MAT.sand = std(TX.sand); MAT.court = std(TX.court);
  for (const k of ['paintRed', 'paintBlue', 'paintGreen', 'paintOrange', 'plasticYellow', 'rust', 'dumpster', 'bin']) MAT[k] = std(TX[k], { roughness: 0.6, metalness: 0.25 });
  MAT.galv = std(TX.galv, { roughness: 0.45, metalness: 0.6 }); MAT.metalSlide = std(TX.metalSlide, { roughness: 0.3, metalness: 0.8 }); MAT.metalPlate = std(TX.metalPlate, { roughness: 0.6, metalness: 0.5 });
  MAT.metal = MAT.galv; MAT.chain = new THREE.MeshStandardMaterial({ color: 0x8b8f92, metalness: 0.8, roughness: 0.4 });
  MAT.wood = std(TX.wood); MAT.chainlink = new THREE.MeshStandardMaterial({ map: TX.chainlink, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
  MAT.rubberBlack = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 }); MAT.tire = MAT.rubberBlack;
  MAT.cone = new THREE.MeshStandardMaterial({ color: 0xe8541c, roughness: 0.6 }); MAT.bark = std(TX.bark);
  MAT.leaves = new THREE.MeshStandardMaterial({ color: 0x4f6b2f, roughness: 0.9, flatShading: true });
  MAT.lampHead = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffd9a0, emissiveIntensity: 0.6 });
  MAT.hoodie = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.9 }); MAT.jeans = new THREE.MeshStandardMaterial({ color: 0x34476b, roughness: 0.9 });
  MAT.skin = new THREE.MeshStandardMaterial({ color: 0xc89272, roughness: 0.7 }); MAT.radio = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 });
  MAT.goggles = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.4, emissive: 0x220000 });
  MAT.backboard = std(TX.backboard); MAT.rimOrange = new THREE.MeshStandardMaterial({ color: 0xd2521f, metalness: 0.5, roughness: 0.4 });
}
function boxGeo(h, density = 0.5) {
  const g = new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v; if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); } else if (ny > 0.5) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u * density, v * density);
  }
  return g;
}
function pipeMesh(a, b, r, mat, cone) {
  const A = new THREE.Vector3(a.x, a.y, a.z), B = new THREE.Vector3(b.x, b.y, b.z), L = A.distanceTo(B);
  const seg = r < 0.02 ? 6 : r > 0.12 ? 16 : 10;
  const g = cone ? new THREE.ConeGeometry(r, L, 12) : new THREE.CylinderGeometry(r, r, L, seg, 1, false);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, r * 20), uv.getY(i) * L * 1.5);
  const m = new THREE.Mesh(g, mat); m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}

// ============================================================ build world meshes
function buildScene() {
  // sky
  const [sc, sg] = cnv(16, 512); const gr = sg.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#5f86b3'); gr.addColorStop(0.45, '#a9b9c7'); gr.addColorStop(0.62, '#e7c49a'); gr.addColorStop(0.75, '#d99a6c'); gr.addColorStop(1, '#6e5a4a');
  sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512); const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(sky);
  // lights
  scene.add(new THREE.HemisphereLight(0xa9c0e0, 0x5a4532, 0.9));
  const sun = new THREE.DirectionalLight(0xffcf98, 2.6); sun.position.set(-30, 22, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sh = sun.shadow.camera; sh.left = -32; sh.right = 32; sh.top = 32; sh.bottom = -32; sh.near = 1; sh.far = 120; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  // ground
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), MAT.asphalt); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
  TX.asphalt.repeat.set(1, 1); const guv = gnd.geometry.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 60, guv.getY(i) * 60);
  scene.add(gnd);
  for (const z of world.zones) {
    const g = new THREE.PlaneGeometry(z.h.x * 2, z.h.z * 2); const uv = g.attributes.uv; const d = z.mat === 'court' ? 1 : 0.5;
    if (z.mat !== 'court') for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * z.h.x * 2 * d, uv.getY(i) * z.h.z * 2 * d);
    const m = new THREE.Mesh(g, MAT[z.mat]); m.rotation.x = -Math.PI / 2; m.position.set(z.c.x, z.c.y, z.c.z); m.receiveShadow = true; scene.add(m);
  }
  // objects
  for (const o of world.objs) for (const v of o.vis) {
    let m;
    if (v.shape === 'box') {
      m = new THREE.Mesh(boxGeo(v.h, v.mat === 'brick' ? 0.35 : v.mat === 'concrete' ? 0.3 : 1), MAT[v.mat] || MAT.concrete);
      m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ');
      if (v.graffiti) addGraffiti(v);
    } else if (v.shape === 'pipe') m = pipeMesh(v.a, v.b, v.r, MAT[v.mat] || MAT.galv, v.cone);
    else if (v.shape === 'sphere') { m = new THREE.Mesh(new THREE.IcosahedronGeometry(v.r, 1), MAT[v.mat]); m.position.set(v.c.x, v.c.y, v.c.z); }
    if (!m) continue;
    m.castShadow = v.mat !== 'chainlink'; m.receiveShadow = true; scene.add(m);
  }
  // lamp lights
  for (const o of world.objs) if (o.light) { const l = new THREE.PointLight(0xffc98a, 6, 12, 2); l.position.set(o.light.x, o.light.y - 0.3, o.light.z); scene.add(l); }
  // skyline beyond the fence (no collision)
  const sk = new THREE.MeshStandardMaterial({ color: 0x4d4a52, roughness: 1, map: TX.concrete });
  for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2, R = 55 + rnd() * 35, w = 6 + rnd() * 14, h = 8 + rnd() * 30;
    const x = Math.cos(ang) * R, z = Math.sin(ang) * R; if (z < -20 && Math.abs(x) < 18) continue;
    const m = new THREE.Mesh(boxGeo(new THREE.Vector3(w / 2, h / 2, w / 2), 0.08), sk); m.position.set(x, h / 2, z); scene.add(m);
  }
  // power lines
  const pl = new THREE.MeshStandardMaterial({ color: 0x3a2e24 });
  for (const x of [-30, 0, 30]) scene.add(pipeMesh({ x, y: 0, z: 30 }, { x, y: 9, z: 30 }, 0.12, pl));
  const wire = new THREE.LineBasicMaterial({ color: 0x111111 });
  for (const dy of [8.6, 8.2]) { const pts = []; for (let x = -30; x <= 30; x += 2) pts.push(new THREE.Vector3(x, dy - 0.6 * Math.cos(((x + 30) % 30) / 30 * Math.PI * 2 - Math.PI) * 0.5 - 0.3, 30)); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); }
}
function addGraffiti(v) {
  const h = v.h; let w, hh, pos, rotY = 0, rotX = 0, opts = {};
  const e = 0.012;
  if (v.graffiti === 'south') { w = h.x * 2; hh = h.y * 2; pos = new THREE.Vector3(v.c.x, v.c.y, v.c.z + h.z + e); }
  else if (v.graffiti === 'east') { w = h.z * 2; hh = h.y * 2; pos = new THREE.Vector3(v.c.x + h.x + e, v.c.y, v.c.z); rotY = Math.PI / 2; }
  else if (v.graffiti === 'top') { w = h.x * 2; hh = h.z * 2; pos = new THREE.Vector3(v.c.x, v.c.y + h.y + e, v.c.z); rotX = -Math.PI / 2; opts = { top: true, big: 0.4 }; }
  if (hh > 10) opts = { heaven: true, stencil: 'NO WHOOPS', ppm: 48 };
  if (w < 3) opts.big = (opts.big || 1) * 0.5;
  const t = graffitiTexture(w, hh, hh > 10 ? 1.4 : 1, opts);
  const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat); m.position.copy(pos);
  const grp = new THREE.Group(); grp.position.copy(pos); m.position.set(0, 0, 0);
  if (v.graffiti === 'top') { m.rotation.x = -Math.PI / 2; grp.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ'); }
  else m.rotation.y = rotY;
  grp.add(m); m.receiveShadow = true; scene.add(grp);
}

// ============================================================ drone model
let droneMesh, propGroups = [], propDiscs = [];
function buildDroneMesh() {
  if (droneMesh) scene.remove(droneMesh);
  const p = params, g = new THREE.Group(); propGroups = []; propDiscs = [];
  const frameMat = new THREE.MeshStandardMaterial({ color: spec.frame.includes('champ') ? 0x1d1d1f : 0x15151a, roughness: 0.5, metalness: 0.1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.35, emissive: 0x220800 });
  const propMat = new THREE.MeshStandardMaterial({ color: spec.prop === 'hq31ul' ? 0x9ad7ff : 0xe0f040, transparent: true, opacity: 0.9, roughness: 0.4 });
  for (const m of p.motors) {
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(p.rDuct, p.rDuct * 0.96, 0.013, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5, side: THREE.DoubleSide }));
    duct.position.set(m.pos.x, 0.003, m.pos.z); g.add(duct);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.rDuct, 0.0012, 6, 24), frameMat); ring.rotation.x = Math.PI / 2; ring.position.set(m.pos.x, 0.0095, m.pos.z); g.add(ring);
    const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0x9b6d3a, metalness: 0.8, roughness: 0.3 })); mot.position.set(m.pos.x, 0.0035, m.pos.z); g.add(mot);
    const pg = new THREE.Group(); pg.position.set(m.pos.x, 0.0075, m.pos.z);
    const blades = PARTS().props[spec.prop].blades;
    for (let b = 0; b < blades; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(p.D / 2 * 0.95, 0.0008, 0.0055), propMat); bl.position.x = p.D / 4; const h = new THREE.Group(); h.rotation.y = b / blades * Math.PI * 2; bl.rotation.x = 0.35 * m.spin; h.add(bl); pg.add(h); }
    g.add(pg); propGroups.push(pg);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.D / 2, 24), new THREE.MeshBasicMaterial({ color: propMat.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(m.pos.x, 0.0077, m.pos.z); g.add(disc); propDiscs.push(disc);
    // arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, Math.hypot(m.pos.x, m.pos.z) * 2), frameMat); arm.position.set(m.pos.x / 2, 0.001, m.pos.z / 2); arm.rotation.y = Math.atan2(m.pos.x, m.pos.z); g.add(arm);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.03), frameMat); g.add(plate);
  const aio = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.026), new THREE.MeshStandardMaterial({ color: 0x0d3b22, roughness: 0.6 })); aio.position.y = 0.004; g.add(aio);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), canopyMat); canopy.scale.set(0.9, 0.85, 1.1); canopy.position.y = 0.006; g.add(canopy);
  const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.005, 12), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.2 }));
  cam.rotation.x = Math.PI / 2 - tune.camTilt * Math.PI / 180; cam.position.set(0, 0.012, -0.012); g.add(cam);
  const bat = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.011, 0.045), new THREE.MeshStandardMaterial({ color: 0x2b6ad6, roughness: 0.5 })); bat.position.set(0, -0.009, 0.002); g.add(bat);
  const ant = pipeMesh({ x: 0, y: 0.008, z: 0.012 }, { x: 0, y: 0.014, z: 0.04 }, 0.0006, new THREE.MeshBasicMaterial({ color: 0x111111 })); g.add(ant);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  droneMesh = g; scene.add(g);
}
const PARTS = () => S.PARTS;

// ============================================================ input
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; onKey(e); });
addEventListener('keyup', e => { keys[e.code] = false; });
// Separate profiles: keyboard, radio (EdgeTX/OpenTX/etc. in USB joystick mode), gamepad (Xbox/PS/etc.)
const AX4 = ['thr', 'yaw', 'pitch', 'roll'];
const defAxes = (thr, yaw, pitch, roll, invP, invT) => ({ thr: { i: thr, inv: !!invT, min: -1, max: 1 }, yaw: { i: yaw, inv: false, min: -1, max: 1 }, pitch: { i: pitch, inv: !!invP, min: -1, max: 1 }, roll: { i: roll, inv: false, min: -1, max: 1 } });
const DEFAULT_INPUT = {
  mode: 'keyboard',
  radio:   { device: null, axes: defAxes(2, 3, 1, 0, false, false), arm: { type: 'axis', i: 4, th: 0.5 }, reset: { type: 'axis', i: 5, th: 0.5 }, deadband: 0.005 },
  gamepad: { device: null, axes: defAxes(1, 0, 3, 2, true, true), arm: { type: 'button', i: 0, toggle: true }, reset: { type: 'button', i: 3 }, deadband: 0.06, thrCentered: false },
};
function loadInput() {
  const s = store.get('input', null); const d = JSON.parse(JSON.stringify(DEFAULT_INPUT));
  if (!s) return d;
  if (s.axes && !s.radio) { d.radio.axes = s.axes; if (d.radio.axes.pitch) d.radio.axes.pitch.inv = false; d.radio.arm = s.arm || d.radio.arm; d.radio.reset = s.reset || d.radio.reset; d.mode = s.mode === 'gamepad' ? 'radio' : 'keyboard'; return d; } // migrate v0.1
  return { ...d, ...s, radio: { ...d.radio, ...(s.radio || {}) }, gamepad: { ...d.gamepad, ...(s.gamepad || {}) } };
}
let inputCfg = loadInput();
const saveInput = () => store.set('input', inputCfg);
const prof = () => inputCfg[inputCfg.mode] || null;

// ---- device identification
const USB_VENDORS = {
  '1209': 'pid.codes (EdgeTX / OpenTX)', '0483': 'STMicro (OpenTX / FrSky / Jumper)', '1781': 'FrSky', '2b90': 'RadioMaster',
  '045e': 'Microsoft (Xbox)', '054c': 'Sony (PlayStation)', '057e': 'Nintendo', '28de': 'Valve (Steam)', '046d': 'Logitech', '2dc8': '8BitDo', '0f0d': 'Hori',
};
const USB_PRODUCTS = { '1209:4f54': 'EdgeTX / OpenTX USB joystick', '0483:5710': 'OpenTX USB joystick' };
const RADIO_HINT = /edgetx|opentx|radio|joystick|taranis|frsky|jumper|radiomaster|boxer|zorro|pocket|tx1[26]|tx15|t-?lite|t-?pro|t20|t14|t8sg|betafpv|literadio|helloradiosky|v1[0-9]\b|flysky|elrs|crossfire|tango|mambo|x9d|x9 lite|x-lite|qx7|commando|spektrum|dx\d/i;
const PAD_HINT = /xbox|xinput|dualshock|dualsense|wireless controller|playstation|switch pro|joy-con|8bitdo|gamepad|controller|steam/i;
function describePad(p) {
  if (!p) return null;
  let name = p.id, vendor = null, product = null;
  let m = p.id.match(/^(.*?)\s*\(\s*(?:STANDARD GAMEPAD\s*)?Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})\s*\)\s*$/i); // Chrome/Edge
  if (m) { name = m[1]; vendor = m[2].toLowerCase(); product = m[3].toLowerCase(); }
  else if ((m = p.id.match(/^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.*)$/i))) { vendor = m[1].padStart(4, '0').toLowerCase(); product = m[2].padStart(4, '0').toLowerCase(); name = m[3]; } // Firefox
  name = name.replace(/\b(USB\s*)?Joystick\b/i, '').replace(/\s{2,}/g, ' ').trim() || p.id;
  const key = vendor && product ? `${vendor}:${product}` : null;
  const isRadio = (key && USB_PRODUCTS[key]) || vendor === '1209' || vendor === '0483' || vendor === '1781' || vendor === '2b90' || (RADIO_HINT.test(p.id) && !PAD_HINT.test(p.id) && p.mapping !== 'standard');
  const kind = isRadio ? 'radio' : (p.mapping === 'standard' || PAD_HINT.test(p.id)) ? 'gamepad' : 'radio';
  return { name, vendor, product, firmware: key ? (USB_PRODUCTS[key] || USB_VENDORS[vendor] || 'unknown vendor') : null, kind, axes: p.axes.length, buttons: p.buttons.length, id: p.id, index: p.index };
}
const allPads = () => (navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []);
function readPad(kind = inputCfg.mode) {
  const P = inputCfg[kind]; if (!P) return null; const pads = allPads();
  return pads.find(p => p.id === P.device) || pads.find(p => describePad(p).kind === kind) || null;
}
const kb = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
let armSwitchPrev = null, resetPrev = false, armBtnPrev = false, crashLock = false, armBlock = '';
const ARM_THR_MAX = 0.08;
function axisVal(pad, a) { if (!pad || pad.axes[a.i] === undefined) return 0; let v = pad.axes[a.i]; v = ((v - a.min) / ((a.max - a.min) || 1)) * 2 - 1; v = Math.max(-1, Math.min(1, v)); return a.inv ? -v : v; }
function switchOn(pad, s) { return s.type === 'axis' ? (pad.axes[s.i] ?? -1) > (s.th ?? 0.5) : !!(pad.buttons[s.i] && pad.buttons[s.i].pressed); }
function getRC(dt) {
  const P = prof(); const pad = P ? readPad() : null;
  if (P && pad) {
    const A = P.axes;
    let thr = axisVal(pad, A.thr);
    const rc = { thr: P.thrCentered ? Math.max(0, thr) : (thr + 1) / 2, yaw: axisVal(pad, A.yaw), pitch: axisVal(pad, A.pitch), roll: axisVal(pad, A.roll) };
    lastRC = rc;
    for (const k of ['yaw', 'pitch', 'roll']) if (Math.abs(rc[k]) < P.deadband) rc[k] = 0; else rc[k] = Math.sign(rc[k]) * (Math.abs(rc[k]) - P.deadband) / (1 - P.deadband);
    if (P.arm.toggle) { const b = switchOn(pad, P.arm); if (b && !armBtnPrev) setArmed(!drone.armed); armBtnPrev = b; }
    else {
      // Switch arming: armed while the switch is on and throttle was low when it armed.
      // After a crash the switch has to go off once (like Betaflight's crash flip / re-arm).
      const sw = switchOn(pad, P.arm); armSwitchPrev = sw;
      if (!sw) { crashLock = false; if (drone.armed) setArmed(false); armBlock = 'ARM SWITCH OFF'; }
      else if (!drone.armed) {
        if (crashLock) armBlock = 'CRASHED · FLIP ARM SWITCH OFF, THEN ON';
        else if (rc.thr > ARM_THR_MAX) armBlock = `THROTTLE HIGH (${Math.round(rc.thr * 100)}%) · LOWER TO ARM`;
        else { armBlock = ''; setArmed(true); }
      } else armBlock = '';
    }
    const rp = switchOn(pad, P.reset); if (rp && !resetPrev) respawn(); resetPrev = rp;
    return rc;
  }
  const ramp = (cur, tgt, rate) => cur + Math.max(-rate * dt, Math.min(rate * dt, tgt - cur));
  kb.yaw = ramp(kb.yaw, (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), 6);
  kb.pitch = ramp(kb.pitch, (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0), 6);
  kb.roll = ramp(kb.roll, (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), 6);
  if (keys.KeyW) kb.thr = Math.min(1, kb.thr + dt * 0.9); if (keys.KeyS) kb.thr = Math.max(0, kb.thr - dt * 1.4);
  if (keys.ShiftLeft || keys.ShiftRight) kb.thr = Math.min(1, kb.thr + dt * 2.5);
  if (keys.KeyX) kb.thr = 0;
  return { thr: kb.thr, yaw: kb.yaw, pitch: kb.pitch, roll: kb.roll };
}
function radioLabel() { const d = describePad(readPad('radio')); return d ? d.name : null; }
function onKey(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  if (e.code === 'Escape') { if (mode === 'fly') pause(); else if (mode === 'paused') resume(); }
  if (mode !== 'fly') return;
  if (e.code === 'Space') { e.preventDefault(); setArmed(!drone.armed); }
  if (e.code === 'KeyR') respawn();
  if (e.code === 'KeyT') flipOver();
  if (e.code === 'KeyC') camMode = camMode === 'fpv' ? 'chase' : 'fpv';
  if (e.code === 'Tab') { e.preventDefault(); $('#breakdown').classList.toggle('hide'); }
}
let lastRC = { thr: 0, roll: 0, pitch: 0, yaw: 0 };
function setArmed(on) {
  if (on) {
    if (lastRC.thr > ARM_THR_MAX) { flash(`<b>THROTTLE HIGH</b><small>${Math.round(lastRC.thr * 100)}% — lower it fully to arm</small>`, 'warn'); return; }
    if (drone.crashed) { flipOver(); }
    drone.crashed = false; drone.armed = true; detector.onArmChange(drone, true);
    if (session && !session.started) session.started = true;
  } else { drone.armed = false; detector.onArmChange(drone, false); }
}
function flipOver() { // "turtle mode" simplified: right the quad where it lies
  const f = drone.fwd(); const yaw = Math.atan2(-f.x, -f.z);
  drone.q = S.qaxis(S.v3(0, 1, 0), yaw); drone.w = S.v3(); drone.vel = S.v3(); drone.pos.y = Math.max(drone.pos.y, 0.03); drone.crashed = false; drone.fc.reset();
}
function respawn() { drone.reset(world.spawn, true); detector.reset(); crashLock = false; }

// ============================================================ audio
let actx = null, osc = [], gains = [], noiseG = null;
function initAudio() {
  if (actx) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const master = actx.createGain(); master.gain.value = store.get('vol', 0.35); master.connect(actx.destination); window._master = master;
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.connect(master);
  for (let i = 0; i < 4; i++) { const o = actx.createOscillator(); o.type = 'sawtooth'; const g = actx.createGain(); g.gain.value = 0; o.connect(g); g.connect(lp); o.start(); osc.push(o); gains.push(g); }
  const buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = actx.createBufferSource(); ns.buffer = buf; ns.loop = true; const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  noiseG = actx.createGain(); noiseG.gain.value = 0; ns.connect(bp); bp.connect(noiseG); noiseG.connect(master); ns.start();
}
function updateAudio() {
  if (!actx) return; const t = actx.currentTime; const blades = S.PARTS.props[spec.prop].blades;
  for (let i = 0; i < 4; i++) { const rpm = drone.motorW[i] * 60 / (2 * Math.PI); osc[i].frequency.setTargetAtTime(Math.max(30, rpm / 60 * blades * 0.5 + i * 3), t, 0.01); gains[i].gain.setTargetAtTime(drone.armed ? 0.02 + 0.06 * Math.min(1, rpm / params.stats.rpmMax) : 0, t, 0.02); }
  noiseG.gain.setTargetAtTime(Math.min(0.25, S.len(drone.vel) * 0.012 + drone.washLevel * 0.15), t, 0.05);
}

// ============================================================ HUD
const popups = $('#popups');
function flash(text, cls = '') { const el = document.createElement('div'); el.className = 'popup ' + cls; el.innerHTML = text; popups.prepend(el); setTimeout(() => el.classList.add('out'), 1900); setTimeout(() => el.remove(), 2600); while (popups.children.length > 3) popups.lastChild.remove(); }
// ---- combo (Tony Hawk style presentation; points follow the TPW calculator exactly)
// A combo runs while you keep doing tricks; it banks after COMBO_IDLE s with no trick or rotation; a crash bails it.
const COMBO_IDLE = 2.0;
const combo = { names: [], pts: 0, lastT: 0, active: false };
function comboAdd(r) { combo.names.push((r.laps ? `${r.name.replace(' x2', '')} ×${r.laps}` : r.name) + (r.exec !== 'CLEAN' ? ` (${r.exec.toLowerCase()})` : '')); combo.pts += r.net; combo.lastT = performance.now() / 1000; combo.active = true; renderCombo(); }
function comboEnd(bailed) {
  if (!combo.active) return;
  const el = $('#comboBank'); const n = combo.names.length;
  el.innerHTML = bailed ? `<b>BAILED</b><small>${n} trick${n > 1 ? 's' : ''} · ${combo.pts.toLocaleString()} pts kept · streak lost</small>` : `<b>+${combo.pts.toLocaleString()}</b><small>${n > 1 ? n + ' TRICK COMBO' : 'LANDED'}</small>`;
  el.className = bailed ? 'bail show' : 'show'; void el.offsetWidth;
  combo.names = []; combo.pts = 0; combo.active = false; renderCombo();
}
function renderCombo() {
  const el = $('#combo'); const prov = mode === 'fly' ? detector.provisional() : [], live = mode === 'fly' && detector.liveState ? detector.liveState() : [];
  if (!combo.active && !prov.length && !live.length) { el.classList.add('hide'); return; }
  el.classList.remove('hide');
  const liveTxt = l => l.laps !== undefined ? `<span class="live">${l.name.replace(' x2', '')} ×${l.laps}${l.counts ? ` <b>+${l.pts}</b>` : ''}</span>` : `<span class="live">${l.name} ${l.meters.toFixed(1)}m</span>`;
  const list = [...combo.names.map(n => `<span>${n}</span>`), ...prov.map(n => `<span class="prov">${n}…</span>`), ...live.map(liveTxt)];
  const livePts = live.reduce((a, l) => a + (l.counts ? l.pts : 0), 0);
  el.innerHTML = `<div class="cList">${list.slice(-7).join('<i>+</i>')}</div>${combo.active || livePts ? `<div class="cPts">${(combo.pts + livePts).toLocaleString()}<small> × streak ${score.streak.toFixed(2)}</small></div>` : ''}`;
}
function onTrick(ev) {
  trainOnEvent(ev);
  if (ev.name === 'near') { flash(`<b>SO CLOSE</b><small>${ev.near}</small>`, 'near'); return; }
  const r = score.add(ev);
  if (ev.exec === 'CRASH') { comboEnd(true); flash(`<b>CRASH!</b><small>streak lost</small>`, 'crash'); updateBreakdown(); return; }
  if (!r) return;
  comboAdd(r);
  const mults = []; if (r.totwM > 1) mults.push(`TotW ×${r.totwM}`); if (r.repeatM < 1) mults.push(`repeat ×${r.repeatM}`); if (r.b2bM < 1) mults.push(`b2b ×${r.b2bM}`); if (r.obsM < 1) mults.push(`same obstacle ×${r.obsM}`); if (r.streakM > 1.0001) mults.push(`streak ×${r.streakM.toFixed(2)}`);
  flash(`<b>${r.name.toUpperCase()}</b>${r.draft ? '<small class="draftTag">new rule</small>' : ''}<span class="ex ${r.exec}">${r.exec}${r.clean !== undefined ? ' ' + r.clean + '%' : ''}</span>${r.obstacle ? `<small>on ${r.obstacle}</small>` : ''}<em>+${r.net}</em>${mults.length ? `<small>${mults.join(' · ')}</small>` : ''}${r.kwadHit ? `<small class="kw">K.W.A.D. letter ${r.kwadHit}!</small>` : ''}`, r.exec);
  updateBreakdown();
}
function updateBreakdown() {
  const rows = score.log.slice(-14).reverse().map(r => `<tr><td>${r.name}</td><td>${r.base ?? 0}</td><td class="${r.exec}">${r.exec}</td><td>${r.execM ?? 0}</td><td>${r.repeatM ?? '-'}</td><td>${r.b2bM ?? '-'}</td><td>${r.obsM ?? '-'}</td><td>${r.totwM ?? '-'}</td><td>${r.streakM ? r.streakM.toFixed(2) : '-'}</td><td><b>${r.net}</b></td></tr>`).join('');
  $('#breakdown tbody').innerHTML = rows || '<tr><td colspan=10>No tricks yet</td></tr>';
}
function hud() {
  const s = params.stats;
  $('#score').textContent = score.total.toLocaleString();
  $('#streak').textContent = `STREAK ×${score.streak.toFixed(2)}`;
  $('#streakbar').style.width = Math.min(100, (score.streak - 1) * 250) + '%';
  $('#switch').textContent = score.uniqueObs.size ? `${score.uniqueObs.size} obstacle${score.uniqueObs.size > 1 ? 's' : ''} · switch ×${score.switchMult()}` : '';
  for (const L of ['K', 'W', 'A', 'D']) $('#kw' + L).classList.toggle('on', !!score.kwad[L]);
  // OSD
  const v = drone.vbat; $('#osdV').textContent = v.toFixed(2) + 'V'; $('#osdV').classList.toggle('blink', v < 3.35 && drone.armed);
  $('#osdA').textContent = drone.ibat.toFixed(1) + 'A'; $('#osdMah').textContent = Math.round(drone.mAh) + 'mAh';
  $('#osdThr').textContent = 'THR ' + Math.round(lastRC.thr * 100);
  $('#osdSpd').textContent = Math.round(S.len(drone.vel) * 3.6) + 'kph';
  $('#osdAlt').textContent = drone.pos.y.toFixed(1) + 'm';
  const usingSwitch = inputCfg.mode !== 'keyboard' && prof() && !prof().arm.toggle && readPad();
  const noDev = inputCfg.mode !== 'keyboard' && !readPad();
  $('#osdState').textContent = noDev ? `${inputCfg.mode.toUpperCase()} NOT DETECTED · MOVE A STICK` : drone.armed ? '' :
    usingSwitch ? (armBlock || 'DISARMED') :
    drone.crashed ? (drone.crashReason === 'turtle' ? 'CRASH · T OR ARM TO FLIP' : 'CRASH · ARM TO RESET') :
    (lastRC.thr > ARM_THR_MAX ? `THROTTLE HIGH (${Math.round(lastRC.thr * 100)}%)` : (inputCfg.mode === 'keyboard' ? 'DISARMED · SPACE TO ARM' : 'DISARMED · ' + (prof().arm.type === 'button' ? 'PRESS ARM' : 'ARM SWITCH')));
  $('#osdTimer').textContent = fmtT(flightTime);
  $('#sessionT').textContent = train.on ? 'TRAINING' : session ? fmtT(Math.max(0, session.timeLeft)) : 'FREE FLY';
  $('#washMeter').style.opacity = Math.min(1, drone.washLevel * 2);
}
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ============================================================ loop
let flightTime = 0, acc = 0, lastT = performance.now(), frames = 0, fpsT = 0;
const DT = 1 / 1000;
const tmpQ = new THREE.Quaternion(), tiltQ = new THREE.Quaternion();
const chasePos = new THREE.Vector3(0, 1, 14);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (mode === 'fly') {
    const rc = getRC(dt); lastRC = rc;
    acc += dt; let n = 0;
    while (acc >= DT && n < 120) {
      drone.step(rc, DT); detector.update(drone, DT, rc); detector.postStep(drone); recordTrace(rc); acc -= DT; n++;
    }
    if (n >= 120) acc = 0;
    for (const ev of detector.drain()) onTrick(ev);
    if (combo.active && now / 1000 - combo.lastT > COMBO_IDLE && !detector.busy()) comboEnd(false);
    renderCombo();
    if (drone.crashed) crashLock = true;
    if (drone.armed) flightTime += dt;
    if (session && session.started) { session.timeLeft -= dt; if (session.timeLeft <= 0) endSession(); }
    updateAudio(); hud();
  } else if (actx) for (const g of gains) g.gain.setTargetAtTime(0, actx.currentTime, 0.05);
  // drone visual
  droneMesh.position.set(drone.pos.x, drone.pos.y, drone.pos.z);
  droneMesh.quaternion.set(drone.q.x, drone.q.y, drone.q.z, drone.q.w);
  for (let i = 0; i < 4; i++) { const w = drone.motorW[i]; propGroups[i].rotation.y += params.motors[i].spin * Math.min(w * dt, 0.9); propDiscs[i].material.opacity = Math.min(0.35, w / params.stats.rpmMax * 2.4); propGroups[i].visible = w < 2500; }
  // cameras
  let cam;
  if (mode === 'menu') {
    const t = now / 1000 * 0.08; chaseCam.position.set(Math.sin(t) * 16, 5 + Math.sin(t * 1.7) * 1.5, Math.cos(t) * 16); chaseCam.lookAt(0, 1.5, -3); cam = chaseCam;
  } else if (camMode === 'fpv') {
    cam = fpvCam; const cp = S.add(drone.pos, S.qrot(drone.q, params.camPos));
    fpvCam.position.set(cp.x, cp.y, cp.z);
    tmpQ.set(drone.q.x, drone.q.y, drone.q.z, drone.q.w); tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tune.camTilt * Math.PI / 180);
    fpvCam.quaternion.copy(tmpQ).multiply(tiltQ);
  } else {
    cam = chaseCam; const f = drone.fwd(); const fl = Math.hypot(f.x, f.z) || 1;
    const target = new THREE.Vector3(drone.pos.x - f.x / fl * 0.45, drone.pos.y + 0.16, drone.pos.z - f.z / fl * 0.45);
    chasePos.lerp(target, 1 - Math.exp(-dt * 6)); chaseCam.position.copy(chasePos); chaseCam.lookAt(drone.pos.x, drone.pos.y + 0.02, drone.pos.z);
  }
  renderer.render(scene, cam);
  frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  for (const c of [fpvCam, chaseCam]) c.aspect = w / h;
  // convert horizontal FOV (camera spec) to vertical
  const hf = tune.camFov * Math.PI / 180; fpvCam.fov = 2 * Math.atan(Math.tan(hf / 2) / (w / h)) * 180 / Math.PI;
  fpvCam.fov = Math.min(fpvCam.fov, 125); fpvCam.updateProjectionMatrix(); chaseCam.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ============================================================ menus
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.add('hide'); if (id) $(id).classList.remove('hide'); }
function startFly(withSession) {
  combo.names = []; combo.pts = 0; combo.active = false;
  initAudio(); if (actx && actx.state === 'suspended') actx.resume();
  score = new S.ScoreKeeper(); detector.reset(); drone.reset(world.spawn); flightTime = 0; updateBreakdown();
  session = withSession ? { timeLeft: 120, started: false } : null;
  mode = 'fly'; show(null); $('#hud').classList.remove('hide'); camMode = 'fpv'; resize();
  flash(withSession ? '<b>2:00 SESSION</b><small>timer starts when you arm</small>' : '<b>FREE FLY</b><small>Space / arm switch to arm</small>');
}
function pause() { mode = 'paused'; show('#pause'); }
function resume() { mode = 'fly'; show(null); lastT = performance.now(); }
function endSession() {
  mode = 'paused'; drone.armed = false; const r = score;
  const best = store.get('best', 0); if (r.total > best) store.set('best', r.total);
  $('#results').innerHTML = `<h2>SESSION OVER</h2><div class="big">${r.total.toLocaleString()}</div>
    <p>Trick score ${r.trickScore.toLocaleString()} × switch ${r.switchMult()} + K.W.A.D. ${r.kwadBonus}</p>
    <p>Biggest trick: <b>${r.biggest ? r.biggest.name + ' (' + r.biggest.net + ')' : '—'}</b> · Max streak ×${r.maxStreak.toFixed(2)} · Obstacles ${r.uniqueObs.size}</p>
    <p>Personal best: <b>${Math.max(best, r.total).toLocaleString()}</b></p>
    <ol>${r.log.filter(x => x.net || x.exec === 'CRASH').map(x => `<li>${x.name} <span class="${x.exec}">${x.exec}</span> +${x.net}</li>`).join('')}</ol>
    <div class="row"><button data-act="session">Run it back</button><button data-act="menu">Menu</button></div>`;
  show('#resultsScreen');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'free' || a === 'session') { train.on = false; renderTrain(); if (typeof ask !== 'undefined') { ask.pending = []; } }
  if (a === 'free') startFly(false); if (a === 'session') startFly(true);
  if (a === 'garage') openGarage(); if (a === 'controls') openControls(); if (a === 'tricks') openTricks();
  if (a === 'resume') resume(); if (a === 'menu') { train.on = false; renderTrain(); mode = 'menu'; drone.armed = false; $('#hud').classList.add('hide'); show('#mainMenu'); }
  if (a === 'back') { show(mode === 'menu' ? '#mainMenu' : '#pause'); }
  if (a === 'blackbox') show('#bbScreen');
});

// ---------------- garage
function opt(obj, sel) { return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.name}</option>`).join(''); }
function openGarage() { show('#garage'); renderGarage(); }
function renderGarage() {
  const P = S.PARTS, st = params.stats, hv = S.hoverInfo(params);
  const presetName = Object.keys(S.PRESETS).find(k => JSON.stringify(S.PRESETS[k]) === JSON.stringify(spec)) || '';
  $('#gBuild').innerHTML = `
    <label>Preset<select id="gPreset"><option value="">Custom</option>${Object.keys(S.PRESETS).map(k => `<option ${k === presetName ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label>Frame<select data-part="frame">${opt(P.frames, spec.frame)}</select></label>
    <label>Motors<select data-part="motor">${opt(P.motors, spec.motor)}</select></label>
    <label>Props<select data-part="prop">${opt(P.props, spec.prop)}</select></label>
    <label>Battery<select data-part="battery">${opt(P.batteries, spec.battery)}</select></label>
    <label>Electronics<select data-part="electronics">${opt(P.electronics, spec.electronics)}</select></label>
    ${params.warnings.map(w => `<p class="warn">⚠ ${w}</p>`).join('')}
    <div class="stats">
      <div><b>${st.auw.toFixed(1)}g</b><span>all-up weight</span></div><div><b>${st.twr.toFixed(1)}:1</b><span>thrust/weight</span></div>
      <div><b>${Math.round(st.thrust)}g</b><span>max thrust</span></div><div><b>${Math.round(hv.duty * 100)}%</b><span>hover throttle</span></div>
      <div><b>${(st.rpmMax / 1000).toFixed(0)}k</b><span>max rpm (loaded)</span></div><div><b>${st.ampsMax.toFixed(1)}A</b><span>max current</span></div>
      <div><b>${hv.minutes.toFixed(1)} min</b><span>est. hover time</span></div><div><b>${Math.round(st.I.x * 1e7)}</b><span>roll inertia (g·cm²)</span></div>
    </div><p class="note">Part numbers are first-pass estimates from spec sheets. Fitting them to your Blackbox logs is the next step.</p>`;
  const R = tune.rates, isA = tune.ratesType === 'ACTUAL';
  const rateRow = ax => isA ? `<tr><td>${ax}</td><td><input type=number data-r="${ax}.center" value="${R[ax].center}"></td><td><input type=number data-r="${ax}.max" value="${R[ax].max}"></td><td><input type=number step=0.01 data-r="${ax}.expo" value="${R[ax].expo}"></td></tr>`
    : `<tr><td>${ax}</td><td><input type=number step=0.01 data-r="${ax}.rcRate" value="${R[ax].rcRate}"></td><td><input type=number step=0.01 data-r="${ax}.superRate" value="${R[ax].superRate}"></td><td><input type=number step=0.01 data-r="${ax}.rcExpo" value="${R[ax].rcExpo}"></td></tr>`;
  const pidRow = ax => `<tr><td>${ax}</td>${['p', 'i', 'd', 'f'].map(k => `<td><input type=number data-pid="${ax}.${k}" value="${tune.pid[ax][k]}"></td>`).join('')}</tr>`;
  $('#gTune').innerHTML = `
    <label>Rates type<select id="gRT"><option ${isA ? 'selected' : ''}>ACTUAL</option><option ${!isA ? 'selected' : ''}>BETAFLIGHT</option></select></label>
    <table class="tt"><tr><th></th>${isA ? '<th>Center</th><th>Max</th><th>Expo</th>' : '<th>RC rate</th><th>Super</th><th>Expo</th>'}</tr>${['roll', 'pitch', 'yaw'].map(rateRow).join('')}</table>
    <canvas id="rateCurve" width=300 height=120></canvas>
    <table class="tt"><tr><th></th><th>P</th><th>I</th><th>D</th><th>FF</th></tr>${['roll', 'pitch', 'yaw'].map(pidRow).join('')}</table>
    <div class="grid2">
      <label>Motor idle %<input type=number step=0.1 data-t="idle" data-scale="100" value="${(tune.idle * 100).toFixed(1)}"></label>
      <label>Throttle mid<input type=number step=0.01 data-t="thrMid" value="${tune.thrMid}"></label>
      <label>Throttle expo<input type=number step=0.01 data-t="thrExpo" value="${tune.thrExpo}"></label>
      <label>Camera tilt °<input type=number data-t="camTilt" value="${tune.camTilt}"></label>
      <label>Camera FOV ° (horiz)<input type=number data-t="camFov" value="${tune.camFov}"></label>
      <label class="chk"><input type=checkbox data-tb="airmode" ${tune.airmode ? 'checked' : ''}> Airmode</label>
      <label class="chk"><input type=checkbox data-tb="itermRelax" ${tune.itermRelax ? 'checked' : ''}> I-term relax</label>
    </div>
    <details><summary>Import Betaflight <code>diff all</code></summary><textarea id="gDiff" placeholder="Paste the output of 'diff all' from the Betaflight CLI"></textarea><button id="gDiffBtn">Apply</button><span id="gDiffMsg"></span></details>
    <button id="gReset" class="ghost">Reset tune to defaults</button>`;
  drawRateCurve();
}
function drawRateCurve() {
  const c = $('#rateCurve'); if (!c) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = '#555'; g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  const cols = { roll: '#ff5a5a', pitch: '#5ad1ff', yaw: '#ffd25a' }, max = 2000;
  for (const ax of ['roll', 'pitch', 'yaw']) { g.strokeStyle = cols[ax]; g.beginPath(); for (let i = 0; i <= 100; i++) { const x = i / 100, r = S.applyRate(x, tune.rates[ax], tune.ratesType); const px = x * c.width, py = c.height - r / max * c.height; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.fillStyle = cols[ax]; g.fillText(`${ax} ${Math.round(S.applyRate(1, tune.rates[ax], tune.ratesType))}°/s`, 6, 14 + ['roll', 'pitch', 'yaw'].indexOf(ax) * 13); }
}
function applyParts() { params = S.buildDrone(spec); drone.setParams(params, tune); drone.reset(world.spawn); buildDroneMesh(); store.set('spec', spec); renderGarage(); }
function saveTune() { detector.camTilt = tune.camTilt; drone.setParams(params, tune); store.set('tune', tune); resize(); buildDroneMesh(); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'gPreset' && t.value) { spec = { ...S.PRESETS[t.value] }; applyParts(); }
  if (t.dataset.part) { spec[t.dataset.part] = t.value; applyParts(); }
  if (t.id === 'gRT') { tune.ratesType = t.value; saveTune(); renderGarage(); }
  if (t.dataset.r) { const [ax, k] = t.dataset.r.split('.'); tune.rates[ax][k] = +t.value; saveTune(); drawRateCurve(); }
  if (t.dataset.pid) { const [ax, k] = t.dataset.pid.split('.'); tune.pid[ax][k] = +t.value; saveTune(); }
  if (t.dataset.t) { tune[t.dataset.t] = +t.value / (+t.dataset.scale || 1); saveTune(); }
  if (t.dataset.tb) { tune[t.dataset.tb] = t.checked; saveTune(); }
  if (t.id === 'vol') { store.set('vol', +t.value); if (window._master) window._master.gain.value = +t.value; }
});
document.addEventListener('click', e => {
  if (e.target.id === 'gDiffBtn') { const r = S.importDiff($('#gDiff').value, tune); tune = Object.assign(tune, r.tune); saveTune(); renderGarage(); $('#gDiffMsg').textContent = r.found.length ? `Imported ${r.found.length} settings` : 'No Betaflight settings found'; }
  if (e.target.id === 'gReset') { tune = S.defaultTune(); saveTune(); renderGarage(); }
});

// ---------------- controls
let ctlTimer = null;
function openControls() { show('#controls'); renderControls(); clearInterval(ctlTimer); ctlTimer = setInterval(liveControls, 50); }
function deviceCard(d, kind) {
  if (!d) return `<div class="dev none"><b>No ${kind} detected</b><span>${kind === 'radio'
    ? 'Plug the radio in over USB and choose <i>USB Joystick (HID)</i> when it asks. In EdgeTX: SYS → Hardware / USB mode → Joystick. Then move a stick so the browser sees it.'
    : 'Connect a controller and press any button so the browser sees it.'}</span></div>`;
  return `<div class="dev"><b>${d.name}</b><span>${d.firmware ? d.firmware + ' · ' : ''}${d.vendor ? `USB ${d.vendor}:${d.product} · ` : ''}${d.axes} channels/axes · ${d.buttons} buttons</span></div>`;
}
function renderControls() {
  const mode = inputCfg.mode, P = prof(), pads = allPads().map(describePad);
  const tabs = ['keyboard', 'radio', 'gamepad'].map(m => `<button class="tab ${m === mode ? 'on' : ''}" data-mode="${m}">${m === 'radio' ? 'Radio' : m === 'gamepad' ? 'Gamepad' : 'Keyboard'}</button>`).join('');
  let body = '';
  if (mode === 'keyboard') {
    body = `<p class="note">Keyboard is for a quick look around. Acro on keys is rough; a radio is the real thing.</p>`;
  } else {
    const isR = mode === 'radio', cur = readPad(mode), d = describePad(cur);
    const n = Math.max(8, cur ? cur.axes.length : 8);
    const chOpt = sel => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${isR ? 'CH' + (i + 1) : 'Axis ' + i}</option>`).join('');
    const sameKind = pads.filter(p => p.kind === mode), other = pads.filter(p => p.kind !== mode);
    const devSel = pads.length > 1 || (pads.length && !sameKind.length) ? `<label>Device<select id="cDev">${[...sameKind, ...other].map(p => `<option value="${encodeURIComponent(p.id)}" ${cur && cur.id === p.id ? 'selected' : ''}>${p.name}${p.kind !== mode ? ' (' + p.kind + '?)' : ''}</option>`).join('')}</select></label>` : '';
    const swRow = (key, s) => `<tr><td>${key}</td><td><select data-swt="${key}"><option value="axis" ${s.type === 'axis' ? 'selected' : ''}>${isR ? 'switch (channel)' : 'axis'}</option><option value="button" ${s.type === 'button' ? 'selected' : ''}>button</option></select>
      ${s.type === 'axis' ? `<select data-swi="${key}">${chOpt(s.i)}</select>` : `<input type=number min=0 max=31 data-swi="${key}" value="${s.i}">`}</td><td>${key === 'arm' && !isR ? `<label class="chk"><input type=checkbox data-swtog ${s.toggle ? 'checked' : ''}> toggle</label>` : ''}</td><td><div class="bar"><i id="lv_${key}"></i></div></td><td><button data-detect="${key}">Detect</button></td></tr>`;
    body = `${deviceCard(d, mode)}${devSel}
      ${isR ? `<p class="note">Defaults follow EdgeTX/OpenTX AETR order: CH1 roll · CH2 pitch · CH3 throttle · CH4 yaw · CH5 arm · CH6 reset. If a stick moves the wrong way, tick Invert.</p>` : `<p class="note">Mode 2 layout: left stick throttle/yaw, right stick pitch/roll. A = arm toggle, Y = respawn.</p>`}
      <table class="tt"><tr><th>Function</th><th>${isR ? 'Channel' : 'Axis'}</th><th>Invert</th><th>Live</th><th></th></tr>
      ${AX4.map(a => `<tr><td>${a}</td><td><select data-ax="${a}">${chOpt(P.axes[a].i)}</select></td><td><input type=checkbox data-inv="${a}" ${P.axes[a].inv ? 'checked' : ''}></td><td><div class="bar"><i id="lv_${a}"></i></div></td><td><button data-detect="${a}">Detect</button></td></tr>`).join('')}
      ${swRow('arm', P.arm)}${swRow('reset', P.reset)}
      </table>
      ${!isR ? `<label class="chk"><input type=checkbox id="cThrC" ${P.thrCentered ? 'checked' : ''}> Spring-centred throttle (stick up from centre = throttle)</label>` : ''}
      <div class="preflight" id="preflight"></div>
      <label>Stick deadband<input type=number step=0.005 min=0 max=0.2 id="cDb" value="${P.deadband}"></label>
      <button id="cCal">Calibrate: move all sticks to every corner, then click again</button>
      ${cur ? `<h3>${isR ? 'Channel monitor' : 'Raw axes'}</h3><div class="chmon">${cur.axes.map((_, i) => `<div><span>${isR ? 'CH' + (i + 1) : 'A' + i}</span><div class="bar"><i id="raw_${i}"></i></div></div>`).join('')}</div>` : ''}`;
  }
  $('#cBody').innerHTML = `<div class="tabs">${tabs}</div>${body}
    <div class="keys"><b>Keyboard</b> W/S throttle · Shift boost · X cut · A/D yaw · ↑↓ pitch · ←→ roll · Space arm · T flip over · R respawn · C chase cam · Tab score breakdown · Esc pause</div>`;
}
let calib = null, detecting = null;
function liveControls() {
  if ($('#controls').classList.contains('hide')) { clearInterval(ctlTimer); return; }
  const P = prof(); if (!P) return; const pad = readPad(); if (!pad) return;
  for (const a of AX4) { const el = $('#lv_' + a); if (el) el.style.left = ((axisVal(pad, P.axes[a]) + 1) / 2 * 100) + '%'; }
  for (const k of ['arm', 'reset']) { const el = $('#lv_' + k); if (el) el.style.left = switchOn(pad, P[k]) ? '100%' : '0%'; }
  const pf = $('#preflight'); if (pf) {
    const tv = axisVal(pad, P.axes.thr), thr = P.thrCentered ? Math.max(0, tv) : (tv + 1) / 2, armOn = switchOn(pad, P.arm);
    const ok = thr <= ARM_THR_MAX;
    pf.innerHTML = `<b>Pre-flight</b> Throttle <span class="${ok ? 'ok' : 'bad'}">${Math.round(thr * 100)}%</span> ${ok ? '✓ low enough to arm' : '✗ must be ≤ ' + Math.round(ARM_THR_MAX * 100) + '% to arm — lower it, or tick Invert / Calibrate if it reads high at the bottom'}
      · Arm ${P.arm.toggle ? 'button' : 'switch'} <span class="${armOn ? 'ok' : ''}">${armOn ? 'ON' : 'OFF'}</span>${!P.arm.toggle ? ' — flip it to check it moves the bar' : ''}`;
  }
  pad.axes.forEach((v, i) => { const el = $('#raw_' + i); if (el) el.style.left = ((v + 1) / 2 * 100) + '%'; });
  if (calib) pad.axes.forEach((v, i) => { calib[i] = calib[i] || { min: v, max: v }; calib[i].min = Math.min(calib[i].min, v); calib[i].max = Math.max(calib[i].max, v); });
  if (detecting) {
    if (!detecting.base) { detecting.base = [...pad.axes]; detecting.bbase = pad.buttons.map(b => b.pressed); return; }
    let bi = -1, bd = 0.35; pad.axes.forEach((v, i) => { const dd = Math.abs(v - detecting.base[i]); if (dd > bd) { bd = dd; bi = i; } });
    const bt = pad.buttons.findIndex((b, i) => b.pressed && !detecting.bbase[i]);
    const k = detecting.key;
    if (k === 'arm' || k === 'reset') {
      if (bt >= 0) { P[k] = { type: 'button', i: bt, toggle: k === 'arm' && inputCfg.mode === 'gamepad' }; detecting = null; }
      else if (bi >= 0) { P[k] = { type: 'axis', i: bi, th: (detecting.base[bi] < pad.axes[bi]) ? (detecting.base[bi] + pad.axes[bi]) / 2 : 0.5 }; detecting = null; }
    } else if (bi >= 0) { P.axes[k].i = bi; detecting = null; }
    if (!detecting) { saveInput(); renderControls(); }
  }
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset && t.dataset.mode) { inputCfg.mode = t.dataset.mode; armSwitchPrev = null; saveInput(); renderControls(); }
  const d = t.dataset && t.dataset.detect; if (d) { detecting = { key: d }; t.textContent = d === 'arm' ? 'Flip switch…' : 'Move it…'; }
  if (t.id === 'cCal') { const P = prof(); if (!calib) { calib = []; t.textContent = 'Calibrating… click when done'; } else { for (const a of AX4) { const c = calib[P.axes[a].i]; if (c && c.max - c.min > 0.5) { P.axes[a].min = c.min; P.axes[a].max = c.max; } } calib = null; saveInput(); renderControls(); } }
});
document.addEventListener('change', e => {
  const t = e.target, P = prof(); if (!P || !$('#controls').contains(t)) return;
  if (t.id === 'cDev') { P.device = decodeURIComponent(t.value); armSwitchPrev = null; renderControls(); }
  if (t.dataset.ax) P.axes[t.dataset.ax].i = +t.value;
  if (t.dataset.inv) P.axes[t.dataset.inv].inv = t.checked;
  if (t.dataset.swt) { P[t.dataset.swt].type = t.value; renderControls(); }
  if (t.dataset.swi) P[t.dataset.swi].i = +t.value;
  if (t.dataset.swtog !== undefined && t.matches('[data-swtog]')) P.arm.toggle = t.checked;
  if (t.id === 'cThrC') P.thrCentered = t.checked;
  if (t.id === 'cDb') P.deadband = +t.value;
  saveInput();
});
addEventListener('gamepadconnected', e => {
  const d = describePad(e.gamepad);
  if (inputCfg.mode === 'keyboard') { inputCfg.mode = d.kind; saveInput(); }
  if (!$('#controls').classList.contains('hide')) renderControls();
  else flash(`<b>${d.kind === 'radio' ? 'RADIO' : 'GAMEPAD'} CONNECTED</b><small>${d.name}${d.firmware ? ' · ' + d.firmware : ''}</small>`);
  updateMenuDevice();
});
addEventListener('gamepaddisconnected', () => { if (!$('#controls').classList.contains('hide')) renderControls(); updateMenuDevice(); });
function updateMenuDevice() {
  const el = $('#menuDevice'); if (!el) return; const d = describePad(readPad('radio')) || describePad(readPad('gamepad'));
  el.innerHTML = inputCfg.mode === 'keyboard' ? (d ? `${d.kind === 'radio' ? 'Radio' : 'Gamepad'} found: <b>${d.name}</b> — switch to it under Controls.` : 'Input: keyboard. Plug in your radio as a USB joystick for real acro.')
    : (describePad(readPad()) ? `Input: <b>${describePad(readPad()).name}</b> (${inputCfg.mode})` : `Input: ${inputCfg.mode} — not connected yet. Move a stick once it's plugged in.`);
}

// ---------------- trick list
function openTricks() {
  show('#tricksScreen'); const det = new Set(S.DETECTABLE), dr = S.DRAFT;
  const cats = {}; for (const t of window.TPW_TRICKS) (cats[t.cat.trim()] = cats[t.cat.trim()] || []).push(t);
  const all = window.TPW_TRICKS.filter(t => t.pts > 0), nDet = all.filter(t => det.has(t.name.trim())).length, nDraft = all.filter(t => dr.has(t.name.trim())).length;
  $('#tBody').innerHTML = `<p class="note">${nDet} of ${all.length} tricks have detection rules. <b>●</b> tested rule · <b>◐</b> new draft rule written from the TPW description — fly it in Trick Training so it can be confirmed. Points and execution rules come from the TPW calculator. Trick of the Week: Split-S, Powerloop, Matty Flip (first landing ×2, then ×1.5, then ×1).</p>` +
    Object.entries(cats).map(([c, ts]) => `<h3>${c}</h3><table class="tt">${ts.map(t => { const n = t.name.trim(), has = det.has(n), d = dr.has(n);
      return `<tr class="${has ? 'det' : 'nodet'}"><td title="${d ? 'draft rule' : has ? 'tested rule' : 'not detected'}">${has ? (d ? '◐' : '●') : '○'}</td><td><b>${t.name}</b>${d ? ' <small class="draftTag">draft</small>' : ''}</td><td>${t.diff}</td><td>${t.pts}</td><td class="desc">${t.desc}</td></tr>`; }).join('')}</table>`).join('');
}

// ============================================================ boot
(async function boot() {
  try { await Promise.all(['80px "Sedgwick Ave Display"', '40px "Permanent Marker"', '30px "Bungee"'].map(f => document.fonts.load(f))); } catch {}
  detector.camTilt = tune.camTilt; makeTextures(); mats(); buildScene(); buildDroneMesh(); resize();
  $('#best').textContent = store.get('best', 0).toLocaleString();
  $('#vol').value = store.get('vol', 0.35); updateMenuDevice(); setInterval(updateMenuDevice, 2000);
  $('#loading').classList.add('hide'); show('#mainMenu');
  requestAnimationFrame(frame);
})();
window.__pw = { drone, detector, get score() { return score; }, startFly, S, rec: rc => recordTrace(rc) };

// ============================================================ music player (overlay on everything)
const music = (() => {
  const el = new Audio(); el.preload = 'auto';
  const tracks = (window.PW_TRACKS || []).map(t => ({ ...t }));
  let idx = 0, started = false, wantPlay = store.get('musicOn', true);
  el.volume = store.get('musicVol', 0.55);
  const ui = $('#music');
  function load(i, autoplay) {
    if (!tracks.length) return; idx = (i + tracks.length) % tracks.length; const t = tracks[idx];
    el.src = t.src; el.loop = tracks.length === 1;
    $('#mTitle').textContent = t.title; $('#mArtist').textContent = t.artist || '';
    $('#mArt').style.backgroundImage = t.art ? `url("${t.art}")` : '';
    $('#mList').innerHTML = tracks.map((x, k) => `<li class="${k === idx ? 'on' : ''}" data-track="${k}">${x.title}<span>${x.artist || ''}</span></li>`).join('');
    if (autoplay) play();
    nowPlaying(t);
  }
  function play() { wantPlay = true; store.set('musicOn', true); const p = el.play(); if (p && p.catch) p.catch(() => { ui.classList.add('needsTap'); }); render(); }
  function pause() { wantPlay = false; store.set('musicOn', false); el.pause(); render(); }
  function render() { $('#mPlay').textContent = el.paused ? '▶' : '❚❚'; ui.classList.toggle('playing', !el.paused); $('#mVol').value = el.volume; }
  function nowPlaying(t) { const n = $('#nowPlaying'); n.innerHTML = `<small>NOW PLAYING</small><b>${t.title}</b><span>${t.artist || ''}</span>`; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
  el.addEventListener('play', () => { ui.classList.remove('needsTap'); render(); });
  el.addEventListener('pause', render);
  el.addEventListener('ended', () => load(idx + 1, true));
  el.addEventListener('timeupdate', () => { if (el.duration) $('#mProg').style.width = (el.currentTime / el.duration * 100) + '%'; });
  // browsers block sound until the first click / key press — start then
  const kick = () => { if (!started) { started = true; if (wantPlay) play(); } };
  addEventListener('pointerdown', kick, { capture: true }); addEventListener('keydown', kick, { capture: true });
  ui.addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); const tr = e.target.closest('[data-track]');
    if (tr) { load(+tr.dataset.track, true); return; }
    if (!b) return; e.stopPropagation(); const a = b.dataset.m;
    if (a === 'play') { started = true; el.paused ? play() : pause(); }
    if (a === 'next') load(idx + 1, !el.paused || wantPlay);
    if (a === 'prev') { if (el.currentTime > 3) el.currentTime = 0; else load(idx - 1, !el.paused || wantPlay); }
    if (a === 'list') ui.classList.toggle('open');
    if (a === 'add') $('#mFile').click();
  });
  $('#mVol').addEventListener('input', e => { el.volume = +e.target.value; store.set('musicVol', el.volume); });
  $('#mFile').addEventListener('change', e => {
    const files = [...e.target.files]; if (!files.length) return;
    const first = tracks.length;
    for (const f of files) tracks.push({ title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), artist: 'your music', src: URL.createObjectURL(f) });
    if (tracks.length > 1) el.loop = false;
    load(first, true); e.target.value = '';
  });
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.code === 'KeyM') { el.paused ? play() : pause(); } if (e.code === 'KeyN') load(idx + 1, true); });
  load(0, false); render();
  return { el, play, pause, load };
})();

// ============================================================ trick debug panel (G)
function renderDebug() {
  const box = $('#trickDebug'); if (box.classList.contains('hide')) return;
  const rows = (detector.debug || []).slice(-6).reverse();
  box.querySelector('.rows').innerHTML = rows.length ? rows.map(r => `<div class="dr"><b>${r.result.length ? r.result.join(', ') : (r.near ? 'near miss' : 'no match')}</b>
    <div>rotations: <code>${r.toks || '—'}</code></div><div>obstacle passes: <code>${r.cross || 'none'}</code></div>${r.near ? `<div class="nm">${r.near}</div>` : ''}</div>`).join('') : '<p class="note">Do a trick and its raw data shows here.</p>';
}
addEventListener('keydown', e => { if (e.code === 'KeyG' && mode !== 'menu' && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { $('#trickDebug').classList.toggle('hide'); renderDebug(); } });
setInterval(renderDebug, 500);
document.addEventListener('click', async e => {
  if (e.target.id !== 'dbgCopy') return;
  const last = (detector.debug || []).slice(-1)[0]; if (!last) return;
  const txt = JSON.stringify({ build: '0.1', craft: spec, ...last });
  const ta = $('#dbgText'); ta.value = txt; ta.classList.remove('hide'); ta.select();
  try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copied ✓'; } catch { e.target.textContent = 'Select + copy the text below'; }
  setTimeout(() => e.target.textContent = 'Copy last trick data', 2500);
});

// ============================================================ trick training + calibration (dev mode)
// Records the whole run at 100 Hz while training, logs every detector verdict and every label, keeps a
// 5-reps-per-trick checklist across rounds, and saves it all in the browser (IndexedDB) for export.
const TRACE_HZ = 100, TRACE_LEN = 1000, REPS = 5;
const TRACE_COLS = ['t', 'x', 'y', 'z', 'qw', 'qx', 'qy', 'qz', 'rollRate', 'pitchRate', 'yawRate', 'thr', 'contact', 'armed', 'crashed', 'cnx', 'cny', 'cnz', 'cObj', 'cImpact', 'cGround', 'vx', 'vy', 'vz'];
let contactLatch = null; // a contact can happen between two 100 Hz samples: keep it until the next row
const trace = []; let traceCtr = 0;
function recordTrace(rc) {
  if (drone.contactThisStep && drone.contactNormal && (!contactLatch || drone.lastImpact > contactLatch.imp))
    contactLatch = { n: drone.contactNormal, obj: drone.contactOwner ?? -1, imp: drone.lastImpact || 0, g: drone.contactGround ? 1 : 0 };
  if (++traceCtr % (1000 / TRACE_HZ)) return;
  const d = drone, r = d.pilotRates(), c = contactLatch; contactLatch = null;
  const row = [+d.time.toFixed(3), +d.pos.x.toFixed(4), +d.pos.y.toFixed(4), +d.pos.z.toFixed(4), +d.q.w.toFixed(5), +d.q.x.toFixed(5), +d.q.y.toFixed(5), +d.q.z.toFixed(5),
    Math.round(r[0]), Math.round(r[1]), Math.round(r[2]), +rc.thr.toFixed(3), c ? 1 : 0, d.armed ? 1 : 0, d.crashed ? 1 : 0,
    c ? +c.n.x.toFixed(3) : 0, c ? +c.n.y.toFixed(3) : 0, c ? +c.n.z.toFixed(3) : 0, c ? c.obj : -1, c ? +c.imp.toFixed(2) : 0, c ? c.g : 0,
    +d.vel.x.toFixed(3), +d.vel.y.toFixed(3), +d.vel.z.toFixed(3)];
  trace.push(row); if (trace.length > TRACE_LEN) trace.shift();
  if (train.on && run.id) run.trace.push(row);
}
// ---- tiny IndexedDB wrapper (falls back to nothing if the browser blocks storage)
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('prowhooper', 1);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('examples')) db.createObjectStore('examples', { keyPath: 'id' }); if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  const tx = async (store, mode, fn) => { try { const db = await open(); return await new Promise((res, rej) => { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); } catch { return null; } };
  return { put: (s, v) => tx(s, 'readwrite', o => o.put(v)), all: async s => (await tx(s, 'readonly', o => o.getAll())) || [], clear: s => tx(s, 'readwrite', o => o.clear()), ok: async () => { try { await open(); return true; } catch { return false; } } };
})();
const TRAIN_OBST = {
  'Powerloops': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Picnic Table'],
  'Maverick Loops': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower'],
  'Matty Flips': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Picnic Table', 'Bench'],
  'SplitS': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Picnic Table'],
  'Wall Tricks': ['Graffiti Wall', 'Brick Building', 'Dumpster'], 'Gaps': ['Wall Slot'],
  'Pole Dancing': ['Lamp Post', 'Tree', 'Hoop Pole', 'Slide Tower', 'the pilot'], 'Jump Roping': ['Swing Set', 'Monkey Bars', 'Picnic Table'],
  'Rewinds': ['Brick Building', 'Lamp Post', 'Tree', 'Slide Tower'], 'Open Air Tricks': ['anywhere'], 'Other Tricks': ['anywhere'],
};
const SPECIAL_OBST = { 'Facepunch': 'the pilot', 'Perch': 'Brick Building roof', 'Dive': 'Brick Building', 'Ceiling Tap': 'Slide Tower roof (underside)', 'Slide Disarm': 'the ground', 'Knife Edge': 'Wall Slot', 'Ninja Star': 'Wall Slot', 'Reverse Knife Edge': 'Wall Slot' };
const ALL_TRICKS = () => window.TPW_TRICKS.filter(t => t.pts > 0 && !/^Custom/.test(t.name));
const cal = Object.assign({ round: 1, reps: {}, agree: {}, misses: {}, order: 'checklist-draft' }, store.get('calib', {}));
const saveCalib = () => store.set('calib', cal);
const train = { on: false, target: null, obstacle: null, msg: '', repStart: 0, sessionLabels: 0 };
const run = { id: null, started: null, trace: [], events: [], labels: [], lastFlush: 0 };
function newRun() { Object.assign(run, { id: 'run-' + Date.now(), started: new Date().toISOString(), trace: [], events: [], labels: [], lastFlush: 0, round: cal.round }); }
async function flushRun() { if (!run.id) return; run.lastFlush = performance.now(); await idb.put('runs', { id: run.id, started: run.started, round: run.round, craft: { ...spec }, tune, labels: run.labels, events: run.events, hz: TRACE_HZ, cols: TRACE_COLS, trace: run.trace }); }
const nameOf = t => t.name.trim();
function checklistPool() {
  const all = ALL_TRICKS();
  if (cal.order === 'checklist-tested') return all.filter(t => !S.DRAFT.has(nameOf(t)));
  if (cal.order === 'checklist-draft') return [...all.filter(t => S.DRAFT.has(nameOf(t))), ...all.filter(t => !S.DRAFT.has(nameOf(t)))];
  return all; // category order
}
const repsOf = n => cal.reps[n] || 0;
function nextUnfinished(after) {
  const pool = checklistPool(); if (!pool.length) return null;
  const start = after ? pool.findIndex(t => nameOf(t) === after) + 1 : 0;
  for (let k = 0; k < pool.length; k++) { const t = pool[(start + k) % pool.length]; if (repsOf(nameOf(t)) < REPS) return t; }
  return null;
}
function setTarget(t, keepMsg) {
  train.target = t; if (!t) { renderTrain(); return; }
  const obs = SPECIAL_OBST[nameOf(t)] ? [SPECIAL_OBST[nameOf(t)]] : (TRAIN_OBST[t.cat.trim()] || ['anywhere']);
  train.obstacle = obs[Math.floor(Math.random() * obs.length)]; if (!keepMsg) train.msg = ''; train.repStart = drone.time; renderTrain();
}
function repDetected() { // what the detector said since this rep started
  return run.events.filter(e => e.t >= train.repStart - 0.05 && e.name !== 'near').map(e => e.name);
}
function lastDebug() { let dbg = (detector.debug || []).slice(-1)[0] || null; if (dbg && detector.time - dbg.t > 10) dbg = null; return dbg; }
let labelling = false;
async function label(verdict, asName) {
  if (!train.target || labelling) return;
  // let the detector finish deciding about the move you just did before judging it
  if (detector.busy()) {
    labelling = true; train.msg = 'checking…'; renderTrain();
    const t0 = performance.now(); while (detector.busy() && performance.now() - t0 < 1800) await new Promise(r => setTimeout(r, 60));
    await new Promise(r => setTimeout(r, 80)); labelling = false;
  }
  const target = asName || nameOf(train.target), det = repDetected(), dbg = lastDebug(), agreed = det.includes(target);
  const rep = verdict === 'yes' ? repsOf(target) + 1 : null;
  const lab = { t: drone.time, repStart: train.repStart, target, prompted: nameOf(train.target), obstacle: train.obstacle, verdict, rep, round: cal.round, detected: det, toks: dbg ? dbg.toks : '', cross: dbg ? dbg.cross : '', near: dbg ? dbg.near : null };
  run.labels.push(lab); train.sessionLabels++;
  idb.put('examples', { id: run.id + '#' + run.labels.length, run: run.id, ...lab, craft: { ...spec }, hz: TRACE_HZ, cols: TRACE_COLS, trace: trace.slice(-TRACE_LEN) });
  if (verdict === 'yes') {
    cal.reps[target] = rep; if (agreed) cal.agree[target] = (cal.agree[target] || 0) + 1; else cal.misses[target] = (cal.misses[target] || 0) + 1;
    saveCalib();
    const head = agreed ? `✓ Rep ${rep} saved — detector agreed.` : `✓ Rep ${rep} saved — detector said ${det.length ? det.join(', ') : 'nothing'}${lab.near ? ' (' + lab.near + ')' : ''}. This rep will fix it.`;
    if (rep >= REPS) {
      const ag = cal.agree[target] || 0;
      if (gh.enabled && gh.token) uploadTrick(target);
      train.msg = `${head}<br><b>${target} done:</b> detector agreed ${ag}/${REPS}.`;
      const nx = asName ? train.target : nextUnfinished(target);
      if (!nx) { train.msg += `<br><b>Round ${cal.round} complete!</b> ${gh.enabled && gh.token ? 'Uploading the session…' : 'Export the session'}, then start round ${cal.round + 1}.`; if (gh.enabled && gh.token) uploadRun('round complete'); train.target = null; renderTrain(); }
      else setTimeout(() => setTarget(nx, true), 1400);
    } else train.msg = head;
  } else train.msg = `✗ Not counted. Detector said ${det.length ? det.join(', ') : 'nothing'}. Try rep ${repsOf(nameOf(train.target)) + 1} again.`;
  train.repStart = drone.time; flushRun(); renderTrain();
}
function undoLast() {
  const lab = [...run.labels].reverse().find(l => l.verdict === 'yes' && !l.undone); if (!lab) return;
  lab.undone = true; cal.reps[lab.target] = Math.max(0, repsOf(lab.target) - 1);
  if (lab.detected.includes(lab.target)) cal.agree[lab.target] = Math.max(0, (cal.agree[lab.target] || 1) - 1); else cal.misses[lab.target] = Math.max(0, (cal.misses[lab.target] || 1) - 1);
  saveCalib(); const t = ALL_TRICKS().find(x => nameOf(x) === lab.target); if (t) setTarget(t); train.msg = `Undid ${lab.target} rep ${lab.rep}.`; renderTrain(); flushRun();
}
function totals() { const all = ALL_TRICKS(); const done = all.filter(t => repsOf(nameOf(t)) >= REPS).length; const reps = all.reduce((a, t) => a + Math.min(REPS, repsOf(nameOf(t))), 0);
  const ag = Object.values(cal.agree).reduce((a, b) => a + b, 0), ms = Object.values(cal.misses).reduce((a, b) => a + b, 0); return { all: all.length, done, reps, need: all.length * REPS, ag, ms }; }
function dots(n) { return '●'.repeat(Math.min(REPS, n)) + '○'.repeat(Math.max(0, REPS - n)); }
function renderTrain() {
  const box = $('#train'); if (!train.on) { box.classList.add('hide'); return; } box.classList.remove('hide');
  const t = train.target, T = totals();
  const det = repDetected(), dbg = lastDebug();
  const n = t ? repsOf(nameOf(t)) : 0, drf = t && S.DRAFT.has(nameOf(t));
  box.innerHTML = `<div class="trHead"><small>CALIBRATION · ROUND ${cal.round}</small><span class="rec">● REC</span></div>
    <div class="trProg"><i style="width:${T.reps / T.need * 100}%"></i></div><div class="trCount">${T.reps}/${T.need} reps · ${T.done}/${T.all} tricks done · detector agreed ${T.ag}/${T.ag + T.ms}</div>
    ${t ? `<div class="trTarget">${t.name}</div><div class="trObs">on <b>${train.obstacle}</b> · rep <b>${Math.min(n + 1, REPS)}</b> of ${REPS} <span class="dots">${dots(n)}</span> ${drf ? '<small class="draftTag">draft rule</small>' : ''}</div><div class="trDesc">${t.desc}</div>`
      : `<div class="trTarget">Round ${cal.round} complete</div>`}
    <div class="trLast">This rep → <b>${det.length ? det.join(', ') : 'nothing detected yet'}</b>${dbg ? `<br><code>${dbg.toks || '—'}</code> · <code>${dbg.cross || 'no obstacle passes'}</code>` : ''}${dbg && dbg.near ? `<br><span class="nm">${dbg.near}</span>` : ''}</div>
    <div class="trBtns"><button data-tr="yes">✓ Got it <kbd>Y</kbd></button><button data-tr="no">✗ Redo <kbd>N</kbd></button><button data-tr="skip">Skip <kbd>K</kbd></button><button data-tr="undo">Undo <kbd>U</kbd></button><button data-tr="list">Checklist <kbd>L</kbd></button><button data-tr="pauseask" class="${ask.on ? 'on' : ''}">Pause &amp; ask: ${ask.on ? 'ON' : 'OFF'} <kbd>P</kbd></button></div>
    <div class="trRow"><select id="trAs"><option value="">I did a different trick…</option>${ALL_TRICKS().map(x => `<option>${nameOf(x)}</option>`).join('')}</select></div>
    ${train.msg ? `<div class="trMsg">${train.msg}</div>` : ''}
    <div class="trFoot"><button data-tr="upload" class="ghost">↑ Upload</button><button data-act="sync" class="ghost">GitHub ⚙</button><span id="ghStatus" class="ghs"></span></div>
    <div class="trFoot"><button data-tr="export" class="ghost">Export session</button><button data-tr="exportAll" class="ghost">Export all reps</button>${!t ? `<button data-tr="nextRound">Start round ${cal.round + 1}</button>` : ''}</div>
    <textarea id="trOut" class="hide" readonly></textarea>`;
  renderGhStatus();
}
function renderChecklist() {
  const cats = {}; for (const t of ALL_TRICKS()) (cats[t.cat.trim()] = cats[t.cat.trim()] || []).push(t); const T = totals();
  $('#clBody').innerHTML = `<p class="note">Round ${cal.round} · ${T.reps}/${T.need} reps · ${T.done}/${T.all} tricks done. Do each trick ${REPS} times; press <b>Y</b> after each good rep, <b>N</b> if it wasn't right. Click a trick to do it now.</p>
    <label>Order<select id="clOrder"><option value="checklist-draft" ${cal.order === 'checklist-draft' ? 'selected' : ''}>Draft rules first</option><option value="checklist-cat" ${cal.order === 'checklist-cat' ? 'selected' : ''}>By category</option><option value="checklist-tested" ${cal.order === 'checklist-tested' ? 'selected' : ''}>Tested rules only</option></select></label>` +
    Object.entries(cats).map(([c, ts]) => `<h3>${c}</h3><table class="tt cl">${ts.map(t => { const nm = nameOf(t), r = repsOf(nm), ag = cal.agree[nm] || 0, ms = cal.misses[nm] || 0;
      return `<tr data-pick="${encodeURIComponent(nm)}" class="${r >= REPS ? 'done' : ''} ${train.target && nameOf(train.target) === nm ? 'cur' : ''}"><td class="dots">${dots(r)}</td><td><b>${nm}</b>${S.DRAFT.has(nm) ? ' <small class="draftTag">draft</small>' : ''}</td><td>${t.pts}</td><td>${r ? `detector ${ag}/${ag + ms}` : ''}</td></tr>`; }).join('')}</table>`).join('');
}
function openChecklist() { renderChecklist(); show('#checklist'); if (mode === 'fly') { mode = 'paused'; train.pausedForList = true; } }
function closeChecklist() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); show(null); if (train.pausedForList) { train.pausedForList = false; resume(); } }
async function startTraining() {
  startFly(false); train.on = true; detector.debug = []; newRun();
  setTarget(train.target && repsOf(nameOf(train.target)) < REPS ? train.target : nextUnfinished(), false);
  const ok = await idb.ok();
  flash(`<b>CALIBRATION ROUND ${cal.round}</b><small>do each trick ${REPS}× · Y after a good rep · N to redo · L checklist${ok ? '' : ' · storage blocked: export before closing'}</small>`);
}
async function saveFile(filename, data) {
  if (window.claude && window.claude.use) { try { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename, data: new Blob([data]) }); return true; } } catch (err) { if (err && err.code === 'declined') return 'declined'; } }
  else { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return true; } catch {} }
  return false;
}
async function exportData(kind) {
  await flushRun();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  let payload, filename;
  if (kind === 'session') {
    payload = { format: 'pro-whooper-session/1', build: '0.1', map: 'playground', camTilt: tune.camTilt, craft: { ...spec }, tune, cal, run: { id: run.id, started: run.started, round: run.round, hz: TRACE_HZ, cols: TRACE_COLS, trace: run.trace, events: run.events, labels: run.labels } };
    filename = `pro-whooper-session-r${cal.round}-${stamp}.json`;
  } else {
    const ex = await idb.all('examples'); payload = { format: 'pro-whooper-training/2', build: '0.1', map: 'playground', camTilt: tune.camTilt, tune, cal, examples: ex };
    filename = `pro-whooper-all-reps-${stamp}.json`;
  }
  const data = JSON.stringify(payload);
  const saved = await saveFile(filename, data);
  const mb = (data.length / 1e6).toFixed(1);
  if (saved === true) train.msg = `Saved ${filename} (${mb} MB). Send it to Claude.`;
  else { const ta = $('#trOut'); ta.value = data.length < 4e6 ? data : ''; ta.classList.toggle('hide', data.length >= 4e6); if (data.length < 4e6) ta.select();
    let copied = false; try { await navigator.clipboard.writeText(data); copied = true; } catch {}
    train.msg = copied ? `Copied ${mb} MB to the clipboard — paste it to Claude.` : `Couldn't save a file here. Open the standalone game file to export (${mb} MB).`; }
  renderTrain();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tr]');
  if (b) { e.stopPropagation(); const a = b.dataset.tr;
    if (a === 'yes') label('yes'); if (a === 'no') label('no'); if (a === 'undo') undoLast(); if (a === 'list') openChecklist();
    if (a === 'skip') setTarget(nextUnfinished(train.target && nameOf(train.target)));
    if (a === 'export') exportData('session'); if (a === 'exportAll') exportData('all');
    if (a === 'nextRound') { cal.round++; cal.reps = {}; cal.agree = {}; cal.misses = {}; saveCalib(); newRun(); setTarget(nextUnfinished()); flash(`<b>ROUND ${cal.round}</b><small>new round — same checklist, fresh reps</small>`); }
  }
  const pk = e.target.closest('[data-pick]'); if (pk) { const t = ALL_TRICKS().find(x => nameOf(x) === decodeURIComponent(pk.dataset.pick)); if (t) { setTarget(t); closeChecklist(); } }
  if (e.target.closest('[data-act="train"]')) startTraining();
  if (e.target.closest('[data-act="clclose"]')) closeChecklist();
});
document.addEventListener('change', e => {
  if (e.target.id === 'clOrder') { cal.order = e.target.value; saveCalib(); renderChecklist(); }
  if (e.target.id === 'trAs' && e.target.value) label('yes', e.target.value);
});
addEventListener('keydown', e => {
  if (!train.on || ask.open || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.code === 'KeyL') { if ($('#checklist').classList.contains('hide')) openChecklist(); else closeChecklist(); return; }
  if (mode !== 'fly') return;
  if (e.code === 'KeyY') label('yes'); if (e.code === 'KeyN') label('no'); if (e.code === 'KeyK') setTarget(nextUnfinished(train.target && nameOf(train.target))); if (e.code === 'KeyU') undoLast();
});
// log every detector verdict into the run, refresh the panel, flush to storage now and then
function trainOnEvent(ev) {
  if (train.on && run.id) run.events.push({ t: +drone.time.toFixed(3), name: ev.name, exec: ev.exec, clean: ev.clean, obstacle: ev.obstacle || null, near: ev.near || null, draft: !!ev.draft });
  if (ev.name === 'Crash') return;
  if (ev.name === 'near') askQueue({ kind: 'near', t: drone.time, text: ev.near }); else askQueue({ kind: 'trick', t: drone.time, name: ev.name, exec: ev.exec, obstacle: ev.obstacle });
}
let trainSeen = 0;
setInterval(() => {
  if (!train.on) return;
  if (run.events.length !== trainSeen) { trainSeen = run.events.length; renderTrain(); }
  if (performance.now() - run.lastFlush > 30000) flushRun();
}, 300);

// ============================================================ GitHub sync: upload calibration data to the project repo
// The token lives only in this browser (localStorage). It is never put in the game file or in exports.
// Use a fine-grained token limited to the one repo with "Contents: Read and write".
const gh = Object.assign({ owner: 'heyheykoolaid', repo: 'openprowhooper', branch: 'main', token: '', enabled: false, bbEnabled: false }, store.get('ghsync', {}));
const ghState = { queue: [], busy: false, last: '', ok: null };
const saveGh = () => store.set('ghsync', gh);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function b64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
async function ghFetch(path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}${path}`, { ...init, headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${gh.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers || {}) } });
  let body = null; try { body = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, body };
}
async function ghTest() {
  if (!gh.token) return 'Add a token first.';
  try { const r = await ghFetch(''); if (!r.ok) return r.status === 404 ? `Can't see ${gh.owner}/${gh.repo} — check the name, or give the token access to it.` : r.status === 401 ? 'Token rejected (expired or mistyped).' : `GitHub said ${r.status}.`;
    return r.body && r.body.permissions && r.body.permissions.push === false ? 'Connected, but this token can\'t write. Give it "Contents: Read and write".' : `Connected to ${gh.owner}/${gh.repo} ✓`; }
  catch (e) { return location.protocol.startsWith('http') && !location.hostname.endsWith('github.io') && !location.hostname.includes('localhost') ? 'This page isn\'t allowed to reach GitHub (the Claude preview blocks it). Use the standalone game file.' : 'Couldn\'t reach GitHub — are you online?'; }
}
function ghEnqueue(path, payload, message) { if (!gh.enabled || !gh.token) return false; ghState.queue.push({ path, content: JSON.stringify(payload), message, tries: 0 }); ghPump(); return true; }
async function ghPump() {
  if (ghState.busy || !ghState.queue.length) return; ghState.busy = true;
  const job = ghState.queue[0];
  try {
    const r = await ghFetch(`/contents/${job.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', body: JSON.stringify({ message: job.message, content: job.contentB64 || b64(job.content), branch: gh.branch }) });
    if (r.ok) { ghState.queue.shift(); ghState.ok = true; ghState.last = `↑ uploaded ${job.path.split('/').slice(-2).join('/')}`; if (job.path.startsWith('blackbox/') && !ghState.queue.some(j => j.path.startsWith('blackbox/'))) { bb.msg = 'Uploaded to GitHub ✓ — ask Claude to look at your Blackbox logs.'; renderBB(); } }
    else { job.tries++; ghState.ok = false; ghState.last = `upload failed (${r.status}${r.body && r.body.message ? ': ' + r.body.message : ''})`; if (job.tries >= 3 || r.status === 401 || r.status === 403 || r.status === 404) ghState.queue.shift(); }
  } catch { job.tries++; ghState.ok = false; ghState.last = 'upload failed (offline or blocked here)'; if (job.tries >= 3) ghState.queue.shift(); }
  ghState.busy = false; if (train.on) renderTrain(); renderGhStatus();
  if (ghState.queue.length) setTimeout(ghPump, ghState.ok ? 300 : 4000);
}
// one finished trick (5 reps): just those reps, with the flight around each one
function uploadTrick(name) {
  const labs = run.labels.filter(l => l.target === name && l.round === cal.round && !l.undone);
  if (!labs.length) return;
  const reps = labs.map(l => ({ ...l, trace: run.trace.filter(r => r[0] >= l.repStart - 2 && r[0] <= l.t + 1) }));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(`calibration/round-${cal.round}/${slug(name)}/${stamp}-${run.id}.json`,
    { format: 'pro-whooper-training/2', build: '0.1', map: 'playground', camTilt: tune.camTilt, craft: { ...spec }, tune, trick: name, round: cal.round,
      agreed: labs.filter(l => l.verdict === 'yes' && l.detected.includes(name)).length, examples: reps.map(r => ({ ...r, hz: TRACE_HZ, cols: TRACE_COLS })) },
    `calibration: ${name} ×${labs.filter(l => l.verdict === 'yes').length} (round ${cal.round})`);
}
function uploadRun(reason) {
  if (!run.id || !run.labels.length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(`calibration/round-${cal.round}/sessions/${stamp}-${run.id}.json`,
    { format: 'pro-whooper-session/1', build: '0.1', map: 'playground', camTilt: tune.camTilt, craft: { ...spec }, tune, calib: cal,
      run: { id: run.id, started: run.started, round: run.round, hz: TRACE_HZ, cols: TRACE_COLS, trace: run.trace, events: run.events, labels: run.labels } },
    `calibration session: ${run.labels.length} labels (${reason})`);
}
function renderGhStatus() { const el = $('#ghStatus'); if (el) el.textContent = !gh.enabled ? 'upload off (Options)' : gh.token ? (ghState.queue.length ? `uploading… (${ghState.queue.length} left)` : ghState.last || `ready → ${gh.owner}/${gh.repo}`) : 'not set up'; }
function openSync() { openOptions(); }
function openOptions() {
  show('#optionsScreen'); if (mode === 'fly') { mode = 'paused'; train.pausedForList = true; }
  $('#optBody').innerHTML = `
    <h3>Sound</h3>
    <label>Motor sound<input id="optVol" type="range" min="0" max="1" step="0.01" value="${store.get('vol', 0.35)}"></label>
    <label>Music<input id="optMusic" type="range" min="0" max="1" step="0.01" value="${music.el.volume}"></label>
    <h3>Sharing data with the project</h3>
    <label class="chk big"><input type="checkbox" id="ghEnabled" ${gh.enabled ? 'checked' : ''}> Upload calibration data to GitHub</label>
    <div class="optExplain">
      <p><b>What it does:</b> when you fly <i>Trick Calibration</i>, every rep you confirm is recorded — the flight path and rotations, your ✓/✗ labels, what the trick detector decided, and your craft and tune. With this on, those recordings are uploaded to the project repo <code>${gh.owner}/${gh.repo}</code> in the <code>calibration/</code> folder: one file each time a trick reaches 5 reps, and the whole session when a round is finished (or when you press ↑ Upload).</p>
      <p><b>Why:</b> so Claude can pull the data whenever you ask, replay your real flights through the detector, see where it disagrees with you, and tune the trick rules to how pilots actually fly.</p>
      <p><b>What's not sent:</b> no personal details, no radio or device info, and never your access token. Free flying and sessions outside calibration are never uploaded. Off by default — with it off, data stays in this browser and you can still export a file by hand.</p>
    </div>
    <label class="chk big"><input type="checkbox" id="bbEnabled" ${gh.bbEnabled ? 'checked' : ''}> Upload Blackbox logs to GitHub</label>
    <div class="optExplain">
      <p><b>What it does:</b> in <i>Blackbox Lab</i>, after you download the logs from your quad over USB (or pick log files from your computer), the ↑ Upload button sends them to <code>${gh.owner}/${gh.repo}</code> in the <code>blackbox/</code> folder — the raw log, your <code>diff all</code> settings, and the optional build sheet about your parts.</p>
      <p><b>Why:</b> Blackbox logs show exactly how your real quad responds to your sticks. Claude can replay them against the sim to fit the motor, prop, weight and drag numbers so the sim flies like your whoop.</p>
      <p><b>What's not sent:</b> nothing uploads until you press ↑ Upload; never your access token. The build sheet is optional.</p>
    </div>
    <div id="ghFields" class="${gh.enabled || gh.bbEnabled ? '' : 'hide'}">
      <label>Repo owner<input id="ghOwner" value="${gh.owner}"></label>
      <label>Repo name<input id="ghRepo" value="${gh.repo}"></label>
      <label>Branch<input id="ghBranch" value="${gh.branch}"></label>
      <label>Access token<input id="ghToken" type="password" autocomplete="off" placeholder="github_pat_…" value="${gh.token ? '••••••••' : ''}"></label>
      <div class="row"><button id="ghSave">Save &amp; test</button><button id="ghForget" class="ghost">Forget token</button></div>
      <p id="ghMsg" class="note">${gh.token ? '' : 'Add a token to start uploading.'}</p>
      <details><summary>How to make the token (2 minutes)</summary><ol class="bb">
        <li>On GitHub: Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
        <li>Repository access: <b>Only select repositories</b> → ${gh.owner}/${gh.repo}.</li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Nothing else.</li>
        <li>Set an expiry, generate, paste it here. It's kept in this browser only — never in the game file, exports or uploads.</li></ol></details>
      <p class="note">Uploading works from the standalone game file or a hosted copy. The preview inside Claude blocks connections to other sites.</p>
    </div>`;
}
document.addEventListener('change', e => {
  if (e.target.id === 'ghEnabled') { gh.enabled = e.target.checked; saveGh(); $('#ghFields').classList.toggle('hide', !(gh.enabled || gh.bbEnabled)); renderGhStatus(); }
  if (e.target.id === 'optVol') { store.set('vol', +e.target.value); if (window._master) window._master.gain.value = +e.target.value; const v = $('#vol'); if (v) v.value = e.target.value; }
});
document.addEventListener('input', e => { if (e.target.id === 'optMusic') { music.el.volume = +e.target.value; store.set('musicVol', music.el.volume); const m = $('#mVol'); if (m) m.value = e.target.value; } });
document.addEventListener('click', async e => {
  if (e.target.id === 'ghSave') {
    gh.owner = $('#ghOwner').value.trim(); gh.repo = $('#ghRepo').value.trim(); gh.branch = $('#ghBranch').value.trim() || 'main';
    const tk = $('#ghToken').value.trim(); if (tk && !/^•+$/.test(tk)) gh.token = tk; saveGh();
    $('#ghMsg').textContent = 'Testing…'; $('#ghMsg').textContent = await ghTest(); renderGhStatus();
  }
  if (e.target.id === 'ghForget') { gh.token = ''; saveGh(); $('#ghToken').value = ''; $('#ghMsg').textContent = 'Token removed from this browser.'; renderGhStatus(); }
  if (e.target.closest('[data-act="sync"]') || e.target.closest('[data-act="options"]')) openOptions();
  if (e.target.closest('[data-act="optclose"]')) { if (train.pausedForList) closeChecklist(); else show(mode === 'menu' ? '#mainMenu' : '#pause'); }
  const b = e.target.closest('[data-tr="upload"]'); if (b) { if (!gh.enabled || !gh.token) openOptions(); else { uploadRun('manual'); train.msg = 'Uploading this session…'; renderTrain(); } }
});

// ============================================================ Blackbox Lab: USB dump of the flight controller's log flash
// Talks Betaflight's MSP protocol over Web Serial (Chrome/Edge desktop), like Betaflight Configurator does.
const MSP = { API_VERSION: 1, FC_VARIANT: 2, FC_VERSION: 3, BOARD_INFO: 4, NAME: 10, DATAFLASH_SUMMARY: 70, DATAFLASH_READ: 71 };
class MspPort {
  constructor(port) { this.port = port; this.buf = []; this.waiters = []; this.text = ''; this.textMode = false; }
  async open() {
    await this.port.open({ baudRate: 115200, bufferSize: 65536 });
    this.writer = this.port.writable.getWriter(); this.reader = this.port.readable.getReader(); this.reading = this.readLoop();
  }
  async readLoop() {
    try { for (;;) { const { value, done } = await this.reader.read(); if (done) break; if (!value) continue;
      if (this.textMode) { this.text += new TextDecoder().decode(value); continue; }
      for (const b of value) this.buf.push(b); this.parse(); } } catch {}
  }
  parse() {
    for (;;) {
      const i = this.buf.indexOf(0x24); if (i < 0) { this.buf.length = 0; return; } if (i > 0) this.buf.splice(0, i);
      if (this.buf.length < 6) return;
      if (this.buf[1] !== 0x4d || (this.buf[2] !== 0x3e && this.buf[2] !== 0x21)) { this.buf.shift(); continue; }
      let size = this.buf[3], cmd = this.buf[4], hdr = 5, ck = size ^ cmd;
      if (size === 255) { if (this.buf.length < 7) return; size = this.buf[5] | (this.buf[6] << 8); ck ^= this.buf[5] ^ this.buf[6]; hdr = 7; } // jumbo frame
      if (this.buf.length < hdr + size + 1) return;
      const payload = this.buf.slice(hdr, hdr + size); for (const b of payload) ck ^= b;
      const okSum = ck === this.buf[hdr + size], err = this.buf[2] === 0x21;
      this.buf.splice(0, hdr + size + 1);
      const w = this.waiters.findIndex(x => x.cmd === cmd);
      if (w >= 0) { const x = this.waiters.splice(w, 1)[0]; if (!okSum) x.reject(new Error('checksum')); else if (err) x.reject(new Error('flight controller rejected command ' + cmd)); else x.resolve(new Uint8Array(payload)); }
    }
  }
  async send(cmd, data = [], timeout = 1500) {
    const bytes = [0x24, 0x4d, 0x3c, data.length, cmd, ...data]; let ck = data.length ^ cmd; for (const b of data) ck ^= b; bytes.push(ck);
    const p = new Promise((resolve, reject) => { const x = { cmd, resolve, reject }; this.waiters.push(x); setTimeout(() => { const i = this.waiters.indexOf(x); if (i >= 0) { this.waiters.splice(i, 1); reject(new Error('timeout')); } }, timeout); });
    await this.writer.write(new Uint8Array(bytes)); return p;
  }
  async cli(command, quietMs = 1200, maxMs = 15000) {   // enter the CLI, run one command, capture the text
    this.textMode = true; this.text = '';
    const enc = s => new TextEncoder().encode(s);
    await this.writer.write(enc('#')); await sleep(400); this.text = '';
    await this.writer.write(enc(command + '\n'));
    const t0 = performance.now(); let last = this.text.length, quietSince = performance.now();
    while (performance.now() - t0 < maxMs) { await sleep(100); if (this.text.length !== last) { last = this.text.length; quietSince = performance.now(); } else if (performance.now() - quietSince > quietMs && this.text.length) break; }
    const out = this.text; try { await this.writer.write(enc('exit\n')); } catch {}   // leaving the CLI reboots the FC
    return out.replace(/^.*?\n/, '').replace(/\n#\s*$/, '').trim();
  }
  async close() { try { this.reader.cancel(); } catch {} try { this.reader.releaseLock(); } catch {} try { this.writer.releaseLock(); } catch {} try { await this.port.close(); } catch {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const u32 = (a, o) => (a[o] | (a[o + 1] << 8) | (a[o + 2] << 16) | (a[o + 3] << 24)) >>> 0;
const u16 = (a, o) => a[o] | (a[o + 1] << 8);
const bb = { msp: null, info: null, flash: null, log: null, diff: null, busy: false, msg: '', progress: 0, files: [] };
async function bbConnect() {
  if (!('serial' in navigator)) { bb.msg = 'This browser can\'t talk to USB devices here. Use Chrome or Edge on a computer, with the standalone game file — the preview inside Claude blocks USB.'; renderBB(); return; }
  try {
    const port = await navigator.serial.requestPort(); bb.msp = new MspPort(port); await bb.msp.open(); await sleep(300);
    const api = await bb.msp.send(MSP.API_VERSION), variant = await bb.msp.send(MSP.FC_VARIANT), ver = await bb.msp.send(MSP.FC_VERSION);
    let board = null, name = ''; try { board = await bb.msp.send(MSP.BOARD_INFO); } catch {} try { name = new TextDecoder().decode(await bb.msp.send(MSP.NAME)); } catch {}
    bb.info = { api: `${api[1]}.${api[2]}`, firmware: String.fromCharCode(...variant), version: `${ver[0]}.${ver[1]}.${ver[2]}`, board: board ? String.fromCharCode(...board.slice(0, 4)) : '', craftName: name.trim() };
    const s = await bb.msp.send(MSP.DATAFLASH_SUMMARY);
    bb.flash = { ready: !!(s[0] & 1), supported: !!(s[0] & 2), sectors: u32(s, 1), total: u32(s, 5), used: u32(s, 9) };
    bb.msg = bb.flash.supported ? (bb.flash.used ? `Found ${(bb.flash.used / 1048576).toFixed(2)} MB of logs.` : 'The log flash is empty — go fly with Blackbox on, then come back.') : 'This flight controller has no onboard log flash (it may log to an SD card — upload those files below).';
  } catch (e) { bb.msg = /No port selected/.test(String(e)) ? 'No device picked.' : `Couldn't talk to the flight controller (${e.message || e}). Close Betaflight Configurator if it's open, replug the quad, and try again.`; if (bb.msp) await bb.msp.close(); bb.msp = null; }
  renderBB();
}
async function bbDownload() {
  if (!bb.msp || !bb.flash || !bb.flash.used || bb.busy) return;
  bb.busy = true; bb.progress = 0; bb.msg = 'Downloading logs… keep the quad plugged in.'; renderBB();
  const total = bb.flash.used, out = new Uint8Array(total); let addr = 0, block = 4096, fails = 0; const t0 = performance.now();
  while (addr < total) {
    const want = Math.min(block, total - addr);
    try {
      const r = await bb.msp.send(MSP.DATAFLASH_READ, [addr & 255, (addr >> 8) & 255, (addr >> 16) & 255, (addr >>> 24) & 255, want & 255, want >> 8, 0], 2500);
      const a = u32(r, 0); const n = u16(r, 4), comp = r[6];
      if (a !== addr || comp !== 0) throw new Error('unexpected reply');
      if (n === 0) break;
      out.set(r.subarray(7, 7 + n), addr); addr += n; fails = 0;
      bb.progress = addr / total; if ((addr / block) % 16 === 0) renderBB();
    } catch (e) { if (++fails > 6) { bb.msg = `Download stopped at ${(addr / 1048576).toFixed(2)} MB (${e.message}). Replug and try again.`; bb.busy = false; renderBB(); return; } if (fails > 2) block = Math.max(256, block >> 1); await sleep(100); }
  }
  bb.log = out.subarray(0, addr); bb.busy = false; bb.progress = 1;
  bb.msg = `Downloaded ${(addr / 1048576).toFixed(2)} MB in ${((performance.now() - t0) / 1000).toFixed(0)} s.`;
  renderBB();
}
async function bbDiff() {
  if (!bb.msp || bb.busy) return; bb.busy = true; bb.msg = 'Reading diff all… (the quad reboots afterwards)'; renderBB();
  try { bb.diff = await bb.msp.cli('diff all'); bb.msg = `Read ${bb.diff.split('\n').length} lines of settings. The flight controller is rebooting — reconnect to download more.`;
    const r = S.importDiff(bb.diff, tune); if (r.found.length) bb.msg += ` (${r.found.length} rates/PID settings recognised — apply them in Garage → Tune.)`; }
  catch (e) { bb.msg = `Couldn't read the settings (${e.message || e}).`; }
  await bb.msp.close(); bb.msp = null; bb.busy = false; renderBB();
}
function bbBaseName() { const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); const nm = (bb.info && (bb.info.craftName || bb.info.board)) || spec.frame; return `${d}-${slug(nm || 'whoop')}`; }
async function bbSaveLocal() {
  const base = bbBaseName(); const files = [];
  if (bb.log) files.push({ name: base + '.bbl', data: new Blob([bb.log]) }); if (bb.diff) files.push({ name: base + '-diff.txt', data: new Blob([bb.diff]) });
  for (const f of files) {
    try { if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: f.name }); const w = await h.createWritable(); await w.write(f.data); await w.close(); continue; } } catch (e) { if (e && e.name === 'AbortError') continue; }
    const ok = await saveFile(f.name, f.data); if (!ok) bb.msg = 'Saving files is blocked in this view — use the standalone game file.';
  }
  renderBB();
}
// ---- optional build questionnaire (sent with the upload; pre-filled from the Garage)
function questionnaire() {
  const P = S.PARTS, q = store.get('buildSheet', {});
  const v = (k, d) => q[k] ?? d ?? '';
  return `<details class="qs" ${store.get('buildSheetOpen', true) ? 'open' : ''}><summary>About this quad <small>(optional — helps tune the sim to your real build)</small></summary>
    <div class="grid2">
      <label>Model / kit<input data-q="model" value="${v('model', Object.keys(S.PRESETS).find(k => JSON.stringify(S.PRESETS[k]) === JSON.stringify(spec)) || '')}" placeholder="e.g. Air65 Racing"></label>
      <label>Frame<input data-q="frame" value="${v('frame', P.frames[spec.frame].name)}"></label>
      <label>Motors (model + KV)<input data-q="motors" value="${v('motors', P.motors[spec.motor].name)}"></label>
      <label>Props (model, blades, mm)<input data-q="props" value="${v('props', P.props[spec.prop].name)}"></label>
      <label>Prop condition<select data-q="propCond">${['new', 'a few packs', 'worn / chipped', 'not sure'].map(o => `<option ${v('propCond', 'not sure') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>Battery (mAh, type, brand)<input data-q="battery" value="${v('battery', P.batteries[spec.battery].name)}"></label>
      <label>Connector<select data-q="connector">${['BT2.0', 'PH2.0', 'A30', 'GNB27', 'other'].map(o => `<option ${v('connector', 'BT2.0') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>All-up weight with battery (g)<input data-q="auw" type="number" step="0.1" value="${v('auw', '')}" placeholder="weigh it if you can"></label>
      <label>Camera + angle<input data-q="camera" value="${v('camera', 'C03 · ' + tune.camTilt + '°')}"></label>
      <label>AIO / flight controller<input data-q="aio" value="${v('aio', bb.info ? bb.info.board : '')}"></label>
      <label>Where you flew<select data-q="where">${['indoors', 'outdoors', 'both'].map(o => `<option ${v('where', 'indoors') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>Any mods?<input data-q="mods" value="${v('mods', '')}" placeholder="e.g. lighter canopy, ducts trimmed"></label>
    </div>
    <label>Anything that felt different from the sim?<textarea data-q="notes" placeholder="e.g. real quad drops faster in powerloops; sim feels floaty">${v('notes', '')}</textarea></label>
    </details>`;
}
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.q; if (k) { const q = store.get('buildSheet', {}); q[k] = e.target.value; store.set('buildSheet', q); } });
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('qs')) store.set('buildSheetOpen', e.target.open); }, true);
function bbUpload(extraFiles) {
  if (!gh.bbEnabled || !gh.token) { openOptions(); return; }
  const base = bbBaseName(), sheet = store.get('buildSheet', {});
  const meta = { format: 'pro-whooper-blackbox/1', uploaded: new Date().toISOString(), fc: bb.info, flash: bb.flash, gameCraft: { ...spec, names: params.names }, gameTune: tune, buildSheet: Object.keys(sheet).length ? sheet : null, files: [] };
  const put = (name, bytes, msg) => { meta.files.push(name); ghState.queue.push({ path: `blackbox/${base}/${name}`, contentB64: bytesB64(bytes), message: msg, tries: 0 }); };
  if (bb.log) put(base + '.bbl', bb.log, `blackbox: ${base}.bbl (${(bb.log.length / 1048576).toFixed(2)} MB)`);
  if (bb.diff) put('diff-all.txt', new TextEncoder().encode(bb.diff), `blackbox: ${base} diff all`);
  for (const f of extraFiles || []) put(f.name, f.bytes, `blackbox: ${base}/${f.name}`);
  if (!meta.files.length) { bb.msg = 'Nothing to upload yet — download from the quad or pick log files first.'; renderBB(); return; }
  ghState.queue.push({ path: `blackbox/${base}/build.json`, contentB64: bytesB64(new TextEncoder().encode(JSON.stringify(meta, null, 2))), message: `blackbox: ${base} build sheet`, tries: 0 });
  bb.msg = `Uploading ${meta.files.length} file${meta.files.length > 1 ? 's' : ''} to ${gh.owner}/${gh.repo}/blackbox/${base}/…`; renderBB(); ghPump();
}
function bytesB64(bytes) { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function renderBB() {
  const el = $('#bbBody'); if (!el) return;
  const c = !!bb.msp, f = bb.flash;
  el.innerHTML = `
    <p>Plug your whoop into this computer over USB (no battery needed). Close Betaflight Configurator first — only one program can talk to the quad at a time.</p>
    <div class="row"><button id="bbConnect" ${c ? 'disabled' : ''}>${c ? 'Connected' : '1 · Connect over USB'}</button>
      <button id="bbDownload" ${c && f && f.used && !bb.busy ? '' : 'disabled'}>2 · Download logs</button>
      <button id="bbDiff" ${c && !bb.busy ? '' : 'disabled'}>3 · Read diff all</button></div>
    ${bb.info ? `<div class="dev"><b>${bb.info.craftName || 'Flight controller'}</b><span>${bb.info.firmware} ${bb.info.version} · board ${bb.info.board || '?'} · MSP ${bb.info.api}${f ? ` · log flash ${(f.used / 1048576).toFixed(2)} / ${(f.total / 1048576).toFixed(1)} MB used` : ''}</span></div>` : ''}
    ${bb.busy || bb.progress ? `<div class="trProg"><i style="width:${(bb.progress * 100).toFixed(1)}%"></i></div>` : ''}
    ${bb.msg ? `<p class="trMsg">${bb.msg}</p>` : ''}
    <h3>Already have log files?</h3>
    <p class="note">Pick .bbl / .bfl / .bbs files (from Betaflight Configurator, an SD card, or the flash in mass-storage mode) and a diff as .txt.</p>
    <input type="file" id="bbFiles" multiple accept=".bbl,.bfl,.bbs,.txt,.csv">${bb.files.length ? ` <span class="note">${bb.files.map(x => x.name).join(', ')}</span>` : ''}
    ${questionnaire()}
    <div class="row"><button id="bbSave" ${bb.log || bb.diff ? '' : 'disabled'}>Save to this computer</button>
      <button id="bbUpload" ${bb.log || bb.diff || bb.files.length ? '' : 'disabled'}>↑ Upload to GitHub</button><span id="ghStatus" class="ghs"></span></div>
    <p class="note">${gh.bbEnabled && gh.token ? `Uploads go to <code>${gh.owner}/${gh.repo}/blackbox/</code>.` : 'GitHub upload is off — turn on "Upload Blackbox logs" in Options.'} Downloading doesn't erase anything on the quad.</p>`;
  renderGhStatus();
}
document.addEventListener('click', e => {
  if (e.target.id === 'bbConnect') bbConnect(); if (e.target.id === 'bbDownload') bbDownload(); if (e.target.id === 'bbDiff') bbDiff();
  if (e.target.id === 'bbSave') bbSaveLocal(); if (e.target.id === 'bbUpload') bbUpload(bb.files);
  if (e.target.closest('[data-act="blackbox"]')) setTimeout(renderBB, 0);
});
document.addEventListener('change', async e => {
  if (e.target.id === 'bbFiles') { bb.files = await Promise.all([...e.target.files].map(async f => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))); renderBB(); }
  if (e.target.id === 'bbEnabled') { gh.bbEnabled = e.target.checked; saveGh(); $('#ghFields').classList.toggle('hide', !(gh.enabled || gh.bbEnabled)); }
});

// ============================================================ trick pause mode (dev): after a trick, pause and ask "was that X?"
const ask = { on: store.get('pauseAsk', false), pending: [], open: false, lastResolved: 0, askedToks: new WeakSet(), rows: [] };
function askQueue(item) { if (!(train.on && ask.on)) return; ask.pending.push(item); }
// batch: wait until the detector has settled (combo finished) before pausing
setInterval(() => {
  if (!(train.on && ask.on) || ask.open || mode !== 'fly') return;
  // big rotation nobody claimed → "what was that?"
  const det = detector, now = det.time;
  for (const k of det.toks || []) if (k.raw >= 300 && now - k.t1 > 1.3 && k.usedUntil < k.t1 - 0.1 && !ask.askedToks.has(k) && drone.armed && !drone.crashed) {
    ask.askedToks.add(k); ask.pending.push({ kind: 'unknown', t: drone.time, rot: `${k.ax === 'P' ? (k.dir > 0 ? 'back' : 'forward') + ' flip' : k.ax === 'R' ? (k.dir > 0 ? 'right' : 'left') + ' roll' : (k.dir > 0 ? 'right' : 'left') + ' yaw'} of about ${Math.round(k.raw / 90) * 90}°` });
  }
  if (!ask.pending.length || det.busy()) return;
  const lastT = Math.max(...ask.pending.map(p => p.t)); if (drone.time - lastT < 0.45) return;
  openAsk();
}, 120);
function openAsk() {
  ask.open = true; ask.rows = ask.pending.splice(0); mode = 'paused';
  const opts = ALL_TRICKS().map(x => `<option>${nameOf(x)}</option>`).join('');
  $('#askBody').innerHTML = `<h2>Was that…</h2>` + ask.rows.map((r, i) => r.kind === 'trick'
      ? `<div class="askRow" data-i="${i}"><b>${r.name}</b>${r.obstacle ? ` <small>on ${r.obstacle}</small>` : ''} <small class="ex ${r.exec}">${r.exec}</small>
          <span class="askBtns"><button data-ask="yes" data-i="${i}" class="sel">✓ Yes</button><button data-ask="no" data-i="${i}">✗ No, it was…</button></span>
          <select data-askfix="${i}" class="hide"><option value="">pick the trick (or leave blank if it wasn't a trick)</option>${opts}</select></div>`
      : `<div class="askRow" data-i="${i}"><b>${r.kind === 'near' ? r.text : `Unrecognised: ${r.rot}`}</b>
          <span class="askBtns"><select data-askfix="${i}"><option value="">${r.kind === 'near' ? 'it was…' : 'what was it?'} (leave blank if nothing)</option>${opts}</select></span></div>`).join('') +
    `<div class="row"><button id="askDone">Continue <kbd>Enter</kbd></button><button id="askSkip" class="ghost">Skip — don't save <kbd>Esc</kbd></button></div>
     <p class="note">Y = all correct · Enter = save &amp; continue · answers are saved with the flight recording${gh.enabled && gh.token ? ' and uploaded' : ''}.</p>`;
  ask.rows.forEach(r => { if (r.kind === 'trick') r.answer = 'yes'; });
  $('#askBox').classList.remove('hide');
}
function closeAsk(save) {
  if (save) for (const r of ask.rows) {
    const repStart = Math.max(ask.lastResolved, r.t - 5);
    const base = { repStart, t: r.t, obstacle: r.obstacle || null, round: cal.round, via: 'pause-ask', detected: r.kind === 'trick' ? [r.name] : [], toks: '', cross: '', near: r.kind === 'near' ? r.text : null };
    const push = lab => { run.labels.push(lab); idb.put('examples', { id: run.id + '#' + run.labels.length, run: run.id, ...lab, craft: { ...spec }, hz: TRACE_HZ, cols: TRACE_COLS, trace: trace.slice(-TRACE_LEN) }); };
    const addRep = n => { if (repsOf(n) < REPS) { cal.reps[n] = repsOf(n) + 1; if (r.kind === 'trick' && r.name === n) cal.agree[n] = (cal.agree[n] || 0) + 1; else cal.misses[n] = (cal.misses[n] || 0) + 1; } };
    if (r.kind === 'trick' && r.answer === 'yes') { push({ ...base, target: r.name, prompted: r.name, verdict: 'yes', rep: repsOf(r.name) + 1 }); addRep(r.name); }
    else if (r.kind === 'trick') { push({ ...base, target: r.name, prompted: r.name, verdict: 'no' }); if (r.fix) { push({ ...base, target: r.fix, prompted: r.name, verdict: 'yes', rep: repsOf(r.fix) + 1 }); addRep(r.fix); } }
    else if (r.fix) { push({ ...base, target: r.fix, prompted: '(unrecognised)', verdict: 'yes', rep: repsOf(r.fix) + 1 }); addRep(r.fix); }
    else push({ ...base, target: '(no trick)', prompted: '(unrecognised)', verdict: 'yes' });
  }
  if (save) { saveCalib(); flushRun(); }
  ask.lastResolved = drone.time; ask.open = false; ask.rows = [];
  $('#askBox').classList.add('hide'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  resume(); renderTrain();
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-ask]'); if (a) { const i = +a.dataset.i, r = ask.rows[i]; r.answer = a.dataset.ask;
    a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b === a)); const s = document.querySelector(`[data-askfix="${i}"]`); if (s) s.classList.toggle('hide', r.answer !== 'no'); }
  if (e.target.id === 'askDone') closeAsk(true); if (e.target.id === 'askSkip') closeAsk(false);
  if (e.target.closest('[data-tr="pauseask"]')) { ask.on = !ask.on; store.set('pauseAsk', ask.on); renderTrain(); flash(`<b>PAUSE &amp; ASK ${ask.on ? 'ON' : 'OFF'}</b><small>${ask.on ? 'the game pauses after each trick to ask if it got it right' : ''}</small>`); }
});
document.addEventListener('change', e => { const i = e.target.dataset && e.target.dataset.askfix; if (i !== undefined) ask.rows[+i].fix = e.target.value || null; });
addEventListener('keydown', e => {
  if (ask.open) { if (e.target.tagName === 'SELECT') return; e.stopImmediatePropagation(); e.preventDefault();
    if (e.code === 'KeyY') { ask.rows.forEach(r => { if (r.kind === 'trick') r.answer = 'yes'; }); closeAsk(true); }
    else if (e.code === 'Enter') closeAsk(true); else if (e.code === 'Escape') closeAsk(false); return; }
  if (train.on && mode === 'fly' && e.code === 'KeyP' && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { ask.on = !ask.on; store.set('pauseAsk', ask.on); renderTrain(); }
}, true);
window.__pw.ask = ask; window.__pw.run = run; window.__pw.mode = () => mode;
