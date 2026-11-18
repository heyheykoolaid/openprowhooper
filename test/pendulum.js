// Half Matty Pendulum (owner, 2026-11-18): three Half Mattys chained on the same object = one Pendulum
const path = require('path'); require(path.join(__dirname, '..', 'src', 'tricks.js')); require(path.join(__dirname, '..', 'src', 'sim.js'));
const S = globalThis.Sim; let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const run = list => { let chain = []; return list.map(([name, t0, tDone, obstacle]) => { const r = S.pendulumStep(chain, { name, t0, tDone, obstacle }); chain = r.chain; return r.name; }); };
const HM = (t, ob = 'Swing Set') => ['Half Matty', t, t + 1.2, ob];
check('three chained Half Mattys on one object: the third is the Pendulum', run([HM(0), HM(2), HM(4)]).join() === 'Half Matty,Half Matty,Half Matty Pendulum');
check('a fourth starts a new chain', run([HM(0), HM(2), HM(4), HM(6)])[3] === 'Half Matty');
check('six in a row: two Pendulums', run([HM(0), HM(2), HM(4), HM(6), HM(8), HM(10)]).filter(x => x === 'Half Matty Pendulum').length === 2);
check('a long pause breaks the chain', !run([HM(0), HM(2), HM(6)]).includes('Half Matty Pendulum'));
check('another object breaks the chain', !run([HM(0), HM(2), HM(4, 'Tree')]).includes('Half Matty Pendulum'));
check('another trick in between breaks the chain', !run([HM(0), ['Flip', 2.2, 2.6, null], HM(3), HM(5)]).includes('Half Matty Pendulum'));
check('it has points and is in the trick list', S.EXTRA_TRICKS[0].pts > 0 && globalThis.TPW_TRICKS.some(t => t.name === 'Half Matty Pendulum'));
const k = new S.ScoreKeeper(); const a = k.add({ name: 'Half Matty', exec: 'CLEAN' }), b = k.add({ name: 'Half Matty', exec: 'CLEAN' }), c = k.add({ name: 'Half Matty Pendulum', exec: 'CLEAN' });
check('scored as its own trick (not a halved third Half Matty)', c.base === 1050 && c.b2bM === 1, `${a.net} + ${b.net} + ${c.net}`);
console.log(`\n${ok}/${n} pendulum checks`); if (ok !== n) process.exitCode = 1;
