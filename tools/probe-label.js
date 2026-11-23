// Prints what the detector measured around every decided label of one trick in a data folder (tokens, passes, calls, up.y and heading every 0.1 s).
// node tools/probe-label.js "<trick>" <data folder>   (private data: read it, never copy it into the repo)
const fs = require('fs'), path = require('path'); require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const FL = require('../src/flightlog.js'), S = globalThis.Sim;
const want = process.argv[2] || 'Barani', root = process.argv[3]; const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.json')) files.push(p); } })(root);
(async () => { const flights = new Map(), labs = []; for (const f of files) { let p; try { p = JSON.parse(fs.readFileSync(f, 'utf8'), globalThis.Sim && globalThis.Sim.canonReviver); } catch { continue; } const items = p.format === 'pro-whooper-telemetry-bundle/1' ? p.items.map(x => x.payload) : [p];
  for (const q of items) { if (q.format === 'pro-whooper-flight/1') flights.set(q.id, q); if (q.format === 'pro-whooper-flight-labels/1') labs.push(q); } }
  for (const lf of labs) for (const l of lf.labels) { if (!l || l.actual !== want || l.undone) continue; const p = flights.get(lf.flight); if (!p) continue; const rows = await FL.unpack(p.trace), T0 = rows[0][0];
    const W = (S.MAPS[p.map] || S.MAPS.playground).build(), toks = [], cr = [], Pr = S.TrickDetector.prototype, ft = Pr.finishTok, tc = Pr.trackCrossings;
    Pr.finishTok = function (k) { const n0 = this.toks.length; ft.call(this, k); if (this.toks.length > n0) toks.push(this.toks[n0]); };
    Pr.trackCrossings = function (d, t) { const n = this.crossLog.length; tc.call(this, d, t); for (let i = n; i < this.crossLog.length; i++) cr.push(this.crossLog[i]); };
    const R = S.replayTrace(rows, { world: W, camTilt: p.camTilt, pilot: p.profile || null }); Pr.finishTok = ft; Pr.trackCrossings = tc;
    const a = Math.min(l.repStart, l.t), b = Math.max(l.repStart, l.t);
    console.log(`\n== ${lf.flight} ${p.map} label ${a.toFixed(2)}..${b.toFixed(2)} (rel ${(a - T0).toFixed(2)}) verdict ${l.verdict} target ${l.target} via ${l.via} timed ${l.timed}`);
    for (const k of toks) if (k.t1 + T0 > a - 4 && k.t0 + T0 < b + 2) console.log(`tok ${k.ax}${k.dir > 0 ? '+' : '-'}${Math.round(k.raw)} ${k.inv > k.n * 0.5 ? 'INV' : ''} t ${(k.t0 + T0 - a).toFixed(2)}..${(k.t1 + T0 - a).toFixed(2)} inv ${k.inv}/${k.n}`);
    for (const c of cr) if (c.t + T0 > a - 4 && c.t + T0 < b + 2) console.log(`pass ${c.kind} ${c.name} t ${(c.t + T0 - a).toFixed(2)} ${JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => /up|fwd|dir|spd|lat|back|upright/.test(k))))}`);
    for (const e of R.events) if (e.t > a - 4 && e.t < b + 3) console.log(`call ${e.name} ${e.exec} t ${(e.t - a).toFixed(2)} conf ${e.watch && e.watch.conf}`);
    let s = ''; for (const r of rows) if (r[0] > a - 3 && r[0] < b + 1.5 && Math.round((r[0] - a) * 100) % 10 === 0) { const q = { w: r[4], x: r[5], y: r[6], z: r[7] }, up = S.qrot(q, S.v3(0, 1, 0)), fw = S.qrot(q, S.v3(0, 0, -1)); s += `${(r[0] - a).toFixed(1)}:u${up.y.toFixed(1)} f${Math.round(Math.atan2(-fw.x, -fw.z) * 57)} y${r[2].toFixed(1)}  `; } console.log(s);
  } })();
