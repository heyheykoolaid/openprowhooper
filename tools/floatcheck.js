// Floating things: every drawn piece of a map is boxed (rotated boxes by their corners, pipes by their ends and radius),
// pieces that touch (within --tol, default 4 cm) are linked, and every linked group that never reaches the ground (or the
// map's ground height) is listed: "floating". Glow pieces, signs and decals ride on whatever they sit against, so they are
// linked like the rest but never hold a group up on their own. Also lists boxes that sink deep into the ground.
//   node tools/floatcheck.js [map…] [--tol=0.04] [--all]
// Intended floaters (beams of light, smoke, hallucinations, dust) carry `float: true` on the piece or `o.float` on the object.
const path = require('path');
require(path.join(__dirname, '..', 'src', 'tricks.js')); require(path.join(__dirname, '..', 'src', 'sim.js')); require(path.join(__dirname, '..', 'src', 'maps.js'));
const S = globalThis.Sim, args = process.argv.slice(2), opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const TOL = +(opt('tol') ?? 0.04), maps = args.filter(a => !a.startsWith('--')), ids = maps.length ? maps : Object.keys(S.MAPS);
// R = Ry * Rx * Rz, as makeBox (sim.js) and visMesh ('YXZ') both rotate boxes: Z first, then X, then Y
function rotP(p, e) {
  const [rx, ry, rz] = e || [0, 0, 0]; let { x, y, z } = p;
  let c = Math.cos(rz), s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(rx); s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
  return { x, y, z };
}
function boxOf(v) {
  const b = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 }, add = p => { b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.z0 = Math.min(b.z0, p.z); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y); b.z1 = Math.max(b.z1, p.z); };
  if (v.shape === 'box') { for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const q = rotP({ x: sx * v.h.x, y: sy * v.h.y, z: sz * v.h.z }, v.euler); add({ x: v.c.x + q.x, y: v.c.y + q.y, z: v.c.z + q.z }); } }
  else if (v.shape === 'pipe') { const r = v.r || 0.02; for (const p of [v.a, v.b]) { add({ x: p.x - r, y: p.y - r, z: p.z - r }); add({ x: p.x + r, y: p.y + r, z: p.z + r }); } }
  else if (v.shape === 'sphere') { add({ x: v.c.x - v.r, y: v.c.y - v.r, z: v.c.z - v.r }); add({ x: v.c.x + v.r, y: v.c.y + v.r, z: v.c.z + v.r }); }
  else if (v.shape === 'disc') { add({ x: v.c.x - v.r, y: v.c.y - v.th, z: v.c.z - v.r }); add({ x: v.c.x + v.r, y: v.c.y + v.th, z: v.c.z + v.r }); }
  else if (v.shape === 'sign') { const hw = v.w / 2, hh = v.h / 2, c = Math.cos(v.ry || 0), s = Math.sin(v.ry || 0); for (const sx of [-1, 1]) for (const sy of [-1, 1]) add({ x: v.c.x + sx * hw * c, y: v.c.y + sy * hh, z: v.c.z - sx * hw * s }); }
  else if (v.c) { const r = v.r || v.size || 0.1; add({ x: v.c.x - r, y: v.c.y - r, z: v.c.z - r }); add({ x: v.c.x + r, y: v.c.y + r, z: v.c.z + r }); }
  else return null;
  return b;
}
const touch = (a, b) => a.x0 <= b.x1 + TOL && b.x0 <= a.x1 + TOL && a.y0 <= b.y1 + TOL && b.y0 <= a.y1 + TOL && a.z0 <= b.z1 + TOL && b.z0 <= a.z1 + TOL;
let total = 0;
for (const id of ids) {
  const M = S.MAPS[id]; if (!M) { console.log('no map', id); continue; }
  const w = M.build(), gY = w.groundY || 0, P = [];
  for (const o of w.objs) { if (o.kind === 'edge' || o.removed || o.float) continue; for (const v of o.vis) { if (v.float) continue; const b = boxOf(v); if (b) P.push({ o, v, b, weak: !!(v.glow || v.shape === 'sign') }); } }
  // a grid over x/z so touching is checked only among neighbours
  const G = new Map(), cell = 2, key = (i, k) => i + ',' + k;
  P.forEach((p, n) => { for (let i = Math.floor((p.b.x0 - TOL) / cell); i <= Math.floor((p.b.x1 + TOL) / cell); i++) for (let k = Math.floor((p.b.z0 - TOL) / cell); k <= Math.floor((p.b.z1 + TOL) / cell); k++) { const q = key(i, k); if (!G.has(q)) G.set(q, []); G.get(q).push(n); } });
  const par = P.map((_, i) => i), find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  const ground = P.map(p => !p.weak && p.b.y0 <= gY + TOL);
  for (const list of G.values()) for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) { const i = list[a], j = list[b]; if (find(i) === find(j)) continue; if (P[i].weak && P[j].weak) continue; if (touch(P[i].b, P[j].b)) par[find(i)] = find(j); }
  const held = new Set(); P.forEach((p, i) => { if (ground[i]) held.add(find(i)); });
  const groups = new Map(); P.forEach((p, i) => { const r = find(i); if (held.has(r)) return; if (!groups.has(r)) groups.set(r, []); groups.get(r).push(p); });
  const out = [...groups.values()].map(g => { const b = g.reduce((m, p) => ({ x0: Math.min(m.x0, p.b.x0), y0: Math.min(m.y0, p.b.y0), z0: Math.min(m.z0, p.b.z0), x1: Math.max(m.x1, p.b.x1), y1: Math.max(m.y1, p.b.y1), z1: Math.max(m.z1, p.b.z1) }), { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 });
    const names = [...new Set(g.map(p => p.o.name))]; return { names, n: g.length, b, weak: g.every(p => p.weak) }; }).sort((a, b) => a.b.y0 - b.b.y0);
  // the drop: how far below each floating group the nearest thing under it is
  const below = g => { let best = g.b.y0 - gY, what = 'ground'; for (const p of P) { const b = p.b; if (b.x1 < g.b.x0 || b.x0 > g.b.x1 || b.z1 < g.b.z0 || b.z0 > g.b.z1 || b.y1 > g.b.y0 + TOL) continue; const d = g.b.y0 - b.y1; if (d < best) { best = d; what = p.o.name; } } return [best, what]; };
  const sunk = P.filter(p => p.v.shape === 'box' && !p.weak && p.b.y0 < gY - 0.4 && p.b.y1 > gY + 0.2 && p.b.y1 - p.b.y0 > 1.5).map(p => p.o.name);
  console.log(`=== ${id}: ${P.length} drawn pieces, ${out.length} floating group(s)${out.filter(g => !g.weak).length !== out.length ? ` (${out.filter(g => g.weak).length} only signs / glow)` : ''}`);
  for (const g of (args.includes('--all') ? out : out.filter(x => !x.weak)).slice(0, 200)) { const [d, what] = below(g);
    console.log(`  ${g.names.slice(0, 3).join(', ').padEnd(44).slice(0, 44)} ${String(g.n).padStart(3)} pc  x ${g.b.x0.toFixed(1)}..${g.b.x1.toFixed(1)} y ${g.b.y0.toFixed(2)}..${g.b.y1.toFixed(2)} z ${g.b.z0.toFixed(1)}..${g.b.z1.toFixed(1)}  ${d.toFixed(2)} m over ${what}`); }
  if (sunk.length) console.log('  deep in the ground:', [...new Set(sunk)].join(', '));
  total += out.length;
}
