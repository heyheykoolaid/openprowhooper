# Renders a thumbnail of every map for the Maps carousel: assets/maps/<id>.webp (480 x 270).
# Needs a built dist/standalone.html, Playwright and Chrome:  python3 build.py && python3 tools/map_thumbs.py && python3 build.py
# Each map's view (camera position and look-at point) is set below; add one when a map is added.
# Pass --extra to also save the check shots listed in EXTRA (full size, into /tmp/map_shots/).
import asyncio, io, pathlib, sys
from playwright.async_api import async_playwright
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWS = {
    'school':     ([22, 16, 40], [-4, 2, 2]),
    'clappy':     ([-12, 19, 22], [1, 1, -4]),
    'warehouse':  ([-27, 9, 17], [6, 3, -6]),
    'playground': ([14, 9, 16], [-6, 1.5, -2]),
    'moose':      ([-22, 3.2, 10], [-34, 1.4, 0]),
    'ship':       ([-52, 17, -34], [4, 9, 2]),
    'murderdome': ([30, 13, 44], [-4, 1, 8]),
}
EXTRA = {
    'md-high':     ('murderdome', [0, 40, 60], [0, 0, 0]),
    'md-lights':   ('murderdome', [-14, 3, -20], [8, 9, 30]),
    'md-lights2':  ('murderdome', [0, 2, 30], [10, 12, 42]),
    'md-start':    ('murderdome', [-9, 1.6, 33], [6, 1.2, 33]),
    'md-canyon':   ('murderdome', [24, 1.5, 27], [24, 1.2, 10]),
    'md-rig':      ('murderdome', [26, 3, -21], [8, 1.5, -24]),
    'md-lounge':   ('murderdome', [2, 2.5, -24], [-12, 0.8, -32]),
    'md-bowl':     ('murderdome', [12, 4, 16], [0, 2.5, 0]),
    'md-maze':     ('murderdome', [-25, 6, -16], [-33, 0.5, 2]),
    'md-pit':      ('murderdome', [-21, 1.4, 22], [-29, 1.2, 21]),
    'md-finish':   ('murderdome', [-28, 1.4, 33], [-8, 2, 33]),
    'ship-side':    ('ship', [0, 8, 70], [0, 5, 0]),
    'ship-bow':     ('ship', [70, 10, 30], [42, 4, 0]),
    'ship-casino':  ('ship', [-4, 8.5, 6], [3, 6, 0]),
    'ship-atrium':  ('ship', [9, 11.2, 7], [-3, 12, -2]),
    'ship-grid':    ('ship', [2, 8, 3], [2, 15, 0]),
    'ship-rail':    ('ship', [36, 9.5, 4], [47, 6.5, 0]),
    'ship-roof':    ('ship', [-34, 21, 12], [-10, 17.5, -2]),
    'clappy-underpass': ('clappy', [18.5, 1.6, 6], [18, 2.6, -6]),
    'moose-c1':     ('moose', [45, 1.6, -21], [-20, 4, -21]),     # the owner's corner photos (2026-11-19): NE, along Arrow Dr
    'moose-c2':     ('moose', [43, 1.3, 23], [32, 1.5, 12]),    # SE, over the tires
    'moose-c3':     ('moose', [-45.5, 1.6, -23.5], [-34, 1.6, -10]),  # NW, the sign and the double birch
    'moose-c4':     ('moose', [-45, 1.6, 22.5], [-30, 2, 0]),      # SW, toward the playground
    'moose-play':   ('moose', [-27, 2.2, 7], [-33, 1.2, 2]),
    #'clappy-stairs': ('clappy', [3, 4, 3.5], [11, 3, -3.5]),
    #'clappy-beams':  ('clappy', [3, 2.2, 13], [0, 0.8, 9.5]),
    #'clappy-tower':  ('clappy', [-1, 4, -1], [-6, 2.5, -5]),
    #'clappy-shops':  ('clappy', [-6, 9, 13], [-4, 5, 34]),
    #'warehouse-in':  ('warehouse', [-25, 5, 14], [10, 3, -8]),
    #'warehouse-up':  ('warehouse', [10, 6, 12], [-10, 8, -14]),
}

async def shot(b, mid, view, size):
    pg = await b.new_page(viewport={'width': 1280, 'height': 720})
    async def route(r):
        u = r.request.url
        await (r.continue_() if u.startswith(('file:', 'data:', 'blob:')) else r.abort())
    await pg.route('**/*', route)
    await pg.add_init_script(f"localStorage.setItem('pw.map', JSON.stringify({mid!r})); localStorage.setItem('pw.pilotName', '\"thumbs\"'); window.__pwView = {{ p: {view[0]}, l: {view[1]} }};")
    await pg.goto((ROOT / 'dist' / 'standalone.html').as_uri())
    await pg.wait_for_timeout(9000)
    await pg.add_style_tag(content='body > :not(#view) { display: none !important; }')
    await pg.wait_for_timeout(800)
    png = await pg.screenshot()
    await pg.close()
    im = Image.open(io.BytesIO(png)).convert('RGB')
    return im.resize(size, Image.LANCZOS) if size else im

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        if '--extra' in sys.argv:
            out = pathlib.Path('/tmp/map_shots'); out.mkdir(exist_ok=True)
            only = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--only=')), '')
            for name, (mid, *view) in EXTRA.items():
                if only and not name.startswith(only): continue
                (await shot(b, mid, view, None)).save(out / (name + '.png')); print('shot', name)
        if '--no-thumbs' not in sys.argv:
            d = ROOT / 'assets' / 'maps'; d.mkdir(parents=True, exist_ok=True)
            for mid, view in VIEWS.items():
                (await shot(b, mid, view, (480, 270))).save(d / (mid + '.webp'), quality=78); print('thumb', mid)
        await b.close()

asyncio.run(main())
