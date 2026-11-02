import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR classroom (Level 1: Know your pan): a chalkboard in the yard starts it; the lesson board takes the studio
# screen's place at your pan; guided steps glow the note to play, a wrong hit flashes red and says what you played and
# where to look; check steps don't glow until two wrong tries; two notes together for intervals and chords; beat steps
# count hits in time with a click; stars per lesson open the next one and are kept; double seconds lessons follow its
# two pans; leaving puts the studio back.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrclass/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-cls-voice','1');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000)
    pg.evaluate("document.getElementById('hud').hidden=true");pg.wait_for_timeout(400)
    S=lambda:pg.evaluate("VR.cls.state()")
    check(S()['door'],'the yard has the classroom chalkboard')
    pg.evaluate("VR.camera.position.set(1.6,1.6,.9);VR.camera.lookAt(3.4,1.4,2.7)");pg.wait_for_timeout(500);pg.screenshot(path=D+'1-door.png')
    # in
    pg.evaluate("VR.cls.act('clsgo')");pg.wait_for_timeout(500);s=S()
    check(s['on'] and s['board'] and not s['studio'] and s['set']=='tenor' and not s['door'],'Start: the lesson board takes the studio screen\'s place at your tenor')
    check(len(s['lessons'])==9 and s['lessons'][-1][0]=='Level 1 test',f'Level 1 has 8 lessons and a test {[l[0] for l in s["lessons"]]}')
    st=pg.evaluate("VR.studioAt()");bd=pg.evaluate("VR.cls.boardAt()");import math
    check(math.hypot(bd[0]-st['pans'][0],bd[2]-st['pans'][2])<1.4 and 1.1<bd[1]<1.9,f'the board stands just behind your pans at eye height {bd} (pans {st["pans"]})')
    def look():
        bd=pg.evaluate("VR.cls.boardAt()");pa=pg.evaluate("VR.studioAt()")['pans'];dx,dz=pa[0]-bd[0],pa[2]-bd[2];n=math.hypot(dx,dz)
        pg.evaluate(f"VR.camera.position.set({pa[0]+dx/n*.55},{bd[1]+.05},{pa[2]+dz/n*.55});VR.camera.lookAt({bd[0]},{bd[1]-.25},{bd[2]})");pg.wait_for_timeout(450)
    look();pg.screenshot(path=D+'2-home.png')
    pg.evaluate("VR.cls.open(2)");check(S()['page']=='home' and 'two stars' in S()['msg'].lower(),'lessons open in order: lesson 3 is locked at first')
    # lesson 1
    pg.evaluate("VR.cls.open(0)");s=S();check(s['page']=='lesson' and s['t']=='say' and any('letter name' in x for x in pg.evaluate("VR.said")),'Lesson 1 starts: the board explains and the voice reads it')
    pg.evaluate("VR.cls.act('clsnext')");pg.evaluate("VR.cls.act('clsnext')");s=S()
    check(s['t']=='play' and s['item']['ids']==['tenor:60'],f'then a guided step: play C {s["item"]}')
    pg.wait_for_timeout(300);g=pg.evaluate("VR.cls.glow()");check(any(x.startswith('tenor:60:') for x in g),f'C glows on the pan {g}')
    look();pg.screenshot(path=D+'3-guided.png')
    pg.evaluate("VR.swing('tenor:62',2.5)");pg.wait_for_timeout(150);s=S()
    check('That\'s D' in s['msg'] and 'C is' in s['msg'] and s['mis']==1 and s['k']==0,f'a wrong note says what you played and where to look: "{s["msg"]}"')
    check(any(x.startswith('tenor:62:ff3b30') for x in pg.evaluate("VR.cls.glow()")),'and flashes red where you hit')
    pg.screenshot(path=D+'4-wrong.png')
    for i in ['tenor:60','tenor:67','tenor:62','tenor:69','tenor:64']:
        pg.evaluate(f"VR.swing('{i}',2.5)");pg.wait_for_timeout(120)
    s=S();check(s['done'] and 'Well done' in s['msg'],'each right note moves on; the step ends "Well done"')
    pg.wait_for_timeout(1900);s=S();check(s['S']==3 and s['t']=='play',f'and the check step follows by itself (step {s["S"]+1})')
    pg.wait_for_timeout(300);check(not [x for x in pg.evaluate("VR.cls.glow()") if '00e0d0' in x],'a check step doesn\'t glow')
    want=s['item']['ids'][0];octave=f"tenor:{int(want.split(':')[1])+12}"
    pg.evaluate(f"VR.swing('{octave}',2.5)");pg.wait_for_timeout(120);check(S()['k']==1,f'"any octave counts": {octave} answers {want}')
    for x in ['tenor:61','tenor:61']:pg.evaluate(f"VR.cls.hit('{x}')")
    pg.wait_for_timeout(300);s=S();check(s['shown'] and any('00e0d0' in x for x in pg.evaluate("VR.cls.glow()")),'after two wrong tries the answer glows')
    while S()['page']=='lesson' and S()['t']=='play':
        it=S()['item'];pg.evaluate(f"VR.cls.hit('{it['ids'][0]}')");pg.wait_for_timeout(60)
        if S()['done']:pg.wait_for_timeout(1800)
    s=S();check(s['page']=='done' and s['stars'].get('tenor:0',0)>=2,f'lesson done: {s["stars"].get("tenor:0")} stars ({s["mis"]} slips)')
    look();pg.screenshot(path=D+'5-done.png')
    pg.evaluate("VR.cls.open(1)");check(S()['page']=='lesson' and S()['L']==1,'two stars open lesson 2')
    # the rhythm lesson and the chords (all lessons open for this part)
    pg.evaluate("localStorage.setItem('panyard-vr-cls',JSON.stringify(Object.fromEntries([...Array(9).keys()].flatMap(i=>[['tenor:'+i,3],['dsec:'+i,3]]))))")
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000);pg.evaluate("document.getElementById('hud').hidden=true")
    check(pg.evaluate("JSON.parse(localStorage.getItem('panyard-vr-cls'))['tenor:0']")==3,'stars are kept on the headset')
    pg.evaluate("VR.cls.act('clsgo')");pg.evaluate("VR.cls.open(5)");pg.evaluate("VR.cls.act('clsnext')");s=S()
    check(s['t']=='beat','Keeping time: a beat step')
    pg.evaluate("VR.cls.act('clsbeat')");T=pg.evaluate("VR.cls.beatTimes()")
    n0=pg.evaluate('VR.cls.now()');check(len(T)==8 and abs((T[1]['t']-T[0]['t'])-.75)<.01 and 2.5<T[0]['t']-n0<4,f'♩ = 80 after a four-click count-in: 8 notes, a beat apart')
    for e in T:pg.evaluate(f"VR.cls.hitAt('{e['ids'][0]}',{e['t']}+0.05)")   # every note 50 ms late: still in time
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=20000);s=S()
    check(s['beat']['ok']==8 and 'Great' in s['msg'],f'every note in time counts ({s["msg"]})')
    pg.evaluate("VR.cls.act('clsagain')");T=pg.evaluate("VR.cls.beatTimes()")
    for e in T[::2]:pg.evaluate(f"VR.cls.hitAt('{e['ids'][0]}',{e['t']}+0.3)")   # too late
    for e in T[1::2]:pg.evaluate(f"VR.cls.hitAt('{e['ids'][0]}',{e['t']})")
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=20000);s=S()
    check(s['beat']['ok']==4 and 'again' in s['msg'].lower(),f'notes 0.3 s late don\'t count: {s["beat"]["ok"]} of 8 ({s["msg"]})')
    # two notes together
    pg.evaluate("VR.cls.open(6)");pg.evaluate("VR.cls.act('clsnext')");s=S();ids=s['item']['ids']
    check(s['t']=='play' and len(ids)==2,f'Two notes at once: a pair {ids}')
    t0=pg.evaluate('VR.cls.now()');pg.evaluate(f"VR.cls.hitAt('{ids[0]}',{t0})");s=S();check(s['k']==0 and 'other' in s['msg'],'one note waits for the other')
    pg.evaluate(f"VR.cls.hitAt('{ids[1]}',{t0}+.05)");check(S()['k']==1,'both together move on')
    # chords: two notes each, close together on the pan
    pg.evaluate("VR.cls.open(7)");pg.evaluate("VR.cls.act('clsnext')");pg.evaluate("VR.cls.act('clsnext')");s=S()
    v=pg.evaluate("[[0,4,7],[5,9,0],[7,11,2]].map(t=>VR.cls.voicing(t,'tenor'))")
    third={0:4,1:9,2:11};check(s['t']=='play' and all(len(x)==2 and third[i] in {m%12 for m in x} and x[1]-x[0]<=9 for i,x in enumerate(v)),f'chords are voiced two notes at a time on the tenor: C {v[0]}, F {v[1]}, G {v[2]}')
    look();pg.screenshot(path=D+'6-chords.png')
    # double seconds
    pg.evaluate("VR.cls.set('dsec')");pg.wait_for_timeout(500);s=S()
    check(s['set']=='dsec' and pg.evaluate("VR.state().set")=='dsec','Double seconds: the class goes to your double seconds')
    h=pg.evaluate("VR.cls.hint('dsec:61','dsec:60')");check('C♯ pan' in h and 'C♯' in h,f'hints point to the right pan: "{h}"')
    vd=pg.evaluate("[[0,4,7],[5,9,0],[7,11,2]].map(t=>VR.cls.voicing(t,'dsec'))")
    sides=pg.evaluate(f"{json.dumps(vd)}.map(v=>v.map(m=>VR.notes().includes('dsec:'+m)))")
    check(all(len(x)==2 and third[i] in {m%12 for m in x} and x[1]-x[0]<=9 for i,x in enumerate(vd)),f'double seconds chords: C {vd[0]}, F {vd[1]}, G {vd[2]}')
    drum=pg.evaluate("m=>SETS_DRUM(m)") if False else None
    pg.evaluate("VR.cls.open(0)");pg.evaluate("VR.cls.act('clsnext')");said=' '.join(pg.evaluate("VR.said"))
    check('C pan' in said and 'C sharp pan' in said,'its lesson 1 explains the notes over two pans')
    look();pg.screenshot(path=D+'7-dsec.png')
    # out
    pg.evaluate("VR.cls.act('clsx')");pg.wait_for_timeout(300);s=S()
    check(not s['on'] and not s['board'] and s['studio'] and s['door'] and not pg.evaluate("VR.cls.glow()"),'✕ Leave: the studio is back, the chalkboard waits in the yard')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
