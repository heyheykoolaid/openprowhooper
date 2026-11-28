// Flight telemetry packing (format pro-whooper-flight/1). Pure JS: runs in the browser and in Node (tools/flights.js,
// test/flightlog.js). A run is the game's 100 Hz trace (TRACE_COLS). Raw JSON is ~3 MB for three minutes, so the trace
// is stored column by column as scaled integers, delta coded (second differences for position and attitude, which
// move smoothly), zigzag varints, then deflate and base64: roughly 60-80 KB a minute.
(function (root) {
  // integer scale per column; anything not listed is stored as a whole number
  const SCALE = {
    t: 1e3,
    x: 1e4,
    y: 1e4,
    z: 1e4,
    qw: 1e4,
    qx: 1e4,
    qy: 1e4,
    qz: 1e4,
    thr: 1e3,
    cnx: 1e3,
    cny: 1e3,
    cnz: 1e3,
    cImpact: 1e2,
    vx: 1e2,
    vy: 1e2,
    vz: 1e2,
    rollStick: 1e3,
    pitchStick: 1e3,
    yawStick: 1e3
  };
  const ORDER2 = new Set(['x', 'y', 'z', 'qw', 'qx', 'qy', 'qz']);
  const ENC = 'cols-delta-varint/1';

  function encode(rows, cols) {
    const out = [];
    const n = rows.length;
    for (let c = 0; c < cols.length; c++) {
      const s = SCALE[cols[c]] || 1,
        o2 = ORDER2.has(cols[c]);
      let p1 = 0,
        p2 = 0;
      for (let i = 0; i < n; i++) {
        const v = Math.round((rows[i][c] || 0) * s);
        let d = o2 ? v - 2 * p1 + p2 : v - p1;
        p2 = p1;
        p1 = v;
        // zigzag, then base-128 varint (values stay far inside 2^31 at these scales, but use arithmetic to be safe)
        let z = d < 0 ? -2 * d - 1 : 2 * d;
        while (z >= 128) {
          out.push(z % 128 | 128);
          z = Math.floor(z / 128);
        }
        out.push(z);
      }
    }
    return Uint8Array.from(out);
  }
  function decode(bytes, cols, n) {
    const rows = Array.from({ length: n }, () => new Array(cols.length));
    let k = 0;
    for (let c = 0; c < cols.length; c++) {
      const s = SCALE[cols[c]] || 1,
        o2 = ORDER2.has(cols[c]);
      let p1 = 0,
        p2 = 0;
      for (let i = 0; i < n; i++) {
        let z = 0,
          m = 1,
          b;
        do {
          if (k >= bytes.length) throw new Error('flight trace is cut short');
          b = bytes[k++];
          z += (b & 127) * m;
          m *= 128;
        } while (b & 128);
        const d = z % 2 ? -(z + 1) / 2 : z / 2,
          v = o2 ? d + 2 * p1 - p2 : d + p1;
        p2 = p1;
        p1 = v;
        rows[i][c] = s === 1 ? v : v / s;
      }
    }
    return rows;
  }
  const b64 = bytes => {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const unb64 = str => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const bin = atob(str),
      a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  };
  async function pipe(bytes, stream) {
    const w = stream.writable.getWriter();
    w.write(bytes);
    w.close();
    const parts = [];
    const r = stream.readable.getReader();
    let len = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      parts.push(value);
      len += value.length;
    }
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
  // -> { enc, hz, cols, rows, data } ; deflate when the platform has it (every current browser, Node 18+)
  async function pack(rows, cols, hz) {
    const raw = encode(rows, cols);
    let data = raw,
      enc = ENC;
    if (typeof CompressionStream !== 'undefined') {
      try {
        data = await pipe(raw, new CompressionStream('deflate-raw'));
        enc = ENC + '+deflate';
      } catch {
        data = raw;
        enc = ENC;
      }
    }
    return { enc, hz, cols, rows: rows.length, data: b64(data) };
  }
  async function unpack(tr) {
    if (!tr || typeof tr.data !== 'string' || !tr.enc || tr.enc.split('+')[0] !== ENC) throw new Error('unknown flight trace encoding');
    let bytes = unb64(tr.data);
    if (tr.enc.endsWith('+deflate')) bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return decode(bytes, tr.cols, tr.rows);
  }
  // small numbers about a run that are useful without unpacking the trace
  function summary(rows, cols, hz) {
    const ix = k => cols.indexOf(k),
      A = ix('armed'),
      C = ix('crashed'),
      R = [ix('rollRate'), ix('pitchRate'), ix('yawRate')],
      V = [ix('vx'), ix('vy'), ix('vz')];
    let armed = 0,
      crashes = 0,
      was = 0,
      vmax = 0;
    const peak = [0, 0, 0];
    for (const r of rows) {
      if (r[A]) armed++;
      if (r[C] && !was) crashes++;
      was = r[C];
      for (let i = 0; i < 3; i++) peak[i] = Math.max(peak[i], Math.abs(r[R[i]] || 0));
      if (V[0] >= 0) vmax = Math.max(vmax, Math.hypot(r[V[0]] || 0, r[V[1]] || 0, r[V[2]] || 0));
    }
    return {
      seconds: +(rows.length / hz).toFixed(1),
      armedSeconds: +(armed / hz).toFixed(1),
      crashes,
      peakRates: peak,
      topSpeed: +vmax.toFixed(2)
    };
  }
  root.FlightLog = { ENC, SCALE, encode, decode, pack, unpack, summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FlightLog;
})(typeof window !== 'undefined' ? window : globalThis);
