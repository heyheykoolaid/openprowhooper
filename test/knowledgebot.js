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
{ const bad = S.libMo({ f: 'obj', x: [1], y: [1], z: [1], q: [0, 0, 0] }); check('bad motion data from outside is refused', bad === null, String(bad)); }
console.log(`\n${ok}/${n} knowledge bot checks`); process.exitCode = ok === n ? 0 : 1;
