// The drop-off relay: only the game's own formats from the game's own address, files named by the relay, no tokens,
// rate limits, and nothing leaks back. node test/dropoff.js
(async () => {
  const { handle } = await import('../tools/dropoff-worker.mjs');
  let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
  const calls = [], gh = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({ sha: 'abc' }) }; };
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
  // ---- daily leaderboard
  { const { boardFrom, scoreFile } = await import('../tools/dropoff-worker.mjs');
    const sc = (extra = {}) => ({ format: 'pro-whooper-score/1', name: 'Tester One', pilot: 'abc123xyz', score: 12345, map: 'school', mode: 'session', sheet: [{ name: 'Flip', exec: 'CLEAN', net: 50 }], ...extra });
    const n0 = calls.length; r = await post({ kind: 'score', payload: sc({ evil: 1 }) }, { ip: '7.7.7.1' });
    const url = calls[calls.length - 1].url.split('/contents/')[1];
    check('a posted score is filed under leaderboard/<day>/ with the board entry in its name', r.status === 200 && calls.length === n0 + 1 && /^leaderboard\/\d{4}-\d\d-\d\d\/00012345-school-[A-Za-z0-9_-]+-abc123xyz-\d+\.json$/.test(url), url);
    for (const [why, bad] of [['a free-fly score', { mode: 'free' }], ['a silly score', { score: 99999999 }], ['a fractional score', { score: 1.5 }], ['a name with markup', { name: '<img src=x>' }], ['a path as the map', { map: '../x' }], ['an odd pilot id', { pilot: '../../x' }]]) { r = await post({ kind: 'score', payload: sc(bad) }, { ip: '7.7.7.2' }); check(`${why} is refused`, r.status === 400); }
    const names = [scoreFile(sc(), 1794930000000), scoreFile(sc({ score: 20000 }), 1794930001000), scoreFile(sc({ name: 'Other', pilot: 'zzzzzz1', score: 15000 }), 1794930002000), scoreFile(sc({ map: 'playground', score: 7 }), 1794930003000), '../../secret.json', 'README.md', '00000001-school-PGI-!!!-1.json'];
    const B = boardFrom(names); check('the board is each pilot\'s best per map, highest first, junk ignored', B.length === 3 && B[0].score === 20000 && B[0].name === 'Tester One' && B[1].name === 'Other' && B[2].map === 'playground', JSON.stringify(B.map(e => [e.name, e.score, e.map])));
    const ghList = async (url, init) => { calls.push({ url, init }); if (/contents\/leaderboard\/\d{4}-\d\d-\d\d\?/.test(url)) return { ok: true, status: 200, json: async () => names.map(n => ({ type: 'file', name: n, download_url: 'https://secret', sha: 'x' })) };
      if (url.includes('/contents/leaderboard/')) return { ok: true, status: 200, text: async () => JSON.stringify({ ...sc(), secretField: 'nope' }) }; return { ok: false, status: 404 }; };
    const get = (path, o = {}) => handle(new Request('https://drop' + path, { method: 'GET', headers: { Origin: GAME, 'CF-Connecting-IP': o.ip || '9.9.9.' + (n + 1) } }), env(), ghList);
    r = await get('/board'); const jb = await r.json(); check('GET /board answers with names and scores only', r.status === 200 && jb.runs.length === 3 && !JSON.stringify(jb).includes('secret') && Object.keys(jb.runs[0]).sort().join() === 'at,id,map,name,score');
    r = await get('/board?day=../../x'); check('a bad day is refused', r.status === 400);
    r = await get('/board?day=2026-01-01'); check('earlier days cannot be read (no history)', r.status === 400);
    r = await get('/run?day=2026-01-01&id=' + B[0].id); check('nor can a run from an earlier day', r.status === 400);
    const TODAY = new Date().toISOString().slice(0, 10);
    r = await get('/run?day=' + TODAY + '&id=' + B[0].id); const jr = await r.json(); check('GET /run returns one posted run, known fields only', r.status === 200 && jr.score === 12345 && !('secretField' in jr));
    for (const bad of ['../../telemetry/inbox/flight/x', 'README', '00012345-school-VGVzdGVy-abc123xyz-1794930000000/../../x']) { const m = calls.length; r = await get('/run?day=' + TODAY + '&id=' + encodeURIComponent(bad)); check(`GET /run cannot be pointed at "${bad.slice(0, 24)}…"`, r.status === 400 && calls.length === m); }
    r = await get('/'); check('any other GET is refused', r.status === 405); }
  // ---- video reviews (measured motion + labels; never the video)
  { const vid = (extra = {}) => ({ format: 'pro-whooper-video/1', file: 'my-private-file-name.mp4', duration: 12, frames: Array.from({ length: 40 }, (_, i) => [i / 30, 0, 0, 1]), marks: [{ t: 1, kind: 'U' }], labels: [{ verdict: 'added', actual: 'Roll', t0: 1, t1: 2 }], name: 'Tester', pilot: 'abc123xyz', ...extra });
    const n0 = calls.length; r = await post({ kind: 'video', payload: vid() }, { ip: '7.7.8.1' }); const st = JSON.parse(Buffer.from(JSON.parse(calls[calls.length - 1].init.body).content, 'base64').toString());
    check('a video review is stored under telemetry/inbox/video/, without the file name', r.status === 200 && calls.length === n0 + 1 && /telemetry\/inbox\/video\//.test(calls[calls.length - 1].url) && !('file' in st) && st.frames.length === 40);
    r = await post({ kind: 'video', payload: vid({ frames: [[0, 'x', 0, 0]] }) }, { ip: '7.7.8.2' }); check('frames that are not numbers are refused', r.status === 400);
    r = await post({ kind: 'video', payload: vid({ frames: Array.from({ length: 6001 }, () => [0, 0, 0, 0]) }) }, { ip: '7.7.8.3' }); check('an over-long clip is refused', r.status === 400); }
  { // community maps: a pilot's own map, shared by their click, listed and read back through the relay only
    const { mapsFrom } = await import('../tools/dropoff-worker.mjs');
    const mp = (x = {}) => ({ format: 'pro-whooper-map/1', name: "Rod's park", by: 'RodFPV', pilot: 'abc1234', base: 'moose', moved: { 'Cedar@1,2': { dx: 1, dy: 0, dz: 0, ry: 5, s: 1 } }, removed: ['Bench@3,4'], added: [{ asset: 'Pole', x: 1, y: 0, z: 2 }], ...x });
    const n0 = calls.length; let r = await post({ kind: 'map', payload: mp() }, { ip: '8.8.1.1' }); const last = calls[calls.length - 1];
    check('a shared map is filed under maps/community/<base>/ by the relay', r.status === 200 && calls.length === n0 + 1 && /contents\/maps\/community\/moose\/\d+\.abc1234\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.json$/.test(last.url), last.url.split('contents/')[1]);
    r = await post({ kind: 'map', payload: mp({ moved: { a: { dx: 1, evil: 1, b: 2, c: 3, d: 4, e: 5 } } }) }, { ip: '8.8.1.3' }); check('a moved piece with extra fields is refused', r.status === 400);
    r = await post({ kind: 'map', payload: mp({ name: '<img onerror=x>' }) }, { ip: '8.8.1.4' }); check('a map name with markup is refused', r.status === 400);
    r = await post({ kind: 'map', payload: mp({ base: '../../src' }) }, { ip: '8.8.1.5' }); check('a base outside the maps is refused', r.status === 400);
    const L = mapsFrom(['1794972722171.abc1234.Um9kJ3MgcGFyaw.Um9kRlBW.json', '1794972000000.abc1234.Um9kJ3MgcGFyaw.Um9kRlBW.json', 'junk.json']);
    check('the list shows each pilot\'s map once (newest), with its name and maker', L.length === 1 && L[0].name === "Rod's park" && L[0].by === 'RodFPV' && L[0].at === 1794972722171);
    r = await handle(new Request('https://drop/map?base=moose&id=../../secrets', { headers: { Origin: GAME } }), env(), gh); check('reading a map needs a map file name', r.status === 400); }
  { // official map layouts: only with the owner key, only maps/official/<map>.json in the game repo
    const KEY = 'correct horse battery staple', oenv = () => ({ ...env(), OWNER_KEY: KEY }), lay = { moved: { 'Cedar@1,2': { dx: 1, dy: 0, dz: 0, ry: 0, s: 1 } }, removed: [], added: [{ asset: 'Pole', x: 1, y: 0, z: 1 }] };
    const pub = (body, o = {}) => handle(new Request('https://drop/official', { method: 'POST', headers: { Origin: o.origin ?? GAME, 'CF-Connecting-IP': o.ip || '9.9.9.9' }, body: JSON.stringify(body) }), o.env || oenv(), gh);
    const n0 = calls.length; let r = await pub({ key: 'guess', map: 'moose', ...lay }, { ip: '9.9.0.1' });
    check('a wrong owner key is refused and nothing is written', r.status === 403 && calls.length === n0);
    r = await pub({ key: KEY, map: 'moose', by: 'heyheykoolaid', ...lay, evil: 'x' }, { ip: '9.9.0.2' }); const put = calls.filter(c => c.init && c.init.method === 'PUT').pop();
    check('the owner key publishes maps/official/<map>.json to the game repo', r.status === 200 && /repos\/heyheykoolaid\/openprowhooper\/contents\/maps\/official\/moose\.json$/.test(put.url), put && put.url);
    const body = JSON.parse(atob(JSON.parse(put.init.body).content)); check('only the layout is written (no stray fields, no key)', body.format === 'pro-whooper-mapedit/1' && body.added.length === 1 && !('evil' in body) && !JSON.stringify(body).includes(KEY));
    r = await pub({ key: KEY, map: '../../src', ...lay }, { ip: '9.9.0.3' }); check('a map name outside maps/official is refused', r.status === 400);
    for (let i = 0; i < 5; i++) await pub({ key: 'nope' + i, map: 'moose', ...lay }, { ip: '9.9.0.4' });
    r = await pub({ key: KEY, map: 'moose', ...lay }, { ip: '9.9.0.4' }); check('after 5 wrong keys an address waits an hour (even with the right key)', r.status === 429);
    r = await pub({ key: KEY, map: 'moose', ...lay }, { ip: '9.9.0.5', env: env() }); check('without OWNER_KEY set, publishing is closed', r.status === 503);
    r = await pub({ key: KEY, map: 'moose', ...lay }, { ip: '9.9.0.6', origin: 'https://evil.example' }); check('other websites cannot publish', r.status === 403); }

  { // RaceGOW: shared tracks, best laps and their ghosts
    require('../src/tricks.js'); require('../src/sim.js'); const RG = require('../src/racegow.js');
    const T = RG.cleanTrack(RG.newTrack({ name: 'Couch Loop', by: 'Tester' })); T.elements.push(RG.newElement('gateSquare', { z: -1 }), RG.newElement('gateCircle', { x: 1, z: -2 }));
    const tp = (o = {}) => ({ ...JSON.parse(JSON.stringify(RG.cleanTrack(T))), by: 'Tester', pilot: 'abc1234', ...o });
    let n0 = calls.length, r = await post({ kind: 'track', payload: tp() }, { ip: '7.7.0.1' }); const last = calls[calls.length - 1];
    check('a shared track is filed under tracks/ by the relay', r.status === 200 && calls.length === n0 + 1 && /contents\/tracks\/\d+\.abc1234\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.json$/.test(last.url), last.url.split('contents/')[1]);
    r = await post({ kind: 'track', payload: tp({ name: '<img src=x onerror=alert(1)>' }) }, { ip: '7.7.0.2' }); check('a track name with markup is refused', r.status === 400);
    r = await post({ kind: 'track', payload: tp({ elements: [{ id: 'a', type: 'gate<script>', x: 0 }] }) }, { ip: '7.7.0.3' }); check('an element type that is not a word is refused', r.status === 400);
    r = await post({ kind: 'track', payload: tp({ elements: [{ id: 'a', type: 'wall', p: { mat: { evil: 1 } } }] }) }, { ip: '7.7.0.4' }); check('element settings must be numbers or words', r.status === 400);
    r = await post({ kind: 'track', payload: tp({ venue: { kind: 'map', map: '../../src' } }) }, { ip: '7.7.0.5' }); check('a venue outside the maps is refused', r.status === 400);
    const sm = []; for (let i = 0; i < 90; i++) sm.push({ t: i / 30, p: { x: i * 0.05, y: 0.5, z: 0 }, q: { w: 1, x: 0, y: 0, z: 0 } }); const ghost = RG.packGhost(sm), h = RG.trackHash(T);
    const lp = (o = {}) => ({ format: 'pro-whooper-racetime/1', name: 'Tester', pilot: 'abc1234', track: h, trackName: 'Couch Loop', lap: 9123, ghost, ...o });
    n0 = calls.length; r = await post({ kind: 'racetime', payload: lp() }, { ip: '7.7.1.1' }); const lt = calls[calls.length - 1];
    check('a best lap is filed under racetimes/<track hash>/ with the lap in its name', r.status === 200 && new RegExp(`contents/racetimes/${h}/00009123-[A-Za-z0-9_-]+-abc1234-\\d+\\.json$`).test(lt.url), lt.url.split('contents/')[1]);
    r = await post({ kind: 'racetime', payload: lp({ lap: 12.5 }) }, { ip: '7.7.1.2' }); check('a lap must be whole milliseconds', r.status === 400);
    r = await post({ kind: 'racetime', payload: lp({ track: '../x' }) }, { ip: '7.7.1.3' }); check('a track hash that is not a hash is refused', r.status === 400);
    r = await post({ kind: 'racetime', payload: lp({ ghost: { hz: 30, n: 2, d: [1, 2, 3] } }) }, { ip: '7.7.1.4' }); check('a ghost whose size does not add up is refused', r.status === 400);
    const { lapsFrom, trackFile } = await import('../tools/dropoff-worker.mjs'), b = s => Buffer.from(s).toString('base64url');
    const L = lapsFrom([`00009000-${b('Ann')}-aaaaaa1-1700000000000.json`, `00008000-${b('Ann')}-aaaaaa1-1700000000001.json`, `00009500-${b('Bob')}-bbbbbb2-1700000000002.json`, 'junk.json', `00001000-${b('X')}-../etc-1.json`]);
    check('the race board is each pilot\'s best, fastest first, from file names alone', L.length === 2 && L[0].name === 'Ann' && L[0].lap === 8000 && L[1].name === 'Bob');
    // reading: lists and single files go through the same checks again
    const files = { 'tracks': [{ type: 'file', name: trackFile({ pilot: 'abc1234', name: 'Couch Loop', by: 'Tester' }, 1700000000000) }], [`racetimes/${h}`]: [{ type: 'file', name: `00009123-${b('Tester')}-abc1234-1700000000000.json` }] };
    const ghr = async url => { const m = /contents\/(.*?)\?/.exec(url), path = m && m[1]; if (files[path]) return { ok: true, status: 200, json: async () => files[path] };
      if (path && path.startsWith('tracks/')) return { ok: true, status: 200, text: async () => JSON.stringify({ ...tp(), evil: '<script>' }) };
      if (path && path.startsWith('racetimes/')) return { ok: true, status: 200, text: async () => JSON.stringify(lp()) }; return { ok: false, status: 404 }; };
    const get = (u, ip) => handle(new Request('https://drop' + u, { headers: { Origin: GAME, 'CF-Connecting-IP': ip || '6.6.6.' + n } }), env(), ghr);
    r = await get('/tracks'); let j = await r.json(); check('GET /tracks lists shared tracks by name and pilot', r.status === 200 && j.tracks.length === 1 && j.tracks[0].name === 'Couch Loop' && j.tracks[0].by === 'Tester');
    r = await get('/track?id=' + j.tracks[0].id); j = await r.json(); check('GET /track returns one track, unknown fields dropped', r.status === 200 && j.name === 'Couch Loop' && !('evil' in j) && j.elements.length === 3);
    r = await get('/track?id=../../secrets'); check('reading a track needs a track file name', r.status === 400);
    r = await get('/raceboard?track=' + h); j = await r.json(); check('GET /raceboard lists the laps of that track', r.status === 200 && j.times.length === 1 && j.times[0].lap === 9123);
    r = await get(`/ghost?track=${h}&id=${j.times[0].id}`); j = await r.json(); check('GET /ghost returns the lap with its ghost', r.status === 200 && j.ghost && j.ghost.n === 90);
    r = await get(`/ghost?track=zzzzzz9&id=00009123-${b('Tester')}-abc1234-1700000000000`); check('a ghost filed under another track is not served', r.status === 404); }
  console.log(`\n${ok}/${n} drop-off checks`); process.exitCode = ok === n ? 0 : 1;
})();
