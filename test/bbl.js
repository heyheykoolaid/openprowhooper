// Betaflight blackbox decoder (src/bbl.js) against orangebox on a real flight from the pilot's flash dump.
require('../src/bbl.js');
const fs = require('fs'), path = require('path'), F = path.join(__dirname, 'fixtures', 'bbl');
const bytes = new Uint8Array(fs.readFileSync(path.join(F, 'flight13.bbl'))), ref = JSON.parse(fs.readFileSync(path.join(F, 'flight13.orangebox.json'), 'utf8'));
let pass = 0, total = 0; const ok = (n, c, info = '') => { total++; if (c) pass++; console.log(`${c ? '✓' : '✗'} ${n}${c ? '' : '   ' + info}`); };
const logs = globalThis.BBL.decode(bytes, { fields: ref.cols });
ok('one flight found', logs.length === 1, logs.length);
const L = logs[0]; ok('same number of frames as orangebox', L.rows.length === ref.rows.length, `${L.rows.length} vs ${ref.rows.length}`);
let diff = 0; for (let i = 0; i < Math.min(L.rows.length, ref.rows.length); i++) for (let k = 0; k < ref.cols.length; k++) if (L.rows[i][k] !== ref.rows[i][k]) diff++;
ok('every value identical (time, gyro, setpoint, rcCommand, motors, eRPM, acc, vbat, current)', diff === 0, diff + ' differ');
ok('headers parsed (firmware, rates)', /Betaflight 4\.5/.test(L.headers['Firmware revision']) && L.headers.rc_rates === '17,17,17');
const R = globalThis.BBL.ratesFromHeaders(L.headers); ok('ACTUAL rates read: 170 centre / 580 max / 0.23 expo', R.type === 'ACTUAL' && R.rates.roll.center === 170 && R.rates.roll.max === 580 && Math.abs(R.rates.roll.expo - 0.23) < 1e-9, JSON.stringify(R));
ok('disarm and end-of-log events read', L.events.some(e => e.type === 15) && L.events.some(e => e.type === 255), JSON.stringify(L.events.map(e => e.type)));
// junk and truncation don't throw
const junk = new Uint8Array(bytes.length); junk.set(bytes); for (let i = 3000; i < 3400; i++) junk[i] = (i * 37) & 255;
let threw = false, J; try { J = globalThis.BBL.decode(junk, { fields: ref.cols }); } catch { threw = true; }
ok('corrupt bytes are skipped, not fatal', !threw && J[0].rows.length > ref.rows.length * 0.6 && J[0].corrupt > 0, threw ? 'threw' : `${J[0].rows.length} rows, ${J[0].corrupt} bad`);
let threw2 = false; try { globalThis.BBL.decode(bytes.subarray(0, 5000)); } catch { threw2 = true; } ok('a truncated file is fine', !threw2);
console.log(`\n${pass}/${total} blackbox decoder checks`); if (pass !== total) process.exitCode = 1;
