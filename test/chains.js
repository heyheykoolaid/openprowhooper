// INFINITY LOOPS / BIG BEN (owner, 2026-11-20): every 5th Powerloop / Matty Flip in a row in one combo is a set worth
// 2000 × its number (5 → 2000, 10 → 4000 more). Another trick, a crash, a miss or the combo banking starts over.
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const run = (list, brk = []) => { const k = new S.ScoreKeeper(); const hits = []; list.forEach((x, i) => { if (brk.includes(i)) k.chainBreak(); const [name, exec] = Array.isArray(x) ? x : [x, 'CLEAN']; const r = k.add({ name, exec, obstacle: 'Swing Set' }); if (r && r.chainHit) hits.push(r.chainHit); }); return { k, hits }; };
const P = 'Powerloop', M = 'Matty Flip';
{ const { k, hits } = run(Array(10).fill(P)); check('10 Powerloops in a row: INFINITY LOOPS at 5 (+2000) and 10 (+4000)', k.chainBonus === 6000 && hits.map(h => h.title + h.pts).join() === 'INFINITY LOOPS2000,INFINITY LOOPS4000', JSON.stringify(hits)); }
{ const { k, hits } = run(Array(5).fill(M)); check('5 Matty Flips in a row: BIG BEN +2000', k.chainBonus === 2000 && hits[0].title === 'BIG BEN'); }
{ const { k } = run([P, P, P, P, 'Flip', P]); check('a Flip in the middle breaks the set', k.chainBonus === 0); }
{ const { k } = run([P, P, P, [P, 'CRASH'], P, P, P, P, P]); check('a crash starts it over (the next five count)', k.chainBonus === 2000); }
{ const { k } = run(Array(5).fill(P), [3]); check('the combo banking starts it over', k.chainBonus === 0); }
{ const { k } = run([P, P, M, M, M, M, M]); check('mixed: the Matty set counts on its own', k.chainBonus === 2000); }
{ const { k } = run(Array(5).fill(P)); check('the bonus is in the total', k.total >= k.chainBonus + 1 && k.total === Math.round(k.trickScore * k.switchMult() + k.kwadBonus + k.chainBonus)); }
console.log(`\n${ok}/${n} chain bonus checks`); if (ok !== n) process.exit(1);
