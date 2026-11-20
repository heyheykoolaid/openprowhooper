// ============================================================ Train a trick (Tricktionary → 🎓 Train; owner, 2026-11-20)
// "Click 'train' and the game will walk you through the trick, step by step, and judge you on what you need to do. The
// first 2 tries are the trick broken down into its components, then the last 2 are live reviews."
// Tries 1-2 (parts): the trick as a list of steps (passes under / over the object and rotations), each judged as it is
// flown from what the detector measures (its rotation tokens and over/under passes). A step that comes out wrong says by
// how much and waits for another go. Tries 3-4 (live): the whole trick, judged by the real detector; a miss lists what was
// measured against what the trick needs. The steps come from the detector's own rules (OPEN_TRICKS / OBSTACLE_TRICKS
// patterns and their over/under order), plus a few written by hand for the families whose rules are code (COACH_HAND).
// Labels: the game knows what the pilot meant to fly, but nothing is assumed: after a live call of the trick the pilot says
// whether it really was one (Y / N); "I did it, the game missed it" (Q) adds it. Those are ordinary decided review labels
// (recap events / flags), saved with the run. A failed try sends nothing (nothing undecided is a "no").
const COACH_HAND = {
  'Maverick Loop': { cross: 'UOU', steps: [{ pass: 'U' }, { pass: 'O', text: 'Pitch back and climb over the top, staying upright and looking forward the whole way (no flip)' }, { pass: 'U', text: 'Come back down and under, still upright' }] },
  'Mavvy Roll': { cross: 'UOU', steps: [{ pass: 'U' }, { rot: 'R*~360', during: ['O'], text: 'Maverick up and over; at the top, a full roll' }, { pass: 'U', text: 'Finish the maverick back under, upright' }] },
  'Beginner Matty': { cross: 'OU', steps: [{ pass: 'O' }, { pass: 'U', text: 'Drop the throttle, ease the nose up and fly backward under it (no flip)' }, { pass: 'O', text: 'Climb back up and over it' }] },
  'Jump Rope': { cross: 'OU', steps: [{ pass: 'O', text: 'Turn side-on and hop sideways over it, upright' }, { pass: 'U', text: 'Drop down the far side and swing back sideways under it' }] },
  'Side Loop': { cross: 'UOU', steps: [{ pass: 'U', text: 'Turn side-on under it' }, { rot: 'R*~360', during: ['O'], text: 'Roll toward it all the way round: over the top upside-down' }, { pass: 'U', text: 'Back under, level again' }] },
  'Double Dutch': { cross: 'UOU', steps: [{ pass: 'U', text: 'Turn side-on under it' }, { rot: 'R*360', during: ['O'], text: 'Jump over it sideways and flick a quick full roll at the top' }, { pass: 'U', text: 'Drop back under, upright' }] },
  'Blindflip': { cross: 'OU', steps: [{ rot: 'Y*~180', text: 'Just before the object, a half yaw spin so you face away from it' }, { rot: 'P+~360', during: ['O'], text: 'Throttle up and pitch back into a blind loop over it' }, { pass: 'U', text: 'Finish the loop back under it' }] },
  'Cinnamon Roll': { cross: 'OU', steps: [{ pass: 'O', text: 'Hop sideways over it, upright' }, { rot: 'Y*~360', text: 'A slow full yaw spin as you come down, staying upright' }, { pass: 'U', text: 'Finish the spin as you pass back under' }] },
};
const COACH_TRIES = 4, COACH_PARTS = 2;
// owner, 2026-11-20: "the trick trainer should understand that a lot of beginners will be sloppy at first". The steps take
// rotations well off the mark (a half flip from ~95° to ~265°, a full one from ~250° to ~470°), pieces of one rotation with a
// pause between them, and passes a good second either side of it; each says how clean it was. The live tries go by the
// game's own calls, where sloppy is a grade, not a miss.
const COACH_JOIN = 0.9, COACH_TOL = p => Math.max(p.loose ? 110 : 85, p.deg * 0.3);
const coach = { on: false, name: null, t: null, steps: [], cross: '', end: null, tryN: 0, phase: 'parts', since: 0, seenTok: new Map(), seenPass: new Map(), toks: [], passes: [], msg: '', obj: null, result: null, ask: null, log: [] };
const coachDeg = d => ({ 90: 'quarter', 135: 'three-eighths', 180: 'half', 270: 'three-quarter', 360: 'full', 540: 'one and a half', 720: 'double' })[d] || d + '°';
function coachRotText(p, vars) {
  const ax = { R: 'roll', P: 'flip', Y: 'yaw spin' }[p.ax], deg = coachDeg(p.deg);
  let dir = '';
  if (p.ax === 'P' && p.dir === '+') dir = ' back'; else if (p.ax === 'P' && p.dir === '-') dir = ' forward';
  else if (p.dir === '+' || p.dir === '-') dir = p.dir === '+' ? ' to the right' : ' to the left';
  else if (/[ab]/.test(p.dir)) { const v = p.dir.slice(-1), neg = p.dir[0] === '-'; dir = vars.has(v) ? (neg ? ' the other way' : ' the same way as before') : ''; vars.add(v); }
  return `A ${deg} ${ax}${dir}${p.inv ? ', upside-down' : ''} <small>(${p.loose ? 'about ' : ''}${p.deg}°)</small>`;
}
// the trick as steps: { pass: 'U' | 'O' } or { rot: <parsed pattern token>, during: ['O'…] }, from its rule. A rule with
// several patterns (a roll or a flip in, a Matty either way out) gives one list of steps per pattern: `alts`, judged together
function coachSteps(pat, ob) {
  const cross = ob ? ob.cross : '', steps = [], rots = pat.map(p => ({ rot: p, during: [] }));
  const lead = cross && (cross[0] === 'O' || (cross[0] === 'U' && (cross.length > 1 || ob.passFirst)));
  if (lead) steps.push({ pass: cross[0] });
  const mid = cross.length > 2 ? cross.slice(1, -1) : (cross === 'UO' ? 'O' : '');
  [...mid].forEach((k, i) => { const r = rots[Math.min(i, rots.length - 1)]; r.during.push(k); });
  steps.push(...rots);
  const tail = cross.length >= 2 && cross !== 'UO' ? cross.slice(-1) : (cross === 'U' && !ob.passFirst ? 'U' : '');
  if (tail) steps.push({ pass: tail, end: ob.end });
  return steps;
}
function coachPlan(name) {
  const h = COACH_HAND[name];
  if (h) { const st = h.steps.map(s => s.rot ? { ...s, rot: S.parsePattern(s.rot)[0] } : { ...s }); return { cross: h.cross, end: null, steps: st, alts: [st] }; }
  const obs = S.OBSTACLE_TRICKS.filter(t => t.name === name && !t.tap), op = S.OPEN_TRICKS.find(t => t.name === name);
  if (!obs.length && !op) return null;
  const alts = obs.length ? obs.flatMap(ob => ob.parsed.map(p => coachSteps(p, ob))) : op.parsed.map(p => coachSteps(p, null));
  return { cross: obs.length ? obs[0].cross : '', end: obs.length ? obs[0].end || null : null, steps: alts[0], alts };
}
// judge every way the rule allows; the one that got furthest is the one shown
function coachJudgeAny(alts, t0, strict) { let best = null, bi = 0; alts.forEach((st, i) => { const j = coachJudge(st, t0, strict); if (!best || j.done / st.length > best.done / alts[bi].length + 1e-9) { best = j; bi = i; } }); best.steps = alts[bi]; return best; }
function coachStepText(s, vars) {
  const where = coach.obj ? `the <b>${esc(coach.obj)}</b>` : 'the object';
  if (s.text) return s.text + (s.pass ? ` <small>(${s.pass === 'U' ? 'under' : 'over'} ${where})</small>` : '');
  if (s.pass) return `${s.pass === 'U' ? 'Fly under' : 'Go over'} ${where}${s.end === 'back' ? ', flying backward' : s.end === 'fwd' ? ', flying forward' : ''}`;
  return coachRotText(s.rot, vars) + (s.during && s.during.length ? ` <small>— ${s.during.map(k => k === 'O' ? 'over ' + where : 'under ' + where).join(', ')} on the way</small>` : '');
}
const coachCan = name => !!coachPlan(name);
// ---- what the detector measured, kept here (the detector forgets tokens after 6 s and passes after a while)
function coachCollect() {
  const D = detector; for (const k of D.toks || []) { const id = k.ax + k.t0.toFixed(3); if (!coach.seenTok.has(id)) { coach.seenTok.set(id, 1); coach.toks.push({ ax: k.ax, dir: k.dir, raw: k.raw, t0: k.t0, t1: k.t1, inv: k.inv > (k.n || 1) * 0.5 }); } }
  for (const c of D.crossLog || []) { if (c.kind !== 'U' && c.kind !== 'O') continue; const id = c.kind + c.obj + c.t.toFixed(3); if (!coach.seenPass.has(id)) { coach.seenPass.set(id, 1); coach.passes.push({ kind: c.kind, t: c.t, obj: c.obj, name: c.name, fwdDot: c.fwdDot }); } }
  const old = D.time - 30; coach.toks = coach.toks.filter(k => k.t1 > old); coach.passes = coach.passes.filter(c => c.t > old);
}
// match the steps in order against what was measured since `t0`. Returns per step { ok, msg } and how far it got.
// A rotation step takes the next finished token on its axis; a wrong one (too short, too long, wrong way) is reported
// and the step keeps waiting for a better one (parts mode), so a step can be tried again without starting over.
function coachJudge(steps, t0, strictObj) {
  const out = steps.map(() => ({ ok: false, msg: '' })); let since = t0, i = 0, obj = null; const vars = {};
  for (; i < steps.length; i++) {
    const s = steps[i];
    if (s.pass) {
      const c = coach.passes.find(c => c.kind === s.pass && c.t >= since - 0.3 && (obj == null || !strictObj || c.obj === obj));
      if (!c) { const other = obj != null && coach.passes.find(c => c.kind === s.pass && c.t >= since - 0.3 && c.obj !== obj); if (other) out[i].msg = `that was ${other.kind === 'U' ? 'under' : 'over'} the ${esc(other.name)}: use the same object`; break; }
      if (obj == null) obj = c.obj; out[i] = { ok: true, msg: esc(c.name), t: c.t, t0: c.t - 0.35 }; since = Math.max(since, c.t - 0.2); continue;
    }
    const p = s.rot, tol = COACH_TOL(p);
    let hit = null, last = null, other = null;
    // beginners stop and start: a rotation broken into pieces (the same way, under COACH_JOIN s apart) counts as one
    const joined = []; for (const k of coach.toks) { const j = joined[joined.length - 1];
      if (j && j.ax === k.ax && j.dir === k.dir && k.t0 - j.t1 < COACH_JOIN && j.raw < p.deg + tol) joined[joined.length - 1] = { ...j, raw: j.raw + k.raw, t1: k.t1, inv: j.inv || k.inv, pieces: (j.pieces || 1) + 1 }; else joined.push({ ...k }); }
    for (const k of joined) {
      if (k.t0 < since - 0.4) continue;
      if (k.ax !== p.ax) { if (k.raw > 150 && !hit) other = { k, why: `that was a ${{ R: 'roll', P: 'flip', Y: 'yaw spin' }[k.ax]} of ${Math.round(k.raw)}°; this part is a ${{ R: 'roll', P: 'flip', Y: 'yaw spin' }[p.ax]}` }; continue; }
      const dirOk = p.dir === '*' || (p.dir === '+' ? k.dir === 1 : p.dir === '-' ? k.dir === -1 : (() => { const v = p.dir.slice(-1), w = p.dir[0] === '-' ? -1 : 1; return vars[v] === undefined || vars[v] * w === k.dir; })());
      if (Math.abs(k.raw - p.deg) <= tol && dirOk && (!p.inv || k.inv)) { hit = k; break; }
      last = { k, why: !dirOk ? (p.ax === 'P' ? `wrong way: this part pitches ${p.dir.includes('+') ? 'back' : 'forward'}` : 'the other way round this time') : p.inv && !k.inv ? 'this one is done upside-down' : `yours was ${Math.round(k.raw)}°, aim for ${p.loose ? 'about ' : ''}${p.deg}°` };
    }
    if (!hit) { if (last || other) out[i].msg = (last || other).why; break; }
    if (/[ab]/.test(p.dir)) { const v = p.dir.slice(-1), w = p.dir[0] === '-' ? -1 : 1; if (vars[v] === undefined) vars[v] = hit.dir * w; }
    // the passes made during this rotation
    const miss = (s.during || []).filter(kd => !coach.passes.some(c => c.kind === kd && c.t >= hit.t0 - 1.0 && c.t <= hit.t1 + 1.5 && (obj == null || c.obj === obj)));
    if (miss.length) { out[i].msg = `the ${coachDeg(p.deg)} ${{ R: 'roll', P: 'flip', Y: 'yaw spin' }[p.ax]} was good (${Math.round(hit.raw)}°) but it didn't go ${miss[0] === 'O' ? 'over' : 'under'} the object`; break; }
    if (obj == null) { const c = coach.passes.find(c => (s.during || []).includes(c.kind) && c.t >= hit.t0 - 1.0 && c.t <= hit.t1 + 1.5); if (c) obj = c.obj; }
    const off = Math.abs(hit.raw - p.deg), grade = off <= 30 && !hit.pieces ? 'clean' : off <= tol * 0.6 && !hit.pieces ? 'a bit off' : 'sloppy, still counts';
    out[i] = { ok: true, msg: `${Math.round(hit.raw)}° · ${grade}${hit.pieces ? ' (in ' + hit.pieces + ' pieces: try it in one go next)' : ''}`, t: hit.t1, t0: hit.t0 }; since = hit.t0 + Math.min(0.5, (hit.t1 - hit.t0) * 0.5);
  }
  return { out, done: i, objName: obj != null ? (coach.passes.find(c => c.obj === obj) || {}).name : null };
}
// ---- the session
// ---- The Training Room (owner, 2026-11-20): Train always happens there. From any other map it stores the trick and where
// the pilot came from, loads the room (a reload, like any map change) and starts on arrival; Done / Free fly / Menu load the
// pilot's own map again (Done reopens the Tricktionary). The room holds every kind of obstacle; the pilot is put in front
// of the one the trick needs (`coachStation`), and R brings them back there.
const ROOM = 'training';
const COACH_CAT_ST = { 'Open Air Tricks': 'open', 'Other Tricks': 'open', Powerloops: 'bar', 'Maverick Loops': 'bar', 'Matty Flips': 'bar', SplitS: 'bar', 'Jump Roping': 'bar',
  'Pole Dancing': 'pole', Rewinds: 'pole', 'Wall Tricks': 'wall', Gaps: 'gap' };
const COACH_ST_OVR = { Dive: 'tower', Perch: 'tower', 'Ceiling Tap': 'slab', 'Slide Disarm': 'open', Facepunch: 'pilot', 'Stall Rewind': 'wall', 'Wall Stick': 'wall', 'Juicy Flick': 'open', 'Juicy Tornado': 'open',
  'Inverted Yaw Tracking': 'pole', 'Eject Roll': 'pole', 'Stellar Eject Roll': 'pole', 'Maverick Tap Rewind': 'bar', 'Power Switch Tap': 'bar', Snapback: 'bar', Forani: 'bar', 'True Barani': 'bar', Blindflip: 'bar' };
function coachStation(name, cat, plan) {
  let st = COACH_ST_OVR[name] || COACH_CAT_ST[(cat || '').trim()] || 'open';
  if (st === 'open' && plan && plan.cross) st = 'bar';   // anything flown over and under something
  return st;
}
const COACH_SPOTS = {   // the room's obstacle for each station, and where the pilot starts: [x, z, yaw] (yaw π/2 faces west, -π/2 east, π south)
  bar: ['Test Bar 2.2 m', -26.5, -12, Math.PI / 2], gap: ['Gap Gate 1.1 m', -30, -19, Math.PI / 2], pole: ['Test Pole medium', -36, 9, Math.PI],
  wall: ['Test Wall 3 m', -24, -10, -Math.PI / 2], tower: ['Dive Tower 14 m', -23, 6, -Math.PI / 2], slab: ['Ceiling Slab 2.3 m', -22, -3.5, Math.PI],
  pilot: ['Pilot', -18, 13, Math.PI], open: ['Open Air Box', -36, 2, Math.PI / 2] };
function coachGoRoom(name) {
  store.set('coachPending', { name, at: Date.now() }); if (world.id !== ROOM) store.set('trainBack', MAP_ID); store.set('map', ROOM);
  mapGoLoad('The Training Room');
}
function coachLeave(toTricks) {   // back to the pilot's own map (the room is only for training)
  if (world.id !== ROOM) { if (toTricks) { pause(); openTricks(); } return; }
  const back = store.get('trainBack', 'moose'); store.set('map', S.MAPS[back] && back !== ROOM ? back : 'moose'); store.set('coachPending', null); if (toTricks) store.set('tricksPending', true);
  mapGoLoad(S.MAPS[store.get('map', 'moose')].title);
}
setTimeout(() => {   // arriving: start the trick that brought us here, or reopen the Tricktionary after leaving
  const P = store.get('coachPending', null); if (P && world.id === ROOM) { store.set('coachPending', null); coachStart(P.name); return; }
  if (store.get('tricksPending', false)) { store.set('tricksPending', false); openTricks(); }
}, 1200);
// owner, 2026-11-20: "you should always start in the air armed, and moving the sticks takes control". In the Training Room
// every start (Train, R, back from Show me) puts the quad 1.5 m up at its station, armed, and holds it there (play.js skips
// the physics like a pause) until it is armed and a stick moves: then it is all yours.
function coachHoldStart() {
  if (!coach.on || world.id !== ROOM) return; const sp = activeWorld.spawn;
  drone.reset(sp); drone.pos = S.v3(sp.pos.x, sp.pos.y + 1.5, sp.pos.z); coach.hold = { thr0: null, at: performance.now() };
  if (!drone.armed) setArmed(true, true);   // armed whatever the throttle says: the hold keeps it still until a stick moves
}
function coachHeld(rc) {
  const H = coach.hold; if (!H || !coach.on || mode !== 'fly') return false;
  if (H.thr0 == null) H.thr0 = rc.thr;
  const moved = Math.max(Math.abs(rc.roll || 0), Math.abs(rc.pitch || 0), Math.abs(rc.yaw || 0)) > 0.2 || Math.abs((rc.thr || 0) - H.thr0) > 0.12;
  if (drone.armed && moved && performance.now() - H.at > 400) { coach.hold = null; flash('<b>YOUR CONTROL</b>'); return false; }
  return true;
}
function coachStart(name) {
  const plan = coachPlan(name); if (!plan) return;
  const t = window.TPW_TRICKS.find(x => x.name.trim() === name) || { name, cat: '', desc: '' };
  if (world.id !== ROOM) { coachGoRoom(name); return; }
  const stn = coachStation(name, t.cat, plan), sp = COACH_SPOTS[stn];
  world.spawn = { pos: S.v3(sp[1], 0.03, sp[2]), yaw: sp[3] }; coach.room = true;
  startFly(false);
  Object.assign(coach, { on: true, sticks: undefined, freeze: null, doneN: 0, name, t, steps: plan.steps, alts: plan.alts, cross: plan.cross, end: plan.end, tryN: 1, phase: 'parts', msg: '', result: null, ask: null, log: [], toks: [], passes: [], seenTok: new Map(), seenPass: new Map(), obj: null, done: false });
  coach.spots = [COACH_SPOTS[stn][0]]; coachNewTry(); coachHoldStart(); renderCoach();
  flash(`<b>TRAIN: ${esc(name).toUpperCase()}</b><small>tries 1-2 step by step · 3-4 the whole trick, judged live</small>`);
}
function coachNewTry() {
  coach.phase = coach.tryN <= COACH_PARTS ? 'parts' : 'live'; coach.since = detector.time; coach.steps = coach.alts[0]; coach.doneN = 0; coach.live = null; coach.preFroze = null; if (coach.freeze) coachFreezeEnd(); coach.result = null; coach.last = null;
  coachCollect(); coach.since = detector.time;
}
// the detector's clock restarts with a reset (R, a new flight): start the try's window again and forget what was measured
function coachClock() { coachHoldStart(); coach.doneN = 0; coach.live = null; coach.preFroze = null; if (coach.freeze) coachFreezeEnd(); coach.toks = []; coach.passes = []; coach.seenTok = new Map(); coach.seenPass = new Map(); coach.since = 0; coach.last = null; if (coach.ask) coach.ask = null; }
function coachStop(save = true) {
  if (!coach.on) return; coach.on = false; coach.hold = null; if (coach.freeze) coachFreezeEnd(); $('#coachBox').classList.add('hide');
  if (save && recap.dirty && !recap.guest) recapSave();
}
function coachTryDone(ok, how) {
  coach.log.push({ n: coach.tryN, phase: coach.phase, ok, how }); coach.result = { ok, how };
  if (coach.tryN >= COACH_TRIES) { coach.done = true; renderCoach(); return; }
  coach.tryN++; setTimeout(() => { if (coach.on && !coach.done) { coachNewTry(); renderCoach(); } }, ok ? 1600 : 0);
  renderCoach();
}
// live tries: the detector's own calls
function coachEvent(ev) {
  if (!coach.on || coach.done || mode !== 'fly' || ev.name === 'near') return;
  if (ev.name === 'Crash' || ev.exec === 'CRASH') { if (coach.phase === 'live' && !coach.ask) { coach.msg = 'Crashed: reset (R) and go again.'; renderCoach(); } return; }
  if (coach.phase !== 'live' || coach.ask) return;
  const i = recap.events.length - 1, e = recap.events[i]; if (!e || e.name !== ev.name) return;
  if (ev.name === coach.name) { coach.ask = { i, ok: true, exec: ev.exec, clean: ev.clean }; coach.msg = ''; }
  else { coachCollect(); const j = coachJudgeAny(coach.alts, coach.since, true); coach.ask = { i, ok: false, called: ev.name, judge: j }; }
  renderCoach();
}
function coachAnswer(a) {
  const A = coach.ask; if (!A) return; const e = recap.events[A.i];
  if (A.ok) {
    if (a === 'yes') { if (e) recapSetCall(A.i, coach.name); coach.ask = null; coachTryDone(true, `the game called it${A.exec ? ' (' + A.exec + (A.clean != null ? ' ' + A.clean + '%' : '') + ')' : ''}, you agreed`); return; }
    if (a === 'no') { if (e) { e.verdict = 'no'; e.actual = null; recap.dirty = true; } coach.ask = null; coach.msg = 'Not counted: go again.'; coachNewTry(); renderCoach(); return; }
  } else {
    if (a === 'mine') { if (e) recapSetCall(A.i, coach.name); coach.ask = null; coachTryDone(true, `your call: the game said ${A.called}`); return; }
    if (a === 'again') { coach.ask = null; coach.msg = ''; coachNewTry(); renderCoach(); return; }
  }
}
function coachMissed() {   // "I did it, the game missed it" (Q)
  if (!coach.on || coach.phase !== 'live' || coach.ask) return; const t = drone.time;
  recap.flags.push({ t0: +Math.max(0, t - 3).toFixed(3), t: +t.toFixed(3), actual: coach.name, added: true }); recap.dirty = true;
  coachTryDone(true, 'your call: the game missed it');
}
setInterval(() => {
  if (!coach.on) return;
  if (mode !== 'fly') { $('#coachBox').classList.add('hide'); return; }
  coachCollect();
  if (coach.phase === 'parts' && !coach.result) {
    if (coach.freeze) return;
    const j = coachJudgeAny(coach.alts, coach.since, true); coach.last = j; if (j.objName) coach.obj = j.objName; coach.steps = j.steps;
    if (j.done >= j.steps.length) { coach.doneN = 0; coachTryDone(true, 'every part'); return; }
    if (j.done > (coach.doneN || 0)) { coach.doneN = j.done; if (coach.preFroze !== j.done) coachFreezeStart(j.done); coach.preFroze = null; }   // already paused there as the rotation came round (coachLive)
  }
  renderCoach();
}, 150);
function renderCoach() {
  const box = $('#coachBox'); if (!coach.on || mode !== 'fly') { box.classList.add('hide'); return; } box.classList.remove('hide');
  const vars = new Set(), dots = Array.from({ length: COACH_TRIES }, (_, k) => { const L = coach.log[k]; return `<i class="${L ? (L.ok ? 'ok' : 'no') : k + 1 === coach.tryN ? 'on' : ''}" title="try ${k + 1}${k < COACH_PARTS ? ': step by step' : ': live'}"></i>`; }).join('');
  let body = '';
  if (coach.done) {
    const ok = coach.log.filter(l => l.ok).length;
    body = `<div class="trLast"><b>Done!</b> ${ok} of ${COACH_TRIES} tries.${coach.log.filter(l => l.phase === 'live').map(l => `<br>Live try ${l.n}: ${esc(l.how)}`).join('')}<br>Now fly it in a Session for points.</div>
      <div class="trBtns"><button data-co="again">⟲ Train again</button><button data-co="done">✓ Done</button><button data-co="stop" class="ghost">Free fly</button></div>`;
  } else if (coach.phase === 'parts') {
    const j = coach.last || { out: coach.steps.map(() => ({ ok: false, msg: '' })), done: 0 }, cur = (detector.cur || []).filter(Boolean).find(c => c.raw > 30);
    body = `<div class="trLast">Try ${coach.tryN} of ${COACH_TRIES} · <b>step by step</b>: fly each part; take your time between them. Sloppy counts: close is good enough to move on.${store.get('coachPauses', true) ? ' The game pauses after each part so you can set up the next.' : ''}</div><ol class="coSteps">${coach.steps.map((s, k) => { const o = j.out[k], st = o.ok ? 'ok' : k === j.done ? 'on' : '';
      return `<li class="${st}">${o.ok ? '✓ ' : k === j.done ? '▶ ' : ''}${coachStepText(s, vars)}${o.ok && o.msg ? ` <small class="coGot">${o.msg}</small>` : ''}${k === j.done && o.msg ? `<div class="coWhy">✗ ${o.msg}</div>` : ''}</li>`; }).join('')}</ol>
      ${cur ? `<div class="note">turning: ${{ R: 'roll', P: 'flip', Y: 'yaw' }[cur.ax]} ${Math.round(cur.raw)}°</div>` : ''}`;
  } else {
    const A = coach.ask;
    body = `<div class="trLast">Try ${coach.tryN} of ${COACH_TRIES} · <b>live</b>: the whole trick in one go.</div><ol class="coSteps dim">${coach.steps.map(s => `<li>${coachStepText(s, vars)}</li>`).join('')}</ol>
      ${A && A.ok ? `<div class="coRes ok">The game called <b>${esc(coach.name)}</b>${A.exec ? ` · ${esc(A.exec)}${A.clean != null ? ' ' + A.clean + '%' : ''}` : ''}${A.exec && A.exec !== 'CLEAN' ? ' <small>(sloppy is fine while you learn it)</small>' : ''}. Was it really one?</div><div class="trBtns"><button data-co="yes">✓ Yes <kbd>Y</kbd></button><button data-co="no">✗ Not really <kbd>N</kbd></button></div>` : ''}
      ${A && !A.ok ? `<div class="coRes no">The game called <b>${esc(A.called)}</b>. What it measured:</div><ol class="coSteps">${A.judge.steps.map((s, k) => { const o = A.judge.out[k]; return `<li class="${o.ok ? 'ok' : k === A.judge.done ? 'bad' : ''}">${o.ok ? '✓' : k === A.judge.done ? '✗' : '·'} ${coachStepText(s, new Set())}${o.ok && o.msg ? ` <small class="coGot">${o.msg}</small>` : ''}${k === A.judge.done ? `<div class="coWhy">${o.msg ? esc0(o.msg) : 'not seen'}</div>` : ''}</li>`; }).join('')}</ol>
        <div class="trBtns"><button data-co="again">Go again <kbd>N</kbd></button><button data-co="mine" class="ghost" title="It was a ${esc(coach.name)}: the game got it wrong">It was a ${esc(coach.name)} <kbd>Y</kbd></button></div>` : ''}
      ${!A ? `<div class="trBtns"><button data-co="missed" class="ghost" title="You flew it and the game said nothing">I did it, the game missed it <kbd>Q</kbd></button></div>` : ''}`;
  }
  const show = !!(window.Maneuvers && window.Maneuvers.LIB[coach.name]);
  const html = `<div class="trHead"><small>🎓 TRAIN</small><span class="coDots">${dots}</span></div><div class="trTarget">${esc(coach.name)}</div>
    <div class="trObs">${coach.obj ? `on <b>${esc(coach.obj)}</b>` : `fly it on: <b>${esc((coach.spots || []).join(', '))}</b>`}${coach.end === 'back' ? ' · ends flying backward' : ''}</div>
    ${coach.result && !coach.done ? `<div class="coRes ${coach.result.ok ? 'ok' : 'no'}">${coach.result.ok ? '✓ Try ' + (coach.tryN - 1) + ' done' : '✗'} <small>${esc(coach.result.how)}</small></div>` : ''}
    ${coach.msg ? `<div class="trMsg">${esc(coach.msg)}</div>` : ''}${body}
    <div class="trFoot">${!coach.done ? `<button data-co="pauses" class="ghost" title="Freeze the game between the parts of the step-by-step tries">${store.get('coachPauses', true) ? '⏸ Pauses: on' : '⏸ Pauses: off'}</button>` : ''}${show && !coach.done ? '<button data-co="ghost" class="ghost" title="Watch the bot fly it from its own camera, with its sticks and every step explained">👻 Show me</button>' : ''}${!coach.done ? '<button data-co="skip" class="ghost" title="K">Skip this try</button>' : ''}<button data-co="done" class="ghost" title="Back to the Tricktionary">✓ Done</button></div>`;
  if (html !== box.__h) { box.__h = html; box.innerHTML = html; }   // it is checked 7 times a second: rewriting it each time ate clicks (a click needs the same button under the press and the release)
}
const esc0 = s => s;   // judge messages are the game's own words (object names already escaped)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-co]'); if (!b) { const tb = e.target.closest('[data-train]'); if (tb) { e.preventDefault(); coachStart(decodeURIComponent(tb.dataset.train)); } return; }
  e.stopPropagation(); b.blur(); const a = b.dataset.co;
  if (a === 'yes' || a === 'no' || a === 'mine') coachAnswer(a);
  if (a === 'again') { if (coach.done) coachStart(coach.name); else coachAnswer('again'); }
  if (a === 'missed') coachMissed();
  if (a === 'pauses') { store.set('coachPauses', !store.get('coachPauses', true)); if (coach.freeze) coachFreezeEnd(); renderCoach(); }
  if (a === 'skip') { coach.ask = null; coachTryDone(false, 'skipped'); }
  if (a === 'ghost') coachDemo();
  if (a === 'stop') { coachStop(); renderCoach(); coachLeave(false); }   // Free fly: back on the pilot's own map
  if (a === 'tricks' || a === 'done') { coachStop(); coachLeave(true); }   // owner: Done goes back to the Tricktionary
});
addEventListener('keydown', e => {
  if (!coach.on || mode !== 'fly' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  const A = coach.ask;
  if (e.code === 'KeyY' && A) coachAnswer(A.ok ? 'yes' : 'mine');
  if (e.code === 'KeyN' && A) coachAnswer(A.ok ? 'no' : 'again');
  if (e.code === 'KeyQ' && !A) coachMissed();
  if (e.code === 'KeyK' && !coach.done) { coach.ask = null; coachTryDone(false, 'skipped'); }
});

// ---- Show me (owner, 2026-11-20: "it should go first person in the demo drone, so you can see the stick overlay, the game
// then breaks down the stick movement, as well as the setup and motions required"). The bot flies the trick (MV.make, on
// an over/under near the pilot on this map, or in open air above them) through Judge the Bot's player in its FPV view with
// the stick overlay (the sticks a pilot would need: MV.detect's rows), and a panel follows the flight: the setup (speed,
// height, what to fly at), then each step as it happens with what the sticks and throttle do there. Loops; Space pauses,
// S slows it down, C changes the camera, Esc / Back returns to the training (at the start, disarmed).
const demo = { steps: [], setup: '', cur: -1 };
function demoObjects() {
  const P = drone.pos, out = [];
  for (const o of world.objs) { const b = o.obstacle; if (!b || o.round || o.kind === 'pilot' || o.kind === 'edge' || !b.a || !b.b) continue;
    const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z); if (b.under < 0.9 || b.under > 3.2 || b.over - b.under > 1.5 || L < 1.2) continue;
    const mx = (b.a.x + b.b.x) / 2, mz = (b.a.z + b.b.z) / 2; out.push({ name: o.name, d: Math.hypot(mx - P.x, mz - P.z) }); }
  const seen = new Set(); return out.sort((a, b) => a.d - b.d).filter(x => !seen.has(x.name) && seen.add(x.name)).slice(0, 8);
}
function demoFly(name) {   // a flight of the trick on this map whose own detector calls it, with what it measured
  const MV = window.Maneuvers, open = !coach.cross && !COACH_HAND[name], seed0 = (Date.now() >>> 0), objs = open ? [] : demoObjects().map(o => o.name);
  // owner, 2026-11-20: real examples first. A confirmed example of the trick from the trick library (pilots' labels and the demo
  // GIFs, rebuilt as labels come in: MV.knowledge's `fromLibrary`), flown on this map; the hand-written script only when no learned
  // flight is called here
  const lib = MV.kbCan && MV.kbCan(name) && MV.kbExamples(name).length ? [0, 1, 2, 3].map(k => ({ lib: true, obj: objs.length ? objs[k % objs.length] : null })) : [];
  const tries = [...lib, ...(open ? [null, null, null] : objs).map(o => ({ lib: false, obj: o }))];
  for (let k = 0; k < tries.length; k++) {
    const T = tries[k]; let m = null;
    try { m = T.lib ? MV.fromLibrary(name, world, seed0 + k * 977, { object: T.obj || undefined, wobble: 0 }) : MV.make(name, world, seed0 + k * 977, T.obj ? { object: T.obj, wobble: 0 } : { wobble: 0 }); } catch { m = null; } if (!m) continue;
    if (T.lib && m.source !== 'library') continue;
    if (T.lib ? (m.object === 'open air' && !m.inPlace) : open) { const P0 = m.at(0).pos, off = S.sub(S.add(drone.pos, S.v3(0, 3.5, 0)), P0), base = m; m = { ...base, at: t => { const s = base.at(t); return { pos: S.add(s.pos, off), q: s.q }; } }; }
    const st = { toks: [], passes: [], seenTok: new Map(), seenPass: new Map() }, keep = { toks: coach.toks, passes: coach.passes, seenTok: coach.seenTok, seenPass: coach.seenPass }, orig = S.TrickDetector.prototype.update, D0 = detector;
    let got; Object.assign(coach, st);
    try { S.TrickDetector.prototype.update = function (...a) { const r = orig.apply(this, a); const D = this; for (const kk of D.toks || []) { const id = kk.ax + kk.t0.toFixed(3); if (!coach.seenTok.has(id)) { coach.seenTok.set(id, 1); coach.toks.push({ ax: kk.ax, dir: kk.dir, raw: kk.raw, t0: kk.t0, t1: kk.t1, inv: kk.inv > (kk.n || 1) * 0.5 }); } }
        for (const c of D.crossLog || []) { if (c.kind !== 'U' && c.kind !== 'O') continue; const id = c.kind + c.obj + c.t.toFixed(3); if (!coach.seenPass.has(id)) { coach.seenPass.set(id, 1); coach.passes.push({ kind: c.kind, t: c.t, obj: c.obj, name: c.name }); } } return r; };
      got = MV.detect(m, world, tune.camTilt, { rows: true }); }
    finally { S.TrickDetector.prototype.update = orig; }
    const j = coachJudgeAny(coach.alts, 0, true), ok = got.some(e => e.name === name) || j.done >= j.steps.length;
    Object.assign(coach, keep); void D0;
    if (T.lib && !ok) continue;   // a learned flight the game does not call here (its reading leaned on the pilot's own object): next
    if (ok || k === tries.length - 1) return { m, got, j, object: T.lib ? m.object : T.obj || 'open air', lib: T.lib };
  }
  return null;
}
const pct = v => Math.round(Math.abs(v) * 100);
function stickWords(rows, a, b) {   // what the sticks did between a and b (rows: t … thr 11 … roll 24, pitch 25, yaw 26)
  const R = rows.filter(r => r[0] >= a && r[0] <= b); if (!R.length) return '';
  const avg = k => R.reduce((s, r) => s + r[k], 0) / R.length, peak = k => R.reduce((m, r) => Math.abs(r[k]) > Math.abs(m) ? r[k] : m, 0);
  const out = [], P = peak(25), Ro = peak(24), Y = peak(26), t0 = R[0][11], t1 = R[R.length - 1][11], tl = Math.min(...R.map(r => r[11])), th = Math.max(...R.map(r => r[11]));
  if (Math.abs(P) > 0.15) out.push(`right stick <b>${P < 0 ? 'back' : 'forward'}</b> ${pct(P)}%`);
  if (Math.abs(Ro) > 0.15) out.push(`right stick <b>${Ro > 0 ? 'right' : 'left'}</b> ${pct(Ro)}%`);
  if (Math.abs(Y) > 0.15) out.push(`left stick <b>${Y > 0 ? 'right' : 'left'}</b> (yaw) ${pct(Y)}%`);
  out.push(th - tl > 0.2 ? `throttle <b>${pct(t0)}% → ${pct(tl === t1 || t1 < t0 ? tl : th)}%${t1 !== tl && t1 !== th ? ' → ' + pct(t1) + '%' : ''}</b>` : `throttle about <b>${pct(avg(11))}%</b>`);
  return out.join(' · ');
}
function demoBuild(f) {
  const rows = f.got.rows || [], j = f.j, st = j.steps;
  demo.steps = st.map((s, k) => { const o = j.out[k] || {}; return { s, ok: o.ok, t0: o.t0 ?? null, t1: o.t ?? null }; });
  // fill in times the judge could not place (the next / previous known ones)
  for (let k = 0; k < demo.steps.length; k++) { const d = demo.steps[k]; if (d.t0 == null) { const prev = demo.steps.slice(0, k).reverse().find(x => x.t1 != null); d.t0 = prev ? prev.t1 : 0.5; } if (d.t1 == null || d.t1 < d.t0) d.t1 = d.t0 + 0.6; }
  for (const d of demo.steps) { d.sticks = stickWords(rows, d.t0, d.t1); }
  const first = demo.steps.length ? demo.steps[0].t0 : 1, pre = rows.filter(r => r[0] >= first - 1 && r[0] < Math.max(first, 0.4));   // a move that starts at once: its first moments
  const v = pre.length ? pre.reduce((s, r) => s + Math.hypot(r[21], r[23]), 0) / pre.length : 0, h = pre.length ? pre.reduce((s, r) => s + r[2], 0) / pre.length : 0, th = pre.length ? pre.reduce((s, r) => s + r[11], 0) / pre.length : 0;
  demo.setup = `${f.object === 'open air' ? 'Open air, with room all round' : `Line up on the <b>${esc(f.object)}</b>`}: come in at about <b>${v.toFixed(1)} m/s</b>${f.object === 'open air' ? '' : `, <b>${h.toFixed(1)} m</b> up`}, throttle about <b>${pct(th)}%</b>, level.`;
  const M = f.m, src = f.lib ? `A real flight: ${M.by ? `<b>${esc(M.by)}</b>'s` : 'a pilot\'s'} confirmed ${esc(coach.name)}${M.map && S.MAPS[M.map] ? ` on ${esc(S.MAPS[M.map].title || M.map)}` : ''}${M.when ? `, ${esc(new Date(M.when).toLocaleDateString())}` : ''}, from the trick library.` : 'The bot\'s own version (no confirmed flight of it from pilots works here yet).';
  demo.setup += `<br><small>${src}</small>`;
  demo.called = f.got.map(e => e.name); demo.cur = -1;
}
function coachDemo() {
  const MV = window.Maneuvers; if (!MV || (!MV.LIB[coach.name] && !(MV.kbCan && MV.kbCan(coach.name) && MV.kbExamples(coach.name).length))) { flash('<b>NO DEMO YET</b><small>the bot has no flight of this trick</small>', 'near'); return; }
  const f = demoFly(coach.name); if (!f) { flash(`<b>NO SPOT FOR THE DEMO HERE</b><small>no bar the bot can use on this map: try the playground</small>`, 'near'); return; }
  demoBuild(f); ghostOff(); drone.armed = false;
  Object.assign(judge, { demo: coach.name, m: f.m, name: coach.name, events: f.got, rows: f.got.rows || null, t: 0, hold: 0, speed: 1, phase: 'demo', cam: 'fpv', source: f.lib ? 'library' : 'script', ex: f.lib ? f.m.ex : null, from: null, orb: null, keepOrb: false });
  const pts = []; for (let t = 0; t < f.m.T; t += 0.05) pts.push(f.m.at(t).pos); const C = S.mul(pts.reduce((a, p) => S.add(a, p), S.v3()), 1 / pts.length);
  judge.look = C; judge.camPos = S.add(C, S.v3(4, 1.2, 4)); judge.lookS = null;
  mode = 'judge'; show(null); $('#hud').classList.add('hide'); $('#coachBox').classList.add('hide'); $('#judgeBox').classList.remove('hide'); trailClear(); demoRender();
}
function demoBack() {
  judge.demo = null; demoArrows(); stopJudge(); mode = 'fly'; show(null); $('#hud').classList.remove('hide');
  drone.reset(activeWorld.spawn, true); detector.reset(); coachClock(); renderCoach();
  flash('<b>YOUR TURN</b><small>back at the start · arm and go</small>');
}
function demoTick() {
  demoArrows();
  const k = demo.steps.findIndex(d => judge.t >= d.t0 - 0.15 && judge.t <= d.t1 + 0.25), cur = k >= 0 ? k : (judge.t < (demo.steps[0] || {}).t0 ? -1 : demo.cur);
  if (cur !== demo.cur) { demo.cur = cur; demoRender(); }
}
function demoRender() {
  const box = $('#judgeBox'); if (!box || !judge.demo) return; const vars = new Set();
  const cams = Object.entries(JCAMS).map(([k, v]) => `<button data-jcam="${k}" class="${judge.cam === k ? 'on' : 'ghost'}">${v}</button>`).join('');
  box.innerHTML = `<div class="trHead"><small>👻 SHOW ME · ${esc(judge.demo)}</small><span class="jStat">${judge.speed === 0 ? 'paused' : 'speed ×' + judge.speed}</span></div>
    <div class="trRow jCam">${cams}</div>
    <div class="trLast ${demo.cur < 0 ? 'demoOn' : ''}"><b>Setup</b> · ${demo.setup}</div>
    <ol class="coSteps demoSteps">${demo.steps.map((d, k) => `<li class="${k === demo.cur ? 'on' : k < demo.cur ? 'ok' : ''}">${coachStepText(d.s, vars)}${d.sticks ? `<div class="demoStk">${d.sticks}</div>` : ''}</li>`).join('')}</ol>
    ${demo.called.length && !demo.called.includes(judge.demo) ? `<p class="note">(the game read this flight as ${esc(demo.called.join(' + '))}: the bot's version is rough)</p>` : ''}
    <div class="trLast"><kbd>Space</kbd> pause · <kbd>S</kbd> slow-mo · <kbd>C</kbd> camera · <kbd>Esc</kbd> back</div>
    <div class="trFoot"><button data-demo="again">⟲ Another flight</button><button data-demo="slow" class="ghost">${judge.speed === 1 ? 'Slow-mo' : 'Full speed'}</button><button data-demo="back" class="primary">◂ My turn</button></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-demo]'); if (!b) return; e.stopPropagation(); b.blur(); const a = b.dataset.demo;
  if (a === 'back') demoBack();
  if (a === 'slow') { judge.speed = judge.speed === 1 ? 0.35 : 1; demoRender(); }
  if (a === 'again') { const nm = judge.demo; judge.demo = null; demoArrows(); stopJudge(); mode = 'fly'; coach.name = nm; coachDemo(); }
});

// GoldenEye-style stick arrows (owner, 2026-11-20: "show the stick movements as big arrows around the center of the screen"):
// while Show me plays, the sticks the bot needs right now are drawn as big arrows round the crosshair: the right stick as
// arrows up / down (pitch forward / back) and left / right (roll), the left stick's yaw as a curved arrow over the top, and
// the throttle as a gauge on the left with an arrow while it is moving. Bigger and brighter the further the stick goes.
function demoArrows() {
  const cv = $('#demoArrows'), rows = judge.rows; if (!cv) return;
  const on = !!(judge.demo && mode === 'judge' && rows && rows.length > 1); if (!on) { if (!coach.freeze) cv.classList.add('hide'); return; }
  const dtR = (rows[rows.length - 1][0] - rows[0][0]) / (rows.length - 1), at = t => rows[Math.max(0, Math.min(rows.length - 1, Math.round((t - rows[0][0]) / dtR)))];
  const r = at(judge.t), r0 = at(judge.t - 0.15);
  drawStickArrows(r[25], r[24], r[26], r[11], (r[11] - r0[11]) / 0.15);
}
function drawStickArrows(P, R, Y, T, dT, live) {   // live: the pilot's own sticks { P, R, Y, T } (the pauses): each arrow fills as far as they push
  const cv = $('#demoArrows'); if (!cv) return; cv.classList.remove('hide');
  const W = cv.clientWidth, H = cv.clientHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'); g.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, u = Math.min(W, H) / 720, TH = 0.12, blink = 0.88 + 0.12 * Math.sin(performance.now() / 90);
  const col = v => `rgba(255,${Math.round(225 - 110 * Math.min(1, Math.abs(v)))},30,${(0.8 + 0.2 * Math.min(1, Math.abs(v))) * blink})`;
  const label = (txt, x, y, v) => { g.font = `bold ${Math.round(17 * u)}px ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';   // a dark pill behind the words, so they read on any background
    const tw = g.measureText(txt).width + 18 * u, th = 26 * u; g.fillStyle = 'rgba(10,10,12,.78)'; g.beginPath(); if (g.roundRect) g.roundRect(x - tw / 2, y - th / 2, tw, th, th / 2); else g.rect(x - tw / 2, y - th / 2, tw, th); g.fill();
    g.fillStyle = live ? '#fff' : col(v); g.fillText(txt, x, y); g.textBaseline = 'alphabetic'; };
  const along = (ang, v) => { if (!live) return 1; const k = ang === 0 || ang === Math.PI ? live.P : live.R, want = Math.sign(v); return Math.max(0, Math.min(1, (k || 0) * want / Math.max(0.3, Math.abs(v)))); };
  // a chunky arrow from the crosshair outward: ang 0 = up
  const arrow = (ang, v, txt) => { const a = Math.abs(v); if (a < TH) return; const room = ang === 0 ? cy - 70 * u - 250 * u : ang === Math.PI ? H - 175 * u - cy - 70 * u : 1e9, L = Math.max(40 * u, Math.min(room, (55 + 150 * Math.min(1, a)) * u)),   /* clear of the card above and the stick view below */ w = (16 + 14 * a) * u, r0 = 70 * u, s = Math.sin(ang), c = -Math.cos(ang), px = -c, py = s;
    const x0 = cx + s * r0, y0 = cy + c * r0, x1 = cx + s * (r0 + L), y1 = cy + c * (r0 + L), hx = cx + s * (r0 + L - w * 1.6), hy = cy + c * (r0 + L - w * 1.6);
    const shape = () => { g.beginPath(); g.moveTo(x0 + px * w * 0.45, y0 + py * w * 0.45); g.lineTo(hx + px * w * 0.45, hy + py * w * 0.45); g.lineTo(hx + px * w, hy + py * w); g.lineTo(x1, y1); g.lineTo(hx - px * w, hy - py * w); g.lineTo(hx - px * w * 0.45, hy - py * w * 0.45); g.lineTo(x0 - px * w * 0.45, y0 - py * w * 0.45); g.closePath(); }; shape();
    g.lineWidth = 5 * u; g.strokeStyle = 'rgba(0,0,0,.8)'; g.stroke();
    if (live) { const f = along(ang, v); g.fillStyle = 'rgba(20,20,24,.55)'; g.fill(); g.save(); g.clip();   // the target as an outline; the pilot's stick fills it from the crosshair out
      const R1 = r0 + (L + 2) * f; g.fillStyle = f >= 1 ? 'rgba(125,255,154,.95)' : col(v); g.beginPath(); g.arc(cx, cy, R1, 0, Math.PI * 2); g.arc(cx, cy, r0 - 4 * u, 0, Math.PI * 2, true); g.fill(); g.restore();
      shape(); g.lineWidth = 3 * u; g.strokeStyle = f >= 1 ? '#7dff9a' : col(v); g.stroke(); }
    else { g.fillStyle = col(v); g.fill(); }
    label(live ? txt : `${txt} ${Math.round(a * 100)}%`, cx + s * (r0 + L + 30 * u), cy + c * (r0 + L + 30 * u), v); };
  arrow(0, P > 0 ? P : 0, 'PITCH FWD'); arrow(Math.PI, P < 0 ? P : 0, 'PITCH BACK'); arrow(Math.PI / 2, R > 0 ? R : 0, 'ROLL R'); arrow(-Math.PI / 2, R < 0 ? R : 0, 'ROLL L');
  if (Math.abs(Y) >= TH) {   // yaw: a curved arrow over the crosshair, turning the way the nose goes
    const a = Math.abs(Y), rad = 120 * u, sp = (0.35 + 0.9 * a), dir = Y > 0 ? 1 : -1, a0 = -Math.PI / 2 - dir * sp, a1 = -Math.PI / 2 + dir * sp;
    g.lineCap = 'round'; g.lineWidth = (14 + 10 * a) * u + 6 * u; g.strokeStyle = 'rgba(0,0,0,.8)'; g.beginPath(); g.arc(cx, cy, rad, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    g.lineWidth = (14 + 10 * a) * u; g.strokeStyle = col(Y); g.beginPath(); g.arc(cx, cy, rad, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    const ex = cx + Math.cos(a1) * rad, ey = cy + Math.sin(a1) * rad, tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir, hw = (20 + 12 * a) * u;
    g.beginPath(); g.moveTo(ex + tx * hw * 1.4, ey + ty * hw * 1.4); g.lineTo(ex - ty * hw, ey + tx * hw); g.lineTo(ex + ty * hw, ey - tx * hw); g.closePath(); g.lineWidth = 5 * u; g.strokeStyle = 'rgba(0,0,0,.8)'; g.stroke(); g.fillStyle = col(Y); g.fill(); g.lineCap = 'butt';
    label(`YAW ${Y > 0 ? 'RIGHT' : 'LEFT'} ${Math.round(a * 100)}%`, cx, cy - rad - 28 * u, Y);
  }
  // throttle gauge, left of the crosshair (not in the pauses when the throttle is not asked for)
  if (T == null) return;
  const gx = cx - 300 * u, gh = 220 * u, gw = 26 * u, gy = cy - gh / 2;
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(gx - 3 * u, gy - 3 * u, gw + 6 * u, gh + 6 * u); g.fillStyle = col(T); g.fillRect(gx, gy + gh * (1 - T), gw, gh * T);
  label(`THR ${Math.round(T * 100)}%`, gx + gw / 2, gy + gh + 26 * u, T);
  if (Math.abs(dT) > 0.6) { const up = dT > 0, ay = up ? gy - 18 * u : gy + gh + 44 * u, s = 18 * u; g.beginPath(); g.moveTo(gx + gw / 2, ay + (up ? -s : s)); g.lineTo(gx + gw / 2 - s, ay); g.lineTo(gx + gw / 2 + s, ay); g.closePath(); g.lineWidth = 4 * u; g.strokeStyle = 'rgba(0,0,0,.8)'; g.stroke(); g.fillStyle = col(1); g.fill();
    label(up ? 'PUNCH IT' : 'CUT', gx + gw / 2, up ? ay - s - 8 * u : ay + s + 22 * u, 1); }
}

// ---- Pauses between the steps (owner, 2026-11-20: "add pauses to the first two teachings, between the segments, to allow
// the pilot to set up / learn the movement"). In the step-by-step tries, when a step is done (and the quad is armed and
// flying) the game freezes where it is: the physics, the trick detector's clock and the recording all stop (play.js skips
// its steps while `coachFrozen()`), so the pause adds no time, no air and no drift to the move: the next step is judged as
// if it came straight on. The screen shows the next step and, from the bot's own flight of the trick, the sticks it needs
// as arrows; it goes on when the pilot has held the sticks there for 1.5 s (owner: not a key press), so the move starts
// from exactly where it was with the sticks already set. Your own sticks show on the overlay as usual. ⏸ Pauses: on / off in the panel.
const COACH_HOLD = 1.5;   // s the sticks must be held where the next part needs them (owner: "holding your sticks in the correct position for a second and a half")
function coachFrozen() { return !!(coach.on && coach.freeze && mode === 'fly' && coach.scale < 0.02); }
// owner, 2026-11-20: "very rigid … can we add some dampening? when doing a snapback and looking back, the game should've just
// hung there for a moment". Two things: (1) the pause eases in and out (game time slows to a stop over ~0.3 s and comes back
// over ~0.5 s: `coachTimeScale`, play.js runs its physics at that speed), and (2) it starts as the rotation comes round,
// from the drone's own rates (`coachLive`, every frame), not when the detector has closed the rotation and the 150 ms check
// has judged it: by then a quick Snapback was already rolling. The live trigger allows for the slow-down, so the quad comes
// to rest about where the step ends (~95 % of it); the judge still decides the step from the measured rotation afterwards.
coach.scale = 1;
function coachTimeScale(dt) {
  if (!coach.on || mode !== 'fly') return (coach.scale = 1);
  const want = coach.freeze ? 0 : 1;
  coach.scale = want ? Math.min(1, coach.scale + dt / 0.5) : Math.max(0, coach.scale - dt / 0.3);
  const x = coach.scale; return x * x * (3 - 2 * x);   // smoothstep: no jolt at either end
}
const COACH_LIVE_ON = 95, COACH_LIVE_OFF = 60, COACH_EASE = 0.15;   // °/s to start / keep a live rotation; s of game time the ease-in still turns
function coachLive(simDt) {
  if (!coach.on || mode !== 'fly' || coach.phase !== 'parts' || coach.result || coach.freeze || !simDt || !store.get('coachPauses', true) || !drone.armed || drone.crashed) return;
  const r = drone.pilotRates(), L = coach.live || (coach.live = { R: null, P: null, Y: null });
  ['R', 'P', 'Y'].forEach((ax, i) => { const v = r[i], a = Math.abs(v), c = L[ax];
    if (c && (a < COACH_LIVE_OFF || Math.sign(v) !== c.sg)) { c.off += simDt; if (c.off > COACH_JOIN) L[ax] = null; else c.rate = a < COACH_LIVE_OFF ? 0 : c.rate; return; }   // a beginner's pause in the middle still counts as one rotation
    if (c) { c.acc += a * simDt; c.off = 0; c.rate = a; } else if (a >= COACH_LIVE_ON) L[ax] = { sg: Math.sign(v), acc: a * simDt, off: 0, rate: a }; });
  const k = coach.doneN || 0;
  // owner, 2026-11-20: "the lock for the juicy flick stopped a bit early": the rule's blended pattern (a ~135° flick) won the race
  // against the plain one. Of the patterns whose next step is this rotation, the pause waits for the fullest, and a half flip
  // pauses where the CAMERA is level with the horizon, upside-down: 180° plus the camera's uptilt on a forward flip (the camera
  // still looks down at 180°), minus it on a back flip (Snapback: level before 180°).
  let pick = null;
  for (const st of coach.alts) {
    const s0 = st[k]; if (!s0 || !s0.rot || k + 1 >= st.length) continue;   // the last step needs no pause: the trick is done
    const p = s0.rot, c = L[p.ax]; if (!c) continue;
    if ((p.dir === '+' && c.sg < 0) || (p.dir === '-' && c.sg > 0)) continue;   // P+ = pitch back, R+ = roll right (the detector's own signs)
    const tilt = Math.max(0, Math.min(60, +tune.camTilt || 0)), target = p.ax === 'P' && Math.abs(p.deg - 180) < 60 ? 180 + (c.sg < 0 ? tilt : -tilt) : p.deg;
    if (!pick || target > pick.target) pick = { st, c, target };
  }
  // Where each pause lands, from the quad's own attitude (owner, 2026-11-20), not the degree count (the live count misses the slow
  // start and end of a rotation, so a flick stopped by eye at the horizon never "reached" its degrees and never paused):
  // - a half flip pauses when the CAMERA is level with the horizon, upside-down (180° plus the uptilt forward, minus it back);
  // - a roll pauses when the WINGS are level (upside-down after a half roll, upright after a full one);
  // - anything else (yaw spins: level all the way) by degrees;
  // and whenever the pilot stops the rotation on the right side of it (they lined it up by eye), it pauses there.
  if (!pick) return;
  const p = pick.st[k].rot, c = pick.c, up = drone.up().y, deg = p.deg, go = () => { coach.steps = pick.st; coach.preFroze = k + 1; L.R = L.P = L.Y = null; coachFreezeStart(k + 1); };
  const stopped = c.off > 0.08, near = c.rate * COACH_EASE + 3;
  if (p.ax === 'P' && Math.abs(deg - 180) < 60) {
    const t = Math.max(0, Math.min(60, +tune.camTilt || 0)) * Math.PI / 180, cam = S.qrot(drone.q, S.v3(0, Math.sin(t), -Math.cos(t))), rem = Math.abs(Math.asin(Math.max(-1, Math.min(1, cam.y)))) * 180 / Math.PI;
    const closing = c.cy != null && rem < c.cy; c.cy = rem;
    if (c.acc >= deg * 0.5 && up < -0.2 && ((closing && rem <= near) || stopped)) go();
    else if (c.acc >= deg * 1.3 + 40) go();   // never level: pause anyway once well past it
    return;
  }
  if (p.ax === 'R' && (Math.abs(deg - 180) < 60 || Math.abs(deg - 360) < 90)) {
    const half = Math.abs(deg - 180) < 60, ry = Math.abs(drone.right().y), rem = Math.asin(Math.min(1, ry)) * 180 / Math.PI;
    const closing = c.ry != null && rem < c.ry, side = half ? up < -0.2 : up > 0.2; c.ry = rem;
    if (c.acc >= deg * 0.6 && side && ((closing && rem <= near) || stopped)) go();
    else if (c.acc >= deg * 1.3 + 40) go();
    return;
  }
  if (c.acc + c.rate * COACH_EASE >= pick.target * 0.97 || (stopped && c.acc >= pick.target * 0.8)) go();
}
function coachStepSticks() {   // the bot's sticks for each step, from one flight of the trick on this map (for the pause arrows)
  try { const f = demoFly(coach.name); if (!f || !f.got.rows) return null; const rows = f.got.rows, j = f.j;
    return { steps: j.steps, at: j.steps.map((st, k) => { const o = j.out[k] || {}; if (o.t0 == null) return null;
      const R = rows.filter(r => r[0] >= o.t0 && r[0] <= (o.t ?? o.t0 + 0.6)); if (!R.length) return null;
      const peak = c => R.reduce((m, r) => Math.abs(r[c]) > Math.abs(m) ? r[c] : m, 0);
      return { P: peak(25), R: peak(24), Y: peak(26), T: R[R.length - 1][11], dT: (R[R.length - 1][11] - R[0][11]) / Math.max(0.2, R[R.length - 1][0] - R[0][0]) }; }) }; } catch { return null; }
}
// where the sticks must be for the next part. Only the axis the part is about is checked (a half flip = the pitch, the
// right way), as far as the bot pushed it (at least half way), plus the throttle where the bot set it; the bot's other
// axes are its own wobble, not something to copy. A pass (fly under / over) asks for the stick forward, toward the object.
function coachTarget(k) {
  const S0 = coach.sticks, st = coach.steps[k];
  const sk = S0 && (S0.steps === coach.steps || S0.steps.length === coach.steps.length) ? S0.at[k] : null;
  const t = { P: 0, R: 0, Y: 0, T: sk ? sk.T : null, chk: [], src: sk ? 'bot' : 'rule' };
  if (st && st.rot) { const p = st.rot, v = p.dir === '+' ? 1 : p.dir === '-' ? -1 : 0, want = p.ax === 'P' ? -v : v;   // P+ = pitch back = stick back (negative)
    const key = p.ax === 'P' ? 'P' : p.ax === 'R' ? 'R' : 'Y', bot = sk ? sk[key] : 0;
    t[key] = Math.abs(bot) >= 0.2 && (!want || Math.sign(bot) === Math.sign(want)) ? bot : (want || 1) * 0.6; t.chk = [key]; if (!want) t.any = key; }
  else { t.P = sk && sk.P > 0.2 ? sk.P : 0.3; t.chk = ['P']; }
  return t;
}
// does the pilot hold them there? As forgiving as the steps (owner: "sloppy counts"): the right way at 30 % or more, whatever the bot pushed; the throttle
// within 0.35 of the bot's (not with the keyboard: keys have no throttle position to hold)
function coachStickCheck(T, rc) {
  const ax = (k, have) => { if (!T.chk.includes(k)) return true; const want = T[k]; if (T.any === k) return Math.abs(have) >= 0.3; return Math.sign(have) === Math.sign(want) && Math.abs(have) >= 0.3; };   // owner: as relaxed as the steps: the right way, 30 % or more
  const kb = inputCfg.mode === 'keyboard';   // keys have no throttle position to hold (height hold, or all-or-nothing W)
  const out = { P: ax('P', rc.pitch || 0), R: ax('R', rc.roll || 0), Y: ax('Y', rc.yaw || 0), T: T.T == null || kb || Math.abs((rc.thr || 0) - T.T) <= 0.35 };
  out.ok = out.P && out.R && out.Y && out.T; return out;
}
function coachFreezeStart(k) {
  if (!store.get('coachPauses', true) || !drone.armed || drone.crashed) return;
  if (coach.sticks === undefined) coach.sticks = coachStepSticks();
  coach.freeze = { k, held: 0, last: performance.now(), waited: 0 }; coachFreezeDraw();
}
function coachFreezeEnd() { coach.freeze = null; $('#coachFreeze').classList.add('hide'); if (!(judge.demo && mode === 'judge')) $('#demoArrows').classList.add('hide'); }
function coachFreezeDraw() {
  const F = coach.freeze, el = $('#coachFreeze'); if (!F) return;
  const st = coach.steps[F.k]; if (!st) { coachFreezeEnd(); return; }
  const T = coachTarget(F.k), c = F.check || { P: false, R: false, Y: false, T: false }, pctH = Math.min(100, Math.round(F.held / COACH_HOLD * 100));
  const word = (v, a, b) => Math.abs(v) < 0.15 ? 'centred' : v < 0 ? a : b;
  const row = (ok, txt) => `<i class="${ok ? 'ok' : ''}">${ok ? '✓' : '○'} ${txt}</i>`;
  const html = `<small>PAUSED · NEXT: STEP ${F.k + 1} OF ${coach.steps.length}</small><b>${coachStepText(st, new Set())}</b>
    <div class="cfSticks">${T.chk.includes('P') ? row(c.P, 'pitch ' + (T.any === 'P' ? 'either way' : word(T.P, 'back', 'forward'))) : ''}${T.chk.includes('R') ? row(c.R, 'roll ' + (T.any === 'R' ? 'either way' : word(T.R, 'left', 'right'))) : ''}${T.chk.includes('Y') ? row(c.Y, 'yaw ' + (T.any === 'Y' ? 'either way' : word(T.Y, 'left', 'right'))) : ''}${T.T != null && inputCfg.mode !== 'keyboard' ? row(c.T, 'throttle ~' + Math.round(T.T * 100) + '%') : ''}</div>
    <div class="cfBar"><i style="width:${pctH}%"></i><em>${coach.scale > 0.02 ? 'slowing down…' : pctH >= 100 ? 'GO' : `hold ${Math.max(0, COACH_HOLD - F.held).toFixed(1)} s`}</em></div>${F.waited > 15 ? '<span>Stuck? ⏸ Pauses: off in the panel turns them off.</span>' : ''}`;
  if (el.__h !== html) { el.__h = html; el.innerHTML = html; } el.classList.remove('hide');
  const thrAsked = T.T != null && !(inputCfg.mode === 'keyboard'), rc = lastRC || {};
  drawStickArrows(T.chk.includes('P') ? T.P : 0, T.chk.includes('R') ? T.R : 0, T.chk.includes('Y') ? T.Y : 0, thrAsked ? T.T : null, 0, { P: rc.pitch || 0, R: rc.roll || 0, Y: rc.yaw || 0, T: rc.thr || 0 });
}
setInterval(() => { if (!coach.freeze) return; if (!coach.on || mode !== 'fly' || coach.phase !== 'parts') { coachFreezeEnd(); return; }
  const F = coach.freeze, now = performance.now(), dt = Math.min(0.5, (now - F.last) / 1000); F.last = now; F.waited += dt;   // a long hitch counts at most half a second
  F.check = coachStickCheck(coachTarget(F.k), lastRC); F.held = F.check.ok ? (coach.scale < 0.02 ? F.held + dt : F.held) : Math.max(0, F.held - 2 * dt);   // the hold counts once it has come to rest
  if (F.held >= COACH_HOLD) coachFreezeEnd(); else coachFreezeDraw(); }, 100);
window.__pwCoach = { freeze: k => { coachFreezeStart(k); return !!coach.freeze; }, frozen: () => coachFrozen(), state: () => JSON.stringify({ ry: +drone.right().y.toFixed(2), held: !!coach.hold, y: +drone.pos.y.toFixed(2), sc: +coach.scale.toFixed(3), upY: +drone.up().y.toFixed(2), done: coach.doneN, t: coach.freeze ? coachTarget(coach.freeze.k) : null, f: coach.freeze, ph: coach.phase, on: coach.on, mode, armed: drone.armed, cr: drone.crashed }) };   // test hook (tools / smoke tests)
