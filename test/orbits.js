// Orbits vs trippies round real map trees. node test/orbits.js
//  - a fast orbit flown nose-down at the tree (pilots' orbits at 10-16 m/s lean ~70° by pitching, measured from RodFPV's
//    Clappy flights) is an Orbit, not a Trippy Spin
//  - a trippy (rolled, top toward the tree) round the same tree is still a Trippy Spin
//  - a trippy round one of Moose Knuckle Park's thick lone trees counts (trunks up to 0.6 m are poles)
if(process.env.DBG) require("/tmp/dbg.js"); require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const S = globalThis.Sim; const { v3, mul, sub, qmul, qnorm, D2R } = S;
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
// lap round a tree at (cx, cz): pitched = nose at the tree, leaning by pitch; rolled = nose along the path, top toward the tree
const lap = (c, R, y, speed, laps, how, lean) => t => { const w = speed / R, a = Math.min(t * w, laps * 2 * Math.PI), pos = v3(c.x + R * Math.cos(a), y, c.z + R * Math.sin(a)), toC = norm(v3(c.x - pos.x, 0, c.z - pos.z)), tan = v3(-Math.sin(a), 0, Math.cos(a)), L = lean * D2R;
  if (how === 'pitched') { const f = norm(v3(toC.x * Math.cos(L), -Math.sin(L), toC.z * Math.cos(L))); return { pos, q: basisQ(f, mul(toC, 1)) }; }
  const up = norm(v3(toC.x * Math.sin(L), Math.cos(L), toC.z * Math.sin(L))); return { pos, q: basisQ(tan, up) }; };
const C = S.MAPS.clappy.build(), sak = C.objs.find(o => o.name === 'Sakura Tree' && o.round && o.round.under > 2.5), sc = sak.round.c;
for (const [speed, lean] of [[11, 66], [13, 72], [16, 76]]) { const got = fly(C, lap(sc, 4.7, 1.9, speed, 3.2, 'pitched', lean), 3.2 * 2 * Math.PI * 4.7 / speed + 2.5);
  check(`fast orbit round a Clappy sakura (${speed} m/s, nose down ${lean}°) is an Orbit, not a Trippy`, got.includes('Orbit x2') && !got.some(x => /Trippy/.test(x)), got.join(', ') || 'nothing'); }
{ const got = fly(C, lap(sc, 3.2, 1.9, 8, 3.2, 'rolled', 80), 3.2 * 2 * Math.PI * 3.2 / 8 + 2.5); check('a rolled trippy round the same sakura is still a Trippy Spin', got.includes('Trippy Spin x2'), got.join(', ') || 'nothing'); }
const M = S.MAPS.moose.build(), lone = M.objs.find(o => o.kind === 'tree' && o.round && o.prims.some(p => p.type === 'capsule' && p.r > 0.26 && p.r <= 0.6 && Math.abs(p.b.y - p.a.y) > 3));
{ const c = lone.round.c, got = fly(M, lap(c, 3.4, 2.2, 8, 3.2, 'rolled', 80), 3.2 * 2 * Math.PI * 3.4 / 8 + 2.5);
  check(`a trippy round a thick Moose tree (${lone.name}, trunk ${lone.prims.find(p => p.type === 'capsule').r.toFixed(2)} m) counts`, got.includes('Trippy Spin x2'), got.join(', ') || 'nothing'); }
console.log(`\n${ok}/${n} orbit checks`); if (ok !== n) process.exit(1);
