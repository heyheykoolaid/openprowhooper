// ============================================================ Video Review (dev)
// Load an FPV clip; src/vision.js measures the camera rotation frame by frame (in the browser — the video never leaves
// the computer); the detector proposes tricks; the pilot marks obstacle passes (U/O) and confirms, corrects or adds
// tricks. Export / upload (opt-in) carries only the measured motion, marks and labels — format pro-whooper-video/1.
const rv = { file: null, url: null, frames: [], marks: [], dets: [], labels: [], busy: false, cancel: false, prog: 0, hfov: 130, tilt: null, rate: 30, cleanup: true, sel: -1 };
const RV_COL = ['#ff5a5a', '#7dff9a', '#5ab8ff'];
function openReview() { mode = 'review'; drone.armed = false; show('#reviewScreen'); $('#hud').classList.add('hide'); if (rv.tilt == null) rv.tilt = tune.camTilt; renderReview(); drawTimeline(); }
// every video's work so far (measured motion, marks, labels, where measuring stopped) is kept while the page is open,
// so loading another video and coming back carries on where you left off
const rvKept = {};
const rvKey = f => f ? `${f.name}|${f.size}` : '';
function rvLoad(file) {
  if (!file) return; if (rv.url) URL.revokeObjectURL(rv.url);
  if (rv.file && (rv.frames.length || rv.labels.length || rv.marks.length)) rvKept[rvKey(rv.file)] = { frames: rv.frames, marks: rv.marks, dets: rv.dets, labels: rv.labels, prog: rv.prog, resumeT: rv.resumeT, tr: rv.tr, hfov: rv.hfov, rate: rv.rate };
  if (rv.busy) rv.cancel = true;
  const kept = rvKept[rvKey(file)];
  Object.assign(rv, { file, url: URL.createObjectURL(file), frames: [], marks: [], dets: [], labels: [], prog: 0, sel: -1, resumeT: null, tr: null, att: null }, kept || {});
  const v = $('#rvVideo'); v.src = rv.url; v.load(); $('#rvDrop').classList.add('hide');
  v.onloadedmetadata = () => { rvAttitude(); renderReview(); drawTimeline(); if (kept) flashNow('picked up where you left off'); };
  v.onerror = () => { $('#rvDrop').classList.remove('hide'); $('#rvDrop').firstChild.textContent = "This browser can't play that file (try an .mp4 in Chrome/Edge). "; };
}
// measuring: Stop keeps everything measured so far (and the tracker), Resume carries on from there; Re-measure starts over
async function rvAnalyze(resume) {
  const v = $('#rvVideo'); if (!v.duration || rv.busy) return;
  resume = !!(resume && rv.tr && rv.resumeT != null && rv.frames.length);
  rv.busy = true; rv.cancel = false; if (!resume) { rv.frames = []; rv.prog = 0; } renderReview();
  const W = 240, H = Math.round(W * v.videoHeight / v.videoWidth), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
  const tr = resume ? rv.tr : new Vision.Tracker({ hfov: rv.hfov }), dt = 1 / rv.rate, wasPaused = v.paused; v.pause(); rv.tr = tr;
  const seek = t => new Promise(res => { const done = () => { v.removeEventListener('seeked', done); res(); }; v.addEventListener('seeked', done); v.currentTime = t; });
  const out = resume ? rv.frames.map(f => ({ t: f.t, res: { rpy: f.rpy, how: f.how } })) : [];
  let tStart = 0;
  if (resume) { await seek(rv.resumeT); g.drawImage(v, 0, 0, W, H); tr.push(Vision.fromRGBA(g.getImageData(0, 0, W, H).data, W, H)); tStart = rv.resumeT + dt; }   // re-prime the tracker on the last measured frame
  for (let t = tStart; t < v.duration - 1e-3 && !rv.cancel; t += dt) {
    rv.resumeT = t;
    await seek(t); g.drawImage(v, 0, 0, W, H); const r = tr.push(Vision.fromRGBA(g.getImageData(0, 0, W, H).data, W, H));
    if (r && r.dup) continue;                                            // repeated frame: no new information
    out.push(r ? { t, res: r } : { t, res: null });
    rv.prog = t / v.duration; if (out.length % 15 === 0) { rv.frames = out.map(f => ({ t: f.t, rpy: f.res ? f.res.rpy : [0, 0, 0] })); renderReview(); drawTimeline(); await new Promise(r => setTimeout(r, 0)); }
  }
  rv.frames = out.map(f => ({ t: f.t, rpy: f.res ? f.res.rpy : [0, 0, 0], how: f.res ? f.res.how : 'first' }));   // loop closures already applied in place
  const stopped = rv.cancel; rv.busy = false; rv.prog = stopped ? rv.prog : 1; if (!stopped) rv.resumeT = null; rvAttitude(); rvDetect(); if (!wasPaused) v.play();
  if (stopped) flashNow(`stopped at ${fmtT(rv.resumeT || 0)} — data kept, Resume carries on`);
}
function rvDetect() {
  if (!rv.frames.length) { rv.dets = []; return; }
  rv.dets = Vision.detectClip(S, rv.frames, rv.marks, { camTilt: rv.tilt, axisCleanup: rv.cleanup, objectName: 'the obstacle' })
    .map(e => ({ ...e, t0: e.toks.length ? Math.min(...e.toks.map(k => k.t0)) : e.t - 0.8, t1: e.toks.length ? Math.max(...e.toks.map(k => k.t1)) : e.t }));
  renderReview(); drawTimeline();
}
const rvLabelFor = d => rv.labels.find(l => l.det && Math.abs(l.det.t - d.t) < 0.05 && l.det.name === d.name);
function rvJudge(i, verdict, actual) {
  const d = rv.dets[i]; if (!d) return; rv.labels = rv.labels.filter(l => !(l.det && Math.abs(l.det.t - d.t) < 0.05 && l.det.name === d.name));
  rv.labels.push({ verdict, det: { name: d.name, t: d.t, t0: d.t0, t1: d.t1, exec: d.exec }, actual: verdict === 'yes' ? d.name : (actual || null), t0: d.t0, t1: d.t1 });
  renderReview(); drawTimeline();
}
function rvAdd(name) { const t = $('#rvVideo').currentTime; rv.labels.push({ verdict: 'added', det: null, actual: name, t0: Math.max(0, t - 1.2), t1: t }); renderReview(); drawTimeline(); }
function rvMark(kind, back, side) { const v = $('#rvVideo'); if (!v.duration) return; rv.marks.push({ t: v.currentTime, kind, back: !!back, side: !!side }); rv.marks.sort((a, b) => a.t - b.t); flashNow(`${kind === 'U' ? 'under' : 'over'}${back ? ' (backward)' : ''}${side ? ' (sideways)' : ''}`); rvDetect(); }
function rvUnmark() { const t = $('#rvVideo').currentTime; let k = -1, best = 0.6; rv.marks.forEach((m, i) => { const d = Math.abs(m.t - t); if (d < best) { best = d; k = i; } }); if (k >= 0) { rv.marks.splice(k, 1); rvDetect(); } }
function flashNow(text) { const el = $('#rvNow'); el.dataset.flash = text; el.dataset.until = performance.now() + 900; }
function rvPayload() {
  const v = $('#rvVideo');
  return { format: 'pro-whooper-video/1', build: '0.1', file: rv.file ? rv.file.name : null, duration: v.duration || null, video: { w: v.videoWidth, h: v.videoHeight },
    analysis: { hfov: rv.hfov, camTilt: rv.tilt, rate: rv.rate, axisCleanup: rv.cleanup, axes: '[roll, pitch, yaw] camera rotation in degrees per sample' },
    frames: rv.frames.map(f => [+f.t.toFixed(3), ...f.rpy.map(x => +x.toFixed(2))]), marks: rv.marks,
    detected: rv.dets.map(d => ({ name: d.name, exec: d.exec, t0: +d.t0.toFixed(2), t: +d.t.toFixed(2), draft: !!d.draft })), labels: rv.labels };
}
async function rvExport() { const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); await saveFile(`video-review-${stamp}.json`, JSON.stringify(rvPayload())); }
function rvUpload() { const stamp = new Date().toISOString().replace(/[:.]/g, '-'); const ok = ghEnqueue(`calibration/video/${stamp}.json`, rvPayload(), `video review: ${rv.labels.length} labels`); flash(ok ? '<b>UPLOADING</b><small>motion + labels only — not the video</small>' : '<b>UPLOAD IS OFF</b><small>turn it on in Options</small>', ok ? '' : 'warn'); }
function renderReview() {
  const el = $('#rvSide'); if (!el) return; const v = $('#rvVideo'), has = !!v.duration;
  const names = ALL_TRICKS().map(x => nameOf(x));
  const items = rv.dets.map((d, i) => { const l = rvLabelFor(d), cls = l ? (l.verdict === 'yes' ? 'ok' : 'bad') : '';
    return `<div class="rvItem ${cls}" data-i="${i}"><span class="t">${fmtT(d.t0)}–${fmtT(d.t)}</span><b>${d.name}</b> <small>${d.exec}${d.draft ? ' · draft' : ''}</small>
      <div class="row"><button data-rv="go" data-i="${i}">▶</button><button data-rv="yes" data-i="${i}">✓ Yes</button><button data-rv="no" data-i="${i}">✗ No</button>
      ${l && l.verdict === 'no' ? `<select data-rvfix="${i}"><option value="">it was actually…</option><option ${l.actual === 'not a trick' ? 'selected' : ''}>not a trick</option>${names.map(n => `<option ${l.actual === n ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}</div></div>`; }).join('');
  const added = rv.labels.map((l, k) => l.verdict === 'added' ? `<div class="rvItem pilot"><span class="t">${fmtT(l.t0)}–${fmtT(l.t1)}</span><b>${l.actual}</b> <small>added by you</small> <button data-rv="del" data-k="${k}">✕</button></div>` : '').join('');
  const nYes = rv.labels.filter(l => l.verdict === 'yes').length, nNo = rv.labels.filter(l => l.verdict === 'no').length, nAdd = rv.labels.filter(l => l.verdict === 'added').length;
  el.innerHTML = `<h3>VIDEO REVIEW <small class="draftTag">DEV</small></h3>
    <div class="row">${rv.file ? `<b>${esc(rv.file.name)}</b>` : 'No video loaded'} <label class="rvPick" style="margin-left:auto">${rv.file ? 'change' : 'load video'}<input id="rvFile2" type="file" accept="video/*" hidden></label></div>
    <div class="row"><label>Lens FOV° <input type="number" id="rvFov" value="${rv.hfov}" min="80" max="200"></label><label>Camera tilt° <input type="number" id="rvTilt" value="${rv.tilt}" min="-10" max="60"></label></div>
    <div class="row"><label>Samples/s <select id="rvRate">${[30, 60].map(r => `<option ${r === rv.rate ? 'selected' : ''}>${r}</option>`).join('')}</select></label><label><input type="checkbox" id="rvClean" ${rv.cleanup ? 'checked' : ''}> one axis at a time</label></div>
    <div class="row">${!rv.busy && rv.resumeT != null && rv.frames.length ? `<button data-rv="resume" ${!has ? 'disabled' : ''}>Resume measuring</button>` : ''}<button data-rv="analyze" ${!has || rv.busy ? 'disabled' : ''}>${rv.frames.length ? 'Re-measure from the start' : 'Measure motion'}</button>${rv.busy ? '<button data-rv="cancel">Stop (keeps the data)</button>' : ''}<span>${rv.busy ? Math.round(rv.prog * 100) + '%' : rv.frames.length ? `${rv.frames.length} samples` : ''}</span></div>
    ${rv.busy || rv.prog ? `<div class="rvBar"><i style="width:${rv.prog * 100}%"></i></div>` : ''}
    <p class="note">${rv.frames.length ? `Detector suggestions: <b>${rv.dets.length}</b> · you: ✓${nYes} ✗${nNo} +${nAdd} · obstacle marks ${rv.marks.length}` : 'Measure the motion, then mark when you pass under (U) or over (O) things — that unlocks loops, Mattys and Split-S.'}</p>
    ${items}${added}
    <div class="row"><select id="rvAddName"><option value="">＋ add a trick at the playhead…</option>${names.map(n => `<option>${n}</option>`).join('')}</select></div>
    <div class="row"><button data-rv="export" class="ghost" ${rv.frames.length ? '' : 'disabled'}>Export labels</button><button data-rv="upload" class="ghost" ${rv.frames.length ? '' : 'disabled'}>↑ Upload</button><button data-act="menu" class="ghost">Menu</button></div>
    <p class="note">The camera tilt and lens matter: tilt splits a roll into roll + yaw. "One axis at a time" works best for flips/rolls/spins; turn it off for trippies and orbits (coordinated roll + yaw).</p>`;
}
function drawTimeline() {
  const c = $('#rvTimeline'); if (!c) return; const W = c.clientWidth || 800; c.width = W; const H = c.height, g = c.getContext('2d'), v = $('#rvVideo'), dur = v.duration || 1, x = t => t / dur * W;
  g.fillStyle = '#0e0d0c'; g.fillRect(0, 0, W, H); const mid = 70, sc = 60 / 1200;
  g.strokeStyle = '#2c2925'; g.beginPath(); g.moveTo(0, mid); g.lineTo(W, mid); g.stroke();
  for (let k = 0; k < 3; k++) { g.strokeStyle = RV_COL[k]; g.lineWidth = 1; g.beginPath(); rv.frames.forEach((f, i) => { if (!i) return; const dt = f.t - rv.frames[i - 1].t || 1 / rv.rate, y = mid - Math.max(-60, Math.min(60, f.rpy[k] / dt * sc)); i === 1 ? g.moveTo(x(f.t), y) : g.lineTo(x(f.t), y); }); g.stroke(); }
  g.font = '10px monospace'; ['roll', 'pitch', 'yaw'].forEach((n, k) => { g.fillStyle = RV_COL[k]; g.fillText(n, 6 + k * 40, 12); });
  rv.dets.forEach((d, i) => { const l = rvLabelFor(d); g.fillStyle = l ? (l.verdict === 'yes' ? 'rgba(125,255,154,.35)' : 'rgba(255,90,90,.35)') : 'rgba(255,210,63,.3)'; g.fillRect(x(d.t0), 132, Math.max(3, x(d.t) - x(d.t0)), 16); g.fillStyle = '#fff'; g.fillText(d.name, x(d.t0) + 2, 144); });
  rv.labels.filter(l => l.verdict === 'added').forEach(l => { g.fillStyle = 'rgba(90,184,255,.4)'; g.fillRect(x(l.t0), 114, Math.max(3, x(l.t1) - x(l.t0)), 16); g.fillStyle = '#fff'; g.fillText(l.actual, x(l.t0) + 2, 126); });
  rv.marks.forEach(m => { g.fillStyle = m.kind === 'U' ? '#ffd23f' : '#ff9ad7'; g.fillRect(x(m.t) - 1, 18, 2, 96); g.fillText(m.kind + (m.back ? '←' : '') + (m.side ? '↔' : ''), x(m.t) + 3, 26); });
  if (rv.busy) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x(rv.prog * dur), 0, W - x(rv.prog * dur), H); }
  g.fillStyle = '#fff'; g.fillRect(x(v.currentTime || 0) - 1, 0, 2, H);
}
// attitude of the quad through the clip (integrated from the measured rotation, camera tilt undone) and the stick
// positions that would have made it, through the pilot's rates (throttle can't be seen in a video)
function rvAttitude() {
  rv.att = null; if (!rv.frames.length) return; const D = Math.PI / 180; let q = { w: 1, x: 0, y: 0, z: 0 }; const out = [{ t: rv.frames[0].t, q, br: [0, 0, 0] }];
  for (let i = 1; i < rv.frames.length; i++) { const f = rv.frames[i], span = f.t - rv.frames[i - 1].t; const br = f.rpy && span > 0 ? Vision.bodyRates(f.rpy, span, rv.tilt ?? 20, rv.cleanup !== false) : [0, 0, 0];
    const w = S.v3(br[1] * D, -br[2] * D, -br[0] * D), an = Math.hypot(w.x, w.y, w.z) * span; if (an > 0) q = S.qnorm(S.qmul(q, S.qaxis(S.mul(w, 1 / Math.hypot(w.x, w.y, w.z)), an)));
    out.push({ t: f.t, q, br }); }
  rv.att = out;
}
function rvAt(t) { const A = rv.att; if (!A || !A.length) return null; let lo = 0, hi = A.length - 1; if (t <= A[0].t) return A[0]; if (t >= A[hi].t) return A[hi]; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m].t <= t) lo = m; else hi = m; } return A[lo]; }
function stickFromRates(br) {   // body rates (deg/s) -> sticks through the pilot's rate curves (pitch stick forward = nose down)
  const inv = (rate, r) => { const a = Math.abs(rate); if (a < 1) return 0; let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (Math.abs(S.applyRate(m, r, tune.ratesType)) < a) lo = m; else hi = m; } return Math.sign(rate) * hi; };
  return { roll: inv(br[0], tune.rates.roll), pitch: -inv(br[1], tune.rates.pitch), yaw: inv(br[2], tune.rates.yaw), thr: 0.5 };
}
function drawGhostQuad(cv, q) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  const P = p => { const w = S.qrot(q, p), cy = Math.cos(0.45), sy = Math.sin(0.45), x = w.x, y = w.y * cy - w.z * sy, z = w.y * sy + w.z * cy, k = 1500 / (4 + z); return [W / 2 + x * k, H / 2 - y * k]; };   // seen from behind, a little above
  const arms = [[-0.06, 0, -0.06], [0.06, 0, -0.06], [-0.06, 0, 0.06], [0.06, 0, 0.06]].map(a => S.v3(...a));
  g.lineWidth = 3; g.strokeStyle = 'rgba(120,200,255,0.9)';
  for (const a of arms) { const [x0, y0] = P(S.v3(0, 0, 0)), [x1, y1] = P(a); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.beginPath(); for (let i = 0; i <= 16; i++) { const an = i / 16 * Math.PI * 2, [x, y] = P(S.v3(a.x + Math.cos(an) * 0.032, 0, a.z + Math.sin(an) * 0.032)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  const [cx, cy] = P(S.v3(0, 0.01, -0.03)), [fx, fy] = P(S.v3(0, 0.01 + Math.sin((rv.tilt ?? 20) * Math.PI / 180) * 0.09, -0.03 - Math.cos((rv.tilt ?? 20) * Math.PI / 180) * 0.09));
  g.strokeStyle = '#ffd34d'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(fx, fy); g.stroke();
  const [ux, uy] = P(S.v3(0, 0.06, 0)), [ox, oy] = P(S.v3(0, 0, 0)); g.strokeStyle = 'rgba(125,255,154,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ux, uy); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '10px ui-monospace, monospace'; g.fillText('ghost (measured)', 6, H - 6);
}
function rvControls() {
  const v = $('#rvVideo'); if (!v) return; const d = v.duration || 0, t = v.currentTime || 0, f = x => `${Math.floor(x / 60)}:${(x % 60).toFixed(2).padStart(5, '0')}`;
  $('#rvTime').textContent = `${f(t)} / ${f(d)}`; $('#rvPlay').textContent = v.paused ? '▶' : '❚❚';
  const sk = $('#rvSeek'); if (document.activeElement !== sk && d) sk.value = Math.round(t / d * 1000);
  $('#rvMute').textContent = v.muted || v.volume === 0 ? '🔇' : '🔊'; $('#rvLoop').textContent = rv.loop ? (rv.loop.label || 'loop on') : 'loop off'; $('#rvLoop').classList.toggle('on', !!rv.loop);
  if (rv.loop && d && !v.paused && (t >= rv.loop.b || t < rv.loop.a - 0.05)) v.currentTime = rv.loop.a;
}
function reviewTick() {   // called every animation frame while reviewing
  const v = $('#rvVideo'), el = $('#rvNow'); if (!v) return; const t = v.currentTime;
  rvControls();
  const on = $('#rvSticksOn') ? $('#rvSticksOn').checked : true, A = on && rvAt(t);
  $('#rvSticks').classList.toggle('off', !A); $('#rvGhost').classList.toggle('off', !A);
  if (A) { const trail = []; for (let k = 15; k >= 1; k--) { const B = rvAt(t - k * 0.033); if (B) trail.push(stickFromRates(B.br)); }
    drawSticks($('#rvSticks'), stickFromRates(A.br), trail, { label: 'THR (not in video)', label2: 'P/R from motion' }); drawGhostQuad($('#rvGhost'), A.q); }
  const cur = rv.dets.filter(d => t >= d.t0 - 0.1 && t <= d.t + 0.6), fl = el.dataset.until && performance.now() < +el.dataset.until ? el.dataset.flash : '';
  el.innerHTML = cur.map(d => `${d.name}<small>${d.exec}</small>`).join('') + (fl ? `<small>● ${fl}</small>` : '');
  drawTimeline();
}
document.addEventListener('change', e => {
  if (e.target.id === 'rvFile' || e.target.id === 'rvFile2') rvLoad(e.target.files[0]);
  if (e.target.id === 'rvFov') rv.hfov = +e.target.value || 130; if (e.target.id === 'rvTilt') { rv.tilt = +e.target.value; rvAttitude(); rvDetect(); }
  if (e.target.id === 'rvSpeed') $('#rvVideo').playbackRate = +e.target.value; if (e.target.id === 'rvVol') { const v = $('#rvVideo'); v.volume = +e.target.value; v.muted = v.volume === 0; }
  if (e.target.id === 'rvRate') rv.rate = +e.target.value; if (e.target.id === 'rvClean') { rv.cleanup = e.target.checked; rvAttitude(); rvDetect(); }
  if (e.target.dataset.rvfix) { const i = +e.target.dataset.rvfix; rvJudge(i, 'no', e.target.value || null); }
  if (e.target.id === 'rvAddName' && e.target.value) { rvAdd(e.target.value); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rv]'); if (b) { const a = b.dataset.rv, i = +b.dataset.i;
    if (a === 'analyze') rvAnalyze(false); if (a === 'resume') rvAnalyze(true); if (a === 'cancel') rv.cancel = true; if (a === 'export') rvExport(); if (a === 'upload') rvUpload();
    if (a === 'yes') rvJudge(i, 'yes'); if (a === 'no') rvJudge(i, 'no'); if (a === 'del') { rv.labels.splice(+b.dataset.k, 1); renderReview(); }
    if (a === 'go') { const v = $('#rvVideo'); v.currentTime = Math.max(0, rv.dets[i].t0 - 0.6); v.play(); }
    return; }
  if (e.target.id === 'rvTimeline') { const v = $('#rvVideo'), r = e.target.getBoundingClientRect(); if (v.duration) v.currentTime = (e.clientX - r.left) / r.width * v.duration; }
  const rc = e.target.closest('[data-rvc]'); if (rc) { const v = $('#rvVideo'), a = rc.dataset.rvc, fr = 1 / (rv.rate || 30); if (!v.duration && a !== 'mute') return;
    if (a === 'play') v.paused ? v.play() : v.pause(); if (a === 'fprev') { v.pause(); v.currentTime = Math.max(0, v.currentTime - fr); } if (a === 'fnext') { v.pause(); v.currentTime = Math.min(v.duration, v.currentTime + fr); }
    if (a === 'back1') v.currentTime = Math.max(0, v.currentTime - 1); if (a === 'fwd1') v.currentTime = Math.min(v.duration, v.currentTime + 1);
    if (a === 'mute') { v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 0.6; }
    if (a === 'loop') { if (rv.loop) rv.loop = null; else { const t = v.currentTime, d = rv.dets.find(x => t >= x.t0 - 0.8 && t <= x.t + 0.8); rv.loop = d ? { a: Math.max(0, d.t0 - 0.8), b: d.t + 0.6, label: 'loop: ' + d.name } : { a: 0, b: v.duration, label: 'loop: clip' }; } } }
  if (e.target.closest('[data-act="review"]')) openReview();
});
addEventListener('keydown', e => {
  if (mode !== 'review' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; const v = $('#rvVideo');
  if (e.code === 'Escape') { v.pause(); mode = 'menu'; show('#mainMenu'); return; }
  if (!v.duration) return;
  if (e.code === 'Space') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
  if (e.code === 'Comma') { v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / rv.rate); } if (e.code === 'Period') { v.pause(); v.currentTime = Math.min(v.duration, v.currentTime + 1 / rv.rate); }
  if (e.code === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 1); if (e.code === 'ArrowRight') v.currentTime = Math.min(v.duration, v.currentTime + 1);
  if (e.code === 'KeyU') rvMark('U', e.shiftKey, keys.KeyL); if (e.code === 'KeyO') rvMark('O', e.shiftKey, keys.KeyL); if (e.code === 'KeyX') rvUnmark();
  if (e.code === 'KeyA') { const s = $('#rvAddName'); if (s) s.focus(); }
});
document.addEventListener('input', e => { if (e.target.id === 'rvSeek') { const v = $('#rvVideo'); if (v.duration) v.currentTime = +e.target.value / 1000 * v.duration; } });
(() => { const box = document.getElementById('rvDrop'); if (!box) return; const vb = box.parentElement;
  vb.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); }); vb.addEventListener('dragleave', () => box.classList.remove('drag'));
  vb.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) rvLoad(f); }); })();

