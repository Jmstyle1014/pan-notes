import os,sys
from playwright.sync_api import sync_playwright
# Real note sizes (Settings → Pan layout): higher notes are drawn smaller, each semitone about 96% of the width of the
# one below on its ring or drum (93% of the area, G-Pan patent), never below 68%. Off by default; the Double Guitar
# never changes; every note still taps to itself.
D=os.environ['WORK']+'/treal/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
TAPS="""sel=>{let ok=0,n=0;for(const f of document.querySelectorAll(sel+' .field')){const t=f.querySelector('text');if(!t)continue;const r=t.getBoundingClientRect();if(!r.width||r.top<0||r.bottom>innerHeight-60)continue;n++;const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(e&&e.closest('.field')===f)ok++}return [ok,n]}"""
AREA="""k=>{const o={};for(const f of document.querySelectorAll('#editPans .field')){const z=f.querySelector('.zone').getBoundingClientRect();o[f.dataset.field]=Math.round(z.width*z.height)}return o}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=True);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
    check(not pg.evaluate("REAL.on()"),'off by default')
    def show(k):pg.evaluate("k=>{isDemo=false;S.panSet=k;applyPanSet();renderAll()}",k);pg.evaluate("showView('cues')");pg.wait_for_timeout(700)
    before={}
    for k in ['tenor','dten','dsec','fcello','six','seven','guitar']:show(k);before[k]=pg.evaluate(AREA,k)
    show('tenor');pg.screenshot(path=D+'tenor-before.png')
    pg.evaluate("ARRANGE.open()");pg.wait_for_timeout(400);check(pg.locator('#arReal').count()==1,'Pan layout has Real note sizes');pg.screenshot(path=D+'switch.png')
    pg.click('#arReal');pg.wait_for_timeout(300);pg.click('[data-ar=done]');pg.wait_for_timeout(500);check(pg.evaluate("REAL.on()"),'switched on')
    for k in ['tenor','dten','dsec','fcello','six','seven','guitar']:
        show(k);after=pg.evaluate(AREA,k)
        r={i:after[i]/before[k][i] for i in after if before[k].get(i)}
        if k=='guitar':check(all(abs(v-1)<.02 for v in r.values()),'Double Guitar unchanged');continue
        hi=max(r,key=lambda i:-r[i]);ms=sorted(r.items(),key=lambda x:int(x[0].split(':')[1]))
        check(min(r.values())>=.68**2-.03 and max(r.values())<=1.02,f'{k}: notes shrink by pitch, never below 68% ({min(r.values()):.2f}–{max(r.values()):.2f} of the area)')
        low=ms[0][1];check(low>.98,f'{k}: the lowest note keeps its size ({low:.2f})')
        t=pg.evaluate(TAPS,'#editPans');check(t[0]==t[1]>0,f'{k}: every note still taps to itself {t}')
        if k in('tenor','six'):pg.screenshot(path=D+k+'-after.png')
    pg.evaluate("showView('play')");pg.set_viewport_size({'width':892,'height':412});pg.wait_for_timeout(800);show('dten');pg.evaluate("showView('play')");pg.wait_for_timeout(800)
    t=pg.evaluate(TAPS,'#playPans');check(t[0]==t[1]>20,f'sideways Play: every Double Tenor note taps to itself {t}');pg.screenshot(path=D+'dten-play.png')
    check(not errs,f'no errors {errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
