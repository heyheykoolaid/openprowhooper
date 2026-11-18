// Big sweeping moves (owner, 2026-11-18: "several Matty flips in a row in open air didn't count"; "can the game accommodate
// bigger / sweeping movements"). A sweeping open-air Matty: punch up ~12 m flipping forward slowly (ends under the token
// threshold, ~160 °/s at the fastest), over the top upside-down, fall back flying backward. The sweep witness (normalized)
// and the big-sweep path rule (matchOpenLoop) must call it a Matty Flip; a big slow powerloop must stay a Powerloop.
const path = require('path'); require(path.join(__dirname, '..', 'src', 'tricks.js')); require(path.join(__dirname, '..', 'src', 'sim.js'));
const S = globalThis.Sim, world = S.buildPlayground(); let ok = 0, n = 0;
const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const ease = s => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, s)))) / 2;
// one flight: level in, then over T seconds the body pitches by `bodyDeg` while the velocity turns up and over by `pathDeg`
function fly({ bodyDeg, pathDeg, T, speed = 6, out = 1.6, x = 70, z0 = 40, y0 = 3, w = world }) {
  const rows = [], HZ = 100, lead = 1.0, dt = 1 / HZ; let p = { x, y: y0, z: z0 }, th = 0;
  for (let t = 0; t <= lead + T + out; t += dt) {
    const s = (t - lead) / T, e = ease(s), phi = pathDeg * e * Math.PI / 180, thN = bodyDeg * e, rate = t > lead && t < lead + T ? (thN - th) / dt : 0;
    th = thN; const sp = t < lead ? speed : speed * (0.65 + 0.35 * Math.abs(Math.cos(phi)));
    const v = t > lead + T ? { x: 0, y: -0.2, z: -Math.cos(pathDeg * Math.PI / 180) * speed * 0.8 } : { x: 0, y: Math.sin(phi) * sp, z: -Math.cos(phi) * sp };
    p = { x: p.x, y: p.y + v.y * dt, z: p.z + v.z * dt }; const a = th * Math.PI / 180 / 2;
    rows.push([t, p.x, p.y, p.z, Math.cos(a), Math.sin(a), 0, 0, 0, rate, 0, 0.6, 0, 1, 0, 0, 0, 0, -1, 0, 0, v.x, v.y, v.z, 0, rate < -40 ? -0.7 : rate > 40 ? 0.7 : 0, 0]); }
  return S.replayTrace(rows, { world: w, camTilt: 20 }).events.map(e => e.name);
}
const matty = fly({ bodyDeg: -360, pathDeg: 200, T: 3.5 });
check('a big sweeping open-air Matty (12 m up, 3.5 s, slow ends) is a Matty Flip', matty.includes('Matty Flip'), matty.join(', ') || 'nothing');
const matty2 = fly({ bodyDeg: -360, pathDeg: 230, T: 4.2, speed: 7 });
check('…a slower, longer one too', matty2.includes('Matty Flip'), matty2.join(', ') || 'nothing');
const loop = fly({ bodyDeg: 360, pathDeg: 360, T: 3.2, speed: 7, out: 1.4 });
check('a big slow powerloop is not a Matty', !loop.includes('Matty Flip') && !loop.includes('Anti Matty'), loop.join(', ') || 'nothing');
const halfFlip = fly({ bodyDeg: -170, pathDeg: 40, T: 2.5 });
check('a slow half flip is no full flip', !halfFlip.some(x => /Matty|^Flip$/.test(x)), halfFlip.join(', ') || 'nothing');
// beside Clappy Park's shops the sweep brushes an awning, a window and the façade trim: still an open-air Matty (owner's run)
{ require(path.join(__dirname, '..', 'src', 'maps.js')); const cw = S.MAPS.clappy.build(); const m = fly({ bodyDeg: -360, pathDeg: 230, T: 3.5, x: 20, z0: -16, w: cw });
  check('a sweeping Matty beside the shops (passes awnings and trim on the way) is still a Matty Flip', m.includes('Matty Flip'), m.join(', ') || 'nothing'); }
console.log(`\n${ok}/${n} sweep checks`); if (ok !== n) process.exitCode = 1;
