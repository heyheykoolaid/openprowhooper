// Training data for the learned witness, measured the way a live call is (owner, 2026-11-21): the trick library's pilot examples
// are cut over whole label tiles, a live call over the Watcher's own tight window, so a model trained on the first reads the
// second badly. This re-flies every decided label on the shared flights and takes, for the game's call at that moment, the
// signature of the WINDOW THE WATCHER JUDGED (`watch.t0..t1`): confirmed calls are positives, rejected calls the test; and it
// flies the bot's scripted tricks for clean examples of each. Only derived numbers leave (as in the library).
//   node tools/witness-data.js <data repo> [--bot=12] [--out=community/witness-train.json]
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const fs = require('fs'), path = require('path'), { load } = require('./evidence.js'); const S = globalThis.Sim, MV = globalThis.Maneuvers;
const ROOT = path.join(__dirname, '..'), args = process.argv.slice(2), opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'community', 'witness-train.json'))), BOT = +opt('bot', 12);
try { S.setLibrary(JSON.parse(fs.readFileSync(path.join(ROOT, 'library', 'library.json'), 'utf8'))); } catch { console.error('no library: the detector keeps no motion to cut from'); process.exit(1); }
const files = []; const walk = p => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) { for (const f of fs.readdirSync(p)) if (f !== '.git') walk(path.join(p, f)); } else if (p.endsWith('.json')) files.push(p); };
args.filter(a => !a.startsWith('--')).forEach(walk);
// every call carries the signature of its own Watcher window
const P = S.TrickDetector.prototype, emit0 = P.emit;
P.emit = function (ev) { if (ev && ev.watch && ev.watch.t0 != null && this.lib) { const s = this.libSigOf(ev.watch.t0 - 0.05, ev.watch.t1 + 0.05); if (s) ev.watch.sig = { c: s.c, u: s.u, d: s.d, ps: typeof s.ps === 'string' ? s.ps : null }; } return emit0.call(this, ev); };
const out = [], log = (...a) => process.stderr.write(a.join(' ') + '\n');
// the bot: clean examples of each scripted trick on the playground
{ const W = S.buildPlayground(); let n = 0;
  for (const name of MV.tricks) for (let k = 1; k <= BOT; k++) { let m = null; try { m = MV.make(name, W, k * 7919 + 13, { wobble: k % 3 ? 0.4 : 0 }); } catch { m = null; } if (!m) continue;
    const got = MV.detect(m, W, 20 + (k % 4) * 5), e = got.find(x => x.name === name); if (e && e.watch && e.watch.sig) { out.push({ t: name, ...e.watch.sig, w: 0.5, s: 'bot', kind: 'call', p: 'bot' }); n++; } }
  log(`bot: ${n} call-window examples of ${MV.tricks.length} tricks`); }
load(files).then(({ runs }) => {
  const pid = {}, Pn = a => pid[a] || (pid[a] = String(Object.keys(pid).length + 1)); let i = 0, nPos = 0, nNeg = 0, nSpan = 0;
  for (const r of runs) { i++; if (i % 20 === 0) log(`  ${i}/${runs.length} flights · ${nPos} confirmed calls, ${nNeg} rejected, ${nSpan} label spans`);
    for (const e of r.ev) { if ((e.kind !== 'want' && e.kind !== 'not') || e.inferred || e.crashed) continue;
      const from = Math.max(r.rows[0][0], e.a - 3.5); let R; try { R = S.replayTrace(r.rows, { world: r.world, camTilt: r.camTilt, from, to: e.b + 2.5, tail: 0.5, debug: false }); } catch { continue; }
      const call = R.events.filter(x => x.name === e.name && x.watch && x.watch.sig && x.t >= e.a - 1.5 && x.t <= e.b + 3).sort((a, b) => Math.abs(a.t - e.b) - Math.abs(b.t - e.b))[0];
      if (call) { out.push({ t: e.name, ...call.watch.sig, w: +e.w.toFixed(3), s: e.src, kind: 'call', neg: e.kind === 'not' ? 1 : undefined, p: Pn(e.author) }); if (e.kind === 'not') nNeg++; else nPos++; }
      else if (e.kind === 'want') { const s = R.det.libSigOf(e.a - from - 0.25, e.b - from + 0.25); if (s) { out.push({ t: e.name, c: s.c, u: s.u, d: s.d, ps: typeof s.ps === 'string' ? s.ps : null, w: +e.w.toFixed(3), s: e.src, kind: 'span', p: Pn(e.author) }); nSpan++; } }   // the game missed it: the pilot's own span
    } }
  fs.writeFileSync(OUT, JSON.stringify({ format: 'pro-whooper-witness-train/1', updated: new Date().toISOString().slice(0, 10), examples: out }));
  log(`wrote ${OUT}: ${out.length} examples (${out.filter(x => x.s === 'bot').length} bot, ${nPos} confirmed calls, ${nNeg} rejected calls, ${nSpan} label spans)`);
});
