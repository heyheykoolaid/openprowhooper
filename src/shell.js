// ============================================================ boot
(async function boot() {
  try { await Promise.all(['80px "Sedgwick Ave Display"', '40px "Permanent Marker"', '30px "Bungee"'].map(f => document.fonts.load(f))); } catch {}
  await loadArt(); detector.camTilt = tune.camTilt; makeTextures(); mats(); buildScene(); buildDroneMesh(); resize();
  $('#best').textContent = store.get('best', 0).toLocaleString();
  $('#vol').value = store.get('vol', 0.35); updateMenuDevice(); setInterval(updateMenuDevice, 2000);
  $('#loading').classList.add('hide'); show('#mainMenu');
  requestAnimationFrame(frame);
})();
window.__pw = { drone, detector, get score() { return score; }, startFly, S, rec: rc => recordTrace(rc), ghost: (n, o) => startGhost(n, o), judge: t => startJudge(t), review: { payload: () => rvPayload(), get state() { return rv; } } };

// ============================================================ music player (overlay on everything)
const music = (() => {
  const el = new Audio(); el.preload = 'auto';
  const tracks = (window.PW_TRACKS || []).map(t => ({ ...t }));
  let idx = 0, started = false, wantPlay = store.get('musicOn', true);
  el.volume = store.get('musicVol', 0.55);
  const ui = $('#music');
  function load(i, autoplay) {
    if (!tracks.length) return; idx = (i + tracks.length) % tracks.length; const t = tracks[idx];
    el.src = t.src; el.loop = tracks.length === 1;
    $('#mTitle').textContent = t.title; $('#mArtist').textContent = t.artist || '';
    $('#mArt').style.backgroundImage = t.art ? `url("${t.art}")` : '';
    $('#mList').innerHTML = tracks.map((x, k) => `<li class="${k === idx ? 'on' : ''}" data-track="${k}">${x.title}<span>${x.artist || ''}</span></li>`).join('');
    if (autoplay) play();
    nowPlaying(t);
  }
  function play() { wantPlay = true; store.set('musicOn', true); const p = el.play(); if (p && p.catch) p.catch(() => { ui.classList.add('needsTap'); }); render(); }
  function pause() { wantPlay = false; store.set('musicOn', false); el.pause(); render(); }
  function render() { $('#mPlay').textContent = el.paused ? '▶' : '❚❚'; ui.classList.toggle('playing', !el.paused); $('#mVol').value = el.volume; }
  function nowPlaying(t) { const n = $('#nowPlaying'); n.innerHTML = `<small>NOW PLAYING</small><b>${t.title}</b><span>${t.artist || ''}</span>`; n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
  el.addEventListener('play', () => { ui.classList.remove('needsTap'); render(); });
  el.addEventListener('pause', render);
  el.addEventListener('ended', () => load(idx + 1, true));
  el.addEventListener('timeupdate', () => { if (el.duration) $('#mProg').style.width = (el.currentTime / el.duration * 100) + '%'; });
  // browsers block sound until the first click / key press — start then
  const kick = () => { if (!started) { started = true; if (wantPlay) play(); } };
  addEventListener('pointerdown', kick, { capture: true }); addEventListener('keydown', kick, { capture: true });
  ui.addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); const tr = e.target.closest('[data-track]');
    if (tr) { load(+tr.dataset.track, true); return; }
    if (!b) return; e.stopPropagation(); const a = b.dataset.m;
    if (a === 'play') { started = true; el.paused ? play() : pause(); }
    if (a === 'next') load(idx + 1, !el.paused || wantPlay);
    if (a === 'prev') { if (el.currentTime > 3) el.currentTime = 0; else load(idx - 1, !el.paused || wantPlay); }
    if (a === 'list') ui.classList.toggle('open');
    if (a === 'add') $('#mFile').click();
  });
  $('#mVol').addEventListener('input', e => { el.volume = +e.target.value; store.set('musicVol', el.volume); });
  $('#mFile').addEventListener('change', e => {
    const files = [...e.target.files]; if (!files.length) return;
    const first = tracks.length;
    for (const f of files) tracks.push({ title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), artist: 'your music', src: URL.createObjectURL(f) });
    if (tracks.length > 1) el.loop = false;
    load(first, true); e.target.value = '';
  });
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.code === 'KeyM') { el.paused ? play() : pause(); } if (e.code === 'KeyN') load(idx + 1, true); });
  load(0, false); render();
  return { el, play, pause, load };
})();

// ============================================================ trick debug panel (G)
function renderDebug() {
  const box = $('#trickDebug'); if (box.classList.contains('hide')) return;
  const rows = (detector.debug || []).slice(-6).reverse();
  box.querySelector('.rows').innerHTML = rows.length ? rows.map(r => `<div class="dr"><b>${r.result.length ? r.result.join(', ') : (r.near ? 'near miss' : 'no match')}</b>
    <div>rotations: <code>${r.toks || '—'}</code></div><div>obstacle passes: <code>${r.cross || 'none'}</code></div>${r.near ? `<div class="nm">${r.near}</div>` : ''}</div>`).join('') : '<p class="note">Do a trick and its raw data shows here.</p>';
}
addEventListener('keydown', e => { if (e.code === 'KeyG' && mode !== 'menu' && !(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) { $('#trickDebug').classList.toggle('hide'); renderDebug(); } });
setInterval(renderDebug, 500);
document.addEventListener('click', async e => {
  if (e.target.id !== 'dbgCopy') return;
  const last = (detector.debug || []).slice(-1)[0]; if (!last) return;
  const txt = JSON.stringify({ build: '0.1', craft: spec, ...last });
  const ta = $('#dbgText'); ta.value = txt; ta.classList.remove('hide'); ta.select();
  try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copied ✓'; } catch { e.target.textContent = 'Select + copy the text below'; }
  setTimeout(() => e.target.textContent = 'Copy last trick data', 2500);
});

