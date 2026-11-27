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
// trick names in the labelling lists: alphabetical (owner, 2026-11-18), ignoring case, numbers in order
const abcSort = a => a.slice().sort((x, y) => String(x).localeCompare(String(y), undefined, { sensitivity: 'base', numeric: true }));
const FEEL3 = { shake: 0.35, shakeTau: 0.2, shakeMove: 1, loopDelayMs: 0, camBuzz: 0 };
if (!store.get('feel3', false)) { if (tune.shake == null || (tune.shake === 1 && tune.loopDelayMs === 3)) Object.assign(tune, FEEL3); store.set('feel3', true); }
// Owner, 2026-11-18: "adjust to the real quad": fitted to a second pilot's 30000KV whoop (7 flights, Air65 Champion build):
// wobble 2.25 at 0.1 s on movement gives its 2-20 Hz wobble (sim 6.5 / 7.2 °/s, real 8.7 / 6.5) and tracking error; its lag
// (7.7 / 7.8 ms) needs no extra delay; it hovers like 0.9 of the build's weight. Pilots still on FEEL3 (or the first fit) get
// these once; anyone who moved a slider keeps their own.
const FEEL_FIT = { shake: 2.25, shakeTau: 0.1, shakeMove: 1, loopDelayMs: 0, camBuzz: 0 }, WEIGHT_DEF = 0.9;
if (!store.get('feel4', false)) { const on3 = Object.entries(FEEL3).every(([k, v]) => tune[k] === v);
  if (on3) Object.assign(tune, FEEL_FIT); if (tune.weightFeel == null || tune.weightFeel === 1) tune.weightFeel = WEIGHT_DEF; store.set('feel4', true); }
// Owner, 2026-11-18, after tuning it himself: wobble 70 %, 220 ms, 10 % on movement (so most of it is there all the time), no
// delay, no buzz. This is the default; pilots still on the log fit (FEEL_FIT) get it once.
const FEEL_DEF = { shake: 0.7, shakeTau: 0.22, shakeMove: 0.1, loopDelayMs: 0, camBuzz: 0 };
if (!store.get('feel5', false)) { if (Object.entries(FEEL_FIT).every(([k, v]) => tune[k] === v)) Object.assign(tune, FEEL_DEF); store.set('feel5', true); }
for (const [k, v] of Object.entries(FEEL_DEF)) if (tune[k] == null) tune[k] = v;
// Wall grip (2026-11-19, Metal Craft Fpv: "I can't wall stick, I just slide down the wall"): ducts on a wall grip like TPU,
// 0.9, not the 0.45 of everything else; with it a whoop pushed into a wall sticks from about a third throttle. Physics
// (Node) keeps no wallGrip, so its hash is unchanged; the game fills it in for pilots who have none.
const WALL_GRIP_DEF = 0.9; if (tune.wallGrip == null) tune.wallGrip = WALL_GRIP_DEF;
// Disarmed spin (tune.deadSpin, owner 2026-11-21: disarm tricks): the share of the rotational air drag a quad with its motors off still
// feels. At 1 (the physics as built) a cut flip stopped within a quarter turn; a real whoop tumbles on. The game fills in 0.1: a
// first guess, to be set from the owner's own disarm flips. Node keeps none, so the physics hash is unchanged.
const DEAD_SPIN_DEF = 0.1; if (tune.deadSpin == null) tune.deadSpin = DEAD_SPIN_DEF;
// Battery drain (tune.drain): the motor model alone draws a third of what a real whoop does (Blackbox, 2026-11-19: a real Air65 hovers
// on 10-14 W, the sim on 5-6 W); fitted on three quads' logs to 3.0-3.3 (4.3 on a cold, windy day). Absent in the physics = 1.
// Props fitted to a real whoop's hover rpm (owner, 2026-11-19: "about 34,000 rpm, just to try"): thrust ×1.31, torque ×1.8
// (tune.propCt / propCq; absent in the physics = 1): an Air65 hovers at ~34k rpm (real 31k, the parts alone 38k) on 33 % throttle
// with the same top thrust; the drain was refitted with them (2.4 on the 2026-11-18 log and bum-darts; it was 3.2 without them)
const PROP_FIT = { ct: 1.31, cq: 1.8 }, DRAIN_DEF = 2.4;
if (tune.propCt == null) { tune.propCt = PROP_FIT.ct; tune.propCq = PROP_FIT.cq; if (tune.drain === 3.2) tune.drain = DRAIN_DEF; }   // the 3.2 of the first fit went with the old props
if (tune.drain == null) tune.drain = DRAIN_DEF;
// tune.inflow (owner, 2026-11-27, "2 and 3" after reading WebFPV): thrust from the rotor's own inflow (momentum theory), on in the game
if (tune.inflow == null) tune.inflow = 1;
// the load the owner's Air65 logs measure (the motors' rpm at every throttle, hover rpm and current; tools/propfit.js): a preset, not the default
const LOG_LOAD = { propCt: 1.7, propFM: 0.15, drain: 1 };
// Battery life off by default (owner, 2026-11-20: "not necessary in our sim"): the pack never runs down unless the pilot ticks
// Garage → Battery life. Everyone is switched off once (`store 'batOff'`); the physics (Node) keeps it on when absent.
if (!store.get('batOff', false)) { tune.batteryLife = false; store.set('batOff', true); store.set('tune', tune); } else if (tune.batteryLife == null) tune.batteryLife = false;
// rates v2 (150/680/0.5): saved tunes still on the old defaults get the new ones; rates the pilot changed are kept
(() => { const OLD = { roll: [200, 900, 0.4], pitch: [200, 900, 0.4], yaw: [180, 700, 0.3] }, d = S.defaultTune().rates;
  if (tune.ratesV2) return; for (const ax of ['roll', 'pitch', 'yaw']) { const r = tune.rates && tune.rates[ax], o = OLD[ax];
    if (r && r.center === o[0] && r.max === o[1] && Math.abs(r.expo - o[2]) < 1e-6) Object.assign(r, { center: d[ax].center, max: d[ax].max, expo: d[ax].expo }); }
  tune.ratesV2 = true; store.set('tune', tune); })();
// the map: chosen on the main menu, remembered, built once at start-up (changing it reloads the page)
const MAP_ID = (() => { let id = store.get('map', 'moose');
  if (id === 'training' && !store.get('coachPending', null)) { id = store.get('trainBack', 'moose'); if (id === 'training') id = 'moose'; store.set('map', id); }   // the Training Room only opens for Train (coach.js)
  return S.MAPS[id] ? id : 'moose'; })();   // Moose Knuckle Park is the default (pilot, 2026-11-17)
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
// Daily K.W.A.D. (owner, 2026-11-20): the day's four tricks for a map, the same for everyone (S.dailyKwad: the board's UTC day + the
// map). On the loaded map only objects that are really there are asked for (a pilot's own layout may have removed one).
const kwadDay = () => new Date().toISOString().slice(0, 10);
function kwadFor(map, w) { const names = w ? new Set(w.objs.map(o => o.name)) : null; return S.dailyKwad(map, kwadDay(), names ? n => names.has(n) : null); }
function newScore() { return new S.ScoreKeeper(null, kwadFor(MAP_ID, world)); }
function kwadHtml(set, got) {   // the four as rows; `got` = the letters already taken this run (object names are the maps' own)
  return ['K', 'W', 'A', 'D'].map(L => { const k = set ? set[L] : S.KWAD[L], nm = k.trick || k; return `<div class="kwRow ${got && got[L] ? 'got' : ''}" data-kwt="${esc(nm)}" title="What is a ${esc(nm)}? Click for the trick"><b>${L}</b><span>${esc(nm)}${k.obj ? ` <small>on the ${esc(k.obj)}</small>` : ''}</span></div>`; }).join('');
}
// Toasty (owner, 2026-11-26): click a K.W.A.D. trick (pause menu, the daily board) for what it is: its definition, points and
// difficulty open under the row, with the Tricktionary (searched to that trick) and its prowhooper.com page one click away
function kwadDef(row) {
  const nm = row.dataset.kwt, next = row.nextElementSibling; if (next && next.classList.contains('kwDef')) { next.remove(); return; }
  const t = (window.TPW_TRICKS || []).find(x => x.name.trim() === nm); if (!t) return;
  const url = typeof pwSiteUrl === 'function' ? pwSiteUrl(nm, t.cat) : '';
  row.insertAdjacentHTML('afterend', `<div class="kwDef"><small>${esc(t.diff)} · ${Number(t.pts) || 0} pts</small><p>${esc(t.desc || '')}</p><div class="row"><a href="#" class="pwHome" data-kwopen="${esc(nm)}">📖 in the Tricktionary</a>${url ? `<a class="pwHome" href="${url}" target="_blank" rel="noopener">↗ prowhooper.com</a>` : ''}</div></div>`);
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-kwopen]'); if (o) { e.preventDefault(); const nm = o.dataset.kwopen; openTricks(); const box = $('#tSearch'); if (box) { box.value = nm; trickFilter(); } return; }
  const r = e.target.closest('.kwRow[data-kwt]'); if (r && !r.closest('#kwadList')) kwadDef(r);
});
// How to tell look-alike tricks apart (owner, 2026-11-27: "the difference between a rubiks cube and a power roll, is an over under
// object, and a power roll, is more of a loop motion, with a roll at the top. can we help our helpers better distinguish?"). Shown to
// whoever is judging a call (SKITTLES mode, Quick check, the Review Hub's player) when the call or the answer is one of a pair, and
// under each trick in the Tricktionary. Wording from the owner and the book; edit freely.
const TELL_APART = [
  ["Rubik's Cube", 'Power Roll', "A Power Roll goes round an over/under object: under it, a loop up and over the top with a roll at the top, and back down under it. A Rubik's Cube has no object: half a flip, a roll, half a flip, more or less where you are."],
  ['Immelmann', 'Power Roll', 'An Immelmann is half a loop up and over the object, then a half roll at the top to fly away upright. A Power Roll keeps looping: a full roll at the top and on down the far side, back under the object.'],
  ['Powerloop', 'Flip', 'A Powerloop is a loop round an object: under it, up and over the top upside-down, and back under it flying on forward. A Flip turns over once in the air with nothing to go round.'],
  ['Matty Flip', 'Powerloop', 'A Matty Flip goes OVER the object first, flips forward and comes out under it flying backward. A Powerloop goes UNDER first, loops back over the top and flies on forward.'],
  ['Trippy Spin', 'Orbits', 'Trippy Spin: roll and yaw sticks pushed opposite ways ("wonky nips"), the camera looking up at the object, which stays at the top of the screen. Orbits: the sticks the same way, circling it the ordinary way.'],
  ['Jump Rope', 'Side Loop', 'A Jump Rope stays upright over the top of the object. A Side Loop is upside-down at the top.'],
];
function tellApart(names, short) {
  const N = (names || []).filter(Boolean).map(x => String(x).replace(/ x2$/, '')), hits = TELL_APART.filter(([a, b]) => N.includes(a) || N.includes(b));
  if (!hits.length) return '';
  const pick = N.length > 1 ? (hits.find(([a, b]) => N.includes(a) && N.includes(b)) || hits[0]) : null;
  return (pick ? [pick] : hits).map(([a, b, t]) => `<div class="tellApart"><b>${esc(a)} or ${esc(b)}?</b> ${esc(t)}</div>`).slice(0, short ? 1 : 3).join('');
}
let kwadListT = 0;
function kwadShow(ms) { const el = $('#kwadList'); if (!el) return; el.innerHTML = `<small>${score.kw ? "TODAY'S K.W.A.D." : 'K.W.A.D.'}</small>` + kwadHtml(score.kw, score.kwad); el.classList.remove('hide'); clearTimeout(kwadListT); if (ms) kwadListT = setTimeout(() => el.classList.add('hide'), ms); }   /* no ms: stays up (owner, 2026-11-27) */
function kwadMenus() {   // the pause menu's list (owner, 2026-11-21: not on the main menu)
  const p = $('#pauseKwad'); if (p) { const on = mode === 'paused' && !race.on; p.classList.toggle('hide', !on); if (on) p.innerHTML = `<small>${score.kw ? "TODAY'S K.W.A.D." : 'K.W.A.D.'}</small>` + kwadHtml(score.kw, score.kwad); }
}
let mode = 'menu';           // menu | fly | paused
let session = null;          // {timeLeft} for 2-minute runs
let camMode = 'fpv';

// ============================================================ renderer / scene
const canvas = $('#view');
// Low-latency display (Options → Graphics, after a reload; off by default): asks the browser to show the canvas without
// waiting on the page compositor (`desynchronized`): about a frame less lag where the browser supports it, maybe tearing
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', desynchronized: !!store.get('lowLatency', false) });
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

