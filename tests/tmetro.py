import os
import sys,base64
from playwright.sync_api import sync_playwright
SRC=sys.argv[1];W,H=(int(x) for x in (sys.argv[2] if len(sys.argv)>2 else '844x390').split('x'));tag=sys.argv[3] if len(sys.argv)>3 else 'm'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(SRC).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);pg=b.new_page(viewport={'width':W,'height':H},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000)
    pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(500)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1200)
    E(pg,"window._f=[];downloads={save:async o=>{if(typeof o.data==='string'){window._f.push([o.filename,'data:,'+btoa(unescape(encodeURIComponent(o.data)))]);return}const r=new FileReader();r.onload=()=>window._f.push([o.filename,r.result]);r.readAsDataURL(o.data)}};renderShare()")
    pg.add_style_tag(content='#status{visibility:hidden!important}')
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    before=E(pg,"[STUDIO.bpm,S.cues[5].start,S.chart.text.match(/# Verse @[^\\n]*/)[0],STUDIO.song.tracks.find(t=>t.type==='part')&&0]")
    part0=E(pg,"(()=>{STUDIO.song.sel=STUDIO.song.tracks.find(t=>t.type==='part').id;return STUDIO.pnotes(STUDIO.song.tracks.find(t=>t.type==='part')).slice(0,6).map(n=>n.t)})()")
    # 1. tempo sheet from the bar counter (or the menu on a narrow phone)
    if E(pg,"!!document.querySelector('.gblcd').offsetParent"):pg.click('.gblcd')
    else:pg.click('#gbMore');pg.click('#gbTempo')
    pg.wait_for_timeout(400);pg.screenshot(path=f'{tag}-tempo.png')
    for i in range(3):pg.click('[data-st=tempo][data-v="1"]');pg.wait_for_timeout(80)
    after=E(pg,"[STUDIO.bpm,S.cues[5].start,S.chart.text.match(/# Verse @[^\\n]*/)[0]]")
    part1=E(pg,"STUDIO.pnotes(STUDIO.song.tracks.find(t=>t.type==='part')).slice(0,6).map(n=>n.t)")
    secs=E(pg,"[...document.querySelectorAll('#stSecs [data-sec]')].map(c=>c.textContent+':'+c.dataset.sec).join(' ')")
    print('tempo',before,'->',after,'| part beats same:',part0==part1,'| sections',secs)
    # tap tempo: four taps half a second apart = 120
    for i in range(5):E(pg,"document.querySelector('[data-st=taptempo]').click()");pg.wait_for_timeout(500)
    print('tap tempo ->',E(pg,"STUDIO.bpm"),E(pg,"$('stTapMsg').textContent"))
    pg.click('[data-st=sig][data-v="3"]');pg.wait_for_timeout(200);print('3/4 ->',E(pg,"STUDIO.BPB()"));pg.click('[data-st=sig][data-v="4"]')
    E(pg,"STUDIO.setTempo(112)")
    pg.click('[data-st=csound][data-v=iron]');pg.click('[data-st=ctog][data-v=metro]');pg.click('[data-st=cbars][data-v="2"]')
    print('click',E(pg,"[STUDIO.ck(),STUDIO.song.metro]"))
    pg.wait_for_timeout(200);pg.screenshot(path=f'{tag}-tempo2.png',full_page=False)
    pg.click('#stSheetBox [data-st=close]');pg.wait_for_timeout(200)
    # 2. count-in before recording, with the big numbers
    E(pg,"STUDIO.song.sel=STUDIO.song.tracks.find(t=>t.panSet==='guitar').id;STUDIO.seek(0)");pg.click('#gbView');pg.click('#gbView');pg.wait_for_timeout(300)
    E(pg,"STUDIO.song.recMode='take';STUDIO.song.countIn=true")
    pg.click('#stRec');pg.wait_for_timeout(700);cnt=E(pg,"$('stCountVis').textContent");pg.screenshot(path=f'{tag}-countin.png')
    pg.wait_for_timeout(4200)
    fs=[f for f in pg.query_selector_all('#stPans .field') if f.bounding_box()]
    for k in range(6):
        f=fs[k*2%len(fs)];bx=f.bounding_box();pg.mouse.move(bx['x']+bx['width']/2,bx['y']+bx['height']/2);pg.mouse.down();pg.wait_for_timeout(60);pg.mouse.up();pg.wait_for_timeout(300)
    pg.click('#stPlay');pg.wait_for_timeout(400)
    tk=E(pg,"(()=>{const t=STUDIO.song.tracks.find(t=>t.panSet==='guitar');return [t.takes&&t.takes.map(k=>k.name),t.tk,t.notes.length]})()")
    print('count-in showed',repr(cnt),'| takes',tk)
    # 3. track settings
    E(pg,"STUDIO.trackSheet()");pg.wait_for_timeout(400);pg.screenshot(path=f'{tag}-track.png')
    pg.click('[data-st=takeuse][data-v="0"]');pg.wait_for_timeout(200)
    print('use take 1 ->',E(pg,"(()=>{const t=STUDIO.song.tracks.find(t=>t.panSet==='guitar');return [t.tk,t.notes.length]})()"))
    pg.click('[data-st=echoT][data-v=de]');pg.click('[data-st=room][data-v="1.4"]')
    E(pg,"(()=>{const r=document.querySelector('[data-fx=treble]');r.value=4;r.dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('[data-fx=comp]');c.value=.4;c.dispatchEvent(new Event('input',{bubbles:true}))})()")
    pg.click('[data-st=qmode][data-v=swing]');pg.wait_for_timeout(100);pg.click('[data-st=qsw][data-v=heavy]')
    for i in range(2):pg.click('[data-st=tp][data-v="1"]')
    q=E(pg,"(()=>{const t=STUDIO.song.tracks.find(t=>t.panSet==='guitar'),a=t.notes.slice().sort((x,y)=>x.t-y.t).slice(0,4),b=STUDIO.pnotes(t).slice(0,4);return [t.fx,t.q,t.tp,a.map(n=>n.t+' '+PITCH[n.p]),b.map(n=>n.t+' '+PITCH[n.p])]})()")
    print('track fx',q)
    pg.wait_for_timeout(200);pg.screenshot(path=f'{tag}-track2.png')
    pg.evaluate("document.querySelector('#stSheetBox').scrollTop=99999");pg.wait_for_timeout(200);pg.screenshot(path=f'{tag}-track3.png')
    pg.click('#stSheetBox [data-st=close]')
    # 4. tracks view with the settings buttons, and export with the effects
    pg.evaluate("document.querySelector('#gbView [data-v=tracks]').click()");pg.wait_for_timeout(400);pg.screenshot(path=f'{tag}-tracks.png')
    E(pg,"window._f=[]");pg.click('#gbMore');pg.click('#stExp');pg.wait_for_timeout(300);pg.click('#expStudio');pg.wait_for_timeout(400);pg.click('#stExFmt button[data-v=wav]');pg.click('[data-st=expgo]')
    for i in range(60):
        pg.wait_for_timeout(1000)
        if E(pg,"window._f.length"):break
    for name,data in E(pg,"window._f"):open(f'{tag}-fx.wav','wb').write(base64.b64decode(data.split(',',1)[1]));print('export',name,len(data))
    pg.click('#stSheetBox [data-st=close]') if E(pg,"!$('stSheet').hidden") else None
    # 5. backup keeps all of it
    E(pg,"window._f=[];showView('setup');$('expJson').click()");pg.wait_for_timeout(1500)
    for name,data in E(pg,"window._f"):open(f'{tag}-backup2.json','wb').write(base64.b64decode(data.split(',',1)[1]))
    pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()") if E(pg,"showView('home'),!!$('hmNew')") else None;pg.wait_for_timeout(500)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson',f'{tag}-backup2.json');pg.wait_for_timeout(1200)
    E(pg,"showView('studio')");pg.wait_for_timeout(1200)
    print('restored',E(pg,"(()=>{const t=STUDIO.song.tracks.find(t=>t.panSet==='guitar');return [STUDIO.bpm,STUDIO.ck().sound,STUDIO.ck().bars,t.fx&&t.fx.echoT,t.q&&t.q.mode,t.tp,t.takes&&t.takes.length,t.tk]})()"))
    print('errors',errs)
    b.close()
