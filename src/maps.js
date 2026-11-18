// Maps. Pure JS (runs in Node for tests, in the browser after sim.js). A map is what buildPlayground() returns:
// { objs, prims, zones, spawn, bounds } plus id / title / theme. Objects carry collision prims, `vis` shapes for the
// view, and the tags the trick detector reads: `obstacle` (over/under line), `round`, `gap`, kind 'pole' capsules,
// kind 'wall' / 'building' for wall rides, kind 'pilot'. Nothing here is special-cased by name in the detector.
(function (root) {
  const S = root.Sim, { v3, makeBox, makeCapsule, makeSphere } = S;
  function kit(base) {   // base: an existing map to add to (its objects keep their ids)
    const objs = base ? base.objs : []; let nid = objs.reduce((m, o) => Math.max(m, o.id + 1), 0);
    let grp = null;   // objects made inside together() are one piece in the map editor (a play unit and its roof and slide)
    const O = (name, kind, extra = {}) => { const o = { id: nid++, name, kind, prims: [], vis: [], ...extra }; if (grp != null) o.grp = grp; objs.push(o); return o; };
    const together = fn => { const was = grp; grp = nid; try { return fn(); } finally { grp = was; } };
    const box = (o, c, h, mat, ry = 0, rx = 0, rz = 0, opts = {}) => { const b = makeBox(c, h, ry, rx, rz); if (!opts.noCollide) o.prims.push(b); o.vis.push({ shape: 'box', c, h, mat, euler: [rx, ry, rz], ...opts }); return b; };
    const pipe = (o, a, b, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(makeCapsule(a, b, r)); o.vis.push({ shape: 'pipe', a, b, r, mat, ...opts }); };
    const ball = (o, c, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(makeSphere(c, r)); o.vis.push({ shape: 'sphere', c, r, mat, ...opts }); };
    // a glowing strip: seen, never hit
    const neon = (o, c, h, mat = 'neonPink', ry = 0) => box(o, c, h, mat, ry, 0, 0, { noCollide: true, glow: true });
    // a flat round slab (drawn as a disc, collides as a box a little inside its rim)
    const disc = (o, c, r, th, mat) => { o.prims.push(makeBox(c, v3(r * 0.74, th, r * 0.74))); o.vis.push({ shape: 'disc', c, r, th, mat }); };
    const done = (extra) => { const all = []; for (const o of objs) for (const p of o.prims) { p.owner = o.id; all.push(p); } return { objs, prims: all, ...extra }; };
    return { objs, O, box, pipe, ball, neon, disc, done, together };
  }
  // the pilot figure (the same person as on the playground): legs to fly between, a head to fly over, a face to punch
  function addPilot(K, PX, PZ) {
    const { O, box, pipe, ball } = K, pl = O('Pilot', 'pilot');
    pipe(pl, v3(PX - 0.36, 0, PZ), v3(PX - 0.1, 0.88, PZ), 0.07, 'jeans'); pipe(pl, v3(PX + 0.36, 0, PZ), v3(PX + 0.1, 0.88, PZ), 0.07, 'jeans');
    pl.obstacle = { a: v3(PX - 0.26, 0, PZ), b: v3(PX + 0.26, 0, PZ), under: 0.55, over: 1.95 };
    pipe(pl, v3(PX, 0.9, PZ), v3(PX, 1.42, PZ), 0.19, 'hoodie');
    pipe(pl, v3(PX - 0.24, 1.38, PZ), v3(PX - 0.14, 1.12, PZ - 0.28), 0.05, 'hoodie'); pipe(pl, v3(PX + 0.24, 1.38, PZ), v3(PX + 0.14, 1.12, PZ - 0.28), 0.05, 'hoodie');
    box(pl, v3(PX, 1.13, PZ - 0.33), v3(0.13, 0.08, 0.05), 'radio');
    ball(pl, v3(PX, 1.66, PZ), 0.12, 'skin');
    box(pl, v3(PX, 1.69, PZ - 0.1), v3(0.11, 0.045, 0.05), 'goggles', 0, 0, 0, { noCollide: true });
    pipe(pl, v3(PX, 1.74, PZ + 0.02), v3(PX, 1.8, PZ + 0.02), 0.115, 'hoodie', { noCollide: true });
  }

  // =============================================================== The Trick Park (on both maps)
  // A test ground for the tricks and their detection, one clean example of each kind of object with room round it, so a
  // pilot (or the data) can tell exactly what was flown: an over/under lane of four bars at known heights, a big empty
  // box for open-air tricks, lone poles of three thicknesses and a pair for figure-8s, gap gates of three widths, a
  // ceiling slab to tap, a long smooth wall to ride and a tall tower to dive. Every name says its size, so the
  // "what counted" list (Z) reads like a lab sheet. It is built outward from the map's edge at x = X0, away from the map
  // (dir -1 = towards -x). M = the map's materials.
  function trickPark(K, X0, Z0, dir, M) {
    const { O, box, pipe } = K, X = lx => X0 + dir * lx, Zw = lz => Z0 + lz, n = v3(-dir, 0, 0);
    const mark = (o, c, h) => box(o, c, h, M.accent, 0, 0, 0, { noCollide: true, glow: M.glow });
    // the over/under lane: bars 2.6 m wide, across the lane, at 1.0 / 1.6 / 2.2 / 3.0 m
    [[4, 1.0], [10, 1.6], [16, 2.2], [22, 3.0]].forEach(([lx, h]) => { const x = X(lx), za = Zw(-13.3), zb = Zw(-10.7), r = 0.04;
      const o = O(`Test Bar ${h.toFixed(1)} m`, 'overunder', { obstacle: { a: v3(x, 0, za), b: v3(x, 0, zb), under: h - r, over: h + r } });
      for (const z of [za, zb]) pipe(o, v3(x, 0, z), v3(x, h, z), 0.035, M.post); pipe(o, v3(x, h, za), v3(x, h, zb), r, M.bar);
      mark(o, v3(x, 0.006, Zw(-12)), v3(0.03, 0.004, 1.3)); });
    // gap gates of three widths along the lane's far side
    [[6, 0.7, 1.0], [12, 1.1, 1.4], [18, 1.6, 1.9]].forEach(([lx, w, hh]) => { const x = X(lx), z = Zw(-19), o = O(`Gap Gate ${w.toFixed(1)} m`, 'overunder'), t = 0.05;
      for (const s of [-1, 1]) box(o, v3(x, hh / 2, z + s * (w / 2 + t)), v3(t, hh / 2, t), M.post); box(o, v3(x, hh + t, z), v3(t, t, w / 2 + 2 * t), M.bar);
      o.obstacle = { a: v3(x, 0, z - w / 2), b: v3(x, 0, z + w / 2), under: hh, over: hh + 2 * t };
      O(`Gap Gate ${w.toFixed(1)} m opening`, 'gap', { gap: { c: v3(x, hh / 2, z), n: v3(1, 0, 0), hu: w / 2, hv: hh / 2, u: v3(0, 0, 1) } }); });
    // the open-air box: nothing above it, low corner markers only
    { const o = O('Open Air Box', 'deco'); for (const [a, b] of [[2, -4], [20, -4], [2, 8], [20, 8]]) { box(o, v3(X(a), 0.15, Zw(b)), v3(0.12, 0.15, 0.12), M.accent); }
      mark(o, v3(X(11), 0.006, Zw(-4)), v3(9, 0.004, 0.03)); mark(o, v3(X(11), 0.006, Zw(8)), v3(9, 0.004, 0.03)); }
    // lone poles: a trunk, a lamp-post size, a flagpole size, and a pair 2.4 m apart for figure-8s
    [[5, 0.18, 4.0, 'Test Pole thick'], [11, 0.07, 3.6, 'Test Pole medium'], [17, 0.035, 5.0, 'Test Pole thin']].forEach(([lx, r, h, name]) => { const o = O(name, 'pole'); pipe(o, v3(X(lx), 0, Zw(14)), v3(X(lx), h, Zw(14)), r, M.pole); mark(o, v3(X(lx), 0.006, Zw(14)), v3(r + 0.25, 0.004, r + 0.25)); });
    for (const lz of [12.8, 15.2]) { const o = O('Figure-8 Pole', 'pole'); pipe(o, v3(X(23), 0, Zw(lz)), v3(X(23), 3.2, Zw(lz)), 0.06, M.pole); }
    // a ceiling to tap: a 3 x 3 m slab 2.3 m up on four posts
    { const o = O('Ceiling Slab 2.3 m', 'overunder', { obstacle: { a: v3(X(23.5), 0, Zw(0)), b: v3(X(26.5), 0, Zw(0)), under: 2.25, over: 2.35 } }), cx = X(25), cz = Zw(2);
      box(o, v3(cx, 2.3, cz), v3(1.5, 0.05, 1.5), M.slab); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pipe(o, v3(cx + a * 1.45, 0, cz + b * 1.45), v3(cx + a * 1.45, 2.25, cz + b * 1.45), 0.04, M.post);
      mark(o, v3(cx, 2.244, cz), v3(1.2, 0.004, 1.2)); }
    // the far end: a long smooth wall to ride (3 m tall, 16 m long) and a 14 m tower to dive beside
    { const o = O('Test Wall 3 m', 'wall', { wallNormal: n }); box(o, v3(X(30), 1.5, Zw(-10)), v3(0.2, 1.5, 8), M.wall); mark(o, v3(X(30) + n.x * 0.21, 2.99, Zw(-10)), v3(0.006, 0.02, 8)); }
    { const o = O('Dive Tower 14 m', 'building', { wallNormal: n, tall: 14 }); box(o, v3(X(31), 7, Zw(6)), v3(2, 7, 2.5), M.tower);
      for (let y = 2; y < 14; y += 2) mark(o, v3(X(31) + n.x * 2.01, y, Zw(6)), v3(0.006, 0.02, 2.5)); }
    return { zone: { shape: 'zone', mat: M.zone, c: v3(X(16), 0.007, Zw(0)), h: v3(16, 0, 21) } };
  }

  // =============================================================== Shared pieces for the newer maps
  // the same three helpers the school uses (a standing frame to fly through, a wall with real window gaps, a bar),
  // for any kit; `glow` pieces are seen, never hit
  function parts(K) {
    const { O, box, pipe, neon } = K;
    const frame = (name, cx, cz, w, hgt, along, mat, glow) => { const o = O(name, 'overunder'), t = 0.09, ax = along === 'x';
      for (const s of [-1, 1]) box(o, v3(cx + (ax ? s * (w / 2 + t) : 0), hgt / 2, cz + (ax ? 0 : s * (w / 2 + t))), v3(t, hgt / 2, t), mat);
      box(o, v3(cx, hgt + t, cz), v3(ax ? w / 2 + 2 * t : t, t, ax ? t : w / 2 + 2 * t), mat);
      if (glow) neon(o, v3(cx, hgt - 0.015, cz), v3(ax ? w / 2 : 0.02, 0.015, ax ? 0.02 : w / 2), glow);
      o.obstacle = { a: v3(cx - (ax ? w / 2 : 0), 0, cz - (ax ? 0 : w / 2)), b: v3(cx + (ax ? w / 2 : 0), 0, cz + (ax ? 0 : w / 2)), under: hgt, over: hgt + 2 * t };
      O(name + ' opening', 'gap', { gap: { c: v3(cx, hgt / 2, cz), n: ax ? v3(0, 0, 1) : v3(1, 0, 0), hu: w / 2, hv: hgt / 2, u: ax ? v3(1, 0, 0) : v3(0, 0, 1) } });
      return o; };
    const bar = (name, a, b, r, mat) => { const o = O(name, 'overunder', { obstacle: { a: v3(a.x, 0, a.z), b: v3(b.x, 0, b.z), under: Math.min(a.y, b.y) - r, over: Math.max(a.y, b.y) + r } }); pipe(o, a, b, r, mat); return o; };
    // a slab you can go over and under (tagged by hand so its line crosses the long way)
    const slabOU = (name, c, h, mat, kind = 'overunder') => { const o = O(name, kind), along = h.x >= h.z;
      o.obstacle = { a: v3(c.x - (along ? h.x : 0), 0, c.z - (along ? 0 : h.z)), b: v3(c.x + (along ? h.x : 0), 0, c.z + (along ? 0 : h.z)), under: c.y - h.y, over: c.y + h.y }; box(o, c, h, mat); return o; };
    return { frame, bar, slabOU };
  }

  // =============================================================== Clappy Park
  // A bright neighbourhood park in a small city block (an original level after the pilot's "urban park" brief): a raised
  // playground plaza in the middle (a three-deck twister slide tower, a spinner, the Clappy Bars, a climbing dome, balance
  // beams, sakura trees), a street ring round it with sidewalks, utility poles and wires, race gates, a footbridge from the
  // plaza to the east rooftops, and an outer ring of low shops and flats with reachable flat roofs, awnings, balconies,
  // alleys with overhead walkways, dumpsters, AC units and pipes. The Trick Park is to the west. x east, z south.
  function buildClappy() {
    const K = kit(), { O, box, pipe, ball, disc } = K, { frame, bar, slabOU } = parts(K);
    const Y = 0.6;   // the plaza deck
    // ---- the plaza: a 24 x 24 m deck 0.6 m up, steps on all four sides
    { const o = O('Clappy Plaza', 'deco'); box(o, v3(0, Y / 2, 0), v3(12, Y / 2, 12), 'concrete');
      for (const [ax, sg] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) for (let i = 0; i < 3; i++) { const d = 12 + 0.35 * (i + 0.5), hh = Y * (3 - i) / 3 / 2;
        box(o, ax === 'x' ? v3(sg * d, hh, 0) : v3(0, hh, sg * d), ax === 'x' ? v3(0.175, hh, 3) : v3(3, hh, 0.175), 'concrete'); } }
    // ---- Twister Tower: three decks on four posts, a slide off each deck in a different direction, ladder rungs
    { const cx = -6, cz = -6, t = O('Twister Tower', 'deco');
      for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) pipe(t, v3(cx + a, Y, cz + b), v3(cx + a, Y + 5.2, cz + b), 0.07, 'paintRed');
      [[1.4, 'paintOrange'], [2.8, 'paintBlue'], [4.2, 'paintGreen']].forEach(([h, m], i) => {
        slabOU(`Twister Deck ${i + 1}`, v3(cx, Y + h, cz), v3(1.5, 0.05, 1.5), m);
        bar('Twister Rail', v3(cx - 1.5, Y + h + 0.9, cz - 1.5), v3(cx + 1.5, Y + h + 0.9, cz - 1.5), 0.03, 'paintRed'); });
      const sl = O('Twister Slide', 'deco');
      for (const [h, dir, len] of [[1.4, 0, 2.6], [2.8, 1, 4.2], [4.2, 2, 5.8]]) { const ang = Math.atan2(h, len), L = Math.hypot(h, len) / 2, mid = h / 2;
        if (dir === 0) { box(sl, v3(cx + 1.5 + len / 2, Y + mid, cz), v3(L, 0.04, 0.45), 'metalSlide', 0, 0, -ang); for (const s of [-1, 1]) box(sl, v3(cx + 1.5 + len / 2, Y + mid + 0.12, cz + s * 0.47), v3(L, 0.12, 0.03), 'paintOrange', 0, 0, -ang); }
        if (dir === 1) { box(sl, v3(cx, Y + mid, cz + 1.5 + len / 2), v3(0.45, 0.04, L), 'metalSlide', 0, ang, 0); for (const s of [-1, 1]) box(sl, v3(cx + s * 0.47, Y + mid + 0.12, cz + 1.5 + len / 2), v3(0.03, 0.12, L), 'paintBlue', 0, ang, 0); }
        if (dir === 2) { box(sl, v3(cx - 1.5 - len / 2, Y + mid, cz), v3(L, 0.04, 0.45), 'metalSlide', 0, 0, ang); for (const s of [-1, 1]) box(sl, v3(cx - 1.5 - len / 2, Y + mid + 0.12, cz + s * 0.47), v3(L, 0.12, 0.03), 'paintGreen', 0, 0, ang); } }
      for (let i = 1; i <= 16; i++) pipe(t, v3(cx - 1.5, Y + i * 0.28, cz + 1.55), v3(cx - 0.9, Y + i * 0.28, cz + 1.55), 0.015, 'galv', { noCollide: true });
      for (const x of [cx - 1.5, cx - 0.9]) pipe(t, v3(x, Y, cz + 1.55), v3(x, Y + 5.0, cz + 1.55), 0.025, 'galv');   // the ladder's rails
      for (const [h] of [[1.4], [2.8], [4.2]]) for (const [a, b] of [[-1.5, 1.5], [1.5, 1.5], [-1.5, -1.5]]) pipe(t, v3(cx + a, Y + h + 0.9, cz + b), v3(cx + (a < 0 && b > 0 ? -0.9 : a), Y + h + 0.9, cz + (b > 0 && a < 0 ? 1.5 : b)), 0.025, 'paintRed', { noCollide: true }); }
    // ---- Clappy Spinner: a free-standing round platform with a centre pole and hand poles (trippies round the middle)
    { const cx = 6, cz = -6, o = O('Clappy Spinner', 'deco'); disc(o, v3(cx, Y + 0.35, cz), 2.0, 0.06, 'paintOrange'); pipe(o, v3(cx, Y, cz), v3(cx, Y + 0.32, cz), 0.25, 'galv');
      const pole = O('Spinner Pole', 'pole'); pipe(pole, v3(cx, Y + 0.4, cz), v3(cx, Y + 1.8, cz), 0.08, 'paintBlue');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pipe(o, v3(cx + Math.cos(a) * 1.5, Y + 0.4, cz + Math.sin(a) * 1.5), v3(cx + Math.cos(a) * 1.5, Y + 1.25, cz + Math.sin(a) * 1.5), 0.03, 'paintRed'); } }
    // ---- the Clappy Bars (monkey bars), a climbing dome and balance beams
    { const cx = 6, cz = 6, o = O('Clappy Bars', 'overunder', { obstacle: { a: v3(cx, 0, cz - 0.4), b: v3(cx, 0, cz + 0.4), under: Y + 2.0, over: Y + 2.1 } });
      for (const z of [cz - 0.4, cz + 0.4]) { pipe(o, v3(cx - 2.2, Y + 2.05, z), v3(cx + 2.2, Y + 2.05, z), 0.04, 'paintGreen'); for (const x of [cx - 2.2, cx + 2.2]) pipe(o, v3(x, Y, z), v3(x, Y + 2.05, z), 0.05, 'paintGreen'); }
      for (let x = cx - 1.9; x <= cx + 1.95; x += 0.42) pipe(o, v3(x, Y + 2.05, cz - 0.4), v3(x, Y + 2.05, cz + 0.4), 0.025, 'galv'); }
    { const cx = -6, cz = 6, R = 1.8, o = O('Dome Climber', 'deco');
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI; let prev = null; for (let i = 0; i <= 6; i++) { const th = i / 6 * Math.PI, p = v3(cx + Math.cos(a) * Math.cos(th) * R, Y + Math.sin(th) * R, cz + Math.sin(a) * Math.cos(th) * R); if (prev) pipe(o, prev, p, 0.025, k % 2 ? 'paintBlue' : 'plasticYellow'); prev = p; } } }
    for (const [x0, x1, y, z] of [[-2, 2, 0.45, 9.5], [-1.5, 2.5, 0.7, -9.5]]) { const b = bar('Balance Beam', v3(x0, Y + y, z), v3(x1, Y + y, z), 0.06, 'wood');
      for (const x of [x0 + 0.2, (x0 + x1) / 2, x1 - 0.2]) { pipe(b, v3(x, Y, z), v3(x, Y + y - 0.05, z), 0.045, 'galv'); box(b, v3(x, Y + 0.02, z), v3(0.12, 0.02, 0.12), 'metalPlate'); } }
    // ---- sakura trees: four on the plaza corners, more along the outer sidewalks
    const sakura = (x, z, y0, s) => { const tr = O('Sakura Tree', 'pole');
      tr.round = { c: v3(x, 0, z), r: 1.8 * s, under: y0 + 2.2 * s, over: y0 + 5.0 * s }; tr.obstacle = { a: v3(x - 1.8 * s, 0, z), b: v3(x + 1.8 * s, 0, z), under: y0 + 2.2 * s, over: y0 + 5.0 * s };
      pipe(tr, v3(x, y0, z), v3(x, y0 + 2.9 * s, z), 0.14 * s, 'bark');
      ball(tr, v3(x, y0 + 3.7 * s, z), 1.4 * s, 'blossom'); ball(tr, v3(x + 0.9 * s, y0 + 3.2 * s, z + 0.4), 0.9 * s, 'blossom'); ball(tr, v3(x - 0.8 * s, y0 + 3.4 * s, z - 0.5), 1.0 * s, 'blossom'); };
    for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) sakura(x, z, Y, 1);
    for (const [x, z] of [[-18, 23], [6, 23], [23, -9], [-23, 9], [-6, -23], [23, 15]]) sakura(x, z, 0, 0.9);
    // benches, bins and lamps round the plaza
    for (const [x, z, ry] of [[-3, 11, 0], [3, 11, 0], [-11, 3, Math.PI / 2], [11, -3, Math.PI / 2], [0, -11, 0]]) { const b = O('Bench', 'deco'); box(b, v3(x, Y + 0.42, z), v3(0.8, 0.04, 0.22), 'wood', ry); box(b, v3(x, Y + 0.2, z), v3(0.7, 0.2, 0.05), 'metal', ry); }
    for (const [x, z] of [[-11.2, -11.2], [11.2, -11.2], [-11.2, 11.2], [11.2, 11.2]]) { const l = O('Park Lamp', 'pole', { light: v3(x, Y + 4.2, z) }); pipe(l, v3(x, Y, z), v3(x, Y + 4.2, z), 0.06, 'metal'); ball(l, v3(x, Y + 4.3, z), 0.2, 'lampHead', { noCollide: true }); }
    // ---- the street ring: sidewalks 12-14 and 22-24, the road between; utility poles and wires; race gates
    const up = O('Utility Pole', 'pole'), poles = [];
    for (const t of [-18, -6, 6, 18]) for (const [x, z] of [[t, -23.3], [t, 23.3], [-23.3, t], [23.3, t]]) { pipe(up, v3(x, 0, z), v3(x, 8, z), 0.12, 'wood'); pipe(up, v3(x - 0.7, 7.5, z), v3(x + 0.7, 7.5, z), 0.05, 'wood', { noCollide: true }); poles.push(v3(x, 7.5, z)); }
    { const w = O('Overhead Wires', 'deco'); for (const side of ['N', 'S', 'E', 'W']) { const P = poles.filter(p => side === 'N' ? p.z < -23 : side === 'S' ? p.z > 23 : side === 'E' ? p.x > 23 : p.x < -23).sort((a, b) => (a.x + a.z) - (b.x + b.z));
      for (let i = 1; i < P.length; i++) for (const dx of [-0.6, 0.6]) pipe(w, v3(P[i - 1].x + (side === 'N' || side === 'S' ? 0 : dx), 7.45, P[i - 1].z + (side === 'N' || side === 'S' ? dx : 0)), v3(P[i].x + (side === 'N' || side === 'S' ? 0 : dx), 7.45, P[i].z + (side === 'N' || side === 'S' ? dx : 0)), 0.008, 'rubberBlack', { noCollide: true }); } }
    frame('Race Gate', 0, 18, 3.2, 2.6, 'z', 'paintRed'); frame('Race Gate', 0, -18, 3.2, 2.6, 'z', 'paintRed'); frame('Race Gate', 18, 8, 3.2, 2.6, 'x', 'paintBlue');   /* east gate: down the street, clear of the footbridge (pilot, 2026-11-17) */ frame('Race Gate', -18, 0, 3.2, 2.6, 'x', 'paintBlue');
    // the footbridge from the plaza's east edge over the street to the east rooftops (5 m up), on two pillars
    { const o = slabOU('Footbridge', v3(18, 5.0, -3), v3(6.2, 0.1, 1.2), 'concrete'); for (const x of [14.5, 21.5]) pipe(o, v3(x, 0, -3), v3(x, 4.9, -3), 0.22, 'concrete');
      for (const z of [-4.15, -1.85]) bar('Footbridge Rail', v3(12, 6.0, z), v3(24, 6.0, z), 0.03, 'galv');
      // lights under the deck (the pilot found it too dark under there): three fittings along the underside, real lights
      for (const x of [13.2, 18, 22.8]) { const l = O('Underpass Light', 'deco', { light: v3(x, 4.85, -3), lightColor: 0xfff1d6, lightPower: 22, lightRange: 14 });
        box(l, v3(x, 4.86, -3), v3(0.6, 0.03, 0.12), 'fluoro', 0, 0, 0, { noCollide: true, glow: true }); box(l, v3(x, 4.89, -3), v3(0.65, 0.015, 0.16), 'metal', 0, 0, 0, { noCollide: true }); }
      // stairs straight up from the plaza onto the bridge's west end (12 steps of 0.5 m, 0.37 m rise), with handrails
      const st = O('Footbridge Stairs', 'deco'), N = 12, run = 0.5, rise = (5.1 - Y) / N, x1 = 11.8;
      for (let i = 0; i < N; i++) { const top = Y + rise * (i + 1), x = x1 - (N - 1 - i) * run - run / 2; box(st, v3(x, top / 2, -3), v3(run / 2, top / 2, 0.9), 'concrete'); }
      for (const z of [-3.85, -2.15]) { const a = v3(x1 - N * run, Y + rise + 0.9, z), b = v3(x1, 5.1 + 0.9, z); pipe(st, a, b, 0.03, 'galv'); for (let i = 0; i <= 4; i++) { const t = i / 4, x = a.x + (b.x - a.x) * t; pipe(st, v3(x, Y + rise * (1 + (N - 1) * t), z), v3(x, a.y + (b.y - a.y) * t, z), 0.02, 'galv'); } } }
    // ---- the outer ring: blocks of shops and flats (24-40 out), alleys 3 m wide between them, overhead walkways
    const blocks = [];
    const side = (name, along, out, n) => { const spans = [[-40, -22], [-19, -3], [0, 14], [17, 40]];
      spans.forEach(([a0, a1], i) => { const h = [4.2, 7.5, 5.4, 9.2, 6.3, 4.8][(i + n) % 6], c = (a0 + a1) / 2, hl = (a1 - a0) / 2, d0 = 24, d1 = 40, dm = (d0 + d1) / 2;
        const ax = along === 'x', ctr = ax ? v3(c, h / 2, out * dm) : v3(out * dm, h / 2, c), half = ax ? v3(hl, h / 2, 8) : v3(8, h / 2, hl);
        const o = O(`${name} ${i + 1}`, 'building', { wallNormal: ax ? v3(0, 0, -out) : v3(-out, 0, 0), tall: h, perchHeight: h });
        const art = name === 'North Shops' && i === 1 ? { graffiti: 'south', art: [{ name: 'clappy', x: 0.3, y: 3.6, h: 5.6, rot: -0.03 }, { name: 'heyhey', x: 0.74, y: 3.8, h: 4.2, rot: 0.03 }] } : {};
        box(o, ctr, half, ['brick', 'concrete', 'vConcrete', 'brick'][(i + n) % 4], 0, 0, 0, art);
        blocks.push({ ax, out, a0, a1, h });
        // street face: a shutter or storefront, an awning over it, balconies on the taller ones
        const f = out * d0 - out * 0.02, sh = O('Shopfront', 'deco');
        for (let k = 0; k < Math.floor((a1 - a0) / 5); k++) { const m = a0 + 2.5 + k * 5;
          box(sh, ax ? v3(m, 1.3, f) : v3(f, 1.3, m), ax ? v3(1.6, 1.3, 0.03) : v3(0.03, 1.3, 1.6), k % 2 ? 'metal' : 'dumpster');
          if (k % 2 === 0) { const aw = O('Awning', 'deco'); box(aw, ax ? v3(m, 2.85, f - out * 0.6) : v3(f - out * 0.6, 2.85, m), ax ? v3(1.9, 0.05, 0.6) : v3(0.6, 0.05, 1.9), ['paintRed', 'paintBlue', 'paintGreen', 'paintOrange'][(k + i) % 4]); }
          if (h > 6 && k % 2 === 1) { const bc = O('Balcony', 'deco'); box(bc, ax ? v3(m, 4.2, f - out * 0.55) : v3(f - out * 0.55, 4.2, m), ax ? v3(1.5, 0.06, 0.55) : v3(0.55, 0.06, 1.5), 'concrete'); }
          if ((k + i) % 3 === 0) { const vm = O('Vending Machine', 'deco'); box(vm, ax ? v3(m + 2.0, 0.9, f - out * 0.4) : v3(f - out * 0.4, 0.9, m + 2.0), v3(0.45, 0.9, 0.38), ['paintBlue', 'paintRed'][(k + i) % 2]); } }
        // the building itself: windows with sills and a band at each floor on the street face, windows down the alley sides,
        // a parapet round the roof, and roof clutter (AC boxes, a water tank on the tall ones, a stair hut)
        const fz = out * d0, P = (m, y, off) => ax ? v3(m, y, fz - out * off) : v3(fz - out * off, y, m), Sz = (a, y, d) => ax ? v3(a, y, d) : v3(d, y, a);
        const win = O('Window', 'deco'), trim = O('Facade Trim', 'deco'), floors = Math.floor(h / 3);
        for (let fl = 1; fl < floors; fl++) { const yb = fl * 3; box(trim, P(c, yb, 0.06), Sz(hl, 0.06, 0.06), 'concrete');
          for (let m = a0 + 1.5; m < a1 - 1.0; m += 2.4) { box(win, P(m, yb + 1.55, 0.025), Sz(0.55, 0.72, 0.02), 'glass', 0, 0, 0, { noCollide: true }); box(win, P(m, yb + 0.78, 0.07), Sz(0.66, 0.04, 0.07), 'concrete'); } }
        for (const e of [a0, a1]) { if (e === -40 || e === 40) continue; const sx = e === a0 ? -1 : 1;
          for (let fl = 1; fl < floors; fl++) for (const dd of [26.5, 30.5, 34.5, 38]) { const y = fl * 3 + 1.55, pos = ax ? v3(e + sx * 0.025, y, out * dd) : v3(out * dd, y, e + sx * 0.025); box(win, pos, ax ? v3(0.02, 0.6, 0.45) : v3(0.45, 0.6, 0.02), 'glass', 0, 0, 0, { noCollide: true }); } }
        { const pr = O('Parapet', 'deco'), ph = 0.45, pt = 0.1;
          box(pr, ax ? v3(c, h + ph / 2, out * (d0 + pt)) : v3(out * (d0 + pt), h + ph / 2, c), Sz(hl, ph / 2, pt), 'concrete'); box(pr, ax ? v3(c, h + ph / 2, out * (d1 - pt)) : v3(out * (d1 - pt), h + ph / 2, c), Sz(hl, ph / 2, pt), 'concrete');
          for (const e of [a0 + pt, a1 - pt]) box(pr, ax ? v3(e, h + ph / 2, out * dm) : v3(out * dm, h + ph / 2, e), ax ? v3(pt, ph / 2, 8) : v3(8, ph / 2, pt), 'concrete');
          const rc = O('Rooftop Unit', 'deco'), ra = c + (i % 2 ? -1 : 1) * Math.min(4, hl / 3), rd = out * (dm + 2);
          box(rc, ax ? v3(ra, h + 0.45, rd) : v3(rd, h + 0.45, ra), v3(0.7, 0.45, 0.55), 'metal'); box(rc, ax ? v3(ra + 1.8, h + 0.35, rd - out * 1.5) : v3(rd - out * 1.5, h + 0.35, ra + 1.8), v3(0.5, 0.35, 0.5), 'metal');
          if (h > 6) { const tk = O('Water Tank', 'overunder'), tx = c - (i % 2 ? -1 : 1) * Math.min(5, hl / 2.5), tzz = out * (dm - 2), tp = ax ? v3(tx, 0, tzz) : v3(tzz, 0, tx);
            for (const [u, w] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) pipe(tk, v3(tp.x + u, h, tp.z + w), v3(tp.x + u, h + 1.4, tp.z + w), 0.05, 'rust');
            pipe(tk, v3(tp.x, h + 1.4, tp.z), v3(tp.x, h + 2.9, tp.z), 0.8, 'galv'); tk.obstacle = { a: v3(tp.x - 0.8, 0, tp.z), b: v3(tp.x + 0.8, 0, tp.z), under: h + 1.35, over: h + 2.9 }; }
          if (h > 7) { const hut = O('Stair Hut', 'deco'), hp = ax ? v3(a1 - 2.2, h + 1.15, out * (d1 - 2.2)) : v3(out * (d1 - 2.2), h + 1.15, a1 - 2.2); box(hut, hp, v3(1.3, 1.15, 1.3), 'concrete'); box(hut, v3(hp.x, hp.y + 1.2, hp.z), v3(1.4, 0.06, 1.4), 'metal'); } }
        // AC units and a drain pipe on the alley side
        const ac = O('AC Unit', 'deco'), pp = O('Drain Pipe', 'deco');
        for (const e of [a0, a1]) { if (e === -40 || e === 40) continue; const sx = e === a0 ? -1 : 1;
          box(ac, ax ? v3(e + sx * 0.3, 2.4, out * 28) : v3(out * 28, 2.4, e + sx * 0.3), ax ? v3(0.3, 0.35, 0.5) : v3(0.5, 0.35, 0.3), 'metal');
          pipe(pp, ax ? v3(e + sx * 0.1, 0, out * 31) : v3(out * 31, 0, e + sx * 0.1), ax ? v3(e + sx * 0.1, h, out * 31) : v3(out * 31, h, e + sx * 0.1), 0.06, 'galv'); } });
      // alleys: a dumpster in each, and an overhead walkway across two of them
      [-20.5, -1.5, 15.5].forEach((m, k) => { const d = O('Dumpster', 'deco'); box(d, along === 'x' ? v3(m, 0.65, out * 33) : v3(out * 33, 0.65, m), along === 'x' ? v3(0.8, 0.65, 1.0) : v3(1.0, 0.65, 0.8), 'dumpster');
        if ((k + n) % 2 === 0) slabOU('Alley Walkway', along === 'x' ? v3(m, 3.6, out * 30) : v3(out * 30, 3.6, m), along === 'x' ? v3(1.5, 0.08, 0.9) : v3(0.9, 0.08, 1.5), 'metalPlate');
        O('Alley', 'gap', { gap: { c: along === 'x' ? v3(m, 1.6, out * 24) : v3(out * 24, 1.6, m), n: along === 'x' ? v3(0, 0, 1) : v3(1, 0, 0), hu: 1.5, hv: 1.6, u: along === 'x' ? v3(1, 0, 0) : v3(0, 0, 1) } }); }); };
    side('North Shops', 'x', -1, 0); side('South Flats', 'x', 1, 2); side('East Shops', 'z', 1, 1); side('West Flats', 'z', -1, 3);
    // bike racks and bollards on the inner sidewalk
    for (const [x, z] of [[-8, 13.2], [8, -13.2]]) { const br = O('Bike Rack', 'deco'); for (let k = 0; k < 4; k++) { pipe(br, v3(x - 1.2 + k * 0.8, 0, z), v3(x - 1.2 + k * 0.8, 0.8, z), 0.025, 'galv'); } bar('Bike Rack Rail', v3(x - 1.2, 0.8, z), v3(x + 1.2, 0.8, z), 0.025, 'galv'); }
    const park = trickPark(K, -46, 0, -1, { post: 'galv', bar: 'paintRed', pole: 'galv', slab: 'metalPlate', wall: 'concrete', tower: 'brick', accent: 'plasticYellow', glow: false, zone: 'concrete' });
    const zones = [park.zone,
      { shape: 'zone', mat: 'asphalt', c: v3(0, 0.004, 0), h: v3(23, 0, 23) },
      { shape: 'zone', mat: 'concrete', c: v3(0, 0.006, -23), h: v3(24, 0, 1) }, { shape: 'zone', mat: 'concrete', c: v3(0, 0.006, 23), h: v3(24, 0, 1) },
      { shape: 'zone', mat: 'concrete', c: v3(-23, 0.006, 0), h: v3(1, 0, 22) }, { shape: 'zone', mat: 'concrete', c: v3(23, 0.006, 0), h: v3(1, 0, 22) },
      { shape: 'zone', mat: 'rubberMat', c: v3(0, Y + 0.004, 0), h: v3(11.5, 0, 11.5) }, { shape: 'zone', mat: 'sand', c: v3(-6, Y + 0.008, 6), h: v3(2.6, 0, 2.6) }];
    return K.done({ id: 'clappy', title: 'Clappy Park', theme: 'park', zones, spawn: { pos: v3(-8, 0.03, 18), yaw: 0 }, bounds: { x: [-80, 40], z: [-40, 40] } });
  }

  // =============================================================== More Warehouse
  // A big, dim, cluttered logistics warehouse (an original level after the pilot's "warehouse" brief), 60 x 40 m and
  // 12 m to the roof: pallet-rack aisles in the west half (beams at four heights, crates on the shelves), stacked shipping
  // containers and an open container tunnel in the east, a mezzanine with an office under it, two catwalks crossing the
  // hall, an overhead crane bridge, a conveyor, steel columns, crate stacks and barrels, fluorescent lights and four
  // skylights. Three roll-up doors in the south wall lead out to a loading dock and a parked trailer.
  function buildWarehouse() {
    const K = kit(), { O, box, pipe, neon } = K, { frame, bar, slabOU } = parts(K);
    let seed = 4242; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const X = 30, Z = 20, H = 12, T = 0.3;
    // ---- the shell: three plain walls, the south wall with three roll-up doors, a roof with four skylights
    for (const [c, h, n, name] of [[v3(0, H / 2, -Z - T / 2), v3(X + T, H / 2, T / 2), v3(0, 0, 1), 'North Wall'], [v3(-X - T / 2, H / 2, 0), v3(T / 2, H / 2, Z), v3(1, 0, 0), 'West Wall'], [v3(X + T / 2, H / 2, 0), v3(T / 2, H / 2, Z), v3(-1, 0, 0), 'East Wall']]) {
      const o = O(name, 'wall', { wallNormal: n }); box(o, c, h, 'metalPlate'); }
    { const o = O('South Wall', 'wall', { wallNormal: v3(0, 0, -1) }), z = Z + T / 2, doors = [-16, 0, 16], DW = 2.2, DH = 4.5; let x0 = -X;
      for (const d of doors) { box(o, v3((x0 + d - DW) / 2, H / 2, z), v3((d - DW - x0) / 2, H / 2, T / 2), 'metalPlate'); box(o, v3(d, (DH + H) / 2, z), v3(DW, (H - DH) / 2, T / 2), 'metalPlate'); x0 = d + DW;
        box(o, v3(d, DH + 0.3, z - 0.2), v3(DW, 0.3, 0.2), 'galv');   // the rolled-up door
        neon(o, v3(d, DH - 0.02, z - T / 2 - 0.01), v3(DW, 0.02, 0.01), 'plasticYellow');
        O('Roll-up Door', 'gap', { gap: { c: v3(d, DH / 2, z), n: v3(0, 0, 1), hu: DW, hv: DH / 2, u: v3(1, 0, 0) } }); }
      box(o, v3((x0 + X) / 2, H / 2, z), v3((X - x0) / 2, H / 2, T / 2), 'metalPlate'); }
    { const r = O('Warehouse Roof', 'deco'), holes = [[-15, -4], [15, -4]], SW = 3, SL = 5;   // skylights: two pairs, each opening 6 x 10 m split in two
      // strips of roof between and around the skylight openings (x -18..-12 and 12..18, z -9..1)
      for (const [a, b] of [[-X - T, -18], [-12, 12], [18, X + T]]) box(r, v3((a + b) / 2, H + 0.15, 0), v3((b - a) / 2, 0.15, Z + T), 'metal');
      for (const [hx] of holes) { box(r, v3(hx, H + 0.15, (-Z - T - 9) / 2), v3(SW, 0.15, (Z + T - 9) / 2), 'metal'); box(r, v3(hx, H + 0.15, (1 + Z + T) / 2), v3(SW, 0.15, (Z + T - 1) / 2), 'metal');
        box(r, v3(hx, H + 0.1, -4), v3(SW, 0.03, 0.08), 'galv', 0, 0, 0, { noCollide: true });
        for (const zc of [-6.5, -1.5]) O('Skylight', 'gap', { gap: { c: v3(hx, H + 0.15, zc), n: v3(0, 1, 0), hu: SW, hv: SL / 2, u: v3(1, 0, 0) } }); void SL; } }
    // ---- steel columns (the roof's), lights on the roof trusses
    const col = O('Steel Column', 'pole'); for (const x of [-20, -10, 0, 10, 20]) for (const z of [-10, 0, 10]) { if (x === 0 && z === 0) continue; pipe(col, v3(x, 0, z), v3(x, H, z), 0.2, 'paintBlue'); neon(col, v3(x, 1.2, z), v3(0.21, 0.08, 0.21), 'plasticYellow'); }
    // lights: three rows of high-bay fittings under the trusses (strong: the pilot found the first version far too dark)
    for (const x of [-25, -15, -5, 5, 15, 25]) for (const z of [-13, -1, 11]) { const l = O('High-bay Light', 'deco', (x + z) % 2 === 0 || z === -1 ? { light: v3(x, H - 1.0, z), lightColor: 0xeef5ff, lightPower: 60, lightRange: 30 } : {});
      box(l, v3(x, H - 0.75, z), v3(1.3, 0.05, 0.18), 'fluoro', 0, 0, 0, { noCollide: true, glow: true }); box(l, v3(x, H - 0.69, z), v3(1.35, 0.03, 0.24), 'metal', 0, 0, 0, { noCollide: true }); for (const dx of [-1, 1]) pipe(l, v3(x + dx, H - 0.66, z), v3(x + dx, H - 0.3, z), 0.01, 'chain', { noCollide: true }); }
    // the roof structure: a truss every 6 m (top and bottom chords and diagonals), purlins along the hall
    { const tr = O('Roof Truss', 'deco'); for (let x = -27; x <= 27; x += 6) { pipe(tr, v3(x, H - 0.3, -Z), v3(x, H - 0.3, Z), 0.07, 'galv'); pipe(tr, v3(x, H - 1.6, -Z + 1), v3(x, H - 1.6, Z - 1), 0.05, 'galv');
        for (let z = -Z + 1; z < Z - 1; z += 3) pipe(tr, v3(x, H - 1.6, z), v3(x, H - 0.3, z + 1.5), 0.025, 'galv', { noCollide: true }); }
      for (const z of [-15, -9, 3, 9, 15]) pipe(tr, v3(-X, H - 0.25, z), v3(X, H - 0.25, z), 0.04, 'galv', { noCollide: true }); }
    // wall pilasters every 6 m, a strip of high windows along the long walls, a fire exit sign, a few pallets
    { const pw = O('Wall Pilaster', 'deco'); for (let x = -27; x <= 27; x += 6) box(pw, v3(x, H / 2, -Z + 0.12), v3(0.18, H / 2, 0.12), 'paintBlue'); for (let z = -15; z <= 15; z += 6) for (const sx of [-1, 1]) box(pw, v3(sx * (X - 0.12), H / 2, z), v3(0.12, H / 2, 0.18), 'paintBlue');
      const hw = O('High Windows', 'deco'); box(hw, v3(0, 9.6, -Z + 0.02), v3(X - 1, 0.7, 0.02), 'glass', 0, 0, 0, { noCollide: true }); for (const sx of [-1, 1]) box(hw, v3(sx * (X - 0.02), 9.6, 0), v3(0.02, 0.7, Z - 1), 'glass', 0, 0, 0, { noCollide: true });
      const ex = O('Exit Sign', 'deco'); for (const x of [-16, 0, 16]) box(ex, v3(x, 5.4, Z - 0.05), v3(0.35, 0.12, 0.03), 'paintGreen', 0, 0, 0, { noCollide: true, glow: true });
      const pl = O('Pallet', 'deco'); for (const [x, z] of [[-6, 10], [-3, 15], [3, 14.5], [-24, 10], [-18, 15], [26, 10], [-10, 16], [20, 16]]) { box(pl, v3(x, 0.07, z), v3(0.6, 0.07, 0.6), 'wood'); } }
    // ---- pallet racks: three rows in the west half, bays 2.7 m wide, beams at 1.6 / 3.2 / 4.8 / 6.4 m, crates on the shelves
    const up = O('Rack Upright', 'deco'), crate = O('Crate', 'deco');
    for (const rz of [-15, -8, -1]) { const x0 = -28, nb = 8, bw = 2.7, D = 0.55;
      for (let i = 0; i <= nb; i++) for (const dz of [-D, D]) box(up, v3(x0 + i * bw, 3.6, rz + dz), v3(0.05, 3.6, 0.05), 'paintOrange');
      for (let i = 0; i < nb; i++) { const xa = x0 + i * bw, xb = xa + bw;
        for (const y of [1.6, 3.2, 4.8, 6.4]) { bar('Rack Beam', v3(xa, y, rz - D), v3(xb, y, rz - D), 0.05, 'paintOrange'); pipe(up, v3(xa, y, rz + D), v3(xb, y, rz + D), 0.05, 'paintOrange');
          box(up, v3((xa + xb) / 2, y + 0.06, rz), v3(bw / 2 - 0.06, 0.02, D), 'wood');
          if (rnd() < 0.55) { const w = 0.4 + rnd() * 0.35, hh = 0.25 + rnd() * 0.35; box(crate, v3(xa + 0.6 + rnd() * (bw - 1.2), y + 0.08 + hh, rz), v3(w, hh, Math.min(D - 0.05, w)), rnd() < 0.5 ? 'wood' : 'dumpster'); } }
        if (i % 3 === 1) O('Rack Bay', 'gap', { gap: { c: v3((xa + xb) / 2, 2.4, rz), n: v3(0, 0, 1), hu: bw / 2 - 0.08, hv: 0.7, u: v3(1, 0, 0) } }); } }
    // ---- shipping containers: stacks in the east half, one open both ends as a tunnel
    const cont = (name, cx, cy, cz, ry, mat, open) => { const L = 6, W = 1.2, Hh = 1.3, alongX = ry === 0, o = O(name, 'overunder');
      const c = v3(cx, cy + Hh, cz), hx = alongX ? L / 2 : W, hz = alongX ? W : L / 2;
      if (!open) box(o, c, v3(hx, Hh, hz), mat);
      else { box(o, v3(cx, cy + 2 * Hh - 0.05, cz), v3(hx, 0.05, hz), mat); box(o, v3(cx, cy + 0.05, cz), v3(hx, 0.05, hz), mat);
        for (const s of [-1, 1]) box(o, alongX ? v3(cx, cy + Hh, cz + s * (W - 0.05)) : v3(cx + s * (W - 0.05), cy + Hh, cz), alongX ? v3(L / 2, Hh, 0.05) : v3(0.05, Hh, L / 2), mat);
        O(name + ' mouth', 'gap', { gap: { c: v3(cx + (alongX ? L / 2 : 0), cy + Hh, cz + (alongX ? 0 : L / 2)), n: alongX ? v3(1, 0, 0) : v3(0, 0, 1), hu: W - 0.1, hv: Hh - 0.1, u: alongX ? v3(0, 0, 1) : v3(1, 0, 0) } }); }
      o.obstacle = alongX ? { a: v3(cx, 0, cz - W), b: v3(cx, 0, cz + W), under: cy, over: cy + 2 * Hh } : { a: v3(cx - W, 0, cz), b: v3(cx + W, 0, cz), under: cy, over: cy + 2 * Hh }; return o; };
    cont('Container', 8, 0, -9, 0, 'paintBlue'); cont('Container', 8, 2.6, -9, 0, 'paintRed');
    cont('Container', 16, 0, -9, 0, 'paintGreen'); cont('Container', 24, 0, -4, 1, 'paintOrange'); cont('Container', 24, 2.6, -4, 1, 'paintBlue'); cont('Container', 24, 5.2, -4, 1, 'paintGreen');
    cont('Container Tunnel', 14, 0, 3, 0, 'rust', true);
    // ---- mezzanine (north-east) with an office under it and stairs up
    { const o = slabOU('Mezzanine', v3(15, 4.5, -17), v3(13, 0.12, 3), 'metalPlate'); for (const x of [3, 9, 15, 21, 27]) pipe(o, v3(x, 0, -14.2), v3(x, 4.4, -14.2), 0.1, 'paintBlue');
      bar('Mezzanine Rail', v3(2, 5.5, -14), v3(28, 5.5, -14), 0.03, 'plasticYellow');
      const st = O('Mezzanine Stairs', 'deco'); for (let i = 0; i < 12; i++) box(st, v3(1.6 - 0.0, 4.5 * (i + 1) / 12 / 2, -14.4 - (11 - i) * 0.3 + 0), v3(0.6, 4.5 * (i + 1) / 12 / 2, 0.15), 'metalPlate', 0, 0, 0);
      const of = O('Office', 'building', { wallNormal: v3(0, 0, 1), tall: 3.2 });
      box(of, v3(24, 1.6, -15.2), v3(4, 1.6, 0.06), 'vConcrete'); box(of, v3(20, 1.6, -17.6), v3(0.06, 1.6, 2.4), 'vConcrete'); box(of, v3(24, 3.25, -17.6), v3(4, 0.05, 2.4), 'vConcrete');
      O('Office Window', 'gap', { gap: { c: v3(24, 1.5, -15.2), n: v3(0, 0, 1), hu: 1.0, hv: 0.5, u: v3(1, 0, 0) } }); }
    // ---- two catwalks crossing the hall, the crane bridge, the conveyor
    { slabOU('Catwalk', v3(-1, 7.5, 6), v3(27, 0.05, 0.6), 'metalPlate'); for (const z of [5.4, 6.6]) bar('Catwalk Rail', v3(-28, 8.5, z), v3(26, 8.5, z), 0.025, 'plasticYellow');
      slabOU('Catwalk', v3(5, 8.6, 0), v3(0.6, 0.05, 13), 'metalPlate'); for (const x of [4.4, 5.6]) bar('Catwalk Rail', v3(x, 9.6, -13), v3(x, 9.6, 13), 0.025, 'plasticYellow');
      const hg = O('Catwalk Hanger', 'deco'); for (const x of [-20, -5, 15]) for (const z of [5.4, 6.6]) pipe(hg, v3(x, 7.5, z), v3(x, H, z), 0.015, 'galv', { noCollide: true }); }
    for (const z of [-Z + 0.5, Z - 0.5]) bar('Crane Runway', v3(-X + 0.5, 10, z), v3(X - 0.5, 10, z), 0.12, 'plasticYellow');
    { const o = slabOU('Crane Bridge', v3(-12, 10.2, 0), v3(0.35, 0.3, Z - 0.6), 'plasticYellow'); pipe(o, v3(-12, 9.9, 3), v3(-12, 6.5, 3), 0.02, 'chain', { noCollide: true }); box(o, v3(-12, 6.3, 3), v3(0.25, 0.2, 0.25), 'rust'); }
    { const o = slabOU('Conveyor', v3(10, 1.0, 12), v3(14, 0.1, 0.45), 'rubberBlack'); for (let x = -3.5; x <= 23.5; x += 3) for (const z of [11.6, 12.4]) pipe(o, v3(x, 0, z), v3(x, 0.9, z), 0.04, 'galv'); }
    // ---- crate stacks, barrels, a forklift, floor markings
    for (const [x, z, n] of [[-6, 10, 3], [-3, 15, 2], [3, 14.5, 1], [-24, 10, 2], [-18, 15, 3], [26, 10, 2]]) { const o = O('Crate Stack', 'deco'); for (let k = 0; k < n; k++) box(o, v3(x + (k % 2) * 0.1, 0.74 + k * 1.2, z), v3(0.58, 0.6, 0.58), 'wood', k * 0.3); }
    { const b = O('Barrels', 'deco'); for (const [x, z] of [[-26, 16], [-25.3, 16.6], [-26.6, 16.8], [27, 15], [26.3, 15.7]]) pipe(b, v3(x, 0, z), v3(x, 0.9, z), 0.3, ['paintBlue', 'paintRed', 'rust'][Math.floor(rnd() * 3)]); }
    { const f = O('Forklift', 'deco'), x = 9, z = 17; box(f, v3(x, 0.6, z), v3(0.6, 0.45, 1.0), 'plasticYellow'); for (const s of [-1, 1]) pipe(f, v3(x + s * 0.45, 0, z - 1.0), v3(x + s * 0.45, 2.6, z - 1.0), 0.04, 'metal'); box(f, v3(x, 0.15, z - 1.6), v3(0.5, 0.03, 0.6), 'metal'); box(f, v3(x, 1.9, z + 0.2), v3(0.6, 0.04, 0.7), 'metal'); }
    { const m = O('Floor Marking', 'deco'); for (const z of [-11.5, -4.5, 2.5]) box(m, v3(-15, 0.008, z), v3(13, 0.004, 0.06), 'plasticYellow', 0, 0, 0, { noCollide: true }); for (const x of [-16, 0, 16]) box(m, v3(x, 0.008, Z - 2), v3(2.4, 0.004, 0.06), 'plasticYellow', 0, 0, 0, { noCollide: true }); }
    // ---- outside: the loading dock and a parked trailer
    { const d = O('Loading Dock', 'deco'); box(d, v3(0, 0.6, Z + T + 1.5), v3(22, 0.6, 1.5), 'concrete'); for (const x of [-16, 0, 16]) for (const s of [-1, 1]) box(d, v3(x + s * 1.8, 0.8, Z + T + 3.05), v3(0.2, 0.25, 0.06), 'rubberBlack');
      const tr = O('Trailer', 'overunder', { obstacle: { a: v3(-17.25, 0, 30), b: v3(-14.75, 0, 30), under: 1.25, over: 4.15 } }); box(tr, v3(-16, 2.7, 30), v3(1.25, 1.45, 6), 'metalPlate'); box(tr, v3(-16, 1.2, 30), v3(1.2, 0.05, 6), 'metal');
      for (const z of [33.5, 34.8]) for (const s of [-1, 1]) pipe(tr, v3(-16 + s * 1.05, 0.5, z), v3(-16 + s * 1.3, 0.5, z), 0.5, 'tire');
      for (const s of [-1, 1]) pipe(tr, v3(-16 + s * 0.9, 0, 24.6), v3(-16 + s * 0.9, 1.15, 24.6), 0.05, 'metal'); }
    void frame;
    const zones = [{ shape: 'zone', mat: 'concrete', c: v3(0, 0.005, 0), h: v3(X, 0, Z) }, { shape: 'zone', mat: 'asphalt', c: v3(0, 0.004, Z + 9), h: v3(X, 0, 9) }];
    return K.done({ id: 'warehouse', title: 'More Warehouse', theme: 'industrial', zones, spawn: { pos: v3(0, 0.03, 16), yaw: 0 }, bounds: { x: [-X, X], z: [-Z, Z + 18] } });
  }

  // =============================================================== Abandoned Vaporwave School
  // A school complex round a courtyard, a little oversized for a whoop, under a permanent pink sunset. x east, z south.
  //   Entrance plaza (south, z 12..31): chrome pillar grid, planters and gap frames, floating acrylic, stairs.
  //   Courtyard (centre): a bowl ringed by a raised deck with ramps and tunnels, a railed platform, chrome islands.
  //   Main hall (north, z -32..-16): pillar forest under a high roof, beams and broken catwalks, doorways at both ends.
  //   Rooftop (y 10.7): three roof sections with dive gaps between them, parapets, pillars, fallen columns.
  //   Side wings (east: a low classroom shell; west: door-frame run and a window wall).
  function buildSchool() {
    const K = kit(), { O, box, pipe, ball, neon, disc } = K;
    let seed = 20261117; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const NE = ['neonPink', 'neonCyan', 'neonPurple', 'neonYellow'];
    // a standing frame to fly through: two posts and a lintel, with its opening tagged as a gap and its lintel as over/under
    const frame = (name, cx, cz, w, hgt, along, mat = 'vLav', glow = 'neonCyan') => {      // along: 'x' = the frame's width runs along x
      const o = O(name, 'overunder'), t = 0.09, ax = along === 'x';
      for (const s of [-1, 1]) box(o, v3(cx + (ax ? s * (w / 2 + t) : 0), hgt / 2, cz + (ax ? 0 : s * (w / 2 + t))), v3(ax ? t : t, hgt / 2, ax ? t : t), mat);
      box(o, v3(cx, hgt + t, cz), v3(ax ? w / 2 + 2 * t : t, t, ax ? t : w / 2 + 2 * t), mat);
      neon(o, v3(cx, hgt - 0.015, cz), v3(ax ? w / 2 : 0.02, 0.015, ax ? 0.02 : w / 2), glow);
      o.obstacle = { a: v3(cx - (ax ? w / 2 : 0), 0, cz - (ax ? 0 : w / 2)), b: v3(cx + (ax ? w / 2 : 0), 0, cz + (ax ? 0 : w / 2)), under: hgt, over: hgt + 2 * t };
      O(name + ' opening', 'gap', { gap: { c: v3(cx, hgt / 2, cz), n: ax ? v3(0, 0, 1) : v3(1, 0, 0), hu: w / 2, hv: hgt / 2, u: ax ? v3(1, 0, 0) : v3(0, 0, 1) } });
      return o;
    };
    // a wall with real window openings (each one a gap to fly): the wall runs along `axis` at the fixed other coordinate
    const windowWall = (o, axis, fixed, a0, a1, y0, y1, th, mat, wins, rows, gapName, glow = 'neonCyan') => {
      const Z = axis === 'z', seg = (b0, b1, ya, yb) => { if (b1 - b0 < 0.01 || yb - ya < 0.01) return; const m = (b0 + b1) / 2, hl = (b1 - b0) / 2; box(o, v3(Z ? fixed : m, (ya + yb) / 2, Z ? m : fixed), v3(Z ? th : hl, (yb - ya) / 2, Z ? hl : th), mat); };
      let y = y0; for (const [rb, rt] of rows) { seg(a0, a1, y, rb); let b = a0; for (const w of wins) { seg(b, w.c - w.hw, rb, rt); b = w.c + w.hw;
          O(gapName, 'gap', { gap: { c: v3(Z ? fixed : w.c, (rb + rt) / 2, Z ? w.c : fixed), n: Z ? v3(1, 0, 0) : v3(0, 0, 1), hu: w.hw, hv: (rt - rb) / 2, u: Z ? v3(0, 0, 1) : v3(1, 0, 0) } });
          for (const s of [-1, 1]) neon(o, v3(Z ? fixed + s * (th + 0.012) : w.c, rb + 0.015, Z ? w.c : fixed + s * (th + 0.012)), v3(Z ? 0.012 : w.hw, 0.015, Z ? w.hw : 0.012), glow); }
        seg(b, a1, rb, rt); y = rt; }
      seg(a0, a1, y, y1);
    };
    // a horizontal bar or slab to go over and under
    const bar = (name, a, b, r, mat, glow) => { const o = O(name, 'overunder', { obstacle: { a: v3(a.x, 0, a.z), b: v3(b.x, 0, b.z), under: Math.min(a.y, b.y) - r, over: Math.max(a.y, b.y) + r } }); pipe(o, a, b, r, mat); if (glow) pipe(o, v3(a.x, a.y - r - 0.012, a.z), v3(b.x, b.y - r - 0.012, b.z), 0.012, glow, { noCollide: true, glow: true }); return o; };

    // ---------------------------------------------------------------- 1. Entrance plaza / gap city
    const pil = O('Chrome Pillar', 'pole');
    for (const z of [14.5, 18, 21.5, 25]) for (let x = -13; x <= 13; x += 3.25) {
      if (Math.abs(x) < 2 && z > 16) continue; const jx = x + (rnd() - 0.5) * 1.1, jz = z + (rnd() - 0.5) * 1.0, h = 1.2 + Math.floor(rnd() * 4) * 0.6;
      pipe(pil, v3(jx, 0, jz), v3(jx, h, jz), 0.13 + rnd() * 0.07, 'chrome'); pipe(pil, v3(jx, h, jz), v3(jx, h + 0.03, jz), 0.2, NE[Math.floor(rnd() * 3)], { noCollide: true, glow: true });
    }
    // planters and low walls with gaps of different lengths between them (open-topped gaps: hop them or thread them low)
    const pln = O('Planter', 'deco');
    for (const [x0, x1, z, hh, m] of [[-15, -11, 28, 0.3, 'vMint'], [-9.5, -6.5, 28, 0.3, 'vPink'], [-4.5, -2.2, 28, 0.3, 'vMint'], [2.2, 5.5, 28, 0.3, 'vPink'], [7, 9, 28, 0.3, 'vMint'], [11.5, 15, 28, 0.3, 'vPink'],
      [-14, -9, 12.6, 0.55, 'vLav'], [-6.5, -3.4, 12.6, 0.55, 'vLav'], [3.4, 6.5, 12.6, 0.55, 'vLav'], [9, 14, 12.6, 0.55, 'vLav']]) {
      box(pln, v3((x0 + x1) / 2, hh, z), v3((x1 - x0) / 2, hh, 0.45), m); neon(pln, v3((x0 + x1) / 2, 2 * hh + 0.012, z - 0.44), v3((x1 - x0) / 2, 0.012, 0.015), 'neonCyan'); neon(pln, v3((x0 + x1) / 2, 2 * hh + 0.012, z + 0.44), v3((x1 - x0) / 2, 0.012, 0.015), 'neonPink');
    }
    frame('Gap Frame', -7.9, 20, 1.3, 1.5, 'x', 'vPink', 'neonPink'); frame('Gap Frame', 7.9, 23.2, 1.8, 2.2, 'x', 'vMint', 'neonCyan'); frame('Gap Frame', 0, 16.2, 2.4, 1.8, 'x', 'chrome', 'neonYellow'); frame('Gap Frame', -12.2, 16.3, 1.2, 1.2, 'z', 'chrome', 'neonPurple');
    // floating acrylic platforms at staggered heights
    for (const [x, z, y, w, ry] of [[-5, 23.4, 1.25, 1.7, 0], [4.6, 19.6, 1.8, 1.9, 0], [-10.6, 23.6, 2.4, 1.6, 0], [10.8, 17.2, 2.9, 1.8, 0], [0, 22.6, 3.3, 2.2, 0], [5.2, 26, 1.1, 1.5, 0]]) {
      const o = O('Acrylic Platform', 'overunder', { obstacle: { a: v3(x - w / 2, 0, z), b: v3(x + w / 2, 0, z), under: y - 0.035, over: y + 0.035 } });
      box(o, v3(x, y, z), v3(w / 2, 0.03, 0.5), 'acrylic', ry, 0, 0, { alpha: true }); for (const s of [-1, 1]) neon(o, v3(x, y, z + s * 0.5), v3(w / 2, 0.012, 0.012), s > 0 ? 'neonPink' : 'neonCyan');
    }
    // knife-edge ledges round the plaza (ride them like walls, balance along the top)
    for (const [cx, cz, hx, hz, n] of [[-16.5, 21.5, 0.07, 9.5, v3(1, 0, 0)], [16.5, 21.5, 0.07, 9.5, v3(-1, 0, 0)], [-9.5, 31, 7, 0.07, v3(0, 0, -1)], [9.5, 31, 7, 0.07, v3(0, 0, -1)]]) {
      const o = O('Plaza Ledge', 'wall', { wallNormal: n }); box(o, v3(cx, 0.55, cz), v3(hx, 0.55, hz), 'vConcrete'); neon(o, v3(cx, 1.112, cz), v3(Math.max(hx, 0.02), 0.012, Math.max(hz, 0.02)), 'neonPink');
    }
    // neon stairs up to the courtyard deck (5 steps east, 7 shallow ones west, a switchback landing in the middle)
    const st = O('Neon Stairs', 'deco');
    for (const [cx, n, w] of [[8, 5, 2.2], [-8, 7, 2.2]]) for (let i = 0; i < n; i++) { const hh = 1.2 * (i + 1) / n / 2, zc = 12.0 + (n - i - 0.5) * (2.4 / n) - 2.4 - 0.0;
      box(st, v3(cx, hh, zc + 2.4), v3(w, hh, 1.2 / n), i % 2 ? 'vPink' : 'vLav'); neon(st, v3(cx, 2 * hh + 0.012, zc + 2.4 + 1.2 / n - 0.02), v3(w, 0.012, 0.02), i % 2 ? 'neonCyan' : 'neonPink'); }
    addPilot(K, 2.6, 28.9);

    // ---------------------------------------------------------------- 3. Courtyard bowl and transfer zone
    // a deck 1.2 m up on all four sides (the bowl is the floor inside it), ramps down into it, tunnels through it
    const DK = 1.2, deck = O('Courtyard Deck', 'deco');
    const slab = (x0, x1, z0, z1, m = 'vConcrete') => box(deck, v3((x0 + x1) / 2, DK / 2, (z0 + z1) / 2), v3((x1 - x0) / 2, DK / 2, (z1 - z0) / 2), m);
    // south and north decks have a tunnel at x = 0; east and west ones at z = 0
    for (const zs of [[9, 12], [-12, -9]]) { slab(-12, -1.1, zs[0], zs[1]); slab(1.1, 12, zs[0], zs[1]); }
    for (const xs of [[9, 12], [-12, -9]]) { slab(xs[0], xs[1], -9, -1.1, 'vLav'); slab(xs[0], xs[1], 1.1, 9, 'vLav'); }
    for (const [cx, cz, ax, g] of [[0, 10.5, 'x', 'neonPink'], [0, -10.5, 'x', 'neonCyan'], [10.5, 0, 'z', 'neonYellow'], [-10.5, 0, 'z', 'neonPurple']]) {
      const o = O('Bowl Tunnel', 'overunder'), X = ax === 'x';
      box(o, v3(cx, DK - 0.09, cz), v3(X ? 1.1 : 1.5, 0.09, X ? 1.5 : 1.1), 'vConcrete');
      o.obstacle = { a: v3(cx - (X ? 1.1 : 0), 0, cz - (X ? 0 : 1.1)), b: v3(cx + (X ? 1.1 : 0), 0, cz + (X ? 0 : 1.1)), under: DK - 0.18, over: DK };
      for (const s of [-1, 1]) neon(o, v3(cx + (X ? s * 1.08 : 0), 0.03, cz + (X ? 0 : s * 1.08)), v3(X ? 0.015 : 1.5, 0.015, X ? 1.5 : 0.015), g);
      neon(o, v3(cx, DK - 0.2, cz), v3(X ? 1.0 : 0.02, 0.012, X ? 0.02 : 1.0), g);
      O('Bowl Tunnel opening', 'gap', { gap: { c: v3(cx, (DK - 0.18) / 2, cz), n: X ? v3(0, 0, 1) : v3(1, 0, 0), hu: 1.1, hv: (DK - 0.18) / 2, u: X ? v3(1, 0, 0) : v3(0, 0, 1) } });
    }
    // transitions: banked slabs from the bowl floor up to the deck lip, either side of each tunnel
    const RUN = 1.9, RL = Math.hypot(RUN, DK) / 2, RA = Math.atan2(DK, RUN), ramp = O('Bowl Transition', 'deco');
    for (const [x0, x1] of [[-9, -1.3], [1.3, 9]]) for (const s of [-1, 1]) {
      box(ramp, v3((x0 + x1) / 2, DK / 2 - 0.02, s * (9 - RUN / 2)), v3((x1 - x0) / 2, 0.03, RL), 'vRubber', 0, -s * RA, 0);
      box(ramp, v3(s * (9 - RUN / 2), DK / 2 - 0.02, (x0 + x1) / 2), v3(RL, 0.03, (x1 - x0) / 2), 'vRubber', 0, 0, s * RA);
    }
    for (const s of [-1, 1]) { neon(deck, v3(0, DK + 0.012, s * 9.02), v3(9, 0.012, 0.02), 'neonCyan'); neon(deck, v3(s * 9.02, DK + 0.012, 0), v3(0.02, 0.012, 9), 'neonPink'); }
    // central platform with a rail on each side
    const cp = O('Centre Platform', 'deco'); box(cp, v3(0, 0.45, 0), v3(2, 0.45, 2), 'vPink'); neon(cp, v3(0, 0.912, 0), v3(2, 0.012, 2), 'neonPurple'); box(cp, v3(0, 0.905, 0), v3(1.96, 0.012, 1.96), 'vPink', 0, 0, 0, { noCollide: true });
    for (const [x, z] of [[-1.95, -1.95], [1.95, -1.95], [-1.95, 1.95], [1.95, 1.95]]) box(cp, v3(x, 1.2, z), v3(0.03, 0.3, 0.03), 'chrome');
    bar('Platform Rail', v3(-1.95, 1.5, -1.95), v3(1.95, 1.5, -1.95), 0.03, 'chrome', 'neonCyan'); bar('Platform Rail', v3(-1.95, 1.5, 1.95), v3(1.95, 1.5, 1.95), 0.03, 'chrome', 'neonCyan');
    bar('Platform Rail', v3(-1.95, 1.5, -1.95), v3(-1.95, 1.5, 1.95), 0.03, 'chrome', 'neonPink'); bar('Platform Rail', v3(1.95, 1.5, -1.95), v3(1.95, 1.5, 1.95), 0.03, 'chrome', 'neonPink');
    // chrome islands hovering over the bowl
    for (const [x, z, y, r] of [[-5.2, -4.6, 2.6, 1.0], [5, -5.2, 3.5, 1.15], [5.6, 4.6, 2.3, 0.9], [-4.8, 5.2, 4.3, 1.2], [0, 0, 5.4, 1.4]]) {
      const o = O('Chrome Island', 'overunder', { round: { c: v3(x, 0, z), r, under: y - 0.05, over: y + 0.05 }, obstacle: { a: v3(x - r, 0, z), b: v3(x + r, 0, z), under: y - 0.05, over: y + 0.05 } });
      disc(o, v3(x, y, z), r, 0.045, 'chrome'); o.vis.push({ shape: 'disc', c: v3(x, y - 0.05, z), r: r * 1.02, th: 0.008, mat: NE[Math.floor(rnd() * 3)], glow: true });
    }
    // broken classical columns at the corners of the deck
    for (const [x, z, h] of [[-10.5, -10.5, 5.2], [10.5, -10.5, 3.1], [-10.5, 10.5, 2.2], [10.5, 10.5, 4.4], [-10.5, 5, 3.6], [10.5, -5, 2.6]]) {
      const o = O('Broken Column', 'pole'); box(o, v3(x, DK + 0.12, z), v3(0.42, 0.12, 0.42), 'marble'); pipe(o, v3(x, DK + 0.24, z), v3(x, DK + h, z), 0.24, 'marble'); box(o, v3(x, DK + h + 0.03, z), v3(0.2, 0.05, 0.16), 'marble', 0.6, 0.25, 0.15, { noCollide: true });
    }

    // ---------------------------------------------------------------- 2. Main hall / pillar forest, and 4. the rooftop
    const HZ0 = -32, HZ1 = -16, HX = 18, HH = 10.4, hall = O('Main Hall', 'building', { wallNormal: v3(0, 0, 1), tall: HH });
    windowWall(hall, 'x', HZ0 - 0.2, -(HX + 0.4), HX + 0.4, 0, HH, 0.2, 'vLav', Array.from({ length: 8 }, (_, i) => ({ c: -15.75 + i * 4.5, hw: 1.3 })), [[5.4, 7.8]], 'Hall Window', 'neonPink');   // north wall, with a row of open windows
    // the south face: an open colonnade below, a band of wall above it carrying the pilot's pieces
    box(hall, v3(0, 4.4 + (HH - 4.4) / 2, HZ1 + 0.2), v3(HX + 0.4, (HH - 4.4) / 2, 0.2), 'vConcrete', 0, 0, 0, { graffiti: 'south', art: [{ name: 'clappy', x: 0.1, y: 3.0, h: 5.0, rot: -0.04 }, { name: 'mopenguinz', x: 0.3, y: 3.0, h: 4.6, rot: 0.03 }, { name: 'heyhey', x: 0.5, y: 3.1, h: 4.2, rot: 0.02 }, { name: 'byteme', x: 0.7, y: 3.0, h: 4.8, rot: -0.03 }, { name: 'rwdc', x: 0.9, y: 2.9, h: 4.6, rot: 0.05 }] });
    neon(hall, v3(0, 4.4, HZ1 + 0.42), v3(HX, 0.03, 0.03), 'neonPink');
    for (const s of [-1, 1]) {                                                                               // end walls with a tall doorway each
      const ew = O('Hall End Wall', 'wall', { wallNormal: v3(-s, 0, 0) }), x = s * (HX + 0.2), zc = (HZ0 + HZ1) / 2;
      box(ew, v3(x, HH / 2, HZ0 + 2.6), v3(0.2, HH / 2, 2.6), 'vMint'); box(ew, v3(x, HH / 2, HZ1 - 2.6), v3(0.2, HH / 2, 2.6), 'vMint'); box(ew, v3(x, 4.2 + (HH - 4.2) / 2, zc), v3(0.2, (HH - 4.2) / 2, 2.8), 'vMint');
      neon(ew, v3(x - s * 0.22, 4.2, zc), v3(0.02, 0.03, 2.8), 'neonCyan');
      O('Hall Doorway', 'gap', { gap: { c: v3(x, 2.1, zc), n: v3(1, 0, 0), hu: 2.8, hv: 2.1, u: v3(0, 0, 1) } });
    }
    // the pillar forest: round and square in turn, on a grid tight enough to weave
    const rp = O('Hall Pillar', 'pole'), sp = O('Square Pillar', 'deco');
    [-29.2, -25.6, -22, -18.4].forEach((z, r) => { for (let i = 0; i < 9; i++) { const x = -15 + i * 3.75;
      if ((i + r) % 2) { box(sp, v3(x, HH / 2, z), v3(0.26, HH / 2, 0.26), 'vPink'); neon(sp, v3(x, 0.02, z), v3(0.3, 0.02, 0.3), 'neonPink'); }
      else { pipe(rp, v3(x, 0, z), v3(x, HH, z), 0.24, 'marble'); pipe(rp, v3(x, 0.02, z), v3(x, 0.05, z), 0.3, 'neonCyan', { noCollide: true, glow: true }); } } });
    // beams between pillars at two heights, broken catwalks higher up, a knife-edge rail along the south side
    bar('Hall Beam', v3(-15, 2.6, -25.6), v3(-3.75, 2.6, -25.6), 0.07, 'chrome', 'neonCyan'); bar('Hall Beam', v3(0, 4.3, -22), v3(15, 4.3, -22), 0.07, 'chrome', 'neonPink');
    bar('Hall Beam', v3(-7.5, 3.4, -29.2), v3(-7.5, 3.4, -18.4), 0.07, 'chrome', 'neonYellow'); bar('Hall Beam', v3(7.5, 2.2, -29.2), v3(7.5, 2.2, -22), 0.07, 'chrome', 'neonPurple');
    for (const [x0, x1, z, y] of [[-18, -9.2, -27.4, 6.2], [-5.4, 3.2, -27.4, 6.2], [6.4, 18, -20.2, 7.4]]) {
      const o = O('Broken Catwalk', 'overunder', { obstacle: { a: v3(x0, 0, z), b: v3(x1, 0, z), under: y - 0.06, over: y + 0.06 } }); box(o, v3((x0 + x1) / 2, y, z), v3((x1 - x0) / 2, 0.05, 0.6), 'vMint'); for (const s of [-1, 1]) neon(o, v3((x0 + x1) / 2, y - 0.06, z + s * 0.6), v3((x1 - x0) / 2, 0.012, 0.012), 'neonCyan');
    }
    { const o = O('Hall Rail', 'overunder', { obstacle: { a: v3(-16.5, 0, -17), b: v3(16.5, 0, -17), under: 1.5, over: 1.72 } }); box(o, v3(0, 1.61, -17), v3(16.5, 0.11, 0.04), 'vConcrete'); neon(o, v3(0, 1.735, -17), v3(16.5, 0.012, 0.04), 'neonYellow');
      for (let x = -16.5; x <= 16.5; x += 5.5) box(o, v3(x, 0.75, -17), v3(0.05, 0.75, 0.05), 'chrome'); }
    // the roof: three sections with dive gaps between, parapets to ride, pillars, fallen column drums
    const RY = HH + 0.15, roof = O('Hall Roof', 'deco', { perchHeight: RY + 0.15 }), zc = (HZ0 + HZ1) / 2, zh = (HZ1 - HZ0) / 2 + 0.4;
    for (const [x0, x1, m] of [[-18.4, -7.5, 'vLav'], [-4.5, 4.5, 'vPink'], [7.5, 18.4, 'vLav']]) { box(roof, v3((x0 + x1) / 2, RY, zc), v3((x1 - x0) / 2, 0.15, zh), m);
      for (let z = HZ0 + 2; z < HZ1; z += 2) neon(roof, v3((x0 + x1) / 2, RY + 0.158, z), v3((x1 - x0) / 2, 0.006, 0.02), 'neonCyan');
      for (let x = x0 + 1.5; x < x1; x += 3) neon(roof, v3(x, RY + 0.158, zc), v3(0.02, 0.006, zh), 'neonPink');
      for (const s of [-1, 1]) neon(roof, v3(s > 0 ? x1 : x0, RY + 0.17, zc), v3(0.03, 0.02, zh), 'neonYellow'); }
    for (const [cx, cz, hx, hz, n] of [[0, HZ0 - 0.3, 18.4, 0.08, v3(0, 0, 1)], [0, HZ1 + 0.3, 18.4, 0.08, v3(0, 0, -1)]]) { const o = O('Roof Parapet', 'wall', { wallNormal: n }); for (const [x0, x1] of [[-18.4, -7.5], [-4.5, 4.5], [7.5, 18.4]]) box(o, v3((x0 + x1) / 2, RY + 0.55, cz), v3((x1 - x0) / 2, 0.4, hz), 'vConcrete'); neon(o, v3(cx, RY + 0.962, cz), v3(hx, 0.012, hz), 'neonPink'); }
    const rpil = O('Roof Pillar', 'pole'); for (const [x, z, h] of [[-13, -28, 2.4], [-10.5, -20, 1.6], [0, -24, 2.8], [2.5, -29, 1.5], [11, -19.5, 2.2], [15, -27, 1.8]]) { pipe(rpil, v3(x, RY + 0.15, z), v3(x, RY + 0.15 + h, z), 0.12, 'chrome'); pipe(rpil, v3(x, RY + 0.15 + h, z), v3(x, RY + 0.18 + h, z), 0.18, 'neonPurple', { noCollide: true, glow: true }); }
    const fc = O('Fallen Column', 'deco'); pipe(fc, v3(-16, RY + 0.5, -23), v3(-12.6, RY + 0.5, -24.2), 0.34, 'marble'); pipe(fc, v3(9.5, RY + 0.5, -27.5), v3(12, RY + 0.5, -25.2), 0.34, 'marble'); pipe(fc, v3(-2.5, RY + 0.45, -19.5), v3(-0.6, RY + 0.45, -19), 0.3, 'marble');

    // ---------------------------------------------------------------- 5. Side wings
    // east: a low classroom shell (roof at 3 m: a second, lower roof line to gap to from the hall)
    const EX0 = 20, EX1 = 30, EZ0 = -12, EZ1 = 10, CH = 2.8, cls = O('Classroom Shell', 'building', { wallNormal: v3(-1, 0, 0) });
    windowWall(cls, 'z', EX1 + 0.1, EZ0, EZ1, 0, CH, 0.1, 'vMint', Array.from({ length: 5 }, (_, i) => ({ c: EZ0 + 2.4 + i * 4.4, hw: 1.1 })), [[1.0, 2.2]], 'Classroom Window', 'neonCyan');   // east wall: five open windows
    // west wall: segments leaving two doorways (z -6, z 4) and two windows (z -1, z 8)
    for (const [z0, z1] of [[EZ0, -6.8], [-5.2, -1.7], [-0.3, 3.2], [4.8, 7.4], [8.6, EZ1]]) box(cls, v3(EX0 - 0.1, CH / 2, (z0 + z1) / 2), v3(0.1, CH / 2, (z1 - z0) / 2), 'vPink');
    for (const zd of [-6, 4]) { box(cls, v3(EX0 - 0.1, 2.2 + (CH - 2.2) / 2, zd), v3(0.1, (CH - 2.2) / 2, 0.8), 'vPink'); neon(cls, v3(EX0 - 0.21, 2.2, zd), v3(0.012, 0.02, 0.8), 'neonCyan'); O('Classroom Door', 'gap', { gap: { c: v3(EX0 - 0.1, 1.1, zd), n: v3(1, 0, 0), hu: 0.8, hv: 1.1, u: v3(0, 0, 1) } }); }
    for (const zw of [-1, 8]) { box(cls, v3(EX0 - 0.1, 0.5, zw), v3(0.1, 0.5, 0.7), 'vPink'); box(cls, v3(EX0 - 0.1, 1.9 + (CH - 1.9) / 2, zw), v3(0.1, (CH - 1.9) / 2, 0.7), 'vPink'); neon(cls, v3(EX0 - 0.21, 1.0, zw), v3(0.012, 0.015, 0.7), 'neonYellow'); O('Classroom Window', 'gap', { gap: { c: v3(EX0 - 0.1, 1.45, zw), n: v3(1, 0, 0), hu: 0.7, hv: 0.45, u: v3(0, 0, 1) } }); }
    for (const [z, n] of [[EZ0 - 0.1, v3(0, 0, 1)], [EZ1 + 0.1, v3(0, 0, -1)]]) { const o = O('Classroom End Wall', 'wall', { wallNormal: n }); box(o, v3(EX0 + 1.9, CH / 2, z), v3(1.9, CH / 2, 0.1), 'vLav'); box(o, v3(EX1 - 1.9, CH / 2, z), v3(1.9, CH / 2, 0.1), 'vLav'); box(o, v3((EX0 + EX1) / 2, 2.3 + (CH - 2.3) / 2, z), v3(1.2, (CH - 2.3) / 2, 0.1), 'vLav');
      O('Classroom End Door', 'gap', { gap: { c: v3((EX0 + EX1) / 2, 1.15, z), n: v3(0, 0, 1), hu: 1.2, hv: 1.15, u: v3(1, 0, 0) } }); }
    { const o = O('Classroom Roof', 'deco'); box(o, v3((EX0 + EX1) / 2, CH + 0.1, (EZ0 + EZ1) / 2), v3((EX1 - EX0) / 2 + 0.3, 0.1, (EZ1 - EZ0) / 2 + 0.3), 'vLav'); for (const s of [-1, 1]) neon(o, v3((EX0 + EX1) / 2 + s * ((EX1 - EX0) / 2 + 0.3), CH + 0.212, (EZ0 + EZ1) / 2), v3(0.03, 0.012, (EZ1 - EZ0) / 2 + 0.3), 'neonPink'); }
    // furniture-scale over/unders: low tables, floating shelves, a hanging frame
    for (const [x, z] of [[23, -9], [26.5, -9], [23, -3.4], [26.5, 1.2]]) { const o = O('Low Table', 'overunder', { obstacle: { a: v3(x - 0.8, 0, z), b: v3(x + 0.8, 0, z), under: 0.68, over: 0.76 } }); box(o, v3(x, 0.72, z), v3(0.8, 0.03, 0.42), 'vMint'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(o, v3(x + sx * 0.74, 0.345, z + sz * 0.36), v3(0.025, 0.345, 0.025), 'chrome'); neon(o, v3(x, 0.685, z), v3(0.8, 0.008, 0.42), 'neonCyan'); }
    for (const [z, y] of [[-10.6, 1.3], [-10.6, 1.95], [5.6, 1.5]]) { const o = O('Floating Shelf', 'overunder', { obstacle: { a: v3(27.4, 0, z), b: v3(29.6, 0, z), under: y - 0.03, over: y + 0.03 } }); box(o, v3(28.5, y, z), v3(1.1, 0.025, 0.22), 'acrylic', 0, 0, 0, { alpha: true }); neon(o, v3(28.5, y, z - 0.22), v3(1.1, 0.01, 0.01), 'neonPurple'); }
    { const o = O('Hanging Frame', 'overunder', { obstacle: { a: v3(24.4, 0, 6.6), b: v3(25.6, 0, 6.6), under: 1.05, over: 2.0 } }); for (const y of [1.05, 2.0]) pipe(o, v3(24.4, y, 6.6), v3(25.6, y, 6.6), 0.02, 'neonYellow', { glow: true }); for (const x of [24.4, 25.6]) pipe(o, v3(x, 1.05, 6.6), v3(x, 2.0, 6.6), 0.02, 'neonYellow', { glow: true });
      O('Hanging Frame opening', 'gap', { gap: { c: v3(25, 1.525, 6.6), n: v3(0, 0, 1), hu: 0.58, hv: 0.45, u: v3(1, 0, 0) } }); }
    // a cluster of thin poles for pole-jamming
    const tp = O('Thin Pole', 'pole'); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const x = 22.4 + i * 1.0, z = 2.6 + j * 1.0 + (i % 2) * 0.3; pipe(tp, v3(x, 0, z), v3(x, CH, z), 0.022, (i + j) % 2 ? 'neonPink' : 'neonCyan', { glow: true }); }
    // west: an open run of door frames to thread, in front of a wall of open windows
    for (let i = 0; i < 6; i++) frame('Door Frame', -25, -9 + i * 3.4, 1.3 - (i % 3) * 0.15, 2.1 - (i % 2) * 0.5, 'x', i % 2 ? 'vPink' : 'vMint', NE[i % 4]);
    { const o = O('Window Wall', 'wall', { wallNormal: v3(1, 0, 0) }); windowWall(o, 'z', -30.2, -12, 10, 0, 4.4, 0.2, 'vLav', Array.from({ length: 6 }, (_, i) => ({ c: -10 + i * 3.6, hw: 1.3 })), [[0.5, 1.9], [2.3, 3.7]], 'Wall Window', 'neonYellow'); neon(o, v3(-29.98, 4.412, -1), v3(0.02, 0.012, 11), 'neonCyan'); }
    for (const [x, z, h] of [[-21, -11, 3.8], [-22, 11.5, 2.4]]) { const o = O('Broken Column', 'pole'); box(o, v3(x, 0.12, z), v3(0.42, 0.12, 0.42), 'marble'); pipe(o, v3(x, 0.24, z), v3(x, h, z), 0.24, 'marble'); }
    { const o = O('Fallen Column', 'deco'); pipe(o, v3(-23.5, 0.34, 13.5), v3(-20.2, 0.34, 15), 0.34, 'marble'); }

    const park = trickPark(K, -34, -1, -1, { post: 'chrome', bar: 'chrome', pole: 'marble', slab: 'vLav', wall: 'vMint', tower: 'vLav', accent: 'neonYellow', glow: true, zone: 'vChromeFloor' });
    const zones = [
      park.zone,
      { shape: 'zone', mat: 'vPlaza', c: v3(0, 0.006, 21.6), h: v3(16.4, 0, 9.5) },
      { shape: 'zone', mat: 'vRubberFloor', c: v3(0, 0.008, 0), h: v3(9, 0, 9) },
      { shape: 'zone', mat: 'vChromeFloor', c: v3(0, 0.006, -24), h: v3(18, 0, 8) },
      { shape: 'zone', mat: 'vChromeFloor', c: v3(25, 0.006, -1), h: v3(5, 0, 11) },
      { shape: 'zone', mat: 'vPlaza', c: v3(-25, 0.006, -1), h: v3(4.6, 0, 11) },
    ];
    return K.done({ id: 'school', title: 'the vaporwave school', theme: 'vapor', zones, spawn: { pos: v3(0, 0.03, 29.4), yaw: 0 }, bounds: { x: [-68, 34], z: [-36, 34] } });
  }

  // =============================================================== The Playground, filled out
  // The original map is left exactly as it was (the tests and the bot fly it); the game adds these on top. Same idea as
  // the school — more height layers, more lines through the same space, gaps, ledges, a pole run — in the playground's
  // own materials: plywood, scaffold tube, concrete, brick, painted steel. Safety-yellow edges mark what is meant to be
  // tricked. Placed in the empty corners so the flagpole, lamp posts and trees keep their room.
  function addPlaygroundExtras(w) {
    const K = kit(w), { O, box, pipe } = K;
    const stripe = (o, c, h, ry = 0) => box(o, c, h, 'plasticYellow', ry, 0, 0, { noCollide: true });
    const bar = (name, a, b, r, mat) => { const o = O(name, 'overunder', { obstacle: { a: v3(a.x, 0, a.z), b: v3(b.x, 0, b.z), under: Math.min(a.y, b.y) - r, over: Math.max(a.y, b.y) + r } }); pipe(o, a, b, r, mat); return o; };
    // ---- skate corner (south-east): ledges, a manual pad, kickers with a gap, a flat rail, stairs up to a platform
    for (const [cx, cz, L, ry, n] of [[7.5, 18.2, 2.6, Math.PI / 2, v3(0, 0, -1)], [11.9, 15.0, 2.2, 0, v3(1, 0, 0)]]) { const o = O('Concrete Ledge', 'wall', { wallNormal: n }); box(o, v3(cx, 0.28, cz), v3(0.14, 0.28, L), 'concrete', ry); stripe(o, v3(cx, 0.565, cz), v3(0.14, 0.006, L), ry); }
    { const o = O('Manual Pad', 'deco'); box(o, v3(9.4, 0.14, 15.6), v3(1.6, 0.14, 0.8), 'concrete'); stripe(o, v3(9.4, 0.284, 14.82), v3(1.6, 0.005, 0.03)); stripe(o, v3(9.4, 0.284, 16.38), v3(1.6, 0.005, 0.03)); }
    { const o = O('Kicker Gap', 'deco'), A = Math.atan2(0.55, 1.5), L = Math.hypot(0.55, 1.5) / 2;
      box(o, v3(5.6, 0.27, 12.6), v3(L, 0.025, 0.7), 'wood', 0, 0, A); box(o, v3(9.4, 0.27, 12.6), v3(L, 0.025, 0.7), 'wood', 0, 0, -A);   // facing each other, 2.3 m of air between the lips
      for (const [x, s] of [[6.33, 1], [8.67, -1]]) { box(o, v3(x, 0.27, 12.6), v3(0.02, 0.27, 0.7), 'wood'); stripe(o, v3(x - s * 0.03, 0.548, 12.6), v3(0.03, 0.006, 0.7)); } }
    { const o = bar('Flat Rail', v3(11.2, 0.5, 17.6), v3(15.2, 0.5, 17.6), 0.03, 'galv'); for (const x of [11.4, 13.2, 15.0]) box(o, v3(x, 0.235, 17.6), v3(0.03, 0.235, 0.03), 'galv'); }
    { const o = O('Stair Platform', 'deco'); box(o, v3(15.6, 0.5, 11.4), v3(1.4, 0.5, 1.5), 'concrete');
      for (let i = 0; i < 4; i++) box(o, v3(13.95 - i * 0.3, 0.1 + (3 - i) * 0.1, 11.4), v3(0.15, 0.1 + (3 - i) * 0.1, 1.5), 'concrete');
      for (let i = 0; i < 4; i++) stripe(o, v3(13.82 - i * 0.3, 0.205 + (3 - i) * 0.2, 11.4), v3(0.02, 0.005, 1.5));
      stripe(o, v3(14.22, 1.005, 11.4), v3(0.03, 0.005, 1.5));
      const r = bar('Stair Handrail', v3(12.9, 0.95, 12.8), v3(14.2, 1.75, 12.8), 0.025, 'paintRed'); box(r, v3(12.9, 0.5, 12.8), v3(0.025, 0.45, 0.025), 'paintRed'); box(r, v3(14.2, 1.375, 12.8), v3(0.025, 0.375, 0.025), 'paintRed'); }
    // a plywood trick wall with a window and a doorway to thread
    { const o = O('Plywood Wall', 'wall', { wallNormal: v3(-1, 0, 0) }), x = 4.6, T = 0.03;
      for (const [z0, z1, y0, y1] of [[14.0, 14.6, 0, 2.4], [15.5, 16.2, 0, 2.4], [14.6, 15.5, 1.7, 2.4], [16.2, 16.9, 0, 1.0], [16.2, 16.9, 1.6, 2.4], [16.9, 17.4, 0, 2.4]]) box(o, v3(x, (y0 + y1) / 2, (z0 + z1) / 2), v3(T, (y1 - y0) / 2, (z1 - z0) / 2), 'wood');
      for (const z of [14.0, 17.4]) box(o, v3(x + 0.35, 0.6, z), v3(0.35, 0.03, 0.03), 'wood', 0, 0, 0.9);
      stripe(o, v3(x - T - 0.004, 1.7, 15.05), v3(0.004, 0.03, 0.45)); stripe(o, v3(x - T - 0.004, 1.0, 16.55), v3(0.004, 0.03, 0.35)); stripe(o, v3(x - T - 0.004, 1.6, 16.55), v3(0.004, 0.03, 0.35));
      O('Plywood Doorway', 'gap', { gap: { c: v3(x, 0.85, 15.05), n: v3(1, 0, 0), hu: 0.45, hv: 0.85, u: v3(0, 0, 1) } }); O('Plywood Window', 'gap', { gap: { c: v3(x, 1.3, 16.55), n: v3(1, 0, 0), hu: 0.35, hv: 0.3, u: v3(0, 0, 1) } }); }
    // ---- scaffold tower (west): three plank decks to go over, under and between, on a cluster of standards
    { const X0 = -15.4, X1 = -12.2, Z0 = 0.6, Z1 = 4.6, sc = O('Scaffold', 'pole');
      for (const x of [X0, (X0 + X1) / 2, X1]) for (const z of [Z0, Z1]) pipe(sc, v3(x, 0, z), v3(x, 5.6, z), 0.03, 'galv');
      for (const y of [1.4, 3.1, 4.8]) { for (const z of [Z0, Z1]) pipe(sc, v3(X0, y - 0.06, z), v3(X1, y - 0.06, z), 0.022, 'galv', { noCollide: true }); for (const x of [X0, X1]) pipe(sc, v3(x, y - 0.06, Z0), v3(x, y - 0.06, Z1), 0.022, 'galv', { noCollide: true }); }
      pipe(sc, v3(X0, 0.1, Z0), v3(X0, 3.0, Z1), 0.02, 'galv', { noCollide: true }); pipe(sc, v3(X1, 1.5, Z1), v3(X1, 4.7, Z0), 0.02, 'galv', { noCollide: true });   // braces
      // decks: the low one spans the bay, the middle one leaves a gap at one end, the top one is two planks with a slot between
      for (const [y, z0, z1, x0, x1] of [[1.4, Z0, Z1, X0, X1], [3.1, Z0 + 1.3, Z1, X0, X1], [4.8, Z0, Z1, X0, X0 + 1.2], [4.8, Z0, Z1, X1 - 1.2, X1]]) {
        const o = O('Scaffold Deck', 'overunder', { obstacle: { a: v3((x0 + x1) / 2, 0, z0), b: v3((x0 + x1) / 2, 0, z1), under: y - 0.03, over: y + 0.03 } }); box(o, v3((x0 + x1) / 2, y, (z0 + z1) / 2), v3((x1 - x0) / 2, 0.025, (z1 - z0) / 2), 'wood'); for (const x of [x0, x1]) stripe(o, v3(x, y + 0.027, (z0 + z1) / 2), v3(0.025, 0.003, (z1 - z0) / 2)); }
      for (let i = 1; i <= 16; i++) pipe(sc, v3(X1 + 0.05, i * 0.3, Z0 - 0.02), v3(X1 + 0.05, i * 0.3, Z0 + 0.38), 0.012, 'galv', { noCollide: true });     // ladder rungs
    }
    // a plywood tunnel on the ground beside it
    { const o = O('Plywood Tunnel', 'overunder'), x0 = -10.6, x1 = -7.6, z = 7.4, hw = 0.5, hh = 0.9;
      for (const s of [-1, 1]) box(o, v3((x0 + x1) / 2, hh / 2, z + s * hw), v3((x1 - x0) / 2, hh / 2, 0.02), 'wood'); box(o, v3((x0 + x1) / 2, hh + 0.02, z), v3((x1 - x0) / 2, 0.02, hw + 0.04), 'wood');
      for (const x of [x0, x1]) stripe(o, v3(x, hh + 0.02, z), v3(0.02, 0.022, hw + 0.04));
      o.obstacle = { a: v3(x0, 0, z), b: v3(x1, 0, z), under: hh, over: hh + 0.04 };
      for (const x of [x0, x1]) O('Tunnel Mouth', 'gap', { gap: { c: v3(x, hh / 2, z), n: v3(1, 0, 0), hu: hw, hv: hh / 2, u: v3(0, 0, 1) } }); }
    // ---- bollard run (east): painted steel posts of different heights to weave and figure-8
    { const o = O('Bollard', 'pole'), cols = ['paintRed', 'paintBlue', 'paintGreen', 'paintOrange', 'plasticYellow'];
      [[14.6, -6.4, 1.6], [13.5, -4.4, 2.4], [15.4, -2.6, 1.3], [14.0, 0.6, 2.8], [15.6, 2.4, 1.9], [13.8, 4.2, 1.5]].forEach(([x, z, h], i) => { pipe(o, v3(x, 0, z), v3(x, h, z), 0.07, cols[i % 5]); pipe(o, v3(x, h, z), v3(x, h + 0.02, z), 0.09, 'plasticYellow', { noCollide: true }); }); }
    // ---- sign gantry (south of the cones): two posts and a truss, (its hanging planks were removed at the pilot's request)
    { const o = O('Sign Gantry', 'overunder', { obstacle: { a: v3(-7.2, 0, 7.2), b: v3(-3.2, 0, 7.2), under: 3.05, over: 3.45 } }), z = 7.2;
      for (const x of [-7.2, -3.2]) { pipe(o, v3(x, 0, z), v3(x, 3.4, z), 0.05, 'galv'); box(o, v3(x, 0.03, z), v3(0.18, 0.03, 0.18), 'metalPlate'); }
      pipe(o, v3(-7.2, 3.4, z), v3(-3.2, 3.4, z), 0.04, 'galv'); pipe(o, v3(-7.2, 3.1, z), v3(-3.2, 3.1, z), 0.03, 'galv');
      for (let i = 0; i < 8; i++) pipe(o, v3(-7.2 + i * 0.5, 3.1 + (i % 2) * 0.3, z), v3(-6.7 + i * 0.5, 3.4 - (i % 2) * 0.3, z), 0.012, 'galv', { noCollide: true });
      box(o, v3(-5.2, 2.72, z), v3(1.1, 0.3, 0.015), 'paintOrange', 0, 0, 0, { noCollide: true });
    }   // (the two hanging planks that were here were taken out at the pilot's request)
    // ---- up high: fire-escape landings on the building's east end, and things to play with on the roof
    for (const [y, x0, x1] of [[4.6, 13.7, 15.8], [9.4, 13.7, 15.8]]) { const z = -21.45, o = O('Fire Escape', 'overunder', { obstacle: { a: v3(x0, 0, z), b: v3(x1, 0, z), under: y - 0.03, over: y + 0.03 } });
      box(o, v3((x0 + x1) / 2, y, z), v3((x1 - x0) / 2, 0.025, 0.55), 'metalPlate'); stripe(o, v3((x0 + x1) / 2, y + 0.027, z + 0.53), v3((x1 - x0) / 2, 0.003, 0.02));
      pipe(o, v3(x0, y + 0.9, z + 0.53), v3(x1, y + 0.9, z + 0.53), 0.02, 'rust'); for (const x of [x0, x1]) box(o, v3(x, y + 0.45, z + 0.53), v3(0.02, 0.45, 0.02), 'rust'); }
    { const mast = O('Roof Antenna', 'pole'); pipe(mast, v3(10, 14.8, -27), v3(10, 19.6, -27), 0.035, 'galv'); box(mast, v3(10, 14.86, -27), v3(0.25, 0.06, 0.25), 'metalPlate'); for (const y of [17.2, 18.4]) pipe(mast, v3(9.5, y, -27), v3(10.5, y, -27), 0.012, 'galv', { noCollide: true });
      const tank = O('Water Tank', 'overunder', { obstacle: { a: v3(3.2, 0, -27.5), b: v3(4.8, 0, -27.5), under: 15.75, over: 17.3 } }); box(tank, v3(4, 16.5, -27.5), v3(0.8, 0.75, 0.8), 'rust'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(tank, v3(4 + sx * 0.7, 15.3, -27.5 + sz * 0.7), v3(0.04, 0.48, 0.04), 'galv');
      const r = bar('Roof Pipe Run', v3(-14, 15.3, -24.6), v3(-8.5, 15.3, -24.6), 0.04, 'rust'); for (const x of [-13.8, -11.2, -8.7]) box(r, v3(x, 15.03, -24.6), v3(0.03, 0.23, 0.03), 'galv'); }
    // the slide itself is something to go under and over, separate from its tower (pilot: going under the slide didn't
    // count as its own object). It slopes, so it is tagged in two steps: the high end by the deck, and the middle.
    for (const [x0, x1, un, ov] of [[-7.25, -6.55, 1.0, 1.62], [-6.55, -5.8, 0.62, 1.28]]) O('Slide', 'overunder', { obstacle: { a: v3(x0, 0, 2), b: v3(x1, 0, 2), under: un, over: ov } });
    w.zones.push({ shape: 'zone', mat: 'concrete', c: v3(10.6, 0.011, 15.2), h: v3(6.6, 0, 4.4) });
    // the Trick Park, west of the playground (open ground there: no fence)
    w.zones.push(trickPark(K, -21, 0, -1, { post: 'galv', bar: 'paintRed', pole: 'galv', slab: 'metalPlate', wall: 'concrete', tower: 'brick', accent: 'plasticYellow', glow: false, zone: 'concrete' }).zone);
    w.bounds = { x: [-55, 18], z: [-22, 20] };
    const all = []; for (const o of w.objs) for (const p of o.prims) { p.owner = o.id; all.push(p); } w.prims = all; return w;
  }

  // The park's makers (trees, picnic tables, houses, pickups): used by buildMoose and by the map editor's asset library.
  // trees / houses collect what was made (buildMoose spaces its groves with them).
  function natureKit(K, rr, rnd, trees = [], houses = []) {
    const { O, box, pipe, ball } = K;
    const conifer = (x, z, h, r, kind) => { const o = O(kind === 'cedar' ? 'Cedar' : 'Hemlock', r <= 0.25 ? 'pole' : 'tree'), base = h * (kind === 'cedar' ? rr(0.16, 0.26) : rr(0.22, 0.32)), R = Math.min(3.2, h * 0.13 + r * 1.2);
      pipe(o, v3(x, 0, z), v3(x, h * 0.55, z), r, 'cedarBark'); pipe(o, v3(x, h * 0.55, z), v3(x, h * 0.92, z), r * 0.6, 'cedarBark', { noCollide: true });
      pipe(o, v3(x, 0, z), v3(x, 0.5 + r, z), r * 1.7, 'cedarBark', { cone: true, noCollide: true });   // the flare at the foot
      const leaf = kind === 'cedar' ? 'cedarLeaf' : 'hemlockLeaf', n = 3;
      for (let i = 0; i < n; i++) { const y0 = base + (h - base) * i / n * 0.85, y1 = Math.min(h, y0 + (h - base) * 0.55); pipe(o, v3(x, y0, z), v3(x, y1, z), R * (1 - i * 0.26), leaf, { cone: true, noCollide: true }); }
      o.prims.push(S.makeCapsule(v3(x, base + 0.8, z), v3(x, h * 0.85, z), R * 0.32));
      o.round = { c: v3(x, 0, z), r: R, under: base, over: h }; o.obstacle = { a: v3(x - R, 0, z), b: v3(x + R, 0, z), under: base, over: h };
      trees.push({ x, z, r: Math.max(R * 0.5, 1.2) }); return o; };
    const birch = (x, z, h) => { const o = O('Birch', 'pole'), lx = rr(-0.6, 0.6), lz = rr(-0.6, 0.6);
      pipe(o, v3(x, 0, z), v3(x + lx, h, z + lz), 0.11, 'birchBark');
      for (let i = 0; i < 4; i++) ball(o, v3(x + lx * 0.8 + rr(-1, 1), h * rr(0.62, 0.95), z + lz * 0.8 + rr(-1, 1)), rr(0.9, 1.4), 'birchLeaf', { noCollide: true });
      trees.push({ x, z, r: 1.4 }); return o; };
    const shade = (x, z, h) => { const o = O('Maple', 'tree'), base = h * 0.32, R = h * 0.28;
      pipe(o, v3(x, 0, z), v3(x, base + 1, z), 0.28, 'bark'); pipe(o, v3(x, base, z), v3(x + 1.2, base + 2, z + 0.5), 0.14, 'bark', { noCollide: true }); pipe(o, v3(x, base, z), v3(x - 1, base + 2.2, z - 0.6), 0.14, 'bark', { noCollide: true });
      for (const [a, b, c, s] of [[0, 0.75, 0, 1], [0.9, 0.62, 0.5, 0.75], [-0.9, 0.6, -0.4, 0.8], [0.2, 0.55, -1, 0.7]]) ball(o, v3(x + a * R, h * b, z + c * R), R * 0.62 * s, 'mapleLeaf', { noCollide: true });
      o.prims.push(S.makeSphere(v3(x, h * 0.68, z), R * 0.45));
      o.round = { c: v3(x, 0, z), r: R, under: base + 0.6, over: h }; o.obstacle = { a: v3(x - R, 0, z), b: v3(x + R, 0, z), under: base + 0.6, over: h };
      trees.push({ x, z, r: R * 0.6 }); return o; };
    const picnic = (x, z, ry) => { const o = O('Picnic Table', 'deco'), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, y, z - u * s + w * c);
      box(o, P(0, 0.76, 0), v3(0.9, 0.035, 0.38), 'oldWood', ry); for (const w of [-0.68, 0.68]) box(o, P(0, 0.45, w), v3(0.9, 0.03, 0.15), 'oldWood', ry);
      for (const u of [-0.65, 0.65]) for (const w of [-0.6, 0.6]) pipe(o, P(u, 0, w), P(u, 0.74, w * 0.3), 0.025, 'darkMetal'); };
    const house = (x, z, W, D, ry, col) => { const o = O('House', 'building', { tall: 6 }), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, y, z - u * s + w * c), H = 2.9;
      box(o, P(0, H / 2, 0), v3(W / 2, H / 2, D / 2), col, ry); const sq = D / 2 / Math.SQRT2; box(o, P(0, H, 0), v3(W / 2, sq, sq), col, ry, Math.PI / 4);   // the gable fill
      const e = D / 2 + 0.5, dl = Math.hypot(e, e) / 2; for (const sgn of [-1, 1]) box(o, P(0, H + D / 2 - e / 2 + 0.05, sgn * e / 2), v3(W / 2 + 0.35, 0.07, dl), 'roofDark', ry, sgn * Math.PI / 4);
      box(o, P(W * 0.25, H + D / 2 - 0.4, -0.6), v3(0.3, 0.9, 0.3), 'brick', ry);   // chimney
      for (const w of [-1, 1]) for (const u of [-W / 4, W / 4]) box(o, P(u, 1.6, w * (D / 2 + 0.02)), v3(0.6, 0.55, 0.02), 'glass', ry, 0, 0, { noCollide: true });
      box(o, P(-W / 2 + 1.2, 1.05, -(D / 2 + 0.03)), v3(0.45, 1.05, 0.03), 'oldWood', ry, 0, 0, { noCollide: true });
      box(o, P(-W / 2 + 1.2, 0.15, -(D / 2 + 0.9)), v3(1, 0.15, 0.8), 'oldWood', ry);   // a small deck at the door
      houses.push(o); };
    const truck = (x, z, ry, col) => { const o = O('Pickup', 'deco'), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, y, z - u * s + w * c);
      box(o, P(1.0, 0.95, 0), v3(1.0, 0.45, 0.95), col, ry); box(o, P(1.0, 1.55, 0), v3(0.85, 0.32, 0.9), col, ry); box(o, P(1.0, 1.58, 0), v3(0.86, 0.22, 0.91), 'glass', ry, 0, 0, { noCollide: true });
      box(o, P(-1.4, 0.95, 0), v3(1.4, 0.45, 0.95), col, ry); for (const u of [1.5, -1.6]) for (const w of [-0.95, 0.95]) pipe(o, P(u, 0.38, w - 0.12), P(u, 0.38, w + 0.12), 0.38, 'rubberBlack'); };
    return { conifer, birch, shade, picnic, house, truck };
  }

  // =============================================================== Moose Knuckle Park
  // After the real Moose Park (1625 Arrow Dr, Arrow Heights, Revelstoke BC) from the pilot's photos and the satellite
  // view: a modest municipal neighbourhood park at the corner of Arrow Dr (north) and Park Dr (west). Groves of tall,
  // fairly slim western redcedar and hemlock with a needle-duff floor; two open grassy lanes running east-north-east
  // through them with a few big trees standing in the grass; the playground at the west end (a weathered A-frame swing
  // set, a small tan multi-play unit with a faded blue slide, a timber border round wood chips, a picnic table beside a
  // big cedar); a half-buried tractor-tire tunnel among birch and rusty bracken at the east end; modest steep-roofed
  // houses, fences and parked trucks round the edges; forested ridges and Mt Begbie beyond (worldview, theme 'pnw').
  // Scale from the pilot's photo: 1.68 m next to a cedar about 1.1 m across at the base. x east, z south.
  function buildMoose() {
    const K = kit(), { O, box, pipe, ball, together } = K, { bar, frame } = parts(K), zones = [];
    let seed = 1625; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, rr = (a, b) => a + (b - a) * rnd();
    const PX = 46, PZ = 24;   // the park: x -46..46, z -24..24
    // ---- ground: the park's needle-covered floor, the two grass lanes (rotated), worn dirt paths, the streets, driveways
    zones.push({ shape: 'zone', mat: 'duff', c: v3(0, 0.004, 0), h: v3(PX, 0, PZ) });
    const lanes = [{ c: v3(-2, 0.005, -11), len: 47, w: 6.5, ry: 0.16 }, { c: v3(-4, 0.005, 9), len: 46, w: 8, ry: 0.21 }];
    for (const L of lanes) zones.push({ shape: 'zone', mat: 'grass', c: L.c, h: v3(L.len, 0, L.w), ry: L.ry });
    zones.push({ shape: 'zone', mat: 'grass', c: v3(-36, 0.005, 0), h: v3(9, 0, 12) });                       // open ground round the playground
    zones.push({ shape: 'zone', mat: 'path', c: v3(-4, 0.006, 6.5), h: v3(40, 0, 0.6), ry: 0.2 });           // the worn trail along the south lane
    zones.push({ shape: 'zone', mat: 'path', c: v3(10, 0.006, -9), h: v3(26, 0, 0.5), ry: 0.12 });
    zones.push({ shape: 'zone', mat: 'woodchip', c: v3(-35, 0.007, 1), h: v3(8, 0, 5.5) });
    zones.push({ shape: 'zone', mat: 'asphalt', c: v3(0, 0.003, -30), h: v3(90, 0, 4) });                     // Arrow Dr
    zones.push({ shape: 'zone', mat: 'asphalt', c: v3(-52, 0.003, 0), h: v3(4, 0, 70) });                     // Park Dr
    zones.push({ shape: 'zone', mat: 'gravel', c: v3(0, 0.0035, -25.4), h: v3(46, 0, 0.6) }); zones.push({ shape: 'zone', mat: 'gravel', c: v3(-47.4, 0.0035, 0), h: v3(0.6, 0, 24) });   // gravel shoulders
    const inLane = (x, z, pad = 0) => lanes.some(L => { const dx = x - L.c.x, dz = z - L.c.z, c = Math.cos(L.ry), s = Math.sin(L.ry), u = dx * c - dz * s, w = dx * s + dz * c; return Math.abs(u) < L.len + pad && Math.abs(w) < L.w + pad; });
    // ---- trees. Conifers: a flared trunk bare for the first few metres, then stacked drooping cones. Over/under under the
    // lowest boughs; slim trunks are poles to orbit. Flying into the middle of a crown hits it; brushing its edge does not.
    const trees = [], houses = [], { conifer, birch, shade, picnic, house, truck } = natureKit(K, rr, rnd, trees, houses);
    const clear = (x, z, d) => trees.every(t => Math.hypot(t.x - x, t.z - z) > d + t.r);
    const keepOut = [[-35, 1, 10.5], [-24, 8, 3.5], [36, -12, 4.5], [-41, -19, 4]];   // playground, the spawn, the tire tunnel, the sign
    const free = (x, z) => keepOut.every(([a, b, r]) => Math.hypot(x - a, z - b) > r);
    // the pilot's big cedar beside the playground, and a few big ones standing in the lanes (as in the photos)
    conifer(-30.5, -3.2, 27, 0.55, 'cedar');
    for (const [x, z] of [[-14, -13], [6, -16], [22, -14.5], [-18, 10.5], [2, 6], [14, 3], [28, -3]]) conifer(x, z, rr(20, 28), rr(0.2, 0.42), rnd() < 0.6 ? 'cedar' : 'hemlock');
    // the groves: dense, but with room to fly between trunks
    for (let k = 0; k < 2400 && trees.length < 150; k++) { const x = rr(-PX + 1.5, PX - 1.5), z = rr(-PZ + 1.5, PZ - 1.5); if (inLane(x, z, -0.5) || !free(x, z)) continue;
      if (!clear(x, z, 2.3)) continue; const u = rnd(); if (x > 26 && u < 0.3) birch(x, z, rr(9, 14)); else if (u < 0.06) shade(x, z, rr(9, 13)); else conifer(x, z, rr(17, 30), rr(0.16, 0.36), u < 0.62 ? 'cedar' : 'hemlock'); }
    // two trunks close enough to thread (the Tricktionary's "gap between two tree trunks")
    for (const [x, z, gw] of [[-6, -20, 1.0], [18, 18.5, 1.3]]) together(() => { conifer(x - gw / 2 - 0.22, z, 24, 0.22, 'cedar'); conifer(x + gw / 2 + 0.22, z, 22, 0.22, 'hemlock');
      O('Trunk Gap', 'gap', { gap: { c: v3(x, 1.4, z), n: v3(0, 0, 1), hu: gw / 2, hv: 1.4, u: v3(1, 0, 0) } }); });
    // understory: low shrubs, rusty bracken in the east, mossy logs and a few stumps
    { for (let k = 0; k < 70; k++) { const x = rr(-PX + 1, PX - 1), z = rr(-PZ + 1, PZ - 1); if (inLane(x, z, 1) || !free(x, z)) continue; const sh = O(x > 24 ? 'Bracken' : 'Shrub', 'deco'); ball(sh, v3(x, 0.25, z), rr(0.35, 0.7), x > 24 ? 'bracken' : 'shrub', { noCollide: true }); } }
    { for (const [x, z, a, l] of [[-8, 18, 0.4, 3.2], [12, -21, 1.2, 2.6], [32, 14, 2.4, 4]]) pipe(O('Mossy Log', 'deco'), v3(x, 0.22, z), v3(x + Math.cos(a) * l, 0.2, z + Math.sin(a) * l), 0.22, 'mossLog'); }
    { for (const [x, z, r] of [[-20, 4.5, 0.4], [9, -5, 0.35], [-2, 12.5, 0.45], [24, 2.5, 0.3]]) pipe(O('Stump', 'deco'), v3(x, 0, z), v3(x, 0.35, z), r, 'cedarBark'); }
    // ---- the playground (west end): a timber border round wood chips
    { const b = O('Playground Border', 'deco'); for (const [c, h] of [[v3(-35, 0.08, -4.5), v3(8, 0.08, 0.1)], [v3(-35, 0.08, 6.5), v3(8, 0.08, 0.1)], [v3(-43, 0.08, 1), v3(0.1, 0.08, 5.5)], [v3(-27, 0.08, 1), v3(0.1, 0.08, 5.5)]]) box(b, c, h, 'oldWood'); }
    // the A-frame swing set: faded blue legs, a 2.4 m top bar along x, two belt swings on chains
    together(() => { const x0 = -40, x1 = -35.6, z = -1.2, H = 2.4, sw = bar('Swing Set', v3(x0, H, z), v3(x1, H, z), 0.045, 'fadedBlue');
      for (const x of [x0, x1]) for (const s of [-1, 1]) pipe(sw, v3(x, H, z), v3(x + (x === x0 ? -0.35 : 0.35), 0, z + s * 1.25), 0.04, 'fadedBlue');
      for (const x of [x0 + 1.2, x1 - 1.2]) { for (const s of [-0.22, 0.22]) pipe(sw, v3(x + s, H, z), v3(x + s, 0.5, z), 0.008, 'chain', { noCollide: true }); box(sw, v3(x, 0.47, z), v3(0.26, 0.03, 0.1), 'rubberBlack', 0, 0, 0, { noCollide: true }); }
      O('Swing Set opening', 'gap', { gap: { c: v3((x0 + x1) / 2, H / 2, z), n: v3(0, 0, 1), hu: (x1 - x0) / 2 - 0.1, hv: H / 2 - 0.05, u: v3(1, 0, 0) } }); });
    // the small multi-play unit: tan posts, a deck 1.2 m up under a faded red roof, steps on the west, a faded blue slide
    // east, and a short run of climbing bars on the north side
    together(() => { const cx = -31.6, cz = 3.4, D = 1.2, o = O('Play Unit', 'deco');
      for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(o, v3(cx + a, 1.3, cz + b), v3(0.055, 1.3, 0.055), 'playTan');
      box(o, v3(cx, D, cz), v3(0.8, 0.04, 0.8), 'playTan');
      O('Under the Play Unit', 'gap', { gap: { c: v3(cx, D / 2, cz), n: v3(1, 0, 0), hu: 0.72, hv: D / 2 - 0.05, u: v3(0, 0, 1) } }); O('Under the Play Unit', 'gap', { gap: { c: v3(cx, D / 2, cz), n: v3(0, 0, 1), hu: 0.72, hv: D / 2 - 0.05, u: v3(1, 0, 0) } });
      const roof = O('Play Unit Roof', 'overunder', { obstacle: { a: v3(cx - 0.95, 0, cz), b: v3(cx + 0.95, 0, cz), under: 2.5, over: 2.75 } });
      box(roof, v3(cx, 2.62, cz - 0.42), v3(0.95, 0.03, 0.5), 'fadedRed', 0, 0.35); box(roof, v3(cx, 2.62, cz + 0.42), v3(0.95, 0.03, 0.5), 'fadedRed', 0, -0.35);
      for (const s of [-1, 1]) box(o, v3(cx + s * 0.8, D + 0.45, cz), v3(0.03, 0.4, 0.75), 'fadedRed');   // side panels
      for (let i = 0; i < 4; i++) box(o, v3(cx - 1.0 - i * 0.28, D - (i + 1) * 0.28 + 0.1, cz + 0.3), v3(0.14, 0.03, 0.42), 'playTan');   // steps down to the west
      const ang = 0.55, L = D / Math.sin(ang), sl = O('Slide', 'deco');
      box(sl, v3(cx + 0.8 + Math.cos(ang) * L / 2, D / 2 + 0.04, cz + 0.3), v3(L / 2, 0.03, 0.26), 'fadedBlue', 0, 0, -ang);
      for (const s of [-1, 1]) box(sl, v3(cx + 0.8 + Math.cos(ang) * L / 2, D / 2 + 0.16, cz + 0.3 + s * 0.27), v3(L / 2, 0.1, 0.02), 'fadedBlue', 0, 0, -ang);
      bar('Climbing Bars', v3(cx - 0.8, 1.9, cz - 0.95), v3(cx - 0.8, 1.9, cz - 2.6), 0.03, 'fadedBlue'); bar('Climbing Bars', v3(cx + 0.8, 1.9, cz - 0.95), v3(cx + 0.8, 1.9, cz - 2.6), 0.03, 'fadedBlue');
      const cb = O('Climbing Bars', 'deco'); for (const s of [-0.8, 0.8]) pipe(cb, v3(cx + s, 0, cz - 2.6), v3(cx + s, 1.9, cz - 2.6), 0.035, 'fadedBlue'); for (let i = 1; i < 6; i++) pipe(cb, v3(cx - 0.8, 1.9, cz - 0.95 - i * 0.28), v3(cx + 0.8, 1.9, cz - 0.95 - i * 0.28), 0.018, 'galv'); });
    // ---- picnic tables (wood on a dark metal frame), benches, bear-resistant bins, the park sign and a carved moose
    picnic(-29.2, -0.6, 0.1); picnic(-21, 5.5, 0.3); picnic(-9, -9, -0.2); picnic(12, 3.5, 0.15); picnic(26, -12.5, 0.4);
    for (const [x, z, ry] of [[-38.5, 6, 0], [-27.5, 6.2, 0.2], [4, -10.4, 0.15]]) { const b = O('Bench', 'deco'), c = Math.cos(ry), s = Math.sin(ry);
      box(b, v3(x, 0.44, z), v3(0.9, 0.03, 0.2), 'oldWood', ry); box(b, v3(x - s * 0.18, 0.75, z - c * 0.18), v3(0.9, 0.12, 0.025), 'oldWood', ry); for (const u of [-0.7, 0.7]) box(b, v3(x + u * c, 0.22, z - u * s), v3(0.03, 0.22, 0.2), 'darkMetal', ry); }
    for (const [x, z] of [[-27.2, -3.8], [-42.5, 6.4], [30.5, -9.5], [0, -23]]) { const b = O('Bear Bin', 'deco'); box(b, v3(x, 0.55, z), v3(0.42, 0.55, 0.38), 'binGreen'); box(b, v3(x, 1.13, z), v3(0.44, 0.04, 0.4), 'darkMetal'); }
    { const sg = O('Park Sign', 'deco'), x = -41, z = -21.5; for (const s of [-1, 1]) pipe(sg, v3(x + s * 1.1, 0, z), v3(x + s * 1.1, 1.5, z), 0.09, 'oldWood');
      box(sg, v3(x, 1.15, z), v3(1.35, 0.32, 0.05), 'mooseSign', 0, 0, 0, { sign: true }); box(sg, v3(x, 1.52, z), v3(1.5, 0.05, 0.14), 'oldWood'); }
    { const m = O('Carved Moose', 'deco'), x = -38.2, z = -20.6;   // a chainsaw-carved cedar moose by the sign
      box(m, v3(x, 1.25, z), v3(0.8, 0.38, 0.32), 'carvedCedar'); for (const [a, b] of [[-0.6, -0.2], [-0.6, 0.2], [0.55, -0.2], [0.55, 0.2]]) pipe(m, v3(x + a, 0, z + b), v3(x + a, 0.95, z + b), 0.08, 'carvedCedar');
      pipe(m, v3(x + 0.7, 1.4, z), v3(x + 1.05, 1.75, z), 0.15, 'carvedCedar'); box(m, v3(x + 1.25, 1.65, z), v3(0.3, 0.13, 0.12), 'carvedCedar', 0, 0, -0.3);
      for (const s of [-1, 1]) box(m, v3(x + 1.0, 2.05, z + s * 0.38), v3(0.18, 0.04, 0.3), 'carvedCedar', s * 0.3, s * 0.5); }
    // ---- the tire tunnel (east): four tractor tires half buried in a row among birch and bracken, a small sign post
    together(() => { const x0 = 34.5, z = -12, R = 0.82, t = 0.24, o = O('Tire Tunnel', 'overunder', { obstacle: { a: v3(x0, 0, z - R), b: v3(x0 + 3, 0, z - R), under: R - t, over: R + t } });
      for (let i = 0; i < 4; i++) { const x = x0 + i * 0.95 + (i === 2 ? 0.15 : 0); const N = 11, Rm = R - t / 2; for (let k = 0; k < N; k++) { const am = (k + 0.5) / N * Math.PI;   // a wide tread band, buried below the ground at both ends
          box(o, v3(x, Math.sin(am) * Rm - 0.12, z + Math.cos(am) * Rm), v3(0.27, Math.PI * Rm / N / 2 + 0.02, t / 2), 'tireTread', 0, -am); } }
      O('Tire Tunnel opening', 'gap', { gap: { c: v3(x0 + 1.45, 0.3, z), n: v3(1, 0, 0), hu: R - t - 0.05, hv: 0.3, u: v3(0, 0, 1) } });
      const sp = O('Sign Post', 'pole'); pipe(sp, v3(x0 + 2.5, 0, z - 1.6), v3(x0 + 2.5, 1.6, z - 1.6), 0.04, 'galv'); box(sp, v3(x0 + 2.5, 1.55, z - 1.6), v3(0.16, 0.16, 0.01), 'signWhite', 0, 0, 0, { noCollide: true }); });
    // ---- round the edges: Arrow Dr and Park Dr with houses across them, back fences and houses east and south, wooden
    // power poles, a few parked pickups
    const colors = ['houseSage', 'houseTan', 'houseBlue', 'houseCream', 'houseRed'];
    for (let x = -66; x <= 66; x += 17) house(x + rr(-2, 2), -42, rr(9, 12), rr(7.5, 9), Math.PI, colors[(rnd() * 5) | 0]);            // across Arrow Dr, facing the park
    for (let z = -16; z <= 42; z += 16) house(-63, z + rr(-2, 2), rr(9, 11), rr(7.5, 9), -Math.PI / 2, colors[(rnd() * 5) | 0]);       // across Park Dr
    for (let z = -16; z <= 18; z += 15) house(60, z, rr(9, 11), rr(8, 9), Math.PI / 2, colors[(rnd() * 5) | 0]);                        // east, backing onto the park
    for (let x = -30; x <= 40; x += 16) house(x, 37, rr(9, 12), rr(8, 9), 0, colors[(rnd() * 5) | 0]);                                   // south
    { const f = O('Back Fence', 'deco'); box(f, v3(PX + 2, 0.9, 0), v3(0.03, 0.9, PZ), 'fenceWood'); box(f, v3(4, 0.9, PZ + 2.5), v3(PX - 2, 0.9, 0.03), 'fenceWood');
      for (let z = -PZ; z <= PZ; z += 2.4) pipe(f, v3(PX + 2.05, 0, z), v3(PX + 2.05, 1.85, z), 0.05, 'fenceWood'); for (let x = -PX + 6; x <= PX + 2; x += 2.4) pipe(f, v3(x, 0, PZ + 2.55), v3(x, 1.85, PZ + 2.55), 0.05, 'fenceWood'); }
    for (let x = -40; x <= 44; x += 28) { const p = O('Power Pole', 'pole'); pipe(p, v3(x, 0, -26.8), v3(x, 9, -26.8), 0.14, 'polewood'); box(p, v3(x, 8.4, -26.8), v3(1.1, 0.06, 0.06), 'polewood'); }
    { const w = O('Power Lines', 'deco'); for (const dx of [-0.9, 0, 0.9]) pipe(w, v3(-62 + dx, 8.45, -26.8), v3(62 + dx, 8.45, -26.8), 0.012, 'chain', { noCollide: true }); }
    truck(-50.5, -14, Math.PI / 2, 'truckRed'); truck(-6, -31.8, 0, 'truckGrey'); truck(28, -28.2, Math.PI, 'truckBlue'); truck(-58, 22, Math.PI / 2, 'truckGrey');
    return K.done({ id: 'moose', title: 'Moose Knuckle Park', theme: 'pnw', zones, spawn: { pos: v3(-24, 0.03, 8), yaw: -1.4 }, bounds: { x: [-75, 75], z: [-55, 50] } });
  }

  // =============================================================== Map editing (the in-game Map Editor, src/mapedit.js)
  // An edit layer over a generated map: { format: 'pro-whooper-mapedit/1', map, moved: { key: { dx, dy, dz, ry, s } },
  // removed: [key], added: [{ asset, x, y, z, ry, s }] }. ry in degrees about the vertical, s a uniform scale. A key names
  // an editable piece by its name and where it stood ("Cedar@12.3,-4.1"), so a layer still finds its pieces when the map
  // code changes their ids. Moving a piece moves its colliders, its look and every tag the detector reads (over/under
  // line and heights, round crowns, gaps, poles, lights, wall normals); the Surveyor runs afterwards, as on any map.
  // A piece is an object with everything made together with it (kit together()), and any shape-less gap or tag object
  // right after it (a frame's opening). Map edges and the Surveyor's own virtual objects are never pieces.
  const editable = o => o && o.kind !== 'edge' && !o.auto && !o.removed;
  function mapPieces(w) {
    const out = [], byGrp = new Map(); let last = null;
    for (const o of w.objs) { if (!editable(o)) continue;
      if (o.grp != null) { let p = byGrp.get(o.grp); if (!p) { byGrp.set(o.grp, p = { ids: [], name: o.name }); out.push(p); } p.ids.push(o.id); last = p; continue; }
      const shapeless = !o.prims.length && !o.vis.length; if (shapeless && last && !o.added) { last.ids.push(o.id); continue; }
      last = { ids: [o.id], name: o.name }; out.push(last); }
    for (const p of out) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const id of p.ids) { const o = w.objs[id]; for (const q of o.prims) { const a = q.aabb; x0 = Math.min(x0, a.min.x); x1 = Math.max(x1, a.max.x); z0 = Math.min(z0, a.min.z); z1 = Math.max(z1, a.max.z); y0 = Math.min(y0, a.min.y); y1 = Math.max(y1, a.max.y); }
        for (const v of o.vis) { const c = v.c || (v.a && v.b ? { x: (v.a.x + v.b.x) / 2, y: Math.min(v.a.y, v.b.y), z: (v.a.z + v.b.z) / 2 } : null); if (!c) continue; x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); y0 = Math.min(y0, c.y); y1 = Math.max(y1, c.y); } }
      if (!Number.isFinite(x0)) { const o = w.objs[p.ids[0]], c = o.gap ? o.gap.c : o.obstacle ? o.obstacle.a : o.round ? o.round.c : null; if (!c) continue; x0 = x1 = c.x; z0 = z1 = c.z; y0 = y1 = c.y || 0; }
      p.pivot = v3((x0 + x1) / 2, Math.max(0, y0), (z0 + z1) / 2); p.size = v3(x1 - x0, y1 - y0, z1 - z0); p.key = w.objs[p.ids[0]].editKey || p.name + '@' + p.pivot.x.toFixed(1) + ',' + p.pivot.z.toFixed(1); const o0 = w.objs[p.ids[0]]; if (o0.addIdx != null) p.addIdx = o0.addIdx; }
    return out.filter(p => p.pivot);
  }
  // move one object: T(p) = pivot + Ry(ry) · s · (p - pivot) + d
  function moveObject(o, pv, d, ry, s) {
    const c = Math.cos(ry), sn = Math.sin(ry), R = p => ({ x: p.x * c + p.z * sn, y: p.y, z: -p.x * sn + p.z * c });
    const T = p => { const q = R({ x: (p.x - pv.x) * s, y: (p.y - pv.y) * s, z: (p.z - pv.z) * s }); return v3(pv.x + q.x + d.x, pv.y + q.y + d.y, pv.z + q.z + d.z); };
    const Y = y => pv.y + (y - pv.y) * s + d.y, D = v => { const q = R(v); return v3(q.x, q.y, q.z); };
    o.prims = o.prims.map(p => { const n = p.type === 'box' ? makeBox(T(p.c), v3(p.h.x * s, p.h.y * s, p.h.z * s), p.euler[1] + ry, p.euler[0], p.euler[2]) : p.type === 'capsule' ? makeCapsule(T(p.a), T(p.b), p.r * s) : p.type === 'sphere' ? makeSphere(T(p.c), p.r * s) : p; n.owner = o.id; return n; });
    o.vis = o.vis.map(v => { const n = { ...v }; if (v.c) n.c = T(v.c); if (v.a) n.a = T(v.a); if (v.b) n.b = T(v.b); if (v.h) n.h = v3(v.h.x * s, v.h.y * s, v.h.z * s); if (v.r != null) n.r = v.r * s; if (v.th != null) n.th = v.th * s; if (v.euler) n.euler = [v.euler[0], v.euler[1] + ry, v.euler[2]]; return n; });
    if (o.obstacle) o.obstacle = { ...o.obstacle, a: T(o.obstacle.a), b: T(o.obstacle.b), under: Y(o.obstacle.under), over: Y(o.obstacle.over) };
    if (o.round) { const r = { ...o.round, c: T(o.round.c), r: o.round.r * s, under: Y(o.round.under), over: Y(o.round.over) }; delete r.box; o.round = r; }
    if (o.gap) o.gap = { ...o.gap, c: T(o.gap.c), n: D(o.gap.n), u: o.gap.u ? D(o.gap.u) : o.gap.u, hu: o.gap.hu * s, hv: o.gap.hv * s };
    if (o.light) o.light = T(o.light); if (o.wallNormal) o.wallNormal = D(o.wallNormal); if (o.tall) o.tall *= s;
  }
  // The asset library: what the editor can place. Each is built at the origin, standing on the ground, facing -z.
  const ASSETS = {
    'Cedar': (K, N) => N.conifer(0, 0, 24, 0.3, 'cedar'), 'Big Cedar': (K, N) => N.conifer(0, 0, 27, 0.55, 'cedar'), 'Young Cedar': (K, N) => N.conifer(0, 0, 11, 0.16, 'cedar'),
    'Hemlock': (K, N) => N.conifer(0, 0, 22, 0.24, 'hemlock'), 'Birch': (K, N) => N.birch(0, 0, 12), 'Maple': (K, N) => N.shade(0, 0, 11),
    'Sakura Tree': K => { const tr = K.O('Sakura Tree', 'pole'); tr.round = { c: v3(0, 0, 0), r: 1.8, under: 2.2, over: 5.0 }; tr.obstacle = { a: v3(-1.8, 0, 0), b: v3(1.8, 0, 0), under: 2.2, over: 5.0 };
      K.pipe(tr, v3(0, 0, 0), v3(0, 2.9, 0), 0.14, 'bark'); K.ball(tr, v3(0, 3.7, 0), 1.4, 'blossom'); K.ball(tr, v3(0.9, 3.2, 0.4), 0.9, 'blossom'); K.ball(tr, v3(-0.8, 3.4, -0.5), 1.0, 'blossom'); },
    'Shrub': K => K.ball(K.O('Shrub', 'deco'), v3(0, 0.25, 0), 0.6, 'shrub', { noCollide: true }), 'Bracken': K => K.ball(K.O('Bracken', 'deco'), v3(0, 0.25, 0), 0.6, 'bracken', { noCollide: true }),
    'Stump': K => K.pipe(K.O('Stump', 'deco'), v3(0, 0, 0), v3(0, 0.35, 0), 0.4, 'cedarBark'), 'Mossy Log': K => K.pipe(K.O('Mossy Log', 'deco'), v3(-1.6, 0.22, 0), v3(1.6, 0.2, 0), 0.22, 'mossLog'),
    'Boulder': K => K.ball(K.O('Boulder', 'deco'), v3(0, 0.25, 0), 0.6, 'concrete'),
    'Picnic Table': (K, N) => N.picnic(0, 0, 0),
    'Bench': K => { const b = K.O('Bench', 'deco'); K.box(b, v3(0, 0.44, 0), v3(0.9, 0.03, 0.2), 'oldWood'); K.box(b, v3(0, 0.75, -0.18), v3(0.9, 0.12, 0.025), 'oldWood'); for (const u of [-0.7, 0.7]) K.box(b, v3(u, 0.22, 0), v3(0.03, 0.22, 0.2), 'darkMetal'); },
    'Bear Bin': K => { const b = K.O('Bear Bin', 'deco'); K.box(b, v3(0, 0.55, 0), v3(0.42, 0.55, 0.38), 'binGreen'); K.box(b, v3(0, 1.13, 0), v3(0.44, 0.04, 0.4), 'darkMetal'); },
    'Swing Set': K => K.together(() => { const P = parts(K), H = 2.4, sw = P.bar('Swing Set', v3(-2.2, H, 0), v3(2.2, H, 0), 0.045, 'fadedBlue');
      for (const x of [-2.2, 2.2]) for (const s of [-1, 1]) K.pipe(sw, v3(x, H, 0), v3(x + (x < 0 ? -0.35 : 0.35), 0, s * 1.25), 0.04, 'fadedBlue');
      for (const x of [-1, 1]) { for (const s of [-0.22, 0.22]) K.pipe(sw, v3(x + s, H, 0), v3(x + s, 0.5, 0), 0.008, 'chain', { noCollide: true }); K.box(sw, v3(x, 0.47, 0), v3(0.26, 0.03, 0.1), 'rubberBlack', 0, 0, 0, { noCollide: true }); }
      K.O('Swing Set opening', 'gap', { gap: { c: v3(0, H / 2, 0), n: v3(0, 0, 1), hu: 2.1, hv: H / 2 - 0.05, u: v3(1, 0, 0) } }); }),
    'Over/Under Bar': K => K.together(() => { const P = parts(K), o = P.bar('Bar', v3(-1.3, 1.6, 0), v3(1.3, 1.6, 0), 0.04, 'paintRed'); for (const x of [-1.3, 1.3]) K.pipe(o, v3(x, 0, 0), v3(x, 1.6, 0), 0.035, 'galv'); }),
    'Gap Gate': K => parts(K).frame('Gap Gate', 0, 0, 1.2, 1.4, 'x', 'paintBlue'),
    'Pole': K => K.pipe(K.O('Pole', 'pole'), v3(0, 0, 0), v3(0, 4, 0), 0.08, 'galv'),
    'Tire': K => K.together(() => { const R = 0.82, t = 0.24, o = K.O('Tire', 'overunder', { obstacle: { a: v3(-0.3, 0, 0), b: v3(0.3, 0, 0), under: R - t, over: R + t } });
      const N = 11, Rm = R - t / 2; for (let k = 0; k < N; k++) { const am = (k + 0.5) / N * Math.PI; K.box(o, v3(0, Math.sin(am) * Rm - 0.12, Math.cos(am) * Rm), v3(0.27, Math.PI * Rm / N / 2 + 0.02, t / 2), 'tireTread', 0, -am); }
      K.O('Tire opening', 'gap', { gap: { c: v3(0, 0.3, 0), n: v3(1, 0, 0), hu: R - t - 0.05, hv: 0.3, u: v3(0, 0, 1) } }); }),
    'Fence': K => { const f = K.O('Fence', 'deco'); K.box(f, v3(0, 0.9, 0), v3(2, 0.9, 0.03), 'fenceWood'); for (const x of [-2, 0, 2]) K.pipe(f, v3(x, 0, 0.05), v3(x, 1.85, 0.05), 0.05, 'fenceWood'); },
    'Plywood Wall': K => K.box(K.O('Plywood Wall', 'wall', { wallNormal: v3(0, 0, 1) }), v3(0, 1.2, 0), v3(1.5, 1.2, 0.05), 'wood'),
    'House': (K, N) => N.house(0, 0, 10, 8, 0, 'houseSage'), 'Pickup': (K, N) => N.truck(0, 0, 0, 'truckGrey'),
  };
  // apply a layer to a freshly built map (before the Surveyor)
  function applyMapEdits(w, E) {
    if (!E || typeof E !== 'object') return w; for (const o of w.objs) if (o.added) { delete o.added; delete o.addIdx; o.baked = true; }   // what an earlier layer added is part of the map now
    const pieces = mapPieces(w); for (const p of pieces) for (const id of p.ids) w.objs[id].editKey = p.key;   // the key stays with a piece wherever it is moved
    const byKey = new Map(pieces.map(p => [p.key, p])), num = (v, d, lo, hi) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d;
    const find = key => { if (byKey.has(key)) return byKey.get(key); const m = /^(.*)@(-?[\d.]+),(-?[\d.]+)$/.exec(String(key)); if (!m) return null;   // the map code moved it a little since
      let best = null, bd = 0.6; for (const p of pieces) if (p.name === m[1]) { const d = Math.hypot(p.pivot.x - +m[2], p.pivot.z - +m[3]); if (d < bd) { bd = d; best = p; } } return best; };
    const applied = { moved: 0, removed: 0, added: 0, lost: 0 };
    for (const [key, e] of Object.entries(E.moved || {}).slice(0, 5000)) { const p = find(key); if (!p || !e) { applied.lost++; continue; }
      const d = v3(num(e.dx, 0, -500, 500), num(e.dy, 0, -50, 100), num(e.dz, 0, -500, 500)), ry = num(e.ry, 0, -3600, 3600) * Math.PI / 180, s = num(e.s, 1, 0.1, 10);
      for (const id of p.ids) moveObject(w.objs[id], p.pivot, d, ry, s); applied.moved++; }
    for (const key of (Array.isArray(E.removed) ? E.removed : []).slice(0, 5000)) { const p = find(key); if (!p) { applied.lost++; continue; }
      for (const id of p.ids) { const o = w.objs[id]; o.prims = []; o.vis = []; delete o.obstacle; delete o.round; delete o.gap; delete o.light; o.kind = 'deco'; o.removed = true; } applied.removed++; }
    const K = kit(w); let seed = 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, N = natureKit(K, (a, b) => (a + b) / 2, rnd);
    (Array.isArray(E.added) ? E.added : []).slice(0, 3000).forEach((a, ai) => { const make = ASSETS[a && a.asset]; if (!make) { applied.lost++; return; }
      const n0 = w.objs.length; make(K, N); const made = w.objs.slice(n0), g = made.length > 1 ? made[0].id : null;
      for (const o of made) { o.added = true; o.addIdx = ai; if (g != null) o.grp = 'a' + g; moveObject(o, v3(0, 0, 0), v3(num(a.x, 0, -500, 500), num(a.y, 0, -50, 100), num(a.z, 0, -500, 500)), num(a.ry, 0, -3600, 3600) * Math.PI / 180, num(a.s, 1, 0.1, 10)); }
      applied.added++; });
    const all = []; for (const o of w.objs) for (const p of o.prims) { p.owner = o.id; all.push(p); } w.prims = all; w.edits = applied; return w;
  }
  let MAP_EDITS = {};   // per map id, set by the game (store 'mapEdits') before it builds; empty in the Node tests
  S.setMapEdits = (id, E) => { if (E && typeof E === 'object') MAP_EDITS[id] = E; else delete MAP_EDITS[id]; };
  // The official layout of each map (maps/official/<id>.json, published from the Map Editor by the project owner): applied
  // to everyone, under their own layout. build.py ships them (window.PW_OFFICIAL); in Node they are read from the folder,
  // so the tests and tools see the maps as the game does. A flight records the official layout it was flown on.
  const OFFICIAL = {};
  S.setOfficialEdits = (id, E) => { if (E && typeof E === 'object') OFFICIAL[id] = E; else delete OFFICIAL[id]; };
  S.officialEdits = id => OFFICIAL[id] || null;
  if (typeof window !== 'undefined' && window.PW_OFFICIAL && typeof window.PW_OFFICIAL === 'object') for (const [k, v] of Object.entries(window.PW_OFFICIAL)) OFFICIAL[k] = v;
  else if (typeof require === 'function' && typeof __dirname === 'string') { try { const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', 'maps', 'official');
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) if (f.endsWith('.json')) { try { OFFICIAL[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { /* a broken file is skipped */ } } } catch { /* no folder */ } }
  S.mapPieces = mapPieces; S.applyMapEdits = applyMapEdits; S.ASSETS = Object.keys(ASSETS);
  const edited = (id, w) => { if (OFFICIAL[id]) { applyMapEdits(w, OFFICIAL[id]); w.official = w.edits; } if (MAP_EDITS[id]) applyMapEdits(w, MAP_EDITS[id]); else if (OFFICIAL[id]) w.edits = null; return w; };

  // Every map is closed in (pilot, 2026-11-17: "proper bounding boxes"): invisible walls round everything that was built
  // (its colliders' extent and the declared bounds, plus 6 m) and a ceiling 20 m above the tallest thing (at least 35 m
  // up). Kind 'edge': never a tap, a wall ride, an over/under or a pole. Added after the Surveyor so it never sees them.
  function closeIn(w) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = 0;
    for (const p of w.prims) { const a = p.aabb; if (!a) continue; x0 = Math.min(x0, a.min.x); x1 = Math.max(x1, a.max.x); z0 = Math.min(z0, a.min.z); z1 = Math.max(z1, a.max.z); top = Math.max(top, a.max.y); }
    if (w.bounds) { x0 = Math.min(x0, w.bounds.x[0]); x1 = Math.max(x1, w.bounds.x[1]); z0 = Math.min(z0, w.bounds.z[0]); z1 = Math.max(z1, w.bounds.z[1]); }
    x0 -= 6; x1 += 6; z0 -= 6; z1 += 6; const H = Math.max(35, top + 20), T = 1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const o = { id: w.objs.reduce((m, q) => Math.max(m, q.id + 1), 0), name: 'Map Edge', kind: 'edge', prims: [], vis: [] };
    for (const [c, h] of [[v3(x0 - T, H / 2, cz), v3(T, H / 2 + T, hz + 2 * T)], [v3(x1 + T, H / 2, cz), v3(T, H / 2 + T, hz + 2 * T)], [v3(cx, H / 2, z0 - T), v3(hx + 2 * T, H / 2 + T, T)], [v3(cx, H / 2, z1 + T), v3(hx + 2 * T, H / 2 + T, T)], [v3(cx, H + T, cz), v3(hx + 2 * T, T, hz + 2 * T)]]) {
      const b = makeBox(c, h); b.owner = o.id; o.prims.push(b); w.prims.push(b); }
    w.objs.push(o); w.bounds = { x: [x0, x1], z: [z0, z1] }; w.ceiling = H; return w;
  }

  S.MAPS = {
    moose: { id: 'moose', title: 'Moose Knuckle Park', blurb: 'A quiet neighbourhood park in Arrow Heights, Revelstoke: groves of tall cedar and hemlock with grassy lanes between them, a weathered swing set and small play unit, picnic tables in the shade, a half-buried tire tunnel among the birch, and the Selkirks beyond the rooftops.', build: () => closeIn(S.surveyObstacles(edited('moose', buildMoose()))) },
    school: { id: 'school', title: 'Vaporwave School', blurb: 'An abandoned school under a pink sunset: chrome pillar plaza, courtyard bowl, pillar hall, rooftop gaps, classroom wing, and the Trick Park to the west.', build: () => closeIn(S.surveyObstacles(edited('school', buildSchool()))) },
    clappy: { id: 'clappy', title: 'Clappy Park', blurb: 'A bright city-block park: a raised playground plaza (twister slide tower, spinner, the Clappy Bars, a climbing dome, sakura trees), a street ring with race gates and a footbridge, shops and flats with reachable roofs, alleys and walkways, and the Trick Park to the west.', build: () => closeIn(S.surveyObstacles(edited('clappy', buildClappy()))) },
    warehouse: { id: 'warehouse', title: 'More Warehouse', blurb: 'A big, high-bay-lit logistics warehouse: pallet-rack aisles, stacked containers and a container tunnel, a mezzanine and office, catwalks, a crane bridge, a conveyor, skylights, and a loading dock with a trailer outside.', build: () => closeIn(S.surveyObstacles(edited('warehouse', buildWarehouse()))) },
    playground: { id: 'playground', title: 'The Playground', blurb: 'The original: swing set, slide tower, monkey bars, trees, the flagpole and the brick building, now with a skate corner, scaffold, and the Trick Park to the west.', build: () => closeIn(S.surveyObstacles(edited('playground', Object.assign(addPlaygroundExtras(S.buildPlayground()), { id: 'playground', title: 'the playground', theme: 'playground' })))) },
  };
  S.buildSchool = buildSchool; S.buildClappy = buildClappy; S.buildWarehouse = buildWarehouse; S.buildMoose = buildMoose;
})(typeof window !== 'undefined' ? window : globalThis);
