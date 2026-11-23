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
  const got = M.detect(path, W, 30).map(e => e.name); check('two laps round a broken column, facing it → Orbit', got.includes('Orbits'), got.join(' | ') || 'nothing'); }
{ // a powerloop over a hall beam: under it forward, loop up and over inverted, back under
  const o = W.objs.find(x => x.name === 'Hall Beam'), ob = o.obstacle, mx = (ob.a.x + ob.b.x) / 2, mz = (ob.a.z + ob.b.z) / 2, yb = (ob.under + ob.over) / 2, R = 0.9, w = 300 * D, Tl = 2 * Math.PI / w;
  const along = Math.abs(ob.b.x - ob.a.x) > Math.abs(ob.b.z - ob.a.z) ? v3(0, 0, -1) : v3(1, 0, 0), y0 = yb - R, lead = 3;
  const at = t => { if (t < 1) return { pos: v3(mx - along.x * (lead - lead * t), y0, mz - along.z * (lead - lead * t)), q: faceQ(along) };
    const a = Math.min(t - 1, Tl) * w, f = R * Math.sin(a), up = R * (1 - Math.cos(a)); const pos = v3(mx + along.x * f, y0 + up, mz + along.z * f);
    if (t - 1 > Tl) { const u = t - 1 - Tl; return { pos: v3(mx + along.x * u * 3, y0, mz + along.z * u * 3), q: faceQ(along) }; }
    return { pos, q: S.qmul(faceQ(along), H.pitchQ(a)) }; };
  const got = M.detect({ T: 1 + Tl + 1.5, at }, W, 30).map(e => e.name); check('a loop round a hall beam is read as a loop trick', got.some(g => /Powerloop|Maverick|Matty|Loop/.test(g)), got.join(' | ') || 'nothing'); }
// the Surveyor: slabs are direction-free, and untagged shapes with air under them are found
{ const loopOn = (ob, al, R = 0.7) => { const mx = (ob.a.x + ob.b.x) / 2, mz = (ob.a.z + ob.b.z) / 2, w = 300 * D, Tl = 2 * Math.PI / w, y0 = ob.under - 0.12 - 0.0, top = ob.over + 0.25, k = (top - y0) / (2 * R);
    return { T: 1 + Tl + 1.5, at: t => { if (t < 1) return { pos: v3(mx - al.x * (3 - 3 * t), y0, mz - al.z * (3 - 3 * t)), q: faceQ(al) }; const a = Math.min(t - 1, Tl) * w; if (t - 1 > Tl) { const u = t - 1 - Tl; return { pos: v3(mx + al.x * u * 3, y0, mz + al.z * u * 3), q: faceQ(al) }; }
      return { pos: v3(mx + al.x * R * Math.sin(a), y0 + k * R * (1 - Math.cos(a)), mz + al.z * R * Math.sin(a)), q: S.qmul(faceQ(al), H.pitchQ(a)) }; } }; };
  const plat = W.objs.find(o => o.name === 'Acrylic Platform'), res = {};
  for (const [nm, al] of [['across it', v3(0, 0, -1)], ['along it', v3(1, 0, 0)], ['diagonally', S.norm(v3(1, 0, -1))]]) { const W2 = S.MAPS.school.build(), p2 = W2.objs.find(o => o.id === plat.id); res[nm] = M.detect(loopOn({ a: p2.obstacle.a, b: p2.obstacle.b, under: p2.round.under, over: p2.round.over }, al), W2, 30).filter(e => e.obstacle === 'Acrylic Platform').map(e => e.name).join('+') || 'nothing'; }
  check('a loop round an acrylic platform counts from any direction', Object.values(res).every(v => v !== 'nothing'), JSON.stringify(res));
  const au = W.objs.filter(o => o.auto); check('untagged shapes with air under them were found and tagged', au.length >= 5 && W.survey.slabs >= 10, `${au.length} found (${[...new Set(au.map(o => o.name))].join(', ')}), ${W.survey.slabs} slabs made direction-free`);
  const W3 = S.MAPS.school.build(), lin = W3.objs.find(o => o.auto && o.name === 'Classroom Shell' && o.obstacle.under > 2), ev = M.detect(loopOn(lin.obstacle, v3(1, 0, 0), 0.8), W3, 30);
  check('a loop through a classroom doorway and over its lintel counts (nobody tagged it)', ev.some(e => /^Classroom/.test(e.obstacle || '')), ev.map(e => e.name + (e.obstacle ? ' on ' + e.obstacle : '')).join(' | ') || 'nothing'); }
{ // a roof is too wide to loop whole, so the Surveyor tags its edges: up over the eave by a dive gap and back under it
  const W4 = S.MAPS.school.build(), e = W4.objs.find(o => o.edge && o.name === 'Hall Roof edge' && Math.abs(o.obstacle.a.x - o.obstacle.b.x) < 0.01 && Math.abs(o.obstacle.a.x + 7.8) < 0.2), ob = e.obstacle;
  const R = 0.8, w = 300 * D, Tl = 2 * Math.PI / w, zc = (ob.a.z + ob.b.z) / 2 + 1.3, y0 = ob.under - 0.6, k = (ob.over + 0.3 - y0) / (2 * R), x0 = ob.a.x, al = v3(-1, 0, 0);   // from the gap side, heading in under the roof
  const at = t => { if (t < 1) return { pos: v3(x0 + 3 - 3 * t, y0, zc), q: faceQ(al) }; const a = Math.min(t - 1, Tl) * w; if (t - 1 > Tl) return { pos: v3(x0 - (t - 1 - Tl) * 3, y0, zc), q: faceQ(al) }; return { pos: v3(x0 - R * Math.sin(a), y0 + k * R * (1 - Math.cos(a)), zc), q: S.qmul(faceQ(al), H.pitchQ(a)) }; };
  const ev = M.detect({ T: 1 + Tl + 1.5, at }, W4, 30); check('a loop round the edge of the hall roof counts', ev.some(x => x.obstacle === 'Hall Roof edge') && W4.survey.edges >= 12, ev.map(x => x.name + (x.obstacle ? ' on ' + x.obstacle : '')).join(' | ') || 'nothing'); }
// the playground as the game builds it: the original, untouched, plus the extras layer
{ const base = S.buildPlayground(), G = S.MAPS.playground.build(), n0 = base.objs.length; let cut = 0;
  for (const o of G.objs.slice(n0)) for (const p of o.prims) for (const q of base.prims) { const a = p.aabb, b = q.aabb; if (Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0.02 && Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0.02 && Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > 0.02) cut++; }
  check('playground extras: original objects unchanged, nothing new cuts into them', G.objs.slice(0, n0).every((o, i) => o.name === base.objs[i].name && o.prims.length === base.objs[i].prims.length) && cut === 0 && G.objs.length > n0 + 20, `${n0} → ${G.objs.length} objects`);
  const o = G.objs.find(x => x.name === 'Sign Gantry'), ob = o.obstacle, yb = 3.4, R = 0.9, w = 300 * D, Tl = 2 * Math.PI / w, mx = (ob.a.x + ob.b.x) / 2 + 1.2, mz = ob.a.z, y0 = yb - R, al = v3(0, 0, -1);
  const at = t => { if (t < 1) return { pos: v3(mx, y0, mz + 3 - 3 * t), q: faceQ(al) }; const a = Math.min(t - 1, Tl) * w; if (t - 1 > Tl) return { pos: v3(mx, y0, mz - (t - 1 - Tl) * 3), q: faceQ(al) }; return { pos: v3(mx, y0 + R * (1 - Math.cos(a)), mz - R * Math.sin(a)), q: S.qmul(faceQ(al), H.pitchQ(a)) }; };
  { const R2 = 0.55, w2 = 320 * D, T2 = 2 * Math.PI / w2, sx = -6.9, y2 = 0.85 - R2 + 0.1, a2 = v3(0, 0, -1);   // under the slide's high end, up and over it, back under
    const at2 = t => { if (t < 1) return { pos: v3(sx, y2, 2 + 3 - 3 * t), q: faceQ(a2) }; const a = Math.min(t - 1, T2) * w2; if (t - 1 > T2) return { pos: v3(sx, y2, 2 - (t - 1 - T2) * 3), q: faceQ(a2) }; return { pos: v3(sx, y2 + 1.25 * R2 * (1 - Math.cos(a)), 2 - R2 * Math.sin(a)), q: S.qmul(faceQ(a2), H.pitchQ(a)) }; };
    const ev = M.detect({ T: 1 + T2 + 1.5, at: at2 }, G, 30); check('playground extras: the slide is its own object to loop', ev.some(e => e.obstacle === 'Slide'), ev.map(e => e.name + (e.obstacle ? ' on ' + e.obstacle : '')).join(' | ') || 'nothing'); }
  const got = M.detect({ T: 1 + Tl + 1.5, at }, G, 30).map(e => e.name); check('playground extras: a loop over the sign gantry is read as a loop trick', got.some(g => /Powerloop|Maverick|Matty|Loop/.test(g)), got.join(' | ') || 'nothing'); }
console.log(`\n${ok}/${n} school map checks`); process.exitCode = ok === n ? 0 : 1;
