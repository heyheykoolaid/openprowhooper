// The knowledge bot (Judge the Bot, src/maneuvers.js fromLibrary / blendWithLibrary): flights built from the trick library's
// confirmed examples, re-flown with small variations over a similar playground object or in open air. Checks that it flies,
// that it is tagged with where it came from, and that confirmed examples of the clearest tricks are still read as themselves.
// usage: node test/knowledgebot.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers, fs = require('fs'), path = require('path');
S.setLibrary(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'library', 'library.json'), 'utf8')));
const W = S.MAPS.playground.build(); let ok = 0, n = 0;
const check = (name, pass, got) => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(66)} ${got}`); };
const kb = MV.kbTricks(); check('the library has motion for a good number of tricks', kb.length >= 10, kb.length + ' tricks');
for (const name of ['Powerloop', 'Matty Flip', 'Inverted Yaw Spin']) { if (!kb.includes(name)) { check(`${name}: has library motion`, false, 'none'); continue; }
  let hit = 0, tot = 0; for (const ex of MV.kbExamples(name)) for (const seed of [3, 4]) { const m = MV.fromLibrary(name, W, seed * 101 + ex.i, { ex: ex.i }); if (!m) continue; tot++; if (MV.detect(m, W, ex.e.mo.ct).some(e => e.name === name)) hit++; }
  check(`${name}: library re-flights are called ${name}`, tot > 0 && hit / tot >= 0.8, `${hit}/${tot}`); }
{ const m = MV.knowledge('Powerloop', W, 7, { human: true }); check('a knowledge flight says where it came from', m && m.source === 'library' && Number.isInteger(m.ex), m ? m.source + ' ex ' + m.ex : 'none'); }
{ const noMo = MV.tricks.find(t => !MV.kbCan(t) && S.library.by[t]); const m = noMo ? MV.knowledge(noMo, W, 9, {}) : null;
  check('a scripted trick with library examples but no motion is blended to the library\'s pace', !noMo || (m && m.source === 'blend'), noMo ? `${noMo}: ${m ? m.source + ' ×' + m.params.time : 'none'}` : 'none needed'); }
{ const m = MV.knowledge('Trippy Spin x2', W, 5, {}); check('pole tricks are not flown from the library (they need their pole)', !m || m.source !== 'library', m ? m.source : 'scripted / none'); }
{ let n = 0, h = 0, hit = 0; for (const t of ['Powerloop', 'Matty Flip']) for (let sd = 1; sd < 25; sd++) { const m = MV.fromLibrary(t, W, sd, {}); if (!m || !m.inPlace) continue; n++; h += m.by ? 1 : 0; const e = MV.kbExamples(t).find(x => x.i === m.ex); if (MV.detect(m, W, e ? e.e.mo.ct : 20).some(c => c.name === t)) hit++; }
  check('on its own map an example is flown where the pilot flew it, and named', n > 3 && h === n && hit >= n * 0.8, `${hit}/${n} called, ${h} with a pilot name`); }
{ const ok0 = MV.kbExamples('Powerloop')[0].e.mo, m = S.libMo(Object.assign({}, ok0, { map: 'x<script>', by: 'a'.repeat(99), at: 'not a date', o: [1, 2, 1e9], yaw: 1 }));
  check('where / who / when from outside is cleaned', m && m.map === null && m.by === null && m.at === null && m.o === null && m.yaw === null, JSON.stringify(m && [m.map, m.by, m.at, m.o])); }
{ const bad = S.libMo({ f: 'obj', x: [1], y: [1], z: [1], q: [0, 0, 0] }); check('bad motion data from outside is refused', bad === null, String(bad)); }
console.log(`\n${ok}/${n} knowledge bot checks`); process.exitCode = ok === n ? 0 : 1;
