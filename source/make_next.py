#!/usr/bin/env python3
"""Makes pan-notes-next.html (the redesigned look) from pan-notes.html.
Every button, id and feature stays; only layout, navigation and styling change."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'pan-notes.html')
OUT = os.path.join(HERE, 'pan-notes-next.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (a[:80], c)
    s = s.replace(a, b)

I = lambda d, extra='': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + extra + '>' + d + '</svg>'
IC = {
 'play': I('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/>'),
 'write': I('<path d="M3 6h18M3 12h10M3 18h14"/><circle cx="18" cy="12" r="2"/>'),
 'part': I('<path d="M4 5h16v14H4z"/><path d="M9 5v14M14 5v14"/>'),
 'notes': I('<path d="M4 20l4-1 11-11-3-3L5 16z"/>'),
 'share': I('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6h14v-6"/>'),
 'setup': I('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
 'help': I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
 'pdf': I('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>'),
 'pic': I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>'),
 'text': I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>'),
 'video': I('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
}

# --- styles: the new look goes after the old rules so it wins ---
rep('</style>\n\n<main>', '</style>\n<style>\n' + open(os.path.join(HERE, 'next-look.css'), encoding='utf-8').read() + '</style>\n\n'
    + '<header class="appbar"><div class="ttl"><span class="eyebrow">Now rehearsing</span><span id="appTitle">Pan Notes</span></div>'
    + '<div class="acts"><button class="iconbtn" id="shareBtnTop" aria-label="Share with your band">' + IC['share'] + '</button>'
    + '<button class="iconbtn" id="setupBtn" aria-label="Setup">' + IC['setup'] + '</button>'
    + '<button class="iconbtn" id="helpBtn" aria-label="Help">' + IC['help'] + '</button></div></header>\n<main>')

# --- Play: notes fly in under the now box; the timeline lives in Write; the part gets its own tab ---
hw_start = s.index('  <div id="hwWrap" class="hwwrap">')
hw_end = s.index('</div>', s.index('<button class="btn" id="editBtn">')) + len('</div>\n')
hw = s[hw_start:hw_end]; s = s[:hw_start] + s[hw_end:]
rep('''      <div class="now">
        <div id="nowNote" class="idle">Ready when you are</div>
        <div id="nowWhere"></div>
        <div id="nowReminder"></div>
      </div>''', '''      <div class="now">
        <div class="nowtxt">
          <div id="nowNote" class="idle">Ready when you are</div>
          <div id="nowWhere"></div>
          <div id="nowReminder"></div>
        </div>
        <div class="nextring" id="nextRing" hidden><span class="ring" id="nextRingNote"></span><small id="nextRingIn"></small></div>
      </div>''')
rep('      <div id="nextUp"></div>\n    </div>', '      <div id="nextUp"></div>\n' + hw.replace('  <div id="hwWrap"', '      <div id="hwWrap"') + '    </div>')
# timeline panel moves from Play into Write
tl_start = s.index('    <div id="slot-play">')
tl_end = s.index('    <div id="slot-sheet-play">')
tl = s[tl_start:tl_end]; s = s[:tl_start] + s[tl_end:]
tl_inner = tl.replace('    <div id="slot-play">\n', '', 1)
tl_inner = tl_inner[:tl_inner.rstrip().rfind('</div>')]
rep('    <div id="slot-cues"></div>', '    <div id="slot-cues">\n' + tl_inner + '    </div>')
# part sheet moves into its own tab
sh_start = s.index('    <div id="slot-sheet-play">')
sh_end = s.index('    <div class="panel" id="practicePanel">')
sh = s[sh_start:sh_end]; s = s[:sh_start] + s[sh_end:]
sh = sh.replace('<div id="slot-sheet-play">', '<div id="slot-sheet-part">', 1)
rep('    <div id="slot-sheet-cues"></div>\n', '')
rep('  <!-- NOTES -->', '  <!-- PART -->\n  <section class="view" id="view-part" hidden>\n' + sh + '  </section>\n\n  <!-- NOTES -->')
rep('<h2>Practice tools</h2>', '<h2>Practice</h2>')

# --- Share: its own sheet with one tile per format; backups live in Setup ---
sp_start = s.index('    <div class="panel" id="sharePanel">')
sp_end = s.index('    <div class="panel">\n      <h2>Play along</h2>')
s = s[:sp_start] + s[sp_end:]
rep('''        <button class="btn" id="loadDemo">Load example cues</button>''', '''        <button class="btn grow" id="expJson">Save backup file</button>
        <label class="btn grow">Open backup file<input id="impJson" type="file" accept=".json,application/json"></label>
      </div>
      <div class="row">
        <button class="btn" id="loadDemo">Load example cues</button>''')
share_sheet = '''<div id="shareSheet" class="sheetov" hidden role="dialog" aria-modal="true" aria-labelledby="shareTitle">
  <div class="sheetbox">
    <div class="sheethead"><h2 id="shareTitle">Share with your band</h2><button class="btn" id="shareClose">Close</button></div>
    <div class="sharebody">
      <div class="lab"><span class="sharelab">What to share</span>
        <div class="seg" id="expKind"><button data-k="sheet" aria-pressed="true">Letters</button><button data-k="timeline">Timeline</button></div>
      </div>
      <div class="tiles">
        <button class="tile" id="expPdf">''' + IC['pdf'] + '''<b>PDF</b><span>Pages to print or send</span></button>
        <button class="tile" id="expPng">''' + IC['pic'] + '''<b>Picture</b><span>One image for the group chat</span></button>
        <button class="tile" id="expText">''' + IC['text'] + '''<b>Copy as text</b><span>Paste straight into a message</span></button>
        <button class="tile" id="vidBtn">''' + IC['video'] + '''<b>Video</b><span>Pans lighting up, with the song</span></button>
      </div>
      <p class="help" id="dlNote" hidden>Saving files isn't available in this view. Copy as text still works.</p>
      <textarea id="expTextBox" rows="9" readonly hidden aria-label="Your part as text"></textarea>
    </div>
  </div>
</div>
'''
rep('<div id="vidSheet" class="sheetov"', share_sheet + '<div id="vidSheet" class="sheetov"')

# --- tab bar: Play, Write, Part, Notes (Setup and Help moved to the top bar) ---
rep('''      <button role="tab" data-view="play" aria-selected="true">Play</button>
      <button role="tab" data-view="cues" aria-selected="false">Cues</button>
      <button role="tab" data-view="notes" aria-selected="false">Notes</button>
      <button role="tab" data-view="setup" aria-selected="false">Setup</button>
      <button id="helpBtn" class="helpbtn" aria-label="Help">?</button>''',
'''      <button role="tab" data-view="play" aria-selected="true">''' + IC['play'] + '''Play</button>
      <button role="tab" data-view="cues" aria-selected="false">''' + IC['write'] + '''Write</button>
      <button role="tab" data-view="part" aria-selected="false">''' + IC['part'] + '''Part</button>
      <button role="tab" data-view="notes" aria-selected="false">''' + IC['notes'] + '''Notes</button>''')

# --- notes toolbar: grouped tools, page pill, ⋯ opens a small menu ---
rep('''      <div class="inkrow">
        <span class="swatches" id="swatches" role="group" aria-label="Pen colour"></span>
        <button class="ibtn" data-tool="eraser" aria-pressed="false" aria-label="Eraser">⌫</button>
        <button class="ibtn" data-tool="hand" aria-pressed="false" aria-label="Scroll the page">✋</button>
        <button class="ibtn" id="inkUndo" aria-label="Undo" disabled>↶</button>
        <button class="ibtn" id="inkRedo" aria-label="Redo" disabled>↷</button>
      </div>
      <div class="inkrow">
        <button class="ibtn" id="pgPrev" aria-label="Previous page">◀</button>
        <span id="pgLabel" class="pglabel">Page 1 of 1</span>
        <button class="ibtn" id="pgNext" aria-label="Next page">▶</button>
        <button class="ibtn" id="pgAdd" aria-label="New page">＋</button>
        <button class="ibtn" id="pgMore" aria-expanded="false" aria-label="More">⋯</button>
      </div>
      <div class="inkmenu" id="pgMenu" hidden>
        <button class="btn" id="stylusBtn" aria-pressed="false">Stylus only: off</button>
        <button class="btn" id="pgSave">Save page as picture</button>
        <button class="btn danger" id="pgClear">Clear page</button>
        <button class="btn danger" id="pgDelete">Delete page</button>
      </div>''', '''      <div class="inkrow">
        <span class="swatches" id="swatches" role="group" aria-label="Pen colour"></span>
        <span class="inkspacer"></span>
        <span class="inkgrp">
          <button class="ibtn" data-tool="eraser" aria-pressed="false" aria-label="Eraser">⌫</button>
          <button class="ibtn" data-tool="hand" aria-pressed="false" aria-label="Scroll the page">✋</button>
        </span>
        <span class="inkgrp">
          <button class="ibtn" id="inkUndo" aria-label="Undo" disabled>↶</button>
          <button class="ibtn" id="inkRedo" aria-label="Redo" disabled>↷</button>
        </span>
      </div>
      <div class="inkrow">
        <span class="pgpill">
          <button class="ibtn" id="pgPrev" aria-label="Previous page">◀</button>
          <span id="pgLabel" class="pglabel">Page 1 of 1</span>
          <button class="ibtn" id="pgNext" aria-label="Next page">▶</button>
        </span>
        <button class="ibtn" id="pgAdd" aria-label="New page">＋</button>
        <span class="inkspacer"></span>
        <span class="inkmore">
          <button class="ibtn" id="pgMore" aria-expanded="false" aria-haspopup="true" aria-label="More">⋯</button>
          <div class="inkmenu" id="pgMenu" hidden role="menu">
            <button class="btn" id="stylusBtn" aria-pressed="false" role="menuitem">Stylus only: off</button>
            <button class="btn" id="pgSave" role="menuitem">Save page as picture</button>
            <hr>
            <button class="btn danger" id="pgClear" role="menuitem">Clear page</button>
            <button class="btn danger" id="pgDelete" role="menuitem">Delete page</button>
          </div>
        </span>
      </div>''')

# --- behaviour ---
rep("  for(const n of['play','cues','notes','setup'])$('view-'+n).hidden=n!==v;", "  for(const n of['play','cues','part','notes','setup'])$('view-'+n).hidden=n!==v;\n  $('setupBtn').setAttribute('aria-current',v==='setup'?'page':'false');")
rep("  const target=isStage()?$('drawerBody'):$('slot-'+currentView);", "  const target=isStage()?$('drawerBody'):$('slot-cues');")
rep("$('shareTL').onclick=()=>{expKind='timeline';renderExpKind();showView('setup');setTimeout(()=>$('sharePanel').scrollIntoView({behavior:'smooth',block:'start'}),50)};",
    """function openShare(on){$('shareSheet').hidden=!on;if(on)$('shareClose').focus()}
$('shareTL').onclick=()=>{expKind='timeline';renderExpKind();openShare(true)};
$('shareBtnTop').onclick=()=>openShare(true);$('shareClose').onclick=()=>openShare(false);
$('shareSheet').addEventListener('click',e=>{if(e.target===$('shareSheet'))openShare(false)});
$('setupBtn').onclick=()=>showView(currentView==='setup'?'play':'setup');""")
rep("document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('helpSheet').hidden)openHelp(false)});",
    """document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('helpSheet').hidden)openHelp(false);if(!$('shareSheet').hidden)openShare(false);if(!$('pgMenu').hidden){$('pgMenu').hidden=true;$('pgMore').setAttribute('aria-expanded','false')}});
// the notes ⋯ menu closes when you tap anywhere else or pick something
document.addEventListener('pointerdown',e=>{const m=$('pgMenu');if(!m.hidden&&!e.target.closest('.inkmore')){m.hidden=true;$('pgMore').setAttribute('aria-expanded','false')}});
$('pgMenu').addEventListener('click',e=>{if(e.target.closest('#pgSave,#pgClear,#pgDelete')){$('pgMenu').hidden=true;$('pgMore').setAttribute('aria-expanded','false')}});
// the video starts from the share sheet; close it first
$('vidBtn').addEventListener('click',()=>openShare(false),true);
audio.addEventListener('play',()=>document.body.classList.add('playing'));audio.addEventListener('pause',()=>document.body.classList.remove('playing'));""")
# now box: next note counting down; top bar: song name
rep("  $('nowReminder').textContent=live.map(c=>c.note).filter(Boolean).join('\\n');",
    """  $('nowReminder').textContent=live.map(c=>c.note).filter(Boolean).join('\\n');
  {const nx=S.cues.find(c=>c.start>t&&c.steps.length),ring=$('nextRing');
   if(nx&&nx.start-t<8){ring.hidden=false;const lbl=nx.steps.map(id=>FIELDS.get(id).label);$('nextRingNote').textContent=nx.mode==='together'?lbl.join('+'):lbl[0];$('nextRingIn').textContent='next · '+(nx.start-t).toFixed(1)+'s'}
   else ring.hidden=true;
   const at=S.title||(hasAudio?curName:'')||'Pan Notes';if($('appTitle').textContent!==at)$('appTitle').textContent=at}""")
# help text follows the new names
rep('<p><b>Cues tab:</b>', '<p><b>Write tab:</b>')
open(OUT, 'w', encoding='utf-8').write(s)
print('wrote', OUT)
