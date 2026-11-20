// Review badges, the count before the relay started counting (owner, 2026-11-20: "sent reviews should count"; "reviews of your
// own runs count"). Every label file already sent (own reviews, reviewer labels, board votes, Judge the Bot verdicts) is read,
// and each pilot gets one review per decided moment (the same rule as the relay's `reviewMoments`: a ✓, ✗, correction or named
// added trick; undecided touches never count; one per second of one flight, however often it is re-sent). Written as
// community/badges.json (pro-whooper-badges/1): per pilot name, [time, n] for each file, so the game can add only what came
// before the relay's own count began (its `since`). Names only, no ids; build.py ships it as window.PW_BADGES.
// usage: node tools/badges.js <data repo> [--write]
const fs = require('fs'), path = require('path');
const root = process.argv[2], write = process.argv.includes('--write');
if (!root) { console.log('usage: node tools/badges.js <data repo> [--write]'); process.exit(1); }
const NAME = /^[A-Za-z0-9_. -]{2,24}$/;
// the same rules as tools/dropoff-worker.mjs (test/badges.js checks they agree)
const momentsOf = labels => { const out = new Set(); for (const l of Array.isArray(labels) ? labels : []) { if (!l || typeof l !== 'object' || l.undone || !(l.verdict === 'yes' || l.verdict === 'no') || !(typeof l.actual === 'string' && l.actual) || !Number.isFinite(+l.t)) continue; out.add(Math.round(+l.t)); } return [...out]; };
const nameOf = p => { const L = Array.isArray(p.labels) ? p.labels : [], by = (L.find(l => l && typeof l.by === 'string' && l.by) || {}).by || p.name; return typeof by === 'string' && NAME.test(by.trim()) ? by.trim() : null; };
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { if (f === '.git') continue; const p = path.join(d, f), s = fs.statSync(p); if (s.isDirectory()) walk(p); else if (f.endsWith('.json')) files.push(p); } })(root);
const out = {}, seen = new Set(); let nFiles = 0;
for (const f of files.sort()) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  const items = j && j.format === 'pro-whooper-telemetry-bundle/1' && Array.isArray(j.items) ? j.items.map(x => x && x.payload).filter(Boolean) : [j];
  for (const p of items) { if (!p || p.format !== 'pro-whooper-flight-labels/1' || typeof p.flight !== 'string') continue; const name = nameOf(p); if (!name) continue;
    const m = /(\d{13})-[0-9a-f]+\.json$/.exec(f), at = m ? +m[1] : Date.parse(p.started) || 0, k = name.toLowerCase(); let n = 0;
    for (const t of momentsOf(p.labels)) { const key = `${k}|${p.flight}|${t}`; if (seen.has(key)) continue; seen.add(key); n++; }
    if (!n) continue; nFiles++; const e = out[k] || (out[k] = [name, []]); e[0] = name; e[1].push([at, n]); } }
for (const e of Object.values(out)) e[1].sort((a, b) => a[0] - b[0]);
const rows = Object.values(out).map(([n, L]) => [n, L.reduce((s, x) => s + x[1], 0)]).sort((a, b) => b[1] - a[1]);
console.log(`${nFiles} label files from ${rows.length} pilots`); for (const [n, c] of rows) console.log(`  ${n.padEnd(24)} ${c}`);
if (write) { const doc = { format: 'pro-whooper-badges/1', at: new Date().toISOString(), n: out }; fs.writeFileSync(path.join(__dirname, '..', 'community', 'badges.json'), JSON.stringify(doc)); console.log('wrote community/badges.json'); }
