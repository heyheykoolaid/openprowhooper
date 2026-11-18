// RaceGOW: indoor tiny-whoop racing. Pure JS (Node for tests, the browser after sim.js): the track format, the building
// blocks, the rooms, the race rules (gates in order, laps, sectors, deltas), ghosts, and the "Make raceable" checks.
// No trick scoring anywhere here. The editor and the race HUD are src/raceedit.js (the game module).
//
// Frames: x right, y up, z back. An element with yaw 0 is flown through toward -z (the way a quad with yaw 0 points).
// Angles in a track are degrees; lengths metres. Two rule presets: 'indoor' (IGOW-style: any gates, furniture, rooms)
// and 'racegow' (white PVC in one section size per track, 24 in minimum; the openings of the structure are the gates).
(function (root) {
  const S = root.Sim; const { v3, add, sub, mul, dot, cross, len, norm } = S;
  const D2R = Math.PI / 180, U = 0.6096, PIPE_R = 0.0134;   // one 24" PVC section; 3/4" schedule-40 pipe
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), num = (x, d = 0) => (typeof x === 'number' && isFinite(x) ? x : d);

  // ------------------------------------------------------------------ surfaces: how a whoop meets each thing
  // e restitution (the duct bounce), f friction, crash = the impact (m/s) that counts as a crash (drone default if absent)
  const SURF = {
    soft: { e: 0.4, f: 0.35 },                     // soft gate: duct bounce, a little slowdown, you fly on
    hard: { e: 0.08, f: 0.9, crash: 2.6 },         // hard gate: full stop and, if you hit it properly, the quad is out
    foam: { e: 0.04, f: 0.95, crash: 99 },         // extra soft: it soaks the hit, never a crash
    drywall: { e: 0.25, f: 0.5 }, wood: { e: 0.28, f: 0.45 }, concrete: { e: 0.2, f: 0.55, crash: 6.5 }, glass: { e: 0.3, f: 0.2, crash: 5.5 },
    carpet: { e: 0.05, f: 1.1 }, hardwood: { e: 0.2, f: 0.35 }, tile: { e: 0.25, f: 0.22 }, mat: { e: 0.05, f: 0.9, crash: 99 },
  };
  const PRESETS = {
    indoor: { label: 'Indoor (IGOW style)', desc: 'Any gates, furniture, rooms and special elements', gateMin: 0.25, gateMax: 1.6, speed: 4.2 },
    racegow: { label: 'RaceGOW (PVC)', desc: 'One connected white-PVC structure, one section size (24 in minimum); its openings are the gates', gateMin: U, gateMax: 4 * U, speed: 3.8 },
  };
  const LED = ['off', 'static', 'rainbow', 'chase', 'finish'], COLORS = ['white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
  const LAYERS = ['floor', 'walls', 'gates', 'flags', 'obstacles', 'lighting', 'triggers', 'guides'];

  // ------------------------------------------------------------------ maths: pose of an element
  function rotM(ry, rx, rz) {   // R = Ry * Rx * Rz (three.js 'YXZ'), degrees
    const cy = Math.cos(ry * D2R), sy = Math.sin(ry * D2R), cx = Math.cos(rx * D2R), sx = Math.sin(rx * D2R), cz = Math.cos(rz * D2R), sz = Math.sin(rz * D2R);
    return [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
  }
  const mv = (m, p) => v3(m[0] * p.x + m[1] * p.y + m[2] * p.z, m[3] * p.x + m[4] * p.y + m[5] * p.z, m[6] * p.x + m[7] * p.y + m[8] * p.z);
  function poseOf(e) { const m = rotM(num(e.ry), num(e.rx), num(e.rz)), s = num(e.s, 1) || 1, o = v3(num(e.x), num(e.y), num(e.z));
    return { m, s, o, W: p => add(o, mv(m, mul(p, s))), D: p => mv(m, p), euler: [num(e.rx) * D2R, num(e.ry) * D2R, num(e.rz) * D2R] }; }

  // ------------------------------------------------------------------ the parts an element builds (local frame)
  // A builder gets a little kit that writes world-space colliders and looks for the element:
  //   bar(a, b, r, mat) capsule; box(c, h, mat) a box turned with the element; gate(opening) a checkpoint; field(...)
  function kitFor(e, surf, out) {
    const P = poseOf(e), lift = v => P.W(v);
    const tag = (pr, extra) => { pr.surf = surf; pr.eid = e.id; Object.assign(pr, extra || {}); return pr; };
    return {
      P,
      bar(a, b, r, mat, opt = {}) { const A = lift(a), B = lift(b), R = r * P.s; if (!opt.noCollide) out.prims.push(tag(S.makeCapsule(A, B, R))); out.vis.push({ shape: 'pipe', a: A, b: B, r: R, mat, eid: e.id, glow: !!opt.glow, layer: e.layer }); },
      box(c, h, mat, opt = {}) { const C = lift(c), H = v3(h.x * P.s, h.y * P.s, h.z * P.s), eu = P.euler, b = S.makeBox(C, H, eu[1], eu[0], eu[2]);
        if (!opt.noCollide) out.prims.push(tag(b, opt.surf ? { surf: opt.surf } : null)); out.vis.push({ shape: 'box', c: C, h: H, mat, euler: eu, eid: e.id, glow: !!opt.glow, alpha: !!opt.alpha, layer: e.layer }); return b; },
      ball(c, r, mat, opt = {}) { const C = lift(c), R = r * P.s; if (!opt.noCollide) out.prims.push(tag(S.makeSphere(C, R))); out.vis.push({ shape: 'sphere', c: C, r: R, mat, eid: e.id, glow: !!opt.glow, layer: e.layer }); },
      // a checkpoint: an opening on the element's z = 0 plane. poly: [[x, y]...] (convex, local metres) or circle { cx, cy, r }
      gate(op) { out.gates.push({ eid: e.id, o: P.o, right: P.D(v3(1, 0, 0)), up: P.D(v3(0, 1, 0)), fwd: P.D(v3(0, 0, -1)), s: P.s, ...op }); },
      field(f) { out.fields.push({ eid: e.id, ...f, o: lift(f.c || v3()), m: P.m, h: v3(f.h.x * P.s, f.h.y * P.s, f.h.z * P.s), dir: f.dir ? norm(P.D(f.dir)) : null }); },
      light(c, color, power, range) { out.lights.push({ eid: e.id, at: lift(c), color, power, range }); },
      label(c, text, color) { out.vis.push({ shape: 'label', at: lift(c), text: String(text).slice(0, 12), color, eid: e.id, layer: e.layer }); },
    };
  }
  // regular polygon (n sides) of inner width w, centred at (0, cy); first vertex up for triangles/hexagons, a corner for diamonds
  const ngon = (n, w, cy, rot) => { const R = w / 2 / Math.cos(Math.PI / n); return Array.from({ length: n }, (_, i) => { const a = rot + i * 2 * Math.PI / n; return [Math.sin(a) * R, cy + Math.cos(a) * R]; }); };
  const ledMat = (p, k = 0) => p.led === 'off' ? null : p.led === 'rainbow' ? 'rgLedRainbow' : p.led === 'chase' ? 'rgLedChase' + (k % 4) : p.led === 'finish' ? 'rgLedFinish' : 'rgLed_' + (p.ledColor || 'cyan');
  // a gate frame along a closed outline (local), with LED strips on its face, legs to the floor if it is lifted
  function frameAlong(k, pts, p, frameMat) {
    const t = p.thick / 2;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      const A = v3(a[0] - nx * t, a[1] - ny * t, 0), B = v3(b[0] - nx * t, b[1] - ny * t, 0);   // frame bar just outside the opening
      k.bar(A, B, t, frameMat);
      const m = ledMat(p, i); if (m) k.bar(v3(A.x, A.y, -t - 0.002), v3(B.x, B.y, -t - 0.002), Math.min(0.008, t * 0.5), m, { noCollide: true, glow: true }); }
    if (p.lift > 0.02) { const ys = pts.map(q => q[1]), y0 = Math.min(...ys), xs = pts.filter(q => q[1] < y0 + 0.05).map(q => q[0]), xa = Math.min(...xs), xb = Math.max(...xs);
      for (const x of (xb - xa > 0.1 ? [xa, xb] : [xa])) { k.bar(v3(x, 0, 0), v3(x, y0 - t, 0), t * 0.8, frameMat); k.bar(v3(x, 0.01, -0.18), v3(x, 0.01, 0.18), t * 0.8, frameMat); } }
  }

  // ------------------------------------------------------------------ the building blocks
  // params: { key: [default, min, max, step, label, unit] } or { key: { v: default, opts: [...], label } }
  const sizePresets = { micro: 0.3, whoop: 0.4, large: 0.8 };
  const G = (label, desc, shape, extra = {}) => ({ cat: 'Gates', layer: 'gates', gate: true, label, desc,
    params: { size: [0.4, 0.2, 2.4, 0.01, 'Opening', 'm'], ...(shape === 'square' ? { aspect: [1, 0.4, 3, 0.05, 'Height / width', ''] } : {}), lift: [0.35, 0, 2.5, 0.01, 'Off the floor', 'm'], thick: [0.03, 0.01, 0.12, 0.005, 'Frame', 'm'],
      collide: { v: 'soft', opts: ['soft', 'hard'], label: 'Collision' }, led: { v: 'static', opts: LED, label: 'LEDs' }, ledColor: { v: 'cyan', opts: COLORS, label: 'LED colour' }, color: { v: 'black', opts: ['black', 'white', 'grey', ...COLORS], label: 'Frame colour' }, ...extra },
    build(e, k, p) { const w = p.size, cy = p.lift + (shape === 'square' ? w * p.aspect : w) / 2, fm = 'rgFrame_' + p.color;
      if (shape === 'circle') { const n = 20, R = w / 2 + p.thick / 2, pts = []; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; pts.push([Math.sin(a) * R, cy + Math.cos(a) * R]); }
        frameAlong(k, pts.map(([x, y]) => [x * (w / 2) / R, cy + (y - cy) * (w / 2) / R]), p, fm); k.gate({ circle: { cx: 0, cy, r: w / 2 } }); return; }
      const pts = shape === 'square' ? [[-w / 2, p.lift], [-w / 2, p.lift + w * p.aspect], [w / 2, p.lift + w * p.aspect], [w / 2, p.lift]]
        : shape === 'triangle' ? ngon(3, w, cy, Math.PI).reverse() : shape === 'diamond' ? ngon(4, w * Math.SQRT2, cy, 0) : ngon(6, w, cy, Math.PI / 6);
      frameAlong(k, pts, p, fm); k.gate({ poly: pts }); } });
  const FURN = (label, desc, params, build) => ({ cat: 'Obstacles', layer: 'obstacles', solid: true, label, desc, params: { ...params, destructible: { v: 'no', opts: ['no', 'yes'], label: 'Destructible' } }, build });
  const CATALOG = {
    // gates
    gateSquare: G('Square gate', 'The standard whoop gate (40 x 40 cm)', 'square'),
    gateCircle: G('Round gate', 'A hoop on a stand', 'circle'),
    gateTriangle: G('Triangle gate', 'Point up', 'triangle'),
    gateDiamond: G('Diamond gate', 'A square on its corner', 'diamond'),
    gateHex: G('Hex gate', 'Six sides', 'hex'),
    split: { cat: 'Gates', layer: 'gates', gate: true, label: 'Split gate', desc: 'Two openings side by side: choose your line, either counts',
      params: { size: [0.4, 0.2, 1.6, 0.01, 'Opening', 'm'], gap: [0.5, 0.1, 3, 0.05, 'Between them', 'm'], lift: [0.35, 0, 2, 0.01, 'Off the floor', 'm'], thick: [0.03, 0.01, 0.1, 0.005, 'Frame', 'm'],
        collide: { v: 'soft', opts: ['soft', 'hard'], label: 'Collision' }, led: { v: 'static', opts: LED, label: 'LEDs' }, ledColor: { v: 'yellow', opts: COLORS, label: 'LED colour' }, color: { v: 'black', opts: ['black', 'white', 'grey', ...COLORS], label: 'Frame colour' } },
      build(e, k, p) { const w = p.size, d = (w + p.gap) / 2, polys = [];
        for (const s of [-1, 1]) { const pts = [[s * d - w / 2, p.lift], [s * d - w / 2, p.lift + w], [s * d + w / 2, p.lift + w], [s * d + w / 2, p.lift]]; frameAlong(k, pts, p, 'rgFrame_' + p.color); polys.push(pts); }
        k.gate({ polys }); } },
    checkpoint: { cat: 'Gates', layer: 'gates', gate: true, label: 'Checkpoint', desc: 'An invisible rectangle to fly through (put one in any opening: a door, under a table)',
      params: { w: [0.8, 0.1, 8, 0.05, 'Width', 'm'], h: [0.8, 0.1, 8, 0.05, 'Height', 'm'], lift: [0, 0, 5, 0.01, 'Off the floor', 'm'] },
      build(e, k, p) { k.gate({ poly: [[-p.w / 2, p.lift], [-p.w / 2, p.lift + p.h], [p.w / 2, p.lift + p.h], [p.w / 2, p.lift]], invisible: true }); } },
    start: { cat: 'Gates', layer: 'gates', gate: true, start: true, label: 'Start / Finish', desc: 'The gantry: chequered banner and timing beams. Laps start and end here',
      params: { w: [1.2, 0.4, 4, 0.05, 'Width', 'm'], h: [0.9, 0.3, 3, 0.05, 'Height', 'm'], lift: [0, 0, 1.5, 0.01, 'Off the floor', 'm'] },
      build(e, k, p) { const x = p.w / 2 + 0.03, top = p.lift + p.h;
        for (const s of [-1, 1]) { k.bar(v3(s * x, 0, 0), v3(s * x, top + 0.25, 0), 0.03, 'rgFrame_grey'); k.bar(v3(s * x, 0.01, -0.25), v3(s * x, 0.01, 0.25), 0.03, 'rgFrame_grey');
          k.bar(v3(s * (x - 0.03), p.lift + 0.05, -0.04), v3(s * (x - 0.03), top - 0.05, -0.04), 0.008, 'rgBeam', { noCollide: true, glow: true }); }   // timing beams
        k.box(v3(0, top + 0.13, 0), v3(x + 0.03, 0.12, 0.012), 'rgChecker'); if (p.lift > 0.02) k.bar(v3(-x, p.lift, 0), v3(x, p.lift, 0), 0.02, 'rgFrame_grey');
        k.gate({ poly: [[-p.w / 2, p.lift], [-p.w / 2, top], [p.w / 2, top], [p.w / 2, p.lift]], start: true }); } },
    finish: { cat: 'Gates', layer: 'gates', gate: true, finish: true, label: 'Finish (point to point)', desc: 'A separate finish: the track becomes point to point',
      params: { w: [1.2, 0.4, 4, 0.05, 'Width', 'm'], h: [0.9, 0.3, 3, 0.05, 'Height', 'm'], lift: [0, 0, 1.5, 0.01, 'Off the floor', 'm'] },
      build(e, k, p) { const x = p.w / 2 + 0.03, top = p.lift + p.h; for (const s of [-1, 1]) k.bar(v3(s * x, 0, 0), v3(s * x, top + 0.25, 0), 0.03, 'rgFrame_grey');
        k.box(v3(0, top + 0.13, 0), v3(x + 0.03, 0.12, 0.012), 'rgChecker'); k.gate({ poly: [[-p.w / 2, p.lift], [-p.w / 2, top], [p.w / 2, top], [p.w / 2, p.lift]], finish: true }); } },
    // RaceGOW PVC (sizes in sections; the track's section size scales them)
    pvcGate: { cat: 'RaceGOW PVC', layer: 'gates', gate: true, pvc: true, label: 'PVC gate', desc: 'Square PVC gate on T-feet',
      params: { w: [1, 0.5, 4, 0.5, 'Width', 'sections'], h: [1, 0.5, 4, 0.5, 'Height', 'sections'], lift: [0.5, 0, 3, 0.25, 'Lift', 'sections'], color: { v: 'white', opts: ['white', 'orange', 'blue', 'yellow', 'green', 'red', 'black', 'pink'], label: 'Pipe colour' } },
      build(e, k, p, ctx) { const u = ctx.section, w = p.w * u, h = p.h * u, l = p.lift * u, x = w / 2, top = l + h, m = 'rgPvc_' + p.color, r = PIPE_R;
        for (const s of [-1, 1]) { k.bar(v3(s * x, 0, 0), v3(s * x, top, 0), r, m); k.bar(v3(s * x, 0, -u / 2), v3(s * x, 0, u / 2), r, m); }
        k.bar(v3(-x, top, 0), v3(x, top, 0), r, m); if (l > 0.05) k.bar(v3(-x, l, 0), v3(x, l, 0), r, m);
        for (const q of [[-x, top], [x, top], [-x, l], [x, l], [-x, 0], [x, 0]]) k.ball(v3(q[0], q[1], 0), r * 1.45, 'rgPvcJoint', { noCollide: true });
        k.gate({ poly: [[-x, l], [-x, top], [x, top], [x, l]] }); } },
    pvcHurdle: { cat: 'RaceGOW PVC', layer: 'gates', gate: true, pvc: true, label: 'PVC hurdle', desc: 'A low bar: fly over it',
      params: { w: [2, 1, 4, 0.5, 'Width', 'sections'], h: [0.5, 0.25, 2, 0.25, 'Bar height', 'sections'], color: { v: 'white', opts: ['white', 'orange', 'blue', 'yellow', 'green', 'red'], label: 'Pipe colour' } },
      build(e, k, p, ctx) { const u = ctx.section, x = p.w * u / 2, h = p.h * u, m = 'rgPvc_' + p.color;
        for (const s of [-1, 1]) { k.bar(v3(s * x, 0, 0), v3(s * x, h, 0), PIPE_R, m); k.bar(v3(s * x, 0, -u / 2), v3(s * x, 0, u / 2), PIPE_R, m); } k.bar(v3(-x, h, 0), v3(x, h, 0), PIPE_R, m);
        k.gate({ poly: [[-x, h + 0.02], [-x, h + 1.2 * u], [x, h + 1.2 * u], [x, h + 0.02]], invisible: true }); } },
    pvcPipe: { cat: 'RaceGOW PVC', layer: 'gates', pvc: true, solid: true, label: 'PVC pipe', desc: 'One straight piece for building the structure; turn it any way (the ends join)',
      params: { len: [1, 0.25, 4, 0.25, 'Length', 'sections'], color: { v: 'white', opts: ['white', 'orange', 'blue', 'yellow', 'green', 'red', 'black'], label: 'Pipe colour' } },
      build(e, k, p, ctx) { const L = p.len * ctx.section; k.bar(v3(0, 0, 0), v3(0, L, 0), PIPE_R, 'rgPvc_' + p.color); k.ball(v3(0, 0, 0), PIPE_R * 1.45, 'rgPvcJoint', { noCollide: true }); k.ball(v3(0, L, 0), PIPE_R * 1.45, 'rgPvcJoint', { noCollide: true }); } },
    // flags and markers (light, so a whoop can brush them)
    flag: { cat: 'Flags', layer: 'flags', label: 'Flag', desc: 'Single or double flag on a pole', params: { h: [1.6, 0.5, 3, 0.05, 'Height', 'm'], style: { v: 'single', opts: ['single', 'double'], label: 'Style' }, color: { v: 'red', opts: COLORS, label: 'Colour' }, autoFace: { v: 'yes', opts: ['yes', 'no'], label: 'Face the next gate' } },
      build(e, k, p) { k.bar(v3(0, 0, 0), v3(0, p.h, 0), 0.008, 'rgFrame_grey', {}); for (const s of p.style === 'double' ? [-1, 1] : [1]) k.box(v3(s * 0.2, p.h - 0.28, 0), v3(0.2, 0.25, 0.004), 'rgFlag_' + p.color, { noCollide: true }); } },
    arrow: { cat: 'Flags', layer: 'flags', label: 'Arrow / chevron', desc: 'Points the way', params: { h: [1, 0.1, 3, 0.05, 'Height', 'm'], style: { v: 'arrow', opts: ['arrow', 'chevron'], label: 'Style' }, color: { v: 'yellow', opts: COLORS, label: 'Colour' }, autoFace: { v: 'yes', opts: ['yes', 'no'], label: 'Face the next gate' } },
      build(e, k, p) { k.bar(v3(0, 0, 0), v3(0, p.h - 0.15, 0), 0.008, 'rgFrame_grey'); const m = 'rgFlag_' + p.color;
        if (p.style === 'chevron') for (const dx of [-0.12, 0.12]) { k.box(v3(dx - 0.05, p.h, 0.06), v3(0.012, 0.012, 0.09), m, { noCollide: true }); }
        k.box(v3(0, p.h, 0.05), v3(0.025, 0.025, 0.14), m, { noCollide: true, glow: true }); k.box(v3(0, p.h, -0.12), v3(0.07, 0.025, 0.04), m, { noCollide: true, glow: true }); } },
    plaque: { cat: 'Flags', layer: 'flags', label: 'Number plaque', desc: 'A gate number on a stand', params: { n: [1, 1, 99, 1, 'Number', ''], h: [0.6, 0.1, 2.5, 0.05, 'Height', 'm'], color: { v: 'white', opts: COLORS, label: 'Colour' } },
      build(e, k, p) { k.bar(v3(0, 0, 0), v3(0, p.h, 0), 0.008, 'rgFrame_grey'); k.box(v3(0, p.h + 0.09, 0), v3(0.1, 0.09, 0.004), 'rgFrame_black', { noCollide: true }); k.label(v3(0, p.h + 0.09, -0.006), String(Math.round(p.n)), p.color); } },
    // furniture (parametric)
    table: FURN('Table', 'Four legs and a top: under it, over it', { w: [1.2, 0.4, 3, 0.05, 'Width', 'm'], d: [0.7, 0.3, 2, 0.05, 'Depth', 'm'], h: [0.75, 0.3, 1.2, 0.01, 'Height', 'm'], leg: [0.04, 0.02, 0.12, 0.005, 'Legs', 'm'] },
      (e, k, p) => { k.box(v3(0, p.h - 0.02, 0), v3(p.w / 2, 0.02, p.d / 2), 'rgWood'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(v3(sx * (p.w / 2 - p.leg), (p.h - 0.04) / 2, sz * (p.d / 2 - p.leg)), v3(p.leg / 2, (p.h - 0.04) / 2, p.leg / 2), 'rgWood'); }),
    chair: FURN('Chair', 'Seat, back and legs', { w: [0.45, 0.3, 0.8, 0.01, 'Width', 'm'], seat: [0.45, 0.3, 0.7, 0.01, 'Seat height', 'm'], h: [0.9, 0.6, 1.3, 0.01, 'Back height', 'm'] },
      (e, k, p) => { const w = p.w / 2; k.box(v3(0, p.seat, 0), v3(w, 0.02, w), 'rgWood'); k.box(v3(0, (p.seat + p.h) / 2, w - 0.02), v3(w, (p.h - p.seat) / 2, 0.02), 'rgWood'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(v3(sx * (w - 0.02), p.seat / 2, sz * (w - 0.02)), v3(0.015, p.seat / 2, 0.015), 'rgWood'); }),
    sofa: FURN('Sofa', 'Seat, back and arms', { w: [2, 1, 3.5, 0.05, 'Width', 'm'], d: [0.9, 0.6, 1.4, 0.05, 'Depth', 'm'], h: [0.85, 0.6, 1.2, 0.01, 'Back height', 'm'] },
      (e, k, p) => { const w = p.w / 2, d = p.d / 2; k.box(v3(0, 0.22, 0), v3(w, 0.22, d), 'rgFabric'); k.box(v3(0, p.h / 2, d - 0.1), v3(w, p.h / 2, 0.1), 'rgFabric'); for (const s of [-1, 1]) k.box(v3(s * (w - 0.1), 0.32, 0), v3(0.1, 0.32, d), 'rgFabric'); }),
    bookshelf: FURN('Bookshelf', 'Shelves to fly past (or through, if they are open)', { w: [0.9, 0.4, 2.5, 0.05, 'Width', 'm'], d: [0.3, 0.2, 0.6, 0.01, 'Depth', 'm'], h: [1.8, 0.6, 2.6, 0.05, 'Height', 'm'], shelves: [5, 2, 8, 1, 'Shelves', ''] },
      (e, k, p) => { const w = p.w / 2, d = p.d / 2; for (const s of [-1, 1]) k.box(v3(s * (w - 0.01), p.h / 2, 0), v3(0.01, p.h / 2, d), 'rgWood'); k.box(v3(0, p.h / 2, d - 0.005), v3(w, p.h / 2, 0.005), 'rgWood');
        for (let i = 0; i <= p.shelves; i++) k.box(v3(0, 0.01 + i * (p.h - 0.02) / p.shelves, 0), v3(w, 0.01, d), 'rgWood'); }),
    lampPost: FURN('Lamp post', 'A floor lamp: a thin pole to turn round', { h: [1.6, 0.8, 3, 0.05, 'Height', 'm'], r: [0.02, 0.01, 0.08, 0.005, 'Pole', 'm'] },
      (e, k, p) => { k.box(v3(0, 0.015, 0), v3(0.16, 0.015, 0.16), 'rgFrame_black'); k.bar(v3(0, 0, 0), v3(0, p.h, 0), p.r, 'rgFrame_grey'); k.ball(v3(0, p.h + 0.08, 0), 0.14, 'rgLampShade', { glow: true }); k.light(v3(0, p.h + 0.08, 0), 0xffe2b0, 6, 6); }),
    hangingPlant: FURN('Hanging plant', 'Hangs from the ceiling (or a beam) on a cord', { drop: [0.8, 0.1, 2.5, 0.05, 'Cord', 'm'], size: [0.3, 0.15, 0.6, 0.01, 'Pot', 'm'] },
      (e, k, p) => { k.bar(v3(0, 0, 0), v3(0, -p.drop, 0), 0.004, 'rgFrame_grey', { noCollide: true }); k.box(v3(0, -p.drop - p.size / 2, 0), v3(p.size / 2, p.size / 2, p.size / 2), 'rgPot'); k.ball(v3(0, -p.drop + 0.05, 0), p.size * 0.7, 'rgLeaves'); }),
    ceilingBeam: FURN('Ceiling beam', 'Hangs from the ceiling: duck under it', { len: [3, 0.5, 12, 0.1, 'Length', 'm'], size: [0.2, 0.08, 0.5, 0.01, 'Depth', 'm'] },
      (e, k, p) => { k.box(v3(0, -p.size / 2, 0), v3(p.len / 2, p.size / 2, 0.1), 'rgWood'); }),
    doorFrame: FURN('Door frame', 'A doorway: turn it into a gate with a checkpoint inside', { w: [0.9, 0.5, 2, 0.05, 'Width', 'm'], h: [2.05, 1, 2.6, 0.05, 'Height', 'm'], t: [0.12, 0.05, 0.3, 0.01, 'Wall', 'm'] },
      (e, k, p) => { const x = p.w / 2 + 0.05; for (const s of [-1, 1]) k.box(v3(s * x, p.h / 2, 0), v3(0.05, p.h / 2, p.t / 2), 'rgWood'); k.box(v3(0, p.h + 0.05, 0), v3(x + 0.05, 0.05, p.t / 2), 'rgWood'); }),
    windowSill: FURN('Window sill', 'A ledge on a wall', { w: [1.2, 0.4, 3, 0.05, 'Width', 'm'], h: [0.9, 0.3, 1.6, 0.01, 'Height', 'm'], depth: [0.25, 0.1, 0.5, 0.01, 'Depth', 'm'] },
      (e, k, p) => { k.box(v3(0, p.h, 0), v3(p.w / 2, 0.025, p.depth / 2), 'rgWhite'); }),
    // walls and boundaries
    wall: { cat: 'Walls', layer: 'walls', solid: true, label: 'Wall', desc: 'A straight wall', params: { len: [3, 0.3, 20, 0.1, 'Length', 'm'], h: [2.4, 0.3, 6, 0.05, 'Height', 'm'], t: [0.1, 0.03, 0.4, 0.01, 'Thickness', 'm'], mat: { v: 'drywall', opts: ['drywall', 'wood', 'glass', 'foam', 'concrete'], label: 'Material' } },
      surf: p => p.mat, build(e, k, p) { k.box(v3(0, p.h / 2, 0), v3(p.len / 2, p.h / 2, p.t / 2), 'rgWall_' + p.mat, { alpha: p.mat === 'glass' }); } },
    halfWall: { cat: 'Walls', layer: 'walls', solid: true, label: 'Half wall', desc: 'Low wall: over it or round it', params: { len: [2, 0.3, 12, 0.1, 'Length', 'm'], h: [1, 0.2, 1.6, 0.05, 'Height', 'm'], t: [0.1, 0.03, 0.4, 0.01, 'Thickness', 'm'], mat: { v: 'wood', opts: ['drywall', 'wood', 'glass', 'foam', 'concrete'], label: 'Material' } },
      surf: p => p.mat, build(e, k, p) { k.box(v3(0, p.h / 2, 0), v3(p.len / 2, p.h / 2, p.t / 2), 'rgWall_' + p.mat, { alpha: p.mat === 'glass' }); } },
    arch: { cat: 'Walls', layer: 'walls', solid: true, label: 'Arch', desc: 'A wall with an opening (counts as a gate if you want)', params: { len: [3, 1, 12, 0.1, 'Wall length', 'm'], h: [2.4, 1, 5, 0.05, 'Wall height', 'm'], ow: [1, 0.3, 4, 0.05, 'Opening width', 'm'], oh: [1.4, 0.3, 4, 0.05, 'Opening height', 'm'], t: [0.12, 0.04, 0.4, 0.01, 'Thickness', 'm'], mat: { v: 'drywall', opts: ['drywall', 'wood', 'foam', 'concrete'], label: 'Material' }, asGate: { v: 'yes', opts: ['yes', 'no'], label: 'Opening is a gate' } },
      surf: p => p.mat, build(e, k, p) { const m = 'rgWall_' + p.mat, x0 = p.ow / 2, side = (p.len - p.ow) / 2;
        for (const s of [-1, 1]) if (side > 0.01) k.box(v3(s * (x0 + side / 2), p.h / 2, 0), v3(side / 2, p.h / 2, p.t / 2), m); if (p.h - p.oh > 0.01) k.box(v3(0, (p.h + p.oh) / 2, 0), v3(x0, (p.h - p.oh) / 2, p.t / 2), m);
        if (p.asGate === 'yes') k.gate({ poly: [[-x0, 0.02], [-x0, p.oh], [x0, p.oh], [x0, 0.02]], invisible: true }); } },
    tunnel: { cat: 'Walls', layer: 'walls', solid: true, gateOpt: true, label: 'Tunnel', desc: 'A box tunnel to fly through', params: { len: [2, 0.4, 10, 0.1, 'Length', 'm'], w: [0.8, 0.3, 3, 0.05, 'Inside width', 'm'], h: [0.6, 0.3, 3, 0.05, 'Inside height', 'm'], mat: { v: 'wood', opts: ['drywall', 'wood', 'foam', 'concrete'], label: 'Material' }, asGate: { v: 'yes', opts: ['yes', 'no'], label: 'Entrance is a gate' } },
      surf: p => p.mat, build(e, k, p) { const m = 'rgWall_' + p.mat, t = 0.03, L = p.len / 2; k.box(v3(0, p.h + t, 0), v3(p.w / 2 + 2 * t, t, L), m); for (const s of [-1, 1]) k.box(v3(s * (p.w / 2 + t), (p.h + t) / 2, 0), v3(t, (p.h + t) / 2, L), m);
        if (p.asGate === 'yes') { k.P.o = k.P.o; k.gate({ poly: [[-p.w / 2, 0.02], [-p.w / 2, p.h], [p.w / 2, p.h], [p.w / 2, 0.02]], invisible: true, zOff: L }); } } },
    platform: { cat: 'Walls', layer: 'walls', solid: true, label: 'Platform / drop-off', desc: 'A raised deck: fly off its edge', params: { w: [2, 0.4, 10, 0.1, 'Width', 'm'], d: [1.5, 0.4, 10, 0.1, 'Depth', 'm'], h: [0.8, 0.1, 3, 0.05, 'Height', 'm'], mat: { v: 'wood', opts: ['drywall', 'wood', 'foam', 'concrete'], label: 'Material' } },
      surf: p => p.mat, build(e, k, p) { k.box(v3(0, p.h / 2, 0), v3(p.w / 2, p.h / 2, p.d / 2), 'rgWall_' + p.mat); } },
    // floors and elevation
    floor: { cat: 'Floors', layer: 'floor', solid: true, label: 'Floor patch', desc: 'Carpet (grippy), hardwood, tile (slippery) or a foam mat (soft)', params: { w: [3, 0.3, 30, 0.1, 'Width', 'm'], d: [3, 0.3, 30, 0.1, 'Depth', 'm'], type: { v: 'carpet', opts: ['carpet', 'hardwood', 'tile', 'mat'], label: 'Floor' } },
      surf: p => p.type, build(e, k, p) { k.box(v3(0, 0.003, 0), v3(p.w / 2, 0.003, p.d / 2), 'rgFloor_' + p.type); } },
    ramp: { cat: 'Floors', layer: 'floor', solid: true, label: 'Ramp', desc: 'A slope up to a height', params: { w: [1, 0.3, 6, 0.05, 'Width', 'm'], d: [2, 0.3, 8, 0.05, 'Length', 'm'], h: [0.5, 0.05, 2.5, 0.05, 'Rise', 'm'] },
      build(e, k, p) { const L = Math.hypot(p.d, p.h), a = Math.atan2(p.h, p.d); const P = k.P, c = P.W(v3(0, p.h / 2, 0)), H = v3(p.w / 2 * P.s, 0.02 * P.s, L / 2 * P.s), b = S.makeBox(c, H, P.euler[1], P.euler[0] + a, P.euler[2]);
        b.eid = e.id; k._out.prims.push(b); k._out.vis.push({ shape: 'box', c, h: H, mat: 'rgWood', euler: [P.euler[0] + a, P.euler[1], P.euler[2]], eid: e.id, layer: e.layer }); } },
    // special elements
    fan: { cat: 'Special', layer: 'triggers', label: 'Fan zone', desc: 'A draft that pushes the whoop (a box fan, an AC vent)', params: { w: [1, 0.2, 6, 0.05, 'Width', 'm'], h: [1, 0.2, 4, 0.05, 'Height', 'm'], d: [2, 0.2, 8, 0.05, 'Reach', 'm'], push: [3, 0.5, 15, 0.5, 'Push', 'm/s²'], y0: [0.2, 0, 4, 0.05, 'Off the floor', 'm'] },
      build(e, k, p) { k.field({ kind: 'push', c: v3(0, p.y0 + p.h / 2, -p.d / 2), h: v3(p.w / 2, p.h / 2, p.d / 2), dir: v3(0, 0, -1), accel: p.push }); k.box(v3(0, p.y0 + p.h / 2, 0.05), v3(Math.min(p.w, p.h) / 2.4, Math.min(p.w, p.h) / 2.4, 0.05), 'rgFrame_grey'); } },
    dark: { cat: 'Special', layer: 'triggers', label: 'Dark zone', desc: 'Lights out inside it (IR goggles optional)', params: { w: [2, 0.3, 20, 0.1, 'Width', 'm'], h: [2.4, 0.3, 8, 0.1, 'Height', 'm'], d: [2, 0.3, 20, 0.1, 'Depth', 'm'], ir: { v: 'no', opts: ['no', 'yes'], label: 'IR view inside' } },
      build(e, k, p) { k.field({ kind: 'dark', c: v3(0, p.h / 2, 0), h: v3(p.w / 2, p.h / 2, p.d / 2), ir: p.ir === 'yes' }); } },
    boost: { cat: 'Special', layer: 'triggers', label: 'Battery-saver zone', desc: 'A little extra thrust and less sag while inside', params: { w: [1.5, 0.3, 10, 0.1, 'Width', 'm'], h: [1.5, 0.3, 6, 0.1, 'Height', 'm'], d: [1.5, 0.3, 10, 0.1, 'Depth', 'm'], gain: [1.15, 1.02, 1.4, 0.01, 'Thrust', 'x'] },
      build(e, k, p) { k.field({ kind: 'boost', c: v3(0, p.h / 2, 0), h: v3(p.w / 2, p.h / 2, p.d / 2), gain: p.gain }); } },
    // lighting
    lamp: { cat: 'Lighting', layer: 'lighting', label: 'Point light', desc: 'A light (real lights cost frame rate: a few are enough)', params: { color: { v: 'warm', opts: ['warm', 'white', 'red', 'cyan', 'purple', 'pink'], label: 'Colour' }, power: [8, 1, 40, 1, 'Power', ''], range: [8, 2, 30, 1, 'Range', 'm'] },
      build(e, k, p) { const C = { warm: 0xffd9a8, white: 0xffffff, red: 0xff3344, cyan: 0x33e6ff, purple: 0x9a55ff, pink: 0xff55cc }[p.color] || 0xffffff; k.ball(v3(0, 0, 0), 0.05, 'rgLampShade', { noCollide: true, glow: true }); k.light(v3(0, 0, 0), C, p.power, p.range); } },
    neon: { cat: 'Lighting', layer: 'lighting', label: 'Neon strip', desc: 'A glowing strip (no collision)', params: { len: [1.5, 0.2, 10, 0.1, 'Length', 'm'], color: { v: 'pink', opts: COLORS, label: 'Colour' } },
      build(e, k, p) { k.bar(v3(-p.len / 2, 0, 0), v3(p.len / 2, 0, 0), 0.008, 'rgLed_' + p.color, { noCollide: true, glow: true }); } },
  };
  for (const [k, c] of Object.entries(CATALOG)) c.type = k;
  for (const o of [SURF, PRESETS, CATALOG]) Object.setPrototypeOf(o, null);   // track files are untrusted: 'constructor' is no element
  const CATS = ['Gates', 'RaceGOW PVC', 'Flags', 'Obstacles', 'Walls', 'Floors', 'Special', 'Lighting'];
  // the kit needs to reach its output for the odd hand-built piece (the ramp)
  const defaults = type => { const C = CATALOG[type], o = {}; for (const [k, d] of Object.entries(C.params)) o[k] = Array.isArray(d) ? d[0] : d.v; return o; };
  function paramsOf(e) { const C = CATALOG[e.type], p = defaults(e.type); if (!C) return p;
    for (const [k, d] of Object.entries(C.params)) { const v = e.p && e.p[k]; if (Array.isArray(d)) { if (typeof v === 'number' && isFinite(v)) p[k] = clamp(v, d[1], d[2]); } else if (d.opts.includes(v)) p[k] = v; }
    return p; }

  // ------------------------------------------------------------------ rooms (venues) to build in
  function room(name, X, Z, H, floorMat, wallMat, furnish) {
    const objs = []; let nid = 0;
    const O = (nm, kind, extra = {}) => { const o = { id: 'v' + (nid++), name: nm, kind, prims: [], vis: [], ...extra }; objs.push(o); return o; };
    const box = (o, c, h, mat, ry = 0, opts = {}) => { const b = S.makeBox(c, h, ry, 0, 0); if (!opts.noCollide) { b.surf = opts.surf || SURF[wallMat] || null; o.prims.push(b); } o.vis.push({ shape: 'box', c, h, mat, euler: [0, ry, 0], ...opts }); return b; };
    const pipe = (o, a, b, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(S.makeCapsule(a, b, r)); o.vis.push({ shape: 'pipe', a, b, r, mat, ...opts }); };
    const walls = O('Walls', 'wall'), t = 0.1;
    box(walls, v3(0, H / 2, -Z / 2 - t), v3(X / 2 + t * 2, H / 2, t), wallMat, 0, { wall: 'z-' }); box(walls, v3(0, H / 2, Z / 2 + t), v3(X / 2 + t * 2, H / 2, t), wallMat, 0, { wall: 'z+' });
    box(walls, v3(-X / 2 - t, H / 2, 0), v3(t, H / 2, Z / 2), wallMat, 0, { wall: 'x-' }); box(walls, v3(X / 2 + t, H / 2, 0), v3(t, H / 2, Z / 2), wallMat, 0, { wall: 'x+' });
    const ceil = O('Ceiling', 'building'); box(ceil, v3(0, H + t, 0), v3(X / 2 + 0.2, t, Z / 2 + 0.2), 'ceiling', 0, { wall: 'ceiling' });
    if (furnish) furnish({ O, box, pipe, X, Z, H });
    const zones = [{ shape: 'zone', mat: floorMat, c: v3(0, 0.004, 0), h: v3(X / 2, 0, Z / 2) }];
    const prims = []; for (const o of objs) for (const pr of o.prims) { pr.owner = o.id; prims.push(pr); }
    return { name, indoor: true, objs, prims, zones, floorSurf: SURF[floorMat === 'hardwood' ? 'hardwood' : floorMat === 'rgFloor_carpet' ? 'carpet' : 'tile'] || null, size: { x: X, z: Z, h: H }, ceiling: H,
      spawn: { pos: v3(0, 0.03, Z / 2 - 0.8), yaw: 0 }, bounds: { x: [-X / 2, X / 2], z: [-Z / 2, Z / 2] }, lights: [[-X / 4, H - 0.05, 0], [X / 4, H - 0.05, 0]] };
  }
  const ROOMS = { __proto__: null,
    livingroom: { label: 'Living room', desc: '7.2 x 5.4 m, 2.5 m ceiling: couch, coffee table, TV, bookshelf', build: () => room('Living room', 7.2, 5.4, 2.5, 'hardwood', 'drywall', ({ O, box, X, Z }) => {
      const couch = O('Couch', 'furniture'); box(couch, v3(-1.2, 0.22, -Z / 2 + 0.5), v3(1.1, 0.22, 0.45), 'fabric'); box(couch, v3(-1.2, 0.6, -Z / 2 + 0.12), v3(1.1, 0.4, 0.1), 'fabric');
      const table = O('Coffee table', 'furniture'); box(table, v3(-1.2, 0.42, -Z / 2 + 1.55), v3(0.55, 0.03, 0.3), 'darkwood');
      for (const [dx, dz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) box(table, v3(-1.2 + dx, 0.2, -Z / 2 + 1.55 + dz), v3(0.025, 0.2, 0.025), 'darkwood');
      const tv = O('TV stand', 'furniture'); box(tv, v3(2.2, 0.25, -Z / 2 + 0.25), v3(0.8, 0.25, 0.22), 'darkwood'); box(tv, v3(2.2, 0.92, -Z / 2 + 0.2), v3(0.6, 0.36, 0.03), 'tv');
      const shelf = O('Bookshelf', 'furniture'); box(shelf, v3(X / 2 - 0.2, 0.95, 1.2), v3(0.18, 0.95, 0.45), 'darkwood');
      const rug = O('Rug', 'decor'); box(rug, v3(-0.6, 0.008, 0.2), v3(1.6, 0.006, 1.1), 'rug', 0, { noCollide: true }); }) },
    garage: { label: 'Garage', desc: '9 x 7 m, 3 m ceiling: workbench, shelving, a tool chest', build: () => room('Garage', 9, 7, 3.0, 'garageFloor', 'cinder', ({ O, box, pipe, X, Z }) => {
      const bench = O('Workbench', 'furniture'); box(bench, v3(-1.5, 0.92, -Z / 2 + 0.38), v3(1.2, 0.04, 0.35), 'plywood'); for (const dx of [-1.1, 1.1]) for (const dz of [-0.3, 0.3]) box(bench, v3(-1.5 + dx, 0.45, -Z / 2 + 0.38 + dz), v3(0.04, 0.45, 0.04), 'plywood');
      const shelf = O('Shelving', 'furniture'); for (const y of [0.35, 0.9, 1.45, 2.0]) box(shelf, v3(X / 2 - 0.3, y, -1.5), v3(0.28, 0.02, 0.9), 'metal');
      for (const dz of [-0.88, 0.88]) for (const dx of [-0.26, 0.26]) pipe(shelf, v3(X / 2 - 0.3 + dx, 0, -1.5 + dz), v3(X / 2 - 0.3 + dx, 2.05, -1.5 + dz), 0.018, 'metal');
      const chest = O('Tool chest', 'furniture'); box(chest, v3(-X / 2 + 0.35, 0.5, 1.5), v3(0.3, 0.5, 0.5), 'binRed'); }) },
    office: { label: 'Office', desc: '12 x 8 m, 2.7 m ceiling: desks in rows, fluorescent panels', build: () => room('Office', 12, 8, 2.7, 'garageFloor', 'drywall', ({ O, box, X, Z }) => {
      const desks = O('Desks', 'furniture'); for (const x of [-3.5, 0, 3.5]) for (const z of [-1.8, 1.8]) { box(desks, v3(x, 0.74, z), v3(0.8, 0.02, 0.4), 'plywood'); for (const sx of [-1, 1]) box(desks, v3(x + sx * 0.75, 0.36, z), v3(0.03, 0.36, 0.38), 'metal'); } }) },
    hall: { label: 'Hall', desc: '24 x 16 m, 7 m ceiling, pillars and pallet racks', build: () => room('Hall', 24, 16, 7, 'garageFloor', 'cinder', ({ O, box, pipe, Z }) => {
      const pil = O('Pillars', 'pillar'); for (const x of [-6, 6]) for (const z of [-3.5, 3.5]) box(pil, v3(x, 3.5, z), v3(0.2, 3.5, 0.2), 'concrete');
      const rack = O('Pallet racks', 'furniture'); for (let i = 0; i < 4; i++) { const x = -9 + i * 6; for (const y of [1.2, 2.6]) box(rack, v3(x, y, -Z / 2 + 0.6), v3(2.6, 0.05, 0.5), 'rackOrange');
        for (const dx of [-2.6, 2.6]) for (const dz of [-0.5, 0.5]) pipe(rack, v3(x + dx, 0, -Z / 2 + 0.6 + dz), v3(x + dx, 3.2, -Z / 2 + 0.6 + dz), 0.04, 'rackBlue'); } }) },
    empty: { label: 'Empty volume', desc: 'Bare walls, floor and ceiling: set the size', sized: true, build: (sz = {}) => room('Empty volume', clamp(num(sz.x, 10), 3, 60), clamp(num(sz.z, 8), 3, 60), clamp(num(sz.h, 3), 2, 20), 'hardwood', 'drywall', null) },
  };

  // ------------------------------------------------------------------ tracks
  const uid = (p = 'e') => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
  function newTrack(opts = {}) {
    const preset = PRESETS[opts.preset] ? opts.preset : 'indoor', venue = opts.venue && opts.venue.kind === 'map' ? { kind: 'map', map: String(opts.venue.map || 'moose') } : { kind: 'room', room: ROOMS[opts.venue && opts.venue.room] ? opts.venue.room : 'livingroom', size: opts.venue && opts.venue.size };
    const t = { format: 'pro-whooper-track/2', id: uid('t'), name: String(opts.name || 'New track').slice(0, 40), by: String(opts.by || '').slice(0, 24), tags: [], preset, section: U, venue, lighting: 'default', laps: 3, route: [], elements: [], created: new Date().toISOString() };
    t.elements.push(newElement('start', venue.kind === 'room' ? { x: 0, y: 0, z: ((ROOMS[venue.room].build(venue.size).size.z) / 2) - 1.4 } : { x: 0, y: 0, z: 0 }));
    return t;
  }
  function newElement(type, at = {}, p = {}) { const C = CATALOG[type]; if (!C) throw new Error('no such element: ' + type);
    return { id: uid(), type, x: num(at.x), y: num(at.y), z: num(at.z), ry: num(at.ry), rx: num(at.rx), rz: num(at.rz), s: 1, p: { ...defaults(type), ...p }, layer: C.layer }; }
  // anything that looks like a track: keep known fields only, clamp numbers, drop unknown element types (untrusted input)
  function cleanTrack(t) {
    if (!t || typeof t !== 'object') throw new Error('not a track');
    if (t.format === 'pro-whooper-track/1') return convertV1(t);
    if (t.format !== 'pro-whooper-track/2' || !Array.isArray(t.elements)) throw new Error('not a track');
    const name = x => String(x || '').replace(/[^\w .,'!&()+\-]/g, '').slice(0, 40);
    const venue = t.venue && t.venue.kind === 'map' && /^[a-z0-9-]{1,24}$/.test(String(t.venue.map)) ? { kind: 'map', map: t.venue.map }
      : { kind: 'room', room: ROOMS[t.venue && t.venue.room] ? t.venue.room : 'livingroom', ...(t.venue && t.venue.size ? { size: { x: clamp(num(t.venue.size.x, 10), 3, 60), z: clamp(num(t.venue.size.z, 8), 3, 60), h: clamp(num(t.venue.size.h, 3), 2, 20) } } : {}) };
    const els = t.elements.filter(e => e && CATALOG[e.type]).slice(0, 600).map(e => { const p = paramsOf(e), C = CATALOG[e.type];
      const o = { id: String(e.id || uid()).replace(/[^\w-]/g, '').slice(0, 24) || uid(), type: e.type, x: clamp(num(e.x), -500, 500), y: clamp(num(e.y), -5, 100), z: clamp(num(e.z), -500, 500),
        ry: num(e.ry) % 360, rx: clamp(num(e.rx), -180, 180), rz: clamp(num(e.rz), -180, 180), s: clamp(num(e.s, 1) || 1, 0.25, 4), p, layer: C.layer };
      if (e.sector) o.sector = true; if (e.hidden) o.hidden = true; if (e.name) o.name = name(e.name); return o; });
    const ids = new Set(els.map(e => e.id));
    return { format: 'pro-whooper-track/2', id: String(t.id || uid('t')).replace(/[^\w-]/g, '').slice(0, 32), name: name(t.name) || 'Track', by: name(t.by).slice(0, 24), pilot: /^[a-z0-9]{6,40}$/.test(String(t.pilot || '')) ? t.pilot : undefined,
      tags: (Array.isArray(t.tags) ? t.tags : []).filter(x => TAGS.includes(x)).slice(0, 6), preset: PRESETS[t.preset] ? t.preset : 'indoor', section: clamp(num(t.section, U), U, 3), venue,
      lighting: LIGHTING[t.lighting] ? t.lighting : 'default', laps: clamp(Math.round(num(t.laps, 3)), 1, 20), route: (Array.isArray(t.route) ? t.route : []).filter(id => ids.has(id)).slice(0, 400),
      elements: els, created: String(t.created || '').slice(0, 30), updated: String(t.updated || '').slice(0, 30), path: Array.isArray(t.path) ? t.path.slice(0, 200).map(q => [num(q[0]), num(q[1]), num(q[2])]) : undefined };
  }
  const TAGS = ['technical', 'flow', 'freestyle', 'beginner', 'igow', 'racegow', 'tiny', 'big', 'dark', 'outdoor'];
  const LIGHTING = { __proto__: null, default: 'As built', office: 'Office fluorescent', livingroom: 'Living-room warm', neon: 'Race-night neon', blacklight: 'Black light' };
  // old RaceGOW tracks (pro-whooper-track/1: PVC gates in a room) open as /2
  function convertV1(t) {
    const roomOf = { livingroom: 'livingroom', garage: 'garage', warehouse: 'hall' }, map1 = { gate: 'pvcGate', wide: 'pvcGate', tall: 'pvcGate', big: 'pvcGate', low: 'pvcGate', hurdle: 'pvcHurdle', pipe: 'pvcPipe', bar: 'pvcPipe', invisible: 'checkpoint', start: 'start' };
    const venue = t.env === 'playground' ? { kind: 'map', map: 'playground' } : { kind: 'room', room: roomOf[t.env] || 'livingroom' }, sec = num(t.section, U) || U;
    const els = (t.gates || []).filter(g => map1[g.type]).map(g => { const type = map1[g.type], pos = g.pos || [0, 0, 0], rot = g.rot || [0, 0, 0];
      const p = type === 'pvcGate' ? { w: num(g.w, 1), h: num(g.h, 1), lift: num(g.lift, 0.5), color: g.color || 'white' } : type === 'pvcHurdle' ? { w: num(g.w, 2), h: num(g.h, 0.5) } : type === 'pvcPipe' ? { len: num(g.w, 1) } : type === 'checkpoint' ? { w: num(g.w, 1) * sec, h: num(g.h, 1) * sec, lift: num(g.lift) * sec } : { w: num(g.w, 2) * sec, h: num(g.h, 1) * sec, lift: num(g.lift) * sec };
      return { id: String(g.id || uid()), type, x: num(pos[0]), y: num(pos[1]), z: num(pos[2]), ry: num(rot[0]), rx: num(rot[1]), rz: num(rot[2]), s: num(g.scale, 1), p, layer: CATALOG[type].layer }; });
    if (!els.some(e => e.type === 'start')) { const L = t.launch && t.launch.pos || [0, 0, 2]; els.unshift({ id: uid(), type: 'start', x: num(L[0]), y: 0, z: num(L[2]) - 0.6, ry: num(t.launch && t.launch.yaw), rx: 0, rz: 0, s: 1, p: defaults('start'), layer: 'gates' }); }
    return cleanTrack({ format: 'pro-whooper-track/2', id: t.id, name: t.name, preset: 'racegow', section: sec, venue, laps: 3, route: [], elements: els, created: t.created });
  }
  // a short fingerprint of what the track IS (its geometry, not its name): leaderboards key on it
  function trackHash(t) { const g = JSON.stringify([t.preset, t.section, t.venue, t.route, t.elements.map(e => [e.type, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), Math.round(e.ry), Math.round(e.rx), Math.round(e.rz), +e.s.toFixed(2), e.p, !!e.sector])]);
    let h1 = 0x811c9dc5, h2 = 0x01000193; for (let i = 0; i < g.length; i++) { const c = g.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
    return (h1.toString(36) + h2.toString(36)).slice(0, 14); }

  // ------------------------------------------------------------------ building a track into colliders, looks and gates
  function elementParts(e, ctx) {
    const C = CATALOG[e.type], out = { prims: [], vis: [], gates: [], fields: [], lights: [] }; if (!C || e.hidden) return out;
    const p = paramsOf(e); let surfKey = p.collide || (C.surf ? C.surf(p) : null); const surf = SURF[surfKey] || (C.pvc ? SURF.soft : C.gate ? SURF.soft : null);
    const k = kitFor(e, surf, out); k._out = out; C.build(e, k, p, ctx);
    for (const g of out.gates) { if (g.zOff) { g.o = add(g.o, mul(g.fwd, -g.zOff * g.s)); } g.type = e.type; g.label = e.name || C.label; g.sector = !!e.sector; g.start = !!(g.start || C.start); g.finish = !!(g.finish || C.finish); }
    return out;
  }
  function venueOf(track, mapWorld) {
    if (track.venue.kind === 'room') { const R = ROOMS[track.venue.room] || ROOMS.livingroom; return R.build(track.venue.size); }
    if (!mapWorld) return { name: track.venue.map, indoor: false, objs: [], prims: [], zones: [], size: { x: 200, z: 200, h: 60 }, ceiling: 60, bounds: { x: [-100, 100], z: [-100, 100] }, lights: [] };
    return { ...mapWorld, indoor: false, ceiling: mapWorld.ceiling || 60, size: mapWorld.size || { x: 200, z: 200, h: 60 } };
  }
  // the route: the gates in order. track.route lists element ids; gates not in it follow in the order they were placed.
  function routeOf(track) { const gates = track.elements.filter(e => CATALOG[e.type] && CATALOG[e.type].gate && !e.hidden && !CATALOG[e.type].start && !CATALOG[e.type].finish);
    const pos = new Map(track.route.map((id, i) => [id, i])); return gates.slice().sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6 + track.elements.indexOf(a)) - (pos.has(b.id) ? pos.get(b.id) : 1e6 + track.elements.indexOf(b))); }
  function buildTrack(track, mapWorld) {
    const V = venueOf(track, mapWorld), ctx = { section: track.preset === 'racegow' ? track.section : U, ceiling: V.ceiling };
    const objs = [], gatesByEl = new Map(), fields = [], lights = [];
    for (const e of track.elements) { const o = { id: 'rg:' + e.id, eid: e.id, name: e.name || (CATALOG[e.type] || {}).label, kind: 'race', ...elementParts(e, ctx) }; for (const pr of o.prims) pr.owner = o.id; objs.push(o);
      if (o.gates.length) gatesByEl.set(e.id, o.gates); fields.push(...o.fields); lights.push(...o.lights); }
    const start = track.elements.find(e => e.type === 'start' && !e.hidden), finish = track.elements.find(e => e.type === 'finish' && !e.hidden);
    const route = routeOf(track), seq = [];   // one checkpoint per route step (an element may hold several openings: a split gate)
    if (start && gatesByEl.get(start.id)) seq.push({ eid: start.id, cps: gatesByEl.get(start.id), start: true });
    for (const e of route) if (gatesByEl.get(e.id)) seq.push({ eid: e.id, cps: gatesByEl.get(e.id), sector: !!e.sector });
    if (finish && gatesByEl.get(finish.id)) seq.push({ eid: finish.id, cps: gatesByEl.get(finish.id), finish: true });
    const prims = [...(mapWorld ? [] : V.prims), ...objs.flatMap(o => o.prims)];
    let spawn = V.spawn || { pos: v3(0, 0.03, 0), yaw: 0 };
    if (start && gatesByEl.get(start.id)) { const g = gatesByEl.get(start.id)[0], back = add(g.o, mul(g.fwd, -0.9)), fh = Math.hypot(g.fwd.x, g.fwd.z) || 1; spawn = { pos: v3(back.x, 0.03 + Math.max(0, back.y), back.z), yaw: Math.atan2(-g.fwd.x / fh, -g.fwd.z / fh) }; }
    return { track, venue: V, objs, prims, seq, fields, lights, spawn, loop: !finish, ceiling: V.ceiling, ctx };
  }

  // ------------------------------------------------------------------ gate crossing
  function localOf(cp, p) { const d = sub(p, cp.o); return { x: dot(d, cp.right) / cp.s, y: dot(d, cp.up) / cp.s, z: dot(d, cp.fwd) / cp.s }; }
  function inPoly(poly, x, y) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
  function inOpening(cp, x, y) { if (cp.circle) return Math.hypot(x - cp.circle.cx, y - cp.circle.cy) <= cp.circle.r; if (cp.polys) return cp.polys.some(P => inPoly(P, x, y)); return inPoly(cp.poly, x, y); }
  // the segment p0 -> p1 crosses the opening: +1 the right way (toward -z local), -1 backward, 0 not through it
  function crossing(cp, p0, p1) { const a = localOf(cp, p0), b = localOf(cp, p1); if ((a.z > 0) === (b.z > 0) || a.z === b.z) return 0;
    const f = a.z / (a.z - b.z), x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f; if (!inOpening(cp, x, y)) return 0; return b.z > a.z ? 1 : -1; }
  function centreOf(cp) { let x = 0, y = 0; if (cp.circle) { x = cp.circle.cx; y = cp.circle.cy; } else { const P = cp.polys ? cp.polys.flat() : cp.poly; for (const q of P) { x += q[0]; y += q[1]; } x /= P.length; y /= P.length; }
    return add(cp.o, add(mul(cp.right, x * cp.s), mul(cp.up, y * cp.s))); }
  function stepCentre(st) { const cs = st.cps.map(centreOf); return mul(cs.reduce((a, c) => add(a, c), v3()), 1 / cs.length); }

  // ------------------------------------------------------------------ a race
  // modes: 'timeattack' (N laps, total time), 'hotlaps' (lap after lap, best lap and best sectors), 'test' (no records)
  // Events from step(): { type: 'start' | 'gate' | 'wrong' | 'skip' | 'sector' | 'lap' | 'finish', ... } in time order.
  class Race {
    constructor(built, opts = {}) { this.B = built; this.mode = opts.mode || 'hotlaps'; this.laps = opts.laps || built.track.laps || 3; this.ref = opts.ref || null;   // ref: { gateTimes: [...] } a lap to compare with (PB or ghost)
      this.n = built.seq.length; this.sectors = sectorPlan(built); this.reset(); }
    reset() { this.on = false; this.next = 0; this.lap = 0; this.t0 = null; this.lapT0 = null; this.gateTimes = []; this.lapTimes = []; this.sectorTimes = []; this.curSectors = []; this.bestLap = null; this.bestSectors = []; this.done = false; this.total = null; this.lastGate = -1; }
  }
  // gates must be flown in order; the start/finish again (or the finish) closes a lap
  Race.prototype.step = function (p0, p1, t) {
    const ev = [];
    if (this.done || this.n < 2) return ev;
    const want = this.B.seq[this.next], cross1 = st => { for (const cp of st.cps) { const c = crossing(cp, p0, p1); if (c) return c; } return 0; }, c = cross1(want);
    if (c < 0) { ev.push({ type: 'wrong', i: this.next, t }); return ev; }
    if (c > 0) {
      if (want.start && !this.on) { this.on = true; this.t0 = t; this.lapT0 = t; this.lap = 1; this.gateTimes = [0]; this.curSectors = []; this.next = 1; ev.push({ type: 'start', t }); return ev; }
      const lt = t - this.lapT0, endOfLap = want.start || want.finish;
      const ref = this.ref && this.ref.gateTimes ? this.ref.gateTimes[endOfLap ? this.n : this.next] : null;
      this.gateTimes[endOfLap ? this.n : this.next] = lt;
      ev.push({ type: 'gate', i: this.next, t, lt, delta: ref != null ? lt - ref : null });
      const sIdx = this.sectors.indexOf(endOfLap ? this.n : this.next);
      if (sIdx >= 0) { const prev = sIdx ? this.gateTimes[this.sectors[sIdx - 1]] : 0, st = lt - prev, best = this.bestSectors[sIdx], isBest = best == null || st < best; this.curSectors[sIdx] = st; if (isBest) this.bestSectors[sIdx] = st; ev.push({ type: 'sector', s: sIdx, time: st, best: isBest, t }); }
      if (endOfLap) {
        const isBest = this.bestLap == null || lt < this.bestLap; this.lapTimes.push(lt); const lapGates = this.gateTimes.slice(); if (isBest) { this.bestLap = lt; this.bestGates = lapGates; }
        ev.push({ type: 'lap', lap: this.lap, time: lt, best: isBest, sectors: this.curSectors.slice(), gateTimes: lapGates, t });
        const finished = !this.B.loop || (this.mode === 'timeattack' && this.lap >= this.laps);
        if (finished && this.mode !== 'hotlaps') { this.done = true; this.total = t - this.t0; ev.push({ type: 'finish', total: this.total, laps: this.lapTimes.slice(), t }); return ev; }
        if (!this.B.loop) { this.on = false; this.next = 0; this.lap = 0; return ev; }   // point to point in hot laps: fly back to the start for another go
        this.lap++; this.lapT0 = t; this.gateTimes = [0]; this.curSectors = []; this.next = 1; return ev; }
      this.next = this.next + 1 >= this.n ? 0 : this.next + 1; return ev; }
    if (this.on) for (let j = 1; j < Math.min(4, this.n); j++) { const k = (this.next + j) % this.n; if (cross1(this.B.seq[k]) > 0) { ev.push({ type: 'skip', i: this.next, at: k, t }); break; } }
    return ev; };
  // sectors: gates marked as sector ends, else three even sectors; the last sector always ends at the lap's end (index n)
  function sectorPlan(B) { const n = B.seq.length; if (n < 2) return []; const marked = B.seq.map((s, i) => s.sector ? i : -1).filter(i => i > 0);
    const ends = marked.length ? marked : n >= 4 ? [Math.round(n / 3), Math.round(2 * n / 3)].filter((x, i, a) => x > 0 && x < n && a.indexOf(x) === i) : [];
    return [...ends, B.loop ? n : n - 1].filter((x, i, a) => a.indexOf(x) === i); }

  // ------------------------------------------------------------------ ghosts: a lap, 30 times a second, small enough to share
  const GHZ = 30;
  function packGhost(samples) {   // samples: [{ t, p: {x,y,z}, q: {w,x,y,z} }] -> { hz, n, d: [ints] } (delta-coded mm and 1e-4)
    const out = [], L = [0, 0, 0, 0, 0, 0, 0]; const t0 = samples.length ? samples[0].t : 0; let next = t0;
    const pick = []; for (const s of samples) if (s.t >= next - 1e-6) { pick.push(s); next += 1 / GHZ; }
    for (const s of pick) { const v = [Math.round(s.p.x * 1000), Math.round(s.p.y * 1000), Math.round(s.p.z * 1000), Math.round(s.q.w * 1e4), Math.round(s.q.x * 1e4), Math.round(s.q.y * 1e4), Math.round(s.q.z * 1e4)]; for (let i = 0; i < 7; i++) { out.push(v[i] - L[i]); L[i] = v[i]; } }
    return { hz: GHZ, n: pick.length, d: out }; }
  function unpackGhost(g) { if (!g || !Array.isArray(g.d) || !(g.hz > 0)) return null; const n = Math.min(g.n | 0, Math.floor(g.d.length / 7)), L = [0, 0, 0, 0, 0, 0, 0], out = [];
    for (let k = 0; k < n; k++) { for (let i = 0; i < 7; i++) L[i] += num(g.d[k * 7 + i]); out.push({ t: k / g.hz, p: v3(L[0] / 1000, L[1] / 1000, L[2] / 1000), q: { w: L[3] / 1e4, x: L[4] / 1e4, y: L[5] / 1e4, z: L[6] / 1e4 } }); }
    return out; }
  function sampleGhost(frames, t) { if (!frames || !frames.length) return null; const hz = frames.length > 1 ? 1 / (frames[1].t - frames[0].t) : GHZ, f = clamp(t * hz, 0, frames.length - 1), i = Math.floor(f), j = Math.min(frames.length - 1, i + 1), a = f - i, A = frames[i], B = frames[j];
    let q = B.q; if (A.q.w * q.w + A.q.x * q.x + A.q.y * q.y + A.q.z * q.z < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
    const Q = { w: A.q.w + (q.w - A.q.w) * a, x: A.q.x + (q.x - A.q.x) * a, y: A.q.y + (q.y - A.q.y) * a, z: A.q.z + (q.z - A.q.z) * a }, L = Math.hypot(Q.w, Q.x, Q.y, Q.z) || 1;
    return { p: add(A.p, mul(sub(B.p, A.p), a)), q: { w: Q.w / L, x: Q.x / L, y: Q.y / L, z: Q.z / L }, end: f >= frames.length - 1 }; }

  // ------------------------------------------------------------------ analysis: lap estimate, difficulty, the flow
  function flow(B) {   // per leg of the route: length, the turn into the next leg, the height change, the expected speed
    const pts = B.seq.map(stepCentre); if (B.loop && pts.length > 1) pts.push(pts[0]);
    const legs = []; for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1], d = sub(b, a), L = len(d);
      const nx = pts[i + 2] || (B.loop ? pts[1] : null), turn = nx ? Math.acos(clamp(dot(norm(d), norm(sub(nx, b))), -1, 1)) / D2R : 0;
      const cap = PRESETS[B.track.preset].speed * (B.venue.indoor ? 1 : 1.5), speed = clamp(cap * (1 - turn / 260) * Math.min(1, 0.45 + L / 5), 1.2, cap * 1.2);
      legs.push({ a, b, len: L, turn, dy: b.y - a.y, speed }); }
    return legs; }
  function estimate(B) { const legs = flow(B); if (!legs.length) return { lap: null, difficulty: null, length: 0 };
    const L = legs.reduce((s, l) => s + l.len, 0), lap = legs.reduce((s, l) => s + l.len / l.speed + l.turn / 180 * 0.35 + Math.abs(l.dy) * 0.15, 0);
    const sizes = B.seq.flatMap(s => s.cps.map(cp => cp.circle ? cp.circle.r * 2 * cp.s : (() => { const P = cp.polys ? cp.polys[0] : cp.poly, xs = P.map(q => q[0]), ys = P.map(q => q[1]); return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * cp.s; })()));
    const minGate = Math.min(...sizes), turnRate = legs.reduce((s, l) => s + l.turn, 0) / Math.max(1, L), climb = legs.reduce((s, l) => s + Math.abs(l.dy), 0) / Math.max(1, L);
    const score = clamp(1 + (0.6 / Math.max(0.2, minGate) - 0.6) * 0.9 + turnRate / 30 + climb * 4 + (B.seq.length > 12 ? 0.5 : 0), 1, 5);
    return { lap: +lap.toFixed(1), difficulty: +score.toFixed(1), length: +L.toFixed(1), minGate: +minGate.toFixed(2) }; }

  // ------------------------------------------------------------------ "Make raceable": the checklist
  function aabbOf(prims) { const b = { min: v3(1e9, 1e9, 1e9), max: v3(-1e9, -1e9, -1e9) }; for (const p of prims) { const a = p.aabb; for (const k of ['x', 'y', 'z']) { b.min[k] = Math.min(b.min[k], a.min[k]); b.max[k] = Math.max(b.max[k], a.max[k]); } } return b; }
  const HANGS = new Set(['hangingPlant', 'ceilingBeam', 'lamp', 'neon', 'fan', 'dark', 'boost', 'checkpoint']);
  function checks(B) {
    const T = B.track, out = [], add1 = (level, text, ids) => out.push({ level, text, ids: ids || [] });
    const starts = T.elements.filter(e => e.type === 'start' && !e.hidden), finishes = T.elements.filter(e => e.type === 'finish' && !e.hidden);
    if (starts.length !== 1) add1('fail', starts.length ? 'More than one start/finish: keep one' : 'No start/finish: place the Start / Finish gantry', starts.map(e => e.id)); else add1('pass', 'Start / finish in place');
    if (finishes.length > 1) add1('fail', 'More than one finish', finishes.map(e => e.id));
    const n = B.seq.length - 1 - (finishes.length ? 1 : 0); if (n < 2) add1('fail', `Only ${Math.max(0, n)} gate${n === 1 ? '' : 's'} besides the start: place at least 2`); else add1('pass', `${n} gates in the route` + (finishes.length ? ', point to point' : ', a closed loop'));
    const P = PRESETS[T.preset], small = [], big = [];
    for (const st of B.seq) for (const cp of st.cps) { if (cp.invisible || cp.start || cp.finish) continue; const w = cp.circle ? cp.circle.r * 2 * cp.s : (() => { const Q = cp.polys ? cp.polys[0] : cp.poly, xs = Q.map(q => q[0]), ys = Q.map(q => q[1]); return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * cp.s; })();
      if (w < P.gateMin - 1e-3) small.push(st.eid); if (w > P.gateMax + 1e-3) big.push(st.eid); }
    if (small.length) add1('fail', `${small.length} gate${small.length > 1 ? 's are' : ' is'} smaller than ${P.label} allows (${Math.round(P.gateMin * 100)} cm)`, small); if (big.length) add1('warn', `${big.length} gate${big.length > 1 ? 's are' : ' is'} bigger than ${Math.round(P.gateMax * 100)} cm`, big);
    if (T.preset === 'racegow') { const nonPvc = T.elements.filter(e => !e.hidden && CATALOG[e.type].gate && !CATALOG[e.type].pvc && !['start', 'finish', 'checkpoint'].includes(e.type)); if (nonPvc.length) add1('warn', 'RaceGOW: gates should be openings of the PVC structure (PVC parts or checkpoints)', nonPvc.map(e => e.id));
      const pipes = T.elements.filter(e => CATALOG[e.type].pvc).length; add1(pipes ? 'pass' : 'warn', `RaceGOW: section ${Math.round(T.section / 0.0254)} in (24 in minimum), ${pipes} PVC part${pipes === 1 ? '' : 's'}`); }
    // floating: every element that stands must touch the floor or rest on something
    const solids = B.objs.filter(o => o.prims.length), boxes = new Map(solids.map(o => [o.eid, aabbOf(o.prims)])), floating = [];
    for (const o of solids) { const e = T.elements.find(x => x.id === o.eid); if (!e || HANGS.has(e.type)) continue; const b = boxes.get(o.eid); if (b.min.y < 0.03) continue;
      const onSomething = [...boxes.entries()].some(([id, c]) => id !== o.eid && Math.abs(c.max.y - b.min.y) < 0.04 && c.min.x < b.max.x && c.max.x > b.min.x && c.min.z < b.max.z && c.max.z > b.min.z) || B.venue.prims.some(pr => Math.abs(pr.aabb.max.y - b.min.y) < 0.05 && pr.aabb.min.x < b.max.x && pr.aabb.max.x > b.min.x && pr.aabb.min.z < b.max.z && pr.aabb.max.z > b.min.z);
      if (!onSomething) floating.push(o.eid); }
    if (floating.length) add1('warn', `${floating.length} thing${floating.length > 1 ? 's float' : ' floats'} in the air (not on the floor or on anything)`, floating); else add1('pass', 'Nothing floating');
    // solid geometry passing through solid geometry (PVC joins and floors are meant to touch)
    const clash = []; const list = solids.filter(o => { const e = T.elements.find(x => x.id === o.eid); return e && !CATALOG[e.type].pvc && e.type !== 'floor' && !HANGS.has(e.type); });
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = boxes.get(list[i].eid), b = boxes.get(list[j].eid), ov = ['x', 'y', 'z'].map(k => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
      if (ov.every(v => v > 0.03) && list[i].prims.some(p => list[j].prims.some(q => boxHit(p, q)))) clash.push(list[i].eid, list[j].eid); }
    if (clash.length) add1('warn', `${clash.length / 2} pair${clash.length > 2 ? 's' : ''} of solid things pass through each other`, [...new Set(clash)]); else add1('pass', 'No solids passing through each other');
    // ceiling and walls
    if (B.venue.indoor) { const H = B.ceiling, low = [], out1 = [];
      for (const st of B.seq) for (const cp of st.cps) { const c = centreOf(cp), top = c.y + 0.25; if (top > H - 0.15) low.push(st.eid); }
      for (const o of B.objs) { if (!o.prims.length) continue; const b = aabbOf(o.prims); if (b.max.y > H + 0.01 || b.min.x < B.venue.bounds.x[0] - 0.02 || b.max.x > B.venue.bounds.x[1] + 0.02 || b.min.z < B.venue.bounds.z[0] - 0.02 || b.max.z > B.venue.bounds.z[1] + 0.02) out1.push(o.eid); }
      if (low.length) add1('warn', `${low.length} gate${low.length > 1 ? 's sit' : ' sits'} close under the ceiling (less than 15 cm over the top of the opening)`, low);
      if (out1.length) add1('fail', `${out1.length} thing${out1.length > 1 ? 's go' : ' goes'} through the walls or the ceiling`, out1); }
    // the physics of the line: ground cushion and prop wash
    const legs = flow(B), lowG = B.seq.filter(st => st.cps.some(cp => { const c = centreOf(cp); return c.y < 0.22; })).map(s => s.eid);
    if (lowG.length) add1('note', `${lowG.length} gate${lowG.length > 1 ? 's are' : ' is'} close to the floor: the ground cushion pushes up there`, lowG);
    const wash = legs.map((l, i) => l.dy < -1 && Math.hypot(l.b.x - l.a.x, l.b.z - l.a.z) < 2.2 ? i : -1).filter(i => i >= 0);
    if (wash.length) add1('note', `${wash.length} steep drop${wash.length > 1 ? 's' : ''} between gates: expect prop wash (descending into your own air)`, wash.map(i => B.seq[i + 1 < B.seq.length ? i + 1 : 0].eid));
    const est = estimate(B); if (est.lap != null) add1('pass', `About ${est.lap} s a lap (${est.length} m), difficulty ${est.difficulty} / 5`);
    const ok = !out.some(c => c.level === 'fail'); return { ok, checks: out, estimate: est };
  }
  // do two prims really touch (boxes as boxes, capsules as fat segments): good enough for a warning
  function boxHit(p, q) { const a = p.aabb, b = q.aabb; if (a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y || a.max.z < b.min.z || b.max.z < a.min.z) return false;
    const c = v3((Math.max(a.min.x, b.min.x) + Math.min(a.max.x, b.max.x)) / 2, (Math.max(a.min.y, b.min.y) + Math.min(a.max.y, b.max.y)) / 2, (Math.max(a.min.z, b.min.z) + Math.min(a.max.z, b.max.z)) / 2);
    const inside = pr => pr.type === 'box' ? !!S.sphereVs(pr, c, 0.005) : pr.type === 'capsule' ? !!S.sphereVs(pr, c, 0.005) : true; return inside(p) && inside(q); }

  // ------------------------------------------------------------------ tools: the path tool, mirror
  // a smooth line through the points (Catmull-Rom), gates set along it every `spacing` metres, each facing along the line
  function pathGates(pts, spacing, type = 'gateSquare', p = {}) {
    if (pts.length < 2) return []; const P = pts.map(q => v3(q[0], q[1], q[2])), seg = [];
    const at = (i, t) => { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[Math.min(P.length - 1, i + 1)], p3 = P[Math.min(P.length - 1, i + 2)], t2 = t * t, t3 = t2 * t;
      return v3(0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3), 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3), 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)); };
    for (let i = 0; i + 1 < P.length; i++) for (let k = 0; k < 20; k++) seg.push(at(i, k / 20)); seg.push(P[P.length - 1]);
    const out = []; let run = spacing * 0.5;
    for (let i = 1; i < seg.length; i++) { const d = len(sub(seg[i], seg[i - 1])); run += d; if (run >= spacing) { run -= spacing; const dir = norm(sub(seg[Math.min(seg.length - 1, i + 1)], seg[Math.max(0, i - 1)])), C = CATALOG[type], size = (p.size ?? defaults(type).size ?? 0.4);
        const lift = Math.max(0, seg[i].y - size / 2); out.push(newElement(type, { x: seg[i].x, y: 0, z: seg[i].z, ry: Math.atan2(-dir.x, -dir.z) / D2R }, { ...p, ...(C.params.lift ? { lift } : {}) })); } }
    return out; }
  function mirror(track, ids, axis = 'x', about = 0) { const set = new Set(ids);
    for (const e of track.elements) if (set.has(e.id)) { if (axis === 'x') { e.x = 2 * about - e.x; e.ry = -e.ry; e.rz = -e.rz; } else { e.z = 2 * about - e.z; e.ry = 180 - e.ry; e.rz = -e.rz; } e.ry = ((e.ry % 360) + 540) % 360 - 180; }
    return track; }
  // flags and arrows set to face the next gate: point each at the gate after the one nearest to it
  function autoFace(track, built) { const seq = built.seq; if (seq.length < 2) return; const cs = seq.map(stepCentre);
    for (const e of track.elements) { const p = paramsOf(e); if (p.autoFace !== 'yes') continue; let bi = 0, bd = 1e9; cs.forEach((c, i) => { const d = Math.hypot(c.x - e.x, c.z - e.z); if (d < bd) { bd = d; bi = i; } });
      const tgt = cs[(bi + 1) % cs.length]; e.ry = Math.atan2(-(tgt.x - e.x), -(tgt.z - e.z)) / D2R; } }

  root.RG = { U, PIPE_R, SURF, PRESETS, CATALOG, CATS, LAYERS, LED, COLORS, TAGS, LIGHTING, ROOMS, sizePresets, rotM, poseOf, paramsOf, defaults, newTrack, newElement, cleanTrack, convertV1, trackHash,
    elementParts, buildTrack, routeOf, crossing, centreOf, stepCentre, inOpening, Race, sectorPlan, packGhost, unpackGhost, sampleGhost, GHZ, flow, estimate, checks, pathGates, mirror, autoFace, uid };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RG;
})(typeof window !== 'undefined' ? window : globalThis);
