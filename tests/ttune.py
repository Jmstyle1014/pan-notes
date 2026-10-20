import os
import sys,base64
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(sys.argv[1]).read()+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':844,'height':390},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort());pg.goto('https://pan.test/');pg.wait_for_timeout(1000)
    for A in (440,444):
        w=base64.b64encode(open(f'tune{A}.wav','rb').read()).decode()
        pg.evaluate("""w=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);isDemo=false;loadAudio(new Blob([u],{type:'audio/wav'}),'Tune test');S.refA=440}""",w)
        pg.wait_for_timeout(800);pg.evaluate("showView('setup');SETUP.show('tune')");pg.wait_for_timeout(300)
        pg.click('#refMatch')
        for i in range(60):
            pg.wait_for_timeout(500)
            if 'Listening' not in pg.evaluate("$('refMsg').textContent"):break
        print(A,'->',pg.evaluate("[S.refA,$('refMsg').textContent.slice(0,140)]"))
    pg.screenshot(path='tune-m.png')
    print('pitch of A4 now',pg.evaluate("pitchHz(Object.keys(PITCH).find(id=>PITCH[id]==='A4'&&FIELDS.has(id))||'a')"),'list row',pg.evaluate("document.querySelector('[data-row=tune] .sxval')&&document.querySelector('[data-row=tune] .sxval').textContent"))
    print(errs)
