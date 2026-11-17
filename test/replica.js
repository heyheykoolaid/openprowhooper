// Bot replica: a stretch of a real-physics flight re-flown from its recorded state with the recorded sticks.
// node test/replica.js
//  - re-flying the pilot's own stick inputs from the recorded state stays close to the recording (metres, degrees)
//  - the detector calls the same trick on the replica as on the recording
//  - a replica flown on different sticks drifts away (the comparison is not trivially passing)
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const W = { objs: [], prims: [], zones: [], spawn: { pos: S.v3(0, 0.03, 0), yaw: 0 } };
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };

// a flight like the game records it (training.js recordTrace): 100 Hz rows from 1 kHz physics
function fly(script, T, spec = 'Air65 Racing') {
  const P = S.buildDrone(S.PRESETS[spec]), tune = S.defaultTune(), d = new S.Drone(P, tune, W); d.reset({ pos: S.v3(0, 4, 0), yaw: 0 }); d.armed = true;
  const hov = P.stats.hoverThrottle, rows = []; let hit = null;
  for (let k = 0; k <= T * 1000; k++) { const t = k / 1000, rc = script(t, hov); d.step(rc, 0.001);
    if (d.contactThisStep && d.contactNormal) hit = { n: d.contactNormal, obj: d.contactOwner ?? -1, imp: d.lastImpact || 0, g: d.contactGround ? 1 : 0 };
    if (k % 10) continue; const r = d.pilotRates(), c = hit; hit = null;
    rows.push([+d.time.toFixed(3), +d.pos.x.toFixed(4), +d.pos.y.toFixed(4), +d.pos.z.toFixed(4), +d.q.w.toFixed(5), +d.q.x.toFixed(5), +d.q.y.toFixed(5), +d.q.z.toFixed(5),
      Math.round(r[0]), Math.round(r[1]), Math.round(r[2]), +rc.thr.toFixed(3), c ? 1 : 0, 1, d.crashed ? 1 : 0, c ? +c.n.x.toFixed(3) : 0, c ? +c.n.y.toFixed(3) : 0, c ? +c.n.z.toFixed(3) : 0, c ? c.obj : -1, c ? +c.imp.toFixed(2) : 0, c ? c.g : 0,
      +d.vel.x.toFixed(3), +d.vel.y.toFixed(3), +d.vel.z.toFixed(3), +rc.roll.toFixed(3), +rc.pitch.toFixed(3), +rc.yaw.toFixed(3)]); }
  return { rows, P, tune };
}
const calls = rows => S.replayTrace(rows, { world: W, camTilt: 20 }).events.filter(e => e.name !== 'near' && e.name !== 'Crash').map(e => e.name);

// a punchy flight with a flip (pitch back) and later a roll, sticks ramped like a pilot's thumb
const ramp = (t, a, b, v) => t < a || t > b ? 0 : v * Math.min(1, (t - a) / 0.05, (b - t) / 0.05);
const script = (t, hov) => ({ thr: t < 1 ? hov : t < 1.6 ? 0.75 : t < 2.5 ? 0.3 : t < 4.0 ? hov + 0.08 : t < 4.6 ? 0.3 : hov + 0.08, pitch: ramp(t, 1.7, 2.26, -1), roll: ramp(t, 4.0, 4.58, 1), yaw: 0 });
const rec = fly(script, 6.5);
for (const [name, a, b] of [['flip', 1.4, 3.4], ['roll', 3.8, 5.6]]) {
  const rep = S.replicaFly(rec.rows, { params: rec.P, tune: rec.tune, world: W, from: a, to: b });
  const cut = rec.rows.filter(r => r[0] >= a - 0.8 && r[0] <= b);
  check(`${name}: the replica stays with the recording`, rep && rep.drift.pos < 0.35 && rep.drift.ang < 25, rep ? `drift ${rep.drift.pos} m, ${rep.drift.ang}°` : 'no replica');
  const c0 = calls(cut), c1 = calls(rep.rows);
  check(`${name}: the detector calls the same on the replica`, c0.length > 0 && c0.join() === c1.join(), `recording [${c0}] · replica [${c1}]`);
}
// a recording that came from different sticks than the ones it claims: the replica must show the drift
{ const bad = rec.rows.map(r => { const x = r.slice(); x[25] = 0; return x; });   // the flip's pitch stick erased
  const rep = S.replicaFly(bad, { params: rec.P, tune: rec.tune, world: W, from: 1.4, to: 3.4 });
  check('sticks that do not match the recording show up as drift', rep && rep.drift.ang > 90, `drift ${rep.drift.pos} m, ${rep.drift.ang}°`); }
console.log(`\n${ok}/${n} replica checks`); if (ok !== n) process.exit(1);
