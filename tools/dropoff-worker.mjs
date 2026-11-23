// Telemetry drop-off relay (Cloudflare Worker; the free plan is enough). Players need no account: with their consent the
// game POSTs flights, review answers and feedback here, and this files them in a GitHub repo using a token that only
// this Worker holds (a Worker secret: never in the game, the repo or the page). Setup: docs/DROPOFF-SETUP.md.
//
// What it will and won't do, so it can't be turned into something else:
//   - accepts POST only, only from the game's own web address (ALLOW_ORIGINS), only JSON, at most 1 MB;
//   - accepts only the game's three upload formats, checks their shape, and stores only the fields it knows;
//   - names every file itself under telemetry/inbox/<kind>/<day>/ and only ever CREATES files (never edits or reads);
//   - refuses anything that looks like an access token;
//   - limits each address to PER_IP_HOUR uploads an hour and everyone together to DAILY_CAP a day;
//   - answers uploads with a bare ok / error, never with anything from the repo;
//   - official map layouts: POST /official with the owner key (secret OWNER_KEY) writes maps/official/<map>.json to
//     GAME_REPO (the game repo; GitHub Pages rebuilds). Nobody else can publish: see official() below.
//   - community maps: a pilot's own map they choose to share (kind 'map', pro-whooper-map/1: name, pilot name, the
//     official map it is built on, and its layer) is filed as maps/community/<base>/<time>.<pilot>.<name>.<by>.json. GET
//     /maps?base= lists them (file names only), GET /map?base=&id= returns one, checked again on the way out.
//   - daily leaderboard: a 2:00 Session score a player chooses to post is filed as leaderboard/<day>/<score>-<map>-
//     <name>-<pilot>-<time>.json (everything the board needs is in the file NAME). GET /board lists that one folder's
//     file names, and turns them into the day's best score per pilot: no file is ever opened, nothing else in the repo
//     can be listed, the answer is cached for 30 s, and only TODAY's board can be asked for (no history). GET /run?day=&id= returns ONE posted run (its scoring sheet and
//     replay, which the player chose to publish): the id must be a leaderboard file name, so nothing outside
//     leaderboard/ can ever be read, and the file is passed through the same field check again on the way out.
//     Scores are whatever the game reported (see docs/DATA.md);
//   - RaceGOW: a track a pilot shares (kind 'track') is filed as tracks/<time>.<pilot>.<name>.<by>.json, GET /tracks lists
//     them (file names only), GET /track?id= returns one checked again; a best lap (kind 'racetime', with its ghost) as
//     racetimes/<track hash>/<lap ms>-<name>-<pilot>-<time>.json, GET /raceboard?track= is each pilot's best from the
//     file names, GET /ghost?track=&id= returns one lap. Nothing outside tracks/ and racetimes/ can be read that way;
//   - the owner's desk: POST /desk with the owner key reads (never writes) shared flights, review labels and feedback
//     under telemetry/inbox/{flight,labels,feedback}/ and posted runs of any day under leaderboard/, so the owner's
//     Flight desk, feedback inbox and Judge the community need no GitHub token in the browser. Paths are checked against
//     fixed patterns, every file goes through clean() again, nothing is cached; wrong keys are slowed like /official's.
//   - trick challenges: a new trick a pilot named and posts (kind 'challenge', its signature and clip) under challenges/, tries
//     other pilots' games matched to one (kind 'chtry') under challenge-tries/, the owner's hide / rename / points (POST /chmod,
//     owner key) under challenge-mod/; GET /challenges is the board made from the three folders' file names, GET /challenge?id=
//     one challenge. Names go through the same word list as the game (badName).
//   - ENABLED = "0" switches it off without deleting anything.
// Variables: GITHUB_TOKEN (secret), GITHUB_REPO "owner/repo", optional GITHUB_BRANCH, ALLOW_ORIGINS (comma separated,
// default https://heyheykoolaid.github.io), PER_IP_HOUR (30), DAILY_CAP (800), ENABLED. Optional KV binding LIMITS makes
// the daily cap exact across Cloudflare's machines (one small write per upload); without it, and for the per-address
// limit, counts are kept in memory on each machine (best effort).
const FORMATS = { challenge: 'pro-whooper-challenge/1', chtry: 'pro-whooper-challenge-try/1', flight: 'pro-whooper-flight/1', labels: 'pro-whooper-flight-labels/1', feedback: 'pro-whooper-feedback/1', score: 'pro-whooper-score/1', video: 'pro-whooper-video/1', map: 'pro-whooper-map/1', track: 'pro-whooper-track/2', racetime: 'pro-whooper-racetime/1' };
const MAX_BYTES = 1000000;
const KEYS = {
  flight: ['format', 'build', 'id', 'started', 'ended', 'pilot', 'name', 'map', 'mode', 'camTilt', 'craft', 'tune', 'profile', 'input', 'score', 'events', 'missed', 'summary', 'trace'],
  labels: ['format', 'build', 'flight', 'started', 'pilot', 'name', 'labels'],
  feedback: ['format', 'at', 'build', 'category', 'text', 'name', 'context'],
  video: ['format', 'build', 'duration', 'video', 'analysis', 'frames', 'marks', 'detected', 'labels', 'name', 'pilot', 'profile'],   // measured camera motion + marks + labels (never the video or its file name)
  map: ['format', 'build', 'name', 'by', 'pilot', 'base', 'at', 'moved', 'removed', 'added'],   // a pilot's own map, shared by their click: a layer over an official map
  score: ['format', 'build', 'name', 'pilot', 'score', 'map', 'mode', 'flight', 'totals', 'sheet', 'events', 'camTilt', 'camFov', 'craft', 'trace'],
  track: ['format', 'id', 'name', 'by', 'pilot', 'build', 'tags', 'preset', 'section', 'venue', 'lighting', 'laps', 'route', 'elements', 'created', 'updated'],   // a RaceGOW track a pilot shares (the game cleans it again: RG.cleanTrack)
  racetime: ['format', 'build', 'name', 'pilot', 'track', 'trackName', 'lap', 'ghost', 'craft'],
  challenge: ['format', 'build', 'name', 'by', 'pilot', 'map', 'at', 'like', 'sig', 't0', 't1', 'camTilt', 'trace'],   // a new trick a pilot named and posts (src/challenge.js): its signature and the clip
  chtry: ['format', 'build', 'challenge', 'by', 'pilot', 'map', 'at', 'dist', 'sig', 't0', 't1', 'camTilt', 'trace'],   // another pilot's move the game matched to it   // a best lap on a track (by its geometry hash) and its ghost
};
const str = (v, max) => typeof v === 'string' && v.length <= max;
const optStr = (v, max) => v == null || str(v, max);
// nothing deep, huge or odd anywhere in the upload (the packed trace is checked on its own)
function sane(v, depth = 0, budget = { n: 0 }) {
  if (++budget.n > 150000 || depth > 8) return false;
  if (v == null || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.length <= 5000;
  if (Array.isArray(v)) return v.length <= 6000 && v.every(x => sane(x, depth + 1, budget));
  if (typeof v === 'object') return Object.keys(v).length <= 200 && Object.entries(v).every(([k, x]) => k.length <= 60 && sane(x, depth + 1, budget));
  return false;
}
const okTrace = t => !!t && typeof t === 'object' && str(t.enc, 40) && t.enc.startsWith('cols-delta-varint/1') && t.hz >= 10 && t.hz <= 1000 && Number.isInteger(t.rows) && t.rows >= 1 && t.rows <= 60000
  && Array.isArray(t.cols) && t.cols.length <= 40 && t.cols.every(c => str(c, 20)) && str(t.data, 900000) && /^[A-Za-z0-9+/]*={0,2}$/.test(t.data);
// ---- names other pilots will see: the same word list as src/sim.js `badName` (test/challenges.js holds the two copies to the same
// answers). Trick challenge names and the names of the pilots posting them are refused when it says so.
const BAD_SUB = ['fuck', 'fuk', 'fvck', 'pusy', 'shit', 'cunt', 'niger', 'niga', 'fagot', 'bitch', 'whore', 'slut', 'penis', 'vagina', 'dick', 'puss', 'retard', 'nazi', 'hitler', 'jiz', 'boob', 'wank', 'twat', 'bastard', 'molest', 'incest', 'milf', 'dildo', 'hentai', 'porn', 'cumshot', 'blowjob', 'handjob', 'motherf', 'asshol', 'arsehol', 'killyourself', 'pedophil', 'paedophil', 'tranie', 'beaner', 'wetback', 'raghead', 'towelhead', 'chingchong', 'golliwog', 'jigaboo', 'kike', 'shemale', 'skank', 'clit', 'scrotum', 'testicl', 'orgasm', 'ejacul', 'horny', 'sperm', 'faggot', 'dyke', 'spunk', 'bollock', 'tosser', 'bellend'];
const BAD_WORD = ['ass', 'arse', 'cum', 'cock', 'cocks', 'tit', 'tits', 'titty', 'anal', 'anus', 'rape', 'raped', 'raping', 'rapist', 'sex', 'sexy', 'fap', 'fag', 'fags', 'fck', 'kys', 'coon', 'spic', 'chink', 'gook', 'negro', 'heil', 'kkk', 'pedo', 'paedo', 'prick', 'tranny', 'homo', 'lesbo', 'hoe', 'hoes', 'piss', 'jerkoff', 'wtf', 'stfu', 'gfy', 'nig', 'jap', 'dago', 'wop', 'gyp', 'isis', 'sieg', 'zieg', 'lynch', 'boner', 'bj', 'hj', 'xxx', 'tard', 'thot', 'incel', 'poon', 'muff', 'nonce', 'nude', 'naked', 'semen', 'pubic', 'erection'];
const L33T = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '6': 'g', '2': 'z', '(': 'c', '¢': 'c', '€': 'e', '£': 'l' };
const BAD_SUB_SQ = BAD_SUB.filter(w => !/(.)\1/.test(w)), BAD_WORD_SET = new Set(BAD_WORD);   // a pattern with a double letter is only matched unsquashed (puss / push, boob / bob)
function badName(v) {
  const low = String(v == null ? '' : v).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[0-9!|@$+(¢€£]/g, c => L33T[c] || c);
  const raw = low.split(/[^a-z]+/).filter(Boolean), words = [];   // spaced-out letters (f u c k, s.e.x) are joined into one word
  for (let i = 0; i < raw.length; i++) { if (raw[i].length === 1) { let j = i, w = ''; while (j < raw.length && raw[j].length === 1) w += raw[j++]; if (w.length > 1) { words.push(w); i = j - 1; continue; } } words.push(raw[i]); }
  for (const w0 of words) { const sq = w0.replace(/(.)\1+/g, '$1'), w = w0.replace(/(.)\1{2,}/g, '$1$1');   // inside one word only: "Push It" is not a swear
    if (BAD_SUB_SQ.some(b => sq.includes(b)) || BAD_SUB.some(b => w.includes(b))) return true;
    for (const x of [w0, w, sq, w.replace(/e?s$/, ''), w.replace(/s$/, '')]) if (x && BAD_WORD_SET.has(x)) return true; }
  return false;
}
const CH_ID_RE = /^(\d{10,16})\.([a-z0-9]{6,40})\.([A-Za-z0-9_-]{1,60})\.([A-Za-z0-9_-]{1,40})\.([a-z0-9-]{1,24})$/;
const chSigOk = g => { if (!g || typeof g !== 'object' || Array.isArray(g) || !Array.isArray(g.c) || g.c.length !== 72 || !g.c.every(v => Number.isFinite(v) && Math.abs(v) <= 5000) || !(+g.d > 0 && +g.d <= 12)) return null;
  if (g.u != null && (!Array.isArray(g.u) || g.u.length !== 24 || !g.u.every(v => Number.isFinite(v) && Math.abs(v) <= 100))) return null; if (g.ps != null && !(typeof g.ps === 'string' && /^[OUG]{0,8}$/.test(g.ps))) return null;
  const o = { d: +g.d, c: g.c.map(Math.round) }; if (g.u) o.u = g.u.map(Math.round); if (typeof g.ps === 'string') o.ps = g.ps; return o; };
function clean(kind, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.format !== FORMATS[kind]) return null;
  const out = {}; for (const k of KEYS[kind]) if (p[k] !== undefined) out[k] = p[k];
  if (!optStr(out.pilot, 40) || !optStr(out.name, 60) || !optStr(out.build, 20)) return null;
  if (kind === 'flight') {
    const t = out.trace; out.trace = undefined;
    if (!str(out.id, 40) || !str(out.started, 40) || !t || typeof t !== 'object') return null;
    if (!str(t.enc, 40) || !t.enc.startsWith('cols-delta-varint/1') || !(t.hz >= 10 && t.hz <= 1000) || !Number.isInteger(t.rows) || t.rows < 1 || t.rows > 60000) return null;
    if (!Array.isArray(t.cols) || t.cols.length > 40 || !t.cols.every(c => str(c, 20)) || !str(t.data, 900000) || !/^[A-Za-z0-9+/]*={0,2}$/.test(t.data)) return null;
    if (!Array.isArray(out.events) || out.events.length > 3000 || !sane(out)) return null;
    out.trace = { enc: t.enc, hz: t.hz, cols: t.cols, rows: t.rows, data: t.data };
  } else if (kind === 'score') {
    // a name the board can show as it is, a pilot id, a whole score in a believable range, the 2:00 Session only
    if (!str(out.name, 24) || !/^[A-Za-z0-9_. -]{2,24}$/.test(out.name) || !str(out.pilot, 40) || !/^[a-z0-9]{6,40}$/.test(out.pilot)) return null;
    if (!Number.isInteger(out.score) || out.score < 1 || out.score > 3000000 || out.mode !== 'session' || !str(out.map, 24) || !/^[a-z0-9-]{1,24}$/.test(out.map)) return null;
    // the scoring sheet (what the run was made of) and, if the player posts it, the packed replay of the run
    if (!optStr(out.flight, 40) || (out.sheet != null && (!Array.isArray(out.sheet) || out.sheet.length > 400)) || (out.events != null && (!Array.isArray(out.events) || out.events.length > 400))) return null;
    const t = out.trace; out.trace = undefined; if (!sane(out) || JSON.stringify(out).length > 60000) return null;
    if (t != null) { if (!okTrace(t) || t.rows > 20000) return null; out.trace = { enc: t.enc, hz: t.hz, cols: t.cols, rows: t.rows, data: t.data }; }
  } else if (kind === 'map') {
    // names the list can show as they are, a pilot id, which official map it is built on, and only the layer's own fields
    const nameOk = v => str(v, 40) && /^[A-Za-z0-9_.,'!&()+ -]{1,40}$/.test(v) && v.trim().length > 0;
    if (!nameOk(out.name) || !str(out.by, 24) || !/^[A-Za-z0-9_. -]{2,24}$/.test(out.by) || !str(out.pilot, 40) || !/^[a-z0-9]{6,40}$/.test(out.pilot) || !str(out.base, 24) || !/^[a-z0-9-]{1,24}$/.test(out.base)) return null;
    const L = cleanLayer(out); if (!L || !optStr(out.at, 40) || JSON.stringify(out).length > 400000) return null; Object.assign(out, L);
  } else if (kind === 'track') {
    // names a list can show as they are, a pilot id, and elements that are plain data: known shapes only, numbers and short words
    const nameOk = v => str(v, 40) && /^[A-Za-z0-9_.,'!&()+ -]{1,40}$/.test(v) && v.trim().length > 0, word = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(v);
    if (!nameOk(out.name) || !str(out.by, 24) || !/^[A-Za-z0-9_. -]{2,24}$/.test(out.by) || !str(out.pilot, 40) || !/^[a-z0-9]{6,40}$/.test(out.pilot) || !word(out.preset)) return null;
    const V = out.venue; if (!V || typeof V !== 'object' || !['room', 'map'].includes(V.kind) || !word(V.room || V.map)) return null;
    const E = out.elements; if (!Array.isArray(E) || E.length < 1 || E.length > 600) return null;
    for (const e of E) { if (!e || typeof e !== 'object' || !word(e.id) || !/^[A-Za-z]{2,24}$/.test(e.type) || !['x', 'y', 'z', 'ry', 'rx', 'rz', 's'].every(k => e[k] === undefined || (Number.isFinite(e[k]) && Math.abs(e[k]) <= 5000))) return null;
      if (e.p != null && (typeof e.p !== 'object' || Array.isArray(e.p) || Object.keys(e.p).length > 20 || !Object.entries(e.p).every(([k, v]) => /^[A-Za-z]{1,16}$/.test(k) && (Number.isFinite(v) || word(v))))) return null; }
    if (!Array.isArray(out.route) || out.route.length > 600 || !out.route.every(word) || (out.tags != null && (!Array.isArray(out.tags) || out.tags.length > 6 || !out.tags.every(word)))) return null;
    if (!sane(out) || JSON.stringify(out).length > 300000) return null;
  } else if (kind === 'racetime') {
    // a lap time in whole ms, a track hash, a pilot, and the lap's ghost (30 Hz, delta-coded integers)
    if (!str(out.name, 24) || !/^[A-Za-z0-9_. -]{2,24}$/.test(out.name) || !str(out.pilot, 40) || !/^[a-z0-9]{6,40}$/.test(out.pilot) || !str(out.track, 20) || !/^[a-z0-9]{6,20}$/.test(out.track)) return null;
    if (!Number.isInteger(out.lap) || out.lap < 500 || out.lap > 3600000 || !optStr(out.trackName, 40)) return null;
    const g = out.ghost; if (!g || typeof g !== 'object' || g.hz !== 30 || !Number.isInteger(g.n) || g.n < 1 || g.n > 54000 || !Array.isArray(g.d) || g.d.length !== g.n * 7 || !g.d.every(Number.isInteger)) return null;
    out.ghost = { hz: 30, n: g.n, d: g.d }; const gg = out.ghost; out.ghost = undefined; if (!sane(out)) return null; out.ghost = gg;
  } else if (kind === 'challenge' || kind === 'chtry') {
    // a trick challenge (a name nobody's word list objects to, the pilot, the map, the move's signature and its clip) or a try at one
    const byOk = v => str(v, 24) && /^[A-Za-z0-9_. -]{2,24}$/.test(v) && !badName(v), num = (v, lo, hi) => v == null || (Number.isFinite(v) && v >= lo && v <= hi);
    if (!byOk(out.by) || !str(out.pilot, 40) || !/^[a-z0-9]{6,40}$/.test(out.pilot) || !str(out.map, 24) || !/^[a-z0-9-]{1,24}$/.test(out.map) || !optStr(out.at, 40)) return null;
    if (kind === 'challenge') { if (!str(out.name, 40) || !/^[A-Za-z0-9_.,'!&()+ -]{2,40}$/.test(out.name) || !out.name.trim() || badName(out.name) || !optStr(out.like, 60)) return null; out.name = out.name.trim(); }
    else { if (!str(out.challenge, 160) || !CH_ID_RE.test(out.challenge) || !num(out.dist, 0, 1)) return null; }
    const g = chSigOk(out.sig); if (!g || !num(out.t0, -1, 60) || !num(out.t1, -1, 60) || !num(out.camTilt, -10, 60)) return null; out.sig = g;
    const t = out.trace; out.trace = undefined; if (!sane(out) || JSON.stringify(out).length > 20000) return null;
    if (!okTrace(t) || t.rows > 4000) return null; out.trace = { enc: t.enc, hz: t.hz, cols: t.cols, rows: t.rows, data: t.data };
  } else if (kind === 'video') {
    const F = out.frames; if (!Array.isArray(F) || F.length < 10 || F.length > 6000 || !F.every(r => Array.isArray(r) && r.length === 4 && r.every(Number.isFinite))) return null;
    if (!Array.isArray(out.labels) || out.labels.length > 600 || (out.marks != null && (!Array.isArray(out.marks) || out.marks.length > 2000)) || (out.detected != null && (!Array.isArray(out.detected) || out.detected.length > 2000))) return null;
    out.frames = undefined; if (!sane(out)) return null; out.frames = F;
  } else if (kind === 'labels') {
    if (!str(out.flight, 40) || !Array.isArray(out.labels) || out.labels.length > 3000 || !sane(out)) return null;
  } else {
    if (!str(out.text, 4000) || !out.text.trim() || !optStr(out.category, 60) || !str(out.at, 40) || !sane(out) || JSON.stringify(out).length > 20000) return null;
  }
  return out;
}

// a map layer (pro-whooper-mapedit/1's moved / removed / added): only those fields, numbers only, sizes capped
function cleanLayer(p) {
  const num = v => Number.isFinite(v) && Math.abs(v) <= 5000, M = p.moved, R = p.removed, A = p.added;
  if (!M || typeof M !== 'object' || Array.isArray(M) || Object.keys(M).length > 5000 || !Object.entries(M).every(([k, m]) => k.length <= 80 && m && typeof m === 'object' && ['dx', 'dy', 'dz', 'ry', 's'].every(f => m[f] === undefined || num(m[f])) && Object.keys(m).length <= 5)) return null;
  if (!Array.isArray(R) || R.length > 5000 || !R.every(k => str(k, 80))) return null;
  if (!Array.isArray(A) || A.length > 3000 || !A.every(a => a && typeof a === 'object' && str(a.asset, 40) && ['x', 'y', 'z', 'ry', 's'].every(f => a[f] === undefined || num(a[f])) && Object.keys(a).length <= 6)) return null;
  return { moved: Object.fromEntries(Object.entries(M).map(([k, m]) => [k, { dx: +m.dx || 0, dy: +m.dy || 0, dz: +m.dz || 0, ry: +m.ry || 0, s: m.s === undefined ? 1 : +m.s }])),
    removed: R.slice(), added: A.map(a => ({ asset: a.asset, x: +a.x || 0, y: +a.y || 0, z: +a.z || 0, ry: +a.ry || 0, s: a.s === undefined ? 1 : +a.s })) };
}
// ---- review badges (owner, 2026-11-20): one review per decided moment a pilot sends (a ✓, ✗, correction or named added trick,
// own runs and other pilots' alike; undecided touches never count), one per second of one flight however often it is re-sent.
// Kept in KV (env.BADGES, or the LIMITS namespace): badge:<name> = { n, seen: [flight@second…] } and the list badges:v1 =
// { since, n: { name: [display, count] } }, served by GET /badges. tools/badges.js counts what came before `since`.
const BADGE_KEY = 'badges:v1', BADGE_NAME = /^[A-Za-z0-9_. -]{2,24}$/;
const reviewMoments = labels => { const out = new Set(); for (const l of Array.isArray(labels) ? labels : []) { if (!l || typeof l !== 'object' || l.undone || !(l.verdict === 'yes' || l.verdict === 'no') || !(typeof l.actual === 'string' && l.actual) || !Number.isFinite(+l.t)) continue; out.add(Math.round(+l.t)); } return [...out]; };
const badgeName = p => { const L = Array.isArray(p.labels) ? p.labels : [], by = (L.find(l => l && typeof l.by === 'string' && l.by) || {}).by || p.name; return typeof by === 'string' && BADGE_NAME.test(by.trim()) ? by.trim() : null; };
let badgeCache = null;
async function badgeAdd(env, p) {
  const kv = env.BADGES || env.LIMITS, name = badgeName(p); if (!kv || !name) return 0; const k = name.toLowerCase();
  try { const me = JSON.parse((await kv.get('badge:' + k)) || 'null') || { n: 0, seen: [] }, seen = new Set(me.seen); let add = 0;
    for (const t of reviewMoments(p.labels)) { const key = `${String(p.flight).slice(0, 40)}@${t}`; if (seen.has(key)) continue; seen.add(key); me.seen.push(key); add++; }
    if (!add) return 0; me.n += add; if (me.seen.length > 4000) me.seen = me.seen.slice(-4000); await kv.put('badge:' + k, JSON.stringify(me));
    const all = JSON.parse((await kv.get(BADGE_KEY)) || 'null') || { since: Date.now(), n: {} }; all.n[k] = [name, me.n]; await kv.put(BADGE_KEY, JSON.stringify(all)); badgeCache = null; return add;
  } catch { return 0; } }
async function badges(env, reply) {
  const kv = env.BADGES || env.LIMITS; if (!kv) return reply(404, 'badges are not set up: bind a KV namespace as BADGES (or LIMITS)');
  if (!badgeCache || Date.now() - badgeCache.at > 60000) { let all = null; try { all = JSON.parse((await kv.get(BADGE_KEY)) || 'null'); } catch { /* none yet */ } badgeCache = { at: Date.now(), body: JSON.stringify(all || { since: null, n: {} }) }; }
  return reply(200, badgeCache.body, { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' }); }
const mem = new Map();   // best-effort counters for this machine: key -> { n, until }
async function bump(env, key, ttl, limit, shared) {
  if (shared && env.LIMITS) { try { const n = +(await env.LIMITS.get(key)) || 0; if (n >= limit) return false; await env.LIMITS.put(key, String(n + 1), { expirationTtl: ttl }); return true; } catch { return false; } }   // can't count: don't accept
  const now = Date.now(), c = mem.get(key); if (!c || c.until < now) { if (mem.size > 5000) mem.clear(); mem.set(key, { n: 1, until: now + ttl * 1000 }); return true; }
  if (c.n >= limit) return false; c.n++; return true;
}

const b64u = s => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { try { return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))); } catch { return ''; } };
// community maps: maps/community/<base>/<time>.<pilot>.<name b64url>.<by b64url>.json (base64url has no dots); the list
// is the file names, newest of each pilot's map name only
const mapFile = (p, now) => `${now}.${p.pilot}.${b64u(p.name)}.${b64u(p.by)}.json`;
const MAP_ID_RE = /^(\d{10,16})\.([a-z0-9]{6,40})\.([A-Za-z0-9_-]{1,60})\.([A-Za-z0-9_-]{1,40})$/;
function mapsFrom(names) { const seen = new Set(), out = [];
  for (const n of names.filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort().reverse()) { const m = MAP_ID_RE.exec(n); if (!m) continue; const name = unb64u(m[3]), by = unb64u(m[4]);
    if (!name || !by || seen.has(m[2] + '|' + name)) continue; seen.add(m[2] + '|' + name); out.push({ id: n, name, by, pilot: m[2], at: +m[1] }); if (out.length >= 200) break; }
  return out; }
const mapsCache = new Map();   // base -> { at, body }
async function mapList(request, env, fetchImpl, reply) {
  const base = new URL(request.url).searchParams.get('base') || ''; if (!/^[a-z0-9-]{1,24}$/.test(base)) return reply(400, 'bad map');
  const c = mapsCache.get(base), json = body => reply(200, body, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' });
  if (c && Date.now() - c.at < 60000) return json(c.body);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'; if (!(await bump(env, `mip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 240))) return reply(429, 'slow down');
  let names = []; try { const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/maps/community/${base}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (r.ok) { const L = await r.json(); if (Array.isArray(L)) names = L.filter(x => x && x.type === 'file' && typeof x.name === 'string').map(x => x.name); } else if (r.status !== 404) return c ? json(c.body) : reply(502, 'could not list maps'); } catch { return c ? json(c.body) : reply(502, 'could not list maps'); }
  const body = JSON.stringify({ base, maps: mapsFrom(names) }); if (mapsCache.size > 40) mapsCache.clear(); mapsCache.set(base, { at: Date.now(), body }); return json(body);
}
async function oneMap(request, env, fetchImpl, reply) {
  const u = new URL(request.url), base = u.searchParams.get('base') || '', id = u.searchParams.get('id') || '';
  if (!/^[a-z0-9-]{1,24}$/.test(base) || !MAP_ID_RE.test(id)) return reply(400, 'bad map');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'; if (!(await bump(env, `mip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 240))) return reply(429, 'slow down');
  try { const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/maps/community/${base}/${id}.json?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.raw+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (r.status === 404) return reply(404, 'no such map'); if (!r.ok) return reply(502, 'could not read the map');
    const p = clean('map', JSON.parse(await r.text())); if (!p || p.base !== base) return reply(404, 'no such map');
    return reply(200, JSON.stringify(p), { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }); } catch { return reply(502, 'could not read the map'); }
}
// RaceGOW tracks: tracks/<time>.<pilot>.<name b64url>.<by b64url>.json (the list is the file names, like community maps)
const trackFile = (p, now) => `${now}.${p.pilot}.${b64u(p.name)}.${b64u(p.by)}.json`;
// lap times: racetimes/<track hash>/<lap ms, 8 digits>-<name b64url>-<pilot>-<time>.json (the board is the file names)
const lapFile = (p, now) => `${String(p.lap).padStart(8, '0')}-${b64u(p.name)}-${p.pilot}-${now}.json`;
const LAP_ID_RE = /^(\d{8})-([A-Za-z0-9_-]{1,40})-([a-z0-9]{6,40})-(\d{10,16})$/;
function lapsFrom(names) { const best = new Map();
  for (const n of names.filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort()) { const m = LAP_ID_RE.exec(n); if (!m) continue; const name = unb64u(m[2]); if (!name || best.has(m[3])) continue; best.set(m[3], { id: n, name, pilot: m[3], lap: +m[1], at: +m[4] }); }
  return [...best.values()].sort((a, b) => a.lap - b.lap).slice(0, 100); }
const ghGet = (env, fetchImpl, path, raw) => fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' } });
const rgCache = new Map();
async function rgListing(request, env, fetchImpl, reply, folder, key, from) {
  const c = rgCache.get(folder), json = body => reply(200, body, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' }); if (c && Date.now() - c.at < 30000) return json(c.body);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'; if (!(await bump(env, `mip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 240))) return reply(429, 'slow down');
  let names = []; try { const r = await ghGet(env, fetchImpl, folder); if (r.ok) { const L = await r.json(); if (Array.isArray(L)) names = L.filter(x => x && x.type === 'file' && typeof x.name === 'string').map(x => x.name); } else if (r.status !== 404) return c ? json(c.body) : reply(502, 'could not list'); } catch { return c ? json(c.body) : reply(502, 'could not list'); }
  const body = JSON.stringify({ [key]: from(names) }); if (rgCache.size > 200) rgCache.clear(); rgCache.set(folder, { at: Date.now(), body }); return json(body);
}
async function rgOne(request, env, fetchImpl, reply, path, kind, check) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'; if (!(await bump(env, `mip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 240))) return reply(429, 'slow down');
  try { const r = await ghGet(env, fetchImpl, path, true); if (r.status === 404) return reply(404, 'not found'); if (!r.ok) return reply(502, 'could not read it');
    const p = clean(kind, JSON.parse(await r.text())); if (!p || (check && !check(p))) return reply(404, 'not found');
    return reply(200, JSON.stringify(p), { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }); } catch { return reply(502, 'could not read it'); }
}
function raceGet(request, env, fetchImpl, reply, pth) {
  const u = new URL(request.url), q = k => u.searchParams.get(k) || '';
  if (pth.endsWith('/tracks')) return rgListing(request, env, fetchImpl, reply, 'tracks', 'tracks', mapsFrom);
  if (pth.endsWith('/track')) { if (!MAP_ID_RE.test(q('id'))) return reply(400, 'bad track'); return rgOne(request, env, fetchImpl, reply, `tracks/${q('id')}.json`, 'track'); }
  if (pth.endsWith('/raceboard')) { if (!/^[a-z0-9]{6,20}$/.test(q('track'))) return reply(400, 'bad track'); return rgListing(request, env, fetchImpl, reply, `racetimes/${q('track')}`, 'times', lapsFrom); }
  if (pth.endsWith('/ghost')) { if (!/^[a-z0-9]{6,20}$/.test(q('track')) || !LAP_ID_RE.test(q('id'))) return reply(400, 'bad ghost'); return rgOne(request, env, fetchImpl, reply, `racetimes/${q('track')}/${q('id')}.json`, 'racetime', p => p.track === q('track')); }
  return null;
}
// ---- Trick challenges (owner, 2026-11-23; src/challenge.js). A pilot's new trick: challenges/<time>.<pilot>.<name b64url>.<by b64url>.<map>.json.
// A try another pilot's game matched to it: challenge-tries/<challenge id>~<time>.<pilot>.<by b64url>.json. The owner's moderation
// (POST /chmod with the owner key): challenge-mod/<challenge id>~<hide|show|name|pts>~<value>~<time>.json, newest of each kind
// wins. GET /challenges is all three folders' file NAMES turned into the board (no file is opened): each challenge with who passed
// it; CH_CONFIRM pilots other than its creator make it confirmed. GET /challenge?id= returns one (its signature and clip), cleaned again.
const CH_CONFIRM = 2;
const chFile = (p, now) => `${now}.${p.pilot}.${b64u(p.name)}.${b64u(p.by)}.${p.map}.json`;
const tryFile = (p, now) => `${p.challenge}~${now}.${p.pilot}.${b64u(p.by)}.json`;
const TRY_RE = /^(.+)~(\d{10,16})\.([a-z0-9]{6,40})\.([A-Za-z0-9_-]{1,40})$/, MOD_RE = /^(.+)~(hide|show|name|pts)~([A-Za-z0-9_-]{1,60})~(\d{10,16})$/;
function challengesFrom(chNames, tryNames, modNames) {
  const mods = new Map();   // id -> { hidden, name, pts } from the newest of each kind
  for (const n of modNames.filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort((a, b) => (+MOD_RE.exec(a)?.[4] || 0) - (+MOD_RE.exec(b)?.[4] || 0))) { const m = MOD_RE.exec(n); if (!m || !CH_ID_RE.test(m[1])) continue; const o = mods.get(m[1]) || {};
    if (m[2] === 'hide') o.hidden = true; if (m[2] === 'show') o.hidden = false; if (m[2] === 'name') { const v = unb64u(m[3]); if (v && /^[A-Za-z0-9_.,'!&()+ -]{2,40}$/.test(v) && !badName(v)) o.name = v; } if (m[2] === 'pts' && /^\d{1,4}$/.test(m[3])) o.pts = Math.min(5000, +m[3]); mods.set(m[1], o); }
  const tries = new Map();
  for (const n of tryNames.filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort()) { const m = TRY_RE.exec(n); if (!m || !CH_ID_RE.test(m[1])) continue; const by = unb64u(m[4]); if (!by || !/^[A-Za-z0-9_. -]{2,24}$/.test(by) || badName(by)) continue;
    const L = tries.get(m[1]) || []; L.push({ pilot: m[3], by, at: +m[2] }); tries.set(m[1], L); }
  const out = [];
  for (const n of chNames.filter(x => x.endsWith('.json')).map(x => x.slice(0, -5)).sort().reverse()) { const m = CH_ID_RE.exec(n); if (!m) continue; const name0 = unb64u(m[3]), by = unb64u(m[4]);
    if (!name0 || !by || badName(name0) || badName(by)) continue; const o = mods.get(n) || {}, name = o.name || name0;
    // who passed it: one per pilot id and one per name, never the creator (by id or by name)
    const pid = new Set(), nm = new Set(), passed = [];
    for (const t of tries.get(n) || []) { const k = t.by.toLowerCase(); if (t.pilot === m[2] || k === by.toLowerCase() || pid.has(t.pilot) || nm.has(k)) continue; pid.add(t.pilot); nm.add(k); passed.push(t.by); }
    out.push({ id: n, name: o.hidden ? '' : name, by, pilot: m[2], map: m[5], at: +m[1], pts: o.pts ?? 200, passed: o.hidden ? [] : passed.slice(0, 50), n: passed.length, confirmed: passed.length >= CH_CONFIRM, ...(o.hidden ? { hidden: true } : {}) });
    if (out.length >= 300) break; }
  return out;
}
let chCache = null;
async function challengeList(request, env, fetchImpl, reply) {
  const json = body => reply(200, body, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' }); if (chCache && Date.now() - chCache.at < 30000) return json(chCache.body);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'; if (!(await bump(env, `mip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 240))) return reply(429, 'slow down');
  const names = async folder => { const r = await ghGet(env, fetchImpl, folder); if (r.status === 404) return []; if (!r.ok) throw new Error(String(r.status)); const L = await r.json(); return Array.isArray(L) ? L.filter(x => x && x.type === 'file' && typeof x.name === 'string').map(x => x.name) : []; };
  try { const [c, t, m] = await Promise.all([names('challenges'), names('challenge-tries'), names('challenge-mod')]);
    const body = JSON.stringify({ confirm: CH_CONFIRM, challenges: challengesFrom(c, t, m) }); chCache = { at: Date.now(), body }; return json(body); }
  catch { return chCache ? json(chCache.body) : reply(502, 'could not list the challenges'); }
}
function challengeOne(request, env, fetchImpl, reply) {
  const id = new URL(request.url).searchParams.get('id') || ''; if (!CH_ID_RE.test(id)) return reply(400, 'bad challenge');
  return rgOne(request, env, fetchImpl, reply, `challenges/${id}.json`, 'challenge');
}
// POST /chmod { key, id, op: hide | show | name | pts, name?, pts? }: the owner hiding, showing, renaming or pricing a challenge
async function challengeMod(request, env, fetchImpl, reply, origin, allowed) {
  if (!allowed.includes(origin)) return reply(403, 'not from the game');
  if (!env.OWNER_KEY) return reply(503, 'owner key not set up: add the secret OWNER_KEY in Cloudflare');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown', hour = Math.floor(Date.now() / 3600000), text = await request.text(); if (text.length > 4000) return reply(413, 'too large');
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  if (!j || typeof j !== 'object' || typeof j.key !== 'string' || !j.key || j.key.length > 200) return reply(400, 'bad request');
  const tries = mem.get(`okey:${ip}:${hour}`); if (tries && tries.n >= 5) return reply(429, 'too many wrong keys: wait an hour');
  if (!(await sameKey(j.key, env.OWNER_KEY))) { await bump(env, `okey:${ip}:${hour}`, 3600, 1e9); return reply(403, 'wrong owner key'); }
  if (typeof j.id !== 'string' || !CH_ID_RE.test(j.id) || !['hide', 'show', 'name', 'pts'].includes(j.op)) return reply(400, 'bad request');
  let val = '0';
  if (j.op === 'name') { if (typeof j.name !== 'string' || !/^[A-Za-z0-9_.,'!&()+ -]{2,40}$/.test(j.name.trim()) || badName(j.name)) return reply(400, 'not a name the board can show'); val = b64u(j.name.trim()); }
  if (j.op === 'pts') { if (!Number.isInteger(j.pts) || j.pts < 0 || j.pts > 5000) return reply(400, 'points must be a whole number 0-5000'); val = String(j.pts); }
  const path = `challenge-mod/${j.id}~${j.op}~${val}~${Date.now()}.json`, body = JSON.stringify({ id: j.id, op: j.op, value: val, at: new Date().toISOString() });
  let r; try { r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' }, body: JSON.stringify({ message: `challenge: ${j.op}`, content: btoa(body), branch: env.GITHUB_BRANCH || 'main' }) }); } catch { return reply(502, 'could not reach GitHub'); }
  if (!r.ok) return reply(502, `GitHub said ${r.status}`); chCache = null; return reply(200, 'ok');
}
const scoreFile = (p, now) => `${String(p.score).padStart(8, '0')}-${p.map}-${b64u(p.name)}-${p.pilot}-${now}.json`;
// file names of one day's folder -> the board: each pilot's best run per map, highest first
function boardFrom(names) {
  const best = new Map();
  for (const n of names) { const m = /^(\d{8})-([a-z0-9-]{1,24}?)-([A-Za-z0-9_-]{1,40})-([a-z0-9]{6,40})-(\d{10,16})\.json$/.exec(n); if (!m) continue;
    const name = unb64u(m[3]); if (!/^[A-Za-z0-9_. -]{2,24}$/.test(name)) continue;
    const e = { name, score: +m[1], map: m[2], at: +m[5], id: n.slice(0, -5) }, k = m[4] + '|' + m[2], b = best.get(k); if (!b || e.score > b.score) best.set(k, e); }
  return [...best.values()].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 100);
}
const boardCache = new Map();   // day -> { at, body }
async function board(request, env, fetchImpl, reply) {
  const u = new URL(request.url), today = new Date().toISOString().slice(0, 10), day = u.searchParams.get('day') || today;
  if (day !== today) return reply(400, 'today only');   // no history: earlier days stay in the repo for the project, but cannot be read from outside
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await bump(env, `bip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 240))) return reply(429, 'slow down');
  const c = boardCache.get(day), json = body => reply(200, body, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' });
  if (c && Date.now() - c.at < 30000) return json(c.body);
  let names = []; try { const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/leaderboard/${day}?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (r.ok) { const L = await r.json(); if (Array.isArray(L)) names = L.filter(x => x && x.type === 'file' && typeof x.name === 'string').map(x => x.name); } else if (r.status !== 404) return c ? json(c.body) : reply(502, 'could not read the board'); } catch { return c ? json(c.body) : reply(502, 'could not read the board'); }
  const body = JSON.stringify({ day, runs: boardFrom(names) }); if (boardCache.size > 40) boardCache.clear(); boardCache.set(day, { at: Date.now(), body }); return json(body);
}

const RUN_ID = /^\d{8}-[a-z0-9-]{1,24}-[A-Za-z0-9_-]{1,40}-[a-z0-9]{6,40}-\d{10,16}$/;
async function oneRun(request, env, fetchImpl, reply) {
  const u = new URL(request.url), day = u.searchParams.get('day') || '', id = u.searchParams.get('id') || '';
  if (day !== new Date().toISOString().slice(0, 10) || !RUN_ID.test(id)) return reply(400, 'bad run');   // today's board only
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await bump(env, `rip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, 120))) return reply(429, 'slow down');
  try { const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/leaderboard/${day}/${id}.json?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`, { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.raw+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (r.status === 404) return reply(404, 'no such run'); if (!r.ok) return reply(502, 'could not read the run');
    const p = clean('score', JSON.parse(await r.text())); if (!p) return reply(404, 'no such run');
    return reply(200, JSON.stringify(p), { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }); } catch { return reply(502, 'could not read the run'); }
}

// Official map layouts, published by the owner from the Map Editor. Only with the owner key (Cloudflare secret OWNER_KEY,
// a passphrase the owner typed once into their game; compared by hash, in constant time); wrong guesses are slowed to 5
// an hour per address. Committed as maps/official/<map>.json to GAME_REPO (default heyheykoolaid/openprowhooper, which
// GitHub Pages builds from), so GITHUB_TOKEN needs Contents: Read and write there too. Nothing else can be written.
async function sameKey(a, b) { const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)))); const x = await h(a), y = await h(b); let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i]; return d === 0; }
async function ownerSigOk(key, payload, sig) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(key)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(String(payload.flight) + '|' + JSON.stringify(payload.labels))))].map(b => b.toString(16).padStart(2, '0')).join('');
  let d = 0; for (let i = 0; i < 64; i++) d |= mac.charCodeAt(i) ^ sig.charCodeAt(i); return d === 0;
}
// POST /owner { key }: is this the owner key? (the game opens the owner's menus only then). Wrong keys count like /official's.
async function ownerCheck(request, env, reply, origin, allowed) {
  if (!allowed.includes(origin)) return reply(403, 'not from the game');
  if (!env.OWNER_KEY) return reply(503, 'owner key not set up: add the secret OWNER_KEY in Cloudflare');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown', hour = Math.floor(Date.now() / 3600000), text = await request.text();
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  if (!j || typeof j.key !== 'string' || j.key.length > 200) return reply(400, 'bad request');
  if (!j.key) return reply(401, 'no key');
  const tries = mem.get(`okey:${ip}:${hour}`); if (tries && tries.n >= 5) return reply(429, 'too many wrong keys: wait an hour');
  if (!(await sameKey(j.key, env.OWNER_KEY))) { await bump(env, `okey:${ip}:${hour}`, 3600, 1e9); return reply(403, 'wrong owner key'); }
  return reply(200, 'owner');
}
// POST /desk { key, op: 'list' | 'get' | 'getMany', path | paths }: the owner reading the project's shared data from the
// game (Flight desk, feedback, earlier days' board runs). Read-only, and only these places:
const DESK_DAY = '\\d{4}-\\d\\d-\\d\\d';
const DESK_LIST = new RegExp(`^(telemetry/inbox/(flight|labels|feedback)(/${DESK_DAY})?|leaderboard(/${DESK_DAY})?)$`);
const DESK_FILE = new RegExp(`^telemetry/inbox/(flight|labels|feedback)/${DESK_DAY}/\\d{10,16}-[0-9a-f]{8,32}\\.json$`);
const DESK_RUN = new RegExp(`^leaderboard/${DESK_DAY}/\\d{8}-[a-z0-9-]{1,24}-[A-Za-z0-9_-]{1,40}-[a-z0-9]{6,40}-\\d{10,16}\\.json$`);
// POST /review { op, path | paths }: the same reading for EVERY pilot's Review queue (owner, 2026-11-21), with no key and much less
// to read: only shared flights and review labels (never feedback), only the last REVIEW_DAYS days, not the flights of a pilot who
// opted out (`summary.reviewOk: false`, the Options checkbox), without the flight's error log, and
// REVIEW_PER_HOUR requests an address. Read-only like the desk; every file cleaned again. REVIEW=0 closes it.
const REVIEW_DAYS = 7, REVIEW_PER_HOUR = 240;
const REVIEW_LIST = new RegExp(`^telemetry/inbox/(flight|labels)(/(${DESK_DAY}))?$`), REVIEW_FILE = new RegExp(`^telemetry/inbox/(flight|labels)/(${DESK_DAY})/\\d{10,16}-[0-9a-f]{8,32}\\.json$`);
const reviewDayOk = day => { const t = Date.parse(day + 'T00:00:00Z'); return Number.isFinite(t) && Date.now() - t < (REVIEW_DAYS + 1) * 86400000 && t - Date.now() < 2 * 86400000; };
async function deskApi(request, env, fetchImpl, reply, origin, allowed, guest) {
  if (!allowed.includes(origin)) return reply(403, 'not from the game');
  if (guest && env.REVIEW === '0') return reply(503, 'the review queue is closed');
  if (!guest && !env.OWNER_KEY) return reply(503, 'owner key not set up: add the secret OWNER_KEY in Cloudflare');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown', hour = Math.floor(Date.now() / 3600000), text = await request.text();
  if (text.length > 20000) return reply(413, 'too large');
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  if (!j || typeof j !== 'object' || !['list', 'get', 'getMany'].includes(j.op)) return reply(400, 'bad request');
  if (guest) { if (!(await bump(env, `review:${ip}:${hour}`, 3600, REVIEW_PER_HOUR))) return reply(429, 'slow down'); }
  else { if (typeof j.key !== 'string' || !j.key || j.key.length > 200) return reply(400, 'bad request');
    const tries = mem.get(`okey:${ip}:${hour}`); if (tries && tries.n >= 5) return reply(429, 'too many wrong keys: wait an hour');
    if (!(await sameKey(j.key, env.OWNER_KEY))) { await bump(env, `okey:${ip}:${hour}`, 3600, 1e9); return reply(403, 'wrong owner key'); }
    if (!(await bump(env, `desk:${ip}:${hour}`, 3600, 3000))) return reply(429, 'slow down'); }
  const listOk = p => typeof p === 'string' && (guest ? (m => !!m && (!m[3] || reviewDayOk(m[3])))(REVIEW_LIST.exec(p)) : DESK_LIST.test(p));
  const fileOk = p => typeof p === 'string' && (guest ? (m => !!m && reviewDayOk(m[2]))(REVIEW_FILE.exec(p)) : DESK_FILE.test(p) || DESK_RUN.test(p));
  const H = { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' }, ref = `?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`;
  const json = body => reply(200, JSON.stringify(body), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (j.op === 'list') {
    if (!listOk(j.path)) return reply(400, 'not a place the desk can list');
    try { const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${j.path}${ref}`, { headers: { ...H, 'Accept': 'application/vnd.github+json' } });
      if (r.status === 404) return json([]); if (!r.ok) return reply(502, `GitHub said ${r.status}`);
      const L = await r.json(); return json(Array.isArray(L) ? L.filter(x => x && (x.type === 'file' || x.type === 'dir') && typeof x.name === 'string' && /^[A-Za-z0-9_.-]{1,160}$/.test(x.name) && !(guest && x.type === 'dir' && !reviewDayOk(x.name))).map(x => ({ name: x.name, type: x.type, size: +x.size || 0 })) : []); }
    catch { return reply(502, 'could not reach GitHub'); }
  }
  const one = async path => {   // one file, cleaned again as what its folder says it is (null when it is not)
    if (!fileOk(path)) return null; const m = DESK_FILE.exec(path), kind = m ? m[1] : DESK_RUN.test(path) ? 'score' : null; if (!kind) return null;
    const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}${ref}`, { headers: { ...H, 'Accept': 'application/vnd.github.raw+json' } });
    if (!r.ok) return null; let p; try { p = JSON.parse(await r.text()); } catch { return null; }
    const verified = kind === 'labels' && p && p.ownerVerified === true, c = clean(kind, p); if (c && verified) c.ownerVerified = true;
    if (guest && c && kind === 'flight') { if (c.summary && c.summary.reviewOk === false) return null; if (c.summary) delete c.summary.errors; }   // every shared flight, except a pilot's who opted out (owner, 2026-11-21: "drop it": the queue only shows brief moments)
    return c;
  };
  if (j.op === 'get') { if (!fileOk(j.path)) return reply(400, 'not a file the desk can read');
    try { const c = await one(j.path); return c ? json(c) : reply(404, 'no such file'); } catch { return reply(502, 'could not reach GitHub'); } }
  if (!Array.isArray(j.paths) || !j.paths.length || j.paths.length > 40) return reply(400, 'give 1 to 40 paths');   // a Worker may make 50 requests per call
  const out = {}; await Promise.all(j.paths.map(async path => { try { out[path] = await one(path); } catch { out[path] = null; } }));
  return json(out);
}
async function official(request, env, fetchImpl, reply, origin, allowed) {
  if (!allowed.includes(origin)) return reply(403, 'not from the game');
  if (!env.OWNER_KEY) return reply(503, 'publishing is not set up: add the secret OWNER_KEY in Cloudflare');
  if (String(env.OWNER_KEY).length < 12) return reply(503, 'OWNER_KEY is too short: use at least 12 characters (a few random words)');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown', hour = Math.floor(Date.now() / 3600000);
  const text = await request.text(); if (text.length > 450000) return reply(413, 'too large');
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  if (!j || typeof j !== 'object' || typeof j.key !== 'string' || j.key.length > 200) return reply(400, 'bad request');
  const tries = mem.get(`okey:${ip}:${hour}`); if (tries && tries.n >= 5) return reply(429, 'too many wrong keys: wait an hour');
  if (!(await sameKey(j.key, env.OWNER_KEY))) { await bump(env, `okey:${ip}:${hour}`, 3600, 1e9); return reply(403, 'wrong owner key'); }
  if (!str(j.map, 24) || !/^[a-z0-9-]{1,24}$/.test(j.map)) return reply(400, 'bad map');
  const L = cleanLayer(j); if (!L) return reply(400, 'not a map layout');
  const by = str(j.by, 24) && /^[A-Za-z0-9_. -]{1,24}$/.test(j.by) ? j.by : 'owner';
  const file = { format: 'pro-whooper-mapedit/1', map: j.map, at: new Date().toISOString(), by, ...L }, repo = env.GAME_REPO || 'heyheykoolaid/openprowhooper', branch = env.GAME_BRANCH || 'main';
  const url = `https://api.github.com/repos/${repo}/contents/maps/official/${j.map}.json`, H = { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' };
  let sha; try { const g = await fetchImpl(`${url}?ref=${encodeURIComponent(branch)}`, { headers: H }); if (g.ok) { const b = await g.json(); sha = b && b.sha; } else if (g.status !== 404) return reply(502, `GitHub said ${g.status} reading the map (does the relay's token reach ${repo}?)`); } catch { return reply(502, 'could not reach GitHub'); }
  const bytes = new TextEncoder().encode(JSON.stringify(file, null, 1)); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  let r; try { r = await fetchImpl(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: `Official layout of ${j.map} (${Object.keys(L.moved).length} moved, ${L.removed.length} removed, ${L.added.length} added) by ${by}`, content: btoa(bin), branch, ...(sha ? { sha } : {}) }) }); } catch { return reply(502, 'could not reach GitHub'); }
  if (!r.ok) return reply(502, `GitHub said ${r.status} (the relay's token needs Contents: Read and write on ${repo})`);
  return reply(200, JSON.stringify({ ok: true, at: file.at }), { 'Content-Type': 'application/json' });
}
async function handle(request, env, fetchImpl = fetch) {
  const allowed = (env.ALLOW_ORIGINS || 'https://openprowhooper.com,https://www.openprowhooper.com,https://heyheykoolaid.github.io').split(',').map(s => s.trim()).filter(Boolean), origin = request.headers.get('Origin') || '';
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  const reply = (status, text, extra) => new Response(text, { status, headers: { ...cors, ...(extra || {}) } });
  if (request.method === 'OPTIONS') return reply(204, '');
  if (env.ENABLED === '0' || !env.GITHUB_TOKEN || !env.GITHUB_REPO) return reply(503, 'closed');
  if (request.method === 'GET') { const pth = new URL(request.url).pathname.replace(/\/+$/, ''); if (pth.endsWith('/badges')) return badges(env, reply); if (pth.endsWith('/challenges')) return challengeList(request, env, fetchImpl, reply); if (pth.endsWith('/challenge')) return challengeOne(request, env, fetchImpl, reply); if (pth.endsWith('/board')) return board(request, env, fetchImpl, reply); if (pth.endsWith('/run')) return oneRun(request, env, fetchImpl, reply); if (pth.endsWith('/maps')) return mapList(request, env, fetchImpl, reply); if (pth.endsWith('/map')) return oneMap(request, env, fetchImpl, reply); { const rr = raceGet(request, env, fetchImpl, reply, pth); if (rr) return rr; } return reply(405, 'POST only'); }
  if (request.method !== 'POST') return reply(405, 'POST only');
  if (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/official')) return official(request, env, fetchImpl, reply, origin, allowed);
  if (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/chmod')) return challengeMod(request, env, fetchImpl, reply, origin, allowed);
  if (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/owner')) return ownerCheck(request, env, reply, origin, allowed);
  if (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/desk')) return deskApi(request, env, fetchImpl, reply, origin, allowed);
  if (new URL(request.url).pathname.replace(/\/+$/, '').endsWith('/review')) return deskApi(request, env, fetchImpl, reply, origin, allowed, true);
  if (!allowed.includes(origin)) return reply(403, 'not from the game');
  if (+(request.headers.get('Content-Length') || 0) > MAX_BYTES) return reply(413, 'too large');
  const text = await request.text(); if (text.length > MAX_BYTES) return reply(413, 'too large');
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  if (!j || typeof j !== 'object' || !Object.prototype.hasOwnProperty.call(FORMATS, j.kind)) return reply(400, 'not a Pro Whooper upload');
  if (/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(text)) return reply(400, 'refused: looks like it contains an access token');
  const payload = clean(j.kind, j.payload); if (!payload) return reply(400, 'not a Pro Whooper upload');
  // the owner's reviewer labels arrive signed with the owner key (an HMAC, never the key): marked ownerVerified when the
  // signature holds. clean() drops any ownerVerified a client sends; only this line sets it, and the signature is not stored.
  if (j.kind === 'labels' && env.OWNER_KEY && typeof j.ownerSig === 'string' && j.ownerSig.length === 64 && (await ownerSigOk(env.OWNER_KEY, payload, j.ownerSig))) payload.ownerVerified = true;
  const day = new Date().toISOString().slice(0, 10), ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await bump(env, `ip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, +(env.PER_IP_HOUR || 30)))) return reply(429, 'slow down');
  if (!(await bump(env, `day:${day}`, 172800, +(env.DAILY_CAP || 800), true))) return reply(429, 'full for today');
  const id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  const path = j.kind === 'score' ? `leaderboard/${day}/${scoreFile(payload, Date.now())}` : j.kind === 'map' ? `maps/community/${payload.base}/${mapFile(payload, Date.now())}` : j.kind === 'track' ? `tracks/${trackFile(payload, Date.now())}` : j.kind === 'racetime' ? `racetimes/${payload.track}/${lapFile(payload, Date.now())}` : j.kind === 'challenge' ? `challenges/${chFile(payload, Date.now())}` : j.kind === 'chtry' ? `challenge-tries/${tryFile(payload, Date.now())}` : `telemetry/inbox/${j.kind}/${day}/${Date.now()}-${id}.json`, body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  let r; try { r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ message: `drop-off: ${j.kind}`, content: btoa(bin), branch: env.GITHUB_BRANCH || 'main' }) }); } catch { return reply(502, 'could not store it'); }
  if (r.ok && j.kind === 'labels') await badgeAdd(env, payload);
  if (r.ok && j.kind === 'score') boardCache.delete(day); if (r.ok && j.kind === 'map') mapsCache.delete(payload.base); if (r.ok && j.kind === 'track') rgCache.delete('tracks'); if (r.ok && j.kind === 'racetime') rgCache.delete(`racetimes/${payload.track}`); if (r.ok && (j.kind === 'challenge' || j.kind === 'chtry')) chCache = null;
  return r.ok ? reply(200, 'ok') : reply(502, 'could not store it');
}
export default { fetch: (request, env) => handle(request, env) };
export { badName, challengesFrom, chFile, tryFile, handle, clean, reviewMoments, badgeName, boardFrom, scoreFile, mapsFrom, mapFile, cleanLayer, trackFile, lapFile, lapsFrom };
