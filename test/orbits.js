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
function fly(W, gen, T) { const det = new S.TrickDetector(W), d = Object.create(S.Drone.prototype); d.armed = true; d.crashed = false; const dt = 0.001; let pq = null, pp = null; const got = []; got.ev = [];
  for (let t = 0; t < T; t += dt) { const s = gen(t); let q = s.q; if (pq && q.w * pq.w + q.x * pq.x + q.y * pq.y + q.z * pq.z < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    let w = v3(); if (pq) { const dq = { w: (q.w - pq.w) / dt, x: (q.x - pq.x) / dt, y: (q.y - pq.y) / dt, z: (q.z - pq.z) / dt }, r = qmul({ w: q.w, x: -q.x, y: -q.y, z: -q.z }, dq); w = v3(2 * r.x, 2 * r.y, 2 * r.z); }
    d.vel = pp ? mul(sub(s.pos, pp), 1 / dt) : v3(); pp = s.pos; pq = q; d.pos = s.pos; d.q = q; d.w = w; d.contactThisStep = false; det.update(d, dt, s.rc); for (const e of det.drain()) if (e.name !== 'near') { got.push(e.name); got.ev.push(e); } }
  return got; }
// lap round a tree at (cx, cz): pitched = nose at the tree, leaning by pitch; rolled = nose along the path, top toward the tree
const lap = (c, R, y, speed, laps, how, lean) => t => { const w = speed / R, a = Math.min(t * w, laps * 2 * Math.PI), pos = v3(c.x + R * Math.cos(a), y, c.z + R * Math.sin(a)), toC = norm(v3(c.x - pos.x, 0, c.z - pos.z)), tan = v3(-Math.sin(a), 0, Math.cos(a)), L = lean * D2R;
  if (how === 'pitched') { const f = norm(v3(toC.x * Math.cos(L), -Math.sin(L), toC.z * Math.cos(L))); return { pos, q: basisQ(f, mul(toC, 1)) }; }
  const up = norm(v3(toC.x * Math.sin(L), Math.cos(L), toC.z * Math.sin(L))); return { pos, q: basisQ(tan, up) }; };
const C = S.MAPS.clappy.build(), sak = C.objs.find(o => o.name === 'Sakura Tree' && o.round && o.round.under > 2.5), sc = sak.round.c;
for (const [speed, lean] of [[11, 66], [13, 72], [16, 76]]) { const got = fly(C, lap(sc, 4.7, 1.9, speed, 3.2, 'pitched', lean), 3.2 * 2 * Math.PI * 4.7 / speed + 2.5);
  check(`fast orbit round a Clappy sakura (${speed} m/s, nose down ${lean}°) is an Orbit, not a Trippy`, got.includes('Orbits') && !got.some(x => /Trippy/.test(x)), got.join(', ') || 'nothing'); }
{ const got = fly(C, lap(sc, 3.2, 1.9, 8, 3.2, 'rolled', 80), 3.2 * 2 * Math.PI * 3.2 / 8 + 2.5); check('a rolled trippy round the same sakura is still a Trippy Spin', got.includes('Trippy Spin'), got.join(', ') || 'nothing'); }
const M = S.MAPS.moose.build(), lone = M.objs.find(o => o.kind === 'tree' && o.round && o.prims.some(p => p.type === 'capsule' && p.r > 0.26 && p.r <= 0.6 && Math.abs(p.b.y - p.a.y) > 3));
{ const c = lone.round.c, got = fly(M, lap(c, 3.4, 2.2, 8, 3.2, 'rolled', 80), 3.2 * 2 * Math.PI * 3.4 / 8 + 2.5);
  check(`a trippy round a thick Moose tree (${lone.name}, trunk ${lone.prims.find(p => p.type === 'capsule').r.toFixed(2)} m) counts`, got.includes('Trippy Spin'), got.join(', ') || 'nothing'); }
// nose up the pole and rolling all the way round (pilot review of RodFPV's flagpole trippies on the playground: nose
// 55-75° up, rolling ~270°/s, climbing): one Trippy Spin of several laps, not Roll / one-lap trippy / Double Roll
{ const P = S.MAPS.playground.build(), fp = P.objs.find(o => o.name === 'Flagpole'), cap = fp.prims.find(p => p.type === 'capsule'), c = { x: cap.a.x, z: cap.a.z };
  const R = 2.5, w = 280 * D2R, laps = 3.5, T = laps * 2 * Math.PI / w, nose = 65 * D2R, g = 72 * D2R;   // circling nose-up shows on the body's roll axis (~250°/s); the top leans back so up.y holds at ~0.4
  const gen = t => { const a = Math.min(t, T) * w, pos = v3(c.x + R * Math.cos(a), 1.8 + 0.5 * Math.min(t, T), c.z + R * Math.sin(a)), toC = norm(v3(c.x - pos.x, 0, c.z - pos.z)), tan = v3(-Math.sin(a), 0, Math.cos(a));
    const f = norm(v3(tan.x * Math.cos(nose), Math.sin(nose), tan.z * Math.cos(nose))), back = v3(-tan.x * Math.sin(nose), Math.cos(nose), -tan.z * Math.sin(nose));
    return { pos, q: basisQ(f, v3(toC.x * Math.cos(g) + back.x * Math.sin(g), back.y * Math.sin(g), toC.z * Math.cos(g) + back.z * Math.sin(g))) }; };
  const got = fly(P, gen, T + 2.5), ts = got.filter(x => x === 'Trippy Spin').length;
  check('nose-up rolling trippy round the playground flagpole is one Trippy Spin', ts === 1 && !got.some(x => /^(Roll|Double Roll|Triple Roll)$/.test(x)), got.join(', ') || 'nothing'); }
// a Matty's tumble must be forward: fwdSweptBetween reads a forward (nose-down) flip as positive and a powerloop's way round
// as negative (pilot review of RodFPV: the tail of a powerloop between an over and an under was called a Matty Flip)
{ const P = S.MAPS.playground.build(); for (const [sgn, name] of [[1, 'forward flip'], [-1, 'backward loop']]) { const det = new S.TrickDetector(P), d = Object.create(S.Drone.prototype); d.armed = true; d.crashed = false;
    const dt = 0.001, th = t => sgn * Math.min(1, Math.max(0, t - 0.3) / 1.0) * 2 * Math.PI; let pp = null;
    for (let t = 0; t < 1.8; t += dt) { const a = th(t), f = v3(Math.cos(a), -Math.sin(a), 0), u = v3(Math.sin(a), Math.cos(a), 0), pos = v3(-30 + 2 * t, 6, 30); d.q = basisQ(f, u); d.pos = pos; d.vel = pp ? mul(sub(pos, pp), 1 / dt) : v3(2, 0, 0); pp = pos; d.w = v3(0, 0, 0); d.contactThisStep = false; det.update(d, dt); }
    const fw = det.fwdSweptBetween(det.time - 1.7, det.time), sw = det.sweptBetween(det.time - 1.7, det.time);
    check(`fwdSweptBetween: a ${name} reads ${sgn > 0 ? 'forward' : 'backward'}`, sw > 300 && sgn * fw > 0.8 * sw, `swept ${Math.round(sw)}°, forward ${Math.round(fw)}°`); } }
// The sticks (the Infinity Loops masterclass, 2026-11-23; "wonky nips"): a trippy's roll and yaw are pushed opposite ways, an orbit's the
// same way. A high camera tilt flies the trippy much flatter than knife-edge (HemmingsonFPV's and the owner's, missed): leaning only
// 50° (up.y 0.64) with the pole held at the top of the picture it is a Trippy Spin when the sticks are opposed, and nothing when they
// are not (as before: the Node flights with no sticks are unchanged).
{ const withRc = (gen, rc) => t => ({ ...gen(t), rc });
  const flat = lap(sc, 3.2, 1.9, 8, 3.2, 'rolled', 50), T = 3.2 * 2 * Math.PI * 3.2 / 8 + 2.5, det45 = W => { const d = new S.TrickDetector(W); return d; };
  const flyTilt = (gen, tilt) => { const o = S.TrickDetector.prototype, was = Object.getOwnPropertyDescriptor(o, 'camTilt'); const got = (() => { const D = S.TrickDetector; S.TrickDetector = class extends D { constructor(w) { super(w); this.camTilt = tilt; } }; try { return fly(C, gen, T); } finally { S.TrickDetector = D; } })(); return got; };
  const a = flyTilt(withRc(flat, { thr: 0.5, roll: 0.4, pitch: 0.05, yaw: -0.4 }), 45), b = flyTilt(flat, 45), c = flyTilt(withRc(flat, { thr: 0.5, roll: 0.4, pitch: 0.05, yaw: 0.4 }), 45);
  const ea = a.ev.find(e => e.name === 'Trippy Spin');
  check('a flat trippy (leaning 50°, camera 45°) with roll and yaw opposed is a Trippy Spin', a.includes('Trippy Spin'), a.join(', ') || 'nothing');
  check('…with the stick witness on the call (confidence, no "sticks" fail) and how long it lasted', !!ea && ea.watch && ea.watch.conf >= 0.9 && !ea.watch.fails.length && ea.dur > 3, ea ? JSON.stringify({ conf: ea.watch && ea.watch.conf, dur: ea.dur, notes: ea.notes }) : '');
  check('the same flight with no sticks recorded, or with them pushed the same way, is not', !b.some(x => /Trippy/.test(x)) && !c.some(x => /Trippy/.test(x)), `${b.join(', ') || 'nothing'} / ${c.join(', ') || 'nothing'}`);
  // a properly rolled trippy flown with the sticks the same way round still counts (the witness is a vote, never a veto), with low confidence
  const d2 = flyTilt(withRc(lap(sc, 3.2, 1.9, 8, 3.2, 'rolled', 80), { thr: 0.5, roll: 0.4, pitch: 0, yaw: 0.4 }), 20), ed = d2.ev.find(e => e.name === 'Trippy Spin');
  check('a rolled trippy with the sticks together still counts, at low confidence with a note', !!ed && ed.watch.conf < 0.5 && ed.watch.fails.includes('sticks'), ed ? JSON.stringify(ed.watch) : d2.join(', ')); }
// East Campus's Trippy Training Towers (2026-11-27): its mast is the pole; slats reach 2.5 m, so laps are flown 4 m out
{ const sp = C.objs.find(o => o.name === 'Trippy Training Tower South'), c = sp.prims[0].a; let got = fly(C, lap(c, 4.0, 4.5, 8, 3.2, 'rolled', 80), 3.2 * 2 * Math.PI * 4 / 8 + 2.5);
  check('a trippy round a Trippy Training Tower', got.includes('Trippy Spin'), got.join(', ') || 'nothing');
  got = fly(C, lap(c, 4.2, 5, 11, 3.2, 'pitched', 66), 3.2 * 2 * Math.PI * 4.2 / 11 + 2.5);
  check('orbits round a Trippy Training Tower', got.includes('Orbits'), got.join(', ') || 'nothing'); }
console.log(`\n${ok}/${n} orbit checks`); if (ok !== n) process.exit(1);
