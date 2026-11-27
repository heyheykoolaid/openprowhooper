// Daily K.W.A.D. (owner, 2026-11-20): the day's four tricks per map are the same for everyone, come from the pools, send A and D to
// named objects that exist and that the bot's flights are called on, and score as the calculator's K.W.A.D. does. node test/kwad.js
require('../src/tricks.js'); require('../src/sim.js'); require('../src/maps.js'); require('../src/maneuvers.js');
const S = globalThis.Sim, MV = globalThis.Maneuvers;
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 10, 22 + i)).toISOString().slice(0, 10)), maps = Object.keys(S.KWAD_SPOTS);
const str = k => `${k.K.trick}|${k.W.trick}|${k.A.trick}@${k.A.obj}|${k.D.trick}@${k.D.obj}`;
{ let bad = 0, same = 0; const seen = {};
  for (const m of maps) { seen[m] = new Set(); for (const d of days) { const k = S.dailyKwad(m, d), T = S.KWAD_SPOTS[m];
    if (str(k) !== str(S.dailyKwad(m, d))) same++; seen[m].add(str(k));
    if (!S.KWAD_K.includes(k.K.trick) || !S.KWAD_W.includes(k.W.trick) || !S.KWAD_A.includes(k.A.trick) || !S.KWAD_D.includes(k.D.trick) || !(k.A.obj in T) || !(k.D.obj in T) || T[k.A.obj].includes(k.A.trick) || T[k.D.obj].includes(k.D.trick) || (Object.keys(T).length > 1 && k.A.obj === k.D.obj)) { bad++; console.log('  ✗', m, d, str(k)); } } }
  check('every day of a month, on every map: tricks from the pools, on that map\'s own objects, A and D on different ones', !bad && !same, `${maps.length} maps × ${days.length} days`);
  check('the set changes from day to day and differs between maps', maps.every(m => seen[m].size >= 20) && str(S.dailyKwad('moose', days[0])) !== str(S.dailyKwad('warehouse', days[0])), maps.map(m => m + ' ' + seen[m].size).join(', '));
  const only = S.dailyKwad('moose', days[0], o => o === 'Swing Set');
  check('an object missing from the loaded layout is never asked for; a map with no table keeps the book\'s set', only.A.obj === 'Swing Set' && only.D.obj === 'Swing Set' && S.dailyKwad('training', days[0]) === null && S.dailyKwad('moose', 'today') === null && S.dailyKwad('moose', days[0], () => false) === null); }
{ const set = { K: { trick: 'Flip' }, W: { trick: 'Double Roll' }, A: { trick: 'Powerloop', obj: 'Swing Set' }, D: { trick: 'Power Flip', obj: 'Climbing Bars' } }, k = new S.ScoreKeeper(null, set);
  const a = k.add({ name: 'Powerloop', exec: 'CLEAN', obstacle: 'Climbing Bars' }), b = k.add({ name: 'Powerloop', exec: 'MISSED', obstacle: 'Swing Set' }), c = k.add({ name: 'Powerloop', exec: 'SLOPPY', obstacle: 'Swing Set' }), c2 = k.add({ name: 'Powerloop', exec: 'CLEAN', obstacle: 'Swing Set' });
  check('a daily object letter needs its trick ON its object, landed, once', !a.kwadHit && !b.kwadHit && c.kwadHit === 'A' && !c2.kwadHit && k.kwadBonus === 250);
  k.add({ name: 'Half Matty', exec: 'CLEAN', obstacle: 'Swing Set' }); const f = k.add({ name: 'Flip', exec: 'CLEAN' }), g = k.add({ name: 'Double Roll', exec: 'BUMP' }), t0 = k.total, h = k.add({ name: 'Power Flip', exec: 'CLEAN', obstacle: 'Climbing Bars' });
  check('the book\'s fixed tricks do not count on a daily set; all four letters = 4 × 250 + 2000', f.kwadHit === 'K' && g.kwadHit === 'W' && h.kwadHit === 'D' && k.kwadBonus === 3000 && k.total - t0 === h.net + 2250, `bonus ${k.kwadBonus}`);
  const old = new S.ScoreKeeper(), o1 = old.add({ name: 'Half Matty', exec: 'CLEAN' }), o2 = old.add({ name: 'Flip', exec: 'CLEAN' });
  check('with no daily set the calculator\'s K.W.A.D. is unchanged', o1.kwadHit === 'K' && !o2.kwadHit && old.kwadBonus === 250); }
// the table itself: every object is on its map, and the bot's flight of a pool trick there is called on it
{ let got = 0, tot = 0, gone = 0; const miss = [];
  for (const m of maps) { const w = S.MAPS[m].build(), T = S.KWAD_SPOTS[m]; let i = 0;
    for (const obj of Object.keys(T)) { if (!w.objs.some(o => o.name === obj && o.obstacle)) { gone++; miss.push(`${m}: no ${obj}`); continue; }
      const okT = S.KWAD_OBJ_TRICKS.filter(t => !T[obj].includes(t));
      for (const t of [okT[i % okT.length], okT[(i + 3) % okT.length]]) { tot++; let hit = false; try { hit = MV.detect(MV.make(t, w, 11, { object: obj }), w, 20).some(e => e.name === t && e.obstacle === obj); } catch { hit = false; } if (hit) got++; else miss.push(`${m}: ${t} on ${obj}`); }
      i++; } }
  check('every K.W.A.D. object is on its map and the bot\'s tricks are called on it', !gone && got === tot, `${got}/${tot}${miss.length ? ' · ' + miss.slice(0, 4).join(' · ') : ''}`); }
// a call on a part of the named object counts (owner, 2026-11-27: Powerloops round Clappy's Footbridge are called on its rail)
{ const set = { K: { trick: 'Yaw Spin' }, W: { trick: 'Juicy Flick' }, A: { trick: 'Powerloop', obj: 'Footbridge' }, D: { trick: 'Maverick Loop', obj: 'Overhead Wires' } };
  const k = new S.ScoreKeeper(null, set), a = k.add({ name: 'Powerloop', exec: 'CLEAN', obstacle: 'Footbridge Rail' }), b = k.add({ name: 'Maverick Loop', exec: 'CLEAN', obstacle: 'Footbridgeish' });
  check('a Powerloop on the Footbridge Rail lights A (Footbridge); another object does not', a.kwadHit === 'A' && !b.kwadHit, `${a.kwadHit} ${b.kwadHit}`); }
console.log(`${ok}/${n} daily K.W.A.D. checks`); if (ok < n) process.exit(1);
