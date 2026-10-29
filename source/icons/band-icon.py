"""Panyard Band's icon (a chrome pan, a gold note ringing out above it, on dark teal): band-icon.svg drawn to
band-icon.png (rounded corners) and band-maskable.png (full square, the picture inside Android's safe circle).
Run: python3 source/icons/band-icon.py"""
import os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
svg = open(os.path.join(HERE, 'band-icon.svg')).read()
# maskable: no rounded corners, and the picture at 80% so a circle or squircle mask never cuts the note or the pan
inner = svg.split('>', 1)[1].rsplit('</svg>', 1)[0]
defs, rest = inner.split('</defs>', 1)
bg = rest.split('/>', 1)[0] + '/>'; body = rest.split('/>', 1)[1]
mask = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">' + defs + '</defs>'
        + bg.replace('rx="225"', 'rx="0"') + '<g transform="translate(512 512) scale(.8) translate(-512 -512)">' + body + '</g></svg>')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1024, 'height': 1024})
    for name, s in (('band-icon.png', svg), ('band-maskable.png', mask)):
        pg.set_content('<html><body style="margin:0;background:transparent">' + s + '</body></html>'); pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(HERE, name), omit_background=True, clip={'x': 0, 'y': 0, 'width': 1024, 'height': 1024})
    b.close()
print('wrote band-icon.png and band-maskable.png')
