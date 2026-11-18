
// ============================================================ Blackbox Replay: watch a real flight play out from its log
// (concatenated after game.js / raceedit.js into the same module). The .bbl is decoded in the browser (src/bbl.js), the
// attitude comes straight from the gyro, the sticks from rcCommand, and a plausible path from thrust (eRPM, or motor
// output) and gravity with drag — high-passed so it stays local (a log can't tell you where the room's walls were).
// The trick detector and the Watcher run on it (real sticks and throttle!), and the pilot confirms or corrects the
// calls like in Video Review: labelled real-world data, exported in the unified labelled-flight format.
const br = { file: null, logs: null, sel: -1, S: null, t: 0, playing: false, speed: 1, marks: [], dets: [], labels: [], hdr: null, msg: '', origin: { x: 0, y: 0, z: 2 } };
const BR_FIELDS = ['time', 'gyroADC[0]', 'gyroADC[1]', 'gyroADC[2]', 'rcCommand[0]', 'rcCommand[1]', 'rcCommand[2]', 'rcCommand[3]', 'motor[0]', 'motor[1]', 'motor[2]', 'motor[3]', 'eRPM[0]', 'eRPM[1]', 'eRPM[2]', 'eRPM[3]', 'vbatLatest', 'setpoint[0]', 'setpoint[1]', 'setpoint[2]'];
async function brOpenFile(file) {
  br.msg = 'Reading ' + file.name + '…'; brRender();
  const bytes = new Uint8Array(await file.arrayBuffer()); brOpenBytes(bytes, file.name);
}
function brOpenBytes(bytes, name) {
  br.file = name; br.msg = 'Decoding…'; brRender();
  setTimeout(() => {
    const t0 = performance.now(); let logs;
    try { logs = BBL.decode(bytes, { fields: BR_FIELDS }); } catch (e) { br.msg = 'Could not read that file: ' + e.message; brRender(); return; }
    br.logs = logs.filter(L => L.rows && L.rows.length > 200).map(L => ({ index: L.index, rows: L.rows, headers: L.headers, dur: (L.rows[L.rows.length - 1][0] - L.rows[0][0]) / 1e6, corrupt: L.corrupt }));
    br.msg = br.logs.length ? `${br.logs.length} flight${br.logs.length > 1 ? 's' : ''} in ${(performance.now() - t0).toFixed(0)} ms — pick one` : 'No flights found in that file.';
    if (br.logs.length) { const longest = br.logs.reduce((a, b) => b.dur > a.dur ? b : a); brSelect(br.logs.indexOf(longest)); }
    brRender();
  }, 20);
}
function brSelect(i) {
  const L = br.logs[i]; if (!L) return; br.sel = i; br.hdr = L.headers; br.marks = []; br.labels = []; br.t = 0; br.playing = false;
  br.S = brReconstruct(L); brDetect(); brRender(); brTimeline();
}
// gyro -> attitude; thrust -> path (auto-scaled so average thrust holds the quad up); sticks from rcCommand
function brReconstruct(L) {
  const R = L.rows, n = R.length, H = L.headers, D = Math.PI / 180, mo = (H.motorOutput || '158,2047').split(',').map(Number);
  const t = new Float64Array(n), q = new Float32Array(n * 4), w = new Float32Array(n * 3), p = new Float32Array(n * 3), v = new Float32Array(n * 3), st = new Float32Array(n * 4), mot = new Float32Array(n * 4);
  const hasRpm = R.some(r => r[12] > 0), mass = (params.stats.auw || 25) / 1000, g = 9.81;
  // thrust ∝ rpm² (or motor command²): find the scale that makes the average thrust equal the weight while armed
  const k2 = r => hasRpm ? r[12] * r[12] + r[13] * r[13] + r[14] * r[14] + r[15] * r[15] : [8, 9, 10, 11].reduce((a, j) => { const m = Math.max(0, (r[j] - mo[0]) / (mo[1] - mo[0])); return a + m * m; }, 0);
  let sum = 0, cnt = 0; for (const r of R) { const s2 = k2(r); if (s2 > 0) { sum += s2; cnt++; } } const K = cnt ? mass * g / (sum / cnt) : 0;
  let Q = { w: 1, x: 0, y: 0, z: 0 }, V = { x: 0, y: 0, z: 0 }, P = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < n; i++) {
    const r = R[i]; t[i] = (r[0] - R[0][0]) / 1e6; const dt = i ? Math.min(0.01, t[i] - t[i - 1]) : 0;
    // Betaflight gyro -> the sim's body rates: pilotRates = [roll, pitch, yaw] = [gyro0, -gyro1, -gyro2] = [-w.z, w.x, -w.y]
    const wx = -r[2] * D, wy = r[3] * D, wz = -r[1] * D, wm = Math.hypot(wx, wy, wz);
    if (dt > 0 && wm > 0) Q = S.qnorm(S.qmul(Q, S.qaxis({ x: wx / wm, y: wy / wm, z: wz / wm }, wm * dt)));
    const T = K * k2(r), up = S.qrot(Q, { x: 0, y: 1, z: 0 }), sp = Math.hypot(V.x, V.y, V.z), cd = 0.06;
    if (dt > 0) { V.x += (up.x * T / mass - cd * sp * V.x) * dt; V.y += (up.y * T / mass - g - cd * sp * V.y) * dt; V.z += (up.z * T / mass - cd * sp * V.z) * dt;
      P.x += V.x * dt; P.y += V.y * dt; P.z += V.z * dt; if (P.y < 0) { P.y = 0; if (V.y < 0) V.y = 0; V.x *= 0.98; V.z *= 0.98; } }
    q.set([Q.w, Q.x, Q.y, Q.z], i * 4); w.set([wx, wy, wz], i * 3); p.set([P.x, P.y, P.z], i * 3); v.set([V.x, V.y, V.z], i * 3);
    st.set([r[4] / 500, r[5] / 500, -r[6] / 500, Math.max(0, Math.min(1, (r[7] - 1000) / 1000))], i * 4);   // roll, pitch, yaw (BF yaw rcCommand is inverted), throttle
    for (let j = 0; j < 4; j++) mot[i * 4 + j] = Math.max(0, (r[8 + j] - mo[0]) / (mo[1] - mo[0]));
  }
  // keep it local: take out the slow drift (8 s low-pass) so loops and flips show where they happen, at a sensible height
  const hp = (k, tau, base) => { let lp = p[k]; const a = 1 - Math.exp(-1 / (tau * 1000)); for (let i = 0; i < n; i++) { lp += (p[i * 3 + k] - lp) * a; p[i * 3 + k] = p[i * 3 + k] - lp + base; } };
  hp(0, 8, 0); hp(2, 8, 0); hp(1, 6, 1.6); for (let i = 0; i < n; i++) if (p[i * 3 + 1] < 0.05) p[i * 3 + 1] = 0.05;
  return { n, t, q, w, p, v, st, mot, dur: t[n - 1], hasRpm, rates: BBL.ratesFromHeaders(H) };
}
function brIndex(T) { const t = br.S.t; let lo = 0, hi = br.S.n - 1; if (T <= 0) return 0; if (T >= t[hi]) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= T) lo = m; else hi = m; } return lo; }
// trick detection on the replay (open air + the pilot's U/O marks); the Watcher sees the real sticks and throttle
function brDetect() {
  const SS = br.S; if (!SS) return; const det = new S.TrickDetector({ objs: [], prims: [], spawn: { pos: S.v3(0, 1, 0) } }); det.camTilt = tune.camTilt;
  const d = Object.create(S.Drone.prototype); Object.assign(d, { pos: S.v3(0, 6, 0), vel: S.v3(), q: { w: 1, x: 0, y: 0, z: 0 }, w: S.v3(), armed: true, crashed: false, contactThisStep: false });
  const ms = [...br.marks].sort((a, b) => a.t - b.t); let mi = 0, side = 1; const out = [];
  for (let i = 1; i < SS.n; i += 2) {
    const dt = SS.t[i] - SS.t[i - 2 >= 0 ? i - 2 : 0]; if (!(dt > 0)) continue;
    while (mi < ms.length && ms[mi].t <= SS.t[i]) { const mk = ms[mi++]; side = -side; det.crossLog.push({ t: det.time, obj: 9001, name: 'the obstacle', kind: mk.kind, dir: side, fwdDot: mk.back ? -1 : 1, latDot: mk.side ? 1 : 0, upY: d.up().y, spd: 4 }); }
    d.q = { w: SS.q[i * 4], x: SS.q[i * 4 + 1], y: SS.q[i * 4 + 2], z: SS.q[i * 4 + 3] }; d.w = S.v3(SS.w[i * 3], SS.w[i * 3 + 1], SS.w[i * 3 + 2]);
    d.pos = S.v3(SS.p[i * 3], SS.p[i * 3 + 1] + 4, SS.p[i * 3 + 2]); d.vel = S.v3(SS.v[i * 3], SS.v[i * 3 + 1], SS.v[i * 3 + 2]);
    det.update(d, dt, { roll: SS.st[i * 4], pitch: SS.st[i * 4 + 1], yaw: SS.st[i * 4 + 2], thr: SS.st[i * 4 + 3] });
    for (const e of det.drain()) if (e.name !== 'near' && e.name !== 'Crash') { const toks = e.toks || []; out.push({ name: e.name, exec: e.exec, t: SS.t[i], t0: toks.length ? Math.min(...toks.map(k => SS.t[0] + (k.t0 - det.time) + SS.t[i])) : SS.t[i] - 0.8, watch: e.watch }); }
  }
  // token times are in detector time, which runs alongside the log: map them straight across
  br.dets = out.map(x => ({ ...x, t0: Math.max(0, Math.min(x.t, x.t0)) }));
}
function openBBReplay(bytes, name) {
  ghostOff(); if (race.on) raceOff(); train.on = false; renderTrain(); mode = 'bbreplay'; drone.armed = false; show(null); $('#hud').classList.add('hide'); $('#bbrUI').classList.remove('hide');
  camMode = 'chase'; document.body.classList.add('bbr'); resize(); brRender(); brTimeline(); if (bytes) brOpenBytes(bytes, name);
}
function closeBBReplay() { br.playing = false; $('#bbrUI').classList.add('hide'); document.body.classList.remove('bbr'); drone.reset(world.spawn); mode = 'menu'; show('#mainMenu'); }
function brStep(dt) {
  const SS = br.S; if (!SS) return;
  if (br.playing) { br.t += dt * br.speed; if (br.t >= SS.dur) { br.t = SS.dur; br.playing = false; brRender(); } }
  const i = brIndex(br.t), o = br.origin;
  drone.pos = S.v3(o.x + SS.p[i * 3], o.y + SS.p[i * 3 + 1], o.z + SS.p[i * 3 + 2]); drone.vel = S.v3(SS.v[i * 3], SS.v[i * 3 + 1], SS.v[i * 3 + 2]);
  drone.q = { w: SS.q[i * 4], x: SS.q[i * 4 + 1], y: SS.q[i * 4 + 2], z: SS.q[i * 4 + 3] }; for (let j = 0; j < 4; j++) drone.motorW[j] = SS.mot[i * 4 + j] > 0.05 ? 2600 : 0;
  const rc = { roll: SS.st[i * 4], pitch: SS.st[i * 4 + 1], yaw: SS.st[i * 4 + 2], thr: SS.st[i * 4 + 3] };
  const trail = []; for (let k = 20; k >= 1; k--) { const j = brIndex(br.t - k * 0.025); trail.push({ roll: SS.st[j * 4], pitch: SS.st[j * 4 + 1], yaw: SS.st[j * 4 + 2], thr: SS.st[j * 4 + 3] }); }
  drawSticks($('#bbrSticks'), rc, trail, { label: `THR ${Math.round(rc.thr * 100)}%`, label2: 'P/R (real sticks)' });
  const now = br.dets.filter(d => br.t >= d.t0 - 0.1 && br.t <= d.t + 0.6);
  $('#bbrNow').innerHTML = now.map(d => `${d.name}<small>${d.exec}${d.watch ? ` · watcher ${Math.round(d.watch.conf * 100)}%` : ''}</small>`).join('');
  brTimeline(); $('#bbrTime').textContent = `${fmtT(br.t)} / ${fmtT(SS.dur)}`;
}
function brTimeline() {
  const c = $('#bbrTimeline'); if (!c) return; const W = c.clientWidth || 800; if (c.width !== W) c.width = W; const H = c.height, g = c.getContext('2d'); g.fillStyle = '#0e0d0c'; g.fillRect(0, 0, W, H);
  const SS = br.S; if (!SS) { g.fillStyle = '#888'; g.font = '12px monospace'; g.fillText('load a Blackbox log', 10, 20); return; }
  const x = t => t / SS.dur * W, mid = 55, sc = 45 / 1000;
  for (let k = 0; k < 3; k++) { g.strokeStyle = RV_COL[k]; g.beginPath(); const step = Math.max(1, Math.floor(SS.n / W / 2));
    for (let i = 0; i < SS.n; i += step) { const r = k === 0 ? -SS.w[i * 3 + 2] : k === 1 ? SS.w[i * 3] : -SS.w[i * 3 + 1], y = mid - Math.max(-50, Math.min(50, r * 57.3 * sc)); i ? g.lineTo(x(SS.t[i]), y) : g.moveTo(x(SS.t[i]), y); } g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); for (let i = 0; i < SS.n; i += Math.max(1, Math.floor(SS.n / W))) { const y = 108 - SS.st[i * 4 + 3] * 20; i ? g.lineTo(x(SS.t[i]), y) : g.moveTo(x(SS.t[i]), y); } g.stroke();
  g.font = '10px monospace'; ['roll', 'pitch', 'yaw'].forEach((n, k) => { g.fillStyle = RV_COL[k]; g.fillText(n, 6 + k * 40, 12); }); g.fillStyle = '#aaa'; g.fillText('throttle', 130, 12);
  br.dets.forEach(d => { const l = brLabelFor(d); g.fillStyle = l ? (l.verdict === 'yes' ? 'rgba(125,255,154,.35)' : 'rgba(255,90,90,.35)') : 'rgba(255,210,63,.3)'; g.fillRect(x(d.t0), 114, Math.max(3, x(d.t) - x(d.t0)), 16); g.fillStyle = '#fff'; g.fillText(d.name, x(d.t0) + 2, 126); });
  br.labels.filter(l => l.verdict === 'added').forEach(l => { g.fillStyle = 'rgba(90,184,255,.4)'; g.fillRect(x(l.t0), 132, Math.max(3, x(l.t1) - x(l.t0)), 14); g.fillStyle = '#fff'; g.fillText(l.actual, x(l.t0) + 2, 143); });
  br.marks.forEach(m => { g.fillStyle = m.kind === 'U' ? '#ffd23f' : '#ff9ad7'; g.fillRect(x(m.t) - 1, 16, 2, 96); g.fillText(m.kind + (m.back ? '←' : '') + (m.side ? '↔' : ''), x(m.t) + 3, 24); });
  g.fillStyle = '#fff'; g.fillRect(x(br.t) - 1, 0, 2, H);
}
const brLabelFor = d => br.labels.find(l => l.det && Math.abs(l.det.t - d.t) < 0.05 && l.det.name === d.name);
function brRender() {
  const el = $('#bbrSide'); if (!el) return; const names = abcSort(ALL_TRICKS().map(x => nameOf(x))), SS = br.S;
  const logs = (br.logs || []).map((L, i) => `<option value="${i}" ${i === br.sel ? 'selected' : ''}>flight ${L.index} · ${L.dur.toFixed(1)} s${L.corrupt ? ' · ' + L.corrupt + ' bad frames skipped' : ''}</option>`).join('');
  const items = br.dets.map((d, i) => { const l = brLabelFor(d), cls = l ? (l.verdict === 'yes' ? 'ok' : 'bad') : '';
    return `<div class="rvItem ${cls}"><span class="t">${fmtT(d.t0)}–${fmtT(d.t)}</span><b>${d.name}</b> <small>${d.exec}${d.watch ? ' · watcher ' + Math.round(d.watch.conf * 100) + '%' : ''}</small>
      <div class="row"><button data-br="go" data-i="${i}">▶</button><button data-br="yes" data-i="${i}">✓ Yes</button><button data-br="no" data-i="${i}">✗ No</button>
      ${l && l.verdict === 'no' ? `<select data-brfix="${i}"><option value="">it was actually…</option><option ${l.actual === 'not a trick' ? 'selected' : ''}>not a trick</option>${names.map(n => `<option ${l.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}</div></div>`; }).join('');
  const added = br.labels.map((l, k) => l.verdict === 'added' ? `<div class="rvItem pilot"><span class="t">${fmtT(l.t0)}–${fmtT(l.t1)}</span><b>${l.actual}</b> <small>added by you</small> <button data-br="del" data-k="${k}">✕</button></div>` : '').join('');
  const rates = SS && SS.rates ? Object.entries(SS.rates.rates).map(([a, r]) => r.center != null ? `${a} ${r.center}/${r.max}/${r.expo}` : `${a} rc ${r.rcRate} sr ${r.superRate}`).join(' · ') : '';
  el.innerHTML = `<h3>BLACKBOX REPLAY</h3>
    <div class="row"><label class="rvPick">${br.file ? 'load another log' : 'load a .bbl / .bfl log'}<input id="bbrFile" type="file" accept=".bbl,.bfl,.bbs,.txt" hidden></label></div>
    ${br.msg ? `<p class="note">${esc(br.msg)}</p>` : ''}
    ${logs ? `<div class="row"><select id="bbrLog">${logs}</select></div>` : ''}
    ${SS ? `<p class="note">${br.hdr && br.hdr['Firmware revision'] ? esc(br.hdr['Firmware revision']) + ' · ' : ''}${SS.hasRpm ? 'path from eRPM thrust' : 'path from motor output'} · rates: ${rates}</p>
    <div class="row"><button data-br="play">${br.playing ? '❚❚ Pause' : '▶ Play'}</button><select id="bbrSpeed">${[0.1, 0.25, 0.5, 1, 2].map(s => `<option ${s === br.speed ? 'selected' : ''}>${s}</option>`).join('')}</select>× <span id="bbrTime"></span></div>
    <p class="note">Tricks the detector found: <b>${br.dets.length}</b> · ✓${br.labels.filter(l => l.verdict === 'yes').length} ✗${br.labels.filter(l => l.verdict === 'no').length} +${br.labels.filter(l => l.verdict === 'added').length} · marks ${br.marks.length}. Mark passes with <kbd>U</kbd>/<kbd>O</kbd> (Shift = backward, hold L = sideways) to unlock obstacle tricks.</p>
    ${items}${added}
    <div class="row"><select id="bbrAdd"><option value="">＋ add a trick at the playhead…</option>${names.map(n => `<option>${n}</option>`).join('')}</select></div>
    <div class="row"><button data-br="export" class="ghost">Export labels</button><button data-br="upload" class="ghost">↑ Upload</button><button data-br="tune" class="ghost" title="Use this craft's rates in the sim">Use these rates</button></div>` : ''}
    <div class="row"><button data-br="close" class="ghost">Menu</button></div>
    <p class="note">The attitude is exact (gyro). The path is a plausible reconstruction from thrust — a log can't say where the walls were. <kbd>C</kbd> camera · <kbd>Space</kbd> play · <kbd>←</kbd><kbd>→</kbd> 1 s · <kbd>,</kbd><kbd>.</kbd> step.</p>`;
}
function brPayload() {
  const SS = br.S; if (!SS) return null; const L = br.logs[br.sel], step = Math.max(1, Math.round(SS.n / (SS.dur * 250)));   // 250 Hz
  const samples = []; for (let i = 0; i < SS.n; i += step) samples.push([+SS.t[i].toFixed(4), ...[0, 1, 2].map(k => Math.round([-SS.w[i * 3 + 2], SS.w[i * 3], -SS.w[i * 3 + 1]][k] * 57.2958)), ...[0, 1, 2, 3].map(k => +SS.st[i * 4 + k].toFixed(3))]);
  return { format: 'pro-whooper-labelled/1', source: 'blackbox-replay', trust: 'pilot-labelled real flight (gyro + sticks exact, path reconstructed)', build: '0.1', file: br.file, flight: L.index,
    firmware: br.hdr['Firmware revision'] || null, craft: { ...spec }, camTilt: tune.camTilt, rates: SS.rates, hz: 250, cols: ['t', 'roll', 'pitch', 'yaw', 'rollStick', 'pitchStick', 'yawStick', 'thr'], samples,
    marks: br.marks, detected: br.dets.map(d => ({ name: d.name, exec: d.exec, t0: +d.t0.toFixed(3), t1: +d.t.toFixed(3), watch: d.watch || null })),
    labels: br.labels.map(l => ({ verdict: l.verdict, detected: l.det ? l.det.name : null, actual: l.actual || (l.verdict === 'yes' && l.det ? l.det.name : null), t0: +l.t0.toFixed(3), t1: +l.t1.toFixed(3) })) };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-br]'); if (b && mode === 'bbreplay') { const a = b.dataset.br, i = +b.dataset.i;
    if (a === 'play') { if (br.S && br.t >= br.S.dur) br.t = 0; br.playing = !br.playing; } if (a === 'close') { closeBBReplay(); return; }
    if (a === 'go') { br.t = Math.max(0, br.dets[i].t0 - 0.8); br.playing = true; }
    if (a === 'yes' || a === 'no') { const d = br.dets[i], l = brLabelFor(d); if (l) Object.assign(l, { verdict: a, actual: a === 'yes' ? d.name : l.actual }); else br.labels.push({ verdict: a, det: d, actual: a === 'yes' ? d.name : null, t0: d.t0, t1: d.t }); }
    if (a === 'del') br.labels.splice(+b.dataset.k, 1);
    if (a === 'export') { const pl = brPayload(); if (pl) saveFile(`blackbox-replay-${slug(br.file || 'log')}-${pl.flight}.json`, JSON.stringify(pl)); }
    if (a === 'upload') { const pl = brPayload(); if (pl && !ghEnqueue(`labelled/blackbox/${new Date().toISOString().replace(/[:.]/g, '-')}-${slug(br.file || 'log')}-${pl.flight}.json`, pl, `blackbox replay labels: ${pl.labels.length}`)) { openOptions(); } }
    if (a === 'tune' && br.S && br.S.rates) { tune.ratesType = br.S.rates.type; for (const ax of ['roll', 'pitch', 'yaw']) Object.assign(tune.rates[ax], br.S.rates.rates[ax]); saveTune(); br.msg = 'Using this craft\'s rates in the sim ✓'; }
    brRender(); brTimeline(); return; }
  if (e.target.id === 'bbrTimeline' && br.S) { const r = e.target.getBoundingClientRect(); br.t = (e.clientX - r.left) / r.width * br.S.dur; }
  if (e.target.closest('[data-act="bbreplay"]')) openBBReplay();
  if (e.target.id === 'bbReplayBtn') { const f = bb.files.find(x => /\.(bbl|bfl|bbs)$/i.test(x.name)); if (bb.log) openBBReplay(bb.log, 'downloaded flash'); else if (f) { openBBReplay(); brOpenFile(f); } }
});
document.addEventListener('change', e => {
  if (mode !== 'bbreplay') return;
  if (e.target.id === 'bbrFile' && e.target.files[0]) brOpenFile(e.target.files[0]);
  if (e.target.id === 'bbrLog') brSelect(+e.target.value);
  if (e.target.id === 'bbrSpeed') br.speed = +e.target.value;
  if (e.target.dataset.brfix) { const d = br.dets[+e.target.dataset.brfix], l = brLabelFor(d); if (l) l.actual = e.target.value || null; brRender(); }
  if (e.target.id === 'bbrAdd' && e.target.value) { br.labels.push({ verdict: 'added', det: null, actual: e.target.value, t0: Math.max(0, br.t - 1.2), t1: br.t }); brRender(); brTimeline(); }
});
addEventListener('keydown', e => {
  if (mode !== 'bbreplay' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; const SS = br.S;
  if (e.code === 'Escape') { closeBBReplay(); return; } if (!SS) return;
  if (e.code === 'Space') { e.preventDefault(); if (br.t >= SS.dur) br.t = 0; br.playing = !br.playing; brRender(); }
  if (e.code === 'ArrowLeft') br.t = Math.max(0, br.t - 1); if (e.code === 'ArrowRight') br.t = Math.min(SS.dur, br.t + 1);
  if (e.code === 'Comma') { br.playing = false; br.t = Math.max(0, br.t - 0.01); } if (e.code === 'Period') { br.playing = false; br.t = Math.min(SS.dur, br.t + 0.01); }
  if (e.code === 'KeyC') camMode = camMode === 'fpv' ? 'chase' : 'fpv';
  if (e.code === 'KeyU' || e.code === 'KeyO') { br.marks.push({ t: br.t, kind: e.code === 'KeyU' ? 'U' : 'O', back: e.shiftKey, side: !!keys.KeyL }); brDetect(); brRender(); }
  if (e.code === 'KeyX') { let k = -1, best = 0.6; br.marks.forEach((m, i) => { const d = Math.abs(m.t - br.t); if (d < best) { best = d; k = i; } }); if (k >= 0) { br.marks.splice(k, 1); brDetect(); brRender(); } }
});
window.__pw.bbreplay = { open: (bytes, name) => openBBReplay(bytes, name), get state() { return br; } };
