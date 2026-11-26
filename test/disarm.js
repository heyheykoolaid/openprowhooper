// Disarm tricks with the real physics (owner, 2026-11-21): disarm in the air, the quad's own momentum carries the rotation with the
// motors off, re-arm before touching anything, fly away. node test/disarm.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const W = S.buildPlayground(), P = S.buildDrone(S.PRESETS['Air65 Racing']);
let ok = 0, n = 0;
// script: (ctx) => void, called every step with { t, d, rc, rot (deg per axis since the disarm), disarm(), arm() }
function fly(name, script, want, T = 6, dead = 0.1) {
  const tune = S.defaultTune(); if (dead != null) tune.deadSpin = dead;
  const d = new S.Drone(P, tune, W), det = new S.TrickDetector(W); d.reset({ pos: { x: 70, y: 0.03, z: 70 }, yaw: 0 }); d.pos = S.v3(70, 26, 70); d.armed = true; det.onArmChange(d, true);
  const rc = { thr: 0.36, roll: 0, pitch: 0, yaw: 0 }, got = [], A = [0, 0, 0], A0 = [0, 0, 0], st = {}; let t = 0, offT = null, secs = 0;
  const ctx = { d, rc, st, get t() { return t; }, get off() { return offT != null; }, rot: k => Math.abs(A[k] - A0[k]),
    disarm() { if (d.armed) { d.armed = false; det.onArmChange(d, false); offT = t; for (let i = 0; i < 3; i++) A0[i] = A[i]; } },
    arm() { if (!d.armed && !d.crashed) { d.armed = true; det.onArmChange(d, true); secs = t - offT; offT = null; } } };
  for (; t < T; t += 0.001) { rc.roll = rc.pitch = rc.yaw = 0; rc.thr = 0.36; script(ctx); d.step(rc, 0.001); const r = d.pilotRates(); for (let i = 0; i < 3; i++) A[i] += r[i] * 0.001; det.update(d, 0.001, rc); det.postStep(d); for (const e of det.drain()) if (e.name !== 'near') got.push(e); }
  const names = got.map(e => e.name), pass = typeof want === 'function' ? want(names) : JSON.stringify(names) === JSON.stringify(want); n++; if (pass) ok++;
  console.log(`${pass ? '✓' : '✗'} ${name.padEnd(64)} -> ${names.join(' | ') || 'nothing'}${got[0] && got[0].deadDeg ? `  (${got[0].deadDeg}° with the motors off, ${secs.toFixed(2)} s, ended ${d.pos.y.toFixed(1)} m up)` : ''}${pass || typeof want === 'function' ? '' : '   want ' + (want.join(' | ') || 'nothing')}`);
  return got;
}
// a flick on one axis, the motors cut once it is turning, caught again after `turn` degrees with them off
const dead = (ax, k, turn, o = {}) => c => { const { t, rc, st } = c;
  if (t < 1) return; if (t < 1.25) { rc.thr = 0.75; return; }                    // a little pop up first
  if (!st.cut && !st.back) { rc[ax] = 1; rc.thr = 0.3; if (t > 1.25 + (o.spin || 0.14)) { if (o.noCut) st.back = true; else { c.disarm(); st.cut = true; } } return; }
  if (c.off) { if (c.rot(k) >= turn || (o.maxOff && t > 1.39 + o.maxOff)) c.arm(); return; }
  if (!st.up && c.d.up().y < 0.9 && st.cut) { rc[ax === 'yaw' ? 'pitch' : ax] = 1; rc.thr = 0.3; return; } st.up = true; rc.thr = 0.55; };   // caught: carry on round to upright, fly away
fly('a flip carried right round with the motors off', dead('pitch', 1, 345), ['Disarm Flip']);
fly('a roll carried right round with the motors off', dead('roll', 0, 345), ['Disarm Roll']);
fly('a flat spin carried right round, upright', dead('yaw', 2, 345, { spin: 0.3 }), ['Disarm Spin']);
// upside-down: half a flip in (armed), start the spin, cut, a full turn dead, re-arm, half a roll out
fly('the same upside-down', c => { const { t, rc, st, d } = c; if (t < 1) return; if (!st.inv) { rc.pitch = 1; rc.thr = 0.5; if (d.up().y < -0.93) st.inv = t; return; }
  if (!st.cut) { rc.yaw = 1; rc.thr = 0.12; if (t > st.inv + 0.3) { c.disarm(); st.cut = true; } return; }
  if (c.off) { if (c.rot(2) >= 345) { c.arm(); st.out = t; } return; }
  if (d.up().y < 0.9 && !st.done) { rc.roll = 1; rc.thr = 0.2; return; } st.done = true; rc.thr = 0.6; }, ['Dead Pirate Spin'], 7);
// a loop with a dead top: forward, punch and pull back, cut as it goes over, fall round the top, catch it on the way down and pull out
fly('a loop whose top is flown with the motors off', c => { const { t, rc, st, d } = c; if (t < 1) return; if (t < 2.3) { rc.pitch = t < 1.25 ? -0.5 : t > 2.05 ? 0.5 : 0; rc.thr = t < 2.05 ? 0.62 : 0.5; return; }   /* tip forward, fly ahead, level off */
  if (!st.cut) { rc.pitch = 0.62; rc.thr = 0.95; if (d.up().y < 0.05) { c.disarm(); st.cut = true; } return; }
  if (c.off) { if (c.rot(1) >= 150) c.arm(); return; }
  if (!st.lvl) { rc.pitch = 0.6; rc.thr = 0.35; if (d.up().y > 0.92) st.lvl = true; return; } rc.thr = 0.55; }, ['Disarm Loop'], 7);
fly('the same flip with the motors running: an ordinary Flip', c => { const { t, rc, st } = c; if (t < 1) return; if (t < 1.25) { rc.thr = 0.75; return; } if (t < 1.25 + 0.6) { rc.pitch = 1; rc.thr = 0.3; return; } rc.thr = 0.55; }, ['Flip']);
fly('motors off for a moment in a hover, no rotation', c => { const { t, st } = c; if (t > 1.2 && !st.a) { c.disarm(); st.a = 1; } if (t > 1.6 && !st.b) { c.arm(); st.b = 1; } c.rc.thr = t > 1.6 ? 0.6 : 0.36; }, []);
{ const got = fly('a dead flip that is never caught (it hits the ground)', dead('pitch', 1, 1e9), [], 7).concat(fly('  …or caught only after it has landed', c => { const f = dead('pitch', 1, 1e9); f(c); if (c.t > 6) c.arm(); }, names => names.every(x => x === 'Crash'), 8));   // re-armed on the ground it may tip over (a crash): never a trick
  void got; }
fly('a flick with the motors off for a quarter turn only', dead('pitch', 1, 90), ['Flip']);
fly('the old physics (no deadSpin): the same cut flip stops turning', dead('pitch', 1, 345, { maxOff: 0.9 }), names => !names.some(x => /Disarm|Dead/.test(x)), 6, null);
console.log(`\n${ok}/${n} disarm checks`); process.exitCode = ok === n ? 0 : 1;
