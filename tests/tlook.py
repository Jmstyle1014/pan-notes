import os
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000);pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(400)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson',D+'Panyard Sunrise - backup.json');pg.wait_for_timeout(1500)
    E(pg,"S.panSet='dsec';applyPanSet();renderAll();showView('setup');SETUP.show(null)");pg.wait_for_timeout(500)
    print('setup list:',E(pg,"[...document.querySelectorAll('#setList button,#setList [data-k]')].map(x=>x.textContent.trim().slice(0,40)).filter(t=>/look|photo/i.test(t))"))
    E(pg,"SETUP.show('photos')");pg.wait_for_timeout(400);pg.add_style_tag(content='#status{visibility:hidden!important}')
    pg.screenshot(path=D+'lk-setup-1.png',full_page=True)
    print('tab',E(pg,"LOOK.tab"),'visible panels',E(pg,"[...document.querySelectorAll('#view-setup .panel')].filter(x=>x.getClientRects().length).map(x=>(x.querySelector('h2')||{}).textContent)"))
    pg.click('#lkStyles [data-v=painted]');pg.wait_for_timeout(300)
    E(pg,"showView('play')");pg.wait_for_timeout(700);pg.screenshot(path=D+'lk-play-painted.png')
    print('painted fields w/ colour',E(pg,"document.querySelectorAll('.pan[data-lk=painted] .field[style*=\"--gc\"]').length"))
    E(pg,"showView('setup');SETUP.show('photos')");pg.wait_for_timeout(300)
    pg.click('#lkStyles [data-v=photo]');pg.wait_for_timeout(300)
    pg.click('#lkPhotos [data-lk=pick][data-v="0"]');pg.wait_for_timeout(200)
    pg.set_input_files('#lkFile',D+'pan-photo-example.jpg');pg.wait_for_timeout(1500)
    print('align open',E(pg,"!!$('lkAlign')&&!$('lkAlign').hidden"))
    # drag the photo a bit and pinch-free zoom with the + button
    bx=pg.locator('#lkAlSvg').bounding_box();pg.mouse.move(bx['x']+bx['width']/2,bx['y']+bx['height']/2);pg.mouse.down();pg.mouse.move(bx['x']+bx['width']/2+30,bx['y']+bx['height']/2+10,steps=5);pg.mouse.up()
    pg.click('#lkAlign [data-a=zi]');pg.click('#lkAlign [data-a=rr]');pg.wait_for_timeout(200);pg.screenshot(path=D+'lk-align.png')
    pg.click('#lkAlign [data-a=done]');pg.wait_for_timeout(300)
    print('saved alignment',E(pg,"LOOK.of('dsec').al"))
    pg.click('#lkPhotos [data-lk=pick][data-v="1"]');pg.set_input_files('#lkFile',D+'pan-photo-example.jpg');pg.wait_for_timeout(1500);pg.click('#lkAlign [data-a=done]')
    pg.click('#lkNames [data-v=plain]');pg.click('#lkHit [data-v="#7be07b"]');pg.wait_for_timeout(200)
    pg.screenshot(path=D+'lk-setup-2.png',full_page=True)
    E(pg,"showView('play')");pg.wait_for_timeout(700)
    E(pg,"document.querySelector('.field[data-field=\"dsec:64\"]').classList.add('hit')");pg.wait_for_timeout(100);pg.screenshot(path=D+'lk-play-photo.png')
    print('photos in play',E(pg,"document.querySelectorAll('#view-play image.lk-photo').length"),'letters plain',E(pg,"[...document.querySelectorAll('#view-play .field text')].some(t=>/[\\u0307\\u0323]/.test(t.textContent))"))
    E(pg,"showView('cues')");pg.wait_for_timeout(900);pg.screenshot(path=D+'lk-write-photo.png')
    print('photos in write',E(pg,"document.querySelectorAll('#editPans image.lk-photo').length"))
    pg.set_viewport_size({'width':844,'height':390});E(pg,"showView('play')");pg.wait_for_timeout(900);pg.screenshot(path=D+'lk-play-side.png')
    print('photos sideways',E(pg,"document.querySelectorAll('#view-play image.lk-photo,#playStage image.lk-photo').length"))
    # tenor steel, and guitar keeps its look separately
    E(pg,"S.panSet='tenor';applyPanSet();renderAll()");pg.wait_for_timeout(300);E(pg,"LOOK.set('tenor',{style:'steel'})");pg.wait_for_timeout(500);pg.screenshot(path=D+'lk-tenor-steel.png')
    E(pg,"S.panSet='guitar';applyPanSet();renderAll()");pg.wait_for_timeout(600)
    print('guitar look',E(pg,"[LOOK.of('guitar').style,(document.querySelector('#view-play .pan')||{}).dataset&&document.querySelector('#view-play .pan').dataset.lk]"))
    # backup round trip
    E(pg,"window._f=[];downloads={save:async o=>{const r=new FileReader();r.onload=()=>window._f.push([o.filename,r.result]);r.readAsDataURL(new Blob([o.data]))}};renderShare();showView('setup');$('expJson').click()");pg.wait_for_timeout(2500)
    import base64,json
    data=E(pg,"window._f[0][1]");j=json.loads(base64.b64decode(data.split(',',1)[1]))
    print('backup has looks',list(j.get('panLooks',{}).get('d',{}).keys()),'photos',list(j.get('panLooks',{}).get('photos',{}).keys()))
    open(D+'lk-backup.json','w').write(json.dumps(j))
    print('errors',errs);b.close()
