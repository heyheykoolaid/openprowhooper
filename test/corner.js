// Corner Climb (owner, 2026-11-23): a trippy on a building's corner: quarter-turn swings round it each way, climbing. node test/corner.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const S = globalThis.Sim; const { v3, mul, sub, qmul, qnorm, D2R } = S;
const norm = a => mul(a, 1 / (S.len(a) || 1)), cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
function basisQ(f, u) { f = norm(f); const r = norm(cross(f, u)); u = cross(r, f); const m = [[r.x, u.x, -f.x], [r.y, u.y, -f.y], [r.z, u.z, -f.z]], tr = m[0][0] + m[1][1] + m[2][2]; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = { w: s / 4, x: (m[2][1] - m[1][2]) / s, y: (m[0][2] - m[2][0]) / s, z: (m[1][0] - m[0][1]) / s }; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2; q = { w: (m[2][1] - m[1][2]) / s, x: s / 4, y: (m[0][1] + m[1][0]) / s, z: (m[0][2] + m[2][0]) / s }; }
  else if (m[1][1] > m[2][2]) { const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2; q = { w: (m[0][2] - m[2][0]) / s, x: (m[0][1] + m[1][0]) / s, y: s / 4, z: (m[1][2] + m[2][1]) / s }; }
  else { const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2; q = { w: (m[1][0] - m[0][1]) / s, x: (m[0][2] + m[2][0]) / s, y: (m[1][2] + m[2][1]) / s, z: s / 4 }; } return qnorm(q); }
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
function fly(W, gen, T) { const det = new S.TrickDetector(W), d = Object.create(S.Drone.prototype); d.armed = true; d.crashed = false; const dt = 0.001; let pq = null, pp = null; const got = []; got.ev = [];
  for (let t = 0; t < T; t += dt) { const s = gen(t); let q = s.q; if (pq && q.w * pq.w + q.x * pq.x + q.y * pq.y + q.z * pq.z < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    let w = v3(); if (pq) { const dq = { w: (q.w - pq.w) / dt, x: (q.x - pq.x) / dt, y: (q.y - pq.y) / dt, z: (q.z - pq.z) / dt }, r = qmul({ w: q.w, x: -q.x, y: -q.y, z: -q.z }, dq); w = v3(2 * r.x, 2 * r.y, 2 * r.z); }
    d.vel = pp ? mul(sub(s.pos, pp), 1 / dt) : v3(); pp = s.pos; pq = q; d.pos = s.pos; d.q = q; d.w = w; d.contactThisStep = false; det.update(d, dt, s.rc); for (const e of det.drain()) if (e.name !== 'near') { got.push(e.name); got.ev.push(e); } }
  return got; }
const W = S.MAPS.training.build(), tower = W.objs.find(o => o.name === 'Dive Tower 14 m'), b = tower.prims.find(p => p.type === 'box');
const det0 = new S.TrickDetector(W), cs = det0.corners.filter(c => c.objId === tower.id);
check('the Dive Tower has four corners to climb', cs.length === 4, `${det0.corners.length} corners on the map`);
// the corner pointing away from the tower's centre along (+x, +z) in its own axes; its outward diagonal
const c = cs[0], diag = Math.atan2(c.n1.z + c.n2.z, c.n1.x + c.n2.x);
// swing ±`half` deg either side of the diagonal at radius R, `lean` deg rolled toward the corner (top toward it), climbing `climb` m/s
const swing = (half, R, lean, climb, rc, period = 1.6, mid = diag) => t => { const a = mid + half * D2R * Math.sin(2 * Math.PI * t / period), da = Math.cos(2 * Math.PI * t / period) >= 0 ? 1 : -1;
  const pos = v3(c.x + R * Math.cos(a), 2 + climb * t, c.z + R * Math.sin(a)), toC = norm(v3(c.x - pos.x, 0, c.z - pos.z)), tan = v3(-Math.sin(a) * da, 0, Math.cos(a) * da), L = lean * D2R;
  return { pos, q: basisQ(tan, norm(v3(toC.x * Math.sin(L), Math.cos(L), toC.z * Math.sin(L)))), rc: rc ? { roll: 0.5 * da * rc, pitch: 0, yaw: -0.5 * da, thr: 0.4 } : undefined }; };
{ const got = fly(W, swing(55, 2.2, 80, 0.5), 6); check('swinging round the corner in the trippy pose, climbing, is a Corner Climb', got.filter(x => x === 'Corner Climb').length === 1 && got.ev.find(e => e.name === 'Corner Climb').obstacle === 'Dive Tower 14 m', got.join(', ') || 'nothing'); }
{ const got = fly(W, swing(55, 2.2, 45, 0.5, 1), 6); check('flown flatter with roll and yaw opposed, it still is', got.includes('Corner Climb'), got.join(', ') || 'nothing'); }
{ const got = fly(W, swing(55, 2.2, 45, 0.5, -1), 6); check('flown flat with the sticks together, it is not', !got.includes('Corner Climb'), got.join(', ') || 'nothing'); }
{ const got = fly(W, swing(55, 2.2, 45, 0.5), 6); check('flown flat with no sticks recorded, it is not', !got.includes('Corner Climb'), got.join(', ') || 'nothing'); }
{ const got = fly(W, swing(55, 2.2, 80, 0), 6); check('without climbing it is not', !got.includes('Corner Climb'), got.join(', ') || 'nothing'); }
{ const got = fly(W, swing(18, 2.2, 80, 0.5), 6); check('little wiggles are not swings', !got.includes('Corner Climb'), got.join(', ') || 'nothing'); }
{ const got = fly(W, swing(30, 4, 80, 0.5, 0, 1.6, diag + 70 * D2R), 6); check('back and forth in front of one face is not round the corner', !got.includes('Corner Climb'), got.join(', ') || 'nothing'); }
console.log(`${ok}/${n} corner checks`); process.exit(ok === n ? 0 : 1);
