// ============================================================ Review Hub (owner, 2026-11-20; the draft he approved)
// One screen for every kind of reviewing: sections down the side (My runs, Quick check, Board runs for every pilot; Review
// queue, All shared flights, Community changes, Bot flights, Feedback, Disagreements and Per trick with the owner key), the
// chosen section's list with a filter bar that stays put, and the one review player (recap.js) every item opens in, with
// ◂ Previous / Next ▸ through the list it came from. It is a front end on what was there: the same loaders (Flight desk,
// Judge the community, the board), the same player, the same labels sent the same way. Nothing undecided is ever sent.
// A verdict on someone else's run waits 10 s before it goes (Undo takes it back in that time; owner's question 3).
// My runs: every run of 10 s or more is kept in this browser (IndexedDB 'runs', id 'mine-<run>', the trace packed), the last 12.
const HUB_SECS = [
  { id: 'mine', name: 'My runs', who: 'all', hint: 'Your own runs, newest first. Open one to say what the game got right and wrong.' },
  {
    id: 'quick',
    name: 'Quick check',
    who: 'all',
    hint: "The calls in your last run most worth an answer: ones you flagged, the trick library's guesses, the ones the game was least sure of."
  },
  {
    id: 'board',
    name: 'Board runs',
    who: 'all',
    hint: "Today's posted runs from other pilots. Watch one and say what each trick really was: your vote is pooled with everyone else's on that moment (it counts in full once three people agree)."
  },
  {
    id: 'queue',
    name: 'Review queue',
    who: 'all',
    hint: "The moments in other pilots' shared flights the game most needs a second opinion on: calls a pilot flagged, tricks it missed, its guesses and unsure calls, and moments other pilots voted on. Three pilots agreeing settles one."
  },
  { id: 'flights', name: 'All flights', who: 'owner', hint: 'Every shared flight, newest first, with what was already said about it.' },
  {
    id: 'community',
    name: 'Community',
    who: 'owner',
    hint: "Moments in recent board runs where today's detector disagrees with what was called then, or is unsure."
  },
  {
    id: 'disagree',
    name: 'Disagreements',
    who: 'owner',
    hint: "Moments where pilots' labels do not agree. Each answer is shown; yours is pooled with theirs (the hub never picks a winner)."
  },
  {
    id: 'trick',
    name: 'Per trick',
    who: 'owner',
    hint: 'Every labelled example of one trick, one after another: confirmed, rejected and waiting.'
  },
  {
    id: 'bot',
    name: 'Bot flights',
    who: 'owner',
    hint: 'The bot flies a trick from the library (or its script); you say whether it was that trick.'
  },
  {
    id: 'viewer',
    name: 'FLIGHT VIEWER',
    who: 'owner',
    hint: 'Every shared flight, newest first. Open one to watch it back as it was flown: the live HUD, score, streak, combo, call-outs and K.W.A.D. letters from the calls the game made then, with play / pause, scrubbing, ±5 s, frame steps and speeds from ×0.25 to ×4. Nothing is reviewed or sent from here.'
  },
  { id: 'feedback', name: 'Feedback', who: 'owner', hint: "Pilots' written feedback, the last 7 days." }
];
const HUB_UNDO_S = 10,
  HUB_MINE = 12;
const HUB = Object.assign(
  { sec: 'mine', f: { map: '', pilot: '', trick: '', date: '', state: '', q: '' }, trick: '' },
  store.get('hub', {}),
  { nav: null, pending: [], log: [], mine: null, busy: {}, msg: {}, scroll: {} }
);
HUB.done = store.get('hubDone', {});
const hubSave = () => store.set('hub', { sec: HUB.sec, f: HUB.f, trick: HUB.trick });
const hubOwner = () => ghMenus();
const hubSecs = () => HUB_SECS.filter(s => s.who === 'all' || hubOwner());
const hubToday = () => {
  const d = new Date().toISOString().slice(0, 10),
    q = store.get('hubDay', null);
  return q && q.d === d ? q : { d, n: 0 };
};
const hubAgo = at => {
  if (!at) return '';
  const s = (Date.now() - at) / 1000;
  return s < 90
    ? 'just now'
    : s < 5400
      ? Math.round(s / 60) + ' min ago'
      : s < 129600
        ? Math.round(s / 3600) + ' h ago'
        : Math.round(s / 86400) + ' days ago';
};
const hubMapT = id => (S.MAPS[id] || {}).title || id || '';

// ---- My runs: keep every run worth reviewing (called when a new flight starts, when a review is saved, and when the hub opens)
async function hubKeepRun() {
  if (recap.guest || !recap.id || recap.trace.length < 10 * TRACE_HZ || MAP_ID === 'training') return;
  const id = recap.id, // owner, 2026-11-21: nothing from the Training Room is kept
    rows = recap.trace.slice(),
    started = recap.started,
    map = MAP_ID,
    camTilt = tune.camTilt;
  const events = JSON.parse(JSON.stringify(recap.events)),
    flags = JSON.parse(JSON.stringify(recap.flags));
  try {
    const packed = await FlightLog.pack(rows, TRACE_COLS, TRACE_HZ);
    await idb.put('runs', {
      id: 'mine-' + id,
      mine: true,
      run: id,
      started,
      at: Date.now(),
      map,
      camTilt,
      events,
      flags,
      packed,
      secs: rows.length / TRACE_HZ,
      layout: !!MAP_EDITS
    });
    const all = (await idb.all('runs')).filter(r => r && r.mine).sort((a, b) => (b.at || 0) - (a.at || 0));
    for (const old of all.slice(HUB_MINE)) await idb.del('runs', old.id);
    HUB.mine = null;
  } catch {
    /* storage full or blocked: the run just isn't kept */
  }
}
async function hubLoadMine() {
  try {
    const all = (await idb.all('runs')).filter(r => r && (r.mine || r.review));
    for (const r of all)
      if (r.map === 'training') {
        try {
          await idb.del('runs', r.id);
        } catch {
          /* next time */
        }
      } // Training Room runs kept by earlier builds are removed
    HUB.mine = all.filter(r => r.map !== 'training');
  } catch {
    HUB.mine = [];
  }
}
const hubDecided = e => e.verdict === 'yes' || (e.verdict === 'no' && !!e.actual);
// an older review (saved before runs were kept here): put the pilot's verdicts back on the calls from its labels
function hubFromLabels(r) {
  const events = (r.events || []).map(e => ({
      t: e.t,
      t0: Number.isFinite(e.t0) ? e.t0 : e.t - 1.2,
      name: e.name,
      exec: e.exec || '',
      clean: e.clean ?? null,
      obstacle: e.obstacle || null,
      conf: e.conf ?? null,
      fails: [],
      verdict: null,
      actual: null
    })),
    flags = [];
  for (const l of r.labels || []) {
    if (l.undone) continue;
    const e = l.via === 'review' && events.find(x => x.name === l.target && l.gameSpan && Math.abs(x.t - l.gameSpan[1]) < 0.05);
    if (e) {
      if (l.verdict === 'yes' && l.actual === l.target) e.verdict = 'yes';
      else if (l.actual) {
        e.verdict = 'no';
        e.actual = l.actual;
      }
    } else if ((l.via === 'review-added' || l.via === 'flag-missed') && l.actual && !l.order)
      flags.push({ t: l.t, t0: l.timed ? l.repStart : null, actual: l.actual, added: l.via === 'review-added' });
  }
  return { events, flags };
}

// ---- the items of each section: { key, title, sub, map, pilot, tricks, at, done, people, disputed, open }
function hubItems(sec) {
  const me = (pilotName() || '').toLowerCase(),
    out = [];
  if (sec === 'mine') {
    const cur = !recap.guest && recap.id && recap.trace.length >= TRACE_HZ ? recap.id : null;
    if (cur) {
      const d = recap.events.filter(hubDecided).length;
      out.push({
        key: 'mine:' + cur,
        title: `This run · ${recap.events.length} call${recap.events.length === 1 ? '' : 's'}`,
        sub: `${hubMapT(MAP_ID)} · now · ${d} decided`,
        map: MAP_ID,
        pilot: me,
        tricks: recap.events.map(e => e.name),
        at: Date.now(),
        done: recap.events.length > 0 && d >= recap.events.filter(e => !e.hidden).length,
        open: () => openRecap('hub')
      });
    }
    const seen = new Set(cur ? [cur] : []);
    for (const r of (HUB.mine || []).slice().sort((a, b) => (b.at || Date.parse(b.started) || 0) - (a.at || Date.parse(a.started) || 0))) {
      const run = r.mine ? r.run : String(r.id).replace(/^review-/, '');
      if (seen.has(run)) continue;
      seen.add(run);
      const ev = r.mine ? r.events || [] : hubFromLabels(r).events,
        d = ev.filter(hubDecided).length,
        at = r.at || Date.parse(r.started) || 0;
      out.push({
        key: 'mine:' + run,
        title: `${new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${ev.length} call${ev.length === 1 ? '' : 's'}`,
        sub: `${hubMapT(r.map)} · ${hubAgo(at)} · ${d} decided${r.mine ? '' : ' (reviewed)'}`,
        map: r.map,
        pilot: me,
        tricks: ev.map(e => e.name),
        at,
        done: ev.length > 0 && d >= ev.filter(e => !e.hidden).length,
        open: () => hubOpenMine(r)
      });
    }
  }
  if (sec === 'quick' && !recap.guest && recap.id)
    for (const x of quickPick())
      out.push({
        key: `quick:${recap.id}@${x.t.toFixed(1)}`,
        title: x.e.name,
        sub: x.e.flag
          ? 'you flagged it (F)'
          : x.e.maybe
            ? "the trick library's guess"
            : `the game was ${Math.round((x.e.conf ?? 0.75) * 100)} % sure`,
        map: MAP_ID,
        pilot: me,
        tricks: [x.e.name],
        at: Date.now(),
        done: false,
        open: () => {
          recap.quick = { list: [x.i], k: 0, n: 0 };
          openRecap('hub');
          recapPlay(x);
          renderRecap();
        }
      });
  if (sec === 'board')
    for (const e of LB.runs || []) {
      if (!e.id || String(e.name).toLowerCase() === me) continue;
      out.push({
        key: 'board:' + e.id,
        badge: e.name,
        title: `${e.name} · ${Number(e.score).toLocaleString()}`,
        sub: `${hubMapT(e.map)} · posted today`,
        map: e.map,
        pilot: String(e.name).toLowerCase(),
        tricks: [],
        at: Date.now(),
        done: !!HUB.done['board:' + e.id],
        open: () => hubOpenBoard(e)
      });
    }
  if (sec === 'queue' && desk.list)
    for (const q of deskQueue()) {
      const i = desk.info[q.file] || {},
        p = i.p || {};
      out.push({
        key: 'queue:' + deskQKey(q.file, q.t),
        title: q.name,
        sub: `${p.name || '(no name)'} · ${hubMapT(p.map)} · ${q.why}`,
        map: p.map,
        pilot: String(p.name || '').toLowerCase(),
        tricks: [q.name, q.vote].filter(Boolean),
        at: (desk.list.find(x => x.file === q.file) || {}).at,
        done: false,
        people: hubPeople(i.id, q.t),
        open: () => deskQOpen(q)
      });
    }
  if (sec === 'flights' && desk.list) {
    const dn = store.get('deskDone', {});
    for (const it of desk.list) {
      const i = desk.info[it.file];
      if (!i || i.bad) continue;
      const labs = deskLabsFor(i.id),
        nl = labs.reduce((s, x) => s + (x.L || []).length, 0);
      out.push({
        key: 'flights:' + it.file,
        title: `${i.name || '(no name)'} · ${i.calls} call${i.calls === 1 ? '' : 's'}`,
        sub: `${hubMapT(i.map)} · ${hubAgo(it.at)}${i.secs ? ' · ' + Math.round(i.secs) + ' s' : ''}${i.flagged ? ` · ${i.flagged} flagged` : ''} · ${nl ? nl + ' label' + (nl === 1 ? '' : 's') : 'no labels yet'}`,
        map: i.map,
        pilot: String(i.name || '').toLowerCase(),
        tricks: (i.p.events || []).map(e => e && e.name).filter(Boolean),
        at: it.at,
        done: !!dn[it.file],
        open: () => deskPick(it.file)
      });
    }
  }
  if (sec === 'viewer') out.push(...fvItems());
  if (sec === 'community')
    for (const [m, C] of Object.entries(JG.byMap))
      C.forEach((c, k) =>
        out.push({
          key: 'community:' + jgKey(c),
          title: c.name,
          sub: `${c.of} · ${hubMapT(m)} · ${c.why}`,
          map: m,
          pilot: String(c.of).toLowerCase(),
          tricks: [c.name],
          at: c.at || 0,
          done: !!JG.done[jgKey(c)],
          open: () => {
            JG.view = m;
            judgeClip(k);
          }
        })
      );
  if (sec === 'disagree') for (const d of hubDisagreements()) out.push(d);
  if (sec === 'trick' && HUB.trick) for (const d of hubTrickMoments(HUB.trick)) out.push(d);
  return out;
}
// moments in the shared flights' labels: { flight, a, b, says: Map(by → actual) }
function hubMoments() {
  const by = {};
  for (const x of Object.values(desk.labs)) if (x && x.f && x.T) for (const T of x.T) (by[x.f] = by[x.f] || []).push(T);
  const out = [];
  for (const [f, Ts] of Object.entries(by)) {
    const M = [];
    for (const T of Ts.sort((p, q) => p[1] - q[1])) {
      const m = M.find(m => Math.abs(m.b - T[1]) < 1.5);
      if (m) {
        m.T.push(T);
        m.a = Math.min(m.a, T[0]);
      } else M.push({ a: T[0], b: T[1], T: [T] });
    }
    for (const m of M) {
      const says = new Map();
      for (const T of m.T) says.set(String(T[4] || '?').toLowerCase(), T[3]);
      out.push({ flight: f, a: m.a, b: m.b, says });
    }
  }
  return out;
}
function hubPeople(flight, t) {
  if (!flight) return 0;
  const m = hubMoments().find(m => m.flight === flight && t >= m.a - 1.5 && t <= m.b + 2.5);
  return m ? m.says.size : 0;
}
const hubFlightOf = id => (desk.list || []).find(it => (desk.info[it.file] || {}).id === id);
function hubMomentItem(m, key, title) {
  const it = hubFlightOf(m.flight),
    i = it && desk.info[it.file];
  if (!i || i.bad) return null;
  const p = i.p,
    e = (p.events || []).find(x => x && Number.isFinite(x.t) && x.t >= m.a - 1.5 && x.t <= m.b + 2.5);
  const q = {
    file: it.file,
    kind: e ? 'call' : 'missed',
    e,
    t: e ? e.t : m.b,
    name: e ? String(e.name).slice(0, 60) : '',
    a: m.a,
    b: m.b,
    says: [...new Set(m.says.values())].filter(x => x && x !== 'not a trick').slice(0, 4)
  }; // no game call there: the pilots' own answers go on the timeline (owner, 2026-11-21: "the trick was not on the timeline")
  return {
    key,
    title,
    sub: `${p.name || '(no name)'} · ${hubMapT(p.map)} · ${[...m.says].map(([w, a]) => `${w}: ${a}`).join(' · ')}`,
    map: p.map,
    pilot: String(p.name || '').toLowerCase(),
    tricks: [...new Set(m.says.values())],
    at: it.at,
    people: m.says.size,
    disputed: new Set(m.says.values()).size > 1,
    done: !!HUB.done[key],
    open: () => deskQOpen(q)
  };
}
function hubDisagreements() {
  const out = [];
  for (const m of hubMoments()) {
    if (new Set(m.says.values()).size < 2) continue;
    const d = hubMomentItem(m, `disagree:${m.flight}@${m.b.toFixed(1)}`, [...new Set(m.says.values())].join(' or ') + '?');
    if (d) out.push(d);
  }
  return out;
}
function hubTrickMoments(name) {
  const out = [];
  for (const m of hubMoments()) {
    const vals = [...m.says.values()];
    if (!vals.includes(name)) continue;
    const yes = vals.filter(v => v === name).length,
      st = yes === vals.length ? (m.says.size >= 3 ? 'confirmed' : 'waiting for more') : 'disputed';
    const d = hubMomentItem(m, `trick:${m.flight}@${m.b.toFixed(1)}`, `${name} · ${st}`);
    if (d) out.push(d);
  }
  for (const r of HUB.mine || []) {
    const ev = r.mine ? r.events || [] : hubFromLabels(r).events;
    for (const e of ev)
      if ((e.verdict === 'yes' && e.name === name) || (e.verdict === 'no' && e.actual === name))
        out.push({
          key: `trick:mine:${r.run || r.id}@${e.t.toFixed(1)}`,
          title: `${name} · your own run`,
          sub: `${hubMapT(r.map)} · ${hubAgo(r.at || Date.parse(r.started))}`,
          map: r.map,
          pilot: (pilotName() || '').toLowerCase(),
          tricks: [name],
          at: r.at,
          open: () => hubOpenMine(r, e.t)
        });
  }
  return out;
}

// ---- filters (the same bar on every list)
function hubFilter(items) {
  const f = HUB.f,
    q = f.q.trim().toLowerCase(),
    now = Date.now(),
    days = { today: 1, '3d': 3, '7d': 7 }[f.date];
  return items.filter(
    it =>
      (!f.map || it.map === f.map) &&
      (!f.pilot || it.pilot === f.pilot) &&
      (!f.trick || (it.tricks || []).includes(f.trick)) &&
      (!days || !it.at || now - it.at < days * 86400000) &&
      (!f.state ||
        (f.state === 'todo'
          ? !it.done
          : f.state === 'mine'
            ? !!it.done
            : f.state === 'disputed'
              ? !!it.disputed
              : f.state === 'more'
                ? it.people != null && it.people < 3
                : true)) &&
      (!q || `${it.title} ${it.sub} ${(it.tricks || []).join(' ')}`.toLowerCase().includes(q))
  );
}
const hubOpt = (v, cur, label) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label || v)}</option>`;
function hubFilterBar(items) {
  const f = HUB.f,
    maps = [...new Set(items.map(i => i.map).filter(Boolean))],
    pilots = [...new Set(items.map(i => i.pilot).filter(Boolean))].sort(),
    tricks = abcSort([...new Set(items.flatMap(i => i.tricks || []).filter(Boolean))]);
  return `<div class="hubFilters"><select data-hubf="map">${hubOpt('', f.map, 'Every map')}${maps.map(m => hubOpt(m, f.map, hubMapT(m))).join('')}</select>
    <select data-hubf="pilot">${hubOpt('', f.pilot, 'Every pilot')}${pilots.map(p => hubOpt(p, f.pilot)).join('')}</select>
    <select data-hubf="trick">${hubOpt('', f.trick, 'Every trick')}${tricks.map(t => hubOpt(t, f.trick)).join('')}</select>
    <select data-hubf="date">${hubOpt('', f.date, 'Any time')}${hubOpt('today', f.date, 'Today')}${hubOpt('3d', f.date, 'Last 3 days')}${hubOpt('7d', f.date, 'Last 7 days')}</select>
    <select data-hubf="state">${hubOpt('', f.state, 'Any state')}${hubOpt('todo', f.state, 'Not reviewed')}${hubOpt('mine', f.state, 'Reviewed by me')}${hubOpt('disputed', f.state, 'Disputed')}${hubOpt('more', f.state, 'Needs more confirmations')}</select>
    <input data-hubf="q" type="search" placeholder="Search pilots, tricks, maps" value="${esc(f.q)}">${Object.values(f).some(Boolean) ? '<button data-hub="clearf" class="ghost">clear</button>' : ''}</div>`;
}

// ---- loading what a section needs (each loader is the screen it replaces)
async function hubLoad(sec) {
  if (HUB.busy[sec]) return;
  HUB.busy[sec] = true;
  HUB.msg[sec] = '';
  try {
    if (sec === 'mine' || sec === 'trick') {
      await hubKeepRun();
      await hubLoadMine();
    }
    if (sec === 'board' && (!LB.runs || LB.day !== lbToday())) {
      await lbLoad(lbToday());
      if (!LB.runs) HUB.msg.board = LB.msg || 'The board could not be reached.';
    }
    if (sec === 'queue' || (['flights', 'disagree', 'trick', 'viewer'].includes(sec) && hubOwner())) {
      if (!deskVia())
        HUB.msg[sec] = hubOwner()
          ? 'Save your owner key in Options → Owner.'
          : anonOn() || !pilotName()
            ? 'The review queue needs a pilot name (Options).'
            : desk.noGuest
              ? "The review queue opens for everyone once the game's relay is updated. Check back soon."
              : 'The review queue could not be reached just now.';
      else if (!desk.list && !desk.busy) await deskLoad();
      else if (desk.list) {
        await deskDetails();
        await deskLabels();
      }
      if (desk.msg) HUB.msg[sec] = desk.msg;
    }
    if (sec === 'viewer' && hubOwner() && desk.list) await deskDetails(120); // FLIGHT VIEWER: every listed flight, not only the first 60
    if (sec === 'community' && hubOwner() && !JG.byMap[MAP_ID]) await judgeLoad(MAP_ID);
    if (sec === 'feedback' && hubOwner() && !desk.fb && deskVia()) await deskFeedback();
  } catch {
    HUB.msg[sec] = 'Could not load this just now.';
  }
  HUB.busy[sec] = false;
  if (!$('#hubScreen').classList.contains('hide')) hubRender();
}

// ---- the screen
function hubOpen(sec) {
  if (sec && hubSecs().some(s => s.id === sec)) HUB.sec = sec;
  if (!hubSecs().some(s => s.id === HUB.sec)) HUB.sec = 'mine';
  HUB.nav = null;
  mode = 'menu';
  show('#hubScreen');
  hubRender();
  hubLoad(HUB.sec);
  if (deskVia() && !desk.list && HUB.sec !== 'queue') hubLoad('queue'); // the queue's count shows in the side bar
  if (!LB.runs && HUB.sec !== 'board') hubLoad('board');
}
function hubCount(id) {
  if (id === 'bot' || id === 'feedback' || id === 'trick' || id === 'viewer') return id === 'feedback' && desk.fb ? desk.fb.length : null;
  if ((id === 'queue' || id === 'flights' || id === 'disagree') && !desk.list) return null;
  if (id === 'mine' && !HUB.mine) return null;
  if (id === 'board' && !LB.runs) return null;
  if (id === 'community' && !Object.keys(JG.byMap).length) return null;
  return hubItems(id).filter(i => !i.done).length;
}
function hubRender() {
  const el = $('#hubPanel');
  if (!el) return;
  const S0 = hubSecs(),
    sec = S0.find(s => s.id === HUB.sec) || S0[0],
    q = hubToday();
  const all = hubItems(sec.id),
    items = hubFilter(all),
    pend = HUB.pending[HUB.pending.length - 1],
    owner = hubOwner();
  HUB.view = items;
  const side = S0.map((s, k) => {
    const n = hubCount(s.id);
    return `${k && S0[k - 1].who !== s.who ? '<div class="hubKey">with the owner key</div>' : ''}<button data-hubsec="${s.id}" class="${s.id === sec.id ? 'on' : ''}">${esc(s.name)}${n ? ` <b>${n}</b>` : ''}</button>`;
  }).join('');
  let body = '';
  if (sec.id === 'bot')
    body = `<p class="note">${needPlaygroundQuiet() ? 'Judge the Bot runs on the playground: switch map in Maps first.' : 'Opens Judge the Bot: the bot flies a trick, you say whether it was that trick.'}</p><div class="row"><button data-hub="bot" class="primary" ${needPlaygroundQuiet() ? 'disabled' : ''}>▶ Judge the Bot</button></div>`;
  else if (sec.id === 'feedback')
    body = desk.fb
      ? desk.fb.length
        ? desk.fb
            .map(
              x =>
                `<div class="hubFb"><small>${esc(new Date(x.at).toLocaleString())}${x.f.name ? ' · ' + esc(String(x.f.name).slice(0, 40)) : ''}</small><p>${esc(String(x.f.text).slice(0, 2000))}</p></div>`
            )
            .join('')
        : '<p class="note">No feedback in the last 7 days.</p>'
      : `<p class="note">${esc(desk.fbMsg || (HUB.busy.feedback ? 'Loading…' : 'Save your owner key in Options → Owner.'))}</p>`;
  else {
    const trickPick =
      sec.id === 'trick'
        ? `<div class="row"><select data-hubtrick><option value="">Pick a trick…</option>${abcSort(ALL_TRICKS().map(t => nameOf(t)))
            .map(n => hubOpt(n, HUB.trick))
            .join(
              ''
            )}</select>${HUB.trick ? `<button data-hub="botfly" class="ghost" title="The bot flies it from the trick library (the playground)">▶ the bot flies it</button>` : ''}</div>`
        : '';
    const rows = items
      .map(
        (it, k) =>
          `<div class="hubRow ${it.done ? 'done' : ''}" data-hubopen="${k}"><div><b>${it.badge ? badgeHtml(it.badge) : ''}${esc(it.title)}</b><small>${esc(it.sub)}</small></div><span>${HUB.pending.some(p => p.key === it.key) ? '⏳ sending' : it.done ? '✓' : it.people != null && it.people < 3 && it.people > 0 ? `${it.people}/3` : ''}${it.map && it.map !== MAP_ID ? ' <i title="flown on another map: opening it switches map">⇄</i>' : ''} ▶</span></div>`
      )
      .join('');
    body =
      trickPick +
      (all.length ? hubFilterBar(all) : '') +
      `<div class="hubList" id="hubList">${rows || `<p class="note">${esc(HUB.msg[sec.id] || (HUB.busy[sec.id] ? 'Loading…' : all.length ? 'Nothing matches the filters.' : sec.id === 'trick' && !HUB.trick ? 'Pick a trick above.' : sec.id === 'quick' ? 'Nothing to check in your last run.' : sec.id === 'mine' ? 'No runs yet: fly one (10 s or more) and it shows up here.' : sec.id === 'queue' ? 'All caught up: no moments waiting for a second opinion in the last few days of shared flights. Check back after more pilots have flown.' : 'Nothing here right now.'))}</p>`}</div>`;
  }
  el.innerHTML = `<div class="hubTop"><h2>Review Hub</h2><span class="note hubMe">${pilotName() ? badgeLine(pilotName()) + ' · ' : ''}You judged <b>${q.n}</b> today</span>${pend ? `<button data-hub="undo" class="ghost" title="Take back your verdicts on ${esc(pend.title)} before they are sent">↶ Undo ${esc(pend.title.slice(0, 30))} (${Math.max(0, Math.ceil((pend.due - Date.now()) / 1000))} s)</button>` : ''}<button data-hub="close">Back</button></div>
    <div class="hubCols"><div class="hubSide">${side}</div><div class="hubMain"><p class="note">${esc(sec.hint)}</p>${body}
    <p class="note hubKeys">In the player: <kbd>Y</kbd> it was that trick · <kbd>N</kbd> not a trick · <kbd>Shift</kbd>+<kbd>→</kbd> next · <kbd>Shift</kbd>+<kbd>←</kbd> previous · <kbd>Esc</kbd> back here${owner ? '' : ''}</p></div></div>`;
  const L = $('#hubList');
  if (L) {
    L.scrollTop = HUB.scroll[sec.id] || 0;
    L.onscroll = () => {
      HUB.scroll[sec.id] = L.scrollTop;
    };
  }
}
const needPlaygroundQuiet = () => MAP_ID !== 'playground';

// ---- opening items, and the player's ◂ Previous / Next ▸
function hubReloadTo(map, sec, key) {
  const q =
    map !== MAP_ID
      ? `This was flown on ${hubMapT(map)}. Opening it will change your map to ${hubMapT(map)}. Is that okay?`
      : 'This uses the official map, so the community or own map you are on is switched off until the next reload. Is that okay?';
  if (!confirm(q)) return;
  store.set('hubPending', { sec, key });
  if (map !== MAP_ID) store.set('map', map);
  else store.set('layoutOffOnce', true);
  procFlight(telCapture('map'), () => {
    $('#loading').textContent = 'Loading ' + hubMapT(map) + '…';
    show('#loading');
    setTimeout(() => location.reload(), 300);
  });
}
async function hubOpenItem(list, k) {
  const it = list[k];
  if (!it) {
    hubOpen();
    return;
  }
  const guestSec =
    ['board', 'queue', 'flights', 'community', 'disagree', 'trick', 'viewer'].includes(HUB.sec) &&
    !String(it.key).startsWith('trick:mine:');
  if (it.map && S.MAPS[it.map] && (it.map !== MAP_ID || (guestSec && MAP_EDITS))) {
    hubReloadTo(it.map, HUB.sec, it.key);
    return;
  }
  HUB.nav = { list, k, key: it.key, title: it.title, open: true };
  if (HUB.sec === 'viewer') {
    FV.list = list;
    FV.idx = k;
  }
  try {
    await it.open();
  } catch {
    HUB.nav = null;
    flash('<b>THAT COULD NOT BE OPENED</b>', 'near');
    hubOpen();
    return;
  }
  if (mode !== 'recap') {
    HUB.nav = null;
    return;
  } // the item opened its own screen (or nothing): no player to step through
  hubNavRender();
}
function hubStep(d) {
  const N = HUB.nav;
  if (!N) return;
  N.next = N.k + d;
  if (N.next < 0) {
    N.next = null;
    return;
  }
  closeRecap();
}
// closeRecap hands over here when the player was opened from the hub: count it, then the next item or the list
function hubBack(judged) {
  const N = HUB.nav;
  if (!N || !N.open) return false;
  N.open = false;
  $('#hubNav').classList.add('hide');
  if (judged) {
    HUB.done[N.key] = Date.now();
    const ks = Object.keys(HUB.done);
    if (ks.length > 3000) for (const k of ks.sort((a, b) => HUB.done[a] - HUB.done[b]).slice(0, ks.length - 3000)) delete HUB.done[k];
    store.set('hubDone', HUB.done);
    const q = hubToday();
    q.n++;
    store.set('hubDay', q);
  }
  const next = N.next;
  HUB.nav = null;
  mode = 'menu';
  if (next != null && next < N.list.length) {
    show('#hubScreen');
    hubRender();
    setTimeout(() => hubOpenItem(N.list, next), 60);
    return true;
  }
  show('#hubScreen');
  hubRender();
  return true;
}
function hubNavRender() {
  const N = HUB.nav,
    el = $('#hubNav');
  if (!el) return;
  if (!N || !N.open || mode !== 'recap') {
    el.classList.add('hide');
    return;
  }
  el.classList.remove('hide');
  el.innerHTML = `<button data-hubnav="prev" ${N.k > 0 ? '' : 'disabled'}>◂ Previous</button><span><b>${N.k + 1} / ${N.list.length}</b> ${esc(N.title.slice(0, 50))}</span><button data-hubnav="next" class="primary" ${N.k + 1 < N.list.length ? '' : 'disabled'}>Next ▸</button><button data-hubnav="hub" class="ghost">☰ Hub</button>`;
}
async function hubOpenMine(r, at) {
  if (r.map !== MAP_ID) {
    hubReloadTo(r.map, 'mine', 'mine:' + (r.mine ? r.run : String(r.id).replace(/^review-/, '')));
    return;
  }
  await hubKeepRun(); // the run in hand is kept first
  let rows;
  try {
    rows = r.packed ? await FlightLog.unpack(r.packed) : r.trace;
  } catch {
    rows = null;
  }
  if (!Array.isArray(rows) || rows.length < TRACE_HZ) throw new Error('trace');
  const back = r.mine ? { events: r.events || [], flags: r.flags || [] } : hubFromLabels(r);
  recapReset();
  recap.id = r.mine ? r.run : String(r.id).replace(/^review-/, '');
  recap.started = r.started;
  recap.trace = rows;
  recap.events = back.events;
  recap.flags = back.flags;
  for (const e of [...(recap.events || []), ...(recap.flags || [])])
    for (const k of ['name', 'actual', 'target']) if (e && typeof e[k] === 'string') e[k] = S.canonTrick(e[k]);
  /* runs kept before the names followed the site */ recap.telDone = recap.id;
  recap.mode = 'free';
  openRecap('hub');
  if (at != null) {
    const x = recapItems().find(x => Math.abs(x.t - at) < 0.05);
    if (x) recapPlay(x);
    renderRecap();
  }
}
async function hubOpenBoard(e) {
  const r = await fetch(`${lbBase()}/run?day=${LB.day || lbToday()}&id=${encodeURIComponent(e.id)}`);
  if (!r.ok) throw new Error('run');
  const run = await r.json();
  if (!run || typeof run.name !== 'string' || !run.trace || run.map !== MAP_ID) throw new Error('run');
  guestOpen(
    await FlightLog.unpack(run.trace),
    run.events,
    { name: run.name, flight: run.flight || e.id, source: 'board', ref: e.id, clip: 'board:' + e.id },
    true
  );
}
// a verdict on someone else's run waits HUB_UNDO_S before it is sent (recapSave → here instead of reviewerSave)
function hubDefer() {
  const pkg = reviewerBuild();
  if (!pkg) return;
  const N = HUB.nav || {},
    key = N.key || 'x',
    title = N.title || 'this run';
  const p = { key, title, pkg, due: Date.now() + HUB_UNDO_S * 1000 };
  p.timer = setTimeout(async () => {
    HUB.pending = HUB.pending.filter(x => x !== p);
    const st = await reviewerSend(pkg, true);
    HUB.log.unshift({ key, title, st, at: Date.now() });
    HUB.log = HUB.log.slice(0, 10);
    if (!$('#hubScreen').classList.contains('hide')) hubRender();
  }, HUB_UNDO_S * 1000);
  HUB.pending.push(p);
  clearInterval(HUB.tick);
  HUB.tick = setInterval(() => {
    if (!HUB.pending.length) {
      clearInterval(HUB.tick);
      return;
    }
    if (!$('#hubScreen').classList.contains('hide')) {
      const b = document.querySelector('[data-hub="undo"]'),
        q = HUB.pending[HUB.pending.length - 1];
      if (b && q) b.textContent = `↶ Undo ${q.title.slice(0, 30)} (${Math.max(0, Math.ceil((q.due - Date.now()) / 1000))} s)`;
    }
  }, 500);
}
function hubUndo() {
  const p = HUB.pending.pop();
  if (!p) return;
  clearTimeout(p.timer);
  delete HUB.done[p.key];
  store.set('hubDone', HUB.done);
  const q = hubToday();
  q.n = Math.max(0, q.n - 1);
  store.set('hubDay', q);
  if (String(p.key).startsWith('queue:')) {
    const dq = store.get('deskQDone', {});
    delete dq[p.key.slice(6)];
    store.set('deskQDone', dq);
  }
  if (String(p.key).startsWith('community:')) {
    delete JG.done[p.key.slice(10)];
    store.set('judgeDone', JG.done);
  }
  flash(`<b>TAKEN BACK</b><small>nothing was sent for ${esc(p.title)}</small>`, 'near');
  hubRender();
}

// ---- the main menu's button: a dot when the hub has something new for you
function hubBadge() {
  const b = $('#hubBtn');
  if (!b) return;
  const own = !recap.guest && recap.events.some(e => !e.hidden && !hubDecided(e)),
    board = (LB.runs || []).filter(
      e => e.id && !HUB.done['board:' + e.id] && String(e.name).toLowerCase() !== (pilotName() || '').toLowerCase()
    ).length;
  b.classList.toggle('dot', own || board > (store.get('hubSeenBoard', 0) || 0));
}

document.addEventListener('click', e => {
  const act = e.target.closest('[data-act="hub"]');
  if (act) {
    store.set('hubSeenBoard', (LB.runs || []).length);
    hubOpen();
    return;
  }
  const nav = e.target.closest('[data-hubnav]');
  if (nav) {
    const a = nav.dataset.hubnav;
    if (a === 'prev') hubStep(-1);
    if (a === 'next') hubStep(1);
    if (a === 'hub') {
      if (HUB.nav) HUB.nav.next = null;
      closeRecap();
    }
    return;
  }
  if ($('#hubScreen').classList.contains('hide')) return;
  const s = e.target.closest('[data-hubsec]');
  if (s) {
    HUB.sec = s.dataset.hubsec;
    hubSave();
    hubRender();
    hubLoad(HUB.sec);
    return;
  }
  const o = e.target.closest('[data-hubopen]');
  if (o) {
    hubOpenItem(HUB.view || [], +o.dataset.hubopen);
    return;
  }
  const b = e.target.closest('[data-hub]');
  if (!b) return;
  const a = b.dataset.hub;
  if (a === 'close') {
    mode = 'menu';
    show('#mainMenu');
  }
  if (a === 'clearf') {
    HUB.f = { map: '', pilot: '', trick: '', date: '', state: '', q: '' };
    hubSave();
    hubRender();
  }
  if (a === 'undo') hubUndo();
  if (a === 'bot' && !needPlayground('Judge the Bot')) startJudge();
  if (a === 'botfly' && HUB.trick && !needPlayground('Judge the Bot')) startJudge(HUB.trick);
});
document.addEventListener('change', e => {
  if ($('#hubScreen').classList.contains('hide')) return;
  const f = e.target.dataset && e.target.dataset.hubf;
  if (f && f !== 'q') {
    HUB.f[f] = e.target.value;
    hubSave();
    hubRender();
  }
  if (e.target.hasAttribute && e.target.hasAttribute('data-hubtrick')) {
    HUB.trick = e.target.value;
    hubSave();
    hubRender();
    hubLoad('trick');
  }
});
document.addEventListener('input', e => {
  if (e.target.dataset && e.target.dataset.hubf === 'q') {
    HUB.f.q = e.target.value;
    hubSave();
    const pos = e.target.selectionStart;
    hubRender();
    const i = document.querySelector('[data-hubf="q"]');
    if (i) {
      i.focus();
      i.setSelectionRange(pos, pos);
    }
  }
});
// in the player: Shift+→ / Shift+← step through the list, Y / N answer the call that is playing (capture: before the player's own keys)
addEventListener(
  'keydown',
  e => {
    if (
      !$('#hubScreen').classList.contains('hide') &&
      e.code === 'Escape' &&
      !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))
    ) {
      mode = 'menu';
      show('#mainMenu');
      return;
    }
    if (mode !== 'recap' || !HUB.nav || !HUB.nav.open || recap.quick || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))
      return;
    if (e.shiftKey && (e.code === 'ArrowRight' || e.code === 'ArrowLeft')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      hubStep(e.code === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (e.code === 'KeyY' || e.code === 'KeyN') {
      const k = recap.play && recap.play.key,
        it = recapItems().find(x => x.kind === 'call' && 'call' + x.i === k) || recapItems().find(x => x.kind === 'call' && !x.e.verdict);
      if (!it) return;
      e.preventDefault();
      recapSetCall(it.i, e.code === 'KeyY' ? it.e.name : 'not a trick');
      renderRecap();
    }
  },
  true
);
setTimeout(async () => {
  const P = store.get('hubPending', null);
  if (!P) return;
  store.set('hubPending', null);
  if (!hubSecs().some(s => s.id === P.sec)) return;
  hubOpen(P.sec);
  await hubLoad(P.sec);
  if (P.sec === 'queue' || P.sec === 'flights' || P.sec === 'disagree' || P.sec === 'viewer')
    await deskDetails(P.sec === 'viewer' ? 120 : 60);
  const L = hubFilter(hubItems(P.sec)),
    k = L.findIndex(it => it.key === P.key);
  if (k >= 0) hubOpenItem(L, k);
}, 1700);
window.__pw = window.__pw || {};
window.__pw.hub = {
  state: HUB,
  items: s => hubItems(s),
  open: s => hubOpen(s),
  openItem: (s, k) => {
    HUB.sec = s;
    const L = hubFilter(hubItems(s));
    return hubOpenItem(L, k);
  },
  keep: () => hubKeepRun(),
  load: s => hubLoad(s),
  mine: () => hubLoadMine()
};

// ============================================================ Review badges (owner, 2026-11-20): pixel Skittles by reviews
// One review per decided moment a pilot sends (own runs count too; "it all adds up"). The relay counts them as they arrive
// (GET /badges: { since, n: { name: [display, count] } }); what was sent before it started counting ships in the build
// (community/badges.json → window.PW_BADGES, tools/badges.js), and only the part before `since` is added. Names, not ids.
var BADGE_TIERS = [
  [25, 'Red Skittle', 'red'],
  [50, 'Orange Skittle', 'orange'],
  [100, 'Yellow Skittle', 'yellow'],
  [250, 'Green Skittle', 'green'],
  [500, 'Purple Skittle', 'purple'],
  [1000, 'Taste the Rainbow', 'rainbow']
];
var BADGE = { live: store.get('badgesLive', null), uri: {} }; // var, not const: names are drawn from earlier files at start-up
function badgeCount(name) {
  if (!BADGE) return 0;
  const k = String(name || '')
    .trim()
    .toLowerCase();
  if (!k) return 0;
  const L = BADGE.live,
    since = L && L.since ? L.since : Infinity,
    B = (window.PW_BADGES && window.PW_BADGES.n) || {};
  const old = (B[k] ? B[k][1] : []).filter(x => x[0] < since).reduce((s, x) => s + x[1], 0),
    now = L && L.n && L.n[k] ? +L.n[k][1] || 0 : 0;
  return old + now;
}
const badgeTier = n => {
  let t = -1;
  BADGE_TIERS.forEach(([m], i) => {
    if (n >= m) t = i;
  });
  return t;
};
function badgeUri(i) {
  if (BADGE.uri[i]) return BADGE.uri[i];
  const rows = [
    '.....OOOOOO.....',
    '...OOMMMMMMOO...',
    '..OMMLLMMMMMMO..',
    '.OMLLMMMMMMMMMO.',
    '.OMLMMMMMMMMMMO.',
    'OMMMMMMMMMMMMMMO',
    'OMMMMMMMMMMMMMMO',
    'OMMMMMMMMMMMMMMO',
    '.ODMMMMMMMMMMDO.',
    '.ODDMMMMMMMMDDO.',
    '..ODDDDDDDDDDO..',
    '...OODDDDDDOO...',
    '.....OOOOOO.....'
  ];
  const C = {
      red: ['#e8202a', '#a3101a', '#ff7a80'],
      orange: ['#ff7a12', '#b84e06', '#ffb070'],
      yellow: ['#ffd21f', '#c79a00', '#fff0a0'],
      green: ['#2fbf3a', '#17821f', '#8ff09a'],
      purple: ['#7a2bb8', '#4e167e', '#c89af0']
    },
    band = ['red', 'orange', 'yellow', 'green', 'purple'],
    c = BADGE_TIERS[i][2];
  let r = '';
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const p = C[c === 'rainbow' ? band[Math.min(4, Math.floor((x - 1) / 2.8))] : c];
      r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${ch === 'O' ? '#1a1014' : ch === 'M' ? p[0] : ch === 'D' ? p[1] : p[2]}"/>`;
    })
  );
  for (const [x, y] of [
    [7, 3],
    [8, 3],
    [9, 3],
    [6, 4],
    [7, 5],
    [8, 5],
    [9, 6],
    [6, 7],
    [7, 7],
    [8, 7]
  ])
    r += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="#fff"/>`;
  return (BADGE.uri[i] =
    'data:image/svg+xml,' +
    encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 13" shape-rendering="crispEdges">${r}</svg>`));
}
// the badge next to a name ('' below 25 reviews); big = the larger one for the pilot's own line
function badgeHtml(name, big) {
  if (!BADGE_TIERS) return '';
  const n = badgeCount(name),
    t = badgeTier(n);
  if (t < 0) return '';
  return `<img class="pwBadge${big ? ' big' : ''}${t === 5 ? ' rainbow' : ''}" src="${badgeUri(t)}" alt="${esc(BADGE_TIERS[t][1])}" title="${esc(BADGE_TIERS[t][1])} · ${n} review${n === 1 ? '' : 's'}">`;
}
function badgeLine(name) {
  if (!BADGE_TIERS) return '';
  const n = badgeCount(name),
    t = badgeTier(n),
    next = BADGE_TIERS[t + 1];
  return `${badgeHtml(name, true)}<span class="pwBadgeTxt">${t >= 0 ? esc(BADGE_TIERS[t][1]) + ' · ' : ''}${n} review${n === 1 ? '' : 's'}${next ? ` · ${next[0] - n} to the ${esc(next[1])}` : ''}</span>`;
}
async function badgesLoad() {
  if (!lbBase()) return;
  try {
    const r = await fetch(`${lbBase()}/badges`);
    if (!r.ok) return;
    const j = await r.json();
    if (!j || typeof j !== 'object' || !j.n || typeof j.n !== 'object') return;
    BADGE.live = { since: Number.isFinite(+j.since) ? +j.since : null, n: j.n };
    store.set('badgesLive', BADGE.live);
  } catch {
    return;
  }
  const me = pilotName(),
    t = badgeTier(badgeCount(me)),
    was = store.get('badgeTier', null);
  if (me && was != null && t > was)
    flash(
      `<b>YOU EARNED THE ${esc(BADGE_TIERS[t][1].toUpperCase())}</b><small>${badgeCount(me)} reviews: thanks for helping the game learn</small>`
    );
  if (me) store.set('badgeTier', t);
  badgesShow();
}
function badgesShow() {
  try {
    pilotShowName();
  } catch {
    /* not ready */
  }
  if (!$('#lbScreen').classList.contains('hide')) lbRender();
  if (!$('#hubScreen').classList.contains('hide')) hubRender();
}
setTimeout(badgesLoad, 2500);
setInterval(() => {
  if (mode === 'menu') badgesLoad();
}, 300000);
window.__pw.badges = {
  count: n => badgeCount(n),
  tier: n => badgeTier(n),
  html: n => badgeHtml(n),
  load: () => badgesLoad(),
  state: BADGE
};
