// Inverted Yaw Tracking (owner, 2026-11-27, after headmazta's tutorial: "focused on tracking an object as you pass by it while
// inverted"): upside-down, flying past one thing, the yaw following it so it stays in the middle of the picture. A slow track
// (under the rotation-token rate) counts; the same pass with no yaw, a yaw the wrong way, and a spin on the spot do not.
// usage: node test/iyt.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim, W = S.buildPlayground();
const { v3, sub, mul, qmul, qaxis, qnorm } = S, Y = v3(0, 1, 0), FWD = v3(0, 0, -1), PI = Math.PI;
const norm = a => mul(a, 1 / (S.len(a) || 1)), cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const headQ = h => qaxis(Y, Math.atan2(-Math.sin(h), -Math.cos(h)) );   // body forward (-z) turned to the heading h (atan2(x, z))
let ok = 0, n = 0;
function fly(gen, T) { const det = new S.TrickDetector(W), d = Object.create(S.Drone.prototype); d.armed = true; d.crashed = false; const dt = 0.001; let pq = null, pp = null; const got = [];
  for (let t = 0; t < T; t += dt) { const s = gen(t); let q = s.q; if (pq && (q.w * pq.w + q.x * pq.x + q.y * pq.y + q.z * pq.z) < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    let w = v3(); if (pq) { const dq = { w: (q.w - pq.w) / dt, x: (q.x - pq.x) / dt, y: (q.y - pq.y) / dt, z: (q.z - pq.z) / dt }, r = qmul({ w: q.w, x: -q.x, y: -q.y, z: -q.z }, dq); w = v3(2 * r.x, 2 * r.y, 2 * r.z); }
    d.vel = pp ? mul(sub(s.pos, pp), 1 / dt) : v3(); pp = s.pos; pq = q; d.pos = s.pos; d.q = q; d.w = w; d.contactThisStep = false; det.update(d, dt); for (const e of det.drain()) if (e.name !== 'near') got.push(e); }
  return got; }
function check(name, got, want, not) { const names = got.map(e => e.name), good = (!want || names.includes(want)) && !(not && names.includes(not)); n++; if (good) ok++;
  console.log(`${good ? '✓' : '✗'} ${name.padEnd(58)} -> ${got.map(e => e.name + (e.obstacle ? ' on ' + e.obstacle : '') + ' ' + e.exec).join(' | ') || 'nothing'}`); }
// a pass along +x at height y, the thing at T (x, z), dz to its side; mode: 'track' | 'none' | 'wrong' | 'lag' (tracks 25 deg behind)
const pass = (Tg, dz, spd, y, mode, rollT = 0.3) => t => { const x0 = Tg.x - 4.5, z = Tg.z + dz, x = x0 + spd * t, pos = v3(x, y, z), tIn = 0.5, tTrk = tIn + rollT, tOut = (9 / spd) - 0.2, h0 = PI / 2;   // heading +x
  const bear = Math.atan2(Tg.x - x, Tg.z - z), wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
  let h = h0; if (t > tTrk) { const k = Math.min(1, (t - tTrk) / 0.35), tt = Math.min(t, tOut), xb = x0 + spd * tt, b = Math.atan2(Tg.x - xb, Tg.z - z);
    if (mode === 'track') h = h0 + wrap(b - h0) * k; else if (mode === 'lag') h = h0 + wrap(b - h0) * k - Math.sign(dz) * 25 * PI / 180 * k; else if (mode === 'wrong') h = h0 - wrap(b - h0) * k; }
  let roll = 0; if (t > tIn) roll = PI * Math.min(1, (t - tIn) / rollT); if (t > tOut) roll = PI * (1 - Math.min(1, (t - tOut) / rollT));
  return { pos, q: qnorm(qmul(headQ(h), qaxis(FWD, roll))) }; };
const FP = { x: 0, z: -14.5 }, LP = { x: 14, z: 14 };
check('track the Flagpole, 3 m to the side, 4 m/s', fly(pass(FP, 3, 4, 5, 'track'), 4), 'Inverted Yaw Tracking');
check('the other side (the yaw goes the other way)', fly(pass(FP, -3, 4, 5, 'track'), 4), 'Inverted Yaw Tracking');
check('slow and close: 2 m/s, 2 m off (no rotation token)', fly(pass(FP, 2, 2, 4, 'track'), 6), 'Inverted Yaw Tracking');
check('a Lamp Post, 5 m off, 5 m/s', fly(pass(LP, -5, 5, 4, 'track'), 3.5), 'Inverted Yaw Tracking');
{ const g = fly(pass(FP, 3, 4, 5, 'lag'), 4), e = g.find(x => x.name === 'Inverted Yaw Tracking'), c = fly(pass(FP, 3, 4, 5, 'track'), 4).find(x => x.name === 'Inverted Yaw Tracking');
  n++; const good = e && c && e.clean < c.clean; if (good) ok++; console.log(`${good ? '✓' : '✗'} ${'off centre grades lower than locked on'.padEnd(58)} -> ${c && c.clean} vs ${e && e.clean}`); }
check('the same pass with no yaw is not a track', fly(pass(FP, 3, 4, 5, 'none'), 4), null, 'Inverted Yaw Tracking');
check('yawing the wrong way is not a track', fly(pass(FP, 3, 4, 5, 'wrong'), 4), null, 'Inverted Yaw Tracking');
check('nothing to track: the same flight in empty air', fly(pass({ x: 60, z: 60 }, 3, 4, 30, 'track'), 4), null, 'Inverted Yaw Tracking');
{ // a spin on the spot beside the pole stays an Inverted Yaw Spin
  const pos = v3(3, 5, -14.5), g = t => { let roll = 0, yaw = 0; if (t > 0.5) roll = PI * Math.min(1, (t - 0.5) / 0.4); if (t > 0.95) yaw = 2 * PI * Math.min(1, (t - 0.95) / 0.95); if (t > 1.95) roll = PI * (1 - Math.min(1, (t - 1.95) / 0.4));
    return { pos, q: qnorm(qmul(qaxis(Y, yaw), qaxis(FWD, roll))) }; };
  check('a 360 spin on the spot beside the pole: Inverted Yaw Spin', fly(g, 3.6), 'Inverted Yaw Spin', 'Inverted Yaw Tracking'); }
{ // a thing that is not a pole
  const det = new S.TrickDetector(W), o = det.trackTargets(v3(0, 0, 0), 200).find(P => !det.poles.includes(P) && !det.poles.some(q => Math.hypot(q.x - P.x, q.z - P.z) < 7));
  if (o) check(`a solid thing that is no pole (${o.name})`, fly(pass(o, 6, 4, 6, 'track'), 4), 'Inverted Yaw Tracking'); }
console.log(`${ok}/${n} inverted yaw tracking checks`);
