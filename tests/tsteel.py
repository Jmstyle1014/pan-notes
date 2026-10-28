import os,sys,json
import numpy as np
from playwright.sync_api import sync_playwright
# Tuned steel (Pan sounds): notes made from how a tuner tunes a pan. Each note rings its note, the octave (strong) and the
# twelfth or double octave; a harder hit is louder and brighter; the barrel hums at the skirt's note (default 6, a slider);
# Studio plays it too; it stays chosen after reopening; Settings names it.
D=os.environ['WORK']+'/tsteel/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400);pg.evaluate("()=>{panCtx();S.panSet='tenor';applyPanSet()}");pg.wait_for_timeout(200)
    # choose it in Pan sounds
    pg.evaluate("()=>{TW.open(true)}");pg.wait_for_timeout(600)
    has=pg.evaluate("!!document.querySelector('#voiceSeg [data-v=steel]')")
    check(has and 'Tuned steel' in pg.evaluate("document.querySelector('#voiceSeg').textContent"),'Pan sounds has Tuned steel next to the built-in tone and your recordings')
    pg.evaluate("document.querySelector('#voiceSeg [data-v=steel]').click()");pg.wait_for_timeout(400)
    st=pg.evaluate("[S.panVoice,!$('steelBox').hidden,[...document.querySelectorAll('#steelBox [data-steel]')].map(i=>[i.dataset.steel,+i.value])]")
    check(st[0]=='steel' and st[1] and st[2]==[['hum',6],['bloom',5],['edge',6]],f'choosing it shows Barrel hum (6), Octave bloom (5) and Steel edge (6) {st}')
    pg.screenshot(path=D+'1-pan-sounds.png');pg.evaluate("TW.tabTo('sound')");pg.wait_for_timeout(400);pg.screenshot(path=D+'2-sound-tab.png')
    check(pg.evaluate("$('steelBox').offsetParent!==null"),'its sliders are at the top of the Sound tab')
    pg.evaluate("TW.open(false)");pg.wait_for_timeout(300)
    def grab(js,secs=1.5,cut=1.0):
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(js);pg.wait_for_timeout(int(secs*1000));pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate")
        i=np.argmax(abs(x)>0.25*abs(x).max());i=max(0,i-int(.003*sr));return x[i:i+int(sr*cut)],sr   # the hit itself, not the tail of an earlier note
    def peaks(x,sr,fs):
        F=abs(np.fft.rfft(x*np.hanning(len(x))));f=np.fft.rfftfreq(len(x),1/sr);r=[]
        for c in fs:
            m=(f>c*.97)&(f<c*1.03);r.append(20*np.log10(F[m].max()+1e-12))
        return [round(v-r[0],1) for v in r]
    LOW="(k=>{const ids=SETS[k].views.flatMap(v=>v.fields.map(f=>f[0]));return ids.sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]))})"
    ids=pg.evaluate(LOW+"('tenor')");n=ids[len(ids)//2];f0=pg.evaluate(f"pitchHz('{n}')")
    pg.evaluate(f"STEEL.make('{n}')");pg.wait_for_timeout(2500)   # ready notes, and the rest of the pan made in the background first
    x,sr=grab(f"strike('{n}',1)")
    pk=peaks(x,sr,[f0,2*f0,(3 if f0<330 else 4)*f0])
    print('tenor',n,round(f0,1),'Hz partials',pk)
    check(pk[1]>-12 and pk[2]>-45,f'a tenor note rings its note, a strong octave and the {"twelfth" if f0<330 else "double octave"} ({pk} dB)')
    check(abs(x).max()<1.0,f'no clipping ({abs(x).max():.3f})')
    lad=peaks(x,sr,[f0,3*f0,5*f0,6*f0])
    check(lad[1]>-35 and lad[2]>-40 and lad[3]>-45,f'it sounds like steel: the ladder of tones 3×, 5×, 6× the note is there ({lad[1:]} dB)')
    xs,_=grab(f"strike('{n}',.35)")
    hard=np.sqrt((x[:4000]**2).mean());soft=np.sqrt((xs[:4000]**2).mean())
    ps=peaks(xs,sr,[f0,2*f0,4*f0 if f0>=330 else 3*f0])
    check(hard>soft*1.5 and ps[2]<pk[2],f'a soft hit is quieter and darker (loudness {hard/soft:.2f}×, top {ps[2]} vs {pk[2]} dB)')
    # the barrel: Six Bass hums at its skirt's note
    pg.evaluate("()=>{S.panSet='six';applyPanSet()}");pg.wait_for_timeout(200)
    pg.wait_for_timeout(3500)   # the Six Bass's ready notes are made in the background first
    bid=pg.evaluate(LOW+"('six')")[10];bh=pg.evaluate("BAND.BODY.six")
    def hum():
        pg.evaluate(f"STEEL.make('{bid}')");pg.wait_for_timeout(200)   # its ready note, as you'd hear it
        x,sr=grab(f"strike('{bid}',.9)",1.6,1.2);F=abs(np.fft.rfft(x*np.hanning(len(x))));f=np.fft.rfftfreq(len(x),1/sr);m=(f>bh-2)&(f<bh+2);return 20*np.log10(F[m].max()+1e-12)
    h6=hum();pg.evaluate("STEEL.set('hum',0)");h0=hum();pg.evaluate("STEEL.set('hum',6)")
    check(h6>h0+6,f'the barrel hums at its skirt\'s note ({bh} Hz): {h0:.1f} → {h6:.1f} dB with Barrel hum 0 → 6')
    # Studio
    pg.evaluate("()=>{S.panSet='tenor';applyPanSet()}");pg.evaluate("showView('studio')");pg.wait_for_timeout(1200)
    if pg.evaluate("document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click('[data-st=addk][data-v=pan][data-set=tenor]');pg.wait_for_timeout(400)
    pg.evaluate(f"()=>{{const s=STUDIO.song;s.metro=false;s.countIn=false;s.tracks.forEach(t=>t.mute=t.panSet!=='tenor');const t=s.tracks.find(t=>t.panSet==='tenor');t.notes=[{{t:0,d:1,p:'{n}',v:.95}}];STUDIO.refresh()}}")
    x,sr=grab("STUDIO.seek(0);STUDIO.play(false)",1.6);pg.evaluate("STUDIO.stop(true)")
    ps=peaks(x,sr,[f0,2*f0]) if abs(x).max()>0.01 else [0,-99]
    check(abs(x).max()>0.01 and ps[1]>-12,f'Studio plays Tuned steel too (octave {ps[1]} dB)')
    # kept with the song, named in Settings
    pg.evaluate("save()");pg.wait_for_timeout(300);pg.reload();pg.wait_for_timeout(1800)
    pg.evaluate("showView('setup')");pg.wait_for_timeout(500)
    row=pg.evaluate("(()=>{const r=$('setList').querySelector('[data-row=sound]');return r&&r.textContent})()")
    check(pg.evaluate("S.panVoice")=='steel' and row and 'Tuned steel' in row,f'still Tuned steel after reopening, and Settings says so ({row})')
    check(pg.evaluate("STEEL.s.hum")==6,'Barrel hum kept')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
