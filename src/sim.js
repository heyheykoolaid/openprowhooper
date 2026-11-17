// Pro Whooper — simulation core (no rendering). Units: SI (m, kg, s, rad) unless noted.
// World: +Y up. Drone body frame: +X right, +Y up (thrust), -Z forward (camera).
(function (root) {
'use strict';

const RHO = 1.225, G = 9.81, D2R = Math.PI / 180, R2D = 180 / Math.PI;

// ---------------------------------------------------------------- vector / quat helpers
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = a => Math.sqrt(dot(a, a));
const norm = a => { const l = len(a) || 1; return mul(a, 1 / l); };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
// quaternion {w,x,y,z}
function qmul(a, b) {
  return { w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
           x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
           y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
           z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w };
}
function qnorm(q) { const l = Math.hypot(q.w, q.x, q.y, q.z) || 1; q.w /= l; q.x /= l; q.y /= l; q.z /= l; return q; }
function qrot(q, v) { // rotate body vector v into world
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z,
        iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return v3(ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
            iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
            iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x);
}
const qconj = q => ({ w: q.w, x: -q.x, y: -q.y, z: -q.z });
const qinv = (q, v) => qrot(qconj(q), v); // world -> body
function qaxis(axis, ang) { const s = Math.sin(ang / 2); return { w: Math.cos(ang / 2), x: axis.x * s, y: axis.y * s, z: axis.z * s }; }

// deterministic noise
function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; }; }

// ================================================================= PARTS CATALOG
// All numbers are first-pass estimates from spec sheets + typical bench data.
// They are meant to be replaced by values fitted from real Blackbox logs.
const PARTS = {
  frames: {
    air65:      { name: 'Air65 frame', size: 65, mass: 2.6, propMax: 31, ductDrag: 1.0, ductThrust: 1.06, restitution: 0.38 },
    air65champ: { name: 'Air65 Champion frame (light)', size: 65, mass: 2.2, propMax: 31, ductDrag: 0.97, ductThrust: 1.06, restitution: 0.42 },
    meteor65:   { name: 'Meteor65 Pro frame', size: 65, mass: 3.4, propMax: 31, ductDrag: 1.08, ductThrust: 1.08, restitution: 0.32 },
    air75:      { name: 'Air75 frame', size: 75, mass: 3.0, propMax: 40, ductDrag: 1.0, ductThrust: 1.06, restitution: 0.36 },
    meteor75:   { name: 'Meteor75 Pro frame', size: 75, mass: 3.9, propMax: 40, ductDrag: 1.08, ductThrust: 1.08, restitution: 0.30 },
  },
  motors: { // Rm: phase resistance (ohm), I0: no-load current (A), bearing: friction scale
    m0702se_23k: { name: '0702SE 23000KV', kv: 23000, mass: 1.9, rm: 0.55, i0: 0.12, bellJ: 2.6e-9, bearing: 1.15 },
    m0702se_27k: { name: '0702SE 27000KV', kv: 27000, mass: 1.9, rm: 0.42, i0: 0.15, bellJ: 2.6e-9, bearing: 1.15 },
    m0702ii_30k: { name: '0702 II 30000KV', kv: 30000, mass: 1.9, rm: 0.33, i0: 0.16, bellJ: 2.6e-9, bearing: 1.0 },
    m0702ii_36k: { name: '0702 II 36000KV', kv: 36000, mass: 1.9, rm: 0.24, i0: 0.19, bellJ: 2.6e-9, bearing: 1.0 },
    // RCinPower EVO 0702 (pilot's build): 1.15 g without wires, dual NMB ball bearings, 9N12P 0.1 mm laminations; published
    // 41 g (31800KV) / 43 g (33800KV) at 4.2 V on HQ 1.2x1x3 at ~5.3-5.6 A, 135 mΩ (rotorama.com). Scaled like the other
    // motors here (the sim reads ~0.8× published static thrust), so it's spicier than the stock Air65 motors
    evo_31k:     { name: 'RCinPower EVO 0702 31800KV', kv: 31800, mass: 1.45, rm: 0.28, i0: 0.17, bellJ: 2.4e-9, bearing: 0.9 },
    evo_33k:     { name: 'RCinPower EVO 0702 33800KV', kv: 33800, mass: 1.45, rm: 0.27, i0: 0.18, bellJ: 2.4e-9, bearing: 0.9 },
    m0802_19k:   { name: '0802SE 19500KV', kv: 19500, mass: 2.3, rm: 0.52, i0: 0.12, bellJ: 3.6e-9, bearing: 1.15 },
    m1002_19k:   { name: '1002 19000KV', kv: 19000, mass: 2.9, rm: 0.40, i0: 0.15, bellJ: 5.0e-9, bearing: 1.0 },
  },
  props: { // Ct/Cq: static coefficients, jmax: advance ratio where thrust ~0, mass per prop (g)
    gf1219s: { name: 'Gemfan 1219S 3-blade 31mm', d: 31, blades: 3, ct: 0.120, cq: 0.0125, jmax: 0.95, mass: 0.23 },
    hq31ul:  { name: 'HQ 31mm Ultralight 3-blade', d: 31, blades: 3, ct: 0.108, cq: 0.0108, jmax: 0.9, mass: 0.17 },
    gf1207:  { name: 'Gemfan 1207 3-blade 31mm', d: 31, blades: 3, ct: 0.097, cq: 0.0090, jmax: 0.75, mass: 0.20 },
    p40_2b:  { name: '40mm 2-blade', d: 40, blades: 2, ct: 0.095, cq: 0.0085, jmax: 0.85, mass: 0.32 },
    p40_3b:  { name: '40mm 3-blade', d: 40, blades: 3, ct: 0.112, cq: 0.0110, jmax: 0.85, mass: 0.40 },
  },
  batteries: { // r: internal resistance incl. connector (ohm) when fresh
    b260:   { name: '1S 260mAh LiHV', cap: 260, mass: 6.3, r: 0.075, hv: true },
    b300:   { name: '1S 300mAh LiHV', cap: 300, mass: 7.4, r: 0.065, hv: true },
    b380:   { name: '1S 380mAh LiHV', cap: 380, mass: 9.4, r: 0.058, hv: true },
    b450:   { name: '1S 450mAh LiPo', cap: 450, mass: 11.6, r: 0.050, hv: false },
  },
  electronics: { // AIO + VTX + RX + canopy + camera
    air:    { name: 'Air AIO 5-in-1 + C03 cam + Air canopy', mass: 5.9 },
    std:    { name: 'Standard AIO + micro cam + canopy', mass: 6.9 },
  },
};

const PRESETS = {
  'Air65 Racing':    { frame: 'air65', motor: 'm0702se_27k', prop: 'gf1219s', battery: 'b300', electronics: 'air' },
  'Air65 Freestyle': { frame: 'air65', motor: 'm0702se_23k', prop: 'hq31ul', battery: 'b300', electronics: 'air' },
  'Air65 Champion':  { frame: 'air65champ', motor: 'm0702ii_30k', prop: 'gf1219s', battery: 'b260', electronics: 'air' },
  'Air65 II Champion': { frame: 'air65champ', motor: 'm0702ii_36k', prop: 'gf1207', battery: 'b260', electronics: 'air' },
  'Air65 + RCinPower EVO': { frame: 'air65', motor: 'evo_31k', prop: 'gf1219s', battery: 'b300', electronics: 'air' },
  '75mm build':      { frame: 'air75', motor: 'm1002_19k', prop: 'p40_2b', battery: 'b450', electronics: 'air' },
};

// Betaflight-like default tune (whoop-ish). User can paste their own `diff`.
function defaultTune() {
  return {
    ratesType: 'ACTUAL',
    rates: { // ACTUAL: center (deg/s), max (deg/s), expo (0-1). BETAFLIGHT: rcRate, superRate, expo
      // pilot's request: 150 centre, 680 max, 0.5 expo on all three
      roll:  { center: 150, max: 680, expo: 0.50, rcRate: 1.0, superRate: 0.70, rcExpo: 0.0 },
      pitch: { center: 150, max: 680, expo: 0.50, rcRate: 1.0, superRate: 0.70, rcExpo: 0.0 },
      yaw:   { center: 150, max: 680, expo: 0.50, rcRate: 1.0, superRate: 0.65, rcExpo: 0.0 },
    },
    pid: {
      roll:  { p: 60, i: 80, d: 42, f: 120 },
      pitch: { p: 64, i: 84, d: 46, f: 125 },
      yaw:   { p: 60, i: 80, d: 0,  f: 120 },
    },
    idle: 0.055, airmode: true, thrMid: 0.5, thrExpo: 0.0,
    itermRelax: true, camTilt: 20, camFov: 118,
  };
}

// ================================================================= BUILD → physical params
function buildDrone(spec) {
  const fr = PARTS.frames[spec.frame], mo = PARTS.motors[spec.motor], pr = PARTS.props[spec.prop],
        ba = PARTS.batteries[spec.battery], el = PARTS.electronics[spec.electronics];
  const warnings = [];
  if (pr.d > fr.propMax) warnings.push(`${pr.name} is too big for ${fr.name} (max ${fr.propMax}mm)`);
  const arm = (fr.size / 1000) / 2 / Math.SQRT2;          // motor offset on x and z
  const mMotor = (mo.mass + pr.mass) / 1000, mFrame = fr.mass / 1000, mEl = el.mass / 1000, mBat = ba.mass / 1000;
  const mass = 4 * mMotor + mFrame + mEl + mBat;
  const rDuct = pr.d / 2000 + 0.0025;
  // inertia (diagonal) from point / simple shapes
  let Ixx = 0, Iyy = 0, Izz = 0;
  const pts = [[arm, 0, arm], [-arm, 0, arm], [arm, 0, -arm], [-arm, 0, -arm]];
  for (const [x, y, z] of pts) {
    Ixx += mMotor * (y * y + z * z); Iyy += mMotor * (x * x + z * z); Izz += mMotor * (x * x + y * y);
    const mr = mFrame / 4; // duct ring at motor
    Ixx += mr * (rDuct * rDuct / 2 + z * z); Iyy += mr * (rDuct * rDuct + x * x + z * z); Izz += mr * (rDuct * rDuct / 2 + x * x);
  }
  const s = 0.026; Ixx += mEl * (s * s / 6 + 0.008 * 0.008); Iyy += mEl * s * s / 6; Izz += mEl * (s * s / 6 + 0.008 * 0.008);
  const bl = 0.045, bh = 0.012; // battery along z
  Ixx += mBat * ((bl * bl + bh * bh) / 12 + 0.01 * 0.01); Iyy += mBat * (bl * bl + bh * bh) / 12; Izz += mBat * (bh * bh * 2 / 12 + 0.01 * 0.01);
  const D = pr.d / 1000, A = Math.PI * D * D / 4;
  const kvRad = mo.kv * 2 * Math.PI / 60;
  const propJ = (pr.mass / 1000) * (D / 2) * (D / 2) / 3.2;
  const motors = pts.map(([x, y, z], i) => ({
    pos: v3(x, 0.004, z),
    // props-in quad X: front-right & rear-left spin CCW from above (+Y), others CW
    spin: ((x > 0) === (z < 0)) ? 1 : -1,
  }));
  const p = {
    spec: { ...spec }, names: { frame: fr.name, motor: mo.name, prop: pr.name, battery: ba.name, electronics: el.name },
    warnings, mass, I: v3(Ixx, Iyy, Izz), arm, D, A, rDuct, motors,
    ct: pr.ct * fr.ductThrust, cq: pr.cq, jmax: pr.jmax,
    kvRad, kt: 1 / kvRad, rm: mo.rm, i0: mo.i0 * mo.bearing, rotorJ: mo.bellJ + propJ,
    bat: { cap: ba.cap, r: ba.r, hv: ba.hv },
    restitution: fr.restitution, friction: 0.45,
    // body drag areas (Cd*A, m^2) — ducted whoops are draggy edge-on and very draggy flat
    cdA: v3(0.0022 * fr.ductDrag * (fr.size / 65), 0.0058 * fr.ductDrag * Math.pow(fr.size / 65, 2), 0.0022 * fr.ductDrag * (fr.size / 65)),
    rotorDrag: 0.85e-6 * (pr.d / 31) * fr.ductDrag, // in-plane H-force per (rad/s * m/s)
    angDrag: 0.8e-8 * Math.pow(fr.size / 65, 4),
    colliders: [
      ...motors.map(m => ({ c: v3(m.pos.x, 0.002, m.pos.z), r: rDuct + 0.0012 })),
      { c: v3(0, 0.011, -0.002), r: 0.012 }, { c: v3(0, -0.009, 0.002), r: 0.009 },
    ],
    camPos: v3(0, 0.017, -0.017),
  };
  p.stats = staticStats(p);
  return p;
}

function ocv(soc, hv) {
  const tbl = [3.30, 3.50, 3.62, 3.68, 3.72, 3.76, 3.80, 3.85, 3.92, 4.02, 4.20];
  const x = clamp(soc, 0, 1) * 10, i = Math.min(9, Math.floor(x)), f = x - i;
  let v = tbl[i] + (tbl[i + 1] - tbl[i]) * f;
  if (hv) v += 0.15 * Math.pow(clamp(soc, 0, 1), 1.5);
  return v;
}

// steady-state motor solve at voltage V (full duty) → rpm, thrust, current
function motorSteady(p, V) {
  let w = p.kvRad * V * 0.7;
  for (let k = 0; k < 60; k++) {
    const I = (V - w / p.kvRad) / p.rm;
    const Q = p.cq * RHO * Math.pow(w / (2 * Math.PI), 2) * Math.pow(p.D, 5);
    const tau = p.kt * (I - p.i0);
    w += (tau - Q) * 4e5 * (w > 1 ? 1 : 1);
    w = Math.max(0, w);
  }
  const n = w / (2 * Math.PI);
  const T = p.ct * RHO * n * n * Math.pow(p.D, 4);
  const I = (V - w / p.kvRad) / p.rm;
  return { rpm: w * 60 / (2 * Math.PI), thrust: T, current: I };
}
function staticStats(p) {
  const V = ocv(1, p.bat.hv) - 0.4; // rough loaded voltage at full throttle
  const s = motorSteady(p, V);
  const thrustG = 4 * s.thrust / G * 1000, auwG = p.mass * 1000;
  // hover duty: bisection on duty
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; const t = motorSteady(p, (ocv(0.8, p.bat.hv) - 0.15) * mid).thrust * 4; if (t > p.mass * G) hi = mid; else lo = mid; }
  return { auw: auwG, thrust: thrustG, twr: thrustG / auwG, rpmMax: s.rpm, ampsMax: s.current * 4, hoverThrottle: hi,
           I: p.I, staticPerMotorG: s.thrust / G * 1000 };
}

// ================================================================= RATES (Betaflight math)
function applyRate(stick, r, type) {
  const a = Math.abs(stick), sgn = Math.sign(stick);
  if (type === 'BETAFLIGHT') {
    let rc = r.rcRate; if (rc > 2) rc += (rc - 2) * 14.54;
    let x = a; if (r.rcExpo) x = x * x * x * r.rcExpo + x * (1 - r.rcExpo);
    let rate = 200 * rc * x;
    if (r.superRate) rate *= 1 / clamp(1 - x * r.superRate, 0.01, 1);
    return sgn * Math.min(rate, 1998);
  }
  // ACTUAL
  const expof = a * (Math.pow(a, 5) * r.expo + a * (1 - r.expo));
  const rate = a * r.center + Math.max(0, r.max - r.center) * expof;
  return sgn * Math.min(rate, 1998);
}
function throttleCurve(t, mid, expo) {
  const tmp = t - mid, y = tmp > 0 ? tmp / (1 - mid) : tmp / mid;
  return clamp(mid + tmp * (1 - expo + expo * y * y), 0, 1);
}

// ================================================================= FLIGHT CONTROLLER
const PTERM = 0.032029, ITERM = 0.244381, DTERM = 0.000529, FFS = 0.013754;
class FlightController {
  constructor(params, tune) { this.setup(params, tune); }
  setup(params, tune) {
    this.tune = tune; this.p = params;
    // mixer from geometry: roll right(+), pitch back/nose-up(+), yaw right(+)
    this.mix = params.motors.map(m => ({ roll: m.pos.x < 0 ? 1 : -1, pitch: m.pos.z < 0 ? 1 : -1, yaw: m.spin }));
    this.reset();
  }
  reset() {
    this.i = [0, 0, 0]; this.gf = [0, 0, 0]; this.dPrev = [0, 0, 0]; this.dF = [0, 0, 0];
    this.spPrev = [0, 0, 0]; this.spF = [0, 0, 0]; this.spLp = [0, 0, 0]; this.ffF = [0, 0, 0];
    this.out = [0, 0, 0, 0]; this.sp = [0, 0, 0]; this.pidSum = [0, 0, 0];
  }
  // rc: {thr 0..1, roll,pitch,yaw -1..1}; gyro: pilot-axis rates deg/s
  update(rc, gyro, dt, armed) {
    const t = this.tune, axes = ['roll', 'pitch', 'yaw'];
    const stick = [rc.roll, rc.pitch, rc.yaw];
    const lpa = (fc) => 1 - Math.exp(-2 * Math.PI * fc * dt);
    for (let k = 0; k < 3; k++) {
      const name = axes[k];
      // pitch stick forward = nose down => setpoint pitch-back negative
      let sp = applyRate(stick[k], t.rates[name], t.ratesType);
      if (k === 1) sp = -sp;
      this.spF[k] += (sp - this.spF[k]) * lpa(40);            // RC smoothing
      this.sp[k] = this.spF[k];
      this.gf[k] += (gyro[k] - this.gf[k]) * lpa(180);          // gyro LPF
      const pid = t.pid[name];
      const err = this.sp[k] - this.gf[k];
      const P = pid.p * PTERM * err;
      // iterm relax (setpoint based)
      this.spLp[k] += (this.sp[k] - this.spLp[k]) * lpa(15);
      let iErr = err;
      if (t.itermRelax && k < 2) { const hp = Math.abs(this.sp[k] - this.spLp[k]); iErr *= Math.max(0, 1 - hp / 40); }
      if (armed) this.i[k] = clamp(this.i[k] + pid.i * ITERM * iErr * dt, -400, 400); else this.i[k] = 0;
      const dg = (this.gf[k] - this.dPrev[k]) / dt; this.dPrev[k] = this.gf[k];
      this.dF[k] += (dg - this.dF[k]) * lpa(90);
      const D = -pid.d * DTERM * this.dF[k];
      const dsp = (this.sp[k] - this.spPrev[k]) / dt; this.spPrev[k] = this.sp[k];
      this.ffF[k] += (dsp - this.ffF[k]) * lpa(30);
      const F = (pid.f / 100) * FFS * this.ffF[k];
      const lim = k === 2 ? 400 : 500;
      this.pidSum[k] = clamp(P + this.i[k] + D + F, -lim, lim);
    }
    let thr = throttleCurve(clamp(rc.thr, 0, 1), t.thrMid, t.thrExpo);
    if (!armed) { this.out = [0, 0, 0, 0]; return this.out; }
    const u = this.pidSum.map(s => s / 1000);
    const raw = this.mix.map(m => m.roll * u[0] + m.pitch * u[1] - m.yaw * u[2] * -1);
    let mn = Math.min(...raw), mx = Math.max(...raw), range = mx - mn;
    let mixS = 1;
    if (range > 1) mixS = 1 / range;
    if (t.airmode) {
      const mnS = mn * mixS, mxS = mx * mixS;
      thr = clamp(thr, -mnS, 1 - mxS);
    } else {
      mixS *= Math.min(1, thr * 4 + 0.05);
    }
    for (let i = 0; i < 4; i++) {
      const m = clamp(thr + raw[i] * mixS, 0, 1);
      this.out[i] = t.idle + (1 - t.idle) * m;
    }
    return this.out;
  }
}

// ================================================================= COLLISION WORLD
// primitives: box {c, h(half), rot(yaw rad, optional tilt rx)}, capsule {a,b,r}, ground
function makeBox(c, h, ry = 0, rx = 0, rz = 0) {
  // rotation matrix from euler (Y * X * Z)
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Ry * Rx * Rz
  const m = [
    cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
  const ext = Math.abs(m[0]) * h.x + Math.abs(m[1]) * h.y + Math.abs(m[2]) * h.z,
        eyy = Math.abs(m[3]) * h.x + Math.abs(m[4]) * h.y + Math.abs(m[5]) * h.z,
        ezz = Math.abs(m[6]) * h.x + Math.abs(m[7]) * h.y + Math.abs(m[8]) * h.z;
  return { type: 'box', c, h, m, euler: [rx, ry, rz], aabb: { min: v3(c.x - ext, c.y - eyy, c.z - ezz), max: v3(c.x + ext, c.y + eyy, c.z + ezz) } };
}
function makeCapsule(a, b, r) {
  return { type: 'capsule', a, b, r, aabb: { min: v3(Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.min(a.z, b.z) - r), max: v3(Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, Math.max(a.z, b.z) + r) } };
}
function makeSphere(c, r) { return { type: 'sphere', c, r, aabb: { min: v3(c.x - r, c.y - r, c.z - r), max: v3(c.x + r, c.y + r, c.z + r) } }; }

function sphereVs(prim, p, r) { // returns {n, d, pt} or null
  if (prim.type === 'box') {
    const m = prim.m, d = sub(p, prim.c);
    // local = R^T d
    const lx = m[0] * d.x + m[3] * d.y + m[6] * d.z, ly = m[1] * d.x + m[4] * d.y + m[7] * d.z, lz = m[2] * d.x + m[5] * d.y + m[8] * d.z;
    const h = prim.h;
    const cx = clamp(lx, -h.x, h.x), cy = clamp(ly, -h.y, h.y), cz = clamp(lz, -h.z, h.z);
    let nx = lx - cx, ny = ly - cy, nz = lz - cz, dist = Math.hypot(nx, ny, nz), pen;
    if (dist > 1e-9) { if (dist >= r) return null; nx /= dist; ny /= dist; nz /= dist; pen = r - dist; }
    else { // center inside: push out along min axis
      const dx = h.x - Math.abs(lx), dy = h.y - Math.abs(ly), dz = h.z - Math.abs(lz);
      if (dx < dy && dx < dz) { nx = Math.sign(lx) || 1; ny = 0; nz = 0; pen = dx + r; }
      else if (dy < dz) { nx = 0; ny = Math.sign(ly) || 1; nz = 0; pen = dy + r; }
      else { nx = 0; ny = 0; nz = Math.sign(lz) || 1; pen = dz + r; }
    }
    const n = v3(m[0] * nx + m[1] * ny + m[2] * nz, m[3] * nx + m[4] * ny + m[5] * nz, m[6] * nx + m[7] * ny + m[8] * nz);
    return { n, d: pen, pt: sub(p, mul(n, r)) };
  }
  if (prim.type === 'capsule') {
    const ab = sub(prim.b, prim.a), t = clamp(dot(sub(p, prim.a), ab) / (dot(ab, ab) || 1), 0, 1);
    const q = add(prim.a, mul(ab, t)), dv = sub(p, q), dist = len(dv), rr = r + prim.r;
    if (dist >= rr) return null;
    const n = dist > 1e-9 ? mul(dv, 1 / dist) : v3(0, 1, 0);
    return { n, d: rr - dist, pt: add(q, mul(n, prim.r)) };
  }
  if (prim.type === 'sphere') {
    const dv = sub(p, prim.c), dist = len(dv), rr = r + prim.r;
    if (dist >= rr) return null;
    const n = dist > 1e-9 ? mul(dv, 1 / dist) : v3(0, 1, 0);
    return { n, d: rr - dist, pt: add(prim.c, mul(n, prim.r)) };
  }
  return null;
}

// ================================================================= MAP: the playground
// Each object: { id, name, kind, tags, prims:[...], visual:[...], obstacle?, gap?, wallNormal? }
// visual entries are consumed by the renderer: {shape:'box'|'cyl'|'sphere'|..., mat, ...}
function buildPlayground() {
  const objs = []; let nid = 0;
  const O = (name, kind, extra = {}) => { const o = { id: nid++, name, kind, prims: [], vis: [], ...extra }; objs.push(o); return o; };
  const box = (o, c, h, mat, ry = 0, rx = 0, rz = 0, opts = {}) => { const b = makeBox(c, h, ry, rx, rz); if (!opts.noCollide) o.prims.push(b); o.vis.push({ shape: 'box', c, h, mat, euler: [rx, ry, rz], ...opts }); return b; };
  const pipe = (o, a, b, r, mat, opts = {}) => { o.prims.push(makeCapsule(a, b, r)); o.vis.push({ shape: 'pipe', a, b, r, mat, ...opts }); };
  const ball = (o, c, r, mat, opts = {}) => { if (!opts.noCollide) o.prims.push(makeSphere(c, r)); o.vis.push({ shape: 'sphere', c, r, mat, ...opts }); };

  // ---- Building (north) — 14m tall brick, flat roof with parapet (perch spot)
  const bld = O('Brick Building', 'building', { wallNormal: v3(0, 0, 1), tall: 14 });
  box(bld, v3(0, 7, -27), v3(16, 7, 5), 'brick', 0, 0, 0, { graffiti: 'south' });
  box(bld, v3(0, 14.4, -22.15), v3(16, 0.4, 0.15), 'concrete');
  box(bld, v3(0, 14.4, -31.85), v3(16, 0.4, 0.15), 'concrete');
  box(bld, v3(-15.85, 14.4, -27), v3(0.15, 0.4, 5), 'concrete');
  box(bld, v3(15.85, 14.4, -27), v3(0.15, 0.4, 5), 'concrete');
  box(bld, v3(-6, 15.2, -27), v3(1.2, 1.2, 1.2), 'metal', 0, 0, 0, { label: 'hvac' }); // rooftop unit
  pipe(bld, v3(9, 0, -21.9), v3(9, 14.2, -21.9), 0.05, 'rust'); // drain pipe
  bld.perchHeight = 14;

  // ---- Concrete graffiti wall (west) with a slot gap
  const wall = O('Graffiti Wall', 'wall', { wallNormal: v3(1, 0, 0) });
  const wx = -19, gz = 4, gw = 0.11, gy0 = 0.85, gy1 = 1.35;
  box(wall, v3(wx, 1.6, (-20 + (gz - gw)) / 2), v3(0.2, 1.6, ((gz - gw) + 20) / 2), 'concrete', 0, 0, 0, { graffiti: 'east' });
  box(wall, v3(wx, 1.6, ((gz + gw) + 20) / 2), v3(0.2, 1.6, (20 - (gz + gw)) / 2), 'concrete', 0, 0, 0, { graffiti: 'east' });
  box(wall, v3(wx, gy0 / 2, gz), v3(0.2, gy0 / 2, gw), 'concrete');
  box(wall, v3(wx, (gy1 + 3.2) / 2, gz), v3(0.2, (3.2 - gy1) / 2, gw), 'concrete');
  const slot = O('Wall Slot', 'gap', { gap: { c: v3(wx, (gy0 + gy1) / 2, gz), n: v3(1, 0, 0), hu: gw, hv: (gy1 - gy0) / 2, u: v3(0, 0, 1) } });

  // ---- Chain-link fence (east & south) — thin colliders
  const fence = O('Fence', 'fence');
  for (const [a, b] of [[v3(18, 0, -20), v3(18, 0, 20)], [v3(-19, 0, 20), v3(18, 0, 20)]]) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    box(fence, v3((a.x + b.x) / 2, 1.25, (a.z + b.z) / 2), v3(0.02, 1.25, L / 2), 'chainlink', ry, 0, 0, { alpha: true });
    const n = Math.round(L / 2.5);
    for (let i = 0; i <= n; i++) { const t = i / n; pipe(fence, v3(a.x + dx * t, 0, a.z + dz * t), v3(a.x + dx * t, 2.55, a.z + dz * t), 0.03, 'galv'); }
    pipe(fence, v3(a.x, 2.5, a.z), v3(b.x, 2.5, b.z), 0.02, 'galv');
  }

  // ---- Swing set (over/under obstacle)
  const sw = O('Swing Set', 'overunder', { obstacle: { a: v3(-3, 0, -6), b: v3(3, 0, -6), under: 2.32, over: 2.46 } });
  const topY = 2.4;
  pipe(sw, v3(-3.1, topY, -6), v3(3.1, topY, -6), 0.035, 'paintRed');
  for (const x of [-3, 3]) { pipe(sw, v3(x, 0, -7.1), v3(x, topY, -6), 0.035, 'paintRed'); pipe(sw, v3(x, 0, -4.9), v3(x, topY, -6), 0.035, 'paintRed'); }
  for (const x of [-1.8, 0, 1.8]) {
    for (const dx of [-0.22, 0.22]) pipe(sw, v3(x + dx, topY, -6), v3(x + dx, 0.5, -6), 0.006, 'chain');
    box(sw, v3(x, 0.48, -6), v3(0.24, 0.02, 0.09), 'rubberBlack');
  }

  // ---- Slide tower (over/under: under deck, over roof)
  const sl = O('Slide Tower', 'overunder', { obstacle: { a: v3(-8.7, 0, 2), b: v3(-7.3, 0, 2), under: 1.42, over: 2.95 } });
  for (const [x, z] of [[-8.6, 1.4], [-7.4, 1.4], [-8.6, 2.6], [-7.4, 2.6]]) pipe(sl, v3(x, 0, z), v3(x, 2.6, z), 0.045, 'paintBlue');
  box(sl, v3(-8, 1.5, 2), v3(0.6, 0.04, 0.6), 'metalPlate');
  box(sl, v3(-8, 2.75, 2), v3(0.75, 0.15, 0.75), 'plasticYellow', 0, 0, 0, { roof: true });
  const sLen = 3.3, sAng = Math.atan2(1.5, 2.9);
  box(sl, v3(-7.4 + 1.45, 0.78, 2), v3(sLen / 2, 0.03, 0.27), 'metalSlide', Math.PI / 2, 0, 0, { tiltZ: -sAng });
  // override with proper tilt: slide goes down toward +x
  sl.prims.pop(); sl.vis.pop();
  box(sl, v3(-7.4 + 1.45, 0.78, 2), v3(sLen / 2, 0.03, 0.27), 'metalSlide', 0, 0, -sAng, { graffiti: 'top' });
  box(sl, v3(-7.4 + 1.45, 0.92, 1.73), v3(sLen / 2, 0.12, 0.02), 'metalSlide', 0, 0, -sAng);
  box(sl, v3(-7.4 + 1.45, 0.92, 2.27), v3(sLen / 2, 0.12, 0.02), 'metalSlide', 0, 0, -sAng);
  for (let i = 1; i <= 5; i++) pipe(sl, v3(-8.65, i * 0.27, 1.75), v3(-8.65, i * 0.27, 2.25), 0.02, 'galv');

  // ---- Monkey bars (over/under along z)
  const mb = O('Monkey Bars', 'overunder', { obstacle: { a: v3(8, 0, 0.2), b: v3(8, 0, 3.8), under: 2.02, over: 2.18 } });
  for (const x of [7.6, 8.4]) {
    pipe(mb, v3(x, 2.1, 0), v3(x, 2.1, 4), 0.03, 'paintGreen');
    for (const z of [0, 4]) pipe(mb, v3(x, 0, z), v3(x, 2.1, z), 0.035, 'paintGreen');
  }
  for (let z = 0.35; z < 4; z += 0.38) pipe(mb, v3(7.6, 2.1, z), v3(8.4, 2.1, z), 0.016, 'galv');

  // ---- Jungle gym cube (over/under through bottom bay)
  const jg = O('Jungle Gym', 'overunder', { obstacle: { a: v3(7, 0, -8), b: v3(9.2, 0, -8), under: 1.02, over: 2.28 } });
  const J0 = v3(7, 0, -9.1), S = 2.2;
  const jp = (a, b) => pipe(jg, a, b, 0.025, 'paintOrange');
  for (const dx of [0, S]) for (const dz of [0, S]) jp(v3(J0.x + dx, 0, J0.z + dz), v3(J0.x + dx, S, J0.z + dz));
  for (const y of [1.1, S]) {
    jp(v3(J0.x, y, J0.z), v3(J0.x + S, y, J0.z)); jp(v3(J0.x, y, J0.z + S), v3(J0.x + S, y, J0.z + S));
    jp(v3(J0.x, y, J0.z), v3(J0.x, y, J0.z + S)); jp(v3(J0.x + S, y, J0.z), v3(J0.x + S, y, J0.z + S));
  }
  jp(v3(J0.x, S, J0.z + S / 2), v3(J0.x + S, S, J0.z + S / 2));

  // ---- Basketball hoop (pole + backboard + ring gap)
  // flagpole: tall, thin and in the open (7 m clear all round) for orbits, trippies and pole dancing
  const fp = O('Flagpole', 'pole');
  box(fp, v3(0, 0.12, -14.5), v3(0.35, 0.12, 0.35), 'concrete');
  pipe(fp, v3(0, 0.24, -14.5), v3(0, 9.0, -14.5), 0.055, 'galv');
  pipe(fp, v3(0, 9.0, -14.5), v3(0, 9.12, -14.5), 0.09, 'plasticYellow', { noCollide: true });
  box(fp, v3(0.62, 8.3, -14.5), v3(0.55, 0.36, 0.008), 'paintRed', 0, 0, 0, { noCollide: true, flag: true });
  const hp = O('Hoop Pole', 'pole');
  pipe(hp, v3(-11, 0, -14.2), v3(-11, 3.4, -14.2), 0.06, 'paintBlue');
  pipe(hp, v3(-11, 3.3, -14.2), v3(-11, 3.3, -13.4), 0.04, 'paintBlue');
  box(hp, v3(-11, 3.35, -13.35), v3(0.9, 0.53, 0.02), 'backboard', 0, 0, 0, { graffiti: 'south' });
  const rim = O('Hoop', 'gap', { gap: { c: v3(-11, 3.05, -12.95), n: v3(0, 1, 0), hu: 0.21, hv: 0.21, u: v3(1, 0, 0), round: true } });
  for (let i = 0; i < 14; i++) {
    const a0 = i / 14 * Math.PI * 2, a1 = (i + 1) / 14 * Math.PI * 2;
    pipe(rim, v3(-11 + Math.cos(a0) * 0.23, 3.05, -12.95 + Math.sin(a0) * 0.23), v3(-11 + Math.cos(a1) * 0.23, 3.05, -12.95 + Math.sin(a1) * 0.23), 0.009, 'rimOrange');
  }

  // ---- Lamp posts (poles)
  for (const [x, z] of [[-14, -16], [14, -16], [14, 14], [-14, 14]]) {
    const lp = O('Lamp Post', 'pole', { light: v3(x, 5.6, z) });
    pipe(lp, v3(x, 0, z), v3(x, 5.6, z), 0.07, 'galv');
    box(lp, v3(x, 5.7, z), v3(0.25, 0.08, 0.15), 'lampHead');
  }

  // ---- Benches, picnic table, bins, dumpster, tires, cones, trees
  const bench = (x, z, ry) => {
    const b = O('Bench', 'overunder', { obstacle: { a: v3(x - Math.cos(ry) * 0.9, 0, z + Math.sin(ry) * 0.9), b: v3(x + Math.cos(ry) * 0.9, 0, z - Math.sin(ry) * 0.9), under: 0.38, over: 0.52 } });
    box(b, v3(x, 0.45, z), v3(0.95, 0.03, 0.22), 'wood', ry);
    box(b, v3(x - Math.cos(ry) * 0.8, 0.22, z + Math.sin(ry) * 0.8), v3(0.04, 0.22, 0.2), 'concrete', ry);
    box(b, v3(x + Math.cos(ry) * 0.8, 0.22, z - Math.sin(ry) * 0.8), v3(0.04, 0.22, 0.2), 'concrete', ry);
  };
  bench(-3, 9, 0); bench(4, 10, 0.3); bench(12, -2, Math.PI / 2);
  const pt = O('Picnic Table', 'overunder', { obstacle: { a: v3(-3, 0, 14), b: v3(0, 0, 14), under: 0.66, over: 0.82 } });
  box(pt, v3(-1.5, 0.74, 14), v3(1.5, 0.04, 0.4), 'wood', 0, 0, 0, { graffiti: 'top' });
  for (const z of [13.35, 14.65]) box(pt, v3(-1.5, 0.44, z), v3(1.5, 0.03, 0.14), 'wood');
  for (const x of [-2.8, -0.2]) for (const z of [13.6, 14.4]) box(pt, v3(x, 0.37, z), v3(0.04, 0.37, 0.04), 'wood');
  for (const [x, z] of [[-5, -2], [5, 6], [-15, 10]]) { const t = O('Trash Can', 'deco'); pipe(t, v3(x, 0.3, z), v3(x, 0.62, z), 0.28, 'bin'); }
  const dm = O('Dumpster', 'overunder', { wallNormal: v3(0, 0, 1) });
  box(dm, v3(10, 0.65, -20.6), v3(1.6, 0.65, 0.85), 'dumpster', 0, 0, 0, { graffiti: 'south' });
  for (const [x, z] of [[2.5, 3], [3.4, 3.2]]) { const t = O('Tire', 'deco'); pipe(t, v3(x - 0.25, 0.15, z), v3(x + 0.25, 0.15, z), 0.15, 'tire'); }
  for (const [x, z] of [[-2, 0], [-1, 1.5], [0, 3], [1, 4.5]]) { const c = O('Cone', 'deco'); pipe(c, v3(x, 0.02, z), v3(x, 0.35, z), 0.08, 'cone', { cone: true }); }
  for (const [x, z, s] of [[14, 8, 1], [-15, -6, 1.2], [13, -11, 0.9]]) {
    const tr = O('Tree', 'pole');
    // the Tricktionary's favourite obstacle: loops, Mattys, Split-S and mavericks go under the canopy and over the top.
    // Round, so the over/under line is re-aimed across the approach direction (see trackCrossings).
    tr.round = { c: v3(x, 0, z), r: 2.0 * s, under: 2.6 * s, over: 5.8 * s };
    tr.obstacle = { a: v3(x - 2.0 * s, 0, z), b: v3(x + 2.0 * s, 0, z), under: 2.6 * s, over: 5.8 * s };
    pipe(tr, v3(x, 0, z), v3(x, 3.2 * s, z), 0.16 * s, 'bark');
    ball(tr, v3(x, 4.2 * s, z), 1.5 * s, 'leaves'); ball(tr, v3(x + 0.9 * s, 3.7 * s, z + 0.3), 1.0 * s, 'leaves'); ball(tr, v3(x - 0.7 * s, 3.8 * s, z - 0.6), 1.1 * s, 'leaves');
  }
  // ---- Covered walkway (pilot's photo): yellow posts on concrete footings, curved yellow beams, a corrugated roof that
  // overhangs both sides, over a concrete path. Fly down the tunnel, slalom the posts, or loop the roof edge (over/under).
  { const wk = O('Covered Walkway', 'overunder', { obstacle: { a: v3(-13, 0, 17.5), b: v3(-3, 0, 17.5), under: 2.45, over: 3.25 } });
    const ZC = 17.5, HW = 1.2, EAVE = 2.6, RISE = 0.45, W2 = 1.65, R = (W2 * W2 + RISE * RISE) / (2 * RISE), Y0 = EAVE + RISE - R, F0 = Math.asin(W2 / R);
    const arc = f => v3(0, Y0 + R * Math.cos(f), ZC + R * Math.sin(f));
    for (let i = 0; i < 5; i++) { const x = -13 + i * 2.5;
      for (const sg of [-1, 1]) { const z = ZC + sg * HW; box(wk, v3(x, 0.18, z), v3(0.17, 0.18, 0.17), 'concrete'); pipe(wk, v3(x, 0.36, z), v3(x, arc(sg * Math.asin(HW / R)).y, z), 0.045, 'plasticYellow'); }
      for (let k = 0; k < 6; k++) { const a = arc(-F0 + 2 * F0 * k / 6), b = arc(-F0 + 2 * F0 * (k + 1) / 6); pipe(wk, v3(x, a.y - 0.05, a.z), v3(x, b.y - 0.05, b.z), 0.04, 'plasticYellow'); } }
    for (const f of [-F0 * 0.6, 0, F0 * 0.6]) { const a = arc(f); pipe(wk, v3(-13.3, a.y - 0.02, a.z), v3(-2.7, a.y - 0.02, a.z), 0.02, 'galv'); }
    for (let k = 0; k < 6; k++) { const f = -F0 + 2 * F0 * (k + 0.5) / 6, c = arc(f); box(wk, v3(-8, c.y + 0.02, c.z), v3(5.4, 0.012, R * Math.sin(F0 / 6) + 0.01), 'metalPlate', 0, f, 0, { roof: true }); }
    const lf = O('Walkway Lamp', 'deco'); ball(lf, v3(-8, EAVE + RISE - 0.3, ZC), 0.07, 'lampHead', { noCollide: true }); }
  // ---- the pilot (you), standing by the spawn with goggles on — fly into the face for a Facepunch
  const pl = O('Pilot', 'pilot'); const PX = 2.6, PZ = 14.2;
  // wide stance (as in the demos): fly between the legs (Immelmann, Power Swap demos) or over the head
  pipe(pl, v3(PX - 0.36, 0, PZ), v3(PX - 0.1, 0.88, PZ), 0.07, 'jeans'); pipe(pl, v3(PX + 0.36, 0, PZ), v3(PX + 0.1, 0.88, PZ), 0.07, 'jeans');
  pl.obstacle = { a: v3(PX - 0.26, 0, PZ), b: v3(PX + 0.26, 0, PZ), under: 0.55, over: 1.95 };
  pipe(pl, v3(PX, 0.9, PZ), v3(PX, 1.42, PZ), 0.19, 'hoodie');
  pipe(pl, v3(PX - 0.24, 1.38, PZ), v3(PX - 0.14, 1.12, PZ - 0.28), 0.05, 'hoodie'); pipe(pl, v3(PX + 0.24, 1.38, PZ), v3(PX + 0.14, 1.12, PZ - 0.28), 0.05, 'hoodie');
  box(pl, v3(PX, 1.13, PZ - 0.33), v3(0.13, 0.08, 0.05), 'radio');
  ball(pl, v3(PX, 1.66, PZ), 0.12, 'skin');
  box(pl, v3(PX, 1.69, PZ - 0.1), v3(0.11, 0.045, 0.05), 'goggles', 0, 0, 0, { noCollide: true });
  pipe(pl, v3(PX, 1.74, PZ + 0.02), v3(PX, 1.8, PZ + 0.02), 0.115, 'hoodie', { noCollide: true });
  // ground zones (visual only)
  const zones = [
    { shape: 'zone', mat: 'rubberMat', c: v3(0, 0.006, -1), h: v3(11, 0, 9) },
    { shape: 'zone', mat: 'sand', c: v3(8, 0.012, 2), h: v3(1.6, 0, 2.6) },
    { shape: 'zone', mat: 'court', c: v3(-11, 0.009, -11), h: v3(6, 0, 5) },
    { shape: 'zone', mat: 'concrete', c: v3(-8, 0.01, 17.5), h: v3(5.6, 0, 1.0) },
  ];
  const all = []; for (const o of objs) for (const p of o.prims) { p.owner = o.id; all.push(p); }
  return { objs, prims: all, zones, spawn: { pos: v3(0, 0.03, 12), yaw: 0 }, bounds: { x: [-19, 18], z: [-22, 20] } };
}

// ================================================================= DRONE PHYSICS
class Drone {
  constructor(params, tune, world) {
    this.world = world; this.rng = makeRng(1234);
    this.setParams(params, tune);
    this.reset(world.spawn);
  }
  setParams(params, tune) {
    this.p = params; this.tune = tune;
    if (!this.fc) this.fc = new FlightController(params, tune); else this.fc.setup(params, tune);
  }
  reset(sp, keepBattery = false) {
    this.pos = v3(sp.pos.x, sp.pos.y + 0.02, sp.pos.z); this.vel = v3();
    this.q = qaxis(v3(0, 1, 0), sp.yaw || 0); this.w = v3(); // body rates rad/s
    this.motorW = [0, 0, 0, 0]; this.motorI = [0, 0, 0, 0]; this.thrust = [0, 0, 0, 0];
    if (!keepBattery) { this.soc = 1; this.mAh = 0; }
    this.vbat = ocv(this.soc, this.p.bat.hv); this.ibat = 0;
    this.armed = false; this.crashed = false; this.contacts = []; this.contactThisStep = false;
    this.noise = [0, 0, 0, 0]; this.washLevel = 0; this.wake = []; this.wakeTimer = 0; this.time = this.time || 0;
    this.fc.reset(); this.restOnGround = 0; this.lastImpact = 0; this.lowSpeedContact = 0;
  }
  up() { return qrot(this.q, v3(0, 1, 0)); }
  fwd() { return qrot(this.q, v3(0, 0, -1)); }
  right() { return qrot(this.q, v3(1, 0, 0)); }
  pilotRates() { return [-this.w.z * R2D, this.w.x * R2D, -this.w.y * R2D]; } // roll right, pitch back, yaw right

  step(rc, dt) {
    const p = this.p; this.time += dt;
    this.contactThisStep = false;
    // ---- flight controller
    const out = this.fc.update(rc, this.pilotRates(), dt, this.armed && !this.crashed);
    // ---- motors + battery
    const up = this.up(), wWorld = qrot(this.q, this.w);
    const Rint = p.bat.r * (1 + 0.9 * Math.pow(1 - this.soc, 3));
    const Vocv = ocv(this.soc, p.bat.hv);
    const Vbus = Math.max(2.5, Vocv - this.ibat * Rint);
    let Itot = 0.35; // electronics/VTX
    const Fb = v3(), Tb = v3();
    let rotorAccelYaw = 0;
    // air relative velocity incl. wake
    const air = this.sampleWake();
    this.washLevel += (air.turb - this.washLevel) * 0.05;
    const vRelW = sub(this.vel, air.v);
    const vRelB = qinv(this.q, vRelW);
    let sumW = 0;
    // ground effect: height under thrust axis (approx world-down to ground or top surfaces)
    const hGround = this.heightAbove();
    for (let i = 0; i < 4; i++) {
      const m = p.motors[i];
      const duty = out[i] || 0;
      let w = this.motorW[i];
      const Vm = duty * Vbus;
      let I = (Vm - w / p.kvRad) / p.rm;
      I = clamp(I, -4, 12);
      const n = w / (2 * Math.PI);
      const Q = p.cq * RHO * n * n * Math.pow(p.D, 5) + p.i0 * p.kt * Math.sign(w);
      const tau = p.kt * I;
      const dw = (tau - Q) / p.rotorJ;
      w = Math.max(0, w + dw * dt);
      this.motorW[i] = w; this.motorI[i] = I;
      Itot += Math.max(0, I * duty);
      rotorAccelYaw += -m.spin * p.rotorJ * dw; // reaction of spinning-up rotor on frame (about body Y)
      // prop velocity (body) at motor location
      const vp = add(vRelB, cross(this.w, m.pos));
      const vAx = vp.y; // + means moving along thrust direction (climbing)
      const nn = Math.max(n, 1);
      const J = vAx / (nn * p.D);
      let ctF = J >= 0 ? clamp(1 - J / p.jmax, 0, 1) : clamp(1 - 0.35 * J, 1, 1.25);
      // translational lift (edgewise flow) small gain
      const vIn = Math.hypot(vp.x, vp.z);
      let T = p.ct * RHO * n * n * Math.pow(p.D, 4) * ctF;
      const vi = Math.sqrt(Math.max(T, 1e-6) / (2 * RHO * p.A));
      T *= 1 + 0.08 * Math.min(1, vIn / (vi + 0.5));
      // vortex ring state / propwash when descending into own wash
      const desc = -vAx;
      let vrs = 0;
      if (desc > 0.15 * vi) {
        const x = desc / (vi + 1e-3);
        vrs = Math.exp(-Math.pow((x - 0.75) / 0.45, 2)) * clamp(1 - vIn / (1.6 * vi + 0.5), 0, 1);
      }
      const turb = clamp(vrs + air.turb, 0, 1.6);
      // filtered noise per motor (~25Hz band)
      this.noise[i] += (this.rng() * 1.7 - this.noise[i]) * (1 - Math.exp(-2 * Math.PI * 25 * dt));
      T *= (1 - 0.22 * vrs) * (1 + 0.38 * turb * this.noise[i]);
      // ground effect (Cheeseman-Bennett), only when roughly upright over a surface
      if (hGround < 3 * p.D && up.y > 0.5) { const r = p.D / 2, h = Math.max(hGround, r * 0.6); T *= clamp(1 / (1 - Math.pow(r / (4 * h), 2)), 1, 1.25); }
      T = Math.max(0, T);
      this.thrust[i] = T;
      sumW += w;
      Fb.y += T;
      const tq = cross(m.pos, v3(0, T, 0));
      Tb.x += tq.x; Tb.y += tq.y; Tb.z += tq.z;
      Tb.y += -m.spin * (p.cq * RHO * n * n * Math.pow(p.D, 5));
    }
    Tb.y += rotorAccelYaw;
    this.ibat = Itot; this.vbat = Vbus;
    this.soc = Math.max(0, this.soc - Itot * dt / (p.bat.cap * 3.6));
    this.mAh += Itot * dt / 3.6;
    // ---- aerodynamic drag (body frame, quadratic) + rotor H-force (linear)
    const vb = vRelB;
    Fb.x += -0.5 * RHO * p.cdA.x * Math.abs(vb.x) * vb.x - p.rotorDrag * sumW * vb.x;
    Fb.y += -0.5 * RHO * p.cdA.y * Math.abs(vb.y) * vb.y;
    Fb.z += -0.5 * RHO * p.cdA.z * Math.abs(vb.z) * vb.z - p.rotorDrag * sumW * vb.z;
    Tb.x += -p.angDrag * this.w.x * Math.abs(this.w.x) * 1000; Tb.y += -p.angDrag * this.w.y * Math.abs(this.w.y) * 600; Tb.z += -p.angDrag * this.w.z * Math.abs(this.w.z) * 1000;
    // ---- integrate
    const Fw = qrot(this.q, Fb); Fw.y -= p.mass * G;
    this.vel = add(this.vel, mul(Fw, dt / p.mass));
    const I = p.I, w = this.w;
    const Iw = v3(I.x * w.x, I.y * w.y, I.z * w.z), gyro = cross(w, Iw);
    this.w = v3(w.x + (Tb.x - gyro.x) / I.x * dt, w.y + (Tb.y - gyro.y) / I.y * dt, w.z + (Tb.z - gyro.z) / I.z * dt);
    this.pos = add(this.pos, mul(this.vel, dt));
    const dq = qmul(this.q, { w: 0, x: this.w.x, y: this.w.y, z: this.w.z });
    this.q = qnorm({ w: this.q.w + 0.5 * dq.w * dt, x: this.q.x + 0.5 * dq.x * dt, y: this.q.y + 0.5 * dq.y * dt, z: this.q.z + 0.5 * dq.z * dt });
    // ---- wake shedding
    this.wakeTimer += dt;
    if (this.wakeTimer > 0.012 && this.armed) {
      this.wakeTimer = 0;
      const Tt = this.thrust.reduce((a, b) => a + b, 0);
      const vi = Math.sqrt(Math.max(Tt, 1e-6) / (2 * RHO * p.A * 4));
      const strength = clamp(Tt / (p.mass * G * 2.2), 0, 1.2);
      if (strength > 0.05) this.wake.push({ p: v3(this.pos.x, this.pos.y, this.pos.z), v: mul(up, -vi * 0.9), s: strength, age: 0 });
      if (this.wake.length > 160) this.wake.shift();
    }
    for (const k of this.wake) { k.age += dt; k.p = add(k.p, mul(k.v, dt)); k.v = mul(k.v, 1 - 1.2 * dt); }
    while (this.wake.length && this.wake[0].age > 1.4) this.wake.shift();
    // ---- collisions
    this.collide(dt);
  }

  sampleWake() {
    let turb = 0, vx = 0, vy = 0, vz = 0, wsum = 0;
    const R = 0.16 + this.p.D * 2;
    for (const k of this.wake) {
      if (k.age < 0.12) continue;
      const dx = k.p.x - this.pos.x, dy = k.p.y - this.pos.y, dz = k.p.z - this.pos.z;
      const d2 = dx * dx + dy * dy + dz * dz; if (d2 > R * R) continue;
      const f = (1 - Math.sqrt(d2) / R) * k.s * (1 - k.age / 1.4);
      turb += f; vx += k.v.x * f; vy += k.v.y * f; vz += k.v.z * f; wsum += f;
    }
    const sc = wsum > 0 ? Math.min(1, wsum) / wsum : 0;
    return { turb: clamp(turb * 0.6, 0, 1.2), v: v3(vx * sc * 0.6, vy * sc * 0.6, vz * sc * 0.6) };
  }

  heightAbove() {
    let h = this.pos.y;
    for (const pr of this.world.prims) {
      if (pr.type !== 'box') continue;
      const a = pr.aabb; if (this.pos.x < a.min.x || this.pos.x > a.max.x || this.pos.z < a.min.z || this.pos.z > a.max.z) continue;
      if (a.max.y <= this.pos.y + 0.01) h = Math.min(h, this.pos.y - a.max.y);
    }
    return h;
  }

  collide(dt) {
    const p = this.p; let hit = false; let maxImpact = 0; let hitOwner = -1, hitNormal = null;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of p.colliders) {
        const cw = add(this.pos, qrot(this.q, c.c));
        const contacts = [];
        if (cw.y < c.r) contacts.push({ n: v3(0, 1, 0), d: c.r - cw.y, pt: v3(cw.x, 0, cw.z), owner: -1, ground: true });
        for (const pr of this.world.prims) {
          const a = pr.aabb;
          if (cw.x + c.r < a.min.x || cw.x - c.r > a.max.x || cw.y + c.r < a.min.y || cw.y - c.r > a.max.y || cw.z + c.r < a.min.z || cw.z - c.r > a.max.z) continue;
          const r = sphereVs(pr, cw, c.r); if (r) { r.owner = pr.owner; contacts.push(r); }
        }
        for (const ct of contacts) {
          hit = true;
          this.pos = add(this.pos, mul(ct.n, ct.d * 0.9));
          const r = sub(ct.pt, this.pos);
          const wW = qrot(this.q, this.w);
          const vc = add(this.vel, cross(wW, r));
          const vn = dot(vc, ct.n);
          if (vn < 0) {
            if (-vn > maxImpact) { maxImpact = -vn; hitOwner = ct.owner; hitNormal = ct.n; }
            // effective mass along normal
            const rB = qinv(this.q, r), nB = qinv(this.q, ct.n);
            const rxn = cross(rB, nB); const Iinv = v3(rxn.x / p.I.x, rxn.y / p.I.y, rxn.z / p.I.z);
            const k = 1 / p.mass + dot(cross(Iinv, rB), nB);
            const e = -vn > 0.4 ? p.restitution : 0;
            const jn = -(1 + e) * vn / k;
            // friction
            const vt = sub(vc, mul(ct.n, vn)), vtl = len(vt);
            let J = mul(ct.n, jn);
            if (vtl > 1e-5) {
              const tdir = mul(vt, 1 / vtl);
              const rxt = cross(rB, qinv(this.q, tdir)); const It = v3(rxt.x / p.I.x, rxt.y / p.I.y, rxt.z / p.I.z);
              const kt = 1 / p.mass + dot(cross(It, rB), qinv(this.q, tdir));
              const jt = Math.min(vtl / kt, p.friction * jn);
              J = sub(J, mul(tdir, jt));
            }
            this.vel = add(this.vel, mul(J, 1 / p.mass));
            const JB = qinv(this.q, J), tq = cross(rB, JB);
            this.w = v3(this.w.x + tq.x / p.I.x, this.w.y + tq.y / p.I.y, this.w.z + tq.z / p.I.z);
          }
          this.contactNormal = ct.n; this.contactOwner = ct.owner; this.contactGround = !!ct.ground;
        }
      }
    }
    this.contactThisStep = hit;
    if (hit) {
      this.lastImpact = maxImpact; this.impactOwner = hitOwner; this.impactNormal = hitNormal;
      this.w = mul(this.w, 0.995);
    }
    // crash rules (≈ "contact + disarm" in TPW terms)
    if (this.armed && !this.crashed) {
      if (maxImpact > 7.5) this.crash('impact');
      const up = this.up();
      const speed = len(this.vel);
      if (hit && up.y < -0.35 && speed < 0.6) { this.restOnGround += dt; if (this.restOnGround > 0.45) this.crash('turtle'); }
      else if (hit && speed < 0.25 && Math.abs(up.y) < 0.6) { this.restOnGround += dt; if (this.restOnGround > 0.9) this.crash('stuck'); }
      else this.restOnGround = Math.max(0, this.restOnGround - dt);
    }
    if (this.pos.y < -1) { this.pos.y = 0.05; this.vel = v3(); }
  }
  crash(reason) { this.crashed = true; this.crashReason = reason; this.armed = false; }
}

// ================================================================= TRICK RECOGNITION
// Approach: rotation tokenizer (quarter-turn primitives per body axis, like the
// spreadsheet's "Custom Trick Building Blocks") + obstacle crossing events + rules.
const TRICK_DATA = root.TPW_TRICKS || [];
function trickPoints(name) { const t = TRICK_DATA.find(t => t.name.trim() === name); return t ? t.pts : 0; }

// pattern tokens: Axis(R|P|Y) dir(+|-|a|b|-a|-b|*) deg  [i=inverted yaw] ; P+ = pitch back, R+ = roll right, Y+ = yaw right
function parsePattern(s) {
  return s.trim().split(/\s+/).map(tok => {
    const m = tok.match(/^([RPY])(\+|-|-?[ab]|\*)(~?)(\d+)(i?)$/); if (!m) throw new Error('bad token ' + tok);
    return { ax: m[1], dir: m[2], loose: !!m[3], deg: +m[4], inv: !!m[5] };
  });
}
function matchTokens(pat, toks) {
  if (pat.length !== toks.length) return null;
  const vars = {};
  let err = 0;
  for (let i = 0; i < pat.length; i++) {
    const p = pat[i], t = toks[i];
    if (p.ax !== t.ax) return null;
    if (p.inv && !t.inv) return null;
    const tol = p.loose ? 95 : 50;
    if (Math.abs(t.raw - p.deg) > tol) return null;
    err += Math.max(0, Math.abs(t.raw - p.deg) - (p.loose ? 55 : 0)) / p.deg;
    if (p.dir === '+' && t.dir !== 1) return null;
    if (p.dir === '-' && t.dir !== -1) return null;
    if (p.dir !== '*' && p.dir !== '+' && p.dir !== '-') {
      const neg = p.dir[0] === '-', v = neg ? p.dir[1] : p.dir;
      const want = neg ? -1 : 1;
      if (vars[v] === undefined) vars[v] = t.dir * want; else if (vars[v] * want !== t.dir) return null;
    }
  }
  if (vars.a !== undefined && vars.b !== undefined && vars.a === vars.b && pat.some(p => p.dir.includes('b'))) {
    // a and b must differ only when both used as separate vars
  }
  return { err: err / pat.length };
}

// crossing requirement strings: 'UOU' 'OU' 'UO' 'U' 'O' with alternating direction rules
const OBSTACLE_TRICKS = [
  { name: 'Powerloop', pats: ['P+~360'], cross: 'UOU', end: 'fwd' },
  { name: 'Power Flip', pats: ['P+~720'], cross: 'UOU', end: 'fwd' },
  { name: 'Reversed Power Flip', pats: ['P+180 P-360 P+180'], cross: 'UOU', end: 'fwd' },
  { name: 'Power Roll', pats: ['P+180 Ra360 P+180'], cross: 'UOU', end: 'fwd' },
  { name: 'Inverted 360 Powerloop', pats: ['P+180 Ya360i P+180'], cross: 'UOU', end: 'fwd' },
  { name: 'Barani', pats: ['P+180 Ya180i P+180', 'P+180 Ya180i P-180'], cross: 'UOU', end: 'back' },
  { name: 'Rollani', pats: ['P+180 Ya180i Rb360 P*180'], cross: 'UOU', end: 'back' },
  { name: 'Flipani', pats: ['P+180 Ya180i P-540', 'P+180 Ya180i P-360 P+180'], cross: 'UOU', end: 'back' },
  { name: 'Immelmann Turn', pats: ['P+180 Ra180'], cross: 'UO' },
  { name: 'Matty Flip', pats: ['P-~360'], end: 'back', cross: 'OU' },
  { name: 'Anti Matty', pats: ['P+~360'], cross: 'OU', end: 'back' },
  { name: 'Power Matty', pats: ['P-~720'], cross: 'OU', end: 'back' },
  // demo GIF pitches down ~45–90° before the roll, leaving ~270–315° for the Matty after it
  { name: 'Matty Twister', pats: ['Ra360 P-~360', 'P-~90 Ra360 P-~270'], cross: 'OU', end: 'back' },
  { name: 'Matty Roll', pats: ['P-270 Ra360 P-90', 'P-270 Ra360'], cross: 'OU', end: 'back' },
  { name: 'Matty 360', pats: ['P-~180 Ya360 P-~180', 'P-~270 Ya360'], cross: 'OU', end: 'back' },
  { name: 'Split-S', pats: ['Ra180 P+~180'], cross: 'OU', end: 'fwd' },
  { name: '540 Split S', pats: ['Ra540 P+180'], cross: 'OU', end: 'fwd' },
  { name: 'Split-Back', pats: ['Ra180 P+~540'], cross: 'OU', end: 'fwd' },
  { name: 'Split Yaw', pats: ['Ra180 P+~90 Yb180', 'Ra180 Yb180 P+~90'], cross: 'OU', end: 'back' },
  // pilot feedback: needs to be detected better. The second half of a Matty is anything from ~100 to ~250 of pitch, the end often floaty
  { name: 'Half Matty', pats: ['Ra180 P*~180'], cross: 'U', end: 'back' },
  { name: '540 Half Matty', pats: ['Ra540 P*~180'], cross: 'U', end: 'back' },
  { name: 'Forani', pats: ['P-180 Ya180i P*180'], cross: 'U', end: 'back' },
  // pilot feedback: far too many false Snapbacks. TPW: pass UNDER first, then pitch back to inverted and roll 180, tracking the object
  { name: 'Snapback', pats: ['P+180 Ra180'], cross: 'U', passFirst: true },   // the Watcher checks the rest (under first, tracking, no loop)
  { name: 'Blindflip', pats: ['Ya180 P+360'], cross: 'OU' },
  // ---- phase 2 (rules from the TPW descriptions; marked draft until confirmed with pilot examples)
  // demo GIF: the loop comes all the way round to level on the start side, hovers ~1.3 s, then Split-S back over and under
  { name: 'Power Split', pats: ['P+~180 Ra180 P+~180', 'P+~270 Ra180 P+~180', 'P+~360 Ra180 P+~180'], cross: 'UOOU', pauseOK: 2.0, draft: true },
  { name: 'Power Swap', pats: ['P+~180 Ra180 P-180'], cross: 'UOU', end: 'back', draft: true },
  // demo GIF: loop round to level on the start side (no pass back under), hover ~0.7 s, Matty back over and under
  { name: 'Power Switch', pats: ['P+~180 P-~360', 'P+~270 P-~270', 'P+~180 P-~270', 'P+~360 P-~360', 'P+~360 P-~270'], cross: 'UOOU', end: 'back', pauseOK: 1.6, draft: true },
  { name: 'Immelloop', pats: ['P+~180 Ra180', 'P+~180 Ra180 P+~90'], cross: 'UOU', end: 'back', draft: true },
  { name: 'Immelmatt', pats: ['P+~180 Ra180 P-~270'], cross: 'UOU', end: 'back', draft: true },
  { name: 'Half Mavvy', pats: ['Ra180 P*~180'], cross: 'UOU', end: 'back', draft: true },
  { name: "Mavik's Loop", pats: ['P-~180 R*360 P-~180', 'P-~180 R*360 P+~180'], cross: 'UOU', draft: true },
  { name: 'Mavani', pats: ['P-~180 Ya180i P*~180'], cross: 'UOU', end: 'back', draft: true },
  { name: 'Donkey Loop', pats: ['P-~180 Ya360i P*~180'], cross: 'UOU', draft: true },
  { name: 'Mavvelmann', pats: ['P-~180 Ra180'], cross: 'UO', draft: true },
  { name: 'Split Stall Matty Rewind', pats: ['Ra180 P-~270', 'Ra180 P+~90 P-~270', 'Ra180 P-~360'], cross: 'OU', end: 'back', draft: true },
  { name: 'Maverick Tap Rewind', pats: ['P-~360', 'P-~90 P-~270'], cross: 'UOU', end: 'back', tap: { face: 'bottom' }, draft: true },
  { name: 'Power Switch Tap', pats: ['P+~180 P-~270', 'P+~270 P-~180', 'P+~180 P-~360'], cross: 'UOU', end: 'back', tap: { face: 'bottom' }, draft: true },
  { name: 'True Barani', pats: ['P-180 Ya180i P+180'], cross: 'OU', end: 'fwd' },   // demo GIF unclear (see tricktionary-reference.md)
];
const OPEN_TRICKS = [
  // prowhooper.com (text + demo GIFs) has these the other way round from the spreadsheet; the site wins. Same points.
  { name: "Rubik's Cube", pats: ['Pa180 R*360 Pa180'] },
  { name: "Cubik's Rube", pats: ['Ra180 P*360 Ra180'] },
  // pilot feedback: sloppy reps (~300-330 of spin) are normal and should count; the grade reflects the error
  { name: 'Inverted Yaw Spin', pats: ['Pa180 Y*~360i Pa180', 'Ra180 Y*~360i Ra180', 'Pa180 Y*~360i R*180', 'Ra180 Y*~360i P*180'] },
  { name: 'Vanny Roll', pats: ['Ya180 R*360 Ya180'] },
  { name: 'Double Flip', pats: ['P*720'] },
  { name: 'Double Roll', pats: ['R*720'] },
  // pilot: needs better detection. The roll often blends into the end of the flick (the roll splits the pitch token)
  { name: 'Juicy Flick', pats: ['P-180 R*180', 'P-~135 R*180 P-~45'] },
  { name: 'Invert Rewind', pats: ['Ra180 R-a180', 'Pa180 P-a180'] },
  { name: 'Flip', pats: ['P*360'] },
  { name: 'Roll', pats: ['R*360'] },
  { name: 'Yaw Spin', pats: ['Y*360'] },
];
// rotation patterns that also need a situation: a tap, a stall, a rewind, a climb, tracking an object…
const CONTEXT_TRICKS = [
  { name: 'Roll Tap', pats: ['R*~360', 'R*~270'], req: { tap: { face: 'bottom', surface: 'wall' } }, draft: true },
  { name: 'Loop Tap', pats: ['R*~90 P+~180', 'R*~90 P+~270', 'P+~90 R*~90 P+~180'], req: { tap: { face: 'bottom', surface: 'wall' } }, draft: true },
  { name: 'Ceiling Tap', pats: ['P+~180', 'P+~270'], req: { tap: { face: 'bottom', surface: 'ceiling' } }, draft: true },
  { name: 'Downtown Tap', pats: ['R*~180 P-~360', 'R*~180 P+~90 P-~360', 'R*~180 P-~270'], req: { tap: { face: 'any', surface: 'any' } }, draft: true },
  // demo GIF: ascends in front of an indoor cube (~1 m), not a tall object
  { name: 'Eject Roll', pats: ['P-~180 R*~360'], req: { climbBefore: true, nearTall: 0.8 }, draft: true },
  { name: 'Stellar Eject Roll', pats: ['P-~180 R*~360 P-~180', 'P-~180 R*~360 P-~270'], req: { climbBefore: true, endBack: true }, draft: true },
  // demos (Tricktionary): stall rewinds done next to the pilot (~1.8 m) and an indoor staircase; only plain Stall Rewind asks for 10 ft
  { name: 'Flip Stall Rewind', pats: ['P*~360'], req: { stallIn: true, nearTall: 1.5 }, draft: true },
  { name: '360 Stall Rewind', pats: ['R*~360'], req: { stallIn: true, nearTall: 1.5 }, draft: true },
  // TPW: a SEGMENTED front flip at the stall beside an object. A continuous Matty (pilot: Mattys were read as this) is a Matty.
  { name: 'Matty Stall Rewind', pats: ['P-~360'], req: { stallIn: true, endBack: true, segmented: true, nearTall: true }, draft: true },
  { name: 'Half Matty Stall Rewind', pats: ['Y*~180 Ra180 P*~180'], req: { rewindIn: true, endBack: true }, draft: true },
  { name: '540 Half Matty Stall Rewind', pats: ['Y*~180 Ra540 P*~180'], req: { rewindIn: true, endBack: true }, draft: true },
  { name: 'Inverted Yaw Tracking', pats: ['Ra180 Y-a~180i Ra180', 'Ra180 Y-a~360i Ra180', 'Ra180 Y-a~270i Ra180'], req: { track: 0.7 }, draft: true },
];
for (const t of [...OBSTACLE_TRICKS, ...OPEN_TRICKS, ...CONTEXT_TRICKS]) t.parsed = t.pats.map(parsePattern);
const TAP_TRICKS = new Set([...OBSTACLE_TRICKS, ...CONTEXT_TRICKS].filter(t => t.tap || (t.req && t.req.tap)).map(t => t.name).concat(['Wall Tap', 'Facepunch']));

class TrickDetector {
  constructor(world) { this.world = world; this.reset(); }
  reset() {
    this.pending = null; this.debug = [];
    this.active = false; this.samples = []; this.restT = 0; this.events = []; this.crossLog = [];
    this.prevSide = {}; this.contacts = []; this.out = []; this.wallRide = null; this.diveMaxY = 0; this.dive = null;
    this.climb = null; this.slide = null; this.perch = null; this.lastTap = -10; this.time = 0;
  }
  // call every physics step (or every few)
  update(d, dt, rc) {
    this.time += dt;
    const t = this.time, up = d.up(), rates = d.pilotRates();
    const rmag = Math.hypot(rates[0], rates[1], rates[2]);
    this.trackCrossings(d, t);
    this.continuousDetectors(d, dt, t, rc);
    if (d.contactThisStep && d.armed) this.contacts.push({ t, owner: d.contactOwner, impact: d.lastImpact, n: d.contactNormal, up });
    const resting = rmag < 75 && up.y > 0.05;
    if (this.pending) { const lc = this.crossLog[this.crossLog.length - 1]; if (lc && lc.t > this.pending.endT && !lc.used) { lc.used = true; this.pending.evalT = Math.min(this.pending.evalT, t + 0.25); } }
    if (this.pending && (t >= this.pending.evalT || (rmag > 150 && !this.active))) { const pnd = this.pending; this.pending = null; this.evaluate(pnd, t); }
    if (!this.active) {
      if (rmag > 150 && d.armed) { this.active = true; this.samples = []; this.winStart = t; this.restT = 0; }
      else { if (!this.pending) this.contacts = this.contacts.filter(c => t - c.t < 0.3); return; }
    }
    this.samples.push({ t, r: rates, up, pos: v3(d.pos.x, d.pos.y, d.pos.z), vel: v3(d.vel.x, d.vel.y, d.vel.z), q: { w: d.q.w, x: d.q.x, y: d.q.y, z: d.q.z } });
    if (d.crashed) { this.close(d, t, true); return; }
    if (resting) { this.restT += dt; if (this.restT > 0.55) this.close(d, t, false); } else this.restT = 0;
    if (t - this.winStart > 12) this.close(d, t, false);
  }
  trackCrossings(d, t) {
    for (const o of this.world.objs) {
      if (o.round) {   // round obstacle (tree): aim the over/under line across the approach, hold it while nearby
        const R = o.round, st = (this.roundSt = this.roundSt || {})[o.id] || (this.roundSt[o.id] = {});
        const dh = Math.hypot(d.pos.x - R.c.x, d.pos.z - R.c.z), vh = Math.hypot(d.vel.x, d.vel.z);
        const recent = this.crossLog.some(c => c.obj === o.id && t - c.t < 5);   // never re-aim mid-trick (big Split-Back: ~3 s over→under)
        const closing = vh > 1.0 && dh > 0.8 && ((R.c.x - d.pos.x) * d.vel.x + (R.c.z - d.pos.z) * d.vel.z) / (dh * vh) > 0.6;
        if (dh < R.r + 3) st.tNear = t;
        if (vh > 0.5 && !recent && (t - (st.tNear ?? -9) > 2.5 || closing)) {   // far away, or heading in at it: aim across the approach
          const ax = d.vel.x / vh, az = d.vel.z / vh;
          if (!st.ax || ax * st.ax + az * st.az < 0.97) {
            st.ax = ax; st.az = az; delete this.prevSide[o.id];
            o.obstacle = { a: v3(R.c.x + az * R.r, 0, R.c.z - ax * R.r), b: v3(R.c.x - az * R.r, 0, R.c.z + ax * R.r), under: R.under, over: R.over };
          }
        }
      }
      if (o.obstacle) {
        const { a, b, under, over } = o.obstacle;
        const ab = sub(b, a); ab.y = 0; const L = len(ab); const u = mul(ab, 1 / L);
        const n = v3(-u.z, 0, u.x);
        const rel = sub(d.pos, a); const side = dot(rel, n) > 0 ? 1 : -1; const along = dot(rel, u);
        const key = o.id, prev = this.prevSide[key];
        this.prevSide[key] = side;
        if (prev !== undefined && prev !== side && along > -0.35 && along < L + 0.35) {
          let kind = null;
          if (d.pos.y < under && d.pos.y > 0) kind = 'U'; else if (d.pos.y > over && d.pos.y < over + 7) kind = 'O';
          if (kind) {
            const f = d.fwd(), fh = Math.hypot(f.x, f.z), vh = Math.hypot(d.vel.x, d.vel.z);
            const fwdDot = (fh > 0.2 && vh > 0.8) ? (f.x * d.vel.x + f.z * d.vel.z) / (fh * vh) : 0;
            const rr = d.right(), rh = Math.hypot(rr.x, rr.z);
            const latDot = (rh > 0.2 && vh > 0.8) ? Math.abs(rr.x * d.vel.x + rr.z * d.vel.z) / (rh * vh) : 0; // 1 = flying sideways
            // dithering back and forth across the line (floaty loop tops, a wobbly hover over a bar) isn't a pass: the
            // same kind of crossing straight back within 0.25 s cancels the one before
            let li = -1; for (let i = this.crossLog.length - 1; i >= 0; i--) if (this.crossLog[i].obj === o.id) { li = i; break; }
            const L = li >= 0 ? this.crossLog[li] : null;
            if (L && L.kind === kind && t - L.t < 0.25 && !L.used) { this.crossLog.splice(li, 1); this.nCross = Math.min(this.nCross ?? 0, this.crossLog.length); }
            else this.crossLog.push({ t, obj: o.id, name: o.name, kind, dir: side, fwdDot, latDot, upY: d.up().y, spd: vh, hOver: d.pos.y - over, p: v3(d.pos.x, (under + over) / 2, d.pos.z) });
          }
        }
      }
      if (o.gap) {
        const g = o.gap, rel = sub(d.pos, g.c), s = dot(rel, g.n) > 0 ? 1 : -1, key = 'g' + o.id, prev = this.prevSide[key];
        this.prevSide[key] = s;
        if (prev !== undefined && prev !== s) {
          const vAx = g.round ? null : cross(g.n, g.u);
          const du = dot(rel, g.u), dv = g.round ? dot(rel, cross(g.n, g.u)) : dot(rel, vAx);
          const inside = g.round ? Math.hypot(du, dv) < g.hu : (Math.abs(du) < g.hu + 0.02 && Math.abs(dv) < g.hv + 0.02);
          const f = d.fwd(), vl = len(d.vel), fwdDot = vl > 0.8 ? dot(f, d.vel) / vl : 0;
          if (inside) this.crossLog.push({ t, obj: o.id, name: o.name, kind: 'G', dir: s, rollAbs: Math.abs(d.right().y), up: d.up(), fwdDot });
        }
      }
    }
    this.crossLog = this.crossLog.filter(c => t - c.t < 20);
  }
  tokenize(samples) {
    const toks = []; let cur = null; let idle = 0;
    const AX = ['R', 'P', 'Y'];
    for (let i = 1; i < samples.length; i++) {
      const s = samples[i], dt = s.t - samples[i - 1].t;
      const ar = s.r.map(Math.abs); let k = 0; if (ar[1] > ar[k]) k = 1; if (ar[2] > ar[k]) k = 2;
      if (ar[k] < 95) { idle += dt; if (cur) cur.idleAfter += dt; continue; }
      const dir = Math.sign(s.r[k]);
      if (cur && cur.k === k && cur.dir === dir && cur.idleAfter < 0.28) {
        cur.maxGap = Math.max(cur.maxGap || 0, cur.idleAfter); cur.raw += ar[k] * dt; cur.t1 = s.t; cur.idleAfter = 0; cur.n++; cur.inv += s.up.y < -0.2 ? 1 : 0;
        cur.off += (ar[(k + 1) % 3] + ar[(k + 2) % 3]) * dt;
      } else {
        if (cur && cur.k === k && cur.dir === dir) { // same axis after a pause: segmented
          cur.segments = (cur.segments || 1) + 1; cur.maxGap = Math.max(cur.maxGap || 0, cur.idleAfter);
          cur.raw += ar[k] * dt; cur.t1 = s.t; cur.idleAfter = 0; cur.n++; continue;
        }
        cur = { k, ax: AX[k], dir, raw: ar[k] * dt, t0: s.t, t1: s.t, idleAfter: 0, n: 1, inv: s.up.y < -0.2 ? 1 : 0, off: 0 };
        toks.push(cur);
      }
    }
    // drop tiny tokens, merge neighbours that become adjacent
    let f = toks.filter(t => t.raw > 60);
    const merged = [];
    for (const t of f) {
      const l = merged[merged.length - 1];
      if (l && l.ax === t.ax && l.dir === t.dir) { l.raw += t.raw; l.t1 = t.t1; l.n += t.n; l.inv += t.inv; l.off += t.off; l.idleAfter = t.idleAfter; l.maxGap = Math.max(l.maxGap || 0, l.idleAfter); }
      else merged.push({ ...t });
    }
    for (const t of merged) { t.deg = Math.max(90, Math.round(t.raw / 90) * 90); t.inv = t.inv > t.n * 0.5; t.offRatio = t.off / t.raw; }
    return merged;
  }
  close(d, t, crashed) {
    this.active = false;
    const S = this.samples; if (S.length < 5) return;
    const w = { S, endT: t, crashed };
    // Obstacle tricks often finish *after* the rotation stops (e.g. the pass back under the
    // object at the end of a Matty / Powerloop), so wait a moment for trailing crossings.
    const t0 = S[0].t - 2.2;
    const nearObs = this.crossLog.some(c => c.t >= t0) || this.nearObstacle(d, 3.5);
    if (crashed || !nearObs) this.evaluate(w, t); else { w.evalT = t + 1.4; this.pending = w; }
  }
  evaluate(w, now) {
    const S = w.S, crashed = w.crashed, t = now;
    const toks = this.tokenize(S);
    const t0 = S[0].t - 2.2, t1 = now;
    const crosses = this.crossLog.filter(c => c.t >= t0 && c.t <= t1);
    const contacts = this.contacts.filter(c => c.t >= S[0].t - 0.1 && c.t <= Math.min(t1, w.endT + 0.6));
    this.contacts = this.contacts.filter(c => c.t > t1);
    const res = [];
    const dbg = { t: +now.toFixed(2), toks: toks.map(tk => tk.ax + (tk.dir > 0 ? '+' : '-') + Math.round(tk.raw) + (tk.inv ? 'i' : '') + (tk.maxGap > 0.15 ? `(stall ${tk.maxGap.toFixed(2)}s)` : '')).join(' '),
      cross: crosses.map(c => `${c.name}:${c.kind}${c.dir > 0 ? '→' : '←'}@${(c.t - S[0].t).toFixed(1)}s`).join(' '), result: [], near: null,
      samples: S.filter((_, i) => i % 20 === 0).map(x => [+(x.t - S[0].t).toFixed(3), +x.pos.x.toFixed(3), +x.pos.y.toFixed(3), +x.pos.z.toFixed(3), +x.q.w.toFixed(4), +x.q.x.toFixed(4), +x.q.y.toFixed(4), +x.q.z.toFixed(4), ...x.r.map(v => Math.round(v))]) };
    (this.debug = this.debug || []).push(dbg); if (this.debug.length > 12) this.debug.shift();
    if (crashed) { dbg.result.push('Crash'); this.emit({ name: 'Crash', exec: 'CRASH', pts: 0, toks }); return; }
    if (!toks.length) return;
    // obstacle-based first (needs crossings), else open air greedy
    const ob = this.matchObstacle(toks, crosses);
    const sg = toks.length === 1 && (toks[0].ax === 'P' || toks[0].ax === 'R') && toks[0].segments >= 2 && toks[0].maxGap >= 0.42 && Math.abs(toks[0].raw - 360) < 60 ? toks[0] : null;
    if (ob) res.push(ob);
    else if (sg) res.push({ name: 'Segmented Flips/Rolls', toks: [sg], err: 0.05, segmentedOK: true });
    else {
      let i = 0;
      while (i < toks.length) {
        let best = null;
        for (let k = Math.min(4, toks.length - i); k >= 1 && !best; k--) {
          const slice = toks.slice(i, i + k);
          for (const tr of OPEN_TRICKS) {
            for (const pp of tr.parsed) { const m = matchTokens(pp, slice); if (m) { best = { name: tr.name, toks: slice, err: m.err, k }; break; } }
            if (best) break;
          }
        }
        if (best) { res.push(best); i += best.k; } else i++;
      }
    }
    if (!ob) { const nm = this.nearMiss(toks, crosses); if (nm) { dbg.near = nm; this.emit({ name: 'near', near: nm }); } }
    for (const r of res) {
      dbg.result.push(r.name);
      const grade = this.grade(r, contacts, toks);
      this.emit({ name: r.name, exec: grade.exec, clean: grade.clean, obstacle: r.obstacle || null, toks: r.toks, notes: grade.notes });
    }
  }
  matchObstacle(toks, crosses) {
    // group crossings per obstacle
    const byObj = {};
    for (const c of crosses) if (c.kind !== 'G') (byObj[c.obj] = byObj[c.obj] || []).push(c);
    let best = null;
    for (const id in byObj) {
      const seq = byObj[id];
      const kinds = seq.map(c => c.kind).join('');
      for (const tr of OBSTACLE_TRICKS) {
        const need = tr.cross;
        const pos = kinds.lastIndexOf(need); if (pos < 0) continue;
        // direction alternation check
        const part = seq.slice(pos, pos + need.length);
        let ok = true;
        if (need === 'UOU' && !(part[0].dir !== part[1].dir && part[1].dir !== part[2].dir)) ok = false;
        if ((need === 'OU' || need === 'UO') && part[0].dir === part[1].dir) ok = false;
        if (!ok) continue;
        if (!endOK(tr, part[part.length - 1])) continue;
        if (!tr.lateral && part.every(c => c.latDot > 0.7)) continue;            // sideways passes = jump-rope family
        if (need === 'UOU' && this.stayedUpright && this.stayedUpright(part[0].t, part[2].t) && toks.some(x => x.ax === 'P' && x.dir > 0)) continue; // a loop that stayed upright (body or view) is a maverick, not a powerloop
        if (tr.tap && !(this.tapIn && this.tapIn(tr.tap, +id, toks.length ? toks[0].t0 - 0.4 : part[0].t, part[part.length - 1].t + 0.15))) continue;
        if (this.watcher && (this.vetoedFor(tr.name, toks.length ? toks[0].t0 : part[0].t) || !this.watcher.pre(tr.name, { toks, part, obj: +id, t0: toks.length ? toks[0].t0 : part[0].t }))) continue;   // the Watcher's hard checks
        // match against big tokens (ignore trailing/leading 90s if needed)
        const variants = [toks, trimNinety(toks), dropSmall(toks)];
        for (const tv of variants) for (const pp of tr.parsed) {
          const m = matchTokens(pp, tv);
          if (!m) continue;
          const cand = { name: tr.name, toks: tv, err: m.err + (tv !== toks ? 0.15 : 0), obstacle: seq[0].name, obj: +id, clen: need.length, part, ct1: part[part.length - 1].t };
          if (m && better(cand, best)) best = cand;
        }
      }
      // maverick family: UOU, no big pitch, never inverted (except mavvy roll's roll)
      if (/UOU/.test(kinds)) {
        const bigP = toks.filter(x => x.ax === 'P' && x.raw > 200);
        const rolls = toks.filter(x => x.ax === 'R');
        const part = seq.slice(kinds.lastIndexOf('UOU'), kinds.lastIndexOf('UOU') + 3);
        const r1 = rolls.length === 1 ? rolls[0] : null;   // a Mavvy Roll's roll is the one time it may go inverted
        const upright = !this.stayedUpright ? true : r1 ? this.stayedUpright(part[0].t, r1.t0 - 0.03) && this.stayedUpright(r1.t1 + 0.03, part[2].t)
          : this.stayedUpright(part[0].t, part[2].t);   // maverick: forward-looking the whole way (body or camera view)
        if (!bigP.length && upright && part[0].dir !== part[1].dir && !part.every(c => c.latDot > 0.7) && (part[0].spd ?? 9) >= 1.5 && (part[2].spd ?? 9) >= (r1 ? 0.5 : 1.5) && (part[1].spd ?? 9) >= (r1 ? 0 : 0.8)) {   // a Mavvy Roll nearly stops over the top to roll (the 360 roll rules out drift)
          const nm = rolls.length === 1 && Math.abs(rolls[0].raw - 360) < 60 ? 'Mavvy Roll' : (rolls.length === 0 ? 'Maverick Loop' : null);
          const cand = { name: nm, toks, err: 0.1, obstacle: seq[0].name, obj: +id, clen: 3, part, ct1: part[2].t };
          if (nm && better(cand, best)) best = cand;
        }
      }
      // jump-rope family: passes made flying sideways
      // Only on things you really jump-rope: a bar with room to fly under it (pilot: they triggered on benches, the picnic
      // table and other objects that aren't over/under bars). Not trees, not the pilot, nothing lower than 0.9 m.
      const jo = this.world.objs.find(o => o.id === +id), jumpable = !jo || (jo.obstacle && !jo.round && jo.kind !== 'pilot' && jo.obstacle.under >= 0.9);
      if (jumpable) { const lat = seq.filter(c => c.latDot > 0.6); const lk = lat.map(c => c.kind).join('');
        const R = toks.filter(x => x.ax === 'R'), P = toks.filter(x => x.ax === 'P'), Y = toks.filter(x => x.ax === 'Y');
        const pick = (nm, cl, pp) => { const cand = { name: nm, toks, err: 0.12, obstacle: seq[0].name, obj: +id, clen: cl, part: pp, ct1: pp[pp.length - 1].t, draft: true }; if (better(cand, best)) best = cand; };
        if (lat.length >= 2 && !P.some(x => x.raw > 200) && lat.slice(-2).every(c => (c.spd ?? 9) >= 1.5)) {
          const pp = lat.slice(-3);
          if (/UOU$/.test(lk) && R.some(x => Math.abs(x.raw - 360) < 80)) pick('Side Loop', 3, pp);
          else if (/U$/.test(lk) && (() => {   // Burrito: big roll before crossing over, rewind down the same side, finish under
            const rb = R.filter(x => x.raw >= 150).pop(); if (!rb) return false;
            const noOver = !lat.some(c => c.kind === 'O' && c.t > rb.t0 - 0.6);       // a Double Dutch rolls at the peak, over the object
            return noOver && lat.some(c => c.t < rb.t0) && (R.some(x => x !== rb && x.dir !== rb.dir && x.raw >= 60) || rb.raw >= 200);
          })()) pick('Burrito Roll', 2, lat.slice(-2));
          else if (R.some(x => Math.abs(x.raw - 360) < 80)) pick('Double Dutch', 2, lat.slice(-2));
          else if (Y.some(x => Math.abs(x.raw - 360) < 80)) pick('Cinnamon Roll', 2, lat.slice(-2));
          // pilot feedback: jump ropes were credited too eagerly and got in the way of Split-S. A plain Jump Rope has no big
          // roll or pitch (a Split-S has a 180 roll and a half loop) and both passes really are sideways
          else if (/^(OU|UO)$/.test(lk.slice(-2)) && lat[lat.length - 1].t - lat[lat.length - 2].t < 3 && lat[lat.length - 1].dir !== lat[lat.length - 2].dir && !R.some(x => x.raw > 120) && !P.some(x => x.raw > 110) && lat.slice(-2).every(c => c.latDot > 0.75 && Math.abs(c.fwdDot) < 0.6)) pick('Jump Rope', 2, lat.slice(-2));   // one over + one under, there and back
        }
      }
      // beginner switch: maverick over, stall, rewind back over, back under flying backward — no big rotation
      if (/UOOU$/.test(kinds) && !toks.some(x => x.raw > 160) && seq.slice(-4).filter(c => (c.spd ?? 9) >= 1.2).length >= 3) {
        const pp = seq.slice(-4); if (endOK({ end: 'back' }, pp[3])) { const cand = { name: 'Beginner Switch', toks, err: 0.1, obstacle: seq[0].name, obj: +id, clen: 4, part: pp, ct1: pp[3].t, draft: true }; if (better(cand, best)) best = cand; }
      }
      if (/OU/.test(kinds) && !best) {
        const p2 = seq.slice(kinds.lastIndexOf('OU'), kinds.lastIndexOf('OU') + 2);
        const big = toks.filter(x => x.raw > 200);
        // over flying forward, under flying backward, both at speed, no flip (the braking nod is too small to be a token)
        const brisk = p2.every(c => (c.spd ?? 9) >= 1.5) && (p2[0].fwdDot > 0.3 || toks.some(x => x.ax === 'P' && x.raw >= 60));
        // pilot: Matty flips inside combos were still called Beginner Matty. Mid-combo the flip is often slow, broken up or
        // partly claimed by the trick before, so no single big pitch token is left. Go by how far the quad actually tumbled
        // between going over and coming back under: a beginner matty only nods (well under a half turn), a Matty goes round.
        const tumble = this.sweptBetween ? this.sweptBetween(p2[0].t - 0.5, p2[1].t + 0.1) : 0;
        const flipped = tumble >= 230 && !(this.cur && this.cur[1] && this.cur[1].raw > 45) && !toks.some(x => x.ax === 'R' && x.raw > 120) && !toks.some(x => x.ax === 'P' && x.dir > 0 && x.raw > 120) && !toks.some(x => x.ax === 'Y' && x.raw > 120);
        if (!big.length && brisk && p2[0].dir !== p2[1].dir && endOK({ end: 'back' }, p2[1])) best = { name: flipped ? 'Matty Flip' : 'Beginner Matty', toks, err: 0.1, obstacle: seq[0].name, obj: +id, clen: 2, part: p2, ct1: p2[1].t };
      }
      if (/OUO/.test(kinds) && !best) {
        const big = toks.filter(x => x.raw > 200);
        const p3 = seq.slice(kinds.lastIndexOf('OUO'), kinds.lastIndexOf('OUO') + 3);
        if (!big.length && p3.every(c => (c.spd ?? 9) >= 1.5) && toks.some(x => x.ax === 'P' && x.raw >= 60)) best = { name: 'Beginner Matty', toks, err: 0.1, obstacle: seq[0].name, obj: +id, clen: 3, part: p3, ct1: p3[2].t };
      }
    }
    // knife edge through a gap
    const g = crosses.find(c => c.kind === 'G' && c.rollAbs > 0.8);
    if (!best && g) {
      const rl = toks.filter(x => x.ax === 'R');
      if (rl.length >= 1 && rl.every(x => x.raw < 160)) best = { name: 'Knife Edge', toks, err: 0.1, obstacle: g.name, obj: g.obj, clen: 1, part: [g], ct1: g.t };
      const yw = toks.find(x => x.ax === 'Y' && Math.abs(x.raw - 360) < 70);
      if (yw) best = { name: 'Ninja Star', toks, err: 0.1, obstacle: g.name, obj: g.obj, clen: 1, part: [g], ct1: g.t };
      if (g.fwdDot < -0.4 && toks.some(x => x.ax === 'P' && x.raw > 120)) best = { name: 'Reverse Knife Edge', toks, err: 0.1, obstacle: g.name, obj: g.obj, clen: 1, part: [g], ct1: g.t };
    }
    return best;
  }
  nearMiss(toks, crosses) {
    const objs = [...new Set(crosses.filter(c => c.kind !== 'G').map(c => c.obj))];
    let best = null;
    for (const tr of OBSTACLE_TRICKS) for (const tv of [toks, trimNinety(toks), dropSmall(toks)]) for (const pp of tr.parsed) {
      if (tr.tap || tr.draft) continue;
      if (!matchTokens(pp, tv)) continue;
      const cand = { name: tr.name, need: tr.cross, end: tr.end };
      if (!best || cand.need.length > best.need.length || (cand.need.length === best.need.length && trickPoints(cand.name) > trickPoints(best.name))) best = cand;
    }
    if (!best) return null;
    const words = { U: 'under', O: 'over' };
    if (!objs.length) return null;
    const id = objs[0], cs = crosses.filter(c => c.obj === id), seq = cs.map(c => c.kind).join('');
    if (seq.endsWith(best.need) || (best.need.length > 1 && seq.includes(best.need))) {
      const last = cs[cs.length - 1];
      if (last && last.upY < 0.45) return `Almost ${best.name} on ${last.name}: you weren't upright on the last pass ${words[last.kind]}`;
      if (best.end === 'back') return `Almost ${best.name} on ${last.name}: finish upright, facing the object, flying backward under it`;
      if (best.end === 'fwd') return `Almost ${best.name} on ${last.name}: finish flying forward under it`;
    }
    return `Almost ${best.name} on ${crosses.find(c => c.obj === id).name}: needs ${best.need.split('').map(k => words[k]).join(' → ')}, saw ${seq ? seq.split('').map(k => words[k]).join(' → ') : 'nothing'}`;
  }
  grade(r, contacts, allToks) {
    let clean = 100; const notes = [];
    const used = r.toks;
    // rotation accuracy
    clean -= Math.min(30, (r.err || 0) * 120);
    // pauses / segmentation inside the trick
    const pauseOK = (OBSTACLE_TRICKS.find(x => x.name === r.name) || {}).pauseOK || 0;   // a level-out hover that is part of the trick
    for (let i = 0; i < used.length - 1 && !r.segmentedOK; i++) { const gap = used[i + 1].t0 - used[i].t1; if (gap > 0.22 && gap > pauseOK) { clean -= Math.min(30, (gap - 0.22) * 90); notes.push('segmented'); } }
    if (!r.segmentedOK) for (const t of used) if (t.maxGap > 0.1) { clean -= Math.min(50, (t.maxGap - 0.06) * 180); notes.push('stalled mid-rotation'); }
    // off-axis wobble
    for (const t of used) if (t.offRatio > 0.35) { clean -= Math.min(20, (t.offRatio - 0.35) * 60); notes.push('off-axis'); }
    // leftover rotation tokens not part of the trick
    const extra = allToks.length - used.length; if (extra > 0 && r.obstacle) { clean -= 8 * extra; notes.push('extra rotation'); }
    clean = Math.round(clamp(clean, 0, 100));
    let exec = clean >= 70 ? 'CLEAN' : 'SLOPPY';
    const bumps = contacts.filter(c => !(c.tap));
    if (bumps.length) { exec = 'BUMP'; notes.push('contact'); }
    return { exec, clean, notes };
  }
  continuousDetectors(d, dt, t, rc) {
    const up = d.up(), speed = len(d.vel);
    // Wall tap: gentle contact with a wall surface, bottom of the whoop toward the wall
    if (!this.liveTaps && d.contactThisStep && d.armed && !d.contactGround && d.contactNormal && Math.abs(d.contactNormal.y) < 0.5) {
      const o = this.world.objs[d.contactOwner];
      if (o && (o.kind === 'wall' || o.kind === 'building' || o.wallNormal) && dot(up, d.contactNormal) > 0.55 && d.lastImpact < 3 && t - this.lastTap > 1.2) {
        this.lastTap = t; this.contacts.forEach(c => { if (t - c.t < 0.05) c.tap = true; });
        this.emit({ name: 'Wall Tap', exec: 'CLEAN', clean: Math.round(100 - d.lastImpact * 10), obstacle: o.name, continuous: true });
      }
    }
    // Wall ride: travel along a wall, close, rolled so that thrust axis points away from wall
    // pilot feedback (x2): with a steep camera you can't get flat against the wall, so the frame doesn't need to be close:
    // start within ~0.9 m with the belly turned toward the wall (roll ≥ ~35° even when pitched forward), then hold the ride
    // out to 1.3 m and through short wobbles (0.25 s). Must be travelling along the wall, not turning away from it.
    const w = this.nearWall(d), WR0 = this.wallRide;
    const along = w && speed > 0.5 && Math.abs(dot(d.vel, w.n)) / speed < 0.6, tiltW = w ? dot(up, w.n) : 0;
    const riding = w && along && speed > 1.0 && d.armed && !d.crashed && (WR0 ? (w.dist < 1.3 && tiltW > 0.25) : (w.dist < 0.9 && tiltW > 0.4));
    if (riding) {
      if (!this.wallRide) { const f0 = d.fwd(); this.wallRide = { t0: t, p0: v3(d.pos.x, d.pos.y, d.pos.z), n0: w.n, h0: Math.atan2(f0.x, f0.z), name: w.name, contact: false, fd: 0, n: 0 }; }
      const WR = this.wallRide; WR.lastIn = t;
      // a banked turn away from the wall isn't a ride: the heading swings round and the quad drifts off the wall
      { const fh = d.fwd(); let dh = Math.atan2(fh.x, fh.z) - WR.h0; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        WR.ok = Math.abs(dh) * R2D < 20 && dot(sub(d.pos, WR.p0), WR.n0) < 0.35; }
      if (d.contactThisStep) WR.contact = true;
      const f = d.fwd(); WR.fd += speed > 0.5 ? dot(f, d.vel) / speed : 0; WR.n++;
      if (!WR.emitted && WR.ok && t - WR.t0 > 0.35 && len(sub(d.pos, WR.p0)) > 1.2) {   // live: scores the moment it qualifies
        WR.emitted = true; WR.name2 = WR.fd / Math.max(1, WR.n) < -0.4 ? 'Reverse Wall Ride' : 'Wall Ride';
        this.emit({ name: WR.name2, exec: WR.contact ? 'BUMP' : 'CLEAN', clean: 90, obstacle: WR.name, continuous: true, live: true });
      }
    } else if (this.wallRide && !d.crashed && t - this.wallRide.lastIn < 0.25) {
      // brief wobble off the wall: still the same ride
    } else if (this.wallRide) {
      const L = len(sub(d.pos, this.wallRide.p0));
      const backward = this.wallRide.fd / Math.max(1, this.wallRide.n) < -0.4;
      if (!this.wallRide.emitted && this.wallRide.ok && this.wallRide.lastIn - this.wallRide.t0 > 0.35 && L > 1.2 && !d.crashed) this.emit({ name: backward ? 'Reverse Wall Ride' : 'Wall Ride', exec: this.wallRide.contact ? 'BUMP' : 'CLEAN', clean: 90, obstacle: this.wallRide.name, continuous: true });
      this.wallRide = null;
    }
    // Dive: from high up (>= 10 m), fast descent, pull out low
    if (d.pos.y > 10 && d.armed) this.dive = { t0: t, maxY: Math.max(d.pos.y, this.dive ? this.dive.maxY : 0), fast: false };
    if (this.dive) {
      if (d.vel.y < -6) this.dive.fast = true;
      if (d.pos.y < 2.5 && this.dive.fast && d.vel.y > -1.5 && up.y > 0.4) { this.emit({ name: 'Dive', exec: 'CLEAN', clean: 92, obstacle: 'Brick Building', continuous: true }); this.dive = null; }
      else if (t - this.dive.t0 > 6 || d.crashed) this.dive = null;
    }
    // Stall rewind: climb (>2.5 m/s up) beside something tall, stall, come back down without rotating
    if (d.vel.y > 2.5 && d.armed && !this.climb) this.climb = { t0: t, y0: d.pos.y, p0: v3(d.pos.x, 0, d.pos.z), rot: 0, peak: d.pos.y };
    if (this.climb) {
      const rr = d.pilotRates(); this.climb.rot += (Math.abs(rr[0]) + Math.abs(rr[1])) * dt;
      this.climb.peak = Math.max(this.climb.peak, d.pos.y);
      if (d.vel.y < -2.5 && this.climb.peak - this.climb.y0 > 2.5 && this.climb.rot < 120 && this.nearTall(d, 3)) {
        const back = Math.hypot(d.pos.x - this.climb.p0.x, d.pos.z - this.climb.p0.z);
        if (back < 2.5) this.emit({ name: 'Stall Rewind', exec: 'CLEAN', clean: 88, obstacle: this.nearTall(d, 3), continuous: true });
        this.climb = null;
      } else if (t - this.climb.t0 > 4 || this.climb.rot > 200) this.climb = null;
    }
    // Slide disarm / perch: handled from pilot arm events (see onArmChange)
  }
  onArmChange(d, armed) {
    const t = this.time, speed = len(d.vel);
    if (!armed && !d.crashed) {
      if (d.pos.y < 0.4 && speed > 3) this.slide = { t };
      else if (d.pos.y > 4.5 && speed < 1 && d.up().y > 0.8) this.perch = { t, y: d.pos.y };
    } else if (armed) {
      if (this.slide && t - this.slide.t < 3 && speed > 0.3) this.pendingFly = { name: 'Slide Disarm', t };
      if (this.perch && d.pos.y > 4.4) this.pendingFly = { name: 'Perch', t };
      this.slide = null; this.perch = null;
    }
  }
  postStep(d) {
    if (this.pendingFly && d.pos.y > 0.6 && this.time - this.pendingFly.t < 4 && !d.crashed && len(d.vel) > 1) {
      this.emit({ name: this.pendingFly.name, exec: 'CLEAN', clean: 90, continuous: true }); this.pendingFly = null;
    } else if (this.pendingFly && this.time - this.pendingFly.t > 4) this.pendingFly = null;
  }
  nearWall(d) {
    let best = null;
    for (const o of this.world.objs) {
      if (!(o.kind === 'wall' || o.kind === 'building' || o.kind === 'fence')) continue;
      for (const pr of o.prims) {
        if (pr.type !== 'box') continue;
        const r = sphereVs(pr, d.pos, 1.4); if (!r) continue;
        const dist = 1.4 - r.d; if (Math.abs(r.n.y) > 0.3) continue;
        if (!best || dist < best.dist) best = { dist, n: r.n, name: o.name };
      }
    }
    return best;
  }
  nearObstacle(d, r) {
    for (const o of this.world.objs) { if (!o.obstacle) continue; const { a, b } = o.obstacle;
      const ab = sub(b, a), t = clamp(dot(sub(d.pos, a), ab) / dot(ab, ab), 0, 1), q = add(a, mul(ab, t));
      if (Math.hypot(d.pos.x - q.x, d.pos.z - q.z) < r) return true; }
    return false;
  }
  nearTall(d, h) {
    for (const o of this.world.objs) for (const pr of o.prims) {
      if (pr.aabb.max.y < h) continue;
      const dx = Math.max(pr.aabb.min.x - d.pos.x, 0, d.pos.x - pr.aabb.max.x), dz = Math.max(pr.aabb.min.z - d.pos.z, 0, d.pos.z - pr.aabb.max.z);
      if (Math.hypot(dx, dz) < 2.5) return o.name;
    }
    return null;
  }
  emit(ev) { ev.t = this.time; this.out.push(ev); }
  drain() { const o = this.out; this.out = []; return o; }
}

// ================================================================= LIVE (STREAMING) TRICK RECOGNITION
// Rotation is tokenised live per body axis; every completed token or obstacle pass triggers a match
// against all trick patterns on the *tail* of recent events. A match becomes a "pending" trick shown
// immediately; it locks in after a short hold unless a longer/better trick extends it (Flip → Rubik's,
// Flip → Powerloop), or the closing obstacle pass is still on its way. Tricks claim *time slices* of
// rotations, so one continuous rotation can feed several tricks (chained powerloops).
// Tricktionary demo (Segmented Flips/Rolls GIF, real-time via OSD timer): pauses of ~0.23 s (flip) and ~0.27 s (roll)
// between the two 180s. The written rule says 0.5 s; the demo is how it's actually flown.
const SEG_GAP = 0.18;
const SLOW_TH = 30, SLOW_MAX = 2.5;   // slow-pitch continuation inside loops near an obstacle
const TOK_TH = 95, TOK_END = 0.06, HOLD = 0.08, HOLD_OBST = 1.3, HOLD_MAX = 1.6;
// "air" between the segments of a trick (pilot feedback): whoop tricks are built from basic segments, and real pilots
// leave some space between them (to set up for an object, or just float). Up to AIR_OPEN s between two rotations still
// makes one trick; a pending smaller trick waits that long (while the quad holds steady) for the next segment.
const AIR_OPEN = 1.0;
function rawAt(tok, tt) { const tl = tok.tl; if (!tl || !tl.length) return tt <= tok.t0 ? 0 : tok.raw; if (tt <= tl[0][0]) return 0; if (tt >= tok.t1) return tok.raw;
  let i = 0; while (i < tl.length - 1 && tl[i + 1][0] < tt) i++; const p = tl[i], q = tl[i + 1] || [tok.t1, tok.raw]; return q[0] > p[0] ? p[1] + (q[1] - p[1]) * (tt - p[0]) / (q[0] - p[0]) : p[1]; }
function clipSpans(spans, a, b) { return spans.map(s => ({ tok: s.tok, a: Math.max(s.a, a), b: Math.min(s.b, b) })).filter(s => s.b - s.a > 0.005); }
function sliceTok(T, a, b) { // part of a normalized token between times a..b
  const ra = T.raw0 + (rawAt(T.base, a) - rawAt(T.base, T.t0)), rb = T.raw0 + (rawAt(T.base, b) - rawAt(T.base, T.t0));
  const raw = Math.max(0, (T.base ? rb - ra : T.raw * (b - a) / Math.max(1e-3, T.t1 - T.t0)));
  const f = raw / Math.max(1, T.raw);
  return { ...T, t0: a, t1: b, raw, raw0: T.raw0 + (ra - T.raw0), n: Math.max(1, Math.round(T.n * f)), inv: Math.round(T.inv * f), off: T.off * f, rateSum: T.rateSum * f, rateSq: T.rateSq * f, spans: clipSpans(T.spans, a, b) };
}
function spansOverlap(A, B) { for (const x of A) for (const y of B) if (x.tok === y.tok && Math.min(x.b, y.b) - Math.max(x.a, y.a) > 0.03) return true; return false; }
class StreamDetector extends TrickDetector {
  reset() {
    super.reset();
    this.cur = [null, null, null]; this.toks = []; this.pend = []; this.crashSeen = false; this.nCross = 0; this.lastD = null;
    this.liveTaps = true; this.camTilt = this.camTilt ?? 20; this.live = null; this.lastTrippy = null;
    this.watcher = new Watcher(this); this.vetoes = []; this.reviews = [];   // second judge; reviews go to the game's replay card
    this.fb = []; this.taps = []; this.stalls = []; this.rewinds = []; this.passes = []; this.orbSegs = []; this.faces = [];
    this.orb = {}; this.passTr = {}; this.vst = {}; this.hst = {}; this.lastTapT = -9; this.lastFaceT = -9; this.newEv = []; this.claimUsed = new Set(); this.lastRetrig = 0;
    // anything you can fly around: every free-standing upright post/trunk ≥1.2 m tall (lamp posts, trees, hoop,
    // swing-set legs, slide-tower posts, monkey-bar & jungle-gym uprights, the pilot). Fence posts and wall pipes are excluded.
    this.poles = [];
    for (const o of this.world.objs) {
      if (o.kind === 'fence' || o.kind === 'building' || o.kind === 'wall') continue;
      if (o.kind === 'pilot') { const c = o.prims.find(p => p.type === 'sphere').c; this.poles.push({ id: o.id * 100, objId: o.id, name: 'the pilot', x: c.x, z: c.z, y0: 0, y1: 1.8, point: y => v3(c.x, clamp(y, 0, 1.8), c.z) }); continue; }
      o.prims.forEach((p, i) => {
        if (p.type !== 'capsule' || p.r > 0.25 || p.r < 0.012) return;   // not chains
        const ab = sub(p.b, p.a), L = len(ab); if (L < 1.2 || Math.abs(ab.y) / L < 0.8) return;
        const lo = p.a.y < p.b.y ? p.a : p.b, hi = p.a.y < p.b.y ? p.b : p.a, y0 = lo.y, y1 = hi.y;
        const pt = y => { const f = clamp((y - y0) / (y1 - y0), 0, 1); return v3(lo.x + (hi.x - lo.x) * f, y0 + (y1 - y0) * f, lo.z + (hi.z - lo.z) * f); };
        const mid = pt((y0 + y1) / 2);
        this.poles.push({ id: o.id * 100 + i, objId: o.id, name: o.name, x: mid.x, z: mid.z, y0, y1, point: pt });
      });
    }
  }
  // ---------------------------------------------------------------- building blocks
  viewOf(p, up, f, pt) {
    const c = Math.cos(this.camTilt * D2R), s = Math.sin(this.camTilt * D2R);
    const cam = norm(add(mul(f, c), mul(up, s))), camUp = norm(sub(mul(up, c), mul(f, s)));
    const dir = norm(sub(pt, p)); return { ang: Math.acos(clamp(dot(cam, dir), -1, 1)) * R2D, top: dot(dir, camUp) > 0.05 };
  }
  sense(d, dt, t, rates, up) {
    let ev = false; const f = d.fwd(), vh = Math.hypot(d.vel.x, d.vel.z);
    if (!this.fb.length || t - this.fb[this.fb.length - 1].t >= 0.01) { this.fb.push({ t, p: v3(d.pos.x, d.pos.y, d.pos.z), v: v3(d.vel.x, d.vel.y, d.vel.z), up, f, rc: this.lastRc }); if (this.fb.length > 900) this.fb.shift(); }
    // deliberate taps: soft contact with anything but the ground, remembering which side of the quad touched
    if (d.contactThisStep && d.armed && !d.crashed && !d.contactGround && d.contactNormal) {
      const o = this.world.objs[d.contactOwner];
      if (o && o.kind === 'pilot' && t - this.lastFaceT > 1 && d.pos.y > 1.35) { this.lastFaceT = t; this.faces.push({ t, id: 'face' + t.toFixed(3), obj: o.id }); this.newEv.push('face'); ev = true; }
      else if (d.lastImpact < 3.2 && t - this.lastTapT > 0.25) {
        const n = d.contactNormal, nB = qinv(d.q, n);
        const face = nB.y > 0.55 ? 'bottom' : nB.y < -0.55 ? 'top' : 'side';
        const surface = n.y < -0.6 ? 'ceiling' : Math.abs(n.y) < 0.5 ? 'wall' : 'top';
        this.lastTapT = t; this.taps.push({ t, obj: d.contactOwner, kind: o && o.kind, wallish: !!(o && (o.kind === 'wall' || o.kind === 'building' || o.wallNormal)), name: o && o.name, face, surface, impact: d.lastImpact, id: 'tap' + t.toFixed(3) });
        this.newEv.push('tap'); ev = true;
      }
    }
    // vertical stall: climbing → apex → falling
    const vs = this.vst;
    if (d.vel.y > 1.5) { if (!vs.climb) { vs.climb = true; vs.t0 = t; vs.y0 = d.pos.y; } vs.apexT = null; }
    else if (vs.climb && d.vel.y < 0.3 && vs.apexT == null) { vs.apexT = t; vs.apexY = d.pos.y; }
    if (vs.climb && vs.apexT != null && d.vel.y < -1.0) { this.stalls.push({ t0: vs.t0, tApex: vs.apexT, yApex: vs.apexY, climb: vs.apexY - vs.y0, t }); vs.climb = false; vs.apexT = null; this.newEv.push('stall'); ev = true; }
    if (vs.climb && t - vs.t0 > 4) vs.climb = false;
    // horizontal rewind: moving one way → stop → moving back the way you came
    const hs = this.hst;
    if (vh > 1.5) {
      const u = v3(d.vel.x / vh, 0, d.vel.z / vh);
      if (hs.slowT != null && hs.uBefore) {
        if (dot(u, hs.uBefore) < -0.5 && t - hs.slowT < 2.5) { this.rewinds.push({ t0: hs.slowT, t1: t, p: v3(d.pos.x, d.pos.y, d.pos.z), id: 'rw' + t.toFixed(3) }); this.newEv.push('rewind'); ev = true; }
        hs.slowT = null;
      }
      hs.u = u; hs.uBefore = u;
    } else if (vh < 0.7 && hs.u && hs.slowT == null) hs.slowT = t;
    if (hs.slowT != null && t - hs.slowT > 2.5) hs.slowT = null;
    // poles: passes (closest approach then clear) and orbits (angle swept around the pole)
    for (const P of this.poles) {
      const at = P.point(d.pos.y), dx = d.pos.x - at.x, dz = d.pos.z - at.z, dist = Math.hypot(dx, dz);
      const inY = d.pos.y > P.y0 - 0.3 && d.pos.y < P.y1 + 1.5;
      const pt = this.passTr[P.id] || (this.passTr[P.id] = { dmin: 99, tc: 0 });
      if (dist > 6 || !inY) { pt.dmin = 99; pt.lock = false; pt.far = 0; }
      else if (pt.lock) { pt.far = Math.max(pt.far || 0, dist); if (dist < pt.far - 0.3) { pt.lock = false; pt.far = 0; pt.dmin = dist; pt.tc = t; } }   // one pass per approach: wait until it heads back in
      else { if (dist < pt.dmin) { pt.dmin = dist; pt.tc = t; }
        if (pt.dmin < 2.5 && dist > pt.dmin + 1.1) { this.passes.push({ obj: P.id, name: P.name, tc: pt.tc, dmin: pt.dmin, t, id: 'pass' + P.id + '@' + pt.tc.toFixed(2) }); pt.dmin = 99; pt.lock = true; pt.far = dist; this.newEv.push('pass'); ev = true; } }
      let ob = this.orb[P.id]; const ang = Math.atan2(dz, dx);
      const rMax = Math.max(5.5, Math.min(9, 2 + (P.y1 - P.y0) * 0.75));   // big spins: tall poles (flagpole, trees) get wider trippies
      if (dist < 0.25 || dist > rMax || !inY || !d.armed) { if (ob && ob.acc > 0) { this.endOrbit(P, ob, 'exit'); ev = true; } this.orb[P.id] = null; continue; }
      if (!ob) { this.orb[P.id] = { acc: 0, dir: 0, t0: t, t1: t, lastAng: ang, n: 0, inv: 0, view: 0, top: 0, roll: 0, rev: 0, still: 0, flips: 0, st: 0, tAcc: 0, oAcc: 0, run: 0, rs: 0, rs2: 0, rn: 0, ws: 0, ws2: 0 }; continue; }
      let da = ang - ob.lastAng; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; ob.lastAng = ang;
      // "stopped orbiting" goes by ground speed round the pole, not just angle: a wide lap of a tall pole is slow in
      // degrees (pilot: flagpole trippies weren't detected), and an uneven one may nearly stop for a moment
      if (Math.abs(da) / dt < Math.min(25 * D2R, 0.8 / Math.max(dist, 0.5))) { ob.still += dt; if (ob.still > 1.0 && ob.acc > 0) { this.endOrbit(P, ob, 'exit'); ev = true; this.orb[P.id] = null; } continue; }
      ob.still = 0; const sg = Math.sign(da);
      if (!ob.dir) { ob.dir = sg; ob.t0 = t; }
      if (sg === ob.dir) {
        ob.acc += Math.abs(da) * R2D; ob.rev = 0; ob.n++; ob.t1 = t; if (up.y < 0.15) ob.inv++;   // trippies are rolled to knife-edge or past it (a banked upright lap is ~0.5)
        const vi = this.viewOf(d.pos, up, f, P.point(d.pos.y)); if (vi.ang < 55) ob.view++;
        { const ys = [-3, -2, -1, 1, 2, 3].map(dy => d.pos.y + dy); for (let y = d.pos.y + 4.5; y < P.y1; y += 1.5) ys.push(y); ys.push(P.y1);   // any part of it, up to the top of a tall pole
          const topVis = ys.some(y => { const vt = this.viewOf(d.pos, up, f, P.point(y)); return vt.top && vt.ang < 75; }); if (topVis) ob.top++;   // pole held in the top half of the screen
          // Trippy by what the pilot SEES (pilot: use visual confirmation more, forgive the way in and out): the pole held in
          // the top of the picture while rolled well over. Only that stretch is the trippy: an upright lap on the way in or
          // out, or a flip into it, isn't counted for or against. Its radius and pace are kept to judge how tidy it was.
          const dA = Math.abs(da) * R2D, pose = topVis && up.y < 0.35;
          if (pose) { ob.tAcc += dA; ob.lastPose = t; if (ob.poseT0 == null) { ob.run += dA; if (ob.run > 20) { ob.poseT0 = t; ob.accStart = ob.acc - ob.run; } }
            ob.rs += dist; ob.rs2 += dist * dist; ob.rn++; const wr = dA / dt; ob.ws += wr; ob.ws2 += wr * wr; }
          else if (ob.poseT0 == null) ob.run = 0;
          if (up.y > 0.35 && vi.ang < 55) ob.oAcc += dA; }
        ob.roll += rates[0] * dt;
        const st = up.y > 0.35 ? 1 : up.y < -0.35 ? -1 : 0; if (st && ob.st && st !== ob.st) ob.flips++; if (st) ob.st = st;   // upright <-> inverted changes
        if (ob.poseT0 != null && t - ob.lastPose > 0.9 && this.live && this.live.ob === ob && this.live.name === 'Trippy Spin x2') { this.endOrbit(P, ob, 'exit'); ev = true; this.orb[P.id] = null; continue; }
      } else { ob.rev += Math.abs(da) * R2D; if (ob.rev > 30) { if (ob.acc > 0) { this.endOrbit(P, ob, 'reverse'); ev = true; } this.orb[P.id] = { acc: 0, dir: sg, t0: t, t1: t, lastAng: ang, n: 0, inv: 0, view: 0, top: 0, roll: 0, rev: 0, still: 0, flips: 0, st: 0, tAcc: 0, oAcc: 0, run: 0, rs: 0, rs2: 0, rn: 0, ws: 0, ws2: 0 }; } }
    }
    this.updateLive(t);
    this.taps = this.taps.filter(x => t - x.t < 8); this.stalls = this.stalls.filter(x => t - x.t < 8); this.rewinds = this.rewinds.filter(x => t - x.t1 < 8);
    this.passes = this.passes.filter(x => t - x.t < 8); this.orbSegs = this.orbSegs.filter(x => t - x.t1 < 10); this.faces = this.faces.filter(x => t - x.t < 4);
    return ev;
  }
  // ---- live orbit tricks (Trippy Spin, Orbit, Double Rolling Trippy): count every half lap, bank on exit, lose on crash
  orbSpan(ob) { return ob.poseT0 != null ? ob.acc - ob.accStart : 0; }   // degrees swept since the trippy view was first held
  orbitKind(ob) {
    if (!ob || !ob.n) return null;
    const span = this.orbSpan(ob), laps = Math.max(0.25, ob.acc / 360), inv = ob.inv / ob.n, view = ob.view / ob.n, rollPerLap = Math.abs(ob.roll) / laps;
    // a Double Rolling Trippy barrel-rolls THROUGH UPRIGHT every lap; a trippy leaning hard into the pole also piles up body
    // roll (more so with a tilted camera) but never comes upright (pilot feedback: trippies were read as DRT)
    if (ob.acc >= 150 && rollPerLap >= 300 && (ob.flips || 0) / 2 / laps >= 0.75) return 'Double Rolling Trippy Spin';
    if (span >= 120 && ob.tAcc / span >= 0.55) return 'Trippy Spin x2';
    if (ob.acc >= 150 && inv < 0.35 && view >= 0.6 && ob.tAcc < 0.25 * ob.acc) return 'Orbit x2';
    return null;
  }
  orbLapDeg(ob, kind) { return kind === 'Trippy Spin x2' ? this.orbSpan(ob) : ob.acc; }
  updateLive(t) {
    // the post with the most sweep owns the live trick (circling the slide tower sweeps all 4 posts at once)
    let best = null, bestP = null;
    for (const P of this.poles) { const ob = this.orb[P.id]; if (ob && ob.acc > (best ? best.acc : 0) && this.orbitKind(ob)) { best = ob; bestP = P; } }
    const L = this.live;
    if (L && this.orb[L.key] && this.orb[L.key] === L.ob) { const k = this.orbitKind(L.ob); if (k) L.name = k; L.laps = Math.floor((this.orbLapDeg(L.ob, L.name) + 40) / 180) / 2; L.t1 = t; if (L.name === 'Trippy Spin x2') L.t0 = L.ob.poseT0; }
    else if (!L && best) this.live = { key: bestP.id, objId: bestP.objId, pole: bestP.name, ob: best, name: this.orbitKind(best), dir: best.dir, t0: this.orbitKind(best) === 'Trippy Spin x2' ? best.poseT0 : best.t0, t1: t, laps: Math.floor((this.orbLapDeg(best, this.orbitKind(best)) + 40) / 180) / 2 };
    const N = this.live;
    if (N && this.lastTrippy && !N.switched && N.name !== 'Orbit x2' && N.objId === this.lastTrippy.objId && N.dir !== this.lastTrippy.dir && N.t0 - this.lastTrippy.t < 1.6 && N.laps >= 0.5) {
      N.switched = true; this.emit({ name: 'Trippy Switch', exec: 'CLEAN', clean: 95, obstacle: N.pole, toks: [], live: true }); this.lastTrippy = null;
    }
  }
  finishLive(reason) {
    const L = this.live; this.live = null; if (!L) return;
    const d = this.lastD; if (!d || d.crashed || !d.armed) return;            // bailed: nothing banks
    if (L.laps < 1) return;                                                  // under one lap doesn't count
    const base = trickPoints(L.name) * L.laps / 2;                           // TPW values are for two laps
    for (const k of this.toks) if (k.t1 > L.t0 && k.t0 < L.t1) k.usedUntil = Math.max(k.usedUntil, k.t1);
    for (const sg of this.orbSegs) if (sg.t1 > L.t0 - 0.3 && sg.t0 < L.t1 + 0.3) this.claimUsed.add(sg.id);
    // how tidy: an even circle at an even pace, holding the view, is clean; egg shapes, surging and losing the view are sloppy
    let clean = 92, notes = []; const ob = L.ob;
    if (L.name === 'Trippy Spin x2' && ob && ob.rn > 20) { const mr = ob.rs / ob.rn, cvR = Math.sqrt(Math.max(0, ob.rs2 / ob.rn - mr * mr)) / mr, mw = ob.ws / ob.rn, cvW = Math.sqrt(Math.max(0, ob.ws2 / ob.rn - mw * mw)) / (mw || 1), hold = ob.tAcc / Math.max(1, this.orbSpan(ob));
      clean = Math.round(Math.max(40, 100 - Math.max(0, cvR - 0.06) * 120 - Math.max(0, cvW - 0.2) * 40 - (1 - hold) * 60));
      if (cvR > 0.15) notes.push('uneven circle'); if (cvW > 0.4) notes.push('uneven pace'); if (hold < 0.8) notes.push('lost the view at times'); }
    this.emit({ name: L.name, exec: clean < 70 ? 'SLOPPY' : 'CLEAN', clean, notes, obstacle: L.pole, basePts: Math.round(base), laps: L.laps, toks: [], live: true, draft: true });
    if (reason === 'reverse' && L.name !== 'Orbit x2') this.lastTrippy = { objId: L.objId, dir: L.dir, t: this.time };
  }
  liveState() {
    const out = [];
    if (this.live && this.live.laps >= 0.5) out.push({ name: this.live.name, laps: this.live.laps, pts: Math.round(trickPoints(this.live.name) * this.live.laps / 2), counts: this.live.laps >= 1 });
    if (this.wallRide && this.wallRide.emitted) out.push({ name: this.wallRide.name2 || 'Wall Ride', meters: len(sub(this.lastD.pos, this.wallRide.p0)) });
    return out;
  }
  endOrbit(P, ob, reason) {
    const c0 = ob && ob.poseT0 != null ? ob.poseT0 - 0.1 : ob ? ob.t0 - 0.3 : 0;
    if (ob && ob.acc > 270) { for (const k of this.toks) if (k.t0 >= c0 && k.t0 <= ob.t1) k.usedUntil = Math.max(k.usedUntil, k.t1); for (const c of this.cur) if (c && c.t0 >= c0 + 0.3 - 0.3) c.usedUntil = this.time; }   // rotation during an orbit is the orbit's, not a separate roll
    if (this.live && this.live.ob === ob) this.finishLive(reason);
    if (ob.acc < 250 || !ob.n) return;
    this.orbSegs.push({ obj: P.id, name: P.name, dir: ob.dir, acc: ob.acc, t0: ob.t0, t1: ob.t1, inv: ob.inv / ob.n, view: ob.view / ob.n, top: ob.top / ob.n, roll: ob.roll, id: 'orb' + P.id + '@' + ob.t0.toFixed(2) });
    this.newEv.push('orbit');
  }
  // Rates for rotation tokens. A spin around the WORLD vertical with the body held tilted (an inverted yaw spin with a
  // 30° camera: the pilot keeps the horizon in view) shows up in body rates as yaw·cos(tilt) plus a steady pitch/roll
  // component. When rotation about the vertical clearly dominates body yaw, count it as yaw (heading change) and keep
  // only the rest as pitch/roll. Plain body-yaw spins and flips are unchanged.
  tokRates(d, rates) {
    const g = qinv(d.q, v3(0, 1, 0));                                  // world up, in body axes (x right, y up, z back)
    if (Math.abs(g.y) < 0.5) return rates;
    const w = d.w, h = w.x * g.x + w.y * g.y + w.z * g.z;
    const wm = Math.hypot(w.x, w.y, w.z);
    if (!(Math.abs(h) > 0.85 * wm && Math.abs(h) > Math.abs(w.y) * 1.03 && Math.abs(h) * R2D > 60)) return rates;   // only a spin about the vertical
    const px = w.x - h * g.x, pz = w.z - h * g.z;
    return [-pz * R2D, px * R2D, -h * Math.sign(g.y) * R2D];
  }
  // Angle swept by the direction of travel in the vertical plane of the move (degrees, + = up/over the top the way a
  // powerloop goes). A real loop's path turns ~360 with the pitch; a flip in place barely moves; a Matty's path turns
  // ~180 the other way (forward, down, then backward).
  pathSweep(a, b) {
    const W = this.fbIn(a, b).filter(x => Math.hypot(x.v.x, x.v.y, x.v.z) > 0.6); if (W.length < 6) return { sweep: 0, speed: 0, rise: 0 };
    const v0 = W[0].v, hl = Math.hypot(v0.x, v0.z) || 1, hx = v0.x / hl, hz = v0.z / hl;
    let prev = null, acc = 0, sp = 0;
    for (const x of W) { const g = Math.atan2(x.v.y, x.v.x * hx + x.v.z * hz); if (prev != null) { let d = g - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; acc += d; } prev = g; sp += Math.hypot(x.v.x, x.v.y, x.v.z); }
    const ys = W.map(x => x.p.y); return { sweep: acc * R2D, speed: sp / W.length, rise: Math.max(...ys) - Math.min(...ys) };
  }
  // Loops and Mattys flown in open air (pilot request): the powerloop family when the path loops round with the pitch,
  // the Matty family when the path goes forward -> down -> backward and the quad ends flying backward.
  matchOpenLoop(toks) {
    if (!toks.length || !toks.some(k => k.ax === 'P' && k.raw >= 250)) return null;
    const t0 = toks[0].t0, t1 = toks[toks.length - 1].t1;
    if (this.crossLog.some(c => (c.kind === 'U' || (c.kind === 'O' && !(c.hOver > 2.5))) && c.t > t0 - 1.2 && c.t < Math.max(t1, this.time) + 0.3)) return null;   // passed an obstacle (not just high above one): the obstacle version decides
    const ps = this.pathSweep(t0 - 0.25, t1 + 0.25);
    if (ps.speed < 1.6 || ps.rise < 0.8) return null;
    let best = null;
    for (const tr of OBSTACLE_TRICKS) {
      const loopFam = tr.cross === 'UOU' && !tr.tap && !/Mav|Donkey|Half Mavvy|Power Swap|Power Switch|Barani|Rollani|Flipani/.test(tr.name);
      const mattyFam = tr.cross === 'OU' && tr.end === 'back';
      if (!loopFam && !mattyFam) continue;
      if (loopFam && !(ps.sweep >= 270)) continue;
      if (mattyFam && !(ps.sweep <= -120 && this.backFrac(this.time - 0.3, this.time) >= 0.6)) continue;
      for (const pp of tr.parsed) { const m = matchTokens(pp, toks); if (!m) continue;
        const cand = { name: tr.name, toks, err: m.err + 0.05, clen: 0.5, obstacle: 'open air', openAir: true };
        if (!best || better(cand, best)) best = cand; }
    }
    return best;
  }
  keptInView(pt, a, b, frac) { if (!pt) return true; const W = this.fbIn(a, b); if (!W.length) return false;
    return W.filter(x => this.viewOf(x.p, x.up, x.f, pt).ang < 75).length / W.length >= frac; }
  // fraction of frames with some part of the pole (from 1.5 m below you to 3 m above, within its length) near the middle of the picture
  poleView(P, a, b, ang) { const W = this.fbIn(a, b); if (!W.length || !P) return 0;
    return W.filter(x => [-1.5, -0.75, 0, 0.75, 1.5, 3].some(dy => { const y = x.p.y + dy; if (y < P.y0 - 0.2 || y > P.y1 + 0.2) return false; return this.viewOf(x.p, x.up, x.f, P.point(y)).ang < ang; })).length / W.length; }
  headingTurn(a, b) { const W = this.fbIn(a, b); if (W.length < 2) return 0; const hd = x => { const v = Math.abs(x.up.y) > 0.3 ? x.f : x.up; return Math.atan2(v.x * Math.sign(x.up.y || 1), v.z * Math.sign(x.up.y || 1)); };
    const h0 = hd(W[0]), h1 = hd(W[W.length - 1]); let d = Math.abs(h1 - h0) * R2D; if (d > 180) d = 360 - d; return d; }
  maxTilt(a, b) { const W = this.fbIn(a, b); return W.length ? Math.max(...W.map(x => Math.acos(clamp(x.up.y, -1, 1)) * R2D)) : 0; }
  maxSideTilt(a, b) { const W = this.fbIn(a, b); return W.length ? Math.max(...W.map(x => { const r = cross(x.f, x.up); return Math.asin(clamp(Math.abs(r.y), 0, 1)) * R2D; })) : 0; }
  orbiting() { return Object.values(this.orb).some(o => o && o.acc > 150 && (this.orbSpan(o) > 60 || o.oAcc > 150 || (o.flips || 0) >= 2)); }
  tapIn(spec, obj, a, b) {
    return this.taps.find(x => !this.claimUsed.has(x.id) && x.t >= a && x.t <= b && (obj == null || x.obj === obj) &&
      (!spec.face || spec.face === 'any' || x.face === spec.face) && (!spec.surface || spec.surface === 'any' || x.surface === spec.surface)) || null;
  }
  fbIn(a, b) { return this.fb.filter(x => x.t >= a && x.t <= b); }
  sweptBetween(a, b) { const W = this.fbIn(a, b); let s = 0; for (let i = 1; i < W.length; i++) s += Math.acos(Math.max(-1, Math.min(1, dot(W[i - 1].up, W[i].up)))); return s * R2D; }
  minUpBetween(a, b) { const W = this.fbIn(a, b); return W.length ? Math.min(...W.map(x => x.up.y)) : 1; }
  // the same, judged by the camera (what the pilot sees): with a 30° camera, a maverick's nose-down descent has the body
  // ~110° nose down while the view is still forward-looking
  minCamUpBetween(a, b) { const W = this.fbIn(a, b); if (!W.length) return 1; const c = Math.cos(this.camTilt * D2R), s = Math.sin(this.camTilt * D2R);
    return Math.min(...W.map(x => x.up.y * c - x.f.y * s)); }
  // stayed upright by the body OR by the camera view: pilots hold the quad differently for different camera angles
  stayedUpright(a, b) { return Math.max(this.minUpBetween(a, b), this.minCamUpBetween(a, b)) > 0.1; }
  backFrac(a, b) { const W = this.fbIn(a, b).filter(x => Math.hypot(x.v.x, x.v.z) > 0.8); if (!W.length) return 0;
    return W.filter(x => { const fh = Math.hypot(x.f.x, x.f.z) || 1, vh = Math.hypot(x.v.x, x.v.z); return (x.f.x * x.v.x + x.f.z * x.v.z) / (fh * vh) < -0.35; }).length / W.length; }
  trackFrac(a, b) { // best fraction of time any pole or obstacle stayed in the camera view
    const W = this.fbIn(a, b); if (!W.length) return 0; let best = 0;
    const pts = [...this.poles.map(P => y => P.point(y)), ...this.world.objs.filter(o => o.obstacle).map(o => { const m = mul(add(o.obstacle.a, o.obstacle.b), 0.5); return () => v3(m.x, o.obstacle.under, m.z); })];
    for (const pt of pts) { let k = 0; for (const x of W) if (len(sub(pt(x.p.y), x.p)) < 8 && this.viewOf(x.p, x.up, x.f, pt(x.p.y)).ang < 40) k++; best = Math.max(best, k / W.length); }
    return best;
  }
  // a context trick's situation: null if not met, else what it claims
  reqOK(req, toks) {
    const t0 = toks[0].t0, t1 = toks[toks.length - 1].t1, now = this.time, out = { claims: [] };
    if (req.tap) { const tp = this.tapIn(req.tap, null, t0 - 0.2, t1 + 0.25); if (!tp) return null; out.claims.push(tp.id); out.tapRef = tp; out.obstacle = tp.name; }
    if (req.climbBefore && !this.fbIn(t0 - 1.5, t0 + 0.05).some(x => x.v.y > 1.5)) return null;
    if (req.nearTall) { const s0 = this.fbIn(t0 - 0.05, t0 + 0.05)[0]; const nm = s0 && this.nearTall({ pos: s0.p }, req.nearTall === true ? 3 : req.nearTall); if (!nm) return null; out.obstacle = out.obstacle || nm;
      // a stall rewind rises beside the object and comes back down: it never passes over/under one (loops, jump ropes do)
      if (req.nearTall !== true && this.crossLog.some(c => (c.kind === 'U' || c.kind === 'O') && c.t > t0 - 1.0 && c.t < Math.max(t1, now) + 0.1)) return null;
      if (req.stallIn && req.nearTall !== true) {   // flip/roll at the stall: nearly in place, unlike a loop beside the object
        const W = this.fbIn(t0, t1); if (W.length > 2) { const ext = k => Math.max(...W.map(x => x.p[k])) - Math.min(...W.map(x => x.p[k]));
          if (Math.hypot(ext('x'), ext('z')) > 1.6 || ext('y') > 1.6) return null; } } }
    if (req.stallIn && !this.stalls.some(x => x.tApex >= t0 - 0.45 && x.tApex <= t1 + 0.45 && x.climb >= 1.0)) return null;
    if (req.rewindIn) { const rw = this.rewinds.find(x => x.t1 >= t0 - 0.3 && x.t0 <= t1 + 1.0 && !this.claimUsed.has(x.id)); if (!rw) return null; out.claims.push(rw.id); }
    if (req.endBack && this.backFrac(now - 0.3, now) < 0.6) return null;
    if (req.track) { const yk = toks.find(k => k.ax === 'Y'); if (this.trackFrac(yk ? yk.t0 : t0, yk ? yk.t1 : t1) < req.track) return null; }   // the yaw segment itself keeps it centred (not the air around it)
    if (req.segmented && !toks.some(k => (k.segments || 1) >= 2 && (k.maxGap || 0) >= 0.2) && !(toks.length >= 2 && toks[1].t0 - toks[0].t1 >= 0.2)) return null;
    return out;
  }
  reqPre(req, toks) {  // could this situation still complete? (used to hold a simpler trick a little longer)
    const t0 = toks[0].t0, d = this.lastD; if (!d) return false;
    if (req.tap) { const w = this.nearWall(d); const ceil = this.world.prims.some(p => p.aabb.min.y > d.pos.y && p.aabb.min.y - d.pos.y < 0.7 && d.pos.x > p.aabb.min.x && d.pos.x < p.aabb.max.x && d.pos.z > p.aabb.min.z && d.pos.z < p.aabb.max.z);
      if (!((w && w.dist < 0.7) || ceil)) return false; }
    if (req.climbBefore && !this.fbIn(t0 - 1.5, t0 + 0.05).some(x => x.v.y > 1.5)) return false;
    if (req.stallIn && !(this.vst.climb || this.stalls.some(x => x.tApex >= t0 - 0.45))) return false;
    if (req.segmented && !toks.some(k => (k.segments || 1) >= 2 && (k.maxGap || 0) >= 0.2)) return false;   // a continuous flip can't become a segmented one
    if (req.rewindIn && !(this.hst.slowT != null || this.rewinds.some(x => x.t1 >= t0 - 0.3))) return false;
    if (req.endBack && Math.hypot(d.vel.x, d.vel.z) > 2.5 && this.backFrac(this.time - 0.2, this.time) < 0.2) return false;
    if (req.track && !this.poles.some(P => Math.hypot(d.pos.x - P.x, d.pos.z - P.z) < 6)) return false;
    return true;
  }
  toksIn(a, b) { return this.normalized().filter(x => x.t1 > a && x.t0 < b); }
  eventCands(t) {
    const out = [], fresh = this.newEv; this.newEv = [];
    const mk = (o) => { const c = { err: 0.1, clen: 2, draft: true, toks: [], ...o }; c.t0 = c.t0 ?? (c.toks[0] ? c.toks[0].t0 : t); c.tDone = c.tDone ?? t; out.push(c); };
    for (const tp of this.taps) if (!this.claimUsed.has(tp.id) && t - tp.t < 1.5 && tp.face === 'bottom' && tp.surface === 'wall' && tp.wallish)
      mk({ name: 'Wall Tap', clen: 0.5, draft: false, t0: tp.t, tDone: tp.t, claims: [tp.id], tapRef: tp, obstacle: tp.name, holdIfSpin: true });
    for (const fc of this.faces) if (!this.claimUsed.has(fc.id)) mk({ name: 'Facepunch', clen: 0.5, t0: fc.t, tDone: fc.t, claims: [fc.id], tapRef: fc, obstacle: 'the pilot', draft: false });
    if (fresh.includes('pass')) for (const ps of this.passes.filter(x => x.t === t && !this.claimUsed.has(x.id))) {
      const P = this.poles.find(p => p.id === ps.obj);
      // pilot feedback: pole tricks were hard to get. Passing close beside a pole puts the bit at your own height out at the
      // side of the picture, but you're still looking at the pole (above/below you): any part of it in view counts. And a
      // whip round the pole often reads as a heading swing (yaw) rather than roll, with a 30° camera.
      const vf = this.poleView(P, ps.tc - 0.3, t, 60);
      // heading from before the move began to now (this whip's own rotations; a slow cradle's can start up to 3 s back)
      const toks = this.toksIn(ps.tc - 1.5, t), turn = this.headingTurn(Math.min(ps.tc - 0.8, ...toks.map(k => k.t0 - 0.2)), t), tilt = this.maxTilt(ps.tc - 0.8, t);
      const turnC = this.headingTurn(Math.min(ps.tc - 0.8, ...this.toksIn(ps.tc - 3.0, t).map(k => k.t0 - 0.2)), t);
      const pPlus = this.toksIn(ps.tc - 3.0, t).some(x => x.ax === 'P' && x.dir > 0 && x.raw >= 60), pMinus = toks.some(x => x.ax === 'P' && x.dir < 0 && x.raw >= 45);   // a slow cradle's pitch back can start well before the pass back
      const rAny = toks.some(x => x.ax === 'R' && x.raw >= 60) || (turn >= 100 && tilt >= 50), bigR = toks.some(x => x.ax === 'R' && x.raw >= 150), back = this.backFrac(t - 0.35, t) > 0.6;
      // an over/under pass in the same moment belongs to an obstacle trick (Split-S, loops, Mattys), not a pole trick
      const obst = this.crossLog.some(c => c.kind === 'O' && c.t > ps.tc - 3.5 && c.t < t + 0.1);   // (passing under a canopy or bar is fine)
      const bumped = this.contacts.some(c => c.t > ps.tc - 1.2 && c.t < t + 0.05);   // knocked round by hitting something isn't a whip
      const pBack = toks.some(x => x.ax === 'P' && x.dir > 0 && x.raw >= 120) || this.cur.some(c => c && c.ax === 'P' && c.dir > 0 && c.raw >= 90);   // a big pitch back (even one still going: a loop) is a snap/cradle/loop, not a whip
      // pilot: lots of ordinary movement round a pole was being called a Whiplash. It has to be the real thing: a close pass,
      // whipped right round (heading turns ~180) with the pole kept in view, coming out level and travelling backward away
      // from it — and the game now waits to see that it holds (the Watcher's check, 0.7 s later) before confirming.
      const levelOut = !!this.lastD && this.lastD.up().y > 0.55;
      const rewound = this.rewinds.some(r => r.t1 > ps.tc - 1.5 && r.t0 < t);   // stopping and going back the way you came is a rewind, not a whip
      if (!obst && !pBack && !bumped && !rewound && ps.dmin < 2.0 && vf >= 0.65 && turn >= 135 && back && levelOut && rAny) {
        const prev = this.pend.find(p => p.name === 'Whiplash' && p.poleObj === ps.obj && t - p.tDone < 5);
        if (prev) mk({ name: 'Pole Dance', obstacle: ps.name, toks: this.toksIn(prev.t0, t), t0: prev.t0, claims: [...prev.claims, ps.id] });
        else mk({ name: 'Whiplash', obstacle: ps.name, toks, t0: ps.tc - 1.0, claims: [ps.id], poleObj: ps.obj, holdNearPole: ps.obj });
      } else if (!obst && vf >= 0.4 && pPlus && pMinus && !bigR && back && turnC < 60) mk({ name: 'Cradle', obstacle: ps.name, toks, t0: ps.tc - 1.0, claims: [ps.id] });
    }
    if (fresh.includes('rewind')) { const rw = this.rewinds[this.rewinds.length - 1];
      if (rw && !this.claimUsed.has(rw.id)) { const P = this.poles.find(p => Math.hypot(rw.p.x - p.x, rw.p.z - p.z) < 3);
        if (P) { const vf = this.poleView(P, rw.t0 - 1.2, rw.t1, 60);
          const toks = this.toksIn(rw.t0 - 1.5, rw.t1 + 0.2), side = this.maxSideTilt(rw.t0 - 1.2, rw.t1);
          const passed = this.crossLog.some(c => (c.kind === 'O' || (c.kind === 'U' && c.upY < 0.3)) && c.t > rw.t0 - 1.5 && c.t < rw.t1 + 0.1);   // Split-S etc. turn back too (upright under a tree canopy is fine)
          // flown flat: past it and back the way you came (a climb-and-fall-back is a stall rewind), with a quarter roll, not a full one
          const climbed = this.fbIn(rw.t0 - 2.5, rw.t1).some(x => x.v.y > 1.2), fullRoll = toks.some(x => x.ax === 'R' && x.raw >= 250);
          if (!passed && !climbed && !fullRoll && vf >= 0.45 && (toks.some(x => x.ax === 'R' && x.raw >= 60) || side >= 55)) mk({ name: 'Side-Lock Rewind', obstacle: P.name, toks, t0: rw.t0 - 1.0, claims: [rw.id] }); } } }
    return out;
  }
  update(d, dt, rc) {
    this.time += dt; this.lastD = d; this.lastRc = rc ? { thr: rc.thr ?? 0, roll: rc.roll ?? 0, pitch: rc.pitch ?? 0, yaw: rc.yaw ?? 0 } : null;
    const t = this.time, rates = d.pilotRates(), up = d.up(), trates = this.tokRates(d, rates);
    this.trackCrossings(d, t);
    const newCross = this.crossLog.length !== this.nCross; this.nCross = this.crossLog.length;
    this.continuousDetectors(d, dt, t, rc);
    if (d.contactThisStep && d.armed) this.contacts.push({ t, owner: d.contactOwner, impact: d.lastImpact, n: d.contactNormal, up });
    this.contacts = this.contacts.filter(c => t - c.t < 6);
    const ctxEv = this.sense(d, dt, t, rates, up);
    if (d.crashed && !this.crashSeen) {               // finished tricks still count; anything mid-air is lost
      this.crashSeen = true;
      for (const p of [...this.pend].sort((a, b) => a.t0 - b.t0)) if (p.tDone < t - 0.15) this.commit(p, t);
      this.pend = []; this.cur = [null, null, null]; this.toks.forEach(k => k.usedUntil = k.t1); this.live = null; this.orb = {};
      this.pushDebug({ t: +t.toFixed(2), toks: '', cross: '', result: ['Crash'], near: null });
      this.emit({ name: 'Crash', exec: 'CRASH', pts: 0, toks: [] }); return;
    }
    if (!d.crashed) this.crashSeen = false;
    let finished = false; const loopCtx = this.crossLog.some(c => t - c.t < 4);
    for (let k = 0; k < 3; k++) {
      const r = trates[k], ar = Math.abs(r), c = this.cur[k];
      if (c) {
        if (ar >= TOK_TH && Math.sign(r) === c.dir) {
          if (c.slow) { c.raw += c.slow; c.slow = 0; c.slowT = 0; c.slowCross = false; }   // slow stretch rejoined: one rotation
          c.raw += ar * dt; c.t1 = t; c.low = 0; c.n++; if (up.y < -0.2) c.inv++;
          c.off += (Math.abs(trates[(k + 1) % 3]) + Math.abs(trates[(k + 2) % 3])) * dt; c.rateSum += ar; c.rateSq += ar * ar;
          if (t - c.tl[c.tl.length - 1][0] >= 0.01) c.tl.push([t, c.raw]);
        } else if (ar >= TOK_TH) { this.finishTok(k); finished = true; this.startTok(k, r, t, up, dt); }
        else if (k === 1 && ar >= SLOW_TH && Math.sign(r) === c.dir && (c.slowT || 0) < SLOW_MAX && loopCtx) {
          // big floaty loops (demo: powerloop round a tall statue) pitch well under TOK_TH for seconds at a time:
          // keep the pitch token open while it keeps turning the same way near an obstacle
          c.slow = (c.slow || 0) + ar * dt; c.slowT = (c.slowT || 0) + dt; c.low = 0; if (newCross) c.slowCross = true;
        }
        else { c.low += dt; if (c.low > TOK_END) { this.finishTok(k); finished = true; } }
      } else if (ar >= TOK_TH && d.armed) this.startTok(k, r, t, up, dt);
    }
    if (finished || ctxEv) this.trigger(t, false);
    if (newCross) this.trigger(t, true);
    // tricks waiting on a situation (rewind, flying backward, …) get re-checked a few times a second
    if (this.pend.some(p => p.hold === HOLD_OBST) && t - this.lastRetrig > 0.1) { this.lastRetrig = t; this.trigger(t, false); }
    for (const p of [...this.pend].sort((a, b) => a.t0 - b.t0)) {
      if (t < p.deadline) continue;
      const spinning = !p.toks.length && p.part && this.cur.some(c => c && c.raw > 45);
      // a slow next segment still turning (pilot's rates, big floaty Mattys) keeps the wait open a bit longer
      const cap = this.cur.some(c => c && c.raw > 90 && c.t0 >= p.tDone - 0.1 && c.t0 - p.tDone < AIR_OPEN) ? HOLD_MAX + 1.4 : HOLD_MAX;
      if (t - p.tDone < cap && (spinning || this.extendable(p) || (!p.loopEnd && p.spans.some(sp => this.cur.includes(sp.tok))))) continue;
      if (this.loopInProgress(p, t)) continue;
      if (p.name === 'Jump Rope' && t - p.tDone < 2.0 && this.lastD && !this.lastD.crashed && this.nearObstacle(this.lastD, 3)) continue;   // often the start of a Burrito Roll
      if (p.name === 'Whiplash' && t - p.tDone < 3.5 && this.lastD && !this.lastD.crashed && (() => { const P = this.poles.find(q => q.id === p.poleObj); return P && Math.hypot(this.lastD.pos.x - P.x, this.lastD.pos.z - P.z) < 4.5; })()) continue;   // the second whip of a Pole Dance may follow
      this.commit(p, t);
    }
    this.toks = this.toks.filter(k => t - k.t1 < 6);
  }
  startTok(k, r, t, up, dt) { this.cur[k] = { k, ax: 'RPY'[k], dir: Math.sign(r), raw: Math.abs(r) * dt, t0: t, t1: t, low: 0, n: 1, inv: up.y < -0.2 ? 1 : 0, off: 0, rateSum: Math.abs(r), rateSq: r * r, tl: [[t, 0]], usedUntil: -1e9 }; }
  finishTok(k) { const c = this.cur[k]; this.cur[k] = null; if (!c) return;
    if (c.slow && c.slowCross) { c.raw += c.slow; c.t1 = this.time; c.tl.push([this.time, c.raw]); }   // slow tail through a pass still counts
    if (c.raw < 45) return; this.toks.push(c); }
  // unclaimed rotation as tidy tokens: trimmed to what's left, wobble removed, nested moves split out, pauses merged
  normalized(opts = {}) {
    const now = this.time; let L = [];
    const add = (src, t1) => {
      const t0 = Math.max(src.t0, src.usedUntil);
      if (t1 - t0 < 0.02) return;
      const raw = rawAt(src, t1) - rawAt(src, t0); if (raw < 45) return;
      const f = raw / Math.max(1, src.raw);
      L.push({ ax: src.ax, dir: src.dir, k: src.k, t0, t1, raw, raw0: 0, base: src, n: Math.max(1, Math.round(src.n * f)), inv: Math.round(src.inv * f), off: src.off * f, rateSum: src.rateSum * f, rateSq: src.rateSq * f, spans: [{ tok: src, a: t0, b: t1 }] });
    };
    for (const k of this.toks) if (now - k.t1 < 4 && k.t1 - k.usedUntil > 0.03) add(k, k.t1);
    if (opts.partial) for (const c of this.cur) if (c && c.raw >= 45) add(c, now);
    L.sort((a, b) => a.t0 - b.t0);
    L = L.filter(a => !(a.raw < 120 && L.some(b => b !== a && b.raw > 2 * a.raw && b.ax !== a.ax && a.t0 >= b.t0 - 0.03 && a.t1 <= b.t1 + 0.03)));
    for (let guard = 0; guard < 4; guard++) {     // nested: e.g. the roll inside a Power Roll's loop
      const A = L.find(a => L.some(b => b !== a && b.ax !== a.ax && b.raw >= 150 && b.t0 > a.t0 + 0.04 && b.t1 < a.t1 - 0.04)); if (!A) break;
      const B = L.find(b => b !== A && b.ax !== A.ax && b.raw >= 150 && b.t0 > A.t0 + 0.04 && b.t1 < A.t1 - 0.04);
      const p1 = sliceTok(A, A.t0, B.t0), p2 = sliceTok(A, B.t1, A.t1);
      const during = A.raw - p1.raw - p2.raw; p1.off = Math.max(0, p1.off - B.raw * p1.raw / A.raw); p2.off = Math.max(0, p2.off - B.raw * p2.raw / A.raw);
      L = L.filter(x => x !== A).concat([p1, p2].filter(x => x.raw >= 45)).sort((a, b) => a.t0 - b.t0);
      B.off += Math.max(0, during) * 0;
    }
    L = L.filter(a => a.raw >= 60);
    if (opts.splitAt) {                             // cut at loop boundaries (upright pass under an obstacle mid-rotation)
      for (const tc of opts.splitAt) { const i = L.findIndex(a => a.ax === 'P' && tc > a.t0 + 0.15 && tc < a.t1 - 0.15); if (i >= 0) { const A = L[i]; L.splice(i, 1, sliceTok(A, A.t0, tc), sliceTok(A, tc, A.t1)); } }
    }
    const out = [];
    for (const a of L) {
      const l = out[out.length - 1], gap = l ? a.t0 - l.t1 : 99;
      const floatOver = l && gap < 1.3 && this.crossLog.some(c => c.kind === 'O' && c.t > l.t1 - 0.25 && c.t < a.t0 + 0.25)
        && ![...this.toks, ...this.cur.filter(Boolean)].some(x => x.ax !== a.ax && x.raw >= 150 && x.t0 >= l.t1 - 0.05 && x.t1 <= a.t0 + 0.05);   // a yaw/roll at the peak (claimed or not) is its own token   // throttle-cut float over the top of a loop
      const segPause = !floatOver && a.ax !== 'Y' && gap >= SEG_GAP && Math.abs(l?.raw - 180) < 55 && Math.abs(a.raw - 180) < 55
        && this.sweptBetween(l.t1, a.t0) / gap < 55;   // a real segment pause is nearly still (demo 13–35°/s); a floaty loop top keeps turning   // 180 · pause · 180 = Segmented, keep apart
      if (l && l.ax === a.ax && l.dir === a.dir && !l.cut && !segPause && (gap < 0.2 || (gap < 0.42 && l.raw + a.raw < 420) || floatOver) && !(opts.splitAt && opts.splitAt.some(tc => Math.abs(tc - a.t0) < 0.02))) {
        const fl = floatOver && a.ax === 'P' ? this.sweptBetween(l.t1, a.t0) : 0;   // slow float over the top: still rotation
        out[out.length - 1] = { ...l, raw: l.raw + a.raw + fl, t1: a.t1, n: l.n + a.n, inv: l.inv + a.inv, off: l.off + a.off, rateSum: l.rateSum + a.rateSum, rateSq: l.rateSq + a.rateSq,
          maxGap: fl || floatOver ? (l.maxGap || 0) : Math.max(l.maxGap || 0, gap), segments: (l.segments || 1) + (floatOver ? 0 : 1), floated: floatOver || l.floated, spans: [...l.spans, ...a.spans], base: null };
      } else out.push({ ...a, maxGap: a.maxGap || 0, segments: 1 });
    }
    for (const t of out) { t.deg = Math.max(90, Math.round(t.raw / 90) * 90); t.inv = t.inv > t.n * 0.5; t.offRatio = t.off / Math.max(1, t.raw); }
    return out;
  }
  crossWindow(t0) { return this.crossLog.filter(c => c.t >= t0 - 2.2 && !c.used); }
  nearAny() { const d = this.lastD; return !!d && (this.nearObstacle(d, 3) || this.crossLog.some(c => this.time - c.t < 3)); }
  candidates(N, obstOnly) {
    const out = [];
    { const ob = this.matchObstacle([], this.crossWindow(this.time - 1.0));
      if (ob && this.time - ob.ct1 < 0.03) { ob.claims = ob.part.map(c => 'x' + c.t.toFixed(3)); ob.t0 = ob.part[0].t; ob.draft = true; out.push(ob); } }
    for (let k = 1; k <= Math.min(4, N.length); k++) {
      const suf = N.slice(-k);
      if (!obstOnly) {
        if (k === 2 && !this.orbiting() && suf[0].ax === suf[1].ax && suf[0].dir === suf[1].dir && suf[0].ax !== 'Y' && Math.abs(suf[0].raw - 180) < 55 && Math.abs(suf[1].raw - 180) < 55) {
          const gap = suf[1].t0 - suf[0].t1; if (gap >= SEG_GAP && gap < 1.6 && this.sweptBetween(suf[0].t1, suf[1].t0) / gap < 55) out.push({ name: 'Segmented Flips/Rolls', toks: suf, err: 0.05, segmentedOK: true, clen: 0 });
        }
        // open-air tricks are snappy: a slow carving turn that adds up to 360° is not a trick
        // demo yaws (Vanny) measured down to ~266°/s; at the pilot's own rates a yaw inside a sequence can be slower (a lone slow yaw is just a turn)
        const fast = suf.every(x => x.rateSum / x.n >= (x.ax === 'Y' ? (suf.length > 1 ? 160 : 220) : 180));
        const orbit = this.orbiting();
        const airOK = suf.every((x, i) => !i || x.t0 - suf[i - 1].t1 <= this.airAllowed(suf[i - 1].t1, x.t0));
        if (fast && !orbit && airOK) for (const tr of OPEN_TRICKS) { if (this.vetoedFor(tr.name, suf[0].t0) || !this.watcher.pre(tr.name, { toks: suf })) continue; for (const pp of tr.parsed) { const m = matchTokens(pp, suf); if (m) { out.push({ name: tr.name, toks: suf, err: m.err, clen: 0 }); break; } } }
        if (!orbit) { const ol = this.matchOpenLoop(suf); if (ol) out.push(ol); }
        if (!orbit) for (const tr of CONTEXT_TRICKS) for (const pp of tr.parsed) {
          const m = matchTokens(pp, suf); if (!m) continue;
          const ok = this.reqOK(tr.req, suf); if (!ok) continue;
          if (this.vetoedFor(tr.name, suf[0].t0) || !this.watcher.pre(tr.name, { toks: suf, obj: ok.obj })) continue;
          out.push({ name: tr.name, toks: suf, err: m.err, clen: 1, claims: ok.claims, tapRef: ok.tapRef, obstacle: ok.obstacle, draft: tr.draft }); break;
        }
      }
      const ob = this.matchObstacle(suf, this.crossWindow(suf[0].t0));
      const def = ob && OBSTACLE_TRICKS.find(x => x.name === ob.name);
      if (ob && (ob.ct1 >= suf[0].t0 - 0.15 || (def && def.passFirst && ob.ct1 >= suf[0].t0 - 1.0))) {   // passFirst: the pass, some air, then the rotation
        if (def && def.draft) ob.draft = true;
        if (ob.part) ob.claims = ob.part.map(c => 'x' + c.t.toFixed(3));
        if (def && def.tap) { const tp = this.tapIn(def.tap, ob.obj, suf[0].t0 - 0.4, ob.ct1 + 0.15); if (tp) { ob.claims = [tp.id]; ob.tapRef = tp; } }
        out.push(ob);
      }
    }
    return out;
  }
  trigger(t, byCross) {
    const variants = [{ N: this.normalized(), obstOnly: false }];
    if (byCross) variants.push({ N: this.normalized({ partial: true }), obstOnly: true });
    const ups = this.crossLog.filter(c => c.kind === 'U' && !c.used && c.upY > 0.5 && t - c.t < 4).map(c => c.t);
    if (ups.length) variants.push({ N: this.normalized({ partial: byCross, splitAt: ups }), obstOnly: true });
    let best = null;
    const knocked = c => c.toks.length && !c.tapRef && this.contacts.some(x => !x.tap && x.impact > 0.8 && x.t >= c.toks[0].t0 - 0.3 && x.t <= c.toks[0].t0 + 0.15);
    const pool = [];
    for (const v of variants) pool.push(...this.candidates(v.N, v.obstOnly));
    pool.push(...this.eventCands(t));
    for (const c of pool) if (!knocked(c) && better(c, best)) best = c;
    if (!best) return;
    best.spans = best.toks.flatMap(x => x.spans || []); best.claims = best.claims || [];
    if (best.t0 === undefined) best.t0 = best.toks[0].t0;
    best.tDone = Math.max(best.tDone ?? -1e9, best.toks.length ? best.toks[best.toks.length - 1].t1 : -1e9, best.ct1 || -1e9);
    const clash = p => spansOverlap(p.spans, best.spans) || p.claims.some(k => best.claims.includes(k));
    if (this.pend.some(p => p.name === best.name && Math.abs(p.t0 - best.t0) < 0.6)) return;   // same trick seen around a neighbouring post
    const overlap = this.pend.filter(clash);
    for (const p of overlap) if (!better(best, p)) return;       // an existing pending trick is at least as good
    this.pend = this.pend.filter(p => !overlap.includes(p));
    const last = best.part && best.part[best.part.length - 1];
    best.loopEnd = !!(last && last.kind === 'U' && last.upY > 0.5);   // ends at an upright pass under: done even if rotation carries on
    const ctxPre = best.toks.length && CONTEXT_TRICKS.some(tr => tr.name !== best.name && better({ name: tr.name, clen: 1, toks: best.toks }, best) &&
      [best.toks, trimNinety(best.toks)].some(tv => tv.length && tr.parsed.some(pp => matchTokens(pp, tv))) && this.reqPre(tr.req, best.toks));
    const spin = best.holdIfSpin && (this.cur.some(c => c && c.raw > 45) || this.toks.some(k => t - k.t1 < 0.3 && k.raw > 60));
    const pole = best.holdNearPole != null && this.lastD && (() => { const P = this.poles.find(p => p.id === best.holdNearPole); return P && Math.hypot(this.lastD.pos.x - P.x, this.lastD.pos.z - P.z) < 4.5; })();
    const sw = best.holdSwitch && (() => { const o = this.orb[best.holdSwitch.obj]; return o && o.acc > 20 && o.dir !== best.holdSwitch.dir; })();
    // right beside a pole with the pass not finished yet: a pole trick (Cradle, Whiplash) may claim these rotations
    const passing = !best.clen && best.toks.length && this.lastD && this.poles.some(P => { const pt = this.passTr[P.id]; return pt && !pt.lock && pt.dmin < 2.5 && Math.hypot(this.lastD.pos.x - P.x, this.lastD.pos.z - P.z) < 2.6; });
    best.hold = (this.obstaclePrefix(best) || ctxPre || spin || pole || sw || passing) ? HOLD_OBST : HOLD;
    if (best.name === 'Whiplash') best.hold = Math.max(best.hold, 0.7);   // wait a hair longer before confirming
    best.deadline = t + best.hold;
    this.pend.push(best);
  }
  obstaclePrefix(c) {     // a bigger obstacle trick is half-done with these same rotations
    const crosses = this.crossWindow(c.t0);
    const byObj = {}; for (const x of crosses) if (x.kind !== 'G') (byObj[x.obj] = byObj[x.obj] || []).push(x);
    for (const tr of OBSTACLE_TRICKS) {
      if (tr.cross.length <= (c.clen || 0)) continue;
      if (tr.tap && !this.taps.some(x => x.t >= c.t0 - 0.4)) continue;
      if (!c.toks.length || ![c.toks, trimNinety(c.toks), dropSmall(c.toks)].some(tv => tr.parsed.some(pp => matchTokens(pp, tv)))) continue;
      for (const id in byObj) { const L = byObj[id], kinds = L.map(x => x.kind).join('');
        for (let j = 1; j < tr.cross.length; j++) {
          if (!kinds.endsWith(tr.cross.slice(0, j))) continue;
          // the passes seen so far must be the *start* of this trick: the first one can't come after the rotation began
          const first = L[L.length - j]; if (first.t > c.t0 + 0.15) continue;
          return tr.name;
        } }
    }
    return null;
  }
  loopInProgress(p, t) {   // open-air rotation done at the top of a loop (under, then over the same object): wait for the way back
    if (p.part || !p.toks.length || t - p.tDone > 3.0) return false;
    const X = this.crossLog.filter(c => c.kind === 'U' || c.kind === 'O'); const last = X[X.length - 1];
    if (!last || last.kind !== 'O' || t - last.t > 3.6) return false;
    if (last.latDot > 0.6 && last.t > p.t0 - 0.6) return true;   // jump-rope peak (sideways over): wait for the way back down (Double Dutch)
    if (p.t0 > last.t - 0.4 && t - last.t < 3.2) return true;     // Matty family: rotation after going over, the pass back under follows (slow, floaty ones take ~3 s)
    return X.some(c => c.kind === 'U' && c.obj === last.obj && c.t < last.t && last.t - c.t < 4 && c.t < p.t0);
  }
  // in the air between two segments: nothing rotating yet, but the rotations so far are the start of a longer open-air
  // trick and the quad is holding steady (not tumbling) — give the next segment up to AIR_OPEN to begin
  // how much air a gap may have: hanging upside down (or on edge) mid-trick means another segment has to come, so more
  airAllowed(a, b) { const W = this.fbIn(a, b); return W.length && W.reduce((s, x) => s + x.up.y, 0) / W.length < 0.3 ? AIR_OPEN * 1.5 : AIR_OPEN; }
  awaitingSegment(p) {
    const t = this.time, gap = t - p.tDone; if (!p.toks.length || p.part || (p.clen || 0) > 0 || gap > this.airAllowed(p.tDone, t)) return false;   // an open-air extension never beats a context/obstacle trick
    if (gap > 0.15 && this.sweptBetween(p.tDone, t) / gap > 150) return false;
    const N0 = this.normalized();
    for (const tr of OPEN_TRICKS) for (const pp of tr.parsed) for (let j = 1; j < pp.length; j++) {
      const before = N0.slice(-j); if (before.length !== j || !spansOverlap(before.flatMap(x => x.spans), p.spans)) continue;
      if (before[before.length - 1].t1 < p.tDone - 0.05) continue;
      if (matchTokens(pp.slice(0, j), before)) return true;
    }
    return false;
  }
  extendable(p) {         // could rotation happening right now turn this into a bigger trick?
    if (p.toks.length && this.cur.some(c => c && c.raw >= 90 && c.t0 < p.t0 - 0.03 && !p.toks.some(tk => tk.ax === c.ax))) return true;
    const pLast = p.toks[p.toks.length - 1]; if (!pLast) return false;
    const live = this.cur.filter(c => c && c.raw >= 20 && c.t0 >= pLast.t1 - 0.05 && c.t0 - p.tDone < AIR_OPEN);
    if (!live.length) return this.awaitingSegment(p);
    const near = this.crossWindow(p.t0).some(c => c.kind !== 'G');   // obstacle tricks only once a pass has happened
    const N0 = this.normalized(), pool = near ? [...OPEN_TRICKS, ...OBSTACLE_TRICKS.filter(x => !x.tap)] : OPEN_TRICKS;
    for (const c of live) {
      const last = { ax: c.ax, dir: c.dir, raw: c.raw };
      for (const tr of pool) for (const pp of tr.parsed) for (let j = 1; j < pp.length; j++) {
        const before = N0.slice(-j); if (before.length !== j) continue;
        if (!spansOverlap(before.flatMap(x => x.spans), p.spans)) continue;
        if (!matchTokens(pp.slice(0, j), before)) continue;
        const nx = pp[j]; if (nx.ax !== last.ax) continue;
        if ((nx.dir === '+' && last.dir !== 1) || (nx.dir === '-' && last.dir !== -1)) continue;
        if (last.raw > nx.deg + 95) continue;
        return true;
      }
    }
    return false;
  }
  vetoedFor(name, t0) { return (this.vetoes || []).some(v => v.name === name && Math.abs(v.t0 - t0) < 0.35); }
  commit(p, t) {
    this.pend = this.pend.filter(x => x !== p);
    const rv = this.watcher.review(p);
    if (rv.veto) {   // the Watcher says no: remember it, tell the game why, and let the detector find the next-best reading
      this.vetoes.push({ name: p.name, t0: p.t0, t }); this.vetoes = this.vetoes.filter(v => t - v.t < 8);
      this.pushReview(rv); this.pushDebug({ t: +t.toFixed(2), toks: '', cross: '', result: ['watcher: not ' + p.name + ' (' + rv.why + ')'], near: null });
      if (!this.crashSeen) { this.trigger(t, false); if (p.part) this.trigger(t, true); }
      return;
    }
    for (const s of p.spans) s.tok.usedUntil = Math.max(s.tok.usedUntil, s.b);
    for (const k of p.claims || []) this.claimUsed.add(k);
    if ((p.claims || []).some(k => k.startsWith('orb'))) for (const sg of this.orbSegs) if (sg.t1 > p.t0 - 0.3 && sg.t0 < p.tDone + 0.3) this.claimUsed.add(sg.id);
    if ((p.claims || []).some(k => k.startsWith('pass'))) for (const ps of this.passes) if (Math.abs(ps.t - p.tDone) < 0.6) this.claimUsed.add(ps.id);
    if (p.tapRef) this.contacts.forEach(c => { if (Math.abs(c.t - p.tapRef.t) < 0.12) c.tap = true; });
    for (const k of this.toks) if (k.t1 < p.t0 - 0.05) k.usedUntil = Math.max(k.usedUntil, k.t1); // leftovers before this trick
    if (p.part) p.part.slice(0, -1).forEach(c => c.used = true); // the last pass may start the next trick
    const contacts = this.contacts.filter(c => c.t >= p.t0 - 0.05 && c.t <= p.tDone + 0.05);
    const g = this.grade(p, contacts, p.toks);
    for (const k of p.toks) { const m = k.rateSum / k.n, v = Math.sqrt(Math.max(0, k.rateSq / k.n - m * m)); const cv = v / (m || 1); if (cv > 0.45) { g.clean = Math.max(0, g.clean - Math.round((cv - 0.45) * 40)); g.notes.push('uneven rotation speed'); } }
    if (g.exec === 'CLEAN' && g.clean < 70) g.exec = 'SLOPPY';
    const crosses = this.crossWindow(p.t0);
    const near = (p.hold === HOLD_OBST && !p.clen) ? this.nearMiss(p.toks, crosses) : null;
    const latency = +(t - p.tDone).toFixed(3);
    if (!p.toks.length) { g.clean = Math.max(g.clean, 90); if (g.exec === 'SLOPPY') g.exec = 'CLEAN'; }
    this.pushDebug({ t: +t.toFixed(2), toks: p.toks.map(tk => tk.ax + (tk.dir > 0 ? '+' : '-') + Math.round(tk.raw) + (tk.inv ? 'i' : '') + (tk.maxGap > 0.15 ? `(stall ${tk.maxGap.toFixed(2)}s)` : '')).join(' '),
      cross: crosses.map(c => `${c.name}:${c.kind}${c.dir > 0 ? '→' : '←'}@${(c.t - p.t0).toFixed(1)}s`).join(' '), result: [p.name], near, latency });
    if (near) this.emit({ name: 'near', near });
    this.pushReview(rv); this.watcher.learn(p, rv);
    this.emit({ name: p.name, exec: g.exec, clean: g.clean, obstacle: p.obstacle || null, toks: p.toks, notes: g.notes, latency, draft: !!p.draft, watch: { conf: rv.conf, votes: rv.votes, fails: rv.checks.filter(k => !k.ok).map(k => k.id) } });
  }
  pushReview(rv) { this.reviews.push(rv); if (this.reviews.length > 20) this.reviews.shift(); }
  drainReviews() { const r = this.reviews; this.reviews = []; return r; }
  pushDebug(x) { (this.debug = this.debug || []).push(x); if (this.debug.length > 12) this.debug.shift(); }
  provisional() { return this.pend.map(p => p.name); }
  busy() { return this.pend.length > 0 || this.cur.some(c => c && c.raw > 45) || !!this.live || !!(this.wallRide && this.wallRide.emitted); }
}

// ================================================================= THE WATCHER (second, live judge)
// The detector proposes a trick from the rotation pattern and the obstacle passes. The Watcher cross-checks the proposal
// against the other live sources of the same moment, each one an independent witness:
//   path    where the quad went relative to the object (sim truth: passes, loops, rise, travel direction)
//   view    what the FPV camera saw (object kept in view, inverted, looking at the sky / ground), camera tilt included
//   sticks  what the pilot actually commanded (deliberate stick on the rotating axis, throttle punches and cuts)
//   timing  how long each phase took compared with the prowhooper.com demo GIFs, scaled to this pilot's own speed
// and against each trick's TPW library description (the hard checks: things the trick cannot do without).
// A hard check that fails vetoes the call (the detector then takes its next-best reading). Otherwise every source that has
// something to say votes; the votes are averaged per source (one source, one vote) into a confidence. Two candidates that
// tie on the rotation pattern are settled by that confidence, and a call that most witnesses contradict is dropped.
// Video Review never runs it (no world, no sticks): det.watcherOn = false.
//
// demo timing (seconds per phase, measured from the GIFs: docs/tricktionary-reference.md) and the demo pilot's rates
const DEMO_TIMING = {
  'Flip': [['P', 0.4]], 'Double Flip': [['P', 0.85]], 'Roll': [['R', 0.36]], 'Double Roll': [['R', 0.8]], 'Yaw Spin': [['Y', 1.0]],
  'Invert Rewind': [['*', 0.3], ['*', 0.3]], 'Vanny Roll': [['Y', 0.56], ['R', 0.5], ['Y', 0.64]],
  "Rubik's Cube": [['P', 0.3], ['R', 0.53], ['P', 0.4]], "Cubik's Rube": [['R', 0.26], ['P', 0.7], ['R', 0.42]],
  'Juicy Flick': [['P', 0.27], ['R', 0.34]], 'Snapback': [['P', 0.3], ['R', 0.37]],
  'Inverted Yaw Spin': [['R', 0.26], ['Y', 0.56], ['R', 0.3]], 'Half Matty': [['R', 0.25], ['P', 0.6]], '540 Half Matty': [['R', 0.6], ['P', 0.6]],
  'Immelmann Turn': [['P', 0.6], ['R', 0.4]],
};
const DEMO_RATE = { R: 950, P: 850, Y: 600 };   // typical demo rotation speed per axis (°/s), same source
const WATCH_GENERIC = [
  { id: 'landed', src: 'path', label: 'landed upright', fn: W => W.endsUpright() },
  { id: 'sticks', src: 'sticks', label: 'rotation came from the sticks (not a bump)', fn: W => W.commanded() },
  { id: 'timing', src: 'timing', label: 'timed like the demo (at your speed)', fn: W => W.demoTiming() },
  { id: 'air', src: 'path', label: 'held steady in the air between segments', fn: W => W.heldBetween() },
];
const WATCH = {
  'Snapback': [
    { id: 'under', src: 'path', label: 'passed under the object first, upright and flying forward', hard: 'pre', fn: W => W.underFirst() },
    { id: 'orbit', src: 'path', label: 'not part of an orbit/trippy', hard: 'pre', fn: W => W.notOrbit() },
    { id: 'orbit2', src: 'path', label: 'not part of an orbit/trippy', hard: 'post', fn: W => W.notOrbit() },
    { id: 'noloop', src: 'path', label: 'snapped back right there (no half loop up and over)', hard: 'post', fn: W => W.noLoopOver(1.6) },
    { id: 'track', src: 'view', label: 'kept the object in view', hard: 'post', fn: W => W.tracked(0.35) },
    { id: 'sky', src: 'view', label: 'looked up past the object', fn: W => W.looked('up') },
    { id: 'face', src: 'view', label: 'finished looking back at it', fn: W => W.endsFacing() },
    { id: 'quick', src: 'timing', label: 'quick pitch back to inverted', fn: W => W.quick('P', 0.7) },
    { id: 'roll', src: 'sticks', label: 'clean 180 roll to finish', fn: W => W.cleanRoll() },
  ],
  'Juicy Flick': [
    { id: 'orbit', src: 'path', label: 'not part of an orbit/trippy', hard: 'pre', fn: W => W.notOrbit() },
    { id: 'down', src: 'view', label: 'flicked nose-down through the ground view', fn: W => W.looked('down') },
    { id: 'inv', src: 'view', label: 'reached inverted', fn: W => W.inverted() },
    { id: 'quick', src: 'timing', label: 'quick flick', fn: W => W.quick('P', 0.75) },
    { id: 'punch', src: 'sticks', label: 'throttle on through the flick', fn: W => W.throttle('punch', W.t0 - 0.15, W.t0 + 0.4) },
    { id: 'roll', src: 'sticks', label: 'clean 180 roll to finish', fn: W => W.cleanRoll() },
    { id: 'back', src: 'path', label: 'carried on flying backward', fn: W => W.endsBackward() },
  ],
  'Matty Flip': [
    { id: 'track', src: 'view', label: 'kept the object in view on the way down', fn: W => W.trackedBetween('O', 'U', 0.4) },
    { id: 'face', src: 'view', label: 'facing the object as it went under', fn: W => W.facingAt('U') },
    { id: 'back', src: 'path', label: 'flying backward under it', fn: W => W.endsBackward() },
    { id: 'cut', src: 'sticks', label: 'throttle cut over the top', fn: W => W.throttle('cut', W.t0 - 0.4, W.t1) },
  ],
  'Beginner Matty': [
    { id: 'noflip', src: 'path', label: 'no flip, just the backward swing', fn: W => ({ ok: !W.toks.some(k => k.ax === 'P' && k.raw > 150) }) },
    { id: 'back', src: 'path', label: 'flying backward under it', fn: W => W.endsBackward() },
    { id: 'track', src: 'view', label: 'kept the object in view', fn: W => W.tracked(0.4) },
  ],
  'Half Matty': [
    { id: 'face', src: 'view', label: 'facing the object as it went under', fn: W => W.facingAt('U') },
    { id: 'back', src: 'path', label: 'flying backward under it', fn: W => W.endsBackward() },
  ],
  'Matty Stall Rewind': [
    { id: 'seg', src: 'path', label: 'segmented front flip (stall in the middle)', fn: W => ({ ok: W.toks.some(k => (k.maxGap || 0) >= 0.2) || (W.toks.length >= 2 && W.toks[1].t0 - W.toks[0].t1 >= 0.2) }) },
    { id: 'back', src: 'path', label: 'rewound backward past the object', fn: W => W.endsBackward() },
    { id: 'cut', src: 'sticks', label: 'throttle cut before the stall', fn: W => W.throttle('cut', W.t0 - 0.5, W.t1) },
  ],
  'Split-S': [
    { id: 'invtop', src: 'view', label: 'rolled inverted over the top', fn: W => W.invertedNear('O', -0.3, 0.8) },
    { id: 'dive', src: 'path', label: 'dove down the back', fn: W => W.dove() },
  ],
  '540 Split S': [
    { id: 'invtop', src: 'view', label: 'rolled inverted over the top', fn: W => W.invertedNear('O', -0.3, 0.8) },
    { id: 'dive', src: 'path', label: 'dove down the back', fn: W => W.dove() },
  ],
  'Powerloop': [
    { id: 'invtop', src: 'view', label: 'inverted over the top', fn: W => W.invertedAt('O') },
    { id: 'sweep', src: 'path', label: 'the path looped all the way round', fn: W => W.loopSweep(270) },
    { id: 'punch', src: 'sticks', label: 'throttle up the side', fn: W => W.throttle('punch', W.t0 - 0.5, W.t1) },
  ],
  'Immelmann Turn': [
    { id: 'invtop', src: 'view', label: 'inverted over the top', fn: W => W.invertedAt('O') },
    { id: 'roll', src: 'sticks', label: 'clean 180 roll at the peak', fn: W => W.cleanRoll() },
  ],
  'Maverick Loop': [
    { id: 'uptop', src: 'view', label: 'upright and looking forward over the top', fn: W => W.uprightAt('O') },
    { id: 'sweep', src: 'path', label: 'the path looped all the way round', fn: W => W.loopSweep(270) },
  ],
  'Whiplash': [
    { id: 'noover', src: 'path', label: 'no over/under-the-object loop around it', hard: 'post', fn: W => W.noOverNear(0.8) },
    { id: 'holds', src: 'view', label: 'still level, still looking at the pole, still backing away after the whip', hard: 'post', fn: W => W.whipHolds() },
    { id: 'noorbit', src: 'path', label: 'not just circling the pole', hard: 'post', fn: W => W.notOrbit() },
    { id: 'track', src: 'view', label: 'kept the pole in view', fn: W => ({ ok: true }) },
  ],
  'Cradle': [
    { id: 'noover', src: 'path', label: 'no over/under-the-object loop around it', hard: 'post', fn: W => W.noOverNear(0.8) },
  ],
  'Jump Rope': [
    { id: 'side', src: 'path', label: 'sideways over/under the object', fn: W => ({ ok: (W.part || []).every(c => c.latDot > 0.6), val: Math.round(Math.min(...(W.part || [{ latDot: 0 }]).map(c => c.latDot)) * 100) + '%' }) },
  ],
  'Inverted Yaw Spin': [
    { id: 'inv', src: 'view', label: 'stayed inverted through the spin', fn: W => W.invertedDuring('Y', 0.7) },
  ],
};
class Watcher {
  constructor(det) { this.det = det; this.style = { R: null, P: null, Y: null }; }
  get on() { return this.det.watcherOn !== false; }
  ctx(name, c) {
    const det = this.det, toks = c.toks || [], part = c.part || null;
    const t0 = c.t0 ?? (toks.length ? toks[0].t0 : part ? part[0].t : det.time);
    const t1 = c.tDone ?? Math.max(toks.length ? toks[toks.length - 1].t1 : -1e9, part ? part[part.length - 1].t : -1e9, t0);
    const objId = c.obj ?? (part && part.length ? part[0].obj : null);
    const W = new WatchCtx(det, this, name, toks, part, t0, t1, objId, c.err); W.poleId = c.poleObj; return W;
  }
  pre(name, c) {
    if (!this.on) return true;
    const L = WATCH[name]; if (!L) return true;
    const W = this.ctx(name, c);
    for (const k of L) if (k.hard === 'pre') { const r = k.fn(W); if (!r.ok) return false; }
    return true;
  }
  judge(p, hardOnly) {
    const W = this.ctx(p.name, p), L = [...(WATCH[p.name] || []), ...(p.toks && p.toks.length ? WATCH_GENERIC : [])];
    const checks = [];
    for (const k of L) { if (hardOnly && !k.hard) continue; let r; try { r = k.fn(W); } catch (e) { r = null; }
      if (!r || r.na) continue;   // this witness has nothing to say here (no sticks recorded, no object, no demo timing)
      checks.push({ id: k.id, src: k.src, label: k.label, ok: !!r.ok, val: r.val, hard: !!k.hard, w: r.w ?? 1 }); }
    const fail = checks.find(k => k.hard && !k.ok);
    const by = {}; for (const k of checks) if (!k.hard) { const b = by[k.src] || (by[k.src] = { n: 0, ok: 0 }); b.n += k.w; b.ok += k.ok ? k.w : 0; }
    if (p.toks && p.toks.length && p.err != null) by.rotation = { n: 1, ok: clamp(1 - p.err * 2, 0, 1) };   // the pattern matcher is a witness too
    const votes = Object.entries(by).map(([src, b]) => [src, b.ok / b.n]);
    const conf = votes.length ? votes.reduce((a, v) => a + v[1], 0) / votes.length : 1;
    return { name: p.name, veto: !!fail || (votes.length >= 3 && conf < 0.3), why: fail ? fail.label : (votes.length >= 3 && conf < 0.3 ? 'most witnesses disagree' : null),
      checks, votes: Object.fromEntries(votes.map(([k, v]) => [k, +v.toFixed(2)])), conf: +conf.toFixed(2), t0: +W.t0.toFixed(3), t1: +W.t1.toFixed(3) };
  }
  review(p) { if (!this.on) return { name: p.name, veto: false, checks: [], votes: {}, conf: 1 }; return this.judge(p, false); }
  // this pilot's own rotation speed per axis, learned live from tricks every witness agreed on (feeds the timing witness)
  learn(p, rv) {
    if (!this.on || rv.conf < 0.6) return;
    for (const k of p.toks || []) { const dur = k.t1 - k.t0; if (dur < 0.08 || k.raw < 150) continue; const r = k.raw / dur, o = this.style[k.ax];
      this.style[k.ax] = o == null ? r : o * 0.85 + r * 0.15; }
  }
  speedFactor(ax) { const r = this.style[ax] ?? this.det.pilotRate?.[ax] ?? null; return r ? clamp(DEMO_RATE[ax] / r, 0.6, 3) : 1.4; }
}
class WatchCtx {
  constructor(det, wa, name, toks, part, t0, t1, objId, err) { Object.assign(this, { det, wa, name, toks, part, t0, t1, objId, err }); }
  get obj() { if (this._o === undefined) this._o = this.objId != null ? this.det.world.objs.find(o => o.id === this.objId) || null : null; return this._o; }
  // the point of the object the pilot is looking at from position p (bar/branch line at mid height; tree canopy centre)
  objPt(p) {
    const o = this.obj; if (!o || !o.obstacle) return null;
    const { a, b, under, over } = o.obstacle, y = (under + over) / 2;
    if (o.round) return v3(o.round.c.x, y, o.round.c.z);
    const ab = v3(b.x - a.x, 0, b.z - a.z), L2 = ab.x * ab.x + ab.z * ab.z || 1, f = clamp(((p.x - a.x) * ab.x + (p.z - a.z) * ab.z) / L2, 0, 1);
    return v3(a.x + ab.x * f, y, a.z + ab.z * f);
  }
  fr(a, b) { return this.det.fbIn(a, b); }
  view(x) { const pt = this.objPt(x.p); return pt ? this.det.viewOf(x.p, x.up, x.f, pt).ang : 180; }
  cam(x) { const c = Math.cos(this.det.camTilt * D2R), s = Math.sin(this.det.camTilt * D2R); return norm(add(mul(x.f, c), mul(x.up, s))); }
  cross(kind) { return (this.part || []).find(c => c.kind === kind) || this.det.crossLog.find(c => c.kind === kind && (this.objId == null || c.obj === this.objId) && c.t >= this.t0 - 1.2 && c.t <= this.t1 + 0.6) || null; }
  // ---- checks: each returns { ok, val }
  underFirst() {
    const c = this.part && this.part[0]; if (!c || c.kind !== 'U') return { ok: false, val: 'no pass under' };
    const okT = c.t <= this.t0 + 0.25 && c.t >= this.t0 - 1.0;
    return { ok: okT && c.upY > 0.5 && c.fwdDot > 0.2, val: `${(c.t - this.t0).toFixed(2)} s, fwd ${c.fwdDot.toFixed(1)}` };
  }
  notOrbit() {
    const d = this.det, a = this.t0 - 0.4, b = this.t1 + 0.4;
    // flying straight past a pole sweeps < 180° round it (≈160° inside the orbit radius), so only more than that is an orbit
    const seg = d.orbSegs.some(s => s.t1 > a && s.t0 < b && s.acc > 300) || Object.values(d.orb).some(o => o && o.acc > 300 && o.t1 > a);
    return { ok: !seg };
  }
  noLoopOver(maxRise) {
    const over = this.det.crossLog.some(c => c.kind === 'O' && c.obj === this.objId && c.t > this.t0 - 0.1 && c.t < this.t1 + 0.6);
    const ys = this.fr(this.t0, this.t1).map(x => x.p.y), rise = ys.length ? Math.max(...ys) - ys[0] : 0;
    return { ok: !over && rise < maxRise, val: over ? 'went over it' : `rose ${rise.toFixed(1)} m` };
  }
  tracked(frac) { const F = this.fr(this.t0, this.t1); if (!F.length || this.objId == null) return { ok: this.objId == null, val: 'n/a' };
    const f = F.filter(x => this.view(x) < 70).length / F.length; return { ok: f >= frac, val: Math.round(f * 100) + '%' }; }
  trackedBetween(k1, k2, frac) { const a = this.cross(k1), b = this.cross(k2); if (!a || !b || b.t <= a.t) return { ok: true, val: 'n/a' };
    const F = this.fr(a.t, b.t); if (!F.length) return { ok: true, val: 'n/a' }; const f = F.filter(x => this.view(x) < 70).length / F.length; return { ok: f >= frac, val: Math.round(f * 100) + '%' }; }
  facingAt(kind) { const c = this.cross(kind); if (!c) return { ok: true, val: 'n/a' }; const F = this.fr(c.t - 0.35, c.t - 0.05);
    const ok = F.some(x => this.view(x) < 75); return { ok }; }
  quick(ax, maxT) { const T = this.toks.filter(k => k.ax === ax).reduce((s, k) => s + (k.t1 - k.t0), 0); return { ok: T > 0 && T <= maxT, val: T.toFixed(2) + ' s' }; }
  looked(dir) { const F = this.fr(this.t0, this.t1); const ok = F.some(x => { const c = this.cam(x); return dir === 'up' ? c.y > 0.55 : c.y < -0.55; }); return { ok }; }
  inverted() { return { ok: this.fr(this.t0, this.t1 + 0.1).some(x => x.up.y < -0.4) }; }
  invertedAt(kind) { const c = this.cross(kind); if (!c) return { ok: true, val: 'n/a' }; return { ok: c.upY < -0.2, val: 'up ' + c.upY.toFixed(2) }; }
  invertedNear(kind, a, b) { const c = this.cross(kind); if (!c) return { na: true }; return { ok: this.fr(c.t + a, c.t + b).some(x => x.up.y < -0.3) }; }
  uprightAt(kind) { const c = this.cross(kind); if (!c) return { ok: true, val: 'n/a' }; return { ok: c.upY > 0.3, val: 'up ' + c.upY.toFixed(2) }; }
  invertedDuring(ax, frac) { const k = this.toks.find(x => x.ax === ax); if (!k) return { ok: true, val: 'n/a' }; const F = this.fr(k.t0, k.t1); if (!F.length) return { ok: true };
    const f = F.filter(x => x.up.y < -0.2).length / F.length; return { ok: f >= frac, val: Math.round(f * 100) + '%' }; }
  cleanRoll() { const R = this.toks.filter(k => k.ax === 'R'); if (!R.length) return { ok: false, val: 'no roll' };
    const k = R[R.length - 1], rate = k.rateSum / k.n, off = k.off / Math.max(1, k.raw); return { ok: rate >= 220 && off < 0.8, val: `${Math.round(rate)}°/s` }; }
  endsUpright() { return { ok: this.fr(this.t1, this.t1 + 0.6).some(x => x.up.y > 0.5) }; }
  endsFacing() { if (this.objId == null) return { ok: true, val: 'n/a' }; return { ok: this.fr(this.t1 - 0.05, this.t1 + 0.4).some(x => this.view(x) < 75) }; }
  endsBackward() { const F = this.fr(this.t1 - 0.1, this.t1 + 0.5).filter(x => Math.hypot(x.v.x, x.v.z) > 0.7); if (!F.length) return { ok: true, val: 'slow' };
    const b = F.filter(x => (x.v.x * x.f.x + x.v.z * x.f.z) / (Math.hypot(x.v.x, x.v.z) * (Math.hypot(x.f.x, x.f.z) || 1)) < -0.2).length / F.length; return { ok: b >= 0.5, val: Math.round(b * 100) + '%' }; }
  heldBetween() {   // the space between two segments: the quad keeps the attitude the last segment left it in
    const G = []; for (let i = 1; i < this.toks.length; i++) { const a = this.toks[i - 1].t1, b = this.toks[i].t0; if (b - a > 0.12) G.push([a, b]); }
    if (!G.length) return { na: true };
    const worst = Math.max(...G.map(([a, b]) => this.det.sweptBetween(a, b) / (b - a)));
    return { ok: worst < 120, val: G.map(([a, b]) => (b - a).toFixed(2)).join('/') + ' s air' };
  }
  whipHolds() { const P = this.det.poles.find(p => p.id === this.poleId); if (!P) return { na: true }; const F = this.fr(this.t1, this.t1 + 0.6); if (F.length < 10) return { na: true };
    const lvl = F.filter(x => x.up.y > 0.5).length / F.length, see = this.det.poleView(P, this.t1, this.t1 + 0.6, 65), bk = this.det.backFrac(this.t1, this.t1 + 0.6), slow = F.every(x => Math.hypot(x.v.x, x.v.z) < 0.8);
    return { ok: lvl >= 0.7 && see >= 0.6 && (bk >= 0.5 || slow), val: `level ${Math.round(lvl * 100)}% view ${Math.round(see * 100)}%` }; }
  noOverNear(after) { const o = this.det.crossLog.some(c => c.kind === 'O' && c.t > this.t0 - 0.5 && c.t < this.t1 + after); return { ok: !o }; }
  loopSweep(min) { const ps = this.det.pathSweep(this.t0 - 0.3, this.t1 + 0.3); return { ok: Math.abs(ps.sweep) >= min, val: Math.round(Math.abs(ps.sweep)) + '°' }; }
  // ---- sticks witness. Frames carry the pilot's sticks; no stick movement anywhere near = nothing recorded (n/a)
  sticks(a, b) { const F = this.fr(a, b).filter(x => x.rc); if (F.length < 3) return null;
    const live = F.some(x => Math.abs(x.rc.roll) > 0.05 || Math.abs(x.rc.pitch) > 0.05 || Math.abs(x.rc.yaw) > 0.05) && Math.max(...F.map(x => x.rc.thr)) - Math.min(...F.map(x => x.rc.thr)) > 0.005;
    return live ? F : null; }
  commanded() {
    if (!this.toks.length) return { na: true }; const F = this.sticks(this.t0 - 0.1, this.t1); if (!F) return { na: true };
    const key = { R: 'roll', P: 'pitch', Y: 'yaw' }; let good = 0;
    for (const k of this.toks) { const G = F.filter(x => x.t >= k.t0 && x.t <= k.t1); if (!G.length) { good++; continue; }
      // stick on that axis, pushed the way the quad turned (pitch stick back = nose up = P+; roll right = R+; yaw stick sign is the sim's)
      const sg = k.ax === 'P' ? -1 : 1, f = G.filter(x => Math.abs(x.rc[key[k.ax]]) > 0.2 && Math.sign(x.rc[key[k.ax]]) * sg === k.dir).length / G.length;
      if (f >= 0.3) good++; }
    return { ok: good === this.toks.length, val: `${good}/${this.toks.length} rotations` };
  }
  throttle(kind, a, b) { const F = this.sticks(a - 0.6, b + 0.2); if (!F) return { na: true };
    const base = F.filter(x => x.t < a).map(x => x.rc.thr), hov = base.length ? base.reduce((s, x) => s + x, 0) / base.length : 0.35, G = F.filter(x => x.t >= a && x.t <= b);
    if (!G.length) return { na: true };
    if (kind === 'punch') { const m = Math.max(...G.map(x => x.rc.thr)); return { ok: m > hov + 0.08 || m > 0.55, val: Math.round(m * 100) + '%' }; }
    const m = Math.min(...G.map(x => x.rc.thr)); return { ok: m < Math.min(0.2, hov - 0.1), val: Math.round(m * 100) + '%' }; }
  // ---- timing witness: phase lengths vs the demo GIFs, scaled to this pilot's speed on each axis (learned live)
  demoTiming() {
    const D = DEMO_TIMING[this.name]; if (!D || !this.toks.length) return { na: true };
    const T = this.toks.filter(k => k.raw >= 100); if (T.length < D.length) return { na: true };
    let ok = 0; const vals = [];
    for (let i = 0; i < D.length; i++) { const [ax, sec] = D[i], k = T[i]; if (ax !== '*' && k.ax !== ax) return { na: true };
      const want = sec * this.wa.speedFactor(k.ax), dur = k.t1 - k.t0; vals.push(dur.toFixed(2)); if (dur >= want * 0.3 && dur <= want * 2.6) ok++; }
    return { ok: ok === D.length, val: vals.join('/') + ' s' };
  }
  dove() { const c = this.cross('O'), u = this.cross('U'); if (!c || !u) return { ok: true, val: 'n/a' }; return { ok: this.fr(c.t, u.t).some(x => x.v.y < -1.0) }; }
}

function better(c, b) {
  if (!b) return true;
  if ((c.clen || 0) !== (b.clen || 0)) return (c.clen || 0) > (b.clen || 0);
  if ((c.toks.length) !== (b.toks.length)) return c.toks.length > b.toks.length;
  return trickPoints(c.name) > trickPoints(b.name);
}
// how the trick has to finish at its last obstacle pass: upright, and flying forward or backward
function endOK(tr, c) {
  if (!tr.end || !c) return true;
  if (c.upY !== undefined && c.upY < 0.45) return false;
  if (!c.fwdDot) return true;                      // too slow to tell: don't block
  return tr.end === 'back' ? c.fwdDot < -0.2 : c.fwdDot > 0.2;
}
function dropSmall(toks) { // ignore small correction rotations (< 110°) anywhere, then re-merge
  const out = [];
  for (const t of toks) { if (t.raw < 110) continue; const l = out[out.length - 1];
    if (l && l.ax === t.ax && l.dir === t.dir) { out[out.length - 1] = { ...l, raw: l.raw + t.raw, t1: t.t1, maxGap: Math.max(l.maxGap || 0, t.t0 - l.t1) }; } else out.push(t); }
  return out;
}
function trimNinety(toks) {
  let a = 0, b = toks.length;
  while (a < b && toks[a].deg <= 90) a++;
  while (b > a && toks[b - 1].deg <= 90) b--;
  return toks.slice(a, b);
}

// ================================================================= SCORING (TPW calculator rules)
const EXEC_MULT = { CLEAN: 1, SLOPPY: 0.65, MISSED: 0, BUMP: 0.5, CRASH: 0 };
const REPEAT_MULT = [1, 0.75, 0.5, 0];          // nth time a trick is landed in a run
const OBST_REPEAT = [1, 1, 1, 1, 0.66, 0.33, 0]; // consecutive tricks on the same obstacle
const SWITCH_BONUS = [[21, 2.0], [18, 1.7], [15, 1.5], [12, 1.35], [9, 1.2], [6, 1.1], [3, 1.05]];
const TOTW_MULT = [2, 1.5, 1];
const KWAD = { K: 'Half Matty', W: 'Wall Tap', A: 'Trippy Switch', D: 'Barani' };
class ScoreKeeper {
  constructor(totw) { this.totw = totw || ['Split-S', 'Powerloop', 'Matty Flip']; this.reset(); }
  reset() {
    this.total = 0; this.trickScore = 0; this.streak = 1; this.streakCount = 0; this.maxStreak = 1; this.counts = {}; this.prev = null; this.b2b = 1;
    this.lastObstacle = null; this.obstRun = 0; this.uniqueObs = new Set(); this.kwad = {}; this.kwadBonus = 0; this.log = []; this.totwCounts = {}; this.biggest = null;
  }
  add(ev) {
    const base = ev.basePts ?? trickPoints(ev.name);
    if (ev.exec === 'CRASH') { this.streak = 1; this.streakCount = 0; this.prev = null; this.log.push({ ...ev, net: 0 }); return { ...ev, net: 0, base: 0, streak: this.streak }; }
    if (!base) return null;
    const execM = EXEC_MULT[ev.exec] ?? 1;
    const n = this.counts[ev.name] || 0;
    const totwIdx = this.totw.indexOf(ev.name);
    let repeatM = REPEAT_MULT[Math.min(n, 3)], totwM = 1;
    if (totwIdx >= 0) { const c = this.totwCounts[ev.name] || 0; totwM = TOTW_MULT[c] ?? 0; repeatM = 1; }
    this.b2b = (this.prev === ev.name) ? this.b2b + 1 : 1;
    const b2bM = Math.pow(0.5, this.b2b - 1);
    let obsM = 1;
    if (ev.obstacle) { this.obstRun = (this.lastObstacle === ev.obstacle) ? this.obstRun + 1 : 0; obsM = OBST_REPEAT[Math.min(this.obstRun, 6)]; this.lastObstacle = ev.obstacle; this.uniqueObs.add(ev.obstacle); }
    const streakM = this.streak;
    const net = Math.round(base * execM * repeatM * totwM * b2bM * obsM * streakM);
    // streak update (spreadsheet: +adjusted raw/10000 for clean-ish, bump halves the bonus)
    const adjRaw = base * Math.min(1, totwM || 1) * execM * repeatM * b2bM;
    if (ev.exec === 'BUMP') this.streak = (1 + this.streak) / 2;
    else if (ev.exec === 'CLEAN' || ev.exec === 'SLOPPY') { if (repeatM > 0 && this.b2b === 1) { this.streak += adjRaw / 10000; this.streakCount++; } }
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    if (ev.exec !== 'MISSED') { this.counts[ev.name] = n + 1; if (totwIdx >= 0) this.totwCounts[ev.name] = (this.totwCounts[ev.name] || 0) + 1; }
    this.prev = ev.name;
    let kwadHit = null;
    for (const L in KWAD) if (KWAD[L] === ev.name && !this.kwad[L] && ev.exec !== 'MISSED') { this.kwad[L] = true; this.kwadBonus += 250; kwadHit = L; if (Object.keys(this.kwad).length === 4) this.kwadBonus += 2000; }
    this.trickScore += net;
    this.total = Math.round(this.trickScore * this.switchMult() + this.kwadBonus);
    const rec = { ...ev, base, net, execM, repeatM, b2bM, obsM, streakM, totwM, kwadHit };
    if (!this.biggest || net > this.biggest.net) this.biggest = rec;
    this.log.push(rec);
    return rec;
  }
  switchMult() { const u = this.uniqueObs.size; for (const [k, m] of SWITCH_BONUS) if (u >= k) return m; return 1; }
}

// ================================================================= Betaflight diff import
function importDiff(text, tune) {
  const t = JSON.parse(JSON.stringify(tune)); const set = {}; const found = [];
  for (const line of text.split(/\r?\n/)) { const m = line.match(/^\s*set\s+(\w+)\s*=\s*(\S+)/i); if (m) set[m[1].toLowerCase()] = m[2]; }
  const num = k => set[k] !== undefined ? +set[k] : undefined;
  for (const ax of ['roll', 'pitch', 'yaw']) {
    for (const [k, f] of [['p', 'p'], ['i', 'i'], ['d', 'd'], ['f', 'f']]) { const v = num(`${k}_${ax}`); if (v !== undefined) { t.pid[ax][f] = v; found.push(`${k}_${ax}`); } }
    const d4 = num(`d_max_${ax}`); // BF 4.3+ d_max / d_min — use d_max if present
    if (d4 !== undefined && d4 > 0) t.pid[ax].d = Math.max(t.pid[ax].d, d4);
  }
  if (set.rates_type) { t.ratesType = set.rates_type.toUpperCase() === 'ACTUAL' ? 'ACTUAL' : (set.rates_type.toUpperCase() === 'BETAFLIGHT' ? 'BETAFLIGHT' : t.ratesType); found.push('rates_type'); }
  for (const ax of ['roll', 'pitch', 'yaw']) {
    const rc = num(`${ax}_rc_rate`), sr = num(`${ax}_srate`), ex = num(`${ax}_expo`);
    const r = t.rates[ax];
    if (t.ratesType === 'ACTUAL') { if (rc !== undefined) r.center = rc * 10; if (sr !== undefined) r.max = sr * 10; if (ex !== undefined) r.expo = ex / 100; }
    else { if (rc !== undefined) r.rcRate = rc / 100; if (sr !== undefined) r.superRate = sr / 100; if (ex !== undefined) r.rcExpo = ex / 100; }
    if (rc !== undefined) found.push(`${ax}_rc_rate`);
  }
  if (num('dshot_idle_value') !== undefined) { t.idle = num('dshot_idle_value') / 10000; found.push('dshot_idle_value'); }
  if (num('thr_mid') !== undefined) t.thrMid = num('thr_mid') / 100;
  if (num('thr_expo') !== undefined) t.thrExpo = num('thr_expo') / 100;
  if (set.iterm_relax) t.itermRelax = set.iterm_relax.toUpperCase() !== 'OFF';
  if (num('fpv_mix_degrees') !== undefined) t.camTilt = t.camTilt; // ignored (camera mix)
  return { tune: t, found };
}

const EVENT_TRICKS_DRAFT = ['Jump Rope', 'Cinnamon Roll', 'Double Dutch', 'Side Loop', 'Burrito Roll', 'Beginner Switch', 'Orbit x2', 'Trippy Spin x2', 'Trippy Switch', 'Double Rolling Trippy Spin',
  'Cradle', 'Whiplash', 'Pole Dance', 'Side-Lock Rewind', 'Reverse Knife Edge', 'Reverse Wall Ride'];
// Where each trick can be flown in the playground, and what the prowhooper.com demo GIF used (docs/tricktionary-reference.md).
const OVER_UNDER = ['Tree', 'Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower', 'Covered Walkway', 'the pilot'];
const SPOT_BY_CAT = {
  'Open Air Tricks': ['open air'], 'Powerloops': OVER_UNDER, 'Maverick Loops': OVER_UNDER, 'Matty Flips': [...OVER_UNDER, 'Picnic Table'],
  'SplitS': OVER_UNDER, 'Pole Dancing': ['Flagpole', 'Tree', 'Lamp Post', 'Hoop Pole', 'the pilot'], 'Jump Roping': ['Swing Set', 'Monkey Bars', 'Jungle Gym', 'Slide Tower'],
  'Rewinds': ['Tree', 'Lamp Post', 'Slide Tower', 'the pilot', 'Brick Building'], 'Wall Tricks': ['Graffiti Wall', 'Brick Building', 'Fence'],
  'Gaps': ['Wall Slot', 'Hoop'], 'Other Tricks': ['open air'],
};
const SPOT_OVERRIDE = {
  'Stall Rewind': ['Tree', 'Lamp Post', 'Brick Building'], 'Dive': ['Brick Building'], 'Ceiling Tap': ['Slide Tower roof'],
  'Maverick Tap Rewind': ['Swing Set', 'Monkey Bars', 'Slide Tower'], 'Power Switch Tap': ['Swing Set', 'Monkey Bars', 'Slide Tower'],
  'Facepunch': ['the pilot'], 'Slide Disarm': ['the ground'], 'Perch': ['Brick Building roof'], 'Eject Roll': ['Tree', 'Lamp Post', 'Slide Tower', 'Brick Building'],
  'Stellar Eject Roll': ['Tree', 'Lamp Post', 'Brick Building'], 'Blindflip': OVER_UNDER, 'Inverted Yaw Tracking': ['Tree', 'Lamp Post', 'the pilot'],
  'Juicy Flick': ['open air (best tracking an object)'], 'Snapback': OVER_UNDER, 'Forani': OVER_UNDER, 'True Barani': OVER_UNDER,
};
const DEMO_SPOT = {
  'Flip': 'garage (open air)', 'Double Flip': 'backyard', 'Roll': 'at the pilot', 'Double Roll': 'backyard', 'Segmented Flips/Rolls': 'street',
  'Yaw Spin': 'through an LED cube', 'Invert Rewind': 'backyard', 'Vanny Roll': 'street', "Rubik's Cube": 'street', "Cubik's Rube": 'street',
  'Juicy Flick': 'sidewalk', 'Snapback': 'under a tree', 'Inverted Yaw Spin': 'street', 'Inverted Yaw Tracking': 'tree',
  'Powerloop': 'tall statue in a fountain', 'Immelmann Turn': "through the pilot's legs", 'Power Split': 'tree', 'Power Flip': 'tree',
  'Reversed Power Flip': 'indoor cube', 'Power Swap': "through the pilot's legs", 'Power Switch': 'tree', 'Power Roll': 'tree',
  'Inverted 360 Powerloop': 'tree', 'Barani': 'tree', 'Maverick Loop': 'tree', 'Mavvy Roll': 'tree', 'Half Mavvy': 'indoor gate tower',
  "Mavik's Loop": 'living room', 'Mavani': 'tree', 'Donkey Loop': 'tree', 'Beginner Matty': 'chair', 'Matty Flip': 'gap between two cars',
  'Matty Twister': 'tree branch', 'Half Matty': "through the pilot's legs", '540 Half Matty': 'tree', 'Matty 360': 'indoor gate',
  'Forani': 'the pilot (park)', 'Split-S': 'tree', '540 Split S': 'tree branch', 'Split-Back': 'gazebo', 'Split Yaw': 'gazebo',
  'Split Stall Matty Rewind': 'gazebo', 'Orbit x2': 'tree', 'Cradle': 'the pilot', 'Side-Lock Rewind': 'the pilot', 'Whiplash': 'tree',
  'Pole Dance': 'tree', 'Trippy Spin x2': 'tree', 'Trippy Switch': 'tree trunk', 'Double Rolling Trippy Spin': 'tree trunk',
  'Jump Rope': 'indoor striped pole', 'Cinnamon Roll': 'indoor striped pole', 'Burrito Roll': 'play structure slide', 'Side Loop': 'play structure slide',
  'Double Dutch': 'indoor cube', 'Flip Stall Rewind': 'indoor staircase', '360 Stall Rewind': 'the pilot', 'Matty Stall Rewind': 'tree',
  'Half Matty Stall Rewind': 'the pilot', 'Dive': 'apartment building', 'Wall Ride': 'garage door', 'Wall Tap': 'garage wall', 'Roll Tap': 'fence',
  'Loop Tap': 'fence', 'Ceiling Tap': 'hallway ceiling', 'Reverse Wall Ride': 'house wall',
  'Downtown Tap': 'house wall', 'Maverick Tap Rewind': 'indoor beam', 'Power Switch Tap': 'indoor beam', 'Reverse Knife Edge': 'indoor gate',
  'Ninja Star': 'gap between two tree trunks', 'Eject Roll': 'indoor cube', 'Blindflip': 'tree (site name: Blind Loop)', 'True Barani': 'tree', 'Stall Rewind': 'house wall', 'Beginner Switch': 'gazebo',
};
function trickSpots(name, cat) { const n = name.trim(); return { on: SPOT_OVERRIDE[n] || SPOT_BY_CAT[(cat || '').trim()] || ['open air'], demo: DEMO_SPOT[n] || null }; }
const DETECTABLE = [...new Set([...OBSTACLE_TRICKS.map(t => t.name), ...OPEN_TRICKS.map(t => t.name), ...CONTEXT_TRICKS.map(t => t.name), ...EVENT_TRICKS_DRAFT, 'Maverick Loop', 'Mavvy Roll', 'Beginner Matty', 'Knife Edge', 'Ninja Star',
  'Wall Tap', 'Wall Ride', 'Dive', 'Stall Rewind', 'Slide Disarm', 'Perch', 'Segmented Flips/Rolls', 'Facepunch'])];
const DRAFT = new Set([...OBSTACLE_TRICKS.filter(t => t.draft).map(t => t.name), ...CONTEXT_TRICKS.map(t => t.name), ...EVENT_TRICKS_DRAFT]);
function hoverInfo(p) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; const t = motorSteady(p, 3.75 * mid).thrust * 4; if (t > p.mass * G) hi = mid; else lo = mid; }
  const s = motorSteady(p, 3.75 * hi); const amps = 4 * s.current * hi + 0.35;
  return { duty: hi, amps, minutes: (p.bat.cap * 0.8 / 1000) / amps * 60 * 0.62 };
}
root.Sim = { trickSpots, DETECTABLE, DRAFT, CONTEXT_TRICKS, hoverInfo, PARTS, PRESETS, defaultTune, buildDrone, Drone, FlightController, applyRate, throttleCurve, ocv, buildPlayground,
  TrickDetector: StreamDetector, LegacyTrickDetector: TrickDetector, ScoreKeeper, OBSTACLE_TRICKS, OPEN_TRICKS, KWAD, importDiff, trickPoints, v3, qrot, qinv, qaxis, qmul, qnorm, D2R, R2D, len, sub, add, mul, dot, makeBox, makeCapsule, makeSphere, sphereVs, cross, norm };
})(typeof window !== 'undefined' ? window : globalThis);
