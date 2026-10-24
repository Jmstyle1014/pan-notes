import os,sys
import numpy as np
from playwright.sync_api import sync_playwright
# Note covers (How you play): like the soft pads in the G-Pan patent's claim 14, notes on the outer and middle rings
# of the tenor, double tenor and double seconds start rounder; centre notes and other pans are unchanged.
D=os.environ['WORK']+'/tcovers/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'tyard.py')).read().split('REC="""')[1].split('"""')[0]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300)
    ids=pg.evaluate("""async()=>{isDemo=false;S.panSet='dten';applyPanSet();panCtx();const f=[...FIELDS.entries()].filter(([k,v])=>v.set==='dten'),o=f.find(([k,v])=>/outer/.test(v.pos))[0],c=f.find(([k,v])=>/centre/.test(v.pos))[0];
      const sr=44100;for(const id of [o,c]){const hz=pitchHz(id),d=new Float32Array(sr);for(let i=0;i<d.length;i++){const t=i/sr;d[i]=.5*Math.exp(-t*3)*(Math.sin(2*Math.PI*hz*t)+.5*Math.sin(4*Math.PI*hz*t)+.4*Math.sin(6*Math.PI*hz*t)+.3*Math.sin(2*Math.PI*hz*7.3*t)*Math.exp(-t*40))}
        SAMPLES.wav[id]=encodeWav24(d,sr);delete SAMPLES.buf[id];await sampleBuf(id)}S.panVoice='mine';return [o,c]}""")
    def hit(id):
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate("id=>strike(id,.95)",id);pg.wait_for_timeout(700);pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate");x=x[np.argmax(abs(x)>0.05*abs(x).max()):]
        E=lambda y:10*np.log10((y**2).mean()+1e-12);d=np.diff(x)
        # the start against the ring a moment later, so loudness and timing don't matter: bite = sharpness of the start
        return E(x[:int(.015*sr)])-E(x[int(.15*sr):int(.3*sr)]),E(d[:int(.015*sr)])-E(d[int(.15*sr):int(.3*sr)]),E(x[int(.15*sr):int(.3*sr)])-E(x[int(.3*sr):int(.45*sr)])
    check(pg.evaluate("ids=>[BAND.covered(ids[0]),BAND.covered(ids[1])]",ids)==[False,False],'off by default')
    o0,c0=hit(ids[0]),hit(ids[1])
    pg.evaluate("()=>{TW.open(true);TW.tabTo('sound')}");pg.wait_for_timeout(500)
    check(pg.locator('#feelCovers').count()==1,'How you play has Note covers');pg.evaluate("$('feelCovers').scrollIntoView({block:'center'})");pg.screenshot(path=D+'1-card.png')
    pg.evaluate("$('feelCovers').click()");pg.wait_for_timeout(600);pg.evaluate("$('twClose').click()");pg.wait_for_timeout(300)
    check(pg.evaluate("ids=>[BAND.covered(ids[0]),BAND.covered(ids[1])]",ids)==[True,False],'covers the outer ring, not the centre')
    o1,c1=hit(ids[0]),hit(ids[1]);print('outer off/on',o0,o1,'centre off/on',c0,c1)
    check(o1[1]<o0[1]-3,f'an outer note starts softer and rounder (bite {o0[1]:.1f} → {o1[1]:.1f} dB)')
    check(abs(o1[2]-o0[2])<2.5,f'and rings on just as long ({o0[2]:.1f} / {o1[2]:.1f})')
    check(abs(c1[1]-c0[1])<1.5,f'a centre note is unchanged (bite {c0[1]:.1f} → {c1[1]:.1f})')
    check(pg.evaluate("[...FIELDS.keys()].filter(k=>/^six:/.test(k)).every(k=>!BAND.covered(k))"),'basses are never covered')
    check(pg.evaluate("JSON.parse(localStorage.getItem('panyard-feel')).covers")==True,'kept on this phone')
    check(not errs,f'no errors {errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
