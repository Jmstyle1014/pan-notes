import os
# Write is part of Studio: the Write tab opens Studio with My part on the pans, Coming up shows the next notes,
# ✚ Step puts notes in one at a time, ⏩ Speed plays the recording slower at the same pitch, the Tempo sheet has
# Find the tempo, ⋯ has Share with your band, and a band member still gets the Write screen.
import json
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
bad=[]
def check(ok,msg):
    print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok:bad.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W,H in [(844,390),(390,844)]:
        tag=f'merge{W}'
        pg=b.new_page(viewport={'width':W,'height':H},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
        pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.click('[data-r=producer]');pg.wait_for_timeout(300)
        E(pg,"SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1500)
        E(pg,"SETUP.show('rec')");pg.set_input_files('#audioFile','Panyard Sunrise.wav');pg.wait_for_timeout(3000)
        E(pg,"showView('home')");pg.wait_for_timeout(300)
        # the Write tab
        pg.click('.tabs [data-tab=write]');pg.wait_for_timeout(1500)
        st=E(pg,"[document.body.dataset.view,STUDIO.view(),STUDIO.selType(),document.querySelector('.tabs [data-tab=write]').getAttribute('aria-selected')]")
        check(st==['studio','inst','part','true'],tag+': the Write tab opens Studio with My part on the pans, and Write is lit '+json.dumps(st))
        nx=E(pg,"(()=>{const b=document.getElementById('stNext');return b&&b.offsetParent?[...b.querySelectorAll('.st-nx')].map(x=>x.textContent):null})()")
        check(nx is not None and len(nx)>0,tag+': Coming up shows the next notes '+json.dumps(nx))
        pg.screenshot(path=D+tag+'-write.png')
        # Coming up follows the song
        E(pg,"STUDIO.seek(8)");pg.wait_for_timeout(200)
        first=E(pg,"(()=>{const c=document.querySelector('#stNext .st-nx');return c&&+c.dataset.v})()")
        check(first is not None and first>=7-.05,tag+': after moving to bar 3, Coming up starts there (or with the note still ringing) ('+str(first)+')')
        # ✚ Step: a chord at the playhead, → , one more note
        E(pg,"S.cues=[];save();STUDIO.seek(4)");pg.wait_for_timeout(200)
        pg.click('#stNext [data-st=step]');pg.wait_for_timeout(200)
        ids=E(pg,"[...document.querySelectorAll('#stPans .field')].slice(0,3).map(e=>e.dataset.field)")
        def tap(i):
            bx=pg.locator(f'#stPans .field[data-field="{i}"]').bounding_box();pg.mouse.click(bx['x']+bx['width']/2,bx['y']+bx['height']/2,delay=20);pg.wait_for_timeout(120)
        tap(ids[0]);tap(ids[1]);pg.click('#stNext [data-st=stepgo][data-v="1"]');pg.wait_for_timeout(150);tap(ids[2])
        cs=E(pg,"S.cues.map(c=>[c.start,c.steps.length])");g=E(pg,"[STUDIO.songGeo().spb,STUDIO.songGeo().origin]")
        want0=g[1]+4*g[0];want1=g[1]+4.5*g[0]
        check(len(cs)==2 and abs(cs[0][0]-want0)<.01 and cs[0][1]==2 and abs(cs[1][0]-want1)<.01,tag+': ✚ Step put a chord at bar 2 and a note half a beat later '+json.dumps(cs))
        pg.screenshot(path=D+tag+'-step.png')
        E(pg,"STUDIO.undo()");pg.wait_for_timeout(150)
        check(E(pg,"S.cues.length")==1,tag+': ↶ Undo takes the last step note back')
        pg.click('#stNext [data-st=step]');pg.wait_for_timeout(100)
        # ⏩ Speed: the recording is stretched to twice as long and the beats run at half speed
        E(pg,"window._bs=[];const s0=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(){if(this.buffer&&this.buffer.duration>20)window._bs.push(this.buffer.duration);return s0.apply(this,arguments)};0")
        E(pg,"STUDIO.setSpeed(.5)");E(pg,"new Promise(r=>{const go=()=>STUDIO.speed()===.5?r():setTimeout(go,100);go()})")
        E(pg,"STUDIO.seek(0);STUDIO.play(false)");pg.wait_for_timeout(300);b0=E(pg,"STUDIO.beatNow()");pg.wait_for_timeout(1000);b1=E(pg,"STUDIO.beatNow()");E(pg,"STUDIO.stop()")
        bpm=E(pg,"STUDIO.bpm");rate=(b1-b0)/(bpm/60)
        dur=E(pg,"(()=>{const t=STUDIO.song.tracks.find(t=>t.type==='practice');return STUDIO.buffers&&0})()")
        bs=E(pg,"window._bs");pd=E(pg,"STUDIO.pDur()")
        check(abs(rate-.5)<.08,tag+': at ½ speed the beats go half as fast (%.2f)'%rate)
        check(bs and (pd is None or abs(bs[-1]-2*pd)<1),tag+': the recording plays stretched to twice as long, at the same pitch '+json.dumps([bs[-1:] ,pd]))
        lcd=E(pg,"document.getElementById('stTempo').textContent")
        check('½' in lcd,tag+': the tempo shows ½× '+lcd)
        E(pg,"STUDIO.setSpeed(1)");pg.wait_for_timeout(200)
        # the Tempo sheet has the timing panel (Find the tempo); closing it puts it back for the old Write screen
        E(pg,"STUDIO.tempoSheet()");pg.wait_for_timeout(300)
        tm=E(pg,"(()=>{const a=document.getElementById('autoTempo');return [!!a&&!!a.offsetParent,!!document.querySelector('#stSheet #gridBox'),!!document.querySelector('#stSheet .st-speed')]})()")
        check(tm==[True,True,True],tag+': Tempo sheet: speed and ✨ Find the tempo for me '+json.dumps(tm))
        pg.screenshot(path=D+tag+'-tempo.png')
        E(pg,"STUDIO.closeSheet()");pg.wait_for_timeout(200)
        check(E(pg,"document.getElementById('gridBox').parentNode.id==='tlTools'"),tag+': the timing panel goes back to the Write screen')
        # Share with your band from ⋯
        pg.click('#gbMore');pg.wait_for_timeout(200)
        menu=E(pg,"[...document.querySelectorAll('#gbMenu button')].map(b=>b.textContent)")
        check(any('Share with your band' in m for m in menu) and any('Playback speed' in m for m in menu),tag+': ⋯ has Playback speed and Share with your band')
        pg.screenshot(path=D+tag+'-menu.png')
        pg.click('#gbShare');pg.wait_for_timeout(300)
        check(E(pg,"!document.getElementById('shareSheet').hidden"),tag+': Share with your band opens')
        E(pg,"openShare(false)")
        # a band member still has the Write screen
        E(pg,"localStorage.setItem('panyard-role',JSON.stringify({role:'band',pan:'tenor'}));ROLE.apply()");pg.wait_for_timeout(300)
        pg.click('.tabs [data-tab=write]');pg.wait_for_timeout(800)
        check(E(pg,"document.body.dataset.view")=='cues',tag+': a band member\'s Write tab opens the Write screen')
        check(not errs,tag+': no page errors '+json.dumps(errs[:3]))
        pg.close()
    b.close()
print('PASS' if not bad else 'FAILED: '+'; '.join(bad))
