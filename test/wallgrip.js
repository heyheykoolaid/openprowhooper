// Wall grip (tune.wallGrip, 2026-11-19, Metal Craft Fpv: "I can't wall stick, I just slide down the wall"). A whoop held
// belly-first against the Playground's brick wall with its thrust into it: with the game's grip (0.9) it sticks from about a
// third throttle and is not called "stuck" while it pushes; without wallGrip (the physics as it was) it slides down.
// usage: node test/wallgrip.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const W = S.buildPlayground(); let ok = 0, n = 0;
function stick(preset, wg, thr) {
  const tune = S.defaultTune(); if (wg != null) tune.wallGrip = wg;
  const d = new S.Drone(S.buildDrone(S.PRESETS[preset]), tune, W); d.reset({ pos: { x: 0, y: 3, z: -21.8 }, yaw: 0 }); d.armed = true;
  let best = null; for (const s of [1, -1]) { const q = S.qaxis(S.v3(1, 0, 0), s * Math.PI / 2), u = S.qrot(q, S.v3(0, 1, 0)); if (!best || u.z < best.u.z) best = { q, u }; }
  d.q = best.q; d.vel = S.v3(0, 0, -0.3);
  const rc = { thr, roll: 0, pitch: 0, yaw: 0 }; let y0 = 0;
  for (let i = 0; i < 3000; i++) { d.step(rc, 0.001); if (i === 1000) y0 = d.pos.y; }
  return { vy: (d.pos.y - y0) / 2, crashed: d.crashed ? d.crashReason : '' };
}
const check = (name, pass, got) => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(60)} ${got}`); };
for (const pr of ['Air65 Racing', 'Air65 Champion', '75mm 2S (Mobula7 style)']) for (const thr of [0.4, 0.6, 0.9]) {
  const r = stick(pr, 0.9, thr);
  check(`${pr}, grip 0.9, throttle ${thr}: sticks`, Math.abs(r.vy) < 0.15 && !r.crashed, `${r.vy.toFixed(2)} m/s ${r.crashed}`);
}
{ const r = stick('Air65 Racing', null, 0.4); check('no wallGrip (old physics), throttle 0.4: slides down', r.vy < -0.3, `${r.vy.toFixed(2)} m/s ${r.crashed}`); }
{ const tune = S.defaultTune(); tune.wallGrip = 0.9; const d = new S.Drone(S.buildDrone(S.PRESETS['Air65 Racing']), tune, W); d.reset({ pos: { x: 0, y: 3, z: -21.8 }, yaw: 0 }); d.armed = true;
  let best = null; for (const s of [1, -1]) { const q = S.qaxis(S.v3(1, 0, 0), s * Math.PI / 2), u = S.qrot(q, S.v3(0, 1, 0)); if (!best || u.z < best.u.z) best = { q, u }; } d.q = best.q; d.vel = S.v3(0, 0, -0.3);
  for (let i = 0; i < 600; i++) d.step({ thr: 0, roll: 0, pitch: 0, yaw: 0 }, 0.001);
  check('grip 0.9, motors idle: falls off the wall', d.pos.y < 2, `${(3 - d.pos.y).toFixed(2)} m dropped in 0.6 s`); }
console.log(`\n${ok}/${n} wall grip checks`); process.exitCode = ok === n ? 0 : 1;
