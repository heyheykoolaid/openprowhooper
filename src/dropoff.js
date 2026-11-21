// ============================================================ Flight telemetry (opt-in) and the drop-offs
// (concatenated into the game module). With "Share flight telemetry" on, every free-fly / session run is packed
// (src/flightlog.js, format pro-whooper-flight/1) when it ends and sent to the first drop-off this copy can reach:
//   1. the project database, when the game is opened from its Claude link by someone who may write there;
//   2. the project relay (window.PW_DROPOFF, set at build time; tools/dropoff-worker.mjs), for players with no token;
//   3. GitHub, with the token the player put in Options (telemetry/ in the repo).
// With none of those, runs wait in this browser (IndexedDB) and Options can export them as one file.
// Never sent: the GitHub token, e-mail, device ids. Sent: the pilot name the player chose and a random id made in this browser.
const tel = Object.assign({ on: false, asked: false, pilot: '' }, store.get('telemetry', {}));
// The pilot's name: asked for on the first start, shown on the menu, sent with shared flights and feedback.
const cleanName = v => String(v || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
const pilotName = () => cleanName(store.get('pilotName', ''));
// 'Continue without a name' on the first prompt (owner, 2026-11-18): no name, sharing off, and nothing is queued or sent
// (telQueue refuses everything); a name or sharing turned on later in Options ends it
const anonOn = () => store.get('anon', false) === true && !pilotName();
const isRidgeRipper = () => pilotName().toLowerCase().replace(/[^a-z0-9]/g, '') === 'ridgeripperfpv';
const TEL = { relay: (window.PW_DROPOFF || '').trim(), minSeconds: 20, minArmed: 10, perDay: 40, keep: 40, part: 120000 };
const telState = { busy: false, last: '', mem: [], route: null };
const saveTel = () => store.set('telemetry', { on: tel.on, asked: tel.asked, pilot: tel.pilot });
function telPilot() { if (!tel.pilot) { tel.pilot = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); saveTel(); } return tel.pilot; }
const telStamp = r => `${r.started.replace(/[:.]/g, '-')}-${r.id}`;
function telSet(on) { tel.on = !!on; tel.asked = true; if (on) store.set('anon', false); saveTel(); if (tel.on) { telPilot(); telPump(true); } telRenderStatus(); }

// ---- Things that went wrong in the game's own code on this machine (message and where, nothing else). The last few
// ride along with a shared flight or a feedback note, so a bug a pilot hits can be found without them reporting it.
const errLog = [];
function errNote(msg, where) { const m = String(msg || '').replace(/gh[pousr]_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}/g, '[token]').slice(0, 160), w = String(where || '').replace(/^.*\//, '').slice(0, 60);
  const e = errLog.find(x => x.m === m && x.w === w); if (e) { e.n++; return; } if (errLog.length < 12) errLog.push({ m, w, n: 1, mode, at: Math.round(performance.now() / 1000) }); }
addEventListener('error', e => { if (e && e.message) errNote(e.message, (e.filename || '') + ':' + (e.lineno || 0)); });
addEventListener('unhandledrejection', e => { const r = e && e.reason; errNote(r && r.message ? r.message : r, 'promise'); });

// ---- what leaves: one finished run. Called while the run's arrays are still in place; packs in the background.
function telCapture(reason) {
  if (!tel.on || !recap.id || recap.telDone === recap.id || race.on || recap.guest || MAP_ID === 'training') return null;   // owner, 2026-11-21: Training Room flights are not saved or sent
  let rows = recap.trace; if (rows.length < TEL.minSeconds * TRACE_HZ && !(recap.pieces && recap.pieces.length) && !recap.spill) return null;
  const sq = telSqueeze(rows.filter(r => r[0] > recap.telUpTo)); let act = 0; for (const r of sq.rows) act += rowActive(r) ? 1 : 0;
  telSpillEnd(); const pend = recap.pieces.splice(0);   // the older pieces of a long run go first (packed in the background below)
  if (sq.rows.length < TEL.minSeconds * TRACE_HZ || act < TEL.minArmed * TRACE_HZ) { return pend.length ? (async () => { for (const pc of pend) await telPieceSend(pc); return 'sent'; })() : null; }
  const day = new Date().toISOString().slice(0, 10), cnt = store.get('telDay', { day, n: 0 }); if (cnt.day !== day) { cnt.day = day; cnt.n = 0; }
  if (cnt.n >= TEL.perDay) return null; cnt.n++; store.set('telDay', cnt);
  recap.telDone = recap.id;
  const head = { format: 'pro-whooper-flight/1', build: '0.1', id: recap.id, started: recap.started, ended: reason, pilot: telPilot(), name: pilotName() || null, map: MAP_ID,
    mode: recap.mode || 'free', camTilt: tune.camTilt, camFov: tune.camFov,
    // the whoop as configured in the Garage: part ids and names, and what they add up to
    craft: { ...spec, names: params.names || null, stats: params.stats ? { auw: +params.stats.auw.toFixed(2), twr: +params.stats.twr.toFixed(2), hoverThrottle: +params.stats.hoverThrottle.toFixed(3) } : null },
    tune: JSON.parse(JSON.stringify(tune)), profile: store.get('pilot', null), input: inputCfg.mode,
    score: score ? { total: score.total, maxStreak: +score.maxStreak.toFixed(2) } : null,
    events: recap.events.filter(e => !sq.rows.length || e.t >= sq.rows[0][0] - 1).map(e => ({ t: e.t, t0: e.t0, name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, conf: e.conf, fails: e.fails && e.fails.length ? e.fails : undefined, flagged: e.flag ? true : undefined, maybe: e.maybe ? true : undefined })),
    missed: recap.flags.filter(f => !sq.rows.length || f.t >= sq.rows[0][0] - 1).map(f => ({ t: f.t })) };
  const stamp = telStamp(recap); rows = sq.rows; recap.telUpTo = rows.length ? rows[rows.length - 1][0] : recap.telUpTo;
  // returns a promise that settles when the flight is packed, stored and has had its first try at a drop-off
  return (async () => { try { await new Promise(r => setTimeout(r, 30)); for (const pc of pend) await telPieceSend(pc); head.summary = FlightLog.summary(rows, TRACE_COLS, TRACE_HZ); if (sq.gaps.length) head.summary.gaps = sq.gaps; if (recap.pieceN) head.summary.pieces = recap.pieceN; try { const fe = feelSnap(); if (recap.feel0 && JSON.stringify(recap.feel0) !== JSON.stringify(fe)) fe.atStart = recap.feel0; head.summary.feel = fe; } catch {} if (errLog.length) head.summary.errors = errLog.map(e => ({ ...e })); if (reviewOkOn()) head.summary.reviewOk = true; if (MAP_EDITS) head.summary.layout = MAP_EDITS; if (S.officialEdits(MAP_ID)) head.summary.official = S.officialEdits(MAP_ID);   /* flown on the pilot's own layout: re-flies must use it */ head.trace = await FlightLog.pack(rows, TRACE_COLS, TRACE_HZ); await telQueue('flight', stamp, head); const it = (await telList()).find(x => x.id === 'flight/' + stamp); return it && it.sent ? 'sent' : 'queued'; } catch (err) { telState.last = 'could not pack the last flight'; telRenderStatus(); return false; } })();
}

// ---- Long runs and walking away (owner, 2026-11-19). The replay keeps the last 8 minutes; with sharing on, what falls out of it
// is kept as pieces of up to 8 minutes of flying (`summary.piece` { of, n, t0, t1, gaps }), each sent as its own flight, so a
// 40-minute Free Fly is not 32 minutes lost. Idle time (disarmed, crashed, or sitting still with the sticks centred) longer
// than `IDLE_CUT` s is squeezed out, keeping `IDLE_KEEP` s at each end (`gaps` lists what was cut: the re-fly is unchanged by
// a gap, checked on real flights), and a stretch with under 10 s of flying sends nothing: the sim left open sends nothing.
const IDLE_CUT = 15 * TRACE_HZ, IDLE_KEEP = 1 * TRACE_HZ, PIECE_ROWS = RECAP_MAX;
function rowActive(r) { return !!r[13] && !r[14] && (Math.hypot(r[21], r[22], r[23]) > 0.3 || Math.abs(r[8]) + Math.abs(r[9]) + Math.abs(r[10]) > 40 || Math.abs(r[24]) + Math.abs(r[25]) + Math.abs(r[26]) > 0.05); }
function telSqueeze(rows) {   // the same squeeze for a whole trace (the last 8 minutes)
  const out = [], gaps = []; let idle = [];
  const flush = (end) => { if (idle.length > IDLE_CUT || (end && idle.length > IDLE_KEEP) || (!out.length && idle.length > IDLE_KEEP)) {
      const head = out.length ? idle.slice(0, IDLE_KEEP) : [], tail = end ? [] : idle.slice(-IDLE_KEEP), cut = idle.slice(head.length, idle.length - tail.length);
      out.push(...head); if (cut.length && out.length) gaps.push([cut[0][0], cut[cut.length - 1][0]]); out.push(...tail); } else out.push(...idle); idle = []; };
  for (const r of rows) { if (rowActive(r)) { if (idle.length) flush(false); out.push(r); } else idle.push(r); }
  if (idle.length) flush(true); return { rows: out, gaps };
}
function telSpill(row) {   // a row leaving the replay buffer
  if (!tel.on || anonOn() || recap.guest || !row || row[0] <= recap.telUpTo) return;
  const sp = recap.spill || (recap.spill = { rows: [], gaps: [], idle: [], ih: null, it: null, g0: 0, g1: 0, act: 0 });
  if (rowActive(row)) {
    if (sp.ih) { if (sp.rows.length) { sp.rows.push(...sp.ih); sp.gaps.push([sp.g0, sp.g1]); } sp.rows.push(...sp.it); }
    else if (!sp.rows.length && sp.idle.length > IDLE_KEEP) sp.rows.push(...sp.idle.slice(-IDLE_KEEP)); else sp.rows.push(...sp.idle);
    sp.idle = []; sp.ih = sp.it = null; sp.rows.push(row); sp.act++;
  } else if (sp.ih) { sp.it.push(row); const d = sp.it.shift(); sp.g1 = d[0]; }
  else { sp.idle.push(row); if (sp.idle.length > IDLE_CUT) { sp.ih = sp.idle.slice(0, IDLE_KEEP); sp.it = sp.idle.slice(-IDLE_KEEP); const c = sp.idle.slice(IDLE_KEEP, -IDLE_KEEP); sp.g0 = c[0][0]; sp.g1 = c[c.length - 1][0]; sp.idle = []; } }
  if (sp.rows.length >= PIECE_ROWS) telSeal();
}
function telSpillEnd() { const sp = recap.spill; if (!sp) return; if (sp.ih) { if (sp.rows.length) sp.rows.push(...sp.ih); } else if (sp.rows.length) sp.rows.push(...sp.idle.slice(0, IDLE_KEEP)); sp.idle = []; sp.ih = sp.it = null; telSeal(); }
function telSeal() { const sp = recap.spill; recap.spill = null; if (!sp || sp.act < TEL.minArmed * TRACE_HZ) return; recap.pieces.push({ n: ++recap.pieceN, rows: sp.rows, gaps: sp.gaps, id: recap.id, started: recap.started }); }
let telPieceBusy = false;
function telPieceGo() { if (telPieceBusy || !recap.pieces.length) return; telPieceBusy = true; const pc = recap.pieces.shift();   // at a quiet moment (disarmed, crashed) or when two wait
  setTimeout(() => telPieceSend(pc).finally(() => { telPieceBusy = false; }), 0); }
async function telPieceSend(pc) {
  try { const rows = pc.rows, t0 = rows[0][0], t1 = rows[rows.length - 1][0], day = new Date().toISOString().slice(0, 10), cnt = store.get('telDay', { day, n: 0 }); if (cnt.day !== day) { cnt.day = day; cnt.n = 0; }
    if (cnt.n >= TEL.perDay) return false; cnt.n++; store.set('telDay', cnt);
    const head = { format: 'pro-whooper-flight/1', build: '0.1', id: pc.id + '.p' + pc.n, started: pc.started, ended: 'piece', pilot: telPilot(), name: pilotName() || null, map: MAP_ID,
      mode: recap.mode || 'free', camTilt: tune.camTilt, camFov: tune.camFov, craft: { ...spec, names: params.names || null }, tune: JSON.parse(JSON.stringify(tune)), profile: store.get('pilot', null), input: inputCfg.mode,
      events: recap.events.filter(e => e.t >= t0 && e.t <= t1 + 0.5).map(e => ({ t: e.t, t0: e.t0, name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, conf: e.conf, flagged: e.flag ? true : undefined, maybe: e.maybe ? true : undefined })),
      missed: recap.flags.filter(f => f.t >= t0 && f.t <= t1).map(f => ({ t: f.t })) };
    head.summary = FlightLog.summary(rows, TRACE_COLS, TRACE_HZ); head.summary.piece = { of: pc.id, n: pc.n, t0, t1, gaps: pc.gaps };
    try { head.summary.feel = feelSnap(); } catch {} if (store.get('reviewOk', null) === true) head.summary.reviewOk = true; if (MAP_EDITS) head.summary.layout = MAP_EDITS; if (S.officialEdits(MAP_ID)) head.summary.official = S.officialEdits(MAP_ID);
    head.trace = await FlightLog.pack(rows, TRACE_COLS, TRACE_HZ); pc.rows = null; await telQueue('flight', telStamp(pc) + '-p' + pc.n, head); return true;
  } catch { return false; }
}
window.__pw.telSqueeze = rows => telSqueeze(rows); window.__pw.recapRow = r => recapRow(r); window.__pw.recap = recap;

// ---- "Processing…": the heavy moments (packing and sending a flight, learning from a review) happen behind a short
// pause with a progress bar instead of stuttering under the pilot's hands, and end with a thank-you when the flight was shared.
const proc = { on: false, frac: 0, timer: null };
function procShow(title, sub, frac) {
  const el = $('#procModal'); proc.on = true; if (frac != null) proc.frac = Math.max(0, Math.min(1, frac));
  el.classList.remove('hide'); el.innerHTML = `<div class="fbPanel procPanel"><h3>${esc(title)}</h3><div class="procBar"><i style="width:${Math.round(proc.frac * 100)}%"></i></div><p class="note">${esc(sub || '')}</p></div>`;
}
function procCreep(to, ms) { clearInterval(proc.timer); const f0 = proc.frac, t0 = performance.now(); proc.timer = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); proc.frac = f0 + (to - f0) * (1 - Math.pow(1 - k, 2)); const b = document.querySelector('#procModal .procBar i'); if (b) b.style.width = Math.round(proc.frac * 100) + '%'; if (k >= 1) clearInterval(proc.timer); }, 60); }
function procHide() { clearInterval(proc.timer); proc.on = false; proc.frac = 0; $('#procModal').classList.add('hide'); }
const procThanks = () => `Thanks for your submission and helping Open Pro Whooper${pilotName() ? ', ' + pilotName() : ''}!`;
const procWait = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r('slow'), ms))]);
// a finished flight on its way to the project: pause, show progress, thank the pilot, then carry on with `after`
async function procFlight(job, after) {
  if (!job) { if (after) after(); return; }
  procShow('Saving your flight for the project…', 'Packing the flight data', 0.05); procCreep(0.85, 3500);
  const r = await procWait(job, 9000);
  procShow(procThanks(), (r === 'sent' ? 'Your flight was shared with the Open Pro Whooper Project.' : r === 'slow' ? 'Your flight is still sending in the background.' : r === 'queued' ? 'Your flight is saved and will be sent as soon as the drop-off can be reached.' : 'This flight could not be packed, but thank you for sharing.') + ' Every flight makes trick detection better for every pilot.', 1);
  await new Promise(res => setTimeout(res, 1500)); procHide(); if (after) after();
}

// ---- the waiting list (IndexedDB, falling back to memory)
async function telList() { const a = await idb.all('telemetry'); return (a.length ? a : telState.mem).slice().sort((x, y) => (x.at < y.at ? -1 : 1)); }
async function telStore(item) { const ok = await idb.ok(); if (ok) await idb.put('telemetry', item); else { const i = telState.mem.findIndex(x => x.id === item.id); if (i >= 0) telState.mem[i] = item; else telState.mem.push(item); } }
async function telQueue(kind, name, payload, explicit) {
  if (anonOn()) return;   // flying without a name: nothing is collected or sent, not even what a click would send
  await telStore({ id: `${kind}/${name}`, kind, name, at: new Date().toISOString(), body: JSON.stringify(payload), sent: null, explicit: !!explicit });
  const all = await telList(); for (const old of all.slice(0, Math.max(0, all.length - TEL.keep))) { await idb.del('telemetry', old.id); telState.mem = telState.mem.filter(x => x.id !== old.id); }
  telRenderStatus(); return telPump(true);   // a new item gets one immediate try
}

// ---- drop-off 1: the project database behind the Claude link
let telDbOk = null, telDbTry = null;
// The page's Claude capabilities arrive some time after the script starts, so a miss is never remembered: ask again.
function telDb() { if (telDbOk) return Promise.resolve(telDbOk); return telDbTry || (telDbTry = (async () => { await null; try { if (!(window.claude && window.claude.use)) return null; const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); const uid = user ? await user.id() : null; if (db && uid) telDbOk = { db, uid, owner: !!(await user.isOwner()) }; telState.dbWhy = !db ? 'no database in this view' : !uid ? 'not signed in' : ''; return telDbOk; } catch (err) { telState.dbWhy = 'database error'; return null; } finally { telDbTry = null; } })()); }
async function telToDb(it) {
  const c = await telDb(); if (!c) return false;
  try {
    const doc = c.db.collection(`telemetry/${c.uid}/${it.kind}`).doc(it.name), parts = Math.ceil(it.body.length / TEL.part), p = JSON.parse(it.body);
    for (let i = 0; i < parts; i++) await doc.collection('parts').doc('p' + String(i).padStart(3, '0')).set({ i, s: it.body.slice(i * TEL.part, (i + 1) * TEL.part) });
    // the index document goes last, so its presence means every part arrived; it carries what is useful without the trace
    await doc.set({ format: p.format, at: it.at, kind: it.kind, parts, chars: it.body.length, pilot: p.pilot || null, build: p.build || null, started: p.started || null, mode: p.mode || null, camTilt: p.camTilt ?? null,
      summary: p.summary || null, events: p.events || null, missed: p.missed || null, labels: p.labels || null, flight: p.flight || null, category: p.category || null, text: p.text || null });
    await c.db.doc(`telemetry/${c.uid}`).set({ pilot: p.pilot || null, last: it.at });   // lets the owner find every pilot's folder
    return true;
  } catch (err) { telState.dbWhy = 'write refused' + (err && err.code ? ' (' + err.code + ')' : ''); return false; }
}
// ---- drop-off 2: the relay (a plain-text POST keeps it a simple cross-site request)
async function telToRelay(it) {   // -> HTTP status (0: could not reach it)
  try { const payload = JSON.parse(it.body), env = { kind: it.kind, name: it.name, payload };
    // the owner's reviewer labels carry a signature made with the owner key (never the key itself); the drop-off checks it and
    // marks the file ownerVerified, and only those count at reviewer weight in the learners (tools/evidence.js)
    if (it.kind === 'labels' && Array.isArray(payload.labels) && payload.labels.some(l => l && l.reviewer) && ghMenus() && store.get('ownerKey', '')) env.ownerSig = await ownerSign(store.get('ownerKey', ''), payload);
    const r = await fetch(TEL.relay, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(env) }); return r.status; } catch { return 0; }
}
// ---- the owner (see ghMenus in ghsync.js)
async function ownerSign(key, payload) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(String(payload.flight) + '|' + JSON.stringify(payload.labels))); return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join(''); }
let ownerMsg = '';
function ownerStatus() { const ok = store.get('ownerOk', null); return ownerMsg || (ghMenus() ? (ok && ok.legacy ? 'Owner menus on by name (the drop-off has no owner check yet: redeploy it in Cloudflare).' : 'Owner key checked ✓: owner menus on, your reviews count at reviewer weight.') : 'Enter the owner key (the OWNER_KEY secret in Cloudflare) to open the owner menus.'); }
async function ownerVerify() {
  if (!nameOwner()) { ownerMenus(); return; }
  const key = store.get('ownerKey', ''), base = lbBase();
  if (!base) { store.set('ownerOk', { legacy: true }); ownerMenus(); return; }   // a copy with no drop-off: nothing to protect
  try { const r = await fetch(base + '/owner', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key }) });
    if (r.status === 200) { store.set('ownerOk', { k: keyTag(key), at: Date.now() }); ownerMsg = ''; }
    else if (r.status === 400 || r.status === 404 || r.status === 405 || r.status === 503) store.set('ownerOk', { legacy: true });   // the drop-off predates the owner check (an old relay reads /owner as a bad upload: 400), or has no OWNER_KEY set
    else { store.set('ownerOk', null); ownerMsg = r.status === 429 ? 'Too many wrong keys from here: wait an hour.' : key ? 'The drop-off did not accept that key.' : ''; }
  } catch { /* offline: keep what was checked last */ }
  ownerMenus(); const m = $('#ownerMsg'); if (m) m.textContent = ownerStatus(); const g = $('#ghSection'); if (g) g.classList.toggle('hide', !ghMenus());
}
document.addEventListener('click', e => { const b = e.target.closest('[data-owner]'); if (!b) return;
  if (b.dataset.owner === 'save') { const v = (($('#optOwnerKey') || {}).value || '').trim(); if (!v) return; store.set('ownerKey', v); ownerMsg = 'Checking…'; const m = $('#ownerMsg'); if (m) m.textContent = ownerMsg; ownerMsg = ''; ownerVerify(); }
  if (b.dataset.owner === 'forget') { store.set('ownerKey', ''); store.set('ownerOk', null); ownerVerify(); openOptions(); } });
setTimeout(ownerVerify, 0);
// ---- drop-off 3: GitHub with the player's own token
async function telToGitHub(it) {
  if (!gh.token) return false;
  try { const r = await ghFetch(`/contents/${['telemetry', it.kind, telPilot(), it.name + '.json'].map(encodeURIComponent).join('/')}`, { method: 'PUT', body: JSON.stringify({ message: `telemetry: ${it.kind} ${it.name}`, content: b64(it.body), branch: gh.branch }) });
    return r.ok || r.status === 422; } catch { return false; }   // 422: already there
}
// One upload = one request to the relay. To stay well inside the relay's free allowance and not hammer it when it is
// busy or closed: a refused item (not valid, too big) is never retried; "slow down" / errors back off 1, 2, 5, 15, 60
// minutes; a copy the relay will not accept from (the downloaded file) stops trying for the session.
const TEL_BACKOFF = [60, 120, 300, 900, 3600];
async function telPump(force) {
  if (anonOn()) return;   // no name chosen: nothing leaves the browser
  if (telState.busy) return; if (!force && telState.retryAt && Date.now() < telState.retryAt) return; telState.busy = true;
  try {
    for (const it of await telList()) { if (it.sent) continue; if (it.kind !== 'feedback' && it.kind !== 'video' && !it.explicit && !tel.on) continue;   // feedback and a video review are sent by the player's own click
      let route = (await telToDb(it)) ? 'project database' : null, refused = false;
      if (!route && TEL.relay && !telState.relayOff) { const st = await telToRelay(it);
        if (st >= 200 && st < 300) route = 'project drop-off';
        else if (st === 400 || st === 413) { route = 'refused'; refused = true; }                     // the relay will never take this one
        else if (st === 403) telState.relayOff = true;                                                   // not from the hosted game
        else { telState.failN = (telState.failN || 0) + 1; const wait = TEL_BACKOFF[Math.min(telState.failN, TEL_BACKOFF.length) - 1]; telState.retryAt = Date.now() + wait * 1000;
          telState.last = `${st === 429 ? 'the drop-off is busy' : 'could not reach the drop-off'} — trying again in ${wait >= 120 ? Math.round(wait / 60) + ' min' : '1 min'}`; break; } }
      if (!route) route = (await telToGitHub(it)) ? 'GitHub' : null;
      if (!route) { telState.last = telState.relayOff ? 'this copy cannot upload — play the hosted game to share, or save a file' : 'no drop-off reachable — kept here'; break; }
      if (!refused) { telState.failN = 0; telState.retryAt = 0; telState.route = route; }
      telState.last = refused ? `the drop-off would not take one ${it.kind} (kept off the retry list)` : `sent ${it.kind} → ${route}`;
      await telStore({ id: it.id, kind: it.kind, name: it.name, at: it.at, sent: route, chars: it.body.length });   // keep a receipt, drop the body
    }
  } finally { telState.busy = false; telRenderStatus(); }
}

// ---- Options and the one-time question on the main menu
function telOptionsHtml() {
  return `<label>Pilot name<input id="optPilotName" maxlength="24" value="${esc(pilotName())}" onkeydown="event.stopPropagation()"></label>
    <label class="chk big"><input type="checkbox" id="telOn" ${tel.on ? 'checked' : ''}> Share flight telemetry</label>
    <label class="chk"><input type="checkbox" id="reviewOkOn" ${reviewOkOn() ? 'checked' : ''}> Let other pilots review moments from my shared runs <span class="note">(the Review queue: they see the replay, your pilot name and the game's calls, and say what the trick was)</span></label>
    <details class="optExplain"><summary>What it does, why, and what is not sent</summary>
      <p><b>What it does:</b> when a Free Fly or Session run ends, the game sends that run to the project: the flight path and attitude, your stick and throttle movements, every trick the game called (with how sure it was), your F / Q flags, and your craft, rates and camera tilt. About 30–80 KB a minute; runs under ${TEL.minSeconds} seconds and RaceGOW laps are skipped.</p>
      <p><b>Why:</b> real flying is what the trick rules are tuned against. Each flight can be re-flown through new versions of the detector to see which calls change, and the unsure calls show which rules need work. Tricks you confirm in Review also become examples in the game's trick library, which everyone's game compares moves against: only measurements of how the quad turned go in, never your name, id or the flight itself.</p>
      <p><b>What's not sent:</b> no e-mail or device details. Your runs carry the pilot name you chose and a random id made in this browser (<code>${esc(tel.pilot || 'made when you turn this on')}</code>) so they can be grouped. Never any access token.</p>
    </details>
      <p class="note" id="telStatus"></p>
      <div class="row"><button id="telExport" class="ghost">Save waiting flights as a file</button><button id="telForget" class="ghost">Delete flights kept here</button><button id="telCollect" class="ghost hide">Download everything in the project database</button></div>`;
}
async function telRenderStatus() {
  const el = $('#telStatus'); if (!el) return;
  const all = await telList(), wait = all.filter(x => !x.sent).length, sent = all.filter(x => x.sent && x.sent !== 'file' && x.sent !== 'refused').length, c = await telDb();
  const where = c ? 'the project database (through this Claude page)' : TEL.relay && !telState.relayOff ? 'the project drop-off' : gh.token ? `GitHub (${gh.owner}/${gh.repo}/telemetry/)` : null;
  el.textContent = (!tel.on ? 'Off. ' : where ? `On — this copy sends to ${where}. ` : 'On, but this copy has nowhere to send yet: flights are kept in this browser. Save them as a file and pass it to the project. ') +
    `${wait} waiting · ${sent} sent from this browser${telState.last ? ' · ' + telState.last : ''}${window.claude && telState.dbWhy ? ' · project database: ' + telState.dbWhy : ''}`;
  const col = $('#telCollect'); if (col) col.classList.toggle('hide', !(c && c.owner));
}
// ---- first start: every pilot picks a name, and says yes or no to sharing, before the menu
function pilotShowName() { const el = $('#menuPilot'); if (el) el.innerHTML = pilotName() ? `pilot: ${esc(pilotName())} ${typeof badgeLine === 'function' ? badgeLine(pilotName()) : ''}` : ''; ownerMenus(); if (nameOwner() && !store.get('ownerOk', null)) setTimeout(ownerVerify, 0); }   /* later: lbBase is set up further down this file */
function pilotAsk() {
  const el = $('#pilotModal'); el.classList.remove('hide');
  el.innerHTML = `<div class="fbPanel"><h3>Welcome, pilot. What's your name?</h3>
    <input type="text" id="pilotNameIn" maxlength="24" placeholder="your pilot name or handle" value="${esc(pilotName())}" onkeydown="event.stopPropagation()" autocomplete="off">
    ${tel.asked ? '' : `<p><b>Help make the trick detection better?</b> If you say yes, the game shares each run with the project when it ends: flight path, sticks, the tricks it called, your flags, and this name. No e-mail, nothing about your device. Tricks you confirm may go into the game's trick library for everyone (how the quad moved, where and when on the map, and your pilot name, which Judge the Bot shows). Other pilots can be shown moments from your shared runs in the Review queue (the replay, your name, the game's calls) to confirm what the trick was. You can change either any time in Options.</p><p class="note">Enabling telemetry will help us make this sim better for everyone, but will also cause a brief progress bar to appear when submitting data. Your contributions to the project would be greatly appreciated! Everyone benefits!</p>`}
    <p class="note" id="pilotMsg"></p>
    <div class="row">${tel.asked ? '<button data-pilot="go" class="primary">Let\'s fly</button>' : '<button data-pilot="yes" class="primary">Share my flights &amp; start</button><button data-pilot="no">Start without sharing</button>'}</div>
    <p class="note"><button data-pilot="anon" class="ghost">Continue without a name</button> nothing is collected or shared (no flights, reviews, votes or feedback). You can add a name or turn sharing on later in Options.</p></div>`;
  setTimeout(() => $('#pilotNameIn') && $('#pilotNameIn').focus(), 30);
}
// then recommend the Pilot Warm-up to anyone who has no profile yet (once; it stays on the main menu)
// Physics update 2 (2026-11-18): the motors now match BetaFPV's published thrust and spin up 2x faster, so pilots who had
// lowered Weight (or raised Motor) to make up for it would overshoot. Asked once, only if a feel slider is off 100 %.
const FEEL_NAMES = { weightFeel: 'Weight', dragFeel: 'Drag', washFeel: 'Prop wash', motorFeel: 'Motor response', sagFeel: 'Battery sag', groundFeel: 'Ground effect' };
// The Review queue is open to every pilot (owner, 2026-11-21). A shared run is shown to other pilots only when its pilot has
// said so: new pilots in the first-start prompt, pilots already sharing through this one-time notice (store 'reviewOk': true / false).
const reviewOkOn = () => store.get('reviewOk', null) === true;
function reviewAsk() {
  if (!tel.on || anonOn() || store.get('reviewOk', null) != null || !$('#pilotModal').classList.contains('hide')) return false;
  const el = $('#pilotModal'); el.classList.remove('hide');
  el.innerHTML = `<div class="fbPanel"><h3>New: every pilot can help review</h3>
    <p>The <b>Review queue</b> in the Review Hub is now open to all pilots: it shows the moments the game was least sure of in shared runs, and pilots say what the trick really was. Three pilots agreeing settles a moment.</p>
    <p>May moments from <b>your</b> shared runs be shown there? Other pilots would see the replay, your pilot name and the game's calls. Nothing else changes about what you share.</p>
    <p class="note">You can change this any time in Options.</p>
    <div class="row"><button data-revok="yes" class="primary">Yes, include my runs</button><button data-revok="no">Keep mine out</button></div></div>`;
  return true;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-revok]'); if (!b) return; store.set('reviewOk', b.dataset.revok === 'yes'); $('#pilotModal').classList.add('hide'); });
document.addEventListener('change', e => { if (e.target && e.target.id === 'reviewOkOn') store.set('reviewOk', !!e.target.checked); });
function physAsk() {
  if (store.get('phys2Asked', false)) return;
  const off = Object.keys(S.FEEL_KEYS).filter(k => Number.isFinite(+tune[k]) && Math.abs(+tune[k] - (k === 'weightFeel' ? WEIGHT_DEF : 1)) > 0.001);
  if (!off.length) { store.set('phys2Asked', true); return; }
  const el = $('#pilotModal'); el.classList.remove('hide');
  el.innerHTML = `<div class="fbPanel"><h3>The whoop physics got an update</h3>
    <p>The motors now match the thrust BetaFPV publishes for them and spin up about twice as fast, like real ones. Most pilots had turned the weight down to make up for exactly this, so your settings may now feel too light or twitchy:</p>
    <p><b>${off.map(k => `${FEEL_NAMES[k] || k} ${Math.round(+tune[k] * 100)}%`).join(' · ')}</b></p>
    <p class="note">You can change them any time in the Garage → Advanced.</p>
    <div class="row"><button data-phys="reset" class="primary">Try the new defaults</button><button data-phys="keep">Keep my settings</button></div></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-phys]'); if (!b) return;
  if (b.dataset.phys === 'reset') { store.set('feelBefore2', feelSnap()); for (const k of Object.keys(S.FEEL_KEYS)) tune[k] = 1; tune.weightFeel = WEIGHT_DEF; saveTune(); }
  store.set('phys2Asked', true); $('#pilotModal').classList.add('hide'); });
function pilotWarmAsk() {
  if (store.get('pilot', null) || store.get('warmAsked', false) || anonOn()) return;   // no name chosen: no Warm-up prompt either (owner)
  const el = $('#pilotModal'); el.classList.remove('hide');
  el.innerHTML = `<div class="fbPanel"><h3>Recommended first: Pilot Warm-up</h3>
    <input type="hidden" id="pilotNameIn" value="${esc(pilotName())}">
    <p>About a minute of simple moves. The game measures how fast you flip, roll and spin and how much air you leave between moves, then judges your tricks at <b>your</b> pace instead of a default one. It only ever makes the trick detection more forgiving.</p>
    <p class="note">You can do it later from the main menu (Pilot Warm-up).</p>
    <div class="row"><button data-pilot="warm" class="primary">Do the warm-up now</button><button data-pilot="later">Later</button></div></div>`;
}
document.addEventListener('change', e => { if (e.target.id === 'optPilotName') { const n = cleanName(e.target.value); if (n.length >= 2) { store.set('pilotName', n); pilotShowName(); } e.target.value = pilotName(); const g = $('#ghSection'); if (g) g.classList.toggle('hide', !ghMenus()); } });
document.addEventListener('keydown', e => { if (e.target.id === 'pilotNameIn' && e.code === 'Enter') { const b = $('#pilotModal [data-pilot].primary'); if (b) b.click(); } }, true);
document.addEventListener('click', async e => {
  const pb = e.target.closest('[data-pilot]');
  if (pb && pb.dataset.pilot === 'anon') { store.set('pilotName', ''); store.set('anon', true); tel.on = false; tel.asked = true; saveTel(); await idb.clear('telemetry'); telState.mem = []; pilotShowName(); $('#pilotModal').classList.add('hide'); flashNote('Flying without a name: nothing is collected or shared'); return; }
  if (pb && (pb.dataset.pilot === 'warm' || pb.dataset.pilot === 'later')) { $('#pilotModal').classList.add('hide'); if (pb.dataset.pilot === 'warm') startWarmup(); else store.set('warmAsked', true); return; }
  if (pb) { const n = cleanName($('#pilotNameIn').value);
    if (n.length < 2) { $('#pilotMsg').textContent = 'Pick a name with at least 2 characters.'; $('#pilotNameIn').focus(); return; }
    store.set('pilotName', n); pilotShowName(); $('#pilotModal').classList.add('hide');
    if (pb.dataset.pilot === 'warm') { startWarmup(); return; } if (pb.dataset.pilot === 'later') { store.set('warmAsked', true); return; }
    if (pb.dataset.pilot !== 'go') { if (pb.dataset.pilot === 'yes') store.set('reviewOk', true); telSet(pb.dataset.pilot === 'yes'); if (tel.on) flashNote('Sharing is on — thank you! (Options to change)'); }
    if (!store.get('fb.name', '')) store.set('fb.name', n); pilotWarmAsk(); return; }
  if (e.target.id === 'telExport') { const items = (await telList()).filter(x => x.body); if (!items.length) { telState.last = 'nothing waiting'; telRenderStatus(); return; }
    const ok = await saveFile(`pro-whooper-telemetry-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify({ format: 'pro-whooper-telemetry-bundle/1', exported: new Date().toISOString(), items: items.map(x => ({ kind: x.kind, name: x.name, at: x.at, payload: JSON.parse(x.body) })) }));
    if (ok === true) { for (const x of items) if (!x.sent) await telStore({ id: x.id, kind: x.kind, name: x.name, at: x.at, sent: 'file', chars: x.body.length }); telState.last = `saved ${items.length} to a file`; } telRenderStatus(); }
  if (e.target.id === 'telForget') { await idb.clear('telemetry'); telState.mem = []; telState.last = 'deleted'; telRenderStatus(); }
  if (e.target.id === 'telCollect') { e.target.disabled = true; telState.last = 'collecting…'; telRenderStatus(); const n = await telCollect(); telState.last = n == null ? 'could not read the database' : `collected ${n} item${n === 1 ? '' : 's'}`; e.target.disabled = false; telRenderStatus(); }
});
// the owner's way to move what the database holds into a file (the page cannot reach GitHub from inside Claude)
async function telCollect() {
  const c = await telDb(); if (!c) return null;
  try {
    const items = [], pilots = new Set([c.uid]); (await c.db.collection('telemetry').get()).docs.forEach(d => pilots.add(d.id));
    for (const uid of pilots) for (const kind of ['flight', 'labels', 'feedback']) {
      const col = c.db.collection(`telemetry/${uid}/${kind}`);
      for (const d of (await col.limit(1000).get()).docs) { const m = d.data(); let body = '';
        for (const p of (await col.doc(d.id).collection('parts').get()).docs) body += p.data().s;
        if (body.length !== m.chars) continue; items.push({ kind, name: d.id, at: m.at, payload: JSON.parse(body) }); }
    }
    if (items.length) await saveFile(`pro-whooper-telemetry-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify({ format: 'pro-whooper-telemetry-bundle/1', exported: new Date().toISOString(), items }));
    return items.length;
  } catch { return null; }
}
// a run still in the air when the tab is closed: pack what there is (best effort)
addEventListener('pagehide', () => telCapture('closed'));
// anything still waiting is tried again now and then (telPump keeps to its back-off)
setInterval(async () => { if (document.hidden) return; if ((await telList()).some(x => !x.sent && (x.kind === 'feedback' || tel.on))) telPump(); }, 30000);
pilotShowName();
setTimeout(async () => { pilotShowName(); if (!pilotName() && !anonOn()) pilotAsk(); else { pilotWarmAsk(); if ($('#pilotModal').classList.contains('hide')) physAsk(); if ($('#pilotModal').classList.contains('hide')) reviewAsk(); } telPump(); }, 1200);
window.__pw.pilot = { get name() { return pilotName(); }, ask: () => pilotAsk(), get farts() { return isRidgeRipper(); }, crashSound: () => (isRidgeRipper() ? crashFart() : crashThud()) };
window.__pw.tel = { get state() { return { ...tel, ...telState }; }, set: on => telSet(on), capture: r => telCapture(r), list: () => telList(), pump: () => telPump() };

// ============================================================ Daily leaderboard (2:00 Sessions)
// A 2:00 Session can be posted to the day's board. Posting is the player's own click, every time: it publishes their
// pilot name, the score, the scoring sheet and the replay of that run through the relay (docs/DATA.md). The board is the
// day's best run per pilot and map; days turn over at 00:00 UTC. Clicking a run shows its scoring sheet and plays it.
// Everything that comes back from the board is other people's text: always escaped, never run.
const LB = { last: null, runs: null, day: null, msg: '', view: null, open: null, posted: {} };
const lbBase = () => TEL.relay ? TEL.relay.replace(/\/+$/, '') : '';
const lbToday = () => new Date().toISOString().slice(0, 10);
const lbNameOk = n => /^[A-Za-z0-9_. -]{2,24}$/.test(n);
const lbMapTitle = id => (S.MAPS[id] && S.MAPS[id].title) || id;
function lbSessionOver(r) {   // called by endSession while the run's arrays are still in place
  const rows = recap.trace; let i0 = rows.findIndex(x => x[13]); i0 = Math.max(0, (i0 < 0 ? 0 : i0) - TRACE_HZ);
  LB.last = { id: recap.id, total: Math.round(r.total), map: MAP_ID, rows: rows.slice(i0, i0 + 19900),
    totals: { trick: r.trickScore, switchMult: r.switchMult(), kwad: r.kwadBonus, chain: r.chainBonus || 0, gaps: r.gapBonus || 0, gapN: r.gapN || 0, streak: +r.maxStreak.toFixed(2), obstacles: r.uniqueObs.size },
    sheet: r.log.filter(x => x.net || x.exec === 'CRASH').slice(0, 400).map(x => ({ name: x.name, exec: x.exec, net: x.net, base: x.base, obstacle: x.obstacle || undefined })),
    events: recap.events.filter(e => !e.maybe).slice(0, 400).map(e => ({ t: e.t, t0: e.t0, name: e.name, exec: e.exec })) };
  lbResultsBox(); lbLoad(lbToday()).then(lbResultsBox);
}
async function lbLoad(day) {
  if (!lbBase()) { LB.msg = 'The leaderboard needs the online version of the game.'; return; }
  LB.day = day; LB.msg = 'Loading…';
  try { const r = await fetch(`${lbBase()}/board?day=${day}`); if (!r.ok) throw 0; const j = await r.json(); LB.runs = Array.isArray(j.runs) ? j.runs.filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score)).slice(0, 100) : []; LB.msg = ''; }
  catch { LB.runs = null; LB.msg = 'Could not reach the leaderboard just now.'; }
}
const lbRows = (runs, max, me) => runs.slice(0, max).map((e, i) => `<tr data-lbrun="${esc(e.id || '')}" class="${me && e.name === me ? 'me' : ''}" title="Click for the scoring sheet and the replay"><td>${i + 1}</td><td>${badgeHtml(e.name)}${esc(e.name)}</td><td>${Number(e.score).toLocaleString()}</td><td class="lbPlayC">${e.id ? `<button class="lbPlay" data-lbplay="${esc(e.id)}" data-lbmap="${esc(e.map || '')}" title="Watch this run">▶</button>` : ''}</td></tr>`).join('');
function lbResultsBox() {
  const el = $('#lbBox'), L = LB.last; if (!el || !L) return;
  const runs = (LB.runs || []).filter(e => e.map === L.map), name = pilotName(), done = LB.posted[L.id];
  const can = lbBase() && L.total > 0, why = !lbBase() ? 'The leaderboard needs the online version of the game.' : MAP_EDITS ? 'This run was flown on a community map. The daily board is for the official maps: pick the official one in Maps to post.' : L.total <= 0 ? 'Score something to post a run.' : !lbNameOk(name) ? 'Leaderboard names use letters, numbers, spaces and _ . - (2 to 24). Change yours in Options.' : '';
  el.innerHTML = `<h3>TODAY'S LEADERBOARD <small>${esc(lbMapTitle(L.map))} · resets 00:00 UTC</small></h3>
    ${runs.length ? `<table class="lbT">${lbRows(runs, 5, name)}</table>` : `<p class="note">${esc(LB.msg || 'No runs posted on this map yet today. Yours could be first.')}</p>`}
    <div class="row">${done ? `<span class="note">✓ ${esc(done)}</span>` : can && !why ? `<button data-lb="post" class="primary">Post this run as ${esc(name)}</button>` : ''}<button data-lb="open">Full leaderboard</button></div>
    <p class="note">${done ? '' : why || 'Posting puts your pilot name, score, scoring sheet and the replay of this run on the public board for the day.'}</p>`;
}
async function lbPost() {
  const L = LB.last, name = pilotName(); if (!L || LB.posted[L.id] || !lbBase() || !lbNameOk(name) || L.total <= 0 || LB.busy || MAP_EDITS) return; LB.busy = true;
  const el = document.querySelector('[data-lb="post"]'); if (el) { el.disabled = true; el.textContent = 'Posting…'; }
  let msg = '';
  try { const trace = L.rows.length > TRACE_HZ ? await FlightLog.pack(L.rows, TRACE_COLS, TRACE_HZ) : undefined;
    const payload = { format: 'pro-whooper-score/1', build: '0.1', name, pilot: telPilot(), score: L.total, map: L.map, mode: 'session', flight: L.id, totals: L.totals, sheet: L.sheet, events: L.events, camTilt: tune.camTilt, camFov: tune.camFov, craft: { ...spec }, trace };
    const r = await fetch(lbBase(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: 'score', payload }) });
    if (r.status === 200) { LB.posted[L.id] = `Posted: ${L.total.toLocaleString()} as ${name}`; await lbLoad(lbToday()); }
    else msg = r.status === 429 ? 'The board is busy: try again in a bit.' : r.status === 403 ? 'Posting only works from the online version of the game.' : 'The board did not take it (' + r.status + ').';
  } catch { msg = 'Could not reach the leaderboard just now.'; }
  LB.busy = false; lbResultsBox(); if (msg) { const n = document.querySelector('#lbBox p.note:last-child'); if (n) n.textContent = msg; }
}
// one board per map, shown as a carousel like the Maps screen (← → while it is open)
function lbView(dir) { const ids = Object.keys(S.MAPS).filter(k => !S.MAPS[k].hidden), k = ids.indexOf(S.MAPS[LB.view] ? LB.view : MAP_ID); LB.view = ids[(k + dir + ids.length) % ids.length]; LB.open = null; lbRender(); }
document.addEventListener('keydown', e => { if ($('#lbScreen').classList.contains('hide') || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; if (e.key === 'ArrowLeft') { lbView(-1); e.preventDefault(); } if (e.key === 'ArrowRight') { lbView(1); e.preventDefault(); } });
function lbOpen(from) { LB.from = from || (mode === 'menu' ? 'menu' : 'results'); LB.open = null; LB.view = MAP_ID; show('#lbScreen'); lbRender(); lbLoad(lbToday()).then(lbRender); }
function lbRender() {
  const el = $('#lbPanel'); if (!el) return; const ids = Object.keys(S.MAPS).filter(k => !S.MAPS[k].hidden), V = S.MAPS[LB.view] ? LB.view : MAP_ID, runs = (LB.runs || []).filter(e => e.map === V), R = LB.open, th = (window.PW_MAPTHUMBS || {})[V];
  const count = id => (LB.runs || []).filter(e => e.map === id).length;
  el.innerHTML = `<h2>DAILY LEADERBOARD</h2>
    <p class="note">Best 2:00 Session per pilot. Today's board only: a new one starts every day at 00:00 UTC. Scores are what each player's game reported. Click a run to see how it was scored and watch it.</p>
    <div class="lbCar"><button class="mapArrow" data-lb="prev" aria-label="previous map">‹</button><div class="lbHead" ${th ? `style="background-image:url('${th}')"` : ''}><b>${esc(lbMapTitle(V))}</b><small>${LB.runs ? `${runs.length} pilot${runs.length === 1 ? '' : 's'} today` : LB.msg ? 'board not reachable' : 'loading…'}${V === MAP_ID ? ' · you are here' : ''}</small></div><button class="mapArrow" data-lb="next" aria-label="next map">›</button></div>
    <div class="mapDots">${ids.map(id => `<button data-lbmap="${id}" class="${id === V ? 'on' : ''}" title="${esc(lbMapTitle(id))}${LB.runs ? ' · ' + count(id) : ''}" aria-label="${esc(lbMapTitle(id))}"></button>`).join('')}<button data-lb="refresh" class="lbRefresh" title="Refresh">↻</button></div>
    <div class="lbCols"><div>${runs.length ? `<table class="lbT"><tr><th>#</th><th>Pilot</th><th>Score</th><th></th></tr>${lbRows(runs, 100, pilotName())}</table>` : `<p class="note">${esc(LB.msg || `No runs posted on ${lbMapTitle(V)} today. Fly a 2:00 Session there and post it from the results screen.`)}</p>`}</div>
    <div id="lbRun">${R ? lbRunHtml(R) : '<p class="note">Pick a run.</p>'}</div></div>
    <div class="row"><button data-lb="close" class="primary">Back</button></div>`;
}
function lbRunHtml(R) {
  if (R.loading) return '<p class="note">Loading the run…</p>'; if (R.error) return `<p class="note">${esc(R.error)}</p>`;
  const p = R.run, T = p.totals || {}, sheet = Array.isArray(p.sheet) ? p.sheet.slice(0, 400) : [], canWatch = p.trace && p.map === MAP_ID && !MAP_EDITS, num = v => Number.isFinite(+v) ? (+v).toLocaleString() : '—';
  return `<h3>${esc(p.name)} · ${num(p.score)}</h3>
    <p class="note">${esc(lbMapTitle(p.map))}${T.trick != null ? ` · trick score ${num(T.trick)} × switch ${esc(T.switchMult)} + K.W.A.D. ${num(T.kwad)}` : ''}${T.streak != null ? ` · max streak ×${esc(T.streak)}` : ''}${T.obstacles != null ? ` · obstacles ${esc(T.obstacles)}` : ''}</p>
    <div class="row">${canWatch ? '<button data-lb="watch" class="primary">▶ Watch the run</button>' : `<span class="note">${p.trace && p.map === MAP_ID && MAP_EDITS ? 'A community map is loaded: pick the official map in Maps to watch runs.' : p.trace ? 'Flown on ' + esc(lbMapTitle(p.map)) + ': switch to that map (Maps) to watch it.' : 'No replay was posted with this run.'}</span>`}</div>
    <ol class="lbSheet">${sheet.map(x => `<li>${esc(x.name)}${x.obstacle ? ' <small>' + esc(x.obstacle) + '</small>' : ''} <span class="${/^[A-Z]+$/.test(x.exec) ? x.exec : ''}">${esc(x.exec)}</span> +${num(x.net)}</li>`).join('') || '<li>no scoring sheet</li>'}</ol>`;
}
async function lbPick(id) {
  if (!/^[A-Za-z0-9_-]{10,140}$/.test(id) || !lbBase()) return; LB.open = { id, loading: true }; lbRender();
  try { const r = await fetch(`${lbBase()}/run?day=${LB.day || lbToday()}&id=${encodeURIComponent(id)}`); if (!r.ok) throw 0; const run = await r.json(); if (!run || typeof run.name !== 'string') throw 0; if (LB.open && LB.open.id === id) LB.open = { id, run }; }
  catch { if (LB.open && LB.open.id === id) LB.open = { id, error: 'Could not load that run.' }; }
  lbRender();
}
// someone else's run in the replay viewer: a guest run is never saved, reviewed or shared from here
// Someone else's flight in the replay viewer. Nothing of it is kept as the viewer's own run, and it never feeds the
// viewer's own learning. If the viewer reviews it, their verdicts go out as REVIEWER labels (a second opinion on that
// pilot's flight, marked with who gave it), by their own action.
function guestOpen(rows, events, of, review) {
  if (!Array.isArray(rows) || rows.length < TRACE_HZ || !rows.every(r => Array.isArray(r) && r.length >= 27 && r.every(Number.isFinite))) throw new Error('bad trace');
  if (!recap.guest) LB.keep = { trace: recap.trace, events: recap.events, flags: recap.flags, id: recap.id, started: recap.started, mode: recap.mode, dirty: recap.dirty, telDone: recap.telDone };   // the player's own run comes back afterwards
  recapReset(); recap.guest = true; recap.guestOf = of; recap.trace = rows; recap.telDone = recap.id;
  const plain = x => String(x).replace(/[<>&"'`\\]/g, '');   // someone else's file: names are shown in many places, so no markup gets in at all
  recap.events = (Array.isArray(events) ? events : []).filter(e => e && Number.isFinite(e.t) && typeof e.name === 'string' && e.name !== 'Crash' && e.name !== 'near').slice(0, 400).map(e => ({ t: e.t, t0: Number.isFinite(e.t0) ? e.t0 : e.t - 1.2, name: plain(e.name).slice(0, 60), exec: plain(e.exec || '').slice(0, 12), clean: Number.isFinite(e.clean) ? e.clean : null, obstacle: typeof e.obstacle === 'string' ? plain(e.obstacle).slice(0, 60) : null, conf: Number.isFinite(e.conf) ? e.conf : null, fails: [], verdict: null, actual: null, ...(e.maybe ? { maybe: true } : {}) }));
  openRecap(of.source); recap.review = !!review; renderRecap();
}
// build the reviewer labels from the review in hand (null if nothing is decided yet) and send them (quiet: no modal, for the
// Review Hub, which sends a verdict 10 s after the item closes so Undo can take it back)
function reviewerBuild() {
  const of = recap.guestOf || {}, pl = recapPayload(), L = pl.run.labels.filter(l => !l.undone && l.verdict !== 'unlabelled'); if (!L.length || !of.flight) return null; recap.dirty = false;
  const me = pilotName() || null, labels = L.map(l => ({ ...l, reviewer: true, by: me, byId: telPilot(), runOf: of.name || null, src: of.source, ref: of.ref || null, ...(of.source === 'board' ? { judge: true } : {}) }));   // anyone's review of a leaderboard run is a board vote (pooled with everyone's on that moment); the owner's Judge-the-community and Flight desk verdicts are reviewer labels
  return { of, me, labels, stamp: `${String(of.flight).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30)}-by-${telPilot()}-${Date.now().toString(36)}` };
}
async function reviewerSend(pkg, quiet) {
  const { of, me, labels, stamp } = pkg;
  const go = telQueue('labels', stamp, { format: 'pro-whooper-flight-labels/1', build: '0.1', flight: String(of.flight).slice(0, 40), started: of.started || new Date().toISOString(), pilot: telPilot(), name: me, labels }, true).then(async () => ((await telList()).find(x => x.id === 'labels/' + stamp) || {}).sent ? 'sent' : 'queued').catch(() => 'queued');
  go.then(() => setTimeout(badgesLoad, 4000));
  if (quiet) return go;
  procShow('Saving your review of this run…', `${labels.length} reviewer label${labels.length === 1 ? '' : 's'} for ${of.name || 'this pilot'}'s flight`, 0.2); procCreep(0.9, 2500);
  const r = await procWait(go, 9000);
  procShow(procThanks(), (r === 'sent' ? 'Your reviewer labels were sent to the project.' : 'Your reviewer labels are saved and will be sent as soon as the drop-off can be reached.') + ' A second pair of eyes on a flight is worth a lot.', 1);
  await new Promise(res => setTimeout(res, 1700)); procHide(); return r;
}
async function reviewerSave() {
  const pkg = reviewerBuild(); if (!pkg) { flash('<b>NOTHING TO SEND YET</b><small>give a call ✓, ✗ or "it was…" first</small>', 'near'); return; }
  return reviewerSend(pkg, false);
}
// ============================================================ Judge the community
// Moments from today's posted leaderboard runs (public: each was posted by its pilot's own click, with its replay) where
// the game is unsure or now calls something different from what it called then. Anyone can judge them; the verdicts go
// out as reviewer labels (only the owner, heyheykoolaid, sees this mode).
// The pilot's own runs are left out. Re-flying a run takes a few seconds, so it happens here in the menu, never in flight.
// The moments are listed per map in a carousel like the board's (JG.view; arrows, dots, ← →). Each map's runs are re-flown
// on that map's official layout (built here when it is not the one loaded); watching a moment needs its own scenery, so
// one on another map asks, reloads into it and opens there (store 'judgePending'), like the board's ▶.
const JG = { byMap: {}, msgs: {}, view: null, busy: false, done: store.get('judgeDone', {}), worlds: {} };
const jgKey = c => `${c.id}@${c.t.toFixed(1)}`;
function judgeOpen() { if (!ghMenus()) return; show('#judgeScreen'); if (!S.MAPS[JG.view]) JG.view = MAP_ID; judgeRender(); if (!JG.byMap[JG.view]) judgeLoad(JG.view); }
function jgWorld(id) {   // the official layout of a map, for re-flying runs posted there
  if (id === MAP_ID && !MAP_EDITS) return activeWorld; if (JG.worlds[id]) return JG.worlds[id];
  const mine = id === MAP_ID ? MAP_EDITS : null; if (mine) S.setMapEdits(id, null); try { JG.worlds[id] = S.MAPS[id].build(); } finally { if (mine) S.setMapEdits(id, mine); } return JG.worlds[id]; }
// With the owner key and a new relay, the runs come from the last 3 UTC days of the board (POST /desk), not just today's:
// the board resets at UTC midnight (late afternoon on the west coast), which left nothing to judge for the evening.
const JG_DAYS = 3;
const jgB64 = t => { try { return new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch { return ''; } };
async function jgRecent() {
  if (JG.pool && Date.now() - JG.pool.at < 120000) return JG.pool.runs; const runs = [];
  for (let k = 0; k < JG_DAYS; k++) { const day = new Date(Date.now() - k * 86400000).toISOString().slice(0, 10);
    for (const f of await deskGet('leaderboard/' + day)) { const m = f.type === 'file' && /^(\d{8})-([a-z0-9-]{1,24}?)-([A-Za-z0-9_-]{1,40})-([a-z0-9]{6,40})-(\d{10,16})\.json$/.exec(f.name); if (!m) continue;
      const name = jgB64(m[3]); if (!/^[A-Za-z0-9_. -]{2,24}$/.test(name)) continue; runs.push({ name, score: +m[1], map: m[2], pilot: m[4], at: +m[5], id: f.name.slice(0, -5), day }); } }
  runs.sort((a, b) => b.at - a.at); JG.pool = { at: Date.now(), runs }; return runs; }
async function judgeLoad(id) {
  if (!lbBase()) { JG.msgs[id] = 'Judging needs the online version of the game.'; judgeRender(); return; } if (JG.busy) return; JG.busy = true;
  try {
  JG.msgs[id] = 'Finding moments to judge…'; judgeRender(); let pool = null;
  if (deskVia() === 'relay') { try { pool = await jgRecent(); JG.recent = true; } catch { pool = null; } }
  if (!pool) { JG.recent = false; if (!LB.runs || LB.day !== lbToday()) await lbLoad(lbToday()); pool = (LB.runs || []).map(e => ({ ...e, day: LB.day || lbToday() })); }
  JG.runs = pool; const me = telPilot(), myName = pilotName().toLowerCase(), runs = pool.filter(e => e.map === id && e.id && String(e.name).toLowerCase() !== myName && e.pilot !== me).slice(0, 8), clips = [], W = runs.length ? jgWorld(id) : null;
  if (runs.length) procShow(`Finding moments to judge on ${lbMapTitle(id)}…`, `Re-flying ${JG.recent ? 'recently' : "today's"} posted runs through the current trick detector`, 0.03);
  for (let i = 0; i < runs.length; i++) { const e = runs[i];
    try { let run; if (JG.recent) run = JSON.parse(await deskGet(`leaderboard/${e.day}/${e.id}.json`, true)); else { const r = await fetch(`${lbBase()}/run?day=${e.day}&id=${encodeURIComponent(e.id)}`); if (!r.ok) continue; run = await r.json(); }
      if (!run || typeof run.name !== 'string' || !run.trace || run.map !== id || run.pilot === me) continue;
      const rows = await FlightLog.unpack(run.trace); if (!Array.isArray(rows) || rows.length < TRACE_HZ || !rows.every(x => Array.isArray(x) && x.length >= 27 && x.every(Number.isFinite))) continue;
      await new Promise(res => setTimeout(res, 40));
      const now = S.replayTrace(rows, { world: W, camTilt: Number.isFinite(+run.camTilt) ? +run.camTilt : 20, debug: false }).events.filter(x => x.name !== 'near' && x.name !== 'Crash');
      const then = (Array.isArray(run.events) ? run.events : []).filter(y => y && Number.isFinite(y.t) && typeof y.name === 'string' && !y.maybe).slice(0, 400), of = { of: String(run.name).slice(0, 24), id: e.id, map: id, flight: String(run.flight || e.id).slice(0, 40), rows };
      for (const x of now) { const was = then.find(y => Math.abs(y.t - x.t) < 1), conf = x.watch ? x.watch.conf : 1;
        const why = was && was.name !== x.name ? [3, `called ${was.name.slice(0, 40)} then`] : !was ? [2, 'new call: the game did not call it then'] : conf < 0.75 ? [1, `the game is unsure (${Math.round(conf * 100)}%)`] : null;
        if (why) clips.push({ ...of, name: x.name.slice(0, 60), t: x.t, rank: why[0], why: why[1] }); }
      for (const y of then) if (!now.some(x => Math.abs(x.t - y.t) < 1)) clips.push({ ...of, name: y.name.slice(0, 60), t: y.t, rank: 2, why: 'the game no longer calls it' });
    } catch { /* a run that will not load is skipped */ }
    procShow(`Finding moments to judge on ${lbMapTitle(id)}…`, `${i + 1} of ${runs.length} runs re-flown`, (i + 1) / runs.length); }
  if (runs.length) procHide();
  JG.byMap[id] = clips.sort((a, b) => b.rank - a.rank || a.t - b.t).slice(0, 30);
  JG.msgs[id] = runs.length ? '' : `No runs from other pilots posted on ${lbMapTitle(id)} ${JG.recent ? `in the last ${JG_DAYS} days` : 'today yet'}.`;
  } finally { JG.busy = false; } judgeRender();
}
function judgeView(d) { const ids = Object.keys(S.MAPS).filter(k => !S.MAPS[k].hidden); JG.view = ids[(ids.indexOf(JG.view) + d + ids.length) % ids.length]; judgeRender(); if (!JG.byMap[JG.view]) judgeLoad(JG.view); }
function judgeRender() {
  const el = $('#judgePanel'); if (!el) return; const ids = Object.keys(S.MAPS).filter(k => !S.MAPS[k].hidden), V = S.MAPS[JG.view] ? JG.view : MAP_ID, C = JG.byMap[V] || [], th = (window.PW_MAPTHUMBS || {})[V], myName = pilotName().toLowerCase();
  const pool = JG.runs || LB.runs, count = id => (pool || []).filter(e => e.map === id && String(e.name).toLowerCase() !== myName).length, when = JG.recent ? `in the last ${JG_DAYS} days` : 'today';
  el.innerHTML = `<h2>JUDGE THE COMMUNITY</h2>
    <p class="note">Moments from ${JG.recent ? `the last ${JG_DAYS} days' posted runs` : "today's posted runs"} where the game is unsure, or now calls something different from what it called during the run. Pick a map, open a moment, watch it, and say what it really was (✓, ✗ or "it was actually…"). Your verdicts count as reviewer labels, which the game learns from every week. Your own runs are not in the list.</p>
    <div class="lbCar"><button class="mapArrow" data-jg="prev" aria-label="previous map">‹</button><div class="lbHead" ${th ? `style="background-image:url('${th}')"` : ''}><b>${esc(lbMapTitle(V))}</b><small>${pool ? `${count(V)} run${count(V) === 1 ? '' : 's'} from other pilots ${when}` : 'loading…'}${V === MAP_ID ? ' · you are here' : ''}</small></div><button class="mapArrow" data-jg="next" aria-label="next map">›</button></div>
    <div class="mapDots">${ids.map(id => `<button data-jgmap="${id}" class="${id === V ? 'on' : ''}" title="${esc(lbMapTitle(id))}${pool ? ' · ' + count(id) : ''}" aria-label="${esc(lbMapTitle(id))}"></button>`).join('')}</div>
    ${C.length ? (() => { const hide = store.get('jgHideDone', false), nDone = C.filter(c => JG.done[jgKey(c)]).length, rows = C.map((c, i) => [c, i]).filter(([c]) => !(hide && JG.done[jgKey(c)]));   // owner: a toggle for the judged ones
      return `<div class="row jgTog"><button data-jg="hidedone" class="ghost" ${nDone ? '' : 'disabled'}>${hide ? `Show judged (${nDone})` : `Hide judged (${nDone})`}</button><span class="note">${C.length - nDone} still to judge</span></div>`
        + (rows.length ? `<table class="lbT"><tr><th>Pilot</th><th>Call</th><th>Why it needs a judge</th><th></th></tr>${rows.map(([c, i]) => `<tr data-judge="${i}" title="Open this moment"><td>${esc(c.of)}</td><td>${esc(c.name)}</td><td>${esc(c.why)}</td><td>${JG.done[jgKey(c)] ? '✓ judged' : '▶'}</td></tr>`).join('')}</table>` : '<p class="note">All of these are judged. Thanks!</p>'); })()
      : `<p class="note">${esc(JG.msgs[V] || (JG.byMap[V] ? "Nothing to judge right now: every call in the runs here still agrees, and the game is sure of each." : 'Loading…'))}</p>`}
    ${V !== MAP_ID && C.length ? `<p class="note">These were flown on ${esc(lbMapTitle(V))}: opening one switches your map there.</p>` : ''}
    <div class="row"><button data-jg="refresh">↻ Look again</button><button data-jg="close" class="primary">Back</button></div>`;
}
function judgeClip(i) {
  const c = (JG.byMap[JG.view] || [])[i]; if (!c) return;
  if (c.map !== MAP_ID || MAP_EDITS) {   // its own scenery: switch map (or put the official layout back), then open it there
    const q = c.map !== MAP_ID ? `This moment was flown on ${S.MAPS[c.map].title}. Judging it will change your map to ${S.MAPS[c.map].title}. Is that okay?` : 'Judging uses the official map, so the community map you are on is switched off until the next reload. Is that okay?';
    if (!confirm(q)) return; store.set('judgePending', { map: c.map, id: c.id, t: c.t }); if (c.map !== MAP_ID) store.set('map', c.map); else store.set('layoutOffOnce', true);
    procFlight(telCapture('map'), () => { $('#loading').textContent = 'Loading ' + S.MAPS[c.map].title + '…'; show('#loading'); setTimeout(() => location.reload(), 300); }); return; }
  try { guestOpen(c.rows, [{ t: c.t, t0: c.t - 1.5, name: c.name, exec: '' }], { name: c.of, flight: c.flight, source: 'judge', ref: c.id, clip: jgKey(c) }, true); const it = recapItems()[0]; if (it) recapPlay(it); renderRecap(); }
  catch { JG.msgs[JG.view] = 'That run could not be opened.'; judgeRender(); }
}
setTimeout(async () => { const P = store.get('judgePending', null); if (!P) return; store.set('judgePending', null); if (P.map !== MAP_ID || !ghMenus()) return;
  JG.view = P.map; judgeOpen(); await judgeLoad(P.map); const k = (JG.byMap[P.map] || []).findIndex(c => c.id === P.id && Math.abs(c.t - P.t) < 0.05); if (k >= 0) judgeClip(k); }, 1600);
document.addEventListener('keydown', e => { const sc = $('#judgeScreen'); if (!sc || sc.classList.contains('hide') || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
  if (e.key === 'ArrowLeft') { judgeView(-1); e.preventDefault(); } if (e.key === 'ArrowRight') { judgeView(1); e.preventDefault(); } });
// ▶ next to a run on the board: watch it straight away. A run flown on another map (or on the standard map while the
// pilot has their own layout loaded) asks first, then reloads into the right map and carries on (store 'lbPending').
async function lbPlay(id, map) {
  if (!/^[A-Za-z0-9_-]{10,140}$/.test(id) || !S.MAPS[map]) return; const day = LB.day || lbToday();
  if (map !== MAP_ID || MAP_EDITS) {
    const q = map !== MAP_ID ? `Watching this run will change your map to ${S.MAPS[map].title}. Is that okay?` : 'Watching this run uses the official map, so the community map you are on is switched off until the next reload. Is that okay?';
    if (!confirm(q)) return; store.set('lbPending', { id, day, map }); if (map !== MAP_ID) store.set('map', map); else store.set('layoutOffOnce', true);
    procFlight(telCapture('map'), () => { $('#loading').textContent = 'Loading ' + S.MAPS[map].title + '…'; show('#loading'); setTimeout(() => location.reload(), 300); }); return; }
  LB.view = map; await lbPick(id); await lbWatch();
}
setTimeout(async () => { const P = store.get('lbPending', null); if (!P) return; store.set('lbPending', null); if (P.map !== MAP_ID) return;
  lbOpen('menu'); LB.view = P.map; LB.day = P.day; await lbPick(P.id); await lbWatch(); }, 1500);
async function lbWatch() {
  const R = LB.open; if (!R || !R.run || !R.run.trace || R.run.map !== MAP_ID) return;
  try { guestOpen(await FlightLog.unpack(R.run.trace), R.run.events, { name: R.run.name, flight: R.run.flight || R.id, source: 'board', ref: R.id }, false); }
  catch { LB.open = { id: R.id, run: R.run, error: 'That replay could not be opened.' }; lbRender(); }
}

// ============================================================ Flight desk (the project owner's view of shared flights)
// Shown only on the owner's menus. Since 2026-11-19 it reads through the relay with the owner key (POST /desk: read-only,
// the inbox and the board only, every file cleaned again), so no GitHub token is needed in the browser. With an older
// relay, or no owner key confirmed, it falls back to the GitHub token from Options (Contents: Read on the data repo).
// Tabs: shared flights (with the labels already given on each) and pilots' feedback. Reviewing a flight sends reviewer
// labels through the drop-off as before.
const desk = { repo: store.get('deskRepo', 'heyheykoolaid/openprowhooper-data'), list: null, msg: '', busy: false, info: {}, tab: 'flights', labs: store.get('deskLabs3', {}), labDays: {}, fb: null, fbMsg: '', oldRelay: false };
const deskVia = () => lbBase() && store.get('ownerKey', '') && (store.get('ownerOk', null) || {}).k && !desk.oldRelay ? 'relay' : gh.token ? 'github' : lbBase() && pilotName() && !anonOn() && !desk.noGuest ? 'guest' : null;   // 'guest': any named pilot, through the relay's public /review (flights whose pilots agreed, and labels; nothing else)
const deskRelayOn = () => deskVia() === 'relay' || deskVia() === 'guest';
async function deskRelay(body) {
  const guest = deskVia() === 'guest', r = await fetch(`${lbBase()}/${guest ? 'review' : 'desk'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(guest ? body : { key: store.get('ownerKey', ''), ...body }) });
  if (r.status === 400) { const t = await r.text(); if (/not a Pro Whooper upload/.test(t)) { if (guest) { desk.noGuest = true; throw new Error('noguest'); } desk.oldRelay = true; throw new Error('old'); } throw new Error('400'); }
  if (!r.ok) throw new Error(String(r.status)); return r.json(); }
async function deskGh(path, raw) { const r = await fetch(`https://api.github.com/repos/${desk.repo}/contents/${path}`, { headers: { 'Accept': raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'Authorization': `Bearer ${gh.token}`, 'X-GitHub-Api-Version': '2022-11-28' } }); if (!r.ok) throw new Error(String(r.status)); return raw ? r.text() : r.json(); }
// a folder's entries ([{ name, type, size }]) or one file (raw: its text)
const deskGet = async (path, raw) => {
  if (deskRelayOn()) { try { const j = await deskRelay(raw ? { op: 'get', path } : { op: 'list', path }); return raw ? JSON.stringify(j) : j; } catch (e) { if (e.message !== 'old' || !gh.token) throw e; } }
  if (!gh.token) throw new Error('none'); return deskGh(path, raw); };
// many files at once: { path: parsed file or null }
async function deskGetMany(paths) { const out = {};
  if (deskRelayOn()) { try { for (let i = 0; i < paths.length; i += 40) Object.assign(out, await deskRelay({ op: 'getMany', paths: paths.slice(i, i + 40) })); return out; } catch (e) { if (e.message !== 'old' || !gh.token) throw e; } }
  for (const p of paths) { try { out[p] = JSON.parse(await deskGh(p, true)); } catch { out[p] = null; } } return out; }
const deskErr = err => err.message === 'noguest' ? 'The review queue opens for everyone once the game\'s relay is updated. Check back soon.' : deskVia() === 'guest' ? (err.message === '429' ? 'That is a lot of reviewing: give it a few minutes.' : 'The review queue could not be reached just now.') : err.message === 'old' ? 'The drop-off relay is an older version: redeploy it in Cloudflare (docs/DROPOFF-SETUP.md) to read this with your owner key.' : err.message === 'none' ? 'Save your owner key in Options → Owner (or a GitHub token that can read the data repo).'
  : err.message === '403' && deskVia() !== 'github' ? 'The relay did not accept your owner key.' : err.message === '429' ? 'Too many requests (or wrong keys) from here: wait a little.' : err.message === '401' ? 'GitHub rejected the token (expired or mistyped).' : err.message === '404' && deskVia() === 'github' ? `That token cannot see ${desk.repo}. It needs "Contents: Read" on that repository.` : 'Could not read the shared data just now.';
function deskOpen() { if (!ghMenus()) return; show('#deskScreen'); deskRender(); if (desk.tab === 'feedback') { if (!desk.fb && deskVia()) deskFeedback(); } else if (!desk.list && deskVia()) deskLoad(); }
async function deskLoad() {
  if (desk.busy) return; desk.busy = true; desk.msg = 'Reading the shared flights…'; deskRender();
  try { const days = (await deskGet('telemetry/inbox/flight')).filter(x => x.type === 'dir' && /^\d{4}-\d\d-\d\d$/.test(x.name)).map(x => x.name).sort().reverse().slice(0, 5), list = [];
    for (const day of days) for (const f of await deskGet('telemetry/inbox/flight/' + day)) if (f.type === 'file' && /^\d+-[0-9a-f]+\.json$/.test(f.name)) list.push({ day, file: f.name, size: f.size, at: +f.name.split('-')[0] });
    list.sort((a, b) => b.at - a.at); desk.list = list.slice(0, 120); desk.msg = ''; }
  catch (err) { desk.list = null; desk.msg = deskErr(err); }
  desk.busy = false; deskRender(); await deskDetails(); deskLabels();
}
// fill in who flew what, 40 files at a time (each flight file is read once and remembered while the page is open)
// the desk's data is read while the Flight desk or the Review Hub is open (the hub's owner sections list the same flights)
const deskAway = () => $('#deskScreen').classList.contains('hide') && $('#hubScreen').classList.contains('hide');
const deskHub = () => { if (!$('#hubScreen').classList.contains('hide')) hubRender(); };
async function deskDetails() { const todo = (desk.list || []).slice(0, 60).filter(it => !desk.info[it.file]);
  for (let i = 0; i < todo.length; i += 20) { if (deskAway()) return; const part = todo.slice(i, i + 20);
    let got = {}; try { got = await deskGetMany(part.map(it => `telemetry/inbox/flight/${it.day}/${it.file}`)); } catch { /* shown as unreadable */ }
    for (const it of part) { const p = got[`telemetry/inbox/flight/${it.day}/${it.file}`];
      desk.info[it.file] = p && p.format === 'pro-whooper-flight/1' ? { p, id: typeof p.id === 'string' ? p.id : '', name: typeof p.name === 'string' ? p.name.slice(0, 24) : '', map: String(p.map || '').slice(0, 24), calls: Array.isArray(p.events) ? p.events.filter(e => e && e.name !== 'Crash').length : 0, secs: p.summary && Number.isFinite(p.summary.seconds) ? p.summary.seconds : null, craft: p.craft && p.craft.names && typeof p.craft.names.frame === 'string' ? p.craft.names.frame.slice(0, 40) : '', flagged: Array.isArray(p.events) ? p.events.filter(e => e && e.flagged).length : 0 } : { bad: true }; }
    for (const it of part) { const i = desk.info[it.file]; if (i && i.map === 'training') i.bad = true; }   // Training Room flights sent by earlier builds stay out of every review list
    deskRender(); deskHub(); } }
// the labels already given on each listed flight (the pilot's own and reviewers'), from the label files of the same days
// and the day after; a label file never changes, so its summary is kept between visits (store 'deskLabs')
const deskLabOne = l => { const a = String(l.actual || '').slice(0, 40), t = String(l.target || '').slice(0, 40);
  return a === 'not a trick' ? `✗ ${t}` : t && a && t !== a ? `${t} → ${a}` : `✓ ${a || t}`; };
async function deskLabels() {
  const days = new Set(); for (const it of desk.list || []) { days.add(it.day); const d = new Date(it.day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); days.add(d.toISOString().slice(0, 10)); }
  const want = [];
  for (const day of [...days].sort().reverse()) { if (desk.labDays[day]) continue;
    try { const L = await deskGet('telemetry/inbox/labels/' + day); desk.labDays[day] = true; for (const f of L) if (f.type === 'file' && /^\d+-[0-9a-f]+\.json$/.test(f.name) && !desk.labs[f.name]) want.push({ day, file: f.name }); } catch { /* try again next refresh */ } }
  for (let i = 0; i < want.length; i += 40) { if (deskAway()) break; const part = want.slice(i, i + 40); let got = {};
    try { got = await deskGetMany(part.map(w => `telemetry/inbox/labels/${w.day}/${w.file}`)); } catch { break; }
    for (const w of part) { const p = got[`telemetry/inbox/labels/${w.day}/${w.file}`]; if (!p || !Array.isArray(p.labels)) { desk.labs[w.file] = { bad: 1 }; continue; }
      const L = p.labels.filter(l => l && !l.undone && l.actual && l.actual !== 'unlabelled');
      desk.labs[w.file] = { f: String(p.flight || '').slice(0, 60), by: String(L.find(l => l.by) ? L.find(l => l.by).by : p.name || '').slice(0, 24), rv: L.some(l => l.reviewer) ? 1 : 0, ok: p.ownerVerified ? 1 : 0, L: L.slice(0, 60).map(deskLabOne), T: L.slice(0, 60).filter(l => Number.isFinite(+l.t)).map(l => [+Math.min(+l.t, Number.isFinite(+l.repStart) ? +l.repStart : +l.t).toFixed(1), +(+l.t).toFixed(1), l.judge ? 1 : 0, String(l.actual).slice(0, 40), String(l.by || p.name || '').slice(0, 24)]), at: +w.file.split('-')[0] }; }
    const keys = Object.keys(desk.labs); if (keys.length > 900) for (const k of keys.sort((a, b) => (desk.labs[a].at || 0) - (desk.labs[b].at || 0)).slice(0, keys.length - 900)) delete desk.labs[k];
    store.set('deskLabs3', desk.labs); deskRender(); deskHub(); } }
const deskLabsFor = id => id ? Object.values(desk.labs).filter(x => x && x.f === id) : [];
// The review queue (owner, 2026-11-19: "list the most pressing things that need reviewing"): moments in the listed flights
// that nobody has answered yet, most pressing first: a call the pilot flagged with F, a trick the game missed (Q), the trick
// library's guesses (maybe), then calls the game was unsure of (Watcher < 70 %, the less sure the higher). Newer flights rank a
// little higher, at most 3 moments per flight so one run cannot fill it, 40 in all. A moment counts as answered when any label
// (the pilot's or a reviewer's) covers it, or once you have judged it here (store 'deskQDone').
const DESK_Q = 40, deskQKey = (file, t) => `${file}@${(+t).toFixed(1)}`;
function deskQueue() {
  const done = store.get('deskQDone', {}), out = [], me = pilotName().toLowerCase(), mine = n => String(n || '').toLowerCase() === me;
  // tricks other pilots have labelled (owner, 2026-11-19: "if tricks require multiple verifications, prioritize tricks that other
  // pilots have labelled"): a change to the detector needs evidence from 2+ pilots, so a verdict on such a trick can complete it
  const others = {}; for (const x of Object.values(desk.labs)) for (const T of (x && x.T) || []) if (T[3] && T[3] !== 'not a trick' && !mine(T[4])) (others[T[3]] = others[T[3]] || new Set()).add(String(T[4]).toLowerCase());
  const guestQ = deskVia() === 'guest';
  for (const it of desk.list || []) { const i = desk.info[it.file]; if (!i || i.bad) continue; if (guestQ && mine(i.p.name)) continue; const p = i.p, spans = deskLabsFor(i.id).flatMap(x => x.T || []);
    const near = (t, T) => t >= T[0] - 1.5 && t <= T[1] + 2.5, answered = t => spans.some(T => near(t, T) && !(T[2] && !mine(T[4]))), age = Math.max(0, (Date.now() - it.at) / 86400000), per = [];
    const boost = n => { const k = others[n] ? others[n].size : 0; return k ? [Math.min(20, 10 * k), `; ${k} other pilot${k === 1 ? ' has' : 's have'} labelled ${n}`] : [0, '']; };
    for (const e of Array.isArray(p.events) ? p.events : []) { if (!e || !Number.isFinite(e.t) || typeof e.name !== 'string' || e.name === 'Crash' || e.name === 'near') continue;
      const c = Number.isFinite(e.conf) ? e.conf : 1, pc = `${Math.round(c * 100)} %`;
      const r = e.flagged ? [100, 'the pilot flagged this call as wrong (F)'] : e.maybe ? [60, "the trick library's guess (a maybe)"] : c < 0.5 ? [50 + (0.5 - c) * 40, `the game was very unsure (${pc})`] : c < 0.7 ? [30 + (0.7 - c) * 50, `the game was unsure (${pc})`] : null;
      if (r) { const [bs, bw] = boost(e.name); per.push({ file: it.file, kind: 'call', e, t: e.t, name: e.name.slice(0, 60), score: r[0] + bs - age * 3, why: r[1] + bw }); } }
    for (const m of Array.isArray(p.missed) ? p.missed : []) if (m && Number.isFinite(m.t)) per.push({ file: it.file, kind: 'missed', t: m.t, name: '(a trick the game missed)', score: 90 - age * 3, why: 'the pilot pressed Q: the game missed a trick just before this' });
    // another pilot's vote (a review of a board run): a moment counts in full only once 3 people agree (tools/evidence.js consensus), so a second opinion ranks near the top
    for (const T of spans) if (T[2] && !mine(T[4]) && !spans.some(U => U !== T && !U[2] && near(T[1], U))) { const e = (p.events || []).find(x => x && Number.isFinite(x.t) && near(x.t, T));
      const [bs, bw] = boost(T[3]); per.push({ file: it.file, kind: e ? 'call' : 'missed', vote: T[3], e, t: e ? e.t : T[1], name: e ? String(e.name).slice(0, 60) : `(${T[3]})`, score: 95 + bs - age * 3, why: `${T[4] || 'a pilot'} voted "${T[3]}": it counts once a second pilot agrees${bw}` }); }
    out.push(...per.filter(q => (q.why.includes('voted') || !answered(q.t)) && !done[deskQKey(q.file, q.t)]).sort((a, b) => b.score - a.score).slice(0, 3)); }
  return out.sort((a, b) => b.score - a.score).slice(0, DESK_Q); }
async function deskQOpen(q) {
  const it = (desk.list || []).find(x => x.file === q.file), i = desk.info[q.file]; if (!it || !i || i.bad) return; const p = i.p;
  if (p.map !== MAP_ID) { if (!S.MAPS[p.map]) { desk.msg = 'That flight is on a map this version does not have.'; deskRender(); return; } store.set('deskPending', { file: q.file, t: q.t }); store.set('map', p.map); $('#loading').textContent = 'Loading ' + S.MAPS[p.map].title + '…'; show('#loading'); setTimeout(() => location.reload(), 300); return; }
  try { const said = q.kind !== 'call' && Array.isArray(q.says) && Number.isFinite(q.a) ? q.says.map(nm => ({ t: q.b, t0: Math.min(q.a, q.b - 0.4), name: String(nm), exec: 'PILOTS SAY', maybe: true })) : [];   // what pilots said where the game called nothing: shown like the library's maybes, yours to confirm or correct
    guestOpen(await FlightLog.unpack(p.trace), q.kind === 'call' ? [q.e] : said, { name: p.name || '(no name)', flight: p.id, started: p.started, source: 'desk', ref: `${it.day}/${it.file}`, clip: deskQKey(q.file, q.t) }, true); desk.openFile = q.file;
    if (q.kind === 'call' || said.length) { const x = recapItems()[0]; if (x) recapPlay(x); if (said.length) flash(`<b>PILOTS SAID: ${said.map(x => esc(x.name)).join(' / ').toUpperCase()}</b><small>the game called nothing here: ✓ the one you agree with, or pick what it was</small>`, 'near'); } else { if (recap.play) recapSeek(Math.max(0, q.t - 4)); flash(q.vote ? `<b>A PILOT VOTED: ${esc(q.vote)}</b><small>the game made no call here: add the trick at the red line if you agree</small>` : '<b>THE PILOT PRESSED Q HERE</b><small>the game missed a trick just before: add what they flew at the red line</small>', 'near'); }
    renderRecap(); }
  catch { desk.msg = 'That flight could not be opened.'; deskRender(); } }
// pilots' feedback (Options → Send feedback), newest first, the last 7 days
async function deskFeedback() {
  if (desk.busy) return; desk.busy = true; desk.fbMsg = 'Reading feedback…'; deskRender();
  try { const days = (await deskGet('telemetry/inbox/feedback')).filter(x => x.type === 'dir' && /^\d{4}-\d\d-\d\d$/.test(x.name)).map(x => x.name).sort().reverse().slice(0, 7), paths = [];
    for (const day of days) for (const f of await deskGet('telemetry/inbox/feedback/' + day)) if (f.type === 'file' && /^\d+-[0-9a-f]+\.json$/.test(f.name)) paths.push(`telemetry/inbox/feedback/${day}/${f.name}`);
    paths.sort((a, b) => +b.split('/').pop().split('-')[0] - +a.split('/').pop().split('-')[0]); const got = await deskGetMany(paths.slice(0, 120));
    desk.fb = paths.slice(0, 120).map(p => ({ at: +p.split('/').pop().split('-')[0], f: got[p] })).filter(x => x.f && typeof x.f.text === 'string'); desk.fbMsg = desk.fb.length ? '' : 'No feedback in the last 7 days.'; }
  catch (err) { desk.fb = null; desk.fbMsg = deskErr(err); }
  desk.busy = false; deskRender(); }
function deskRender() {
  const el = $('#deskPanel'); if (!el) return; const L = desk.list || [], done = store.get('deskDone', {}), via = deskVia(), fbT = desk.tab === 'feedback', qT = desk.tab === 'queue', Q = desk.list ? deskQueue() : []; desk.q = Q;
  const src = via === 'relay' ? 'through the drop-off with your owner key' : via === 'github' ? `from <b>${esc(desk.repo)}</b> with your GitHub token` : '';
  el.innerHTML = `<div class="row" style="justify-content:space-between"><h2>Flight desk</h2><button data-desk="close">Back</button></div>
    <div class="row"><button data-desk="tab-queue" class="${qT ? 'primary' : 'ghost'}">Review queue${desk.list ? ` (${Q.length})` : ''}</button><button data-desk="tab-flights" class="${fbT || qT ? 'ghost' : 'primary'}">Shared flights</button><button data-desk="tab-feedback" class="${fbT ? 'primary' : 'ghost'}">Feedback</button></div>
    ${!via ? '<p class="warn">Save your owner key in Options → Owner. (An older drop-off relay needs a GitHub token in Options instead, one that can read the data repo.)</p>' : ''}
    ${qT ? `<p class="note">The moments most worth your verdict in the last ${L.length || ''} shared flights, most pressing first: calls a pilot flagged (F), tricks the game missed (Q), the trick library's guesses, then calls the game was unsure of. Anything a pilot or reviewer already answered is left out, and so is each one you judge here.</p>
    <div class="row"><button data-desk="refresh" ${via ? '' : 'disabled'}>↻ Refresh</button><span class="note">${esc(desk.msg || (desk.list ? (Q.length ? `${Q.length} moments to review` : (Object.keys(desk.info).length < Math.min(60, L.length) ? 'Reading flights…' : 'Nothing waiting. Nice!')) : ''))}</span></div>
    <div class="deskList"><table class="lbT"><tr><th>When</th><th>Pilot</th><th>Map</th><th>Call</th><th>Why it needs you</th><th></th></tr>
    ${Q.map((q, k) => { const it = L.find(x => x.file === q.file), i = desk.info[q.file], when = new Date(it.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<tr data-deskq="${k}" title="Open this moment"><td>${esc(when)}</td><td>${esc(i.name || '(no name)')}</td><td>${esc(lbMapTitle(i.map))}</td><td>${esc(q.name)}</td><td>${esc(q.why)}</td><td>▶</td></tr>`; }).join('')}</table></div>`
    : fbT ? `<p class="note">What pilots sent with "Send feedback", read ${src}. Newest first, the last 7 days.</p>
    <div class="row"><button data-desk="refresh" ${via ? '' : 'disabled'}>↻ Refresh</button><span class="note">${esc(desk.fbMsg || (desk.fb ? `${desk.fb.length} messages` : ''))}</span></div>
    <div class="deskList">${(desk.fb || []).map(x => { const f = x.f, c = f.context && typeof f.context === 'object' ? f.context : {}, when = new Date(x.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="deskFb"><div class="note"><b>${esc(String(f.name || '(no name)').slice(0, 24))}</b> · ${esc(when)} · ${esc(String(f.category || '').slice(0, 30))}${c.screen ? ' · ' + esc(String(c.screen).slice(0, 20)) : ''}${c.map ? ' · ' + esc(lbMapTitle(String(c.map).slice(0, 24))) : ''}</div><div>${esc(f.text.slice(0, 4000))}</div></div>`; }).join('')}</div>`
    : `<p class="note">Flights pilots chose to share, read ${src}. Open one to watch it and judge its tricks: your verdicts are sent as reviewer labels, separate from the pilot's own. The Labels column is what was already said about it (hover for the list).</p>
    <div class="row"><button data-desk="refresh" ${via ? '' : 'disabled'}>↻ Refresh</button><span class="note">${esc(desk.msg || (L.length ? `${L.length} flights, newest first` : ''))}</span></div>
    <div class="deskList"><table class="lbT"><tr><th>When</th><th>Pilot</th><th>Map</th><th>Whoop</th><th>Length</th><th>Calls</th><th>Labels</th><th></th></tr>
    ${L.map(it => { const i = desk.info[it.file], when = new Date(it.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), labs = i && !i.bad ? deskLabsFor(i.id) : [];
      const own = labs.filter(x => !x.rv).reduce((n, x) => n + x.L.length, 0), rev = labs.filter(x => x.rv), rvN = rev.reduce((n, x) => n + x.L.length, 0), tip = labs.map(x => `${x.by || '?'}${x.rv ? ' (reviewer)' : ''}: ${x.L.join(', ')}`).join('\n');
      const lab = own || rvN ? `<span title="${esc(tip)}">${own ? `pilot ${own}` : ''}${own && rvN ? ' · ' : ''}${rvN ? `reviewed ${rvN} (${esc([...new Set(rev.map(x => x.by || '?'))].join(', '))})` : ''}</span>` : '';
      return `<tr data-deskfile="${esc(it.file)}" class="${done[it.file] ? 'me' : ''}"><td>${esc(when)}</td><td>${i && !i.bad ? esc(i.name || '(no name)') : '…'}</td><td>${i && !i.bad ? esc(lbMapTitle(i.map)) : ''}</td><td>${i && !i.bad ? esc(i.craft) : ''}</td><td>${i && i.secs ? fmtT(i.secs) : ''}</td><td>${i && !i.bad ? i.calls + (i.flagged ? ` · ${i.flagged} flagged` : '') : i && i.bad ? 'unreadable' : ''}</td><td>${lab}</td><td>${done[it.file] ? '✓ reviewed' : ''}</td></tr>`; }).join('')}</table></div>`}`;
}
async function deskPick(file) {
  const it = (desk.list || []).find(x => x.file === file), i = desk.info[file]; if (!it || !i || i.bad) return; const p = i.p;
  if (p.map !== MAP_ID) { if (!S.MAPS[p.map]) { desk.msg = 'That flight is on a map this version does not have.'; deskRender(); return; } store.set('deskPending', file); store.set('map', p.map); $('#loading').textContent = 'Loading ' + S.MAPS[p.map].title + '…'; show('#loading'); setTimeout(() => location.reload(), 300); return; }   // the flight's own map, then straight back here
  try { guestOpen(await FlightLog.unpack(p.trace), p.events, { name: p.name || '(no name)', flight: p.id, started: p.started, source: 'desk', ref: `${it.day}/${it.file}` }, true); desk.openFile = file; }
  catch { desk.msg = 'That flight could not be opened.'; deskRender(); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-desk]'), row = e.target.closest('[data-deskfile]');
  if (b) { const a = b.dataset.desk; if (a === 'close') show('#toolsScreen'); if (a === 'refresh') { if (desk.tab === 'feedback') { desk.fb = null; deskFeedback(); } else { desk.list = null; desk.labDays = {}; deskLoad(); } }
    if (a === 'tab-flights' || a === 'tab-feedback' || a === 'tab-queue') { desk.tab = a.slice(4); deskOpen(); } return; }
  const qr = e.target.closest('[data-deskq]'); if (qr) { const q = (desk.q || [])[+qr.dataset.deskq]; if (q) deskQOpen(q); return; }
  if (row) deskPick(row.dataset.deskfile);
  const act = e.target.closest('[data-act]'); if (act && act.dataset.act === 'desk') deskOpen();
});
// came back from a map change made to open a flight: carry on to it
setTimeout(async () => { const P = store.get('deskPending', null); if (!P) return; store.set('deskPending', null); if (!ghMenus() || !deskVia()) return; const f = typeof P === 'string' ? P : P.file; if (typeof P !== 'string') desk.tab = 'queue';
  deskOpen(); for (let k = 0; k < 60 && !(desk.info[f]); k++) await new Promise(r => setTimeout(r, 500)); const i = desk.info[f]; if (!i || i.bad) return;
  if (typeof P === 'string') { deskPick(f); return; }   // a review-queue moment: the call at that time, or the Q press
  const e = (i.p.events || []).find(x => x && Number.isFinite(x.t) && Math.abs(x.t - P.t) < 0.05); deskQOpen(e ? { file: f, kind: 'call', e, t: e.t, name: e.name } : { file: f, kind: 'missed', t: P.t }); }, 1500);

document.addEventListener('click', e => {
  { const pb = e.target.closest('[data-lbplay]'); if (pb) { lbPlay(pb.dataset.lbplay, pb.dataset.lbmap); return; } }
  const b = e.target.closest('[data-lb]'), row = e.target.closest('[data-lbrun]');
  if (b) { const a = b.dataset.lb; if (a === 'post') lbPost(); if (a === 'open') lbOpen(); if (a === 'refresh') lbLoad(lbToday()).then(lbRender);
    if (a === 'watch') lbWatch(); if (a === 'prev' || a === 'next') lbView(a === 'next' ? 1 : -1);
    if (a === 'close') { if (LB.from === 'results' && LB.last) show('#resultsScreen'); else { mode = 'menu'; show('#mainMenu'); } } return; }
  { const m = e.target.closest('[data-lbmap]'); if (m && S.MAPS[m.dataset.lbmap]) { LB.view = m.dataset.lbmap; LB.open = null; lbRender(); return; } }
  if (row && row.dataset.lbrun) { if ($('#lbScreen').classList.contains('hide')) { lbOpen('results'); } lbPick(row.dataset.lbrun); }
  const act = e.target.closest('[data-act]'); if (act && act.dataset.act === 'board') lbOpen('menu'); if (act && act.dataset.act === 'judge') judgeOpen();
  const jg = e.target.closest('[data-jg]'), jr = e.target.closest('[data-judge]');
  const jm = e.target.closest('[data-jgmap]'); if (jm) { JG.view = jm.dataset.jgmap; judgeRender(); if (!JG.byMap[JG.view]) judgeLoad(JG.view); return; }
  if (jg) { const a = jg.dataset.jg; if (a === 'hidedone') { store.set('jgHideDone', !store.get('jgHideDone', false)); judgeRender(); return; } if (a === 'close') { mode = 'menu'; show('#mainMenu'); } if (a === 'prev' || a === 'next') judgeView(a === 'next' ? 1 : -1); if (a === 'refresh') { delete JG.byMap[JG.view]; LB.runs = null; JG.pool = null; judgeLoad(JG.view); } return; }
  if (jr) { judgeClip(+jr.dataset.judge); return; }
});
window.__pw.board = { get state() { return LB; }, open: () => lbOpen('menu') };
// ============================================================ The move to openprowhooper.com (owner, 2026-11-20)
// Each web address keeps its own saved data, so a copy served from the old address (GitHub Pages) offers to move the pilot to
// the new home (moved.txt → window.PW_MOVED_TO) with everything they have saved: name and pilot id, settings and tune, rates,
// builds, controls, their own maps and tracks, review progress. Waiting flights are sent first. The data rides in the address
// after '#' (never sent to any server) and is unpacked by the new page before the game starts (index.template.html). Left
// behind on purpose: the GitHub token and the owner key (typed again on the new site) and the Flight desk's label cache.
const MOVE_SKIP = /^pw\.(ownerKey|ownerOk|deskLabs\d*|deskQDone|movedIn|moveAsked)$/;
function moveTarget() { try { const to = window.PW_MOVED_TO; if (!to || !/^https?:/.test(location.protocol) || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return null; const u = new URL(to); return u.origin === location.origin ? null : u; } catch { return null; } }
async function movePack(dropBig) {
  const keys = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k || !k.startsWith('pw.') || MOVE_SKIP.test(k)) continue; let v = localStorage.getItem(k);
    if (k === 'pw.ghsync') { try { const g = JSON.parse(v); delete g.token; v = JSON.stringify(g); } catch { continue; } }   // the token never travels
    if (dropBig && (k.startsWith('pw.rg.best.') || k === 'pw.commMaps')) continue;   // ghosts and downloaded maps come back from the board
    keys[k] = v; }
  const raw = new TextEncoder().encode(JSON.stringify({ format: 'pro-whooper-move/1', from: location.origin, at: Date.now(), keys }));
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  let bin = ''; for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
  return { data: btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), n: Object.keys(keys).length };
}
async function moveGo() {
  const to = moveTarget(); if (!to) return; const box = $('#moveBox'); if (box) box.remove();
  procShow('Moving to ' + to.host + '…', 'Sending any flights still waiting, then packing your pilot, settings and maps', 0.1); procCreep(0.6, 8000);
  try { await Promise.race([telPump(true), new Promise(r => setTimeout(r, 12000))]); } catch { /* what is still waiting stays here */ }
  let p = await movePack(false); if (p.data.length > 1500000) p = await movePack(true);
  procShow('Moving to ' + to.host + '…', `${p.n} saved things packed: opening the new address`, 0.95);
  setTimeout(() => location.replace(to.origin + to.pathname + '#pwmove=' + p.data), 300);
}
setTimeout(() => { const to = moveTarget(); if (!to || $('#moveBox')) return;
  const el = document.createElement('div'); el.id = 'moveBox';
  el.innerHTML = `<div class="panel"><h2>Open Pro Whooper has moved</h2><p>The game now lives at <b>${esc(to.host)}</b>. Your pilot name, settings, rates, builds, controls and maps come with you in one click.</p>
    <p class="note">Your GitHub token${ghMenus() ? ' and owner key' : ''} stay behind: type them again on the new site if you use them. Bookmark the new address.</p>
    <div class="row"><button class="primary" data-move="go">Take me there with my data</button><button class="ghost" data-move="later">Not now</button></div></div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { const b = e.target.closest('[data-move]'); if (!b) return; if (b.dataset.move === 'go') moveGo(); else el.remove(); });
}, 2500);
// arrived from the old address: say so once
setTimeout(() => { const m = store.get('movedIn', null); if (!m || m.shown) return; store.set('movedIn', { ...m, shown: true }); flash(`<b>WELCOME TO ${esc(location.host.toUpperCase())}</b><small>${m.keys ? `${m.keys} saved things came with you` : 'your saved data was already here'} · bookmark this address</small>`, 'good'); }, 3000);
