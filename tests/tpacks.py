import os,sys,json
import numpy as np
from playwright.sync_api import sync_playwright
# Studio sound packs in Panyard and Panyard Band: the Dunleavy double seconds are on by default and the study tenor off;
# a tap (Play) and a Studio track play the pack's layer for how hard the note is hit (soft hits the soft recording),
# in tune with the song's A; Settings has a switch per pack with its credit and licence; off, your own sounds come back.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tpacks/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp,...a);return _c.call(this,d,...a)}return _c.call(this,d,...a)}})()"""
def page(app):
    return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.path.join(ROOT,'source',app)).read()+'</body></html>'
def run(b,app,band):
    html=page(app)
    def route(r):
        u=r.request.url.split('?')[0].replace('https://pan.test/','')
        if u.startswith('packs/'):
            f=os.path.join(ROOT,u);return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
        if '/band-sounds/' in u:
            f=os.path.join(ROOT,'source','band-sounds',os.path.basename(u));return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
        return r.fulfill(body=html,content_type='text/html')
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
    pg.route('https://pan.test/**',route);pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/app/');pg.wait_for_timeout(1500);pg.add_style_tag(content='#status{visibility:hidden!important}')
    who='Band' if band else 'Panyard'
    if band:pg.wait_for_function("!!localStorage.getItem('pb:panyard-bandsounds')||!!localStorage.getItem('panyard-bandsounds')",timeout=60000);pg.wait_for_timeout(800);pg.evaluate("try{ROLE.close()}catch(e){}")
    else:pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400)
    pg.evaluate("panCtx()")
    check(pg.evaluate("[PACKS.on('dsec'),PACKS.on('tenor')]")==[True,False],f'{who}: the Dunleavy double seconds are on by default, the study tenor off')
    pg.evaluate("()=>{S.panVoice='mine';S.panSet='dsec';applyPanSet()}")   # recorded sounds (a fresh phone starts on the built-in tone)
    pg.evaluate("()=>{window._pk=0;const _p=PACKS.pick;PACKS.pick=function(){const r=_p.apply(this,arguments);if(r)window._pk++;return r};const _s=playSample;playSample=function(){if(arguments[5])window._pk++;return _s.apply(this,arguments)}}")
    pg.wait_for_function("PACKS.state.dsec==='ready'",timeout=90000)
    n=pg.evaluate("Object.keys(PACKS.man.dsec.files).filter(PACKS.has).length");check(n==30,f'{who}: with a double second song open, all 30 notes come in, 4 layers each ({n})')
    L=pg.evaluate("[0,.3,.6,1].map(v=>PACKS.pick('dsec:69',v).layer)");check(L==[0,1,2,3],f'{who}: soft to hard picks the soft to hard recording {L}')
    check(pg.evaluate("PACKS.pick('tenor:60',1)") is None,f'{who}: the tenor (off) plays your own sounds')
    def grab(js,secs=1.4):
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(js);pg.wait_for_timeout(int(secs*1000));pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]) if pg.evaluate("window._rec.length") else np.zeros(4096);sr=pg.evaluate("panCtx().sampleRate")
        i=np.argmax(abs(x)>0.003);x=x[i:i+int(sr*1.0)];return x,sr
    def f0(x,sr,near):
        F=np.abs(np.fft.rfft(x*np.hanning(len(x)),1<<17));f=np.fft.rfftfreq(1<<17,1/sr);m=(f>near*.94)&(f<near*1.06);return float(f[m][np.argmax(F[m])])
    def bright(x,sr):
        F=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2;f=np.fft.rfftfreq(len(x),1/sr);return float((F*f).sum()/F.sum())
    A=pg.evaluate("S.refA||440");want=440*A/440
    pg.evaluate("window._pk=0");xs,sr=grab("strike('dsec:69',.15)");xh,_=grab("strike('dsec:69',1)");np_=pg.evaluate("window._pk")
    fs=f0(xh,sr,want);check(np_>=2 and abs(1200*np.log2(fs/want))<12,f'{who}, Play: a tap on A4 plays the studio recording in tune with the song\'s A {A} ({fs:.1f} Hz, {np_} pack plays)')
    ps,ph=float(abs(xs).max()),float(abs(xh).max());bs,bh=bright(xs,sr),bright(xh,sr)
    check(ph>ps*1.4 and bh>bs and ph<1,f'{who}, Play: a hard hit is louder and brighter than a soft one (peak {ps:.2f} → {ph:.2f}, {bs:.0f} → {bh:.0f} Hz), no clipping')
    # Studio (Panyard only: a band member has no Studio)
    if not band:
        pg.evaluate("showView('studio')");pg.wait_for_timeout(1200)
        if pg.evaluate("document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click('[data-st=addk][data-v=pan][data-set=dsec]');pg.wait_for_timeout(400)
        pg.evaluate("()=>{const s=STUDIO.song;s.metro=false;s.countIn=false;s.tracks.forEach(t=>t.mute=t.panSet!=='dsec');const t=s.tracks.find(t=>t.panSet==='dsec');t.notes=[{t:0,d:3,p:'dsec:69',v:.95}];t.fx={treble:0,bass:0,comp:0,echo:0,echoT:'q',room:0,own:true};t.mix=0;STUDIO.refresh()}")
        pg.evaluate("window._pk=0")
        x,_=grab("STUDIO.seek(0);STUDIO.play(false)",1.8);pg.evaluate("STUDIO.stop(true)")
        fs=f0(x,sr,want) if len(x)>1000 else 0
        check(pg.evaluate("window._pk")>0 and abs(1200*np.log2(max(fs,1)/want))<12,f'Studio: a double second track plays the studio recording, in tune ({fs:.1f} Hz)')
        pg.evaluate("showView('play')");pg.wait_for_timeout(400)
    # Settings
    pg.evaluate("showView('setup')");pg.wait_for_timeout(800)
    r=pg.evaluate("(()=>{const r=$('setList').querySelector('[data-row=pack-dsec]'),t=$('setList').querySelector('[data-row=pack-tenor]');return r&&t&&[r.getAttribute('aria-checked'),t.getAttribute('aria-checked'),r.textContent,t.textContent]})()")
    check(r and r[0]=='true' and r[1]=='false' and 'CC BY 4.0' in r[2] and 'Dunleavy' in r[2] and 'non-commercial' in r[3],f'{who}: Settings has a switch for each, with the credit and licence {r and [r[0],r[1]]}')
    pg.evaluate("$('setList').querySelector('[data-row=pack-dsec]').scrollIntoView({block:'center'})");pg.wait_for_timeout(200);pg.screenshot(path=D+who.lower()+'-settings.png')
    pg.click('[data-row=pack-dsec]');pg.wait_for_timeout(200)
    check(pg.evaluate("PACKS.pick('dsec:69',1)") is None,f'{who}: switched off, the double seconds play your own sounds again')
    pg.click('[data-row=pack-tenor]');pg.wait_for_function("PACKS.state.tenor==='ready'",timeout=90000)
    check(pg.evaluate("!!PACKS.pick('tenor:60',1)"),f'{who}: switching the study tenor on gets it ready and plays it')
    pg.reload();pg.wait_for_timeout(1500)
    check(pg.evaluate("[PACKS.on('dsec'),PACKS.on('tenor')]")==[False,True],f'{who}: the choices stay after reopening')
    check(not errs,f'{who}: no errors '+str(errs[:3]))
    ctx.close()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    run(b,'pan-notes-panyard.html',False)
    run(b,'pan-notes-band.html',True)
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
