// Clipping and flicker: for every drawn piece of a map, its flat faces (boxes turned by right angles, discs, sign planes) are
// compared with every other piece's, and three kinds of visual error are listed (owner, 2026-11-27: "ensure that textures aren't
// sitting inside of the object model, and just on its surface"):
//   flicker   two faces in the same plane, facing the same way, overlapping, in different materials (they fight in the depth
//             buffer: stripes that crawl as the camera moves)
//   layered   a thin piece (paint, paving, a decal) lying on another face less than LAYER above it, not marked `decal` (worldview
//             draws a decal with a depth offset, so it stays on top at any distance; without it it flickers from ~20 m away)
//   cut       a thin piece or sign whose plane runs into a solid box: part of it is inside the object, part sticks out
// Turned boxes (not by right angles), pipes and spheres are not compared (their faces are not planes the tool can line up).
//   node tools/clipcheck.js [map…] [--all] [--layer=0.03]
const path = require('path');
require(path.join(__dirname, '..', 'src', 'tricks.js')); require(path.join(__dirname, '..', 'src', 'sim.js')); require(path.join(__dirname, '..', 'src', 'maps.js'));
const S = globalThis.Sim, args = process.argv.slice(2), opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
const LAYER = +(opt('layer') ?? 0.02), EPS = 0.004, THIN = 0.013, ids = args.filter(a => !a.startsWith('--'));
const right = a => { const q = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); return q < 1e-4 || Math.PI / 2 - q < 1e-4; };
const quarter = a => Math.round(a / (Math.PI / 2)) & 1;   // 1: the box is turned a quarter, so its x and z swap
// an axis-aligned box in world terms, or null
function aabb(v) {
  if (v.shape === 'box') { const [rx, ry, rz] = v.euler || [0, 0, 0]; if (Math.abs(rx) > 1e-4 || Math.abs(rz) > 1e-4 || !right(ry)) return null;
    const sw = quarter(ry), hx = sw ? v.h.z : v.h.x, hz = sw ? v.h.x : v.h.z; return { x0: v.c.x - hx, x1: v.c.x + hx, y0: v.c.y - v.h.y, y1: v.c.y + v.h.y, z0: v.c.z - hz, z1: v.c.z + hz }; }
  if (v.shape === 'disc') { const r = v.r * 0.886; return { x0: v.c.x - r, x1: v.c.x + r, y0: v.c.y - v.th, y1: v.c.y + v.th, z0: v.c.z - r, z1: v.c.z + r, disc: true }; }   // the square of the same area
  return null;
}
// faces: { ax: 'x'|'y'|'z', at, dir: +1|-1, a0, a1, b0, b1 } (a, b the other two axes in order)
const OTH = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };
function facesOf(v) {
  const out = [];
  if (v.shape === 'sign') { const rx = v.rx || 0, ry = v.ry || 0;
    if (Math.abs(rx + Math.PI / 2) < 1e-3 && right(ry)) { const sw = quarter(ry), hw = (sw ? v.h : v.w) / 2, hd = (sw ? v.w : v.h) / 2; out.push({ ax: 'y', at: v.c.y, dir: 1, a0: v.c.x - hw, a1: v.c.x + hw, b0: v.c.z - hd, b1: v.c.z + hd }); }
    else if (Math.abs(rx) < 1e-3 && right(ry)) { const q = Math.round(ry / (Math.PI / 2)), k = ((q % 4) + 4) % 4, hw = v.w / 2, hh = v.h / 2;   // ry 0 faces +z, pi/2 +x, pi -z, -pi/2 -x
      if (k === 0 || k === 2) out.push({ ax: 'z', at: v.c.z, dir: k === 0 ? 1 : -1, a0: v.c.x - hw, a1: v.c.x + hw, b0: v.c.y - hh, b1: v.c.y + hh });
      else out.push({ ax: 'x', at: v.c.x, dir: k === 1 ? 1 : -1, a0: v.c.y - hh, a1: v.c.y + hh, b0: v.c.z - hw, b1: v.c.z + hw }); }
    return out; }
  const b = aabb(v); if (!b) return out;
  for (const ax of ['x', 'y', 'z']) { if (b.disc && ax !== 'y') continue; const [p, q] = OTH[ax];
    for (const dir of [-1, 1]) out.push({ ax, at: dir > 0 ? b[ax + '1'] : b[ax + '0'], dir, a0: b[p + '0'], a1: b[p + '1'], b0: b[q + '0'], b1: b[q + '1'] }); }
  return out;
}
const overlap = (f, g) => Math.max(0, Math.min(f.a1, g.a1) - Math.max(f.a0, g.a0)) * Math.max(0, Math.min(f.b1, g.b1) - Math.max(f.b0, g.b0));
const thinOf = v => v.shape === 'sign' || (v.shape === 'disc' && v.th <= THIN) || (v.shape === 'box' && Math.min(v.h.x, v.h.y, v.h.z) <= THIN);
const inside = (b, f, d = 0.005) => { const [p, q] = OTH[f.ax]; return f.at > b[f.ax + '0'] + d && f.at < b[f.ax + '1'] - d && f.a0 < b[p + '1'] && f.a1 > b[p + '0'] && f.b0 < b[q + '1'] && f.b1 > b[q + '0']; };
const within = (b, f) => { const [p, q] = OTH[f.ax]; return f.a0 >= b[p + '0'] - 1e-3 && f.a1 <= b[p + '1'] + 1e-3 && f.b0 >= b[q + '0'] - 1e-3 && f.b1 <= b[q + '1'] + 1e-3; };
let total = 0;
for (const id of (ids.length ? ids : Object.keys(S.MAPS))) {
  const M = S.MAPS[id]; if (!M) { console.log('no map', id); continue; }
  const w = M.build(), P = [];
  for (const o of w.objs) { if (o.kind === 'edge' || o.removed) continue; for (const v of o.vis) { if (v.noDraw) continue; const F = facesOf(v); if (!F.length) continue; P.push({ o, v, F, thin: thinOf(v), b: aabb(v) }); } }
  const G = new Map(), cell = 3; P.forEach((p, n) => { const xs = p.F.flatMap(f => f.ax === 'x' ? [f.at] : [f.a0, f.a1]), zs = p.F.flatMap(f => f.ax === 'z' ? [f.at] : f.ax === 'x' ? [f.b0, f.b1] : [f.b0, f.b1]);
    for (let i = Math.floor(Math.min(...xs) / cell); i <= Math.floor(Math.max(...xs) / cell); i++) for (let k = Math.floor(Math.min(...zs) / cell); k <= Math.floor(Math.max(...zs) / cell); k++) { const q = i + ',' + k; if (!G.has(q)) G.set(q, new Set()); G.get(q).add(n); } });
  const seen = new Set(), found = { flicker: [], layered: [], cut: [] };
  for (const set of G.values()) { const list = [...set]; for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) { const i = list[x], j = list[y], key = i < j ? i + ':' + j : j + ':' + i; if (seen.has(key)) continue; seen.add(key);
    const A = P[i], B = P[j];
    for (const f of A.F) for (const g of B.F) { if (f.ax !== g.ax) continue; if (f.ax === 'y' && f.dir < 0 && f.at <= (w.groundY || 0) + 1e-3) continue;   /* bottoms on the ground: never seen */ const ar = overlap(f, g); if (ar < 0.0025) continue; const d = Math.abs(f.at - g.at);
      if (f.dir === g.dir && d < EPS && A.v.mat !== B.v.mat && !(A.v.decal || B.v.decal)) found.flicker.push([A, B, f, ar]);
      else if (f.dir === g.dir && d >= EPS && d < LAYER && (A.thin || B.thin)) { const top = (f.at - g.at) * f.dir > 0 ? A : B; if (!top.v.decal && top.thin) found.layered.push([top, top === A ? B : A, f, ar, d]); } }
    for (const [T, Bx] of [[A, B], [B, A]]) { if (!T.thin || !Bx.b || Bx.thin) continue; const f = T.F.find(q => q.dir > 0) || T.F[0], big = T.F.reduce((m, q) => overlap(q, q) > overlap(m, m) ? q : m, f);
      if (big.ax === 'y' && Bx.b.y0 <= big.at + 0.03) continue;   /* a floor decal under something standing on that floor: covered, not cut */
      if (inside(Bx.b, big) && !within(Bx.b, big)) found.cut.push([T, Bx, big]); } } }
  const pick = arr => { const m = new Map(); for (const r of arr) { const k = r[0].o.name + ' / ' + r[1].o.name + ' (' + r[0].v.mat + ' / ' + r[1].v.mat + ')'; if (!m.has(k)) m.set(k, { n: 0, r }); m.get(k).n++; } return [...m.entries()].sort((a, b) => b[1].n - a[1].n); };
  const fl = pick(found.flicker), la = pick(found.layered), cu = pick(found.cut);
  console.log(`=== ${id}: ${P.length} flat pieces; flicker ${fl.length}, layered without a depth offset ${la.length}, cut ${cu.length}`);
  const lim = args.includes('--all') ? 1e9 : 25, at = r => { const f = r[2]; return `${f.ax} ${f.at.toFixed(3)} [${f.a0.toFixed(1)}..${f.a1.toFixed(1)}, ${f.b0.toFixed(1)}..${f.b1.toFixed(1)}]`; };
  for (const [k, { n, r }] of fl.slice(0, lim)) console.log(`  flicker ${String(n).padStart(3)}x  ${k}  ${at(r)}`);
  for (const [k, { n, r }] of la.slice(0, lim)) console.log(`  layered ${String(n).padStart(3)}x  ${k}  ${at(r)} gap ${(r[4] * 1000).toFixed(0)} mm`);
  for (const [k, { n, r }] of cu.slice(0, lim)) console.log(`  cut     ${String(n).padStart(3)}x  ${k}  ${at(r)}`);
  total += fl.length + cu.length;
}
process.exitCode = 0;
