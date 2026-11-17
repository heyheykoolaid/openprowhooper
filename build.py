import pathlib
root = pathlib.Path(__file__).parent
t = (root / 'src/index.template.html').read_text()
# the game module is game.js followed by the track editor / race UI (editor.js shares its scope)
t = t.replace('/*GAME*/', '/*GAME*//*EDITOR*//*BBREPLAY*/')
for key, f in [('TRICKS', 'tricks.js'), ('SIM', 'sim.js'), ('RACE', 'race.js'), ('MANEUVERS', 'maneuvers.js'), ('VISION', 'vision.js'), ('GAME', 'game.js'), ('EDITOR', 'editor.js'), ('BBREPLAY', 'bbreplay.js'), ('BBL', 'bbl.js')]:
    t = t.replace('/*%s*/' % key, (root / 'src' / f).read_text().replace('</script', '<\\/script'))
out = root / 'dist'
# three.js: dist/index.html loads it from the CDN; the standalone build carries its own copy (vendor/, MIT) so it
# works offline and in sandboxed viewers that block the CDN.
CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>'
# plain inline <script> (not a data:/blob: module): works offline and inside sandboxed viewers that block data: modules
EMB = '<script>' + (root / 'vendor' / 'three-r160.min.js').read_text().replace('</script', r'<\/script') + '</script>'
out.mkdir(exist_ok=True)
import shutil
(out / 'music').mkdir(exist_ok=True)
for f in (root / 'assets' / 'music').iterdir():
    shutil.copy(f, out / 'music' / f.name)
import base64, json, sys
tracks = [{'title': 'Ghostrider', 'artist': 'awesometexture2251', 'src': 'music/ghostrider.mp3', 'art': 'music/ghostrider.jpg', 'theme': True}]
# the pilot's graffiti pieces (assets/graffiti/*.webp), embedded as data URLs in both builds
art = [{'name': f.stem, 'src': 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode()} for f in sorted((root / 'assets' / 'graffiti').glob('*.webp'))]
t = t.replace('<script>/*ART*/</script>', '<script>window.PW_ART=' + json.dumps(art) + ';</script>')
(out / 'index.html').write_text(t.replace('<!--THREE-->', CDN).replace('<script>/*TRACKS*/</script>', '<script>window.PW_TRACKS=' + json.dumps(tracks) + ';</script>'))
# standalone single-file build with the music embedded
emb = [dict(x) for x in tracks]
for x in emb:
    x['src'] = 'data:audio/mpeg;base64,' + base64.b64encode((out / x['src']).read_bytes()).decode()
    x['art'] = 'data:image/jpeg;base64,' + base64.b64encode((out / x['art']).read_bytes()).decode()
(out / 'standalone.html').write_text(t.replace('<!--THREE-->', EMB).replace('<script>/*TRACKS*/</script>', '<script>window.PW_TRACKS=' + json.dumps(emb) + ';</script>'))
print('built', len(t) // 1024, 'KB + standalone', (out / 'standalone.html').stat().st_size // 1024, 'KB')
