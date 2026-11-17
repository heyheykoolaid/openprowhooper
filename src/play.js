// ============================================================ audio
let actx = null, osc = [], gains = [], noiseG = null, airG = null, airBp = null, crashAt = null, wasArmed = false;
function initAudio() {
  if (actx) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const master = actx.createGain(); master.gain.value = store.get('vol', 0.35); master.connect(actx.destination); window._master = master;
  // Prop sound: a soft-harmonic tone an octave-and-a-bit under the blade-pass whine, plus rushing air that follows
  // the rpm. (The first version was four raw sawtooths at the blade frequency: thin and whiny.)
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = 0.4; lp.connect(master);
  const wave = actx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.55, 0.3, 0.16, 0.08, 0.04]));
  for (let i = 0; i < 4; i++) { const o = actx.createOscillator(); o.setPeriodicWave(wave); const g = actx.createGain(); g.gain.value = 0; o.connect(g); g.connect(lp); o.start(); osc.push(o); gains.push(g); }
  const buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const ns = actx.createBufferSource(); ns.buffer = buf; ns.loop = true; const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  noiseG = actx.createGain(); noiseG.gain.value = 0; ns.connect(bp); bp.connect(noiseG); noiseG.connect(master); ns.start();
  airBp = actx.createBiquadFilter(); airBp.type = 'bandpass'; airBp.frequency.value = 500; airBp.Q.value = 0.9; airG = actx.createGain(); airG.gain.value = 0; ns.connect(airBp); airBp.connect(airG); airG.connect(master);
}
// Crash sounds: a dull thud for everyone... except one pilot.
let audioWasCrashed = false;
function crashThud() {
  const t = actx.currentTime, n = Math.floor(actx.sampleRate * 0.22), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = actx.createBufferSource(); src.buffer = buf; const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const g = actx.createGain(); g.gain.value = 1.4; src.connect(lp); lp.connect(g); g.connect(window._master); src.start(t);
  const o = actx.createOscillator(), og = actx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); og.gain.setValueAtTime(0.7, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(og); og.connect(window._master); o.start(t); o.stop(t + 0.22);
}
function crashFart() {
  const t = actx.currentTime, dur = 0.35 + Math.random() * 0.75, f0 = 68 + Math.random() * 55;
  const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.55 + Math.random() * 0.3), t + dur);
  if (Math.random() < 0.35) o.frequency.linearRampToValueAtTime(f0 * 1.5, t + dur + 0.08);   // the occasional squeak at the end
  const wob = actx.createOscillator(), wobG = actx.createGain(); wob.frequency.value = 14 + Math.random() * 16; wobG.gain.value = 9 + Math.random() * 10; wob.connect(wobG); wobG.connect(o.frequency);
  const flut = actx.createOscillator(), flutG = actx.createGain(); flut.type = 'square'; flut.frequency.value = 24 + Math.random() * 26; flutG.gain.value = 0.45;
  const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55, t + 0.03); g.gain.setValueAtTime(0.55, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
  flut.connect(flutG); flutG.connect(g.gain);
  const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520 + Math.random() * 300; lp.Q.value = 3;
  const out = actx.createGain(); out.gain.value = 1.6; o.connect(g); g.connect(lp); lp.connect(out); out.connect(window._master);
  for (const x of [o, wob, flut]) { x.start(t); x.stop(t + dur + 0.15); }
}
function updateAudio() {
  if (!actx) return;
  if (drone.crashed && !audioWasCrashed) { try { isRidgeRipper() ? crashFart() : crashThud(); } catch {} } audioWasCrashed = drone.crashed; const t = actx.currentTime; const blades = S.PARTS.props[spec.prop].blades;
  for (let i = 0; i < 4; i++) { const rpm = Math.abs(drone.motorW[i]) * 60 / (2 * Math.PI); osc[i].frequency.setTargetAtTime(Math.max(24, rpm / 60 * blades * 0.2 * (1 + (i - 1.5) * 0.012)), t, 0.015); gains[i].gain.setTargetAtTime(drone.armed ? 0.03 + 0.08 * Math.min(1, rpm / params.stats.rpmMax) : 0, t, 0.02); }
  { const m = (Math.abs(drone.motorW[0]) + Math.abs(drone.motorW[1]) + Math.abs(drone.motorW[2]) + Math.abs(drone.motorW[3])) / 4 * 60 / (2 * Math.PI), k = Math.min(1, m / params.stats.rpmMax); airBp.frequency.setTargetAtTime(350 + 900 * k, t, 0.04); airG.gain.setTargetAtTime(drone.armed ? 0.02 + 0.2 * k * k : 0, t, 0.04); }
  noiseG.gain.setTargetAtTime(Math.min(0.25, S.len(drone.vel) * 0.012 + drone.washLevel * 0.15), t, 0.05);
}

// ============================================================ HUD
const popups = $('#popups');
function flash(text, cls = '') { const el = document.createElement('div'); el.className = 'popup ' + cls; el.innerHTML = text; popups.prepend(el); setTimeout(() => el.classList.add('out'), 1900); setTimeout(() => el.remove(), 2600); while (popups.children.length > 3) popups.lastChild.remove(); }
// ---- combo (Tony Hawk style presentation; points follow the TPW calculator exactly)
// A combo runs while you keep doing tricks; it banks after COMBO_IDLE s with no trick or rotation; a crash bails it.
const COMBO_IDLE = 2.0;
const combo = { names: [], pts: 0, lastT: 0, active: false };
// loops chain like combo trippies: the same loop on the same object again and again shows as one entry, ×N (each one still
// scores by the TPW calculator, repeats included)
const CHAIN = new Set(['Powerloop', 'Maverick Loop', 'Matty Flip', 'Beginner Matty', 'Split-S', 'Jump Rope', 'Anti Matty', 'Power Flip', 'Immelmann Turn']);
function comboAdd(r) {
  const last = combo.chain, now = performance.now() / 1000;
  if (CHAIN.has(r.name) && last && last.name === r.name && last.obstacle === (r.obstacle || null) && now - last.t < 3.5) { last.n++; last.t = now; combo.names[combo.names.length - 1] = `${r.name} ×${last.n}`; }
  else { combo.names.push((r.laps ? `${r.name.replace(' x2', '')} ×${r.laps}` : r.name) + (r.exec !== 'CLEAN' ? ` (${r.exec.toLowerCase()})` : '')); combo.chain = CHAIN.has(r.name) ? { name: r.name, obstacle: r.obstacle || null, n: 1, t: now } : null; }
  combo.pts += r.net; combo.lastT = performance.now() / 1000; combo.active = true; renderCombo(); }
function comboEnd(bailed) {
  if (!combo.active) return;
  const el = $('#comboBank'); const n = combo.names.length;
  el.innerHTML = bailed ? `<b>BAILED</b><small>${n} trick${n > 1 ? 's' : ''} · ${combo.pts.toLocaleString()} pts kept · streak lost</small>` : `<b>+${combo.pts.toLocaleString()}</b><small>${n > 1 ? n + ' TRICK COMBO' : 'LANDED'}</small>`;
  el.className = bailed ? 'bail show' : 'show'; void el.offsetWidth;
  combo.names = []; combo.pts = 0; combo.active = false; renderCombo();
}
function renderCombo() {
  const el = $('#combo'); const prov = mode === 'fly' ? detector.provisional() : [], live = mode === 'fly' && detector.liveState ? detector.liveState() : [];
  if (!combo.active && !prov.length && !live.length) { el.classList.add('hide'); return; }
  el.classList.remove('hide');
  const liveTxt = l => l.laps !== undefined ? `<span class="live">${l.name.replace(' x2', '')} ×${l.laps}${l.counts ? ` <b>+${l.pts}</b>` : ''}</span>` : `<span class="live">${l.name} ${l.meters.toFixed(1)}m</span>`;
  const list = [...combo.names.map(n => `<span>${n}</span>`), ...prov.map(n => `<span class="prov">${n}…</span>`), ...live.map(liveTxt)];
  const livePts = live.reduce((a, l) => a + (l.counts ? l.pts : 0), 0);
  el.innerHTML = `<div class="cList">${list.slice(-7).join('<i>+</i>')}</div>${combo.active || livePts ? `<div class="cPts">${(combo.pts + livePts).toLocaleString()}<small> × streak ${score.streak.toFixed(2)}</small></div>` : ''}`;
}
function onTrick(ev) {
  trainOnEvent(ev); recapEvent(ev);
  if (ev.name === 'near') { flash(`<b>SO CLOSE</b><small>${ev.near}</small>`, 'near'); return; }
  const r = score.add(ev);
  if (ev.exec === 'CRASH') { comboEnd(true); flash(`<b>CRASH!</b><small>streak lost</small>`, 'crash'); updateBreakdown(); return; }
  if (!r) return;
  comboAdd(r);
  const mults = []; if (r.totwM > 1) mults.push(`TotW ×${r.totwM}`); if (r.repeatM < 1) mults.push(`repeat ×${r.repeatM}`); if (r.b2bM < 1) mults.push(`b2b ×${r.b2bM}`); if (r.obsM < 1) mults.push(`same obstacle ×${r.obsM}`); if (r.streakM > 1.0001) mults.push(`streak ×${r.streakM.toFixed(2)}`);
  flash(`<b>${r.name.toUpperCase()}</b>${r.draft ? '<small class="draftTag">new rule</small>' : ''}<span class="ex ${r.exec}">${r.exec}${r.clean !== undefined ? ' ' + r.clean + '%' : ''}</span>${r.obstacle ? `<small>on ${r.obstacle}</small>` : ''}<em>+${r.net}</em>${mults.length ? `<small>${mults.join(' · ')}</small>` : ''}${r.kwadHit ? `<small class="kw">K.W.A.D. letter ${r.kwadHit}!</small>` : ''}`, r.exec);
  updateBreakdown();
}
function updateBreakdown() {
  const rows = score.log.slice(-14).reverse().map(r => `<tr><td>${r.name}</td><td>${r.base ?? 0}</td><td class="${r.exec}">${r.exec}</td><td>${r.execM ?? 0}</td><td>${r.repeatM ?? '-'}</td><td>${r.b2bM ?? '-'}</td><td>${r.obsM ?? '-'}</td><td>${r.totwM ?? '-'}</td><td>${r.streakM ? r.streakM.toFixed(2) : '-'}</td><td><b>${r.net}</b></td></tr>`).join('');
  $('#breakdown tbody').innerHTML = rows || '<tr><td colspan=10>No tricks yet</td></tr>';
}
// "What counted": a small live list of what the game just saw you pass — over or under an object, through a gap, past
// a pole — so a miss can be traced to the object that didn't register. Z toggles it (Options → Graphics too).
const passUI = { on: store.get('passFeed', true), seen: new WeakSet(), items: [] };
function passFeed() {
  const el = $('#passFeed'); if (!el) return; if (!passUI.on || mode !== 'fly' || race.on) { if (el.textContent) el.textContent = ''; return; }
  const now = performance.now();
  for (const c of detector.crossLog) if (!passUI.seen.has(c)) { passUI.seen.add(c); passUI.items.push({ k: c.kind, txt: (c.kind === 'O' ? 'over ' : c.kind === 'U' ? 'under ' : 'through ') + c.name, until: now + 2600 }); }
  for (const ps of detector.passes || []) if (!passUI.seen.has(ps)) { passUI.seen.add(ps); passUI.items.push({ k: 'P', txt: 'past ' + ps.name, until: now + 2600 }); }
  const live = passUI.items.filter(x => x.until > now).slice(-5); if (live.length !== passUI.items.length || passUI.dirty !== live.length) { passUI.items = live; passUI.dirty = live.length;
    el.innerHTML = live.map(x => `<div class="pf${x.k}">${x.k === 'O' ? '▲' : x.k === 'U' ? '▼' : x.k === 'G' ? '◆' : '●'} ${x.txt.replace(/[<&]/g, '')}</div>`).join(''); }
}
addEventListener('keydown', e => { if (e.code !== 'KeyZ' || mode !== 'fly' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; passUI.on = !passUI.on; store.set('passFeed', passUI.on); flash(`<b>WHAT COUNTED: ${passUI.on ? 'ON' : 'OFF'}</b><small>Z toggles the over / under / gap list</small>`, 'near'); });
function hud() {
  const s = params.stats;
  $('#score').textContent = score.total.toLocaleString();
  $('#streak').textContent = `STREAK ×${score.streak.toFixed(2)}`;
  $('#streakbar').style.width = Math.min(100, (score.streak - 1) * 250) + '%';
  $('#switch').textContent = score.uniqueObs.size ? `${score.uniqueObs.size} obstacle${score.uniqueObs.size > 1 ? 's' : ''} · switch ×${score.switchMult()}` : '';
  for (const L of ['K', 'W', 'A', 'D']) $('#kw' + L).classList.toggle('on', !!score.kwad[L]);
  // OSD
  const v = drone.vbat; $('#osdV').textContent = v.toFixed(2) + 'V'; $('#osdV').classList.toggle('blink', v / (params.bat.cells || 1) < 3.35 && drone.armed);
  $('#osdA').textContent = drone.ibat.toFixed(1) + 'A'; $('#osdMah').textContent = Math.round(drone.mAh) + 'mAh';
  $('#osdThr').textContent = 'THR ' + Math.round(lastRC.thr * 100);
  $('#osdSpd').textContent = Math.round(S.len(drone.vel) * 3.6) + 'kph';
  $('#osdAlt').textContent = drone.pos.y.toFixed(1) + 'm';
  const usingSwitch = inputCfg.mode !== 'keyboard' && prof() && !prof().arm.toggle && readPad();
  const noDev = inputCfg.mode !== 'keyboard' && !readPad();
  $('#osdState').textContent = noDev ? `${inputCfg.mode.toUpperCase()} NOT DETECTED · MOVE A STICK` : drone.armed ? '' :
    usingSwitch ? (armBlock || 'DISARMED') :
    drone.crashed ? (crashLock ? (tune.flightMode === '3d' ? 'CRASH · THROTTLE TO THE MIDDLE TO GO AGAIN' : 'CRASH · THROTTLE TO ZERO TO GO AGAIN') : drone.crashReason === 'turtle' ? 'CRASH · T OR ARM TO FLIP' : 'CRASH · ARM TO RESET') :
    (!thrArmOk(lastRC.thr) ? `THROTTLE HIGH (${Math.round(lastRC.thr * 100)}%)` : (autoArmOn() ? 'THROTTLE UP TO TAKE OFF' : inputCfg.mode === 'keyboard' ? 'DISARMED · SPACE TO ARM' : 'DISARMED · ' + (prof().arm.type === 'button' ? 'PRESS ARM' : 'ARM SWITCH')));
  $('#osdTimer').textContent = fmtT(flightTime);
  { const m = tune.flightMode || 'acro', el = $('#osdMode'); if (el) { el.textContent = m === '3d' ? 'METALCRAFT' : m.toUpperCase(); el.classList.toggle('metal', m === '3d'); el.classList.toggle('alt', m !== 'acro'); } }
  $('#sessionT').textContent = train.on ? 'TRAINING' : session ? fmtT(Math.max(0, session.timeLeft)) : 'FREE FLY';
  $('#washMeter').style.opacity = Math.min(1, drone.washLevel * 2);
}
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ============================================================ loop
let flightTime = 0, acc = 0, lastT = performance.now(), frames = 0, fpsT = 0;
const DT = 1 / 1000;
const tmpQ = new THREE.Quaternion(), tiltQ = new THREE.Quaternion();
const chasePos = new THREE.Vector3(0, 1, 14);
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (mode === 'fly') {
    const rc = getRC(dt); lastRC = rc;
    acc += dt; let n = 0;
    while (acc >= DT && n < 120) {
      const p0 = race.on ? { x: drone.pos.x, y: drone.pos.y, z: drone.pos.z } : null;
      drone.step(rc, DT); if (!race.on) { detector.update(drone, DT, rc); detector.postStep(drone); recordTrace(rc); } acc -= DT; n++;   // racing is about the track and the clock: no trick judging
      if (race.on) raceStep(p0, DT);
    }
    if (n >= 120) acc = 0;
    if (!race.on) for (const ev of detector.drain()) onTrick(ev);
    if (!race.on && detector.maybes && detector.maybes.length) for (const m of detector.drainMaybes()) { recapMaybe(m); if (mode === 'fly') flash(`<b>MAYBE: ${esc(m.name)}?</b><small>the trick library's guess · not scored · say yes or no in Review</small>`, 'near'); }
    if (combo.active && now / 1000 - combo.lastT > COMBO_IDLE && !detector.busy()) comboEnd(false);
    renderCombo();
    // Forgiving crashes: the pilot does not have to cycle the arm switch. After a crash, drop the throttle to zero and
    // the quad is righted and armed again (as long as the arm switch is still on / it was armed when it crashed).
    if (drone.crashed) { if (crashAt == null) { crashAt = now; crashLock = wasArmed; } else if (crashLock && now - crashAt > 350 && thrArmOk(lastRC.thr) && mode !== 'judge' && !race.on) { crashLock = false; setArmed(true); } }
    else { crashAt = null; wasArmed = drone.armed; }
    autoArmTick();
    if (drone.armed) flightTime += dt;
    if (session && session.started) { session.timeLeft -= dt; if (session.timeLeft <= 0) endSession(); }
    updateAudio(); hud(); passFeed(); stickHud(rc); if (race.on) raceHud();
  } else if (actx) for (const g of gains) g.gain.setTargetAtTime(0, actx.currentTime, 0.05);
  if (mode === 'judge') judgeStep(dt);
  if (mode === 'editor') { editorFrame(dt); return; }
  if (mode === 'bbreplay') brStep(dt);
  if (mode === 'recap') recapStep(dt);
  if (mode === 'fly' && warm.on) warmTick();
  if (race.on) raceVisuals(dt);
  if (mode === 'fly' || mode === 'paused') ghostStep(mode === 'fly' ? dt : 0);
  // drone visual
  droneMesh.position.set(drone.pos.x, drone.pos.y, drone.pos.z);
  droneMesh.quaternion.set(drone.q.x, drone.q.y, drone.q.z, drone.q.w);
  for (let i = 0; i < 4; i++) { const w = drone.motorW[i]; propGroups[i].rotation.y += params.motors[i].spin * Math.max(-0.9, Math.min(w * dt, 0.9)); propDiscs[i].material.opacity = Math.min(0.35, Math.abs(w) / params.stats.rpmMax * 2.4); propGroups[i].visible = w < 2500; }
  // cameras
  let cam;
  if (mode === 'menu') {
    const t = now / 1000 * 0.08; chaseCam.position.set(Math.sin(t) * 16, 5 + Math.sin(t * 1.7) * 1.5, Math.cos(t) * 16); chaseCam.lookAt(0, 1.5, -3); cam = chaseCam;
  } else if (mode === 'judge' && judge.cam === 'spectator' && judge.camPos) {
    // drag to orbit round the flight, wheel to zoom (double-click resets)
    const o = judge.orb || (judge.orb = { yaw: 0, pitch: 0, zoom: 1 }), C = judge.look, v = S.sub(judge.camPos, C), r = Math.hypot(v.x, v.y, v.z) * o.zoom;
    const yaw0 = Math.atan2(v.x, v.z) + o.yaw, pit = Math.max(-0.2, Math.min(1.45, Math.asin(Math.max(-1, Math.min(1, v.y / (Math.hypot(v.x, v.y, v.z) || 1)))) + o.pitch));
    cam = chaseCam; chaseCam.position.set(C.x + Math.sin(yaw0) * Math.cos(pit) * r, Math.max(0.15, C.y + Math.sin(pit) * r), C.z + Math.cos(yaw0) * Math.cos(pit) * r);
    const tgt = new THREE.Vector3(drone.pos.x, drone.pos.y, drone.pos.z); judge.lookS = judge.lookS ? judge.lookS.lerp(tgt, 1 - Math.exp(-dt * 5)) : tgt.clone();
    chaseCam.lookAt(judge.lookS);
  } else if ((mode === 'judge' ? judge.cam : camMode) === 'fpv') {
    cam = fpvCam; const cp = S.add(drone.pos, S.qrot(drone.q, params.camPos));
    fpvCam.position.set(cp.x, cp.y, cp.z);
    tmpQ.set(drone.q.x, drone.q.y, drone.q.z, drone.q.w); tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tune.camTilt * Math.PI / 180);
    fpvCam.quaternion.copy(tmpQ).multiply(tiltQ);
  } else {
    cam = chaseCam; const f = drone.fwd(); const fl = Math.hypot(f.x, f.z) || 1;
    const target = new THREE.Vector3(drone.pos.x - f.x / fl * 0.45, drone.pos.y + 0.16, drone.pos.z - f.z / fl * 0.45);
    chasePos.lerp(target, 1 - Math.exp(-dt * 6)); chaseCam.position.copy(chasePos); chaseCam.lookAt(drone.pos.x, drone.pos.y + 0.02, drone.pos.z);
  }
  if (mode === 'review') { reviewTick(); return; }
  renderer.render(scene, cam);
  if (BLOOM.on && world.theme === 'vapor' && !race.on) bloomRender(cam);
  if (mode === 'recap' && recap.rec) recapRecFrame();
  frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
}
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  for (const c of [fpvCam, chaseCam]) c.aspect = w / h;
  // convert horizontal FOV (camera spec) to vertical
  const hf = tune.camFov * Math.PI / 180; fpvCam.fov = 2 * Math.atan(Math.tan(hf / 2) / (w / h)) * 180 / Math.PI;
  fpvCam.fov = Math.min(fpvCam.fov, 125); fpvCam.updateProjectionMatrix(); chaseCam.updateProjectionMatrix();
}
addEventListener('resize', resize);

