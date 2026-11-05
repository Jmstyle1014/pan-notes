import os,sys,json
from playwright.sync_api import sync_playwright
# Studio's 🎼 Score view (the owner: "work more like MuseScore"): the song's pan tracks and My part as staves; tap a note to
# pick it, drag it up or down to the next note on its pan, change its length, move it, delete it; add notes by tapping the
# pans, the letter keys or the staff; every change is the song's own (↶ Undo), and My part's cues split when one note of a
# chord changes.
D=os.environ['WORK']+'/tscore/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok:fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=False);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}))")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
    if pg.evaluate("document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click('[data-st=addk][data-v=pan][data-set=tenor]');pg.wait_for_timeout(300)
    pg.evaluate("""(()=>{const tr=STUDIO.song.tracks.find(t=>t.type==='pan');tr.notes=[{t:0,d:1,p:'tenor:72',v:.9},{t:1,d:1,p:'tenor:74',v:.9},{t:2,d:1,p:'tenor:76',v:.9},{t:2,d:1,p:'tenor:79',v:.9},{t:3,d:1,p:'tenor:72',v:.9}]})()""")
    pg.evaluate("document.querySelector('#gbView [data-v=score]').click()");pg.wait_for_timeout(500)
    check(pg.evaluate("STUDIO.view()")=='score' and pg.evaluate("!document.querySelector('#stScore').hidden"),'🎼 Score is a Studio view')
    hits=pg.evaluate("STUDIO.SC.hits.map(h=>({x:h.x,y:h.y,p:h.n.p,t:h.n.t,pi:h.pi}))")
    check(len(hits)==5,f'the tenor\'s five notes are on the staff ({len(hits)})')
    pg.screenshot(path=D+'1-score.png')
    box=pg.evaluate("(()=>{const r=document.querySelector('#scCan').getBoundingClientRect();return {x:r.left,y:r.top}})()")
    at=lambda h:(box['x']+h['x'],box['y']+h['y'])
    trn=lambda:pg.evaluate("STUDIO.song.tracks.find(t=>t.type==='pan').notes.map(n=>[n.t,n.d,n.p])")
    # tap the D to pick it, drag it up two steps on the pan
    d=[h for h in hits if h['p']=='tenor:74'][0];x,y=at(d)
    pg.mouse.move(x,y);pg.mouse.down();pg.wait_for_timeout(50)
    check(pg.evaluate("STUDIO.SC.sel&&STUDIO.SC.sel.n.p")=='tenor:74','tapping a note picks it')
    pg.mouse.move(x,y-6,steps=3);pg.mouse.move(x,y-10,steps=3);pg.mouse.up();pg.wait_for_timeout(150)
    ps=[n[2] for n in trn()]
    check('tenor:76' in ps and ps.count('tenor:74')==0 and len(ps)==5,f'dragging it up moves it to the next notes on the pan (D → E) {ps}')
    # length: half note
    pg.click('#scBar [data-sc=len][data-v="2"]');pg.wait_for_timeout(150)
    n=[x for x in trn() if x[0]==1][0];check(n[1]==2,f'Half makes the picked note two beats long {n}')
    pg.click('#scBar [data-sc=dot]');pg.wait_for_timeout(150);n=[x for x in trn() if x[0]==1][0];check(n[1]==3,f'Dotted makes it three {n}')
    pg.click('#scBar [data-sc=dot]');pg.wait_for_timeout(100)
    pg.click('#scFoot [data-sc=move][data-v="1"]');pg.wait_for_timeout(150);check(any(x[0]==1.5 and x[2]=='tenor:76' for x in trn()),f'▶ moves it later {trn()}')
    pg.click('#scFoot [data-sc=step][data-v="-1"]');pg.wait_for_timeout(150);check(any(x[0]==1.5 and x[2]=='tenor:75' for x in trn()),f'▼ steps it down a note on the pan {trn()}')
    pg.click('#scKeys [data-sc=semi][data-v="12"]');pg.wait_for_timeout(150);check(any(x[0]==1.5 and x[2]=='tenor:87' for x in trn()),f'8va ▲ moves it up an octave {trn()}')
    pg.click('#scFoot [data-sc=del]');pg.wait_for_timeout(150);check(len(trn())==4 and not any(x[0]==1.5 for x in trn()),'⌫ Delete takes it out')
    pg.evaluate("document.querySelector('#stUndo').click()");pg.wait_for_timeout(250)
    check(len(trn())==5,f'↶ Undo puts it back {len(trn())}')
    # add by letters: the cursor at beat 4
    PI=pg.evaluate("STUDIO.scParts().findIndex(t=>t.type==='pan')")
    pg.evaluate(f"STUDIO.SC.cur={{pi:{PI},b:4}};STUDIO.SC.sel=null;STUDIO.scRender()");pg.click('#scBar [data-sc=len][data-v="1"]')
    for k in 'GAG':pg.click(f'#scKeys [data-sc=let][data-v={k}]');pg.wait_for_timeout(160)
    add=[x for x in trn() if x[0]>=4];check([x[0] for x in add]==[4,5,6] and [x[2] for x in add]==['tenor:67','tenor:69','tenor:67'] or [x[2] for x in add]==['tenor:79','tenor:81','tenor:79'],f'letters put notes in at the cursor, near the notes before {add}')
    check(pg.evaluate("STUDIO.SC.cur.b")==7,'and the cursor moves on')
    # add by the pans under the score
    f=pg.evaluate("(()=>{const e=document.querySelector('#scPans .field[data-field=\"tenor:84\"]');if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()")
    if f:pg.mouse.click(f['x'],f['y']);pg.wait_for_timeout(200)
    check(any(x[0]==7 and x[2]=='tenor:84' for x in trn()),f'tapping a pan under the score puts that note in at the cursor {trn()[-2:]}')
    # tap the staff with ✏ Add on
    pg.evaluate("window.scrollTo(0,0)");pg.wait_for_timeout(100);pg.click('#scBar [data-sc=addmode]')
    box=pg.evaluate("(()=>{const r=document.querySelector('#scCan').getBoundingClientRect();return {x:r.left,y:r.top}})()")
    R=pg.evaluate("(()=>{const cv=document.querySelector('#scCan');return {x0:STUDIO.SC.x0,ppb:STUDIO.SC.ppb}})()")
    pg.evaluate("STUDIO.SC.x0=0;STUDIO.scRender()");R['x0']=0
    yb=pg.evaluate(f"STUDIO.scRows()[{PI}].yb");xb=58+(1-R['x0'])*R['ppb']-9*.9+4   # beat 1, the bottom line (E4) moved up to the G line
    n0=len(trn());pg.mouse.click(box['x']+xb,box['y']+yb-9);pg.wait_for_timeout(200)
    new=[x for x in trn() if x[0]==1];check(len(trn())==n0+1 and any(x[2]=='tenor:67' for x in new),f'with ✏ Add on, tapping the G line puts a G there {new}')
    pg.click('#scBar [data-sc=addmode]')
    pg.evaluate("window.scrollTo(0,0)");pg.wait_for_timeout(100);pg.screenshot(path=D+'2-edited.png')
    # My part: a chord cue, change one note's length: it gets its own cue, the other keeps its length
    pg.evaluate("""(()=>{S.cues=[{id:'c1',start:0,duration:1,steps:['tenor:72','tenor:76'],mode:'together',note:''},{id:'c2',start:2,duration:1.5,steps:['tenor:74','tenor:76','tenor:77'],mode:'steps',note:''}];save();if(!STUDIO.song.tracks.some(t=>t.type==='part'))STUDIO.song.tracks.push({id:'mp',type:'part',name:'My part',vol:1,pan:0,mute:false,solo:false});STUDIO.SC.x0=0;STUDIO.SC.sel=null;STUDIO.scRender()})()""")
    pg.wait_for_timeout(300)
    parts=pg.evaluate("STUDIO.scParts().map(t=>t.type)");check('part' in parts,f'My part has its own staff {parts}')
    pi=parts.index('part');sp=pg.evaluate("60/STUDIO.song.bpm") if pg.evaluate("!S.grid") else pg.evaluate("60/S.grid.bpm")
    h=pg.evaluate(f"STUDIO.SC.hits.filter(h=>h.pi=={pi}).map(h=>({{x:h.x,y:h.y,p:h.n.p,t:h.n.t}}))")
    e=[q for q in h if q['p']=='tenor:76' and q['t']<.01]
    check(len(h)==5 and e,f'its notes show, a chord and a run ({len(h)})')
    if e:
        box=pg.evaluate("(()=>{const r=document.querySelector('#scCan').getBoundingClientRect();return {x:r.left,y:r.top}})()")
        pg.mouse.click(box['x']+e[0]['x'],box['y']+e[0]['y']);pg.wait_for_timeout(150);pg.click('#scBar [data-sc=len][data-v="2"]');pg.wait_for_timeout(200)
        cs=pg.evaluate("S.cues.map(c=>[c.start,c.duration,c.steps])")
        check(any(c[2]==['tenor:76'] and abs(c[1]-2*sp)<.01 for c in cs) and any(c[2]==['tenor:72'] and abs(c[1]-1)<.01 for c in cs),f'changing one note of a chord gives it its own cue, the other keeps its length {cs}')
        pg.evaluate("STUDIO.SC.x0=2;STUDIO.scRender()");pg.wait_for_timeout(100)
        h=pg.evaluate(f"STUDIO.SC.hits.filter(h=>h.pi=={pi}).map(h=>({{x:h.x,y:h.y,p:h.n.p,t:h.n.t}}))");f2=[q for q in h if q['p']=='tenor:77']
        box=pg.evaluate("(()=>{const r=document.querySelector('#scCan').getBoundingClientRect();return {x:r.left,y:r.top}})()")
        pg.mouse.click(box['x']+f2[0]['x'],box['y']+f2[0]['y']);pg.wait_for_timeout(150);pg.click('#scFoot [data-sc=del]');pg.wait_for_timeout(200)
        cs=pg.evaluate("S.cues.map(c=>[c.start,c.duration,c.steps])")
        check(sum(len(c[2]) for c in cs)==4 and any(abs(c[0]-2.5)<.01 and c[2]==['tenor:76'] for c in cs),f'deleting a note from a run keeps the others where they were {cs}')
    pg.evaluate("window.scrollTo(0,0)");pg.wait_for_timeout(100);pg.screenshot(path=D+'3-mypart.png')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
