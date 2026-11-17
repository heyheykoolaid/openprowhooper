// ============================================================ trick training + calibration (dev mode)
// Records the whole run at 100 Hz while training, logs every detector verdict and every label, keeps a
// 5-reps-per-trick checklist across rounds, and saves it all in the browser (IndexedDB) for export.
const TRACE_HZ = 100, TRACE_LEN = 1000, REPS = 5;
// sticks (rollStick/pitchStick/yawStick, -1..1 as the pilot moved them) were added at the end in format v2; older
// traces simply have 24 columns
const TRACE_COLS = ['t', 'x', 'y', 'z', 'qw', 'qx', 'qy', 'qz', 'rollRate', 'pitchRate', 'yawRate', 'thr', 'contact', 'armed', 'crashed', 'cnx', 'cny', 'cnz', 'cObj', 'cImpact', 'cGround', 'vx', 'vy', 'vz', 'rollStick', 'pitchStick', 'yawStick'];
let contactLatch = null; // a contact can happen between two 100 Hz samples: keep it until the next row
const trace = []; let traceCtr = 0;
function recordTrace(rc) {
  if (drone.contactThisStep && drone.contactNormal && (!contactLatch || drone.lastImpact > contactLatch.imp))
    contactLatch = { n: drone.contactNormal, obj: drone.contactOwner ?? -1, imp: drone.lastImpact || 0, g: drone.contactGround ? 1 : 0 };
  if (++traceCtr % (1000 / TRACE_HZ)) return;
  const d = drone, r = d.pilotRates(), c = contactLatch; contactLatch = null;
  const row = [+d.time.toFixed(3), +d.pos.x.toFixed(4), +d.pos.y.toFixed(4), +d.pos.z.toFixed(4), +d.q.w.toFixed(5), +d.q.x.toFixed(5), +d.q.y.toFixed(5), +d.q.z.toFixed(5),
    Math.round(r[0]), Math.round(r[1]), Math.round(r[2]), +rc.thr.toFixed(3), c ? 1 : 0, d.armed ? 1 : 0, d.crashed ? 1 : 0,
    c ? +c.n.x.toFixed(3) : 0, c ? +c.n.y.toFixed(3) : 0, c ? +c.n.z.toFixed(3) : 0, c ? c.obj : -1, c ? +c.imp.toFixed(2) : 0, c ? c.g : 0,
    +d.vel.x.toFixed(3), +d.vel.y.toFixed(3), +d.vel.z.toFixed(3), +(rc.roll || 0).toFixed(3), +(rc.pitch || 0).toFixed(3), +(rc.yaw || 0).toFixed(3)];
  trace.push(row); if (trace.length > TRACE_LEN) trace.shift();
  recapRow(row);
  if (train.on && run.id) run.trace.push(row);
}
// ---- tiny IndexedDB wrapper (falls back to nothing if the browser blocks storage)
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('prowhooper', 3);
    r.onupgradeneeded = () => { const db = r.result; for (const s of ['examples', 'runs', 'judge', 'telemetry']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  const tx = async (store, mode, fn) => { try { const db = await open(); return await new Promise((res, rej) => { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); } catch { return null; } };
  return { put: (s, v) => tx(s, 'readwrite', o => o.put(v)), all: async s => (await tx(s, 'readonly', o => o.getAll())) || [], clear: s => tx(s, 'readwrite', o => o.clear()), del: (s, k) => tx(s, 'readwrite', o => o.delete(k)), ok: async () => { try { await open(); return true; } catch { return false; } } };
})();
const TRAIN_OBST = {
  'Powerloops': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Picnic Table'],
  'Maverick Loops': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower'],
  'Matty Flips': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Picnic Table', 'Bench'],
  'SplitS': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Picnic Table'],
  'Wall Tricks': ['Graffiti Wall', 'Brick Building', 'Dumpster'], 'Gaps': ['Wall Slot'],
  'Pole Dancing': ['Lamp Post', 'Tree', 'Hoop Pole', 'Slide Tower', 'the pilot'], 'Jump Roping': ['Swing Set', 'Monkey Bars', 'Picnic Table'],
  'Rewinds': ['Brick Building', 'Lamp Post', 'Tree', 'Slide Tower'], 'Open Air Tricks': ['anywhere'], 'Other Tricks': ['anywhere'],
};
const SPECIAL_OBST = { 'Facepunch': 'the pilot', 'Perch': 'Brick Building roof', 'Dive': 'Brick Building', 'Ceiling Tap': 'Slide Tower roof (underside)', 'Slide Disarm': 'the ground', 'Knife Edge': 'Wall Slot', 'Ninja Star': 'Wall Slot', 'Reverse Knife Edge': 'Wall Slot' };
const ALL_TRICKS = () => window.TPW_TRICKS.filter(t => t.pts > 0 && !/^Custom/.test(t.name));
const cal = Object.assign({ round: 1, reps: {}, agree: {}, misses: {}, order: 'checklist-draft' }, store.get('calib', {}));
const saveCalib = () => store.set('calib', cal);
const train = { on: false, target: null, obstacle: null, msg: '', repStart: 0, sessionLabels: 0 };
const run = { id: null, started: null, trace: [], events: [], labels: [], lastFlush: 0 };
function newRun() { Object.assign(run, { id: 'run-' + Date.now(), started: new Date().toISOString(), trace: [], events: [], labels: [], lastFlush: 0, round: cal.round }); }
async function flushRun() { if (!run.id) return; run.lastFlush = performance.now(); await idb.put('runs', { id: run.id, started: run.started, round: run.round, craft: { ...spec }, tune, labels: run.labels, events: run.events, hz: TRACE_HZ, cols: TRACE_COLS, trace: run.trace }); }
const nameOf = t => t.name.trim();
function checklistPool() {
  const all = ALL_TRICKS();
  if (cal.order === 'checklist-tested') return all.filter(t => !S.DRAFT.has(nameOf(t)));
  if (cal.order === 'checklist-draft') return [...all.filter(t => S.DRAFT.has(nameOf(t))), ...all.filter(t => !S.DRAFT.has(nameOf(t)))];
  return all; // category order
}
const repsOf = n => cal.reps[n] || 0;
function nextUnfinished(after) {
  const pool = checklistPool(); if (!pool.length) return null;
  const start = after ? pool.findIndex(t => nameOf(t) === after) + 1 : 0;
  for (let k = 0; k < pool.length; k++) { const t = pool[(start + k) % pool.length]; if (repsOf(nameOf(t)) < REPS) return t; }
  return null;
}
function setTarget(t, keepMsg) {
  train.target = t; if (!t) { renderTrain(); return; }
  const obs = SPECIAL_OBST[nameOf(t)] ? [SPECIAL_OBST[nameOf(t)]] : (TRAIN_OBST[t.cat.trim()] || ['anywhere']);
  train.obstacle = obs[Math.floor(Math.random() * obs.length)]; if (!keepMsg) train.msg = ''; train.repStart = drone.time; renderTrain();
}
function repDetected() { // what the detector said since this rep started
  return run.events.filter(e => e.t >= train.repStart - 0.05 && e.name !== 'near').map(e => e.name);
}
function lastDebug() { let dbg = (detector.debug || []).slice(-1)[0] || null; if (dbg && detector.time - dbg.t > 10) dbg = null; return dbg; }
let labelling = false;
async function label(verdict, asName) {
  if (!train.target || labelling) return;
  // let the detector finish deciding about the move you just did before judging it
  if (detector.busy()) {
    labelling = true; train.msg = 'checking…'; renderTrain();
    const t0 = performance.now(); while (detector.busy() && performance.now() - t0 < 1800) await new Promise(r => setTimeout(r, 60));
    await new Promise(r => setTimeout(r, 80)); labelling = false;
  }
  const target = asName || nameOf(train.target), det = repDetected(), dbg = lastDebug(), agreed = det.includes(target);
  const rep = verdict === 'yes' ? repsOf(target) + 1 : null;
  const lab = { t: drone.time, repStart: train.repStart, target, prompted: nameOf(train.target), obstacle: train.obstacle, verdict, rep, round: cal.round, detected: det, toks: dbg ? dbg.toks : '', cross: dbg ? dbg.cross : '', near: dbg ? dbg.near : null };
  run.labels.push(lab); train.sessionLabels++;
  idb.put('examples', { id: run.id + '#' + run.labels.length, run: run.id, ...lab, craft: { ...spec }, hz: TRACE_HZ, cols: TRACE_COLS, trace: trace.slice(-TRACE_LEN) });
  if (verdict === 'yes') {
    cal.reps[target] = rep; if (agreed) cal.agree[target] = (cal.agree[target] || 0) + 1; else cal.misses[target] = (cal.misses[target] || 0) + 1;
    saveCalib();
    const head = agreed ? `✓ Rep ${rep} saved — detector agreed.` : `✓ Rep ${rep} saved — detector said ${det.length ? det.join(', ') : 'nothing'}${lab.near ? ' (' + lab.near + ')' : ''}. This rep will fix it.`;
    if (rep >= REPS) {
      const ag = cal.agree[target] || 0;
      if (gh.enabled && gh.token) uploadTrick(target);
      train.msg = `${head}<br><b>${target} done:</b> detector agreed ${ag}/${REPS}.`;
      const nx = asName ? train.target : nextUnfinished(target);
      if (!nx) { train.msg += `<br><b>Round ${cal.round} complete!</b> ${gh.enabled && gh.token ? 'Uploading the session…' : 'Export the session'}, then start round ${cal.round + 1}.`; if (gh.enabled && gh.token) uploadRun('round complete'); train.target = null; renderTrain(); }
      else setTimeout(() => setTarget(nx, true), 1400);
    } else train.msg = head;
  } else train.msg = `✗ Not counted. Detector said ${det.length ? det.join(', ') : 'nothing'}. Try rep ${repsOf(nameOf(train.target)) + 1} again.`;
  train.repStart = drone.time; flushRun(); renderTrain();
}
function undoLast() {
  const lab = [...run.labels].reverse().find(l => l.verdict === 'yes' && !l.undone); if (!lab) return;
  lab.undone = true; cal.reps[lab.target] = Math.max(0, repsOf(lab.target) - 1);
  if (lab.detected.includes(lab.target)) cal.agree[lab.target] = Math.max(0, (cal.agree[lab.target] || 1) - 1); else cal.misses[lab.target] = Math.max(0, (cal.misses[lab.target] || 1) - 1);
  saveCalib(); const t = ALL_TRICKS().find(x => nameOf(x) === lab.target); if (t) setTarget(t); train.msg = `Undid ${lab.target} rep ${lab.rep}.`; renderTrain(); flushRun();
}
function totals() { const all = ALL_TRICKS(); const done = all.filter(t => repsOf(nameOf(t)) >= REPS).length; const reps = all.reduce((a, t) => a + Math.min(REPS, repsOf(nameOf(t))), 0);
  const ag = Object.values(cal.agree).reduce((a, b) => a + b, 0), ms = Object.values(cal.misses).reduce((a, b) => a + b, 0); return { all: all.length, done, reps, need: all.length * REPS, ag, ms }; }
function dots(n) { return '●'.repeat(Math.min(REPS, n)) + '○'.repeat(Math.max(0, REPS - n)); }
function renderTrain() {
  const box = $('#train'); if (!train.on) { box.classList.add('hide'); return; } box.classList.remove('hide');
  const t = train.target, T = totals();
  const det = repDetected(), dbg = lastDebug();
  const n = t ? repsOf(nameOf(t)) : 0, drf = t && S.DRAFT.has(nameOf(t));
  box.innerHTML = `<div class="trHead"><small>CALIBRATION · ROUND ${cal.round}</small><span class="rec">● REC</span></div>
    <div class="trProg"><i style="width:${T.reps / T.need * 100}%"></i></div><div class="trCount">${T.reps}/${T.need} reps · ${T.done}/${T.all} tricks done · detector agreed ${T.ag}/${T.ag + T.ms}</div>
    ${t ? `<div class="trTarget">${t.name}</div><div class="trObs">on <b>${train.obstacle}</b> · rep <b>${Math.min(n + 1, REPS)}</b> of ${REPS} <span class="dots">${dots(n)}</span> ${drf ? '<small class="draftTag">draft rule</small>' : ''}</div><div class="trDesc">${t.desc}</div>`
      : `<div class="trTarget">Round ${cal.round} complete</div>`}
    <div class="trLast">This rep → <b>${det.length ? det.join(', ') : 'nothing detected yet'}</b>${dbg ? `<br><code>${dbg.toks || '—'}</code> · <code>${dbg.cross || 'no obstacle passes'}</code>` : ''}${dbg && dbg.near ? `<br><span class="nm">${dbg.near}</span>` : ''}</div>
    <div class="trBtns"><button data-tr="yes">✓ Got it <kbd>Y</kbd></button><button data-tr="no">✗ Redo <kbd>N</kbd></button><button data-tr="skip">Skip <kbd>K</kbd></button><button data-tr="undo">Undo <kbd>U</kbd></button><button data-tr="list">Checklist <kbd>L</kbd></button>${t && window.Maneuvers && window.Maneuvers.LIB[nameOf(t)] ? '<button data-tr="ghost">👻 Show me</button>' : ''}<button data-tr="pauseask" class="${ask.on ? 'on' : ''}">Pause &amp; ask: ${ask.on ? 'ON' : 'OFF'} <kbd>P</kbd></button></div>
    <div class="trRow"><select id="trAs"><option value="">I did a different trick…</option>${ALL_TRICKS().map(x => `<option>${nameOf(x)}</option>`).join('')}</select></div>
    ${train.msg ? `<div class="trMsg">${train.msg}</div>` : ''}
    <div class="trFoot"><button data-tr="upload" class="ghost">↑ Upload</button><button data-act="sync" class="ghost">GitHub ⚙</button><span id="ghStatus" class="ghs"></span></div>
    <div class="trFoot"><button data-tr="export" class="ghost">Export session</button><button data-tr="exportAll" class="ghost">Export all reps</button>${!t ? `<button data-tr="nextRound">Start round ${cal.round + 1}</button>` : ''}</div>
    <textarea id="trOut" class="hide" readonly></textarea>`;
  renderGhStatus();
}
function renderChecklist() {
  const cats = {}; for (const t of ALL_TRICKS()) (cats[t.cat.trim()] = cats[t.cat.trim()] || []).push(t); const T = totals();
  $('#clBody').innerHTML = `<p class="note">Round ${cal.round} · ${T.reps}/${T.need} reps · ${T.done}/${T.all} tricks done. Do each trick ${REPS} times; press <b>Y</b> after each good rep, <b>N</b> if it wasn't right. Click a trick to do it now.</p>
    <label>Order<select id="clOrder"><option value="checklist-draft" ${cal.order === 'checklist-draft' ? 'selected' : ''}>Draft rules first</option><option value="checklist-cat" ${cal.order === 'checklist-cat' ? 'selected' : ''}>By category</option><option value="checklist-tested" ${cal.order === 'checklist-tested' ? 'selected' : ''}>Tested rules only</option></select></label>` +
    Object.entries(cats).map(([c, ts]) => `<h3>${c}</h3><table class="tt cl">${ts.map(t => { const nm = nameOf(t), r = repsOf(nm), ag = cal.agree[nm] || 0, ms = cal.misses[nm] || 0;
      return `<tr data-pick="${encodeURIComponent(nm)}" class="${r >= REPS ? 'done' : ''} ${train.target && nameOf(train.target) === nm ? 'cur' : ''}"><td class="dots">${dots(r)}</td><td><b>${nm}</b>${S.DRAFT.has(nm) ? ' <small class="draftTag">draft</small>' : ''}</td><td>${t.pts}</td><td>${r ? `detector ${ag}/${ag + ms}` : ''}</td></tr>`; }).join('')}</table>`).join('');
}
function openChecklist() { renderChecklist(); show('#checklist'); if (mode === 'fly') { mode = 'paused'; train.pausedForList = true; } }
function closeChecklist() { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); show(null); if (train.pausedForList) { train.pausedForList = false; resume(); } }
async function startTraining() {
  startFly(false); train.on = true; detector.debug = []; newRun();
  setTarget(train.target && repsOf(nameOf(train.target)) < REPS ? train.target : nextUnfinished(), false);
  const ok = await idb.ok();
  flash(`<b>CALIBRATION ROUND ${cal.round}</b><small>do each trick ${REPS}× · Y after a good rep · N to redo · L checklist${ok ? '' : ' · storage blocked: export before closing'}</small>`);
}
async function saveFile(filename, data) {
  if (window.claude && window.claude.use) { try { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename, data: new Blob([data]) }); return true; } } catch (err) { if (err && err.code === 'declined') return 'declined'; } }
  else { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); return true; } catch {} }
  return false;
}
async function exportData(kind) {
  await flushRun();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  let payload, filename;
  if (kind === 'session') {
    payload = { format: 'pro-whooper-session/2', build: '0.1', map: MAP_ID, camTilt: tune.camTilt, craft: { ...spec }, tune, cal, run: { id: run.id, started: run.started, round: run.round, hz: TRACE_HZ, cols: TRACE_COLS, trace: run.trace, events: run.events, labels: run.labels } };
    filename = `pro-whooper-session-r${cal.round}-${stamp}.json`;
  } else {
    const ex = await idb.all('examples'); payload = { format: 'pro-whooper-training/3', build: '0.1', map: MAP_ID, camTilt: tune.camTilt, tune, cal, examples: ex };
    filename = `pro-whooper-all-reps-${stamp}.json`;
  }
  const data = JSON.stringify(payload);
  const saved = await saveFile(filename, data);
  const mb = (data.length / 1e6).toFixed(1);
  if (saved === true) train.msg = `Saved ${filename} (${mb} MB). Send it to Claude.`;
  else { const ta = $('#trOut'); ta.value = data.length < 4e6 ? data : ''; ta.classList.toggle('hide', data.length >= 4e6); if (data.length < 4e6) ta.select();
    let copied = false; try { await navigator.clipboard.writeText(data); copied = true; } catch {}
    train.msg = copied ? `Copied ${mb} MB to the clipboard — paste it to Claude.` : `Couldn't save a file here. Open the standalone game file to export (${mb} MB).`; }
  renderTrain();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tr]');
  if (b) { e.stopPropagation(); const a = b.dataset.tr;
    if (a === 'ghost' && train.target) { startGhost(nameOf(train.target), train.obstacle); return; }
    if (a === 'yes') label('yes'); if (a === 'no') label('no'); if (a === 'undo') undoLast(); if (a === 'list') openChecklist();
    if (a === 'skip') setTarget(nextUnfinished(train.target && nameOf(train.target)));
    if (a === 'export') exportData('session'); if (a === 'exportAll') exportData('all');
    if (a === 'nextRound') { cal.round++; cal.reps = {}; cal.agree = {}; cal.misses = {}; saveCalib(); newRun(); setTarget(nextUnfinished()); flash(`<b>ROUND ${cal.round}</b><small>new round — same checklist, fresh reps</small>`); }
  }
  const pk = e.target.closest('[data-pick]'); if (pk) { const t = ALL_TRICKS().find(x => nameOf(x) === decodeURIComponent(pk.dataset.pick)); if (t) { setTarget(t); closeChecklist(); } }
  if (e.target.closest('[data-act="train"]')) { if (needPlayground('Trick Calibration')) return; startTraining(); }
  if (e.target.closest('[data-act="clclose"]')) closeChecklist();
});
document.addEventListener('change', e => {
  if (e.target.id === 'clOrder') { cal.order = e.target.value; saveCalib(); renderChecklist(); }
  if (e.target.id === 'trAs' && e.target.value) label('yes', e.target.value);
});
addEventListener('keydown', e => {
  if (!train.on || ask.open || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.code === 'KeyL') { if ($('#checklist').classList.contains('hide')) openChecklist(); else closeChecklist(); return; }
  if (mode !== 'fly') return;
  if (e.code === 'KeyY') label('yes'); if (e.code === 'KeyN') label('no'); if (e.code === 'KeyK') setTarget(nextUnfinished(train.target && nameOf(train.target))); if (e.code === 'KeyU') undoLast();
});
// log every detector verdict into the run, refresh the panel, flush to storage now and then
function trainOnEvent(ev) {
  if (train.on && run.id) run.events.push({ t: +drone.time.toFixed(3), name: ev.name, exec: ev.exec, clean: ev.clean, obstacle: ev.obstacle || null, near: ev.near || null, draft: !!ev.draft });
  if (ev.name === 'Crash') return;
  if (ev.name === 'near') askQueue({ kind: 'near', t: drone.time, text: ev.near }); else askQueue({ kind: 'trick', t: drone.time, name: ev.name, exec: ev.exec, obstacle: ev.obstacle });
}
let trainSeen = 0;
setInterval(() => {
  if (!train.on) return;
  if (run.events.length !== trainSeen) { trainSeen = run.events.length; renderTrain(); }
  if (performance.now() - run.lastFlush > 30000) flushRun();
}, 300);

