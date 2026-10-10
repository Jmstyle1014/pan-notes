#!/usr/bin/env python3
"""Makes pan-notes-panyard.html (Panyard, the night-session look) from pan-notes-next.html.
Same app and features; night colours, falling lanes and play-along scoring on the Play tab."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'pan-notes-next.html')
OUT = os.path.join(HERE, 'pan-notes-panyard.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:80], c)
    s = s.replace(a, b)

rep('</style>\n\n<header class="appbar">', '</style>\n<style>\n' + open(os.path.join(HERE, 'panyard-look.css'), encoding='utf-8').read()
    + '</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700&display=swap">\n\n<header class="appbar">')
rep('<span class="eyebrow">Now rehearsing</span>', '<span class="eyebrow">Panyard · night session</span>')
rep('      <div id="playPans" class="pair"></div>', '      <canvas id="lanes" aria-label="Your notes falling down two lanes, one per pan, onto the line where you play them"></canvas>\n      <div id="playPans" class="pair"></div>')
rep("return '<div class=\"pan'+(src?' photo':'')", "return '<div class=\"pan pan-'+p.key+(src?' photo':'')")
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-game.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('      <details><summary>Hearing the pans when you tap</summary>', '''      <details open><summary>Panyard: the lanes and your streak</summary>
        <p>On <b>Play</b> (in portrait above the pans, sideways right between them), your notes fall down two lanes, <b style="color:#ff8a5c">coral</b> for the E / C pan and <b style="color:#3fd0d4">aqua</b> for the B / F pan, and land on the glowing line the moment they're played. Chords land across both lanes together.</p>
        <p>Play along by tapping the pans while the song plays. Each hit gets <b>Perfect</b>, <b>Great</b>, or <b>Early / Late</b>, and your streak counts up in the corner until you miss one. Your best streak is kept. Jump back in the song and the count starts fresh.</p></details>
      <details><summary>Hearing the pans when you tap</summary>''')
rep('<details open><summary>Colours on the pans and timeline</summary>', '<details><summary>Colours on the pans and timeline</summary>')
open(OUT, 'w', encoding='utf-8').write(s)
print('wrote', OUT)
