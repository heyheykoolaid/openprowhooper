// Maps. Pure JS (runs in Node for tests, in the browser after sim.js). A map is what buildPlayground() returns:
// { objs, prims, zones, spawn, bounds } plus id / title / theme. Objects carry collision prims, `vis` shapes for the
// view, and the tags the trick detector reads: `obstacle` (over/under line), `round`, `gap`, kind 'pole' capsules,
// kind 'wall' / 'building' for wall rides, kind 'pilot'. Nothing here is special-cased by name in the detector.
(function (root) {
  const S = root.Sim, { v3, makeBox, makeCapsule, makeSphere } = S;
  function kit(base) {   // base: an existing map to add to (its objects keep their ids)
    const objs = base ? base.objs : []; let nid = objs.reduce((m, o) => Math.max(m, o.id + 1), 0);
    const O = (name, kind, extra = {}) => { const o = { id: nid++, name, kind, prims: [], vis: [], ...extra }; objs.push(o); return o; };
    const box = (o, c, h, mat, ry = 0, rx = 0, rz = 0, opts = {}) => { const b = makeBox(c, h, ry, rx, rz); if (!opts.noCollide) o.prims.push(b); o.vis.push({ shape: 'box', c, h, mat, euler: [rx, ry, rz], ...opts }); return b; };
    const pipe = (o, a, b, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(makeCapsule(a, b, r)); o.vis.push({ shape: 'pipe', a, b, r, mat, ...opts }); };
    const ball = (o, c, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(makeSphere(c, r)); o.vis.push({ shape: 'sphere', c, r, mat, ...opts }); };
    // a glowing strip: seen, never hit
    const neon = (o, c, h, mat = 'neonPink', ry = 0) => box(o, c, h, mat, ry, 0, 0, { noCollide: true, glow: true });
    // a flat round slab (drawn as a disc, collides as a box a little inside its rim)
    const disc = (o, c, r, th, mat) => { o.prims.push(makeBox(c, v3(r * 0.74, th, r * 0.74))); o.vis.push({ shape: 'disc', c, r, th, mat }); };
    const done = (extra) => { const all = []; for (const o of objs) for (const p of o.prims) { p.owner = o.id; all.push(p); } return { objs, prims: all, ...extra }; };
    return { objs, O, box, pipe, ball, neon, disc, done };
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

  S.MAPS = {
    school: { id: 'school', title: 'Vaporwave School', blurb: 'An abandoned school under a pink sunset: chrome pillar plaza, courtyard bowl, pillar hall, rooftop gaps, classroom wing, and the Trick Park to the west.', build: () => S.surveyObstacles(buildSchool()) },
    playground: { id: 'playground', title: 'The Playground', blurb: 'The original: swing set, slide tower, monkey bars, trees, the flagpole and the brick building, now with a skate corner, scaffold, and the Trick Park to the west.', build: () => S.surveyObstacles(Object.assign(addPlaygroundExtras(S.buildPlayground()), { id: 'playground', title: 'the playground', theme: 'playground' })) },
  };
  S.buildSchool = buildSchool;
})(typeof window !== 'undefined' ? window : globalThis);
