// Fast combos the way pilots fly them (from the first shared flights, 2026-11): moves chained 0.1–0.4 s apart, rates that
// ramp up and down instead of switching on, rolls flown from a banked turn into the opposite bank (well short of 360 on
// the gyro but a full revolution to the eye), and a little yaw riding along. Each move is [axis, peak deg/s, degrees,
// start offset after the previous move ends (s, may be negative = overlapping), ramp (s)].
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim, world = S.buildPlayground();
const AX = { P: S.v3(1, 0, 0), R: S.v3(0, 0, -1), Y: S.v3(0, -1, 0) };
function fake() { const d = Object.create(S.Drone.prototype); d.pos = S.v3(0, 4, 8); d.vel = S.v3(); d.q = { w: 1, x: 0, y: 0, z: 0 }; d.w = S.v3(); d.armed = true; d.crashed = false; d.contactThisStep = false; return d; }
function plan(moves) { let t = 0.6; return moves.map(([ax, peak, deg, gap = 0.2, ramp = 0.12]) => { const dir = Math.sign(peak) * Math.sign(deg) || 1, pk = Math.abs(peak), D = Math.abs(deg), flat = Math.max(0, D / pk - ramp), t0 = t + gap, t1 = t0 + flat + 2 * ramp; t = t1; return { ax, dir, pk, ramp, flat, t0, t1 }; }); }
const rateAt = (m, t) => { const u = t - m.t0; if (u <= 0 || t >= m.t1) return 0; const up = Math.min(1, u / m.ramp), dn = Math.min(1, (m.t1 - t) / m.ramp); return m.dir * m.pk * Math.min(up, dn); };
let pass = 0, total = 0;
function run(name, moves, expect, opt = {}) {
  const P = plan(moves), T = P[P.length - 1].t1 + 3.5, det = new S.TrickDetector(world), d = fake(), dt = 0.001, got = []; if (opt.bank) d.q = S.qaxis(AX.R, opt.bank * S.D2R);
  for (let t = 0; t < T; t += dt) { let w = S.v3(); for (const m of P) { const r = rateAt(m, t); if (r) w = S.add(w, S.mul(AX[m.ax], r * S.D2R)); }
    const a = S.len(w); if (a > 1e-9) d.q = S.qnorm(S.qmul(d.q, S.qaxis(S.mul(w, 1 / a), a * dt))); d.w = w; det.update(d, dt); for (const e of det.drain()) if (e.name !== 'near') got.push({ ...e, at: t }); }
  const names = got.map(e => e.name), ok = JSON.stringify(names) === JSON.stringify(expect); total++; if (ok) pass++;
  const late = got.length ? Math.max(...got.map((e, i) => e.at - (P.find(m => m.t1 >= (e.tDone ?? 0) - 0.01) || P[P.length - 1]).t1)) : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(44)} -> ${got.map(e => e.name + (e.exec !== 'CLEAN' ? '[' + e.exec + ']' : '')).join(' | ') || 'nothing'}${ok ? '' : '   expected: ' + expect.join(' | ')}`);
}
const roll = (pk = 420, g = 0.2, deg = 360) => ['R', pk, deg, g], flip = (pk = 450, g = 0.2, deg = 360) => ['P', pk, deg, g], yaw = (pk = 600, g = 0.2, deg = 360) => ['Y', pk, deg, g];
run('roll, flip, roll (0.15 s apart, ramped)', [roll(420, 0.2), flip(450, 0.15), roll(-420, 0.15)], ['Roll', 'Flip', 'Roll']);
run('roll, roll opposite, flip (0.1 s)', [roll(500, 0.2), roll(-500, 0.1), flip(500, 0.1)], ['Roll', 'Roll', 'Flip']);
run('four moves 0.12 s apart', [roll(520, 0.2), flip(-520, 0.12), yaw(650, 0.12), roll(-520, 0.12)], ['Roll', 'Flip', 'Yaw Spin', 'Roll']);
run('slow roll 250 deg/s', [roll(250, 0.2)], ['Roll']);
run('slow flip 230 deg/s', [flip(230, 0.2)], ['Flip']);
run('slow roll with long ramps', [['R', 300, 360, 0.2, 0.35]], ['Roll']);
run('slow roll, slow flip (0.2 s)', [['R', 280, 360, 0.2, 0.3], ['P', 260, 360, 0.2, 0.3]], ['Roll', 'Flip']);
run('roll from a 30° bank to the other bank (300°)', [roll(400, 0.2, 300)], ['Roll'], { bank: 30 });
run('roll bank to bank 280°, then flip', [roll(400, 0.2, 280), flip(450, 0.25)], ['Roll', 'Flip'], { bank: 40 });
run('roll with yaw riding along', [roll(450, 0.2), ['Y', 120, 60, -0.7]], ['Roll']);
run('flip with a roll starting before it ends', [flip(500, 0.2), roll(500, -0.08)], ['Flip', 'Roll']);
run('roll, yaw spin overlapping the roll-out', [roll(450, 0.2), yaw(650, -0.06)], ['Roll', 'Yaw Spin']);
run('flip, flip opposite (0.12 s)', [flip(500, 0.2), flip(-500, 0.12)], ['Flip', 'Flip']);
run('six-move run', [roll(480, 0.2), flip(480, 0.15), roll(-480, 0.12), yaw(-650, 0.15), flip(-480, 0.15), roll(480, 0.12)], ['Roll', 'Flip', 'Roll', 'Yaw Spin', 'Flip', 'Roll']);
// not tricks: these must stay quiet
run('half roll and back is an Invert Rewind, not a roll', [roll(400, 0.2, 170), roll(-400, 0.5, 170)], ['Inverted Rewind']);
run('banking hard into a turn (120°) is nothing', [roll(350, 0.2, 120)], []);
run('250° of roll that ends on its side is nothing', [roll(400, 0.2, 250)], []);
console.log(`\n${pass}/${total} fast-combo flights`);
if (pass !== total) process.exitCode = 1;
