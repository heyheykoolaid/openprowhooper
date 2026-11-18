// The Map Editor's edit layer (maps.js applyMapEdits). node test/mapedit.js
//  - moving, turning and scaling a piece moves its colliders, its look and the tags the detector reads, together
//  - a removed piece is gone (nothing to hit, nothing to count); added assets stand where they were put
//  - keys find their pieces by name and place; a layer the map no longer matches is reported, never applied wrongly
//  - the bot's tricks are called on a moved swing set and on an added over/under bar
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const build = E => { S.setMapEdits('moose', E); const w = S.MAPS.moose.build(); S.setMapEdits('moose', null); return w; };
const base = build(null), pieces = S.mapPieces(base), byName = nm => pieces.find(p => p.name === nm);
const swing = byName('Swing Set'), cedar = pieces.find(p => p.name === 'Cedar' && base.objs[p.ids[0]].round), unit = byName('Play Unit');
check('the play unit is one piece with its roof, slide, bars and openings', unit && unit.ids.length >= 8, unit && unit.ids.map(id => base.objs[id].name).join(', '));
check('the swing set carries its opening', swing.ids.some(id => base.objs[id].gap));
// move the swing set 6 m east and turn it 90°; move a cedar; remove another piece; add a bar and a birch
const bin = byName('Bear Bin');
const E = { format: 'pro-whooper-mapedit/1', map: 'moose', moved: { [swing.key]: { dx: 6, dz: 0, ry: 90 }, [cedar.key]: { dx: -2, dz: 3, s: 1.2 } }, removed: [bin.key],
  added: [{ asset: 'Over/Under Bar', x: -20, z: 14, ry: 30 }, { asset: 'Birch', x: -10, z: 16 }, { asset: 'Nope', x: 0, z: 0 }] };
const w = build(E), sw = w.objs[swing.ids[0]], gapO = w.objs[swing.ids.find(id => base.objs[id].gap)];
const mid = o => ({ x: (o.obstacle.a.x + o.obstacle.b.x) / 2, z: (o.obstacle.a.z + o.obstacle.b.z) / 2 });
check('the swing set moved with its over/under line, turned 90°', Math.abs(mid(sw).x - (swing.pivot.x + 6)) < 0.05 && Math.abs(sw.obstacle.a.x - sw.obstacle.b.x) < 0.05, JSON.stringify(mid(sw)));
check('its opening came with it, turned too', Math.abs(gapO.gap.c.x - (swing.pivot.x + 6)) < 0.3 && Math.abs(gapO.gap.n.x) > 0.99);
check('its colliders moved', sw.prims.every(p => p.aabb.min.x > swing.pivot.x + 3));
const cw = w.objs[cedar.ids[0]], c0 = base.objs[cedar.ids[0]];
check('the cedar moved and grew, crown and heights with it', Math.abs(cw.round.c.x - (c0.round.c.x - 2)) < 0.01 && Math.abs(cw.round.r - c0.round.r * 1.2) < 0.01 && cw.round.over > c0.round.over);
check('the removed bin has nothing left to hit', bin.ids.every(id => !w.objs[id].prims.length && !w.objs[id].vis.length));
const bar = w.objs.find(o => o.name === 'Bar' && o.added), birch = w.objs.find(o => o.name === 'Birch' && o.added);
check('the added bar and birch stand where they were put', bar && Math.abs(mid(bar).x + 20) < 0.05 && Math.abs(mid(bar).z - 14) < 0.05 && birch && birch.prims.length > 0);
check('an unknown asset is reported, not built', w.edits.lost === 1 && w.edits.added === 2 && w.edits.moved === 2 && w.edits.removed === 1, JSON.stringify(w.edits));
check('the same keys after editing (a moved piece keeps its key)', S.mapPieces(w).some(p => p.key === swing.key));
check('the layer finds a piece that moved a little in the map code', (() => { const k2 = swing.key.replace(/@(-?[\d.]+),/, (m, x) => '@' + (+x + 0.3).toFixed(1) + ','); const w2 = build({ moved: { [k2]: { dx: 6 } } }); return w2.edits.moved === 1; })());
check('a key far from anything is reported as lost', build({ moved: { 'Cedar@999.0,999.0': { dx: 1 } } }).edits.lost === 1);
check('the map is still closed in round the new layout', (() => { const edge = w.objs.find(o => o.kind === 'edge').id; return w.bounds.x[1] >= Math.max(...w.prims.filter(p => p.aabb && p.owner !== edge).map(p => p.aabb.max.x)) - 0.01; })());
// the bot flies on the edited pieces
let got = 0; for (const [obj, name] of [['Swing Set', 'Powerloop'], ['Swing Set', 'Matty Flip'], ['Bar', 'Powerloop'], ['Bar', 'Matty Flip']]) { const m = MV.make(name, w, 11, { object: obj }); if (MV.detect(m, w, 30).map(e => e.name).includes(name)) got++; }
check("the bot's tricks are called on the moved swing set and the added bar", got === 4, `${got}/4`);
console.log(`\n${ok}/${n} map edit checks`); if (ok !== n) process.exit(1);
