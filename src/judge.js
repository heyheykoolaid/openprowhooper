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
function stopJudge() { judgeUpload(); $('#judgeBox').classList.add('hide'); trailClear(); droneMesh.scale.setScalar(1); }
function judgeNext() {
  judge.name = judge.want === 'random' ? MV.tricks[Math.floor(Math.random() * MV.tricks.length)] : judge.want;
  judge.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  judge.m = MV.make(judge.name, world, judge.seed, { human: true });   // real whoops wander: drift, bob, uneven speed
  judge.events = MV.detect(judge.m, world, tune.camTilt);
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
  judge.t = Math.min(m.T, judge.t + dt * judge.speed);
  if (judge.t >= m.T && judge.phase === 'watch') { judge.phase = 'ask'; renderJudge(); }
  const s = m.at(judge.t); drone.pos = s.pos; drone.q = s.q; for (let i = 0; i < 4; i++) drone.motorW[i] = 2600;
  if (judge.t < m.T) trailPush(s.pos);
  droneMesh.scale.setScalar(judge.cam === 'fpv' ? 1 : 2.5);   // a 65 mm whoop is a speck from the spectator spot
}
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
    verdict: v, lookedLike: like, detected: judge.events.map(e => ({ name: e.name, exec: e.exec, clean: e.clean })), detectorRight: detOK, agree: valid === detOK, build: '0.1' };
  judge.session.push(rec); idb.put('judge', rec); judge.phase = 'reveal'; renderJudge();
  if (judge.session.filter(x => !x.up).length >= 10) judgeUpload();
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
  const box = $('#judgeBox'); if (!box || !judge.m) return;
  const n = judge.session.length, ag = judge.session.filter(x => x.agree).length, last = judge.session[n - 1];
  const det = judge.events.length ? judge.events.map(e => `${e.name} <small>${e.exec}${e.clean != null ? ' ' + e.clean : ''}</small>`).join(' + ') : 'nothing';
  const detOK = judge.events.length === 1 && judge.events[0].name === judge.name;
  box.innerHTML = `<div class="trHead"><small>JUDGE THE BOT · DEV</small><span class="jStat">${n} judged · agree ${ag}/${n}</span></div>
    <div class="trTarget">${judge.name}</div><div class="trObs">on <b>${judge.m.object === 'Pilot' ? 'the pilot' : judge.m.object}</b> · speed ×${judge.speed} · camera: ${judge.cam}</div>
    <div class="trDesc">${descOf(judge.name)}</div>
    ${judge.phase === 'watch' ? `<div class="trLast">Watch the bot fly it… <kbd>R</kbd> replay · <kbd>S</kbd> slow-mo · <kbd>C</kbd> camera</div>` : ''}
    ${judge.phase === 'ask' ? `<div class="trLast">Did the bot fly a proper <b>${judge.name}</b>?</div>
      <div class="trBtns"><button data-j="clean">✓ Clean <kbd>1</kbd></button><button data-j="sloppy">≈ Sloppy, still the trick <kbd>2</kbd></button><button data-j="wrong">✗ Not this trick <kbd>3</kbd></button><button data-j="replay">⟲ Again <kbd>R</kbd></button></div>
      <div class="trRow"><select id="jLike"><option value="">If ✗: it looked more like…</option><option>can't tell / not a trick</option>${ALL_TRICKS().map(x => `<option>${nameOf(x)}</option>`).join('')}</select></div>` : ''}
    ${judge.phase === 'reveal' ? `<div class="trLast">You: <b>${VERDICT[last.verdict]}</b>${last.lookedLike ? ` (looked like ${last.lookedLike})` : ''}<br>Detector: <b>${det}</b> ${detOK ? '✓' : '✗'}<br>${last.agree ? '<span class="jOk">You agree.</span>' : '<span class="nm">You disagree — this one is worth a look.</span>'}</div>
      <div class="trBtns"><button data-j="next">Next <kbd>Enter</kbd></button><button data-j="replay">⟲ Replay <kbd>R</kbd></button></div>` : ''}
    <div class="trRow"><select id="jWant"><option value="random">Trick: random</option>${MV.tricks.map(t => `<option ${t === judge.want ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="trFoot"><button data-j="export" class="ghost">Export verdicts</button><button data-j="upload" class="ghost">↑ Upload</button><button data-act="menu" class="ghost">Menu</button><span id="ghStatus" class="ghs"></span></div>`;
  renderGhStatus();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-j]'); if (b) { e.stopPropagation(); const a = b.dataset.j;
    if (a === 'clean' || a === 'sloppy' || a === 'wrong') judgeVerdict(a);
    if (a === 'replay') judgeReplay(); if (a === 'next') judgeNext(); if (a === 'export') judgeExport(); if (a === 'upload') { judgeUpload(); renderGhStatus(); }
    return; }
  const w = e.target.closest('[data-watch]'); if (w) { e.preventDefault(); startJudge(w.dataset.watch); }
});
document.addEventListener('change', e => { if (e.target.id === 'jWant') { judge.want = e.target.value; judgeNext(); e.target.blur(); } });
addEventListener('keydown', e => {
  if (mode !== 'judge' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (e.code === 'Escape') { stopJudge(); mode = 'menu'; show('#mainMenu'); }
  if (e.code === 'KeyR') judgeReplay();
  if (e.code === 'KeyS') { judge.speed = judge.speed === 1 ? 0.5 : judge.speed === 0.5 ? 0.25 : 1; renderJudge(); }
  if (e.code === 'KeyC') { judge.cam = judge.cam === 'spectator' ? 'fpv' : judge.cam === 'fpv' ? 'chase' : 'spectator'; renderJudge(); }
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


