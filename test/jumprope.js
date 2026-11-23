// Side Loop vs Jump Rope vs Double Dutch (owner's review, 2026-11-18: "a side loop (the whoop is inverted at the apex), a jump
// rope (the whoop stays upright)"; a Double Dutch flicks a quick 360 roll the other way at the peak). Flown sideways round
// the playground swing set's top bar (z = -6, 2.4 m up), loop in the x-y plane... no: the bar runs along x, so a sideways
// loop round it moves in the y-z plane while the quad faces along x (passes are sideways). node test/jumprope.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim, { v3, mul, sub, qmul, qnorm, qaxis } = S;
const norm = a => mul(a, 1 / (S.len(a) || 1)), cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
function basisQ(f, u) { f = norm(f); const r = norm(cross(f, u)); u = cross(r, f); const m = [[r.x, u.x, -f.x], [r.y, u.y, -f.y], [r.z, u.z, -f.z]], tr = m[0][0] + m[1][1] + m[2][2]; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = { w: s / 4, x: (m[2][1] - m[1][2]) / s, y: (m[0][2] - m[2][0]) / s, z: (m[1][0] - m[0][1]) / s }; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = { w: (m[2][1] - m[1][2]) / s, x: s / 4, y: (m[0][1] + m[1][0]) / s, z: (m[0][2] + m[2][0]) / s }; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = { w: (m[0][2] - m[2][0]) / s, x: (m[0][1] + m[1][0]) / s, y: s / 4, z: (m[1][2] + m[2][1]) / s }; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = { w: (m[1][0] - m[0][1]) / s, x: (m[0][2] + m[2][0]) / s, y: (m[1][2] + m[2][1]) / s, z: s / 4 }; } return qnorm(q); }
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
function fly(W, gen, T) { const det = new S.TrickDetector(W), d = Object.create(S.Drone.prototype); d.armed = true; d.crashed = false; const dt = 0.001; let pq = null, pp = null; const got = [];
  for (let t = 0; t < T; t += dt) { const s = gen(t); let q = s.q; if (pq && q.w * pq.w + q.x * pq.x + q.y * pq.y + q.z * pq.z < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    let w = v3(); if (pq) { const dq = { w: (q.w - pq.w) / dt, x: (q.x - pq.x) / dt, y: (q.y - pq.y) / dt, z: (q.z - pq.z) / dt }, r = qmul({ w: q.w, x: -q.x, y: -q.y, z: -q.z }, dq); w = v3(2 * r.x, 2 * r.y, 2 * r.z); }
    d.vel = pp ? mul(sub(s.pos, pp), 1 / dt) : v3(); pp = s.pos; pq = q; d.pos = s.pos; d.q = q; d.w = w; d.contactThisStep = false; det.update(d, dt); for (const e of det.drain()) if (e.name !== 'near') got.push(e.name); }
  return got; }
const W = S.buildPlayground(), cz = -6, cy = 2.4, R = 1.3, X = 1.0;   // the bar runs along x at z -6; fly at x = 1 facing +x, moving sideways in z
// the path round the bar: angle a from the bottom (a = 0: under the bar), sweeping -z side → over the top → +z side → back under
const P = a => v3(X, cy - R * Math.cos(a), cz - R * Math.sin(a));
// side loop: one sideways lap round the bar with the top toward the bar all the way (upside-down over the top)
function sideLoop(T = 2.6) { return t => { const k = Math.min(1, Math.max(0, (t - 0.8) / T)), a = k * 2 * Math.PI, p = t < 0.8 ? v3(X, cy - R, cz + (0.8 - t) * 3) : t > 0.8 + T ? v3(X, cy - R, cz - (t - 0.8 - T) * 3) : P(a);
  const toC = norm(sub(v3(X, cy, cz), p)), up = t < 0.8 || t > 0.8 + T ? v3(0, 1, 0) : toC; return { pos: p, q: basisQ(v3(1, 0, 0), up) }; }; }
// jump rope: sideways up and over the bar (+z side to -z side), down the far side, then back under it to the start side,
// upright the whole way with a small lean; flick = a quick 360 roll at the peak (Double Dutch)
function jumpRope(flick) { const T = 1.6, T2 = 1.4; return t => { let p, up = v3(0, Math.cos(0.25), Math.sin(0.25));
  if (t < 0.8) p = v3(X, cy - R, cz + R + (0.8 - t) * 2.5);
  else if (t < 0.8 + T) { const k = (t - 0.8) / T, a = k * Math.PI; p = v3(X, cy - R * Math.cos(a) * 0.2 + R * Math.sin(a) * 1.0 - 0.0, cz + R * Math.cos(a)); p.y = cy - 0.9 + 1.7 * Math.sin(a);
    up = v3(0, Math.cos(0.25), (k < 0.5 ? 1 : -1) * Math.sin(0.25)); if (flick && k > 0.38 && k < 0.62) { const ph = (k - 0.38) / 0.24 * 2 * Math.PI; up = v3(0, Math.cos(ph), Math.sin(ph)); } }
  else if (t < 0.8 + T + T2) { const k = (t - 0.8 - T) / T2; p = v3(X, cy - 0.9, cz - R + 2 * R * k); }
  else p = v3(X, cy - 0.9, cz + R + (t - 0.8 - T - T2) * 2.5);
  return { pos: p, q: basisQ(v3(1, 0, 0), norm(up)) }; }; }
// back-to-back side loops, the roll running straight on from one loop into the next (Alligator Man33 round the Clappy footbridge)
function sideLoops(N = 2, T = 2.2) { return t => { const k = Math.min(N, Math.max(0, (t - 0.8) / T)), a = k * 2 * Math.PI, inLoop = t >= 0.8 && t <= 0.8 + N * T;
  const p = t < 0.8 ? v3(X, cy - R, cz + (0.8 - t) * 3) : !inLoop ? v3(X, cy - R, cz - (t - 0.8 - N * T) * 3) : P(a); return { pos: p, q: basisQ(v3(1, 0, 0), inLoop ? norm(sub(v3(X, cy, cz), p)) : v3(0, 1, 0)) }; }; }
// the flick comes on the way down, just after the top (RodFPV's Double Dutches): the jump must not also be called
function lateFlick() { const g = jumpRope(false); return t => { const s = g(t), k = (t - 0.8) / 1.6; if (k > 0.52 && k < 0.74) { const ph = (k - 0.52) / 0.22 * 2 * Math.PI; return { pos: s.pos, q: basisQ(v3(1, 0, 0), v3(0, Math.cos(ph), -Math.sin(ph))) }; } return s; }; }
const sl2 = fly(W, sideLoops(2), 8), lf = fly(W, lateFlick(), 6);
check('two side loops in a row, rolling straight on: two Side Loops, no Jump Rope or Double Dutch', sl2.filter(x => x === 'Side Loop').length === 2 && !sl2.some(x => /Jump Rope|Double Dutch/.test(x)), sl2.join(', ') || 'nothing');
check('a flick just after the top: Double Dutch, not a Jump Rope as well', lf.includes('Double Dutch') && !lf.includes('Jump Rope'), lf.join(', ') || 'nothing');
const sl = fly(W, sideLoop(), 6), jr = fly(W, jumpRope(false), 6), dd = fly(W, jumpRope(true), 6);
check('side loop (upside-down over the top) is a Side Loop, not a Jump Rope or Double Dutch', sl.includes('Side Loop') && !sl.includes('Jump Rope') && !sl.includes('Double Dutch'), sl.join(', ') || 'nothing');
check('jump rope (upright over the top) is not a Side Loop', !jr.includes('Side Loop'), jr.join(', ') || 'nothing');
check('jump rope with a quick 360 flick at the peak is a Double Dutch, not a Jump Rope too', dd.includes('Double Dutch') && !dd.includes('Jump Rope') && !dd.includes('Side Loop'), dd.join(', ') || 'nothing');
// Cinnamon Roll: a jump rope with a slow 360 yaw spin over the whole jump. Owner, 2026-11-20: "a cinnamon roll is not an
// inverted trick": the same yaw with the quad flipped upside-down over the top must not be one
function cinnamon(inv) { const g = jumpRope(false); return t => { const s = g(t), k = Math.min(1, Math.max(0, (t - 1.75) / 1.2)), yaw = k * 2 * Math.PI;
  let f = v3(Math.cos(yaw), 0, -Math.sin(yaw)), up = v3(0, 1, 0);
  if (inv) { const ph = Math.max(0, Math.min(1, (t - 1.2) / 0.3, (3.2 - t) / 0.3)) * Math.PI;   // pitched upside-down (a half flip, no roll) before the top and back after
    up = norm(S.add(mul(v3(0, 1, 0), Math.cos(ph)), mul(f, Math.sin(ph)))); f = norm(S.add(mul(f, Math.cos(ph)), mul(v3(0, -1, 0), Math.sin(ph)))); }
  return { pos: s.pos, q: basisQ(f, up) }; }; }
// the site's Cinnamon Roll (owner, 2026-11-23): an orbit of the object, over it for the first half and back under it for the second,
// the object in view all the way round (nose at the middle of the orbit); `look` false = the same path with the nose turning on its own
function cinOrbit(look) { const Rr = 1.5, h = 0.8, T = 2.6, C = v3(0, cy, cz); return t => { const k = Math.min(1, Math.max(0, (t - 0.8) / T)), a = -Math.PI / 2 + k * 2 * Math.PI;   // under, over at half way, back under as the turn ends
  let pos = v3(Rr * Math.sin(a), cy + h * Math.sin(a), cz + Rr * Math.cos(a)); if (t < 0.8) pos = v3(-Rr, cy - h, cz - (0.8 - t) * 2.5); else if (t > 0.8 + T) pos = v3(-Rr, cy - h, cz + (t - 0.8 - T) * 2.5);
  const f = look ? norm(v3(C.x - pos.x, 0, C.z - pos.z)) : v3(Math.sin(a + 1.2), 0, Math.cos(a + 1.2)); return { pos, q: basisQ(f, v3(0, 1, 0)) }; }; }
const cu = fly(W, cinOrbit(true), 6), ci = fly(W, cinnamon(true), 6), cn = fly(W, cinOrbit(false), 6);
check('an orbit over then under the bar, the bar in view all the way, is a Cinnamon Roll', cu.includes('Cinnamon Roll'), cu.join(', ') || 'nothing');
check('the same orbit with the object out of view most of the way is not a Cinnamon Roll', !cn.includes('Cinnamon Roll'), cn.join(', ') || 'nothing');
check('a cinnamon roll flown upside-down over the top is not a Cinnamon Roll', !ci.includes('Cinnamon Roll'), ci.join(', ') || 'nothing');
console.log(`\n${ok}/${n} jump-rope checks`); if (ok !== n) process.exit(1);
