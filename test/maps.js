// Every game map: it builds, the Surveyor finds things to trick on, the spawn is clear, and the bot's obstacle tricks
// are called on each map's own over/unders. node test/maps.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const OBJS = { school: ['Test Bar 2.2 m', 'Hall Beam'], playground: ['Test Bar 1.6 m', 'Swing Set'], clappy: ['Clappy Bars', 'Footbridge', 'Alley Walkway'], moose: ['Swing Set', 'Climbing Bars'], warehouse: ['Rack Beam', 'Catwalk', 'Crane Bridge'], ship: ['Sawhorse Barricade', 'Lifeboat', 'Crime Scene Tape'], murderdome: ['Blood Oath Gantry', 'Witness Me Finish', 'Chain Gate 1'] };
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
console.log(`\n${ok}/${n} map checks`);
