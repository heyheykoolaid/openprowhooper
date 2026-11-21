// More Warehouse's conveyor (owner, 2026-11-21): a surface that moves what rests on it (sim.js surf.belt), and the map's own checks:
// every gap clear, nothing floating. node test/belt.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js');
const S = globalThis.Sim, w = S.MAPS.warehouse.build(), { execFileSync } = require('child_process'), path = require('path');
let bad = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) bad++; };
{ const d = new S.Drone(S.buildDrone(S.PRESETS['Air65 Racing']), S.defaultTune(), w); d.reset({ pos: S.v3(2, 1.25, 12), yaw: 0 }); d.pos = S.v3(2, 1.25, 12);
  for (let i = 0; i < 3000; i++) d.step({ thr: 0, roll: 0, pitch: 0, yaw: 0 }, 0.001);
  ok(Math.abs(d.vel.x - 1.2) < 0.1 && d.pos.x > 4.5 && Math.abs(d.pos.z - 12) < 0.3 && d.pos.y > 1.05, `a quad left on the conveyor is carried east at the belt's speed (vx ${d.vel.x.toFixed(2)} m/s, x 2 → ${d.pos.x.toFixed(1)} in 3 s)`); }
{ const d = new S.Drone(S.buildDrone(S.PRESETS['Air65 Racing']), S.defaultTune(), w); d.reset({ pos: S.v3(2, 0.1, 5), yaw: 0 });
  for (let i = 0; i < 2000; i++) d.step({ thr: 0, roll: 0, pitch: 0, yaw: 0 }, 0.001);
  ok(Math.hypot(d.vel.x, d.vel.z) < 0.02, 'a quad on the floor beside it stays put'); }
ok(w.belts && w.belts.length === 1 && w.prims.filter(p => p.surf && p.surf.belt).length === 1, 'one belt, one moving surface');
ok(!S.MAPS.moose.build().prims.some(p => p.surf && p.surf.belt), 'no other map has one (the physics elsewhere is unchanged)');
const run = (tool) => { try { return execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', tool), 'warehouse'], { encoding: 'utf8' }); } catch (e) { return String(e.stdout || e); } };
{ const g = run('gapcheck.js'), m = /(\d+)\/(\d+) gaps clear/.exec(g); ok(m && m[1] === m[2] && +m[2] >= 22, `every gap in More Warehouse is open (${m ? m[0] : 'no result'})`); }
{ const f = run('floatcheck.js'), m = /(\d+) floating group\(s\)(?: \((\d+) only signs)?/.exec(f); ok(m && +m[1] === +(m[2] || 0), `nothing in More Warehouse floats (${m ? m[0] : 'no result'})`); }
for (const n of ['Hanging Sign', 'Cable Tray', 'Yard Gate', 'Box Truck', 'Conveyor']) ok(w.objs.some(o => o.name === n && o.obstacle), `${n} is an over / under`);
ok(w.objs.filter(o => o.name === 'Yard Light' && o.kind === 'pole').length === 2, 'the two yard lights are poles');
console.log(bad ? `\n${bad} failed` : '\nall passed'); process.exit(bad ? 1 : 0);
