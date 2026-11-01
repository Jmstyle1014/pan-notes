import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR's sticks, shaped after the owner's stick kit: flat rubber caps (lathed, wider than the stick) on tenor,
# double second, guitar and cello sticks, oval ribbed blue heads on the basses; the rubber squashes on a hit and comes
# back to exactly its shape; tenor caps can be red or black.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrsticks/';os.makedirs(D,exist_ok=True)
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
    pg=b.new_page(viewport={'width':1100,'height':700});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{localStorage.setItem('panyard-vr-yard','0')}catch(e){}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=90000)
    for k in ['tenor','dsec','guitar','fcello']:
        sh=pg.evaluate(f"VR.stickShape('{k}')");check(sh['lathe']==1 and sh['oval']==0,f'{k}: a flat lathed rubber cap {sh}')
    sh=pg.evaluate("VR.stickShape('six')");check(sh['oval']==1 and sh['lathe']==0 and abs(sh['R']-.041)<1e-6,f'six bass: an oval rubber head {sh}')
    caps=[pg.evaluate(f"VR.stickShape('{k}').R") for k in ['tenor','dsec','guitar','fcello']];check(caps==sorted(caps),f'caps get bigger from tenor to cello {caps}')
    for k in ['tenor','six']:
        q=pg.evaluate(f"VR.squashOf('{k}')");check(q['lo']<.97 and q['end']==[1,1,1],f'{k}: the rubber squashes on a hit ({q["lo"]}) and comes back exactly')
    # the bounce and the hit are unchanged
    for k,nid in [('tenor','tenor:72'),('six','six:40')]:
        pg.evaluate(f"VR.set('{k}')");fr=pg.evaluate(f"VR.pushStick('{nid}',.08)");deep=max(f['below'] for f in fr);hit=[f['hit'] for f in fr if f['hit']]
        check(deep<=2.5 and hit==[nid],f'{k}: the stick still rests on the steel ({deep} mm) and the hit plays once {hit}')
    pg.evaluate("VR.set('tenor')");pg.click('#capSeg [data-cap=black]');check(pg.evaluate("localStorage.getItem('panyard-vr-tenorcap')")=='black','Tenor caps: black is kept')
    pg.click('#capSeg [data-cap=red]')
    pg.evaluate("document.getElementById('hud').hidden=true;VR.lineup()");pg.wait_for_timeout(700);pg.screenshot(path=D+'sticks.png')
    # notes to the rim: the outer notes come within about 1.4 cm of the rim (half the drawing's gap), and still play
    pg.evaluate("VR.lineup&&VR.scene.remove(VR.scene.getObjectByName('lineup'));VR.set('tenor');VR.view('pans');VR.camera.position.set(0,1.45,-.12);VR.camera.lookAt(0,.9,-.5)")
    g1=pg.evaluate("VR.rimGap()");pg.wait_for_timeout(600);pg.screenshot(path=D+'notes-close.png')
    pg.evaluate("VR.setFill(false);VR.camera.position.set(0,1.45,-.12);VR.camera.lookAt(0,.9,-.5)");g0=pg.evaluate("VR.rimGap()");pg.wait_for_timeout(600);pg.screenshot(path=D+'notes-as-drawn.png')
    check(g0[0]>2.5 and 1.2<g1[0]<1.5,f'tenor: the gap to the rim goes from {g0[0]} cm to {g1[0]} cm')
    pg.evaluate("VR.setFill(true)");ids=pg.evaluate("VR.notes()");bad=[i for i in ids if pg.evaluate(f"VR.swing('{i}',2.5)")!=i or pg.evaluate(f"VR.noteAt('{i}')")!=i]
    check(not bad,f'every tenor note is still found where it\'s drawn and plays ({len(ids)} notes, bad {bad})')
    for k in ['dsec','guitar']:
        pg.evaluate(f"VR.set('{k}')");g=pg.evaluate("VR.rimGap()");check(all(1.2<x<1.5 for x in g),f'{k}: its drums too {g}')
    # the sticks' weights: the same swing plays a heavy bass stick louder than a light tenor one; light sticks flick up higher and come back sooner
    pg.evaluate("VR.setFill(true)")
    res={}
    for k in ['tenor','dsec','six']:
        pg.evaluate(f"VR.set('{k}')");nid=pg.evaluate("VR.notes()")[3];res[k]=pg.evaluate(f"VR.weighed('{nid}',2.0)")
    print(res)
    check(res['tenor']['v']<res['dsec']['v']<res['six']['v'],f"the same 2 m/s swing: tenor {res['tenor']['v']}, double second {res['dsec']['v']}, six bass {res['six']['v']} (heavier sticks play louder)")
    check(res['tenor']['flick']>res['six']['flick'] and res['tenor']['back']<res['six']['back'],f"light tenor sticks flick up higher ({res['tenor']['flick']} vs {res['six']['flick']} rad) and come back sooner ({res['tenor']['back']} vs {res['six']['back']} s)")
    check(not errs,'no page errors '+str(errs[:3]))
    b.close()
print('PASS' if not fails else 'FAILED: '+'; '.join(fails));sys.exit(1 if fails else 0)
