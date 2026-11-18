
// ============================================================ RaceGOW: rooms, PVC gates, racing and the track editor
// (concatenated after game.js into the same module by build.py, so it shares its scope: scene, drone, MAT, show, …)
const RC = window.Race;

// ---- materials: white PVC (and coloured PVC), connectors, rooms
const PVC = {};
let raceMatsDone = false;
function raceMats() {
  if (raceMatsDone) return; raceMatsDone = true;
  for (const [k, c] of Object.entries(RC.COLORS)) {
    PVC[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.42, metalness: 0.0 });
    PVC[k + 'Hot'] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: 0xff8a1a, emissiveIntensity: 0.85 });
  }
  PVC.joint = new THREE.MeshStandardMaterial({ color: 0xe9e9e2, roughness: 0.5 });
  PVC.arrow = new THREE.MeshStandardMaterial({ color: 0x2f7bff, roughness: 0.5, side: THREE.DoubleSide });
  PVC.flagA = new THREE.MeshStandardMaterial({ color: 0xff3d2e, roughness: 0.8, side: THREE.DoubleSide });
  PVC.flagB = new THREE.MeshStandardMaterial({ color: 0x2f7bff, roughness: 0.8, side: THREE.DoubleSide });
  { const [c, g] = cnv(128, 32); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5'; g.fillRect(x * 8, y * 8, 8, 8); }
    PVC.checker = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.8, side: THREE.DoubleSide }); }
  PVC.panel = new THREE.MeshBasicMaterial({ color: 0x2fd24a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  PVC.panelEd = new THREE.MeshBasicMaterial({ color: 0x2fd24a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
  PVC.panelLine = new THREE.LineBasicMaterial({ color: 0x2fd24a }); PVC.arrowGo = new THREE.MeshBasicMaterial({ color: 0x9dffb0 });
  PVC.flight = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  PVC.pad = new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.9 }); PVC.resetOk = new THREE.MeshBasicMaterial({ color: 0x7dff9a }); PVC.resetBad = new THREE.MeshBasicMaterial({ color: 0xff5a5a });
  PVC.padMark = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  // rooms
  const mk = (draw, w = 256, h = 256, rep = 1) => { const [c, g] = cnv(w, h); draw(g, w, h); return tex(c, rep); };
  const hard = mk((g, w, h) => { for (let i = 0; i < 8; i++) { const y = i * h / 8; g.fillStyle = `hsl(${28 + rnd() * 6},${42 + rnd() * 10}%,${36 + rnd() * 10}%)`; g.fillRect(0, y, w, h / 8);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 1.5); const cut = rnd() * w; g.fillRect(cut, y, 1.5, h / 8);
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(60,30,10,${0.08 + rnd() * 0.1})`; g.beginPath(); const yy = y + rnd() * h / 8; g.moveTo(0, yy); g.bezierCurveTo(w / 3, yy + rnd() * 4 - 2, w * 2 / 3, yy + rnd() * 4 - 2, w, yy); g.stroke(); } } });
  MAT.hardwood = new THREE.MeshStandardMaterial({ map: hard, roughness: 0.55 });
  MAT.drywall = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#d9d3c7'; g.fillRect(0, 0, w, h); speckle(g, w, h, 900, ['#cfc8bb', '#e2ddd2'], 1, 2, 0.4); }), roughness: 0.95 });
  MAT.ceiling = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 1 });
  MAT.fabric = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#4a5a6e'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['#3f4e60', '#56677c'], 1, 2, 0.6); }), roughness: 1 });
  MAT.darkwood = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#3d2a1c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(20,10,5,0.25)'; g.beginPath(); const y = rnd() * h; g.moveTo(0, y); g.lineTo(w, y + rnd() * 6 - 3); g.stroke(); } }), roughness: 0.6 });
  MAT.tv = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.15, metalness: 0.4, emissive: 0x0a1630, emissiveIntensity: 0.6 });
  MAT.rug = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#7a2b2b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9b46a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w / 2, h / 2, 12 + i * 14, 0, 7); g.stroke(); } speckle(g, w, h, 1500, ['#6a2222', '#8a3434'], 1, 2, 0.5); }), roughness: 1 });
  MAT.pot = new THREE.MeshStandardMaterial({ color: 0xb5643c, roughness: 0.8 });
  MAT.garageFloor = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#9c9a95'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2500, ['#959390', '#a5a39e', '#8a8884'], 1, 2, 0.35);
    g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, h - 1); g.lineTo(w, h - 1); g.moveTo(w - 1, 0); g.lineTo(w - 1, h); g.stroke(); }), roughness: 0.9 });
  MAT.cinder = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#b9b6ad'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(70,68,62,0.55)'; g.lineWidth = 3;
    for (let r = 0; r < 4; r++) { const y = r * h / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let k = 0; k < 2; k++) { const x = (k + (r % 2) * 0.5) * w / 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / 4); g.stroke(); } }
    speckle(g, w, h, 1800, ['#a9a69d', '#c6c3ba'], 1, 2, 0.5); }), roughness: 0.95 });
  MAT.plywood = new THREE.MeshStandardMaterial({ color: 0xc89b62, roughness: 0.75 });
  MAT.pegboard = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#b48a58'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a4128'; for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); } }), roughness: 0.8 });
  MAT.binBlue = new THREE.MeshStandardMaterial({ color: 0x2f5fb3, roughness: 0.5 }); MAT.binRed = new THREE.MeshStandardMaterial({ color: 0xb33a2f, roughness: 0.5, metalness: 0.2 });
  MAT.garageDoor = new THREE.MeshStandardMaterial({ map: mk((g, w, h) => { g.fillStyle = '#e6e3dc'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } }), roughness: 0.7 });
  MAT.rackOrange = new THREE.MeshStandardMaterial({ color: 0xe0701e, roughness: 0.55, metalness: 0.3 }); MAT.rackBlue = new THREE.MeshStandardMaterial({ color: 0x2b55a8, roughness: 0.55, metalness: 0.3 });
  MAT.lightPanel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 1.2 });
}

// ---- rooms (one group per environment, built on first use) and switching between them and the playground
const envRoots = {}; const outdoorFog = scene.fog;
function envGroup(env) {
  if (envRoots[env]) return envRoots[env];
  raceMats(); const E = RC.ENVIRONMENTS[env].build(), g = new THREE.Group(); g.userData.walls = [];
  for (const z of E.zones) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(z.h.x * 2, z.h.z * 2), MAT[z.mat]); const uv = pl.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * z.h.x * 2 / 1.6, uv.getY(i) * z.h.z * 2 / 1.6); pl.rotation.x = -Math.PI / 2; pl.position.set(z.c.x, 0.001, z.c.z); pl.receiveShadow = true; g.add(pl); }
  for (const o of E.objs) for (const v of o.vis) {
    let m; if (v.shape === 'box') { m = new THREE.Mesh(boxGeo(v.h, v.mat === 'rug' ? 1 / (2 * Math.max(v.h.x, v.h.z)) : v.mat === 'cinder' || v.mat === 'drywall' ? 0.5 : 1), MAT[v.mat] || MAT.concrete); m.position.set(v.c.x, v.c.y, v.c.z); m.rotation.set(v.euler[0], v.euler[1], v.euler[2], 'YXZ'); }
    else if (v.shape === 'pipe') m = pipeMesh(v.a, v.b, v.r, MAT[v.mat] || MAT.galv);
    if (!m) continue; m.castShadow = o.kind !== 'wall' && o.kind !== 'building'; m.receiveShadow = true; g.add(m);
    if (o.kind === 'wall' || o.kind === 'building') g.userData.walls.push({ m, c: v.c, h: v.h, ceiling: o.kind === 'building' });
  }
  g.add(new THREE.HemisphereLight(0xfff6ea, 0x6d5f50, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.6); sun.position.set(E.size.x * 0.2, E.size.h + 6, E.size.z * 0.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera, M = Math.max(E.size.x, E.size.z) / 2 + 1; sc.left = -M; sc.right = M; sc.top = M; sc.bottom = -M; sc.near = 0.5; sc.far = E.size.h + 20; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  g.add(sun); g.add(sun.target);
  for (const [x, y, z] of E.lights) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 0.4), MAT.lightPanel); p.position.set(x, y - 0.02, z); g.add(p); g.userData.walls.push({ m: p, c: { x, y, z }, h: { x: 0.5, y: 0.015, z: 0.2 }, ceiling: true }); const l = new THREE.PointLight(0xfff1dc, 3, E.size.x, 1.6); l.position.set(x, y - 0.3, z); g.add(l); }
  g.userData.size = E.size; g.visible = false; scene.add(g); envRoots[env] = g; return g;
}
let curEnv = 'playground';
function setEnv(env) {
  curEnv = env; const indoor = env !== 'playground';
  playRoot.visible = !indoor; for (const [k, g] of Object.entries(envRoots)) g.visible = k === env;
  if (indoor) { envGroup(env).visible = true; scene.fog = null; scene.background = new THREE.Color(0x1a1a1e); } else { scene.fog = outdoorFog; scene.background = null; }
}
function useWorld(w) { activeWorld = w; drone.world = w; detector.world = w; detector.reset(); }
// in the editor the camera is often outside the room: hide whichever walls (and the ceiling) are between it and the inside
function cutaway(cam) {
  for (const g of Object.values(envRoots)) { if (!g.visible) continue; const S2 = g.userData.size;
    for (const w of g.userData.walls) {
      if (!cam) { w.m.visible = true; continue; }
      if (w.ceiling) { w.m.visible = cam.position.y < S2.h; continue; }
      const isX = w.h.x < w.h.z, side = isX ? Math.sign(w.c.x) : Math.sign(w.c.z), p = isX ? cam.position.x : cam.position.z, lim = (isX ? S2.x : S2.z) / 2;
      w.m.visible = !(side * p > lim - 0.05);
    } }
}

// ---- gate meshes
const gateRoot = new THREE.Group(); scene.add(gateRoot);
function gateMesh(G, opts = {}) {
  raceMats(); const g = new THREE.Group(), mat = PVC[G.g.color] || PVC.white; g.userData.gid = G.g.id; g.userData.pipes = [];
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(G.right.x, G.right.y, G.right.z), new THREE.Vector3(G.up.x, G.up.y, G.up.z), new THREE.Vector3(-G.fwd.x, -G.fwd.y, -G.fwd.z));
  if (G.opening) {   // the green panel: shown for the next checkpoint while racing (and always, faintly, for checkpoints in the editor)
    const op = G.opening, c = G.centre, panel = new THREE.Mesh(new THREE.PlaneGeometry(op.x1 - op.x0, op.y1 - op.y0), opts.editor ? PVC.panelEd : PVC.panel);
    panel.position.set(c.x, c.y, c.z); panel.quaternion.setFromRotationMatrix(basis); panel.visible = !!(opts.editor && G.invisible); panel.renderOrder = 5; g.add(panel); g.userData.panel = panel;
    if (opts.editor && G.invisible) {
      const pts = [[op.x0, op.y0], [op.x1, op.y0], [op.x1, op.y1], [op.x0, op.y1], [op.x0, op.y0]].map(([x, y]) => { const p = S.add(G.o, S.add(S.mul(G.right, x), S.mul(G.up, y))); return new THREE.Vector3(p.x, p.y, p.z); });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), PVC.panelLine));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 10), PVC.arrowGo); cone.position.set(c.x + G.fwd.x * 0.1, c.y + G.fwd.y * 0.1, c.z + G.fwd.z * 0.1);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(G.fwd.x, G.fwd.y, G.fwd.z)); g.add(cone);
    }
  }
  if (G.invisible) return g;
  for (const [a, b] of G.pipes) { const m = pipeMesh(a, b, RC.PIPE_R, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); g.userData.pipes.push(m); }
  for (const j of G.joints) { const m = new THREE.Mesh(new THREE.CylinderGeometry(RC.PIPE_R * 1.45, RC.PIPE_R * 1.45, RC.PIPE_R * 4, 10), PVC.joint); m.position.set(j.x, j.y, j.z); m.scale.setScalar(1); g.add(m); }
  for (const d of G.decor) {
    if (d.shape === 'flag') { const s = G.s, sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0, -0.35 * s); sh.lineTo(0.45 * s * d.side, -0.17 * s); sh.lineTo(0, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), d.side > 0 ? PVC.flagA : PVC.flagB); m.position.set(d.at.x, d.at.y, d.at.z);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(G.right.x, G.right.y, G.right.z), new THREE.Vector3(G.up.x, G.up.y, G.up.z), new THREE.Vector3(-G.fwd.x, -G.fwd.y, -G.fwd.z))); g.add(m); }
    if (d.shape === 'banner') { const L = S.len(S.sub(d.b, d.a)), m = new THREE.Mesh(new THREE.PlaneGeometry(L, d.hgt || 0.2), PVC.checker); const c = S.mul(S.add(d.a, d.b), 0.5);
      m.position.set(c.x, c.y + (d.hgt || 0.2) / 2, c.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(G.right.x, G.right.y, G.right.z), new THREE.Vector3(G.up.x, G.up.y, G.up.z), new THREE.Vector3(-G.fwd.x, -G.fwd.y, -G.fwd.z))); g.add(m); }
    if (d.shape === 'cap') { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), PVC.orange); m.position.set(d.at.x, d.at.y, d.at.z); g.add(m); }
  }
  // direction: a small blue chevron on top of the top bar pointing the way through (bidirectional gates get none)
  if (G.opening && !G.g.bidir && !G.prop) { const top = S.add(G.o, S.add(S.mul(G.up, G.opening.y1 + 0.03), S.mul(G.right, (G.opening.x0 + G.opening.x1) / 2)));
    const sh = new THREE.Shape(); sh.moveTo(-0.05, 0); sh.lineTo(0, -0.06); sh.lineTo(0.05, 0); sh.lineTo(0.05, 0.02); sh.lineTo(0, -0.035); sh.lineTo(-0.05, 0.02); sh.lineTo(-0.05, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), PVC.arrow); m.position.set(top.x, top.y, top.z);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(G.right.x, G.right.y, G.right.z), new THREE.Vector3(-G.fwd.x, -G.fwd.y, -G.fwd.z).negate(), new THREE.Vector3(G.up.x, G.up.y, G.up.z)));
    g.add(m); }
  return g;
}
function structureJoints(geoms) { const grp = new THREE.Group(); grp.userData.gid = null;
  for (const j of RC.trackJoints(geoms)) { const m = new THREE.Mesh(new THREE.SphereGeometry(RC.PIPE_R * 1.75, 10, 8), PVC.joint); m.position.set(j.x, j.y, j.z); m.castShadow = true; grp.add(m); } return grp; }
function clearGroup(g) { for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.userData.ownMat && o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); } }
function textSprite(text, col = '#ffd34d', size = 0.16) {
  const [c, g] = cnv(128, 64); g.font = 'bold 44px ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#000'; g.strokeText(text, 64, 34); g.fillStyle = col; g.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); m.scale.set(size * 2, size, 1); m.renderOrder = 10; m.userData.ownMat = true; return m;
}

// ============================================================ racing
const race = { on: false, track: null, mode: 'infinite', laps: 3, sess: null, W: null, meshes: [], fromEditor: false, t: 0, rec: null, lapRecs: [], ghosts: {}, gm: {}, winStart: 0,
  msg: '', msgT: 0, msgGood: false, best: null, improved: false, crashT: null, nemesis: null, opts: store.get('race.opts', { ghostBest3: true, ghostBestLap: false, ghostPrev: false, laps: 3, mode: 'infinite' }) };
const trackStore = () => store.get('race.tracks', {});
function saveTrack(t) { const all = trackStore(); all[t.id] = t; store.set('race.tracks', all); }
function deleteTrack(id) { const all = trackStore(); delete all[id]; store.set('race.tracks', all); }
function allTracks() { const own = Object.values(trackStore()).sort((a, b) => (b.updated || b.created || '').localeCompare(a.updated || a.created || '')); return [...own, ...RC.sampleTracks()]; }
const bestKey = t => 'race.best.' + t.id;
const fmtLap = x => x == null ? '—' : x >= 60 ? `${Math.floor(x / 60)}:${(x % 60).toFixed(2).padStart(5, '0')}` : x.toFixed(2);
function ghostMeshFor(color) {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.07), m); g.add(body);
  for (const [x, z] of [[-0.032, -0.032], [0.032, -0.032], [-0.032, 0.032], [0.032, 0.032]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 6, 16), m); r.rotation.x = Math.PI / 2; r.position.set(x, 0, z); g.add(r); }
  g.scale.setScalar(1.6); g.visible = false; scene.add(g); return g;
}
function raceStart(track, rmode, opts = {}) {
  document.body.classList.remove('editing'); $('#editorUI').classList.add('hide'); GZ.grp.visible = false;
  ghostOff(); train.on = false; renderTrain(); if (typeof ask !== 'undefined') ask.pending = [];
  const W = RC.buildTrackWorld(track, world); race.W = W; race.track = track; race.mode = rmode; race.laps = opts.laps || race.opts.laps || 3; race.fromEditor = !!opts.fromEditor;
  setEnv(track.env); useWorld(W); ed.extras.visible = false; if (ed.flightMesh) ed.flightMesh.visible = false; cutaway(null);
  clearGroup(gateRoot); race.meshes = W.geoms.map(G => { const m = gateMesh(G); gateRoot.add(m); return m; }); race.launch = launchMesh(track); gateRoot.add(race.launch); gateRoot.add(structureJoints(W.geoms));
  race.sess = new RC.RaceSession(track, W.geoms, rmode, { laps: race.laps, countdown: rmode === 'laps' });
  race.t = 0; race.rec = new RC.GhostRecorder(30); race.lapRecs = []; race.winStart = 0; race.improved = false; race.crashT = null; race.on = true; race.results = null;
  race.best = store.get(bestKey(track), {}); race.ghosts = { best3: race.best.best3Ghost || null, bestLap: race.best.bestLapGhost || null, prev: null, nemesis: race.nemesis && race.nemesis.trackId === track.id ? race.nemesis.ghost : null };
  for (const [k, col] of [['best3', 0xffd34d], ['bestLap', 0x59d3e8], ['prev', 0xbbbbbb], ['nemesis', 0xff5fb5]]) if (!race.gm[k]) race.gm[k] = ghostMeshFor(col);
  combo.names = []; combo.pts = 0; combo.active = false; initAudio(); if (actx && actx.state === 'suspended') actx.resume();
  score = new S.ScoreKeeper(); drone.reset(W.spawn); flightTime = 0; session = null; updateBreakdown();
  mode = 'fly'; show(null); $('#hud').classList.remove('hide'); $('#hud').classList.add('racing'); $('#raceHud').classList.remove('hide'); $('#editorUI').classList.add('hide'); camMode = 'fpv'; resize();
  $('#sessionT').textContent = track.name.toUpperCase();
  raceMsg(rmode === 'laps' ? `${race.laps}-lap race · arm, then GO` : rmode === 'hotlap' ? 'Hot lap · fly through gate 1 to start' : 'Infinite · fly through gate 1 to start the clock', true);
}
function launchMesh(track) {
  raceMats(); const g = new THREE.Group(); g.userData.gid = 'launch';
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.3), PVC.pad); pad.position.y = 0.006; g.add(pad);
  const sh = new THREE.Shape(); sh.moveTo(-0.06, 0.04); sh.lineTo(0, -0.1); sh.lineTo(0.06, 0.04); sh.lineTo(0, 0); sh.lineTo(-0.06, 0.04);
  const ar = new THREE.Mesh(new THREE.ShapeGeometry(sh), PVC.padMark); ar.rotation.x = -Math.PI / 2; ar.position.y = 0.014; g.add(ar);
  g.position.set(track.launch.pos[0], 0, track.launch.pos[2]); g.rotation.y = (track.launch.yaw || 0) * Math.PI / 180; return g;
}
function raceOff() {
  if (race.on) raceSaveSession();
  race.on = false; race.sess = null; clearGroup(gateRoot); for (const m of Object.values(race.gm)) m.visible = false;
  $('#hud').classList.remove('racing'); $('#raceHud').classList.add('hide'); $('#pauseRace').classList.add('hide');
  if (activeWorld !== world) { useWorld(world); setEnv('playground'); }
}
function raceMsg(text, good = false, secs = 2.2) { race.msg = text; race.msgGood = good; race.msgT = secs; }
function raceRespawn() {
  const sp = race.sess && race.sess.respawnPoint() || race.W.spawn, armed = drone.armed && !drone.crashed;
  drone.reset(sp, true); drone.armed = armed; detector.reset(); crashLock = false; race.crashT = null;
  const ev = race.sess ? race.sess.onRespawn([]) : []; for (const e of ev) raceEvent(e);
}
function raceStep(p0, dt) {
  const s = race.sess; if (!s) return; race.t += dt;
  if (s.state === 'racing') race.rec.sample(race.t, drone.pos, drone.q);
  for (const e of s.update(race.t, p0, drone.pos, drone.crashed)) raceEvent(e);
  if (drone.crashed) { if (race.crashT == null) race.crashT = race.t; else if (race.t - race.crashT > 0.9) raceRespawn(); }
}
function raceEvent(e) {
  const s = race.sess, n = i => i + 1;
  if (e.type === 'go') { race.rec.begin(race.t); race.winStart = race.t; raceMsg('GO!', true, 1); }
  if (e.type === 'start') { race.rec.begin(race.t); race.winStart = race.t; raceMsg('Lap 1 — go!', true, 1.2); }
  if (e.type === 'gate' && e.late) raceMsg(`Missed a gate — lap won't count`);
  if (e.type === 'invalid') raceMsg(e.why === 'crash' ? 'Crashed — lap won\'t count' : e.why === 'respawn' ? 'Respawned — lap won\'t count' : `${e.why[0].toUpperCase() + e.why.slice(1)} — lap won't count`);
  if (e.type === 'wrongway' && (race.mode === 'laps' || race.track.nextOnly)) raceMsg(`Wrong way through gate ${race.sess.req.indexOf(e.gate) + 1}`);
  if (e.type === 'skip') raceMsg(`Gate ${n(e.want)} first!`);
  if (e.type === 'lap') {
    const rec = race.rec.take(); race.rec.begin(race.t); race.lapRecs.push({ rec, time: e.time, clean: e.clean }); if (race.lapRecs.length > 6) race.lapRecs.shift();
    race.ghosts.prev = rec; const B = race.best;
    if (e.clean && (B.bestLap == null || e.time < B.bestLap)) { B.bestLap = e.time; B.bestLapGhost = rec; race.ghosts.bestLap = rec; race.improved = true; raceMsg(`Lap ${e.n}: ${fmtLap(e.time)} — best lap!`, true); }
    else raceMsg(e.clean ? `Lap ${e.n}: ${fmtLap(e.time)}` : `Lap ${e.n}: ${fmtLap(e.time)} ✗ ${e.why}`, e.clean);
    const b3 = s.best3, L = race.lapRecs;
    if (b3 && b3.idx === s.laps.length - 3 && (B.best3 == null || b3.total < B.best3.total - 1e-9) && L.length >= 3) {
      const last = L.slice(-3); B.best3 = { total: b3.total, laps: s.laps.slice(-3).map(l => l.time), at: new Date().toISOString() };
      B.best3Ghost = RC.joinLaps(last.map(x => x.rec), last.map(x => x.time)); race.ghosts.best3 = B.best3Ghost; race.improved = true; raceMsg(`New best 3 consecutive: ${fmtLap(b3.total)}`, true, 3);
    }
    if (!e.clean || s.streak % 3 === 0) race.winStart = race.t;
    store.set(bestKey(race.track), B);
  }
  if (e.type === 'finish') {
    const B = race.best, prev = B.classic && B.classic[race.laps];
    if (!prev || e.total < prev.total) { B.classic = B.classic || {}; B.classic[race.laps] = { total: e.total, laps: e.laps.map(l => l.time), at: new Date().toISOString() }; race.improved = true; store.set(bestKey(race.track), B); }
    raceResults(e, prev);
  }
}
function raceResults(e, prev) {
  drone.armed = false;
  $('#raceResBody').innerHTML = `<h2>${race.laps}-lap race · ${esc(race.track.name)}</h2><div class="big">${fmtLap(e.total)}</div>
    <p>${e.laps.map((l, i) => `Lap ${i + 1}: <b>${fmtLap(l.time)}</b>`).join(' · ')}</p>
    <p>${prev ? (e.total < prev.total ? `New personal best (was ${fmtLap(prev.total)})` : `Personal best ${fmtLap(prev.total)}`) : 'First finish on this track — that\'s your time to beat.'}</p>
    <div class="row"><button class="primary" data-act="raceRestart">Race again</button>${race.fromEditor ? '<button data-act="raceEditor">Back to editor</button>' : ''}<button data-act="raceExit">Tracks</button></div>`;
  mode = 'paused'; show('#raceResults');
}
function raceSaveSession() {   // the session best is already in localStorage; upload it if the pilot turned uploads on
  if (!race.improved || !race.track || typeof ghEnqueue !== 'function' || !gh.enabled || !gh.token) return;
  const B = race.best, t = race.track, stamp = new Date().toISOString().replace(/[:.]/g, '-');
  ghEnqueue(`races/${slug(t.name)}-${t.id}/${stamp}.json`, { format: 'pro-whooper-race/1', build: '0.1', track: RC.cleanTrack(t), craft: { ...spec }, camTilt: tune.camTilt,
    bestLap: B.bestLap ?? null, best3: B.best3 || null, classic: B.classic || null, best3Ghost: B.best3Ghost || null }, `race: ${t.name} best3 ${B.best3 ? B.best3.total.toFixed(2) : '-'} lap ${B.bestLap ? B.bestLap.toFixed(2) : '-'}`);
}
function raceHud() {
  const s = race.sess; if (!s) return; $('#sessionT').textContent = race.track.name.toUpperCase();
  const lt = s.lapTime(race.t), P = s.progress;
  $('#rhLap').textContent = s.state === 'countdown' ? '' : s.state === 'waiting' ? '0.00' : s.state === 'done' ? 'FINISHED' : fmtLap(lt);
  const lapN = s.laps.length + (s.state === 'racing' ? 1 : 0);
  $('#rhSub').textContent = s.state === 'waiting' ? `${race.mode === 'hotlap' ? 'HOT LAP' : 'INFINITE'} · fly through gate 1` : s.state === 'countdown' ? '' :
    `LAP ${lapN}${race.mode === 'laps' ? '/' + race.laps : ''} · GATE ${Math.min(P.passed + 1, P.of)}/${P.of}${s.valid ? '' : ' · ✗ not counting'}${race.mode === 'laps' ? ' · TOTAL ' + fmtLap(race.t - (s.raceT0 ?? race.t)) : ''}`;
  const cd = $('#rhCount'); cd.textContent = s.state === 'countdown' ? (s.cdT > 0 ? Math.ceil(s.cdT) : 'GO') : '';
  const m = $('#rhMsg'); m.textContent = race.msgT > 0 ? race.msg : ''; m.className = race.msgGood ? 'good' : '';
  const B = race.best, b3 = B.best3, roll = s.rolling3, recent = s.laps.slice(-5).reverse();
  $('#rhBox').innerHTML = (race.mode === 'infinite' ? `<div>BEST 3 IN A ROW</div><b>${b3 ? fmtLap(b3.total) : '—'}</b><div class="dim">${b3 ? b3.laps.map(fmtLap).join(' · ') : 'three clean laps in a row'}</div>
      <div>NOW ${roll != null ? fmtLap(roll) : '—'} · streak ${s.streak}</div>` : race.mode === 'laps' ? `<div>PB ${race.laps} LAPS</div><b>${B.classic && B.classic[race.laps] ? fmtLap(B.classic[race.laps].total) : '—'}</b>` : '')
    + `<div>BEST LAP ${fmtLap(B.bestLap)}</div>` + recent.map(l => `<div class="${l.clean ? '' : 'bad'}">${fmtLap(l.time)}</div>`).join('');
}
function raceVisuals(dt) {
  const s = race.sess; if (!s) return; race.msgT -= dt;
  // the next gate glows (and its connectors keep the PVC look)
  const want = s.state === 'waiting' || s.holeshot ? s.req[0] : s.state === 'racing' ? s.req[s.next] : -1;
  race.meshes.forEach((m, i) => { const hot = i === want, col = race.track.gates[i].color || 'white'; for (const p of m.userData.pipes) p.material = hot && race.track.showNext !== false ? PVC[col + 'Hot'] : PVC[col]; if (m.userData.panel) m.userData.panel.visible = hot && race.track.showNext !== false; });
  // ghosts
  const lapU = s.state === 'racing' && s.lapT0 != null ? race.t - s.lapT0 : -1, winU = s.state === 'racing' ? race.t - race.winStart : -1;
  const place = (k, rec, u, on) => { const m = race.gm[k]; const g = on && rec && u >= 0 ? RC.ghostAt(rec, u) : null; m.visible = !!g; if (g) { m.position.set(g.pos.x, g.pos.y, g.pos.z); m.quaternion.set(g.q.x, g.q.y, g.q.z, g.q.w); } };
  place('best3', race.ghosts.best3, winU, race.opts.ghostBest3 && race.mode === 'infinite');
  place('bestLap', race.ghosts.bestLap, lapU, race.opts.ghostBestLap || race.mode === 'hotlap');
  place('prev', race.ghosts.prev, lapU, race.opts.ghostPrev);
  place('nemesis', race.ghosts.nemesis, race.mode === 'laps' && s.raceT0 != null ? race.t - s.raceT0 : -1, !!race.ghosts.nemesis);
}
function backToEditor() { const t = race.track; raceOff(); openEditor(t, true); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
  if (a === 'raceRestart' && race.track) { const t = race.track, fe = race.fromEditor; raceOff(); raceStart(t, race.mode, { laps: race.laps, fromEditor: fe }); }
  if (a === 'raceEditor' && race.track) backToEditor();
  if (a === 'raceExit') { raceOff(); mode = 'menu'; drone.armed = false; $('#hud').classList.add('hide'); openRaceMenu(); }
});
// pause menu: show the race buttons while racing
const _pause = pause; pause = function () { _pause(); $('#pauseRace').classList.toggle('hide', !race.on); $('#pauseEditorBtn').classList.toggle('hide', !race.fromEditor); $('#pauseMapEdit').classList.toggle('hide', !ME.testing); };

// ---- the track list
function openRaceMenu() {
  mode = 'menu'; drone.armed = false; $('#hud').classList.add('hide'); show('#raceScreen'); renderRaceMenu();
}
function renderRaceMenu() {
  const o = race.opts, gs = typeof gh !== 'undefined' && gh.enabled && gh.token;
  const envBtns = Object.entries(RC.ENVIRONMENTS).map(([k, E]) => `<button data-rn="${k}" title="${E.desc}">+ ${E.label}</button>`).join('');
  const cards = allTracks().map(t => { const B = store.get(bestKey(t), {}), req = RC.required(t).length;
    return `<div class="rCard"><h3>${esc(t.name)}</h3><small>${RC.ENVIRONMENTS[t.env].label} · ${req} gates${t.sample ? ' · sample' : ''}</small>
      <div class="rBest">Best 3: ${B.best3 ? fmtLap(B.best3.total) : '—'} · Best lap: ${fmtLap(B.bestLap)}${B.classic && B.classic[o.laps] ? ` · ${o.laps} laps: ${fmtLap(B.classic[o.laps].total)}` : ''}</div>
      <div class="row"><button class="primary" data-rr="${t.id}">Race</button><button data-re="${t.id}">${t.sample ? 'Edit a copy' : 'Edit'}</button><button data-rx="${t.id}">Export</button>
      ${t.sample ? '' : `<button data-rd="${t.id}">Delete</button>`}${gs ? `<button data-ru="${t.id}">Upload</button>` : ''}${race.nemesis && race.nemesis.trackId === t.id ? '<small>· nemesis ghost loaded</small>' : ''}</div></div>`; }).join('');
  $('#raceBody').innerHTML = `<div class="rTop"><b>Mode</b>
      <label><input type="radio" name="rmode" value="infinite" ${o.mode === 'infinite' ? 'checked' : ''}> Infinite (best 3 consecutive)</label>
      <label><input type="radio" name="rmode" value="hotlap" ${o.mode === 'hotlap' ? 'checked' : ''}> Hot lap</label>
      <label><input type="radio" name="rmode" value="laps" ${o.mode === 'laps' ? 'checked' : ''}> Race <select id="rLaps">${[1, 2, 3, 5, 10].map(n => `<option ${n === o.laps ? 'selected' : ''}>${n}</option>`).join('')}</select> laps</label>
      <span class="sp"></span><b>Ghosts</b>
      <label><input type="checkbox" id="rgB3" ${o.ghostBest3 ? 'checked' : ''}> best 3</label><label><input type="checkbox" id="rgBL" ${o.ghostBestLap ? 'checked' : ''}> best lap</label><label><input type="checkbox" id="rgPv" ${o.ghostPrev ? 'checked' : ''}> previous lap</label></div>
    <div class="rTop" style="margin-top:8px"><b>New track</b> ${envBtns}<span class="sp"></span><label class="ghost">Import track / ghost <input type="file" id="rImport" accept=".json,application/json" hidden></label><button data-rimp>Import…</button></div>
    <div class="rTracks">${cards}</div>
    <p class="hint">Gates are white PVC in 24-inch sections, like a RaceGOW home track. A clean lap passes every numbered gate in order, the right way, without crashing. Respawn (R) puts you back at the last gate you passed. ${gs ? '' : 'Turn on uploads in Options to share tracks and times.'}</p>`;
}
const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const findTrack = id => allTracks().find(t => t.id === id);
document.addEventListener('change', e => {
  if (!e.target.closest('#raceBody')) return; const o = race.opts;
  if (e.target.name === 'rmode') o.mode = e.target.value; if (e.target.id === 'rLaps') o.laps = +e.target.value;
  if (e.target.id === 'rgB3') o.ghostBest3 = e.target.checked; if (e.target.id === 'rgBL') o.ghostBestLap = e.target.checked; if (e.target.id === 'rgPv') o.ghostPrev = e.target.checked;
  store.set('race.opts', o);
  if (e.target.id === 'rImport' && e.target.files[0]) e.target.files[0].text().then(txt => { try { const j = JSON.parse(txt);
      if (j.format === 'pro-whooper-race/1' && j.best3Ghost && j.track) { const t = RC.cleanTrack(j.track); if (!findTrack(t.id)) saveTrack(t); race.nemesis = { trackId: t.id, ghost: j.best3Ghost }; flashMenu(`Nemesis ghost loaded for ${t.name}: race it in a fixed-lap race`); }
      else { const t = RC.cleanTrack(j); if (findTrack(t.id)) t.id = 't' + Date.now().toString(36); t.sample = false; saveTrack(t); flashMenu(`Imported "${t.name}"`); } renderRaceMenu();
    } catch (err) { flashMenu('Not a track file: ' + err.message); } });
});
function flashMenu(t) { const p = document.createElement('p'); p.className = 'hint'; p.style.color = '#ffd34d'; p.textContent = t; $('#raceBody').prepend(p); setTimeout(() => p.remove(), 4000); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rr],[data-re],[data-rx],[data-rd],[data-ru],[data-rn],[data-rimp]'); if (!b || !b.closest('#raceBody')) return;
  const d = b.dataset;
  if (d.rr) { const t = findTrack(d.rr); const o = race.opts; raceStart(t, o.mode, { laps: o.laps }); }
  if (d.re) { let t = JSON.parse(JSON.stringify(findTrack(d.re))); if (t.sample) { t.sample = false; t.id = 't' + Date.now().toString(36); t.name = 'Copy of ' + t.name; } openEditor(t); }
  if (d.rx) { const t = findTrack(d.rx), B = store.get(bestKey(t), {});
    const out = B.best3Ghost ? { format: 'pro-whooper-race/1', track: RC.cleanTrack(t), best3: B.best3, bestLap: B.bestLap ?? null, best3Ghost: B.best3Ghost } : RC.cleanTrack(t);
    saveFile(`${slug(t.name)}${B.best3Ghost ? '-with-ghost' : ''}.json`, JSON.stringify(out)); }
  if (d.rd && confirm('Delete this track? (Your best times for it stay saved.)')) { deleteTrack(d.rd); renderRaceMenu(); }
  if (d.ru) { const t = findTrack(d.ru); ghEnqueue(`tracks/${slug(t.name)}-${t.id}.json`, RC.cleanTrack(t), `track: ${t.name}`); const B = store.get(bestKey(t), {});
    if (B.best3 || B.bestLap) ghEnqueue(`races/${slug(t.name)}-${t.id}/${new Date().toISOString().replace(/[:.]/g, '-')}.json`, { format: 'pro-whooper-race/1', track: RC.cleanTrack(t), bestLap: B.bestLap ?? null, best3: B.best3 || null, classic: B.classic || null, best3Ghost: B.best3Ghost || null }, `race: ${t.name}`);
    flashMenu('Uploading…'); }
  if (d.rn) openEditor(RC.newTrack(d.rn, 'New ' + RC.ENVIRONMENTS[d.rn].label + ' track'));
  if (d.rimp !== undefined) $('#rImport').click();
});

// ============================================================ the track editor
const edCamP = new THREE.PerspectiveCamera(55, 1, 0.02, 400), edCamO = new THREE.OrthographicCamera(-5, 5, 5, -5, -100, 400);
const ed = { track: null, sel: new Set(), tool: 'move', space: 'global', snap: 15, grid: false, ortho: false, place: null, paint: null, undo: [], redo: [], cam: { t: new THREE.Vector3(), dist: 8, yaw: 0.6, pitch: 0.75 },
  drag: null, color: 'white', axis: null, magnet: true, flight: false, flightMesh: null, flightT: 0, meshes: new Map(), extras: new THREE.Group(), box: null, valid: null, validT: 0, W: null, mouse: new THREE.Vector2(), hover: null, dirty: false };
scene.add(ed.extras);
function openEditor(track, keepCam) {
  raceMats(); if (race.on) raceOff();
  ed.track = track; ed.sel.clear(); ed.place = null; ed.paint = null; if (!keepCam) { ed.undo = []; ed.redo = []; }
  if (track.env === 'playground') { setEnv('playground'); } else setEnv(track.env);
  if (!keepCam) { const E = RC.ENVIRONMENTS[track.env], sz = E.build ? E.build().size : { x: 30, z: 30, h: 8 }; ed.cam.t.set(0, 0.3, 0); ed.cam.dist = Math.max(sz.x, sz.z) * 0.9; ed.cam.yaw = 0.5; ed.cam.pitch = 0.8; }
  mode = 'editor'; drone.armed = false; show(null); $('#hud').classList.add('hide'); $('#editorUI').classList.remove('hide'); ed.extras.visible = true; document.body.classList.add('editing');
  $('#edName').value = track.name; $('#edSF').checked = track.startFinish !== false; $('#edNext').checked = !!track.nextOnly; $('#edShow').checked = track.showNext !== false;
  $('#edEnv').textContent = `Room: ${RC.ENVIRONMENTS[track.env].label} — ${RC.ENVIRONMENTS[track.env].desc}`;
  $('#edLib').innerHTML = Object.entries(RC.GATE_TYPES).filter(([k, T]) => !T.hidden).map(([k, T]) => `<button data-ed="lib:${k}" title="${T.desc}">${T.label}</button>`).join('');
  $('#edColor').innerHTML = Object.keys(RC.COLORS).map(c => `<option ${c === ed.color ? 'selected' : ''}>${c}</option>`).join('');
  edRebuild(); edPanels(); edToolbar(); resize();
}
function editorClose() { GZ.grp.visible = false; if (ed.flightMesh) ed.flightMesh.visible = false; $('#editorUI').classList.add('hide'); document.body.classList.remove('editing'); clearGroup(gateRoot); clearGroup(ed.extras); cutaway(null); setEnv('playground'); }
const edSnapshot = () => JSON.stringify(ed.track);
function edPush() { ed.undo.push(edSnapshot()); if (ed.undo.length > 120) ed.undo.shift(); ed.redo = []; ed.dirty = true; }
function edUndo() { if (!ed.undo.length) return; ed.redo.push(edSnapshot()); ed.track = JSON.parse(ed.undo.pop()); edAfter(); }
function edRedo() { if (!ed.redo.length) return; ed.undo.push(edSnapshot()); ed.track = JSON.parse(ed.redo.pop()); edAfter(); }
function edAfter() { for (const id of [...ed.sel]) if (id !== 'launch' && !ed.track.gates.some(g => g.id === id)) ed.sel.delete(id); edRebuild(); edPanels(); }
const gateById = id => ed.track.gates.find(g => g.id === id);
function edRebuild() {
  clearGroup(gateRoot); clearGroup(ed.extras); ed.meshes.clear();
  const T = ed.track; ed.W = RC.buildTrackWorld(T, world); ed.valid = RC.validateTrack(T, ed.W);
  const bad = new Set(ed.valid.errors.map(e => (/^Gate (\d+)/.exec(e) || [])[1]).filter(Boolean).map(n => +n - 1));
  let num = 0;
  T.gates.forEach((g, i) => {
    const G = ed.W.geoms[i], m = gateMesh(G, { editor: true }); gateRoot.add(m); ed.meshes.set(g.id, m);
    const top = G.pipes.length ? G.pipes.reduce((a, [p, q]) => Math.max(a, p.y, q.y), 0) : G.centre.y + 0.4;
    const req = g.required && !G.prop; if (req) num++;
    if (!RC.GATE_TYPES[g.type].loose) { const lab = textSprite(req ? String(num) : '·', req ? (num === 1 ? '#7dff9a' : '#ffd34d') : '#aaa'); if (G.invisible) lab.position.set(G.centre.x, G.centre.y, G.centre.z); else lab.position.set(G.centre.x, top + 0.18, G.centre.z); ed.extras.add(lab); }
    if (G.opening) { const rp = RC.resetPoint(G), col = bad.has(i) ? PVC.resetBad : PVC.resetOk;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), col); s.position.set(rp.pos.x, rp.pos.y, rp.pos.z); ed.extras.add(s);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 10), col); c.position.set(rp.pos.x + G.fwd.x * 0.07, rp.pos.y + G.fwd.y * 0.07, rp.pos.z + G.fwd.z * 0.07);
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(G.fwd.x, G.fwd.y, G.fwd.z)); ed.extras.add(c); }
  });
  // racing line: centre of each numbered gate in order
  const req = RC.required(T); if (req.length > 1) { const pts = req.map(i => ed.W.geoms[i].centre).map(p => new THREE.Vector3(p.x, p.y, p.z)); if (T.startFinish !== false) pts.push(pts[0].clone());
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffd34d, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.6 })); l.computeLineDistances(); l.userData.ownMat = true; ed.extras.add(l); }
  const lm = launchMesh(T); gateRoot.add(lm); ed.meshes.set('launch', lm);
  gateRoot.add(structureJoints(ed.W.geoms)); edFlightLine();
  edSelBox();
}
// the lap as a line: from the launch pad through every checkpoint in order (approach, centre, exit), like a track diagram.
// With "Flight line" on, a red stroke runs round it so you can see how the track is flown.
function edFlightLine() {
  if (ed.flightMesh) { scene.remove(ed.flightMesh); ed.flightMesh.geometry.dispose(); ed.flightMesh = null; }
  if (!ed.flight || mode !== 'editor' && !ed.track) return; const T = ed.track, req = RC.required(T); if (req.length < 2) return;
  const pts = [new THREE.Vector3(T.launch.pos[0], 0.15, T.launch.pos[2])], order = T.startFinish !== false ? [...req, req[0]] : req;
  for (const i of order) { const G = ed.W.geoms[i], op = G.opening, r = Math.min(0.45, 0.2 + 0.25 * Math.min(op.x1 - op.x0, op.y1 - op.y0)), c = G.centre;
    for (const k of [-r, 0, r]) pts.push(new THREE.Vector3(c.x + G.fwd.x * k, Math.max(0.08, c.y + G.fwd.y * k), c.z + G.fwd.z * k)); }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), SEG = Math.min(1600, pts.length * 24), RAD = 6;
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, 0.014, RAD, false), PVC.flight); m.userData.seg = SEG; m.userData.rad = RAD; m.userData.len = curve.getLength(); m.frustumCulled = false;
  ed.flightMesh = m; scene.add(m);
}
function edFlightTick(dt) {
  const m = ed.flightMesh; if (!m) return; m.visible = mode === 'editor'; const SEG = m.userData.seg, per = m.userData.rad * 6;
  ed.flightT = (ed.flightT + dt * 3.2 / Math.max(1, m.userData.len)) % 1.25;   // ~3.2 m/s, then a short pause
  const head = Math.min(1, ed.flightT), tail = Math.max(0, head - 2.2 / Math.max(1, m.userData.len)), i0 = Math.floor(tail * SEG), i1 = Math.floor(head * SEG);
  m.geometry.setDrawRange(i0 * per, Math.max(0, i1 - i0) * per);
}
// magnet: pipe ends click onto nearby pipe ends / pipes of other parts (checkpoints don't snap: size them to the opening)
function edMagnet(ids) {
  if (!ed.magnet) return false; const list = ids.filter(id => id !== 'launch').map(gateById).filter(Boolean); if (!list.length) return false;
  const sec = (ed.track.section || RC.U), others = ed.track.gates.filter(g => !list.includes(g)).map(g => RC.gateGeom(g, sec)); let best = null;
  for (const g of list) { const d = RC.snapDelta(RC.gateGeom(g, sec), others, 0.14); if (d && (!best || S.len(d) < S.len(best))) best = d; }
  if (!best || S.len(best) < 1e-4) return false;
  for (const g of list) { g.pos[0] = +(g.pos[0] + best.x).toFixed(4); g.pos[1] = Math.max(0, +(g.pos[1] + best.y).toFixed(4)); g.pos[2] = +(g.pos[2] + best.z).toFixed(4); }
  return true;
}
// Viewport manipulators, like a 3D modelling program: arrows to move along an axis, rings to rotate about one, a cube to
// scale. They sit on the selection (red X, green Y, blue Z), keep a constant size on screen, and follow the Local/Global
// switch. Dragging the part itself still slides it over the floor.
const AXV_ = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const GZ = { grp: new THREE.Group(), move: new THREE.Group(), rot: new THREE.Group(), scl: new THREE.Group() };
(() => { const col = { x: 0xff4b4b, y: 0x5fd35f, z: 0x4b8bff }, mat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 });
  for (const ax of ['x', 'y', 'z']) { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AXV_[ax]);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), mat(col[ax])); sh.position.copy(AXV_[ax]).multiplyScalar(0.5); sh.quaternion.copy(q);
    const hd = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 12), mat(col[ax])); hd.position.copy(AXV_[ax]).multiplyScalar(1.0); hd.quaternion.copy(q);
    const a = new THREE.Group(); a.add(sh, hd); a.userData.giz = { mode: 'move', axis: ax }; GZ.move.add(a);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 8, 48), mat(col[ax])); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), AXV_[ax]); ring.userData.giz = { mode: 'rotate', axis: ax }; GZ.rot.add(ring); }
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat(0xffd34d)); cube.userData.giz = { mode: 'scale', axis: null }; GZ.scl.add(cube);
  GZ.grp.add(GZ.move, GZ.rot, GZ.scl); GZ.grp.traverse(o => { o.renderOrder = 20; }); GZ.grp.visible = false; scene.add(GZ.grp); })();
function gizPivot() { const ids = [...ed.sel]; if (!ids.length) return null; const c = new THREE.Vector3();
  for (const id of ids) { const p = id === 'launch' ? ed.track.launch.pos : (gateById(id) || { pos: [0, 0, 0] }).pos; c.add(new THREE.Vector3(p[0], p[1], p[2])); } return c.multiplyScalar(1 / ids.length); }
function gizUpdate(cam) {
  const pv = mode === 'editor' && !ed.place && ['move', 'rotate', 'scale'].includes(ed.tool) ? gizPivot() : null; GZ.grp.visible = !!pv; if (!pv) return;
  GZ.grp.position.copy(pv); GZ.grp.scale.setScalar((ed.ortho ? ed.cam.dist * 0.5 : cam.position.distanceTo(pv)) * 0.13);
  const one = ed.sel.size === 1 && !ed.sel.has('launch') ? gateById([...ed.sel][0]) : null; if (ed.space === 'local' && one) GZ.grp.quaternion.copy(rotQ(one.rot)); else GZ.grp.quaternion.identity();
  GZ.move.visible = ed.tool === 'move'; GZ.rot.visible = ed.tool === 'rotate'; GZ.scl.visible = ed.tool === 'scale' && !ed.sel.has('launch');
}
function gizPick(e) { if (!GZ.grp.visible) return null; const hits = edRay(e).intersectObjects(GZ.grp.children, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.giz) o = o.parent; if (o && o.parent.visible) return o.userData.giz; } return null; }
function edSelBox() {
  if (ed.box) { ed.extras.remove(ed.box); ed.box.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.userData.ownMat) o.material.dispose(); }); ed.box = null; }
  const grp = new THREE.Group(); for (const id of ed.sel) { const m = ed.meshes.get(id); if (!m) continue; const h = new THREE.BoxHelper(m, 0xffd34d); h.userData.ownMat = true; grp.add(h); }
  ed.box = grp; ed.extras.add(grp);
}
function edCam() {
  const c = ed.cam, cp = Math.cos(c.pitch), off = new THREE.Vector3(Math.sin(c.yaw) * cp, Math.sin(c.pitch), Math.cos(c.yaw) * cp).multiplyScalar(c.dist);
  const cam = ed.ortho ? edCamO : edCamP; cam.position.copy(c.t).add(off); cam.up.set(0, 1, 0); cam.lookAt(c.t);
  const a = innerWidth / innerHeight; edCamP.aspect = a; edCamP.updateProjectionMatrix();
  const h = c.dist * 0.5; edCamO.left = -h * a; edCamO.right = h * a; edCamO.top = h; edCamO.bottom = -h; edCamO.updateProjectionMatrix();
  return cam;
}
function editorFrame(dt) {
  const cam = edCam(); cutaway(cam); edFlightTick(dt); gizUpdate(cam);
  droneMesh.visible = false;
  renderer.render(scene, cam); droneMesh.visible = true;
  ed.validT -= dt;
  frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
}
// ---- picking and the floor
const ray = new THREE.Raycaster();
function edRay(e) { const r = canvas.getBoundingClientRect(); ed.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ed.mouse, ed.ortho ? edCamO : edCamP); return ray; }
function edPick(e) {
  const hits = edRay(e).intersectObjects(gateRoot.children, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.gid) o = o.parent; if (o) return o.userData.gid; }
  return null;
}
function edFloor(e, y = 0) { const r = edRay(e), p = new THREE.Vector3(); return r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null; }
const roomSizes = {}; const roomLimit = () => { const env = ed.track.env, E = RC.ENVIRONMENTS[env]; if (!(env in roomSizes)) roomSizes[env] = E.build ? E.build().size : null; return roomSizes[env]; };
function clampToRoom(p) { const s = roomLimit(); if (!s) return p; p[0] = Math.max(-s.x / 2 + 0.05, Math.min(s.x / 2 - 0.05, p[0])); p[2] = Math.max(-s.z / 2 + 0.05, Math.min(s.z / 2 - 0.05, p[2])); p[1] = Math.max(0, Math.min(s.h - 0.1, p[1])); return p; }
const snapG = v => { const GRID = (ed.track && ed.track.section || RC.U) / 4; return ed.grid ? Math.round(v / GRID) * GRID : Math.round(v * 1000) / 1000; };
const snapA = a => ed.snap ? Math.round(a / ed.snap) * ed.snap : Math.round(a * 10) / 10;
function camYawDeg() { return Math.round((((ed.cam.yaw * 180 / Math.PI) % 360) + 360) % 360); }   // gates placed facing away from the camera
function edPlace(type, p) {
  edPush(); const loose = RC.GATE_TYPES[type].loose, g = RC.newGate(type, loose && p.y > 0.02 ? { x: p.x, y: p.y, z: p.z } : { x: snapG(p.x), y: 0, z: snapG(p.z) }, loose ? 0 : snapA(camYawDeg()), { color: ed.color }); clampToRoom(g.pos);
  ed.track.gates.push(g); ed.sel.clear(); ed.sel.add(g.id); if (RC.GATE_TYPES[type].loose) edMagnet([g.id]); edRebuild(); edPanels(); return g;
}
function faceAlong(g, from, to) { const dx = to[0] - from[0], dz = to[2] - from[2]; if (Math.hypot(dx, dz) > 0.05) g.rot[0] = snapA(Math.atan2(-dx, -dz) * 180 / Math.PI); }
// Define gate: click two opposite corners and the rectangle between them becomes a checkpoint. Corners snap to pipe
// ends and connectors (or land on the floor), so any opening in the structure, or any open space, can be a gate.
function edCorner(e) {
  const cam = ed.ortho ? edCamO : edCamP, r = canvas.getBoundingClientRect(); let best = null;
  for (const G of ed.W.geoms) { if (G.invisible) continue; for (const [a, b] of G.pipes) for (const p of [a, b]) { const v = new THREE.Vector3(p.x, p.y, p.z).project(cam); if (v.z > 1) continue;
    const d = Math.hypot((v.x + 1) / 2 * r.width + r.left - e.clientX, (1 - v.y) / 2 * r.height + r.top - e.clientY); if (d < 22 && (!best || d < best.d)) best = { d, p: { x: p.x, y: p.y < 0.03 ? 0 : p.y, z: p.z } }; } }
  if (best) return best.p; const f = edFloor(e); return f ? { x: snapG(f.x), y: 0, z: snapG(f.z) } : null;
}
function edDefine(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, hz = Math.hypot(dx, dz), U = (ed.track.section || RC.U), cam = ed.ortho ? edCamO : edCamP, look = new THREE.Vector3(); cam.getWorldDirection(look);
  let g;
  if (Math.abs(dy) < 0.06 && hz > 0.1) {   // both corners at one height: a flat gate (dive through it); sides follow the structure's axes
    if (Math.abs(dx) < 0.08 || Math.abs(dz) < 0.08) { edHint('Those two corners are in line: click the opposite corner of the opening (diagonal).'); return null; }
    g = RC.newGate('invisible', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, 0, { w: Math.abs(dx) / U, h: Math.abs(dz) / U, color: 'green' }); g.rot[1] = look.y <= 0 ? -90 : 90; g.lift = -g.h / 2;
  } else if (hz > 0.08 && Math.abs(dy) > 0.06) {   // a standing gate between the two corners
    let yaw = Math.atan2(-dz, dx) * 180 / Math.PI;   // local +x along the horizontal run
    g = RC.newGate('invisible', { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y), z: (a.z + b.z) / 2 }, 0, { w: hz / U, h: Math.abs(dy) / U, color: 'green' });
    g.rot[0] = yaw; const G = RC.gateGeom(g, (ed.track.section || RC.U)); if (G.fwd.x * look.x + G.fwd.z * look.z < 0) g.rot[0] = yaw + 180;   // flown away from where you're looking; "Reverse direction" flips it
    g.rot[0] = ((Math.round(g.rot[0] * 10) / 10) % 360 + 360) % 360;
  } else { edHint('Pick two corners that are diagonal from each other (for a standing gate: one low, one high).'); return null; }
  edPush(); ed.track.gates.push(g); ed.sel.clear(); ed.sel.add(g.id); edRebuild(); edPanels();
  edHint(`Gate ${RC.required(ed.track).length} defined (${(g.w).toFixed(2)} × ${(g.h).toFixed(2)} sections). Raise h in the panel for an open-topped gate; "Reverse direction" flips it.`); return g;
}
// full 3D rotation of a part: turn it by deg about a world or local axis ('x' | 'y' | 'z'), around a pivot point
const AXV = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const rotQ = rot => new THREE.Quaternion().setFromEuler(new THREE.Euler((rot[1] || 0) * Math.PI / 180, (rot[0] || 0) * Math.PI / 180, (rot[2] || 0) * Math.PI / 180, 'YXZ'));
function rotated(o, axis, deg, pivot, local) {
  const q0 = rotQ(o.rot), ax = AXV[axis].clone(); if (local) ax.applyQuaternion(q0);
  const qa = new THREE.Quaternion().setFromAxisAngle(ax, deg * Math.PI / 180), e = new THREE.Euler().setFromQuaternion(qa.clone().multiply(q0), 'YXZ'), r = v => { const d = Math.round(v * 180 / Math.PI * 100) / 100; return Math.abs(d) < 0.005 ? 0 : d; };
  const p = new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]).sub(pivot).applyQuaternion(qa).add(pivot);
  return { pos: [+p.x.toFixed(4), Math.max(0, +p.y.toFixed(4)), +p.z.toFixed(4)], rot: [((r(e.y) % 360) + 360) % 360, r(e.x), r(e.z)] };
}
function edRotateSel(axis, deg) {   // buttons / keys: turn the selection in place (each part about its own joining end; a group about its middle)
  const ids = [...ed.sel].filter(id => id !== 'launch'); if (!ids.length) return; edPush(); const gs = ids.map(gateById);
  const c = new THREE.Vector3(); gs.forEach(g => c.add(new THREE.Vector3(g.pos[0], g.pos[1], g.pos[2]))); c.multiplyScalar(1 / gs.length);
  for (const g of gs) { const r = rotated(g, axis, deg, gs.length > 1 && ed.space === 'global' ? c : new THREE.Vector3(g.pos[0], g.pos[1], g.pos[2]), ed.space === 'local'); g.pos = r.pos; g.rot = r.rot; }
  edMagnet(ids); edRebuild(); edPanels();
}
canvas.addEventListener('contextmenu', e => { if (mode === 'editor') e.preventDefault(); });
canvas.addEventListener('mousedown', e => {
  if (mode !== 'editor') return; e.preventDefault();
  if (e.button === 2 || e.button === 1) { ed.drag = { kind: e.button === 1 || e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY }; return; }
  if (e.button !== 0) return;
  if (ed.tool === 'define') { const c = edCorner(e); if (!c) return;
    ed.defDown = { x: e.clientX, y: e.clientY };
    if (!ed.defA) { ed.defA = c; const m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), PVC.arrowGo); m.position.set(c.x, c.y, c.z); ed.extras.add(m); edHint('First corner set. Now click the opposite (diagonal) corner. Esc cancels.'); }
    else { const a = ed.defA; ed.defA = null; if (!edDefine(a, c)) edRebuild(); }
    return; }
  if (ed.tool === 'paint') { const p = edFloor(e); if (!p) return; const prev = ed.paint && ed.paint.last ? gateById(ed.paint.last) : null;
    const type = ed.place || 'gate', g = edPlace(type, p); if (prev) { faceAlong(prev, ed.paint.prevPrev || prev.pos, g.pos); faceAlong(g, prev.pos, g.pos); }
    ed.paint = { last: g.id, prevPrev: prev ? prev.pos : null }; edRebuild(); edPanels(); return; }
  if (ed.place) { const p = RC.GATE_TYPES[ed.place].loose ? edCorner(e) : edFloor(e); if (p) { edPlace(ed.place, p); if (!e.shiftKey) { ed.place = null; edToolbar(); } } return; }
  const gz = gizPick(e);
  if (gz) { const items = [...ed.sel].map(sid => sid === 'launch' ? { id: sid, pos: ed.track.launch.pos.slice(), rot: [ed.track.launch.yaw || 0, 0, 0], scale: 1 } : { id: sid, pos: gateById(sid).pos.slice(), rot: gateById(sid).rot.slice(), scale: gateById(sid).scale });
    const pv = gizPivot(), cam = ed.ortho ? edCamO : edCamP, r = canvas.getBoundingClientRect(), px = v => { const q = v.clone().project(cam); return new THREE.Vector2((q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top); };
    const axW = gz.axis ? AXV[gz.axis].clone().applyQuaternion(GZ.grp.quaternion) : null, p0 = px(pv), p1 = axW ? px(pv.clone().add(axW)) : p0;
    ed.drag = { kind: 'xf', giz: gz, x: e.clientX, y: e.clientY, items, pv, axW, sdir: p1.clone().sub(p0), sc: p0, toward: axW ? axW.dot(cam.position.clone().sub(pv)) : 1, a0: Math.atan2(e.clientY - p0.y, e.clientX - p0.x), snap: edSnapshot(), moved: false }; return; }
  const id = edPick(e);
  if (!id) { if (!e.shiftKey) { ed.sel.clear(); edSelBox(); edPanels(); } return; }
  if (e.shiftKey) { if (ed.sel.has(id)) ed.sel.delete(id); else ed.sel.add(id); edSelBox(); edPanels(); return; }
  if (!ed.sel.has(id)) { ed.sel.clear(); ed.sel.add(id); edSelBox(); edPanels(); }
  // start a transform drag on the selection
  const items = [...ed.sel].map(sid => sid === 'launch' ? { id: sid, pos: ed.track.launch.pos.slice(), rot: [ed.track.launch.yaw || 0, 0, 0], scale: 1 } : { id: sid, pos: gateById(sid).pos.slice(), rot: gateById(sid).rot.slice(), scale: gateById(sid).scale });
  const y0 = items[0].pos[1], f0 = edFloor(e, y0);
  ed.drag = { kind: 'xf', x: e.clientX, y: e.clientY, items, f0, y0, snap: edSnapshot(), moved: false, vertical: e.altKey || e.ctrlKey || e.metaKey };
});
addEventListener('mousemove', e => {
  if (mode !== 'editor' || !ed.drag) return; const d = ed.drag, dx = e.clientX - d.x, dy = e.clientY - d.y;
  if (d.kind === 'orbit') { ed.cam.yaw -= dx * 0.008; ed.cam.pitch = Math.max(0.05, Math.min(1.55, ed.cam.pitch + dy * 0.006)); d.x = e.clientX; d.y = e.clientY; return; }
  if (d.kind === 'pan') { const k = ed.cam.dist * 0.0016, c = Math.cos(ed.cam.yaw), s = Math.sin(ed.cam.yaw);
    ed.cam.t.x += (-dx * c - dy * s) * k; ed.cam.t.z += (dx * s - dy * c) * k; d.x = e.clientX; d.y = e.clientY; return; }
  if (d.kind !== 'xf') return; d.moved = true;
  const set = (it, fn) => { if (it.id === 'launch') { const L = ed.track.launch; const r = fn({ pos: L.pos.slice(), rot: [L.yaw || 0, 0, 0], scale: 1 }, it); L.pos = [r.pos[0], 0.03, r.pos[2]]; L.yaw = r.rot[0]; } else { const g = gateById(it.id); const r = fn(g, it); g.pos = r.pos; g.rot = r.rot; g.scale = r.scale; } };
  if (d.giz) {   // dragging a manipulator
    const g = d.giz, loc = ed.space === 'local' && d.items.length === 1;
    if (g.mode === 'move') { const L2 = d.sdir.lengthSq() || 1, m = snapG((dx * d.sdir.x + dy * d.sdir.y) / L2), v = d.axW.clone().multiplyScalar(m);
      for (const it of d.items) set(it, (gg, o) => ({ pos: clampToRoom([+(o.pos[0] + v.x).toFixed(4), Math.max(0, +(o.pos[1] + v.y).toFixed(4)), +(o.pos[2] + v.z).toFixed(4)]), rot: gg.rot, scale: gg.scale })); }
    if (g.mode === 'rotate') { let a = (Math.atan2(e.clientY - d.sc.y, e.clientX - d.sc.x) - d.a0) * 180 / Math.PI; while (a > 180) a -= 360; while (a < -180) a += 360; const da = snapA(d.toward >= 0 ? -a : a);
      for (const it of d.items) set(it, (gg, o) => { if (it.id === 'launch') return { pos: o.pos, rot: [(((o.rot[0] + (g.axis === 'y' ? da : 0)) % 360) + 360) % 360, 0, 0], scale: 1 };
        const r = rotated(o, g.axis, da, d.items.length > 1 ? d.pv : new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), loc); return { pos: r.pos, rot: r.rot, scale: gg.scale }; }); }
    if (g.mode === 'scale') { const f = Math.exp(-dy * 0.006); for (const it of d.items) if (it.id !== 'launch') set(it, (gg, o) => ({ pos: gg.pos, rot: gg.rot, scale: Math.round(Math.max(0.25, Math.min(4, o.scale * f)) * 100) / 100 })); }
    edRebuild(); edPropsLive(); return;
  }
  if (ed.tool === 'move' || ed.tool === 'paint') {
    if (d.vertical || ed.axis === 'y') { const dyM = -dy * ed.cam.dist * 0.0015; for (const it of d.items) set(it, (g, o) => ({ pos: clampToRoom([o.pos[0], snapG(Math.max(0, o.pos[1] + dyM)), o.pos[2]]), rot: g.rot, scale: g.scale })); }
    else { const f = edFloor(e, d.y0); if (!f || !d.f0) return; const ox = ed.axis === 'z' ? 0 : f.x - d.f0.x, oz = ed.axis === 'x' ? 0 : f.z - d.f0.z;
      for (const it of d.items) set(it, (g, o) => ({ pos: clampToRoom([snapG(o.pos[0] + ox), o.pos[1], snapG(o.pos[2] + oz)]), rot: g.rot, scale: g.scale })); }
  } else if (ed.tool === 'rotate') {
    // drag sideways to turn about the chosen axis (X / Y / Z keys or the Axis button; Y = turn on the floor)
    const axis = ed.axis || 'y', da = snapA(dx * 0.5), gi = d.items.filter(it => it.id !== 'launch');
    const c = new THREE.Vector3(); gi.forEach(it => c.add(new THREE.Vector3(it.pos[0], it.pos[1], it.pos[2]))); if (gi.length) c.multiplyScalar(1 / gi.length);
    for (const it of d.items) set(it, (g, o) => { if (it.id === 'launch') return { pos: o.pos, rot: [(((o.rot[0] + da) % 360) + 360) % 360, 0, 0], scale: 1 };
      const r = rotated(o, axis, da, gi.length > 1 && ed.space === 'global' ? c : new THREE.Vector3(o.pos[0], o.pos[1], o.pos[2]), ed.space === 'local'); return { pos: r.pos, rot: r.rot, scale: g.scale }; });
  } else if (ed.tool === 'scale') {
    const f = Math.exp(-dy * 0.006); for (const it of d.items) if (it.id !== 'launch') set(it, (g, o) => ({ pos: g.pos, rot: g.rot, scale: Math.round(Math.max(0.25, Math.min(4, o.scale * f)) * 100) / 100 }));
  }
  edRebuild(); edPropsLive();
});
addEventListener('mouseup', () => {
  if (mode !== 'editor' || !ed.drag) return; const d = ed.drag; ed.drag = null;
  if (d.kind === 'xf' && d.moved) { ed.undo.push(d.snap); ed.redo = []; ed.dirty = true; if (ed.tool !== 'scale' && !(d.giz && d.giz.mode === 'scale') && edMagnet(d.items.map(x => x.id))) { edRebuild(); edHint('Snapped onto the pipe ✓ (Magnet is on)'); } edPanels(); }
});
addEventListener('mouseup', e => {   // Define gate: press on one corner, drag, release on the opposite corner (or just click the two corners)
  if (mode !== 'editor' || ed.tool !== 'define' || !ed.defA || !ed.defDown) return; const moved = Math.hypot(e.clientX - ed.defDown.x, e.clientY - ed.defDown.y); ed.defDown = null;
  if (moved < 12) return; const c = edCorner(e), a = ed.defA; ed.defA = null; if (!c || !edDefine(a, c)) edRebuild();
});
canvas.addEventListener('wheel', e => { if (mode !== 'editor') return; e.preventDefault(); ed.cam.dist = Math.max(0.6, Math.min(80, ed.cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
// ---- keyboard
addEventListener('keydown', e => {
  if (mode !== 'editor') return; if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  const k = e.code, ctl = e.ctrlKey || e.metaKey;
  if (ctl && k === 'KeyZ') { e.preventDefault(); e.shiftKey ? edRedo() : edUndo(); return; } if (ctl && k === 'KeyY') { e.preventDefault(); edRedo(); return; }
  if (ctl && k === 'KeyD') { e.preventDefault(); edAct('clone'); return; } if (ctl && k === 'KeyS') { e.preventDefault(); edAct('save'); return; }
  if (k === 'KeyW') edAct('tool:move'); if (k === 'KeyE') edAct('tool:rotate'); if (k === 'KeyR') edAct('tool:scale'); if (k === 'KeyP') edAct('tool:paint');
  if (k === 'KeyX' || k === 'KeyY' || k === 'KeyZ') { const ax = k.slice(3).toLowerCase(); if (e.shiftKey) edRotateSel(ax, e.altKey ? -90 : 90); else ed.axis = ed.axis === ax ? null : ax; edToolbar(); return; }
  if (k === 'KeyN') { edAct('anglesnap'); return; } if (k === 'KeyM') { edAct('magnet'); return; }
  if (k === 'KeyD' && !ctl) edAct('tool:define');
  if (k === 'KeyL') edAct('space'); if (k === 'KeyG') edAct('ground'); if (k === 'KeyF') edAct('focus'); if (k === 'KeyO') edAct('ortho'); if (k === 'KeyT') edAct('test');
  if (k === 'Delete' || k === 'Backspace') edAct('delete');
  if (k === 'Escape') { if (ed.place || ed.paint || ed.tool === 'paint') { ed.place = null; ed.paint = null; if (ed.tool === 'paint') ed.tool = 'move'; edToolbar(); } else { ed.sel.clear(); edSelBox(); edPanels(); } }
  const step = e.shiftKey ? 0.3 : 0.05;
  const nudge = (ax, az, ay = 0) => { if (!ed.sel.size) return; e.preventDefault(); edPush(); for (const id of ed.sel) { const g = id === 'launch' ? null : gateById(id), pos = g ? g.pos : ed.track.launch.pos;
      let vx = ax, vz = az; if (ed.space === 'local' && g) { const a = g.rot[0] * Math.PI / 180; vx = ax * Math.cos(a) + az * Math.sin(a); vz = -ax * Math.sin(a) + az * Math.cos(a); }
      pos[0] += vx * step; pos[2] += vz * step; if (g) pos[1] = Math.max(0, pos[1] + ay * step); clampToRoom(pos); } edRebuild(); edPanels(); };
  if (k === 'ArrowLeft') nudge(-1, 0); if (k === 'ArrowRight') nudge(1, 0); if (k === 'ArrowUp') nudge(0, -1); if (k === 'ArrowDown') nudge(0, 1);
  if (k === 'PageUp') nudge(0, 0, 1); if (k === 'PageDown') nudge(0, 0, -1);
  if (k === 'BracketLeft' || k === 'BracketRight') { if (!ed.sel.size) return; edPush(); const da = (k === 'BracketLeft' ? -1 : 1) * (ed.snap || 5);
    for (const id of ed.sel) { if (id === 'launch') ed.track.launch.yaw = ((ed.track.launch.yaw || 0) + da + 360) % 360; else { const g = gateById(id); g.rot[0] = ((snapA(g.rot[0] + da)) + 360) % 360; } } edRebuild(); edPanels(); }
});
// ---- toolbar and panels
document.addEventListener('click', e => { const b = e.target.closest('[data-ed]'); if (!b || mode !== 'editor') return; edAct(b.dataset.ed); });
function edAct(a) {
  const T = ed.track;
  if (a.startsWith('tool:')) { ed.tool = a.slice(5); ed.defA = null; if (ed.tool === 'define') ed.place = null; if (ed.tool !== 'paint') ed.paint = null; else { ed.paint = null; if (!ed.place) ed.place = 'gate'; } }
  if (a.startsWith('lib:')) { const t = a.slice(4); ed.place = ed.place === t ? null : t; if (ed.tool === 'paint' && !ed.place) ed.place = 'gate'; }
  if (a === 'space') ed.space = ed.space === 'global' ? 'local' : 'global';
  if (a === 'grid') ed.grid = !ed.grid;
  if (a === 'ortho') ed.ortho = !ed.ortho;
  if (a === 'magnet') ed.magnet = !ed.magnet;
  if (a === 'anglesnap') { if (ed.snap) { ed.snapWas = ed.snap; ed.snap = 0; } else ed.snap = ed.snapWas || 15; }
  if (a === 'axis') ed.axis = { null: 'x', x: 'y', y: 'z', z: null }[String(ed.axis || null)];
  if (a.startsWith('rot:')) { const [, ax, dg] = a.split(':'); edRotateSel(ax, +dg); return; }
  if (a === 'rescale') { const v = parseFloat($('#edSec').value); if (v > 0) { edPush(); RC.rescaleTrack(T, v * 0.0254); $('#edSec').value = (T.section / 0.0254).toFixed(1); edRebuild(); edPanels(); edAct('focus'); edHint(`Whole track scaled to ${(T.section / 0.0254).toFixed(1)}-inch gates.`); } return; }
  if (a === 'flight') { ed.flight = !ed.flight; ed.flightT = 0; edFlightLine(); }
  if (a === 'undo') edUndo(); if (a === 'redo') edRedo();
  if (a === 'ground' && ed.sel.size) { edPush(); for (const id of ed.sel) if (id !== 'launch') gateById(id).pos[1] = 0; edRebuild(); edPanels(); }
  if (a === 'delete' && ed.sel.size) { edPush(); T.gates = T.gates.filter(g => !ed.sel.has(g.id)); ed.sel.clear(); edRebuild(); edPanels(); }
  if (a === 'clone' && ed.sel.size) { edPush(); const add = []; for (const id of ed.sel) { if (id === 'launch') continue; const g = JSON.parse(JSON.stringify(gateById(id))); g.id = RC.newGate(g.type, { x: 0, y: 0, z: 0 }).id; g.pos[0] += 0.4; g.pos[2] += 0.4; clampToRoom(g.pos); add.push(g); }
    T.gates.push(...add); ed.sel = new Set(add.map(g => g.id)); edRebuild(); edPanels(); }
  if (a === 'focus') { const ids = ed.sel.size ? [...ed.sel] : T.gates.map(g => g.id); if (ids.length) { const P = ids.map(id => id === 'launch' ? T.launch.pos : gateById(id).pos);
      ed.cam.t.set(P.reduce((s, p) => s + p[0], 0) / P.length, 0.4, P.reduce((s, p) => s + p[2], 0) / P.length);
      const span = Math.max(1, ...P.map(p => Math.hypot(p[0] - ed.cam.t.x, p[2] - ed.cam.t.z))); ed.cam.dist = Math.max(1.5, span * 2.6); } }
  if (a === 'save') { T.name = $('#edName').value.trim() || 'Track'; T.updated = new Date().toISOString(); T.sample = false; saveTrack(JSON.parse(JSON.stringify(T))); ed.dirty = false; edHint('Saved ✓ — find it under RaceGOW Tracks'); }
  if (a === 'test') { T.name = $('#edName').value.trim() || 'Track'; const v = RC.validateTrack(T, ed.W); if (RC.required(T).length < 1) { edHint('Add a gate first.'); return; }
    if (!v.ok) edHint('Flying anyway — fix the red items in Checks before racing for real.'); raceStart(T, 'infinite', { fromEditor: true }); flash('<b>FLY TEST</b><small>B: back to the editor · R: respawn at the last gate</small>'); return; }
  if (a === 'exit') { if (ed.dirty && !confirm('Leave without saving?')) return; editorClose(); openRaceMenu(); return; }
  edToolbar(); edPanels();
}
function edToolbar() {
  for (const b of document.querySelectorAll('#edTop [data-ed^="tool:"]')) b.classList.toggle('on', b.dataset.ed === 'tool:' + ed.tool);
  for (const b of document.querySelectorAll('#edLib [data-ed]')) b.classList.toggle('on', b.dataset.ed === 'lib:' + ed.place);
  $('#edSpace').textContent = ed.space === 'global' ? 'Global' : 'Local'; $('#edGrid').textContent = 'Grid: ' + (ed.grid ? '6 in' : 'off'); $('#edOrtho').textContent = ed.ortho ? 'Ortho' : 'Persp';
  $('#edSnap').value = String(ed.snap); $('#edAngle').textContent = 'Angle snap: ' + (ed.snap ? ed.snap + '°' : 'off'); $('#edAngle').classList.toggle('on', !!ed.snap); $('#edAxis').textContent = 'Axis: ' + (ed.axis ? ed.axis.toUpperCase() : 'free'); $('#edAxis').classList.toggle('on', !!ed.axis);
  $('#edMagnet').textContent = 'Snap: ' + (ed.magnet ? 'on' : 'off'); $('#edMagnet').classList.toggle('on', ed.magnet); $('#edFlight').classList.toggle('on', ed.flight);
  edHint(ed.tool === 'define' ? 'Define gate: drag from one corner to the opposite corner (or click the two corners) of any opening or open space. Corners snap to pipe ends; elsewhere they land on the floor. Same height = a flat gate to dive through.' : ed.tool === 'paint' ? `Paint path: click the floor to lay ${RC.GATE_TYPES[ed.place || 'gate'].label}s in order — each one turns to face along the path. Esc to stop.`
    : ed.place ? `Click in the room to place a ${RC.GATE_TYPES[ed.place].label} (Shift+click to place several). Esc to cancel.`
    : ed.sel.size ? `${ed.tool === 'move' ? 'Drag to move (Alt+drag or Axis Y: up/down; X / Z lock a direction)' : ed.tool === 'rotate' ? `Drag sideways to rotate about ${(ed.axis || 'y').toUpperCase()} (press X / Y / Z to pick the axis; Shift+X/Y/Z = quarter turn)` : 'Drag up/down to scale'} · arrows nudge · PgUp/PgDn height · [ ] rotate · Ctrl+D clone · Del delete`
    : 'Click a gate to select it (Shift+click adds). Pick a part on the left to place it.');
}
let hintT = 0; function edHint(t) { $('#edHint').textContent = t; hintT = performance.now(); }
function edPanels() {
  const T = ed.track; ed.valid = RC.validateTrack(T, ed.W || RC.buildTrackWorld(T, world));
  let num = 0;
  const nLoose = T.gates.filter(g => RC.GATE_TYPES[g.type].loose).length;
  $('#edOrder').innerHTML = (nLoose ? `<div class="oRow opt"><span class="n">–</span><span class="lb">${nLoose} loose pipes (the structure)</span></div>` : '') + T.gates.map((g, i) => { if (RC.GATE_TYPES[g.type].loose) return ''; const req = g.required && !RC.isProp(g); if (req) num++;
    return `<div class="oRow ${ed.sel.has(g.id) ? 'sel' : ''} ${req ? '' : 'opt'}" data-oi="${i}"><span class="n">${req ? num + (num === 1 ? '▶' : '') : '–'}</span><span class="lb">${RC.GATE_TYPES[g.type].label}${g.color !== 'white' ? ' · ' + g.color : ''}${g.bidir ? ' ⇄' : ''}</span>
      ${req ? `<button data-odir="${i}" title="Reverse the direction this gate is flown from">⇅</button><button data-obi="${i}" class="${g.bidir ? 'on' : ''}" title="Either direction counts">⇄</button>` : ''}<button data-oup="${i}" title="Earlier">↑</button><button data-odn="${i}" title="Later">↓</button></div>`; }).join('') + `<div class="oRow ${ed.sel.has('launch') ? 'sel' : ''}" data-olaunch><span class="n">▣</span><span class="lb">Launch pad</span></div>`;
  $('#edCount').textContent = `(${RC.required(T).length} gates)`; $('#edNext').checked = !!T.nextOnly;
  const stt = RC.trackStats(T, ed.W.geoms), hasLoose = T.gates.some(g => RC.GATE_TYPES[g.type].loose);
  $('#edStats').innerHTML = hasLoose ? `PVC: <b>${stt.sections}</b> / 20 sections of ${stt.sectionIn}″ ${stt.sections > 20.05 ? '<span class="warn">(over the RaceGOW 20)</span>' : ''}<br>Footprint: ${stt.footprint[0]} × ${stt.footprint[1]} sections ${stt.fits ? '<span class="ok">fits 4′ × 6′ at 24″</span>' : '<span class="warn">bigger than RaceGOW\'s 2 × 3</span>'}` : `Gate size ${stt.sectionIn}″`;
  { const rq = RC.required(T).map(i => ed.W.geoms[i].centre); let L = 0; for (let i = 1; i < rq.length; i++) L += S.len(S.sub(rq[i], rq[i - 1])); if (rq.length > 1 && T.startFinish !== false) L += S.len(S.sub(rq[0], rq[rq.length - 1]));
    $('#edStats').innerHTML += `<br>Lap: ${rq.length} gates, about <b>${L.toFixed(1)} m</b> gate to gate`; }
  if (document.activeElement !== $('#edSec')) $('#edSec').value = stt.sectionIn;
  const v = ed.valid; $('#edValid').innerHTML = (v.errors.map(x => `<div class="err">✗ ${x}</div>`).join('') + v.warnings.map(x => `<div class="warn">! ${x}</div>`).join('')) || '<div class="ok">✓ Ready to race</div>';
  edPropsPanel();
}
function edPropsPanel() {
  const ids = [...ed.sel], el = $('#edProps');
  if (!ids.length) { el.innerHTML = '<p class="hint">Nothing selected.</p>'; return; }
  if (ids.length > 1) { el.innerHTML = `<p>${ids.length} selected</p><label>Colour <select data-pall="color">${Object.keys(RC.COLORS).map(c => `<option>${c}</option>`).join('')}</select></label>
    <label class="chk"><input type="checkbox" data-pall="required" checked> numbered (part of the lap)</label>`; return; }
  if (ids[0] === 'launch') { const L = ed.track.launch; el.innerHTML = `<p><b>Launch pad</b> — where you start and respawn before the first gate.</p><div class="pGrid">
    <label>x <input type="number" step="0.05" data-pl="0" value="${L.pos[0].toFixed(2)}"></label><label>z <input type="number" step="0.05" data-pl="2" value="${L.pos[2].toFixed(2)}"></label><label>yaw° <input type="number" step="5" data-pl="yaw" value="${Math.round(L.yaw || 0)}"></label></div>`; return; }
  const g = gateById(ids[0]); if (!g) return; const T = RC.GATE_TYPES[g.type], f = (k, v, st) => `<label>${k} <input type="number" step="${st}" data-p="${k}" value="${v}"></label>`;
  el.innerHTML = `<label>Part <select data-p="type">${Object.entries(RC.GATE_TYPES).map(([k, t]) => `<option value="${k}" ${k === g.type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
    <div class="pGrid">${f('x', g.pos[0].toFixed(3), 0.05)}${f('y', g.pos[1].toFixed(3), 0.05)}${f('z', g.pos[2].toFixed(3), 0.05)}${f('yaw', g.rot[0].toFixed(1), ed.snap || 1)}${f('pitch', g.rot[1].toFixed(1), ed.snap || 1)}${f('roll', g.rot[2].toFixed(1), ed.snap || 1)}
    ${f('scale', g.scale, 0.05)}${g.type === 'pipe' ? '' : f('w', g.w, 0.25)}${g.type === 'bar' ? '' : f('h', g.h, 0.25)}${T.prop ? '' : f('lift', g.lift, 0.25)}</div>
    <p class="hint">w / h / lift in 24-inch sections.</p>
    <label>Colour <select data-p="color">${Object.keys(RC.COLORS).map(c => `<option ${c === g.color ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
    ${T.prop ? '' : `<label class="chk"><input type="checkbox" data-p="required" ${g.required ? 'checked' : ''}> numbered (part of the lap)</label><label class="chk"><input type="checkbox" data-p="bidir" ${g.bidir ? 'checked' : ''}> either direction counts</label>`}
    ${T.invisible ? `<div class="row" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0"><button data-pfn="stand">Standing</button><button data-pfn="down">Flat: dive down through</button><button data-pfn="upw">Flat: climb up through</button><button data-pfn="flip">Reverse direction</button><button data-pfn="again">Use this opening again</button></div><p class="hint">Size it to the opening in your structure (w × h in sections). It can stick out past the pipes for an open-topped gate.</p>` : ''}
    <div class="row" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0">${['x', 'y', 'z'].map(ax => `<button data-ed="rot:${ax}:${ed.snap || 90}" title="Turn about ${ax.toUpperCase()}">⟳ ${ax.toUpperCase()} +${ed.snap || 90}°</button><button data-ed="rot:${ax}:-${ed.snap || 90}">−</button>`).join('')}</div>
    ${T.loose ? `<div class="row" style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0"><button data-pfn="pUp">Upright</button><button data-pfn="pX">Lay along X</button><button data-pfn="pZ">Lay along Z</button><button data-pfn="pEnd" title="Swap which end is the joining end">Swap ends</button></div><p class="hint">A pipe turns about the end you joined it by. Click a pipe end with "Pipe" picked to add the next one there.</p>` : `<div class="row" style="display:flex;gap:4px;flex-wrap:wrap"><button data-pfn="face">Face the next gate</button><button data-pfn="first">Make it gate 1</button></div>`}`;
}
function edPropsLive() {   // keep the numbers in the panel in step while dragging
  const ids = [...ed.sel]; if (ids.length !== 1 || ids[0] === 'launch') return; const g = gateById(ids[0]); if (!g) return;
  for (const inp of document.querySelectorAll('#edProps [data-p]')) { const k = inp.dataset.p, v = { x: g.pos[0], y: g.pos[1], z: g.pos[2], yaw: g.rot[0], pitch: g.rot[1], roll: g.rot[2], scale: g.scale }[k]; if (v != null && document.activeElement !== inp) inp.value = (+v).toFixed(k === 'scale' ? 2 : k.length > 1 ? 1 : 3); }
}
document.addEventListener('change', e => {
  if (mode !== 'editor') return; const t = e.target;
  if (t.id === 'edName') { ed.track.name = t.value.trim() || 'Track'; ed.dirty = true; return; }
  if (t.id === 'edSF') { edPush(); ed.track.startFinish = t.checked; edRebuild(); edPanels(); return; }
  if (t.id === 'edShow') { ed.track.showNext = t.checked; ed.dirty = true; return; }
  if (t.id === 'edNext') { edPush(); ed.track.nextOnly = t.checked; edRebuild(); edPanels(); return; }
  if (t.id === 'edSnap') { ed.snap = +t.value; edToolbar(); return; }
  if (t.id === 'edColor') { ed.color = t.value; return; }
  if (t.dataset.pl !== undefined) { edPush(); const L = ed.track.launch; if (t.dataset.pl === 'yaw') L.yaw = +t.value || 0; else L.pos[+t.dataset.pl] = +t.value || 0; clampToRoom(L.pos); L.pos[1] = 0.03; edRebuild(); edPanels(); return; }
  if (t.dataset.pall) { edPush(); for (const id of ed.sel) { const g = gateById(id); if (!g) continue; if (t.dataset.pall === 'color') g.color = t.value; else g.required = t.checked && !RC.isProp(g); } edRebuild(); edPanels(); return; }
  if (!t.dataset.p) return; const g = gateById([...ed.sel][0]); if (!g) return; edPush(); const k = t.dataset.p, v = t.type === 'checkbox' ? t.checked : t.value;
  if (k === 'type') { const D = RC.GATE_TYPES[v].defaults; g.type = v; Object.assign(g, { w: D.w, h: D.h, lift: D.lift }); if (RC.GATE_TYPES[v].prop) g.required = false; }
  else if (k === 'x' || k === 'y' || k === 'z') { g.pos['xyz'.indexOf(k)] = +v || 0; clampToRoom(g.pos); }
  else if (k === 'yaw' || k === 'pitch' || k === 'roll') g.rot[['yaw', 'pitch', 'roll'].indexOf(k)] = +v || 0;
  else if (k === 'scale') g.scale = Math.max(0.25, Math.min(4, +v || 1));
  else if (k === 'w' || k === 'h' || k === 'lift') g[k] = Math.max(k === 'lift' ? 0 : 0.25, Math.min(8, +v || 0));
  else if (k === 'color') g.color = v; else if (k === 'required') g.required = !!v; else if (k === 'bidir') g.bidir = !!v;
  edRebuild(); edPanels();
});
document.addEventListener('click', e => {
  if (mode !== 'editor') return; const T = ed.track;
  const up = e.target.closest('[data-oup]'), dn = e.target.closest('[data-odn]'), row = e.target.closest('[data-oi]'), lr = e.target.closest('[data-olaunch]'), fn = e.target.closest('[data-pfn]');
  const od = e.target.closest('[data-odir]'), ob = e.target.closest('[data-obi]');
  if (od || ob) { const g = T.gates[+(od || ob).dataset[od ? 'odir' : 'obi']]; edPush(); if (ob) g.bidir = !g.bidir; else if (Math.abs(g.rot[1]) > 45) g.rot[1] = -g.rot[1]; else g.rot[0] = (g.rot[0] + 180) % 360;
    ed.sel.clear(); ed.sel.add(g.id); edRebuild(); edPanels(); return; }
  if (up || dn) { const i = +(up || dn).dataset[up ? 'oup' : 'odn'], j = i + (up ? -1 : 1); if (j < 0 || j >= T.gates.length) return; edPush(); [T.gates[i], T.gates[j]] = [T.gates[j], T.gates[i]]; edRebuild(); edPanels(); return; }
  if (row) { const id = T.gates[+row.dataset.oi].id; if (e.shiftKey) { ed.sel.has(id) ? ed.sel.delete(id) : ed.sel.add(id); } else { ed.sel.clear(); ed.sel.add(id); } edSelBox(); edPanels(); return; }
  if (lr) { ed.sel.clear(); ed.sel.add('launch'); edSelBox(); edPanels(); return; }
  if (fn) { const g = gateById([...ed.sel][0]); if (!g) return; edPush();
    if (fn.dataset.pfn === 'first') { T.gates = [g, ...T.gates.filter(x => x !== g)]; }
    if (fn.dataset.pfn === 'pUp') g.rot = [0, 0, 0]; if (fn.dataset.pfn === 'pX') g.rot = [0, 0, -90]; if (fn.dataset.pfn === 'pZ') g.rot = [0, 90, 0];
    if (fn.dataset.pfn === 'pEnd') { const G = RC.gateGeom(g, T.section), e = G.pipes[0][1]; g.pos = [+e.x.toFixed(4), Math.max(0, +e.y.toFixed(4)), +e.z.toFixed(4)]; const r = rotated(g, 'x', 180, new THREE.Vector3(g.pos[0], g.pos[1], g.pos[2]), true); g.rot = r.rot; }
    if (fn.dataset.pfn.startsWith('p')) edMagnet([g.id]);
    if (fn.dataset.pfn === 'stand') { g.rot[1] = 0; g.rot[2] = 0; if (g.lift < 0) g.lift = 0; }
    if (fn.dataset.pfn === 'down' || fn.dataset.pfn === 'upw') { g.rot[1] = fn.dataset.pfn === 'down' ? -90 : 90; g.rot[2] = 0; g.lift = -g.h / 2; }   // centred on its position
    if (fn.dataset.pfn === 'flip') { if (Math.abs(g.rot[1]) > 45) g.rot[1] = -g.rot[1]; else g.rot[0] = (g.rot[0] + 180) % 360; }
    if (fn.dataset.pfn === 'again') { const c = JSON.parse(JSON.stringify(g)); c.id = RC.newGate(g.type, { x: 0, y: 0, z: 0 }).id; if (Math.abs(c.rot[1]) > 45) c.rot[1] = -c.rot[1]; else c.rot[0] = (c.rot[0] + 180) % 360; T.gates.push(c); ed.sel.clear(); ed.sel.add(c.id); T.nextOnly = true; edHint('Added the same opening again, flown the other way, at the end of the order. "Only the next gate counts" is now on.'); }
    if (fn.dataset.pfn === 'face') { const req = T.gates.filter(x => x.required && !RC.isProp(x)), i = req.indexOf(g), nx = req[(i + 1) % req.length]; if (nx && nx !== g) faceAlong(g, g.pos, nx.pos); }
    edRebuild(); edPanels(); }
});
window.__pw.race = { start: (t, m, o) => raceStart(t, m, o), get state() { return race; }, editor: t => openEditor(t || RC.newTrack('livingroom')), get ed() { return ed; }, menu: () => openRaceMenu(), off: () => raceOff(), edAct, step: (p0, dt) => raceStep(p0, dt),
  gizPt: (mode_, ax) => { const g = (mode_ === 'move' ? GZ.move : mode_ === 'rotate' ? GZ.rot : GZ.scl).children.find(c => (c.userData.giz.axis || null) === (ax || null)); GZ.grp.updateMatrixWorld(true); const v = (mode_ === 'move' ? AXV[ax].clone().multiplyScalar(0.7) : mode_ === 'rotate' ? (ax === 'y' ? new THREE.Vector3(0.9, 0, 0) : ax === 'x' ? new THREE.Vector3(0, 0.9, 0) : new THREE.Vector3(0.9, 0, 0)) : new THREE.Vector3()).applyMatrix4(GZ.grp.matrixWorld).project(edCam()); void g; return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
  projectPt: p => { const v = new THREE.Vector3(p[0], p[1], p[2]).project(edCam()); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; },
  project: id => { const i = ed.track.gates.findIndex(g => g.id === id), G = ed.W.geoms[i], p = G.pipes[2] ? S.mul(S.add(G.pipes[2][0], G.pipes[2][1]), 0.5) : G.centre, v = new THREE.Vector3(p.x, p.y, p.z).project(edCam()); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; } };
