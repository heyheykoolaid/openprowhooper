// Pilot feedback (2026-11-16), reproduced at the pilot's real rates (Blackbox: 300-500 deg/s, max 580, 30 deg camera):
// wall rides never registered; inverted yaw spins only with over-rotation; trippies read as Double Rolling Trippy;
// Matty flips read as Beginner Matty; jump ropes got in the way of Split-S.
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, M = globalThis.Maneuvers, W = S.buildPlayground(), H = M._h;
const { v3, add, mul, qmul, qaxis } = S, D = Math.PI / 180, P = Math.PI;
const { chain, line, hold, pitchQ, rollQ, yawQ, faceQ, sweep } = H;
let pass = 0, total = 0;
function run(name, path, want) {
  if (process.env.DBG && name.includes(process.env.DBG)) { const Pr = S.TrickDetector.prototype, tc = Pr.trackCrossings; if (!Pr._dbg) { Pr._dbg = 1; Pr.trackCrossings = function (d, t) { const n = this.crossLog.length; tc.call(this, d, t); if (this.crossLog.length > n) { const c = this.crossLog[n]; console.log('   cross', c.kind, c.t.toFixed(2), 'spd', c.spd.toFixed(1), 'fwd', c.fwdDot.toFixed(2), 'lat', c.latDot.toFixed(2), 'upY', c.upY.toFixed(2)); } }; } }
  const ev = M.detect(path, W, 30), got = ev.map(e => e.name), ok = JSON.stringify(got) === JSON.stringify(want); total++; if (ok) pass++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(46)} -> ${got.join(' | ') || 'nothing'}${ok ? '' : '   want ' + want.join(' | ')}`);
}
const at = (segs) => { const c = chain(segs); return { T: c.T, at: c.at }; };
// 1. wall ride along the graffiti wall (face at x = -18.8), rolled 90 deg away from it, gliding along at 1.6-2.4 m/s
for (const [gap, spd, roll] of [[0.30, 2.2, 90], [0.45, 1.6, 75], [0.18, 2.4, 100]]) {
  const x = -18.8 + gap, f = faceQ(v3(0, 0, -1)), qR = qmul(f, rollQ(roll * D)), T = 3.0 / spd;
  run(`wall ride (${gap} m off, ${spd} m/s, roll ${roll})`, at([line(v3(x + 1.2, 1.9, 16), v3(-1.2 / 0.5, 0, -spd), 0.5, f),
    { T: 0.25, f: t => ({ pos: v3(x, 1.9, 16 - spd * 0.5 - spd * t), q: qmul(f, rollQ(roll * D * t / 0.25)) }) },
    { T, f: t => ({ pos: v3(x, 1.9 - 0.12 * t, 16 - spd * 0.75 - spd * t), q: qR }) },
    { T: 0.3, f: t => ({ pos: v3(x + 0.5 * t, 1.9 - 0.12 * T, 16 - spd * (0.75 + T) - spd * t), q: qmul(f, rollQ(roll * D * (1 - t / 0.3))) }) },
    hold(v3(x + 0.6, 1.6, 16 - spd * (1.05 + T)), f, 1.5)]), ['Wall Ride']);
}
// 2. inverted yaw spin: roll 180, spin 360 about the WORLD vertical with the body held tilted (30 deg camera: the pilot keeps
// the view on the horizon), roll 180 out. Also a sloppy one: only ~330 deg of spin.
for (const [tilt, spin, rate] of [[0, 360, 380], [30, 360, 380], [30, 330, 350], [35, 345, 300]]) {
  const p0 = v3(0, 6, 1), inv = qmul(rollQ(P), pitchQ(-tilt * D)), rT = 180 / 340, sT = spin / rate;
  run(`inverted yaw spin (tilt ${tilt}, spin ${spin}, ${rate}/s)`, at([hold(p0, H.ID, 0.6),
    { T: rT, f: t => ({ pos: p0, q: qmul(rollQ(P * t / rT), pitchQ(-tilt * D * t / rT)) }) },
    { T: sT, f: t => ({ pos: p0, q: qmul(qaxis(v3(0, 1, 0), spin * D * t / sT), inv) }) },
    { T: rT, f: t => ({ pos: p0, q: qmul(qaxis(v3(0, 1, 0), spin * D), qmul(inv, qmul(pitchQ(tilt * D * t / rT), rollQ(P * t / rT)))) }) },
    hold(p0, qmul(qaxis(v3(0, 1, 0), spin * D), qmul(inv, qmul(pitchQ(tilt * D), rollQ(P)))), 1.6)]), ['Inverted Yaw Spin']);
}
// 3. trippy spin round a lamp post: inverted, leaning hard into the pole so it stays at the top of the screen (lots of body
// roll per lap, but never upright). And a real Double Rolling Trippy: barrel rolls while orbiting.
const LP = v3(-14, 0, -16);
function orbit(laps, lean, rollsPerLap) {
  const R = 1.6, w = 170 * D, T = laps * 2 * P / w;
  return { T: T + 1.5, at: t => { const a = Math.min(t, T) * w, pos = v3(LP.x + R * Math.cos(a), 2.4, LP.z + R * Math.sin(a));
    const toP = v3(-Math.cos(a), 0, -Math.sin(a)), face = faceQ(toP);
    let q = qmul(face, qmul(rollQ(P), rollQ(-lean * D)));                        // inverted, top of the quad leaning out so the pole sits high on screen
    if (rollsPerLap) q = qmul(face, rollQ(rollsPerLap * Math.min(t, T) * w));
    return { pos, q }; } };
}
run('trippy spin x2 (inverted, leaning 55 into the pole)', orbit(2.1, 55, 0), ['Trippy Spin x2']);
run('trippy spin x2 (inverted, leaning 25)', orbit(2.1, 25, 0), ['Trippy Spin x2']);
// realistic: inverted, facing the pole, nose pitched to look up it (30 deg camera) -> lots of body roll per lap, never upright
function lookUp(pitchDeg, wob) { const R = 1.6, w = 170 * D, T = 2.1 * 2 * P / w;
  return { T: T + 1.5, at: t => { const a = Math.min(t, T) * w, pos = v3(LP.x + R * Math.cos(a), 2.0, LP.z + R * Math.sin(a)), toP = v3(-Math.cos(a), 0, -Math.sin(a));
    return { pos, q: qmul(faceQ(toP), qmul(rollQ(P), qmul(pitchQ(-pitchDeg * D), rollQ((wob || 0) * D * Math.sin(t * 6))))) }; } }; }
for (const pd of [40, 55, 65]) run(`trippy spin x2 (inverted, nose up the pole ${pd})`, lookUp(pd, 0), ['Trippy Spin x2']);
run('trippy spin x2 (nose up 60, wobbling 15)', lookUp(60, 15), ['Trippy Spin x2']);
run('trippy spin x2 (leaning 65, wobbling)', (() => { const o = orbit(2.1, 65, 0); return { T: o.T, at: t => { const s = o.at(t); return { pos: s.pos, q: qmul(s.q, rollQ(14 * D * Math.sin(t * 7))) }; } }; })(), ['Trippy Spin x2']);
run('double rolling trippy (1 roll per lap)', orbit(2.1, 0, 1), ['Double Rolling Trippy Spin']);
// 4. Matty flip at the pilot's rates, split by a hang: over the bar, front flip ~200 at 320/s, hang looking down (slow),
// then the rest of the pitch while dropping behind and flying backward under the bar
function matty(first, hangRate, hangT, second, rate2) {
  const F = { C: v3(0, 0, -6), h: v3(0, 0, -1), under: 2.32, over: 2.46 }, h = F.h, face = faceQ(h);
  const C = v3(0, 2.4, -6), RZ = 1.4, RY = 1.25, mpos = ph => add(C, add(mul(h, -RZ * Math.sin(ph)), v3(0, -RY * Math.cos(ph), 0)));
  const T1 = first / 320, Th = hangT, T2 = second / rate2, Tt = T1 + Th + T2, tot = first + hangRate * hangT + second;
  const ang = t => t < T1 ? first * t / T1 : t < T1 + Th ? first + hangRate * (t - T1) : first + hangRate * Th + second * (t - T1 - Th) / T2;
  return at([line(add(mpos(P), mul(h, -2.6)), mul(h, 3.5), 0.75, face),
    { T: Tt, f: t => ({ pos: mpos(P + P * t / Tt), q: qmul(face, pitchQ(-ang(t) * D)) }) },
    line(mpos(2 * P), mul(h, -3), 1.0, qmul(face, pitchQ(-tot * D))), hold(add(mpos(2 * P), mul(h, -3)), qmul(face, pitchQ(-tot * D)), 1.4)]);
}
run('matty (one flip, 320/s)', matty(360, 0, 0.01, 0.01, 300), ['Matty Flip']);
run('matty split by a hang (200 + slow + 140)', matty(200, 20, 0.5, 140, 260), ['Matty Flip']);
run('matty split by a long hang (180 + 0.8 s + 160)', matty(180, 10, 0.8, 160, 240), ['Matty Flip']);
// beginner matty: over flying forward, brake (nose up), drop behind it and fly backward under it, upright the whole way
{ const h = v3(0, 0, -1), face = faceQ(h), C = v3(0, 2.4, -6), RZ = 1.3, RY = 1.25, mpos = ph => add(C, add(mul(h, -RZ * Math.sin(ph)), v3(0, -RY * Math.cos(ph), 0))), T = 1.8;
  run('beginner matty (no flip, upright)', at([line(add(mpos(P), mul(h, -2.6)), mul(h, 3.5), 0.75, face),
    { T, f: t => ({ pos: mpos(P + P * t / T), q: qmul(face, pitchQ(45 * D * Math.sin(P * t / T))) }) },
    line(mpos(2 * P), mul(h, -3), 1.0, face), hold(add(mpos(2 * P), mul(h, -3)), face, 1.4)]), ['Beginner Matty']); }
// 5. Split-S crossing the bar at an angle (approach 35-55 deg off square), with a bit of yaw in the roll
for (const ang of [35, 55]) {
  const F = M._h.frame(W, 'Swing Set', M.rng(5)), base = v3(0, 0, -1), a = ang * D, h = v3(Math.sin(a), 0, -Math.cos(a));
  const face = faceQ(h), topY = 3.2, botY = 1.4, rad = (topY - botY) / 2, C0 = v3(0, topY, -6);
  const p0 = add(C0, mul(h, -2.6)), rollT = 180 / 330, pr = add(C0, mul(h, -0.2)), cz = add(pr, mul(h, 2.0 * rollT)), c = v3(cz.x, topY - rad, cz.z), Th = 1.0;
  const R1 = qmul(rollQ(P), yawQ(20 * D));
  run(`split-S crossing at ${ang} deg`, at([line(p0, mul(h, 3.4), 0.71, face),
    { T: rollT, f: t => ({ pos: add(pr, mul(h, 2.0 * t)), q: qmul(face, qmul(rollQ(P * t / rollT), yawQ(20 * D * t / rollT))) }) },
    { T: Th, f: t => { const ps = P * t / Th; return { pos: add(c, add(v3(0, rad * Math.cos(ps), 0), mul(h, rad * Math.sin(ps)))), q: qmul(face, qmul(R1, pitchQ(ps))) }; } },
    line(v3(c.x, botY, c.z), mul(h, -3), 1.6, qmul(face, qmul(R1, pitchQ(P)))), hold(add(v3(c.x, botY, c.z), mul(h, -4.8)), qmul(face, qmul(R1, pitchQ(P))), 1.2)]), ['Split-S']);
  void F; void base;
}
console.log(`\n${pass}/${total} pilot-feedback flights`);
