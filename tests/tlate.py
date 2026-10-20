import os
import sys
from playwright.sync_api import sync_playwright
SRC=sys.argv[1];RATE=int(sys.argv[2]) if len(sys.argv)>2 else 6
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(SRC).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':844,'height':390},device_scale_factor=2.6);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000);pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(500)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1500)
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    # add three more pan tracks copying the guitar notes, like a song built up in layers
    E(pg,"(()=>{const g=STUDIO.song.tracks.find(t=>t.panSet==='guitar');for(let i=0;i<3;i++){STUDIO.addTrack('pan');const t=STUDIO.song.tracks.at(-1);t.panSet='guitar';t.notes=JSON.parse(JSON.stringify(g.notes))}STUDIO.song.metro=true})()")
    print('tracks',E(pg,"STUDIO.song.tracks.length"))
    # watch every sound the app schedules: how late (in ms) was it already when it was sent?
    E(pg,"""(()=>{window._late=[];const ac=panCtx();const P=AudioScheduledSourceNode.prototype,o=P.start;P.start=function(t,...a){if(t&&this.context===ac&&!(this.context instanceof OfflineAudioContext))window._late.push((ac.currentTime-t)*1000);return o.call(this,t,...a)}})()""")
    c=pg.context.new_cdp_session(pg);c.send('Emulation.setCPUThrottlingRate',{'rate':RATE})
    E(pg,"STUDIO.seek(0)");pg.click('#stPlay');pg.wait_for_timeout(12000);pg.click('#stPlay')
    r=E(pg,"(()=>{const l=window._late;return [l.length,l.filter(x=>x>0).length,l.filter(x=>x>20).length,Math.round(Math.max(...l))]})()")
    print('cpu x%d: sounds %d, sent late %d, more than 20 ms late %d, worst %d ms'%(RATE,*r))
    print(errs);b.close()
