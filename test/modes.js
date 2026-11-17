// 2S whoops and the flight modes, flown with the real physics. node test/modes.js
//  - every 2S preset hovers and holds a commanded rate without shaking itself apart on the stock tune
//  - Angle mode leans as far as the stick asks and levels itself when the stick is let go
//  - 3D mode: stick middle = no thrust, above = up through the props, below = props backward; the quad hovers upside-down
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const W = { objs: [], prims: [], zones: [], spawn: { pos: S.v3(0, 0.03, 0), yaw: 0 } };
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const rollDeg = d => Math.atan2(-d.right().y, d.up().y) * S.R2D, pitchDeg = d => Math.asin(Math.max(-1, Math.min(1, d.fwd().y))) * S.R2D;
function make(preset, mode, at = 6) { const P = S.buildDrone(S.PRESETS[preset]), tune = S.defaultTune(); tune.flightMode = mode; const d = new S.Drone(P, tune, W); d.reset({ pos: S.v3(0, at, 0), yaw: 0 }); d.pos = S.v3(0, at, 0); d.armed = true; return { d, P, tune }; }
const run = (d, rc, T, each) => { for (let t = 0; t < T; t += 0.001) { d.step(typeof rc === 'function' ? rc(t) : rc, 0.001); if (each) each(t); } };

// ---- 2S presets on the stock tune
for (const name of Object.keys(S.PRESETS).filter(k => /2S/.test(k))) {
  const { d, P } = make(name, 'acro'), hov = P.stats.hoverThrottle;
  check(`${name}: believable numbers`, P.stats.twr > 3.5 && P.stats.twr < 7.5 && hov > 0.2 && hov < 0.5 && d.vbat > 7.4 && d.vbat < 8.8, `twr ${P.stats.twr.toFixed(1)}, hover ${Math.round(hov * 100)}%, ${d.vbat.toFixed(2)} V`);
  let y0 = d.pos.y; run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 1.0);
  check(`${name}: hovers near its hover throttle`, Math.abs(d.pos.y - y0) < 1.6 && d.up().y > 0.97, `moved ${(d.pos.y - y0).toFixed(2)} m in 1 s`);
  // a roll-rate step: follows it, and the rate does not ring afterwards
  let peak = 0, wob = 0, last = null; run(d, t => ({ thr: hov, roll: t < 0.25 ? 0.5 : 0, pitch: 0, yaw: 0 }), 0.7, t => { const r = d.pilotRates()[0]; if (t < 0.25) peak = Math.max(peak, r); else if (t > 0.45) { if (last != null) wob = Math.max(wob, Math.abs(r)); last = r; } });
  check(`${name}: follows a roll command and settles`, peak > 150 && wob < 40, `peak ${Math.round(peak)} deg/s, left over ${Math.round(wob)} deg/s`);
}
// ---- Angle mode
{ const { d, P, tune } = make('Air65 Racing', 'angle'), hov = P.stats.hoverThrottle;
  run(d, { thr: hov + 0.1, roll: 0.5, pitch: 0, yaw: 0 }, 1.0);
  check('angle: half roll stick holds half the angle limit', Math.abs(rollDeg(d) - 0.5 * 55) < 6, `${rollDeg(d).toFixed(1)}° of ${0.5 * 55}°`);
  run(d, { thr: hov + 0.1, roll: 1, pitch: 0, yaw: 0 }, 1.0);
  check('angle: full stick stops at the limit, it does not roll over', Math.abs(rollDeg(d) - 55) < 7 && d.up().y > 0.4, `${rollDeg(d).toFixed(1)}°`);
  run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 1.0);
  check('angle: letting go levels the quad', Math.abs(rollDeg(d)) < 3 && Math.abs(pitchDeg(d)) < 3, `roll ${rollDeg(d).toFixed(1)}°, pitch ${pitchDeg(d).toFixed(1)}°`);
  run(d, { thr: hov + 0.1, roll: 0, pitch: 0.6, yaw: 0 }, 1.0);
  check('angle: pitch stick forward tips the nose down', pitchDeg(d) < -20 && pitchDeg(d) > -45, `${pitchDeg(d).toFixed(1)}°`);
  tune.flightMode = 'acro'; run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.5); const held = pitchDeg(d);
  check('back in acro the lean is held, not levelled', held < -15, `${held.toFixed(1)}°`); }
// ---- 3D mode
for (const preset of ['Air65 3D', '75mm 2S 3D']) {
  const { d, P } = make(preset, '3d'), hov = P.stats.hoverThrottle, mid = { thr: 0.5, roll: 0, pitch: 0, yaw: 0 };
  run(d, { thr: 0.1, roll: 0, pitch: 0, yaw: 0 }, 0.3);
  check(`${preset}: armed with the stick low, nothing spins backward until the stick has been to the middle`, d.motorW.every(w => w >= 0));
  run(d, mid, 0.3); const vy0 = d.vel.y;
  check(`${preset}: stick in the middle is no thrust (it falls)`, vy0 < -1.5 && d.thrust.every(T => Math.abs(T) < 0.02), `vy ${vy0.toFixed(1)} m/s`);
  d.pos = S.v3(0, 8, 0); d.vel = S.v3(); run(d, { thr: 0.5 + 0.5 * (hov * 1.25 + 0.05), roll: 0, pitch: 0, yaw: 0 }, 1.0);
  check(`${preset}: stick above the middle climbs upright`, d.vel.y > 0.3 && d.up().y > 0.95 && d.motorW.every(w => w > 0), `vy ${d.vel.y.toFixed(1)} m/s`);
  // upside-down: half a roll with the stick in the middle, then stick BELOW the middle to push away from the ground
  d.pos = S.v3(0, 12, 0); d.vel = S.v3(); for (let k = 0; k < 900 && d.up().y > -0.985; k++) d.step({ thr: 0.5, roll: 0.6, pitch: 0, yaw: 0 }, 0.001); run(d, mid, 0.2);
  d.pos = S.v3(0, 12, 0); d.vel = S.v3(); const upY = d.up().y;
  run(d, { thr: 0.5 - 0.5 * (hov / P.revEff * 1.3 + 0.05), roll: 0, pitch: 0, yaw: 0 }, 1.2);
  check(`${preset}: stick below the middle spins the props backward and holds it up, inverted`, upY < -0.8 && d.up().y < -0.9 && d.vel.y > 0.2 && d.motorW.every(w => w < 0), `up ${d.up().y.toFixed(2)}, vy ${d.vel.y.toFixed(1)} m/s, ${Math.round(d.motorW[0] * 9.55)} rpm`);
  let wob = 0; run(d, t => ({ thr: 0.5 - 0.5 * (hov / P.revEff * 1.1 + 0.05), roll: t < 0.2 ? 0.4 : 0, pitch: 0, yaw: 0 }), 0.7, t => { if (t > 0.45) wob = Math.max(wob, Math.abs(d.pilotRates()[0])); });
  check(`${preset}: it stays in control upside-down (roll command followed, then steady)`, wob < 40, `left over ${Math.round(wob)} deg/s`);
}
{ const a = S.buildDrone(S.PRESETS['Air65 Racing']), b = S.buildDrone(S.PRESETS['Air65 3D']); check('ordinary props push about half as hard backward; 3D props about the same', a.revEff < 0.65 && b.revEff > 0.9); }
{ const { d } = make('Air65 Racing', 'acro'); run(d, { thr: 0, roll: 0, pitch: 0, yaw: 0 }, 0.4); check('outside 3D mode the motors never turn backward', d.motorW.every(w => w >= 0)); }
console.log(`\n${ok}/${n} mode and 2S checks`); if (ok !== n) process.exitCode = 1;
