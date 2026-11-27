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
  // the backboard: drawn once across its face (72 x 42 in), the shooter's square 24 x 18 in, centred, its bottom edge level with
  // the rim (owner, 2026-11-19: the lines sat anywhere, world-tiled like a wall texture)
  [c, g] = cnv(512, 302); g.fillStyle = '#e9e5dc'; g.fillRect(0, 0, 512, 302); stains(g, 512, 302, 20, 'rgba(60,50,40,A)', 10, 60, 0.35); g.strokeStyle = '#c4462c'; g.lineWidth = 9;
  g.strokeRect(9, 9, 494, 284); { const sw = 512 / 3, sh = 302 * 18 / 42, sb = 302 * (1 - 0.217); g.strokeRect(256 - sw / 2, sb - sh, sw, sh); } TX.backboard = tex(c, 1);
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
  MAT.blossom = new THREE.MeshStandardMaterial({ color: 0xf6b3cf, roughness: 0.85, flatShading: true });   // Clappy Park's sakura
  MAT.fluoro = new THREE.MeshBasicMaterial({ color: 0xf2f8ff, toneMapped: false });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0x2c3a4a, roughness: 0.12, metalness: 0.7, emissive: 0x0d1620 });   // windows                         // More Warehouse's tube lights
  MAT.vChromeFloor = new THREE.MeshStandardMaterial({ map: TX.vTile, color: 0xcfc2ff, roughness: 0.12, metalness: 0.92, envMapIntensity: 1.1 });
  MAT.vGrid = new THREE.MeshStandardMaterial({ map: TX.vGrid, emissiveMap: TX.vGridE, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.25 });
}
// ---- Ship Drugs (theme 'vice'): a gaudy 1980s cruise ship in a night-time police raid. Materials first.
function viceMats() {
  let c, g; const S2 = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.05, ...o }), B = hex => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });
  // loud geometric carpet: zig-zags, triangles and Memphis squiggles on deep purple
  [c, g] = cnv(256, 256); g.fillStyle = '#1c0b38'; g.fillRect(0, 0, 256, 256); g.lineWidth = 7;
  for (let y = 0; y < 256; y += 64) { g.strokeStyle = ['#ff3fd0', '#55f6ff', '#b6ff3c', '#b26bff'][y / 64]; g.beginPath(); for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + 18 + ((x / 32) % 2 ? 22 : 0)); g.stroke(); }
  for (let i = 0; i < 26; i++) { g.fillStyle = ['#ff3fd0', '#55f6ff', '#fff36a', '#b6ff3c'][i % 4]; const x = rnd() * 256, y = rnd() * 256, r = 6 + rnd() * 8; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y + r); g.lineTo(x - r, y + r); g.closePath(); g.fill(); }
  TX.carpet = tex(c); MAT.carpet = S2(0xffffff, { map: TX.carpet, roughness: 0.95 });
  // Memphis wallpaper: pastel teal with pink squiggles and black confetti (the corridors' walls; drawn wavy in maps.js)
  [c, g] = cnv(256, 256); g.fillStyle = '#7fe0d0'; g.fillRect(0, 0, 256, 256); g.lineWidth = 6; g.strokeStyle = '#ff6fb8';
  for (let y = 20; y < 256; y += 48) { g.beginPath(); for (let x = 0; x <= 256; x += 4) g.lineTo(x, y + Math.sin(x / 14 + y) * 8); g.stroke(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = i % 3 ? '#1b1030' : '#fff36a'; g.fillRect(rnd() * 256, rnd() * 256, 3 + rnd() * 9, 3); }
  TX.memphis = tex(c); MAT.memphis = S2(0xffffff, { map: TX.memphis, roughness: 0.7 });
  [c, g] = cnv(256, 256); g.fillStyle = '#f6a8d0'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#2b1550'; g.lineWidth = 5; for (let i = 0; i < 9; i++) { g.beginPath(); const x = rnd() * 256, y = rnd() * 256; g.arc(x, y, 10 + rnd() * 16, 0, Math.PI * 1.3); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = ['#55f6ff', '#1b1030', '#fff36a'][i % 3]; g.save(); g.translate(rnd() * 256, rnd() * 256); g.rotate(rnd() * 3); g.fillRect(-6, -2, 12, 4); g.restore(); }
  TX.memphisPink = tex(c); MAT.memphisPink = S2(0xffffff, { map: TX.memphisPink, roughness: 0.7 });
  // checkerboard dance floor and pool tiles: glossy, so the neon smears across them
  [c, g] = cnv(256, 256); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#111018' : '#eae6f2'; g.fillRect(x * 64, y * 64, 64, 64); } TX.checker = tex(c); MAT.checker = S2(0xffffff, { map: TX.checker, roughness: 0.12, metalness: 0.2 });
  [c, g] = cnv(256, 256); g.fillStyle = '#7fd8e6'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#e8fbff'; g.lineWidth = 3; for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  speckle(g, 256, 256, 1500, ['rgba(40,90,110,0.25)']); TX.poolTile = tex(c); MAT.poolTile = S2(0xffffff, { map: TX.poolTile, roughness: 0.2 });
  [c, g] = cnv(128, 128); g.fillStyle = '#9fd6ff'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#e6f6ff'; g.lineWidth = 4; for (let i = 0; i <= 128; i += 32) { g.strokeRect(i, 0, 0, 128); g.strokeRect(0, i, 128, 0); } TX.glassBlock = tex(c);
  MAT.glassBlock = new THREE.MeshStandardMaterial({ map: TX.glassBlock, transparent: true, opacity: 0.55, roughness: 0.15, metalness: 0.1 });
  // the ship, the deck, the raid
  MAT.hullWhite = S2(0xeceff2, { roughness: 0.35 }); MAT.hullNavy = S2(0x13183a, { roughness: 0.4 }); MAT.deckWet = S2(0x2a2a33, { roughness: 0.14, metalness: 0.35 });
  [c, g] = cnv(256, 256); g.fillStyle = '#6a4a32'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 256; i += 16) { g.fillStyle = i % 32 ? '#5e412b' : '#73513a'; g.fillRect(0, i, 256, 14); } TX.teak = tex(c); MAT.teakWet = S2(0xffffff, { map: TX.teak, roughness: 0.18, metalness: 0.15 });
  MAT.brass = S2(0xd4a64a, { metalness: 0.9, roughness: 0.28 }); MAT.lifeboat = S2(0xff6a1a, { roughness: 0.5, emissive: 0x6a2000, emissiveIntensity: 0.6 }); MAT.craneYellow = S2(0xf0b81e, { roughness: 0.55, metalness: 0.3, emissive: 0x4a3400, emissiveIntensity: 0.5 });   /* safety colours stay readable at night */ MAT.rust = S2(0x5a3a2a, { roughness: 0.9 });
  MAT.contraband = S2(0xf4f4f4, { roughness: 0.1, metalness: 0.05 }); MAT.feltGreen = S2(0x0f6a3a, { roughness: 0.95 }); MAT.carBlack = S2(0x101014, { metalness: 0.6, roughness: 0.25 }); MAT.carWhite = S2(0xe8e8ea, { metalness: 0.5, roughness: 0.3 });
  MAT.doorWood = S2(0x8a5a3a, { roughness: 0.6 }); MAT.mirrorFrame = S2(0xe0c070, { metalness: 0.8, roughness: 0.3 }); MAT.sawhorse = S2(0xf2f2f2, { roughness: 0.6 }); MAT.coneOrange = S2(0xff7a1a);
  [c, g] = cnv(256, 32); g.fillStyle = '#ffd400'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#111'; g.font = 'bold 22px sans-serif'; for (let x = 0; x < 256; x += 128) g.fillText('CRIME SCENE', x + 4, 24); TX.tape = tex(c); MAT.tape = new THREE.MeshBasicMaterial({ map: TX.tape, toneMapped: false });
  [c, g] = cnv(64, 64); g.fillStyle = '#ffd400'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#111'; for (let i = -64; i < 128; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 11, 0); g.lineTo(i - 53, 64); g.lineTo(i - 64, 64); g.fill(); } TX.hazard = tex(c); MAT.hazard = S2(0xffffff, { map: TX.hazard });
  MAT.slideTube = new THREE.MeshStandardMaterial({ color: 0x66f0ff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1, depthWrite: false, emissive: 0x2288aa, emissiveIntensity: 0.6 });
  // glowing: neon tubes, police lights, sodium lamps, UV chalk (all on the bloom layer)
  MAT.neonLime = B(0xb6ff3c); MAT.neonMagenta = B(0xff2fb8); MAT.policeRed = B(0xff003c); MAT.policeBlue = B(0x0088ff); MAT.sodium = B(0xffa040); MAT.uvChalk = B(0xe8f4ff); MAT.windowLit = B(0xffd9a0);
  MAT.holo = new THREE.MeshBasicMaterial({ color: 0xff6fe8, transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false });
}
// The night harbour: indigo sky, a striped synthwave sun sitting on the water beyond the bow, the grid running out to it,
// purple haze, a far shore of dark towers, black glossy water, and hallucinations drifting over the ship (visual only).
const VICE = { strobes: [], hallu: [], t: 0 };
function viceBackdrop() {
  const stops = [[0, '#05030f'], [0.32, '#120a34'], [0.45, '#3a1460'], [0.5, '#a0287a'], [0.52, '#ff5f8a'], [0.54, '#2a0f4a'], [1, '#05040c']];
  const [sc, sg] = cnv(16, 512), gr = sg.createLinearGradient(0, 0, 0, 512); for (const [o, c] of stops) gr.addColorStop(o, c); sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512);
  const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  playRoot.add(new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })));
  // what wet decks, chrome and brass reflect: the same night with the sun and the police lights in it
  const [ec, eg] = cnv(256, 128), eg2 = eg.createLinearGradient(0, 0, 0, 128); for (const [o, c] of stops) eg2.addColorStop(o, c); eg.fillStyle = eg2; eg.fillRect(0, 0, 256, 128);
  for (const [x, col] of [[40, '#ff003c'], [70, '#0088ff'], [190, '#ffa040'], [128, '#ff6fb8']]) { const rg = eg.createRadialGradient(x, 66, 1, x, 66, 18); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); eg.fillStyle = rg; eg.fillRect(0, 0, 256, 128); }
  const envT = new THREE.CanvasTexture(ec); envT.colorSpace = THREE.SRGBColorSpace; envT.mapping = THREE.EquirectangularReflectionMapping; scene.environment = envT;
  scene.fog = new THREE.Fog(0x2a1040, 40, 210);
  const [uc, ug] = cnv(256, 256), ugr = ug.createLinearGradient(0, 0, 0, 256); ugr.addColorStop(0, '#ffe45c'); ugr.addColorStop(0.5, '#ff6a6a'); ugr.addColorStop(1, '#d01fa0'); ug.fillStyle = ugr; ug.beginPath(); ug.arc(128, 128, 126, 0, 7); ug.fill();
  ug.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 8; i++) ug.fillRect(0, 132 + i * 15, 256, 2 + i * 1.5);
  const sunDir = new THREE.Vector3(0.95, 0.07, 0.3).normalize(), sunM = new THREE.Mesh(new THREE.CircleGeometry(70, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(uc), transparent: true, fog: false, toneMapped: false, depthWrite: false }));
  sunM.material.map.colorSpace = THREE.SRGBColorSpace; sunM.position.copy(sunDir).multiplyScalar(295); sunM.lookAt(0, 10, 0); sunM.layers.enable(1); playRoot.add(sunM);
  playRoot.add(new THREE.HemisphereLight(0x6a5cff, 0x1a0820, 0.75));
  const moon = new THREE.DirectionalLight(0x9a8cff, 0.9); moon.position.set(-40, 60, 30); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  { const B = world.bounds || { x: [-60, 60], z: [-40, 40] }, R = Math.max(40, ...B.x.map(Math.abs), ...B.z.map(Math.abs)) + 4, sh = moon.shadow.camera; sh.left = -R; sh.right = R; sh.top = R; sh.bottom = -R; sh.near = 1; sh.far = 220; }
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03; playRoot.add(moon); playRoot.add(moon.target);
  // the harbour: black glossy water, and the grid running out to the sun beyond 120 m
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), MAT.water || (MAT.water = new THREE.MeshStandardMaterial({ color: 0x05060f, roughness: 0.06, metalness: 0.85, envMapIntensity: 1.4 })));
  water.rotation.x = -Math.PI / 2; water.receiveShadow = true; water.renderOrder = -10; playRoot.add(water);
  const grid = new THREE.Mesh(new THREE.RingGeometry(120, 340, 64, 1), MAT.vGrid.clone()); grid.material.transparent = true; grid.material.opacity = 0.5; grid.material.depthWrite = false; grid.rotation.x = -Math.PI / 2; grid.position.y = 0.02;
  const guv = grid.geometry.attributes.uv, gp = grid.geometry.attributes.position; for (let i = 0; i < guv.count; i++) guv.setXY(i, gp.getX(i) / 4, gp.getY(i) / 4); grid.layers.enable(1); playRoot.add(grid);
  // the far shore: dark towers with a few lit windows, all round beyond the haze
  const tower = new THREE.MeshBasicMaterial({ color: 0x0a0618, fog: false }), lit = new THREE.MeshBasicMaterial({ color: 0xff8ad8, fog: false, toneMapped: false });
  for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + rnd() * 0.08; if (Math.abs(a - 0.31) < 0.25) continue; const R = 230 + rnd() * 40, h = 14 + rnd() * 45, w = 8 + rnd() * 12, m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), tower);
    m.position.set(Math.cos(a) * R, h / 2, Math.sin(a) * R); playRoot.add(m); for (let k = 0; k < 4; k++) { const wnd = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), lit); wnd.position.set(m.position.x - Math.cos(a) * (w / 2 + 0.1), 4 + rnd() * (h - 6), m.position.z - Math.sin(a) * (w / 2 + 0.1) + (rnd() - 0.5) * w * 0.6); wnd.lookAt(0, wnd.position.y, 0); wnd.layers.enable(1); playRoot.add(wnd); } }
  // hallucinations over the ship: translucent neon pills, wireframe palms, geometric eyes; they drift (viceTick), and are not solid
  VICE.hallu = []; const H = (m, x, y, z, spin) => { m.position.set(x, y, z); m.layers.enable(1); playRoot.add(m); VICE.hallu.push({ m, y, ph: rnd() * 6.28, spin }); };
  for (let i = 0; i < 9; i++) { const pill = new THREE.Group(), col = [0xff2fb8, 0x55f6ff, 0xb6ff3c, 0xb26bff][i % 4], half = mat => new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 2.4, 6, 12), mat);
    const a = half(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })); pill.add(a); pill.rotation.z = rnd() * 3; H(pill, -40 + i * 11 + rnd() * 4, 30 + rnd() * 12, -14 + rnd() * 28, 0.25 + rnd() * 0.3); }
  const wire = col => new THREE.LineBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.8 });
  // wireframe mushrooms (the pilot: the palms read as a weird shape): a domed cap, gills under it, a stem, spots on top
  for (let i = 0; i < 5; i++) { const mush = new THREE.Group(), m = wire([0xb6ff3c, 0x55f6ff, 0xff2fb8][i % 3]), m2 = wire([0xff2fb8, 0xfff36a, 0xb6ff3c][i % 3]);
    const stem = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.75, 1.05, 4.2, 10, 3)), m); stem.position.y = 2.1; mush.add(stem);
    const cap = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(3.2, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)), m); cap.scale.y = 0.62; cap.position.y = 4.1; mush.add(cap);
    const gills = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.RingGeometry(0.8, 3.2, 20, 1)), m2); gills.rotation.x = Math.PI / 2; gills.position.y = 4.1; mush.add(gills);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, r = k % 2 ? 1.9 : 1.1, y = 4.1 + Math.sqrt(Math.max(0, 1 - (r / 3.2) ** 2)) * 3.2 * 0.62;
      const spot = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.42, 8)), m2); spot.position.set(Math.cos(a) * r, y + 0.02, Math.sin(a) * r); spot.lookAt(spot.position.x * 2, y + 3, spot.position.z * 2); mush.add(spot); }
    mush.rotation.z = (rnd() - 0.5) * 0.3; H(mush, -45 + i * 22 + rnd() * 6, 25 + rnd() * 6, (i % 2 ? 22 : -26) + rnd() * 4, 0.08); }
  for (let i = 0; i < 4; i++) { const eye = new THREE.Group(), white = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshBasicMaterial({ color: 0xeef2ff, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false })),
      iris = new THREE.Mesh(new THREE.CircleGeometry(1.0, 6), new THREE.MeshBasicMaterial({ color: [0xff2fb8, 0x55f6ff][i % 2], toneMapped: false })), pupil = new THREE.Mesh(new THREE.CircleGeometry(0.45, 6), new THREE.MeshBasicMaterial({ color: 0x05030f }));
    iris.position.z = 2.15; pupil.position.z = 2.17; eye.add(white, iris, pupil); H(eye, -30 + i * 24, 38 + rnd() * 6, (i % 2 ? -6 : 8), 0.05); VICE.hallu[VICE.hallu.length - 1].eye = true; }
}
// every frame on the ship: police lights strobe (red and blue in turns), hallucinations bob, turn and watch the quad
function viceTick(dt, at) {
  VICE.t += dt; const t = VICE.t, red = Math.floor(t * 4) % 2 === 0, flash = (t * 8) % 1 < 0.5;
  if (MAT.policeRed) MAT.policeRed.color.setHex(red && flash ? 0xff003c : 0x2a0008); if (MAT.policeBlue) MAT.policeBlue.color.setHex(!red && flash ? 0x0088ff : 0x001428);
  for (const L of VICE.strobes) L.l.intensity = L.base * ((L.blue ? !red : red) && flash ? 1 : 0.05);
  for (const h of VICE.hallu) { h.m.position.y = h.y + Math.sin(t * 0.4 + h.ph) * 1.6; if (h.eye && at) h.m.lookAt(at); else h.m.rotation.y += dt * h.spin; }
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
  // the Training Room (owner, 2026-11-20): smooth gray concrete, pale observation glass in dark frames, plain gates
  { const g = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, ...o });
    MAT.labWall = g(0x8e9093); MAT.labFloor = g(0x7c7e80, { roughness: 0.8 }); MAT.labBlock = g(0x9c9ea0); MAT.labGate = g(0x5a5d61, { roughness: 0.6 }); MAT.labBar = g(0x6c7074, { roughness: 0.5 });
    MAT.labMark = g(0xc9cccf); MAT.labFrame = g(0x26282b, { roughness: 0.5 }); MAT.labWindow = new THREE.MeshBasicMaterial({ color: 0xe9eef2 }); }
  MAT.metal = MAT.galv; MAT.chain = new THREE.MeshStandardMaterial({ color: 0x8b8f92, metalness: 0.8, roughness: 0.4 });
  MAT.wood = std(TX.wood); MAT.chainlink = new THREE.MeshStandardMaterial({ map: TX.chainlink, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
  MAT.rubberBlack = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 }); MAT.tire = MAT.rubberBlack;
  MAT.cone = new THREE.MeshStandardMaterial({ color: 0xe8541c, roughness: 0.6 }); MAT.bark = std(TX.bark);
  // the playground's sign gantry: the Metal Craft FPV logo (assets/flags/metalcraft.webp, credited on the main menu), centred on
  // the logo's own deep navy; plain navy until the picture has loaded
  { const [c, g] = cnv(1040, 360); g.fillStyle = '#10142a'; g.fillRect(0, 0, 1040, 360); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    MAT.signMetalcraft = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1 });
    const src = (window.PW_FLAGS || {}).metalcraft; if (src) { const im = new Image(); im.onload = () => { const gr = g.createLinearGradient(0, 0, 1040, 0); gr.addColorStop(0, '#10142a'); gr.addColorStop(0.5, '#101c2f'); gr.addColorStop(1, '#100e1d'); g.fillStyle = gr; g.fillRect(0, 0, 1040, 360); const h = 344, w = h * im.width / im.height; g.drawImage(im, (1040 - w) / 2, 8, w, h); t.needsUpdate = true; }; im.src = src; } }
  MAT.leaves = new THREE.MeshStandardMaterial({ color: 0x4f6b2f, roughness: 0.9, flatShading: true });
  MAT.lampHead = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffd9a0, emissiveIntensity: 0.6 });
  MAT.hoodie = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.9 }); MAT.jeans = new THREE.MeshStandardMaterial({ color: 0x34476b, roughness: 0.9 });
  MAT.skin = new THREE.MeshStandardMaterial({ color: 0xc89272, roughness: 0.7 }); MAT.radio = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 });
  MAT.goggles = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.4, emissive: 0x220000 });
  MAT.backboard = std(TX.backboard); MAT.rimOrange = new THREE.MeshStandardMaterial({ color: 0xd2521f, metalness: 0.5, roughness: 0.4 });
  // Moose Knuckle Park (theme 'pnw'): interior-BC ground, bark, canopy and the muted, weathered park furniture
  { let c, g; const T = (fill, dots, n = 9000, s0 = 1, s1 = 3, a = 0.45, st = null) => { [c, g] = cnv(256, 256); g.fillStyle = fill; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, n, dots, s0, s1, a); if (st) stains(g, 256, 256, 14, st, 10, 60, 0.3); return tex(c); };
    TX.grass = T('#6c7646', ['#55613a', '#83895a', '#7a6544', '#5f6e3e', '#93936a'], 16000, 1, 3, 0.55, 'rgba(90,70,45,A)');
    TX.duff = T('#6a4a35', ['#83563a', '#4a3324', '#7d6a4a', '#5b4a2e', '#9a6a44'], 18000, 1, 3, 0.6, 'rgba(60,70,40,A)');
    TX.woodchip = T('#7b5638', ['#a07450', '#5a3c26', '#8e6a4a', '#c09068'], 9000, 2, 5, 0.6);
    TX.path = T('#6e5a46', ['#5a4836', '#857059', '#4a3c30'], 9000, 1, 3, 0.5, 'rgba(40,30,20,A)');
    TX.gravel = T('#8a8478', ['#a39c90', '#6a655c', '#c0b8a8'], 12000, 1, 3, 0.6);
    TX.dryGrass = T('#8a8152', ['#9e9060', '#6f7044', '#7a6548', '#b0a070', '#5f6a3e'], 16000, 1, 3, 0.55, 'rgba(100,80,50,A)');   // winter lawn: dry, patchy, bare dirt showing
    TX.leafLitter = T('#4e3a2a', ['#7a5634', '#5e4228', '#2e2018', '#8e6a3e', '#a8925e', '#3e4a26'], 9000, 3, 7, 0.7, 'rgba(40,50,30,A)');   // fallen birch and cottonwood leaves on moss
    TX.cedarBark = (() => { [c, g] = cnv(128, 256); g.fillStyle = '#6a4434'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 70; i++) { g.fillStyle = ['rgba(40,24,16,0.55)', 'rgba(150,110,85,0.35)', 'rgba(90,60,45,0.5)'][i % 3]; g.fillRect(rnd() * 128, 0, 1 + rnd() * 4, 256); } return tex(c); })();
    TX.birchBark = (() => { [c, g] = cnv(128, 256); g.fillStyle = '#ddd8cc'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,28,26,' + (0.4 + rnd() * 0.5) + ')'; g.fillRect(rnd() * 128, rnd() * 256, 4 + rnd() * 18, 1 + rnd() * 3); } return tex(c); })();
    TX.oldWood = T('#8c8278', ['#6e655c', '#a69c90', '#5a524a'], 6000, 1, 2, 0.4, 'rgba(50,45,40,A)');
    TX.tireTread = (() => { [c, g] = cnv(64, 256); g.fillStyle = '#1e1e1e'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#0c0c0c'; for (let y = 0; y < 256; y += 16) { g.fillRect(0, y, 28, 8); g.fillRect(36, y + 8, 28, 8); } return tex(c); })();
    TX.mooseSign = (() => { [c, g] = cnv(512, 340); g.fillStyle = '#6a262a'; g.fillRect(0, 0, 512, 340); speckle(g, 512, 340, 2500, ['#521c20', '#7e3236'], 1, 3, 0.35);   // maroon with a gold border and a moose emblem (the owner's photo, 2026-11-19)
      g.strokeStyle = '#d8b25a'; g.lineWidth = 10; g.strokeRect(10, 10, 492, 320); g.lineWidth = 3; g.strokeRect(24, 24, 464, 292);
      g.fillStyle = '#e2bf66'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 50px Georgia, serif'; g.fillText('MOOSE KNUCKLE', 256, 70); g.font = 'bold 42px Georgia, serif'; g.fillText('PARK', 256, 118);
      g.beginPath(); g.arc(256, 200, 46, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6a262a';   // the emblem: a plain moose silhouette in a gold disc
      g.fillRect(222, 196, 62, 22); g.fillRect(226, 216, 7, 22); g.fillRect(272, 216, 7, 22); g.fillRect(278, 178, 14, 26); g.fillRect(286, 190, 18, 12); g.fillRect(266, 168, 30, 7); g.fillRect(266, 160, 6, 10); g.fillRect(288, 160, 6, 10);
      const t2 = tex(c); t2.wrapS = t2.wrapT = THREE.ClampToEdgeWrapping; return t2; })();
    const P = (hex, o = {}) => std(T(hex, ['#ffffff', '#000000', '#5a4a3a'], 2500, 1, 2, 0.12, 'rgba(70,60,50,A)'), { roughness: 0.75, metalness: 0.1, ...o });
    for (const k of ['grass', 'duff', 'woodchip', 'path', 'gravel', 'dryGrass', 'leafLitter']) MAT[k] = std(TX[k], { roughness: 0.95 });
    MAT.cedarBark = std(TX.cedarBark, { roughness: 0.95 }); MAT.birchBark = std(TX.birchBark, { roughness: 0.8 }); MAT.oldWood = std(TX.oldWood, { roughness: 0.9 });
    MAT.fenceWood = std(TX.oldWood, { roughness: 0.9, color: 0xb59a7a }); MAT.polewood = std(TX.cedarBark, { color: 0x9a8a78 }); MAT.carvedCedar = std(TX.wood, { color: 0xc89a70, roughness: 0.9 }); MAT.mossLog = std(TX.cedarBark, { color: 0x8a9a62 });
    // the carved heart on Moose's big cedar: cut through the bark to pale wood, CS + AS inside
    { const [c, g] = cnv(256, 256); g.clearRect(0, 0, 256, 256); const heart = () => { g.beginPath(); g.moveTo(128, 222); g.bezierCurveTo(30, 160, 6, 96, 40, 56); g.bezierCurveTo(70, 22, 116, 34, 128, 74); g.bezierCurveTo(140, 34, 186, 22, 216, 56); g.bezierCurveTo(250, 96, 226, 160, 128, 222); g.closePath(); };
      g.lineJoin = 'round'; heart(); g.lineWidth = 22; g.strokeStyle = '#3a2416'; g.stroke(); heart(); g.lineWidth = 11; g.strokeStyle = '#d6aa7c'; g.stroke();
      g.font = "700 46px Georgia, serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.strokeStyle = '#3a2416'; g.strokeText('CS + AS', 128, 124); g.fillStyle = '#d6aa7c'; g.fillText('CS + AS', 128, 124);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      MAT.heartCarving = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }); }
    MAT.tireTread = std(TX.tireTread, { roughness: 0.95 }); MAT.mooseSign = std(TX.mooseSign, { roughness: 0.8 });
    const leaf = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, flatShading: true, emissive: col, emissiveIntensity: 0.28 });   // a little light through the needles: the undersides were black (owner, 2026-11-19)
    MAT.cedarLeaf = leaf(0x2c4630); MAT.hemlockLeaf = leaf(0x34503a); MAT.mapleLeaf = leaf(0x6c9434); MAT.snagWood = new THREE.MeshStandardMaterial({ color: 0x8c8780, roughness: 0.95 }); MAT.birchLeaf = leaf(0x7a8a3c); MAT.shrub = leaf(0x3b5430); MAT.bracken = leaf(0x8a5a30);
    MAT.fadedBlue = P('#4f7090'); MAT.fadedRed = P('#8a4c3e'); MAT.playTan = P('#bca67a'); MAT.playRed = P('#a8322c'); MAT.playYellow = P('#d8b234'); MAT.slideBlue = P('#2f63b4', { roughness: 0.5 });   /* the play unit as it is now: red and yellow, two blue slides */ MAT.darkMetal = P('#3a3c3a', { metalness: 0.4 }); MAT.binGreen = P('#3d5a44', { metalness: 0.3 });
    MAT.signWhite = new THREE.MeshStandardMaterial({ color: 0xe6e4dc, roughness: 0.6 });
    MAT.houseSage = P('#8a9476'); MAT.houseTan = P('#b3a486'); MAT.houseBlue = P('#7c8c9a'); MAT.houseCream = P('#d2c8ae'); MAT.houseRed = P('#8e5a4a'); MAT.roofDark = P('#3c3d40', { roughness: 0.9 });
    MAT.truckRed = P('#7e2e28', { metalness: 0.5, roughness: 0.4 }); MAT.truckGrey = P('#8a8e90', { metalness: 0.5, roughness: 0.4 }); MAT.truckBlue = P('#34485e', { metalness: 0.5, roughness: 0.4 }); }
  vaporMats(); viceMats(); duskMats(); nycMats(); parkMats();
}
// More Warehouse's conveyor (world.belts, owner 2026-11-21): cleats that travel with the belt so it is seen to move (the physics
// that carries the quad is sim.js's surf.belt). Built on first use, and again whenever the scene was rebuilt
const BELT = { root: null, of: null, t: 0 };
function beltTick(dt) {
  const B = world.belts; if (!B || !B.length) return;
  if (BELT.of !== B || !BELT.root || BELT.root.parent !== playRoot) { if (BELT.root && BELT.root.parent) BELT.root.parent.remove(BELT.root); BELT.root = new THREE.Group(); BELT.of = B; BELT.t = 0; const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.75 });
    for (const b of B) { const n = Math.max(1, Math.floor((b.x1 - b.x0) / 0.7)); for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, b.hw * 2 - 0.06), mat); m.userData = { b, i, n }; m.position.set(b.x0, b.y + 0.006, b.z); BELT.root.add(m); } }
    playRoot.add(BELT.root); }
  BELT.t += dt; for (const m of BELT.root.children) { const { b, i, n } = m.userData, L = b.x1 - b.x0 - 0.1, s = ((i / n) * L + BELT.t * b.v) % L; m.position.x = b.x0 + 0.05 + (s < 0 ? s + L : s); }
}
function boxGeo(h, density = 0.5, off = null, t0 = null) {   // off: the box's centre, to lay the texture in world space (facades: windows on a floor grid)
  const g = new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const X = p.getX(i) + (off ? (t0 ? off.x - t0.x : h.x) : 0), Y = p.getY(i) + (off ? off.y : 0), Z = p.getZ(i) + (off ? (t0 ? off.z - t0.z : h.z) : 0);   // off: along a face from its corner (or from t0, a wall's own start, so its pieces line up), up it from the ground
    let u, v; if (nx > 0.5) { u = Z; v = Y; } else if (ny > 0.5) { u = X; v = Z; } else { u = X; v = Y; }
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

// Moose Knuckle Park's surroundings, seen between the trees: forested ridges all round (Mt Mackenzie and the Selkirks to
// the east, the Monashees west) and Mt Begbie's snowy peak to the south-west. Far away and drawn without fog, pre-hazed.
function pnwBackdrop() {
  // Far away, flat-coloured and unfogged. Drawn back to front with no depth test (owner, 2026-11-19: where the cones crossed
  // each other, and the snow met its peak, the far-off depth buffer flickered): each mountain simply paints over the ones
  // behind it, and everything nearer (the ground plane, the map) is drawn later and paints over them all.
  const ridge = (col) => new THREE.MeshBasicMaterial({ color: col, fog: false, depthTest: false, depthWrite: false }), snow = new THREE.MeshBasicMaterial({ color: 0xe4e9ee, fog: false, depthTest: false, depthWrite: false });
  const peaks = [], add = (ang, R, h, r, col, snowy) => peaks.push({ ang, R, h, r, col, snowy });
  for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2 + rnd() * 0.12, R = 210 + rnd() * 50; add(a, R, 55 + rnd() * 45, 50 + rnd() * 30, [0x5e7470, 0x6a7f7c, 0x566a68][i % 3], false); }
  add(Math.atan2(170, -150), 245, 150, 60, 0x7a8c92, true);   // Mt Begbie, south-west
  add(Math.atan2(-60, 230), 250, 120, 70, 0x6f8288, true);    // Mt Mackenzie, east
  peaks.sort((a, b) => b.R - a.R); let order = -3000;
  for (const { ang, R, h, r, col, snowy } of peaks) { const x = Math.cos(ang) * R, z = Math.sin(ang) * R, m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), ridge(col)); m.position.set(x, h / 2 - 6, z); m.rotation.y = ang * 3; m.renderOrder = order++; playRoot.add(m);
    if (snowy) { const s = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, h * 0.22, 7, 1), snow); s.position.set(x, h - 6 - h * 0.11, z); s.rotation.y = ang * 3; s.renderOrder = order++; playRoot.add(s); } }
}
// ---- Static batching (performance, 2026-11-17: testers reported heavy CPU). Every piece of scenery used to be its own
// mesh: a thousand or more draw calls a frame, twice over with shadows. The scenery never moves, so pieces that share a
// material, shadow settings and a 32 m patch of the map are merged into one mesh: a few dozen draw calls, and the patches
// still let the camera skip what is behind it. Glowing pieces are merged among themselves and stay on the bloom layer.
const MERGE_STATIC = store.get('mergeStatic', true), STATIC = new Map();
function staticAdd(m, v) {
  const c = v.c || (v.a && v.b ? { x: (v.a.x + v.b.x) / 2, z: (v.a.z + v.b.z) / 2 } : { x: 0, z: 0 }), cell = Math.floor(c.x / 32) + ',' + Math.floor(c.z / 32);
  const glow = !!v.glow, key = m.material.uuid + '|' + (m.castShadow ? 1 : 0) + (m.receiveShadow ? 1 : 0) + (glow ? 'g' : '') + '|' + cell;
  let g = STATIC.get(key); if (!g) STATIC.set(key, g = { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, glow, geos: [] });
  m.updateMatrix(); const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix); g.geos.push(geo); m.geometry.dispose();
}
function staticFlush() {
  for (const g of STATIC.values()) {
    let n = 0; for (const x of g.geos) n += x.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
    for (const x of g.geos) { const k = x.attributes.position.count; pos.set(x.attributes.position.array, o * 3); if (x.attributes.normal) nor.set(x.attributes.normal.array, o * 3); if (x.attributes.uv) uv.set(x.attributes.uv.array, o * 2); o += k; x.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, g.mat); mesh.castShadow = g.cast; mesh.receiveShadow = g.recv; mesh.matrixAutoUpdate = false; if (g.glow) mesh.layers.enable(1); /* the neon still glows: bloom draws layer 1 */ objRoot.add(mesh);
  }
  PERF.staticPieces = [...STATIC.values()].reduce((a, g) => a + g.geos.length, 0); PERF.staticMeshes = STATIC.size; STATIC.clear();
}
// The map's objects (everything in world.objs), in their own group so the Map Editor can rebuild them after each change:
// unmerged while editing (each mesh knows its object: userData.oid, for picking), merged for flying.
// one drawn piece of an object as a mesh (the map, and the Map Editor's asset thumbnails); art: draw its graffiti too
function visMesh(v, art) {
  let m;
  if (v.shape === 'box') {
    m = new THREE.Mesh(v.mat === 'backboard' || v.mat === 'mooseSign' ? new THREE.BoxGeometry(v.h.x * 2, v.h.y * 2, v.h.z * 2) : NYC_DENS[v.mat] ? boxGeo(v.h, NYC_DENS[v.mat], v.c, v.tex0) : boxGeo(v.h, v.mat === 'brick' ? 0.35 : v.mat === 'concrete' ? 0.3 : 1), MAT[v.mat] || MAT.concrete);   // a backboard's picture spans its face once
    m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ');
    if (v.graffiti && art) addGraffiti(v);
  } else if (v.shape === 'pipe') m = pipeMesh(v.a, v.b, v.r, MAT[v.mat] || MAT.galv, v.cone);
  else if (v.shape === 'disc') { m = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r, v.th * 2, 48), MAT[v.mat] || MAT.chrome); m.position.set(v.c.x, v.c.y, v.c.z); }
  else if (v.shape === 'sphere') { m = new THREE.Mesh(new THREE.IcosahedronGeometry(v.r, 1), MAT[v.mat]); m.position.set(v.c.x, v.c.y, v.c.z); }
  else if (v.shape === 'bark') { m = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r, v.h, 24, 1, true, v.ang - v.span / 2, v.span), MAT[v.mat]); m.position.set(v.c.x, v.c.y, v.c.z); }   // a decal on a round trunk: a patch of its curve, the picture once across it
  else if (v.shape === 'holeplate' || v.shape === 'torus') { let g;   // a square panel with a round hole in its middle, and a smooth ring (Slackvegan's round voids)
    if (v.shape === 'torus') g = new THREE.TorusGeometry(v.r, v.tube, 10, 72);
    else { const sh = new THREE.Shape(); sh.moveTo(-v.r, -v.r); sh.lineTo(v.r, -v.r); sh.lineTo(v.r, v.r); sh.lineTo(-v.r, v.r); sh.closePath(); const hp = new THREE.Path(); hp.absarc(0, 0, v.r, 0, Math.PI * 2, true); sh.holes.push(hp);
      g = new THREE.ExtrudeGeometry(sh, { depth: v.t, bevelEnabled: false, curveSegments: 72 }); g.translate(0, 0, -v.t / 2); }
    if (v.axis === 'z') g.rotateY(Math.PI / 2);
    if (v.shape === 'holeplate') { const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, d = NYC_DENS[v.mat] || 0.5;   // world-space texture, like the wall round it
      for (let i = 0; i < p.count; i++) { const T0 = v.tex0 || { x: 0, z: 0 }, X = p.getX(i) + v.c.x - T0.x, Y = p.getY(i) + v.c.y, Z = p.getZ(i) + v.c.z - T0.z, nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)); uv.setXY(i, (nx > 0.5 ? Z : X) * d, (ny > 0.5 ? Z : Y) * d); } }
    m = new THREE.Mesh(g, MAT[v.mat] || MAT.concrete); m.position.set(v.c.x, v.c.y, v.c.z); }
  else if (v.shape === 'sign') { m = new THREE.Mesh(new THREE.PlaneGeometry(v.w, v.h), MAT[v.mat] || MAT.concrete); m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.rx || 0, v.ry || 0, 0, 'YXZ'); }   // a flat picture (a neon sign, a flag): its texture once across it
  return m || null;
}
let objRoot = null;
function buildObjects(merge = MERGE_STATIC) {
  if (objRoot) { playRoot.remove(objRoot); objRoot.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  objRoot = new THREE.Group(); playRoot.add(objRoot);
  for (const o of world.objs) for (const v of o.vis) {
    const m = visMesh(v, true); if (!m) continue;
    m.castShadow = v.mat !== 'chainlink' && !v.glow && !v.alpha; m.receiveShadow = !v.glow; if (v.glow) m.layers.enable(1);
    m.userData.oid = o.id; if (!merge) objRoot.add(m); else staticAdd(m, v);
  }
  staticFlush();
  mapLightsBuild();
}
// The map's own lamps as real point lights. Every one adds work to every lit pixel (three.js lights each pixel once per
// light): More Warehouse's 11 made the game feel heavy and laggy on a tester's machine (low frame rate = sticks read late).
// Options → Graphics → Map lights: full, few (4, brighter, spread over the map), off; auto starts full and drops to few once
// if the first seconds of flying run under 50 fps (lightsAuto in play.js).
function mapLightsBuild() {
  for (const l of objRoot.children.filter(c => c.isPointLight)) objRoot.remove(l);
  if (world.theme === 'vapor') return;
  const all = world.objs.filter(o => o.light), mode = PERF.lights === 'auto' ? (PERF.lightsAuto || 'full') : PERF.lights;
  if (mode === 'off') return;
  let pick = all, boost = 1;
  if (mode === 'few' && all.length > 4) { pick = []; const left = all.slice(); pick.push(left.splice(0, 1)[0]);   // farthest-point picks: spread over the map
    while (pick.length < 4 && left.length) { let bi = 0, bd = -1; left.forEach((o, i) => { const d = Math.min(...pick.map(q => Math.hypot(q.light.x - o.light.x, q.light.z - o.light.z))); if (d > bd) { bd = d; bi = i; } }); pick.push(left.splice(bi, 1)[0]); }
    boost = Math.min(2.2, Math.sqrt(all.length / 4)); }
  VICE.strobes = []; for (const o of pick) { const l = new THREE.PointLight(o.lightColor || 0xffc98a, (o.lightPower || 6) * boost, (o.lightRange || 12) * Math.sqrt(boost), 2); l.position.set(o.light.x, o.light.y - 0.3, o.light.z); l.userData.oid = o.id; objRoot.add(l); if (o.strobe) VICE.strobes.push({ l, base: l.intensity, blue: o.strobe === 'blue' }); }
  scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
}
// ============================================================ build world meshes

// ============================================================ The Murderdome (theme 'dusk'): a scrap-yard whoop pit in a ruined sports dome under a
// permanent wasteland dusk. Materials, the neon signs, the sky and haze, and a tick for fire, flickering neon and dust.
const DUSK = { t: 0, dust: null, flick: [] };
function signTex(lines, col, glow, w = 512, h = 128, art) {
  const [c, g] = cnv(w, h); g.fillStyle = '#07040a'; g.fillRect(0, 0, w, h); if (art) art(g, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle'; const fs = Math.floor(h * 0.62 / lines.length); g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
  lines.forEach((t, i) => { const y = h * (i + 0.5) / lines.length; g.shadowColor = glow; g.shadowBlur = 18; g.fillStyle = col; g.fillText(t, w / 2, y); g.shadowBlur = 0; g.lineWidth = 2; g.strokeStyle = '#fff8'; g.strokeText(t, w / 2, y); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function duskMats() {
  const S2 = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, metalness: 0.15, ...o }), B = (hex, o = {}) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false, ...o });
  const mk = (draw, w = 256, h = 256) => { const [c, g] = cnv(w, h); draw(g, w, h); return tex(c); };
  MAT.rustRed = S2(0x7a3b22, { map: mk((g, w, h) => { g.fillStyle = '#6e3a24'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, ['#4a2414', '#8f4e2a', '#a8612f', '#3a2a22'], 1, 4, 0.55); }), roughness: 0.95, metalness: 0.3 });
  MAT.scrap = S2(0x6a6258, { map: mk((g, w, h) => { g.fillStyle = '#5c564f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { g.fillStyle = ['#7a3b22', '#4a4640', '#8a8478', '#3c5a6a', '#6a2a1a'][i % 5]; g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 90, 20 + rnd() * 60); } speckle(g, w, h, 1800, ['#2a2622', '#9a5a30'], 1, 3, 0.5); g.strokeStyle = '#222a'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.lineTo(rnd() * w, rnd() * h); g.stroke(); } }), metalness: 0.45, roughness: 0.7 });
  MAT.rebar = S2(0x5a3220, { roughness: 0.9, metalness: 0.5 });
  MAT.plate = S2(0x8a8478, { map: mk((g, w, h) => { g.fillStyle = '#7d776c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a3630'; g.lineWidth = 2; for (let x = 0; x < w; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, h); g.stroke(); } speckle(g, w, h, 900, ['#6a3a22', '#9a948a'], 1, 3, 0.5); }), metalness: 0.6, roughness: 0.55 });
  MAT.crackedConcrete = S2(0x8c8478, { map: mk((g, w, h) => { g.fillStyle = '#857d70'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['#76705f', '#9a9284', '#5d574c'], 1, 3, 0.4); g.strokeStyle = '#2e2a24'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); } }), roughness: 0.95, metalness: 0 });
  MAT.oilCarpet = S2(0x4a3a30, { map: mk((g, w, h) => { g.fillStyle = '#5a4636'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, ['#4a382c', '#6a5240', '#3e3228'], 1, 2, 0.6); for (let i = 0; i < 7; i++) { const x = rnd() * w, y = rnd() * h, r = 15 + rnd() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#120c08ee'); gr.addColorStop(1, '#120c0800'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }), roughness: 1, metalness: 0 });
  MAT.dirt = S2(0x7a5a3a, { map: mk((g, w, h) => { g.fillStyle = '#76573a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3200, ['#5e4430', '#8e6a44', '#a07a4c', '#4c3624'], 1, 3, 0.5); }), roughness: 1, metalness: 0 });
  MAT.oilSlick = new THREE.MeshStandardMaterial({ color: 0x0a0806, roughness: 0.06, metalness: 0.85, transparent: true, opacity: 0.92 });
  MAT.candyPink = S2(0xff4fb8, { roughness: 0.35, metalness: 0, emissive: 0x5a0a3a, emissiveIntensity: 0.45 }); MAT.candyYellow = S2(0xffd21e, { roughness: 0.35, metalness: 0, emissive: 0x4a3600, emissiveIntensity: 0.45 });
  MAT.flamingo = S2(0xff6fa8, { roughness: 0.4, metalness: 0 }); MAT.foamJunk = S2(0x2a6a8a, { roughness: 1, metalness: 0 }); MAT.bandana = S2(0xb51e1e, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  MAT.busYellow = S2(0xb38a1a, { map: mk((g, w, h) => { g.fillStyle = '#b08a1e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2400, ['#6e3a22', '#8a6a1a', '#3a2a1a'], 1, 5, 0.6); }), roughness: 0.85, metalness: 0.35 });
  MAT.couchRot = S2(0x5a4a3a, { roughness: 1, metalness: 0 }); MAT.fridge = S2(0xcfc8b4, { roughness: 0.5, metalness: 0.3 });
  MAT.fire = B(0xff7a1e); MAT.fireCore = B(0xffd060); MAT.emberRed = B(0xff2a10); MAT.emergency = B(0xff1a1a);
  MAT.shaft = new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, fog: false });
  MAT.dustDevil = new THREE.MeshBasicMaterial({ color: 0xc89060, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
    map: (() => { const [c, g] = cnv(64, 256); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,220,170,${0.2 + rnd() * 0.5})`; g.lineWidth = 1 + rnd() * 3; g.beginPath(); const y = rnd() * 256; g.moveTo(0, y); g.bezierCurveTo(20, y - 30, 44, y + 30, 64, y - 10); g.stroke(); } const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })() });
  // the scavenged neon (canvas text, original lettering) and the flags
  const sign = (k, lines, col, glow, art, w, h) => { MAT[k] = new THREE.MeshBasicMaterial({ map: signTex(lines, col, glow, w, h, art), toneMapped: false }); DUSK.flick.push({ m: MAT[k], base: MAT[k].color.clone(), p: rnd() * 10 }); };
  sign('signSugar', ["SUGAR'S PIT"], '#ff5fd2', '#ff2ab0'); sign('signDirtbag', ['DIRTBAG', 'FOREVER'], '#c8ff3a', '#7aff00', null, 512, 256); sign('signWitness', ['WITNESS ME'], '#ffb02a', '#ff5a00');
  sign('signSendIt', ['SEND IT'], '#55f6ff', '#00b8ff'); sign('signCasino', ['CASINO'], '#ffe14a', '#ff9a00');
  sign('signSpider', ['SPIDER', 'SUGAR'], '#ff6ad8', '#ff1fb0', (g, w, h) => { g.strokeStyle = '#ffd21e88'; g.lineWidth = 2; const cx = w / 2, cy = h / 2; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); g.stroke(); } for (let r = 30; r < w; r += 36) { g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2; g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); } g.stroke(); } }, 512, 512);
  // the start flag: the Dirtbag FPV club's logo (assets/flags/dirtbag.webp, credited on the main menu and in the README), bone
  // white on black; a plain skull and crossbones until the picture has loaded
  { const [c, g] = cnv(1024, 512); g.fillStyle = '#0c0b0a'; g.fillRect(0, 0, 1024, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    MAT.skullFlag = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.95, map: t });
    const src = (window.PW_FLAGS || {}).dirtbag;
    if (src) { const im = new Image(); im.onload = () => { const w = 960, h = w * im.height / im.width; g.drawImage(im, (1024 - w) / 2, (512 - h) / 2, w, h); t.needsUpdate = true; }; im.src = src; }
    else { g.fillStyle = '#ece6d6'; g.beginPath(); g.ellipse(512, 220, 90, 100, 0, 0, 7); g.fill(); g.strokeStyle = '#ece6d6'; g.lineWidth = 34; g.lineCap = 'round'; g.beginPath(); g.moveTo(330, 330); g.lineTo(694, 460); g.moveTo(694, 330); g.lineTo(330, 460); g.stroke(); t.needsUpdate = true; } }
}
function duskBackdrop() {
  // sky: bruised orange low down, purple-grey dust overhead; a big low sun in the west-south-west
  const [sc, sg] = cnv(16, 512), gr = sg.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#2a1e3a'); gr.addColorStop(0.3, '#4e2f4a'); gr.addColorStop(0.47, '#9a4a3a'); gr.addColorStop(0.55, '#e07a3a'); gr.addColorStop(0.6, '#f0a050'); gr.addColorStop(0.66, '#7a4a3a'); gr.addColorStop(1, '#2e2420');
  sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512); const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  playRoot.add(new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false })));
  const sunDir = new THREE.Vector3(-0.86, 0.3, 0.42).normalize();
  { const [c, g] = cnv(256, 256), rg = g.createRadialGradient(128, 128, 10, 128, 128, 128); rg.addColorStop(0, '#fff2c0'); rg.addColorStop(0.18, '#ffb050'); rg.addColorStop(0.45, '#ff6a2a88'); rg.addColorStop(1, '#ff4a2000'); g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    m.position.copy(sunDir).multiplyScalar(280); m.lookAt(0, 0, 0); m.layers.enable(1); playRoot.add(m); }
  // the wasteland beyond: low broken ridges, wrecks of towers, all dark against the dusk
  const far = new THREE.MeshBasicMaterial({ color: 0x2a1c1a, fog: false }), far2 = new THREE.MeshBasicMaterial({ color: 0x3a2622, fog: false });
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, R = 200 + rnd() * 40, h = 6 + rnd() * 18, w = 14 + rnd() * 24; const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), i % 2 ? far : far2); m.position.set(Math.cos(a) * R, h / 2 - 2, Math.sin(a) * R); m.rotation.y = rnd() * 3; playRoot.add(m); }
  for (let i = 0; i < 14; i++) { const a = rnd() * Math.PI * 2, R = 150 + rnd() * 40, h = 20 + rnd() * 45, w = 5 + rnd() * 8; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), far); m.position.set(Math.cos(a) * R, h / 2, Math.sin(a) * R); m.rotation.set((rnd() - 0.5) * 0.25, rnd() * 3, (rnd() - 0.5) * 0.25); playRoot.add(m); }
  // light: a hard low sun (long shadows through the broken roof) and a dim purple sky fill
  playRoot.add(new THREE.HemisphereLight(0xd8b0b8, 0x8a6448, 2.9));   // owner: "quite dark": brighter fill
  { const bounce = new THREE.DirectionalLight(0xb090b4, 1.5); bounce.position.set(60, 30, -30); playRoot.add(bounce); }   // dusk sky bounce from the east: the shade is dim, not black
  const sun = new THREE.DirectionalLight(0xffa868, 3.9); sun.position.copy(sunDir).multiplyScalar(80); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sh = sun.shadow.camera, R = 62; sh.left = -R; sh.right = R; sh.top = R; sh.bottom = -R; sh.near = 1; sh.far = 220; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; playRoot.add(sun); playRoot.add(sun.target);
  const gnd = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), MAT.dirt); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; gnd.renderOrder = -10; const guv = gnd.geometry.attributes.uv; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 50, guv.getY(i) * 50); playRoot.add(gnd);
  scene.fog = new THREE.Fog(0x5a3a32, 30, 190);
  // searchlights: a drum and a glowing lens on each base, and a long beam fading upward, swept slowly by duskTick
  { const [c, g] = cnv(8, 256), gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.25, 'rgba(255,214,160,0.55)'); gr.addColorStop(1, 'rgba(255,190,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    const bt = new THREE.CanvasTexture(c), beamM = new THREE.MeshBasicMaterial({ map: bt, color: 0xffe0b0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const L = 140, beamG = new THREE.CylinderGeometry(5.5, 0.38, L, 28, 1, true).translate(0, L / 2, 0), coreG = new THREE.CylinderGeometry(1.6, 0.22, L * 0.7, 16, 1, true).translate(0, L * 0.35, 0);
    const drumM = MAT.scrap, lensM = new THREE.MeshBasicMaterial({ color: 0xfff2d8, toneMapped: false });
    DUSK.lights = (world.searchlights || []).map(s => { const yawG = new THREE.Group(), tilt = new THREE.Group(); yawG.position.set(s.at.x, s.at.y, s.at.z); yawG.add(tilt); tilt.rotation.x = (90 - s.el) * Math.PI / 180;
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.9, 18), drumM); drum.castShadow = true; tilt.add(drum);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), lensM); lens.rotation.x = -Math.PI / 2; lens.position.y = 0.46; lens.layers.enable(1); tilt.add(lens);
      const beam = new THREE.Mesh(beamG, beamM), core = new THREE.Mesh(coreG, beamM); beam.position.y = core.position.y = 0.46; beam.frustumCulled = core.frustumCulled = false; tilt.add(beam, core);
      playRoot.add(yawG); return { g: yawG, s }; }); }
  // dust hanging in the air (catches the light), drifting
  const N = 2600, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 46; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = rnd() * 16; pos[i * 3 + 2] = Math.sin(a) * r; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const moteTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  // a soft round mote, not a square (a mote right by the lens used to draw as a big grey tile)
  DUSK.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc890, size: 0.035, map: moteTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); DUSK.dust.frustumCulled = false; playRoot.add(DUSK.dust);
  // dust devils (world.fields kind 'swirl'): a funnel of soft motes turning and rising, faster low down, wider up top (owner: the
  // see-through cone read as "a weird ghostly christmas tree")
  DUSK.devils = [];
  for (const f of (world.fields || []).filter(q => q.kind === 'swirl')) { const M = 900, H = (f.h.y || 3) * 2.2, p2 = new Float32Array(M * 3), st = [];
    for (let i = 0; i < M; i++) st.push({ th: rnd() * Math.PI * 2, y: rnd() * H, j: 0.75 + rnd() * 0.5 });
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    const pts = new THREE.Points(g2, new THREE.PointsMaterial({ color: 0xd4a070, size: 0.09, map: moteTex, transparent: true, opacity: 0.42, depthWrite: false })); pts.frustumCulled = false; playRoot.add(pts);
    DUSK.devils.push({ f, H, st, pts, R: f.h.x || 2 }); }
  duskDevils(0);
}
function duskDevils(dt) {
  for (const D of DUSK.devils || []) { const a = D.pts.geometry.attributes.position, c = D.f.o, base = c.y - (D.f.h.y || 3);
    D.st.forEach((q, i) => { const k = q.y / D.H, r = (0.25 + D.R * 0.9 * k * k + 0.2 * k) * q.j; q.th += dt * (5.5 - 3.5 * k) / q.j; q.y += dt * (0.8 + 0.6 * q.j); if (q.y > D.H) q.y = 0;
      a.setXYZ(i, c.x + Math.cos(q.th) * r, base + q.y, c.z + Math.sin(q.th) * r); });
    a.needsUpdate = true; }
}

function duskTick(dt) {
  DUSK.t += dt; const t = DUSK.t, f = 0.82 + 0.18 * Math.sin(t * 17) * Math.sin(t * 5.3 + 1);
  if (MAT.fire) { MAT.fire.color.setRGB(1, 0.42 * f + 0.05, 0.1 * f); MAT.fireCore.color.setRGB(1, 0.75 * f + 0.1, 0.3 * f); }
  if (MAT.emergency) { const on = (Math.sin(t * 3.2) > -0.2) ? 1 : 0.25; MAT.emergency.color.setRGB(on, 0.08 * on, 0.06 * on); }
  for (const s of DUSK.flick) { const k = Math.sin(t * 0.7 + s.p * 3) > 0.94 ? (Math.random() < 0.5 ? 0.15 : 1) : 1; s.m.color.copy(s.base).multiplyScalar(k); }   // a short-circuit now and then
  for (const L of DUSK.lights || []) L.g.rotation.y = L.s.yaw + L.s.sweep * Math.sin(t * L.s.speed + L.s.phase);   // the searchlights sweep
  duskDevils(dt);
  if (MAT.oilSlick) MAT.oilSlick.color.setHSL((0.75 + 0.1 * Math.sin(t * 0.5)) % 1, 0.25, 0.04);
  if (DUSK.dust) { const a = DUSK.dust.geometry.attributes.position; for (let i = 0; i < a.count; i += 7) { let x = a.getX(i) + dt * 0.25, y = a.getY(i) + Math.sin(t + i) * dt * 0.05; if (x > 46) x = -46; a.setXY(i, x, y); } a.needsUpdate = true; }
}
// ============================================================ Slackvegan City (theme 'nyc'): a sticky New York block at golden hour.
// Brick and brutalist facades with their windows on a floor grid (the texture is laid in world space: NYC_DENS), the El's green
// steel, taxis, shop windows, neon, the bodega cat. Its own random stream, so the other maps' looks are unchanged.
const NYC = { t: 0, flick: [] };
const NYC_DENS = { subwayTile: 1 / 8, nycBrick: 1 / 7.2, nycBrickTan: 1 / 7.2, brutal: 1 / 7.2, trainSide: 1 / 3.75, shaftWall: 1 / 7.2 };   // texture tile = this many metres⁻¹, aligned to the ground
function nycMats() {
  const R = (() => { let s = 4242; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const dots = (g, w, h, n, cols, s0 = 1, s1 = 3, a = 0.3) => { for (let i = 0; i < n; i++) { g.globalAlpha = a * R(); g.fillStyle = cols[(R() * cols.length) | 0]; const s = s0 + R() * (s1 - s0); g.fillRect(R() * w, R() * h, s, s); } g.globalAlpha = 1; };
  const S2 = (o = {}) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05, ...o }), B = (hex, o = {}) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false, ...o });
  const T = (w, h, draw, srgb = true) => { const [c, g] = cnv(w, h); draw(g, w, h); return tex(c, 1, srgb); };
  // a 2 x 2 bay facade (7.2 m square): four windows, one or two lit warm, sills and lintels; ground floors get shutters drawn over
  const facade = (wallCol, mortar, frameCol, kind) => T(512, 512, (g, w, h) => {
    g.fillStyle = wallCol; g.fillRect(0, 0, w, h);
    if (kind === 'brick') { g.strokeStyle = mortar; g.lineWidth = 1.4; for (let y = 0; y < h; y += 6.4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / 6.4) % 2) * 7; x < w; x += 14) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 6.4); g.stroke(); } }
      dots(g, w, h, 2600, ['#00000055', '#ffffff22', '#3a1a10'], 1, 4, 0.35); }
    else { dots(g, w, h, 5000, ['#00000033', '#ffffff22', '#6a6660'], 1, 3, 0.4); g.strokeStyle = '#00000022'; g.lineWidth = 2; for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }   // raw concrete, panel joints
    for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) { const ox = bx * 256, oy = by * 256, px = 256 / 3.6;
      if (kind === 'brutal') { const gr = g.createLinearGradient(0, oy + 0.8 * px, 0, oy + 2.1 * px); gr.addColorStop(0, '#46525e'); gr.addColorStop(1, '#161c22'); g.fillStyle = gr; g.fillRect(ox, oy + 0.8 * px, 256, 1.3 * px);
        if (R() < 0.18) { g.fillStyle = '#e8b878'; g.globalAlpha = 0.7; g.fillRect(ox + 66 + ((R() * 3) | 0) * 64, oy + 0.85 * px, 54, 1.2 * px); g.globalAlpha = 1; }   // a lit office
        g.fillStyle = '#7e7a74'; for (let x = 0; x < 256; x += 64) g.fillRect(ox + x, oy + 0.75 * px, 10, 1.4 * px); g.fillStyle = '#00000055'; g.fillRect(ox, oy + 2.1 * px, 256, 5); continue; }
      const wx = ox + 128 - 0.68 * px, wy = oy + 0.8 * px, ww = 1.36 * px, wh = 1.9 * px, lit = R() < 0.32;
      g.fillStyle = frameCol; g.fillRect(wx - 6, wy - 9, ww + 12, wh + 15); g.fillStyle = '#d2c8b6'; g.fillRect(wx - 10, wy + wh + 4, ww + 20, 8);
      const gr = g.createLinearGradient(0, wy, 0, wy + wh); if (lit) { gr.addColorStop(0, '#ffd59a'); gr.addColorStop(1, '#c87a3a'); } else { gr.addColorStop(0, '#5c6c7c'); gr.addColorStop(0.5, '#26303a'); gr.addColorStop(1, '#141a20'); }
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh); g.fillStyle = frameCol; g.fillRect(wx, wy + wh / 2 - 2, ww, 4); g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      if (!lit && R() < 0.4) { g.fillStyle = ['#a8584a', '#4a6a8a', '#d8c8a0'][(R() * 3) | 0]; g.globalAlpha = 0.8; g.fillRect(wx, wy, ww * (0.3 + R() * 0.4), wh); g.globalAlpha = 1; }   // a curtain
      if (R() < 0.25) { g.fillStyle = '#d0d0cc'; g.fillRect(wx + 6, wy + wh - 26, ww - 12, 22); }   // an AC unit in the window
    } });
  MAT.nycBrick = S2({ map: facade('#7a3a2a', '#4a2a22', '#e8e2d6', 'brick'), roughness: 0.9 });
  MAT.nycBrickTan = S2({ map: facade('#b49a78', '#7a6650', '#2a2a2a', 'brick'), roughness: 0.9 });
  MAT.brutal = S2({ map: facade('#8e8c88', '#000', '#000', 'brutal'), roughness: 0.95 });
  MAT.nycConcrete = S2({ map: TX.concrete, color: 0xc8c0b4, roughness: 0.95 }); MAT.columnConcrete = S2({ color: 0x9a968e, roughness: 0.9 });
  MAT.roofTar = S2({ map: T(128, 128, (g, w, h) => { g.fillStyle = '#3a3634'; g.fillRect(0, 0, w, h); dots(g, w, h, 1500, ['#2a2624', '#4e4a46', '#5a4a3a'], 1, 3, 0.5); g.strokeStyle = '#2a2826'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }), roughness: 0.95 });
  MAT.bodegaTile = S2({ map: T(64, 64, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#d8d2c4' : '#6a2a2a'; g.fillRect(x * 32, y * 32, 32, 32); } }), roughness: 0.5 }); MAT.nycTrim = S2({ color: 0xcfc6b4, roughness: 0.8 });
  MAT.shaftWall = S2({ map: T(256, 256, (g, w, h) => { g.fillStyle = '#4c4e52'; g.fillRect(0, 0, w, h); dots(g, w, h, 2000, ['#00000044', '#ffffff18'], 1, 3, 0.5); g.fillStyle = '#2a2c30'; for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 3); }), roughness: 0.9 });
  MAT.neonCyanTrim = S2({ color: 0x46d8ff, emissive: 0x2ad0ff, emissiveIntensity: 1.4, roughness: 0.4 });
  MAT.lobbyFloor = S2({ map: T(256, 256, (g, w, h) => { g.fillStyle = '#d6cebf'; g.fillRect(0, 0, w, h); dots(g, w, h, 5000, ['#8a8070', '#ffffff', '#5a5248', '#b0a48e'], 1, 3, 0.5); }), roughness: 0.25, metalness: 0.05 });
  MAT.marbleDark = S2({ color: 0x26262c, roughness: 0.2, metalness: 0.1 });
  MAT.shopFront = S2({ color: 0x2c2622, roughness: 0.6, metalness: 0.2 });
  MAT.nycSidewalk = S2({ map: T(256, 256, (g, w, h) => { g.fillStyle = '#a8a29a'; g.fillRect(0, 0, w, h); dots(g, w, h, 6000, ['#8c867e', '#bab4ac', '#6a6660', '#2a2a2a'], 1, 3, 0.4); g.strokeStyle = '#6e6a64'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); for (let i = 0; i < 4; i++) { g.fillStyle = '#2a2826'; g.globalAlpha = 0.5; g.beginPath(); g.arc(R() * w, R() * h, 2 + R() * 4, 0, 7); g.fill(); g.globalAlpha = 1; } }), roughness: 0.95 });   // gum spots
  MAT.yellowLines = S2({ map: T(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e8b830'; g.fillRect(0, 4, w, 20); g.fillRect(0, 40, w, 20); }), alphaTest: 0.3, roughness: 0.7 });
  { const t = MAT.yellowLines.map; t.repeat.set(1, 1 / 0.36); }
  MAT.laneDash = S2({ map: T(256, 16, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#e8e6de'; g.fillRect(0, 0, w * 0.45, h); }), alphaTest: 0.3, roughness: 0.7 });
  { const t = MAT.laneDash.map; t.repeat.set(0.5, 1 / 0.16); }
  MAT.crosswalk = S2({ map: T(16, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ecebe4'; for (let y = 0; y < h; y += 128) g.fillRect(0, y + 8, w, 56); }), alphaTest: 0.3, roughness: 0.8 });
  // the start box: a painted outline round the Static Massive logo (assets/flags/staticmassive.webp, white paint on the road; their
  // mark, at the owner's request, for this game only); the outline alone until the picture has loaded
  { const [c, g] = cnv(512, 416); g.strokeStyle = '#f2f0e8'; g.lineWidth = 14; g.strokeRect(10, 10, 492, 396); const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    MAT.startBox = new THREE.MeshStandardMaterial({ alphaTest: 0.3, roughness: 0.8, map: t });
    const src = (window.PW_FLAGS || {}).staticmassive; if (src) { const im = new Image(); im.onload = () => { const w = 452, h = w * im.height / im.width; g.drawImage(im, 256 - w / 2, 208 - h / 2, w, h); t.needsUpdate = true; }; im.src = src; } }
  MAT.stairDown = new THREE.MeshStandardMaterial({ roughness: 0.9, map: T(512, 228, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = x % 64 ? '#1a1a1a' : '#2a2a28'; g.fillRect(x, 0, 32, h); } g.fillStyle = '#ffffff'; g.font = "900 54px Helvetica, Arial, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SUBWAY ↓', w / 2, h / 2); }) });
  MAT.elGreen = S2({ map: T(128, 128, (g, w, h) => { g.fillStyle = '#3e5a48'; g.fillRect(0, 0, w, h); dots(g, w, h, 900, ['#6a4a32', '#2a3a30', '#5a7a64'], 1, 4, 0.5); g.fillStyle = '#26342c'; for (let y = 8; y < h; y += 32) for (let x = 8; x < w; x += 32) { g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); } }), roughness: 0.7, metalness: 0.35 });
  MAT.elDeck = S2({ color: 0x2a2826, roughness: 0.9 }); MAT.iron = S2({ color: 0x2c2a28, roughness: 0.6, metalness: 0.5 });
  MAT.trainSide = S2({ map: T(256, 256, (g, w, h) => { g.fillStyle = '#b4b8bc'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#a4a8ac' : '#c4c8cc'; g.fillRect(x, 0, 4, h); }
    g.fillStyle = '#1a2028'; g.fillRect(24, 99, 208, 82); g.fillStyle = '#3a4a5a'; g.fillRect(28, 103, 98, 74); g.fillRect(130, 103, 98, 74); g.fillStyle = '#7a3aa8'; g.fillRect(0, 201, w, 21); }), roughness: 0.35, metalness: 0.75 });
  MAT.signRoute = new THREE.MeshBasicMaterial({ map: signTex(['Q  ·  SLACKVEGAN AV'], '#ffd23a', '#ff9a00', 512, 72), toneMapped: false });
  MAT.taxiYellow = S2({ color: 0xf2b40c, roughness: 0.32, metalness: 0.3 }); MAT.carRed = S2({ color: 0x8e1d1d, roughness: 0.32, metalness: 0.4 }); MAT.carBlue = S2({ color: 0x24427a, roughness: 0.32, metalness: 0.4 }); MAT.carSilver = S2({ color: 0xa8acb0, roughness: 0.3, metalness: 0.6 });
  MAT.carGlass = S2({ color: 0x1a2430, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.72 });
  MAT.taxiSign = S2({ color: 0xfff4c8, emissive: 0xffe08a, emissiveIntensity: 0.9 }); MAT.signalLit = B(0xff3a2a); MAT.globeGreen = B(0x6cff8a);
  MAT.trashBag = S2({ color: 0x141414, roughness: 0.25, metalness: 0.25 });
  MAT.shutter = S2({ map: T(64, 64, (g, w, h) => { for (let y = 0; y < h; y += 4) { g.fillStyle = y % 8 ? '#7c7e80' : '#a0a2a4'; g.fillRect(0, y, w, 4); } dots(g, w, h, 200, ['#5a3a2a', '#00000066'], 1, 3, 0.5); }), roughness: 0.55, metalness: 0.5 });
  MAT.shutterTag = S2({ map: T(256, 256, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#7c7e80' : '#a0a2a4'; g.fillRect(0, y, w, 8); }
    for (let i = 0; i < 7; i++) { g.strokeStyle = ['#ff3aa8', '#2ad0ff', '#f2f0e8', '#ffd21e', '#7aff3a', '#141414'][(R() * 6) | 0]; g.lineWidth = 3 + R() * 7; g.lineCap = 'round'; g.beginPath(); let x = R() * w, y = 40 + R() * 170; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.3) * 60; y += (R() - 0.5) * 50; g.quadraticCurveTo(x - 20, y - 30, x, y); } g.stroke(); } }), roughness: 0.55, metalness: 0.4 });
  const stripes = (a, b) => S2({ map: T(64, 64, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = a; g.fillRect(x, 0, 16, h); g.fillStyle = b; g.fillRect(x + 16, 0, 16, h); } }), roughness: 0.9, side: THREE.DoubleSide });
  MAT.awnRed = stripes('#b32a26', '#e8e0d0'); MAT.awnGreen = stripes('#2a6a3a', '#1e4a2a'); MAT.awnBlue = stripes('#2a4a8a', '#e8e0d0');
  // shop windows: bread glowing on trays, the deli's meats and cheeses (lit from inside: drawn unlit so they glow at dusk)
  MAT.winBakery = new THREE.MeshBasicMaterial({ toneMapped: false, map: T(512, 210, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#a8602a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const y of [70, 132, 192]) { g.fillStyle = '#5a3a22'; g.fillRect(0, y, w, 7); for (let x = 14; x < w - 20; x += 30 + R() * 18) { const loaf = R(); g.fillStyle = ['#c8843a', '#b06a2a', '#e0a050', '#8a4a1e'][(R() * 4) | 0]; g.beginPath(); if (loaf < 0.3) g.ellipse(x + 14, y - 8, 22, 6, 0, 0, 7); else g.ellipse(x + 10, y - 11, 12, 11, 0, 0, 7); g.fill(); g.fillStyle = '#ffe2a066'; g.beginPath(); g.ellipse(x + 8, y - 15, 5, 2, 0, 0, 7); g.fill(); } }
    g.fillStyle = '#f6efe2'; g.font = "italic 700 36px Georgia, serif"; g.textAlign = 'center'; g.fillText('Fresh Bread Daily', w / 2, 38); }) });
  MAT.winDeli = new THREE.MeshBasicMaterial({ toneMapped: false, map: T(320, 216, (g, w, h) => { g.fillStyle = '#d8b07a'; g.fillRect(0, 0, w, h); g.fillStyle = '#6a3a22'; g.fillRect(0, 20, w, 4);
    for (let x = 16; x < w; x += 26) { g.strokeStyle = '#3a2a1a'; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, 34); g.stroke(); g.fillStyle = ['#8a2a22', '#a8442a', '#6a1e18'][(R() * 3) | 0]; g.beginPath(); g.ellipse(x, 62, 9, 28, 0, 0, 7); g.fill(); }
    g.fillStyle = '#e8c040'; for (let x = 30; x < w; x += 70) { g.beginPath(); g.arc(x, 176, 26, 0, 7); g.fill(); g.fillStyle = '#c89a28'; g.fillRect(x - 26, 176, 52, 14); g.fillStyle = '#e8c040'; }
    g.fillStyle = '#b81e1e'; g.font = "900 30px 'Arial Black', sans-serif"; g.textAlign = 'center'; g.fillText('HEROS · SUBS', w / 2, 128); }) });
  const door = (col) => S2({ map: T(128, 256, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.fillStyle = '#2a3440'; g.fillRect(16, 16, 96, 120); g.fillStyle = '#c8a040'; g.fillRect(96, 150, 12, 6); g.strokeStyle = '#00000055'; g.lineWidth = 4; g.strokeRect(16, 150, 96, 90); }), roughness: 0.6 });
  MAT.doorBakery = door('#6a2a22'); MAT.doorDeli = door('#2a4a32');
  const neonSign = (k, lines, col, glow, w, h) => { MAT[k] = new THREE.MeshBasicMaterial({ map: signTex(lines, col, glow, w, h), toneMapped: false }); NYC.flick.push({ m: MAT[k], base: MAT[k].color.clone(), p: R() * 10 }); };
  neonSign('signBakery', ['BAKERY'], '#ffd7a0', '#ff9a40'); neonSign('signDeli', ['DELI'], '#ff6a5a', '#ff2a1a'); neonSign('signBodega', ['BODEGA · 24 HR'], '#5af0ff', '#00b8ff', 768, 80);
  neonSign('signOpen', ['OPEN'], '#ff4a5a', '#ff1a2a', 256, 200); neonSign('signFresh', ['FRESH'], '#f6e2a8', '#d89a40', 256, 96); neonSign('signDiner', ['D', 'I', 'N', 'E', 'R'], '#ff5ad2', '#ff1aa8', 160, 260);
  neonSign('signFinish', ['FINISH'], '#ff5ad2', '#ff1aa8', 384, 96); neonSign('signSpine', ['THE SPINE'], '#5af0ff', '#00b8ff', 512, 104); neonSign('signPawn', ['PAWN & LOAN'], '#ffd23a', '#ff9a00', 512, 120);
  neonSign('signSlackvegan', ['SLACKVEGAN', 'CITY'], '#ffd23a', '#ff5a1a', 1024, 372);
  // the subway station: white tile with a maroon band, terrazzo, the yellow platform edge, blue columns, the train's steel
  MAT.subwayTile = S2({ map: T(256, 256, (g, w, h) => { g.fillStyle = '#e8e4d8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b8b2a4'; g.lineWidth = 2; for (let y = 0; y <= h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let y = 0; y < h; y += 16) for (let x = ((y / 16) % 2) * 16; x <= w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } g.fillStyle = '#7a2a2a'; g.fillRect(0, 96, w, 10); dots(g, w, h, 900, ['#00000022', '#6a5a3a33'], 1, 3, 0.4); }), roughness: 0.35 });
  MAT.stationFloor = S2({ map: T(128, 128, (g, w, h) => { g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h); dots(g, w, h, 2500, ['#5a564e', '#a8a294', '#2a2a2a'], 1, 3, 0.5); }), roughness: 0.6 });
  MAT.stationCeil = S2({ color: 0x8e8a84, roughness: 0.95, emissive: 0x2a2a2c, emissiveIntensity: 0.6 }); MAT.stairStone = S2({ map: TX.concrete, color: 0x9a9488, roughness: 0.9 }); MAT.ballast = S2({ map: T(64, 64, (g, w, h) => { g.fillStyle = '#3a3632'; g.fillRect(0, 0, w, h); dots(g, w, h, 900, ['#5a5650', '#222', '#6a5a48'], 1, 4, 0.7); }), roughness: 1 });
  MAT.platformEdge = S2({ color: 0xe8c020, roughness: 0.6 }); MAT.tunnelBlack = S2({ color: 0x0c0c0e, roughness: 1 }); MAT.columnBlue = S2({ color: 0x2f5a8a, roughness: 0.5, metalness: 0.4 });
  MAT.carSteel = S2({ map: T(64, 64, (g, w, h) => { for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#b8bcc0' : '#d4d8dc'; g.fillRect(x, 0, 8, h); } }), roughness: 0.45, metalness: 0.3 });
  MAT.carSeat = S2({ color: 0xd8742a, roughness: 0.5 }); MAT.paintPurple = S2({ color: 0x7a3aa8, roughness: 0.5 });
  MAT.signStation = S2({ map: T(512, 80, (g, w, h) => { g.fillStyle = '#141414'; g.fillRect(0, 0, w, h); g.fillStyle = '#f4f4f0'; g.font = "700 44px Helvetica, Arial, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Slackvegan Av', w / 2 - 30, h / 2 + 2); g.fillStyle = '#ffcc1a'; g.beginPath(); g.arc(w - 50, h / 2, 26, 0, 7); g.fill(); g.fillStyle = '#141414'; g.font = "700 36px Helvetica, Arial, sans-serif"; g.fillText('Q', w - 50, h / 2 + 2); }), roughness: 0.6 });
  neonSign('signSubway', ['SUBWAY'], '#ffffff', '#7affb0', 384, 128);
  MAT.gateOrange = S2({ color: 0xff6a1a, roughness: 0.45, metalness: 0.2, emissive: 0x401400, emissiveIntensity: 0.6 });
  MAT.catFur = S2({ color: 0x18181a, roughness: 0.95 }); MAT.catWhite = S2({ color: 0xeeeae2, roughness: 0.95 }); MAT.catEye = B(0x9cff3a);
  MAT.terracotta = S2({ color: 0xb5562e, roughness: 0.9 }); MAT.cardboard = S2({ map: T(64, 64, (g, w, h) => { g.fillStyle = '#b48a5a'; g.fillRect(0, 0, w, h); dots(g, w, h, 300, ['#8a6640', '#c8a070'], 1, 2, 0.5); g.fillStyle = '#c8b48a'; g.fillRect(0, 28, w, 8); }), roughness: 0.95 });
  MAT.towerWood = S2({ map: T(128, 128, (g, w, h) => { for (let x = 0; x < w; x += 8) { g.fillStyle = ['#6e5038', '#7a5a3e', '#5e4430'][(x / 8) % 3]; g.fillRect(x, 0, 8, h); } dots(g, w, h, 600, ['#3a2a1e', '#9a7a5a'], 1, 3, 0.4); }), roughness: 0.95 });
  for (const [k, hex] of [['cloth1', 0xe8e4da], ['cloth2', 0x3d6ab0], ['cloth3', 0xd84a4a], ['cloth4', 0xe8c040]]) MAT[k] = S2({ color: hex, roughness: 0.95, side: THREE.DoubleSide });
  MAT.lightShaft = new THREE.MeshBasicMaterial({ color: 0xffc890, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide, fog: false });
}
// the city beyond the block: towers in the haze, lit windows, a few water towers on their roofs
function nycBackdrop() {
  const R = (() => { let s = 9191; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const [c, g] = cnv(256, 256); g.fillStyle = '#5a5258'; g.fillRect(0, 0, 256, 256); for (let y = 8; y < 256; y += 32) for (let x = 6; x < 256; x += 24) { const lit = R() < 0.14; g.fillStyle = lit ? '#ffcf88' : (R() < 0.5 ? '#3a3640' : '#46424c'); g.fillRect(x, y, 13, 18); }
  const t = tex(c), roof = new THREE.MeshStandardMaterial({ color: 0x3e3a3a, roughness: 0.95 });
  const mats = [0x8a7c78, 0x7a7484, 0x9a8a7a, 0x6e6a76].map(col => { const side = new THREE.MeshStandardMaterial({ map: t, color: col, roughness: 0.9, emissive: 0xffc070, emissiveMap: t, emissiveIntensity: 0.12 }); return [side, side, roof, roof, side, side]; });   // BoxGeometry's faces: ±x, ±y (the roof: a solid colour), ±z
  const TILE = 9, PITCH = TILE / 8, snap = v => Math.max(2, Math.round(v / PITCH)) * PITCH;   // whole windows on every face
  const tower = (w, h, d) => { const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const X = p.getX(i) + w / 2, Y = p.getY(i) + h / 2, Z = p.getZ(i) + d / 2;   // from the face's corner and the ground: windows start at the edge
      if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, Z / TILE, Y / TILE); else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, 0, 0); else uv.setXY(i, X / TILE, Y / TILE); }
    return g; };
  for (let i = 0; i < 150; i++) { const near = i < 70, a = R() * Math.PI * 2, rad = near ? 68 + R() * 32 : 105 + R() * 70, w = 9 + R() * 16, d = 9 + R() * 16, h = near ? 10 + R() * 24 : 18 + R() * (R() < 0.15 ? 120 : 55);   // a ring of low blocks round the map, towers beyond
    const x = Math.cos(a) * rad, z = 7 + Math.sin(a) * rad; if (Math.abs(z - 6) < 9 && Math.abs(x) > 60) continue;   // the El's corridor stays open: the avenue's vista
    const W = snap(w), D = snap(d), Hh = snap(h), geo = tower(W, Hh, D), m = new THREE.Mesh(geo, mats[i % 4]); m.position.set(x, Hh / 2, z); playRoot.add(m);
    if (R() < 0.3) { const wt = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3, 10), MAT.towerWood); wt.position.set(x + (R() - 0.5) * W * 0.5, Hh + 1.5, z); playRoot.add(wt); const cn = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1.3, 10), MAT.roofDark); cn.position.set(wt.position.x, Hh + 3.6, z); playRoot.add(cn); } }
}
function nycTick(dt) {
  NYC.t += dt; const t = NYC.t;
  for (const s of NYC.flick) { const k = Math.sin(t * 0.6 + s.p * 3) > 0.96 ? (Math.random() < 0.5 ? 0.2 : 1) : 1; s.m.color.copy(s.base).multiplyScalar(k); }   // a tired neon tube now and then
}
// ============================================================ Clappy Park (theme 'park'): shop windows and signs, paving, petals, the
// sky's clouds and the city round the block (owner, 2026-11-27: "get it all done"). Its own random stream, so no other map changes.
const PARK = { t: 0, petals: null, pv: null, clouds: null };
const PARK_SHOPS = [['CLAPPY CAFE', '#2e5a46', '#f4e6c4', 'cafe'], ['RAMEN', '#9a2a22', '#fff2dc', 'ramen'], ['BOBA TEA', '#f2b8d2', '#5a2a48', 'boba'], ['BOOKS', '#2a3a5e', '#f0d890', 'books'],
  ['FLOWERS', '#f4f0e6', '#c0446a', 'flowers'], ['ARCADE', '#2a1a40', '#7af0ff', 'arcade'], ['WHOOP SHOP', '#e0a020', '#1a1a1a', 'whoop'], ['LAUNDRY', '#8ac4dc', '#1e3c5a', 'laundry']];
function parkMats() {
  const R = (() => { let s = 2727; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const T = (w, h, draw, clamp) => { const [c, g] = cnv(w, h); draw(g, w, h); const t = tex(c); if (clamp) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  MAT.blossom2 = new THREE.MeshStandardMaterial({ color: 0xf9cfe0, roughness: 0.85, flatShading: true });   // paler
  MAT.blossom3 = new THREE.MeshStandardMaterial({ color: 0xe98db4, roughness: 0.85, flatShading: true });   // deeper
  MAT.streetLeaf = new THREE.MeshStandardMaterial({ color: 0x6f9a3e, roughness: 0.9, flatShading: true });
  // fallen petals: a round patch, thick in the middle and thinning out (laid flat once across it)
  MAT.petals = new THREE.MeshStandardMaterial({ alphaTest: 0.4, roughness: 0.9, map: T(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * w / 2 * (R() < 0.85 ? 0.8 : 1); if (R() > 1.15 - r / (w / 2)) continue;
      g.fillStyle = ['#f6b3cf', '#f9cfe0', '#e98db4', '#fbe2ec'][(R() * 4) | 0]; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2.2 + R() * 1.6, 1.3 + R(), R() * 3, 0, 7); g.fill(); } }, true) });
  // the plaza's pavers: 50 cm squares in two warm greys, a joint round each (1 m to the tile)
  MAT.plazaPave = new THREE.MeshStandardMaterial({ roughness: 0.85, map: T(256, 256, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = ['#c9bfae', '#b9ad9a', '#d3c9b8', '#bfb3a2'][(R() * 4) | 0]; g.fillRect(x * 128, y * 128, 128, 128); }
    for (let i = 0; i < 3000; i++) { g.globalAlpha = 0.25 * R(); g.fillStyle = ['#8a8070', '#e6ddcc', '#6a6258'][(R() * 3) | 0]; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } g.globalAlpha = 1;
    g.strokeStyle = '#857a6a'; g.lineWidth = 5; for (let k = 0; k <= 256; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); } }) });
  MAT.paveBorder = new THREE.MeshStandardMaterial({ color: 0x8e8478, roughness: 0.85, map: TX.concrete });
  MAT.playPad = new THREE.MeshStandardMaterial({ color: 0x5a9a86, roughness: 1, map: TX.rubberMat });
  MAT.parkGrass = new THREE.MeshStandardMaterial({ roughness: 0.95, map: T(128, 128, (g, w, h) => { g.fillStyle = '#5e8a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.globalAlpha = 0.5 * R(); g.fillStyle = ['#4a7430', '#78a44a', '#3e6228', '#8ab45a'][(R() * 4) | 0]; g.fillRect(R() * w, R() * h, 1, 2 + R() * 3); } g.globalAlpha = 1; }) });
  MAT.soil = new THREE.MeshStandardMaterial({ roughness: 1, map: T(64, 64, (g, w, h) => { g.fillStyle = '#4a3626'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = ['#3a2a1e', '#6a5038', '#2e2018'][(R() * 3) | 0]; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } }) });
  MAT.planterStone = new THREE.MeshStandardMaterial({ color: 0xb8ab98, roughness: 0.8, map: TX.concrete });
  for (const [k, hex] of [['flowerRed', 0xd8344a], ['flowerYellow', 0xf2c838], ['flowerWhite', 0xf2eee6], ['flowerPurple', 0x8a5ac8]]) MAT[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, flatShading: true });
  MAT.fountainWater = new THREE.MeshStandardMaterial({ color: 0x5a9ab8, roughness: 0.08, metalness: 0.3, emissive: 0x0e2a38, emissiveIntensity: 0.6 });
  MAT.fountainStone = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.7, map: TX.concrete });
  MAT.kerb = new THREE.MeshStandardMaterial({ color: 0xa8a49c, roughness: 0.85, map: TX.concrete });
  MAT.manhole = new THREE.MeshStandardMaterial({ alphaTest: 0.4, roughness: 0.55, metalness: 0.4, map: T(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#3a3a3c'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.strokeStyle = '#59595c'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke(); g.save(); g.beginPath(); g.arc(64, 64, 50, 0, 7); g.clip(); g.lineWidth = 4; for (let k = -64; k < 64; k += 12) { g.beginPath(); g.moveTo(64 + k, 0); g.lineTo(64 + k, 128); g.stroke(); g.beginPath(); g.moveTo(0, 64 + k); g.lineTo(128, 64 + k); g.stroke(); } g.restore(); }, true) });
  MAT.bikeLane = new THREE.MeshStandardMaterial({ color: 0x3f7f52, roughness: 0.85, map: TX.asphalt });
  MAT.shelterGlass = new THREE.MeshStandardMaterial({ color: 0xa8c8d8, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  MAT.busSign = new THREE.MeshStandardMaterial({ roughness: 0.5, map: T(128, 128, (g, w, h) => { g.fillStyle = '#1e5aa8'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = "900 56px Arial, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BUS', 64, 52); g.font = "700 26px Arial, sans-serif"; g.fillText('CLAPPY PK', 64, 98); }, true) });
  // shops: a sign board and a lit window (display, counter, a glass door on the right) for each
  for (const [name, bg, fg, kind] of PARK_SHOPS) { const id = kind;
    MAT['shopSign_' + id] = new THREE.MeshStandardMaterial({ roughness: 0.6, map: T(512, 96, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha = 1;
      g.fillStyle = fg; g.font = `900 ${name.length > 9 ? 46 : 54}px 'Arial Black', Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, h / 2 + 3); }, true) });
    const win = T(512, 416, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff1d0'); gr.addColorStop(1, '#d8b888'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // goods on two shelves and a counter, by kind
      const col = { cafe: ['#6a3e22', '#e8d8b8', '#2e5a46'], ramen: ['#c83a2a', '#f4e2c0', '#3a2218'], boba: ['#f2a8c8', '#c89a6a', '#7ac8a8'], books: ['#3a4a8a', '#a83a2a', '#d8a838', '#2a6a4a'],
        flowers: ['#d8344a', '#f2c838', '#8a5ac8', '#4a8a3a'], arcade: ['#ff3fd0', '#55f6ff', '#2a1a40'], whoop: ['#1a1a1a', '#e0a020', '#c8323a'], laundry: ['#e8e8ec', '#9aa8b4', '#5a6a7a'] }[kind];
      for (const y of [120, 210]) { g.fillStyle = '#6a5038'; g.fillRect(14, y, w * 0.68, 8); for (let x = 22; x < w * 0.66; x += 18 + R() * 16) { g.fillStyle = col[(R() * col.length) | 0]; const s = kind === 'books' ? [10, 34] : kind === 'arcade' ? [26, 40] : [16, 18 + R() * 14]; g.fillRect(x, y - s[1], s[0], s[1]); } }
      g.fillStyle = '#8a6a4a'; g.fillRect(14, 300, w * 0.68, 70); g.fillStyle = '#00000022'; g.fillRect(14, 300, w * 0.68, 8);
      if (kind === 'arcade') { g.fillStyle = '#1a0e2a'; g.fillRect(0, 0, w * 0.72, h); for (let x = 30; x < w * 0.66; x += 80) { g.fillStyle = '#2a2440'; g.fillRect(x, 150, 56, 220); g.fillStyle = ['#ff3fd0', '#55f6ff', '#b6ff3c'][(x / 80 | 0) % 3]; g.fillRect(x + 8, 170, 40, 34); } }
      if (kind === 'laundry') { for (let x = 40; x < w * 0.66; x += 90) { g.fillStyle = '#e8e8ec'; g.fillRect(x, 250, 70, 110); g.fillStyle = '#5a6a7a'; g.beginPath(); g.arc(x + 35, 305, 24, 0, 7); g.fill(); } }
      // mullions and the door
      g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); g.fillRect(0, 0, 10, h); g.fillRect(w * 0.72, 0, 12, h); g.fillRect(w - 10, 0, 10, h);
      g.fillStyle = '#3e4a56'; g.fillRect(w * 0.72 + 12, 10, w * 0.28 - 22, h - 20); g.fillStyle = '#fff1d0aa'; g.fillRect(w * 0.72 + 26, 26, w * 0.28 - 50, h * 0.55); g.fillStyle = '#c8a040'; g.fillRect(w * 0.72 + 22, h * 0.55, 8, 30);
      g.fillStyle = '#ffffff55'; g.beginPath(); g.moveTo(40, 10); g.lineTo(110, 10); g.lineTo(30, h - 10); g.lineTo(10, h - 10); g.fill();   // a glint
      g.fillStyle = bg; g.font = "700 30px Georgia, serif"; g.textAlign = 'center'; g.fillText(name.toLowerCase(), w * 0.36, 60); }, true);
    MAT['shopWin_' + id] = new THREE.MeshStandardMaterial({ map: win, emissive: 0xffffff, emissiveMap: win, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1 }); }
}
// the city round the block: low blocks past the map's edge, towers beyond, hazy; clouds in the sky (drawn behind everything)
function parkBackdrop() {
  const R = (() => { let s = 5151; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const [c, g] = cnv(256, 256); g.fillStyle = '#b8b4b0'; g.fillRect(0, 0, 256, 256); for (let y = 10; y < 256; y += 32) for (let x = 8; x < 256; x += 24) { g.fillStyle = R() < 0.5 ? '#8a96a4' : '#a2acb6'; g.fillRect(x, y, 12, 18); }
  const t = tex(c), roofM = new THREE.MeshStandardMaterial({ color: 0x9a989a, roughness: 1 });
  const mats = [0xb8b4b0, 0xa4acb8, 0xbcb4a6, 0x9ca6b2, 0xc4bcb4].map(col => { const side = new THREE.MeshStandardMaterial({ map: t, color: col, roughness: 0.95, emissive: 0x8c98a6, emissiveIntensity: 0.18 }); return [side, side, roofM, roofM, side, side]; });   // pre-hazed: pale, soft, a little blue
  const CX = -20, placed = [], keep = (x, z, W, D) => { if (x + W / 2 > -110 && x - W / 2 < 70 && z + D / 2 > -70 && z - D / 2 < 70) return false;   // never inside the map's edge walls
    if (placed.some(p => Math.abs(p.x - x) < (p.W + W) / 2 + 2 && Math.abs(p.z - z) < (p.D + D) / 2 + 2)) return false; placed.push({ x, z, W, D }); return true; };
  for (let i = 0; i < 160; i++) { const near = i < 80, a = R() * Math.PI * 2, rad = near ? 100 + R() * 40 : 150 + R() * 70, W = 10 + R() * 18, D = 10 + R() * 18, H = near ? 8 + R() * 18 : 20 + R() * (R() < 0.2 ? 90 : 45);
    const x = CX + Math.cos(a) * rad, z = Math.sin(a) * rad; if (!keep(x, z, W, D)) continue;
    const geo = new THREE.BoxGeometry(W, H, D), uv = geo.attributes.uv, p = geo.attributes.position, n = geo.attributes.normal;
    for (let k = 0; k < p.count; k++) { const X = p.getX(k) + W / 2, Y = p.getY(k) + H / 2, Z = p.getZ(k) + D / 2; if (Math.abs(n.getX(k)) > 0.5) uv.setXY(k, Z / 8, Y / 8); else if (Math.abs(n.getY(k)) > 0.5) uv.setXY(k, 0, 0); else uv.setXY(k, X / 8, Y / 8); }
    const m = new THREE.Mesh(geo, mats[i % 5]); m.position.set(x, H / 2, z); playRoot.add(m); }
  // clouds: flattened white clusters, within the cameras' 400 m reach from anywhere on the map
  const top = new THREE.MeshBasicMaterial({ color: 0xf4f6fa, fog: false }), belly = top;   // one white: where the puffs cross nothing can flicker
  const grp = new THREE.Group(); grp.renderOrder = -3500;
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + R() * 0.3, rad = 140 + R() * 50, y = 62 + R() * 30, s = 10 + R() * 12, cx = CX + Math.cos(a) * rad, cz = Math.sin(a) * rad, n = 5 + (R() * 4 | 0);
    const parts = []; for (let k = 0; k < n; k++) parts.push([(R() - 0.5) * s * 3.2, (R() - 0.3) * s * 0.5, (R() - 0.5) * s * 1.4, s * (0.6 + R() * 0.6)]);
    parts.sort((p, q) => p[1] - q[1]);
    for (const [dx, dy, dz, r] of parts) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), dy < 0 ? belly : top); m.scale.set(1, 0.55, 1); m.position.set(cx + dx, y + dy, cz + dz); m.renderOrder = -3500 + (dy < 0 ? 0 : 1); grp.add(m); } }
  playRoot.add(grp); PARK.clouds = grp; window.__pwPark = PARK;   // for the check shots
  // drifting petals round the sakura trees
  const trees = world.objs.filter(o => o.name === 'Sakura Tree' && o.round).map(o => ({ x: o.round.c.x, z: o.round.c.z, y: (o.round.under + o.round.over) / 2, r: o.round.r, g: o.round.under - 2.2 * o.round.r / 1.8 }));
  if (!trees.length) { PARK.petals = null; return; }
  const N = 360, pos = new Float32Array(N * 3), pv = [];
  const spawn = (i, anyY) => { const tr = trees[i % trees.length], a = R() * Math.PI * 2, r = Math.sqrt(R()) * tr.r; pv[i] = { tr, vy: 0.25 + R() * 0.3, ph: R() * 6, sw: 0.2 + R() * 0.4 };
    pos[i * 3] = tr.x + Math.cos(a) * r; pos[i * 3 + 2] = tr.z + Math.sin(a) * r; pos[i * 3 + 1] = anyY ? tr.g + R() * (tr.y - tr.g) : tr.y - R() * 0.8; };
  for (let i = 0; i < N; i++) spawn(i, true);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sp = (() => { const [c2, g2] = cnv(32, 32); g2.fillStyle = '#fff'; g2.beginPath(); g2.ellipse(16, 16, 14, 8, 0.5, 0, 7); g2.fill(); return new THREE.CanvasTexture(c2); })();
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xf8bcd4, size: 0.07, map: sp, alphaTest: 0.5, transparent: false })); pts.frustumCulled = false; playRoot.add(pts);
  PARK.petals = pts; PARK.pv = { pv, spawn, R };
}
function parkTick(dt) {
  PARK.t += dt; const t = PARK.t;
  if (PARK.clouds) PARK.clouds.rotation.y = t * 0.0015;   // about one turn in an hour
  if (!PARK.petals) return;
  const a = PARK.petals.geometry.attributes.position, { pv, spawn } = PARK.pv;
  for (let i = 0; i < a.count; i++) { const p = pv[i]; let y = a.getY(i) - p.vy * dt; const x = a.getX(i) + (0.35 + Math.sin(t * 0.9 + p.ph) * p.sw) * dt, z = a.getZ(i) + Math.cos(t * 0.7 + p.ph * 1.3) * p.sw * 0.6 * dt;
    if (y < p.tr.g + 0.02) { spawn(i, false); continue; } a.setXYZ(i, x, y, z); }
  a.needsUpdate = true;
}
// the ground with holes in it (world.groundCuts [{ x0, x1, z0, z1 }]: Slackvegan's subway stair), laid in the x-y plane and turned
// flat like the plain ground; one texture tile per 4 m
function groundWithCuts(GS, cuts) {
  const sh = new THREE.Shape(); sh.moveTo(-GS / 2, -GS / 2); sh.lineTo(GS / 2, -GS / 2); sh.lineTo(GS / 2, GS / 2); sh.lineTo(-GS / 2, GS / 2); sh.closePath();
  for (const c of cuts) { const p = new THREE.Path(); p.moveTo(c.x0, -c.z1); p.lineTo(c.x1, -c.z1); p.lineTo(c.x1, -c.z0); p.lineTo(c.x0, -c.z0); p.closePath(); sh.holes.push(p); }   // y = -z once it is turned flat
  const g = new THREE.ShapeGeometry(sh), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4); return g;
}
function buildScene() {
  const VAPOR = world.theme === 'vapor';
  const IND = world.theme === 'industrial';   // More Warehouse: indoors, under a roof with skylights; lit mostly by its own lights
  const PNW = world.theme === 'pnw';   // Moose Knuckle Park: cool, leafy shade in an inland-BC mountain town
  const VICE_ = world.theme === 'vice', DUSK_ = world.theme === 'dusk', NYC_ = world.theme === 'nyc';
  const PARK_ = world.theme === 'park', LIFT = PARK_ ? 1.05 : 1;   // Clappy Park: 5 % brighter (owner, 2026-11-27: "a little dark")
  const LAB = world.theme === 'lab';   // the Training Room: flat, even, shadowless light from the high windows; nothing else   // Slackvegan City: golden hour down the avenue
  if (VAPOR) vaporBackdrop(); else if (VICE_) viceBackdrop(); else if (DUSK_) duskBackdrop(); else {
  // sky
  const [sc, sg] = cnv(16, 512); const gr = sg.createLinearGradient(0, 0, 0, 512);
  if (LAB) { gr.addColorStop(0, '#dfe3e6'); gr.addColorStop(1, '#c9cdd0'); }
  else if (NYC_) { gr.addColorStop(0, '#4e6a9e'); gr.addColorStop(0.4, '#9aaabc'); gr.addColorStop(0.56, '#f0c890'); gr.addColorStop(0.64, '#f49a58'); gr.addColorStop(0.74, '#b8705a'); gr.addColorStop(1, '#5a4a48'); }
  else if (PNW) { gr.addColorStop(0, '#4f86c6'); gr.addColorStop(0.42, '#8fb6dc'); gr.addColorStop(0.6, '#cfe0ec'); gr.addColorStop(0.72, '#b4c2c4'); gr.addColorStop(1, '#5a6452'); }   // clear winter blue (the owner's photos, 2026-11-19)
  else { gr.addColorStop(0, '#5f86b3'); gr.addColorStop(0.45, '#a9b9c7'); gr.addColorStop(0.62, '#e7c49a'); gr.addColorStop(0.75, '#d99a6c'); gr.addColorStop(1, '#6e5a4a'); }
  sg.fillStyle = gr; sg.fillRect(0, 0, 16, 512); const skyT = new THREE.CanvasTexture(sc); skyT.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), new THREE.MeshBasicMaterial({ map: skyT, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -4000; playRoot.add(sky);   // drawn first: the backdrops' mountains paint over it
  // lights
  if (LAB) playRoot.add(new THREE.HemisphereLight(0xf2f5f7, 0x9a9da0, 2.7)); else playRoot.add(new THREE.HemisphereLight(NYC_ ? 0xffd8b4 : IND ? 0xdfe6f0 : PNW ? 0xb8cfe6 : PARK_ ? 0xb4c8e4 : 0xa9c0e0, NYC_ ? 0x6a5244 : IND ? 0x6a645a : PNW ? 0x74684e : PARK_ ? 0x7d6a52 : 0x5a4532, (NYC_ ? 1.7 : IND ? 1.9 : PNW ? 2.1 : PARK_ ? 1.2 : 0.9) * LIFT));   /* Clappy: the shade lifted (owner, 2026-11-27) */   // Moose: brighter sky fill and ground bounce, so the shade under the cedars stays readable for trippies (owner, 2026-11-19)
  // Moose: a clear winter afternoon, low sun from the south-west (the owner's photos from the four corners, 2026-11-19)
  const sun = new THREE.DirectionalLight(NYC_ ? 0xffb066 : PNW ? 0xffe2bc : 0xffcf98, (NYC_ ? 3.1 : PNW ? 2.7 : 2.6) * LIFT);
  if (NYC_) sun.position.set(-62, 17, 9); else if (PNW) sun.position.set(-26, 17, 30); else sun.position.set(-30, 22, 18);   /* Slackvegan: low in the west, straight down the avenue: long golden shadows */ sun.castShadow = !LAB; if (LAB) sun.intensity = 0.55;   /* (a comment ending the line above once swallowed this: no sun position or shadows on any map) */
  sun.shadow.mapSize.set(2048, 2048); const sh = sun.shadow.camera; { const B = world.bounds || { x: [-32, 32], z: [-32, 32] }, R = Math.max(32, ...B.x.map(Math.abs), ...B.z.map(Math.abs)) + 4; if (world.id === 'playground') { sh.left = -56; sh.right = 32; } else { sh.left = -R; sh.right = R; sh.top = R; sh.bottom = -R; if (R > 48) sun.shadow.mapSize.set(4096, 4096); } if (world.id === 'playground') { sh.top = 32; sh.bottom = -32; } sh.far = Math.max(120, R * 2.6); } sh.near = 1; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  playRoot.add(sun); playRoot.add(sun.target);
  // ground
  const GS = NYC_ || PARK_ ? 480 : 240, gnd = new THREE.Mesh(world.groundCuts ? groundWithCuts(GS, world.groundCuts) : new THREE.PlaneGeometry(GS, GS), LAB ? MAT.labFloor : PNW ? MAT.grass : MAT.asphalt); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; gnd.renderOrder = -10;   /* Slackvegan: a bigger ground, the city's towers stand out past the usual one */
  TX.asphalt.repeat.set(1, 1); const guv = gnd.geometry.attributes.uv; if (!world.groundCuts) for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * GS / 4, guv.getY(i) * GS / 4);
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
    const m = new THREE.Mesh(g, zm); m.rotation.x = -Math.PI / 2; if (z.ry) m.rotation.z = z.ry; m.position.set(z.c.x, z.c.y, z.c.z); m.receiveShadow = true; m.renderOrder = -9 + (z.mat === 'rubberMat' ? 0 : 1) + world.zones.indexOf(z) * 0.01; playRoot.add(m);
  }
  buildObjects();
  if (VAPOR || VICE_ || DUSK_) return;
  // lamp lights
  if (IND) scene.fog = new THREE.Fog(0x24252b, 30, 140);
  if (LAB) scene.fog = new THREE.Fog(0xb9bdc0, 60, 220);
  if (PNW) { scene.fog = new THREE.Fog(0xc6d4de, 60, 220); pnwBackdrop(); }
  if (NYC_) { scene.fog = new THREE.Fog(0xd8b08a, 55, 230); nycBackdrop(); }
  if (PARK_) { scene.fog = new THREE.Fog(0xbcc6ce, 50, 270); parkBackdrop(); }   // Clappy: a clear blue haze, so the city round the block reads
  // lamp lights are made with the objects (buildObjects)
  if (world.id !== 'playground') return;   // the skyline and power lines are the playground's own surroundings
  // skyline beyond the fence (no collision)
  const sk = new THREE.MeshStandardMaterial({ color: 0x4d4a52, roughness: 1, map: TX.concrete });
  for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2, R = 55 + rnd() * 35, w = 6 + rnd() * 14, h = 8 + rnd() * 30;
    const x = Math.cos(ang) * R, z = Math.sin(ang) * R; if (z < -20 && Math.abs(x) < 18) continue;
    if (x - w / 2 < -12 && x + w / 2 > -62 && Math.abs(z) < 28 + w / 2) continue;   // keep the Trick Park (west) clear
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
  else if (v.graffiti === 'north') { w = h.x * 2; hh = h.y * 2; pos = new THREE.Vector3(v.c.x, v.c.y, v.c.z - h.z - e); rotY = Math.PI; }
  else if (v.graffiti === 'east') { w = h.z * 2; hh = h.y * 2; pos = new THREE.Vector3(v.c.x + h.x + e, v.c.y, v.c.z); rotY = Math.PI / 2; }
  else if (v.graffiti === 'top') { w = h.x * 2; hh = h.z * 2; pos = new THREE.Vector3(v.c.x, v.c.y + h.y + e, v.c.z); rotX = -Math.PI / 2; opts = { top: true, big: 0.4 }; }
  if (hh > 10) opts = { heaven: true, stencil: 'NO WHOOPS', ppm: 64 };
  if (w < 3) opts.big = (opts.big || 1) * 0.5;
  // the pilot's pieces: a big wall of all three on the building, one per graffiti-wall section, small ones on props
  const turn = () => ['heyhey', 'mopenguinz', 'roguemonkey', 'clappy', 'fpvyourworld', 'byteme', 'ridgeripper', 'rwdc'][artTurn++ % 8];   // the pilot's pieces, and friends of the project (MoPenguinz FPV, ByTe_Me, Rogue Monkey FPV, FPV Your World, RidgeRipper FPV)
  const AH = { roguemonkey: 0.7, ridgeripper: 0.55 };   // the wide logos painted a little smaller, so they fit the wall like the rest
  const piece = (x, y, h, rot) => { const name = turn(); return { name, x, y, h: h * (AH[name] || 1), rot }; };
  if (v.art) opts.art = v.art;   // a map can say exactly which pieces go where
  else if (hh > 10) opts.art = [{ name: 'clappy', x: 0.17, y: 6.2, h: 6.4, rot: -0.04 }, { name: 'heyhey', x: 0.5, y: 6.6, h: 4.6, rot: 0.02 }, { name: 'rwdc', x: 0.83, y: 6.0, h: 5.2, rot: 0.05 }];
  else if (v.graffiti === 'east' && w > 12) opts.art = [piece(0.2 + rnd() * 0.12, 1.75, 2.2, (rnd() - 0.5) * 0.12), piece(0.66 + rnd() * 0.12, 1.75, 2.2, (rnd() - 0.5) * 0.12)];   // long sections carry two
  else if (v.graffiti === 'east' && w > 4) opts.art = [piece(0.25 + rnd() * 0.5, 1.75, 2.2, (rnd() - 0.5) * 0.12)];
  else if (v.graffiti === 'south' && w > 2.5 && hh < 2) opts.art = [{ name: 'clappy', x: 0.5, y: hh * 0.5, h: hh * 0.86, rot: 0.06 }];
  else if (v.graffiti === 'south' && w < 2.5 && hh < 1.5) opts.art = [{ name: 'rwdc', x: 0.5, y: hh * 0.52, h: hh * 0.85 }];
  const t = graffitiTexture(w, hh, hh > 10 ? 1.4 : 1, opts);
  const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat); m.position.copy(pos);
  const grp = new THREE.Group(); grp.position.copy(pos); m.position.set(0, 0, 0);
  if (v.graffiti === 'top') { m.rotation.x = -Math.PI / 2; grp.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ'); }
  else m.rotation.y = rotY;
  grp.add(m); m.receiveShadow = true; (objRoot || playRoot).add(grp);
}

// ============================================================ drone model
let droneMesh, propGroups = [], propDiscs = [], droneLens = null;   // droneLens: where the model's camera lens is (body frame): the FPV view sits there
// ---- The whoop, built from its parts so that what is in the Garage is what you see: frame size, duct style and colour,
// motor size and bell colour (from its name, e.g. 0702 = 7 mm x 2 mm stator), prop size / blade count / colour, the
// battery's size and cell count, the canopy that comes with the electronics, and the pilot's own colours (spec.look).
const WHOOP_LOOK = {
  // Air frames (from the pilot's reference photos): a thin coloured ring round each prop, standing on three slim legs that
  // run down to the motor mount; slightly see-through plastic. Meteor and 2S frames keep a full duct wall.
  frames: { air65: { c: 0x7fd0f2, lip: 0.0008, ring: true, clear: 0.9, braces: 4, mesh: 'air65' }, air65champ: { c: 0x5a5d63, lip: 0.0007, ring: true, clear: 0.72, braces: 3 }, meteor65: { c: 0x1f4fd6, lip: 0.0015 }, air75: { c: 0xe6e8ea, lip: 0.0009, ring: true, clear: 0.6, braces: 4 }, meteor75: { c: 0xd62828, lip: 0.0015 },
    whoop75_2s: { c: 0x2b2f36, lip: 0.0016 }, fractal65: { c: 0x1c1d20, duct: 0x2e3238, fractal: true, lip: 0.0012, carbon: true }, fractal75: { c: 0x1c1d20, duct: 0x2e3238, fractal: true, lip: 0.0014, carbon: true }, fractal75pro: { c: 0x1c1d20, duct: 0x2e3238, fractal: true, lip: 0.0015, carbon: true }, whoop85_2s: { c: 0x2b2f36, lip: 0.0019 } },
  motors: { m0702se_23k: 0x3b82f6, m0702se_27k: 0xe11d48, m0702ii_30k: 0xf5b301, m0702ii_36k: 0x9333ea, evo_31k: 0x111111, evo_33k: 0xc9a227, m0802_19k: 0x10b981, m1002_19k: 0xf97316, m0802_16k: 0x64748b, m1102_13k: 0x0ea5e9, m1103_11k: 0xef4444 },
  props: { gf1219s: 0xf2f4f6, hq31ul: 0xcfeaff, gf1207: 0xf6f0e6, p40_2b: 0xf2f4f6, p40_3b: 0xeef1f4, p51_3b: 0x4cc9f0, p51_4b: 0xf72585, p31_3d: 0xf4f4f5, p40_3d: 0xf4f4f5, p45_2b: 0xeef1f4, p45_3b: 0xeef1f4 },
  // batteries from their published sizes (L x W x H mm, the 1S plug housing included; 2S packs are two cells stacked with an XT30 on
  // leads): c = the wrap, s = the label band, plug = 'bt2' | 'xt30'. Look only: the physics uses PARTS.batteries' mass.
  batteries: { b260: { d: [54.5, 10, 6], c: 0x1b1c1f, s: 0xff5a1f, plug: 'bt2' }, b300: { d: [67.3, 11.8, 6.1], c: 0x1e2024, s: 0xd9e021, plug: 'bt2' },
    b380: { d: [62, 12, 7], c: 0x1e2024, s: 0x22c3e6, plug: 'bt2' }, lava280: { d: [54, 10, 6], c: 0x2f9e44, s: 0xf2d21b, plug: 'bt2' }, lava320: { d: [64, 10, 6], c: 0x2f9e44, s: 0xf2d21b, plug: 'bt2' },
    b450: { d: [62, 15.5, 6.7], c: 0x1e2024, s: 0x8b5cf6, plug: 'bt2' }, b550: { d: [70, 15, 6.5], c: 0x2f9e44, s: 0xf2d21b, plug: 'bt2' },
    b2s300: { d: [45, 17, 12], c: 0x1e2024, s: 0xdc2626, plug: 'xt30' }, b2s450: { d: [63, 15.5, 13.5], c: 0x1b1c1f, s: 0xff5a1f, plug: 'xt30' }, b2s550: { d: [66, 16, 15], c: 0x0f766e, s: 0xe5e7eb, plug: 'xt30' } },
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
  const frameC = lookHex(L.frame, FL.c), frameMat = std(frameC, FL.clear ? { transparent: true, opacity: FL.clear, roughness: 0.3 } : FL.carbon ? { roughness: 0.32, metalness: 0.35 } : {});   // Fractal frames: a glossy carbon plate, separate nylon ducts
  const ductMat = std(FL.duct != null && !L.frame ? FL.duct : frameC, { side: THREE.DoubleSide, transparent: !!FL.clear, opacity: FL.clear || 1, roughness: 0.3 });
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
    } else if (FL.fractal) {   // Fractal (the owner's photos, 2026-11-20): a separate thin nylon ring round each prop on four slim spokes down to the motor mount
      const pY = 0.0018 + bellH * 1.22, dH = 0.0068, dY = pY - 0.0012, rr = p.rDuct;
      at(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, dH, 36, 1, true), ductMat), dY);
      for (const dy of [dH / 2, -dH / 2]) { const lip = at(new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0006, 6, 36), ductMat), dY + dy); lip.rotation.x = Math.PI / 2; }
      const a0 = Math.atan2(m.pos.x, m.pos.z) + Math.PI / 4;
      for (let k = 0; k < 4; k++) { const a = a0 + k / 4 * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a); g.add(pipeMesh({ x: m.pos.x + sx * rr * 0.98, y: dY - dH / 2 + 0.0008, z: m.pos.z + cz * rr * 0.98 }, { x: m.pos.x + sx * (bellR + 0.0012), y: -0.0012, z: m.pos.z + cz * (bellR + 0.0012) }, 0.0006, ductMat)); }
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
    if (FL.fractal) { const L0 = Math.hypot(m.pos.x, m.pos.z), arm = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0015, L0 - 0.006), frameMat); arm.position.set(m.pos.x * (0.5 + 0.003 / L0), -0.0015, m.pos.z * (0.5 + 0.003 / L0)); arm.rotation.y = Math.atan2(m.pos.x, m.pos.z); g.add(arm); }   // a slim 1.5 mm carbon arm out to the motor
    else if (!ring) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.0042, 0.0026, Math.hypot(m.pos.x, m.pos.z) * 2 - p.rDuct * 1.7), frameMat); arm.position.set(m.pos.x / 2, -0.0012, m.pos.z / 2); arm.rotation.y = Math.atan2(m.pos.x, m.pos.z); g.add(arm); }
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
  } else if (FL.fractal) {   // a narrow 1.5 mm carbon plate under the board (the arms run out from it), the AIO bare on red standoffs
    add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0015, 0.03), frameMat), 0, -0.0015, 0.001);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.0015, 0.012), frameMat), 0, -0.0015, -0.018);   // the nose the camera mount sits on
    add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.001, 0.026), pcb), 0, 0.0032, 0.001);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0038, 10), std(0xd93a2b, { roughness: 0.6 })), x * 0.0115, 0.0011, 0.001 + z * 0.0115); add(new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0008, 8), steel), x * 0.0115, 0.0041, 0.001 + z * 0.0115); }
    for (const [x, z, w, d, c] of [[0, 0.002, 0.007, 0.007, 0x16181c], [-0.0075, -0.004, 0.003, 0.004, 0x16181c], [0.007, -0.004, 0.0035, 0.003, 0x8a8f98], [0, 0.0105, 0.005, 0.003, 0xe9e3d2], [0.008, 0.007, 0.0025, 0.0025, 0xb87333]]) add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.0011, d), std(c, { metalness: 0.4 })), x, 0.0042, z);
  } else {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.0024, 0.029), frameMat), 0, -0.0012, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0012, 0.026), pcb), 0, 0.003, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.0012, 8), steel), x * 0.0118, 0.0042, z * 0.0118); add(new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.004, 8), std(0xd9c9a3, { roughness: 0.8 })), x * 0.0118, 0.002, z * 0.0118); }
    for (const [x, z, w, d, c] of [[-0.006, 0.006, 0.006, 0.006, 0x16181c], [0.007, 0.004, 0.004, 0.003, 0x16181c], [0.006, -0.007, 0.003, 0.005, 0x8a8f98], [-0.008, -0.006, 0.0025, 0.0025, 0xb87333]]) add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.0012, d), std(c, { metalness: 0.4 })), x, 0.0042, z);
  }
  const canC = lookHex(L.canopy, CL.c), canMat = std(canC, { roughness: 0.3, emissive: canC, emissiveIntensity: 0.05, transparent: !!CL.bridge, opacity: CL.bridge ? 0.78 : 1, side: THREE.DoubleSide });
  // the Air canopy on a ring frame is the printed "Beast Brain" by _tcmore (from the STL the pilot sent): three tabs that sit on
  // the side and front posts, and a hood the camera looks out of. The plain bridge is still there as a choice.
  const printed = ring && CL.bridge && (sp.canopy || 'beastbrain') === 'beastbrain' ? meshGeometry('beastbrain') : null, baseY = FM ? FT + 0.001 : 0.0062;
  let tiltR = tn.camTilt * Math.PI / 180, camY = (ring && CL.bridge ? 0.0066 : 0.0045) + CL.h * 0.62, camZ = ring && CL.bridge ? -0.0128 : -CL.w * 0.82;
  const fr = !!FL.fractal, frontZ = fr ? Math.min(...p.motors.map(m => m.pos.z)) : 0;
  if (fr) { camY = 0.0042; camZ = Math.max(frontZ * 0.92, -0.026); }   // Fractal: the camera sits low at the front between the two front ducts, ahead of the board
  if (printed) { tiltR = 0; camY = baseY + 0.014 * post / 0.0178; camZ = -0.0112 * post / 0.0178; }   // the hood holds the camera level, its lens 14 mm above the tabs
  if (printed) { const pm = std(canC, { roughness: 0.55, side: THREE.DoubleSide }); add(new THREE.Mesh(printed, pm), 0, baseY, 0).scale.setScalar(post / 0.0178);
    for (const [x, z] of [[post, 0], [-post, 0], [0, -post]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0009, 8), steel), x, baseY + 0.0015, z);   // the three screws through its tabs
  } else if (fr) {   // a purple TPU camera mount: two side cheeks and a base on the frame's nose, the camera held between them
    const tpu = std(0x7b2fbf, { roughness: 0.7 }); add(new THREE.Mesh(new THREE.BoxGeometry(0.0108, 0.0012, 0.009), tpu), 0, -0.0002, camZ + 0.001);
    for (const sx of [-1, 1]) { const ch = add(new THREE.Mesh(new THREE.BoxGeometry(0.0013, 0.0078, 0.0085), tpu), sx * 0.0052, camY - 0.0002, camZ + 0.001); ch.rotation.x = tiltR * 0.5; }
  } else if (CL.bridge) {   // the Air canopy: a see-through hoop from side post to side post, a spine from the tail post over the top to the camera cradle
    const pr0 = ring ? post : CL.w * 0.95, base = ring ? 0.0066 : 0.0042, top = base + CL.h;
    const arch = add(new THREE.Mesh(new THREE.TorusGeometry(pr0, 0.0012, 8, 24, Math.PI), canMat), 0, base, 0); arch.scale.y = CL.h / pr0;
    g.add(pipeMesh({ x: 0, y: base, z: pr0 }, { x: 0, y: top * 0.96, z: 0.003 }, 0.0011, canMat)); g.add(pipeMesh({ x: 0, y: top * 0.96, z: 0.003 }, { x: 0, y: camY + 0.0052, z: camZ + 0.003 }, 0.0011, canMat));
    for (const sx of [-1, 1]) { g.add(pipeMesh({ x: sx * 0.0052, y: camY, z: camZ + 0.0015 }, { x: sx * pr0 * 0.72, y: base + CL.h * 0.62, z: -0.001 }, 0.001, canMat)); g.add(pipeMesh({ x: sx * 0.0048, y: camY - 0.0042, z: camZ + 0.002 }, { x: 0, y: base, z: -pr0 }, 0.0009, canMat)); }
    const cradle = add(new THREE.Mesh(new THREE.TorusGeometry(0.0052, 0.001, 8, 20), canMat), 0, camY, camZ + 0.0015); cradle.rotation.x = tiltR;
  } else { const can = add(new THREE.Mesh(new THREE.SphereGeometry(CL.w, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), canMat), 0, 0.0045, 0.001); can.scale.set(0.92, CL.h / CL.w, 1.18);
    const hood = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0058, 0.006, 14, 1, true), canMat), 0, camY, camZ); hood.rotation.x = -(Math.PI / 2 - tiltR); }
  // the camera: a fat black barrel with a glass dome looking forward (-z), tilted up by the pilot's camera angle, on its little board
  const cam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0046, 0.0072, 18), std(0x0c0c0e, { metalness: 0.4, roughness: 0.35 })), 0, camY, camZ); cam.rotation.x = -(Math.PI / 2 - tiltR);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0041, 0.0007, 6, 18), std(0x1c1c20, { metalness: 0.6, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.0036; cam.add(rim);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0x16284f, metalness: 0.95, roughness: 0.04 })); lens.position.y = 0.0028; cam.add(lens);
  const cb = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.0009, 0.0095), std(0x101114)); cb.position.y = -0.004; if (!printed) cam.add(cb);   // (the printed canopy has its own camera plate)
  // antenna: a thick black base rising at the back with a thin whip
  const az = fr ? 0.013 : ring && CL.bridge ? post * 0.8 : CL.w * 0.55, a0 = { x: 0, y: fr ? 0.004 : 0.0045 + CL.h * 0.5, z: az }, a1 = { x: 0, y: 0.0045 + CL.h * 1.3, z: az + 0.011 }, a2 = { x: 0, y: 0.0045 + CL.h * 1.95, z: az + 0.021 };
  g.add(pipeMesh(a0, a1, 0.0013, std(0x0c0c0e))); g.add(pipeMesh(a1, a2, 0.0004, std(0x0c0c0e)));
  for (const [c, x] of [[0xcc2222, -0.003], [0xe8c21a, 0], [0x111111, 0.003]]) g.add(pipeMesh({ x, y: 0.0045, z: -0.004 }, { x: x * 0.4, y: camY - 0.002, z: camZ + 0.005 }, 0.00035, new THREE.MeshBasicMaterial({ color: c })));   // camera wires
  // battery: a soft-cornered pouch at its published size (two cells stacked for 2S), its wrap and label band, and its plug: a 1S
  // BT2.0 housing with two 1 mm pins at the back, or a 2S pack's red and black leads to a yellow XT30 and a white balance plug
  const B = S.PARTS.batteries[sp.battery] || { cap: 300 }, cells = B.cells || 1, BL = WHOOP_LOOK.batteries[sp.battery] || { d: [40 + B.cap * 0.06, cells > 1 ? 16 : 11.8, 6.4 * cells], c: 0x2b6ad6, s: 0xe5e7eb, plug: cells > 1 ? 'xt30' : 'bt2' };
  const shell = BL.plug === 'bt2' ? 0.0055 : 0, bl = BL.d[0] / 1000 - shell, bw = BL.d[1] / 1000, bh = BL.d[2] / 1000;
  const by = FM ? FT - 0.0133 + bh / 2 : -0.0035 - bh / 2, bz = -0.025 + bl / 2;   // the front end under the front of the frame, the rest out the back
  const pouch = (w, h, l, c, o = {}) => { const r = Math.min(w, h) * 0.32, sh = new THREE.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false, curveSegments: 4 }); geo.translate(0, 0, -l / 2); return new THREE.Mesh(geo, std(c, { roughness: 0.42, ...o })); };
  const ch = bh / cells;
  for (let k = 0; k < cells; k++) add(pouch(bw, ch * 0.97, bl, BL.c), 0, by - bh / 2 + ch * (k + 0.5), bz);   // the cell(s)
  add(pouch(bw + 0.0003, bh + 0.0003, bl * 0.46, BL.s, { roughness: 0.35 }), 0, by, bz - bl * 0.06);                 // the label band round the middle
  add(new THREE.Mesh(new THREE.BoxGeometry(bw * 0.5, 0.0002, bl * 0.22), std(0xf4f4f5, { roughness: 0.5 })), 0, by + bh / 2 + 0.0002, bz - bl * 0.06);   // the capacity print on top
  if (BL.plug === 'bt2') {
    const pz = bz + bl / 2 + shell / 2; add(new THREE.Mesh(new THREE.BoxGeometry(Math.min(bw, 0.0085), Math.min(bh, 0.0052), shell), std(0xe9e5dc, { roughness: 0.6 })), 0, by, pz);
    for (const x of [-0.0019, 0.0019]) { const pin = add(new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.0035, 8), std(0xd4af37, { metalness: 0.9, roughness: 0.25 })), x, by, pz + shell / 2 + 0.0016); pin.rotation.x = Math.PI / 2; }
  } else {
    const z0 = bz + bl / 2, lead = (x, c, z1, y1) => g.add(pipeMesh({ x, y: by + bh * 0.2, z: z0 }, { x: x * 0.6, y: y1, z: z1 }, 0.0009, new THREE.MeshBasicMaterial({ color: c })));
    lead(0.0022, 0xcc2222, z0 + 0.024, by - 0.002); lead(-0.0022, 0x111111, z0 + 0.024, by - 0.002);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.0102, 0.0052, 0.0155), std(0xf2c40f, { roughness: 0.45 })), 0, by - 0.002, z0 + 0.024 + 0.0077);   // XT30
    g.add(pipeMesh({ x: -bw * 0.3, y: by + bh * 0.3, z: z0 }, { x: -bw * 0.45, y: by + bh * 0.1, z: z0 + 0.016 }, 0.0005, new THREE.MeshBasicMaterial({ color: 0xe5e7eb })));   // balance lead
    add(new THREE.Mesh(new THREE.BoxGeometry(0.0075, 0.003, 0.0045), std(0xf4f4f5, { roughness: 0.6 })), -bw * 0.45, by + bh * 0.1, z0 + 0.018);
  }
  if (!FM) for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.0012, bh + 0.002, 0.004), frameMat), sx * (bw / 2 + 0.0008), by + 0.0008, 0.002);   // battery holder rails
  if (ring && !FM) for (const z of [-0.008, 0.012]) { add(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.003, 0.0009, 0.0022), frameMat), 0, by - bh / 2 - 0.0006, z); for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.0011, bh + 0.0035, 0.0022), frameMat), sx * (bw / 2 + 0.0009), by + 0.0012, z); }   // the cage the pack slides into
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // the FPV view: just in front of the lens of the camera drawn on the model, so the picture comes from where the camera is
  return { g, pgs, discs, lens: { x: 0, y: camY + 0.0081 * Math.sin(tiltR), z: camZ - 0.0081 * Math.cos(tiltR) } };   // the barrel points forward and up by the camera tilt
}
function buildDroneMesh() {
  if (droneMesh) scene.remove(droneMesh);
  const W = makeWhoopMesh(params, spec, tune); propGroups = W.pgs; propDiscs = W.discs; droneMesh = W.g; droneLens = W.lens || null; scene.add(droneMesh);
  if (typeof garagePreviewRefresh === 'function') garagePreviewRefresh();
}
const PARTS = () => S.PARTS;

