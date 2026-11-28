// Feel fit: a real flight's Blackbox log next to the sim flying the same sticks. Pure JS (Node: tools/feelfit.js; the game:
// Tools & labs → Feel Lab). Needs Sim (sim.js) and BBL (bbl.js) loaded first.
//
// What it measures, the same way on both sides, so a difference is a difference in the quad and not in the yardstick:
//   hover     motor output while hovering calm (% of the motor range)
//   motorLag  how long the motor speed takes to follow the motor command (cross-correlation of their changes, ms)
//   axisLag   how long each axis's rotation takes to follow the setpoint (ms), and how closely it tracks it (error / setpoint)
//   wobble    rotation wobble while hovering, 2-20 Hz (°/s sd): the "lofty" bob of a light quad in its own air
//   buzz      fast shake while hovering, above 40 Hz (°/s sd): frame and motor vibration (the real gyro, unfiltered)
// What it cannot see: position (no GPS on a whoop), so drag and coasting are not measured; set them by feel (Garage →
// Advanced → physics feel).
(function (root) {
  const S = root.Sim,
    BBL = root.BBL;
  const avg = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length),
    sd = a => {
      const m = avg(a);
      return Math.sqrt(avg(a.map(x => (x - m) * (x - m))));
    };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---- a decoded log → plain series at the log rate (every column the fit needs)
  function series(L, opts = {}) {
    const F = L.fields,
      ix = n => F.indexOf(n),
      R = L.rows;
    if (!R.length) return null;
    const need = [
      'time',
      'rcCommand[0]',
      'rcCommand[1]',
      'rcCommand[2]',
      'rcCommand[3]',
      'setpoint[0]',
      'setpoint[1]',
      'setpoint[2]',
      'gyroADC[0]',
      'gyroADC[1]',
      'gyroADC[2]',
      'motor[0]'
    ];
    if (need.some(n => ix(n) < 0)) return null;
    const H = L.headers || {},
      mo = (H.motorOutput || '158,2047').split(',').map(Number),
      m0 = mo[0] || 158,
      m1 = mo[1] || 2047,
      hasE = ix('eRPM[0]') >= 0,
      hasU = ix('gyroUnfilt[0]') >= 0;
    const t0 = R[0][ix('time')],
      from = opts.from ?? 0,
      to = opts.to ?? Infinity,
      out = { t: [], thr: [], stick: [[], [], []], sp: [[], [], []], gyro: [[], [], []], unf: [[], [], []], duty: [], rpm: [], vbat: [] };
    for (const r of R) {
      const t = (r[ix('time')] - t0) / 1e6;
      if (t < from || t > to) continue;
      out.t.push(t);
      out.thr.push(clamp((r[ix('rcCommand[3]')] - 1000) / 1000, 0, 1));
      for (let k = 0; k < 3; k++) {
        out.stick[k].push(clamp(r[ix(`rcCommand[${k}]`)] / 500, -1, 1));
        out.sp[k].push(r[ix(`setpoint[${k}]`)]);
        out.gyro[k].push(r[ix(`gyroADC[${k}]`)]);
        out.unf[k].push(hasU ? r[ix(`gyroUnfilt[${k}]`)] : r[ix(`gyroADC[${k}]`)]);
      }
      let m = 0,
        e = 0;
      for (let k = 0; k < 4; k++) {
        m += r[ix(`motor[${k}]`)];
        if (hasE) e += r[ix(`eRPM[${k}]`)];
      }
      out.duty.push(clamp((m / 4 - m0) / (m1 - m0), 0, 1));
      out.rpm.push(hasE ? e / 4 : NaN);
      if (hasE) for (let k = 0; k < 4; k++) (out.rpm4 || (out.rpm4 = [[], [], [], []]))[k].push(r[ix(`eRPM[${k}]`)]);
      out.vbat.push(ix('vbatLatest') >= 0 ? r[ix('vbatLatest')] / 100 : NaN);
    }
    const n = out.t.length;
    out.hz = n > 1 ? (n - 1) / (out.t[n - 1] - out.t[0]) : 1000;
    out.headers = H;
    out.hasRpm = hasE;
    return out;
  }
  // the longest stretch with the motors spinning (a flight), in seconds from the log start
  function flightSpan(L) {
    const s = series(L);
    if (!s) return null;
    let best = null,
      a = null,
      last = -1e9; // throttle chops (flips, dives) under 2 s are the same flight
    for (let i = 0; i < s.t.length; i++) {
      const on = s.duty[i] > 0.06;
      if (on) {
        if (a == null || s.t[i] - last > 2) {
          if (a != null && (!best || last - s.t[a] > best[2])) best = [a, i, last - s.t[a], last];
          a = i;
        }
        last = s.t[i];
      }
    }
    if (a != null && (!best || last - s.t[a] > best[2])) best = [a, 0, last - s.t[a], last];
    return best ? { from: s.t[best[0]], to: best[3], secs: best[2] } : null;
  }

  // ---- the measurements (a series from the log or from the sim)
  const movAvg = (a, w) => {
    const out = new Array(a.length);
    let s = 0;
    const h = Math.max(1, Math.round(w));
    for (let i = 0; i < a.length; i++) {
      s += a[i];
      if (i >= h) s -= a[i - h];
      out[i] = s / Math.min(i + 1, h);
    }
    return out;
  };
  function lagMs(x, y, hz, maxMs = 120) {
    // the delay of y behind x, from the cross-correlation of their changes
    const dx = x.map((v, i) => (i ? v - x[i - 1] : 0)),
      dy = y.map((v, i) => (i ? v - y[i - 1] : 0)),
      maxL = Math.round((maxMs / 1000) * hz);
    let best = -Infinity,
      bl = 0,
      sum = 0;
    for (let l = 0; l <= maxL; l++) {
      let s = 0;
      for (let i = 1; i + l < dx.length; i++) s += dx[i] * dy[i + l];
      if (l === 0) sum = s;
      if (s > best) {
        best = s;
        bl = l;
      }
    }
    // a parabola through the peak for sub-sample timing
    const c = l => {
      let s = 0;
      for (let i = 1; i + l < dx.length; i++) s += dx[i] * dy[i + l];
      return s;
    };
    if (bl > 0 && bl < maxL) {
      const a = c(bl - 1),
        b = best,
        d = c(bl + 1),
        den = a - 2 * b + d;
      if (den < 0) return ((bl + (0.5 * (a - d)) / den) / hz) * 1000;
    }
    void sum;
    return (bl / hz) * 1000;
  }
  function calmIdx(s) {
    // hovering calm: sticks near centre, rotation small, motors on
    const out = [];
    for (let i = 0; i < s.t.length; i++) {
      const st = Math.abs(s.stick[0][i]) + Math.abs(s.stick[1][i]) + Math.abs(s.stick[2][i]),
        w = Math.abs(s.gyro[0][i]) + Math.abs(s.gyro[1][i]) + Math.abs(s.gyro[2][i]);
      if (st < 0.06 && w < 60 && s.duty[i] > 0.08) out.push(i);
    }
    return out;
  }
  // throttle steps: the motor command jumps by 12 %+ within 30 ms and then holds; time for the motor speed to cover 63 % of
  // its own change (median over the steps; the same yardstick as the Garage's motor-lag figure)
  function rise63(s, hz) {
    const D = s.duty,
      Rp = s.rpm,
      n = D.length,
      w30 = Math.round(0.03 * hz),
      w150 = Math.round(0.15 * hz),
      out = [];
    for (let i = w30; i < n - w150 - 2; i++) {
      const dD = D[i + w30] - D[i];
      if (Math.abs(dD) < 0.12) continue;
      let hold = true;
      for (let j = i + w30; j < i + w150; j++)
        if (Math.abs(D[j] - D[i + w30]) > 0.04) {
          hold = false;
          break;
        }
      if (!hold) continue;
      const r0 = Rp[i],
        r1 = avg(Rp.slice(i + w150 - Math.round(0.02 * hz), i + w150)),
        tgt = r0 + 0.63 * (r1 - r0);
      if (Math.abs(r1 - r0) < 1e-6) continue;
      let k = i;
      while (k < i + w150 && (r1 > r0 ? Rp[k] < tgt : Rp[k] > tgt)) k++;
      out.push(((k - i) / hz) * 1000);
      i += w150;
    }
    if (out.length < 3) return null;
    out.sort((a, b) => a - b);
    return +out[Math.floor(out.length / 2)].toFixed(1);
  }
  // ---- the average step response (owner, 2026-11-21; the method of Plasmatree's PID-Analyzer): what the quad would do if the
  // sticks asked for a sudden, held rate. Freestyle has no clean steps, so every second of flying with some stick movement is
  // deconvolved (the rotation's spectrum over the setpoint's, damped where the setpoint has no energy: Wiener), turned back
  // into time and summed up into a step; the windows are averaged by how hard the sticks moved in them. 1 = it does exactly
  // what was asked. From it: `t50` / `t90` (ms to reach half / 90 %), `over` (% past the mark at its peak) and `settle`
  // (where it sits after 0.3-0.5 s). The series is first brought down to ~500 Hz (plenty for a 10-30 ms rise).
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let b = n >> 1;
      for (; j & b; b >>= 1) j ^= b;
      j ^= b;
      if (i < j) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = ((inv ? 2 : -2) * Math.PI) / len,
        wr = Math.cos(a),
        wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1,
          ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const p = i + k,
            q = p + len / 2,
            xr = re[q] * cr - im[q] * ci,
            xi = re[q] * ci + im[q] * cr;
          re[q] = re[p] - xr;
          im[q] = im[p] - xi;
          re[p] += xr;
          im[p] += xi;
          const t = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = t;
        }
      }
    }
    if (inv)
      for (let i = 0; i < n; i++) {
        re[i] /= n;
        im[i] /= n;
      }
  }
  function stepResponse(sp, gy, hz, opts = {}) {
    const dec = Math.max(1, Math.round(hz / 500)),
      fs = hz / dec,
      down = a => {
        const o = [];
        for (let i = 0; i + dec <= a.length; i += dec) {
          let v = 0;
          for (let k = 0; k < dec; k++) v += a[i + k];
          o.push(v / dec);
        }
        return o;
      };
    const x = down(sp),
      y = down(gy),
      N = 512,
      hop = 128,
      M = Math.min(N / 2, Math.round(0.5 * fs)),
      cut = opts.cutHz || 70,
      minIn = opts.minIn ?? 20;
    const acc = new Float64Array(M);
    let wsum = 0,
      used = 0;
    for (let a = 0; a + N <= x.length; a += hop) {
      let peak = 0,
        e = 0;
      for (let i = 0; i < N; i++) {
        const v = Math.abs(x[a + i]);
        if (v > peak) peak = v;
        e += v * v;
      }
      if (peak < minIn) continue;
      const xr = new Float64Array(N),
        xi = new Float64Array(N),
        yr = new Float64Array(N),
        yi = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
        xr[i] = x[a + i] * w;
        yr[i] = y[a + i] * w;
      }
      fft(xr, xi);
      fft(yr, yi);
      let pm = 0;
      for (let k = 0; k < N; k++) pm += xr[k] * xr[k] + xi[k] * xi[k];
      const lam = (0.0001 * pm) / N + 1e-9;
      const hr = new Float64Array(N),
        hi = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const f = ((k <= N / 2 ? k : N - k) * fs) / N,
          lp = Math.exp(-0.5 * (f / cut) * (f / cut)),
          d = xr[k] * xr[k] + xi[k] * xi[k] + lam; // H = Y conj(X) / (|X|² + λ), low-passed
        hr[k] = ((yr[k] * xr[k] + yi[k] * xi[k]) / d) * lp;
        hi[k] = ((yi[k] * xr[k] - yr[k] * xi[k]) / d) * lp;
      }
      fft(hr, hi, true);
      let c = 0;
      const wgt = Math.sqrt(e / N);
      for (let i = 0; i < M; i++) {
        c += hr[i];
        acc[i] += c * wgt;
      }
      wsum += wgt;
      used++;
    }
    if (used < 3) return null;
    const st = Array.from(acc, v => v / wsum),
      ms = i => (i * 1000) / fs,
      i0 = Math.round(0.3 * fs),
      settle = avg(st.slice(i0)) || 1;
    const cross = lv => {
      for (let i = 1; i < M; i++)
        if (st[i] >= lv * settle) {
          const f = (lv * settle - st[i - 1]) / Math.max(1e-9, st[i] - st[i - 1]);
          return +ms(i - 1 + f).toFixed(1);
        }
      return null;
    };
    const pk = Math.max(...st.slice(0, Math.round(0.2 * fs)));
    return {
      t50: cross(0.5),
      t90: cross(0.9),
      over: +Math.max(0, (pk / settle - 1) * 100).toFixed(1),
      settle: +settle.toFixed(3),
      n: used,
      dt: +(1000 / fs).toFixed(2),
      curve: st.slice(0, Math.round(0.25 * fs)).map(v => +v.toFixed(3))
    };
  }
  function measure(s) {
    const hz = s.hz,
      calm = calmIdx(s),
      m = { hz: Math.round(hz), secs: +(s.t[s.t.length - 1] - s.t[0]).toFixed(1), calm: +(calm.length / hz).toFixed(1) };
    m.hover = calm.length > hz * 0.5 ? +(avg(calm.map(i => s.duty[i])) * 100).toFixed(1) : null;
    m.motorLag = s.hasRpm ? +lagMs(s.duty, s.rpm, hz, 60).toFixed(1) : null; // dead time before the motor starts to move
    m.motorRise = s.hasRpm ? rise63(s, hz) : null; // then how long a throttle step takes (63 %)
    // axis response: setpoint → rotation (sign found from the correlation), tracking error over the busy parts
    m.axes = [0, 1, 2].map(k => {
      const sp = s.sp[k],
        g = s.gyro[k];
      let dot = 0;
      for (let i = 0; i < sp.length; i++) dot += sp[i] * g[i];
      const sg = dot < 0 ? -1 : 1,
        gg = g.map(v => v * sg);
      const lag = lagMs(sp, gg, hz, 120),
        L = Math.round((lag / 1000) * hz),
        busy = [];
      for (let i = 0; i + L < sp.length; i++) if (Math.abs(sp[i]) > 60) busy.push(i);
      const err = busy.length
        ? Math.sqrt(avg(busy.map(i => (gg[i + L] - sp[i]) ** 2))) / Math.max(1, Math.sqrt(avg(busy.map(i => sp[i] ** 2))))
        : null;
      return {
        lag: +lag.toFixed(1),
        track: err == null ? null : +(err * 100).toFixed(1),
        peak: Math.round(Math.max(...gg.map(Math.abs))),
        step: stepResponse(sp, gg, hz)
      };
    });
    // wobble the pilot did not ask for: gyro minus the setpoint it should follow (moved by the measured lag), 2-20 Hz, where
    // the quad is cruising or hovering (setpoint under 150 °/s): air, wash and the controller's own imperfection
    m.resid = [0, 1, 2].map((k, ai) => {
      const sp = s.sp[k],
        g = s.gyro[k];
      let dot = 0;
      for (let i = 0; i < sp.length; i++) dot += sp[i] * g[i];
      const sg = dot < 0 ? -1 : 1,
        L = Math.round((m.axes[ai].lag / 1000) * hz);
      const r = sp.map((v, i) => (i + L < g.length ? g[i + L] * sg : 0) - v),
        f = movAvg(r, hz * 0.025),
        sl = movAvg(r, hz * 0.5),
        w = [];
      for (let i = 0; i + L < sp.length; i++) if (Math.abs(sp[i]) < 150 && s.duty[i] > 0.08) w.push(f[i] - sl[i]);
      return w.length > hz ? +sd(w).toFixed(2) : null;
    });
    // shake while hovering: 2-20 Hz wobble (25 ms average minus 500 ms average), > 40 Hz buzz (raw minus the 25 ms average)
    const band = (a, k) => {
      if (calm.length < hz * 0.5) return null;
      const f = movAvg(a, hz * 0.025),
        sl = movAvg(a, hz * 0.5),
        w = [],
        b = [];
      for (const i of calm) {
        w.push(f[i] - sl[i]);
        b.push(a[i] - f[i]);
      }
      return k === 'w' ? sd(w) : sd(b);
    };
    m.wobble = [0, 1, 2].map(k => {
      const v = band(s.gyro[k], 'w');
      return v == null ? null : +v.toFixed(2);
    });
    m.buzz = [0, 1, 2].map(k => {
      const v = band(s.unf[k], 'b');
      return v == null ? null : +v.toFixed(2);
    });
    return m;
  }

  // ---- the sim flying the same sticks: high in empty air (nothing to hit, no ground), with the log's rates so the setpoints
  // match; the pilot's build and the rest of their tune (PIDs, filters, feel sliders, shake)
  function simulate(s, opts = {}) {
    const spec = opts.spec || S.PRESETS['Air65 Racing'],
      tune = { ...(opts.tune || S.defaultTune()) },
      R = s.headers ? BBL.ratesFromHeaders(s.headers) : null;
    if (R && opts.logRates !== false) {
      tune.ratesType = R.type;
      tune.rates = JSON.parse(JSON.stringify(R.rates));
      for (const ax of ['roll', 'pitch', 'yaw']) tune.rates[ax] = { ...S.defaultTune().rates[ax], ...R.rates[ax] };
    }
    tune.thrMid = 0.5;
    tune.thrExpo = 0;
    tune.flightMode = 'acro';
    tune.batteryLife = false; // the log's throttle is already through its curve
    const W = { objs: [], prims: [], zones: [], spawn: { pos: S.v3(0, 400, 0), yaw: 0 } },
      d = new S.Drone(S.buildDrone(spec), tune, W);
    d.reset(W.spawn);
    d.armed = true;
    const out = {
      t: [],
      thr: s.thr,
      stick: s.stick,
      sp: s.sp,
      gyro: [[], [], []],
      unf: [[], [], []],
      duty: [],
      rpm: [],
      rpm4: [[], [], [], []],
      hz: s.hz,
      hasRpm: true
    };
    // the sim's motors in Betaflight's order (0 rear right, 1 front right, 2 rear left, 3 front left; the sim's front is -z, right +x)
    const bf = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ].map(([sx, sz]) => d.p.motors.findIndex(m => Math.sign(m.pos.x) === sx && Math.sign(m.pos.z) === sz));
    const n = s.t.length,
      sub = Math.max(1, Math.round(1000 / s.hz)),
      dt = 1 / (s.hz * sub);
    let wMax = 1;
    for (const m of d.p.motors) wMax = Math.max(wMax, m.wMax || 1);
    for (let i = 0; i < n; i++) {
      const rc = { thr: s.thr[i], roll: s.stick[0][i], pitch: -s.stick[1][i], yaw: s.stick[2][i] };
      for (let j = 0; j < sub; j++) d.step(rc, dt);
      if (d.pos.y < 50) {
        d.pos = S.v3(d.pos.x, 400, d.pos.z);
      } // fell a long way: lift it back up (only the rotation matters)
      const R2 = d.pilotRates();
      out.t.push(s.t[i]);
      for (let k = 0; k < 3; k++) {
        out.gyro[k].push(R2[k]);
        out.unf[k].push(R2[k]);
      }
      const o = d.duty;
      out.duty.push(o ? avg(Array.from(o, Math.abs)) : NaN);
      out.rpm.push(avg(d.motorW.map(Math.abs)));
      for (let k = 0; k < 4; k++) out.rpm4[k].push(Math.abs(d.motorW[bf[k]]));
    }
    return out;
  }

  // ---- what to change: the sliders that move each measurement the right way, and how far
  function suggest(real, sim, tune = {}, simB) {
    // simB: the sim again with more shake and delay, for the slopes
    const out = [],
      cur = k => tune[k] ?? 1,
      A = a => avg(a.filter(x => x != null));
    if (real.motorRise != null && sim.motorRise != null && real.motorRise > 0.5) {
      const v = clamp((cur('motorFeel') * sim.motorRise) / real.motorRise, 0.5, 4);
      out.push({
        key: 'motorFeel',
        label: 'Motor response',
        now: cur('motorFeel'),
        to: +v.toFixed(2),
        why: `a throttle step reaches 63 % in ${real.motorRise} ms on yours, ${sim.motorRise} ms in the sim`
      });
    }
    const lagR = A(real.axes.slice(0, 2).map(a => a.lag)),
      lagS = A(sim.axes.slice(0, 2).map(a => a.lag)),
      d0 = tune.loopDelayMs || 0;
    if (lagR > 0 && lagS > 0 && Math.abs(lagR - lagS) > 0.8)
      out.push({
        key: 'loopDelayMs',
        label: 'Loop delay (ms)',
        now: d0,
        to: +clamp(d0 + (lagR - lagS), 0, 15).toFixed(1),
        why: `roll / pitch follow the sticks ${lagR.toFixed(1)} ms behind on yours, ${lagS.toFixed(1)} ms in the sim`
      });
    const rr = A(real.resid.slice(0, 2)),
      rs = A(sim.resid.slice(0, 2)),
      sh0 = tune.shake ?? 0;
    if (rr > 0 && rs > 0) {
      let v = sh0;
      const rb = simB ? A(simB.resid.slice(0, 2)) : null,
        dsh = simB ? simB.shake - sh0 : 0;
      if (rb != null && dsh > 0 && rb > rs + 0.05) {
        const varR = rr * rr,
          varS = rs * rs,
          varB = rb * rb;
        v = sh0 + dsh * Math.sqrt(Math.max(0, (varR - varS) / (varB - varS))) * (varR >= varS ? 1 : -1);
      } // the shake adds in variance
      out.push({
        key: 'shake',
        label: 'Shake',
        now: sh0,
        to: +clamp(v, 0, 4).toFixed(2),
        why: `wobble you did not ask for (2-20 Hz): ${rr.toFixed(1)} °/s on yours, ${rs.toFixed(1)} °/s in the sim`
      });
    }
    if (real.hover != null && sim.hover != null && sim.hover > 1) {
      const r = (real.hover / sim.hover) ** 1.6,
        v = clamp(cur('weightFeel') * r, 0.5, 1.5);
      if (Math.abs(r - 1) > 0.06)
        out.push({
          key: 'weightFeel',
          label: 'Weight',
          now: cur('weightFeel'),
          to: +v.toFixed(2),
          why: `you hover at ${real.hover}% motor, the sim at ${sim.hover}% (or pick the parts of your build in the Garage first)`
        });
    }
    return out;
  }
  // the whole job for one log: which flight, both measurements, the suggestions
  function compare(L, opts = {}) {
    const span = opts.from != null ? { from: opts.from, to: opts.to } : flightSpan(L);
    if (!span) return null;
    const to = Math.min(span.to, span.from + (opts.maxSecs || 45)),
      s = series(L, { from: span.from + 0.5, to });
    if (!s || s.t.length < 500) return null;
    const tune = opts.tune || S.defaultTune(),
      real = measure(s),
      simS = simulate(s, { ...opts, tune }),
      sim = measure(simS);
    const tB = { ...tune, shake: (tune.shake || 0) + 0.5 },
      simB = measure(simulate(s, { ...opts, tune: tB }));
    simB.shake = tB.shake;
    return { span: { from: +span.from.toFixed(1), to: +to.toFixed(1) }, real, sim, suggest: suggest(real, sim, tune, simB), s, simS };
  }
  // a joint fit of loop delay and shake on one or more prepared flights: the pair whose roll / pitch lag, tracking error and
  // unasked wobble come closest to the real quad's (each as a relative error; lag in ms / 10)
  function prepare(L, opts = {}) {
    const span = opts.from != null ? { from: opts.from, to: opts.to } : flightSpan(L);
    if (!span) return null;
    const s = series(L, { from: span.from + 0.5, to: Math.min(span.to, span.from + (opts.maxSecs || 30)) });
    if (!s || s.t.length < 500) return null;
    return { s, real: measure(s) };
  }
  function cost(real, sim) {
    let c = 0;
    for (const k of [0, 1]) {
      c += Math.abs(sim.axes[k].lag - real.axes[k].lag) / 10;
      if (real.axes[k].track && sim.axes[k].track != null) c += Math.abs(sim.axes[k].track - real.axes[k].track) / real.axes[k].track;
      if (real.resid[k] && sim.resid[k] != null) c += Math.abs(sim.resid[k] - real.resid[k]) / real.resid[k];
    }
    return c;
  }
  function fit(preps, opts = {}) {
    const base = opts.tune || S.defaultTune(),
      delays = opts.delays || [0, 1.5, 3, 4.5],
      shakes = opts.shakes || [0, 0.2, 0.35, 0.5, 0.7],
      rows = [];
    for (const d of delays)
      for (const sh of shakes) {
        const tune = { ...base, loopDelayMs: d, shake: sh };
        let c = 0;
        for (const P of preps) c += cost(P.real, measure(simulate(P.s, { ...opts, tune })));
        rows.push({ loopDelayMs: d, shake: sh, cost: +(c / preps.length).toFixed(3) });
        if (opts.progress) opts.progress(rows.length / (delays.length * shakes.length));
      }
    rows.sort((a, b) => a.cost - b.cost);
    return { best: rows[0], rows };
  }
  root.FeelFit = { stepResponse, series, flightSpan, measure, simulate, suggest, compare, lagMs, prepare, fit, cost };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FeelFit;
})(typeof window !== 'undefined' ? window : globalThis);
