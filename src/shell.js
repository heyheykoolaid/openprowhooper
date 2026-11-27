// ============================================================ boot
(async function boot() {
  try { await Promise.all(['80px "Sedgwick Ave Display"', '40px "Permanent Marker"', '30px "Bungee"'].map(f => document.fonts.load(f))); } catch {}
  await loadArt(); detector.camTilt = tune.camTilt; makeTextures(); mats(); buildScene(); buildDroneMesh(); resize();
  $('#best').textContent = store.get('best', 0).toLocaleString();
  $('#vol').value = store.get('vol', 0.25); updateMenuDevice(); setInterval(updateMenuDevice, 2000);
  $('#loading').classList.add('hide'); show('#mainMenu');
  requestAnimationFrame(frame);
})();
window.__pw = { drone, detector, perf: PERF, get frameShown() { return { show: showFrame, visible: droneMesh.visible, cam: camMode, mode }; }, me: { get sel() { return [...ME.sel]; }, get E() { return ME.E; }, giz: (m, ax) => { const c = (m === "move" ? MG.move : m === "rotate" ? MG.rot : MG.scl).children.find(o => !ax || o.userData.giz.axis === ax); if (!c || !MG.grp.visible) return null; MG.grp.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(c), p = (ax ? b.max.clone().add(b.min).multiplyScalar(0.5) : b.getCenter(new THREE.Vector3())); if (m === "rotate") { p.copy(MG.grp.position).add(new THREE.Vector3(0.95 * MG.grp.scale.x, 0, 0)); } const q = p.project(meCam), r = canvas.getBoundingClientRect(); return [Math.round((q.x + 1) / 2 * r.width + r.left), Math.round((1 - q.y) / 2 * r.height + r.top)]; } }, mapcode: { of: E => meCodeOf(E), read: s => meCodeRead(s) }, get score() { return score; }, startFly, S, rec: rc => recordTrace(rc), ghost: (n, o) => startGhost(n, o), judge: t => startJudge(t), review: { payload: () => rvPayload(), get state() { return rv; } } };
window.__pw.kwadMark = { get state() { return { sig: KM.sig, n: KM.parts.length, vis: !!(KM.grp && KM.grp.visible), shown: KM.parts.filter(m => m.visible).length, letters: KM.parts.filter(m => m.isSprite && m.visible).length }; } };

// ============================================================ music player (overlay on everything)
const music = (() => {
  const el = new Audio(); el.preload = 'auto';
  const tracks = (window.PW_TRACKS || []).map(t => ({ ...t }));
  let idx = 0, started = false, wantPlay = store.get('musicOn', true);
  el.volume = store.get('musicVol', 0.25);
  const ui = $('#music');
  // the small player (owner, 2026-11-20: "a way to further collapse the music player, it gets in the way"): only play and the
  // expand button, down in the corner; remembered
  function miniSet(m) { ui.classList.toggle('mini', m); ui.classList.remove('open'); const b = $('#mMini'); if (b) { b.textContent = m ? '♪' : '–'; b.title = m ? 'Show the music player' : 'Shrink the player to a small button'; } }
  miniSet(store.get('musicMini', false));
  // byTe_me Radio, the game's default music: the Infinity Loops community's free-to-use collection, streamed straight from
  // archive.org (nothing is copied into the game). If it can't be reached the built-in track plays instead. Track names come from the file names there: Artist__id__Title.mp3. Shuffled.
  const RADIO = { ids: ['infinityloops-free-to-use-music-1', 'infinityloops-free-to-use-music-2', 'infinityloops-free-to-use-music-3'], on: (() => { if (!store.get('radioIsDefault', false)) { store.set('radioIsDefault', true); store.set('radio', true); } return store.get('radio', true); })(), cur: null, list: null,   /* the radio is THE default: an old 'off' from before it was the default is cleared once */ loading: false, hist: [], fails: 0 };
  const hesc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tidy = x => x.replace(/byTe_me/gi, 'byTe\u0001me').replace(/_+/g, ' ').replace(/\u0001/g, '_').replace(/\s+/g, ' ').trim();
  function radioNote(t) { const n = $('#mRadioNote'); if (n) n.textContent = t; const b = $('#mRadio'); if (b) b.textContent = `📻 byTe_me Radio: ${RADIO.on ? 'on' : 'off'}`; }
  async function radioList() {
    if (RADIO.list) return RADIO.list; RADIO.loading = true; radioNote('Tuning in…');
    const got = await Promise.allSettled(RADIO.ids.map(async id => { const r = await fetch(`https://archive.org/metadata/${id}`); const j = await r.json(); return (j.files || []).filter(f => /\.mp3$/i.test(f.name) && !/\//.test(f.name)).map(f => { const base = f.name.replace(/\.mp3$/i, ''), parts = base.split('__');
      const k = parts.findIndex(x => /^\d{10,}$/.test(x)), art = k > 0 ? parts.slice(0, k).join(' ') : parts.length >= 2 ? parts[0] : '', ttl = k >= 0 ? parts.slice(k + 1).join(' ') : parts[parts.length - 1];   // Artist__<id>__Title
      return { title: tidy(ttl) || tidy(base), artist: tidy(art).replace(/ +_/g, ' ').replace(/_ +/g, ' ') || 'Infinity Loops community', src: `https://archive.org/download/${id}/${encodeURIComponent(f.name)}`, radio: true }; }); }));
    const list = got.flatMap(g => g.status === 'fulfilled' ? g.value : []); RADIO.loading = false; if (list.length) RADIO.list = list; return list;
  }
  async function radioNext(back) {
    const list = await radioList(); if (!RADIO.on) return;
    if (!list.length) { RADIO.on = false; RADIO.cur = null; radioNote('Could not reach archive.org from here, so this is the built-in track. The radio will try again next time.'); load(idx, wantPlay); return; }   // for this visit only: the choice stays on
    let t; if (back && RADIO.hist.length > 1) { RADIO.hist.pop(); t = RADIO.hist[RADIO.hist.length - 1]; } else { t = list[Math.floor(Math.random() * list.length)]; RADIO.hist.push(t); if (RADIO.hist.length > 50) RADIO.hist.shift(); }
    RADIO.cur = t; el.loop = false; el.src = t.src; $('#mTitle').textContent = t.title; $('#mArtist').textContent = t.artist; $('#mArt').style.backgroundImage = '';
    $('#mList').innerHTML = `<li class="on">${hesc(t.title)}<span>${hesc(t.artist)}</span></li>`;
    radioNote(`${list.length} tracks, shuffled. Streamed from the Infinity Loops free-to-use collection on archive.org; rights remain with the artists.`);
    play(); nowPlaying(t);
  }
  function radioSet(on) { RADIO.on = on; store.set('radio', on); RADIO.fails = 0; if (on) radioNext(); else { RADIO.cur = null; radioNote(''); load(idx, wantPlay); } }
  // until the first track is tuned in, the player says Radio, not the built-in track's name
  function radioIdle() { RADIO.cur = null; el.removeAttribute('src'); $('#mTitle').textContent = 'byTe_me Radio'; $('#mArtist').textContent = 'Infinity Loops · press play'; $('#mArt').style.backgroundImage = ''; $('#mList').innerHTML = '<li class="on">byTe_me Radio<span>streams when you press play</span></li>' + tracks.map((x, k) => `<li data-track="${k}">${hesc(x.title)}<span>${hesc(x.artist || '')}</span></li>`).join(''); }
  el.addEventListener('error', () => { if (!RADIO.on) return; if (++RADIO.fails > 4) { RADIO.on = false; RADIO.cur = null; RADIO.fails = 0; load(idx, wantPlay); radioNote('The stream stopped responding; back to the built-in track for now.'); } else radioNext(); });
  el.addEventListener('playing', () => { RADIO.fails = 0; });
  function load(i, autoplay) {
    if (!tracks.length) return; idx = (i + tracks.length) % tracks.length; const t = tracks[idx];
    el.src = t.src; el.loop = tracks.length === 1;
    $('#mTitle').textContent = t.title; $('#mArtist').textContent = t.artist || '';
    $('#mArt').style.backgroundImage = t.art ? `url("${t.art}")` : '';
    $('#mList').innerHTML = tracks.map((x, k) => `<li class="${k === idx ? 'on' : ''}" data-track="${k}">${hesc(x.title)}<span>${hesc(x.artist || '')}</span></li>`).join('');
    if (autoplay) play();
    nowPlaying(t);
  }
  function play() { wantPlay = true; store.set('musicOn', true); const p = el.play(); if (p && p.catch) p.catch(() => { ui.classList.add('needsTap'); }); render(); }
  function pause() { wantPlay = false; store.set('musicOn', false); el.pause(); render(); }
  function render() { $('#mPlay').textContent = el.paused ? '▶' : '❚❚'; ui.classList.toggle('playing', !el.paused); $('#mVol').value = el.volume; }
  function nowPlaying(t) { if (ui.classList.contains('mini')) return; const n = $('#nowPlaying'); n.innerHTML = `<small>NOW PLAYING</small><b>${hesc(t.title)}</b><span>${hesc(t.artist || '')}</span>`; /* remote / file-name text: always escaped */ n.classList.remove('show'); void n.offsetWidth; n.classList.add('show'); }
  el.addEventListener('play', () => { ui.classList.remove('needsTap'); render(); });
  el.addEventListener('pause', render);
  el.addEventListener('ended', () => { if (RADIO.on) radioNext(); else load(idx + 1, true); });
  el.addEventListener('timeupdate', () => { if (el.duration) $('#mProg').style.width = (el.currentTime / el.duration * 100) + '%'; });
  // browsers block sound until the first click / key press — start then
  const kick = () => { if (!started) { started = true; if (RADIO.on && wantPlay) radioNext(); else if (wantPlay) play(); } };
  addEventListener('pointerdown', kick, { capture: true }); addEventListener('keydown', kick, { capture: true });
  ui.addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); const tr = e.target.closest('[data-track]');
    if (tr) { if (RADIO.on) radioSet(false); load(+tr.dataset.track, true); return; }
    if (!b) return; e.stopPropagation(); const a = b.dataset.m;
    if (a === 'play') { started = true; if (el.paused && RADIO.on && !RADIO.cur) { wantPlay = true; store.set('musicOn', true); radioNext(); } else el.paused ? play() : pause(); }
    if (a === 'radio') { started = true; radioSet(!RADIO.on); return; }
    if (RADIO.on && (a === 'next' || a === 'prev')) { if (a === 'prev' && el.currentTime > 3) el.currentTime = 0; else radioNext(a === 'prev'); return; }
    if (a === 'next') load(idx + 1, !el.paused || wantPlay);
    if (a === 'prev') { if (el.currentTime > 3) el.currentTime = 0; else load(idx - 1, !el.paused || wantPlay); }
    if (a === 'list') ui.classList.toggle('open');
    if (a === 'mini') { const m = !ui.classList.contains('mini'); miniSet(m); store.set('musicMini', m); }
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
  addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.code === 'KeyM') { el.paused && RADIO.on && !RADIO.cur ? (wantPlay = true, radioNext()) : el.paused ? play() : pause(); } if (e.code === 'KeyN') { if (RADIO.on) radioNext(); else load(idx + 1, true); } });
  if (RADIO.on) radioIdle(); else load(0, false); render(); radioNote('');
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

