import os
import sys,base64
from playwright.sync_api import sync_playwright
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(sys.argv[1]).read()+'</body></html>'
E=lambda pg,js:pg.evaluate(js)
wav=base64.b64encode(open('Panyard Sunrise.wav','rb').read()).decode() if len(sys.argv)<3 else None
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for W,H,t in [(844,390,'m'),(1280,800,'t'),(390,844,'u'),(820,1180,'ip')]:
        pg=b.new_page(viewport={'width':W,'height':H},device_scale_factor=2);errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}");pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort());pg.goto('https://pan.test/');pg.wait_for_timeout(900)
        pg.evaluate("(async()=>{localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(window.ROLE){ROLE.apply();ROLE.close();await ROLE.songNew0()}else{document.getElementById('hmNew').click()}})()");pg.wait_for_timeout(400);E(pg,"SETUP.show('save')");pg.set_input_files('#impJson','Panyard Sunrise - backup.json');pg.wait_for_timeout(1000)
        if wav:pg.evaluate("w=>{const raw=atob(w),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);loadAudio(new Blob([u],{type:'audio/wav'}),'Panyard Sunrise mix')}",wav);pg.wait_for_timeout(1500)
        pg.add_style_tag(content='#status{visibility:hidden!important}')
        pg.click('.tabs [data-tab=write]');pg.wait_for_timeout(1000)
        info=E(pg,"[document.body.classList.contains('wbmode'),getComputedStyle($('dock')).display,!!$('wbBar').offsetParent,(()=>{const s=[...document.querySelectorAll('#editPans svg')].filter(x=>x.getBoundingClientRect().width>100).map(x=>{const q=x.getBoundingClientRect();return[Math.round(q.left),Math.round(q.top),Math.round(q.width),Math.round(q.height)]});return s})()]")
        pg.screenshot(path=f'wb-{t}-1.png')
        # tap a note: it should become a cue like before
        n0=E(pg,"S.cues.length");f=[x for x in pg.query_selector_all('#editPans .field') if x.bounding_box()][3];bx=f.bounding_box();pg.mouse.click(bx['x']+bx['width']/2,bx['y']+bx['height']/2);pg.wait_for_timeout(300);n1=E(pg,"S.cues.length")
        pg.click('#wbUndo');pg.wait_for_timeout(200);n2=E(pg,"S.cues.length")
        # the timeline
        if E(pg,"!$('wbView').hidden"):pg.click('#wbView');pg.wait_for_timeout(600)
        E(pg,"audio.currentTime=8.6;tick()");pg.wait_for_timeout(300)
        E(pg,"(()=>{selIds=new Set(S.cues.slice(12,16).map(c=>c.id));renderCues();try{renderSel()}catch(e){};drawTL()})()");pg.wait_for_timeout(400)
        tlr=E(pg,"(()=>{const q=$('tl').getBoundingClientRect();return[Math.round(q.top),Math.round(q.height)]})()")
        selv=E(pg,"!!$('selBar').offsetParent")
        pg.screenshot(path=f'wb-{t}-2.png')
        # a selected-note action still works: Move ▶
        s0=E(pg,"S.cues.filter(c=>selIds.has(c.id)).map(c=>c.start).join()");E(pg,'WB.ebar()');pg.wait_for_timeout(200);pg.locator('[data-e=right]').first.click();pg.wait_for_timeout(200);s1=E(pg,"S.cues.filter(c=>selIds.has(c.id)).map(c=>c.start).join()")
        pg.click('#wbUndo');pg.wait_for_timeout(200)
        # menu, snap, tempo sheet, build
        pg.click('#wbMore');pg.wait_for_timeout(250);pg.screenshot(path=f'wb-{t}-3.png');pg.mouse.click(5,H-5);pg.wait_for_timeout(150)
        pg.click('#wbSnap');pg.wait_for_timeout(200);pg.click('#wbSnapPop [data-snap="2"]');pg.wait_for_timeout(250);snap=E(pg,"S.snap")
        pg.click('#wbMore');pg.click('#wbmTempo');pg.wait_for_timeout(300);tsh=E(pg,"!$('wbSheet').hidden&&!!$('autoTempo').offsetParent");pg.screenshot(path=f'wb-{t}-4.png');pg.click('#wbSheetX')
        pg.click('#wbMore');pg.wait_for_timeout(300)
        print('menu state',E(pg,"[$('wbMenu').hidden,(()=>{const r=$('wbmBuild').getBoundingClientRect();const e=document.elementFromPoint(r.left+5,r.top+5);return [r.top,r.height,e&&(e.id||e.className)]})(),getComputedStyle($('wbMenu')).display]"))
        pg.click('#wbmBuild');pg.wait_for_timeout(400);bsh=E(pg,"[entry,!$('wbSheet').hidden,!!$('saveCue').offsetParent]");pg.screenshot(path=f'wb-{t}-5.png');pg.click('#wbSheetX');pg.wait_for_timeout(200)
        # leaving: back to Home, then the chart still shows the song
        pg.click('#wbBack');pg.wait_for_timeout(400);out=E(pg,"[document.body.dataset.view,document.body.classList.contains('wbmode'),getComputedStyle($('dock')).display]")
        print(t,'| in Write',info,'| tap cue',n0,n1,'undo',n2,'| timeline',tlr,'selbar',selv,'| move ok',s0!=s1,'| snap',snap,'| tempo sheet',tsh,'| build',bsh,'| back',out,errs)
        pg.close()
