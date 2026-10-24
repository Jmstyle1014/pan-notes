import os
# Studio's count lines: the metronome clicks land on the ruler's beat lines, the lines and numbers get finer as you
# zoom in (bars, then 1.2 1.3…, then 1.2.2…), 3/4 counts in threes, and the playhead waits for the speaker.
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
    pg=b.new_page(viewport={'width':844,'height':390},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
    pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.click('[data-r=producer]');pg.wait_for_timeout(300)
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    if E(pg,"document.body.classList.contains('st-inst')"):pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(500)
    # only the metronome sounds: every other track muted
    E(pg,"STUDIO.setTempo(120);STUDIO.song.metro=true;STUDIO.song.countIn=false;STUDIO.song.click={sound:'wood',level:.8};STUDIO.song.tracks.forEach(t=>t.mute=true);STUDIO.seek(0)")
    E(pg,"window._cl=[];const s0=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(t){const f=this.frequency.value;if(f===950||f===1250)window._cl.push([t,f===1250]);return s0.apply(this,arguments)};0")
    def clicks(secs):
        E(pg,"window._cl=[];STUDIO.seek(0);STUDIO.play(false)");pg.wait_for_timeout(int(secs*1000))
        r=E(pg,"(()=>{const T=STUDIO.T,sp=60/STUDIO.bpm;return window._cl.map(([t,a])=>[+(T.b0+(t-T.t0)/sp).toFixed(4),a])})()");E(pg,"STUDIO.stop(true)");return r
    c=clicks(2.4)
    check(len(c)>=4 and all(abs(x-round(x))<.002 for x,_ in c),'4/4 clicks fall exactly on beats: '+json.dumps(c[:6]))
    check(all(a==(round(x)%4==0) for x,a in c),'the loud click is beat 1 of each bar')
    # after ■ Stop nothing more is lined up (the click stops with the song)
    E(pg,"window._cl=[]");pg.wait_for_timeout(800)
    check(len(E(pg,"window._cl"))==0 and not E(pg,"STUDIO.T.playing"),'after Stop no more clicks are lined up')
    # the lines and numbers at each zoom
    def ruler():
        return E(pg,"(()=>{const i=document.querySelector('.st-inner'),bar=parseFloat(i.style.getPropertyValue('--bar')),bt=parseFloat(i.style.getPropertyValue('--bt'));"
                 "return{cls:i.className,bar,bt,beats:[...document.querySelectorAll('#stRuler .st-btn:not(.st-btq)')].slice(0,8).map(e=>[e.textContent,parseFloat(e.style.left)]),"
                 "q:document.querySelectorAll('#stRuler .st-btq').length,bars:[...document.querySelectorAll('#stRuler .st-barn')].slice(0,4).map(e=>e.textContent)}})()")
    def zoom(k):
        for _ in range(abs(k)):pg.click('[data-st=zin]' if k>0 else '[data-st=zout]');pg.wait_for_timeout(80)
    r=ruler();check('gb' in r['cls'] and not r['beats'],'zoomed normally: bar and beat lines, bar numbers only '+r['cls']+' '+json.dumps(r['bars']))
    zoom(4);r=ruler();pg.screenshot(path=D+'grid-beats.png')
    def at(lbl,bt,B):
        bar,k=lbl.split('.')[:2];return ((int(bar)-1)*B+int(k)-1)*bt
    check(r['beats'][:3]and r['beats'][0][0]=='1.2' and all(abs(x-at(l,r['bt'],4))<.5 for l,x in r['beats']),'zoomed in: 1.2 1.3 1.4 sit on the beat lines '+json.dumps(r['beats'][:4]))
    check('g2' in r['cls'],'zoomed in: half-beat lines too '+r['cls'])
    zoom(5);r=ruler();pg.screenshot(path=D+'grid-quarters.png')
    check(r['q']>0 and 'g4' in r['cls'],'zoomed right in: quarter-beat lines and 1.1.2… numbers ('+str(r['q'])+')')
    # every click is on a beat line: a beat line is at k*bt
    check(all(abs(round(x)*r['bt']-x*r['bt'])<1 for x,_ in c),'each click is within a pixel of its beat line')
    zoom(-13);r=ruler();pg.screenshot(path=D+'grid-out.png')
    check(r['bars'][:2]==['1','3'] or r['bar']>=28,'zoomed far out: every 2nd bar number so they don\'t crowd '+json.dumps(r['bars'])+' bar '+str(r['bar']))
    zoom(4)
    # 3/4
    E(pg,"STUDIO.setTempo(120,{perBar:3})");pg.wait_for_timeout(200);zoom(4);r=ruler()
    labels=[l for l,_ in r['beats']]
    check('1.4' not in labels and '1.3' in labels and all(abs(x-at(l,r['bt'],3))<.5 for l,x in r['beats']),'3/4: counts 1 2 3 '+json.dumps(labels[:5]))
    c=clicks(2.0)
    check(all(a==(round(x)%3==0) for x,a in c) and len(c)>=3,'3/4: loud click every 3 beats '+json.dumps(c[:5]))
    E(pg,"STUDIO.setTempo(120,{perBar:4})");zoom(-4)
    # the zoom buttons stay inside the corner, off the ruler
    z=E(pg,"(()=>{const c=document.querySelector('.st-ruler .st-corner').getBoundingClientRect(),z=document.querySelector('.st-ruler .st-zm').getBoundingClientRect();return[c.right,z.right]})()")
    check(z[1]<=z[0]+.5,'the zoom buttons don\'t cover the ruler '+json.dumps(z))
    # the playhead and the counter wait for the speaker: with a 0.25 s speaker delay they trail the sound by half a beat at 120
    E(pg,"Object.defineProperty(panCtx(),'outputLatency',{get:()=>.25,configurable:true})")
    E(pg,"STUDIO.seek(0);STUDIO.play(false)");pg.wait_for_timeout(1500)
    d=E(pg,"[STUDIO.beatNow()-STUDIO.heardNow()]")[0]
    pg.wait_for_timeout(100)
    ph=E(pg,"(()=>{const m=/translateX\\(([-\\d.]+)px/.exec(document.getElementById('stPh').style.transform),bar=parseFloat(document.querySelector('.st-inner').style.getPropertyValue('--bar'));return [+m[1]/(bar/4),STUDIO.heardNow(),STUDIO.beatNow()]})()")
    E(pg,"STUDIO.stop(true)")
    check(abs(d-.5)<.08,'heard position trails the sound by the speaker delay: %.3f beats (want 0.5)'%d)
    check(abs(ph[0]-ph[1])<abs(ph[0]-ph[2]),'the playhead follows what you hear '+json.dumps(ph))
    check(not errs,'no page errors '+json.dumps(errs[:3]))
    b.close()
print('PASS' if not bad else 'FAILED: '+'; '.join(bad))
