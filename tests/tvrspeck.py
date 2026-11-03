import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR: no black specks on the pans (the owner's headset video). The bowls are drawn top side only, their light comes
# from a slightly smoothed surface (no normal tips over or points into the steel; far stations smoother), the camera's near
# plane is 5 cm (depth precision), and the surface pictures use the best texture filtering.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrspeck/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1280,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000);pg.evaluate("document.getElementById('hud').hidden=true")
    for k in ['fcello','tcello','guitar','dsec']:pg.evaluate(f"VR.set('{k}')");pg.wait_for_timeout(300)
    r=pg.evaluate("""(()=>{const out=[];VR.scene.traverse(o=>{if(!o.isMesh||!o.geometry||o.geometry.type!=='RingGeometry'||!o.material.map)return;const n=o.geometry.getAttribute('normal');let minY=1,bad=0,jit=0,c=0;
      for(let i=0;i<n.count;i++){const x=n.getX(i),y=n.getY(i),z=n.getZ(i),L=Math.hypot(x,y,z);if(!(Math.abs(L-1)<1e-3))bad++;minY=Math.min(minY,y);if(i&&i%3===0){const d=x*n.getX(i-1)+y*n.getY(i-1)+z*n.getZ(i-1);jit+=Math.acos(Math.min(1,d));c++}}
      out.push({front:o.material.side===VR.THREE.FrontSide,bad,minY:+minY.toFixed(3),jit:+(jit/c*180/Math.PI).toFixed(3),aniso:o.material.map.anisotropy})});return out})()""")
    check(len(r)>=10,f'{len(r)} bowls checked')
    check(all(x['front'] for x in r),'every bowl is drawn top side only')
    check(all(x['bad']==0 for x in r),'every bowl\'s light directions are whole (none zero or broken)')
    check(min(x['minY'] for x in r)>.5,f'none tips over or points into the steel (the steepest {min(x["minY"] for x in r)})')
    print('neighbour angle (degrees) per bowl',[x['jit'] for x in r])
    check(max(x['jit'] for x in r)<2.5,f'the shine changes gently from point to point (at most {max(x["jit"] for x in r)}° between neighbours)')
    check(all(x['aniso']>=1 for x in r),'the steel pictures use the best filtering the browser offers')
    check(pg.evaluate("VR.camera.near")==.05,'the camera\'s near plane is 5 cm')
    pg.evaluate("VR.camera.position.set(0,2.4,3.2);VR.camera.lookAt(0,.7,-1)");pg.wait_for_timeout(700);pg.screenshot(path=D+'yard.png')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
