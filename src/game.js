const THREE = window.THREE;   // three.js r160 (UMD) is loaded by a plain <script> before this module
const S = window.Sim;
const $ = s => document.querySelector(s);
const store = { get(k, d) { try { const v = localStorage.getItem('pw.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem('pw.' + k, JSON.stringify(v)); } catch {} } };

// ============================================================ state
let spec = store.get('spec', { ...S.PRESETS['Air65 Racing'] });
let tune = Object.assign(S.defaultTune(), store.get('tune', {}));
// rates v2 (150/680/0.5): saved tunes still on the old defaults get the new ones; rates the pilot changed are kept
(() => { const OLD = { roll: [200, 900, 0.4], pitch: [200, 900, 0.4], yaw: [180, 700, 0.3] }, d = S.defaultTune().rates;
  if (tune.ratesV2) return; for (const ax of ['roll', 'pitch', 'yaw']) { const r = tune.rates && tune.rates[ax], o = OLD[ax];
    if (r && r.center === o[0] && r.max === o[1] && Math.abs(r.expo - o[2]) < 1e-6) Object.assign(r, { center: d[ax].center, max: d[ax].max, expo: d[ax].expo }); }
  tune.ratesV2 = true; store.set('tune', tune); })();
// the map: chosen on the main menu, remembered, built once at start-up (changing it reloads the page)
const MAP_ID = S.MAPS[store.get('map', 'moose')] ? store.get('map', 'moose') : 'moose';   // Moose Knuckle Park is the default (pilot, 2026-11-17)
const world = S.MAPS[MAP_ID].build();
let params = S.buildDrone(spec);
const drone = new S.Drone(params, tune, world);
drone.crashImpact = 9.5;   // a ducted whoop bounces off more than the bare number used by the tests (pilot: crashing should be more forgiving)
const detector = new S.TrickDetector(world);
let activeWorld = world;   // the playground, or a race track's room + gates (editor.js useWorld)
let score = new S.ScoreKeeper();
let mode = 'menu';           // menu | fly | paused
let session = null;          // {timeLeft} for 2-minute runs
let camMode = 'fpv';

// ============================================================ renderer / scene
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Performance (2026-11-17, testers reported heavy CPU): the diagnostic overlay (Options → Graphics, or F3) and two graphics
// settings: render resolution (a share of the screen's pixels) and shadows. PERF collects the timings play.js measures.
const PERF = { on: store.get('perfHud', false), res: store.get('renderScale', 1), shadows: store.get('shadows', true), acc: { phys: 0, det: 0, rend: 0, frame: 0, ui: 0, steps: 0, n: 0, worst: 0 }, shown: 0, staticPieces: 0, staticMeshes: 0 };
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * PERF.res);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = PERF.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const playRoot = new THREE.Group(); scene.add(playRoot);   // the playground; race rooms have their own group (editor.js)
scene.fog = new THREE.Fog(0xc7ae8c, 28, 110);
const fpvCam = new THREE.PerspectiveCamera(90, 1, 0.004, 400);
const chaseCam = new THREE.PerspectiveCamera(70, 1, 0.01, 400);

