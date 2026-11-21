// Train a trick (src/coach.js): the steps it shows are judged from the detector's own tokens and passes. The bot's scripted
// flight of each trick, watched by a detector, must pass every step of that trick's training (node test/coach.js)
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers, fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/coach.js', 'utf8').split('// ---- the session')[0];
const env = { detector: { toks: [], crossLog: [], time: 0 } };
const C = new Function('S', 'window', 'env', 'esc', `const detector = new Proxy({}, { get: (o, k) => env.detector[k] });\n${src}\nreturn { coachPlan, coachJudge, coachJudgeAny, coachCollect, coach };`)(S, { TPW_TRICKS: globalThis.TPW_TRICKS }, env, x => x);
const W = S.buildPlayground(), orig = S.TrickDetector.prototype.update;
S.TrickDetector.prototype.update = function (...a) { const r = orig.apply(this, a); env.detector = this; C.coachCollect(); return r; };
let ok = 0, n = 0; const bad = [];
const names = MV.tricks.filter(t => C.coachPlan(t));
for (const name of names) for (let seed = 1; seed <= 3; seed++) {
  Object.assign(C.coach, { toks: [], passes: [], seenTok: new Map(), seenPass: new Map() });
  const m = MV.make(name, W, seed * 7919, { wobble: 0 }); if (!m) continue; MV.detect(m, W, 0);
  const j = C.coachJudgeAny(C.coachPlan(name).alts, 0, true); n++;
  if (j.done >= j.steps.length) ok++; else bad.push(`${name} #${seed}: stuck at step ${j.done + 1}${j.out[j.done] && j.out[j.done].msg ? ' (' + j.out[j.done].msg + ')' : ''}`);
}
// and a different trick must not pass: the steps say what is missing
let wrong = 0; const pairs = [['Powerloop', 'Barani'], ['Matty Flip', 'Power Matty'], ['Split-S', '540 Split S'], ['Powerloop', 'Matty Flip'], ['Flip', 'Double Flip']];
for (const [flown, target] of pairs) { Object.assign(C.coach, { toks: [], passes: [], seenTok: new Map(), seenPass: new Map() });
  const m = MV.make(flown, W, 4242, { wobble: 0 }); if (!m) continue; MV.detect(m, W, 0); const j = C.coachJudgeAny(C.coachPlan(target).alts, 0, true);
  const pass = j.done >= j.steps.length; if (!pass) wrong++; console.log(`  ${pass ? '✗' : '✓'} a ${flown} does not pass ${target}'s steps${pass ? '' : ` (stops at step ${j.done + 1}${j.out[j.done].msg ? ': ' + j.out[j.done].msg : ''})`}`); }
// beginners are sloppy (owner, 2026-11-20): a short flip, a flip in two pieces with a pause, a roll well past the mark
const sloppy = [['Flip', [{ ax: 'P', dir: 1, raw: 280, t0: 1, t1: 2 }], true], ['Flip', [{ ax: 'P', dir: -1, raw: 170, t0: 1, t1: 1.6 }, { ax: 'P', dir: -1, raw: 180, t0: 2.2, t1: 2.9 }], true],
  ['Roll', [{ ax: 'R', dir: 1, raw: 450, t0: 1, t1: 2 }], true], ['Rubik\'s Cube', [{ ax: 'P', dir: -1, raw: 120, t0: 1, t1: 1.5 }, { ax: 'R', dir: 1, raw: 300, t0: 1.7, t1: 2.6 }, { ax: 'P', dir: -1, raw: 230, t0: 2.9, t1: 3.5 }], true],
  ['Flip', [{ ax: 'P', dir: 1, raw: 190, t0: 1, t1: 2 }], false], ['Double Flip', [{ ax: 'P', dir: 1, raw: 360, t0: 1, t1: 2 }], false]];
for (const [name, toks, want] of sloppy) { Object.assign(C.coach, { toks, passes: [] }); const j = C.coachJudgeAny(C.coachPlan(name).alts, 0, true), pass = j.done >= j.steps.length;
  n++; if (pass === want) ok++; else bad.push(`sloppy ${name} (${toks.map(k => k.raw).join(' + ')}°) ${want ? 'should pass' : 'should not pass'}`); }
// instant retry (owner, 2026-11-21): parts kept from before a retry are taken as done (`coach.bank`), the rest is judged from a
// fresh detector; a part flown wrong on its own axis asks for a retry, a turn on another axis does not
{ const st = C.coachPlan('Rubik\'s Cube').alts[0], bank = k => ({ n: k, obj: null, vars: {}, out: st.slice(0, k).map(() => ({ ok: true, msg: 'kept' })), key: JSON.stringify(st.slice(0, k)) });
  const chk = (what, pass) => { n++; if (pass) ok++; else bad.push('retry: ' + what); };
  Object.assign(C.coach, { toks: [{ ax: 'R', dir: 1, raw: 350, t0: 0.4, t1: 1.2 }, { ax: 'P', dir: -1, raw: 180, t0: 1.5, t1: 2.1 }], passes: [], bank: bank(1) });
  let j = C.coachJudge(st, 0, true); chk('the kept first part plus the other two finish the Rubik\'s Cube', j.done === st.length && j.out[0].msg === 'kept');
  C.coach.bank = null; j = C.coachJudge(st, 0, true); chk('without the kept part the same tokens do not', j.done < st.length);
  Object.assign(C.coach, { toks: [{ ax: 'P', dir: 1, raw: 700, t0: 1, t1: 2 }], passes: [], bank: null }); j = C.coachJudge(C.coachPlan('Flip').alts[0], 0, true);
  chk('a flip twice too long asks for a retry, once it has had its time', j.done === 0 && j.out[0].retry === true && j.out[0].at === 3);
  Object.assign(C.coach, { toks: [{ ax: 'Y', dir: 1, raw: 200, t0: 1, t1: 2 }], passes: [] }); j = C.coachJudge(C.coachPlan('Flip').alts[0], 0, true);
  chk('a yaw turn before a flip does not', j.done === 0 && !j.out[0].retry);
  C.coach.bank = null; }
S.TrickDetector.prototype.update = orig;
for (const b of bad) console.log('  ✗ ' + b);
console.log(`${ok}/${n} scripted flights pass every training step (${names.length} tricks)`);
if (ok < n * 0.85 || wrong < pairs.length) process.exit(1);
