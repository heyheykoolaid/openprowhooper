// The drop-off relay: only the game's own formats from the game's own address, files named by the relay, no tokens,
// rate limits, and nothing leaks back. node test/dropoff.js
(async () => {
  const { handle } = await import('../tools/dropoff-worker.mjs');
  let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
  const calls = [], gh = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
  const env = () => ({ GITHUB_TOKEN: 'secret', GITHUB_REPO: 'o/r' }), GAME = 'https://heyheykoolaid.github.io';
  const post = (body, o = {}) => handle(new Request('https://drop/', { method: 'POST', headers: { Origin: o.origin ?? GAME, 'CF-Connecting-IP': o.ip || '1.1.1.' + (n + 1) }, body: typeof body === 'string' ? body : JSON.stringify(body) }), o.env || env(), gh);
  const flight = (extra = {}) => ({ format: 'pro-whooper-flight/1', id: 'x', started: '2026-11-17T00:00:00Z', pilot: 'p1', name: 'Tester', events: [{ t: 1, name: 'Flip' }], trace: { enc: 'cols-delta-varint/1+deflate', hz: 100, cols: ['t', 'x'], rows: 10, data: 'AAAA' }, ...extra });
  let r = await post({ kind: 'flight', name: '../../src/sim', payload: flight({ evil: '<script>', path: '../x' }) });
  check('a flight from the game is stored', r.status === 200 && calls.length === 1);
  check('the path is made by the relay, under telemetry/inbox/', /\/repos\/o\/r\/contents\/telemetry\/inbox\/flight\/\d{4}-\d\d-\d\d\/\d+-[0-9a-f]{16}\.json$/.test(calls[0].url), calls[0].url.split('/contents/')[1]);
  const stored = JSON.parse(Buffer.from(JSON.parse(calls[0].init.body).content, 'base64').toString());
  check('only known fields are stored', stored.id === 'x' && stored.trace.rows === 10 && !('evil' in stored) && !('path' in stored));
  check('the reply names the game as the only allowed origin and carries no token', r.headers.get('Access-Control-Allow-Origin') === GAME && !(await r.text()).includes('secret'));
  r = await post({ kind: 'flight', payload: flight() }, { origin: 'https://evil.example' }); check('other websites are refused', r.status === 403);
  r = await post({ kind: 'flight', payload: flight() }, { origin: '' }); check('requests with no origin (scripts) are refused', r.status === 403);
  r = await post({ kind: 'flight', payload: { format: 'something/1' } }); check('other formats are refused', r.status === 400);
  r = await post({ kind: 'src', payload: flight() }); check('other kinds are refused', r.status === 400);
  r = await post({ kind: 'constructor', payload: flight() }); check('object-property tricks are refused', r.status === 400);
  r = await post('nope'); check('non-JSON is refused', r.status === 400);
  r = await post({ kind: 'flight', payload: flight({ trace: { enc: 'cols-delta-varint/1', hz: 100, cols: ['t'], rows: 10, data: '<b>not base64</b>' } }) }); check('a trace that is not packed data is refused', r.status === 400);
  r = await post({ kind: 'flight', payload: flight({ trace: { enc: 'cols-delta-varint/1', hz: 100, cols: ['t'], rows: 9999999, data: 'AAAA' } }) }); check('absurd sizes are refused', r.status === 400);
  r = await post({ kind: 'flight', payload: flight({ tune: { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 1 } } } } } } } } } } }) }); check('deeply nested junk is refused', r.status === 400);
  r = await post({ kind: 'feedback', payload: { format: 'pro-whooper-feedback/1', at: 'now', text: 'github_pat_' + 'A'.repeat(40) } }); check('anything that looks like a token is refused', r.status === 400);
  r = await post({ kind: 'feedback', payload: { format: 'pro-whooper-feedback/1', at: 'now', text: 'x'.repeat(4001) } }); check('over-long feedback is refused', r.status === 400);
  r = await post({ kind: 'feedback', payload: { format: 'pro-whooper-feedback/1', at: 'now', text: 'x'.repeat(1100000) } }); check('oversized uploads are refused', r.status === 413);
  r = await handle(new Request('https://drop/', { method: 'GET', headers: { Origin: GAME } }), env(), gh); check('only POST', r.status === 405);
  r = await post({ kind: 'flight', payload: flight() }, { env: { ...env(), ENABLED: '0' } }); check('the off switch closes it', r.status === 503);
  check('none of the refused uploads reached GitHub', calls.length === 1);
  r = await post({ kind: 'feedback', payload: { format: 'pro-whooper-feedback/1', at: 'now', category: 'Bug', text: 'the swing set ate my whoop', name: 'T' } }); check('feedback is stored', r.status === 200 && calls.length === 2);
  r = await post({ kind: 'labels', payload: { format: 'pro-whooper-flight-labels/1', flight: 'x', labels: [{ target: 'Flip', verdict: 'yes' }] } }); check('review answers are stored', r.status === 200 && calls.length === 3);
  // limits: per address (in memory) and for everyone per day (KV)
  let last = 0; for (let i = 0; i < 6; i++) last = (await post({ kind: 'flight', payload: flight() }, { ip: '9.9.9.9', env: { ...env(), PER_IP_HOUR: '5' } })).status;
  check('one address is cut off after its hourly allowance', last === 429 && calls.length === 8, `${calls.length - 3} of 6 stored`);
  const kv = new Map(), LIMITS = { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } }, capEnv = { ...env(), LIMITS, DAILY_CAP: '3', PER_IP_HOUR: '100' };
  const st = []; for (let i = 0; i < 5; i++) st.push((await post({ kind: 'flight', payload: flight() }, { ip: '8.8.8.' + i, env: capEnv })).status);
  check('everyone together is cut off at the daily cap', st.join() === '200,200,200,429,429', st.join());
  r = await post({ kind: 'flight', payload: flight() }, { ip: '7.7.7.7', env: { ...env(), LIMITS: { get: async () => { throw new Error('down'); }, put: async () => {} } } }); check('if the counter is unreachable, nothing is accepted', r.status === 429);
  console.log(`\n${ok}/${n} drop-off checks`); process.exitCode = ok === n ? 0 : 1;
})();
