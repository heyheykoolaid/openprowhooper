// Telemetry drop-off relay (Cloudflare Worker, free plan is enough). It lets players who have no GitHub token send
// opt-in flight telemetry, review labels and feedback: the game POSTs here, and this commits the file to the repo with a
// token that only this Worker knows. The token is a Worker secret; it is never in the game or the repo.
//
// Set up (once):
//   1. GitHub: a fine-grained token for this one repo, "Contents: Read and write", nothing else.
//   2. Cloudflare dashboard → Workers → Create → paste this file → Settings → Variables:
//        GITHUB_TOKEN (encrypt it)   GITHUB_REPO = owner/repo   GITHUB_BRANCH = main (optional)
//   3. Put the Worker's https URL in dropoff.txt (one line) and run python3 build.py: the game then offers the drop-off.
// It only ever writes NEW files under telemetry/inbox/<kind>/<day>/, names them itself, and refuses anything that is not
// one of the game's formats or is too large. Rotate or delete the token to switch it off.
const KINDS = { flight: 'pro-whooper-flight/1', labels: 'pro-whooper-flight-labels/1', feedback: 'pro-whooper-feedback/1' };
const MAX = 1500000;   // bytes per upload
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const reply = (status, text) => new Response(text, { status, headers: CORS });

async function handle(request, env, fetchImpl = fetch) {
  if (request.method === 'OPTIONS') return reply(204, '');
  if (request.method !== 'POST') return reply(405, 'POST only');
  const text = await request.text(); if (text.length > MAX) return reply(413, 'too large');
  let j; try { j = JSON.parse(text); } catch { return reply(400, 'not JSON'); }
  const want = j && KINDS[j.kind]; if (!want || !j.payload || j.payload.format !== want) return reply(400, 'not a Pro Whooper upload');
  if (/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(text)) return reply(400, 'refused: looks like it contains an access token');
  const day = new Date().toISOString().slice(0, 10), id = [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
  const path = `telemetry/inbox/${j.kind}/${day}/${Date.now()}-${id}.json`, body = JSON.stringify(j.payload);
  const bytes = new TextEncoder().encode(body); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const r = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, { method: 'PUT',
    headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'pro-whooper-dropoff', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ message: `drop-off: ${j.kind}`, content: btoa(bin), branch: env.GITHUB_BRANCH || 'main' }) });
  return r.ok ? reply(200, 'ok') : reply(502, 'could not store it');
}
export default { fetch: (request, env) => handle(request, env) };
export { handle };
