import os,sys,json
import numpy as np
from playwright.sync_api import sync_playwright
# On the phone speaker (Settings): a Six Bass note's overtones, which a phone speaker can play (150–700 Hz), come up a
# lot; the deep part it can't play (under 70 Hz) goes down; nothing clips; a tenor isn't changed; Studio's bass tracks
# get it too; the switch is in Settings, stays on after reopening, and isn't copied to Google Drive backups.
D=os.environ['WORK']+'/tphone/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""
LOW="(k=>{const ids=SETS[k].views.flatMap(v=>v.fields.map(f=>f[0]));return ids.sort((a,b)=>midiOf(PITCH[a])-midiOf(PITCH[b]))[0]})"
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400);pg.evaluate("panCtx()")
    def grab(js,secs=1.6):
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(js);pg.wait_for_timeout(int(secs*1000));pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate")
        i=np.argmax(abs(x)>0.003);x=x[i:i+int(sr*1.2)]
        F=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2;f=np.fft.rfftfreq(len(x),1/sr)
        band=lambda a,c:10*np.log10(F[(f>=a)&(f<c)].sum()+1e-12)
        return dict(low=round(band(20,70),1),mid=round(band(150,700),1),peak=round(float(abs(x).max()),3))
    def note(k):
        pg.evaluate(f"()=>{{S.panSet='{k}';applyPanSet()}}");pg.wait_for_timeout(200);return pg.evaluate(LOW+f"('{k}')")
    n=note('six');f0=pg.evaluate(f"midiOf(PITCH['{n}'])")
    off=grab(f"strike('{n}',.9)")
    pg.evaluate("PHONE.set(true)");pg.wait_for_timeout(200)
    on=grab(f"strike('{n}',.9)")
    print('six bass lowest',n,'midi',f0,'off',off,'on',on)
    check(on['mid']>off['mid']+6,f'Play, Six Bass: the overtones a phone can play come up a lot ({off["mid"]} → {on["mid"]} dB)')
    check(on['low']<off['low']-3,f'and the deep part a phone can\'t play goes down ({off["low"]} → {on["low"]} dB)')
    check(on['peak']<1.0,f'no clipping (peak {on["peak"]})')
    # a loud bass chord stays clean
    ch=pg.evaluate("(()=>{const ids=SETS.six.views.flatMap(v=>v.fields.map(f=>f[0]));return ids.slice(0,6)})()")
    loud=grab("ids=>ids.forEach(i=>strike(i,1))".replace('ids=>','')+'' if False else f"{json.dumps(ch)}.forEach(i=>strike(i,1))")
    check(loud['peak']<1.0,f'a loud six-note chord doesn\'t clip (peak {loud["peak"]})')
    # a tenor isn't touched
    t=note('tenor');pg.evaluate("PHONE.set(false)");t0=grab(f"strike('{t}',.9)");pg.evaluate("PHONE.set(true)");t1=grab(f"strike('{t}',.9)")
    check(abs(t1['mid']-t0['mid'])<1 and abs(t1['low']-t0['low'])<2,f'a tenor sounds the same either way {t0} {t1}')
    # Studio: a Six Bass track
    pg.evaluate("showView('studio')");pg.wait_for_timeout(1200)
    if pg.evaluate("document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click('[data-st=addk][data-v=pan][data-set=six]');pg.wait_for_timeout(400)
    pg.evaluate(f"()=>{{const s=STUDIO.song;s.metro=false;s.countIn=false;s.tracks.forEach(t=>t.mute=t.panSet!=='six');const t=s.tracks.find(t=>t.panSet==='six');t.notes=[{{t:0,d:3,p:'{n}',v:.95}}];t.fx={{treble:0,bass:0,comp:0,echo:0,echoT:'q',room:0,own:true}};t.mix=0;STUDIO.refresh()}}")
    def splay():return grab("STUDIO.seek(0);STUDIO.play(false)",1.8)
    pg.evaluate("PHONE.set(false)");s0=splay();pg.evaluate("STUDIO.stop(true)");pg.wait_for_timeout(300)
    pg.evaluate("PHONE.set(true)");s1=splay();pg.evaluate("STUDIO.stop(true)")
    print('studio off',s0,'on',s1)
    check(s1['mid']>s0['mid']+6 and s1['peak']<1.0,f'Studio, Six Bass track: overtones come up too ({s0["mid"]} → {s1["mid"]} dB, peak {s1["peak"]})')
    # Settings
    pg.evaluate("showView('setup')");pg.wait_for_timeout(500)
    r=pg.evaluate("(()=>{const r=$('setList').querySelector('[data-row=phone]');return r&&[r.getAttribute('aria-checked'),r.textContent]})()")
    check(r and r[0]=='true' and 'phone speaker' in r[1],f'Settings has the switch, on {r}')
    pg.evaluate("$('setList').querySelector('[data-row=phone]').scrollIntoView({block:'center'})");pg.wait_for_timeout(150);pg.screenshot(path=D+'settings.png')
    pg.click('[data-row=phone]');pg.wait_for_timeout(200)
    check(pg.evaluate("[PHONE.on,$('setList').querySelector('[data-row=phone]').getAttribute('aria-checked')]")==[False,'false'],'tapping it turns it off')
    pg.click('[data-row=phone]');pg.wait_for_timeout(200)
    pg.reload();pg.wait_for_timeout(1500)
    check(pg.evaluate("PHONE.on") and pg.evaluate("CLOUD.SKIP.test('panyard-phone')"),'still on after reopening the app, and kept on this phone only (not in the Drive backup)')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
