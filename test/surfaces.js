// Air near surfaces (owner, 2026-11-28; tune.wallPull, tune.ceilPull in Drone.step): a hovering whoop beside a wall is drawn toward
// it, under a ceiling it is drawn up; with neither set the physics is exactly as it was; out in the open neither does anything.
// usage: node test/surfaces.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
let ok = 0, n = 0; const check = (name, c, extra = '') => { n++; if (c) ok++; console.log(`${c ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
// an empty world with a wall (its face at x = 1) and a ceiling slab (its underside at y = 3) well apart
function world() { const W = S.buildPlayground(); W.objs = []; W.prims = [];
  const add = (c, h) => { const b = S.makeBox(S.v3(...c), S.v3(...h)); b.owner = -1; W.prims.push(b); };
  add([1.5, 2, 0], [0.5, 2, 4]); add([-20, 3.25, 0], [3, 0.25, 3]); return W; }
// hover on a height hold for `secs` at `pos`; returns where it ended and the mean throttle it took
function hover(tuneX, pos, secs = 1.5) {
  const tune = Object.assign(S.defaultTune(), tuneX), d = new S.Drone(S.buildDrone(S.PRESETS['Air65 Racing']), tune, world());
  d.reset({ pos: { x: pos[0], y: pos[1], z: pos[2] }, yaw: 0 }); d.armed = true; let thr = 0.36, I = 0, sum = 0, k = 0;
  for (let t = 0; t < secs; t += 0.001) { const e = pos[1] - d.pos.y; I += e * 0.001; thr = Math.max(0, Math.min(1, 0.36 + 1.2 * e - 0.5 * d.vel.y + 0.6 * I)); d.step({ thr, roll: 0, pitch: 0, yaw: 0 }, 0.001); if (t > 0.5) { sum += thr; k++; } }
  return { x: d.pos.x, y: d.pos.y, z: d.pos.z, thr: sum / k, sig: [d.pos.x, d.pos.y, d.pos.z, d.q.w, d.q.x].map(v => v.toFixed(9)).join(',') };
}
const R = S.buildDrone(S.PRESETS['Air65 Racing']), near = 1 - R.arm - 0.035;   // the ducts ~1.5 cm off the wall
{ const a = hover({}, [near, 2, 0]), b = hover({ wallPull: 0, ceilPull: 0 }, [near, 2, 0]); check('with neither set (or both 0) the physics is the same to the last digit', a.sig === b.sig); }
{ const a = hover({}, [near, 2, 0], 0.6), b = hover({ wallPull: 1 }, [near, 2, 0], 0.6); check('beside a wall the whoop drifts toward it', b.x - a.x > 0.004, `(${((b.x - a.x) * 1000).toFixed(1)} mm in 0.6 s)`); }
{ const a = hover({}, [0.5, 2, 0], 0.6), b = hover({ wallPull: 1 }, [0.5, 2, 0], 0.6); check('half a metre from the wall nothing pulls', Math.abs(b.x - a.x) < 0.0005, `(${((b.x - a.x) * 1000).toFixed(2)} mm)`); }
{ const a = hover({ wallPull: 1 }, [near, 2, 0], 0.25), b = hover({ wallPull: 2 }, [near, 2, 0], 0.25), c = hover({}, [near, 2, 0], 0.25); check('the slider scales it', (b.x - c.x) > 1.5 * (a.x - c.x)); }
{ const y = 2.97, a = hover({}, [-20, y, 0]), b = hover({ ceilPull: 1 }, [-20, y, 0]); check('right under a ceiling the same hover takes a little less throttle (a whoop\'s props cannot get closer than ~1.5 radii)', b.thr < a.thr * 0.995, `(${(a.thr * 100).toFixed(1)} % -> ${(b.thr * 100).toFixed(1)} %)`); }
{ const y = 2.6, a = hover({}, [-20, y, 0]), b = hover({ ceilPull: 1 }, [-20, y, 0]); check('40 cm under it there is none', Math.abs(b.thr - a.thr) < 0.002); }
{ const a = hover({}, [-8, 2, 0]), b = hover({ wallPull: 1, ceilPull: 1 }, [-8, 2, 0]); check('in the open both leave the flight alone', a.sig === b.sig); }
console.log(`\n${ok}/${n} surface checks`); process.exitCode = ok === n ? 0 : 1;
