// RaceGOW-style racing: PVC pipe gates, tracks, rooms to build them in, lap timing and the race rules.
// Pure JS (runs in Node for tests, and in the browser after sim.js). The editor and the race HUD live in game.js.
//
// Look: RaceGOW tracks are built from white PVC pipe in 24" (0.61 m) sections — uprights, crossbars, T-feet, elbow and
// tee connectors — in living rooms and garages. Rules: Velocidrone-style ordered gates; a clean lap passes every required
// gate in order, in the right direction, without a crash; Infinite mode chases the best three consecutive clean laps.
(function (root) {
  const S = root.Sim;
  const { v3, add, sub, mul, dot, cross, len, norm } = S;
  const U = 0.6096;            // one 24" PVC section, centre to centre
  const PIPE_R = 0.0134;       // 3/4" schedule-40 PVC (26.7 mm OD)
  const D2R = Math.PI / 180;
  const COLORS = { white: '#f4f4ef', orange: '#ff7a1a', blue: '#2f7bff', yellow: '#ffd21f', green: '#2fc45a', red: '#e8322e', black: '#1d1d1f', pink: '#ff5fb5' };

  // ------------------------------------------------------------------ gate library
  // Local frame: x right, y up, z backward — so a gate with yaw 0 is flown through toward -z, the same way a quad with
  // yaw 0 points. Sizes are in sections (U). build(g) -> { pipes: [[a, b]], decor: [...], opening }.
  // opening: { x0, x1, y0, y1, arch? } in local units on the z = 0 plane; null = a prop, not something to fly through.
  const P = (x, y, z) => v3(x, y, z);
  const feet = (x, L = 0.5) => [[P(x, 0, -L), P(x, 0, L)]];           // T-foot lying on the floor, across the gate
  function frame(w, h, lift, opts = {}) {
    const x = w / 2, top = lift + h, pipes = [[P(-x, 0, 0), P(-x, top, 0)], [P(x, 0, 0), P(x, top, 0)], [P(-x, top, 0), P(x, top, 0)], ...feet(-x), ...feet(x)];
    if (lift > 0.05 && !opts.noBottom) pipes.push([P(-x, lift, 0), P(x, lift, 0)]);
    if (opts.mid) pipes.push([P(-x, lift + h / 2, 0), P(x, lift + h / 2, 0)]);
    return pipes;
  }
  const GATE_TYPES = {
    gate:   { label: 'Gate', desc: 'Square PVC gate on T-feet', defaults: { w: 1, h: 1, lift: 0.5 },
      build: g => ({ pipes: frame(g.w, g.h, g.lift), opening: { x0: -g.w / 2, x1: g.w / 2, y0: g.lift, y1: g.lift + g.h } }) },
    wide:   { label: 'Wide gate', desc: 'Two sections wide', defaults: { w: 2, h: 1, lift: 0.5 }, base: 'gate' },
    tall:   { label: 'Tall gate', desc: 'Two sections tall', defaults: { w: 1, h: 2, lift: 0.5 }, base: 'gate' },
    big:    { label: 'Big gate', desc: '2 × 2 sections', defaults: { w: 2, h: 2, lift: 0 }, base: 'gate' },
    low:    { label: 'Low gate', desc: 'Sits on the floor', defaults: { w: 1, h: 0.75, lift: 0 }, base: 'gate' },
    ladder: { label: 'Ladder', desc: 'Two openings stacked (either counts)', defaults: { w: 1, h: 2, lift: 0.5 },
      build: g => ({ pipes: frame(g.w, g.h, g.lift, { mid: true }), opening: { x0: -g.w / 2, x1: g.w / 2, y0: g.lift, y1: g.lift + g.h } }) },
    arch:   { label: 'Arch', desc: 'Uprights with a round top', defaults: { w: 1, h: 1.25, lift: 0 },
      build: g => { const r = g.w / 2, yc = g.lift + g.h - r, pipes = [[P(-r, 0, 0), P(-r, yc, 0)], [P(r, 0, 0), P(r, yc, 0)], ...feet(-r), ...feet(r)];
        const n = 8; for (let i = 0; i < n; i++) { const a0 = Math.PI * i / n, a1 = Math.PI * (i + 1) / n; pipes.push([P(r * Math.cos(a0), yc + r * Math.sin(a0), 0), P(r * Math.cos(a1), yc + r * Math.sin(a1), 0)]); }
        if (g.lift > 0.05) pipes.push([P(-r, g.lift, 0), P(r, g.lift, 0)]);
        return { pipes, opening: { x0: -r, x1: r, y0: g.lift, y1: g.lift + g.h, arch: { yc, r } } }; } },
    hurdle: { label: 'Hurdle', desc: 'Low bar: fly over it', defaults: { w: 2, h: 0.5, lift: 0 },
      build: g => ({ pipes: [[P(-g.w / 2, 0, 0), P(-g.w / 2, g.h, 0)], [P(g.w / 2, 0, 0), P(g.w / 2, g.h, 0)], [P(-g.w / 2, g.h, 0), P(g.w / 2, g.h, 0)], ...feet(-g.w / 2), ...feet(g.w / 2)],
        opening: { x0: -g.w / 2, x1: g.w / 2, y0: g.h, y1: g.h + 3 } }) },
    flag:   { label: 'Flag gate', desc: 'Two flag poles: fly between', defaults: { w: 2, h: 2.5, lift: 0 },
      build: g => ({ pipes: [[P(-g.w / 2, 0, 0), P(-g.w / 2, g.h, 0)], [P(g.w / 2, 0, 0), P(g.w / 2, g.h, 0)], ...feet(-g.w / 2), ...feet(g.w / 2)],
        decor: [{ shape: 'flag', at: P(-g.w / 2, g.h, 0), side: 1 }, { shape: 'flag', at: P(g.w / 2, g.h, 0), side: -1 }],
        opening: { x0: -g.w / 2, x1: g.w / 2, y0: 0, y1: g.h } }) },
    cube:   { label: 'Cube', desc: 'One-section cube on legs: fly through front to back', defaults: { w: 1, h: 1, lift: 0.5 },
      build: g => { const x = g.w / 2, y0 = g.lift, y1 = g.lift + g.h, z = g.w / 2, pipes = [];
        for (const zz of [-z, z]) pipes.push([P(-x, 0, zz), P(-x, y1, zz)], [P(x, 0, zz), P(x, y1, zz)], [P(-x, y1, zz), P(x, y1, zz)], [P(-x, y0, zz), P(x, y0, zz)]);
        for (const xx of [-x, x]) for (const yy of [y0, y1]) pipes.push([P(xx, yy, -z), P(xx, yy, z)]);
        return { pipes, opening: { x0: -x, x1: x, y0, y1 } }; } },
    start:  { label: 'Start / Finish', desc: 'Wide gate with a chequered banner', defaults: { w: 2, h: 1, lift: 0.5 },
      build: g => ({ ...GATE_TYPES.gate.build(g), decor: [{ shape: 'banner', a: P(-g.w / 2, g.lift + g.h + 0.02, 0), b: P(g.w / 2, g.lift + g.h + 0.02, 0), hgt: 0.35 }] }) },
    pylon:  { label: 'Pylon', desc: 'Turn marker (a prop, not a gate)', defaults: { w: 0.5, h: 2, lift: 0 }, prop: true,
      build: g => ({ pipes: [[P(0, 0, 0), P(0, g.h, 0)], [P(-g.w / 2, 0, 0), P(g.w / 2, 0, 0)], [P(0, 0, -g.w / 2), P(0, 0, g.w / 2)]], decor: [{ shape: 'cap', at: P(0, g.h, 0) }], opening: null }) },
    // loose pipes for building one connected structure (RaceGOW tracks are a single frame; the checkpoints are its openings)
    pipe:   { label: 'Pipe ↕ upright', desc: 'One upright pipe, h sections long (gets a foot when it stands on the floor)', defaults: { w: 1, h: 1, lift: 0 }, prop: true, loose: true,
      build: g => ({ pipes: [[P(0, 0, 0), P(0, g.h, 0)], ...(g.pos[1] < 0.02 && !(g.rot[1] || g.rot[2]) ? [[P(-0.09, 0, 0), P(0.09, 0, 0)], [P(0, 0, -0.09), P(0, 0, 0.09)]] : [])], opening: null }) },
    bar:    { label: 'Pipe ↔ flat', desc: 'One horizontal pipe, w sections long', defaults: { w: 1, h: 1, lift: 0 }, prop: true, loose: true,
      build: g => ({ pipes: [[P(-g.w / 2, 0, 0), P(g.w / 2, 0, 0)]], opening: null }) },
    invisible: { label: 'Checkpoint', desc: 'A rectangle to fly through, any size and angle, no pipes of its own: put it in an opening of your structure', defaults: { w: 1, h: 1, lift: 0 }, invisible: true,
      build: g => ({ pipes: [], opening: { x0: -g.w / 2, x1: g.w / 2, y0: g.lift, y1: g.lift + g.h } }) },
  };
  for (const t of Object.values(GATE_TYPES)) if (t.base) t.build = GATE_TYPES[t.base].build;
  const isProp = g => !!(GATE_TYPES[g.type] && GATE_TYPES[g.type].prop);

  let nextId = 1;
  function newGate(type, pos, yaw = 0, extra = {}) {
    const T = GATE_TYPES[type] || GATE_TYPES.gate;
    return { id: 'g' + (nextId++) + Math.random().toString(36).slice(2, 6), type, pos: [pos.x ?? pos[0], pos.y ?? pos[1] ?? 0, pos.z ?? pos[2]], rot: [yaw, 0, 0], scale: 1,
      ...T.defaults, color: 'white', required: !T.prop, bidir: false, ...extra };
  }
  // rotation matrix R = Ry * Rx * Rz from [yaw, pitch, roll] in degrees (the same order three.js 'YXZ' uses)
  function rotM(rot) {
    const ry = (rot[0] || 0) * D2R, rx = (rot[1] || 0) * D2R, rz = (rot[2] || 0) * D2R;
    const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
    return [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
  }
  const mv = (m, p) => v3(m[0] * p.x + m[1] * p.y + m[2] * p.z, m[3] * p.x + m[4] * p.y + m[5] * p.z, m[6] * p.x + m[7] * p.y + m[8] * p.z);
  const mtv = (m, p) => v3(m[0] * p.x + m[3] * p.y + m[6] * p.z, m[1] * p.x + m[4] * p.y + m[7] * p.z, m[2] * p.x + m[5] * p.y + m[8] * p.z);
  // world geometry of a gate: pipes, connector joints, and the opening as a plane + local bounds (metres)
  function gateGeom(g) {
    const T = GATE_TYPES[g.type] || GATE_TYPES.gate, b = T.build(g), m = rotM(g.rot || [0, 0, 0]), s = (g.scale || 1) * U, o = v3(g.pos[0], g.pos[1], g.pos[2]);
    const W = p => add(o, mv(m, mul(p, s)));
    const pipes = b.pipes.map(([a, c]) => [W(a), W(c)]);
    const key = p => p.x.toFixed(3) + ',' + p.y.toFixed(3) + ',' + p.z.toFixed(3), J = new Map();
    for (const [a, c] of b.pipes) for (const p of [a, c]) { const k = key(p); J.set(k, (J.get(k) || { p, n: 0 })); J.get(k).n++; }
    const joints = [...J.values()].filter(j => j.p.y > 0.001 || j.n > 1).map(j => W(j.p));
    const right = mv(m, v3(1, 0, 0)), up = mv(m, v3(0, 1, 0)), fwd = mv(m, v3(0, 0, -1));
    const op = b.opening ? { ...b.opening, x0: b.opening.x0 * s, x1: b.opening.x1 * s, y0: b.opening.y0 * s, y1: b.opening.y1 * s, arch: b.opening.arch ? { yc: b.opening.arch.yc * s, r: b.opening.arch.r * s } : null } : null;
    const decor = (b.decor || []).map(d => ({ ...d, at: d.at && W(d.at), a: d.a && W(d.a), b: d.b && W(d.b), hgt: (d.hgt || 0) * s }));
    const centre = op ? add(o, add(mul(right, (op.x0 + op.x1) / 2), mul(up, (op.y0 + op.y1) / 2))) : add(o, mul(up, 0.5 * s));
    return { g, o, m, s, right, up, fwd, pipes, joints, opening: op, decor, centre, invisible: !!T.invisible, prop: !!T.prop };
  }
  // where the drone point p sits relative to the opening: local (x, y) on the plane and signed distance along fwd
  function local(G, p) { const d = sub(p, G.o); return { x: dot(d, G.right), y: dot(d, G.up), z: dot(d, G.fwd) }; }
  function insideOpening(G, x, y, margin = 0) {
    const op = G.opening; if (!op) return false;
    if (x < op.x0 - margin || x > op.x1 + margin || y < op.y0 - margin || y > op.y1 + margin) return false;
    if (op.arch && y > op.arch.yc) return Math.hypot(x - (op.x0 + op.x1) / 2, y - op.arch.yc) <= op.arch.r + margin;
    return true;
  }
  // segment p0 -> p1 crosses the opening: +1 the right way, -1 backwards through it, 0 not through it
  function crossing(G, p0, p1) {
    if (!G.opening) return 0;
    const a = local(G, p0), b = local(G, p1); if ((a.z > 0) === (b.z > 0) || a.z === b.z) return 0;
    const f = a.z / (a.z - b.z), x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    if (!insideOpening(G, x, y, 0.01)) return 0;
    return b.z > a.z ? 1 : -1;
  }
  // reset point: just after the opening, at its centre height, facing through
  function resetPoint(G) {
    const c = G.centre, p = add(c, mul(G.fwd, 0.55)), fh = Math.hypot(G.fwd.x, G.fwd.z) || 1;
    return { pos: v3(p.x, Math.max(0.05, p.y), p.z), yaw: Math.atan2(-G.fwd.x / fh, -G.fwd.z / fh) };
  }
  // connectors for the whole structure: wherever a pipe end of one part touches a pipe of another part
  function segPoint(p, a, b) { const ab = sub(b, a), L2 = dot(ab, ab) || 1e-9, f = Math.max(0, Math.min(1, dot(sub(p, a), ab) / L2)); return add(a, mul(ab, f)); }
  function trackJoints(geoms) {
    const out = [], seen = new Set(), key = p => Math.round(p.x * 50) + ',' + Math.round(p.y * 50) + ',' + Math.round(p.z * 50);
    geoms.forEach((G, i) => { if (G.invisible) return; for (const [a, b] of G.pipes) for (const e of [a, b]) {
      if (seen.has(key(e))) continue;
      for (let j = 0; j < geoms.length; j++) { if (j === i || geoms[j].invisible) continue;
        if (geoms[j].pipes.some(([c, d]) => len(sub(segPoint(e, c, d), e)) < 0.02)) { seen.add(key(e)); out.push(e); break; } } } });
    return out;
  }
  // magnet: the smallest shift that puts one of this part's pipe ends on another part's pipe end (or onto its pipe)
  function snapDelta(G, others, tol = 0.12) {
    let best = null; const ends = []; for (const [a, b] of G.pipes) ends.push(a, b); if (!ends.length) return null;
    for (const O of others) { if (O.invisible) continue; for (const [c, d] of O.pipes) for (const e of ends) {
      for (const [q, w] of [[c, 0], [d, 0], [segPoint(e, c, d), 0.02]]) { const dv = sub(q, e), L = len(dv) + w; if (L < tol && (!best || L < best.L)) best = { L, d: dv }; } } }
    return best ? best.d : null;
  }
  function gatePrims(G) { return G.invisible ? [] : G.pipes.map(([a, b]) => S.makeCapsule(a, b, PIPE_R)); }

  // ------------------------------------------------------------------ rooms to build in
  // vis entries use the game's shape/material names (box, pipe, sphere; materials defined in game.js mats())
  function room(name, X, Z, H, floorMat, wallMat, furnish) {
    const objs = []; let nid = 0;
    const O = (nm, kind, extra = {}) => { const o = { id: nid++, name: nm, kind, prims: [], vis: [], ...extra }; objs.push(o); return o; };
    const box = (o, c, h, mat, ry = 0, opts = {}) => { const b = S.makeBox(c, h, ry, 0, 0); if (!opts.noCollide) o.prims.push(b); o.vis.push({ shape: 'box', c, h, mat, euler: [0, ry, 0], ...opts }); return b; };
    const pipe = (o, a, b, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(S.makeCapsule(a, b, r)); o.vis.push({ shape: 'pipe', a, b, r, mat, ...opts }); };
    const walls = O('Walls', 'wall', { wallNormal: v3(0, 0, 1) }), t = 0.1;
    box(walls, v3(0, H / 2, -Z / 2 - t), v3(X / 2 + t * 2, H / 2, t), wallMat);
    box(walls, v3(0, H / 2, Z / 2 + t), v3(X / 2 + t * 2, H / 2, t), wallMat);
    box(walls, v3(-X / 2 - t, H / 2, 0), v3(t, H / 2, Z / 2), wallMat);
    box(walls, v3(X / 2 + t, H / 2, 0), v3(t, H / 2, Z / 2), wallMat);
    const ceil = O('Ceiling', 'building'); box(ceil, v3(0, H + t, 0), v3(X / 2 + 0.2, t, Z / 2 + 0.2), 'ceiling');
    furnish({ O, box, pipe, X, Z, H });
    const zones = [{ shape: 'zone', mat: floorMat, c: v3(0, 0.004, 0), h: v3(X / 2, 0, Z / 2) }];
    const all = []; for (const o of objs) for (const pr of o.prims) { pr.owner = o.id; all.push(pr); }
    return { name, indoor: true, objs, prims: all, zones, size: { x: X, z: Z, h: H }, spawn: { pos: v3(0, 0.03, Z / 2 - 0.8), yaw: 0 }, bounds: { x: [-X / 2, X / 2], z: [-Z / 2, Z / 2] },
      lights: [[-X / 4, H - 0.05, 0], [X / 4, H - 0.05, 0]] };
  }
  const ENVIRONMENTS = {
    livingroom: { label: 'Living room', desc: '7.2 × 5.4 m, 2.5 m ceiling: couch, coffee table, TV, bookshelf', build: () => room('Living room', 7.2, 5.4, 2.5, 'hardwood', 'drywall', ({ O, box, X, Z }) => {
      const couch = O('Couch', 'furniture'); box(couch, v3(-1.2, 0.22, -Z / 2 + 0.5), v3(1.1, 0.22, 0.45), 'fabric'); box(couch, v3(-1.2, 0.6, -Z / 2 + 0.12), v3(1.1, 0.4, 0.1), 'fabric');
      box(couch, v3(-2.35, 0.35, -Z / 2 + 0.45), v3(0.12, 0.35, 0.45), 'fabric'); box(couch, v3(-0.05, 0.35, -Z / 2 + 0.45), v3(0.12, 0.35, 0.45), 'fabric');
      const table = O('Coffee table', 'furniture'); box(table, v3(-1.2, 0.42, -Z / 2 + 1.55), v3(0.55, 0.03, 0.3), 'darkwood');
      for (const [dx, dz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) box(table, v3(-1.2 + dx, 0.2, -Z / 2 + 1.55 + dz), v3(0.025, 0.2, 0.025), 'darkwood');
      const tv = O('TV stand', 'furniture'); box(tv, v3(2.2, 0.25, -Z / 2 + 0.25), v3(0.8, 0.25, 0.22), 'darkwood'); box(tv, v3(2.2, 0.92, -Z / 2 + 0.2), v3(0.6, 0.36, 0.03), 'tv');
      const shelf = O('Bookshelf', 'furniture'); box(shelf, v3(X / 2 - 0.2, 0.95, 1.2), v3(0.18, 0.95, 0.45), 'darkwood');
      const rug = O('Rug', 'decor'); box(rug, v3(-0.6, 0.008, 0.2), v3(1.6, 0.006, 1.1), 'rug', 0, { noCollide: true });
      const plant = O('Plant', 'furniture'); box(plant, v3(-X / 2 + 0.3, 0.2, Z / 2 - 0.4), v3(0.18, 0.2, 0.18), 'pot'); box(plant, v3(-X / 2 + 0.3, 0.7, Z / 2 - 0.4), v3(0.3, 0.32, 0.3), 'leaves', 0, { noCollide: true });
    }) },
    garage: { label: 'Garage', desc: '9 × 7 m, 3 m ceiling: workbench, shelving, bins', build: () => room('Garage', 9, 7, 3.0, 'garageFloor', 'cinder', ({ O, box, pipe, X, Z }) => {
      const bench = O('Workbench', 'furniture'); box(bench, v3(-1.5, 0.92, -Z / 2 + 0.38), v3(1.2, 0.04, 0.35), 'plywood');
      for (const dx of [-1.1, 1.1]) for (const dz of [-0.3, 0.3]) box(bench, v3(-1.5 + dx, 0.45, -Z / 2 + 0.38 + dz), v3(0.04, 0.45, 0.04), 'plywood');
      box(bench, v3(-1.5, 1.6, -Z / 2 + 0.06), v3(1.2, 0.5, 0.02), 'pegboard', 0, { noCollide: true });
      const shelf = O('Shelving', 'furniture'); for (const y of [0.35, 0.9, 1.45, 2.0]) box(shelf, v3(X / 2 - 0.3, y, -1.5), v3(0.28, 0.02, 0.9), 'metal');
      for (const dz of [-0.88, 0.88]) for (const dx of [-0.26, 0.26]) pipe(shelf, v3(X / 2 - 0.3 + dx, 0, -1.5 + dz), v3(X / 2 - 0.3 + dx, 2.05, -1.5 + dz), 0.018, 'metal');
      const bins = O('Storage bins', 'furniture'); for (let i = 0; i < 3; i++) box(bins, v3(X / 2 - 0.3, 0.6 + i * 0.55 - 0.2, -1.5), v3(0.25, 0.14, 0.3), i % 2 ? 'binBlue' : 'binRed', 0, { noCollide: true });
      const door = O('Garage door', 'decor'); box(door, v3(0, 1.2, Z / 2 + 0.005), v3(2.6, 1.2, 0.01), 'garageDoor', 0, { noCollide: true });
      const chest = O('Tool chest', 'furniture'); box(chest, v3(-X / 2 + 0.35, 0.5, 1.5), v3(0.3, 0.5, 0.5), 'binRed');
    }) },
    warehouse: { label: 'Warehouse', desc: '24 × 16 m, 7 m ceiling, pillars and pallet racks', build: () => room('Warehouse', 24, 16, 7, 'garageFloor', 'cinder', ({ O, box, pipe, X, Z }) => {
      const pil = O('Pillars', 'pillar'); for (const x of [-6, 6]) for (const z of [-3.5, 3.5]) box(pil, v3(x, 3.5, z), v3(0.2, 3.5, 0.2), 'concrete');
      const rack = O('Pallet racks', 'furniture');
      for (let i = 0; i < 4; i++) { const x = -9 + i * 6; for (const y of [1.2, 2.6]) box(rack, v3(x, y, -Z / 2 + 0.6), v3(2.6, 0.05, 0.5), 'rackOrange');
        for (const dx of [-2.6, 2.6]) for (const dz of [-0.5, 0.5]) pipe(rack, v3(x + dx, 0, -Z / 2 + 0.6 + dz), v3(x + dx, 3.2, -Z / 2 + 0.6 + dz), 0.04, 'rackBlue'); }
    }) },
    playground: { label: 'Playground (outdoor)', desc: 'The trick playground: build a track round the obstacles', build: null },
  };

  // ------------------------------------------------------------------ tracks
  function newTrack(env = 'livingroom', name = 'My track') {
    const E = ENVIRONMENTS[env] && ENVIRONMENTS[env].build ? ENVIRONMENTS[env].build() : null;
    const sp = E ? E.spawn : { pos: v3(0, 0.03, 12), yaw: 0 };
    return { format: 'pro-whooper-track/1', id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, env, created: new Date().toISOString(),
      launch: { pos: [sp.pos.x, 0.03, sp.pos.z], yaw: 0 }, startFinish: true, gates: [] };
  }
  function cleanTrack(t) {   // accept anything that looks like a track file; drop unknown fields
    if (!t || !Array.isArray(t.gates)) throw new Error('not a track file');
    const n = x => (typeof x === 'number' && isFinite(x) ? x : 0);
    return { format: 'pro-whooper-track/1', id: String(t.id || ('t' + Date.now().toString(36))), name: String(t.name || 'Track').slice(0, 60), env: ENVIRONMENTS[t.env] ? t.env : 'livingroom',
      created: t.created || new Date().toISOString(), launch: { pos: (t.launch && t.launch.pos || [0, 0.03, 2]).slice(0, 3).map(n), yaw: n(t.launch && t.launch.yaw) }, startFinish: t.startFinish !== false, nextOnly: !!t.nextOnly,
      gates: t.gates.filter(g => GATE_TYPES[g.type]).slice(0, 300).map(g => ({ id: String(g.id || ('g' + nextId++)), type: g.type, pos: (g.pos || [0, 0, 0]).slice(0, 3).map(n), rot: (g.rot || [0, 0, 0]).slice(0, 3).map(n),
        scale: Math.min(4, Math.max(0.25, n(g.scale) || 1)), w: Math.min(12, Math.max(0.125, n(g.w) || GATE_TYPES[g.type].defaults.w)), h: Math.min(12, Math.max(0.125, n(g.h) || GATE_TYPES[g.type].defaults.h)),
        lift: Math.min(8, Math.max(0, g.lift == null ? GATE_TYPES[g.type].defaults.lift : n(g.lift))), color: COLORS[g.color] ? g.color : 'white', required: g.required !== false && !GATE_TYPES[g.type].prop, bidir: !!g.bidir })) };
  }
  // the physics world for a track: the room (or the playground) plus every gate's pipes as obstacles
  function buildTrackWorld(track, playground) {
    const E = ENVIRONMENTS[track.env];
    const base = E && E.build ? E.build() : playground;
    const objs = base.objs.slice(), prims = base.prims.slice(), geoms = [];
    for (const g of track.gates) {
      const G = gateGeom(g); geoms.push(G);
      const o = { id: objs.length, name: (GATE_TYPES[g.type] || {}).label || 'Gate', kind: 'gate', gateId: g.id, prims: gatePrims(G), vis: [] };
      for (const pr of o.prims) { pr.owner = o.id; prims.push(pr); } objs.push(o);
    }
    const L = track.launch;
    return { ...base, objs, prims, geoms, spawn: { pos: v3(L.pos[0], L.pos[1], L.pos[2]), yaw: (L.yaw || 0) * D2R }, env: track.env };
  }
  const required = track => track.gates.map((g, i) => i).filter(i => track.gates[i].required && !isProp(track.gates[i]));
  // problems a track has before it can be raced
  function validateTrack(track, world) {
    const errors = [], warnings = [], req = required(track);
    const outdoor = track.env === 'playground';
    if (req.length < (outdoor ? 1 : 2)) errors.push(outdoor ? 'Add at least one gate.' : 'A track needs at least two gates.');
    const W = world || buildTrackWorld(track, null);
    const blocked = (p, r, ignoreOwner) => p.y < r * 0.5 ? false : W.prims.some(pr => pr.owner !== ignoreOwner && S.sphereVs(pr, p, r));
    const L = track.launch, lp = v3(L.pos[0], 0.06, L.pos[2]);
    if (blocked(lp, 0.06)) errors.push('The launch pad is inside something.');
    const geoms = W.geoms || track.gates.map(gateGeom);
    track.gates.forEach((g, i) => {
      const G = geoms[i]; if (!G.opening) return;
      const rp = resetPoint(G), own = W.objs.findIndex(o => o.gateId === g.id);
      if (blocked(rp.pos, G.invisible ? 0.045 : 0.09, own)) (G.invisible ? warnings : errors).push(`Gate ${i + 1}: its reset point is ${G.invisible ? 'tight against a pipe' : 'blocked'}.`);
      if (W.size && (Math.abs(rp.pos.x) > W.size.x / 2 - 0.05 || Math.abs(rp.pos.z) > W.size.z / 2 - 0.05)) errors.push(`Gate ${i + 1}: its reset point is outside the room.`);
      const top = G.pipes.reduce((m, [a, b]) => Math.max(m, a.y, b.y), 0); if (W.size && top > W.size.h) warnings.push(`Gate ${i + 1} goes through the ceiling.`);
      if (G.opening && (G.opening.x1 - G.opening.x0) < 0.2) warnings.push(`Gate ${i + 1} is narrower than 20 cm.`);
    });
    for (let i = 0; i < track.gates.length; i++) for (let j = i + 1; j < track.gates.length; j++) {
      const a = geoms[i].centre, b = geoms[j].centre; if (!track.nextOnly && geoms[i].opening && geoms[j].opening && len(sub(a, b)) < 0.15) warnings.push(`Gates ${i + 1} and ${j + 1} are on top of each other (turn on \"only the next gate counts\" if that's intended).`);
    }
    return { ok: !errors.length, errors, warnings };
  }

  // ------------------------------------------------------------------ the race rules
  // modes: 'infinite' (Velocidrone Infinite: endless laps, best 3 consecutive clean), 'hotlap' (best single lap),
  // 'laps' (fixed number of laps from a countdown; classic 3-lap race when n = 3). Velocidrone rules: in Infinite a missed
  // gate, a wrong-way pass or a crash spoils the lap; in a fixed-lap race the next gate simply has to be passed (go back
  // for it) and crashes cost time.
  function best3(laps) {   // laps: [{ time, clean }] in order -> { total, idx (first lap index) } of the best 3 consecutive clean
    let best = null;
    for (let i = 0; i + 2 < laps.length; i++) { const w = laps.slice(i, i + 3); if (!w.every(l => l.clean)) continue; const tot = w[0].time + w[1].time + w[2].time; if (!best || tot < best.total) best = { total: tot, idx: i }; }
    return best;
  }
  class RaceSession {
    constructor(track, geoms, mode = 'infinite', opts = {}) {
      this.track = track; this.geoms = geoms; this.mode = mode; this.n = opts.laps || 3; this.req = required(track);
      this.state = mode === 'laps' && opts.countdown !== false ? 'countdown' : 'waiting'; this.cdT = opts.countdown === false ? 0 : 3;
      this.laps = []; this.lapIdx = 0; this.next = 0; this.lapT0 = null; this.valid = true; this.why = ''; this.raceT0 = null; this.finished = false;
      this.lastGate = null; this.splits = []; this.events = []; this.streak = 0; this.t = 0;
    }
    get finishIdx() { return this.track.startFinish ? this.req[0] : this.req[this.req.length - 1]; }
    // time t (s), previous and current drone positions, crashed flag -> list of events since the last call
    update(t, p0, p1, crashed) {
      const ev = []; this.t = t;
      if (this.state === 'countdown') { this.cdT -= t - (this.lastUpd ?? t); this.lastUpd = t; if (this.cdT <= 0) { this.state = 'racing'; this.raceT0 = t; this.lapT0 = t; this.next = 0; this.holeshot = true; ev.push({ type: 'go' }); } return ev; }
      this.lastUpd = t;
      if (this.finished) return ev;
      if (crashed && !this.crashedFlag) { this.crashedFlag = true; if (this.state === 'racing' && this.mode !== 'laps') this.spoil('crash', ev); }
      if (!crashed) this.crashedFlag = false;
      // gates crossed this step (two gates in the same spot, e.g. the crossover of a figure 8: only the expected one counts)
      const hits = [];
      for (let gi = 0; gi < this.geoms.length; gi++) {
        const g = this.track.gates[gi]; if (!g.required || isProp(g)) continue;
        let c = crossing(this.geoms[gi], p0, p1); if (!c) continue; if (g.bidir) c = 1; hits.push([gi, c]);
      }
      const want = this.state === 'waiting' || this.holeshot ? this.req[0] : this.req[this.next];
      // structure tracks reuse the same pipes for many checkpoints, flown from different sides: only the next one counts
      if (this.track.nextOnly) { const h = hits.filter(x => x[0] === want); hits.splice(0, hits.length, ...h); }
      else if (hits.length > 1) { const h = hits.find(x => x[0] === want); if (h) hits.splice(0, hits.length, h); }
      for (const [gi, c] of hits) this.onGate(gi, c, t, ev);
      return ev;
    }
    spoil(why, ev) { if (!this.valid) return; this.valid = false; this.why = why; ev.push({ type: 'invalid', why }); }
    onGate(gi, dir, t, ev) {
      const req = this.req, k = req.indexOf(gi); if (k < 0) return;
      if (this.state === 'waiting') {   // first pass through the start gate starts the clock
        if (k === 0 && dir > 0) { this.state = 'racing'; this.lapT0 = t; this.raceT0 = t; this.next = 1 % req.length; this.valid = true; this.lastGate = gi; ev.push({ type: 'start', gate: gi }); if (req.length === 1) this.next = 0; }
        return;
      }
      if (this.state !== 'racing') return;
      const expected = req[this.next];
      if (this.holeshot) {   // race start: the run from the pad to the start gate is part of lap 1, passing it doesn't end a lap
        if (gi === req[0] && dir > 0) { this.holeshot = false; this.lastGate = gi; this.next = 1 % req.length; ev.push({ type: 'gate', gate: gi, n: 1, of: req.length }); }
        return;
      }
      if (gi === this.lastGate && gi !== expected) return;   // wobbling back and forth through the gate you just passed
      if (dir < 0) { if (this.mode !== 'laps' && !this.track.nextOnly) this.spoil(`wrong way through gate ${gi + 1}`, ev); ev.push({ type: 'wrongway', gate: gi }); return; }
      if (gi === expected) {
        this.lastGate = gi; this.splits.push(t - this.lapT0);
        if (this.next === 0 || (this.track.startFinish === false && this.next === req.length - 1)) { this.completeLap(t, ev); return; }
        this.next = (this.next + 1) % req.length; ev.push({ type: 'gate', gate: gi, n: this.next === 0 ? req.length : this.next, of: req.length });
        return;
      }
      // a required gate out of order: in Infinite / Hot Lap that's a missed gate and the lap is spoilt (the count goes on
      // from where the pilot actually is); in a fixed-lap race it just doesn't count until the missed one is flown
      if (this.mode !== 'laps') {
        this.spoil(`missed gate ${expected + 1}`, ev); this.lastGate = gi;
        if (k === 0 && this.track.startFinish) { this.completeLap(t, ev); return; }
        this.next = (k + 1) % req.length; ev.push({ type: 'gate', gate: gi, n: k + 1, of: req.length, late: true });
      } else ev.push({ type: 'skip', gate: gi, want: expected });
    }
    completeLap(t, ev) {
      const time = t - this.lapT0, clean = this.valid;
      this.laps.push({ time, clean, why: clean ? '' : this.why, splits: this.splits.slice() }); this.splits = [];
      this.streak = clean ? this.streak + 1 : 0;
      ev.push({ type: 'lap', time, clean, n: this.laps.length, why: clean ? '' : this.why });
      this.lapT0 = t; this.valid = true; this.why = ''; this.next = this.track.startFinish ? 1 % this.req.length : 0;
      if (!this.track.startFinish) { this.state = 'waiting'; this.next = 0; }
      if (this.mode === 'hotlap' && clean) { /* keep going: best single lap */ }
      if (this.mode === 'laps' && this.laps.length >= this.n) { this.finished = true; this.state = 'done'; ev.push({ type: 'finish', total: t - this.raceT0, laps: this.laps.slice() }); }
    }
    lapTime(t) { return this.state === 'racing' && this.lapT0 != null ? t - this.lapT0 : 0; }
    get bestLap() { const c = this.laps.filter(l => l.clean); return c.length ? Math.min(...c.map(l => l.time)) : null; }
    get best3() { return best3(this.laps); }
    get rolling3() { const L = this.laps.slice(-3); return L.length === 3 && L.every(l => l.clean) ? L.reduce((a, l) => a + l.time, 0) : null; }
    get progress() { return { passed: this.state === 'racing' ? (this.next === 0 ? this.req.length : this.next) : 0, of: this.req.length }; }
    respawnPoint() { const gi = this.lastGate; return gi != null ? resetPoint(this.geoms[gi]) : null; }
    // a respawn mid-lap: Infinite/Hot Lap spoil the lap (it's a crash); the race clock keeps running in fixed-lap races
    onRespawn(ev = []) { if (this.state === 'racing' && this.mode !== 'laps') this.spoil('respawn', ev); return ev; }
  }

  // ------------------------------------------------------------------ ghosts: recorded runs to race against
  class GhostRecorder {
    constructor(hz = 30) { this.dt = 1 / hz; this.cur = []; this.t0 = 0; this.last = -1; }
    begin(t) { this.cur = []; this.t0 = t; this.last = -1; }
    sample(t, pos, q) { const u = t - this.t0; if (u - this.last < this.dt) return; this.last = u; this.cur.push([+u.toFixed(3), +pos.x.toFixed(3), +pos.y.toFixed(3), +pos.z.toFixed(3), +q.w.toFixed(4), +q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4)]); }
    take() { const c = this.cur; this.cur = []; return c; }
  }
  function ghostAt(samples, u) {   // interpolated { pos, q } at time u into a recording, or null past the end
    if (!samples || !samples.length || u < 0 || u > samples[samples.length - 1][0]) return null;
    let lo = 0, hi = samples.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (samples[m][0] <= u) lo = m; else hi = m; }
    const a = samples[lo], b = samples[hi], f = b[0] > a[0] ? (u - a[0]) / (b[0] - a[0]) : 0, L = (i) => a[i] + (b[i] - a[i]) * f;
    let qb = [b[4], b[5], b[6], b[7]]; if (a[4] * qb[0] + a[5] * qb[1] + a[6] * qb[2] + a[7] * qb[3] < 0) qb = qb.map(x => -x);
    const q = [a[4] + (qb[0] - a[4]) * f, a[5] + (qb[1] - a[5]) * f, a[6] + (qb[2] - a[6]) * f, a[7] + (qb[3] - a[7]) * f], n = Math.hypot(...q) || 1;
    return { pos: v3(L(1), L(2), L(3)), q: { w: q[0] / n, x: q[1] / n, y: q[2] / n, z: q[3] / n } };
  }
  // join consecutive lap recordings into one run (each lap's clock continues from the previous lap's end)
  function joinLaps(recs, times) { const out = []; let off = 0; recs.forEach((r, i) => { for (const s of r) out.push([+(s[0] + off).toFixed(3), ...s.slice(1)]); off += times[i]; }); return out; }

  // ------------------------------------------------------------------ sample tracks (so testers can race straight away)
  function sampleTracks() {
    const mk = (env, name, list, launch, extra = {}) => { const t = newTrack(env, name); t.id = 'sample-' + env + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); t.sample = true;
      t.gates = list.map(([type, x, y, z, yaw, more]) => newGate(type, v3(x, y, z), yaw, more || {})); if (launch) t.launch = { pos: [launch[0], 0.03, launch[1]], yaw: launch[2] || 0 }; return Object.assign(t, extra); };
    // One connected PVC structure with ten checkpoints through its openings, flown from different sides: laid out after the
    // RaceGOW 5 "Track 8" diagram (rail on legs, end gate, square box frame, tall goal-post frame, flat dive square).
    const st = newTrack('garage', 'Structure 8 (RaceGOW-style)'); st.id = 'sample-garage-structure-8'; st.sample = true; st.nextOnly = true;
    { const up = (x, z, h, y = 0) => newGate('pipe', v3(x * U, y * U, z * U), 0, { h }), bar = (x, y, z, w, yaw = 0) => newGate('bar', v3(x * U, y * U, z * U), yaw, { w });
      const cp = (x, y, z, w, h, yaw, pitch = 0, more = {}) => { const g = newGate('invisible', v3(x * U, y * U, z * U), yaw, { w, h, lift: 0, ...more }); g.rot[1] = pitch; return g; };
      st.gates = [
        // the structure (x along the rail, z across; heights in sections)
        up(-2, 0, 2), up(-2, 1, 1), bar(-2, 1, 0.5, 1, 90),                       // end gate: tall post, short post, bar between
        bar(0, 1, 0, 4),                                                           // the long rail, one section up
        up(0, 0, 1), up(0.5, -1, 1), bar(0.5, 1, -0.5, 1, 90), up(0.5, 0, 1.5, 1),  // mid leg, branch back with its own leg, pole up from the rail
        bar(2.5, 1, 0, 1), bar(2.5, 1, -1, 1), bar(2, 1, -0.5, 1, 90), bar(3, 1, -0.5, 1, 90),   // the square box frame
        up(2, 0, 1), up(3, 0, 1), up(2, -1, 3), up(3, -1, 4), bar(2.5, 3, -1, 1),  // legs, the goal-post frame with one tall post
        // the lap: ten checkpoints through the openings
        cp(-2, 0, 0.5, 1, 1, 270),                        // 1 through the end gate
        cp(2.5, 3, -1, 1, 1, 0),                          // 2 over the goal-post bar, between the posts
        cp(2.5, 1, -1, 1, 2, 180),                        // 3 back through the goal-post frame
        cp(-0.5, 0, 0, 3, 1, 0),                          // 4 under the rail
        cp(-1, 1, 0, 2, 1.25, 180),                       // 5 back over the rail
        cp(3, 0, -0.5, 1, 1, 270),                        // 6 under the box, out the end
        cp(2.5, 1, -0.5, 1, 1, 0, -90, { lift: -0.5 }),   // 7 dive down through the box
        cp(2.5, 0, 0, 1, 1, 180),                         // 8 out under the box toward the rail side
        cp(1.25, 1, 0, 1.5, 1.5, 0),                      // 9 over the rail by the pole
        cp(0.5, 0, -0.5, 1, 1, 90),                       // 10 under the branch, heading back to the end gate
      ];
      st.gates.slice(-10).forEach((g, i) => { g.color = 'green'; });
      st.launch = { pos: [-2.6, 0.03, 0.3], yaw: 270 }; }
    return [st,
      mk('livingroom', 'Couch Circuit', [
        ['start', 0, 0, 1.2, 0], ['gate', -1.8, 0, 0.6, 50], ['arch', -2.6, 0, -0.6, 90], ['hurdle', -1.2, 0, -1.0, 180, { w: 1.5 }],
        ['tall', 0.6, 0, -1.4, 200], ['gate', 2.4, 0, -0.9, 250], ['ladder', 2.6, 0, 0.6, 290], ['flag', 1.4, 0, 1.8, 330]], [0, 2.3, 0]),
      mk('garage', 'Garage Loop', [
        ['start', 0, 0, 2.2, 0], ['gate', -2.2, 0, 1.6, 0, { color: 'orange' }], ['wide', -3.2, 0, -0.6, 0], ['arch', -1.6, 0, -2.4, 0],
        ['hurdle', 0.4, 0, -1.2, 0, { w: 1.5 }], ['tall', 2.2, 0, -2.4, 0, { color: 'blue' }], ['gate', 3.4, 0, -0.2, 0, { color: 'orange' }], ['cube', 2.4, 0, 2.0, 0]], [0, 3.1, 0]),
      mk('warehouse', 'Warehouse Sprint', [
        ['start', 0, 0, 5, 0], ['big', -5, 0, 1, 40], ['ladder', -8, 0, -3, 90, { color: 'yellow' }], ['tall', -3, 0, -5.5, 160], ['big', 3, 0, -5.5, 200, { color: 'blue' }],
        ['arch', 8, 0, -2.5, 250], ['hurdle', 8.5, 0, 2.5, 300, { w: 3 }], ['flag', 4, 0, 5.5, 340, { color: 'red' }]], [0, 6.8, 0]),
    ].map(t => { if (t.nextOnly) return t;   // the sample layouts are hand-placed: tidy the order so each gate faces the next
      t.gates.forEach((g, i) => { const n = t.gates[(i + 1) % t.gates.length], p = t.gates[(i - 1 + t.gates.length) % t.gates.length];
        if (g.rot[0] === 0 && i === 0) return; const dx = n.pos[0] - p.pos[0], dz = n.pos[2] - p.pos[2]; if (g.autoFace !== false) g.rot[0] = Math.round(Math.atan2(-dx, -dz) / D2R); });
      const g0 = t.gates[0], g1 = t.gates[1]; g0.rot[0] = Math.round(Math.atan2(-(g1.pos[0] - g0.pos[0]), -(g1.pos[2] - g0.pos[2])) / D2R);
      t.launch.yaw = g0.rot[0]; const G0 = gateGeom(g0); const lp = sub(G0.centre, mul(G0.fwd, 1.0)); t.launch.pos = [+lp.x.toFixed(2), 0.03, +lp.z.toFixed(2)];
      return t; });
  }

  root.Race = { U, PIPE_R, COLORS, GATE_TYPES, ENVIRONMENTS, newGate, newTrack, cleanTrack, gateGeom, crossing, insideOpening, local, resetPoint, gatePrims,
    buildTrackWorld, validateTrack, trackJoints, snapDelta, RaceSession, best3, GhostRecorder, ghostAt, joinLaps, sampleTracks, rotM, mv, mtv, isProp, required };
})(typeof window !== 'undefined' ? window : globalThis);
