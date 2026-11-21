// Labels pooled into a weight (owner, 2026-11-20: "a label requires 3 confirmations now … the decision is still a weight itself …
// everything averages and balances out"): every decided label on one moment is pooled per trick, (yes − no) / people, times a
// ramp that reaches full at 3 different people. usage: node test/consensus.js
const { consensus, CONFIRM, W } = require('../tools/evidence.js');
let ok = 0, n = 0;
const check = (name, pass, got) => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(64)} ${got}`); };
const yes = (author, trick, t = 10, w = W.own) => ({ a: t - 1, b: t, author, actual: trick, target: trick, verdict: 'yes', src: 'own', wYes: w, wNo: w });
const no = (author, trick, t = 10, w = W.own, actual = 'not a trick') => ({ a: t - 1, b: t, author, actual, target: trick, verdict: 'no', src: 'own', wYes: w, wNo: w });
const one = (list, kind, name) => consensus(list).find(e => e.kind === kind && e.name === name);
const near = (x, v) => x && Math.abs(x.w - v) < 1e-6;

let e = one([yes('rod', 'Matty Flip')], 'want', 'Matty Flip');
check('one pilot says yes: a third of full weight', near(e, 1 / CONFIRM), e && e.w.toFixed(3));
e = one([yes('rod', 'Matty Flip'), yes('ali', 'Matty Flip', 10.4)], 'want', 'Matty Flip');
check('two agree: two thirds', near(e, 2 / CONFIRM), e && e.w.toFixed(3));
e = one([yes('rod', 'Matty Flip'), yes('ali', 'Matty Flip', 10.4), yes('omni', 'Matty Flip', 9.8)], 'want', 'Matty Flip');
check('three agree: full weight, three people', near(e, 1) && e.people === 3 && e.agree === 3, e && `${e.w.toFixed(3)} · ${e.people} people`);
e = one([yes('rod', 'Matty Flip'), yes('ali', 'Matty Flip'), no('omni', 'Matty Flip')], 'want', 'Matty Flip');
check('2 yes, 1 no: a weak yes (1/3), not a tie', near(e, 1 / 3), e && e.w.toFixed(3));
const tie = consensus([yes('rod', 'Matty Flip'), no('ali', 'Matty Flip')]).filter(x => x.name === 'Matty Flip');
check('1 yes, 1 no: nothing either way until a third judges it', tie.length === 0, tie.length + ' entries');
e = one([no('rod', 'Powerloop'), no('ali', 'Powerloop'), no('omni', 'Powerloop')], 'not', 'Powerloop');
check('three say "not a trick": a full-weight no', near(e, 1), e && e.w.toFixed(3));
e = one([yes('rod', 'Matty Flip'), yes('rod', 'Matty Flip', 10.2)], 'want', 'Matty Flip');
check('the same pilot twice is one voice', near(e, 1 / 3) && e.people === 1, e && `${e.w.toFixed(3)} · ${e.people} person`);
const corr = consensus([no('rod', 'Jump Rope', 10, W.own, 'Side Loop')]);
check('a correction: a yes for what it was, a no for what was called', corr.some(x => x.kind === 'want' && x.name === 'Side Loop') && corr.some(x => x.kind === 'not' && x.name === 'Jump Rope'), corr.map(x => x.kind + ' ' + x.name).join(', '));
e = one([yes('owner', 'Barani', 10, W.reviewer)], 'want', 'Barani');
check('a reviewer label alone keeps its weight in the average (1.5 / 3)', near(e, W.reviewer / CONFIRM), e && e.w.toFixed(3));
const apart = consensus([yes('rod', 'Flip', 10), yes('ali', 'Flip', 20)]).filter(x => x.name === 'Flip');
check('labels 10 s apart are two moments', apart.length === 2 && apart.every(x => near(x, 1 / 3)), apart.map(x => x.w.toFixed(3)).join(', '));
// "crash" (owner, 2026-11-21): the name stands, but it is not an example of the trick
{ const c = consensus([{ ...yes('rod', 'Flip', 10), crash: true }]).find(x => x.name === 'Flip'); check('a call graded crash is still a yes for the trick, marked crashed', c && c.kind === 'want' && c.crashed === true && near(c, 1 / 3));
  const d = consensus([{ ...yes('rod', 'Flip', 10), crash: true }, yes('ali', 'Flip', 10), yes('wonky', 'Flip', 10)]).find(x => x.name === 'Flip'); check('one crash grade among three yeses does not mark it', d && d.kind === 'want' && !d.crashed);
  const f = consensus([{ ...yes('rod', 'Flip', 10), crash: true }, { ...yes('ali', 'Flip', 10), crash: true }, yes('wonky', 'Flip', 10)]).find(x => x.name === 'Flip'); check('two of three does', f && f.crashed === true); }
console.log(`\n${ok}/${n} consensus checks`);
