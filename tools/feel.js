// Game feel from shared flights: which physics sliders (Garage → Advanced), flight modes, radio-link and battery settings
// pilots really fly with, per pilot, per map and over time.  node tools/feel.js <data folder> [--json]
// Reads summary.feel (flights from 2026-11-17 on, with atStart when a slider moved during the run) and falls back to the
// tune every flight carries. Defaults are 1 (100%) for every slider; a pilot who moved one away and kept it is the signal.
const fs = require('fs'), path = require('path');
const root = process.argv[2]; if (!root) { console.log('usage: node tools/feel.js <data folder> [--json]'); process.exit(1); }
const KEYS = ['weightFeel', 'dragFeel', 'washFeel', 'motorFeel', 'sagFeel', 'groundFeel'], files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (f === '.git') continue; if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.json')) files.push(p); } })(root);
const rows = [];
for (const f of files) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  const items = j && j.format === 'pro-whooper-telemetry-bundle/1' && Array.isArray(j.items) ? j.items.map(x => x && x.payload) : [j];
  for (const p of items) { if (!p || p.format !== 'pro-whooper-flight/1' || p.mode === 'bot' || p.mode === 'replica') continue;
    const t = p.tune || {}, fe = (p.summary && p.summary.feel) || null, src = fe || t;
    if (!KEYS.some(k => k in src)) continue;   // flown before the sliders existed
    const v = {}; for (const k of KEYS) v[k] = Number.isFinite(+src[k]) ? +src[k] : 1;
    rows.push({ name: typeof p.name === 'string' ? p.name.slice(0, 24) : '?', map: String(p.map || 'playground').slice(0, 20), when: String(p.started || '').slice(0, 16), secs: p.summary ? +p.summary.armedSeconds || 0 : 0,
      v, mode: src.flightMode || t.flightMode || 'acro', battery: src.batteryLife ?? t.batteryLife ?? true, rc: src.rcSmooth || t.rcSmooth || 'sim', link: src.rcLinkHz || t.rcLinkHz || 0, delay: src.rcDelayMs || t.rcDelayMs || 0,
      craft: p.craft ? [p.craft.frame, p.craft.motor, p.craft.battery].join('/') : '?', changed: !!(fe && fe.atStart) }); } }
rows.sort((a, b) => a.when.localeCompare(b.when));
const pct = x => Math.round(x * 100) + '%', med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 1; };
const wmean = (rs, k) => { const w = rs.reduce((a, r) => a + Math.max(1, r.secs), 0); return rs.reduce((a, r) => a + r.v[k] * Math.max(1, r.secs), 0) / w; };
console.log(`${rows.length} flights with slider settings (${new Set(rows.map(r => r.name)).size} pilots)\n`);
console.log('ALL PILOTS (weighted by armed time)   ' + KEYS.map(k => `${k.replace('Feel', '')} ${pct(wmean(rows, k))}`).join('  '));
console.log('share of flights off the default      ' + KEYS.map(k => `${k.replace('Feel', '')} ${pct(rows.filter(r => Math.abs(r.v[k] - 1) > 0.01).length / Math.max(1, rows.length))}`).join('  '));
console.log('\nPER PILOT: latest setting (median over their flights) · flights · minutes');
const by = {}; for (const r of rows) (by[r.name] = by[r.name] || []).push(r);
for (const [n, rs] of Object.entries(by)) { const last = rs[rs.length - 1];
  console.log(`  ${n.padEnd(16)} ` + KEYS.map(k => `${k.replace('Feel', '').padEnd(6)} ${pct(last.v[k]).padStart(4)} (${pct(med(rs.map(r => r.v[k])))})`).join('  ') + `  · ${rs.length} · ${(rs.reduce((a, r) => a + r.secs, 0) / 60).toFixed(0)} min`);
  const modes = [...new Set(rs.map(r => r.mode))].join('/'), bat = rs.filter(r => r.battery === false).length, rc = [...new Set(rs.map(r => r.rc + (r.link ? ' ' + r.link + 'Hz' : '') + (r.delay ? ' ' + r.delay + 'ms' : '')))].join(', ');
  console.log(`  ${''.padEnd(16)} mode ${modes}; battery life off in ${bat}/${rs.length}; sticks ${rc}; craft ${[...new Set(rs.map(r => r.craft))].join(', ')}`); }
console.log('\nPER MAP (weighted)'); const bm = {}; for (const r of rows) (bm[r.map] = bm[r.map] || []).push(r);
for (const [m, rs] of Object.entries(bm)) console.log(`  ${m.padEnd(11)} ${String(rs.length).padStart(3)} flights  ` + KEYS.map(k => `${k.replace('Feel', '')} ${pct(wmean(rs, k))}`).join('  '));
console.log('\nOVER TIME (each change a pilot made, in order)');
for (const [n, rs] of Object.entries(by)) { let prev = null; for (const r of rs) { const s = KEYS.map(k => pct(r.v[k])).join(' '); if (s !== prev) console.log(`  ${r.when}  ${n.padEnd(16)} ${KEYS.map(k => k.replace('Feel', '') + ' ' + pct(r.v[k])).join('  ')}${r.changed ? '  (moved during the run)' : ''}`); prev = s; } }
if (process.argv.includes('--json')) fs.writeFileSync('feel.json', JSON.stringify(rows, null, 1));
