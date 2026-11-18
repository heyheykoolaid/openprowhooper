// Flies every preset through the whoop "target feel" tests and prints the numbers next to the ranges real whoops show.
//   node tools/feelcheck.js [preset…] [--json]
// Ranges (from a whoop-sim spec the owner collected, 2026-11-18): AUW 22-40 g, thrust-to-weight 4.5-7, hover at 25-40 %
// collective, motor lag 10-20 ms, yaw 0 -> full rate in 120-160 ms, ground cushion gone by about one prop diameter,
// no coasting, the pack fading as it sags, a little bobbing in its own wash.
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim, { v3 } = S;
const args = process.argv.slice(2), JSON_OUT = args.includes('--json'), only = args.filter(a => !a.startsWith('--'));
const world = S.buildPlayground(); const HIGH = { pos: v3(60, 30, 60), yaw: 0 };   // far from anything, well clear of the ground
function mk(spec, tune = S.defaultTune()) { tune.batteryLife = true; const d = new S.Drone(S.buildDrone(spec), tune, { ...world, spawn: HIGH }); d.reset(HIGH); d.armed = true; return d; }
const DT = 0.001, run = (d, rc, T, each) => { for (let t = 0; t < T; t += DT) { d.step(rc, DT); if (each) each(t, d); } };
const thrust = d => d.thrust.reduce((a, b) => a + b, 0);
function hoverStick(spec) {   // bisection on the throttle stick for no climb, level, in clear air
  let lo = 0, hi = 1;
  for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2, d = mk(spec); run(d, { thr: mid, roll: 0, pitch: 0, yaw: 0 }, 0.6); const v0 = d.vel.y; run(d, { thr: mid, roll: 0, pitch: 0, yaw: 0 }, 0.4); if (d.vel.y > v0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
function lag(spec, hov, from, to) {   // time for total thrust to cover 63 % of a throttle step (motor + ESC + rotor inertia)
  const d = mk(spec); run(d, { thr: from, roll: 0, pitch: 0, yaw: 0 }, 0.5); const T0 = thrust(d); let T1 = T0, t63 = null;
  const probe = mk(spec); run(probe, { thr: from, roll: 0, pitch: 0, yaw: 0 }, 0.5); run(probe, { thr: to, roll: 0, pitch: 0, yaw: 0 }, 0.3); T1 = thrust(probe);
  run(d, { thr: to, roll: 0, pitch: 0, yaw: 0 }, 0.3, (t, q) => { if (t63 == null && Math.abs(thrust(q) - T0) >= 0.63 * Math.abs(T1 - T0)) t63 = t; });
  return t63 * 1000;
}
function rise(spec, hov, axis) {   // full stick on one axis from a hover: ms to reach 90 % of the rate it settles at
  const d = mk(spec); run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.4); const rc = { thr: hov, roll: 0, pitch: 0, yaw: 0 }; rc[axis] = 1;
  const k = { roll: 0, pitch: 1, yaw: 2 }[axis], tr = []; run(d, rc, 0.5, (t, q) => tr.push([t, Math.abs(q.pilotRates()[k])]));
  const top = Math.max(...tr.map(r => r[1])), r90 = tr.find(r => r[1] >= 0.9 * top);
  return { ms: r90 ? r90[0] * 1000 : null, top };
}
function coast(spec, hov) {   // level at 8 m/s forward on hover throttle: speed after 1 s (whoops do not coast)
  const d = mk(spec); run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.3); d.vel = v3(0, 0, -8); run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 1.0);
  return Math.hypot(d.vel.x, d.vel.z);
}
function cushion(spec, hov) {   // hover throttle, held at a height above open ground until the motors settle, then let go: vertical accel (m/s²)
  const p = S.buildDrone(spec), out = [];
  for (const k of [0.3, 0.5, 1, 2, 6]) { const h = k * p.D, at = v3(30, h + 0.012, 30); const d = new S.Drone(p, Object.assign(S.defaultTune(), { batteryLife: true }), world); d.reset({ pos: at, yaw: 0 }); d.armed = true;
    run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.5, (t, q) => { q.pos = v3(at.x, at.y, at.z); q.vel = v3(); q.w = v3(); q.q = { w: 1, x: 0, y: 0, z: 0 }; });
    run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.01); out.push([k, +(d.vel.y / 0.01).toFixed(2)]); }
  const top = out[out.length - 1][1]; return out.slice(0, -1).map(([k, a]) => [k, +(a - top).toFixed(2)]);   // relative to the same hover far from the ground
}
function fade(spec) {   // full throttle thrust on a fresh pack vs a pack at 20 %
  const at = soc => { const d = mk(spec); d.soc = soc; let m = 0; run(d, { thr: 1, roll: 0, pitch: 0, yaw: 0 }, 0.4, (t, q) => { m = Math.max(m, thrust(q)); }); return { T: m, V: d.vbat }; };
  const a = at(1), b = at(0.2); return { full: a, low: b, ratio: b.T / a.T };
}
function bob(spec, hov) {   // vertical shake: hovering still vs sinking into its own wash (std of vertical accel, m/s², 50 ms averages)
  const sd = (cut) => { const d = mk(spec); run(d, { thr: hov, roll: 0, pitch: 0, yaw: 0 }, 0.5); const vs = []; let sink = 0;
    run(d, { thr: hov * cut, roll: 0, pitch: 0, yaw: 0 }, 2.0, (t, q) => { if (t > 0.6 && Math.round(t * 1000) % 50 === 0) { vs.push(q.vel.y); sink += q.vel.y; } });
    const a = vs.slice(1).map((v, i) => (v - vs[i]) / 0.05), m = a.reduce((x, y) => x + y, 0) / a.length; return { sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length), sink: sink / vs.length }; };
  const s0 = sd(1), s1 = sd(0.8); return { still: s0.sd, sinking: s1.sd, sinkRate: s1.sink };
}
function lagSmall(spec, hov) { return lag(spec, hov, hov, Math.min(1, hov + 0.1)); }
const names = only.length ? only : Object.keys(S.PRESETS), res = [];
for (const name of names) { const spec = S.PRESETS[name]; if (!spec) { console.error('no preset', name); continue; }
  const p = S.buildDrone(spec), st = p.stats, hov = hoverStick(spec);
  const r = { name, auw: +st.auw.toFixed(1), twr: +st.twr.toFixed(2), hoverStick: +(hov * 100).toFixed(1), I: [p.I.x, p.I.y, p.I.z].map(x => +x.toExponential(2)),
    lagUp: +lag(spec, hov, hov, 1).toFixed(1), lagSmall: +lagSmall(spec, hov).toFixed(1), lagDown: +lag(spec, hov, 1, hov).toFixed(1), yaw: rise(spec, hov, 'yaw'), roll: rise(spec, hov, 'roll'),
    coast: +coast(spec, hov).toFixed(2), cushion: cushion(spec, hov), fade: fade(spec), bob: bob(spec, hov) };
  res.push(r); }
if (JSON_OUT) { console.log(JSON.stringify(res, null, 1)); process.exit(0); }
const ok = (v, a, b) => v >= a && v <= b ? '  ' : ' ✗';
console.log('preset                        AUW g  TWR    hover%  lag +10%/full/down ms   yaw 90% ms (°/s)   roll 90% ms   8 m/s after 1 s   pack 20% thrust   bob still/sinking');
for (const r of res) console.log(`${r.name.padEnd(28)} ${String(r.auw).padStart(5)}${ok(r.auw, 22, 40)} ${r.twr.toFixed(1).padStart(4)}${ok(r.twr, 4.5, 7)} ${String(r.hoverStick).padStart(6)}${ok(r.hoverStick, 25, 40)}  ${String(r.lagSmall).padStart(4)}${ok(r.lagSmall, 10, 20)}/${String(r.lagUp).padStart(4)}/${String(r.lagDown).padStart(4)}  ${String(Math.round(r.yaw.ms)).padStart(5)}${ok(r.yaw.ms, 120, 160)} (${Math.round(r.yaw.top)})   ${String(Math.round(r.roll.ms)).padStart(5)}          ${r.coast.toFixed(1).padStart(4)} m/s        ${Math.round(r.fade.ratio * 100)}% (${r.fade.full.V.toFixed(2)}→${r.fade.low.V.toFixed(2)} V)   ${r.bob.still.toFixed(2)} / ${r.bob.sinking.toFixed(2)} at ${(-r.bob.sinkRate).toFixed(1)} m/s`);
console.log('\nground cushion (extra vertical accel m/s² at hover throttle, height in prop diameters):');
for (const r of res) console.log(`  ${r.name.padEnd(28)} ${r.cushion.map(([k, a]) => `${k}D: ${a}`).join('   ')}`);
