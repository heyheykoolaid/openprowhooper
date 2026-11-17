// Runs every suite and fails if any regresses. `npm test`
const { execFileSync } = require('child_process'); const path = require('path');
const run = (f, args = []) => { try { return execFileSync('node', [path.join(__dirname, f), ...args], { encoding: 'utf8' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
const checks = [
  ['single tricks', () => { const o = run('t3.js'); const want = ['Flip', 'Flip', 'Roll', 'Double Roll', "Cubik's Rube", 'Yaw Spin', 'Invert Rewind', 'Inverted Yaw Spin', 'Segmented Flips/Rolls', 'Juicy Flick', 'Flip', 'Powerloop', 'Power Roll', 'Split-S', 'Segmented Flips/Rolls', 'Segmented Flips/Rolls', 'Segmented Flips/Rolls', 'Segmented Flips/Rolls', 'Flip', 'Flip', 'Roll', 'Double Flip', 'Double Roll', 'Yaw Spin', 'Invert Rewind', 'Invert Rewind', 'Vanny Roll', "Rubik's Cube", "Cubik's Rube", 'Juicy Flick', 'Inverted Yaw Spin'];
      const got = o.trim().split('\n').map(l => (l.split('-> ')[1] || '').split(' [')[0]); return want.every((w, i) => got[i] === w) ? null : 'got: ' + got.join(', '); }],
  ['obstacle timing', () => { const o = run('t4.js'); return /fake matty[^\n]*Flip \[/.test(o) && (o.match(/Powerloop \[CLEAN/g) || []).length === 3 && /matty flip \(forward[^\n]*Matty Flip/.test(o) ? null : o; }],
  ['fast combos', () => { const o = run('combo.js'); return /12\/12 combos correct/.test(o) ? null : o; }],
  ['powerloop vs maverick', () => { const o = run('loops.js'); return /\n5\/5/.test(o) ? null : o; }],
  ['phase-2 tricks + live counters', () => { const o = run('phase2.js'); const m = o.match(/(\d+)\/(\d+) phase-2/); return m && m[1] === m[2] ? null : o; }],
  ['tricktionary demo loops', () => { const o = run('demos.js'); const m = o.match(/(\d+)\/(\d+) demo loops/); return m && m[1] === m[2] ? null : o; }],
  ['demo GIF motion replay', () => { const o = run('demo-replay.js'); const m = o.match(/(\d+)\/(\d+) demo replays/); return m && m[1] === m[2] ? null : o; }],
  ['race rules (gates, laps, best 3 consecutive, validation)', () => { const o = run('race.js', []); return /(\d+)\/\1 race checks/.test(o) ? null : o.split('\n').filter(l => !l.startsWith('✓')).join('\n'); }],
  ['blackbox decoder matches orangebox on a real flight', () => { const o = run('bbl.js', []); return /(\d+)\/\1 blackbox decoder checks/.test(o) ? null : o.split('\n').filter(l => !l.startsWith('✓')).join('\n'); }],
  ['flight telemetry packing (round trip, size, same trick calls)', () => { const o = run('flightlog.js', []); return /(\d+)\/\1 flight log checks/.test(o) ? null : o; }],
  ['telemetry drop-off relay (formats, paths, no tokens)', () => { const o = run('dropoff.js', []); return /(\d+)\/\1 drop-off checks/.test(o) ? null : o; }],
  ['stress: randomised trick variations + near-misses', () => { const o = run('stress.js', ['--quick', '--seed=3']); const m = o.match(/STRESS (\d+)\/(\d+) fooled (\d+)/); return m && m[1] === m[2] && m[3] === '0' ? null : o.split('\n').filter(l => !l.startsWith('✓')).join('\n'); }],
  ['video review tracker (synthetic fisheye footage)', () => { const o = run('vision.js'); const m = o.match(/(\d+)\/(\d+) vision checks/); return m && m[1] === m[2] ? null : o; }],
  ['pilot feedback flights (wall ride, inverted yaw spin @30°, trippy vs DRT, matty, split-S vs jump rope)', () => { const o = run('feedback.js'); const m = o.match(/(\d+)\/(\d+) pilot-feedback/); return m && m[1] === m[2] ? null : o; }],
  ['stress with air between segments (30° camera, pilot rates)', () => { const o = run('stress.js', ['--quick', '--seed=7', '--tilt=30', '--air=0.6', '--slow=1.3']); const m = o.match(/STRESS (\d+)\/(\d+) fooled (\d+)/); return m && m[1] === m[2] && m[3] === '0' ? null : o.split('\n').filter(l => !l.startsWith('✓')).join('\n'); }],
  ['stress with humanized (drifting, bobbing) bot flights', () => { const o = run('stress.js', ['--quick', '--seed=11', '--tilt=30', '--human=1']); const m = o.match(/STRESS (\d+)\/(\d+) fooled (\d+)/); return m && m[1] === m[2] && m[3] === '0' ? null : o.split('\n').filter(l => !l.startsWith('✓')).join('\n'); }],
  ['stress at 30° camera tilt', () => { const o = run('stress.js', ['--quick', '--seed=6', '--tilt=30']); const m = o.match(/STRESS (\d+)\/(\d+) fooled (\d+)/); return m && m[1] === m[2] && m[3] === '0' ? null : o.split('\n').filter(l => !l.startsWith('✓')).join('\n'); }],
  ['no false tricks near obstacles', () => { const o = run('fpsweep.js'); return /tricks: \{\}/.test(o) ? null : o; }],
  ...['session-flips-rolls.json', 'upload-roll-x5.json', 'training-v1-flip.json'].map(f => [`replay fixture ${f}`, () => { const o = run('replay.js', [path.join(__dirname, 'fixtures', f)]); const m = o.match(/(\d+)\/(\d+) labels agree/); return m && m[1] === m[2] ? null : o; }]),
];
let bad = 0;
for (const [name, fn] of checks) { const err = fn(); console.log(`${err ? '✗' : '✓'} ${name}`); if (err) { bad++; console.log(String(err).split('\n').slice(0, 25).map(l => '    ' + l).join('\n')); } }
console.log(bad ? `\n${bad} suite(s) failing` : '\nall suites passing'); process.exitCode = bad ? 1 : 0;
