// Shared replay engine: feeds recorded rows (TRACE_COLS @ hz) through a detector at 1 kHz.
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim;
const world = S.buildPlayground();
function replayTrace(rows, opts = {}) { return S.replayTrace(rows, { ...opts, world: opts.world || world }); }
function loadLabels(data) { // → [{target, verdict, rep, repStart, t, rows, camTilt}]
  if (data.format && data.format.startsWith('pro-whooper-session')) {
    const R = data.run; return R.labels.filter(l => !l.undone).map(l => ({ ...l, rows: R.trace, camTilt: data.camTilt }));
  }
  return data.examples.map(ex => { const rows = ex.trace?.data || ex.trace; const tEnd = rows[rows.length - 1][0]; return { ...ex, rows, repStart: ex.repStart ?? tEnd - 8, t: ex.t ?? tEnd, camTilt: data.camTilt }; });
}
module.exports = { S, world, replayTrace, loadLabels };
