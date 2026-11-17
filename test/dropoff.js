// The drop-off relay only accepts the game's own formats, names files itself and refuses tokens. node test/dropoff.js
(async () => {
  const { handle } = await import('../tools/dropoff-worker.mjs');
  let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
  const calls = [], gh = async (url, init) => { calls.push({ url, init }); return { ok: true }; }, env = { GITHUB_TOKEN: 'secret', GITHUB_REPO: 'o/r' };
  const post = body => handle(new Request('https://drop/', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }), env, gh);
  let r = await post({ kind: 'flight', name: '../../src/sim', payload: { format: 'pro-whooper-flight/1', id: 'x' } });
  check('a flight is stored', r.status === 200 && calls.length === 1);
  check('the path is made by the relay, under telemetry/inbox/', /\/repos\/o\/r\/contents\/telemetry\/inbox\/flight\/\d{4}-\d\d-\d\d\/\d+-[0-9a-f]{16}\.json$/.test(calls[0].url), calls[0].url.split('/contents/')[1]);
  check('the stored file is the payload only', JSON.parse(Buffer.from(JSON.parse(calls[0].init.body).content, 'base64').toString()).id === 'x');
  check('replies allow any origin and carry no token', r.headers.get('Access-Control-Allow-Origin') === '*' && !(await r.text()).includes('secret'));
  r = await post({ kind: 'flight', payload: { format: 'something/1' } }); check('other formats are refused', r.status === 400);
  r = await post({ kind: 'src', payload: { format: 'pro-whooper-flight/1' } }); check('other kinds are refused', r.status === 400);
  r = await post('nope'); check('non-JSON is refused', r.status === 400);
  r = await post({ kind: 'feedback', payload: { format: 'pro-whooper-feedback/1', text: 'github_pat_' + 'A'.repeat(40) } }); check('anything that looks like a token is refused', r.status === 400);
  r = await post({ kind: 'feedback', payload: { format: 'pro-whooper-feedback/1', text: 'x'.repeat(1600000) } }); check('oversized uploads are refused', r.status === 413);
  r = await handle(new Request('https://drop/', { method: 'GET' }), env, gh); check('only POST', r.status === 405);
  check('nothing else reached GitHub', calls.length === 1);
  console.log(`\n${ok}/${n} drop-off checks`); process.exitCode = ok === n ? 0 : 1;
})();
