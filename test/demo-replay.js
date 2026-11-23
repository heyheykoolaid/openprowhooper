// Replays the rotation measured from the prowhooper.com demo GIFs (calibration/demos/*.json) straight into the
// detector: Tyrantt's actual motion, not a reconstruction. Open-air tricks only (the GIFs carry no position), and
// only clips where the trick itself is tracked well enough (blurred gaps of <= 3 frames are linearly filled).
require('../src/tricks.js'); require('../src/sim.js');
const S = globalThis.Sim; const W = S.buildPlayground(); const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'calibration', 'demos'); const D = Math.PI / 180; const MODE = process.env.MODE || 'dominant';
const CASES = process.env.EXTRA ? JSON.parse(process.env.EXTRA) : [   // file, frame window around the trick, expected detections
  ['roll.json', [8, 30], ['Roll']],
  ['vanny-roll.json', [4, 80], ['Vanny Roll']],
  ['segmented.json', [26, 60], ['Segmented Flips/Rolls']],
  ['segmented.json', [72, 104], ['Segmented Flips/Rolls']],
  ['inverted-yaw-spin.json', [12, 48], ['Inverted Yaw Spin']],
  ["rubiks-cube.json", [18, 64], ["Rubik's Cube"]],
  ["cubiks-rube.json", [20, 68], ["Cubik's Rube"]],
  ['yaw-spin.json', [4, 30], ['Yaw Spin']],
  ['inverted-rewind.json', [52, 86], ['Inverted Rewind']],   // added with the advanced pass (tools/gif_rotation2.py)
];
function fill(frames, a, b) {     // linearly fill short blurred gaps; report anything longer
  const out = frames.slice(a, b + 1); let longest = 0;
  for (let i = 0; i < out.length; i++) if (!out[i]) {
    let j = i; while (j < out.length && !out[j]) j++; longest = Math.max(longest, j - i);
    const L = out[i - 1] || out[j] || [0, 0, 0], R = out[j] || L;
    for (let k = i; k < j; k++) { const u = (k - i + 1) / (j - i + 1); out[k] = L.map((v, m) => v + (R[m] - v) * u); }
    i = j;
  }
  return { out, longest };
}
let pass = 0, total = 0;
for (const [file, [a, b], want] of CASES) {
  const demo = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'), globalThis.Sim && globalThis.Sim.canonReviver);
  const ms = demo.msPerFrame, al = (demo.cameraTiltDeg ?? 20) * D, ca = Math.cos(al), sa = Math.sin(al);
  const { out, longest } = fill(demo.frames, a, b);
  const det = new S.TrickDetector(W), sk = new S.ScoreKeeper();
  const d = Object.create(S.Drone.prototype); Object.assign(d, { pos: S.v3(0, 6, -40), vel: S.v3(), q: { w: 1, x: 0, y: 0, z: 0 }, w: S.v3(), armed: true, crashed: false, contactThisStep: false });
  const dt = 0.002, sub = Math.round(ms / 1000 / dt);
  const step = (w, n) => { for (let i = 0; i < n; i++) { d.w = w; const ang = Math.hypot(w.x, w.y, w.z) * dt; if (ang > 0) d.q = S.qnorm(S.qmul(d.q, S.qaxis(S.mul(w, 1 / Math.hypot(w.x, w.y, w.z)), ang))); det.update(d, dt); } };
  step(S.v3(), 300);                                           // settle
  for (const [rc, pc, yc] of out) {
    // camera frame -> body. 'tilt': undo a fixed camera uptilt (breaks when the quad is moving near objects: parallax
    // biases the yaw/roll split). 'dominant' (default): one axis at a time, as in these open-air tricks — the frame's
    // roll+yaw goes to whichever of the two dominates, pitch stays.
    let roll, yaw, pitch = pc;
    if (MODE === 'tilt') { roll = rc * ca - yc * sa; yaw = rc * sa + yc * ca; }
    else { const m = Math.hypot(rc, yc); if (Math.abs(rc) >= Math.abs(yc)) { roll = Math.sign(rc) * m; yaw = 0; } else { yaw = Math.sign(yc) * m; roll = 0; } }
    const k = D / (ms / 1000);                                 // deg per frame -> rad/s
    step(S.v3(pitch * k, -yaw * k, -roll * k), sub);           // pilotRates = [-w.z, w.x, -w.y] = [roll, pitch, yaw]
  }
  step(S.v3(), 1500);
  const ev = det.drain().filter(e => e.name !== 'near'); const got = ev.map(e => e.name);
  if (process.env.DBG && file.includes(process.env.DBG)) console.log('   toks', det.toks.map(k => k.ax + (k.dir > 0 ? '+' : '-') + Math.round(k.raw) + '@' + k.t0.toFixed(2) + '-' + k.t1.toFixed(2) + ' ' + Math.round(k.rateSum / k.n) + 'dps').join('  '));
  const ok = JSON.stringify(got) === JSON.stringify(want); total++; if (ok) pass++;
  console.log(`${ok ? '✓' : '✗'} ${(demo.trick + ' [' + a + '-' + b + ']').padEnd(34)} -> ${ev.map(e => `${e.name} [${e.exec}] toks:${(e.toks || []).map(t => t.ax + (t.dir > 0 ? '+' : '-') + Math.round(t.raw) + (t.inv ? 'i' : '')).join(' ')}`).join(' | ') || 'nothing'}` +
    `   (tilt ${demo.cameraTiltDeg ?? '20?'}°, ${ms} ms/frame${longest ? ', longest filled gap ' + longest : ''})${ok ? '' : '   want ' + want.join(', ')}`);
}
console.log(`\n${pass}/${total} demo replays (${MODE})`);
