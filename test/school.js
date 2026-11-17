// The Vaporwave School map: it builds, the spawn is clear, the detector can read it, and the basics work on it.
// usage: node test/school.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, M = globalThis.Maneuvers, W = S.MAPS.school.build(), { v3 } = S;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const det = new S.TrickDetector(W);
const count = k => W.objs.filter(k).length;
check('builds with collision shapes and things to draw', W.prims.length > 200 && W.objs.every(o => Array.isArray(o.vis)), `${W.objs.length} objects, ${W.prims.length} shapes, ${W.objs.reduce((a, o) => a + o.vis.length, 0)} drawn pieces`);
check('every shape has finite bounds', W.prims.every(p => [p.aabb.min, p.aabb.max].every(q => [q.x, q.y, q.z].every(Number.isFinite))));
check('has over/unders, poles, gaps and walls for the detector', count(o => o.obstacle) >= 25 && det.poles.length >= 40 && count(o => o.gap) >= 15 && count(o => o.kind === 'wall' || o.kind === 'building') >= 8,
  `${count(o => o.obstacle)} over/unders, ${det.poles.length} poles, ${count(o => o.gap)} gaps, ${count(o => o.kind === 'wall' || o.kind === 'building')} walls`);
// spawn: nothing within a metre and a half, and a hover holds for 4 s
{ const P = S.buildDrone(S.PRESETS[Object.keys(S.PRESETS)[0]]), d = new S.Drone(P, S.defaultTune(), W); d.reset(W.spawn); d.armed = true; let touched = 0; const rc = { thr: 0, roll: 0, pitch: 0, yaw: 0 };
  for (let i = 0; i < 4000; i++) { rc.thr = d.pos.y < 1.2 ? 0.6 : 0.4; d.step(rc, 0.001); det.update(d, 0.001, rc); if (i > 300 && d.contactThisStep) touched++; }
  check('spawn is clear: take off and hover without touching anything', !d.crashed && touched === 0 && d.pos.y > 0.5, `y ${d.pos.y.toFixed(2)}`); }
// the bowl transitions slope the right way: at the top of the south ramp the surface is near the deck lip, at the bottom near the floor
{ const hAt = (x, z) => { let best = 0; for (let y = 3; y > 0; y -= 0.01) { if (W.prims.some(p => S.sphereVs(p, v3(x, y, z), 0.01))) { best = y; break; } } return best; };
  const top = hAt(5, 8.8), bot = hAt(5, 7.3), tE = hAt(8.8, 5), bE = hAt(7.3, 5), tN = hAt(5, -8.8), tW = hAt(-8.8, 5);
  check('bowl transitions rise toward the deck on all four sides', top > 0.95 && bot < 0.35 && tE > 0.95 && bE < 0.35 && tN > 0.95 && tW > 0.95, `south ${bot.toFixed(2)}→${top.toFixed(2)}, east ${bE.toFixed(2)}→${tE.toFixed(2)}, north top ${tN.toFixed(2)}, west top ${tW.toFixed(2)}`); }
// scripted flights on this map's own objects
const H = M._h, { faceQ } = H, D = Math.PI / 180;
{ const P = det.poles.find(p => p.name === 'Broken Column' && p.y1 > 4), R = 1.6, w = 150 * D, T = 2.1 * 2 * Math.PI / w, y = Math.min(P.y1 - 0.6, 3);
  const path = { T: T + 1.2, at: t => { const a = Math.min(t, T) * w, pos = v3(P.x + R * Math.cos(a), y, P.z + R * Math.sin(a)); return { pos, q: faceQ(v3(-Math.cos(a), 0, -Math.sin(a))) }; } };
  const got = M.detect(path, W, 30).map(e => e.name); check('two laps round a broken column, facing it → Orbit', got.includes('Orbit x2'), got.join(' | ') || 'nothing'); }
{ // a powerloop over a hall beam: under it forward, loop up and over inverted, back under
  const o = W.objs.find(x => x.name === 'Hall Beam'), ob = o.obstacle, mx = (ob.a.x + ob.b.x) / 2, mz = (ob.a.z + ob.b.z) / 2, yb = (ob.under + ob.over) / 2, R = 0.9, w = 300 * D, Tl = 2 * Math.PI / w;
  const along = Math.abs(ob.b.x - ob.a.x) > Math.abs(ob.b.z - ob.a.z) ? v3(0, 0, -1) : v3(1, 0, 0), y0 = yb - R, lead = 3;
  const at = t => { if (t < 1) return { pos: v3(mx - along.x * (lead - lead * t), y0, mz - along.z * (lead - lead * t)), q: faceQ(along) };
    const a = Math.min(t - 1, Tl) * w, f = R * Math.sin(a), up = R * (1 - Math.cos(a)); const pos = v3(mx + along.x * f, y0 + up, mz + along.z * f);
    if (t - 1 > Tl) { const u = t - 1 - Tl; return { pos: v3(mx + along.x * u * 3, y0, mz + along.z * u * 3), q: faceQ(along) }; }
    return { pos, q: S.qmul(faceQ(along), H.pitchQ(a)) }; };
  const got = M.detect({ T: 1 + Tl + 1.5, at }, W, 30).map(e => e.name); check('a loop round a hall beam is read as a loop trick', got.some(g => /Powerloop|Maverick|Matty|Loop/.test(g)), got.join(' | ') || 'nothing'); }
console.log(`\n${ok}/${n} school map checks`); process.exitCode = ok === n ? 0 : 1;
