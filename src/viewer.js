// ============================================================ FLIGHT VIEWER (owner, 2026-11-27)
// "a list of all the flights, and i can just watch them back with the hud and scoring as if it was the live flight",
// "with playback controls". The Review Hub's FLIGHT VIEWER section (owner key) lists every shared flight; one opens here: the
// trace drives the quad in the ordinary flying view, and the calls the game made THEN go through a fresh ScoreKeeper as the
// playhead reaches them, so the score, streak, combo, call-outs, K.W.A.D. letters, OSD and sticks read as they did live.
// Nothing is reviewed, saved or sent. Seeking rebuilds the score from the start up to the playhead (no call-outs on the way).
// Not in it: gap points and INVERTED seconds (the flight files do not record them) and the combo's link by passes (a combo
// banks 3 s after its last trick).
const FV = { on: false, rows: null, tl: [], t: 0, T0: 0, T1: 0, playing: true, speed: 1, k: 0, lastT: -1e9, of: null, keep: null, drag: false, list: null, idx: -1 };
const FV_SPEEDS = [0.25, 0.5, 1, 2, 4];
function fvRow(t) {   // the trace at time t: position, velocity and sticks interpolated, attitude by nlerp
  const T = FV.rows; let lo = 0, hi = T.length - 1; if (t <= T[0][0]) return T[0]; if (t >= T[hi][0]) return T[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m][0] <= t) lo = m; else hi = m; }
  const a = T[lo], b = T[hi], d = b[0] - a[0]; if (d <= 0 || d > 0.2) return a; const u = (t - a[0]) / d, r = a.slice();
  for (const i of [1, 2, 3, 11, 21, 22, 23, 24, 25, 26]) r[i] = a[i] + (b[i] - a[i]) * u;
  const s = a[4] * b[4] + a[5] * b[5] + a[6] * b[6] + a[7] * b[7] < 0 ? -1 : 1; let n = 0;
  for (let i = 4; i < 8; i++) { r[i] = a[i] + (s * b[i] - a[i]) * u; n += r[i] * r[i]; } n = Math.sqrt(n) || 1; for (let i = 4; i < 8; i++) r[i] /= n;
  return r;
}
function fvScore() { const O = FV.of || {}, day = new Date(O.started || O.at || Date.now()).toISOString().slice(0, 10), names = new Set(world.objs.map(o => o.name));
  return new S.ScoreKeeper(null, S.dailyKwad(MAP_ID, day, n => names.has(n))); }
function fvBank(live, bailed) {
  if (!combo.active) return; combo.chain = null;
  if (live) { comboEnd(bailed); return; }
  combo.names = []; combo.pts = 0; combo.active = false; if (score.chainBreak) score.chainBreak();
}
// one moment of the flight: a call (x.e) or a crash (x.crash); live = with its call-outs, as it happened
function fvApply(x, live) {
  if (combo.active && x.t - FV.lastT > COMBO_IDLE) fvBank(live, false);
  if (x.crash) { score.add({ name: 'Crash', exec: 'CRASH' }); if (combo.active) fvBank(live, true); else if (score.chainBreak) score.chainBreak(); if (live) flash('<b>CRASH!</b><small>streak lost</small>', 'crash'); return; }
  const r = score.add(x.e); if (!r) return;
  const last = combo.chain;
  if (CHAIN.has(r.name) && last && last.name === r.name && last.obstacle === (r.obstacle || null) && x.t - last.ft < 3.5) { last.n++; last.ft = x.t; combo.names[combo.names.length - 1] = `${r.name} ×${last.n}`; }
  else { combo.names.push(r.name + (r.exec !== 'CLEAN' ? ` (${String(r.exec).toLowerCase()})` : '')); combo.chain = CHAIN.has(r.name) ? { name: r.name, obstacle: r.obstacle || null, n: 1, ft: x.t } : null; }
  combo.pts += r.net + (r.chainHit ? r.chainHit.pts : 0); combo.active = true; FV.lastT = x.t;
  if (live) trickPop(r);
  if (r.exec === 'BUMP') fvBank(live, true);
}
// the score and combo as they stood at the playhead
function fvRebuild() {
  score = fvScore(); combo.names = []; combo.pts = 0; combo.active = false; combo.chain = null; FV.lastT = -1e9; FV.k = 0;
  while (FV.k < FV.tl.length && FV.tl[FV.k].t <= FV.t) fvApply(FV.tl[FV.k++], false);
  if (combo.active && FV.t - FV.lastT > COMBO_IDLE) fvBank(false, false);
  $('#comboBank').className = ''; popups.innerHTML = ''; renderCombo(); updateBreakdown(); fvBarState();
}
function fvSeek(t) { FV.t = Math.max(FV.T0, Math.min(FV.T1, t)); fvRebuild(); fvPose(); }
function fvPose() {
  const r = fvRow(FV.t); drone.pos = S.v3(r[1], r[2], r[3]); drone.q = { w: r[4], x: r[5], y: r[6], z: r[7] }; drone.vel = S.v3(r[21], r[22], r[23]);
  drone.armed = !!r[13]; drone.crashed = !!r[14]; const w = drone.armed && !drone.crashed ? (0.3 + 0.7 * r[11]) * params.stats.rpmMax * Math.PI / 30 : 0; for (let i = 0; i < 4; i++) drone.motorW[i] = w;
  lastRC = { thr: r[11], roll: r[24], pitch: r[25], yaw: r[26] }; return r;
}
function fvStep(dt) {
  if (!FV.on) return; const prev = FV.t;
  if (FV.playing && !FV.drag) { FV.t += dt * FV.speed;
    const T = FV.rows; let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m][0] <= FV.t) lo = m; else hi = m; }
    if (hi > lo && T[hi][0] - T[lo][0] > 0.5 && FV.t > T[lo][0] + 0.05) FV.t = T[hi][0];   // an idle stretch cut out of the flight: straight on to where it starts again
    if (FV.t >= FV.T1) { FV.t = FV.T1; FV.playing = false; }
    while (FV.k < FV.tl.length && FV.tl[FV.k].t <= FV.t) { const x = FV.tl[FV.k++]; fvApply(x, FV.t - prev < 1.5); }
    if (combo.active && FV.t - FV.lastT > COMBO_IDLE) fvBank(true, false); }
  fvPose(); combo.lastT = performance.now() / 1000 - (FV.t - FV.lastT);   // the combo timer runs on the flight's clock
  if (FV.playing) updateAudio(); else if (actx) for (const g of gains) g.gain.setTargetAtTime(0, actx.currentTime, 0.05);
  hud(); stickHud(lastRC); renderCombo();
  $('#osdTimer').textContent = fmtT(FV.t - FV.T0); $('#osdState').textContent = drone.crashed ? 'CRASH' : drone.armed ? '' : 'DISARMED'; $('#sessionT').textContent = 'FLIGHT VIEWER';
  fvHead();
}
// ---- the bar: ✕ · ◂ flight ▸ · ⏮ −5 ⏯ +5 · the timeline (a tick per call, red for crashes) · speed · camera · sticks
function fvBarHtml() {
  const O = FV.of || {}, D = FV.T1 - FV.T0 || 1, pos = t => ((t - FV.T0) / D * 100).toFixed(2) + '%';
  const ticks = FV.tl.map(x => `<i class="${x.crash ? 'cr' : x.e.exec === 'BUMP' ? 'bp' : ''}" style="left:${pos(x.t)}" title="${esc(fmtT(x.t - FV.T0) + ' · ' + (x.crash ? 'crash' : x.e.name))}"></i>`).join('');
  const when = O.started || O.at ? new Date(O.started || O.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="fvTop"><b>FLIGHT VIEWER</b><span>${esc(O.name || '(no name)')} · ${esc(lbMapTitle(MAP_ID))}${when ? ' · ' + esc(when) : ''} · ${FV.tl.filter(x => !x.crash).length} calls</span></div>
    <div class="fvRow"><button data-fv="close" title="Back to the list (Esc)">✕</button><button data-fv="prevf" title="The flight before in the list" ${FV.idx > 0 ? '' : 'disabled'}>◂</button><button data-fv="nextf" title="The next flight in the list" ${FV.list && FV.idx < FV.list.length - 1 ? '' : 'disabled'}>▸</button>
    <span class="fvSep"></span><button data-fv="start" title="From the start (Home)">⏮</button><button data-fv="back" title="5 s back (←; Shift: 1 s)">−5</button><button data-fv="play" id="fvPlay" title="Play / pause (Space)">⏸</button><button data-fv="fwd" title="5 s on (→; Shift: 1 s)">+5</button>
    <div id="fvTrack" title="Click or drag to go there">${ticks}<b id="fvHead"></b></div><span id="fvTime"></span>
    ${FV_SPEEDS.map(s => `<button data-fv="sp" data-s="${s}" class="fvSp">×${s}</button>`).join('')}<span class="fvSep"></span><button data-fv="cam" id="fvCam" title="FPV / chase camera (C)"></button><button data-fv="sticks" id="fvSticks" title="Stick overlay (V)">🕹</button></div>`;
}
function fvBarState() {
  const b = $('#fvPlay'); if (b) b.textContent = FV.playing ? '⏸' : '▶'; for (const x of document.querySelectorAll('#fvBar .fvSp')) x.classList.toggle('on', +x.dataset.s === FV.speed);
  const c = $('#fvCam'); if (c) c.textContent = camMode === 'fpv' ? 'FPV' : 'CHASE'; const st = $('#fvSticks'); if (st) st.classList.toggle('on', stickUI.on);
}
function fvHead() { const h = $('#fvHead'); if (h) h.style.left = ((FV.t - FV.T0) / (FV.T1 - FV.T0 || 1) * 100) + '%'; const tm = $('#fvTime'); if (tm) tm.textContent = `${fmtT(FV.t - FV.T0)} / ${fmtT(FV.T1 - FV.T0)}`; }
function fvTrackT(e) { const b = $('#fvTrack').getBoundingClientRect(); return FV.T0 + Math.max(0, Math.min(1, (e.clientX - b.left) / (b.width || 1))) * (FV.T1 - FV.T0); }
// ---- open / close
const fvPlain = x => String(x).replace(/[<>&"'`\\]/g, '');   // someone else's file: no markup gets into the call-outs
function fvOpen(rows, events, of) {
  if (!Array.isArray(rows) || rows.length < TRACE_HZ || !rows.every(r => Array.isArray(r) && r.length >= 27 && r.every(Number.isFinite))) throw new Error('bad trace');
  if (!$('#judgeBox').classList.contains('hide')) stopJudge();
  if (!FV.on) FV.keep = { score, cam: camMode, rc: lastRC };
  FV.rows = rows; FV.of = of || {}; FV.T0 = rows[0][0]; FV.T1 = rows[rows.length - 1][0]; FV.t = FV.T0; FV.playing = true; FV.on = true;
  const tl = (Array.isArray(events) ? events : []).filter(e => e && Number.isFinite(e.t) && typeof e.name === 'string' && e.name !== 'Crash' && e.name !== 'near' && !e.maybe).slice(0, 400)
    .map(e => ({ t: e.t, e: { name: S.canonTrick(fvPlain(e.name).slice(0, 60)), exec: ['CLEAN', 'SLOPPY', 'BUMP', 'MISSED', 'CRASH'].includes(e.exec) ? e.exec : 'CLEAN', clean: Number.isFinite(e.clean) ? e.clean : undefined, obstacle: typeof e.obstacle === 'string' ? fvPlain(e.obstacle).slice(0, 60) : null } }));
  for (let i = 1; i < rows.length; i++) if (rows[i][14] && !rows[i - 1][14]) tl.push({ t: rows[i][0], crash: true });
  FV.tl = tl.sort((a, b) => a.t - b.t);
  mode = 'viewer'; show(null); $('#hud').classList.remove('hide'); $('#recapUI').classList.add('hide'); document.body.classList.add('fvOn');
  const bar = $('#fvBar'); bar.innerHTML = fvBarHtml(); bar.classList.remove('hide'); kwadShow(); fvSeek(FV.T0); fvBarState();
}
function fvClose(toHub = true) {
  if (!FV.on) return; FV.on = false; FV.rows = null; FV.tl = []; $('#fvBar').classList.add('hide'); document.body.classList.remove('fvOn');
  const K = FV.keep || {}; if (K.score) score = K.score; if (K.cam) camMode = K.cam; if (K.rc) lastRC = K.rc; FV.keep = null;
  combo.names = []; combo.pts = 0; combo.active = false; combo.chain = null; popups.innerHTML = ''; $('#comboBank').className = ''; renderCombo(); updateBreakdown();
  drone.reset(activeWorld.spawn); detector.reset(); $('#hud').classList.add('hide');
  if (toHub) hubOpen('viewer'); else { mode = 'menu'; show('#mainMenu'); }
}
async function fvOpenFile(file) {
  const i = desk.info[file], it = (desk.list || []).find(x => x.file === file); if (!i || i.bad) throw new Error('not loaded');
  const p = i.p; fvOpen(await FlightLog.unpack(p.trace), p.events, { name: p.name || '(no name)', started: p.started, at: it && it.at, file });
}
async function fvStepFlight(d) {   // ◂ / ▸: the flight before or after in the hub's list (another map reloads into it)
  const L = FV.list, k = FV.idx + d; if (!L || k < 0 || k >= L.length) return; const it = L[k];
  if (it.map && S.MAPS[it.map] && (it.map !== MAP_ID || MAP_EDITS)) { fvClose(false); hubReloadTo(it.map, 'viewer', it.key); return; }
  try { FV.idx = k; await it.open(); } catch { flash('<b>THAT FLIGHT COULD NOT BE OPENED</b>', 'near'); }
}
// the hub's rows (hub.js hubItems 'viewer')
function fvItems() {
  const out = []; if (!desk.list) return out;
  for (const it of desk.list) { const i = desk.info[it.file]; if (!i || i.bad) continue;
    out.push({ key: 'viewer:' + it.file, title: `${i.name || '(no name)'} · ${i.calls} call${i.calls === 1 ? '' : 's'}`, sub: `${hubMapT(i.map)} · ${hubAgo(it.at)}${i.secs ? ' · ' + fmtT(i.secs) : ''}`, map: i.map, pilot: String(i.name || '').toLowerCase(), tricks: (i.p.events || []).map(e => e && e.name).filter(Boolean), at: it.at, done: false, open: () => fvOpenFile(it.file) }); }
  return out;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-fv]'); if (!b || !FV.on) return; const a = b.dataset.fv;
  if (a === 'close') fvClose(); if (a === 'prevf') fvStepFlight(-1); if (a === 'nextf') fvStepFlight(1);
  if (a === 'start') { fvSeek(FV.T0); FV.playing = true; } if (a === 'back') fvSeek(FV.t - 5); if (a === 'fwd') fvSeek(FV.t + 5);
  if (a === 'play') { if (!FV.playing && FV.t >= FV.T1 - 0.01) fvSeek(FV.T0); FV.playing = !FV.playing; }
  if (a === 'sp') FV.speed = +b.dataset.s; if (a === 'cam') camMode = camMode === 'fpv' ? 'chase' : 'fpv'; if (a === 'sticks') { stickUI.on = !stickUI.on; store.set('ui.sticks', stickUI.on); }
  b.blur(); fvBarState();
});
document.addEventListener('pointerdown', e => { const tr = e.target.closest('#fvTrack'); if (!tr || !FV.on) return; FV.drag = true; tr.setPointerCapture(e.pointerId); fvSeek(fvTrackT(e)); });
document.addEventListener('pointermove', e => { if (FV.drag && FV.on) { FV.t = fvTrackT(e); fvPose(); fvHead(); } });
document.addEventListener('pointerup', e => { if (!FV.drag) return; FV.drag = false; if (FV.on) fvSeek(fvTrackT(e)); });
addEventListener('keydown', e => {
  if (mode !== 'viewer' || !FV.on || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; const c = e.code, st = e.shiftKey ? 1 : 5; let used = true;
  if (c === 'Space') { if (!FV.playing && FV.t >= FV.T1 - 0.01) fvSeek(FV.T0); FV.playing = !FV.playing; }
  else if (c === 'ArrowLeft') fvSeek(FV.t - st); else if (c === 'ArrowRight') fvSeek(FV.t + st); else if (c === 'Home') fvSeek(FV.T0); else if (c === 'End') fvSeek(FV.T1);
  else if (c === 'Comma' || c === 'Period') { FV.playing = false; fvSeek(FV.t + (c === 'Comma' ? -0.1 : 0.1)); }
  else if (c === 'BracketLeft' || c === 'BracketRight') { const k = FV_SPEEDS.indexOf(FV.speed); FV.speed = FV_SPEEDS[Math.max(0, Math.min(FV_SPEEDS.length - 1, (k < 0 ? 2 : k) + (c === 'BracketRight' ? 1 : -1)))]; }
  else if (c === 'KeyC') camMode = camMode === 'fpv' ? 'chase' : 'fpv'; else if (c === 'KeyV') { stickUI.on = !stickUI.on; store.set('ui.sticks', stickUI.on); }
  else if (c === 'KeyH') setShowFrame(!showFrame); else if (c === 'Tab') $('#breakdown').classList.toggle('hide'); else if (c === 'Escape') fvClose();
  else used = false;
  if (used) { e.preventDefault(); fvBarState(); }
});
window.__pw = window.__pw || {}; window.__pw.fv = { state: FV, open: (rows, ev, of) => fvOpen(rows, ev, of), close: () => fvClose(), seek: t => fvSeek(t) };
