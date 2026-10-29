import os,sys,json,base64
import numpy as np
from playwright.sync_api import sync_playwright
# Panyard Band: always a band member (no Producer), the band's own pan sounds put in on first open (your pan plays
# them), A = 441 for every song even if a song says otherwise, no Studio / Pan sounds / band sound / tuning / pan
# picker, a sounds file can't replace the sounds, and its saved things stay apart from Panyard's on the same phone.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tbandapp/';os.makedirs(D,exist_ok=True)
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
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);ctx.add_init_script(REC)
    # Panyard on the same phone already has its own things (a Producer, A 432)
    ctx.add_init_script("if(!sessionStorage.getItem('seeded')){localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));sessionStorage.setItem('seeded','1')}")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('dialog',lambda d:d.accept())
    pg.route('https://pan.test/**',route);pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")   # Panyard Band's own guide setting
    # the sounds go in, then it asks for your pan (never Producer)
    pg.wait_for_function("!!localStorage.getItem('panyard-bandsounds')",timeout=60000);pg.wait_for_timeout(800)
    n=pg.evaluate("Object.keys(SAMPLES.wav).length")
    check(n>=125,f'the band\'s pan sounds are in: {n} notes')
    sheet=pg.evaluate("(()=>{const o=$('roleSheet');return o&&!o.hidden?[...o.querySelectorAll('[data-r]')].filter(b=>b.offsetParent).map(b=>b.dataset.r+':'+(b.dataset.v||'')):null})()")
    check(sheet and not any(s.startswith('producer') for s in sheet) and any(s.startswith('section') for s in sheet),f'it asks for your section, with no Producer choice {sheet}')
    pg.screenshot(path=D+'1-section.png')
    pg.click('[data-r=section][data-v=front]');pg.wait_for_timeout(300);pg.screenshot(path=D+'2-pan.png')
    pg.click('[data-r=pan][data-v=tenor]');pg.wait_for_timeout(600)
    check(pg.evaluate("ROLE.band()&&ROLE.pan()")=='tenor','you\'re a band member on the tenor')
    pg.screenshot(path=D+'3-home.png')
    home=pg.evaluate("[document.querySelector('#view-home .hm-top h1').textContent,!!document.querySelector('[data-rs=p]')&&!!document.querySelector('[data-rs=p]').offsetParent]")
    check(home[0]=='Panyard Band' and not home[1],f'Home says Panyard Band and has no Producer switch {home}')
    pg.evaluate("ROLE.toProducer()");check(pg.evaluate("ROLE.band()"),'there\'s no way to become a Producer')
    pg.evaluate("showView('studio')");pg.wait_for_timeout(300);check(pg.evaluate("document.body.dataset.view")!='studio','Studio can\'t be opened')
    tabs=pg.evaluate("[...document.querySelectorAll('.tabs [data-tab]')].filter(t=>t.offsetParent).map(t=>t.dataset.tab)")
    check('studio' not in tabs,f'no Studio tab {tabs}')
    pg.evaluate("showView('setup')");pg.wait_for_timeout(500)
    rows=pg.evaluate("[...document.querySelectorAll('#setList [data-row]')].map(r=>r.dataset.row)")
    check(not any(r in rows for r in ['pan','tune','sound','band']) and 'rec' in rows and 'save' in rows,f'Settings: no pan picker, tuning, Pan sounds or Band sound; Recording and Backup stay {rows}')
    pg.screenshot(path=D+'4-settings.png',full_page=True)
    # tuning: fixed at A 441, whatever a song says
    pg.evaluate("S.refA=432");check(pg.evaluate("[S.refA,Math.round(REF_A()),S.panVoice]")==[441,441,'mine'],'every song plays at A = 441 on the band\'s sounds')
    # your pan plays the band's recording of the note
    pg.evaluate("showView('play')");pg.wait_for_timeout(500)
    tid=pg.evaluate("SETS.tenor.views.flatMap(v=>v.fields.map(f=>f[0])).find(i=>SAMPLES.wav[i])")
    pg.evaluate(f"sampleBuf('{tid}')");pg.wait_for_timeout(500)
    pg.evaluate("()=>{window._rec=[];window._on=1}");pg.evaluate(f"strike('{tid}',.9)");pg.wait_for_timeout(1200);pg.evaluate("()=>window._on=0")
    x=np.concatenate([np.array(r) for r in pg.evaluate("window._rec")]) if pg.evaluate("window._rec.length") else np.zeros(1)
    check(abs(x).max()>.02 and pg.evaluate(f"!!SAMPLES.buf['{tid}']"),f'a tenor note plays the band\'s recording (peak {abs(x).max():.2f})')
    pg.screenshot(path=D+'5-play.png')
    # a sounds file can't replace the band's sounds
    k0=pg.evaluate(f"SAMPLES.wav['{tid}'].size")
    pg.evaluate("SHARE.open({format:SHARE.FMT,name:'x',sounds:{['"+tid+"']:'data:audio/wav;base64,UklGRiQAAABXQVZF'}},false)");pg.wait_for_timeout(300)
    check(pg.evaluate(f"SAMPLES.wav['{tid}'].size")==k0,'opening a sounds file doesn\'t change the band\'s sounds')
    # still has: a new song, Write, My notes
    check(pg.evaluate("typeof songNew==='function'")and pg.evaluate("!!document.querySelector('.tabs [data-tab=write]')"),'Write and new songs are there')
    # kept apart from Panyard: Panyard's own Producer setting is untouched
    real=pg.evaluate("(()=>{const f=document.createElement('iframe');f.src='about:blank';document.body.appendChild(f);const L=f.contentWindow.localStorage;const r=[L.getItem('panyard-role'),L.getItem('pb:panyard-role')];f.remove();return r})()")
    check(real[0] and json.loads(real[0])['role']=='producer' and real[1] and json.loads(real[1])['role']=='band',f'Panyard\'s own settings are untouched (Producer), Panyard Band\'s are its own {real}')
    dbs=pg.evaluate("indexedDB.databases?Promise.resolve(indexedDB.databases()).then(a=>a.map(d=>d.name)):[]")
    check(any(d.startswith('band-') for d in dbs),f'its sounds and songs are in its own storage {dbs}')
    # opening again: no second fetch of the sounds
    pg.reload();pg.wait_for_timeout(3000)
    check(pg.evaluate("ROLE.pan()")=='tenor' and pg.evaluate("Object.keys(SAMPLES.wav).length")>=125 and pg.evaluate("$('bandInst')?$('bandInst').hidden:true"),'opening it again: straight in, still your tenor and the band\'s sounds')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
