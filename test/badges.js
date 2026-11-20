// Review badges (owner, 2026-11-20): the relay counts one review per decided moment a pilot sends (own runs too), once however
// often it is re-sent; GET /badges lists them; the game draws a pixel Skittle per tier (25 / 50 / 100 / 250 / 500 / 1000).
// usage: node test/badges.js
(async () => {
  const { handle, reviewMoments, badgeName } = await import('../tools/dropoff-worker.mjs');
  let ok = 0, n = 0; const check = (name, pass, got = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(64)} ${got}`); };
  const kv = new Map(), KV = { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, v); } };
  const env = { GITHUB_TOKEN: 'secret', GITHUB_REPO: 'o/r', BADGES: KV }, GAME = 'https://heyheykoolaid.github.io', gh = async () => ({ ok: true, status: 200, json: async () => ({}) });
  let ip = 0; const post = body => handle(new Request('https://drop/', { method: 'POST', headers: { Origin: GAME, 'CF-Connecting-IP': '2.2.2.' + (++ip) }, body: JSON.stringify(body) }), env, gh);
  const get = async () => JSON.parse(await (await handle(new Request('https://drop/badges', { method: 'GET', headers: { Origin: GAME } }), env, gh)).text());
  const L = (t, o = {}) => ({ target: 'Flip', actual: 'Flip', verdict: 'yes', t, ...o });
  const labels = (name, flight, ls) => ({ kind: 'labels', payload: { format: 'pro-whooper-flight-labels/1', build: '0.1', flight, started: '2026-11-20T00:00:00Z', pilot: 'p' + name, name, labels: ls } });

  check('decided moments count, undecided ones do not', reviewMoments([L(1), L(5), L(9, { undone: true, verdict: 'unlabelled', actual: null }), L(12, { verdict: 'no', actual: 'not a trick' })]).length === 3);
  check('a tile of three tricks on one moment is one review', reviewMoments([L(4), L(4.2, { actual: 'Roll' }), L(4.4, { actual: 'Matty Flip' })]).length === 1);
  check("a reviewer label counts for the reviewer, not the run's pilot", badgeName({ name: 'RodFPV', labels: [L(1, { by: 'heyheykoolaid', reviewer: true })] }) === 'heyheykoolaid');
  let r = await post(labels('Rod', 'f1', [L(1), L(5), L(9)])); let b = await get();
  check('labels sent: the pilot has 3 reviews', r.status === 200 && b.n.rod && b.n.rod[1] === 3, JSON.stringify(b.n.rod));
  await post(labels('Rod', 'f1', [L(1), L(5), L(9), L(14)])); b = await get();
  check('the same review sent again counts once (only the new moment adds)', b.n.rod[1] === 4, JSON.stringify(b.n.rod));
  await post(labels('Rod', 'f2', [L(1)])); b = await get();
  check('the same second of another flight is a new review', b.n.rod[1] === 5, JSON.stringify(b.n.rod));
  check('the list says when the count began', Number.isFinite(b.since));
  r = await handle(new Request('https://drop/badges', { method: 'GET', headers: { Origin: GAME } }), { GITHUB_TOKEN: 's', GITHUB_REPO: 'o/r' }, gh);
  check('with no KV bound the relay says so (the game keeps the built-in counts)', r.status === 404);
  console.log(`\n${ok}/${n} badge checks`);
})();
