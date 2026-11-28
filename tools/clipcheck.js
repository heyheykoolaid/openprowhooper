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
const LAYER = +(opt('layer') ?? 0.02), ids = args.filter(a => !a.startsWith('--'));
// maps come out of S.MAPS already put right by `deflicker` (maps.js): what is listed here is what is still wrong after it
let total = 0;
for (const id of (ids.length ? ids : Object.keys(S.MAPS))) {
  const M = S.MAPS[id]; if (!M) { console.log('no map', id); continue; }
  const w = M.build(), { P, found } = S.clipScan(w, LAYER);
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
