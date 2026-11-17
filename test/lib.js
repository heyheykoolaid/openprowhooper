// Shared replay engine: feeds recorded rows (TRACE_COLS @ hz) through a detector at 1 kHz.
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim;
const world = S.buildPlayground();
function replayTrace(rows, opts = {}) {
  const det = new S.TrickDetector(world); det.camTilt = opts.camTilt ?? 20;
  if (opts.hook) opts.hook(det);
  const d = Object.create(S.Drone.prototype); d.armed = true; d.crashed = false; d.contactThisStep = false;
  const dt = 0.001, out = [], dbg = [], hasV = rows[0].length >= 24;
  let k = 0, prev = null, lastRow = -1;
  const t0 = opts.from ?? rows[0][0], t1 = Math.min(opts.to ?? Infinity, rows[rows.length - 1][0]);
  while (k < rows.length - 2 && rows[k + 1][0] <= t0) k++;
  for (let t = t0; t < t1 + (opts.tail ?? 1.6); t += dt) {
    while (k < rows.length - 2 && rows[k + 1][0] <= t) k++;
    const a = rows[k], b = rows[Math.min(k + 1, rows.length - 1)];
    const span = b[0] - a[0], f = span > 0 ? Math.min(1, Math.max(0, (t - a[0]) / span)) : 0;
    const jump = Math.hypot(b[1] - a[1], b[2] - a[2], b[3] - a[3]) > 1.5;
    const L = i => (jump ? (f < 0.5 ? a[i] : b[i]) : a[i] + (b[i] - a[i]) * f);
    d.pos = S.v3(L(1), L(2), L(3)); d.q = S.qnorm({ w: L(4), x: L(5), y: L(6), z: L(7) });
    const rr = [L(8), L(9), L(10)].map(v => v * S.D2R); d.w = S.v3(rr[1], -rr[2], -rr[0]);
    if (jump && f >= 0.5 && !d._j) { det.prevSide = {}; d._j = true; prev = null; } if (!jump) d._j = false;
    d.vel = hasV ? S.v3(L(21), L(22), L(23)) : (prev ? S.mul(S.sub(d.pos, prev), 1 / dt) : S.v3()); prev = d.pos;
    const src = f < 0.5 ? a : b; d.armed = !!src[13]; d.crashed = !!src[14];
    // contacts: once per recorded row that had one
    const ri = f < 0.5 ? k : k + 1; d.contactThisStep = false;
    if (src[12] && ri !== lastRow) { lastRow = ri; d.contactThisStep = true;
      if (src.length >= 21) { d.contactNormal = S.v3(src[15], src[16], src[17]); d.contactOwner = src[18]; d.lastImpact = src[19]; d.contactGround = !!src[20]; }
      else { d.contactNormal = S.v3(0, 1, 0); d.contactGround = true; d.lastImpact = 1; d.contactOwner = -1; } }
    // sticks (format v2 traces carry them; older ones don't): give the detector the pilot's inputs too
    const rc = src.length >= 27 ? { thr: src[11], roll: src[24], pitch: src[25], yaw: src[26] } : { thr: src[11] ?? 0, roll: 0, pitch: 0, yaw: 0 };
    if (d._wasArmed !== undefined && d._wasArmed !== d.armed) det.onArmChange(d, d.armed);   // the game tells the detector about arming (Slide Disarm, Perch)
    d._wasArmed = d.armed;
    det.update(d, dt, rc); det.postStep(d);
    for (const e of det.drain()) out.push({ ...e, t });
    if (det.debug && det.debug.length && det.debug[det.debug.length - 1] !== dbg[dbg.length - 1]?.src) dbg.push({ ...det.debug[det.debug.length - 1], tAbs: t, src: det.debug[det.debug.length - 1] });
  }
  return { events: out, debug: dbg, det };
}
function loadLabels(data) { // → [{target, verdict, rep, repStart, t, rows, camTilt}]
  if (data.format && data.format.startsWith('pro-whooper-session')) {
    const R = data.run; return R.labels.filter(l => !l.undone).map(l => ({ ...l, rows: R.trace, camTilt: data.camTilt }));
  }
  return data.examples.map(ex => { const rows = ex.trace?.data || ex.trace; const tEnd = rows[rows.length - 1][0]; return { ...ex, rows, repStart: ex.repStart ?? tEnd - 8, t: ex.t ?? tEnd, camTilt: data.camTilt }; });
}
module.exports = { S, world, replayTrace, loadLabels };
