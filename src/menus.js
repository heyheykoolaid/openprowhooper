// ============================================================ menus
// Maps: the choice is remembered and the page reloads into it. Trick Calibration and Judge the Bot name specific
// playground objects, so they stay on the playground.
function needPlayground(what) { if (MAP_ID === 'playground') return false; flash(`<b>${what.toUpperCase()} RUNS ON THE PLAYGROUND</b><small>press Map on the main menu to switch</small>`, 'warn'); return true; }
function menuMapLabels() { const m = $('#menuMap'); if (m) m.textContent = world.title; }
function openMaps() {
  show('#mapScreen'); if (mode === 'fly') { mode = 'paused'; }
  $('#mapList').innerHTML = Object.values(S.MAPS).map(m => `<div class="mapCard ${m.id === MAP_ID ? 'cur' : ''}"><div><b>${esc(m.title)}</b><small>${esc(m.blurb || '')}</small>${m.id === MAP_ID && world.survey ? `<small>The game found ${world.survey.overUnders} things to go over and under, ${world.survey.gaps} gaps, ${world.survey.poles} poles and ${world.survey.walls} walls here.</small>` : ''}</div>${m.id === MAP_ID ? '<span class="note">you are here</span>' : `<button data-mapid="${m.id}" class="primary">Fly here</button>`}</div>`).join('');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-mapid]'); if (!b || !S.MAPS[b.dataset.mapid]) return; const next = b.dataset.mapid;
  store.set('map', next); procFlight(telCapture('map'), () => { $('#loading').textContent = 'Loading ' + S.MAPS[next].title + '…'; show('#loading'); setTimeout(() => location.reload(), 350); }); });
setTimeout(menuMapLabels, 0);
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.add('hide'); if (id) $(id).classList.remove('hide'); }
// a shared flight is packed and sent BEFORE the next one starts (no stutter in the air)
function startFly(withSession) { const job = telCapture('restart'); if (job) procFlight(job, () => startFlyGo(withSession)); else startFlyGo(withSession); }
function startFlyGo(withSession) {
  combo.names = []; combo.pts = 0; combo.active = false;
  initAudio(); if (actx && actx.state === 'suspended') actx.resume();
  if (race.on || activeWorld !== world) raceOff(); score = new S.ScoreKeeper(); detector.reset(); drone.reset(world.spawn); flightTime = 0; updateBreakdown();
  session = withSession ? { timeLeft: 120, started: false } : null;
  recapReset(); if (warm.on) stopWarmup();
  mode = 'fly'; show(null); $('#hud').classList.remove('hide'); camMode = 'fpv'; resize();
  flash(withSession ? `<b>2:00 SESSION</b><small>timer starts when you ${autoArmOn() ? 'take off' : 'arm'}</small>` : `<b>FREE FLY</b><small>${autoArmOn() ? 'throttle up to take off' : 'Space / arm switch to arm'}</small>`);
}
function pause() { mode = 'paused'; show('#pause'); }
function resume() { mode = 'fly'; show(null); lastT = performance.now(); }
function endSession() {
  mode = 'paused'; drone.armed = false; const r = score;
  const best = store.get('best', 0); if (r.total > best) store.set('best', r.total);
  $('#results').innerHTML = `<h2>SESSION OVER</h2><div class="big">${r.total.toLocaleString()}</div>
    <p>Trick score ${r.trickScore.toLocaleString()} × switch ${r.switchMult()} + K.W.A.D. ${r.kwadBonus}</p>
    <p>Biggest trick: <b>${r.biggest ? r.biggest.name + ' (' + r.biggest.net + ')' : '—'}</b> · Max streak ×${r.maxStreak.toFixed(2)} · Obstacles ${r.uniqueObs.size}</p>
    <p>Personal best: <b>${Math.max(best, r.total).toLocaleString()}</b></p>
    <ol>${r.log.filter(x => x.net || x.exec === 'CRASH').map(x => `<li>${x.name} <span class="${x.exec}">${x.exec}</span> +${x.net}</li>`).join('')}</ol>
    <div class="row"><button data-act="session">Run it back</button><button data-act="recap" class="primary">Replay &amp; review</button><button data-act="menu">Menu</button></div><div id="lbBox"></div>`;
  show('#resultsScreen'); lbSessionOver(r); procFlight(telCapture('session-over'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'free' || a === 'session') { train.on = false; renderTrain(); if (typeof ask !== 'undefined') { ask.pending = []; } }
  if ((a === 'free' || a === 'session') && mode === 'judge') stopJudge();
  if (a === 'free') startFly(false); if (a === 'session') startFly(true);
  if (a === 'garage') openGarage(); if (a === 'controls') openControls(); if (a === 'tricks') openTricks();
  if (a === 'resume') resume(); if (a === 'menu') { procFlight(telCapture('menu')); if (race.on || activeWorld !== world) raceOff(); if (mode === 'editor') editorClose(); if (warm.on) stopWarmup(); if (mode === 'recap') { recapSave(); recap.play = null; $('#recapUI').classList.add('hide'); document.body.classList.remove('bbr'); drone.reset(world.spawn); } if (mode === 'bbreplay') { $('#bbrUI').classList.add('hide'); document.body.classList.remove('bbr'); br.playing = false; drone.reset(world.spawn); } if (mode === 'review') $('#rvVideo').pause(); if (mode === 'judge') stopJudge(); ghostOff(); train.on = false; renderTrain(); mode = 'menu'; drone.armed = false; $('#hud').classList.add('hide'); show('#mainMenu'); }
  if (a === 'back') { show(mode === 'menu' ? '#mainMenu' : '#pause'); }
  if (a === 'blackbox') show('#bbScreen');
  if (a === 'judge') { if (needPlayground('Judge the Bot')) return; startJudge(); }
  if (a === 'map') openMaps(); if (a === 'tools') show('#toolsScreen');
  if (a === 'race') openRaceMenu();
});

// ---------------- garage
function opt(obj, sel) { return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.name}</option>`).join(''); }
function openGarage() { show('#garage'); renderGarage(); }
function renderGarage() {
  const P = S.PARTS, st = params.stats, hv = S.hoverInfo(params);
  const PARTK = ['frame', 'motor', 'prop', 'battery', 'electronics'], sameParts = (a, b) => PARTK.every(k => a[k] === b[k]);
  const presetName = Object.keys(S.PRESETS).find(k => sameParts(S.PRESETS[k], spec)) || '';
  const builds = myBuilds(), buildName = (builds.find(b => sameParts(b.spec, spec) && JSON.stringify(b.spec.look || {}) === JSON.stringify(spec.look || {})) || {}).name || '', look = spec.look || {};
  const dflt = { frame: (WHOOP_LOOK.frames[spec.frame] || {}).c ?? 0x18181c, canopy: (WHOOP_LOOK.canopies[spec.electronics] || WHOOP_LOOK.canopies.air).c, props: WHOOP_LOOK.props[spec.prop] ?? 0xe0f040 }, hex = n => '#' + n.toString(16).padStart(6, '0');
  $('#gBuild').innerHTML = `
    <div id="gPreviewBox"></div>
    <label>My builds<select id="gMyBuild"><option value="">${builds.length ? '— pick a saved build —' : '— none saved yet —'}</option>${builds.map(b => `<option ${b.name === buildName ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label>
    <div class="row"><input id="gBuildName" maxlength="30" placeholder="name this build" value="${esc(buildName)}" onkeydown="event.stopPropagation()"><button id="gBuildSave">Save</button><button id="gBuildDel" class="ghost" ${buildName ? '' : 'disabled'}>Delete</button></div>
    <label>Preset<select id="gPreset"><option value="">Custom</option>${Object.keys(S.PRESETS).map(k => `<option ${k === presetName ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label>Frame<select data-part="frame">${opt(P.frames, spec.frame)}</select></label>
    <label>Motors<select data-part="motor">${opt(P.motors, spec.motor)}</select></label>
    <label>Props<select data-part="prop">${opt(P.props, spec.prop)}</select></label>
    <label>Battery<select data-part="battery">${opt(P.batteries, spec.battery)}</select></label>
    <label>Electronics<select data-part="electronics">${opt(P.electronics, spec.electronics)}</select></label>
    <div class="row gLook"><span>Colours</span>${[['frame', 'frame'], ['canopy', 'canopy'], ['props', 'props']].map(([k, l]) => `<label title="${l} colour"><input type="color" data-look="${k}" value="${/^#[0-9a-f]{6}$/i.test(look[k] || '') ? look[k] : hex(dflt[k])}">${l}</label>`).join('')}${spec.look ? '<button id="gLookReset" class="ghost" title="Back to the parts\' own colours">reset</button>' : ''}</div>
    ${params.warnings.map(w => `<p class="warn">⚠ ${w}</p>`).join('')}
    <div class="stats">
      <div><b>${st.auw.toFixed(1)}g</b><span>all-up weight</span></div><div><b>${st.twr.toFixed(1)}:1</b><span>thrust/weight</span></div>
      <div><b>${Math.round(st.thrust)}g</b><span>max thrust</span></div><div><b>${Math.round(hv.duty * 100)}%</b><span>hover throttle</span></div>
      <div><b>${(st.rpmMax / 1000).toFixed(0)}k</b><span>max rpm (loaded)</span></div><div><b>${st.ampsMax.toFixed(1)}A</b><span>max current</span></div>
      <div><b>${hv.minutes.toFixed(1)} min</b><span>est. hover time</span></div><div><b>${Math.round(st.I.x * 1e7)}</b><span>roll inertia (g·cm²)</span></div>
    </div><p class="note">Part numbers are first-pass estimates from spec sheets. Fitting them to your Blackbox logs is the next step.</p>`;
  const R = tune.rates, isA = tune.ratesType === 'ACTUAL';
  const rateRow = ax => isA ? `<tr><td>${ax}</td><td><input type=number data-r="${ax}.center" value="${R[ax].center}"></td><td><input type=number data-r="${ax}.max" value="${R[ax].max}"></td><td><input type=number step=0.01 data-r="${ax}.expo" value="${R[ax].expo}"></td></tr>`
    : `<tr><td>${ax}</td><td><input type=number step=0.01 data-r="${ax}.rcRate" value="${R[ax].rcRate}"></td><td><input type=number step=0.01 data-r="${ax}.superRate" value="${R[ax].superRate}"></td><td><input type=number step=0.01 data-r="${ax}.rcExpo" value="${R[ax].rcExpo}"></td></tr>`;
  const pidRow = ax => `<tr><td>${ax}</td>${['p', 'i', 'd', 'f'].map(k => `<td><input type=number data-pid="${ax}.${k}" value="${tune.pid[ax][k]}"></td>`).join('')}</tr>`;
  const profs = rateProfiles(), cur = tune.rateProfile || '';
  $('#gTune').innerHTML = `
    <label>Rate profile<select id="gRP"><option value="">${cur ? '— pick —' : '— unsaved rates —'}</option>${profs.map(p => `<option value="${esc(p.name)}" ${p.name === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="__default__">Game default (150 / 680 / 0.5)</option></select></label>
    <div class="row rpRow"><input id="gRPName" maxlength="24" placeholder="name these rates" value="${esc(cur)}" onkeydown="event.stopPropagation()"><button id="gRPSave">Save</button><button id="gRPDel" class="ghost" ${cur ? '' : 'disabled'}>Delete</button></div>
    <p class="note" id="gRPMsg">${cur ? `Flying "${esc(cur)}".` : 'Name your rates to keep them and switch between sets.'}</p>
    <label>Rates type<select id="gRT"><option ${isA ? 'selected' : ''}>ACTUAL</option><option ${!isA ? 'selected' : ''}>BETAFLIGHT</option></select></label>
    <table class="tt"><tr><th></th>${isA ? '<th>Center</th><th>Max</th><th>Expo</th>' : '<th>RC rate</th><th>Super</th><th>Expo</th>'}</tr>${['roll', 'pitch', 'yaw'].map(rateRow).join('')}</table>
    <canvas id="rateCurve" width=300 height=120></canvas>
    <table class="tt"><tr><th></th><th>P</th><th>I</th><th>D</th><th>FF</th></tr>${['roll', 'pitch', 'yaw'].map(pidRow).join('')}</table>
    <div class="grid2">
      <label>Motor idle %<input type=number step=0.1 data-t="idle" data-scale="100" value="${(tune.idle * 100).toFixed(1)}"></label>
      <label>Throttle mid<input type=number step=0.01 data-t="thrMid" value="${tune.thrMid}"></label>
      <label>Throttle expo<input type=number step=0.01 data-t="thrExpo" value="${tune.thrExpo}"></label>
      <label>Camera tilt °<input type=number data-t="camTilt" value="${tune.camTilt}"></label>
      <label>Camera FOV ° (horiz)<input type=number data-t="camFov" value="${tune.camFov}"></label>
      <label class="chk"><input type=checkbox data-tb="airmode" ${tune.airmode ? 'checked' : ''}> Airmode</label>
      <label class="chk"><input type=checkbox data-tb="itermRelax" ${tune.itermRelax ? 'checked' : ''}> I-term relax</label>
    </div>
    <details><summary>Import Betaflight <code>diff all</code></summary><textarea id="gDiff" placeholder="Paste the output of 'diff all' from the Betaflight CLI"></textarea><button id="gDiffBtn">Apply</button><span id="gDiffMsg"></span></details>
    <button id="gReset" class="ghost">Reset tune to defaults</button>`;
  drawRateCurve(); garagePreviewRefresh();
}
function drawRateCurve() {
  const c = $('#rateCurve'); if (!c) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = '#555'; g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  const cols = { roll: '#ff5a5a', pitch: '#5ad1ff', yaw: '#ffd25a' }, max = 2000;
  for (const ax of ['roll', 'pitch', 'yaw']) { g.strokeStyle = cols[ax]; g.beginPath(); for (let i = 0; i <= 100; i++) { const x = i / 100, r = S.applyRate(x, tune.rates[ax], tune.ratesType); const px = x * c.width, py = c.height - r / max * c.height; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.fillStyle = cols[ax]; g.fillText(`${ax} ${Math.round(S.applyRate(1, tune.rates[ax], tune.ratesType))}°/s`, 6, 14 + ['roll', 'pitch', 'yaw'].indexOf(ax) * 13); }
}
function applyParts() { params = S.buildDrone(spec); drone.setParams(params, tune); drone.reset(activeWorld.spawn); buildDroneMesh(); store.set('spec', spec); renderGarage(); }
// Named rate profiles (Garage & Tune): saved sets of rates type + roll/pitch/yaw rates, kept in this browser.
// Whole builds, named and kept like rate profiles: the five parts and the colours.
const myBuilds = () => { const a = store.get('builds', []); return Array.isArray(a) ? a.filter(b => b && typeof b.name === 'string' && b.spec && S.PARTS.frames[b.spec.frame] && S.PARTS.motors[b.spec.motor] && S.PARTS.props[b.spec.prop] && S.PARTS.batteries[b.spec.battery] && S.PARTS.electronics[b.spec.electronics]) : []; };
document.addEventListener('click', e => {
  if (e.target.id === 'gBuildSave') { const name = String($('#gBuildName').value || '').replace(/[<>"&]/g, '').trim().slice(0, 30); if (!name) { $('#gBuildName').focus(); return; }
    const all = myBuilds().filter(b => b.name !== name); all.push({ name, spec: JSON.parse(JSON.stringify(spec)) }); all.sort((a, b) => a.name.localeCompare(b.name)); store.set('builds', all.slice(0, 40)); renderGarage(); }
  if (e.target.id === 'gBuildDel') { const name = $('#gMyBuild').value; if (name) { store.set('builds', myBuilds().filter(b => b.name !== name)); renderGarage(); } }
  if (e.target.id === 'gLookReset') { delete spec.look; store.set('spec', spec); buildDroneMesh(); renderGarage(); }
});
// the Garage's own little view of the whoop (a second, tiny renderer): what you build is what you see
const gPrev = { r: null, scene: null, cam: null, model: null, yaw: 0.6, pitch: 0.5, drag: null, raf: 0 };
function garagePreviewRefresh() {
  const box = $('#gPreviewBox'); if (!box || $('#garage').classList.contains('hide')) return;
  if (!gPrev.cv) { gPrev.cv = document.createElement('canvas'); gPrev.cv.id = 'gPreview'; gPrev.cv.width = 560; gPrev.cv.height = 300; gPrev.cv.title = 'Your whoop as built: drag to turn it'; }
  const cv = gPrev.cv; if (cv.parentElement !== box) box.appendChild(cv);   // one canvas, one WebGL context, re-homed after every Garage redraw
  try {
    if (!gPrev.scene) { gPrev.scene = new THREE.Scene(); gPrev.cam = new THREE.PerspectiveCamera(32, 560 / 300, 0.005, 5); gPrev.scene.add(new THREE.HemisphereLight(0xffffff, 0x30343c, 1.15)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(0.3, 0.6, 0.4); gPrev.scene.add(d); const d2 = new THREE.DirectionalLight(0x88aaff, 0.6); d2.position.set(-0.4, 0.1, -0.5); gPrev.scene.add(d2); }
    if (!gPrev.r) { gPrev.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); gPrev.r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); gPrev.r.setSize(560, 300, false); }
    if (gPrev.model) gPrev.scene.remove(gPrev.model); gPrev.model = makeWhoopMesh(params, spec, tune).g; gPrev.scene.add(gPrev.model);
    cancelAnimationFrame(gPrev.raf); const tick = () => { if (!gPrev.r || $('#garage').classList.contains('hide') || !document.body.contains(cv)) return; if (!gPrev.drag) gPrev.yaw += 0.006; const R = (params.arm + params.rDuct) * 4.6, cp = Math.cos(gPrev.pitch);
      gPrev.cam.position.set(Math.sin(gPrev.yaw) * cp * R, Math.sin(gPrev.pitch) * R, Math.cos(gPrev.yaw) * cp * R); gPrev.cam.lookAt(0, 0.002, 0); gPrev.r.render(gPrev.scene, gPrev.cam); gPrev.raf = requestAnimationFrame(tick); }; tick();
  } catch (err) { cv.style.display = 'none'; }   // no second WebGL context to spare: the Garage works without the picture
}
addEventListener('pointerdown', e => { if (e.target.id === 'gPreview') { gPrev.drag = { x: e.clientX, y: e.clientY, yaw: gPrev.yaw, pitch: gPrev.pitch }; e.preventDefault(); } });
addEventListener('pointermove', e => { const d = gPrev.drag; if (!d) return; gPrev.yaw = d.yaw - (e.clientX - d.x) * 0.01; gPrev.pitch = Math.max(-1.3, Math.min(1.4, d.pitch + (e.clientY - d.y) * 0.01)); });
addEventListener('pointerup', () => { gPrev.drag = null; });
window.__pwGarage = gPrev;
const rateProfiles = () => { const a = store.get('rateProfiles', []); return Array.isArray(a) ? a.filter(p => p && p.name && p.rates) : []; };
function rateEdited() { if (tune.rateProfile) { const p = rateProfiles().find(x => x.name === tune.rateProfile); if (!p || p.ratesType !== tune.ratesType || JSON.stringify(p.rates) !== JSON.stringify(tune.rates)) { tune.rateProfile = ''; const m = $('#gRPMsg'); if (m) m.textContent = 'Changed since it was saved — press Save to keep these.'; const sel = $('#gRP'); if (sel) sel.value = ''; } } }
document.addEventListener('click', e => {
  if (e.target.id === 'gRPSave') { const name = $('#gRPName').value.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); if (!name) { $('#gRPMsg').textContent = 'Give the profile a name first.'; $('#gRPName').focus(); return; }
    const all = rateProfiles().filter(p => p.name !== name); all.push({ name, ratesType: tune.ratesType, rates: JSON.parse(JSON.stringify(tune.rates)) }); all.sort((a, b) => a.name.localeCompare(b.name)); store.set('rateProfiles', all.slice(0, 30)); tune.rateProfile = name; saveTune(); renderGarage(); }
  if (e.target.id === 'gRPDel' && tune.rateProfile) { store.set('rateProfiles', rateProfiles().filter(p => p.name !== tune.rateProfile)); tune.rateProfile = ''; saveTune(); renderGarage(); }
});
function saveTune() { detector.camTilt = tune.camTilt; drone.setParams(params, tune); store.set('tune', tune); resize(); buildDroneMesh(); }
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'gPreset' && t.value) { spec = { ...S.PRESETS[t.value], ...(spec.look ? { look: spec.look } : {}) }; applyParts(); }
  if (t.id === 'gMyBuild' && t.value) { const b = myBuilds().find(x => x.name === t.value); if (b) { spec = JSON.parse(JSON.stringify(b.spec)); applyParts(); } }
  if (t.dataset.look) { spec.look = { ...(spec.look || {}), [t.dataset.look]: t.value }; store.set('spec', spec); buildDroneMesh(); }
  if (t.dataset.part) { spec[t.dataset.part] = t.value; applyParts(); }
  if (t.id === 'gRT') { tune.ratesType = t.value; rateEdited(); saveTune(); renderGarage(); }
  if (t.dataset.r) { const [ax, k] = t.dataset.r.split('.'); tune.rates[ax][k] = +t.value; rateEdited(); saveTune(); drawRateCurve(); }
  if (t.id === 'gRP' && t.value) { const d = t.value === '__default__' ? { name: '', ratesType: S.defaultTune().ratesType, rates: S.defaultTune().rates } : rateProfiles().find(p => p.name === t.value);
    if (d) { tune.ratesType = d.ratesType; tune.rates = JSON.parse(JSON.stringify(d.rates)); tune.rateProfile = d.name; saveTune(); renderGarage(); } }
  if (t.dataset.pid) { const [ax, k] = t.dataset.pid.split('.'); tune.pid[ax][k] = +t.value; saveTune(); }
  if (t.dataset.t) { tune[t.dataset.t] = +t.value / (+t.dataset.scale || 1); saveTune(); }
  if (t.dataset.tb) { tune[t.dataset.tb] = t.checked; saveTune(); }
  if (t.id === 'vol') { store.set('vol', +t.value); if (window._master) window._master.gain.value = +t.value; }
});
document.addEventListener('click', e => {
  if (e.target.id === 'gDiffBtn') { const r = S.importDiff($('#gDiff').value, tune); tune = Object.assign(tune, r.tune); saveTune(); renderGarage(); $('#gDiffMsg').textContent = r.found.length ? `Imported ${r.found.length} settings` : 'No Betaflight settings found'; }
  if (e.target.id === 'gReset') { tune = S.defaultTune(); saveTune(); renderGarage(); }
});

// ---------------- controls
let ctlTimer = null;
function openControls() { show('#controls'); renderControls(); clearInterval(ctlTimer); ctlTimer = setInterval(liveControls, 50); }
function deviceCard(d, kind) {
  if (!d) return `<div class="dev none"><b>No ${kind} detected</b><span>${kind === 'radio'
    ? 'Plug the radio in over USB and choose <i>USB Joystick (HID)</i> when it asks. In EdgeTX: SYS → Hardware / USB mode → Joystick. Then move a stick so the browser sees it.'
    : 'Connect a controller and press any button so the browser sees it.'}</span></div>`;
  return `<div class="dev"><b>${d.name}</b><span>${d.firmware ? d.firmware + ' · ' : ''}${d.vendor ? `USB ${d.vendor}:${d.product} · ` : ''}${d.axes} channels/axes · ${d.buttons} buttons</span></div>`;
}
function renderControls() {
  const mode = inputCfg.mode, P = prof(), pads = allPads().map(describePad);
  const tabs = ['keyboard', 'radio', 'gamepad'].map(m => `<button class="tab ${m === mode ? 'on' : ''}" data-mode="${m}">${m === 'radio' ? 'Radio' : m === 'gamepad' ? 'Gamepad' : 'Keyboard'}</button>`).join('');
  let body = '';
  if (mode === 'keyboard') {
    body = `<p class="note">Keyboard is for a quick look around. Acro on keys is rough; a radio is the real thing.</p>`;
  } else {
    const isR = mode === 'radio', cur = readPad(mode), d = describePad(cur);
    const n = Math.max(8, cur ? cur.axes.length : 8);
    const chOpt = sel => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${isR ? 'CH' + (i + 1) : 'Axis ' + i}</option>`).join('');
    const sameKind = pads.filter(p => p.kind === mode), other = pads.filter(p => p.kind !== mode);
    const devSel = pads.length > 1 || (pads.length && !sameKind.length) ? `<label>Device<select id="cDev">${[...sameKind, ...other].map(p => `<option value="${encodeURIComponent(p.id)}" ${cur && cur.id === p.id ? 'selected' : ''}>${p.name}${p.kind !== mode ? ' (' + p.kind + '?)' : ''}</option>`).join('')}</select></label>` : '';
    const swRow = (key, s) => `<tr><td>${key}</td><td><select data-swt="${key}"><option value="axis" ${s.type === 'axis' ? 'selected' : ''}>${isR ? 'switch (channel)' : 'axis'}</option><option value="button" ${s.type === 'button' ? 'selected' : ''}>button</option></select>
      ${s.type === 'axis' ? `<select data-swi="${key}">${chOpt(s.i)}</select>` : `<input type=number min=0 max=31 data-swi="${key}" value="${s.i}">`}</td><td>${key === 'arm' && !isR ? `<label class="chk"><input type=checkbox data-swtog ${s.toggle ? 'checked' : ''}> toggle</label>` : ''}</td><td><div class="bar"><i id="lv_${key}"></i></div></td><td><button data-detect="${key}">Detect</button></td></tr>`;
    body = `${deviceCard(d, mode)}${devSel}
      ${isR ? `<p class="note">Defaults follow EdgeTX/OpenTX AETR order: CH1 roll · CH2 pitch · CH3 throttle · CH4 yaw · CH5 arm · CH6 reset. If a stick moves the wrong way, tick Invert.</p>` : `<p class="note">Mode 2 layout: left stick throttle/yaw, right stick pitch/roll. A = arm toggle, Y = respawn.</p>`}
      <table class="tt"><tr><th>Function</th><th>${isR ? 'Channel' : 'Axis'}</th><th>Invert</th><th>Live</th><th></th></tr>
      ${AX4.map(a => `<tr><td>${a}</td><td><select data-ax="${a}">${chOpt(P.axes[a].i)}</select></td><td><input type=checkbox data-inv="${a}" ${P.axes[a].inv ? 'checked' : ''}></td><td><div class="bar"><i id="lv_${a}"></i></div></td><td><button data-detect="${a}">Detect</button></td></tr>`).join('')}
      ${swRow('arm', P.arm)}${P.reset && P.reset.enabled === true ? swRow('reset', P.reset) : ''}
      <tr><td colspan="6"><label class="chk"><input type="checkbox" id="autoArmOn" ${autoArmOn() ? 'checked' : ''}> Take off without arming <small>(raise the throttle from rest and it flies; off: arm first, like a real quad)</small></label></td></tr>
      <tr><td colspan="6"><label class="chk"><input type="checkbox" id="resetSwOn" ${P.reset && P.reset.enabled === true ? 'checked' : ''}> Use a switch to reset to the start <small>(off: only the <kbd>R</kbd> key resets, and disarming just stops the motors)</small></label></td></tr>
      </table>
      ${!isR ? `<label class="chk"><input type=checkbox id="cThrC" ${P.thrCentered ? 'checked' : ''}> Spring-centred throttle (stick up from centre = throttle)</label>` : ''}
      <div class="preflight" id="preflight"></div>
      <label>Stick deadband<input type=number step=0.005 min=0 max=0.2 id="cDb" value="${P.deadband}"></label>
      <button id="cCal">Calibrate: move all sticks to every corner, then click again</button>
      ${cur ? `<h3>${isR ? 'Channel monitor' : 'Raw axes'}</h3><div class="chmon">${cur.axes.map((_, i) => `<div><span>${isR ? 'CH' + (i + 1) : 'A' + i}</span><div class="bar"><i id="raw_${i}"></i></div></div>`).join('')}</div>` : ''}`;
  }
  $('#cBody').innerHTML = `<div class="tabs">${tabs}</div>${body}
    <div class="keys"><b>Keyboard</b> W/S throttle · Shift boost · X cut · A/D yaw · ↑↓ pitch · ←→ roll · Space arm · T flip over · R respawn · 1 / 2 / 3 acro, angle, 3D mode · C chase cam · V stick overlay · F flag the last call as wrong · Q flag a missed trick · Tab score breakdown · G trick debug · Esc pause</div>`;
}
let calib = null, detecting = null;
function liveControls() {
  if ($('#controls').classList.contains('hide')) { clearInterval(ctlTimer); return; }
  const P = prof(); if (!P) return; const pad = readPad(); if (!pad) return;
  for (const a of AX4) { const el = $('#lv_' + a); if (el) el.style.left = ((axisVal(pad, P.axes[a]) + 1) / 2 * 100) + '%'; }
  for (const k of ['arm', 'reset']) { const el = $('#lv_' + k); if (el) el.style.left = switchOn(pad, P[k]) ? '100%' : '0%'; }
  const pf = $('#preflight'); if (pf) {
    const tv = axisVal(pad, P.axes.thr), thr = P.thrCentered ? Math.max(0, tv) : (tv + 1) / 2, armOn = switchOn(pad, P.arm);
    const ok = thrArmOk(thr);
    pf.innerHTML = `<b>Pre-flight</b> Throttle <span class="${ok ? 'ok' : 'bad'}">${Math.round(thr * 100)}%</span> ${ok ? '✓ low enough to arm' : '✗ must be ≤ ' + Math.round(ARM_THR_MAX * 100) + '% to arm — lower it, or tick Invert / Calibrate if it reads high at the bottom'}
      · Arm ${P.arm.toggle ? 'button' : 'switch'} <span class="${armOn ? 'ok' : ''}">${armOn ? 'ON' : 'OFF'}</span>${!P.arm.toggle ? ' — flip it to check it moves the bar' : ''}`;
  }
  pad.axes.forEach((v, i) => { const el = $('#raw_' + i); if (el) el.style.left = ((v + 1) / 2 * 100) + '%'; });
  if (calib) pad.axes.forEach((v, i) => { calib[i] = calib[i] || { min: v, max: v }; calib[i].min = Math.min(calib[i].min, v); calib[i].max = Math.max(calib[i].max, v); });
  if (detecting) {
    if (!detecting.base) { detecting.base = [...pad.axes]; detecting.bbase = pad.buttons.map(b => b.pressed); return; }
    let bi = -1, bd = 0.35; pad.axes.forEach((v, i) => { const dd = Math.abs(v - detecting.base[i]); if (dd > bd) { bd = dd; bi = i; } });
    const bt = pad.buttons.findIndex((b, i) => b.pressed && !detecting.bbase[i]);
    const k = detecting.key;
    if (k === 'arm' || k === 'reset') {
      if (bt >= 0) { P[k] = { type: 'button', i: bt, toggle: k === 'arm' && inputCfg.mode === 'gamepad' }; detecting = null; }
      else if (bi >= 0) { P[k] = { type: 'axis', i: bi, th: (detecting.base[bi] < pad.axes[bi]) ? (detecting.base[bi] + pad.axes[bi]) / 2 : 0.5 }; detecting = null; }
    } else if (bi >= 0) { P.axes[k].i = bi; detecting = null; }
    if (!detecting) { saveInput(); renderControls(); }
  }
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset && t.dataset.mode) { inputCfg.mode = t.dataset.mode; saveInput(); renderControls(); }
  const d = t.dataset && t.dataset.detect; if (d) { detecting = { key: d }; t.textContent = d === 'arm' ? 'Flip switch…' : 'Move it…'; }
  if (t.id === 'cCal') { const P = prof(); if (!calib) { calib = []; t.textContent = 'Calibrating… click when done'; } else { for (const a of AX4) { const c = calib[P.axes[a].i]; if (c && c.max - c.min > 0.5) { P.axes[a].min = c.min; P.axes[a].max = c.max; } } calib = null; saveInput(); renderControls(); } }
});
document.addEventListener('change', e => {
  const t = e.target, P = prof(); if (!P || !$('#controls').contains(t)) return;
  if (t.id === 'cDev') { P.device = decodeURIComponent(t.value); renderControls(); }
  if (t.dataset.ax) P.axes[t.dataset.ax].i = +t.value;
  if (t.dataset.inv) P.axes[t.dataset.inv].inv = t.checked;
  if (t.dataset.swt) { P[t.dataset.swt].type = t.value; renderControls(); }
  if (t.dataset.swi) P[t.dataset.swi].i = +t.value;
  if (t.dataset.swtog !== undefined && t.matches('[data-swtog]')) P.arm.toggle = t.checked;
  if (t.id === 'autoArmOn') { store.set('autoArm', t.checked); return; }
  if (t.id === 'resetSwOn') { P.reset = P.reset || { type: 'axis', i: 5, th: 0.5 }; P.reset.enabled = t.checked; saveInput(); renderControls(); return; }
  if (t.id === 'cThrC') P.thrCentered = t.checked;
  if (t.id === 'cDb') P.deadband = +t.value;
  saveInput();
});
addEventListener('gamepadconnected', e => {
  const d = describePad(e.gamepad);
  if (inputCfg.mode === 'keyboard') { inputCfg.mode = d.kind; saveInput(); }
  if (!$('#controls').classList.contains('hide')) renderControls();
  else flash(`<b>${d.kind === 'radio' ? 'RADIO' : 'GAMEPAD'} CONNECTED</b><small>${d.name}${d.firmware ? ' · ' + d.firmware : ''}</small>`);
  updateMenuDevice();
});
addEventListener('gamepaddisconnected', () => { if (!$('#controls').classList.contains('hide')) renderControls(); updateMenuDevice(); });
function updateMenuDevice() {
  const el = $('#menuDevice'); if (!el) return; const d = describePad(readPad('radio')) || describePad(readPad('gamepad'));
  el.innerHTML = inputCfg.mode === 'keyboard' ? (d ? `${d.kind === 'radio' ? 'Radio' : 'Gamepad'} found: <b>${d.name}</b> — switch to it under Controls.` : 'Input: keyboard. Plug in your radio as a USB joystick for real acro.')
    : (describePad(readPad()) ? `Input: <b>${describePad(readPad()).name}</b> (${inputCfg.mode})` : `Input: ${inputCfg.mode} — not connected yet. Move a stick once it's plugged in.`);
}

// ---------------- trick list
function openTricks() {
  show('#tricksScreen'); const det = new Set(S.DETECTABLE), dr = S.DRAFT;
  const cats = {}; for (const t of window.TPW_TRICKS) (cats[t.cat.trim()] = cats[t.cat.trim()] || []).push(t);
  const all = window.TPW_TRICKS.filter(t => t.pts > 0), nDet = all.filter(t => det.has(t.name.trim())).length, nDraft = all.filter(t => dr.has(t.name.trim())).length;
  $('#tBody').innerHTML = `<p class="note">${nDet} of ${all.length} tricks have detection rules. <b>●</b> tested rule · <b>◐</b> new draft rule written from the TPW description — fly it in Trick Training so it can be confirmed. Points and execution rules come from the TPW calculator. Trick of the Week: Split-S, Powerloop, Matty Flip (first landing ×2, then ×1.5, then ×1).</p>` +
    Object.entries(cats).map(([c, ts]) => `<h3>${c}</h3><table class="tt">${ts.map(t => { const n = t.name.trim(), has = det.has(n), d = dr.has(n);
      return `<tr class="${has ? 'det' : 'nodet'}"><td title="${d ? 'draft rule' : has ? 'tested rule' : 'not detected'}">${has ? (d ? '◐' : '●') : '○'}</td><td><b>${t.name}</b>${d ? ' <small class="draftTag">draft</small>' : ''}${window.Maneuvers && window.Maneuvers.LIB[n] ? ` <a href="#" class="watch" data-watch="${n}" title="the bot flies it — judge it">▶ watch</a>` : ''}</td><td>${t.diff}</td><td>${t.pts}</td><td class="desc">${t.desc}${(sp => `<div class="spot">Fly it on: <b>${sp.on.join(', ')}</b>${sp.demo ? ` · demo: ${sp.demo}` : ''}</div>`)(S.trickSpots(n, t.cat))}</td></tr>`; }).join('')}</table>`).join('');
}


