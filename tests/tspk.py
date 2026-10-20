import os
# a phone-like speaker delay of 0.2 s: do taps on the beat you hear still land on the beat?
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':844,'height':390})
    pg.add_init_script("Object.defineProperty(AudioContext.prototype,'outputLatency',{get(){return .19}})")
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000);pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(500)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1500)
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    E(pg,"(()=>{STUDIO.addTrack('pan');const t=STUDIO.song.tracks.at(-1);t.panSet='guitar';t.notes=[];STUDIO.song.sel=t.id;STUDIO.song.countIn=false;STUDIO.song.recMode='add';S.tapLag=.03})()")
    E(pg,"STUDIO.seek(0)");pg.click('#stRec');pg.wait_for_timeout(1200)
    fs=[f for f in pg.query_selector_all('#stPans .field') if f.bounding_box()]
    for k in range(8):
        # the player hears each beat 0.2 s after the app plays it, and taps then
        E(pg,"new Promise(r=>{const go=()=>{const b=STUDIO.beatNow()-.2/(60/STUDIO.bpm);if(b>0&&(b%1<.02||b%1>.995))r();else requestAnimationFrame(go)};go()})")
        bx=fs[k].bounding_box();pg.mouse.click(bx['x']+bx['width']/2,bx['y']+bx['height']/2);pg.wait_for_timeout(120)
    pg.click('#stPlay');pg.wait_for_timeout(200)
    n=E(pg,"STUDIO.song.tracks.at(-1).notes.map(n=>n.t)");sp=E(pg,"60/STUDIO.bpm")
    print('speaker 0.2 s late: notes land vs the beat (ms)',[round(((t+.5)%1-.5)*sp*1000) for t in n])
    b.close()
