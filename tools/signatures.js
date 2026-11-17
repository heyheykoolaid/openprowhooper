// What the data says, in one report: node tools/signatures.js <data folder or files…> [--json out.json] [--trick "Split-S"]
// Re-flies every shared flight (pro-whooper-flight/1, with any review labels that came for it) through the current
// detector and writes down the EVIDENCE behind every call and every pilot label: the rotations measured (axis, degrees,
// rate, upside-down), the object passes (over / under / gap, which object), and what the sticks did. Three tables:
//   1. Trick signatures: how each trick is really flown (medians and ranges), and how often pilots agreed with the call
//   2. Labelled but not called: what was measured in each stretch a pilot says was a trick: the to-do list for rules
//   3. Big moves nobody called: rotations of half a turn or more outside every call
// Everything it reads is untrusted data: parsed, replayed, never run.
const fs = require('fs'), path = require('path');
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const FL = require('../src/flightlog.js'), S = globalThis.Sim;
const args = process.argv.slice(2), opt = n => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; }, jsonOut = opt('json'), only = opt('trick');
const files = []; const walk = p => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f)); else if (p.endsWith('.json')) files.push(p); }; (args.length ? args : ['telemetry']).forEach(walk);
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; }, rng = a => { const s = a.filter(Number.isFinite); return s.length ? `${Math.round(Math.min(...s))}–${Math.round(Math.max(...s))}` : '—'; };
const worlds = {}, worldOf = id => worlds[id] || (worlds[id] = (S.MAPS[id] || S.MAPS.playground).build());
const tokStr = k => `${k.ax}${k.dir > 0 ? '+' : '-'}${Math.round(k.raw)}${k.inv > k.n * 0.5 ? 'i' : ''}`;
(async () => {
  const flights = new Map(), labels = [];
  for (const f of files) { let p; try { p = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; } if (!p || typeof p !== 'object') continue;
    if (p.format === 'pro-whooper-flight/1' && p.id && p.trace && !flights.has(p.id)) flights.set(p.id, p);
    if (p.format === 'pro-whooper-flight-labels/1' && Array.isArray(p.labels)) labels.push(p); }
  const sig = {}, missed = [], loose = [], perFlight = [];
  const S0 = n => sig[n] || (sig[n] = { calls: 0, yes: 0, no: 0, conf: [], deg: { R: [], P: [], Y: [] }, rate: { R: [], P: [], Y: [] }, inv: 0, pass: {}, stick: { roll: [], pitch: [], yaw: [] }, thrMin: [], thrMean: [], dur: [], exec: {} });
  for (const [id, p] of flights) {
    let rows; try { rows = await FL.unpack(p.trace); } catch { continue; } if (!Array.isArray(rows) || rows.length < 100) continue;
    const T0 = rows[0][0], toks = [], Pr = S.TrickDetector.prototype, ft = Pr.finishTok; let det;
    Pr.finishTok = function (k) { const n0 = this.toks.length; ft.call(this, k); if (this.toks.length > n0) toks.push(this.toks[n0]); };
    let R; try { R = S.replayTrace(rows, { world: worldOf(p.map), camTilt: p.camTilt, pilot: p.profile || null, debug: false, hook: d => { det = d; } }); } finally { Pr.finishTok = ft; }
    // crossings: replay again cheaply is not needed: the detector's own log is pruned, so collect from the events' time instead
    const crosses = []; { const Pr2 = S.TrickDetector.prototype, tc = Pr2.trackCrossings; Pr2.trackCrossings = function (d, t) { const n = this.crossLog.length; tc.call(this, d, t); for (let i = n; i < this.crossLog.length; i++) crosses.push({ t: this.crossLog[i].t + T0, kind: this.crossLog[i].kind, name: this.crossLog[i].name }); };
      try { S.replayTrace(rows, { world: worldOf(p.map), camTilt: p.camTilt, pilot: p.profile || null, debug: false }); } finally { Pr2.trackCrossings = tc; } }
    const evs = R.events.filter(e => e.name !== 'near' && e.name !== 'Crash'), abs = toks.map(k => ({ ...k, a: k.t0 + T0, b: k.t1 + T0 }));
    const sticks = (a, b) => { const o = { roll: 0, pitch: 0, yaw: 0, thrMin: 1, thrSum: 0, n: 0 }; for (const r of rows) { if (r[0] < a) continue; if (r[0] > b) break; o.roll = Math.max(o.roll, Math.abs(r[24] || 0)); o.pitch = Math.max(o.pitch, Math.abs(r[25] || 0)); o.yaw = Math.max(o.yaw, Math.abs(r[26] || 0)); o.thrMin = Math.min(o.thrMin, r[11]); o.thrSum += r[11]; o.n++; } return o; };
    const evidence = (a, b) => ({ toks: abs.filter(k => k.raw >= 60 && k.b > a - 0.15 && k.a < b + 0.15), pass: crosses.filter(c => c.t > a - 2.3 && c.t < b + 0.4), st: sticks(a, b) });
    const L = labels.filter(l => l.flight === id).flatMap(l => l.labels).filter(l => l && Number.isFinite(l.repStart) && Number.isFinite(l.t));
    const spans = [];
    for (const e of evs) { const a = (e.toks && e.toks.length ? Math.min(...e.toks.map(k => k.t0)) + T0 : e.t - 1.5), b = e.t, ev = evidence(a, b), s = S0(e.name); spans.push([a - 0.3, b + 0.3]);
      const lab = L.find(l => l.target === e.name && l.via === 'review' && Math.abs((l.gameSpan ? l.gameSpan[1] : l.t) - e.t) < 1.2);
      s.calls++; if (lab) { if (lab.verdict === 'yes') s.yes++; else if (lab.verdict === 'no') s.no++; } if (e.watch && Number.isFinite(e.watch.conf)) s.conf.push(e.watch.conf); s.exec[e.exec] = (s.exec[e.exec] || 0) + 1; s.dur.push(b - a);
      if (lab && lab.verdict === 'no') continue;   // a call the pilot rejected says nothing about how the trick is flown
      for (const ax of 'RPY') { const t = ev.toks.filter(k => k.ax === ax); if (t.length) { s.deg[ax].push(t.reduce((x, k) => x + k.raw, 0)); s.rate[ax].push(Math.max(...t.map(k => k.raw / Math.max(0.05, k.t1 - k.t0)))); } }
      if (ev.toks.some(k => k.inv > k.n * 0.5)) s.inv++; const pk = ev.pass.filter(c => c.kind !== 'G').map(c => c.kind).join('') || '—'; s.pass[pk] = (s.pass[pk] || 0) + 1;
      s.stick.roll.push(ev.st.roll * 100); s.stick.pitch.push(ev.st.pitch * 100); s.stick.yaw.push(ev.st.yaw * 100); s.thrMin.push(ev.st.thrMin * 100); s.thrMean.push(ev.st.n ? ev.st.thrSum / ev.st.n * 100 : NaN); }
    for (const l of L) { if (!l.actual || l.actual === 'not a trick' || l.verdict === 'unlabelled') continue; const a = Math.min(l.repStart, l.t), b = Math.max(l.repStart, l.t);
      const hit = evs.some(e => e.name === l.actual && e.t >= a - 0.7 && e.t <= b + 2.4); if (hit) continue; const ev = evidence(a, b), called = evs.filter(e => e.t >= a - 0.5 && e.t <= b + 2.2).map(e => e.name);
      missed.push({ flight: id, pilot: p.name || p.pilot, map: p.map, want: l.variant || l.actual, at: +(a - T0).toFixed(1), len: +(b - a).toFixed(1), timed: !!l.timed, tile: l.of ? `${l.order}/${l.of}` : '', toks: ev.toks.map(tokStr).join(' ') || 'no rotation', pass: ev.pass.map(c => `${c.kind}:${c.name}`).join(' ') || '—', sticks: `R${Math.round(ev.st.roll * 100)} P${Math.round(ev.st.pitch * 100)} Y${Math.round(ev.st.yaw * 100)} thr ${Math.round(ev.st.thrMin * 100)}–`, called: called.join(', ') || 'nothing' }); }
    for (const k of abs) if (k.raw >= 170 && !spans.some(([a, b]) => k.b > a && k.a < b)) loose.push({ flight: id, tok: tokStr(k), at: +(k.a - T0).toFixed(1), rate: Math.round(k.raw / Math.max(0.05, k.t1 - k.t0)) });
    perFlight.push({ id, pilot: p.name || p.pilot || '?', map: p.map, minutes: +((rows[rows.length - 1][0] - T0) / 60).toFixed(1), calls: evs.length, labels: L.length, errors: (p.summary && p.summary.errors) || [] });
  }
  const names = Object.keys(sig).filter(n => !only || n === only).sort((a, b) => sig[b].calls - sig[a].calls), r0 = v => v == null ? '—' : Math.round(v);
  console.log(`# What the data says\n${perFlight.length} flights, ${perFlight.reduce((s, f) => s + f.minutes, 0).toFixed(1)} minutes, ${perFlight.reduce((s, f) => s + f.calls, 0)} calls, ${perFlight.reduce((s, f) => s + f.labels, 0)} pilot labels.\n`);
  console.log('## 1. Trick signatures (how each trick is really flown)\n| trick | calls | pilot ✓ / ✗ | Watcher | roll ° | flip ° | yaw ° | fastest °/s | upside-down | passes | sticks R/P/Y % | throttle low / mean % |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const n of names) { const s = sig[n], top = Object.entries(s.pass).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, c]) => `${k}×${c}`).join(' ');
    console.log(`| ${n} | ${s.calls} | ${s.yes} / ${s.no} | ${s.conf.length ? med(s.conf).toFixed(2) : '—'} | ${r0(med(s.deg.R))} (${rng(s.deg.R)}) | ${r0(med(s.deg.P))} (${rng(s.deg.P)}) | ${r0(med(s.deg.Y))} (${rng(s.deg.Y)}) | ${r0(med([...s.rate.R, ...s.rate.P, ...s.rate.Y]))} | ${s.inv}/${s.calls} | ${top} | ${r0(med(s.stick.roll))}/${r0(med(s.stick.pitch))}/${r0(med(s.stick.yaw))} | ${r0(med(s.thrMin))} / ${r0(med(s.thrMean))} |`); }
  console.log(`\n## 2. Labelled by a pilot, not called by the game (${missed.length})\n| wanted | pilot · map | at | measured rotations | passes | sticks | game called | exact span |\n|---|---|---|---|---|---|---|---|`);
  for (const m of missed.filter(m => !only || m.want.startsWith(only))) console.log(`| ${m.want}${m.tile ? ' (tile ' + m.tile + ')' : ''} | ${String(m.pilot).slice(0, 14)} · ${m.map} | ${m.at}s +${m.len} | ${m.toks} | ${m.pass.slice(0, 80)} | ${m.sticks} | ${m.called} | ${m.timed ? 'yes' : 'no'} |`);
  const buckets = {}; for (const l of loose) { const k = l.tok.replace(/[+-]\d+/, m => (m[0] === '+' ? '' : '') + (Math.round(+m.slice(1) / 90) * 90)).replace(/[+-]/, ''); buckets[k] = (buckets[k] || 0) + 1; }
  console.log(`\n## 3. Big moves nobody called (${loose.length})\n${Object.entries(buckets).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}°×${c}`).join(' · ') || 'none'}`);
  const errs = perFlight.flatMap(f => f.errors.map(e => ({ ...e, flight: f.id }))); if (errs.length) console.log(`\n## Errors pilots' games reported (${errs.length})\n` + errs.map(e => `- ${String(e.m).slice(0, 120)} @ ${String(e.w).slice(0, 40)} ×${e.n} (${e.flight})`).join('\n'));
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ flights: perFlight, signatures: sig, missed, loose }, null, 1));
})();
