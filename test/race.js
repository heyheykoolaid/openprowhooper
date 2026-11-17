// RaceGOW racing rules: gate crossings, clean laps, missed / wrong-way / crash, best 3 consecutive, fixed-lap races,
// ghosts, track validation and track files.
require('../src/tricks.js'); require('../src/sim.js'); require('../src/race.js');
const S = globalThis.Sim, R = globalThis.Race, { v3, add, sub, mul } = S;
let pass = 0, total = 0;
const ok = (name, cond, info = '') => { total++; if (cond) pass++; console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : '   ' + info}`); };

const PG = S.buildPlayground();
const track = R.sampleTracks().find(t => t.env === 'livingroom'), W = R.buildTrackWorld(track, PG), G = W.geoms;
// a flight: straight lines through each gate's opening (40 cm before -> 40 cm after), in the given gate order
function path(order, start = track.launch.pos) {
  const pts = [v3(start[0], 0.5, start[2])];
  for (const i of order) { const g = G[i]; pts.push(sub(g.centre, mul(g.fwd, 0.4)), add(g.centre, mul(g.fwd, 0.4))); }
  return pts;
}
function fly(sess, pts, opts = {}) {
  const ev = []; let t = opts.t0 || 0, prev = pts[0]; const sp = 4;   // 4 m/s
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = S.len(sub(b, a)), n = Math.max(1, Math.ceil(L / 0.02));
    for (let k = 1; k <= n; k++) { const p = add(a, mul(sub(b, a), k / n)); t += L / n / sp; ev.push(...sess.update(t, prev, p, opts.crashAt != null && Math.abs(t - opts.crashAt) < 0.01)); prev = p; }
  }
  for (let k = 0; k < (opts.tail || 0); k++) { t += 0.01; ev.push(...sess.update(t, prev, prev, false)); }
  return { ev, t };
}
const N = track.gates.length, lap = [...Array(N).keys()].slice(1).concat([0]);   // after the start: 1..N-1 then back through 0

// geometry
{ const g = G[1]; ok('crossing the right way = +1', R.crossing(g, sub(g.centre, mul(g.fwd, 0.1)), add(g.centre, mul(g.fwd, 0.1))) === 1);
  ok('crossing backwards = -1', R.crossing(g, add(g.centre, mul(g.fwd, 0.1)), sub(g.centre, mul(g.fwd, 0.1))) === -1);
  const out = add(g.centre, mul(g.right, 0.6)); ok('beside the opening does not count', R.crossing(g, sub(out, mul(g.fwd, 0.1)), add(out, mul(g.fwd, 0.1))) === 0);
  const hi = add(g.centre, mul(g.up, 0.5)); ok('over the top of a gate does not count', R.crossing(g, sub(hi, mul(g.fwd, 0.1)), add(hi, mul(g.fwd, 0.1))) === 0);
  const hu = G[track.gates.findIndex(x => x.type === 'hurdle')]; const over = add(hu.o, mul(hu.up, 0.6));
  ok('a hurdle is flown over', R.crossing(hu, sub(over, mul(hu.fwd, 0.1)), add(over, mul(hu.fwd, 0.1))) === 1);
  ok('gate pipes are solid (collision prims)', W.prims.length > PG.prims.length * 0 + 8 && W.objs.some(o => o.kind === 'gate' && o.prims.length >= 5)); }

// infinite: 3 clean laps
{ const s = new R.RaceSession(track, G, 'infinite'); const { ev } = fly(s, path([0, ...lap, ...lap, ...lap]));
  const laps = ev.filter(e => e.type === 'lap');
  ok('infinite: start gate starts the clock', ev[0] && ev[0].type === 'start', JSON.stringify(ev[0]));
  ok('infinite: three clean laps', laps.length === 3 && laps.every(l => l.clean), JSON.stringify(laps));
  ok('infinite: best 3 consecutive = the three laps', s.best3 && Math.abs(s.best3.total - laps.reduce((a, l) => a + l.time, 0)) < 1e-6);
  ok('infinite: live rolling 3 shown', s.rolling3 != null && s.streak === 3); }
// a missed gate spoils that lap only
{ const s = new R.RaceSession(track, G, 'infinite');
  const pts = path([0, ...lap, 1, 2]); pts.push(v3(G[3].centre.x, 2.3, G[3].centre.z)); pts.push(...path([4, 5, 6, 7, 0, ...lap, ...lap, ...lap]).slice(1));   // up and over gate 4
  const { ev } = fly(s, pts); const laps = ev.filter(e => e.type === 'lap');
  ok('missed gate: lap 2 spoilt', laps.length === 5 && !laps[1].clean && /missed gate 4/.test(laps[1].why), JSON.stringify(laps.map(l => [l.clean, l.why])));
  ok('missed gate: best 3 uses laps 3-5', s.best3 && s.best3.idx === 2, JSON.stringify(s.best3)); }
// wrong way and crash
{ const s = new R.RaceSession(track, G, 'infinite'); const g = G[2];
  const pts = path([0, 1]); pts.push(add(g.centre, mul(g.fwd, 0.4)), sub(g.centre, mul(g.fwd, 0.4))); pts.push(...path(lap).slice(1));
  const { ev } = fly(s, pts); const l = ev.find(e => e.type === 'lap');
  ok('wrong way through a gate spoils the lap', ev.some(e => e.type === 'wrongway') && l && !l.clean, JSON.stringify(l)); }
{ const s = new R.RaceSession(track, G, 'infinite'); const { ev } = fly(s, path([0, ...lap]), { crashAt: 1.0 });
  const l = ev.find(e => e.type === 'lap'); ok('a crash spoils the lap', l && !l.clean && l.why === 'crash', JSON.stringify(l)); }
// fixed laps: countdown, holeshot, finish; a skipped gate must be flown before the next counts
{ const s = new R.RaceSession(track, G, 'laps', { laps: 2 }); const ev = [];
  for (let t = 0; t <= 3.05; t += 0.01) ev.push(...s.update(t, v3(0, 0.5, 2.3), v3(0, 0.5, 2.3), false));
  ok('race: countdown then GO', ev.some(e => e.type === 'go') && s.state === 'racing');
  const r = fly(s, path([0, ...lap, ...lap]), { t0: 3.05 }); const fin = r.ev.find(e => e.type === 'finish');
  ok('race: two laps then finish with a total', fin && fin.laps.length === 2 && fin.total > 0, JSON.stringify(r.ev.filter(e => e.type !== 'gate')));
  const s2 = new R.RaceSession(track, G, 'laps', { laps: 1, countdown: false }); s2.state = 'racing'; s2.raceT0 = 0; s2.lapT0 = 0; s2.holeshot = true;
  const skip = lap.filter(i => i !== 2), r2 = fly(s2, path([0, ...skip]));
  ok('race: skipped gate means no lap yet', !r2.ev.some(e => e.type === 'lap') && r2.ev.some(e => e.type === 'skip'), JSON.stringify(r2.ev.map(e => e.type))); }
// bidirectional gate
{ const t2 = JSON.parse(JSON.stringify(track)); t2.gates[2].bidir = true; const s = new R.RaceSession(t2, G, 'infinite'); const g = G[2];
  const pts = path([0, 1]); pts.push(add(g.centre, mul(g.fwd, 0.4)), sub(g.centre, mul(g.fwd, 0.4)), v3(g.centre.x, 2.3, g.centre.z)); pts.push(...path(lap.slice(2)).slice(1));
  const l = fly(s, pts).ev.find(e => e.type === 'lap'); ok('a bidirectional gate counts either way', l && l.clean, JSON.stringify(l)); }
// best 3 helper
{ const L = [[10, 1], [9, 1], [11, 0], [8, 1], [8, 1], [8.5, 1], [7, 1]].map(([time, c]) => ({ time, clean: !!c }));
  const b = R.best3(L); ok('best 3 consecutive skips windows with a dirty lap', b && b.idx === 4 && Math.abs(b.total - 23.5) < 1e-9, JSON.stringify(b)); }
// ghosts
{ const g = new R.GhostRecorder(30); g.begin(0); for (let t = 0; t <= 1.0001; t += 0.01) g.sample(t, v3(t, 0, 0), { w: 1, x: 0, y: 0, z: 0 });
  const rec = g.take(), at = R.ghostAt(rec, 0.5); ok('ghost samples at 30 Hz and interpolates', rec.length >= 24 && rec.length <= 32 && Math.abs(at.pos.x - 0.5) < 0.02, rec.length + ' ' + JSON.stringify(at));
  const j = R.joinLaps([rec, rec], [1, 1]); ok('ghost laps join end to end', Math.abs(j[j.length - 1][0] - 2.0) < 0.05 && R.ghostAt(j, 1.5).pos.x > 0.4); }
// validation and files
{ const t = R.newTrack('livingroom', 'Bad'); t.gates.push(R.newGate('gate', v3(0, 0, 0), 0));
  ok('one gate is not a track', !R.validateTrack(t).ok);
  const t2 = R.newTrack('livingroom', 'Blocked'); t2.gates.push(R.newGate('gate', v3(0, 0, 0), 0), R.newGate('gate', v3(-1.2, 0, -3.2), 180));
  const v = R.validateTrack(t2); ok('a reset point inside the couch is caught', !v.ok && v.errors.some(e => /reset point/.test(e)), JSON.stringify(v));
  for (const tr of R.sampleTracks()) { const v2 = R.validateTrack(tr, R.buildTrackWorld(tr, PG)); ok(`sample track "${tr.name}" is valid`, v2.ok && !v2.warnings.length, JSON.stringify(v2)); }
  const rt = R.cleanTrack(JSON.parse(JSON.stringify(track))); ok('track file round-trips', JSON.stringify(rt.gates.map(g => [g.type, g.pos, g.rot])) === JSON.stringify(track.gates.map(g => [g.type, g.pos, g.rot])));
  let threw = false; try { R.cleanTrack({ hello: 1 }); } catch { threw = true; } ok('junk is rejected', threw);
  const evil = R.cleanTrack({ gates: [{ type: 'gate', pos: [0, 0, 0], scale: 1e9, w: -5, color: '<script>' }], name: 'x'.repeat(500) });
  ok('track values are clamped and sanitised', evil.gates[0].scale <= 4 && evil.gates[0].w >= 0.25 && evil.gates[0].color === 'white' && evil.name.length <= 60); }
// the drone really hits a crossbar
{ const d = new S.Drone(S.buildDrone(S.PRESETS['Air65 Racing']), S.defaultTune(), W); const g = G[1], top = g.pipes[2][0];
  const mid = add(g.pipes[2][0], mul(sub(g.pipes[2][1], g.pipes[2][0]), 0.5)); d.reset({ pos: sub(mid, mul(g.fwd, 0.3)), yaw: 0 }); d.pos = sub(mid, mul(g.fwd, 0.3)); d.vel = mul(g.fwd, 3); d.armed = true; void top;
  let hit = false; for (let i = 0; i < 300; i++) { d.step({ thr: 0.35, roll: 0, pitch: 0, yaw: 0 }, 0.001); if (d.contactThisStep || d.crashed) { hit = true; break; } }
  ok('flying into a crossbar is a collision', hit); }
console.log(`\n${pass}/${total} race checks`);
if (pass !== total) process.exitCode = 1;
