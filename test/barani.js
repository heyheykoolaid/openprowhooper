// Barani as pilots really fly it. node test/barani.js
// The rotations and object passes below are the numbers the detector measured on a pilot's labelled Barani (shared
// flight, 2026-11-17; derived numbers only, not the flight): a half loop up IN FRONT of a tree (no pass under first), a
// ~140° yaw upside-down over it, then a sloppy ~265° Matty (read as two pieces) out under it flying backward. The game
// called it a Matty Flip. Near-misses must keep their names.
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const world = S.buildPlayground(), tree = world.objs.find(o => o.obstacle && o.round) || world.objs.find(o => o.obstacle);
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const tok = (ax, dir, raw, inv, t0, t1) => ({ ax, dir, raw, inv, t0, t1, n: 100 });
const pass = (kind, dir, t, fwdDot, upY) => ({ kind, dir, t, fwdDot, upY, latDot: 0.2, spd: 7, obj: tree.id, name: tree.name });
function call(toks, crosses) { const det = new S.TrickDetector(world); det.watcher = null; const m = det.matchObstacle(toks, crosses); return m ? m.name : null; }
const over = pass('O', -1, 9.54, 0.98, -0.86), under = pass('U', 1, 10.99, -0.99, 0.86);
// as measured: P+169, Y-136 upside-down, then P-153 (upside-down) and P-112 merged by the detector into one pitch
const real = [tok('P', 1, 169, false, 8.98, 9.58), tok('Y', -1, 136, true, 9.46, 10.02), tok('P', -1, 265, false, 10.0, 12.05)];
check('the real Barani: front half loop, inverted half yaw, sloppy Matty out', call(real, [over, under]) === 'Barani', call(real, [over, under]));
check('the same with the pieces flown cleanly (180 / 180 / 180)', call([tok('P', 1, 180, false, 9, 9.5), tok('Y', 1, 180, true, 9.5, 10), tok('P', -1, 180, false, 10, 10.8)], [over, under]) === 'Barani');
check('the textbook version (under, over, under) still counts', call(real, [pass('U', -1, 8.6, 0.98, 0.9), pass('O', 1, 9.54, -0.98, -0.86), pass('U', -1, 10.99, -0.99, 0.86)]) === 'Barani');
// near-misses
check('no yaw on top: a Matty Flip, not a Barani', call([tok('P', -1, 350, false, 9, 10.5)], [over, under]) === 'Matty Flip', call([tok('P', -1, 350, false, 9, 10.5)], [over, under]));
check('the yaw happened upright: not a Barani', call([tok('P', 1, 169, false, 8.98, 9.58), tok('Y', -1, 136, false, 9.46, 10.02), tok('P', -1, 265, false, 10, 12)], [over, under]) !== 'Barani');
check('it finished flying forward: not a Barani', call(real, [over, pass('U', 1, 10.99, 0.9, 0.86)]) !== 'Barani');
console.log(`\n${ok}/${n} barani checks`); if (ok !== n) process.exit(1);
