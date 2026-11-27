// Maverick Loop is judged by its top (owner, 2026-11-27): over the object upright and travelling backward, never on its back on the way
// round. A steep dive down the far side (nose straight down, up.y ~0) still counts; an over pass made forward, sideways or near-inverted
// (every Maverick call pilots rejected) does not. Calls matchObstacle directly with the passes and the attitude read off real flights.
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const W = S.buildPlayground(), det = new S.TrickDetector(W), bar = W.objs.find(o => o.obstacle && !o.round);
const pass = (kind, t, dir, o) => ({ kind, t, dir, obj: bar.id, name: bar.name, latDot: 0.05, spd: 6, ...o });
const run = (over, minUp) => { det.minUpBetween = () => minUp; det.minCamUpBetween = () => minUp; det.stayedUpright = () => minUp > 0.1;
  const r = det.matchObstacle([], [pass('U', 0.6, -1, { fwdDot: 0.99, upY: 0.88 }), pass('O', 1.8, 1, over), pass('U', 3.6, -1, { fwdDot: 0.99, upY: 0.77 })]); return r ? r.name : 'nothing'; };
check('upright and backward over the top, a steep dive after (min up 0.0): Maverick Loop', run({ fwdDot: -0.999, upY: 0.95 }, -0.02) === 'Maverick Loop', run({ fwdDot: -0.999, upY: 0.95 }, -0.02));
check('the same, upright all the way: Maverick Loop', run({ fwdDot: -0.99, upY: 0.82 }, 0.6) === 'Maverick Loop');
check('over the top forward (a rejected call): not a Maverick', run({ fwdDot: 0.85, upY: 0.4 }, 0.2) !== 'Maverick Loop', run({ fwdDot: 0.85, upY: 0.4 }, 0.2));
check('over the top nearly upside-down (a rejected call): not a Maverick', run({ fwdDot: -0.73, upY: -0.32 }, -0.32) !== 'Maverick Loop');
check('on its back on the way round: not a Maverick', run({ fwdDot: -0.99, upY: 0.9 }, -0.6) !== 'Maverick Loop');
console.log(`\n${ok}/${n} maverick checks`); if (ok !== n) process.exit(1);
