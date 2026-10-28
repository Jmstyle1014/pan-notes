import os,sys,json
import numpy as np
from playwright.sync_api import sync_playwright
# Tuned steel on a whole Studio song (chords, a roll, a bass line): no ticks (no sudden jumps in the wave), little work for
# the phone (ready notes, not ~10 live tones per note), and ■ Stop cancels the notes already lined up after it.
D=os.environ['WORK']+'/tsteeltrack/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];window._osc=0;const _o=BaseAudioContext.prototype.createOscillator;BaseAudioContext.prototype.createOscillator=function(){if(!(this instanceof OfflineAudioContext))window._osc++;return _o.apply(this,arguments)};
  const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400);pg.evaluate("()=>{panCtx();S.panSet='tenor';applyPanSet();S.panVoice='steel'}")
    pg.evaluate("showView('studio')");pg.wait_for_timeout(1200)
    if pg.evaluate("document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(400)
    for k in ['tenor','six']:
        pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click(f'[data-st=addk][data-v=pan][data-set={k}]');pg.wait_for_timeout(400)
    pg.evaluate("""()=>{const s=STUDIO.song;s.metro=false;s.countIn=false;STUDIO.setTempo(120);s.tracks.forEach(t=>t.mute=!(t.panSet==='tenor'||t.panSet==='six'));
      const ids=k=>SETS[k].views.flatMap(v=>v.fields.map(f=>f[0])).sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]));const T=ids('tenor'),B=ids('six');
      const ten=s.tracks.find(t=>t.panSet==='tenor'),bas=s.tracks.find(t=>t.panSet==='six');ten.notes=[];bas.notes=[];
      for(let bt=0;bt<8;bt++){[T[7+bt%3],T[11+bt%3],T[14+bt%4]].forEach(p=>ten.notes.push({t:bt,d:.5,p,v:.9}));ten.notes.push({t:bt+.5,d:.5,p:T[18-bt%5],v:.8})}
      for(let k=0;k<20;k++)ten.notes.push({t:8+k*.07*2,d:.25,p:T[16],v:.55+(k%3)*.1,r:1});   // a roll
      ten.notes.push({t:8,d:2,p:T[16],v:.95,r:0});
      for(let bt=0;bt<10;bt+=1)bas.notes.push({t:bt,d:1,p:B[(bt*3)%B.length],v:.9});
      STUDIO.refresh()}""")
    def run(secs):
        pg.evaluate("()=>{window._rec=[];window._osc=0;window._on=1;STUDIO.seek(0);STUDIO.play(false)}");pg.wait_for_timeout(int(secs*1000));pg.evaluate("()=>{window._on=0;STUDIO.stop(true)}")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);return x,pg.evaluate("window._osc"),pg.evaluate("panCtx().sampleRate")
    run(1.5);pg.wait_for_timeout(500)   # the first run gets the ready notes made
    x,osc,sr=run(6.0)
    # a tick is a sudden jump: the wave's bend (second difference) far bigger than the music around it
    d2=np.abs(np.diff(x,2));loc=np.convolve(d2,np.ones(441)/441,'same')+1e-4;ticks=int(((d2>0.01)&(d2>12*loc)).sum())
    print('peak',round(float(abs(x).max()),3),'oscillators',osc,'ticks',ticks)
    import wave;w=wave.open(D+'song.wav','wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(int(sr));w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes());w.close()
    check(abs(x).max()>.02,'the song plays')
    check(ticks<=2,f'no ticks: {ticks} sudden jumps in 6 s')
    check(abs(x).max()<1.0,f'no clipping ({abs(x).max():.3f})')
    check(osc<60,f'light on the phone: {osc} live tones made while 6 s of song played')
    # ■ Stop: a note lined up just after it must not sound
    pg.evaluate("()=>{const s=STUDIO.song;s.tracks.forEach(t=>{if(t.panSet==='tenor'||t.panSet==='six')t.notes=[]});const ten=s.tracks.find(t=>t.panSet==='tenor');const T=SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0]));ten.notes=[{t:0,d:.5,p:T[5],v:.9},{t:1,d:.5,p:T[9],v:.95}];STUDIO.refresh()}")
    pg.wait_for_timeout(6000)   # the song's last notes die away first
    pg.evaluate("()=>{window._rec=[];window._on=1;STUDIO.seek(0);STUDIO.play(false)}")
    pg.evaluate("new Promise(r=>{const go=()=>{if(STUDIO.beatNow()>=.82)r();else requestAnimationFrame(go)};go()})");pg.evaluate("STUDIO.stop(true)")
    pg.wait_for_timeout(1200);pg.evaluate("()=>window._on=0")
    x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);i0=np.argmax(abs(x)>.05)
    env=np.array([np.sqrt((x[i:i+512]**2).mean()) for i in range(i0,len(x)-512,512)]);rise=[k for k in range(4,len(env)) if env[k]>env[k-3]*2.5 and env[k]>.01]
    check(not rise,f'■ Stop cancels the note lined up after it (no new note after Stop: {rise[:3]})')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
