// INVERTED (owner, 2026-11-25): 3D mode only, every full second upside-down in the air scores 200, no repeat penalty; a touch, a
// crash or disarming ends the stretch. node test/inverted.js
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const base = { mode3d: true, armed: true, crashed: false, contact: false, upY: -0.95 }, secs = (T, s, tm = new S.InvertedTimer(), dt = 0.001) => { let got = 0; for (let t = 0; t < T - 1e-9; t += dt) got += tm.step(dt, typeof s === 'function' ? s(t) : s); return { got, tm }; };
check('one point every full second upside-down', secs(3.5, base).got === 3);
check('only in 3D mode', secs(3, { ...base, mode3d: false }).got === 0);
check('not right way up or on its side', secs(3, { ...base, upY: -0.5 }).got === 0 && secs(3, { ...base, upY: 0.9 }).got === 0);
check('not disarmed or crashed', secs(3, { ...base, armed: false }).got === 0 && secs(3, { ...base, crashed: true }).got === 0);
{ const r = secs(3.2, t => ({ ...base, contact: t > 1.5 && t < 1.501 })); check('a touch ends the stretch: seconds before it stay, the count starts again', r.got === 2 && r.tm.run === 1, `${r.got} scored, run ${r.tm.run}`); }
{ const k = new S.ScoreKeeper(); let pts = 0; for (let i = 1; i <= 6; i++) pts += k.inverted(i);
  check('200 a second, no repeat penalty, no streak, its own line', pts === 1200 && k.invBonus === 1200 && k.invN === 6 && k.invBest === 6 && k.total === 1200 && k.trickScore === 0 && k.streak === 1); }
check('in the trick book as a 200-point extra', S.EXTRA_TRICKS.some(t => t.name === 'INVERTED' && t.pts === 200) && S.DETECTABLE.includes('INVERTED'));
// the real physics: an Air65 3D rolled upside-down and held there with the stick below the middle
{ const W = { objs: [], prims: [], zones: [], spawn: { pos: S.v3(0, 0.03, 0), yaw: 0 } }, P = S.buildDrone(S.PRESETS['Air65 3D']), tune = S.defaultTune(); tune.flightMode = '3d';
  const d = new S.Drone(P, tune, W); d.reset({ pos: S.v3(0, 12, 0), yaw: 0 }); d.pos = S.v3(0, 12, 0); d.armed = true; const hov = P.stats.hoverThrottle, tm = new S.InvertedTimer();
  for (let k = 0; k < 900 && d.up().y > -0.985; k++) d.step({ thr: 0.5, roll: 0.6, pitch: 0, yaw: 0 }, 0.001);
  d.pos = S.v3(0, 12, 0); d.vel = S.v3(); let got = 0;
  for (let t = 0; t < 3.3; t += 0.001) { d.step({ thr: 0.5 - 0.5 * (hov / P.revEff * 1.05 + 0.05), roll: 0, pitch: 0, yaw: 0 }, 0.001); got += tm.step(0.001, { mode3d: true, armed: d.armed, crashed: d.crashed, contact: d.contactThisStep, upY: d.up().y }); }
  check('an Air65 3D held upside-down for 3.3 s scores 3 seconds', got === 3 && d.up().y < -0.9, `${got} s, up ${d.up().y.toFixed(2)}, height ${d.pos.y.toFixed(1)} m`); }
console.log(`\n${ok}/${n} INVERTED checks`); if (ok !== n) process.exit(1);
