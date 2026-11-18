// Map audit: does what you see match what you hit, and what the trick detector can count?
//   node tools/mapaudit.js [map…] [--all] [--min=0.05]
// For every object on every game map (S.MAPS, as the game builds them, with the official layout):
//  1. LOOKS WITHOUT COLLISION: drawn volume (sampled points inside each drawn piece) that no collider in the world covers.
//     Thin decoration (under 6 cm thick), glow strips and pieces drawn on purpose as non-solid are listed only with --all.
//  2. COLLISION WITHOUT LOOKS: collider volume nothing is drawn on (invisible walls), except map edges and checkpoints.
//  3. TRICK FACETS: trunks and posts the detector skips as poles (too thick, too short, not upright), over/under bands
//     whose object you can't fly under (less than 0.35 m of air), gaps narrower than a whoop, plus Surveyor counts.
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const S = globalThis.Sim;
const args = process.argv.slice(2), ALL = args.includes('--all'), MIN = +((args.find(a => a.startsWith('--min=')) || '').slice(6) || 0.05);
const ids = args.filter(a => !a.startsWith('--')); const maps = ids.length ? ids : Object.keys(S.MAPS);
function rotM(rx, ry, rz) { const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  return [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx]; }
function segD(p, a, b) { const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, L = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z; let t = L ? ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / L : 0; t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t, p.z - a.z - ab.z * t), t }; }
function inPrim(P, p, pad = 0.03) {
  if (P.type === 'sphere') return Math.hypot(p.x - P.c.x, p.y - P.c.y, p.z - P.c.z) <= P.r + pad;
  if (P.type === 'capsule') return segD(p, P.a, P.b).d <= P.r + pad;
  if (P.type === 'box') { const m = P.m, d = { x: p.x - P.c.x, y: p.y - P.c.y, z: p.z - P.c.z }, lx = m[0] * d.x + m[3] * d.y + m[6] * d.z, ly = m[1] * d.x + m[4] * d.y + m[7] * d.z, lz = m[2] * d.x + m[5] * d.y + m[8] * d.z;
    return Math.abs(lx) <= P.h.x + pad && Math.abs(ly) <= P.h.y + pad && Math.abs(lz) <= P.h.z + pad; }
  return false; }
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// random points inside a drawn piece, and its volume
function sample(v, n) {
  const pts = []; let vol = 0, thick = 0;
  if (v.shape === 'box') { const m = rotM(v.euler ? v.euler[0] : 0, v.euler ? v.euler[1] : 0, v.euler ? v.euler[2] : 0); vol = 8 * v.h.x * v.h.y * v.h.z; thick = 2 * Math.min(v.h.x, v.h.y, v.h.z);
    for (let i = 0; i < n; i++) { const l = { x: (rnd() * 2 - 1) * v.h.x, y: (rnd() * 2 - 1) * v.h.y, z: (rnd() * 2 - 1) * v.h.z };
      pts.push({ x: v.c.x + m[0] * l.x + m[1] * l.y + m[2] * l.z, y: v.c.y + m[3] * l.x + m[4] * l.y + m[5] * l.z, z: v.c.z + m[6] * l.x + m[7] * l.y + m[8] * l.z }); } }
  else if (v.shape === 'sphere') { vol = 4 / 3 * Math.PI * v.r ** 3; thick = 2 * v.r; for (let i = 0; i < n * 3 && pts.length < n; i++) { const l = { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1 }; if (l.x * l.x + l.y * l.y + l.z * l.z <= 1) pts.push({ x: v.c.x + l.x * v.r, y: v.c.y + l.y * v.r, z: v.c.z + l.z * v.r }); } }
  else if (v.shape === 'pipe') { const ab = { x: v.b.x - v.a.x, y: v.b.y - v.a.y, z: v.b.z - v.a.z }, L = Math.hypot(ab.x, ab.y, ab.z) || 1e-6, u = { x: ab.x / L, y: ab.y / L, z: ab.z / L };
    const t1 = Math.abs(u.y) < 0.9 ? { x: -u.z, y: 0, z: u.x } : { x: 1, y: 0, z: 0 }, n1l = Math.hypot(t1.x, t1.y, t1.z), e1 = { x: t1.x / n1l, y: t1.y / n1l, z: t1.z / n1l }, e2 = { x: u.y * e1.z - u.z * e1.y, y: u.z * e1.x - u.x * e1.z, z: u.x * e1.y - u.y * e1.x };
    vol = (v.cone ? 1 / 3 : 1) * Math.PI * v.r * v.r * L; thick = 2 * v.r;
    for (let i = 0; i < n * 4 && pts.length < n; i++) { const s = rnd(), rr = v.cone ? v.r * (1 - s) : v.r, a = rnd() * 2 * Math.PI, q = Math.sqrt(rnd()) * rr; if (v.cone && rnd() > (1 - s) * (1 - s) * 1.0001) continue;
      pts.push({ x: v.a.x + ab.x * s + (e1.x * Math.cos(a) + e2.x * Math.sin(a)) * q, y: v.a.y + ab.y * s + (e1.y * Math.cos(a) + e2.y * Math.sin(a)) * q, z: v.a.z + ab.z * s + (e1.z * Math.cos(a) + e2.z * Math.sin(a)) * q }); } }
  return { pts, vol, thick };
}
function near(prims, box, pad = 0.2) { return prims.filter(P => P.aabb && P.aabb.max.x >= box.min.x - pad && P.aabb.min.x <= box.max.x + pad && P.aabb.max.y >= box.min.y - pad && P.aabb.min.y <= box.max.y + pad && P.aabb.max.z >= box.min.z - pad && P.aabb.min.z <= box.max.z + pad); }
const bb = pts => pts.reduce((b, p) => ({ min: { x: Math.min(b.min.x, p.x), y: Math.min(b.min.y, p.y), z: Math.min(b.min.z, p.z) }, max: { x: Math.max(b.max.x, p.x), y: Math.max(b.max.y, p.y), z: Math.max(b.max.z, p.z) } }), { min: { x: 1e9, y: 1e9, z: 1e9 }, max: { x: -1e9, y: -1e9, z: -1e9 } });
const f1 = x => x.toFixed(1), f2 = x => x.toFixed(2);
const report = { maps: {} };
for (const id of maps) {
  const W = S.MAPS[id].build(), prims = W.objs.flatMap(o => o.prims || []);
  const looks = new Map(), hidden = [], facets = [];
  for (const o of W.objs) { if (o.kind === 'edge' || o.auto) continue;
    for (const v of o.vis || []) { if (v.shape === 'disc' || v.glow || v.mat === 'glow' || v.invisible) continue;
      const s = sample(v, 60); if (!s.pts.length || s.vol < 1e-4) continue; const cand = near(prims, bb(s.pts)), miss = s.pts.filter(p => !cand.some(P => inPrim(P, p))).length / s.pts.length;
      const lost = miss * s.vol; if (miss < 0.25 || lost < MIN) continue; if (!ALL && s.thick < 0.06) continue;
      const k = o.name + '#' + o.id, e = looks.get(k) || { name: o.name, kind: o.kind, at: f1(v.a ? v.a.x : v.c.x) + ',' + f1(v.a ? v.a.z : v.c.z), lost: 0, mats: new Set(), shapes: new Set(), meant: 0, pieces: 0 };
      e.lost += lost; e.mats.add(v.mat); e.shapes.add(v.shape + (v.cone ? '(cone)' : '')); e.pieces++; if (v.noCollide) e.meant++; looks.set(k, e); } }
  // colliders nothing is drawn on
  const visPieces = W.objs.flatMap(o => (o.vis || []).filter(v => v.shape !== 'disc').map(v => ({ v, o })));
  for (const o of W.objs) { if (o.kind === 'edge' || /checkpoint|invisible/i.test(o.name) || o.invisible) continue;
    for (const P of o.prims || []) { const s = sample(P.type === 'box' ? { shape: 'box', c: P.c, h: P.h, euler: P.euler } : P.type === 'sphere' ? { shape: 'sphere', c: P.c, r: P.r } : { shape: 'pipe', a: P.a, b: P.b, r: P.r }, 40);
      const inVis = p => visPieces.some(({ v }) => v.shape === 'box' ? inPrim({ type: 'box', c: v.c, h: v.h, m: rotM(v.euler ? v.euler[0] : 0, v.euler ? v.euler[1] : 0, v.euler ? v.euler[2] : 0) }, p, 0.05)
        : v.shape === 'sphere' ? inPrim({ type: 'sphere', c: v.c, r: v.r }, p, 0.05) : v.shape === 'pipe' ? (() => { const q = segD(p, v.a, v.b); return q.d <= (v.cone ? v.r * (1 - q.t) : v.r) + 0.05; })() : false);
      const miss = s.pts.filter(p => !inVis(p)).length / Math.max(1, s.pts.length); if (miss > 0.5 && s.vol * miss > MIN) hidden.push({ name: o.name, kind: o.kind, type: P.type, vol: s.vol * miss, at: f1((P.c || P.a).x) + ',' + f1((P.c || P.a).z) }); } }
  // trick facets
  for (const o of W.objs) { if (o.kind === 'edge') continue;
    if (o.kind === 'tree' || o.kind === 'pole') { const up = (o.prims || []).filter(p => p.type === 'capsule' && Math.abs(p.b.y - p.a.y) >= 1.2 && Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z) < 0.25 * Math.abs(p.b.y - p.a.y));
      const ok = up.some(p => p.r >= 0.012 && p.r <= (o.kind === 'tree' || o.kind === 'pole' ? 0.6 : 0.25));
      if (!ok) facets.push(`${o.kind} "${o.name}" at ${f1(o.prims[0] ? (o.prims[0].a || o.prims[0].c).x : 0)},${f1(o.prims[0] ? (o.prims[0].a || o.prims[0].c).z : 0)} is not a pole (${up.length ? 'trunk r ' + f2(Math.min(...up.map(p => p.r))) + ' m' : 'no upright trunk capsule'}): no orbits or trippies round it`); }
    if (o.obstacle && !o.auto && o.obstacle.under != null && o.obstacle.under < 0.35 && !o.round) facets.push(`over/under "${o.name}" has only ${f2(o.obstacle.under)} m beneath it`);
    if (o.round && o.round.under < 0.35) facets.push(`round over/under "${o.name}" has only ${f2(o.round.under)} m under its lowest part`);
    if (o.gap && o.gap.w != null && Math.min(o.gap.w, o.gap.h ?? 9) < 0.2) facets.push(`gap "${o.name}" is ${f2(Math.min(o.gap.w, o.gap.h ?? 9))} m: too small for a whoop`); }
  const L = [...looks.values()].sort((a, b) => b.lost - a.lost), R = { looksNoCollide: L.map(e => ({ ...e, mats: [...e.mats], shapes: [...e.shapes], lost: +f2(e.lost) })), collideNoLooks: hidden, facets, survey: W.survey };
  report.maps[id] = R;
  console.log(`\n=== ${id} (${W.title || ''}): ${W.objs.length} objects, ${prims.length} colliders. Surveyor: ${JSON.stringify(W.survey || {})}`);
  console.log(`  drawn but not solid (m³ you can fly through), ${L.length} object(s):`);
  for (const e of L.slice(0, ALL ? 999 : 25)) console.log(`    ${f2(e.lost).padStart(7)} m³  ${e.name.padEnd(26)} ${e.kind.padEnd(10)} at ${e.at.padEnd(12)} ${[...e.shapes].join('/')} ${[...e.mats].join('/')}${e.meant === e.pieces ? '  (drawn as non-solid on purpose)' : ''}`);
  if (L.length > 25 && !ALL) console.log(`    … ${L.length - 25} more (--all)`);
  console.log(`  solid but not drawn, ${hidden.length}:`); for (const h of hidden.slice(0, 15)) console.log(`    ${f2(h.vol).padStart(7)} m³  ${h.name} (${h.kind}, ${h.type}) at ${h.at}`);
  console.log(`  trick facets, ${facets.length}:`); for (const f of facets.slice(0, 30)) console.log('    ' + f);
}
if (args.includes('--json')) require('fs').writeFileSync('mapaudit.json', JSON.stringify(report, null, 1));
