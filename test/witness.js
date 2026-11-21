// The learned witness (tools/witness.py → community/witness.json; `witnessProb` in src/sim.js): the game's reading of the trees
// and its features give the same answers as the trainer did, it only speaks for tricks it knows, a broken model is refused, and
// without a model nothing changes. node test/witness.js
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim, fs = require('fs'), M = JSON.parse(fs.readFileSync(__dirname + '/../community/witness.json', 'utf8'));
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
check('no model: no answer', S.witnessProb(M.check[0].sig, M.check[0].t) === null);
const W = S.setWitness(M); check('the shipped model loads', !!W && W.trees.length === M.trees.length && W.classes.length >= 10);
let worst = 0; for (const c of M.check) worst = Math.max(worst, Math.abs(S.witnessProb(c.sig, c.t) - c.p));
check(`the same answers as the trainer on ${M.check.length} moves`, worst < 0.06, `worst difference ${worst.toFixed(4)}`);   // leaf shares are stored as whole percents
check('a trick it was not trained on: no answer', S.witnessProb(M.check[0].sig, 'Not A Trick') === null);
check('it votes only on tricks it has shown it knows', W.vote.size > 0 && [...W.vote].every(t => W.classes.includes(t)) && M.stats.auc > 0.7, `${W.vote.size} of ${W.classes.length} tricks, AUC ${M.stats.auc}`);
const roll = { c: Array.from({ length: 72 }, (_, i) => i % 3 === 0 ? Math.round(360 * Math.floor(i / 3) / 23) : 0), u: Array.from({ length: 24 }, (_, i) => Math.round(100 * Math.cos(2 * Math.PI * i / 23))), d: 0.7, ps: '' };
const pr = S.witnessProb(roll, 'Roll'); console.log(`  (a clean 360 roll in a tight window: Roll ${pr.toFixed(2)}; under 0.25 is why it does not vote yet)`);
check('it stays out of the Watcher until it is marked live', W.live === false || pr >= 0.25);
const bad = JSON.parse(JSON.stringify(M)); bad.trees[0].r[0] = 0; check('a tree that points back at itself is refused', S.setWitness(bad) === null && S.WITNESS === null);
check('a wrong format is refused', S.setWitness({ ...M, format: 'x' }) === null);
console.log(`${ok}/${n}`); if (ok < n) process.exit(1);
