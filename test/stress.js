// Stress tester: flies every scripted trick in src/maneuvers.js many times with seeded random variations (speed, loop
// size, floaty tops, rotation rates, approach angle, object incl. trees and the pilot, wobble) plus near-miss flights,
// and reports per-trick detection rate and what each trick gets confused with.
//   node test/stress.js [runsPerTrick=16] [--seed=1] [--only=Powerloop] [--json=report.json] [--quick]
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, M = globalThis.Maneuvers; const world = S.buildPlayground(); const fs = require('fs');
const args = process.argv.slice(2), opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const QUICK = args.includes('--quick'), N = +(args.find(a => /^\d+$/.test(a)) || (QUICK ? 5 : 16)), SEED = +(opt('seed') || 1), ONLY = opt('only');

const fly = m => M.detect(m, world);
const rows = [], confusion = {};
let seed = SEED * 100000;
for (const name of M.tricks) {
  if (ONLY && !name.includes(ONLY)) continue;
  const r = { trick: name, runs: 0, exact: 0, missed: 0, other: {}, objects: {}, fails: [] };
  for (let i = 0; i < N; i++) {
    const sd = ++seed, m = M.make(name, world, sd), ev = fly(m), names = ev.map(e => e.name);
    r.runs++; r.objects[m.object] = (r.objects[m.object] || 0) + 1;
    const ok = names.length === 1 && names[0] === name;
    if (ok) r.exact++; else {
      if (!names.length) r.missed++;
      const k = names.join(' + ') || 'nothing'; r.other[k] = (r.other[k] || 0) + 1;
      if (r.fails.length < 4) r.fails.push({ seed: sd, object: m.object, params: m.params, got: k });
    }
  }
  rows.push(r); confusion[name] = r.other;
}
const conf = [];
for (const [label, c] of Object.entries(M.CONFUSERS)) {
  if (ONLY && !label.includes(ONLY)) continue;
  let bad = 0, runs = 0; const seen = {};
  for (let i = 0; i < N; i++) { const m = c.make(world, M.rng(++seed)); const names = fly(m).map(e => e.name); runs++; const k = names.join(' + ') || 'nothing'; seen[k] = (seen[k] || 0) + 1; if (names.some(n => !c.ok.includes(n))) bad++; }
  conf.push({ label, runs, fooled: bad, seen });
}
rows.sort((a, b) => a.exact / a.runs - b.exact / b.runs);
const pct = (a, b) => (100 * a / b).toFixed(0).padStart(3) + '%';
console.log(`Stress test: ${N} randomised flights per trick (seed ${SEED})\n`);
for (const r of rows) {
  const objs = Object.entries(r.objects).map(([k, v]) => `${k}×${v}`).join(', ');
  console.log(`${r.exact === r.runs ? '✓' : '✗'} ${r.trick.padEnd(24)} ${pct(r.exact, r.runs)}  ${r.exact}/${r.runs}   ${objs}`);
  for (const [k, v] of Object.entries(r.other)) console.log(`      ${v}× read as: ${k}`);
  for (const f of r.fails.slice(0, 2)) console.log(`      e.g. seed ${f.seed} on ${f.object} ${JSON.stringify(f.params)} -> ${f.got}`);
}
console.log('\nNear-miss flights (only the plain open-air reading, or nothing, is acceptable):');
for (const c of conf) console.log(`${c.fooled ? '✗' : '✓'} ${c.label.padEnd(40)} fooled ${c.fooled}/${c.runs}   saw: ${Object.entries(c.seen).map(([k, v]) => `${k}×${v}`).join(', ')}`);
const tot = rows.reduce((s, r) => s + r.exact, 0), all = rows.reduce((s, r) => s + r.runs, 0), fooled = conf.reduce((s, c) => s + c.fooled, 0);
console.log(`\nOverall: ${tot}/${all} exact (${pct(tot, all).trim()}), near-misses fooled ${fooled}/${conf.reduce((s, c) => s + c.runs, 0)}`);
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ seed: SEED, runsPerTrick: N, rows, confusers: conf }, null, 1));
console.log(`STRESS ${tot}/${all} fooled ${fooled}`);
