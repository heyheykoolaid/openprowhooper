
// ============================================================ Flag keys, post-run review, pilot warm-up
// (concatenated into the game module). docs/RECOGNITION-ROADMAP.md items 1-4.
// While flying: F = "that last call was wrong", Q = "I just did a trick and got nothing". After the run, Review lists
// every call with a replay of the moment and ✓ / ✗ / "it was actually…"; flagged and low-confidence calls come first.
// Saved as pro-whooper-session/2 (via: "review"), which test/benchmark.js already reads.
const recap = { trace: [], events: [], flags: [], id: null, started: null, play: null, cam: 'fpv', back: 'pause', dirty: false };
const RECAP_MAX = 100 * 60 * 8;   // 8 minutes at 100 Hz
function recapReset() { recap.trace = []; recap.events = []; recap.flags = []; recap.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); recap.started = new Date().toISOString(); recap.dirty = false; }
function recapRow(row) { if (mode !== 'fly' || race.on) return; if (!recap.id) recapReset(); recap.trace.push(row); if (recap.trace.length > RECAP_MAX) recap.trace.shift(); }
function recapEvent(ev) {
  if (mode !== 'fly' || race.on || ev.name === 'near' || ev.name === 'Crash') return;
  const toks = ev.toks || [], t = drone.time, t0 = toks.length ? t - (detector.time - Math.min(...toks.map(k => k.t0))) : t - (ev.laps ? ev.laps * 4 : 1.5);
  recap.events.push({ t: +t.toFixed(3), t0: +Math.max(recap.trace.length ? recap.trace[0][0] : 0, t0).toFixed(3), name: ev.name, exec: ev.exec, clean: ev.clean, obstacle: ev.obstacle || null, conf: ev.watch ? ev.watch.conf : null, fails: ev.watch ? ev.watch.fails : [], verdict: null, actual: null });
}
function recapFlag(kind) {
  if (mode !== 'fly' || race.on) return;
  if (kind === 'wrong') { const e = recap.events[recap.events.length - 1]; if (!e || drone.time - e.t > 12) { flash('<b>NOTHING TO FLAG</b><small>no call in the last few seconds</small>', 'near'); return; }
    e.flag = true; e.verdict = 'no'; recap.dirty = true; flash(`<b>FLAGGED</b><small>"${e.name}" marked wrong — fix it in Review after the run</small>`, 'near'); }
  else { recap.flags.push({ t: +drone.time.toFixed(3), actual: null }); recap.dirty = true; flash('<b>MISSED TRICK NOTED</b><small>say what it was in Review after the run</small>', 'near'); }
}
addEventListener('keydown', e => {
  if (mode !== 'fly' || race.on || train.on || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (e.code === 'KeyF') recapFlag('wrong'); if (e.code === 'KeyQ') recapFlag('missed');
});
// ---- the review screen: game view on the left replaying the moment, the list on the right
const recapItems = () => [...recap.events.map((e, i) => ({ kind: 'call', i, t: e.t, e })), ...recap.flags.map((f, i) => ({ kind: 'miss', i, t: f.t, f }))]
  .sort((a, b) => { const pa = a.kind === 'miss' || a.e.flag ? 0 : a.e.conf != null && a.e.conf < 0.7 ? 1 : 2, pb = b.kind === 'miss' || b.e.flag ? 0 : b.e.conf != null && b.e.conf < 0.7 ? 1 : 2; return pa - pb || a.t - b.t; });
function openRecap(from) {
  if (!recap.events.length && !recap.flags.length) { flash('<b>NOTHING TO REVIEW YET</b><small>fly some tricks first</small>', 'near'); return; }
  recap.back = from || 'pause'; mode = 'recap'; drone.armed = false; show(null); $('#hud').classList.add('hide'); $('#recapUI').classList.remove('hide'); document.body.classList.add('bbr');
  recap.saved = { pos: drone.pos, q: drone.q, vel: drone.vel }; const first = recapItems()[0]; recapPlay(first); renderRecap();
}
function closeRecap() {
  recapSave(); recap.play = null; $('#recapUI').classList.add('hide'); document.body.classList.remove('bbr'); drone.reset(activeWorld.spawn); detector.reset();
  if (recap.back === 'results') { mode = 'paused'; show('#resultsScreen'); } else if (recap.back === 'menu') { mode = 'menu'; show('#mainMenu'); } else { mode = 'paused'; show('#pause'); }
}
function recapPlay(it) { if (!it) return; const a = it.kind === 'call' ? it.e.t0 - 1.2 : it.t - 5, b = it.kind === 'call' ? it.e.t + 0.9 : it.t + 0.6; recap.play = { a: Math.max(recap.trace[0][0], a), b: Math.min(recap.trace[recap.trace.length - 1][0], b), t: 0, key: it.kind + it.i, speed: recap.play ? recap.play.speed : 1 }; recap.play.t = recap.play.a; }
function recapRowAt(t) { const T = recap.trace; let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m][0] <= t) lo = m; else hi = m; } return T[lo]; }
function recapStep(dt) {
  const p = recap.play; if (!p || !recap.trace.length) return; p.t += dt * p.speed; if (p.t > p.b + 0.5) p.t = p.a;
  const r = recapRowAt(Math.min(p.t, p.b)); drone.pos = S.v3(r[1], r[2], r[3]); drone.q = { w: r[4], x: r[5], y: r[6], z: r[7] }; drone.vel = S.v3(r[21], r[22], r[23]); for (let i = 0; i < 4; i++) drone.motorW[i] = r[13] ? 2600 : 0;
  camMode = recap.cam; const trail = []; for (let k = 15; k >= 1; k--) { const q = recapRowAt(Math.max(p.a, p.t - k * 0.03)); trail.push({ thr: q[11], roll: q[24], pitch: q[25], yaw: q[26] }); }
  drawSticks($('#recapSticks'), { thr: r[11], roll: r[24], pitch: r[25], yaw: r[26] }, trail);
  const now = recap.events.filter(e => p.t >= e.t - 0.15 && p.t <= e.t + 0.9); $('#recapNow').innerHTML = now.map(e => `${e.name}<small>${e.exec}</small>`).join('');
}
function renderRecap() {
  const el = $('#recapSide'), names = ALL_TRICKS().map(x => nameOf(x)), items = recapItems(), opts = sel => `<option value="">it was actually…</option><option ${sel === 'not a trick' ? 'selected' : ''}>not a trick</option>${names.map(n => `<option ${sel === n ? 'selected' : ''}>${n}</option>`).join('')}`;
  const done = recap.events.filter(e => e.verdict === 'yes' || (e.verdict === 'no' && e.actual)).length + recap.flags.filter(f => f.actual).length;
  el.innerHTML = `<h3>REVIEW YOUR RUN</h3>
    <p class="note">${recap.events.length} calls${recap.flags.length ? `, ${recap.flags.length} missed-trick flags` : ''} · ${done} labelled. Flagged and unsure calls are first. Every label makes the detector better. <kbd>C</kbd> camera · <kbd>Space</kbd> slow-mo</p>
    ${items.map(it => { const on = recap.play && recap.play.key === it.kind + it.i; if (it.kind === 'miss') { const f = it.f;
        return `<div class="rvItem pilot ${on ? 'on' : ''}"><span class="t">${fmtT(f.t)}</span><b>You flagged a missed trick</b><div class="row"><button data-rc="go" data-k="miss" data-i="${it.i}">▶</button><select data-rcmiss="${it.i}"><option value="">what was it?</option>${names.map(n => `<option ${f.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select><button data-rc="delmiss" data-i="${it.i}">✕</button></div></div>`; }
      const e = it.e, cls = e.verdict === 'yes' ? 'ok' : e.verdict === 'no' ? 'bad' : '', unsure = e.conf != null && e.conf < 0.7;
      return `<div class="rvItem ${cls} ${on ? 'on' : ''}"><span class="t">${fmtT(e.t)}</span><b>${e.name}</b> <small>${e.exec}${e.obstacle ? ' · ' + e.obstacle : ''}${e.flag ? ' · <span style="color:#ff8b7d">you flagged this</span>' : unsure ? ' · <span style="color:#ffd34d">the game wasn\'t sure</span>' : ''}</small>
        <div class="row"><button data-rc="go" data-k="call" data-i="${it.i}">▶</button><button data-rc="yes" data-i="${it.i}">✓ Yes</button><button data-rc="no" data-i="${it.i}">✗ No</button>${e.verdict === 'no' ? `<select data-rcfix="${it.i}">${opts(e.actual)}</select>` : ''}</div></div>`; }).join('')}
    <div class="row"><button data-rc="allyes" class="ghost" title="Mark every call you haven't judged as correct">✓ The rest were right</button></div>
    <div class="row"><button data-rc="export" class="ghost">Export</button><button data-rc="upload" class="ghost">↑ Upload</button><button data-rc="close" class="primary">Done</button></div>
    <p class="note" id="recapMsg">${gh.enabled && gh.token ? 'Labels upload when you press Done.' : 'Uploads are off (Options) — labels are kept in this browser; Export saves a file.'}</p>`;
}
function recapPayload() {
  const labels = [];
  for (const e of recap.events) if (e.verdict) labels.push({ target: e.name, verdict: e.verdict, actual: e.verdict === 'no' ? (e.actual || null) : e.name, repStart: e.t0, t: e.t, detected: [e.name], conf: e.conf, flagged: !!e.flag, via: 'review' });
  for (const f of recap.flags) if (f.actual) labels.push({ target: f.actual, verdict: 'yes', actual: f.actual, repStart: +(f.t - 5).toFixed(3), t: +(f.t + 0.5).toFixed(3), detected: [], via: 'flag-missed' });
    else labels.push({ target: 'unknown', verdict: 'unlabelled', actual: null, repStart: +(f.t - 5).toFixed(3), t: f.t, detected: [], via: 'flag-missed', undone: true });
  return { format: 'pro-whooper-session/2', source: 'review', build: '0.1', map: 'playground', camTilt: tune.camTilt, craft: { ...spec }, tune, pilot: store.get('pilot', null),
    run: { id: recap.id, started: recap.started, hz: TRACE_HZ, cols: TRACE_COLS, trace: recap.trace, events: recap.events.map(e => ({ t: e.t, name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, conf: e.conf })), labels } };
}
function recapSave(force) {
  if (!recap.dirty && !force) return; const pl = recapPayload(); if (!pl.run.labels.length) return; recap.dirty = false;
  try { idb.put('runs', { id: 'review-' + recap.id, started: recap.started, review: true, labels: pl.run.labels, events: pl.run.events, hz: TRACE_HZ, cols: TRACE_COLS, trace: recap.trace, craft: { ...spec }, tune }); } catch {}
  ghEnqueue(`calibration/review/${recap.started.replace(/[:.]/g, '-')}-${recap.id}.json`, pl, `run review: ${pl.run.labels.length} labels`);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rc]'); if (b && mode === 'recap') { const a = b.dataset.rc, i = +b.dataset.i;
    if (a === 'go') recapPlay(b.dataset.k === 'miss' ? { kind: 'miss', i, t: recap.flags[i].t, f: recap.flags[i] } : { kind: 'call', i, t: recap.events[i].t, e: recap.events[i] });
    if (a === 'yes' || a === 'no') { const ev = recap.events[i]; ev.verdict = a; if (a === 'yes') ev.actual = null; recap.dirty = true; recapPlay({ kind: 'call', i, t: ev.t, e: ev }); }
    if (a === 'delmiss') { recap.flags.splice(i, 1); recap.dirty = true; }
    if (a === 'allyes') { for (const ev of recap.events) if (!ev.verdict) ev.verdict = 'yes'; recap.dirty = true; }
    if (a === 'export') saveFile(`run-review-${recap.id}.json`, JSON.stringify(recapPayload()));
    if (a === 'upload') { recapSave(true); if (!(gh.enabled && gh.token)) { closeRecap(); openOptions(); return; } }
    if (a === 'close') { closeRecap(); return; }
    renderRecap(); return; }
  const act = e.target.closest('[data-act]'); if (act && act.dataset.act === 'recap') openRecap(mode === 'paused' && !$('#resultsScreen').classList.contains('hide') ? 'results' : 'pause');
  if (act && act.dataset.act === 'warmup') startWarmup();
});
document.addEventListener('change', e => {
  if (mode !== 'recap') return;
  if (e.target.dataset.rcfix !== undefined) { recap.events[+e.target.dataset.rcfix].actual = e.target.value || null; recap.dirty = true; renderRecap(); }
  if (e.target.dataset.rcmiss !== undefined) { recap.flags[+e.target.dataset.rcmiss].actual = e.target.value || null; recap.dirty = true; renderRecap(); }
});
addEventListener('keydown', e => {
  if (mode !== 'recap' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (e.code === 'KeyC') recap.cam = recap.cam === 'fpv' ? 'chase' : 'fpv'; if (e.code === 'Space') { e.preventDefault(); if (recap.play) recap.play.speed = recap.play.speed === 1 ? 0.25 : 1; } if (e.code === 'Escape') closeRecap();
});

// ============================================================ Pilot warm-up (per-pilot calibration)
// A few moves in open air; the game measures how fast you rotate on each axis and the gap you naturally leave between
// two moves, and loosens the detector to match (never tightens). Saved in this browser as the pilot profile.
const WARM = [
  { ax: 'P', label: 'Flip', hint: 'one full flip, forward or back', n: 2 },
  { ax: 'R', label: 'Roll', hint: 'one full roll, either way', n: 2 },
  { ax: 'Y', label: 'Yaw spin', hint: 'one full 360 yaw spin', n: 2 },
  { ax: 'PR', label: 'Flip, then roll', hint: 'a flip, then a roll, with whatever pause feels natural', n: 2 },
];
const warm = { on: false, step: 0, reps: [], seen: 0, last: null, done: null };
function applyPilot() { const p = store.get('pilot', null); detector.setPilot(p); return p; }
function startWarmup() {
  train.on = false; renderTrain(); if (race.on || activeWorld !== world) raceOff(); startFly(false);
  Object.assign(warm, { on: true, step: 0, reps: WARM.map(() => []), seen: detector.time, last: null, done: null }); $('#warmBox').classList.remove('hide'); renderWarm();
  flash('<b>PILOT WARM-UP</b><small>climb to open air, then follow the box on the right</small>');
}
function stopWarmup() { warm.on = false; $('#warmBox').classList.add('hide'); }
function warmTick() {
  if (!warm.on || warm.done) return; const st = WARM[warm.step]; if (!st) return;
  const T = detector.toks.filter(k => k.t1 > warm.seen && k.raw >= 250 && !detector.cur.includes(k)); if (!T.length) return;
  for (const k of T.sort((a, b) => a.t0 - b.t0)) { warm.seen = Math.max(warm.seen, k.t1); const rate = k.raw / Math.max(0.05, k.t1 - k.t0);
    if (st.ax.length === 1) { if (k.ax === st.ax) warm.reps[warm.step].push({ rate }); }
    else if (k.ax === 'P') warm.last = k; else if (k.ax === 'R' && warm.last && k.t0 - warm.last.t1 < 3 && k.t0 >= warm.last.t1 - 0.05) { warm.reps[warm.step].push({ gap: Math.max(0, k.t0 - warm.last.t1) }); warm.last = null; } }
  if (warm.reps[warm.step].length >= st.n) { warm.step++; warm.last = null; if (warm.step >= WARM.length) warmFinish(); }
  renderWarm();
}
function warmFinish() {
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const p = { at: new Date().toISOString(), rate: { P: Math.round(med(warm.reps[0].map(r => r.rate))), R: Math.round(med(warm.reps[1].map(r => r.rate))), Y: Math.round(med(warm.reps[2].map(r => r.rate))) }, air: +med(warm.reps[3].map(r => r.gap)).toFixed(2), camTilt: tune.camTilt };
  store.set('pilot', p); applyPilot(); warm.done = p; renderWarm(); flash('<b>WARM-UP DONE</b><small>the game is tuned to how you fly</small>');
}
function renderWarm() {
  const el = $('#warmBox'); if (!el) return; const p = warm.done;
  el.innerHTML = `<div class="jTop"><span>PILOT WARM-UP</span><span>${Math.min(warm.step + 1, WARM.length)} / ${WARM.length}</span></div>` + (p
    ? `<h3>All set</h3><p>Flips about <b>${p.rate.P}°/s</b>, rolls <b>${p.rate.R}°/s</b>, yaw spins <b>${p.rate.Y}°/s</b>; you leave about <b>${p.air} s</b> between moves.</p>
       <p>The game now allows up to <b>${detector.airOpen.toFixed(1)} s</b> of air between trick segments (${(detector.airOpen * 1.5).toFixed(1)} s inverted) and counts rotations down to <b>${Math.round(detector.minRate('P', 180))}°/s</b> (flips), <b>${Math.round(detector.minRate('R', 180))}°/s</b> (rolls) and <b>${Math.round(detector.minRate('Y', 220))}°/s</b> (yaw) as deliberate.</p>
       <div class="row"><button data-warm="close" class="primary">Keep flying</button><button data-warm="again">Redo</button><button data-warm="clear" title="Back to the standard tolerances">Forget my profile</button></div>`
    : WARM.map((s, i) => `<div class="wStep ${i < warm.step ? 'ok' : i === warm.step ? 'cur' : ''}"><b>${i < warm.step ? '✓' : i === warm.step ? '▶' : '·'} ${s.label}</b> <small>${warm.reps[i].length}/${s.n}</small>${i === warm.step ? `<div>${s.hint}</div>` : ''}</div>`).join('')
      + `<p class="note">Fly them in open air, the way you normally would. Sloppy is fine — that's the point.</p><div class="row"><button data-warm="close" class="ghost">Cancel</button></div>`);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-warm]'); if (!b) return; const a = b.dataset.warm;
  if (a === 'close') stopWarmup(); if (a === 'again') startWarmup(); if (a === 'clear') { store.set('pilot', null); applyPilot(); stopWarmup(); flash('<b>PROFILE CLEARED</b><small>standard tolerances</small>', 'near'); } });
applyPilot();
window.__pw.onTrick = ev => onTrick(ev);
window.__pw.recap = { get state() { return recap; }, open: f => openRecap(f), flag: k => recapFlag(k), payload: () => recapPayload() };
window.__pw.warm = { start: () => startWarmup(), get state() { return warm; }, tick: () => warmTick(), pilot: () => store.get('pilot', null) };

// ============================================================ Feedback button (on every screen)
// A small tab that is always there. Pick a category, write a comment; the game adds where you were and your setup (never
// the GitHub token). It uploads to feedback/ in the repo when uploads are on; otherwise save it as a file, copy it, or
// open a GitHub issue with it filled in.
const FB_CATS = ['Flight feel / physics', 'Trick detection', 'Scoring / combos', 'RaceGOW track builder', 'Racing', 'Video Review', 'Blackbox (Lab / Replay)', 'Controls / radio', 'Map / graphics', 'Menus / UI', 'Bug', 'Idea', 'Other'];
const fbGuess = () => mode === 'editor' ? 'RaceGOW track builder' : race.on ? 'Racing' : mode === 'review' ? 'Video Review' : mode === 'bbreplay' ? 'Blackbox (Lab / Replay)' : mode === 'recap' || mode === 'judge' ? 'Trick detection' : mode === 'fly' || mode === 'paused' ? 'Flight feel / physics' : 'Other';
function fbOpen() {
  if (mode === 'fly') pause();
  const el = $('#fbModal'); el.classList.remove('hide'); const g = fbGuess();
  el.innerHTML = `<div class="fbPanel"><h3>Send feedback</h3>
    <label>About <select id="fbCat">${FB_CATS.map(c => `<option ${c === g ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    <label>What happened, or what would make it better?<textarea id="fbText" rows="6" maxlength="4000" placeholder="e.g. my trippy round the flagpole didn't count when…"></textarea></label>
    <label>Your name or handle (optional)<input id="fbName" maxlength="60" value="${esc(store.get('fb.name', ''))}"></label>
    <label class="chk"><input type="checkbox" id="fbCtx" checked> Include what I was doing (screen, craft, rates, camera tilt, last few trick calls)</label>
    <div class="row"><button data-fb="send" class="primary">${gh.enabled && gh.token ? 'Send' : 'Save'}</button><button data-fb="file">Save as file</button><button data-fb="copy">Copy</button><button data-fb="issue" title="Opens GitHub in a new tab with your comment filled in">Open a GitHub issue</button><button data-fb="close" class="ghost">Cancel</button></div>
    <p class="note" id="fbMsg">${gh.enabled && gh.token ? `Goes to ${esc(gh.owner)}/${esc(gh.repo)}/feedback/.` : 'Uploads are off in this browser, so "Save" keeps it here; use the file, Copy or the GitHub issue button to pass it on.'}</p></div>`;
  setTimeout(() => $('#fbText') && $('#fbText').focus(), 30);
}
function fbPayload() {
  const name = $('#fbName').value.trim(); store.set('fb.name', name);
  const p = { format: 'pro-whooper-feedback/1', at: new Date().toISOString(), build: '0.1', category: $('#fbCat').value, text: $('#fbText').value.trim(), name: name || null };
  if ($('#fbCtx').checked) p.context = { screen: mode, racing: !!race.on, track: race.on && race.track ? race.track.name : mode === 'editor' && ed.track ? ed.track.name : null, craft: { ...spec }, camTilt: tune.camTilt, ratesType: tune.ratesType, rates: tune.rates,
    pilot: store.get('pilot', null), input: inputCfg.mode, lastCalls: recap.events.slice(-6).map(e => ({ name: e.name, exec: e.exec, obstacle: e.obstacle, conf: e.conf, flagged: !!e.flag })), browser: navigator.userAgent };
  return p;
}
const fbText = p => `[${p.category}] ${p.text}\n\n— ${p.name || 'anonymous'}, ${p.at}` + (p.context ? `\n\ncontext: ${JSON.stringify(p.context)}` : '');
document.addEventListener('click', async e => {
  if (e.target.closest('#fbTab')) { fbOpen(); return; }
  const b = e.target.closest('[data-fb]'); if (!b) return; const a = b.dataset.fb, msg = t => { $('#fbMsg').textContent = t; };
  if (a === 'close') { $('#fbModal').classList.add('hide'); return; }
  const p = fbPayload(); if (!p.text) { msg('Write a comment first.'); return; }
  const all = store.get('feedback', []); if (!all.some(x => x.at === p.at)) { all.push(p); store.set('feedback', all.slice(-50)); }
  if (a === 'send') { const sent = ghEnqueue(`feedback/${p.at.replace(/[:.]/g, '-')}-${slug(p.category)}.json`, p, `feedback: ${p.category}`); $('#fbModal').classList.add('hide'); flashNote(sent ? 'Feedback sent — thank you!' : 'Feedback saved in this browser — thank you!'); }
  if (a === 'file') { await saveFile(`feedback-${p.at.slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(p, null, 1)); msg('Saved. Send that file to the project.'); }
  if (a === 'copy') { try { await navigator.clipboard.writeText(fbText(p)); msg('Copied — paste it anywhere.'); } catch { msg('Could not copy here; use Save as file.'); } }
  if (a === 'issue') { const { browser, ...ctx } = p.context || {}; window.open(`https://github.com/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/issues/new?title=${encodeURIComponent(`[${p.category}] ${p.text.slice(0, 60)}`)}&body=${encodeURIComponent(fbText({ ...p, context: p.context ? ctx : null }).slice(0, 5000))}`, '_blank', 'noopener'); msg('Opened GitHub in a new tab (you need a GitHub account to post it).'); }
});
function flashNote(t) { const el = $('#fbToast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
