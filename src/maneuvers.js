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
    return { T: t, at: u => tab[Math.min(tab.length - 1, Math.floor(u / dt))][1] };   // NOTE (audit): stepped every 2 ms; interpolating it exposes slow-loop misses, see docs/AUDIT.md
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
      // o.air: pilots leave some air between the segments of a trick (pilot feedback): hold the attitude for a random
      // 0..air seconds between rotations (not inside a deliberate pause)
      const steps2 = []; steps.forEach((s, i) => { if (i && o.air && s[0] !== 'pause' && steps[i - 1][0] !== 'pause') steps2.push(['pause', range(r, 0.1, 1) * o.air, true]); steps2.push(s); });
      for (const s of steps2) {
        if (s[0] === 'pause') { const T = s[2] ? s[1] : s[1] * range(r, 0.85, 1.2); parts.push({ T, q0: q, ax: null }); continue; }
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
    // Forward momentum all the way (pilot, 2026-11-17: "there should always be forward momentum with a barani"; the
    // Tricktionary GIF keeps moving with the camera tracking the object): the inverted yaw 180 happens WHILE the quad keeps
    // travelling over the top of the loop at the loop's own pace (a = half the arc it yaws across), never hanging still.
    const wmin = range(r, 90, 180), wmax = range(r, 220, 320), a = range(r, 0.3, 0.55), b0 = G.at(0);
    const sy = sweep(P - a, P + a, wmin, wmax), yT = sy.T;
    const top = { T: yT, f: t => { const th = sy.at(t), u = (th - (P - a)) / (2 * a), e = u * u * (3 - 2 * u); return { pos: G.at(th), q: qmul(G.face, qmul(pitchQ(th), yawQ(P * e))) }; } };
    const s2 = sweep(P + a, 2 * P, wmin, wmax), base = qmul(G.face, qmul(pitchQ(P + a), yawQ(P)));
    const down = { T: s2.T, f: t => { const th = s2.at(t), u = (th - P - a) / (P - a); return { pos: G.at(th), q: qmul(base, pitchQ(-P * u)) }; } };
    const qEnd = qmul(base, pitchQ(-P));
    const c = chain([line(sub(b0, mul(G.h, v)), mul(G.h, v), 1.0, G.face), arc(G, 0, P - a, wmin, wmax, th => pitchQ(th)), top, down, line(G.at(2 * P), mul(G.h, 3), 1.0, qEnd), hold(add(G.at(2 * P), mul(G.h, 3)), qEnd, 1.5)]);
    return { T: c.T, object: F.name, params: { speed: +v.toFixed(1), yaw: +yT.toFixed(2), yawArc: Math.round(2 * a / D) }, at: t => { const s = c.at(t); return { pos: s.pos, q: qmul(s.q, wob(t)) }; } };
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
  // smooth stick-like rate profile: 0 -> peak -> 0 (peak ≈ 1.6 × average)
  const ease = x => { x = clamp(x, 0, 1); return x - 0.6 * Math.sin(2 * P * x) / (2 * P); };
  // Juicy Flick as pilots really fly it: a forward flick with a throttle punch, over/under-rotated a little, the roll often
  // starting before the flick is done (blend), at anything from demo speed down to the pilot's 300-500°/s
  function juicyFlick(world, r, o = {}) {
    const a0 = range(r, 0, 2 * P), h = v3(Math.sin(a0), 0, Math.cos(a0)), face = faceQ(h), v = range(r, 1.5, 4), wob = wobble(r, o.wobble ?? range(r, 0, 25));
    const pd = range(r, 155, 205), rd = range(r, 160, 200) * (r() < 0.5 ? 1 : -1), rp = range(r, 320, 650), rr = range(r, 320, 650), blend = range(r, 0, o.blend ?? 0.45);
    const Tp = pd / rp, Tr = Math.abs(rd) / rr, tr0 = Tp * (1 - blend), lead = 0.8, Tm = Math.max(Tp, tr0 + Tr), T = lead + Tm + 1.6, p0 = add(OPEN, mul(h, -v * lead));
    return { T, object: 'open air', params: { pitch: Math.round(pd), roll: Math.round(rd), blend: +blend.toFixed(2), pitchRate: Math.round(rp), rollRate: Math.round(rr) }, at: t => {
      const u = t - lead, th = pd * ease(u / Tp), ph = rd * ease((u - tr0) / Tr);
      const surge = 0.9 * clamp(u / 0.35, 0, 1) * (u > 0 ? 1 : 0), x = v * t + surge * Math.max(0, u) * 0.5;   // punch: speeds up through the flick
      const pos = add(p0, add(mul(h, x), v3(0, 0.5 * clamp(u / (Tm + 0.2), 0, 1), 0)));
      return { pos, q: qmul(qmul(face, qmul(pitchQ(-th * D), rollQ(ph * D))), wob(t)) };
    } };
  }
  // Snapback: fly under the object, then straight away pitch back to inverted (a little throttle) and roll 180, ending upright
  // looking back at it while still drifting the way you came in
  function snapback(world, r, o = {}) {
    const F = frame(world, o.object || pick(r, o.objects || ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Tree']), r);
    const v = range(r, 2.5, 4.5), wob = wobble(r, o.wobble ?? range(r, 0, 25)), face = faceQ(F.h), h = F.h;
    const y = clamp(F.under - range(r, 0.3, 0.7), 0.35, F.under - 0.15), pass = v3(F.C.x, y, F.C.z), Ta = 1.2;
    const delay = range(r, 0.02, 0.2), pd = range(r, 170, 195), rd = range(r, 170, 195) * (r() < 0.5 ? 1 : -1), rp = range(r, 350, 650), rr = range(r, 380, 700), blend = range(r, 0, 0.25);
    const Tp = pd / rp, Tr = Math.abs(rd) / rr, tr0 = Tp * (1 - blend), Tm = delay + Math.max(Tp, tr0 + Tr), k = range(r, 1.6, 2.6), rise = range(r, 0.2, 0.7), T = Ta + Tm + 1.6;
    return { T, object: F.name, params: { speed: +v.toFixed(1), pitchRate: Math.round(rp), rollRate: Math.round(rr) }, at: t => {
      if (t < Ta) return { pos: sub(pass, mul(h, v * (Ta - t))), q: qmul(face, wob(t)) };
      const u = t - Ta, w = u - delay, th = pd * ease(w / Tp), ph = rd * ease((w - tr0) / Tr);
      const pos = add(pass, add(mul(h, v * (1 - Math.exp(-k * u)) / k), v3(0, rise * clamp(u / Tm, 0, 1), 0)));
      return { pos, q: qmul(qmul(face, qmul(pitchQ(th * D), rollQ(ph * D))), wob(t)) };
    } };
  }
  // ---- pole dancing (TPW descriptions; flown at the pilot's speeds: 150-400°/s, smooth stick, keeping the pole in view)
  function poleOf(world, name, r) {
    const cands = [];
    for (const o of world.objs) { if (o.name !== name) continue;
      if (o.kind === 'pilot') { const c = o.prims.find(p => p.type === 'sphere').c; cands.push({ x: c.x, z: c.z, y1: 1.8, name }); continue; }
      for (const p of o.prims) { if (p.type !== 'capsule' || p.r > 0.25 || p.r < 0.012) continue; const L = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y, p.b.z - p.a.z); if (L < 1.2 || Math.abs(p.b.y - p.a.y) / L < 0.8) continue;
        cands.push({ x: (p.a.x + p.b.x) / 2, z: (p.a.z + p.b.z) / 2, y1: Math.max(p.a.y, p.b.y), name }); } }
    return cands.length ? pick(r, cands) : null;
  }
  const POLES = ['Lamp Post', 'Flagpole', 'Tree', 'Pilot'];
  // a pass beside the pole along heading h at lateral offset; returns the geometry helpers
  function poleSetup(world, r, o) {
    const P = poleOf(world, o.object || pick(r, POLES), r); const a = range(r, 0, 2 * P_), h = v3(Math.sin(a), 0, Math.cos(a)), side = r() < 0.5 ? 1 : -1;
    const lat = v3(h.z * side, 0, -h.x * side), d = (o.close ? range(r, 0.35, 0.75) : range(r, 0.6, 1.2)) * (P.name === 'Pilot' ? 1.1 : 1), y = P.name === 'Pilot' ? range(r, 1.0, 1.4) : range(r, 1.1, Math.min(2.2, P.y1 - 0.5));
    const C = v3(P.x + lat.x * d, y, P.z + lat.z * d);   // closest point of the pass
    return { P, h, side, lat, d, y, C, v: range(r, 2.0, 3.4) };
  }
  const P_ = Math.PI;
  // Cradle: pass the pole, pitch back to keep it in view (up and over), the momentum swings you back, pitch forward to
  // level out and fly backward past it, looking at it the whole way
  function cradle(world, r, o = {}) {
    const g = poleSetup(world, r, { ...o, close: true }), face = faceQ(g.h), wob = wobble(r, o.wobble ?? range(r, 0, 15));
    const Ta = 1.4, pb = range(r, 120, 175), Tp = pb / range(r, 160, 320), Th = range(r, 0.15, 0.4), Tf = pb / range(r, 160, 320), back = range(r, 1.6, 2.4);
    const x = t => t < Ta ? -g.v * (Ta - t) : (() => { const u = t - Ta, T = Tp + Th + Tf, k = Math.min(u, T) / T; const out = g.v * T * 0.35 * Math.sin(Math.PI * k); return u <= T ? out : -back * (u - T); })();
    const ang = t => { const u = t - Ta; if (u < 0) return 0; if (u < Tp) return pb * ease(u / Tp); if (u < Tp + Th) return pb; return pb * (1 - ease((u - Tp - Th) / Tf)); };
    const T = Ta + Tp + Th + Tf + 1.6;
    return { T, object: g.P.name, params: { pitch: Math.round(pb), offset: +g.d.toFixed(2) }, at: t => ({ pos: add(g.C, mul(g.h, x(t))), q: qmul(qmul(face, pitchQ(ang(t) * D)), wob(t)) }) };
  }
  // Whiplash: pass the pole and whip round it — roll toward it while pitching forward, level out facing it, carried on
  // backward by the momentum, keeping it in view
  function whiplash(world, r, o = {}, g0) {
    // the camera stays on the pole the whole way: as you pass it you bank toward it and swing round (heading turns ~180°),
    // pitching forward to level out, then carry on backward away from it, still looking at it
    const g = g0 || poleSetup(world, r, o), wob = wobble(r, o.wobble ?? range(r, 0, 12)), tiltC = TILT_Q;
    const Ta = g.lead || 1.5, bank = range(r, 50, 80), Tw = range(r, 0.6, 1.1), T = Ta + Tw + (g.lead ? 1.8 : 3.4), vOut = range(r, 1.2, 2.0);
    const x = t => t < Ta ? -g.v * (Ta - t) : t < Ta + Tw ? g.v * (t - Ta) * (1 - 0.5 * (t - Ta) / Tw) : g.v * Tw * 0.5 + vOut * (t - Ta - Tw) * Math.min(1, (t - Ta - Tw) / 0.4 + 0.3);
    const pos = t => add(g.C, mul(g.h, x(t)));
    const att = t => { const p = pos(t), toP = norm(v3(g.P.x - p.x, 0, g.P.z - p.z)), k = Math.max(0, Math.min(1, (t - Ta + 0.5) / (Tw + 0.5)));
      // heading: forward before the pass, then turning to look at the pole; bank toward it in the middle of the whip
      const fwdH = norm(add(mul(g.h, 1 - ease(k)), mul(toP, ease(k) + 1e-3))), b = bank * Math.sin(Math.PI * k) * D, sd = (g.h.x * toP.z - g.h.z * toP.x) > 0 ? 1 : -1;
      return qmul(qmul(qaxis(UP, Math.atan2(-fwdH.x, -fwdH.z)), tiltC), qmul(rollQ(sd * b), pitchQ(-0.25 * Math.sin(Math.PI * k)))); };
    return { T, object: g.P.name, params: { bank: Math.round(bank), time: +Tw.toFixed(2) }, at: t => ({ pos: pos(t), q: qmul(att(t), wob(t)) }), g, Ta, Tw };
  }
  // Pole Dance: two whiplashes back to back — whip round, fly straight back at the pole past its other side, whip again
  function poleDance(world, r, o = {}) {
    const w1 = whiplash(world, r, o), g = w1.g, mid = w1.Ta + w1.Tw + 0.25;
    const g2 = { ...g, h: mul(g.h, -1), side: -g.side, C: add(g.C, mul(g.lat, -2 * g.d)), v: g.v * 0.9, lead: 0.9 }, w2 = whiplash(world, r, o, g2);
    const Tlink = 0.35, T = mid + Tlink + w2.T;
    return { T, object: g.P.name, params: { ...w1.params }, at: t => {
      if (t < mid) return w1.at(t);
      if (t < mid + Tlink) { const k = ease((t - mid) / Tlink); const a = w1.at(mid), b = w2.at(0); return { pos: add(a.pos, mul(sub(b.pos, a.pos), k)), q: k < 0.5 ? a.q : b.q }; }
      return w2.at(t - mid - Tlink); } };
  }
  // Side-Lock Rewind: pass the pole, roll 90 toward it and pitch back (knife-edge, pole in view) until you stall, blip the
  // throttle and rewind back the way you came, roll away to level out and carry on backward
  function sideLock(world, r, o = {}) {
    const g = poleSetup(world, r, o), face = faceQ(g.h), wob = wobble(r, o.wobble ?? range(r, 0, 15));
    // roll so the belly turns away from the pole and the camera (tilted up) faces it: pick the sign that does that
    const want = mul(g.lat, -1), upAfter = sg => S.qrot(qmul(face, rollQ(sg * 90 * D)), v3(0, 1, 0)), sgn = (upAfter(1).x * want.x + upAfter(1).z * want.z) > 0 ? 1 : -1;
    const Ta = 1.4, rd = range(r, 75, 100) * sgn, Tr = Math.abs(rd) / range(r, 200, 350), pd = range(r, 70, 120), Ts = range(r, 0.6, 1.0), Tb = range(r, 0.8, 1.2), T = Ta + Ts + Tb + 1.6;
    const x = t => { if (t < Ta) return -g.v * (Ta - t); const u = t - Ta; if (u < Ts) return g.v * Ts * (1 - (1 - u / Ts) ** 2) / 2; return g.v * Ts / 2 - range0 * (u - Ts) ** 1.2; };
    const range0 = g.v * 0.8;
    const att = t => { const u = t - Ta; if (u < 0) return face; const kr = ease(u / Tr), kp = ease(u / Ts), ko = ease((u - Ts - 0.3) / Tb);
      return qmul(face, qmul(rollQ(rd * (kr - ko) * D), pitchQ(pd * (kp - ko) * D))); };
    return { T, object: g.P.name, params: { roll: Math.round(rd), stall: +Ts.toFixed(2) }, at: t => ({ pos: add(g.C, mul(g.h, x(t))), q: qmul(att(t), wob(t)) }) };
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
    'Juicy Flick': juicyFlick,
    'Snapback': snapback,
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
    'Cradle': cradle,
    'Whiplash': whiplash,
    'Pole Dance': poleDance,
    'Side-Lock Rewind': sideLock,
  };
  // near-miss flights: only the listed reading (or nothing) is acceptable
  const CONFUSERS = {
    'loop beside the object (no pass under)': { ok: ['Flip', 'Powerloop@open air'], make: (w, r, o) => {
      const m = loopTrick(null)(w, r, { ...o, object: 'Swing Set' }); const off = v3(0, 0, 0); void off;
      const side = v3(7.5, 0, 0); return { ...m, object: 'beside the Swing Set', at: t => { const s = m.at(t); return { pos: add(s.pos, side), q: s.q }; } }; } },
    'flip while passing over the bar': { ok: ['Flip'], make: (w, r) => {
      const F = frame(w, 'Swing Set', r), h = F.h, face = faceQ(h), y = F.over + 1.0, p0 = add(v3(F.C.x, y, F.C.z), mul(h, -3)), rate = range(r, 700, 1000), T = 360 / rate;
      return { T: 4, object: 'over the Swing Set', params: {}, at: t => ({ pos: add(p0, mul(h, 3.5 * t)), q: qmul(face, t > 0.75 && t < 0.75 + T ? pitchQ(-2 * P * (t - 0.75) / T) : ID) }) }; } },
    'flip near a tree (not over/under)': { ok: ['Flip'], make: (w, r) => {
      const tr = w.objs.find(o => o.name === 'Tree'), c = tr.round.c, h = v3(1, 0, 0), face = faceQ(h), p0 = add(c, v3(-6, 3, 4)), rate = range(r, 700, 1000), T = 360 / rate;
      return { T: 4, object: 'beside a Tree', params: {}, at: t => ({ pos: add(p0, mul(h, 3 * t)), q: qmul(face, t > 0.8 && t < 0.8 + T ? pitchQ(2 * P * (t - 0.8) / T) : ID) }) }; } },
  };
  // cradle into a trippy round a swing-set leg, passing under the swing bar on the way in: pitch back to inverted, then the
  // orbit's coordinated roll/yaw. Pilot feedback: this kind of thing was being called a Snapback.
  CONFUSERS['trippy started under the swing bar'] = { ok: ['Trippy Spin x2', 'Orbit x2', 'Cradle'], make: (w, r) => {
    const sw = w.objs.find(o => o.name === 'Swing Set'), { a, b, under } = sw.obstacle, leg = v3(a.x, 0, a.z), u = norm(v3(b.x - a.x, 0, b.z - a.z)), n = v3(-u.z, 0, u.x);
    const R = range(r, 1.3, 1.9), y = Math.min(under - 0.4, 1.6), wv = range(r, 150, 200) * D, laps = range(r, 1.6, 2.2), Tin = 1.0, Tc = range(r, 0.4, 0.6), To = laps * 2 * P / wv;
    const start = add(add(leg, mul(u, R)), mul(n, -2.5)), entry = add(leg, mul(u, R));
    return { T: Tin + Tc + To + 1.4, object: 'swing-set leg', params: { laps: +laps.toFixed(1) }, at: t => {
      if (t < Tin) { const f = t / Tin; return { pos: v3(start.x + (entry.x - start.x) * f, y, start.z + (entry.z - start.z) * f), q: faceQ(n) }; }
      if (t < Tin + Tc) { const f = (t - Tin) / Tc, pos = add(v3(entry.x, y, entry.z), mul(n, 0.6 * f)); return { pos, q: qmul(faceQ(n), pitchQ(P * ease(f))) }; }   // cradle: pitch back to inverted, looking back at the leg
      const tt = Math.min(t - Tin - Tc, To), ang = wv * tt, c0 = Math.atan2(u.z, u.x), A = c0 + ang;
      const pos = v3(leg.x + R * Math.cos(A), y, leg.z + R * Math.sin(A)), toP = norm(v3(leg.x - pos.x, 0, leg.z - pos.z)), tang = v3(-Math.sin(A), 0, Math.cos(A));
      // inverted, facing along the orbit, leaning the pole into the top of the screen
      return { pos, q: qmul(faceQ(mul(tang, -1)), qmul(pitchQ(P), rollQ(-0.5 * Math.sign(toP.x * tang.z - toP.z * tang.x)))) };
    } };
  } };
  CONFUSERS['back-flip and roll long after passing under'] = { ok: [], make: (w, r) => {
    const F = frame(w, 'Monkey Bars', r), h = F.h, face = faceQ(h), y = F.under - 0.4, pass = v3(F.C.x, y, F.C.z), v = 3, Ta = 1.0, gap = range(r, 1.4, 2.0);
    const rp = range(r, 400, 600), rr = range(r, 400, 600), Tp = 180 / rp, Tr = 180 / rr, rs = r() < 0.5 ? 1 : -1;
    return { T: Ta + gap + Tp + Tr + 1.5, object: 'away from the Monkey Bars', params: {}, at: t => {
      const pos = add(pass, add(mul(h, v * Math.min(t - Ta, gap + 0.3) ), v3(0, 0.6 * clamp((t - Ta) / gap, 0, 1), 0))), u = t - Ta - gap;
      return { pos: t < Ta ? sub(pass, mul(h, v * (Ta - t))) : pos, q: qmul(face, qmul(pitchQ(P * ease(u / Tp)), rollQ(rs * P * ease((u - Tp) / Tr)))) };
    } };
  } };
  // a real whoop doesn't hold a rigid line: slow drift sideways, a little altitude bob, speed that surges and sags, and
  // extra attitude wobble. Applied on top of any maneuver (Judge the Bot uses it; stress --human tests it).
  function humanize(m, r, amt = 1) {
    if (!m) return m;
    const ph = () => range(r, 0, 2 * P), f1 = range(r, 0.25, 0.6), f2 = range(r, 0.15, 0.4), fb = range(r, 0.7, 1.6), fw = range(r, 0.3, 0.8);
    const p1 = ph(), p2 = ph(), pb = ph(), pw = ph(), ax = range(r, 0.08, 0.22) * amt, az = range(r, 0.08, 0.22) * amt, ab = range(r, 0.03, 0.07) * amt, aw = range(r, 0.06, 0.14) * amt;
    const wob = wobble(r, 12 * amt), wf = 2 * P * fw;
    const warp = t => t + aw / wf * (Math.sin(wf * t + pw) - Math.sin(pw));     // speed varies ±aw
    const fade = t => Math.min(1, t / 0.6, Math.max(0, (m.T - t) / 0.6));   // starts and ends where the trick says
    return { ...m, human: true, at: t => { const s = m.at(Math.max(0, Math.min(m.T, warp(t)))), k = fade(t);
      const d = v3(ax * Math.sin(2 * P * f1 * t + p1) * k, ab * Math.sin(2 * P * fb * t + pb) * k, az * Math.sin(2 * P * f2 * t + p2) * k);
      return { pos: add(s.pos, d), q: qmul(s.q, wob(t)) }; } };
  }
  // fly a scripted maneuver through a fresh detector (500 Hz, body rates from attitude differences) -> detected events
  // opt.rows: also record the flight as 100 Hz trace rows in the game's columns (Judge the Bot sends judged flights as mini
  // flights: pro-whooper-flight/1 with the judge's verdict as labels)
  function detect(m, world, camTilt, opt = {}) {
    const det = new S.TrickDetector(world); if (camTilt != null) det.camTilt = camTilt;
    const d = Object.create(S.Drone.prototype); Object.assign(d, { pos: v3(), vel: v3(), q: ID, w: v3(), armed: true, crashed: false, contactThisStep: false });
    const dt = 0.002; let prev = m.at(0); const got = [];
    // the sticks a pilot would have needed for this flight (inverse of the default rates; throttle from the thrust the path
    // needs along the body's up axis), so the Watcher's sticks witness sees the same kind of input as in the game
    const R = S.defaultTune().rates, inv = (rate, r) => { const a = Math.abs(rate); if (a < 1) return 0; let lo = 0, hi = 1;
      for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (S.applyRate(m, r, 'ACTUAL') < a) lo = m; else hi = m; } return Math.sign(rate) * hi; };
    let vPrev = null, acc = v3(), thr = 0.35, k = 0; const rows = opt.rows ? [] : null;
    for (let t = dt; t < m.T; t += dt) {
      const s = m.at(t); let q = s.q; if (q.w * prev.q.w + q.x * prev.q.x + q.y * prev.q.y + q.z * prev.q.z < 0) q = { w: -q.w, x: -q.x, y: -q.y, z: -q.z };
      let r = qmul({ w: prev.q.w, x: -prev.q.x, y: -prev.q.y, z: -prev.q.z }, q); if (r.w < 0) r = { w: -r.w, x: -r.x, y: -r.y, z: -r.z };
      const sn = Math.hypot(r.x, r.y, r.z), ang = 2 * Math.atan2(sn, r.w) / dt;
      d.w = sn < 1e-9 ? v3() : v3(r.x / sn * ang, r.y / sn * ang, r.z / sn * ang);
      d.vel = mul(sub(s.pos, prev.pos), 1 / dt); d.pos = s.pos; d.q = q; prev = { pos: s.pos, q };
      if (vPrev) { const a = mul(sub(d.vel, vPrev), 1 / dt); acc = add(mul(acc, 0.96), mul(a, 0.04)); } vPrev = d.vel;
      { const up = d.up(), need = (acc.x * up.x + (acc.y + 9.81) * up.y + acc.z * up.z) / 9.81; thr += (Math.max(0, Math.min(1, 0.35 * need)) - thr) * 0.08; }
      const pr = d.pilotRates();
      const rc = { thr, roll: inv(pr[0], R.roll), pitch: -inv(pr[1], R.pitch), yaw: inv(pr[2], R.yaw) }; det.update(d, dt, rc);
      if (rows && (k++ % 5 === 0)) { const r6 = x => Math.round(x * 1e4) / 1e4, r2 = x => Math.round(x * 100) / 100; rows.push([r6(t), r6(d.pos.x), r6(d.pos.y), r6(d.pos.z), r6(q.w), r6(q.x), r6(q.y), r6(q.z), r2(pr[0]), r2(pr[1]), r2(pr[2]), r6(thr), 0, 1, 0, 0, 0, 0, 0, 0, 0, r6(d.vel.x), r6(d.vel.y), r6(d.vel.z), r6(rc.roll), r6(rc.pitch), r6(rc.yaw)]); }
      for (const e of det.drain()) if (e.name !== 'near' && e.name !== 'Crash') got.push({ name: e.name, exec: e.exec, clean: e.clean, obstacle: e.obstacle, t, watch: e.watch });
    }
    Object.defineProperty(got, 'det', { value: det }); if (rows) Object.defineProperty(got, 'rows', { value: rows });   // for inspecting the Watcher's reviews
    return got;
  }
  // pole-dance flights built from the TPW text only (no demo measurement yet): left out of the quick suites until real reps confirm them
  const DRAFT_BOT = ['Pole Dance'];
  root.Maneuvers = { DRAFT_BOT, _h: { chain, line, hold, sweep, pitchQ, rollQ, yawQ, faceQ, frame, loopGeo, arc, wobble, ID, X, UP, ROLL, YAW, D, P }, LIB, CONFUSERS, rng, detect, tricks: Object.keys(LIB), make: (name, world, seed, opts = {}) => { TILT_Q = qaxis(X, -(opts.tilt || 0) * D); try { const m = LIB[name](world, rng(seed), opts); return opts.human ? humanize(m, rng(seed ^ 0x5bd1e995), opts.human === true ? 1 : opts.human) : m; } finally { TILT_Q = ID; } }, humanize, withTilt: (tilt, fn) => { TILT_Q = qaxis(X, -(tilt || 0) * D); try { return fn(); } finally { TILT_Q = ID; } } };
})(typeof window !== 'undefined' ? window : globalThis);
