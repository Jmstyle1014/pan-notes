import os,sys
import numpy as np
from playwright.sync_api import sync_playwright
# Panyard VR: every pan. The Double Tenor, Four and Three Cello, Six and Seven Bass stand round you as the app draws them;
# every note is found where it's drawn and plays (the ones nobody recorded borrow the nearest recorded note, retuned);
# each pan has its own sticks; and a stick never goes into the steel: it rests on it, the hit still plays, and it flicks up.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrpans/';os.makedirs(D,exist_ok=True)
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
    pg=b.new_page(viewport={'width':1100,'height':760});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=125&&VR.drums()>0",timeout=90000)
    check(pg.evaluate("VR.ready()")==125,'all the band\'s 125 recorded notes are loaded')
    pg.evaluate("document.getElementById('hud').hidden=true")
    for k,n,nd in [('dten',29,2),('fcello',28,4),('tcello',21,3),('six',18,6),('seven',21,7)]:
        pg.evaluate(f"VR.set('{k}')");pg.wait_for_timeout(200)
        ids=pg.evaluate("VR.notes()");bad=[i for i in ids if pg.evaluate(f"VR.noteAt('{i}')")!=i]
        played=[i for i in ids if pg.evaluate(f"VR.swing('{i}',2.5)")==i]
        heard=[i for i in ids if pg.evaluate(f"!!VR.borrow('{i}')")]
        check(pg.evaluate("VR.state().drums")==nd and len(ids)==n and not bad and len(played)==n and len(heard)==n,f'{k}: {nd} drums, all {n} notes found where drawn, every one plays when hit ({len(played)}) and has a sound ({len(heard)})')
        check(pg.evaluate("VR.sticks()")==[k,k],f'{k}: both hands hold {k} sticks')
        pg.evaluate("VR.bring()");pg.evaluate("VR.camera.position.set(0,1.95,1.25);VR.camera.lookAt(0,.75,-.25)");pg.wait_for_timeout(500);pg.screenshot(path=D+f'{k}.png')
    bw=pg.evaluate("[VR.borrow('dten:57'),VR.borrow('seven:32'),VR.borrow('six:34')]")
    check(bw[0] and bw[0]['id'].startswith('tenor') and bw[1] and bw[1]['id'].startswith('six') and bw[2]['shift']==0,f'unrecorded notes borrow from the pans the band says (double tenor from tenor, seven bass from six bass), recorded ones play as they are {bw}')
    # the bounce
    for k,nid in [('tenor','tenor:72'),('six','six:40')]:
        pg.evaluate(f"VR.set('{k}')");fr=pg.evaluate(f"VR.pushStick('{nid}',.08)")
        deep=max(f['below'] for f in fr);hit=[f['hit'] for f in fr if f['hit']]
        check(deep<=2.5,f'{k}: the stick tip stays on the steel while the hand goes 8 cm further down (deepest {deep} mm)')
        check(hit==[nid],f'{k}: and the hit still plays once ({hit})')
        check(fr[-1]['bend']>-.22+.05,f'{k}: the stick bends back from the hand (to {fr[-1]["bend"]} rad)')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
