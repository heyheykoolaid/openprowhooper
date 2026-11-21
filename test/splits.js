// Split-S by attitude (2026-11-21): the pull-through of a real Split-S often reads 55-140 deg. When no table pattern fits, one half roll,
// over then under one object, upside-down on the way, upright under it and flying back the other way is a Split-S. Synthetic: the
// measurements are given to matchObstacle directly (the private flights are the evidence: 20 -> 22 of 34 confirmed labels found).
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim; let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
function det(opts) { const d = new S.TrickDetector(S.buildPlayground()); d.watcher = null; d.fb = [];
  for (let i = 0; i <= 200; i++) { const t = i * 0.01, k = t / 2, upY = opts.upright ? 0.9 : Math.cos(Math.min(1, k * 2.2) * Math.PI) * (k < 0.45 ? 1 : -1) * (k < 0.45 ? 1 : -1), a = (opts.noTurn ? 0 : Math.PI) * Math.min(1, Math.max(0, (k - 0.3) / 0.5));
    const uy = opts.upright ? 0.9 : (k < 0.2 ? 1 - k * 9 : k < 0.55 ? -0.8 : Math.min(1, -0.8 + (k - 0.55) * 5)); d.fb.push({ t, up: S.v3(0, uy, 0), f: S.v3(Math.sin(a), 0, -Math.cos(a)), p: S.v3(0, 2, 0), v: S.v3(0, 0, 0) }); }
  return d; }
const tok = (ax, dir, raw, t0, t1) => ({ ax, dir, raw, deg: Math.round(raw / 90) * 90, t0, t1, inv: false, n: 100 });
const cr = (kind, t, dir, upY, fwdDot) => ({ kind, obj: 4, name: 'Swing Set', t, dir, upY, fwdDot, latDot: 0.3 });
const OU = [cr('O', 0.56, -1, -0.45, 0.95), cr('U', 1.9, 1, 0.95, 0.86)];
let r = det({}).matchObstacle([tok('R', 1, 160, 0, 0.5), tok('P', 1, 70, 0.6, 1.4)], OU); ok('pull read as 70: Split-S', r && r.name === 'Split-S');
r = det({}).matchObstacle([tok('R', 1, 104, 0, 0.4), tok('P', 1, 136, 0.3, 1.5), tok('R', -1, 56, 1.2, 1.5)], OU); ok('short roll, small correction: Split-S', r && r.name === 'Split-S');
r = det({}).matchObstacle([tok('R', 1, 170, 0, 0.5)], OU); ok('no pitch token at all: Split-S', r && r.name === 'Split-S');
r = det({}).matchObstacle([tok('R', 1, 180, 0, 0.5), tok('P', 1, 180, 0.6, 1.4)], OU); ok('a clean one is still the table\'s', r && r.name === 'Split-S' && !r.splitWitness);
r = det({ upright: true }).matchObstacle([tok('R', 1, 160, 0, 0.5), tok('P', 1, 70, 0.6, 1.4)], OU); ok('never upside-down: nothing', !r);
r = det({ noTurn: true }).matchObstacle([tok('R', 1, 160, 0, 0.5), tok('P', 1, 70, 0.6, 1.4)], OU); ok('did not turn back: nothing', !r);
r = det({}).matchObstacle([tok('R', 1, 160, 0, 0.5), tok('P', -1, 120, 0.6, 1.4)], OU); ok('nose pushed down: not a Split-S', !r || r.name !== 'Split-S');
r = det({}).matchObstacle([tok('R', 1, 160, 0, 0.5), tok('Y', 1, 150, 0.6, 1.4)], OU); ok('a big yaw in it: not a Split-S', !r || r.name !== 'Split-S');
r = det({}).matchObstacle([tok('R', 1, 160, 0, 0.5), tok('P', 1, 70, 0.6, 1.4)], [OU[0], { ...OU[1], fwdDot: -0.8 }]); ok('ends flying backward: not a Split-S', !r || r.name !== 'Split-S');
console.log(`splits: ${pass}/${pass + fail}`); process.exit(fail ? 1 : 0);
