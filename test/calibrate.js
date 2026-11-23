// Calibration report: for every confirmed rep, what the detector measured (raw rotations, obstacle passes,
// taps, stalls, rewinds, orbits) and what it decided — then per-trick ranges to tune the rules against.
// usage: node test/calibrate.js <session.json | all-reps.json> [trick name filter]
const { replayTrace, loadLabels } = require('./lib.js'); const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'), globalThis.Sim && globalThis.Sim.canonReviver); const only = process.argv[3];
const labels = loadLabels(data).filter(l => l.verdict === 'yes' && (!only || l.target.toLowerCase().includes(only.toLowerCase())));
const byTrick = {};
for (const l of labels) {
  const raw = [];
  const R = replayTrace(l.rows, { camTilt: l.camTilt, from: l.repStart - 1.5, to: l.t + 0.1, tail: 1.6, hook: det => {
    const ft = det.finishTok.bind(det); det.finishTok = k => { const c = det.cur[k]; if (c && c.raw >= 45) raw.push({ ax: c.ax, dir: c.dir, raw: c.raw, dur: c.t1 - c.t0, rate: c.rateSum / c.n, inv: c.inv / c.n, t0: c.t0 }); ft(k); }; } });
  const det = R.det, w0 = l.repStart - 1.5;
  const rep = {
    rep: l.rep, got: R.events.filter(e => e.name !== 'near' && e.t >= l.repStart - 0.05).map(e => e.name), near: R.events.filter(e => e.name === 'near').map(e => e.near),
    rot: raw.filter(x => x.t0 >= w0).map(x => `${x.ax}${x.dir > 0 ? '+' : '-'}${Math.round(x.raw)}°/${x.dur.toFixed(2)}s@${Math.round(x.rate)}°/s${x.inv > 0.5 ? 'i' : ''}`),
    passes: det.crossLog.filter(c => c.t >= w0).map(c => `${c.name}:${c.kind}${c.dir > 0 ? '→' : '←'} spd${(c.spd ?? 0).toFixed(1)} ${c.kind === 'G' ? 'roll' + (c.rollAbs ?? 0).toFixed(2) : `fwd${(c.fwdDot ?? 0).toFixed(2)} lat${(c.latDot ?? 0).toFixed(2)} up${(c.upY ?? 0).toFixed(2)}`}`),
    taps: det.taps.filter(x => x.t >= w0).map(x => `${x.name}:${x.face}/${x.surface}@${x.impact.toFixed(1)}m/s`),
    stalls: det.stalls.filter(x => x.t >= w0).map(x => `climb ${x.climb.toFixed(1)}m apex ${x.yApex.toFixed(1)}m`),
    rewinds: det.rewinds.filter(x => x.t1 >= w0).map(x => `stop ${(x.t1 - x.t0).toFixed(2)}s`),
    orbits: det.orbSegs.filter(x => x.t1 >= w0).map(x => `${x.name} ${Math.round(x.acc)}° inv${x.inv.toFixed(2)} view${x.view.toFixed(2)} top${x.top.toFixed(2)} roll${Math.round(x.roll)}`),
  };
  (byTrick[l.target] = byTrick[l.target] || []).push(rep);
}
for (const [trick, reps] of Object.entries(byTrick)) {
  const hit = reps.filter(r => r.got.includes(trick)).length;
  console.log(`\n=== ${trick} — detected ${hit}/${reps.length}`);
  for (const r of reps) {
    console.log(`  rep ${r.rep}: ${r.got.includes(trick) ? '✓' : '✗'} got [${r.got.join(', ') || 'nothing'}]${r.near.length ? ' near: ' + r.near.join(' / ') : ''}`);
    console.log(`     rotations: ${r.rot.join('  ') || '—'}`);
    if (r.passes.length) console.log(`     passes:    ${r.passes.join('  ')}`);
    for (const [k, v] of [['taps', r.taps], ['stalls', r.stalls], ['rewinds', r.rewinds], ['orbits', r.orbits]]) if (v.length) console.log(`     ${k.padEnd(10)} ${v.join('  ')}`);
  }
}
