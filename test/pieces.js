// Long runs are sent in pieces and idle time is squeezed out (src/dropoff.js telSpill / telSqueeze; owner, 2026-11-19).
// The helpers live in the game module, so this lifts their block out of dropoff.js and runs it against small stand-ins.
const fs = require('fs'), path = require('path'), R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'src/dropoff.js'), 'utf8'), a = src.indexOf('const IDLE_CUT'), b = src.indexOf('window.__pw.telSqueeze');
const FlightLog = require(path.join(R, 'src/flightlog.js'));
const TRACE_HZ = 100, RECAP_MAX = 48000, TRACE_COLS = Array.from({ length: 27 }, (_, i) => 'c' + i);
const tel = { on: true }, TEL = { minArmed: 10, perDay: 40, minSeconds: 20 }, sent = [], st = {}, store = { get: (k, d) => st[k] ?? d, set: (k, v) => { st[k] = v; } };
const recap = { id: 'abc', started: '2026-11-19T00:00:00.000Z', events: [], flags: [], trace: [], spill: null, pieces: [], pieceN: 0, telUpTo: -Infinity, mode: 'free' };
const anonOn = () => false, telPilot = () => 'p1', pilotName = () => 'x', tune = {}, spec = {}, params = {}, inputCfg = {}, MAP_ID = 'moose', MAP_EDITS = null, S = { officialEdits: () => null }, feelSnap = () => ({}), telStamp = r => r.started + '-' + r.id;
const telQueue = async (k, id, h) => { sent.push(h); };
void [FlightLog, TRACE_COLS, tel, TEL, store, anonOn, telPilot, pilotName, tune, spec, params, inputCfg, MAP_ID, MAP_EDITS, S, feelSnap, telStamp, telQueue];
const H = new Function(...'FlightLog TRACE_HZ RECAP_MAX TRACE_COLS tel TEL store recap anonOn telPilot pilotName tune spec params inputCfg MAP_ID MAP_EDITS S feelSnap telStamp telQueue'.split(' '),
  src.slice(a, b) + '\nreturn { rowActive, telSqueeze, telSpill, telSpillEnd, telPieceSend };')(FlightLog, TRACE_HZ, RECAP_MAX, TRACE_COLS, tel, TEL, store, recap, anonOn, telPilot, pilotName, tune, spec, params, inputCfg, MAP_ID, MAP_EDITS, S, feelSnap, telStamp, telQueue);
let ok = 0, n = 0; const check = (name, pass, got) => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(66)} ${got}`); };
let t = 0; const row = act => { const r = new Array(27).fill(0); r[0] = +(t += 0.01).toFixed(2); r[13] = act ? 1 : 0; if (act) { r[21] = 3; r[8] = 200; } return r; };
const push = r => { recap.trace.push(r); if (recap.trace.length > RECAP_MAX) H.telSpill(recap.trace.shift()); };
const seg = (sec, act) => { for (let i = 0; i < sec * 100; i++) push(row(act)); };
(async () => {
  // 5 min flying, a 20 s pause, 5 min, walk away 2 hours, 10 min, a 6 s pause, 10 min: 30 min of flying in all
  seg(300, 1); seg(20, 0); seg(300, 1); seg(7200, 0); seg(600, 1); seg(6, 0); seg(600, 1); H.telSpillEnd();
  const P = recap.pieces.slice(), secs = P.reduce((s, p) => s + p.rows.length, 0) / 100;
  check('flying before the last 8 minutes goes out in pieces of 8 minutes at most', P.length === 3 && P.every(p => p.rows.length <= RECAP_MAX), P.map(p => p.rows.length / 100 + ' s').join(', '));
  check('idle stretches over 15 s are cut out (1 s kept each side), short ones stay', secs === 1330 && P[0].gaps.length === 1 && P[1].gaps.length === 1, `${secs} s kept, gaps ${P.map(p => p.gaps.length)}`);
  for (const p of recap.pieces.splice(0)) await H.telPieceSend(p);
  check('each piece is its own flight, saying what it is a piece of', sent.length === 3 && sent.every((h, i) => h.id === 'abc.p' + (i + 1) && h.summary.piece.of === 'abc' && h.trace), sent.map(h => h.id).join(' '));
  recap.trace = []; recap.spill = null; recap.pieces = []; t = 0; seg(5, 1); for (let i = 0; i < 3 * 3600 * 100; i++) push(row(0)); H.telSpillEnd();
  const s2 = H.telSqueeze(recap.trace);
  check('the sim left open: nothing kept, nothing sent', recap.pieces.length === 0 && s2.rows.length === 0 && !recap.spill, `${recap.pieces.length} pieces, ${s2.rows.length} rows`);
  t = 0; const tr = [...Array(500)].map(() => row(0)).concat([...Array(3000)].map(() => row(1)), [...Array(2000)].map(() => row(0)), [...Array(3000)].map(() => row(1)), [...Array(800)].map(() => row(0)));
  const s3 = H.telSqueeze(tr);
  check('the last 8 minutes: leading, middle and trailing idle squeezed (cuts listed)', s3.rows.length === 100 + 3000 + 200 + 3000 + 100 && s3.gaps.length === 2, `${s3.rows.length / 100} s, ${s3.gaps.length} gap`);
  console.log(`\n${ok}/${n} piece checks`);
})();
