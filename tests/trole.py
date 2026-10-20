import os
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))");pg.goto('https://pan.test/');pg.wait_for_timeout(1500);pg.add_style_tag(content='#status{visibility:hidden!important}')
    print('asked on first open',E(pg,"!$('roleSheet').hidden"));pg.screenshot(path=D+'role-1.png')
    pg.click('[data-r=band]');pg.wait_for_timeout(200);pg.screenshot(path=D+'role-2.png')
    pg.click('[data-r=section][data-v=front]');pg.wait_for_timeout(200);pg.screenshot(path=D+'role-3.png')
    pg.click('[data-r=pan][data-v=tenor]');pg.wait_for_timeout(500)
    print('band',E(pg,"[ROLE.band(),ROLE.pan(),getComputedStyle(document.querySelector('.tabs button[data-tab=studio]')).display]"))
    pg.screenshot(path=D+'role-home.png')
    pg.click('#hmNew');pg.wait_for_timeout(300);pg.screenshot(path=D+'role-new-band.png')
    pg.click('[data-r=create]');pg.wait_for_timeout(200);print('empty name blocked',E(pg,"!$('roleSheet').hidden"))
    pg.fill('#nsName','Pan in A Minor');pg.keyboard.press('Enter');pg.wait_for_timeout(1200)
    print('new song',E(pg,"[S.title,S.panSet,songNow().title,SONGS.list.length]"))
    E(pg,"SETUP.show(null)");pg.wait_for_timeout(300)
    print('setup rows',E(pg,"[...document.querySelectorAll('#setList [data-row]')].map(x=>x.dataset.row).join(',')"))
    E(pg,"showView('home')");pg.wait_for_timeout(300)
    pg.click('#roleChip');pg.wait_for_timeout(200);pg.click('[data-r=producer]');pg.wait_for_timeout(400)
    print('producer',E(pg,"[ROLE.band(),getComputedStyle(document.querySelector('.tabs button[data-tab=studio]')).display]"))
    pg.click('#hmNew');pg.wait_for_timeout(300);pg.click('[data-r=npan][data-v=dsec]');pg.fill('#nsName','Kitchen Session');pg.screenshot(path=D+'role-new-prod.png');pg.click('[data-r=create]');pg.wait_for_timeout(1200)
    print('new song 2',E(pg,"[S.title,S.panSet,SONGS.list.map(s=>s.title)]"))
    E(pg,"showView('home')");pg.wait_for_timeout(300);pg.screenshot(path=D+'role-home-prod.png')
    print('errors',errs);b.close()
