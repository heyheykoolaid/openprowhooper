// The community learner: what every pilot's flying teaches the detector, as one profile all games start from.
//   node tools/community.js <data folders or files…> [--write] [--min-pilots=2] [--rounds=3] [--out=community]
// Reads everything that comes in through the drop-offs (all of it untrusted: parsed as data, never run):
//   pro-whooper-flight/1          live flights: the trace, every call with its Watcher confidence, F flags (call wrong)
//                                 and Q flags (a trick was missed here)
//   pro-whooper-score/1           leaderboard runs (they carry a trace too)
//   pro-whooper-flight-labels/1   decided review labels: a pilot's own (1.0), a reviewer's on someone else's flight
//                                 (1.5), Judge-the-community votes (1.0, only where two voters agree)
// Evidence and weights (docs/DATA.md): decided labels as above; an F flag nobody reviewed 0.5 ("not that"); a Q flag
// nobody named 0.3 ("something here"); a call nobody flagged or reviewed 0.1 ("probably fine"); no single pilot may carry
// more than 6 labels' worth on one trick. Every flight is re-flown through the CURRENT detector with the CURRENT community
// profile, so the live evidence (what was called then) and the measured evidence (what the detector sees now) meet.
// The learner then tries, one notch at a time, the same knobs the in-game learner uses (looser only) and keeps a notch
// only if the weighted score goes up, no confirmed trick is lost, no rejected call comes back, and the gain comes from
// at least --min-pilots different pilots. It also TIGHTENS: a trick's Watcher-confidence floor rises when calls of it
// below that confidence were rejected by at least --min-pilots pilots and no confirmed call sits under it. Last guard: the
// synthetic benchmark (npm run bench) must not drop. Writes community/profile.json and community/REPORT.md with --write;
// the owner approves the change (the weekly job opens a pull request).
const fs = require('fs'), path = require('path'), cp = require('child_process');
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const FL = require('../src/flightlog.js'), S = globalThis.Sim;
const ROOT = path.join(__dirname, '..'), args = process.argv.slice(2), opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const WRITE = args.includes('--write'), MIN_P = +opt('min-pilots', 2), ROUNDS = +opt('rounds', 3), OUT = path.resolve(opt('out', path.join(ROOT, 'community')));
const W = { reviewer: 1.5, own: 1.0, judge: 1.0, flag: 0.5, q: 0.3, keep: 0.1, cap: 6 };
const files = []; const walk = p => { if (!fs.existsSync(p)) return; const st = fs.statSync(p); if (st.isDirectory()) { for (const f of fs.readdirSync(p)) if (f !== '.git') walk(path.join(p, f)); } else if (p.endsWith('.json')) files.push(p); };
args.filter(a => !a.startsWith('--')).forEach(walk);
const worlds = {}, worldOf = id => worlds[id] || (worlds[id] = (S.MAPS[id] || S.MAPS.playground).build());
const str = (v, n = 60) => typeof v === 'string' ? v.slice(0, n) : '';
// a pilot is their chosen name where they gave one (the same person flies from more than one browser, each with its own
// random id), else that id
const who = (name, id) => str(name, 30).trim().toLowerCase() || str(id) || '?';
const profilePath = path.join(OUT, 'profile.json'), readProfile = () => { try { return JSON.parse(fs.readFileSync(profilePath, 'utf8')); } catch { return null; } };
const NEUTRAL = { format: 'pro-whooper-community/1', learn: { tol: 0, rev: 0, crossBack: 0 }, floor: {} };

// ---------- 1. load everything into flights + evidence
async function load() {
  const flights = new Map(), labelFiles = [];
  for (const f of files) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; } if (!j || typeof j !== 'object') continue;
    const items = j.format === 'pro-whooper-telemetry-bundle/1' && Array.isArray(j.items) ? j.items.map(x => x && x.payload).filter(Boolean) : [j];
    for (const p of items) {
      if (p.format === 'pro-whooper-flight/1' && str(p.id) && p.trace && !flights.has(p.id)) flights.set(p.id, { id: p.id, pilot: who(p.name, p.pilot), name: str(p.name, 30), map: str(p.map, 20), camTilt: +p.camTilt || 20, profile: p.profile, trace: p.trace, events: Array.isArray(p.events) ? p.events : [], missed: Array.isArray(p.missed) ? p.missed : [], src: 'flight' });
      if (p.format === 'pro-whooper-score/1' && str(p.flight) && p.trace && !flights.has(p.flight)) flights.set(p.flight, { id: p.flight, pilot: who(p.name, p.pilot), name: str(p.name, 30), map: str(p.map, 20), camTilt: +p.camTilt || 20, profile: null, trace: p.trace, events: Array.isArray(p.events) ? p.events : [], missed: [], src: 'leaderboard' });
      if (p.format === 'pro-whooper-flight-labels/1' && str(p.flight) && Array.isArray(p.labels)) labelFiles.push(p);
    } }
  const runs = [];
  for (const fl of flights.values()) {
    let rows; try { rows = await FL.unpack(fl.trace); } catch { continue; } if (!Array.isArray(rows) || rows.length < 100) continue;
    const T0 = rows[0][0], T1 = rows[rows.length - 1][0], ev = [];
    // the pilot's pace from their Warm-up, without what their own reviews taught their game (that is theirs, not everyone's)
    const own = fl.profile && typeof fl.profile === 'object' ? { rate: fl.profile.rate, air: fl.profile.air } : null;
    const labelled = [];   // times covered by decided labels (live flags there are superseded)
    // decided labels: own reviews, reviewer labels, judge votes (votes are paired up below)
    const votes = [];
    for (const lf of labelFiles.filter(x => x.flight === fl.id)) for (const l of lf.labels) {
      if (!l || typeof l !== 'object' || l.undone || !(l.verdict === 'yes' || l.verdict === 'no') || !Number.isFinite(+l.t)) continue;
      const author = l.reviewer ? who(l.by, l.byId) : who(lf.name, lf.pilot), rev = !!l.reviewer || (author !== fl.pilot && author !== '?');
      // a review of a leaderboard run (anyone can open one) is a vote: it counts once a second pilot agrees. The owner's
      // Flight desk reviews are reviewer labels.
      const vote = !!l.judge || (rev && l.src === 'board');
      const a = Math.min(+l.repStart || +l.t, +l.t), b = Math.max(+l.repStart || +l.t, +l.t), actual = str(l.actual), target = str(l.target);
      if (a < T0 - 5 || b > T1 + 5) continue;
      const item = { a, b, author, custom: !!l.custom, actual, target, verdict: l.verdict, src: vote ? 'judge' : rev ? 'reviewer' : 'own' };
      if (vote) { votes.push(item); continue; }
      labelled.push([a - 1, b + 2]);
      if (actual && actual !== 'not a trick' && !l.custom) ev.push({ kind: 'want', name: actual, a, b, w: rev ? W.reviewer : W.own, author, src: item.src });
      if (l.verdict === 'no' && target && target !== actual) ev.push({ kind: 'not', name: target, a, b, w: rev ? W.reviewer : W.own, author, src: item.src });
      if (l.custom && actual) ev.push({ kind: 'custom', name: actual.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40), label: actual, a, b, author });
    }
    // judge votes count only where two different voters agree on the same call
    for (const v of votes) { if (v.used) continue; const agree = votes.filter(x => !x.used && x !== v && x.author !== v.author && Math.abs(x.b - v.b) < 1 && x.target === v.target && x.verdict === v.verdict && x.actual === v.actual);
      if (!agree.length) continue; v.used = true; agree.forEach(x => { x.used = true; }); const authors = [v.author, ...agree.map(x => x.author)].join('+'); labelled.push([v.a - 1, v.b + 2]);
      if (v.actual && v.actual !== 'not a trick') ev.push({ kind: 'want', name: v.actual, a: v.a, b: v.b, w: W.judge, author: authors, src: 'judge' });
      if (v.verdict === 'no' && v.target && v.target !== v.actual) ev.push({ kind: 'not', name: v.target, a: v.a, b: v.b, w: W.judge, author: authors, src: 'judge' }); }
    const covered = t => labelled.some(([a, b]) => t >= a && t <= b);
    // live evidence from the flight itself
    for (const e of fl.events) { if (!e || !Number.isFinite(+e.t) || covered(+e.t)) continue; const name = str(e.name);
      if (e.flagged) ev.push({ kind: 'not', name, a: +e.t0 || +e.t - 1.5, b: +e.t, w: W.flag, author: fl.pilot, src: 'F flag' }); }
    for (const m of fl.missed) if (m && Number.isFinite(+m.t) && !covered(+m.t)) ev.push({ kind: 'miss', t: +m.t, w: W.q, author: fl.pilot, src: 'Q flag' });
    runs.push({ id: fl.id, pilot: fl.pilot, name: fl.name, map: fl.map, src: fl.src, rows, world: worldOf(fl.map), camTilt: fl.camTilt, own, ev, live: fl.events, T0, T1 });
  }
  // a pilot may not carry more than W.cap labels' worth on any one trick
  const per = {}; for (const r of runs) for (const e of r.ev) if (e.kind === 'want' || e.kind === 'not') { const k = e.author + '|' + e.name; (per[k] = per[k] || []).push(e); }
  for (const list of Object.values(per)) { const tot = list.reduce((s, e) => s + e.w, 0); if (tot > W.cap) list.forEach(e => { e.w *= W.cap / tot; }); }
  return { runs, nFlights: flights.size, nLabelFiles: labelFiles.length };
}

// ---------- 2. re-fly and score
// Each run is re-flown in windows around its evidence and around anything a change of rules could touch (calls, big
// rotations nobody called): everything else in a flight cannot change a score.
function windowsOf(run, base) {
  const W0 = [];
  for (const e of run.ev) if (e.kind !== 'custom') W0.push(e.kind === 'miss' ? [e.t - 4, e.t + 2] : [e.a - 4, e.b + 2.5]);
  if (base) { for (const e of base.events) W0.push([e.t - 5, e.t + 1.5]); for (const k of base.loose) W0.push([k.a - 3, k.b + 2]); }
  W0.sort((x, y) => x[0] - y[0]); const out = [];
  for (const [a0, b0] of W0) { const a = Math.max(run.T0, a0), b = Math.min(run.T1, b0); const w = out[out.length - 1]; if (w && a <= w[1] + 1) w[1] = Math.max(w[1], b); else if (b > a) out.push([a, b]); }
  return out;
}
function fly(run, community, wins) {
  S.setCommunity(community); const events = [], toks = [];
  const Pr = S.TrickDetector.prototype, ft = Pr.finishTok;
  if (!wins) Pr.finishTok = function (k) { const n0 = this.toks.length; ft.call(this, k); if (this.toks.length > n0) toks.push(this.toks[n0]); };
  try {
    for (const [a, b] of wins || [[run.T0, run.T1]]) {
      const R = S.replayTrace(run.rows, { world: run.world, camTilt: run.camTilt, pilot: run.own, from: a, to: b, tail: 1.8, debug: false });
      for (const e of R.events) if (e.name !== 'near' && e.name !== 'Crash' && !events.some(x => x.name === e.name && Math.abs(x.t - e.t) < 0.3)) events.push({ name: e.name, t: e.t, conf: e.watch ? e.watch.conf : 1 });
    }
  } finally { Pr.finishTok = ft; }
  const T0 = run.rows[0][0], abs = toks.map(k => ({ ax: k.ax, raw: k.raw, a: k.t0 + T0, b: k.t1 + T0 }));
  const loose = abs.filter(k => k.raw >= 170 && !events.some(e => e.t >= k.a - 0.5 && e.t <= k.b + 3));
  return { events: events.sort((x, y) => x.t - y.t), loose };
}
function score(runs, flown, baseFlown) {
  const out = { value: 0, hit: 0, want: 0, wrong: 0, lostConfirmed: [], gainAuthors: new Set(), per: {}, hits: [] };
  const P = n => out.per[n] || (out.per[n] = { want: 0, hit: 0, not: 0, wrong: 0, calls: 0 });
  runs.forEach((run, i) => {
    const E = flown[i].events, B = baseFlown ? baseFlown[i].events : null, inSpan = (e, x) => e.t >= x.a - 0.7 && e.t <= x.b + 2.4, explained = new Set();
    for (const e of E) P(e.name).calls++;
    for (const x of run.ev) {
      if (x.kind === 'want') { out.want += x.w; P(x.name).want += x.w; const h = E.find(e => e.name === x.name && inSpan(e, x)); if (h) { explained.add(h); out.hit += x.w; out.value += x.w; P(x.name).hit += x.w; out.hits.push(x);
          if (B && !B.some(e => e.name === x.name && inSpan(e, x))) out.gainAuthors.add(x.author); }
        else if (B && B.some(e => e.name === x.name && inSpan(e, x)) && x.w >= 1) out.lostConfirmed.push(`${x.name} (${run.name || run.pilot})`); }
      if (x.kind === 'not') { P(x.name).not += x.w; const h = E.find(e => e.name === x.name && inSpan(e, x)); if (h) { explained.add(h); out.wrong += x.w; out.value -= 1.5 * x.w; P(x.name).wrong += x.w; } }
      if (x.kind === 'miss') { const h = E.find(e => Math.abs(e.t - x.t) < 3 && !(B && B.some(b => b.name === e.name && Math.abs(b.t - e.t) < 0.4))); if (h) { explained.add(h); out.value += x.w; out.gainAuthors.add(x.author); } }
    }
    if (B) {   // calls nobody spoke about: losing one that was called before costs a little; a brand-new one risks being wrong
      for (const b of B) if (!explained.has(b) && !E.some(e => e.name === b.name && Math.abs(e.t - b.t) < 0.4) && !run.ev.some(x => x.kind === 'not' && x.name === b.name && b.t >= x.a - 0.7 && b.t <= x.b + 2.4)) out.value -= W.keep;
      for (const e of E) if (!explained.has(e) && !B.some(b => b.name === e.name && Math.abs(b.t - e.t) < 0.4)) out.value -= 0.2;
    }
  });
  return out;
}

// ---------- 3. learn
const STEPS = [
  { key: 'tol', what: 'angle tolerance +10°', step: c => c.learn.tol < S.LEARN_MAX.tol && (c.learn.tol += 10) },
  { key: 'rev', what: 'short-reading rolls and flips +15°', step: c => c.learn.rev < S.LEARN_MAX.rev && (c.learn.rev += 15) },
  { key: 'crossBack', what: 'over/under pass may be 0.4 s earlier', step: c => c.learn.crossBack < S.LEARN_MAX.crossBack - 1e-6 && (c.learn.crossBack = +(c.learn.crossBack + 0.4).toFixed(2)) },
  ...['R', 'P', 'Y'].map(ax => ({ key: 'rate' + ax, what: { R: 'slower rolls count', P: 'slower flips and loops count', Y: 'slower yaw spins count' }[ax], step: c => { const r = (c.rate = c.rate || {}), cur = r[ax] || 360; if (cur <= 190) return false; r[ax] = Math.round(cur * 0.8); return true; } })),
  { key: 'air', what: 'more air allowed between segments', step: c => { const a = c.air || 0.45; if (a >= 0.85) return false; c.air = +(a + 0.15).toFixed(2); return true; } },
];
const clone = c => JSON.parse(JSON.stringify(c));
function bench(profile) {
  const tmp = path.join(require('os').tmpdir(), 'pw-community-' + process.pid + '.json'); fs.writeFileSync(tmp, JSON.stringify(profile));
  try { const o = cp.execFileSync(process.execPath, [path.join(ROOT, 'test', 'benchmark.js')], { env: { ...process.env, PW_COMMUNITY: tmp }, encoding: 'utf8', maxBuffer: 1 << 26 }); const m = /weighted score ([\d.]+)%/.exec(o); return m ? +m[1] : null; }
  catch { return null; } finally { try { fs.unlinkSync(tmp); } catch { /* gone */ } }
}

(async () => {
  const t0 = Date.now(), log = (...a) => process.stderr.write(a.join(' ') + '\n');
  const { runs, nFlights } = await load();
  const before = { ...NEUTRAL, ...(readProfile() || {}) }, cur0 = S.setCommunity(before) || S.setCommunity(NEUTRAL);
  const evAll = runs.flatMap(r => r.ev), pilotsFlying = new Set(runs.map(r => r.pilot)), authors = new Set(evAll.filter(e => e.kind === 'want' || e.kind === 'not').map(e => e.author));
  log(`community: ${runs.length} flights (${nFlights} found), ${pilotsFlying.size} pilots flying, ${authors.size} labelling; ${evAll.length} pieces of evidence`);
  // full re-fly with the current profile: the baseline, and where else a rule change could matter
  const full = runs.map((r, i) => { log(`  re-flying ${i + 1}/${runs.length} ${r.id}`); return fly(r, cur0, null); });
  runs.forEach((r, i) => { r.wins = windowsOf(r, full[i]); });
  const flyAll = c => runs.map(r => fly(r, c, r.wins)), base = flyAll(cur0);   // windowed like every candidate, so the comparison is fair
  const s0 = score(runs, base, base);
  let cur = clone(cur0), best = s0, flown = base; const changes = [], rejected = [];
  for (let round = 0; round < ROUNDS; round++) {
    let pick = null;
    for (const st of STEPS) { const cand = clone(cur); if (!st.step(cand)) continue;
      log(`  round ${round + 1}: trying ${st.what}`); const f = flyAll(cand), sc = score(runs, f, base);
      const ok = sc.value > best.value + 0.05 && sc.wrong <= best.wrong + 1e-9 && sc.lostConfirmed.length === 0;
      if (!ok) continue;
      if (sc.gainAuthors.size < MIN_P) { rejected.push(`${st.what}: helps ${[...sc.gainAuthors].join(', ') || 'nobody'} only (needs ${MIN_P} pilots)`); continue; }
      if (!pick || sc.value > pick.sc.value) pick = { st, cand, sc, f }; }
    if (!pick) break; cur = pick.cand; best = pick.sc; flown = pick.f; changes.push(pick.st.what);
  }
  // tighten: per-trick Watcher-confidence floors from rejected calls
  const floorNotes = []; cur.floor = { ...(cur.floor || {}) };
  { const byTrick = {};
    runs.forEach((run, i) => { for (const e of flown[i].events) { const T = byTrick[e.name] || (byTrick[e.name] = { bad: [], good: [], plain: [] }), sp = x => e.t >= x.a - 0.7 && e.t <= x.b + 2.4;
      const no = run.ev.find(x => x.kind === 'not' && x.name === e.name && sp(x)), yes = run.ev.find(x => x.kind === 'want' && x.name === e.name && sp(x));
      if (yes) T.good.push(e.conf); else if (no) T.bad.push({ c: e.conf, w: no.w, author: no.author }); else T.plain.push(e.conf); } });
    for (const [name, T] of Object.entries(byTrick)) { if (!T.bad.length) continue; const maxGood = T.good.length ? Math.min(...T.good) : 1;
      let pick = null; for (const f of [0.4, 0.5, 0.6, 0.7, 0.8]) { if (f > maxGood - 0.02) break; const dropped = T.bad.filter(b => b.c < f), who = new Set(dropped.map(b => b.author)); if (!dropped.length) continue;
        const gain = dropped.reduce((s, b) => s + b.w * 1.5, 0) - T.plain.filter(c => c < f).length * W.keep;
        if (gain > 0 && who.size >= MIN_P && (!pick || gain > pick.gain)) pick = { f, gain, n: dropped.length, who, plain: T.plain.filter(c => c < f).length };
        else if (gain > 0 && who.size < MIN_P) floorNotes.push(`${name} under ${Math.round(f * 100)}%: rejected by ${[...who].join(', ')} only (needs ${MIN_P} pilots)`); }
      if (pick && (cur.floor[name] || 0) < pick.f) { cur.floor[name] = pick.f; changes.push(`${name} needs ${Math.round(pick.f * 100)}% Watcher confidence (drops ${pick.n} rejected call${pick.n > 1 ? 's' : ''}, ${pick.plain} unreviewed)`); } } }
  // last guard: the synthetic benchmark must not drop
  let benchBefore = null, benchAfter = null;
  if (changes.length) { benchBefore = bench(cur0); benchAfter = bench(cur); if (benchBefore != null && benchAfter != null && benchAfter < benchBefore - 0.05) { changes.push(`REVERTED: benchmark fell ${benchBefore}% → ${benchAfter}%`); cur = clone(cur0); flown = base; best = s0; } }
  const after = score(runs, flown, base);
  // custom tricks several pilots named: what was measured, and a draft pattern for a rule
  const customs = {};
  runs.forEach((run, i) => { for (const x of run.ev.filter(e => e.kind === 'custom')) { const c = customs[x.name] || (customs[x.name] = { label: x.label, n: 0, authors: new Set(), toks: [] }); c.n++; c.authors.add(x.author);
    const R = (() => { const Pr = S.TrickDetector.prototype, ft = Pr.finishTok, tk = []; Pr.finishTok = function (k) { const n0 = this.toks.length; ft.call(this, k); if (this.toks.length > n0) tk.push(this.toks[n0]); };
      try { S.replayTrace(run.rows, { world: run.world, camTilt: run.camTilt, pilot: run.own, from: Math.max(run.T0, x.a - 1.5), to: x.b + 0.3, tail: 0.5, debug: false }); } finally { Pr.finishTok = ft; } return tk; })();
    const T0 = run.rows[0][0]; c.toks.push(R.filter(k => k.raw >= 60 && k.t1 + T0 > x.a - 0.3 && k.t0 + T0 < x.b + 0.3).map(k => `${k.ax}${k.dir > 0 ? '+' : '-'}${Math.round(k.raw / 45) * 45}${k.inv > k.n * 0.5 ? 'i' : ''}`).join(' ') || 'no rotation'); } });
  // ---------- report
  const pct = (h, w) => w ? Math.round(h / w * 100) + '%' : '—', names = [...new Set([...Object.keys(s0.per), ...Object.keys(after.per)])].filter(n => (s0.per[n] || {}).want || (s0.per[n] || {}).not).sort((a, b) => ((s0.per[b] || {}).want || 0) - ((s0.per[a] || {}).want || 0));
  const kinds = {}; for (const e of evAll) { const k = e.src || e.kind; kinds[k] = (kinds[k] || 0) + 1; }
  const L = [`# Community learning report`, ``, `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${runs.length} flights from ${pilotsFlying.size} pilot${pilotsFlying.size === 1 ? "" : "s"} · ${authors.size} pilot${authors.size === 1 ? "" : "s"} labelling · evidence: ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`, ``,
    `Weighted agreement: **${pct(s0.hit, s0.want)} → ${pct(after.hit, after.want)}** of labelled tricks found; rejected calls still made: ${s0.wrong.toFixed(1)} → ${after.wrong.toFixed(1)} (weighted).`, ``,
    `## Changes${changes.length ? '' : ' (none)'}`, ...changes.map(c => `- ${c}`), ...(benchBefore != null ? [``, `Benchmark (synthetic): ${benchBefore}% → ${benchAfter}%`] : []), ``,
    `## Held back (not enough pilots yet)`, ...(rejected.length || floorNotes.length ? [...rejected, ...floorNotes].map(x => `- ${x}`) : ['- nothing']), ``,
    `## Per trick (weighted)`, `| trick | labelled | found before | found after | rejected calls | still called |`, `|---|---|---|---|---|---|`,
    ...names.map(n => { const a = s0.per[n] || {}, b = after.per[n] || {}; return `| ${n} | ${(a.want || 0).toFixed(1)} | ${pct(a.hit || 0, a.want)} | ${pct(b.hit || 0, b.want)} | ${(a.not || 0).toFixed(1)} | ${(a.wrong || 0).toFixed(1)} → ${(b.wrong || 0).toFixed(1)} |`; }), ``,
    `## Custom tricks pilots named`, ...(Object.keys(customs).length ? Object.values(customs).sort((a, b) => b.authors.size - a.authors.size || b.n - a.n).map(c => `- **${c.label}** · ${c.n}× by ${c.authors.size} pilot${c.authors.size > 1 ? 's' : ''}${c.authors.size >= MIN_P ? ' · ready for a draft rule' : ''} · measured: ${[...new Set(c.toks)].slice(0, 6).join(' | ')}`) : ['- none yet']), ``,
    `## Still missed (the to-do list)`, ...(() => { const m = {}; runs.forEach((run, i) => { for (const x of run.ev.filter(e => e.kind === 'want')) if (!flown[i].events.some(e => e.name === x.name && e.t >= x.a - 0.7 && e.t <= x.b + 2.4)) { const k = `${x.name} → ${flown[i].events.filter(e => e.t >= x.a - 0.7 && e.t <= x.b + 2.4).map(e => e.name).join(' + ') || 'nothing'}`; m[k] = (m[k] || 0) + 1; } }); const e = Object.entries(m).sort((a, b) => b[1] - a[1]); return e.length ? e.map(([k, v]) => `- ${v}× ${k}`) : ['- nothing']; })(), ``,
    `Weights: reviewer ${W.reviewer}, own review ${W.own}, judge pair ${W.judge}, F flag ${W.flag}, Q flag ${W.q}, unreviewed call ${W.keep}; at most ${W.cap} per pilot per trick; changes need ${MIN_P} pilots. ${((Date.now() - t0) / 1000).toFixed(0)} s.`];
  const profile = { format: 'pro-whooper-community/1', updated: new Date().toISOString().slice(0, 10), learn: cur.learn, ...(cur.rate ? { rate: cur.rate } : {}), ...(cur.air ? { air: cur.air } : {}), floor: cur.floor || {},
    stats: { flights: runs.length, pilots: pilotsFlying.size, labellers: authors.size, evidence: evAll.length, found: [+(s0.hit / (s0.want || 1)).toFixed(3), +(after.hit / (after.want || 1)).toFixed(3)], changes } };
  console.log(L.join('\n'));
  if (WRITE) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(profilePath, JSON.stringify(profile, null, 1) + '\n'); fs.writeFileSync(path.join(OUT, 'REPORT.md'), L.join('\n') + '\n'); log(`wrote ${path.relative(process.cwd(), profilePath)} and REPORT.md`); }
})();
