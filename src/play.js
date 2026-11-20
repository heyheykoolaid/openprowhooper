// ============================================================ audio
let actx = null, osc = [], gains = [], noiseG = null, airG = null, airBp = null, crashAt = null, wasArmed = false;
function initAudio() {
  if (actx) return; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const master = actx.createGain(); master.gain.value = store.get('vol', 0.25); master.connect(actx.destination); window._master = master;
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
// The bodega cat (Slackvegan City): completely static, extremely judgmental. Touching it gets a meow and a little burst of
// "meow"s floating up; once a flight, a word from the cat. CAT.ids: the objects marked cat (rebuilt when the world is).
const CAT = { ids: new Set(), prims: null, last: -9, said: false, bursts: [], tex: null };
function catIdsFor() { if (CAT.prims !== world.prims) { CAT.prims = world.prims; CAT.ids = new Set(world.objs.filter(o => o.cat).map(o => o.id)); } }
function catMeow() {
  if (!actx) return; const t = actx.currentTime, f0 = 560 + Math.random() * 140, o = actx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.5, t + 0.16); o.frequency.linearRampToValueAtTime(f0 * 0.78, t + 0.55);
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5; bp.frequency.setValueAtTime(900, t); bp.frequency.linearRampToValueAtTime(1900, t + 0.18); bp.frequency.linearRampToValueAtTime(750, t + 0.55);
  const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.05); g.gain.setValueAtTime(0.9, t + 0.38); g.gain.linearRampToValueAtTime(0.0001, t + 0.62);
  o.connect(bp); bp.connect(g); g.connect(window._master); o.start(t); o.stop(t + 0.66); }
function catHit() {
  const now = performance.now() / 1000; if (now - CAT.last < 1.2) return; CAT.last = now;
  try { catMeow(); } catch {}
  const cat = world.objs.find(o => CAT.ids.has(o.id)), c = cat && cat.vis[0] && cat.vis[0].c; if (!c) return;
  if (!CAT.tex) { const [cv, g] = cnv(256, 96); g.font = "900 64px 'Comic Sans MS', 'Arial Black', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#1a1a1a'; g.strokeText('meow', 128, 50); g.fillStyle = '#fff6d8'; g.fillText('meow', 128, 50); CAT.tex = new THREE.CanvasTexture(cv); CAT.tex.colorSpace = THREE.SRGBColorSpace; }
  for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: CAT.tex, transparent: true, depthWrite: false, toneMapped: false })); const s = 0.35 + Math.random() * 0.3; sp.scale.set(s, s * 0.375, 1);
    sp.position.set(c.x, c.y + 0.4, c.z); scene.add(sp); CAT.bursts.push({ sp, v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 1.0 + Math.random() * 1.2, -Math.random() * 1.4), age: 0 }); }
  if (!CAT.said) { CAT.said = true; flash('<b>THE BODEGA CAT JUDGES YOU</b><small>spiritually costly</small>'); } }
function meowTick(dt) {
  catIdsFor();
  for (let i = CAT.bursts.length - 1; i >= 0; i--) { const b = CAT.bursts[i]; b.age += dt; b.sp.position.addScaledVector(b.v, dt); b.v.y -= 0.6 * dt; b.sp.material.opacity = Math.max(0, 1 - b.age / 1.4);
    if (b.age > 1.4) { scene.remove(b.sp); b.sp.material.dispose(); CAT.bursts.splice(i, 1); } } }
function updateAudio() {
  if (!actx) return;
  if (drone.crashed && !audioWasCrashed) { try { isRidgeRipper() ? crashFart() : crashThud(); } catch {} } audioWasCrashed = drone.crashed; const t = actx.currentTime; const blades = S.PARTS.props[spec.prop].blades;
  for (let i = 0; i < 4; i++) { const rpm = Math.abs(drone.motorW[i]) * 60 / (2 * Math.PI); osc[i].frequency.setTargetAtTime(Math.max(24, rpm / 60 * blades * 0.2 * (1 + (i - 1.5) * 0.012)), t, 0.015); gains[i].gain.setTargetAtTime(drone.armed ? 0.03 + 0.08 * Math.min(1, rpm / params.stats.rpmMax) : 0, t, 0.02); }
  { const m = (Math.abs(drone.motorW[0]) + Math.abs(drone.motorW[1]) + Math.abs(drone.motorW[2]) + Math.abs(drone.motorW[3])) / 4 * 60 / (2 * Math.PI), k = Math.min(1, m / params.stats.rpmMax); airBp.frequency.setTargetAtTime(350 + 900 * k, t, 0.04); airG.gain.setTargetAtTime(drone.armed ? 0.02 + 0.2 * k * k : 0, t, 0.04); }
  noiseG.gain.setTargetAtTime(Math.min(0.25, S.len(drone.vel) * 0.012 + drone.washLevel * 0.15), t, 0.05);
}

// ============================================================ HUD
const popups = $('#popups');
function flash(text, cls = '') { const el = document.createElement('div'); el.className = 'popup ' + cls; el.innerHTML = text; popups.prepend(el); setTimeout(() => el.classList.add('out'), 1900); setTimeout(() => el.remove(), 2600); while (popups.children.length > 2) popups.lastChild.remove(); /* two at a time: the column stays short */ }
// ---- combo (Tony Hawk style presentation; points follow the TPW calculator exactly)
// A combo runs while you keep doing tricks; it banks after COMBO_IDLE s with no trick or rotation; a crash bails it.
// Friendlier (owner, 2026-11-19): 3 s, not 2, and every pass over, under or through something (or past a pole) links the
// chain like a manual: the timer starts again (`comboLink`). A bar under the points shows the time left.
const COMBO_IDLE = 3.0, comboSeen = new WeakSet();
function comboLink(now) { let hit = false; for (const c of detector.crossLog) if (!comboSeen.has(c)) { comboSeen.add(c); hit = true; } for (const p of detector.passes || []) if (!comboSeen.has(p)) { comboSeen.add(p); hit = true; } if (hit && combo.active) combo.lastT = now; }
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
  combo.names = []; combo.pts = 0; combo.active = false; renderCombo(); if (score && score.chainBreak) score.chainBreak();
}
function renderCombo() {
  const el = $('#combo'); const prov = mode === 'fly' ? detector.provisional() : [], live = mode === 'fly' && detector.liveState ? detector.liveState() : [];
  if (!combo.active && !prov.length && !live.length) { el.classList.add('hide'); return; }
  el.classList.remove('hide');
  const liveTxt = l => l.laps !== undefined ? `<span class="live">${l.name.replace(' x2', '')} ×${l.laps}${l.counts ? ` <b>+${l.pts}</b>` : ''}</span>` : `<span class="live">${l.name} ${l.meters.toFixed(1)}m</span>`;
  const list = [...combo.names.map(n => `<span>${n}</span>`), ...prov.map(n => `<span class="prov">${n}…</span>`), ...live.map(liveTxt)];
  const livePts = live.reduce((a, l) => a + (l.counts ? l.pts : 0), 0);
  el.innerHTML = `<div class="cList">${list.slice(-7).join('<i>+</i>')}</div>${combo.active || livePts ? `<div class="cPts">${(combo.pts + livePts).toLocaleString()}<small> × streak ${score.streak.toFixed(2)}</small></div>` : ''}${combo.active ? `<div class="cTimer"><i style="width:${detector.busy() ? 100 : Math.max(0, Math.round(100 - (performance.now() / 1000 - combo.lastT) / COMBO_IDLE * 100))}%"></i></div>` : ''}`;
}
function onTrick(ev) {
  trainOnEvent(ev); recapEvent(ev); coachEvent(ev);
  if (ev.name === 'near') { flash(`<b>SO CLOSE</b><small>${ev.near}</small>`, 'near'); return; }
  const r = score.add(ev);
  if (ev.exec === 'CRASH') { comboEnd(true); flash(`<b>CRASH!</b><small>streak lost</small>`, 'crash'); updateBreakdown(); return; }
  if (!r) return;
  comboAdd(r);
  const mults = []; if (r.totwM > 1) mults.push(`TotW ×${r.totwM}`); if (r.repeatM < 1) mults.push(`repeat ×${r.repeatM}`); if (r.b2bM < 1) mults.push(`b2b ×${r.b2bM}`); if (r.obsM < 1) mults.push(`same obstacle ×${r.obsM}`); if (r.streakM > 1.0001) mults.push(`streak ×${r.streakM.toFixed(2)}`);
  flash(`<b>${r.name.toUpperCase()}</b>${r.draft ? '<small class="draftTag">new rule</small>' : ''}<div class="pRow"><span class="ex ${r.exec}">${r.exec}${r.clean !== undefined ? ' ' + r.clean + '%' : ''}</span><em>+${r.net}</em></div>${r.obstacle ? `<small>on ${r.obstacle}</small>` : ''}${mults.length ? `<small>${mults.join(' · ')}</small>` : ''}${r.kwadHit ? `<small class="kw">K.W.A.D. letter ${r.kwadHit}!</small>` : ''}`, r.exec);
  if (r.chainHit) { const c = r.chainHit; setTimeout(() => flash(`<b>${c.title}!!!</b><small>${c.n} in a row · +${c.pts.toLocaleString()} bonus</small>`, 'metal chainBonus'), 350); combo.pts += c.pts; renderCombo(); }
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
  $('#osdA').textContent = drone.ibat.toFixed(1) + 'A'; $('#osdMah').textContent = Math.round(drone.mAh) + 'mAh' + (tune.batteryLife === false ? ' ∞' : ' ' + Math.round(drone.soc * 100) + '%');
  // battery life: a warning near the end of the pack, and the brown-out when the AIO gives up (sim.js Drone.step)
  if (tune.batteryLife !== false) { if (drone.soc < 0.15 && !batWarn.low && drone.armed) { batWarn.low = true; flash('<b>LOW BATTERY</b><small>land soon · B for a fresh pack</small>', 'warn'); }
    if (drone.brownout && !batWarn.dead) { batWarn.dead = true; flash('<b>BATTERY DEAD</b><small>the flight controller browned out · B for a fresh pack</small>', 'warn'); if (typeof crashThud === 'function') crashThud(); } }
  if (!drone.brownout) batWarn.dead = false; if (drone.soc > 0.5) batWarn.low = false;
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
  { const m = drone.fc.modeOverride ? 'kb assist' : tune.flightMode || 'acro', el = $('#osdMode'); if (el) { el.textContent = m === '3d' ? 'METALCRAFT' : m.toUpperCase(); el.classList.toggle('metal', m === '3d'); el.classList.toggle('alt', m !== 'acro'); } }
  $('#sessionT').textContent = train.on ? 'TRAINING' : session ? fmtT(Math.max(0, session.timeLeft)) : 'FREE FLY';
  $('#washMeter').style.opacity = Math.min(1, drone.washLevel * 2);
}
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ============================================================ loop
let flightTime = 0, acc = 0, lastT = performance.now(), frames = 0, fpsT = 0;
const DT = 1 / 1000;
const tmpQ = new THREE.Quaternion(), tiltQ = new THREE.Quaternion();
const chasePos = new THREE.Vector3(0, 1, 14);
// Map lights on auto: measure 4 s of flying (after 2 s to settle); under 50 fps with more than 4 lamps → few, once, and say so
const LA = { t: 0, n: 0 };
function lightsAuto(dt) {
  if (PERF.lights !== 'auto' || PERF.lightsAuto || mode !== 'fly' || !drone.armed) return;
  if (!world.objs.filter(o => o.light).length || world.objs.filter(o => o.light).length <= 4) { PERF.lightsAuto = 'full'; return; }
  const now = performance.now() / 1000; if (!LA.t0) LA.t0 = now; LA.t = now - LA.t0;   /* real time: dt is capped at 0.1 s a frame */
  if (LA.t < 2) return; LA.n++; if (LA.t < 6) return;
  const fps = LA.n / (LA.t - 2); PERF.lightsAuto = fps < 50 ? 'few' : 'full';
  if (PERF.lightsAuto === 'few') { mapLightsBuild(); flash(`<b>LIGHTING REDUCED</b><small>${Math.round(fps)} fps here · Options → Graphics → Map lights</small>`, 'warn'); }
}
const buzzE = new THREE.Euler(), buzzQ = new THREE.Quaternion(), buzzS = { x: 0, y: 0 };
// Input lag on low-end machines (2026-11-19: "fps looked fine, the controls felt sluggish"): the trick detector used to run
// inside the physics loop, before the frame was drawn, so every millisecond it took (4 ms a frame on Moose on a fast PC,
// several times that on a slow one) came between reading the sticks and the picture. Now the physics runs first, the frame
// is drawn and handed to the GPU, and only then does the detector judge the same physics steps, one by one, from a
// snapshot of each (the Drone replaces pos / vel / q / w every step, so a snapshot holds them by reference). The calls are
// identical; trick pop-ups come one frame later. Arming while steps wait (`detArm`) is queued in its place too.
const detQ = [];
function detSnap(d, rc) { const s = Object.create(S.Drone.prototype);
  s.pos = d.pos; s.vel = d.vel; s.q = d.q; s.w = d.w; s.time = d.time; s.soc = d.soc; s.armed = d.armed; s.crashed = d.crashed;
  s.contactThisStep = d.contactThisStep; s.contactNormal = d.contactNormal && { x: d.contactNormal.x, y: d.contactNormal.y, z: d.contactNormal.z }; s.contactOwner = d.contactOwner; s.contactGround = d.contactGround; s.lastImpact = d.lastImpact;
  s.rc = rc; return s; }
function detArm(on) { if (detQ.length) detQ.push({ arm: on, s: detSnap(drone, lastRC) }); else detector.onArmChange(drone, on); }
// The trick detector on its own core (2026-11-20, owner: "where we need to go next"; `DW`): when the browser allows it, the
// detector runs in a Web Worker built from the page's own sim.js and tricks.js, on a copy of the world. The main thread only
// posts each frame's step snapshots (and arm changes, resets, the camera tilt, the pilot's profile, a rebuilt world) and
// reads back what the game shows: calls, maybes, busy, the passes and crossings for the "what counted" list and combo timer,
// pending and live tricks, the clock, and (for the Warm-up and Trick Calibration) tokens and debug rows. The local detector
// object stays the one every other file talks to: its methods are routed to the worker. The same code on the same steps
// makes the same calls; the replies arrive a frame or two later. Any failure falls back to the old in-page detector
// (`store 'detWorker'` false turns the worker off; F3 shows which is running).
const DW = { on: false, dead: false, w: null, events: [], maybes: [], busy: false, prov: [], live: [], cross: [], passes: [], sentWorld: null, sentV: -1, pending: 0, wantDbg: false };
function dwStart() {
  if (DW.on || DW.dead || !store.get('detWorker', true) || typeof Worker === 'undefined') return;
  try {
    const src = k => { for (const sc of document.scripts) { const t = sc.textContent || ''; if (t.startsWith(k)) return t; } return null; };
    const tr = src('// Trick values'), sm = src('// Pro Whooper — simulation core'); if (!tr || !sm) return;
    const body = `;(function(){ const S = self.Sim; let det = null; const sent = new WeakSet(); const DTS = ${DT};
  const fresh = (arr, max) => { const out = []; for (const x of arr || []) if (!sent.has(x)) { sent.add(x); out.push(x); } return out.slice(-max); };
  const plain = x => { try { return structuredClone(x); } catch (e) { return JSON.parse(JSON.stringify(x, (k, v) => typeof v === 'function' ? undefined : v)); } };
  const rehydrate = s => Object.setPrototypeOf(s, S.Drone.prototype);
  self.onmessage = e => { const m = e.data;
    if (m.t === 'init') { if (m.community) S.setCommunity(m.community); if (m.library) S.setLibrary(m.library); det = new S.TrickDetector(m.world); det.camTilt = m.camTilt; if (m.pilot) det.setPilot(m.pilot); return; }
    if (!det) return;
    if (m.t === 'world') { det.world = m.world; det.reset(); return; }
    if (m.t === 'reset') { det.reset(); return; }
    if (m.t === 'camTilt') { det.camTilt = m.v; return; }
    if (m.t === 'pilot') { det.setPilot(m.p); return; }
    if (m.t === 'debug') { det.debug = m.v; return; }
    if (m.t === 'steps') { if (m.want && !Array.isArray(det.debug)) det.debug = []; for (const s of m.items) { if (s.arm !== undefined) { det.onArmChange(rehydrate(s.s), s.arm); continue; } rehydrate(s); det.update(s, DTS, s.rc); det.postStep(s); }
      const r = { t: 'out', events: det.drain(), maybes: det.drainMaybes ? det.drainMaybes() : [], busy: det.busy(), time: det.time, prov: det.provisional(), live: det.liveState ? det.liveState() : [],
        cross: fresh(det.crossLog, 40), passes: fresh(det.passes, 40) };
      if (m.want) { r.toks = (det.toks || []).slice(-40); r.cur = (det.cur || []).filter(Boolean); r.debug = (det.debug || []).slice(-8); }
      self.postMessage(plain(r)); } };
})();`;
    const url = URL.createObjectURL(new Blob([tr, '\n', sm, '\n', body], { type: 'text/javascript' }));
    DW.w = new Worker(url); URL.revokeObjectURL(url);
    DW.w.onmessage = e => { const r = e.data; if (!r || r.t !== 'out') return; DW.pending = Math.max(0, DW.pending - 1);
      DW.events.push(...r.events); if (DW.workerEv) for (const x of r.events) DW.workerEv.push(x.name + '@' + x.t.toFixed(3)); DW.maybes.push(...r.maybes); DW.busy = r.busy; DW.prov = r.prov; DW.live = r.live; detector.time = r.time;
      for (const c of r.cross) DW.cross.push(c); for (const p of r.passes) DW.passes.push(p); if (DW.cross.length > 80) DW.cross.splice(0, DW.cross.length - 60); if (DW.passes.length > 80) DW.passes.splice(0, DW.passes.length - 60);
      if (r.toks) { detector.toks = r.toks; detector.cur = r.cur; detector.debug = r.debug; } };
    DW.w.onerror = err => { console.warn('trick detector worker failed, back to the page:', err && err.message); dwStop(true); };
    const D = detector, orig = { reset: D.reset.bind(D), setPilot: D.setPilot.bind(D) };
    DW.orig = orig; let tilt = D.camTilt, wld = D.world;
    DW.w.postMessage({ t: 'init', world: wld, camTilt: tilt, community: S.community || null, library: S.library || null, pilot: store.get('pilot', null) }); DW.sentWorld = wld; DW.sentV = wld.__v || 0;
    Object.defineProperty(D, 'camTilt', { configurable: true, get: () => tilt, set: v => { tilt = v; if (DW.on) DW.w.postMessage({ t: 'camTilt', v }); } });
    Object.defineProperty(D, 'world', { configurable: true, get: () => wld, set: v => { wld = v; } });
    D.reset = () => { orig.reset(); detQ.length = 0; DW.events.length = 0; DW.maybes.length = 0; DW.busy = false; DW.prov = []; DW.live = []; DW.cross.length = 0; DW.passes.length = 0; D.crossLog = DW.cross; D.passes = DW.passes;   // reset() gives the page copy fresh arrays: point them at the worker's mirror again (the 'what counted' list and combo timer went quiet after the first reset)
      if (DW.on) { if (DW.sentWorld !== wld || DW.sentV !== (wld.__v || 0)) { DW.w.postMessage({ t: 'world', world: wld }); DW.sentWorld = wld; DW.sentV = wld.__v || 0; } else DW.w.postMessage({ t: 'reset' }); } };
    D.setPilot = p => { const r = orig.setPilot(p); if (DW.on) DW.w.postMessage({ t: 'pilot', p }); return r; };
    D.onArmChange = (d, on) => { if (DW.on) DW.w.postMessage({ t: 'steps', items: [{ arm: on, s: detSnap(d, lastRC) }], want: DW.wantDbg }); };
    D.drain = () => DW.events.splice(0); D.drainMaybes = () => DW.maybes.splice(0); D.busy = () => DW.busy; D.provisional = () => DW.prov; D.liveState = () => DW.live;
    D.crossLog = DW.cross; D.passes = DW.passes; Object.defineProperty(D, 'maybes', { configurable: true, get: () => DW.maybes, set: () => {} });
    DW.on = true;
  } catch (err) { console.warn('trick detector worker not available:', err && err.message); dwStop(true); }
}
// tests: window.__pwDW.shadowOn() runs an in-page copy alongside to compare the calls
window.__pwDW = { DW, feed: snaps => { for (const x of snaps) { Object.setPrototypeOf(x, S.Drone.prototype); detQ.push(x); } detFlush(performance.now()); }, shadowOn: () => { DW.shadow = new S.TrickDetector(world); DW.shadow.camTilt = detector.camTilt; DW.shadow.setPilot(store.get('pilot', null)); DW.shadowEv = []; DW.workerEv = []; } };
setTimeout(dwStart, 0);
function dwStop(dead) { if (DW.w) try { DW.w.terminate(); } catch { /* gone already */ } DW.w = null; DW.dead = DW.dead || dead; if (!DW.on) return; DW.on = false;
  // back to the page's own detector: the routed methods go back to the class's own, from a clean start
  const D = detector; for (const k of ['reset', 'setPilot', 'onArmChange', 'drain', 'drainMaybes', 'busy', 'provisional', 'liveState']) delete D[k];
  for (const k of ['camTilt', 'world', 'maybes']) { const v = D[k]; delete D[k]; D[k] = k === 'maybes' ? [] : v; }
  D.crossLog = []; D.passes = []; D.reset(); }
function detFlush(now) {
  if (detQ.length && DW.on) { const items = detQ.splice(0); for (const s of items) if (s.contactNormal === null) delete s.contactNormal;
    DW.wantDbg = !!((typeof train !== 'undefined' && train.on) || (typeof warm !== 'undefined' && warm.on) || (typeof coach !== 'undefined' && coach.on)); DW.pending++; DW.w.postMessage({ t: 'steps', items, want: DW.wantDbg });
    if (DW.shadow) for (const s of items) { if (s.arm !== undefined) DW.shadow.onArmChange(s.s, s.arm); else { DW.shadow.update(s, DT, s.rc); DW.shadow.postStep(s); } for (const e of DW.shadow.drain()) DW.shadowEv.push(e.name + '@' + e.t.toFixed(3)); } }   // test hook: the same steps in the page too
  if (detQ.length) { for (const s of detQ) { if (s.arm !== undefined) { detector.onArmChange(s.s, s.arm); continue; } detector.update(s, DT, s.rc); detector.postStep(s); } detQ.length = 0; }
  if (mode !== 'fly' || race.on) return;
  for (const ev of detector.drain()) onTrick(ev);
  if (detector.maybes && detector.maybes.length) for (const m of detector.drainMaybes()) { recapMaybe(m); if (store.get('maybeFlash', false)) flash(`<b>MAYBE: ${esc(m.name)}?</b><small>the trick library's guess · not scored · say yes or no in SKITTLES mode</small>`, 'near'); }
  comboLink(now / 1000);
  if (combo.active && now / 1000 - combo.lastT > COMBO_IDLE && !detector.busy()) comboEnd(false);
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; lightsAuto(dt); gfxOffer(); resAutoTick(); const pf = PERF.on, fT0 = pf ? performance.now() : 0; let tPh = 0, tDe = 0, tR = 0;
  if (pf) renderer.info.autoReset = false, renderer.info.reset();
  if (mode === 'fly') {
    const rc = getRC(dt); lastRC = rc;
    const cts = coachTimeScale(dt); if (coachFrozen()) acc = 0; else acc += dt * cts; let n = 0;   // Train's pauses between steps ease in and out; stopped, nothing moves, nothing is judged or recorded
    while (acc >= DT && n < 120) {
      const p0 = race.on ? { x: drone.pos.x, y: drone.pos.y, z: drone.pos.z } : null;
      if (pf) { const a = performance.now(); drone.step(rc, DT); tPh += performance.now() - a; }
      else drone.step(rc, DT);
      if (!race.on) { detQ.push(detSnap(drone, rc)); recordTrace(rc); }   // judged after the frame is drawn (detFlush)
      if (drone.contactThisStep && CAT.ids.has(drone.contactOwner)) catHit();   // Slackvegan's bodega cat
      acc -= DT; n++;   // racing is about the track and the clock: no trick judging
      if (race.on) raceStep(p0, DT);
    }
    if (n >= 120) { acc = 0; if (pf) PERF.acc.drop = (PERF.acc.drop || 0) + 1; } if (pf) PERF.acc.steps += n; if (coach.on) coachLive(n * DT);   // Train: pause as a step's rotation comes round
    renderCombo();
    // Forgiving crashes: the pilot does not have to cycle the arm switch. After a crash, drop the throttle to zero and
    // the quad is righted and armed again (as long as the arm switch is still on / it was armed when it crashed).
    if (drone.crashed) { if (crashAt == null) { crashAt = now; crashLock = wasArmed; } else if (crashLock && now - crashAt > 350 && thrArmOk(lastRC.thr) && mode !== 'judge' && !race.on) { crashLock = false; setArmed(true); } }
    else { crashAt = null; wasArmed = drone.armed; }
    autoArmTick();
    if (drone.armed) flightTime += dt;
    if (session && session.started) { session.timeLeft -= dt; if (session.timeLeft <= 0) { detFlush(now); endSession(); } }
    updateAudio(); hud(); passFeed(); stickHud(rc); if (race.on) raceHud();
  } else if (actx) for (const g of gains) g.gain.setTargetAtTime(0, actx.currentTime, 0.05);
  if (mode === 'judge') judgeStep(dt);
  if (mode !== 'fly') detFlush(now);
  if (mode === 'editor') { editorFrame(dt); return; }
  if (mode === 'mapedit') { mapEditFrame(dt); return; }
  if (mode === 'bbreplay') brStep(dt);
  if (mode === 'recap') recapStep(dt);
  if (mode === 'fly' && warm.on) warmTick();
  if (race.on) raceVisuals(dt);
  if (mode === 'fly' || mode === 'paused') ghostStep(mode === 'fly' ? dt : 0);
  // drone visual
  droneMesh.position.set(drone.pos.x, drone.pos.y, drone.pos.z);
  droneMesh.quaternion.set(drone.q.x, drone.q.y, drone.q.z, drone.q.w);
  droneMesh.scale.setScalar(mode === 'judge' && judge.cam !== 'fpv' ? 2.5 : 1);
  droneMesh.visible = showFrame || mode === 'menu' || (mode === 'judge' ? judge.cam : camMode) !== 'fpv';   // H / Garage: hide the frame in the FPV view   // big only for Judge the Bot's spectator view; real size everywhere else
  for (let i = 0; i < 4; i++) { const w = drone.motorW[i]; propGroups[i].rotation.y += params.motors[i].spin * Math.max(-0.9, Math.min(w * dt, 0.9)); propDiscs[i].material.opacity = Math.min(0.35, Math.abs(w) / params.stats.rpmMax * 2.4); propGroups[i].visible = w < 2500; }
  // cameras
  let cam;
  if (mode === 'menu') {
    const t = now / 1000 * 0.08, V = window.__pwView;   // __pwView {p, l}: a fixed camera for tools/map_thumbs.py
    if (V) { chaseCam.position.set(V.p[0], V.p[1], V.p[2]); chaseCam.lookAt(V.l[0], V.l[1], V.l[2]); } else { chaseCam.position.set(Math.sin(t) * 16, 5 + Math.sin(t * 1.7) * 1.5, Math.cos(t) * 16); chaseCam.lookAt(0, 1.5, -3); } cam = chaseCam;
  } else if (mode === 'judge' && judge.cam === 'spectator' && judge.camPos) {
    // drag to orbit round the flight, wheel to zoom (double-click resets)
    const o = judge.orb || (judge.orb = { yaw: 0, pitch: 0, zoom: 1 }), C = judge.look, v = S.sub(judge.camPos, C), r = Math.hypot(v.x, v.y, v.z) * o.zoom;
    const yaw0 = Math.atan2(v.x, v.z) + o.yaw, pit = Math.max(-0.2, Math.min(1.45, Math.asin(Math.max(-1, Math.min(1, v.y / (Math.hypot(v.x, v.y, v.z) || 1)))) + o.pitch));
    cam = chaseCam; chaseCam.position.set(C.x + Math.sin(yaw0) * Math.cos(pit) * r, Math.max(0.15, C.y + Math.sin(pit) * r), C.z + Math.cos(yaw0) * Math.cos(pit) * r);
    const tgt = new THREE.Vector3(drone.pos.x, drone.pos.y, drone.pos.z); judge.lookS = judge.lookS ? judge.lookS.lerp(tgt, 1 - Math.exp(-dt * 5)) : tgt.clone();
    chaseCam.lookAt(judge.lookS);
  } else if ((mode === 'judge' ? judge.cam : camMode) === 'fpv') {
    cam = fpvCam; const cp = S.add(drone.pos, S.qrot(drone.q, droneLens || params.camPos));
    fpvCam.position.set(cp.x, cp.y, cp.z);
    tmpQ.set(drone.q.x, drone.q.y, drone.q.z, drone.q.w); tiltQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tune.camTilt * Math.PI / 180);
    fpvCam.quaternion.copy(tmpQ).multiply(tiltQ);
    // the fine buzz a real FPV picture has (frame and motor vibration, 40 Hz and up in the owner's logs): seen, not flown
    if ((tune.camBuzz ?? 0) > 0 && drone.armed && !drone.crashed && mode === 'fly') { const load = Math.min(2, drone.thrust.reduce((a, b) => a + Math.abs(b), 0) / (params.mass * 9.81)), A = tune.camBuzz * 0.0012 * (0.25 + load), s = 0.35;   // smoothed, so it hums rather than jitters
      buzzS.x += ((Math.random() - 0.5) * A - buzzS.x) * s; buzzS.y += ((Math.random() - 0.5) * A - buzzS.y) * s; buzzE.set(buzzS.x, buzzS.y, 0); fpvCam.quaternion.multiply(buzzQ.setFromEuler(buzzE)); }
  } else {
    cam = chaseCam; const f = drone.fwd(); const fl = Math.hypot(f.x, f.z) || 1;
    const target = new THREE.Vector3(drone.pos.x - f.x / fl * 0.45, drone.pos.y + 0.16, drone.pos.z - f.z / fl * 0.45);
    chasePos.lerp(target, 1 - Math.exp(-dt * 6)); chaseCam.position.copy(chasePos); chaseCam.lookAt(drone.pos.x, drone.pos.y + 0.02, drone.pos.z);
  }
  if (mode === 'review') { reviewTick(); return; }
  const rT0 = pf ? performance.now() : 0;
  if (world.theme === 'vice') viceTick(Math.min(0.1, dt || 0.016), drone.pos);
  if (world.theme === 'dusk') duskTick(Math.min(0.1, dt || 0.016));
  if (world.theme === 'nyc') nycTick(Math.min(0.1, dt || 0.016));
  meowTick(Math.min(0.1, dt || 0.016));
  renderer.render(scene, cam);
  if (BLOOM.on && (race.on || world.theme === 'vapor' || world.theme === 'vice' || world.theme === 'dusk' || world.theme === 'nyc')) bloomRender(cam);   // racing: the gates' LEDs glow
  if (PERF.fx) fxRender();
  if (pf) tR = performance.now() - rT0;
  if (detQ.length) { const a = pf ? performance.now() : 0; detFlush(now); if (pf) tDe += performance.now() - a; }
  if (pf) perfFrame(now, fT0, tPh, tDe, tR);
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


// ---- the diagnostic overlay (PERF in game.js). Times are this tab's main-thread CPU per frame: physics (1 kHz steps),
// trick detection (detector, Watcher, library), drawing (three.js submitting the scene; the GPU's own work is not
// counted), and everything else (HUD, audio, menus). Shown 4 times a second, averaged over that window.
function perfFrame(now, fT0, tPh, tDe, tR) {
  const A = PERF.acc, ft = performance.now() - fT0; A.phys += tPh; A.det += tDe; A.rend += tR; A.frame += ft; A.n++; A.worst = Math.max(A.worst, ft);
  A.calls = (A.calls || 0) + renderer.info.render.calls; A.tris = (A.tris || 0) + renderer.info.render.triangles; A.gap = Math.max(A.gap || 0, now - (A.last || now)); A.last = now;
  if (now - PERF.shown < 250) return; const n = Math.max(1, A.n), secs = (now - PERF.shown) / 1000; PERF.shown = now; if (secs > 2) { Object.assign(A, { phys: 0, det: 0, rend: 0, frame: 0, n: 0, worst: 0, steps: 0, calls: 0, tris: 0, gap: 0, drop: 0 }); return; }
  const el = $('#perfHud'); if (!el) return; const f = x => (x / n).toFixed(2), mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : '—', fps = n / secs, busy = A.frame / (secs * 1000) * 100;
  const pr = renderer.getPixelRatio(), cv = renderer.domElement, info = renderer.info.memory;
  el.innerHTML = `<b>${fps.toFixed(0)} fps</b> · frame CPU ${f(A.frame)} ms (worst ${A.worst.toFixed(1)}) · main thread ${busy.toFixed(0)}% busy
    <br>physics ${f(A.phys)} ms (${(A.steps / n).toFixed(0)} steps)${A.drop ? ` · <span class="bad">${A.drop} catch-up drops</span>` : ''} · tricks ${f(A.det)} ms${DW.on ? ' (own core)' : ''} · draw ${f(A.rend)} ms · other ${f(A.frame - A.phys - A.det - A.rend)} ms
    <br>${Math.round(A.calls / n)} draw calls · ${(A.tris / n / 1000).toFixed(0)}k triangles · ${info.geometries} geometries · ${info.textures} textures · longest gap ${A.gap.toFixed(0)} ms
    <br>${cv.width}×${cv.height} px (×${pr.toFixed(2)}) · shadows ${renderer.shadowMap.enabled ? 'on' : 'off'} · screen fx ${PERF.fx ? 'on' : 'off'} · ${document.fullscreenElement || (innerWidth === screen.width && innerHeight === screen.height) ? 'fullscreen' : 'windowed'} ${screen.width}×${screen.height} · neon glow ${BLOOM.on && world.theme === 'vapor' ? 'on' : 'off'} · scenery ${PERF.staticPieces} pieces in ${PERF.staticMeshes} meshes
    <br>GPU ${esc(GPU || 'unknown')}${GPU_SOFT ? ' · <span class="bad">SOFTWARE: the browser\'s hardware acceleration is off</span>' : ''} · resolution ${PERF.resAuto ? 'auto ' : ''}${Math.round(PERF.res * 100)}%
    <br>${esc(world.title || world.id || '')} · ${world.objs.length} objects · ${world.prims.length} colliders · JS heap ${mem} · mode ${esc(mode)}`;
  Object.assign(A, { phys: 0, det: 0, rend: 0, frame: 0, n: 0, worst: 0, steps: 0, calls: 0, tris: 0, gap: 0, drop: 0 });
}
// Auto resolution (Options → Graphics → Render resolution → Auto): every 2 s of flying, under 50 fps steps it down by 10 %
// (to 50 % at least), over 58 fps steps it back up by 5 % (to 100 %): sharp when the machine keeps up, smooth when not
const RA = { t0: 0, n: 0 };
function resAutoTick() { if (!PERF.resAuto || mode !== 'fly') { RA.t0 = 0; return; } const now = performance.now(); if (!RA.t0) { RA.t0 = now; RA.n = 0; return; } RA.n++;
  if (now - RA.t0 < 2000) return; const fps = RA.n * 1000 / (now - RA.t0); RA.t0 = now; RA.n = 0; let r = PERF.res;
  if (fps < 50 && r > 0.5) r = Math.max(0.5, r - 0.1); else if (fps > 58 && r < 1) r = Math.min(1, r + 0.05); if (r !== PERF.res) { PERF.res = +r.toFixed(2); perfApply(); } }
function perfToggle(on) { PERF.on = on; store.set('perfHud', on); renderer.info.autoReset = !on; $('#perfHud').classList.toggle('hide', !on); PERF.shown = performance.now(); }
// one-click presets (2026-11-19, before sharing widely): new players on older laptops judge the game by its frame rate.
// The first flight offers Low once if it runs under 45 fps (`gfxOffer`, store 'gfxAsked'); Options → Graphics has both.
function gfxPreset(kind) {
  const low = kind === 'low';
  PERF.shadows = !low; store.set('shadows', PERF.shadows); BLOOM.on = !low; store.set('bloom', BLOOM.on); PERF.fx = !low; store.set('screenFx', PERF.fx);
  PERF.lights = low ? 'few' : 'auto'; store.set('mapLights', PERF.lights); PERF.lightsAuto = null; LA.t = 0; LA.t0 = 0; LA.n = 0; mapLightsBuild();
  PERF.resAuto = !low; PERF.res = low ? 0.7 : 1; store.set('renderScale', low ? 0.7 : 'auto'); store.set('gfxAsked', true); perfApply();
  flash(low ? '<b>LOW GRAPHICS</b><small>Options → Graphics to change it back</small>' : '<b>NORMAL GRAPHICS</b>', 'near');
}
const GO = { t0: 0, n: 0, done: store.get('gfxAsked', false) };
function gfxOffer() {
  if (GO.done || mode !== 'fly' || !drone.armed) return;
  const now = performance.now() / 1000; if (!GO.t0) GO.t0 = now; const t = now - GO.t0; if (t < 3) return; GO.n++; if (t < 8) return;
  GO.done = true; const fps = GO.n / (t - 3); if (fps >= 45 || !PERF.shadows) { if (fps >= 45) store.set('gfxAsked', true); return; }
  store.set('gfxAsked', true); const el = $('#gfxOffer'); if (!el) return;
  el.innerHTML = `<b>Running slowly?</b> ${Math.round(fps)} fps here. Low graphics turns off shadows, glow and screen effects for a smoother flight. <span class="row"><button data-gfx="low" class="primary">Use low graphics</button><button data-gfx="keep" class="ghost">Keep as is</button></span>`;
  el.classList.remove('hide');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-gfx]'); if (!b) return; const k = b.dataset.gfx; const el = $('#gfxOffer'); if (el) el.classList.add('hide');
  if (k === 'low' || k === 'normal') { gfxPreset(k); if (!$('#optionsScreen').classList.contains('hide')) openOptions(); } });
function perfApply() {   // render resolution and shadows, live
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * PERF.res); resize();
  if (renderer.shadowMap.enabled !== PERF.shadows) { renderer.shadowMap.enabled = PERF.shadows; scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
}
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); perfToggle(!PERF.on); } });
setTimeout(() => { $('#perfHud').classList.toggle('hide', !PERF.on); renderer.info.autoReset = !PERF.on; }, 0);

// ---- screen effects: the vignette and faint scanlines, drawn by the GPU as one transparent quad over the finished frame.
// They used to be CSS layers over the canvas (plus a CSS contrast/saturation filter on it), which the browser had to
// composite at full screen resolution every frame: pilots saw it most in fullscreen, and the fps counter could not see it.
const FX = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
FX.mat = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: { res: { value: new THREE.Vector2(1, 1) }, pr: { value: 1 } },
  vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform vec2 res; uniform float pr;
    void main() { vec2 uv = gl_FragCoord.xy / res, d = (uv - 0.5) * vec2(res.x / res.y, 1.0) / vec2(res.x / res.y * 0.5, 0.5) * 0.7071;
      float vig = smoothstep(0.55, 1.0, length(d)) * 0.55, scan = mod(floor(gl_FragCoord.y / pr), 3.0) < 1.0 ? 0.045 : 0.0;
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - (1.0 - vig) * (1.0 - scan)); }` });
FX.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), FX.mat));
function fxRender() { const c = renderer.domElement; FX.mat.uniforms.res.value.set(c.width, c.height); FX.mat.uniforms.pr.value = renderer.getPixelRatio(); const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(FX.scene, FX.cam); renderer.autoClear = ac; }
