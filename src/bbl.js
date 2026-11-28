// Betaflight blackbox (.bbl / .bfl) decoder, in plain JS so the game can read a flash dump straight from the pilot's
// computer. Follows the format as written by Betaflight 4.x and read by betaflight/blackbox-log-viewer: header lines,
// then I (intra), P (inter), S (slow), E (event), G/H (GPS) frames with per-field predictors and variable-length
// encodings. Validated against the orangebox Python parser on a real 16 MB flash dump (test/bbl.js).
(function (root) {
  const ENC = { SIGNED_VB: 0, UNSIGNED_VB: 1, NEG_14BIT: 3, TAG8_8SVB: 6, TAG2_3S32: 7, TAG8_4S16: 8, NULL: 9, TAG2_3SVARIABLE: 10 };
  const PRED = {
    ZERO: 0,
    PREVIOUS: 1,
    STRAIGHT_LINE: 2,
    AVERAGE_2: 3,
    MINTHROTTLE: 4,
    MOTOR_0: 5,
    INC: 6,
    HOME_COORD: 7,
    P1500: 8,
    VBATREF: 9,
    LAST_MAIN_FRAME_TIME: 10,
    MINMOTOR: 11
  };
  const se = (v, bits) => {
    const s = 32 - bits;
    return (v << s) >> s;
  };
  const MARK = s => s.charCodeAt(0);
  const FRAME = new Set(['I', 'P', 'S', 'E', 'G', 'H'].map(MARK));

  class Stream {
    constructor(bytes, start, end) {
      this.b = bytes;
      this.p = start;
      this.end = end;
      this.eof = false;
    }
    byte() {
      if (this.p >= this.end) {
        this.eof = true;
        return 0;
      }
      return this.b[this.p++];
    }
    uvb() {
      let r = 0;
      for (let i = 0, sh = 0; i < 5; i++, sh += 7) {
        const c = this.byte();
        r = (r | ((c & 0x7f) << sh)) >>> 0;
        if (c < 128) return r;
      }
      this.bad = true;
      return 0;
    }
    svb() {
      const u = this.uvb();
      return (u >>> 1) ^ -(u & 1);
    }
    tag8_8svb(vals, n) {
      if (n === 1) {
        vals[0] = this.svb();
        return;
      }
      let h = this.byte();
      for (let i = 0; i < 8; i++, h >>= 1) vals[i] = h & 1 ? this.svb() : 0;
    }
    tag2_3s32(vals) {
      let lead = this.byte();
      switch (lead >> 6) {
        case 0:
          vals[0] = se((lead >> 4) & 3, 2);
          vals[1] = se((lead >> 2) & 3, 2);
          vals[2] = se(lead & 3, 2);
          break;
        case 1:
          vals[0] = se(lead & 0x0f, 4);
          lead = this.byte();
          vals[1] = se(lead >> 4, 4);
          vals[2] = se(lead & 0x0f, 4);
          break;
        case 2:
          vals[0] = se(lead & 0x3f, 6);
          lead = this.byte();
          vals[1] = se(lead & 0x3f, 6);
          lead = this.byte();
          vals[2] = se(lead & 0x3f, 6);
          break;
        case 3:
          for (let i = 0; i < 3; i++) {
            switch (lead & 3) {
              case 0:
                vals[i] = se(this.byte(), 8);
                break;
              case 1: {
                const a = this.byte(),
                  b = this.byte();
                vals[i] = se(a | (b << 8), 16);
                break;
              }
              case 2: {
                const a = this.byte(),
                  b = this.byte(),
                  c = this.byte();
                vals[i] = se(a | (b << 8) | (c << 16), 24);
                break;
              }
              case 3: {
                const a = this.byte(),
                  b = this.byte(),
                  c = this.byte(),
                  d = this.byte();
                vals[i] = a | (b << 8) | (c << 16) | (d << 24);
                break;
              }
            }
            lead >>= 2;
          }
          break;
      }
    }
    tag2_3svariable(vals) {
      // Betaflight 4.3+ (blackbox-log-viewer readTag2_3SVariable): 2-2-2, 5-5-4, 8-7-7 bit fields, else bytes
      const lead = this.byte();
      switch (lead >> 6) {
        case 0:
          vals[0] = se((lead >> 4) & 3, 2);
          vals[1] = se((lead >> 2) & 3, 2);
          vals[2] = se(lead & 3, 2);
          break;
        case 1: {
          vals[0] = se((lead & 0x3e) >> 1, 5);
          const b1 = this.byte();
          vals[1] = se(((lead & 1) << 4) | ((b1 & 0xf0) >> 4), 5);
          vals[2] = se(b1 & 0x0f, 4);
          break;
        }
        case 2: {
          const b1 = this.byte();
          vals[0] = se(((lead & 0x3f) << 2) | ((b1 & 0xc0) >> 6), 8);
          const b2 = this.byte();
          vals[1] = se(((b1 & 0x3f) << 1) | ((b2 & 0x80) >> 7), 7);
          vals[2] = se(b2 & 0x7f, 7);
          break;
        }
        case 3: {
          let l = lead;
          for (let i = 0; i < 3; i++) {
            switch (l & 3) {
              case 0:
                vals[i] = se(this.byte(), 8);
                break;
              case 1: {
                const a = this.byte(),
                  b = this.byte();
                vals[i] = se(a | (b << 8), 16);
                break;
              }
              case 2: {
                const a = this.byte(),
                  b = this.byte(),
                  c = this.byte();
                vals[i] = se(a | (b << 8) | (c << 16), 24);
                break;
              }
              case 3: {
                const a = this.byte(),
                  b = this.byte(),
                  c = this.byte(),
                  d = this.byte();
                vals[i] = a | (b << 8) | (c << 16) | (d << 24);
                break;
              }
            }
            l >>= 2;
          }
          break;
        }
      }
    }
    tag8_4s16(vals) {
      let sel = this.byte(),
        nib = 0,
        buf = 0;
      for (let i = 0; i < 4; i++, sel >>= 2) {
        switch (sel & 3) {
          case 0:
            vals[i] = 0;
            break;
          case 1:
            if (!nib) {
              buf = this.byte();
              vals[i] = se(buf >> 4, 4);
              nib = 1;
            } else {
              vals[i] = se(buf & 0x0f, 4);
              nib = 0;
            }
            break;
          case 2:
            if (!nib) vals[i] = se(this.byte(), 8);
            else {
              let c = (buf & 0x0f) << 4;
              buf = this.byte();
              c |= buf >> 4;
              vals[i] = se(c, 8);
            }
            break;
          case 3:
            if (!nib) {
              const a = this.byte(),
                b = this.byte();
              vals[i] = se((a << 8) | b, 16);
            } else {
              const a = this.byte(),
                b = this.byte();
              vals[i] = se(((buf & 0x0f) << 12) | (a << 4) | (b >> 4), 16);
              buf = b;
            }
            break;
        }
      }
    }
  }

  // split a flash dump into its logs (each starts with the product header line)
  const START = 'H Product:Blackbox flight data recorder by Nicholas Sherlock';
  function findLogs(bytes) {
    const sig = Array.from(START, c => c.charCodeAt(0)),
      out = [];
    for (let i = 0; i + sig.length < bytes.length; i++) {
      if (bytes[i] !== sig[0]) continue;
      let k = 1;
      while (k < sig.length && bytes[i + k] === sig[k]) k++;
      if (k === sig.length) {
        out.push(i);
        i += sig.length;
      }
    }
    return out.map((s, j) => ({ start: s, end: j + 1 < out.length ? out[j + 1] : bytes.length }));
  }
  function parseHeaders(bytes, start, end) {
    const H = {};
    let p = start;
    while (p < end && bytes[p] === 0x48 && bytes[p + 1] === 0x20) {
      // 'H '
      let q = p;
      while (q < end && bytes[q] !== 0x0a) q++;
      let line = '';
      for (let i = p + 2; i < q; i++) line += String.fromCharCode(bytes[i]);
      const c = line.indexOf(':');
      if (c > 0) H[line.slice(0, c)] = line.slice(c + 1);
      p = q + 1;
    }
    return { H, dataStart: p };
  }
  const nums = s => (s || '').split(',').map(x => parseInt(x, 10) || 0);
  function frameDefs(H) {
    const def = {};
    for (const t of ['I', 'P', 'S', 'G', 'H']) {
      const names = H[`Field ${t} name`];
      if (!names && t !== 'P') continue;
      const nm = (names || H['Field I name'] || '').split(',');
      def[t] = {
        names: nm,
        count: nm.length,
        signed: nums(H[`Field ${t} signed`] || H['Field I signed']),
        predictor: nums(H[`Field ${t} predictor`]),
        encoding: nums(H[`Field ${t} encoding`])
      };
    }
    return def;
  }

  // decode one log: returns { headers, fields (I names), frames: Int32Array rows (main frames, slow fields merged as last values), events }
  function decodeLog(bytes, L, opts = {}) {
    const { H, dataStart } = parseHeaders(bytes, L.start, L.end),
      D = frameDefs(H);
    if (!D.I) return { headers: H, fields: [], rows: [], events: [], error: 'no field definitions' };
    const sys = {
      minthrottle: parseInt(H.minthrottle || '1150', 10),
      vbatref: parseInt(H.vbatref || '4095', 10),
      motorOutput: nums(H.motorOutput || '0,2047'),
      dataVersion: parseInt(H['Data version'] || '2', 10)
    };
    const I = D.I,
      P = D.P,
      idx = n => I.names.indexOf(n),
      iTime = idx('time'),
      iMotor0 = idx('motor[0]');
    const s = new Stream(bytes, dataStart, L.end),
      vals = new Array(8).fill(0);
    let prev = null,
      prev2 = null,
      valid = false,
      lastTime = null;
    const rows = [],
      events = [];
    let corrupt = 0;
    const slowDef = D.S,
      slow = slowDef ? new Array(slowDef.count).fill(0) : [];
    const keep = opts.fields ? opts.fields.map(idx) : null;
    function readFrame(def, cur, previous, previous2, isI) {
      for (let i = 0; i < def.count; ) {
        const pr = def.predictor[i];
        if (pr === PRED.INC) {
          cur[i] = 1 + (previous ? previous[i] : 0);
          i++;
          continue;
        }
        const enc = def.encoding[i];
        const apply = (k, v) => {
          switch (def.predictor[k]) {
            case PRED.ZERO:
              break;
            case PRED.PREVIOUS:
              if (previous) v += previous[k];
              break;
            case PRED.STRAIGHT_LINE:
              if (previous) v += 2 * previous[k] - previous2[k];
              break;
            case PRED.AVERAGE_2:
              if (previous) v += ~~((previous[k] + previous2[k]) / 2);
              break;
            case PRED.MINTHROTTLE:
              v += sys.minthrottle;
              break;
            case PRED.MOTOR_0:
              v += cur[iMotor0];
              break;
            case PRED.P1500:
              v += 1500;
              break;
            case PRED.VBATREF:
              v += sys.vbatref;
              break;
            case PRED.LAST_MAIN_FRAME_TIME:
              if (prev) v += prev[iTime];
              break;
            case PRED.MINMOTOR:
              v += sys.motorOutput[0];
              break;
          }
          cur[k] = def.signed[k] ? v | 0 : v >>> 0;
        };
        if (enc === ENC.TAG8_4S16) {
          s.tag8_4s16(vals);
          for (let j = 0; j < 4 && i < def.count; j++, i++) apply(i, vals[j]);
          continue;
        }
        if (enc === ENC.TAG2_3S32) {
          s.tag2_3s32(vals);
          for (let j = 0; j < 3 && i < def.count; j++, i++) apply(i, vals[j]);
          continue;
        }
        if (enc === ENC.TAG2_3SVARIABLE) {
          s.tag2_3svariable(vals);
          for (let j = 0; j < 3 && i < def.count; j++, i++) apply(i, vals[j]);
          continue;
        }
        if (enc === ENC.TAG8_8SVB) {
          let j = i + 1;
          while (j < i + 8 && j < def.count && def.encoding[j] === ENC.TAG8_8SVB) j++;
          const n = j - i;
          s.tag8_8svb(vals, n);
          for (let k = 0; k < n; k++, i++) apply(i, vals[k]);
          continue;
        }
        let v = 0;
        if (enc === ENC.SIGNED_VB) v = s.svb();
        else if (enc === ENC.UNSIGNED_VB) v = s.uvb();
        else if (enc === ENC.NEG_14BIT) v = -se(s.uvb(), 14);
        else if (enc === ENC.NULL) v = 0;
        else {
          s.bad = true;
        }
        apply(i, v);
        i++;
      }
    }
    function readEvent() {
      const type = s.byte();
      const ev = { type };
      switch (type) {
        case 0:
          ev.time = s.uvb();
          break; // sync beep
        case 13: {
          const f = s.byte();
          ev.fn = f;
          ev.value = f > 127 ? s.uvb() : s.svb();
          break;
        } // in-flight adjustment
        case 14:
          ev.iteration = s.uvb();
          ev.time = s.uvb();
          break; // logging resumed
        case 15:
          ev.reason = s.uvb();
          break; // disarm
        case 30:
          ev.flags = s.uvb();
          ev.last = s.uvb();
          break; // flight mode
        case 255: {
          let str = '';
          for (let k = 0; k < 11; k++) str += String.fromCharCode(s.byte());
          ev.end = str;
          break;
        }
        default:
          ev.unknown = true;
      }
      return ev;
    }
    while (!s.eof && s.p < L.end) {
      const start = s.p,
        m = s.byte();
      s.bad = false;
      if (!FRAME.has(m)) {
        corrupt++;
        valid = false;
        continue;
      } // resync: skip until a frame marker
      const ch = String.fromCharCode(m);
      if (ch === 'E') {
        const ev = readEvent();
        if (ev.unknown) {
          valid = false;
          continue;
        }
        events.push(ev);
        if (ev.type === 255) break;
        if (ev.type === 14) valid = false;
        continue;
      }
      if (ch === 'S' && slowDef) {
        const cur = new Array(slowDef.count).fill(0);
        readFrame(slowDef, cur, null, null, true);
        if (!s.bad) for (let k = 0; k < cur.length; k++) slow[k] = cur[k];
        continue;
      }
      if ((ch === 'G' || ch === 'H') && D[ch]) {
        const cur = new Array(D[ch].count).fill(0);
        readFrame(D[ch], cur, null, null, true);
        continue;
      }
      if (ch === 'G' || ch === 'H') {
        valid = false;
        continue;
      }
      if (ch === 'P' && (!valid || !P)) {
        // can't decode a P frame without the frames before it: skip to the next marker
        continue;
      }
      const def = ch === 'I' ? I : P,
        cur = new Array(I.count).fill(0);
      readFrame(def, cur, ch === 'I' ? prev || null : prev, ch === 'I' ? prev || null : prev2, ch === 'I');
      if (ch === 'I') {
        /* intra frames carry absolute values: predictors PREVIOUS etc. don't appear */
      }
      // sanity: the next byte must start a frame, and time must move forward a little
      const nx = s.p < L.end ? bytes[s.p] : MARK('E');
      const t = cur[iTime],
        okTime = lastTime == null || (t > lastTime && t - lastTime < 2e6);
      if (s.bad || !FRAME.has(nx) || !okTime) {
        corrupt++;
        valid = false;
        s.p = start + 1;
        continue;
      }
      if (ch === 'I') {
        prev2 = cur;
        prev = cur;
        valid = true;
      } else {
        prev2 = prev;
        prev = cur;
      }
      lastTime = t;
      rows.push(keep ? keep.map(k => (k >= 0 ? cur[k] : 0)) : cur);
    }
    return { headers: H, fields: keep ? opts.fields : I.names, rows, events, corrupt, slowNames: slowDef ? slowDef.names : [], slow };
  }
  function decode(bytes, opts = {}) {
    const logs = findLogs(bytes);
    return logs.map((L, i) => {
      try {
        return { index: i + 1, ...decodeLog(bytes, L, opts) };
      } catch (e) {
        return { index: i + 1, error: String((e && e.message) || e), rows: [], fields: [] };
      }
    });
  }
  // the craft's rates from the header (ACTUAL or Betaflight rates) in the game's tune format
  function ratesFromHeaders(H) {
    // Betaflight rates_type: 0 BETAFLIGHT, 1 RACEFLIGHT, 2 KISS, 3 ACTUAL, 4 QUICK (QUICK ≈ ACTUAL with centre = rc_rate × 2)
    const rc = nums(H.rc_rates),
      ex = nums(H.rc_expo),
      sr = nums(H.rates),
      type = parseInt(H.rates_type ?? '0', 10);
    const ax = ['roll', 'pitch', 'yaw'],
      out = {},
      actual = type === 3 || type === 4;
    ax.forEach((a, i) => {
      out[a] = actual
        ? { center: type === 3 ? rc[i] * 10 : rc[i] * 2, max: sr[i] * 10, expo: ex[i] / 100 }
        : { rcRate: rc[i] / 100, superRate: sr[i] / 100, rcExpo: ex[i] / 100 };
    });
    return { type: actual ? 'ACTUAL' : 'BETAFLIGHT', rates: out };
  }
  root.BBL = { decode, findLogs, parseHeaders, decodeLog, ratesFromHeaders };
})(typeof window !== 'undefined' ? window : globalThis);
