// Slackvegan City's subway: the ground plane is skipped over the station (world.groundHoles), so a whoop can fly down the stairs
// and land on a platform or inside the parked train; everywhere else the ground is where it always was. node test/subway.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const S = globalThis.Sim;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const w = S.MAPS.slackvegan.build(), P = S.buildDrone(S.PRESETS['Air65 Racing']);
const drop = (x, y, z, secs = 2.5) => { const d = new S.Drone(P, S.defaultTune(), w); d.reset({ pos: S.v3(x, y, z), yaw: 0 }); d.armed = false; for (let t = 0; t < secs; t += 0.001) d.step({ thr: 0, roll: 0, pitch: 0, yaw: 0 }, 0.001); return d.pos; };
const a = drop(-20, -3, 1); check('dropped in the hall it lands on the north platform (6 m down)', Math.abs(a.y - -6) < 0.15, a.y.toFixed(2));
const b = drop(-20, -4, 6.5); check('dropped inside the train it lands on the car floor', Math.abs(b.y - -6.05) < 0.15, b.y.toFixed(2));
const c = drop(-12, -0.3, -2.7); check('dropped into the stairwell it lands on the stairs below the street', c.y < -1 && c.y > -6.1, c.y.toFixed(2));
const e = drop(30, 1, 6); check('out on the avenue the ground is where it was', Math.abs(e.y) < 0.1, e.y.toFixed(2));
const f = drop(-20, 1, 6); check('on the street over the station it lands on the street, not in the hole', f.y > -0.05 && f.y < 0.1, f.y.toFixed(2));
// fly in: from the sidewalk at the open end of the stair, westward and down, through the stairwell into the hall
{ const d = new S.Drone(P, S.defaultTune(), w); d.reset({ pos: S.v3(-4.5, 1.2, -2.7), yaw: Math.PI / 2 }); d.armed = true;
  let minY = 9; for (let t = 0; t < 3.6; t += 0.001) { d.pos = S.v3(-4.5 - t * 3, Math.max(-4.5, 1.2 - t * 1.6), -2.7); d.vel = S.v3(-3, -1.6, 0); d.step({ thr: 0.4, roll: 0, pitch: 0, yaw: 0 }, 0.001); minY = Math.min(minY, d.pos.y); }
  check('the stairwell is open: a whoop can be 4.5 m under the street at its foot', minY < -4.3 && d.pos.y < -4, `${minY.toFixed(2)} m, ends at ${d.pos.y.toFixed(2)}`); }
check('the station has open train doors to fly through', w.objs.filter(o => /Subway Car \d Door/.test(o.name)).length === 16 && w.objs.filter(o => /End Door/.test(o.name)).length === 4);
console.log(`\n${ok}/${n} subway checks`); if (ok !== n) process.exit(1);
