#!/usr/bin/env python3
"""Builds the installable (offline) app version of Pan Notes from ../pan-notes.html.
Output goes to ./site — upload everything in that folder to any web host (e.g. GitHub Pages)."""
import os, re, shutil, hashlib, json
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "pan-notes.html")
OUT = os.path.join(HERE, 'site')
VENDOR = os.path.join(HERE, 'vendor')   # fonts + jsPDF, copied in once

src = open(SRC, encoding='utf-8').read()
# drop the artifact's <title> and Google Fonts links; the app carries its own fonts
src = re.sub(r'^<title>.*?</title>\s*', '', src)
src = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', src)
src = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\s*', '', src)
# help text that only applies inside Claude
src = src.replace(
    "<p>The Claude phone app can't open your files. Open Pan Notes once in Safari or Chrome, signed in to Claude, and choose the recording there. It's saved to your account (up to about 45 MB) and then loads in the Claude app by itself.</p>",
    "<p>Your recording stays on this phone, so it's ready next time you open the app.</p>")
assert 'fonts.googleapis' not in src

FONTS = [('Bricolage Grotesque', 600, 'bricolage-600.woff2'), ('Bricolage Grotesque', 800, 'bricolage-800.woff2'),
         ('Atkinson Hyperlegible', 400, 'atkinson-400.woff2'), ('Atkinson Hyperlegible', 700, 'atkinson-700.woff2')]
font_css = ''.join(f"@font-face{{font-family:'{n}';font-weight:{w};font-style:normal;font-display:swap;src:url(fonts/{f}) format('woff2')}}" for n, w, f in FONTS)

head = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1a1d">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Pan Notes</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<script>window.PAN_APP=true</script>
<style>{font_css}*,*::before,*::after{{box-sizing:border-box}}body{{margin:0}}</style>
</head><body>
'''
tail = '''
<script>
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
</script>
</body></html>
'''

if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, 'fonts')); os.makedirs(os.path.join(OUT, 'icons'))
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(head + src + tail)
for _, _, f in FONTS: shutil.copy(os.path.join(VENDOR, f), os.path.join(OUT, 'fonts', f))
shutil.copy(os.path.join(VENDOR, 'jspdf.umd.min.js'), os.path.join(OUT, 'jspdf.umd.min.js'))

# icons: a gold pan on the dark stage colour
def icon(size, maskable):
    S = 4 * size; im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    bg = (13, 26, 29, 255); gold = (242, 177, 58, 255); light = (217, 229, 226, 255); teal = (44, 74, 79, 255)
    if maskable: d.rectangle([0, 0, S, S], fill=bg); r = S * 0.30
    else: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=bg); r = S * 0.38
    c = S / 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=teal)
    ri = r * 0.86; d.ellipse([c - ri, c - ri, c + ri, c + ri], fill=(24, 48, 47, 255))
    import math
    for i in range(7):   # outer note areas
        a = -math.pi / 2 + i * 2 * math.pi / 7; x, y = c + math.cos(a) * r * 0.58, c + math.sin(a) * r * 0.58; s2 = r * 0.24
        d.ellipse([x - s2, y - s2 * 0.85, x + s2, y + s2 * 0.85], fill=gold if i == 0 else light)
    for i in range(3):   # inner note areas
        a = -math.pi / 2 + math.pi / 3 + i * 2 * math.pi / 3; x, y = c + math.cos(a) * r * 0.22, c + math.sin(a) * r * 0.22; s2 = r * 0.15
        d.ellipse([x - s2, y - s2, x + s2, y + s2], fill=light)
    return im.resize((size, size), Image.LANCZOS)
for size in (192, 512):
    icon(size, False).save(os.path.join(OUT, 'icons', f'icon-{size}.png'))
    icon(size, True).save(os.path.join(OUT, 'icons', f'maskable-{size}.png'))

manifest = {
    "name": "Pan Notes", "short_name": "Pan Notes",
    "description": "Steelpan rehearsal companion: play along, cue your notes, share your part.",
    "id": "./", "start_url": "./", "scope": "./",
    "display": "fullscreen", "display_override": ["fullscreen", "standalone"],
    "orientation": "any", "background_color": "#0d1a1d", "theme_color": "#0d1a1d",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
        {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
json.dump(manifest, open(os.path.join(OUT, 'manifest.webmanifest'), 'w'), indent=1)

# service worker: keeps every app file on the phone so it opens with no internet
files = sorted(os.path.relpath(os.path.join(dp, f), OUT).replace(os.sep, '/') for dp, _, fs in os.walk(OUT) for f in fs)
h = hashlib.sha1(b''.join(open(os.path.join(OUT, f), 'rb').read() for f in files)).hexdigest()[:10]
shell = ['./'] + files
sw = f'''// Pan Notes offline cache ({h})
const CACHE='pan-notes-{h}',FILES={json.dumps(shell)};
self.addEventListener('install',e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))}});
self.addEventListener('fetch',e=>{{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  // the page itself: try for a newer version first, fall back to the saved copy when offline
  if(e.request.mode==='navigate'){{e.respondWith(fetch(e.request).then(r=>{{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./',cp));return r}}).catch(()=>caches.match('./')));return}}
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
}});
'''
open(os.path.join(OUT, 'sw.js'), 'w').write(sw)
print('built', OUT, len(files) + 1, 'files, version', h)
