// Replay recorded flights through the CURRENT detector and compare with the pilot's labels.
// usage: node test/replay.js <session.json | all-reps.json> [--verbose]
const { replayTrace, loadLabels } = require('./lib.js'); const fs = require('fs');
const file = process.argv[2], verbose = process.argv.includes('--verbose');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const labels = loadLabels(data);
let ok = 0, n = 0; const per = {};
// whole-run sessions: replay once; per-rep files: replay each
const cache = new Map();
for (const l of labels) {
  let R = cache.get(l.rows); if (!R) { R = replayTrace(l.rows, { camTilt: l.camTilt }); cache.set(l.rows, R); }
  const got = R.events.filter(e => e.t >= l.repStart - 0.05 && e.t <= l.t + 0.05 && e.name !== 'near').map(e => e.name);
  const pass = l.verdict === 'yes' ? got.includes(l.target) : !got.includes(l.target);
  n++; if (pass) ok++;
  const p = per[l.target] = per[l.target] || { yes: 0, agree: 0, no: 0, rej: 0 }; if (l.verdict === 'yes') { p.yes++; if (pass) p.agree++; } else { p.no++; if (pass) p.rej++; }
  if (!pass || verbose) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${l.verdict.padEnd(3)} ${l.target.padEnd(28)} rep ${l.rep ?? '-'}  now→ ${got.join(', ') || 'nothing'}   (in game: ${(l.detected || []).join(', ') || 'nothing'})`);
    for (const x of R.debug.filter(x => x.tAbs >= l.repStart - 0.05 && x.tAbs <= l.t + 0.05)) console.log(`        ${String(x.result).padEnd(22)} rot ${x.toks || '—'} | passes ${x.cross || '—'}${x.near ? ' | ' + x.near : ''}`);
  }
}
console.log(`\n${ok}/${n} labels agree with the current detector`);
const rows = Object.entries(per).sort((a, b) => (a[1].agree / (a[1].yes || 1)) - (b[1].agree / (b[1].yes || 1)));
if (rows.length > 1) { console.log('\nper trick (worst first):'); for (const [k, v] of rows) console.log(`  ${k.padEnd(28)} detected ${v.agree}/${v.yes} confirmed reps${v.no ? ` · rejected ${v.rej}/${v.no} "not it" reps` : ''}`); }
process.exitCode = ok === n ? 0 : 1;
