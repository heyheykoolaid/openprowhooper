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
//   - answers with a bare ok / error, never with anything from the repo;
//   - ENABLED = "0" switches it off without deleting anything.
// Variables: GITHUB_TOKEN (secret), GITHUB_REPO "owner/repo", optional GITHUB_BRANCH, ALLOW_ORIGINS (comma separated,
// default https://heyheykoolaid.github.io), PER_IP_HOUR (30), DAILY_CAP (800), ENABLED. Optional KV binding LIMITS makes
// the daily cap exact across Cloudflare's machines (one small write per upload); without it, and for the per-address
// limit, counts are kept in memory on each machine (best effort).
const FORMATS = { flight: 'pro-whooper-flight/1', labels: 'pro-whooper-flight-labels/1', feedback: 'pro-whooper-feedback/1' };
const MAX_BYTES = 1000000;
const KEYS = {
  flight: ['format', 'build', 'id', 'started', 'ended', 'pilot', 'name', 'map', 'mode', 'camTilt', 'craft', 'tune', 'profile', 'input', 'score', 'events', 'missed', 'summary', 'trace'],
  labels: ['format', 'build', 'flight', 'started', 'pilot', 'name', 'labels'],
  feedback: ['format', 'at', 'build', 'category', 'text', 'name', 'context'],
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

async function handle(request, env, fetchImpl = fetch) {
  const allowed = (env.ALLOW_ORIGINS || 'https://heyheykoolaid.github.io').split(',').map(s => s.trim()).filter(Boolean), origin = request.headers.get('Origin') || '';
  const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  const reply = (status, text) => new Response(text, { status, headers: cors });
  if (request.method === 'OPTIONS') return reply(204, '');
  if (request.method !== 'POST') return reply(405, 'POST only');
  if (env.ENABLED === '0' || !env.GITHUB_TOKEN || !env.GITHUB_REPO) return reply(503, 'closed');
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
  const path = `telemetry/inbox/${j.kind}/${day}/${Date.now()}-${id}.json`, body = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(body); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  let r; try { r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ message: `drop-off: ${j.kind}`, content: btoa(bin), branch: env.GITHUB_BRANCH || 'main' }) }); } catch { return reply(502, 'could not store it'); }
  return r.ok ? reply(200, 'ok') : reply(502, 'could not store it');
}
export default { fetch: (request, env) => handle(request, env) };
export { handle, clean };
