import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR classroom demonstrations at your own pace: a demo waits for the voice to finish, plays a note every 0.9 s
# at 1× (twice as slow at ½), shows each note's name on the board as it plays (not in ear questions), and 🔁 Replay
# plays it again; the speed buttons sit on every lesson step.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrdemo/';os.makedirs(D,exist_ok=True)
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
    prog={f'tenor:{i}':3 for i in range(10)}
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-cls-voice','0');localStorage.setItem('panyard-vr-cls',"+json.dumps(json.dumps(prog))+");sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000);pg.evaluate("document.getElementById('hud').hidden=true")
    S=lambda:pg.evaluate("VR.cls.state()")
    pg.evaluate("VR.cls.start();VR.cls.level(1)")
    # find a say step with a demonstration of single notes
    spot=None
    for L in range(9):
        for St in range(6):
            try:pg.evaluate(f"VR.cls.go({L},{St})")
            except Exception:break
            st=pg.evaluate("VR.cls.step()")
            if st and st['t']=='say' and st['demo']:spot=(L,St);break
        if spot:break
    check(spot is not None,f'a Level 1 step with a demonstration {spot}')
    pg.evaluate(f"VR.cls.go({spot[0]},{spot[1]})");check(S()['demoTimes'] in (None,[]),'the demo doesn\'t start over the voice')
    pg.wait_for_function("VR.cls.state().demoNow",timeout=5000);s=S();gaps=[round(b-a,2) for a,b in zip(s['demoTimes'],s['demoTimes'][1:])]
    check(all(g>=.89 for g in gaps),f'at 1× a note every 0.9 s or more (chords 1.4) {gaps}')
    check(s['demoNow'] and s['demoNow']!='♪',f'the board shows the note being played: "{s["demoNow"]}"')
    pg.evaluate("(()=>{const bd=VR.cls.boardAt();VR.camera.position.set(bd[0],bd[1]+.05,bd[2]+.9);VR.camera.lookAt(bd[0],bd[1]-.1,bd[2])})()");pg.wait_for_timeout(300);pg.screenshot(path=D+'1-demo.png')
    pg.evaluate("VR.cls.act('clsspd:0.5')");pg.evaluate("VR.cls.act('clsagain')");s=S();g2=[round(b-a,2) for a,b in zip(s['demoTimes'],s['demoTimes'][1:])]
    check(len(g2)==len(gaps) and all(abs(b-2*a)<.02 for a,b in zip(gaps,g2)),f'🔁 Replay at ½ speed plays it again twice as slowly {g2}')
    pg.evaluate("VR.cls.act('clsspd:1')")
    # an ear question doesn't give the answer away
    pg.evaluate("localStorage.setItem('panyard-vr-cls',JSON.stringify(Object.fromEntries([...Array(11).keys()].map(i=>['tenor:2:'+i,3]))));VR.cls.level(2)");ear=None
    for L in range(9):
        for St in range(7):
            try:pg.evaluate(f"VR.cls.go({L},{St})")
            except Exception:break
            it=S()['item']
            if it and it.get('hear'):ear=(L,St);break
        if ear:break
    check(ear is not None,f'a Level 2 ear question {ear}')
    if ear:
        pg.evaluate(f"VR.cls.go({ear[0]},{ear[1]})");pg.wait_for_function("VR.cls.state().demoNow",timeout=8000)
        check(S()['demoNow']=='♪',f'an ear question shows only ♪ while it plays ({ear})')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
