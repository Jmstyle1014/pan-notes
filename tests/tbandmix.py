import os,sys,json,base64
import numpy as np
from playwright.sync_api import sync_playwright
# Panyard Band: the pans' Drum body hum and Suggested tone are on for every song (switches in Settings, a first-time
# introduction), and the 🎚 Mix on the play bar sets the recording against your pans, per song, without clipping.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tbandmix/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.path.join(ROOT,'source','pan-notes-band.html')).read()+'</body></html>'
SND=os.path.join(ROOT,'source','band-sounds')
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0]
    if '/band-sounds/' in u:
        f=os.path.join(SND,os.path.basename(u));return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
    return r.fulfill(body=html,content_type='text/html')
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""

import wave
WAV=D+'song.wav'
sr=44100;t=np.arange(sr*6)/sr;x=(.3*np.sin(2*np.pi*220*t)).astype(np.float32)
w=wave.open(WAV,'wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((x*32767).astype('<i2').tobytes());w.close()
def grab(pg,js,ms=1500):
    pg.wait_for_timeout(1500)
    pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(js);pg.wait_for_timeout(ms);pg.evaluate("()=>window._on=0")
    n=pg.evaluate("window._rec.length");return np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]) if n else np.zeros(1)
def band(x,sr,f,w=.12):
    X=np.abs(np.fft.rfft(x*np.hanning(len(x))));fr=np.fft.rfftfreq(len(x),1/sr);m=(fr>f*(1-w))&(fr<f*(1+w));return (X[m]**2).sum()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
    pg.route('https://pan.test/**',route);pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg.wait_for_function("!!localStorage.getItem('panyard-bandsounds')",timeout=60000);pg.wait_for_timeout(800)
    pg.click('[data-r=section][data-v=front]');pg.wait_for_timeout(300);pg.click('[data-r=pan][data-v=tenor]');pg.wait_for_timeout(600)
    # opening again: a short introduction, both switches on
    pg.reload();pg.wait_for_timeout(2500)
    intro=pg.evaluate("(()=>{const d=$('btIntro');return d?[...d.querySelectorAll('[role=switch]')].map(r=>r.getAttribute('aria-checked')):null})()")
    check(intro==['true','true'],f'an introduction shows the Drum body hum and Suggested tone, both on {intro}')
    pg.screenshot(path=D+'1-intro.png')
    pg.click('#btIntro [data-bt=ok]');pg.wait_for_timeout(300)
    pg.reload();pg.wait_for_timeout(2500);check(not pg.evaluate("!!$('btIntro')"),'the introduction shows only once')
    # the hum: the lowest tenor note, without and with
    pg.evaluate("showView('play')");pg.wait_for_timeout(500)
    sr=pg.evaluate("panCtx().sampleRate")
    lo=pg.evaluate("SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0])).filter(i=>SAMPLES.wav[i]&&PITCH[i]).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]))[0]")
    pg.evaluate(f"sampleBuf('{lo}')");pg.wait_for_timeout(600)
    bd=pg.evaluate("BAND.BODY.tenor")
    pg.evaluate("BANDAPP.tone.body=0;BANDAPP.tone.tone=0");x0=grab(pg,f"strike('{lo}',.9)")
    pg.evaluate("BANDAPP.tone.body=1;BANDAPP.tone.tone=0");x1=grab(pg,f"strike('{lo}',.9)")
    pg.evaluate("BANDAPP.tone.body=0;BANDAPP.tone.tone=1");x2=grab(pg,f"strike('{lo}',.9)")
    e=lambda x,f:band(x,sr,f)/max(1e-12,(x**2).sum())
    hb=10*np.log10(band(x1,sr,bd,.06)/max(1e-12,band(x0,sr,bd,.06)))
    check(hb>1.0,f'Drum body hum lifts the tenor barrel\'s hum ({bd} Hz: +{hb:.1f} dB)')
    tilt=lambda x:band(x,sr,7000,.3)/max(1e-12,band(x,sr,bd,.3))
    ht=10*np.log10(tilt(x2)/max(1e-12,tilt(x0)))
    check(ht>.8,f'Suggested tone gives the tenor more shine (top against bottom +{ht:.1f} dB)')
    pk=max(abs(x0).max(),abs(x1).max(),abs(x2).max());check(.02<pk<1,f'heard, and no clipping (peak {pk:.2f})')
    pg.evaluate("BANDAPP.tone.body=1;BANDAPP.tone.tone=1")
    # Settings: both switches and Hear the difference
    pg.evaluate("showView('setup')");pg.wait_for_timeout(500)
    rows=pg.evaluate("[...document.querySelectorAll('#setList [data-row^=bt-]')].map(r=>r.dataset.row+':'+(r.getAttribute('aria-checked')||''))")
    check(rows==['bt-body:true','bt-tone:true','bt-hear:'],f'Settings has Drum body hum and Suggested tone (on) and Hear the difference {rows}')
    pg.click('[data-row=bt-body]');pg.wait_for_timeout(400)
    check(pg.evaluate("JSON.parse(localStorage.getItem('panyard-bandtone')).body")==0 and pg.evaluate("document.querySelector('[data-row=bt-body]').getAttribute('aria-checked')")=='false','turning Drum body hum off is kept')
    pg.evaluate("document.querySelector('[data-row=bt-body]').scrollIntoView({block:'center'})");pg.wait_for_timeout(300);pg.screenshot(path=D+'2-settings.png')
    pg.click('[data-row=bt-body]');pg.wait_for_timeout(2500)
    # the mixer
    pg.evaluate("showView('play')");pg.wait_for_timeout(400)
    pg.set_input_files('#audioFile',WAV);pg.wait_for_timeout(1500)
    pg.click('#mixBtn');pg.wait_for_timeout(300)
    check(pg.evaluate("!$('mixBox').hidden"),'🎚 on the play bar opens the mixer')
    def slide(sel,v):pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');e.value={v};e.dispatchEvent(new Event('input',{{bubbles:true}}))}})()")
    base=pg.evaluate("pBus._base")
    slide('#mixRec',30);slide('#mixPan',50)
    check(abs(pg.evaluate("audio.volume")-.3)<.01,'Recording at 30% plays the recording at 30%')
    check(abs(pg.evaluate("pBus.gain.value")-base*.5)<.01,'Your pans at 50% halves the pans')
    pg.click('[data-mx=over]');pg.wait_for_timeout(200)
    check(pg.evaluate("S.tapSound")=='always','Hear my pans while the song plays: on')
    pg.screenshot(path=D+'3-mix.png')
    q=grab(pg,f"strike('{lo}',.9)",1200)
    slide('#mixPan',200);l=grab(pg,f"strike('{lo}',.9)",1200)
    r=20*np.log10(abs(l).max()/max(1e-9,abs(q).max()))
    check(r>4,f'Your pans at 200% is louder than at 50% (+{r:.1f} dB)')
    ch=grab(pg,"SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0])).filter(i=>SAMPLES.wav[i]).slice(0,6).forEach(i=>strike(i,1))",1500)
    check(abs(ch).max()<1,f'a loud chord at 200% doesn\'t clip (peak {abs(ch).max():.2f})')
    # each song keeps its own mix
    s0=pg.evaluate("isDemo?'demo':songNow().id");pg.evaluate("ROLE.songNew0()");pg.wait_for_timeout(1500)
    m=pg.evaluate("MIX.get()");check(m=={'rec':100,'pan':100},f'a new song starts even {m}')
    pg.evaluate("showView('play')");pg.wait_for_timeout(300);check(not pg.evaluate("!$('mixBox').hidden"),'changing screens closes the mixer')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
