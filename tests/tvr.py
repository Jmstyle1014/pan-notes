import os,sys
import numpy as np
from playwright.sync_api import sync_playwright
# Panyard VR: the band's tenor in a headset's browser. Every note's place on the 3D pan finds that note, the band's
# recordings load (A 441), a stick swung down through a note plays it (harder swing = louder), a stick that stays
# down doesn't play again until it lifts, and off the headset a tap on a note plays it.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvr/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    if u.startswith('band/band-sounds/'):f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1])
    else:f=os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""
def grab(pg,js,ms=1200):
    pg.wait_for_timeout(900);pg.evaluate("()=>{window._rec=[];window._on=1}");r=pg.evaluate(js);pg.wait_for_timeout(ms);pg.evaluate("()=>window._on=0")
    n=pg.evaluate("window._rec.length");return r,(np.concatenate([np.array(x) for x in pg.evaluate("window._rec")]) if n else np.zeros(1))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':892,'height':600},device_scale_factor=1);ctx.add_init_script(REC)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=29",timeout=60000)
    check(pg.evaluate("VR.ready()")==29,'the band\'s 29 tenor notes are loaded')
    check('Ready' in pg.inner_text('#status'),'it says the sounds are ready: '+pg.inner_text('#status'))
    ids=pg.evaluate("VR.notes()");bad=[i for i in ids if pg.evaluate(f"VR.noteAt('{i}')")!=i]
    check(len(ids)==29 and not bad,f'every note\'s place on the pan finds that note {bad}')
    pg.screenshot(path=D+'1-page.png')
    r1,x1=grab(pg,"VR.swing('tenor:60',3.2)")
    check(r1=='tenor:60' and abs(x1).max()>.05,f'a full swing down through low C plays it (peak {abs(x1).max():.2f})')
    r2,x2=grab(pg,"VR.swing('tenor:76',.6)")
    check(r2=='tenor:76' and .005<abs(x2).max()<abs(x1).max(),f'a gentle swing plays E softer (peak {abs(x2).max():.2f})')
    check(abs(x1).max()<1,'no clipping')
    hv=pg.evaluate("VR.hits.slice(-2).map(h=>h.v)");check(hv[0]>hv[1],f'harder swing, harder hit {hv}')
    # the tip resting on the note doesn't keep playing; lifting it and hitting again does
    n0=pg.evaluate("VR.hits.length")
    k0=pg.evaluate("VR.hits.length");pg.evaluate("VR.swing('tenor:64',2.5)");check(pg.evaluate("VR.hits.length")==k0+1,'one swing through the steel is one hit (resting on it doesn\'t play again)')
    again=pg.evaluate("""(()=>{const out=[];const id='tenor:67';out.push(VR.swing(id,2));return out})()""")
    check(again==['tenor:67'],'another note plays')
    # a tap with the mouse (off the headset)
    pg.evaluate("document.getElementById('hud').hidden=true");xy=pg.evaluate("VR.screenOf('tenor:72')")
    pg.mouse.click(*xy);pg.wait_for_timeout(300)
    check(pg.evaluate("VR.hits.length")>n0+1,f'a tap on the pan plays a note {pg.evaluate("VR.hits.slice(-1)")}')
    pg.set_viewport_size({'width':1200,'height':800});pg.wait_for_timeout(300);pg.evaluate("VR.demo()");pg.wait_for_timeout(600)
    pg.screenshot(path=D+'2-pan.png')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
