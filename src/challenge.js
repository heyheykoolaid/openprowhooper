// ============================================================ Trick challenges (owner, 2026-11-23; docs/DESIGN-LOG.md)
// A pilot names a new trick in SKITTLES mode and posts that stretch of their run (🏆 Post as a challenge): its name, their pilot
// name, the map, the move's signature (the trick library's `libSig`, measured by re-flying the clip through the detector, exactly
// as the game measures a move live) and the clip itself. Other pilots open the Trick challenges board, watch it, and press Try it:
// from then on every move they fly is compared with it (Sim.setChallenges → the detector's `chalJudge`); a move within CH_PASS
// passes, says so, and is posted as a try with its own clip. CH_CONFIRM (2) pilots other than the creator passing makes it a
// community trick, LIVE at once (owner: "live at default points"): the game calls it in every flight where no book trick was
// called and scores it on its own line (ScoreKeeper.community, 200 until the owner sets its points), never in the TPW score.
// Names: Sim.badName in the game and the same word list again on the relay; the owner hides, renames and prices from the board.
// Everything on the board is other people's text: always esc().
const CH = {
  list: null,
  msg: '',
  busy: false,
  open: null,
  view: 'all',
  from: 'menu',
  sigs: store.get('chSigs', {}) || {},
  tryId: store.get('chTry', null),
  passed: store.get('chPassed', {}) || {}
};
const CH_MAX_CLIP = 30; // s: a posted stretch, padded 2.5 s each side (the relay takes 4000 rows at 100 Hz)
const chBase = () => lbBase();
const chOwner = () => {
  try {
    return ghMenus() && !!store.get('ownerKey', '');
  } catch {
    return false;
  }
};
const chMapT = id => (S.MAPS[id] || {}).title || id || '';
const chMine = c => c && c.pilot === telPilot();
const chById = id => (CH.list || []).find(c => c.id === id) || null;

// what the detector listens for: every confirmed (live) challenge, and the one this pilot is trying
function chApply() {
  const L = [];
  for (const c of CH.list || []) {
    const sig = CH.sigs[c.id];
    if (!sig || c.hidden || !c.name) continue;
    const isTry = c.id === CH.tryId && !c.confirmed,
      live = c.confirmed;
    if (isTry || live) L.push({ id: c.id, name: c.name, sig, live, try: isTry, pts: c.pts });
  }
  chList = L.length ? L : null;
  S.setChallenges(chList);
  if (typeof DW !== 'undefined' && DW.on && DW.w) DW.w.postMessage({ t: 'chal', v: chList });
}
async function chSig(id) {
  // the signature of one challenge (kept: it never changes)
  if (CH.sigs[id]) return CH.sigs[id];
  try {
    const r = await fetch(`${chBase()}/challenge?id=${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    const p = await r.json();
    if (!p || !p.sig) return null;
    CH.sigs[id] = p.sig;
    const ks = Object.keys(CH.sigs);
    if (ks.length > 80) for (const k of ks.slice(0, ks.length - 80)) delete CH.sigs[k];
    store.set('chSigs', CH.sigs);
    return p.sig;
  } catch {
    return null;
  }
}
async function chLoad() {
  if (!chBase()) {
    CH.msg = 'The trick board needs the online version of the game.';
    return;
  }
  try {
    const r = await fetch(`${chBase()}/challenges`);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    CH.list = Array.isArray(j.challenges) ? j.challenges.filter(c => c && typeof c.id === 'string' && Array.isArray(c.passed)) : [];
    CH.confirm = Number.isInteger(j.confirm) ? j.confirm : S.CH_CONFIRM;
    CH.msg = '';
  } catch {
    CH.msg = CH.list ? '' : 'The trick board could not be reached just now (the relay may need redeploying).';
    return;
  }
  if (CH.tryId && !chById(CH.tryId)) {
    CH.tryId = null;
    store.set('chTry', null);
  }
  for (const c of CH.list.filter(c => (c.confirmed || c.id === CH.tryId) && !c.hidden).slice(0, 20)) await chSig(c.id);
  chApply();
}
setTimeout(
  () =>
    chLoad().then(() => {
      if (!$('#chScreen').classList.contains('hide')) chRender();
    }),
  2500
);
setInterval(() => {
  if (mode !== 'fly') chLoad();
}, 600000);

// ---- the board
function chOpen(from) {
  CH.from = from || 'menu';
  mode = 'menu';
  show('#chScreen');
  chRender();
  chLoad().then(chRender);
}
function chRender() {
  const el = $('#chPanel');
  if (!el) return;
  const L = (CH.list || []).filter(c => chOwner() || !c.hidden),
    own = chOwner();
  const pick =
    { all: L, live: L.filter(c => c.confirmed && !c.hidden), open: L.filter(c => !c.confirmed && !c.hidden), mine: L.filter(chMine) }[
      CH.view
    ] || L;
  const tab = (k, t) => `<button data-ch="view" data-v="${k}" class="${CH.view === k ? 'primary' : ''}">${t}</button>`,
    trying = CH.tryId && chById(CH.tryId);
  const row = c => {
    const st = c.hidden
      ? '<span class="chSt hid">hidden</span>'
      : c.confirmed
        ? `<span class="chSt live" title="Confirmed by ${esc(c.passed.join(', '))}">LIVE · ${(+c.pts || 0).toLocaleString()} pts</span>`
        : `<span class="chSt" title="${c.passed.length ? 'Passed by ' + esc(c.passed.join(', ')) : 'Nobody has matched it yet'}">${c.n} of ${CH.confirm || S.CH_CONFIRM} pilots</span>`;
    const tryBtn =
      c.hidden || c.confirmed || chMine(c)
        ? ''
        : c.id === CH.tryId
          ? `<button data-ch="untry" data-id="${esc(c.id)}" class="primary" title="Stop comparing your moves with this one">🎯 Trying…</button>`
          : CH.passed[c.id]
            ? '<span class="note">✓ you passed it</span>'
            : `<button data-ch="try" data-id="${esc(c.id)}" title="Fly it: every move you make is compared with this one until you pass or stop">🎯 Try it</button>`;
    const mod = own
      ? `<button data-ch="mod" data-op="${c.hidden ? 'show' : 'hide'}" data-id="${esc(c.id)}" class="ghost" title="Owner: ${c.hidden ? 'show it again' : 'hide it from every pilot'}">${c.hidden ? 'Show' : 'Hide'}</button><button data-ch="mod" data-op="name" data-id="${esc(c.id)}" class="ghost" title="Owner: give it another name">Rename</button><button data-ch="mod" data-op="pts" data-id="${esc(c.id)}" class="ghost" title="Owner: what a confirmed one scores">Points</button>`
      : '';
    return `<tr class="${c.id === (CH.open || {}).id ? 'on' : ''}"><td><b>${c.hidden ? '<i>hidden challenge</i>' : esc(c.name)}</b><small>by ${esc(c.by)}${chMine(c) ? ' (you)' : ''} · ${esc(chMapT(c.map))} · ${esc(hubAgo(c.at))}</small></td><td>${st}</td><td class="chAct">${c.hidden ? '' : `<button data-ch="watch" data-id="${esc(c.id)}" title="Watch the clip it was posted with">▶ Watch</button>`}${tryBtn}${mod}</td></tr>`;
  };
  el.innerHTML = `<h2>TRICK CHALLENGES</h2>
    <p class="note">New tricks pilots made up. Watch one, press Try it, and fly it: when your move matches, it counts. Once ${CH.confirm || S.CH_CONFIRM} pilots besides its maker have matched it, it is a community trick: the game recognises it in everyone's flights and scores it (its own line, like gaps). To post your own: in SKITTLES mode, pick the stretch, name the new trick in the box, then 🏆 Post as a challenge.</p>
    ${trying ? `<p class="chTry">🎯 Trying <b>${esc(trying.name)}</b> by ${esc(trying.by)}: fly it in Free Fly or a Session on any map. <button data-ch="untry" data-id="${esc(trying.id)}">Stop</button></p>` : ''}
    <div class="row">${tab('all', 'All')}${tab('live', 'Live')}${tab('open', 'Being tried')}${tab('mine', 'Mine')}<button data-ch="refresh" title="Refresh">↻</button></div>
    ${CH.msg ? `<p class="note">${esc(CH.msg)}</p>` : !CH.list ? '<p class="note">Loading…</p>' : pick.length ? `<table class="lbT chT"><tr><th>Trick</th><th>Status</th><th></th></tr>${pick.map(row).join('')}</table>` : `<p class="note">${CH.view === 'mine' ? 'You have not posted one yet.' : 'Nothing here yet.'}</p>`}
    ${CH.open && CH.open.note ? `<p class="note">${esc(CH.open.note)}</p>` : ''}
    <div class="row"><button data-ch="close" class="primary">Back</button></div>`;
}

// ---- watching one (its clip, in the replay viewer as a guest: never saved, reviewed or shared)
async function chWatch(id) {
  const c = chById(id);
  if (!c) return;
  CH.open = { id, note: 'Loading the clip…' };
  chRender();
  let p;
  try {
    const r = await fetch(`${chBase()}/challenge?id=${encodeURIComponent(id)}`);
    if (!r.ok) throw 0;
    p = await r.json();
    if (!p || !p.trace) throw 0;
  } catch {
    CH.open = { id, note: 'That clip could not be loaded.' };
    chRender();
    return;
  }
  if (p.sig && !CH.sigs[id]) {
    CH.sigs[id] = p.sig;
    store.set('chSigs', CH.sigs);
  }
  if (!S.MAPS[p.map]) {
    CH.open = { id, note: 'It was flown on a map this version of the game does not have.' };
    chRender();
    return;
  }
  if (p.map !== MAP_ID || MAP_EDITS) {
    const q =
      p.map !== MAP_ID
        ? `This trick was flown on ${S.MAPS[p.map].title}. Watching it will change your map to that one. Is that okay?`
        : 'Watching it uses the official map, so the map you have loaded is switched off until the next reload. Is that okay?';
    if (!confirm(q)) {
      CH.open = null;
      chRender();
      return;
    }
    store.set('chPending', { id });
    if (p.map !== MAP_ID) store.set('map', p.map);
    else store.set('layoutOffOnce', true);
    procFlight(telCapture('map'), () => {
      $('#loading').textContent = 'Loading ' + S.MAPS[p.map].title + '…';
      show('#loading');
      setTimeout(() => location.reload(), 300);
    });
    return;
  }
  try {
    const rows = await FlightLog.unpack(p.trace),
      T0 = rows[0][0];
    CH.open = null;
    guestOpen(
      rows,
      [{ t: T0 + (+p.t1 || 0), t0: T0 + (+p.t0 || 0), name: c.name, exec: 'CHALLENGE' }],
      { name: c.by, flight: null, source: 'challenge', ref: id },
      false
    );
    flash(
      `<b>${esc(c.name.toUpperCase())}</b><small>by ${esc(c.by)}${p.like ? ' · looks a little like ' + esc(p.like) : ''}</small>`,
      'near'
    );
  } catch {
    CH.open = { id, note: 'That clip could not be opened.' };
    chRender();
  }
}
setTimeout(async () => {
  const P = store.get('chPending', null);
  if (!P) return;
  store.set('chPending', null);
  chOpen('menu');
  await chLoad();
  chRender();
  if (chById(P.id)) chWatch(P.id);
}, 1800);

// ---- trying one
async function chTry(id) {
  const c = chById(id);
  if (!c || c.confirmed || chMine(c)) return;
  if (!(await chSig(id))) {
    CH.open = { id, note: 'That challenge could not be loaded: try again in a moment.' };
    chRender();
    return;
  }
  CH.tryId = id;
  store.set('chTry', id);
  chApply();
  CH.open = { id, note: `Now fly ${c.name}: the game compares every move you make with it.` };
  chRender();
}
function chUntry() {
  CH.tryId = null;
  store.set('chTry', null);
  chApply();
  CH.open = null;
  chRender();
}

// a clip of the pilot's own run, from the replay buffer (detector clock = the run's clock)
const chClip = (a, b) => recap.trace.filter(r => r[0] >= a - 2.5 && r[0] <= b + 2.5);
// the detector found a challenge in what was just flown
async function chHit(h) {
  if (mode !== 'fly' || !h) return;
  const c = chById(h.chal);
  if (h.live) {
    // a confirmed community trick
    if (!score || !drone.armed || drone.crashed || race.on || MAP_ID === 'training') return;
    const r = score.community(h.name, h.pts);
    combo.names.push(`${h.name}${r.repeat ? ' ×' + (r.repeat + 1) : ''}`);
    combo.pts += r.pts;
    combo.lastT = performance.now() / 1000;
    combo.active = true;
    renderCombo();
    flash(
      `<b>${esc(h.name.toUpperCase())}</b><small>community trick${c ? ' by ' + esc(c.by) : ''}</small><div class="pRow"><em>+${r.pts}</em></div>`,
      'gapPop'
    );
    return;
  }
  if (!h.try || h.chal !== CH.tryId || CH.passed[h.chal]) return;
  CH.passed[h.chal] = Date.now();
  store.set('chPassed', CH.passed);
  CH.tryId = null;
  store.set('chTry', null);
  chApply();
  const nm = pilotName(),
    name = c ? c.name : h.name;
  flash(
    `<b>CHALLENGE PASSED!</b><small>${esc(name)}${c ? ' by ' + esc(c.by) : ''} · ${Math.round((1 - (h.dist / S.CH_PASS) * 0.5) * 100)}% match</small>`,
    'metal chainBonus'
  );
  if (anonOn() || !lbNameOk(nm) || S.badName(nm) || !chBase() || MAP_ID === 'training') return; // no name, nothing to count it under
  try {
    const off = drone.time - detector.time,
      rows = chClip(h.t0 + off, h.t1 + off);
    if (rows.length < TRACE_HZ) return;
    /* off: the detector's clock to the run's (as recapMaybe) */ const T0 = rows[0][0],
      trace = await FlightLog.pack(rows, TRACE_COLS, TRACE_HZ);
    const payload = {
      format: 'pro-whooper-challenge-try/1',
      build: '0.1',
      challenge: h.chal,
      by: nm,
      pilot: telPilot(),
      map: MAP_ID,
      at: new Date().toISOString(),
      dist: h.dist,
      sig: h.sig,
      t0: +(h.t0 + off - T0).toFixed(3),
      t1: +(h.t1 + off - T0).toFixed(3),
      camTilt: tune.camTilt,
      trace
    };
    const r = await fetch(chBase(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ kind: 'chtry', payload })
    });
    if (r.status === 200) {
      setTimeout(
        () =>
          flash(
            `<b>YOUR PASS IS IN</b><small>${esc(name)}: ${Math.max(0, (CH.confirm || S.CH_CONFIRM) - ((c && c.n) || 0) - 1)} more pilot(s) to make it a community trick</small>`,
            'near'
          ),
        2200
      );
      chLoad();
    }
  } catch {
    /* the pass still counted here; it was not sent */
  }
}

// ---- posting one (from SKITTLES mode: a stretch the pilot named as a new trick)
async function chPost(name, span) {
  const nm = pilotName(),
    [a, b] = span || [];
  const no = m => {
    flash(`<b>NOT POSTED</b><small>${m}</small>`, 'near');
    return false;
  };
  if (recap.guest) return no('only your own runs can be posted');
  if (!chBase()) return no('the trick board needs the online version of the game');
  if (anonOn() || !lbNameOk(nm)) return no('pick a pilot name in Options first');
  if (S.badName(nm)) return no('your pilot name cannot go on the board');
  if (!name || name.length < 2 || S.badName(name)) return no('that name cannot go on the board: pick another');
  if (MAP_ID === 'training' || MAP_EDITS)
    return no('post it from a flight on an official map (not the Training Room or a map of your own)');
  if (!(b > a) || b - a > CH_MAX_CLIP - 5) return no('pick a stretch under 25 s long');
  const rows = chClip(a, b);
  if (rows.length < TRACE_HZ * 1.2) return no('that stretch is no longer in the replay');
  const T0 = rows[0][0];
  procShow('Measuring your trick…', 'the game flies the clip again to measure it, the way it measures moves live', 0.2);
  let R;
  try {
    R = S.replayTrace(rows, { world, camTilt: tune.camTilt, debug: false });
  } catch {
    procHide();
    return no('the clip could not be measured');
  }
  const sig = R.det.libSigOf(a - T0 - 0.25, b - T0 + 0.25);
  procHide();
  if (!sig) return no('there is not enough rotation in that stretch to make a trick of: stretch it over the whole move');
  // does it look like something the game already knows? (what the rules called there, the library's nearest trick, the other challenges)
  const calls = [
    ...new Set(R.events.filter(e => e.name !== 'near' && e.name !== 'Crash' && e.t >= a - T0 - 0.5 && e.t <= b - T0 + 2.5).map(e => e.name))
  ];
  const lib = (S.libMatch(sig) || [])[0],
    libLike = lib && lib.pos <= 0.3 ? lib.name : null;
  let chLike = null;
  for (const c of CH.list || []) {
    const g = CH.sigs[c.id];
    if (g && !c.hidden && S.libDist(sig, g) <= S.CH_PASS) {
      chLike = c;
      break;
    }
  }
  const like = calls[0] || libLike || (chLike ? chLike.name : null);
  if (
    chLike &&
    !confirm(
      `"${chLike.name}" by ${chLike.by} is already on the trick board and your move matches it. Post yours as a new trick anyway? (You could try theirs instead.)`
    )
  )
    return false;
  const warn =
    calls.length || libLike
      ? `The game ${calls.length ? 'called ' + calls.join(' + ') + ' here' : ''}${calls.length && libLike ? ', and it' : ''}${libLike ? ' looks like a ' + libLike + ' to the trick library' : ''}. `
      : '';
  if (
    !confirm(
      `${warn}Post "${name}" as a new trick challenge?\n\nOther pilots will see its name, your pilot name (${nm}) and this clip of your run, and can try it. Once 2 of them match it, it becomes a community trick everyone can score.`
    )
  )
    return false;
  procShow('Posting your trick…', `"${name}" goes on the trick board`, 0.5);
  let msg = '';
  try {
    const trace = await FlightLog.pack(rows, TRACE_COLS, TRACE_HZ);
    const payload = {
      format: 'pro-whooper-challenge/1',
      build: '0.1',
      name,
      by: nm,
      pilot: telPilot(),
      map: MAP_ID,
      at: new Date().toISOString(),
      like: like ? String(like).slice(0, 60) : undefined,
      sig: { d: sig.d, c: sig.c, u: sig.u, ps: sig.ps },
      t0: +(a - T0).toFixed(3),
      t1: +(b - T0).toFixed(3),
      camTilt: tune.camTilt,
      trace
    };
    const r = await fetch(chBase(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ kind: 'challenge', payload })
    });
    msg =
      r.status === 200
        ? ''
        : r.status === 400
          ? 'The board did not take that name.'
          : r.status === 429
            ? 'The board is busy: try again in a bit.'
            : r.status === 403
              ? 'Posting only works from the online version of the game.'
              : 'The board did not take it (' + r.status + ').';
  } catch {
    msg = 'Could not reach the trick board just now.';
  }
  if (msg) {
    procShow('Not posted', msg, 1);
    await new Promise(res => setTimeout(res, 2200));
    procHide();
    return false;
  }
  procShow(procThanks(), `"${name}" is on the trick board. When 2 other pilots match it, it becomes a community trick.`, 1);
  await new Promise(res => setTimeout(res, 2200));
  procHide();
  chLoad();
  return true;
}

// ---- the owner's tools (POST /chmod with the owner key)
async function chMod(id, op) {
  const c = chById(id);
  if (!c || !chOwner()) return;
  let body = { key: store.get('ownerKey', ''), id, op };
  if (op === 'name') {
    const v = prompt('New name for this trick:', c.name || '');
    if (v == null) return;
    if (S.badName(v)) {
      alert('That name is on the word list.');
      return;
    }
    body.name = v.trim();
  }
  if (op === 'pts') {
    const v = prompt('Points a confirmed one scores (0-5000):', String(c.pts ?? S.CH_PTS));
    if (v == null) return;
    body.pts = Math.round(+v);
    if (!Number.isInteger(body.pts) || body.pts < 0 || body.pts > 5000) {
      alert('A whole number from 0 to 5000.');
      return;
    }
  }
  if (op === 'hide' && !confirm(`Hide "${c.name}" by ${c.by} from every pilot?`)) return;
  try {
    const r = await fetch(`${chBase()}/chmod`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
    CH.open = {
      id,
      note:
        r.status === 200
          ? 'Done: the board updates within a minute.'
          : `The relay said ${r.status}${r.status === 404 || r.status === 400 ? ' (redeploy the relay?)' : ''}.`
    };
  } catch {
    CH.open = { id, note: 'Could not reach the relay.' };
  }
  CH.list = null;
  chRender();
  await chLoad();
  chRender();
}

document.addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  if (act && act.dataset.act === 'challenges') {
    chOpen('menu');
    return;
  }
  const b = e.target.closest('[data-ch]');
  if (!b) return;
  const a = b.dataset.ch,
    id = b.dataset.id;
  if (a === 'close') {
    mode = 'menu';
    show('#mainMenu');
    return;
  }
  if (a === 'view') {
    CH.view = b.dataset.v;
    chRender();
    return;
  }
  if (a === 'refresh') {
    CH.list = null;
    chRender();
    chLoad().then(chRender);
    return;
  }
  if (a === 'watch') chWatch(id);
  if (a === 'try') chTry(id);
  if (a === 'untry') chUntry();
  if (a === 'mod') chMod(id, b.dataset.op);
});
window.__pw.challenges = {
  get state() {
    return CH;
  },
  open: () => chOpen('menu'),
  load: chLoad,
  post: chPost,
  hit: chHit,
  apply: chApply
};
