// ============================================================ GitHub sync: upload calibration data to the project repo
// The token lives only in this browser (localStorage). It is never put in the game file or in exports.
// Use a fine-grained token limited to the one repo with "Contents: Read and write".
const gh = Object.assign(
  { owner: 'heyheykoolaid', repo: 'openprowhooper', branch: 'main', token: '', enabled: false, bbEnabled: false },
  store.get('ghsync', {})
);
const ghState = { queue: [], busy: false, last: '', ok: null };
const saveGh = () => store.set('ghsync', gh);
const slug = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function ghFetch(path, init = {}, repo) {
  /* repo: 'owner/name' to aim at one repo whatever Options says (official maps: the game repo) */
  const r = await fetch(`https://api.github.com/repos/${repo || gh.owner + '/' + gh.repo}${path}`, {
    ...init,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${gh.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {})
    }
  });
  let body = null;
  try {
    body = await r.json();
  } catch {}
  return { ok: r.ok, status: r.status, body };
}
async function ghTest() {
  if (!gh.token) return 'Add a token first.';
  try {
    const r = await ghFetch('');
    if (!r.ok)
      return r.status === 404
        ? `Can't see ${gh.owner}/${gh.repo} — check the name, or give the token access to it.`
        : r.status === 401
          ? 'Token rejected (expired or mistyped).'
          : `GitHub said ${r.status}.`;
    return r.body && r.body.permissions && r.body.permissions.push === false
      ? 'Connected, but this token can\'t write. Give it "Contents: Read and write".'
      : `Connected to ${gh.owner}/${gh.repo} ✓`;
  } catch (e) {
    return location.protocol.startsWith('http') && !location.hostname.endsWith('github.io') && !location.hostname.includes('localhost')
      ? "This page isn't allowed to reach GitHub (the Claude preview blocks it). Use the standalone game file."
      : "Couldn't reach GitHub — are you online?";
  }
}
function ghEnqueue(path, payload, message) {
  if (!gh.enabled || !gh.token) return false;
  ghState.queue.push({ path, content: JSON.stringify(payload), message, tries: 0 });
  ghPump();
  return true;
}
async function ghPump() {
  if (ghState.busy || !ghState.queue.length) return;
  ghState.busy = true;
  const job = ghState.queue[0];
  try {
    const r = await ghFetch(`/contents/${job.path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: JSON.stringify({ message: job.message, content: job.contentB64 || b64(job.content), branch: gh.branch })
    });
    if (r.ok) {
      ghState.queue.shift();
      ghState.ok = true;
      ghState.last = `↑ uploaded ${job.path.split('/').slice(-2).join('/')}`;
      if (job.path.startsWith('blackbox/') && !ghState.queue.some(j => j.path.startsWith('blackbox/'))) {
        bb.msg = 'Uploaded to GitHub ✓ — ask Claude to look at your Blackbox logs.';
        renderBB();
      }
    } else {
      job.tries++;
      ghState.ok = false;
      ghState.last = `upload failed (${r.status}${r.body && r.body.message ? ': ' + r.body.message : ''})`;
      if (job.tries >= 3 || r.status === 401 || r.status === 403 || r.status === 404) ghState.queue.shift();
    }
  } catch {
    job.tries++;
    ghState.ok = false;
    ghState.last = 'upload failed (offline or blocked here)';
    if (job.tries >= 3) ghState.queue.shift();
  }
  ghState.busy = false;
  if (train.on) renderTrain();
  renderGhStatus();
  if (ghState.queue.length) setTimeout(ghPump, ghState.ok ? 300 : 4000);
}
// one finished trick (5 reps): just those reps, with the flight around each one
function uploadTrick(name) {
  const labs = run.labels.filter(l => l.target === name && l.round === cal.round && !l.undone);
  if (!labs.length) return;
  const reps = labs.map(l => ({ ...l, trace: run.trace.filter(r => r[0] >= l.repStart - 2 && r[0] <= l.t + 1) }));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(
    `calibration/round-${cal.round}/${slug(name)}/${stamp}-${run.id}.json`,
    {
      format: 'pro-whooper-training/3',
      build: '0.1',
      map: MAP_ID,
      camTilt: tune.camTilt,
      craft: { ...spec },
      tune,
      trick: name,
      round: cal.round,
      agreed: labs.filter(l => l.verdict === 'yes' && l.detected.includes(name)).length,
      examples: reps.map(r => ({ ...r, hz: TRACE_HZ, cols: TRACE_COLS }))
    },
    `calibration: ${name} ×${labs.filter(l => l.verdict === 'yes').length} (round ${cal.round})`
  );
}
function uploadRun(reason) {
  if (!run.id || !run.labels.length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(
    `calibration/round-${cal.round}/sessions/${stamp}-${run.id}.json`,
    {
      format: 'pro-whooper-session/2',
      build: '0.1',
      map: MAP_ID,
      camTilt: tune.camTilt,
      craft: { ...spec },
      tune,
      calib: cal,
      run: {
        id: run.id,
        started: run.started,
        round: run.round,
        hz: TRACE_HZ,
        cols: TRACE_COLS,
        trace: run.trace,
        events: run.events,
        labels: run.labels
      }
    },
    `calibration session: ${run.labels.length} labels (${reason})`
  );
}
// The GitHub settings and upload buttons are the project owner's tools: shown only to the pilot named heyheykoolaid.
// (This only tidies the menus for everyone else; it is not a lock. Nothing secret is behind it.)
// The owner's menus (owner, 2026-11-19, before sharing the game widely): the name is only a hint; they open with the owner
// key (the Cloudflare secret OWNER_KEY, saved in this browser: store 'ownerKey'), checked once by the drop-off (`ownerVerify`).
// While the drop-off has not been redeployed with /owner (it answers 404), or in a copy with no drop-off, the name still
// does, as before (store 'ownerOk' = { legacy: true }). `keyTag` only ties the check to the key it was made with.
const OWNER_NAME = 'heyheykoolaid',
  nameOwner = () => pilotName().toLowerCase() === OWNER_NAME;
const keyTag = k => {
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) {
    h ^= k.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
};
function ghMenus() {
  if (!nameOwner()) return false;
  const ok = store.get('ownerOk', null),
    key = store.get('ownerKey', '');
  return !!ok && (ok.legacy === true || (!!key && ok.k === keyTag(key)));
}
function renderGhStatus() {
  const el = $('#ghStatus');
  if (el)
    el.textContent = !ghMenus()
      ? ''
      : !gh.enabled
        ? 'upload off (Options)'
        : gh.token
          ? ghState.queue.length
            ? `uploading… (${ghState.queue.length} left)`
            : ghState.last || `ready → ${gh.owner}/${gh.repo}`
          : 'not set up';
}
function openOptions() {
  show('#optionsScreen');
  if (mode === 'fly') {
    mode = 'paused';
    train.pausedForList = true;
  }
  $('#optBody').innerHTML = `
    <h3>Sound</h3>
    <label>Motor sound<input id="optVol" type="range" min="0" max="1" step="0.01" value="${store.get('vol', 0.25)}"></label>
    <label>Music<input id="optMusic" type="range" min="0" max="1" step="0.01" value="${music.el.volume}"></label>
    <h3>Graphics</h3>
    <div class="row"><button data-gfx="low" title="Shadows, glow and screen effects off, 4 map lights, render resolution 70%">Low graphics (slower computers)</button><button data-gfx="normal" class="ghost" title="Shadows, glow and screen effects on, map lights Auto, resolution Auto">Normal graphics</button></div>
    <label class="chk big"><input type="checkbox" id="optBloom" ${BLOOM.on ? 'checked' : ''}> Neon glow on the Vaporwave School</label>
    <label class="chk big"><input type="checkbox" id="optShadows" ${PERF.shadows ? 'checked' : ''}> Shadows <small>(off is much lighter on slower computers)</small></label>
    <label class="chk big"><input type="checkbox" id="optFx" ${PERF.fx ? 'checked' : ''}> Screen effects <small>(vignette and scanlines)</small></label>
    <label class="chk big"><input type="checkbox" id="optDetW" ${store.get('detWorker', true) ? 'checked' : ''}> Trick detection on its own core <small>(smoother on slower computers; untick if tricks stop being called, then tell us)</small></label>
    <label class="chk big"><input type="checkbox" id="optLowLat" ${store.get('lowLatency', false) ? 'checked' : ''}> Low-latency display <small>(about a frame less input lag where the browser supports it; may tear; applies after a reload)</small></label>
    <label title="The map's lamps as real lights. Each one costs frame rate everywhere on screen (More Warehouse has 11). Auto drops to Few if the first seconds of flying run under 50 fps.">Map lights <select id="optLights">${[
      ['auto', 'Auto'],
      ['full', 'Full'],
      ['few', 'Few (4)'],
      ['off', 'Off']
    ]
      .map(([v, l]) => `<option value="${v}" ${PERF.lights === v ? 'selected' : ''}>${l}</option>`)
      .join('')}</select></label>
    <label>Render resolution <select id="optRes"><option value="auto" ${PERF.resAuto ? 'selected' : ''}>Auto (drops when the frame rate does)</option>${[
      [1, '100%'],
      [0.85, '85%'],
      [0.7, '70%'],
      [0.5, '50%']
    ]
      .map(([v, l]) => `<option value="${v}" ${!PERF.resAuto && Math.abs(PERF.res - v) < 0.01 ? 'selected' : ''}>${l}</option>`)
      .join('')}</select></label>
    <p class="note">Graphics card: ${esc(GPU || 'unknown')}${GPU_SOFT ? ' — <b style="color:#ff8b7d">the browser is drawing without your graphics card (hardware acceleration is off)</b>: Chrome / Edge: Settings → System → "Use graphics acceleration when available", then relaunch. Firefox: Settings → General → Performance.' : ''}</p>
    <label class="chk big" title="Frame rate, where the time goes (physics, trick detection, drawing, the rest), draw calls, resolution and memory"><input type="checkbox" id="optPerf" ${PERF.on ? 'checked' : ''}> Performance overlay <small>(F3)</small></label>
    <label class="chk big" title="A green outline and the letter over the objects named for today's A and D, until you take the letter"><input type="checkbox" id="optKwGlow" ${store.get('kwadGlow', true) ? 'checked' : ''}> Highlight today's K.W.A.D. objects</label>
    <label class="chk big" title="The trick library's guesses (never scored) always wait for you in SKITTLES mode; this also shows them on screen while you fly"><input type="checkbox" id="optMaybe" ${store.get('maybeFlash', false) ? 'checked' : ''}> Show "maybe" guesses while flying</label>
    <p class="note">Turn it off if the game runs slowly on that map.</p>
    <label class="chk big"><input type="checkbox" id="optPass" ${passUI.on ? 'checked' : ''}> Show what counted while flying (over / under / gap / pole) — Z</label>
    <h3>Sharing data with the project</h3>
    ${telOptionsHtml()}
    <div id="learnBox">${learnHtml()}</div>
    ${nameOwner() ? `<h3>Owner</h3><div class="row"><input id="optOwnerKey" type="password" placeholder="${store.get('ownerKey', '') ? 'owner key saved' : 'owner key'}" autocomplete="off"><button data-owner="save">Save</button>${store.get('ownerKey', '') ? '<button data-owner="forget" class="ghost">Forget</button>' : ''}</div><p class="note" id="ownerMsg">${ownerStatus()}</p>` : ''}
    <div id="ghSection" class="${ghMenus() ? '' : 'hide'}">
    <label class="chk big"><input type="checkbox" id="ghEnabled" ${gh.enabled ? 'checked' : ''}> Upload calibration data to GitHub</label>
    <details class="optExplain"><summary>What it does, why, and what is not sent</summary>
      <p><b>What it does:</b> when you fly <i>Trick Calibration</i>, every rep you confirm is recorded — the flight path and rotations, your ✓/✗ labels, what the trick detector decided, and your craft and tune. With this on, those recordings are uploaded to the project repo <code>${gh.owner}/${gh.repo}</code> in the <code>calibration/</code> folder: one file each time a trick reaches 5 reps, and the whole session when a round is finished (or when you press ↑ Upload).</p>
      <p><b>Why:</b> so Claude can pull the data whenever you ask, replay your real flights through the detector, see where it disagrees with you, and tune the trick rules to how pilots actually fly.</p>
      <p><b>What's not sent:</b> no personal details, no radio or device info, and never your access token. Free flying is only shared if you turn on flight telemetry above. Off by default — with it off, data stays in this browser and you can still export a file by hand.</p>
    </details>
    <div id="ghFields" class="${gh.enabled ? '' : 'hide'}">
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
  if (e.target.id === 'optKwGlow') store.set('kwadGlow', e.target.checked);
  if (e.target.id === 'optPass') {
    passUI.on = e.target.checked;
    store.set('passFeed', passUI.on);
  }
  if (e.target.id === 'optBloom') {
    BLOOM.on = e.target.checked;
    store.set('bloom', BLOOM.on);
  }
  if (e.target.id === 'optShadows') {
    PERF.shadows = e.target.checked;
    store.set('shadows', PERF.shadows);
    perfApply();
  }
  if (e.target.id === 'optLights') {
    PERF.lights = e.target.value;
    store.set('mapLights', PERF.lights);
    PERF.lightsAuto = null;
    LA.t = 0;
    LA.t0 = 0;
    LA.n = 0;
    mapLightsBuild();
  }
  if (e.target.id === 'optRes') {
    PERF.resAuto = e.target.value === 'auto';
    PERF.res = PERF.resAuto ? 1 : +e.target.value || 1;
    store.set('renderScale', PERF.resAuto ? 'auto' : PERF.res);
    perfApply();
  }
  if (e.target.id === 'optPerf') perfToggle(e.target.checked);
  if (e.target.id === 'optFx') {
    PERF.fx = e.target.checked;
    store.set('screenFx', PERF.fx);
  }
  if (e.target.id === 'optDetW') {
    store.set('detWorker', e.target.checked);
    if (e.target.checked) {
      DW.dead = false;
      dwStart();
    } else dwStop(false);
    flash(`<b>TRICK DETECTION ${DW.on ? 'ON ITS OWN CORE' : 'IN THE PAGE'}</b>`, 'near');
  }
  if (e.target.id === 'optLowLat') {
    store.set('lowLatency', e.target.checked);
    flash(`<b>LOW-LATENCY DISPLAY ${e.target.checked ? 'ON' : 'OFF'}</b><small>reload the page to apply it</small>`, 'near');
  }
  if (e.target.id === 'optMaybe') store.set('maybeFlash', e.target.checked);
  if (e.target.id === 'ghEnabled') {
    gh.enabled = e.target.checked;
    saveGh();
    $('#ghFields').classList.toggle('hide', !gh.enabled);
    renderGhStatus();
  }
  if (e.target.id === 'optVol') {
    store.set('vol', +e.target.value);
    if (window._master) window._master.gain.value = +e.target.value;
    const v = $('#vol');
    if (v) v.value = e.target.value;
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'optMusic') {
    music.el.volume = +e.target.value;
    store.set('musicVol', music.el.volume);
    const m = $('#mVol');
    if (m) m.value = e.target.value;
  }
});
document.addEventListener('click', async e => {
  if (e.target.id === 'ghSave') {
    gh.owner = $('#ghOwner').value.trim();
    gh.repo = $('#ghRepo').value.trim();
    gh.branch = $('#ghBranch').value.trim() || 'main';
    const tk = $('#ghToken').value.trim();
    if (tk && !/^•+$/.test(tk)) gh.token = tk;
    saveGh();
    $('#ghMsg').textContent = 'Testing…';
    $('#ghMsg').textContent = await ghTest();
    renderGhStatus();
  }
  if (e.target.id === 'ghForget') {
    gh.token = '';
    saveGh();
    $('#ghToken').value = '';
    $('#ghMsg').textContent = 'Token removed from this browser.';
    renderGhStatus();
  }
  if (e.target.closest('[data-act="sync"]') || e.target.closest('[data-act="options"]')) openOptions();
  if (e.target.closest('[data-act="optclose"]')) {
    if (train.pausedForList) closeChecklist();
    else show(mode === 'menu' ? '#mainMenu' : '#pause');
  }
  const b = e.target.closest('[data-tr="upload"]');
  if (b) {
    if (!gh.enabled || !gh.token) openOptions();
    else {
      uploadRun('manual');
      train.msg = 'Uploading this session…';
      renderTrain();
    }
  }
});
