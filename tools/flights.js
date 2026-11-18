// Re-fly shared flight telemetry through the CURRENT detector and compare with what the game called at the time.
// usage: node tools/flights.js <file-or-folder>... [--verbose]
//   accepts pro-whooper-flight/1 files, pro-whooper-telemetry-bundle/1 files (Options → save as a file) and folders
//   (telemetry/ in the repo). Flights carry no pilot verdicts unless F/Q flags or review labels came with them, so this
//   reports CHANGES and DOUBTS, not right/wrong: calls that differ now, calls the Watcher was unsure of, flagged calls.
const fs = require('fs'), path = require('path');
const FL = require('../src/flightlog.js'); const { replayTrace } = require('../test/lib.js');
require('../src/maps.js'); const MAPS = globalThis.Sim.MAPS, worlds = {}, worldOf = (id, layout) => { const k = id + (layout ? JSON.stringify(layout) : ''); if (worlds[k]) return worlds[k]; const m = MAPS[id] ? id : 'playground'; globalThis.Sim.setMapEdits(m, layout && typeof layout === 'object' ? layout : null); try { return (worlds[k] = MAPS[m].build()); } finally { globalThis.Sim.setMapEdits(m, null); } };   // each flight is re-flown on the map it was flown on
try { globalThis.Sim.setCommunity(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'community', 'profile.json'), 'utf8'))); } catch { /* no community profile yet */ }   // re-fly as the game does
try { globalThis.Sim.setLibrary(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'library', 'library.json'), 'utf8'))); } catch { /* no trick library yet */ }
const args = process.argv.slice(2), verbose = args.includes('--verbose');
const files = []; const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f)); else if (p.endsWith('.json')) files.push(p); };
for (const a of args) if (!a.startsWith('--')) walk(a);
(async () => {
  const flights = [], labels = [];
  for (const f of files) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const items = j.format === 'pro-whooper-telemetry-bundle/1' ? j.items.map(x => x.payload) : [j];
    for (const p of items) { if (p.format === 'pro-whooper-flight/1') flights.push(p); if (p.format === 'pro-whooper-flight-labels/1') labels.push(p); } }
  if (!flights.length) { console.log('no flights found'); return; }
  const seen = new Set(), tally = {}; let secs = 0, changed = 0, calls = 0;
  const T = k => tally[k] = tally[k] || { then: 0, now: 0, lost: 0, gained: 0, unsure: 0, flagged: 0 };
  for (const p of flights) { if (seen.has(p.id)) continue; seen.add(p.id);
    const rows = await FL.unpack(p.trace), R = replayTrace(rows, { camTilt: p.camTilt, world: worldOf(p.map, p.summary && p.summary.layout) });
    const now = R.events.filter(e => e.name !== 'near' && e.name !== 'Crash').map(e => ({ name: e.name, t: e.t })), then = (p.events || []).filter(e => !e.maybe).map(e => ({ ...e }));
    secs += rows.length / p.trace.hz; calls += then.length;
    // pair calls of the same name within 1.5 s
    const used = new Set(), lost = [];
    for (const e of then) { T(e.name).then++; if (e.conf != null && e.conf < 0.7) T(e.name).unsure++; if (e.flagged) T(e.name).flagged++;
      const i = now.findIndex((x, k) => !used.has(k) && x.name === e.name && Math.abs(x.t - e.t) < 1.5); if (i >= 0) used.add(i); else { lost.push(e); T(e.name).lost++; } }
    const gained = now.filter((x, k) => !used.has(k)); for (const x of now) T(x.name).now++; for (const x of gained) T(x.name).gained++;
    changed += lost.length + gained.length;
    const lab = labels.filter(l => l.flight === p.id).flatMap(l => l.labels);
    console.log(`${p.started}  ${p.pilot}  ${p.map || 'playground'}  ${p.mode}  ${(rows.length / p.trace.hz).toFixed(0)} s  ${then.length} calls then, ${now.length} now` + (lost.length || gained.length ? `  · ${lost.length} no longer called, ${gained.length} new` : '') + (p.missed && p.missed.length ? `  · ${p.missed.length} "missed trick" flag(s)` : '') + (lab.length ? `  · ${lab.length} review labels` : ''));
    if (verbose || lost.length || gained.length) { for (const e of lost) console.log(`    − ${e.name} @${e.t.toFixed(1)}s (then: ${e.exec}${e.conf != null ? ', sure ' + Math.round(e.conf * 100) + '%' : ''}${e.flagged ? ', pilot flagged it wrong' : ''})`); for (const x of gained) console.log(`    + ${x.name} @${x.t.toFixed(1)}s`); }
    for (const m of p.missed || []) { const near = now.filter(x => x.t > m.t - 6 && x.t <= m.t + 0.6).map(x => x.name); console.log(`    ? pilot pressed Q at ${m.t.toFixed(1)}s — now called there: ${near.join(', ') || 'nothing'}`); }
  }
  console.log(`\n${seen.size} flights, ${(secs / 60).toFixed(1)} min, ${calls} calls at the time, ${changed} differ with the current detector`);
  const rows = Object.entries(tally).sort((a, b) => (b[1].lost + b[1].gained + b[1].flagged * 2 + b[1].unsure) - (a[1].lost + a[1].gained + a[1].flagged * 2 + a[1].unsure));
  console.log('\nper trick (most doubt first):'); for (const [k, v] of rows) console.log(`  ${k.padEnd(28)} then ${String(v.then).padStart(3)}  now ${String(v.now).padStart(3)}  lost ${v.lost}  new ${v.gained}  unsure ${v.unsure}  flagged ${v.flagged}`);
})();
