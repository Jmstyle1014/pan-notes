#!/usr/bin/env python3
"""Builds the installable (offline) app version of Pan Notes from ../pan-notes.html.
Output goes to ./site — upload everything in that folder to any web host (e.g. GitHub Pages)."""
import os, re, shutil, hashlib, json
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
import sys
# usage: build.py [source.html] [output folder] [app name]
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'pan-notes.html')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'site')
NAME = sys.argv[3] if len(sys.argv) > 3 else 'Pan Notes'
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
if 'Unbounded' in src: FONTS.append(('Unbounded', 700, 'unbounded-700.woff2'))   # Panyard's display font
font_css = ''.join(f"@font-face{{font-family:'{n}';font-weight:{w};font-style:normal;font-display:swap;src:url(fonts/{f}) format('woff2')}}" for n, w, f in FONTS)

head = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0d1a1d">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>{NAME}</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<script>window.PAN_APP=true</script>
<style>{font_css}*,*::before,*::after{{box-sizing:border-box}}body{{margin:0}}</style>
</head><body>
'''
tail = '''
<script>
if('serviceWorker' in navigator)window.addEventListener('load',()=>{
  const had=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg=>{
    // look for a newer version whenever the app comes back to the front
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});
  }).catch(()=>{});
  // a newer version has taken over: offer a refresh instead of switching under your fingers
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had||window.__panNew)return;window.__panNew=1;
    if(typeof SAFE!=='undefined')SAFE.notice('update','<b>New version ready.</b> Refresh to get the latest version. Your songs are kept.',[['Refresh',()=>location.reload()],['Later',null]]);});
});
</script>
</body></html>
'''

# safety: only ever clear a folder this script made (never the repository or a folder with other things in it)
_o=os.path.abspath(OUT)
if os.path.exists(os.path.join(_o,'.git')) or _o in ('/',os.path.abspath(HERE),os.path.abspath(os.path.join(HERE,'..'))) or (os.path.isdir(_o) and not os.path.exists(os.path.join(_o,'sw.js'))and os.listdir(_o)):
    sys.exit('Refusing to clear '+_o+': build into a fresh folder (e.g. site, next, panyard) and copy the files across.')
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, 'fonts')); os.makedirs(os.path.join(OUT, 'icons'))
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(head + src + tail)
for _, _, f in FONTS: shutil.copy(os.path.join(VENDOR, f), os.path.join(OUT, 'fonts', f))
shutil.copy(os.path.join(VENDOR, 'jspdf.umd.min.js'), os.path.join(OUT, 'jspdf.umd.min.js'))
if 'lame.min.js' in src: shutil.copy(os.path.join(VENDOR, 'lame.min.js'), os.path.join(OUT, 'lame.min.js'))   # MP3 export (Studio)
# Studio's Real drum kit (recorded drums and percussion), for the versions that have Studio
# Panyard's picture backgrounds (App look → Trinidad & Tobago)
if "'backgrounds/" in src and os.path.isdir(os.path.join(HERE, 'backgrounds')): shutil.copytree(os.path.join(HERE, 'backgrounds'), os.path.join(OUT, 'backgrounds'), dirs_exist_ok=True)
if ("fetch('drums/kit.json')" in src or "dir:'drums/'" in src) and os.path.isdir(os.path.join(HERE, 'drums')): shutil.copytree(os.path.join(HERE, 'drums'), os.path.join(OUT, 'drums'), dirs_exist_ok=True)

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
# Panyard has its own drawn icon (a chrome pan, Chrome Night colours): source/icons/panyard-*.png, made with
# source/icons/panyard-icon.js. The other versions keep the gold pan drawn above.
ICONS = os.path.join(HERE, 'icons')
own = NAME == 'Panyard' and os.path.isfile(os.path.join(ICONS, 'panyard-icon.png'))
for size in (192, 512):
    if own:
        for f, out in (('panyard-icon.png', f'icon-{size}.png'), ('panyard-maskable.png', f'maskable-{size}.png')):
            Image.open(os.path.join(ICONS, f)).convert('RGBA').resize((size, size), Image.LANCZOS).save(os.path.join(OUT, 'icons', out))
    else:
        icon(size, False).save(os.path.join(OUT, 'icons', f'icon-{size}.png'))
        icon(size, True).save(os.path.join(OUT, 'icons', f'maskable-{size}.png'))

manifest = {
    "name": NAME, "short_name": NAME,
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
shell = ['./'] + [f for f in files if not re.match(r'drums/[^/]+/', f)]   # extra drum kits are saved when first used
sw = f'''// Pan Notes offline cache ({h})
const CACHE='{NAME.lower().replace(' ','-')}-{h}',FILES={json.dumps(shell)};
self.addEventListener('install',e=>{{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{{cache:'reload'}})))).then(()=>self.skipWaiting()))}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&/^{re.escape(NAME.lower().replace(' ','-'))}-[0-9a-f]{{10}}$/.test(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))}});
self.addEventListener('fetch',e=>{{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
  // the page itself: try for a newer version first, but on a slow connection open the saved copy after 1.5 s
  // (the newer one still downloads and is saved for next time); the saved copy straight away when offline
  // only this app's own page; another version living in a sub-folder looks after itself
  if(e.request.mode==='navigate'){{if(new URL(e.request.url).pathname!==new URL('./',location).pathname)return;
    const net=fetch(e.request.url,{{cache:'no-cache',credentials:'same-origin'}}).then(r=>{{if(r.ok){{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./',cp))}}return r}});
    e.waitUntil(net.catch(()=>{{}}));
    e.respondWith(caches.match('./').then(saved=>saved?Promise.race([net.catch(()=>saved),new Promise(ok=>setTimeout(()=>ok(saved),1500))]):net));return}}
  // an extra drum kit's sounds: kept once fetched, so a kit you've used works offline
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{{if(res.ok&&/\\/drums\\/[^/]+\\//.test(new URL(e.request.url).pathname)){{const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp))}}return res}})));
}});
'''
open(os.path.join(OUT, 'sw.js'), 'w').write(sw)
print('built', OUT, len(files) + 1, 'files, version', h)
