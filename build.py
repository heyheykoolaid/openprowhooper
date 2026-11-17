import pathlib
root = pathlib.Path(__file__).parent
t = (root / 'src/index.template.html').read_text()
for key, f in [('TRICKS', 'tricks.js'), ('SIM', 'sim.js'), ('GAME', 'game.js')]:
    t = t.replace('/*%s*/' % key, (root / 'src' / f).read_text().replace('</script', '<\\/script'))
out = root / 'dist'
out.mkdir(exist_ok=True)
import shutil
(out / 'music').mkdir(exist_ok=True)
for f in (root / 'assets' / 'music').iterdir():
    shutil.copy(f, out / 'music' / f.name)
import base64, json, sys
tracks = [{'title': 'Ghostrider', 'artist': 'awesometexture2251', 'src': 'music/ghostrider.mp3', 'art': 'music/ghostrider.jpg', 'theme': True}]
(out / 'index.html').write_text(t.replace('<script>/*TRACKS*/</script>', '<script>window.PW_TRACKS=' + json.dumps(tracks) + ';</script>'))
# standalone single-file build with the music embedded
emb = [dict(x) for x in tracks]
for x in emb:
    x['src'] = 'data:audio/mpeg;base64,' + base64.b64encode((out / x['src']).read_bytes()).decode()
    x['art'] = 'data:image/jpeg;base64,' + base64.b64encode((out / x['art']).read_bytes()).decode()
(out / 'standalone.html').write_text(t.replace('<script>/*TRACKS*/</script>', '<script>window.PW_TRACKS=' + json.dumps(emb) + ';</script>'))
print('built', len(t) // 1024, 'KB + standalone', (out / 'standalone.html').stat().st_size // 1024, 'KB')
