import os
import base64,sys
from playwright.sync_api import sync_playwright
src=sys.argv[1];tag=sys.argv[2]
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(src).read()+'</body></html>'
wav=base64.b64encode(open('beat118.wav','rb').read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000)
    pg.evaluate("""w=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);const bl=new Blob([u],{type:'audio/wav'});isDemo=false;S.cues=[];loadAudio(bl,'Beat song');S.title='Set test';S.grid={bpm:118,offset:0.424,perBar:4};renderAll();save();
      window._files=[];downloads={save:async o=>{const bl=o.data instanceof Blob?o.data:new Blob([o.data]);const r=new FileReader();await new Promise(res=>{r.onload=res;r.readAsDataURL(bl)});window._files.push({name:o.filename,data:r.result})}};renderShare()}""",wav)
    pg.wait_for_timeout(1200)
    for sk in ['tenor','six','fcello','dsec','guitar']:
        pg.evaluate("showView('setup');SETUP.show('pan')");pg.wait_for_timeout(200)
        pg.click('[data-set=%s]'%sk);pg.wait_for_timeout(300)
        print(sk,'set',pg.evaluate("setKey()"),'fields',pg.evaluate("document.querySelectorAll('#editPans .field').length"),'info',pg.inner_text('#setInfo')[:60])
        if sk=='tenor': pg.locator('#setPanel').screenshot(path=tag+'-setpick.png')
        pg.evaluate("showView('cues')");pg.wait_for_timeout(300)
        pg.screenshot(path='%s-%s-write.png'%(tag,sk))
        ids=pg.evaluate("[...document.querySelectorAll('#editPans .field')].map(e=>e.dataset.field)")
        # tap along: add cues directly through the tap handler
        pg.evaluate("ids=>{let t=0.45;ids.slice(0,8).forEach((id,i)=>{audio.currentTime=t;const el=document.querySelector('#editPans .field[data-field=\"'+id+'\"]');addTapCue(id,el);t+=0.51;lastTapAt=0})}",ids)
        pg.wait_for_timeout(200)
        print('  cues',pg.evaluate("S.cues.length"),'chart:',pg.evaluate("autoChart().split('\\n').slice(1,3).join(' | ')"))
        pg.evaluate("S.cues=[];renderCues()")
    print(errs);b.close()
