import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR studio sound packs: the Dunleavy Double Seconds (packs/dunleavy-dsec) load with four loudness layers per
# note; a soft hit plays the soft recording and a hard one the hard; the page and the menu switch between the band's own
# double second and the pack; the credit shows.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrpack/';os.makedirs(D,exist_ok=True)
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
    pg=b.new_page(viewport={'width':900,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{localStorage.setItem('panyard-vr-yard','0');localStorage.setItem('panyard-vr-set','dsec')}catch(e){}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.packs().dsec&&VR.packs().dsec.loaded===30",timeout=120000)
    pk=pg.evaluate("VR.packs()");check(pk['dsec']=={'on':True,'notes':30,'layers':4,'loaded':30},f'the studio double second loads: 30 notes, 4 loudness layers each, and plays by default {pk}')
    pg.evaluate("VR.hits.length=0;VR.strike('dsec:64',.15);VR.strike('dsec:64',.45);VR.strike('dsec:64',.7);VR.strike('dsec:64',1)")
    L=[h.get('layer') for h in pg.evaluate("VR.hits")];check(L==[0,1,2,3],f'soft to hard hits play the soft to hard recordings {L}')
    ids=pg.evaluate("VR.notes()");check(all(pg.evaluate(f"VR.swing('{i}',2.5)")==i for i in ids),'every note still plays when hit')
    pg.click('#packBox [data-snd="dsec:band"]');pg.evaluate("VR.hits.length=0;VR.strike('dsec:64',1)")
    check(not pg.evaluate("VR.packs()").get('dsec',{}).get('on') and 'layer' not in pg.evaluate("VR.hits")[0],'Our band\'s pans: back to the band\'s own recordings')
    check(pg.evaluate("localStorage.getItem('panyard-vr-snd-dsec')")=='band','and the choice is kept')
    pg.evaluate("VR.menu(true)");check('msnd' in pg.evaluate("VR.menuHits()"),'the menu has the sound switch at the double second');pg.evaluate("VR.press('menu','msnd')")
    check(pg.evaluate("VR.packs()")['dsec']['on'],'and it switches back to the studio pans');pg.evaluate("VR.menu(false)")
    check('CC BY 4.0' in pg.inner_text('#packBox') and 'Josh Quillen' in pg.inner_text('#packBox'),'the page credits the recording and its licence')
    pg.locator('#packBox').scroll_into_view_if_needed();pg.screenshot(path=D+'page.png')
    # the study tenor: there, but off until chosen (non-commercial, a test recording)
    pg.wait_for_function("VR.packs().tenor&&VR.packs().tenor.loaded===29",timeout=60000)
    check(pg.evaluate("VR.packs().tenor")=={'on':False,'notes':29,'layers':4,'loaded':29},'the study tenor loads (29 notes, 4 layers) but starts off: the band\'s tenor plays')
    pg.evaluate("VR.setSound('tenor','pack');VR.hits.length=0;VR.strike('tenor:69',.2);VR.strike('tenor:69',1)")
    check([h.get('layer') for h in pg.evaluate("VR.hits")]==[0,3] and 'CC BY-NC' in pg.inner_text('#packBox'),'chosen, it plays its layers; its non-commercial licence is shown')
    check(not errs,'no page errors '+str(errs[:3]))
    b.close()
print('PASS' if not fails else 'FAILED: '+'; '.join(fails));sys.exit(1 if fails else 0)
