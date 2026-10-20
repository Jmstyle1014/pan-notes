import os,json
from playwright.sync_api import sync_playwright
# The Studio's floating edit bar: picking follows the zoom (ticks on the ruler), pink handles stretch the pick,
# the bar sits just above the pick, and its tools (Move, Copy after, Delete, More) still do their jobs.
D=os.environ['WORK']+'/tfloat/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
with sync_playwright() as p:
    b=p.chromium.launch()
    for W,H,name in [(1000,460,'tablet'),(844,390,'phone-sideways'),(390,844,'phone-upright')]:
        ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2,has_touch=True);pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.click('[data-r=producer]');pg.wait_for_timeout(300);pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=tenor]');pg.fill('#nsName','Float test');pg.click('[data-r=create]');pg.wait_for_timeout(1000)
        E(pg,"showView('studio')");pg.wait_for_timeout(1200)
        if E(pg,"document.body.classList.contains('st-inst')"):pg.click('#gbView');pg.wait_for_timeout(500)
        pg.click('[data-st=addsheet]');pg.wait_for_timeout(300);pg.click('[data-st=addk][data-v=pan]');pg.wait_for_timeout(600)
        if E(pg,"document.body.classList.contains('st-inst')"):pg.click('#gbView');pg.wait_for_timeout(500)
        # 8 notes in bar 1 (one each half beat) and 4 in bar 2
        tid=E(pg,"""()=>{const s=STUDIO.song,tr=s.tracks.find(t=>t.type==='pan');const p=tr.notes.length?tr.notes[0].p:Object.keys(PITCH).find(i=>i.includes(':'))||'tenor:60';
          tr.notes=[];for(let i=0;i<8;i++)tr.notes.push({t:i*.5,d:.25,p:typeof p==='string'&&p.includes(':')?+p.split(':')[1]:60,v:.9});for(let i=0;i<4;i++)tr.notes.push({t:4+i,d:.5,p:62,v:.9});s.sel=tr.id;return tr.id}""")
        E(pg,"STUDIO.seek(0)");E(pg,"()=>{const tl=document.querySelector('#stTl');tl.scrollLeft=0}")
        def lane():return pg.locator(f'.st-row[data-tid="{tid}"] .st-lane').bounding_box()
        def state():return E(pg,"()=>{const s=document.querySelector('#stSel'),r=s.getBoundingClientRect(),bx=document.querySelector('#stBsel');const b=bx?bx.getBoundingClientRect():null;return{float:s.classList.contains('st-float'),hidden:s.hidden,off:s.classList.contains('st-off'),below:s.classList.contains('below'),bar:[r.left,r.top,r.right,r.bottom],pick:b?[b.left,b.top,b.right,b.bottom]:null,info:(s.querySelector('.st-selinfo')||{}).textContent||'',ticks:[...document.querySelectorAll('#stRuler .st-tk')].map(t=>t.className.split(' ')[1]),old:!!document.querySelector('.st-selg'),W:innerWidth,H:innerHeight}}")
        # zoom right out: whole bars
        for _ in range(6):E(pg,"document.querySelector('[data-st=zout]').click()")
        pg.wait_for_timeout(200);L=lane();pg.mouse.click(L['x']+5,L['y']+L['height']/2);pg.wait_for_timeout(300)
        s=state();print(name,'zoomed out',json.dumps(s))
        check(not s['ticks'] and 'Bar 1' in s['info'],name+': zoomed out, a tap picks a whole bar and the ruler has no ticks')
        check(not s['old'],name+': no Bar / Beat / ½ / ¼ buttons')
        check(s['float'] and not s['hidden'] and not s['off'],name+': the edit bar floats')
        if s['pick']:
            above=s['bar'][3]<=s['pick'][1]+1;below=s['below'] and s['bar'][1]>=s['pick'][3]-1
            check(above or below,name+': the bar sits just above (or below) the pick')
        check(s['bar'][0]>=0 and s['bar'][2]<=s['W']+0.5,name+': the bar is inside the screen')
        pg.screenshot(path=D+name+'-1-bar.png')
        E(pg,"document.querySelector('[data-st=r-close]').click()");pg.wait_for_timeout(200)
        check(state()['hidden'],name+': ✕ clears the pick')
        # zoom in: ½ beats, then ¼ beats
        for _ in range(12):E(pg,"document.querySelector('[data-st=zin]').click()")
        pg.wait_for_timeout(200);E(pg,"()=>{document.querySelector('#stTl').scrollLeft=0}");pg.wait_for_timeout(100)
        L=lane();bt=E(pg,"document.querySelector('#stRuler').getBoundingClientRect().width/STUDIO.bars()/4")
        pg.mouse.click(L['x']+bt*1.1,L['y']+L['height']/2);pg.wait_for_timeout(300)
        s=state();print(name,'zoomed in',json.dumps(s))
        check('st-tk4' in s['ticks'],name+': zoomed in, the ruler shows ¼ beat ticks')
        check('¼' in s['info'] or 'beat 2' in s['info'],name+': a tap picks a ¼ beat: '+s['info'])
        pg.screenshot(path=D+name+'-2-zoomed.png')
        # drag the right handle across two beats
        h=pg.locator('#stBsel .st-hdl.r').bounding_box();x=h['x']+h['width']/2;y=h['y']+h['height']/2
        pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x+bt*2,y,steps=6);pg.mouse.up();pg.wait_for_timeout(300)
        s=state();print(name,'stretched',s['info'])
        check('2' in s['info'] and 'beat' in s['info'] and 'notes' in s['info'],name+': dragging the handle stretches the pick: '+s['info'])
        n0=E(pg,f"STUDIO.song.tracks.find(t=>t.id==='{tid}').notes.length")
        # More opens above, then Delete
        E(pg,"document.querySelector('[data-selmore]').click()");pg.wait_for_timeout(200)
        mo=E(pg,"!document.querySelector('#stSel .st-selmore').hidden&&[...document.querySelectorAll('#stSel .st-selmore button')].map(b=>b.textContent)")
        check(bool(mo) and any('Add to' in t for t in mo),name+': More shows '+str(mo))
        s=state();check(s['bar'][0]>=0 and s['bar'][2]<=s['W']+0.5 and s['bar'][1]>=0,name+': with More open the bar is still on screen')
        pg.screenshot(path=D+name+'-3-more.png')
        pg.click('#stSel [data-st=r-delete]');pg.wait_for_timeout(300)
        n1=E(pg,f"STUDIO.song.tracks.find(t=>t.id==='{tid}').notes.length")
        check(n1<n0,name+f': Delete removed notes ({n0} -> {n1})')
        E(pg,"STUDIO.undo()");pg.wait_for_timeout(200)
        check(E(pg,f"STUDIO.song.tracks.find(t=>t.id==='{tid}').notes.length")==n0,name+': Undo brings them back')
        # Move ▶ and Copy after still work on a fresh pick
        L=lane();pg.mouse.click(L['x']+2,L['y']+L['height']/2);pg.wait_for_timeout(200)
        before=E(pg,f"STUDIO.song.tracks.find(t=>t.id==='{tid}').notes.map(n=>n.t).join()")
        pg.click('#stSel [data-st=r-right]');pg.wait_for_timeout(200)
        after=E(pg,f"STUDIO.song.tracks.find(t=>t.id==='{tid}').notes.map(n=>n.t).join()")
        check(before!=after,name+': Move ▶ moves the picked notes')
        # scroll the timeline: the bar follows (or hides when the pick is off screen)
        E(pg,"()=>{const tl=document.querySelector('#stTl');tl.scrollLeft=tl.scrollWidth}");pg.wait_for_timeout(250)
        check(state()['off'],name+': the bar hides when the pick scrolls off screen')
        E(pg,"()=>{document.querySelector('#stTl').scrollLeft=0}");pg.wait_for_timeout(250)
        check(not state()['off'],name+': and comes back when it scrolls back')
        check(not errs,name+': no errors '+str(errs[:3]))
        ctx.close()
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
