// Flight telemetry packing: the packed trace must decode to the same flight (within the stored precision) and replay
// to the same trick calls. usage: node test/flightlog.js
const fs = require('fs'), path = require('path');
const FL = require('../src/flightlog.js'); const { replayTrace } = require('./lib.js');
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
(async () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'session-flips-rolls.json'), 'utf8'));
  const rows = j.run.trace, cols = j.run.cols || ['t', 'x', 'y', 'z', 'qw', 'qx', 'qy', 'qz', 'rollRate', 'pitchRate', 'yawRate', 'thr', 'contact', 'armed', 'crashed', 'cnx', 'cny', 'cnz', 'cObj', 'cImpact', 'cGround', 'vx', 'vy', 'vz', 'rollStick', 'pitchStick', 'yawStick'].slice(0, rows[0].length);
  const raw = JSON.stringify(rows).length, tr = await FL.pack(rows, cols, j.run.hz || 100), back = await FL.unpack(tr);
  check('row and column counts survive', back.length === rows.length && back[0].length === rows[0].length);
  let worst = 0, col = '';
  for (let i = 0; i < rows.length; i++) for (let c = 0; c < cols.length; c++) { const e = Math.abs(back[i][c] - rows[i][c]) * (FL.SCALE[cols[c]] || 1); if (e > worst) { worst = e; col = cols[c]; } }
  check('every value within half a stored step', worst <= 0.5 + 1e-6, `worst ${worst.toFixed(3)} steps (${col})`);
  check('packed trace is at least 8× smaller than the JSON rows', tr.data.length * 8 < raw, `${(raw / 1024).toFixed(0)} KB → ${(tr.data.length / 1024).toFixed(0)} KB (${(tr.data.length / 1024 / (rows.length / 6000)).toFixed(0)} KB/min)`);
  const names = R => R.events.filter(e => e.name !== 'near').map(e => e.name + '@' + e.t.toFixed(1)).join(' ');
  const a = names(replayTrace(rows, { camTilt: j.camTilt })), b = names(replayTrace(back, { camTilt: j.camTilt }));
  check('the unpacked flight replays to the same trick calls', a === b && a.length > 0, a === b ? `${a.split(' ').length} calls` : `\n   raw:    ${a}\n   packed: ${b}`);
  check('plain (no deflate) encoding round-trips', JSON.stringify(FL.decode(FL.encode(rows.slice(0, 500), cols), cols, 500)) === JSON.stringify(back.slice(0, 500)));
  let threw = false; try { await FL.unpack({ enc: 'something-else', data: '', cols, rows: 1 }); } catch { threw = true; }
  check('unknown encodings are refused', threw);
  const s = FL.summary(rows, cols, 100); check('summary has sane numbers', s.seconds > 1 && s.armedSeconds <= s.seconds && s.peakRates.every(v => v >= 0), JSON.stringify(s));
  console.log(`\n${ok}/${n} flight log checks`); process.exitCode = ok === n ? 0 : 1;
})();
