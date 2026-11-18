// The page as a browser gets it (2026-11-18: sim.js read process.env, which only Node has, and the site would not start;
// every other test runs in Node, where process exists, so nothing caught it). node test/browser.js
//  - builds dist/ exactly as GitHub Pages serves it
//  - runs every plain <script> of dist/standalone.html, in page order, in a sandbox with browser globals and NOTHING from
//    Node (no process, require, module, __dirname, Buffer), then builds the default map and every map there
//  - compiles the game module (it needs a real WebGL page to run)
//  - scans all of the page's script for Node-only names used without a typeof guard on the same line
const fs = require('fs'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
let ok = 0, n = 0; const check = (name, pass, extra = '') => { n++; if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}${extra ? '  ' + extra : ''}`); };
execFileSync('python3', [path.join(root, 'build.py')], { cwd: root, stdio: 'pipe' });
const html = fs.readFileSync(path.join(root, 'dist', 'standalone.html'), 'utf8');
const scripts = []; const re = /<script([^>]*)>([\s\S]*?)<\/script>/g; let m;
while ((m = re.exec(html))) { if (/\bsrc=/.test(m[1])) continue; scripts.push({ attrs: m[1], code: m[2], module: /type="module"/.test(m[1]), line: html.slice(0, m.index).split('\n').length }); }
check('the page has its scripts', scripts.length > 10 && scripts.some(s => s.module), `${scripts.length} inline scripts`);

// a browser-shaped sandbox: what the plain scripts may touch at load, and none of Node's globals
const noop = () => {}, store = {};
const anything = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : anything, apply: () => anything, construct: () => anything });
const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, TextEncoder, TextDecoder, URL, URLSearchParams, structuredClone, performance: { now: () => Date.now() }, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, navigator: { userAgent: 'test', hardwareConcurrency: 4 }, location: { href: 'https://example.test/', search: '', hash: '', protocol: 'https:' },
  document: anything, addEventListener: noop, removeEventListener: noop, requestAnimationFrame: noop, matchMedia: () => ({ matches: false, addEventListener: noop }), fetch: () => Promise.reject(new Error('offline')), __pwErr: [], __pwBootFail: noop };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const k of ['process', 'require', 'module', 'exports', '__dirname', '__filename']) check(`the sandbox has no ${k}`, vm.runInContext(`typeof ${k}`, ctx) === 'undefined');
// Buffer is used only by the sandbox's own atob/btoa above, never handed to the page
check('the sandbox has no Buffer', vm.runInContext('typeof Buffer', ctx) === 'undefined');

const plain = scripts.filter(s => !s.module), errs = [];
for (const s of plain) { if (/__pwBootFail\s*=|function __pwBootFail/.test(s.code)) continue;   // the page's own boot/error screen: it is all DOM
  try { vm.runInContext(s.code, ctx, { filename: `standalone.html:${s.line}` }); } catch (e) { errs.push(`line ${s.line}: ${e.message}`); } }
check('every plain script runs with browser globals only', !errs.length, errs.slice(0, 4).join(' | '));
const S = ctx.Sim;
check('Sim is there', !!S && typeof S.setCommunity === 'function' && typeof S.setLibrary === 'function' && typeof S.replayTrace === 'function');
check('three.js loaded', !!ctx.THREE && typeof ctx.THREE.Vector3 === 'function');
if (S && S.MAPS) for (const id of Object.keys(S.MAPS)) { let w = null, err = ''; try { w = S.MAPS[id].build(); } catch (e) { err = e.message; } check(`map "${id}" builds in the browser`, !!(w && w.objs && w.objs.length), err); }
// the game module's first statement hands the community profile and library to the sim: do the same
{ let err = ''; try { const cp = html.match(/Sim\.setCommunity\(([\s\S]*?)\);/); if (cp) vm.runInContext(`Sim.setCommunity(${cp[1]})`, ctx); } catch (e) { err = e.message; } check('the community profile loads', !err, err); }

const game = scripts.find(s => s.module);
{ let err = ''; try { new vm.Script(game.code, { filename: 'game module' }); } catch (e) { err = e.message; } check('the game module compiles', !err, err); }

// Node-only names anywhere in the page's script (outside three.js), unless guarded by typeof on the same line
const NODE = /\b(process\.(env|argv|exit|cwd|platform|versions)|require\(|__dirname|__filename|module\.exports|Buffer\.from)/;
const hits = [];
for (const s of scripts) { if (s.code.length > 400000 && /three\.module|THREE\.REVISION|REVISION\s*=/.test(s.code.slice(0, 2000))) continue;
  s.code.split('\n').forEach((l, i) => { if (NODE.test(l) && !/typeof\s+(process|require|module|__dirname|Buffer)/.test(l)) hits.push(`html line ${s.line + i}: ${l.trim().slice(0, 110)}`); }); }
check('no unguarded Node-only names in the page', !hits.length, hits.slice(0, 5).join(' | '));
console.log(`\n${ok}/${n} browser checks`); if (ok !== n) process.exit(1);
