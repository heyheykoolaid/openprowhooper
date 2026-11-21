// ============================================================ Judge the Bot (dev) + ghost preview
// The bot flies scripted tricks from src/maneuvers.js — the same flights test/stress.js runs thousands of times. The
// pilot judges each one before seeing what the detector said, so a verdict checks the flight AND the detector:
// "clean/sloppy" + detector agreed = both fine; "not this trick" = the scripted flight is wrong; a disagreement on a
// flight the pilot passed = a detector problem. Verdicts go to IndexedDB, Export, and (opt-in) GitHub calibration/judge/.
const MV = window.Maneuvers;
const judge = { m: null, name: null, seed: 0, t: 0, speed: 1, phase: 'watch', cam: 'spectator', want: 'random', events: [], session: [], camPos: null, look: null, lookS: null };
let trailLine = null; const trailPts = [];
function trailInit() {
  if (trailLine) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
  trailLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85 })); trailLine.frustumCulled = false; scene.add(trailLine);
}
function trailPush(p) {
  trailInit(); trailPts.push(p.x, p.y, p.z); if (trailPts.length > 400 * 3) trailPts.splice(0, 3);
  const a = trailLine.geometry.attributes.position; a.array.set(trailPts); a.needsUpdate = true; trailLine.geometry.setDrawRange(0, trailPts.length / 3); trailLine.visible = true;
}
function trailClear() { trailPts.length = 0; if (trailLine) { trailLine.geometry.setDrawRange(0, 0); trailLine.visible = false; } }
const descOf = n => (window.TPW_TRICKS.find(t => t.name.trim() === n) || {}).desc || '';
function clearance(p) { let best = 99; for (const o of world.objs) for (const pr of o.prims || []) { if (!pr.aabb) continue;
  const dx = Math.max(pr.aabb.min.x - p.x, 0, p.x - pr.aabb.max.x), dz = Math.max(pr.aabb.min.z - p.z, 0, p.z - pr.aabb.max.z), dy = Math.max(pr.aabb.min.y - p.y, 0, p.y - pr.aabb.max.y);
  best = Math.min(best, Math.hypot(dx, dy, dz)); } return best; }
function startJudge(trick) {
  if (trick) judge.want = trick;
  train.on = false; renderTrain(); drone.armed = false; ghostOff();
  mode = 'judge'; show(null); $('#hud').classList.add('hide'); $('#judgeBox').classList.remove('hide'); judgeNext();
}
function stopJudge() { judgeUpload(); judge.demo = null; judge.intro = null; document.body.classList.remove('demoBig'); { const r = $('#demoRadio'); if (r) r.classList.add('hide'); const c = $('#coachCue'); if (c) c.classList.add('hide'); } $('#judgeBox').classList.add('hide'); $('#judgeSticks').classList.add('hide'); $('#demoArrows').classList.add('hide'); trailClear(); droneMesh.scale.setScalar(1); }
// Where the bot's flight comes from (owner, 2026-11-19: the bot should be the game's current knowledge of each trick): mostly
// the knowledge bot (MV.knowledge: a confirmed example from the trick library re-flown with small variations, or the script
// retimed to the library's pace), sometimes the hand-written script, so verdicts on both keep coming. Each flight is tagged.
const KB_SHARE = 0.75;
const judgeTricks = () => abcSort([...new Set([...MV.tricks, ...MV.kbTricks()])]);
function judgeNext() {
  const all = judgeTricks();
  judge.name = judge.want === 'random' ? all[Math.floor(Math.random() * all.length)] : judge.want;
  judge.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const scripted = MV.tricks.includes(judge.name), useKb = !scripted || Math.random() < KB_SHARE;
  judge.m = (useKb && MV.knowledge(judge.name, world, judge.seed, { human: true, tilt: 0 })) || (scripted ? MV.make(judge.name, world, judge.seed, { human: true }) : null);   // real whoops wander: drift, bob, uneven speed
  if (!judge.m) { judge.want = 'random'; return judgeNext(); }
  judge.source = judge.m.source || 'script'; judge.ex = judge.m.ex ?? null; judge.from = judge.m.source === 'library' ? { by: judge.m.by, map: judge.m.map, when: judge.m.when, inPlace: judge.m.inPlace } : null;
  judge.events = MV.detect(judge.m, world, tune.camTilt, { rows: true }); judge.rows = judge.events.rows || null;
  judge.t = 0; judge.phase = 'watch'; trailClear();
  // spectator spot: beside the flight path, looking across it, like a pilot watching line-of-sight
  const pts = []; for (let t = 0; t < judge.m.T; t += 0.05) pts.push(judge.m.at(t).pos);
  const C = S.mul(pts.reduce((a, p) => S.add(a, p), S.v3()), 1 / pts.length);
  let sxx = 0, szz = 0, sxz = 0; for (const p of pts) { const dx = p.x - C.x, dz = p.z - C.z; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), perp = S.v3(-Math.sin(ang), 0, Math.cos(ang));
  const spread = Math.sqrt(Math.max(sxx, szz) / pts.length), dist = Math.max(3.2, spread * 1.7 + 2.4);
  const ys = pts.map(p => p.y), ymid = Math.max(1.6, Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.4);
  judge.camPos = [1, -1].map(sg => S.v3(C.x + perp.x * dist * sg, ymid, C.z + perp.z * dist * sg)).sort((a, b) => clearance(b) - clearance(a))[0];
  judge.look = C; judge.lookS = null; judge.orb = judge.keepOrb ? judge.orb : null; renderJudge();
}
function judgeStep(dt) {
  const m = judge.m; if (!m) return;
  const end = judge.demo && judge.intro && demo.b ? demo.b : m.T;   // the intro plays the trick itself, without the long run-in and run-out
  judge.t = Math.min(end, judge.t + dt * judge.speed);
  if (judge.demo) { if (judge.t >= end) { judge.hold = (judge.hold || 0) + dt; if (judge.hold > (judge.intro ? 0.7 : 1.4)) { judge.hold = 0; if (!demoLoop()) return; judge.t = judge.intro ? demo.a || 0 : 0; trailClear(); } } demoTick(); }   // Train → Show me: loops, no verdicts (the intro: full speed twice, slowly once, then the pilot's turn)
  else if (judge.t >= m.T && judge.phase === 'watch') { judge.phase = 'ask'; renderJudge(); }
  const s = m.at(judge.t); drone.pos = s.pos; drone.q = s.q; for (let i = 0; i < 4; i++) drone.motorW[i] = 2600;
  if (judge.t < m.T) trailPush(s.pos);
  judgeSticksDraw();
}
// The bot's sticks (owner, 2026-11-20: "in judge the bot, you should be able to go first person and see the stick overlay"): the
// sticks a pilot would have needed for this flight, the same ones the detector's Watcher saw (MV.detect's rows: throttle col 11,
// roll / pitch / yaw 24-26), drawn like the flying HUD's overlay; V turns it on and off with the HUD's own setting.
function judgeSticksDraw() {
  const cv = $('#judgeSticks'), rows = judge.rows, on = (stickUI.on || judge.demo) && mode === 'judge' && rows && rows.length > 1 && !(judge.demo && (demo.view === 'sticks' || (judge.intro && judge.intro.phase === 'payoff')));
  cv.classList.toggle('hide', !on); if (!on) return;
  const at = t => { const i = Math.max(0, Math.min(rows.length - 1, Math.round((t - rows[0][0]) / ((rows[rows.length - 1][0] - rows[0][0]) / (rows.length - 1))))), r = rows[i]; return { thr: r[11], roll: r[24], pitch: r[25], yaw: r[26] }; };
  const trail = []; for (let k = 15; k >= 1; k--) if (judge.t - k * 0.033 >= 0) trail.push(at(judge.t - k * 0.033));
  drawSticks(cv, at(judge.t), trail, { label2: 'P/R (the bot)' });
}
const JCAMS = { spectator: '👁 Spectator', fpv: '🥽 FPV', chase: '🎥 Chase' };
function judgeReplay() { judge.t = 0; trailClear(); }
canvas.addEventListener('mousedown', e => { if (mode !== 'judge' || judge.cam !== 'spectator') return; judge.drag = { x: e.clientX, y: e.clientY }; });
addEventListener('mousemove', e => { if (mode !== 'judge' || !judge.drag) return; const o = judge.orb || (judge.orb = { yaw: 0, pitch: 0, zoom: 1 });
  o.yaw -= (e.clientX - judge.drag.x) * 0.008; o.pitch += (e.clientY - judge.drag.y) * 0.006; judge.drag = { x: e.clientX, y: e.clientY }; judge.keepOrb = true; });
addEventListener('mouseup', () => { judge.drag = null; });
canvas.addEventListener('wheel', e => { if (mode !== 'judge') return; e.preventDefault(); const o = judge.orb || (judge.orb = { yaw: 0, pitch: 0, zoom: 1 }); o.zoom = Math.max(0.25, Math.min(4, o.zoom * Math.exp(e.deltaY * 0.0012))); judge.keepOrb = true; }, { passive: false });
canvas.addEventListener('dblclick', () => { if (mode === 'judge') { judge.orb = null; judge.keepOrb = false; } });
function judgeVerdict(v) {
  if (judge.phase !== 'ask') return;
  const det = judge.events.map(e => e.name), detOK = det.length === 1 && det[0] === judge.name, valid = v !== 'wrong';
  const like = v === 'wrong' ? ($('#jLike') && $('#jLike').value) || null : null;
  const rec = { id: `${Date.now()}-${judge.seed}`, at: new Date().toISOString(), trick: judge.name, seed: judge.seed, human: true, object: judge.m.object, params: judge.m.params,
    source: judge.source, ex: judge.ex, inPlace: !!(judge.from && judge.from.inPlace), verdict: v, lookedLike: like, detected: judge.events.map(e => ({ name: e.name, exec: e.exec, clean: e.clean })), detectorRight: detOK, agree: valid === detOK, build: '0.1' };
  judge.session.push(rec); idb.put('judge', rec); judge.phase = 'reveal'; renderJudge(); judgeShare(rec);
  if (judge.session.filter(x => !x.up).length >= 10) judgeUpload();
}
// Every judged flight goes to the project as a mini flight, the bot as its pilot ('bot': one shared identity), with the
// judge's verdict as labels on it: tools/community.js and tools/library.js learn from it like any shared flight (src 'bot').
// The judge's own click, so it goes even with automatic sharing off; nothing about the judge but their pilot name and id.
async function judgeShare(rec) {
  const rows = judge.rows; if (!rows || rows.length < 50) return;
  const id = `bot${rec.seed.toString(36)}${Date.now().toString(36).slice(-4)}`.slice(0, 40), T1 = rows[rows.length - 1][0], ev = judge.events.map(e => ({ t: +e.t.toFixed(3), t0: +Math.max(0, e.t - 1.5).toFixed(3), name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle || null, conf: e.watch ? e.watch.conf : null }));
  try {
    const trace = await FlightLog.pack(rows, TRACE_COLS, 100);
    await telQueue('flight', id, { format: 'pro-whooper-flight/1', build: '0.1', id, started: rec.at, ended: 'judged', pilot: 'bot', name: 'bot', map: MAP_ID, mode: 'bot', camTilt: tune.camTilt, craft: null, tune: null, profile: null, input: null, score: null, events: ev, missed: [], summary: { bot: { trick: rec.trick, seed: rec.seed, object: rec.object || null, human: true, source: rec.source || 'script', ex: rec.ex ?? null, inPlace: !!rec.inPlace }, seconds: +T1.toFixed(1) }, trace }, true);
    const span = { repStart: 0.3, t: +Math.max(0.5, T1 - 0.3).toFixed(3) }, labels = [], ok = rec.verdict !== 'wrong', what = ok ? rec.trick : rec.lookedLike;
    labels.push({ target: rec.trick, verdict: ok ? 'yes' : 'no', actual: ok ? rec.trick : (what || 'not a trick'), ...span, detected: ev.map(e => e.name), execActual: rec.verdict === 'clean' ? 'CLEAN' : rec.verdict === 'sloppy' ? 'SLOPPY' : null, via: 'judge-bot', src: 'bot' });
    for (const e of ev) if (e.name !== rec.trick && e.name !== what) labels.push({ target: e.name, verdict: 'no', actual: 'not a trick', repStart: e.t0, t: e.t, detected: [e.name], conf: e.conf, via: 'judge-bot', src: 'bot', inferred: true });   // the judge only looked at the scripted trick: other calls are a guess from the script (a bot flight is meant to be one trick), not a verdict, and carry little weight (tools/evidence.js)
    await telQueue('labels', id + '-v', { format: 'pro-whooper-flight-labels/1', build: '0.1', flight: id, started: rec.at, pilot: telPilot(), name: pilotName() || null, labels }, true);
  } catch { /* stays in Judge the Bot's own records */ }
}
function judgeUpload() {
  const list = judge.session.filter(x => !x.up); if (!list.length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (ghEnqueue(`calibration/judge/${stamp}.json`, { format: 'pro-whooper-judge/1', build: '0.1', camTilt: tune.camTilt, verdicts: list }, `judge the bot: ${list.length} verdicts`)) list.forEach(x => x.up = true);
}
async function judgeExport() {
  const all = await idb.all('judge'); const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  await saveFile(`judge-verdicts-${stamp}.json`, JSON.stringify({ format: 'pro-whooper-judge/1', build: '0.1', camTilt: tune.camTilt, verdicts: all.length ? all : judge.session }, null, 1));
}
const VERDICT = { clean: '✓ clean', sloppy: '≈ sloppy, but it is the trick', wrong: '✗ not this trick' };
function renderJudge() {
  if (judge.demo) { demoRender(); return; }
  const box = $('#judgeBox'); if (!box || !judge.m) return;
  const n = judge.session.length, ag = judge.session.filter(x => x.agree).length, last = judge.session[n - 1];
  const det = judge.events.length ? judge.events.map(e => `${e.name} <small>${e.exec}${e.clean != null ? ' ' + e.clean : ''}</small>`).join(' + ') : 'nothing';
  const detOK = judge.events.length === 1 && judge.events[0].name === judge.name;
  box.innerHTML = `<div class="trHead"><small>JUDGE THE BOT · DEV</small><span class="jStat">${n} judged · agree ${ag}/${n}</span></div>
    <div class="trTarget">${judge.name}</div><div class="trObs">on <b>${judge.m.object === 'Pilot' ? 'the pilot' : judge.m.object}</b> · speed ×${judge.speed} · camera: ${judge.cam}${judge.phase === 'reveal' ? ` · flown from ${judge.source === 'library' ? `${judge.from && judge.from.by ? esc(judge.from.by) + '\'s' : 'a pilot\'s'} confirmed trick${judge.from && judge.from.map ? ' on ' + esc((S.MAPS[judge.from.map] || {}).title || judge.from.map) : ''}${judge.from && judge.from.when ? ', ' + esc(String(judge.from.when).slice(0, 10)) : ''}${judge.from && judge.from.inPlace ? ' (where it was flown)' : ''}` : judge.source === 'blend' ? 'the script, at the library\'s pace' : 'the hand-written script'}` : ''}</div>
    <div class="trDesc">${descOf(judge.name)}</div>
    <div class="trRow jCam">${Object.entries(JCAMS).map(([k, v]) => `<button data-jcam="${k}" class="${judge.cam === k ? 'on' : 'ghost'}">${v}</button>`).join('')}<button data-jcam="sticks" class="${stickUI.on ? 'on' : 'ghost'}" title="The sticks the bot would need (V)">🕹 Sticks</button></div>
    ${judge.phase === 'watch' ? `<div class="trLast">Watch the bot fly it… <kbd>R</kbd> replay · <kbd>S</kbd> slow-mo · <kbd>C</kbd> camera · <kbd>V</kbd> sticks</div>` : ''}
    ${judge.phase === 'ask' ? `<div class="trLast">Did the bot fly a proper <b>${judge.name}</b>?</div>
      <div class="trBtns"><button data-j="clean">✓ Clean <kbd>1</kbd></button><button data-j="sloppy">≈ Sloppy, still the trick <kbd>2</kbd></button><button data-j="wrong">✗ Not this trick <kbd>3</kbd></button><button data-j="replay">⟲ Again <kbd>R</kbd></button></div>
      <div class="trRow"><select id="jLike"><option value="">If ✗: it looked more like…</option><option>can't tell / not a trick</option>${abcSort(ALL_TRICKS().map(x => nameOf(x))).map(n => `<option>${n}</option>`).join('')}</select></div>` : ''}
    ${judge.phase === 'reveal' ? `<div class="trLast">You: <b>${VERDICT[last.verdict]}</b>${last.lookedLike ? ` (looked like ${last.lookedLike})` : ''}<br>Detector: <b>${det}</b> ${detOK ? '✓' : '✗'}<br>${last.agree ? '<span class="jOk">You agree.</span>' : '<span class="nm">You disagree — this one is worth a look.</span>'}</div>
      <div class="trBtns"><button data-j="next">Next <kbd>Enter</kbd></button><button data-j="replay">⟲ Replay <kbd>R</kbd></button></div>` : ''}
    <div class="trRow"><select id="jWant"><option value="random">Trick: random</option>${judgeTricks().map(t => `<option ${t === judge.want ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="trFoot"><button data-j="export" class="ghost">Export verdicts</button><button data-j="upload" class="ghost">↑ Upload</button><button data-act="menu" class="ghost">Menu</button><span id="ghStatus" class="ghs"></span></div>`;
  renderGhStatus();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-j]'); if (b) { e.stopPropagation(); const a = b.dataset.j;
    if (a === 'clean' || a === 'sloppy' || a === 'wrong') judgeVerdict(a);
    if (a === 'replay') judgeReplay(); if (a === 'next') judgeNext(); if (a === 'export') judgeExport(); if (a === 'upload') { judgeUpload(); renderGhStatus(); }
    return; }
  const c = e.target.closest('[data-jcam]'); if (c) { e.stopPropagation(); const k = c.dataset.jcam; if (k === 'sticks') { stickUI.on = !stickUI.on; store.set('ui.sticks', stickUI.on); } else judge.cam = k; c.blur(); renderJudge(); judgeSticksDraw(); return; }
  const w = e.target.closest('[data-watch]'); if (w) { e.preventDefault(); startJudge(w.dataset.watch); }
});
document.addEventListener('change', e => { if (e.target.id === 'jWant') { judge.want = e.target.value; judgeNext(); e.target.blur(); } });
addEventListener('keydown', e => {
  if (mode !== 'judge' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (e.code === 'Escape') { if (judge.demo) { demoBack(); return; } stopJudge(); mode = 'menu'; show('#mainMenu'); }
  if (e.code === 'KeyR') judgeReplay();
  if (e.code === 'KeyS') { judge.speed = judge.speed === 1 ? 0.5 : judge.speed === 0.5 ? 0.25 : 1; renderJudge(); }
  if (e.code === 'KeyV') { stickUI.on = !stickUI.on; store.set('ui.sticks', stickUI.on); renderJudge(); judgeSticksDraw(); }
  if (e.code === 'KeyC') { judge.cam = judge.cam === 'spectator' ? 'fpv' : judge.cam === 'fpv' ? 'chase' : 'spectator'; renderJudge(); }
  if (judge.demo) { if (e.code === 'Space') { e.preventDefault(); if (judge.intro && judge.intro.phase === 'payoff') { demoBack(); return; } judge.speed = judge.speed ? 0 : (demo.lastSpeed || 1); demoRender(); } return; }
  if (judge.phase === 'ask') { if (e.code === 'Digit1') judgeVerdict('clean'); if (e.code === 'Digit2') judgeVerdict('sloppy'); if (e.code === 'Digit3') judgeVerdict('wrong'); }
  if (judge.phase === 'reveal' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); judgeNext(); }
});
// ---- ghost preview: a see-through bot flies the trick around the object while you fly (Trick Calibration "Show me")
const ghost = { on: false, m: null, t: 0, loops: 0, mesh: null };
function ghostMesh() {
  if (ghost.mesh) return ghost.mesh;
  const g = droneMesh.clone(true);
  g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; o.material.depthWrite = false; if (o.material.emissive) o.material.emissive.setHex(0x66ff99); o.castShadow = false; } });
  g.scale.setScalar(2.2); scene.add(g); ghost.mesh = g; return g;
}
function startGhost(name, objName) {
  if (!MV.LIB[name]) { flash('<b>NO GHOST YET</b><small>no scripted flight for this trick</small>', 'warn'); return; }
  const obj = { 'the pilot': 'Pilot' }[objName] || objName, ok = ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Tree', 'Pilot'].includes(obj);
  ghost.m = MV.make(name, world, (Date.now() >>> 0), ok ? { object: obj, wobble: 0 } : { wobble: 0 }); ghost.t = 0; ghost.loops = 0; ghost.on = true; ghostMesh().visible = true; trailClear();
  flash(`<b>👻 ${name}</b><small>watch the ghost on the ${ghost.m.object} — it flies it 3×</small>`);
}
function ghostOff() { ghost.on = false; if (ghost.mesh) ghost.mesh.visible = false; if (mode !== 'judge') trailClear(); }
function ghostStep(dt) {
  if (!ghost.on) return; ghost.t += dt;
  if (ghost.t > ghost.m.T) { ghost.t = 0; ghost.loops++; trailClear(); if (ghost.loops >= 3) { ghostOff(); return; } }
  const s = ghost.m.at(ghost.t), g = ghostMesh(); g.position.set(s.pos.x, s.pos.y, s.pos.z); g.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w); trailPush(s.pos);
}


