import os,sys
from playwright.sync_api import sync_playwright
# The Double Tenor (A3–C♯6, flat side of the circle of fifths on the left pan, sharp side on the right) and the
# Seven Bass (G♯1–E3, seven drums of three notes): every note is there once, each plays its own pitch, and both show
# in Write, Play (upright and sideways), Studio and the pan chooser, with every note tapping to itself.
D=os.environ['WORK']+'/tnewpans/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
TAPS="""sel=>{let ok=0,n=0;for(const f of document.querySelectorAll(sel+' .field')){const t=f.querySelector('text');if(!t)continue;const r=t.getBoundingClientRect();if(!r.width||r.top<0||r.bottom>innerHeight-60)continue;n++;const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(e&&e.closest('.field')===f)ok++}return [ok,n]}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for k,name,lo,hi,n in [('dten','Double Tenor','A3','C#6',29),('seven','Seven Bass','G#1','E3',21)]:
        for W,H,nm in [(412,892,'up'),(892,412,'side')]:
            ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2,has_touch=True);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
            pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
            ctx.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
            pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
            pg.evaluate("k=>{isDemo=false;S.panSet=k;applyPanSet();renderAll()}",k);pg.wait_for_timeout(300)
            if nm=='up':
                info=pg.evaluate("k=>{const ids=SETS[k].views.flatMap(v=>v.fields.map(f=>f[0])),ms=ids.map(i=>+i.split(':')[1]).sort((a,b)=>a-b);return [ids.length,new Set(ids).size,PITCH[ids.find(i=>+i.split(':')[1]===ms[0])],PITCH[ids.find(i=>+i.split(':')[1]===ms.at(-1))],ms.every((m,i)=>!i||m===ms[i-1]+1)]}",k)
                check(info[0]==n and info[1]==n,f'{name}: {n} notes, each once {info[:2]}');check(info[2]==lo and info[3]==hi and info[4],f'{name}: {lo} to {hi}, every note in between {info[2:]}')
                pc=pg.evaluate("k=>{const o={};for(const f of SETS[k].views[0].drums.length>1?SETS[k].views[0].fields:[])o[f[8]]=(o[f[8]]||new Set()).add(+f[0].split(':')[1]%12);return Object.values(o).map(s=>[...s].sort((a,b)=>a-b))}",k)
                if k=='dten':check(pc==[[1,3,5,6,8,10],[0,2,4,7,9,11]],f'Double Tenor: flat side on the left pan, sharp side on the right {pc}')
                pg.evaluate("showView('cues')");pg.wait_for_timeout(700);t=pg.evaluate(TAPS,'#editPans');check(t[1]>=n*.6 and t[0]==t[1],f'{name}: Write, every note taps to itself {t}');pg.screenshot(path=D+k+'-write.png')
                ids=pg.evaluate("k=>[...FIELDS.keys()].filter(i=>i.startsWith(k+':'))",k);check(len(ids)==n,f'{name}: notes known to the app ({len(ids)})')
                ok=pg.evaluate("ids=>ids.every(i=>{try{strike(i,.8);return true}catch(e){return false}})",ids);check(ok,f'{name}: every note plays')
            pg.evaluate("showView('play')");pg.wait_for_timeout(800);pg.evaluate("()=>{const e=document.querySelector('#playPans svg');if(e)e.scrollIntoView({block:'center'})}");pg.wait_for_timeout(300);t=pg.evaluate(TAPS,'#playPans');check(t[1]>=n*.6 and t[0]==t[1],f'{name} {nm}: Play, every note taps to itself {t}');pg.screenshot(path=D+k+'-play-'+nm+'.png')
            if nm=='up':
                pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
                pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(300)
                check(pg.locator(f'[data-st=addk][data-v=pan][data-set={k}]').count()==1,f'{name}: Studio can add it')
                pg.click(f'[data-st=addk][data-v=pan][data-set={k}]');pg.wait_for_timeout(900);t=pg.evaluate(TAPS,'#stPans');check(t[1]>=n*.6 and t[0]==t[1],f'{name}: Studio pans tap to themselves {t}');pg.screenshot(path=D+k+'-studio.png')
                pg.evaluate("document.querySelector('#stViews [data-sv=stage]').click()");pg.wait_for_timeout(500);check(pg.locator(f'#stStage .stg-sec[data-k={k}]').count()==1,f'{name}: stands on the Stage')
            check(not errs,f'{name} {nm}: no errors {errs[:2]}');ctx.close()
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
