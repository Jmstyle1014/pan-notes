import os
# Studio's My part as a real track: playing the same line twice (Merge) doesn't double the notes, Replace swaps out
# only what you played over, ↶ Undo in Studio takes your part back, its bars go into a section with ＋ Add to…,
# and its Pan picker moves the song (and your notes, by pitch) to another pan.
import json
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
bad=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok:bad.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=b.new_page(viewport={'width':844,'height':390},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog',lambda d:d.accept('Chorus') if d.type=='prompt' else d.accept())
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
    pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.click('[data-r=producer]');pg.wait_for_timeout(300)
    pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=guitar]');pg.fill('#nsName','Part test');pg.click('[data-r=create]');pg.wait_for_timeout(1200)
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    E(pg,"S.cues=[];save();STUDIO.setTempo(90);STUDIO.song.countIn=false;STUDIO.song.metro=false;STUDIO.song.recMode='add';STUDIO.song.sel=STUDIO.song.tracks.find(t=>t.type==='part').id;STUDIO.seek(0)")
    if not E(pg,"document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=inst]').click()");pg.wait_for_timeout(600)
    # two notes the double guitar and the tenor both have
    ids=E(pg,"(()=>{const f=[...document.querySelectorAll('#stPans .field')].map(e=>e.dataset.field);const tn=new Set(SETS.tenor.views.flatMap(v=>v.fields.map(x=>midiOf(PITCH[x[0]]))));return f.filter(i=>tn.has(midiOf(PITCH[i]))).slice(0,2)})()")
    X,Y=ids
    def tap(i):
        bx=pg.locator(f'#stPans .field[data-field="{i}"]').bounding_box();pg.mouse.click(bx['x']+bx['width']/2,bx['y']+bx['height']/2,delay=30)
    def until(bt):E(pg,"b=>new Promise(r=>{const go=()=>{if(STUDIO.beatNow()>=b)r();else requestAnimationFrame(go)};go()})",bt)
    def take(seq,stop):
        E(pg,"STUDIO.seek(0)");E(pg,"STUDIO.toggleRec()")
        for bt,i in seq:until(bt);tap(i)
        until(stop);E(pg,"STUDIO.stop()");pg.wait_for_timeout(300)
    cues=lambda:E(pg,"S.cues.map(c=>[+(c.start).toFixed(2),c.steps.join('+')])")
    take([(1,X),(2,X),(3,X)],3.6);a=cues()
    check(len(a)==3,'first take: 3 notes '+json.dumps(a))
    take([(1,X),(2,X),(3,X)],3.6);m=cues()
    check(len(m)==3,'the same line again in Merge: still 3, not doubled '+json.dumps(m))
    take([(1,X),(2,Y)],2.5);m2=cues()
    check(len(m2)==4,'Merge with a new note at beat 2: just that one is added '+json.dumps(m2))
    E(pg,"STUDIO.undo()");pg.wait_for_timeout(200)
    check(len(cues())==3,'↶ Undo in Studio takes that take back '+json.dumps(cues()))
    E(pg,"STUDIO.song.recMode='replace'")
    take([(1,Y)],1.6);r=cues()
    ys=[c for c in r if c[1]==Y];xs=[c for c in r if c[1]==X]
    check(len(ys)==1 and len(xs)==2,'Replace from the start to beat 1.6: the first note is replaced, the two after where you stopped stay '+json.dumps(r))
    E(pg,"STUDIO.undo()");pg.wait_for_timeout(200)
    check(len([c for c in cues() if c[1]==X])==3,'↶ Undo brings the replaced note back '+json.dumps(cues()))
    E(pg,"STUDIO.redo()");pg.wait_for_timeout(200)
    check(len([c for c in cues() if c[1]==Y])==1,'↷ Redo replaces it again')
    E(pg,"STUDIO.song.recMode='add'")
    pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(500)
    # ＋ Add to… a new section, from My part's bar 1
    tid=E(pg,"STUDIO.song.tracks.find(t=>t.type==='part').id")
    E(pg,"()=>{document.querySelector('#stTl').scrollLeft=0}")
    for _ in range(6):E(pg,"document.querySelector('[data-st=zout]').click()")
    pg.wait_for_timeout(200)
    L=pg.locator(f'.st-row[data-tid="{tid}"] .st-lane').bounding_box();pg.mouse.click(L['x']+5,L['y']+L['height']/2);pg.wait_for_timeout(300)
    E(pg,"document.querySelector('[data-selmore]').click()");pg.wait_for_timeout(150)
    has=E(pg,"!!document.querySelector('#stSel [data-st=r-addto]')")
    check(has,'My part\'s pick has ＋ Add to…')
    if has:
        E(pg,"document.querySelector('#stSel [data-st=r-addto]').click()");pg.wait_for_timeout(300);pg.screenshot(path=D+'part-addto.png')
        pg.click('[data-st=addsec][data-v=new]');pg.wait_for_timeout(400)
        got=E(pg,"(()=>{const s=STUDIO.song,x=s.secs.find(z=>z.name==='Chorus'),t=s.tracks.filter(t=>t.type==='pan'&&t.song);return{sec:x,tracks:t.map(t=>[t.name,t.panSet,t.notes.filter(n=>n.t>=x.a*4&&n.t<x.b*4).length])}})()")
        check(got['sec'] and any(n>=3 and ps=='guitar' for _,ps,n in got['tracks']),'the bar went into a new Chorus section, on a song track for the double guitar '+json.dumps(got))
        E(pg,"STUDIO.undo()");pg.wait_for_timeout(200)
        check(E(pg,"!(STUDIO.song.secs||[]).some(z=>z.name==='Chorus')"),'↶ Undo takes the section back')
    # the Pan picker on My part
    E(pg,"STUDIO.song.sel=STUDIO.song.tracks.find(t=>t.type==='part').id")
    if not E(pg,"document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=inst]').click()");pg.wait_for_timeout(600)
    pm=E(pg,"S.cues.flatMap(c=>c.steps).map(i=>midiOf(PITCH[i]))")
    E(pg,"()=>{const s=document.querySelector('#stPopts [data-st-set]');s.value='tenor';s.dispatchEvent(new Event('change',{bubbles:true}))}");pg.wait_for_timeout(500)
    st=E(pg,"[S.panSet,S.cues.flatMap(c=>c.steps),[...document.querySelectorAll('#stPans .field')].length]")
    check(st[0]=='tenor' and all(i.startswith('tenor') or ':' in i for i in st[1]) and E(pg,"S.cues.flatMap(c=>c.steps).map(i=>midiOf(PITCH[i]))")==pm,'Pan → Low C Tenor: the song is on the tenor and your notes kept their pitches '+json.dumps(st[:2]))
    pg.screenshot(path=D+'part-tenor.png')
    E(pg,"STUDIO.undo()");pg.wait_for_timeout(300)
    check(E(pg,"S.panSet")=='guitar' and E(pg,"S.cues.flatMap(c=>c.steps).map(i=>midiOf(PITCH[i]))")==pm,'↶ Undo puts the song back on the double guitar with its notes')
    check(not errs,'no page errors '+json.dumps(errs[:3]))
    b.close()
print('PASS' if not bad else 'FAILED: '+'; '.join(bad))
