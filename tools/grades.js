// How tricks were flown: the game's grade (clean / sloppy / bump) next to the pilots' own (clean / sloppy / bump / crash), from every
// decided label that carries one. The crash column under the game's BUMP row is the list to tune the bump / crash line from
// (owner, 2026-11-21: "pretty crashy bumps, where you shouldn't get any points").  node tools/grades.js <data repo> [--list]
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js');
const fs = require('fs'), path = require('path'), { load } = require('./evidence.js');
const args = process.argv.slice(2), root = args.find(a => !a.startsWith('--')); if (!root) { console.log('node tools/grades.js <data repo> [--list]'); process.exit(1); }
const files = []; const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) { if (!path.basename(p).startsWith('.')) for (const f of fs.readdirSync(p)) walk(path.join(p, f)); } else if (p.endsWith('.json')) files.push(p); }; walk(root);
load(files).then(({ grades }) => {
  const G = ['CLEAN', 'SLOPPY', 'BUMP', 'CRASH'], rows = {}; for (const g of grades) { const r = rows[g.game || '(added)'] || (rows[g.game || '(added)'] = {}); r[g.pilot] = (r[g.pilot] || 0) + 1; }
  console.log(`${grades.length} graded labels\n\nthe game said   | pilots said: ${G.map(x => x.toLowerCase().padStart(7)).join('')}`);
  for (const [k, r] of Object.entries(rows)) console.log(`${k.padEnd(15)} |              ${G.map(x => String(r[x] || 0).padStart(7)).join('')}`);
  const cb = grades.filter(g => g.pilot === 'CRASH'); console.log(`\n${cb.length} graded crash` + (cb.length ? ': ' + Object.entries(cb.reduce((m, g) => (m[g.trick] = (m[g.trick] || 0) + 1, m), {})).map(([t, c]) => `${t} ${c}`).join(', ') : ''));
  if (args.includes('--list')) for (const g of cb) console.log(`  ${g.flight} @ ${g.t.toFixed(1)} s  ${g.trick}  (the game: ${g.game || 'no call'})  ${g.author}`);
});
