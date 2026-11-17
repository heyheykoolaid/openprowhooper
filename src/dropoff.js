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
function telSet(on) { tel.on = !!on; tel.asked = true; saveTel(); if (tel.on) { telPilot(); telPump(); } telRenderStatus(); }

// ---- what leaves: one finished run. Called while the run's arrays are still in place; packs in the background.
function telCapture(reason) {
  if (!tel.on || !recap.id || recap.telDone === recap.id || race.on) return;
  const rows = recap.trace; if (rows.length < TEL.minSeconds * TRACE_HZ) return;
  let armed = 0; for (const r of rows) armed += r[13]; if (armed < TEL.minArmed * TRACE_HZ) return;
  const day = new Date().toISOString().slice(0, 10), cnt = store.get('telDay', { day, n: 0 }); if (cnt.day !== day) { cnt.day = day; cnt.n = 0; }
  if (cnt.n >= TEL.perDay) return; cnt.n++; store.set('telDay', cnt);
  recap.telDone = recap.id;
  const head = { format: 'pro-whooper-flight/1', build: '0.1', id: recap.id, started: recap.started, ended: reason, pilot: telPilot(), name: pilotName() || null, map: 'playground',
    mode: recap.mode || 'free', camTilt: tune.camTilt, craft: { ...spec }, tune: JSON.parse(JSON.stringify(tune)), profile: store.get('pilot', null), input: inputCfg.mode,
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
  telRenderStatus(); return telPump();
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
async function telToRelay(it) {
  if (!TEL.relay) return false;
  try { const r = await fetch(TEL.relay, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: it.kind, name: it.name, payload: JSON.parse(it.body) }) }); return r.ok; } catch { return false; }
}
// ---- drop-off 3: GitHub with the player's own token
async function telToGitHub(it) {
  if (!gh.token) return false;
  try { const r = await ghFetch(`/contents/${['telemetry', it.kind, telPilot(), it.name + '.json'].map(encodeURIComponent).join('/')}`, { method: 'PUT', body: JSON.stringify({ message: `telemetry: ${it.kind} ${it.name}`, content: b64(it.body), branch: gh.branch }) });
    return r.ok || r.status === 422; } catch { return false; }   // 422: already there
}
async function telPump() {
  if (telState.busy) return; telState.busy = true;
  try {
    for (const it of await telList()) { if (it.sent) continue; if (it.kind !== 'feedback' && !tel.on) continue;
      const route = (await telToDb(it)) ? 'project database' : (await telToRelay(it)) ? 'project drop-off' : (await telToGitHub(it)) ? 'GitHub' : null;
      if (!route) { telState.last = 'no drop-off reachable — kept here'; break; }
      telState.route = route; telState.last = `sent ${it.kind} → ${route}`;
      await telStore({ id: it.id, kind: it.kind, name: it.name, at: it.at, sent: route, chars: it.body.length });   // keep a receipt, drop the body
    }
  } finally { telState.busy = false; telRenderStatus(); }
}

// ---- Options and the one-time question on the main menu
function telOptionsHtml() {
  return `<label>Pilot name<input id="optPilotName" maxlength="24" value="${esc(pilotName())}" onkeydown="event.stopPropagation()"></label>
    <label class="chk big"><input type="checkbox" id="telOn" ${tel.on ? 'checked' : ''}> Share flight telemetry</label>
    <div class="optExplain">
      <p><b>What it does:</b> when a Free Fly or Session run ends, the game sends that run to the project: the flight path and attitude, your stick and throttle movements, every trick the game called (with how sure it was), your F / Q flags, and your craft, rates and camera tilt. About 30–80 KB a minute; runs under ${TEL.minSeconds} seconds and RaceGOW laps are skipped.</p>
      <p><b>Why:</b> real flying is what the trick rules are tuned against. Each flight can be re-flown through new versions of the detector to see which calls change, and the unsure calls show which rules need work.</p>
      <p><b>What's not sent:</b> no e-mail or device details. Your runs carry the pilot name you chose and a random id made in this browser (<code>${esc(tel.pilot || 'made when you turn this on')}</code>) so they can be grouped. Never any access token.</p>
      <p class="note" id="telStatus"></p>
      <div class="row"><button id="telExport" class="ghost">Save waiting flights as a file</button><button id="telForget" class="ghost">Delete flights kept here</button><button id="telCollect" class="ghost hide">Download everything in the project database</button></div>
    </div>`;
}
async function telRenderStatus() {
  const el = $('#telStatus'); if (!el) return;
  const all = await telList(), wait = all.filter(x => !x.sent).length, sent = all.filter(x => x.sent && x.sent !== 'file').length, c = await telDb();
  const where = c ? 'the project database (through this Claude page)' : TEL.relay ? 'the project drop-off' : gh.token ? `GitHub (${gh.owner}/${gh.repo}/telemetry/)` : null;
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
document.addEventListener('change', e => { if (e.target.id === 'optPilotName') { const n = cleanName(e.target.value); if (n.length >= 2) { store.set('pilotName', n); pilotShowName(); } e.target.value = pilotName(); } });
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
// comments written before there was a drop-off are still in this browser: queue the ones that never went anywhere
async function telOldFeedback() { const all = store.get('feedback', []); let n = 0;
  for (const p of all) { if (p.queued || !p.text) continue; p.queued = true; n++; await telStore({ id: `feedback/${p.at.replace(/[:.]/g, '-')}-${slug(p.category || 'other')}`, kind: 'feedback', name: `${p.at.replace(/[:.]/g, '-')}-${slug(p.category || 'other')}`, at: p.at, body: JSON.stringify({ ...p, queued: undefined }), sent: null }); }
  if (n) store.set('feedback', all); }
setInterval(async () => { if (document.hidden) return; if ((await telList()).some(x => !x.sent && (x.kind === 'feedback' || tel.on))) telPump(); }, 20000);
pilotShowName();
setTimeout(async () => { if (!pilotName()) pilotAsk(); else pilotWarmAsk(); await telOldFeedback(); telPump(); }, 1200);
window.__pw.pilot = { get name() { return pilotName(); }, ask: () => pilotAsk(), get farts() { return isRidgeRipper(); }, crashSound: () => (isRidgeRipper() ? crashFart() : crashThud()) };
window.__pw.tel = { get state() { return { ...tel, ...telState }; }, set: on => telSet(on), capture: r => telCapture(r), list: () => telList(), pump: () => telPump() };
