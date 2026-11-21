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
const COACH_TRIES = 5, COACH_PARTS = 2;   // 1-2 step by step, 3-4 live, 5 "connect it" (owner, 2026-11-21: the tutorial's last step)
const coachPhaseOf = n => n <= COACH_PARTS ? 'parts' : n >= COACH_TRIES ? 'connect' : 'live';
// ---- The ladder (owner, 2026-11-21: "a ladder, with a learned mark in the Tricktionary"). Three rungs per trick, from the tries
// passed: 1 walked it (a step-by-step try), 2 landed it (a live try), 3 connected it (into or out of another trick) = learned.
// Kept in this browser only (store 'coachRungs': { trick: { r, at } }): it is the pilot's own progress, not flight data.
const COACH_RUNGS = ['', 'walked', 'landed', 'learned'], COACH_DIFF = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Master'];
const coachRungOf = log => (log || []).reduce((r, l) => l && l.ok ? Math.max(r, l.phase === 'connect' ? 3 : l.phase === 'live' ? 2 : 1) : r, 0);
// what to learn next: the trainable tricks not yet learned, easiest first (the book's difficulty, then its points), ones already
// started before untouched ones of the same difficulty
function coachLadder(tricks, rungs, can) {
  const d = t => { const i = COACH_DIFF.indexOf(String(t.diff || '').trim()); return i < 0 ? 9 : i; }, r = t => ((rungs || {})[t.name.trim()] || {}).r || 0;
  const all = tricks.filter(t => t.pts > 0 && can(t.name.trim())), todo = all.filter(t => r(t) < 3).sort((a, b) => d(a) - d(b) || r(b) - r(a) || a.pts - b.pts || a.name.localeCompare(b.name));
  return { total: all.length, learned: all.length - todo.length, next: todo };
}
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
// the way a trick is taught and shown when its rule allows more than one (owner, 2026-11-21: "inverted rewind is just a 180 pitch to
// inverted, a wait (if that), then a pitch back to upright"): the pattern that starts on this axis comes first
const COACH_FIRST = { 'Invert Rewind': 'P' };
function coachPlan(name) {
  const h = COACH_HAND[name];
  if (h) { const st = h.steps.map(s => s.rot ? { ...s, rot: S.parsePattern(s.rot)[0] } : { ...s }); return { cross: h.cross, end: null, steps: st, alts: [st] }; }
  const obs = S.OBSTACLE_TRICKS.filter(t => t.name === name && !t.tap), op = S.OPEN_TRICKS.find(t => t.name === name);
  if (!obs.length && !op) return null;
  const alts = obs.length ? obs.flatMap(ob => ob.parsed.map(p => coachSteps(p, ob))) : op.parsed.map(p => coachSteps(p, null));
  { const pf = COACH_FIRST[name]; if (pf) alts.sort((a, b) => ((b[0] && b[0].rot && b[0].rot.ax) === pf) - ((a[0] && a[0].rot && a[0].rot.ax) === pf)); }
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
  const out = steps.map(() => ({ ok: false, msg: '' }));
  const B = coach.bank && coach.bank.key === JSON.stringify(steps.slice(0, coach.bank.n)) ? coach.bank : null;   // steps kept from before a retry
  let since = t0, i = B ? B.n : 0, obj = B ? B.obj : null; const vars = B ? { ...B.vars } : {};
  if (B) B.out.forEach((o, k) => { out[k] = { ...o }; });
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
    if (!hit) { if (last || other) { out[i].msg = (last || other).why; out[i].retry = !!last; if (last) out[i].at = last.k.t1 + 1.0; } break; }
    if (/[ab]/.test(p.dir)) { const v = p.dir.slice(-1), w = p.dir[0] === '-' ? -1 : 1; if (vars[v] === undefined) vars[v] = hit.dir * w; }
    // the passes made during this rotation
    const miss = (s.during || []).filter(kd => !coach.passes.some(c => c.kind === kd && c.t >= hit.t0 - 1.0 && c.t <= hit.t1 + 1.5 && (obj == null || c.obj === obj)));
    if (miss.length) { out[i].msg = `the ${coachDeg(p.deg)} ${{ R: 'roll', P: 'flip', Y: 'yaw spin' }[p.ax]} was good (${Math.round(hit.raw)}°) but it didn't go ${miss[0] === 'O' ? 'over' : 'under'} the object`; out[i].retry = true; out[i].at = hit.t1 + 1.6; break; }
    if (obj == null) { const c = coach.passes.find(c => (s.during || []).includes(c.kind) && c.t >= hit.t0 - 1.0 && c.t <= hit.t1 + 1.5); if (c) obj = c.obj; }
    const off = Math.abs(hit.raw - p.deg), grade = off <= 30 && !hit.pieces ? 'clean' : off <= tol * 0.6 && !hit.pieces ? 'a bit off' : 'sloppy, still counts';
    out[i] = { ok: true, msg: `${Math.round(hit.raw)}° · ${grade}${hit.pieces ? ' (in ' + hit.pieces + ' pieces: try it in one go next)' : ''}`, t: hit.t1, t0: hit.t0 }; since = hit.t0 + Math.min(0.5, (hit.t1 - hit.t0) * 0.5);
  }
  return { out, done: i, obj, vars, objName: obj != null ? (coach.passes.find(c => c.obj === obj) || {}).name : null };
}
// ---- Coaching cues (owner, 2026-11-21, after a no-talking tutorial video he liked: "STEP 3: CUT THROTTLE AS YOU GO INVERTED"): one
// short imperative per step about hands and eyes, shown as a caption while the step is the one to fly, on the pause card, and in
// Show me just before the step. Hand-written for the common tricks (COACH_CUES: used when the steps shown are the trick's first
// pattern, one cue per step); every other step gets one made from its rule and, where the bot's flight is known, its throttle.
// Drafts: the owner edits the wording.
const COACH_CUES = {
  'Flip': ['Blip the throttle, then stick all the way back (or forward) and hold. Stop it as the horizon comes level.'],
  'Invert Rewind': ['Half a flip to upside-down, and stop it there.', 'Flip straight back the way you came, to upright.'],
  'Roll': ['Blip the throttle, then stick hard left or right. Stop it as the horizon comes level.'],
  'Yaw Spin': ['Hold the throttle steady and push yaw all the way: one flat turn. Keep pitch and roll still.'],
  'Double Flip': ['A bigger throttle blip, stick all the way back (or forward), and keep holding through two turns.'],
  'Double Roll': ['A bigger throttle blip, stick hard over, and keep holding through two turns.'],
  'Powerloop': ['Fly low and straight under it.', 'Punch the throttle and pull back. Ease the throttle off as you go upside-down over the top.', 'Keep pulling until you see the ground, then catch it and fly back under.'],
  'Matty Flip': ['Hop over it with a little height to spare.', 'Cut the throttle and push forward: nose down, all the way round.', 'Catch it as it comes level facing the object, and drift back under it, backward.'],
  'Split-S': ['Go over it with height to spare.', 'Half roll to upside-down and cut the throttle.', 'Pull back: half a loop down toward the ground.', 'Catch it level and fly out under it, back the way you came.'],
  'Barani': ['Fly low and straight to the obstacle.', 'Start the loop right after passing under: throttle up, pull back.', 'Cut the throttle as you go upside-down. Stop pulling, and yaw half a turn.', 'Pull back again to bring the nose round.', 'Catch it before the ground and come back under, backward.'],
  'Juicy Flick': ['A little throttle, then flick the stick forward: half a front flip to upside-down.', 'Half roll back upright, and catch it.'],
  "Rubik's Cube": ['Half a flip, and stop it upside-down.', 'A full roll while you are upside-down.', 'The same half flip again to come upright. Catch it.'],
  'Inverted Yaw Spin': ['Half a flip to upside-down and drop the throttle low.', 'Yaw a full turn while upside-down. Right stick still.', 'The same half flip again to come upright. Catch it.'],
  'Immelmann Turn': ['Fly low and straight under it.', 'Throttle up and pull back: half a loop up and over, to upside-down.', 'Half roll upright. You are now flying back the way you came.'],
  'Snapback': ['Fly low and straight under it.', 'Pull back hard: half a flip, so you are upside-down looking back at it.', 'Half roll upright and fly back toward it.'],
  'Anti Matty': ['Hop over it with a little height to spare.', 'Cut the throttle and pull back: a full backflip.', 'Catch it as it comes level, and drift back under it, backward.'],
};
const coachKinds = st => st.map(x => x.pass ? x.pass : x.rot.ax + x.rot.deg).join('|');
function coachCue(name, steps, k, sk) {   // sk: the bot's sticks during this step ({ T, dT }), when its flight is known
  const s = steps[k]; if (!s) return '';
  const hand = COACH_CUES[name], plan = hand ? coachPlan(name) : null;
  if (hand && plan && hand.length === steps.length && coachKinds(plan.alts[0]) === coachKinds(steps)) return hand[k];
  if (s.text) return s.text + '.';
  if (s.pass) { if (s.pass === 'U') return k === 0 ? 'Fly low and straight under it.' : s.end === 'back' ? 'Catch it level and drift back under it, backward.' : s.end === 'fwd' ? 'Catch it level and fly out under it.' : 'Back under it.';
    return k === 0 ? 'Come in level and go over the top of it.' : 'Up and over the top of it.'; }
  const p = s.rot, turns = { 180: 'half a turn', 360: 'one full turn', 540: 'a turn and a half', 720: 'two full turns', 900: 'two and a half turns', 270: 'three quarters of a turn', 90: 'a quarter turn', 135: 'a bit under half a turn' }[p.deg] || p.deg + '°';
  let out;
  if (p.ax === 'P') out = `${p.dir === '+' ? 'Pull back' : p.dir === '-' ? 'Push forward' : 'Stick forward or back'}: ${turns}${p.deg === 180 ? ', to upside-down' : ''}. ${p.deg >= 360 ? 'Hold it, and stop it as the horizon comes level.' : 'Stop it there.'}`;
  else if (p.ax === 'R') out = `Roll ${turns}${p.deg === 180 ? ', to the other way up' : ''}: stick hard over, then stop it level.`;
  else out = `${p.inv ? 'While upside-down, yaw' : 'Yaw'} ${turns}. Keep pitch and roll still.`;
  if (s.during && s.during.includes('O')) out += ' Over the top of it.';
  if (sk && Number.isFinite(sk.T)) { if (sk.dT < -0.6 || sk.T < 0.15) out += ' Cut the throttle.'; else if (sk.dT > 0.6 || sk.T > 0.8) out += ' Punch the throttle.'; }
  return out;
}
// ---- the session
// ---- The Training Room (owner, 2026-11-20): Train always happens there. From any other map it stores the trick and where
// the pilot came from, loads the room (a reload, like any map change) and starts on arrival; Done / Free fly / Menu load the
// pilot's own map again (Done reopens the Tricktionary). The room holds every kind of obstacle; the pilot is put in front
// of the one the trick needs (`coachStation`), and R brings them back there.
const ROOM = 'training';
const COACH_CAT_ST = { 'Open Air Tricks': 'open', 'Other Tricks': 'open', Powerloops: 'big', 'Maverick Loops': 'big',   // loops on the big square (owner, 2026-11-21: "the small object just isn't gonna work")
  'Matty Flips': 'bar', SplitS: 'bar', 'Jump Roping': 'bar',
  'Pole Dancing': 'pole', Rewinds: 'pole', 'Wall Tricks': 'wall', Gaps: 'gap' };
const COACH_ST_OVR = { Dive: 'tower', Perch: 'tower', 'Ceiling Tap': 'slab', 'Slide Disarm': 'open', Facepunch: 'pilot', 'Stall Rewind': 'wall', 'Wall Stick': 'wall', 'Juicy Flick': 'open', 'Juicy Tornado': 'open',
  'Inverted Yaw Tracking': 'pole', 'Eject Roll': 'pole', 'Stellar Eject Roll': 'pole', 'Maverick Tap Rewind': 'bar', 'Power Switch Tap': 'bar', Snapback: 'bar', Forani: 'bar', 'True Barani': 'bar', Blindflip: 'bar' };
function coachStation(name, cat, plan) {
  let st = COACH_ST_OVR[name] || COACH_CAT_ST[(cat || '').trim()] || 'open';
  if (st === 'open' && plan && plan.cross) st = 'bar';
  if (st === 'big' && COACH_ST_OVR[name]) st = COACH_ST_OVR[name];   // anything flown over and under something
  return st;
}
const COACH_SPOTS = {   // the room's obstacle for each station, and where the pilot starts: [x, z, yaw] (yaw π/2 faces west, -π/2 east, π south)
  big: ['Big Square 10 m', 4, -10, Math.PI / 2], bar: ['Test Bar 2.2 m', -26.5, -12, Math.PI / 2], gap: ['Gap Gate 1.1 m', -30, -19, Math.PI / 2], pole: ['Big Pole 12 m', -10, 3, Math.PI],
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
// owner, 2026-11-21: "rolling starts" and "instant retry". (1) Every start puts the quad where the bot's own flight of the trick
// on this station is ~0.8 s before its first part, at the bot's speed and attitude (`coach.entry`, from `coachStepSticks`), held
// until the throttle is set near the bot's or a stick moves: the pilot flies the trick, not the run-up. No usable flight: the
// old hover, 1.5 m up. (2) In the step-by-step tries every confirmed part leaves a checkpoint (`coach.ck`: the quad as it was in
// the pause after that part, and the parts done so far as `bank`); a part flown wrong, a crash or R goes back to it (the
// detector starts fresh; the judge takes the banked parts as done), R again goes back to the start.
const coachSnap = () => ({ pos: { ...drone.pos }, vel: { ...drone.vel }, q: { ...drone.q }, w: { ...drone.w }, motorW: drone.motorW.slice() });
function coachPut(s, keep) {
  drone.reset(activeWorld.spawn, keep); drone.pos = S.v3(s.pos.x, s.pos.y, s.pos.z); drone.vel = S.v3(s.vel.x, s.vel.y, s.vel.z);
  drone.q = { w: s.q.w, x: s.q.x, y: s.q.y, z: s.q.z }; drone.w = S.v3(s.w.x, s.w.y, s.w.z); if (s.motorW) drone.motorW = s.motorW.slice();
}
// the rolling start: level, at the station, heading for its obstacle, at the speed the bot brings into the first part and the
// height that part needs (under the bar: a little over half way up to it; over it: 0.7 m above; a gap: its middle; open air:
// the bot's height, at least 2.5 m, from 4 m further back). The same place every time. Wall, tower, slab and pilot stations
// keep the hover start.
function coachEntry(stn, bot) {
  const sp = world.spawn, yaw = sp.yaw || 0, fw = S.qrot(S.qaxis(S.v3(0, 1, 0), yaw), S.v3(0, 0, -1)), name = COACH_SPOTS[stn][0], cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const o = world.objs.find(x => x.name === name), gap = world.objs.find(x => x.name === name + ' opening' && x.gap), bv = bot ? bot.v : null;
  let y, v, back = 0, obj = name;
  if ((stn === 'bar' || stn === 'big') && o && o.obstacle) { let first = null; for (const st of coach.steps) { first = st.pass || (st.during && st.during[0]) || null; if (first) break; }
    y = first === 'O' ? o.obstacle.over + 0.7 : Math.max(0.6, Math.min(3, o.obstacle.under * 0.55)); v = stn === 'big' ? cl((bv ?? 4) * 1.6, 4, 7) : cl(bv ?? 3.5, 2, 4.5); }   // a big loop needs more speed in
  else if (stn === 'gap' && gap) { y = gap.gap.c.y; v = cl(bv ?? 3, 2, 4); }
  else if (stn === 'pole') { y = 1.5; v = cl(bv ?? 3, 2, 5); }
  else if (stn === 'open') { y = cl(bot ? bot.y : 3, 2.5, 6); v = cl(bv ?? 4, 0, 6); back = 4; obj = 'open air'; }
  else return null;
  return { pos: { x: sp.pos.x - fw.x * back, y, z: sp.pos.z - fw.z * back }, q: S.qaxis(S.v3(0, 1, 0), yaw), vel: { x: fw.x * v, y: 0, z: fw.z * v }, w: { x: 0, y: 0, z: 0 }, thr: bot ? bot.thr : 0, obj };
}
function coachHoldStart(ck) {
  if (!coach.on || world.id !== ROOM) return; const sp = activeWorld.spawn, E = coach.entry || null;
  if (ck) coachPut(ck.st, true); else if (E) coachPut(E, false); else { drone.reset(sp); drone.pos = S.v3(sp.pos.x, sp.pos.y + 1.5, sp.pos.z); }
  coach.hold = { thr0: null, at: performance.now(), roll: ck ? null : E, ck: ck || null, near: null };
  if (!drone.armed) setArmed(true, true);   // armed whatever the throttle says: the hold keeps it still until a stick moves
}
// the Training Room starts armed whatever the radio's arm switch says (owner, 2026-11-20); with the switch off, input.js used to
// disarm it again on the next frame and the start never let go (owner, 2026-11-21). There the switch only disarms on its flick off.
function coachArmed() { return coach.on && world.id === ROOM && mode === 'fly'; }
function coachHeld(rc) {
  const H = coach.hold; if (!H || !coach.on || mode !== 'fly') return false;
  if (H.thr0 == null) H.thr0 = rc.thr;
  const now = performance.now(), E = H.roll, thrSet = E && E.thr > 0.15 && inputCfg.mode !== 'keyboard';
  let moved = Math.max(Math.abs(rc.roll || 0), Math.abs(rc.pitch || 0), Math.abs(rc.yaw || 0)) > 0.2;
  if (thrSet) { H.thrOk = Math.abs((rc.thr || 0) - E.thr) <= 0.12; if (!H.thrOk) H.near = null; else if (H.near == null) H.near = now; moved = moved || (H.near != null && now - H.near > 600); }   // a rolling start: set the throttle and you are off
  else if (inputCfg.mode === 'keyboard' && E) moved = moved || !!(keys.KeyW || keys.KeyS);   // the keyboard's height hold moves the throttle by itself
  else moved = moved || Math.abs((rc.thr || 0) - H.thr0) > 0.12;
  if (moved && now - H.at > 400 && !drone.armed && !drone.crashed) setArmed(true, true);
  if (drone.armed && moved && now - H.at > 400) { coach.hold = null; coach.atCk = false; if (!coach.freeze) $('#coachFreeze').classList.add('hide'); flash(E ? '<b>GO!</b>' : '<b>YOUR CONTROL</b>'); return false; }
  return true;
}
setInterval(() => {   // the card while the quad is held at a start or a checkpoint
  const H = coach.hold, el = $('#coachFreeze'); if (!H || !coach.on || mode !== 'fly' || coach.freeze) return;
  const E = H.roll, n = H.ck ? H.ck.bank.n : 0, st = H.ck ? coach.steps[n] : null, kb = inputCfg.mode === 'keyboard';
  const pctN = H.near != null ? Math.min(100, Math.round((performance.now() - H.near) / 6)) : 0;
  const html = H.ck && st ? `<small>BACK BEFORE STEP ${n + 1} OF ${coach.steps.length}</small><b>${coachStepText(st, new Set())}</b><div class="cfBar"><em>move a stick to go · R: back to the start</em></div>`
    : E ? `<small>READY · ROLLING START</small><b>${Math.hypot(E.vel.x, E.vel.z) < 0.5 ? `You start hovering ${E.pos.y.toFixed(1)} m up` : `You start at ${Math.hypot(E.vel.x, E.vel.z).toFixed(1)} m/s${E.obj !== 'open air' ? `, lined up on the ${esc(E.obj)}` : `, ${E.pos.y.toFixed(1)} m up`}`}</b>
      ${E.thr > 0.15 && !kb ? `<div class="cfSticks"><i class="${H.thrOk ? 'ok' : ''}">${H.thrOk ? '✓' : '○'} throttle ~${Math.round(E.thr * 100)}%</i></div>` : ''}<div class="cfBar"><i style="width:${pctN}%"></i><em>${E.thr > 0.15 && !kb ? 'set the throttle, or move a stick, to go' : 'move a stick to go'}</em></div>`
    : `<small>READY</small><b>Move a stick to take control</b>`;
  if (el.__h !== html) { el.__h = html; el.innerHTML = html; } el.classList.remove('hide');
}, 100);
function coachStart(name) {
  const plan = coachPlan(name); if (!plan) return;
  const t = window.TPW_TRICKS.find(x => x.name.trim() === name) || { name, cat: '', desc: '' };
  if (world.id !== ROOM) { coachGoRoom(name); return; }
  const stn = coachStation(name, t.cat, plan), sp = COACH_SPOTS[stn];
  world.spawn = { pos: S.v3(sp[1], 0.03, sp[2]), yaw: sp[3] }; coach.room = true;
  coach.ck = null; coach.bank = null; coach.entry = null; clearTimeout(coach.retryT); coach.retryT = null;
  startFly(false);
  Object.assign(coach, { on: true, stn, sticks: undefined, entry: null, ck: null, bank: null, pauseSnap: null, atCk: false, freeze: null, doneN: 0, name, t, steps: plan.steps, alts: plan.alts, cross: plan.cross, end: plan.end, tryN: 1, phase: 'parts', msg: '', result: null, ask: null, log: [], toks: [], passes: [], seenTok: new Map(), seenPass: new Map(), obj: null, done: false });
  coach.spots = [COACH_SPOTS[stn][0]]; coachNewTry();
  drone.reset(world.spawn); coach.sticks = coachStepSticks(); coach.entry = coachEntry(stn, coach.sticks && coach.sticks.bot);   // the bot's flight from this station: the pause arrows and the rolling start
  coachHoldStart(); renderCoach();
  flash(`<b>TRAIN: ${esc(name).toUpperCase()}</b><small>tries 1-2 step by step · 3-4 the whole trick, live · 5 connect it</small>`);
  if (store.get('coachIntro', true) && coach.fly && coachIntroSeen !== name) { coachIntroSeen = name; coachDemo(true); }   // the payoff first: the trick at full speed, then one slow pass with the cues
}
function coachNewTry() {
  coach.phase = coachPhaseOf(coach.tryN); coach.chain = []; coach.since = detector.time; coach.steps = coach.alts[0]; coach.doneN = 0; coach.live = null; coach.preFroze = null; if (coach.freeze) coachFreezeEnd(); coach.result = null; coach.last = null;
  coach.ck = null; coach.bank = null; coach.pauseSnap = null; coach.atCk = false; coach.msg = '';
  coachCollect(); coach.since = detector.time;
}
// the detector's clock restarts with a reset (R, a new flight): start the try's window again and forget what was measured
function coachClock(start) {
  clearTimeout(coach.retryT); coach.retryT = null;
  const ck = !start && coach.on && coach.phase === 'parts' && !coach.result && !coach.done && coach.ck && !coach.atCk ? coach.ck : null;   // R at a checkpoint: back to the start
  if (!ck) { coach.ck = null; coach.pauseSnap = null; } coach.bank = ck ? ck.bank : null; coach.atCk = !!ck;
  if (coach.freeze) coachFreezeEnd(); coachHoldStart(ck); coach.doneN = ck ? ck.bank.n : 0; coach.live = null; coach.preFroze = null;
  coach.toks = []; coach.passes = []; coach.seenTok = new Map(); coach.seenPass = new Map(); coach.since = 0; coach.last = null; coach.chain = []; if (coach.ask) coach.ask = null;
  if (ck) { coach.steps = ck.steps; if (store.get('coachPauses', true)) { coachFreezeStart(ck.bank.n); if (coach.freeze) { coach.hold = null; coach.scale = 0; coach.preFroze = ck.bank.n; } } }   // back in the pause before the part
}
// back to the checkpoint (or the start), with a fresh detector: a part flown wrong, a crash, the next try
function coachRetry(start) { if (!coach.on || coach.done || mode !== 'fly') return; detector.reset(); crashLock = false; coachClock(start); renderCoach(); }
function coachAgain() { coachRetry(true); coachNewTry(); renderCoach(); }
function coachStop(save = true) {
  if (!coach.on) return; coach.on = false; coach.hold = null; clearTimeout(coach.retryT); coach.retryT = null; coachFreezeEnd(); $('#coachBox').classList.add('hide');
  if (save && recap.dirty && !recap.guest) recapSave();
}
function coachTryDone(ok, how) {
  coach.log.push({ n: coach.tryN, phase: coach.phase, ok, how }); coach.result = { ok, how }; coach.msg = '';
  if (ok) { const R = store.get('coachRungs', {}), was = (R[coach.name] || {}).r || 0, now = Math.max(was, coachRungOf(coach.log));   // the ladder: this browser only
    if (now > was) { R[coach.name] = { r: now, at: Date.now() }; store.set('coachRungs', R); if (now === 3) flash(`<b>★ ${esc(coach.name).toUpperCase()} LEARNED</b><small>walked it, landed it, connected it</small>`); } }
  if (coach.tryN >= COACH_TRIES) { coach.done = true; renderCoach(); return; }
  coach.tryN++; setTimeout(() => { if (coach.on && !coach.done) { if (mode === 'fly') coachAgain(); else { coachNewTry(); renderCoach(); } } }, ok ? 1600 : 0);   // every try from the rolling start
  renderCoach();
}
// live tries: the detector's own calls
function coachEvent(ev) {
  if (!coach.on || coach.done || mode !== 'fly' || ev.name === 'near') return;
  if (ev.name === 'Crash' || ev.exec === 'CRASH') { if (coach.phase === 'live' && !coach.ask && !store.get('coachRetry', true)) { coach.msg = 'Crashed: reset (R) and go again.'; renderCoach(); } return; }
  // the last try, "connect it": the trick and any other trick within a combo's breath of each other (either order)
  if (coach.phase === 'connect') { if (coach.result || ev.maybe) return; const t = detector.time; coach.chain = (coach.chain || []).filter(c => t - c.t < COACH_LINK + 1.5); coach.chain.push({ name: ev.name, t });
    const me = coach.chain.filter(c => c.name === coach.name), pair = me.map(m => [m, coach.chain.find(c => c.name !== coach.name && Math.abs(c.t - m.t) <= COACH_LINK)]).find(x => x[1]);
    if (pair) { const [m, o] = pair; coachTryDone(true, coach.chain.indexOf(o) < coach.chain.indexOf(m) ? `${o.name} into ${coach.name}` : `${coach.name} into ${o.name}`); return; }
    coach.msg = ev.name === coach.name ? 'That was it. Now straight into a different trick: any one counts.' : `${ev.name}: now the ${coach.name}, straight after.`; renderCoach(); return; }
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
    if (a === 'no') { if (e) { e.verdict = 'no'; e.actual = null; recap.dirty = true; } coach.ask = null; coachAgain(); coach.msg = 'Not counted: go again.'; renderCoach(); return; }
  } else {
    if (a === 'mine') { if (e) recapSetCall(A.i, coach.name); coach.ask = null; coachTryDone(true, `your call: the game said ${A.called}`); return; }
    if (a === 'again') { coach.ask = null; coachAgain(); coach.msg = ''; renderCoach(); return; }
  }
}
function coachMissed() {   // "I did it, the game missed it" (Q)
  if (!coach.on || (coach.phase !== 'live' && coach.phase !== 'connect') || coach.ask || coach.result) return; const t = drone.time;
  recap.flags.push({ t0: +Math.max(0, t - 3).toFixed(3), t: +t.toFixed(3), actual: coach.name, added: true }); recap.dirty = true;
  coachTryDone(true, 'your call: the game missed it');
}
setInterval(() => {
  if (!coach.on) return;
  if (mode !== 'fly') { $('#coachBox').classList.add('hide'); return; }
  coachCollect();
  const auto = store.get('coachRetry', true) && !coach.retryT && !coach.hold && !coach.done && !coach.result;
  if (auto && drone.crashed && !coach.ask) { coach.retryT = setTimeout(() => { coach.retryT = null; const back = coach.phase === 'parts' && coach.ck; coachRetry(); coach.msg = back ? 'Crashed: back before that part.' : 'Crashed: back at the start.'; renderCoach(); }, 800); }
  if (coach.phase === 'parts' && !coach.result) {
    if (coach.freeze) return;
    const j = coachJudgeAny(coach.alts, coach.since, true); coach.last = j; if (j.objName) coach.obj = j.objName; coach.steps = j.steps;
    if (j.done >= j.steps.length) { coach.doneN = 0; coachTryDone(true, 'every part'); return; }
    const o = j.out[j.done];
    if (auto && !coach.retryT && o && o.retry && !drone.crashed && detector.time >= o.at) {   // (a beginner's rotation in pieces, or a late pass, still has its time)   // a part flown wrong: say why, then back to just before it
      const why = o.msg; flash(`<b>✗ ${why.toUpperCase()}</b><small>back before that part</small>`, 'near');
      coach.retryT = setTimeout(() => { coach.retryT = null; coachRetry(); coach.msg = `Step ${j.done + 1}: ${why}. Go again.`; renderCoach(); }, 500); }
    if (j.done > (coach.doneN || 0)) { coach.doneN = j.done; coach.msg = '';
      const P = coach.pauseSnap;   // the checkpoint: the quad as it sat in the pause after this part (or as it is now, with the pauses off)
      coach.ck = { bank: { n: j.done, obj: j.obj, vars: j.vars, out: j.out.slice(0, j.done).map(x => ({ ok: true, msg: x.msg })), key: JSON.stringify(j.steps.slice(0, j.done)) }, steps: j.steps, st: P && P.k === j.done ? P.st : coachSnap() }; if (coach.preFroze !== j.done) coachFreezeStart(j.done); coach.preFroze = null; }   // already paused there as the rotation came round (coachLive)
  }
  renderCoach();
}, 150);
// the caption bar (bottom centre): STEP k OF n and the cue, like the tutorial's captions
function coachCaption(c, text) {
  const el = $('#coachCue'); if (!el) return; if (!c || c.k >= c.n) { el.classList.add('hide'); return; }
  const cue = text != null ? text : coachCueAt(c.k), html = `<small>${c.label ? esc(c.label) : `STEP ${c.k + 1} OF ${c.n}`}</small>${esc(cue)}`;
  if (el.__h !== html) { el.__h = html; el.innerHTML = html; } el.classList.remove('hide');
}
function renderCoach() {
  const box = $('#coachBox'); if (!coach.on || mode !== 'fly') { box.classList.add('hide'); if (!(judge.demo && mode === 'judge')) coachCaption(null); return; } box.classList.remove('hide');
  const vars = new Set(), dots = Array.from({ length: COACH_TRIES }, (_, k) => { const L = coach.log[k]; return `<i class="${L ? (L.ok ? 'ok' : 'no') : k + 1 === coach.tryN ? 'on' : ''}" title="try ${k + 1}: ${{ parts: 'step by step', live: 'live', connect: 'connect it' }[coachPhaseOf(k + 1)]}"></i>`; }).join('');
  let body = '';
  if (coach.done) {
    const ok = coach.log.filter(l => l.ok).length;
    const rg = coachRungOf(coach.log), best = ((store.get('coachRungs', {})[coach.name]) || {}).r || rg;
    body = `<div class="trLast"><b>Done!</b> ${ok} of ${COACH_TRIES} tries.${coach.log.filter(l => l.phase !== 'parts').map(l => `<br>${l.phase === 'connect' ? 'Connect it' : 'Live try ' + l.n}: ${esc(l.how)}`).join('')}
      <div class="coLadder">${[1, 2, 3].map(k => `<i class="${best >= k ? 'ok' : ''}">${best >= k ? '✓' : '○'} ${COACH_RUNGS[k]}</i>`).join('')}</div>${best >= 3 ? 'Learned. Fly it in a Session for points.' : best === 2 ? 'One rung to go: connect it to another trick.' : 'Train it again to climb the next rung.'}</div>
      <div class="trBtns"><button data-co="again">⟲ Train again</button><button data-co="done">✓ Done</button><button data-co="stop" class="ghost">Free fly</button></div>`;
  } else if (coach.phase === 'parts') {
    const j = coach.last || { out: coach.steps.map(() => ({ ok: false, msg: '' })), done: 0 }, cur = (detector.cur || []).filter(Boolean).find(c => c.raw > 30);
    body = `<div class="trLast">Try ${coach.tryN} of ${COACH_TRIES} · <b>step by step</b>: fly each part; take your time between them. Sloppy counts: close is good enough to move on.${store.get('coachRetry', true) ? ' Miss a part and you are put back just before it.' : ''}${store.get('coachPauses', true) ? ' The game pauses after each part so you can set up the next.' : ''}</div><ol class="coSteps">${coach.steps.map((s, k) => { const o = j.out[k], st = o.ok ? 'ok' : k === j.done ? 'on' : '';
      return `<li class="${st}">${o.ok ? '✓ ' : k === j.done ? '▶ ' : ''}${coachStepText(s, vars)}${o.ok && o.msg ? ` <small class="coGot">${o.msg}</small>` : ''}${k === j.done && o.msg ? `<div class="coWhy">✗ ${o.msg}</div>` : ''}</li>`; }).join('')}</ol>
      ${cur ? `<div class="note">turning: ${{ R: 'roll', P: 'flip', Y: 'yaw' }[cur.ax]} ${Math.round(cur.raw)}°</div>` : ''}`;
  } else if (coach.phase === 'connect') {
    const ch = (coach.chain || []).slice(-4);
    body = `<div class="trLast">Try ${coach.tryN} of ${COACH_TRIES} · <b>connect it</b>: fly the ${esc(coach.name)} and go straight into another trick, or come out of one straight into it. Any trick counts (a Roll or a Flip is enough), within ${COACH_LINK} seconds.</div>
      ${ch.length ? `<div class="coChain">${ch.map(c => `<i class="${c.name === coach.name ? 'ok' : ''}">${esc(c.name)}</i>`).join('<b>→</b>')}</div>` : ''}
      <div class="trBtns"><button data-co="missed" class="ghost" title="You connected it and the game said nothing">I did it, the game missed it <kbd>Q</kbd></button></div>`;
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
    <div class="trFoot">${!coach.done ? `<button data-co="pauses" class="ghost" title="Freeze the game between the parts of the step-by-step tries">${store.get('coachPauses', true) ? '⏸ Pauses: on' : '⏸ Pauses: off'}</button>` : ''}${!coach.done ? `<button data-co="retry" class="ghost" title="After a missed part or a crash, put me back just before it (R does it by hand)">${store.get('coachRetry', true) ? '⟲ Auto-retry: on' : '⟲ Auto-retry: off'}</button>` : ''}${!coach.done && coach.fly ? '<button data-co="intro" class="ghost" title="The trick at full speed, then one slow pass with the steps, then examples. Shift-click turns it off for new tricks">▶ Intro</button><button data-co="examples" class="ghost" title="Other flights of it: other pilots, other objects">🎞 Examples</button>' : ''}${show && !coach.done ? '<button data-co="ghost" class="ghost" title="Watch the bot fly it from its own camera, with its sticks and every step explained">👻 Show me</button>' : ''}${!coach.done ? '<button data-co="skip" class="ghost" title="K">Skip this try</button>' : ''}${coach.done ? '' : '<button data-co="done" class="ghost" title="Back to the Tricktionary">✓ Done</button>'}</div>`;
  if (!coach.done && coach.phase === 'connect' && !coach.result) coachCaption({ label: 'CONNECT IT', k: 0, n: 1 }, `${coach.name} + any other trick, back to back.`);
  else coachCaption(!coach.done && coach.phase === 'parts' && !coach.freeze ? { k: (coach.last || { done: coach.doneN || 0 }).done, n: coach.steps.length } : null);
  if (html !== box.__h) { box.__h = html; box.innerHTML = html; }   // it is checked 7 times a second: rewriting it each time ate clicks (a click needs the same button under the press and the release)
}
// the Tricktionary: a mark by each trained trick, and the ladder box on top (what is learned, what to train next)
function coachMark(name) { const r = ((store.get('coachRungs', {})[name]) || {}).r || 0; return r ? ` <small class="coRung r${r}" title="Train: ${[1, 2, 3].map(k => (r >= k ? '✓ ' : '○ ') + COACH_RUNGS[k]).join(' · ')}">${r >= 3 ? '★ learned' : '▮'.repeat(r) + '▯'.repeat(3 - r) + ' ' + COACH_RUNGS[r]}</small>` : ''; }
function coachLadderHtml() {
  const L = coachLadder(window.TPW_TRICKS, store.get('coachRungs', {}), coachCan), nx = L.next.slice(0, 4); if (!L.total) return '';
  return `<div class="coLadderBox"><b>🎓 Your ladder</b> · ${L.learned} of ${L.total} learned${nx.length ? ` · next up: ${nx.map(t => `<a href="#" class="watch train" data-train="${encodeURIComponent(t.name.trim())}" title="${esc(String(t.diff || '').trim())} · ${t.pts} pts">${esc(t.name.trim())}</a>${coachMark(t.name.trim())}`).join(' ')}` : ' · every one of them. Nice.'}<br><small>Each trick has three rungs: walk it (step by step), land it (live), connect it (into another trick). Kept in this browser only.</small></div>`;
}
const COACH_LINK = 3;   // s between the two calls of a connected pair (the combo's own 3 s)
const esc0 = s => s;
const coachCueAt = k => { const S0 = coach.sticks, sk = S0 && S0.at && S0.steps && S0.steps.length === coach.steps.length ? S0.at[k] : null; return coachCue(coach.name, coach.steps, k, sk); };   // judge messages are the game's own words (object names already escaped)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-co]'); if (!b) { const tb = e.target.closest('[data-train]'); if (tb) { e.preventDefault(); if (TRICK_TRAINERS.includes((pilotName() || '').trim().toLowerCase())) coachStart(decodeURIComponent(tb.dataset.train)); } return; }
  e.stopPropagation(); b.blur(); const a = b.dataset.co;
  if (a === 'yes' || a === 'no' || a === 'mine') coachAnswer(a);
  if (a === 'again') { if (coach.done) coachStart(coach.name); else coachAnswer('again'); }
  if (a === 'missed') coachMissed();
  if (a === 'pauses') { store.set('coachPauses', !store.get('coachPauses', true)); if (coach.freeze) coachFreezeEnd(); renderCoach(); }
  if (a === 'retry') { store.set('coachRetry', !store.get('coachRetry', true)); clearTimeout(coach.retryT); coach.retryT = null; renderCoach(); }
  if (a === 'skip') { coach.ask = null; coachTryDone(false, 'skipped'); }
  if (a === 'ghost') coachDemo();
  if (a === 'examples') coachDemo('examples');
  if (a === 'intro') { if (e.shiftKey) { store.set('coachIntro', !store.get('coachIntro', true)); flashNote(store.get('coachIntro', true) ? 'Intro before each new trick: on' : 'Intro before each new trick: off'); } else coachDemo(true); }
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
const demo = { steps: [], setup: '', cur: -1, view: 'fpv', thrT: -9, why: [] };
var coachIntroSeen = null;   // the trick whose intro was shown last (once per trick while the page is open; ▶ Intro in the panel plays it again)
function demoObjects() {
  const P = drone.pos, out = [];
  for (const o of world.objs) { const b = o.obstacle; if (!b || o.round || o.kind === 'pilot' || o.kind === 'edge' || !b.a || !b.b) continue;
    const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z); if (b.under < 0.9 || b.under > 3.2 || b.over - b.under > 1.5 || L < 1.2) continue;
    const mx = (b.a.x + b.b.x) / 2, mz = (b.a.z + b.b.z) / 2; out.push({ name: o.name, d: Math.hypot(mx - P.x, mz - P.z) }); }
  const seen = new Set(); return out.sort((a, b) => a.d - b.d).filter(x => !seen.has(x.name) && seen.add(x.name)).slice(0, 8);
}
// how far a shown flight cuts into the room (owner, 2026-11-21: "no trick examples … collide with an object or obstacle in the
// training room"): the bot's flights are drawn along a path, nothing stops them, and a pilot's library flight laid over another
// object (or an open-air one set down near the trick bay) could pass through a bar. 0 = clear by DEMO_CLEAR all the way
const DEMO_CLEAR = 0.09;
function demoHits(rows) { let worst = 0; const W = world.prims || [];
  for (const r of rows || []) { const x = r[1], y = r[2], z = r[3]; if (y < DEMO_CLEAR) worst = Math.max(worst, DEMO_CLEAR - y);
    for (const pr of W) { const a = pr.aabb; if (!a || x < a.min.x - DEMO_CLEAR || x > a.max.x + DEMO_CLEAR || y < a.min.y - DEMO_CLEAR || y > a.max.y + DEMO_CLEAR || z < a.min.z - DEMO_CLEAR || z > a.max.z + DEMO_CLEAR) continue; const d = S.primDist(pr, S.v3(x, y, z)); if (d < DEMO_CLEAR) worst = Math.max(worst, DEMO_CLEAR - d); } }
  return worst; }
// one candidate flight, flown through its own detector here: null when it cannot be made (or, a pilot's flight, when the game does
// not call it here or it holds more than the trick); else what it measured, whether it is called, and how far it cuts into the room
function demoTry(name, T, seed) {
  const MV = window.Maneuvers, open = !coach.cross && !COACH_HAND[name]; let m = null;
  try { m = T.lib ? MV.fromLibrary(name, world, seed, { object: T.obj || undefined, wobble: 0, ...(T.ex != null ? { ex: T.ex } : {}) }) : MV.make(name, world, seed, T.obj ? { object: T.obj, wobble: 0 } : { wobble: 0 }); } catch { m = null; } if (!m) { demo.why.push('no flight'); return null; }
  if (T.lib && m.source !== 'library') { demo.why.push('not library'); return null; }
  if (T.lib ? (m.object === 'open air' && !m.inPlace) : open) { const P0 = m.at(0).pos, off = S.sub(S.add(drone.pos, S.v3(0, 3.5 + (T.up || 0), 0)), P0), base = m; m = { ...base, at: t => { const s = base.at(t); return { pos: S.add(s.pos, off), q: s.q }; } }; }
  const st = { toks: [], passes: [], seenTok: new Map(), seenPass: new Map(), bank: null }, keep = { toks: coach.toks, passes: coach.passes, seenTok: coach.seenTok, seenPass: coach.seenPass, bank: coach.bank }, orig = S.TrickDetector.prototype.update;
  let got, j; Object.assign(coach, st);
  try { S.TrickDetector.prototype.update = function (...a) { const r = orig.apply(this, a); const D = this; for (const kk of D.toks || []) { const id = kk.ax + kk.t0.toFixed(3); if (!coach.seenTok.has(id)) { coach.seenTok.set(id, 1); coach.toks.push({ ax: kk.ax, dir: kk.dir, raw: kk.raw, t0: kk.t0, t1: kk.t1, inv: kk.inv > (kk.n || 1) * 0.5 }); } }
      for (const c of D.crossLog || []) { if (c.kind !== 'U' && c.kind !== 'O') continue; const id = c.kind + c.obj + c.t.toFixed(3); if (!coach.seenPass.has(id)) { coach.seenPass.set(id, 1); coach.passes.push({ kind: c.kind, t: c.t, obj: c.obj, name: c.name }); } } return r; };
    got = MV.detect(m, world, tune.camTilt, { rows: true }); j = coachJudgeAny(coach.alts, 0, true); }
  finally { S.TrickDetector.prototype.update = orig; Object.assign(coach, keep); }
  const ok = got.some(e => e.name === name) || j.done >= j.steps.length;
  // (an Example, `loose`, may turn further on the trick's own axes: a real flight's loop in two pieces, a flip carried on; never on another axis)
  // a pilot's flight shown as THE example must hold the trick and nothing else (owner, 2026-11-21: the Invert Rewind example "has a
  // roll in it at the end"): no other call, and no rotation of 100 deg or more outside the steps
  if (T.lib && ok) { const axes = new Set(j.steps.filter(x => x.rot).map(x => typeof x.rot === 'string' ? x.rot[0] : x.rot.ax)), extra = st.toks.filter(k => Math.abs(k.raw) >= 100 && !(T.loose && axes.has(k.ax)) && !j.out.some(o => o && o.ok && o.t0 != null && k.t0 >= o.t0 - 0.2 && k.t1 <= o.t + 0.2)); if (extra.length || got.some(e => e.name !== name && e.name !== 'near' && e.name !== 'Crash' && !e.maybe)) { demo.why.push('more than the trick: ' + got.filter(e => e.name !== name).map(e => e.name).join('+') + (extra.length ? ' +rot' : '')); return null; } }
  if (T.lib && !ok) { demo.why.push('not called: ' + got.map(e => e.name).join('+') + ' on ' + m.object); return null; }   // a learned flight the game does not call here (its reading leaned on the pilot's own object)
  const R = { m, got, j, object: T.lib ? m.object : T.obj || 'open air', lib: T.lib, ok, hit: demoHits(got.rows) }; demo.why.push((T.lib ? 'lib ' : 'bot ') + (ok ? 'ok' : 'uncalled') + ' hit ' + R.hit.toFixed(2) + ' on ' + R.object); return R;
}
// the objects a shown flight may use here: the station's own first (the Big Square for the loops), then the bars near it
function demoSpots(name) {
  const open = !coach.cross && !COACH_HAND[name], objs = open ? [] : demoObjects().map(o => o.name);
  if (world.id === ROOM && coach.on && coach.spots) { if (!open && coach.stn === 'big' && !objs.includes(coach.spots[0]) && world.objs.some(o => o.name === coach.spots[0] && o.obstacle)) objs.unshift(coach.spots[0]);   // the Big Square: where the pilot will fly it (owner: loops on large objects)
    objs.sort((a, b) => (b === coach.spots[0]) - (a === coach.spots[0])); }
  return { open, objs };
}
function demoFly(name) {   // a flight of the trick on this map whose own detector calls it, with what it measured
  const MV = window.Maneuvers, seed0 = (Date.now() >>> 0), { open, objs } = demoSpots(name);
  // owner, 2026-11-20: real examples first. A confirmed example of the trick from the trick library (pilots' labels and the demo
  // GIFs, rebuilt as labels come in: MV.knowledge's `fromLibrary`), flown on this map; the hand-written script only when no learned
  // flight is called here
  const lib = MV.kbCan && MV.kbCan(name) && MV.kbExamples(name).length ? [0, 1, 2, 3].map(k => ({ lib: true, obj: objs.length ? objs[k % objs.length] : null })) : [];
  const tries = [...lib, ...(open ? [null, null, null] : objs).map(o => ({ lib: false, obj: o })), ...(open ? [null, null, null] : objs).map(o => ({ lib: false, obj: o }))];   /* the script twice over: a second seed when the first one touches something */
  let spare = null;
  for (let k = 0; k < tries.length; k++) {
    const R = demoTry(name, tries[k], seed0 + k * 977); if (!R) continue;
    if (R.ok && !R.hit) return R;
    if (!spare || (R.hit === 0) > (spare.hit === 0) || ((R.hit === 0) === (spare.hit === 0) && (R.ok > spare.ok || (R.ok === spare.ok && R.hit < spare.hit)))) spare = R;   // nothing clean yet: a clear flight before a called one, then the least touch
  }
  return spare;
}
// ---- Examples (owner, 2026-11-21, the tutorial's stage after the walkthrough: "then examples"). Other flights of the same trick, so
// it is seen more than one way: confirmed flights of different pilots from the trick library (each names its pilot and the map it
// was flown on; here it is laid over one of the room's objects), then the bot's own on other objects. Every one is called by the
// game here, holds nothing but the trick and touches nothing. At most DEMO_EX of them, never the flight the intro already showed.
const DEMO_EX = 3, DEMO_EX_TRIES = 12;
function demoExamples(name, main) {
  const MV = window.Maneuvers, seed0 = (Date.now() >>> 0) + 4099, { open, objs } = demoSpots(name), out = [], seen = new Set(); if (!MV) return out; if (demo.why.length > 200) demo.why = [];
  if (main) seen.add(main.lib ? 'ex' + main.m.ex : 'obj' + main.object);
  const cands = [], exs = (MV.kbCan && MV.kbCan(name) ? MV.kbExamples(name) : []).slice().sort((a, b) => (b.e.w || 0) - (a.e.w || 0)), byPilot = new Set(), firsts = [], rest = [];
  for (const x of exs) { const who = (x.e.mo && x.e.mo.by) || x.e.p || '?'; (byPilot.has(who) ? rest : firsts).push(x); byPilot.add(who); }   // a different pilot each, before a second one of anybody's
  [...firsts, ...rest].slice(0, 6).forEach((x, k) => cands.push({ lib: true, loose: true, ex: x.i, obj: objs.length ? objs[(k + 1) % objs.length] : null, key: 'ex' + x.i }));
  if (open) cands.push({ lib: false, obj: null, key: 'open' }); else   /* (one of the bot's in open air: a second seed looks the same) */ for (const o of [...objs.slice(1), objs[0]].filter(Boolean)) cands.push({ lib: false, obj: o, key: 'obj' + o });
  let n = 0;
  for (const T of cands) { if (out.length >= DEMO_EX || n >= DEMO_EX_TRIES) break; if (seen.has(T.key)) continue; n++;
    let R = demoTry(name, T, seed0 + n * 1291);
    if (R && R.ok && R.hit && T.lib && n < DEMO_EX_TRIES) { n++; R = demoTry(name, { ...T, up: 3, obj: objs.length > 1 ? objs[(objs.indexOf(T.obj) + 1) % objs.length] : T.obj }, seed0 + n * 1291); }   // a pilot's flight that touches something here: once more, on the next object (higher up, in open air)
    if (!R || !R.ok || R.hit) continue;
    const key = R.lib ? 'ex' + R.m.ex : T.key; if (seen.has(key)) continue; seen.add(key); out.push(R); }
  return out;
}
// "RodFPV, on Moose Knuckle Park. Here: over the Test Bar 2.2 m" (names are other people's text: the caption escapes them)
function demoExLabel(f) {
  const M = f.m, where = f.object === 'open air' || (!coach.cross && !COACH_HAND[coach.name]) ? 'in open air' : `on the ${f.object}`;
  if (!f.lib) return `The bot, ${where}.`;
  const who = M.by ? String(M.by) : 'A pilot', map = M.map && S.MAPS[M.map] ? S.MAPS[M.map].title || M.map : '';
  return `${who}${map ? ', flown on ' + map : ''}. Here: ${where}.`;
}
const pct = v => Math.round(Math.abs(v) * 100);
function stickWords(rows, a, b) {   // what the sticks did between a and b (rows: t … thr 11 … roll 24, pitch 25, yaw 26)
  const R = rows.filter(r => r[0] >= a && r[0] <= b); if (!R.length) return '';
  const avg = k => R.reduce((s, r) => s + r[k], 0) / R.length, peak = k => R.reduce((m, r) => Math.abs(r[k]) > Math.abs(m) ? r[k] : m, 0);
  const side = ax => STICK_MODES[stickMode()].indexOf(ax) < 2 ? 'left' : 'right';   // which stick carries it in the pilot's transmitter mode
  const out = [], P = peak(25), Ro = peak(24), Y = peak(26), t0 = R[0][11], t1 = R[R.length - 1][11], tl = Math.min(...R.map(r => r[11])), th = Math.max(...R.map(r => r[11]));
  if (Math.abs(P) > 0.15) out.push(`${side('pitch')} stick <b>${P < 0 ? 'back' : 'forward'}</b> ${pct(P)}%`);
  if (Math.abs(Ro) > 0.15) out.push(`${side('roll')} stick <b>${Ro > 0 ? 'right' : 'left'}</b> ${pct(Ro)}%`);
  if (Math.abs(Y) > 0.15) out.push(`${side('yaw')} stick <b>${Y > 0 ? 'right' : 'left'}</b> (yaw) ${pct(Y)}%`);
  out.push(th - tl > 0.2 ? `throttle <b>${pct(t0)}% → ${pct(tl === t1 || t1 < t0 ? tl : th)}%${t1 !== tl && t1 !== th ? ' → ' + pct(t1) + '%' : ''}</b>` : `throttle about <b>${pct(avg(11))}%</b>`);
  return out.join(' · ');
}
function demoBuild(f) {
  const rows = f.got.rows || [], j = f.j, st = j.steps;
  demo.steps = st.map((s, k) => { const o = j.out[k] || {}; return { s, ok: o.ok, t0: o.t0 ?? null, t1: o.t ?? null }; });
  // fill in times the judge could not place (the next / previous known ones)
  for (let k = 0; k < demo.steps.length; k++) { const d = demo.steps[k]; if (d.t0 == null) { const prev = demo.steps.slice(0, k).reverse().find(x => x.t1 != null); d.t0 = prev ? prev.t1 : 0.5; } if (d.t1 == null || d.t1 < d.t0) d.t1 = d.t0 + 0.6; }
  demo.steps.forEach((d, k) => { d.sticks = stickWords(rows, d.t0, d.t1); const R = rows.filter(r => r[0] >= d.t0 && r[0] <= d.t1); d.cue = coachCue(coach.name, st, k, R.length ? { T: R[R.length - 1][11], dT: (R[R.length - 1][11] - R[0][11]) / Math.max(0.2, R[R.length - 1][0] - R[0][0]) } : null); });
  const first = demo.steps.length ? demo.steps[0].t0 : 1, pre = rows.filter(r => r[0] >= first - 1 && r[0] < Math.max(first, 0.4));   // a move that starts at once: its first moments
  const v = pre.length ? pre.reduce((s, r) => s + Math.hypot(r[21], r[23]), 0) / pre.length : 0, h = pre.length ? pre.reduce((s, r) => s + r[2], 0) / pre.length : 0, th = pre.length ? pre.reduce((s, r) => s + r[11], 0) / pre.length : 0;
  demo.setup = `${f.object === 'open air' ? 'Open air, with room all round' : `Line up on the <b>${esc(f.object)}</b>`}: come in at about <b>${v.toFixed(1)} m/s</b>${f.object === 'open air' ? '' : `, <b>${h.toFixed(1)} m</b> up`}, throttle about <b>${pct(th)}%</b>, level.`;
  const M = f.m, src = f.lib ? `A real flight: ${M.by ? `<b>${esc(M.by)}</b>'s` : 'a pilot\'s'} confirmed ${esc(coach.name)}${M.map && S.MAPS[M.map] ? ` on ${esc(S.MAPS[M.map].title || M.map)}` : ''}${M.when ? `, ${esc(new Date(M.when).toLocaleDateString())}` : ''}, from the trick library.` : 'The bot\'s own version (no confirmed flight of it from pilots works here yet).';
  demo.setup += `<br><small>${src}</small>`;
  demo.called = f.got.map(e => e.name); demo.cur = -1;
  // the sticks as drawn (owner, 2026-11-21: "the sticks look a bit shaky on screen"): the bot's sticks are worked back from its
  // flight sample by sample, so they jitter; for the picture each is averaged over about a tenth of a second either side
  // (a bell-shaped weight, so a real snap still reads as a snap). Only the drawing uses these; the step text keeps the raw ones.
  demo.rowsS = null; if (rows.length > 4) { const dt = (rows[rows.length - 1][0] - rows[0][0]) / (rows.length - 1), sig = DEMO_SMOOTH / Math.max(1e-3, dt), R = Math.max(1, Math.ceil(sig * 2.5)), w = []; for (let k = -R; k <= R; k++) w.push(Math.exp(-0.5 * (k / sig) ** 2));
    demo.rowsS = rows.map((r, i) => { const o = r.slice(); for (const c of [11, 24, 25, 26]) { let a = 0, n = 0; for (let k = -R; k <= R; k++) { const q = rows[i + k]; if (q) { a += q[c] * w[k + R]; n += w[k + R]; } } o[c] = a / n; } return o; }); }
}
const DEMO_SMOOTH = 0.07;   // s: how far either side the drawn sticks are averaged
const demoRows = () => (judge.demo && demo.rowsS) || judge.rows;
// to the step before / after the one playing (its cue comes up half a second before it)
function demoStepAt(k) { const st = demo.steps; if (!st[k] || st[k].t0 == null) return null; let T = st[k].t0 - 0.5; for (let q = 0; q < k; q++) if (st[q].t1 != null && T <= st[q].t1 + 0.25) T = st[q].t1 + 0.26; return Math.max(0, T); }   /* where step k's cue comes up (after the one before has gone) */
function demoStep(d) { const at = demo.steps.map((x, k) => demoStepAt(k)); let now = -1; at.forEach((T, k) => { if (T != null && T <= judge.t + 0.02) now = k; });
  let k = now; if (d > 0) { do k++; while (k < at.length && at[k] == null); if (k >= at.length) return; } else if (now < 0) k = at.findIndex(T => T != null); else if (judge.t <= at[now] + 0.6) { do k--; while (k >= 0 && at[k] == null); if (k < 0) k = now; }
  if (k >= 0 && at[k] != null) demoSeek(at[k]); }
function demoLoad(f, trim) {   // put a flight in the player (trim: only the trick itself, from 1.2 s before its first step to 1.4 s after its last)
  demoBuild(f);
  Object.assign(judge, { m: f.m, events: f.got, rows: f.got.rows || null, t: 0, hold: 0, source: f.lib ? 'library' : 'script', ex: f.lib ? f.m.ex : null, from: null, orb: null, keepOrb: false });
  demo.thrT = -9; demo.T = f.m.T;
  { const a = demo.steps.length ? Math.max(0, demo.steps[0].t0 - 1.2) : 0, b = demo.steps.length ? Math.min(f.m.T, demo.steps[demo.steps.length - 1].t1 + 1.4) : f.m.T; demo.a = trim ? a : 0; demo.b = trim ? b : f.m.T; judge.t = demo.a; }
  const pts = []; for (let t = 0; t < f.m.T; t += 0.05) pts.push(f.m.at(t).pos); const C = S.mul(pts.reduce((a, p) => S.add(a, p), S.v3()), 1 / pts.length);
  judge.look = C; judge.camPos = S.add(C, S.v3(4, 1.2, 4)); judge.lookS = null; trailClear();
}
function coachDemo(intro) {   // intro: true = the whole intro (full speed, slow pass, examples), 'examples' = the examples alone, falsy = Show me
  const MV = window.Maneuvers; if (!MV || (!MV.LIB[coach.name] && !(MV.kbCan && MV.kbCan(coach.name) && MV.kbExamples(coach.name).length))) { if (!intro) flash('<b>NO DEMO YET</b><small>the bot has no flight of this trick</small>', 'near'); return; }
  let f = intro && coach.fly ? coach.fly : demoFly(coach.name), I = intro ? { phase: 'payoff', n: 0 } : null;
  if (intro === 'examples') { const list = demoExamples(coach.name, coach.fly); if (!list.length) { flash('<b>NO OTHER EXAMPLES YET</b><small>none that the game calls cleanly in this room</small>', 'near'); return; } I = { phase: 'examples', list, i: 0, only: true }; f = list[0]; }
  if (!f) { if (intro) return; flash(`<b>NO SPOT FOR THE DEMO HERE</b><small>no bar the bot can use on this map: try the playground</small>`, 'near'); return; }
  ghostOff(); drone.armed = false; $('#coachFreeze').classList.add('hide');
  Object.assign(judge, { demo: coach.name, name: coach.name, speed: 1, phase: 'demo', cam: 'fpv', intro: I });
  demo.view = 'fpv'; demoLoad(f, !!intro); demoView();
  mode = 'judge'; show(null); $('#hud').classList.add('hide'); $('#coachBox').classList.add('hide'); $('#judgeBox').classList.remove('hide'); demoRender();
}
function demoBack() {
  const was = judge.intro; judge.intro = null; judge.demo = null; demo.view = 'fpv'; demoView(); coachCaption(null); demoArrows(); stopJudge(); mode = 'fly'; show(null); $('#hud').classList.remove('hide');
  drone.reset(activeWorld.spawn, true); detector.reset(); coachClock(true); renderCoach();
  flash(was ? '<b>YOUR TURN</b><small>step by step first: the caption says what to do</small>' : '<b>YOUR TURN</b><small>back at the start</small>');
}
// the end of a pass in the player. Show me loops; the intro plays the trick at full speed twice with nothing on screen (the payoff),
// then once slowly with the sticks big and the cues (the walkthrough), then hands over
const INTRO_PASSES = 2, INTRO_SLOW = 0.4;
function demoLoop() {
  const I = judge.intro; if (!I) return true; I.n++;
  if (I.phase === 'payoff' && I.n < INTRO_PASSES) return true;
  if (I.phase === 'payoff') { I.phase = 'walk'; I.n = 0; judge.speed = INTRO_SLOW; demo.view = 'sticks'; demoView(); demo.cur = -2; demoRender(); return true; }
  // after the slow pass: the examples, each once at full speed in the plain view, then the pilot's turn
  if (I.phase === 'walk') { I.phase = 'examples'; I.list = demoExamples(coach.name, coach.fly); I.i = -1; judge.speed = 1; demo.view = 'fpv'; demoView(); }
  I.i++; if (!I.list || I.i >= I.list.length) { demoBack(); return false; }
  demoLoad(I.list[I.i], true); demo.cur = -2; demoRender(); return true;
}
function demoSeek(t) { judge.t = Math.max(0, Math.min(demo.T || judge.m.T, t)); judge.hold = 0; trailClear(); demo.cur = -2; demoTick(); }
// sticks big / FPV small (owner, 2026-11-21, the tutorial's layout): the radio fills the screen, the flight is a small picture between
// the gimbals; the game's own canvas is only resized by CSS (nothing is drawn over it), and goes back to full size with the other view
function demoView() { const on = !!(judge.demo && mode !== 'fly' && demo.view === 'sticks'); document.body.classList.toggle('demoBig', on); const cv = $('#demoRadio'); if (cv) cv.classList.toggle('hide', !on); }
function demoTick() {
  const I = judge.intro, quiet = I && I.phase === 'payoff';
  if (demo.view === 'sticks' && !quiet) { $('#demoArrows').classList.add('hide'); demoRadio(); } else if (!quiet && !(I && I.phase === 'examples')) demoArrows(); else $('#demoArrows').classList.add('hide');   /* the examples are for watching: the small stick view only */
  const k = demo.steps.findIndex(d => judge.t >= d.t0 - 0.5 && judge.t <= d.t1 + 0.25), walk = I && I.phase === 'walk' && demo.steps.length, cur = k >= 0 ? k : (judge.t < ((demo.steps[0] || {}).t0 ?? 0) - 0.5 ? (walk ? 0 : -1) : Math.max(walk ? 0 : -1, demo.cur));   // the cue comes up half a second before its step
  if (cur !== demo.cur) { demo.cur = cur; demoRender(); }
  if (I && I.phase === 'examples' && I.list && I.list[I.i]) coachCaption({ label: `EXAMPLE ${I.i + 1} OF ${I.list.length}`, k: 0, n: 1 }, demoExLabel(I.list[I.i]));
  else coachCaption(!quiet && cur >= 0 ? { k: cur, n: demo.steps.length } : null, cur >= 0 ? demo.steps[cur].cue : '');
  const bar = $('#demoBarFill'); if (bar) bar.style.width = (100 * judge.t / (demo.T || 1)).toFixed(1) + '%';
}
function demoRender() {
  const box = $('#judgeBox'); if (!box || !judge.demo) return; const vars = new Set(), I = judge.intro;
  if (I && I.phase === 'payoff') { box.innerHTML = `<div class="trHead"><small>🎓 THE ${esc(judge.demo).toUpperCase()}</small><span class="jStat">watch</span></div><div class="trLast">This is the trick, at full speed. Then one slow pass with the steps, then it is your turn.</div><div class="trFoot"><button data-demo="back" class="primary">Skip ▸ my turn</button></div>`; return; }
  if (I && I.phase === 'examples') { const f = I.list[I.i]; box.innerHTML = `<div class="trHead"><small>🎞 EXAMPLES · ${esc(judge.demo)}</small><span class="jStat">${I.i + 1} of ${I.list.length}</span></div><div class="trLast">The same trick, flown other ways: other pilots, other objects. ${f ? esc(demoExLabel(f)) : ''}</div><div class="trFoot"><button data-demo="exnext" class="ghost">Next ▸</button><button data-demo="back" class="primary">${I.only ? '◂ My turn' : 'Skip ▸ my turn'}</button></div>`; return; }
  const cams = Object.entries(JCAMS).map(([k, v]) => `<button data-jcam="${k}" class="${judge.cam === k ? 'on' : 'ghost'}">${v}</button>`).join('');
  const marks = demo.steps.map((d, k) => `<i class="${k === demo.cur ? 'on' : ''}" style="left:${(100 * d.t0 / (demo.T || 1)).toFixed(1)}%" title="Step ${k + 1}"></i>`).join('');
  const sp = v => `<button data-demo="sp${v}" class="${judge.speed === v ? 'on' : 'ghost'}">×${v}</button>`;
  box.innerHTML = `<div class="trHead"><small>${I ? '🎓 STEP BY STEP' : '👻 SHOW ME'} · ${esc(judge.demo)}</small><span class="jStat">${judge.speed === 0 ? 'paused' : 'speed ×' + judge.speed}</span></div>
    <div class="trRow jCam"><button data-demo="view" class="${demo.view === 'sticks' ? 'on' : 'ghost'}" title="The radio big and the flight small, or the other way round (B)">🎮 Sticks big</button>${demo.view === 'sticks' ? [1, 2, 3, 4].map(m => `<button data-demo="md${m}" class="${stickMode() === m ? 'on' : 'ghost'}" title="Transmitter mode ${m}: which stick carries what (it also sets the stick view while flying)">Mode ${m}</button>`).join('') : cams}</div>
    <div class="demoBar" id="demoBar" title="Click or drag to move through the flight"><b id="demoBarFill"></b>${marks}</div>
    <div class="demoTrans"><button data-demo="t0" title="From the start (Home)">⏮</button><button data-demo="sb" title="The step before (Shift+← or ,)">◂ Step</button><button data-demo="tb" title="Back half a second (←)">◂</button><button data-demo="pp" title="Pause / play (Space)">${judge.speed === 0 ? '▶' : '⏸'}</button><button data-demo="tf" title="On half a second (→)">▸</button><button data-demo="sf" title="The next step (Shift+→ or .)">Step ▸</button>${sp(0.25)}${sp(0.5)}${sp(1)}</div>
    ${demo.view === 'sticks' ? '' : `<div class="trLast ${demo.cur < 0 ? 'demoOn' : ''}"><b>Setup</b> · ${demo.setup}</div>`}
    <ol class="coSteps demoSteps ${demo.view === 'sticks' ? 'hide' : ''}">${demo.steps.map((d, k) => `<li class="${k === demo.cur ? 'on' : k < demo.cur ? 'ok' : ''}" data-demostep="${k}" title="Jump to this step">${esc(d.cue)}<div class="demoRule">${coachStepText(d.s, vars)}</div>${d.sticks ? `<div class="demoStk">${d.sticks}</div>` : ''}</li>`).join('')}</ol>
    ${demo.called.length && !demo.called.includes(judge.demo) ? `<p class="note">(the game read this flight as ${esc(demo.called.join(' + '))}: the bot's version is rough)</p>` : ''}
    ${demo.view === 'sticks' ? '' : '<div class="trLast"><kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> half a second · <kbd>,</kbd> <kbd>.</kbd> step · <kbd>S</kbd> speed · <kbd>B</kbd> sticks big · <kbd>Esc</kbd> back</div>'}
    <div class="trFoot">${I ? '' : '<button data-demo="again">⟲ Another flight</button>'}<button data-demo="back" class="primary">${I ? 'Skip ▸ my turn' : '◂ My turn'}</button></div>`;
}
// the radio, big (Mode 2: left stick throttle / yaw, right stick pitch / roll): each gimbal with its travel, the stick where the bot
// has it and where it has just been, and an arrow on a stick only while it is moving or held well off centre
function demoRadio() {
  const cv = $('#demoRadio'), rows = demoRows(); if (!cv || !rows || rows.length < 2) return;
  const W = cv.clientWidth, H = cv.clientHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'), dtR = (rows[rows.length - 1][0] - rows[0][0]) / (rows.length - 1), at = t => rows[Math.max(0, Math.min(rows.length - 1, Math.round((t - rows[0][0]) / dtR)))];
  g.clearRect(0, 0, W, H); g.fillStyle = '#0d0e12'; g.fillRect(0, 0, W, H);
  const SM = STICK_MODES[stickMode()], NM = { thr: 'THROTTLE', yaw: 'YAW', pitch: 'PITCH', roll: 'ROLL' }, COL = { thr: 11, yaw: 26, pitch: 25, roll: 24 }, val = (q, a) => a === 'thr' ? q[11] * 2 - 1 : q[COL[a]];   // the pilot's transmitter mode (1-4)
  const rad = Math.min(W * 0.15, H * 0.26), cy = H * 0.56, pads = [[W * 0.2, cy, `${NM[SM[1]]} · ${NM[SM[0]]}`], [W * 0.8, cy, `${NM[SM[3]]} · ${NM[SM[2]]}`]];
  // the body of the radio
  g.fillStyle = '#17191f'; g.beginPath(); if (g.roundRect) g.roundRect(W * 0.03, cy - rad * 1.4, W * 0.94, rad * 2.65, rad * 0.5); else g.rect(W * 0.03, cy - rad * 1.4, W * 0.94, rad * 2.65); g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke();
  const r = at(judge.t), xy = (q, k) => [val(q, SM[k * 2]), val(q, SM[k * 2 + 1])];
  for (let k = 0; k < 2; k++) { const [cx, py, name] = pads[k];
    g.fillStyle = '#08090c'; g.beginPath(); g.arc(cx, py, rad, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = '#2b2e37'; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - rad, py); g.lineTo(cx + rad, py); g.moveTo(cx, py - rad); g.lineTo(cx, py + rad); g.stroke();
    for (const f of [-1, -0.5, 0.5, 1]) { g.beginPath(); g.moveTo(cx + f * rad * 0.86, py - 7); g.lineTo(cx + f * rad * 0.86, py + 7); g.moveTo(cx - 7, py + f * rad * 0.86); g.lineTo(cx + 7, py + f * rad * 0.86); g.stroke(); }
    const P = q => { const [x, y] = xy(q, k); return [cx + Math.max(-1, Math.min(1, x)) * rad * 0.86, py - Math.max(-1, Math.min(1, y)) * rad * 0.86]; };
    for (let i = 10; i >= 1; i--) { const t = judge.t - i * 0.035; if (t < 0) continue; const a = P(at(t)); g.fillStyle = `rgba(255,200,90,${0.5 * (1 - i / 13)})`; g.beginPath(); g.arc(a[0], a[1], rad * 0.07, 0, 7); g.fill(); }
    const [sx, sy] = P(r); g.strokeStyle = '#000'; g.lineWidth = rad * 0.13; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, py); g.lineTo(sx, sy); g.stroke();
    g.strokeStyle = '#8b90a0'; g.lineWidth = rad * 0.08; g.beginPath(); g.moveTo(cx, py); g.lineTo(sx, sy); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(sx, sy, rad * 0.16, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = '#111'; g.stroke();
    // an arrow beside the gimbal, only for a stick that is moving (or, on the right stick, pushed well over)
    const r0 = at(judge.t - 0.12), [x1, y1] = xy(r, k), [x0, y0] = xy(r0, k), vx = (x1 - x0) / 0.12, vy = (y1 - y0) / 0.12;
    const big = (v, mv, hold) => Math.abs(mv) > 1.2 ? Math.sign(mv) : hold && Math.abs(v) > 0.45 ? Math.sign(v) : 0;
    const ax = big(x1, vx, SM[k * 2] !== 'thr'), ay = big(y1, vy, SM[k * 2 + 1] !== 'thr');   // the throttle only while it moves; the others also while held well over
    const arrow = (dx, dy) => { const L = rad * 0.5, w = rad * 0.16, ox = k === 0 ? cx - rad * 1.2 : cx + rad * 1.2, oy = py, ex = dx ? cx + dx * rad * 0.2 : ox, ey = dx ? py + rad * 1.2 : oy;
      const bx = dx ? ex - dx * L / 2 : ox, by = dx ? ey : oy + dy * L / 2, tx = dx ? ex + dx * L / 2 : ox, ty = dx ? ey : oy - dy * L / 2, ux = (tx - bx) / L, uy = (ty - by) / L, nx = -uy, ny = ux;
      g.beginPath(); g.moveTo(bx + nx * w * 0.45, by + ny * w * 0.45); g.lineTo(tx - ux * w * 1.3 + nx * w * 0.45, ty - uy * w * 1.3 + ny * w * 0.45); g.lineTo(tx - ux * w * 1.3 + nx * w, ty - uy * w * 1.3 + ny * w); g.lineTo(tx, ty); g.lineTo(tx - ux * w * 1.3 - nx * w, ty - uy * w * 1.3 - ny * w); g.lineTo(tx - ux * w * 1.3 - nx * w * 0.45, ty - uy * w * 1.3 - ny * w * 0.45); g.lineTo(bx - nx * w * 0.45, by - ny * w * 0.45); g.closePath();
      g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#000'; g.stroke(); };
    if (ay) arrow(0, ay); if (ax) arrow(ax, 0);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `bold ${Math.round(rad * 0.13)}px ui-monospace, monospace`; g.textAlign = 'center'; g.fillText(name, cx, py - rad * 1.12);
  }
}
function demoBarSeek(e) { const el = $('#demoBar'); if (!el) return; const r = el.getBoundingClientRect(); demoSeek((demo.T || 0) * Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)))); }
document.addEventListener('pointerdown', e => { if (!judge.demo || !e.target.closest('#demoBar')) return; e.preventDefault(); demo.drag = true; demoBarSeek(e); });
document.addEventListener('pointermove', e => { if (demo.drag && judge.demo) demoBarSeek(e); });
document.addEventListener('pointerup', () => { demo.drag = false; });
addEventListener('keydown', e => { if (!judge.demo || mode !== 'judge' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return;
  if (e.code === 'ArrowLeft') { e.preventDefault(); if (e.shiftKey) demoStep(-1); else demoSeek(judge.t - 0.5); } if (e.code === 'ArrowRight') { e.preventDefault(); if (e.shiftKey) demoStep(1); else demoSeek(judge.t + 0.5); } if (e.code === 'Home') demoSeek(0);
  if (e.code === 'Comma') demoStep(-1); if (e.code === 'Period') demoStep(1);
  if (e.code === 'KeyB') { demo.view = demo.view === 'sticks' ? 'fpv' : 'sticks'; demoView(); demoRender(); } });
document.addEventListener('click', e => {
  const li = e.target.closest('[data-demostep]'); if (li && judge.demo) { const d = demo.steps[+li.dataset.demostep]; if (d) demoSeek(Math.max(0, d.t0 - 0.5)); return; }
  const b = e.target.closest('[data-demo]'); if (!b) return; e.stopPropagation(); b.blur(); const a = b.dataset.demo;
  if (a === 'back') demoBack();
  if (a === 'exnext' && judge.intro && judge.intro.phase === 'examples') { if (demoLoop()) judge.t = demo.a || 0; return; }
  if (a.startsWith('md')) { store.set('stickMode', +a.slice(2)); if (judge.rows) demo.steps.forEach(d => { d.sticks = stickWords(judge.rows, d.t0, d.t1); }); demoRender(); return; }
  if (a === 'view') { demo.view = demo.view === 'sticks' ? 'fpv' : 'sticks'; demoView(); demoRender(); }
  if (a === 'sb') demoStep(-1); if (a === 'sf') demoStep(1);
  if (a === 't0') demoSeek(0); if (a === 'tb') demoSeek(judge.t - 0.5); if (a === 'tf') demoSeek(judge.t + 0.5);
  if (a === 'pp') { judge.speed = judge.speed ? 0 : (demo.lastSpeed || 1); demoRender(); }
  if (a.startsWith('sp')) { judge.speed = demo.lastSpeed = +a.slice(2); demoRender(); }
  if (a === 'again') { const nm = judge.demo; judge.demo = null; demoArrows(); stopJudge(); mode = 'fly'; coach.name = nm; coachDemo(); }
});

// GoldenEye-style stick arrows (owner, 2026-11-20: "show the stick movements as big arrows around the center of the screen"):
// while Show me plays, the sticks the bot needs right now are drawn as big arrows round the crosshair: the right stick as
// arrows up / down (pitch forward / back) and left / right (roll), the left stick's yaw as a curved arrow over the top, and
// the throttle as a gauge on the left with an arrow while it is moving. Bigger and brighter the further the stick goes.
function demoArrows() {
  const cv = $('#demoArrows'), rows = demoRows(); if (!cv) return;
  const on = !!(judge.demo && mode === 'judge' && rows && rows.length > 1); if (!on) { if (!coach.freeze) cv.classList.add('hide'); return; }
  const dtR = (rows[rows.length - 1][0] - rows[0][0]) / (rows.length - 1), at = t => rows[Math.max(0, Math.min(rows.length - 1, Math.round((t - rows[0][0]) / dtR)))];
  const r = at(judge.t), r0 = at(judge.t - 0.15), dT = (r[11] - r0[11]) / 0.15, q = v => Math.abs(v) >= 0.25 ? v : 0;   // owner, 2026-11-21: arrows only on the stick that moves, only while it moves
  if (Math.abs(dT) > 0.5) demo.thrT = judge.t; const thr = Math.abs(judge.t - demo.thrT) < 0.5;
  drawStickArrows(q(r[25]), q(r[24]), q(r[26]), thr ? r[11] : null, dT);
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
  try { const f = demoFly(coach.name); coach.fly = f && f.got.rows && f.got.rows.length ? f : null; if (!f || !f.got.rows || !f.got.rows.length) return null; const rows = f.got.rows, j = f.j;
    let bot = null; const t0 = (j.out[0] || {}).t0;   // how the bot comes into the first part: its speed, height and throttle (the rolling start)
    if (t0 != null) { const r = rows.reduce((b, x) => Math.abs(x[0] - t0) < Math.abs(b[0] - t0) ? x : b, rows[0]), pre = rows.filter(x => x[0] >= t0 - 0.8 && x[0] <= t0);
      bot = { v: Math.hypot(r[21], r[23]), y: r[2], thr: pre.length ? pre.reduce((a, x) => a + x[11], 0) / pre.length : r[11] }; if (![bot.v, bot.y, bot.thr].every(Number.isFinite)) bot = null; }
    return { bot, steps: j.steps, at: j.steps.map((st, k) => { const o = j.out[k] || {}; if (o.t0 == null) return null;
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
  const html = `<small>PAUSED · NEXT: STEP ${F.k + 1} OF ${coach.steps.length}</small><b>${esc(coachCueAt(F.k))}</b><span class="cfRule">${coachStepText(st, new Set())}</span>
    <div class="cfSticks">${T.chk.includes('P') ? row(c.P, 'pitch ' + (T.any === 'P' ? 'either way' : word(T.P, 'back', 'forward'))) : ''}${T.chk.includes('R') ? row(c.R, 'roll ' + (T.any === 'R' ? 'either way' : word(T.R, 'left', 'right'))) : ''}${T.chk.includes('Y') ? row(c.Y, 'yaw ' + (T.any === 'Y' ? 'either way' : word(T.Y, 'left', 'right'))) : ''}${T.T != null && inputCfg.mode !== 'keyboard' ? row(c.T, 'throttle ~' + Math.round(T.T * 100) + '%') : ''}</div>
    <div class="cfBar"><i style="width:${pctH}%"></i><em>${coach.scale > 0.02 ? 'slowing down…' : pctH >= 100 ? 'GO' : `hold ${Math.max(0, COACH_HOLD - F.held).toFixed(1)} s`}</em></div>${F.waited > 15 ? '<span>Stuck? ⏸ Pauses: off in the panel turns them off.</span>' : ''}`;
  if (el.__h !== html) { el.__h = html; el.innerHTML = html; } el.classList.remove('hide');
  const thrAsked = T.T != null && !(inputCfg.mode === 'keyboard'), rc = lastRC || {};
  drawStickArrows(T.chk.includes('P') ? T.P : 0, T.chk.includes('R') ? T.R : 0, T.chk.includes('Y') ? T.Y : 0, thrAsked ? T.T : null, 0, { P: rc.pitch || 0, R: rc.roll || 0, Y: rc.yaw || 0, T: rc.thr || 0 });
}
setInterval(() => { if (!coach.freeze) return; if (!coach.on || mode !== 'fly' || coach.phase !== 'parts') { coachFreezeEnd(); return; }
  const F = coach.freeze, now = performance.now(), dt = Math.min(0.5, (now - F.last) / 1000); F.last = now; F.waited += dt;   // a long hitch counts at most half a second
  F.check = coachStickCheck(coachTarget(F.k), lastRC); F.held = F.check.ok ? (coach.scale < 0.02 ? F.held + dt : F.held) : Math.max(0, F.held - 2 * dt);   // the hold counts once it has come to rest
  if (F.held >= COACH_HOLD) { coach.pauseSnap = { k: F.k, st: coachSnap() }; coach.atCk = false; coachFreezeEnd(); } else coachFreezeDraw(); }, 100);
window.__pwCoach = { exWhy: () => { demo.why = []; const l = demoExamples(coach.name, coach.fly); return { n: l.length, lib: l.filter(f => f.lib).length, why: demo.why.slice() }; }, st4: () => ({ tryN: coach.tryN, phase: coach.phase, done: coach.done, log: coach.log, chain: coach.chain, intro: judge.intro ? { phase: judge.intro.phase, i: judge.intro.i, n: judge.intro.list ? judge.intro.list.length : 0, list: (judge.intro.list || []).map(f => ({ lib: f.lib, ok: f.ok, hit: f.hit, object: f.object, label: demoExLabel(f) })) } : null }), tryDone: (ok, how) => coachTryDone(ok, how), event: n => coachEvent({ name: n }), demoHit: () => coach.fly ? { hit: coach.fly.hit, ok: coach.fly.ok, lib: coach.fly.lib, object: coach.fly.object } : null, freeze: k => { coachFreezeStart(k); return !!coach.freeze; }, frozen: () => coachFrozen(), retry: s => coachRetry(s), mark: n => { coach.ck = { bank: { n, obj: null, vars: {}, out: coach.steps.slice(0, n).map(() => ({ ok: true, msg: 'test' })), key: JSON.stringify(coach.steps.slice(0, n)) }, steps: coach.steps, st: coachSnap() }; coach.doneN = n; }, state: () => JSON.stringify({ entry: coach.entry ? { v: +Math.hypot(coach.entry.vel.x, coach.entry.vel.y, coach.entry.vel.z).toFixed(2), thr: coach.entry.thr, obj: coach.entry.obj, y: coach.entry.pos.y } : null, ck: coach.ck ? coach.ck.bank.n : 0, bank: coach.bank ? coach.bank.n : 0, v: +Math.hypot(drone.vel.x, drone.vel.y, drone.vel.z).toFixed(2), tryN: coach.tryN, ry: +drone.right().y.toFixed(2), held: !!coach.hold, y: +drone.pos.y.toFixed(2), sc: +coach.scale.toFixed(3), upY: +drone.up().y.toFixed(2), done: coach.doneN, t: coach.freeze ? coachTarget(coach.freeze.k) : null, f: coach.freeze, ph: coach.phase, on: coach.on, mode, armed: drone.armed, cr: drone.crashed }) };   // test hook (tools / smoke tests)
