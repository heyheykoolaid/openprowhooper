// Map codes (the Map Editor's "Copy map code": PWMAP1-<map>-<deflated JSON, base64url>).
//   node tools/mapcode.js <code>                     print the layout it holds
//   node tools/mapcode.js <code> --official [--by=X] write it as maps/official/<map>.json (then build, test, commit)
//   node tools/mapcode.js --encode <layout.json>     make a code from a layout file
// A code is data: it is parsed, never run; only moved / removed / added go into the official file.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), a = process.argv.slice(2);
if (a[0] === '--encode') { const j = JSON.parse(fs.readFileSync(a[1], 'utf8')), map = j.map || 'moose';
  console.log(`PWMAP1-${map}-` + zlib.deflateRawSync(Buffer.from(JSON.stringify({ format: 'pro-whooper-mapedit/1', map, moved: j.moved || {}, removed: j.removed || [], added: j.added || [] }))).toString('base64url')); process.exit(0); }
const m = /^PWMAP1-([a-z0-9_]{1,24})-([A-Za-z0-9_-]+)$/.exec((a[0] || '').trim()); if (!m) { console.log('not a map code (PWMAP1-<map>-…)'); process.exit(1); }
const j = JSON.parse(zlib.inflateRawSync(Buffer.from(m[2], 'base64url'), { maxOutputLength: 4e6 }).toString('utf8'));
if (!j || j.format !== 'pro-whooper-mapedit/1') { console.log('not a layout'); process.exit(1); }
const E = { format: 'pro-whooper-mapedit/1', map: m[1], moved: j.moved && typeof j.moved === 'object' ? j.moved : {}, removed: Array.isArray(j.removed) ? j.removed.filter(x => typeof x === 'string') : [], added: Array.isArray(j.added) ? j.added : [] };
console.log(`${m[1]}: ${Object.keys(E.moved).length} moved, ${E.removed.length} removed, ${E.added.length} added`);
if (a.includes('--official')) { const by = (a.find(x => x.startsWith('--by=')) || '--by=heyheykoolaid').slice(5); E.at = new Date().toISOString(); E.by = by;
  const f = path.join(__dirname, '..', 'maps', 'official', m[1] + '.json'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(E, null, 1)); console.log('wrote', path.relative(process.cwd(), f)); }
else console.log(JSON.stringify(E, null, 1).slice(0, 3000));
