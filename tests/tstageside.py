import os,sys
from playwright.sync_api import sync_playwright
# Stage side (Studio → Stage): the band set up like Panorama. Sections stand where they belong, light up as they
# play, move by dragging (and that changes how they sound from the judges' seat), and can be copied, given more
# players, muted or soloed. Every track keeps its place after reopening.
D=os.environ['WORK']+'/tstageside/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
NOTES="""()=>{const S_=STUDIO.song;for(const t of S_.tracks){if(t.type==='pan'){const ids=[...FIELDS.keys()].filter(k=>(FIELDS.get(k).set||'guitar')===t.panSet).slice(0,6);t.notes=[];for(let i=0;i<32;i++)t.notes.push({t:i*.5,d:.4,p:ids[i%ids.length],v:.9})}
  if(t.type==='drums'){t.notes=[];for(let i=0;i<32;i++)t.notes.push({t:i*.5,d:.2,p:[36,38,42][i%3],v:.9})}}}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W,H,nm in [(412,892,'up'),(892,412,'land')]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2,has_touch=True);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        ctx.add_init_script("if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
        pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
        for k in ['tenor','dsec','guitar','fcello','six']:
            pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click(f'[data-st=addk][data-v=pan][data-set={k}]');pg.wait_for_timeout(350)
        pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click('[data-st=addk][data-v=drums][data-set=rusty]');pg.wait_for_timeout(350)
        pg.evaluate(NOTES)
        pg.evaluate("document.querySelector('#stViews [data-sv=stage]').click()");pg.wait_for_timeout(600)
        n=pg.evaluate("document.querySelectorAll('#stStage .stg-sec').length");check(n==7,f'{nm}: every track is a section on the stage, My part too ({n})')
        pos=pg.evaluate("Object.fromEntries([...document.querySelectorAll('#stStage .stg-sec')].map(g=>[g.dataset.k+(g.dataset.k==='guitar'?'':''),g.getBoundingClientRect().top]))")
        check(pos['tenor']>pos['dsec']>pos['six'] and pos['engine']<pos['guitar'],f'{nm}: tenors at the front, seconds behind, basses and engine room at the back {pos}')
        check(not pg.evaluate("document.querySelector('.st-tlp').offsetParent"),f'{nm}: the timeline makes way for the stage')
        # play: sections light up
        pg.evaluate("STUDIO.seek(0)");pg.click('#stPlay') if pg.locator('#stPlay').is_visible() else pg.evaluate("$('stPlay').click()");pg.wait_for_timeout(1500)
        lit=pg.evaluate("document.querySelectorAll('#stStage .stg-sec.lit').length");check(lit>=3,f'{nm}: sections light up as they play ({lit})')
        pg.screenshot(path=D+nm+'-1-playing.png')
        pg.evaluate("$('stPlay').click()");pg.wait_for_timeout(300)
        # sound from the judges' seat: tenors near and centre, basses far and to the side
        mx=pg.evaluate("Object.fromEntries(STUDIO.song.tracks.filter(t=>t.type==='pan').map(t=>[t.panSet,STUDIO.stageMix(t)]))")
        check(mx['tenor']['gain']>mx['six']['gain'] and abs(mx['six']['pan'])>.4 and mx['six']['wet']>mx['tenor']['wet'],f'{nm}: from the judges the tenors are near, the basses far and to the side')
        # drag the tenors to the left
        g=pg.locator('#stStage .stg-sec[data-k=tenor] .stg-p').first.bounding_box();x,y=g['x']+g['width']/2,g['y']+g['height']/2
        pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x-60,y-10,steps=4);pg.mouse.move(x-W*.3,y-20,steps=6);pg.mouse.up();pg.wait_for_timeout(300)
        t=pg.evaluate("(()=>{const t=STUDIO.song.tracks.find(t=>t.panSet==='tenor');return [t.st.x,STUDIO.stageMix(t).pan]})()")
        check(t[0]<.35 and t[1]<-.2,f'{nm}: dragging the tenors left moves them and they sound from the left {t}')
        # the card: more players, copy, solo
        pg.evaluate("document.querySelector('[data-stg=more]').click()");n2=pg.evaluate("STUDIO.song.tracks.find(t=>t.panSet==='tenor').st.n");check(n2==5,f'{nm}: ＋ adds a player ({n2})')
        pg.evaluate("document.querySelector('[data-stg=dup]').click()");pg.wait_for_timeout(200)
        c=pg.evaluate("STUDIO.song.tracks.filter(t=>t.panSet==='tenor').map(t=>[t.name,t.notes.length])");check(len(c)==2 and c[0][1]==c[1][1],f'{nm}: ⧉ Copy makes a second tenor section with the same notes {c}')
        pg.evaluate("document.querySelector('#stStage [data-st=solo]').click()");pg.wait_for_timeout(200)
        off=pg.evaluate("document.querySelectorAll('#stStage .stg-sec.off').length");check(off>=5,f'{nm}: solo fades the other sections ({off})')
        pg.evaluate("document.querySelector('#stStage [data-st=solo]').click()")
        pg.evaluate("document.querySelector('[data-stg=hear][data-v=off]').click()");check(pg.evaluate("STUDIO.stageMix(STUDIO.song.tracks.find(t=>t.panSet==='six'))") is None,f'{nm}: As mixed turns the stage sound off')
        pg.evaluate("document.querySelector('[data-stg=hear][data-v=judges]').click()")
        pg.screenshot(path=D+nm+'-2-arranged.png')
        # kept after reopening
        pg.wait_for_timeout(800);pg.reload();pg.wait_for_timeout(1300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1200)
        k=pg.evaluate("STUDIO.song.tracks.filter(t=>t.panSet==='tenor').map(t=>t.st&&[+t.st.x.toFixed(2),t.st.n])");check(len(k)==2 and k[0][0]<.35,f'{nm}: the stage is kept after reopening {k}')
        check(not errs,f'{nm}: no errors {errs[:2]}');ctx.close()
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
