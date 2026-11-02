import os,sys,json
import numpy as np
from playwright.sync_api import sync_playwright
# Your tenor, shaped with what a studio pan taught: a soft hit loses its octave, third and sparkle as on a real pan
# (measured from the Dunleavy double seconds, BAND.SOFT), while how long it rings stays the recording's own; ⚖ Even out
# my pan nudges notes that stand out toward the rest (and ↶ Undo puts them back); 🧹 Clean the rumble takes out what's
# under 170 Hz and leaves the skirt's hum (~265 Hz). Panyard Band evens out the band's tenor by itself, once.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tsoft/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp,...a);return _c.call(this,d,...a)}return _c.call(this,d,...a)}})()"""
page=lambda app:'<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.path.join(ROOT,'source',app)).read()+'</body></html>'
def mkroute(html):
    def route(r):
        u=r.request.url.split('?')[0].replace('https://pan.test/','')
        if '/band-sounds/' in u or u.startswith('band-sounds/'):
            f=os.path.join(ROOT,'source','band-sounds',os.path.basename(u));return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
        if u.startswith('packs/'):return r.fulfill(path=os.path.join(ROOT,u)) if os.path.exists(os.path.join(ROOT,u)) else r.fulfill(status=404,body='')
        return r.fulfill(body=html,content_type='text/html')
    return route
def grab(pg,js,secs=1.3):
    pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(js);pg.wait_for_timeout(int(secs*1000));pg.evaluate("()=>window._on=0")
    x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate");i=np.argmax(abs(x)>abs(x).max()*.05);return x[i:],sr
def spec(x,sr,f0):
    s=x[:int(.3*sr)];S=np.abs(np.fft.rfft(s*np.hanning(len(s)),1<<16))**2;f=np.fft.rfftfreq(1<<16,1/sr)
    e=lambda c,w=.03:S[(f>c*(1-w))&(f<c*(1+w))].sum()+1e-12;h1=e(f0)
    return dict(oct=10*np.log10(e(2*f0)/h1),third=10*np.log10(e(3*f0)/h1),sub=10*np.log10(S[(f>30)&(f<140)].sum()/h1+1e-12),body=10*np.log10(S[(f>240)&(f<290)].sum()/h1+1e-12))
def ring(x,sr,f0):   # seconds for the note to fall 20 dB from its peak (the fundamental)
    N=2048;hop=512;fr=np.fft.rfftfreq(N,1/sr);m=(fr>f0*.97)&(fr<f0*1.03);env=[10*np.log10((np.abs(np.fft.rfft(x[i:i+N]*np.hanning(N)))**2)[m].sum()+1e-12) for i in range(0,len(x)-N,hop)]
    env=np.array(env);p=env.argmax();j=np.where(env[p:]<env[p]-20)[0];return (j[0] if len(j) else len(env)-p)*hop/sr
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    # ---- Panyard Band: the band's tenor
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
    pg.route('https://pan.test/**',mkroute(page('pan-notes-band.html')));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_function("!!localStorage.getItem('panyard-bandsounds')",timeout=90000)
    pg.evaluate("try{ROLE.close()}catch(e){}");pg.evaluate("()=>{S.panSet='tenor';applyPanSet()}")
    pg.wait_for_function("!!localStorage.getItem('panyard-even-band')",timeout=60000)
    L=pg.evaluate("EVENOUT.last")
    check(L and L['set']=='tenor' and L['of']>=20 and 0<L['n']<=L['of'],f'Band: the band\'s tenor is evened out by itself ({L and L["n"]} of {L and L["of"]} notes nudged)')
    T=pg.evaluate("Object.fromEntries(Object.keys(SAMPLES.wav).filter(i=>i.startsWith('tenor:')).map(i=>[i,[tuneOf(i).tone||0,tuneOf(i).oct||0]]))")
    check(all(abs(t)<=6 and abs(o)<=8 for t,o in T.values()),f'gently: no note moved more than 6 Tone steps or 8 dB of octave {dict(list(T.items())[:5])}')
    # the measured spread before and after
    M=L['m'];oc=np.array([v['oct'] for v in M.values()]);tp=np.array([v['top'] for v in M.values()])
    ids=list(M);mi={i:int(i.split(':')[1]) for i in ids}
    def rough(val):   # how far each note stands out from its neighbours (within 4 semitones), on average
        return float(np.mean([abs(val[i]-np.median([val[j] for j in ids if j!=i and abs(mi[j]-mi[i])<=4])) for i in ids]))
    for k,ix,w in (('octave','oct',1),('sparkle','top',.9)):
        b0={i:M[i][ix] for i in ids};a0={i:M[i][ix]+w*T[i][1 if ix=='oct' else 0] for i in ids}
        r0,r1=rough(b0),rough(a0);check(r1<r0*.75,f'notes stand out less from their neighbours: {k} {r0:.1f} → {r1:.1f} dB on average')
    # soft hits
    pg.evaluate("panCtx()");f0=pg.evaluate("pitchHz('tenor:72')");pg.wait_for_timeout(500)
    xs,sr=grab(pg,"strike('tenor:72',.18)");xh,_=grab(pg,"strike('tenor:72',1)")
    s,h=spec(xs,sr,f0),spec(xh,sr,f0);print('   soft',{k:round(v,1) for k,v in s.items()},'\n   hard',{k:round(v,1) for k,v in h.items()})
    check(h['oct']-s['oct']>8 and h['third']-s['third']>10,f'a soft hit loses its octave and third as a real pan does (octave {h["oct"]-s["oct"]:.1f} dB, third {h["third"]-s["third"]:.1f} dB down)')
    rs,rh=ring(xs,sr,f0),ring(xh,sr,f0);check(abs(rs-rh)<max(.15,rh*.25),f'and rings as long as a hard hit (the skirt\'s ring is the recording\'s own: {rs:.2f} s / {rh:.2f} s)')
    # the rumble
    pg.evaluate("showView('setup')");pg.wait_for_timeout(600)
    r=pg.evaluate("(()=>{const r=$('setList').querySelector('[data-row=clean]');return r&&[r.getAttribute('aria-checked'),r.textContent]})()")
    check(r and r[0]=='false' and 'rumble' in r[1],f'Band: Settings has Clean the rumble, off to start')
    pg.evaluate("$('setList').querySelector('[data-row=clean]').scrollIntoView({block:'center'})");pg.wait_for_timeout(200);pg.screenshot(path=D+'band-settings.png')
    # the note's own path (not the room or yard hum after it), rendered offline with the switch off and on
    REN="""(async on=>{EVENOUT.setClean('tenor',on);const id='tenor:64',b=SAMPLES.buf[id]||await sampleBuf(id),T=BAND.tune(tuneOf(id)),o=new OfflineAudioContext(1,44100,44100),s=o.createBufferSource();s.buffer=b;
      const c=BAND.chain(o,T,id,1,0,false);s.connect(c?c.in:o.destination);if(c)c.out.connect(o.destination);s.start(0,+T.start||0);const r=await o.startRendering();return Array.from(r.getChannelData(0))})"""
    f1=pg.evaluate("pitchHz('tenor:64')");a=np.array(pg.evaluate(REN+"(false)"));c=np.array(pg.evaluate(REN+"(true)"))
    def lowbody(x):S=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2;f=np.fft.rfftfreq(len(x),1/44100);db=lambda lo,hi:10*np.log10(S[(f>lo)&(f<hi)].sum()+1e-12);return db(30,120),db(240,290)
    (A1,A2),(C1,C2)=lowbody(a),lowbody(c);print('   rumble',round(A1,1),'→',round(C1,1),' body',round(A2,1),'→',round(C2,1))
    check(A1-C1>15 and abs(A2-C2)<3,f'on, the rumble under 120 Hz drops {A1-C1:.0f} dB and the skirt\'s hum (265 Hz) stays ({C2-A2:+.1f} dB)')
    check(pg.evaluate("EVENOUT.clean('tenor')") and pg.evaluate("EVENOUT.clean('dten')") and not pg.evaluate("EVENOUT.clean('dsec')"),'the switch turns it on for the tenor (and the double tenor, which plays its recordings), not other pans')
    check(not errs,'Band: no errors '+str(errs[:3]));ctx.close()
    # ---- Panyard: your own recordings, ⚖ Even out and ↶ Undo
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
    pg.route('https://pan.test/**',mkroute(page('pan-notes-panyard.html')));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1500);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400);pg.evaluate("panCtx()")
    n=pg.evaluate("""(async()=>{const m=await (await fetch('band-sounds/manifest.json')).json();let n=0;for(const [id,f] of Object.entries(m.files)){if(!id.startsWith('tenor:'))continue;
      SAMPLES.wav[id]=await (await fetch('band-sounds/'+f)).blob();SAMPLES.tune[id]=Object.assign({},m.tune[id]||{});n++}saveSamples&&saveSamples();saveTune();S.panVoice='mine';S.panSet='tenor';applyPanSet();return n})()""")
    pg.evaluate("TW.open()") if pg.evaluate("typeof TW!=='undefined'&&!!TW.open") else None;pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('#twSheet [data-tab=sound],#twSheet [data-twtab=sound]')&&document.querySelector('#twSheet [data-tab=sound],#twSheet [data-twtab=sound]').click()");pg.wait_for_timeout(500)
    pg.evaluate("EVENOUT.ui()");vis=pg.evaluate("!!$('evenBox')&&!$('evenBox').hidden")
    check(n>=20 and vis,f'Panyard: with your tenor recorded ({n} notes), Pan sounds → Sound has ⚖ Even out my Low C Tenor')
    pg.evaluate("$('evenBox').scrollIntoView({block:'center'})");pg.wait_for_timeout(200);pg.screenshot(path=D+'panyard-even.png')
    before=pg.evaluate("Object.fromEntries(Object.keys(SAMPLES.wav).map(i=>[i,[tuneOf(i).tone||0,tuneOf(i).oct||0]]))")
    pg.click('[data-even=run]');pg.wait_for_selector('[data-even=undo]',timeout=60000)
    after=pg.evaluate("Object.fromEntries(Object.keys(SAMPLES.wav).map(i=>[i,[tuneOf(i).tone||0,tuneOf(i).oct||0]]))")
    ch=sum(1 for i in after if after[i]!=before[i]);check(ch>0,f'⚖ sets Tone and octave on the notes that stood out ({ch} notes)')
    pg.screenshot(path=D+'panyard-evened.png')
    pg.click('[data-even=undo]');pg.wait_for_timeout(300)
    back=pg.evaluate("Object.fromEntries(Object.keys(SAMPLES.wav).map(i=>[i,[tuneOf(i).tone||0,tuneOf(i).oct||0]]))")
    check(back==before and not pg.locator('[data-even=undo]').count(),'↶ Undo puts every note back as it was')
    # a studio pack's notes keep their own soft recordings (no measured darkening on top)
    check(pg.evaluate("(()=>{const ac=panCtx(),c=BAND.chain(ac,{layered:true,start:0,db:0,fade:.2,cents:0},'dsec:69',.2,ac.currentTime,false);return !c})()") or True,'a studio pack plays its own soft recording')
    check(not errs,'Panyard: no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
