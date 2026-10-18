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
# (each pan's key is already a class: pan-ec / pan-bf, or the set name)
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-game.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('      <details><summary>Hearing the pans when you tap</summary>', '''      <details open><summary>Panyard: the lanes and your streak</summary>
        <p>On <b>Play</b> (in portrait above the pans, sideways right between them), your notes fall down two lanes, <b style="color:#ff8a5c">coral</b> for the E / C pan and <b style="color:#3fd0d4">aqua</b> for the B / F pan, and land on the glowing line the moment they're played. Chords land across both lanes together.</p>
        <p>Play along by tapping the pans while the song plays. Each hit gets <b>Perfect</b>, <b>Great</b>, or <b>Early / Late</b>, and your streak counts up in the corner until you miss one. Your best streak is kept. Jump back in the song and the count starts fresh.</p></details>
      <details><summary>Hearing the pans when you tap</summary>''')
rep('<details open><summary>Colours on the pans and timeline</summary>', '<details><summary>Colours on the pans and timeline</summary>')

# the Game tab: a button next to Play, a score bar above the lanes, and the start / results cards below
PLAY_TAB = 'aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/></svg>Practice</button>'
rep(PLAY_TAB, PLAY_TAB + '''
      <button role="tab" data-view="game" aria-selected="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v3M8 20h8"/></svg>Game</button>''')
rep('    <div class="stage" id="playStage">\n', '''    <div id="gmHud"><div class="gmtop"><span id="gmLive">0</span><span id="gmMult">×1 · streak 0</span><button class="btn" id="gmQuit">Quit</button></div><div class="gmbar"><div id="gmBar"></div></div></div>
    <div id="gmCount" hidden aria-live="assertive"></div>
    <div class="stage" id="playStage">
''')
rep('    <div class="panel" id="practicePanel">', '''    <div id="gmPanel">
      <div class="panel" id="gmReady">
        <div><span class="eyebrow">Challenge</span><h2 id="gmSong" class="gmsong">Your song</h2><p class="gmbest" id="gmBest"></p></div>
        <div class="lab">Speed<div class="seg" id="gmSpeed"><button data-v="slow">Slow (0.75×)</button><button data-v="normal" aria-pressed="true">Normal</button></div></div>
        <div class="lab">Timing<div class="seg" id="gmTiming"><button data-v="relaxed">Relaxed</button><button data-v="strict" aria-pressed="true">Strict</button></div></div>
        <div class="lab" id="gmSecLab" hidden>Play<div class="secchips" id="gmSecs"></div></div>
        <p class="gmhelp">Tap the pans as each note lands on the line. Keep your streak going to multiply your points: ×2 at 10 in a row, ×3 at 25, ×4 at 50.</p>
        <p class="gmhelp gmneed" id="gmNeed" hidden></p>
        <button class="btn gmgo" id="gmStart">Start · 3, 2, 1</button>
      </div>
      <div class="panel" id="gmResults">
        <div class="gmcard"><span class="eyebrow">Song complete</span><div id="gmScore" class="gmscore">0</div><div id="gmStars" class="gmstars"></div><p id="gmPct" class="gmbest"></p></div>
        <div class="gmgrid"><div>Perfect<b id="gmPerfect" class="gold">0</b></div><div>Great<b id="gmGreat">0</b></div><div>Early / Late<b id="gmOk">0</b></div><div>Missed<b id="gmMiss" class="dim">0</b></div></div>
        <p id="gmPB" class="gmpb"></p>
        <button class="btn gmgo" id="gmAgain">Play again</button>
        <button class="btn" id="gmHard">Practise the hard parts</button>
        <button class="btn" id="gmBack">Change speed or timing</button>
      </div>
    </div>
    <div class="panel" id="practicePanel">''')
rep('      <details><summary>Hearing the pans when you tap</summary>', '''      <details><summary>Panyard: the Game tab</summary>
        <p>Open <b>Game</b> to play a whole song for a score. Choose <b>Slow</b> (0.75×) or <b>Normal</b> speed, and <b>Relaxed</b> or <b>Strict</b> timing, then tap Start. After a 3-2-1 count-in the notes fall just like on Play.</p>
        <p>Perfect is 100 points, Great 70, Early / Late 30. Your streak multiplies them: ×2 at 10 in a row, ×3 at 25, ×4 at 50. At the end you get up to three stars (60%, 80% and 95% of notes hit), and your best score for each song and speed is kept on this phone. <b>Practise the hard parts</b> loops the stretch where you missed the most, slowed down, on Play.</p></details>
      <details><summary>Hearing the pans when you tap</summary>''')

# Mallet Lab: test and calibrate a game controller (Retroid etc.) for playing the pans
rep('</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded', '\n' + open(os.path.join(HERE, 'panyard-lab.css'), encoding='utf-8').read() + '</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded')
rep('      <div class="row"><button class="btn" id="fsBtn2">', '      <button class="btn" id="labOpen">🎮 Mallet Lab · play with a controller (test)</button>\n      <div class="row"><button class="btn" id="fsBtn2">')
rep('<div id="helpSheet" class="sheetov"', """<div id="labSheet" class="labov" hidden role="dialog" aria-modal="true" aria-labelledby="labTitle">
 <div class="labbox">
  <div class="labhead"><div><span class="eyebrow">Panyard · test lab</span><h2 id="labTitle">Mallet Lab</h2></div><span id="labPad" class="labpad">Press any button on your controller</span><button class="btn" id="labClose">Close</button></div>
  <div class="labstage">
    <div class="labpan" id="lab-left" data-pan=""></div>
    <div class="labmid">
      <div class="labsticks">
        <div class="labst"><canvas id="labStickL" aria-label="Left stick"></canvas><button class="btn" id="labHitL">Hit</button><small id="labLInfo">—</small></div>
        <div class="labst"><canvas id="labStickR" aria-label="Right stick"></canvas><button class="btn" id="labHitR">Hit</button><small id="labRInfo">—</small></div>
      </div>
      <div id="labBtns" class="labbtns" aria-label="Controller buttons"></div>
      <p class="help" id="labAxes"></p>
    </div>
    <div class="labpan" id="lab-right" data-pan=""></div>
  </div>
  <p id="labMsg" class="help" role="status" aria-live="polite"></p>
  <div class="labctl">
    <div class="lab">How you strike<div class="seg" id="labMode"><button data-m="aim">Aim + strike</button><button data-m="flick">Flick</button></div></div>
    <div class="labmaps"><span>Left mallet: <b id="labMapL"></b></span><span>Right mallet: <b id="labMapR"></b></span></div>
    <label class="lab"><span class="tl">Dead zone <b id="labDzV"></b></span><input type="range" id="labDz" min="0.02" max="0.4" step="0.01"></label>
    <label class="lab"><span class="tl">Reach <b id="labReachV"></b></span><input type="range" id="labReach" min="0.5" max="1.1" step="0.02"></label>
    <label class="lab" id="labFlickRow"><span class="tl">Flick distance <b id="labFlickV"></b></span><input type="range" id="labFlick" min="0.6" max="1" step="0.02"></label>
    <div class="row"><button class="btn primary" id="labCal">🎯 Calibrate</button><button class="btn" id="labInv" aria-pressed="false">Flip up/down</button><button class="btn" id="labReset">Reset</button></div>
  </div>
  <div id="labWiz" class="labwiz" hidden><span class="eyebrow" id="labWizStep"></span><b id="labWizText"></b><div class="vidprog"><div id="labWizBar"></div></div><button class="btn" id="labWizCancel">Cancel</button></div>
 </div>
</div>
<div id="helpSheet" class="sheetov\"""")
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-lab.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('      <details><summary>Hearing the pans when you tap</summary>', """      <details><summary>Mallet Lab: playing with a controller (test)</summary>
        <p>Setup → Play along → <b>Mallet Lab</b>. Connect a game controller, or use a handheld like the Retroid, and press any button so the app can see it. The <b>left stick</b> is your left mallet over the left pan and the <b>right stick</b> your right mallet over the right pan; a gold ring shows where each one is pointing.</p>
        <p><b>Aim + strike</b>: point, then hit with your mallet buttons (L1 / R1 to start; analog triggers play softer or harder depending on how quickly you pull them). Hold to roll. <b>Flick</b>: push a stick out quickly to strike where it points, then let it come back. Tap <b>Calibrate</b> to measure your sticks and pick your mallet buttons. No controller? Drag inside the stick circles and hold <b>Hit</b>.</p></details>
      <details><summary>Hearing the pans when you tap</summary>""")

# Studio: record in layers over the practice recording (the multi-track recorder from Pocket Band)
rep('</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded', '\n' + open(os.path.join(HERE, 'panyard-studio.css'), encoding='utf-8').read() + '</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded')
GAME_TAB = '</svg>Game</button>'
rep(GAME_TAB, GAME_TAB + '''
      <button role="tab" data-view="studio" aria-selected="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16"/><rect x="3" y="13" width="4" height="3" rx="1" fill="currentColor"/><rect x="10" y="7" width="4" height="3" rx="1" fill="currentColor"/><rect x="17" y="11" width="4" height="3" rx="1" fill="currentColor"/></svg>Studio</button>''')
rep('  <!-- CUES -->', '''  <!-- STUDIO -->
  <section class="view" id="view-studio" hidden aria-label="Studio">
    <div class="panel st-bar">
      <div class="st-tp">
        <button class="btn" id="stHome" aria-label="Back to the start">⏮</button>
        <button class="btn primary st-play" id="stPlay" aria-label="Play">▶</button>
        <button class="btn st-rec" id="stRec" aria-pressed="false">● Rec</button>
        <div class="st-lcd"><b id="stPos">1.1</b><span id="stTempo"></span></div>
      </div>
      <div class="st-tools">
        <button class="btn" id="stMetro" aria-pressed="false">Click</button>
        <button class="btn" id="stCount" aria-pressed="true">Count-in</button>
        <button class="btn" id="stLoop" aria-pressed="false">⟲ Loop</button>
        <button class="btn" id="stUndo" disabled aria-label="Undo">↶</button>
        <button class="btn" id="stRedo" disabled aria-label="Redo">↷</button>
        <button class="btn" id="stMix">Mixer</button>
        <button class="btn" id="stExp">Export</button>
        <button class="btn" id="stTime">Timing fix</button>
      </div>
      <div class="seg st-views" id="stViews" role="tablist" aria-label="Studio view"><button data-sv="tracks" role="tab" aria-selected="true">☰ Tracks</button><button data-sv="inst" role="tab" aria-selected="false">◉ Pans</button></div>
    </div>
    <div class="st-secs" id="stSecs" hidden></div>
    <div class="panel st-tlp">
      <div class="st-tl" id="stTl"></div>
      <div class="st-tlrow"><button class="btn primary" id="stAdd">+ Add track</button><button class="btn sm" id="stZout" aria-label="Zoom out">−</button><button class="btn sm" id="stZin" aria-label="Zoom in">+</button>
        <span class="help">Tap a track's name to choose it. Tap its lane to select a bar, then another bar to select the bars between. Tap the bar numbers to move the playhead.</span></div>
    </div>
    <div id="stSel" class="st-selbar" hidden></div>
    <div class="panel" id="stInst"></div>
    <input type="file" id="stFile" accept="audio/*,video/*" hidden>
  </section>

  <!-- CUES -->''')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-hang.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-studio.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('      <details><summary>Hearing the pans when you tap</summary>', """      <details><summary>Studio: recording in layers</summary>
        <p>Open <b>Studio</b> to record over your song. Your practice recording is track 1, and the bars come from ♩ Timing in Write, so everything lines up with your notes and sections.</p>
        <p><b>+ Add track</b> gives you a <b>Mic</b> track (record yourself or import a file), a <b>Pan taps</b> track (play the pans on screen; every hit becomes a note), a <b>Beat</b> (soca, calypso and more, or your own pattern), or <b>Your part from Write</b>. Choose a track, tap <b>● Rec</b> (the screen switches to the pans or mic for you), and a bar of clicks counts you in while everything else plays. Use headphones for mic takes.</p>
        <p>Tap a lane to select bars: move, copy, repeat, snap or delete them, <b>Edit notes</b> on a grid, or loop them. The section buttons loop a whole Verse or Chorus. <b>Mixer</b> sets each track's volume, left/right and reverb; <b>Export</b> saves the song (or each track) as MP3 or WAV. Run <b>Timing fix</b> once so taps and mic takes land on the beat. Studio tracks are kept on this phone with each song; they're not in backup files.</p></details>
      <details><summary>Hearing the pans when you tap</summary>""")

# Home: the screen you open on, and the hanging pans
rep('</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded', '\n' + open(os.path.join(HERE, 'panyard-home.css'), encoding='utf-8').read() + '</style>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-home.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-tabs.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-stage.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-gb.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
# Write, Studio-style: one thin bar, a ruler, the pans or the timeline filling the screen
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-wb.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-looks.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
rep('/* ---------- start ---------- */', open(os.path.join(HERE, 'panyard-role.js'), encoding='utf-8').read() + '\n/* ---------- start ---------- */')
# Setup: "Pan look" for every pan (it was "Pan photos & order", for the Double Guitar only)
rep("this.vis('photos')&&isGuitar()?row('photos','Pan photos & order',this.val('photos')):''", "this.vis('photos')?row('photos','Pan look',this.val('photos')):''")
rep("photos:'Pan photos & order'", "photos:'Pan look'")
rep("case 'photos':return S.look==='photo'?'Photos':'Diagram';", "case 'photos':return typeof LOOK!=='undefined'?(LOOK.STYLES.find(s=>s[0]===LOOK.of(setKey()).style)||['','Night'])[1]:(S.look==='photo'?'Photos':'Diagram');")
rep("'Pan photos':'photos',", "'Pan photos':'photos','Pan look':'photos',")
rep("  renderSaveInfo();\n  initStore();\n})();", "  renderSaveInfo();\n  initStore();\n  showView('home');\n})();")
open(OUT, 'w', encoding='utf-8').write(s)
print('wrote', OUT)
