// ============================================================ The Map Editor (main menu → Map Editor; for every pilot)
// Move, turn, scale, remove or add anything on the current map, from an asset library (trees, park furniture, play
// equipment, over/unders and gaps, houses…). The layout is a layer over the generated map (maps.js applyMapEdits,
// format pro-whooper-mapedit/1) kept per map in store 'mapEdits'; colliders and every tag the trick detector reads move
// with each piece, and the Surveyor runs again after each change. A reference image (a photo or satellite view) can be
// laid on the ground to trace real tree positions; it stays in this browser session only. Runs flown on an edited layout
// carry it in summary.layout (dropoff.js) and cannot be posted to the daily board. (Concatenated into the game module.)
const ME = { official: false, E: null, sel: new Set(), tool: 'move', place: null, vary: true, undo: [], redo: [], cam: { t: new THREE.Vector3(0, 0, 0), yaw: 0.6, pitch: 0.75, dist: 40 }, drag: null, pieces: [], byOid: new Map(), base: new Map(), testing: false, ref: null };
const meCam = new THREE.PerspectiveCamera(55, 1, 0.05, 900);
const ME_ASSETS = {
  Trees: ['Cedar', 'Big Cedar', 'Young Cedar', 'Hemlock', 'Birch', 'Split Birch', 'Maple', 'Sakura Tree'],
  Ground: ['Shrub', 'Bracken', 'Stump', 'Mossy Log', 'Boulder'],
  Park: ['Picnic Table', 'Bench', 'Bear Bin', 'Fence'],
  Play: ['Swing Set', 'Over/Under Bar', 'Gap Gate', 'Pole', 'Tire', 'Plywood Wall'],
  Street: ['House', 'Pickup'],
};
const ME_SAME = { Bar: 'Over/Under Bar', Shrubs: 'Shrub' };   // map pieces that are an asset under another name (for Duplicate)
const meEmpty = () => ({ format: 'pro-whooper-mapedit/1', map: MAP_ID, moved: {}, removed: [], added: [] });
const meHas = E => !!E && (Object.keys(E.moved || {}).length > 0 || (E.removed || []).length > 0 || (E.added || []).length > 0);
function meClean(E) {   // a layer from a file or storage: only known fields, sane numbers, known assets
  const n = (v, d, lo, hi) => Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d, out = meEmpty();
  if (!E || typeof E !== 'object') return out;
  for (const [k, m] of Object.entries(E.moved || {}).slice(0, 5000)) if (typeof k === 'string' && k.length < 80 && m && typeof m === 'object') out.moved[k] = { dx: n(m.dx, 0, -500, 500), dy: n(m.dy, 0, -50, 100), dz: n(m.dz, 0, -500, 500), ry: n(m.ry, 0, -3600, 3600), s: n(m.s, 1, 0.1, 10) };
  for (const k of (Array.isArray(E.removed) ? E.removed : []).slice(0, 5000)) if (typeof k === 'string' && k.length < 80) out.removed.push(k);
  for (const a of (Array.isArray(E.added) ? E.added : []).slice(0, 3000)) if (a && S.ASSETS.includes(a.asset)) out.added.push({ asset: a.asset, x: n(a.x, 0, -500, 500), y: n(a.y, 0, -50, 100), z: n(a.z, 0, -500, 500), ry: n(a.ry, 0, -3600, 3600), s: n(a.s, 1, 0.1, 10) });
  if (Array.isArray(E.groups)) out.groups = E.groups.slice(0, 500).filter(G => Array.isArray(G)).map(G => G.filter(i => typeof i === 'string' && i.length < 80).slice(0, 300)).filter(G => G.length > 1);
  return out;
}
function meSave() {
  if (ME.official) { const d = store.get('officialDraft', {}) || {}; d[MAP_ID] = ME.E; store.set('officialDraft', d); return; }   // the owner's draft of the official map: kept, not published
  if (!MY_MAP) return;   // an official or community map: players can't change it (ME.locked)
  MY_MAP.E = ME.E; MY_MAP.at = new Date().toISOString(); store.set('myMaps', MY_MAPS); MAP_EDITS = meHas(ME.E) ? ME.E : null; }
// ---- the pilot's own maps: named copies of an official map (game.js MY_MAPS / MY_MAP)
function meNewMap(name, E) {
  name = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) || (world.baseTitle || MAP_ID) + ' remix';
  const m = { id: 'my' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, base: MAP_ID, E: meClean(E || null), at: new Date().toISOString() };
  MY_MAPS.push(m); store.set('myMaps', MY_MAPS); MY_MAP = m; store.set('myMap', m.id); COMM_MAP = null; store.set('commMap', null);
  ME.official = false; ME.locked = false; ME.E = m.E; ME.E.map = MAP_ID; ME.sel.clear(); ME.undo = []; ME.redo = [];
  S.setOfficialEdits(MAP_ID, mePublished()); meSave(); meRebuild(false); meLibrary(); mePanels(); flash(`<b>${esc(name).toUpperCase()}</b><small>your map, based on ${esc(world.baseTitle || MAP_ID)} · in the Maps carousel</small>`);
}
function meLeaveMyMap() {   // back to the official map (the pilot's maps stay in the carousel)
  MY_MAP = null; store.set('myMap', null); COMM_MAP = null; store.set('commMap', null); MAP_EDITS = null; ME.locked = !ME.official; ME.E = meEmpty(); ME.E.map = MAP_ID; ME.sel.clear(); ME.undo = []; ME.redo = [];
  meRebuild(false); meLibrary(); mePanels();
}
// share the pilot's own map with every pilot: listed with its official map in Maps (the relay files it as
// maps/community/<base>/…; tools/dropoff-worker.mjs). The pilot's own click every time; what goes out: the map's name, the
// pilot's name and id, the official map it is built on and its layer (moves, removals, library pieces). Nothing else.
async function meShareMap() {
  if (!MY_MAP) return; const name = MY_MAP.name, by = pilotName();
  if (!lbBase()) { flash('<b>SHARING NEEDS THE ONLINE GAME</b><small>copy the map code instead</small>', 'warn'); return; }
  if (!/^[A-Za-z0-9_.,'!&()+ -]{1,40}$/.test(name)) { flash('<b>RENAME IT FIRST</b><small>map names to share: letters, numbers, spaces and . , \' ! & ( ) + -</small>', 'warn'); return; }
  if (!lbNameOk(by)) { flash('<b>PICK A PILOT NAME FIRST</b><small>Options → pilot name (letters, numbers, . _ - and spaces)</small>', 'warn'); return; }
  if (!meHas(ME.E)) { flash('<b>NOTHING TO SHARE YET</b><small>this map is still the same as ' + esc(world.baseTitle || MAP_ID) + '</small>', 'near'); return; }
  if (!confirm(`Share "${name}" with every pilot? It will be listed with ${world.baseTitle || MAP_ID} in Maps, by ${by}.`)) return;
  meSave(); procShow('Sharing your map…', `${name} · by ${by}`, 0.3);
  const payload = { format: 'pro-whooper-map/1', build: '0.1', name, by, pilot: telPilot(), base: MAP_ID, at: new Date().toISOString(), moved: ME.E.moved, removed: ME.E.removed, added: ME.E.added };
  let ok = false, why = ''; try { const r = await fetch(lbBase(), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: 'map', payload }) }); ok = r.ok; if (!ok) why = (await r.text()).slice(0, 80); } catch { why = 'the drop-off could not be reached'; }
  if (ok) { MY_MAP.shared = new Date().toISOString(); store.set('myMaps', MY_MAPS); procShow(procThanks(), `"${name}" is listed with ${world.baseTitle || MAP_ID} in Maps for every pilot (it can take a minute to appear).`, 1); }
  else procShow('Not shared', `${why || 'the drop-off said no'}. Your map is safe here; try again later, or copy the map code.`, 1);
  await new Promise(res => setTimeout(res, 2200)); procHide(); mePanels();
}
const meLockedHint = () => flash(`<b>OFFICIAL MAP</b><small>it can't be changed · make your own map from it (right panel)</small>`, 'near');
// ---- the official map (owner only: pilot name heyheykoolaid, and a GitHub token that can write to the game repo)
const mePublished = () => { const loc = (store.get('officialLocal', {}) || {})[MAP_ID], ship = window.PW_OFFICIAL && window.PW_OFFICIAL[MAP_ID]; return loc && (!ship || String(loc.at || '') > String(ship.at || '')) ? loc : ship || null; };
function meMode(official) {   // switch between the pilot's own layout and the official map
  meSave(); ME.official = !!official && ghMenus(); ME.sel.clear(); ME.undo = []; ME.redo = [];
  if (ME.official) { const draft = (store.get('officialDraft', {}) || {})[MAP_ID]; ME.E = meClean(draft || mePublished()); S.setMapEdits(MAP_ID, null); S.setOfficialEdits(MAP_ID, null); }
  else { ME.E = meClean(MY_MAP ? MY_MAP.E : COMM_MAP ? COMM_MAP.E : null); S.setMapEdits(MAP_ID, null); S.setOfficialEdits(MAP_ID, mePublished()); }
  ME.locked = !ME.official && !MY_MAP;
  ME.E.map = MAP_ID; ME.base = new Map(S.mapPieces(S.MAPS[MAP_ID].build()).map(p => [p.key, p.pivot]));   // where every piece stands under this layer
  meRebuild(false); meLibrary(); mePanels();
}
// ---- map codes: a whole layout as one short line to paste anywhere (Discord, a message), e.g. PWMAP1-moose-eNq…
// The layer (moved / removed / added) as JSON, deflated, base64url. Reading one goes through meClean like a layout file:
// only known fields and library assets, numbers clamped. A code never carries anything that runs.
const ME_CODE = /^PWMAP1-([a-z0-9_]{1,24})-([A-Za-z0-9_-]{4,200000})$/;
async function meZip(bytes, Stream) { const st = new Stream('deflate-raw'), w = st.writable.getWriter(); w.write(bytes); w.close(); const parts = [], r = st.readable.getReader(); let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(value); n += value.length; if (n > 4e6) throw new Error('too big'); } const out = new Uint8Array(n); let o = 0; for (const q of parts) { out.set(q, o); o += q.length; } return out; }
async function meCodeOf(E, name) { const j = JSON.stringify({ format: 'pro-whooper-mapedit/1', map: MAP_ID, name: name ? String(name).slice(0, 40) : undefined, moved: E.moved, removed: E.removed, added: E.added, groups: E.groups }), z = await meZip(new TextEncoder().encode(j), CompressionStream);
  let bin = ''; for (let i = 0; i < z.length; i += 0x8000) bin += String.fromCharCode.apply(null, z.subarray(i, i + 0x8000));
  return `PWMAP1-${MAP_ID}-` + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function meCodeRead(str) { const m = ME_CODE.exec(String(str || '').trim().replace(/\s+/g, '')); if (!m) return null;
  const b = atob(m[2].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((m[2].length + 3) % 4)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  const j = JSON.parse(new TextDecoder().decode(await meZip(a, DecompressionStream))); if (!j || j.format !== 'pro-whooper-mapedit/1') return null; return { map: m[1], E: j, name: typeof j.name === 'string' ? j.name.slice(0, 40) : '' }; }
async function meCopyCode() {
  if (!meHas(ME.E)) { flash('<b>NOTHING TO SHARE</b><small>this layout is the map as built</small>', 'near'); return; }
  const code = await meCodeOf(ME.E, ME.official ? null : MY_MAP && MY_MAP.name); let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch {}
  if (ok) flash(`<b>MAP CODE COPIED</b><small>${code.length} characters · paste it anywhere; others use "Paste map code" on ${esc(S.MAPS[MAP_ID].title || MAP_ID)}</small>`); else prompt('Map code (copy it):', code);
}
async function mePasteCode() {
  let txt = ''; try { txt = await navigator.clipboard.readText(); } catch {} if (!ME_CODE.test((txt || '').trim())) txt = prompt('Paste a map code (PWMAP1-…):', '') || ''; if (!txt.trim()) return;
  let got = null; try { got = await meCodeRead(txt); } catch {} if (!got) { flash('<b>NOT A MAP CODE</b><small>it starts with PWMAP1-</small>', 'near'); return; }
  if (got.map !== MAP_ID) { flash(`<b>CODE FOR ANOTHER MAP</b><small>it is for ${esc(S.MAPS[got.map] ? S.MAPS[got.map].title || got.map : got.map)}: switch map first</small>`, 'warn'); return; }
  if (!ME.official) { meNewMap(got.name || 'Shared ' + (world.baseTitle || MAP_ID), got.E); return; }   // a shared map becomes a new map of the pilot's
  if (meHas(ME.E) && !confirm('Replace your official draft with the layout in this code? (Undo brings yours back.)')) return;
  mePush(); ME.E = meClean(got.E); ME.E.map = MAP_ID; ME.sel.clear(); meCommit(); flash(`<b>MAP CODE LOADED</b><small>${Object.keys(ME.E.moved).length} moved · ${ME.E.removed.length} removed · ${ME.E.added.length} added · into the official draft</small>`);
}
// official layouts always go to the game repo (GitHub Pages builds from it), whatever repo Options names for uploads
const GAME_REPO = 'heyheykoolaid/openprowhooper';
// Publishing through the relay (tools/dropoff-worker.mjs POST /official): the owner key is a passphrase the owner set as
// the Cloudflare secret OWNER_KEY and typed once here. Kept only in this browser (store 'ownerKey'); never exported or sent
// anywhere but the relay. The relay checks it and commits maps/official/<map>.json to the game repo.
async function mePublishRelay() {
  const E = { ...ME.E, map: MAP_ID, at: new Date().toISOString(), by: pilotName() }; ME.pubMsg = 'Publishing through the drop-off…'; mePanels();
  let ok = false, why = ''; try { const r = await fetch(lbBase() + '/official', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ key: store.get('ownerKey', ''), map: MAP_ID, by: pilotName(), moved: E.moved, removed: E.removed, added: E.added }) });
    ok = r.ok; if (!ok) why = `${r.status}: ${(await r.text()).slice(0, 140)}`; } catch { why = 'the drop-off could not be reached'; }
  if (!ok && /wrong owner key|OWNER_KEY/.test(why)) store.set('ownerKey', '');   /* a key the drop-off refused is forgotten: the box comes back for the new one */
  if (!ok) { ME.pubMsg = `Not published (${why}). Your draft is kept.${/wrong owner key/.test(why) ? ' The key was forgotten here: paste the right one above and Save key.' : /too short/.test(why) ? ' Change OWNER_KEY in Cloudflare to at least 12 characters, then paste the new one above and Save key.' : /OWNER_KEY|404|405/.test(why) ? ' The drop-off needs the new code and the OWNER_KEY secret in Cloudflare.' : ''}`; mePanels(); flash(`<b>NOT PUBLISHED</b><small>${esc(why)}</small>`, 'warn'); return; }
  const loc = store.get('officialLocal', {}) || {}; loc[MAP_ID] = E; store.set('officialLocal', loc); const d = store.get('officialDraft', {}) || {}; delete d[MAP_ID]; store.set('officialDraft', d); ME.E = meClean(E); ME.E.at = E.at;
  ME.pubMsg = `Published ✓ ${new Date().toLocaleTimeString()}. GitHub Pages rebuilds the game for everyone in a few minutes; your game uses it now.`; mePanels();
}
async function mePublish() {
  if (!ME.official || !ghMenus()) return;
  if (lbBase() && store.get('ownerKey', '')) return mePublishRelay();
  if (!gh.token) { ME.pubMsg = 'No owner key in this browser yet: paste it in the box above and press Save key, then publish.'; mePanels(); flash('<b>NO GITHUB TOKEN</b><small>paste it in the Map Editor panel (or Options)</small>', 'warn'); return; }
  const E = { ...ME.E, map: MAP_ID, at: new Date().toISOString(), by: pilotName() }, path = `/contents/maps/official/${MAP_ID}.json`; ME.pubMsg = 'Publishing…'; mePanels();
  try { const cur = await ghFetch(path + '?ref=main', {}, GAME_REPO), sha = cur.ok && cur.body && cur.body.sha;
    const r = await ghFetch(path, { method: 'PUT', body: JSON.stringify({ message: `Official layout of ${MAP_ID} (${Object.keys(E.moved).length} moved, ${E.removed.length} removed, ${E.added.length} added)`, content: b64(JSON.stringify(E, null, 1)), branch: 'main', ...(sha ? { sha } : {}) }) }, GAME_REPO);
    if (!r.ok) { ME.pubMsg = `Not published (${r.status}${r.body && r.body.message ? ': ' + r.body.message : ''}). The token needs Contents: Read and write on ${GAME_REPO}. Your draft is kept; "Copy map code" gives it as one line to send instead.`; mePanels();
      flash(`<b>NOT PUBLISHED</b><small>GitHub said ${r.status}: the token in Options can't write to ${GAME_REPO}</small>`, 'warn'); return; }
    const loc = store.get('officialLocal', {}) || {}; loc[MAP_ID] = E; store.set('officialLocal', loc); const d = store.get('officialDraft', {}) || {}; delete d[MAP_ID]; store.set('officialDraft', d); ME.E = meClean(E); ME.E.at = E.at;
    ME.pubMsg = `Published ✓ ${new Date().toLocaleTimeString()}. GitHub Pages rebuilds the game for everyone in a minute or two; your game uses it now.`; }
  catch { ME.pubMsg = 'Not published: GitHub could not be reached from here. Your draft is kept.'; flash('<b>NOT PUBLISHED</b><small>GitHub could not be reached</small>', 'warn'); }
  mePanels();
}
// rebuild the world from the generated map + the layer, in place (drone, detector and the race code hold this object)
function meRebuild(merge) {
  if (ME.official) { S.setOfficialEdits(MAP_ID, meHas(ME.E) ? ME.E : null); S.setMapEdits(MAP_ID, null); } else S.setMapEdits(MAP_ID, meHas(ME.E) ? ME.E : null);
  const nw = S.MAPS[MAP_ID].build();
  for (const k of Object.keys(world)) delete world[k]; Object.assign(world, nw); world.baseTitle = world.title; if (!ME.official && MY_MAP) world.title = MY_MAP.name; else if (!ME.official && COMM_MAP) world.title = `${COMM_MAP.name} by ${COMM_MAP.by}`; drone.world = world; detector.reset();
  buildObjects(merge); ME.pieces = S.mapPieces(world); ME.byOid = new Map(); for (const p of ME.pieces) for (const id of p.ids) ME.byOid.set(id, p);
  const keep = new Set(ME.pieces.map(meId)); for (const id of [...ME.sel]) if (!keep.has(id)) ME.sel.delete(id); meSelBox();
}
const meId = p => p.addIdx != null ? 'add:' + p.addIdx : p.key;
const mePiece = id => ME.pieces.find(p => meId(p) === id);
function mePivot(p) {   // where a piece turns and scales about: an added asset's spot, or where a map piece stood plus its move
  if (p.addIdx != null) { const a = ME.E.added[p.addIdx]; return new THREE.Vector3(a.x, a.y || 0, a.z); }
  const b = ME.base.get(p.key), m = ME.E.moved[p.key] || { dx: 0, dy: 0, dz: 0 }, o = b || p.pivot; return new THREE.Vector3(o.x + m.dx, o.y + m.dy, o.z + m.dz);
}
function meXf(p) { if (p.addIdx != null) { const a = ME.E.added[p.addIdx]; return { ry: a.ry || 0, s: a.s || 1 }; } const m = ME.E.moved[p.key]; return { ry: m ? m.ry : 0, s: m ? m.s : 1 }; }
// change a piece by a move d, a turn dr (degrees) and a scale ds, all about its pivot
function meApply(p, d, dr, ds) {
  if (p.addIdx != null) { const a = ME.E.added[p.addIdx]; a.x = +(a.x + d.x).toFixed(3); a.y = +Math.max(0, (a.y || 0) + d.y).toFixed(3); a.z = +(a.z + d.z).toFixed(3); a.ry = +(((a.ry || 0) + dr) % 360).toFixed(2); a.s = +Math.max(0.1, Math.min(10, (a.s || 1) * ds)).toFixed(3); return; }
  const m = ME.E.moved[p.key] || (ME.E.moved[p.key] = { dx: 0, dy: 0, dz: 0, ry: 0, s: 1 });
  m.dx = +(m.dx + d.x).toFixed(3); m.dy = +(m.dy + d.y).toFixed(3); m.dz = +(m.dz + d.z).toFixed(3); m.ry = +((m.ry + dr) % 360).toFixed(2); m.s = +Math.max(0.1, Math.min(10, m.s * ds)).toFixed(3);
  if (!m.dx && !m.dy && !m.dz && !m.ry && m.s === 1) delete ME.E.moved[p.key];
}
function mePush() { ME.undo.push(JSON.stringify(ME.E)); if (ME.undo.length > 150) ME.undo.shift(); ME.redo = []; }
function meCommit() { meSave(); meRebuild(false); mePanels(); }
function meUndo() { if (!ME.undo.length) return; ME.redo.push(JSON.stringify(ME.E)); ME.E = JSON.parse(ME.undo.pop()); meCommit(); }
function meRedo() { if (!ME.redo.length) return; ME.undo.push(JSON.stringify(ME.E)); ME.E = JSON.parse(ME.redo.pop()); meCommit(); }

function openMapEditor() {
  ME.E = meClean(MY_MAP ? MY_MAP.E : COMM_MAP ? COMM_MAP.E : null); ME.E.map = MAP_ID; ME.sel.clear(); ME.place = null; ME.undo = []; ME.redo = []; ME.testing = false; ME.locked = !MY_MAP;
  ME.official = false; S.setMapEdits(MAP_ID, null); ME.base = new Map(S.mapPieces(S.MAPS[MAP_ID].build()).map(p => [p.key, p.pivot]));   // where every piece stands under the official layout
  mode = 'mapedit'; drone.armed = false; show(null); $('#hud').classList.add('hide'); $('#mapEditUI').classList.remove('hide'); document.body.classList.add('bbr', 'meOn');
  const B = world.bounds || { x: [-40, 40], z: [-40, 40] }; ME.cam.t.set((B.x[0] + B.x[1]) / 2 * 0.5, 0, (B.z[0] + B.z[1]) / 2 * 0.5); ME.cam.dist = Math.min(110, Math.max(45, (B.x[1] - B.x[0]) * 0.55)); ME.cam.pitch = 1.05; /* start on a high overview */ meRebuild(false); meLibrary(); mePanels(); meHint();
}
function closeMapEditor(to) {
  ME.drag = null; ME.place = null; meSave();
  if (to !== 'fly' && ME.official) { ME.official = false; S.setOfficialEdits(MAP_ID, mePublished()); ME.E = meClean(MY_MAP ? MY_MAP.E : COMM_MAP ? COMM_MAP.E : null); ME.locked = !MY_MAP; }
  meRebuild(true); $('#mapEditUI').classList.add('hide'); document.body.classList.remove('bbr', 'meOn'); if (ME.box) { scene.remove(ME.box); ME.box = null; }
  if (ME.ref) ME.ref.mesh.visible = false; drone.reset(world.spawn);
  if (to === 'fly') { ME.testing = true; startFly(false); } else { ME.testing = false; mode = 'menu'; show('#mainMenu'); }
}
// ---- the screen
function meLibrary() {   // the hand-made assets, then every map's pieces (S.assetCatalog), filtered by the search box
  $('#meLib').innerHTML = `<h3>ASSETS</h3><input id="meQ" type="search" placeholder="search ${S.ASSETS.length} assets…" value="${esc(ME.q || '')}" autocomplete="off">
    <label class="chk" title="Each one placed gets a random turn and a size from 85 to 115% (trees look planted, not stamped)"><input type="checkbox" id="meVary" ${ME.vary ? 'checked' : ''}> vary turn &amp; size</label>
    <div id="meLibList"></div><p class="note">Click an asset, then click the ground to place it. Hold Shift to keep placing. Esc stops.</p>`;
  meLibList();
}
function meLibList() {
  const q = (ME.q || '').trim().toLowerCase(), cat = S.assetCatalog(), groups = [...Object.entries(ME_ASSETS), ...Object.entries(cat).map(([m, l]) => ['From ' + (S.MAPS[m] ? S.MAPS[m].title : m), l])];
  const html = groups.map(([g, list]) => { const L = list.filter(a => !q || a.toLowerCase().includes(q) || g.toLowerCase().includes(q)); return L.length ? `<h4>${esc(g)}</h4><div class="meGrid">${L.map(a => `<button data-measset="${esc(a)}" class="meTile ${ME.place === a ? 'on' : ''}" title="${esc(a)}"><img data-thumb="${esc(a)}" alt="" ${THUMB.cache.has(a) ? `src="${THUMB.cache.get(a)}"` : ''}><span>${esc(a)}</span></button>`).join('')}</div>` : ''; }).join('');
  const el = $('#meLibList'); if (!el) return; el.innerHTML = html || '<p class="note">Nothing matches.</p>';
  if (!THUMB.io) THUMB.io = new IntersectionObserver(es => { for (const x of es) if (x.isIntersecting) { const n = x.target.dataset.thumb; THUMB.io.unobserve(x.target); if (!THUMB.cache.has(n)) THUMB.queue.push(x.target); } if (THUMB.queue.length) meThumbPump(); }, { root: $('#meLib'), rootMargin: '200px' });
  for (const im of el.querySelectorAll('img[data-thumb]')) if (!im.getAttribute('src')) THUMB.io.observe(im);
}
// ---- asset thumbnails: each asset built on its own (S.assetObjs), drawn once by a small second renderer, kept as an image
const THUMB = { r: null, scene: null, cam: null, cache: new Map(), queue: [], busy: false, io: null };
function meThumb(name) {
  if (THUMB.cache.has(name)) return THUMB.cache.get(name);
  if (!THUMB.r) { THUMB.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); THUMB.r.setPixelRatio(1); THUMB.r.setSize(128, 96); THUMB.r.outputColorSpace = renderer.outputColorSpace; THUMB.r.toneMapping = renderer.toneMapping;
    THUMB.scene = new THREE.Scene(); THUMB.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a3428, 2.4)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); THUMB.scene.add(sun); THUMB.cam = new THREE.PerspectiveCamera(32, 4 / 3, 0.05, 900); }
  const g = new THREE.Group(); let url = '';
  try { for (const o of S.assetObjs(name)) for (const v of o.vis) { const m = visMesh(v, false); if (m) g.add(m); }
    THUMB.scene.add(g); const bb = new THREE.Box3().setFromObject(g); if (!bb.isEmpty()) { const c = bb.getCenter(new THREE.Vector3()), r = Math.max(0.3, bb.getSize(new THREE.Vector3()).length() / 2);
      THUMB.cam.position.copy(c).add(new THREE.Vector3(1, 0.75, 1.2).normalize().multiplyScalar(r / Math.sin(16 * Math.PI / 180) * 0.95)); THUMB.cam.lookAt(c); THUMB.cam.updateProjectionMatrix();
      THUMB.r.render(THUMB.scene, THUMB.cam); url = THUMB.r.domElement.toDataURL('image/png'); } } catch { url = ''; }
  THUMB.scene.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); THUMB.cache.set(name, url); return url;
}
function meThumbPump() {   // a few thumbnails a frame, so the editor never stutters
  if (THUMB.busy) return; THUMB.busy = true;
  const step = () => { const t0 = performance.now(); while (THUMB.queue.length && performance.now() - t0 < 12) { const im = THUMB.queue.shift(), u = meThumb(im.dataset.thumb); if (u) im.src = u; }
    if (THUMB.queue.length && mode === 'mapedit') requestAnimationFrame(step); else THUMB.busy = false; };
  requestAnimationFrame(step);
}
function mePanels() {
  const el = $('#meSide'), ps = [...ME.sel].map(mePiece).filter(Boolean), E = ME.E, nMoved = Object.keys(E.moved).length;
  let selH = '<p class="note">Click a piece to pick it (Shift-click for more). Drag to move; Alt-drag to raise.</p>';
  if (ps.length === 1) { const p = ps[0], pv = mePivot(p), xf = meXf(p), f = (k, v, st) => `<label>${k}<input type="number" step="${st}" data-mefield="${k}" value="${(+v).toFixed(st < 1 ? 2 : 0)}"></label>`;
    selH = `<h4>${esc(p.name)}${p.addIdx != null ? ' <small>(added)</small>' : E.moved[p.key] ? ' <small>(moved)</small>' : ''}</h4><div class="meFields">${f('x', pv.x, 0.1)}${f('z', pv.z, 0.1)}${f('height', pv.y, 0.1)}${f('turn °', xf.ry, 1)}${f('scale', xf.s, 0.05)}</div>
      <div class="row"><button data-me="dup" title="D">Duplicate</button><button data-me="del" title="Delete">Remove</button>${p.addIdx == null && E.moved[p.key] ? '<button data-me="reset1">Put back</button>' : ''}</div>`; }
  else if (ps.length > 1) selH = `<h4>${ps.length} pieces picked</h4><div class="row"><button data-me="del">Remove all</button></div>`;
  const R = ME.ref;
  const own = ghMenus(), pub = mePublished();
  const modeH = own ? `<div class="row meMode"><button data-me="mode-own" class="${ME.official ? '' : 'on'}">Your maps</button><button data-me="mode-off" class="${ME.official ? 'on' : ''}">Official map</button></div>
    ${ME.official ? `<p class="note"><b>Editing the official ${esc(world.title || MAP_ID)}</b>: what every pilot flies. Your changes are a draft until you publish.${pub && pub.at ? ` Last published ${esc(new Date(pub.at).toLocaleString())}.` : ' Not published yet.'}</p>
      ${lbBase() && store.get('ownerKey', '') ? `<p class="note">Owner key: saved in this browser ✓ (publishes through the drop-off)</p><div class="row"><input id="meOwnerKey" type="password" autocomplete="off" placeholder="new owner key (replaces it)"><button data-me="savekey">Save key</button><button data-me="forgetkey" class="ghost">Forget key</button></div>` : gh.token && !lbBase() ? `<p class="note">GitHub token: saved in this browser ✓ (publishes to ${GAME_REPO})</p>`
        : `<div class="meLocked"><p><b>Owner key needed to publish.</b> The passphrase you set as <code>OWNER_KEY</code> on the drop-off in Cloudflare. It is kept only in this browser.</p><input id="meOwnerKey" type="password" autocomplete="off" placeholder="owner key"><div class="row"><button data-me="savekey">Save key</button></div>
          ${gh.token ? '<p class="note">(A GitHub token is saved too: it is used only if there is no owner key.)</p>' : ''}</div>`}
      <div class="row"><button data-me="publish" class="primary">Publish for everyone</button><button data-me="discard" class="ghost">Discard draft</button></div>${ME.pubMsg ? `<p class="note">${esc(ME.pubMsg)}</p>` : ''}` : ''}` : '';
  const baseT = esc(world.baseTitle || MAP_ID), mine = MY_MAPS.filter(m => m.base === MAP_ID && m !== MY_MAP);
  const ownH = ME.official ? '' : ME.locked ? `<div class="meLocked"><p>${COMM_MAP ? `<b>${esc(COMM_MAP.name)}</b> is ${esc(COMM_MAP.by)}'s map, built on ${baseT}. It can't be changed here, but you can make your own map from it (it starts as a copy).` : `<b>${baseT} is an official map.</b> Players can't change it. Make your own map from it: it is listed with ${baseT} in Maps, and the original stays as it is.`}</p>
      <label>Name <input id="meNewName" maxlength="40" value="${esc(COMM_MAP ? COMM_MAP.name : world.baseTitle || MAP_ID)} remix"></label><div class="row"><button data-me="newmap" class="primary">Make my own map</button><button data-me="pastecode">Paste a map code</button></div>
      ${mine.length ? `<p class="note">Your maps from ${baseT}: ${mine.map(m => `<b>${esc(m.name)}</b>`).join(', ')}. Pick one in Maps (main menu) to fly or edit it.</p>` : ''}</div>`
    : `<p class="note"><b>${esc(MY_MAP.name)}</b> · your map, based on ${baseT}. Saved as you go, in this browser.</p><div class="row"><button data-me="sharemap" class="primary" title="List it with ${baseT} in Maps for every pilot, with your pilot name">${MY_MAP.shared ? 'Share the update' : 'Share with the community'}</button><button data-me="renamemap">Rename</button></div><div class="row"><button data-me="delmap" class="ghost">Delete map</button><button data-me="officialmap" class="ghost">Back to the official map</button></div>${MY_MAP.shared ? `<p class="note">Shared ${esc(new Date(MY_MAP.shared).toLocaleString())}. Changes since then stay yours until you share the update.</p>` : ''}`;
  el.innerHTML = `<h3>MAP EDITOR <small>${esc(world.title || MAP_ID)}</small></h3>${modeH}${ownH}${ME.locked ? '' : selH}
    <h4>Layout</h4><p class="note">${nMoved} moved · ${E.removed.length} removed · ${E.added.length} added${world.edits && world.edits.lost ? ` · <span class="bad">${world.edits.lost} no longer match the map</span>` : ''}. ${ME.official ? 'A draft, kept in this browser until you publish.' : ME.locked ? 'The official layout.' : 'Saved as you go, in this browser.'}</p>
    <div class="row"><button data-me="copycode" title="The whole layout as one line of text to paste anywhere">Copy map code</button><button data-me="pastecode" title="Load a layout someone shared as a map code">Paste map code</button></div>
    <div class="row"><button data-me="export">Export</button><button data-me="import">Import…</button><button data-me="resetall" class="ghost">Reset map</button></div>
    <h4>Reference image</h4><p class="note">Lay a photo or satellite view on the ground and place trees over it. It stays on this computer and goes away when you leave.</p>
    <div class="row"><button data-me="refload">${R ? 'Change image…' : 'Load image…'}</button>${R ? `<label class="chk"><input type="checkbox" id="meRefOn" ${R.mesh.visible ? 'checked' : ''}> show</label>` : ''}</div>
    ${R ? `<div class="meFields">${[['width m', R.w, 1], ['x', R.x, 0.5], ['z', R.z, 0.5], ['turn °', R.r, 1], ['opacity', R.o, 0.05]].map(([k, v, st]) => `<label>${k}<input type="number" step="${st}" data-meref="${k}" value="${v}"></label>`).join('')}</div>` : ''}
    <div class="row meEnd"><button data-me="fly" class="primary" title="Fly your layout (the pause menu brings you back)">Test fly</button><button data-me="done">Done</button></div>
    <input type="file" id="meFile" accept=".json,application/json" class="hide"><input type="file" id="meRefFile" accept="image/*" class="hide">`;
  meToolbar();
}
function meToolbar() {
  $('#meBar').innerHTML = [['move', 'Move (G)'], ['rotate', 'Turn (R)'], ['scale', 'Scale (S)']].map(([t, l]) => `<button data-metool="${t}" class="${ME.tool === t && !ME.place ? 'on' : ''}">${l}</button>`).join('')
    + `<span class="sep"></span><button data-me="undo" ${ME.undo.length ? '' : 'disabled'} title="Ctrl+Z">↶ Undo</button><button data-me="redo" ${ME.redo.length ? '' : 'disabled'} title="Ctrl+Y">↷ Redo</button>`
    + `<span class="sep"></span><button data-me="copy" title="Ctrl+C">Copy</button><button data-me="paste" title="Ctrl+V: at the mouse">Paste</button><button data-me="dup" title="D or Ctrl+D">Duplicate</button><button data-me="group" title="Ctrl+G">Group</button><button data-me="ungroup" title="Ctrl+Shift+G">Ungroup</button><button data-me="del" title="Delete">Delete</button>`
    + `<span class="sep"></span><button data-me="top" title="T">Top view</button>`
    + (ME.place ? `<span class="mePlacing">placing <b>${esc(ME.place)}</b> · click the ground · Esc stops</span>` : '');
}
function meHint() { $('#meHint').textContent = 'Drag the handles: arrows move, ring turns, cube scales (Shift snaps) · Shift/Ctrl-click: pick more · Alt-click: one piece of a group · Ctrl+C / V copy, paste · D duplicate · Ctrl+G group · Del · Right-drag orbit · Middle-drag pan · Wheel zoom · WASD · F focus · Ctrl+Z / Y'; }
function meSelBox() {
  if (ME.box) { scene.remove(ME.box); ME.box = null; } if (!ME.sel.size || !objRoot) return;
  const ids = new Set([...ME.sel].map(mePiece).filter(Boolean).flatMap(p => p.ids)), bb = new THREE.Box3(); objRoot.traverse(o => { if (o.isMesh && ids.has(o.userData.oid)) bb.expandByObject(o); });
  if (bb.isEmpty()) return; ME.box = new THREE.Box3Helper(bb, 0xffd34d); ME.box.renderOrder = 30; ME.box.material.depthTest = false; scene.add(ME.box);
}
// ---- camera and picking
function meCamera() {
  const c = ME.cam, cp = Math.cos(c.pitch); meCam.position.set(c.t.x + Math.sin(c.yaw) * cp * c.dist, c.t.y + Math.sin(c.pitch) * c.dist, c.t.z + Math.cos(c.yaw) * cp * c.dist); meCam.lookAt(c.t);
  meCam.aspect = innerWidth / innerHeight; meCam.updateProjectionMatrix(); return meCam;
}
const meRay = new THREE.Raycaster(), meMouse = new THREE.Vector2();
function meCast(e) { const r = canvas.getBoundingClientRect(); meMouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); meRay.setFromCamera(meMouse, meCam); return meRay; }
function mePick(e) { const hits = meCast(e).intersectObjects(objRoot ? objRoot.children : [], false); for (const h of hits) { const p = ME.byOid.get(h.object.userData.oid); if (p) return p; } return null; }
function meFloor(e, y = 0) { const p = new THREE.Vector3(); return meCast(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null; }
function mapEditFrame(dt) {
  const k = ME.keys || {}, sp = ME.cam.dist * 0.9 * dt, c = Math.cos(ME.cam.yaw), s = Math.sin(ME.cam.yaw);
  if (k.KeyW) { ME.cam.t.x -= s * sp; ME.cam.t.z -= c * sp; } if (k.KeyS && !ME.sel.size) { ME.cam.t.x += s * sp; ME.cam.t.z += c * sp; }
  if (k.KeyA) { ME.cam.t.x -= c * sp; ME.cam.t.z += s * sp; } if (k.KeyD && !ME.sel.size) { ME.cam.t.x += c * sp; ME.cam.t.z -= s * sp; }
  const cam = meCamera(); meGizUpdate(cam); droneMesh.visible = false; renderer.render(scene, cam); droneMesh.visible = true;
  frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
}
// ---- live preview while dragging: each picked piece's meshes are transformed about its pivot, the map is rebuilt on release
function mePreview(d, dr, ds) {
  const D = ME.drag; for (const it of D.items) { const M = new THREE.Matrix4().makeTranslation(it.pv.x + d.x, it.pv.y + d.y, it.pv.z + d.z)
    .multiply(new THREE.Matrix4().makeRotationY(dr * Math.PI / 180)).multiply(new THREE.Matrix4().makeScale(ds, ds, ds)).multiply(new THREE.Matrix4().makeTranslation(-it.pv.x, -it.pv.y, -it.pv.z));
    for (const m of it.meshes) { m.matrixAutoUpdate = false; m.matrix.multiplyMatrices(M, m.userData.m0); m.matrixWorldNeedsUpdate = true; } }
  if (ME.box) ME.box.visible = false;
}
// ---- handles on the selection (like the RaceGOW editor): arrows move along X / Y / Z, the ring turns it on the ground (a
// layout turns pieces about the vertical only), the cube scales it. Constant size on screen; shown for the current tool.
const MG = { grp: new THREE.Group(), move: new THREE.Group(), rot: new THREE.Group(), scl: new THREE.Group() };
(() => { const col = { x: 0xff4b4b, y: 0x5fd35f, z: 0x4b8bff }, mat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95 }), AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  for (const ax of ['x', 'y', 'z']) { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), AX[ax]);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), mat(col[ax])); sh.position.copy(AX[ax]).multiplyScalar(0.5); sh.quaternion.copy(q);
    const hd = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 12), mat(col[ax])); hd.position.copy(AX[ax]).multiplyScalar(1.0); hd.quaternion.copy(q);
    const a = new THREE.Group(); a.add(sh, hd); a.userData.giz = { mode: 'move', axis: ax, dir: AX[ax] }; MG.move.add(a); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.045, 8, 56), mat(col.y)); ring.rotation.x = Math.PI / 2; ring.userData.giz = { mode: 'rotate', axis: 'y' }; MG.rot.add(ring);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(0xffd34d)); cube.position.set(0, 0.9, 0); cube.userData.giz = { mode: 'scale' }; MG.scl.add(cube);
  MG.grp.add(MG.move, MG.rot, MG.scl); MG.grp.traverse(o => { o.renderOrder = 40; }); MG.grp.visible = false; scene.add(MG.grp); })();
function meGizPivot() { const ps = [...ME.sel].map(mePiece).filter(Boolean); if (!ps.length) return null; const c = new THREE.Vector3(); for (const p of ps) c.add(mePivot(p)); return c.multiplyScalar(1 / ps.length); }
function meGizUpdate(cam) {
  const pv = mode === 'mapedit' && !ME.locked && !ME.place && ME.sel.size ? meGizPivot() : null; MG.grp.visible = !!pv; if (!pv) return;
  const D = ME.drag; if (D && D.items) pv.add(D.d);
  MG.grp.position.copy(pv); MG.grp.scale.setScalar(cam.position.distanceTo(pv) * 0.12);
  MG.move.visible = ME.tool === 'move'; MG.rot.visible = ME.tool === 'rotate'; MG.scl.visible = ME.tool === 'scale';
}
function meGizPick(e) { if (!MG.grp.visible) return null; MG.grp.updateMatrixWorld(true); const hits = meCast(e).intersectObjects(MG.grp.children, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.giz) o = o.parent; if (o && o.parent && o.parent.visible) return o.userData.giz; } return null; }
function meStartDrag(e, kind) {
  const items = [...ME.sel].map(mePiece).filter(Boolean).map(p => { const ids = new Set(p.ids), meshes = []; objRoot.traverse(o => { if ((o.isMesh || o.isLight) && ids.has(o.userData.oid)) { o.updateMatrix(); o.userData.m0 = o.matrix.clone(); meshes.push(o); } }); return { p, pv: mePivot(p), meshes }; });
  if (!items.length) return; const y0 = items[0].pv.y; ME.drag = { kind, x: e.clientX, y: e.clientY, items, y0, f0: meFloor(e, y0), d: new THREE.Vector3(), dr: 0, ds: 1, moved: false, alt: e.altKey };
}
canvas.addEventListener('mousedown', e => {
  if (mode !== 'mapedit') return; e.preventDefault();
  if (e.button === 2 || e.button === 1) { ME.drag = { kind: e.button === 1 || e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY }; return; }
  if (e.button !== 0) return;
  if (ME.locked) { meLockedHint(); return; }
  if (ME.place) { const f = meFloor(e); if (!f) return; mePush(); const v = ME.vary;
    ME.E.added.push({ asset: ME.place, x: +f.x.toFixed(2), y: 0, z: +f.z.toFixed(2), ry: v ? Math.round(Math.random() * 360) : Math.round(((ME.cam.yaw * 180 / Math.PI) % 360 + 360) % 360), s: v ? +(0.85 + Math.random() * 0.3).toFixed(2) : 1 });
    if (!e.shiftKey) { ME.place = null; meLibrary(); } meCommit(); ME.sel = new Set(['add:' + (ME.E.added.length - 1)]); meSelBox(); mePanels(); return; }
  const gz = meGizPick(e);
  if (gz) { meStartDrag(e, gz.mode); const D = ME.drag; if (!D) return; D.giz = gz; const r = canvas.getBoundingClientRect(), px = v => { const q = v.clone().project(meCam); return new THREE.Vector2((q.x + 1) / 2 * r.width + r.left, (1 - q.y) / 2 * r.height + r.top); };
    const pv = meGizPivot(), p0 = px(pv); D.sc = p0; D.a0 = Math.atan2(e.clientY - p0.y, e.clientX - p0.x); if (gz.dir) D.sdir = px(pv.clone().add(gz.dir)).sub(p0); D.toward = meCam.position.y >= pv.y ? 1 : -1; return; }
  const p = mePick(e), multi = e.shiftKey || e.ctrlKey || e.metaKey;
  if (!p) { if (!multi) { ME.sel.clear(); meSelBox(); mePanels(); } return; }
  const ids = e.altKey ? [meId(p)] : meGroupOf(meId(p));   /* a click picks the whole group (Alt: just this piece) */
  if (multi) { const on = ids.every(i => ME.sel.has(i)); for (const i of ids) { if (on) ME.sel.delete(i); else ME.sel.add(i); } meSelBox(); mePanels(); return; }
  if (!ME.sel.has(meId(p))) { ME.sel = new Set(ids); meSelBox(); mePanels(); }
  meStartDrag(e, ME.tool);
});
addEventListener('mousemove', e => {
  if (mode === 'mapedit' && e.target === canvas) ME.mouseFloor = meFloor(e);
  if (mode !== 'mapedit' || !ME.drag) return; const D = ME.drag, dx = e.clientX - D.x, dy = e.clientY - D.y;
  if (D.kind === 'orbit') { ME.cam.yaw -= dx * 0.008; ME.cam.pitch = Math.max(0.08, Math.min(1.56, ME.cam.pitch + dy * 0.006)); D.x = e.clientX; D.y = e.clientY; return; }
  if (D.kind === 'pan') { const k = ME.cam.dist * 0.0016, c = Math.cos(ME.cam.yaw), s = Math.sin(ME.cam.yaw); ME.cam.t.x += (-dx * c - dy * s) * k; ME.cam.t.z += (dx * s - dy * c) * k; D.x = e.clientX; D.y = e.clientY; return; }
  if (Math.abs(dx) + Math.abs(dy) > 3) D.moved = true; if (!D.moved) return;
  if (D.giz) { const g = D.giz;
    if (g.mode === 'move') { const L2 = D.sdir.lengthSq() || 1; let m = Math.sqrt(L2) < 30 ? (g.dir.y ? -dy : dx) * ME.cam.dist * 0.0015 : (dx * D.sdir.x + dy * D.sdir.y) / L2;   /* an arrow seen end-on: a steady drag speed */ m = e.shiftKey ? Math.round(m * 2) / 2 : +m.toFixed(2);
      D.d.set(g.dir.x * m, Math.max(-D.y0, g.dir.y * m), g.dir.z * m); }
    if (g.mode === 'rotate') { let a = (Math.atan2(e.clientY - D.sc.y, e.clientX - D.sc.x) - D.a0) * 180 / Math.PI; while (a > 180) a -= 360; while (a < -180) a += 360; a = D.toward >= 0 ? -a : a; if (e.shiftKey) a = Math.round(a / 15) * 15; D.dr = Math.round(a); }
    if (g.mode === 'scale') D.ds = +Math.max(0.2, Math.min(5, Math.exp(-dy * 0.006))).toFixed(3);
    mePreview(D.d, D.dr, D.ds); return; }
  if (D.kind === 'move') { if (D.alt) D.d.set(0, Math.max(-D.y0, +(-dy * ME.cam.dist * 0.0015).toFixed(2)), 0); else { const f = meFloor(e, D.y0); if (f && D.f0) D.d.set(+(f.x - D.f0.x).toFixed(2), 0, +(f.z - D.f0.z).toFixed(2)); } }
  if (D.kind === 'rotate') { let a = dx * 0.5; if (e.shiftKey) a = Math.round(a / 15) * 15; D.dr = Math.round(a); }
  if (D.kind === 'scale') D.ds = +Math.max(0.2, Math.min(5, Math.exp(-dy * 0.006))).toFixed(3);
  mePreview(D.d, D.dr, D.ds);
});
addEventListener('mouseup', () => { if (mode !== 'mapedit' || !ME.drag) return; const D = ME.drag; ME.drag = null;
  if (D.items && D.moved) { mePush(); for (const it of D.items) meApply(it.p, D.d, D.dr, D.ds); meCommit(); } });
canvas.addEventListener('wheel', e => { if (mode !== 'mapedit') return; e.preventDefault(); ME.cam.dist = Math.max(2, Math.min(250, ME.cam.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
canvas.addEventListener('contextmenu', e => { if (mode === 'mapedit') e.preventDefault(); });
function meNudge(dr, ds) { const ps = [...ME.sel].map(mePiece).filter(Boolean); if (!ps.length) return; mePush(); for (const p of ps) meApply(p, new THREE.Vector3(), dr, ds); meCommit(); }
function meDelete() { const ps = [...ME.sel].map(mePiece).filter(Boolean); if (!ps.length) return; mePush();
  const adds = ps.filter(p => p.addIdx != null).map(p => p.addIdx).sort((a, b) => b - a); for (const i of adds) ME.E.added.splice(i, 1);
  if (ME.E.groups) { const gone = new Set(ps.map(meId)), shift = id => { const m = /^add:(\d+)$/.exec(id); if (!m) return id; const n = +m[1]; return 'add:' + (n - adds.filter(i => i < n).length); };
    ME.E.groups = ME.E.groups.map(G => G.filter(i => !gone.has(i)).map(shift)).filter(G => G.length > 1); }
  for (const p of ps) if (p.addIdx == null) { delete ME.E.moved[p.key]; if (!ME.E.removed.includes(p.key)) ME.E.removed.push(p.key); }
  ME.sel.clear(); meCommit(); }
function meDuplicate() { const ps = [...ME.sel].map(mePiece).filter(Boolean), made = [];
  for (const p of ps) { const asset = p.addIdx != null ? ME.E.added[p.addIdx].asset : S.ASSETS.includes(p.name) ? p.name : ME_SAME[p.name]; if (!asset) continue; const pv = mePivot(p), xf = meXf(p);
    if (!made.length) mePush(); ME.E.added.push({ asset, x: +(pv.x + 1.5).toFixed(2), y: +pv.y.toFixed(2), z: +(pv.z + 1.5).toFixed(2), ry: xf.ry, s: xf.s }); made.push('add:' + (ME.E.added.length - 1)); }
  if (!made.length) { flash('<b>CAN\'T DUPLICATE THAT</b><small>only things that are in the asset library</small>', 'near'); return; } meCommit(); ME.sel = new Set(made); meSelBox(); mePanels(); }
// ---- groups (Ctrl+G / Ctrl+Shift+G): sets of pieces picked together, kept in the layer (E.groups: [[id…]]; ids are
// "Name@x,z" keys or "add:<n>"); copy (Ctrl+C) and paste (Ctrl+V, at the mouse, or beside the copies)
function meGroupOf(id) { const g = (ME.E.groups || []).find(G => G.includes(id)); return g ? g.filter(i => mePiece(i)) : [id]; }
function meGroup() { const ids = [...ME.sel]; if (ids.length < 2) { flash('<b>PICK 2 OR MORE</b><small>Shift- or Ctrl-click pieces, then Group</small>', 'near'); return; } mePush();
  ME.E.groups = (ME.E.groups || []).map(G => G.filter(i => !ids.includes(i))).filter(G => G.length > 1); ME.E.groups.push(ids); meCommit(); flash(`<b>GROUPED</b><small>${ids.length} pieces now pick and move together</small>`); }
function meUngroup() { const ids = [...ME.sel]; const before = (ME.E.groups || []).length; if (!before) return; mePush(); ME.E.groups = ME.E.groups.filter(G => !G.some(i => ids.includes(i))); meCommit(); if (ME.E.groups.length < before) flash('<b>UNGROUPED</b>'); }
function meCopy() { const ps = [...ME.sel].map(mePiece).filter(Boolean), items = [];
  for (const p of ps) { const asset = p.addIdx != null ? ME.E.added[p.addIdx].asset : S.ASSETS.includes(p.name) ? p.name : ME_SAME[p.name]; if (!asset) continue; const pv = mePivot(p), xf = meXf(p); items.push({ asset, x: pv.x, y: pv.y, z: pv.z, ry: xf.ry, s: xf.s }); }
  if (!items.length) { flash('<b>NOTHING TO COPY</b><small>pick pieces that are in the asset library</small>', 'near'); return; }
  const c = items.reduce((a, it) => a.add(new THREE.Vector3(it.x, 0, it.z)), new THREE.Vector3()).multiplyScalar(1 / items.length); ME.clip = { items: items.map(it => ({ ...it, x: it.x - c.x, z: it.z - c.z })), at: c, n: 0, grouped: items.length > 1 };
  flash(`<b>COPIED</b><small>${items.length} piece${items.length > 1 ? 's' : ''} · Ctrl+V pastes at the mouse</small>`); }
function mePaste() { const C = ME.clip; if (!C) { flash('<b>NOTHING COPIED YET</b><small>pick pieces and press Ctrl+C</small>', 'near'); return; }
  C.n++; const at = ME.mouseFloor ? ME.mouseFloor.clone() : C.at.clone().add(new THREE.Vector3(2 * C.n, 0, 2 * C.n)); mePush(); const made = [];
  for (const it of C.items) { ME.E.added.push({ asset: it.asset, x: +(at.x + it.x).toFixed(2), y: +it.y.toFixed(2), z: +(at.z + it.z).toFixed(2), ry: it.ry, s: it.s }); made.push('add:' + (ME.E.added.length - 1)); }
  if (C.grouped) { ME.E.groups = ME.E.groups || []; ME.E.groups.push(made.slice()); } meCommit(); ME.sel = new Set(made); meSelBox(); mePanels(); }
function meFocus() { const ps = [...ME.sel].map(mePiece).filter(Boolean); if (!ps.length) return; const c = new THREE.Vector3(); for (const p of ps) c.add(mePivot(p)); c.multiplyScalar(1 / ps.length); ME.cam.t.copy(c); ME.cam.dist = Math.min(ME.cam.dist, 18); }
addEventListener('keydown', e => {
  if (mode !== 'mapedit' || (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) return; ME.keys = ME.keys || {};
  if (/^Key[WASD]$/.test(e.code)) ME.keys[e.code] = true;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ME.locked && !/^Key[WASDFT]$/.test(e.code) && e.code !== 'Escape' && !/^(Shift|Alt|Control|Meta)/.test(e.code)) return;   // an official map: the view moves, nothing else
  if (ctrl && e.code === 'KeyC') { e.preventDefault(); meCopy(); return; }
  if (ctrl && e.code === 'KeyV') { e.preventDefault(); mePaste(); return; }
  if (ctrl && e.code === 'KeyD') { e.preventDefault(); meDuplicate(); return; }
  if (ctrl && e.code === 'KeyG') { e.preventDefault(); if (e.shiftKey) meUngroup(); else meGroup(); return; }
  if (ctrl && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) meRedo(); else meUndo(); return; } if (ctrl && e.code === 'KeyY') { e.preventDefault(); meRedo(); return; }
  if (e.code === 'Escape') { if (ME.place) { ME.place = null; meLibrary(); meToolbar(); } else if (ME.sel.size) { ME.sel.clear(); meSelBox(); mePanels(); } else closeMapEditor(); return; }   // Esc backs out one step at a time: placing, then the selection, then the editor
  if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); meDelete(); return; }
  if (e.code === 'KeyG') { ME.tool = 'move'; meToolbar(); } if (e.code === 'KeyR') { ME.tool = 'rotate'; meToolbar(); } if (e.code === 'KeyS' && ME.sel.size) { ME.tool = 'scale'; meToolbar(); }
  if (e.code === 'KeyD' && ME.sel.size && !ctrl) meDuplicate(); if (e.code === 'KeyF') meFocus(); if (e.code === 'KeyT') ME.cam.pitch = 1.55;
  if (e.code === 'KeyQ') meNudge(15, 1); if (e.code === 'KeyE') meNudge(-15, 1); if (e.code === 'BracketLeft') meNudge(0, 1 / 1.1); if (e.code === 'BracketRight') meNudge(0, 1.1);
});
addEventListener('keyup', e => { if (ME.keys) ME.keys[e.code] = false; });
document.addEventListener('click', e => {
  if (mode !== 'mapedit') { const b = e.target.closest('[data-act="mapedit"]'); if (b) { const job = mode === 'paused' ? telCapture('mapedit') : null; if (job) procFlight(job, openMapEditor); else openMapEditor(); } return; }
  const a = e.target.closest('[data-measset]'); if (a && ME.locked) { meLockedHint(); return; } if (a) { ME.place = ME.place === a.dataset.measset ? null : a.dataset.measset; ME.sel.clear(); meSelBox(); meLibrary(); mePanels(); return; }
  const t = e.target.closest('[data-metool]'); if (t) { ME.tool = t.dataset.metool; ME.place = null; meLibrary(); meToolbar(); return; }
  const b = e.target.closest('[data-me]'); if (!b) return; const k = b.dataset.me;
  if (k === 'newmap') { meNewMap(($('#meNewName') || {}).value, COMM_MAP ? COMM_MAP.E : null); return; }   /* a community map is a template too */
  if (k === 'sharemap') { meShareMap(); return; }
  if (k === 'savekey' && ghMenus()) { const v = (($('#meOwnerKey') || {}).value || '').trim(); if (v) { store.set('ownerKey', v); ME.pubMsg = 'Owner key saved in this browser. Now press Publish for everyone.'; } mePanels(); return; }
  if (k === 'forgetkey') { store.set('ownerKey', ''); ME.pubMsg = 'Owner key removed from this browser.'; mePanels(); return; }
  if (k === 'savetoken' && ghMenus()) { const tk = (($('#meToken') || {}).value || '').trim(); if (tk) { gh.token = tk; saveGh(); ME.pubMsg = 'Token saved in this browser. Now press Publish for everyone.'; } mePanels(); return; }   /* the token stays in this browser only (saveGh: localStorage) */
  if (k === 'officialmap') { meLeaveMyMap(); return; }
  if (k === 'renamemap' && MY_MAP) { const n = prompt('Name of your map:', MY_MAP.name); if (n && n.trim()) { MY_MAP.name = n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40); store.set('myMaps', MY_MAPS); world.title = MY_MAP.name; mePanels(); } return; }
  if (k === 'delmap' && MY_MAP && confirm(`Delete your map "${MY_MAP.name}"? This can't be undone (copy its map code first to keep it).`)) { const i = MY_MAPS.indexOf(MY_MAP); if (i >= 0) MY_MAPS.splice(i, 1); store.set('myMaps', MY_MAPS); meLeaveMyMap(); return; }
  if (ME.locked && /^(undo|redo|del|dup|reset1|resetall|paste|group|ungroup)$/.test(k)) { meLockedHint(); return; }
  if (k === 'copy') meCopy(); if (k === 'paste') { ME.mouseFloor = null; mePaste(); } if (k === 'group') meGroup(); if (k === 'ungroup') meUngroup();
  if (k === 'undo') meUndo(); if (k === 'redo') meRedo(); if (k === 'top') ME.cam.pitch = 1.55; if (k === 'del') meDelete(); if (k === 'dup') meDuplicate();
  if (k === 'reset1') { const p = mePiece([...ME.sel][0]); if (p) { mePush(); delete ME.E.moved[p.key]; meCommit(); } }
  if (k === 'resetall' && confirm('Put every piece of this map back where it was and remove everything you added?')) { mePush(); ME.E = meEmpty(); ME.sel.clear(); meCommit(); }
  if (k === 'export') saveFile(`layout-${MAP_ID}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify({ ...ME.E, name: !ME.official && MY_MAP ? MY_MAP.name : undefined }, null, 1));
  if (k === 'copycode') meCopyCode(); if (k === 'pastecode') mePasteCode();
  if (k === 'import') $('#meFile').click(); if (k === 'refload') $('#meRefFile').click();
  if (k === 'fly') closeMapEditor('fly'); if (k === 'done') closeMapEditor();
  if (k === 'mode-own' && ME.official) meMode(false); if (k === 'mode-off' && !ME.official) meMode(true); if (k === 'publish') mePublish();
  if (k === 'discard' && confirm('Throw away your draft of the official map and go back to the published one?')) { const d = store.get('officialDraft', {}) || {}; delete d[MAP_ID]; store.set('officialDraft', d); ME.official = false; meMode(true); }
});
document.addEventListener('input', e => { if (mode === 'mapedit' && e.target.id === 'meQ') { ME.q = e.target.value; meLibList(); } });
document.addEventListener('change', e => {
  if (mode !== 'mapedit') return; const t = e.target;
  if (t.id === 'meVary') ME.vary = t.checked;
  if (t.dataset.mefield) { const p = mePiece([...ME.sel][0]); if (!p) return; const v = +t.value; if (!Number.isFinite(v)) return; const pv = mePivot(p), xf = meXf(p), f = t.dataset.mefield; mePush();
    if (f === 'x') meApply(p, new THREE.Vector3(v - pv.x, 0, 0), 0, 1); if (f === 'z') meApply(p, new THREE.Vector3(0, 0, v - pv.z), 0, 1); if (f === 'height') meApply(p, new THREE.Vector3(0, v - pv.y, 0), 0, 1);
    if (f === 'turn °') meApply(p, new THREE.Vector3(), v - xf.ry, 1); if (f === 'scale' && v > 0) meApply(p, new THREE.Vector3(), 0, v / xf.s); meCommit(); }
  if (t.id === 'meFile' && t.files[0]) { t.files[0].text().then(txt => { let j; try { j = JSON.parse(txt); } catch { flash('<b>NOT A LAYOUT FILE</b>', 'near'); return; }
    if (!j || j.format !== 'pro-whooper-mapedit/1') { flash('<b>NOT A LAYOUT FILE</b><small>expected pro-whooper-mapedit/1</small>', 'near'); return; }
    if (j.map && j.map !== MAP_ID) flash(`<b>MADE FOR ANOTHER MAP</b><small>${esc(String(j.map))}: pieces that don't match are skipped</small>`, 'near'); if (ME.locked) { meNewMap(j.name || 'Imported ' + (world.baseTitle || MAP_ID), j); return; } mePush(); ME.E = meClean(j); ME.E.map = MAP_ID; ME.sel.clear(); meCommit(); }); t.value = ''; }
  if (t.id === 'meRefFile' && t.files[0]) { meRefLoad(t.files[0]); t.value = ''; }
  if (t.id === 'meRefOn' && ME.ref) ME.ref.mesh.visible = t.checked;
  if (t.dataset.meref && ME.ref) { const R = ME.ref, v = +t.value; if (!Number.isFinite(v)) return; const k = t.dataset.meref; if (k === 'width m') R.w = Math.max(1, v); if (k === 'x') R.x = v; if (k === 'z') R.z = v; if (k === 'turn °') R.r = v; if (k === 'opacity') R.o = Math.max(0.05, Math.min(1, v)); meRefPlace(); }
});
// ---- the reference image: a picture on the ground, under the trees, to trace from (never saved, never sent)
function meRefLoad(file) {
  const url = URL.createObjectURL(file); new THREE.TextureLoader().load(url, tex => {
    tex.colorSpace = THREE.SRGBColorSpace; const asp = tex.image.height / tex.image.width;
    if (!ME.ref) { const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.7, fog: false }), mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 2; scene.add(mesh);
      const B = world.bounds || { x: [-50, 50], z: [-50, 50] }; ME.ref = { mesh, w: Math.round(B.x[1] - B.x[0]), x: 0, z: 0, r: 0, o: 0.7, asp }; }
    else { if (ME.ref.mesh.material.map) ME.ref.mesh.material.map.dispose(); ME.ref.mesh.material.map = tex; ME.ref.mesh.material.needsUpdate = true; ME.ref.asp = asp; }
    ME.ref.mesh.visible = true; meRefPlace(); mePanels(); URL.revokeObjectURL(url); });
}
function meRefPlace() { const R = ME.ref; if (!R) return; R.mesh.scale.set(R.w, R.w * R.asp, 1); R.mesh.position.set(R.x, 0.03, R.z); R.mesh.rotation.set(-Math.PI / 2, 0, R.r * Math.PI / 180); R.mesh.material.opacity = R.o; }
