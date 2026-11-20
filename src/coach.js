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
      if (obj == null) obj = c.obj; out[i] = { ok: true, msg: esc(c.name), t: c.t }; since = Math.max(since, c.t - 0.2); continue;
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
    out[i] = { ok: true, msg: `${Math.round(hit.raw)}° · ${grade}${hit.pieces ? ' (in ' + hit.pieces + ' pieces: try it in one go next)' : ''}`, t: hit.t1 }; since = hit.t0 + Math.min(0.5, (hit.t1 - hit.t0) * 0.5);
  }
  return { out, done: i, objName: obj != null ? (coach.passes.find(c => c.obj === obj) || {}).name : null };
}
// ---- the session
function coachStart(name) {
  const plan = coachPlan(name); if (!plan) return;
  const t = window.TPW_TRICKS.find(x => x.name.trim() === name) || { name, cat: '', desc: '' };
  startFly(false);
  Object.assign(coach, { on: true, name, t, steps: plan.steps, alts: plan.alts, cross: plan.cross, end: plan.end, tryN: 1, phase: 'parts', msg: '', result: null, ask: null, log: [], toks: [], passes: [], seenTok: new Map(), seenPass: new Map(), obj: null, done: false });
  coach.spots = S.trickSpots(name, t.cat).on; coachNewTry(); renderCoach();
  flash(`<b>TRAIN: ${esc(name).toUpperCase()}</b><small>tries 1-2 step by step · 3-4 the whole trick, judged live</small>`);
}
function coachNewTry() {
  coach.phase = coach.tryN <= COACH_PARTS ? 'parts' : 'live'; coach.since = detector.time; coach.steps = coach.alts[0]; coach.result = null; coach.last = null;
  coachCollect(); coach.since = detector.time;
}
// the detector's clock restarts with a reset (R, a new flight): start the try's window again and forget what was measured
function coachClock() { coach.toks = []; coach.passes = []; coach.seenTok = new Map(); coach.seenPass = new Map(); coach.since = 0; coach.last = null; if (coach.ask) coach.ask = null; }
function coachStop(save = true) {
  if (!coach.on) return; coach.on = false; $('#coachBox').classList.add('hide');
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
    const j = coachJudgeAny(coach.alts, coach.since, true); coach.last = j; if (j.objName) coach.obj = j.objName; coach.steps = j.steps;
    if (j.done >= j.steps.length) { coachTryDone(true, 'every part'); return; }
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
      <div class="trBtns"><button data-co="again">⟲ Train again</button><button data-co="tricks">Tricktionary</button><button data-co="stop" class="ghost">Free fly</button></div>`;
  } else if (coach.phase === 'parts') {
    const j = coach.last || { out: coach.steps.map(() => ({ ok: false, msg: '' })), done: 0 }, cur = (detector.cur || []).filter(Boolean).find(c => c.raw > 30);
    body = `<div class="trLast">Try ${coach.tryN} of ${COACH_TRIES} · <b>step by step</b>: fly each part; take your time between them. Sloppy counts: close is good enough to move on.</div><ol class="coSteps">${coach.steps.map((s, k) => { const o = j.out[k], st = o.ok ? 'ok' : k === j.done ? 'on' : '';
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
  const show = window.Maneuvers && window.Maneuvers.LIB[coach.name];
  box.innerHTML = `<div class="trHead"><small>🎓 TRAIN</small><span class="coDots">${dots}</span></div><div class="trTarget">${esc(coach.name)}</div>
    <div class="trObs">${coach.obj ? `on <b>${esc(coach.obj)}</b>` : `fly it on: <b>${esc((coach.spots || []).join(', '))}</b>`}${coach.end === 'back' ? ' · ends flying backward' : ''}</div>
    ${coach.result && !coach.done ? `<div class="coRes ${coach.result.ok ? 'ok' : 'no'}">${coach.result.ok ? '✓ Try ' + (coach.tryN - 1) + ' done' : '✗'} <small>${esc(coach.result.how)}</small></div>` : ''}
    ${coach.msg ? `<div class="trMsg">${esc(coach.msg)}</div>` : ''}${body}
    <div class="trFoot">${show && !coach.done ? '<button data-co="ghost" class="ghost">👻 Show me</button>' : ''}${!coach.done ? '<button data-co="skip" class="ghost" title="K">Skip this try</button>' : ''}<button data-co="stop" class="ghost">Stop</button></div>`;
}
const esc0 = s => s;   // judge messages are the game's own words (object names already escaped)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-co]'); if (!b) { const tb = e.target.closest('[data-train]'); if (tb) { e.preventDefault(); coachStart(decodeURIComponent(tb.dataset.train)); } return; }
  e.stopPropagation(); b.blur(); const a = b.dataset.co;
  if (a === 'yes' || a === 'no' || a === 'mine') coachAnswer(a);
  if (a === 'again') { if (coach.done) coachStart(coach.name); else coachAnswer('again'); }
  if (a === 'missed') coachMissed();
  if (a === 'skip') { coach.ask = null; coachTryDone(false, 'skipped'); }
  if (a === 'ghost') startGhost(coach.name, coach.obj || '');
  if (a === 'stop') { coachStop(); renderCoach(); }
  if (a === 'tricks') { coachStop(); pause(); openTricks(); }
});
addEventListener('keydown', e => {
  if (!coach.on || mode !== 'fly' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  const A = coach.ask;
  if (e.code === 'KeyY' && A) coachAnswer(A.ok ? 'yes' : 'mine');
  if (e.code === 'KeyN' && A) coachAnswer(A.ok ? 'no' : 'again');
  if (e.code === 'KeyQ' && !A) coachMissed();
  if (e.code === 'KeyK' && !coach.done) { coach.ask = null; coachTryDone(false, 'skipped'); }
});
