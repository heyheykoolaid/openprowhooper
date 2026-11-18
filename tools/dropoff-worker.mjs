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
//   - ENABLED = "0" switches it off without deleting anything.
// Variables: GITHUB_TOKEN (secret), GITHUB_REPO "owner/repo", optional GITHUB_BRANCH, ALLOW_ORIGINS (comma separated,
// default https://heyheykoolaid.github.io), PER_IP_HOUR (30), DAILY_CAP (800), ENABLED. Optional KV binding LIMITS makes
// the daily cap exact across Cloudflare's machines (one small write per upload); without it, and for the per-address
// limit, counts are kept in memory on each machine (best effort).
const FORMATS = { flight: 'pro-whooper-flight/1', labels: 'pro-whooper-flight-labels/1', feedback: 'pro-whooper-feedback/1', score: 'pro-whooper-score/1', video: 'pro-whooper-video/1', map: 'pro-whooper-map/1' };
const MAX_BYTES = 1000000;
const KEYS = {
  flight: ['format', 'build', 'id', 'started', 'ended', 'pilot', 'name', 'map', 'mode', 'camTilt', 'craft', 'tune', 'profile', 'input', 'score', 'events', 'missed', 'summary', 'trace'],
  labels: ['format', 'build', 'flight', 'started', 'pilot', 'name', 'labels'],
  feedback: ['format', 'at', 'build', 'category', 'text', 'name', 'context'],
  video: ['format', 'build', 'duration', 'video', 'analysis', 'frames', 'marks', 'detected', 'labels', 'name', 'pilot', 'profile'],   // measured camera motion + marks + labels (never the video or its file name)
  map: ['format', 'build', 'name', 'by', 'pilot', 'base', 'at', 'moved', 'removed', 'added'],   // a pilot's own map, shared by their click: a layer over an official map
  score: ['format', 'build', 'name', 'pilot', 'score', 'map', 'mode', 'flight', 'totals', 'sheet', 'events', 'camTilt', 'camFov', 'craft', 'trace'],
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
    const num = v => Number.isFinite(v) && Math.abs(v) <= 5000, M = out.moved, R = out.removed, A = out.added;
    if (!M || typeof M !== 'object' || Array.isArray(M) || Object.keys(M).length > 5000 || !Object.entries(M).every(([k, m]) => k.length <= 80 && m && typeof m === 'object' && ['dx', 'dy', 'dz', 'ry', 's'].every(f => m[f] === undefined || num(m[f])) && Object.keys(m).length <= 5)) return null;
    if (!Array.isArray(R) || R.length > 5000 || !R.every(k => str(k, 80))) return null;
    if (!Array.isArray(A) || A.length > 3000 || !A.every(a => a && typeof a === 'object' && str(a.asset, 40) && ['x', 'y', 'z', 'ry', 's'].every(f => a[f] === undefined || num(a[f])) && Object.keys(a).length <= 6)) return null;
    if (!optStr(out.at, 40) || JSON.stringify(out).length > 400000) return null;
    out.moved = Object.fromEntries(Object.entries(M).map(([k, m]) => [k, { dx: +m.dx || 0, dy: +m.dy || 0, dz: +m.dz || 0, ry: +m.ry || 0, s: m.s === undefined ? 1 : +m.s }]));
    out.added = A.map(a => ({ asset: a.asset, x: +a.x || 0, y: +a.y || 0, z: +a.z || 0, ry: +a.ry || 0, s: a.s === undefined ? 1 : +a.s }));
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

async function handle(request, env, fetchImpl = fetch) {
  const allowed = (env.ALLOW_ORIGINS || 'https://heyheykoolaid.github.io').split(',').map(s => s.trim()).filter(Boolean), origin = request.headers.get('Origin') || '';
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  const reply = (status, text, extra) => new Response(text, { status, headers: { ...cors, ...(extra || {}) } });
  if (request.method === 'OPTIONS') return reply(204, '');
  if (env.ENABLED === '0' || !env.GITHUB_TOKEN || !env.GITHUB_REPO) return reply(503, 'closed');
  if (request.method === 'GET') { const pth = new URL(request.url).pathname.replace(/\/+$/, ''); if (pth.endsWith('/board')) return board(request, env, fetchImpl, reply); if (pth.endsWith('/run')) return oneRun(request, env, fetchImpl, reply); if (pth.endsWith('/maps')) return mapList(request, env, fetchImpl, reply); if (pth.endsWith('/map')) return oneMap(request, env, fetchImpl, reply); return reply(405, 'POST only'); }
  if (request.method !== 'POST') return reply(405, 'POST only');
  if (!allowed.includes(origin)) return reply(403, 'not from the game');
  if (+(request.headers.get('Content-Length') || 0) > MAX_BYTES) return reply(413, 'too large');
  const text = await request.text(); if (text.length > MAX_BYTES) return reply(413, 'too large');
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  if (!j || typeof j !== 'object' || !Object.prototype.hasOwnProperty.call(FORMATS, j.kind)) return reply(400, 'not a Pro Whooper upload');
  if (/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(text)) return reply(400, 'refused: looks like it contains an access token');
  const payload = clean(j.kind, j.payload); if (!payload) return reply(400, 'not a Pro Whooper upload');
  const day = new Date().toISOString().slice(0, 10), ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await bump(env, `ip:${ip}:${Math.floor(Date.now() / 3600000)}`, 3600, +(env.PER_IP_HOUR || 30)))) return reply(429, 'slow down');
  if (!(await bump(env, `day:${day}`, 172800, +(env.DAILY_CAP || 800), true))) return reply(429, 'full for today');
  const id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  const path = j.kind === 'score' ? `leaderboard/${day}/${scoreFile(payload, Date.now())}` : j.kind === 'map' ? `maps/community/${payload.base}/${mapFile(payload, Date.now())}` : `telemetry/inbox/${j.kind}/${day}/${Date.now()}-${id}.json`, body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  let r; try { r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ message: `drop-off: ${j.kind}`, content: btoa(bin), branch: env.GITHUB_BRANCH || 'main' }) }); } catch { return reply(502, 'could not store it'); }
  if (r.ok && j.kind === 'score') boardCache.delete(day); if (r.ok && j.kind === 'map') mapsCache.delete(payload.base);
  return r.ok ? reply(200, 'ok') : reply(502, 'could not store it');
}
export default { fetch: (request, env) => handle(request, env) };
export { handle, clean, boardFrom, scoreFile, mapsFrom, mapFile };
