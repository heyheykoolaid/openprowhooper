// Feel Lab's average step response (src/feelfit.js `stepResponse`): from freestyle-like sticks and a rotation that follows them
// late and softly, it must find how late and how softly. node test/stepresp.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/bbl.js'); const FF = require('../src/feelfit.js');
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
function flight(hz, secs, delayMs, tauMs, opt = {}) {   // sticks: smooth random moves with holds; rotation: delayed, first-order (or a little springy), noisy
  const n = hz * secs, sp = new Array(n), gy = new Array(n); let target = 0, cur = 0, next = 0;
  for (let i = 0; i < n; i++) { if (i >= next) { target = rnd() < 0.3 ? 0 : (rnd() * 2 - 1) * 500; next = i + Math.round(hz * (0.15 + rnd() * 0.6)); } cur += (target - cur) * Math.min(1, 25 / hz); sp[i] = cur; }
  const D = Math.round(delayMs / 1000 * hz), a = 1 / (tauMs / 1000 * hz); let g = 0, v = 0;
  for (let i = 0; i < n; i++) { const u = sp[Math.max(0, i - D)];
    if (opt.spring) { const w = 2 * Math.PI * opt.spring / hz, z = opt.damp; v += w * w * (u - g) - 2 * z * w * v; g += v; } else g += (u - g) * a;
    gy[i] = g * (opt.gain || 1) + (rnd() - 0.5) * 2 * (opt.noise ?? 8); }
  return { sp, gy };
}
{ const { sp, gy } = flight(1000, 40, 6, 20), r = FF.stepResponse(sp, gy, 1000);   // 6 ms dead + 20 ms lag: half way at 6 + 20 ln 2 ≈ 20 ms, 90 % at 6 + 46 ≈ 52 ms
  check('a 6 ms dead time and a 20 ms lag are found', r && Math.abs(r.t50 - 19.9) < 5 && Math.abs(r.t90 - 52) < 14 && Math.abs(r.settle - 1) < 0.08 && r.over < 8, r && `t50 ${r.t50} ms, t90 ${r.t90} ms, settles at ${r.settle}, overshoot ${r.over} %, ${r.n} windows`); }
{ const A = flight(2000, 40, 3, 10), B = flight(2000, 40, 12, 30), a = FF.stepResponse(A.sp, A.gy, 2000), b = FF.stepResponse(B.sp, B.gy, 2000);
  check('a laggier quad reads later (2 kHz log)', a && b && b.t50 - a.t50 > 12 && b.t90 > a.t90, a && b && `t50 ${a.t50} vs ${b.t50} ms`); }
{ const { sp, gy } = flight(1000, 40, 4, 0, { spring: 14, damp: 0.3 }), r = FF.stepResponse(sp, gy, 1000);
  check('a springy quad shows its overshoot', r && r.over > 15, r && `overshoot ${r.over} %`); }
{ const { sp, gy } = flight(1000, 40, 5, 15, { gain: 0.8 }), r = FF.stepResponse(sp, gy, 1000);
  check('a quad that only reaches 80 % of the rate settles near 0.8 (the level is the roughest number: within ~7 %)', r && Math.abs(r.settle - 0.8) < 0.08, r && `settles at ${r.settle}`); }
{ const sp = new Array(20000).fill(0), gy = sp.map(() => (rnd() - 0.5) * 10); check('a hover with no stick movement gives nothing', FF.stepResponse(sp, gy, 1000) === null); }
console.log(`${ok}/${n} step response checks`); if (ok < n) process.exit(1);
