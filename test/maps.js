// Every game map: it builds, the Surveyor finds things to trick on, the spawn is clear, and the bot's obstacle tricks
// are called on each map's own over/unders. node test/maps.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const OBJS = { school: ['Test Bar 2.2 m', 'Hall Beam'], playground: ['Test Bar 1.6 m', 'Swing Set', 'Power Lines'], clappy: ['Clappy Bars', 'Footbridge', 'Alley Walkway', 'Overhead Wires'], moose: ['Swing Set', 'Climbing Bars', 'Power Lines'], warehouse: ['Rack Beam', 'Catwalk', 'Crane Bridge'], ship: ['Sawhorse Barricade', 'Lifeboat', 'Crime Scene Tape'], slackvegan: ['Bakery Low Gate', 'Water Tower', 'Laundry Line'], murderdome: ['Blood Oath Gantry', 'Witness Me Finish', 'Chain Gate 1', 'Ring Truss', 'Dome Rib'] };
for (const id of Object.keys(S.MAPS)) {
  const w = S.MAPS[id].build(), sv = w.survey || {};
  check(`${id}: builds with things to trick on`, w.objs.length > 50 && sv.overUnders > 20 && sv.poles > 5 && sv.gaps > 5, JSON.stringify(sv));
  const sp = w.spawn.pos, near = w.prims.filter(p => p.aabb && sp.x > p.aabb.min.x - 0.4 && sp.x < p.aabb.max.x + 0.4 && sp.z > p.aabb.min.z - 0.4 && sp.z < p.aabb.max.z + 0.4 && p.aabb.max.y > sp.y + 0.02 && p.aabb.min.y < sp.y + 2.5);   /* from the spawn's own height (the ship's starts on its pier) */
  check(`${id}: the spawn is clear`, near.length === 0, near.map(p => (w.objs.find(o => o.id === p.owner) || {}).name).join(', '));
  let got = 0, tot = 0; const miss = [];
  for (const obj of OBJS[id] || []) for (const name of ['Powerloop', 'Matty Flip']) for (const seed of [11, 23]) {
    let m; try { m = MV.make(name, w, seed, { object: obj }); } catch (e) { miss.push(`${name}@${obj}: ${e.message}`); tot++; continue; }
    tot++; const calls = MV.detect(m, w, 30).map(e => e.name); if (calls.includes(name)) got++; else miss.push(`${name}@${obj} -> ${calls.join(',') || 'nothing'}`); }
  check(`${id}: the bot's obstacle tricks are called on the map's own objects`, got >= tot - 1, `${got}/${tot}${miss.length ? ' · ' + miss.slice(0, 3).join(' · ') : ''}`);
}
// one move is one obstacle trick: a Matty over the sakura tree in front of Clappy's shops also passes the shop's awning, window
// and trim, and used to be called three times (bot run, 2026-11-18)
{ const w = S.MAPS.clappy.build(); for (const [name, seed] of [['Matty Flip', 7], ['Matty 360', 7]]) { const calls = MV.detect(MV.make(name, w, seed, { object: 'Sakura Tree' }), w, 20).map(e => e.name);
  check(`clappy: one ${name} over the sakura by the shops is one call`, calls.length === 1 && calls[0] === name, calls.join(', ')); } }
// Clappy's visual pass (2026-11-27): the new things carry their helpers, flown and logged like the old ones
{ const w = S.MAPS.clappy.build();
  for (const obj of ['Fountain Bowl', 'Street Tree', 'Bus Shelter Roof', 'Parked Car', 'Footbridge Portal', 'Footbridge Tower Beam', 'Footbridge', 'Skywalk', 'Campus Bridge', 'Campus Bridge Tower Beam', 'Bell Tower Roof', 'Truss Frame', 'Campus Truss', 'Quad Tree', 'Campus Arch']) { const calls = MV.detect(MV.make('Powerloop', w, 11, { object: obj }), w, 30).map(e => e.name); check(`clappy: a Powerloop on the ${obj}`, calls.includes('Powerloop'), calls.join(', ')); }
  for (const nm of ['Campus Hall', 'Lecture Hall', 'Library']) check(`clappy: ${nm} is a building (wall tricks, dives, perches)`, w.objs.some(o => o.name === nm && o.kind === 'building' && o.wallNormal && o.tall > 6), '');
  check('clappy: the map reaches the campus (edge past x 110)', w.edges.x[1] > 110, String(w.edges.x[1].toFixed(1)));
  for (const nm of ['Fountain Column', 'Street Tree', 'Bus Stop Sign', 'Footbridge Mast', 'Campus Bridge Mast', 'Quad Tree', 'Campus Flagpole', 'Campus Lamp', 'Trippy Training Tower North', 'Trippy Training Tower South']) check(`clappy: the ${nm} is a pole`, w.objs.some(o => o.name === nm && o.kind === 'pole'), '');
  const flyThrough = g => { const det = new S.TrickDetector(w), d = Object.create(S.Drone.prototype), v3 = S.v3, dt = 0.002; Object.assign(d, { armed: true, crashed: false, contactThisStep: false, w: v3() });
    const n0 = S.norm(g.gap.n), face = S.qaxis(v3(0, 1, 0), Math.atan2(n0.x, n0.z)); for (let t = 0; t < 2; t += dt) { d.pos = S.add(g.gap.c, S.mul(n0, -2 + t * 2)); d.vel = S.mul(n0, 2); d.q = face; det.update(d, dt); det.drain(); }
    return det.crossLog.some(c => c.kind === 'G' && c.obj === g.id); };
  for (const nm of ['Bus Shelter', 'Parked Car', 'Bench', 'Footbridge Portal West', 'Footbridge Tower', 'Campus Bridge Portal West', 'Campus Bridge Tower', 'Campus Breezeway', 'Campus Arcade', 'Campus Passage', 'Bell Tower', 'Truss Frame opening', 'Campus Arch opening']) { const g = w.objs.find(o => o.name === nm && o.gap && (nm !== 'Parked Car' && nm !== 'Bench' || o.low)); check(`clappy: flown through the ${nm} gap: a gap pass`, !!g && flyThrough(g), g ? S.gapLabel(g.name, g.low) : 'no gap'); } }
console.log(`\n${ok}/${n} map checks`);
