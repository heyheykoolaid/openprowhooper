// Matty Twister by the book (owner, 2026-11-24): over the object, a 360 roll WHILE over it, the Matty flip at once, out under the
// object. Synthetic: the measurements are given to matchObstacle directly. node test/twister.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim; let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL', n); } };
const W = S.buildPlayground(), obj = W.objs.find(o => o.name === 'Swing Set'), top = obj.obstacle.over;
function det(y) { const d = new S.TrickDetector(W); d.watcher = null; d.fb = []; for (let i = 0; i <= 600; i++) { const t = i * 0.01; d.fb.push({ t, up: S.v3(0, 1, 0), f: S.v3(0, 0, -1), p: S.v3(0, typeof y === 'function' ? y(t) : y, -6), v: S.v3(0, 0, -3) }); } return d; }
const tok = (ax, dir, raw, t0, t1) => ({ ax, dir, raw, deg: Math.round(raw / 90) * 90, t0, t1, inv: false, n: 100 });
const cr = (kind, t, dir, fwdDot) => ({ kind, obj: obj.id, name: 'Swing Set', t, dir, upY: 0.95, fwdDot, latDot: 0.1 });
const name = r => r && r.name;
// over at 1.0 s; roll 1.0-1.6; flip 1.65-2.4; under (backward) at 2.6
let r = det(top + 0.6).matchObstacle([tok('R', 1, 360, 1.0, 1.6), tok('P', -1, 350, 1.65, 2.4)], [cr('O', 1.0, -1, 0.9), cr('U', 2.6, 1, -0.9)]); ok('over, roll over it, flip, under: Matty Twister', name(r) === 'Matty Twister');
r = det(top + 0.6).matchObstacle([tok('P', -1, 80, 0.8, 1.0), tok('R', 1, 360, 1.05, 1.65), tok('P', -1, 280, 1.7, 2.4)], [cr('O', 1.0, -1, 0.9), cr('U', 2.6, 1, -0.9)]); ok('with the pitch down first: Matty Twister', name(r) === 'Matty Twister');
r = det(top + 0.6).matchObstacle([tok('R', 1, 360, 3.2, 3.8), tok('P', -1, 350, 3.85, 4.6)], [cr('O', 1.0, -1, 0.9), cr('U', 4.8, 1, -0.9)]); ok('the roll made two seconds after passing over: not a Matty Twister', name(r) !== 'Matty Twister');
r = det(top + 0.6).matchObstacle([tok('R', 1, 360, -1.4, -0.8), tok('P', -1, 350, 1.2, 1.9)], [cr('O', 1.0, -1, 0.9), cr('U', 2.2, 1, -0.9)]); ok('the roll made well before reaching the object: not a Matty Twister', name(r) !== 'Matty Twister');
r = det(top + 0.6).matchObstacle([tok('R', 1, 360, 1.0, 1.6), tok('P', -1, 350, 2.6, 3.3)], [cr('O', 1.0, -1, 0.9), cr('U', 3.5, 1, -0.9)]); ok('a second between the roll and the flip: not a Matty Twister', name(r) !== 'Matty Twister');
r = det(top - 0.8).matchObstacle([tok('R', 1, 360, 1.0, 1.6), tok('P', -1, 350, 1.65, 2.4)], [cr('O', 1.0, -1, 0.9), cr('U', 2.6, 1, -0.9)]); ok('the roll made below the object\'s top: not a Matty Twister', name(r) !== 'Matty Twister');
console.log(`${pass}/${pass + fail} twister checks`); process.exit(fail ? 1 : 0);
