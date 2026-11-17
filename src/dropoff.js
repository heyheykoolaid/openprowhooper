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
const isRidgeRipper = () => pilotName().toLowerCase().replace(/[^a-z0-9]/g, '') === 'ridgeripperfpv';
const TEL = { relay: (window.PW_DROPOFF || '').trim(), minSeconds: 20, minArmed: 10, perDay: 40, keep: 40, part: 120000 };
const telState = { busy: false, last: '', mem: [], route: null };
const saveTel = () => store.set('telemetry', { on: tel.on, asked: tel.asked, pilot: tel.pilot });
function telPilot() { if (!tel.pilot) { tel.pilot = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); saveTel(); } return tel.pilot; }
const telStamp = r => `${r.started.replace(/[:.]/g, '-')}-${r.id}`;
function telSet(on) { tel.on = !!on; tel.asked = true; saveTel(); if (tel.on) { telPilot(); telPump(true); } telRenderStatus(); }

// ---- what leaves: one finished run. Called while the run's arrays are still in place; packs in the background.
function telCapture(reason) {
  if (!tel.on || !recap.id || recap.telDone === recap.id || race.on) return;
  const rows = recap.trace; if (rows.length < TEL.minSeconds * TRACE_HZ) return;
  let armed = 0; for (const r of rows) armed += r[13]; if (armed < TEL.minArmed * TRACE_HZ) return;
  const day = new Date().toISOString().slice(0, 10), cnt = store.get('telDay', { day, n: 0 }); if (cnt.day !== day) { cnt.day = day; cnt.n = 0; }
  if (cnt.n >= TEL.perDay) return; cnt.n++; store.set('telDay', cnt);
  recap.telDone = recap.id;
  const head = { format: 'pro-whooper-flight/1', build: '0.1', id: recap.id, started: recap.started, ended: reason, pilot: telPilot(), name: pilotName() || null, map: MAP_ID,
    mode: recap.mode || 'free', camTilt: tune.camTilt, camFov: tune.camFov,
    // the whoop as configured in the Garage: part ids and names, and what they add up to
    craft: { ...spec, names: params.names || null, stats: params.stats ? { auw: +params.stats.auw.toFixed(2), twr: +params.stats.twr.toFixed(2), hoverThrottle: +params.stats.hoverThrottle.toFixed(3) } : null },
    tune: JSON.parse(JSON.stringify(tune)), profile: store.get('pilot', null), input: inputCfg.mode,
    score: score ? { total: score.total, maxStreak: +score.maxStreak.toFixed(2) } : null,
    events: recap.events.map(e => ({ t: e.t, t0: e.t0, name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, conf: e.conf, fails: e.fails && e.fails.length ? e.fails : undefined, flagged: e.flag ? true : undefined })),
    missed: recap.flags.map(f => ({ t: f.t })) };
  const stamp = telStamp(recap);
  (async () => { try { head.summary = FlightLog.summary(rows, TRACE_COLS, TRACE_HZ); head.trace = await FlightLog.pack(rows, TRACE_COLS, TRACE_HZ); await telQueue('flight', stamp, head); } catch (err) { telState.last = 'could not pack the last flight'; telRenderStatus(); } })();
}

// ---- the waiting list (IndexedDB, falling back to memory)
async function telList() { const a = await idb.all('telemetry'); return (a.length ? a : telState.mem).slice().sort((x, y) => (x.at < y.at ? -1 : 1)); }
async function telStore(item) { const ok = await idb.ok(); if (ok) await idb.put('telemetry', item); else { const i = telState.mem.findIndex(x => x.id === item.id); if (i >= 0) telState.mem[i] = item; else telState.mem.push(item); } }
async function telQueue(kind, name, payload) {
  await telStore({ id: `${kind}/${name}`, kind, name, at: new Date().toISOString(), body: JSON.stringify(payload), sent: null });
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
  try { const r = await fetch(TEL.relay, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: it.kind, name: it.name, payload: JSON.parse(it.body) }) }); return r.status; } catch { return 0; }
}
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
  if (telState.busy) return; if (!force && telState.retryAt && Date.now() < telState.retryAt) return; telState.busy = true;
  try {
    for (const it of await telList()) { if (it.sent) continue; if (it.kind !== 'feedback' && !tel.on) continue;
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
    <details class="optExplain"><summary>What it does, why, and what is not sent</summary>
      <p><b>What it does:</b> when a Free Fly or Session run ends, the game sends that run to the project: the flight path and attitude, your stick and throttle movements, every trick the game called (with how sure it was), your F / Q flags, and your craft, rates and camera tilt. About 30–80 KB a minute; runs under ${TEL.minSeconds} seconds and RaceGOW laps are skipped.</p>
      <p><b>Why:</b> real flying is what the trick rules are tuned against. Each flight can be re-flown through new versions of the detector to see which calls change, and the unsure calls show which rules need work.</p>
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
function pilotShowName() { const el = $('#menuPilot'); if (el) el.textContent = pilotName() ? `pilot: ${pilotName()}` : ''; }
function pilotAsk() {
  const el = $('#pilotModal'); el.classList.remove('hide');
  el.innerHTML = `<div class="fbPanel"><h3>Welcome, pilot. What's your name?</h3>
    <input type="text" id="pilotNameIn" maxlength="24" placeholder="your pilot name or handle" value="${esc(pilotName())}" onkeydown="event.stopPropagation()" autocomplete="off">
    ${tel.asked ? '' : `<p><b>Help make the trick detection better?</b> If you say yes, the game shares each run with the project when it ends: flight path, sticks, the tricks it called, your flags, and this name. No e-mail, nothing about your device. You can change it any time in Options.</p>`}
    <p class="note" id="pilotMsg"></p>
    <div class="row">${tel.asked ? '<button data-pilot="go" class="primary">Let\'s fly</button>' : '<button data-pilot="yes" class="primary">Share my flights &amp; start</button><button data-pilot="no">Start without sharing</button>'}</div></div>`;
  setTimeout(() => $('#pilotNameIn') && $('#pilotNameIn').focus(), 30);
}
// then recommend the Pilot Warm-up to anyone who has no profile yet (once; it stays on the main menu)
function pilotWarmAsk() {
  if (store.get('pilot', null) || store.get('warmAsked', false)) return;
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
  const pb = e.target.closest('[data-pilot]'); if (pb) { const n = cleanName($('#pilotNameIn').value);
    if (n.length < 2) { $('#pilotMsg').textContent = 'Pick a name with at least 2 characters.'; $('#pilotNameIn').focus(); return; }
    store.set('pilotName', n); pilotShowName(); $('#pilotModal').classList.add('hide');
    if (pb.dataset.pilot === 'warm') { startWarmup(); return; } if (pb.dataset.pilot === 'later') { store.set('warmAsked', true); return; }
    if (pb.dataset.pilot !== 'go') { telSet(pb.dataset.pilot === 'yes'); if (tel.on) flashNote('Sharing is on — thank you! (Options to change)'); }
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
setTimeout(async () => { if (!pilotName()) pilotAsk(); else pilotWarmAsk(); telPump(); }, 1200);
window.__pw.pilot = { get name() { return pilotName(); }, ask: () => pilotAsk(), get farts() { return isRidgeRipper(); }, crashSound: () => (isRidgeRipper() ? crashFart() : crashThud()) };
window.__pw.tel = { get state() { return { ...tel, ...telState }; }, set: on => telSet(on), capture: r => telCapture(r), list: () => telList(), pump: () => telPump() };

// ============================================================ Daily leaderboard (2:00 Sessions)
// A 2:00 Session can be posted to the day's board. Posting is the player's own click, every time: it publishes their
// pilot name, the score, the scoring sheet and the replay of that run through the relay (docs/DATA.md). The board is the
// day's best run per pilot and map; days turn over at 00:00 UTC. Clicking a run shows its scoring sheet and plays it.
// Everything that comes back from the board is other people's text: always escaped, never run.
const LB = { last: null, runs: null, day: null, msg: '', mapOnly: true, open: null, posted: {} };
const lbBase = () => TEL.relay ? TEL.relay.replace(/\/+$/, '') : '';
const lbToday = () => new Date().toISOString().slice(0, 10);
const lbNameOk = n => /^[A-Za-z0-9_. -]{2,24}$/.test(n);
const lbMapTitle = id => (S.MAPS[id] && S.MAPS[id].title) || id;
function lbSessionOver(r) {   // called by endSession while the run's arrays are still in place
  const rows = recap.trace; let i0 = rows.findIndex(x => x[13]); i0 = Math.max(0, (i0 < 0 ? 0 : i0) - TRACE_HZ);
  LB.last = { id: recap.id, total: Math.round(r.total), map: MAP_ID, rows: rows.slice(i0, i0 + 19900),
    totals: { trick: r.trickScore, switchMult: r.switchMult(), kwad: r.kwadBonus, streak: +r.maxStreak.toFixed(2), obstacles: r.uniqueObs.size },
    sheet: r.log.filter(x => x.net || x.exec === 'CRASH').slice(0, 400).map(x => ({ name: x.name, exec: x.exec, net: x.net, base: x.base, obstacle: x.obstacle || undefined })),
    events: recap.events.slice(0, 400).map(e => ({ t: e.t, t0: e.t0, name: e.name, exec: e.exec })) };
  lbResultsBox(); lbLoad(lbToday()).then(lbResultsBox);
}
async function lbLoad(day) {
  if (!lbBase()) { LB.msg = 'The leaderboard needs the online version of the game.'; return; }
  LB.day = day; LB.msg = 'Loading…';
  try { const r = await fetch(`${lbBase()}/board?day=${day}`); if (!r.ok) throw 0; const j = await r.json(); LB.runs = Array.isArray(j.runs) ? j.runs.filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score)).slice(0, 100) : []; LB.msg = ''; }
  catch { LB.runs = null; LB.msg = 'Could not reach the leaderboard just now.'; }
}
const lbRows = (runs, max, me) => runs.slice(0, max).map((e, i) => `<tr data-lbrun="${esc(e.id || '')}" class="${me && e.name === me ? 'me' : ''}" title="Click for the scoring sheet and the replay"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${Number(e.score).toLocaleString()}</td><td>${esc(lbMapTitle(e.map))}</td></tr>`).join('');
function lbResultsBox() {
  const el = $('#lbBox'), L = LB.last; if (!el || !L) return;
  const runs = (LB.runs || []).filter(e => e.map === L.map), name = pilotName(), done = LB.posted[L.id];
  const can = lbBase() && L.total > 0, why = !lbBase() ? 'The leaderboard needs the online version of the game.' : L.total <= 0 ? 'Score something to post a run.' : !lbNameOk(name) ? 'Leaderboard names use letters, numbers, spaces and _ . - (2 to 24). Change yours in Options.' : '';
  el.innerHTML = `<h3>TODAY'S LEADERBOARD <small>${esc(lbMapTitle(L.map))} · resets 00:00 UTC</small></h3>
    ${runs.length ? `<table class="lbT">${lbRows(runs, 5, name)}</table>` : `<p class="note">${esc(LB.msg || 'No runs posted on this map yet today. Yours could be first.')}</p>`}
    <div class="row">${done ? `<span class="note">✓ ${esc(done)}</span>` : can && !why ? `<button data-lb="post" class="primary">Post this run as ${esc(name)}</button>` : ''}<button data-lb="open">Full leaderboard</button></div>
    <p class="note">${done ? '' : why || 'Posting puts your pilot name, score, scoring sheet and the replay of this run on the public board for the day.'}</p>`;
}
async function lbPost() {
  const L = LB.last, name = pilotName(); if (!L || LB.posted[L.id] || !lbBase() || !lbNameOk(name) || L.total <= 0 || LB.busy) return; LB.busy = true;
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
function lbOpen(from) { LB.from = from || (mode === 'menu' ? 'menu' : 'results'); LB.open = null; show('#lbScreen'); lbRender(); lbLoad(lbToday()).then(lbRender); }
function lbRender() {
  const el = $('#lbPanel'); if (!el) return; const day = LB.day || lbToday(), today = lbToday(), runs = (LB.runs || []).filter(e => !LB.mapOnly || e.map === MAP_ID), R = LB.open;
  el.innerHTML = `<h2>DAILY LEADERBOARD</h2>
    <p class="note">Best 2:00 Session per pilot. Today's board only: a new one starts every day at 00:00 UTC. Scores are what each player's game reported. Click a run to see how it was scored and watch it.</p>
    <div class="row"><b>Today</b>
      <label class="chk"><input type="checkbox" id="lbMapOnly" ${LB.mapOnly ? 'checked' : ''}> only ${esc(lbMapTitle(MAP_ID))}</label><button data-lb="refresh">↻</button></div>
    <div class="lbCols"><div>${runs.length ? `<table class="lbT"><tr><th>#</th><th>Pilot</th><th>Score</th><th>Map</th></tr>${lbRows(runs, 100, pilotName())}</table>` : `<p class="note">${esc(LB.msg || 'No runs posted yet. Fly a 2:00 Session and post it from the results screen.')}</p>`}</div>
    <div id="lbRun">${R ? lbRunHtml(R) : '<p class="note">Pick a run.</p>'}</div></div>
    <div class="row"><button data-lb="close" class="primary">Back</button></div>`;
}
function lbRunHtml(R) {
  if (R.loading) return '<p class="note">Loading the run…</p>'; if (R.error) return `<p class="note">${esc(R.error)}</p>`;
  const p = R.run, T = p.totals || {}, sheet = Array.isArray(p.sheet) ? p.sheet.slice(0, 400) : [], canWatch = p.trace && p.map === MAP_ID, num = v => Number.isFinite(+v) ? (+v).toLocaleString() : '—';
  return `<h3>${esc(p.name)} · ${num(p.score)}</h3>
    <p class="note">${esc(lbMapTitle(p.map))}${T.trick != null ? ` · trick score ${num(T.trick)} × switch ${esc(T.switchMult)} + K.W.A.D. ${num(T.kwad)}` : ''}${T.streak != null ? ` · max streak ×${esc(T.streak)}` : ''}${T.obstacles != null ? ` · obstacles ${esc(T.obstacles)}` : ''}</p>
    <div class="row">${canWatch ? '<button data-lb="watch" class="primary">▶ Watch the run</button>' : `<span class="note">${p.trace ? 'Flown on ' + esc(lbMapTitle(p.map)) + ': switch to that map (Maps) to watch it.' : 'No replay was posted with this run.'}</span>`}</div>
    <ol class="lbSheet">${sheet.map(x => `<li>${esc(x.name)}${x.obstacle ? ' <small>' + esc(x.obstacle) + '</small>' : ''} <span class="${/^[A-Z]+$/.test(x.exec) ? x.exec : ''}">${esc(x.exec)}</span> +${num(x.net)}</li>`).join('') || '<li>no scoring sheet</li>'}</ol>`;
}
async function lbPick(id) {
  if (!/^[A-Za-z0-9_-]{10,140}$/.test(id) || !lbBase()) return; LB.open = { id, loading: true }; lbRender();
  try { const r = await fetch(`${lbBase()}/run?day=${LB.day || lbToday()}&id=${encodeURIComponent(id)}`); if (!r.ok) throw 0; const run = await r.json(); if (!run || typeof run.name !== 'string') throw 0; if (LB.open && LB.open.id === id) LB.open = { id, run }; }
  catch { if (LB.open && LB.open.id === id) LB.open = { id, error: 'Could not load that run.' }; }
  lbRender();
}
// someone else's run in the replay viewer: a guest run is never saved, reviewed or shared from here
async function lbWatch() {
  const R = LB.open; if (!R || !R.run || !R.run.trace || R.run.map !== MAP_ID) return;
  try { const rows = await FlightLog.unpack(R.run.trace); if (!Array.isArray(rows) || rows.length < TRACE_HZ || !rows.every(r => Array.isArray(r) && r.length >= 27 && r.every(Number.isFinite))) throw 0;
    LB.keep = { trace: recap.trace, events: recap.events, flags: recap.flags, id: recap.id, started: recap.started, mode: recap.mode, dirty: recap.dirty, telDone: recap.telDone };   // the player's own run comes back afterwards
    recapReset(); recap.guest = true; recap.trace = rows; recap.telDone = recap.id;
    recap.events = (Array.isArray(R.run.events) ? R.run.events : []).filter(e => e && Number.isFinite(e.t) && typeof e.name === 'string').slice(0, 400).map(e => ({ t: e.t, t0: Number.isFinite(e.t0) ? e.t0 : e.t - 1.2, name: e.name.slice(0, 60), exec: String(e.exec || '').slice(0, 12), clean: null, obstacle: null, conf: null, fails: [], verdict: null, actual: null }));
    store.set('recapReview', store.get('recapReview', true)); openRecap('board'); recap.review = false; renderRecap();
  } catch { LB.open = { id: R.id, run: R.run, error: 'That replay could not be opened.' }; lbRender(); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lb]'), row = e.target.closest('[data-lbrun]');
  if (b) { const a = b.dataset.lb; if (a === 'post') lbPost(); if (a === 'open') lbOpen(); if (a === 'refresh') lbLoad(lbToday()).then(lbRender);
    if (a === 'watch') lbWatch();
    if (a === 'close') { if (LB.from === 'results' && LB.last) show('#resultsScreen'); else { mode = 'menu'; show('#mainMenu'); } } return; }
  if (row && row.dataset.lbrun) { if ($('#lbScreen').classList.contains('hide')) { lbOpen('results'); } lbPick(row.dataset.lbrun); }
  const act = e.target.closest('[data-act]'); if (act && act.dataset.act === 'board') lbOpen('menu');
});
document.addEventListener('change', e => { if (e.target.id === 'lbMapOnly') { LB.mapOnly = e.target.checked; lbRender(); } });
window.__pw.board = { get state() { return LB; }, open: () => lbOpen('menu') };
