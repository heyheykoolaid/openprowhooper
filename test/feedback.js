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
// 1b. wall rides with a 30 deg camera (pilot feedback): pitched forward to see ahead, roll short of 90, frame well off the
// wall. And a banked turn away from the wall must NOT count.
for (const [gap, spd, roll, pf] of [[0.8, 1.8, 60, 35], [1.0, 2.2, 70, 30], [0.6, 1.5, 50, 40]]) {
  const x = -18.8 + gap, f = faceQ(v3(0, 0, -1)), att = r => qmul(f, qmul(pitchQ(-pf * D * Math.min(1, r * 1.5)), rollQ(roll * D * r))), T = 3.0 / spd;
  run(`wall ride @30 cam (${gap} m off, roll ${roll}, pitch ${pf})`, at([line(v3(x + 1.2, 1.9, 16), v3(-1.2 / 0.5, 0, -spd), 0.5, f),
    { T: 0.25, f: t => ({ pos: v3(x, 1.9, 16 - spd * 0.5 - spd * t), q: att(t / 0.25) }) },
    { T, f: t => ({ pos: v3(x + 0.12 * Math.sin(t * 7), 1.9 - 0.12 * t, 16 - spd * 0.75 - spd * t), q: qmul(att(1), rollQ(8 * D * Math.sin(t * 9))) }) },
    { T: 0.3, f: t => ({ pos: v3(x + 0.5 * t, 1.9 - 0.12 * T, 16 - spd * (0.75 + T) - spd * t), q: att(1 - t / 0.3) }) },
    hold(v3(x + 0.6, 1.6, 16 - spd * (1.05 + T)), f, 1.5)]), ['Wall Ride']);
}
{ // banked turn away from the wall, starting 0.8 m off it
  const x0 = -18.0, R = 2.5, w = 2.0 / R, T = 1.6;
  run('banked turn away from the wall (no ride)', at([line(v3(x0, 1.9, 18), v3(0, 0, -2.0), 0.6, faceQ(v3(0, 0, -1))),
    { T, f: t => { const a = w * t, pos = v3(x0 + R - R * Math.cos(a), 1.9, 18 - 1.2 - R * Math.sin(a)), dir = v3(Math.sin(a), 0, -Math.cos(a));
      return { pos, q: qmul(faceQ(dir), rollQ(40 * D * Math.min(1, t * 4))) }; } },
    hold(v3(x0 + R - R * Math.cos(w * T), 1.9, 18 - 1.2 - R * Math.sin(w * T)), faceQ(v3(1, 0, 0)), 1.0)]), []);
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
function orbit(laps, lean, rollsPerLap, LP0, R = 1.6, y = 2.4, drift = 0) { const LPc = LP0 || LP; { const LP = LPc; return orbitAt(LP, laps, lean, rollsPerLap, R, y, drift); } }
function orbitAt(LP0, laps, lean, rollsPerLap, R, y, drift) {
  const w = 170 * D, T = laps * 2 * P / w;
  return { T: T + 1.5, at: t => { const LP = v3(LP0.x + drift * Math.min(t, T), 0, LP0.z); const a = Math.min(t, T) * w, pos = v3(LP.x + R * Math.cos(a), y, LP.z + R * Math.sin(a));
    const toP = v3(-Math.cos(a), 0, -Math.sin(a)), face = faceQ(toP);
    let q = qmul(face, qmul(rollQ(P), rollQ(-lean * D)));                        // inverted, top of the quad leaning out so the pole sits high on screen
    if (rollsPerLap) q = qmul(face, rollQ(rollsPerLap * Math.min(t, T) * w));
    return { pos, q }; } };
}
run('trippy spin x2 (inverted, leaning 55 into the pole)', orbit(2.1, 55, 0), ['Trippy Spin']);
run('trippy spin x2 (inverted, leaning 25)', orbit(2.1, 25, 0), ['Trippy Spin']);
// realistic: inverted, facing the pole, nose pitched to look up it (30 deg camera) -> lots of body roll per lap, never upright
function lookUp(pitchDeg, wob) { const R = 1.6, w = 170 * D, T = 2.1 * 2 * P / w;
  return { T: T + 1.5, at: t => { const a = Math.min(t, T) * w, pos = v3(LP.x + R * Math.cos(a), 2.0, LP.z + R * Math.sin(a)), toP = v3(-Math.cos(a), 0, -Math.sin(a));
    return { pos, q: qmul(faceQ(toP), qmul(rollQ(P), qmul(pitchQ(-pitchDeg * D), rollQ((wob || 0) * D * Math.sin(t * 6))))) }; } }; }
for (const pd of [40, 55, 65]) run(`trippy spin x2 (inverted, nose up the pole ${pd})`, lookUp(pd, 0), ['Trippy Spin']);
run('trippy spin x2 (nose up 60, wobbling 15)', lookUp(60, 15), ['Trippy Spin']);
run('trippy spin x2 (leaning 65, wobbling)', (() => { const o = orbit(2.1, 65, 0); return { T: o.T, at: t => { const s = o.at(t); return { pos: s.pos, q: qmul(s.q, rollQ(14 * D * Math.sin(t * 7))) }; } }; })(), ['Trippy Spin']);
// the owner's Double Rolling Trippies (2026-11-25, his video and a labelled run): about 3 rolls per lap round the pole, never coming
// upright on purpose; one barrel roll a lap is no more roll than a plain trippy has, so it is not one
run('double rolling trippy (3 rolls per lap)', orbit(2.1, 0, 3), ['Double Rolling Trippy Spin']);
run('one barrel roll a lap round a pole is not a double rolling trippy', orbit(2.1, 0, 1), [], ['Double Rolling Trippy Spin']);
// a trippy that turns into a double rolling one, as the owner flew it: 1.3 laps of plain trippy (leaning 25), then the rolling: the
// trippy is banked with its laps and the rolling called on its own
run('trippy, then double rolling', (() => { const w = 170 * D, a1 = 1.3 * 2 * P, T1 = a1 / w, T = T1 + 1.2 * 2 * P / w, R = 1.6;
  return { T: T + 1.5, at: t => { const a = Math.min(t, T) * w, pos = v3(LP.x + R * Math.cos(a), 2.4, LP.z + R * Math.sin(a)), face = faceQ(v3(-Math.cos(a), 0, -Math.sin(a)));
    return { pos, q: qmul(face, rollQ(P - 25 * D + (a > a1 ? 3 * (a - a1) : 0))) }; } }; })(), ['Trippy Spin', 'Double Rolling Trippy Spin']);
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
    line(v3(c.x, botY, c.z), mul(h, -3), 1.6, qmul(face, qmul(R1, pitchQ(P)))), hold(add(v3(c.x, botY, c.z), mul(h, -4.8)), qmul(face, qmul(R1, pitchQ(P))), 1.2)]), ['Split S']);
  void F; void base;
}

// 6. trippies round the 9 m flagpole (0, -14.5): wider radius, higher up, looking up the pole
const FP = v3(0, 0, -14.5);
function flagTrippy(R, y, pitchDeg, rate) { const w = rate * D, T = 2.1 * 2 * P / w;
  return { T: T + 1.5, at: t => { const a = Math.min(t, T) * w, pos = v3(FP.x + R * Math.cos(a), y, FP.z + R * Math.sin(a)), toP = v3(-Math.cos(a), 0, -Math.sin(a));
    return { pos, q: qmul(faceQ(toP), qmul(rollQ(P), pitchQ(-pitchDeg * D))) }; } }; }
run('flagpole trippy (r 2.0 m, 3 m up, 150/s)', flagTrippy(2.0, 3, 45, 150), ['Trippy Spin']);
run('flagpole trippy (r 3.5 m, 5 m up, 110/s)', flagTrippy(3.5, 5, 50, 110), ['Trippy Spin']);
run('flagpole trippy (r 5.0 m, 6 m up, 80/s)', flagTrippy(5.0, 6, 55, 80), ['Trippy Spin']);
run('flagpole trippy (r 1.5 m, 8 m up, 200/s)', flagTrippy(1.5, 8, 30, 200), ['Trippy Spin']);
// 6b. flagpole trippies as they're really flown (pilot: still not detected): slow wide laps (30-60 deg/s, uneven, with
// near-stops), rolled just past knife-edge with the belly away from the pole rather than fully inverted, flying along the
// circle, sinking down the pole or watching its top from low down
function flagReal(R, y0, sink, rate, rollDeg, uneven, laps = 2.1) { const w = rate * D, ang = t => w * (t + uneven * Math.sin(t * 1.3) / 1.3), T = laps * 2 * P / w;
  return { T: T + 1.5, at: t => { const tt = Math.min(t, T), a = ang(tt), pos = v3(FP.x + R * Math.cos(a), Math.max(0.6, y0 - sink * tt), FP.z + R * Math.sin(a));
    const toP = v3(-Math.cos(a), 0, -Math.sin(a)), tang = v3(-Math.sin(a), 0, Math.cos(a)), f = faceQ(tang);
    const sg = S.qrot(qmul(f, rollQ(90 * D)), v3(0, 1, 0)), sgn = sg.x * toP.x + sg.z * toP.z > 0 ? 1 : -1;
    return { pos, q: qmul(f, rollQ(sgn * rollDeg * D)) }; } }; }
run('flagpole trippy, real: r 3 m, 45/s, knife-edge+10, sinking', flagReal(3, 7, 0.25, 45, 100, 0), ['Trippy Spin']);
run('flagpole trippy, real: r 4.5 m, 35/s, uneven speed', flagReal(4.5, 4, 0.05, 35, 105, 0.7), ['Trippy Spin']);
run('flagpole trippy, real: r 2 m low, 70/s, watching the top', flagReal(2, 1.5, 0, 70, 95, 0.3), ['Trippy Spin']);
run('flagpole trippy, real: r 6 m, 30/s', flagReal(6, 5, 0.1, 30, 110, 0.4), ['Trippy Spin']);
run('banked lap round the flagpole (upright, not a trippy)', flagReal(3, 3, 0, 90, 50, 0), []);
// 6d. trippy entries, exits, size and shape (pilot): an upright lap in before rolling into it, flying well away upright
// afterwards while still near the pole, big and egg-shaped/uneven orbits (those score SLOPPY), and a flip straight into one
function trip(o) { const { R = 3, y = 4, rate = 60, laps = 2.1, pre = 0, post = 0, ecc = 0, wig = 0, flip = 0, c = FP } = o, w = rate * D;
  const Tf = flip ? 360 / flip : 0, Tpre = pre * 2 * P / w, Ttr = laps * 2 * P / w, Tpost = post * 2 * P / w, T = Tf + Tpre + Ttr + Tpost;
  const sgn = (f, toP) => { const sg = S.qrot(qmul(f, rollQ(90 * D)), v3(0, 1, 0)); return sg.x * toP.x + sg.z * toP.z > 0 ? 1 : -1; };
  return { T: T + 1.5, at: t => { const tt = Math.min(t, T), u = Math.max(0, tt - Tf), a = w * (u + wig * Math.sin(u * 1.7) / 1.7), r = R * (1 + ecc * Math.cos(2 * a)) ;
    const pos = v3(c.x + r * Math.cos(a), y, c.z + r * Math.sin(a)), toP = v3(-Math.cos(a), 0, -Math.sin(a)), tang = v3(-Math.sin(a), 0, Math.cos(a)), f = faceQ(tang), sg = sgn(f, toP);
    if (tt < Tf) return { pos, q: qmul(f, pitchQ(2 * P * tt / Tf)) };                                   // a flip on the way in
    const inPose = u >= Tpre && u <= Tpre + Ttr, k = inPose ? Math.min(1, (u - Tpre) / 0.3, (Tpre + Ttr - u) / 0.3 + 0.001) : 0;   // roll in / out over 0.3 s
    return { pos, q: qmul(f, rollQ(sg * (25 + 80 * k) * D)) }; } }; }
const names = ev => ev.map(e => e.name + (e.exec === 'SLOPPY' ? ' (sloppy)' : ''));
function runX(name, path, want) { const ev = M.detect(path, W, 30), got = names(ev), ok = JSON.stringify(got) === JSON.stringify(want); total++; if (ok) pass++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(46)} -> ${got.join(' | ') || 'nothing'}${ok ? '' : '   want ' + want.join(' | ')}`); }
runX('trippy: upright 3/4 lap in, 2 laps, upright 3/4 lap out', trip({ pre: 0.75, post: 0.75 }), ['Trippy Spin']);
runX('trippy: big 6.3 m orbit of the flagpole, drifting out to 6.9', trip({ R: 6.3, rate: 35, y: 5, ecc: 0.09 }), ['Trippy Spin']);
runX('trippy: egg-shaped orbit, uneven speed (sloppy)', trip({ R: 3.5, ecc: 0.4, wig: 0.6 }), ['Trippy Spin (sloppy)']);
runX('flip straight into a trippy (combo)', trip({ flip: 520, R: 2.5, rate: 80, y: 5 }), ['Flip', 'Trippy Spin']);
runX('one upright lap, half a lap rolled over (no trippy)', trip({ pre: 1.0, laps: 0.5, post: 0.6 }), []);
// 6e. pilot: Matty flips inside combos were called Beginner Matty (the flip slow and broken up mid-way, no big pitch token)
{ const m0 = M.make('Matty Flip', W, 5100002, { tilt: 30 }), a = 1.1, b = 2.2, k = 0.35, ext = (b - a) * (1 / k - 1), warp = t => t < a ? t : t < a + (b - a) / k ? a + (t - a) * k : t - ext;
  run('matty flip, flip slow and broken up mid-way (not a beginner matty)', { T: m0.T + ext, at: t => m0.at(warp(t)) }, ['Matty Flip']); }
// 6f. pilot: ordinary movement round a pole was called a Whiplash
runX('banked half lap past a lamp post, flying on (no whiplash)', trip({ pre: 0.5, laps: 0, c: LP, R: 1.5, rate: 120, y: 2 }), []);
runX('banked 3/4 lap round the flagpole, flying on (no whiplash)', trip({ pre: 0.75, laps: 0, R: 2, rate: 90, y: 2.5 }), []);
// 6g. pilot: a powerloop round the covered walkway was called Beginner Matty. Arriving OVER the object first and then
// looping it gives over-under-over passes mid-loop; that is only a Beginner Matty if the pass under is flown backward, upright
for (const obj of ['Covered Walkway', 'Swing Set']) { const m = M.make('Powerloop', W, 77, { object: obj, tilt: 30 }), s0 = m.at(0), s1 = m.at(0.5), hv = S.mul(S.sub(s1.pos, s0.pos), 2), far = add(s0.pos, mul(hv, 2.2)), Tp = 1.6, Td = 0.6;
  const hi = y => v3(0, 4.6 - y, 0);
  run(`fly over the ${obj}, then powerloop it (not a beginner matty)`, { T: m.T + Tp + Td, at: t => t < Tp ? { pos: add(add(far, mul(S.sub(s0.pos, far), t / Tp)), hi(far.y)), q: s0.q } : t < Tp + Td ? { pos: add(s0.pos, mul(hi(s0.pos.y), 1 - (t - Tp) / Td)), q: s0.q } : m.at(t - Tp - Td) }, ['Powerloop']); }
// 6c. jump ropes only on real over/under bars (pilot: they triggered on other objects): sideways over a bench and back,
// and sideways over the swing bar twice (no pass under), are not jump ropes
{ const side = (x0, z0, y, dz, T) => at([{ T, f: t => ({ pos: v3(x0, y, z0 + dz * Math.cos(2 * Math.PI * t / T)), q: faceQ(v3(1, 0, 0)) }) }, hold(v3(x0, y, z0 + dz), faceQ(v3(1, 0, 0)), 1.5)]);
  run('sideways over a bench and back (not a jump rope)', side(-3, 9, 1.0, 1.5, 3.0), []);
  run('sideways over the swing bar twice, never under (not a jump rope)', side(0, -6, 3.0, 1.5, 3.0), []); }
// 7. half matty at the pilot's rates: toward the swing bar, roll ~160-180 (optionally a short stall), then the second half
// of a Matty (pitch ~150-200, the end floaty), passing under the bar flying backward
function halfMatty(rollDeg, stall, pitchDeg, slowTail) {
  // approach in front of the bar (never over it), roll inverted, then swoop down and under it: the path keeps going
  // forward while the second half of a Matty swings the nose round, so it passes under flying backward
  const h = v3(0, 0, -1), face = faceQ(h), y0 = 3.0, y1 = 1.25, z0 = -2.6, L = 4.4, rT = rollDeg / 330, inv = qmul(face, rollQ(rollDeg * D));
  const fast = pitchDeg - slowTail, T1 = fast / 300, T2 = slowTail / 70, Tt = Math.max(1.1, T1 + T2);
  const ang = t => t < T1 ? fast * t / T1 : Math.min(pitchDeg, fast + slowTail * (t - T1) / Math.max(T2, 1e-3));
  const sc = u => v3(0, y0 - (y0 - y1) * (0.5 - 0.5 * Math.cos(P * Math.min(1, u * 1.35))), z0 - L * u);
  return at([line(v3(0, y0, z0 + 3.0), v3(0, 0, -2.6), 0.75, face),
    { T: rT, f: t => ({ pos: v3(0, y0, z0 + 3.0 - 1.95 - 1.05 * t / rT), q: qmul(face, rollQ(rollDeg * D * t / rT)) }) },
    hold(v3(0, y0, z0), inv, stall),
    { T: Tt, f: t => ({ pos: sc(t / Tt), q: qmul(inv, pitchQ(ang(t) * D)) }) },
    line(sc(1), v3(0, 0, -2.5), 1.2, qmul(inv, pitchQ(pitchDeg * D))), hold(add(sc(1), v3(0, 0, -3)), qmul(inv, pitchQ(pitchDeg * D)), 1.4)]);
}
run('half matty (roll 180, pitch 180)', halfMatty(180, 0.01, 180, 0), ['Half Matty']);
run('half matty (roll 160, 0.5 s stall, pitch 170)', halfMatty(160, 0.5, 170, 0), ['Half Matty']);
run('half matty (roll 170, pitch 200 floaty end)', halfMatty(170, 0.2, 200, 60), ['Half Matty']);
run('half matty (roll 150, pitch 140 floaty end)', halfMatty(150, 0.3, 140, 50), ['Half Matty']);
// 8. open-air loops (no object): a powerloop is a backflip whose path loops round; a Matty ends flying backward
function openLoop(dir, R, rate, ends) {
  const C = v3(-2, 5.5, 8), h = v3(0, 0, -1), face = faceQ(h), at_ = th => add(C, add(mul(h, R * Math.sin(th)), v3(0, -R * Math.cos(th), 0)));
  const T = 360 / rate;
  if (dir > 0) return at([line(add(at_(0), mul(h, -3)), mul(h, 3), 1.0, face), { T, f: t => ({ pos: at_(2 * P * t / T), q: qmul(face, pitchQ(2 * P * t / T)) }) }, line(at_(2 * P), mul(h, 3), 1.6, face)]);
  // open-air Matty: forward and up, front flip, fall back and fly backward (path forward -> down -> backward)
  const m = ph => add(C, add(mul(h, -R * Math.sin(ph)), v3(0, -R * Math.cos(ph), 0)));
  return at([line(add(m(P), mul(h, -3)), mul(h, 3), 1.0, face), { T, f: t => ({ pos: m(P + P * t / T), q: qmul(face, pitchQ(-2 * P * t / T)) }) },
    line(m(2 * P), mul(h, -3), 1.0, qmul(face, pitchQ(-2 * P))), hold(add(m(2 * P), mul(h, -3)), face, 1.4)]);
}
run('open-air powerloop (r 1.5 m, 300/s)', openLoop(1, 1.5, 300), ['Powerloop']);
run('open-air powerloop (r 2.2 m, 250/s)', openLoop(1, 2.2, 250), ['Powerloop']);
run('open-air matty (r 1.4 m, 280/s)', openLoop(-1, 1.4, 280), ['Matty Flip']);
run('flip in place is still a flip', at([hold(v3(-2, 5.5, 8), H.ID, 0.6), { T: 360 / 500, f: t => ({ pos: v3(-2, 5.5, 8), q: pitchQ(2 * P * t / (360 / 500)) }) }, hold(v3(-2, 5.5, 8), H.ID, 1.6)]), ['Flip']);
// Pilot (2026-11-17): cradles were being detected as orbits. Flying past a pole and back down its other side, watching
// it, sweeps the same way round it for most of a lap, but the path is a hairpin, not a circle: no Orbit.
function uPass(P, off, far) { const vOut = 3, vBack = 2, y = Math.min(P.y1 - 0.5, 2.2), r = off, cx = P.x + 1.6, L1 = far + 1.6, T1 = L1 / vOut, T2 = Math.PI * r / vBack, T3 = L1 / vBack;
  const pos = t => t < T1 ? v3(P.x - far + vOut * t, y, P.z + off) : t < T1 + T2 ? (() => { const a = Math.PI / 2 - Math.PI * (t - T1) / T2; return v3(cx + r * Math.cos(a), y, P.z + r * Math.sin(a)); })() : v3(cx - vBack * (t - T1 - T2), y, P.z - off);
  return { T: T1 + T2 + T3 + 1, at: t => { const p = pos(Math.min(t, T1 + T2 + T3)); return { pos: p, q: faceQ(S.norm(v3(P.x - p.x, 0, P.z - p.z))) }; } }; }
{ const poles = new S.TrickDetector(W).poles;
  for (const nm of ['Flagpole', 'Lamp Post', 'the pilot']) { const Pl = poles.find(p => p.name === nm);
    for (const [off, far] of [[0.8, 5], [1.2, 5], [1.0, 8]]) { const got = M.detect(uPass(Pl, off, far), W, 30).map(e => e.name), ok = !got.includes('Orbits'); total++; if (ok) pass++;
      console.log(`${ok ? '✓' : '✗'} ${`past the ${nm} and back down the other side (${off} m, ${far} m)`.padEnd(46)} -> ${got.join(' | ') || 'nothing'}${ok ? '' : '   want no Orbit'}`); } } }
// Pilot (2026-11-17): inverted yaw spins need to work at other camera angles. With a steep camera the half roll in
// carries a nose-down tip (and the half flip in stops short of 180); the spin may be about the world vertical (A) or the
// quad's own yaw axis (C); and it is never a plain Yaw Spin. Each is flown with the detector set to that camera tilt.
function iys(o) { const { style = 'A', tilt = 30, bodyOff = 0, entry = 'roll', exit = entry, rate = 400, spin = 360, pause = 0, entryDeg = 180, wob = 0, half = 360 } = o;
  const p0 = v3(0, 6, 1), bt = style === 'B' ? 0 : tilt + bodyOff, rT = entryDeg / half, sT = spin / rate, sg = entry === 'roll' ? 1 : -1;
  const hq = (ax, deg) => ax === 'roll' ? rollQ(deg * D) : pitchQ(deg * D);
  const inv = qmul(hq(entry, entryDeg), pitchQ(-bt * D * sg));
  const w = t => wob ? qmul(rollQ(wob * D * Math.sin(t * 7)), pitchQ(wob * D * Math.sin(t * 5.3 + 1))) : H.ID;
  const spinQ = a => style === 'C' ? qmul(inv, yawQ(a)) : qmul(qaxis(v3(0, 1, 0), a), inv);
  const end = spinQ(spin * D), outDeg = 360 - entryDeg;
  const segs = [hold(p0, H.ID, 0.6), { T: rT, f: t => ({ pos: p0, q: qmul(hq(entry, entryDeg * t / rT), pitchQ(-bt * D * (t / rT) * sg)) }) }];
  if (pause) segs.push(hold(p0, inv, pause));
  segs.push({ T: sT, f: t => ({ pos: p0, q: qmul(spinQ(spin * D * t / sT), w(t)) }) });
  if (pause) segs.push(hold(p0, end, pause));
  const oT = (exit === entry ? outDeg : 180) / half;
  segs.push({ T: oT, f: t => ({ pos: p0, q: qmul(end, qmul(pitchQ(bt * D * (t / oT) * sg), hq(exit, (exit === entry ? outDeg : 180) * t / oT))) }) });
  segs.push(hold(p0, qmul(end, qmul(pitchQ(bt * D * sg), hq(exit, exit === entry ? outDeg : 180))), 1.6));
  return at(segs); }
for (const c of [{ style: 'A', tilt: 50, entry: 'flip' }, { style: 'C', tilt: 50, entry: 'flip', rate: 500 }, { style: 'A', tilt: 45, bodyOff: 15 }, { style: 'C', tilt: 45, bodyOff: 15 },
  { style: 'C', tilt: 30, wob: 12 }, { style: 'C', tilt: 45, wob: 12 }, { style: 'A', tilt: 40, spin: 330 }, { style: 'A', tilt: 10, entry: 'roll', exit: 'flip' }, { style: 'B', tilt: 40, rate: 220 }]) {
  const got = M.detect(iys(c), W, c.tilt).map(e => e.name), ok = JSON.stringify(got) === '["Inverted Yaw Spin"]'; total++; if (ok) pass++;
  console.log(`${ok ? '✓' : '✗'} ${('inverted yaw spin ' + JSON.stringify(c).replace(/"/g, '')).padEnd(46)} -> ${got.join(' | ') || 'nothing'}${ok ? '' : '   want Inverted Yaw Spin'}`); }
// 2026-11-17, pilot: "open air trippies and powerloops aren't being counted". A trippy with nothing in the middle (high over
// the playground, well clear of every pole), a wide one, one that drifts; an upright circle in open air stays a turn.
const AIR = v3(4, 0, 4);
run('open-air trippy spin (nothing in the middle)', orbit(2.2, 45, 0, AIR, 1.6, 11), ['Trippy Spin']);
run('open-air trippy spin, wide (R 2.8)', orbit(2.2, 35, 0, AIR, 2.8, 12), ['Trippy Spin']);
run('open-air trippy spin, drifting 0.4 m/s', orbit(2.3, 45, 0, AIR, 1.5, 11, 0.4), ['Trippy Spin']);
run('upright circle in open air is just a turn', { T: 6, at: t => { const a = Math.min(t, 4.4) * 170 * D, pos = v3(4 + 1.6 * Math.cos(a), 11, 4 + 1.6 * Math.sin(a)); return { pos, q: qmul(faceQ(v3(-Math.cos(a), 0, -Math.sin(a))), rollQ(0.4)) }; } }, []);
// open powerloops: in clear air, and in clear air but passing over something low on the way (the Surveyor finds an
// over/under nearly everywhere on the school map; only a loop that really goes round the object belongs to it)
function clearLoop(c, R = 1.3, v = 5.5) { const L = 2 * P * R / v, T0 = 0.7; return { T: T0 + L + 1.6, at: t => { if (t < T0) return { pos: v3(c.x, c.y - R, c.z + (T0 - t) * v), q: H.ID }; const th = Math.min(t - T0, L) * v / R, after = Math.max(0, t - T0 - L);
  return { pos: v3(c.x, c.y - R * Math.cos(th), c.z - R * Math.sin(th) - after * v), q: pitchQ(th) }; } }; }
run('open powerloop in clear air', clearLoop(v3(6, 9, 6)), ['Powerloop']);
run('open powerloop, big and floaty (R 2.2)', clearLoop(v3(6, 10, 6), 2.2, 5), ['Powerloop']);
run('open powerloop above the swing bar (over it, never under)', clearLoop(v3(0, 4.6, -6), 1.2, 5.5), ['Powerloop']);
// 2026-11-17, pilot: open powerloops flown back to back were not counted (the turns added up to something that matched
// nothing). The loop monitor judges every full turn as it completes; a loop with a hard change of motion in it is not one.
function manyLoops(c, laps, R = 1.6, v = 7, jolt = 0) { const L = 2 * P * R / v, T0 = 0.7; return { T: T0 + L * laps + 1.6, at: t => { if (t < T0) return { pos: v3(c.x, c.y - R, c.z + (T0 - t) * v), q: H.ID }; const tt = Math.min(t - T0, L * laps), th = tt * v / R, after = Math.max(0, t - T0 - L * laps);
  const tk = P * 0.9 * R / v, kick = jolt && tt > tk ? jolt * (tt - tk) : 0;   // knocked sideways part-way round: from then on it is moving a different way
  return { pos: v3(c.x + kick, c.y - R * Math.cos(th), c.z - R * Math.sin(th) - after * v), q: pitchQ(th) }; } }; }
run('two open powerloops back to back', manyLoops(v3(6, 10, 6), 2), ['Powerloop', 'Powerloop']);
run('three open powerloops back to back', manyLoops(v3(6, 10, 6), 3), ['Powerloop', 'Powerloop', 'Powerloop']);
{ const ev = M.detect(manyLoops(v3(6, 10, 6), 1, 1.6, 7, 9), W, 30).map(e => e.name); total++; const ok = !ev.includes('Powerloop'); if (ok) pass++; console.log(`${ok ? '✓' : '✗'} ${'a loop with a hard jolt in the middle is not a clean loop'.padEnd(46)} -> ${ev.join(' | ') || 'nothing'}`); }
// 2026-11-17, pilot: "dive is for sure over called. A dive in an open area should be from high up; otherwise it should be
// against a structure: almost a wall ride, but not quite, just a diving motion."
function descend(from, to, nose, vz = 2) { const T0 = 0.6, drop = from.y - to, Td = drop / 9, Tl = 0.35; return { T: T0 + Td + Tl + 1.6, at: t => {
  if (t < T0) return { pos: v3(from.x, from.y, from.z + (T0 - t) * 3), q: H.ID };
  const u = t - T0; if (u < Td) { const k = Math.min(1, u / 0.25); return { pos: v3(from.x, from.y - 9 * u * (u < 0.25 ? u / 0.25 : 1), from.z - vz * u), q: pitchQ(-nose * D * k) }; }
  const w = u - Td, k = Math.max(0, 1 - w / Tl); return { pos: v3(from.x, to, from.z - vz * Td - 4 * w), q: pitchQ(-nose * D * k) }; } }; }
run('dive down the face of the Brick Building (from 13 m, 1.5 m off the wall)', descend(v3(5, 13, -20.5), 2, 60, 0), ['Building Dive']);
run('open-air dive from really high up (16 m)', descend(v3(8, 16, 6), 2, 65), ['Building Dive']);
run('coming down from 9 m in the open is not a dive (not high enough, nothing beside it)', descend(v3(8, 9, 6), 2, 60), []);
run('sinking from 16 m with the nose level is not a dive (no dive attitude)', descend(v3(8, 16, 6), 2, 5), []);
console.log(`\n${pass}/${total} pilot-feedback flights`);
