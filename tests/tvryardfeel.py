import os,sys,json,math
from playwright.sync_api import sync_playwright
# Panyard VR's yard feels real: the sections stand closer (Close, the default, brings every section in by a third; Roomy is
# the old spacing) without any two overlapping, in Panorama and Rows; far sections are quieter by default (Even mix off) and
# each section is heard from its pans (pan height), not the floor.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvryardfeel/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
ALL=['tenor','dten','dsec','guitar','fcello','tcello','six','seven','kit']
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1280,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000);pg.evaluate("document.getElementById('hud').hidden=true")
    g=pg.evaluate("VR.yfeel.get()");check(g['space']=='close' and g['even']==False,f'to start: sections close, far sections quieter {g}')
    for k in ALL:pg.evaluate(f"VR.set('{k}')");pg.wait_for_timeout(250)
    pg.evaluate("VR.set('tenor')");pg.wait_for_timeout(300)
    for lay in ['pano','rows']:
        pg.evaluate(f"VR.yfeel.layout('{lay}')");pg.wait_for_timeout(300);st=pg.evaluate("VR.yfeel.st()")
        check(len(st)>=8 and max(x['clash'] for x in st)<=0,f'{lay}, close: every section out ({len(st)}) and none overlap (worst {max(x["clash"] for x in st)})')
        pos={x['k']:(x['x'],x['z']) for x in st}
        pg.evaluate("VR.yfeel.space('roomy')");pg.wait_for_timeout(300);pos2={x['k']:(x['x'],x['z']) for x in pg.evaluate("VR.yfeel.st()")}
        d1=math.dist(pos['tenor'],pos['guitar']);d2=math.dist(pos2['tenor'],pos2['guitar'])
        check(d1<d2*.8,f'{lay}: tenor to guitar is {d1:.2f} m close, {d2:.2f} m roomy')
        if lay=='pano':
            pg.evaluate("VR.camera.position.set(0,3.2,5);VR.camera.lookAt(0,.6,-.8)");pg.wait_for_timeout(500);pg.screenshot(path=D+'roomy.png')
        pg.evaluate("VR.yfeel.space('close')");pg.wait_for_timeout(300)
        if lay=='pano':
            pg.evaluate("VR.camera.position.set(0,3.2,5);VR.camera.lookAt(0,.6,-.8)");pg.wait_for_timeout(500);pg.screenshot(path=D+'close.png')
    pg.evaluate("VR.yfeel.layout('pano')");pg.evaluate("VR.swing(VR.notes()[3],2.5)");pg.wait_for_timeout(300)
    st=[x for x in pg.evaluate("VR.yfeel.st()") if x['bus']]
    check(st and all(.5<x['bus'][1]<1.3 for x in st),f'each section is heard from its pans, at pan height {[(x["k"],x["bus"][1]) for x in st]}')
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=90000);check(pg.evaluate("VR.yfeel.get().space")=='close','the spacing is remembered')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
