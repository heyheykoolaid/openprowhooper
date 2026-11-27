// Power Roll as pilots fly it (owner, 2026-11-27: "a power roll is more of a loop motion, with a roll at the top"; the difference
// from a Rubik's Cube is the over/under object). One continuous pitch loop with the roll inside it at the top, under / over / under
// one object, out upright flying forward. Synthetic: the measurements are given to matchObstacle directly. node test/powerroll.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim; let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('FAIL', n, x || ''); } };
const W = S.buildPlayground(), obj = W.objs.find(o => o.name === 'Swing Set');
// the attitude through the loop: the pitch turns once from a to b (upside-down half way), upright before and after
function det(raw, a = 0, b = 2.07) { const d = new S.TrickDetector(W); d.watcher = null; d.fb = []; d.toks = raw; for (let i = -300; i <= 500; i++) { const t = i * 0.01, th = t <= a || t >= b ? 0 : 2 * Math.PI * (t - a) / (b - a);
  d.fb.push({ t, up: S.v3(0, Math.cos(th), Math.sin(th)), f: S.v3(0, Math.sin(th), -Math.cos(th)), p: S.v3(0, 2, -6), v: S.v3(0, 0, -3) }); } return d; }
const tok = (ax, dir, raw, t0, t1) => ({ ax, dir, raw, deg: Math.round(raw / 90) * 90, t0, t1, inv: false, n: 100 });
const cr = (kind, t, dir, extra) => ({ kind, obj: obj.id, name: 'Swing Set', t, dir, upY: 0.95, fwdDot: 0.99, latDot: 0.05, ...extra });
const name = r => r && r.name, UOU = [cr('U', -1.1, -1), cr('O', 0.75, 1, { upY: 0.6 }), cr('U', 2.05, -1)];
// the owner's labelled ones measured P+357..441 in one piece with the roll (330-365) inside it, around the pass over
const loop = tok('P', 1, 381, 0, 2.07), roll = tok('R', -1, 330, 0.3, 1.06);
let r = det([loop, roll]).matchObstacle([loop, roll], UOU); ok('one loop with the roll at the top, under / over / under: Power Roll', name(r) === 'Power Roll', name(r));
const h1 = tok('P', 1, 193, -1.58, -0.36), r2 = tok('R', -1, 349, -0.45, 0.43), h2 = tok('P', 1, 167, 0.39, 1.15);
r = det([h1, r2, h2], -1.58, 1.15).matchObstacle([h1, r2, h2], [cr('U', -1.49, 1), cr('O', 0, -1), cr('U', 1.38, 1)]); ok('the loop read in two halves round the roll: Power Roll', name(r) === 'Power Roll', name(r));
r = det([loop, roll]).matchObstacle([loop, roll], []); ok('the same rotations with no object: not a Power Roll', name(r) !== 'Power Roll', name(r));
r = det([loop, roll]).matchObstacle([loop, roll], [cr('U', -1.1, -1), cr('O', 0.75, 1)]); ok('never back under the object: not a Power Roll', name(r) !== 'Power Roll', name(r));
const half = tok('R', -1, 180, 0.4, 0.9);
r = det([loop, half]).matchObstacle([loop, half], UOU); ok('a half roll at the top (an Immelmann / Split S): not a Power Roll', name(r) !== 'Power Roll', name(r));
const back = tok('P', -1, 220, 0.9, 1.5);
r = det([loop, roll, back]).matchObstacle([loop, roll, back], UOU); ok('a flip the other way inside the loop: not a Power Roll', name(r) !== 'Power Roll', name(r));
r = det([loop, roll]).matchObstacle([loop, roll], [cr('U', -1.1, -1), cr('O', 0.75, 1), cr('U', 2.05, -1, { fwdDot: -0.8 })]); ok('out under it flying backward: not a Power Roll', name(r) !== 'Power Roll', name(r));
// the call takes the detector's own pieces, so nothing else (a Rubik's Cube) is read from them afterwards
r = det([loop, roll]).matchObstacle([loop, roll], UOU); ok('the call carries the rotations it used', r && r.toks.length === 2 && r.toks.includes(loop) && r.toks.includes(roll));
// the reviewers' hint (game.js TELL_APART) names the difference
const src = require('fs').readFileSync(require('path').join(__dirname, '../src/game.js'), 'utf8');
ok("the review hint tells Rubik's Cube and Power Roll apart", /\["Rubik's Cube", 'Power Roll', "A Power Roll goes round an over\/under object/.test(src));
console.log(`${pass}/${pass + fail} power roll checks`); process.exit(fail ? 1 : 0);
