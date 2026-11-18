// RaceGOW (src/racegow.js): track format, building blocks, gate passing, laps/sectors/deltas, ghosts, checks, tools,
// and the physics hooks it relies on (surfaces, fields). node test/racegow.js
require('../src/tricks.js'); require('../src/sim.js'); const RG = require('../src/racegow.js');
const S = globalThis.Sim, { v3 } = S;
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// --- every element builds, with sane parts
for (const [type, C] of Object.entries(RG.CATALOG)) {
  const e = RG.newElement(type, { x: 1, z: -2, ry: 30 }), parts = RG.elementParts(e, { section: RG.U });
  ok(parts.vis.length + parts.fields.length + parts.gates.length > 0, type + ' builds something');
  if (C.gate) ok(parts.gates.length > 0, type + ' has a checkpoint');
  for (const pr of parts.prims) ok(isFinite(pr.aabb.min.x) && isFinite(pr.aabb.max.y), type + ' finite collider');
}

// --- crossing: a 40 cm square gate facing -z at the origin, lifted 0.35
const T = RG.newTrack({ venue: { kind: 'room', room: 'hall' } });
const g = RG.newElement('gateSquare', { x: 0, z: 0 }); const cp = RG.elementParts(g, {}).gates[0];
ok(RG.crossing(cp, v3(0, 0.55, 0.2), v3(0, 0.55, -0.2)) === 1, 'through the gate the right way');
ok(RG.crossing(cp, v3(0, 0.55, -0.2), v3(0, 0.55, 0.2)) === -1, 'through it backward');
ok(RG.crossing(cp, v3(0.3, 0.55, 0.2), v3(0.3, 0.55, -0.2)) === 0, 'beside it');
ok(RG.crossing(cp, v3(0, 0.9, 0.2), v3(0, 0.9, -0.2)) === 0, 'over it');
const gc = RG.elementParts(RG.newElement('gateCircle', {}), {}).gates[0];
ok(RG.crossing(gc, v3(0.17, 0.72, 0.1), v3(0.17, 0.72, -0.1)) === 0 && RG.crossing(gc, v3(0.1, 0.55, 0.1), v3(0.1, 0.55, -0.1)) === 1, 'round gate is round (corner misses)');
const gt = RG.elementParts(RG.newElement('gateTriangle', { ry: 90 }), {}).gates[0];   // turned: flown toward -x
ok(RG.crossing(gt, v3(0.1, 0.45, 0), v3(-0.1, 0.45, 0)) === 1, 'turned triangle gate');
const gs = RG.elementParts(RG.newElement('split', {}), {}).gates[0];
ok(RG.crossing(gs, v3(-0.45, 0.55, 0.1), v3(-0.45, 0.55, -0.1)) === 1 && RG.crossing(gs, v3(0.45, 0.55, 0.1), v3(0.45, 0.55, -0.1)) === 1 && RG.crossing(gs, v3(0, 0.55, 0.1), v3(0, 0.55, -0.1)) === 0, 'split gate: either opening, not between');
const big = RG.elementParts({ ...RG.newElement('gateSquare', {}), s: 2 }, {}).gates[0];
ok(RG.crossing(big, v3(0.35, 1.0, 0.1), v3(0.35, 1.0, -0.1)) === 1, 'scaled gate scales its opening');

// --- a loop: start, three gates in a line, back round to the start
function lineTrack(mode) {
  const t = RG.newTrack({ venue: { kind: 'room', room: 'hall' } }); t.elements = [];
  t.elements.push(RG.newElement('start', { x: 0, z: 4 })); for (const z of [2, 0, -2]) t.elements.push(RG.newElement('gateSquare', { x: 0, z }));
  return t; }
const t1 = lineTrack(), B = RG.buildTrack(t1);
ok(B.seq.length === 4 && B.loop, 'route: start + 3 gates, a loop');
function flyLap(race, t0, dt = 0.02, speed = 4) {   // a lap: down the line through the gates, round, back through the start
  const ev = [], pts = []; for (let z = 5; z >= -3; z -= 0.1) pts.push(v3(0, 0.5, z)); for (let a = 0; a <= Math.PI; a += 0.1) pts.push(v3(1.5 - 1.5 * Math.cos(a), 0.5, -3 - 1.5 * Math.sin(a) * 0 + 0)); for (let z = -3; z <= 5; z += 0.1) pts.push(v3(3, 0.5, z)); for (let a = 0; a <= Math.PI; a += 0.1) pts.push(v3(1.5 + 1.5 * Math.cos(a), 0.5, 5));
  let t = t0; for (let i = 1; i < pts.length; i++) { t += dt * (0.1 / (speed * dt)); ev.push(...race.step(pts[i - 1], pts[i], t)); } return { ev, t }; }
let R = new RG.Race(B, { mode: 'timeattack', laps: 2 }), r1 = flyLap(R, 0), r2 = flyLap(R, r1.t);
const all = [...r1.ev, ...r2.ev], laps = all.filter(e => e.type === 'lap');
ok(all[0].type === 'start', 'first crossing of the start starts the clock');
ok(laps.length === 1 && all.some(e => e.type === 'gate' && e.i === 3), 'gates in order, first lap closes at the start');
// second lap closes when the start is crossed after the last gate; then finish
const r3 = flyLap(R, r2.t), fin = [...r3.ev].find(e => e.type === 'finish');
ok(fin && fin.laps.length === 2 && R.done, 'time attack: finished after 2 laps');
ok(fin && near(fin.total, fin.laps[0] + fin.laps[1], 1e-6), 'total = sum of laps');
// skipping a gate: fly round it
R = new RG.Race(B, { mode: 'hotlaps' }); R.step(v3(0, 0.5, 4.2), v3(0, 0.5, 3.8), 0); const sk = R.step(v3(0, 0.5, 0.2), v3(0, 0.5, -0.2), 1);
ok(sk.some(e => e.type === 'skip') && R.next === 1, 'flying through a later gate is a skip, the wanted gate stays wanted');
ok(R.step(v3(0, 0.5, 1.8), v3(0, 0.5, 2.2), 1.2).some(e => e.type === 'wrong'), 'backward through the wanted gate is "wrong way"');
// hot laps: best lap, sectors and deltas against a reference
R = new RG.Race(B, { mode: 'hotlaps' }); const h1 = flyLap(R, 0, 0.02, 3), h2 = flyLap(R, h1.t, 0.02, 4);
const L = [...h1.ev, ...h2.ev, ...flyLap(R, h2.t, 0.02, 4).ev].filter(e => e.type === 'lap');
ok(L.length >= 2 && R.bestLap === Math.min(...R.lapTimes), 'hot laps: best lap tracked');
ok(R.sectors.length >= 1 && L[0].sectors.length === R.sectors.length, 'sectors timed every lap');
const R2 = new RG.Race(B, { mode: 'hotlaps', ref: { gateTimes: L[0].gateTimes } }); const q1 = flyLap(R2, 0, 0.02, 4), d = [...q1.ev, ...flyLap(R2, q1.t, 0.02, 4).ev].filter(e => e.type === 'gate' && e.delta != null);
ok(d.length > 0 && d.every(e => e.delta < 0.01), 'faster lap shows a negative delta to the slower reference');
// point to point
const tp = lineTrack(); tp.elements.push(RG.newElement('finish', { x: 0, z: -4 })); const Bp = RG.buildTrack(tp);
ok(!Bp.loop, 'a finish makes it point to point'); const Rp = new RG.Race(Bp, { mode: 'timeattack' }); let tt = 0, evp = [];
for (let z = 5; z >= -5; z -= 0.1) { tt += 0.025; evp.push(...Rp.step(v3(0, 0.5, z + 0.1), v3(0, 0.5, z), tt)); }
ok(evp.some(e => e.type === 'finish'), 'point to point finishes at the finish');

// --- ghosts: pack, unpack, sample
const sm = []; for (let i = 0; i <= 300; i++) { const t = i / 100, a = t; sm.push({ t, p: v3(Math.sin(a), 0.5 + t * 0.1, Math.cos(a)), q: S.qnorm({ w: Math.cos(a / 2), x: 0, y: Math.sin(a / 2), z: 0 }) }); }
const gh = RG.packGhost(sm), un = RG.unpackGhost(JSON.parse(JSON.stringify(gh)));
ok(gh.n === 91 && un.length === 91, 'ghost resampled at 30 Hz');
const sg = RG.sampleGhost(un, 1.5); ok(sg && Math.abs(sg.p.x - Math.sin(1.5)) < 0.01 && Math.abs(sg.q.y - Math.sin(0.75)) < 0.01, 'ghost samples between frames');
ok(JSON.stringify(gh).length < 6000, 'a 3 s ghost is small (' + JSON.stringify(gh).length + ' chars)');
ok(RG.unpackGhost({ hz: 30, n: 5, d: ['x'] }) && RG.unpackGhost(null) === null, 'bad ghost data is harmless');

// --- cleanTrack: untrusted input
const dirty = { format: 'pro-whooper-track/2', name: '<script>alert(1)</script>Best', preset: 'evil', venue: { kind: 'room', room: '__proto__' }, laps: 1e9, route: ['nope'],
  elements: [{ type: 'gateSquare', id: '"><img>', x: 1e9, y: 'a', p: { size: 99, led: 'boom', collide: 'hard' } }, { type: 'constructor' }, { type: 'wall', p: { mat: 'lava' } }] };
const c = RG.cleanTrack(dirty);
ok(!/[<>]/.test(c.name) && c.preset === 'indoor' && c.venue.room === 'livingroom' && c.laps === 20 && c.route.length === 0, 'clean: name, preset, venue, laps, route');
ok(c.elements.length === 2 && c.elements[0].x === 500 && c.elements[0].p.size === 2.4 && c.elements[0].p.led === 'static' && c.elements[0].p.collide === 'hard' && !/[<>"]/.test(c.elements[0].id), 'clean: elements clamped');
ok(c.elements[1].p.mat === 'drywall', 'clean: unknown option falls back');
let threw = false; try { RG.cleanTrack({ format: 'x' }); } catch (e) { threw = true; } ok(threw, 'not a track: refused');
ok(RG.trackHash(c) === RG.trackHash(RG.cleanTrack(JSON.parse(JSON.stringify(c)))), 'hash is stable');
const c2 = JSON.parse(JSON.stringify(c)); c2.name = 'Other'; ok(RG.trackHash(c) === RG.trackHash(c2), 'hash ignores the name');
c2.elements[0].x = 3; ok(RG.trackHash(c) !== RG.trackHash(c2), 'hash follows the geometry');
// old /1 tracks
const v1 = { format: 'pro-whooper-track/1', name: 'Old', env: 'garage', launch: { pos: [0, 0.03, 2], yaw: 0 }, gates: [{ id: 'a', type: 'gate', pos: [0, 0, 0], rot: [0, 0, 0], w: 1, h: 1, lift: 0.5 }, { id: 'b', type: 'hurdle', pos: [0, 0, -2], rot: [90, 0, 0] }] };
const cv = RG.cleanTrack(v1); ok(cv.format === 'pro-whooper-track/2' && cv.preset === 'racegow' && cv.venue.room === 'garage' && cv.elements.some(e => e.type === 'start') && cv.elements.some(e => e.type === 'pvcGate'), 'old tracks convert');

// --- checks ("Make raceable")
const ck = RG.checks(B); ok(ck.ok && ck.estimate.lap > 0 && ck.estimate.difficulty >= 1, 'a simple loop is raceable (' + ck.estimate.lap + ' s, difficulty ' + ck.estimate.difficulty + ')');
const tn = RG.newTrack({}); tn.elements = []; ok(!RG.checks(RG.buildTrack(tn)).ok, 'no start: not raceable');
const tf = lineTrack(); tf.elements.push(RG.newElement('table', { x: 3, y: 1.5, z: 0 })); const cf = RG.checks(RG.buildTrack(tf));
ok(cf.checks.some(x => x.level === 'warn' && /float/.test(x.text) && x.ids.length === 1), 'a table in mid-air floats');
const tc = lineTrack(); tc.elements.push(RG.newElement('table', { x: 3, z: 0 }), RG.newElement('table', { x: 3.3, z: 0 })); ok(RG.checks(RG.buildTrack(tc)).checks.some(x => /pass through/.test(x.text)), 'two tables through each other');
const ts = lineTrack(); ts.elements[1].p.size = 0.2; ok(RG.checks(RG.buildTrack(ts)).checks.some(x => x.level === 'fail' && /smaller/.test(x.text)), 'gate under the preset minimum');
const tw = RG.newTrack({ venue: { kind: 'room', room: 'livingroom' } }); tw.elements.push(RG.newElement('gateSquare', { x: 4, z: 0 }), RG.newElement('gateSquare', { x: 0, z: 0 }), RG.newElement('gateSquare', { x: -1, z: 0 }));
ok(RG.checks(RG.buildTrack(tw)).checks.some(x => /through the walls/.test(x.text)), 'gate outside the room');
const tr = RG.newTrack({ preset: 'racegow', venue: { kind: 'room', room: 'garage' } }); tr.elements.push(RG.newElement('pvcGate', { x: 0, z: 0 }), RG.newElement('gateSquare', { x: 1, z: -1 }));
ok(RG.checks(RG.buildTrack(tr)).checks.some(x => /RaceGOW: gates should be/.test(x.text)), 'RaceGOW preset wants PVC');

// --- tools
const pg = RG.pathGates([[0, 0.6, 0], [0, 0.6, -4], [4, 1.2, -6]], 2);
ok(pg.length >= 3 && pg.every(e => e.type === 'gateSquare'), 'path tool places gates along the line (' + pg.length + ')');
ok(Math.abs(pg[0].ry) < 10, 'first path gate faces along the line (' + pg[0].ry.toFixed(1) + ')');
const tm = lineTrack(); const gate = tm.elements[1]; gate.x = 1; gate.ry = 30; RG.mirror(tm, [gate.id], 'x', 0); ok(gate.x === -1 && gate.ry === -30, 'mirror across x');
const ta = lineTrack(); const fl = RG.newElement('flag', { x: 2, z: 2 }); ta.elements.push(fl); RG.autoFace(ta, RG.buildTrack(ta)); ok(Math.abs(fl.ry) > 0.01, 'flags turn to face the next gate');

// --- physics hooks: surfaces and fields (absent everywhere else: default physics unchanged)
const PRE = Object.keys(S.PRESETS)[0], mkD = w => { const d = new S.Drone(S.buildDrone(S.PRESETS[PRE]), S.defaultTune(), { spawn: { pos: v3(0, 1, 0.2), yaw: 0 }, ...w }); d.reset({ pos: v3(0, 1, 0.2), yaw: 0 }); d.armed = true; return d; };
const fly = (d, T) => { for (let i = 0; i < T * 1000; i++) d.step({ thr: 0.4, roll: 0, pitch: 0, yaw: 0 }, 0.001); return d; };
function intoWall(surf, v0) { const b = S.makeBox(v3(0, 1, -0.3), v3(1, 1, 0.05)); b.owner = 0; if (surf) b.surf = surf; const d = mkD({ objs: [{ id: 0, prims: [b] }], prims: [b] }); d.vel = v3(0, 0, -v0); return fly(d, 0.3); }
const soft = intoWall(RG.SURF.soft, 4), hard = intoWall(RG.SURF.hard, 4), def = intoWall(null, 4);
ok(!soft.crashed && soft.vel.z > 0.3, 'soft gate: bounces back, flies on (vz ' + soft.vel.z.toFixed(2) + ')');
ok(hard.crashed, 'hard gate at 4 m/s: crash');
ok(!def.crashed, 'no surface: the old rules (no crash at 4 m/s)');
const fan = RG.elementParts(RG.newElement('fan', { x: 0, z: 1 }), {}).fields[0];
const df = fly(mkD({ objs: [], prims: [], fields: [fan] }), 0.5), dn = fly(mkD({ objs: [], prims: [] }), 0.5);
ok(df.pos.z < dn.pos.z - 0.05, 'fan zone pushes the quad (' + (df.pos.z - dn.pos.z).toFixed(3) + ' m)');

console.log(`${pass}/${pass + fail} racegow checks`); if (fail) process.exit(1);
