
// ============================================================ Flag keys, post-run review, pilot warm-up
// (concatenated into the game module). docs/RECOGNITION-ROADMAP.md items 1-4.
// While flying: F = "that last call was wrong", Q = "I just did a trick and got nothing". After the run, Review lists
// every call with a replay of the moment and ✓ / ✗ / "it was actually…"; flagged and low-confidence calls come first.
// Saved as pro-whooper-session/2 (via: "review"), which test/benchmark.js already reads.
const recap = { trace: [], events: [], flags: [], id: null, started: null, play: null, cam: 'fpv', back: 'pause', dirty: false };
const RECAP_MAX = 100 * 60 * 8;   // 8 minutes at 100 Hz
function recapReset() { recap.guest = false; recap.trace = []; recap.events = []; recap.flags = []; recap.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); recap.started = new Date().toISOString(); recap.dirty = false; recap.mode = null; recap.spill = null; recap.pieces = []; recap.pieceN = 0; recap.telUpTo = -Infinity; try { recap.feel0 = feelSnap(); } catch { recap.feel0 = null; } }
// the game-feel settings a run was flown with (Garage → Advanced sliders, battery, flight mode, radio link, camera): shared
// flights carry them in summary.feel so the defaults can be tuned from what pilots really choose (tools/feel.js)
function feelSnap() { const f = {}; for (const k in S.FEEL_KEYS) f[k] = Number.isFinite(+tune[k]) ? +tune[k] : 1;
  for (const k of ['batteryLife', 'flightMode', 'rcLinkHz', 'rcDelayMs', 'rcSmooth', 'rcSmoothFactor', 'camTilt', 'camFov', 'ratesType', 'rateProfile', 'wallGrip', 'drain', 'propCt', 'propCq']) if (tune[k] !== undefined) f[k] = tune[k];
  if (f.batteryLife === undefined) f.batteryLife = true; return f; }
function recapRow(row) { if (mode !== 'fly' || race.on) return; if (!recap.id) recapReset(); recap.trace.push(row); if (!recap.mode && recap.trace.length > 100) recap.mode = train.on ? 'calibration' : session ? 'session' : 'free'; if (recap.trace.length > RECAP_MAX) telSpill(recap.trace.shift()); if (recap.pieces && recap.pieces.length && (!row[13] || row[14] || recap.pieces.length > 1)) telPieceGo(); }
function recapEvent(ev) {
  if (mode !== 'fly' || race.on || ev.name === 'near' || ev.name === 'Crash') return;
  const toks = ev.toks || [], t = drone.time, t0 = toks.length ? t - (detector.time - Math.min(...toks.map(k => k.t0))) : t - (ev.laps ? ev.laps * 4 : 1.5);
  recap.events.push({ t: +t.toFixed(3), t0: +Math.max(recap.trace.length ? recap.trace[0][0] : 0, t0).toFixed(3), name: ev.name, exec: ev.exec, clean: ev.clean, obstacle: ev.obstacle || null, conf: ev.watch ? ev.watch.conf : null, fails: ev.watch ? ev.watch.fails : [], verdict: null, actual: null });
}
// "maybe <trick>?": the trick library's guess where the rules called nothing (never scored). It goes in the review list
// like a call, so the pilot's ✓ / ✗ teaches the library and the rules (labels carry maybe: true).
function recapMaybe(m) {
  if (mode !== 'fly' || race.on || !m || typeof m.name !== 'string') return; const t = +(drone.time - (detector.time - m.t1)).toFixed(3), t0 = +(drone.time - (detector.time - m.t0)).toFixed(3);
  recap.events.push({ t, t0: Math.max(recap.trace.length ? recap.trace[0][0] : 0, t0), name: m.name, exec: 'MAYBE', clean: null, obstacle: null, conf: m.sim, fails: [], verdict: null, actual: null, maybe: true }); recap.dirty = true;
}
function recapFlag(kind) {
  if (mode !== 'fly' || race.on) return;
  if (kind === 'wrong') { const e = recap.events[recap.events.length - 1]; if (!e || drone.time - e.t > 12) { flash('<b>NOTHING TO FLAG</b><small>no call in the last few seconds</small>', 'near'); return; }
    e.flag = true; e.verdict = 'no'; recap.dirty = true; flash(`<b>FLAGGED</b><small>"${e.name}" marked wrong — fix it in SKITTLES mode after the run</small>`, 'near'); }
  else { recap.flags.push({ t: +drone.time.toFixed(3), actual: null }); recap.dirty = true; flash('<b>MISSED TRICK NOTED</b><small>say what it was in SKITTLES mode after the run</small>', 'near'); }
}
addEventListener('keydown', e => {
  if (mode !== 'fly' || race.on || train.on || coach.on || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (e.code === 'KeyF') recapFlag('wrong'); if (e.code === 'KeyQ') recapFlag('missed');
});
// ---- the review screen: game view on the left replaying the moment, the list on the right
const recapItems = () => [...recap.events.map((e, i) => ({ kind: 'call', i, t: e.t, e })).filter(x => !x.e.hidden), ...recap.flags.map((f, i) => ({ kind: 'miss', i, t: f.t, f })).filter(x => !x.f.hidden)]
  .sort((a, b) => { const pa = a.kind === 'miss' || a.e.flag || a.e.maybe ? 0 : a.e.conf != null && a.e.conf < 0.7 ? 1 : 2, pb = b.kind === 'miss' || b.e.flag || b.e.maybe ? 0 : b.e.conf != null && b.e.conf < 0.7 ? 1 : 2; return pa - pb || a.t - b.t; });
function openRecap(from) {
  if (!$('#judgeBox').classList.contains('hide')) stopJudge();   /* Judge the Bot's panel never stays over a review */
  if (recap.trace.length < TRACE_HZ) { flash('<b>NOTHING TO REPLAY YET</b><small>fly first</small>', 'near'); return; }
  recap.back = from || 'pause'; mode = 'recap'; drone.armed = false; show(null); $('#hud').classList.add('hide'); $('#recapUI').classList.remove('hide'); document.body.classList.add('bbr');
  recap.saved = { pos: drone.pos, q: drone.q, vel: drone.vel }; recapClipsReset(); recap.rec = null; recap.review = !recap.guest && store.get('recapReview', true);
  const first = recap.review ? recapItems()[0] : null; if (first) recapPlay(first); else { const [T0] = recapSpan(); recap.play = { t: T0, playing: true, speed: 1, looping: true, loop: null, key: null }; }
  renderRecap();
}
function closeRecap() {
  // a reviewer who moved, stretched, graded or grouped a call without saying whether it was right has decided nothing yet (owner,
  // 2026-11-20: the review queue's Wall Tap was moved, Done sent nothing and showed nothing): ask, rather than drop it silently
  if (recap.guest && recap.review) { const und = recap.events.filter(e => !e.verdict && !e.hidden && (e.span || e.execActual || e.grp != null || (e.extra && e.extra.length)));
    if (und.length) { const names = [...new Set(und.map(e => e.name))].slice(0, 3).join(', ');
      if (!confirm(`You changed ${names} but didn't say whether ${und.length > 1 ? 'they were' : 'it was'} right.\n\nOK: count ${und.length > 1 ? 'them' : 'it'} as right (✓) and send.\nCancel: keep reviewing (✓ or "it was…" on the call).`)) return;
      for (const e of und) e.verdict = 'yes'; recap.dirty = true; } }
  quickReplicasGo();   // the answers are final now: fly their bot replicas
  recap.quick = null; $('#recapUI').classList.remove('quick'); recapRecStop(true); recapSave(); recap.play = null; $('#recapUI').classList.add('hide'); $('#hud').classList.remove('hide'); document.body.classList.remove('bbr'); drone.reset(activeWorld.spawn); detector.reset();   /* the HUD comes back (owner: after Quick check there was no UI) */
  if (recap.guest) { const src = (recap.guestOf || {}).source, of0 = recap.guestOf, ev0 = recap.events.concat(recap.flags); if (src === 'desk' && desk.openFile && recap.events.some(e => e.verdict) ) { const dn = store.get('deskDone', {}); dn[desk.openFile] = 1; store.set('deskDone', dn); }
    if (src === 'desk' && of0 && of0.clip && (ev0.some(e => e.verdict) || recap.flags.length)) { const dq = store.get('deskQDone', {}); dq[of0.clip] = Date.now(); const ks = Object.keys(dq); if (ks.length > 2000) for (const k of ks.sort((x, y) => dq[x] - dq[y]).slice(0, ks.length - 2000)) delete dq[k]; store.set('deskQDone', dq); }   // a review-queue moment you judged
    recap.guest = false; recap.guestOf = null; if (LB.keep) { Object.assign(recap, LB.keep); LB.keep = null; } else { recapReset(); recap.telDone = recap.id; }
    if (src === 'judge') { const k = (of0 || {}).clip; if (k && ev0.some(e => e.verdict)) { JG.done[k] = 1; store.set('judgeDone', JG.done); } mode = 'menu'; show('#judgeScreen'); judgeRender(); return; }
    if (src === 'desk') { mode = 'menu'; show('#deskScreen'); deskRender(); } else { mode = LB.from === 'results' ? 'paused' : 'menu'; show('#lbScreen'); lbRender(); } return; }
  if (recap.back === 'results') { mode = 'paused'; show('#resultsScreen'); } else if (recap.back === 'menu') { mode = 'menu'; show('#mainMenu'); } else { mode = 'paused'; show('#pause'); }
}
// The player: the whole run on a timeline. Picking a call (or a mark on the timeline) jumps to it and loops that moment;
// scrubbing or stepping leaves the loop. p = { t, playing, speed, looping, loop: {a, b} | null, key }
// Every item on the timeline is a block with a start and an end the pilot can drag and stretch. The game's own times
// (e.t0, e.t) are kept; the pilot's version is e.span / f.t0..f.t and goes into the label next to them.
// Clips: the run starts as one piece. Split cuts the piece under the red line in two; picking a piece selects it, and
// its two handles trim it. Export records the selected piece. recap.clip is always the selected piece (or null).
function recapClipsReset() { const [T0, T1] = recapSpan(); recap.clips = [{ a: T0, b: T1 }]; recap.clipSel = null; recap.clip = null; }
function recapClipPick(i) { recap.clipSel = i == null || !recap.clips[i] ? null : i; recap.clip = recap.clipSel == null ? null : recap.clips[recap.clipSel]; }
const recapClipAt = t => recap.clips.findIndex(c => t >= c.a && t <= c.b);
function recapClipSplit(t) { const i = recapClipAt(t); if (i < 0) return false; const c = recap.clips[i]; if (t - c.a < 0.3 || c.b - t < 0.3) return false;
  recap.clips.splice(i, 1, { a: c.a, b: +t.toFixed(3) }, { a: +t.toFixed(3), b: c.b }); recapClipPick(i + 1); return true; }
function recapClipTrim(i, a, b) { const C = recap.clips, c = C[i]; if (!c) return; const [T0, T1] = recapSpan(), lo = i > 0 ? C[i - 1].b : T0, hi = i < C.length - 1 ? C[i + 1].a : T1;
  a = Math.max(lo, Math.min(a, c.b - 0.3)); b = Math.min(hi, Math.max(b, a + 0.3)); c.a = +a.toFixed(3); c.b = +b.toFixed(3); }
function recapClipDelete(i) { if (!recap.clips[i]) return; recap.clips.splice(i, 1); recapClipPick(null); if (!recap.clips.length) recapClipsReset(); }
// What a pilot can say a trick was: every trick in the book, plus the ways the book's names fall short when labelling
// real flying: the loop family and Mattys flown in open air (no object), trippies with nothing in the middle, and
// single laps (the book's trippy and orbit are two laps). A variant is stored as the book's name plus `openAir` /
// `laps` on the label, so the benchmark still compares like with like.
const RECAP_VARIANTS = ['Powerloop (open air)', 'Inverted 360 Powerloop (open air)', 'Matty Flip (open air)', 'Split-S (open air)', 'Immelmann Turn (open air)',
  'Trippy Spin x1', 'Trippy Spin x1 (open air)', 'Trippy Spin x2 (open air)', 'Double Rolling Trippy Spin (open air)', 'Orbit x1'];
// Tricks the book does not have (a Rollback, a local move, something new): the pilot types the name once and it is
// offered from then on (kept in this browser). Labels carry `custom: true`; the detector has no rule for them yet, so
// they are the raw material for writing one (tools/signatures.js lists what was measured in each).
const recapCustom = () => (store.get('customTricks', []) || []).filter(x => typeof x === 'string').slice(0, 60);
const recapCleanTrick = v => String(v || '').replace(/[\u0000-\u001f<>"&]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
function recapAddCustom(v) { const n = recapCleanTrick(v); if (n.length < 2) return null; const L = recapCustom(); const have = [...ALL_TRICKS().map(x => nameOf(x)), ...RECAP_VARIANTS, ...L].find(x => x.toLowerCase() === n.toLowerCase()); if (have) return have; L.push(n); store.set('customTricks', L); return n; }
const recapNames = () => { const base = ALL_TRICKS().map(x => nameOf(x)); return abcSort([...base, ...RECAP_VARIANTS.filter(v => !base.includes(v)), ...recapCustom().filter(v => !base.includes(v))]); };
const recapNewHtml = () => `<span class="rcNew"><input data-rcnew="1" maxlength="40" placeholder="or name a new trick…" onkeydown="event.stopPropagation(); if (event.key === 'Enter') this.nextElementSibling.click()"><button data-rc="newtrick" title="Use this name for the selected trick (it is remembered for next time)">Use</button></span>`;
function recapVariant(name) { if (name && recapCustom().includes(name)) return { actual: name, custom: true };
  if (!name || !RECAP_VARIANTS.includes(name)) return { actual: name || null };
  const openAir = / \(open air\)$/.test(name), b = name.replace(/ \(open air\)$/, ''), one = / x1$/.test(b); return { actual: one ? b.replace(/ x1$/, ' x2') : b, variant: name, openAir: openAir || undefined, laps: one ? 1 : undefined }; }
// A tile can hold more than one trick: the first is what the block is called, `extra` lists the tricks that follow it
// inside the same stretch, in order (a combo the pilot does not want to cut into separate blocks).
const recapExtra = it => (it.kind === 'call' ? it.e.extra : it.f.extra) || [];
function recapTileAdd(it, name) { if (!it || !name) return; const o = it.kind === 'call' ? it.e : it.f; (o.extra = o.extra || []).push(name); if (o.extra.length > 8) o.extra.length = 8; recap.dirty = true; }
function recapTileDel(it, k) { if (!it) return; const o = it.kind === 'call' ? it.e : it.f; if (o.extra) { o.extra.splice(k, 1); if (!o.extra.length) delete o.extra; } recap.dirty = true; }
const recapTileHtml = (it, names) => `<span class="rcTile">${recapExtra(it).map((n, k) => `<span class="rcChip">→ ${esc(n)}<button data-rc="tiledel" data-k="${k}" title="Take this trick out of the tile">✕</button></span>`).join('')}<select data-rctile="1" title="This tile was more than one trick: add the next one (a combo in one tile)"><option value="">＋ trick in this tile…</option>${names.map(n => `<option>${n}</option>`).join('')}</select></span>`;
// Combos made by hand: pick several tricks in the list (click, Ctrl-click, Shift-click) and press Combo. Each trick keeps
// its own block and label; they share a group number (`grp`), shown as a yellow frame, and go out as `group` / `groupLen`.
const recapObj = it => it.kind === 'call' ? it.e : it.f, recapKey = it => it.kind + it.i;
const recapChrono = () => recapItems().slice().sort((a, b) => recapSpanOf(a)[0] - recapSpanOf(b)[0]);
function recapPick(key, ev) { const M = recap.multi || (recap.multi = new Set()), L = recapChrono().map(recapKey);
  if (ev && ev.shiftKey && recap.lastPick && L.includes(recap.lastPick)) { const a = L.indexOf(recap.lastPick), b = L.indexOf(key); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) M.add(L[i]); }
  else if (ev && (ev.ctrlKey || ev.metaKey)) { if (M.has(key)) M.delete(key); else M.add(key); recap.lastPick = key; }
  else { M.clear(); M.add(key); recap.lastPick = key; } }
function recapGroup() { const M = recap.multi; if (!M || M.size < 2) return; const id = (recap.grpN = (recap.grpN || 0) + 1); for (const it of recapItems()) if (M.has(recapKey(it))) recapObj(it).grp = id; recap.dirty = true; }
function recapUngroup(it) { if (!it) return; const g = recapObj(it).grp; if (g == null) return; const mates = recapItems().filter(x => recapObj(x).grp === g); delete recapObj(it).grp; if (mates.length <= 2) for (const x of mates) delete recapObj(x).grp; recap.dirty = true; }
function recapDeselect() { const p = recap.play; let had = false; if (p && (p.key || p.loop)) { p.key = null; p.loop = null; had = true; } if (recap.clipSel != null) { recapClipPick(null); had = true; } if (recap.multi && recap.multi.size) { recap.multi.clear(); had = true; } return had; }
const recapSpanOf = it => it.kind === 'call' ? (it.e.span || [it.e.t0, it.e.t]) : [it.f.t0 ?? it.f.t - 2, it.f.t];
function recapSetSpan(it, a, b) { const [T0, T1] = recapSpan(); a = Math.max(T0, Math.min(T1 - 0.1, a)); b = Math.max(a + 0.1, Math.min(T1, b)); a = +a.toFixed(3); b = +b.toFixed(3);
  if (it.kind === 'call') it.e.span = [a, b]; else { it.f.t0 = a; it.f.t = b; } recap.dirty = true; }
// the stretch of the run the timeline shows: all of it, or a zoomed window that follows the playhead
function recapView() { const [T0, T1] = recapSpan(), z = recap.zoom; if (!z || z >= T1 - T0) return [T0, T1]; let a = recap.viewA ?? T0; a = Math.max(T0, Math.min(T1 - z, a)); return [a, a + z]; }
function recapViewFollow(force) { const z = recap.zoom, p = recap.play; if (!z || !p || recap.drag) return false; const [a, b] = recapView(); if (!force && p.t >= a + z * 0.02 && p.t <= b - z * 0.06) return false; recap.viewA = p.t - z * (force ? 0.5 : 0.15); return true; }
function recapZoom(dir) { const [T0, T1] = recapSpan(), W = T1 - T0, cur = recap.zoom && recap.zoom < W ? recap.zoom : W, steps = [5, 10, 20, 40, 80, 160].filter(x => x < W); let z;
  if (dir > 0) z = steps.slice().reverse().find(x => x < cur - 0.01) ?? steps[0] ?? 0; else z = steps.find(x => x > cur + 0.01) ?? 0;
  recap.zoom = z || 0; recapViewFollow(true); renderRecapBar(); }
const recapSpan = () => { const T = recap.trace; return T.length ? [T[0][0], T[T.length - 1][0]] : [0, 1]; };
function recapPlay(it) { if (!it || !recap.trace.length) return; const [T0, T1] = recapSpan(), old = recap.play || { speed: 1, looping: true };
  const sp = recapSpanOf(it), a = sp[0] - 1.2, b = sp[1] + 0.9;
  recap.play = { t: Math.max(T0, a), playing: true, speed: old.speed, looping: old.looping, loop: { a: Math.max(T0, a), b: Math.min(T1, b) }, key: it.kind + it.i }; }
// Moving the red line inside the trick being reviewed keeps the loop; moving it off the trick lets go, and playback
// carries on from there (sticky on the trick, never stuck on it).
function recapSeek(t, keepLoop) { const p = recap.play; if (!p) return; const [T0, T1] = recapSpan(); p.t = Math.max(T0, Math.min(T1, t)); if (!keepLoop && p.loop && (p.t < p.loop.a - 0.05 || p.t > p.loop.b + 0.05)) { p.loop = null; p.left = true; } }
function recapRowAt(t) { const T = recap.trace; let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m][0] <= t) lo = m; else hi = m; } return T[lo]; }
function recapStep(dt) {
  const p = recap.play; if (!p || !recap.trace.length) return; const [T0, T1] = recapSpan();
  const C = recap.clip, R = recap.rec;
  if (p.playing) { p.t += dt * p.speed; if (R) { if (p.t >= R.b) { p.t = R.b; p.playing = false; recapRecStop(); } } else if (C && p.looping) { if (p.t > C.b || p.t < C.a - 0.05) p.t = C.a; } else if (p.loop && p.looping && p.t > p.loop.b + 0.4) p.t = p.loop.a; else if (p.loop && !p.looping && p.t > p.loop.b + 0.4) p.loop = null; if (p.t >= T1) { p.t = T1; p.playing = false; recapBarState(); } }
  const r = recapRowAt(p.t); drone.pos = S.v3(r[1], r[2], r[3]); drone.q = { w: r[4], x: r[5], y: r[6], z: r[7] }; drone.vel = S.v3(r[21], r[22], r[23]); for (let i = 0; i < 4; i++) drone.motorW[i] = r[13] && p.playing ? 2600 : 0;
  camMode = recap.cam; const trail = []; for (let k = 15; k >= 1; k--) { const q = recapRowAt(Math.max(T0, p.t - k * 0.03)); trail.push({ thr: q[11], roll: q[24], pitch: q[25], yaw: q[26] }); }
  drawSticks($('#recapSticks'), { thr: r[11], roll: r[24], pitch: r[25], yaw: r[26] }, trail);
  const now = recap.events.filter(e => p.t >= e.t - 0.15 && p.t <= e.t + 0.9); $('#recapNow').innerHTML = now.map(e => `${esc(e.name)}<small>${esc(e.exec || '')}</small>`).join('');   // a guest run's calls came from someone else's file
  if (R) { const m = $('#rcRecMsg'); if (m) m.textContent = `● recording ${(p.t - R.a).toFixed(1)} / ${(R.b - R.a).toFixed(1)} s`; }
  if (recapViewFollow()) renderRecapBar(); const head = $('#rcHead'); if (head) { const [V0, V1] = recapView(); head.style.left = ((p.t - V0) / Math.max(0.01, V1 - V0) * 100) + '%'; $('#rcTime').textContent = `${fmtT(p.t - T0)} / ${fmtT(T1 - T0)}`; }
}
const recapSel = () => { const p = recap.play; if (!p || !p.key) return null; return recapItems().find(it => it.kind + it.i === p.key) || null; };
// what the pilot says a call really was: the same trick (= correct), another trick, or not a trick at all
// after a verdict on the last trick still in sight, the list scrolls on: that row goes to the top and the next ones come
// into view (nothing moves while the next row is already fully visible)
function recapAutoScroll(key) {
  const row = document.querySelector(`.rvItem[data-rvkey="${key}"]`), box = row && row.closest('.rvSide'); if (!row || !box) return;
  let next = row.nextElementSibling; while (next && !next.classList.contains('rvItem')) next = next.nextElementSibling; if (!next) return;
  const bb = box.getBoundingClientRect(), nb = next.getBoundingClientRect(); if (nb.bottom <= bb.bottom - 4) return;
  box.scrollTop += row.getBoundingClientRect().top - bb.top - 8;
}
function recapSetCall(i, val) { const e = recap.events[i]; if (!e) return; if (!val) { e.verdict = null; e.actual = null; } else if (val === e.name) { e.verdict = 'yes'; e.actual = null; } else { e.verdict = 'no'; e.actual = val; } recap.dirty = true; }
// A trick the pilot adds starts AT the red line and runs 1.5 s (drag its end to fit). Playback is left alone.
function recapAddAt(t, len = 1.5) { const [, T1] = recapSpan(), a = Math.min(t, T1 - 0.2), f = { t0: +a.toFixed(3), t: +Math.min(T1, a + len).toFixed(3), actual: null, added: true }; recap.flags.push(f); recap.dirty = true; if (recap.play) { recap.play.key = 'miss' + (recap.flags.length - 1); recap.play.loop = null; } return f; }
// "…then": the next trick of the same combo, starting where the selected one ends (a call that was really two tricks)
function recapAddAfter(it) { if (!it) return; const sp = recapSpanOf(it), f = recapAddAt(sp[1], 1.2), o = recapObj(it); if (o.grp == null) o.grp = (recap.grpN = (recap.grpN || 0) + 1); f.grp = o.grp; }   // "then…" makes the two a combo
// Deleting takes a trick off the timeline and the list, whoever put it there. A deleted game call is still remembered as
// "not a trick" (that is a label, and a useful one); a deleted added trick is simply gone. Nothing is lost until the
// review is closed: "Bring back deleted" restores them all.
function recapRemove(it) { if (!it) return; const o = recapObj(it); o.hidden = true; delete o.grp; if (it.kind === 'call') { o.verdict = 'no'; o.actual = 'not a trick'; } if (recap.play && recap.play.key === recapKey(it)) { recap.play.key = null; recap.play.loop = null; } if (recap.multi) recap.multi.delete(recapKey(it)); recap.dirty = true; }
function recapRestoreAll() { for (const e of recap.events) if (e.hidden) { e.hidden = false; e.verdict = null; e.actual = null; } for (const f of recap.flags) if (f.hidden) f.hidden = false; recap.dirty = true; }
const recapHiddenN = () => recap.events.filter(e => e.hidden).length + recap.flags.filter(f => f.hidden).length;
function recapBarState() { const b = $('#rcPlay'), p = recap.play; if (b && p) b.textContent = p.playing ? '⏸' : '▶'; const l = $('#rcLoop'); if (l && p) l.classList.toggle('lp', !!p.looping); }
function renderRecapBar() {
  const el = $('#recapBar'), p = recap.play; if (!el || !p) return; const [T0, T1] = recapSpan(), [V0, V1] = recapView(), W = Math.max(0.01, V1 - V0), pc = t => ((t - V0) / W * 100).toFixed(2), wd = (a, b) => Math.max(0.5, (b - a) / W * 100).toFixed(2);
  const chrono = recapItems().slice().sort((a, b) => a.t - b.t), sel = recapSel(), names = recapNames();
  const marks = chrono.map((it, k) => { const on = p.key === it.kind + it.i;
    const sp = recapSpanOf(it), H = '<i class="rcH l"></i><i class="rcH r"></i>', pos = `left:${pc(sp[0])}%;width:${wd(sp[0], sp[1])}%;top:${19 + (k % 3) * 18}px`; if (sp[1] < V0 || sp[0] > V1) return '';
    if (it.kind === 'miss') return `<div class="rcM add ${it.f.actual ? 'ok' : ''} ${on ? 'on' : ''}" style="${pos}" data-rcm="miss" data-i="${it.i}" title="${esc(it.f.actual || 'trick you added — say what it was')} · drag to move, drag an end to stretch">${H}<span class="rcT">${esc(it.f.actual || '＋ ?')}${recapExtra(it).length ? ' → ' + esc(recapExtra(it).join(' → ')) : ''}</span></div>`;
    const e = it.e, gone = e.verdict === 'no' && e.actual === 'not a trick', cls = e.verdict === 'yes' ? 'ok' : gone ? 'gone' : e.verdict === 'no' ? 'bad' : (e.flag || (e.conf != null && e.conf < 0.7)) ? 'unsure' : '';
    return `${e.span ? `<div class="rcSpan" style="left:${pc(e.t0)}%;width:${wd(e.t0, e.t)}%" title="where the game put it"></div>` : ''}<div class="rcM ${cls} ${on ? 'on' : ''}" style="${pos}" data-rcm="call" data-i="${it.i}" title="${esc(e.name)}${e.actual ? ' → ' + esc(e.actual) : ''} · drag to move, drag an end to stretch">${H}<span class="rcT">${esc(e.verdict === 'no' && e.actual && !gone ? e.actual : e.name)}${recapExtra(it).length ? ' → ' + esc(recapExtra(it).join(' → ')) : ''}</span></div>`; }).join('');
  const selBox = !sel ? '<span class="note">Click a trick to pick it. Drag it to move it, drag an end to stretch it, zoom in for fine work. Add a trick at the red line with ＋.</span>'
    : sel.kind === 'miss' ? `<b>${sel.f.added ? 'Added' : 'Missed'} @ ${fmtT(sel.t - T0)}</b><select data-rcmiss="${sel.i}"><option value="">what was it?</option>${names.map(n => `<option ${sel.f.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select>${recapNewHtml()}${recapTileHtml(sel, names)}<span class="rcExec" title="How was it flown?">${[['CLEAN', 'clean'], ['SLOPPY', 'sloppy'], ['BUMP', 'bump']].map(([x, l]) => `<button data-rc="execm" data-i="${sel.i}" data-x="${x}" class="${sel.f.execActual === x ? 'on' : ''}">${l}</button>`).join('')}</span><button data-rc="then" title="Add the next trick of this combo, starting where this one ends (T)">＋ then…</button><button data-rc="remove" title="Take this off the timeline (Delete key)">🗑 Delete</button>`
    : `<b>${esc(sel.e.name)} @ ${fmtT(sel.t - T0)}</b>${recapCallSelect(sel.i, sel.e, names)}${recapNewHtml()}${recapTileHtml(sel, names)}${recapExecBtns(sel.i, sel.e)}<button data-rc="then" title="It was really a combo: add the next trick, starting where this one ends (T)">＋ then…</button>${sel.e.span ? '<button data-rc="unspan" title="Put it back where the game had it">↩ timing</button>' : ''}<button data-rc="remove" title="Take this off the timeline: it was not a trick (Delete key)">🗑 Delete</button>`;
  if (!recap.clips) recapClipsReset();
  const C = recap.clip, clipBand = (C ? `<div class="rcClip" style="left:${pc(C.a)}%;width:${wd(C.a, C.b)}%"></div>` : '')
    + `<div class="rcClips">${recap.clips.map((c, i) => c.b < V0 || c.a > V1 ? '' : `<div class="rcCl ${i === recap.clipSel ? 'on' : ''}" data-rcclip="${i}" style="left:${pc(c.a)}%;width:${wd(c.a, c.b)}%" title="Clip ${i + 1} · ${(c.b - c.a).toFixed(1)} s · click to select, then drag its ends to trim">${i === recap.clipSel ? '<i class="rcH l"></i><i class="rcH r"></i>' : ''}<span class="rcT">clip ${i + 1}</span></div>`).join('')}</div>`;
  document.body.classList.toggle('rcWide', !recap.review);
  const stepS = [1, 2, 5, 10, 15, 30, 60, 120].find(x => W / x <= 14) || 300, ticks = []; for (let t = Math.ceil((V0 - T0) / stepS) * stepS + T0; t <= V1; t += stepS) ticks.push(`<i style="left:${pc(t)}%">${fmtT(t - T0 + 0.05)}</i>`);
  const loopBand = p.loop && p.looping ? `<div class="rcLoopBand" style="left:${pc(p.loop.a)}%;width:${wd(p.loop.a, p.loop.b)}%" title="Looping this trick: drag the red line off it to play on"></div>` : '';
  el.innerHTML = `<div class="rcTrack" id="rcTrack">${clipBand}${loopBand}<div class="rcRuler" title="Drag here to move through the run">${ticks.join('')}</div><div class="rcMarks">${marks}</div><div id="rcHead"><b></b></div></div>
    ${recap.review ? '<div class="rcLegend"><span><i style="background:#9aa0ad"></i>not reviewed</span><span><i style="background:#9aa0ad;box-shadow:0 0 0 2px #ffd34d"></i>not reviewed · unsure or flagged</span><span><i style="background:#35d07f"></i>approved</span><span><i style="background:#ff9a3d"></i>corrected</span><span><i style="background:#ff5a4d"></i>not a trick</span><span><i style="background:#5ab0ff"></i>added by you</span></div>' : ''}
    <div class="rcRow"><button data-rc="prev" title="Previous trick ([)">⏮</button><button data-rc="back" title="Back 1 s (←)">−1s</button><button data-rc="fb" title="Back one frame (,)">◂</button><button data-rc="toggle" id="rcPlay" class="primary" title="Play / pause (Space)">⏸</button><button data-rc="ff" title="Forward one frame (.)">▸</button><button data-rc="fwd" title="Forward 1 s (→)">+1s</button><button data-rc="next" title="Next trick (])">⏭</button>
      <select id="rcSpeed" title="Playback speed">${[0.1, 0.25, 0.5, 1, 2].map(v => `<option value="${v}" ${p.speed === v ? 'selected' : ''}>${v}×</option>`).join('')}</select>
      <button data-rc="loop" id="rcLoop" title="Repeat the selected trick instead of playing on (L)">⟲ loop</button><button data-rc="zin" title="Zoom the timeline in (+ or mouse wheel)">🔍＋</button><button data-rc="zout" title="Zoom out (−)">🔍−</button><button data-rc="cam" title="Camera (C)">📷</button><span id="rcTime"></span>
      ${recap.review ? '<button data-rc="add" class="add" title="Add a trick the game missed, at the playhead (A)">＋ Add trick here</button>' : ''}</div>
    <div class="rcRow"><b>Clips</b><button data-rc="split" title="Cut the replay in two at the red line (S)">✂ Split here</button><button data-rc="in" title="Trim the start of the clip to the red line (I)">[ In</button><button data-rc="out" title="Trim the end of the clip to the red line (O)">Out ]</button>
      <span class="note">${C ? `clip ${recap.clipSel + 1} of ${recap.clips.length} · ${fmtT(C.a - T0)} → ${fmtT(C.b - T0)} · ${(C.b - C.a).toFixed(1)} s · drag its ends to trim` : recap.clips.length > 1 ? 'click a clip on the bottom strip to select it' : sel ? 'no clip picked: export uses the selected trick' : 'move the red line and Split, then pick a clip'}</span>
      ${C ? '<button data-rc="clipdel" title="Throw this clip away (the rest stay)">🗑 Clip</button>' : ''}${recap.clips.length > 1 || C ? '<button data-rc="clipclear" title="Back to one uncut run">Reset</button>' : ''}<button data-rc="exportclip" class="primary" title="Record the clip from this camera, at this speed, as a video file">⬇ Export video</button><span id="rcRecMsg" class="note"></span>
      <label class="chk" style="margin-left:auto"><input type="checkbox" id="rcReview" ${recap.review ? 'checked' : ''}> SKITTLES mode</label><button data-rc="close">${recap.review ? 'Done' : 'Close'}</button></div>
    ${recap.review ? `<div class="rcRow rcSel">${selBox}</div>` : ''}`;
  recapBarState();
}
// how it was flown, as the pilot saw it: the game's own grade is outlined until the pilot picks one
const recapExecBtns = (i, e) => `<span class="rcExec" title="How was it flown? (the game said ${e.exec})">${[['CLEAN', 'clean'], ['SLOPPY', 'sloppy'], ['BUMP', 'bump']].map(([x, l]) => `<button data-rc="exec" data-i="${i}" data-x="${x}" class="${e.execActual === x ? 'on' : !e.execActual && e.exec === x ? 'was' : ''}">${l}</button>`).join('')}</span>`;
const recapCallSelect = (i, e, names) => `<select data-rcfix="${i}" class="${e.verdict === 'yes' ? 'ok' : e.verdict === 'no' ? 'bad' : ''}"><option value="">it was…</option><option value="${esc(e.name)}" ${e.verdict === 'yes' ? 'selected' : ''}>✓ ${esc(e.name)} (correct)</option><option ${e.verdict === 'no' && e.actual === 'not a trick' ? 'selected' : ''}>not a trick</option>${names.filter(n => n !== e.name).map(n => `<option ${e.verdict === 'no' && e.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
function renderRecap() {
  const el = $('#recapSide'), names = recapNames(), items = recapItems(), [T0] = recapSpan();
  $('#recapUI').classList.toggle('quick', !!recap.quick); if (recap.quick) { el.classList.remove('hide'); renderQuick(); return; }
  el.classList.toggle('hide', !recap.review); if (!recap.review) { renderRecapBar(); return; }
  const done = recap.events.filter(e => e.verdict === 'yes' || (e.verdict === 'no' && e.actual)).length + recap.flags.filter(f => f.actual).length;
  el.innerHTML = `<h3>${recap.guest ? 'REVIEWING ' + esc(String((recap.guestOf || {}).name || 'A PILOT').toUpperCase()) + "'S RUN" : 'SKITTLES MODE'}</h3>${recap.guest ? '<p class="note" style="color:#ffd34d">You are a reviewer here: your verdicts are sent as reviewer labels for this pilot\'s flight. Nothing changes in their run or in your own learning.</p>' : ''}
    <p class="note">${recap.events.length} calls${recap.flags.length ? `, ${recap.flags.length} added / missed` : ''} · ${done} decided, ${Math.max(0, recapItems().length - done)} not yet. In the order they happened; flagged and unsure calls are marked. Only tricks you have decided on (✓, a correction, or a named trick you added) are learned from: anything left undecided is ignored.</p>
    ${recap.multi && recap.multi.size >= 2 ? `<div class="row rvMulti"><b>${recap.multi.size} picked</b><button data-rc="group" class="primary" title="These tricks were one combo">Combo</button><button data-rc="remove" title="Delete the picked tricks from the timeline">🗑 Delete</button><button data-rc="unpick" class="ghost">clear</button></div>` : '<p class="note">Click a trick to pick it; Ctrl-click or Shift-click to pick several, then press Combo to say they were one combo.</p>'}
    ${items.slice().sort((a, b) => recapSpanOf(a)[0] - recapSpanOf(b)[0]).map(it => { const on = recap.play && recap.play.key === it.kind + it.i, pk = recap.multi && recap.multi.has(it.kind + it.i) ? 'pick' : '', gid = recapObj(it).grp, gr = gid != null ? 'grp' : '', gTag = gid != null ? `<span class="grpTag" title="Part of combo ${gid}">combo ${gid} <button data-rc="ungroup" data-k="${it.kind}" data-i="${it.i}" title="Take it out of the combo">✕</button></span>` : '', thenB = `<button data-rc="thenrow" data-k="${it.kind}" data-i="${it.i}" title="Add the next trick of this combo, starting where this one ends">＋ then</button>`; if (it.kind === 'miss') { const f = it.f;
        return `<div class="rvItem pilot ${on ? 'on' : ''} ${pk} ${gr}" data-rvkey="${it.kind + it.i}"><span class="t">${fmtT(recapSpanOf(it)[0] - T0)}</span>${gTag}<b>${f.added ? 'You added a trick' : 'You flagged a missed trick'}</b><div class="row"><button data-rc="go" data-k="miss" data-i="${it.i}">▶</button><select data-rcmiss="${it.i}"><option value="">what was it?</option>${names.map(n => `<option ${f.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select><button data-rc="delmiss" data-i="${it.i}">✕</button></div>
          <div class="row">${thenB}<span class="rcExec" title="How was it flown?">${[['CLEAN', 'clean'], ['SLOPPY', 'sloppy'], ['BUMP', 'bump']].map(([x, l]) => `<button data-rc="execm" data-i="${it.i}" data-x="${x}" class="${f.execActual === x ? 'on' : ''}">${l}</button>`).join('')}</span></div></div>`; }
      const e = it.e, cls = e.verdict === 'yes' ? 'ok' : e.verdict === 'no' ? 'bad' : '', unsure = e.conf != null && e.conf < 0.7;
      return `<div class="rvItem ${cls} ${on ? 'on' : ''} ${pk} ${gr}" data-rvkey="${it.kind + it.i}"><span class="t">${fmtT(recapSpanOf(it)[0] - T0)}</span>${gTag}<b>${esc(e.name)}</b> <small>${e.exec}${e.obstacle ? ' · ' + e.obstacle : ''}${e.flag ? ' · <span style="color:#ff8b7d">you flagged this</span>' : e.maybe ? ' · <span style="color:#7fd0f2">maybe: the trick library\'s guess, not scored</span>' : unsure ? ' · <span style="color:#ffd34d">the game wasn\'t sure</span>' : ''}</small>
        <div class="row"><button data-rc="yes" data-i="${it.i}" title="It was this trick">✓</button><button data-rc="go" data-k="call" data-i="${it.i}" title="Play it">▶</button>${recapCallSelect(it.i, e, names)}${recapExecBtns(it.i, e)}${thenB}</div></div>`; }).join('')}
    <div class="row"><button data-rc="allyes" class="ghost" title="Mark every call you haven't judged as correct">✓ The rest were right</button>${recapHiddenN() ? `<button data-rc="restore" class="ghost" title="Put every deleted trick back on the timeline">↩ Bring back deleted (${recapHiddenN()})</button>` : ''}</div>
    <div class="row"><button data-rc="export" class="ghost">Export</button>${recap.guest ? '<button data-rc="upload" class="ghost" title="Send your verdicts on this run to the project">↑ Upload</button>' : ghMenus() ? '<button data-rc="upload" class="ghost">↑ Upload</button>' : ''}<button data-rc="close" class="primary">Done</button></div>
    <p class="note" id="recapMsg">${recap.guest ? 'Your verdicts on this run go to the project when you press ↑ Upload or Done.' : ghMenus() ? (gh.enabled && gh.token ? 'Labels upload when you press Done.' : 'Uploads are off (Options) — labels are kept in this browser; Export saves a file.') : (tel.on ? 'Your answers are shared with the project along with the flight when you press Done.' : 'Your answers are kept in this browser; Export saves a file. Turn on sharing in Options to send them.')}</p>
    <p class="note"><kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> 1 s · <kbd>,</kbd><kbd>.</kbd> frame · <kbd>[</kbd><kbd>]</kbd> trick · <kbd>A</kbd> add at the red line · <kbd>T</kbd> then… (combo) · <kbd>+</kbd><kbd>−</kbd> zoom · <kbd>Del</kbd> remove · <kbd>L</kbd> loop · <kbd>C</kbd> camera · <kbd>S</kbd> split into clips · <kbd>I</kbd><kbd>O</kbd> trim clip</p>`;
  renderRecapBar();
  { const on = el.querySelector('.rvItem.on'), k = recap.play && recap.play.key; if (on && recap.listKey !== k) { recap.listKey = k; on.scrollIntoView({ block: 'nearest' }); } }   // the picked trick stays in sight
}
function recapPayload() {
  let labels = [];
  // repStart..t is where the trick really was (the pilot's block when they moved or stretched it); gameSpan is where the
  // game had it. `timed: true` marks spans a pilot set by hand: the most exact labels there are.
  // Only what the pilot has DECIDED is a label. A call they moved, graded, grouped or added to but never said yes or no
  // to goes out marked `undone` (verdict "unlabelled"): kept for the record, never learned from, never scored.
  for (const e of recap.events) if (e.verdict || e.span || e.execActual || e.grp != null || (e.extra && e.extra.length)) { const sp = e.span || [e.t0, e.t], decided = e.verdict === 'yes' || (e.verdict === 'no' && !!e.actual); const v = decided ? recapVariant(e.verdict === 'no' ? e.actual : e.name) : { actual: null }; labels.push({ target: e.name, ...v, verdict: !decided ? 'unlabelled' : e.verdict === 'no' && v.actual === e.name ? 'yes' : e.verdict, undone: decided ? undefined : true, repStart: sp[0], t: sp[1], gameSpan: [e.t0, e.t], timed: !!e.span, detected: e.maybe ? [] : [e.name], maybe: e.maybe || undefined, conf: e.conf, flagged: !!e.flag, exec: e.exec, clean: e.clean, execActual: e.execActual || null, via: 'review' }); }
  for (const f of recap.flags) { if (f.hidden) continue; const timed = f.t0 != null, a = timed ? f.t0 : +(f.t - 5).toFixed(3);
    if (f.actual) labels.push({ target: recapVariant(f.actual).actual, verdict: 'yes', ...recapVariant(f.actual), repStart: a, t: timed ? f.t : +(f.t + 0.5).toFixed(3), timed, detected: [], execActual: f.execActual || null, via: f.added ? 'review-added' : 'flag-missed' });
    else labels.push({ target: 'unknown', verdict: 'unlabelled', actual: null, repStart: a, t: f.t, detected: [], via: f.added ? 'review-added' : 'flag-missed', undone: true }); }
  // tiles: the tricks that follow the first one inside the same block, in order, over the same stretch
  { const add = (base, extra, via) => extra.forEach((nm, k) => { const v = recapVariant(nm); labels.push({ target: v.actual, verdict: 'yes', ...v, repStart: base.repStart, t: base.t, timed: base.timed, detected: [], via, tile: base.tile, order: k + 2, of: extra.length + 1 }); });
    let tid = 0; const firsts = labels.slice();
    for (const e of recap.events) if (e.extra && e.extra.length) { const sp = e.span || [e.t0, e.t], b = firsts.find(l => l.via === 'review' && l.repStart === sp[0] && l.t === sp[1] && l.target === e.name); if (b) { b.tile = ++tid; b.order = 1; b.of = e.extra.length + 1; add(b, e.extra, 'review-added'); } }
    for (const f of recap.flags) if (!f.hidden && f.actual && f.extra && f.extra.length) { const b = firsts.find(l => l.via !== 'review' && l.t === (f.t0 != null ? f.t : +(f.t + 0.5).toFixed(3)) && l.actual === recapVariant(f.actual).actual && !l.tile); if (b) { b.tile = ++tid; b.order = 1; b.of = f.extra.length + 1; add(b, f.extra, b.via); } } }
  // combos grouped by hand in the list
  { const G = {}, gOf = new Map(); for (const e of recap.events) if (e.grp != null) gOf.set(`r|${(e.span || [e.t0, e.t])[0]}|${e.name}`, e.grp); for (const f of recap.flags) if (!f.hidden && f.grp != null && f.actual) gOf.set(`a|${f.t0 != null ? f.t0 : +(f.t - 5).toFixed(3)}|${recapVariant(f.actual).actual}`, f.grp);
    for (const l of labels) { const g = gOf.get(`${l.via === 'review' ? 'r' : 'a'}|${l.repStart}|${l.via === 'review' ? l.target : l.actual}`); if (g != null && (l.order == null || l.order === 1)) { l.group = g; G[g] = (G[g] || 0) + 1; } }
    for (const l of labels) if (l.group != null) l.groupLen = G[l.group]; }
  // combos as the pilot laid them out: real tricks that follow each other within the combo window share a combo number
  labels.sort((x, y) => x.repStart - y.repStart); { let c = 0, end = -1e9; for (const l of labels) { if (!l.actual || l.actual === 'not a trick') continue; if (l.repStart - end > COMBO_IDLE) c++; l.combo = c; end = Math.max(end, l.t); }
    const n = {}; for (const l of labels) if (l.combo) n[l.combo] = (n[l.combo] || 0) + 1; for (const l of labels) if (l.combo) { l.comboLen = n[l.combo]; } }
  return { format: 'pro-whooper-session/2', source: 'review', build: '0.1', map: MAP_ID, camTilt: tune.camTilt, craft: { ...spec }, tune, pilot: store.get('pilot', null),
    run: { id: recap.id, started: recap.started, hz: TRACE_HZ, cols: TRACE_COLS, trace: recap.trace, events: recap.events.map(e => ({ t: e.t, name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, conf: e.conf })), labels } };
}
function recapSave(force) {
  if (recap.guest) { if (recap.dirty || force) reviewerSave(); return; }   // someone else's run: nothing is kept as yours; your verdicts go out as reviewer labels
  if (!recap.dirty && !force) return; const pl = recapPayload(); if (!pl.run.labels.length) return; recap.dirty = false;
  try { idb.put('runs', { id: 'review-' + recap.id, started: recap.started, review: true, map: MAP_ID, camTilt: tune.camTilt, labels: pl.run.labels, events: pl.run.events, hz: TRACE_HZ, cols: TRACE_COLS, trace: recap.trace, craft: { ...spec }, tune }); } catch {}
  const jobs = [];
  ghEnqueue(`calibration/review/${recap.started.replace(/[:.]/g, '-')}-${recap.id}.json`, pl, `run review: ${pl.run.labels.length} labels`);
  // with flight telemetry on, the labels follow the flight to the drop-off (the flight itself carries the trace)
  if (tel.on) { jobs.push(telCapture('review')); jobs.push(telQueue('labels', telStamp(recap), { format: 'pro-whooper-flight-labels/1', build: '0.1', flight: recap.id, started: recap.started, pilot: telPilot(), name: pilotName() || null, labels: pl.run.labels })); }
  learnQueue({ id: recap.id, started: recap.started, map: MAP_ID, camTilt: tune.camTilt, labels: pl.run.labels, trace: recap.trace, jobs: jobs.filter(Boolean), shared: tel.on });
}
// ---- Learning from reviews (Sim.learnFromLabels). When a review is saved, the game re-flies the labelled stretches of
// this run and of the last few reviewed runs on this map (trace = attitude, position for the over/under passes, sticks)
// with slightly looser settings, and keeps a loosening only when it finds more of the pilot's own tricks without
// bringing back a call they rejected. It only ever loosens, within hard caps, and Options can forget it. Runs in the
// background a moment after the review closes; nothing leaves the browser for it.
const learn = { busy: false, pending: null, last: store.get('learnReport', null) };
function learnQueue(run) { learn.pending = run; clearTimeout(learn.timer); learn.timer = setTimeout(learnRun, 120); }
async function learnRun() {
  if (learn.busy || !learn.pending) return; if (mode === 'fly' || mode === 'recap') { learn.timer = setTimeout(learnRun, 4000); return; }   // never while flying
  const cur = learn.pending; learn.pending = null; learn.busy = true; let said = '';
  procShow(cur.shared ? 'Saving your review for the project…' : 'Learning from your review…', cur.shared ? 'Sending your labels' : 'Re-flying the tricks you labelled', 0.05);
  try {
    if (cur.jobs && cur.jobs.length) { procCreep(0.3, 2500); await procWait(Promise.all(cur.jobs), 8000); }
    procShow('Learning from your review…', 'Re-flying the tricks you labelled', 0.32); let ticks = 0;
    const stored = (await idb.all('runs')).filter(r => r && r.review && r.map === MAP_ID && Array.isArray(r.labels) && Array.isArray(r.trace) && r.trace.length > 100 && r.id !== 'review-' + cur.id)
      .sort((a, b) => String(b.started).localeCompare(String(a.started))).slice(0, 5);
    const runs = [cur, ...stored].map(r => ({ rows: r.trace, world, camTilt: r.camTilt ?? tune.camTilt, labels: r.labels }));
    const res = await S.learnFromLabels(runs, store.get('pilot', null), { tick: () => { ticks++; const f = 0.32 + 0.63 * (1 - Math.exp(-ticks / 9)); proc.frac = f; const b = document.querySelector('#procModal .procBar i'); if (b) b.style.width = Math.round(f * 100) + '%'; return new Promise(r => setTimeout(r, 15)); } });
    const rep = { ...res.report, at: new Date().toISOString(), runs: runs.length }; learn.last = rep; store.set('learnReport', rep);
    if (res.changed) { const old = store.get('pilot', null) || {}; res.profile.learn.at = rep.at; res.profile.learn.orig = (old.learn && old.learn.orig) || { rate: old.rate || null, air: old.air ?? null };   // so Forget can put the pace back
      store.set('pilot', res.profile); applyPilot();
      said = `The game learned from your review: ${rep.after - rep.before} more of your tricks are now recognised (${[...new Set(rep.changes)].join(', ')}).`; }
    else if (rep.labels) said = rep.before === rep.labels ? 'The game already recognises every trick you labelled.' : `Recognised ${rep.after} of the ${rep.labels} tricks you labelled. The rest are kept for the next round of detection work.`;
  } catch (err) { learn.err = String(err && err.stack || err).slice(0, 300); /* learning is a bonus: never in the way */ }
  procShow(cur.shared ? procThanks() : 'Review saved', (said ? said + ' ' : '') + (cur.shared ? 'Your labels go to the Open Pro Whooper Project with the flight: they are the most valuable data there is.' : ''), 1);
  await new Promise(r => setTimeout(r, said ? 2600 : 1500)); procHide();
  learn.busy = false; if (learn.pending) learnQueue(learn.pending);
}
function learnHtml() {
  const p = store.get('pilot', null), L = p && p.learn, r = learn.last, any = L && (L.tol || L.rev || L.crossBack || L.at);
  const bits = !L ? [] : [L.tol ? `angles ±${L.tol}° looser` : '', L.rev ? 'short-reading rolls and flips count sooner' : '', L.crossBack ? `over/under passes count up to ${L.crossBack} s longer` : ''].filter(Boolean);
  return `<h3>What the game learned from your reviews</h3>
    <p class="note">${any ? `Tuned to you${bits.length ? ': ' + bits.join(' · ') : ''}${p.rate ? ` · rotation pace roll ${p.rate.R || '—'}, flip ${p.rate.P || '—'}, yaw ${p.rate.Y || '—'} °/s` : ''}.` : 'Nothing yet. Review a run and correct or add tricks: the game re-flies those moments and loosens itself to match how you fly (never tighter, and never against one of your labels).'}
    ${r ? ` Last review: ${r.before} of ${r.labels} labelled tricks recognised before, ${r.after} after${r.still && r.still.length ? ` (still missing: ${esc([...new Set(r.still)].slice(0, 6).join(', '))})` : ''}.` : ''}</p>
    ${any ? '<div class="row"><button data-learn="forget" class="ghost">Forget what was learned</button></div>' : ''}`
    + communityHtml();
}
// the community layer every game starts from (tools/community.js, from all pilots' flights and labels)
function communityHtml() {
  const c = Sim.community; if (!c) return '';
  const st = c.stats || {}, L = c.learn || {}, fl = Object.entries(c.floor || {});
  const bits = [L.tol ? `angles ±${L.tol}° looser` : '', L.rev ? 'short-reading rolls and flips count sooner' : '', L.crossBack ? `over/under passes count up to ${L.crossBack} s longer` : '', c.rate ? 'slower rotations count' : '', c.air ? 'more air between segments' : '', ...fl.map(([k, v]) => `${esc(k)} needs ${Math.round(v * 100)}% confidence`)].filter(Boolean);
  const f = Array.isArray(st.found) ? st.found : null;
  return `<h3>What every pilot's flying taught the game</h3><p class="note">${bits.length ? bits.join(' · ') + '.' : 'No changes yet: rules change once several pilots agree.'}
    ${st.flights ? ` From ${st.flights} shared flights by ${st.pilots} pilot${st.pilots === 1 ? '' : 's'} (${st.labellers || 0} labelling)${f ? `; labelled tricks found ${Math.round(f[0] * 100)}% → ${Math.round(f[1] * 100)}%` : ''}${c.updated ? `, updated ${esc(c.updated)}` : ''}.` : ''}
    Your own tuning above sits on top of this. Share your flights and review them to add to it.</p>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-learn]'); if (!b) return; const p = store.get('pilot', null); if (p) { const o = p.learn && p.learn.orig; if (o) { if (o.rate) p.rate = o.rate; else delete p.rate; if (o.air != null) p.air = o.air; else delete p.air; } delete p.learn; store.set('pilot', Object.keys(p).length ? p : null); applyPilot(); } store.set('learnReport', null); learn.last = null; const box = $('#learnBox'); if (box) box.innerHTML = learnHtml(); flashNote('Forgotten: detection is back to the standard settings (your Warm-up pace is kept).'); });
window.__pw.learn = { get state() { return learn; }, run: () => learnRun(), queue: r => learnQueue(r), pilot: () => store.get('pilot', null), html: () => learnHtml() };

// ---- clip export: play the clip once and record what the game draws (with the trick call-outs, the sticks and a
// small credit) through the browser's own video recorder. Recorded at the chosen speed, so slow motion stays slow.
function recapRecStart() {
  const p = recap.play, msg = t => { const m = $('#rcRecMsg'); if (m) m.textContent = t; }; if (!p) return;
  const sel = recapSel(), c = recap.clip || (p.loop ? { a: p.loop.a, b: p.loop.b } : null);
  if (!c) { msg('Pick a clip on the bottom strip (Split cuts the run), or pick a trick.'); return; }
  if ((c.b - c.a) / p.speed > 90) { msg('That would be over 90 seconds of video: shorten the clip or speed it up.'); return; }
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) { msg('This browser cannot record video here.'); return; }
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const ctx = cv.getContext('2d');
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { msg('This browser cannot record video here.'); return; }
  let recorder; try { recorder = new MediaRecorder(cv.captureStream(60), { mimeType: mime, videoBitsPerSecond: 10e6 }); } catch { msg('This browser cannot record video here.'); return; }
  const chunks = [], R = recap.rec = { cv, ctx, recorder, a: c.a, b: c.b, cancelled: false, was: { looping: p.looping, loop: p.loop } };
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => { recap.rec = null; p.looping = R.was.looping; p.loop = R.was.loop; renderRecapBar(); if (R.cancelled) { msg('Recording cancelled.'); return; }
    const blob = new Blob(chunks, { type: mime.split(';')[0] }), ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm', name = `pro-whooper-${slug(!recap.clip && sel && sel.kind === 'call' ? sel.e.name : 'clip')}-${recap.id}.${ext}`;
    recap.lastClip = { size: blob.size, type: blob.type, name };
    let ok = false; if (window.claude && window.claude.use) ok = (await saveFile(name, blob)) === true; else { try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); ok = true; } catch {} }
    msg(ok ? `Saved ${name} (${(blob.size / 1e6).toFixed(1)} MB)` : 'Could not save the video here.'); };
  p.t = c.a; p.playing = true; recorder.start(250); renderRecapBar(); recapBarState();
  const b = document.querySelector('#recapBar [data-rc="exportclip"]'); if (b) b.textContent = '■ Stop';
}
function recapRecStop(cancel) { const R = recap.rec; if (!R) return; R.cancelled = !!cancel; try { if (R.recorder.state !== 'inactive') setTimeout(() => { try { R.recorder.stop(); } catch {} }, cancel ? 0 : 250); } catch { recap.rec = null; } }
// called right after the 3D view is drawn, while its picture can still be copied
function recapRecFrame() {
  const R = recap.rec, p = recap.play; if (!R || !p) return; const { cv, ctx } = R, src = renderer.domElement, W = cv.width, H = cv.height;
  const s = Math.max(W / src.width, H / src.height), dw = src.width * s, dh = src.height * s; ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const now = recap.events.filter(e => p.t >= e.t - 0.15 && p.t <= e.t + 1.4 && !(e.verdict === 'no' && e.actual === 'not a trick'));
  ctx.textBaseline = 'top'; ctx.lineJoin = 'round'; let y = 28;
  for (const e of now) { const name = e.verdict === 'no' && e.actual ? e.actual : e.name; ctx.font = "44px 'Bungee', Impact, sans-serif"; ctx.lineWidth = 8; ctx.strokeStyle = '#111'; ctx.strokeText(name, 36, y); ctx.fillStyle = '#fff'; ctx.fillText(name, 36, y); y += 56; }
  const st = $('#recapSticks'); if (st && st.width) ctx.drawImage(st, 28, H - 28 - 110, 238, 110);
  ctx.font = "600 18px system-ui, sans-serif"; ctx.textAlign = 'right'; ctx.lineWidth = 4; ctx.strokeStyle = '#000a'; const tag = `Open Pro Whooper${pilotName() ? ' · ' + pilotName() : ''}${p.speed !== 1 ? ' · ' + p.speed + '×' : ''}`; ctx.strokeText(tag, W - 24, H - 40); ctx.fillStyle = '#fff'; ctx.fillText(tag, W - 24, H - 40); ctx.textAlign = 'left';
}
function recapJump(dir) { const p = recap.play; if (!p) return; const L = recapItems().slice().sort((a, b) => a.t - b.t); const it = dir > 0 ? L.find(x => x.t > p.t + 0.05 && x.kind + x.i !== p.key) : L.slice().reverse().find(x => x.t < p.t - 0.3 && x.kind + x.i !== p.key); if (it) recapPlay(it); }
document.addEventListener('click', e => {
  const m = e.target.closest('[data-rcm]'); if (m && mode === 'recap') { if (recap.dragged) { recap.dragged = false; return; } const i = +m.dataset.i; recapPlay(m.dataset.rcm === 'miss' ? { kind: 'miss', i, t: recap.flags[i].t, f: recap.flags[i] } : { kind: 'call', i, t: recap.events[i].t, e: recap.events[i] }); renderRecap(); return; }
  if (mode === 'recap' && !e.target.closest('[data-rc], [data-rcm], [data-rcclip], select, input, button, label, #rcTrack, #fbModal, #procModal, .fbTab')) {
    const row = e.target.closest('.rvItem[data-rvkey]');
    if (row) { recapPick(row.dataset.rvkey, e); if (!(e.shiftKey || e.ctrlKey || e.metaKey)) { const it = recapItems().find(x => recapKey(x) === row.dataset.rvkey); if (it && recap.play && recap.play.key !== row.dataset.rvkey) recapPlay(it); } renderRecap(); return; }
    if (recapDeselect()) renderRecap(); return; }   // empty space: let go of whatever was picked
  const b = e.target.closest('[data-rc]'); if (b && mode === 'recap') { const a = b.dataset.rc, i = +b.dataset.i, p = recap.play;
    if (a === 'group') { recapGroup(); recap.multi.clear(); } if (a === 'unpick') recap.multi.clear();
    if (a === 'ungroup' || a === 'thenrow') { const it = recapItems().find(x => x.kind === b.dataset.k && x.i === i); if (a === 'ungroup') recapUngroup(it); else recapAddAfter(it); }
    if (a === 'go') recapPlay(b.dataset.k === 'miss' ? { kind: 'miss', i, t: recap.flags[i].t, f: recap.flags[i] } : { kind: 'call', i, t: recap.events[i].t, e: recap.events[i] });
    if (a === 'yes') { const ev = recap.events[i]; recapSetCall(i, ev.name); renderRecap(); recapAutoScroll('call' + i); return; }
    if (a === 'exec') { const ev = recap.events[i]; ev.execActual = ev.execActual === b.dataset.x ? null : b.dataset.x; recap.dirty = true; }
    if (a === 'execm') { const f = recap.flags[i]; if (f) { f.execActual = f.execActual === b.dataset.x ? null : b.dataset.x; recap.dirty = true; } }
    if (a === 'delmiss') { recapRemove({ kind: 'miss', i, f: recap.flags[i] }); }
    if (a === 'allyes') { for (const ev of recap.events) if (!ev.verdict) ev.verdict = 'yes'; recap.dirty = true; }
    if (a === 'export') saveFile(`run-review-${recap.id}.json`, JSON.stringify(recapPayload()));
    if (a === 'upload' && recap.guest) { reviewerSave(); return; }
    if (a === 'upload') { recapSave(true); if (!(gh.enabled && gh.token)) { closeRecap(); openOptions(); return; } }
    if (a === 'close') { closeRecap(); return; }
    if (p) {
      if (a === 'toggle') { if (!p.playing && p.t >= recapSpan()[1] - 0.02) p.t = recapSpan()[0]; p.playing = !p.playing; recapBarState(); return; }
      if (a === 'back' || a === 'fwd') { recapSeek(p.t + (a === 'fwd' ? 1 : -1)); if (p.left) { p.left = false; p.playing = true; recapBarState(); renderRecapBar(); } return; }
      if (a === 'fb' || a === 'ff') { p.playing = false; p.left = false; recapSeek(p.t + (a === 'ff' ? 1 : -1) / TRACE_HZ * 2); recapBarState(); return; }
      if (a === 'prev' || a === 'next') recapJump(a === 'next' ? 1 : -1);
      if (a === 'loop') { p.looping = !p.looping; recapBarState(); renderRecapBar(); return; }
      if (a === 'cam') { recap.cam = recap.cam === 'fpv' ? 'chase' : 'fpv'; return; }
      if (recap.rec && a !== 'exportclip') return;                       // hands off while a clip is recording
      if (a === 'split') { if (!recapClipSplit(p.t)) { renderRecap(); const m = $('#rcRecMsg'); if (m) m.textContent = 'Move the red line into a clip, a little away from its ends.'; return; } }
      if (a === 'in' || a === 'out') { if (recap.clipSel == null) recapClipPick(recapClipAt(p.t) < 0 ? null : recapClipAt(p.t)); const i = recap.clipSel, c = recap.clip; if (c) { if (a === 'in') recapClipTrim(i, p.t, c.b); else recapClipTrim(i, c.a, p.t); } }
      if (a === 'clipdel') recapClipDelete(recap.clipSel);
      if (a === 'clipclear') recapClipsReset();
      if (a === 'exportclip') { if (recap.rec) recapRecStop(true); else recapRecStart(); }
      if (a === 'add') recapAddAt(p.t);
      if (a === 'then') recapAddAfter(recapSel());
      if (a === 'unspan') { const it = recapSel(); if (it && it.kind === 'call') { delete it.e.span; recap.dirty = true; } }
      if (a === 'zin' || a === 'zout') { recapZoom(a === 'zin' ? 1 : -1); return; }
      if (a === 'remove') { const M = recap.multi; if (M && M.size > 1) { for (const it of recapItems().filter(x => M.has(recapKey(x)))) recapRemove(it); } else recapRemove(recapSel()); }
      if (a === 'restore') recapRestoreAll();
      if (a === 'tiledel') recapTileDel(recapSel(), +b.dataset.k);
      if (a === 'newtrick') { const inp = b.parentElement.querySelector('[data-rcnew]'), nm = recapAddCustom(inp && inp.value), it = recapSel(); if (nm && it) { if (it.kind === 'call') recapSetCall(it.i, nm); else { it.f.actual = nm; recap.dirty = true; } } }
    }
    renderRecap(); return; }
  const act = e.target.closest('[data-act]'); if (act && act.dataset.act === 'recap') openRecap(mode === 'paused' && !$('#resultsScreen').classList.contains('hide') ? 'results' : 'pause');
  if (act && act.dataset.act === 'warmup') startWarmup();
});
// scrubbing: press or drag on the timeline (not on a trick mark)
let recapDrag = false;
const recapScrub = e => { const tr = $('#rcTrack'); if (!tr) return; const r = tr.getBoundingClientRect(), [T0, T1] = recapView(); recapSeek(T0 + Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (T1 - T0)); };
addEventListener('pointerdown', e => { const m = e.target.closest('[data-rcclip]'); if (mode !== 'recap' || !m || recap.rec) return; const i = +m.dataset.rcclip, c = recap.clips[i]; if (!c) return; e.preventDefault();
  if (!e.target.classList.contains('rcH')) { recapClipPick(recap.clipSel === i ? null : i); if (recap.clip && recap.play && (recap.play.t < c.a || recap.play.t > c.b)) recapSeek(c.a); renderRecap(); return; }
  const [V0, V1] = recapView(); recap.drag = { clip: i, part: e.target.classList.contains('l') ? 'l' : 'r', x0: e.clientX, a: c.a, b: c.b, el: m, spp: (V1 - V0) / Math.max(1, $('#rcTrack').getBoundingClientRect().width), moved: false }; });
// moving and stretching a trick on the timeline: press on the block (move) or on one of its ends (stretch)
addEventListener('pointerdown', e => { const m = e.target.closest('[data-rcm]'); if (mode !== 'recap' || !m || !recap.review || recap.rec) return; const i = +m.dataset.i, it = m.dataset.rcm === 'miss' ? { kind: 'miss', i, f: recap.flags[i] } : { kind: 'call', i, e: recap.events[i] }; if (!(it.f || it.e)) return;
  const part = e.target.classList.contains('rcH') ? (e.target.classList.contains('l') ? 'l' : 'r') : 'move', sp = recapSpanOf(it), [V0, V1] = recapView();
  recap.drag = { it, part, x0: e.clientX, a: sp[0], b: sp[1], el: m, spp: (V1 - V0) / Math.max(1, $('#rcTrack').getBoundingClientRect().width), moved: false }; e.preventDefault(); });
addEventListener('pointermove', e => { const D = recap.drag; if (!D) return; const dx = e.clientX - D.x0; if (!D.moved && Math.abs(dx) < 4) return; D.moved = true; const dt = dx * D.spp;
  if (D.clip != null) { if (D.part === 'l') recapClipTrim(D.clip, D.a + dt, D.b); else recapClipTrim(D.clip, D.a, D.b + dt); const c = recap.clips[D.clip], [V0, V1] = recapView(), W = Math.max(0.01, V1 - V0); D.el.style.left = ((c.a - V0) / W * 100) + '%'; D.el.style.width = Math.max(0.5, (c.b - c.a) / W * 100) + '%';
    if (recap.play) { recap.play.playing = false; recap.play.loop = null; recap.play.t = D.part === 'r' ? c.b : c.a; } return; }
  if (D.part === 'move') recapSetSpan(D.it, D.a + dt, D.a + dt + (D.b - D.a)); else if (D.part === 'l') recapSetSpan(D.it, Math.min(D.a + dt, D.b - 0.1), D.b); else recapSetSpan(D.it, D.a, Math.max(D.b + dt, D.a + 0.1));
  const sp = recapSpanOf(D.it), [V0, V1] = recapView(), W = Math.max(0.01, V1 - V0); D.el.style.left = ((sp[0] - V0) / W * 100) + '%'; D.el.style.width = Math.max(0.5, (sp[1] - sp[0]) / W * 100) + '%';
  if (recap.play) { recap.play.playing = false; recap.play.loop = null; recap.play.t = D.part === 'r' ? sp[1] : sp[0]; } });   // the picture follows the edge being moved: line the trick up by eye
addEventListener('pointerup', () => { const D = recap.drag; if (!D) return; recap.drag = null; if (D.clip != null) { renderRecap(); return; } if (D.moved) { recap.dragged = true; setTimeout(() => { recap.dragged = false; }, 50); if (recap.play) recap.play.key = D.it.kind + D.it.i; renderRecap(); } });
addEventListener('wheel', e => { if (mode !== 'recap' || !e.target.closest('#rcTrack')) return; e.preventDefault(); recapZoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
addEventListener('pointerdown', e => { if (mode !== 'recap' || !e.target.closest('#rcTrack') || e.target.closest('[data-rcm]') || e.target.closest('[data-rcclip]')) return; recapDrag = true; if (recap.play) recap.play.left = false; recapScrub(e); e.preventDefault(); });
addEventListener('pointermove', e => { if (recapDrag) recapScrub(e); });
addEventListener('pointerup', () => { if (recapDrag && recap.play && recap.play.left) { recap.play.left = false; recap.play.playing = true; recapBarState(); renderRecapBar(); } recapDrag = false; });
document.addEventListener('change', e => {
  if (mode !== 'recap') return;
  if (e.target.id === 'rcReview') { recap.review = e.target.checked; store.set('recapReview', recap.review); renderRecap(); return; }
  if (e.target.id === 'rcSpeed') { if (recap.play) recap.play.speed = +e.target.value; e.target.blur(); return; }
  if (e.target.dataset.rctile !== undefined) { recapTileAdd(recapSel(), e.target.value); renderRecap(); return; }
  if (e.target.dataset.rcfix !== undefined) { recapSetCall(+e.target.dataset.rcfix, e.target.value); renderRecap(); recapAutoScroll('call' + e.target.dataset.rcfix); }
  if (e.target.dataset.rcmiss !== undefined) { recap.flags[+e.target.dataset.rcmiss].actual = e.target.value || null; recap.dirty = true; renderRecap(); }
});
addEventListener('keydown', e => {
  if (mode !== 'recap' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (recap.quick) { const k = { KeyY: 'yes', KeyK: 'skip', KeyB: 'back', Enter: 'next' }[e.code]; if (k) { const b = document.querySelector(`#recapSide [data-qk="${k}"]`); if (b) { e.preventDefault(); b.click(); } return; }
    if (e.code === 'KeyN') { const s = $('#recapSide [data-qkfix]'); if (s) { e.preventDefault(); s.focus(); } return; } if (e.code === 'Escape') { closeRecap(); return; } if (e.code !== 'Space' && e.code !== 'KeyC') return; }
  const p = recap.play, click = a => { const b = document.querySelector(`#recapBar [data-rc="${a}"]`); if (b) b.click(); };
  const map = { KeyS: 'split', KeyT: 'then', Equal: 'zin', Minus: 'zout', Space: 'toggle', ArrowLeft: 'back', ArrowRight: 'fwd', Comma: 'fb', Period: 'ff', BracketLeft: 'prev', BracketRight: 'next', KeyL: 'loop', KeyC: 'cam', KeyA: 'add', Delete: 'remove', Backspace: 'remove', KeyI: 'in', KeyO: 'out' };
  if ((e.code === 'Delete' || e.code === 'Backspace') && recap.multi && recap.multi.size > 1) { e.preventDefault(); for (const it of recapItems().filter(x => recap.multi.has(recapKey(x)))) recapRemove(it); renderRecap(); return; }
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
  { const old = store.get('pilot', null); if (old && old.learn) p.learn = old.learn; }   // what the reviews taught stays
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
window.__pw.recap = { get state() { return recap; }, open: f => openRecap(f), flag: k => recapFlag(k), payload: () => recapPayload(), close: () => closeRecap() };
window.__pw.warm = { start: () => startWarmup(), get state() { return warm; }, tick: () => warmTick(), pilot: () => store.get('pilot', null) };

// ============================================================ Feedback button (on every screen)
// A small tab that is always there. Pick a category, write a comment; the game adds where you were and your setup (never
// the GitHub token). It uploads to feedback/ in the repo when uploads are on; otherwise save it as a file, copy it, or
// open a GitHub issue with it filled in.
const FB_CATS = ['Flight feel / physics', 'Trick detection', 'Scoring / combos', 'Video Review', 'Blackbox (Lab / Replay)', 'Controls / radio', 'Map / graphics', 'Menus / UI', 'Bug', 'Idea', 'Other'];
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
    pilot: store.get('pilot', null), input: inputCfg.mode, errors: errLog.length ? errLog.map(e => ({ ...e })) : undefined, lastCalls: recap.events.slice(-6).map(e => ({ name: e.name, exec: e.exec, obstacle: e.obstacle, conf: e.conf, flagged: !!e.flag })) };
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
  if (a === 'issue') { const ctx = p.context || {}; window.open(`https://github.com/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/issues/new?title=${encodeURIComponent(`[${p.category}] ${p.text.slice(0, 60)}`)}&body=${encodeURIComponent(fbText({ ...p, context: p.context ? ctx : null }).slice(0, 5000))}`, '_blank', 'noopener'); msg('Opened GitHub in a new tab (you need a GitHub account to post it).'); }
});
function flashNote(t) { const el = $('#fbToast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }

// ---- Quick check (2026-11-17): after a run, the few calls the game is least sure of, one at a time. The moment loops in
// the main view; the pilot answers Yes, "No, it was…" or Skip. Answers are ordinary decided review labels, so they go
// through recapSave like SKITTLES mode (kept, shared with the flight when sharing is on, and fed to the learner). Picked:
// calls the pilot flagged with F, then the library's maybes, then the lowest Watcher confidence. A daily goal of
// QUICK_GOAL answers is shown on the main menu, the pause menu and the results screen.
const QUICK_N = 3, QUICK_GOAL = 3;
const quickDecided = e => e.verdict === 'yes' || (e.verdict === 'no' && !!e.actual);
const quickToday = () => { const d = new Date().toISOString().slice(0, 10), q = store.get('quickDay', null); return q && q.d === d ? q : { d, n: 0 }; };
function quickBump() { const q = quickToday(); q.n++; store.set('quickDay', q); quickLabels(); }
function quickPick() {
  const c = recap.events.map((e, i) => ({ kind: 'call', i, t: e.t, e })).filter(x => !x.e.hidden && !quickDecided(x.e));
  const pri = x => x.e.flag ? -2 : x.e.maybe ? -1 : x.e.conf != null ? x.e.conf : 0.75;
  return c.sort((a, b) => pri(a) - pri(b) || a.t - b.t).slice(0, QUICK_N);
}
function quickCount() { return recap.guest ? 0 : Math.min(QUICK_N, recap.events.filter(e => !e.hidden && !quickDecided(e)).length); }
function quickLabels() {   // the buttons and the menu line say how many calls are waiting and how today's goal is going
  const q = quickToday(), n = quickCount(), goal = q.n >= QUICK_GOAL ? `today's ${QUICK_GOAL} done ✓` : `today ${q.n}/${QUICK_GOAL}`;
  for (const b of document.querySelectorAll('[data-act="quick"]')) { b.classList.toggle('hide', !n); b.innerHTML = `Quick check<small>${n} call${n === 1 ? '' : 's'} · about 20 s · ${goal}</small>`; }
  const m = $('#quickGoal'); if (m) m.innerHTML = q.n >= QUICK_GOAL ? `Quick checks today: <b>${q.n}</b> ✓ thanks, that helps the trick detection` : `Quick checks today: <b>${q.n} / ${QUICK_GOAL}</b> · after a run, press Quick check and say if the game got it right`;
}
function openQuick(from) {
  if (recap.trace.length < TRACE_HZ) { flash('<b>NOTHING TO CHECK YET</b><small>fly first</small>', 'near'); return; }
  const list = quickPick(); if (!list.length) { flash('<b>NOTHING TO CHECK</b><small>no calls waiting for an answer in this run</small>', 'near'); return; }
  recap.quick = { list: list.map(x => x.i), k: 0, n: 0 }; openRecap(from); recapPlay(list[0]); renderRecap();
}
function quickGo(k) { const Q = recap.quick; if (!Q) return; Q.k = Math.max(0, Math.min(Q.list.length, k)); const i = Q.list[Q.k]; if (i != null) recapPlay({ kind: 'call', i, t: recap.events[i].t, e: recap.events[i] });
  renderRecap(); }
function quickNext() { const Q = recap.quick; if (Q) quickGo(Q.k + 1); }
// Back (owner, 2026-11-19: "go back a step in case you mislabelled a trick, before submitting"): the answer stays changeable
// until the check is closed (Done, Esc, or on to SKITTLES mode); an answer counts once however often it is changed, and the bot
// replicas (which send the verdict with them) are flown only then, with the final answers.
function quickBack() { const Q = recap.quick; if (Q && Q.k > 0) quickGo(Q.k - 1); }
function quickAnswer(i, val) { const Q = recap.quick, e = recap.events[i]; if (!Q || !e || !val) return; recapSetCall(i, val); Q.done = Q.done || {};
  if (quickDecided(e) && !Q.done[i]) { Q.done[i] = true; Q.n++; quickBump(); } renderRecap(); }   // stays on this call (owner, 2026-11-19): add a combo or change the answer, then Next
function quickReplicasGo() { const Q = recap.quick; if (!Q || Q.flown) return; Q.flown = true; for (const i of Object.keys(Q.done || {})) quickReplica(+i); }
function renderQuick() {
  const el = $('#recapSide'), Q = recap.quick, i = Q.list[Q.k], e = recap.events[i], q = quickToday(), names = recapNames();
  const dots = Q.list.map((_, k) => `<i class="${k < Q.k ? 'done' : k === Q.k ? 'on' : ''}"></i>`).join('');
  if (!e) { el.innerHTML = `<div class="qkHead"><b>QUICK CHECK</b><span class="qkDots">${dots}</span></div>
      <p class="qkQ">${Q.n ? `Thanks! ${Q.n} answer${Q.n === 1 ? '' : 's'}: Done saves ${Q.n === 1 ? 'it' : 'them'}, ← Back changes one.` : 'Nothing answered this time.'}</p>${quickReplicaLine()}
      <p class="note">${Q.n ? (tel.on ? 'They go to the project with this flight and teach your game your tricks.' : 'They teach your game your tricks. Turn on sharing in Options to help everyone\'s detection too.') : ''} Today: ${q.n}${q.n >= QUICK_GOAL ? ' ✓' : ' / ' + QUICK_GOAL}.</p>
      <div class="row"><button data-qk="back" class="ghost" title="B: change the last answer">← Back</button><button data-qk="full" class="ghost">Open SKITTLES mode</button><button data-qk="done" class="primary">Done</button></div>`; return; }
  const sure = e.conf != null && !e.maybe ? ` · the game was ${Math.round(e.conf * 100)}% sure` : '';
  const ask = e.flag ? `You flagged <b>${esc(e.name)}</b>. What was it really?` : e.maybe ? `Was that a <b>${esc(e.name)}</b>? <small>(the game's guess)</small>` : `Was that a <b>${esc(e.name)}</b>?`;
  const was = e.verdict === 'yes' ? `✓ yes, a ${esc(e.name)}` : e.verdict === 'no' ? `✗ ${esc(e.actual || 'no')}` : '';
  el.innerHTML = `<div class="qkHead"><b>QUICK CHECK</b> <span class="note">${Q.k + 1} of ${Q.list.length}</span><span class="qkDots">${dots}</span></div>
    <p class="qkQ">${ask}</p>${was ? `<p class="note">Your answer: <b>${was}</b> · change it, add a combo with ＋ then…, or Next to move on</p>` : ''}<p class="note">${e.obstacle ? esc(e.obstacle) : 'open air'}${sure} · it's looping above</p>
    <div class="row">${e.flag ? '' : '<button data-qk="yes" class="primary" title="Y">✓ Yes</button>'}<select data-qkfix="${i}" title="N"><option value="">${e.flag ? 'it was…' : '✗ No, it was…'}</option><option>not a trick</option>${names.filter(n => n !== e.name).map(n => `<option>${esc(n)}</option>`).join('')}</select><button data-qk="skip" class="${was ? 'primary' : 'ghost'}" title="K">${was ? 'Next →' : 'Skip'}</button>${Q.k > 0 ? '<button data-qk="back" class="ghost" title="B: go back and change the last answer">← Back</button>' : ''}</div>
    <div class="row qkCombo"><span class="note">Combo?</span>${(e.extra || []).map((n, k) => `<span class="rcChip">→ ${esc(n)}<button data-qkdel="${k}" title="Take it out of the combo">✕</button></span>`).join('')}<select data-qkadd="${i}" title="It was more than one trick: add the next one (then answer what the first was)"><option value="">＋ then…</option>${names.map(n => `<option>${esc(n)}</option>`).join('')}</select></div>
    <p class="note"><kbd>Y</kbd> yes · <kbd>N</kbd> no, pick what it was · <kbd>K</kbd> skip / next · <kbd>B</kbd> back · <kbd>C</kbd> camera · <kbd>Esc</kbd> stop${(e.extra || []).length ? ' · the combo is saved with your answer' : ' · a combo: add the other tricks with ＋ then…, then answer the first'}</p>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-qk]'); if (b && mode === 'recap' && recap.quick) { const a = b.dataset.qk, i = recap.quick.list[recap.quick.k];
    if (a === 'yes') quickAnswer(i, recap.events[i].name); if (a === 'skip') quickNext(); if (a === 'back') quickBack();
    if (a === 'full') { quickReplicasGo(); recap.quick = null; recap.review = true; store.set('recapReview', true); renderRecap(); } if (a === 'done') closeRecap(); return; }
  const o = e.target.closest('[data-act="quick"]'); if (o) openQuick(mode === 'paused' && !$('#resultsScreen').classList.contains('hide') ? 'results' : mode === 'menu' ? 'menu' : 'pause');
});
document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.qkfix !== undefined && recap.quick) quickAnswer(+e.target.dataset.qkfix, e.target.value);
  if (e.target.dataset && e.target.dataset.qkadd !== undefined && recap.quick && e.target.value) { const i = +e.target.dataset.qkadd; recapTileAdd({ kind: 'call', e: recap.events[i] }, e.target.value); renderRecap(); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-qkdel]'); if (b && recap.quick) { const i = recap.quick.list[recap.quick.k]; recapTileDel({ kind: 'call', e: recap.events[i] }, +b.dataset.qkdel); renderRecap(); } });
setTimeout(quickLabels, 0);

// ---- Bot replicas of checked tricks (Sim.replicaFly): every answered call is re-flown with the real physics from the
// recorded state with the pilot's own recorded sticks, and the detector is run on both. A replica that stays with the
// recording (under 0.5 m and 30 degrees) is "faithful": with sharing on it goes to the project as its own mini bot
// flight (mode 'replica', pilot 'bot') carrying the pilot's verdict, so the trick can be flown again exactly for training
// and validation. tools/evidence.js skips unfaithful replicas and weighs the rest 0.5 (the pilot's own label on the real
// flight already counts 1).
const REPLICA_OK = { pos: 0.5, ang: 30 };
function quickReplica(i) {
  const e = recap.events[i], T = recap.trace; if (!e || recap.guest || T.length < 200 || e.replica) return;
  const from = Math.max(T[0][0] + 0.9, e.t0 - 1.2), to = Math.min(T[T.length - 1][0], e.t + 1.0); let rep;
  try { rep = S.replicaFly(T, { params, tune, world: activeWorld, from, to }); } catch (err) { return; } if (!rep) return;
  const det = rows => { try { return S.replayTrace(rows, { world: activeWorld, camTilt: tune.camTilt, pilot: store.get('pilot', null) }).events.filter(x => x.name !== 'near' && x.name !== 'Crash').map(x => x.name); } catch { return []; } };
  const c0 = det(T.filter(r => r[0] >= from - rep.warm && r[0] <= to)), c1 = det(rep.rows);
  const faithful = rep.drift.pos < REPLICA_OK.pos && rep.drift.ang < REPLICA_OK.ang && !rep.crashed, same = c0.join() === c1.join();
  e.replica = { drift: rep.drift, faithful, same, calls: c1 };
  if (recap.quick && !recap.quick.list[recap.quick.k]) renderRecap();   // the thank-you screen reports the replicas
  if (!tel.on || !faithful) return;   // the pilot's own flight data: shared only when they share flights
  const id = `rep${recap.id}${i}`.slice(0, 40), actual = e.verdict === 'yes' ? e.name : e.actual;
  (async () => { try {
    const trace = await FlightLog.pack(rep.rows, TRACE_COLS, 100), at = new Date().toISOString();
    await telQueue('flight', id, { format: 'pro-whooper-flight/1', build: '0.1', id, started: at, ended: 'replica', pilot: 'bot', name: 'bot', map: MAP_ID, mode: 'replica', camTilt: tune.camTilt, craft: { ...spec }, tune, profile: null, input: null, score: null,
      events: c1.map(name => ({ name })), missed: [], summary: { replica: { of: recap.id, t0: e.t0, t: e.t, from, to, warm: rep.warm, drift: rep.drift, faithful, same, recorded: c0, trick: e.name }, seconds: +(to - from + rep.warm).toFixed(2) } });
    await telQueue('labels', id + '-v', { format: 'pro-whooper-flight-labels/1', build: '0.1', flight: id, started: at, pilot: telPilot(), name: pilotName() || null,
      labels: [{ target: e.name, verdict: e.verdict, actual, repStart: e.t0, t: e.t, detected: c1, via: 'quick-replica', src: 'bot' }] });
  } catch { /* the label on the real flight still stands */ } })();
}
function quickReplicaLine() {
  const r = recap.events.filter(e => e.replica); if (!r.length) return '';
  const f = r.filter(e => e.replica.faithful).length, s = r.filter(e => e.replica.faithful && e.replica.same).length;
  return `<p class="note">The bot re-flew ${r.length === 1 ? 'it' : `all ${r.length}`} with your own stick inputs from the same spot: ${f} stayed with your flight${f ? `, and the game called the same thing on ${s} of ${f}` : ''}.${tel.on && f ? ' Those go to the project as bot runs for training and checking.' : ''}</p>`;
}
