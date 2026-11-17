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
// ---- Advanced: radio link delay and Betaflight-style stick smoothing (off by default)
{ const resp = extra => { const { d, P, tune } = make('Air65 Racing', 'acro'); Object.assign(tune, extra); const hov = P.stats.hoverThrottle; run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.3);
    const want = S.applyRate(0.5, tune.rates.roll, tune.ratesType); let first = null, t63 = null, peak = 0, late = 0;
    run(d, t => ({ thr: hov, roll: Math.min(1, t / 0.06) * 0.5, pitch: 0, yaw: 0 }), 0.5, t => { const r = d.pilotRates()[0]; peak = Math.max(peak, r); if (first == null && r > 3) first = t; if (t63 == null && r >= 0.63 * want) t63 = t; if (t > 0.3) late = Math.max(late, Math.abs(r - want)); });
    return { first: first * 1000, t63: t63 * 1000, over: (peak / want - 1) * 100, late }; };
  const ideal = resp({}), real = resp({ rcLinkHz: 250, rcDelayMs: 12, rcSmooth: 'auto', rcSmoothFactor: 30 }), slow = resp({ rcLinkHz: 50, rcDelayMs: 25, rcSmooth: 'auto' }), raw = resp({ rcLinkHz: 150, rcDelayMs: 10, rcSmooth: 'off' });
  check('link delay: nothing happens until the first packet has arrived', real.first >= 12 && real.first > ideal.first + 8, `ideal ${ideal.first.toFixed(0)} ms, 250 Hz link ${real.first.toFixed(0)} ms`);
  check('a real link makes the response later and rounder, and it still settles on the commanded rate', real.t63 > ideal.t63 + 10 && real.late < 12 && real.over <= ideal.over + 3, `63% at ${ideal.t63.toFixed(0)} -> ${real.t63.toFixed(0)} ms, overshoot ${ideal.over.toFixed(0)} -> ${real.over.toFixed(0)}%`);
  check('a slow link with its heavier auto smoothing is later still', slow.t63 > real.t63 + 15 && slow.late < 12, `${slow.t63.toFixed(0)} ms`);
  check('smoothing off flies too (steps from the packets, no blow-up)', raw.late < 15 && raw.over < 40, `overshoot ${raw.over.toFixed(0)}%`); }
// ---- Advanced: weight feel (scales the mass and inertia the physics sees; 1 = unchanged)
{ const climb = k => { const { d, P, tune } = make('Air65 Racing', 'acro'); tune.weightFeel = k; d.setParams(P, tune); const y0 = d.pos.y; run(d, { thr: 0.7, roll: 0, pitch: 0, yaw: 0 }, 0.5); return d.pos.y - y0; };
  const spin = k => { const { d, P, tune } = make('Air65 Racing', 'acro'); tune.weightFeel = k; d.setParams(P, tune); run(d, { thr: P.stats.hoverThrottle, roll: 0, pitch: 0, yaw: 0 }, 0.2); let t20 = null; run(d, t => ({ thr: P.stats.hoverThrottle, roll: 1, pitch: 0, yaw: 0 }), 0.3, t => { if (t20 == null && d.pilotRates()[0] > 400) t20 = t; }); return t20; };
  const c1 = climb(1), cL = climb(0.7), cH = climb(1.3), s1 = spin(1), sL = spin(0.7), sH = spin(1.3);
  check('weight feel: lighter climbs harder on the same throttle, heavier less', cL > c1 * 1.15 && cH < c1 * 0.9, `${cL.toFixed(2)} / ${c1.toFixed(2)} / ${cH.toFixed(2)} m`);
  check('…and rolls up to speed sooner (heavier later)', sL <= s1 && sH >= s1, `${(sL * 1000).toFixed(0)} / ${(s1 * 1000).toFixed(0)} / ${(sH * 1000).toFixed(0)} ms`);
  const { d, P, tune } = make('Air65 Racing', 'acro'); tune.weightFeel = 1; d.setParams(P, tune); check('at 100% the physics sees the very same parts', d.p === P); }
// ---- the other physics-feel sliders
{ const fly = (extra, fn) => { const { d, P, tune } = make('Air65 Racing', 'acro'); Object.assign(tune, extra); d.setParams(P, tune); return fn(d, P); };
  const coast = x => fly({ dragFeel: x }, (d, P) => { d.vel = S.v3(0, 0, -8); run(d, { thr: P.stats.hoverThrottle, roll: 0, pitch: 0, yaw: 0 }, 1.0); return Math.hypot(d.vel.x, d.vel.z); });
  check('air drag: more drag loses speed sooner, less carries it', coast(2) < coast(1) && coast(0.5) > coast(1), [2, 1, 0.5].map(x => coast(x).toFixed(2)).join(' / ') + ' m/s after 1 s');
  const spool = x => fly({ motorFeel: x }, (d) => { let t50 = null; run(d, { thr: 0.8, roll: 0, pitch: 0, yaw: 0 }, 0.3, t => { if (t50 == null && d.motorW[0] > 2500) t50 = t; }); return t50; });
  check('motor response: lower spins the motors up later', spool(0.5) > spool(1) && spool(2) <= spool(1), [0.5, 1, 2].map(x => (spool(x) * 1000).toFixed(1)).join(' / ') + ' ms');
  const sag = x => fly({ sagFeel: x }, (d) => { let s = 0, n = 0; run(d, { thr: 1, roll: 0, pitch: 0, yaw: 0 }, 0.3, t => { if (t > 0.1) { s += d.vbat; n++; } }); return s / n; });   // averaged: the voltage and the current pull on each other step to step
  check('battery sag: 0% holds the voltage at full throttle, 200% drops it more', sag(0) > sag(1) && sag(2) < sag(1), [0, 1, 2].map(x => sag(x).toFixed(2)).join(' / ') + ' V');
  check('junk values are clamped, not trusted', fly({ dragFeel: 99, motorFeel: -3 }, d => d.feel.dragFeel === 2 && d.feel.motorFeel === 0.5)); }
console.log(`\n${ok}/${n} mode and 2S checks`); if (ok !== n) process.exitCode = 1;
