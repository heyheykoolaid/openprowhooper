// Are a map's gaps really open? Samples a grid across every gap's opening and checks it against every collider (a whoop
// needs about 5 cm of clear air either side of its centre).  node tools/gapcheck.js [map…]
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const S = globalThis.Sim;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S.MAPS), CLEAR = 0.05;
const seg = (p, a, b) => { const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, L = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z; let t = L ? ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t, p.z - a.z - ab.z * t); };
const dist = (P, p) => { if (P.type === 'sphere') return Math.hypot(p.x - P.c.x, p.y - P.c.y, p.z - P.c.z) - P.r; if (P.type === 'capsule') return seg(p, P.a, P.b) - P.r;
  const m = P.m, d = { x: p.x - P.c.x, y: p.y - P.c.y, z: p.z - P.c.z }, l = [m[0] * d.x + m[3] * d.y + m[6] * d.z, m[1] * d.x + m[4] * d.y + m[7] * d.z, m[2] * d.x + m[5] * d.y + m[8] * d.z], h = [P.h.x, P.h.y, P.h.z];
  const q = l.map((v, i) => Math.abs(v) - h[i]); return Math.hypot(...q.map(v => Math.max(v, 0))) + Math.min(Math.max(...q), 0); };
let bad = 0, total = 0;
for (const id of ids) { const w = S.MAPS[id].build(), gaps = w.objs.filter(o => o.gap && !o.removed); let mb = 0;
  for (const o of gaps) { const g = o.gap, n = S.norm(g.n), u = S.norm(g.u || S.cross(Math.abs(n.y) < 0.9 ? S.v3(0, 1, 0) : S.v3(1, 0, 0), n)), v = S.norm(S.cross(n, u)), N = 7, blk = {}; let hit = 0, k = 0, worst = 1e9;
    const near = w.prims.filter(P => P.aabb && P.aabb.max.x > g.c.x - g.hu - g.hv - 1 && P.aabb.min.x < g.c.x + g.hu + g.hv + 1 && P.aabb.max.y > g.c.y - g.hu - g.hv - 1 && P.aabb.min.y < g.c.y + g.hu + g.hv + 1 && P.aabb.max.z > g.c.z - g.hu - g.hv - 1 && P.aabb.min.z < g.c.z + g.hu + g.hv + 1);
    const ptsAB = []; if (g.cells) { for (let a = -g.hu + g.cells / 2 - 0.0; a < g.hu; a += g.cells) for (let b = -g.hv + g.cells / 2; b < g.hv; b += g.cells) ptsAB.push([a, b]); } else for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) ptsAB.push([(i / (N - 1) * 2 - 1) * g.hu, (j / (N - 1) * 2 - 1) * g.hv]);   /* a lattice (gap.cells): the centre of each cell */
    for (const [a, b] of ptsAB) { const p = { x: g.c.x + u.x * a + v.x * b, y: g.c.y + u.y * a + v.y * b, z: g.c.z + u.z * a + v.z * b };
      k++; let d = Infinity, who = null; for (const P of near) { const e = dist(P, p); if (e < d) { d = e; who = P; } } worst = Math.min(worst, d); if (d < CLEAR) { hit++; const nm = w.objs[who.owner] ? w.objs[who.owner].name : '?'; blk[nm] = (blk[nm] || 0) + 1; } }
    total++; const W = (2 * g.hu).toFixed(2) + ' x ' + (2 * g.hv).toFixed(2) + ' m';
    if (hit) { bad++; mb++; console.log(`  ✗ ${id} ${o.name} at ${g.c.x.toFixed(1)},${g.c.y.toFixed(1)},${g.c.z.toFixed(1)} (${W}): ${hit}/${k} points inside or touching a collider (${Object.entries(blk).map(([a, b]) => a + ' ' + b).join(', ')})`); } }
  console.log(`${id}: ${gaps.length} gaps, ${gaps.length - mb} clear`); }
console.log(`\n${total - bad}/${total} gaps clear`); process.exitCode = bad ? 1 : 0;
