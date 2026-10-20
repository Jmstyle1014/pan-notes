import os
import sys
from playwright.sync_api import sync_playwright
SRC=sys.argv[1];RATE=int(sys.argv[2])
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(SRC).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':844,'height':390},device_scale_factor=2.6,has_touch=True)
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000);pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(500)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1500)
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    E(pg,"(()=>{const g=STUDIO.song.tracks.find(t=>t.panSet==='guitar');for(let i=0;i<3;i++){STUDIO.addTrack('pan');const t=STUDIO.song.tracks.at(-1);t.panSet='guitar';t.notes=JSON.parse(JSON.stringify(g.notes))}STUDIO.addTrack('pan');const t=STUDIO.song.tracks.at(-1);t.panSet='guitar';t.notes=[];STUDIO.song.sel=t.id;STUDIO.song.countIn=false;STUDIO.song.recMode='add'})()")
    pg.wait_for_timeout(500)
    E(pg,"window._d=[];addEventListener('pointerdown',e=>window._d.push(performance.now()-e.timeStamp),true)")
    c=pg.context.new_cdp_session(pg);c.send('Emulation.setCPUThrottlingRate',{'rate':RATE})
    E(pg,"STUDIO.seek(0)");pg.click('#stRec');pg.wait_for_timeout(1500)
    fs=[f for f in pg.query_selector_all('#stPans .field') if f.bounding_box()]
    # tap exactly when the app's own clock says a beat is due, and see where the note lands
    res=[]
    for k in range(10):
        E(pg,"new Promise(r=>{const go=()=>{const b=STUDIO.beatNow();if(b%1<.02||b%1>.995)r();else requestAnimationFrame(go)};go()})")
        bx=fs[k%len(fs)].bounding_box();pg.mouse.move(bx['x']+bx['width']/2,bx['y']+bx['height']/2);pg.mouse.down();pg.mouse.up();pg.wait_for_timeout(150)
    pg.click('#stPlay');pg.wait_for_timeout(300)
    n=E(pg,"STUDIO.song.tracks.at(-1).notes.map(n=>n.t)")
    offs=[round(((t+.5)%1-.5)*E(pg,"60/STUDIO.bpm")*1000) for t in n]
    print('cpu x%d  handler delay ms:'%RATE,[round(x) for x in E(pg,"window._d")][:10]);print('   where the notes landed vs the beat (ms):',offs)
    b.close()
