// Local check (needs the demo GIF frames, which are not in the repo): the in-browser tracker (src/vision.js) on real
// demo clips dumped as raw grayscale to /tmp/vbin/<clip>.bin (u32 W, H, N, then N frames). Prints per-clip detections.
require('/home/claude/openprowhooper/src/tricks.js'); require('/home/claude/openprowhooper/src/sim.js'); require('/home/claude/openprowhooper/src/vision.js');
const S = globalThis.Sim, V = globalThis.Vision, fs = require('fs');
const CASES = [['3-roll', 43, ['Roll']], ['8-vanny-roll', 31, ['Vanny Roll']], ['5-segmented', 38, ['Segmented Flips/Rolls', 'Segmented Flips/Rolls']], ['13-inverted-yaw-spin', 43, ['Inverted Yaw Spin']],
  ['9-rubiks-cube', 33, ["Rubik's Cube"]], ['10-cubiks-rube', 35, ["Cubik's Rube"]], ['6-yaw-spin', 40, ['Yaw Spin']], ['4-double-roll', 33, ['Double Roll']], ['1-flip', 40, ['Flip']], ['2-double-flip', 40, ['Double Flip']],
  ['11-juicy-flick', 34, ['Juicy Flick']], ['7-inverted-rewind', 40, ['Invert Rewind', 'Invert Rewind', 'Invert Rewind', 'Invert Rewind']]];
const hfov = +(process.env.HFOV || 130), cleanup = process.env.CLEAN !== '0';
let ok = 0;
for (const [c, ms, want] of CASES) {
  const b = fs.readFileSync(`/tmp/vbin/${c}.bin`), W = b.readUInt32LE(0), H = b.readUInt32LE(4), N = b.readUInt32LE(8);
  const tr = new V.Tracker({ hfov }); const frames = [];
  for (let i = 0; i < N; i++) { const d = new Float32Array(W * H); for (let k = 0; k < W * H; k++) d[k] = b[12 + i * W * H + k]; const r = tr.push({ w: W, h: H, d }); if (r && r.dup) continue; frames.push({ t: i * ms / 1000, rpy: r ? r.rpy : [0, 0, 0] }); }   // r.rpy already corrected in place by loop closure
  const sum = [0, 1, 2].map(k => Math.round(frames.reduce((s, f) => s + (f.rpy ? f.rpy[k] : 0), 0)));
  const names = V.detectClip(S, frames, [], { camTilt: 20, axisCleanup: cleanup }).map(e => e.name), good = JSON.stringify(names) === JSON.stringify(want); if (good) ok++;
  console.log(`${good ? '✓' : '✗'} ${c.padEnd(22)} sum R ${sum[0]} P ${sum[1]} Y ${sum[2]}  closures ${JSON.stringify((tr.corrections||[]).map(x=>x.chained+'→'+x.closed))}  -> ${names.join(' + ') || 'nothing'}`);
}
console.log(`${ok}/${CASES.length} (hfov ${hfov}, cleanup ${cleanup})`);
