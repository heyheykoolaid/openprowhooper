// Prop thrust in moving air (tune.inflow) and prop torque by figure of merit (tune.propFM); owner, 2026-11-27, "2 and 3" after
// reading WebFPV (ideas only). Absent, both leave the physics as it was; inflow keeps hover exactly, gives more thrust than the old
// straight line in a climb and some translational lift edgewise; propFM sets cq from ct.
// usage: node test/inflow.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim, { v3 } = S; let ok = 0, n = 0;
const check = (c, msg) => { n++; if (c) ok++; else console.log('FAIL', msg); };
const vP = 0.95 * 560 * 0.031, vi0 = 5.7;
check(Math.abs(S.inflowRatio(0, 0, vP, vi0, 1) - 1) < 1e-9, 'hover is T0 exactly');
for (const va of [1, 3, 6]) { const old = 1 - va / vP, r = S.inflowRatio(va, 0, vP, vi0, old); check(r > old && r < 1, `climb ${va} m/s: ${r.toFixed(3)} between the line ${old.toFixed(3)} and 1`); }
check(S.inflowRatio(0, 8, vP, vi0, 1) > 1.05, 'edgewise flow gives translational lift');
check(S.inflowRatio(0, 4, vP, vi0, 1) < S.inflowRatio(0, 8, vP, vi0, 1), 'more lift faster');
check(Math.abs(S.inflowRatio(-2, 0, vP, vi0, 1.3) - 1.3) < 1e-9, 'descending keeps the old gain');
const W = { objs: [], prims: [], zones: [], spawn: { pos: v3(0, 200, 0), yaw: 0 } }, P = S.buildDrone(S.PRESETS['Air65 Champion']);
const mk = x => { const d = new S.Drone(P, Object.assign(S.defaultTune(), { batteryLife: false }, x), W); d.reset(W.spawn); d.armed = true; return d; };
check(mk({}).p === P, 'no knobs: the physics as built');
const fm = d => Math.pow(d.p.ct, 1.5) / (2 * Math.PI * Math.sqrt(Math.PI / 2) * d.p.cq);
check(Math.abs(fm(mk({ propFM: 0.3 })) - 0.3) < 1e-9, 'propFM sets the figure of merit');
check(Math.abs(fm(mk({ propCt: 1.7, propFM: 0.15 })) - 0.15) < 1e-9, 'with prop grip too');
const run = (d, rc, T) => { for (let t = 0; t < T; t += 0.001) d.step(rc, 0.001); };
const climb = x => { const d = mk(x); run(d, { thr: 0.3, roll: 0, pitch: 0, yaw: 0 }, 0.3); run(d, { thr: 1, roll: 0, pitch: 0, yaw: 0 }, 1.2); return d.vel.y; };
const a = climb({}), b = climb({ inflow: 1 }); check(b > a, `full-throttle climb faster with inflow (${a.toFixed(1)} -> ${b.toFixed(1)} m/s)`);
console.log(`${ok}/${n} inflow checks`);
