// The sim next to real Blackbox logs: every long flight in each log flown again with the same sticks, measured the same way
// (hover throttle, motor lag, axis lag and tracking, hover wobble and buzz), and what to change.
//   node tools/feelfit.js [file.bbl or folder…] [--preset="Air65 Racing"] [--shake=0] [--delay=0] [--motor=1] [--max=45] [--min=20]
// Default: every .bbl under blackbox/. The game's Tools & labs → Feel Lab does the same for one log.
require('../src/tricks.js'); require('../src/sim.js'); require('../src/bbl.js'); require('../src/feelfit.js');
const S = globalThis.Sim, FF = globalThis.FeelFit, fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const files = []; const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f)); else if (/\.bbl$|\.bfl$/i.test(p)) files.push(p); };
for (const a of args.filter(x => !x.startsWith('--'))) walk(a); if (!files.length) walk(path.join(__dirname, '..', 'blackbox'));
const preset = opt('preset') || 'Air65 Racing', tune = S.defaultTune(); tune.shake = +(opt('shake') ?? 0); tune.loopDelayMs = +(opt('delay') ?? 0); if (opt('motor')) tune.motorFeel = +opt('motor');
const minS = +(opt('min') || 20), maxS = +(opt('max') || 45), all = [];
const f1 = x => x == null ? '—' : (+x).toFixed(1);
for (const file of files) {
  const logs = globalThis.BBL.decode(new Uint8Array(fs.readFileSync(file)));
  logs.forEach((L, i) => { const sp = FF.flightSpan(L); if (!sp || sp.secs < minS) return;
    const r = FF.compare(L, { spec: S.PRESETS[preset], tune, maxSecs: maxS }); if (!r) return; all.push(r);
    const R = r.real, M = r.sim;
    console.log(`\n${path.basename(file)} log ${i}: ${f1(r.span.from)}–${f1(r.span.to)} s (${R.calm} s calm)`);
    console.log(`  hover motor      ${f1(R.hover)}%   sim ${f1(M.hover)}%`);
    console.log(`  motor dead time  ${f1(R.motorLag)} ms   sim ${f1(M.motorLag)} ms · step to 63 %: ${f1(R.motorRise)} ms   sim ${f1(M.motorRise)} ms`);
    ['roll', 'pitch', 'yaw'].forEach((a, k) => console.log(`  ${a.padEnd(6)} lag ${f1(R.axes[k].lag).padStart(5)} ms track err ${f1(R.axes[k].track).padStart(5)}%   sim ${f1(M.axes[k].lag).padStart(5)} ms ${f1(M.axes[k].track).padStart(5)}%   peak ${R.axes[k].peak}/${M.axes[k].peak} °/s`));
    console.log(`  unasked wobble   ${R.resid.map(f1).join(' / ')} °/s   sim ${M.resid.map(f1).join(' / ')} (2-20 Hz, gyro minus setpoint)`);
    console.log(`  buzz >40 Hz      ${R.buzz.map(f1).join(' / ')} °/s (real, unfiltered gyro; the sim draws it on the camera only)`);
    for (const s of r.suggest) console.log(`  → ${s.label}: ${s.now} → ${s.to}  (${s.why})`); });
}
if (all.length > 1) { const med = a => { const b = a.filter(x => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; }, sug = {};
  for (const r of all) for (const s of r.suggest) (sug[s.key] = sug[s.key] || []).push(s.to);
  console.log(`\nOver ${all.length} flights (medians): ` + Object.entries(sug).map(([k, v]) => `${k} → ${med(v)}`).join(' · ')); }
if (args.includes('--fit')) {   // a joint search for loop delay and shake over every long flight
  const preps = []; for (const file of files) globalThis.BBL.decode(new Uint8Array(fs.readFileSync(file))).forEach(L => { const sp = FF.flightSpan(L); if (sp && sp.secs >= minS) { const P = FF.prepare(L, { maxSecs: 30 }); if (P) preps.push(P); } });
  const grid = k => opt(k) ? opt(k).split(',').map(Number) : undefined, R = FF.fit(preps, { spec: S.PRESETS[preset], tune, delays: grid('delays'), shakes: grid('shakes') });
  console.log(`\nFit over ${preps.length} flights (best first):`); for (const r of R.rows.slice(0, 8)) console.log(`  loop delay ${r.loopDelayMs} ms · shake ${r.shake} · cost ${r.cost}`); }
