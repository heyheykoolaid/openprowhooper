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
    const box = (o, c, h, mat, ry = 0, rx = 0, rz = 0, opts = {}) => { const b = makeBox(c, h, ry, rx, rz); if (opts.noSurvey) b.leaf = true; if (!opts.noCollide) o.prims.push(b); if (!opts.noDraw) o.vis.push({ shape: 'box', c, h, mat, euler: [rx, ry, rz], ...opts }); return b; };   // noDraw: a collider nothing is drawn for (a smooth skin is drawn over it)
    const pipe = (o, a, b, r, mat, opts = {}) => { if (!opts.noCollide) { const c = makeCapsule(a, b, r); if (opts.leafSolid || opts.noSurvey) c.leaf = true; o.prims.push(c); }   /* leaf: solid, but never a pole or an over/under of its own */ if (!opts.noDraw) o.vis.push({ shape: 'pipe', a, b, r, mat, ...opts }); };
    // a drawn cone's collision (conifer tiers): capsules stacked up the axis, each as wide as fits inside the cone at its
    // top (k: share of the drawn radius, the bough tips give), the lowest resting on the base; leaf: not a pole, not surveyed
    // Each band also gets three level spokes (60° apart) out to the boughs' edge: a vertical stack alone leaves the wide rim
    // of each tier (most of a cone's volume) flyable. All of it stays inside the drawn cone.
    const coneSolid = (o, a, b, R, k = 0.95, n = 5) => { const H = b.y - a.y, ca = H / Math.hypot(H, R), rho = y => k * R * (1 - (y - a.y) / H), push = c => { c.leaf = true; o.prims.push(c); };
      for (let i = 0; i < n; i++) { const sa = 0.9 * i / n, sb = 0.9 * (i + 1) / n, r = rho(a.y + H * sb) * ca, ya = a.y + H * sa + r, yb = Math.max(ya, a.y + H * sb);
        push(makeCapsule(v3(a.x, ya, a.z), v3(a.x, yb, a.z), r));
        const hb = Math.min(0.45, H * 0.9 / n / 2), ym = a.y + H * sa + hb, L = rho(ym) - hb / ca;
        if (L > hb) for (let j = 0; j < 3; j++) { const t = j * Math.PI / 3, dx = Math.cos(t) * L, dz = Math.sin(t) * L; push(makeCapsule(v3(a.x - dx, ym, a.z - dz), v3(a.x + dx, ym, a.z + dz), hb)); } } };
    const ball = (o, c, r, mat, opts = {}) => { if (!opts.noCollide) { const b = makeSphere(c, r); if (opts.leafSolid) b.leaf = true; o.prims.push(b); } o.vis.push({ shape: 'sphere', c, r, mat, ...opts }); };
    // a glowing strip: seen, never hit
    const neon = (o, c, h, mat = 'neonPink', ry = 0) => box(o, c, h, mat, ry, 0, 0, { noCollide: true, glow: true });
    // a flat round slab (drawn as a disc, collides as a box a little inside its rim)
    const disc = (o, c, r, th, mat) => { o.prims.push(makeBox(c, v3(r * 0.74, th, r * 0.74))); o.vis.push({ shape: 'disc', c, r, th, mat }); };
    const done = (extra) => { const all = []; for (const o of objs) for (const p of o.prims) { p.owner = o.id; all.push(p); } return { objs, prims: all, ...extra }; };
    return { objs, O, box, pipe, ball, neon, disc, done, together, coneSolid };
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
    // knife slots (owner, 2026-11-20: Knife Edge only through narrow gaps): plywood panels with a tall narrow slot, 0.2 m (an
    // Air65 knife-edged) and 0.3 m (75-85 mm whoops), across the lane beyond the gap gates
    [[24, 0.2], [27.5, 0.3]].forEach(([lx, w]) => { const x = X(lx), z = Zw(-19), yc = 1.2, sh = 0.35, PW = 0.8, PH = 1.9, t = 0.04, o = O(`Knife Slot ${w.toFixed(1)} m`, 'deco');
      box(o, v3(x, PH / 2, z - (w / 2 + (PW - w / 2) / 2)), v3(t, PH / 2, (PW - w / 2) / 2), M.wall); box(o, v3(x, PH / 2, z + (w / 2 + (PW - w / 2) / 2)), v3(t, PH / 2, (PW - w / 2) / 2), M.wall);
      box(o, v3(x, (yc - sh) / 2, z), v3(t, (yc - sh) / 2, w / 2), M.wall); box(o, v3(x, (yc + sh + PH) / 2, z), v3(t, (PH - yc - sh) / 2, w / 2), M.wall);
      mark(o, v3(x + 0.045, yc + sh + 0.03, z), v3(0.004, 0.02, w / 2));
      O(`Knife Slot ${w.toFixed(1)} m opening`, 'gap', { gap: { c: v3(x, yc, z), n: v3(1, 0, 0), hu: w / 2, hv: sh, u: v3(0, 0, 1) } }); });
    // the Cube (owner, 2026-11-23: Cube Eject, Loop to Matty): a 1.6 m frame of thin bars open on all four sides and on top, each
    // opening a gap; the top one lies flat (a horizontal gap)
    { const o = O('Cube 1.6 m', 'deco'), cx = X(28.5), cz = Zw(13), h = 0.8, t = 0.03, g = h - 0.08;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(o, v3(cx + sx * h, h, cz + sz * h), v3(t, h, t), M.post);
      for (const y of [t, 2 * h]) for (const s of [-1, 1]) { box(o, v3(cx + s * h, y, cz), v3(t, t, h), M.bar); box(o, v3(cx, y, cz + s * h), v3(h, t, t), M.bar); }
      for (const s of [-1, 1]) { O(`Cube ${s < 0 ? 'west' : 'east'} opening`, 'gap', { gap: { c: v3(cx + s * h, h, cz), n: v3(1, 0, 0), hu: g, hv: g, u: v3(0, 0, 1) } });
        O(`Cube ${s < 0 ? 'north' : 'south'} opening`, 'gap', { gap: { c: v3(cx, h, cz + s * h), n: v3(0, 0, 1), hu: g, hv: g, u: v3(1, 0, 0) } }); }
      O('Cube top opening', 'gap', { gap: { c: v3(cx, 2 * h, cz), n: v3(0, 1, 0), hu: g, hv: g, u: v3(1, 0, 0) } }); }
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
      for (let i = 1; i < P.length; i++) O('Overhead Wires', 'overunder', { obstacle: { a: v3(P[i - 1].x, 0, P[i - 1].z), b: v3(P[i].x, 0, P[i].z), under: 7.35, over: 7.6 } });   // each span an over/under (owner, 2026-11-19)
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
        const art = name === 'North Shops' && i === 1 ? { graffiti: 'south', art: [{ name: 'clappy', x: 0.3, y: 3.6, h: 5.6, rot: -0.03 }, { name: 'heyhey', x: 0.74, y: 3.8, h: 4.2, rot: 0.03 }] }
          : name === 'North Shops' && i === 2 ? { graffiti: 'south', art: [{ name: 'roguemonkey', x: 0.18, y: 4.15, h: 1.9, rot: -0.03 }, { name: 'fpvyourworld', x: 0.5, y: 3.95, h: 2.7, rot: 0.02 }, { name: 'ridgeripper', x: 0.82, y: 4.2, h: 1.35, rot: -0.04 }] }
          : name === 'South Flats' && i === 1 ? { graffiti: 'north', art: [{ name: 'alligatorman', x: 0.3, y: 5.7, h: 4.3, w: 4.2, rot: -0.02 }, { name: 'rodfpv', x: 0.74, y: 5.3, h: 2.3, w: 4.1, rot: 0.02 }] } : {};   // friends of the project (owner, 2026-11-19; RodFpv and Alligator Man 2026-11-20)
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
        // no window painted over: a piece with its width given (`w`, metres) keeps the wall behind it clear (the facade's u runs
        // west to east facing south, east to west facing north)
        const behindArt = (m, y) => (art.art || []).some(p => { if (!p.w || !ax) return false; const u = (art.graffiti === 'north' ? a1 - m : m - a0) / (a1 - a0) * (a1 - a0);
          return Math.abs(u - p.x * (a1 - a0)) < p.w / 2 + 0.6 && Math.abs(y - p.y) < p.h / 2 + 0.75; });
        for (let fl = 1; fl < floors; fl++) { const yb = fl * 3; box(trim, P(c, yb, 0.06), Sz(hl, 0.06, 0.06), 'concrete');
          for (let m = a0 + 1.5; m < a1 - 1.0; m += 2.4) { if (behindArt(m, yb + 1.55)) continue; box(win, P(m, yb + 1.55, 0.025), Sz(0.55, 0.72, 0.02), 'glass', 0, 0, 0, { noCollide: true }); box(win, P(m, yb + 0.78, 0.07), Sz(0.66, 0.04, 0.07), 'concrete'); } }
        for (const e of [a0, a1]) { if (e === -40 || e === 40) continue; const sx = e === a0 ? -1 : 1;
          for (let fl = 1; fl < floors; fl++) for (const dd of [26.5, 30.5, 34.5, 38]) { const y = fl * 3 + 1.55, pos = ax ? v3(e + sx * 0.025, y, out * dd) : v3(out * dd, y, e + sx * 0.025); box(win, pos, ax ? v3(0.02, 0.6, 0.45) : v3(0.45, 0.6, 0.02), 'glass', 0, 0, 0, { noCollide: true }); } }
        { const pr = O('Parapet', 'deco'), ph = 0.45, pt = 0.1;
          box(pr, ax ? v3(c, h + ph / 2, out * (d0 + pt)) : v3(out * (d0 + pt), h + ph / 2, c), Sz(hl, ph / 2, pt), 'concrete'); box(pr, ax ? v3(c, h + ph / 2, out * (d1 - pt)) : v3(out * (d1 - pt), h + ph / 2, c), Sz(hl, ph / 2, pt), 'concrete');
          for (const e of [a0 + pt, a1 - pt]) box(pr, ax ? v3(e, h + ph / 2, out * dm) : v3(out * dm, h + ph / 2, e), ax ? v3(pt, ph / 2, 8) : v3(8, ph / 2, pt), 'concrete');
          const rc = O('Rooftop Unit', 'deco'), ra = c + (i % 2 ? -1 : 1) * Math.min(4, hl / 3), rd = out * (dm + 2);
          box(rc, ax ? v3(ra, h + 0.45, rd) : v3(rd, h + 0.45, ra), v3(0.7, 0.45, 0.55), 'metal'); box(rc, ax ? v3(ra + 1.8, h + 0.35, rd - out * 1.5) : v3(rd - out * 1.5, h + 0.35, ra + 1.8), v3(0.5, 0.35, 0.5), 'metal');
          if (h > 6) { const tk = O('Water Tank', 'overunder'), tx = c - (i % 2 ? -1 : 1) * Math.min(5, hl / 2.5), tzz = out * (dm - 2), tp = ax ? v3(tx, 0, tzz) : v3(tzz, 0, tx);
            // a stand you can see (owner, 2026-11-19: it read as "a floating tire"): four splayed legs on foot plates, X braces
            // between them, a deck under the tank, the tank itself and a cone roof
            const L = [[-0.62, -0.62], [0.62, -0.62], [0.62, 0.62], [-0.62, 0.62]];
            for (const [u, w] of L) { pipe(tk, v3(tp.x + u * 1.25, h, tp.z + w * 1.25), v3(tp.x + u, h + 1.36, tp.z + w), 0.07, 'rust'); box(tk, v3(tp.x + u * 1.25, h + 0.02, tp.z + w * 1.25), v3(0.14, 0.02, 0.14), 'metal', 0, 0, 0, { noSurvey: true }); }
            for (let k = 0; k < 4; k++) { const [u0, w0] = L[k], [u1, w1] = L[(k + 1) % 4]; pipe(tk, v3(tp.x + u0 * 1.2, h + 0.15, tp.z + w0 * 1.2), v3(tp.x + u1 * 1.02, h + 1.2, tp.z + w1 * 1.02), 0.025, 'rust', { noSurvey: true }); pipe(tk, v3(tp.x + u1 * 1.2, h + 0.15, tp.z + w1 * 1.2), v3(tp.x + u0 * 1.02, h + 1.2, tp.z + w0 * 1.02), 0.025, 'rust', { noSurvey: true }); }
            box(tk, v3(tp.x, h + 1.37, tp.z), v3(0.95, 0.04, 0.95), 'metal', 0, 0, 0, { noSurvey: true });
            pipe(tk, v3(tp.x, h + 1.4, tp.z), v3(tp.x, h + 2.9, tp.z), 0.8, 'galv');
            pipe(tk, v3(tp.x, h + 2.9, tp.z), v3(tp.x, h + 3.35, tp.z), 0.86, 'rust', { cone: true, noCollide: true }); tk.obstacle = { a: v3(tp.x - 0.8, 0, tp.z), b: v3(tp.x + 0.8, 0, tp.z), under: h + 1.35, over: h + 2.9 }; }
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
        O('Roll-up Door', 'gap', { gap: { c: v3(d, (DH - 0.12) / 2, z), n: v3(0, 0, 1), hu: DW - 0.1, hv: (DH - 0.12) / 2, u: v3(1, 0, 0) } }); }   /* the opening less 10 cm of frame (tools/gapcheck.js) */
      box(o, v3((x0 + X) / 2, H / 2, z), v3((X - x0) / 2, H / 2, T / 2), 'metalPlate'); }
    { const r = O('Warehouse Roof', 'deco'), holes = [[-15, -4], [15, -4]], SW = 3, SL = 5;   // skylights: two pairs, each opening 6 x 10 m split in two
      // strips of roof between and around the skylight openings (x -18..-12 and 12..18, z -9..1)
      for (const [a, b] of [[-X - T, -18], [-12, 12], [18, X + T]]) box(r, v3((a + b) / 2, H + 0.15, 0), v3((b - a) / 2, 0.15, Z + T), 'metal');
      for (const [hx] of holes) { box(r, v3(hx, H + 0.15, (-Z - T - 9) / 2), v3(SW, 0.15, (Z + T - 9) / 2), 'metal'); box(r, v3(hx, H + 0.15, (1 + Z + T) / 2), v3(SW, 0.15, (Z + T - 1) / 2), 'metal');
        box(r, v3(hx, H + 0.1, -4), v3(SW, 0.03, 0.08), 'galv', 0, 0, 0, { noCollide: true });
        for (const zc of [-6.45, -1.55]) O('Skylight', 'gap', { gap: { c: v3(hx, H + 0.15, zc), n: v3(0, 1, 0), hu: SW - 0.1, hv: SL / 2 - 0.05, u: v3(1, 0, 0) } }); void SL; } }
    // ---- steel columns (the roof's), lights on the roof trusses
    const col = O('Steel Column', 'pole'); for (const x of [-20, -10, 0, 10, 20]) for (const z of [-10, 0, 10]) { if (x === 0 && z === 0) continue; pipe(col, v3(x, 0, z), v3(x, H, z), 0.2, 'paintBlue'); pipe(col, v3(x, 1.12, z), v3(x, 1.28, z), 0.215, 'plasticYellow', { noCollide: true, glow: true }); }   /* a round band on a round column (it was a square block) */
    // lights: three rows of high-bay fittings under the trusses (strong: the pilot found the first version far too dark)
    for (const x of [-25, -15, -5, 5, 15, 25]) for (const z0 of [-13, -1, 11]) { const z = Math.abs(x) === 15 && z0 === -1 ? 2.2 : z0, l = O('High-bay Light', 'deco', (x + z0) % 2 === 0 || z0 === -1 ? { light: v3(x, H - 1.0, z), lightColor: 0xeef5ff, lightPower: 60, lightRange: 30 } : {});   /* two hung in a skylight opening, from nothing: now just south of it */
      box(l, v3(x, H - 0.75, z), v3(1.3, 0.05, 0.18), 'fluoro', 0, 0, 0, { noCollide: true, glow: true }); box(l, v3(x, H - 0.69, z), v3(1.35, 0.03, 0.24), 'metal'); for (const dx of [-1, 1]) pipe(l, v3(x + dx, H - 0.66, z), v3(x + dx, H, z), 0.01, 'chain', { noCollide: true }); }
    // the roof structure: a truss every 6 m (top and bottom chords and diagonals), purlins along the hall
    { const tr = O('Roof Truss', 'deco'); for (let x = -27; x <= 27; x += 6) { pipe(tr, v3(x, H - 0.3, -Z), v3(x, H - 0.3, Z), 0.07, 'galv'); pipe(tr, v3(x, H - 1.6, -Z + 1), v3(x, H - 1.6, Z - 1), 0.05, 'galv');
        for (let z = -Z + 1; z < Z - 1; z += 3) pipe(tr, v3(x, H - 1.6, z), v3(x, H - 0.3, z + 1.5), 0.025, 'galv', { noSurvey: true }); }
      for (const z of [-15, -9, 3, 9, 15]) pipe(tr, v3(-X, H - 0.25, z), v3(X, H - 0.25, z), 0.04, 'galv', { noSurvey: true }); }
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
          if (rnd() < 0.55) { const w = 0.4 + rnd() * 0.35, hh = 0.25 + rnd() * 0.35, px = xa + 0.6 + rnd() * (bw - 1.2), mt = rnd() < 0.5 ? 'wood' : 'dumpster'; if (!(i % 3 === 1 && y === 1.6)) box(crate, v3(px, y + 0.08 + hh, rz), v3(w, hh, Math.min(D - 0.05, w)), mt); } }   /* the same draws as before; a crate in a Rack Bay gap is left out (four gaps were blocked) */
        if (i % 3 === 1) O('Rack Bay', 'gap', { gap: { c: v3((xa + xb) / 2, 2.42, rz), n: v3(0, 0, 1), hu: bw / 2 - 0.16, hv: 0.62, u: v3(1, 0, 0) } }); } }
    // ---- shipping containers: stacks in the east half, one open both ends as a tunnel
    const cont = (name, cx, cy, cz, ry, mat, open) => { const L = 6, W = 1.2, Hh = 1.3, alongX = ry === 0, o = O(name, 'overunder');
      const c = v3(cx, cy + Hh, cz), hx = alongX ? L / 2 : W, hz = alongX ? W : L / 2;
      if (!open) box(o, c, v3(hx, Hh, hz), mat);
      else { box(o, v3(cx, cy + 2 * Hh - 0.05, cz), v3(hx, 0.05, hz), mat); box(o, v3(cx, cy + 0.05, cz), v3(hx, 0.05, hz), mat);
        for (const s of [-1, 1]) box(o, alongX ? v3(cx, cy + Hh, cz + s * (W - 0.05)) : v3(cx + s * (W - 0.05), cy + Hh, cz), alongX ? v3(L / 2, Hh, 0.05) : v3(0.05, Hh, L / 2), mat);
        O(name + ' mouth', 'gap', { gap: { c: v3(cx + (alongX ? L / 2 : 0), cy + Hh, cz + (alongX ? 0 : L / 2)), n: alongX ? v3(1, 0, 0) : v3(0, 0, 1), hu: W - 0.2, hv: Hh - 0.2, u: alongX ? v3(0, 0, 1) : v3(1, 0, 0) } }); }
      o.obstacle = alongX ? { a: v3(cx, 0, cz - W), b: v3(cx, 0, cz + W), under: cy, over: cy + 2 * Hh } : { a: v3(cx - W, 0, cz), b: v3(cx + W, 0, cz), under: cy, over: cy + 2 * Hh }; return o; };
    cont('Container', 8, 0, -9, 0, 'paintBlue'); cont('Container', 8, 2.6, -9, 0, 'paintRed');
    cont('Container', 16, 0, -9, 0, 'paintGreen'); cont('Container', 24, 0, -4, 1, 'paintOrange'); cont('Container', 24, 2.6, -4, 1, 'paintBlue'); cont('Container', 24, 5.2, -4, 1, 'paintGreen');
    cont('Container Tunnel', 14, 0, 3, 0, 'rust', true);
    // ---- mezzanine (north-east) with an office under it and stairs up
    { const o = slabOU('Mezzanine', v3(15, 4.5, -17), v3(13, 0.12, 3), 'metalPlate'); for (const x of [3, 9, 15, 21, 27]) pipe(o, v3(x, 0, -14.2), v3(x, 4.4, -14.2), 0.1, 'paintBlue');
      bar('Mezzanine Rail', v3(2, 5.5, -14), v3(28, 5.5, -14), 0.03, 'plasticYellow');
      // the stairs climb south along the mezzanine's west end and step onto it at its south-west corner (owner, 2026-11-21: "the
      // stairs do not line up to the railings"): flush against the deck's edge and up to its top, a handrail down each side, a
      // rail along the deck's west edge that stops where the top steps come on, a post where the rails meet
      const st = O('Mezzanine Stairs', 'deco'), SX = 1.4, TOP = 4.62; for (let i = 0; i < 12; i++) box(st, v3(SX, TOP * (i + 1) / 12 / 2, -14.4 - (11 - i) * 0.3), v3(0.6, TOP * (i + 1) / 12 / 2, 0.15), 'metalPlate', 0, 0, 0, { noSurvey: true });
      { const zl = -17.7, zt = -14.4, yl = TOP / 12 + 0.9, yt = TOP + 0.9, rail = (x, z1, y1) => { pipe(st, v3(x, yl, zl), v3(x, y1, z1), 0.025, 'plasticYellow', { noSurvey: true }); pipe(st, v3(x, TOP / 12, zl), v3(x, yl, zl), 0.025, 'plasticYellow', { noSurvey: true }); };
        rail(SX - 0.6, zt, yt); pipe(st, v3(SX - 0.6, TOP, zt), v3(SX - 0.6, yt, zt), 0.025, 'plasticYellow', { noSurvey: true });
        const zo = -15.0, yo = yl + (yt - yl) * (zo - zl) / (zt - zl); rail(2.0, zo, yo);   // the deck side: up to where the opening onto the deck starts
        pipe(st, v3(2.0, yo, zo), v3(2.0, 5.5, zo), 0.025, 'plasticYellow', { noSurvey: true });
        pipe(st, v3(2.0, TOP, -14.0), v3(2.0, 5.5, -14.0), 0.03, 'plasticYellow', { noSurvey: true }); }
      bar('Mezzanine Rail', v3(2, 5.5, -20), v3(2, 5.5, -15.0), 0.03, 'plasticYellow');
      const of = O('Office', 'building', { wallNormal: v3(0, 0, 1), tall: 3.2 });
      box(of, v3(21.5, 1.6, -15.2), v3(1.5, 1.6, 0.06), 'vConcrete'); box(of, v3(26.5, 1.6, -15.2), v3(1.5, 1.6, 0.06), 'vConcrete'); box(of, v3(24, 0.5, -15.2), v3(1, 0.5, 0.06), 'vConcrete'); box(of, v3(24, 2.6, -15.2), v3(1, 0.6, 0.06), 'vConcrete');   /* the wall round the window: it was one solid slab with the gap inside it */
      box(of, v3(20, 1.6, -17.6), v3(0.06, 1.6, 2.4), 'vConcrete'); box(of, v3(24, 3.25, -17.6), v3(4, 0.05, 2.4), 'vConcrete');
      O('Office Window', 'gap', { gap: { c: v3(24, 1.5, -15.2), n: v3(0, 0, 1), hu: 0.9, hv: 0.4, u: v3(1, 0, 0) } }); }
    // ---- two catwalks crossing the hall, the crane bridge, the conveyor
    { slabOU('Catwalk', v3(-1, 7.5, 6), v3(27, 0.05, 0.6), 'metalPlate'); for (const z of [5.4, 6.6]) bar('Catwalk Rail', v3(-28, 8.5, z), v3(26, 8.5, z), 0.025, 'plasticYellow');
      slabOU('Catwalk', v3(5, 8.6, 0), v3(0.6, 0.05, 13), 'metalPlate'); for (const x of [4.4, 5.6]) bar('Catwalk Rail', v3(x, 9.6, -13), v3(x, 9.6, 13), 0.025, 'plasticYellow');
      const hg = O('Catwalk Hanger', 'deco'); for (const x of [-20, -5, 15]) for (const z of [5.4, 6.6]) pipe(hg, v3(x, 7.5, z), v3(x, H, z), 0.015, 'galv', { noCollide: true }); }
    for (const z of [-Z + 0.5, Z - 0.5]) bar('Crane Runway', v3(-X + 0.5, 10, z), v3(X - 0.5, 10, z), 0.12, 'plasticYellow');
    { const o = slabOU('Crane Bridge', v3(-12, 10.2, 0), v3(0.35, 0.3, Z - 0.6), 'plasticYellow'); pipe(o, v3(-12, 9.9, 3), v3(-12, 6.5, 3), 0.02, 'chain', { noCollide: true }); box(o, v3(-12, 6.3, 3), v3(0.25, 0.2, 0.25), 'rust'); }
    const conv = slabOU('Conveyor', v3(10, 1.0, 12), v3(14, 0.1, 0.45), 'rubberBlack'); for (let x = -3.5; x <= 23.5; x += 3) for (const z of [11.6, 12.4]) pipe(conv, v3(x, 0, z), v3(x, 0.9, z), 0.04, 'galv');
    // ---- crate stacks, barrels, a forklift, floor markings
    for (const [x, z, n] of [[-6, 10, 3], [-3, 15, 2], [3, 14.5, 1], [-24, 10, 2], [-18, 15, 3], [26, 10, 2]]) { const o = O('Crate Stack', 'deco'); for (let k = 0; k < n; k++) box(o, v3(x + (k % 2) * 0.1, 0.74 + k * 1.2, z), v3(0.58, 0.6, 0.58), 'wood', k * 0.3); }
    { const b = O('Barrels', 'deco'); for (const [x, z] of [[-26, 16], [-25.3, 16.6], [-26.6, 16.8], [27, 15], [26.3, 15.7]]) pipe(b, v3(x, 0, z), v3(x, 0.9, z), 0.3, ['paintBlue', 'paintRed', 'rust'][Math.floor(rnd() * 3)]); }
    { const f = O('Forklift', 'deco'), x = 9, z = 17; box(f, v3(x, 0.6, z), v3(0.6, 0.45, 1.0), 'plasticYellow'); for (const s of [-1, 1]) pipe(f, v3(x + s * 0.45, 0, z - 1.0), v3(x + s * 0.45, 2.6, z - 1.0), 0.04, 'metal'); box(f, v3(x, 0.15, z - 1.6), v3(0.5, 0.03, 0.6), 'metal'); box(f, v3(x, 1.9, z + 0.2), v3(0.6, 0.04, 0.7), 'metal'); for (const sx of [-1, 1]) for (const dz of [-0.4, 0.8]) pipe(f, v3(x + sx * 0.55, 1.0, z + dz), v3(x + sx * 0.55, 1.88, z + dz), 0.025, 'metal', { noSurvey: true }); }
    { const m = O('Floor Marking', 'deco'); for (const z of [-11.5, -4.5, 2.5]) box(m, v3(-15, 0.008, z), v3(13, 0.004, 0.06), 'plasticYellow', 0, 0, 0, { noCollide: true }); for (const x of [-16, 0, 16]) box(m, v3(x, 0.008, Z - 2), v3(2.4, 0.004, 0.06), 'plasticYellow', 0, 0, 0, { noCollide: true }); }
    // ---- outside: the loading dock and a parked trailer
    { const d = O('Loading Dock', 'deco'); box(d, v3(0, 0.6, Z + T + 1.5), v3(22, 0.6, 1.5), 'concrete'); for (const x of [-16, 0, 16]) for (const s of [-1, 1]) box(d, v3(x + s * 1.8, 0.8, Z + T + 3.05), v3(0.2, 0.25, 0.06), 'rubberBlack');
      O('Trailer underside', 'gap', { gap: { c: v3(-16, 0.6, 28.9), n: v3(1, 0, 0), hu: 3.7, hv: 0.48, u: v3(0, 0, 1) } });   // owner, 2026-11-21: under the truck counts (between its legs and its wheels)
      const tr = O('Trailer', 'overunder', { obstacle: { a: v3(-17.25, 0, 30), b: v3(-14.75, 0, 30), under: 1.25, over: 4.15 } }); box(tr, v3(-16, 2.7, 30), v3(1.25, 1.45, 6), 'metalPlate'); box(tr, v3(-16, 1.2, 30), v3(1.2, 0.05, 6), 'metal');
      for (const z of [33.5, 34.8]) for (const s of [-1, 1]) pipe(tr, v3(-16 + s * 1.05, 0.5, z), v3(-16 + s * 1.3, 0.5, z), 0.5, 'tire');
      for (const s of [-1, 1]) pipe(tr, v3(-16 + s * 0.9, 0, 24.6), v3(-16 + s * 0.9, 1.15, 24.6), 0.05, 'metal'); }
    // ================================================================ the detail pass (owner, 2026-11-21)
    // "a moving conveyor belt … two levels more scatter and detail". Added last with its own random stream, so nothing above moves.
    // Trim carries noSurvey (solid, never an over/under of its own); the new trick objects are named and tagged by hand.
    const belts = [];
    { let s2 = 7717; const r2 = () => (s2 = (s2 * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(r2() * a.length)], NS = { noSurvey: true }, ND = { noCollide: true };
      const bx = (o, x, y, z, hx, hy, hz, mat, ry = 0, opt = NS) => box(o, v3(x, y, z), v3(hx, hy, hz), mat, ry, 0, 0, opt);
      const post = (o, x, z, y0, y1, r, mat, opt = NS) => pipe(o, v3(x, y0, z), v3(x, y1, z), r, mat, opt);
      // ---- the conveyor runs (east, 1.2 m/s): whatever rests on the belt is carried along (sim.js: surf.belt; worldview.js draws the cleats)
      { const V = 1.2; conv.obstacle.over = 1.21; conv.prims[0].surf = { e: 0.1, f: 0.9, belt: v3(V, 0, 0) }; belts.push({ x0: -4, x1: 24, z: 12, hw: 0.45, y: 1.1, v: V });
        for (const z of [11.52, 12.48]) bx(conv, 10, 1.14, z, 14.1, 0.07, 0.03, 'galv');
        for (const x of [-4.05, 24.05]) pipe(conv, v3(x, 1.0, 11.6), v3(x, 1.0, 12.4), 0.1, 'darkMetal', NS);
        bx(conv, 23.5, 0.55, 12.66, 0.3, 0.25, 0.22, 'paintBlue');
        const st = O('Conveyor Control', 'deco'); post(st, -4.7, 12.9, 0, 1.1, 0.04, 'galv'); bx(st, -4.7, 1.2, 12.9, 0.12, 0.12, 0.08, 'plasticYellow'); bx(st, -4.7, 1.25, 12.99, 0.04, 0.04, 0.02, 'paintRed');
        const bin = O('Parcel Bin', 'deco'); bx(bin, 25.3, 0.04, 12, 0.75, 0.04, 0.75, 'dumpster'); for (const [dx, dz, hx, hz] of [[-0.72, 0, 0.03, 0.75], [0.72, 0, 0.03, 0.75], [0, -0.72, 0.75, 0.03], [0, 0.72, 0.75, 0.03]]) bx(bin, 25.3 + dx, 0.45, 12 + dz, hx, 0.4, hz, 'dumpster');
        for (const [dx, dz, h] of [[-0.3, -0.25, 0.16], [0.25, 0.2, 0.12], [-0.1, 0.35, 0.1]]) bx(bin, 25.3 + dx, 0.08 + h, 12 + dz, 0.22, h, 0.18, 'cardboard'); }
      // ---- goods on the empty rack shelves (never on the shelf under a Rack Bay gap), guards at the row ends, a board on each row
      { const goods = O('Rack Goods', 'deco'), occ = crate.vis.map(v => v.c), bw = 2.7, x0 = -28;
        for (const rz of [-15, -8, -1]) for (let i = 0; i < 8; i++) for (const y of [1.6, 3.2, 4.8, 6.4]) { const xa = x0 + i * bw, xc = xa + bw / 2, top = y + 0.08, kind = r2(), n = 1 + Math.floor(r2() * 3), u = [r2(), r2(), r2(), r2(), r2(), r2()], m1 = pick(['paintBlue', 'paintRed', 'rust']), m2 = pick(['cardboard', 'signWhite', 'cardboard', 'fadedBlue']);
          if ((i % 3 === 1 && y === 1.6) || kind > 0.8 || occ.some(c => Math.abs(c.x - xc) < bw / 2 && Math.abs(c.z - rz) < 0.2 && c.y > y && c.y < y + 1.5)) continue;
          if (kind < 0.5) for (let k = 0; k < n; k++) { const w = 0.28 + u[k] * 0.14, hh = 0.18 + u[k + 3] * 0.3; bx(goods, xa + 0.55 + k * 0.8, top + hh, rz + (u[k + 3] - 0.5) * 0.2, w, hh, Math.min(0.4, w + 0.05), 'cardboard'); }
          else if (kind < 0.65) for (let k = 0; k < 2; k++) post(goods, xc - 0.35 + k * 0.7, rz, top + 0.02, top + 0.85, 0.27, m1);
          else { bx(goods, xc, top + 0.07, rz, 0.55, 0.07, 0.45, 'wood'); bx(goods, xc, top + 0.14 + 0.42, rz, 0.5, 0.42, 0.42, m2); } }
        const gd = O('Rack Guard', 'deco'), sg = O('Rack Sign', 'deco');
        for (const rz of [-15, -8, -1]) { for (const x of [-28.45, -5.95]) { for (const dz of [-0.6, 0.6]) post(gd, x, rz + dz, 0, 0.45, 0.04, 'plasticYellow'); pipe(gd, v3(x, 0.45, rz - 0.6), v3(x, 0.45, rz + 0.6), 0.04, 'plasticYellow', NS); }
          bx(sg, -6.4, 7.5, rz, 0.03, 0.3, 0.6, 'paintBlue'); bx(sg, -6.36, 7.5, rz, 0.01, 0.2, 0.45, 'signWhite', 0, ND); } }
      // ---- services on the walls and under the roof: sprinkler main and conduit, panels, extinguishers, wall fans, a vent duct
      { const sv = O('Wall Services', 'deco');
        for (const [y, r, m] of [[3.0, 0.06, 'paintRed'], [3.3, 0.04, 'galv'], [3.5, 0.03, 'galv']]) pipe(sv, v3(-29.6, y, -19.7), v3(1.2, y, -19.7), r, m, NS);
        for (const x of [-27, -9]) pipe(sv, v3(x, 0, -19.7), v3(x, 3.0, -19.7), 0.06, 'paintRed', NS);
        pipe(sv, v3(-29.72, 2.6, -19.4), v3(-29.72, 2.6, 19.4), 0.03, 'galv', NS);
        for (const z of [-4.5, 8.5]) { bx(sv, -29.86, 1.5, z, 0.13, 0.5, 0.4, 'darkMetal'); bx(sv, -29.72, 1.75, z, 0.01, 0.08, 0.2, 'plasticYellow', 0, ND); }
        for (const x of [-21, -3]) { post(sv, x, -19.69, 0.9, 1.3, 0.07, 'paintRed'); bx(sv, x, 1.65, -19.75, 0.12, 0.12, 0.01, 'paintRed', 0, ND); }
        for (const x of [-8, 8]) post(sv, x, 19.93, 0.9, 1.3, 0.07, 'paintRed');
        for (const z of [-8, 8]) { bx(sv, 29.87, 7.6, z, 0.13, 0.7, 0.7, 'darkMetal'); bx(sv, 29.73, 7.6, z, 0.01, 0.55, 0.55, 'galv', 0, ND); }
        const du = O('Vent Duct', 'deco'); pipe(du, v3(-27, 10.8, 16), v3(27, 10.8, 16), 0.28, 'galv', NS); for (let x = -27; x <= 27; x += 6) bx(du, x, 10.485, 16, 0.1, 0.04, 0.2, 'galv');
        for (const x of [-18, 0, 18]) bx(du, x, 10.47, 16, 0.3, 0.05, 0.3, 'darkMetal'); }
      // ---- the mezzanine: rail posts and a mid rail, a break corner, lockers, shelving; a workshop and stores under it; the office
      { const mz = O('Mezzanine Fittings', 'deco'), DY = 4.62;
        for (let x = 4; x <= 28; x += 2) post(mz, x, -14, DY, 5.5, 0.02, 'plasticYellow'); pipe(mz, v3(2, 5.06, -14), v3(28, 5.06, -14), 0.015, 'plasticYellow', NS);
        for (const z of [-19.6, -18.1, -16.6]) post(mz, 2, z, DY, 5.5, 0.02, 'plasticYellow');
        const tb = O('Break Table', 'deco'); box(tb, v3(6.5, DY + 0.74, -17.4), v3(0.8, 0.03, 0.45), 'wood'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(tb, 6.5 + sx * 0.7, -17.4 + sz * 0.38, DY, DY + 0.71, 0.025, 'metal');
        for (const [x, z, s] of [[6.0, -16.6, 1], [7.0, -18.2, -1]]) { bx(mz, x, DY + 0.22, z, 0.2, 0.22, 0.2, 'fadedBlue'); bx(mz, x, DY + 0.62, z + s * 0.18, 0.2, 0.2, 0.025, 'fadedBlue'); }
        for (let k = 0; k < 5; k++) bx(mz, 21.3 + k * 0.62, DY + 0.9, -19.7, 0.3, 0.9, 0.28, k % 2 ? 'fadedBlue' : 'paintBlue');
        bx(mz, 26.6, DY + 0.95, -19.6, 0.45, 0.95, 0.38, 'darkMetal'); bx(mz, 26.6, DY + 1.2, -19.21, 0.36, 0.5, 0.01, 'fluoro', 0, { noCollide: true, glow: true });
        for (const x of [10, 12.4, 14.8]) { for (const dx of [-1.1, 1.1]) for (const dz of [-0.25, 0.25]) post(mz, x + dx, -19.6 + dz, DY, DY + 1.9, 0.025, 'galv'); for (const y of [0.5, 1.1, 1.7]) { bx(mz, x, DY + y, -19.6, 1.12, 0.02, 0.28, 'metalPlate'); for (let k = 0; k < 3; k++) { const on = r2() < 0.7, hh = 0.1 + r2() * 0.14, w = 0.24 + r2() * 0.08, m = pick(['cardboard', 'cardboard', 'paintRed', 'wood']); if (on) bx(mz, x - 0.75 + k * 0.75, DY + y + 0.02 + hh, -19.6, w, hh, 0.22, m); } } }
        for (const [x, z, n] of [[17.5, -18.8, 3], [18.6, -19.0, 2], [3.2, -19.2, 2], [24.5, -16.2, 1]]) for (let k = 0; k < n; k++) bx(mz, x, DY + 0.25 + k * 0.5, z, 0.3, 0.25, 0.28, 'cardboard');
        const ws = O('Workbench', 'deco'); box(ws, v3(6, 0.92, -19.45), v3(1.5, 0.04, 0.45), 'wood', 0, 0, 0, NS); for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(ws, 6 + sx * 1.4, -19.45 + sz * 0.38, 0, 0.88, 0.035, 'darkMetal');
        bx(ws, 6, 0.3, -19.45, 1.4, 0.02, 0.4, 'metalPlate'); bx(ws, 5.0, 1.04, -19.3, 0.1, 0.08, 0.14, 'darkMetal'); bx(ws, 6.0, 1.9, -19.96, 1.5, 0.6, 0.03, 'wood'); bx(ws, 7.0, 1.02, -19.5, 0.25, 0.06, 0.15, 'paintRed');
        bx(mz, 8.6, 0.55, -19.5, 0.4, 0.55, 0.3, 'paintRed'); bx(mz, 8.6, 1.13, -19.5, 0.42, 0.03, 0.32, 'darkMetal');
        for (let k = 0; k < 3; k++) post(mz, 10.4 + k * 0.32, -19.72, 0.02, 1.3, 0.12, ['paintGreen', 'paintBlue', 'rust'][k]); pipe(mz, v3(10.2, 0.9, -19.56), v3(11.24, 0.9, -19.56), 0.012, 'chain', NS);
        for (const x of [13.5, 16.2]) { for (const dx of [-1.2, 1.2]) for (const dz of [-0.3, 0.3]) post(mz, x + dx, -19.6 + dz, 0, 2.4, 0.03, 'paintOrange'); for (const y of [0.15, 0.9, 1.65, 2.38]) { bx(mz, x, y, -19.6, 1.22, 0.02, 0.33, 'metalPlate'); for (let k = 0; k < 3; k++) { const on = r2() < 0.8, hh = 0.14 + r2() * 0.18, w = 0.26 + r2() * 0.1, m = pick(['cardboard', 'wood', 'dumpster', 'cardboard']); if (on && y < 2) bx(mz, x - 0.8 + k * 0.8, y + 0.02 + hh, -19.6, w, hh, 0.26, m); } } }
        bx(mz, 18.6, 0.45, -19.5, 0.3, 0.45, 0.3, 'dumpster');
        const od = O('Office Desk', 'deco'); box(od, v3(24, 0.74, -18.9), v3(0.9, 0.03, 0.4), 'wood', 0, 0, 0, NS); for (const sx of [-1, 1]) bx(od, 24 + sx * 0.85, 0.36, -18.9, 0.03, 0.36, 0.38, 'wood');
        bx(od, 24.3, 0.97, -19.05, 0.26, 0.17, 0.02, 'fluoro', 0, { glow: true, noSurvey: true }); bx(od, 24.3, 0.79, -19.05, 0.06, 0.02, 0.06, 'darkMetal');
        bx(mz, 24, 0.24, -18.1, 0.22, 0.24, 0.22, 'fadedBlue'); bx(mz, 24, 0.66, -17.86, 0.22, 0.2, 0.03, 'fadedBlue');
        bx(mz, 21.0, 0.65, -19.6, 0.25, 0.65, 0.3, 'darkMetal'); bx(mz, 27.2, 0.9, -19.6, 0.5, 0.9, 0.25, 'fadedBlue'); }
      // ---- catwalk rail posts and a ladder; the crane's wall brackets, end trucks, trolley and pendant
      { const cw = O('Catwalk Fittings', 'deco');
        for (let x = -28; x <= 26; x += 3) for (const z of [5.4, 6.6]) post(cw, x, z, 7.55, 8.5, 0.02, 'plasticYellow');
        for (let z = -13; z <= 13; z += 3.25) for (const x of [4.4, 5.6]) post(cw, x, z, 8.65, 9.6, 0.02, 'plasticYellow');
        for (const z of [5.8, 6.2]) post(cw, -28.04, z, 0, 8.5, 0.025, 'galv'); for (let y = 0.4; y < 8.4; y += 0.4) pipe(cw, v3(-28.04, y, 5.8), v3(-28.04, y, 6.2), 0.015, 'galv', NS);
        const cr = O('Crane Fittings', 'deco'); for (let x = -27; x <= 27; x += 6) for (const s of [-1, 1]) bx(cr, x, 9.82, s * 19.8, 0.1, 0.1, 0.2, 'plasticYellow');
        bx(cr, -12, 10.62, 3, 0.45, 0.12, 0.4, 'darkMetal'); for (const s of [-1, 1]) bx(cr, -12, 10.2, s * 19.2, 0.7, 0.22, 0.2, 'darkMetal');
        pipe(cr, v3(-11.6, 9.9, 3.4), v3(-11.6, 1.6, 3.4), 0.012, 'rubberBlack', ND); bx(cr, -11.6, 1.45, 3.4, 0.05, 0.14, 0.035, 'plasticYellow', 0, ND); }
      // ---- new trick objects: two hanging aisle signs and a cable tray (over / unders), and a scissor lift
      for (const [z, m] of [[-9, 'paintBlue'], [3, 'paintGreen']]) { const o = O('Hanging Sign', 'overunder', { obstacle: { a: v3(-3.2, 0, z), b: v3(-0.8, 0, z), under: 4.6, over: 5.4 } });
        box(o, v3(-2, 5.0, z), v3(1.2, 0.4, 0.03), m); for (const s of [-1, 1]) bx(o, -2, 5.0, z + s * 0.035, 0.9, 0.22, 0.004, 'signWhite', 0, ND); for (const dx of [-0.9, 0.9]) pipe(o, v3(-2 + dx, 5.4, z), v3(-2 + dx, 11.71, z), 0.012, 'chain', ND); }
      { const o = slabOU('Cable Tray', v3(18, 6.2, 12), v3(0.25, 0.04, 4.5), 'galv'); for (const s of [-1, 1]) bx(o, 18 + s * 0.24, 6.27, 12, 0.012, 0.05, 4.5, 'galv'); for (const z of [9, 15]) pipe(o, v3(18, 6.24, z), v3(18, 11.71, z), 0.012, 'galv', ND);
        for (const dx of [-0.12, 0, 0.12]) pipe(o, v3(18 + dx, 6.27, 7.6), v3(18 + dx, 6.27, 16.4), 0.02, 'rubberBlack', ND); }
      { const sl = O('Scissor Lift', 'deco'), x = 22, z = 8;
        bx(sl, x, 0.4, z, 0.6, 0.25, 1.15, 'paintOrange'); for (const sx of [-1, 1]) for (const dz of [-0.8, 0.8]) pipe(sl, v3(x + sx * 0.5, 0.2, z + dz), v3(x + sx * 0.68, 0.2, z + dz), 0.2, 'tire', NS);
        for (const sx of [-1, 1]) for (const [za, zb] of [[-1, 1], [1, -1]]) for (const [ya, yb] of [[0.65, 1.75], [1.75, 2.85]]) pipe(sl, v3(x + sx * 0.5, ya, z + za), v3(x + sx * 0.5, yb, z + zb), 0.03, 'paintOrange', NS);
        bx(sl, x, 2.9, z, 0.65, 0.05, 1.25, 'metalPlate'); for (const sx of [-1, 1]) for (const dz of [-1.2, 0, 1.2]) post(sl, x + sx * 0.62, z + dz, 2.95, 4.0, 0.02, 'paintOrange');
        for (const sx of [-1, 1]) pipe(sl, v3(x + sx * 0.62, 4.0, z - 1.2), v3(x + sx * 0.62, 4.0, z + 1.2), 0.02, 'paintOrange', NS); for (const dz of [-1.2, 1.2]) pipe(sl, v3(x - 0.62, 4.0, z + dz), v3(x + 0.62, 4.0, z + dz), 0.02, 'paintOrange', NS);
        bx(sl, x + 0.55, 3.5, z + 1.14, 0.1, 0.1, 0.08, 'darkMetal'); }
      // ---- on the floor: pallet stacks, wrapped pallets, drums, totes, bins, cones, a pallet jack, barriers, shelving, a scrubber, the charger
      { const sc = O('Pallet Stack', 'deco'); for (const [x, z, n] of [[-28.6, 2.2, 7], [-28.6, 3.6, 5], [28.4, 18.4, 6], [-5.2, -18.6, 4]]) for (let k = 0; k < n; k++) bx(sc, x, 0.07 + k * 0.15, z, 0.6, 0.07, 0.5, 'wood', (r2() - 0.5) * 0.12);
        const wp = O('Wrapped Pallet', 'deco'); for (const [x, z] of [[-21, 12.6], [-14, 12], [-12.4, 13.7], [-26.6, 13.2], [28.2, 3.5], [28.2, 5.0]]) { const hh = 0.35 + r2() * 0.3, m = pick(['cardboard', 'signWhite', 'cardboard', 'fadedBlue']); bx(wp, x, 0.07, z, 0.6, 0.07, 0.5, 'wood'); bx(wp, x, 0.14 + hh, z, 0.52, hh, 0.44, m); }
        const dr = O('Drums', 'deco'); for (const [x, z] of [[-10.27, 15.76], [-9.72, 15.8], [-10.0, 16.26]]) post(dr, x, z, 0.16, 1.0, 0.25, pick(['paintBlue', 'rust', 'paintBlue']));
        const gl = O('Gaylord Box', 'deco'); bx(gl, 20, 0.14 + 0.45, 16, 0.55, 0.45, 0.48, 'cardboard');
        const ib = O('IBC Tote', 'deco'); for (const z of [-12.2, -10.8]) { bx(ib, 28.3, 0.07, z, 0.6, 0.07, 0.5, 'wood'); bx(ib, 28.3, 0.14 + 0.5, z, 0.5, 0.5, 0.42, 'signWhite'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(ib, 28.3 + sx * 0.53, z + sz * 0.45, 0.14, 1.2, 0.015, 'galv'); for (const sz of [-1, 1]) pipe(ib, v3(27.77, 1.2, z + sz * 0.45), v3(28.83, 1.2, z + sz * 0.45), 0.015, 'galv', NS); }
        const bn = O('Wheelie Bin', 'deco'); for (const [x, z, m] of [[-9.2, 19.4, 'dumpster'], [11.6, 19.4, 'dumpster'], [29.2, -13.6, 'darkMetal'], [-29.2, 17.6, 'dumpster']]) { bx(bn, x, 0.47, z, 0.3, 0.47, 0.32, m); bx(bn, x, 0.96, z, 0.32, 0.02, 0.34, 'darkMetal'); }
        const cn = O('Traffic Cone', 'deco'); for (const [x, z] of [[7.6, 15.6], [10.4, 15.6], [7.6, 18.4], [10.4, 18.4], [20.6, 6.2], [23.4, 6.2], [20.6, 9.8], [23.4, 9.8], [-2.6, 9.2], [-1.4, 10.4]]) { pipe(cn, v3(x, 0, z), v3(x, 0.32, z), 0.14, 'coneOrange', { cone: true, noSurvey: true }); bx(cn, x, 0.02, z, 0.16, 0.02, 0.16, 'rubberBlack'); }
        const pj = O('Pallet Jack', 'deco'); { const x = -17.2, z = 10.6; bx(pj, x, 0.3, z + 0.75, 0.22, 0.3, 0.12, 'paintRed'); for (const s of [-1, 1]) bx(pj, x + s * 0.2, 0.06, z, 0.07, 0.04, 0.65, 'paintRed'); pipe(pj, v3(x, 0.6, z + 0.8), v3(x, 1.15, z + 1.1), 0.02, 'darkMetal', NS); pipe(pj, v3(x - 0.15, 1.15, z + 1.1), v3(x + 0.15, 1.15, z + 1.1), 0.02, 'darkMetal', NS); }
        const br = O('Barrier', 'deco'); for (const [x, z] of [[-2, 9.8], [3.6, 9.4]]) { bx(br, x, 0.85, z, 0.7, 0.08, 0.02, 'plasticYellow'); for (const s of [-1, 1]) for (const t of [-1, 1]) pipe(br, v3(x + s * 0.6, 0.8, z), v3(x + s * 0.6, 0, z + t * 0.2), 0.015, 'galv', NS); }
        const es = O('Wall Shelving', 'deco'); for (const z of [9.8, 12.3]) { for (const dz of [-1.2, 1.2]) for (const dx of [-0.25, 0.25]) post(es, 29.45 + dx, z + dz, 0, 2.6, 0.03, 'paintBlue'); for (const y of [0.2, 1.0, 1.8, 2.58]) { bx(es, 29.45, y, z, 0.28, 0.02, 1.22, 'metalPlate'); for (let k = 0; k < 3; k++) { const on = r2() < 0.8, hh = 0.14 + r2() * 0.2, w = 0.24 + r2() * 0.1, m = pick(['cardboard', 'wood', 'cardboard', 'dumpster']); if (on && y < 2.5) bx(es, 29.45, y + 0.02 + hh, z - 0.8 + k * 0.8, 0.22, hh, w, m); } } }
        const fs = O('Floor Scrubber', 'deco'); bx(fs, -1.6, 0.4, -19.0, 0.35, 0.37, 0.5, 'paintBlue'); bx(fs, -1.6, 0.06, -18.4, 0.4, 0.05, 0.12, 'rubberBlack'); pipe(fs, v3(-1.6, 0.7, -19.4), v3(-1.6, 1.05, -19.6), 0.02, 'darkMetal', NS);
        const ch = O('Charger', 'deco'); bx(ch, 6.4, 0.9, 19.8, 0.35, 0.5, 0.2, 'paintGreen'); pipe(ch, v3(6.75, 0.6, 19.7), v3(8.5, 0.05, 18.2), 0.015, 'rubberBlack', ND); }
      // ---- floor paint: hazard bars in the doorways, the forklift's bay, a walkway from the stairs down the middle aisle
      { const m = O('Floor Marking', 'deco'), ln = (x, z, hx, hz, mat = 'plasticYellow') => box(m, v3(x, 0.008, z), v3(hx, 0.004, hz), mat, 0, 0, 0, ND);
        for (const d of [-16, 0, 16]) for (let k = -3; k <= 3; k++) ln(d + k * 0.6, Z - 0.5, 0.15, 0.4);
        ln(9, 15.3, 1.3, 0.04); ln(9, 18.7, 1.3, 0.04); ln(7.7, 17, 0.04, 1.7); ln(10.3, 17, 0.04, 1.7);
        for (const x of [0.6, 2.2]) ln(x, -2.75, 0.03, 10.75, 'signWhite'); for (let z = -13; z <= 8; z += 1.5) ln(1.4, z, 0.5, 0.12, 'signWhite'); }
      // ---- lock rods on the container doors (drawn only, 2 cm proud)
      { const cd = O('Container Doors', 'deco'); for (const [cx, cy, cz, ry] of [[8, 0, -9, 0], [8, 2.6, -9, 0], [16, 0, -9, 0], [24, 0, -4, 1], [24, 2.6, -4, 1], [24, 5.2, -4, 1]]) for (const e of [-1, 1]) for (const k of [-0.85, -0.3, 0.3, 0.85]) {
          if (ry === 0) pipe(cd, v3(cx + e * 3.02, cy + 0.12, cz + k), v3(cx + e * 3.02, cy + 2.48, cz + k), 0.018, 'galv', ND); else pipe(cd, v3(cx + k, cy + 0.12, cz + e * 3.02), v3(cx + k, cy + 2.48, cz + e * 3.02), 0.018, 'galv', ND); } }
      // ---- the yard: dock steps, bollards and levellers, a box truck at door 3, a fence with a gate, two light poles, dumpsters, pallets
      { const yd = O('Dock Fittings', 'deco'), ZD = Z + T;
        for (let i = 0; i < 4; i++) bx(yd, 22.6, (i + 1) * 0.15, 23.12 - i * 0.36, 0.6, (i + 1) * 0.15, 0.18, 'concrete');
        post(yd, 23.2, 23.12, 0.3, 1.2, 0.02, 'plasticYellow'); post(yd, 23.2, 22.04, 1.2, 2.1, 0.02, 'plasticYellow'); pipe(yd, v3(23.2, 1.2, 23.12), v3(23.2, 2.1, 22.04), 0.02, 'plasticYellow', NS);
        for (const d of [-16, 0, 16]) { for (const s of [-1, 1]) post(yd, d + s * 2.7, ZD + 3.5, 0, 1.0, 0.09, 'plasticYellow'); bx(yd, d, 1.208, ZD + 1.2, 1.7, 0.008, 1.0, 'metalPlate', 0, ND); bx(yd, d + 2.6, 5.2, ZD + 0.08, 0.15, 0.08, 0.08, 'fluoro', 0, { noCollide: true, glow: true }); }
        const bt = O('Box Truck', 'overunder', { obstacle: { a: v3(16, 0, 26.2), b: v3(16, 0, 31.4), under: 1.04, over: 3.9 } });   /* crossed sideways, between the axles (lengthwise the wheels are in the way) */
        box(bt, v3(16, 2.55, 27.6), v3(1.2, 1.35, 3.6), 'metalPlate'); box(bt, v3(16, 1.12, 28.6), v3(1.05, 0.08, 4.6), 'darkMetal', 0, 0, 0, NS); box(bt, v3(16, 1.85, 32.5), v3(1.15, 0.85, 0.85), 'paintBlue', 0, 0, 0, NS); bx(bt, 16, 2.2, 33.36, 0.95, 0.35, 0.01, 'glass', 0, ND);
        for (const z of [25.4, 32.4]) { for (const s of [-1, 1]) pipe(bt, v3(16 + s * 0.8, 0.5, z), v3(16 + s * 1.05, 0.5, z), 0.5, 'tire', NS); bx(bt, 16, 0.85, z, 0.8, 0.2, 0.12, 'darkMetal'); }
        O('Box Truck underside', 'gap', { gap: { c: v3(16, 0.52, 28.9), n: v3(1, 0, 0), hu: 2.6, hv: 0.42, u: v3(0, 0, 1) } });
        const fn = O('Yard Fence', 'deco'), FZ = 37.6, FX = 29.6; for (const [a, b] of [[-FX, -4], [4, FX]]) box(fn, v3((a + b) / 2, 1.1, FZ), v3((b - a) / 2, 1.1, 0.03), 'chainlink', 0, 0, 0, NS);
        for (const s of [-1, 1]) box(fn, v3(s * FX, 1.1, (ZD + FZ) / 2), v3(0.03, 1.1, (FZ - ZD) / 2), 'chainlink', 0, 0, 0, NS);
        for (let x = -FX; x <= FX + 0.01; x += 3.7) if (Math.abs(x) > 4.2) post(fn, x, FZ, 0, 2.3, 0.04, 'galv');
        const gt = bar('Yard Gate', v3(-4, 3.4, FZ), v3(4, 3.4, FZ), 0.06, 'paintBlue'); for (const s of [-1, 1]) post(gt, s * 4, FZ, 0, 3.4, 0.07, 'paintBlue');
        for (const s of [-1, 1]) { const lp = O('Yard Light', 'pole'); pipe(lp, v3(s * 26, 0, 31), v3(s * 26, 7.5, 31), 0.09, 'galv'); pipe(lp, v3(s * 26, 7.5, 31), v3(s * 24.6, 7.7, 31), 0.04, 'galv', NS); box(lp, v3(s * 24.4, 7.62, 31), v3(0.35, 0.06, 0.16), 'fluoro', 0, 0, 0, { noSurvey: true, glow: true }); }
        const dm = O('Dumpster', 'deco'); for (const z of [26, 28.4]) { bx(dm, 27.6, 0.62, z, 0.75, 0.6, 1.0, 'dumpster'); bx(dm, 27.6, 1.25, z, 0.78, 0.03, 1.03, 'darkMetal'); }
        const yp = O('Pallet Stack', 'deco'); for (const [x, z, n] of [[-26.5, 24.6, 6], [-25, 24.8, 3], [8.5, 24.4, 4]]) for (let k = 0; k < n; k++) bx(yp, x, 0.07 + k * 0.15, z, 0.6, 0.07, 0.5, 'wood', (r2() - 0.5) * 0.15);
        const yc = O('Traffic Cone', 'deco'); for (const [x, z] of [[13.6, 34.6], [18.4, 34.6], [-19, 36.6], [-13, 36.6]]) { pipe(yc, v3(x, 0, z), v3(x, 0.32, z), 0.14, 'coneOrange', { cone: true, noSurvey: true }); bx(yc, x, 0.02, z, 0.16, 0.02, 0.16, 'rubberBlack'); } } }
    void frame;
    const zones = [{ shape: 'zone', mat: 'concrete', c: v3(0, 0.005, 0), h: v3(X, 0, Z) }, { shape: 'zone', mat: 'asphalt', c: v3(0, 0.004, Z + 9), h: v3(X, 0, 9) }];
    return K.done({ id: 'warehouse', title: 'More Warehouse', theme: 'industrial', zones, belts, spawn: { pos: v3(0, 0.03, 16), yaw: 0 }, bounds: { x: [-X, X], z: [-Z, Z + 18] } });
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
    box(hall, v3(0, 4.4 + (HH - 4.4) / 2, HZ1 + 0.2), v3(HX + 0.4, (HH - 4.4) / 2, 0.2), 'vConcrete', 0, 0, 0, { graffiti: 'south', art: [{ name: 'clappy', x: 0.07, y: 3.0, h: 4.4, rot: -0.04 }, { name: 'roguemonkey', x: 0.19, y: 3.2, h: 2.3, rot: 0.02 }, { name: 'mopenguinz', x: 0.31, y: 3.0, h: 4.0, rot: 0.03 }, { name: 'fpvyourworld', x: 0.43, y: 3.0, h: 3.8, rot: -0.02 },
      { name: 'heyhey', x: 0.56, y: 3.1, h: 3.8, rot: 0.02 }, { name: 'ridgeripper', x: 0.69, y: 3.3, h: 1.6, rot: -0.03 }, { name: 'byteme', x: 0.81, y: 3.0, h: 4.2, rot: -0.03 }, { name: 'rwdc', x: 0.93, y: 2.9, h: 4.0, rot: 0.05 }] });
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
    // power lines count as over/unders (owner, 2026-11-19): the skyline's wires (drawn by worldview.js: 8.6 and 8.2 m at the
    // poles, sagging 0.6 m in the middle of each span) get one over/under per span, under the lowest sag, over the highest wire
    for (const [x0, x1] of [[-30, 0], [0, 30]]) O('Power Lines', 'overunder', { obstacle: { a: v3(x0, 0, 30), b: v3(x1, 0, 30), under: 7.5, over: 8.7 } });
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
      // the sign (owner, 2026-11-19): a solid panel hung off the lower rail on four short straps, the Metal Craft FPV logo on both
      // faces (assets/flags/metalcraft.webp, the pilot's own mark, added at the owner's request for this game only)
      { const W = 2.6, H = 0.9, cy = 3.06 - 0.06 - H / 2, sb = makeBox(v3(-5.2, cy, z), v3(W / 2, H / 2, 0.02)); sb.leaf = true; o.prims.push(sb);
        o.vis.push({ shape: 'box', c: v3(-5.2, cy, z), h: v3(W / 2, H / 2, 0.02), mat: 'metal', euler: [0, 0, 0] });
        for (const s of [1, -1]) o.vis.push({ shape: 'sign', c: v3(-5.2, cy, z + s * 0.023), w: W, h: H, ry: s > 0 ? 0 : Math.PI, mat: 'signMetalcraft' });
        for (const dx of [-1.15, -0.4, 0.4, 1.15]) pipe(o, v3(-5.2 + dx, cy + H / 2, z), v3(-5.2 + dx, 3.08, z), 0.012, 'galv', { noSurvey: true }); }
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
  function natureKit(K, rr, rnd, trees = [], houses = [], style = {}) {
    const { O, box, pipe, ball, coneSolid } = K;
    const conifer = (x, z, h, r, kind) => { const o = O(kind === 'cedar' ? 'Cedar' : 'Hemlock', r <= 0.25 ? 'pole' : 'tree'), base0 = h * (kind === 'cedar' ? rr(0.16, 0.26) : rr(0.22, 0.32)), R0 = Math.min(3.2, h * 0.13 + r * 1.2),
        base = style.tall ? Math.min(h * 0.5, base0 * 1.55) : base0, R = style.tall ? R0 * 0.8 : R0;   // style.tall (Moose, after the owner's FPV video, 2026-11-19): bare trunks higher up, slimmer crowns, more sky between them
      pipe(o, v3(x, 0, z), v3(x, h * 0.55, z), r, 'cedarBark'); pipe(o, v3(x, h * 0.55, z), v3(x, h * 0.92, z), r * 0.6, 'cedarBark', { noCollide: true });
      pipe(o, v3(x, 0, z), v3(x, 0.5 + r, z), r * 1.7, 'cedarBark', { cone: true, noCollide: true });   // the flare at the foot
      const leaf = kind === 'cedar' ? 'cedarLeaf' : 'hemlockLeaf', n = 3;
      for (let i = 0; i < n; i++) { const y0 = base + (h - base) * i / n * 0.85, y1 = Math.min(h, y0 + (h - base) * 0.55), Ri = R * (1 - i * 0.26); pipe(o, v3(x, y0, z), v3(x, y1, z), Ri, leaf, { cone: true, noCollide: true }); coneSolid(o, v3(x, y0, z), v3(x, y1, z), Ri); }
      { const c = S.makeCapsule(v3(x, h * 0.55, z), v3(x, h * 0.92, z), r * 0.6); c.leaf = true; o.prims.push(c); }   // the upper trunk inside the crown
      o.round = { c: v3(x, 0, z), r: R, under: base, over: h }; o.obstacle = { a: v3(x - R, 0, z), b: v3(x + R, 0, z), under: base, over: h };
      trees.push({ x, z, r: Math.max(R0 * 0.5, 1.2) }); return o; };   /* R0: the spacing of the grove is as it was (same trees, same places) */
    // Birch: the trunk ends inside the top clump of leaves and a thin branch reaches every other clump (pilot: the trunk
    // stuck out of the crown). split: two trunks from one foot in a V (the pilot's photo), each with its own crown, and the
    // opening between them is a gap. undefined = the map decides from the spot (a hash, so the map's random numbers, and
    // with them every other tree's place, stay as they were).
    const spot = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };
    const birch = (x, z, h, split) => { if (split === undefined) split = spot(x, z) < 0.35;
      // After the pilot's reference photos: slender white trunks that taper, branches reaching up and out from the upper
      // two thirds, a small clump of leaves at each tip: an airy crown, not a few big balls. The map's random draws are
      // made exactly as before (so every later tree keeps its place); the shape comes from its own seed (the spot).
      const o = O(split ? 'Split Birch' : 'Birch', 'pole'), lx = rr(-0.6, 0.6), lz = rr(-0.6, 0.6); for (let i = 0; i < 4; i++) { rr(-1, 1); rr(0.62, 0.95); rr(-1, 1); rr(0.9, 1.4); }
      let sd = (Math.floor(spot(x * 1.3 + 7, z * 0.7 - 3) * 4294967295) >>> 0) || 1; const rn = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }, rg = (a, b) => a + (b - a) * rn();
      const lerp = (a, b, f) => v3(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f), stems = [];
      if (!split) stems.push({ foot: v3(x, 0, z), top: v3(x + lx, h, z + lz), r: 0.12 });
      else { const a = spot(z, x) * Math.PI * 2, sx = 0.9 + 0.5 * spot(x + 1, z), d = v3(Math.cos(a), 0, Math.sin(a)), fork = v3(x, 0.35, z); pipe(o, v3(x, 0, z), fork, 0.15, 'birchBark');
        for (const k of [-1, 1]) stems.push({ foot: fork, top: v3(x + lx * 0.5 + d.x * sx * k * 2.1, h * (k < 0 ? 0.97 : 0.86), z + lz * 0.5 + d.z * sx * k * 2.1), r: 0.095 });   /* a V wide enough to fly between the stems */
        const Y = Math.min(stems[0].top.y, stems[1].top.y), y0 = Y * 0.17, y1 = Y * 0.31,   /* below the lowest branches (they start at 0.34) */ at = (st, y) => lerp(st.foot, st.top, (y - st.foot.y) / (st.top.y - st.foot.y));
        const A0 = at(stems[0], y0), B0 = at(stems[1], y0), w0 = Math.hypot(A0.x - B0.x, A0.z - B0.z);
        const hu = w0 / 2 - 0.095 - 0.07; if (hu >= 0.12) o.gapAfter = { c: v3((A0.x + B0.x) / 2, (y0 + y1) / 2, (A0.z + B0.z) / 2), n: v3(-d.z, 0, d.x), hu, hv: (y1 - y0) / 2 - 0.05, u: d }; }   /* the V is narrowest at the bottom: measured there, less both trunks and a margin */
      for (const st of stems) { const mid = lerp(st.foot, st.top, 0.55); mid.x += rg(-0.15, 0.15); mid.z += rg(-0.15, 0.15);   // a slight bow, tapering
        pipe(o, st.foot, mid, st.r, 'birchBark'); pipe(o, mid, st.top, st.r * 0.62, 'birchBark', { leafSolid: true });
        const at = f => f < 0.55 ? lerp(st.foot, mid, f / 0.55) : lerp(mid, st.top, (f - 0.55) / 0.45), nb = split ? 7 : 9, ph = rg(0, Math.PI * 2);
        for (let i = 0; i < nb; i++) { const f = 0.34 + 0.56 * i / (nb - 1) + rg(-0.04, 0.04), base = at(f), ang = ph + i * 2.4 + rg(-0.3, 0.3), tilt = rg(38, 62) * Math.PI / 180, len = rg(2.4, 3.6) * (1.25 - f * 0.6) * h / 12;
          const tip = v3(base.x + Math.sin(tilt) * Math.cos(ang) * len, base.y + Math.cos(tilt) * len, base.z + Math.sin(tilt) * Math.sin(ang) * len), lr = rg(0.55, 0.9);
          pipe(o, base, tip, 0.04, 'birchBark', { leafSolid: true }); ball(o, tip, lr, 'birchLeaf', { leafSolid: true }); ball(o, lerp(base, tip, 0.6), lr * 0.75, 'birchLeaf', { leafSolid: true }); }
        ball(o, st.top, rg(0.6, 0.85), 'birchLeaf', { leafSolid: true }); }
      if (o.gapAfter) { const g = o.gapAfter; delete o.gapAfter; O('Split Birch opening', 'gap', { gap: g }); }
      trees.push({ x, z, r: 1.4 }); return o; };   /* same spacing as before: every other tree keeps its place */
    const shade = (x, z, h) => { const o = O('Maple', 'tree'), base = h * 0.32, R = h * 0.28;
      // a limb from the top of the trunk into every clump of leaves (pilot: leaves floated with no branch)
      pipe(o, v3(x, 0, z), v3(x, base + 1, z), 0.28, 'bark'); const fork = v3(x, base + 0.8, z);
      for (const [a, b, c, s] of [[0, 0.75, 0, 1], [0.9, 0.62, 0.5, 0.75], [-0.9, 0.6, -0.4, 0.8], [0.2, 0.55, -1, 0.7]]) { const q = v3(x + a * R, h * b, z + c * R); ball(o, q, R * 0.62 * s, 'mapleLeaf', { leafSolid: true });
        pipe(o, fork, v3(fork.x + (q.x - fork.x) * 0.8, fork.y + (q.y - fork.y) * 0.8, fork.z + (q.z - fork.z) * 0.8), a === 0 && c === 0 ? 0.2 : 0.13, 'bark', { leafSolid: true }); }
      o.round = { c: v3(x, 0, z), r: R, under: base + 0.6, over: h }; o.obstacle = { a: v3(x - R, 0, z), b: v3(x + R, 0, z), under: base + 0.6, over: h };
      trees.push({ x, z, r: R * 0.6 }); return o; };
    const picnic = (x, z, ry) => { const o = O('Picnic Table', 'deco'), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, y, z - u * s + w * c);
      box(o, P(0, 0.76, 0), v3(0.9, 0.035, 0.38), 'oldWood', ry); for (const w of [-0.68, 0.68]) box(o, P(0, 0.45, w), v3(0.9, 0.03, 0.15), 'oldWood', ry);
      for (const u of [-0.65, 0.65]) for (const w of [-0.6, 0.6]) pipe(o, P(u, 0, w), P(u, 0.74, w * 0.3), 0.025, 'darkMetal'); };
    const house = (x, z, W, D, ry, col) => { const o = O('House', 'building', { tall: 6 }), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, y, z - u * s + w * c), H = 2.9;
      box(o, P(0, H / 2, 0), v3(W / 2, H / 2, D / 2), col, ry);
      if (style.lowRoof) {   // Moose (the owner's photos, 2026-11-19): low single-storey ranch houses under a shallow gable roof (22°)
        const th = 22 * Math.PI / 180, tn = Math.tan(th), rise = D / 2 * tn, L = D / 2 + 0.5, hw = (D / 2) / 2 / Math.cos(th), ht = rise * Math.cos(th) / 2 + 0.05;
        // the gable: two boxes laid along the roof's slopes, their tops under the roof panels and their lower halves inside the walls
        for (const sgn of [-1, 1]) box(o, P(0, H + rise - (D / 4) * tn - ht / Math.cos(th), sgn * D / 4), v3(W / 2, ht, hw), col, ry, sgn * th);
        for (const sgn of [-1, 1]) box(o, P(0, H + rise - L / 2 * tn + 0.08, sgn * L / 2), v3(W / 2 + 0.35, 0.07, L / (2 * Math.cos(th)) + 0.04), 'roofDark', ry, sgn * th);
        box(o, P(W * 0.25, H + rise * 0.7, -0.6), v3(0.3, 0.7, 0.3), 'brick', ry);
      } else { const sq = D / 2 / Math.SQRT2; box(o, P(0, H, 0), v3(W / 2, sq, sq), col, ry, Math.PI / 4);   // the gable fill
        const e = D / 2 + 0.5, dl = Math.hypot(e, e) / 2; for (const sgn of [-1, 1]) box(o, P(0, H + D / 2 - e / 2 + 0.05, sgn * e / 2), v3(W / 2 + 0.35, 0.07, dl), 'roofDark', ry, sgn * Math.PI / 4);
        box(o, P(W * 0.25, H + D / 2 - 0.4, -0.6), v3(0.3, 0.9, 0.3), 'brick', ry); }   // chimney
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
    for (const L of lanes) zones.push({ shape: 'zone', mat: 'dryGrass', c: L.c, h: v3(L.len, 0, L.w), ry: L.ry });   // dry, patchy winter lawn (the owner's photos, 2026-11-19)
    zones.push({ shape: 'zone', mat: 'dryGrass', c: v3(-36, 0.005, 0), h: v3(9, 0, 12) });                       // open ground round the playground
    zones.push({ shape: 'zone', mat: 'path', c: v3(-4, 0.006, 6.5), h: v3(40, 0, 0.6), ry: 0.2 });           // the worn trail along the south lane
    zones.push({ shape: 'zone', mat: 'path', c: v3(10, 0.006, -9), h: v3(26, 0, 0.5), ry: 0.12 });
    zones.push({ shape: 'zone', mat: 'leafLitter', c: v3(37, 0.0055, 15), h: v3(10, 0, 9) }); zones.push({ shape: 'zone', mat: 'leafLitter', c: v3(-40, 0.0055, -17), h: v3(6, 0, 6.5) });   // fallen leaves at the birch corners
    zones.push({ shape: 'zone', mat: 'path', c: v3(38.4, 0.0062, 17.4), h: v3(3.4, 0, 3.4), ry: 0.4 });   // the bare dirt mound under the tire ring
    zones.push({ shape: 'zone', mat: 'woodchip', c: v3(-35, 0.007, 1), h: v3(8, 0, 5.5) });
    zones.push({ shape: 'zone', mat: 'asphalt', c: v3(0, 0.003, -30), h: v3(90, 0, 4) });                     // Arrow Dr
    zones.push({ shape: 'zone', mat: 'asphalt', c: v3(-52, 0.003, 0), h: v3(4, 0, 70) });                     // Park Dr
    zones.push({ shape: 'zone', mat: 'gravel', c: v3(0, 0.0035, -25.4), h: v3(46, 0, 0.6) }); zones.push({ shape: 'zone', mat: 'gravel', c: v3(-47.4, 0.0035, 0), h: v3(0.6, 0, 24) });   // gravel shoulders
    const inLane = (x, z, pad = 0) => lanes.some(L => { const dx = x - L.c.x, dz = z - L.c.z, c = Math.cos(L.ry), s = Math.sin(L.ry), u = dx * c - dz * s, w = dx * s + dz * c; return Math.abs(u) < L.len + pad && Math.abs(w) < L.w + pad; });
    // ---- trees. Conifers: a flared trunk bare for the first few metres, then stacked drooping cones. Over/under under the
    // lowest boughs; slim trunks are poles to orbit. Flying into the middle of a crown hits it; brushing its edge does not.
    const trees = [], houses = [], { conifer, birch, shade, picnic, house, truck } = natureKit(K, rr, rnd, trees, houses, { tall: true, lowRoof: true });
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
    { for (let k = 0; k < 70; k++) { const x = rr(-PX + 1, PX - 1), z = rr(-PZ + 1, PZ - 1); if (inLane(x, z, 1) || !free(x, z)) continue; const sh = O(x > 24 ? 'Bracken' : 'Shrub', 'deco'); ball(sh, v3(x, 0.25, z), rr(0.35, 0.7), x > 24 ? 'bracken' : 'shrub', { leafSolid: true }); } }
    { for (const [x, z, a, l] of [[-8, 18, 0.4, 3.2], [12, -21, 1.2, 2.6], [32, 14, 2.4, 4]]) pipe(O('Mossy Log', 'deco'), v3(x, 0.22, z), v3(x + Math.cos(a) * l, 0.2, z + Math.sin(a) * l), 0.22, 'mossLog'); }
    { for (const [x, z, r] of [[-20, 4.5, 0.4], [9, -5, 0.35], [-2, 12.5, 0.45], [24, 2.5, 0.3]]) pipe(O('Stump', 'deco'), v3(x, 0, z), v3(x, 0.35, z), r, 'cedarBark'); }
    // ---- the playground (west end): a timber border round wood chips
    { const b = O('Playground Border', 'deco'); for (const [c, h] of [[v3(-35, 0.11, -4.5), v3(8.14, 0.11, 0.14)], [v3(-35, 0.11, 6.5), v3(8.14, 0.11, 0.14)], [v3(-43, 0.11, 1), v3(0.14, 0.11, 5.5)], [v3(-27, 0.11, 1), v3(0.14, 0.11, 5.5)]]) box(b, c, h, 'oldWood'); }   // a chunky timber curb, as in the video
    // the A-frame swing set: faded blue legs, a 2.4 m top bar along x, two belt swings on chains
    together(() => { const x0 = -40, x1 = -35.6, z = -1.2, H = 2.4, sw = bar('Swing Set', v3(x0, H, z), v3(x1, H, z), 0.045, 'fadedBlue');
      for (const x of [x0, x1]) for (const s of [-1, 1]) pipe(sw, v3(x, H, z), v3(x + (x === x0 ? -0.35 : 0.35), 0, z + s * 1.25), 0.04, 'fadedBlue');
      for (const x of [x0 + 1.2, x1 - 1.2]) { for (const s of [-0.22, 0.22]) pipe(sw, v3(x + s, H, z), v3(x + s, 0.5, z), 0.008, 'chain', { noCollide: true }); box(sw, v3(x, 0.47, z), v3(0.17, 0.025, 0.14), 'rubberBlack', 0, 0, 0, { noCollide: true });   /* black bucket seats, as at the real park */
        for (const s of [-1, 1]) { box(sw, v3(x, 0.56, z + s * 0.14), v3(0.17, 0.09, 0.02), 'rubberBlack', 0, 0, 0, { noCollide: true }); box(sw, v3(x + s * 0.17, 0.56, z), v3(0.02, 0.09, 0.14), 'rubberBlack', 0, 0, 0, { noCollide: true }); } }
      O('Swing Set opening', 'gap', { gap: { c: v3((x0 + x1) / 2, H / 2, z), n: v3(0, 0, 1), hu: (x1 - x0) / 2 - 0.1, hv: H / 2 - 0.05, u: v3(1, 0, 0) } }); });
    // the small multi-play unit: tan posts, a deck 1.2 m up under a faded red roof, steps on the south, a faded blue slide
    // east, and a short run of climbing bars on the north side
    together(() => { const cx = -31.6, cz = 3.4, D = 1.2, o = O('Play Unit', 'deco');
      for (const [a, b] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(o, v3(cx + a, 1.3, cz + b), v3(0.055, 1.3, 0.055), 'playRed');
      box(o, v3(cx, D, cz), v3(0.8, 0.04, 0.8), 'playYellow');
      O('Under the Play Unit', 'gap', { gap: { c: v3(cx, D / 2, cz), n: v3(1, 0, 0), hu: 0.72, hv: D / 2 - 0.05, u: v3(0, 0, 1) } }); O('Under the Play Unit', 'gap', { gap: { c: v3(cx, D / 2, cz), n: v3(0, 0, 1), hu: 0.72, hv: D / 2 - 0.05, u: v3(1, 0, 0) } });
      const roof = O('Play Unit Roof', 'overunder', { obstacle: { a: v3(cx - 0.95, 0, cz), b: v3(cx + 0.95, 0, cz), under: 2.5, over: 2.85 } });
      box(roof, v3(cx, 2.62, cz - 0.42), v3(0.95, 0.03, 0.5), 'playRed', 0, -0.35); box(roof, v3(cx, 2.62, cz + 0.42), v3(0.95, 0.03, 0.5), 'playRed', 0, 0.35);   // peaked (the tilts were the wrong way round: a V)
      for (const s of [-1, 1]) box(o, v3(cx + s * 0.8, D + 0.45, cz), v3(0.03, 0.4, 0.75), 'playYellow');   // side panels
      for (let i = 0; i < 4; i++) box(o, v3(cx - 0.3, D - (i + 1) * 0.28 + 0.1, cz + 1.0 + i * 0.28), v3(0.42, 0.03, 0.14), 'playYellow');   // steps down to the south, the open side (owner, 2026-11-20: on the west they blocked the slide for powerloops)
      const ang = 0.55, L = D / Math.sin(ang), sl = O('Slide', 'deco');
      box(sl, v3(cx + 0.8 + Math.cos(ang) * L / 2, D / 2 + 0.04, cz + 0.3), v3(L / 2, 0.03, 0.26), 'slideBlue', 0, 0, -ang);
      for (const s of [-1, 1]) box(sl, v3(cx + 0.8 + Math.cos(ang) * L / 2, D / 2 + 0.16, cz + 0.3 + s * 0.27), v3(L / 2, 0.1, 0.02), 'slideBlue', 0, 0, -ang);
      box(sl, v3(cx - 0.8 - Math.cos(ang) * L / 2, D / 2 + 0.04, cz - 0.35), v3(L / 2, 0.03, 0.26), 'slideBlue', 0, 0, ang);   // the second slide, the other way (two blue slides, as now)
      for (const s of [-1, 1]) box(sl, v3(cx - 0.8 - Math.cos(ang) * L / 2, D / 2 + 0.16, cz - 0.35 + s * 0.27), v3(L / 2, 0.1, 0.02), 'slideBlue', 0, 0, ang);
      bar('Climbing Bars', v3(cx - 0.8, 1.9, cz - 0.95), v3(cx - 0.8, 1.9, cz - 2.6), 0.03, 'playRed'); bar('Climbing Bars', v3(cx + 0.8, 1.9, cz - 0.95), v3(cx + 0.8, 1.9, cz - 2.6), 0.03, 'playRed');
      const cb = O('Climbing Bars', 'deco'); for (const s of [-0.8, 0.8]) pipe(cb, v3(cx + s, 0, cz - 2.6), v3(cx + s, 1.9, cz - 2.6), 0.035, 'playRed'); for (let i = 1; i < 6; i++) pipe(cb, v3(cx - 0.8, 1.9, cz - 0.95 - i * 0.28), v3(cx + 0.8, 1.9, cz - 0.95 - i * 0.28), 0.018, 'galv'); });
    // ---- picnic tables (wood on a dark metal frame), benches, bear-resistant bins, the park sign and a carved moose
    picnic(-29.2, -0.6, 0.1); picnic(-21, 5.5, 0.3); picnic(-9, -9, -0.2); picnic(12, 3.5, 0.15); picnic(26, -12.5, 0.4);
    // benches round the playground, 1.8 m outside its timber border, each facing in (owner, 2026-11-19: they stood in it)
    for (const [x, z, ry] of [[-39, 8.3, Math.PI], [-31, 8.3, Math.PI], [-37, -6.3, 0], [-25.2, 1, -Math.PI / 2], [4, -10.4, 0.15]]) { const b = O('Bench', 'deco'), c = Math.cos(ry), s = Math.sin(ry);
      box(b, v3(x, 0.44, z), v3(0.9, 0.03, 0.2), 'oldWood', ry); box(b, v3(x - s * 0.18, 0.75, z - c * 0.18), v3(0.9, 0.12, 0.025), 'oldWood', ry); for (const u of [-0.7, 0.7]) { box(b, v3(x + u * c, 0.22, z - u * s), v3(0.03, 0.22, 0.2), 'darkMetal', ry); box(b, v3(x + u * c - s * 0.2, 0.65, z - u * s - c * 0.2), v3(0.03, 0.22, 0.02), 'darkMetal', ry); } }   /* uprights hold the backrest (it floated over the seat) */
    for (const [x, z] of [[-25.6, -5.8], [-44.4, 7.9], [30.5, -9.5], [0, -18.6]]) { const b = O('Bear Bin', 'deco'); box(b, v3(x, 0.55, z), v3(0.42, 0.55, 0.38), 'binGreen'); box(b, v3(x, 1.13, z), v3(0.44, 0.04, 0.4), 'darkMetal'); }
    { const sg = O('Park Sign', 'deco'), x = -41, z = -21.5; for (const s of [-1, 1]) pipe(sg, v3(x + s * 0.64, 0, z), v3(x + s * 0.64, 2.35, z), 0.035, 'galv');   // two metal posts, a maroon and gold panel up high (the owner's photo)
      box(sg, v3(x, 1.88, z - 0.05), v3(0.6, 0.4, 0.025), 'mooseSign', 0, 0, 0, { sign: true }); }
    { const m = O('Carved Moose', 'deco'), x = -38.2, z = -20.6;   // a chainsaw-carved cedar moose by the sign
      box(m, v3(x, 1.25, z), v3(0.8, 0.38, 0.32), 'carvedCedar'); for (const [a, b] of [[-0.6, -0.2], [-0.6, 0.2], [0.55, -0.2], [0.55, 0.2]]) pipe(m, v3(x + a, 0, z + b), v3(x + a, 0.95, z + b), 0.08, 'carvedCedar');
      pipe(m, v3(x + 0.7, 1.4, z), v3(x + 1.05, 1.75, z), 0.15, 'carvedCedar'); box(m, v3(x + 1.25, 1.65, z), v3(0.3, 0.13, 0.12), 'carvedCedar', 0, 0, -0.3);
      for (const s of [-1, 1]) box(m, v3(x + 1.0, 2.05, z + s * 0.38), v3(0.18, 0.04, 0.3), 'carvedCedar', s * 0.3, s * 0.5); }
    // ---- round the edges: Arrow Dr and Park Dr with houses across them, back fences and houses east and south, wooden
    // power poles, a few parked pickups
    const colors = ['houseSage', 'houseTan', 'houseBlue', 'houseCream', 'houseRed'];
    for (let x = -66; x <= 66; x += 17) house(x + rr(-2, 2), -42, rr(9, 12), rr(7.5, 9), Math.PI, colors[(rnd() * 5) | 0]);            // across Arrow Dr, facing the park
    for (let z = -16; z <= 42; z += 16) house(-63, z + rr(-2, 2), rr(9, 11), rr(7.5, 9), -Math.PI / 2, colors[(rnd() * 5) | 0]);       // across Park Dr
    for (let z = -16; z <= 18; z += 15) house(60, z, rr(9, 11), rr(8, 9), Math.PI / 2, colors[(rnd() * 5) | 0]);                        // east, backing onto the park
    for (let x = -30; x <= 40; x += 16) house(x, 37, rr(9, 12), rr(8, 9), 0, colors[(rnd() * 5) | 0]);                                   // south
    { const f = O('Back Fence', 'deco'); box(f, v3(PX + 2, 0.9, 0), v3(0.03, 0.9, PZ), 'fenceWood'); box(f, v3(4, 0.9, PZ + 2.5), v3(PX - 2, 0.9, 0.03), 'fenceWood');
      for (let z = -PZ; z <= PZ; z += 2.4) pipe(f, v3(PX + 2.05, 0, z), v3(PX + 2.05, 1.85, z), 0.05, 'fenceWood'); for (let x = -PX + 6; x <= PX + 2; x += 2.4) pipe(f, v3(x, 0, PZ + 2.55), v3(x, 1.85, PZ + 2.55), 0.05, 'fenceWood'); }
    for (let x = -40; x <= 44; x += 28) { const p = O('Power Pole', 'pole'); pipe(p, v3(x, 0, -26.8), v3(x, 9, -26.8), 0.14, 'polewood'); box(p, v3(x, 8.4, -26.8), v3(0.06, 0.06, 1.1), 'polewood'); }
    { const w = O('Power Lines', 'deco'); for (const dz of [-0.9, 0, 0.9]) pipe(w, v3(-62, 8.5, -26.8 + dz), v3(62, 8.5, -26.8 + dz), 0.012, 'chain', { noCollide: true }); }
    // each span between the poles (and the runs out to the map's edges) is an over/under (owner, 2026-11-19: "power lines count")
    { const xs = [-62]; for (let x = -40; x <= 44; x += 28) xs.push(x); xs.push(62); for (let i = 1; i < xs.length; i++) O('Power Lines', 'overunder', { obstacle: { a: v3(xs[i - 1], 0, -26.8), b: v3(xs[i], 0, -26.8), under: 8.4, over: 8.62 } }); }
    truck(-50.5, -14, Math.PI / 2, 'truckRed'); truck(-6, -31.8, 0, 'truckGrey'); truck(28, -28.2, Math.PI, 'truckBlue'); truck(-58, 22, Math.PI / 2, 'truckGrey');
    // ---- after the owner's FPV video of the real park (2026-11-19): big conifers crowd the playground's edge and hang over the
    // swings (that is where the trippies are flown), bright broadleaf trees stand among the cedars, and a tall dead snag is a
    // bare pole. Added last with their own random stream, so every tree above keeps its place (and old flights their world).
    { let sd = 9119; const r2 = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }, g2 = (a, b) => a + (b - a) * r2(), N2 = natureKit(K, g2, r2, trees, houses, { tall: true });
      for (const [x, z, h, r, kind] of [[-45.0, -1.6, 30, 0.42, 'cedar'], [-44.9, 4.3, 26, 0.32, 'hemlock'], [-41.4, -6.7, 28, 0.46, 'cedar'], [-33.6, -6.5, 24, 0.3, 'hemlock'],
        [-28.7, -6.4, 31, 0.5, 'cedar'], [-25.3, 5.3, 27, 0.38, 'cedar'], [-35.0, 8.7, 25, 0.4, 'cedar']]) if (clear(x, z, 0.6)) N2.conifer(x, z, h, r, kind);
      { const x = -21.5, z = -10.5; if (clear(x, z, 0.5)) { const o = O('Dead Snag', 'pole'); pipe(o, v3(x, 0, z), v3(x, 22, z), 0.22, 'snagWood'); pipe(o, v3(x, 0, z), v3(x, 0.7, z), 0.4, 'snagWood', { cone: true, noCollide: true });
        for (const [y, a, L] of [[9, 0.4, 1.4], [12.5, 2.6, 1.0], [15, 4.4, 1.6], [18, 1.5, 0.9]]) pipe(o, v3(x, y, z), v3(x + Math.cos(a) * L, y + L * 0.35, z + Math.sin(a) * L), 0.05, 'snagWood', { noSurvey: true });
        trees.push({ x, z, r: 1 }); } }
      for (const [x, z, h] of [[-47.5, 9.5, 11], [-22.5, -8.5, 12], [-46.5, -8.0, 10], [-19.5, 3.5, 11], [-10, 12.5, 12], [6, -21, 11], [20, 10.5, 12], [-2, 16, 10]]) if (clear(x, z, 1.0)) N2.shade(x, z, h); }
    // ---- after the owner's photos from the four corners (2026-11-19). The roads make an L round the north-west corner (Arrow Dr
    // along the long north side, Park Dr along the short west side). Along Arrow Dr a straight row of big redcedars whose crowns
    // touch; the tire tunnel is in the far south-east corner, four tires as separate half-buried arches on a dirt mound under
    // the birches; a double birch stands by the sign. The trees that stood where these go are taken out (the grove's random
    // draws are unchanged, so every other tree keeps its place).
    { const gone = (x, z) => (z < -19.6 && x > -37 && x < 47) || Math.hypot(x - 38.4, z - 17.4) < 4.6 || Math.hypot(x + 43.6, z + 19.2) < 1.6;
      const at = o => { const v = o.vis[0]; return v ? (v.a || v.c) : o.gap ? o.gap.c : null; };
      for (const o of K.objs) { if (o.removed || !/^(Cedar|Hemlock|Birch|Split Birch|Split Birch opening|Maple|Shrub|Bracken|Stump|Mossy Log)$/.test(o.name) || o.grp != null) continue;
        const c = at(o); if (!c || !gone(c.x, c.z)) continue; o.prims = []; o.vis = []; delete o.obstacle; delete o.round; delete o.gap; o.kind = 'deco'; o.removed = true; }
      for (let i = trees.length - 1; i >= 0; i--) if (gone(trees[i].x, trees[i].z)) trees.splice(i, 1);
      let sd = 3141; const r3 = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; }, g3 = (a, b) => a + (b - a) * r3();
      const row = natureKit(K, g3, r3, trees, houses, {});   // full, low crowns: the roadside cedars' boughs come down to 4-6 m
      for (let x = -34; x <= 44; x += g3(5.2, 6.2)) { const z = -22.2 + g3(-0.4, 0.4); if (trees.some(t => Math.hypot(t.x - x, t.z - z) < 2.4)) continue; row.conifer(x, z, g3(26, 33), g3(0.45, 0.6), 'cedar'); }
      row.birch(-43.6, -19.2, 13, true);   // the double birch by the sign
      together(() => { const R = 0.82, t = 0.24, Rm = R - t / 2, N = 11, cx = 38.4, cz = 17.4, RC = 2.2;   // the tire ring (owner, 2026-11-19: the tires form a circle):
        for (let q = 0; q < 4; q++) { const ph = q * Math.PI / 2 + 0.3, tx = -Math.sin(ph), tz = Math.cos(ph), x = cx + RC * Math.cos(ph), z = cz + RC * Math.sin(ph), ry = -ph - Math.PI / 2;   // each arch stands across the ring, so a lap round it threads all four
          const L = (u, y, w) => v3(x + u * Math.cos(ry) + w * Math.sin(ry), y, z - u * Math.sin(ry) + w * Math.cos(ry));
          const o = O('Tire', 'overunder', { obstacle: { a: v3(x - tx * 0.3, 0, z - tz * 0.3), b: v3(x + tx * 0.3, 0, z + tz * 0.3), under: R - t, over: R + t } });
          for (let k = 0; k < N; k++) { const am = (k + 0.5) / N * Math.PI; box(o, L(0, Math.sin(am) * Rm - 0.12, Math.cos(am) * Rm), v3(0.27, Math.PI * Rm / N / 2 + 0.02, t / 2), 'tireTread', ry, -am); }
          O('Tire opening', 'gap', { gap: { c: v3(x, 0.18, z), n: v3(tx, 0, tz), hu: 0.25, hv: 0.15, u: v3(-Math.cos(ph), 0, -Math.sin(ph)) } }); }   // inside the arch (its inner edge is 0.58 m round a centre 0.12 m underground)
        const sp = O('Sign Post', 'pole'); pipe(sp, v3(35.2, 0, 13.6), v3(35.2, 1.6, 13.6), 0.04, 'galv'); box(sp, v3(35.2, 1.55, 13.6), v3(0.16, 0.16, 0.01), 'signWhite', 0, 0, 0, { noCollide: true }); }); }
    // a heart carved in the pilot's big cedar by the playground, facing the picnic tables: CS + AS (owner, 2026-11-19); drawn only,
    // a patch of the trunk's own curve (vis 'bark')
    { const hc = O('Carved Heart', 'deco'), tx = -30.5, tz = -3.2, a = Math.atan2(-24 - tx, 8 - tz); hc.vis.push({ shape: 'bark', c: v3(tx, 1.55, tz), r: 0.555, h: 0.46, ang: a, span: 0.9, mat: 'heartCarving' }); }
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
    o.prims = o.prims.map(p => { const n = p.type === 'box' ? makeBox(T(p.c), v3(p.h.x * s, p.h.y * s, p.h.z * s), p.euler[1] + ry, p.euler[0], p.euler[2]) : p.type === 'capsule' ? makeCapsule(T(p.a), T(p.b), p.r * s) : p.type === 'sphere' ? makeSphere(T(p.c), p.r * s) : p; n.owner = o.id; if (p.leaf) n.leaf = true; return n; });
    o.vis = o.vis.map(v => { const n = { ...v }; if (v.c) n.c = T(v.c); if (v.a) n.a = T(v.a); if (v.b) n.b = T(v.b); if (v.h) n.h = v3(v.h.x * s, v.h.y * s, v.h.z * s); if (v.r != null) n.r = v.r * s; if (v.th != null) n.th = v.th * s; if (v.euler) n.euler = [v.euler[0], v.euler[1] + ry, v.euler[2]]; return n; });
    if (o.obstacle) o.obstacle = { ...o.obstacle, a: T(o.obstacle.a), b: T(o.obstacle.b), under: Y(o.obstacle.under), over: Y(o.obstacle.over), ...(o.obstacle.floor != null ? { floor: Y(o.obstacle.floor) } : {}) };
    if (o.round) { const r = { ...o.round, c: T(o.round.c), r: o.round.r * s, under: Y(o.round.under), over: Y(o.round.over) }; delete r.box; o.round = r; }
    if (o.gap) o.gap = { ...o.gap, c: T(o.gap.c), n: D(o.gap.n), u: o.gap.u ? D(o.gap.u) : o.gap.u, hu: o.gap.hu * s, hv: o.gap.hv * s };
    if (o.light) o.light = T(o.light); if (o.wallNormal) o.wallNormal = D(o.wallNormal); if (o.tall) o.tall *= s;
  }
  // The asset library: what the editor can place. Each is built at the origin, standing on the ground, facing -z.
  const ASSETS = {
    'Cedar': (K, N) => N.conifer(0, 0, 24, 0.3, 'cedar'), 'Big Cedar': (K, N) => N.conifer(0, 0, 27, 0.55, 'cedar'), 'Young Cedar': (K, N) => N.conifer(0, 0, 11, 0.16, 'cedar'),
    'Hemlock': (K, N) => N.conifer(0, 0, 22, 0.24, 'hemlock'), 'Birch': (K, N) => N.birch(0, 0, 12, false), 'Split Birch': (K, N) => N.birch(0, 0, 11, true), 'Maple': (K, N) => N.shade(0, 0, 11),
    'Sakura Tree': K => { const tr = K.O('Sakura Tree', 'pole'); tr.round = { c: v3(0, 0, 0), r: 1.8, under: 2.2, over: 5.0 }; tr.obstacle = { a: v3(-1.8, 0, 0), b: v3(1.8, 0, 0), under: 2.2, over: 5.0 };
      K.pipe(tr, v3(0, 0, 0), v3(0, 2.9, 0), 0.14, 'bark'); K.ball(tr, v3(0, 3.7, 0), 1.4, 'blossom'); K.ball(tr, v3(0.9, 3.2, 0.4), 0.9, 'blossom'); K.ball(tr, v3(-0.8, 3.4, -0.5), 1.0, 'blossom'); },
    'Shrub': K => K.ball(K.O('Shrub', 'deco'), v3(0, 0.25, 0), 0.6, 'shrub', { leafSolid: true }), 'Bracken': K => K.ball(K.O('Bracken', 'deco'), v3(0, 0.25, 0), 0.6, 'bracken', { leafSolid: true }),
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
    const K = kit(w); let seed = 77; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, N = natureKit(K, (a, b) => a + (b - a) * rnd(), rnd);   /* reseeded per asset: every library tree looks the same each time, and natural */
    if ((Array.isArray(E.added) ? E.added : []).some(a => a && !ASSETS[a.asset])) catalog();
    (Array.isArray(E.added) ? E.added : []).slice(0, 3000).forEach((a, ai) => { const make = ASSETS[a && a.asset]; if (!make) { applied.lost++; return; }
      const n0 = w.objs.length; seed = 77; make(K, N); const made = w.objs.slice(n0), g = made.length > 1 ? made[0].id : null;
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
  // Every piece of every map is in the library too (pilot: "it doesn't list all of the assets"): the first piece of each
  // name, copied exactly as it stands in its map (shapes, looks, tags, lights) and set down at the origin. Not the ground,
  // the shells of buildings and halls, map edges, or anything over 40 m across. Built once, on first use, from the maps as
  // generated (no layouts), so it never depends on anyone's edits. Hand-made assets above keep their names.
  const RAW = { moose: () => buildMoose(), school: () => buildSchool(), clappy: () => buildClappy(), warehouse: () => buildWarehouse(), ship: () => buildShip(), playground: () => addPlaygroundExtras(S.buildPlayground()) };
  let CATALOG = null;
  function catalog() {
    if (CATALOG) return CATALOG; CATALOG = { byMap: {} };
    for (const [mid, mk] of Object.entries(RAW)) { let w; try { w = mk(); } catch { continue; } const list = CATALOG.byMap[mid] = [];
      for (const pc of mapPieces(w)) { const o0 = w.objs[pc.ids[0]]; if (!pc.size || ASSETS[pc.name] || /opening$|edge$/.test(pc.name) || ['edge', 'ground', 'zone'].includes(o0.kind)) continue;
        if (Math.max(pc.size.x, pc.size.z) > 40 || (o0.kind === 'wall' && Math.max(pc.size.x, pc.size.z) > 12) || !pc.ids.some(id => w.objs[id].vis.length)) continue;
        const src = pc.ids.map(id => JSON.parse(JSON.stringify(w.objs[id]))), pv = pc.pivot, name = pc.name;
        ASSETS[name] = K => { const made = []; K.together(() => { for (const so of src) { const o = K.O(so.name, so.kind); for (const k of Object.keys(so)) if (!['id', 'name', 'kind', 'grp', 'editKey', 'added', 'addIdx', 'baked', 'auto', 'parent'].includes(k)) o[k] = JSON.parse(JSON.stringify(so[k])); made.push(o); } });
          for (const o of made) moveObject(o, v3(0, 0, 0), v3(-pv.x, 0, -pv.z), 0, 1); };
        list.push(name); } }
    return CATALOG; }
  S.mapPieces = mapPieces; S.applyMapEdits = applyMapEdits;
  Object.defineProperty(S, 'ASSETS', { configurable: true, get() { catalog(); return Object.keys(ASSETS); } });
  S.assetCatalog = () => { catalog(); return CATALOG.byMap; };
  // one library asset built on its own at the origin (the Map Editor draws its thumbnail from it)
  S.assetObjs = name => { catalog(); const make = ASSETS[name]; if (!make) return []; const w = { objs: [] }, K = kit(w); let seed = 77;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; make(K, natureKit(K, (a, b) => a + (b - a) * rnd(), rnd)); return w.objs; };
  const edited = (id, w) => { if (OFFICIAL[id]) { applyMapEdits(w, OFFICIAL[id]); w.official = w.edits; } if (MAP_EDITS[id]) applyMapEdits(w, MAP_EDITS[id]); else if (OFFICIAL[id]) w.edits = null; return w; };

  // Every map is closed in (pilot, 2026-11-17: "proper bounding boxes"): invisible walls round everything that was built
  // (its colliders' extent and the declared bounds, plus EDGE_OUT) and a ceiling EDGE_UP above the tallest thing (at least
  // EDGE_MIN_H up). Kind 'edge': never a tap, a wall ride, an over/under or a pole. Added after the Surveyor so it never sees them.
  const EDGE_OUT = 25, EDGE_UP = 40, EDGE_MIN_H = 60;
  function closeIn(w) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = 0;
    for (const p of w.prims) { const a = p.aabb; if (!a) continue; x0 = Math.min(x0, a.min.x); x1 = Math.max(x1, a.max.x); z0 = Math.min(z0, a.min.z); z1 = Math.max(z1, a.max.z); top = Math.max(top, a.max.y); }
    if (w.bounds) { x0 = Math.min(x0, w.bounds.x[0]); x1 = Math.max(x1, w.bounds.x[1]); z0 = Math.min(z0, w.bounds.z[0]); z1 = Math.max(z1, w.bounds.z[1]); }
    // generous: the edges only stop endless flying (a tester's powerloop out through the warehouse skylight hit the old
    // ones, 6 m out and 20 m up). The shadow box still uses the built area plus 6 m (w.bounds).
    const B = { x: [x0 - 6, x1 + 6], z: [z0 - 6, z1 + 6] }; x0 -= EDGE_OUT; x1 += EDGE_OUT; z0 -= EDGE_OUT; z1 += EDGE_OUT;
    const H = Math.max(EDGE_MIN_H, top + EDGE_UP), T = 1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    const o = { id: w.objs.reduce((m, q) => Math.max(m, q.id + 1), 0), name: 'Map Edge', kind: 'edge', prims: [], vis: [] };
    for (const [c, h] of [[v3(x0 - T, H / 2, cz), v3(T, H / 2 + T, hz + 2 * T)], [v3(x1 + T, H / 2, cz), v3(T, H / 2 + T, hz + 2 * T)], [v3(cx, H / 2, z0 - T), v3(hx + 2 * T, H / 2 + T, T)], [v3(cx, H / 2, z1 + T), v3(hx + 2 * T, H / 2 + T, T)], [v3(cx, H + T, cz), v3(hx + 2 * T, T, hz + 2 * T)]]) {
      const b = makeBox(c, h); b.owner = o.id; o.prims.push(b); w.prims.push(b); }
    w.objs.push(o); w.bounds = B; w.edges = { x: [x0, x1], z: [z0, z1] }; w.ceiling = H; return w;
  }

  // ================================================================ SHIP DRUGS
  // The pilot's brief: a gaudy 1980s cruise ship in a night-time police raid (Miami Vice, vaporwave, a fever dream). 1 unit = 1 m.
  // x runs aft (-48) to bow (+52), z across the ship (port -, the pier side; starboard +). Water is the ground (y 0); the
  // main deck (top of the hull) is y 6; the superstructure has three storeys: L1 6-9.7, L2 10-13.7, L3 14-17.7, roof 18.
  //  - Aft open deck: the raid perimeter (sawhorses, luggage carts, crime-scene tape at 1.2 m, contraband pallets with
  //    0.4 x 0.4 m tunnels); the Hold (L1, x -30..-8): seized cargo and more tunnels.
  //  - L2 west: the Breached Cabins: a wavy Memphis corridor, ten staterooms with doors blown to 0.45 m gaps, glassless
  //    mirror frames between rooms, balconies outside.
  //  - Roof west: the Lido Deck: the drained pool (deep end 4 m), the spiral slide tube (1.0 m inside), diving boards,
  //    lifeguard tower, DJ truss.
  //  - Middle: the Grand Atrium (x -8..12, three storeys): casino floor, balconies, sweeping stairs, the chandelier's tiered
  //    neon hoops (smallest 0.8 m inside), a 0.6 x 0.6 m backlit grid, a skylight roof with shattered panes.
  //  - Forward: the Starlight Lounge (double height) under shattered skylights, the bow deck; starboard lifeboats hang 0.5 m
  //    off the windows; on the pier: police cruisers, floodlights, sodium lamps, the gangway, and the port crane whose boom
  //    leans over the lounge for dives straight down through the skylights.
  function buildShip() {
    const { add, sub, mul, norm, cross } = S;
    const K = kit(), { O, box, pipe, ball, neon } = K, { bar } = parts(K), zones = [];
    const NS = { noSurvey: true }, ND = { noCollide: true }, GL = { noCollide: true, glow: true };
    // a wall along x (at z = fixed) or along z (at x = fixed) from u0 to u1, y0..y1, with rectangular holes {a, b, y0, y1}
    const wallH = (o, axis, fixed, u0, u1, y0, y1, t, holes, mat, opts = NS) => {
      const seg = (a, b, ya, yb) => { ya += 0.004; yb -= 0.004; if (b - a < 0.01 || yb - ya < 0.01) return; const cu = (a + b) / 2, cy = (ya + yb) / 2, hu = (b - a) / 2, hy = (yb - ya) / 2;   // 4 mm short of the slabs they meet: no shared faces to flicker
        if (axis === 'x') box(o, v3(cu, cy, fixed), v3(hu, hy, t / 2), mat, 0, 0, 0, opts); else box(o, v3(fixed, cy, cu), v3(t / 2, hy, hu), mat, 0, 0, 0, opts); };
      const cuts = [...new Set([u0, u1, ...holes.flatMap(h => [h.a, h.b])])].filter(x => x >= u0 && x <= u1).sort((p, q) => p - q);
      for (let i = 0; i + 1 < cuts.length; i++) { const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2, hs = holes.filter(h => h.a <= m && h.b >= m).sort((p, q) => p.y0 - q.y0);
        let y = y0; for (const h of hs) { seg(a, b, y, h.y0); y = Math.max(y, h.y1); } seg(a, b, y, y1); } };
    const gapO = (name, c, n, u, hu, hv) => O(name, 'gap', { gap: { c, n, u, hu, hv } });
    // a ring of capsules (a hoop) round centre c in the plane across normal n; R = centre line radius, r = tube radius
    const hoop = (o, c, n, R, r, segs, mat, opts = { glow: true, noSurvey: true }) => { const nn = norm(n), a = Math.abs(nn.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), u = norm(cross(a, nn)), w = cross(nn, u);
      const P = k => { const t = k / segs * Math.PI * 2; return v3(c.x + (u.x * Math.cos(t) + w.x * Math.sin(t)) * R, c.y + (u.y * Math.cos(t) + w.y * Math.sin(t)) * R, c.z + (u.z * Math.cos(t) + w.z * Math.sin(t)) * R); };
      for (let k = 0; k < segs; k++) pipe(o, P(k), P(k + 1), r, mat, opts); return { u, w }; };
    const rail = (o, a, b, y, posts = 1.2) => { pipe(o, v3(a.x, y, a.z), v3(b.x, y, b.z), 0.03, 'brass'); const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.round(L / posts));
      for (let i = 0; i <= n; i++) { const f = i / n; pipe(o, v3(a.x + (b.x - a.x) * f, y - 1.0, a.z + (b.z - a.z) * f), v3(a.x + (b.x - a.x) * f, y, a.z + (b.z - a.z) * f), 0.018, 'brass', NS); }
      neon(o, v3((a.x + b.x) / 2, y - 0.08, (a.z + b.z) / 2), v3(L / 2 + 0.01, 0.012, 0.012), o.railGlow || 'neonPink', -Math.atan2(b.z - a.z, b.x - a.x)); };   // a thin strip turned along the rail (an unturned box spanning dx x dz made big plates on the curved bow rail)
    const slope = (o, x0, y0, x1, y1, z, hw, mat) => { const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0); box(o, v3((x0 + x1) / 2, (y0 + y1) / 2, z), v3(L / 2, 0.12, hw), mat, 0, 0, a); };
    const DECK = 6, L2 = 10, L3 = 14, ROOF = 18, T = 0.15;

    // ---------------------------------------------------------------- the harbour, the pier, the hull
    zones.push({ shape: 'zone', mat: 'deckWet', c: v3(0, 0.004, -19), h: v3(52, 0, 6.2) });   // wet sheen under the pier edge
    const pier = O('Pier', 'deco'); box(pier, v3(0, 0.75, -19), v3(52, 0.75, 6), 'concrete');
    for (let x = -48; x <= 48; x += 6) { pipe(pier, v3(x, 1.5, -13.4), v3(x, 2.1, -13.4), 0.18, 'darkMetal'); box(pier, v3(x + 3, 1.52, -13.2), v3(2.9, 0.02, 0.12), 'plasticYellow', 0, 0, 0, ND); }
    // the hull, after a real cruise ship's profile (owner's reference photo, 2026-11-18): straight-sided midships, a sharp
    // bow whose stem rakes forward as it rises, and a rounded stern. Built from thin slices that follow the outline (the
    // physics world is boxes and capsules), the stripes, windows, deck and rail following the curve.
    const HW = 11, BOW0 = 26, STERN0 = -44, STERN_L = 4.5, stemAt = y => 47 + 5 * Math.min(1, Math.max(0, y / DECK));   // the stem: 47 m at the waterline, 52 m at the deck
    const hw = (x, y) => { if (x >= BOW0) { const L = stemAt(y) - BOW0, u = (x - BOW0) / L; return u >= 1 ? 0 : HW * Math.pow(1 - u * u, 0.6); }
      if (x <= STERN0) { const u = (STERN0 - x) / STERN_L; return u >= 1 ? 0 : HW * Math.sqrt(1 - u * u); } return HW; };
    const hull = O('Hull', 'wall'); box(hull, v3((STERN0 + BOW0) / 2, DECK / 2, 0), v3((BOW0 - STERN0) / 2, DECK / 2, HW), 'hullWhite');
    const DX = 0.8, BAND = 1;
    // what you hit: coarse slices (not drawn); what you see: a smooth skin of short plates turned along the outline, in
    // 40 cm bands, so the curve and the rake read smooth (owner: "a bit more smoothed out and less blocky")
    for (let x = BOW0; x < stemAt(DECK); x += DX) for (let y = 0; y < DECK - 1e-6; y += BAND) { const w = hw(x + DX / 2, y + BAND / 2); if (w > 0.05) box(hull, v3(x + DX / 2, y + BAND / 2, 0), v3(DX / 2 + 0.02, BAND / 2, w), 'hullWhite', 0, 0, 0, { noDraw: true }); }
    for (let x = STERN0; x > STERN0 - STERN_L; x -= DX / 2) { const w = hw(x - DX / 4, 3); if (w > 0.05) box(hull, v3(x - DX / 4, DECK / 2, 0), v3(DX / 4 + 0.02, DECK / 2, w), 'hullWhite', 0, 0, 0, { noDraw: true }); }
    { const SK = 0.4, skin = (y, hy, x0, x1, step) => { for (const s of [-1, 1]) for (let x = x0; x < x1 - 1e-6; x += step) { const xb = Math.min(x1, x + step), wa = hw(x, y), wb = hw(xb, y), dz = (wb - wa) * s, L = Math.hypot(xb - x, dz);
          if (wa < 0.02 && wb < 0.02) continue; box(hull, v3((x + xb) / 2, y, s * ((wa + wb) / 2 - 0.05)), v3(L / 2 + 0.03, hy, 0.06), 'hullWhite', -Math.atan2(dz, xb - x), 0, 0, ND); } };
      for (let y = SK / 2; y < DECK; y += SK) skin(y, SK / 2 + 0.005, BOW0 - 0.4, stemAt(y), 0.7);
      skin(DECK / 2, DECK / 2, STERN0 - STERN_L, STERN0 + 0.4, 0.45); }
    // the deck: one plank field midships, slices fore and aft
    box(hull, v3((STERN0 + BOW0) / 2, DECK + 0.01, 0), v3((BOW0 - STERN0) / 2, 0.01, HW), 'teakWet', 0, 0, 0, ND);
    for (let x = BOW0; x < stemAt(DECK); x += DX) { const w = hw(x + DX / 2, DECK) - 0.02; if (w > 0.05) box(hull, v3(x + DX / 2, DECK + 0.01, 0), v3(DX / 2, 0.01, w), 'teakWet', 0, 0, 0, ND); }
    for (let x = STERN0; x > STERN0 - STERN_L; x -= DX / 2) { const w = hw(x - DX / 4, DECK) - 0.02; if (w > 0.05) box(hull, v3(x - DX / 4, DECK + 0.01, 0), v3(DX / 4, 0.01, w), 'teakWet', 0, 0, 0, ND); }
    // a line along the hull side at height y, as short straight pieces turned to follow the curve
    const along = (y, x0, x1, step, fn) => { for (let x = x0; x < x1 - 1e-6; x += step) { const xa = x, xb = Math.min(x1, x + step), wa = hw(xa, y), wb = hw(xb, y); if (wa < 0.3 && wb < 0.3) continue; fn(xa, xb, wa, wb); } };
    const sideStrip = (y, hy, mat, opt, x0 = STERN0 - STERN_L, x1 = stemAt(y)) => { for (const s of [-1, 1]) along(y, x0, x1, 1.0, (xa, xb, wa, wb) => { const dx = xb - xa, dz = (wb - wa) * s, L = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
      box(hull, v3((xa + xb) / 2, y, s * ((wa + wb) / 2 + 0.02)), v3(L / 2 + (Math.abs(dz) > 1e-4 ? 0.01 : 0), hy, 0.02), mat, ry, 0, 0, opt); }); };   // pieces on the straight sides butt end to end; only turned ones overlap a little to close the corner
    sideStrip(1.4, 0.45, 'hullNavy', ND); sideStrip(2.3, 0.06, 'neonCyan', GL);
    for (const s of [-1, 1]) for (let x = -46; x <= 42; x += 2.2) { const w = hw(x, 4.2), w2 = hw(x + 0.3, 4.2); if (w < 1.5) continue; const ry = -Math.atan2((w2 - w) * s, 0.3);
      box(hull, v3(x, 4.2, s * (w + 0.03)), v3(0.22, 0.22, 0.02), 'windowLit', ry, 0, 0, GL); }
    // the deck rail: straight midships, round the bow and the stern
    const hrail = O('Deck Rail', 'overunder'); hrail.railGlow = 'neonCyan';
    for (const s of [-1, 1]) rail(hrail, v3(STERN0, 0, s * (HW - 0.15)), v3(BOW0, 0, s * (HW - 0.15)), DECK + 1.05, 2.4);
    { const pts = []; for (let x = BOW0; x <= stemAt(DECK) - 0.6; x += 1.6) pts.push([x, hw(x, DECK) - 0.15]); pts.push([stemAt(DECK) - 0.6, 0]);
      for (const s of [-1, 1]) for (let i = 1; i < pts.length; i++) rail(hrail, v3(pts[i - 1][0], 0, s * pts[i - 1][1]), v3(pts[i][0], 0, s * Math.max(0, pts[i][1])), DECK + 1.05, 2.4); }
    { const pts = []; for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2, x = STERN0 - Math.sin(a) * (STERN_L - 0.35); pts.push([x, Math.max(0, hw(x, DECK) - 0.15)]); }
      for (const s of [-1, 1]) for (let i = 1; i < pts.length; i++) rail(hrail, v3(pts[i - 1][0], 0, s * pts[i - 1][1]), v3(pts[i][0], 0, s * pts[i][1]), DECK + 1.05, 2.4); }
    // the gangway from the pier up to the main deck (port side), and its rails
    { const g = O('Gangway', 'deco'); const x = -20, z0 = -13.2, z1 = -10.9, L = Math.hypot(z1 - z0, DECK - 1.5), a = Math.atan2(DECK - 1.5, z1 - z0);
      box(g, v3(x, (1.5 + DECK) / 2, (z0 + z1) / 2), v3(0.9, 0.06, L / 2), 'darkMetal', 0, -a, 0); for (const s of [-1, 1]) pipe(g, v3(x + s * 0.9, 2.5, z0), v3(x + s * 0.9, DECK + 1, z1), 0.03, 'brass', NS); }

    // ---------------------------------------------------------------- police raid on the pier
    const car = (x, z, ry, n) => { const o = O('Police Cruiser', 'deco'), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, 1.5 + y, z - u * s + w * c);
      box(o, P(0, 0.55, 0), v3(2.35, 0.32, 0.92), n % 2 ? 'carWhite' : 'carBlack', ry); box(o, P(-0.2, 1.08, 0), v3(1.25, 0.24, 0.84), 'carBlack', ry);
      box(o, P(-0.2, 1.36, -0.3), v3(0.18, 0.06, 0.32), 'policeRed', ry); box(o, P(-0.2, 1.36, 0.3), v3(0.18, 0.06, 0.32), 'policeBlue', ry);
      for (const u of [-1.5, 1.5]) for (const w of [-0.95, 0.95]) pipe(o, P(u, 0.32, w * 0.85), P(u, 0.32, w * 1.05), 0.32, 'rubberBlack', NS);
      for (const w of [-1, 1]) for (const u of [0.55, -0.6]) box(o, P(u + 0.35, 0.72, w * 1.45), v3(0.55, 0.36, 0.03), n % 2 ? 'carWhite' : 'carBlack', ry + w * 1.05);   // doors flung open
      return o; };
    [[-42, -20.5, 0.15], [-33, -21, -0.2], [-12, -20.8, 0.3], [-3, -21.2, -0.1], [8, -20.6, 0.25], [17, -21, -0.3], [27, -20.8, 0.1]].forEach(([x, z, ry], i) => car(x, z, ry, i));
    for (const [x, z, col] of [[-38, -20.5, 'red'], [-8, -21, 'blue'], [12, -21, 'red'], [-25, -20.5, 'blue']]) O('Lightbar', 'deco', { light: v3(x, 3.4, z), lightColor: col === 'red' ? 0xff003c : 0x0088ff, lightPower: 45, lightRange: 22, strobe: col });
    // sodium dock lamps, tripod floodlights, evidence cones, tape round the cars
    for (const x of [-30, 0, 30]) { const l = O('Dock Lamp', 'pole', { light: v3(x, 8.2, -16), lightColor: 0xffa040, lightPower: 55, lightRange: 28 });
      pipe(l, v3(x, 1.5, -16), v3(x, 8.4, -16), 0.12, 'darkMetal'); pipe(l, v3(x, 8.4, -16), v3(x, 8.4, -14.6), 0.06, 'darkMetal', NS); box(l, v3(x, 8.25, -14.6), v3(0.35, 0.12, 0.25), 'sodium', 0, 0, 0, GL); }
    const tripod = (x, y, z, aim) => { const o = O('Floodlight', 'deco'); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; pipe(o, v3(x + Math.cos(a) * 0.7, y, z + Math.sin(a) * 0.7), v3(x, y + 2.6, z), 0.03, 'darkMetal', NS); }
      box(o, v3(x, y + 2.85, z), v3(0.45, 0.32, 0.18), 'darkMetal', aim); box(o, v3(x + Math.sin(aim) * 0.19, y + 2.85, z + Math.cos(aim) * 0.19), v3(0.4, 0.27, 0.01), 'uvChalk', aim, 0, 0, GL); return o; };
    tripod(-36, 1.5, -15.5, 0.2); tripod(4, 1.5, -15.5, -0.3); tripod(-44, DECK, 7, 2.2); tripod(-33, DECK, -7.5, 0.6);
    const cone = (x, y, z, n) => { const o = O('Evidence Cone', 'deco'); pipe(o, v3(x, y, z), v3(x, y + 0.32, z), 0.14, 'coneOrange', { cone: true }); box(o, v3(x, y + 0.04, z), v3(0.16, 0.04, 0.16), 'plasticYellow'); return o; };
    [[-40, 1.5, -17.5], [-28, 1.5, -18], [-16, 1.5, -17], [0, 1.5, -17.6], [14, 1.5, -18], [-40, DECK, -3], [-35, DECK, 4.5], [-2, DECK, -4], [6, DECK, 3]].forEach(([x, y, z], i) => cone(x, y, z, i + 1));
    const tape = (name, a, b, y) => { const o = O(name, 'overunder'), L = Math.hypot(b.x - a.x, b.z - a.z), ry = Math.atan2(-(b.z - a.z), b.x - a.x);
      box(o, v3((a.x + b.x) / 2, y, (a.z + b.z) / 2), v3(L / 2, 0.035, 0.004), 'tape', ry); for (const p of [a, b]) pipe(o, v3(p.x, y - 1.2 + (y - 1.2 < 2 ? 0 : 0), p.z), v3(p.x, y + 0.05, p.z), 0.03, 'darkMetal');
      o.obstacle = { a: v3(a.x, 0, a.z), b: v3(b.x, 0, b.z), under: y - 0.035, over: y + 0.035 }; return o; };
    tape('Crime Scene Tape', v3(-46, 0, -14.2), v3(-20.5, 0, -14.2), 1.5 + 1.2); tape('Crime Scene Tape', v3(-19.5, 0, -14.2), v3(6, 0, -14.2), 1.5 + 1.2);

    // ---------------------------------------------------------------- aft deck: the raid perimeter and cargo
    zones.push({ shape: 'zone', mat: 'hazard', c: v3(-39, DECK + 0.02, 0), h: v3(0.3, 0, 9) });
    for (const x of [-46, -40, -34]) tape('Crime Scene Tape', v3(x, 0, -9.6), v3(x, 0, 9.6), DECK + 1.2);   // exactly 1.2 m up: under it, Matty back over
    const sawhorse = (x, z, ry) => { const o = O('Sawhorse Barricade', 'overunder'), c = Math.cos(ry), s = Math.sin(ry), P = (u, y, w) => v3(x + u * c + w * s, DECK + y, z - u * s + w * c);
      box(o, P(0, 1.0, 0), v3(1.2, 0.1, 0.03), 'hazard', ry); box(o, P(0, 0.55, 0), v3(1.1, 0.05, 0.02), 'sawhorse', ry, 0, 0, NS);
      for (const u of [-1.0, 1.0]) for (const w of [-0.3, 0.3]) pipe(o, P(u, 0, w), P(u, 0.95, 0), 0.025, 'sawhorse', NS);
      const e0 = P(-1.2, 0, 0), e1 = P(1.2, 0, 0); o.obstacle = { a: v3(e0.x, 0, e0.z), b: v3(e1.x, 0, e1.z), under: DECK + 0.9, over: DECK + 1.1 }; return o; };
    for (const [x, z, ry] of [[-43, -6, 0.1], [-43, 0, -0.05], [-43, 6, 0.08], [-37, -3.5, 0.15], [-37, 3.5, -0.1], [-31.5, -7, 0], [-31.5, 7, 0]]) sawhorse(x, z, Math.PI / 2 + ry);
    const cart = (x, y, z, ry) => { const o = O('Luggage Cart', 'overunder'), c = Math.cos(ry), s = Math.sin(ry), P = (u, yy, w) => v3(x + u * c + w * s, y + yy, z - u * s + w * c);
      box(o, P(0, 0.3, 0), v3(0.8, 0.04, 0.45), 'brass', ry); for (const u of [-0.75, 0.75]) for (const w of [-0.4, 0.4]) pipe(o, P(u, 0.3, w), P(u, 1.75, w), 0.025, 'brass', NS);
      pipe(o, P(-0.75, 1.75, 0), P(0.75, 1.75, 0), 0.03, 'brass'); pipe(o, P(-0.75, 1.75, -0.4), P(-0.75, 1.75, 0.4), 0.025, 'brass', NS); pipe(o, P(0.75, 1.75, -0.4), P(0.75, 1.75, 0.4), 0.025, 'brass', NS);
      for (const u of [-0.6, 0.6]) pipe(o, P(u, 0.1, -0.45), P(u, 0.1, 0.45), 0.09, 'rubberBlack', NS); box(o, P(0.2, 0.55, 0), v3(0.35, 0.22, 0.28), 'lifeboat', ry + 0.2); return o; };
    cart(-45, DECK, -2.5, 0.3); cart(-40.5, DECK, 7.5, -0.5); cart(-35, DECK, -8, 1.2); cart(-28, DECK + 0, -10.1 + 0.3, 0);
    // contraband pallets with a 0.4 x 0.4 m tunnel through each (x-ways): line them up and thread them
    const pallet = (x, z, y, tiers, ry = 0) => { const o = O('Contraband Pallet', 'deco'), along = Math.abs(Math.sin(ry)) > 0.7;
      for (let k = 0; k < tiers; k++) { const b = y + k * 1.0, H = (cx, cy, cz, hx, hy, hz, m) => box(o, along ? v3(x + cz, cy, z + cx) : v3(x + cx, cy, z + cz), along ? v3(hz, hy, hx) : v3(hx, hy, hz), m);
        H(0, b + 0.075, 0, 0.6, 0.075, 0.6, 'oldWood'); H(0, b + 0.35, -0.4, 0.6, 0.2, 0.2, 'contraband'); H(0, b + 0.35, 0.4, 0.6, 0.2, 0.2, 'contraband'); H(0, b + 0.775, 0, 0.6, 0.225, 0.6, 'contraband');
        gapO('Pallet Tunnel', v3(x, b + 0.35, z), along ? v3(0, 0, 1) : v3(1, 0, 0), along ? v3(1, 0, 0) : v3(0, 0, 1), 0.14, 0.14); }
      return o; };
    for (const [x, z, t] of [[-46.5, 4, 1], [-44.3, 4, 2], [-42.1, 4, 1], [-46.5, -5, 2], [-44.3, -5, 1], [-42.1, -5, 1]]) pallet(x, z, DECK, t);

    // ---------------------------------------------------------------- the superstructure shell (west x -30..-8, atrium -8..12, forward 12..34)
    const SX0 = -30, SX1 = 34, ZW = 9, shell = O('Superstructure', 'wall'), WT = 0.2;
    // aft wall (x -30): L1 cargo door 6 x 3, L2 corridor window 2.4 x 2.4, L3 closed
    wallH(shell, 'z', SX0, -ZW, ZW, DECK, ROOF, WT, [{ a: -3, b: 3, y0: DECK, y1: DECK + 3 }, { a: -1.2, b: 1.2, y0: L2, y1: L2 + 2.4 }], 'hullWhite');
    gapO('Cargo Door', v3(SX0, DECK + 1.5, 0), v3(1, 0, 0), v3(0, 0, 1), 2.92, 1.42); gapO('Corridor Window', v3(SX0, L2 + 1.2, 0), v3(1, 0, 0), v3(0, 0, 1), 1.04, 1.12);
    // the forward wall (x 34): the bow opening into the Starlight Lounge, 4 x 4 m
    wallH(shell, 'z', SX1, -ZW, ZW, DECK, L3, WT, [{ a: -2, b: 2, y0: DECK, y1: DECK + 4 }], 'hullWhite'); gapO('Bow Doors', v3(SX1, DECK + 2, 0), v3(1, 0, 0), v3(0, 0, 1), 1.92, 1.92);
    // floors and roofs
    const slab = (name, x0, x1, z0, z1, y, mat = 'hullWhite', kind = 'deco') => { const o = O(name, kind); box(o, v3((x0 + x1) / 2, y - T, (z0 + z1) / 2), v3((x1 - x0) / 2, T, (z1 - z0) / 2), mat, 0, 0, 0, NS); return o; };
    slab('Hold Ceiling', SX0, -8, -ZW, ZW, L2); slab('Cabin Deck Ceiling', SX0, -8, -ZW, ZW, L3);
    // roof over the west section with the pool cut out of it (pool x -27..-13, z -5..5)
    slab('Lido Deck', SX0, -27, -ZW, ZW, ROOF, 'teakWet'); slab('Lido Deck', -13, -8, -ZW, ZW, ROOF, 'teakWet'); slab('Lido Deck', -27, -13, -ZW, -5, ROOF, 'teakWet'); slab('Lido Deck', -27, -13, 5, ZW, ROOF, 'teakWet');
    // west outer walls: L1 hold (port door), L2 cabins (balcony doors, built with the cabins), L3 closed
    for (const s of [-1, 1]) { wallH(shell, 'x', s * ZW, SX0, -8, DECK, L2 - 0.3, WT, s < 0 ? [{ a: -21, b: -19, y0: DECK, y1: DECK + 2.5 }] : [], 'hullWhite'); wallH(shell, 'x', s * ZW, SX0, -8, L3 - 0.3, ROOF, WT, [], 'hullWhite');
      box(shell, v3(-19, L3 + 1.5, s * (ZW + 0.11)), v3(11, 0.05, 0.01), 'neonMagenta', 0, 0, 0, GL); }
    gapO('Hold Side Door', v3(-20, DECK + 1.25, -ZW), v3(0, 0, 1), v3(1, 0, 0), 0.92, 1.17);

    // ---------------------------------------------------------------- the Hold (L1 west): seized cargo, lines of tunnels
    { const hold = O('Hold Floor', 'deco'); box(hold, v3(-19, DECK + 0.026, 0), v3(11, 0.01, ZW), 'deckWet', 0, 0, 0, ND); /* above the teak, not in it (they flickered) */ }
    for (const z of [-6, -3, 3, 6]) for (const x of [-27, -24.6, -22.2, -15, -12.6, -10.2]) pallet(x, z, DECK, (Math.abs(x + z) % 3) < 1 ? 2 : 1);
    cart(-18.5, DECK, -7.4, 0.2); cart(-19.5, DECK, 7.2, -0.3);
    O('Hold Lamp', 'deco', { light: v3(-19, L2 - 0.6, 0), lightColor: 0xffa040, lightPower: 30, lightRange: 18 });

    // ---------------------------------------------------------------- L2 west: the Breached Cabins
    { const cor = O('Cabin Corridor', 'wall'), CW = 1.2, Y0 = L2, Y1 = L3 - 0.3, x0 = SX0, x1 = -8, n = 5, CL = (x1 - x0) / n;
      box(cor, v3((x0 + x1) / 2, L2 + 0.01, 0), v3((x1 - x0) / 2, 0.01, CW), 'carpet', 0, 0, 0, ND);   // loud carpet
      for (const s of [-1, 1]) {
        // the corridor wall, drawn wavy (short panels nudged on a sine), with a doorway into each cabin
        for (let i = 0; i < n; i++) { const cx = x0 + CL * (i + 0.5), dA = cx - 0.45, dB = cx + 0.45;
          for (let u = x0 + CL * i; u < x0 + CL * (i + 1) - 1e-6; u += 1.1) { const a = u, b = Math.min(u + 1.1, x0 + CL * (i + 1)), z = s * (CW + 0.06 + 0.05 * Math.sin(a * 2.3 + s));
            const pieces = b <= dA || a >= dB ? [[a, b]] : [[a, Math.min(b, dA)], [Math.max(a, dB), b]];
            for (const [p0, p1] of pieces) if (p1 - p0 > 0.01) box(cor, v3((p0 + p1) / 2, (Y0 + Y1) / 2, z), v3((p1 - p0) / 2, (Y1 - Y0) / 2, 0.06), s < 0 ? 'memphis' : 'memphisPink', 0, 0, 0, NS);
            if (a < dB && b > dA && a <= cx && b > cx) box(cor, v3(cx, (Y0 + 2.1 + Y1) / 2, s * (CW + 0.06)), v3(0.45, (Y1 - Y0 - 2.1) / 2, 0.06), s < 0 ? 'memphis' : 'memphisPink', 0, 0, 0, NS); }   // once per doorway
          // the door, blown half off its hinges: a 0.45 m leaf hanging at an angle, 0.45 m clear beside it
          const dr = O('Breached Door', 'deco'); box(dr, v3(dA + 0.2 + 0.03, Y0 + 1.0, s * (CW + 0.06) + s * 0.07), v3(0.2, 0.98, 0.025), 'doorWood', s * 0.28);   /* leaf edge ~1 cm short of the centre: 0.46 m clear */
          box(dr, v3(cx + 0.2, Y0 + 0.12, s * (CW + 1.3)), v3(0.42, 0.04, 0.9), 'doorWood', 0.4, 0, 0.12);   // the other leaf, on the floor inside
          gapO('Breached Doorway', v3(dB - 0.23, Y0 + 1.05, s * (CW + 0.06)), v3(0, 0, 1), v3(1, 0, 0), 0.16, 0.95); }
        // walls between cabins, each with a glassless mirror frame (0.8 x 0.6 m) to fly through to the next room
        for (let i = 1; i < n; i++) { const x = x0 + CL * i, zm = s * 5; wallH(cor, 'z', x, s < 0 ? -ZW : CW + 0.1, s < 0 ? -(CW + 0.1) : ZW, Y0, Y1, 0.12, [{ a: zm - 0.4, b: zm + 0.4, y0: Y0 + 1.3, y1: Y0 + 1.9 }], 'memphis');
          for (const [dz, dy, hz, hy] of [[0, 0.33, 0.47, 0.035], [0, -0.33, 0.47, 0.035], [0.44, 0, 0.035, 0.33], [-0.44, 0, 0.035, 0.33]]) box(cor, v3(x, Y0 + 1.6 + dy, zm + dz), v3(0.08, hy, hz), 'mirrorFrame', 0, 0, 0, ND);
          gapO('Mirror Frame', v3(x, Y0 + 1.6, zm), v3(1, 0, 0), v3(0, 0, 1), 0.34, 0.24); }
        // the outer wall: a balcony door in every cabin, balconies with brass rails outside
        const holes = []; for (let i = 0; i < n; i++) { const cx = x0 + CL * (i + 0.5); holes.push({ a: cx - 0.5, b: cx + 0.5, y0: Y0, y1: Y0 + 2.1 }); gapO('Balcony Door', v3(cx, Y0 + 1.06, s * ZW), v3(0, 0, 1), v3(1, 0, 0), 0.44, 0.97); }
        wallH(shell, 'x', s * ZW, x0, x1, Y0, Y1, WT, holes, 'hullWhite');
        const bal = O('Cabin Balcony', 'deco'); box(bal, v3((x0 + x1) / 2, L2 - 0.12, s * (ZW + 0.8)), v3((x1 - x0) / 2, 0.12, 0.8), 'teakWet');
        const br = O('Balcony Rail', 'overunder'); br.railGlow = 'neonCyan'; rail(br, v3(x0, 0, s * (ZW + 1.55)), v3(x1, 0, s * (ZW + 1.55)), L2 + 1.05, 1.1);
        for (let i = 1; i < n; i++) box(bal, v3(x0 + CL * i, L2 + 0.55, s * (ZW + 0.8)), v3(0.03, 0.55, 0.75), 'glassBlock');
        // inside each cabin: a bed, an overturned lamp, chalk outlines and spilled powder glowing under UV
        for (let i = 0; i < n; i++) { const cx = x0 + CL * (i + 0.5), cz = s * 6.5, c2 = O('Stateroom', 'deco'); box(c2, v3(cx - 0.9, L2 + 0.3, cz), v3(0.95, 0.3, 1.0), 'memphisPink');
          box(c2, v3(cx + 0.9, L2 + 0.012, s * 3.6), v3(0.5, 0.004, 0.22), 'uvChalk', 0.7, 0, 0, GL); ball(c2, v3(cx + 1.3, L2 + 0.02, s * 4.5), 0.25, 'uvChalk', { noCollide: true, glow: true }); } }
      // the corridor's UV: chalk outlines of bodies on the carpet, evidence tags
      for (const x of [-26, -17.5, -11]) { box(cor, v3(x, L2 + 0.025, 0.1), v3(0.6, 0.004, 0.25), 'uvChalk', 0.4, 0, 0, GL); box(cor, v3(x + 0.8, L2 + 0.03, -0.5), v3(0.08, 0.02, 0.05), 'plasticYellow', 0, 0, 0, ND); }
      O('Corridor Light', 'deco', { light: v3(-19, L3 - 0.8, 0), lightColor: 0xff4fd0, lightPower: 18, lightRange: 14 }); }

    // ---------------------------------------------------------------- roof west: the Lido Deck and the empty pool
    { const pool = O('Empty Pool', 'deco'), PX0 = -27, PX1 = -13, PZ = 5, PB = L3;   // deep end floor at y 14 (4 m deep), shallow end ramps up to 16.8
      const PT = ROOF - 0.003;   // 3 mm inside the deck's edges and under its top: no shared faces
      for (const s of [-1, 1]) box(pool, v3((PX0 + PX1) / 2, (PB + PT) / 2, s * (PZ + 0.097)), v3((PX1 - PX0) / 2 - 0.003, (PT - PB) / 2, 0.1), 'poolTile');
      for (const x of [PX0 - 0.097, PX1 + 0.097]) box(pool, v3(x, (PB + PT) / 2, 0), v3(0.1, (PT - PB) / 2, PZ - 0.003), 'poolTile');
      box(pool, v3(-20, PB + 0.01, 0), v3(7, 0.01, PZ), 'poolTile', 0, 0, 0, ND); slope(pool, PX0, 16.8, -19, PB + 0.2, 0, PZ, 'poolTile');
      for (const s of [-1, 1]) box(pool, v3(-20, PB + 0.5, s * (PZ - 0.01)), v3(7, 0.03, 0.01), 'neonCyan', 0, 0, 0, GL);
      box(pool, v3(-16, PB + 0.012, 1.2), v3(0.7, 0.004, 0.3), 'uvChalk', -0.5, 0, 0, GL); }
    O('Pool Glow', 'deco', { light: v3(-17, 16.5, 0), lightColor: 0x55f6ff, lightPower: 25, lightRange: 16 });
    // diving boards at the deep end (1 m and 3 m), the lifeguard tower, the DJ truss
    { const d = O('Diving Platform', 'overunder'); pipe(d, v3(-11.5, ROOF, -2.5), v3(-11.5, ROOF + 3.1, -2.5), 0.22, 'concrete'); box(d, v3(-13.4, ROOF + 1.0, -2.5), v3(2.2, 0.06, 0.3), 'brass');
      box(d, v3(-13.9, ROOF + 3.0, -2.5), v3(2.7, 0.08, 0.35), 'hullWhite'); d.obstacle = { a: v3(-15.6, 0, -2.5), b: v3(-11.2, 0, -2.5), under: ROOF + 0.94, over: ROOF + 1.06 }; }
    { const lg = O('Lifeguard Tower', 'overunder'); for (const [dx, dz] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) pipe(lg, v3(-20 + dx * 1.3, ROOF, -7.4 + dz * 1.3), v3(-20 + dx, ROOF + 2.4, -7.4 + dz), 0.05, 'hullWhite', NS);
      box(lg, v3(-20, ROOF + 2.45, -7.4), v3(0.7, 0.05, 0.6), 'lifeboat'); box(lg, v3(-20, ROOF + 2.9, -7.9), v3(0.7, 0.4, 0.05), 'lifeboat'); box(lg, v3(-20, ROOF + 3.6, -7.4), v3(0.8, 0.04, 0.7), 'neonMagenta', 0, 0, 0, { glow: true });
      lg.obstacle = { a: v3(-20.7, 0, -7.4), b: v3(-19.3, 0, -7.4), under: ROOF + 2.4, over: ROOF + 2.5 }; }
    { const dj = O('DJ Truss', 'overunder'), y1 = ROOF + 4;
      for (const x of [-25, -18]) for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) pipe(dj, v3(x + dx, ROOF, 7.2 + dz), v3(x + dx, y1, 7.2 + dz), 0.025, 'galv', NS);
      for (const dy of [0, 0.4]) for (const dz of [-0.2, 0.2]) pipe(dj, v3(-25, y1 - dy, 7.2 + dz), v3(-18, y1 - dy, 7.2 + dz), 0.03, 'galv', dy || dz < 0 ? NS : {});
      for (let x = -24.5; x < -18; x += 0.7) pipe(dj, v3(x, y1, 7.0), v3(x + 0.35, y1 - 0.4, 7.4), 0.015, 'galv', NS);
      box(dj, v3(-21.5, ROOF + 0.55, 7.2), v3(1.4, 0.5, 0.45), 'carBlack'); box(dj, v3(-21.5, ROOF + 1.07, 7.2), v3(1.3, 0.02, 0.4), 'neonLime', 0, 0, 0, GL);
      dj.obstacle = { a: v3(-25, 0, 7.2), b: v3(-18, 0, 7.2), under: y1 - 0.43, over: y1 + 0.03 }; }
    for (const [x, z] of [[-28.5, -7], [-28.5, -3], [-28.5, 3], [-11.5, 6.5]]) { const ch = O('Sun Lounger', 'deco'); box(ch, v3(x, ROOF + 0.3, z), v3(0.35, 0.05, 0.95), 'neonPink'); box(ch, v3(x, ROOF + 0.15, z), v3(0.3, 0.15, 0.9), 'hullWhite'); }
    // the spiral waterslide: a translucent neon tube, 1.0 m inside (hoops 0.55 m to the centre line, 0.05 thick), from the
    // tower (y 25) round two turns, then straight down into the deep end. Fly it straight through.
    { const tw = O('Slide Tower', 'deco'), TX = -10.5, TZ = 6.2, TOP = 25;
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pipe(tw, v3(TX + dx, ROOF, TZ + dz), v3(TX + dx, TOP, TZ + dz), 0.08, 'neonCyan', { glow: true });
      box(tw, v3(TX, TOP - 0.1, TZ), v3(1.2, 0.1, 1.2), 'teakWet'); for (let y = ROOF + 0.5; y < TOP; y += 0.6) pipe(tw, v3(TX + 1.05, y, TZ - 0.5), v3(TX + 1.05, y, TZ + 0.5), 0.02, 'brass', NS);
      const sl = O('Spiral Slide', 'deco'), R = 2.6, cx = TX, cz = TZ, turns = 2, yTop = TOP - 0.4, yBot = 20.2, L = turns * Math.PI * 2, pts = [];
      for (let t = 0; t <= L + 1e-6; t += 0.32) pts.push(v3(cx + Math.cos(t + Math.PI) * R, yTop - (yTop - yBot) * t / L, cz + Math.sin(t + Math.PI) * R));
      const last = pts[pts.length - 1], end = v3(-15.5, PB_END(), 1.8); for (let f = 0.12; f <= 1.0001; f += 0.12) pts.push(v3(last.x + (end.x - last.x) * f, last.y + (end.y - last.y) * f, last.z + (end.z - last.z) * f));
      function PB_END() { return 15.0; }
      pts.forEach((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], pr = pts[Math.max(0, i - 1)], n = norm(sub(q, pr));
        if (i % 2 === 0) hoop(sl, p, n, 0.55, 0.05, 10, 'neonPink'); if (i < pts.length - 1) pipe(sl, p, q, 0.6, 'slideTube', { noCollide: true, alpha: true });
        if (i === 1 || i === Math.floor(pts.length / 2) || i === pts.length - 2) { const u = norm(cross(Math.abs(n.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), n)); gapO('Slide Tube', p, n, u, 0.3, 0.3); } }); }

    // ---------------------------------------------------------------- the Grand Atrium (x -8..12): casino floor, balconies, chandelier, grid
    { const AX0 = -8, AX1 = 12, BW = 1.6, at = O('Atrium Walls', 'wall');
      // west wall (to the hold, the corridor and the pool): L1 doorway 2.5 x 3, L2 corridor end 2.4 x 2.6
      wallH(at, 'z', AX0, -ZW, ZW, DECK, ROOF, WT, [{ a: -1.25, b: 1.25, y0: DECK, y1: DECK + 3 }, { a: -1.2, b: 1.2, y0: L2, y1: L2 + 2.6 }], 'hullWhite');
      gapO('Hold Doorway', v3(AX0, DECK + 1.5, 0), v3(1, 0, 0), v3(0, 0, 1), 1.17, 1.42);
      // east wall (to the lounge): L1 arch 3 x 3, L2 window onto the lounge 6 x 3
      wallH(at, 'z', AX1, -ZW, ZW, DECK, ROOF, WT, [{ a: -1.5, b: 1.5, y0: DECK, y1: DECK + 3 }, { a: -3, b: 3, y0: L2, y1: L2 + 3 }], 'hullWhite');
      gapO('Lounge Arch', v3(AX1, DECK + 1.5, 0), v3(1, 0, 0), v3(0, 0, 1), 1.42, 1.42); gapO('Lounge Window', v3(AX1, L2 + 1.5, 0), v3(1, 0, 0), v3(0, 0, 1), 2.92, 1.42);
      // side walls: port has a 3 m door to the deck walk on L1; both have lit window bands (the lifeboats hang off starboard)
      for (const s of [-1, 1]) { wallH(at, 'x', s * ZW, AX0, AX1, DECK, ROOF, WT, s < 0 ? [{ a: -2, b: 1, y0: DECK, y1: DECK + 3 }] : [], 'hullWhite');
        for (const y of [L2 + 1.9, L3 + 1.9]) box(at, v3((AX0 + AX1) / 2, y, s * (ZW + 0.11)), v3(9.5, 0.3, 0.01), 'windowLit', 0, 0, 0, GL); }
      gapO('Casino Door', v3(-0.5, DECK + 1.5, -ZW), v3(0, 0, 1), v3(1, 0, 0), 1.42, 1.42);
      // the casino floor: checkerboard dance floor, overturned poker tables, chips and cash, slot machines, glass blocks
      const cas = O('Casino Floor', 'deco'); box(cas, v3(2, DECK + 0.028, 0), v3(5, 0.006, 5), 'checker', 0, 0, 0, ND);
      for (const [x, z, a] of [[-4.5, -4, 1.2], [-3.5, 4, 1.35], [7.5, -5.5, 1.1], [8, 5.2, 1.3]]) { const pt = O('Overturned Poker Table', 'deco'); box(pt, v3(x, DECK + 0.75, z), v3(0.9, 0.05, 0.75), 'feltGreen', 0.4, a, 0);
        pipe(pt, v3(x - 0.3, DECK, z + 0.5), v3(x - 0.3, DECK + 0.5, z + 0.9), 0.06, 'brass', NS);
        for (let k = 0; k < 9; k++) box(pt, v3(x + Math.sin(k * 2.4) * (0.6 + k * 0.1), DECK + 0.042, z + Math.cos(k * 2.4) * (0.5 + k * 0.08)), v3(0.05, 0.008, k % 3 ? 0.05 : 0.09), k % 3 ? ['neonPink', 'neonCyan', 'neonYellow'][k % 3] : 'feltGreen', k, 0, 0, ND); }
      for (let x = -6; x <= 10; x += 1.6) for (const s of [-1, 1]) { if (s < 0 && x > -3 && x < 2) continue; const sm = O('Slot Machine', 'deco'); box(sm, v3(x, DECK + 0.8, s * (ZW - 0.45)), v3(0.4, 0.8, 0.35), 'carBlack'); box(sm, v3(x, DECK + 1.15, s * (ZW - 0.8)), v3(0.3, 0.2, 0.01), ['neonMagenta', 'neonLime', 'neonCyan'][Math.round(x) % 3 < 0 ? 0 : Math.round(x) % 3], 0, 0, 0, GL); }
      for (const z of [-6, 6]) { const gb = O('Glass Block Partition', 'overunder'); box(gb, v3(-2, DECK + 0.6, z), v3(1.8, 0.6, 0.08), 'glassBlock'); gb.obstacle = { a: v3(-3.8, 0, z), b: v3(-0.2, 0, z), under: DECK, over: DECK + 1.2 }; }
      // balconies all round at L2 and L3 (1.6 m), brass and neon rails on the inner edge
      for (const y of [L2, L3]) { const bl = O(y === L2 ? 'Atrium Balcony L2' : 'Atrium Balcony L3', 'deco'); bl.railGlow = y === L2 ? 'neonCyan' : 'neonPink';
        box(bl, v3((AX0 + AX1) / 2, y - 0.15, ZW - BW / 2), v3((AX1 - AX0) / 2, 0.15, BW / 2), 'carpet'); box(bl, v3((AX0 + AX1) / 2, y - 0.15, -ZW + BW / 2), v3((AX1 - AX0) / 2, 0.15, BW / 2), 'carpet');
        box(bl, v3(AX0 + BW / 2, y - 0.15, 0), v3(BW / 2, 0.15, ZW - BW), 'carpet'); box(bl, v3(AX1 - BW / 2, y - 0.15, 0), v3(BW / 2, 0.15, ZW - BW), 'carpet');
        const IX0 = AX0 + BW, IX1 = AX1 - BW, IZ = ZW - BW;
        rail(bl, v3(IX0, 0, IZ), v3(IX1, 0, IZ), y + 1.05); rail(bl, v3(IX0, 0, -IZ), v3(IX1, 0, -IZ), y + 1.05);
        rail(bl, v3(IX0, 0, -IZ), v3(IX0, 0, y === L2 ? -1.4 : IZ), y + 1.05); if (y === L2) rail(bl, v3(IX0, 0, 1.4), v3(IX0, 0, IZ), y + 1.05); rail(bl, v3(IX1, 0, -IZ), v3(IX1, 0, IZ), y + 1.05); }
      // sweeping stairs up the side walls, casino floor to the L2 balconies
      // the sweeping stairs climb along each side from the casino floor and land flush on the west balcony (owner: they
      // ended in mid-air beside it); the slab's top meets the floor at the bottom and the balcony's top at L2
      for (const s of [-1, 1]) { const st = O('Grand Staircase', 'deco'), z = s * (ZW - BW - 0.8), x0 = 0.6, x1 = AX0 + BW - 0.25, rise = (L2 - DECK) / (x0 - x1), cx = 0.12 / Math.cos(Math.atan(rise));
        slope(st, x0 + 0.2, DECK - cx - 0.2 * rise, x1, L2 - cx, z, 0.75, 'carpet');
        for (const dz of [-0.75, 0.75]) pipe(st, v3(x0, DECK + 0.95, z + dz), v3(AX0 + BW, L2 + 0.95, z + dz), 0.03, 'brass', NS); }
      // the ceiling grid: 0.66 m openings, backlit neon bars, centred in the atrium in line with the L3 balcony rail (owner,
      // 2026-11-18), hung from the skylight frame; an open square in the middle lets the chandelier hang through it, so
      // the hoop dive stays clear. Its openings are four strips round that square (flying through the square isn't a
      // grid pass).
      { const gr = O('Ceiling Grid', 'deco'), N = 16, H = 4, P = 0.66, GY = L3 + 1.05, cx = (AX0 + AX1) / 2, gx0 = cx - N * P / 2, gz0 = -N * P / 2, G = { glow: true, noSurvey: true };
        const inHole = k => k > H && k < N - H;
        for (let k = 0; k <= N; k++) { const z = gz0 + k * P, x = gx0 + k * P;
          for (const [a, b] of inHole(k) ? [[0, H], [N - H, N]] : [[0, N]]) {
            box(gr, v3(gx0 + (a + b) * P / 2, GY, z), v3((b - a) * P / 2 + 0.03, 0.03, 0.03), 'neonCyan', 0, 0, 0, G);
            box(gr, v3(x, GY, gz0 + (a + b) * P / 2), v3(0.03, 0.03, (b - a) * P / 2 + 0.03), 'neonCyan', 0, 0, 0, G); } }
        for (const dx of [0, N]) for (const dz of [0, N]) pipe(gr, v3(gx0 + dx * P, GY, gz0 + dz * P), v3(gx0 + dx * P, ROOF - 0.3, gz0 + dz * P), 0.025, 'brass', NS);
        const strip = (i0, i1, k0, k1) => gapO('Ceiling Grid', v3(gx0 + (i0 + i1) * P / 2, GY, gz0 + (k0 + k1) * P / 2), v3(0, 1, 0), v3(1, 0, 0), (i1 - i0) * P / 2 - 0.05, (k1 - k0) * P / 2 - 0.05).gap.cells = P;
        strip(0, N, 0, H); strip(0, N, N - H, N); strip(0, H, H, N - H); strip(N - H, N, H, N - H); }
      // the chandelier: three tiered neon hoops hung on chains from the skylight frame, centres clear all the way down:
      // dive straight through all three; the smallest is 0.8 m inside. The whole thing is an over/under for powerloops.
      { const ch = O('Neon Chandelier', 'overunder'), C = v3(2, 0, 0), tiers = [[2.1, 15.3, 'neonPink', 0.06], [1.3, 14.2, 'neonCyan', 0.05], [0.45, 13.1, 'neonLime', 0.05]];
        for (const [R, y, m, r] of tiers) { hoop(ch, v3(C.x, y, C.z), v3(0, 1, 0), R, r, R > 1 ? 24 : 14, m); gapO('Chandelier Hoop', v3(C.x, y, C.z), v3(0, 1, 0), v3(1, 0, 0), (R - r - 0.06) / Math.SQRT2, (R - r - 0.06) / Math.SQRT2); }
        for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4, A = (R, y) => v3(C.x + Math.cos(a) * R, y, C.z + Math.sin(a) * R);
          pipe(ch, A(2.1, 15.3), A(3.4, ROOF - 0.35), 0.015, 'brass', NS); pipe(ch, A(1.3, 14.2), A(2.1, 15.3), 0.012, 'brass', NS); pipe(ch, A(0.45, 13.1), A(1.3, 14.2), 0.012, 'brass', NS);
          for (const [R, y] of [[2.1, 15.3], [1.3, 14.2]]) ball(ch, A(R, y - 0.25), 0.09, k % 2 ? 'neonPurple' : 'neonMagenta', { glow: true }); }
        ch.round = { c: v3(C.x, 0, C.z), r: 2.2, under: 13.05, over: 15.36 }; ch.obstacle = { a: v3(C.x - 2.2, 0, C.z), b: v3(C.x + 2.2, 0, C.z), under: 13.05, over: 15.36 }; }
      O('Chandelier Light', 'deco', { light: v3(2, 12, 0), lightColor: 0xff4fd0, lightPower: 40, lightRange: 24 });
      // the skylight roof: a frame of beams with glass panes, four panes shattered (dive in from the roof)
      { const sk = O('Atrium Skylight', 'deco'), xs = [AX0, -3, 2, 7, AX1], zs = [-ZW, -4.5, 0, 4.5, ZW], broken = new Set(['1,1', '2,2', '1,2', '3,0']);
        for (const x of xs) box(sk, v3(x, ROOF - 0.144, 0), v3(0.12, 0.15, ZW - 0.004), 'brass'); for (const z of zs) box(sk, v3((AX0 + AX1) / 2, ROOF - 0.147, z), v3((AX1 - AX0) / 2 - 0.004, 0.15, 0.12), 'brass');   // a few mm proud of the roof, the cross bars just under the long ones
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2, hx = (xs[i + 1] - xs[i]) / 2 - 0.12, hz = (zs[j + 1] - zs[j]) / 2 - 0.12;
          if (broken.has(i + ',' + j)) { gapO('Shattered Skylight', v3(cx, ROOF - 0.15, cz), v3(0, 1, 0), v3(1, 0, 0), hx - 0.1, hz - 0.1);
            for (let k = 0; k < 4; k++) box(sk, v3(cx + (k % 2 ? 1 : -1) * (hx - 0.12), ROOF - 0.2, cz + (k < 2 ? 1 : -1) * (hz - 0.1)), v3(0.25, 0.01, 0.1), 'glassBlock', k, 0.3, 0, ND); }
          else box(sk, v3(cx, ROOF - 0.15, cz), v3(hx, 0.02, hz), 'glassBlock', 0, 0, 0, NS); } } }

    // ---------------------------------------------------------------- forward: the Starlight Lounge, double height, shattered skylights
    { const lo = O('Starlight Lounge', 'wall'), LX0 = 12, LX1 = SX1;
      for (const s of [-1, 1]) { wallH(lo, 'x', s * ZW, LX0, LX1, DECK, L3, WT, [], 'hullWhite'); for (const y of [DECK + 2, L2 + 1.5]) box(lo, v3((LX0 + LX1) / 2, y, s * (ZW + 0.11)), v3(10.5, 0.3, 0.01), 'windowLit', 0, 0, 0, GL); }
      // roof (y 14) with two shattered skylights under the crane's boom (2.5 x 2.5 m)
      const rf = O('Sun Deck', 'deco'), holes = [[18.75, 21.25], [26.75, 29.25]];
      box(rf, v3(15.375, L3 - T, 0), v3(3.375, T, ZW), 'teakWet', 0, 0, 0, NS); box(rf, v3(24, L3 - T, 0), v3(2.75, T, ZW), 'teakWet', 0, 0, 0, NS); box(rf, v3(31.625, L3 - T, 0), v3(2.375, T, ZW), 'teakWet', 0, 0, 0, NS);
      for (const [a, b] of holes) { for (const s of [-1, 1]) box(rf, v3((a + b) / 2, L3 - T, s * (ZW + 1.25) / 2), v3((b - a) / 2, T, (ZW - 1.25) / 2), 'teakWet', 0, 0, 0, NS);
        gapO('Shattered Skylight', v3((a + b) / 2, L3 - T, 0), v3(0, 1, 0), v3(1, 0, 0), 1.15, 1.15);
        for (let k = 0; k < 6; k++) box(rf, v3(a + 0.15 + (k % 3) * 1.05, L3 - 0.05, (k < 3 ? -1 : 1) * 1.15), v3(0.22, 0.01, 0.08), 'glassBlock', k * 0.7, 0.4, 0, ND); }
      rail(rf, v3(LX0, 0, -ZW + 0.2), v3(LX1, 0, -ZW + 0.2), L3 + 1.05, 2.2); rail(rf, v3(LX0, 0, ZW - 0.2), v3(LX1, 0, ZW - 0.2), L3 + 1.05, 2.2);
      box(lo, v3(23, DECK + 0.028, 0), v3(4.5, 0.006, 4.5), 'checker', 0, 0, 0, ND);
      const bar2 = O('Lounge Bar', 'overunder'); box(bar2, v3(31.5, DECK + 0.55, 0), v3(0.4, 0.55, 5), 'glassBlock'); box(bar2, v3(31.5, DECK + 1.12, 0), v3(0.5, 0.03, 5.1), 'brass');
      bar2.obstacle = { a: v3(31.5, 0, -5), b: v3(31.5, 0, 5), under: DECK, over: DECK + 1.15 };
      const mb = O('Mirror Ball', 'overunder'); pipe(mb, v3(23, L3 - 0.3, -4), v3(23, 11.9, -4), 0.01, 'galv', NS); ball(mb, v3(23, 11.4, -4), 0.55, 'chrome');
      mb.round = { c: v3(23, 0, -4), r: 0.6, under: 10.85, over: 11.95 }; mb.obstacle = { a: v3(22.4, 0, -4), b: v3(23.6, 0, -4), under: 10.85, over: 11.95 };
      for (const z of [-5.5, 5.5]) { const gb = O('Glass Block Partition', 'overunder'); box(gb, v3(17, DECK + 0.75, z), v3(2, 0.75, 0.08), 'glassBlock'); gb.obstacle = { a: v3(15, 0, z), b: v3(19, 0, z), under: DECK, over: DECK + 1.5 }; }
      for (const z of [-8.7, 8.7]) box(lo, v3(23, L2 + 2.6, z), v3(10.5, 0.04, 0.04), z < 0 ? 'neonMagenta' : 'neonCyan', 0, 0, 0, GL);
      O('Lounge Light', 'deco', { light: v3(24, 11.5, 0), lightColor: 0x55f6ff, lightPower: 32, lightRange: 20 }); }
    // the bow deck: winches, a mast to orbit, navigation lights
    { const bw = O('Anchor Winch', 'overunder'); for (const s of [-1, 1]) { box(bw, v3(42, DECK + 0.5, s * 3), v3(0.9, 0.5, 0.6), 'craneYellow'); pipe(bw, v3(42, DECK + 0.6, s * 3 - 0.8), v3(42, DECK + 0.6, s * 3 + 0.8), 0.25, 'darkMetal', NS); } }
    { const m = O('Bow Mast', 'pole'); pipe(m, v3(46, DECK, 0), v3(46, DECK + 12, 0), 0.14, 'hullWhite'); pipe(m, v3(46, DECK + 9, -1.4), v3(46, DECK + 9, 1.4), 0.05, 'hullWhite', NS);
      ball(m, v3(46, DECK + 12.2, 0), 0.18, 'neonLime', { noCollide: true, glow: true }); for (const s of [-1, 1]) ball(m, v3(46, DECK + 9, s * 1.45), 0.12, s < 0 ? 'policeRed' : 'neonLime', { noCollide: true, glow: true }); }

    // ---------------------------------------------------------------- starboard lifeboats, 0.5 m off the windows
    for (const x0 of [-3, 5.5, 17.5, 26.5]) { const lb = O('Lifeboat', 'overunder'), y0 = L2 + 1.0, bz = ZW + WT / 2 + 0.5 + 0.95;   // inner side 0.5 m from the wall's face
      box(lb, v3(x0, y0 + 0.5, bz), v3(2.9, 0.5, 0.95), 'lifeboat'); box(lb, v3(x0, y0 + 1.15, bz), v3(2.3, 0.18, 0.8), 'hullWhite'); box(lb, v3(x0, y0 + 0.02, bz), v3(2.6, 0.04, 0.6), 'hullNavy');
      for (const s of [-1, 1]) { const px = x0 + s * 3.3; pipe(lb, v3(px, DECK, ZW + 1.6), v3(px, y0 + 2.5, ZW + 1.6), 0.09, 'hullWhite'); pipe(lb, v3(px, y0 + 2.5, ZW + 1.6), v3(px, y0 + 2.5, bz), 0.07, 'hullWhite', NS);
        pipe(lb, v3(px, y0 + 2.5, bz), v3(x0 + s * 2.6, y0 + 1.3, bz), 0.012, 'galv', ND); }
      lb.obstacle = { a: v3(x0 - 2.9, 0, bz), b: v3(x0 + 2.9, 0, bz), under: y0, over: y0 + 1.33 };
      gapO('Lifeboat Squeeze', v3(x0, y0 + 0.66, ZW + WT / 2 + 0.25), v3(1, 0, 0), v3(0, 0, 1), 0.19, 0.6); }

    // ---------------------------------------------------------------- the port crane on the pier, its boom leaning over the bow
    { const cr = O('Port Crane', 'pole'), BX = 40, BZ = -20, top = 30;
      for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) pipe(cr, v3(BX + dx, 1.5, BZ + dz), v3(BX + dx * 0.55, top, BZ + dz * 0.55), 0.22, 'craneYellow');
      for (let y = 4; y < top; y += 4) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { const k = 2.2 - 0.45 * 2.2 * (y - 1.5) / (top - 1.5) * 1.0;
        pipe(cr, v3(BX + a[0] * k, y, BZ + a[1] * k), v3(BX + b[0] * k, y + 4 > top ? top : y + 2, BZ + b[1] * k), 0.06, 'craneYellow', NS); }
      box(cr, v3(BX, top + 1.6, BZ), v3(3, 1.6, 2.6), 'craneYellow'); box(cr, v3(BX + 3.05, top + 1.9, BZ), v3(0.02, 0.6, 1.8), 'windowLit', 0, 0, 0, GL);
      // the boom: two chords and lacing, from the cab out over the lounge's skylights, its tip at (28, 22.5, 1)
      const b0 = v3(BX - 1, top + 2.6, BZ + 1), b1 = v3(26, 23.2, 1.2), side = norm(cross(sub(b1, b0), v3(0, 1, 0)));
      const bm = O('Crane Boom', 'overunder');
      for (const s of [-1, 1]) pipe(bm, add(b0, mul(side, s * 0.7)), add(b1, mul(side, s * 0.45)), 0.14, 'craneYellow');
      for (let f = 0; f < 1; f += 0.06) { const p = add(b0, mul(sub(b1, b0), f)), q = add(b0, mul(sub(b1, b0), f + 0.06)); pipe(bm, add(p, mul(side, -0.6)), add(q, mul(side, 0.6)), 0.04, 'craneYellow', NS); }
      bm.obstacle = { a: v3(b0.x, 0, b0.z), b: v3(b1.x, 0, b1.z), under: b1.y - 0.2, over: b1.y + 0.2 };
      const hk = O('Crane Hook', 'deco'); pipe(hk, b1, v3(b1.x, 17.2, b1.z), 0.02, 'galv'); box(hk, v3(b1.x, 16.7, b1.z), v3(0.35, 0.45, 0.25), 'hazard'); }

    // ---------------------------------------------------------------- the main deck walks along both sides; a sign
    { const sg = O('Ship Drugs Sign', 'deco'); box(sg, v3(-8, ROOF + 1.6, 0), v3(0.1, 1.4, 5.5), 'carBlack');
      for (const [dz, m] of [[-4, 'neonMagenta'], [-1.3, 'neonCyan'], [1.3, 'neonLime'], [4, 'neonPurple']]) box(sg, v3(-7.88, ROOF + 1.6, dz), v3(0.02, 1.1, 1.0), m, 0, 0, 0, GL); }

    return K.done({ id: 'ship', title: 'Ship Drugs', theme: 'vice', zones, spawn: { pos: v3(-23, 1.53, -17.5), yaw: Math.PI }, bounds: { x: [-56, 58], z: [-28, 16] } });
  }

  // =============================================================== The Murderdome
  // A blood-and-rust whoop pit in the ruins of an old sports dome (the pilot's brief, 2026-11-18; Spider Sugar FPV and the
  // Dirtbag FPV club's spirit). One continuous circuit inside the dome, clockwise from the south: 1 Blood Oath (the start:
  // a bus-chassis gantry, a skull flag, a dusty straight between burning barrels), 2 Scrap Canyon (a narrow corridor of
  // containers and crushed cars, rebar gates, low ceilings, hanging candy chains), 3 War Rig Climb (a ramp up a semi-truck
  // skeleton, through the cab and its steering-wheel ring, off the roof onto sand), 4 Dirtbag Lounge (couches, a couch
  // tunnel, a pool table, a pinball machine, fridges, bandana flags), 5 the Murder Dome proper (a banked dirt bowl, gates
  // hung on chains from a ring truss, the Altar with its fire and the Spider Sugar sign), 6 the Chain-Link Labyrinth (a
  // maze of soft chain-link), 7 the Pit (a hole in a raised deck into a red-lit room with tire rings and a swinging-tire
  // gauntlet), 8 Witness Me (the finish straight to two exhaust stacks). The roof is caved in over the south and the middle:
  // the low dusk sun comes through it. x east, z south. Surfaces: chain-link and foam junk are soft (duct bounce), rebar and
  // car frames hard, oil slicks slippery, sand dead. Two dust devils shove you round (world.fields, kind 'swirl').
  // Not in (the physics world is static): swaying gates, destructible props, confetti, kill-cams, the dirtbag radio.
  function buildMurderdome() {
    const K = kit(), { O, box, pipe, ball, disc } = K, { frame } = parts(K), zones = [], fields = [];
    let seed = 6669; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const SOFT = { e: 0.45, f: 0.3 }, HARD = { e: 0.12, f: 0.9, crash: 5 }, SLICK = { e: 0.1, f: 0.04 }, SAND = { e: 0.03, f: 1.1 }, PLATE = { e: 0.55, f: 0.4 };
    const surf = (o, S0, from = 0) => { for (let i = from; i < o.prims.length; i++) o.prims[i].surf = S0; return o; };
    const sign = (o, c, w, h, ry, mat, both = true) => { const sb = makeBox(c, v3(w / 2, h / 2, 0.035), ry); sb.leaf = true; o.prims.push(sb); o.vis.push({ shape: 'sign', c, w, h, ry, mat, glow: true });   // solid: a sign is a panel, not a hologram (owner: "you should not be able to fly through the spider sugar sign")
      if (both) o.vis.push({ shape: 'sign', c: v3(c.x - Math.sin(ry) * 0.02, c.y, c.z - Math.cos(ry) * 0.02), w, h, ry: ry + Math.PI, mat, glow: true }); };
    const lamp = (name, at, col, pw, rg) => O(name, 'deco', { light: at, lightColor: col, lightPower: pw, lightRange: rg });
    const barrel = (x, z, lit, y = 0, name = 'Burning Barrel') => { const o = O(name, 'deco'); pipe(o, v3(x, y, z), v3(x, y + 0.9, z), 0.29, 'rustRed'); pipe(o, v3(x, y + 0.88, z), v3(x, y + 1.55, z), 0.24, 'fire', { noCollide: true, glow: true, cone: true });
      pipe(o, v3(x, y + 0.88, z), v3(x, y + 1.25, z), 0.14, 'fireCore', { noCollide: true, glow: true, cone: true }); if (lit) lamp('Barrel Fire', v3(x, y + 1.8, z), 0xff8a30, 5, 11); return o; };
    const ring = (name, c, r, n, rp, mat, S0) => { const o = O(name, 'overunder'), N = 14, nx = n.x, nz = n.z, ux = -nz, uz = nx;   // a round gate standing up, its axis n (horizontal)
      for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2, P = a => v3(c.x + ux * Math.cos(a) * r, c.y + Math.sin(a) * r, c.z + uz * Math.cos(a) * r); pipe(o, P(a0), P(a1), rp, mat); }
      if (S0) surf(o, S0); const q = (r - rp - 0.05) * 0.62; O(name + ' opening', 'gap', { gap: { c, n: v3(nx, 0, nz), hu: q, hv: q, u: v3(ux, 0, uz) } }); return o; };
    const RW = 44, HW = 7, ribY = r => HW + 17 * Math.sqrt(Math.max(0, 1 - (r / RW) ** 2));

    // ---- the dome: a broken outer wall, ribs (snapped over the south half), roof panels left only over the north
    { const N = 32; for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * Math.PI * 2, gap = i % 11 === 5, low = i % 7 === 3; if (gap) continue;
        const h = low ? 3.6 : HW, ch = Math.PI * RW / N + 0.15, o = O('Dome Wall', 'wall', { wallNormal: v3(-Math.cos(a), 0, -Math.sin(a)) });
        box(o, v3(Math.cos(a) * (RW + 0.4), h / 2, Math.sin(a) * (RW + 0.4)), v3(ch, h / 2, 0.4), 'crackedConcrete', -a - Math.PI / 2); } }
    for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2, south = Math.sin(a) > -0.15, r1 = south ? 27 + 4 * rnd() : 17, o = O('Dome Rib', 'deco'); let pr = RW;
      for (let r = RW - 6; r >= r1 - 0.01; r -= 6) { pipe(o, v3(Math.cos(a) * pr, ribY(pr), Math.sin(a) * pr), v3(Math.cos(a) * r, ribY(r), Math.sin(a) * r), 0.32, 'rustRed', { noSurvey: true }); pr = r; }
      // over/unders along the rib (owner: "these large things that stuck out wouldn't count"): every metre of it no steeper than
      // ~40° (the ends by the wall stand nearly upright), at the rib's height there (it is drawn in 6 m chords of the curve, so
      // the heights follow the chords); unders only count up to 3 m below it, so low flying across the floor never does.
      const nSeg = Math.floor((RW - r1 + 0.01) / 6), rEnd = RW - 6 * nSeg, chordY = r => { const k = Math.min(nSeg - 1, Math.floor((RW - r) / 6)), ra = RW - 6 * k; return ribY(ra) + (ribY(ra - 6) - ribY(ra)) * (ra - r) / 6; };
      for (let r = RW - 4; r - 1 >= rEnd - 0.01; r -= 1) { const ya = chordY(r), yb = chordY(r - 1); if (Math.abs(ya - yb) > 0.85) continue;
        O('Dome Rib', 'overunder', { obstacle: { a: v3(Math.cos(a) * r, 0, Math.sin(a) * r), b: v3(Math.cos(a) * (r - 1), 0, Math.sin(a) * (r - 1)), under: Math.min(ya, yb) - 0.32, over: Math.max(ya, yb) + 0.32, floor: Math.min(ya, yb) - 3.3 } }); } }
    { const o = O('Dome Roof', 'deco'), bands = [[RW, 34], [34, 25], [25, 17.5]];
      for (let k = 0; k < 16; k++) { const a = (k + 1) / 16 * Math.PI * 2; if (Math.sin(a) > -0.3) continue;
        for (const [ro, ri] of bands) { if (rnd() < 0.22) continue; const rm = (ro + ri) / 2, yo = ribY(ro), yi = ribY(ri), L = Math.hypot(ro - ri, yi - yo) / 2, wt = Math.PI * rm / 16 + 0.05;
          box(o, v3(Math.cos(a) * rm, (yo + yi) / 2, Math.sin(a) * rm), v3(wt, 0.1, L), 'rustRed', Math.PI / 2 - a, Math.atan2(yi - yo, ro - ri), 0, { noSurvey: true }); } } }
    // searchlights on the ground throwing beams up through the caved-in roof into the dusk (owner, 2026-11-18): the base is
    // solid, the drum, lens and beam are drawn and swept by worldview.js (duskBackdrop / duskTick: world.searchlights)
    const searchlights = [];
    [[-2, 39.5, 0.3, 64], [13, 39, -0.5, 70], [31, 21, -1.9, 66], [36, 4, -2.3, 72], [-9, 13, 2.6, 60], [-26, 54, 0.7, 58], [44, 46, -0.9, 62]].forEach(([x, z, yaw, el], i) => {
      const o = O('Searchlight', 'deco'); box(o, v3(x, 0.22, z), v3(0.42, 0.22, 0.42), 'rustRed'); for (const s of [-1, 1]) box(o, v3(x + s * 0.36, 0.72, z), v3(0.05, 0.3, 0.12), 'scrap', yaw);
      searchlights.push({ at: v3(x, 0.95, z), yaw, el, sweep: 0.35 + (i % 3) * 0.12, speed: 0.12 + (i % 4) * 0.035, phase: i * 1.7 }); });

    // ---- 1 Blood Oath: the bus-chassis gantry, the skull flag, the dusty straight between burning barrels (flown east)
    { const GX = -4, z0 = 29.4, z1 = 36.6, o = O('Blood Oath Gantry', 'overunder'); for (const z of [z0 - 0.3, z1 + 0.3]) { pipe(o, v3(GX, 0, z), v3(GX, 3.2, z), 0.4, 'busYellow'); pipe(o, v3(GX, 0, z), v3(GX, 0.14, z), 0.52, 'scrap', { noSurvey: true }); pipe(o, v3(GX, 3.06, z), v3(GX, 3.2, z), 0.5, 'scrap', { noSurvey: true }); }   // round pillars with a base plate and a collar under the beam
      box(o, v3(GX, 3.42, 33), v3(0.6, 0.22, 4.25), 'busYellow'); for (const dx of [-0.45, 0.45]) pipe(o, v3(GX + dx, 3.7, z0 - 0.3), v3(GX + dx, 3.7, z1 + 0.3), 0.07, 'rebar');
      for (let z = z0; z <= z1; z += 1.2) box(o, v3(GX, 3.9, z), v3(0.5, 0.1, 0.05), 'scrap');   // seat frames welded on top
      surf(o, HARD); o.obstacle = { a: v3(GX, 0, z0), b: v3(GX, 0, z1), under: 3.2, over: 3.64 };
      O('Blood Oath Gantry opening', 'gap', { gap: { c: v3(GX, 1.6, 33), n: v3(1, 0, 0), hu: 3.3, hv: 1.44, u: v3(0, 0, 1) } });
      const fl = O('Skull Flag', 'deco'); fl.vis.push({ shape: 'sign', c: v3(GX + 0.62, 2.62, 33), w: 2.4, h: 1.2, ry: Math.PI / 2, mat: 'skullFlag' }); for (const z of [31.85, 34.15]) pipe(fl, v3(GX + 0.6, 3.2, z), v3(GX + 0.63, 3.24, z), 0.015, 'rebar', { noCollide: true }); }   // the Dirtbag FPV flag, wired to the beam's face   // the Dirtbag FPV flag
    for (let x = -1; x <= 13; x += 3.5) for (const z of [28.6, 37.4]) barrel(x, z, z < 30 && (x === -1 || x === 9.5));
    zones.push({ shape: 'zone', mat: 'sand', c: v3(5, 0.006, 33), h: v3(10, 0, 4.5) });

    // ---- 2 Scrap Canyon: a hard left into a 4 m corridor (flown north), containers on the outside, crushed cars inside
    { const X0 = 22, X1 = 26, zs = [23.5, 17.3, 11.1, 4.9, -1.3, -7.5];
      for (const z of zs) { for (const lv of [0, 1]) { const o = O('Shipping Container', 'wall', { wallNormal: v3(-1, 0, 0) }); box(o, v3(X1 + 1.25, 1.3 + lv * 2.62, z), v3(1.22, 1.3, 3.05), lv ? 'scrap' : 'rustRed'); }
        if (Math.round(z) % 2) { const o = O('Shipping Container', 'wall', { wallNormal: v3(1, 0, 0) }); box(o, v3(X0 - 1.25, 1.3, z), v3(1.22, 1.3, 3.05), 'scrap'); }
        else { const o = O('Crushed Cars', 'wall', { wallNormal: v3(1, 0, 0) }); for (let i = 0; i < 4; i++) box(o, v3(X0 - 1.1 + (rnd() - 0.5) * 0.2, 0.36 + i * 0.7, z + (rnd() - 0.5) * 0.6), v3(1.0, 0.34, 2.2), i % 2 ? 'carBlack' : 'rustRed', (rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.08); surf(o, HARD); } }
      [20, 11.6, 3.6, -4.4].forEach((z, i) => { const g = frame(`Rebar Gate ${i + 1}`, (X0 + X1) / 2, z, 3.0, i % 2 ? 1.5 : 2.1, 'x', 'rebar'); surf(g, HARD);
        for (const s of [-1, 1]) box(g, v3((X0 + X1) / 2 + s * 1.6, 0.9, z - 0.1), v3(0.16, 0.08, 0.01), 'plate', 0, 0, (rnd() - 0.5) * 0.3, { noCollide: true }); });   // license plates
      for (const zc of [15.9, -0.2]) { const o = O('Canyon Low Ceiling', 'overunder'); box(o, v3((X0 + X1) / 2, 1.42, zc), v3(2.05, 0.06, 1.0), 'plate'); }
      for (const zb of [22, 8, -2.6]) { const o = O('Candy Chain Beam', 'deco'); pipe(o, v3(X0 - 1.6, 3.7, zb), v3(X1 + 1.6, 3.7, zb), 0.08, 'rebar', { noSurvey: true });
        const c = O('Candy Chains', 'deco'); for (let i = 0; i < 4; i++) { const x = X0 + 0.5 + i * 1.0, y0 = 1.7 + rnd() * 0.6, m = i % 2 ? 'candyPink' : 'candyYellow';
          pipe(c, v3(x, 3.62, zb), v3(x, y0, zb), 0.035, m, { noSurvey: true }); if (i % 2 === 0) ball(c, v3(x, y0 - 0.25, zb), 0.25, i % 4 ? 'candyPink' : 'flamingo'); } surf(c, SOFT); }
      const sg = O('Send It Sign', 'deco'); sign(sg, v3(X1 + 0.02, 4.2, 9), 3.2, 0.8, -Math.PI / 2, 'signSendIt', false);
      lamp('Canyon Work Lamp', v3(24, 3.4, 15), 0xffc07a, 7, 12); lamp('Canyon Work Lamp', v3(24, 3.4, -1), 0xff9ad8, 6, 12);
      zones.push({ shape: 'zone', mat: 'plate', c: v3((X0 + X1) / 2, 0.006, 8), h: v3(2, 0, 17) }); }

    // ---- 3 War Rig Climb (flown west along z = -24): a ramp up onto the trailer skeleton, through the cab and its steering
    // wheel, off the roof; a sand patch to land on (dead), scrap plates round it (they bounce you)
    { const Z = -24, o = O('War Rig Ramp', 'deco'); box(o, v3(19.5, 0.7, Z), v3(1.2, 0.05, 2.65), 'plate', Math.PI / 2, -Math.atan2(1.4, 5), 0, { noSurvey: true }); surf(o, PLATE);
      const tr = O('War Rig Trailer', 'overunder'); for (const dz of [-0.9, 0.9]) box(tr, v3(13, 1.35, Z + dz), v3(4, 0.12, 0.12), 'rustRed'); for (let x = 9.5; x <= 16.5; x += 1.75) box(tr, v3(x, 1.35, Z), v3(0.08, 0.08, 0.9), 'rustRed');
      surf(tr, HARD); tr.obstacle = { a: v3(13, 0, Z - 1), b: v3(13, 0, Z + 1), under: 1.23, over: 1.47 };
      const wh = O('War Rig Wheels', 'deco'); for (const x of [15.5, 11, 7.8]) for (const dz of [-1.05, 1.05]) pipe(wh, v3(x, 0.5, Z + dz - 0.17), v3(x, 0.5, Z + dz + 0.17), 0.5, 'tire');
      const cab = O('War Rig Cab', 'wall', { wallNormal: v3(-1, 0, 0) }), cx0 = 6.4, cx1 = 9, y0 = 0.9, y1 = 3.2, wz = 1.25, WY0 = 1.55, WY1 = 2.75, WW = 0.85;
      for (const s of [-1, 1]) box(cab, v3((cx0 + cx1) / 2, (y0 + y1) / 2, Z + s * wz), v3((cx1 - cx0) / 2, (y1 - y0) / 2, 0.06), 'busYellow');   // doors / sides
      box(cab, v3((cx0 + cx1) / 2, y1, Z), v3((cx1 - cx0) / 2 + 0.05, 0.08, wz + 0.06), 'busYellow'); box(cab, v3((cx0 + cx1) / 2, y0, Z), v3((cx1 - cx0) / 2, 0.08, wz), 'scrap');
      for (const x of [cx0, cx1]) { box(cab, v3(x, (y0 + WY0) / 2, Z), v3(0.06, (WY0 - y0) / 2, wz), 'busYellow'); box(cab, v3(x, (WY1 + y1) / 2, Z), v3(0.06, (y1 - WY1) / 2, wz), 'busYellow');
        for (const s of [-1, 1]) box(cab, v3(x, (WY0 + WY1) / 2, Z + s * (WW + (wz - WW) / 2)), v3(0.06, (WY1 - WY0) / 2, (wz - WW) / 2), 'busYellow');
        O('War Rig Cab window', 'gap', { gap: { c: v3(x, (WY0 + WY1) / 2, Z), n: v3(1, 0, 0), hu: WW - 0.07, hv: (WY1 - WY0) / 2 - 0.07, u: v3(0, 0, 1) } }); }
      surf(cab, HARD); ring('Steering Wheel Gate', v3(7.7, 2.15, Z), 0.5, v3(1, 0, 0), 0.04, 'carBlack', HARD);
      { const sc = O('Steering Column', 'deco'); pipe(sc, v3(7.7, 1.66, Z), v3(7.95, 0.98, Z), 0.045, 'carBlack', { noSurvey: true }); surf(sc, HARD); }
      const land = O('Landing Sand', 'deco'); box(land, v3(2.2, 0.012, Z), v3(2.6, 0.012, 2.6), 'sand'); surf(land, SAND);
      const pl = O('Scrap Plates', 'deco'); for (const [x, z] of [[-1.2, Z - 2.4], [-0.6, Z + 2.2], [5.6, Z + 2.8], [-1.6, Z]]) box(pl, v3(x, 0.015, z), v3(0.9, 0.015, 0.7), 'plate', rnd() * 3); surf(pl, PLATE);
      zones.push({ shape: 'zone', mat: 'dirt', c: v3(12, 0.006, Z), h: v3(12, 0, 4) }); }

    // ---- 4 Dirtbag Lounge (north, under what is left of the roof): a high line over the furniture, a crawl line under it
    { const Z0 = -27, legs = (o, cx, cz, hx, hz, hgt, m) => { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(o, v3(cx + sx * (hx - 0.05), (hgt - 0.05) / 2, cz + sz * (hz - 0.05)), v3(0.04, (hgt - 0.05) / 2, 0.04), m); };
      const couch = (name, cx, cz, ry) => { const o = O(name, 'deco'), cs = Math.cos(ry), sn = Math.sin(ry), at = (dx, dz) => v3(cx + dx * cs + dz * sn, 0, cz - dx * sn + dz * cs);
        { const p = at(0, 0); box(o, v3(p.x, 0.24, p.z), v3(1.05, 0.24, 0.42), 'couchRot', ry); } { const p = at(0, 0.34); box(o, v3(p.x, 0.62, p.z), v3(1.05, 0.38, 0.1), 'couchRot', ry); }
        for (const s of [-1, 1]) { const p = at(s * 0.96, 0); box(o, v3(p.x, 0.36, p.z), v3(0.12, 0.36, 0.42), 'couchRot', ry); } return o; };
      couch('Broken Couch', 2, Z0 - 3, 0.3); couch('Broken Couch', -14, Z0 - 6.5, -0.4);
      // the couch tunnel: two couches back to back with a door laid across their tops (flown along x)
      couch('Couch Tunnel', -6.5, Z0 - 2.2, Math.PI); couch('Couch Tunnel', -6.5, Z0 - 3.6, 0);
      { const o = O('Couch Tunnel Roof', 'overunder'); box(o, v3(-6.5, 1.04, Z0 - 2.9), v3(1.15, 0.03, 1.0), 'oldWood'); O('Couch Tunnel opening', 'gap', { gap: { c: v3(-6.5, 0.55, Z0 - 2.9), n: v3(1, 0, 0), hu: 0.2, hv: 0.38, u: v3(0, 0, 1) } }); }
      { const o = O('Pool Table', 'overunder'); box(o, v3(-11, 0.8, Z0 - 1.5), v3(1.3, 0.06, 0.72), 'feltGreen'); for (const s of [-1, 1]) box(o, v3(-11, 0.9, Z0 - 1.5 + s * 0.74), v3(1.38, 0.05, 0.06), 'oldWood'); legs(o, -11, Z0 - 1.5, 1.3, 0.72, 0.75, 'oldWood'); }
      for (const [x, z] of [[-2.5, Z0 - 6], [-9, Z0 - 8.4]]) { const o = O('Crawl Table', 'overunder'); box(o, v3(x, 0.72, z), v3(0.75, 0.03, 0.45), 'oldWood'); legs(o, x, z, 0.75, 0.45, 0.7, 'oldWood'); }
      { const o = O('Pinball Machine', 'deco'); box(o, v3(-16.5, 0.75, Z0 - 2), v3(0.36, 0.1, 0.68), 'carBlack', 0, -0.12); for (const dz of [-0.6, 0.6]) for (const dx of [-0.3, 0.3]) box(o, v3(-16.5 + dx, 0.35, Z0 - 2 + dz), v3(0.03, 0.35, 0.03), 'galv');
        box(o, v3(-16.5, 1.35, Z0 - 2.65), v3(0.36, 0.45, 0.06), 'carBlack'); o.vis.push({ shape: 'sign', c: v3(-16.5, 1.35, Z0 - 2.58), w: 0.66, h: 0.5, ry: 0, mat: 'signCasino', glow: true }); }
      { const o = O('Dead Fridges', 'deco'); box(o, v3(-19, 0.9, Z0 + 0.2), v3(0.4, 0.9, 0.36), 'fridge', 0.2); box(o, v3(-20.4, 0.38, Z0 - 1.4), v3(0.9, 0.38, 0.36), 'fridge', 1.1); surf(o, HARD); }
      for (const [x, z, h] of [[0, Z0 - 0.5, 1.6], [-4, Z0 - 0.5, 0.9], [-9, Z0 - 5, 1.7], [-13, Z0 - 0.4, 1.0], [-17.5, Z0 - 6, 1.5]]) { const o = O('Bandana Flag', 'deco'); pipe(o, v3(x, 0, z), v3(x, h, z), 0.02, 'oldWood'); o.vis.push({ shape: 'sign', c: v3(x + 0.26, h - 0.18, z), w: 0.5, h: 0.32, ry: 0, mat: 'bandana' }); }
      const sg = O('Dirtbag Forever Sign', 'deco'); sign(sg, v3(-8, 4.6, -40.6), 4.2, 2.1, 0, 'signDirtbag', false); for (const x of [-10.02, -5.98]) pipe(sg, v3(x, 0, -40.7), v3(x, 5.75, -40.7), 0.07, 'rustRed'); box(sg, v3(-8, 3.5, -40.7), v3(2.1, 0.05, 0.05), 'rustRed', 0, 0, 0, { noSurvey: true });
      lamp('Lounge Neon', v3(-8, 4, -38.5), 0xd8ff8a, 9, 18); lamp('Lounge Lamp', v3(-12, 2.6, -29), 0xffb070, 7, 12);
      zones.push({ shape: 'zone', mat: 'oilCarpet', c: v3(-9, 0.006, Z0 - 4), h: v3(12, 0, 6) }); }

    // ---- 5 The Murder Dome proper: a banked dirt bowl (openings N, E, S, W), a ring truss on four scrap pylons with gates
    // hung from it on chains, and the Altar in the middle (a fire on top, the Spider Sugar sign over it)
    { const N = 20, ri = 10, ro = 15, hb = 2.2;
      for (let i = 0; i < N; i++) { if (i % 5 === 0) continue; const a = (i + 0.5) / N * Math.PI * 2, rm = (ri + ro) / 2, L = Math.hypot(ro - ri, hb) / 2, o = O('Dirt Banking', 'deco');
        box(o, v3(Math.cos(a) * rm, hb / 2, Math.sin(a) * rm), v3(Math.PI * rm / N + 0.12, 0.18, L), 'dirt', Math.PI / 2 - a, -Math.atan2(hb, ro - ri), 0, { noSurvey: true });
        box(o, v3(Math.cos(a) * (ro + 0.4), hb / 2, Math.sin(a) * (ro + 0.4)), v3(Math.PI * ro / N + 0.1, hb / 2, 0.4), 'scrap', -a - Math.PI / 2, 0, 0, { noSurvey: true }); }
      const RT = 17, YT = 11; for (const a of [0.25, 0.75, 1.25, 1.75].map(k => k * Math.PI)) { const o = O('Scrap Pylon', 'pole'); pipe(o, v3(Math.cos(a) * RT, 0, Math.sin(a) * RT), v3(Math.cos(a) * RT, YT, Math.sin(a) * RT), 0.5, 'scrap'); }
      for (let i = 0; i < 24; i++) { const a0 = i / 24 * Math.PI * 2, a1 = (i + 1) / 24 * Math.PI * 2, A = v3(Math.cos(a0) * RT, YT, Math.sin(a0) * RT), B = v3(Math.cos(a1) * RT, YT, Math.sin(a1) * RT);   // the ring truss: every segment an over/under (owner: tricks round it did not count)
        const o = O('Ring Truss', 'overunder', { obstacle: { a: v3(A.x, 0, A.z), b: v3(B.x, 0, B.z), under: YT - 0.18, over: YT + 0.18, floor: YT - 4 } }); pipe(o, A, B, 0.18, 'rustRed', { noSurvey: true }); }
      [0.125, 0.625, 1.125, 1.625].forEach((k, i) => { const a = k * Math.PI, c = v3(Math.cos(a) * RT, 0, Math.sin(a) * RT), t = v3(-Math.sin(a), 0, Math.cos(a)), u = v3(Math.cos(a), 0, Math.sin(a)), W = 0.9, Y0 = 3.4, Y1 = 5.2, o = O(`Chain Gate ${i + 1}`, 'overunder');
        const P = (s, y) => v3(c.x + u.x * s, y, c.z + u.z * s); pipe(o, P(-W, Y0), P(W, Y0), 0.05, 'rebar'); pipe(o, P(-W, Y1), P(W, Y1), 0.05, 'rebar'); pipe(o, P(-W, Y0), P(-W, Y1), 0.05, 'rebar'); pipe(o, P(W, Y0), P(W, Y1), 0.05, 'rebar');
        { const rc = RT * Math.cos(Math.PI / 24) - 0.1; for (const s of [-W, W]) pipe(o, P(s, Y1), v3(Math.cos(a) * rc + t.x * s * 0.07, YT - 0.12, Math.sin(a) * rc + t.z * s * 0.07), 0.025, 'chain', { noSurvey: true }); } surf(o, HARD);   // to the truss segment above (mid-segment the chord runs inside the circle)
        o.obstacle = { a: P(-W, 0), b: P(W, 0), under: Y0 - 0.05, over: Y0 + 0.05 }; O(`Chain Gate ${i + 1} opening`, 'gap', { gap: { c: v3(c.x, (Y0 + Y1) / 2, c.z), n: t, hu: W - 0.11, hv: (Y1 - Y0) / 2 - 0.11, u } }); });
      const al = O('The Altar', 'deco'); disc(al, v3(0, 0.8, 0), 3, 0.8, 'scrap'); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(al, v3(Math.cos(a) * 3.2, 0.25, Math.sin(a) * 3.2), v3(0.5, 0.25, 0.35), 'rustRed', -a, 0, 0, { noSurvey: true }); }
      barrel(0, 0, false, 1.6, 'Altar Fire');
      lamp('Altar Fire', v3(0, 3.4, 0), 0xff7a2a, 12, 22);
      const em = O('Spider Sugar Sign', 'deco'); for (const s of [-1, 1]) pipe(em, v3(s * 1.7, 1.6, -0.6), v3(s * 1.7, 7.2, -0.6), 0.09, 'rebar'); pipe(em, v3(-1.7, 7.2, -0.6), v3(1.7, 7.2, -0.6), 0.09, 'rebar');
      sign(em, v3(0, 5.3, -0.6), 3.2, 3.2, 0, 'signSpider');
      zones.push({ shape: 'zone', mat: 'dirt', c: v3(0, 0.006, 0), h: v3(10, 0, 10) }); }
    { const o = O('Oil Slick', 'deco'); for (const [x, z, r] of [[-6, -8, 1.6], [7, 6, 1.3], [-20, 33, 1.5], [-15, 33.5, 1.1], [14, 31, 1.2]]) box(o, v3(x, 0.01, z), v3(r, 0.01, r * 0.7), 'oilSlick', rnd() * 3); surf(o, SLICK); }
    // dust devils: they push you round and up (world.fields), drawn as a spinning haze
    for (const [x, z] of [[-17, -10], [17, -15]]) { O('Dust Devil', 'deco');   // drawn as a funnel of dust motes by worldview.js (duskDevils), from the swirl field
      fields.push({ kind: 'swirl', o: v3(x, 3, z), m: [1, 0, 0, 0, 1, 0, 0, 0, 1], h: v3(2.2, 3, 2.2), accel: 9 }); }

    // ---- 6 The Chain-Link Labyrinth (west): a maze of soft chain-link on a 3 m grid, in at the north, out at the south
    { const X0 = -39, Z0 = -12, C = 3, NX = 5, NZ = 8, H = 2.4, seen = new Set(), open = new Set(), key = (a, b) => a < b ? a + '|' + b : b + '|' + a, id = (i, j) => i + ',' + j;
      const st = [[2, 0]]; seen.add(id(2, 0)); while (st.length) { const [i, j] = st[st.length - 1], nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < NX && b < NZ && !seen.has(id(a, b)));
        if (!nb.length) { st.pop(); continue; } const [a, b] = nb[Math.floor(rnd() * nb.length)]; open.add(key(id(i, j), id(a, b))); seen.add(id(a, b)); st.push([a, b]); }
      for (let k = 0; k < 5; k++) { const i = Math.floor(rnd() * (NX - 1)), j = Math.floor(rnd() * NZ); open.add(key(id(i, j), id(i + 1, j))); }   // a few loops: more than one way through
      const panel = (x, z, alongX) => { const o = O('Chain-Link Fence', 'wall', { wallNormal: alongX ? v3(0, 0, 1) : v3(1, 0, 0) }); box(o, v3(x, H / 2, z), v3(alongX ? C / 2 : 0.025, H / 2, alongX ? 0.025 : C / 2), 'chainlink'); surf(o, SOFT); };
      for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) { const x = X0 + (i + 0.5) * C, z = Z0 + (j + 0.5) * C;
        if (i < NX - 1 && !open.has(key(id(i, j), id(i + 1, j)))) panel(x + C / 2, z, false); if (j < NZ - 1 && !open.has(key(id(i, j), id(i, j + 1)))) panel(x, z + C / 2, true); }
      for (let i = 0; i < NX; i++) { if (i !== 2) panel(X0 + (i + 0.5) * C, Z0, true); if (i !== 2) panel(X0 + (i + 0.5) * C, Z0 + NZ * C, true); }
      for (let j = 0; j < NZ; j++) { panel(X0, Z0 + (j + 0.5) * C, false); panel(X0 + NX * C, Z0 + (j + 0.5) * C, false); }
      { const o = O('Fence Posts', 'deco'); for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) pipe(o, v3(X0 + i * C, 0, Z0 + j * C), v3(X0 + i * C, H + 0.05, Z0 + j * C), 0.035, 'galv'); surf(o, SOFT); }
      for (const [j, nm] of [[0, 'Labyrinth Entrance'], [NZ, 'Labyrinth Exit']]) { const g = frame(nm, X0 + 2.5 * C, Z0 + j * C, 2.4, 2.0, 'x', 'galv'); surf(g, SOFT); }
      zones.push({ shape: 'zone', mat: 'concrete', c: v3(X0 + NX * C / 2, 0.006, Z0 + NZ * C / 2), h: v3(NX * C / 2, 0, NZ * C / 2) }); }

    // ---- 7 The Pit (south-west): a raised scrap deck with a hole in it; underneath, a red-lit room with tire rings, wires and
    // a swinging-tire gauntlet; out through the south door to the final straight
    { const X0 = -32, X1 = -16, Z0 = 14, Z1 = 26, Y = 3.2, HX = -24, HZ = 19, HH = 1.5, t = 0.12, dk = O('Pit Deck', 'building');
      box(dk, v3((X0 + HX - HH) / 2, Y, (Z0 + Z1) / 2), v3((HX - HH - X0) / 2, t, (Z1 - Z0) / 2), 'plate'); box(dk, v3((HX + HH + X1) / 2, Y, (Z0 + Z1) / 2), v3((X1 - HX - HH) / 2, t, (Z1 - Z0) / 2), 'plate');
      box(dk, v3(HX, Y, (Z0 + HZ - HH) / 2), v3(HH, t, (HZ - HH - Z0) / 2), 'plate'); box(dk, v3(HX, Y, (HZ + HH + Z1) / 2), v3(HH, t, (Z1 - HZ - HH) / 2), 'plate');
      O('The Pit Hole', 'gap', { gap: { c: v3(HX, Y, HZ), n: v3(0, 1, 0), hu: HH - 0.05, hv: HH - 0.05, u: v3(1, 0, 0) } });
      const DX = -29.5, DW = 0.9, DH = 1.5;
      const wl = (name, c, h, n) => { const o = O(name, 'wall', { wallNormal: n }); box(o, c, h, 'scrap'); return o; };
      wl('Pit Wall', v3(X0, Y / 2, (Z0 + Z1) / 2), v3(0.15, Y / 2, (Z1 - Z0) / 2), v3(1, 0, 0)); wl('Pit Wall', v3(X1, Y / 2, (Z0 + Z1) / 2), v3(0.15, Y / 2, (Z1 - Z0) / 2), v3(-1, 0, 0));
      wl('Pit Wall', v3((X0 + X1) / 2, Y / 2, Z0), v3((X1 - X0) / 2, Y / 2, 0.15), v3(0, 0, 1));
      { const o = O('Pit Wall', 'wall', { wallNormal: v3(0, 0, -1) }); box(o, v3((X0 + DX - DW) / 2, Y / 2, Z1), v3((DX - DW - X0) / 2, Y / 2, 0.15), 'scrap'); box(o, v3((DX + DW + X1) / 2, Y / 2, Z1), v3((X1 - DX - DW) / 2, Y / 2, 0.15), 'scrap'); box(o, v3(DX, (DH + Y) / 2, Z1), v3(DW, (Y - DH) / 2, 0.15), 'scrap'); }
      O('Pit Exit Door', 'gap', { gap: { c: v3(DX, DH / 2, Z1), n: v3(0, 0, 1), hu: DW - 0.06, hv: DH / 2 - 0.06, u: v3(1, 0, 0) } });
      { const o = O('Deck Columns', 'pole'); for (const [x, z] of [[-28, 17], [-20, 17], [-20, 23.5]]) pipe(o, v3(x, 0, z), v3(x, Y - t, z), 0.16, 'rustRed'); }
      ring('Pit Tire Ring 1', v3(-26.5, 1.25, HZ), 0.5, v3(1, 0, 0), 0.11, 'tire', SOFT); ring('Pit Tire Ring 2', v3(-29.5, 1.25, 21.5), 0.5, v3(0, 0, 1), 0.11, 'tire', SOFT);
      { const o = O('Tire Ring Chains', 'deco'); for (const [x, z, ux, uz] of [[-26.5, HZ, 0, 1], [-29.5, 21.5, 1, 0]]) for (const s of [-1, 1]) pipe(o, v3(x + ux * s * 0.32, 1.25 + 0.38, z + uz * s * 0.32), v3(x + ux * s * 0.42, Y - t, z + uz * s * 0.42), 0.018, 'chain', { noSurvey: true }); surf(o, SOFT); }
      { const o = O('Swinging Tires', 'deco'); [[DX - 0.6, 22.8], [DX + 0.6, 23.6], [DX - 0.5, 24.4], [DX + 0.5, 25.1]].forEach(([x, z]) => { pipe(o, v3(x, Y - t, z), v3(x, 1.75, z), 0.02, 'chain', { noSurvey: true }); pipe(o, v3(x - 0.15, 1.4, z), v3(x + 0.15, 1.4, z), 0.36, 'tire'); }); surf(o, SOFT); }
      { const o = O('Hanging Wires', 'deco'); for (let i = 0; i < 9; i++) { const x = X0 + 1 + rnd() * (X1 - X0 - 2), z = Z0 + 1 + rnd() * (Z1 - Z0 - 2); if (Math.hypot(x - HX, z - HZ) < 2) continue; pipe(o, v3(x, Y - t, z), v3(x + (rnd() - 0.5) * 0.3, Y - 0.9 - rnd() * 0.8, z), 0.012, 'carBlack', { noSurvey: true }); } surf(o, SOFT); }
      { const o = O('Emergency Lights', 'deco'); for (const [x, z] of [[X0 + 0.2, 18], [X1 - 0.2, 22], [-24, Z0 + 0.2]]) box(o, v3(x, 2.6, z), v3(0.14, 0.1, 0.14), 'emergency', 0, 0, 0, { noCollide: true, glow: true }); }
      lamp('Pit Emergency Light', v3(-27, 2.9, 18), 0xff3a22, 10, 13); lamp('Pit Emergency Light', v3(-20, 2.9, 23), 0xff3a22, 10, 13);
      { const o = O('Sparks', 'deco', { float: true }); for (let i = 0; i < 12; i++) box(o, v3(X1 - 0.3, 0.3 + rnd() * 1.2, 15 + rnd() * 2), v3(0.02, 0.02, 0.02), 'fireCore', rnd() * 3, 0, 0, { noCollide: true, glow: true }); }
      const sg = O("Sugar's Pit Sign", 'deco'); sign(sg, v3(-24, Y + 1.0, Z1 + 0.2), 4.4, 1.1, 0, 'signSugar', false); pipe(sg, v3(-26.22, Y, Z1 + 0.2), v3(-26.22, Y + 1.6, Z1 + 0.2), 0.05, 'rebar'); pipe(sg, v3(-21.78, Y, Z1 + 0.2), v3(-21.78, Y + 1.6, Z1 + 0.2), 0.05, 'rebar'); }

    // ---- 8 Witness Me: out of the pit, a long drag east, slightly uphill, to the exhaust-stack finish, barrels both sides
    { const o = O('Witness Me Ramp', 'deco'); box(o, v3(-20, 0.36, 33), v3(7.2, 0.06, 3.2), 'plate', 0, 0, Math.atan2(0.7, 14.4), { noSurvey: true }); box(o, v3(-10.5, 0.36, 33), v3(2.6, 0.36, 3.2), 'plate'); surf(o, PLATE); }
    { const FX = -10, za = 30.2, zb = 35.8, Y0 = 0.72, YB = 3.5, o = O('Witness Me Finish', 'overunder'); for (const z of [za, zb]) { pipe(o, v3(FX, Y0, z), v3(FX, 5.8, z), 0.22, 'rustRed'); pipe(o, v3(FX, 5.6, z), v3(FX, 6.2, z), 0.26, 'carBlack'); }
      pipe(o, v3(FX, YB, za), v3(FX, YB, zb), 0.12, 'rebar'); surf(o, HARD); o.obstacle = { a: v3(FX, 0, za), b: v3(FX, 0, zb), under: YB - 0.12, over: YB + 0.12 };
      O('Witness Me Finish opening', 'gap', { gap: { c: v3(FX, (Y0 + YB - 0.12) / 2, 33), n: v3(1, 0, 0), hu: (zb - za) / 2 - 0.3, hv: (YB - 0.12 - Y0) / 2 - 0.06, u: v3(0, 0, 1) } });
      sign(o, v3(FX, 4.5, 33), (zb - za) - 0.4, 1.1, -Math.PI / 2, 'signWitness'); lamp('Finish Glow', v3(FX + 0.5, 4.4, 33), 0xffa040, 6, 12); }
    for (let x = -28; x <= -14; x += 3.5) for (const z of [29.2, 36.8]) barrel(x, z, false);
    zones.push({ shape: 'zone', mat: 'crackedConcrete', c: v3(0, 0.004, 0), h: v3(RW, 0, RW) });
    zones.unshift(zones.pop());   // the cracked floor first, the patches on top of it
    return K.done({ id: 'murderdome', title: 'The Murderdome', theme: 'dusk', zones, fields, searchlights, spawn: { pos: v3(-7, 0.03, 33), yaw: -Math.PI / 2 }, bounds: { x: [-RW - 1, RW + 1], z: [-RW - 1, RW + 1] } });
  }
  // =============================================================== Slackvegan City (theme 'nyc'; owner's design brief, 2026-11-19)
  // A dense, slightly sticky New York city block frozen in late-afternoon light. 1 unit = 1 m; x runs east, z south. The avenue
  // runs east-west (road z 0..12, sidewalks -4..0 and 12..16) under an elevated subway (pillars at z 0.9 / 11.1 every 10 m, the
  // deck 6.3-7.0 m up, a train parked over x -5..25). South of it: the bakery, the deli and the corner bodega (and its cat),
  // a cross street (x 20..26) and the brutalist skyscraper (x 26..44, z 20..38, 48 m) with round voids into two sky lobbies
  // (A 18-25 m, B 32-38 m) and the Spine, a 6 x 6 m shaft from the roof to the lobby. North of it: walk-ups, the water tower roof.
  // The circuit (clockwise-ish): 1 Yellow Fever east down the avenue between stopped taxis, under signal-arm gates; 2 hard right
  // along the bakery and deli; 3 up the skyscraper's fire escape on the cross street; 4 in through a round void into sky lobby A,
  // the web of round openings (out and up to B); 5 the Spine: drop down the shaft through its slalom gates, out of the lobby's round
  // arch; 6 west under the El through gates hung from its beams, over the deck; 7 up onto the water-tower roof, then the steep
  // gates down to the finish: a neon frame under the tracks right above the start box. Static world: the cars are parked, the
  // train waits at its signal.
  function buildSlackvegan() {
    const K = kit(), { O, box, pipe, ball, neon, together } = K, { frame, bar } = parts(K), zones = [];
    let seed = 7070; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const SOFT = { e: 0.45, f: 0.35 }, HARD = { e: 0.12, f: 0.9, crash: 5 }, NS = { noSurvey: true };
    const surf = (o, S0, from = 0) => { for (let i = from; i < o.prims.length; i++) o.prims[i].surf = S0; return o; };
    const lamp = (name, at, col, pw, rg) => O(name, 'deco', { light: at, lightColor: col, lightPower: pw, lightRange: rg });
    const gapO = (name, c, n, u, hu, hv) => O(name, 'gap', { gap: { c, n, u, hu, hv } });
    // a flat picture: a neon sign, a shop window's display, a painted decal (rx -π/2 lies it on the ground); solid unless told
    const pic = (o, c, w, h, ry, mat, opt = {}) => { if (opt.solid !== false) { const sb = makeBox(c, v3(w / 2, h / 2, 0.035), ry); sb.leaf = true; if (opt.surf) sb.surf = opt.surf; o.prims.push(sb); }
      o.vis.push({ shape: 'sign', c, w, h, ry, rx: opt.rx || 0, mat, glow: opt.glow !== false });
      if (opt.both) o.vis.push({ shape: 'sign', c: v3(c.x - Math.sin(ry) * 0.02, c.y, c.z - Math.cos(ry) * 0.02), w, h, ry: ry + Math.PI, mat, glow: opt.glow !== false }); };
    // a wall along x (axis 'x', at z = fixed) or along z (axis 'z', at x = fixed) from u0 to u1, y0 to y1, thickness t, with
    // holes: rectangles { a, b, y0, y1 } or circles { u, y, r }. A round hole is drawn smooth (owner, 2026-11-19: the stepped
    // slices and the 18-piece trim looked odd): the wall is built round the circle's square, the square is drawn as one panel
    // with a truly round hole (vis 'holeplate') and a smooth ring (vis 'torus'); what collides there is undrawn: 16 slices
    // filling the square's corners to the circle, and a ring of capsules under the drawn one
    const wall = (o, axis, fixed, u0, u1, y0, y1, t, holes, mat, trim = 'nycTrim') => {
      const rect = [], ND = { noSurvey: true, noDraw: true }, tex0 = axis === 'x' ? v3(u0, 0, 0) : v3(0, 0, u0), WO = { noSurvey: true, tex0 };   // tex0: the wall's windows start at its own end
      for (const h of holes) { if (h.r == null) { rect.push(h); continue; }
        rect.push({ a: h.u - h.r, b: h.u + h.r, y0: h.y - h.r, y1: h.y + h.r });
        const N = 16, at = (u, y) => axis === 'x' ? v3(u, y, fixed) : v3(fixed, y, u), hb = (hu, hy) => axis === 'x' ? v3(hu, hy, t / 2) : v3(t / 2, hy, hu);
        for (let i = 0; i < N; i++) { const ya = -h.r + 2 * h.r * i / N, yb = ya + 2 * h.r / N, ym = (ya + yb) / 2, w = Math.sqrt(Math.max(0, h.r * h.r - ym * ym)), hu = (h.r - w) / 2;
          if (hu > 0.003) for (const s of [-1, 1]) box(o, at(h.u + s * (w + hu), h.y + ym), hb(hu, (yb - ya) / 2 - 0.002), mat, 0, 0, 0, ND); }
        const tr = Math.min(0.2, t * 0.5), M = 24, P = a => at(h.u + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r);
        for (let i = 0; i < M; i++) pipe(o, P(i / M * Math.PI * 2), P((i + 1) / M * Math.PI * 2), tr, trim, ND);
        o.vis.push({ shape: 'holeplate', c: at(h.u, h.y), r: h.r, t, axis, mat, tex0 }, { shape: 'torus', c: at(h.u, h.y), r: h.r, tube: tr, axis, mat: trim }); }
      const seg = (a, b, ya, yb) => { ya += 0.004; yb -= 0.004; if (b - a < 0.01 || yb - ya < 0.01) return; const cu = (a + b) / 2, cy = (ya + yb) / 2, hu = (b - a) / 2, hy = (yb - ya) / 2;
        if (axis === 'x') box(o, v3(cu, cy, fixed), v3(hu, hy, t / 2), mat, 0, 0, 0, WO); else box(o, v3(fixed, cy, cu), v3(t / 2, hy, hu), mat, 0, 0, 0, WO); };
      const cuts = [...new Set([u0, u1, ...rect.flatMap(h => [h.a, h.b])])].filter(x => x >= u0 && x <= u1).sort((p, q) => p - q);
      for (let i = 0; i + 1 < cuts.length; i++) { const a = cuts[i], b = cuts[i + 1], m = (a + b) / 2, hs = rect.filter(h => h.a <= m && h.b >= m).sort((p, q) => p.y0 - q.y0);
        let y = y0; for (const h of hs) { seg(a, b, y, h.y0); y = Math.max(y, h.y1); } seg(a, b, y, y1); } };
    // a floor slab over x0..x1 × z0..z1 at height y (top), with an optional rectangular hole
    const slab = (o, x0, x1, z0, z1, y, th, hole, mat = 'nycConcrete') => {
      const B = (a, b, c, d) => { if (b - a > 0.01 && d - c > 0.01) box(o, v3((a + b) / 2, y - th / 2, (c + d) / 2), v3((b - a) / 2, th / 2, (d - c) / 2), mat, 0, 0, 0, NS); };
      if (!hole) return B(x0, x1, z0, z1);
      B(x0, x1, z0, hole.z0); B(x0, x1, hole.z1, z1); B(x0, hole.x0, hole.z0, hole.z1); B(hole.x1, x1, hole.z0, hole.z1); };
    // a race gate: an open frame w × h round its centre c, flown along dir 'x' / 'z' (standing) or 'y' (lying flat, flown down
    // through); its bars never count as over/unders of their own, its opening is a gap
    // A standing gate is an over/under too, like a frame on the other maps (owner, 2026-11-19: Split-S over the city's gates did not
    // count): through it = under, over its top bar = over
    const gate = (name, c, w, h, dir, mat = 'gateOrange', glow = 'neonMagenta') => { const t = 0.06, hw = w / 2 + t, hh = h / 2 + t, top = c.y + h / 2,
        o = dir === 'y' ? O(name, 'deco') : O(name, 'overunder', { obstacle: dir === 'x' ? { a: v3(c.x, 0, c.z - w / 2), b: v3(c.x, 0, c.z + w / 2), under: top, over: top + 2 * t } : { a: v3(c.x - w / 2, 0, c.z), b: v3(c.x + w / 2, 0, c.z), under: top, over: top + 2 * t } });
      const B = (dx, dy, dz, hx, hy, hz) => box(o, v3(c.x + dx, c.y + dy, c.z + dz), v3(hx, hy, hz), mat, 0, 0, 0, NS);
      if (dir === 'x') { B(0, hh, 0, t, t, hw + t); B(0, -hh, 0, t, t, hw + t); B(0, 0, hw, t, hh, t); B(0, 0, -hw, t, hh, t); }
      else if (dir === 'z') { B(0, hh, 0, hw + t, t, t); B(0, -hh, 0, hw + t, t, t); B(hw, 0, 0, t, hh, t); B(-hw, 0, 0, t, hh, t); }
      else { B(0, 0, hh, hw + t, t, t); B(0, 0, -hh, hw + t, t, t); B(hw, 0, 0, t, t, hh); B(-hw, 0, 0, t, t, hh); }
      if (glow) { if (dir === 'x') neon(o, v3(c.x, c.y + h / 2 - 0.02, c.z), v3(0.025, 0.02, w / 2), glow); else if (dir === 'z') neon(o, v3(c.x, c.y + h / 2 - 0.02, c.z), v3(w / 2, 0.02, 0.025), glow); else neon(o, v3(c.x, c.y + 0.07, c.z + h / 2), v3(w / 2, 0.02, 0.025), glow); }
      const gu = w / 2 - 0.06, gv = h / 2 - 0.06;   // a little inside the bars
      if (dir === 'x') gapO(name + ' opening', v3(c.x, c.y, c.z), v3(1, 0, 0), v3(0, 0, 1), gu, gv);
      else if (dir === 'z') gapO(name + ' opening', v3(c.x, c.y, c.z), v3(0, 0, 1), v3(1, 0, 0), gu, gv);
      else gapO(name + ' opening', v3(c.x, c.y, c.z), v3(0, 1, 0), v3(1, 0, 0), gu, gv);
      surf(o, HARD); return o; };
    const hang = (o, a, b) => pipe(o, a, b, 0.018, 'chain', { noCollide: true });
    // a building block: a box of brick or concrete with a ground floor of shutters, a parapet, and roof clutter
    const block = (name, x0, x1, z0, z1, h, mat, face, opts = {}) => {
      const o = O(name, 'building', { wallNormal: v3(0, 0, face), tall: h, perchHeight: h });
      box(o, v3((x0 + x1) / 2, h / 2, (z0 + z1) / 2), v3((x1 - x0) / 2, h / 2, (z1 - z0) / 2), mat);
      box(o, v3((x0 + x1) / 2, h + 0.02, (z0 + z1) / 2), v3((x1 - x0) / 2 - 0.01, 0.02, (z1 - z0) / 2 - 0.01), 'roofTar', 0, 0, 0, NS);
      const fz = face < 0 ? z0 : z1, cap = O(name + ' Parapet', 'deco');
      for (const [a, b, c, d] of [[x0, x1, z0, z0 + 0.3], [x0, x1, z1 - 0.3, z1], [x0, x0 + 0.3, z0 + 0.3, z1 - 0.3], [x1 - 0.3, x1, z0 + 0.3, z1 - 0.3]]) box(cap, v3((a + b) / 2, h + 0.45, (c + d) / 2), v3((b - a) / 2, 0.45, (d - c) / 2), 'nycTrim', 0, 0, 0, NS);
      if (!opts.noShops) { const sh = O(name + ' Shutters', 'deco');
        for (let x = x0 + 2.4; x < x1 - 1.4; x += 4.2) { const art = [], k = rnd() < 0.2 ? 0 : rnd() < 0.7 ? 1 : 2;   // the pilots' logos sprayed on the shutters: none, one or two, big or small, turned
          for (let i = 0; i < k; i++) art.push({ name: LOGOS[Math.floor(rnd() * LOGOS.length)], x: k === 1 ? 0.3 + rnd() * 0.4 : 0.22 + i * 0.56 + (rnd() - 0.5) * 0.1, y: 0.9 + rnd() * 1.3, h: k === 1 ? 0.9 + rnd() * 1.5 : 0.6 + rnd() * 0.8, rot: (rnd() - 0.5) * 0.7 });
          box(sh, v3(x, 1.5, fz + face * 0.04), v3(1.7, 1.5, 0.04), 'shutter', 0, 0, 0, { noSurvey: true, graffiti: face < 0 ? 'north' : 'south', art });
          if (rnd() < 0.45) { const aw = O('Awning', 'deco'); box(aw, v3(x, 3.25, fz + face * 0.75), v3(1.9, 0.04, 0.78), ['awnRed', 'awnGreen', 'awnBlue'][Math.floor(rnd() * 3)], 0, face * 0.32, 0); surf(aw, SOFT); } } }
      const roof = O(name + ' Roof Gear', 'deco');
      for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) { const x = x0 + 2 + rnd() * (x1 - x0 - 4), z = z0 + 2 + rnd() * (z1 - z0 - 4); box(roof, v3(x, h + 0.55, z), v3(0.7, 0.55, 0.55), 'galv'); }
      return o; };

    const AV0 = 0, AV1 = 12, XW = 50, LOGOS = ['heyhey', 'mopenguinz', 'roguemonkey', 'clappy', 'fpvyourworld', 'byteme', 'ridgeripper', 'rwdc'];

    // ---- the ground: sidewalks, curbs, lane lines, crosswalks, the plaza, the painted start box
    zones.push({ shape: 'zone', mat: 'nycSidewalk', c: v3((-XW - 9.5) / 2, 0.005, -2), h: v3((XW - 9.5) / 2, 0, 2) }, { shape: 'zone', mat: 'nycSidewalk', c: v3((XW - 5.6) / 2, 0.005, -2), h: v3((XW + 5.6) / 2, 0, 2) },
      { shape: 'zone', mat: 'nycSidewalk', c: v3(-7.55, 0.005, -3.75), h: v3(1.95, 0, 0.25) }, { shape: 'zone', mat: 'nycSidewalk', c: v3(-7.55, 0.005, -0.95), h: v3(1.95, 0, 0.95) });   // open over the subway stair
    zones.push({ shape: 'zone', mat: 'nycSidewalk', c: v3(-15.2, 0.005, 14), h: v3(34.8, 0, 2) }, { shape: 'zone', mat: 'nycSidewalk', c: v3(38, 0.005, 14), h: v3(12, 0, 2) });
    zones.push({ shape: 'zone', mat: 'nycSidewalk', c: v3(35, 0.006, 18), h: v3(9, 0, 2) }, { shape: 'zone', mat: 'nycSidewalk', c: v3(47, 0.006, 28), h: v3(3, 0, 12) });
    zones.push({ shape: 'zone', mat: 'nycSidewalk', c: v3(19.2, 0.006, 29), h: v3(0.8, 0, 13) }, { shape: 'zone', mat: 'nycSidewalk', c: v3(25.4, 0.006, 29), h: v3(0.6, 0, 13) });
    zones.push({ shape: 'zone', mat: 'yellowLines', c: v3((-XW - 40.8) / 2, 0.007, 6), h: v3((XW - 40.8) / 2, 0, 0.18) }, { shape: 'zone', mat: 'yellowLines', c: v3((XW - 36.2) / 2, 0.007, 6), h: v3((XW + 36.2) / 2, 0, 0.18) });   // broken under the start box
    for (const z of [3.2, 8.8]) zones.push({ shape: 'zone', mat: 'laneDash', c: v3(0, 0.007, z), h: v3(XW, 0, 0.08) });
    zones.push({ shape: 'zone', mat: 'crosswalk', c: v3(18.3, 0.008, 6), h: v3(1.2, 0, 6) }, { shape: 'zone', mat: 'crosswalk', c: v3(23, 0.008, 14), h: v3(1.4, 0, 3), ry: Math.PI / 2 });
    { const cb = O('Curb', 'deco'); for (const [x0, x1, z] of [[-XW, XW, 0], [-XW, 19.6, 12], [26, XW, 12]]) box(cb, v3((x0 + x1) / 2, 0.07, z), v3((x1 - x0) / 2, 0.07, 0.12), 'nycConcrete', 0, 0, 0, NS);
      box(cb, v3(19.6, 0.07, 29), v3(0.12, 0.07, 13), 'nycConcrete', 0, 0, 0, NS); box(cb, v3(26.1, 0.07, 30.5), v3(0.12, 0.07, 1.5), 'nycConcrete', 0, 0, 0, NS); }
    zones.push({ shape: 'zone', mat: 'bodegaTile', c: v3(16.8, 0.006, 18.1), h: v3(2.6, 0, 1.9) });
    { const sb = O('Start Box', 'deco'); pic(sb, v3(-38.5, 0.012, 6), 4.2, 3.4, -Math.PI / 2, 'startBox', { rx: -Math.PI / 2, solid: false, glow: false }); }

    // ---- the elevated subway: green steel pillars (poles), cross beams, two girders and a deck, ties and rails; a train waits
    // over the middle three spans. Each span is an over/under (under the deck, over the rails or over the train)
    const EL = { z0: 0.9, z1: 11.1, beam: 6.0, gb: 6.3, gt: 7.0, zg: [2.4, 9.6] }, TRAIN = [-5, 25];
    for (let x = -45; x <= 45; x += 10) {
      for (const z of [EL.z0, EL.z1]) { const p = O('El Pillar', 'pole'); pipe(p, v3(x, 0, z), v3(x, 5.75, z), 0.22, 'elGreen'); box(p, v3(x, 0.08, z), v3(0.36, 0.08, 0.36), 'elGreen', 0, 0, 0, NS); surf(p, HARD); }
      const bm = O('El Cross Beam', 'deco'); box(bm, v3(x, EL.beam, 6), v3(0.24, 0.3, 5.45), 'elGreen', 0, 0, 0, NS); for (const s of [-1, 1]) box(bm, v3(x, 5.35, 6 + s * 4.6), v3(0.06, 0.45, 0.6), 'elGreen', 0, 0.7 * s, 0, NS); surf(bm, HARD); }
    for (let x = -50; x < 50; x += 10) { const x0 = x, x1 = x + 10, xm = (x0 + x1) / 2, inTrain = xm > TRAIN[0] && xm < TRAIN[1];
      const sp = O('El Track', 'overunder', { obstacle: { a: v3(x0, 0, 6), b: v3(x1, 0, 6), under: EL.gb, over: inTrain ? 10.5 : EL.gt + 0.12 } });
      for (const z of EL.zg) box(sp, v3(xm, (EL.gb + EL.gt) / 2, z), v3(5, (EL.gt - EL.gb) / 2, 0.22), 'elGreen');
      box(sp, v3(xm, 6.6, 6), v3(5, 0.06, 3.38), 'elDeck');
      for (let tx = x0 + 0.4; tx < x1; tx += 0.8) box(sp, v3(tx, 6.71, 6), v3(0.11, 0.05, 1.5), 'oldWood', 0, 0, 0, { noCollide: true });
      for (const z of [5.28, 6.72]) pipe(sp, v3(x0, 6.8, z), v3(x1, 6.8, z), 0.04, 'galv', { noCollide: true });
      surf(sp, HARD); }
    together(() => { for (const [x0, x1, n] of [[-4.7, 9.9, 1], [10.3, 24.7, 2]]) { const tr = O(`Subway Car ${n}`, 'deco'), xm = (x0 + x1) / 2;
        box(tr, v3(xm, 8.75, 6), v3((x1 - x0) / 2, 1.6, 1.4), 'trainSide', 0, 0, 0, NS); box(tr, v3(xm, 10.42, 6), v3((x1 - x0) / 2 - 0.1, 0.08, 1.25), 'galv', 0, 0, 0, NS);
        for (const xb of [x0 + 2.4, x1 - 2.4]) box(tr, v3(xb, 7.0, 6), v3(1.1, 0.16, 1.0), 'rubberBlack', 0, 0, 0, NS);
        pic(tr, v3(xm, 9.7, 4.58), 3.0, 0.42, Math.PI, 'signRoute', { solid: false }); pic(tr, v3(xm, 9.7, 7.42), 3.0, 0.42, 0, 'signRoute', { solid: false });
        surf(tr, HARD); }
      const g = O('Subway Gangway', 'deco'); box(g, v3(10.1, 8.6, 6), v3(0.2, 1.2, 0.8), 'rubberBlack', 0, 0, 0, NS); });
    // the El runs on beyond the block (drawn only; the map edges stop flying long before)
    { const far = O('El Beyond', 'deco'); for (const s of [-1, 1]) { for (let k = 0; k < 7; k++) { const x = s * (55 + k * 10); for (const z of [EL.z0, EL.z1]) pipe(far, v3(x, 0, z), v3(x, 5.75, z), 0.22, 'elGreen', { noCollide: true }); box(far, v3(x, EL.beam, 6), v3(0.24, 0.3, 5.45), 'elGreen', 0, 0, 0, { noCollide: true }); }
      for (const z of EL.zg) box(far, v3(s * 85, 6.65, z), v3(35, 0.35, 0.22), 'elGreen', 0, 0, 0, { noCollide: true }); box(far, v3(s * 85, 6.6, 6), v3(35, 0.06, 3.38), 'elDeck', 0, 0, 0, { noCollide: true }); } }

    // ---- 1 Yellow Fever: the start box, then east between stopped taxis and cars, under gates hung from signal arms
    { const cars = []; for (const lz of [3.0, 6.0, 9.0]) { let x = -32 + rnd() * 3; while (x < 46) { cars.push([x, lz + (rnd() - 0.5) * 0.35, rnd() < 0.62]); x += 4.6 + 9 + rnd() * 14; } }   /* owner: fewer cars (gaps of 9-23 m) */
      for (const [x, z, taxi] of cars) { if (Math.abs(x - 23) < 4.5 && z > 7) continue;
        const c = O(taxi ? 'Taxi' : 'Parked Car', 'deco'), col = taxi ? 'taxiYellow' : ['carRed', 'carBlue', 'carSilver', 'carBlack'][Math.floor(rnd() * 4)], ry = (rnd() - 0.5) * 0.08;
        box(c, v3(x, 0.62, z), v3(2.3, 0.36, 0.9), col, ry); box(c, v3(x - 0.2, 1.2, z), v3(1.25, 0.25, 0.82), 'carGlass', ry); box(c, v3(x - 0.2, 1.47, z), v3(1.2, 0.03, 0.8), col, ry);
        for (const dx of [-1.45, 1.45]) pipe(c, v3(x + dx, 0.33, z - 0.92), v3(x + dx, 0.33, z + 0.92), 0.32, 'rubberBlack', NS);
        if (taxi) box(c, v3(x - 0.2, 1.62, z), v3(0.3, 0.12, 0.12), 'taxiSign', ry);
        surf(c, HARD); } }
    for (const [x, gz, n] of [[-27, 4.4, 1], [-15, 8.0, 2]]) { const sg = O('Traffic Signal', 'pole'); pipe(sg, v3(x, 0, 13.3), v3(x, 5.5, 13.3), 0.12, 'darkMetal'); surf(sg, HARD);
      const arm = O('Signal Arm', 'overunder', { obstacle: { a: v3(x, 0, 13.2), b: v3(x, 0, 2.2), under: 5.27, over: 5.43 } }); pipe(arm, v3(x, 5.35, 13.3), v3(x, 5.35, 2.2), 0.08, 'darkMetal', NS); for (const z of [9.5, 5.5]) { box(arm, v3(x, 4.9, z), v3(0.2, 0.45, 0.2), 'plasticYellow', 0, 0, 0, NS); box(arm, v3(x - 0.21, 4.9, z), v3(0.01, 0.38, 0.12), 'signalLit', 0, 0, 0, { noCollide: true, glow: true }); }
      const g = gate(`Yellow Fever Gate ${n}`, v3(x + 0.6, 4.05, gz), 2.4, 1.8, 'x'); for (const s of [-1, 1]) hang(g, v3(x + 0.6, 5.0, gz + s * 1.2), v3(x, 5.3, gz + s * 1.2)); }
    { const sl = O('Streetlight', 'pole'); pipe(sl, v3(-3, 0, -1.2), v3(-3, 5.6, -1.2), 0.1, 'darkMetal'); const sa = O('Streetlight Arm', 'overunder', { obstacle: { a: v3(-3, 0, -1.0), b: v3(-3, 0, 4.6), under: 5.44, over: 5.56 } }); pipe(sa, v3(-3, 5.5, -1.1), v3(-3, 5.5, 4.6), 0.06, 'darkMetal', NS); box(sl, v3(-3, 5.4, 4.8), v3(0.25, 0.08, 0.4), 'lampHead', 0, 0, 0, NS); surf(sl, HARD);
      const g = gate('Yellow Fever Gate 3', v3(-2.4, 4.15, 3.2), 2.2, 1.7, 'x'); for (const s of [-1, 1]) hang(g, v3(-2.4, 5.06, 3.2 + s * 1.1), v3(-3, 5.48, 3.2 + s * 1.1)); }
    for (const x of [-44, -33, -21, 30, 40]) { const sl = O('Streetlight', 'pole'); pipe(sl, v3(x, 0, 15.2), v3(x, 5.6, 15.2), 0.1, 'darkMetal'); pipe(sl, v3(x, 5.5, 15.2), v3(x, 5.5, 13), 0.06, 'darkMetal', NS); box(sl, v3(x, 5.42, 12.9), v3(0.25, 0.08, 0.35), 'lampHead', 0, 0, 0, NS); surf(sl, HARD); }
    for (const [x, z] of [[-41, -1.2], [-12, 13.4], [5.5, -1.3], [27, 13.4], [36, -1.2]]) { const h = O('Hydrant', 'deco'); pipe(h, v3(x, 0, z), v3(x, 0.62, z), 0.13, 'paintRed'); ball(h, v3(x, 0.66, z), 0.12, 'paintRed'); pipe(h, v3(x - 0.2, 0.42, z), v3(x + 0.2, 0.42, z), 0.06, 'paintRed', NS); }
    for (const [x, z] of [[-36, -2.5], [-8, 14.8], [2, -2.6], [33, 14.9]]) { const b = O('Trash Bags', 'deco'); for (let i = 0; i < 4; i++) ball(b, v3(x + (rnd() - 0.5) * 1.1, 0.3, z + (rnd() - 0.5) * 0.6), 0.3 + rnd() * 0.1, 'trashBag', { leafSolid: true }); surf(b, SOFT); }
    { const nb = O('News Boxes', 'deco'); for (let i = 0; i < 3; i++) box(nb, v3(0.4 + i * 0.6, 0.55, -3.3), v3(0.26, 0.55, 0.24), ['paintBlue', 'paintRed', 'plasticYellow'][i]); }
    // the subway entrance on the north sidewalk: railings round the stair, globe lamps (the stair is painted dark: no digging)
    { const se = O('Subway Entrance', 'deco'); for (const z of [-3.6, -1.8]) pipe(se, v3(-9.5, 1.0, z), v3(-5.6, 1.0, z), 0.04, 'elGreen', NS); pipe(se, v3(-9.5, 1.0, -3.6), v3(-9.5, 1.0, -1.8), 0.04, 'elGreen', NS);
      for (const [x, z] of [[-9.5, -3.6], [-9.5, -1.8], [-5.6, -3.6], [-5.6, -1.8], [-7.5, -3.6], [-7.5, -1.8]]) pipe(se, v3(x, 0, z), v3(x, 1.0, z), 0.04, 'elGreen', NS);
      for (const z of [-3.6, -1.8]) { pipe(se, v3(-5.6, 1.0, z), v3(-5.6, 2.2, z), 0.04, 'elGreen', NS); ball(se, v3(-5.6, 2.38, z), 0.17, 'globeGreen', { glow: true }); }
      pic(se, v3(-5.65, 1.55, -2.7), 1.5, 0.5, -Math.PI / 2, 'signSubway', { solid: false }); }

    // ---- the blocks: the north side of the avenue (the walk-up with the water tower is the roof drop) and the south side
    block('Corner Tower', -XW, -30.4, -24, -4, 24, 'nycBrickTan', 1);
    const walk = block('Walk-up', -30.4, -6, -22, -4, 16, 'nycBrick', 1);
    block('Laundromat', -6, 10.4, -20, -4, 9, 'nycBrickTan', 1);
    block('Billboard Building', 10.4, 24.4, -22, -4, 20, 'nycConcrete', 1);
    block('Pawn & Loan', 24.4, XW, -24, -4, 13, 'nycBrick', 1);
    block('Tenement West', -XW, -31.5, 16, 34, 18, 'nycBrick', -1);
    block('Tenement', -31.5, -10.6, 16, 32, 14, 'nycBrickTan', -1);
    block('Pharmacy', -10.6, -0.4, 16, 30, 10, 'nycConcrete', -1);
    block('Rowhouse', 4, 19.6, 26, 42, 18, 'nycBrick', -1, { noShops: true });
    block('East Walk-up', 44.4, XW, 20, 42, 16, 'nycBrickTan', -1, { noShops: true });
    // the billboard on its roof, facing the avenue
    { const bb = O('Slackvegan Billboard', 'overunder', { obstacle: { a: v3(12.4, 0, -8), b: v3(22.9, 0, -8), under: 24.2, over: 28.2 } }); for (const x of [13.5, 21.8]) pipe(bb, v3(x, 20, -8), v3(x, 24.2, -8), 0.12, 'darkMetal'); box(bb, v3(17.65, 26.2, -8), v3(5.3, 2.0, 0.12), 'darkMetal', 0, 0, 0, NS);
      pic(bb, v3(17.65, 26.2, -7.85), 10.4, 3.8, 0, 'signSlackvegan', { solid: false }); surf(bb, HARD); }
    // the deck-side neon on the Pawn & Loan, a diner's blade sign on the walk-up (the first of the drop gates hangs from it)
    { const pn = O('Pawn Sign', 'deco'); pic(pn, v3(34, 7.6, -3.94), 6, 1.4, 0, 'signPawn', { solid: false }); }

    // ---- 2 the Bakery & Deli run, and the bodega on the corner (with its cat): a three-storey brick row above the shops
    const SF = 16, ST = 0.3;
    { const up = O('Shop Row', 'building', { wallNormal: v3(0, 0, -1), tall: 12, perchHeight: 12 }); box(up, v3(9.8, 7.8, 21), v3(9.8, 4.2, 5), 'nycBrick'); box(up, v3(9.8, 12.02, 21), v3(9.79, 0.02, 4.99), 'roofTar', 0, 0, 0, NS);
      const back = O('Shop Row Back', 'deco'); box(back, v3(7, 1.8, 22.6), v3(7, 1.8, 3.4), 'nycBrick', 0, 0, 0, NS); box(back, v3(16.8, 1.8, 23), v3(2.8, 1.8, 3), 'nycBrick', 0, 0, 0, NS); box(back, v3(14.05, 1.8, 18.1), v3(0.06, 1.8, 2.0), 'nycBrick', 0, 0, 0, NS);
      const cap = O('Shop Row Parapet', 'deco'); box(cap, v3(9.8, 12.45, 16.15), v3(9.8, 0.45, 0.15), 'nycTrim', 0, 0, 0, NS);
      const fr = O('Shopfronts', 'deco'), holes = [{ a: 0.8, b: 6.4, y0: 0.6, y1: 2.9 }, { a: 6.8, b: 7.9, y0: 0, y1: 2.5 }, { a: 8.8, b: 12.2, y0: 0.6, y1: 2.9 }, { a: 12.5, b: 13.7, y0: 0, y1: 2.5 }, { a: 14.4, b: 15.6, y0: 0.6, y1: 2.6 }, { a: 15.9, b: 17.5, y0: 0, y1: 2.45 }, { a: 17.8, b: 19.2, y0: 0.6, y1: 2.6 }];
      wall(fr, 'x', SF, -0.4, 19.6, 0, 3.6, ST, holes, 'shopFront');
      wall(fr, 'z', 19.6, SF, 20, 0, 3.6, ST, [{ a: 17, b: 19.3, y0: 0.6, y1: 2.6 }], 'shopFront');
      box(fr, v3(-0.25, 1.8, 18), v3(0.15, 1.8, 2), 'nycBrick', 0, 0, 0, NS);
      // the windows: bread trays glowing in the bakery, meats and cheese in the deli, the bodega's crowded shelves; glass over them
      const wn = O('Shop Windows', 'deco'); pic(wn, v3(3.6, 1.75, SF + 0.35), 5.6, 2.3, Math.PI, 'winBakery', { solid: false }); pic(wn, v3(10.5, 1.75, SF + 0.35), 3.4, 2.3, Math.PI, 'winDeli', { solid: false });
      pic(wn, v3(7.35, 1.25, SF + 0.2), 1.1, 2.5, Math.PI, 'doorBakery', { solid: false, glow: false }); pic(wn, v3(13.1, 1.25, SF + 0.2), 1.2, 2.5, Math.PI, 'doorDeli', { solid: false, glow: false });
      for (const [a, b] of [[0.8, 6.4], [8.8, 12.2], [6.8, 7.9], [12.5, 13.7]]) { const g = makeBox(v3((a + b) / 2, 1.6, SF + 0.05), v3((b - a) / 2, 1.4, 0.02)); g.leaf = true; wn.prims.push(g); wn.vis.push({ shape: 'box', c: v3((a + b) / 2, 1.6, SF + 0.05), h: v3((b - a) / 2, 1.4, 0.02), mat: 'carGlass', euler: [0, 0, 0], alpha: true }); }
      // signs and awnings (soft: a duct bounces off canvas)
      pic(fr, v3(3.6, 3.25, SF - 0.2), 5.4, 0.62, Math.PI, 'signBakery', { solid: false }); pic(fr, v3(11.2, 3.25, SF - 0.2), 4.2, 0.62, Math.PI, 'signDeli', { solid: false });
      for (const [x0, x1, m] of [[0.4, 7.9, 'awnRed'], [8.5, 13.8, 'awnGreen'], [14.2, 19.4, 'awnBlue']]) { const aw = O('Awning', 'deco'); box(aw, v3((x0 + x1) / 2, 2.98, SF - 0.8), v3((x1 - x0) / 2, 0.04, 0.85), m, 0, -0.34, 0); box(aw, v3((x0 + x1) / 2, 2.62, SF - 1.62), v3((x1 - x0) / 2, 0.2, 0.02), m, 0, 0, 0, NS); surf(aw, SOFT); }
      // the bodega: open door, neon in the window, shelves, a counter, the cat
      const bo = O('Bodega', 'deco'); pic(bo, v3(16.9, 3.4, SF - 0.25), 4.6, 0.45, Math.PI, 'signBodega', { solid: false });
      pic(bo, v3(15.0, 1.65, SF + 0.18), 1.1, 0.9, Math.PI, 'signOpen', { solid: false }); pic(bo, v3(18.5, 1.6, SF + 0.18), 1.2, 0.8, Math.PI, 'signSpider', { solid: false });
      for (let i = 0; i < 3; i++) box(bo, v3(17, 0.4 + i * 0.7, 19.6), v3(2.4, 0.04, 0.35), 'oldWood', 0, 0, 0, NS); for (const x of [14.65, 19.35]) box(bo, v3(x, 1.15, 19.6), v3(0.04, 1.15, 0.35), 'oldWood', 0, 0, 0, NS);
      { let sd = 4471; const r2 = () => (sd = (sd * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 54; i++) rnd();   // the map's own stream advances as it did (18 goods × 3 draws), so nothing after this moves
        // goods standing ON the shelves, side by side (owner, 2026-11-20: they clipped through the boards and each other)
        let k = 0; for (let sh = 0; sh < 3; sh++) { const top = 0.44 + sh * 0.7; for (let x = 14.75; ; ) { const hw = 0.07 + r2() * 0.08, hh = 0.07 + r2() * 0.09; if (x + 2 * hw > 19.25) break;
          box(bo, v3(x + hw, top + hh, 19.5 + (r2() - 0.5) * 0.12), v3(hw, hh, 0.07 + r2() * 0.04), ['paintRed', 'plasticYellow', 'paintBlue', 'paintGreen', 'paintOrange'][k++ % 5], 0, 0, 0, { noCollide: true }); x += 2 * hw + 0.03 + r2() * 0.08; } } }
      box(bo, v3(15.2, 0.5, 18), v3(0.45, 0.5, 1.2), 'oldWood'); box(bo, v3(15.2, 1.02, 17.5), v3(0.2, 0.02, 0.25), 'radio', 0, 0, 0, { noCollide: true });
      gapO('Bodega Door', v3(16.7, 1.525, SF), v3(0, 0, 1), v3(1, 0, 0), 0.7, 0.875);   // above the cat
      // the bodega's windows are solid, clear glass (owner, 2026-11-20): the two either side of the door and the one round the corner
      for (const [c, h] of [[v3(15.0, 1.6, SF + 0.05), v3(0.6, 1.0, 0.02)], [v3(18.5, 1.6, SF + 0.05), v3(0.7, 1.0, 0.02)], [v3(19.6 - 0.05, 1.6, 18.15), v3(0.02, 1.0, 1.15)]]) {
        const g = makeBox(c, h); g.leaf = true; bo.prims.push(g); bo.vis.push({ shape: 'box', c, h, mat: 'carGlass', euler: [0, 0, 0], alpha: true }); }
      lamp('Bodega Light', v3(17, 3.2, 18.2), 0xfff0d0, 4, 7); lamp('Bakery Glow', v3(3.6, 2.6, 15.2), 0xffb060, 5, 9); }
    // the bodega cat: completely static, extremely judgmental. Hitting it costs you spiritually (play.js: a meow and a burst)
    together(() => { const x = 16.7, z = SF + 0.05, cat = O('Bodega Cat', 'deco', { cat: true });
      ball(cat, v3(x, 0.16, z), 0.17, 'catFur'); ball(cat, v3(x, 0.3, z - 0.07), 0.12, 'catFur'); ball(cat, v3(x, 0.45, z - 0.11), 0.105, 'catFur');
      for (const s of [-1, 1]) pipe(cat, v3(x + s * 0.05, 0.52, z - 0.12), v3(x + s * 0.075, 0.62, z - 0.13), 0.03, 'catFur', { noCollide: true, cone: true });
      for (const s of [-1, 1]) ball(cat, v3(x + s * 0.04, 0.47, z - 0.2), 0.02, 'catEye', { noCollide: true, glow: true });
      pipe(cat, v3(x + 0.12, 0.05, z + 0.08), v3(x + 0.26, 0.08, z - 0.12), 0.03, 'catFur', { noCollide: true });
      for (const s of [-1, 1]) ball(cat, v3(x + s * 0.06, 0.04, z - 0.15), 0.045, 'catWhite', { noCollide: true }); });
    // the low gate between the bakery window and the deli door, the dangling FRESH sign, the hanging plants, boxes
    { const g = frame('Bakery Low Gate', 8.15, 14.1, 2.2, 1.35, 'z', 'gateOrange', 'neonMagenta'); surf(g, HARD); }
    { const fs = O('Fresh Sign', 'deco'); pic(fs, v3(3.2, 2.15, 14.55), 1.3, 0.48, Math.PI, 'signFresh', { both: true, surf: SOFT }); for (const dx of [-0.55, 0.55]) hang(fs, v3(3.2 + dx, 2.39, 14.55), v3(3.2 + dx, 2.7, 14.55)); }
    for (const x of [9.6, 12.4]) { const pl = O('Hanging Plant', 'deco'); ball(pl, v3(x, 2.0, 14.6), 0.24, 'leaves', { leafSolid: true }); pipe(pl, v3(x, 1.76, 14.6), v3(x, 1.95, 14.6), 0.2, 'terracotta', { noCollide: true }); hang(pl, v3(x, 2.2, 14.6), v3(x, 2.68, 14.6)); surf(pl, SOFT); }
    { const cb = O('Cardboard Boxes', 'deco'); for (const [x, y, z, s] of [[14.0, 0.3, 15.2, 0.3], [14.05, 0.82, 15.2, 0.22], [13.4, 0.25, 15.4, 0.25], [-1.0, 0.3, 15.2, 0.3], [-0.9, 0.82, 15.1, 0.22]]) box(cb, v3(x, y, z), v3(s * 1.2, s, s), 'cardboard', rnd() * 0.5); surf(cb, SOFT); }

    // ---- 3 + 4 + 5 the skyscraper: round voids into two sky lobbies, the Spine (a 6 x 6 m shaft) down the middle, the lobby's
    // round arch out to the avenue; its fire escape climbs the west face from the cross street
    const X0 = 26, X1 = 44, Z0 = 20, Z1 = 38, H = 48, T = 0.5, SX0 = 32, SX1 = 38, SZ0 = 26, SZ1 = 32, ST2 = 0.4, YA = 21.5, YB = 35.2;
    const tower = O('Spine Tower', 'building', { wallNormal: v3(-1, 0, 0), tall: H, perchHeight: H });
    wall(tower, 'x', Z0, X0 + T / 2, X1 - T / 2, 0, H + 1, T, [{ u: 35, y: 3.4, r: 3.0 }, { u: 30.6, y: YA, r: 2.5 }, { u: 39.4, y: YA, r: 2.5 }, { u: 35, y: YB, r: 2.4 }], 'brutal');
    wall(tower, 'x', Z1, X0 + T / 2, X1 - T / 2, 0, H + 1, T, [{ u: 35, y: YA, r: 2.5 }], 'brutal');
    wall(tower, 'z', X0, Z0 - T / 2, Z1 + T / 2, 0, H + 1, T, [{ u: 29, y: YA, r: 2.6 }, { u: 29, y: YB, r: 2.4 }], 'brutal');
    wall(tower, 'z', X1, Z0 - T / 2, Z1 + T / 2, 0, H + 1, T, [{ u: 29, y: YA, r: 2.5 }], 'brutal');
    { const fl = O('Spine Tower Floors', 'deco'), hole = { x0: SX0 - ST2, x1: SX1 + ST2, z0: SZ0 - ST2, z1: SZ1 + ST2 }, ix0 = X0 + T / 2, ix1 = X1 - T / 2, iz0 = Z0 + T / 2, iz1 = Z1 - T / 2;
      for (const [y, th] of [[7.5, 0.5], [18, 0.4], [25.4, 0.4], [32.4, 0.4], [38.4, 0.4], [H, 0.5]]) slab(fl, ix0, ix1, iz0, iz1, y, th, hole, y === 18 || y === 32.4 ? 'lobbyFloor' : 'nycConcrete');
      // the shaft's walls from the lobby ceiling to the roof, with round openings onto the two sky lobbies
      const sh = O('The Spine', 'wall', { wallNormal: v3(1, 0, 0), tall: H });
      wall(sh, 'z', SX0 - ST2 / 2, SZ0 - ST2, SZ1 + ST2, 7.5, H + 1, ST2, [{ u: 29, y: YA, r: 2.0 }, { u: 29, y: YB, r: 1.9 }], 'shaftWall', 'neonCyanTrim');
      wall(sh, 'z', SX1 + ST2 / 2, SZ0 - ST2, SZ1 + ST2, 7.5, H + 1, ST2, [{ u: 29, y: YA, r: 2.0 }], 'shaftWall', 'neonCyanTrim');
      wall(sh, 'x', SZ0 - ST2 / 2, SX0, SX1, 7.5, H + 1, ST2, [{ u: 35, y: YA, r: 2.0 }, { u: 35, y: YB, r: 1.9 }], 'shaftWall', 'neonCyanTrim');
      wall(sh, 'x', SZ1 + ST2 / 2, SX0, SX1, 7.5, H + 1, ST2, [{ u: 35, y: YA, r: 2.0 }], 'shaftWall', 'neonCyanTrim');
      // round openings are gaps (the inscribed square)
      const rg = (name, c, n, u, r) => gapO(name, c, n, u, (r - 0.42) / Math.SQRT2, (r - 0.42) / Math.SQRT2);   // the square inside the round trim
      rg('Lobby Arch', v3(35, 3.4, Z0), v3(0, 0, 1), v3(1, 0, 0), 3.0);
      rg('Circular Gap North A1', v3(30.6, YA, Z0), v3(0, 0, 1), v3(1, 0, 0), 2.5); rg('Circular Gap North A2', v3(39.4, YA, Z0), v3(0, 0, 1), v3(1, 0, 0), 2.5); rg('Circular Gap North B', v3(35, YB, Z0), v3(0, 0, 1), v3(1, 0, 0), 2.4);
      rg('Circular Gap South A', v3(35, YA, Z1), v3(0, 0, 1), v3(1, 0, 0), 2.5); rg('Circular Gap West A', v3(X0, YA, 29), v3(1, 0, 0), v3(0, 0, 1), 2.6); rg('Circular Gap West B', v3(X0, YB, 29), v3(1, 0, 0), v3(0, 0, 1), 2.4);
      rg('Circular Gap East A', v3(X1, YA, 29), v3(1, 0, 0), v3(0, 0, 1), 2.5);
      for (const [n, c, nn, u] of [['West', v3(SX0 - 0.2, YA, 29), v3(1, 0, 0), v3(0, 0, 1)], ['East', v3(SX1 + 0.2, YA, 29), v3(1, 0, 0), v3(0, 0, 1)], ['North', v3(35, YA, SZ0 - 0.2), v3(0, 0, 1), v3(1, 0, 0)], ['South', v3(35, YA, SZ1 + 0.2), v3(0, 0, 1), v3(1, 0, 0)]]) rg(`Spine Window ${n} A`, c, nn, u, 2.0);
      rg('Spine Window West B', v3(SX0 - 0.2, YB, 29), v3(1, 0, 0), v3(0, 0, 1), 1.9); rg('Spine Window North B', v3(35, YB, SZ0 - 0.2), v3(0, 0, 1), v3(1, 0, 0), 1.9);
      gapO('Spine Top', v3(35, H + 0.6, 29), v3(0, 1, 0), v3(1, 0, 0), 2.9, 2.9); gapO('Spine Bottom', v3(35, 7.25, 29), v3(0, 1, 0), v3(1, 0, 0), 2.9, 2.9); }
    // the slalom inside the Spine: flat gates hung from the shaft walls at different heights, offset in turn
    [[43.5, 35, 29], [40.5, 36.4, 30.2], [29.8, 33.6, 29.4], [27.4, 36.4, 28.0], [15.2, 35, 30.6], [11.2, 35, 27.4]].forEach(([y, x, z], i) => {
      const g = gate(`Spine Gate ${i + 1}`, v3(x, y, z), 1.7, 1.7, 'y', 'gateOrange', 'neonCyan');
      for (const [dx, dz] of [[-0.92, -0.92], [0.92, 0.92], [-0.92, 0.92], [0.92, -0.92]]) { const ax = x + dx, az = z + dz, wx = dx < 0 ? SX0 : SX1, wz = dz < 0 ? SZ0 : SZ1, toX = Math.abs(ax - wx) < Math.abs(az - wz);
        hang(g, v3(ax, y, az), toX ? v3(wx, y + 1.4, az) : v3(ax, y + 1.4, wz)); } });
    { const sg = O('Spine Sign', 'deco'); pic(sg, v3(35, 7.8, Z0 - 0.3), 5, 1.0, Math.PI, 'signSpine', { solid: false }); }
    // inside: the lobby (a desk, round columns), sky lobby A and B (round columns, benches); light through the west voids
    { const lb = O('Lobby Desk', 'deco'); box(lb, v3(30, 0.55, 33), v3(2, 0.55, 0.6), 'marbleDark'); box(lb, v3(30, 1.12, 33), v3(2.05, 0.03, 0.65), 'brass', 0, 0, 0, NS); }
    for (const [x, z] of [[29.2, 23.2], [40.8, 23.2], [29.2, 34.8], [40.8, 34.8]]) { for (const [y0, y1] of [[0, 7], [18, 25], [32.4, 38]]) { const c = O('Tower Column', 'pole'); pipe(c, v3(x, y0, z), v3(x, y1, z), 0.24, 'columnConcrete'); surf(c, HARD); } }
    for (const [y, z] of [[18, 36.4], [32.4, 21.6]]) { const b = O('Sky Lobby Bench', 'deco'); box(b, v3(35, y + 0.23, z), v3(1.6, 0.23, 0.3), 'marbleDark'); }
    lamp('Lobby Light', v3(35, 6.6, 24), 0xffe4c0, 6, 12); lamp('Sky Lobby A', v3(35, 24.6, 23), 0xfff0e0, 5, 12); lamp('Spine Glow', v3(35, 30, 29), 0x7af0ff, 5, 10);
    { const ls = O('Light Shafts', 'deco'); pipe(ls, v3(X0 - 0.4, YA, 29), v3(36, YA - 2.4, 30.5), 1.9, 'lightShaft', { noCollide: true, glow: true, alpha: true }); pipe(ls, v3(X0 - 0.4, YB, 29), v3(33, YB - 1.6, 30), 1.7, 'lightShaft', { noCollide: true, glow: true, alpha: true }); }
    // the fire escape: five landings up the west face, zigzag stairs between them inside its rail, square gates hung off it
    together(() => { const fe = O('Fire Escape', 'deco'), xa = X0 - T / 2, xo = xa - 1.25, xm = (xa + xo) / 2, ys = [3.6, 7.2, 10.8, 14.4, 18.0];
      ys.forEach((y, k) => { box(fe, v3(xm, y, 29), v3(0.62, 0.04, 6), 'iron'); pipe(fe, v3(xo, y + 1.0, 23), v3(xo, y + 1.0, 35), 0.025, 'iron', NS);
        for (let z = 23; z <= 35.01; z += 1.5) pipe(fe, v3(xo, y, z), v3(xo, y + 1.0, z), 0.018, 'iron', NS);
        for (const z of [23, 35]) pipe(fe, v3(xo, y + 1.0, z), v3(xa, y + 1.0, z), 0.025, 'iron', NS);
        if (k) { const up = k % 2, za = up ? 33.5 : 24.5, zb = up ? 25.5 : 32.5, y0 = ys[k - 1], L = Math.hypot(zb - za, y - y0) / 2, ang = Math.atan2(y - y0, zb - za);
          box(fe, v3(xa - 0.33, (y + y0) / 2, (za + zb) / 2), v3(0.28, 0.03, L), 'iron', 0, -ang, 0, NS); } });
      for (const [x, y] of [[xo, 3.6], [xa - 0.05, 3.6]]) pipe(fe, v3(x, 0.0, 34.9), v3(x, y, 34.9), 0.02, 'iron', NS);
      surf(fe, HARD); });
    [[2.0, 24.0], [5.4, 34.0], [9.0, 24.0], [12.6, 34.0], [16.2, 24.0]].forEach(([y, z], i) => { const xg = X0 - T / 2 - 2.15;
      const g = gate(`Fire Escape Gate ${i + 1}`, v3(xg, y, z), 1.5, 1.5, 'z', 'gateOrange', 'neonLime');
      if (y > 3) { const yl = [3.6, 7.2, 10.8, 14.4, 18.0].filter(q => q < y).pop(); pipe(g, v3(xg + 0.81, y - 0.6, z), v3(X0 - T / 2 - 1.25, yl + 0.02, z), 0.03, 'iron', NS); pipe(g, v3(xg + 0.81, y + 0.6, z), v3(X0 - T / 2 - 1.25, yl + 1.0, z), 0.03, 'iron', NS); }
      else for (const dx of [-0.81, 0.81]) pipe(g, v3(xg + dx, 0, z), v3(xg + dx, y - 0.81, z), 0.04, 'gateOrange', NS); });
    // laundry lines across the cross street, south of the fire escape (soft: they give)
    for (const [y, z] of [[8.6, 36.6], [10.6, 37.4], [12.4, 36.2]]) { const ln = bar('Laundry Line', v3(19.6, y, z), v3(X0 - T / 2, y + 0.15, z), 0.015, 'chain'); surf(ln, SOFT);
      const cl = O('Laundry', 'deco'); for (let x = 20.4; x < 25; x += 0.75 + rnd() * 0.5) { const w = 0.25 + rnd() * 0.25, h = 0.35 + rnd() * 0.4; box(cl, v3(x, y - h / 2 + 0.05 * (x - 19.6) / 6, z), v3(w, h / 2, 0.01), ['cloth1', 'cloth2', 'cloth3', 'cloth4'][Math.floor(rnd() * 4)], 0, 0, 0, NS); } surf(cl, SOFT); }
    { const pc = O('Parked Car', 'deco'); for (const z of [28, 33.6, 39]) { box(pc, v3(20.9, 0.62, z), v3(0.9, 0.36, 2.3), 'carSilver'); box(pc, v3(20.9, 1.2, z + 0.2), v3(0.82, 0.25, 1.25), 'carGlass'); for (const dz of [-1.45, 1.45]) pipe(pc, v3(20.0, 0.33, z + dz), v3(21.8, 0.33, z + dz), 0.32, 'rubberBlack', NS); } surf(pc, HARD); }

    // ---- the subway station under the avenue (owner, 2026-11-19): down the stairs on the north sidewalk, a tiled hall with two
    // platforms, columns (poles), turnstiles, and a parked two-car train with every door open, end doors too: fly through it.
    // The ground plane is skipped over its footprint (world.groundHoles, the physics hook in sim.js; absent on other maps) and
    // the street is a slab over it, open only at the stair (world.groundCuts: where worldview.js cuts the ground mesh).
    const HID = -0.14;   // what is drawn under the street stops this far down (nothing near the ground's own plane)
    const SUB = { y: -6, pit: -7.2, ceil: -0.45, top: -0.02, x0: -31, x1: 5.2, z0: -1.65, z1: 13 }, OPEN = { x0: -9.5, x1: -5.6, z0: -3.5, z1: -1.9 }, CORR = { x0: -20.5, x1: -5.4, z0: -3.75, z1: -1.65 };
    const groundHoles = [{ x0: CORR.x0 - 0.3, x1: CORR.x1 + 0.1, z0: CORR.z0 - 0.1, z1: CORR.z1 + 0.05 }, { x0: SUB.x0 - 0.3, x1: SUB.x1 + 0.3, z0: SUB.z0 - 0.3, z1: SUB.z1 + 0.3 }], groundCuts = [OPEN];
    together(() => { const st = O('Subway Station', 'building', { wallNormal: v3(0, 0, 1), tall: 6 }), B = (x0, x1, y0, y1, z0, z1, mat, opt = NS) => { if (x1 - x0 > 0.005 && y1 - y0 > 0.005 && z1 - z0 > 0.005) box(st, v3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), v3((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2), mat, 0, 0, 0, opt); };
      // the street over it: a slab 2 cm under the ground's paint, open at the stair. It collides up to there but is drawn only
      // up to 14 cm down (owner: "the subway glitches through the street": its top flickered against the ground far away), and a
      // thin rim lines the opening from the street down to the slab
      const CL = (x0, x1, z0, z1) => { B(x0, x1, SUB.ceil, SUB.top, z0, z1, 'stationCeil', { noSurvey: true, noDraw: true }); B(x0, x1, SUB.ceil, HID, z0, z1, 'stationCeil', { noSurvey: true, noCollide: true }); };
      CL(CORR.x0 - 0.2, OPEN.x0, CORR.z0, CORR.z1); CL(OPEN.x1, CORR.x1 + 0.1, CORR.z0, CORR.z1); CL(OPEN.x0, OPEN.x1, CORR.z0, OPEN.z0); CL(OPEN.x0, OPEN.x1, OPEN.z1, CORR.z1); CL(SUB.x0 - 0.2, SUB.x1 + 0.2, SUB.z0, SUB.z1 + 0.2);
      for (const [x0, x1, z0, z1] of [[OPEN.x0, OPEN.x1, OPEN.z0, OPEN.z0 + 0.012], [OPEN.x0, OPEN.x1, OPEN.z1 - 0.012, OPEN.z1], [OPEN.x0, OPEN.x0 + 0.012, OPEN.z0, OPEN.z1]]) B(x0, x1, SUB.ceil, -0.004, z0, z1, 'nycConcrete', { noSurvey: true, noCollide: true });
      // the stairs: down west from the sidewalk to a landing, walls either side, then into the hall. The landing runs 5.5 m on past the
      // last step and opens 7.5 m wide into the hall (owner, 2026-11-20: it was 1.2 m, straight into a wall: "abrupt")
      const N = 24, run = 0.39, rise = 0.25; for (let i = 0; i < N; i++) { const xa = OPEN.x1 - (i + 1) * run, xb = OPEN.x1 - i * run; B(xa, xb, SUB.y - 0.5, -rise * (i + 1), CORR.z0 + 0.15, CORR.z1 - 0.15, 'stairStone'); }
      B(CORR.x0, OPEN.x1 - N * run, SUB.y - 0.5, SUB.y, CORR.z0, CORR.z1, 'stationFloor');
      B(CORR.x0, CORR.x1, SUB.y - 0.5, HID, CORR.z0 - 0.15, CORR.z0, 'subwayTile'); B(CORR.x0 - 0.2, CORR.x0, SUB.y - 0.5, HID, CORR.z0, CORR.z1, 'subwayTile');
      B(-13, CORR.x1, SUB.y - 0.5, HID, CORR.z1, CORR.z1 + 0.15, 'subwayTile'); B(OPEN.x1, CORR.x1 + 0.1, SUB.y - 0.5, HID, CORR.z0, CORR.z1, 'subwayTile');
      B(OPEN.x1 - 0.012, OPEN.x1, SUB.ceil, -0.004, OPEN.z0, OPEN.z1, 'subwayTile', { noSurvey: true, noCollide: true });
      // the hall: platforms either side of the track pit, tiled walls, dark tunnel mouths at both ends
      B(SUB.x0, SUB.x1, SUB.y - 0.5, SUB.y, SUB.z0, 4.2, 'stationFloor'); B(SUB.x0, SUB.x1, SUB.y - 0.5, SUB.y, 8.8, SUB.z1, 'stationFloor'); B(SUB.x0, SUB.x1, SUB.pit - 0.4, SUB.pit, 4.2, 8.8, 'ballast');
      for (const z of [4.2, 8.8]) B(SUB.x0, SUB.x1, SUB.y - 0.06, SUB.y + 0.005, z - (z < 6 ? 0.45 : 0), z + (z < 6 ? 0 : 0.45), 'platformEdge', { noSurvey: true, noCollide: true });
      B(SUB.x0, CORR.x0, SUB.pit, HID, SUB.z0 - 0.2, SUB.z0, 'subwayTile'); B(-13, SUB.x1, SUB.pit, HID, SUB.z0 - 0.2, SUB.z0, 'subwayTile'); B(SUB.x0, SUB.x1, SUB.pit, HID, SUB.z1, SUB.z1 + 0.2, 'subwayTile');
      for (const [xa, xb] of [[SUB.x0 - 0.2, SUB.x0], [SUB.x1, SUB.x1 + 0.2]]) { B(xa, xb, SUB.pit, HID, SUB.z0, 4.2, 'subwayTile'); B(xa, xb, SUB.pit, HID, 8.8, SUB.z1, 'subwayTile'); B(xa, xb, SUB.pit, HID, 4.2, 8.8, 'tunnelBlack'); }
      for (const z of [SUB.z0 + 0.03, SUB.z1 - 0.03]) for (const x of [-26, -2]) pic(st, v3(x, -2.6, z), 4.4, 0.7, z < 0 ? 0 : Math.PI, 'signStation', { solid: false, glow: false });
      pic(st, v3(-14.6, -2.2, CORR.z0 + 0.03), 3.2, 0.6, 0, 'signStation', { solid: false, glow: false });
      // fluorescent tubes along the ceiling, and three real lights
      for (const z of [1.2, 6.5, 11]) for (let x = SUB.x0 + 2; x < SUB.x1 - 1; x += 4) neon(st, v3(x, SUB.ceil - 0.05, z), v3(1.2, 0.04, 0.06), 'fluoro');
      for (let x = OPEN.x1 - 1; x > CORR.x0 + 0.5; x -= 3) neon(st, v3(x, SUB.ceil - 0.05, (CORR.z0 + CORR.z1) / 2), v3(0.06, 0.04, 0.6), 'fluoro');
      surf(st, HARD); });
    lamp('Station Light', v3(-23, -0.9, 6.5), 0xe4f0ff, 7, 16); lamp('Station Light', v3(-6, -0.9, 6.5), 0xe4f0ff, 7, 16); lamp('Stair Light', v3(-12, -0.9, -2.7), 0xe4f0ff, 4, 8);
    for (let x = -28; x <= 3; x += 5) for (const z of [3.7, 9.3]) { const c = O('Station Column', 'pole'); pipe(c, v3(x, SUB.y, z), v3(x, SUB.ceil, z), 0.14, 'columnBlue'); surf(c, HARD); }
    { const tg = O('Turnstiles', 'deco'); for (const z of [-3.3, -2.4]) { box(tg, v3(-15.6, SUB.y + 0.5, z), v3(0.35, 0.5, 0.12), 'galv'); pipe(tg, v3(-15.6, SUB.y + 0.9, z + 0.12), v3(-15.6, SUB.y + 0.9, z + 0.55), 0.025, 'galv', NS); } surf(tg, HARD); }
    // the parked train: two cars, both sides' doors open and the end doors too; seats, poles, lights inside
    for (const [x0, x1, n] of [[-27, -12.6, 1], [-12, 2.4, 2]]) together(() => { const car = O(`Subway Car ${n + 2}`, 'deco'), zc = 6.5, zA = zc - 1.75, zB = zc + 1.75, yF = SUB.y - 0.05, yR = SUB.y + 2.7, L = x1 - x0;
      box(car, v3((x0 + x1) / 2, yF - 0.1, zc), v3(L / 2, 0.1, 1.75), 'darkMetal', 0, 0, 0, NS); box(car, v3((x0 + x1) / 2, yR + 0.08, zc), v3(L / 2, 0.08, 1.75), 'carSteel', 0, 0, 0, NS);
      const doors = [0.14, 0.38, 0.62, 0.86].map(f => x0 + f * L), dh = [];
      for (const dx of doors) dh.push({ a: dx - 0.7, b: dx + 0.7, y0: yF, y1: yF + 2.0 });
      for (const z of [zA, zB]) { wall(car, 'x', z, x0, x1, yF, yR, 0.08, dh, 'carSteel'); for (const dx of doors) gapO(`Subway Car ${n + 2} Door`, v3(dx, yF + 1.0, z), v3(0, 0, 1), v3(1, 0, 0), 0.62, 0.94);
        box(car, v3((x0 + x1) / 2, yF + 2.25, z + (z < zc ? -0.045 : 0.045)), v3(L / 2, 0.06, 0.005), 'paintPurple', 0, 0, 0, { noCollide: true }); }
      for (const x of [x0, x1]) { wall(car, 'z', x, zA - 0.04, zB + 0.04, yF, yR, 0.1, [{ a: zc - 0.55, b: zc + 0.55, y0: yF, y1: yF + 2.0 }], 'carSteel'); gapO(`Subway Car ${n + 2} End Door`, v3(x, yF + 1.0, zc), v3(1, 0, 0), v3(0, 0, 1), 0.48, 0.94); }
      for (let k = 0; k + 1 < doors.length; k++) for (const z of [zA + 0.3, zB - 0.3]) box(car, v3((doors[k] + doors[k + 1]) / 2, yF + 0.45, z), v3((doors[k + 1] - doors[k]) / 2 - 0.85, 0.06, 0.22), 'carSeat', 0, 0, 0, NS);
      for (const dx of doors) pipe(car, v3(dx, yF, zc), v3(dx, yR, zc), 0.022, 'galv', NS);
      for (const z of [zA + 0.6, zB - 0.6]) pipe(car, v3(x0 + 0.3, yR - 0.35, z), v3(x1 - 0.3, yR - 0.35, z), 0.015, 'galv', { noCollide: true });
      for (let x = x0 + 1.5; x < x1 - 1; x += 3) neon(car, v3(x, yR - 0.03, zc), v3(0.8, 0.02, 0.08), 'fluoro');
      for (const xb of [x0 + 2.2, x1 - 2.2]) box(car, v3(xb, (SUB.pit + yF - 0.2) / 2, zc), v3(1.1, (yF - 0.2 - SUB.pit) / 2, 1.0), 'rubberBlack', 0, 0, 0, NS);
      surf(car, HARD); });
    { const tr = O('Subway Tracks', 'deco'); for (const z of [5.78, 7.22]) pipe(tr, v3(SUB.x0, SUB.pit + 0.08, z), v3(SUB.x1, SUB.pit + 0.08, z), 0.04, 'galv', { noCollide: true }); for (let x = SUB.x0 + 0.4; x < SUB.x1; x += 0.8) box(tr, v3(x, SUB.pit + 0.03, 6.5), v3(0.11, 0.03, 1.2), 'oldWood', 0, 0, 0, { noCollide: true }); }
    // ---- 7 the walk-up roof: the water tower on its stilts, AC units, a stair hut; a roof gate, then the drop gates to the finish
    { const RY = 16, wx = -15.5, wz = -13, wt = O('Water Tower', 'overunder', { obstacle: { a: v3(wx - 1.3, 0, wz), b: v3(wx + 1.3, 0, wz), under: RY + 3.4, over: RY + 8.6 } });
      for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) pipe(wt, v3(wx + dx, RY, wz + dz), v3(wx + dx * 0.85, RY + 3.4, wz + dz * 0.85), 0.1, 'iron');
      for (const s of [-1, 1]) { pipe(wt, v3(wx - 1.3, RY + 1.6, wz + s * 1.25), v3(wx + 1.3, RY + 1.6, wz + s * 1.25), 0.04, 'iron', NS); pipe(wt, v3(wx + s * 1.25, RY + 1.6, wz - 1.3), v3(wx + s * 1.25, RY + 1.6, wz + 1.3), 0.04, 'iron', NS); }
      box(wt, v3(wx, RY + 3.45, wz), v3(1.75, 0.08, 1.75), 'oldWood', 0, 0, 0, NS);
      pipe(wt, v3(wx, RY + 3.53, wz), v3(wx, RY + 7.3, wz), 1.6, 'towerWood'); pipe(wt, v3(wx, RY + 7.25, wz), v3(wx, RY + 8.6, wz), 1.78, 'roofDark', { cone: true, noCollide: true });
      for (const y of [RY + 4.3, RY + 5.6, RY + 6.8]) pipe(wt, v3(wx, y, wz), v3(wx, y + 0.06, wz), 1.63, 'iron', { noCollide: true });
      surf(wt, HARD);
      const ac = O('AC Units', 'deco'); for (const [x, z] of [[-22, -9], [-24.5, -9], [-9.5, -17], [-11.5, -8]]) { box(ac, v3(x, RY + 0.6, z), v3(0.9, 0.6, 0.7), 'galv'); box(ac, v3(x, RY + 1.22, z), v3(0.45, 0.02, 0.45), 'darkMetal', 0, 0, 0, { noCollide: true }); }
      const hut = O('Stair Hut', 'building', { tall: 2.6 }); box(hut, v3(-26.5, RY + 1.3, -18), v3(1.6, 1.3, 1.8), 'nycBrick'); box(hut, v3(-26.5, RY + 2.63, -18), v3(1.65, 0.03, 1.85), 'roofTar', 0, 0, 0, NS);
      const g = gate('Roof Gate', v3(-27.4, RY + 1.6, -9), 2.2, 1.9, 'x'); for (const dz of [-1.16, 1.16]) pipe(g, v3(-27.4, RY, -9 + dz), v3(-27.4, RY + 0.63, -9 + dz), 0.05, 'gateOrange', NS);
      // the diner's blade sign sticks out of the walk-up's face; the first drop gate hangs from it
      const ds = O('Diner Sign', 'deco'); box(ds, v3(-28.6, 12.6, -2.95), v3(0.08, 1.6, 1.05), 'darkMetal', 0, 0, 0, NS); pic(ds, v3(-28.69, 12.6, -2.9), 1.8, 2.9, -Math.PI / 2, 'signDiner', { solid: false }); pic(ds, v3(-28.51, 12.6, -2.9), 1.8, 2.9, Math.PI / 2, 'signDiner', { solid: false });
      pipe(ds, v3(-28.6, 14.3, -4), v3(-28.6, 14.3, -0.3), 0.05, 'darkMetal', NS); surf(ds, HARD);
      const d1 = gate('Drop Gate 1', v3(-29.4, 12.6, -0.6), 2.0, 1.8, 'z'); for (const dx of [-1.06, 1.06]) hang(d1, v3(-29.4 + dx, 13.56, -0.6), v3(-28.6, 14.3, -0.6));
      const d2 = gate('Drop Gate 2', v3(-33.2, 4.9, 3.6), 2.0, 1.8, 'x'); for (const dz of [-1.06, 1.06]) hang(d2, v3(-33.2, 5.86, 3.6 + dz), v3(-33.2, 6.54, 3.6 + dz)); }
    // the finish: a glowing neon frame hung under the tracks, right over the start box
    { const FX = -38.5, zc = 6, w = 4.0, h = 2.3, yc = 4.9, fo = O('Finish Gate', 'overunder', { obstacle: { a: v3(FX, 0, zc - w / 2), b: v3(FX, 0, zc + w / 2), under: yc + h / 2, over: yc + h / 2 + 0.1 } });
      for (const [c, hh] of [[v3(FX, yc + h / 2 + 0.05, zc), v3(0.05, 0.05, w / 2 + 0.1)], [v3(FX, yc - h / 2 - 0.05, zc), v3(0.05, 0.05, w / 2 + 0.1)], [v3(FX, yc, zc - w / 2 - 0.05), v3(0.05, h / 2 + 0.1, 0.05)], [v3(FX, yc, zc + w / 2 + 0.05), v3(0.05, h / 2 + 0.1, 0.05)]]) box(fo, c, hh, 'neonMagenta', 0, 0, 0, { noSurvey: true, glow: true });
      for (const dz of [-w / 2, w / 2]) hang(fo, v3(FX, yc + h / 2 + 0.1, zc + dz), v3(FX, 6.54, zc + dz));
      pic(fo, v3(FX - 0.08, yc + h / 2 + 0.45, zc), 2.2, 0.55, -Math.PI / 2, 'signFinish', { solid: false }); pic(fo, v3(FX + 0.08, yc + h / 2 + 0.45, zc), 2.2, 0.55, Math.PI / 2, 'signFinish', { solid: false });
      surf(fo, HARD); gapO('Finish Gate opening', v3(FX, yc, zc), v3(1, 0, 0), v3(0, 0, 1), w / 2 - 0.08, h / 2 - 0.08);
      lamp('Finish Neon', v3(FX + 0.5, 5.6, 6), 0xff40c8, 5, 10); }
    // ---- 6 the Tram Weave: gates hung under the cross beams, one standing on the deck west of the train
    [[25, 4.0], [15, 8.0], [5, 4.0], [-5, 8.0]].forEach(([x, z], i) => { const g = gate(`Tram Weave Gate ${i + 1}`, v3(x - 0.5, 4.75, z), 2.2, 1.6, 'x', 'gateOrange', 'neonCyan');
      for (const dz of [-1.16, 1.16]) hang(g, v3(x - 0.5, 5.62, z + dz), v3(x - 0.2, 5.72, z + dz)); });
    { const g = gate('Deck Gate', v3(-13, 8.15, 6), 2.6, 2.2, 'x', 'gateOrange', 'neonCyan'); for (const dz of [-1.36, 1.36]) pipe(g, v3(-13, 6.66, 6 + dz), v3(-13, 6.99, 6 + dz), 0.06, 'gateOrange', NS); }

    return K.done({ id: 'slackvegan', title: 'Slackvegan City', theme: 'nyc', zones, groundHoles, groundCuts, spawn: { pos: v3(-41, 0.03, 6), yaw: -Math.PI / 2 }, bounds: { x: [-XW - 1, XW + 1], z: [-25, 43] } });
  }
  // =============================================================== The Training Room (owner, 2026-11-20)
  // A vast gray concrete box: no lore, no personality, no candy. High observation windows of pale, featureless light; flat
  // shadowless light; nothing moves. The west half is the trick bay (the Trick Park's lab-sheet obstacles: test bars, gap
  // gates, poles, a figure-8 pair, a ceiling slab, a wall, a dive tower, the open-air box, and a pilot figure); Train drops
  // the pilot in front of the one the trick needs (coachStation in coach.js). The east half is the training circuit: 1 the
  // Entry Straight, 2 the First 180, 3 the Center Cross, 4 the High Line, 5 the Precision Corridor, 6 the Return Loop with
  // its offset gate. Not in the Maps carousel (hidden): Train loads it and leaves it. The map is the same for every trick,
  // so a flight re-flies exactly.
  function buildTraining() {
    const K = kit(), { O, box } = K, { frame } = parts(K), zones = [];
    const X = 50, Z = 30, H = 18, T = 0.4;
    for (const [c, h, n, name] of [[v3(0, H / 2, -Z - T / 2), v3(X + T, H / 2, T / 2), v3(0, 0, 1), 'North Wall'], [v3(0, H / 2, Z + T / 2), v3(X + T, H / 2, T / 2), v3(0, 0, -1), 'South Wall'],
      [v3(-X - T / 2, H / 2, 0), v3(T / 2, H / 2, Z), v3(1, 0, 0), 'West Wall'], [v3(X + T / 2, H / 2, 0), v3(T / 2, H / 2, Z), v3(-1, 0, 0), 'East Wall']]) {
      const o = O(name, 'wall', { wallNormal: n }); box(o, c, h, 'labWall', 0, 0, 0, { noSurvey: true });
      // the observation windows: a row high on every wall, pale glass in dark frames, looking down at the floor
      const along = n.z ? 'x' : 'z', L = n.z ? X : Z, step = 8, y = 13.4, wh = 1.9, ww = 2.7, inset = (n.z ? c.z : c.x) + (n.z ? n.z : n.x) * (T / 2 + 0.02);
      const w = O('Observation Window', 'deco');
      for (let u = -L + step / 2; u <= L - step / 2 + 0.01; u += step) {
        const at = (du, dy) => along === 'x' ? v3(u + du, y + dy, inset) : v3(inset, y + dy, u + du), hs = (a, b) => along === 'x' ? v3(a, b, 0.03) : v3(0.03, b, a);
        box(w, at(0, 0), hs(ww / 2 + 0.12, wh / 2 + 0.12), 'labFrame', 0, 0, 0, { noCollide: true });
        box(w, along === 'x' ? v3(u, y, inset + n.z * 0.02) : v3(inset + n.x * 0.02, y, u), hs(ww / 2, wh / 2), 'labWindow', 0, 0, 0, { noCollide: true });
        box(w, along === 'x' ? v3(u, y, inset + n.z * 0.03) : v3(inset + n.x * 0.03, y, u), hs(0.035, wh / 2), 'labFrame', 0, 0, 0, { noCollide: true }); } }
    { const o = O('Ceiling', 'deco'); box(o, v3(0, H + 0.25, 0), v3(X + T, 0.25, Z + T), 'labWall', 0, 0, 0, { noSurvey: true }); }
    zones.push({ shape: 'zone', mat: 'labFloor', c: v3(0, 0.006, 0), h: v3(X, 0, Z) });
    // ---- the trick bay (west): the Trick Park's obstacles in lab gray, and a pilot to fly round
    trickPark(K, -47, 0, 1, { post: 'labGate', bar: 'labBar', pole: 'labGate', slab: 'labWall', wall: 'labWall', tower: 'labWall', accent: 'labMark', glow: false, zone: 'labFloor' });
    addPilot(K, -18, 19);
    // ---- big objects (owner, 2026-11-21: "the tests for loops and trippy spins should be on large objects … a 10 m object for the
    // square"): a square frame 10 m wide and 10 m high between the bay and the circuit, flown east-west, and a tall thick pole
    { const x = -8, za = -15, zb = -5, h = 10, r = 0.1, o = K.O('Big Square 10 m', 'overunder', { obstacle: { a: v3(x, 0, za), b: v3(x, 0, zb), under: h - r, over: h + r } });
      for (const z of [za, zb]) K.pipe(o, v3(x, 0, z), v3(x, h, z), 0.12, 'labGate'); K.pipe(o, v3(x, h, za), v3(x, h, zb), r, 'labBar');
      box(o, v3(x, 0.006, -10), v3(0.04, 0.004, 5), 'labMark', 0, 0, 0, { noCollide: true }); }
    { const o = K.O('Big Pole 12 m', 'pole'); K.pipe(o, v3(-10, 0, 11), v3(-10, 12, 11), 0.3, 'labGate'); }
    // ---- the training circuit (east). Gates are plain square frames; the route runs clockwise from the start (-4, 22)
    const G = (name, x, z, w, h, along) => frame(name, x, z, w, h, along, 'labGate');
    G('1 Entry Gate', 40, 22, 3.2, 3.0, 'z');                                    // 1 the Entry Straight: one line, one gate
    G('2 First 180 Gate A', 46, 14, 3.0, 2.8, 'x'); G('2 First 180 Gate B', 38, 6, 3.0, 2.8, 'z');   // 2 the First 180: a wide U-turn
    G('3 Center Cross N', 18, 1, 2.6, 2.6, 'x'); G('3 Center Cross S', 18, 11, 2.6, 2.6, 'x');       // 3 the Center Cross: a plus sign
    G('3 Center Cross W', 13, 6, 2.6, 2.6, 'z'); G('3 Center Cross E', 23, 6, 2.6, 2.6, 'z');
    // 4 the High Line: plain concrete blocks and platforms of varying heights, lowest first
    [[44, 0.8], [39, 1.6], [34, 2.4], [29, 3.2], [24, 2.0], [19, 1.2]].forEach(([x, h], i) => { const o = O(`4 High Line Block ${h.toFixed(1)} m`, 'building', { tall: h, perchHeight: h });
      box(o, v3(x, h / 2, -10), v3(i === 3 ? 2.5 : 1.5, h / 2, i === 3 ? 2.5 : 1.5), 'labBlock', 0, 0, 0, { noSurvey: true }); });
    // 5 the Precision Corridor: two long barriers, a 3.4 m lane, four tight gates in it
    for (const [z, n] of [[-19.8, v3(0, 0, -1)], [-23.6, v3(0, 0, 1)]]) { const o = O('5 Corridor Barrier', 'wall', { wallNormal: n }); box(o, v3(23, 1.25, z), v3(17, 1.25, 0.15), 'labBlock', 0, 0, 0, { noSurvey: true }); }
    [34, 27, 20, 13].forEach((x, i) => G(`5 Corridor Gate ${i + 1}`, x, -21.7, 1.6, 1.8, 'z'));
    // 6 the Return Loop: a wide open sweep back north-west to the start; its gate hangs a little off the line
    G('6 Return Gate', 1.4, 11, 2.6, 2.6, 'x');
    { const o = O('Start Mark', 'deco'); box(o, v3(-4, 0.008, 22), v3(0.9, 0.004, 0.9), 'labMark', 0, 0, 0, { noCollide: true }); }
    return K.done({ id: 'training', title: 'The Training Room', theme: 'lab', zones, spawn: { pos: v3(-4, 0.03, 22), yaw: -Math.PI / 2 }, bounds: { x: [-X, X], z: [-Z, Z] } });
  }
  S.MAPS = {
    moose: { id: 'moose', title: 'Moose Knuckle Park', blurb: 'A quiet Revelstoke park: tall cedars to weave through, swings, a tire tunnel and mountain views.', build: () => closeIn(S.surveyObstacles(edited('moose', buildMoose()))) },
    school: { id: 'school', hidden: true, title: 'Vaporwave School', blurb: 'An abandoned school at sunset: a bowl, chrome pillars, rooftop gaps and empty classrooms.', build: () => closeIn(S.surveyObstacles(edited('school', buildSchool()))) },
    clappy: { id: 'clappy', title: 'Clappy Park', blurb: 'A sunny city park: slides and climbing bars, cherry trees, rooftops and alleys to rip.', build: () => closeIn(S.surveyObstacles(edited('clappy', buildClappy()))) },
    warehouse: { id: 'warehouse', title: 'More Warehouse', blurb: 'A huge warehouse: rack aisles, container stacks, catwalks and skylights to dive through.', build: () => closeIn(S.surveyObstacles(edited('warehouse', buildWarehouse()))) },
    ship: { id: 'ship', title: 'Ship Drugs', blurb: 'An 80s cruise ship mid police raid: a neon atrium, a drained pool, slide tubes and lots of gaps.', build: () => closeIn(S.surveyObstacles(edited('ship', buildShip()))) },
    murderdome: { id: 'murderdome', title: 'The Murderdome', blurb: 'A ruined dome at dusk: scrap, fire, chain-link and a bowl. Witness me!', build: () => closeIn(S.surveyObstacles(edited('murderdome', buildMurderdome()))) },
    slackvegan: { id: 'slackvegan', title: 'Slackvegan City', blurb: 'A sticky New York block at golden hour: taxis, the El, fire escapes, round voids and a full-building dive. The bodega cat judges.', build: () => closeIn(S.surveyObstacles(edited('slackvegan', buildSlackvegan()))) },
    training: { id: 'training', hidden: true, title: 'The Training Room', blurb: 'A large, empty gray concrete room. Train loads it for you.', build: () => closeIn(S.surveyObstacles(buildTraining())) },
    playground: { id: 'playground', title: 'The Playground', blurb: 'Where it all started: swings, slides, monkey bars, a brick wall and a skate corner.', build: () => closeIn(S.surveyObstacles(edited('playground', Object.assign(addPlaygroundExtras(S.buildPlayground()), { id: 'playground', title: 'the playground', theme: 'playground' })))) },
  };
  S.buildTraining = buildTraining; S.buildSchool = buildSchool; S.buildClappy = buildClappy; S.buildWarehouse = buildWarehouse; S.buildMoose = buildMoose; S.buildMurderdome = buildMurderdome; S.buildSlackvegan = buildSlackvegan;
})(typeof window !== 'undefined' ? window : globalThis);
