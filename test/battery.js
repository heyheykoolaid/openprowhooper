// Battery life, the end of the pack and which packs fit which whoop. node test/battery.js
//  - flown hard, a whoop's pack lasts minutes, sags as it empties, then the AIO browns out and the quad drops
//  - Battery life off (tune.batteryLife = false): the pack never runs down
//  - batteries and electronics only fit frames with the same cell count, in the frame's size range; fitParts fixes a misfit
require('../src/tricks.js'); require('../src/sim.js'); const S = globalThis.Sim;
const W = { objs: [], prims: [], zones: [], spawn: { pos: S.v3(0, 0.03, 0), yaw: 0 } };
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
function flyPack(preset, life = true, maxS = 900, extra = {}) {
  const P = S.buildDrone(typeof preset === 'string' ? S.PRESETS[preset] : preset), tune = Object.assign(S.defaultTune(), extra); tune.batteryLife = life; const d = new S.Drone(P, tune, W);
  d.reset({ pos: S.v3(0, 20, 0), yaw: 0 }); d.armed = true; const hov = P.stats.hoverThrottle; let t = 0, v30 = null, vEnd = null;
  // freestyle-ish: throttle swings round hover with punches, held in the air (the position is pinned so it never lands)
  for (; t < maxS && d.armed; t += 0.001) { const thr = Math.min(1, hov + 0.12 + 0.25 * Math.max(0, Math.sin(t * 1.7))); d.step({ thr, roll: 0, pitch: 0, yaw: 0 }, 0.001); d.pos = S.v3(0, 20, 0); d.vel = S.v3(); d.q = { w: 1, x: 0, y: 0, z: 0 }; d.w = S.v3();
    if (v30 == null && t >= 30) v30 = d.vbat; if (d.soc > 0.05) vEnd = d.vbat; }
  return { t, soc: d.soc, brown: d.brownout, v30, vEnd, mAh: d.mAh, cap: P.bat.cap };
}
const a = flyPack('Air65 Racing');
check('Air65 on a 300 mAh pack: a few minutes of hard flying, then it browns out', a.brown && a.t > 90 && a.t < 420, `${(a.t / 60).toFixed(1)} min, ${Math.round(a.mAh)} of ${a.cap} mAh used, soc ${a.soc.toFixed(2)}`);
check('the voltage sags as the pack empties', a.v30 > a.vEnd + 0.15, `${a.v30.toFixed(2)} V at 30 s → ${a.vEnd.toFixed(2)} V near the end`);
const b = flyPack('85mm 2S (Mobula8 style)');
check('an 85 mm 2S on 450 mAh lasts minutes too, and browns out', b.brown && b.t > 90 && b.t < 480, `${(b.t / 60).toFixed(1)} min`);
const c = flyPack('Air65 Racing', false, 420);
check('Battery life off: the pack never runs down', !c.brown && c.soc === 1 && c.t >= 419, `${(c.t / 60).toFixed(1)} min, soc ${c.soc}`);
// battery drain (tune.drain, the game's 3.2: real whoops draw about three times what the motor model alone does, Blackbox
// 2026-11-19): the same flying empties the pack about three times sooner; absent = the physics as it was
{ const g = flyPack('Air65 Racing', true, 900, { drain: 3.2 });
  check('with the game\'s battery drain the same pack lasts about a third as long', g.brown && g.t < a.t * 0.45 && g.t > a.t * 0.2, `${(g.t / 60).toFixed(1)} min vs ${(a.t / 60).toFixed(1)} min`); }
check('the LAVA II 280 / 320 mAh packs fit a 65 mm 1S frame', S.batteryFits('air65', 'lava280') && S.batteryFits('air65', 'lava320') && S.PARTS.batteries.lava320.mass === 8.2);
// the game's prop fit (tune.propCt 1.31 / propCq 1.8; absent = 1): the owner's Air65 build hovers near 34k rpm (the parts alone
// ~38k, a real one 31k) on less throttle, with the same top-end thrust
{ const hov = (ct, cq) => { const P = S.buildDrone({ frame: 'air65', motor: 'm0702ii_30k', prop: 'hq31ul', battery: 'b300', electronics: 'air' }), tune = Object.assign(S.defaultTune(), { batteryLife: false, weightFeel: 0.9, propCt: ct, propCq: cq }), d = new S.Drone(P, tune, W);
    d.reset({ pos: S.v3(0, 50, 0), yaw: 0 }); d.armed = true; d.soc = 0.6; let thr = 0.35, w = 0, n = 0; for (let k = 0; k < 5000; k++) { d.step({ thr, roll: 0, pitch: 0, yaw: 0 }, 0.001); thr = Math.min(1, Math.max(0, thr - d.vel.y * 0.0004)); if (k > 2500) { w += d.motorW.reduce((a, x) => a + Math.abs(x), 0) / 4; n++; } }
    const e = new S.Drone(P, tune, W); e.reset({ pos: S.v3(0, 50, 0), yaw: 0 }); e.armed = true; e.soc = 0.6; let T = 0; for (let k = 0; k < 1200; k++) { e.step({ thr: 1, roll: 0, pitch: 0, yaw: 0 }, 0.001); e.pos = S.v3(0, 50, 0); e.vel = S.v3(); if (k > 1000) T += e.thrust.reduce((a, x) => a + x, 0); }
    return { rpm: w / n * 60 / 2 / Math.PI, thr, T: T / 200 }; };
  const a0 = hov(1, 1), a1 = hov(1.31, 1.8);
  check('the fitted props hover near 34k rpm on less throttle, with the same top thrust', a1.rpm > 32500 && a1.rpm < 35500 && a0.rpm > 36500 && a1.thr < a0.thr && Math.abs(a1.T / a0.T - 1) < 0.04, `${Math.round(a0.rpm)} → ${Math.round(a1.rpm)} rpm, throttle ${a0.thr.toFixed(2)} → ${a1.thr.toFixed(2)}, top thrust ×${(a1.T / a0.T).toFixed(3)}`); }
// what fits
check('a 65 mm 1S frame takes 1S 250-380 mAh, not a 450 or a 2S pack', S.batteryFits('air65', 'b300') && S.batteryFits('air65', 'b380') && !S.batteryFits('air65', 'b450') && !S.batteryFits('air65', 'b2s300'));
check('a 75 mm 1S frame takes up to 550 mAh 1S', S.batteryFits('meteor75', 'b550') && S.batteryFits('air75', 'b450') && !S.batteryFits('air75', 'b260'));
check('2S frames take 2S packs only', S.batteryFits('whoop75_2s', 'b2s300') && !S.batteryFits('whoop75_2s', 'b300') && S.batteryFits('whoop85_2s', 'b2s550') && !S.batteryFits('whoop85_2s', 'b2s300'));
check('electronics match the cells', S.electronicsFit('air65', 'air') && !S.electronicsFit('air65', 'aio2s') && S.electronicsFit('whoop85_2s', 'aio2s'));
const f = S.fitParts({ frame: 'whoop85_2s', motor: 'm1103_11k', prop: 'p51_4b', battery: 'b300', electronics: 'air' });
check('fitParts swaps a misfit for the nearest that fits', f.battery === 'b2s450' && f.electronics === 'aio2s', JSON.stringify(f));
check('every preset already fits', Object.values(S.PRESETS).every(p => S.batteryFits(p.frame, p.battery) && S.electronicsFit(p.frame, p.electronics)), Object.entries(S.PRESETS).filter(([, p]) => !S.batteryFits(p.frame, p.battery) || !S.electronicsFit(p.frame, p.electronics)).map(([k]) => k).join(', '));
// owner, 2026-11-26 (mistawintaz: brownouts from full throttle on the 75 mm 2S, battery life off): off = no battery at all; on, a full
// pack held at full throttle for 2.5 s never browns out, game drain and prop fit included (the sag used to oscillate to its floor)
{ const W = { objs: [], prims: [], zones: [], spawn: { pos: S.v3(0, 0.03, 0), yaw: 0 } };
  for (const life of [false, true]) for (const name of ['75mm 2S (Mobula7 style)', 'Air65 Racing', 'Air65 II Champion', '85mm 2S (Mobula8 style)']) {
    const P = S.buildDrone(S.PRESETS[name]), t = S.defaultTune(); Object.assign(t, { batteryLife: life, drain: 2.4, propCt: 1.31, propCq: 1.8 }); const d = new S.Drone(P, t, W); d.reset({ pos: S.v3(0, 30, 0), yaw: 0 }); d.armed = true;
    let vmin = 99; for (let k = 0; k < 3000; k++) { d.step({ thr: k < 500 ? 0.4 : 1, roll: 0, pitch: 0, yaw: 0 }, 0.001); d.pos = S.v3(0, 30, 0); d.vel = S.v3(); if (k > 5) vmin = Math.min(vmin, d.vbat / P.bat.cells); }
    check(`${name}, battery life ${life ? 'on' : 'off'}: full throttle on a full pack, no brownout${life ? '' : ', no sag, pack stays full'}`, !d.brownout && d.armed && (life ? vmin > 2.6 : vmin > 4.2 && d.soc === 1), `lowest ${vmin.toFixed(2)} V/cell`); } }
console.log(`\n${ok}/${n} battery checks`); if (ok !== n) process.exit(1);
