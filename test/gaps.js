// Gap points (owner, 2026-11-20): every gap flown through is worth 25-75 by how tight it is for the whoop, halved each time the same
// gap repeats in one combo, kept on its own line (gapBonus) so the TPW trick score is unchanged.
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim; let ok = 0, n = 0;
const check = (name, pass, got) => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(62)} ${got}`); };
const k = new S.ScoreKeeper(), qW = 0.082;
const a = k.gap({ obj: 1, name: 'Knife Slot 0.2 m opening', narrow: 0.2 }, qW), b = k.gap({ obj: 2, name: 'Alley 7', narrow: 3 }, qW), c = k.gap({ obj: 1, name: 'Knife Slot 0.2 m opening', narrow: 0.2 }, qW);
check('a 0.2 m slot (8 in) is worth 140; 6 in or less the most', a.pts === 140 && S.gapPoints(0.15) === S.GAP_MAX && S.gapPoints(0.3048) === 125 && S.gapPoints(0.4572) === 100, `${a.label} +${a.pts}`);
check('a 3 m alley is worth the least', b.pts === S.GAP_MIN, `${b.label} +${b.pts}`);
check('the same gap again in the combo is halved', c.pts === 70, `+${c.pts}`);
k.chainBreak(); const d = k.gap({ obj: 1, name: 'Knife Slot 0.2 m opening', narrow: 0.2 }, qW);
check('after the combo banks it is fresh again', d.pts === 140, `+${d.pts}`);
check('kept off the trick score, added to the total', k.trickScore === 0 && k.total === k.gapBonus && k.gapBonus === a.pts + b.pts + c.pts + d.pts, `trick ${k.trickScore} total ${k.total}`);
check('names read as gaps', S.gapLabel('Trunk Gap 2') === 'Trunk Gap' && S.gapLabel('Rebar Gate 3 opening') === 'Rebar Gate Gap' && S.gapLabel('Bodega Door') === 'Bodega Door Gap', [S.gapLabel('Trunk Gap 2'), S.gapLabel('Rebar Gate 3 opening'), S.gapLabel('Bodega Door')].join(' / '));
// low openings found by the Surveyor (owner, 2026-11-20: "under the bench / through the picnic table / under the moose don't count
// as gaps"): Moose's furniture gets gaps, flown flat through one the detector logs a gap pass (and the Drone never touches it)
require('../src/maps.js'); const M = S.MAPS.moose.build(), lows = M.objs.filter(o => o.low);
for (const nm of ['Bench', 'Picnic Table', 'Carved Moose']) check(`Moose: a gap under the ${nm}`, lows.some(o => o.name === nm), lows.filter(o => o.name === nm).length + ' found');
{ const g = lows.find(o => o.name === 'Carved Moose'), det = new S.TrickDetector(M), d = Object.create(S.Drone.prototype), v3 = S.v3, dt = 0.002;
  Object.assign(d, { armed: true, crashed: false, contactThisStep: false, w: v3() }); const n0 = S.norm(g.gap.n), face = S.qaxis(v3(0, 1, 0), Math.atan2(n0.x, n0.z));
  for (let t = 0; t < 2; t += dt) { d.pos = S.add(g.gap.c, S.mul(n0, -2 + t * 2)); d.vel = S.mul(n0, 2); d.q = face; det.update(d, dt); det.drain(); }
  const hit = det.crossLog.find(c => c.kind === 'G' && c.obj === g.id); check('flown under the carved moose: a gap pass', !!hit, hit ? S.gapLabel(g.name) : 'none'); }
check('nothing found on the Training Room floor or under a lamp', !S.MAPS.training.build().objs.some(o => o.low) && !S.MAPS.warehouse.build().objs.some(o => o.low && /Light/.test(o.name)), '');
console.log(`\n${ok}/${n} gap checks`);
