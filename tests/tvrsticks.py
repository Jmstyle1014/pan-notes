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
    check(not errs,'no page errors '+str(errs[:3]))
    b.close()
print('PASS' if not fails else 'FAILED: '+'; '.join(fails));sys.exit(1 if fails else 0)
