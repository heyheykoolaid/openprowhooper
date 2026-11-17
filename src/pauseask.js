// ============================================================ trick pause mode (dev): after a trick, pause and ask "was that X?"
const ask = { on: store.get('pauseAsk', false), pending: [], open: false, lastResolved: 0, askedToks: new WeakSet(), rows: [] };
function askQueue(item) { if (!(train.on && ask.on)) return; ask.pending.push(item); }
// batch: wait until the detector has settled (combo finished) before pausing
setInterval(() => {
  if (!(train.on && ask.on) || ask.open || mode !== 'fly') return;
  // big rotation nobody claimed → "what was that?"
  const det = detector, now = det.time;
  for (const k of det.toks || []) if (k.raw >= 300 && now - k.t1 > 1.3 && k.usedUntil < k.t1 - 0.1 && !ask.askedToks.has(k) && drone.armed && !drone.crashed) {
    ask.askedToks.add(k); ask.pending.push({ kind: 'unknown', t: drone.time, rot: `${k.ax === 'P' ? (k.dir > 0 ? 'back' : 'forward') + ' flip' : k.ax === 'R' ? (k.dir > 0 ? 'right' : 'left') + ' roll' : (k.dir > 0 ? 'right' : 'left') + ' yaw'} of about ${Math.round(k.raw / 90) * 90}°` });
  }
  if (!ask.pending.length || det.busy()) return;
  const lastT = Math.max(...ask.pending.map(p => p.t)); if (drone.time - lastT < 0.45) return;
  openAsk();
}, 120);
function openAsk() {
  ask.open = true; ask.rows = ask.pending.splice(0); mode = 'paused';
  const opts = ALL_TRICKS().map(x => `<option>${nameOf(x)}</option>`).join('');
  $('#askBody').innerHTML = `<h2>Was that…</h2>` + ask.rows.map((r, i) => r.kind === 'trick'
      ? `<div class="askRow" data-i="${i}"><b>${r.name}</b>${r.obstacle ? ` <small>on ${r.obstacle}</small>` : ''} <small class="ex ${r.exec}">${r.exec}</small>
          <span class="askBtns"><button data-ask="yes" data-i="${i}" class="sel">✓ Yes</button><button data-ask="no" data-i="${i}">✗ No, it was…</button></span>
          <select data-askfix="${i}" class="hide"><option value="">pick the trick (or leave blank if it wasn't a trick)</option>${opts}</select></div>`
      : `<div class="askRow" data-i="${i}"><b>${r.kind === 'near' ? r.text : `Unrecognised: ${r.rot}`}</b>
          <span class="askBtns"><select data-askfix="${i}"><option value="">${r.kind === 'near' ? 'it was…' : 'what was it?'} (leave blank if nothing)</option>${opts}</select></span></div>`).join('') +
    `<div class="row"><button id="askDone">Continue <kbd>Enter</kbd></button><button id="askSkip" class="ghost">Skip — don't save <kbd>Esc</kbd></button></div>
     <p class="note">Y = all correct · Enter = save &amp; continue · answers are saved with the flight recording${gh.enabled && gh.token ? ' and uploaded' : ''}.</p>`;
  ask.rows.forEach(r => { if (r.kind === 'trick') r.answer = 'yes'; });
  $('#askBox').classList.remove('hide');
}
function closeAsk(save) {
  if (save) for (const r of ask.rows) {
    const repStart = Math.max(ask.lastResolved, r.t - 5);
    const base = { repStart, t: r.t, obstacle: r.obstacle || null, round: cal.round, via: 'pause-ask', detected: r.kind === 'trick' ? [r.name] : [], toks: '', cross: '', near: r.kind === 'near' ? r.text : null };
    const push = lab => { run.labels.push(lab); idb.put('examples', { id: run.id + '#' + run.labels.length, run: run.id, ...lab, craft: { ...spec }, hz: TRACE_HZ, cols: TRACE_COLS, trace: trace.slice(-TRACE_LEN) }); };
    const addRep = n => { if (repsOf(n) < REPS) { cal.reps[n] = repsOf(n) + 1; if (r.kind === 'trick' && r.name === n) cal.agree[n] = (cal.agree[n] || 0) + 1; else cal.misses[n] = (cal.misses[n] || 0) + 1; } };
    if (r.kind === 'trick' && r.answer === 'yes') { push({ ...base, target: r.name, prompted: r.name, verdict: 'yes', rep: repsOf(r.name) + 1 }); addRep(r.name); }
    else if (r.kind === 'trick') { push({ ...base, target: r.name, prompted: r.name, verdict: 'no' }); if (r.fix) { push({ ...base, target: r.fix, prompted: r.name, verdict: 'yes', rep: repsOf(r.fix) + 1 }); addRep(r.fix); } }
    else if (r.fix) { push({ ...base, target: r.fix, prompted: '(unrecognised)', verdict: 'yes', rep: repsOf(r.fix) + 1 }); addRep(r.fix); }
    else push({ ...base, target: '(no trick)', prompted: '(unrecognised)', verdict: 'yes' });
  }
  if (save) { saveCalib(); flushRun(); }
  ask.lastResolved = drone.time; ask.open = false; ask.rows = [];
  $('#askBox').classList.add('hide'); if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  resume(); renderTrain();
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-ask]'); if (a) { const i = +a.dataset.i, r = ask.rows[i]; r.answer = a.dataset.ask;
    a.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b === a)); const s = document.querySelector(`[data-askfix="${i}"]`); if (s) s.classList.toggle('hide', r.answer !== 'no'); }
  if (e.target.id === 'askDone') closeAsk(true); if (e.target.id === 'askSkip') closeAsk(false);
  if (e.target.closest('[data-tr="pauseask"]')) { ask.on = !ask.on; store.set('pauseAsk', ask.on); renderTrain(); flash(`<b>PAUSE &amp; ASK ${ask.on ? 'ON' : 'OFF'}</b><small>${ask.on ? 'the game pauses after each trick to ask if it got it right' : ''}</small>`); }
});
document.addEventListener('change', e => { const i = e.target.dataset && e.target.dataset.askfix; if (i !== undefined) ask.rows[+i].fix = e.target.value || null; });
addEventListener('keydown', e => {
  if (ask.open) { if (e.target.tagName === 'SELECT') return; e.stopImmediatePropagation(); e.preventDefault();
    if (e.code === 'KeyY') { ask.rows.forEach(r => { if (r.kind === 'trick') r.answer = 'yes'; }); closeAsk(true); }
    else if (e.code === 'Enter') closeAsk(true); else if (e.code === 'Escape') closeAsk(false); return; }
  if (train.on && mode === 'fly' && e.code === 'KeyP' && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { ask.on = !ask.on; store.set('pauseAsk', ask.on); renderTrain(); }
}, true);
window.__pw.ask = ask; window.__pw.run = run; window.__pw.mode = () => mode;
