// Roll and pitch inertia against real Blackbox logs (owner, 2026-11-27: "let's do 1", after WebFPV's blackbox fit). Each long
// flight is flown again in the sim with the log's own sticks, rates, PIDs and feedforward (from its headers), with the roll / pitch
// inertia scaled (tune.inertiaFeel), and the step response (half way, overshoot) and lag are compared with the real quad's.
// Why not the open-loop fit (angular acceleration against the rpm-squared difference, as WebFPV does on a five inch): on these
// whoop logs it explains under a third of the acceleration (r² 0.03-0.27, against 0.8-0.99 on the sim's own flights), so the
// number it gives is noise. The closed loop is what a pilot feels anyway.
//   node tools/inertiafit.js [file.bbl or folder…] [--grid=0.7,0.85,1,1.2,1.4] [--min=20] [--max=40]
require('../src/tricks.js'); require('../src/sim.js'); require('../src/bbl.js'); require('../src/feelfit.js');
const S = globalThis.Sim, FF = globalThis.FeelFit, fs = require('fs'), path = require('path');
const args = process.argv.slice(2), opt = k => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const files = []; const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) for (const f of fs.readdirSync(p)) walk(path.join(p, f)); else if (/\.bbl$|\.bfl$/i.test(p)) files.push(p); };
for (const a of args.filter(x => !x.startsWith('--'))) walk(a); if (!files.length) walk(path.join(__dirname, '..', 'blackbox'));
const grid = (opt('grid') || '0.7,0.85,1,1.2,1.4').split(',').map(Number), minS = +(opt('min') || 20), maxS = +(opt('max') || 40), tot = {};
const specFor = file => { const bj = path.join(path.dirname(file), 'build.json'); try { const b = JSON.parse(fs.readFileSync(bj, 'utf8')); if (b.gameCraft) return { frame: b.gameCraft.frame, motor: b.gameCraft.motor, prop: b.gameCraft.prop, battery: b.gameCraft.battery, electronics: b.gameCraft.electronics }; } catch { }
  return /bum-darts/.test(file) ? S.PRESETS['Air65 + RCinPower EVO'] : S.PRESETS['Air65 Champion']; };
const cost = (real, sim) => { let c = 0; for (const k of [0, 1]) { const a = real.axes[k].step, b = sim.axes[k].step; if (a && b) c += Math.abs(b.t50 - a.t50) / a.t50 + Math.abs(b.over - a.over) / 40; c += Math.abs(sim.axes[k].lag - real.axes[k].lag) / 10; } return c; };
for (const file of files) { const spec = specFor(file), per = {};
  globalThis.BBL.decode(new Uint8Array(fs.readFileSync(file))).forEach(L => { const sp = FF.flightSpan(L); if (!sp || sp.secs < minS) return;
    const s = FF.series(L, { from: sp.from + 0.5, to: Math.min(sp.to, sp.from + maxS) }); if (!s) return;
    const base = S.importDiff(Object.entries(L.headers).map(([k, v]) => `H ${k}:${v}`).join('\n'), S.defaultTune()).tune, real = FF.measure(s);
    for (const g of grid) { const c = cost(real, FF.measure(FF.simulate(s, { spec, tune: { ...base, inertiaFeel: g } }))); (per[g] = per[g] || []).push(c); (tot[g] = tot[g] || []).push(c); } });
  const n = (per[grid[0]] || []).length; if (!n) continue;
  console.log(`${path.basename(file)} (${n} flights): ` + grid.map(g => `x${g} ${(per[g].reduce((a, b) => a + b, 0) / n).toFixed(2)}`).join('  ')); }
const best = grid.map(g => [g, tot[g] ? tot[g].reduce((a, b) => a + b, 0) / tot[g].length : Infinity]).sort((a, b) => a[1] - b[1]);
console.log(`\nAll flights: ` + best.map(([g, c]) => `x${g} ${c.toFixed(2)}`).join('  ') + `\nBest roll / pitch inertia: x${best[0][0]} of the sim's own (lower cost = closer to the real step response and lag)`);
