import os,sys
import numpy as np
from playwright.sync_api import sync_playwright
# Drum body (Band sound): each pan's barrel hums at its own note, f = 343 / (4 (L + 0.3 d)), from its skirt length.
# With it on, a note gets a lift round its pan's body note (low for the basses, higher for the tenor), never clips,
# and it's part of Our yard.
D=os.environ['WORK']+'/tbody/';os.makedirs(D,exist_ok=True)
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
    body=pg.evaluate("BAND.BODY");print('body notes',body)
    check(body['six']<body['fcello']<body['guitar']<body['dsec']<body['tenor'] and 75<body['six']<90 and 250<body['tenor']<280,'longer skirts hum lower: the bass about 83 Hz, the tenor about 265 Hz')
    # a burst of noise as the recorded note (energy at every pitch), so the lift shows the body alone; hum, air and shimmer off
    ids=pg.evaluate("""async()=>{isDemo=false;panCtx();const pick=s=>[...FIELDS.entries()].find(([k,v])=>v.set===s)[0],ids=[pick('six'),pick('tenor')],sr=44100;let seed=3;const rnd=()=>(seed=seed*16807%2147483647)/2147483647-.5;
      for(const id of ids){const hz=pitchHz(id),d=new Float32Array(sr);for(let i=0;i<d.length;i++){const t=i/sr;d[i]=.5*rnd()*Math.exp(-t*4)}
        SAMPLES.wav[id]=encodeWav24(d,sr);delete SAMPLES.buf[id];await sampleBuf(id)}S.panVoice='mine';BAND.use('ouryard');for(const k of ['hum','shimmer','air'])BAND.edit(k,0);return ids}""")
    pg.wait_for_timeout(3500)
    check(pg.evaluate("BAND.forSong().body")==6,'Our yard has the drum body on')
    def spec(id,amt):
        pg.evaluate("a=>BAND.edit('body',a)",amt);pg.wait_for_timeout(200)
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate("id=>strike(id,.95)",id);pg.wait_for_timeout(900);pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate");x=x[np.argmax(abs(x)>0.01):][:int(.6*sr)]
        S=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2;f=np.fft.rfftfreq(len(x),1/sr)
        band=lambda lo,hi:10*np.log10(S[(f>=lo)&(f<hi)].mean()+1e-20);return band,float(abs(x).max())
    for id,k in zip(ids,['six','tenor']):
        fb=body[k];b0,p0=spec(id,0);b1,p1=spec(id,10)
        lift=(b1(fb*.85,fb*1.15)-b0(fb*.85,fb*1.15))-(b1(2000,4000)-b0(2000,4000))
        print(k,'body',fb,'lift dB',round(lift,1),'peaks',round(p0,2),round(p1,2))
        check(lift>3,f'{k}: a {lift:.1f} dB lift round its body note ({fb} Hz) compared with the high end')
        check(p1<1.0,f'{k}: no clipping ({p1:.2f})')
    pg.evaluate("()=>{TW.open(true);TW.tabTo('sound')}");pg.wait_for_timeout(600)
    check(pg.locator('#band-body').count()==1,'Band sound has a Drum body slider');pg.evaluate("$('band-body').scrollIntoView({block:'center'})");pg.screenshot(path=D+'1-slider.png')
    check(not errs,f'no errors {errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
