// Every piece of evidence pilots have sent, as runs to re-fly: shared by tools/community.js and tools/library.js.
// load(files) reads pro-whooper-flight/1, pro-whooper-score/1 (leaderboard runs) and pro-whooper-flight-labels/1 (also
// inside telemetry bundles) and returns runs: { id, pilot, map, rows, world, camTilt, own (Warm-up pace), ev, live, T0, T1 }
// with ev = [{ kind: want | not | miss | custom, name, a, b, w, author, src }]. All of it is untrusted: parsed, never run.
const fs = require('fs');
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); const FL = require('../src/flightlog.js'), S = globalThis.Sim;
// Labels are weights, never verdicts that settle a question alone (owner, 2026-11-18: whoops make a lot of motion that looks
// like a trick and isn't, and pilots skip things): a decided label counts by who gave it; a label nobody actually decided
// (`inferred`, e.g. Judge the Bot's 'other calls in a one-trick flight') counts barely more than an unreviewed call; anything
// unreviewed is not a 'no' at all (keep: a faint reason to keep what was called).
const REVIEWER_TRUST_UNTIL = Date.parse('2026-11-20T00:00:00Z');   // reviewer labels the relay stored before signed owner reviews
// reviewer / own / judge / replica / inferred: one voice's weight inside a pooled moment (consensus below). flag / q / keep are one
// pilot's word that nobody else confirms, so they carry a lone voice's third (0.5, 0.3, 0.1 before 2026-11-20), and the cap
// is 6 lone labels' worth: every ratio between kinds of evidence stays what it was for evidence from one person.
const W = { reviewer: 1.5, own: 1.0, judge: 1.0, replica: 0.5, flag: 0.5 / 3, q: 0.3 / 3, inferred: 0.15, keep: 0.1 / 3, cap: 2 };
// Consensus (owner, 2026-11-20: "a label requires 3 confirmations now … the decision is still a weight itself … everything averages
// and balances out"): every decided label on one moment of one flight (own, reviewer, board vote, bot verdict) is pooled per trick
// name: (yes weight − no weight) / the people who judged it, times a ramp that reaches full at CONFIRM different people (1 person
// 1/3, 2 people 2/3). A 2-1 split is a weak yes, never a tie; a lone label still counts, a third of what three agreeing would.
const CONFIRM = 3, MOMENT = 1.5;   // MOMENT: labels whose ends lie within 1.5 s of each other are about the same moment
const worlds = {}, worldOf = (id, layout, official) => { const k = id + (layout ? JSON.stringify(layout) : '') + (official ? '|' + JSON.stringify(official) : ''); if (worlds[k]) return worlds[k]; const m = S.MAPS[id] ? id : 'playground', was = S.officialEdits(m); S.setMapEdits(m, layout && typeof layout === 'object' ? layout : null); if (official !== undefined) S.setOfficialEdits(m, official && typeof official === 'object' ? official : null); try { return (worlds[k] = S.MAPS[m].build()); } finally { S.setMapEdits(m, null); S.setOfficialEdits(m, was); } };   // a flight flown on a pilot's own layout (Map Editor) carries it in summary.layout
const str = (v, n = 60) => typeof v === 'string' ? v.slice(0, n) : '';
// a pilot is their chosen name where they gave one (the same person flies from more than one browser, each with its own
// random id), else that id
const who = (name, id) => str(name, 30).trim().toLowerCase() || str(id) || '?';
// consensus per moment and trick (CONFIRM above): one voice per person (their latest), pooled as a weight. votes = decided labels
// on one flight: { a, b, author, actual, target, verdict, src, wYes, wNo, inferred }
function consensus(votes) {
  const out = [];
    votes.sort((x, y) => x.b - y.b); const moments = [];
    for (const v of votes) { const m = moments.find(m => Math.abs(m.b - v.b) < MOMENT); if (m) m.items.push(v); else moments.push({ b: v.b, items: [v] }); }
    for (const m of moments) {
      const names = new Set(); for (const v of m.items) { if (v.actual && v.actual !== 'not a trick') names.add(v.actual); if (v.verdict === 'no' && v.target && v.target !== v.actual) names.add(v.target); }
      for (const name of names) {
        const say = new Map();   // author → their latest word on this trick here
        for (const v of m.items.slice().sort((x, y) => (x.at || 0) - (y.at || 0))) { const yes = v.actual === name, no = v.verdict === 'no' && v.target === name && v.actual !== name; if (yes || no) say.set(v.author, { v, yes }); }
        const all = [...say.values()]; if (!all.length) continue;
        const pro = all.filter(x => x.yes).reduce((s, x) => s + x.v.wYes, 0), con = all.filter(x => !x.yes).reduce((s, x) => s + x.v.wNo, 0);
        const people = all.filter(x => x.yes || !x.v.inferred).length, ramp = Math.min(1, people / CONFIRM), net = ramp * (pro - con) / all.length;
        if (Math.abs(net) < 1e-6) continue;   // an even split: nothing either way until someone else judges it
        const side = all.filter(x => x.yes === net > 0), lead = side.reduce((p, x) => (x.yes ? x.v.wYes : x.v.wNo) > (p.yes ? p.v.wYes : p.v.wNo) ? x : p, side[0]).v;
        const srcs = side.map(x => x.v.src), src = srcs.includes('reviewer') ? 'reviewer' : srcs.includes('bot') ? 'bot' : srcs.includes('own') ? 'own' : 'judge';
        const common = { name, a: lead.a, b: lead.b, w: Math.abs(net), author: lead.author, authors: [...say.keys()], people, agree: side.length, src, consensus: +(net / ramp).toFixed(3) };
        if (net > 0) out.push({ kind: 'want', ...common });
        else out.push({ kind: 'not', ...common, inferred: side.every(x => x.v.inferred) || undefined });
      }
    }
  return out;
}
async function load(files) {
  const flights = new Map(), labelFiles = [];
  for (const f of files) { let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; } if (!j || typeof j !== 'object') continue;
    const items = j.format === 'pro-whooper-telemetry-bundle/1' && Array.isArray(j.items) ? j.items.map(x => x && x.payload).filter(Boolean) : [j];
    for (const p of items) {
      if (p.format === 'pro-whooper-flight/1' && str(p.id) && p.trace && !flights.has(p.id)) flights.set(p.id, { id: p.id, layout: p.summary && typeof p.summary === 'object' ? p.summary.layout || null : null, official: p.summary && typeof p.summary === 'object' && p.summary.official ? p.summary.official : undefined, replica: p.mode === 'replica' ? !!(p.summary && p.summary.replica && p.summary.replica.faithful === true) : null, botSrc: p.summary && p.summary.bot && typeof p.summary.bot.source === 'string' ? p.summary.bot.source : null, pilot: who(p.name, p.pilot), name: str(p.name, 30), map: str(p.map, 20), started: str(p.started, 30), camTilt: +p.camTilt || 20, profile: p.profile, trace: p.trace, events: Array.isArray(p.events) ? p.events : [], missed: Array.isArray(p.missed) ? p.missed : [], src: 'flight' });
      if (p.format === 'pro-whooper-score/1' && str(p.flight) && p.trace && !flights.has(p.flight)) flights.set(p.flight, { id: p.flight, pilot: who(p.name, p.pilot), name: str(p.name, 30), map: str(p.map, 20), camTilt: +p.camTilt || 20, profile: null, trace: p.trace, events: Array.isArray(p.events) ? p.events : [], missed: [], src: 'leaderboard' });
      if (p.format === 'pro-whooper-flight-labels/1' && str(p.flight) && Array.isArray(p.labels)) { const m = /[\\/]inbox[\\/](?:.*[\\/])?(\d{12,14})-[0-9a-f]+\.json$/.exec(f);
        labelFiles.push({ ...p, _inbox: /[\\/]inbox[\\/]/.test(f), _relayAt: m ? +m[1] : null }); }
    } }
  const runs = [];
  for (const fl of flights.values()) {
    if (fl.replica === false) continue;   // a bot replica that drifted away from the pilot's flight shows nothing about that trick
    let rows; try { rows = await FL.unpack(fl.trace); } catch { continue; } if (!Array.isArray(rows) || rows.length < 100) continue;
    const T0 = rows[0][0], T1 = rows[rows.length - 1][0], ev = [];
    // the pilot's pace from their Warm-up, without what their own reviews taught their game (that is theirs, not everyone's)
    const own = fl.profile && typeof fl.profile === 'object' ? { rate: fl.profile.rate, air: fl.profile.air } : null;
    const labelled = [];   // times covered by decided labels (live flags there are superseded)
    // decided labels: own reviews, reviewer labels, judge votes (votes are paired up below)
    const votes = [];
    for (const lf of labelFiles.filter(x => x.flight === fl.id)) for (const l of lf.labels) {
      if (!l || typeof l !== 'object' || l.undone || !(l.verdict === 'yes' || l.verdict === 'no') || !Number.isFinite(+l.t)) continue;
      const author = l.reviewer ? who(l.by, l.byId) : who(lf.name, lf.pilot), bot = fl.pilot === 'bot', rev = !bot && (!!l.reviewer || (author !== fl.pilot && author !== '?'));   // a verdict on a bot flight is the judge's own call on a scripted move: weight 1, src 'bot'
      // a review of a leaderboard run (anyone can open one) is a vote: it counts once a second pilot agrees. The owner's
      // Flight desk reviews are reviewer labels.
      // reviewer labels (the owner's Flight desk and Judge the community) count at reviewer weight only when they are really
      // the owner's (2026-11-19, before sharing widely): signed with the owner key and marked ownerVerified by the drop-off,
      // or not through the public drop-off at all (the owner's GitHub token, bundles he adds by hand), or stored by the relay
      // before the key check existed. Anything else claiming to be a reviewer label is a vote: it counts once a second pilot agrees.
      const trustedRev = !!lf.ownerVerified || !lf._inbox || (lf._relayAt != null && lf._relayAt < REVIEWER_TRUST_UNTIL);
      const vote = !!l.judge || (rev && l.src === 'board') || (!!l.reviewer && !bot && !trustedRev);
      const a = Math.min(+l.repStart || +l.t, +l.t), b = Math.max(+l.repStart || +l.t, +l.t), actual = str(l.actual), target = str(l.target);
      if (a < T0 - 5 || b > T1 + 5) continue;
      const item = { a, b, author, custom: !!l.custom, actual, target, verdict: l.verdict, src: bot ? 'bot' : vote ? 'judge' : rev ? 'reviewer' : 'own', at: lf._relayAt || 0 };   // when it was sent: a person's latest word wins
      labelled.push([a - 1, b + 2]);
      item.wYes = vote ? W.judge : fl.replica || fl.botSrc === 'library' ? W.replica : rev ? W.reviewer : W.own;   // a yes on the knowledge bot re-flying a library example confirms that example: half weight, and it adds no new motion
      item.wNo = vote ? W.judge : l.inferred ? W.inferred : fl.replica ? W.replica : rev ? W.reviewer : W.own; item.inferred = !!l.inferred;
      if (l.custom && actual) ev.push({ kind: 'custom', name: actual.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40), label: actual, a, b, author });
      else votes.push(item);
    }
    for (const e of consensus(votes)) ev.push(e.kind === 'want' ? { ...e, botSrc: fl.botSrc || undefined } : e);
    const covered = t => labelled.some(([a, b]) => t >= a && t <= b);
    // live evidence from the flight itself
    for (const e of fl.events) { if (!e || !Number.isFinite(+e.t) || covered(+e.t)) continue; const name = str(e.name);
      if (e.flagged) ev.push({ kind: 'not', name, a: +e.t0 || +e.t - 1.5, b: +e.t, w: W.flag, author: fl.pilot, src: 'F flag' }); }
    for (const m of fl.missed) if (m && Number.isFinite(+m.t) && !covered(+m.t)) ev.push({ kind: 'miss', t: +m.t, w: W.q, author: fl.pilot, src: 'Q flag' });
    runs.push({ id: fl.id, pilot: fl.pilot, name: fl.name, map: fl.map, started: fl.started || null, src: fl.src, rows, world: worldOf(fl.map, fl.layout, fl.official), camTilt: fl.camTilt, own, ev, live: fl.events, T0, T1 });
  }
  // a pilot may not carry more than W.cap labels' worth on any one trick
  const per = {}; for (const r of runs) for (const e of r.ev) if (e.kind === 'want' || e.kind === 'not') { const k = e.author + '|' + e.name; (per[k] = per[k] || []).push(e); }
  for (const list of Object.values(per)) { const tot = list.reduce((s, e) => s + e.w, 0); if (tot > W.cap) list.forEach(e => { e.w *= W.cap / tot; }); }
  return { runs, nFlights: flights.size, nLabelFiles: labelFiles.length };
}

module.exports = { load, W, CONFIRM, consensus, who, str, worldOf };
