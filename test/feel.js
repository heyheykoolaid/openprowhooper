// The whoop feels like a whoop (2026-11-18, the owner's whoop-sim spec + BetaFPV's published motor data). node test/feel.js
//  - 0702 motors on the Gemfan 1219S make at least 90 % of BetaFPV's published max thrust x 0.92 (bench figures run high)
//  - the motors answer a small throttle step in under 30 ms on 65 mm whoops (spec: 10-20 ms; it was 40-50)
//  - hover sits at 25-42 % stick on the Air65s; thrust-to-weight of the racing build is 4.5-7
//  - no coasting: from 8 m/s on hover throttle, under half the speed is left after a second
//  - the ground cushion is there near the floor and gone by about one prop diameter
const { execFileSync } = require('child_process'), path = require('path');
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const PUB = { m0702se_23k: 28.3, m0702se_27k: 31.4, m0702ii_30k: 37.2 };   // g per motor on GF 1219S-3 (betafpv.com, 0702 / 0702SE originals and 0702 II)
for (const [m, g] of Object.entries(PUB)) { const t = S.buildDrone({ frame: 'air65', motor: m, prop: 'gf1219s', battery: 'b300', electronics: 'air' }).stats.staticPerMotorG;
  check(`${S.PARTS.motors[m].name} on GF 1219S: thrust near BetaFPV's figure`, t >= 0.9 * 0.92 * g && t <= 1.05 * g, `${t.toFixed(1)} g (published ${g} g)`); }
const R = JSON.parse(execFileSync('node', [path.join(__dirname, '..', 'tools', 'feelcheck.js'), 'Air65 Racing', 'Air65 Freestyle', 'Air65 Champion', '--json'], { encoding: 'utf8' }));
for (const r of R) {
  check(`${r.name}: motors answer a small throttle step in under 30 ms`, r.lagSmall < 30, `${r.lagSmall} ms`);
  check(`${r.name}: hovers at 25-42 % stick`, r.hoverStick >= 25 && r.hoverStick <= 42, `${r.hoverStick} %`);
  check(`${r.name}: no coasting (8 m/s → under 4 m/s in 1 s)`, r.coast < 4, `${r.coast} m/s`);
  const c = Object.fromEntries(r.cushion); check(`${r.name}: ground cushion near the floor, gone by a prop diameter`, c[0.3] > 0.15 && c[1] < c[0.3] * 0.4 && c[2] < 0.06, JSON.stringify(r.cushion)); }
{ const r = R.find(x => x.name === 'Air65 Racing'); check('Air65 Racing: thrust-to-weight 4.5-7', r.twr >= 4.5 && r.twr <= 7, `${r.twr}`); }
console.log(`\n${ok}/${n} feel checks`); if (ok !== n) process.exit(1);
