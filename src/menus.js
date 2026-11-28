// RaceGOW (track builder and racing) is switched off in the interface for now, at the pilot's request: its button in
// Tools & labs is hidden and its menu will not open. The code, tracks and tests stay; set this to true to bring it back.
const RACEGOW_ON = true;   // RaceGOW racing (src/racegow.js + src/raceedit.js), redesigned 2026-11-18
// physics feel sliders (Garage → Advanced): [tune key, name, what it does]
const FEEL = [['weightFeel', 'Weight', 'Lighter accelerates and stops quicker and floats more; heavier carries more momentum and drops harder'],
  ['dragFeel', 'Air drag', 'More slows the whoop down sooner and it coasts less; less lets it carry speed'],
  ['washFeel', 'Prop wash', 'The shake and loss of thrust when you drop into your own air (0% = none)'],
  ['motorFeel', 'Motor response', 'How quickly the motors spin up and down: lower is laggier, like heavier props or a softer ESC'],
  ['sagFeel', 'Battery sag', 'How much the pack voltage drops under load and as it empties (0% = a perfect battery)'],
  ['groundFeel', 'Ground effect', 'The air cushion just above the floor (0% = none)']];
// ============================================================ menus
// Maps: the choice is remembered and the page reloads into it. Trick Calibration and Judge the Bot name specific
// playground objects, so they stay on the playground.
function needPlayground(what) { if (MAP_ID === 'playground') return false; flash(`<b>${what.toUpperCase()} RUNS ON THE PLAYGROUND</b><small>press Map on the main menu to switch</small>`, 'warn'); return true; }
function menuMapLabels() { const m = $('#menuMap'); if (m) m.textContent = world.title; }
function openMaps() {
  show('#mapScreen'); if (mode === 'fly') { mode = 'paused'; }
  // the official maps; each lists its community maps: the pilot's own (named copies, Map Editor) and the ones other pilots
  // shared (relay GET /maps?base=, by pilot name; other people's text: always esc)
  const thumbs = window.PW_MAPTHUMBS || {}, maps = Object.values(S.MAPS).filter(m => !m.hidden || m.id === MAP_ID), onOfficial = !MY_MAP && !COMM_MAP;
  mapCar.n = maps.length; mapCar.i = Math.max(0, maps.findIndex(m => m.id === MAP_ID));
  $('#mapList').innerHTML = `<div class="mapCar"><button class="mapArrow" data-mapnav="-1" aria-label="previous map">‹</button><div class="mapViewport"><div class="mapTrack">${maps.map((m, k) => { const here = m.id === MAP_ID, cur = here && onOfficial;
      return `<div class="mapSlide ${here ? 'cur' : ''}" data-mapk="${k}">
      <div class="mapThumb ${thumbs[m.id] ? '' : 'none'}" ${thumbs[m.id] ? `style="background-image:url('${thumbs[m.id]}')"` : ''}>${thumbs[m.id] ? '' : `<span>${esc(m.title)}</span>`}${here ? '<em>you are here</em>' : ''}</div>
      <div class="mapInfo"><b>${esc(m.title)}</b><small>${esc(m.blurb || '')}</small>${here && world.survey ? `<small class="mapStats">${world.survey.overUnders} over/unders · ${world.survey.gaps} gaps · ${world.survey.poles} poles · ${world.survey.walls} walls</small>` : ''}</div>
      <div class="mapGo">${cur ? '<span class="note">you are flying here</span>' : `<button data-mapid="${m.id}" class="primary">Fly here</button>`}</div>
</div>`; }).join('')}</div></div><button class="mapArrow" data-mapnav="1" aria-label="next map">›</button></div>
    <div class="mapDots">${maps.map((m, k) => `<button data-mapdot="${k}" title="${esc(m.title)}" aria-label="${esc(m.title)}"></button>`).join('')}</div>`;
  // community maps are no longer listed here (owner, 2026-11-19); commMapsHtml / commMapsLoad stay for later
  mapCarGo(mapCar.i);
}
// ---- community maps per official map: the pilot's own first ("by you"), then other pilots' (newest of each)
const COMM = { lists: {}, at: {} };
function commMapsHtml(base) {
  const mine = MY_MAPS.filter(m => m.base === base), L = COMM.lists[base], others = (Array.isArray(L) ? L : []).filter(x => x.pilot !== telPilot());
  const row = (title, by, btn, cur, extra = '') => `<li class="${cur ? 'cur' : ''}"><b>${esc(title)}</b> <small>by ${esc(by)}</small>${cur ? '<span class="note">flying</span>' : btn}${extra}</li>`;
  const rows = [...mine.map(my => row(my.name, 'you', `<button data-mymap="${esc(my.id)}">Fly</button>`, MY_MAP && MY_MAP.id === my.id, `<button data-mymapdel="${esc(my.id)}" class="ghost" title="Delete your map">✕</button>`)),
    ...others.map(x => row(x.name, x.by, `<button data-commfly="${esc(x.id)}" data-commb="${esc(base)}">Fly</button>`, COMM_MAP && COMM_MAP.id === x.id))];
  const state = L === 'loading' ? '<span class="note">looking for community maps…</span>' : L === 'off' ? '<span class="note">community maps need the online game</span>' : L === 'err' ? '<span class="note">could not reach the community list</span>' : '';
  return `<h5>Community maps</h5>${rows.length ? `<ul>${rows.join('')}</ul>` : `<span class="note">${L === 'loading' ? '' : 'None yet. Make one in the Map Editor and share it.'}</span>`}${state}`;
}
async function commMapsLoad(base) {
  const el = () => document.querySelector(`#mapList [data-commbase="${base}"]`);
  if (!lbBase()) { COMM.lists[base] = 'off'; if (el()) el().innerHTML = commMapsHtml(base); return; }
  if (Array.isArray(COMM.lists[base]) && Date.now() - (COMM.at[base] || 0) < 60000) return;
  if (!Array.isArray(COMM.lists[base])) { COMM.lists[base] = 'loading'; if (el()) el().innerHTML = commMapsHtml(base); }
  try { const r = await fetch(`${lbBase()}/maps?base=${encodeURIComponent(base)}`); if (!r.ok) throw 0; const j = await r.json();
    COMM.lists[base] = (Array.isArray(j.maps) ? j.maps : []).filter(x => x && typeof x.id === 'string' && /^[A-Za-z0-9_.-]{10,200}$/.test(x.id) && typeof x.name === 'string' && typeof x.by === 'string').slice(0, 100).map(x => ({ id: x.id, name: x.name.slice(0, 40), by: x.by.slice(0, 24), pilot: String(x.pilot || '') }));
    COMM.at[base] = Date.now(); } catch { if (!Array.isArray(COMM.lists[base])) COMM.lists[base] = 'err'; }
  if (el()) el().innerHTML = commMapsHtml(base);
}
async function commFly(base, id) {   // download another pilot's map (cleaned like a layout file), then load it
  if (!S.MAPS[base] || !lbBase()) return; flash('<b>LOADING THE MAP…</b>');
  try { const r = await fetch(`${lbBase()}/map?base=${encodeURIComponent(base)}&id=${encodeURIComponent(id)}`); if (!r.ok) throw 0; const j = await r.json(); if (!j || j.base !== base) throw 0;
    const all = store.get('commMaps', {}) || {}, keys = Object.keys(all); if (keys.length > 30) for (const k of keys.slice(0, keys.length - 30)) delete all[k];
    all[id] = { id, name: String(j.name || 'Community map').slice(0, 40), by: String(j.by || '?').slice(0, 24), base, E: meClean(j), at: j.at || null }; store.set('commMaps', all);
    store.set('map', base); store.set('myMap', null); store.set('commMap', id); mapGoLoad(all[id].name);
  } catch { flash('<b>COULD NOT LOAD THAT MAP</b><small>try again in a moment</small>', 'warn'); } }
// the carousel: one map in the middle; arrows, dots, a click on a faded neighbour, the arrow keys, a swipe
const mapCar = { i: 0 };
function mapCarGo(k) { const n = mapCar.n || Object.keys(S.MAPS).length, tr = $('#mapList .mapTrack'); if (!tr) return; mapCar.i = (k + n) % n;
  tr.style.transform = `translateX(${-mapCar.i * 100}%)`;
  for (const el of document.querySelectorAll('#mapList .mapSlide')) el.classList.toggle('on', +el.dataset.mapk === mapCar.i);
  for (const el of document.querySelectorAll('#mapList [data-mapdot]')) el.classList.toggle('on', +el.dataset.mapdot === mapCar.i); }
document.addEventListener('click', e => { if (!e.target.closest('#mapList')) return; const a = e.target.closest('[data-mapnav]'), d = e.target.closest('[data-mapdot]');
  if (a) mapCarGo(mapCar.i + +a.dataset.mapnav); else if (d) mapCarGo(+d.dataset.mapdot); });
document.addEventListener('keydown', e => { if ($('#mapScreen').classList.contains('hide')) return;
  if (e.key === 'ArrowLeft') { mapCarGo(mapCar.i - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { mapCarGo(mapCar.i + 1); e.preventDefault(); }
  if (e.key === 'Enter') { const b = $('#mapList .mapSlide.on [data-mapid]'); if (b) { b.click(); e.preventDefault(); } } });
{ let x0 = null; document.addEventListener('pointerdown', e => { x0 = e.target.closest('#mapList .mapViewport') ? e.clientX : null; });
  document.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) mapCarGo(mapCar.i + (dx < 0 ? 1 : -1)); }); }
function mapGoLoad(next) { procFlight(telCapture('map'), () => { $('#loading').textContent = 'Loading ' + next + '…'; show('#loading'); setTimeout(() => location.reload(), 350); }); }
document.addEventListener('click', e => { const y = e.target.closest('[data-mymap]'), dl = e.target.closest('[data-mymapdel]');
  const cf = e.target.closest('[data-commfly]'); if (cf) { commFly(cf.dataset.commb, cf.dataset.commfly); return; }
  if (y) { const my = MY_MAPS.find(m => m.id === y.dataset.mymap); if (!my) return; store.set('map', my.base); store.set('myMap', my.id); store.set('commMap', null); mapGoLoad(my.name); return; }
  if (dl) { const i = MY_MAPS.findIndex(m => m.id === dl.dataset.mymapdel); if (i < 0 || !confirm(`Delete your map "${MY_MAPS[i].name}"? This can't be undone.`)) return; const was = MY_MAPS[i]; MY_MAPS.splice(i, 1); store.set('myMaps', MY_MAPS);
    if (MY_MAP === was) { store.set('myMap', null); mapGoLoad(S.MAPS[MAP_ID].title); } else openMaps(); return; } });
document.addEventListener('click', e => { const b = e.target.closest('[data-mapid]'); if (!b || !S.MAPS[b.dataset.mapid]) return; const next = b.dataset.mapid;
  store.set('map', next); store.set('myMap', null); store.set('commMap', null); procFlight(telCapture('map'), () => { $('#loading').textContent = 'Loading ' + S.MAPS[next].title + '…'; show('#loading'); setTimeout(() => location.reload(), 350); }); });
setTimeout(menuMapLabels, 0);
function show(id) { for (const el of document.querySelectorAll('.screen')) el.classList.add('hide'); if (id) $(id).classList.remove('hide'); if (id === '#mainMenu' || id === '#pause') { try { quickLabels(); } catch { /* not ready at start-up */ } try { kwadMenus(); } catch { /* not ready at start-up */ } } if (id === '#mainMenu') { try { hubBadge(); } catch { /* not ready at start-up */ } } if (id === '#mainMenu') ownerMenus(); }   // Judge the community, Tools & labs and RaceGOW: the project owner's for now
// owner-only buttons (owner, 2026-11-18): shown only when the pilot name is heyheykoolaid
function ownerMenus() { const own = ghMenus(); { const j = $('#judgeBtn'); if (j) j.classList.add('hide'); }   /* Judge the community and the Flight desk are retired from the menus (owner, 2026-11-28): the Review Hub's Community / All flights / Review queue open the same things */ for (const sel of ['#mainMenu [data-act="tools"]', '#mainMenu [data-act="race"]', '#mainMenu [data-act="mapedit"]']) { const b = $(sel); if (b) b.classList.toggle('hide', !own); } }
// a shared flight is packed and sent BEFORE the next one starts (no stutter in the air)
function startFly(withSession) { const job = telCapture('restart'); if (job) procFlight(job, () => startFlyGo(withSession)); else startFlyGo(withSession); }
function startFlyGo(withSession) {
  combo.names = []; combo.pts = 0; combo.active = false;
  if (!$('#judgeBox').classList.contains('hide')) stopJudge();   // however Judge the Bot was left, its panel, trail and big model go
  initAudio(); if (actx && actx.state === 'suspended') actx.resume();
  if (race.on || activeWorld !== world) raceOff(); score = newScore(); kwadShow(); detector.reset(); drone.reset(world.spawn); flightTime = 0; updateBreakdown();
  session = withSession ? { timeLeft: 120, started: false } : null;
  hubKeepRun(); recapReset(); if (warm.on) stopWarmup(); if (coach.on) coachClock();
  mode = 'fly'; show(null); $('#hud').classList.remove('hide'); camMode = 'fpv'; resize();
  flash(withSession ? `<b>2:00 SESSION</b><small>timer starts when you ${autoArmOn() ? 'take off' : 'arm'}</small>` : `<b>FREE FLY</b><small>${autoArmOn() ? 'throttle up to take off' : 'Space / arm switch to arm'}</small>`);
}
function pause() { mode = 'paused'; show('#pause'); }
function resume() { mode = 'fly'; show(null); $('#hud').classList.remove('hide'); lastT = performance.now(); }
function endSession() {
  mode = 'paused'; drone.armed = false; const r = score;
  const best = store.get('best', 0); if (r.total > best) store.set('best', r.total);
  $('#results').innerHTML = `<h2>SESSION OVER</h2><div class="big">${r.total.toLocaleString()}</div>
    <p>Trick score ${r.trickScore.toLocaleString()} × switch ${r.switchMult()} + K.W.A.D. ${r.kwadBonus}${Object.keys(r.kwad).length ? ' (' + ['K', 'W', 'A', 'D'].filter(L => r.kwad[L]).join(' ') + ')' : ''}${r.chainBonus ? ` + ${r.chains.map(c => c.title + ' ×' + c.n).join(', ')} ${r.chainBonus.toLocaleString()}` : ''}${r.gapBonus ? ` + ${r.gapN} gap${r.gapN > 1 ? 's' : ''} ${r.gapBonus.toLocaleString()}` : ''}${r.commBonus ? ` + ${r.commN} community trick${r.commN > 1 ? 's' : ''} ${r.commBonus.toLocaleString()}` : ''}${r.invBonus ? ` + INVERTED ${r.invN}s ${r.invBonus.toLocaleString()} (longest ${r.invBest}s)` : ''}</p>
    <p>Biggest trick: <b>${r.biggest ? r.biggest.name + ' (' + r.biggest.net + ')' : '—'}</b> · Max streak ×${r.maxStreak.toFixed(2)} · Obstacles ${r.uniqueObs.size}</p>
    <p>Personal best: <b>${Math.max(best, r.total).toLocaleString()}</b></p>
    <ol>${r.log.filter(x => x.net || x.exec === 'CRASH').map(x => `<li>${x.name} <span class="${x.exec}">${x.exec}</span> +${x.net}</li>`).join('')}</ol>
    <div class="row"><button data-act="session">Run it back</button><button data-act="quick" class="primary" title="Say whether the game got its least sure calls right">Quick check</button><button data-act="recap" title="Replay your run and say what each trick really was">SKITTLES mode</button><button data-act="menu">Menu</button></div><div id="lbBox"></div>`;
  show('#resultsScreen'); quickLabels(); lbSessionOver(r); procFlight(telCapture('session-over'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'free' || a === 'session') { train.on = false; renderTrain(); if (typeof ask !== 'undefined') { ask.pending = []; } }
  if ((a === 'free' || a === 'session') && mode === 'judge') stopJudge();
  if ((a === 'free' || a === 'session' || a === 'menu' || a === 'train') && coach.on) coachStop();
  if ((a === 'free' || a === 'session' || a === 'menu') && world.id === 'training') { if (mode === 'recap') recapSave(); coachLeave(false); return; }   // the Training Room is only for Train: anything else goes home
  if (a === 'free') startFly(false); if (a === 'session') startFly(true);
  if (a === 'settings' || a === 'training' || a === 'settingsBack' || a === 'menu') { const sub = a === 'settings' ? '#menuSettings' : a === 'training' ? '#menuTraining' : null; $('#mainMenu .menuBtns:not(.menuSub)').classList.toggle('hide', !!sub); for (const id of ['#menuSettings', '#menuTraining']) $(id).classList.toggle('hide', id !== sub); }
  if (a === 'garage') openGarage(); if (a === 'controls') openControls(); if (a === 'tricks') openTricks(); if (a === 'rules') show('#rulesScreen');
  if (a === 'resume') resume(); if (a === 'menu') { procFlight(telCapture('menu')); if (race.on || activeWorld !== world) raceOff(); if (mode === 'editor') editorClose(); if (warm.on) stopWarmup(); if (mode === 'recap') { recapSave(); recap.play = null; $('#recapUI').classList.add('hide'); document.body.classList.remove('bbr'); drone.reset(world.spawn); } if (mode === 'bbreplay') { $('#bbrUI').classList.add('hide'); document.body.classList.remove('bbr'); br.playing = false; drone.reset(world.spawn); } if (mode === 'review') $('#rvVideo').pause(); if (mode === 'judge') stopJudge(); ghostOff(); train.on = false; renderTrain(); mode = 'menu'; drone.armed = false; $('#hud').classList.add('hide'); show('#mainMenu'); }
  if (a === 'back') { show(mode === 'menu' ? '#mainMenu' : '#pause'); }
  if (a === 'blackbox') show('#bbScreen');
  if (a === 'judge') { if (needPlayground('Judge the Bot')) return; startJudge(); }
  if (a === 'map') openMaps(); if (a === 'tools' && ghMenus()) { show('#toolsScreen'); $('#deskBtn').classList.add('hide'); }
  if (a === 'race' && RACEGOW_ON && ghMenus()) openRaceMenu();
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
    <label title="Only packs that fit this frame: its cell count and size">Battery<select data-part="battery">${opt(Object.fromEntries(Object.entries(P.batteries).filter(([k]) => S.batteryFits(spec.frame, k))), spec.battery)}</select></label>
    <label>Electronics<select data-part="electronics">${opt(Object.fromEntries(Object.entries(P.electronics).filter(([k]) => S.electronicsFit(spec.frame, k))), spec.electronics)}</select></label>
    ${(WHOOP_LOOK.frames[spec.frame] || {}).ring && (WHOOP_LOOK.canopies[spec.electronics] || {}).bridge ? `<label>Canopy<select id="gCanopy"><option value="beastbrain" ${(spec.canopy || 'beastbrain') === 'beastbrain' ? 'selected' : ''}>Beast Brain (printed)</option><option value="bridge" ${spec.canopy === 'bridge' ? 'selected' : ''}>Air bridge</option></select></label>` : ''}
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
    <div class="row advRow"><button id="gAdvOpen">⚙ Advanced physics…</button><span class="note">${advSummary()}</span></div>
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
      <label class="chk" title="Draw the whoop's own frame, ducts and props in the FPV view (H while flying). Off: a clean picture with nothing of the quad in it. The chase view always shows it."><input type=checkbox id="gShowFrame" ${showFrame ? 'checked' : ''}> Show the frame in FPV</label>
      <label class="chk" title="On: the pack runs down as you fly, the voltage sags more near the end, and when it browns out the quad drops (B for a fresh pack). Off: it never runs down."><input type=checkbox data-tb="batteryLife" ${tune.batteryLife === true ? 'checked' : ''}> Battery life</label>
      <label class="chk" title="Betaflight's 3D mode: throttle stick in the middle is zero thrust, below the middle the motors spin backward so the quad can fly upside-down. Same as the 3 key while flying (1 acro, 2 angle)."><input type=checkbox data-t3d ${tune.flightMode === '3d' ? 'checked' : ''}> 3D mode (reversible motors)</label>
    </div>
    <details><summary>Import Betaflight <code>diff all</code></summary><textarea id="gDiff" placeholder="Paste the output of 'diff all' from the Betaflight CLI"></textarea><button id="gDiffBtn">Apply</button><span id="gDiffMsg"></span></details>
    <button id="gReset" class="ghost">Reset tune to defaults</button>`;
  drawRateCurve(); garagePreviewRefresh(); if (ADV.open) renderAdv();
}
function drawRateCurve() {
  const c = $('#rateCurve'); if (!c) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = '#555'; g.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  const cols = { roll: '#ff5a5a', pitch: '#5ad1ff', yaw: '#ffd25a' }, max = 2000;
  for (const ax of ['roll', 'pitch', 'yaw']) { g.strokeStyle = cols[ax]; g.beginPath(); for (let i = 0; i <= 100; i++) { const x = i / 100, r = S.applyRate(x, tune.rates[ax], tune.ratesType); const px = x * c.width, py = c.height - r / max * c.height; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.fillStyle = cols[ax]; g.fillText(`${ax} ${Math.round(S.applyRate(1, tune.rates[ax], tune.ratesType))}°/s`, 6, 14 + ['roll', 'pitch', 'yaw'].indexOf(ax) * 13); }
}
function applyParts() { Object.assign(spec, S.fitParts(spec)); params = S.buildDrone(spec); drone.setParams(params, tune); drone.reset(activeWorld.spawn); buildDroneMesh(); store.set('spec', spec); renderGarage(); }
// Named rate profiles (Garage & Tune): saved sets of rates type + roll/pitch/yaw rates, kept in this browser.
// Whole builds, named and kept like rate profiles: the five parts and the colours.
const myBuilds = () => { const a = store.get('builds', []); return Array.isArray(a) ? a.filter(b => b && typeof b.name === 'string' && b.spec && S.PARTS.frames[b.spec.frame] && S.PARTS.motors[b.spec.motor] && S.PARTS.props[b.spec.prop] && S.PARTS.batteries[b.spec.battery] && S.PARTS.electronics[b.spec.electronics]) : []; };
document.addEventListener('click', e => {
  // a typical ExpressLRS 250 Hz link: packets 250 times a second, about 12 ms from stick to flight controller, Betaflight's stock auto smoothing
  if (e.target.id === 'gLinkReal') { Object.assign(tune, { rcLinkHz: 250, rcDelayMs: 12, rcSmooth: 'auto', rcSmoothFactor: 30 }); saveTune(); renderGarage(); }
  if (e.target.id === 'gLinkIdeal') { Object.assign(tune, { rcLinkHz: 0, rcDelayMs: 0, rcSmooth: 'sim', rcSmoothFactor: 30 }); saveTune(); renderGarage(); }
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
// The credits on the main menu: one line that scrolls (owner, 2026-11-18: room to grow). The text is doubled so the loop
// has no seam, and the speed stays the same however long the credits get (about 40 px a second).
function creditsTicker() { const tr = $('#menuThanks .tkTrack'); if (!tr || tr.dataset.on) return; const it = tr.querySelector('.tkItem'); if (!it) return;
  tr.dataset.on = '1'; tr.appendChild(it.cloneNode(true)).setAttribute('aria-hidden', 'true');
  const set = () => { const w = it.getBoundingClientRect().width; if (w > 0) tr.style.setProperty('--tkDur', Math.max(15, w / 40).toFixed(1) + 's'); }; set(); addEventListener('resize', set); setTimeout(set, 1500); }
creditsTicker();
// the News box (news.txt, shipped by build.py as window.PW_NEWS; plain text, always escaped)
{ const nw = String(window.PW_NEWS || '').trim(), el = $('#menuNews'); if (el && nw) { $('#menuNewsText').textContent = nw; el.classList.remove('hide'); } }
// ============================================================ Advanced physics (a popup from the Garage)
// Everything that shapes how the whoop flies beyond the parts and the PIDs, in tabs, with sliders and button rows rather
// than drop-downs. The Betaflight tab uses Betaflight's own settings (src/sim.js FlightController; imported from a diff all
// or straight from a Blackbox log's header); untouched, every one of them is the sim as it always was (S.BF_SIM).
const ADV = { open: false, tab: 'feel' };
// [tune key, name, min, max, step, shown = value × this, unit, what it does, default]
const ADV_SL = {
  wobble: [['shake', 'Wobble', 0, 4, 0.05, 100, '%', 'Air that is never still: the wobble a light whoop has in its own air. 0 = the old glassy-smooth sim; the default (70%) is the owner\'s own tuning; 225% matches a real 30000KV whoop\'s Blackbox logs', FEEL_DEF.shake],
    ['shakeTau', 'Wobble smoothness', 0.03, 0.4, 0.01, 1000, ' ms', 'How slowly the wobble changes: longer is a lazy float, shorter a quick shudder', FEEL_DEF.shakeTau],
    ['shakeMove', 'Wobble on movement', 0, 1, 0.1, 100, '%', '100%: the wobble comes with turns and speed and a still hover stays calm; 0%: the same wobble all the time', FEEL_DEF.shakeMove],
    ['loopDelayMs', 'Motor / ESC delay', 0, 6, 0.5, 1, ' ms', 'A real quad answers a few ms late (DShot, the ESC, the motor). More is softer but rings; the Feel Lab measured about 3 ms on a real whoop', FEEL_DEF.loopDelayMs],
    ['camBuzz', 'Camera buzz', 0, 2, 0.1, 100, '%', 'A fine hum of motor vibration on the FPV picture only (it does not move the quad)', FEEL_DEF.camBuzz]],
  filters: [['gyroLpfHz', 'Gyro lowpass 1 (min)', 0, 500, 5, 1, ' Hz', 'gyro_lpf1: lower is smoother and laggier. With a max above it, it is dynamic and opens with the throttle (0 = off)', 180],
    ['gyroLpfMaxHz', 'Gyro lowpass 1 dynamic max', 0, 1000, 10, 1, ' Hz', 'gyro_lpf1_dyn_max_hz (0 = static)', 0],
    ['gyroLpf2Hz', 'Gyro lowpass 2', 0, 1000, 10, 1, ' Hz', 'gyro_lpf2_static_hz (0 = off)', 0],
    ['dtermLpfHz', 'D-term lowpass 1 (min)', 0, 300, 5, 1, ' Hz', 'dterm_lpf1: the D-term amplifies every twitch, so it is filtered harder (0 = off)', 90],
    ['dtermLpfMaxHz', 'D-term lowpass 1 dynamic max', 0, 400, 5, 1, ' Hz', 'dterm_lpf1_dyn_max_hz (0 = static)', 0],
    ['dtermLpf2Hz', 'D-term lowpass 2', 0, 400, 5, 1, ' Hz', 'dterm_lpf2_static_hz (0 = off)', 0]],
  extras: [['simMaster', 'Master multiplier', 0.5, 2, 0.05, 100, '%', 'simplified_master_multiplier: all the PID gains together, on top of the table', 1],
    ['simPI', 'Tracking (P and I)', 0.5, 2, 0.05, 100, '%', 'simplified_pi_gain: how hard it holds the rate you ask for', 1],
    ['simD', 'Damping (D)', 0.3, 2, 0.05, 100, '%', 'simplified_d_gain: stops overshoot and bounce-back; too much feels dull and hot', 1],
    ['simFF', 'Stick response (FF)', 0, 2, 0.05, 100, '%', 'simplified_feedforward_gain: how sharply it reacts to stick movement', 1],
    ['tpaRate', 'TPA rate', 0, 100, 5, 1, '%', 'tpa_rate: how much the gains fade at full throttle (Betaflight 4.5: 65% on D)', 0],
    ['tpaBreakpoint', 'TPA breakpoint', 0, 0.9, 0.05, 1000, '', 'tpa_breakpoint: the throttle where TPA starts (shown as 1000-2000 like Betaflight; 1350 stock)', 0.35, 1000],
    ['antiGravity', 'Anti-gravity', 0, 250, 5, 1, '', 'anti_gravity_gain: speeds up the I-term on quick throttle moves so the nose holds on punches and chops (80 stock)', 0],
    ['thrustLinear', 'Thrust linear', 0, 150, 5, 1, '%', 'thrust_linear: more authority low in the throttle, where whoop props push weakly (whoop tunes often use 20-40)', 0],
    ['throttleBoost', 'Throttle boost', 0, 100, 1, 1, '', 'throttle_boost: a short kick when the throttle moves quickly (5 stock)', 0],
    ['motorOutputLimit', 'Motor output limit', 20, 100, 5, 1, '%', 'motor_output_limit: caps the motors, like a smaller battery or a softer build', 100]]
};
const advVal = d => { const v = tune[d[0]]; return v == null || !isFinite(+v) ? d[8] : +v; };
const advShow = d => { const v = advVal(d); if (d[0] === 'tpaBreakpoint') return Math.round(1000 + v * 1000); if (/Lpf.*Hz$/.test(d[0]) && !v) return 'off'; return (Math.round(v * d[5] * 10) / 10) + d[6]; };
const advSlider = d => `<label class="advS" title="${d[7]}"><span>${d[1]} <b id="advV-${d[0]}">${advShow(d)}</b></span><input type=range data-adv="${d[0]}" min=${d[2]} max=${d[3]} step=${d[4]} value="${advVal(d)}"></label>`;
const advSeg = (key, opts, cur, title = '') => `<div class="advSeg" title="${title}">${opts.map(([v, l]) => `<button data-advset="${key}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function advSummary() {
  const n = [];
  if (FEEL.some(([k]) => (tune[k] ?? 1) !== (k === 'weightFeel' ? WEIGHT_DEF : 1)) || (tune.wallGrip ?? WALL_GRIP_DEF) !== WALL_GRIP_DEF || (tune.deadSpin ?? DEAD_SPIN_DEF) !== DEAD_SPIN_DEF || (tune.drain ?? DRAIN_DEF) !== DRAIN_DEF || (tune.propCt ?? PROP_FIT.ct) !== PROP_FIT.ct || (tune.propCq ?? PROP_FIT.cq) !== PROP_FIT.cq || tune.propFM != null || !tune.inflow) n.push('feel');
  if (ADV_SL.wobble.some(d => advVal(d) !== d[8])) n.push('wobble');
  if ([...ADV_SL.filters, ...ADV_SL.extras].some(d => advVal(d) !== d[8]) || ['gyroLpfType', 'dtermLpfType', 'gyroLpf2Type', 'dtermLpf2Type'].some(k => tune[k] && tune[k] !== 'PT1')) n.push('Betaflight');
  if (tune.rcLinkHz || tune.rcDelayMs || (tune.rcSmooth && tune.rcSmooth !== 'sim')) n.push('radio link');
  return n.length ? 'Changed: ' + n.join(', ') : 'Feel, wobble, Betaflight filters and PID extras, radio link';
}
function renderAdv() {
  let el = $('#advModal'); if (!el) { el = document.createElement('div'); el.id = 'advModal'; document.body.appendChild(el); }
  const body = el.querySelector('.advBody'), sc = body ? body.scrollTop : 0;
  el.classList.remove('hide'); ADV.open = true;
  const tabs = [['feel', 'Feel'], ['wobble', 'Wobble and lag'], ['bf', 'Betaflight filters'], ['extras', 'PID extras'], ['link', 'Radio link']];
  let h = '';
  if (ADV.tab === 'feel') h = `<p class="note">How the whoop behaves in the air, on top of your parts. 100% is the sim as built from the parts (Weight defaults to 90%: real whoops hover like that in their Blackbox logs); these change only how the physics feels, not the parts or the Garage figures.</p>
    ${FEEL.map(([k, name, help]) => { const v = Math.round((+tune[k] || (tune[k] === 0 ? 0 : 1)) * 100), [lo, hi] = S.FEEL_KEYS[k]; return `<label class="advS" title="${help}"><span>${name} <b id="gFeelV-${k}">${v}%</b></span><input type=range data-feel="${k}" min=${lo * 100} max=${hi * 100} step=5 value="${v}"></label>`; }).join('')}
    ${advSlider(['wallGrip', 'Wall grip', 0.2, 1.4, 0.05, 100, '%', 'How hard the ducts grip a wall or the side of anything: push into a wall and the whoop sticks there. 45% is the ground\'s grip (the old sim slid down walls); the default 90% is TPU ducts on a wall', WALL_GRIP_DEF])}
    ${advSlider(['deadSpin', 'Disarmed spin drag', 0.02, 1, 0.02, 100, '%', 'How much air drag slows a tumbling quad once its motors are off. 100% is the old sim (a cut flip stops almost at once); the default 10% lets a disarmed flip, roll or flat spin carry right round for the disarm tricks', DEAD_SPIN_DEF])}
    ${advSlider(['drain', 'Battery drain', 1, 5, 0.1, 1, '×', 'How hard the motors pull on the pack (with Battery life on): the default 2.4× (with the fitted props) is what real whoops draw in their Blackbox logs (a 300 mAh pack lasts about 4 minutes of freestyle); 1× is the motor model alone; a cold day is about a third more', DRAIN_DEF])}
    ${advSlider(['propCt', 'Prop grip', 0.8, 2, 0.01, 100, '%', 'How much thrust the props make per turn: more grip, lower rpm at hover. The default 131% (with Prop load 180%) hovers an Air65 at about 34,000 rpm (a real one: 31,000; the parts alone: 38,000) with the same top thrust', PROP_FIT.ct])}
    ${advSlider(['propCq', 'Prop load', 0.8, 8, 0.05, 100, '%', 'How hard the props are to turn: more load, lower top rpm and more current. Raise it with Prop grip to keep the same top thrust', PROP_FIT.cq])}
    <div class="advPair" title="How the props' thrust changes as air flows through them. Momentum theory (the default): the rotor's own inflow is worked out, so a climb loses less thrust than the old straight line and flying forward gives some extra lift (translational lift). Hover is the same either way"><span>Prop thrust in moving air</span>${advSeg('inflow', [[1, 'Momentum theory'], [0, 'Straight line (old)']], tune.inflow ? 1 : 0)}</div>
    <div class="row"><button data-advreset="feel" class="ghost">Feel back to the defaults</button><button data-advfeel="logload" class="ghost" title="Fitted to the owner's Air65 Blackbox logs (2026-11-27): prop grip 170 % and a figure of merit of 0.15 (the props plus the motors' own losses: about 680 % prop load on an Air65; moving Prop load takes it off), battery drain 1×. The motors' rpm at every throttle, the hover rpm and the current drawn match the logs; the whoop punches about half as hard (thrust to weight about 3)">Logged Air65 load</button></div>`;
  if (ADV.tab === 'wobble') h = `<p class="note">The life a real whoop has in the air, fitted from real Blackbox logs (Tools &amp; labs → Feel Lab). The defaults are the owner\'s own tuning. "Real 30000KV whoop" is what a real whoop\'s Blackbox logs measured: its wobble when moving, its lag (no extra delay needed).</p>
    ${ADV_SL.wobble.map(advSlider).join('')}<div class="row"><button data-advreset="wobble" class="ghost">Back to the defaults</button><button data-advpreset="fit30k" class="ghost" title="Fitted to a real 30000KV whoop's Blackbox logs: wobble 225 % at 100 ms, on movement">Real 30000KV whoop</button><button data-advpreset="logfit" class="ghost" title="The owner's Air2 build answered about 4 ms later than the 30000KV whoop: the same wobble with 3 ms of motor / ESC delay">Laggier whoop (+3 ms)</button><button data-advpreset="calm" class="ghost" title="The old smooth sim with a hint of wobble">Calm</button></div>`;
  if (ADV.tab === 'bf') h = `<p class="note">The flight controller's filters, as Betaflight has them. Lower cutoffs are smoother and laggier; a dynamic lowpass opens with the throttle. The sim has no motor noise to filter, so here they shape only the lag and the softness. Untouched: one 180 Hz gyro filter and one 90 Hz D-term filter, the sim as it always was.</p>
    ${ADV_SL.filters.slice(0, 3).map(advSlider).join('')}
    <div class="advPair"><span>Gyro lowpass 1 type</span>${advSeg('gyroLpfType', [['PT1', 'PT1'], ['PT2', 'PT2'], ['PT3', 'PT3'], ['BIQUAD', 'BIQUAD']], tune.gyroLpfType || 'PT1', 'gyro_lpf1_type')}</div>
    <div class="advPair"><span>Gyro lowpass 2 type</span>${advSeg('gyroLpf2Type', [['PT1', 'PT1'], ['PT2', 'PT2'], ['PT3', 'PT3'], ['BIQUAD', 'BIQUAD']], tune.gyroLpf2Type || 'PT1', 'gyro_lpf2_type')}</div>
    ${advSlider(['gyroLpfExpo', 'Gyro dynamic curve expo', 0, 10, 1, 1, '', 'gyro_lpf1_dyn_expo: how early in the throttle the dynamic filter opens', 5])}
    ${ADV_SL.filters.slice(3).map(advSlider).join('')}
    <div class="advPair"><span>D-term lowpass 1 type</span>${advSeg('dtermLpfType', [['PT1', 'PT1'], ['PT2', 'PT2'], ['PT3', 'PT3'], ['BIQUAD', 'BIQUAD']], tune.dtermLpfType || 'PT1', 'dterm_lpf1_type')}</div>
    <div class="advPair"><span>D-term lowpass 2 type</span>${advSeg('dtermLpf2Type', [['PT1', 'PT1'], ['PT2', 'PT2'], ['PT3', 'PT3'], ['BIQUAD', 'BIQUAD']], tune.dtermLpf2Type || 'PT1', 'dterm_lpf2_type')}</div>
    ${advSlider(['dtermLpfExpo', 'D-term dynamic curve expo', 0, 10, 1, 1, '', 'dterm_lpf1_dyn_expo', 5])}
    <div class="row"><button data-advpreset="bfstock">Betaflight 4.5 stock</button><button data-advpreset="sim" class="ghost">Sim default</button><label class="advFile" title="Reads the Betaflight settings in the log's header (filters, TPA, anti-gravity, thrust linear, boost, PIDs, idle). Nothing leaves the browser.">From my Blackbox log (.bbl)<input type=file id="advBbl" accept=".bbl,.bfl,.txt"></label></div><p class="note" id="advMsg"></p>`;
  if (ADV.tab === 'extras') h = `<p class="note">Betaflight's PID helpers. The first four are its simplified-tuning sliders, here on top of the PID table in the Garage (100% = the table as typed). Untouched, the rest are off.</p>
    ${ADV_SL.extras.slice(0, 4).map(advSlider).join('')}<h4>Throttle</h4>${ADV_SL.extras.slice(4).map(advSlider).join('')}
    <div class="advPair"><span>TPA mode</span>${advSeg('tpaMode', [['D', 'D only'], ['PD', 'P and D']], tune.tpaMode || 'D', 'tpa_mode')}</div>
    <div class="row"><button data-advpreset="bfstock">Betaflight 4.5 stock</button><button data-advpreset="sim" class="ghost">Sim default</button></div>`;
  if (ADV.tab === 'link') h = `<p class="note">By default your sticks reach the flight controller instantly, which is crisper than any real quad. These add what a real radio link does. Try "Real radio feel" if the sim feels harsher than your quad on the same rates.</p>
    <div class="advPair"><span>Radio link rate</span>${advSeg('rcLinkHz', [[0, 'ideal'], [50, '50'], [150, '150'], [250, '250'], [500, '500'], [1000, '1000 Hz']], +tune.rcLinkHz || 0)}</div>
    ${advSlider(['rcDelayMs', 'Link delay', 0, 80, 1, 1, ' ms', 'Radio + receiver delay', 0])}
    <div class="advPair"><span>Stick smoothing</span>${advSeg('rcSmooth', [['sim', 'sim (light)'], ['off', 'off'], ['auto', 'Betaflight auto']], tune.rcSmooth || 'sim')}</div>
    ${tune.rcSmooth === 'auto' ? advSlider(['rcSmoothFactor', 'Auto smoothing factor', 0, 250, 5, 1, '', 'rc_smoothing_auto_factor (30 stock)', 30]) : ''}
    <div class="row"><button id="gLinkReal">Real radio feel</button><button id="gLinkIdeal" class="ghost">Back to ideal</button></div>`;
  el.innerHTML = `<div class="advPanel"><div class="advHead"><h3>Advanced physics</h3><button id="advClose" class="ghost">Done</button></div>
    <div class="advTabs">${tabs.map(([k, l]) => `<button data-advtab="${k}" class="${ADV.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="advBody">${h}</div><p class="note advFoot">Changes apply at once; they are saved with your tune.</p></div>`;
  el.querySelector('.advBody').scrollTop = sc;
}
function closeAdv() { ADV.open = false; const el = $('#advModal'); if (el) el.classList.add('hide'); renderGarage(); }
document.addEventListener('click', e => {
  const t = e.target; if (!t || !t.closest) return;
  if (t.id === 'gAdvOpen') { renderAdv(); return; }
  if (t.id === 'advClose' || t.id === 'advModal') { closeAdv(); return; }
  if (t.dataset.advtab) { ADV.tab = t.dataset.advtab; const b = $('#advModal .advBody'); if (b) b.scrollTop = 0; renderAdv(); }
  if (t.dataset.advset) { const k = t.dataset.advset, v = t.dataset.v; tune[k] = /^-?\d+(\.\d+)?$/.test(v) ? +v : v; saveTune(); renderAdv(); }
  if (t.dataset.advreset === 'feel') { for (const [k] of FEEL) tune[k] = 1; tune.weightFeel = WEIGHT_DEF; tune.wallGrip = WALL_GRIP_DEF; tune.deadSpin = DEAD_SPIN_DEF; tune.drain = DRAIN_DEF; tune.propCt = PROP_FIT.ct; tune.propCq = PROP_FIT.cq; delete tune.propFM; tune.inflow = 1; saveTune(); renderAdv(); }
  if (t.dataset.advfeel === 'logload') { Object.assign(tune, LOG_LOAD); saveTune(); renderAdv(); }
  if (t.dataset.advreset === 'wobble') { Object.assign(tune, FEEL_DEF); saveTune(); renderAdv(); }
  if (t.dataset.advpreset) { const p = t.dataset.advpreset; Object.assign(tune, p === 'bfstock' ? S.BF_STOCK : p === 'sim' ? S.BF_SIM : p === 'calm' ? FEEL3 : p === 'fit30k' ? FEEL_FIT : { ...FEEL_FIT, loopDelayMs: 3 }); saveTune(); renderAdv(); }
});
document.addEventListener('input', e => { const t = e.target, k = t.dataset && t.dataset.adv; if (!k) return;
  const d = [...ADV_SL.wobble, ...ADV_SL.filters, ...ADV_SL.extras].find(x => x[0] === k) || { gyroLpfExpo: [k, '', 0, 0, 0, 1, '', '', 5], dtermLpfExpo: [k, '', 0, 0, 0, 1, '', '', 5], rcDelayMs: [k, '', 0, 0, 0, 1, ' ms', '', 0], rcSmoothFactor: [k, '', 0, 0, 0, 1, '', '', 30] }[k];
  tune[k] = +t.value; if (k === 'propCq' || k === 'propCt') delete tune.propFM; const b = $('#advV-' + k); if (b && d) b.textContent = advShow(d); });
document.addEventListener('change', e => { if (e.target && e.target.id === 'gShowFrame') setShowFrame(e.target.checked); });
document.addEventListener('change', async e => { const t = e.target;
  if (t.dataset && t.dataset.adv) saveTune();
  if (t.id === 'advBbl' && t.files && t.files[0]) { const msg = $('#advMsg');
    try { const buf = new Uint8Array(await t.files[0].arrayBuffer()); let text;
      if (/\.txt$/i.test(t.files[0].name)) text = new TextDecoder().decode(buf);
      else { const logs = BBL.decode(buf); if (!logs.length) throw new Error('no logs in that file'); text = Object.entries(logs[logs.length - 1].headers || {}).map(([k, v]) => 'H ' + k + ':' + v).join('\n'); }
      const r = S.importDiff(text, tune); Object.assign(tune, r.tune); saveTune(); renderAdv(); const m = $('#advMsg'); if (m) m.textContent = r.found.length ? `Read ${r.found.length} Betaflight settings from ${t.files[0].name} (filters, extras, PIDs, idle).` : 'No Betaflight settings found in that file.';
    } catch (err) { if (msg) msg.textContent = 'Could not read that log: ' + err.message; } }
});
addEventListener('keydown', e => { if (ADV.open && e.key === 'Escape') { e.stopPropagation(); closeAdv(); } }, true);
const rateProfiles = () => { const a = store.get('rateProfiles', []); return Array.isArray(a) ? a.filter(p => p && p.name && p.rates) : []; };
function rateEdited() { if (tune.rateProfile) { const p = rateProfiles().find(x => x.name === tune.rateProfile); if (!p || p.ratesType !== tune.ratesType || JSON.stringify(p.rates) !== JSON.stringify(tune.rates)) { tune.rateProfile = ''; const m = $('#gRPMsg'); if (m) m.textContent = 'Changed since it was saved — press Save to keep these.'; const sel = $('#gRP'); if (sel) sel.value = ''; } } }
document.addEventListener('click', e => {
  if (e.target.id === 'gRPSave') { const name = $('#gRPName').value.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); if (!name) { $('#gRPMsg').textContent = 'Give the profile a name first.'; $('#gRPName').focus(); return; }
    const all = rateProfiles().filter(p => p.name !== name); all.push({ name, ratesType: tune.ratesType, rates: JSON.parse(JSON.stringify(tune.rates)) }); all.sort((a, b) => a.name.localeCompare(b.name)); store.set('rateProfiles', all.slice(0, 30)); tune.rateProfile = name; saveTune(); renderGarage(); }
  if (e.target.id === 'gRPDel' && tune.rateProfile) { store.set('rateProfiles', rateProfiles().filter(p => p.name !== tune.rateProfile)); tune.rateProfile = ''; saveTune(); renderGarage(); }
});
function saveTune() { detector.camTilt = tune.camTilt; drone.setParams(params, tune); store.set('tune', tune); resize(); buildDroneMesh(); }
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.feel; if (k) { const v = $('#gFeelV-' + k); if (v) v.textContent = e.target.value + '%'; } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'gPreset' && t.value) { spec = { ...S.PRESETS[t.value], ...(spec.look ? { look: spec.look } : {}), ...(spec.canopy ? { canopy: spec.canopy } : {}) }; applyParts(); }
  if (t.id === 'gMyBuild' && t.value) { const b = myBuilds().find(x => x.name === t.value); if (b) { spec = JSON.parse(JSON.stringify(b.spec)); applyParts(); } }
  if (t.id === 'gCanopy') { spec.canopy = t.value; store.set('spec', spec); buildDroneMesh(); renderGarage(); }
  if (t.dataset.look) { spec.look = { ...(spec.look || {}), [t.dataset.look]: t.value }; store.set('spec', spec); buildDroneMesh(); }
  if (t.dataset.part) { spec[t.dataset.part] = t.value; Object.assign(spec, S.fitParts(spec)); applyParts(); }
  if (t.id === 'gRT') { tune.ratesType = t.value; rateEdited(); saveTune(); renderGarage(); }
  if (t.dataset.r) { const [ax, k] = t.dataset.r.split('.'); tune.rates[ax][k] = +t.value; rateEdited(); saveTune(); drawRateCurve(); }
  if (t.id === 'gRP' && t.value) { const d = t.value === '__default__' ? { name: '', ratesType: S.defaultTune().ratesType, rates: S.defaultTune().rates } : rateProfiles().find(p => p.name === t.value);
    if (d) { tune.ratesType = d.ratesType; tune.rates = JSON.parse(JSON.stringify(d.rates)); tune.rateProfile = d.name; saveTune(); renderGarage(); } }
  if (t.dataset.pid) { const [ax, k] = t.dataset.pid.split('.'); tune.pid[ax][k] = +t.value; saveTune(); }
  if (t.dataset.t) { tune[t.dataset.t] = +t.value / (+t.dataset.scale || 1); saveTune(); }
  if (t.id === 'gLinkHz') { tune.rcLinkHz = +t.value; saveTune(); }
  if (t.dataset.feel) { tune[t.dataset.feel] = +t.value / 100; saveTune(); }
  if (t.id === 'gRcSmooth') { tune.rcSmooth = t.value; saveTune(); renderGarage(); }
  if (t.dataset.tb) { tune[t.dataset.tb] = t.checked; saveTune(); }
  if (t.dataset.t3d !== undefined) { if (t.checked) { if (tune.flightMode !== '3d') store.set('mode2d', tune.flightMode || 'acro'); setFlightMode('3d'); } else setFlightMode(store.get('mode2d', 'acro') === 'angle' ? 'angle' : 'acro'); saveTune(); }
  if (t.id === 'vol') { store.set('vol', +t.value); if (window._master) window._master.gain.value = +t.value; }
});
document.addEventListener('click', e => {
  if (e.target.id === 'gDiffBtn') { const r = S.importDiff($('#gDiff').value, tune); tune = Object.assign(tune, r.tune); saveTune(); renderGarage(); $('#gDiffMsg').textContent = r.found.length ? `Imported ${r.found.length} settings` : 'No Betaflight settings found'; }
  if (e.target.id === 'gReset') { tune = Object.assign(S.defaultTune(), FEEL_DEF, { weightFeel: WEIGHT_DEF, batteryLife: false }); saveTune(); renderGarage(); }   // the game's feel defaults too (the physics' own defaults have no wobble)
});

// ---------------- controls
let ctlTimer = null;
function openControls() { show('#controls'); renderControls(); clearInterval(ctlTimer); ctlTimer = setInterval(liveControls, 50); }
function deviceCard(d, kind) {
  if (!d) return `<div class="dev none"><b>No ${kind} detected</b><span>${kind === 'radio'
    ? 'Plug the radio in over USB and choose <i>USB Joystick (HID)</i> when it asks. In EdgeTX: SYS → Hardware / USB mode → Joystick. Then move a stick so the browser sees it.'
    : 'Connect a controller and press any button so the browser sees it.'}</span></div>`;
  return `<div class="dev"><b>${esc(d.name)}</b><span>${d.firmware ? esc(d.firmware) + ' · ' : ''}${d.vendor ? `USB ${esc(d.vendor)}:${esc(d.product)} · ` : ''}${d.axes} channels/axes · ${d.buttons} buttons</span></div>`;
}
function renderControls() {
  const mode = inputCfg.mode, P = prof(), pads = allPads().map(describePad);
  const tabs = ['keyboard', 'radio', 'gamepad'].map(m => `<button class="tab ${m === mode ? 'on' : ''}" data-mode="${m}">${m === 'radio' ? 'Radio' : m === 'gamepad' ? 'Gamepad' : 'Keyboard'}</button>`).join('');
  let body = '';
  if (mode === 'keyboard') {
    body = `<p class="note">Keyboard is for a quick look around (checking a map or a track). A radio is the real thing.</p><label class="chk"><input type="checkbox" id="kbAssistOn" ${kbAssistOn() ? 'checked' : ''}> Keyboard flight assist <small>(on: self-levels and holds its height. W A S D are the left stick: W / S climb and sink, let go to hover, A / D turn. The arrows are the right stick: lean forward, back, left, right. Shift faster, Space arms and disarms. Off: raw acro, W / S move the throttle)</small></label>`;
  } else {
    const isR = mode === 'radio', cur = readPad(mode), d = describePad(cur);
    const n = Math.max(8, cur ? cur.axes.length : 8);
    const chOpt = sel => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${isR ? 'CH' + (i + 1) : 'Axis ' + i}</option>`).join('');
    const sameKind = pads.filter(p => p.kind === mode), other = pads.filter(p => p.kind !== mode);
    const devSel = pads.length > 1 || (pads.length && !sameKind.length) ? `<label>Device<select id="cDev">${[...sameKind, ...other].map(p => `<option value="${encodeURIComponent(p.id)}" ${cur && cur.id === p.id ? 'selected' : ''}>${esc(p.name)}${p.kind !== mode ? ' (' + p.kind + '?)' : ''}</option>`).join('')}</select></label>` : '';
    const swRow = (key, s) => `<tr><td>${key}</td><td><select data-swt="${key}"><option value="axis" ${s.type === 'axis' ? 'selected' : ''}>${isR ? 'switch (channel)' : 'axis'}</option><option value="button" ${s.type === 'button' ? 'selected' : ''}>button</option></select>
      ${s.type === 'axis' ? `<select data-swi="${key}">${chOpt(s.i)}</select>` : `<input type=number min=0 max=31 data-swi="${key}" value="${s.i}">`}</td><td>${key === 'arm' && !isR ? `<label class="chk"><input type=checkbox data-swtog ${s.toggle ? 'checked' : ''}> toggle</label>` : ''}</td><td><div class="bar"><i id="lv_${key}"></i></div></td><td><button data-detect="${key}">Detect</button></td></tr>`;
    body = `${deviceCard(d, mode)}${devSel}
      ${isR ? `<p class="note">Defaults follow EdgeTX/OpenTX AETR order: CH1 roll · CH2 pitch · CH3 throttle · CH4 yaw · CH5 arm · CH6 reset. If a stick moves the wrong way, tick Invert.</p>` : `<p class="note">Mode 2 layout: left stick throttle/yaw, right stick pitch/roll. A = arm toggle, Y = respawn.</p>`}
      <table class="tt"><tr><th>Function</th><th>${isR ? 'Channel' : 'Axis'}</th><th>Invert</th><th>Live</th><th></th></tr>
      ${AX4.map(a => `<tr><td>${a}</td><td><select data-ax="${a}">${chOpt(P.axes[a].i)}</select></td><td><input type=checkbox data-inv="${a}" ${P.axes[a].inv ? 'checked' : ''}></td><td><div class="bar"><i id="lv_${a}"></i></div></td><td><button data-detect="${a}">Detect</button></td></tr>`).join('')}
      ${swRow('arm', P.arm)}${P.reset && P.reset.enabled === true ? swRow('reset', P.reset) : ''}
      <tr><td colspan="6"><label class="chk"><input type="checkbox" id="autoArmOn" ${autoArmOn() ? 'checked' : ''}> Take off without arming <small>(off by default: arm first, like a real quad. On: raising the throttle from rest arms it)</small></label></td></tr>
      <tr><td colspan="6">Stick view <select id="stickModeSel">${[1, 2, 3, 4].map(m => `<option value="${m}" ${stickMode() === m ? 'selected' : ''}>Mode ${m}${m === 2 ? ' (throttle left)' : m === 1 ? ' (throttle right)' : ''}</option>`).join('')}</select> <small>(how the on-screen sticks and Train's radio are drawn; it does not change which channel does what)</small></td></tr>
      <tr><td colspan="6"><label class="chk"><input type="checkbox" id="resetSwOn" ${P.reset && P.reset.enabled === true ? 'checked' : ''}> Use a switch to reset to the start <small>(off: only the <kbd>R</kbd> key resets, and disarming just stops the motors)</small></label></td></tr>
      </table>
      ${!isR ? `<label class="chk"><input type=checkbox id="cThrC" ${P.thrCentered ? 'checked' : ''}> Spring-centred throttle (stick up from centre = throttle)</label>` : ''}
      <div class="preflight" id="preflight"></div>
      <label>Stick deadband<input type=number step=0.005 min=0 max=0.2 id="cDb" value="${P.deadband}"></label>
      <button id="cCal">Calibrate: move all sticks to every corner, then click again</button>
      ${cur ? `<h3>${isR ? 'Channel monitor' : 'Raw axes'}</h3><div class="chmon">${cur.axes.map((_, i) => `<div><span>${isR ? 'CH' + (i + 1) : 'A' + i}</span><div class="bar"><i id="raw_${i}"></i></div></div>`).join('')}</div>` : ''}`;
  }
  $('#cBody').innerHTML = `<div class="tabs">${tabs}</div>${body}
    <div class="keys"><b>Keyboard</b> W/S throttle (assist: climb / sink, let go to hover) · A/D yaw · ↑↓ pitch · ←→ roll · Space arm / disarm · Shift faster · X cut · Space arm · T flip over · R respawn · 1 / 2 / 3 acro, angle, 3D mode · C chase cam · H show / hide the frame · V stick overlay · F flag the last call as wrong · Q flag a missed trick · Tab score breakdown · G trick debug · Esc pause</div>`;
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
  if (t.id === 'stickModeSel') { store.set('stickMode', +t.value); return; }
  if (t.id === 'kbAssistOn') { store.set('kbAssist', t.checked); return; }
  if (t.id === 'resetSwOn') { P.reset = P.reset || { type: 'axis', i: 5, th: 0.5 }; P.reset.enabled = t.checked; saveInput(); renderControls(); return; }
  if (t.id === 'cThrC') P.thrCentered = t.checked;
  if (t.id === 'cDb') P.deadband = +t.value;
  saveInput();
});
addEventListener('gamepadconnected', e => {
  const d = describePad(e.gamepad);
  if (inputCfg.mode === 'keyboard') { inputCfg.mode = d.kind; saveInput(); }
  if (!$('#controls').classList.contains('hide')) renderControls();
  else flash(`<b>${d.kind === 'radio' ? 'RADIO' : 'GAMEPAD'} CONNECTED</b><small>${esc(d.name)}${d.firmware ? ' · ' + esc(d.firmware) : ''}</small>`);
  updateMenuDevice();
});
addEventListener('gamepaddisconnected', () => { if (!$('#controls').classList.contains('hide')) renderControls(); updateMenuDevice(); });
function updateMenuDevice() {
  const el = $('#menuDevice'); if (!el) return;
  if (GPU_SOFT) { el.innerHTML = `<b style="color:#ff8b7d">Your browser is drawing the game without your graphics card</b> (hardware acceleration is off), so it will run slowly and work the CPU hard. Chrome / Edge: Settings → System → turn on "Use graphics acceleration when available", then relaunch. Firefox: Settings → General → Performance.`; return; } const d = describePad(readPad('radio')) || describePad(readPad('gamepad'));
  const h = inputCfg.mode === 'keyboard' ? (d ? `${d.kind === 'radio' ? 'Radio' : 'Gamepad'} found: <b>${esc(d.name)}</b> — switch to it under Controls.` : 'Input: keyboard. Plug in your radio as a USB joystick for real acro.')
    : (describePad(readPad()) ? `Input: <b>${describePad(readPad()).name}</b> (${inputCfg.mode})` : `Input: ${inputCfg.mode} — not connected yet. Move a stick once it's plugged in.`);
  if (el.__h !== h) { el.__h = h; el.innerHTML = h; }   // every 2 s: only when it changed, so a click on the menu is never cut in half
}

// ---------------- trick list
// "▶ watch" (the bot flies the trick for the pilot to judge) shows only for these pilots for now (owner, 2026-11-19)
const TRICK_WATCHERS = ['heyheykoolaid', 'rodfpv'];
// Train a trick is still being worked on: only these pilots see its button for now (owner, 2026-11-21)
const TRICK_TRAINERS = ['heyheykoolaid', 'rodfpv', 'autismo'];
// Links to Tyrantt's Tricktionary (owner, 2026-11-25, with Tyrantt's blessing): each trick links to its counterpart on prowhooper.com.
// PW_SITE_URL takes a trick's own page (name -> path) when we have one; otherwise the link goes to the trick's category page there.
// Tricks that are ours alone (PW_SITE_NONE) get no link.
const PW_SITE = 'https://prowhooper.com';
const PW_SITE_CAT = { 'Open Air Tricks': '/open-air/', 'Powerloops': '/powerloops/', 'Maverick Loops': '/maverick-loops/', 'Matty Flips': '/matty-flips/', 'SplitS': '/split-s/', 'Pole Dancing': '/pole-dancing/', 'Jump Roping': '/jump-ropes/', 'Rewinds': '/rewinds/', 'Wall Tricks': '/wall-tricks/', 'Gaps': '/gaps/', 'Other Tricks': '/misc-tricks/' };
const PW_SITE_URL = {"Flip": "/flip/", "Double Flip": "/double-flip/", "Roll": "/roll/", "Double Roll": "/double-roll/", "Segmented Flips/Rolls": "/segmented-flips-rolls/", "Yaw Spin": "/yaw-spin/", "Inverted Rewind": "/inverted-rewind/", "Vanny Roll": "/vanny-roll/", "Rubik's Cube": "/rubiks-cube/", "Cubik's Rube": "/cubiks-rube/", "Juicy Flick": "/juicy-flick/", "Snapback": "/snapback/", "Inverted Yaw Spin": "/inverted-yaw-spin/", "Inverted Yaw Tracking": "/inverted-yaw-tracking/", "Powerloop": "/powerloop/", "Immelmann": "/immelmann/", "Power Split": "/power-split/", "Power Flip": "/power-flip/", "Reversed Power Flip": "/reversed-power-flip/", "Power Swap": "/power-swap/", "Power Switch": "/power-switch/", "Power Roll": "/power-roll/", "Loop to Matty": "/loop-to-matty/", "Inverted 360 Powerloop": "/inverted-360-powerloop/", "Barani": "/barani/", "Maverick Loop": "/maverick-loop/", "Mavvy Roll": "/mavvy-roll/", "Half Mavvy": "/half-mavvy/", "Mavik's Loop": "/maviks-loop/", "Mavani": "/mavani/", "Donkey Loop": "/donkey-loop/", "Beginner Matty": "/beginner-matty/", "Matty Flip": "/matty-flip/", "Matty Twister": "/matty-twister/", "Half Matty": "/half-matty/", "540 Half Matty": "/540-half-matty/", "Matty 360": "/matty-360/", "Forani": "/forani/", "Split S": "/split-s-2/", "540 Split S": "/540-split-s/", "Splitback": "/splitback/", "Split Yaw": "/split-yaw/", "Split Stall Matty Rewind": "/split-stall-matty-rewind/", "Orbits": "/orbits/", "Cradle": "/cradle/", "Side-Lock Rewind": "/side-lock-rewind/", "Whiplash": "/whiplash/", "Pole Dance": "/pole-dance/", "Trippy Spin": "/trippy-spin/", "Trippy Switch": "/trippy-switch/", "Double Rolling Trippy Spin": "/double-rolling-trippy-spin/", "Jump Rope": "/jump-rope/", "Cinnamon Roll": "/cinnamon-roll/", "Burrito Roll": "/burrito-roll/", "Side Loop": "/side-loop/", "Double Dutch": "/double-dutch/", "Stall Flip Rewind": "/stall-flip-rewind/", "Stall 360 Rewind": "/stall-360-rewind/", "Stall Matty Rewind": "/stall-matty-rewind/", "Stall Half Matty Rewind": "/stall-half-matty-rewind/", "Stall 540 Half Matty Rewind": "/stall-540-half-matty-rewind/", "Building Dive": "/building-dive/", "Wall Ride": "/wall-ride/", "Wall Tap": "/wall-tap/", "Roll Tap": "/roll-tap/", "Loop Tap": "/loop-tap/", "Ceiling Tap": "/ceiling-tap/", "Reverse Wall Ride": "/reverse-wall-ride/", "Downtown Tap": "/downtown-tap/", "Maverick Tap Rewind": "/maverick-tap-rewind/", "Power Switch Tap": "/power-switch-tap/", "Knife Edge": "/knife-edge/", "Reverse Knife Edge": "/reverse-knife-edge/", "Ninja Star": "/ninja-star/", "Gaps": "/gaps-2/", "Face Punch": "/face-punch/", "Slide Disarm": "/slide-disarm/", "Perch": "/perch/", "Eject Roll": "/eject-roll/", "Stellar Eject Roll": "/stellar-eject-roll/", "Blind Loop": "/blind-loop/", "True Barani": "/true-barani/", "Stall Rewind": "/stall-rewind/", "Beginner Switch": "/beginner-switch/", "Mavvelmann": "/mavvelmann/", "Anti Matty": "/anti-matty/", "Power Matty": "/power-matty/", "Immelloop": "/immelloop/", "Matty Roll": "/matty-roll/", "Immelmatt": "/immelmatt/", "Rollani": "/rollani/", "Flipani": "/flipani/", "Inverted Uh-uh": "/inverted-uh-uh/"};   // read from prowhooper.com/all-tricks/ on 2026-11-25
const PW_SITE_NONE = new Set(['Half Matty Pendulum', 'Juicy Tornado', 'Rollback', 'Juicy Rollback', 'Cube Eject', 'Corner Climb', 'Wall Stick', 'Disarm Flip', 'Disarm Roll', 'Disarm Spin', 'Dead Pirate Spin', 'Disarm Loop', 'INVERTED']);
function pwSiteUrl(name, cat) { if (PW_SITE_NONE.has(name)) return ''; const own = PW_SITE_URL[name], c = PW_SITE_CAT[(cat || '').trim()]; return own ? PW_SITE + own : c ? PW_SITE + c : ''; }
function pwSiteLink(name, cat) { const u = pwSiteUrl(name, cat); return u ? ` <a class="watch pwSite" href="${u}" target="_blank" rel="noopener" title="${PW_SITE_URL[name] ? 'See ' + esc(name) + ' in Tyrantt\'s Tricktionary' : 'Find ' + esc(name) + ' in Tyrantt\'s Tricktionary (opens its category on prowhooper.com)'}">↗ prowhooper.com</a>` : ''; }
function openTricks() {
  show('#tricksScreen'); const det = new Set(S.DETECTABLE), dr = S.DRAFT, watchOk = TRICK_WATCHERS.includes((pilotName() || '').trim().toLowerCase()), trainOk = TRICK_TRAINERS.includes((pilotName() || '').trim().toLowerCase());
  const cats = {}; for (const t of window.TPW_TRICKS) (cats[t.cat.trim()] = cats[t.cat.trim()] || []).push(t);
  const all = window.TPW_TRICKS.filter(t => t.pts > 0), nDet = all.filter(t => det.has(t.name.trim())).length, nDraft = all.filter(t => dr.has(t.name.trim())).length;
  $('#tBody').innerHTML = `<p class="note">${nDet} of ${all.length} tricks have detection rules. <b>●</b> tested rule · <b>◐</b> new draft rule written from the TPW description — fly it in Trick Training so it can be confirmed. Points and execution rules come from the TPW calculator. Trick of the Week: Split S, Powerloop, Matty Flip (×2, ×2, ×1.5, ×1). The tricks, their names and demos are from <a class="pwHome" href="${PW_SITE}/" target="_blank" rel="noopener">Tyrantt's Pro Whooper Tricktionary ↗</a>: <b>↗ prowhooper.com</b> by a trick opens that trick's page there.</p>` + (trainOk ? coachLadderHtml() : '') +
    Object.entries(cats).map(([c, ts]) => `<div class="ttCat"><h3>${c}${PW_SITE_CAT[c] ? ` <a class="watch pwSite" href="${PW_SITE + PW_SITE_CAT[c]}" target="_blank" rel="noopener" title="This category in Tyrantt's Tricktionary">↗ prowhooper.com</a>` : ''}</h3><table class="tt">${ts.map(t => { const n = t.name.trim(), has = det.has(n), d = dr.has(n);
      return `<tr class="${has ? 'det' : 'nodet'}" data-tq="${esc(`${n} ${c} ${t.diff}`.toLowerCase())}"><td title="${d ? 'draft rule' : has ? 'tested rule' : 'not detected'}">${has ? (d ? '◐' : '●') : '○'}</td><td><b>${t.name}</b>${d ? ' <small class="draftTag">draft</small>' : ''}${trainOk && coachCan(n) ? ` <a href="#" class="watch train" data-train="${encodeURIComponent(n)}" title="Fly it step by step with the game coaching you, then for real, then connected to another trick">🎓 train</a>${coachMark(n)}` : ''}${pwSiteLink(n, t.cat)}${watchOk && window.Maneuvers && window.Maneuvers.LIB[n] ? ` <a href="#" class="watch" data-watch="${n}" title="the bot flies it — judge it">▶ watch</a>` : ''}</td><td>${t.diff}</td><td>${t.pts}</td><td class="desc">${t.desc}${tellApart([n]).replace(/tellApart/g, 'tellApart tA')}${(sp => `<div class="spot">Fly it on: <b>${sp.on.join(', ')}</b>${sp.demo ? ` · demo: ${sp.demo}` : ''}</div>`)(S.trickSpots(n, t.cat))}</td></tr>`; }).join('')}</table></div>`).join('') + '<p class="note hide" id="tNone">No trick by that name.</p>';
  trickFilter();
}
// the Tricktionary's search box (owner, 2026-11-25): narrows the list as you type; matches the trick's name, category or difficulty
function trickFilter() {
  const box = $('#tSearch'), q = box ? box.value.trim().toLowerCase().split(/\s+/).filter(Boolean) : []; let any = false;
  for (const cat of document.querySelectorAll('#tBody .ttCat')) { let n = 0;
    for (const tr of cat.querySelectorAll('tr[data-tq]')) { const ok = q.every(w => tr.dataset.tq.includes(w)); tr.classList.toggle('hide', !ok); if (ok) n++; }
    cat.classList.toggle('hide', !n); if (n) any = true; }
  const none = $('#tNone'); if (none) none.classList.toggle('hide', any);
}
{ const box = $('#tSearch'); if (box) { box.addEventListener('input', trickFilter); box.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && box.value) { box.value = ''; trickFilter(); e.preventDefault(); } }); } }



// the on-screen pause button (phones and tablets have no Esc key)
// fullscreen next to pause (owner, 2026-11-20); hidden where the browser has no fullscreen (iPhone Safari)
{ const fb = $('#hudFull'), de = document.documentElement, can = !!(de.requestFullscreen || de.webkitRequestFullscreen);
  if (!can) fb.classList.add('hide');
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const sync = () => { fb.textContent = isFull() ? '🗗' : '⛶'; fb.title = isFull() ? 'Leave fullscreen (Esc)' : 'Fullscreen'; };
  fb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fb.blur();
    try { if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const p = (de.requestFullscreen || de.webkitRequestFullscreen).call(de); if (p && p.catch) p.catch(() => {}); } } catch { /* refused */ } });
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync); sync(); }
$('#hudPause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (mode === 'fly') pause(); });
