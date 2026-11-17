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
  ['no false tricks near obstacles', () => { const o = run('fpsweep.js'); return /tricks: \{\}/.test(o) ? null : o; }],
  ...['session-flips-rolls.json', 'upload-roll-x5.json', 'training-v1-flip.json'].map(f => [`replay fixture ${f}`, () => { const o = run('replay.js', [path.join(__dirname, 'fixtures', f)]); const m = o.match(/(\d+)\/(\d+) labels agree/); return m && m[1] === m[2] ? null : o; }]),
];
let bad = 0;
for (const [name, fn] of checks) { const err = fn(); console.log(`${err ? '✗' : '✓'} ${name}`); if (err) { bad++; console.log(String(err).split('\n').slice(0, 25).map(l => '    ' + l).join('\n')); } }
console.log(bad ? `\n${bad} suite(s) failing` : '\nall suites passing'); process.exitCode = bad ? 1 : 0;
