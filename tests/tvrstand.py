import os,sys,json,math
from playwright.sync_api import sync_playwright
# Panyard VR's stands: tenors, double tenors, double seconds, guitars and cellos hang from three hooks above the rim by
# straps; a hit swings the pan a little (more near the edge, more for a harder hit, more for a light pan) and it settles;
# basses stand on the floor and don't sway; hits still land while a pan swings; the Pans sway switch.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrstand/';os.makedirs(D,exist_ok=True)
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
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-yard','0');localStorage.setItem('panyard-vr-welcomed','1');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:(pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000),pg.evaluate("document.getElementById('hud').hidden=true"))
    pg.goto('https://pan.test/vr/');load()
    sw=lambda:pg.evaluate("VR.sway()")
    pg.evaluate("VR.set('tenor')");pg.wait_for_timeout(400)
    st=pg.evaluate("VR.stand(0)")
    check(st['hang'] and st['shown'] and all(h>st['rim']+.03 for h in st['hooks']),f'tenor: three hooks above the rim {st}')
    check(all(.07<x<.14 for x in st['straps']),f'straps about 10 cm, hook to hole {st["straps"]}')
    def kick(nid,speed=2.5):
        pg.evaluate("VR.swaySet(0,0,0)");return pg.evaluate(f"(()=>{{const r=VR.swing('{nid}',{speed});const s=VR.sway()[0];return [r,Math.hypot(s.vx,s.vz)]}})()")
    ids=pg.evaluate("VR.notes()");pos=pg.evaluate("VR.notes().map(i=>VR.notePos?VR.notePos(i):null)")
    r1,e1=kick('tenor:60');r2,e2=kick('tenor:60',.8)
    check(r1=='tenor:60' and e1>0,f'a hit swings the tenor (impulse {e1:.3f})')
    check(e2<e1*.6,f'a gentler hit swings it less ({e2:.3f} vs {e1:.3f})')
    # near the middle vs the edge: the highest notes sit in the middle
    hi=sorted([i for i in ids if i.startswith('tenor:')],key=lambda i:-int(i.split(':')[1]))[0];r3,e3=kick(hi)
    check(r3==hi and e3<e1,f'a note near the middle ({hi}) swings it less than one at the edge ({e3:.3f} vs {e1:.3f})')
    kick('tenor:60',3.2);pg.wait_for_timeout(250);mx=max(abs(sw()[0]['sx']),abs(sw()[0]['sz']))
    check(0<mx<=.035,f'it moves by under 2 degrees ({math.degrees(mx):.2f}°)')
    pg.evaluate("VR.camera.position.set(0,1.35,.35);VR.camera.lookAt(0,.85,-.45)");pg.wait_for_timeout(300);pg.screenshot(path=D+'1-tenor-swing.png')
    s=pg.evaluate("VR.swayStep(2.5)")[0];check(abs(s['sx'])+abs(s['sz'])<.002,f'and settles within 2½ seconds ({s["sx"]:.4f}, {s["sz"]:.4f})')
    pg.screenshot(path=D+'2-tenor-still.png')
    # hits still land while it swings
    pg.evaluate("VR.swaySet(0,.03,-.03)");bad=[i for i in ids if i.startswith('tenor:') and pg.evaluate(f"(()=>{{VR.swaySet(0,.03,-.03);return VR.swing('{i}',2.5)}})()")!=i]
    check(not bad,f'every tenor note still plays while the pan is tipped 1.7° ({len(bad)} missed {bad[:4]})')
    # basses don't hang
    pg.evaluate("VR.set('six')");pg.wait_for_timeout(400);check(not pg.evaluate("VR.stand(0)")['hang'],'six bass stands on the floor, no straps')
    r=pg.evaluate("(()=>{const r=VR.swing('six:40',3);return [r,VR.sway().every(s=>!s.vx&&!s.vz)]})()");check(r[0]=='six:40' and r[1],'and a hit doesn\'t sway it')
    for k,mass in [('dsec',.75),('guitar',.45),('fcello',.35)]:
        pg.evaluate(f"VR.set('{k}')");pg.wait_for_timeout(400);st=pg.evaluate("VR.stand(0)");check(st['hang'],f'{k} hangs from its stand')
    pg.evaluate("VR.set('dsec')");pg.wait_for_timeout(300);pg.evaluate("VR.camera.position.set(0,1.4,.5);VR.camera.lookAt(0,.8,-.45)");pg.wait_for_timeout(300);pg.screenshot(path=D+'3-dsec.png')
    pg.evaluate("VR.set('guitar')");pg.wait_for_timeout(300);pg.evaluate("VR.camera.position.set(0,1.4,.55);VR.camera.lookAt(0,.8,-.45)");pg.wait_for_timeout(300);pg.screenshot(path=D+'4-guitar.png')
    # a lighter pan swings more for the same hit
    pg.evaluate("VR.set('tenor')");pg.wait_for_timeout(300);et=kick('tenor:60')[1]
    pg.evaluate("VR.set('fcello')");pg.wait_for_timeout(300);fid=sorted([i for i in pg.evaluate("VR.notes()") if i.startswith('fcello:')],key=lambda i:int(i.split(':')[1]))[0];ef=kick(fid)[1]
    check(0<ef<et,f'a four cello swings less than a tenor ({ef:.3f} vs {et:.3f})')
    # the switch
    pg.evaluate("VR.set('tenor');VR.swayOpt(false)");pg.wait_for_timeout(300);e=kick('tenor:60')[1]
    check(e==0 and pg.evaluate("localStorage.getItem('panyard-vr-sway')")=='0','Pans sway off: a hit leaves it still, and it\'s remembered')
    pg.evaluate("VR.swayOpt(true)")
    # the yard
    pg.evaluate("localStorage.setItem('panyard-vr-yard','1')");pg.reload();load();pg.wait_for_timeout(800)
    pg.evaluate("VR.camera.position.set(0,1.6,1.2);VR.camera.lookAt(0,.8,-2)");pg.wait_for_timeout(400);pg.screenshot(path=D+'5-yard.png')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
