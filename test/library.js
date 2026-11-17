// The trick library (Sim.setLibrary, tools/library.js): signatures, the Watcher's library vote and "maybe" calls.
// node test/library.js
require("../src/tricks.js"); require("../src/sim.js");
const S = globalThis.Sim, world = S.buildPlayground();
const AX = { P: S.v3(1, 0, 0), R: S.v3(0, 0, -1), Y: S.v3(0, -1, 0) };
// moves: [axis, peak deg/s, degrees, gap before (s)] -> 100 Hz trace rows in the game's column order, plus where each move was
function flight(moves) {
  let t = 1.0; const P = moves.map(([ax, pk, deg, gap = 1.5]) => { const ramp = 0.1, flat = Math.max(0, Math.abs(deg) / pk - ramp), t0 = t + gap, t1 = t0 + flat + 2 * ramp; t = t1; return { ax, dir: Math.sign(deg), pk, ramp, t0, t1 }; });
  const rate = (m, u) => { if (u <= m.t0 || u >= m.t1) return 0; return m.dir * m.pk * Math.min(1, (u - m.t0) / m.ramp, (m.t1 - u) / m.ramp); };
  const rows = []; let q = { w: 1, x: 0, y: 0, z: 0 }; const T = t + 3, dt = 0.001;
  for (let i = 0; i * dt < T; i++) { const u = i * dt; let w = S.v3(); for (const m of P) { const r = rate(m, u); if (r) w = S.add(w, S.mul(AX[m.ax], r * S.D2R)); }
    const a = S.len(w); if (a > 1e-9) q = S.qnorm(S.qmul(q, S.qaxis(S.mul(w, 1 / a), a * dt)));
    if (i % 10 === 0) rows.push([+u.toFixed(2), 0, 9, 8, q.w, q.x, q.y, q.z, -w.z * S.R2D, w.x * S.R2D, -w.y * S.R2D, 0.4, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); }
  return { rows, at: P.map(m => [m.t0, m.t1]) };
}
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const names = (rows, pilot) => S.replayTrace(rows, { world, camTilt: 0, pilot, debug: false }).events.filter(e => e.name !== 'near').map(e => e.name);
const seqOf = (rows, a, b) => { const s = [], u = []; let acc = [0, 0, 0], n = 0; for (let i = 1; i < rows.length; i++) { const r = rows[i], dt = r[0] - rows[i - 1][0]; if (r[0] < a || r[0] > b) continue; for (let x = 0; x < 3; x++) acc[x] += r[8 + x] * dt; n += dt; if (n >= 0.0399) { s.push(acc); u.push(S.qrot({ w: r[4], x: r[5], y: r[6], z: r[7] }, S.v3(0, 1, 0)).y); acc = [0, 0, 0]; n = 0; } } return S.libSig(s, 25, u); };
const ex = (name, F, i, extra = {}) => ({ t: name, ...seqOf(F.rows, F.at[i][0] - 0.2, F.at[i][1] + 0.2), w: 3, s: 'demo', ...extra });
const roll = flight([['R', 420, 360]]), flip = flight([['P', 400, 360]]), yaw = flight([['Y', 420, 360]]), slowYaw = flight([['Y', 150, 360]]);
const sR = seqOf(roll.rows, 0, 99), sP = seqOf(flip.rows, 0, 99), sY = seqOf(yaw.rows, 0, 99), sS = seqOf(slowYaw.rows, 0, 99);
check('a roll\'s signature goes upside-down halfway and ends upright', Math.min(...sR.u) < -90 && sR.u[0] > 90 && sR.u[S.libSig.length ? 23 : 23] > 90, sR.u.join(','));
check('a yaw spin stays upright the whole way', Math.min(...sY.u) > 90);
check('a roll is nearer a roll than a flip or a yaw spin', S.libDist(sR, sR) < 0.01 && S.libDist(sR, sP) > 0.4 && S.libDist(sR, sY) > 0.4, [S.libDist(sR, sP), S.libDist(sR, sY)].map(x => x.toFixed(2)).join(' '));
check('a slow yaw spin is near a fast one (time is warped, length only counts a little)', S.libDist(sS, sY) < 0.2, S.libDist(sS, sY).toFixed(2));
check('junk is refused', S.setLibrary({ format: 'x' }) === null && S.setLibrary({ format: 'pro-whooper-library/1', examples: [{ t: 'Roll', d: 1, c: [1, 2] }, null, { t: 5 }] }).ex.length === 0);
// the rules don't call this slow yaw spin (see test/learn.js); with a demo of a yaw spin in the library, the game says "maybe"
S.setLibrary(null); const plain = S.replayTrace(slowYaw.rows, { world, camTilt: 0, debug: false });
check('without a library: nothing, and no maybe', plain.events.filter(e => e.name !== 'near').length === 0 && plain.maybes.length === 0);
S.setLibrary({ format: 'pro-whooper-library/1', examples: [ex('Yaw Spin', yaw, 0), ex('Roll', roll, 0), ex('Flip', flip, 0)] });
let R = S.replayTrace(slowYaw.rows, { world, camTilt: 0, debug: false });
check('with a demo yaw spin in the library: "maybe Yaw Spin?", never a scored call', R.maybes.length === 1 && R.maybes[0].name === 'Yaw Spin' && R.events.filter(e => e.name !== 'near').length === 0, JSON.stringify(R.maybes));
S.setLibrary({ format: 'pro-whooper-library/1', examples: [{ ...ex('Yaw Spin', yaw, 0), s: 'pilot', p: '1' }, ex('Roll', roll, 0)] });
R = S.replayTrace(slowYaw.rows, { world, camTilt: 0, debug: false });
check('one pilot\'s example alone is not enough to say maybe', R.maybes.length === 0);
S.setLibrary({ format: 'pro-whooper-library/1', examples: [ex('Yaw Spin', yaw, 0), { ...ex('Yaw Spin', slowYaw, 0), s: 'pilot', p: '1', neg: 1 }] });
R = S.replayTrace(slowYaw.rows, { world, camTilt: 0, debug: false });
check('a counter-example (a pilot said this was not a yaw spin) stops the maybe', R.maybes.length === 0);
// on a rule call the library votes in the Watcher
S.setLibrary({ format: 'pro-whooper-library/1', examples: [ex('Roll', roll, 0), ex('Flip', flip, 0)] });
R = S.replayTrace(roll.rows, { world, camTilt: 0, debug: false }); const rc = R.events.find(e => e.name === 'Roll');
check('a roll that looks like the demo roll gets a strong library vote', rc && rc.watch.votes.library > 0.8, rc && JSON.stringify(rc.watch.votes));
check('…and no maybe on top of a rule call', R.maybes.length === 0);
S.setLibrary(null);
console.log(`\n${ok}/${n} library checks`);
