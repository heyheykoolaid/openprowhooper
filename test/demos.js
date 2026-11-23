// Powerloop-family flights shaped and timed like the prowhooper.com demo GIFs (docs/tricktionary-reference.md):
// floaty loops that slow right down over the top, extra rotations at the peak, and the "level out, hover, then
// rewind" structure of Power Switch / Power Split. Obstacle: the swing-set top bar (z = -6, under < 2.32, over > 2.46).
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim; const world = S.buildPlayground();
const X = S.v3(1, 0, 0), FWD_ROLL = S.v3(0, 0, -1);
const D = Math.PI / 180;
const pitchQ = th => S.qaxis(X, th);
const C = { y: 2.4, z: -6 }, RZ = 1.8, RY = 1.2;           // loop ellipse around the bar
const ell = th => S.v3(0, C.y - RY * Math.cos(th), C.z - RZ * Math.sin(th));

// time table for a loop arc whose pitch rate eases off over the top (wmin at th = π, wmax at the bottom)
function sweep(th0, th1, wmin, wmax) {
  const tab = [[0, th0]]; let th = th0, t = 0; const dt = 0.002, s = Math.sign(th1 - th0);
  while (s * (th1 - th) > 0) { const w = (wmin + (wmax - wmin) * (1 + Math.cos(th)) / 2) * D; th += s * w * dt; t += dt; tab.push([t, s > 0 ? Math.min(th, th1) : Math.max(th, th1)]); }
  return { T: t, at: u => { const i = Math.min(tab.length - 1, Math.floor(u / dt)); return tab[i][1]; } };
}
// segment builders: each returns { T, f(t) -> { pos, q } }
const straight = (p0, v, T, q) => ({ T, f: t => ({ pos: S.add(p0, S.mul(v, t)), q }) });
const arc = (th0, th1, wmin, wmax, post = () => ({ w: 1, x: 0, y: 0, z: 0 })) => { const s = sweep(th0, th1, wmin, wmax); return { T: s.T, f: t => { const th = s.at(t); return { pos: ell(th), q: S.qmul(pitchQ(th), post(th)) }; } }; };
// extra body rotation at a fixed loop angle while drifting slowly along the loop
const atPeak = (th, axis, deg, rate) => { const T = Math.abs(deg) / rate; return { T, f: t => ({ pos: ell(th + 0.25 * t / T), q: S.qmul(pitchQ(th + 0.25 * t / T), S.qaxis(axis, Math.sign(deg) * rate * D * t)) }) }; };
function chain(segs) {
  return t => { for (const s of segs) { if (t < s.T) return s.f(t); t -= s.T; } const l = segs[segs.length - 1]; return l.f(l.T); };
}
function bodyRate(q0, q1, dt) {
  let { w, x, y, z } = S.qmul({ w: q0.w, x: -q0.x, y: -q0.y, z: -q0.z }, q1); if (w < 0) { w = -w; x = -x; y = -y; z = -z; }
  const s = Math.hypot(x, y, z); if (s < 1e-9) return S.v3(); const ang = 2 * Math.atan2(s, w) / dt; return S.v3(x / s * ang, y / s * ang, z / s * ang);
}
let pass = 0, total = 0;
function run(name, gen, T, want) {
  const det = new S.TrickDetector(world), sk = new S.ScoreKeeper();
  const d = Object.create(S.Drone.prototype); Object.assign(d, { pos: S.v3(), vel: S.v3(), q: { w: 1, x: 0, y: 0, z: 0 }, w: S.v3(), armed: true, crashed: false, contactThisStep: false });
  const dt = 0.002; let prev = gen(0);
  for (let t = dt; t < T; t += dt) { const s = gen(t); d.vel = S.mul(S.sub(s.pos, prev.pos), 1 / dt); d.pos = s.pos; d.w = bodyRate(prev.q, s.q, dt); d.q = s.q; prev = s; det.update(d, dt); }
  const ev = det.drain(); const got = ev.map(e => e.name);
  if (process.env.DBG && name.includes(process.env.DBG)) { console.log('cross', det.crossLog.map(c => c.kind + (c.back ? 'b' : '') + '@' + c.t.toFixed(2) + (c.used ? '*' : '')).join(' ')); console.log('toks', det.toks.map(k => k.ax + (k.dir > 0 ? '+' : '-') + Math.round(k.raw) + '@' + k.t0.toFixed(2) + '-' + k.t1.toFixed(2)).join(' ')); console.log('norm', det.normalized().map(k => k.ax + (k.dir > 0 ? '+' : '-') + Math.round(k.raw)).join(' ')); }
  const ok = JSON.stringify(got) === JSON.stringify(want); total++; if (ok) pass++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(34)} -> ${ev.map(e => { const r = sk.add(e); return `${e.name} [${e.exec}${e.draft ? ' draft' : ''}] toks:${(e.toks || []).map(t => t.ax + (t.dir > 0 ? '+' : '-') + Math.round(t.raw)).join(' ')}`; }).join(' | ') || 'nothing'}${ok ? '' : '   (want ' + want.join(', ') + ')'}`);
}
const approach = straight(S.v3(0, C.y - RY, -2), S.v3(0, 0, -4), 1.0, { w: 1, x: 0, y: 0, z: 0 });   // under the bar at th = 0
const exitFwd = (T = 0.8) => straight(ell(2 * Math.PI), S.v3(0, 0, -4), T, { w: 1, x: 0, y: 0, z: 0 });
const tail = { T: 1.5, f: () => ({ pos: S.v3(0, 1.2, -10), q: { w: 1, x: 0, y: 0, z: 0 } }) };
const hoverAt = (p, q, T) => ({ T, f: () => ({ pos: p, q }) });

// Powerloop, floaty: ~300°/s at the bottom easing to 70°/s over the top (below the 95°/s token threshold)
run('demo powerloop (floaty top)', chain([approach, arc(0, 2 * Math.PI, 70, 300), exitFwd(), tail]), 9, ['Powerloop']);
// Power Flip demo: slow loop (≈4 s), backflip at the peak
run('demo power flip', chain([approach, arc(0, Math.PI, 110, 260), atPeak(Math.PI, X, 360, 700), arc(Math.PI + 0.25, 2 * Math.PI, 110, 260), exitFwd(), tail]), 10, ['Power Flip']);
// Reversed Power Flip demo: front flip at the peak
run('demo reversed power flip', chain([approach, arc(0, Math.PI, 110, 260), atPeak(Math.PI, X, -360, 650), arc(Math.PI + 0.25, 2 * Math.PI, 110, 260), exitFwd(), tail]), 10, ['Reversed Power Flip']);
// Power Roll demo: half loop 0.72 s, roll 360 at ~550°/s, rest of the loop
run('demo power roll', chain([approach, arc(0, Math.PI, 150, 330), atPeak(Math.PI, FWD_ROLL, 360, 550), arc(Math.PI + 0.25, 2 * Math.PI, 150, 330), exitFwd(), tail]), 10, ['Power Roll']);
// Immelmann demo: half loop (~0.6 s), roll 180 at the top (~0.4 s), fly away level over the top
{ const top = ell(Math.PI); const inv = pitchQ(Math.PI);
  run('demo immelmann', chain([approach, arc(0, Math.PI, 200, 380),
    { T: 0.4, f: t => ({ pos: S.add(top, S.v3(0, 0, 3 * t)), q: S.qmul(inv, S.qaxis(FWD_ROLL, Math.PI * t / 0.4)) }) },
    straight(S.add(top, S.v3(0, 0, 1.2)), S.v3(0, 0, 3), 1.5, S.qmul(inv, S.qaxis(FWD_ROLL, Math.PI)))]), 8, ['Immelmann']); }

// Power Switch / Power Split demos: the loop comes all the way round to level on the start side WITHOUT passing
// back under, hovers (≈0.7 s / ≈1.3 s in the demos), then rewinds back over the bar and under it.
const LO = 2 * Math.PI - 0.5;                                    // loop ends nose-down on the start side, then levels out
const levelOut = { T: 0.3, f: t => { const u = t / 0.3; return { pos: S.add(ell(LO), S.v3(0, 0.05 * u, 0.25 * u)), q: pitchQ(LO + 0.5 * u) }; } };
const hoverP = S.add(ell(LO), S.v3(0, 0.05, 0.25)), level = { w: 1, x: 0, y: 0, z: 0 };
// Matty rewind: up on the start side, over the bar moving -z with a front flip, down the far side, backward under (+z)
const PH0 = Math.asin((hoverP.z - C.z) / RZ);
const mattyPos = ph => S.v3(0, C.y - RY * Math.cos(ph), C.z + RZ * Math.sin(ph));
const matty = (() => { const T = 2.0; return { T, f: t => { const u = t / T, ph = PH0 + (2 * Math.PI - PH0) * u; const p = mattyPos(ph); const blend = Math.min(1, t / 0.15);
  return { pos: S.add(S.mul(hoverP, 1 - blend), S.mul(p, blend)), q: pitchQ(-2 * Math.PI * u) }; } }; })();
const backOut = straight(mattyPos(2 * Math.PI), S.v3(0, 0, 3), 1.2, level);
run('demo power switch (hover 0.7 s)', chain([approach, arc(0, LO, 120, 300), levelOut, hoverAt(hoverP, level, 0.7), matty, backOut, tail]), 12, ['Power Switch']);
// Split-S rewind: climb over the bar moving -z, roll 180, pitch back half-loop down the far side, forward under (+z)
const overP = S.v3(0, 3.3, -6.6);
const splitS = [
  { T: 0.5, f: t => ({ pos: S.add(hoverP, S.mul(S.sub(overP, hoverP), t / 0.5)), q: level }) },
  { T: 0.3, f: t => ({ pos: S.add(overP, S.v3(0, 0, -1.2 * t)), q: S.qaxis(FWD_ROLL, Math.PI * t / 0.3) }) },
  (() => { const c = S.v3(0, 2.3, -6.96), T = 0.9; return { T, f: t => { const ps = Math.PI * t / T; return { pos: S.v3(0, c.y + Math.cos(ps), c.z - Math.sin(ps)), q: S.qmul(S.qaxis(FWD_ROLL, Math.PI), pitchQ(ps)) }; } }; })(),
];
const fwdOutPlusZ = straight(S.v3(0, 1.3, -6.96), S.v3(0, 0, 3), 1.2, S.qmul(S.qaxis(FWD_ROLL, Math.PI), pitchQ(Math.PI)));
run('demo power split (hover 1.3 s)', chain([approach, arc(0, LO, 120, 300), levelOut, hoverAt(hoverP, level, 1.3), ...splitS, fwdOutPlusZ]), 10, ['Power Split']);

// ---- batch 4 ----
// arc with an arbitrary pitch-rate profile wfn(th) in deg/s
function arcF(th0, th1, wfn, post = () => ({ w: 1, x: 0, y: 0, z: 0 })) {
  const tab = [[0, th0]]; let th = th0, t = 0; const dt = 0.002;
  while (th < th1) { th = Math.min(th1, th + wfn(th) * D * dt); t += dt; tab.push([t, th]); }
  return { T: t, f: tt => { const th = tab[Math.min(tab.length - 1, Math.floor(tt / dt))][1]; return { pos: ell(th), q: S.qmul(pitchQ(th), post(th)) }; } };
}
// Powerloop round a tall statue (full-size Powerloop demo): fast pull-up, slow float up, quick over the top,
// then a long nose-down hang at ~45°/s, level-out at ~110°/s. Mostly under the 95°/s token threshold.
const P = Math.PI;
const statue = th => th < P / 2 ? 220 : th < P ? 60 : th < 1.3 * P ? 200 : th < 1.85 * P ? 45 : 110;
run('demo powerloop (statue, slow hang)', chain([approach, arcF(0, 2 * P, statue), exitFwd(), tail]), 10, ['Powerloop']);
// Inverted 360 Powerloop demo: inverted yaw 360 at the peak (~0.7 s)
const YAW = S.v3(0, -1, 0);
run('demo inverted 360 powerloop', chain([approach, arc(0, P, 110, 260), atPeak(P, YAW, 360, 520), arc(P + 0.25, 2 * P, 110, 260, () => S.qaxis(YAW, 2 * P)), exitFwd(), tail]), 10, ['Inverted 360 Powerloop']);
// Barani demo: half loop, inverted yaw 180 at the peak (~0.5 s), then a Matty (pitch forward) backward under the bar
{ const yawTop = { T: 0.5, f: t => ({ pos: ell(P + 0.1 * t / 0.5), q: S.qmul(pitchQ(P + 0.1 * t / 0.5), S.qaxis(YAW, P * t / 0.5)) }) };
  const s2 = sweep(P + 0.1, 2 * P, 110, 260);
  const mattyDown = { T: s2.T, f: t => { const th = s2.at(t); const u = (th - P - 0.1) / (P - 0.1); return { pos: ell(th), q: S.qmul(S.qmul(pitchQ(P + 0.1), S.qaxis(YAW, P)), pitchQ(-P * u)) }; } };
  const qEnd = S.qmul(S.qmul(pitchQ(P + 0.1), S.qaxis(YAW, P)), pitchQ(-P));
  run('demo barani', chain([approach, arc(0, P, 110, 260), yawTop, mattyDown, straight(ell(2 * P), S.v3(0, 0, -3), 1.0, qEnd)]), 8, ['Barani']); }
// Maverick-style loop: stays upright and forward-looking (nose up climbing, level over the top moving backward,
// nose down descending); Mavvy Roll adds a slow 360 roll at the peak (demo: ~1.1 s)
const mavAtt = th => pitchQ(-th + 1.4 * Math.sin(th));            // cancels the loop's pitch, leaving a ±80° nod
const mavArc = (a, b) => { const sw = sweep(a, b, 160, 260); return { T: sw.T, f: t => { const th = sw.at(t); return { pos: ell(th), q: S.qmul(pitchQ(th), mavAtt(th)) }; } }; };
const mavTop = (deg, rate) => { const T = deg / rate; return { T, f: t => { const th = P - 0.1 + 0.2 * t / T; return { pos: ell(th), q: S.qmul(S.qmul(pitchQ(th), mavAtt(th)), S.qaxis(FWD_ROLL, rate * D * t)) }; } }; };
run('demo maverick loop', chain([approach, mavArc(0, 2 * P), exitFwd(), tail]), 9, ['Maverick Loop']);
run('demo mavvy roll (slow 1.1 s roll)', chain([approach, mavArc(0, P - 0.1), mavTop(360, 330), mavArc(P + 0.1, 2 * P), exitFwd(), tail]), 10, ['Mavvy Roll']);

// ---- batch 5 ----
// Matty Twister demo: over the bar, pitch down ~70° first, roll 360 (~0.6 s), then the rest of the Matty (≈290°)
// forward, down the far side and backward under the bar.
{ const top = mattyPos(P); const T = 2.0;
  const inSeg = straight(S.add(top, S.v3(0, 0, 3)), S.v3(0, 0, -4), 0.75, level);
  const tw = { T, f: t => { const u = t / T, ph = P + P * u; const pos = mattyPos(ph);
    const lead = Math.min(1, t / 0.25), rollU = Math.max(0, Math.min(1, (t - 0.3) / 0.6)), rest = Math.max(0, (t - 0.95) / (T - 0.95));
    const q = S.qmul(S.qmul(pitchQ(-70 * D * lead), S.qaxis(FWD_ROLL, 2 * P * rollU)), pitchQ(-290 * D * rest));
    return { pos, q }; } };
  const qEnd = S.qmul(S.qmul(pitchQ(-70 * D), S.qaxis(FWD_ROLL, 2 * P)), pitchQ(-290 * D));
  run('demo matty twister (lead-in pitch)', chain([inSeg, tw, straight(mattyPos(2 * P), S.v3(0, 0, 3), 1.0, qEnd)]), 6, ['Matty Twister']); }

// ---- batch 6 ----
// Split-S family as flown in the demos: over the bar moving -z, roll (Split-S demo: 180° over ~0.8 s; 540 Split S demo:
// 540° over ~0.7 s), then the pitch-back half loop down the far side and forward under the bar (+z).
function splitDemo(rollDeg, rollT) {
  const p0 = S.v3(0, 3.3, -3.5), v = S.v3(0, 0, -2.2);
  const inSeg = straight(p0, S.v3(0, 0, -4), 0.6, level);                         // crosses over the bar at y 3.3
  const pr = S.add(p0, S.v3(0, 0, -2.4));
  const roll = { T: rollT, f: t => ({ pos: S.add(pr, S.mul(v, t)), q: S.qaxis(FWD_ROLL, rollDeg * D * t / rollT) }) };
  const pz = pr.z + v.z * rollT, c = S.v3(0, 2.3, pz), R1 = S.qaxis(FWD_ROLL, rollDeg * D);
  const half = { T: 0.9, f: t => { const ps = P * t / 0.9; return { pos: S.v3(0, c.y + Math.cos(ps), c.z - Math.sin(ps)), q: S.qmul(R1, pitchQ(ps)) }; } };
  const out = straight(S.v3(0, 1.3, c.z), S.v3(0, 0, 3), 1.6, S.qmul(R1, pitchQ(P)));
  return chain([inSeg, roll, half, out]);
}
run('demo split-s (slow 0.8 s roll)', splitDemo(180, 0.8), 6, ['Split S']);
run('demo 540 split s (0.7 s roll)', splitDemo(540, 0.7), 6, ['540 Split S']);

// ---- objects as used in the demos: trees (any approach angle) and the pilot's legs ----
const YUP = S.v3(0, 1, 0);
function loopAround(C, hv, RZ, RY) {            // loop geometry around centre C, heading hv (unit, horizontal)
  const psi = Math.atan2(-hv.x, -hv.z), face = S.qaxis(YUP, psi);
  const at = th => S.add(C, S.add(S.mul(hv, RZ * Math.sin(th)), S.v3(0, -RY * Math.cos(th), 0)));
  const arcG = (a, b, wmin, wmax, att = th => pitchQ(th)) => { const sw = sweep(a, b, wmin, wmax); return { T: sw.T, f: t => { const th = sw.at(t); return { pos: at(th), q: S.qmul(face, att(th)) }; } }; };
  const lineG = (p0, v, T, q = { w: 1, x: 0, y: 0, z: 0 }) => ({ T, f: t => ({ pos: S.add(p0, S.mul(v, t)), q: S.qmul(face, q) }) });
  return { face, at, arcG, lineG };
}
{ // park tree #1 (x 14, z 8): approach diagonally, pass beside the trunk under the canopy, loop over the top
  const hv = S.v3(-0.6, 0, -0.8), side = S.v3(0.8 * 0.6, 0, -0.6 * 0.6);           // 0.6 m to the side of the trunk
  const C = S.add(S.v3(14, 4.2, 8), side), L = loopAround(C, hv, 2.4, 1.9), b0 = L.at(0);
  const appr = L.lineG(S.sub(b0, S.mul(hv, 4)), S.mul(hv, 4), 1.0), out = L.lineG(b0, S.mul(hv, 4), 0.8), hold = { T: 1.2, f: () => ({ pos: S.add(b0, S.mul(hv, 3.2)), q: L.face }) };
  run('tree powerloop (diagonal approach)', chain([appr, L.arcG(0, 2 * P, 90, 280), out, hold]), 9, ['Powerloop']);
  run('tree maverick loop', chain([appr, L.arcG(0, 2 * P, 150, 240, th => S.qmul(pitchQ(th), mavAtt(th))), out, hold]), 9, ['Maverick Loop']);
}
{ // the pilot (x 2.6, z 14.2, facing -z): through the legs from behind, half loop up and over the head, roll 180, away
  const hv = S.v3(0, 0, -1), C = S.v3(2.6, 1.3, 14.2), L = loopAround(C, hv, 1.3, 0.85), b0 = L.at(0), top = L.at(P), inv = S.qmul(L.face, pitchQ(P));
  run("immelmann through the pilot's legs", chain([L.lineG(S.sub(b0, S.mul(hv, 3)), S.mul(hv, 3), 1.0), L.arcG(0, P, 220, 380),
    { T: 0.4, f: t => ({ pos: S.add(top, S.v3(0, 0, 2.5 * t)), q: S.qmul(inv, S.qaxis(FWD_ROLL, P * t / 0.4)) }) },
    straight(S.add(top, S.v3(0, 0, 1.0)), S.v3(0, 0, 3), 1.4, S.qmul(inv, S.qaxis(FWD_ROLL, P)))]), 7, ['Immelmann']);
}

{ // Blindflip ("Blind Loop" on prowhooper.com; demo: tree): fly at the tree, yaw 180 just before it, pitch back into a loop over it flying blind,
  // down the far side and forward under it
  const hv = S.v3(-0.6, 0, -0.8), g = S.mul(hv, -1), side = S.v3(0.48, 0, -0.36);
  const C = S.add(S.v3(14, 4.2, 8), side), L = loopAround(C, g, 2.4, 1.9), near = L.at(P / 2), faceHv = S.qaxis(YUP, Math.atan2(-hv.x, -hv.z));
  const appr = { T: 1.0, f: t => ({ pos: S.add(near, S.mul(hv, -4 + 4 * t)), q: S.qmul(faceHv, S.qaxis(YUP, Math.PI * Math.min(1, Math.max(0, (t - 0.35) / 0.55)))) }) };
  const sw = sweep(P / 2, 2 * P, 110, 280);
  const loop = { T: sw.T, f: t => { const th = sw.at(t); return { pos: L.at(th), q: S.qmul(L.face, pitchQ((th - P / 2) / (1.5 * P) * 2 * P)) }; } };
  const out = { T: 1.2, f: t => ({ pos: S.add(L.at(2 * P), S.mul(g, 3 * t)), q: L.face }) };
  run('blindflip / "Blind Loop" (tree)', chain([appr, loop, out]), 8, ['Blind Loop']);
}
console.log(`\n${pass}/${total} demo loops`);
