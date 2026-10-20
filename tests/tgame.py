import os
import base64
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
wav=base64.b64encode(open('beat118.wav','rb').read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':844,'height':390});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(900)
    pg.evaluate("""w=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);isDemo=false;S.cues=[];loadAudio(new Blob([u],{type:'audio/wav'}),'Beat');S.panSet='six';applyPanSet();renderAll();localStorage.setItem('pan-lastBackup',Date.now())}""",wav)
    pg.wait_for_timeout(500);pg.evaluate("showView('cues')")
    pg.evaluate("()=>{const ids=[...document.querySelectorAll('#editPans .field')].map(e=>e.dataset.field);let t=0.8;for(let i=0;i<20;i++){const id=ids[i%ids.length];audio.currentTime=t;addTapCue(id,document.querySelector('#editPans .field[data-field=\"'+id+'\"]'));t+=0.5;lastTapAt=0}}")
    pg.evaluate("showView('game')");pg.wait_for_timeout(400);print('game ready: stage on?',pg.evaluate("STAGE.on"),'ready panel visible',pg.evaluate("!!$('gmReady').offsetParent"))
    pg.evaluate("$('gmStart').click()");pg.wait_for_timeout(4500);print('running: stage on?',pg.evaluate("STAGE.on"),GM:=pg.evaluate("GM.state"))
    pg.screenshot(path='gm-run.png')
    # tap a note on the stage while it plays
    el=pg.locator('#playPans .field').first;bb=el.bounding_box();pg.mouse.click(bb['x']+bb['width']/2,bb['y']+bb['height']/2);pg.wait_for_timeout(200)
    print('tap counted',pg.evaluate("GAME.notes"))
    pg.evaluate("showView('play')");pg.wait_for_timeout(300);pg.click('#pfMore');pg.wait_for_timeout(200);print('tools open',pg.evaluate("getComputedStyle($('practicePanel')).display"),pg.evaluate("$('practicePanel').getBoundingClientRect().height"))
    pg.screenshot(path='pf-tools.png');print(errs);b.close()
