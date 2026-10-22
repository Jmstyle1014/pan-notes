import os,sys
import numpy as np
from playwright.sync_api import sync_playwright
# Our yard (Band sound): measured from the band's practice recordings. Yard hum makes the song's key notes ring on
# after you play, Yard air warms the top, and the key follows the song's own notes.
D=os.environ['WORK']+'/tyard/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode&&!d._tap){const ac=d.context,sp=ac.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};_c.call(this,sp);_c.call(sp,d);d._tap=1}return _c.call(this,d,...a)}})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.evaluate("()=>{panCtx();TW.open(true);TW.tabTo('sound')}");pg.wait_for_timeout(500)
    check(pg.locator('.bcard[data-b=ouryard]').count()==1,'Band sound has Our yard')
    pg.evaluate("document.querySelector('.bcard[data-b=ouryard]').click()");pg.wait_for_timeout(4000)
    b_=pg.evaluate("BAND.forSong()");check(b_['hum']==1 and b_['air']==1 and b_['room']=='ouryard' and b_['a']==441,f'Our yard: hum, air, its room, A 441 {b_}')
    pg.evaluate("document.querySelector('[data-tog=hum]').scrollIntoView({block:'center'})");pg.wait_for_timeout(200);pg.screenshot(path=D+'1-card.png')
    def tail(note):
        pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate("n=>strike(n,.9)",note);pg.wait_for_timeout(4200);pg.evaluate("()=>window._on=0")
        x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]);sr=pg.evaluate("panCtx().sampleRate");x=x[np.argmax(abs(x)>0.01):]
        s=lambda a,c:10*np.log10((x[int(a*sr):int(c*sr)]**2).mean()+1e-12);return round(s(0,.3),1),round(s(2,3),1),float(abs(x).max())
    on=tail('c')
    pg.evaluate("document.querySelector('[data-tog=hum]').click()");pg.wait_for_timeout(4500)
    off=tail('c');print('hum on',on,'off',off)
    check(on[1]>off[1]+12,'with Yard hum the key notes keep ringing after the note (2-3 s much louder)')
    check(abs(on[0]-off[0])<3,'the note itself is as loud as before')
    check(on[2]<1.0,'no clipping')
    # the key follows the song: a song of all Gs
    pg.evaluate("document.querySelector('[data-tog=hum]').click()");pg.wait_for_timeout(300)
    pg.evaluate("()=>{S.cues=Array.from({length:12},(_,i)=>({id:uid(),start:i,duration:.5,steps:['g-low'],mode:'together',note:''}));applyFx()}");pg.wait_for_timeout(300)
    k=pg.evaluate("BAND.keyOf()");check(k[7]==1 and k[0]<0.3,f'the hum follows the song\'s own notes (all Gs: {k})')
    # a loud chord with the hum on stays clean
    pg.evaluate("()=>{window._rec=[];window._on=1;['c','e-top','g-inner','bb','eb-top','gs-low'].forEach(n=>strike(n,1))}");pg.wait_for_timeout(2500);pg.evaluate("()=>window._on=0")
    pk=max(max(abs(v) for v in r) for r in pg.evaluate("window._rec"));check(pk<1.0,f'a loud chord with the hum stays under clipping ({pk:.2f})')
    check(not errs,f'no errors {errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
