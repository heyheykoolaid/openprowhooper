// The trick library: real examples of every trick, for the detector to compare moves against (see LIBRARY in src/sim.js).
//   node tools/library.js <data folders or files…> [--write] [--check] [--out=library]
// Examples come from
//   - the Tricktionary demo GIFs (calibration/demos/, measured camera rotation): THE reference for what each trick is,
//     weight 3 (scaled by how much of the clip could be tracked). The text descriptions say less than these.
//   - pilots' decided review labels on shared flights and leaderboard runs (tools/evidence.js): confirmed tricks are
//     examples (reviewer 1.5, own 1.0), rejected calls are counter-examples. Custom tricks pilots named are examples too.
// The library holds rotation curves and durations and an anonymous pilot number, and up to 6 confirmed examples per trick
// also carry their motion (`mo`: a few seconds of path, attitude and throttle, with the map, where on it, when and the pilot's
// chosen name: owner, 2026-11-19, all within the game) for the knowledge bot (Judge the Bot, src/maneuvers.js fromLibrary).
// --check re-flies every shared flight with the new library and reports the "maybe" calls it would make (and how many
// of them land on a trick a pilot labelled), plus a leave-one-out score of the library against itself.
const fs = require('fs'), path = require('path');
const { load, W, CONFIRM } = require('./evidence.js'); const S = globalThis.Sim;
const ROOT = path.join(__dirname, '..'), args = process.argv.slice(2), opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const OUT = path.resolve(opt('out', path.join(ROOT, 'library'))), WRITE = args.includes('--write'), CHECK = args.includes('--check');
const files = []; const walk = p => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) { for (const f of fs.readdirSync(p)) if (f !== '.git') walk(path.join(p, f)); } else if (p.endsWith('.json')) files.push(p); };
args.filter(a => !a.startsWith('--')).forEach(walk);
const log = (...a) => process.stderr.write(a.join(' ') + '\n');

// ---------- demo GIFs
function demoExamples() {
  const dir = path.join(ROOT, 'calibration', 'demos'), out = [], notes = [];
  let index = [], cases = []; try { index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); cases = JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8')).cases || []; } catch { return { out, notes: ['no demo data'] }; }
  for (const it of index) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, it.file), 'utf8')); } catch { continue; }
    const F = d.frames || [], ms = d.msPerFrame || it.msPerFrame || 40, hz = 1000 / ms, track = F.filter(r => Array.isArray(r)).length / Math.max(1, F.length);
    if (track < 0.55) { notes.push(`${it.trick}: only ${Math.round(track * 100)}% of frames tracked, left out`); continue; }
    // blurred frames (fast rotation) are null: fill each gap at the rate on either side of it
    const fr = F.map(r => Array.isArray(r) ? r.slice(0, 3) : null);
    for (let i = 0; i < fr.length; i++) if (!fr[i]) { let j = i; while (j < fr.length && !fr[j]) j++; const A = fr[i - 1] || fr[j] || [0, 0, 0], B = fr[j] || A; for (let k = i; k < j; k++) { const f = (k - i + 1) / (j - i + 1); fr[k] = [0, 1, 2].map(x => A[x] + (B[x] - A[x]) * f); } i = j; }
    // the trick: the frames cases.json names, else the busiest stretch of the clip (bursts joined across short air)
    const cs = cases.find(c => c.file === it.file); let a = 0, b = fr.length - 1;
    if (cs) [a, b] = cs.frames; else {
      const mag = fr.map(r => Math.hypot(...r) * hz), bursts = []; let cur = null;
      mag.forEach((m, i) => { if (m >= 60) { if (cur && i - cur.b <= Math.round(0.6 * hz)) { cur.b = i; cur.rot += m / hz; } else { cur = { a: i, b: i, rot: m / hz }; bursts.push(cur); } } });
      const top = bursts.sort((x, y) => y.rot - x.rot)[0]; if (!top) continue; a = top.a; b = top.b; }
    b = Math.min(b, fr.length - 1); a = Math.max(0, Math.min(a, b));
    // resample to the library's 25 Hz
    const seq = []; const N = Math.max(1, Math.round((b - a + 1) / (hz / 25)));
    for (let k = 0; k < N; k++) { const i0 = a + k * (hz / 25), i1 = a + (k + 1) * (hz / 25), s = [0, 0, 0]; for (let i = Math.floor(i0); i < Math.min(b + 1, Math.ceil(i1)); i++) { if (!fr[i]) continue; const ov = Math.min(i + 1, i1) - Math.max(i, i0); if (ov > 0) for (let x = 0; x < 3; x++) s[x] += fr[i][x] * ov; } seq.push(s); }
    const sig = S.libSig(seq, 25); if (!sig) { notes.push(`${it.trick}: no clear move found`); continue; }
    out.push({ t: it.trick, ...sig, ps: /open air/i.test(it.object || '') ? '' : undefined, w: +(3 * Math.min(1, track + 0.1)).toFixed(2), s: 'demo', obs: !/open air/i.test(it.object || '') });   // an open-air demo passed nothing; where an object was used the GIF can't say which way round
  }
  return { out, notes };
}
// ---------- a confirmed move's motion (the knowledge bot flies it: src/maneuvers.js fromLibrary). Heading-relative, from just
// before the move to just after, 25 Hz; never where on the map it was. Over an object: relative to where the flight first
// crossed that object's over/under line, with the object's heights, so the bot can fly it over any object.
const MO_PAD = 0.6;
function motionOf(rows, det, world, from, sig) {
  if (!sig || !sig.at) return null; const [A, B] = sig.at, t0 = from + A - MO_PAD, t1 = from + B + MO_PAD;
  const R = rows.filter(r => r[0] >= t0 - 0.05 && r[0] <= t1 + 0.05); if (R.length < 10) return null;
  const at = t => { let j = R.findIndex(r => r[0] >= t); if (j <= 0) j = Math.max(1, j < 0 ? R.length - 1 : 1); const a = R[j - 1], b = R[j], f = b[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0; const L = i => a[i] + (b[i] - a[i]) * f;
    let qw = L(4), qx = L(5), qy = L(6), qz = L(7); const n = Math.hypot(qw, qx, qy, qz) || 1; return { p: S.v3(L(1), L(2), L(3)), q: { w: qw / n, x: qx / n, y: qy / n, z: qz / n }, v: S.v3(L(21), L(22), L(23)), th: L(11) }; };
  // which object, if any: the one passed most during the move (as libSigOf counts passes)
  const pass = det.crossLog.filter(c => c.t >= A - 0.6 && c.t <= B + 0.3 && (c.kind === 'O' || c.kind === 'U')), cnt = {};
  for (const c of pass) cnt[c.obj] = (cnt[c.obj] || 0) + 1;
  const oid = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0], o = oid != null ? world.objs.find(x => String(x.id) === oid) : null;
  let origin, f, frame = 'open', un = 0, ov = 0;
  if (o && (o.obstacle || o.round)) { const c0 = pass.find(c => String(c.obj) === oid), s0 = at(from + c0.t); frame = 'obj';
    un = o.round ? o.round.under : o.obstacle.under; ov = o.round ? o.round.over : o.obstacle.over;
    if (!o.round && o.obstacle) { const { a, b } = o.obstacle, ab = S.v3(b.x - a.x, 0, b.z - a.z), L2 = ab.x * ab.x + ab.z * ab.z || 1, k = Math.max(0, Math.min(1, ((c0.p.x - a.x) * ab.x + (c0.p.z - a.z) * ab.z) / L2));
      origin = S.v3(a.x + ab.x * k, 0, a.z + ab.z * k); const nl = Math.sqrt(L2), nrm = S.v3(-ab.z / nl, 0, ab.x / nl); f = (s0.v.x * nrm.x + s0.v.z * nrm.z) >= 0 ? nrm : S.v3(-nrm.x, 0, -nrm.z); }
    else { origin = S.v3(c0.p.x, 0, c0.p.z); const vh = Math.hypot(s0.v.x, s0.v.z) || 1; f = S.v3(s0.v.x / vh, 0, s0.v.z / vh); } }
  else { const s0 = at(t0), vh = Math.hypot(s0.v.x, s0.v.z); origin = S.v3(s0.p.x, s0.p.y, s0.p.z);
    if (vh > 0.5) f = S.v3(s0.v.x / vh, 0, s0.v.z / vh); else { const fw = S.qrot(s0.q, S.v3(0, 0, -1)), fh = Math.hypot(fw.x, fw.z) || 1; f = S.v3(fw.x / fh, 0, fw.z / fh); } }
  const yawA = Math.atan2(-f.x, -f.z), Yi = S.qaxis(S.v3(0, 1, 0), -yawA);   // turns the heading back to -z
  const mo = { f: frame, x: [], y: [], z: [], q: [], th: [] }; if (frame === 'obj') { mo.un = +un.toFixed(2); mo.ov = +ov.toFixed(2); mo.on = String(o.name).slice(0, 60); }
  mo.o = [+origin.x.toFixed(2), +origin.y.toFixed(2), +origin.z.toFixed(2)]; mo.yaw = +yawA.toFixed(4);   // where on its map it was flown (owner, 2026-11-19: map position, time and name are fine to ship)
  for (let t = t0; t <= t1 + 1e-6; t += 1 / 25) { const s = at(t), d = S.qrot(Yi, S.v3(s.p.x - origin.x, s.p.y - origin.y, s.p.z - origin.z)); let q = S.qmul(Yi, s.q); if (q.w < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    mo.x.push(Math.round(d.x * 100)); mo.y.push(Math.round(d.y * 100)); mo.z.push(Math.round(d.z * 100)); mo.q.push(Math.round(q.x * 1e4), Math.round(q.y * 1e4), Math.round(q.z * 1e4)); mo.th.push(Math.round(Math.max(0, Math.min(1, s.th)) * 100)); }
  return S.libMo(mo) ? mo : null;
}
// ---------- pilots' labels
function flightExamples(runs) {
  const out = [], pid = {}, P = a => pid[a] || (pid[a] = String(Object.keys(pid).length + 1));
  for (const r of runs) {
    // each labelled stretch is re-flown through the detector itself, so the example is measured exactly as the game measures
    // a move live: rotation, up.y, the over/under/gap passes and the sticks (the detector's libSigOf)
    for (const e of r.ev) { if (e.kind !== 'want' && e.kind !== 'not' && e.kind !== 'custom') continue; if (e.inferred) continue; if (e.crashed) continue;   // graded "crash": the right trick, but not how it is flown   // a guessed 'no' is never a counter-example
      const from = Math.max(r.rows[0][0], e.a - 3.5), { det, events: rev } = S.replayTrace(r.rows, { world: r.world, camTilt: r.camTilt, from, to: e.b + 0.4, tail: 0, debug: false });   // the detector's clock starts at 0 at 'from'
      const sig = det.libSigOf(e.a - from - 0.25, e.b - from + 0.25); if (!sig) continue;
      const mo = e.kind === 'want' && e.botSrc !== 'library' ? motionOf(r.rows, det, r.world, from, sig) : null;
      if (mo) { mo.ct = Math.round(r.camTilt || 20); mo.map = r.map || null; mo.by = r.name || null; mo.at = r.started || null; mo.t = +(+e.a).toFixed(1); mo.hit = rev.some(x => x.name === e.name && x.t >= e.a - 1 && x.t <= e.b + 3) ? 1 : 0; }   // the pilot's camera tilt; whether today's detector called it on the original flight   // a knowledge-bot re-flight adds no new motion
      out.push({ x: e.kind === 'custom' || undefined, t: e.kind === 'custom' ? e.label : e.name, ...sig, w: e.kind === 'custom' ? W.own / CONFIRM : e.w, s: e.src === 'reviewer' ? 'reviewer' : 'pilot', neg: e.kind === 'not' || undefined, p: P(e.author), obs: undefined, mo }); }
  }
  return out;
}
(async () => {
  const t0 = Date.now();
  const { out: demos, notes } = demoExamples();
  const { runs } = await load(files);
  S.setLibrary({ format: 'pro-whooper-library/1', examples: [] });   // an empty library switches on the detector's library ear (libTick) for the re-flights
  const fl = flightExamples(runs), examples = [...demos, ...fl];
  // motion travels for at most MO_KEEP examples per trick (the heaviest, one pilot at a time round-robin): the knowledge bot
  // needs variety, not every rep, and the shipped library stays small
  { const MO_KEEP = 6, by = {}; for (const e of examples) if (e.mo) (by[e.t] || (by[e.t] = [])).push(e);
    for (const L of Object.values(by)) { { const top = Math.max(...L.map(e => e.w)); for (let i = L.length - 1; i >= 0; i--) if (L[i].w < top / 4) { L[i].mo = null; L.splice(i, 1); } }   /* far lighter than the best-attested example of the trick (a faint keep, a crowded tile): not flown as the game's knowledge (2026-11-22) */ L.sort((a, b) => (b.mo.hit || 0) - (a.mo.hit || 0) || b.w - a.w);   /* motion for the bot goes to examples the detector calls on their own flight first (2026-11-20: missed ones made Judge the Bot and Show me fly moves the game does not read) */ const per = {}, keep = new Set(); for (let round = 0; keep.size < MO_KEEP && round < L.length; round++) for (const e of L) { if (keep.size >= MO_KEEP) break; if (keep.has(e) || (per[e.p] || 0) > round) continue; per[e.p] = (per[e.p] || 0) + 1; keep.add(e); }
      for (const e of L) if (!keep.has(e)) e.mo = null; } }
  const lib = { format: 'pro-whooper-library/1', updated: new Date().toISOString().slice(0, 10), n: S.libSig ? 24 : 24, hz: 25, examples: examples.map(e => { const o = { t: e.t, d: e.d, c: e.c, u: e.u, w: e.w, s: e.s }; if (typeof e.ps === 'string') o.ps = e.ps; if (e.k) o.k = e.k; if (e.neg) o.neg = 1; if (e.p) o.p = e.p; if (e.x) o.x = 1; if (e.mo) o.mo = e.mo; return o; }) };
  const L = S.setLibrary(lib);
  // leave-one-out: does the nearest OTHER example of the same clip's trick come out on top?
  const loo = {}; let right = 0, tot = 0;
  for (const [i, e] of L.ex.entries()) { if (e.neg) continue; let best = null; for (const [j, x] of L.ex.entries()) { if (i === j || x.neg) continue; const dd = S.libDist(e, x) * (x.s === 'demo' ? 0.85 : 1); if (!best || dd < best.d) best = { d: dd, t: x.t }; }
    if (!best || L.by[e.t].pos < 2 || !L.by[e.t].sayable) continue; const k = loo[e.t] || (loo[e.t] = { n: 0, ok: 0, conf: {} }); k.n++; tot++; if (best.t === e.t) { k.ok++; right++; } else k.conf[best.t] = (k.conf[best.t] || 0) + 1; }
  const tricks = Object.entries(L.by).sort((a, b) => (b[1].demo - a[1].demo) || (b[1].pos - a[1].pos));
  const R = [`# Trick library`, ``, `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${L.ex.length} examples of ${tricks.length} tricks: ${demos.length} from the demo GIFs (the reference), ${fl.filter(e => !e.neg).length} confirmed by pilots, ${fl.filter(e => e.neg).length} counter-examples (calls pilots rejected).`, ``,
    `"Maybe" calls are made only for tricks with a demo GIF or confirmed examples from 2+ pilots (trusted below).`, ``,
    `Leave-one-out (each example's nearest other example is the same trick): **${tot ? Math.round(right / tot * 100) : 0}%** of ${tot}.`, ``,
    `| trick | demo | pilot examples | pilots | counter-examples | trusted | leave-one-out | mixed up with |`, `|---|---|---|---|---|---|---|---|`,
    ...tricks.map(([t, b]) => { const k = loo[t]; return `| ${t} | ${b.demo ? '✓' : ''} | ${b.pos - (b.demo ? 1 : 0)} | ${b.pilots.size} | ${b.neg} | ${b.trusted ? '✓' : ''} | ${k ? `${k.ok}/${k.n}` : '—'} | ${k ? Object.entries(k.conf).map(([n, c]) => `${n}×${c}`).join(', ') : ''} |`; }),
    ``, ...(notes.length ? ['Demo clips left out: ' + notes.join('; ')] : [])];
  if (CHECK) {   // what the library would do live: re-fly every shared flight with it and count the maybe calls
    log('checking: re-flying every flight with the library…'); let n = 0, hit = 0, wrong = 0; const per = {};
    for (const r of runs) { const Rr = S.replayTrace(r.rows, { world: r.world, camTilt: r.camTilt, pilot: r.own, debug: false });
      for (const m of Rr.maybes) { const off = m.t - m.at, a = m.t0 + off, b = m.t1 + off; n++; const k = per[m.name] || (per[m.name] = { n: 0, hit: 0, wrong: 0 }); k.n++;
        if (r.ev.some(x => x.kind === 'want' && x.name === m.name && b >= x.a - 0.7 && a <= x.b + 0.7)) { hit++; k.hit++; }
        else if (r.ev.some(x => (x.kind === 'want' || x.kind === 'not') && b >= x.a - 0.7 && a <= x.b + 0.7)) { wrong++; k.wrong++; } } }
    R.push('', `## Maybe calls on the shared flights`, `${n} maybe calls in ${runs.length} flights: ${hit} on a trick a pilot labelled as that trick, ${wrong} where a pilot labelled something else, ${n - hit - wrong} where nobody labelled anything.`, '',
      ...Object.entries(per).sort((a, b) => b[1].n - a[1].n).map(([t, k]) => `- ${t}: ${k.n} (${k.hit} right, ${k.wrong} wrong, ${k.n - k.hit - k.wrong} unlabelled)`));
  }
  R.push('', `${((Date.now() - t0) / 1000).toFixed(0)} s.`);
  console.log(R.join('\n'));
  if (WRITE) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'library.json'), JSON.stringify({ ...lib, stats: { examples: L.ex.length, demos: demos.length, tricks: tricks.length, trusted: tricks.filter(([, b]) => b.trusted).length, loo: tot ? +(right / tot).toFixed(3) : null } }) + '\n'); fs.writeFileSync(path.join(OUT, 'REPORT.md'), R.join('\n') + '\n'); log('wrote library/library.json and REPORT.md'); }
})();
