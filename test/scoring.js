// The official Pro Whooper scoring rules (owner, 2026-11-25): streak by base value capped at x2, bumps / fails / crashes end it,
// a 0 % repeat builds nothing, Trick of the Week 200 / 200 / 150 / 100 / 0 %.
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim, window = { TPW_TRICKS: globalThis.TPW_TRICKS || S.TRICKS };
let ok = 0, n = 0; const check = (name, c, info) => { n++; if (c) ok++; else console.log('FAIL', name, info ?? ''); };
const near = (a, b) => Math.abs(a - b) < 1e-9, pts = nm => window.TPW_TRICKS.find(t => t.name.trim() === nm).pts;
{ const k = new S.ScoreKeeper(); k.add({ name: 'Barani', exec: 'CLEAN' }); const b = pts('Barani');
  check('a clean trick adds its base / 10000 to the streak', near(k.streak, 1 + b / 10000), k.streak);
  const r = k.add({ name: 'Juicy Flick', exec: 'SLOPPY' }); check('the next trick is paid at that streak', r.net === Math.round(pts('Juicy Flick') * 0.65 * (1 + b / 10000)), r.net);
  check('a sloppy trick adds its BASE value, not the reduced one', near(k.streak, 1 + (b + pts('Juicy Flick')) / 10000), k.streak); }
{ const k = new S.ScoreKeeper(); const names = window.TPW_TRICKS.filter(t => t.pts >= 250).map(t => t.name.trim()); for (const nm of names) k.add({ name: nm, exec: 'CLEAN' });
  check('the streak tops out at x2', k.streak === 2 && S.STREAK_MAX === 2, `${k.streak} after ${names.length} tricks`); }
{ const k = new S.ScoreKeeper(); k.add({ name: 'Barani', exec: 'CLEAN' }); const r = k.add({ name: 'Flip', exec: 'BUMP' });
  check('a bumped trick pays half (at the streak it had) and ends the streak', r.net === Math.round(pts('Flip') * 0.5 * (1 + pts('Barani') / 10000)) && k.streak === 1, `${r.net} ${k.streak}`); }
{ const k = new S.ScoreKeeper(); k.add({ name: 'Barani', exec: 'CLEAN' }); const t = k.total; k.add({ name: 'Flip', exec: 'MISSED' });
  check('a failed trick scores nothing, breaks the streak and is no repeat', k.total === t && k.streak === 1 && !k.counts.Flip, `${k.total} ${k.streak}`); }
{ const k = new S.ScoreKeeper(); k.add({ name: 'Barani', exec: 'CLEAN' }); const t = k.total;
  check('a bump between tricks ends the streak and takes no points', k.bumpBetween() === true && k.streak === 1 && k.total === t && k.bumpBetween() === false); }
{ const k = new S.ScoreKeeper(); const got = []; for (let i = 0; i < 5; i++) { got.push(k.add({ name: 'Flip', exec: 'CLEAN' }).repeatM); k.add({ name: i % 2 ? 'Roll' : 'Yaw Spin', exec: 'MISSED' }); }
  check('repeats pay 100 / 75 / 50 / 0 / 0 %', got.join() === '1,0.75,0.5,0,0', got.join()); }
{ const k = new S.ScoreKeeper(); for (let i = 0; i < 3; i++) { k.add({ name: 'Flip', exec: 'CLEAN' }); k.add({ name: 'Roll', exec: 'CLEAN' }); } k.bumpBetween();
  k.add({ name: 'Flip', exec: 'CLEAN' }); check('a repeat that pays 0 % does not build the streak', k.streak === 1, k.streak); }
{ const k = new S.ScoreKeeper(); const got = []; for (let i = 0; i < 5; i++) { got.push(k.add({ name: 'Powerloop', exec: 'CLEAN' }).totwM); k.add({ name: 'Flip', exec: 'MISSED' }); }
  check('Trick of the Week pays 200 / 200 / 150 / 100 / 0 %', got.join() === '2,2,1.5,1,0', got.join()); }
{ const k = new S.ScoreKeeper(); const a = k.add({ name: 'Roll', exec: 'CLEAN' }), b = k.add({ name: 'Roll', exec: 'CLEAN' }), c = k.add({ name: 'Roll', exec: 'CLEAN' });
  check('back to back halves, then quarters', a.b2bM === 1 && b.b2bM === 0.5 && c.b2bM === 0.25); }
{ const k = new S.ScoreKeeper(); k.add({ name: 'Barani', exec: 'CLEAN' }); k.add({ name: 'Flip', exec: 'CLEAN' }); k.lateBump();
  check('a late bump ends the streak too', k.streak === 1, k.streak); }
console.log(`\n${ok}/${n} scoring rule checks`); if (ok !== n) process.exit(1);
