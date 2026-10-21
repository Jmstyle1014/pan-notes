import os,sys
from playwright.sync_api import sync_playwright
# Your recordings from the very first tap: never the built-in tone for a note you've recorded.
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
MAKE="""([ids,sr])=>{for(let k=0;k<ids.length;k++){const id=ids[k],f=440*Math.pow(2,(midiOf(PITCH[id])-69)/12),n=Math.round(sr*1.5),x=new Float32Array(n);
  for(let i=0;i<n;i++){const t=i/sr,e=Math.exp(-t*2.5)*Math.min(1,t*500);x[i]=.98*e*(.6*Math.sin(2*Math.PI*f*t)+.3*Math.sin(2*Math.PI*2*f*t)+.1*Math.sin(2*Math.PI*3*f*t))}
  storeTake(id,x,sr)}S.panVoice='mine';save();return Object.keys(SAMPLES.wav).length}"""
# count the built-in tone (its oscillators; the 20 Hz keep-awake hum doesn't count) and your recordings
SPY="""window.__osc=0;window.__mine=0;{const co=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const o=co.call(this);setTimeout(()=>{if(o.frequency.value>25)window.__osc++},0);return o}
  const cb=AudioContext.prototype.createBufferSource;AudioContext.prototype.createBufferSource=function(){const s=cb.call(this),st=s.start.bind(s);s.start=(...a)=>{if(s.buffer&&s.buffer.duration>.5)window.__mine++;return st(...a)};return s}}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1200)
    pg.click('[data-r=producer]');pg.wait_for_timeout(300);pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=tenor]');pg.fill('#nsName','First tap');pg.click('[data-r=create]');pg.wait_for_timeout(1000)
    ids=E(pg,"()=>SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0]))");n=E(pg,MAKE,[ids,44100]);pg.wait_for_timeout(1500)
    # open the app again and tap straight away, before the recordings are ready
    pg.add_init_script(SPY);pg.reload();pg.wait_for_timeout(250)
    E(pg,"showView('play')")
    first=E(pg,"()=>[Object.keys(SAMPLES.wav).length,Object.keys(SAMPLES.buf).length]")
    for i in range(6):
        E(pg,"i=>{const f=document.querySelectorAll('#playPans .field')[i];if(f){const r=f.getBoundingClientRect();f.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2,pointerId:20+i}));window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:20+i}))}}",i);pg.wait_for_timeout(60)
    pg.wait_for_timeout(1200)
    got=E(pg,"[window.__osc,window.__mine]")
    print('recordings / ready when tapping:',first,' built-in oscillators, recordings played:',got)
    check(got[0]==0,'no built-in tone for a recorded note, even right after opening the app')
    check(got[1]>=4,'your recordings play for those taps (%d of 6)'%got[1])
    pg.wait_for_timeout(3000)
    check(E(pg,"Object.keys(SAMPLES.buf).length")==n,'every recording is ready a moment after the app opens')
    check(not errs,'no errors '+str(errs[:3]))
    ctx.close();b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
