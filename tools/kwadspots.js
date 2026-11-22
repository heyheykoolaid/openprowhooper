// Which named objects the daily K.W.A.D. may send pilots to (owner, 2026-11-20: "obstacle letters on objects the bot already flies
// well on that map"). For each map's candidate objects and each obstacle trick in the pool the bot flies it on 3 seeds; a pair is
// kept when every flight is called as that trick ON that object. Prints the table for KWAD_SPOTS in src/sim.js.
// node tools/kwadspots.js [map…]
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers;
const CAND = { playground: ['Test Bar 1.6 m', 'Test Bar 2.2 m', 'Swing Set', 'Monkey Bars', 'Jungle Gym', 'Power Lines'], moose: ['Swing Set', 'Climbing Bars', 'Power Lines'], clappy: ['Clappy Bars', 'Footbridge', 'Alley Walkway', 'Overhead Wires', 'Test Bar 2.2 m'],
  warehouse: ['Rack Beam', 'Catwalk', 'Crane Bridge', 'Hanging Sign', 'Cable Tray', 'Yard Gate'], ship: ['Sawhorse Barricade', 'Lifeboat', 'Crime Scene Tape'], slackvegan: ['Bakery Low Gate', 'Water Tower', 'Laundry Line'], murderdome: ['Blood Oath Gantry', 'Witness Me Finish', 'Chain Gate 1', 'Ring Truss'] };
const TRICKS = S.KWAD_OBJ_TRICKS, out = {};
for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CAND)) {
  const w = S.MAPS[id].build(); out[id] = {};
  for (const obj of CAND[id]) { const names = w.objs.filter(o => o.name === obj || o.name.startsWith(obj + ' ')).map(o => o.name), one = names.includes(obj) ? obj : names[0]; if (!one) { console.error(id, 'no object', obj); continue; }
    const good = [];
    for (const t of TRICKS) { let n = 0; for (const seed of [11, 23, 37]) { try { const ev = MV.detect(MV.make(t, w, seed, { object: one }), w, 20); if (ev.some(e => e.name === t && e.obstacle === one) && !ev.some(e => e.name === 'Crash')) n++; } catch { /* the bot cannot fly it there */ } } if (n === 3) good.push(t); }
    if (good.length) out[id][one] = good; console.error(id, one, good.join(', ') || '-'); }
}
console.log(JSON.stringify(out));
