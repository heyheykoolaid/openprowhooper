const THREE = window.THREE;   // three.js r160 (UMD) is loaded by a plain <script> before this module
const S = window.Sim;
const $ = s => document.querySelector(s);
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));   // every bit of remote or typed text that goes into HTML
const store = { get(k, d) { try { const v = localStorage.getItem('pw.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem('pw.' + k, JSON.stringify(v)); } catch {} } };

// ============================================================ state
let spec = store.get('spec', { ...S.PRESETS['Air65 Racing'] });
let tune = Object.assign(S.defaultTune(), store.get('tune', {}));
// the feel fitted from real Blackbox logs (Feel Lab, tools/feelfit.js): shake 1 and 3 ms of loop delay unless the pilot set them
// Owner, 2026-11-18, after flying it: the fitted shake (1, 60 ms) with 3 ms of delay was too jittery. The defaults are now
// close to the old sim with a hint of soft wobble on movement; pilots still on the first fitted values get the new ones.
const FEEL3 = { shake: 0.35, shakeTau: 0.2, shakeMove: 1, loopDelayMs: 0, camBuzz: 0 };
if (!store.get('feel3', false)) { if (tune.shake == null || (tune.shake === 1 && tune.loopDelayMs === 3)) Object.assign(tune, FEEL3); store.set('feel3', true); }
for (const [k, v] of Object.entries(FEEL3)) if (tune[k] == null) tune[k] = v;
// rates v2 (150/680/0.5): saved tunes still on the old defaults get the new ones; rates the pilot changed are kept
(() => { const OLD = { roll: [200, 900, 0.4], pitch: [200, 900, 0.4], yaw: [180, 700, 0.3] }, d = S.defaultTune().rates;
  if (tune.ratesV2) return; for (const ax of ['roll', 'pitch', 'yaw']) { const r = tune.rates && tune.rates[ax], o = OLD[ax];
    if (r && r.center === o[0] && r.max === o[1] && Math.abs(r.expo - o[2]) < 1e-6) Object.assign(r, { center: d[ax].center, max: d[ax].max, expo: d[ax].expo }); }
  tune.ratesV2 = true; store.set('tune', tune); })();
// the map: chosen on the main menu, remembered, built once at start-up (changing it reloads the page)
const MAP_ID = S.MAPS[store.get('map', 'moose')] ? store.get('map', 'moose') : 'moose';   // Moose Knuckle Park is the default (pilot, 2026-11-17)
// The pilot's own maps (Map Editor). Players never change an official map: their map is a named copy of one, a layer over
// it (store 'myMaps': [{ id, name, base, E, at }]; the one being flown: store 'myMap', only while its base map is loaded).
// Layouts from before (store 'mapEdits', one per map, which changed the map itself) became "<map> (my layout)" once.
const layerHas = E => !!E && ((E.moved && Object.keys(E.moved).length > 0) || (E.removed && E.removed.length > 0) || (E.added && E.added.length > 0));
const MY_MAPS = (() => { let L = store.get('myMaps', null); if (Array.isArray(L)) return L.filter(m => m && typeof m.id === 'string' && S.MAPS[m.base]);
  L = []; const old = store.get('mapEdits', {}) || {};
  for (const [id, E] of Object.entries(old)) if (S.MAPS[id] && layerHas(E)) L.push({ id: 'my' + Date.now().toString(36) + L.length, name: S.MAPS[id].title + ' (my layout)', base: id, E, at: new Date().toISOString() });
  store.set('myMaps', L); return L; })();
const LAYOUT_OFF = store.get('layoutOffOnce', false); if (LAYOUT_OFF) store.set('layoutOffOnce', false);   // watching a board run: the official map, this once
let MY_MAP = (() => { if (LAYOUT_OFF) return null; const m = MY_MAPS.find(x => x.id === store.get('myMap', null)); return m && m.base === MAP_ID ? m : null; })();
// another pilot's map from the community list (Maps screen; read-only, cleaned when it was downloaded: store 'commMaps')
let COMM_MAP = (() => { if (LAYOUT_OFF || MY_MAP) return null; const id = store.get('commMap', null), m = id && (store.get('commMaps', {}) || {})[id]; return m && m.base === MAP_ID && m.E ? m : null; })();
let MAP_EDITS = MY_MAP ? (layerHas(MY_MAP.E) ? MY_MAP.E : null) : COMM_MAP && layerHas(COMM_MAP.E) ? COMM_MAP.E : null;
{ const loc = (store.get('officialLocal', {}) || {})[MAP_ID], ship = S.officialEdits(MAP_ID);   // the owner's just-published layout, until the rebuilt game has it
  if (loc && (!ship || String(loc.at || '') > String(ship.at || ''))) S.setOfficialEdits(MAP_ID, loc); }
S.setMapEdits(MAP_ID, MAP_EDITS);
const world = S.MAPS[MAP_ID].build(); world.baseTitle = world.title; if (MY_MAP) world.title = MY_MAP.name; else if (COMM_MAP) world.title = `${COMM_MAP.name} by ${COMM_MAP.by}`;
let params = S.buildDrone(spec);
const drone = new S.Drone(params, tune, world);
drone.crashImpact = 9.5;   // a ducted whoop bounces off more than the bare number used by the tests (pilot: crashing should be more forgiving)
const detector = new S.TrickDetector(world);
let activeWorld = world;   // the playground, or a race track's room + gates (raceedit.js useWorld)
let score = new S.ScoreKeeper();
let mode = 'menu';           // menu | fly | paused
let session = null;          // {timeLeft} for 2-minute runs
let camMode = 'fpv';

// ============================================================ renderer / scene
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Performance (2026-11-17, testers reported heavy CPU): the diagnostic overlay (Options → Graphics, or F3) and two graphics
// settings: render resolution (a share of the screen's pixels) and shadows. PERF collects the timings play.js measures.
const PERF = { fx: store.get('screenFx', true), on: store.get('perfHud', false), res: store.get('renderScale', 1), shadows: store.get('shadows', true), lights: store.get('mapLights', 'auto'), acc: { phys: 0, det: 0, rend: 0, frame: 0, ui: 0, steps: 0, n: 0, worst: 0 }, shown: 0, staticPieces: 0, staticMeshes: 0 };
PERF.resAuto = PERF.res === 'auto'; if (PERF.resAuto) PERF.res = 1;   // Auto: the game lowers the resolution when the frame rate drops (resAutoTick in play.js)
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * PERF.res);
// which GPU the browser draws with. Software (SwiftShader, llvmpipe, "Basic Render") means hardware acceleration is off: a
// tester's Ryzen + GeForce PC ran at 45 fps with the CPU at 73% and the GeForce idle until they turned it on.
const GPU = (() => { try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); return String(x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).slice(0, 120); } catch { return ''; } })();
const GPU_SOFT = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(GPU);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = PERF.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const playRoot = new THREE.Group(); scene.add(playRoot);   // the playground; race rooms have their own group (raceedit.js)
scene.fog = new THREE.Fog(0xc7ae8c, 28, 110);
const fpvCam = new THREE.PerspectiveCamera(90, 1, 0.004, 400);
const chaseCam = new THREE.PerspectiveCamera(70, 1, 0.01, 400);

