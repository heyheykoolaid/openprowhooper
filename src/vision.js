// Camera rotation from FPV video, in plain JS (browser + Node). Used by Video Review: the pilot loads a DVR/HD clip,
// this tracks features frame to frame (pyramidal Lucas-Kanade), turns them into lens bearings (equidistant fisheye)
// and fits a pure rotation (RANSAC + Horn's quaternion method). Output per frame pair: [roll, pitch, yaw] degrees in
// camera axes — the same convention as tools/gif_rotation.py — or null where tracking failed (heavy blur).
(function (root) {
  // ---------- images: { w, h, d: Float32Array } grayscale 0..255
  function fromRGBA(rgba, w, h) {
    const d = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    return { w, h, d };
  }
  function blurHalf(im) {
    // 2x2 box + downsample
    const w = im.w >> 1,
      h = im.h >> 1,
      d = new Float32Array(w * h),
      s = im.d,
      W = im.w;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = 2 * y * W + 2 * x;
        d[y * w + x] = 0.25 * (s[i] + s[i + 1] + s[i + W] + s[i + W + 1]);
      }
    return { w, h, d };
  }
  function pyramid(im, levels) {
    const P = [im];
    for (let i = 1; i < levels; i++) P.push(blurHalf(P[i - 1]));
    return P;
  }
  function grad(im) {
    const { w, h, d } = im,
      gx = new Float32Array(w * h),
      gy = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        gx[i] = 0.5 * (d[i + 1] - d[i - 1]);
        gy[i] = 0.5 * (d[i + w] - d[i - w]);
      }
    return { gx, gy };
  }
  const samp = (a, w, h, x, y) => {
    // bilinear
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > w - 1.001) x = w - 1.001;
    if (y > h - 1.001) y = h - 1.001;
    const x0 = x | 0,
      y0 = y | 0,
      fx = x - x0,
      fy = y - y0,
      i = y0 * w + x0;
    return (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + w] * (1 - fx) + a[i + w + 1] * fx) * fy;
  };
  // ---------- corners: Shi-Tomasi min eigenvalue, best one per grid cell, OSD bands masked
  function corners(im, opt = {}) {
    const { w, h } = im,
      { gx, gy } = grad(im),
      cols = opt.cols || 14,
      rows = opt.rows || 10,
      m0 = Math.round(h * (opt.maskTop ?? 0.07)),
      m1 = Math.round(h * (1 - (opt.maskBottom ?? 0.13)));
    const best = new Map();
    for (let y = Math.max(4, m0); y < Math.min(h - 4, m1); y += 2)
      for (let x = 4; x < w - 4; x += 2) {
        let a = 0,
          b = 0,
          c = 0;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const i = (y + dy) * w + x + dx;
            a += gx[i] * gx[i];
            b += gx[i] * gy[i];
            c += gy[i] * gy[i];
          }
        const l = 0.5 * (a + c - Math.sqrt((a - c) * (a - c) + 4 * b * b));
        const k = (((y * rows) / h) | 0) * cols + (((x * cols) / w) | 0),
          o = best.get(k);
        if (!o || l > o.l) best.set(k, { x, y, l });
      }
    const all = [...best.values()].sort((p, q) => q.l - p.l);
    const thr = (all[0] ? all[0].l : 0) * 0.02;
    return all.filter(p => p.l > Math.max(thr, 50)).map(p => [p.x, p.y]);
  }
  // ---------- pyramidal Lucas-Kanade for one point; returns [x, y] in level-0 pixels or null
  function lk(PA, PB, GA, x, y, win = 5, iters = 12, gu = 0, gv = 0) {
    let u = 0,
      v = 0;
    for (let L = PA.length - 1; L >= 0; L--) {
      const A = PA[L],
        B = PB[L],
        G = GA[L],
        s = 1 << L,
        px = x / s,
        py = y / s;
      u *= 2;
      v *= 2;
      if (L === PA.length - 1) {
        u = gu / s;
        v = gv / s;
      }
      let gxx = 0,
        gxy = 0,
        gyy = 0;
      const tx = [],
        ty = [],
        ta = [];
      for (let dy = -win; dy <= win; dy++)
        for (let dx = -win; dx <= win; dx++) {
          const X = px + dx,
            Y = py + dy,
            ix = samp(G.gx, A.w, A.h, X, Y),
            iy = samp(G.gy, A.w, A.h, X, Y);
          gxx += ix * ix;
          gxy += ix * iy;
          gyy += iy * iy;
          tx.push(ix);
          ty.push(iy);
          ta.push(samp(A.d, A.w, A.h, X, Y));
        }
      const det = gxx * gyy - gxy * gxy;
      if (det < 1e-3) return null;
      for (let it = 0; it < iters; it++) {
        let bx = 0,
          by = 0,
          k = 0;
        for (let dy = -win; dy <= win; dy++)
          for (let dx = -win; dx <= win; dx++, k++) {
            const e = ta[k] - samp(B.d, B.w, B.h, px + dx + u, py + dy + v);
            bx += e * tx[k];
            by += e * ty[k];
          }
        const du = (gyy * bx - gxy * by) / det,
          dv = (gxx * by - gxy * bx) / det;
        u += du;
        v += dv;
        if (du * du + dv * dv < 0.0009) break;
      }
      if (!isFinite(u) || Math.abs(u) > A.w || Math.abs(v) > A.h) return null;
    }
    return [x + u, y + v];
  }
  // ---------- rotation fit on unit bearings: b ≈ R a (Horn's quaternion method, Jacobi eigen-solve of a 4x4)
  function eig4max(N) {
    const a = N.map(r => r.slice()),
      V = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ];
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = 0;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p][q] * a[p][q];
      if (off < 1e-18) break;
      for (let p = 0; p < 4; p++)
        for (let q = p + 1; q < 4; q++) {
          if (Math.abs(a[p][q]) < 1e-15) continue;
          const th = (a[q][q] - a[p][p]) / (2 * a[p][q]),
            t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)),
            c = 1 / Math.sqrt(t * t + 1),
            s = t * c;
          for (let k = 0; k < 4; k++) {
            const akp = a[k][p],
              akq = a[k][q];
            a[k][p] = c * akp - s * akq;
            a[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < 4; k++) {
            const apk = a[p][k],
              aqk = a[q][k];
            a[p][k] = c * apk - s * aqk;
            a[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < 4; k++) {
            const vkp = V[k][p],
              vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
    }
    let m = 0;
    for (let i = 1; i < 4; i++) if (a[i][i] > a[m][m]) m = i;
    return [V[0][m], V[1][m], V[2][m], V[3][m]];
  }
  function horn(A, B, idx) {
    // quaternion q (w,x,y,z) with B ≈ q A q*
    let Sxx = 0,
      Sxy = 0,
      Sxz = 0,
      Syx = 0,
      Syy = 0,
      Syz = 0,
      Szx = 0,
      Szy = 0,
      Szz = 0;
    for (const i of idx) {
      const a = A[i],
        b = B[i];
      Sxx += a[0] * b[0];
      Sxy += a[0] * b[1];
      Sxz += a[0] * b[2];
      Syx += a[1] * b[0];
      Syy += a[1] * b[1];
      Syz += a[1] * b[2];
      Szx += a[2] * b[0];
      Szy += a[2] * b[1];
      Szz += a[2] * b[2];
    }
    const N = [
      [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
      [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
      [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
      [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]
    ];
    return eig4max(N);
  }
  const qrot = (q, v) => {
    const [w, x, y, z] = q,
      [a, b, c] = v,
      ix = w * a + y * c - z * b,
      iy = w * b + z * a - x * c,
      iz = w * c + x * b - y * a,
      iw = -x * a - y * b - z * c;
    return [ix * w - iw * x - iy * z + iz * y, iy * w - iw * y - iz * x + ix * z, iz * w - iw * z - ix * y + iy * x];
  };
  const qmul4 = (a, b) => [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]
  ];
  const angleDeg = (a, b) => {
    const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI;
  };
  const axq = (ax, a) => {
    const s = Math.sin(a / 2);
    return [Math.cos(a / 2), ax[0] * s, ax[1] * s, ax[2] * s];
  };
  function fitRotation(A, B, thr, rnd) {
    const n = A.length;
    if (n < 8) return null;
    let best = null;
    for (let it = 0; it < 120; it++) {
      const i = (rnd() * n) | 0,
        j = (rnd() * n) | 0,
        k = (rnd() * n) | 0;
      if (i === j || j === k || i === k) continue;
      const q = horn(A, B, [i, j, k]);
      const inl = [];
      for (let m = 0; m < n; m++) {
        const r = qrot(q, A[m]),
          e = Math.hypot(r[0] - B[m][0], r[1] - B[m][1], r[2] - B[m][2]);
        if (e < thr) inl.push(m);
      }
      if (!best || inl.length > best.length) best = inl;
    }
    if (!best || best.length < 8 || best.length < 0.35 * n) return null;
    return { q: horn(A, B, best), inliers: best.length, n };
  }
  // ---------- tracker: feed frames one by one
  function Tracker(opt = {}) {
    this.hfov = opt.hfov || 140;
    this.levels = opt.levels || 4;
    this.prev = null;
    this.mask = opt;
    this.coast = 0;
    let s = 12345;
    this.rnd = () => {
      s = (s * 1103515245 + 12345) >>> 0;
      return s / 4294967296;
    };
  }
  Tracker.prototype.bearing = function (p, im) {
    const f = im.w / 2 / (((this.hfov / 2) * Math.PI) / 180),
      x = (p[0] - im.w / 2) / f,
      y = (p[1] - im.h / 2) / f,
      th = Math.hypot(x, y),
      ph = Math.atan2(y, x);
    return [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
  };
  Tracker.prototype.project = function (b, im) {
    // unit bearing -> pixel (equidistant fisheye)
    const f = im.w / 2 / (((this.hfov / 2) * Math.PI) / 180),
      th = Math.acos(Math.max(-1, Math.min(1, b[2]))),
      r = Math.hypot(b[0], b[1]) || 1e-9;
    return [im.w / 2 + (f * th * b[0]) / r, im.h / 2 + (f * th * b[1]) / r];
  };
  // coarse photometric search over rotations on a tiny copy of the frames: robust to blur and big jumps
  Tracker.prototype.search = function (A, B, center) {
    // A, B: tiny images; center: predicted bearing-map quaternion
    const f = A.w / 2 / (((this.hfov / 2) * Math.PI) / 180),
      m0 = Math.round(A.h * 0.07),
      m1 = Math.round(A.h * 0.87);
    if (!this._tb || this._tb.w !== A.w) {
      const pts = [];
      for (let y = m0; y < m1; y++)
        for (let x = 0; x < A.w; x++) {
          const u = (x - A.w / 2) / f,
            v = (y - A.h / 2) / f,
            th = Math.hypot(u, v),
            ph = Math.atan2(v, u);
          if (th < (((this.hfov / 2) * Math.PI) / 180) * 0.98)
            pts.push([x, y, Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]);
        }
      this._tb = { w: A.w, pts };
    }
    const pts = this._tb.pts,
      D = Math.PI / 180;
    const cost = q => {
      // B(p) vs A(R^T p): q maps A-bearings to B-bearings, so A-bearing = q* b
      const qi = [q[0], -q[1], -q[2], -q[3]];
      let e = 0,
        n = 0;
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i],
          a = qrot(qi, [p[2], p[3], p[4]]);
        if (a[2] < 0.05) continue;
        const th = Math.acos(Math.min(1, a[2])),
          r = Math.hypot(a[0], a[1]) || 1e-9,
          X = A.w / 2 + (f * th * a[0]) / r,
          Y = A.h / 2 + (f * th * a[1]) / r;
        if (X < 0 || Y < m0 || X > A.w - 1.01 || Y > m1) continue;
        const d = samp(A.d, A.w, A.h, X, Y) - B.d[p[1] * B.w + p[0]];
        e += d * d;
        n++;
      }
      return n > pts.length * 0.12 ? e / n : Infinity;
    };
    const qe = (r, p, y) => {
      let q = center;
      q = qmul4(q, axq([0, 0, 1], -r * D));
      q = qmul4(q, axq([1, 0, 0], p * D));
      q = qmul4(q, axq([0, 1, 0], y * D));
      return q;
    };
    let best = { c: cost(center), q: center };
    const grid = (R, P, Y, st) => {
      for (let r = -R; r <= R; r += st[0])
        for (let p = -P; p <= P; p += st[1])
          for (let y = -Y; y <= Y; y += st[2]) {
            const q = qe(r, p, y),
              c = cost(q);
            if (c < best.c) best = { c, q };
          }
    };
    grid(60, 36, 36, [6, 6, 6]);
    const c1 = best.q;
    const grid2 = (st, n) => {
      const base = best.q;
      for (let r = -n; r <= n; r++)
        for (let p = -n; p <= n; p++)
          for (let y = -n; y <= n; y++) {
            let q = qmul4(base, axq([0, 0, 1], -r * st * D));
            q = qmul4(q, axq([1, 0, 0], p * st * D));
            q = qmul4(q, axq([0, 1, 0], y * st * D));
            const c = cost(q);
            if (c < best.c) best = { c, q };
          }
    };
    grid2(2.5, 1);
    grid2(1.2, 1);
    void c1;
    return { q: best.q, cost: best.c, zero: cost([1, 0, 0, 0]), pred: cost(center) };
  };
  Tracker.prototype.fit = function (prev, P, G, im, guess) {
    // LK on all corners, each seeded by where 'guess' sends it
    const A = [],
      B = [];
    for (const p of prev.pts) {
      let gu = 0,
        gv = 0;
      if (guess) {
        const g = this.project(qrot(guess, this.bearing(p, im)), im);
        gu = g[0] - p[0];
        gv = g[1] - p[1];
        if (!isFinite(gu)) continue;
      }
      const q = lk(prev.P, P, prev.G, p[0], p[1], 5, 12, gu, gv);
      if (!q || q[0] < 2 || q[1] < 2 || q[0] > im.w - 3 || q[1] > im.h - 3) continue;
      const back = lk(P, prev.P, G, q[0], q[1], 5, 12, -(q[0] - p[0]), -(q[1] - p[1]));
      if (!back || Math.hypot(back[0] - p[0], back[1] - p[1]) > 1.2) continue; // forward-backward check
      A.push(this.bearing(p, im));
      B.push(this.bearing(q, im));
    }
    const f = im.w / 2 / (((this.hfov / 2) * Math.PI) / 180);
    return { fit: fitRotation(A, B, 1.5 / f, this.rnd), tracked: A.length };
  };
  // push a frame; returns null for the first frame, else { rpy: [roll, pitch, yaw] deg | null, inliers, tracked, how }
  Tracker.prototype.push = function (im) {
    const P = pyramid(im, this.levels),
      G = P.map(grad);
    if (this.prev) {
      // repeated frame (frame-rate conversion, 25 fps analog recorded at 30): skip it entirely
      const a = P[2].d,
        b = this.prev.P[2].d;
      let e = 0;
      for (let i = 0; i < a.length; i++) e += Math.abs(a[i] - b[i]);
      if (e / a.length < 0.8) return { dup: true };
    }
    const prev = this.prev;
    this.prev = { P, G, pts: corners(im, this.mask), im, tiny: P[Math.min(P.length - 1, 3)] };
    if (!prev) return null;
    const ok = r => r.fit && r.fit.inliers >= 12;
    let r = this.fit(prev, P, G, im, this.lastQ || null),
      how = 'track'; // 1. constant-rate prediction
    if (!ok(r) && this.lastQ) {
      r = this.fit(prev, P, G, im, null);
      how = 'track';
    } // 2. no motion assumed
    let q = ok(r) ? r.fit.q : null;
    if (!q) {
      // 3. coarse search, then refine
      const sr = this.search(prev.tiny, this.prev.tiny, this.lastQ || [1, 0, 0, 0]);
      const r2 = this.fit(prev, P, G, im, sr.q);
      if (ok(r2)) {
        q = r2.fit.q;
        r = r2;
        how = 'search+track';
      } else if (this.lastQ && !(sr.cost < sr.pred * 0.7)) {
        q = this.lastQ;
        how = 'coast';
      } // heavy blur: keep turning at the same rate
      else if (sr.cost < sr.zero * 0.6 && angleDeg(sr.q, this.lastQ || [1, 0, 0, 0]) < 35) {
        q = sr.q;
        how = 'search';
      } // blurred: coarse estimate near the motion
      else if (this.lastQ) {
        q = this.lastQ;
        how = 'coast';
      }
    }
    if (how === 'coast' && ++this.coast > 8) {
      q = null;
    }
    if (how !== 'coast') this.coast = 0;
    if (!q) {
      this.lastQ = null;
      this.coast = 0;
      return { rpy: null, inliers: 0, tracked: r.tracked, how: 'lost' };
    }
    this.lastQ = q;
    // camera rotation = inverse of the bearing map; axis-angle in camera axes (x right, y down, z forward)
    let [w, x, y, z] = q;
    if (w < 0) {
      w = -w;
      x = -x;
      y = -y;
      z = -z;
    }
    const sn = Math.hypot(x, y, z),
      ang = (2 * Math.atan2(sn, w) * 180) / Math.PI,
      k = sn > 1e-9 ? -ang / sn : 0; // inverse: negate
    const rv = [x * k, y * k, z * k],
      res = { rpy: [rv[2], -rv[0], -rv[1]], inliers: r.fit ? r.fit.inliers : 0, tracked: r.tracked, how, q };
    this.closeLoop(res);
    return res;
  };
  // Loop closure: a sharp frame before a fast/blurred burst is matched straight to the first sharp frame after it. That
  // gives the exact leftover angle; the chained per-frame estimates only have to get the number of whole turns right.
  Tracker.prototype.closeLoop = function (res) {
    const i = (this.n = (this.n || 0) + 1),
      sharp = res.how === 'track' && res.inliers >= 15,
      mag = Math.hypot(...res.rpy);
    this.hist = this.hist || [];
    this.hist[i] = res;
    this.corrections = this.corrections || [];
    if (sharp && mag < 8) {
      if (!this.burst) this.anchor = { i, tiny: this.prev.tiny };
      else this.endBurst(i);
      return;
    }
    if (!this.anchor) return;
    if (!this.burst && (mag >= 8 || !sharp)) this.burst = { from: this.anchor.i };
    if (this.burst && i - this.burst.from > 90) {
      this.burst = null;
      this.anchor = null;
    } // too long to close
  };
  Tracker.prototype.endBurst = function (i) {
    const b = this.burst;
    this.burst = null;
    const A = this.anchor;
    this.anchor = { i, tiny: this.prev.tiny };
    if (!A) return;
    const frames = [];
    for (let k = A.i + 1; k <= i; k++) frames.push(this.hist[k]);
    let Q = [1, 0, 0, 0],
      ax = [0, 0, 0];
    for (const f of frames) {
      Q = qmul4(Q, f.q);
      ax = ax.map((v, m) => v + f.rpy[m]);
    }
    const axN = Math.hypot(...ax);
    if (axN < 150) return; // nothing big enough to need closing
    const u = ax.map(v => v / axN),
      chain = frames.reduce((s, f) => s + f.rpy[0] * u[0] + f.rpy[1] * u[1] + f.rpy[2] * u[2], 0);
    const sr = this.search(A.tiny, this.prev.tiny, Q); // exact net rotation, near the chained one
    if (!(sr.cost < sr.zero * 0.8)) return;
    let [w, x, y, z] = sr.q;
    if (w < 0) {
      w = -w;
      x = -x;
      y = -y;
      z = -z;
    }
    const sn = Math.hypot(x, y, z),
      ang = (2 * Math.atan2(sn, w) * 180) / Math.PI,
      kk = sn > 1e-9 ? -ang / sn : 0,
      rv = [x * kk, y * kk, z * kk];
    const nrpy = [rv[2], -rv[0], -rv[1]],
      nmag = Math.hypot(...nrpy),
      net = nrpy[0] * u[0] + nrpy[1] * u[1] + nrpy[2] * u[2]; // net angle about the burst axis
    if (nmag > 40 && Math.abs(net) < 0.8 * nmag) return; // mixed-axis burst (flick + roll): one angle can't describe it
    const total = net + 360 * Math.round((chain - net) / 360);
    if (Math.abs(total - chain) > 170 || Math.abs(chain) < 1) return;
    const scale = total / chain;
    for (const f of frames) for (let m = 0; m < 3; m++) f.rpy[m] *= scale; // in place: callers may hold these arrays
    this.corrections.push({ from: A.i, to: i, chained: Math.round(chain), closed: Math.round(total) });
  };
  // ---------- camera rotation per frame -> body rates (deg/s) the detector understands
  // tilt: camera uptilt (deg). axisCleanup: give each frame's roll/yaw to whichever dominates (what worked on the demo
  // GIFs, where parallax smears roll into yaw); off = undo the uptilt mathematically (better for coordinated roll+yaw).
  function bodyRates(rpy, dtSec, tilt, axisCleanup) {
    const [rc, pc, yc] = rpy,
      a = (tilt * Math.PI) / 180,
      ca = Math.cos(a),
      sa = Math.sin(a);
    let roll, yaw;
    if (axisCleanup) {
      const m = Math.hypot(rc, yc);
      if (Math.abs(rc) >= Math.abs(yc)) {
        roll = Math.sign(rc) * m;
        yaw = 0;
      } else {
        yaw = Math.sign(yc) * m;
        roll = 0;
      }
    } else {
      roll = rc * ca - yc * sa;
      yaw = rc * sa + yc * ca;
    }
    return [roll / dtSec, pc / dtSec, yaw / dtSec];
  }
  // Run the detector over a measured clip. frames: [{ t, rpy|null }], marks: [{ t, kind: 'U'|'O', back }].
  function detectClip(S, frames, marks, opt = {}) {
    const world = { objs: [], prims: [], spawn: { pos: S.v3(0, 1, 0) } };
    const det = new S.TrickDetector(world);
    if (opt.camTilt != null) det.camTilt = opt.camTilt;
    det.watcherOn = false; // the live Watcher is for the sim only
    if (opt.pilot) det.setPilot(opt.pilot); // what the game has learned about this pilot applies to their real footage too
    const d = Object.create(S.Drone.prototype);
    Object.assign(d, {
      pos: S.v3(0, 6, 0),
      vel: S.v3(),
      q: { w: 1, x: 0, y: 0, z: 0 },
      w: S.v3(),
      armed: true,
      crashed: false,
      contactThisStep: false
    });
    const out = [],
      dt = 0.002,
      ms = [...(marks || [])].sort((a, b) => a.t - b.t);
    let mi = 0,
      side = 1;
    // fill short gaps (blur) linearly, leave long ones still
    const rates = frames.map(f => f.rpy);
    for (let i = 0; i < rates.length; i++)
      if (!rates[i]) {
        let j = i;
        while (j < rates.length && !rates[j]) j++;
        if (j - i <= (opt.maxGap || 4) && i > 0 && j < rates.length)
          for (let k = i; k < j; k++) {
            const u = (k - i + 1) / (j - i + 1);
            rates[k] = rates[i - 1].map((v, m) => v + (rates[j][m] - v) * u);
          }
        i = j;
      }
    const D = Math.PI / 180,
      t0 = frames.length ? frames[0].t : 0;
    const step = (w, until) => {
      while (det.time + t0 < until - 1e-9) {
        const tt = det.time + t0;
        while (mi < ms.length && ms[mi].t <= tt) {
          const mk = ms[mi++];
          side = -side;
          const up = d.up();
          det.crossLog.push({
            t: det.time,
            obj: 9001,
            name: opt.objectName || 'the obstacle',
            kind: mk.kind,
            dir: side,
            fwdDot: mk.back ? -1 : 1,
            latDot: mk.side ? 1 : 0,
            upY: up.y,
            spd: 4
          });
        }
        d.w = w;
        const an = Math.hypot(w.x, w.y, w.z) * dt;
        if (an > 0) d.q = S.qnorm(S.qmul(d.q, S.qaxis(S.mul(w, 1 / Math.hypot(w.x, w.y, w.z)), an)));
        det.update(d, dt, { thr: 0.5, roll: 0, pitch: 0, yaw: 0 });
        for (const e of det.drain())
          if (e.name !== 'near' && e.name !== 'Crash')
            out.push({
              name: e.name,
              exec: e.exec,
              clean: e.clean,
              draft: e.draft,
              t: det.time + t0,
              toks: (e.toks || []).map(k => ({ ax: k.ax, dir: k.dir, raw: Math.round(k.raw), t0: k.t0 + t0, t1: k.t1 + t0 }))
            });
      }
    };
    for (let i = 1; i < frames.length; i++) {
      const r = rates[i],
        span = frames[i].t - frames[i - 1].t;
      const br = r && span > 0 ? bodyRates(r, span, opt.camTilt ?? 20, opt.axisCleanup !== false) : [0, 0, 0];
      step(S.v3(br[1] * D, -br[2] * D, -br[0] * D), frames[i].t); // pilotRates = [-w.z, w.x, -w.y] = [roll, pitch, yaw]
    }
    step(S.v3(), (frames.length ? frames[frames.length - 1].t : 0) + 2.0);
    return out;
  }
  root.Vision = { fromRGBA, Tracker, bodyRates, detectClip, _test: { corners, lk, horn, fitRotation, pyramid, grad } };
})(typeof window !== 'undefined' ? window : globalThis);
