import os
import base64,sys
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
wav=base64.b64encode(open('beat118.wav','rb').read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W,H,nm in [(844,390,'side'),(1180,820,'ipad'),(390,844,'up')]:
        pg=b.new_page(viewport={'width':W,'height':H});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
        pg.goto('https://pan.test/');pg.wait_for_timeout(800)
        pg.evaluate("""w=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);isDemo=false;S.cues=[];loadAudio(new Blob([u],{type:'audio/wav'}),'Beat');S.panSet='tenor';applyPanSet();S.grid={bpm:118,offset:.424,perBar:4};
          S.chart={edited:true,text:'# Intro @0:00\\nC\\n# Verse @0:08\\nG\\n# Chorus @0:18\\nC'};renderAll();localStorage.setItem('pan-lastBackup',Date.now())}""",wav)
        pg.wait_for_timeout(400);pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
        pg.evaluate("STUDIO.addTrack('beats')");pg.wait_for_timeout(300);pg.evaluate("document.querySelector('#gbView').click()");pg.wait_for_timeout(300)
        pg.screenshot(path=f'gb-{nm}-tracks.png')
        pg.evaluate("STUDIO.addTrack('pan')");pg.wait_for_timeout(500)
        print(nm,'inst?',pg.evaluate("document.body.classList.contains('st-inst')"),'pill',pg.evaluate("$('gbPill').textContent"),'pans box',pg.evaluate("(r=>[Math.round(r.top),Math.round(r.height)])($('stPans').getBoundingClientRect())"))
        pg.screenshot(path=f'gb-{nm}-pans.png')
        pg.click('#gbPill');pg.wait_for_timeout(200);pg.screenshot(path=f'gb-{nm}-pick.png')
        pg.click('.st-tchips [data-st="ipick"]');pg.wait_for_timeout(300);print('  after pick inst?',pg.evaluate("document.body.classList.contains('st-inst')"),'pill',pg.evaluate("$('gbPill').textContent"),'picking',pg.evaluate("document.body.classList.contains('gb-picking')"))
        pg.click('#gbMore');pg.wait_for_timeout(200);pg.screenshot(path=f'gb-{nm}-menu.png');pg.click('#gbMore')
        pg.click('#gbPlay' if False else '#stPlay');pg.wait_for_timeout(1500);print('  playing',pg.evaluate("STUDIO.T.playing"),'pos',pg.evaluate("$('stPos').textContent"));pg.click('#stPlay')
        pg.click('#gbMetro');pg.wait_for_timeout(100);print('  metro',pg.evaluate("[STUDIO.song.metro,$('gbMetro').classList.contains('on')]"))
        (pg.click('#gbMore'),pg.click('.gbmix')) if nm=='up' else pg.click('#gbMix');pg.wait_for_timeout(300);pg.screenshot(path=f'gb-{nm}-mixer.png');print('  mixer open',pg.evaluate("!$('stSheet').hidden"));pg.evaluate("STUDIO.closeSheet()")
        pg.click('#gbBack');pg.wait_for_timeout(300);print('  back ->',pg.evaluate("document.body.dataset.view"),'dock visible',pg.evaluate("getComputedStyle($('dock')).display"))
        print('  ',errs[:2]);pg.close()
    b.close()
