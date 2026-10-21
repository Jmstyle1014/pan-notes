import os,sys,json
from playwright.sync_api import sync_playwright
# My notes: the notebook next to the song (Play, Write, Chart → Notes, full screen). Writing, text, section tags that
# jump and loop, select / copy / move / delete, undo, backgrounds, pages per song, Follow, and pages from before.
D=os.environ['WORK']+'/tnotes/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
SONG="""()=>{const ids=['c','e-low','g-low','c','a','f-low','d-low','g-low','bb','e-top','c','a','g-low','e-low'];S.cues=ids.map((p,i)=>({id:uid(),start:0.5+i,duration:0.8,steps:[p],mode:'together',note:''}));
  S.chart={text:'# Intro @0:00\\nc e\\n# Verse 1 @0:04\\ng a\\n# Chorus @0:08\\nf d\\n# Bridge @0:11\\nbb',edited:true};normalizeChords();renderAll();save()}"""
# a page written before My notes (it belongs to no song): one stroke, the old way
OLD="""()=>{const id='oldpage1';S.notePages.push({id,created:Date.now()-86400000,h:1414});localStorage.setItem('pan-ink-'+id,JSON.stringify([{c:1,w:5,d:'100,300,50;300,320,50;500,300,50'}]));save()}"""
def line(pg,box,pts,pen=False):
    r=box.bounding_box();x0,y0=r['x'],r['y']
    pg.mouse.move(x0+pts[0][0],y0+pts[0][1]);pg.mouse.down()
    for x,y in pts[1:]:pg.mouse.move(x0+x,y0+y,steps=3)
    pg.mouse.up()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept('Ending'))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.click('[data-r=producer]');pg.wait_for_timeout(300)
    E(pg,OLD)
    pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=guitar]');pg.fill('#nsName','Rocksteady');pg.click('[data-r=create]');pg.wait_for_timeout(1200)
    E(pg,SONG)
    # Play: the panel under the pans
    E(pg,"showView('play')");pg.wait_for_timeout(600)
    h=pg.locator('#view-play button:has-text("Hide")')
    if h.count():h.first.click();pg.wait_for_timeout(300)
    check(E(pg,"!!$('nbPlay')&&!!document.querySelector('#nbPlay [data-tab=a]')"),'Play: Next note | My notes under the pans')
    pg.click('#nbPlay [data-tab=n]');pg.wait_for_timeout(400)
    check(E(pg,"getComputedStyle(document.querySelector('#playStage>.now')).display==='none'&&$('nbPlay').querySelector('.nb-scroll').clientHeight>150"),'My notes takes the next-note card’s place')
    ch=E(pg,"[...document.querySelectorAll('#nbPlay [data-chip]')].map(b=>b.textContent)");check(ch==['Intro','Verse 1','Chorus','Bridge'],f'the song’s sections as chips {ch}')
    check(E(pg,"NOTES.songPages().some(p=>p.id==='oldpage1')"),'a page written before My notes still shows')
    # full screen
    pg.click('#nbPlay [data-e=full]');pg.wait_for_timeout(500)
    check(E(pg,"!$('nbFull').hidden"),'⤢ opens My notes full screen')
    check(E(pg,"NOTES.curPg().id")!='oldpage1','a new song starts on a page of its own')
    cv=pg.locator('#nbFull .nb-pg')
    pg.click('#nbFull [data-t=pen]');pg.click('#nbFull [data-c="2"]')
    line(pg,cv,[(30,110),(120,130),(200,110),(280,140)])
    pg.click('#nbFull [data-t=marker]');pg.click('#nbFull [data-c="1"]');line(pg,cv,[(30,160),(260,160)])
    n=E(pg,"NOTES.load(NOTES.curPg().id).strokes.map(k=>k.m)");check(n==[0,1],f'pen and marker strokes {n}')
    pg.click('#nbFull [data-t=text]');r=cv.bounding_box();pg.mouse.click(r['x']+40,r['y']+230);pg.wait_for_timeout(200);pg.keyboard.type('Ask Kevin about the ending');pg.wait_for_timeout(100)
    pg.click('#nbFull [data-t=pen]');pg.wait_for_timeout(200)
    tx=E(pg,"NOTES.load(NOTES.curPg().id).texts.map(t=>t.t)");check(tx==['Ask Kevin about the ending'],f'typed text {tx}')
    pg.click('#nbFull [data-t=section]');pg.mouse.click(r['x']+20,r['y']+40);pg.wait_for_timeout(300);pg.click('#nbSecPop [data-sec="Verse 1"]');pg.wait_for_timeout(200)
    pg.mouse.click(r['x']+20,r['y']+330);pg.wait_for_timeout(300);pg.click('#nbSecPop [data-sec="Chorus"]');pg.wait_for_timeout(200)
    pg.mouse.click(r['x']+20,r['y']+430);pg.wait_for_timeout(300);pg.click('#nbSecPop .nb-new');pg.wait_for_timeout(300)
    tg=E(pg,"NOTES.load(NOTES.curPg().id).tags.map(t=>t.name)");check(tg==['Verse 1','Chorus','Ending'],f'section tags {tg}')
    # select: circle the two strokes, duplicate, move, delete, undo
    pg.click('#nbFull [data-t=select]');line(pg,cv,[(10,90),(320,90),(320,185),(10,185),(10,90)])
    check(E(pg,"NOTES.sel.strokes.size")==2 and E(pg,"!!document.querySelector('#nbFull .nb-menu')"),'Select: circle two strokes, the menu shows')
    pg.click('#nbFull .nb-menu [data-m=dup]');pg.wait_for_timeout(200);check(E(pg,"NOTES.load(NOTES.curPg().id).strokes.length")==4,'Duplicate')
    y0=E(pg,"NOTES.load(NOTES.curPg().id).strokes[2].p[0][1]");bb=E(pg,"(()=>{const b=document.querySelector('#nbFull .nb-selbox').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()")
    pg.mouse.move(bb[0],bb[1]);pg.mouse.down();pg.mouse.move(bb[0],bb[1]+120,steps=5);pg.mouse.up();pg.wait_for_timeout(200)
    y1=E(pg,"NOTES.load(NOTES.curPg().id).strokes[2].p[0][1]");check(y1>y0+100,f'drag moves the selection ({y0}→{y1})')
    pg.click('#nbFull .nb-menu [data-m=del]');pg.wait_for_timeout(200);check(E(pg,"NOTES.load(NOTES.curPg().id).strokes.length")==2,'Delete')
    pg.click('#nbFull [data-e=undo]');pg.wait_for_timeout(200);check(E(pg,"NOTES.load(NOTES.curPg().id).strokes.length")==4,'Undo brings them back')
    pg.click('#nbFull [data-e=undo]');pg.click('#nbFull [data-e=undo]');pg.wait_for_timeout(200);check(E(pg,"NOTES.load(NOTES.curPg().id).strokes.length")==2,'…and further back')
    # page background
    pg.click('#nbFull [data-t=page]');pg.wait_for_timeout(300);pg.click('#nbPagePop [data-bg=staff]');pg.wait_for_timeout(200)
    check(E(pg,"NOTES.load(NOTES.curPg().id).bg")=='staff','Page: music staff background')
    pg.click('#nbFull [data-t=pen]');pg.screenshot(path=D+'2-full.png')
    pg.click('#nbFull [data-t=page]');pg.wait_for_timeout(300);pg.screenshot(path=D+'3-page.png');pg.click('#nbPagePop [data-p=add]');pg.wait_for_timeout(300)
    check(E(pg,"NOTES.songPages().length")==3 and E(pg,"NOTES.curIdx()")==1,'＋ New page (this song: 2 pages, plus the one from before)')
    E(pg,"NOTES.goPage(0)");pg.wait_for_timeout(200)
    pg.click('#nbFull [data-e=close]');pg.wait_for_timeout(400)
    # the tag's ▶ plays from there (no recording: your part); ↻ loops the section
    pg.click('#nbPlay .nb-tag:has-text("CHORUS") [data-go=play]');pg.wait_for_timeout(3500)
    st=E(pg,"[MYPART.on(),!audio.paused,Math.round(audio.currentTime)]");check(st[0] and st[1] and 8<=st[2]<=12,f'▶ on a tag plays from that part {st}')
    pg.wait_for_timeout(300);check(E(pg,"!!document.querySelector('#nbPlay [data-chip].on')"),'the chip of the part that’s playing lights up')
    pg.click('#nbPlay .nb-tag:has-text("VERSE 1") [data-go=loop]');pg.wait_for_timeout(800)
    lp=E(pg,"[loop,A,B]");check(lp[0] and abs(lp[1]-4)<.1 and abs(lp[2]-8)<.1,f'↻ loops that part {lp}')
    E(pg,"()=>{loop=false;renderLoop();audio.currentTime=8.6}");pg.wait_for_timeout(1500)
    sc=E(pg,"$('nbPlay').querySelector('.nb-scroll').scrollTop");check(sc>40,f'Follow scrolls your notes to the part that’s playing ({sc}px)')
    E(pg,"audio.pause()");pg.screenshot(path=D+'1-play.png')
    # Write: next to Coming up
    E(pg,"showView('cues')");pg.wait_for_timeout(900)
    check(E(pg,"!!document.querySelector('#wbNext #nbWrite')"),'Write: Coming up | My notes')
    pg.click('#nbWrite [data-tab=n]');pg.wait_for_timeout(500);pg.screenshot(path=D+'4-write.png')
    check(E(pg,"$('nbWrite').querySelector('.nb-scroll').clientHeight>40"),'My notes shows in Write')
    pg.click('#nbWrite [data-tab=a]');pg.wait_for_timeout(200)
    # Chart → Notes: the same notebook with every tool
    E(pg,"showView('notes')");pg.wait_for_timeout(600)
    check(E(pg,"!!$('nbChart').offsetParent&&getComputedStyle(document.querySelector('#view-notes>.inkbar')).display==='none'"),'Chart → Notes is the same notebook')
    pg.screenshot(path=D+'5-chart-notes.png')
    # saved: open the app again
    before=E(pg,"[S.title,S.cues.length,S.notePages.length]")
    pg.reload();pg.wait_for_timeout(1800)
    after=E(pg,"[S.title,S.cues.length,S.notePages.length]");check(before==after,f'opening the app never overwrites the song or its pages {before} → {after}')
    E(pg,"NOTES.goPage(0)");d=E(pg,"(()=>{const x=NOTES.load(NOTES.curPg().id);return [x.strokes.length,x.texts.length,x.tags.length,x.bg]})()")
    check(d==[2,1,3,'staff'],f'everything is still there after reopening the app {d}')
    # pages belong to their song
    E(pg,"SONGS.list.unshift({id:'snotes2',title:'Other song',n:0,rec:false,updated:Date.now(),done:{}});songOpen('snotes2',true)");pg.wait_for_timeout(1200)
    ids=E(pg,"NOTES.songPages().map(p=>p.id)");check(len(ids)==2 and 'oldpage1' in ids,f'another song has its own page (and the old shared one) {ids}')
    # backup file carries this song's pages
    bx=E(pg,"async()=>{const r=SONGS.list.find(s=>s.title==='Rocksteady');await songOpen(r.id);const o=await backupExtra();return o.notebook?o.notebook.pages.length:0}")
    check(bx>=2,f'the backup file has this song’s notes ({bx} pages)')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
