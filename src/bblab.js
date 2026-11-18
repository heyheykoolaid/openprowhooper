// ============================================================ Blackbox Lab: USB dump of the flight controller's log flash
// Talks Betaflight's MSP protocol over Web Serial (Chrome/Edge desktop), like Betaflight Configurator does.
const MSP = { API_VERSION: 1, FC_VARIANT: 2, FC_VERSION: 3, BOARD_INFO: 4, NAME: 10, DATAFLASH_SUMMARY: 70, DATAFLASH_READ: 71 };
class MspPort {
  constructor(port) { this.port = port; this.buf = []; this.waiters = []; this.text = ''; this.textMode = false; }
  async open() {
    await this.port.open({ baudRate: 115200, bufferSize: 65536 });
    this.writer = this.port.writable.getWriter(); this.reader = this.port.readable.getReader(); this.reading = this.readLoop();
  }
  async readLoop() {
    try { for (;;) { const { value, done } = await this.reader.read(); if (done) break; if (!value) continue;
      if (this.textMode) { this.text += new TextDecoder().decode(value); continue; }
      for (const b of value) this.buf.push(b); this.parse(); } } catch {}
  }
  parse() {
    for (;;) {
      const i = this.buf.indexOf(0x24); if (i < 0) { this.buf.length = 0; return; } if (i > 0) this.buf.splice(0, i);
      if (this.buf.length < 6) return;
      if (this.buf[1] !== 0x4d || (this.buf[2] !== 0x3e && this.buf[2] !== 0x21)) { this.buf.shift(); continue; }
      let size = this.buf[3], cmd = this.buf[4], hdr = 5, ck = size ^ cmd;
      if (size === 255) { if (this.buf.length < 7) return; size = this.buf[5] | (this.buf[6] << 8); ck ^= this.buf[5] ^ this.buf[6]; hdr = 7; } // jumbo frame
      if (this.buf.length < hdr + size + 1) return;
      const payload = this.buf.slice(hdr, hdr + size); for (const b of payload) ck ^= b;
      const okSum = ck === this.buf[hdr + size], err = this.buf[2] === 0x21;
      this.buf.splice(0, hdr + size + 1);
      const w = this.waiters.findIndex(x => x.cmd === cmd);
      if (w >= 0) { const x = this.waiters.splice(w, 1)[0]; if (!okSum) x.reject(new Error('checksum')); else if (err) x.reject(new Error('flight controller rejected command ' + cmd)); else x.resolve(new Uint8Array(payload)); }
    }
  }
  async send(cmd, data = [], timeout = 1500) {
    const bytes = [0x24, 0x4d, 0x3c, data.length, cmd, ...data]; let ck = data.length ^ cmd; for (const b of data) ck ^= b; bytes.push(ck);
    const p = new Promise((resolve, reject) => { const x = { cmd, resolve, reject }; this.waiters.push(x); setTimeout(() => { const i = this.waiters.indexOf(x); if (i >= 0) { this.waiters.splice(i, 1); reject(new Error('timeout')); } }, timeout); });
    await this.writer.write(new Uint8Array(bytes)); return p;
  }
  async cli(command, quietMs = 1200, maxMs = 15000) {   // enter the CLI, run one command, capture the text
    this.textMode = true; this.text = '';
    const enc = s => new TextEncoder().encode(s);
    await this.writer.write(enc('#')); await sleep(400); this.text = '';
    await this.writer.write(enc(command + '\n'));
    const t0 = performance.now(); let last = this.text.length, quietSince = performance.now();
    while (performance.now() - t0 < maxMs) { await sleep(100); if (this.text.length !== last) { last = this.text.length; quietSince = performance.now(); } else if (performance.now() - quietSince > quietMs && this.text.length) break; }
    const out = this.text; try { await this.writer.write(enc('exit\n')); } catch {}   // leaving the CLI reboots the FC
    return out.replace(/^.*?\n/, '').replace(/\n#\s*$/, '').trim();
  }
  async close() { try { this.reader.cancel(); } catch {} try { this.reader.releaseLock(); } catch {} try { this.writer.releaseLock(); } catch {} try { await this.port.close(); } catch {} }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const u32 = (a, o) => (a[o] | (a[o + 1] << 8) | (a[o + 2] << 16) | (a[o + 3] << 24)) >>> 0;
const u16 = (a, o) => a[o] | (a[o + 1] << 8);
const bb = { msp: null, info: null, flash: null, log: null, diff: null, busy: false, msg: '', progress: 0, files: [] };
async function bbConnect() {
  if (!('serial' in navigator)) { bb.msg = 'This browser can\'t talk to USB devices here. Use Chrome or Edge on a computer, with the standalone game file — the preview inside Claude blocks USB.'; renderBB(); return; }
  try {
    const port = await navigator.serial.requestPort(); bb.msp = new MspPort(port); await bb.msp.open(); await sleep(300);
    const api = await bb.msp.send(MSP.API_VERSION), variant = await bb.msp.send(MSP.FC_VARIANT), ver = await bb.msp.send(MSP.FC_VERSION);
    let board = null, name = ''; try { board = await bb.msp.send(MSP.BOARD_INFO); } catch {} try { name = new TextDecoder().decode(await bb.msp.send(MSP.NAME)); } catch {}
    bb.info = { api: `${api[1]}.${api[2]}`, firmware: String.fromCharCode(...variant), version: `${ver[0]}.${ver[1]}.${ver[2]}`, board: board ? String.fromCharCode(...board.slice(0, 4)) : '', craftName: name.trim() };
    const s = await bb.msp.send(MSP.DATAFLASH_SUMMARY);
    bb.flash = { ready: !!(s[0] & 1), supported: !!(s[0] & 2), sectors: u32(s, 1), total: u32(s, 5), used: u32(s, 9) };
    bb.msg = bb.flash.supported ? (bb.flash.used ? `Found ${(bb.flash.used / 1048576).toFixed(2)} MB of logs.` : 'The log flash is empty — go fly with Blackbox on, then come back.') : 'This flight controller has no onboard log flash (it may log to an SD card — upload those files below).';
  } catch (e) { bb.msg = /No port selected/.test(String(e)) ? 'No device picked.' : `Couldn't talk to the flight controller (${e.message || e}). Close Betaflight Configurator if it's open, replug the quad, and try again.`; if (bb.msp) await bb.msp.close(); bb.msp = null; }
  renderBB();
}
async function bbDownload() {
  if (!bb.msp || !bb.flash || !bb.flash.used || bb.busy) return;
  bb.busy = true; bb.progress = 0; bb.msg = 'Downloading logs… keep the quad plugged in.'; renderBB();
  const total = bb.flash.used, out = new Uint8Array(total); let addr = 0, block = 4096, fails = 0; const t0 = performance.now();
  while (addr < total) {
    const want = Math.min(block, total - addr);
    try {
      const r = await bb.msp.send(MSP.DATAFLASH_READ, [addr & 255, (addr >> 8) & 255, (addr >> 16) & 255, (addr >>> 24) & 255, want & 255, want >> 8, 0], 2500);
      const a = u32(r, 0); const n = u16(r, 4), comp = r[6];
      if (a !== addr || comp !== 0) throw new Error('unexpected reply');
      if (n === 0) break;
      out.set(r.subarray(7, 7 + n), addr); addr += n; fails = 0;
      bb.progress = addr / total; if ((addr / block) % 16 === 0) renderBB();
    } catch (e) { if (++fails > 6) { bb.msg = `Download stopped at ${(addr / 1048576).toFixed(2)} MB (${e.message}). Replug and try again.`; bb.busy = false; renderBB(); return; } if (fails > 2) block = Math.max(256, block >> 1); await sleep(100); }
  }
  bb.log = out.subarray(0, addr); bb.busy = false; bb.progress = 1;
  bb.msg = `Downloaded ${(addr / 1048576).toFixed(2)} MB in ${((performance.now() - t0) / 1000).toFixed(0)} s.`;
  renderBB();
}
async function bbDiff() {
  if (!bb.msp || bb.busy) return; bb.busy = true; bb.msg = 'Reading diff all… (the quad reboots afterwards)'; renderBB();
  try { bb.diff = await bb.msp.cli('diff all'); bb.msg = `Read ${bb.diff.split('\n').length} lines of settings. The flight controller is rebooting — reconnect to download more.`;
    const r = S.importDiff(bb.diff, tune); if (r.found.length) bb.msg += ` (${r.found.length} rates/PID settings recognised — apply them in Garage → Tune.)`; }
  catch (e) { bb.msg = `Couldn't read the settings (${e.message || e}).`; }
  await bb.msp.close(); bb.msp = null; bb.busy = false; renderBB();
}
function bbBaseName() { const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'); const nm = (bb.info && (bb.info.craftName || bb.info.board)) || spec.frame; return `${d}-${slug(nm || 'whoop')}`; }
async function bbSaveLocal() {
  const base = bbBaseName(); const files = [];
  if (bb.log) files.push({ name: base + '.bbl', data: new Blob([bb.log]) }); if (bb.diff) files.push({ name: base + '-diff.txt', data: new Blob([bb.diff]) });
  const sheet = store.get('buildSheet', {});
  if (files.length && Object.keys(sheet).length) files.push({ name: base + '-build.json', data: new Blob([JSON.stringify({ format: 'pro-whooper-blackbox/1', saved: new Date().toISOString(), fc: bb.info, gameCraft: { ...spec, names: params.names }, buildSheet: sheet }, null, 2)], { type: 'application/json' }) });
  for (const f of files) {
    try { if (window.showSaveFilePicker) { const h = await window.showSaveFilePicker({ suggestedName: f.name }); const w = await h.createWritable(); await w.write(f.data); await w.close(); continue; } } catch (e) { if (e && e.name === 'AbortError') continue; }
    const ok = await saveFile(f.name, f.data); if (!ok) bb.msg = 'Saving files is blocked in this view — use the standalone game file.';
  }
  renderBB();
}
// ---- optional build questionnaire (saved with the logs; pre-filled from the Garage)
function questionnaire() {
  const P = S.PARTS, q = store.get('buildSheet', {});
  const v = (k, d) => q[k] ?? d ?? '';
  return `<details class="qs" ${store.get('buildSheetOpen', true) ? 'open' : ''}><summary>About this quad <small>(optional — helps tune the sim to your real build)</small></summary>
    <div class="grid2">
      <label>Model / kit<input data-q="model" value="${v('model', Object.keys(S.PRESETS).find(k => JSON.stringify(S.PRESETS[k]) === JSON.stringify(spec)) || '')}" placeholder="e.g. Air65 Racing"></label>
      <label>Frame<input data-q="frame" value="${v('frame', P.frames[spec.frame].name)}"></label>
      <label>Motors (model + KV)<input data-q="motors" value="${v('motors', P.motors[spec.motor].name)}"></label>
      <label>Props (model, blades, mm)<input data-q="props" value="${v('props', P.props[spec.prop].name)}"></label>
      <label>Prop condition<select data-q="propCond">${['new', 'a few packs', 'worn / chipped', 'not sure'].map(o => `<option ${v('propCond', 'not sure') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>Battery (mAh, type, brand)<input data-q="battery" value="${v('battery', P.batteries[spec.battery].name)}"></label>
      <label>Connector<select data-q="connector">${['BT2.0', 'PH2.0', 'A30', 'GNB27', 'other'].map(o => `<option ${v('connector', 'BT2.0') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>All-up weight with battery (g)<input data-q="auw" type="number" step="0.1" value="${v('auw', '')}" placeholder="weigh it if you can"></label>
      <label>Camera + angle<input data-q="camera" value="${v('camera', 'C03 · ' + tune.camTilt + '°')}"></label>
      <label>AIO / flight controller<input data-q="aio" value="${v('aio', bb.info ? bb.info.board : '')}"></label>
      <label>Where you flew<select data-q="where">${['indoors', 'outdoors', 'both'].map(o => `<option ${v('where', 'indoors') === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <label>Any mods?<input data-q="mods" value="${v('mods', '')}" placeholder="e.g. lighter canopy, ducts trimmed"></label>
    </div>
    <label>Anything that felt different from the sim?<textarea data-q="notes" placeholder="e.g. real quad drops faster in powerloops; sim feels floaty">${v('notes', '')}</textarea></label>
    </details>`;
}
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.q; if (k) { const q = store.get('buildSheet', {}); q[k] = e.target.value; store.set('buildSheet', q); } });
document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('qs')) store.set('buildSheetOpen', e.target.open); }, true);
function renderBB() {
  const el = $('#bbBody'); if (!el) return;
  const c = !!bb.msp, f = bb.flash;
  el.innerHTML = `
    <p>Plug your whoop into this computer over USB (no battery needed). Close Betaflight Configurator first — only one program can talk to the quad at a time.</p>
    <div class="row"><button id="bbConnect" ${c ? 'disabled' : ''}>${c ? 'Connected' : '1 · Connect over USB'}</button>
      <button id="bbDownload" ${c && f && f.used && !bb.busy ? '' : 'disabled'}>2 · Download logs</button>
      <button id="bbDiff" ${c && !bb.busy ? '' : 'disabled'}>3 · Read diff all</button></div>
    ${bb.info ? `<div class="dev"><b>${esc(bb.info.craftName || 'Flight controller')}</b><span>${esc(bb.info.firmware)} ${esc(bb.info.version)} · board ${esc(bb.info.board || '?')} · MSP ${bb.info.api}${f ? ` · log flash ${(f.used / 1048576).toFixed(2)} / ${(f.total / 1048576).toFixed(1)} MB used` : ''}</span></div>` : ''}
    ${bb.busy || bb.progress ? `<div class="trProg"><i style="width:${(bb.progress * 100).toFixed(1)}%"></i></div>` : ''}
    ${bb.msg ? `<p class="trMsg">${bb.msg}</p>` : ''}
    <h3>Already have log files?</h3>
    <p class="note">Pick .bbl / .bfl / .bbs files (from Betaflight Configurator, an SD card, or the flash in mass-storage mode) and a diff as .txt.</p>
    <input type="file" id="bbFiles" multiple accept=".bbl,.bfl,.bbs,.txt,.csv">${bb.files.length ? ` <span class="note">${bb.files.map(x => esc(x.name)).join(', ')}</span>` : ''}
    ${questionnaire()}
    <div class="row"><button id="bbReplayBtn" ${bb.log || bb.files.some(x => /\.(bbl|bfl|bbs)$/i.test(x.name)) ? '' : 'disabled'}>▶ Replay it in the sim</button><button id="bbSave" ${bb.log || bb.diff ? '' : 'disabled'}>Save to this computer</button></div>
    <p class="note">Downloading doesn't erase anything on the quad.</p>`;
  renderGhStatus();
}
document.addEventListener('click', e => {
  if (e.target.id === 'bbConnect') bbConnect(); if (e.target.id === 'bbDownload') bbDownload(); if (e.target.id === 'bbDiff') bbDiff();
  if (e.target.id === 'bbSave') bbSaveLocal();
  if (e.target.closest('[data-act="blackbox"]')) setTimeout(renderBB, 0);
});
document.addEventListener('change', async e => {
  if (e.target.id === 'bbFiles') { bb.files = await Promise.all([...e.target.files].map(async f => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))); renderBB(); }
});

