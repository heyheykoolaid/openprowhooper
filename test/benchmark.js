// The detector benchmark: every labelled flight we have, from every source, scored the same way.
// Per trick: recall (labelled reps it calls) and precision (its calls that were right), plus what it gets confused with.
// Sources and how much they count (docs/DATA.md): pilot-labelled real flights (Blackbox Replay, Video Review) 1.0,
// pilot-confirmed sim calibration 0.9, demo GIFs 0.8, Judge-the-Bot verdicts 0.7, the bot's own flights 0.4.
//   node test/benchmark.js [--bot=3] [--json=report.json] [files or folders…]   (default: calibration/, test/fixtures/)
const U = require('../tools/unify.js'), fs = require('fs'), path = require('path');
if (process.env.PW_WITNESS) globalThis.Sim.setWitness(JSON.parse(fs.readFileSync(process.env.PW_WITNESS, 'utf8')));   // the learned witness's vote
if (process.env.PW_LIBRARY) globalThis.Sim.setLibrary(JSON.parse(fs.readFileSync(process.env.PW_LIBRARY, 'utf8')));   // the trick library's votes in the Watcher
if (process.env.PW_COMMUNITY) globalThis.Sim.setCommunity(JSON.parse(fs.readFileSync(process.env.PW_COMMUNITY, 'utf8')));   // tools/community.js checks a candidate profile here
const args = process.argv.slice(2), opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const roots = args.filter(a => !a.startsWith('--')); if (!roots.length) roots.push(path.join(__dirname, '..', 'calibration'), path.join(__dirname, 'fixtures'));
const files = []; const walk = p => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) { for (const f of fs.readdirSync(p)) if (f !== 'demos') walk(path.join(p, f)); } else if (p.endsWith('.json')) files.push(p); };
roots.forEach(walk);
const eps = [];
for (const f of files) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; } eps.push(...U.episodes(j, path.relative(process.cwd(), f))); }
const demoDir = path.join(__dirname, '..', 'calibration', 'demos'); if (fs.existsSync(path.join(demoDir, 'cases.json'))) eps.push(...U.demoEpisodes(demoDir));
const nBot = +(opt('bot') ?? 2); if (nBot > 0) eps.push(...U.botEpisodes(nBot));
const T = {}, conf = {}, bySrc = {}; const tr = n => T[n] || (T[n] = { tp: 0, fn: 0, fp: 0, w: 0 });
for (const ep of eps) {
  let ev; try { ev = U.run(ep); } catch (e) { console.log('  ! could not replay', ep.name, e.message); continue; }
  const s = bySrc[ep.source] || (bySrc[ep.source] = { eps: 0, labels: 0, right: 0 }); s.eps++;
  for (const l of ep.labels) {
    const got = ev.filter(e => e.t >= (l.t0 ?? 0) - 0.3 && e.t <= (l.t1 ?? 1e9) + 1.0).map(e => e.name); s.labels++;
    if (l.actual) { const hit = got.includes(l.actual); const x = tr(l.actual); if (hit) x.tp += ep.trust; else { x.fn += ep.trust; const k = `${l.actual} → ${got.join(' + ') || 'nothing'}`; conf[k] = (conf[k] || 0) + 1; } x.w += ep.trust; if (hit) s.right++; }
    else if (!got.includes(l.detected)) s.right++;
    for (const g of got) if (g !== l.actual) { tr(g).fp += ep.trust; const k = l.actual ? `${l.actual} (+ extra ${g})` : `not ${l.detected || 'a trick'} → ${g}`; conf[k] = (conf[k] || 0) + 1; }
  }
}
const rows = Object.entries(T).map(([k, v]) => ({ trick: k, recall: v.tp / Math.max(1e-9, v.tp + v.fn), precision: v.tp / Math.max(1e-9, v.tp + v.fp), weight: v.w, ...v })).filter(r => r.weight > 0 || r.fp > 0).sort((a, b) => (a.recall * a.precision) - (b.recall * b.precision));
console.log(`Detector benchmark: ${eps.length} episodes from ${Object.keys(bySrc).length} sources (${Object.entries(bySrc).map(([k, v]) => `${k} ${v.eps}`).join(', ')})\n`);
console.log('trick'.padEnd(28), 'recall'.padStart(7), 'precision'.padStart(10), 'weight'.padStart(7));
for (const r of rows) console.log(r.trick.padEnd(28), (r.weight ? (r.recall * 100).toFixed(0) + '%' : '—').padStart(7), (r.tp + r.fp ? (r.precision * 100).toFixed(0) + '%' : '—').padStart(10), r.weight.toFixed(1).padStart(7));
const cs = Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 15); if (cs.length) { console.log('\nmost common misses / confusions:'); for (const [k, v] of cs) console.log(`  ${v}× ${k}`); }
const W = rows.reduce((a, r) => a + r.weight, 0), score = rows.reduce((a, r) => a + r.weight * r.recall * (r.tp + r.fp ? r.precision : 1), 0) / Math.max(1e-9, W);
console.log(`\nBENCHMARK weighted score ${(score * 100).toFixed(1)}% (recall × precision, weighted by trust and reps)`);
for (const [k, v] of Object.entries(bySrc)) console.log(`  ${k.padEnd(16)} ${v.right}/${v.labels} labels agree`);
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ at: new Date().toISOString(), score, rows, confusions: conf, sources: bySrc }, null, 1));
