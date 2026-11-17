// Slide Disarm with the real physics: fly low and fast, disarm, slide, re-arm before stopping, fly away.
// (TPW "Slide Disarm", 200 pts.) usage: node test/slide.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const W = S.buildPlayground(), P = S.buildDrone(S.PRESETS[Object.keys(S.PRESETS)[0]]);
let ok = 0, n = 0;
function fly(name, o, want) {
  const d = new S.Drone(P, S.defaultTune(), W), det = new S.TrickDetector(W); d.reset(o.spawn || { pos: { x: +(process.env.SX ?? -4), y: 0.03, z: 13 }, yaw: 0 }); d.armed = true; det.onArmChange(d, true);
  const rc = { thr: 0, roll: 0, pitch: 0, yaw: 0 }, dt = 0.001, got = []; let t = 0, slideT = null, rearmed = false, log = '';
  const step = () => { d.step(rc, dt); det.update(d, dt, rc); det.postStep(d); for (const e of det.drain()) if (e.name !== 'near') got.push(e); t += dt; };
  // take off and get moving forward, low
  while (t < 0.6) { rc.thr = 0.62; rc.pitch = 0; step(); }
  while (t < 0.6 + o.run) { const tilt = Math.acos(Math.min(1, d.up().y)) * 57.3; rc.pitch = tilt < (o.tilt || 40) ? 0.3 : 0; rc.thr = d.pos.y > o.h ? 0.3 : 0.55; step(); }
  const v0 = Math.hypot(d.vel.x, d.vel.z); rc.thr = 0; rc.pitch = 0; d.armed = false; det.onArmChange(d, false); slideT = t;
  // slide; re-arm either when the speed has dropped to o.rearmAt, or after it has stopped for o.late seconds
  let stopped = null;
  while (t < slideT + 8 && !rearmed) { step(); const hs = Math.hypot(d.vel.x, d.vel.z), onG = d.pos.y < 0.12;
    if (onG && hs < 0.1 && stopped == null) stopped = t;
    if (o.late != null ? (stopped != null && t - stopped > o.late) : (onG && hs < o.rearmAt && hs > 0.3 && d.up().y > 0.8)) { d.crashed = false; d.armed = true; det.onArmChange(d, true); rearmed = true; } }
  const slid = det.pendingFly ? det.pendingFly.meters : 0;
  const upAt = d.up().y; for (const t1 = t + 2.5; t < t1;) { rc.thr = 0.62; rc.pitch = 0; step(); }
  if (process.env.DBG) console.log('   up at re-arm', upAt.toFixed(2), 'crash', d.crashReason, 'events', got.map(e => e.name + '@' + e.t.toFixed(2)).join(' '));
  const names = got.map(e => e.name), pass = JSON.stringify(names) === JSON.stringify(want); n++; if (pass) ok++;
  console.log(`${pass ? '✓' : '✗'} ${name.padEnd(52)} -> ${names.join(' | ') || 'nothing'}  (disarmed at ${v0.toFixed(1)} m/s, slid ${slid.toFixed(1)} m${got[0] && got[0].obstacle ? ', on ' + got[0].obstacle : ''})${pass ? '' : '   want ' + (want.join(' | ') || 'nothing')}`);
}
fly('fast and low, re-arm while still sliding', { run: 2.6, h: 0.5, tilt: 50, rearmAt: 2.5 }, ['Slide Disarm']);
fly('slower (about 4 m/s): too short a slide to count', { run: 1.7, h: 0.5, rearmAt: 0.6 }, []);
fly('re-arm just after it stops (0.2 s)', { run: 2.6, h: 0.5, tilt: 50, late: 0.2 }, ['Slide Disarm']);
fly('let it stop and sit for 2 s, then take off', { run: 2.6, h: 0.5, tilt: 50, late: 2 }, []);
{ // disarm at a hover and drop: no slide
  const d = new S.Drone(P, S.defaultTune(), W), det = new S.TrickDetector(W); d.reset(W.spawn); d.armed = true; const rc = { thr: 0.6, roll: 0, pitch: 0, yaw: 0 }, got = [];
  const step = k => { for (let i = 0; i < k; i++) { d.step(rc, 0.001); det.update(d, 0.001, rc); det.postStep(d); for (const e of det.drain()) if (e.name !== 'near') got.push(e.name); } };
  step(700); rc.thr = 0; d.armed = false; det.onArmChange(d, false); step(1500); d.armed = true; det.onArmChange(d, true); rc.thr = 0.7; step(2000);
  const pass = !got.includes('Slide Disarm'); n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${'disarm at a hover, drop, take off again'.padEnd(52)} -> ${got.join(' | ') || 'nothing'}`); }
console.log(`\n${ok}/${n} slide checks`); process.exitCode = ok === n ? 0 : 1;
