// Video Review's rotation tracker (src/vision.js) on synthetic FPV footage: a textured world rendered through an
// equidistant fisheye while the camera rolls, flips and yaws by known amounts. Checks the measured totals, then runs
// the measured motion through the detector (open-air tricks; a Matty/powerloop with marked obstacle passes).
require('../src/tricks.js'); require('../src/sim.js'); require('../src/vision.js');
const S = globalThis.Sim, V = globalThis.Vision;
const W = 200, H = 150, HFOV = 140, FPS = +(process.env.FPS || 30);
// procedural world texture on the unit sphere: smooth noise from random plane waves + scattered dark blobs
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
const waves = Array.from({ length: 24 }, () => { const k = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], n = Math.hypot(...k), f = 6 + rnd() * 26; return { k: k.map(v => v / n * f), p: rnd() * 6.28, a: 18 + rnd() * 20 }; });
const blobs = Array.from({ length: 260 }, () => { const v = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], n = Math.hypot(...v); return { c: v.map(x => x / n), r: 0.03 + rnd() * 0.05, v: rnd() < 0.5 ? -90 : 80 }; });
const tex = d => { let s = 128; for (const w of waves) s += w.a * Math.sin(w.k[0] * d[0] + w.k[1] * d[1] + w.k[2] * d[2] + w.p);
  for (const b of blobs) { const e = (d[0] - b.c[0]) ** 2 + (d[1] - b.c[1]) ** 2 + (d[2] - b.c[2]) ** 2; if (e < b.r * b.r) s += b.v; } return s; };
const qmul = (a, b) => [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
const qax = (ax, deg) => { const h = deg * Math.PI / 360, s = Math.sin(h); return [Math.cos(h), ax[0] * s, ax[1] * s, ax[2] * s]; };
const rot = (q, v) => { const [w, x, y, z] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w - iw * x - iy * z + iz * y, iy * w - iw * y - iz * x + ix * z, iz * w - iw * z - ix * y + iy * x]; };
const f = (W / 2) / (HFOV / 2 * Math.PI / 180);
const BEAR = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x - W / 2) / f, v = (y - H / 2) / f, th = Math.hypot(u, v), ph = Math.atan2(v, u); BEAR.push([Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]); }
function render(q) { const d = new Float32Array(W * H); for (let i = 0; i < d.length; i++) d[i] = tex(rot(q, BEAR[i])); return { w: W, h: H, d }; }
// camera axes: x right, y down, z forward. roll = about z, pitch back = about -x, yaw right = about -y
const AX = { R: [0, 0, 1], P: [-1, 0, 0], Y: [0, -1, 0] };
function film(steps) {   // steps: [axis, deg, deg/s] | ['hold', s] -> frames [{ t, rpy }] measured, plus truth totals
  const tr = new V.Tracker({ hfov: HFOV, maskTop: 0, maskBottom: 0 }); let q = [1, 0, 0, 0], t = 0; const frames = [], truth = { R: 0, P: 0, Y: 0 };
  const shoot = () => { const r = tr.push(render(q)); frames.push({ t, rpy: r ? r.rpy : [0, 0, 0] }); };
  shoot(); for (let i = 0; i < 6; i++) { t += 1 / FPS; shoot(); }
  for (const s of steps) {
    if (s[0] === 'hold') { for (let i = 0; i < s[1] * FPS; i++) { t += 1 / FPS; shoot(); } continue; }
    const [ax, deg, rate] = s, n = Math.round(Math.abs(deg) / rate * FPS), per = deg / n; truth[ax] += deg;
    for (let i = 0; i < n; i++) { q = qmul(q, qax(AX[ax], per)); t += 1 / FPS; shoot(); }
  }
  for (let i = 0; i < 0.5 * FPS; i++) { t += 1 / FPS; shoot(); }
  return { frames, truth };
}
let pass = 0, total = 0;
function check(name, steps, want, marks) {
  const { frames, truth } = film(steps), ok = frames.filter(x => x.rpy).length, sum = [0, 1, 2].map(k => frames.reduce((s, x) => s + (x.rpy ? x.rpy[k] : 0), 0));
  const errs = ['R', 'P', 'Y'].map((a, k) => Math.abs(sum[k] - truth[a])), good = errs.every(e => e < 25);
  const ev = V.detectClip(S, frames, marks, { camTilt: 0, axisCleanup: false }), names = ev.map(e => e.name), okDet = JSON.stringify(names) === JSON.stringify(want);
  total++; if (good && okDet) pass++;
  console.log(`${good && okDet ? '✓' : '✗'} ${name.padEnd(30)} tracked ${ok}/${frames.length}  measured R ${sum[0].toFixed(0)} P ${sum[1].toFixed(0)} Y ${sum[2].toFixed(0)} (truth ${truth.R}/${truth.P}/${truth.Y})  -> ${names.join(' + ') || 'nothing'}${okDet ? '' : '  want ' + want.join(' + ')}`);
}
const t0 = 7 / FPS;
check('roll 360 @ 700°/s', [['R', 360, 700]], ['Roll']);
check('flip 360 @ 600°/s', [['P', 360, 600]], ['Flip']);
check('yaw spin 360 @ 400°/s', [['Y', 360, 400]], ['Yaw Spin']);
check("rubik's cube", [['P', 180, 600], ['R', 360, 650], ['P', 180, 600]], ["Rubik's Cube"]);
check('segmented roll', [['R', 180, 800], ['hold', 0.3], ['R', 180, 800]], ['Segmented Flips/Rolls']);
check('matty (over, flip, under back)', [['hold', 0.3], ['P', -360, 300], ['hold', 0.3]], ['Matty Flip'],
  [{ t: t0 + 0.2, kind: 'O' }, { t: t0 + 0.3 + 1.2 + 0.2, kind: 'U', back: true }]);
console.log(`\n${pass}/${total} vision checks (${FPS} fps)`);
