import os
import json,sys
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(sys.argv[1]).read()+'</body></html>'
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1180,'height':820});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000)
    if pg.evaluate("!!document.getElementById('hmNew')"):pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(600)
    print('before',pg.evaluate("[setKey(),S.cues.length]"))
    pg.evaluate("typeof SETUP!=='undefined'&&SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1500)
    print('after',pg.evaluate("[setKey(),S.cues.length,S.title,S.grid&&S.grid.bpm,$('status').textContent]"))
    if 'panyard' not in sys.argv[1]:print(errs);b.close();sys.exit()
    pg.evaluate("showView('studio')");pg.wait_for_timeout(1500)
    print('studio',pg.evaluate("STUDIO.song.tracks.map(t=>[t.name,t.type,t.panSet||'',(t.notes||[]).length,t.style||'',(t.off||[]).length])"),pg.evaluate("STUDIO.bars()"))
    pg.screenshot(path='backup_open.png');print(errs)
    b.close()
