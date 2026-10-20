import os
import json
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
def run(mode,loop=False,stop_at=6.0,start=0):
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':844,'height':390});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))")
        pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.goto('https://pan.test/');pg.wait_for_timeout(900);E(pg,"(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(300)
        E(pg,"showView('studio')");pg.wait_for_timeout(1200)
        E(pg,"""([m,loop,st])=>{STUDIO.setTempo(120);const S_=STUDIO.song;S_.countIn=false;S_.recMode=m;S_.metro=false;
          window._tr=null;document.querySelector('[data-st=addsheet]').click()}""",[mode,loop,start]);pg.wait_for_timeout(300)
        pg.click('[data-st=addk][data-v=pan][data-set=six]');pg.wait_for_timeout(400)
        # an old part: a note on every beat for 4 bars (beats 0-15), named old
        E(pg,"(()=>{const t=STUDIO.song.tracks.at(-1);t.notes=[];for(let i=0;i<16;i++)t.notes.push({t:i,d:.5,p:'six:36',v:.9})})()")
        if loop:E(pg,"STUDIO.song.cycle={on:true,s:0,e:2}")   # bars 1-2 = beats 0-8
        E(pg,"b=>STUDIO.seek(b)",start);pg.wait_for_timeout(200)
        pg.click('#stRec');
        f=[x for x in pg.query_selector_all('#stPans .field[data-field="six:40"]') if x.bounding_box()][0];bx=f.bounding_box()
        E(pg,"b=>new Promise(r=>{const go=()=>{if(STUDIO.beatNow()>=b)r();else requestAnimationFrame(go)};go()})",start+0.5)
        pg.mouse.click(bx['x']+bx['width']/2,bx['y']+bx['height']/2)
        E(pg,"b=>new Promise(r=>{let n=0;const s=performance.now();const go=()=>{if(performance.now()-s>b*500)r();else requestAnimationFrame(go)};go()})",stop_at-start)
        pg.click('#stPlay');pg.wait_for_timeout(400)
        r=E(pg,"(()=>{const t=STUDIO.song.tracks.at(-1);return {old:t.notes.filter(n=>n.p==='six:36').map(n=>n.t),new:t.notes.filter(n=>n.p==='six:40').map(n=>+n.t.toFixed(2)),takes:t.takes&&t.takes.map(k=>k.name),pos:+STUDIO.beatNow().toFixed(2)}})()")
        b.close();return r,errs
for args in [('add',),('replace',),('take',),('replace',True,9.0)]:
    r,e=run(*args);print(args,'stopped at beat',r['pos'],'| old notes kept:',r['old'],'| new:',r['new'],'| takes:',r['takes'],e)
