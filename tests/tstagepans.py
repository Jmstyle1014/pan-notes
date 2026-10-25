import os
# Studio → Stage: every player shows their own set of pans (a tenor 1, the doubles 2, four cello 4, six bass 6, seven
# bass 7), the stage fills the screen without scrolling, + / − / the wheel zoom (the little map shows where you are),
# dragging the floor looks round, dragging a section moves it, and holding a set of pans then dragging moves one player.
import json,sys
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/tstagepans/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok:fails.append(msg)
WANT={'tenor':1,'dten':2,'dsec':2,'guitar':2,'fcello':4,'six':6,'seven':7}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for nm,W,H in [('land',844,390),('up',390,844)]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}))")
        pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
        for k in WANT:
            pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click(f'[data-st=addk][data-v=pan][data-set={k}]');pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('#stViews [data-sv=stage]').click()");pg.wait_for_timeout(700)
        got=pg.evaluate("Object.fromEntries([...document.querySelectorAll('#stStage .stg-sec')].filter(g=>g.dataset.k!=='me').map(g=>[g.dataset.k,[...g.querySelectorAll('.stg-pl')].map(p=>p.querySelectorAll('.stg-face').length)]))")
        check(all(k in got and all(c==v for c in got[k]) for k,v in WANT.items()),f'{nm}: each player has their real set of pans {got}')
        fit=pg.evaluate("(()=>{const s=document.getElementById('stStage').getBoundingClientRect(),f=document.getElementById('stgFloor').getBoundingClientRect();return[Math.round(s.bottom),innerHeight,document.scrollingElement.scrollHeight<=innerHeight+2,Math.round(f.height)]})()")
        check(fit[0]<=fit[1]+1 and fit[2],f'{nm}: the stage fits the screen, nothing to scroll {fit}')
        pg.screenshot(path=D+nm+'-1-fit.png')
        sc=lambda:pg.evaluate("+/scale\\(([\\d.]+)/.exec(document.getElementById('stgW').getAttribute('transform'))[1]")
        z0=sc();pg.evaluate("document.querySelector('[data-stg=zin]').click()");pg.evaluate("document.querySelector('[data-stg=zin]').click()");z1=sc()
        check(z1>z0*1.6 and not pg.evaluate("document.getElementById('stgMini').hidden"),f'{nm}: ＋ zooms in and the little map shows ({z0:.2f} → {z1:.2f})')
        # the six bass section's first player, zoomed in
        g=pg.locator('#stStage .stg-sec[data-k=six] .stg-pl').first.bounding_box()
        pg.screenshot(path=D+nm+'-2-zoomed.png')
        # drag the empty floor: the view moves, nothing on the stage does
        f=pg.locator('#stgFloor').bounding_box();t0=pg.evaluate("document.getElementById('stgW').getAttribute('transform')");st0=pg.evaluate("JSON.stringify(STUDIO.song.tracks.map(t=>t.st))")
        pg.evaluate("""()=>{const f=document.getElementById('stgFloor'),r=f.getBoundingClientRect();const at=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest('.stg-sec')};
          for(let y=r.top+10;y<r.bottom-10;y+=12)for(let x=r.left+10;x<r.right-60;x+=12)if(!at(x,y)&&document.elementFromPoint(x,y)&&document.elementFromPoint(x,y).closest('#stgFloor')&&!document.elementFromPoint(x,y).closest('.stg-zm,.stg-mini')){window._ex=[x,y];return}}""")
        ex=pg.evaluate("window._ex")
        pg.mouse.move(ex[0],ex[1]);pg.mouse.down();pg.mouse.move(ex[0]-40,ex[1]-30,steps=5);pg.mouse.up();pg.wait_for_timeout(150)
        check(pg.evaluate("document.getElementById('stgW').getAttribute('transform')")!=t0 and pg.evaluate("JSON.stringify(STUDIO.song.tracks.map(t=>t.st))")==st0,f'{nm}: dragging the floor looks round and moves nothing')
        pg.evaluate("document.querySelector('[data-stg=fit]').click()");pg.wait_for_timeout(100)
        check(abs(sc()-z0)<.01,f'{nm}: ⤢ fits the whole stage again')
        # hold one bass player still, then drag: just that player moves
        six0=pg.evaluate("JSON.stringify(STUDIO.song.tracks.find(t=>t.panSet==='six').st)")
        g=pg.locator('#stStage .stg-sec[data-k=six] .stg-pl[data-i="1"] .stg-face').first.bounding_box();x,y=g['x']+g['width']/2,g['y']+g['height']/2
        pg.mouse.move(x,y);pg.mouse.down();pg.wait_for_timeout(500);pg.mouse.move(x+40,y+25,steps=6);pg.mouse.up();pg.wait_for_timeout(300)
        six1=pg.evaluate("STUDIO.song.tracks.find(t=>t.panSet==='six').st")
        s0=json.loads(six0)
        check(six1.get('pp') and '1' in six1['pp'] and abs(six1['x']-s0['x'])<1e-6 and abs(six1['y']-s0['y'])<1e-6,f'{nm}: hold and drag moves just one player {six1.get("pp")}')
        pg.screenshot(path=D+nm+'-3-one-player.png')
        has=pg.evaluate("!!document.querySelector('[data-stg=line]')")
        check(has,f'{nm}: ⇆ In line shows once a player has moved')
        if has:pg.evaluate("document.querySelector('[data-stg=line]').click()");pg.wait_for_timeout(150)
        check(not pg.evaluate("STUDIO.song.tracks.find(t=>t.panSet==='six').st.pp"),f'{nm}: ⇆ In line puts them back')
        # a quick drag on a section moves the whole section
        g=pg.locator('#stStage .stg-sec[data-k=tenor] .stg-face').first.bounding_box();x,y=g['x']+g['width']/2,g['y']+g['height']/2
        tx0=pg.evaluate("STUDIO.song.tracks.find(t=>t.panSet==='tenor').st.x")
        pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x-30,y,steps=3);pg.mouse.move(x-W*.2,y,steps=5);pg.mouse.up();pg.wait_for_timeout(300)
        tx1=pg.evaluate("STUDIO.song.tracks.find(t=>t.panSet==='tenor').st.x")
        check(tx1<tx0-.1,f'{nm}: dragging a section moves the whole section ({tx0:.2f} → {tx1:.2f})')
        # the wheel zooms too (a computer)
        z=sc();f=pg.locator('#stgFloor').bounding_box();pg.mouse.move(f['x']+f['width']/2,f['y']+f['height']/2);pg.mouse.wheel(0,-300);pg.wait_for_timeout(150)
        check(sc()>z*1.2,f'{nm}: the mouse wheel zooms')
        # layouts: the yard and the road move everyone, ↶ Undo brings the stage back
        st0=pg.evaluate("JSON.stringify(STUDIO.song.tracks.map(t=>t.st&&[t.st.x,t.st.y]))")
        pg.evaluate("document.querySelector('[data-stg=lay]').click()");pg.wait_for_timeout(400)
        cards=pg.evaluate("document.querySelectorAll('#stSheet [data-st=stglay]').length")
        pg.screenshot(path=D+nm+'-4-layouts.png')
        pg.evaluate("document.querySelector('#stSheet .stg-lay[data-v=yard]').click()");pg.wait_for_timeout(500)
        y=pg.evaluate("[STUDIO.song.stage.layout,JSON.stringify(STUDIO.song.tracks.map(t=>t.st&&[t.st.x,t.st.y])),Object.fromEntries(STUDIO.song.tracks.filter(t=>t.st).map(t=>[t.panSet||t.type,t.st.y]))]")
        check(cards>=4 and y[0]=='yard' and y[1]!=st0 and y[2].get('tenor',0)>y[2].get('six',1),f'{nm}: Pan yard moves the band, frontline in front of the basses {y[2]}')
        pg.screenshot(path=D+nm+'-5-yard.png')
        pg.evaluate("document.querySelector('[data-stg=lay]').click()");pg.wait_for_timeout(300);pg.evaluate("document.querySelector('#stSheet .stg-lay[data-v=road]').click()");pg.wait_for_timeout(500)
        check(pg.evaluate("STUDIO.song.stage.layout")=='road' and pg.evaluate("!!document.querySelector('#stgW')"),f'{nm}: On the road')
        pg.screenshot(path=D+nm+'-6-road.png')
        pg.evaluate("STUDIO.undo();STUDIO.undo()");pg.wait_for_timeout(400)
        check(pg.evaluate("JSON.stringify(STUDIO.song.tracks.map(t=>t.st&&[t.st.x,t.st.y]))")==st0,f'{nm}: ↶ Undo puts the band back on the stage')
        check(not errs,f'{nm}: no errors {errs[:2]}');ctx.close()
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
