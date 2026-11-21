// Bumps (owner, 2026-11-21, from pilots' grades: the game said clean where they said bump): a real knock between the end of a move
// and its call makes the call a BUMP, a soft touch does not, and a knock just after the call takes the points back (lateBump).
// node test/bumps.js
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim, world = S.buildPlayground();
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
function fake() { const d = Object.create(S.Drone.prototype); d.pos = S.v3(0, 4, 8); d.vel = S.v3(); d.q = { w: 1, x: 0, y: 0, z: 0 }; d.w = S.v3(); d.armed = true; d.crashed = false; d.contactThisStep = false; return d; }
// a 360° roll in 0.6 s from t = 0.5 s, and one contact row at `hitAt` with `impact`
function roll(hitAt, impact) { const det = new S.TrickDetector(world), d = fake(), dt = 0.001, ax = S.v3(0, 0, -1), rate = 600 * S.D2R, out = [];
  for (let t = 0; t < 4; t += dt) { const a = Math.min(Math.max(t - 0.5, 0), 0.6); d.q = S.qnorm(S.qaxis(ax, rate * a)); d.w = t >= 0.5 && t < 1.1 ? S.mul(ax, rate) : S.v3();
    d.contactThisStep = hitAt != null && Math.abs(t - hitAt) < dt / 2; if (d.contactThisStep) { d.lastImpact = impact; d.contactNormal = S.v3(1, 0, 0); d.contactOwner = -1; d.contactGround = false; }
    det.update(d, dt); for (const e of det.drain()) if (e.name !== 'near') out.push({ ...e, at: t }); }
  return out; }
const base = roll(null), call = base.find(e => e.name === 'Roll');
check('a roll in clear air is called clean', call && call.exec === 'CLEAN', base.map(e => `${e.name} ${e.exec} at ${e.at.toFixed(2)}s`).join(', '));
const mid = call ? (1.1 + call.at) / 2 : 1.3;   // between the end of the roll and its call
{ const r = roll(mid, 3).find(e => e.name === 'Roll'); check('a knock between the end of the roll and its call makes it a bump', r && r.exec === 'BUMP', r && `${r.exec}, hit at ${mid.toFixed(2)}s, called at ${r.at.toFixed(2)}s`); }
{ const r = roll(mid, 0.6).find(e => e.name === 'Roll'); check('a soft touch there does not', r && r.exec === 'CLEAN', r && r.exec); }
{ const r = roll(0.8, 0.6).find(e => e.name === 'Roll'); check('any contact during the roll still does', r && r.exec === 'BUMP', r && r.exec); }
{ const k = new S.ScoreKeeper(), n0 = k.add({ name: 'Flip', exec: 'CLEAN' }).net, s1 = k.streak, t1 = k.total, back = k.lateBump(), a = { net: n0 };
  check('a late bump takes back half a clean trick\'s points and its streak gain', back === a.net - Math.round(a.net * 0.5) && k.total === t1 - back && k.streak === 1 && s1 > 1 && k.log[0].exec === 'BUMP' && k.log[0].late === true, `net ${a.net} → ${k.log[0].net}, streak ${s1.toFixed(3)} → ${k.streak}`);
  check('and only once', k.lateBump() === 0); }
{ const k = new S.ScoreKeeper(); k.add({ name: 'Flip', exec: 'BUMP' }); const t = k.total; check('a call that was already a bump is left alone', k.lateBump() === 0 && k.total === t); }
{ const k = new S.ScoreKeeper(); k.add({ name: 'Flip', exec: 'SLOPPY' }); const e = k.log[0].net, back = k.lateBump(); check('a sloppy one drops to a bump\'s points', k.log[0].net === Math.round(e * 0.5 / 0.65) && back === e - k.log[0].net); }
console.log(`\n${ok}/${n} bump checks`); if (ok !== n) process.exit(1);
