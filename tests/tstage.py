import os
import base64,sys
from playwright.sync_api import sync_playwright
src=sys.argv[1];tag=sys.argv[2];sizes=[(844,390,'side'),(1180,820,'ipad'),(390,844,'up')]
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(src).read()+'</body></html>'
wav=base64.b64encode(open('beat118.wav','rb').read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for k in sys.argv[3].split(','):
      for W,H,nm in sizes:
        pg=b.new_page(viewport={'width':W,'height':H},device_scale_factor=1);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.goto('https://pan.test/');pg.wait_for_timeout(900)
        pg.evaluate("""([w,k])=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);isDemo=false;S.cues=[];loadAudio(new Blob([u],{type:'audio/wav'}),'Beat');S.panSet=k;applyPanSet();S.grid={bpm:118,offset:0.424,perBar:4};renderAll();localStorage.setItem('pan-lastBackup',Date.now())}""",[wav,k])
        pg.wait_for_timeout(500);pg.evaluate("showView('cues')");pg.wait_for_timeout(200)
        pg.evaluate("()=>{const ids=[...document.querySelectorAll('#editPans .field')].map(e=>e.dataset.field);let t=0.45;for(let i=0;i<24;i++){const id=ids[(i*7)%ids.length];audio.currentTime=t;addTapCue(id,document.querySelector('#editPans .field[data-field=\"'+id+'\"]'));t+=0.3;lastTapAt=0}}")
        pg.evaluate("showView('play')");pg.wait_for_timeout(400);pg.evaluate("audio.currentTime=2.0;tick();drawLanes(2.0)");pg.wait_for_timeout(300)
        st=pg.evaluate("[STAGE.on,document.querySelectorAll('#playPans .field').length,document.querySelectorAll('#playPans .field.active').length]")
        # every note still taps to itself
        ok=pg.evaluate("""()=>{let ok=0,n=0;for(const f of document.querySelectorAll('#playPans .field')){const t=f.querySelector('text').getBoundingClientRect();if(!t.width)continue;n++;const e=document.elementFromPoint(t.x+t.width/2,t.y+t.height/2);if(e&&e.closest('.field')===f)ok++}return ok+'/'+n}""")
        print(k,nm,'stage on, fields, lit:',st,'taps',ok,errs[:2])
        pg.screenshot(path=f'{tag}-{k}-{nm}.png');pg.close()
    b.close()
