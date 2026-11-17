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
  const turn = () => ['heyhey', 'mopenguinz', 'clappy', 'byteme', 'rwdc'][artTurn++ % 5];   // the pilot's pieces, and friends of the project (MoPenguinz FPV, ByTe_Me)
  if (v.art) opts.art = v.art;   // a map can say exactly which pieces go where
  else if (hh > 10) opts.art = [{ name: 'clappy', x: 0.17, y: 6.2, h: 6.4, rot: -0.04 }, { name: 'heyhey', x: 0.5, y: 6.6, h: 4.6, rot: 0.02 }, { name: 'rwdc', x: 0.83, y: 6.0, h: 5.2, rot: 0.05 }];
  else if (v.graffiti === 'east' && w > 12) opts.art = [{ name: turn(), x: 0.2 + rnd() * 0.12, y: 1.75, h: 2.2, rot: (rnd() - 0.5) * 0.12 }, { name: turn(), x: 0.66 + rnd() * 0.12, y: 1.75, h: 2.2, rot: (rnd() - 0.5) * 0.12 }];   // long sections carry two
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
// ---- The whoop, built from its parts so that what is in the Garage is what you see: frame size, duct style and colour,
// motor size and bell colour (from its name, e.g. 0702 = 7 mm x 2 mm stator), prop size / blade count / colour, the
// battery's size and cell count, the canopy that comes with the electronics, and the pilot's own colours (spec.look).
const WHOOP_LOOK = {
  // Air frames (from the pilot's reference photos): a thin coloured ring round each prop, standing on three slim legs that
  // run down to the motor mount; slightly see-through plastic. Meteor and 2S frames keep a full duct wall.
  frames: { air65: { c: 0x7fd0f2, lip: 0.0008, ring: true, clear: 0.9, braces: 4, mesh: 'air65' }, air65champ: { c: 0x5a5d63, lip: 0.0007, ring: true, clear: 0.72, braces: 3 }, meteor65: { c: 0x1f4fd6, lip: 0.0015 }, air75: { c: 0xe6e8ea, lip: 0.0009, ring: true, clear: 0.6, braces: 4 }, meteor75: { c: 0xd62828, lip: 0.0015 },
    whoop75_2s: { c: 0x2b2f36, lip: 0.0016 }, whoop85_2s: { c: 0x2b2f36, lip: 0.0019 } },
  motors: { m0702se_23k: 0x3b82f6, m0702se_27k: 0xe11d48, m0702ii_30k: 0xf5b301, m0702ii_36k: 0x9333ea, evo_31k: 0x111111, evo_33k: 0xc9a227, m0802_19k: 0x10b981, m1002_19k: 0xf97316, m0802_16k: 0x64748b, m1102_13k: 0x0ea5e9, m1103_11k: 0xef4444 },
  props: { gf1219s: 0xf2f4f6, hq31ul: 0xcfeaff, gf1207: 0xf6f0e6, p40_2b: 0xf2f4f6, p40_3b: 0xeef1f4, p51_3b: 0x4cc9f0, p51_4b: 0xf72585, p31_3d: 0xf4f4f5, p40_3d: 0xf4f4f5 },
  batteries: { b260: 0xc8e000, b300: 0xc8e000, b380: 0xc8e000, b450: 0x7c3aed, b2s300: 0xdc2626, b2s450: 0x111827, b2s550: 0x0f766e },
  canopies: { air: { c: 0xf1f3f5, h: 0.0125, w: 0.0125, bridge: true }, std: { c: 0x22c55e, h: 0.0145, w: 0.014 }, aio2s: { c: 0xfacc15, h: 0.016, w: 0.0155 } },
};
// a part mesh from src/meshes.js (int16 hundredths of a millimetre) as geometry in metres, built once
const meshGeo = {};
function meshGeometry(key) {
  if (meshGeo[key]) return meshGeo[key]; const C = typeof PW_MESHES !== 'undefined' && PW_MESHES[key]; if (!C) return null;
  const bin = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  const v16 = new Int16Array(bin(C.v)), pos = new Float32Array(v16.length); for (let i = 0; i < v16.length; i++) pos[i] = v16[i] * 1e-5;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(new Uint16Array(bin(C.i)), 1)); g.computeVertexNormals();
  return (meshGeo[key] = g);
}
const lookHex = (v, d) => { const m = typeof v === 'string' && /^#[0-9a-f]{6}$/i.exec(v); return m ? parseInt(v.slice(1), 16) : d; };
function makeWhoopMesh(p, sp, tn) {
  const g = new THREE.Group(), pgs = [], discs = [], L = sp.look || {}, FL = WHOOP_LOOK.frames[sp.frame] || { c: 0x18181c, lip: 0.0012 }, CL = WHOOP_LOOK.canopies[sp.electronics] || WHOOP_LOOK.canopies.air;
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.08, ...o });
  const frameC = lookHex(L.frame, FL.c), frameMat = std(frameC, FL.clear ? { transparent: true, opacity: FL.clear, roughness: 0.3 } : {});
  const ductMat = std(frameC, { side: THREE.DoubleSide, transparent: !!FL.clear, opacity: FL.clear || 1, roughness: 0.3 });
  const propC = lookHex(L.props, WHOOP_LOOK.props[sp.prop] ?? 0xe0f040), propMat = std(propC, { transparent: true, opacity: L.props ? 0.9 : 0.72, roughness: 0.25 });   // stock props are milky, see-through plastic
  const mName = (S.PARTS.motors[sp.motor] || {}).name || '0702', md = /(\d\d)(\d\d)/.exec(mName), statD = md ? +md[1] / 1000 : 0.007, statH = md ? +md[2] / 1000 : 0.002;
  const bellR = statD / 2 + 0.0013, bellH = statH + 0.0034, bellMat = std(WHOOP_LOOK.motors[sp.motor] ?? 0x9b6d3a, { metalness: 0.85, roughness: 0.28 }), copper = std(0xb87333, { metalness: 0.7, roughness: 0.4 }), steel = std(0xc8ccd2, { metalness: 0.9, roughness: 0.25 });
  const pr = S.PARTS.props[sp.prop] || { blades: 3 }, R = p.D / 2, ductH = 0.011 + (p.rDuct - 0.018) * 0.25, wall = FL.lip;
  // Air frames, to the published figures: duct about 34.9 mm across on a 65, the ring itself 3.8 mm tall, 13-14.5 mm overall
  // (the motor hangs below the ring on its braces and is what the quad lands on), board holes 26 mm square mounted
  // corner-forward, battery slot 11.6 x 6.0 mm underneath.
  // The Air65 itself is the pilot's frame model (assets/meshes/air65.json, from their STL, real size): its top face (ring tops and
  // post tops, where the board sits) is at FT; motors stand on its hubs 12.4 mm below that; posts 17.8 mm out; the pack lies on
  // the floor of its cage 13.3 mm down.
  const FM = FL.mesh ? meshGeometry(FL.mesh) : null, FT = 0.004;
  const ring = !!FL.ring, ringR = ring ? Math.min(p.rDuct, R + 0.0019) : p.rDuct, ringY = 0.0072, yM = FM ? FT - 0.0124 : ring ? -0.0056 : 0, post = FM ? 0.0178 : 0.0184;
  // one blade: a swept, tapered outline, thin, twisted to its pitch
  const blade = (() => { const sh = new THREE.Shape(), r0 = 0.0022, c0 = R * 0.34, c1 = R * 0.16; sh.moveTo(r0, -c0 * 0.35); sh.quadraticCurveTo(R * 0.55, -c0 * 0.75, R * 0.98, -c1 * 0.2); sh.quadraticCurveTo(R * 1.0, c1 * 0.5, R * 0.9, c1 * 0.75); sh.quadraticCurveTo(R * 0.5, c0 * 0.55, r0, c0 * 0.3); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.0006, bevelEnabled: false, curveSegments: 6 }); geo.rotateX(-Math.PI / 2); return geo; })();
  for (const m of p.motors) {
    const at = (o, y) => { o.position.set(m.pos.x, y, m.pos.z); g.add(o); return o; };
    if (FM) { /* rings, braces and hub are in the frame model */ } else if (ring) {   // Air style: a slim ring at prop height; braces sweep down and in to the motor mount below it
      at(new THREE.Mesh(new THREE.CylinderGeometry(ringR, ringR * 0.99, 0.0038, 40, 1, true), ductMat), ringY);
      for (const dy of [0.0019, -0.0019]) { const lip = at(new THREE.Mesh(new THREE.TorusGeometry(dy > 0 ? ringR : ringR * 0.99, wall * (dy > 0 ? 1 : 0.7), 8, 40), frameMat), ringY + dy); lip.rotation.x = Math.PI / 2; }
      const nb = FL.braces || 4, a0 = Math.atan2(m.pos.x, m.pos.z) + (nb === 3 ? Math.PI : Math.PI / 4);
      for (let k = 0; k < nb; k++) { const a = a0 + k / nb * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a), top = { x: m.pos.x + sx * ringR * 0.99, y: ringY - 0.0019, z: m.pos.z + cz * ringR * 0.99 }, knee = { x: m.pos.x + sx * ringR * 0.8, y: yM + 0.0012, z: m.pos.z + cz * ringR * 0.8 }, bot = { x: m.pos.x + sx * (bellR + 0.0012), y: yM - 0.0012, z: m.pos.z + cz * (bellR + 0.0012) };
        g.add(pipeMesh(top, knee, 0.00065, frameMat)); g.add(pipeMesh(knee, bot, 0.0007, frameMat)); }
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; at(new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.0006, 6), steel), yM - 0.0023).position.set(m.pos.x + Math.sin(a) * 0.0033, yM - 0.0023, m.pos.z + Math.cos(a) * 0.0033); }   // the three motor screws
    } else {
      at(new THREE.Mesh(new THREE.CylinderGeometry(p.rDuct, p.rDuct * 0.955, ductH, 28, 1, true), ductMat), 0.0025);                         // duct wall
      const lip = at(new THREE.Mesh(new THREE.TorusGeometry(p.rDuct, wall, 8, 28), frameMat), 0.0025 + ductH / 2); lip.rotation.x = Math.PI / 2;   // rolled top lip
      const foot = at(new THREE.Mesh(new THREE.TorusGeometry(p.rDuct * 0.955, wall * 0.7, 6, 28), frameMat), 0.0025 - ductH / 2); foot.rotation.x = Math.PI / 2;
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.atan2(m.pos.x, m.pos.z), st = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.0022, p.rDuct * 0.96), frameMat); st.position.set(m.pos.x + Math.sin(a) * p.rDuct * 0.48, -0.0015, m.pos.z + Math.cos(a) * p.rDuct * 0.48); st.rotation.y = a; g.add(st); }   // struts to the motor mount
    }
    if (!FM) at(new THREE.Mesh(new THREE.CylinderGeometry(bellR + 0.0012, bellR + 0.0012, 0.0014, 16), frameMat), yM - 0.0015);                          // motor mount
    at(new THREE.Mesh(new THREE.CylinderGeometry(statD / 2, statD / 2, statH + 0.001, 12), copper), yM + 0.0002 + statH / 2);                    // windings showing under the bell
    at(new THREE.Mesh(new THREE.CylinderGeometry(bellR, bellR, bellH * 0.55, 18), bellMat), yM + 0.0012 + bellH * 0.72);
    at(new THREE.Mesh(new THREE.CylinderGeometry(bellR + 0.0001, bellR + 0.0001, bellH * 0.12, 18), steel), yM + 0.0012 + bellH * 0.42);                 // the bright band at the bell's base                          // bell
    at(new THREE.Mesh(new THREE.CylinderGeometry(bellR * 0.55, bellR, bellH * 0.2, 18), steel), yM + 0.0012 + bellH * 1.08);                    // bell top taper
    if (FM) { const s0 = yM + 0.0012 + bellH * 1.08, s1 = FT - 0.001; at(new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, s1 - s0, 6), steel), (s0 + s1) / 2); }   // shaft up to the prop
    else at(new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, ring ? 0.0075 : 0.004, 6), steel), yM + 0.0012 + bellH * 1.3 + (ring ? 0.0015 : 0));                                   // shaft
    const pg = new THREE.Group(); pg.position.set(m.pos.x, FM ? FT - 0.0022 : ring ? ringY - 0.0006 : 0.0018 + bellH * 1.22, m.pos.z);
    pg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.0023, 0.0022, 10), propMat));                                                  // hub
    for (let b = 0; b < pr.blades; b++) { const bl = new THREE.Mesh(blade, propMat), h = new THREE.Group(); h.rotation.y = b / pr.blades * Math.PI * 2; bl.rotation.x = (pr.rev > 0.8 ? 0.2 : 0.38) * m.spin; if (m.spin < 0) bl.scale.z = -1; h.add(bl); pg.add(h); }
    g.add(pg); pgs.push(pg);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 24), new THREE.MeshBasicMaterial({ color: propC, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.copy(pg.position); g.add(disc); discs.push(disc);
    if (!ring) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.0042, 0.0026, Math.hypot(m.pos.x, m.pos.z) * 2 - p.rDuct * 1.7), frameMat); arm.position.set(m.pos.x / 2, -0.0012, m.pos.z / 2); arm.rotation.y = Math.atan2(m.pos.x, m.pos.z); g.add(arm); }
  }
  // centre: frame plate, flight controller with its plug and components, canopy with the camera, antenna
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const pcb = std(0x101114, { roughness: 0.55 }), chip = (x, z, w, d, c = 0x1b1d22, h = 0.001) => { const b = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(c, { metalness: 0.35, roughness: 0.5 })), x, (FM ? FT + 0.001 : 0.0052) + h / 2, z); return b; };
  if (FM) add(new THREE.Mesh(FM, std(frameC, { roughness: 0.32, side: THREE.DoubleSide })), 0, FT, 0);
  if (ring) {
    // where neighbouring rings meet they are one piece; four posts between the rings carry the board, corner-forward
    if (!FM) for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const d = Math.hypot(p.motors[0].pos.x, p.motors[0].pos.z) / Math.SQRT2, gap = Math.max(0.0012, (d - ringR) * 2 + 0.0012);
      add(new THREE.Mesh(new THREE.BoxGeometry(x ? 0.003 : gap, 0.0038, x ? gap : 0.003), frameMat), x * d, ringY, z * d);   // the web joining two neighbouring rings
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0019, ringY + 0.0005, 10), frameMat), x * post, (ringY - 0.0045) / 2 + 0.0022, z * post);     // post
      g.add(pipeMesh({ x: x * post, y: 0.0028, z: z * post }, { x: x * d, y: ringY - 0.001, z: z * d }, 0.0009, frameMat));
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0016, 8), std(0xd9c9a3, { roughness: 0.85 })), x * post, 0.0046, z * post);             // grommet
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0009, 8), steel), x * post, 0.0066, z * post); }                                       // screw head
    if (FM) for (const [x, z] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0009, 8), steel), x * post, FT + 0.0016, z * post);   // screw heads on the board (the canopy covers three)
    else for (const m of p.motors) g.add(pipeMesh({ x: m.pos.x * 0.2, y: 0.0024, z: m.pos.z * 0.2 }, { x: m.pos.x - Math.sign(m.pos.x) * ringR * 0.72, y: ringY - 0.0016, z: m.pos.z - Math.sign(m.pos.z) * ringR * 0.72 }, 0.0008, frameMat));   // the X under the board
    const bd = add(new THREE.Mesh(new THREE.BoxGeometry(0.0262, 0.001, 0.0262), pcb), 0, (FM ? FT + 0.001 : 0.0052) - 0.0005, 0); bd.rotation.y = Math.PI / 4;                    // the board, a diamond
    chip(0, 0.002, 0.0062, 0.0062); chip(-0.0062, -0.0018, 0.0034, 0.0044, 0x23262c); chip(0.006, -0.002, 0.0036, 0.003, 0x8a8f98, 0.0013); chip(0.0005, -0.0075, 0.0042, 0.0026, 0x23262c);
    chip(0.0, 0.0095, 0.0052, 0.003, 0xe9e3d2, 0.0022); chip(-0.0088, 0.0052, 0.002, 0.002, 0xb87333); chip(0.0086, 0.0058, 0.002, 0.002, 0xb87333);   // battery plug socket, pads
    for (const m of p.motors) { const sx = Math.sign(m.pos.x), sz = Math.sign(m.pos.z); for (const [c, o] of [[0x111111, -0.0006], [0x111111, 0], [0x111111, 0.0006]]) g.add(pipeMesh({ x: sx * 0.0085 + o, y: FM ? FT + 0.001 : 0.0052, z: sz * 0.0085 }, { x: m.pos.x - sx * 0.003 + o, y: yM + 0.0005, z: m.pos.z - sz * 0.003 }, 0.0003, new THREE.MeshBasicMaterial({ color: c }))); }   // motor wires
  } else {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.0024, 0.029), frameMat), 0, -0.0012, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0012, 0.026), pcb), 0, 0.003, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.0012, 8), steel), x * 0.0118, 0.0042, z * 0.0118); add(new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.004, 8), std(0xd9c9a3, { roughness: 0.8 })), x * 0.0118, 0.002, z * 0.0118); }
    for (const [x, z, w, d, c] of [[-0.006, 0.006, 0.006, 0.006, 0x16181c], [0.007, 0.004, 0.004, 0.003, 0x16181c], [0.006, -0.007, 0.003, 0.005, 0x8a8f98], [-0.008, -0.006, 0.0025, 0.0025, 0xb87333]]) add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.0012, d), std(c, { metalness: 0.4 })), x, 0.0042, z);
  }
  const canC = lookHex(L.canopy, CL.c), canMat = std(canC, { roughness: 0.3, emissive: canC, emissiveIntensity: 0.05, transparent: !!CL.bridge, opacity: CL.bridge ? 0.78 : 1, side: THREE.DoubleSide });
  // the Air canopy on a ring frame is the printed "Beast Brain" by tcmore_ (from the STL the pilot sent): three tabs that sit on
  // the side and front posts, and a hood the camera looks out of. The plain bridge is still there as a choice.
  const printed = ring && CL.bridge && (sp.canopy || 'beastbrain') === 'beastbrain' ? meshGeometry('beastbrain') : null, baseY = FM ? FT + 0.001 : 0.0062;
  let tiltR = tn.camTilt * Math.PI / 180, camY = (ring && CL.bridge ? 0.0066 : 0.0045) + CL.h * 0.62, camZ = ring && CL.bridge ? -0.0128 : -CL.w * 0.82;
  if (printed) { tiltR = 0; camY = baseY + 0.014 * post / 0.0178; camZ = -0.0112 * post / 0.0178; }   // the hood holds the camera level, its lens 14 mm above the tabs
  if (printed) { const pm = std(canC, { roughness: 0.55, side: THREE.DoubleSide }); add(new THREE.Mesh(printed, pm), 0, baseY, 0).scale.setScalar(post / 0.0178);
    for (const [x, z] of [[post, 0], [-post, 0], [0, -post]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0009, 8), steel), x, baseY + 0.0015, z);   // the three screws through its tabs
  } else if (CL.bridge) {   // the Air canopy: a see-through hoop from side post to side post, a spine from the tail post over the top to the camera cradle
    const pr0 = ring ? post : CL.w * 0.95, base = ring ? 0.0066 : 0.0042, top = base + CL.h;
    const arch = add(new THREE.Mesh(new THREE.TorusGeometry(pr0, 0.0012, 8, 24, Math.PI), canMat), 0, base, 0); arch.scale.y = CL.h / pr0;
    g.add(pipeMesh({ x: 0, y: base, z: pr0 }, { x: 0, y: top * 0.96, z: 0.003 }, 0.0011, canMat)); g.add(pipeMesh({ x: 0, y: top * 0.96, z: 0.003 }, { x: 0, y: camY + 0.0052, z: camZ + 0.003 }, 0.0011, canMat));
    for (const sx of [-1, 1]) { g.add(pipeMesh({ x: sx * 0.0052, y: camY, z: camZ + 0.0015 }, { x: sx * pr0 * 0.72, y: base + CL.h * 0.62, z: -0.001 }, 0.001, canMat)); g.add(pipeMesh({ x: sx * 0.0048, y: camY - 0.0042, z: camZ + 0.002 }, { x: 0, y: base, z: -pr0 }, 0.0009, canMat)); }
    const cradle = add(new THREE.Mesh(new THREE.TorusGeometry(0.0052, 0.001, 8, 20), canMat), 0, camY, camZ + 0.0015); cradle.rotation.x = -tiltR;
  } else { const can = add(new THREE.Mesh(new THREE.SphereGeometry(CL.w, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), canMat), 0, 0.0045, 0.001); can.scale.set(0.92, CL.h / CL.w, 1.18);
    const hood = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0058, 0.006, 14, 1, true), canMat), 0, camY, camZ); hood.rotation.x = Math.PI / 2 - tiltR; }
  // the camera: a fat black barrel with a glass dome, tilted to the pilot's camera angle, on its little board
  const cam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0046, 0.0072, 18), std(0x0c0c0e, { metalness: 0.4, roughness: 0.35 })), 0, camY, camZ); cam.rotation.x = Math.PI / 2 - tiltR;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0041, 0.0007, 6, 18), std(0x1c1c20, { metalness: 0.6, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.0036; cam.add(rim);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0x16284f, metalness: 0.95, roughness: 0.04 })); lens.position.y = 0.0028; cam.add(lens);
  const cb = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.0009, 0.0095), std(0x101114)); cb.position.y = -0.004; if (!printed) cam.add(cb);   // (the printed canopy has its own camera plate)
  // antenna: a thick black base rising at the back with a thin whip
  const az = ring && CL.bridge ? post * 0.8 : CL.w * 0.55, a0 = { x: 0, y: 0.0045 + CL.h * 0.5, z: az }, a1 = { x: 0, y: 0.0045 + CL.h * 1.3, z: az + 0.011 }, a2 = { x: 0, y: 0.0045 + CL.h * 1.95, z: az + 0.021 };
  g.add(pipeMesh(a0, a1, 0.0013, std(0x0c0c0e))); g.add(pipeMesh(a1, a2, 0.0004, std(0x0c0c0e)));
  for (const [c, x] of [[0xcc2222, -0.003], [0xe8c21a, 0], [0x111111, 0.003]]) g.add(pipeMesh({ x, y: 0.0045, z: -0.004 }, { x: x * 0.4, y: camY - 0.002, z: camZ + 0.005 }, 0.00035, new THREE.MeshBasicMaterial({ color: c })));   // camera wires
  // battery: one stick for 1S, two cells stacked for 2S, sized by capacity, with its lead and plug
  const B = S.PARTS.batteries[sp.battery] || { cap: 300 }, cells = B.cells || 1, bl = 0.036 + B.cap * 0.00006, bw = cells > 1 ? 0.016 : 0.0118, bh = (cells > 1 ? 0.0064 : 0.0068) * cells;
  const batC = WHOOP_LOOK.batteries[sp.battery] ?? 0x2b6ad6, by = FM ? FT - 0.0133 + bh / 2 : -0.0035 - bh / 2;
  add(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), std(batC, { roughness: 0.45 })), 0, by, 0.002);
  add(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.0003, bh + 0.0003, bl * 0.2), std(0x111214, { roughness: 0.6 })), 0, by, 0.002 - bl * 0.26);     // label blocks
  add(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.0003, bh * 0.45, bl * 0.3), std(0x111214, { roughness: 0.6 })), 0, by, 0.002 + bl * 0.12);
  if (cells > 1) add(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.0004, 0.0004, bl), std(0x0b0b0c)), 0, by, 0.002);                                // the seam between the two cells
  add(new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.0035, 0.006), std(0xf4f4f5, { roughness: 0.6 })), 0, by, 0.002 + bl / 2 + 0.005);                // plug
  g.add(pipeMesh({ x: 0.001, y: by, z: 0.002 + bl / 2 }, { x: 0.001, y: by, z: 0.002 + bl / 2 + 0.004 }, 0.0007, new THREE.MeshBasicMaterial({ color: 0xcc2222 })));
  g.add(pipeMesh({ x: -0.001, y: by, z: 0.002 + bl / 2 }, { x: -0.001, y: by, z: 0.002 + bl / 2 + 0.004 }, 0.0007, new THREE.MeshBasicMaterial({ color: 0x111111 })));
  if (!FM) for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.0012, bh + 0.002, 0.004), frameMat), sx * (bw / 2 + 0.0008), by + 0.0008, 0.002);   // battery holder rails
  if (ring && !FM) for (const z of [-0.008, 0.012]) { add(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.003, 0.0009, 0.0022), frameMat), 0, by - bh / 2 - 0.0006, z); for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.0011, bh + 0.0035, 0.0022), frameMat), sx * (bw / 2 + 0.0009), by + 0.0012, z); }   // the cage the pack slides into
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, pgs, discs };
}
function buildDroneMesh() {
  if (droneMesh) scene.remove(droneMesh);
  const W = makeWhoopMesh(params, spec, tune); propGroups = W.pgs; propDiscs = W.discs; droneMesh = W.g; scene.add(droneMesh);
  if (typeof garagePreviewRefresh === 'function') garagePreviewRefresh();
}
const PARTS = () => S.PARTS;

