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
    straight(S.add(top, S.v3(0, 0, 1.2)), S.v3(0, 0, 3), 1.5, S.qmul(inv, S.qaxis(FWD_ROLL, Math.PI)))]), 8, ['Immelmann Turn']); }

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
console.log(`\n${pass}/${total} demo loops`);
