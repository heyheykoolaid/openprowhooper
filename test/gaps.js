// Gap points (owner, 2026-11-20): every gap flown through is worth 25-75 by how tight it is for the whoop, halved each time the same
// gap repeats in one combo, kept on its own line (gapBonus) so the TPW trick score is unchanged.
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim; let ok = 0, n = 0;
const check = (name, pass, got) => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(62)} ${got}`); };
const k = new S.ScoreKeeper(), qW = 0.082;
const a = k.gap({ obj: 1, name: 'Knife Slot 0.2 m opening', narrow: 0.2 }, qW), b = k.gap({ obj: 2, name: 'Alley 7', narrow: 3 }, qW), c = k.gap({ obj: 1, name: 'Knife Slot 0.2 m opening', narrow: 0.2 }, qW);
check('a slot ~2.4 whoops wide is worth the most', a.pts === S.GAP_MAX, `${a.label} +${a.pts}`);
check('a 3 m alley is worth the least', b.pts === S.GAP_MIN, `${b.label} +${b.pts}`);
check('the same gap again in the combo is halved', c.pts === Math.round(S.GAP_MAX / 2), `+${c.pts}`);
k.chainBreak(); const d = k.gap({ obj: 1, name: 'Knife Slot 0.2 m opening', narrow: 0.2 }, qW);
check('after the combo banks it is fresh again', d.pts === S.GAP_MAX, `+${d.pts}`);
check('kept off the trick score, added to the total', k.trickScore === 0 && k.total === k.gapBonus && k.gapBonus === a.pts + b.pts + c.pts + d.pts, `trick ${k.trickScore} total ${k.total}`);
check('names read as gaps', S.gapLabel('Trunk Gap 2') === 'Trunk Gap' && S.gapLabel('Rebar Gate 3 opening') === 'Rebar Gate Gap' && S.gapLabel('Bodega Door') === 'Bodega Door Gap', [S.gapLabel('Trunk Gap 2'), S.gapLabel('Rebar Gate 3 opening'), S.gapLabel('Bodega Door')].join(' / '));
console.log(`\n${ok}/${n} gap checks`);
