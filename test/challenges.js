// Trick challenges (owner, 2026-11-23; src/challenge.js): the name word list (the game's and the relay's copies give the same
// answers), the detector matching a move against a posted one (a try anywhere, a confirmed one only where nothing else was called),
// the community line on the score, and the relay's challenge files, board and owner moderation. node test/challenges.js
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim, world = S.buildPlayground(), X = S.v3(1, 0, 0);
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const fake = () => { const d = Object.create(S.Drone.prototype); d.pos = S.v3(0, 4, 8); d.vel = S.v3(); d.q = { w: 1, x: 0, y: 0, z: 0 }; d.w = S.v3(); d.armed = true; d.crashed = false; d.contactThisStep = false; return d; };
// attitude-only moves at a fixed spot away from obstacles: [axis, deg/s, seconds]
const seq = steps => { const pos = S.v3(0, 4, 8); return t => { let q = { w: 1, x: 0, y: 0, z: 0 }, w = S.v3(), t2 = t - 0.5; if (t2 < 0) return { pos, q, w };
  for (const [ax, rate, dur] of steps) { const a = ax === 'P' ? X : ax === 'R' ? S.v3(0, 0, -1) : S.v3(0, -1, 0), dd = Math.min(t2, dur); if (dd > 0) q = S.qnorm(S.qmul(q, S.qaxis(a, rate * S.D2R * dd))); if (t2 < dur) { w = S.mul(a, rate * S.D2R); return { pos, q, w }; } t2 -= dur; }
  return { pos, q, w: S.v3() }; }; };
const fly = (gen, T) => { const det = new S.TrickDetector(world), d = fake(), dt = 0.001, got = [], ch = [];
  for (let t = 0; t < T; t += dt) { const s = gen(t); d.pos = s.pos; d.q = s.q; d.w = s.w; det.update(d, dt); for (const e of det.drain()) if (e.name !== 'near') got.push(e.name); for (const c of det.drainChallenges()) ch.push(c); }
  return { det, got, ch }; };
const len = st => st.reduce((a, x) => a + x[2], 0);
const YRY = [['Y', 600, 0.3], ['R', 700, 0.26], ['Y', 600, 0.3]], YRY2 = [['Y', 560, 0.33], ['R', 680, 0.27], ['Y', 640, 0.28]], FLIP = [['P', 800, 0.45]], ROLL = [['R', 900, 0.4]];

(async () => {
  // ---- names
  const { badName: relayBad, challengesFrom, handle } = await import('../tools/dropoff-worker.mjs');
  const bad = ['fuck flip', 'F.U.C.K', 'fuuuuck', 'f u c k loop', 'sh1t roll', '5h!t', 'ass flip', 'A55 roll', 'c0ck', 'n1gg3r', 's e x', 'B1tch loop', 'Fvck', 'kys', 'KKK flip', 'pussy', 'puuussy', 'b00bs', 'faggot', 'Big Dick Energy', 'a s s'];
  const good = ['Push It', 'Bob Loop', 'Sky Scraper Flip', 'Cocoon Roll', 'Grape Flip', 'Torpedo', 'Assassin Loop', 'Basement Dive', 'Manuscript', 'Therapist', 'Classic Flip', 'Hitchcock', 'Nutella', 'FC Kickflip', 'Dead Pirate', 'Bum Dart', 'Analog Spin', 'Spice Roll', 'Glass Roll', 'Bass Drop', 'Matty Twister', 'Juicy Tornado', "Rod's Rewind"];
  const missed = bad.filter(x => !S.badName(x)), wrong = good.filter(x => S.badName(x));
  check('the word list catches swears through l33t-speak, spacing, dots and stretched letters', !missed.length, missed.join(', '));
  check('ordinary trick names pass (cocoon, grape, torpedo, assassin, basement, push it…)', !wrong.length, wrong.join(', '));
  const all = [...bad, ...good, 'FUCK', 'sh!+', 'Ünïcödé Flip', '', null, 'tit', 'titanium', 'hoes', 'shoes'], diff = all.filter(x => S.badName(x) !== relayBad(x));
  check('the relay\'s copy of the word list gives the same answers as the game\'s', !diff.length, diff.join(', '));

  // ---- the detector
  S.setChallenges(null);
  { const r = fly(seq(YRY), 6); check('without challenges nothing is said', !r.ch.length); }
  // measure the move as the game would when it is posted (the library's ear runs only when there is something to listen for)
  S.setChallenges([{ id: 'measure', name: 'Measure', try: true, sig: { d: 1, c: new Array(72).fill(4000) } }]);
  const base = fly(seq(YRY), 4), sig = base.det.libSigOf(0.4, 0.5 + len(YRY) + 0.1);
  check('a move with no book trick in it is measured (a signature) and called nothing', !!sig && !base.got.length, base.got.join(','));
  S.setChallenges([{ id: 'c1', name: 'Yaw Roll Yaw', try: true, sig }]);
  { const r = fly(seq(YRY2), 6); check('trying it: the same move flown a little differently passes', r.ch.length === 1 && r.ch[0].try && r.ch[0].chal === 'c1' && r.ch[0].dist <= S.CH_PASS, r.ch.map(c => c.dist).join(',')); }
  { const r = fly(seq(FLIP), 6); check('trying it: a flip does not pass', !r.ch.length, r.ch.map(c => c.dist).join(',')); }
  S.setChallenges([{ id: 'c1', name: 'Yaw Roll Yaw', live: true, sig, pts: 300 }]);
  { const r = fly(seq(YRY2), 6); check('confirmed: called where nothing else was, with its points', r.ch.length === 1 && r.ch[0].live && r.ch[0].pts === 300); }
  // a confirmed one that is really a flip is never called over the game's own Flip call
  S.setChallenges([{ id: 'measure', name: 'Measure', try: true, sig: { d: 1, c: new Array(72).fill(4000) } }]);
  const fl = fly(seq(FLIP), 4), fsig = fl.det.libSigOf(0.4, 0.5 + len(FLIP) + 0.1);
  S.setChallenges([{ id: 'c2', name: 'Not A Flip', live: true, sig: fsig }]);
  { const r = fly(seq(FLIP), 6); check('confirmed: not called where the rules called a book trick (no double points)', r.got.includes('Flip') && !r.ch.length, r.got.join(',')); }
  S.setChallenges([{ id: 'c3', name: 'Fuck Flip', live: true, sig }, { id: '../x', name: 'Bad Id', live: true, sig }, { id: 'c4', name: 'No Sig', live: true, sig: { d: 1, c: [1, 2] } }]);
  check('setChallenges drops bad names, bad ids and broken signatures', S.challenges === null);
  S.setChallenges([{ id: 'c1', name: 'Yaw Roll Yaw', try: true, sig }]);
  { const R = S.replayTrace([[0, 0, 4, 8, 1, 0, 0, 0, 0, 0, 0, 0.3, 0, 1, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 4, 8, 1, 0, 0, 0, 0, 0, 0, 0.3, 0, 1, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0]], { world, debug: false }); check('replayTrace returns the challenge hits too', Array.isArray(R.chals)); }
  S.setChallenges(null);

  // ---- the score line
  { const sk = new S.ScoreKeeper(); const t0 = sk.total, a = sk.community('Yaw Roll Yaw', 200), b = sk.community('Yaw Roll Yaw', 200);
    check('a community trick scores on its own line, halved when repeated in a combo', a.pts === 200 && b.pts === 100 && sk.commBonus === 300 && sk.commN === 2 && sk.total === t0 + 300 && sk.trickScore === 0);
    sk.chainBreak(); const c = sk.community('Yaw Roll Yaw', 200); check('a new combo starts it fresh', c.pts === 200); }

  // ---- the relay
  const pack = { enc: 'cols-delta-varint/1+deflate', hz: 100, cols: ['t', 'x'], rows: 300, data: 'AAAA' };
  const chal = (x = {}) => ({ format: 'pro-whooper-challenge/1', name: 'Yaw Roll Yaw', by: 'Tester', pilot: 'pabc123', map: 'moose', at: '2026-11-23T00:00:00Z', sig: { d: sig.d, c: sig.c, u: sig.u, ps: '' }, t0: 2.5, t1: 3.4, camTilt: 25, trace: pack, ...x });
  const calls = [], gh = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) }; };
  const env = { GITHUB_TOKEN: 'secret', GITHUB_REPO: 'o/r', OWNER_KEY: 'a long owner key here' }, GAME = 'https://heyheykoolaid.github.io';
  let ip = 10; const post = (body, path = '/') => handle(new Request('https://drop' + path, { method: 'POST', headers: { Origin: GAME, 'CF-Connecting-IP': '9.9.9.' + (ip++) }, body: JSON.stringify(body) }), env, gh);
  let r = await post({ kind: 'challenge', payload: chal() });
  const file = calls.length ? calls[0].url.split('/contents/')[1] : '';
  check('a challenge is stored under challenges/ with its name, pilot and map in the file name', r.status === 200 && /^challenges\/\d+\.pabc123\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.moose\.json$/.test(file), file);
  const id = file.replace(/^challenges\//, '').replace(/\.json$/, '');
  calls.length = 0; r = await post({ kind: 'challenge', payload: chal({ name: 'Sh1t Flip' }) }); check('a bad name is refused by the relay', r.status === 400 && !calls.length);
  calls.length = 0; r = await post({ kind: 'challenge', payload: chal({ by: 'Fuck You' }) }); check('a bad pilot name is refused too', r.status === 400 && !calls.length);
  calls.length = 0; r = await post({ kind: 'challenge', payload: chal({ sig: { d: 1, c: [1] } }) }); check('a broken signature is refused', r.status === 400);
  calls.length = 0; r = await post({ kind: 'chtry', payload: { format: 'pro-whooper-challenge-try/1', challenge: id, by: 'Other', pilot: 'pother1', map: 'clappy', dist: 0.12, sig: chal().sig, t0: 2.5, t1: 3.4, trace: pack } });
  const tf = calls.length ? calls[0].url.split('/contents/')[1] : ''; check('a try is stored under challenge-tries/ named for its challenge', r.status === 200 && tf.startsWith(`challenge-tries/${id}~`), tf);
  calls.length = 0; r = await post({ kind: 'chtry', payload: { format: 'pro-whooper-challenge-try/1', challenge: '../../x', by: 'Other', pilot: 'pother1', map: 'clappy', dist: 0.1, sig: chal().sig, trace: pack } }); check('a try at no real challenge id is refused', r.status === 400);
  // the board from file names
  const b64 = s => Buffer.from(s).toString('base64url'), T = (pilot, by, t) => `${id}~${1795000000000 + t}.${pilot}.${b64(by)}.json`;
  let B = challengesFrom([id + '.json'], [T('pabc123', 'Someone', 1), T('pzzz999', 'tester', 2), T('pone111', 'One', 3), T('pone111', 'One again', 4)], []);
  check('the creator never counts (by pilot id or by name), each pilot counts once', B[0].n === 1 && B[0].passed[0] === 'One' && !B[0].confirmed, JSON.stringify(B[0].passed));
  B = challengesFrom([id + '.json'], [T('pone111', 'One', 3), T('ptwo222', 'Two', 5)], []);
  check(`${S.CH_CONFIRM} other pilots confirm it, at 200 points by default`, B[0].confirmed && B[0].n === 2 && B[0].pts === 200);
  B = challengesFrom([id + '.json'], [], [`${id}~name~${b64('Dizzy Twist')}~1795000000010.json`, `${id}~pts~350~1795000000011.json`]);
  check('the owner can rename it and set its points', B[0].name === 'Dizzy Twist' && B[0].pts === 350);
  B = challengesFrom([id + '.json'], [], [`${id}~name~${b64('Fuck Twist')}~1795000000010.json`]); check('a rename to a bad name is ignored', B[0].name === 'Yaw Roll Yaw');
  B = challengesFrom([id + '.json'], [T('pone111', 'One', 3)], [`${id}~hide~0~1795000000010.json`]); check('hidden: no name and no passers on the board', B[0].hidden && B[0].name === '' && !B[0].passed.length);
  B = challengesFrom([id + '.json'], [], [`${id}~hide~0~1795000000010.json`, `${id}~show~0~1795000000012.json`]); check('shown again: the newest wins', !B[0].hidden && B[0].name === 'Yaw Roll Yaw');
  calls.length = 0; r = await post({ key: 'wrong', id, op: 'hide' }, '/chmod'); check('hiding needs the owner key', r.status === 403 && !calls.length);
  r = await post({ key: env.OWNER_KEY, id, op: 'pts', pts: 450 }, '/chmod'); const mf = calls.length ? calls[0].url.split('/contents/')[1] : '';
  check('the owner key writes a moderation file', r.status === 200 && new RegExp(`^challenge-mod/${id.replace(/[.]/g, '\\.')}~pts~450~\\d+\\.json$`).test(mf), mf);
  calls.length = 0; r = await post({ key: env.OWNER_KEY, id, op: 'name', name: 'Sh!t Twist' }, '/chmod'); check('the owner cannot rename to a bad name either', r.status === 400 && !calls.length);
  // GET /challenges reads three folder listings, nothing else
  const gets = [], ghList = async url => { gets.push(url); const f = url.includes('/contents/challenges?') ? [{ type: 'file', name: id + '.json' }] : url.includes('/contents/challenge-tries?') ? [{ type: 'file', name: T('pone111', 'One', 3) }] : [];
    return { ok: true, status: 200, json: async () => f }; };
  r = await handle(new Request('https://drop/challenges', { headers: { Origin: GAME, 'CF-Connecting-IP': '8.8.8.8' } }), env, ghList); const j = await r.json();
  check('GET /challenges: the board from three listings', r.status === 200 && j.challenges.length === 1 && j.challenges[0].n === 1 && gets.length === 3 && j.confirm === S.CH_CONFIRM, gets.length + ' requests ' + JSON.stringify(j).slice(0, 300));
  console.log(`\n${ok}/${n} challenge checks`);
})();
