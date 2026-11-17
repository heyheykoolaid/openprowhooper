// Learning from review labels (Sim.learnFromLabels): the pilot says what a stretch of flight was; the learner re-flies it
// with a slightly looser profile and keeps a loosening only when it finds more of the pilot's tricks without bringing
// back a call they rejected. node test/learn.js
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
(async () => {
  // 1. this pilot's yaw spins are slow and deliberate (150 deg/s): the stock detector calls a lone slow yaw a turn
  const A = flight([['R', 420, 360], ['Y', 150, 360], ['Y', 150, -360]]);
  const runA = { rows: A.rows, world, camTilt: 0, labels: [{ target: 'Roll', verdict: 'yes', actual: 'Roll', repStart: A.at[0][0], t: A.at[0][1] }, { target: 'Yaw Spin', verdict: 'yes', actual: 'Yaw Spin', repStart: A.at[1][0], t: A.at[1][1], via: 'review-added' }, { target: 'Yaw Spin', verdict: 'yes', actual: 'Yaw Spin', repStart: A.at[2][0], t: A.at[2][1], via: 'review-added' }] };
  check('before learning: the roll is called, the slow yaw spins are not', JSON.stringify(names(A.rows)) === '["Roll"]', names(A.rows).join(', '));
  let r = await S.learnFromLabels([runA], null);
  check('the learner finds a loosening that calls them', r.changed && r.report.before === 1 && r.report.after === 3, JSON.stringify(r.report));
  check('…by allowing slower yaw, nothing else', r.report.changes.every(c => c === 'slower yaw spins') && r.profile.learn.tol === 0 && r.profile.rate.Y < 360);
  check('the learned profile makes the game call them', JSON.stringify(names(A.rows, r.profile)) === '["Roll","Yaw Spin","Yaw Spin"]', names(A.rows, r.profile).join(', '));
  // 2. a 300 degree yaw is under the 360 the book asks for. One pilot says it IS their yaw spin…
  const B = flight([['Y', 500, 300], ['R', 450, 360]]);
  const runB = { rows: B.rows, world, camTilt: 0, labels: [{ target: 'Yaw Spin', verdict: 'yes', actual: 'Yaw Spin', repStart: B.at[0][0], t: B.at[0][1], via: 'review-added' }, { target: 'Roll', verdict: 'yes', actual: 'Roll', repStart: B.at[1][0], t: B.at[1][1] }] };
  r = await S.learnFromLabels([runB], null);
  check('a short yaw spin the pilot labels is learned through angle tolerance', r.changed && r.report.after === 2 && r.profile.learn.tol > 0 && r.profile.learn.tol <= S.LEARN_MAX.tol, JSON.stringify(r.report.changes));
  // …but if the same pilot has said a turn like that was NOT a trick, the learner must not bring the call back
  const C = flight([['Y', 500, 365], ['Y', 500, -300]]), tolP = r.profile;
  check('(with that tolerance the detector would call the second turn too)', names(C.rows, tolP).filter(x => x === 'Yaw Spin').length === 2);
  const runC = { rows: C.rows, world, camTilt: 0, labels: [{ target: 'Yaw Spin', verdict: 'yes', actual: 'Yaw Spin', repStart: C.at[0][0], t: C.at[0][1] }, { target: 'Yaw Spin', verdict: 'no', actual: 'not a trick', repStart: C.at[1][0], t: C.at[1][1] }] };
  r = await S.learnFromLabels([runB, runC], null);
  check('a loosening that would bring back a call the pilot rejected is refused', !r.profile.learn.tol && r.report.wrongAfter === 0, JSON.stringify(r.report));
  // 3. nothing to learn: every label already agrees
  r = await S.learnFromLabels([{ rows: A.rows, world, camTilt: 0, labels: [runA.labels[0]] }], { rate: { R: 500, P: 500, Y: 600 }, air: 0.4 });
  check('labels that already agree change nothing', !r.changed && r.profile.rate.Y === 600 && r.report.before === 1);
  // 4. bounds: a profile from storage cannot push the knobs past their caps
  const det = new S.TrickDetector(world); det.setPilot({ learn: { tol: 9999, rev: -5, crossBack: 'x' } });
  check('stored values are clamped', det.learned.tol === S.LEARN_MAX.tol && det.learned.rev === 0 && det.learned.crossBack === 0);
  console.log(`\n${ok}/${n} learning checks`); if (ok !== n) process.exitCode = 1;
})();
