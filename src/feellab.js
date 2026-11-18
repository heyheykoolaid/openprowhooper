// ============================================================ Feel Lab (Tools & labs): a real flight's Blackbox log next to the sim
// flying the same sticks (src/feelfit.js), and the settings that bring the sim's feel closer to the pilot's own whoop.
// Nothing leaves the browser; the log is only read.
const FL = { logs: null, file: '', pick: null, res: null, fit: null, busy: false, win: 0 };
function feelOpen() { show('#feelScreen'); feelRender(); }
document.addEventListener('click', e => { const b = e.target.closest('[data-act="feellab"]'); if (b) feelOpen(); });
const fl1 = x => x == null ? '—' : (+x).toFixed(1);
function feelRender() {
  const el = $('#feelBody'); if (!el) return; const R = FL.res;
  const logs = FL.logs ? FL.logs.map((L, i) => ({ i, sp: FeelFit.flightSpan(L) })).filter(x => x.sp && x.sp.secs >= 8) : [];
  let h = `<p class="note">Load a Betaflight Blackbox log from your own whoop (.bbl / .bfl, the flash dump or one flight). The game flies your real sticks
    through the sim with the build and tune in your Garage (and your log's rates), and measures both the same way: how fast each axis follows the sticks,
    how closely it tracks, the wobble you did not ask for, and hover throttle. Then it suggests the feel settings that close the gap. Pick your parts in the
    Garage first for the closest match. Your log stays on this computer.</p>
    <div class="row"><label class="ghost">Choose a log… <input type="file" id="flFile" accept=".bbl,.bfl,.txt" hidden></label><button data-fl="pick">Choose a log…</button>
    <span class="note">${esc(FL.file || '')}${FL.logs ? ` · ${FL.logs.length} log${FL.logs.length === 1 ? '' : 's'}, ${logs.length} long enough` : ''}</span></div>`;
  if (logs.length) h += `<p>Flights: ${logs.map(x => `<button class="${FL.pick === x.i ? 'on' : ''}" data-fl="log:${x.i}">#${x.i} · ${Math.round(x.sp.secs)} s</button>`).join(' ')}</p>`;
  if (R) {
    const row = (name, a, b, unit, good) => `<tr><td>${name}</td><td>${a}</td><td>${b}</td><td class="note">${unit}</td><td>${good == null ? '' : good ? '✓' : '·'}</td></tr>`, close = (a, b, tol) => a == null || b == null ? null : Math.abs(a - b) <= tol;
    h += `<h3>Flight #${FL.pick}: ${R.span.from}–${R.span.to} s</h3><table class="flT"><tr><th></th><th>Your whoop</th><th>The sim</th><th></th><th></th></tr>
      ${row('Hover motor', fl1(R.real.hover) + '%', fl1(R.sim.hover) + '%', 'motor output while hovering calm', close(R.real.hover, R.sim.hover, 3))}
      ${['Roll', 'Pitch', 'Yaw'].map((a, k) => row(a + ' follows the sticks', fl1(R.real.axes[k].lag) + ' ms', fl1(R.sim.axes[k].lag) + ' ms', 'later = softer, earlier = locked-in', close(R.real.axes[k].lag, R.sim.axes[k].lag, 1.5))).join('')}
      ${['Roll', 'Pitch', 'Yaw'].map((a, k) => row(a + ' tracking error', fl1(R.real.axes[k].track) + '%', fl1(R.sim.axes[k].track) + '%', 'how far it strays from what you asked', close(R.real.axes[k].track, R.sim.axes[k].track, 2.5))).join('')}
      ${row('Unasked wobble (roll / pitch)', R.real.resid.slice(0, 2).map(fl1).join(' / ') + ' °/s', R.sim.resid.slice(0, 2).map(fl1).join(' / ') + ' °/s', 'air, wash, vibration (2–20 Hz)', close(R.real.resid[0], R.sim.resid[0], 2))}
      ${row('Motor dead time', fl1(R.real.motorLag) + ' ms', fl1(R.sim.motorLag) + ' ms', 'before the motor speed starts to move', null)}
      ${row('Buzz (roll, unfiltered gyro)', fl1(R.real.buzz[0]) + ' °/s', '—', 'the sim draws it on the camera', null)}</table>
      <canvas id="flPlot" width="860" height="200"></canvas><label>Window <input type="range" id="flWin" min="0" max="${Math.max(0, Math.floor(R.s.t.length / R.s.hz) - 3)}" step="0.5" value="${FL.win}"> <span class="note">roll: setpoint (grey), your whoop (gold), the sim (cyan)</span></label>
      <h3>Suggested</h3>${R.suggest.length ? R.suggest.map(s => `<p>${esc(s.label)}: <b>${s.now} → ${s.to}</b> <span class="note">${esc(s.why)}</span> <button data-fl="apply:${s.key}:${s.to}">Apply</button></p>`).join('') : '<p class="note">Nothing to change: the sim already matches this flight.</p>'}
      <div class="row"><button class="primary" data-fl="fit" ${FL.busy ? 'disabled' : ''}>Find my feel (loop delay and shake together)</button><button data-fl="export">Export the comparison</button></div>
      ${FL.fit ? `<p>Best on this flight: <b>loop delay ${FL.fit.best.loopDelayMs} ms, shake ${Math.round(FL.fit.best.shake * 100)}%</b> <button data-fl="applyFit">Apply both</button></p><p class="note">${FL.fit.rows.slice(1, 4).map(r => `${r.loopDelayMs} ms / ${Math.round(r.shake * 100)}%`).join(' · ')} were next.</p>` : ''}`;
  }
  h += `<p class="note">Drag and coasting cannot be read from a log (a whoop has no GPS): set them by feel in the Garage → Advanced → physics feel.
    Sending your logs to the project (attach them to feedback, or ask the owner) lets the sim's defaults learn from more whoops.</p>`;
  el.innerHTML = h; feelPlot();
}
function feelPlot() { const cv = $('#flPlot'), R = FL.res; if (!cv || !R) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height, hz = R.s.hz, i0 = Math.floor(FL.win * hz), n = Math.floor(3 * hz);
  g.fillStyle = '#0b0c10'; g.fillRect(0, 0, W, H); const sp = R.s.sp[0], a = R.s.gyro[0], b = R.simS.gyro[0]; let dot = 0, dotS = 0; for (let i = 0; i < sp.length; i++) { dot += sp[i] * a[i]; dotS += sp[i] * b[i]; }
  const sa = dot < 0 ? -1 : 1, sb = dotS < 0 ? -1 : 1; let M = 50; for (let i = i0; i < i0 + n && i < sp.length; i++) M = Math.max(M, Math.abs(sp[i]), Math.abs(a[i]), Math.abs(b[i]));
  g.strokeStyle = '#ffffff22'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  const line = (arr, s, col) => { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); for (let k = 0; k < n && i0 + k < arr.length; k++) { const x = k / n * W, y = H / 2 - arr[i0 + k] * s / M * (H / 2 - 6); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  line(sp, 1, '#888'); line(a, sa, '#ffd34d'); line(b, sb, '#59d3e8'); g.fillStyle = '#aaa'; g.font = '11px monospace'; g.fillText(`±${Math.round(M)} °/s · ${FL.win.toFixed(1)}–${(FL.win + 3).toFixed(1)} s`, 6, 14); }
async function feelLoad(file) { FL.file = file.name; FL.logs = null; FL.res = null; FL.fit = null; FL.pick = null; procShow('Reading the log…', file.name, 0.3);
  try { const buf = new Uint8Array(await file.arrayBuffer()); await new Promise(r => setTimeout(r, 30)); FL.logs = BBL.decode(buf); } catch (err) { FL.logs = []; flashNote('Could not read that log: ' + err.message); }
  procHide(); const long = FL.logs.map((L, i) => ({ i, sp: FeelFit.flightSpan(L) })).filter(x => x.sp && x.sp.secs >= 8).sort((a, b) => b.sp.secs - a.sp.secs); feelRender(); if (long.length) feelPick(long[0].i); }
async function feelPick(i) { FL.pick = i; FL.res = null; FL.fit = null; FL.win = 0; procShow('Flying your sticks through the sim…', 'about a minute of flight, twice', 0.4); await new Promise(r => setTimeout(r, 40));
  try { FL.res = FeelFit.compare(FL.logs[i], { spec, tune: JSON.parse(JSON.stringify(tune)), maxSecs: 30 }); } catch (err) { flashNote('The comparison failed: ' + err.message); }
  procHide(); if (!FL.res) flashNote('That flight is too short or the log has no gyro / setpoint / motor columns'); feelRender(); }
async function feelFit() { const P = FeelFit.prepare(FL.logs[FL.pick], { maxSecs: 30 }); if (!P) return; FL.busy = true; const base = JSON.parse(JSON.stringify(tune)), rows = [];
  const delays = [0, 1.5, 3, 4.5, 6], shakes = [0, 0.5, 1, 1.5, 2]; let k = 0;
  for (const d of delays) for (const sh of shakes) { procShow('Finding your feel…', `loop delay ${d} ms · shake ${Math.round(sh * 100)}%`, ++k / (delays.length * shakes.length)); await new Promise(r => setTimeout(r, 0));
    const t2 = { ...base, loopDelayMs: d, shake: sh }; rows.push({ loopDelayMs: d, shake: sh, cost: +FeelFit.cost(P.real, FeelFit.measure(FeelFit.simulate(P.s, { spec, tune: t2 }))).toFixed(3) }); }
  procHide(); rows.sort((a, b) => a.cost - b.cost); FL.fit = { best: rows[0], rows }; FL.busy = false; feelRender(); }
document.addEventListener('click', e => { const b = e.target.closest('[data-fl]'); if (!b || !b.closest('#feelScreen')) return; const [a, k, v] = b.dataset.fl.split(':');
  if (a === 'pick') $('#flFile').click(); if (a === 'log') feelPick(+k); if (a === 'fit') feelFit();
  if (a === 'apply') { tune[k] = +v; saveTune(); flashNote(`${k === 'shake' ? 'Shake' : k === 'loopDelayMs' ? 'Loop delay' : k === 'motorFeel' ? 'Motor response' : 'Weight'} set: fly to feel it (Garage → Advanced shows it)`); }
  if (a === 'applyFit' && FL.fit) { tune.loopDelayMs = FL.fit.best.loopDelayMs; tune.shake = FL.fit.best.shake; saveTune(); flashNote(`Loop delay ${tune.loopDelayMs} ms and shake ${Math.round(tune.shake * 100)}% set`); }
  if (a === 'export' && FL.res) saveFile(`feel-lab-${slug(FL.file || 'log')}-${FL.pick}.json`, JSON.stringify({ format: 'pro-whooper-feelfit/1', at: new Date().toISOString(), file: FL.file, flight: FL.pick, span: FL.res.span, craft: { ...spec }, tune: { shake: tune.shake, loopDelayMs: tune.loopDelayMs, motorFeel: tune.motorFeel, weightFeel: tune.weightFeel }, real: FL.res.real, sim: FL.res.sim, suggest: FL.res.suggest, fit: FL.fit && FL.fit.rows }, null, 1)); });
document.addEventListener('change', e => { if (e.target.id === 'flFile' && e.target.files[0]) feelLoad(e.target.files[0]); });
document.addEventListener('input', e => { if (e.target.id === 'flWin') { FL.win = +e.target.value; feelPlot(); } });
