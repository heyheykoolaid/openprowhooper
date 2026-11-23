// Knife Edge only through narrow gaps (owner, 2026-11-20): rolled to knife-edge through the Training Room's 0.2 m Knife Slot is a
// Knife Edge; the same roll through the 0.3 m slot (wider than ~2.75 widths of an Air65) or the 1.6 m Gap Gate is not; flying
// the 0.2 m slot flat (no roll) is not either. Synthetic attitude flights fed straight to the detector.
// usage: node test/knife.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js');
const S = globalThis.Sim, W = S.MAPS.training.build(), v3 = S.v3;
let ok = 0, n = 0;
const gapOf = name => W.objs.find(o => o.name === name).gap;
function fly(gapName, roll, T = 2.6) {
  const g = gapOf(gapName), det = new S.TrickDetector(W), d = Object.create(S.Drone.prototype), dt = 0.002, got = [];
  Object.assign(d, { armed: true, crashed: false, contactThisStep: false, w: v3() });
  const face = S.qaxis(v3(0, 1, 0), Math.PI / 2), RATE = 500;   // facing -x, flying through along -x
  let prev = null;
  for (let t = 0; t < T; t += dt) {
    const x = g.c.x + 3 - t * 2.5, pos = v3(x, g.c.y, g.c.z);
    const a = roll ? Math.min(roll, Math.max(0, (t - 0.6) * RATE)) - Math.min(roll, Math.max(0, (t - 1.9) * RATE)) : 0;
    const q = S.qmul(face, S.qaxis(v3(0, 0, -1), a * Math.PI / 180));
    d.w = prev != null ? S.mul(v3(0, 0, -1), ((a - prev) / dt) * Math.PI / 180) : v3(); prev = a;   // body rates
    d.pos = pos; d.vel = v3(-2.5, 0, 0); d.q = q; det.update(d, dt);
    for (const e of det.drain()) if (e.name !== 'near') got.push(e.name);
  }
  return got;
}
const check = (name, got, want) => { n++; const pass = want ? got.includes('Knife Edge') : !got.includes('Knife Edge'); if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name.padEnd(58)} ${got.join(', ') || 'nothing'}`); };
check('rolled 90° through the 0.2 m Knife Slot: Knife Edge', fly('Knife Slot 0.2 m opening', 90), true);
check('rolled 90° through the 0.3 m slot (inside 4 whoops): Knife Edge', fly('Knife Slot 0.3 m opening', 90), true);
check('rolled 90° through the 0.7 m Gap Gate (too wide): not', fly('Gap Gate 0.7 m opening', 90), false);
check('rolled 90° through the 1.6 m Gap Gate: not', fly('Gap Gate 1.6 m opening', 90), false);
check('flat through the 0.2 m slot: not', fly('Knife Slot 0.2 m opening', 0), false);
console.log(`\n${ok}/${n} knife edge checks`);
