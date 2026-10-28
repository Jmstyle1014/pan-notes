import os,sys,json
import numpy as np
from playwright.sync_api import sync_playwright
# Tune it like your pans (Pan sounds → Sound → Tuned steel): it listens to your recordings of a pan and measures how it
# rings, even through background noise and a recording that's a little out of tune; Tuned steel then rings like it
# (its octave as strong, its note as long); Standard pan puts it back; the sliders only show for Tuned steel.
D=os.environ['WORK']+'/tsteelfit/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""
# pretend recordings: rings 1.2 s, octave 10 dB under the note, its peak 60 ms after the hit, 25 cents flat, room noise
MAKE="""(ids)=>{const ac=panCtx(),sr=ac.sampleRate;
  for(const id of ids){const f=pitchHz(id)*Math.pow(2,-25/1200),n=Math.round(sr*2.2),b=ac.createBuffer(1,n,sr),d=b.getChannelData(0),pre=Math.round(sr*.15);
    for(let i=0;i<n;i++){const t=(i-pre)/sr;let x=(Math.random()*2-1)*.02+.01*Math.sin(2*Math.PI*60*i/sr);   // hiss and mains hum
      if(t>=0){const e1=Math.exp(-6.9*t/1.2),e2=Math.exp(-6.9*t/.9)*(1-Math.exp(-t/.02));x+=.6*e1*Math.sin(2*Math.PI*f*t)+.6*.38*e2*Math.sin(2*Math.PI*2*f*t)+.6*.05*e1*Math.sin(2*Math.PI*4*f*t)}
      d[i]=x}
    SAMPLES.wav[id]=new Blob(['pretend']);SAMPLES.buf[id]=b}}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400);pg.evaluate("()=>{panCtx();S.panSet='tenor';applyPanSet()}");pg.wait_for_timeout(200)
    ids=pg.evaluate("SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0])).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b])).slice(4,12)")
    # the sliders only show for Tuned steel
    pg.evaluate("TW.open(true)");pg.wait_for_timeout(500);pg.evaluate("TW.tabTo('sound')");pg.wait_for_timeout(300)
    check(pg.evaluate("$('steelBox').hidden"),'with the built-in tone, the Tuned steel sliders are hidden')
    pg.evaluate("document.querySelector('#voiceSeg [data-v=steel]').click()");pg.wait_for_timeout(300)
    check(not pg.evaluate("$('steelBox').hidden") and pg.evaluate("!!document.querySelector('#steelBox [data-steelfit=learn]')"),'with Tuned steel they show, with ✨ Tune it like my pans')
    def grab(js,secs=2.2):
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(js);pg.wait_for_timeout(int(secs*1000));pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate");i=np.argmax(abs(x)>0.002);return x[i:],sr
    n=ids[3];f0=pg.evaluate(f"pitchHz('{n}')")
    def shape():
        pg.evaluate(f"STEEL.make('{n}')");pg.wait_for_timeout(2500)   # its ready note (and the rest of the pan) first
        r=[shape1() for _ in range(3)];return tuple(float(np.median([x[k] for x in r])) for k in (0,1))
    def shape1():
        x,sr=grab(f"strike('{n}',.9)");w=x[:int(sr*.5)]
        F=abs(np.fft.rfft(w*np.hanning(len(w))));f=np.fft.rfftfreq(len(w),1/sr);pk=lambda c:np.sqrt((F[(f>c*.97)&(f<c*1.03)]**2).sum())   # all of it: a shimmering tone is two close peaks
        env=np.array([np.sqrt((x[i:i+1024]**2).mean()) for i in range(0,len(x)-1024,512)])
        j=np.argmax(env<env.max()*10**(-20/20)) or len(env)
        return round(20*np.log10(pk(2*f0)/pk(f0)),1),round(j*512/sr,2)
    std=shape();pg.evaluate("TW.open(false)")
    pg.evaluate(MAKE,ids);pg.evaluate("TW.open(true)");pg.wait_for_timeout(400);pg.evaluate("TW.tabTo('sound')");pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('#steelBox [data-steelfit=learn]').click()");pg.wait_for_timeout(4000)
    F=pg.evaluate("STEEL.s.fit&&STEEL.s.fit.tenor")
    print('measured',F)
    check(F and F['n']==len(ids),f'it listened to all {len(ids)} recorded tenor notes ({F and F["n"]})')
    check(F and abs(F['t60']-1.2)<.3,f'it hears how long they ring through the noise: {F and round(F["t60"],2)} s (made 1.2 s)')
    t=np.arange(0,1,1e-4);true=20*np.log10(.38*((1-np.exp(-t/.02))*np.exp(-6.9*t/.9)).max())   # the octave's own peak, next to the note's
    check(F and abs(20*np.log10(F['r2'])-true)<2,f'and how strong the octave is: {F and round(20*np.log10(F["r2"]),1)} dB (made {true:.1f})')
    check(F and F.get('h') and abs(20*np.log10(max(1e-6,F['h'][3]))-20*np.log10(.05))<4,f'and the ladder of steel tones (4× the note: {F and F.get("h") and round(20*np.log10(max(1e-6,F["h"][3])),1)} dB, made {20*np.log10(.05):.1f})')
    check(F and .02<F['bloom']<.12,f'and when the octave peaks: {F and round(F["bloom"]*1000)} ms after the hit')
    pg.evaluate("document.querySelector('#steelBox .steelfitl').scrollIntoView({block:'center'})");pg.wait_for_timeout(200);pg.screenshot(path=D+'1-measured.png')
    pg.evaluate("TW.open(false)");pg.wait_for_timeout(200)
    # make sure Play uses Tuned steel, not the pretend recordings
    pg.evaluate("S.panVoice='steel'")
    mine=shape()
    print('standard',std,'like my pans',mine)
    check(abs(mine[0]-20*np.log10(F['r2']))<4 and mine[0]<std[0]-4,f'Tuned steel\'s octave now sits like the recordings\' ({std[0]:.1f} → {mine[0]:.1f} dB, measured {20*np.log10(F["r2"]):.1f})')
    check(mine[1]<std[1]*.8,f'and it rings shorter, like them (20 dB down after {std[1]} → {mine[1]} s)')
    # kept after reopening, then Standard pan
    pg.reload();pg.wait_for_timeout(1500)
    check(bool(pg.evaluate("STEEL.s.fit&&STEEL.s.fit.tenor")),'the measurements are kept after reopening the app')
    pg.evaluate("STEEL.unlearn()");pg.evaluate("()=>{S.panSet='tenor';applyPanSet();S.panVoice='steel'}");pg.wait_for_timeout(200)
    back=shape()
    check(abs(back[0]-std[0])<2,f'Standard pan puts the usual pan back (octave {back[0]} dB)')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
