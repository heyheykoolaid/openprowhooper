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
// ---- the pilot's own pieces (assets/graffiti/, drawn by heyheykoolaid): HeyHey KoolAid, Clappy, RWDC
const ART = {};
async function loadArt() {
  await Promise.all((window.PW_ART || []).map(a => new Promise(res => { const im = new Image(); im.onload = () => { ART[a.name] = im; res(); }; im.onerror = () => res(); im.src = a.src; })));
}
function sprayArt(g, im, cx, cy, hPx, rot) {
  const w = hPx * im.width / im.height; g.save(); g.translate(cx, cy); g.rotate(rot);
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(0, 0, w * 0.56, hPx * 0.56, 0, 0, 7); g.fill();   // buffed patch
  g.globalCompositeOperation = 'source-over'; g.shadowColor = 'rgba(10,10,10,0.45)'; g.shadowBlur = Math.max(2, hPx * 0.025);       // overspray
  g.globalAlpha = 0.95; g.drawImage(im, -w / 2, -hPx / 2, w, hPx); g.shadowBlur = 0; g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';                                                                                  // wear
  for (let i = 0, n = w * hPx / 260; i < n; i++) { g.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.45})`; const s = 1 + rnd() * 2.5; g.fillRect((rnd() - 0.5) * w, (rnd() - 0.5) * hPx, s, s); }
  g.restore();
}
let artTurn = 0;
function graffitiTexture(wM, hM, density = 1, opts = {}) {
  const ppm = opts.ppm || 64; const W = Math.min(4096, Math.round(wM * ppm)), H = Math.min(2048, Math.round(hM * ppm));
  const [c, g] = cnv(W, H);
  const n = Math.max(1, Math.round(wM / 6 * density));
  const sx = W / wM, sy = H / hM;
  // pieces of the pilot's own art get their own spot on the wall: words are painted around them, not under them
  const artBoxes = (opts.art || []).filter(a => ART[a.name]).map(a => { const im = ART[a.name], hp = a.h * sy, wp = hp * im.width / im.height; return { x0: a.x * W - wp * 0.62, x1: a.x * W + wp * 0.62, y0: H - a.y * sy - hp * 0.62, y1: H - a.y * sy + hp * 0.62 }; });
  const clash = (x, y, s, word) => { const hw = s * word.length * 0.3; return artBoxes.some(b => x + hw > b.x0 && x - hw < b.x1 && y + s * 0.6 > b.y0 && y - s * 0.6 < b.y1); };
  for (let i = 0; i < n; i++) {
    const word = GRAF_WORDS[(rnd() * GRAF_WORDS.length) | 0], pal = GRAF_PAL[(rnd() * GRAF_PAL.length) | 0];
    const size = (0.6 + rnd() * 0.9) * sy * (opts.big || 1);
    const yM = opts.top ? hM * 0.5 : Math.min(hM - 0.8, 0.9 + rnd() * 1.6);
    const x = (i + 0.5 + (rnd() - 0.5) * 0.6) * W / n, y = H - yM * sy;
    if (!clash(x, y, size, word)) bubble(g, word, x, y, size, pal, (rnd() - 0.5) * 0.15);
  }
  for (let i = 0; i < n * 5; i++) tag(g, rnd() * W, H - (0.3 + rnd() * 2.2) * sy, (0.15 + rnd() * 0.25) * sy, ['#111', '#e8e8e8', '#d23', '#2ad', '#fd3'][(rnd() * 5) | 0]);
  if (opts.stencil) stencil(g, W * 0.1, H - 2.4 * sy, 0.45 * sy, opts.stencil);
  if (opts.heaven) bubble(g, 'OPEN PRO WHOOPER', W * 0.5, H * 0.18, H * 0.14, ['#ffe14a', '#ff3d2e', '#111'], -0.03);
  for (const a of opts.art || []) if (ART[a.name]) sprayArt(g, ART[a.name], a.x * W, H - a.y * sy, a.h * sy, a.rot || 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ============================================================ materials & geometry helpers
const MAT = {};
// ---- the vaporwave school's look: pastel concrete, chrome that mirrors the sunset, glowing acrylic and neon, CRT static
function vaporMats() {
  let c, g;
  // the infinite grid floor (one 2 m cell per tile) and its glow
  for (const glow of [false, true]) { [c, g] = cnv(256, 256); g.fillStyle = glow ? '#000' : '#160a36'; g.fillRect(0, 0, 256, 256);
    if (!glow) { const rg = g.createRadialGradient(128, 128, 20, 128, 128, 180); rg.addColorStop(0, 'rgba(90,40,150,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 256); }
    g.shadowBlur = glow ? 10 : 6; for (const [col, w] of [['#ff4fd8', 5], ['#7df9ff', 2]]) { g.strokeStyle = col; g.shadowColor = col; g.lineWidth = w; g.strokeRect(0, 0, 256, 256); }
    TX[glow ? 'vGridE' : 'vGrid'] = tex(c); }
  [c, g] = cnv(256, 256); g.fillStyle = '#d9cdf2'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 5000, ['#c7b8ea', '#eadcff', '#bfaee0']); g.strokeStyle = 'rgba(255,120,220,0.5)'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256); TX.vTile = tex(c);
  [c, g] = cnv(256, 256); for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#9fe9d2' : '#f2b6dc'; g.fillRect(x * 128, y * 128, 128, 128); } speckle(g, 256, 256, 6000, ['rgba(255,255,255,0.25)', 'rgba(60,30,90,0.12)']); TX.vChecker = tex(c);
  [c, g] = cnv(128, 128); const id = g.createImageData(128, 128); for (let i = 0; i < id.data.length; i += 4) { const v = 40 + Math.floor(rnd() * 200), row = (i / 4 / 128 | 0) % 3 === 0 ? 0.55 : 1; id.data[i] = v * 0.75 * row; id.data[i + 1] = v * row; id.data[i + 2] = Math.min(255, v * 1.15) * row; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); TX.crt = tex(c);
  [c, g] = cnv(256, 256); g.fillStyle = '#f4f0fa'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 7000, ['#ffffff', '#e6dff2', '#ded4ee']); TX.vPlaster = tex(c);   // smooth painted concrete: clean, so the pastels stay pastel
  const P = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, map: TX.vPlaster, roughness: 0.78, metalness: 0.02, ...o });
  MAT.vConcrete = P(0xd8cdf0); MAT.vLav = P(0xb9a2f5); MAT.vPink = P(0xf7a8d2); MAT.vMint = P(0xa4f0d4);
  MAT.vRubber = new THREE.MeshStandardMaterial({ color: 0x86ecd0, roughness: 1 });
  MAT.marble = new THREE.MeshStandardMaterial({ color: 0xf7f1ff, roughness: 0.32, metalness: 0.04 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.3 });
  MAT.acrylic = new THREE.MeshStandardMaterial({ color: 0xa6f4ff, transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.25, emissive: 0x39d2ff, emissiveIntensity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  for (const [k, hex] of [['neonPink', 0xff3fd0], ['neonCyan', 0x55f6ff], ['neonPurple', 0xb26bff], ['neonYellow', 0xfff36a]]) MAT[k] = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  MAT.crt = new THREE.MeshBasicMaterial({ map: TX.crt, toneMapped: false });
  MAT.vPlaza = new THREE.MeshStandardMaterial({ map: TX.vTile, color: 0xb9a9e8, roughness: 0.7, metalness: 0.05 });
  MAT.vRubberFloor = new THREE.MeshStandardMaterial({ map: TX.vChecker, roughness: 1 });
  MAT.vChromeFloor = new THREE.MeshStandardMaterial({ map: TX.vTile, color: 0xcfc2ff, roughness: 0.12, metalness: 0.92, envMapIntensity: 1.1 });
  MAT.vGrid = new THREE.MeshStandardMaterial({ map: TX.vGrid, emissiveMap: TX.vGridE, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.25 });
}
function vaporBackdrop() {
  // sky: indigo overhead, magenta, then a hot pink-orange band at the horizon
  const stops = [[0, '#0d0530'], [0.3, '#35107a'], [0.44, '#a4288f'], [0.5, '#ff5fa2'], [0.535, '#ffb07a'], [0.56, '#5a1f7a'], [1, '#12063a']];
  const [sc, sg] = cnv(16, 512), gr = sg.createLinearGradient(0, 0, 0, 512); for (const [o, c] of stops) gr.addColorStop(o, c); sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512);
  const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  playRoot.add(new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })));
  // what the chrome reflects: the same sky with the sun in it
  const [ec, eg] = cnv(256, 128), eg2 = eg.createLinearGradient(0, 0, 0, 128); for (const [o, c] of stops) eg2.addColorStop(o, c); eg.fillStyle = eg2; eg.fillRect(0, 0, 256, 128);
  const sunG = eg.createRadialGradient(150, 60, 2, 150, 60, 34); sunG.addColorStop(0, '#fff6b0'); sunG.addColorStop(0.4, '#ff8fc0'); sunG.addColorStop(1, 'rgba(255,80,170,0)'); eg.fillStyle = sunG; eg.fillRect(0, 0, 256, 128);
  const envT = new THREE.CanvasTexture(ec); envT.colorSpace = THREE.SRGBColorSpace; envT.mapping = THREE.EquirectangularReflectionMapping; scene.environment = envT;
  scene.fog = new THREE.Fog(0x6b2a90, 45, 230);
  // the sun: a striped disc sitting on the horizon behind the hall
  const [uc, ug] = cnv(256, 256), ugr = ug.createLinearGradient(0, 0, 0, 256); ugr.addColorStop(0, '#fff47c'); ugr.addColorStop(0.55, '#ff8a5c'); ugr.addColorStop(1, '#ff2fa6'); ug.fillStyle = ugr; ug.beginPath(); ug.arc(128, 128, 126, 0, 7); ug.fill();
  ug.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 7; i++) { const y = 138 + i * 17; ug.fillRect(0, y, 256, 3 + i * 1.6); }
  const sunDir = new THREE.Vector3(-0.5, 0.115, -0.86).normalize(), sunM = new THREE.Mesh(new THREE.CircleGeometry(62, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(uc), transparent: true, fog: false, toneMapped: false, depthWrite: false }));
  sunM.material.map.colorSpace = THREE.SRGBColorSpace; sunM.position.copy(sunDir).multiplyScalar(290); sunM.lookAt(0, 20, 0); sunM.layers.enable(1); playRoot.add(sunM);
  // low, permanent sunset light with long shadows; a cool rim light from the other side keeps silhouettes readable
  playRoot.add(new THREE.HemisphereLight(0xffb0e0, 0x6a4fb8, 1.35));
  const sun = new THREE.DirectionalLight(0xffa6cf, 2.5); sun.position.copy(sunDir).multiplyScalar(70); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sh = sun.shadow.camera; sh.left = -46; sh.right = 46; sh.top = 46; sh.bottom = -46; sh.near = 1; sh.far = 190; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; playRoot.add(sun); playRoot.add(sun.target);
  const rim = new THREE.DirectionalLight(0x66e6ff, 0.75); rim.position.set(30, 18, 40); playRoot.add(rim);
  // the grid floor, out to the fog
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), MAT.vGrid); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; gnd.renderOrder = -10; const guv = gnd.geometry.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 350, guv.getY(i) * 350); playRoot.add(gnd);
  // wireframe mountains on the horizon
  const fill = new THREE.MeshBasicMaterial({ color: 0x1a0b3f, fog: false }), edge = [new THREE.LineBasicMaterial({ color: 0xff4fd8, fog: false }), new THREE.LineBasicMaterial({ color: 0x66f0ff, fog: false })];
  for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2 + rnd() * 0.1, R = 205 + rnd() * 60, h = 10 + rnd() * 30, r = 20 + rnd() * 26, geo = new THREE.ConeGeometry(r, h, 4, 1), m = new THREE.Mesh(geo, fill);
    m.position.set(Math.cos(a) * R, h / 2 - 0.5, Math.sin(a) * R); m.rotation.y = rnd() * 1.5; const ln = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge[i % 2]); ln.layers.enable(1); m.add(ln); playRoot.add(m); }
}
// ---- neon glow (bloom) for the vaporwave map. The normal picture is drawn as always; then everything is drawn again
// small and black with only the glowing pieces lit (so glow never leaks through walls), blurred at two sizes, and added
// on top. Options has a switch for slower machines.
const BLOOM = { on: store.get('bloom', true), ready: false };
function bloomInit() {
  const rt = depth => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: depth });
  Object.assign(BLOOM, { src: rt(true), a: rt(false), b: rt(false), c: rt(false), d: rt(false), black: new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }),
    cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene: new THREE.Scene(), w: 0, h: 0 });
  const vs = 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  BLOOM.blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform vec2 d; varying vec2 v; void main(){ vec3 c = texture2D(t, v).rgb * 0.227; c += (texture2D(t, v + d * 1.385).rgb + texture2D(t, v - d * 1.385).rgb) * 0.316; c += (texture2D(t, v + d * 3.231).rgb + texture2D(t, v - d * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
  BLOOM.add = new THREE.ShaderMaterial({ uniforms: { a: { value: null }, b: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    fragmentShader: 'uniform sampler2D a; uniform sampler2D b; varying vec2 v; void main(){ gl_FragColor = vec4(texture2D(a, v).rgb * 0.55 + texture2D(b, v).rgb * 0.75, 1.0); }' });
  BLOOM.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), BLOOM.blur); BLOOM.quad.frustumCulled = false; BLOOM.scene.add(BLOOM.quad); BLOOM.ready = true;
}
function bloomRender(cam) {
  if (!BLOOM.ready) bloomInit(); const B = BLOOM, sz = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(8, sz.x >> 1), h = Math.max(8, sz.y >> 1);
  if (w !== B.w || h !== B.h) { B.w = w; B.h = h; B.src.setSize(w, h); B.a.setSize(w >> 1, h >> 1); B.b.setSize(w >> 1, h >> 1); B.c.setSize(w >> 2, h >> 2); B.d.setSize(w >> 2, h >> 2); }
  const auto = renderer.autoClear, shAuto = renderer.shadowMap.autoUpdate, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(); renderer.shadowMap.autoUpdate = false;
  // 1. everything black (to hide what is behind things), then the glowing pieces in their own colours
  renderer.setRenderTarget(B.src); renderer.setClearColor(0x000000, 1); renderer.clear(); scene.overrideMaterial = B.black; renderer.render(scene, cam); scene.overrideMaterial = null;
  renderer.autoClear = false; cam.layers.set(1); renderer.render(scene, cam); cam.layers.set(0);
  // 2. blur, at half and at quarter size
  const pass = (mat, to) => { B.quad.material = mat; renderer.setRenderTarget(to); renderer.render(B.scene, B.cam); };
  B.blur.uniforms.t.value = B.src.texture; B.blur.uniforms.d.value.set(1 / (w >> 1), 0); pass(B.blur, B.a); B.blur.uniforms.t.value = B.a.texture; B.blur.uniforms.d.value.set(0, 1 / (h >> 1)); pass(B.blur, B.b);
  B.blur.uniforms.t.value = B.b.texture; B.blur.uniforms.d.value.set(1 / (w >> 2), 0); pass(B.blur, B.c); B.blur.uniforms.t.value = B.c.texture; B.blur.uniforms.d.value.set(0, 1 / (h >> 2)); pass(B.blur, B.d);
  // 3. add it to the picture already on screen
  B.add.uniforms.a.value = B.b.texture; B.add.uniforms.b.value = B.d.texture; pass(B.add, null);
  renderer.autoClear = auto; renderer.shadowMap.autoUpdate = shAuto; renderer.setClearColor(cc, ca);
}
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
  vaporMats();
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
  const VAPOR = world.theme === 'vapor';
  if (VAPOR) vaporBackdrop(); else {
  // sky
  const [sc, sg] = cnv(16, 512); const gr = sg.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#5f86b3'); gr.addColorStop(0.45, '#a9b9c7'); gr.addColorStop(0.62, '#e7c49a'); gr.addColorStop(0.75, '#d99a6c'); gr.addColorStop(1, '#6e5a4a');
  sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512); const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
  playRoot.add(sky);
  // lights
  playRoot.add(new THREE.HemisphereLight(0xa9c0e0, 0x5a4532, 0.9));
  const sun = new THREE.DirectionalLight(0xffcf98, 2.6); sun.position.set(-30, 22, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sh = sun.shadow.camera; sh.left = -32; sh.right = 32; sh.top = 32; sh.bottom = -32; sh.near = 1; sh.far = 120; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  playRoot.add(sun); playRoot.add(sun.target);
  // ground
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), MAT.asphalt); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; gnd.renderOrder = -10;
  TX.asphalt.repeat.set(1, 1); const guv = gnd.geometry.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 60, guv.getY(i) * 60);
  playRoot.add(gnd);
  }
  for (const z of world.zones) {
    const g = new THREE.PlaneGeometry(z.h.x * 2, z.h.z * 2); const uv = g.attributes.uv; const d = z.mat === 'court' ? 1 : 0.5;
    if (z.mat !== 'court') for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * z.h.x * 2 * d, uv.getY(i) * z.h.z * 2 * d);
    // layered ground: each zone gets its own depth offset so overlapping zones never flicker (z-fighting) at a distance
    // Ground zones are paint on the ground: drawn straight after it and before everything else, without a depth test, so
    // they can never flicker against it at any distance (pilot: the grid showed through the plaza). Objects are drawn
    // later and still hide them properly, because the ground itself wrote the depth.
    const zm = MAT[z.mat].clone(); zm.depthTest = false; zm.depthWrite = false;
    const m = new THREE.Mesh(g, zm); m.rotation.x = -Math.PI / 2; m.position.set(z.c.x, z.c.y, z.c.z); m.receiveShadow = true; m.renderOrder = -9 + (z.mat === 'rubberMat' ? 0 : 1) + world.zones.indexOf(z) * 0.01; playRoot.add(m);
  }
  // objects
  for (const o of world.objs) for (const v of o.vis) {
    let m;
    if (v.shape === 'box') {
      m = new THREE.Mesh(boxGeo(v.h, v.mat === 'brick' ? 0.35 : v.mat === 'concrete' ? 0.3 : 1), MAT[v.mat] || MAT.concrete);
      m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ');
      if (v.graffiti) addGraffiti(v);
    } else if (v.shape === 'pipe') m = pipeMesh(v.a, v.b, v.r, MAT[v.mat] || MAT.galv, v.cone);
    else if (v.shape === 'disc') { m = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r, v.th * 2, 48), MAT[v.mat] || MAT.chrome); m.position.set(v.c.x, v.c.y, v.c.z); }
    else if (v.shape === 'sphere') { m = new THREE.Mesh(new THREE.IcosahedronGeometry(v.r, 1), MAT[v.mat]); m.position.set(v.c.x, v.c.y, v.c.z); }
    if (!m) continue;
    m.castShadow = v.mat !== 'chainlink' && !v.glow && !v.alpha; m.receiveShadow = !v.glow; if (v.glow) m.layers.enable(1); playRoot.add(m);
  }
  if (VAPOR) return;
  // lamp lights
  for (const o of world.objs) if (o.light) { const l = new THREE.PointLight(0xffc98a, 6, 12, 2); l.position.set(o.light.x, o.light.y - 0.3, o.light.z); playRoot.add(l); }
  // skyline beyond the fence (no collision)
  const sk = new THREE.MeshStandardMaterial({ color: 0x4d4a52, roughness: 1, map: TX.concrete });
  for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2, R = 55 + rnd() * 35, w = 6 + rnd() * 14, h = 8 + rnd() * 30;
    const x = Math.cos(ang) * R, z = Math.sin(ang) * R; if (z < -20 && Math.abs(x) < 18) continue;
    const m = new THREE.Mesh(boxGeo(new THREE.Vector3(w / 2, h / 2, w / 2), 0.08), sk); m.position.set(x, h / 2, z); playRoot.add(m);
  }
  // power lines
  const pl = new THREE.MeshStandardMaterial({ color: 0x3a2e24 });
  for (const x of [-30, 0, 30]) playRoot.add(pipeMesh({ x, y: 0, z: 30 }, { x, y: 9, z: 30 }, 0.12, pl));
  const wire = new THREE.LineBasicMaterial({ color: 0x111111 });
  for (const dy of [8.6, 8.2]) { const pts = []; for (let x = -30; x <= 30; x += 2) pts.push(new THREE.Vector3(x, dy - 0.6 * Math.cos(((x + 30) % 30) / 30 * Math.PI * 2 - Math.PI) * 0.5 - 0.3, 30)); playRoot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire)); }
}
function addGraffiti(v) {
  const h = v.h; let w, hh, pos, rotY = 0, rotX = 0, opts = {};
  const e = 0.012;
  if (v.graffiti === 'south') { w = h.x * 2; hh = h.y * 2; pos = new THREE.Vector3(v.c.x, v.c.y, v.c.z + h.z + e); }
  else if (v.graffiti === 'east') { w = h.z * 2; hh = h.y * 2; pos = new THREE.Vector3(v.c.x + h.x + e, v.c.y, v.c.z); rotY = Math.PI / 2; }
  else if (v.graffiti === 'top') { w = h.x * 2; hh = h.z * 2; pos = new THREE.Vector3(v.c.x, v.c.y + h.y + e, v.c.z); rotX = -Math.PI / 2; opts = { top: true, big: 0.4 }; }
  if (hh > 10) opts = { heaven: true, stencil: 'NO WHOOPS', ppm: 64 };
  if (w < 3) opts.big = (opts.big || 1) * 0.5;
  // the pilot's pieces: a big wall of all three on the building, one per graffiti-wall section, small ones on props
  const turn = () => ['heyhey', 'clappy', 'rwdc'][artTurn++ % 3];
  if (v.art) opts.art = v.art;   // a map can say exactly which pieces go where
  else if (hh > 10) opts.art = [{ name: 'clappy', x: 0.17, y: 6.2, h: 6.4, rot: -0.04 }, { name: 'heyhey', x: 0.5, y: 6.6, h: 4.6, rot: 0.02 }, { name: 'rwdc', x: 0.83, y: 6.0, h: 5.2, rot: 0.05 }];
  else if (v.graffiti === 'east' && w > 4) opts.art = [{ name: turn(), x: 0.25 + rnd() * 0.5, y: 1.75, h: 2.2, rot: (rnd() - 0.5) * 0.12 }];
  else if (v.graffiti === 'south' && w > 2.5 && hh < 2) opts.art = [{ name: 'clappy', x: 0.5, y: hh * 0.5, h: hh * 0.86, rot: 0.06 }];
  else if (v.graffiti === 'south' && w < 2.5 && hh < 1.5) opts.art = [{ name: 'rwdc', x: 0.5, y: hh * 0.52, h: hh * 0.85 }];
  const t = graffitiTexture(w, hh, hh > 10 ? 1.4 : 1, opts);
  const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat); m.position.copy(pos);
  const grp = new THREE.Group(); grp.position.copy(pos); m.position.set(0, 0, 0);
  if (v.graffiti === 'top') { m.rotation.x = -Math.PI / 2; grp.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ'); }
  else m.rotation.y = rotY;
  grp.add(m); m.receiveShadow = true; playRoot.add(grp);
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

