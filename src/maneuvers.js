// Scripted trick flights ("the bot"). Each maneuver builds a time-parametrised flight path (position + attitude) for a
// trick on a playground object, shaped and timed like the prowhooper.com demo GIFs (docs/tricktionary-reference.md).
// Used by test/stress.js (thousands of randomised variations) and by the game's Judge the Bot mode and ghost preview,
// so the flights the pilot judges are the same flights the stress tester trusts. Load after sim.js.
(function (root) {
  const S = root.Sim;
  const { v3, add, sub, mul, qmul, qaxis, qnorm } = S;
  const D = Math.PI / 180, P = Math.PI;
  const X = v3(1, 0, 0), UP = v3(0, 1, 0), ROLL = v3(0, 0, -1), YAW = v3(0, -1, 0);
  const ID = { w: 1, x: 0, y: 0, z: 0 };
  const pitchQ = a => qaxis(X, a), rollQ = a => qaxis(ROLL, a), yawQ = a => qaxis(YAW, a);
  // camera-tilt pilots hold the body pitched (nose down by the tilt) relative to the line they fly; trick rotations stay
  // about the body axes (that's what the sticks command), so the tilt goes in the base attitude, not on top
  let TILT_Q = { w: 1, x: 0, y: 0, z: 0 };
  const faceQ = h => qmul(qaxis(UP, Math.atan2(-h.x, -h.z)), TILT_Q);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const norm = a => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));

  // ---- seeded randomness (stress runs are reproducible)
  function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }   // mulberry32
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const range = (r, a, b) => a + (b - a) * r();

  // ---- path building blocks: segments are { T, f(t) -> { pos, q } }
  function chain(segs) {
    const T = segs.reduce((s, x) => s + x.T, 0);
    return { T, at: t => { for (const s of segs) { if (t < s.T) return s.f(Math.max(0, t)); t -= s.T; } const l = segs[segs.length - 1]; return l.f(l.T); } };
  }
  const line = (p0, v, T, q) => ({ T, f: t => ({ pos: add(p0, mul(v, t)), q }) });
  const hold = (p, q, T) => ({ T, f: () => ({ pos: p, q }) });
  // time table for an angle that advances at a rate easing from wmax (th = 0, 2π) to wmin (th = π): floaty loop tops
  function sweep(th0, th1, wmin, wmax) {
    const tab = [[0, th0]], dt = 0.002, s = Math.sign(th1 - th0); let th = th0, t = 0;
    while (s * (th1 - th) > 1e-9) { th += s * (wmin + (wmax - wmin) * (1 + Math.cos(th)) / 2) * D * dt; t += dt; tab.push([t, s > 0 ? Math.min(th, th1) : Math.max(th, th1)]); }
    return { T: t, at: u => tab[Math.min(tab.length - 1, Math.floor(u / dt))][1] };
  }
  // small body wobble (pilot noise): sum of slow sines on all axes, a few degrees, tens of °/s at most
  function wobble(r, amp) {
    if (!amp) return () => ID;
    const w = [0, 1, 2].map(() => ({ f: range(r, 1.5, 5), p: range(r, 0, 6.28), a: amp * range(r, 0.4, 1) }));
    return t => w.reduce((q, c, i) => qmul(q, qaxis([X, YAW, ROLL][i], c.a * D / (2 * P * c.f) * Math.sin(2 * P * c.f * t + c.p))), ID);
  }

  // ---- obstacle frame: centre, heading across the object, under/over heights
  function frame(world, name, r) {
    const objs = world.objs.filter(o => o.name === name && o.obstacle); if (!objs.length) return null;
    const o = pick(r, objs);
    if (o.round) {   // tree: any approach direction, pass beside the trunk under the canopy
      const a = range(r, 0, 2 * P), h = v3(Math.sin(a), 0, Math.cos(a)), side = v3(h.z, 0, -h.x), off = range(r, 0.5, 0.9) * (r() < 0.5 ? 1 : -1);
      return { o, name, C: add(o.round.c, mul(side, off)), h, under: o.round.under, over: o.round.over, round: true };
    }
    const { a, b, under, over } = o.obstacle; const ab = sub(b, a); ab.y = 0; const L = Math.hypot(ab.x, ab.z), u = mul(ab, 1 / L);
    const n = v3(-u.z, 0, u.x), ang = range(r, -25, 25) * D * (name === 'Pilot' ? 0.3 : 1), sgn = r() < 0.5 ? 1 : -1;
    const h = norm(add(mul(n, sgn * Math.cos(ang)), mul(u, Math.sin(ang))));
    const along = name === 'Pilot' ? 0.5 : clamp(range(r, 0.3, 0.7), 0, 1);
    return { o, name, C: add(a, mul(ab, along)), h, under, over };
  }
  // vertical loop around the obstacle: bottom below 'under', top above 'over'
  function loopGeo(F, r, opt = {}) {
    const bottom = clamp(F.under - range(r, 0.35, 0.8), 0.3, F.under - 0.12), top = F.over + range(r, 0.4, 0.9);
    const RY = (top - bottom) / 2, Cy = (top + bottom) / 2, RZ = opt.RZ ?? clamp(range(r, 1.0, 2.4) * (F.name === 'Pilot' ? 0.6 : 1), 0.7, 2.6);
    const C = v3(F.C.x, Cy, F.C.z), h = F.h, face = faceQ(h);
    return { C, h, RZ, RY, face, at: th => add(C, add(mul(h, RZ * Math.sin(th)), v3(0, -RY * Math.cos(th), 0))) };
  }
  const arc = (G, a, b, wmin, wmax, att) => { const sw = sweep(a, b, wmin, wmax); return { T: sw.T, f: t => { const th = sw.at(t); return { pos: G.at(th), q: qmul(G.face, att(th, t)) }; } }; };

  // ---- the maneuvers. make(world, r, opts) -> { T, at(t), object, params }
  const OVER = ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Tree', 'Pilot'];
  const OPEN = v3(0, 6, 1);
  function openAir(steps) {   // steps: [axis, degrees, rate] or ['pause', seconds]
    return (world, r, o = {}) => {
      const scale = range(r, 0.85, 1.2), wob = wobble(r, o.wobble ?? range(r, 0, 35)), drift = mul(norm(v3(range(r, -1, 1), 0, range(r, -1, 1))), range(r, 0, 2.5));
      const parts = []; let q = TILT_Q; const base = TILT_Q; const lead = 0.6;
      for (const s of steps) {
        if (s[0] === 'pause') { const T = s[1] * range(r, 0.85, 1.2); parts.push({ T, q0: q, ax: null }); continue; }
        const [ax, deg, rate] = s, T = Math.abs(deg) / (rate * scale), axis = ax === 'P' ? X : ax === 'R' ? ROLL : YAW;
        parts.push({ T, q0: q, ax: axis, deg }); q = qmul(q, qaxis(axis, deg * D));
      }
      const Tm = parts.reduce((s, p) => s + p.T, 0), T = lead + Tm + 1.6;
      return { T, object: 'open air', params: { scale: +scale.toFixed(2) }, at: t => {
        let u = t - lead, qq = base;
        if (u > 0) { qq = q; for (const p of parts) { if (u < p.T) { qq = p.ax ? qmul(p.q0, qaxis(p.ax, p.deg * D * u / p.T)) : p.q0; break; } u -= p.T; } }
        return { pos: add(OPEN, mul(drift, t)), q: qmul(qq, wob(t)) };
      } };
    };
  }
  // powerloop family: under → up the far side → over the top (inverted) → down → under again
  function loopTrick(peak) {
    return (world, r, o = {}) => {
      const F = frame(world, o.object || pick(r, o.objects || OVER), r); const G = loopGeo(F, r);
      const v = range(r, 3, 6), wmax = range(r, 220, 360), wmin = range(r, o.floaty ? 50 : 90, 200), wob = wobble(r, o.wobble ?? range(r, 0, 30));
      const b0 = G.at(0), appr = line(sub(b0, mul(G.h, v * 1.0)), mul(G.h, v), 1.0, G.face);
      const segs = [appr]; let post = () => ID, from = 0;
      if (peak) {
        const pk = peak(r); segs.push(arc(G, 0, P - 0.12, wmin, wmax, th => pitchQ(th)));
        const T = Math.abs(pk.deg) / pk.rate;
        segs.push({ T, f: t => { const th = P - 0.12 + 0.24 * t / T; return { pos: G.at(th), q: qmul(G.face, qmul(pitchQ(th), qaxis(pk.axis, pk.deg * D * t / T))) }; } });
        post = () => qaxis(pk.axis, pk.deg * D); from = P + 0.12;
      }
      segs.push(arc(G, from, 2 * P, wmin, wmax, th => qmul(pitchQ(th), post())));
      segs.push(line(G.at(2 * P), mul(G.h, v), 1.0, qmul(G.face, post())), hold(add(G.at(2 * P), mul(G.h, v)), qmul(G.face, post()), 1.6));
      const c = chain(segs);
      return { T: c.T, object: F.name, params: { speed: +v.toFixed(1), loop: +G.RZ.toFixed(1), topRate: Math.round(wmin), bottomRate: Math.round(wmax) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
    };
  }
  function immelmann(world, r, o = {}) {
    const F = frame(world, o.object || pick(r, OVER), r), G = loopGeo(F, r), v = range(r, 3, 6), wob = wobble(r, o.wobble ?? range(r, 0, 30));
    const b0 = G.at(0), top = G.at(P), inv = qmul(G.face, pitchQ(P)), rT = range(r, 0.25, 0.5), back = mul(G.h, -range(r, 2, 4));
    const c = chain([line(sub(b0, mul(G.h, v)), mul(G.h, v), 1.0, G.face), arc(G, 0, P, range(r, 150, 260), range(r, 260, 400), th => pitchQ(th)),
      { T: rT, f: t => ({ pos: add(top, mul(back, t)), q: qmul(inv, rollQ(P * t / rT)) }) }, line(add(top, mul(back, rT)), back, 1.6, qmul(inv, rollQ(P)))]);
    return { T: c.T, object: F.name, params: { speed: +v.toFixed(1), roll: +rT.toFixed(2) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
  }
  function barani(world, r, o = {}) {
    const F = frame(world, o.object || pick(r, OVER), r), G = loopGeo(F, r), v = range(r, 3, 6), wob = wobble(r, o.wobble ?? range(r, 0, 25));
    const wmin = range(r, 90, 180), wmax = range(r, 220, 320), yT = range(r, 0.35, 0.6), b0 = G.at(0);
    const top = { T: yT, f: t => ({ pos: G.at(P + 0.1 * t / yT), q: qmul(G.face, qmul(pitchQ(P + 0.1 * t / yT), yawQ(P * t / yT))) }) };
    const s2 = sweep(P + 0.1, 2 * P, wmin, wmax), base = qmul(G.face, qmul(pitchQ(P + 0.1), yawQ(P)));
    const down = { T: s2.T, f: t => { const th = s2.at(t), u = (th - P - 0.1) / (P - 0.1); return { pos: G.at(th), q: qmul(base, pitchQ(-P * u)) }; } };
    const qEnd = qmul(base, pitchQ(-P));
    const c = chain([line(sub(b0, mul(G.h, v)), mul(G.h, v), 1.0, G.face), arc(G, 0, P, wmin, wmax, th => pitchQ(th)), top, down, line(G.at(2 * P), mul(G.h, 3), 1.0, qEnd), hold(add(G.at(2 * P), mul(G.h, 3)), qEnd, 1.5)]);
    return { T: c.T, object: F.name, params: { speed: +v.toFixed(1), yaw: +yT.toFixed(2) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
  }
  // maverick: stays upright and forward-looking (nose up climbing, level over the top flying backward, nose down after)
  function maverick(rollAtTop) {
    return (world, r, o = {}) => {
      const F = frame(world, o.object || pick(r, OVER.filter(n => n !== 'Pilot')), r), G = loopGeo(F, r), v = range(r, 3, 6), wob = wobble(r, o.wobble ?? range(r, 0, 25));
      const nod = range(r, 1.2, 1.45), wmin = range(r, 140, 200), wmax = range(r, 200, 300);
      const mav = th => pitchQ(nod * Math.sin(th) - th + th);   // face · pitch(th) · pitch(-th + nod·sin th) = nod·sin th
      const att = th => pitchQ(nod * Math.sin(th));
      const b0 = G.at(0), segs = [line(sub(b0, mul(G.h, v)), mul(G.h, v), 1.0, G.face)];
      const arcM = (a, b) => { const sw = sweep(a, b, wmin, wmax); return { T: sw.T, f: t => { const th = sw.at(t); return { pos: G.at(th), q: qmul(G.face, att(th)) }; } }; };
      if (rollAtTop) {
        const rate = range(r, 300, 600), T = 360 / rate;
        segs.push(arcM(0, P - 0.1), { T, f: t => { const th = P - 0.1 + 0.2 * t / T; return { pos: G.at(th), q: qmul(G.face, qmul(att(th), rollQ(2 * P * t / T))) }; } }, arcM(P + 0.1, 2 * P));
      } else segs.push(arcM(0, 2 * P));
      segs.push(line(G.at(2 * P), mul(G.h, v), 1.0, G.face), hold(add(G.at(2 * P), mul(G.h, v)), G.face, 1.6));
      void mav; const c = chain(segs);
      return { T: c.T, object: F.name, params: { speed: +v.toFixed(1), nod: Math.round(nod / D) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
    };
  }
  // Blindflip ("Blind Loop"): fly at the object, yaw 180 just before it, pitch-back loop over it flying blind, forward under it
  function blindflip(world, r, o = {}) {
    const F = frame(world, o.object || pick(r, OVER.filter(n => n !== 'Pilot')), r); const hv = F.h, g = mul(hv, -1);
    const G = loopGeo({ ...F, h: g }, r), near = G.at(P / 2), fHv = faceQ(hv), wob = wobble(r, o.wobble ?? range(r, 0, 25)), v = range(r, 3, 5);
    const yaw0 = range(r, 0.3, 0.45), yawT = range(r, 0.4, 0.7);
    const appr = { T: 1.0, f: t => ({ pos: add(near, mul(hv, -v + v * t)), q: qmul(fHv, qaxis(UP, P * clamp((t - yaw0) / yawT, 0, 1))) }) };
    const sw = sweep(P / 2, 2 * P, range(r, 90, 160), range(r, 240, 320));
    const loop = { T: sw.T, f: t => { const th = sw.at(t); return { pos: G.at(th), q: qmul(G.face, pitchQ((th - P / 2) / (1.5 * P) * 2 * P)) }; } };
    const c = chain([appr, loop, line(G.at(2 * P), mul(g, 3), 1.2, G.face), hold(add(G.at(2 * P), mul(g, 3.6)), G.face, 1.2)]);
    return { T: c.T, object: F.name, params: { speed: +v.toFixed(1) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
  }
  // Matty family: over the object moving forward, pitch forward through the flip, down the far side, backward under it
  function matty(kind) {
    return (world, r, o = {}) => {
      const F = frame(world, o.object || pick(r, OVER), r), h = F.h, face = faceQ(h), wob = wobble(r, o.wobble ?? range(r, 0, 25));
      const bottom = clamp(F.under - range(r, 0.35, 0.7), 0.3, F.under - 0.12), top = F.over + range(r, 0.5, 0.9), RY = (top - bottom) / 2, Cy = (top + bottom) / 2;
      const RZ = clamp(range(r, 1.0, 2.0) * (F.name === 'Pilot' ? 0.6 : 1), 0.7, 2.2), C = v3(F.C.x, Cy, F.C.z);
      const mpos = ph => add(C, add(mul(h, -RZ * Math.sin(ph)), v3(0, -RY * Math.cos(ph), 0)));
      const v = range(r, 3, 5), T = range(r, 1.6, 2.4), topP = mpos(P);
      const att = u => {
        if (kind === 'anti') return pitchQ(2 * P * u);
        if (kind === 'twister') { const lead = clamp(u / 0.12, 0, 1), rl = clamp((u - 0.15) / 0.3, 0, 1), rest = clamp((u - 0.47) / 0.53, 0, 1); return qmul(qmul(pitchQ(-70 * D * lead), rollQ(2 * P * rl)), pitchQ(-290 * D * rest)); }
        if (kind === '360') { const a = clamp(u / 0.35, 0, 1), y = clamp((u - 0.35) / 0.3, 0, 1), b = clamp((u - 0.65) / 0.35, 0, 1); return qmul(qmul(pitchQ(-P * a), yawQ(2 * P * y)), pitchQ(-P * b)); }
        return pitchQ(-2 * P * u);
      };
      const flip = { T, f: t => { const u = t / T; return { pos: mpos(P + P * u), q: qmul(face, att(u)) }; } };
      const qEnd = qmul(face, att(1));
      const c = chain([line(sub(topP, mul(h, v * 0.75)), mul(h, v), 0.75, face), flip, line(mpos(2 * P), mul(h, -3), 1.0, qEnd), hold(add(mpos(2 * P), mul(h, -3)), qEnd, 1.4)]);
      return { T: c.T, object: F.name, params: { speed: +v.toFixed(1), flip: +T.toFixed(2) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
    };
  }
  // Split-S family: over the object, roll, then the pitch-back half loop down the far side and forward under it
  function splitS(rollDeg, extraPitch) {
    return (world, r, o = {}) => {
      const F = frame(world, o.object || pick(r, OVER.filter(n => n !== 'Pilot')), r), h = F.h, wob = wobble(r, o.wobble ?? range(r, 0, 25));
      const topY = F.over + range(r, 0.6, 1.0), botY = clamp(F.under - range(r, 0.4, 0.8), 0.4, F.under - 0.12), rad = (topY - botY) / 2;
      const rollT = Math.abs(rollDeg) / range(r, rollDeg > 200 ? 600 : 220, rollDeg > 200 ? 1000 : 700), vr = range(r, 1.8, 2.8);
      const p0 = add(v3(F.C.x, topY, F.C.z), mul(h, -2.5)), pr = add(p0, mul(h, 2.4));
      const R1 = rollQ(rollDeg * D), face = faceQ(h), cz = add(pr, mul(h, vr * rollT)), c = v3(cz.x, topY - rad, cz.z);
      const Th = range(r, 0.7, 1.1) * (extraPitch ? 1.6 : 1);
      const half = { T: Th, f: t => { const ps = P * t / Th; return { pos: add(c, add(v3(0, rad * Math.cos(ps), 0), mul(h, rad * Math.sin(ps)))), q: qmul(face, qmul(R1, pitchQ(ps * (1 + extraPitch / 180)))) }; } };
      const qEnd = qmul(face, qmul(R1, pitchQ(P * (1 + extraPitch / 180))));
      const seq = chain([line(p0, mul(h, 4), 0.6, face), { T: rollT, f: t => ({ pos: add(pr, mul(h, vr * t)), q: qmul(face, rollQ(rollDeg * D * t / rollT)) }) }, half,
        line(v3(c.x, botY, c.z), mul(h, -3), 1.8, qEnd), hold(add(v3(c.x, botY, c.z), mul(h, -5.4)), qEnd, 1.2)]);
      return { T: seq.T, object: F.name, params: { roll: +rollT.toFixed(2), half: +Th.toFixed(2) }, at: t => { const s = seq.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
    };
  }
  const pk = (axis, deg, a, b) => r => ({ axis, deg, rate: range(r, a, b) });
  const R1 = r => (r() < 0.5 ? 1 : -1);
  // trick name -> generator. Rates/pauses span the demo envelopes with margin.
  const LIB = {
    'Flip': (w, r, o) => openAir([['P', 360 * R1(r), range(r, 600, 1000)]])(w, r, o),
    'Double Flip': (w, r, o) => openAir([['P', 720 * R1(r), range(r, 650, 1000)]])(w, r, o),
    'Roll': (w, r, o) => openAir([['R', 360 * R1(r), range(r, 650, 1100)]])(w, r, o),
    'Double Roll': (w, r, o) => openAir([['R', 720 * R1(r), range(r, 650, 1100)]])(w, r, o),
    'Yaw Spin': (w, r, o) => openAir([['Y', 360 * R1(r), range(r, 330, 700)]])(w, r, o),
    'Segmented Flips/Rolls': (w, r, o) => { const ax = r() < 0.5 ? 'P' : 'R', s = R1(r), rt = range(r, 700, 1000); return openAir([[ax, 180 * s, rt], ['pause', range(r, 0.22, 0.5)], [ax, 180 * s, rt]])(w, r, o); },
    'Invert Rewind': (w, r, o) => { const ax = r() < 0.5 ? 'P' : 'R', s = R1(r), rt = range(r, 500, 900); return openAir([[ax, 180 * s, rt], [ax, -180 * s, rt]])(w, r, o); },
    'Vanny Roll': (w, r, o) => { const y = R1(r); return openAir([['Y', 180 * y, range(r, 280, 450)], ['R', 360 * R1(r), range(r, 600, 900)], ['Y', 180 * y, range(r, 280, 450)]])(w, r, o); },
    "Rubik's Cube": (w, r, o) => { const p = R1(r); return openAir([['P', 180 * p, range(r, 500, 900)], ['R', 360 * R1(r), range(r, 600, 1000)], ['P', 180 * p, range(r, 450, 900)]])(w, r, o); },
    "Cubik's Rube": (w, r, o) => { const s = R1(r); return openAir([['R', 180 * s, range(r, 600, 1000)], ['P', 360 * R1(r), range(r, 500, 900)], ['R', 180 * s, range(r, 450, 900)]])(w, r, o); },
    'Juicy Flick': (w, r, o) => openAir([['P', -180, range(r, 600, 900)], ['R', 180 * R1(r), range(r, 500, 900)]])(w, r, o),
    'Inverted Yaw Spin': (w, r, o) => { const s = R1(r); return openAir([['R', 180 * s, range(r, 600, 900)], ['Y', 360 * R1(r), range(r, 500, 750)], ['R', 180 * s, range(r, 550, 900)]])(w, r, o); },
    'Powerloop': loopTrick(null),
    'Power Flip': loopTrick(pk(X, 360, 600, 900)),
    'Reversed Power Flip': loopTrick(pk(X, -360, 600, 900)),
    'Power Roll': loopTrick(pk(ROLL, 360, 450, 900)),
    'Inverted 360 Powerloop': loopTrick(pk(YAW, 360, 450, 700)),
    'Immelmann Turn': immelmann,
    'Barani': barani,
    'Maverick Loop': maverick(false),
    'Mavvy Roll': maverick(true),
    'Blindflip': blindflip,
    'Matty Flip': matty('flip'),
    'Anti Matty': matty('anti'),
    'Matty Twister': matty('twister'),
    'Matty 360': matty('360'),
    'Split-S': splitS(180, 0),
    '540 Split S': splitS(540, 0),
    'Split-Back': splitS(180, 360),
  };
  // near-miss flights: only the listed reading (or nothing) is acceptable
  const CONFUSERS = {
    'loop beside the object (no pass under)': { ok: ['Flip'], make: (w, r, o) => {
      const m = loopTrick(null)(w, r, { ...o, object: 'Swing Set' }); const off = v3(0, 0, 0); void off;
      const side = v3(7.5, 0, 0); return { ...m, object: 'beside the Swing Set', at: t => { const s = m.at(t); return { pos: add(s.pos, side), q: s.q }; } }; } },
    'flip while passing over the bar': { ok: ['Flip'], make: (w, r) => {
      const F = frame(w, 'Swing Set', r), h = F.h, face = faceQ(h), y = F.over + 1.0, p0 = add(v3(F.C.x, y, F.C.z), mul(h, -3)), rate = range(r, 700, 1000), T = 360 / rate;
      return { T: 4, object: 'over the Swing Set', params: {}, at: t => ({ pos: add(p0, mul(h, 3.5 * t)), q: qmul(face, t > 0.75 && t < 0.75 + T ? pitchQ(-2 * P * (t - 0.75) / T) : ID) }) }; } },
    'flip near a tree (not over/under)': { ok: ['Flip'], make: (w, r) => {
      const tr = w.objs.find(o => o.name === 'Tree'), c = tr.round.c, h = v3(1, 0, 0), face = faceQ(h), p0 = add(c, v3(-6, 3, 4)), rate = range(r, 700, 1000), T = 360 / rate;
      return { T: 4, object: 'beside a Tree', params: {}, at: t => ({ pos: add(p0, mul(h, 3 * t)), q: qmul(face, t > 0.8 && t < 0.8 + T ? pitchQ(2 * P * (t - 0.8) / T) : ID) }) }; } },
  };
  // fly a scripted maneuver through a fresh detector (500 Hz, body rates from attitude differences) -> detected events
  function detect(m, world, camTilt) {
    const det = new S.TrickDetector(world); if (camTilt != null) det.camTilt = camTilt;
    const d = Object.create(S.Drone.prototype); Object.assign(d, { pos: v3(), vel: v3(), q: ID, w: v3(), armed: true, crashed: false, contactThisStep: false });
    const dt = 0.002; let prev = m.at(0); const got = [];
    for (let t = dt; t < m.T; t += dt) {
      const s = m.at(t); let q = s.q; if (q.w * prev.q.w + q.x * prev.q.x + q.y * prev.q.y + q.z * prev.q.z < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
      let r = qmul({ w: prev.q.w, x: -prev.q.x, y: -prev.q.y, z: -prev.q.z }, q); if (r.w < 0) r = { w: -r.w, x: -r.x, y: -r.y, z: -r.z };
      const sn = Math.hypot(r.x, r.y, r.z), ang = 2 * Math.atan2(sn, r.w) / dt;
      d.w = sn < 1e-9 ? v3() : v3(r.x / sn * ang, r.y / sn * ang, r.z / sn * ang);
      d.vel = mul(sub(s.pos, prev.pos), 1 / dt); d.pos = s.pos; d.q = q; prev = { pos: s.pos, q };
      det.update(d, dt, { thr: 0.5, roll: 0, pitch: 0, yaw: 0 });
      for (const e of det.drain()) if (e.name !== 'near' && e.name !== 'Crash') got.push({ name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, t });
    }
    return got;
  }
  root.Maneuvers = { _h: { chain, line, hold, sweep, pitchQ, rollQ, yawQ, faceQ, frame, loopGeo, arc, wobble, ID, X, UP, ROLL, YAW, D, P }, LIB, CONFUSERS, rng, detect, tricks: Object.keys(LIB), make: (name, world, seed, opts = {}) => { TILT_Q = qaxis(X, -(opts.tilt || 0) * D); try { return LIB[name](world, rng(seed), opts); } finally { TILT_Q = ID; } }, withTilt: (tilt, fn) => { TILT_Q = qaxis(X, -(tilt || 0) * D); try { return fn(); } finally { TILT_Q = ID; } } };
})(typeof window !== 'undefined' ? window : globalThis);
