
// ============================================================ Flag keys, post-run review, pilot warm-up
// (concatenated into the game module). docs/RECOGNITION-ROADMAP.md items 1-4.
// While flying: F = "that last call was wrong", Q = "I just did a trick and got nothing". After the run, Review lists
// every call with a replay of the moment and ✓ / ✗ / "it was actually…"; flagged and low-confidence calls come first.
// Saved as pro-whooper-session/2 (via: "review"), which test/benchmark.js already reads.
const recap = { trace: [], events: [], flags: [], id: null, started: null, play: null, cam: 'fpv', back: 'pause', dirty: false };
const RECAP_MAX = 100 * 60 * 8;   // 8 minutes at 100 Hz
function recapReset() { recap.trace = []; recap.events = []; recap.flags = []; recap.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); recap.started = new Date().toISOString(); recap.dirty = false; recap.mode = null; }
function recapRow(row) { if (mode !== 'fly' || race.on) return; if (!recap.id) recapReset(); recap.trace.push(row); if (!recap.mode && recap.trace.length > 100) recap.mode = train.on ? 'calibration' : session ? 'session' : 'free'; if (recap.trace.length > RECAP_MAX) recap.trace.shift(); }
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
// The player: the whole run on a timeline. Picking a call (or a mark on the timeline) jumps to it and loops that moment;
// scrubbing or stepping leaves the loop. p = { t, playing, speed, looping, loop: {a, b} | null, key }
const recapSpan = () => { const T = recap.trace; return T.length ? [T[0][0], T[T.length - 1][0]] : [0, 1]; };
function recapPlay(it) { if (!it || !recap.trace.length) return; const [T0, T1] = recapSpan(), old = recap.play || { speed: 1, looping: true };
  const a = it.kind === 'call' ? it.e.t0 - 1.2 : it.t - (it.f && it.f.added ? 2.5 : 5), b = it.kind === 'call' ? it.e.t + 0.9 : it.t + (it.f && it.f.added ? 2.5 : 0.6);
  recap.play = { t: Math.max(T0, a), playing: true, speed: old.speed, looping: old.looping, loop: { a: Math.max(T0, a), b: Math.min(T1, b) }, key: it.kind + it.i }; }
function recapSeek(t, keepLoop) { const p = recap.play; if (!p) return; const [T0, T1] = recapSpan(); p.t = Math.max(T0, Math.min(T1, t)); if (!keepLoop) p.loop = null; }
function recapRowAt(t) { const T = recap.trace; let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m][0] <= t) lo = m; else hi = m; } return T[lo]; }
function recapStep(dt) {
  const p = recap.play; if (!p || !recap.trace.length) return; const [T0, T1] = recapSpan();
  if (p.playing) { p.t += dt * p.speed; if (p.loop && p.looping && p.t > p.loop.b + 0.4) p.t = p.loop.a; if (p.t >= T1) { p.t = T1; p.playing = false; recapBarState(); } }
  const r = recapRowAt(p.t); drone.pos = S.v3(r[1], r[2], r[3]); drone.q = { w: r[4], x: r[5], y: r[6], z: r[7] }; drone.vel = S.v3(r[21], r[22], r[23]); for (let i = 0; i < 4; i++) drone.motorW[i] = r[13] && p.playing ? 2600 : 0;
  camMode = recap.cam; const trail = []; for (let k = 15; k >= 1; k--) { const q = recapRowAt(Math.max(T0, p.t - k * 0.03)); trail.push({ thr: q[11], roll: q[24], pitch: q[25], yaw: q[26] }); }
  drawSticks($('#recapSticks'), { thr: r[11], roll: r[24], pitch: r[25], yaw: r[26] }, trail);
  const now = recap.events.filter(e => p.t >= e.t - 0.15 && p.t <= e.t + 0.9); $('#recapNow').innerHTML = now.map(e => `${e.name}<small>${e.exec}</small>`).join('');
  const head = $('#rcHead'); if (head) { head.style.left = ((p.t - T0) / Math.max(0.01, T1 - T0) * 100) + '%'; $('#rcTime').textContent = `${fmtT(p.t - T0)} / ${fmtT(T1 - T0)}`; }
}
const recapSel = () => { const p = recap.play; if (!p || !p.key) return null; return recapItems().find(it => it.kind + it.i === p.key) || null; };
// what the pilot says a call really was: the same trick (= correct), another trick, or not a trick at all
function recapSetCall(i, val) { const e = recap.events[i]; if (!e) return; if (!val) { e.verdict = null; e.actual = null; } else if (val === e.name) { e.verdict = 'yes'; e.actual = null; } else { e.verdict = 'no'; e.actual = val; } recap.dirty = true; }
function recapAddAt(t) { recap.flags.push({ t: +t.toFixed(3), actual: null, added: true }); recap.dirty = true; const i = recap.flags.length - 1, old = recap.play; recapPlay({ kind: 'miss', i, t, f: recap.flags[i] }); recap.play.t = t; recap.play.playing = false; if (old) recap.play.speed = old.speed; }
function recapRemove(it) { if (!it) return; if (it.kind === 'miss') { recap.flags.splice(it.i, 1); if (recap.play) recap.play.key = null; } else { const e = it.e; if (e.verdict === 'no' && e.actual === 'not a trick') { e.verdict = null; e.actual = null; } else { e.verdict = 'no'; e.actual = 'not a trick'; } } recap.dirty = true; }
function recapBarState() { const b = $('#rcPlay'), p = recap.play; if (b && p) b.textContent = p.playing ? '⏸' : '▶'; const l = $('#rcLoop'); if (l && p) l.classList.toggle('lp', !!p.looping); }
function renderRecapBar() {
  const el = $('#recapBar'), p = recap.play; if (!el || !p) return; const [T0, T1] = recapSpan(), W = Math.max(0.01, T1 - T0), pc = t => ((Math.max(T0, Math.min(T1, t)) - T0) / W * 100).toFixed(2);
  const chrono = recapItems().slice().sort((a, b) => a.t - b.t), sel = recapSel(), names = ALL_TRICKS().map(x => nameOf(x));
  const marks = chrono.map((it, k) => { const on = p.key === it.kind + it.i;
    if (it.kind === 'miss') return `<div class="rcM add ${it.f.actual ? 'ok' : ''} ${on ? 'on' : ''}" style="left:${pc(it.t)}%;top:${4 + (k % 3) * 17}px" data-rcm="miss" data-i="${it.i}" title="${esc(it.f.actual || 'trick you added — say what it was')}">${esc(it.f.actual || '＋ ?')}</div>`;
    const e = it.e, gone = e.verdict === 'no' && e.actual === 'not a trick', cls = e.verdict === 'yes' ? 'ok' : gone ? 'gone' : e.verdict === 'no' ? 'bad' : (e.flag || (e.conf != null && e.conf < 0.7)) ? 'unsure' : '';
    return `<div class="rcSpan" style="left:${pc(e.t0)}%;width:${Math.max(0.3, pc(e.t) - pc(e.t0))}%"></div><div class="rcM ${cls} ${on ? 'on' : ''}" style="left:${pc(e.t)}%;top:${4 + (k % 3) * 17}px" data-rcm="call" data-i="${it.i}" title="${esc(e.name)}${e.actual ? ' → ' + esc(e.actual) : ''}">${esc(e.verdict === 'no' && e.actual && !gone ? e.actual : e.name)}</div>`; }).join('');
  const selBox = !sel ? '<span class="note">Click a trick on the timeline, or move to a spot and add one.</span>'
    : sel.kind === 'miss' ? `<b>${sel.f.added ? 'Added' : 'Missed'} @ ${fmtT(sel.t - T0)}</b><select data-rcmiss="${sel.i}"><option value="">what was it?</option>${names.map(n => `<option ${sel.f.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select><button data-rc="remove" title="Take this off the timeline (Delete)">🗑 Remove</button>`
    : `<b>${esc(sel.e.name)} @ ${fmtT(sel.t - T0)}</b>${recapCallSelect(sel.i, sel.e, names)}<button data-rc="remove" title="This wasn't a trick: take it off the timeline (Delete)">${sel.e.verdict === 'no' && sel.e.actual === 'not a trick' ? '↩ Put back' : '🗑 Remove'}</button>`;
  el.innerHTML = `<div class="rcTrack" id="rcTrack"><div class="rcMarks">${marks}</div><div id="rcHead"></div></div>
    <div class="rcRow"><button data-rc="prev" title="Previous trick ([)">⏮</button><button data-rc="back" title="Back 1 s (←)">−1s</button><button data-rc="fb" title="Back one frame (,)">◂</button><button data-rc="toggle" id="rcPlay" class="primary" title="Play / pause (Space)">⏸</button><button data-rc="ff" title="Forward one frame (.)">▸</button><button data-rc="fwd" title="Forward 1 s (→)">+1s</button><button data-rc="next" title="Next trick (])">⏭</button>
      <select id="rcSpeed" title="Playback speed">${[0.1, 0.25, 0.5, 1, 2].map(v => `<option value="${v}" ${p.speed === v ? 'selected' : ''}>${v}×</option>`).join('')}</select>
      <button data-rc="loop" id="rcLoop" title="Loop the selected trick (L)">⟲ loop</button><button data-rc="cam" title="Camera (C)">📷</button><span id="rcTime"></span>
      <button data-rc="add" class="add" title="Add a trick the game missed, at the playhead (A)">＋ Add trick here</button></div>
    <div class="rcRow rcSel">${selBox}</div>`;
  recapBarState();
}
const recapCallSelect = (i, e, names) => `<select data-rcfix="${i}" class="${e.verdict === 'yes' ? 'ok' : e.verdict === 'no' ? 'bad' : ''}"><option value="">it was…</option><option value="${esc(e.name)}" ${e.verdict === 'yes' ? 'selected' : ''}>✓ ${esc(e.name)} (correct)</option><option ${e.verdict === 'no' && e.actual === 'not a trick' ? 'selected' : ''}>not a trick</option>${names.filter(n => n !== e.name).map(n => `<option ${e.verdict === 'no' && e.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
function renderRecap() {
  const el = $('#recapSide'), names = ALL_TRICKS().map(x => nameOf(x)), items = recapItems(), [T0] = recapSpan();
  const done = recap.events.filter(e => e.verdict === 'yes' || (e.verdict === 'no' && e.actual)).length + recap.flags.filter(f => f.actual).length;
  el.innerHTML = `<h3>REVIEW YOUR RUN</h3>
    <p class="note">${recap.events.length} calls${recap.flags.length ? `, ${recap.flags.length} added / missed` : ''} · ${done} labelled. Flagged and unsure calls are first. Pick what each one really was; every label makes the detector better.</p>
    ${items.map(it => { const on = recap.play && recap.play.key === it.kind + it.i; if (it.kind === 'miss') { const f = it.f;
        return `<div class="rvItem pilot ${on ? 'on' : ''}"><span class="t">${fmtT(f.t - T0)}</span><b>${f.added ? 'You added a trick' : 'You flagged a missed trick'}</b><div class="row"><button data-rc="go" data-k="miss" data-i="${it.i}">▶</button><select data-rcmiss="${it.i}"><option value="">what was it?</option>${names.map(n => `<option ${f.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select><button data-rc="delmiss" data-i="${it.i}">✕</button></div></div>`; }
      const e = it.e, cls = e.verdict === 'yes' ? 'ok' : e.verdict === 'no' ? 'bad' : '', unsure = e.conf != null && e.conf < 0.7;
      return `<div class="rvItem ${cls} ${on ? 'on' : ''}"><span class="t">${fmtT(e.t - T0)}</span><b>${e.name}</b> <small>${e.exec}${e.obstacle ? ' · ' + e.obstacle : ''}${e.flag ? ' · <span style="color:#ff8b7d">you flagged this</span>' : unsure ? ' · <span style="color:#ffd34d">the game wasn\'t sure</span>' : ''}</small>
        <div class="row"><button data-rc="go" data-k="call" data-i="${it.i}">▶</button><button data-rc="yes" data-i="${it.i}" title="It was this trick">✓</button>${recapCallSelect(it.i, e, names)}</div></div>`; }).join('')}
    <div class="row"><button data-rc="allyes" class="ghost" title="Mark every call you haven't judged as correct">✓ The rest were right</button></div>
    <div class="row"><button data-rc="export" class="ghost">Export</button>${ghMenus() ? '<button data-rc="upload" class="ghost">↑ Upload</button>' : ''}<button data-rc="close" class="primary">Done</button></div>
    <p class="note" id="recapMsg">${ghMenus() ? (gh.enabled && gh.token ? 'Labels upload when you press Done.' : 'Uploads are off (Options) — labels are kept in this browser; Export saves a file.') : (tel.on ? 'Your answers are shared with the project along with the flight when you press Done.' : 'Your answers are kept in this browser; Export saves a file. Turn on sharing in Options to send them.')}</p>
    <p class="note"><kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> 1 s · <kbd>,</kbd><kbd>.</kbd> frame · <kbd>[</kbd><kbd>]</kbd> trick · <kbd>A</kbd> add · <kbd>Del</kbd> remove · <kbd>L</kbd> loop · <kbd>C</kbd> camera</p>`;
  renderRecapBar();
}
function recapPayload() {
  const labels = [];
  for (const e of recap.events) if (e.verdict) labels.push({ target: e.name, verdict: e.verdict, actual: e.verdict === 'no' ? (e.actual || null) : e.name, repStart: e.t0, t: e.t, detected: [e.name], conf: e.conf, flagged: !!e.flag, via: 'review' });
  for (const f of recap.flags) if (f.actual) labels.push({ target: f.actual, verdict: 'yes', actual: f.actual, repStart: +(f.t - (f.added ? 2.5 : 5)).toFixed(3), t: +(f.t + (f.added ? 2.5 : 0.5)).toFixed(3), detected: [], via: f.added ? 'review-added' : 'flag-missed' });
    else labels.push({ target: 'unknown', verdict: 'unlabelled', actual: null, repStart: +(f.t - 5).toFixed(3), t: f.t, detected: [], via: 'flag-missed', undone: true });
  return { format: 'pro-whooper-session/2', source: 'review', build: '0.1', map: 'playground', camTilt: tune.camTilt, craft: { ...spec }, tune, pilot: store.get('pilot', null),
    run: { id: recap.id, started: recap.started, hz: TRACE_HZ, cols: TRACE_COLS, trace: recap.trace, events: recap.events.map(e => ({ t: e.t, name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, conf: e.conf })), labels } };
}
function recapSave(force) {
  if (!recap.dirty && !force) return; const pl = recapPayload(); if (!pl.run.labels.length) return; recap.dirty = false;
  try { idb.put('runs', { id: 'review-' + recap.id, started: recap.started, review: true, labels: pl.run.labels, events: pl.run.events, hz: TRACE_HZ, cols: TRACE_COLS, trace: recap.trace, craft: { ...spec }, tune }); } catch {}
  ghEnqueue(`calibration/review/${recap.started.replace(/[:.]/g, '-')}-${recap.id}.json`, pl, `run review: ${pl.run.labels.length} labels`);
  // with flight telemetry on, the labels follow the flight to the drop-off (the flight itself carries the trace)
  if (tel.on) { telCapture('review'); telQueue('labels', telStamp(recap), { format: 'pro-whooper-flight-labels/1', build: '0.1', flight: recap.id, started: recap.started, pilot: telPilot(), name: pilotName() || null, labels: pl.run.labels }); }
}
function recapJump(dir) { const p = recap.play; if (!p) return; const L = recapItems().slice().sort((a, b) => a.t - b.t); const it = dir > 0 ? L.find(x => x.t > p.t + 0.05 && x.kind + x.i !== p.key) : L.slice().reverse().find(x => x.t < p.t - 0.3 && x.kind + x.i !== p.key); if (it) recapPlay(it); }
document.addEventListener('click', e => {
  const m = e.target.closest('[data-rcm]'); if (m && mode === 'recap') { const i = +m.dataset.i; recapPlay(m.dataset.rcm === 'miss' ? { kind: 'miss', i, t: recap.flags[i].t, f: recap.flags[i] } : { kind: 'call', i, t: recap.events[i].t, e: recap.events[i] }); renderRecap(); return; }
  const b = e.target.closest('[data-rc]'); if (b && mode === 'recap') { const a = b.dataset.rc, i = +b.dataset.i, p = recap.play;
    if (a === 'go') recapPlay(b.dataset.k === 'miss' ? { kind: 'miss', i, t: recap.flags[i].t, f: recap.flags[i] } : { kind: 'call', i, t: recap.events[i].t, e: recap.events[i] });
    if (a === 'yes') { const ev = recap.events[i]; recapSetCall(i, ev.name); }
    if (a === 'delmiss') { recap.flags.splice(i, 1); recap.dirty = true; if (p) p.key = null; }
    if (a === 'allyes') { for (const ev of recap.events) if (!ev.verdict) ev.verdict = 'yes'; recap.dirty = true; }
    if (a === 'export') saveFile(`run-review-${recap.id}.json`, JSON.stringify(recapPayload()));
    if (a === 'upload') { recapSave(true); if (!(gh.enabled && gh.token)) { closeRecap(); openOptions(); return; } }
    if (a === 'close') { closeRecap(); return; }
    if (p) {
      if (a === 'toggle') { if (!p.playing && p.t >= recapSpan()[1] - 0.02) p.t = recapSpan()[0]; p.playing = !p.playing; recapBarState(); return; }
      if (a === 'back' || a === 'fwd') { recapSeek(p.t + (a === 'fwd' ? 1 : -1)); return; }
      if (a === 'fb' || a === 'ff') { p.playing = false; recapSeek(p.t + (a === 'ff' ? 1 : -1) / TRACE_HZ * 2); recapBarState(); return; }
      if (a === 'prev' || a === 'next') recapJump(a === 'next' ? 1 : -1);
      if (a === 'loop') { p.looping = !p.looping; recapBarState(); return; }
      if (a === 'cam') { recap.cam = recap.cam === 'fpv' ? 'chase' : 'fpv'; return; }
      if (a === 'add') recapAddAt(p.t);
      if (a === 'remove') recapRemove(recapSel());
    }
    renderRecap(); return; }
  const act = e.target.closest('[data-act]'); if (act && act.dataset.act === 'recap') openRecap(mode === 'paused' && !$('#resultsScreen').classList.contains('hide') ? 'results' : 'pause');
  if (act && act.dataset.act === 'warmup') startWarmup();
});
// scrubbing: press or drag on the timeline (not on a trick mark)
let recapDrag = false;
const recapScrub = e => { const tr = $('#rcTrack'); if (!tr) return; const r = tr.getBoundingClientRect(), [T0, T1] = recapSpan(); recapSeek(T0 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (T1 - T0)); };
addEventListener('pointerdown', e => { if (mode !== 'recap' || !e.target.closest('#rcTrack') || e.target.closest('[data-rcm]')) return; recapDrag = true; recapScrub(e); e.preventDefault(); });
addEventListener('pointermove', e => { if (recapDrag) recapScrub(e); });
addEventListener('pointerup', () => { recapDrag = false; });
document.addEventListener('change', e => {
  if (mode !== 'recap') return;
  if (e.target.id === 'rcSpeed') { if (recap.play) recap.play.speed = +e.target.value; e.target.blur(); return; }
  if (e.target.dataset.rcfix !== undefined) { recapSetCall(+e.target.dataset.rcfix, e.target.value); renderRecap(); }
  if (e.target.dataset.rcmiss !== undefined) { recap.flags[+e.target.dataset.rcmiss].actual = e.target.value || null; recap.dirty = true; renderRecap(); }
});
addEventListener('keydown', e => {
  if (mode !== 'recap' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; const p = recap.play, click = a => { const b = document.querySelector(`#recapBar [data-rc="${a}"]`); if (b) b.click(); };
  const map = { Space: 'toggle', ArrowLeft: 'back', ArrowRight: 'fwd', Comma: 'fb', Period: 'ff', BracketLeft: 'prev', BracketRight: 'next', KeyL: 'loop', KeyC: 'cam', KeyA: 'add', Delete: 'remove', Backspace: 'remove' };
  if (map[e.code] && p) { e.preventDefault(); click(map[e.code]); }
  if (e.code === 'Escape') closeRecap();
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
    <label>Your name or handle (optional)<input id="fbName" maxlength="60" value="${esc(store.get('fb.name', '') || pilotName())}"></label>
    <label class="chk"><input type="checkbox" id="fbCtx" checked> Include what I was doing (screen, craft, rates, camera tilt, last few trick calls)</label>
    <div class="row"><button data-fb="send" class="primary">Send</button><button data-fb="file">Save as file</button><button data-fb="copy">Copy</button>${ghMenus() && gh.token ? '<button data-fb="issue" title="Opens GitHub in a new tab with your comment filled in">Open a GitHub issue</button>' : ''}<button data-fb="close" class="ghost">Cancel</button></div>
    <p class="note" id="fbMsg">${ghMenus() && gh.enabled && gh.token ? `Goes to ${esc(gh.owner)}/${esc(gh.repo)}/feedback/.` : 'Send passes it to the project when this copy can reach it; until then it is kept in this browser. Save as file or Copy also work.'}</p></div>`;
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
  const all = store.get('feedback', []); if (!all.some(x => x.at === p.at)) { all.push({ ...p, queued: true }); store.set('feedback', all.slice(-50)); }
  if (a === 'send') { const sent = ghEnqueue(`feedback/${p.at.replace(/[:.]/g, '-')}-${slug(p.category)}.json`, p, `feedback: ${p.category}`); if (!sent) telQueue('feedback', `${p.at.replace(/[:.]/g, '-')}-${slug(p.category)}`, p); $('#fbModal').classList.add('hide'); flashNote('Thank you! Your feedback is on its way (or kept here until this copy can send it).'); }
  if (a === 'file') { await saveFile(`feedback-${p.at.slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(p, null, 1)); msg('Saved. Send that file to the project.'); }
  if (a === 'copy') { try { await navigator.clipboard.writeText(fbText(p)); msg('Copied — paste it anywhere.'); } catch { msg('Could not copy here; use Save as file.'); } }
  if (a === 'issue') { const { browser, ...ctx } = p.context || {}; window.open(`https://github.com/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/issues/new?title=${encodeURIComponent(`[${p.category}] ${p.text.slice(0, 60)}`)}&body=${encodeURIComponent(fbText({ ...p, context: p.context ? ctx : null }).slice(0, 5000))}`, '_blank', 'noopener'); msg('Opened GitHub in a new tab (you need a GitHub account to post it).'); }
});
function flashNote(t) { const el = $('#fbToast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
