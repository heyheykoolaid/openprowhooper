// Prop load against real Blackbox logs (owner, 2026-11-27, "2 and 3" after reading WebFPV): each long flight flown again with the
// log's own sticks, rates and PIDs, and the motors' rpm at each throttle (10 % bins) compared with the real eRPM; plus the roll /
// pitch / yaw step response. Variants are JSON: name -> tune keys on top of the game's props (propCt 1.31, propCq 1.8).
// First read (the owner's two Air65s, 9 flights): the game's props spin 33 % too fast at the same throttle (50 % throttle: 53k sim,
// 37k real), the gap growing with throttle; prop grip 1.7 with a figure of merit of 0.15 (prop load x6.8: props plus the motors'
// losses) brings it to 7 %, hovers at 29k (real 29-31k) and draws 3.9 A (real 3-4 A, so no drain factor). bum-darts (EVO motors)
// is left out: the sim's EVO numbers are off on their own.
//   node tools/propfit.js ['{"now":{},"fit":{"propCt":1.7,"propFM":0.15}}'] [--curves]
const R = require('path').join(__dirname, '..') + '/'; require(R+'src/tricks.js'); require(R+'src/sim.js'); require(R+'src/bbl.js'); require(R+'src/feelfit.js');
const S = globalThis.Sim, FF = globalThis.FeelFit, fs = require('fs'), path = require('path');
const files=[]; const walk=p=>{const st=fs.statSync(p); if(st.isDirectory()) for(const f of fs.readdirSync(p)) walk(path.join(p,f)); else if(/\.bbl$/i.test(p)) files.push(p);}; walk(R+'blackbox');
const specFor = file => { const bj = path.join(path.dirname(file), 'build.json'); try { const b = JSON.parse(fs.readFileSync(bj, 'utf8')); if (b.gameCraft) return { frame: b.gameCraft.frame, motor: b.gameCraft.motor, prop: b.gameCraft.prop, battery: b.gameCraft.battery, electronics: b.gameCraft.electronics }; } catch { }
  return /bum-darts/.test(file) ? S.PRESETS['Air65 + RCinPower EVO'] : S.PRESETS['Air65 Champion']; };
const V = JSON.parse(process.argv.slice(2).find(a => a.startsWith('{')) || '{"now":{},"logged load":{"propCt":1.7,"propCq":6.8}}'), CURVES = process.argv.includes('--curves');
const bins = s => { const b = {}; for (let i = 0; i < s.duty.length; i++) { const d = s.duty[i], r = s.rpm[i]; if (!(d > 0.1) || !isFinite(r)) continue; const k = Math.min(9, Math.floor(d * 10)); (b[k] = b[k] || []).push(r); } const o = {}; for (const k in b) if (b[k].length > 200) o[k] = b[k].reduce((a, c) => a + c, 0) / b[k].length; return o; };
const tot = {};
for (const file of files) { if (/bum-darts/.test(file)) continue; const spec = specFor(file);
  globalThis.BBL.decode(new Uint8Array(fs.readFileSync(file))).forEach(L => { const sp = FF.flightSpan(L); if (!sp || sp.secs < 20) return;
    const s = FF.series(L, { from: sp.from + 0.5, to: Math.min(sp.to, sp.from + 25) }); if (!s || !s.hasRpm) return;
    const base = S.importDiff(Object.entries(L.headers).map(([k, v]) => `H ${k}:${v}`).join('\n'), S.defaultTune()).tune, real = FF.measure(s);
    const rb = bins({ duty: s.duty, rpm: s.rpm.map(e => e * 100 / 7) });
    for (const [name, extra] of Object.entries(V)) { const sim = FF.simulate(s, { spec, tune: { ...base, propCt: 1.31, propCq: 1.8, ...extra } }), m = FF.measure(sim);
      const sb = bins({ duty: sim.duty, rpm: sim.rpm.map(w => w * 60 / 2 / Math.PI) }); let e = 0, n = 0; for (const k in rb) if (sb[k]) { e += Math.abs(sb[k] / rb[k] - 1); n++; }
      let c = 0; for (const k of [0, 1, 2]) { const a = real.axes[k].step, b = m.axes[k].step; if (a && b) c += Math.abs(b.t50 - a.t50) / a.t50 + Math.abs(b.over - a.over) / 40; c += Math.abs(m.axes[k].lag - real.axes[k].lag) / 10; }
      const T = tot[name] = tot[name] || { rpm: [], cost: [], hov: [], yaw: [], ax: [] }; T.ax.push([0,1,2].map(k => [m.axes[k].step?.t50, real.axes[k].step?.t50, m.axes[k].step?.over, real.axes[k].step?.over, m.axes[k].lag, real.axes[k].lag])); T.rpm.push(e / n); T.cost.push(c); T.hov.push((m.hover ?? NaN) - (real.hover ?? NaN));
      T.yaw.push(`${m.axes[2].step ? m.axes[2].step.t50.toFixed(1) : '-'}/${real.axes[2].step ? real.axes[2].step.t50.toFixed(1) : '-'}`);
      if (CURVES) console.log(path.basename(path.dirname(file)), 'real rpm by duty', Object.entries(rb).map(([k, v]) => `${k * 10}%:${(v / 1000).toFixed(1)}k`).join(' '), '| sim', Object.entries(sb).map(([k, v]) => `${k * 10}%:${(v / 1000).toFixed(1)}k`).join(' '));
    } }); }
const av = a => a.filter(Number.isFinite).reduce((x, y) => x + y, 0) / a.filter(Number.isFinite).length;
for (const [n, T] of Object.entries(tot)) console.log(n.padEnd(14), ['roll','pitch','yaw'].map((a,k)=>a+' t50 '+[0,1].map(j=>av(T.ax.map(r=>r[k][j])).toFixed(1)).join('/')+' over '+[2,3].map(j=>av(T.ax.map(r=>r[k][j])).toFixed(0)).join('/')+' lag '+[4,5].map(j=>av(T.ax.map(r=>r[k][j])).toFixed(1)).join('/')).join(' | '), 'rpm err', (av(T.rpm) * 100).toFixed(1) + '%', '| cost r/p/y', av(T.cost).toFixed(2), '| hover sim-real', av(T.hov).toFixed(1), '| yaw t50 sim/real', T.yaw.join(' '));
