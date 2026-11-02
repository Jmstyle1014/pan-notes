import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR classroom, Level 3 (playing in the band, and composing), on every pan: each pan's role and its lessons, the
# two original calypso tunes read off the staff (bass clef for cellos and basses) and fitted to every pan's range, dotted
# rhythms, dynamics (soft and loud by the swing) and a growing roll, write steps that record what you play into your piece
# (quantized to eighths), choosing the piece's key, the 🎼 My piece page (hear it with the whole yard, save it to My songs),
# and the Level 3 test, which saves the piece.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrclass3/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
SETS=['tenor','dten','dsec','guitar','fcello','tcello','six','seven']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    prog={f'{k}:3:{i}':3 for k in SETS for i in range(10)}
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-cls',"+json.dumps(json.dumps(prog))+");sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:(pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000),pg.evaluate("document.getElementById('hud').hidden=true"))
    pg.goto('https://pan.test/vr/');load()
    S=lambda:pg.evaluate("VR.cls.state()")
    import math
    def look():
        bd=pg.evaluate("VR.cls.boardAt()");pa=pg.evaluate("VR.studioAt()")['pans'];dx,dz=pa[0]-bd[0],pa[2]-bd[2];n=math.hypot(dx,dz)
        pg.evaluate(f"VR.camera.position.set({pa[0]+dx/n*.55},{bd[1]+.05},{pa[2]+dz/n*.55});VR.camera.lookAt({bd[0]},{bd[1]-.25},{bd[2]})");pg.wait_for_timeout(450)
    def shot(name):
        pg.evaluate("VR.cls.act('clsvoice');VR.cls.act('clsvoice')");look();pg.screenshot(path=D+name)
    hit=lambda i,t=None,v=.8:pg.evaluate(f"VR.cls.hitAt('{i}',{t if t is not None else 'VR.cls.now()'},{v})")
    def run_beat(play=None):
        pg.evaluate("VR.cls.act('clsbeat')");C=pg.evaluate("VR.cls.clock()")
        if play:play(C)
        pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=90000);return S()
    pg.evaluate("VR.cls.start();VR.cls.level(3)");s=S()
    check(s['lvl']==3 and len(s['lessons'])==10 and s['lessons'][-1][0].startswith('Level 3 test'),f'Level 3: 9 lessons and the test {[l[0] for l in s["lessons"]]}')
    shot('1-home.png')
    # every pan: its lessons build, its part of Yard Lime fits it, the tunes fit its range
    for k in SETS:
        pg.evaluate(f"VR.cls.set('{k}')");s=S()
        check(s['set']==k and len(s['lessons'])==10,f'{k}: Level 3 has its 10 lessons')
        rng=pg.evaluate(f"VR.cls.range('{k}')")
        for role in ['lead','harm','strum','bass']:
            ns=pg.evaluate(f"VR.cls.arrange('{k}','{role}')")
            ok=len(ns)>0 and all(n['id'] and (n['id'].startswith(k+':') or k=='guitar') for n in ns)
            check(ok,f'{k}: Yard Lime arranged as {role} ({len(ns)} notes, all on the {k})')
        pg.evaluate("VR.cls.go(0,1)");st=pg.evaluate("VR.cls.step()")
        check(st['t']=='beat' and st['mel']>=6,f'{k}: lesson 1 reads Yard Lime ({st["mel"]} notes)')
    # tenor: melody reading, dotted rhythm timing
    pg.evaluate("VR.cls.set('tenor');VR.cls.go(0,1)")
    def allin(C):
        for x in pg.evaluate("VR.cls.beatInfo()"):
            hit(x['ids'][0],x['t']+.02)
    pg.evaluate("VR.cls.act('clsbeat')");B=pg.evaluate("VR.cls.beatInfo()");sp=pg.evaluate("VR.cls.clock()")['sp']
    rel=[round((x['t']-B[0]['t'])/sp,2) for x in B];ids=[x['ids'][0] for x in B]
    check(rel[:5]==[0,.5,1,2.5,3] and ids[:5]==['tenor:76','tenor:74','tenor:72','tenor:67','tenor:69'],f'Yard Lime bar 1: E D C. G A at {rel[:5]} {ids[:5]}')
    pg.wait_for_timeout(int((B[0]['t']-pg.evaluate("VR.cls.now()"))*1000)+600);shot('2-melody.png')
    for x in B:hit(x['ids'][0],x['t']+.02)
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=30000);s=S()
    check(s['beat']['ok']==s['beat']['n'],f'all {s["beat"]["n"]} melody notes in time ({s["msg"]})')
    # note names under the staff, and the next note's name while you play (🔤 Names, on by default)
    pg.evaluate("VR.cls.go(0,1)");pg.evaluate("VR.cls.act('clsbeat')");B=pg.evaluate("VR.cls.beatInfo()")
    pg.wait_for_timeout(int((B[0]['t']-pg.evaluate("VR.cls.now()"))*1000)+150);m=pg.evaluate("VR.cls.state().msg")
    check('Next: E' in m or 'Next: D' in m,f'while you play, the next note\'s name shows: "{m}"');shot('2b-names.png')
    pg.evaluate("VR.cls.act('clsnames')");check(pg.evaluate("localStorage.getItem('panyard-vr-cls-names')")=='0','🔤 Names off is remembered')
    pg.wait_for_timeout(300);shot('2c-no-names.png');pg.evaluate("VR.cls.act('clsnames')")
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=30000)
    pg.evaluate("VR.cls.go(1,1)");pg.evaluate("VR.cls.act('clsbeat')");B=pg.evaluate("VR.cls.beatInfo()");sp=pg.evaluate("VR.cls.clock()")['sp']
    rel=[round((x['t']-B[0]['t'])/sp,2) for x in B];check(rel==[0,1.5,3,4,5.5,6],f'"q. e Q q | q. e h" (the push) is read as {rel}')
    # dynamics
    pg.evaluate("VR.cls.go(2,1)")
    def dyn(C,wrong=False):
        for x in pg.evaluate("VR.cls.beatInfo()"):
            i=round((x['t']-C['t0'])/C['sp']);v=.3 if i<4 else .9
            if wrong and i==1:v=.9
            hit(x['ids'][0],x['t']+.02,v)
    s=run_beat(dyn);check(s['beat']['ok']==8,f'p p p p f f f f: soft and loud by the swing ({s["msg"]})')
    s=run_beat(lambda C:dyn(C,True));check(s['beat']['ok']==7 and 'wrong loudness' in s['msg'],f'a loud note where it says p is caught: "{s["msg"]}"')
    pg.evaluate("VR.cls.go(2,3)")
    def roll(C,grow):
        x=pg.evaluate("VR.cls.beatInfo()")[0];n=int((x['t2']-x['t'])*7);
        for j in range(n):hit(x['ids'][j%2],x['t']+j/7,(.3+.6*j/n) if grow else .7)
    s=run_beat(lambda C:roll(C,True));check(s['beat']['ok']==1,f'a roll that grows passes ({s["msg"]})')
    s=run_beat(lambda C:roll(C,False));check(s['beat']['ok']==0 and "didn't grow" in s['msg'],f'a flat roll is told to grow: "{s["msg"]}"')
    # composing: write a melody
    pg.evaluate("VR.cls.piece.reset();VR.cls.go(0,5)");st=pg.evaluate("VR.cls.step()");check(st['write']=='melody' and st['len']==16,'lesson 1 ends with writing your melody')
    MY=[('tenor:72',0),('tenor:76',.5),('tenor:79',1),('tenor:77',4),('tenor:76',5.5),('tenor:74',8),('tenor:71',9),('tenor:72',12)]
    def write(C,notes,off=0):
        for i,bb in notes:hit(i,C['t0']+(bb+off)*C['sp']+.04)
    s=run_beat(lambda C:write(C,MY));P=pg.evaluate("VR.cls.piece.get()")
    got=[(n['id'],n['b']) for n in P.get('melody',{}).get('notes',[])]
    check(got==MY,f'your melody is kept, quantized to eighths {got}');check('Saved your melody: 8 notes' in s['msg'],f'"{s["msg"]}"')
    shot('3-write.png')
    # the answer: only bars 5-8 count, after the band plays your call
    pg.evaluate("VR.cls.go(5,3)");st=pg.evaluate("VR.cls.step()")
    check(st['write']=='answer' and st['len']==32 and st['backing'] and st['backing'][0].startswith('tenor:'),f'Call and response: your melody is the call ({st["backing"]})')
    s=run_beat(lambda C:write(C,[('tenor:79',2),('tenor:76',16),('tenor:74',17),('tenor:72',20),('tenor:67',24),('tenor:72',28)]))
    P=pg.evaluate("VR.cls.piece.get()");check([n['b'] for n in P['answer']['notes']]==[16,17,20,24,28],f'the answer keeps only its own bars, in place: {[n["b"] for n in P["answer"]["notes"]]}')
    # the key
    pg.evaluate("VR.cls.go(8,3)");hit('tenor:67');check(pg.evaluate("VR.cls.piece.get()").get('key')=='G','Changing key: playing G puts your piece in G')
    T=pg.evaluate("VR.cls.piece.tune()");check(T['key']=='G' and T['chords'][:3]==['G','C','D7'] and T['ev'][0]['m']==79,f'the piece moves up a fifth {T["chords"][:4]} first note {T["ev"][0]["m"]}')
    pg.evaluate("VR.cls.go(8,3)");hit('tenor:60')
    # double seconds harmony, six bass line
    pg.evaluate("VR.cls.set('six');VR.cls.go(3,2)");st=pg.evaluate("VR.cls.step()");check(st['write']=='bass','six bass: Harmony under a melody writes your bass line')
    s=run_beat(lambda C:write(C,[('six:36',0),('six:43',1.5),('six:41',4),('six:36',5.5),('six:43',8),('six:40',9.5),('six:36',12)]))
    check('7 notes' in s['msg'] and '86% on a root or fifth' in s['msg'],f'the bass line is checked against the chords: "{s["msg"]}"')
    pg.evaluate("VR.cls.go(0,1)");shot('4-bassclef.png')
    pg.evaluate("VR.cls.set('dsec');VR.cls.go(4,2)");st=pg.evaluate("VR.cls.step()");check(st['write']=='minor','double seconds: Minor keys writes a minor section')
    s=run_beat(lambda C:write(C,[('dsec:69',0),('dsec:72',1),('dsec:74',4),('dsec:77',5),('dsec:76',8),('dsec:68',9),('dsec:69',12)]))
    T=pg.evaluate("VR.cls.piece.tune()");check(T['len']==48 and T['chords'][8:]==['Em','Am','B7','Em'],f'the minor section adds bars 9-12 (in G: {T["chords"][8:]})') if T['key']=='G' else check(T['len']==48 and T['chords'][8:]==['Am','Dm','E7','Am'],f'the minor section adds bars 9-12 {T["chords"][8:]}')
    # My piece
    pg.evaluate("VR.cls.act('clshome');VR.cls.act('clspiece')");s=S();check(s['page']=='piece','🎼 My piece opens');shot('5-piece.png')
    pg.evaluate("VR.cls.act('clspiece:hear')");st=pg.evaluate("VR.cls.step()")
    check(st and st['len']==48 and len(st['backing'])==5,f'▶ Hear my piece: the whole yard plays it ({st and st["backing"]})')
    pg.evaluate("VR.cls.act('clspiece:stop')")
    sv=pg.evaluate("VR.cls.piece.save()");names=[t['name'] for t in sv['tracks']]
    check(sv['title']=='My calypso' and sv['L']==48 and names==['Melody','Harmony','Strum','Bass','Drums'] and sv['tracks'][3]['set']=='six',f'💾 saved to My songs: {sv}')
    # the test performs the piece and saves it
    pg.evaluate("VR.cls.set('tenor');VR.cls.go(9,1)");st=pg.evaluate("VR.cls.step()")
    check(st['len']==48 and st['beats']>10 and len(st['backing'])==4,f'the test: you play your part, the yard the rest ({st})')
    pg.evaluate("VR.cls.act('clsbeat')")
    for x in pg.evaluate("VR.cls.beatInfo()"):
        for i in x['ids']:hit(i,x['t']+.02)
    pg.wait_for_function("VR.cls.state().page=='done'||(VR.cls.state().beat&&VR.cls.state().beat.over)",timeout=90000);pg.evaluate("VR.cls.act('clsnext')")
    s=S();check(s['page']=='done','the test is finished')
    songs=pg.evaluate("JSON.parse(localStorage.getItem('panyard-vr-songs')).map(e=>e.title)")
    check(songs[:2]==['My calypso 2','My calypso'] or songs[:2]==['My calypso','My calypso 2'] or 'My calypso 2' in songs,f'the test saves your piece to My songs {songs}')
    shot('6-done.png')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
