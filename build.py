import pathlib
root = pathlib.Path(__file__).parent
t = (root / 'src/index.template.html').read_text()
# the game module is game.js followed by the track editor / race UI (raceedit.js shares its scope)
# The game module is ONE script made of these files in this order (they share a scope): the core and its parts,
# then the track editor / race UI, Blackbox Replay, run review and the drop-offs.
t = t.replace('/*GAME*/', '/*COMMUNITY*//*GAME*//*G_MESHES*//*G_WORLDVIEW*//*G_INPUT*//*G_PLAY*//*G_MENUS*//*G_JUDGE*//*G_VIDEOREVIEW*//*G_SHELL*//*G_TRAINING*//*G_GHSYNC*//*G_BBLAB*//*G_PAUSEASK*//*EDITOR*//*MAPEDIT*//*BBREPLAY*//*RECAP*//*DROPOFF*/')
for key, f in [('TRICKS', 'tricks.js'), ('SIM', 'sim.js'), ('MAPS', 'maps.js'), ('RACE', 'racegow.js'), ('MANEUVERS', 'maneuvers.js'), ('VISION', 'vision.js'), ('GAME', 'game.js'), ('G_MESHES', 'meshes.js'), ('G_WORLDVIEW', 'worldview.js'), ('G_INPUT', 'input.js'), ('G_PLAY', 'play.js'), ('G_MENUS', 'menus.js'), ('G_JUDGE', 'judge.js'), ('G_VIDEOREVIEW', 'videoreview.js'), ('G_SHELL', 'shell.js'), ('G_TRAINING', 'training.js'), ('G_GHSYNC', 'ghsync.js'), ('G_BBLAB', 'bblab.js'), ('G_PAUSEASK', 'pauseask.js'), ('EDITOR', 'raceedit.js'), ('MAPEDIT', 'mapedit.js'), ('BBREPLAY', 'bbreplay.js'), ('RECAP', 'recap.js'), ('DROPOFF', 'dropoff.js'), ('BBL', 'bbl.js'), ('FLIGHTLOG', 'flightlog.js')]:
    t = t.replace('/*%s*/' % key, (root / 'src' / f).read_text().replace('</script', '<\\/script'))
# the community profile (tools/community.js, approved by the owner): every detector in the game starts from it
import json as _json
_cp = root / 'community' / 'profile.json'
_lib = root / 'library' / 'library.json'   # the trick library (tools/library.js): the demo GIFs and pilots' confirmed tricks
t = t.replace('/*COMMUNITY*/', (('window.Sim.setCommunity(' + _json.dumps(_json.loads(_cp.read_text())) + ');\n') if _cp.exists() else '') + (('window.Sim.setLibrary(' + _json.dumps(_json.loads(_lib.read_text()), separators=(',', ':')) + ');\n') if _lib.exists() else ''))
out = root / 'dist'
# three.js: dist/index.html loads it from the CDN; the standalone build carries its own copy (vendor/, MIT) so it
# works offline and in sandboxed viewers that block the CDN.
# dist/index.html loads three.js from a copy next to it (same site: no CDN to be blocked, and errors are readable)
CDN = '<script src="three-r160.min.js"></script>'
# plain inline <script> (not a data:/blob: module): works offline and inside sandboxed viewers that block data: modules
EMB = '<script>' + (root / 'vendor' / 'three-r160.min.js').read_text().replace('</script', r'<\/script') + '</script>'
out.mkdir(exist_ok=True)
import shutil
shutil.copy(root / 'vendor' / 'three-r160.min.js', out / 'three-r160.min.js')
(out / 'music').mkdir(exist_ok=True)
for f in (root / 'assets' / 'music').iterdir():
    shutil.copy(f, out / 'music' / f.name)
import base64, json, sys
# Telemetry drop-off (tools/dropoff-worker.mjs): a public URL that accepts opt-in flight telemetry and feedback from
# players who have no GitHub token. Not a secret. Set it with --dropoff=https://... or a one-line dropoff.txt.
drop = next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--dropoff=')), None)
if drop is None and (root / 'dropoff.txt').exists():
    drop = (root / 'dropoff.txt').read_text().strip()
drop = drop if drop and drop.startswith('https://') else ''
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'dropoff-check.html').write_text((root / 'tools' / 'dropoff-check.html').read_text().replace('/*DROPOFF*/""', json.dumps(drop)))
t = t.replace('<script>/*DROPOFF_URL*/</script>', '<script>window.PW_DROPOFF=' + json.dumps(drop) + ';</script>')
tracks = [{'title': 'Ghostrider', 'artist': 'awesometexture2251', 'src': 'music/ghostrider.mp3', 'art': 'music/ghostrider.jpg', 'theme': True}]
# the pilot's graffiti pieces (assets/graffiti/*.webp), embedded as data URLs in both builds
art = [{'name': f.stem, 'src': 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode()} for f in sorted((root / 'assets' / 'graffiti').glob('*.webp'))]
# thumbnails for the Maps carousel (assets/maps/<id>.webp, rendered by tools/map_thumbs.py)
thumbs = {f.stem: 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode() for f in sorted((root / 'assets' / 'maps').glob('*.webp'))}
t = t.replace('<script>/*MAPTHUMBS*/</script>', '<script>window.PW_MAPTHUMBS=' + json.dumps(thumbs) + ';</script>')
# official map layouts (maps/official/<id>.json, published from the Map Editor): applied for everyone (maps.js)
official = {}
for f in sorted((root / 'maps' / 'official').glob('*.json')) if (root / 'maps' / 'official').exists() else []:
    try: official[f.stem] = json.loads(f.read_text())
    except Exception: pass
t = t.replace('<script>/*OFFICIAL*/</script>', '<script>window.PW_OFFICIAL=' + json.dumps(official) + ';</script>')
t = t.replace('<script>/*ART*/</script>', '<script>window.PW_ART=' + json.dumps(art) + ';</script>')
(out / 'index.html').write_text(t.replace('<!--THREE-->', CDN).replace('<script>/*TRACKS*/</script>', '<script>window.PW_TRACKS=' + json.dumps(tracks) + ';</script>'))
# standalone single-file build with the music embedded
emb = [dict(x) for x in tracks]
for x in emb:
    x['src'] = 'data:audio/mpeg;base64,' + base64.b64encode((out / x['src']).read_bytes()).decode()
    x['art'] = 'data:image/jpeg;base64,' + base64.b64encode((out / x['art']).read_bytes()).decode()
(out / 'standalone.html').write_text(t.replace('<!--THREE-->', EMB).replace('<script>/*TRACKS*/</script>', '<script>window.PW_TRACKS=' + json.dumps(emb) + ';</script>'))
print('built', len(t) // 1024, 'KB + standalone', (out / 'standalone.html').stat().st_size // 1024, 'KB')
