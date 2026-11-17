// ============================================================ input
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; onKey(e); });
addEventListener('keyup', e => { keys[e.code] = false; });
// Separate profiles: keyboard, radio (EdgeTX/OpenTX/etc. in USB joystick mode), gamepad (Xbox/PS/etc.)
const AX4 = ['thr', 'yaw', 'pitch', 'roll'];
const defAxes = (thr, yaw, pitch, roll, invP, invT) => ({ thr: { i: thr, inv: !!invT, min: -1, max: 1 }, yaw: { i: yaw, inv: false, min: -1, max: 1 }, pitch: { i: pitch, inv: !!invP, min: -1, max: 1 }, roll: { i: roll, inv: false, min: -1, max: 1 } });
const DEFAULT_INPUT = {
  mode: 'keyboard',
  radio:   { device: null, axes: defAxes(2, 3, 1, 0, false, false), arm: { type: 'axis', i: 4, th: 0.5 }, reset: { type: 'axis', i: 5, th: 0.5 }, deadband: 0.005 },
  gamepad: { device: null, axes: defAxes(1, 0, 3, 2, true, true), arm: { type: 'button', i: 0, toggle: true }, reset: { type: 'button', i: 3 }, deadband: 0.06, thrCentered: false },
};
function loadInput() {
  const s = store.get('input', null); const d = JSON.parse(JSON.stringify(DEFAULT_INPUT));
  if (!s) return d;
  if (s.axes && !s.radio) { d.radio.axes = s.axes; if (d.radio.axes.pitch) d.radio.axes.pitch.inv = false; d.radio.arm = s.arm || d.radio.arm; d.radio.reset = s.reset || d.radio.reset; d.mode = s.mode === 'gamepad' ? 'radio' : 'keyboard'; return d; } // migrate v0.1
  return { ...d, ...s, radio: { ...d.radio, ...(s.radio || {}) }, gamepad: { ...d.gamepad, ...(s.gamepad || {}) } };
}
let inputCfg = loadInput();
const saveInput = () => store.set('input', inputCfg);
const prof = () => inputCfg[inputCfg.mode] || null;

// ---- device identification
const USB_VENDORS = {
  '1209': 'pid.codes (EdgeTX / OpenTX)', '0483': 'STMicro (OpenTX / FrSky / Jumper)', '1781': 'FrSky', '2b90': 'RadioMaster',
  '045e': 'Microsoft (Xbox)', '054c': 'Sony (PlayStation)', '057e': 'Nintendo', '28de': 'Valve (Steam)', '046d': 'Logitech', '2dc8': '8BitDo', '0f0d': 'Hori',
};
const USB_PRODUCTS = { '1209:4f54': 'EdgeTX / OpenTX USB joystick', '0483:5710': 'OpenTX USB joystick' };
const RADIO_HINT = /edgetx|opentx|radio|joystick|taranis|frsky|jumper|radiomaster|boxer|zorro|pocket|tx1[26]|tx15|t-?lite|t-?pro|t20|t14|t8sg|betafpv|literadio|helloradiosky|v1[0-9]\b|flysky|elrs|crossfire|tango|mambo|x9d|x9 lite|x-lite|qx7|commando|spektrum|dx\d/i;
const PAD_HINT = /xbox|xinput|dualshock|dualsense|wireless controller|playstation|switch pro|joy-con|8bitdo|gamepad|controller|steam/i;
function describePad(p) {
  if (!p) return null;
  let name = p.id, vendor = null, product = null;
  let m = p.id.match(/^(.*?)\s*\(\s*(?:STANDARD GAMEPAD\s*)?Vendor:\s*([0-9a-f]{4})\s*Product:\s*([0-9a-f]{4})\s*\)\s*$/i); // Chrome/Edge
  if (m) { name = m[1]; vendor = m[2].toLowerCase(); product = m[3].toLowerCase(); }
  else if ((m = p.id.match(/^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.*)$/i))) { vendor = m[1].padStart(4, '0').toLowerCase(); product = m[2].padStart(4, '0').toLowerCase(); name = m[3]; } // Firefox
  name = name.replace(/\b(USB\s*)?Joystick\b/i, '').replace(/\s{2,}/g, ' ').trim() || p.id;
  const key = vendor && product ? `${vendor}:${product}` : null;
  const isRadio = (key && USB_PRODUCTS[key]) || vendor === '1209' || vendor === '0483' || vendor === '1781' || vendor === '2b90' || (RADIO_HINT.test(p.id) && !PAD_HINT.test(p.id) && p.mapping !== 'standard');
  const kind = isRadio ? 'radio' : (p.mapping === 'standard' || PAD_HINT.test(p.id)) ? 'gamepad' : 'radio';
  return { name, vendor, product, firmware: key ? (USB_PRODUCTS[key] || USB_VENDORS[vendor] || 'unknown vendor') : null, kind, axes: p.axes.length, buttons: p.buttons.length, id: p.id, index: p.index };
}
const allPads = () => (navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []);
function readPad(kind = inputCfg.mode) {
  const P = inputCfg[kind]; if (!P) return null; const pads = allPads();
  return pads.find(p => p.id === P.device) || pads.find(p => describePad(p).kind === kind) || null;
}
const kb = { thr: 0, yaw: 0, pitch: 0, roll: 0 };
let armSeen = null, armMovedAt = -1e9, resetAskAt = 0;
let resetPrev = false, armBtnPrev = false, crashLock = false, armBlock = '';
const ARM_THR_MAX = 0.08;
// safe to arm: throttle at the bottom, or (3D mode, where the middle of the stick is zero thrust) in the middle
// Take off without arming, an OPTION in Controls (it was the default for an hour; the pilot found it got in the way of
// Slide Disarms, so arming is required again unless this is switched on): with the quad disarmed and the
// throttle seen at rest (bottom, or the middle in 3D mode), raising it arms and flies. Disarming still works as before
// (switch off / Space / arm button), and after a disarm the throttle has to come back to rest before it can arm again,
// so a Slide Disarm is: disarm, slide, throttle down and up again. Controls has the switch to turn this off.
const autoArmOn = () => store.get('autoArm', false) === true;   // off by default: you arm to fly (pilot: with it on, Slide Disarms got harder)
let armSwWas = null, armReady = false;
function autoArmTick() {
  if (!autoArmOn() || mode !== 'fly' || drone.armed) { if (drone.armed) armReady = false; return; }
  if (drone.crashed) { armReady = false; return; }                      // crashes re-arm their own way (throttle to rest)
  const thr = lastRC.thr, is3d = tune.flightMode === '3d';
  if (thrArmOk(thr)) armReady = true;
  else if (armReady && (is3d ? Math.abs(thr - 0.5) > 0.1 && thr > 0.12 : thr > 0.12)) { armReady = false; setArmed(true, true); }
}
const thrArmOk = thr => thr <= ARM_THR_MAX || (tune.flightMode === '3d' && Math.abs(thr - 0.5) <= 0.07);
// Flight modes, as on a mode switch: 1 acro, 2 angle (self-levelling), 3 3D (reversible motors: stick middle = no thrust)
const FLIGHT_MODES = [['acro', 'ACRO', 'rate mode'], ['angle', 'ANGLE', 'self-levelling, lean limit 55°'], ['3d', 'METALCRAFT', 'throttle middle = zero · below = reverse thrust']];
function setFlightMode(m) { const F = FLIGHT_MODES.find(x => x[0] === m); if (!F || (tune.flightMode || 'acro') === m) return; tune.flightMode = m; store.set('tune', tune);
  const props3d = S.PARTS.props[spec.prop] && S.PARTS.props[spec.prop].rev > 0.8;
  flash(`<b>${F[1]} MODE</b><small>${F[2]}${m === '3d' && drone.armed ? ' · centre the throttle to start' : ''}${m === '3d' && !props3d ? ' · these props push about half as hard backward (3D props in the Garage)' : ''}</small>`, m === '3d' ? 'metal' : ''); }
function axisVal(pad, a) { if (!pad || pad.axes[a.i] === undefined) return 0; let v = pad.axes[a.i]; v = ((v - a.min) / ((a.max - a.min) || 1)) * 2 - 1; v = Math.max(-1, Math.min(1, v)); return a.inv ? -v : v; }
function switchOn(pad, s) { return s.type === 'axis' ? (pad.axes[s.i] ?? -1) > (s.th ?? 0.5) : !!(pad.buttons[s.i] && pad.buttons[s.i].pressed); }
function getRC(dt) {
  const P = prof(); const pad = P ? readPad() : null;
  if (P && pad) {
    const A = P.axes;
    let thr = axisVal(pad, A.thr);
    const rc = { thr: P.thrCentered ? Math.max(0, thr) : (thr + 1) / 2, yaw: axisVal(pad, A.yaw), pitch: axisVal(pad, A.pitch), roll: axisVal(pad, A.roll) };
    lastRC = rc;
    for (const k of ['yaw', 'pitch', 'roll']) if (Math.abs(rc[k]) < P.deadband) rc[k] = 0; else rc[k] = Math.sign(rc[k]) * (Math.abs(rc[k]) - P.deadband) / (1 - P.deadband);
    if (P.arm.toggle) { const b = switchOn(pad, P.arm); if (b && !armBtnPrev) setArmed(!drone.armed); armBtnPrev = b; }
    else {
      // Switch arming: armed while the switch is on and throttle was low when it armed.
      // After a crash the switch can stay on: zero throttle rights the quad and re-arms it (play.js).
      // With take-off-without-arming on (the default), switching OFF disarms once (on the flick), so a quad that was
      // armed by raising the throttle is not shut down again just because the switch happens to be off.
      const sw = switchOn(pad, P.arm), fell = armSwWas === true && !sw; armSwWas = sw;
      if (!sw) { crashLock = false; if (drone.armed && (fell || !autoArmOn())) setArmed(false); armBlock = drone.armed ? '' : autoArmOn() ? 'THROTTLE UP TO TAKE OFF' : 'ARM SWITCH OFF'; }
      else if (!drone.armed) {
        if (drone.crashed) { crashLock = true; armBlock = tune.flightMode === '3d' ? 'CRASHED · THROTTLE TO THE MIDDLE TO GO AGAIN' : 'CRASHED · THROTTLE TO ZERO TO GO AGAIN'; }
        else if (!thrArmOk(rc.thr)) armBlock = `THROTTLE HIGH (${Math.round(rc.thr * 100)}%) · ${tune.flightMode === '3d' ? 'CENTRE OR LOWER' : 'LOWER'} TO ARM`;
        else { armBlock = ''; setArmed(true); }
      } else armBlock = '';
    }
    // Reset switch. Arming must never send you back to the start (it would undo a Slide Disarm): a reset control that is
    // the same switch as arm is ignored, and so is a reset that fires in the same moment as the arm switch moves
    // (two channels driven by one switch on the radio). The R key always resets.
    { const sameAsArm = P.reset && P.arm && P.reset.type === P.arm.type && P.reset.i === P.arm.i, swNow = switchOn(pad, P.arm), nowT = performance.now();
      if (swNow !== armSeen) { armSeen = swNow; armMovedAt = nowT; }
      const rp = !sameAsArm && P.reset && P.reset.enabled === true && switchOn(pad, P.reset);   // off unless the pilot turns it on in Controls: only the R key resets (pilot: disarming kept sending the whoop back to the start) if (rp && !resetPrev) resetAskAt = nowT; resetPrev = rp;
      if (resetAskAt && nowT - resetAskAt > 150) { const withArm = Math.abs(resetAskAt - armMovedAt) < 400; resetAskAt = 0; if (!withArm) respawn(); } }
    return rc;
  }
  const ramp = (cur, tgt, rate) => cur + Math.max(-rate * dt, Math.min(rate * dt, tgt - cur));
  kb.yaw = ramp(kb.yaw, (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), 6);
  kb.pitch = ramp(kb.pitch, (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0), 6);
  kb.roll = ramp(kb.roll, (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), 6);
  if (keys.KeyW) kb.thr = Math.min(1, kb.thr + dt * 0.9); if (keys.KeyS) kb.thr = Math.max(0, kb.thr - dt * 1.4);
  if (keys.ShiftLeft || keys.ShiftRight) kb.thr = Math.min(1, kb.thr + dt * 2.5);
  if (keys.KeyX) kb.thr = tune.flightMode === '3d' ? 0.5 : 0;   // throttle cut (3D: back to the middle)
  return { thr: kb.thr, yaw: kb.yaw, pitch: kb.pitch, roll: kb.roll };
}
function onKey(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  if (e.code === 'Escape') { if (mode === 'fly') pause(); else if (mode === 'paused') resume(); }
  if (mode !== 'fly') return;
  if (e.code === 'Digit1') setFlightMode('acro'); if (e.code === 'Digit2') setFlightMode('angle'); if (e.code === 'Digit3') setFlightMode('3d');
  if (e.code === 'Space') { e.preventDefault(); setArmed(!drone.armed); }
  if (e.code === 'KeyR') respawn();
  if (e.code === 'KeyT') flipOver();
  if (e.code === 'KeyC') camMode = camMode === 'fpv' ? 'chase' : 'fpv';
  if (e.code === 'Tab') { e.preventDefault(); $('#breakdown').classList.toggle('hide'); }
  if (e.code === 'KeyB' && race.on && race.fromEditor) { backToEditor(); return; }
  if (e.code === 'KeyV') { stickUI.on = !stickUI.on; store.set('ui.sticks', stickUI.on); }   // V: stick overlay
}
let lastRC = { thr: 0, roll: 0, pitch: 0, yaw: 0 };
// ---- stick overlay (Mode 2: left = throttle/yaw, right = pitch/roll), with a short fading trail ("ghost" of the last
// half second) so you can see how the sticks moved through a trick. Shared by the fly HUD, Video Review and Blackbox Replay.
const stickUI = { on: store.get('ui.sticks', true), trail: [] };
function drawSticks(cv, rc, trail, opts = {}) {
  if (!cv) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  const s = Math.min(H - 12, W / 2 - 18), pads = [[W / 4, H / 2], [W * 3 / 4, H / 2]];
  const xy = (r, k) => k === 0 ? [r.yaw, (r.thr ?? 0) * 2 - 1] : [r.roll, r.pitch];
  for (let k = 0; k < 2; k++) {
    const [cx, cy] = pads[k];
    g.fillStyle = 'rgba(8,10,14,0.55)'; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(cx - s / 2, cy - s / 2, s, s, 10); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.moveTo(cx - s / 2, cy); g.lineTo(cx + s / 2, cy); g.moveTo(cx, cy - s / 2); g.lineTo(cx, cy + s / 2); g.stroke();
    const P = r => { const [x, y] = xy(r, k); return [cx + Math.max(-1, Math.min(1, x)) * (s / 2 - 6), cy - Math.max(-1, Math.min(1, y)) * (s / 2 - 6)]; };
    if (trail && trail.length > 1) { for (let i = 1; i < trail.length; i++) { const a = P(trail[i - 1]), b = P(trail[i]); g.strokeStyle = `rgba(255,190,90,${(i / trail.length) * 0.75})`; g.lineWidth = 2.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    if (opts.ghost) { const [gx, gy] = P(opts.ghost); g.strokeStyle = 'rgba(120,200,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(gx, gy, 6, 0, 7); g.stroke(); }
    const [px, py] = P(rc); g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(px, py, 6, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '10px ui-monospace, monospace'; g.textAlign = 'center';
  g.fillText(opts.label || `THR ${Math.round((rc.thr ?? 0) * 100)}%`, W / 4, H - 1); g.fillText(opts.label2 || 'P/R', W * 3 / 4, H - 1);
}
function stickHud(rc) {
  const cv = $('#stickView'); cv.classList.toggle('off', !stickUI.on); if (!stickUI.on) return;
  stickUI.trail.push({ thr: rc.thr, yaw: rc.yaw, pitch: rc.pitch, roll: rc.roll }); if (stickUI.trail.length > 30) stickUI.trail.shift();
  drawSticks(cv, rc, stickUI.trail);
}
function setArmed(on, byThrottle) {
  if (on) {
    if (!byThrottle && !thrArmOk(lastRC.thr)) { flash(`<b>THROTTLE HIGH</b><small>${Math.round(lastRC.thr * 100)}% — lower it fully to arm</small>`, 'warn'); return; }
    if (drone.crashed) { flipOver(); }
    drone.crashed = false; drone.armed = true; detector.onArmChange(drone, true);
    if (session && !session.started) session.started = true;
  } else { drone.armed = false; detector.onArmChange(drone, false); }
}
function flipOver() { // "turtle mode" simplified: right the quad where it lies
  const f = drone.fwd(); const yaw = Math.atan2(-f.x, -f.z);
  drone.q = S.qaxis(S.v3(0, 1, 0), yaw); drone.w = S.v3(); drone.vel = S.v3(); drone.pos.y = Math.max(drone.pos.y, 0.03); drone.crashed = false; drone.fc.reset();
}
function respawn() { if (race.on) { raceRespawn(); return; } drone.reset(activeWorld.spawn, true); detector.reset(); crashLock = false; }

