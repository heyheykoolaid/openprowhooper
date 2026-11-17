// ============================================================ GitHub sync: upload calibration data to the project repo
// The token lives only in this browser (localStorage). It is never put in the game file or in exports.
// Use a fine-grained token limited to the one repo with "Contents: Read and write".
const gh = Object.assign({ owner: 'heyheykoolaid', repo: 'openprowhooper', branch: 'main', token: '', enabled: false, bbEnabled: false }, store.get('ghsync', {}));
const ghState = { queue: [], busy: false, last: '', ok: null };
const saveGh = () => store.set('ghsync', gh);
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function b64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
async function ghFetch(path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}${path}`, { ...init, headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${gh.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers || {}) } });
  let body = null; try { body = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, body };
}
async function ghTest() {
  if (!gh.token) return 'Add a token first.';
  try { const r = await ghFetch(''); if (!r.ok) return r.status === 404 ? `Can't see ${gh.owner}/${gh.repo} — check the name, or give the token access to it.` : r.status === 401 ? 'Token rejected (expired or mistyped).' : `GitHub said ${r.status}.`;
    return r.body && r.body.permissions && r.body.permissions.push === false ? 'Connected, but this token can\'t write. Give it "Contents: Read and write".' : `Connected to ${gh.owner}/${gh.repo} ✓`; }
  catch (e) { return location.protocol.startsWith('http') && !location.hostname.endsWith('github.io') && !location.hostname.includes('localhost') ? 'This page isn\'t allowed to reach GitHub (the Claude preview blocks it). Use the standalone game file.' : 'Couldn\'t reach GitHub — are you online?'; }
}
function ghEnqueue(path, payload, message) { if (!gh.enabled || !gh.token) return false; ghState.queue.push({ path, content: JSON.stringify(payload), message, tries: 0 }); ghPump(); return true; }
async function ghPump() {
  if (ghState.busy || !ghState.queue.length) return; ghState.busy = true;
  const job = ghState.queue[0];
  try {
    const r = await ghFetch(`/contents/${job.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', body: JSON.stringify({ message: job.message, content: job.contentB64 || b64(job.content), branch: gh.branch }) });
    if (r.ok) { ghState.queue.shift(); ghState.ok = true; ghState.last = `↑ uploaded ${job.path.split('/').slice(-2).join('/')}`; if (job.path.startsWith('blackbox/') && !ghState.queue.some(j => j.path.startsWith('blackbox/'))) { bb.msg = 'Uploaded to GitHub ✓ — ask Claude to look at your Blackbox logs.'; renderBB(); } }
    else { job.tries++; ghState.ok = false; ghState.last = `upload failed (${r.status}${r.body && r.body.message ? ': ' + r.body.message : ''})`; if (job.tries >= 3 || r.status === 401 || r.status === 403 || r.status === 404) ghState.queue.shift(); }
  } catch { job.tries++; ghState.ok = false; ghState.last = 'upload failed (offline or blocked here)'; if (job.tries >= 3) ghState.queue.shift(); }
  ghState.busy = false; if (train.on) renderTrain(); renderGhStatus();
  if (ghState.queue.length) setTimeout(ghPump, ghState.ok ? 300 : 4000);
}
// one finished trick (5 reps): just those reps, with the flight around each one
function uploadTrick(name) {
  const labs = run.labels.filter(l => l.target === name && l.round === cal.round && !l.undone);
  if (!labs.length) return;
  const reps = labs.map(l => ({ ...l, trace: run.trace.filter(r => r[0] >= l.repStart - 2 && r[0] <= l.t + 1) }));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(`calibration/round-${cal.round}/${slug(name)}/${stamp}-${run.id}.json`,
    { format: 'pro-whooper-training/3', build: '0.1', map: MAP_ID, camTilt: tune.camTilt, craft: { ...spec }, tune, trick: name, round: cal.round,
      agreed: labs.filter(l => l.verdict === 'yes' && l.detected.includes(name)).length, examples: reps.map(r => ({ ...r, hz: TRACE_HZ, cols: TRACE_COLS })) },
    `calibration: ${name} ×${labs.filter(l => l.verdict === 'yes').length} (round ${cal.round})`);
}
function uploadRun(reason) {
  if (!run.id || !run.labels.length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(`calibration/round-${cal.round}/sessions/${stamp}-${run.id}.json`,
    { format: 'pro-whooper-session/2', build: '0.1', map: MAP_ID, camTilt: tune.camTilt, craft: { ...spec }, tune, calib: cal,
      run: { id: run.id, started: run.started, round: run.round, hz: TRACE_HZ, cols: TRACE_COLS, trace: run.trace, events: run.events, labels: run.labels } },
    `calibration session: ${run.labels.length} labels (${reason})`);
}
// The GitHub settings and upload buttons are the project owner's tools: shown only to the pilot named heyheykoolaid.
// (This only tidies the menus for everyone else; it is not a lock. Nothing secret is behind it.)
function ghMenus() { return pilotName().toLowerCase() === 'heyheykoolaid'; }
function renderGhStatus() { const el = $('#ghStatus'); if (el) el.textContent = !ghMenus() ? '' : !gh.enabled ? 'upload off (Options)' : gh.token ? (ghState.queue.length ? `uploading… (${ghState.queue.length} left)` : ghState.last || `ready → ${gh.owner}/${gh.repo}`) : 'not set up'; }
function openSync() { openOptions(); }
function openOptions() {
  show('#optionsScreen'); if (mode === 'fly') { mode = 'paused'; train.pausedForList = true; }
  $('#optBody').innerHTML = `
    <h3>Sound</h3>
    <label>Motor sound<input id="optVol" type="range" min="0" max="1" step="0.01" value="${store.get('vol', 0.35)}"></label>
    <label>Music<input id="optMusic" type="range" min="0" max="1" step="0.01" value="${music.el.volume}"></label>
    <h3>Sharing data with the project</h3>
    ${telOptionsHtml()}
    <div id="ghSection" class="${ghMenus() ? '' : 'hide'}">
    <label class="chk big"><input type="checkbox" id="ghEnabled" ${gh.enabled ? 'checked' : ''}> Upload calibration data to GitHub</label>
    <div class="optExplain">
      <p><b>What it does:</b> when you fly <i>Trick Calibration</i>, every rep you confirm is recorded — the flight path and rotations, your ✓/✗ labels, what the trick detector decided, and your craft and tune. With this on, those recordings are uploaded to the project repo <code>${gh.owner}/${gh.repo}</code> in the <code>calibration/</code> folder: one file each time a trick reaches 5 reps, and the whole session when a round is finished (or when you press ↑ Upload).</p>
      <p><b>Why:</b> so Claude can pull the data whenever you ask, replay your real flights through the detector, see where it disagrees with you, and tune the trick rules to how pilots actually fly.</p>
      <p><b>What's not sent:</b> no personal details, no radio or device info, and never your access token. Free flying is only shared if you turn on flight telemetry above. Off by default — with it off, data stays in this browser and you can still export a file by hand.</p>
    </div>
    <label class="chk big"><input type="checkbox" id="bbEnabled" ${gh.bbEnabled ? 'checked' : ''}> Upload Blackbox logs to GitHub</label>
    <div class="optExplain">
      <p><b>What it does:</b> in <i>Blackbox Lab</i>, after you download the logs from your quad over USB (or pick log files from your computer), the ↑ Upload button sends them to <code>${gh.owner}/${gh.repo}</code> in the <code>blackbox/</code> folder — the raw log, your <code>diff all</code> settings, and the optional build sheet about your parts.</p>
      <p><b>Why:</b> Blackbox logs show exactly how your real quad responds to your sticks. Claude can replay them against the sim to fit the motor, prop, weight and drag numbers so the sim flies like your whoop.</p>
      <p><b>What's not sent:</b> nothing uploads until you press ↑ Upload; never your access token. The build sheet is optional.</p>
    </div>
    <div id="ghFields" class="${gh.enabled || gh.bbEnabled ? '' : 'hide'}">
      <label>Repo owner<input id="ghOwner" value="${gh.owner}"></label>
      <label>Repo name<input id="ghRepo" value="${gh.repo}"></label>
      <label>Branch<input id="ghBranch" value="${gh.branch}"></label>
      <label>Access token<input id="ghToken" type="password" autocomplete="off" placeholder="github_pat_…" value="${gh.token ? '••••••••' : ''}"></label>
      <div class="row"><button id="ghSave">Save &amp; test</button><button id="ghForget" class="ghost">Forget token</button></div>
      <p id="ghMsg" class="note">${gh.token ? '' : 'Add a token to start uploading.'}</p>
      <details><summary>How to make the token (2 minutes)</summary><ol class="bb">
        <li>On GitHub: Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
        <li>Repository access: <b>Only select repositories</b> → ${gh.owner}/${gh.repo}.</li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b>. Nothing else.</li>
        <li>Set an expiry, generate, paste it here. It's kept in this browser only — never in the game file, exports or uploads.</li></ol></details>
      <p class="note">Uploading works from the standalone game file or a hosted copy. The preview inside Claude blocks connections to other sites.</p>
    </div>
    </div>`;
  telRenderStatus();
}
document.addEventListener('change', e => {
  if (e.target.id === 'telOn') telSet(e.target.checked);
  if (e.target.id === 'ghEnabled') { gh.enabled = e.target.checked; saveGh(); $('#ghFields').classList.toggle('hide', !(gh.enabled || gh.bbEnabled)); renderGhStatus(); }
  if (e.target.id === 'optVol') { store.set('vol', +e.target.value); if (window._master) window._master.gain.value = +e.target.value; const v = $('#vol'); if (v) v.value = e.target.value; }
});
document.addEventListener('input', e => { if (e.target.id === 'optMusic') { music.el.volume = +e.target.value; store.set('musicVol', music.el.volume); const m = $('#mVol'); if (m) m.value = e.target.value; } });
document.addEventListener('click', async e => {
  if (e.target.id === 'ghSave') {
    gh.owner = $('#ghOwner').value.trim(); gh.repo = $('#ghRepo').value.trim(); gh.branch = $('#ghBranch').value.trim() || 'main';
    const tk = $('#ghToken').value.trim(); if (tk && !/^•+$/.test(tk)) gh.token = tk; saveGh();
    $('#ghMsg').textContent = 'Testing…'; $('#ghMsg').textContent = await ghTest(); renderGhStatus();
  }
  if (e.target.id === 'ghForget') { gh.token = ''; saveGh(); $('#ghToken').value = ''; $('#ghMsg').textContent = 'Token removed from this browser.'; renderGhStatus(); }
  if (e.target.closest('[data-act="sync"]') || e.target.closest('[data-act="options"]')) openOptions();
  if (e.target.closest('[data-act="optclose"]')) { if (train.pausedForList) closeChecklist(); else show(mode === 'menu' ? '#mainMenu' : '#pause'); }
  const b = e.target.closest('[data-tr="upload"]'); if (b) { if (!gh.enabled || !gh.token) openOptions(); else { uploadRun('manual'); train.msg = 'Uploading this session…'; renderTrain(); } }
});

