// ============================================================ RaceGOW (redesign, 2026-11-18): the race editor, racing, ghosts, sharing
// One file of the game module (shares its scope: scene, drone, MAT, show, store …). The rules and the track format are in
// src/racegow.js (window.RG, pure, Node-tested). No trick scoring while racing: play.js skips the detector when race.on.
const RG = window.RG;
const fmtLap = x => x == null || !isFinite(x) ? '—' : x >= 60 ? `${Math.floor(x / 60)}:${(x % 60).toFixed(2).padStart(5, '0')}` : x.toFixed(2);
const fmtDelta = d => d == null ? '' : (d < 0 ? '−' : '+') + Math.abs(d).toFixed(2);

// ------------------------------------------------------------------ materials
const RGM = {}; const LEDC = { white: 0xffffff, red: 0xff2a2a, orange: 0xff8a1a, yellow: 0xffe14a, green: 0x39ff6a, cyan: 0x33e6ff, blue: 0x3a6bff, purple: 0x9a55ff, pink: 0xff4fcf, black: 0x15161a, grey: 0x7a7d84 };
let rgRoomMatsDone = false;
function rgRoomMats() {   // the rooms' own surfaces (MAT.* names used by RG.ROOMS)
  if (rgRoomMatsDone) return; rgRoomMatsDone = true;
  const mk = (draw, w = 256, h = 256) => { const [c, g] = cnv(w, h); draw(g, w, h); return tex(c); };
  MAT.hardwood = MAT.hardwood || new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { for (let i = 0; i < 8; i++) { const y = i * h / 8; g.fillStyle = `hsl(${28 + rnd() * 6},${42 + rnd() * 10}%,${36 + rnd() * 10}%)`; g.fillRect(0, y, w, h / 8); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 1.5); g.fillRect(rnd() * w, y, 1.5, h / 8); } }), roughness: 0.55 });
  MAT.drywall = MAT.drywall || new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#d9d3c7'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, ['#cfc8bb', '#e2ddd2'], 1, 2, 0.4); }), roughness: 0.95 });
  MAT.ceiling = MAT.ceiling || new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 1 });
  MAT.fabric = MAT.fabric || new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#4a5a6e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['#3f4e60', '#56677c'], 1, 2, 0.6); }), roughness: 1 });
  MAT.darkwood = MAT.darkwood || new THREE.MeshStandardMaterial({ color: 0x3d2a1c, roughness: 0.6 });
  MAT.tv = MAT.tv || new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.15, metalness: 0.4, emissive: 0x0a1630, emissiveIntensity: 0.6 });
  MAT.rug = MAT.rug || new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#7a2b2b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b46a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); }), roughness: 1 });
  MAT.garageFloor = MAT.garageFloor || new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#9c9a95'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['#959390', '#a5a39e', '#8a8884'], 1, 2, 0.35); g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }), roughness: 0.9 });
  MAT.cinder = MAT.cinder || new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#b9b6ad'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,68,62,0.55)'; g.lineWidth = 3; for (let r = 0; r < 4; r++) { const y = r * h / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let k = 0; k < 2; k++) { const x = (k + (r % 2) * 0.5) * w / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / 4); g.stroke(); } } }), roughness: 0.95 });
  MAT.plywood = MAT.plywood || new THREE.MeshStandardMaterial({ color: 0xc89b62, roughness: 0.75 });
  MAT.metal = MAT.metal || new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.4, metalness: 0.6 });
  MAT.binRed = MAT.binRed || new THREE.MeshStandardMaterial({ color: 0xb33a2f, roughness: 0.5, metalness: 0.2 });
  MAT.rackOrange = MAT.rackOrange || new THREE.MeshStandardMaterial({ color: 0xe0701e, roughness: 0.55, metalness: 0.3 }); MAT.rackBlue = MAT.rackBlue || new THREE.MeshStandardMaterial({ color: 0x2b55a8, roughness: 0.55, metalness: 0.3 });
  MAT.lightPanel = MAT.lightPanel || new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 1.2 });
}
// the track's materials, by the names racegow.js gives them (made on first use)
function rgMat(name) {
  if (RGM[name]) return RGM[name]; rgRoomMats(); const S0 = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o }); let m;
  const [k, v] = name.split('_');
  if (k === 'rgFrame') m = S0(LEDC[v] ?? 0x15161a, { roughness: 0.45, metalness: 0.15 });
  else if (k === 'rgLed') m = new THREE.MeshBasicMaterial({ color: LEDC[v] ?? 0x33e6ff });
  else if (name === 'rgLedRainbow' || name.startsWith('rgLedChase') || name === 'rgLedFinish') m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  else if (k === 'rgPvc') m = S0(v === 'white' ? 0xf2f2ee : LEDC[v] ?? 0xf2f2ee, { roughness: 0.42 });
  else if (k === 'rgFlag') m = S0(LEDC[v] ?? 0xff3d2e, { roughness: 0.8, side: THREE.DoubleSide });
  else if (k === 'rgWall') m = v === 'glass' ? new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }) : v === 'foam' ? S0(0x3d8fd8, { roughness: 1 }) : v === 'concrete' ? (MAT.concrete || S0(0x9a9a96)) : v === 'wood' ? MAT.plywood : MAT.drywall;
  else if (k === 'rgFloor') m = v === 'carpet' ? S0(0x5a4d6e, { roughness: 1 }) : v === 'tile' ? S0(0xd8dde2, { roughness: 0.18 }) : v === 'mat' ? S0(0x2a3a52, { roughness: 1 }) : MAT.hardwood;
  else if (name === 'rgPvcJoint') m = S0(0xe9e9e2);
  else if (name === 'rgBeam') m = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  else if (name === 'rgChecker') { const [c, g] = cnv(128, 32); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x * 8, y * 8, 8, 8); } m = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.8 }); }
  else if (name === 'rgWood') m = MAT.plywood; else if (name === 'rgFabric') m = MAT.fabric; else if (name === 'rgWhite') m = S0(0xf4f2ec);
  else if (name === 'rgLampShade') m = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffe2b0, emissiveIntensity: 1.4 });
  else if (name === 'rgPot') m = MAT.pot || S0(0xb5643c); else if (name === 'rgLeaves') m = S0(0x3f7d3a, { roughness: 0.9 });
  else m = MAT[name] || MAT.concrete || S0(0x888888);
  return (RGM[name] = m);
}
const rgAnimMats = () => Object.entries(RGM).filter(([k]) => k === 'rgLedRainbow' || k.startsWith('rgLedChase') || k === 'rgLedFinish');
function rgLedTick(t) { for (const [k, m] of rgAnimMats()) { if (k === 'rgLedRainbow') m.color.setHSL((t * 0.25) % 1, 1, 0.55); else if (k === 'rgLedFinish') m.color.setHex(Math.floor(t * 4) % 2 ? 0xffffff : 0x111111); else { const i = +k.slice(-1); m.color.setHex(Math.floor(t * 8) % 4 === i ? 0xffe14a : 0x221a05); } } }
function rgText(text, col = '#ffffff', size = 0.12) {
  const [c, g] = cnv(128, 64); g.font = 'bold 46px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(text, 64, 34); g.fillStyle = col; g.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); m.scale.set(size * 2, size, 1); m.renderOrder = 10; m.userData.ownMat = true; return m; }
function rgClear(g) { for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.userData.ownMat && o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); } }

// ------------------------------------------------------------------ the venue: a room (its own group) or the loaded map
const rgRooms = {}; const outdoorFog = scene.fog, outdoorBg = scene.background;
function rgRoomKey(v) { return v.room + (v.size ? `:${v.size.x}x${v.size.z}x${v.size.h}` : ''); }
function rgRoomGroup(venue) {
  const key = rgRoomKey(venue); if (rgRooms[key]) return rgRooms[key];
  rgRoomMats(); const E = RG.ROOMS[venue.room].build(venue.size), g = new THREE.Group(); g.userData.walls = []; g.userData.size = E.size; g.userData.lights = [];
  for (const z of E.zones) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(z.h.x * 2, z.h.z * 2), MAT[z.mat] || MAT.hardwood), uv = pl.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * z.h.x * 2 / 1.6, uv.getY(i) * z.h.z * 2 / 1.6); pl.rotation.x = -Math.PI / 2; pl.position.set(z.c.x, 0.001, z.c.z); pl.receiveShadow = true; g.add(pl); }
  for (const o of E.objs) for (const v of o.vis) { let m;
    if (v.shape === 'box') { m = new THREE.Mesh(boxGeo(v.h, v.mat === 'cinder' || v.mat === 'drywall' ? 0.5 : 1), MAT[v.mat] || MAT.concrete); m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ'); }
    else if (v.shape === 'pipe') m = pipeMesh(v.a, v.b, v.r, MAT[v.mat] || MAT.galv);
    if (!m) continue; m.castShadow = o.kind !== 'wall' && o.kind !== 'building'; m.receiveShadow = true; g.add(m);
    if (o.kind === 'wall' || o.kind === 'building') g.userData.walls.push({ m, c: v.c, h: v.h, ceiling: o.kind === 'building' }); }
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0x6d5f50, 1.1); g.add(hemi); g.userData.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.position.set(E.size.x * 0.2, E.size.h + 6, E.size.z * 0.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); g.userData.sun = sun;
  const sc = sun.shadow.camera, M = Math.max(E.size.x, E.size.z) / 2 + 1; sc.left = -M; sc.right = M; sc.top = M; sc.bottom = -M; sc.near = 0.5; sc.far = E.size.h + 20; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; g.add(sun); g.add(sun.target);
  for (const [x, y, z] of E.lights) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.4), MAT.lightPanel); p.position.set(x, y - 0.02, z); g.add(p); g.userData.walls.push({ m: p, c: { x, y, z }, h: { x: 0.5, y: 0.015, z: 0.2 }, ceiling: true });
    const l = new THREE.PointLight(0xfff1dc, 3, E.size.x, 1.6); l.position.set(x, y - 0.3, z); g.add(l); g.userData.lights.push(l); }
  g.visible = false; scene.add(g); rgRooms[key] = g; return g;
}
const LIGHTS = { default: { hemi: [0xfff6ea, 1.1], sun: 1.6, pt: 3, bg: 0x1a1a1e }, office: { hemi: [0xeef4ff, 1.35], sun: 0.7, pt: 4, bg: 0x20242a }, livingroom: { hemi: [0xffd9a8, 0.8], sun: 1.0, pt: 2.4, bg: 0x1a120c },
  neon: { hemi: [0x5533aa, 0.35], sun: 0.15, pt: 1.2, bg: 0x07040f }, blacklight: { hemi: [0x3311aa, 0.18], sun: 0, pt: 0.4, bg: 0x030008 } };
let rgVenueOn = null;
function rgVenue(track) {   // show the track's venue: its room (map hidden), or the loaded map
  for (const g of Object.values(rgRooms)) g.visible = false;
  if (!track || track.venue.kind === 'map') { playRoot.visible = true; scene.fog = outdoorFog; scene.background = outdoorBg; rgVenueOn = null; return; }
  const g = rgRoomGroup(track.venue), L = LIGHTS[track.lighting] || LIGHTS.default; g.visible = true; playRoot.visible = false; scene.fog = null; scene.background = new THREE.Color(L.bg);
  g.userData.hemi.color.setHex(L.hemi[0]); g.userData.hemi.intensity = L.hemi[1]; g.userData.sun.intensity = L.sun; for (const l of g.userData.lights) l.intensity = L.pt; rgVenueOn = g;
}
// in the editor the camera is often outside the room: hide the walls (and ceiling) between it and the inside
function rgCutaway(cam) { const g = rgVenueOn; if (!g) return; const S2 = g.userData.size;
  for (const w of g.userData.walls) { if (!cam) { w.m.visible = true; continue; } if (w.ceiling) { w.m.visible = cam.position.y < S2.h; continue; }
    const isX = w.h.x < w.h.z, side = isX ? Math.sign(w.c.x) : Math.sign(w.c.z), p = isX ? cam.position.x : cam.position.z, lim = (isX ? S2.x : S2.z) / 2; w.m.visible = !(side * p > lim - 0.05); } }
function useWorld(w) { activeWorld = w; drone.world = w; detector.world = w; detector.reset(); }
const rgMapOk = track => track.venue.kind !== 'map' || track.venue.map === MAP_ID;
// the flyable world of a built track: the room's colliders, or the map's, plus the track's
function rgWorld(B) {
  const V = B.venue, map = B.track.venue.kind === 'map';
  const prims = map ? [...world.prims, ...B.prims] : B.prims, objs = map ? [...world.objs, ...B.objs] : [...V.objs, ...B.objs];
  return { ...(map ? world : {}), objs, prims, zones: map ? world.zones : V.zones, spawn: B.spawn, fields: B.fields, ceiling: B.ceiling, groundSurf: map ? null : V.floorSurf, raceTrack: true };
}

// ------------------------------------------------------------------ drawing a track (the editor and the race use the same meshes)
const rgRoot = new THREE.Group(); scene.add(rgRoot);
function rgElementMesh(o, opts = {}) {
  const g = new THREE.Group(); g.userData.eid = o.eid;
  for (const v of o.vis) { let m;
    if (v.shape === 'label') { m = rgText(v.text, '#' + (LEDC[v.color] ?? 0xffffff).toString(16).padStart(6, '0'), 0.11); m.position.set(v.at.x, v.at.y, v.at.z); m.material.depthTest = true; }
    else { const mat = rgMat(v.mat); if (v.shape === 'box') { m = new THREE.Mesh(boxGeo(v.h, 1), mat); m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ'); }
      else if (v.shape === 'pipe') m = pipeMesh(v.a, v.b, v.r, mat); else if (v.shape === 'sphere') { m = new THREE.Mesh(new THREE.IcosahedronGeometry(v.r, 1), mat); m.position.set(v.c.x, v.c.y, v.c.z); }
      if (m) { m.castShadow = !v.glow && !v.alpha; m.receiveShadow = !v.glow; if (v.glow) m.layers.enable(1); } }
    if (m) g.add(m); }
  for (const l of o.lights) { const pl = new THREE.PointLight(l.color, l.power, l.range, 1.6); pl.position.set(l.at.x, l.at.y, l.at.z); g.add(pl); }
  // checkpoints: a panel with the way through (always faint in the editor; the next one while racing, if turned on)
  g.userData.panels = [];
  for (const cp of o.gates) for (const P of cp.circle ? [null] : cp.polys || [cp.poly]) {
    let geo; if (cp.circle) geo = new THREE.CircleGeometry(cp.circle.r, 32).translate(cp.circle.cx, cp.circle.cy, 0);
    else { const sh = new THREE.Shape(); P.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); geo = new THREE.ShapeGeometry(sh); }
    const mat = new THREE.MeshBasicMaterial({ color: cp.start ? 0xffffff : cp.finish ? 0xffd34d : 0x2fd24a, transparent: true, opacity: opts.editor ? (cp.invisible ? 0.28 : 0.12) : 0.38, side: THREE.DoubleSide, depthWrite: false });
    const pm = new THREE.Mesh(geo, mat); pm.userData.ownMat = true; pm.renderOrder = 5;
    pm.matrixAutoUpdate = false; pm.matrix.makeBasis(new THREE.Vector3(cp.right.x, cp.right.y, cp.right.z), new THREE.Vector3(cp.up.x, cp.up.y, cp.up.z), new THREE.Vector3(-cp.fwd.x, -cp.fwd.y, -cp.fwd.z)).scale(new THREE.Vector3(cp.s, cp.s, cp.s)).setPosition(cp.o.x, cp.o.y, cp.o.z);
    pm.visible = !!opts.editor; g.add(pm); g.userData.panels.push(pm);
    if (opts.editor) { const c = RG.centreOf(cp), cone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 10), new THREE.MeshBasicMaterial({ color: 0x9dffb0 })); cone.userData.ownMat = true;
      cone.position.set(c.x + cp.fwd.x * 0.08, c.y + cp.fwd.y * 0.08, c.z + cp.fwd.z * 0.08); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(cp.fwd.x, cp.fwd.y, cp.fwd.z)); g.add(cone); } }
  // fields: a faint box in the editor (the race shows fans by their fan)
  for (const f of o.fields) if (opts.editor) { const col = f.kind === 'push' ? 0x66ccff : f.kind === 'dark' ? 0x222244 : 0xffd34d, b = new THREE.Mesh(new THREE.BoxGeometry(f.h.x * 2, f.h.y * 2, f.h.z * 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false }));
    b.userData.ownMat = true; b.position.set(f.o.x, f.o.y, f.o.z); b.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(f.m[0], f.m[1], f.m[2], 0, f.m[3], f.m[4], f.m[5], 0, f.m[6], f.m[7], f.m[8], 0, 0, 0, 0, 1)); g.add(b); }
  return g;
}
function rgDraw(B, opts = {}) {
  rgClear(rgRoot); const meshes = new Map(); const hidden = opts.hiddenLayers || new Set();
  for (const o of B.objs) { const e = B.track.elements.find(x => x.id === o.eid); if (!e || hidden.has(e.layer)) continue; const m = rgElementMesh(o, opts); rgRoot.add(m); meshes.set(o.eid, m); }
  if (opts.editor) { const S2 = B.seq; S2.forEach((st, i) => { const c = RG.stepCentre(st), lab = rgText(st.start ? 'S/F' : st.finish ? 'FIN' : String(i), st.start ? '#ffffff' : '#7dff9a', 0.1); lab.position.set(c.x, c.y + 0.32, c.z); rgRoot.add(lab); }); }
  return meshes;
}

// ------------------------------------------------------------------ storage
const rgTracks = () => store.get('rg.tracks', {});
function rgSave(t) { t.updated = new Date().toISOString(); const all = rgTracks(); all[t.id] = t; store.set('rg.tracks', all); }
function rgDelete(id) { const all = rgTracks(); delete all[id]; store.set('rg.tracks', all); }
function rgList() { return Object.values(rgTracks()).map(t => { try { return RG.cleanTrack(t); } catch { return null; } }).filter(Boolean).sort((a, b) => (b.updated || b.created || '').localeCompare(a.updated || a.created || '')); }
const rgBestKey = t => 'rg.best.' + RG.trackHash(t);
const rgBest = t => store.get(rgBestKey(t), {});
// the old RaceGOW tracks (pro-whooper-track/1) come across once
(function rgMigrate() { if (store.get('rg.migrated', false)) return; const old = store.get('race.tracks', {}); for (const t of Object.values(old)) { try { const n = RG.cleanTrack(t); n.name = n.name + ' (old)'; rgSave(n); } catch { } } store.set('rg.migrated', true); })();
(function rgSamples() { const have = store.get('rg.samples', []); RG.SAMPLES.forEach((f, i) => { if (have.includes(i)) return; try { rgSave(RG.cleanTrack(f())); have.push(i); } catch { } }); store.set('rg.samples', have); })();
// track codes: one line, deflated JSON in base64url (like map codes)
async function rgCode(t) { const j = JSON.stringify(RG.cleanTrack(t)); const s = new Blob([j]).stream().pipeThrough(new CompressionStream('deflate-raw')), b = new Uint8Array(await new Response(s).arrayBuffer());
  let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return 'PWTRACK2-' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function rgUncode(code) { const m = /^PWTRACK2-([A-Za-z0-9_-]+)$/.exec(String(code).trim()); if (!m) throw new Error('not a track code');
  const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), b = Uint8Array.from(bin, c => c.charCodeAt(0)); if (b.length > 400000) throw new Error('too big');
  const txt = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); if (txt.length > 2000000) throw new Error('too big'); return RG.cleanTrack(JSON.parse(txt)); }

// ============================================================ racing
const race = { on: false, track: null, B: null, R: null, mode: 'hotlaps', laps: 3, t: 0, fromEditor: false, msg: '', msgT: 0, msgGood: false, best: null, rec: [], recT0: 0, ghosts: {}, gm: {}, trail: {}, lastDelta: null,
  bumpT: 0, ampAvg: 0, darkF: 1, results: null, online: null, opts: Object.assign({ mode: 'hotlaps', laps: 3, ghostPB: true, ghostPrev: false, arrow: true, panel: true }, store.get('rg.opts', {})) };
const rgSaveOpts = () => store.set('rg.opts', race.opts);
function rgGhostMesh(color) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.07), m)); for (const [x, z] of [[-0.032, -0.032], [0.032, -0.032], [-0.032, 0.032], [0.032, 0.032]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 6, 16), m); r.rotation.x = Math.PI / 2; r.position.set(x, 0, z); g.add(r); }
  g.scale.setScalar(1.4); g.visible = false; scene.add(g);
  const tl = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(46 * 3), 3)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })); tl.frustumCulled = false; tl.visible = false; scene.add(tl); g.userData.trail = tl;
  return g; }
function raceStart(track, rmode, opts = {}) {
  if (!rgMapOk(track)) { rgGoToMap(track, 'race', rmode); return; }
  if (mode === 'editor') edClose(false);
  if (typeof ghostOff === 'function') ghostOff(); train.on = false; renderTrain(); if (typeof ask !== 'undefined') ask.pending = [];
  const B = RG.buildTrack(track, track.venue.kind === 'map' ? world : null); race.B = B; race.track = track; race.mode = rmode; race.laps = opts.laps || race.opts.laps || track.laps || 3; race.fromEditor = !!opts.fromEditor;
  rgVenue(track); useWorld(rgWorld(B)); rgCutaway(null); race.meshes = rgDraw(B); race.glow = true;
  race.best = rgBest(track); race.R = new RG.Race(B, { mode: rmode === 'test' ? 'hotlaps' : rmode, laps: race.laps, ref: race.best.lap ? { gateTimes: race.best.lapGates } : null });
  race.ghosts = { pb: race.best.lapGhost ? RG.unpackGhost(race.best.lapGhost) : null, prev: null, online: opts.online || (race.online && race.online.hash === RG.trackHash(track) ? race.online.frames : null) };
  for (const [k, col] of [['pb', 0xffd34d], ['prev', 0xbbbbbb], ['online', 0xff5fb5]]) if (!race.gm[k]) race.gm[k] = rgGhostMesh(col);
  race.t = 0; race.rec = []; race.recT0 = null; race.on = true; race.results = null; race.msgT = 0; race.lastDelta = null; race.bumpT = 0;
  combo.names = []; combo.pts = 0; combo.active = false; initAudio(); if (actx && actx.state === 'suspended') actx.resume();
  score = new S.ScoreKeeper(); drone.reset(B.spawn); flightTime = 0; session = null; updateBreakdown();
  mode = 'fly'; show(null); $('#hud').classList.remove('hide'); $('#hud').classList.add('racing'); $('#rgHud').classList.remove('hide'); camMode = 'fpv'; resize();
  $('#sessionT').textContent = track.name.toUpperCase();
  raceMsg(rmode === 'timeattack' ? `Time attack · ${race.laps} laps · fly through the start` : rmode === 'test' ? 'Test fly · B goes back to the editor' : 'Hot laps · fly through the start', true, 3);
}
function raceOff() {
  race.on = false; race.R = null; rgClear(rgRoot); for (const m of Object.values(race.gm)) { m.visible = false; m.userData.trail.visible = false; }
  $('#hud').classList.remove('racing'); $('#rgHud').classList.add('hide'); $('#pauseRace').classList.add('hide'); rgDarkSet(1);
  if (activeWorld !== world) useWorld(world); rgVenue(null);
}
function raceMsg(text, good = false, secs = 2.2) { race.msg = text; race.msgGood = good; race.msgT = secs; }
function raceRespawn() {   // back to the start; the lap in progress is gone (hot laps), the race starts again (time attack)
  const armed = drone.armed && !drone.crashed; drone.reset(race.B.spawn, true); drone.armed = armed; crashLock = false; race.crashT = null;
  const R = race.R, keep = { bestLap: R.bestLap, bestGates: R.bestGates, bestSectors: R.bestSectors, lapTimes: R.lapTimes }; R.reset(); if (race.mode !== 'timeattack') Object.assign(R, keep); race.rec = []; race.recT0 = null; raceMsg('Back at the start', false, 1.2);
}
function raceStep(p0, dt) {
  const R = race.R; if (!R) return; race.t += dt;
  if (R.on && race.recT0 != null && race.t - (race.rec.length ? race.rec[race.rec.length - 1].t + race.recT0 : -1) >= 1 / RG.GHZ - 1e-6) race.rec.push({ t: race.t - race.recT0, p: { x: drone.pos.x, y: drone.pos.y, z: drone.pos.z }, q: { w: drone.q.w, x: drone.q.x, y: drone.q.y, z: drone.q.z } });
  for (const e of R.step(p0, drone.pos, race.t)) raceEvent(e);
  if (drone.contactThisStep && drone.impactSurf && drone.lastImpact > 0.5 && drone.impactSurf === RG.SURF.soft) race.bumpT = 0.6;
  race.ampAvg += (drone.ibat - race.ampAvg) * Math.min(1, dt * 2);
  if (drone.crashed) { if (race.crashT == null) race.crashT = race.t; else if (race.t - race.crashT > 1.0) raceRespawn(); }
}
function raceEvent(e) {
  if (e.type === 'start') { race.recT0 = race.t; race.rec = []; raceMsg('GO', true, 0.8); }
  if (e.type === 'wrong') raceMsg('Wrong way!');
  if (e.type === 'skip') raceMsg(`Missed gate ${e.i} — go back`);
  if (e.type === 'gate') { race.lastDelta = e.delta; race.lastDeltaT = 2.5; }
  if (e.type === 'sector') { race.sectorFlash = { s: e.s, best: e.best, t: 1.5 }; }
  if (e.type === 'lap') {
    const ghost = RG.packGhost(race.rec), B = race.best; race.ghosts.prev = RG.unpackGhost(ghost);
    if (race.mode !== 'test' && (B.lap == null || e.time < B.lap)) { B.lap = e.time; B.lapGates = e.gateTimes; B.lapGhost = ghost; B.at = new Date().toISOString(); race.ghosts.pb = race.ghosts.prev; race.R.ref = { gateTimes: e.gateTimes }; B.dirty = true; raceMsg(`Lap ${e.lap}: ${fmtLap(e.time)} — personal best!`, true, 3); }
    else raceMsg(`Lap ${e.lap}: ${fmtLap(e.time)}${B.lap != null ? '  (' + fmtDelta(e.time - B.lap) + ')' : ''}`, e.best);
    if (race.mode !== 'test') { B.sectors = B.sectors || []; e.sectors.forEach((s, i) => { if (s != null && (B.sectors[i] == null || s < B.sectors[i])) B.sectors[i] = s; }); B.laps = (B.laps || 0) + 1; store.set(rgBestKey(race.track), B); }
    race.rec = []; race.recT0 = race.t;
  }
  if (e.type === 'finish') {
    const B = race.best, k = String(race.laps), prev = B.ta && B.ta[k];
    if (race.mode === 'timeattack' && (!prev || e.total < prev.total)) { B.ta = B.ta || {}; B.ta[k] = { total: e.total, laps: e.laps, at: new Date().toISOString() }; store.set(rgBestKey(race.track), B); }
    raceResults(e, prev);
  }
}
function raceResults(e, prev) {
  drone.armed = false; const B = race.best, rel = lbBase() && lbNameOk(pilotName()) && B.lapGhost;
  $('#rgResBody').innerHTML = `<h2>${race.mode === 'timeattack' ? race.laps + '-lap time attack' : 'Finished'} · ${esc(race.track.name)}</h2><div class="big">${fmtLap(e.total)}</div>
    <p>${e.laps.map((l, i) => `Lap ${i + 1}: <b>${fmtLap(l)}</b>`).join(' · ')}</p>
    <p>${prev ? (e.total < prev.total ? `New personal best (was ${fmtLap(prev.total)})` : `Personal best ${fmtLap(prev.total)}`) : 'First finish on this track: that is the time to beat.'} · Best lap ${fmtLap(B.lap)}</p>
    <div class="row"><button class="primary" data-rg="again">Race again</button>${race.fromEditor ? '<button data-rg="toEditor">Back to editor</button>' : ''}${rel ? '<button data-rg="postLap">Post my best lap</button>' : ''}<button data-rg="tracks">Tracks</button></div><p class="note" id="rgPostMsg"></p>`;
  mode = 'paused'; show('#rgResults');
}
function rgDarkSet(f) { if (Math.abs(f - race.darkF) < 1e-3) return; race.darkF = f; renderer.toneMappingExposure = 1.05 * f; }
function raceHud() {
  const R = race.R; if (!R) return; const lt = R.on ? race.t - R.lapT0 : 0, n = R.n - (race.B.loop ? 0 : 1), B = race.best;
  $('#rgTime').textContent = R.done ? fmtLap(R.total) : fmtLap(lt);
  $('#rgSub').textContent = !R.on ? (race.mode === 'timeattack' ? `TIME ATTACK · ${race.laps} LAPS · fly through the start` : race.mode === 'test' ? 'TEST FLY · B: back to the editor' : 'HOT LAPS · fly through the start')
    : `LAP ${R.lap}${race.mode === 'timeattack' ? '/' + race.laps : ''} · GATE ${Math.max(1, R.next || n)}/${n}${race.mode === 'timeattack' ? ' · TOTAL ' + fmtLap(race.t - R.t0) : ''}`;
  const d = $('#rgDelta'); if (race.lastDelta != null && race.lastDeltaT > 0) { d.textContent = fmtDelta(race.lastDelta); d.className = race.lastDelta <= 0 ? 'good' : 'bad'; } else d.textContent = '';
  const m = $('#rgMsg'); m.textContent = race.msgT > 0 ? race.msg : ''; m.className = race.msgGood ? 'good' : '';
  const secs = R.sectors.map((_, i) => { const cur = R.curSectors[i], best = R.bestSectors[i], pb = B.sectors && B.sectors[i]; const cls = cur == null ? '' : best != null && cur <= best + 1e-9 && (pb == null || cur <= pb + 1e-9) ? 'purple' : pb == null || cur <= pb ? 'green' : 'yellow';
    return `<span class="${cls}">S${i + 1} ${cur != null ? cur.toFixed(2) : '—'}</span>`; }).join('');
  const theo = B.sectors && B.sectors.length === R.sectors.length && B.sectors.every(x => x != null) ? B.sectors.reduce((a, b) => a + b, 0) : null;
  $('#rgSectors').innerHTML = secs;
  $('#rgBox').innerHTML = `<div>BEST LAP <b>${fmtLap(B.lap)}</b></div>${theo ? `<div class="dim">THEORETICAL ${fmtLap(theo)}</div>` : ''}${race.mode === 'timeattack' && B.ta && B.ta[race.laps] ? `<div>PB ${race.laps} LAPS ${fmtLap(B.ta[race.laps].total)}</div>` : ''}`
    + R.lapTimes.slice(-5).reverse().map(l => `<div class="${l <= (R.bestLap ?? 1e9) + 1e-9 ? 'good' : ''}">${fmtLap(l)}</div>`).join('');
  const cells = drone.p.bat.cells || 1, mins = drone.armed && race.ampAvg > 1 ? drone.soc * drone.p.bat.cap / 1000 / race.ampAvg * 60 : null;
  $('#rgBat').innerHTML = `${(drone.vbat / cells).toFixed(2)} V/cell · ${drone.ibat.toFixed(1)} A${tune.batteryLife !== false && mins != null ? ` · ~${mins >= 1 ? Math.floor(mins) + ' min' : Math.round(mins * 60) + ' s'} left` : ''}${race.bumpT > 0 ? ' · <b class="bump">BUMP</b>' : ''}`;
}
function raceVisuals(dt) {
  const R = race.R; if (!R) return; race.msgT -= dt; race.lastDeltaT -= dt; race.bumpT -= dt; rgLedTick(performance.now() / 1000);
  // the next checkpoint's panel, the arrow pointing at it
  const want = R.done ? null : race.B.seq[R.on ? R.next : 0];
  for (const [eid, m] of race.meshes) for (const p of m.userData.panels) p.visible = race.opts.panel && !!want && want.eid === eid;
  const ar = $('#rgArrow'); if (race.opts.arrow && want) { const cam = camMode === 'fpv' ? fpvCam : chaseCam, c = RG.stepCentre(want), v = new THREE.Vector3(c.x, c.y, c.z).project(cam), behind = v.z > 1;
    let x = v.x, y = v.y; if (behind) { x = -x; y = -y; } const onScreen = !behind && Math.abs(x) < 0.85 && Math.abs(y) < 0.85; ar.style.display = onScreen ? 'none' : 'block';
    if (!onScreen) { const a = Math.atan2(-y, x); ar.style.transform = `translate(-50%,-50%) translate(${Math.cos(a) * 34}vmin, ${Math.sin(a) * 34}vmin) rotate(${a}rad)`; } } else ar.style.display = 'none';
  // dark zones
  let dark = 1; for (const f of race.B.fields) if (f.kind === 'dark') { const d = S.sub(drone.pos, f.o), m = f.m, lx = d.x * m[0] + d.y * m[3] + d.z * m[6], ly = d.x * m[1] + d.y * m[4] + d.z * m[7], lz = d.x * m[2] + d.y * m[5] + d.z * m[8];
    if (Math.abs(lx) < f.h.x && Math.abs(ly) < f.h.y && Math.abs(lz) < f.h.z) dark = Math.min(dark, f.ir ? 0.55 : 0.07); } rgDarkSet(dark);
  // ghosts, with a short trail behind each
  const lapU = R.on ? race.t - R.lapT0 : -1;
  const place = (k, frames, on) => { const m = race.gm[k], tl = m.userData.trail, g = on && frames && lapU >= 0 ? RG.sampleGhost(frames, lapU) : null; m.visible = !!g && !g.end; tl.visible = m.visible;
    if (!m.visible) return; m.position.set(g.p.x, g.p.y, g.p.z); m.quaternion.set(g.q.x, g.q.y, g.q.z, g.q.w);
    const a = tl.geometry.attributes.position; for (let i = 0; i < 46; i++) { const s = RG.sampleGhost(frames, Math.max(0, lapU - i * 0.033)); a.setXYZ(i, s.p.x, s.p.y, s.p.z); } a.needsUpdate = true; };
  place('pb', race.ghosts.pb, race.opts.ghostPB); place('prev', race.ghosts.prev, race.opts.ghostPrev); place('online', race.ghosts.online, true);
}
function backToEditor() { const t = race.track; raceOff(); edOpen(t, true); }
// pause menu: race buttons while racing, the map editor's while test flying a map
const _rgPause = pause; pause = function () { _rgPause(); $('#pauseRace').classList.toggle('hide', !race.on); $('#pauseEditorBtn').classList.toggle('hide', !race.fromEditor); $('#pauseMapEdit').classList.toggle('hide', !ME.testing); };
// a map track on another map: reload into that map and carry on there
function rgGoToMap(track, act, rmode) { const m = track.venue.map; if (!S.MAPS[m]) { alert('This track is on a map this version does not have.'); return; }
  if (!confirm(`This track is built on ${S.MAPS[m].title}. Load that map now?`)) return; if (!rgTracks()[track.id]) rgSave(track); store.set('rgPending', { id: track.id, act, rmode }); store.set('map', m); $('#loading').textContent = 'Loading ' + S.MAPS[m].title + '…'; show('#loading'); setTimeout(() => location.reload(), 300); }
setTimeout(() => { const P = store.get('rgPending', null); if (!P) return; store.set('rgPending', null); const t = rgList().find(x => x.id === P.id); if (!t || !rgMapOk(t)) return; if (P.act === 'edit') edOpen(t); else raceStart(t, P.rmode || race.opts.mode); }, 1200);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rg]'); if (!b) return; const a = b.dataset.rg;
  if (a === 'again' && race.track) { const t = race.track, fe = race.fromEditor, m = race.mode; raceOff(); raceStart(t, m, { laps: race.laps, fromEditor: fe }); }
  if (a === 'toEditor' && race.track) backToEditor();
  if (a === 'tracks') { raceOff(); openRaceMenu(); }
  if (a === 'postLap') rgPostLap(race.track);
});
// the pause menu's race buttons
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || !race.on) return; const a = b.dataset.act;
  if (a === 'raceRestart') { const t = race.track, fe = race.fromEditor, m = race.mode; raceOff(); raceStart(t, m, { laps: race.laps, fromEditor: fe }); }
  if (a === 'raceEditor') backToEditor();
  if (a === 'raceExit') { raceOff(); openRaceMenu(); } });

// ============================================================ the track list (Tools & labs → RaceGOW)
const rgUI = { tab: 'mine', comm: null, commMsg: '', board: {}, msg: '' };
function openRaceMenu() { mode = 'menu'; drone.armed = false; $('#hud').classList.add('hide'); if (race.on) raceOff(); show('#rgScreen'); rgRenderMenu(); }
function rgCard(t, own) {
  const B = rgBest(t), B0 = RG.buildTrack(t, t.venue.kind === 'map' && rgMapOk(t) ? world : null), est = RG.estimate(B0), id = esc(t.id);
  const venue = t.venue.kind === 'map' ? `on ${esc((S.MAPS[t.venue.map] || {}).title || t.venue.map)}` : esc(RG.ROOMS[t.venue.room].label);
  return `<div class="rCard"><h3>${esc(t.name)}</h3><small>${venue} · ${Math.max(0, B0.seq.length - 1)} gates${est.lap ? ` · ~${est.lap} s · difficulty ${est.difficulty}` : ''}${t.by ? ' · by ' + esc(t.by) : ''}</small>
    <div class="rBest">Best lap ${fmtLap(B.lap)}${B.ta && B.ta[race.opts.laps] ? ` · ${race.opts.laps} laps ${fmtLap(B.ta[race.opts.laps].total)}` : ''}</div>
    <div class="row"><button class="primary" data-rgt="race:${id}">Race</button><button data-rgt="edit:${id}">${own ? 'Edit' : 'Edit a copy'}</button><button data-rgt="board:${id}">Leaderboard</button><button data-rgt="code:${id}">Copy code</button><button data-rgt="export:${id}">Export</button>${own ? `<button data-rgt="share:${id}">Share</button><button data-rgt="del:${id}">Delete</button>` : `<button data-rgt="keep:${id}">Save a copy</button>`}</div>
    <div class="rgBoard" id="rgb-${id}"></div></div>`;
}
function rgRenderMenu() {
  const o = race.opts, own = rgList(), venues = Object.entries(RG.ROOMS).map(([k, R]) => `<option value="room:${k}">${esc(R.label)}</option>`).join('') + `<option value="map:${MAP_ID}">This map: ${esc(S.MAPS[MAP_ID].title)}</option>`;
  const cards = rgUI.tab === 'mine' ? (own.length ? own.map(t => rgCard(t, true)).join('') : '<p class="hint">No tracks yet: make one below, or paste a track code.</p>')
    : rgUI.comm ? (rgUI.comm.length ? rgUI.comm.map(it => `<div class="rCard"><h3>${esc(it.name)}</h3><small>by ${esc(it.by)} · ${new Date(it.at).toLocaleDateString()}</small><div class="row"><button class="primary" data-rgt="get:${esc(it.id)}">Open</button></div></div>`).join('') : '<p class="hint">Nobody has shared a track yet.</p>') : `<p class="hint">${esc(rgUI.commMsg || 'Loading…')}</p>`;
  $('#rgBody').innerHTML = `<div class="rTop"><button class="${rgUI.tab === 'mine' ? 'on' : ''}" data-rgt="tab:mine">My tracks</button><button class="${rgUI.tab === 'comm' ? 'on' : ''}" data-rgt="tab:comm">Community tracks</button><span class="sp"></span>
      <b>Mode</b><label><input type="radio" name="rgmode" value="hotlaps" ${o.mode === 'hotlaps' ? 'checked' : ''}> Hot laps</label><label><input type="radio" name="rgmode" value="timeattack" ${o.mode === 'timeattack' ? 'checked' : ''}> Time attack <select id="rgLaps">${[1, 2, 3, 5, 10].map(n => `<option ${n === o.laps ? 'selected' : ''}>${n}</option>`).join('')}</select> laps</label>
      <b>Ghosts</b><label><input type="checkbox" id="rgGPB" ${o.ghostPB ? 'checked' : ''}> my best</label><label><input type="checkbox" id="rgGPv" ${o.ghostPrev ? 'checked' : ''}> last lap</label>
      <b>Help</b><label><input type="checkbox" id="rgArr" ${o.arrow ? 'checked' : ''}> next-gate arrow</label><label><input type="checkbox" id="rgPan" ${o.panel ? 'checked' : ''}> next-gate panel</label></div>
    ${rgUI.msg ? `<p class="hint" style="color:#ffd34d">${esc(rgUI.msg)}</p>` : ''}
    <div class="rTracks">${cards}</div>
    <div class="rTop" style="margin-top:12px"><b>New track</b><select id="rgNewVenue">${venues}</select><span id="rgNewSize" class="hide">size <input id="rgSx" type="number" value="10" min="3" max="60" style="width:52px"> × <input id="rgSz" type="number" value="8" min="3" max="60" style="width:52px"> m, ceiling <input id="rgSh" type="number" value="3" min="2" max="20" style="width:44px"> m</span>
      <button class="primary" data-rgt="new">Build it</button><span class="sp"></span><input id="rgCodeIn" placeholder="Paste a track code" style="width:200px"><button data-rgt="paste">Open code</button><label class="ghost">Import file <input type="file" id="rgImport" accept=".json,application/json" hidden></label><button data-rgt="import">Import…</button></div>
    <p class="hint">RaceGOW is racing only: gates in order, the right way, clock running. Respawn (R) puts you back at the start. Mix anything on one track: IGOW-style whoop gates, furniture, walls, and white RaceGOW PVC (one section size per track, 24 in minimum; checkpoints in the openings of the structure).</p>`;
}
function rgFlash(t) { rgUI.msg = t; rgRenderMenu(); setTimeout(() => { if (rgUI.msg === t) { rgUI.msg = ''; if (!$('#rgScreen').classList.contains('hide')) rgRenderMenu(); } }, 4000); }
document.addEventListener('change', e => {
  if (!e.target.closest('#rgBody')) return; const o = race.opts, id = e.target.id;
  if (e.target.name === 'rgmode') o.mode = e.target.value; if (id === 'rgLaps') o.laps = +e.target.value; if (id === 'rgGPB') o.ghostPB = e.target.checked; if (id === 'rgGPv') o.ghostPrev = e.target.checked;
  if (id === 'rgArr') o.arrow = e.target.checked; if (id === 'rgPan') o.panel = e.target.checked; rgSaveOpts();
  if (id === 'rgNewVenue') $('#rgNewSize').classList.toggle('hide', e.target.value !== 'room:empty');
  if (id === 'rgImport' && e.target.files[0]) e.target.files[0].text().then(txt => { try { const t = RG.cleanTrack(JSON.parse(txt)); if (rgTracks()[t.id]) t.id = RG.uid('t'); rgSave(t); rgUI.tab = 'mine'; rgFlash(`Imported "${t.name}"`); } catch (err) { rgFlash('Not a track file: ' + err.message); } });
});
const rgFind = id => rgList().find(t => t.id === id) || (rgUI.commTracks || {})[id];
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-rgt]'); if (!b || !b.closest('#rgBody')) return; const [a, id] = b.dataset.rgt.split(/:(.*)/s);
  const t = id ? rgFind(id) : null;
  if (a === 'tab') { rgUI.tab = id; rgRenderMenu(); if (id === 'comm') rgCommLoad(); return; }
  if (a === 'race' && t) raceStart(t, race.opts.mode, { laps: race.opts.laps });
  if (a === 'edit' && t) { const c = rgTracks()[t.id] ? t : { ...JSON.parse(JSON.stringify(t)), id: RG.uid('t'), name: 'Copy of ' + t.name }; edOpen(c); }
  if (a === 'keep' && t) { rgSave({ ...JSON.parse(JSON.stringify(t)), id: RG.uid('t') }); rgFlash('Saved to My tracks'); }
  if (a === 'del' && t && confirm(`Delete "${t.name}"? (Your times for it stay saved.)`)) { rgDelete(t.id); rgRenderMenu(); }
  if (a === 'export' && t) saveFile(`${slug(t.name) || 'track'}.json`, JSON.stringify(RG.cleanTrack(t)));
  if (a === 'code' && t) { const c = await rgCode(t); try { await navigator.clipboard.writeText(c); rgFlash(`Track code copied (${c.length} characters)`); } catch { prompt('Track code:', c); } }
  if (a === 'paste') { try { const n = await rgUncode($('#rgCodeIn').value); if (rgTracks()[n.id]) n.id = RG.uid('t'); rgSave(n); rgUI.tab = 'mine'; rgFlash(`Opened "${n.name}"`); } catch (err) { rgFlash('That is not a track code (' + err.message + ')'); } }
  if (a === 'import') $('#rgImport').click();
  if (a === 'new') { const [k, v] = $('#rgNewVenue').value.split(':'), venue = k === 'map' ? { kind: 'map', map: v } : { kind: 'room', room: v, ...(v === 'empty' ? { size: { x: +$('#rgSx').value || 10, z: +$('#rgSz').value || 8, h: +$('#rgSh').value || 3 } } : {}) };
    const n = RG.cleanTrack(RG.newTrack({ venue, name: 'New ' + (k === 'map' ? S.MAPS[v].title : RG.ROOMS[v].label) + ' track', by: pilotName() })); edOpen(n); }
  if (a === 'share' && t) rgShare(t);
  if (a === 'board' && t) rgBoard(t);
  if (a === 'get') rgCommGet(id);
  if (a === 'ghost' && id) rgGhostRace(id);
});

// ------------------------------------------------------------------ sharing through the relay (tools/dropoff-worker.mjs)
async function rgPost(kind, payload) { if (!lbBase()) throw new Error('needs the online version of the game');
  const r = await fetch(lbBase(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind, payload }) });
  if (r.status !== 200) throw new Error(r.status === 429 ? 'busy, try again in a bit' : r.status === 403 ? 'only from the online version' : 'refused (' + r.status + ')'); }
async function rgShare(t) {
  if (!lbNameOk(pilotName())) { rgFlash('Pick a pilot name (Options) first: it goes with the track.'); return; }
  const chk = RG.checks(RG.buildTrack(t, t.venue.kind === 'map' && rgMapOk(t) ? world : null)); if (!chk.ok) { rgFlash('Make it raceable first (the editor\'s checklist shows what is missing).'); return; }
  if (!confirm(`Share "${t.name}" with every pilot, under the name ${pilotName()}?`)) return;
  try { await rgPost('track', { ...RG.cleanTrack(t), by: pilotName(), pilot: telPilot(), build: '0.1' }); t.shared = true; rgSave(t); rgFlash(`Shared "${t.name}". ${procThanks()}`); } catch (err) { rgFlash('Could not share it: ' + err.message); }
}
async function rgCommLoad() { rgUI.comm = null; rgUI.commMsg = lbBase() ? 'Loading…' : 'Community tracks need the online version of the game.'; rgRenderMenu(); if (!lbBase()) return;
  try { const r = await fetch(`${lbBase()}/tracks`); if (!r.ok) throw 0; const j = await r.json(); rgUI.comm = (Array.isArray(j.tracks) ? j.tracks : []).filter(x => x && typeof x.id === 'string' && typeof x.name === 'string').slice(0, 200); }
  catch { rgUI.commMsg = 'Could not reach the community tracks just now.'; } if (rgUI.tab === 'comm') rgRenderMenu(); }
async function rgCommGet(id) { try { const r = await fetch(`${lbBase()}/track?id=${encodeURIComponent(id)}`); if (!r.ok) throw 0; const t = RG.cleanTrack(await r.json());
    rgUI.commTracks = rgUI.commTracks || {}; rgUI.commTracks[t.id] = t; $('#rgBody .rTracks').innerHTML = rgCard(t, false); } catch { rgFlash('Could not open that track.'); } }
async function rgPostLap(t) { const B = rgBest(t), el = $('#rgPostMsg'); if (!B.lap || !B.lapGhost) return;
  try { await rgPost('racetime', { format: 'pro-whooper-racetime/1', build: '0.1', name: pilotName(), pilot: telPilot(), track: RG.trackHash(t), trackName: t.name, lap: Math.round(B.lap * 1000), ghost: B.lapGhost, craft: { ...spec } });
    if (el) el.textContent = `Posted ${fmtLap(B.lap)} as ${pilotName()}. ${procThanks()}`; } catch (err) { if (el) el.textContent = 'Could not post it: ' + err.message; } }
async function rgBoard(t) { const h = RG.trackHash(t), el = $('#rgb-' + CSS.escape(t.id)); if (!el) return; if (!lbBase()) { el.innerHTML = '<p class="hint">The leaderboard needs the online version.</p>'; return; } el.innerHTML = '<p class="hint">Loading…</p>';
  try { const r = await fetch(`${lbBase()}/raceboard?track=${h}`); if (!r.ok) throw 0; const j = await r.json(), L = (Array.isArray(j.times) ? j.times : []).filter(x => x && Number.isFinite(x.lap)).slice(0, 20);
    el.innerHTML = L.length ? `<table>${L.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.name)}</td><td>${fmtLap(x.lap / 1000)}</td><td><button data-rgt="ghost:${esc(h + '|' + x.id + '|' + t.id)}" title="Race against this lap">▶ ghost</button></td></tr>`).join('')}</table>` : '<p class="hint">No laps posted yet: be the first (finish a lap, then "Post my best lap").</p>'; }
  catch { el.innerHTML = '<p class="hint">Could not reach the leaderboard.</p>'; } }
async function rgGhostRace(key) { const [h, id, tid] = key.split('|'), t = rgFind(tid); if (!t) return;
  try { const r = await fetch(`${lbBase()}/ghost?track=${encodeURIComponent(h)}&id=${encodeURIComponent(id)}`); if (!r.ok) throw 0; const j = await r.json(), frames = RG.unpackGhost(j.ghost); if (!frames) throw 0;
    race.online = { hash: h, frames }; raceStart(t, 'hotlaps', { online: frames }); raceMsg(`Racing ${String(j.name || 'a pilot').slice(0, 24)}'s ${fmtLap(j.lap / 1000)} (pink)`, true, 4); } catch { rgFlash('Could not load that ghost.'); } }

// ============================================================ the race editor (its own screen; not the Map Editor)
const edCamP = new THREE.PerspectiveCamera(55, 1, 0.02, 600), edCamO = new THREE.OrthographicCamera(-5, 5, 5, -5, -200, 600);
const ed = { track: null, B: null, sel: new Set(), view: 'persp', snap: 0.05, aSnap: 15, magnet: true, place: null, placeRy: 0, undo: [], redo: [], cam: { t: new THREE.Vector3(), dist: 8, yaw: 0.6, pitch: 0.75 }, topCam: { t: new THREE.Vector3(), dist: 10 },
  meshes: new Map(), extras: new THREE.Group(), hidden: new Set(), locked: new Set(), drag: null, mouse: new THREE.Vector2(), keys: {}, path: null, chk: null, showCol: false, showFlow: true, search: '', cat: 'Gates', saveT: 0, clip: null };
scene.add(ed.extras);
function edOpen(track, keep) {
  if (!rgMapOk(track)) { rgGoToMap(track, 'edit'); return; }
  if (race.on) raceOff(); ed.track = RG.cleanTrack(track); ed.sel.clear(); ed.place = null; ed.path = null; if (!keep) { ed.undo = []; ed.redo = []; }
  rgVenue(ed.track); edRebuild();
  if (!keep) { const V = ed.B.venue, sz = V.size || { x: 20, z: 20 }; const st = ed.track.elements.find(e => e.type === 'start'); ed.cam.t.set(st && ed.track.venue.kind === 'map' ? st.x : 0, 0.4, st && ed.track.venue.kind === 'map' ? st.z : 0);
    ed.cam.dist = Math.min(40, Math.max(sz.x, sz.z) * 0.85); ed.cam.yaw = 0.5; ed.cam.pitch = 0.8; ed.topCam.t.copy(ed.cam.t); ed.topCam.dist = Math.min(60, Math.max(sz.x, sz.z) * 1.1); }
  mode = 'editor'; drone.armed = false; show(null); $('#hud').classList.add('hide'); $('#rgEd').classList.remove('hide'); document.body.classList.add('editing'); edPanels(); resize();
}
function edClose(toMenu = true) { edSaveNow(); $('#rgEd').classList.add('hide'); document.body.classList.remove('editing'); rgClear(rgRoot); rgClear(ed.extras); rgCutaway(null); rgVenue(null); if (toMenu) openRaceMenu(); }
function editorClose() { edClose(false); }   // the pause menu's "Main menu" while in the editor
const edSnap = () => JSON.stringify(ed.track);
function edPush() { ed.undo.push(edSnap()); if (ed.undo.length > 150) ed.undo.shift(); ed.redo = []; }
function edUndo() { if (!ed.undo.length) return; ed.redo.push(edSnap()); ed.track = JSON.parse(ed.undo.pop()); edAfter(); }
function edRedo() { if (!ed.redo.length) return; ed.undo.push(edSnap()); ed.track = JSON.parse(ed.redo.pop()); edAfter(); }
function edAfter() { for (const id of [...ed.sel]) if (!edEl(id)) ed.sel.delete(id); edRebuild(); edPanels(); }
const edEl = id => ed.track.elements.find(e => e.id === id);
function edSaveSoon() { ed.saveT = 1.2; }
function edSaveNow() { if (ed.track) { rgSave(ed.track); ed.saveT = 0; } }
function edRebuild() {
  ed.track = RG.cleanTrack(ed.track); ed.B = RG.buildTrack(ed.track, ed.track.venue.kind === 'map' ? world : null); RG.autoFace(ed.track, ed.B);
  ed.B = RG.buildTrack(ed.track, ed.track.venue.kind === 'map' ? world : null); ed.meshes = rgDraw(ed.B, { editor: true, hiddenLayers: ed.hidden }); ed.chk = RG.checks(ed.B);
  rgClear(ed.extras); edOverlays(); edSaveSoon();
}
// the overlays: selection boxes, the flow line (coloured by the speed the line allows), the collision view, the path being drawn
function edOverlays() {
  for (const id of ed.sel) { const m = ed.meshes.get(id); if (!m) continue; const h = new THREE.BoxHelper(m, 0xffd34d); h.userData.ownMat = true; ed.extras.add(h); }
  if (ed.showFlow) for (const l of RG.flow(ed.B)) { const k = Math.min(1, l.speed / (RG.PRESETS.racegow.speed * 1.2)), col = new THREE.Color().setHSL(0.33 * k, 1, 0.5);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(l.a.x, l.a.y, l.a.z), new THREE.Vector3(l.b.x, l.b.y, l.b.z)]), new THREE.LineDashedMaterial({ color: col, dashSize: 0.15, gapSize: 0.08 })); ln.computeLineDistances(); ln.userData.ownMat = true; ed.extras.add(ln);
    if (l.turn > 100) { const s = rgText(Math.round(l.turn) + '°', '#ff9a5a', 0.08); s.position.set(l.b.x, l.b.y + 0.5, l.b.z); ed.extras.add(s); } }
  if (ed.showCol) for (const pr of ed.B.prims) { const col = pr.surf === RG.SURF.soft ? 0x39ff6a : pr.surf === RG.SURF.hard ? 0xff3344 : 0xffa33a; let m;
    if (pr.type === 'box') { m = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(pr.h.x * 2, pr.h.y * 2, pr.h.z * 2)), new THREE.LineBasicMaterial({ color: col })); m.position.set(pr.c.x, pr.c.y, pr.c.z); if (pr.m) m.quaternion.setFromRotationMatrix(new THREE.Matrix4().set(pr.m[0], pr.m[1], pr.m[2], 0, pr.m[3], pr.m[4], pr.m[5], 0, pr.m[6], pr.m[7], pr.m[8], 0, 0, 0, 0, 1)); }
    else if (pr.type === 'capsule') m = pipeMesh(pr.a, pr.b, pr.r * 1.02, new THREE.MeshBasicMaterial({ color: col, wireframe: true })); else continue; m.userData.ownMat = true; ed.extras.add(m); }
  if (ed.path && ed.path.pts.length) { const P = ed.path.pts.map(q => new THREE.Vector3(q[0], q[1], q[2])); if (ed.path.hover) P.push(ed.path.hover);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color: 0x59d3e8 })); ln.userData.ownMat = true; ed.extras.add(ln);
    for (const p of P) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x59d3e8 })); d.userData.ownMat = true; d.position.copy(p); ed.extras.add(d); } }
  if (ed.place && ed.place.ghost) ed.extras.add(ed.place.ghost);
  // too low under the ceiling, or a problem the checklist found: a red marker over it
  const bad = new Set((ed.chk ? ed.chk.checks : []).filter(c => c.level === 'fail' || c.level === 'warn').flatMap(c => c.ids));
  for (const id of bad) { const m = ed.meshes.get(id); if (!m) continue; const bb = new THREE.Box3().setFromObject(m), s = rgText('!', '#ff5a5a', 0.14); s.position.set((bb.min.x + bb.max.x) / 2, bb.max.y + 0.15, (bb.min.z + bb.max.z) / 2); ed.extras.add(s); }
}
// ---- cameras: perspective (orbit), top (orthographic), or both side by side
function edCams() {
  const c = ed.cam, cp = Math.cos(c.pitch); edCamP.position.copy(c.t).add(new THREE.Vector3(Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp).multiplyScalar(c.dist)); edCamP.up.set(0, 1, 0); edCamP.lookAt(c.t);
  const T = ed.topCam; edCamO.position.set(T.t.x, 80, T.t.z); edCamO.up.set(0, 0, -1); edCamO.lookAt(T.t.x, 0, T.t.z); }
function edViewRects() { const W = innerWidth, H = innerHeight; if (ed.view === 'split') return [{ cam: edCamP, x: 0, w: W / 2 }, { cam: edCamO, x: W / 2, w: W / 2 }]; return [{ cam: ed.view === 'top' ? edCamO : edCamP, x: 0, w: W }]; }
function editorFrame(dt) {
  edGamepad(dt); edKeysMove(dt); edCams(); edHandlesUpdate(); rgLedTick(performance.now() / 1000); if (ed.saveT > 0 && (ed.saveT -= dt) <= 0) edSaveNow();
  droneMesh.visible = false; const H = innerHeight, rects = edViewRects();
  renderer.setScissorTest(rects.length > 1);
  for (const r of rects) { const a = r.w / H; if (r.cam === edCamP) { edCamP.aspect = a; edCamP.updateProjectionMatrix(); rgCutaway(edCamP); } else { const h = ed.topCam.dist * 0.5; edCamO.left = -h * a; edCamO.right = h * a; edCamO.top = h; edCamO.bottom = -h; edCamO.updateProjectionMatrix(); rgCutaway(edCamO); for (const g of Object.values(rgRooms)) for (const w of g.userData.walls) if (w.ceiling) w.m.visible = false; }
    renderer.setViewport(r.x, 0, r.w, H); renderer.setScissor(r.x, 0, r.w, H); renderer.render(scene, r.cam); }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, innerWidth, H); droneMesh.visible = true;
  frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
}
function edKeysMove(dt) { const k = ed.keys; if (!(k.KeyW || k.KeyA || k.KeyS || k.KeyD || k.KeyQ || k.KeyE) || ed.sel.size && (k.KeyW || k.KeyS)) return; const c = ed.view === 'top' ? ed.topCam : ed.cam, sp = c.dist * 0.8 * dt, yaw = ed.view === 'top' ? 0 : ed.cam.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
  if (k.KeyW) { c.t.x -= sn * sp; c.t.z -= cs * sp; } if (k.KeyS) { c.t.x += sn * sp; c.t.z += cs * sp; } if (k.KeyA) { c.t.x -= cs * sp; c.t.z += sn * sp; } if (k.KeyD) { c.t.x += cs * sp; c.t.z -= sn * sp; } if (k.KeyQ) c.t.y = Math.max(0, c.t.y - sp); if (k.KeyE) c.t.y += sp; }
// gamepad: left stick pans, right stick orbits, triggers zoom, A places / picks, B backs out
function edGamepad(dt) { const p = allPads()[0]; if (!p) return; const ax = i => { const v = p.axes[i] || 0; return Math.abs(v) < 0.15 ? 0 : v; }, c = ed.cam, sp = c.dist * dt, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
  c.t.x += (ax(0) * cs + ax(1) * sn) * sp; c.t.z += (-ax(0) * sn + ax(1) * cs) * sp; c.yaw -= ax(2) * dt * 2; c.pitch = Math.max(-0.2, Math.min(1.5, c.pitch - ax(3) * dt * 1.5));
  const zt = ((p.buttons[7] || {}).value || 0) - ((p.buttons[6] || {}).value || 0); c.dist = Math.max(0.6, Math.min(120, c.dist * (1 - zt * dt * 1.5))); }
// ---- picking
const edRayC = new THREE.Raycaster();
function edRay(e) { const r = canvas.getBoundingClientRect(), rects = edViewRects(); let R0 = rects[0]; for (const q of rects) if (e.clientX - r.left >= q.x && e.clientX - r.left < q.x + q.w) R0 = q;
  ed.mouse.set(((e.clientX - r.left - R0.x) / R0.w) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); edRayC.setFromCamera(ed.mouse, R0.cam); edRayC.cam = R0.cam; return edRayC; }
function edPick(e) { for (const h of edRay(e).intersectObjects(rgRoot.children, true)) { let o = h.object; if (!o.visible || o.isSprite) continue; while (o && !o.userData.eid) o = o.parent; if (o && !ed.locked.has(edEl(o.userData.eid) && edEl(o.userData.eid).layer)) return o.userData.eid; } return null; }
const edQ = v => ed.snap ? Math.round(v / ed.snap) * ed.snap : Math.round(v * 1000) / 1000, edQA = a => ed.aSnap ? Math.round(a / ed.aSnap) * ed.aSnap : Math.round(a * 10) / 10;
// where the mouse is on the floor; with magnetic snap, on top of whatever is under it (a table, a platform)
function edFloor(e, y0 = 0, skip) { const r = edRay(e); if (ed.magnet) { const hits = r.intersectObjects([...rgRoot.children.filter(m => !skip || !skip.has(m.userData.eid)), ...(rgVenueOn ? [rgVenueOn] : [])], true);
    for (const h of hits) { if (!h.face || h.object.isSprite || h.object.material && h.object.material.transparent) continue; const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.y > 0.7) return h.point.clone(); } }
  const p = new THREE.Vector3(); return r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y0), p) ? p : null; }
function edClamp(e) { const V = ed.B.venue; if (!V.indoor) return; const b = V.bounds; e.x = Math.max(b.x[0] + 0.02, Math.min(b.x[1] - 0.02, e.x)); e.z = Math.max(b.z[0] + 0.02, Math.min(b.z[1] - 0.02, e.z)); e.y = Math.max(0, Math.min(V.ceiling - 0.02, e.y)); }
// ---- placing from the palette: a see-through preview follows the mouse; click places it (Shift keeps placing); [ ] turn it
function edStartPlace(type) { ed.place = { type }; ed.path = null; edPlaceGhost(null); edHint(`Placing ${RG.CATALOG[type].label}: click to place, Shift+click to keep placing, [ ] to turn, Esc to stop`); }
function edPlaceGhost(p) { const P = ed.place; if (!P) return; if (P.ghost) { ed.extras.remove(P.ghost); rgClear(P.ghost); }
  const e = RG.newElement(P.type, p ? { x: edQ(p.x), y: P.type === 'hangingPlant' || P.type === 'ceilingBeam' ? ed.B.ceiling : edQ(p.y), z: edQ(p.z), ry: ed.placeRy } : { x: 0, y: -50, z: 0 }), parts = RG.elementParts(e, ed.B.ctx);
  const g = rgElementMesh({ eid: 'ghost', ...parts }, { editor: true }); g.traverse(o => { if (o.material && !o.isSprite) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.userData.ownMat = true; } });
  P.ghost = g; P.el = e; ed.extras.add(g); }
function edPlaceAt(e, keep) { const P = ed.place, p = edFloor(e); if (!P || !p) return; edPush(); const el = P.el; edClamp(el); ed.track.elements.push(el);
  if (RG.CATALOG[el.type].gate && !RG.CATALOG[el.type].start && !RG.CATALOG[el.type].finish) ed.track.route = [...RG.routeOf(ed.track).map(x => x.id).filter(id => id !== el.id), el.id];
  ed.sel = new Set([el.id]); if (!keep) ed.place = null; edRebuild(); edPanels(); if (keep) edPlaceGhost(p); }
// ---- handles: arrows move along X / Y / Z, the ring turns about the vertical (drag the piece itself to slide it on the floor)
const EH = { grp: new THREE.Group() };
(function edHandles() { const mk = (col, dir, id) => { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: col, depthTest: false }); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), m); shaft.position.y = 0.3; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 10), m); tip.position.y = 0.66; g.add(shaft, tip);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.userData.h = id; g.traverse(o => { o.renderOrder = 20; o.userData.h = id; }); EH.grp.add(g); };
  mk(0xff4040, new THREE.Vector3(1, 0, 0), 'x'); mk(0x40ff60, new THREE.Vector3(0, 1, 0), 'y'); mk(0x4080ff, new THREE.Vector3(0, 0, 1), 'z');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.014, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffd34d, depthTest: false })); ring.rotation.x = Math.PI / 2; ring.userData.h = 'ry'; ring.renderOrder = 20; EH.grp.add(ring);
  EH.grp.visible = false; scene.add(EH.grp); })();
function edPivot() { const L = [...ed.sel].map(edEl).filter(Boolean); if (!L.length) return null; const c = new THREE.Vector3(); for (const e of L) c.add(new THREE.Vector3(e.x, e.y, e.z)); return c.multiplyScalar(1 / L.length); }
function edHandlesUpdate() { const pv = mode === 'editor' && !ed.place && !ed.path ? edPivot() : null; EH.grp.visible = !!pv; if (!pv) return; EH.grp.position.copy(pv); EH.grp.scale.setScalar((ed.view === 'top' ? ed.topCam.dist * 0.5 : edCamP.position.distanceTo(pv)) * 0.14); }
function edHandlePick(e) { if (!EH.grp.visible) return null; for (const h of edRay(e).intersectObjects(EH.grp.children, true)) if (h.object.userData.h) return h.object.userData.h; return null; }
// ---- mouse
canvas.addEventListener('contextmenu', e => { if (mode === 'editor') e.preventDefault(); });
canvas.addEventListener('pointerdown', e => {
  if (mode !== 'editor') return; canvas.setPointerCapture(e.pointerId); edCams(); edHandlesUpdate();
  if (e.button === 1 || e.button === 2 || e.altKey) { ed.drag = { kind: e.button === 1 || e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY, top: edRay(e).cam === edCamO }; return; }
  if (ed.path) { const p = edFloor(e); if (p) { ed.path.pts.push([edQ(p.x), +$('#edPathY').value || 0.6, edQ(p.z)]); edRebuildOverlays(); } return; }
  if (ed.place) { edPlaceAt(e, e.shiftKey); return; }
  const h = edHandlePick(e); if (h) { edPush(); const pv = edPivot(), L = [...ed.sel].map(edEl).filter(Boolean); ed.drag = { kind: 'handle', h, pv, start: L.map(x => ({ id: x.id, x: x.x, y: x.y, z: x.z, ry: x.ry })), x: e.clientX, y: e.clientY, cam: edRay(e).cam }; return; }
  const id = edPick(e);
  if (!id) { if (!e.shiftKey && !e.ctrlKey) ed.sel.clear(); edRebuildOverlays(); edPanels(); ed.drag = { kind: 'orbit', x: e.clientX, y: e.clientY, top: edRay(e).cam === edCamO }; return; }
  if (e.shiftKey || e.ctrlKey) { if (ed.sel.has(id)) ed.sel.delete(id); else ed.sel.add(id); } else if (!ed.sel.has(id)) ed.sel = new Set([id]);
  edPanels(); edRebuildOverlays(); const f = edFloor(e, edEl(id).y, ed.sel); edPush(); ed.drag = { kind: 'slide', from: f, start: [...ed.sel].map(edEl).filter(Boolean).map(x => ({ id: x.id, x: x.x, z: x.z, y: x.y })), moved: false };
});
canvas.addEventListener('pointermove', e => {
  if (mode !== 'editor') return; const d = ed.drag;
  if (!d) { if (ed.place) { const p = edFloor(e); if (p) { const el = ed.place.el; el.x = edQ(p.x); el.z = edQ(p.z); el.y = ed.place.type === 'hangingPlant' || ed.place.type === 'ceilingBeam' ? ed.B.ceiling : edQ(p.y); el.ry = ed.placeRy; edPlaceGhost(p); } } else if (ed.path) { const p = edFloor(e); ed.path.hover = p ? new THREE.Vector3(p.x, +$('#edPathY').value || 0.6, p.z) : null; edRebuildOverlays(); } return; }
  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (d.kind === 'orbit' && !d.top) { ed.cam.yaw -= dx * 0.006; ed.cam.pitch = Math.max(-0.2, Math.min(1.55, ed.cam.pitch + dy * 0.005)); d.x = e.clientX; d.y = e.clientY; return; }
  if (d.kind === 'pan' || d.kind === 'orbit' && d.top) { const C = d.top ? ed.topCam : ed.cam, k = C.dist * 0.0016, yaw = d.top ? 0 : ed.cam.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    C.t.x -= (dx * cs + dy * sn) * k; C.t.z -= (-dx * sn + dy * cs) * k; d.x = e.clientX; d.y = e.clientY; return; }
  if (d.kind === 'slide') { if (!d.from || ed.locked.size && [...ed.sel].some(id => ed.locked.has(edEl(id).layer))) return; const p = edFloor(e, d.start[0].y, ed.sel); if (!p) return; d.moved = true;
    for (const s of d.start) { const el = edEl(s.id); el.x = edQ(s.x + p.x - d.from.x); el.z = edQ(s.z + p.z - d.from.z); if (ed.magnet && d.start.length === 1 && Math.abs(p.y - s.y) < 2) el.y = Math.max(0, edQ(p.y)); edClamp(el); }
    edPreview(); return; }
  if (d.kind === 'handle') { const scale = (d.cam === edCamO ? ed.topCam.dist : edCamP.position.distanceTo(d.pv)) * 0.0018;
    for (const s of d.start) { const el = edEl(s.id); if (!el) continue;
      if (d.h === 'ry') { el.ry = ((edQA(s.ry + dx * 0.5) % 360) + 540) % 360 - 180; if (d.start.length > 1) { const a = (el.ry - s.ry) * Math.PI / 180, ox = s.x - d.pv.x, oz = s.z - d.pv.z; el.x = edQ(d.pv.x + ox * Math.cos(a) + oz * Math.sin(a)); el.z = edQ(d.pv.z - ox * Math.sin(a) + oz * Math.cos(a)); } }
      else { const ax = new THREE.Vector3(d.h === 'x' ? 1 : 0, d.h === 'y' ? 1 : 0, d.h === 'z' ? 1 : 0), a0 = d.pv.clone().project(d.cam), a1 = d.pv.clone().add(ax).project(d.cam), sx = (a1.x - a0.x) * innerWidth / 2, sy = -(a1.y - a0.y) * innerHeight / 2, L = Math.hypot(sx, sy);
        const mv = L > 8 ? (dx * sx + dy * sy) / (L * L) : (dx - dy) * scale; el[d.h] = edQ(s[d.h] + mv); if (d.h === 'y') el.y = Math.max(0, el.y); edClamp(el); } }
    edPreview(); }
});
canvas.addEventListener('pointerup', e => { if (mode !== 'editor') return; const d = ed.drag; ed.drag = null; if (d && (d.kind === 'slide' || d.kind === 'handle')) { if (d.kind === 'slide' && !d.moved) ed.undo.pop(); edRebuild(); edPanels(); } });
canvas.addEventListener('wheel', e => { if (mode !== 'editor') return; e.preventDefault(); const top = edRay(e).cam === edCamO, C = top ? ed.topCam : ed.cam;
  if (ed.place && (e.ctrlKey || e.metaKey)) { ed.placeRy = edQA(ed.placeRy + Math.sign(e.deltaY) * (ed.aSnap || 5)); return; } C.dist = Math.max(0.5, Math.min(150, C.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
function edPreview() { edRebuildFast(); }
let edFastT = 0; function edRebuildFast() { const now = performance.now(); if (now - edFastT < 60) return; edFastT = now; ed.B = RG.buildTrack(ed.track, ed.track.venue.kind === 'map' ? world : null); ed.meshes = rgDraw(ed.B, { editor: true, hiddenLayers: ed.hidden }); edRebuildOverlays(); edInspectorLive(); }
function edRebuildOverlays() { rgClear(ed.extras); edOverlays(); }
// ---- keys
addEventListener('keydown', e => {
  if (mode !== 'editor' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; ed.keys[e.code] = true; const c = e.ctrlKey || e.metaKey;
  if (e.code === 'Escape') { e.preventDefault(); if (ed.place) { ed.place = null; edRebuildOverlays(); edHint(''); } else if (ed.path) { ed.path = null; edRebuildOverlays(); edHint(''); } else if (ed.sel.size) { ed.sel.clear(); edPanels(); edRebuildOverlays(); } else edClose(); return; }
  if (e.code === 'Enter' && ed.path) { edAct('pathDone'); return; }
  if (c && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? edRedo() : edUndo(); return; } if (c && e.code === 'KeyY') { e.preventDefault(); edRedo(); return; }
  if (c && e.code === 'KeyD' || !c && e.code === 'KeyD' && e.shiftKey) { e.preventDefault(); edAct('dup'); return; }
  if (c && e.code === 'KeyC') { edAct('copy'); return; } if (c && e.code === 'KeyV') { edAct('paste'); return; } if (c && e.code === 'KeyS') { e.preventDefault(); edSaveNow(); edHint('Saved'); return; }
  if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); edAct('delete'); return; }
  if (e.code === 'BracketLeft' || e.code === 'BracketRight') { const d = (e.code === 'BracketLeft' ? -1 : 1) * (ed.aSnap || 5); if (ed.place) { ed.placeRy = edQA(ed.placeRy + d); return; } if (ed.sel.size) { edPush(); for (const id of ed.sel) { const el = edEl(id); el.ry = ((edQA(el.ry + d) % 360) + 540) % 360 - 180; } edRebuild(); edPanels(); } return; }
  if (e.code === 'KeyG' && ed.sel.size) { edAct('ground'); return; } if (e.code === 'KeyF') { edAct('focus'); return; }
  if (e.code === 'Digit1') edAct('view:persp'); if (e.code === 'Digit2') edAct('view:top'); if (e.code === 'Digit3') edAct('view:split');
  if (e.code === 'KeyT' && !ed.sel.size) edAct('test');
});
addEventListener('keyup', e => { ed.keys[e.code] = false; });
// ---- actions
function edAct(a) {
  const [k, v] = a.split(/:(.*)/s), sel = [...ed.sel].map(edEl).filter(Boolean);
  if (k === 'view') { ed.view = v; if (v === 'top') ed.topCam.t.copy(ed.cam.t); edPanels(); resize(); }
  if (k === 'undo') edUndo(); if (k === 'redo') edRedo();
  if (k === 'delete' && sel.length) { edPush(); const ids = new Set(sel.map(x => x.id)); ed.track.elements = ed.track.elements.filter(x => !ids.has(x.id)); ed.track.route = ed.track.route.filter(id => !ids.has(id)); ed.sel.clear(); edRebuild(); edPanels(); }
  if (k === 'dup' && sel.length) { edPush(); const ns = sel.map(x => ({ ...JSON.parse(JSON.stringify(x)), id: RG.uid(), x: x.x + 0.5, z: x.z + 0.5 })); ed.track.elements.push(...ns); ed.sel = new Set(ns.map(x => x.id)); edRebuild(); edPanels(); }
  if (k === 'copy' && sel.length) { ed.clip = JSON.parse(JSON.stringify(sel)); edHint(`Copied ${sel.length}`); }
  if (k === 'paste' && ed.clip) { edPush(); const cx = ed.clip.reduce((s, x) => s + x.x, 0) / ed.clip.length, cz = ed.clip.reduce((s, x) => s + x.z, 0) / ed.clip.length, tgt = ed.cam.t;
    const ns = ed.clip.map(x => ({ ...JSON.parse(JSON.stringify(x)), id: RG.uid(), x: edQ(x.x - cx + tgt.x), z: edQ(x.z - cz + tgt.z) })); ed.track.elements.push(...ns); ed.sel = new Set(ns.map(x => x.id)); edRebuild(); edPanels(); }
  if (k === 'ground' && sel.length) { edPush(); for (const el of sel) el.y = 0; edRebuild(); edPanels(); }
  if (k === 'focus') { const p = edPivot(); if (p) { ed.cam.t.copy(p); ed.topCam.t.copy(p); ed.cam.dist = Math.min(ed.cam.dist, 4); } }
  if (k === 'mirror' && sel.length) { edPush(); const [axis, copy] = v.split(','), c = edPivot(), about = axis === 'x' ? c.x : c.z; let ids = sel.map(x => x.id);
    if (copy === 'copy') { const ns = sel.map(x => ({ ...JSON.parse(JSON.stringify(x)), id: RG.uid() })); ed.track.elements.push(...ns); ids = ns.map(x => x.id); RG.mirror(ed.track, ids, axis, about + (axis === 'x' ? 1 : 1) * 0); }
    else RG.mirror(ed.track, ids, axis, about); ed.sel = new Set(ids); edRebuild(); edPanels(); }
  if (k === 'mirrorTrack') { edPush(); RG.mirror(ed.track, ed.track.elements.map(x => x.id), v, 0); edRebuild(); edPanels(); }
  if (k === 'path') { ed.place = null; ed.path = { pts: [] }; edHint('Path: click points along the line you want to fly, Enter to place gates along it, Esc to stop'); edPanels(); }
  if (k === 'pathDone' && ed.path) { const P = ed.path; ed.path = null; if (P.pts.length >= 2) { edPush(); const ns = RG.pathGates(P.pts, +$('#edPathGap').value || 2, $('#edPathType').value, RG.CATALOG[$('#edPathType').value].pvc ? {} : { size: +$('#edPathSize').value || 0.4 });
      for (const n of ns) edClamp(n); ed.track.elements.push(...ns); ed.track.route = [...RG.routeOf(ed.track).map(x => x.id).filter(id => !ns.some(n => n.id === id)), ...ns.map(n => n.id)]; ed.sel = new Set(ns.map(x => x.id)); edHint(`Placed ${ns.length} gates`); }
    edRebuild(); edPanels(); }
  if (k === 'place') edStartPlace(v);
  if (k === 'cat') { ed.cat = v; edPanels(); }
  if (k === 'layer') { const [what, L] = v.split(','); const S0 = what === 'hide' ? ed.hidden : ed.locked; if (S0.has(L)) S0.delete(L); else S0.add(L); edRebuild(); edPanels(); }
  if (k === 'snap') { ed.snap = +v; edPanels(); } if (k === 'asnap') { ed.aSnap = +v; edPanels(); } if (k === 'magnet') { ed.magnet = !ed.magnet; edPanels(); }
  if (k === 'col') { ed.showCol = !ed.showCol; edRebuildOverlays(); edPanels(); } if (k === 'flow') { ed.showFlow = !ed.showFlow; edRebuildOverlays(); edPanels(); }
  if (k === 'routeUp' || k === 'routeDown') { edPush(); const R = RG.routeOf(ed.track).map(x => x.id), i = R.indexOf(v), j = i + (k === 'routeUp' ? -1 : 1); if (i >= 0 && j >= 0 && j < R.length) { [R[i], R[j]] = [R[j], R[i]]; ed.track.route = R; } edRebuild(); edPanels(); }
  if (k === 'routeRev') { edPush(); ed.track.route = RG.routeOf(ed.track).map(x => x.id).reverse(); for (const g of RG.routeOf(ed.track)) g.ry = ((g.ry + 180) % 360 + 540) % 360 - 180; const st = ed.track.elements.find(x => x.type === 'start'); if (st) st.ry = ((st.ry + 180) % 360 + 540) % 360 - 180; edRebuild(); edPanels(); }
  if (k === 'sel') { ed.sel = new Set(v.split(',').filter(edEl)); edAct('focus'); edPanels(); edRebuildOverlays(); }
  if (k === 'raceable') { edRebuild(); edPanels(); const ok = ed.chk.ok; edHint(ok ? 'Raceable: every required check passes' : 'Not raceable yet: see the checklist'); if (ok) { const sel1 = ed.chk.checks.filter(c => c.level !== 'pass'); if (sel1.length) ed.sel = new Set(sel1.flatMap(c => c.ids)); } }
  if (k === 'test') { edSaveNow(); const t = ed.track; $('#rgEd').classList.add('hide'); document.body.classList.remove('editing'); rgClear(ed.extras); EH.grp.visible = false; raceStart(t, 'test', { fromEditor: true }); }
  if (k === 'save') { edSaveNow(); edHint('Saved'); } if (k === 'exit') edClose();
  if (k === 'code') rgCode(ed.track).then(c => navigator.clipboard.writeText(c).then(() => edHint('Track code copied'), () => prompt('Track code:', c)));
  edHandlesUpdate();
}
let edHintT = 0; function edHint(t) { const el = $('#edHint2'); if (el) el.textContent = t; edHintT = performance.now(); }
// ---- panels
function edPanels() {
  const T = ed.track; if (!T) return; const cats = RG.CATS, q = ed.search.trim().toLowerCase();
  const lib = Object.values(RG.CATALOG).filter(C => q ? (C.label + ' ' + C.desc + ' ' + C.cat).toLowerCase().includes(q) : C.cat === ed.cat);
  $('#edTopBar').innerHTML = `<button data-ea="exit" title="Back to the track list (Esc)">✕ Exit</button><input id="edName" value="${esc(T.name)}" maxlength="40" title="Track name">
    <span class="edGroup">${['persp', 'top', 'split'].map((v, i) => `<button class="${ed.view === v ? 'on' : ''}" data-ea="view:${v}" title="${['Perspective', 'Top (orthographic)', 'Both side by side'][i]} (${i + 1})">${['3D', 'Top', 'Split'][i]}</button>`).join('')}</span>
    <span class="edGroup">Snap ${[[0, 'free'], [0.01, '1 cm'], [0.05, '5 cm'], [0.1, '10 cm']].map(([v, l]) => `<button class="${ed.snap === v ? 'on' : ''}" data-ea="snap:${v}">${l}</button>`).join('')} <select id="edASnap" title="Angle snap">${[0, 15, 45, 90].map(a => `<option value="${a}" ${ed.aSnap === a ? 'selected' : ''}>${a ? a + '°' : 'free °'}</option>`).join('')}</select><button class="${ed.magnet ? 'on' : ''}" data-ea="magnet" title="Magnetic: things sit on top of what is under them">Magnet</button></span>
    <span class="edGroup"><button data-ea="undo" title="Ctrl+Z">Undo</button><button data-ea="redo" title="Ctrl+Y">Redo</button><button data-ea="dup" title="Ctrl+D">Duplicate</button><button data-ea="delete" title="Del">Delete</button><button data-ea="ground" title="G">Ground</button></span>
    <span class="edGroup"><button class="${ed.path ? 'on' : ''}" data-ea="path" title="Draw the racing line; gates go along it">Path</button><button data-ea="mirror:x" title="Mirror the selection left-right">Mirror ↔</button><button data-ea="mirror:z" title="Mirror the selection front-back">Mirror ↕</button><button data-ea="mirror:x,copy" title="A mirrored copy">Mirror copy</button></span>
    <span class="edGroup"><button class="${ed.showFlow ? 'on' : ''}" data-ea="flow" title="The racing line between gates, coloured by the speed it allows">Flow</button><button class="${ed.showCol ? 'on' : ''}" data-ea="col" title="Show colliders: green soft, red hard, orange solid">Collision</button></span>
    <span class="sp"></span><button data-ea="code">Copy code</button><button data-ea="save">Save</button><button class="primary" data-ea="test" title="Fly it now (T); B comes back">Test fly</button>`;
  $('#edLeftP').innerHTML = `<input id="edSearch" placeholder="Search blocks…" value="${esc(ed.search)}"><div class="edCats">${cats.map(c => `<button class="${!q && ed.cat === c ? 'on' : ''}" data-ea="cat:${c}">${c}</button>`).join('')}</div>
    <div class="edLibHead">${q ? 'Matches' : esc(ed.cat)}</div><div class="edLib">${lib.map(C => `<button class="${ed.place && ed.place.type === C.type ? 'on' : ''}" data-ea="place:${C.type}" title="${esc(C.desc)}">${esc(C.label)}</button>`).join('') || '<p class="hint">Nothing matches.</p>'}</div>
    ${ed.path ? `<h4>Path tool</h4><label>Gate <select id="edPathType">${Object.values(RG.CATALOG).filter(C => C.gate && !C.start && !C.finish && C.type !== 'checkpoint').map(C => `<option value="${C.type}">${esc(C.label)}</option>`).join('')}</select></label>
      <label>Every <input id="edPathGap" type="number" value="2" step="0.25" min="0.5"> m</label><label>Height <input id="edPathY" type="number" value="0.6" step="0.05" min="0.1"> m</label><label>Opening (whoop gates) <input id="edPathSize" type="number" value="0.4" step="0.05" min="0.25"> m</label><button class="primary" data-ea="pathDone">Place gates (Enter)</button>` : ''}
    <h4>Layers</h4><div class="edLayers">${RG.LAYERS.map(L => `<div><span>${L}</span><button class="${ed.hidden.has(L) ? '' : 'on'}" data-ea="layer:hide,${L}" title="Show / hide">👁</button><button class="${ed.locked.has(L) ? 'on' : ''}" data-ea="layer:lock,${L}" title="Lock (cannot be picked)">🔒</button></div>`).join('')}</div>
    <p class="hint">Drag: orbit · right / middle drag: pan · wheel: zoom · WASD QE: move · 1 2 3: views · [ ]: turn · gamepad sticks work too</p>`;
  edRight();
}
function edInspector() {
  const L = [...ed.sel].map(edEl).filter(Boolean), el = $('#edInsp'); if (!el) return; if (!L.length) { el.innerHTML = '<p class="hint">Nothing selected. Pick a block on the left, or click one in the view.</p>'; return; }
  if (L.length > 1) { el.innerHTML = `<p>${L.length} selected</p><p class="hint">Drag the arrows to move them together, the ring to turn them about their middle.</p>`; return; }
  const e = L[0], C = RG.CATALOG[e.type], p = RG.paramsOf(e), n = (k, v, step, lab) => `<label>${lab} <input type="number" data-ef="${k}" value="${+v.toFixed(3)}" step="${step}"></label>`;
  const params = Object.entries(C.params).map(([k, d]) => Array.isArray(d) ? `<label>${esc(d[4])}${d[5] ? ' (' + d[5] + ')' : ''} <input type="range" data-ep="${k}" min="${d[1]}" max="${d[2]}" step="${d[3]}" value="${p[k]}"><output>${+(+p[k]).toFixed(2)}</output></label>`
    : `<label>${esc(d.label)} <select data-ep="${k}">${d.opts.map(o => `<option ${o === p[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`).join('');
  const sizes = C.gate && C.params.size ? `<div class="row">${Object.entries(RG.sizePresets).map(([k, v]) => `<button data-esz="${v}">${k} ${Math.round(v * 100)} cm</button>`).join('')}</div>` : '';
  el.innerHTML = `<p><b>${esc(C.label)}</b> <small>${esc(C.desc)}</small></p><label>Name <input data-ef="name" value="${esc(e.name || '')}" maxlength="40" placeholder="${esc(C.label)}"></label>
    <div class="edXYZ">${n('x', e.x, 0.05, 'X')}${n('y', e.y, 0.05, 'Y')}${n('z', e.z, 0.05, 'Z')}${n('ry', e.ry, 5, 'Turn°')}${n('rx', e.rx, 5, 'Tilt°')}${n('rz', e.rz, 5, 'Lean°')}${n('s', e.s, 0.05, 'Scale')}</div>
    ${sizes}${params}${C.gate && !C.start && !C.finish ? `<label class="chk"><input type="checkbox" data-ef="sector" ${e.sector ? 'checked' : ''}> A sector ends at this gate</label>` : ''}`;
}
function edInspectorLive() { const L = [...ed.sel].map(edEl).filter(Boolean); if (L.length !== 1) return; for (const k of ['x', 'y', 'z', 'ry', 'rx', 'rz', 's']) { const i = document.querySelector(`#edInsp [data-ef="${k}"]`); if (i && document.activeElement !== i) i.value = +L[0][k].toFixed(3); } }
function edRight() {
  const T = ed.track, R = RG.routeOf(T), chk = ed.chk || { checks: [], estimate: {} }, ic = { pass: '✓', warn: '⚠', fail: '✗', note: 'ℹ' };
  $('#edRightP').innerHTML = `<h4>Track</h4><p class="hint">${T.venue.kind === 'map' ? 'on ' + esc(S.MAPS[T.venue.map].title) : esc(RG.ROOMS[T.venue.room].label)}</p>
    <label>Laps (time attack) <input type="number" id="edLaps" min="1" max="20" value="${T.laps}"></label>
    ${T.venue.kind === 'room' ? `<label>Lighting <select id="edLight">${Object.entries(RG.LIGHTING).map(([k, l]) => `<option value="${k}" ${T.lighting === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
    <label>PVC section size (in) <input type="number" id="edSec" min="24" max="96" step="1" value="${Math.round(T.section / 0.0254)}"></label>
    <label>Tags <span class="edTags">${RG.TAGS.map(g => `<label class="chk"><input type="checkbox" data-etag="${g}" ${T.tags.includes(g) ? 'checked' : ''}>${g}</label>`).join('')}</span></label>
    <h4>Selection</h4><div id="edInsp"></div>
    <h4>Route <small>${R.length} gates</small> <button data-ea="routeRev" title="Fly it the other way round">Reverse</button></h4><ol class="edRoute">${R.map((g, i) => `<li class="${ed.sel.has(g.id) ? 'on' : ''}"><a data-ea="sel:${g.id}">${esc(g.name || RG.CATALOG[g.type].label)}${g.sector ? ' ⏱' : ''}</a><button data-ea="routeUp:${g.id}" ${i ? '' : 'disabled'}>↑</button><button data-ea="routeDown:${g.id}" ${i < R.length - 1 ? '' : 'disabled'}>↓</button></li>`).join('')}</ol>
    <h4>Make raceable <button data-ea="raceable">Check</button></h4><div class="edChk">${chk.checks.map(c => `<div class="${c.level}" ${c.ids.length ? `data-ea="sel:${c.ids.join(',')}"` : ''}>${ic[c.level]} ${esc(c.text)}</div>`).join('')}</div>`;
  edInspector();
}
// panel clicks and edits
document.addEventListener('click', e => { const b = e.target.closest('[data-ea]'); if (b && b.closest('#rgEd')) { edAct(b.dataset.ea); return; }
  const z = e.target.closest('[data-esz]'); if (z && z.closest('#rgEd')) { const el = edEl([...ed.sel][0]); if (el) { edPush(); el.p.size = +z.dataset.esz; edRebuild(); edPanels(); } } });
document.addEventListener('input', e => { if (!e.target.closest('#rgEd')) return; const t = e.target;
  if (t.id === 'edSearch') { ed.search = t.value; const pos = t.selectionStart; edPanels(); const s = $('#edSearch'); s.focus(); s.setSelectionRange(pos, pos); return; }
  if (t.dataset.ep) { const el = edEl([...ed.sel][0]); if (!el) return; if (!ed.liveP) { edPush(); ed.liveP = true; } el.p[t.dataset.ep] = t.type === 'range' ? +t.value : t.value; if (t.nextElementSibling && t.nextElementSibling.tagName === 'OUTPUT') t.nextElementSibling.textContent = (+t.value).toFixed(2); edRebuildFast(); } });
document.addEventListener('change', e => { if (!e.target.closest('#rgEd')) return; const t = e.target, el = edEl([...ed.sel][0]); ed.liveP = false;
  if (t.id === 'edName') { ed.track.name = t.value.slice(0, 40); edSaveSoon(); return; }
  if (t.id === 'edASnap') { ed.aSnap = +t.value; return; }
  if (t.id === 'edLaps') { edPush(); ed.track.laps = +t.value || 3; edRebuild(); return; }
  if (t.id === 'edLight') { edPush(); ed.track.lighting = t.value; rgVenue(ed.track); edSaveSoon(); return; }
  if (t.id === 'edSec') { edPush(); ed.track.section = Math.max(24, +t.value || 24) * 0.0254; edRebuild(); edPanels(); return; }
  if (t.dataset.etag) { const s = new Set(ed.track.tags); t.checked ? s.add(t.dataset.etag) : s.delete(t.dataset.etag); ed.track.tags = [...s]; edSaveSoon(); return; }
  if (!el) return;
  if (t.dataset.ef) { edPush(); const k = t.dataset.ef; if (k === 'name') el.name = t.value; else if (k === 'sector') el.sector = t.checked; else el[k] = +t.value || 0; edClamp(el); edRebuild(); edPanels(); return; }
  if (t.dataset.ep) { edRebuild(); edPanels(); } });
