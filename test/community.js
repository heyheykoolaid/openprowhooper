// The community layer (Sim.setCommunity): the profile tools/community.js learns from every pilot's flights. Every detector
// starts from it, the pilot's own profile sits on top (the looser of the two), and per-trick confidence floors can tighten.
// node test/community.js
require('../src/tricks.js'); require('../src/sim.js');
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
const N = { format: 'pro-whooper-community/1', learn: { tol: 0, rev: 0, crossBack: 0 }, floor: {} };
const A = flight([['R', 420, 360], ['Y', 150, 360], ['Y', 150, -360]]), B = flight([['R', 420, 300], ['P', 300, 330]]);
const plain = rows => S.replayTrace(rows, { world, camTilt: 0, debug: false }).events.filter(e => e.name !== 'near').map(e => e.name).join(',');
S.setCommunity(null); const a0 = plain(A.rows), b0 = plain(B.rows);
check('no community: the stock detector (slow yaw spins are not called)', a0 === 'Roll', a0);
S.setCommunity(N); check('a neutral community profile changes nothing', plain(A.rows) === a0 && plain(B.rows) === b0);
S.setCommunity({ ...N, rate: { Y: 180 } }); check('a community that learned slower yaw spins calls them for everyone', plain(A.rows) === 'Roll,Yaw Spin,Yaw Spin', plain(A.rows));
check('…also under a pilot whose own pace is faster (the looser of the two wins)', names(A.rows, { rate: { R: 600, P: 600, Y: 700 } }).join(',') === 'Roll,Yaw Spin,Yaw Spin');
const m = S.mergeProfiles(S.community, { rate: { Y: 150 }, learn: { tol: 20 } }); check('merging keeps the pilot\'s looser values', m.rate.Y === 150 && m.learn.tol === 20 && m.learn.rev === 0);
check('junk is refused', S.setCommunity({ format: 'something else', learn: { tol: 999 } }) === null && S.community === null);
const c = S.setCommunity({ ...N, learn: { tol: 999, rev: -5, crossBack: 'x' }, floor: { Roll: 5, '': 0.5, Flip: 'no' }, rate: { R: 1 }, air: 9 });
check('values are clamped to the learner\'s caps', c.learn.tol === S.LEARN_MAX.tol && c.learn.rev === 0 && c.learn.crossBack === 0 && c.floor.Roll === 0.8 && !('Flip' in c.floor) && !('' in c.floor) && c.rate.R === 150 && c.air === 0.85, JSON.stringify(c));
S.setCommunity(N); S.community.floor.Roll = 0.95;   // (past the 0.8 cap only to test the mechanism: this short roll reads 93%)
check('a confidence floor drops calls under it', !plain(B.rows).includes('Roll') && plain(B.rows).includes('Flip'), plain(B.rows));
S.community.floor.Roll = 0.9; check('…and keeps calls over it', plain(B.rows) === b0, plain(B.rows));
S.setCommunity(null); check('back to no community: the stock detector again', plain(A.rows) === a0 && plain(B.rows) === b0);
console.log(`\n${ok}/${n} community checks`);
