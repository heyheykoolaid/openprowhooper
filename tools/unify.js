// One view of every kind of labelled flight the project collects, and one way to run the current detector on it.
// Each source becomes "episodes": the recorded motion plus what the pilot (or the demo) says happened when.
// See docs/DATA.md for the formats and how much each source is trusted.
//   const U = require('./tools/unify.js'); U.episodes(json, name) -> [{ source, trust, kind, ..., labels }]; U.run(ep) -> events
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maneuvers.js'); require('../src/vision.js');
const { replayTrace, world } = require('../test/lib.js');
const S = globalThis.Sim, M = globalThis.Maneuvers, V = globalThis.Vision;
const TRUST = { 'blackbox-replay': 1.0, 'video-review': 1.0, 'sim-calibration': 0.9, demo: 0.8, judge: 0.7, bot: 0.4 };
const lab = (t0, t1, actual, verdict, detected) => ({ t0, t1, actual: actual || null, verdict, detected: detected || null });

function episodes(j, name = '') {
  const f = j && j.format || '';
  if (f.startsWith('pro-whooper-training') || f.startsWith('pro-whooper-session')) {
    const { loadLabels } = require('../test/lib.js'); const L = loadLabels(j), byRows = new Map();
    for (const l of L) { const e = byRows.get(l.rows) || { source: 'sim-calibration', trust: TRUST['sim-calibration'], kind: 'trace', name, rows: l.rows, camTilt: l.camTilt ?? j.camTilt ?? 20, labels: [] };
      e.labels.push(lab(l.repStart, l.t, l.verdict === 'yes' ? l.target : (l.actual && l.actual !== 'not a trick' ? l.actual : null), l.verdict, l.target)); byRows.set(l.rows, e); }
    return [...byRows.values()];
  }
  if (f === 'pro-whooper-video/1') return [{ source: 'video-review', trust: TRUST['video-review'], kind: 'frames', name, frames: j.frames.map(r => ({ t: r[0], rpy: r.slice(1) })), marks: j.marks || [],
    camTilt: j.analysis && j.analysis.camTilt, axisCleanup: !(j.analysis && j.analysis.axisCleanup === false),
    labels: (j.labels || []).map(l => lab(l.t0 ?? (l.det && l.det.t0), l.t1 ?? (l.det && l.det.t), l.verdict === 'yes' ? (l.det && l.det.name) : l.actual === 'not a trick' ? null : l.actual, l.verdict, l.det && l.det.name)) }];
  if (f === 'pro-whooper-labelled/1') return [{ source: j.source || 'blackbox-replay', trust: TRUST[j.source] ?? 0.9, kind: 'rates', name, samples: j.samples, cols: j.cols, marks: j.marks || [], camTilt: j.camTilt ?? 20,
    labels: (j.labels || []).map(l => lab(l.t0, l.t1, l.actual === 'not a trick' ? null : l.actual, l.verdict, l.detected)) }];
  if (f === 'pro-whooper-judge/1') return (j.verdicts || []).map(v => ({ source: 'judge', trust: TRUST.judge, kind: 'bot', name, trick: v.trick, seed: v.seed, human: !!v.human, camTilt: j.camTilt ?? 20,
    labels: [lab(0, 1e9, v.verdict === 'wrong' ? (v.lookedLike || null) : v.trick, v.verdict === 'wrong' ? 'no' : 'yes', v.trick)] }));
  if (f === 'pro-whooper-demo/1') return [];   // demos come in through calibration/demos/cases.json (windows where they're tracked)
  return [];
}
function demoEpisodes(dir) {
  const fs = require('fs'), path = require('path'); const C = JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8')).cases;
  return C.map(c => { const d = JSON.parse(fs.readFileSync(path.join(dir, c.file), 'utf8')), ms = (d.msPerFrame || 40) / 1000;
    const fr = d.frames.slice(c.frames[0], c.frames[1] + 1).map((r, i) => ({ t: i * ms, rpy: r }));
    return { source: 'demo', trust: TRUST.demo, kind: 'frames', name: c.file, frames: fr, marks: [], camTilt: d.cameraTiltDeg ?? 20, axisCleanup: true, labels: [lab(0, fr.length * ms, c.want[0], 'yes', c.want[0])] }; });
}
function botEpisodes(n = 3, seed = 7, tilt = 30) {
  const out = []; let sd = seed * 1000;
  for (const name of M.tricks) { if ((M.DRAFT_BOT || []).includes(name)) continue; for (let i = 0; i < n; i++) out.push({ source: 'bot', trust: TRUST.bot, kind: 'bot', name: `${name} #${i}`, trick: name, seed: ++sd, human: i % 2 === 1, tilt, camTilt: tilt, labels: [lab(0, 1e9, name, 'yes', name)] }); }
  return out;
}
// run the current detector on an episode -> [{ name, t }]
function run(ep) {
  if (ep.kind === 'trace') return replayTrace(ep.rows, { camTilt: ep.camTilt }).events.filter(e => e.name !== 'near' && e.name !== 'Crash').map(e => ({ name: e.name, t: e.t }));
  if (ep.kind === 'frames') {
    return V.detectClip(S, ep.frames, ep.marks, { camTilt: ep.camTilt ?? 20, axisCleanup: ep.axisCleanup }).map(e => ({ name: e.name, t: e.t }));
  }
  if (ep.kind === 'bot') { const m = M.make(ep.trick, world, ep.seed, { human: ep.human, tilt: ep.tilt || 0 }); return M.detect(m, world, ep.camTilt ?? 20).map(e => ({ name: e.name, t: 0.5 })); }
  if (ep.kind === 'rates') {   // body rates (deg/s) + sticks, like Blackbox Replay: attitude from the rates, open air + the pilot's marks
    const det = new S.TrickDetector({ objs: [], prims: [], spawn: { pos: S.v3(0, 1, 0) } }); det.camTilt = ep.camTilt ?? 20;
    const d = Object.create(S.Drone.prototype); Object.assign(d, { pos: S.v3(0, 6, 0), vel: S.v3(), q: { w: 1, x: 0, y: 0, z: 0 }, w: S.v3(), armed: true, crashed: false, contactThisStep: false });
    const c = ep.cols || ['t', 'roll', 'pitch', 'yaw', 'rollStick', 'pitchStick', 'yawStick', 'thr'], ix = k => c.indexOf(k), D = Math.PI / 180, out = [];
    const ms = [...ep.marks].sort((a, b) => a.t - b.t); let mi = 0, side = 1;
    for (let i = 1; i < ep.samples.length; i++) { const r = ep.samples[i], dt = r[0] - ep.samples[i - 1][0]; if (!(dt > 0 && dt < 0.1)) continue;
      while (mi < ms.length && ms[mi].t <= r[0]) { const mk = ms[mi++]; side = -side; det.crossLog.push({ t: det.time, obj: 9001, name: 'the obstacle', kind: mk.kind, dir: side, fwdDot: mk.back ? -1 : 1, latDot: mk.side ? 1 : 0, upY: d.up().y, spd: 4 }); }
      const w = S.v3(r[ix('pitch')] * D, -r[ix('yaw')] * D, -r[ix('roll')] * D), wm = Math.hypot(w.x, w.y, w.z); d.w = w; if (wm > 0) d.q = S.qnorm(S.qmul(d.q, S.qaxis(S.mul(w, 1 / wm), wm * dt)));
      const sub = Math.max(1, Math.round(dt / 0.002)); for (let k = 0; k < sub; k++) det.update(d, dt / sub, { roll: r[ix('rollStick')] || 0, pitch: r[ix('pitchStick')] || 0, yaw: r[ix('yawStick')] || 0, thr: r[ix('thr')] || 0 });
      for (const e of det.drain()) if (e.name !== 'near' && e.name !== 'Crash') out.push({ name: e.name, t: r[0] }); }
    return out;
  }
  return [];
}
module.exports = { TRUST, episodes, demoEpisodes, botEpisodes, run };
