import os
import base64,json
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);errs=[]
    pg=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2);pg.on('pageerror',lambda e:errs.append(str(e)+' @ '+str(e.stack)[:400]))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}))}catch(e){}")
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort());pg.route('https://cdnjs.cloudflare.com/**',lambda r:r.fulfill(path=os.environ['SRC']+'/vendor/jspdf.umd.min.js',content_type='application/javascript'))
    pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
    E(pg,"(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(500)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson',D+'rt/Sunday Lime - backup.json');pg.wait_for_timeout(2000)
    E(pg,"window._f=[];downloads={save:async o=>{const r=new FileReader();r.onload=()=>window._f.push([o.filename,r.result]);r.readAsDataURL(o.data instanceof Blob?o.data:new Blob([o.data]))}};renderShare()")
    mine0=E(pg,"[S.title,S.panSet,S.cues.length,JSON.stringify(S.chart)]")
    # Studio: Show on Chart for the bass and the guitar, from each track's settings
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    for name in ['Six Bass','Double Guitar']:
        E(pg,"n=>STUDIO.trackSheet(STUDIO.song.tracks.find(t=>t.name===n).id)",name);pg.wait_for_timeout(300)
        pg.click('#stSheetBox [data-st=tchart]');pg.wait_for_timeout(200)
    pg.screenshot(path=D+'parts-tracksheet.png');pg.click('#stSheetBox [data-st=close]')
    # the Chart tab
    E(pg,"showView('part')");pg.wait_for_timeout(1000)
    print('picker',E(pg,"[...document.querySelectorAll('#partPick button')].map(b=>b.textContent)"))
    pg.screenshot(path=D+'parts-mine.png')
    pg.click('#partPick button:nth-of-type(2)');pg.wait_for_timeout(500);pg.screenshot(path=D+'parts-bass.png')
    print('title leak',E(pg,"[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&/Sunday Lime ·/.test(e.textContent||e.value||'')&&!e.closest('#sheet')).map(e=>e.tagName+' in '+(e.parentNode.id||e.parentNode.className)+' / '+(e.parentNode.parentNode.id||e.parentNode.parentNode.className)+': '+e.textContent).slice(0,5)"),E(pg,"$('title').value"))
    print('bass chart lines',E(pg,"[...document.querySelectorAll('#sheet .csec')].map(s=>s.querySelector('.csech b').textContent+': '+[...s.querySelectorAll('.cline')].map(l=>l.textContent).join(' / ')).join(' || ')"))
    print('song untouched',E(pg,"[S.title,S.panSet,S.cues.length,JSON.stringify(S.chart)]")==mine0)
    # share this part as text
    E(pg,"expKind='chart';navigator.clipboard.writeText=t=>{window._clip=t;return Promise.resolve()}");E(pg,"openShare(true)");pg.wait_for_timeout(400)
    print('share title',E(pg,"$('shareTitle').textContent"),'| arrangement tile shown',E(pg,"!$('expAll').hidden"))
    pg.screenshot(path=D+'parts-share.png')
    pg.click('#expText');pg.wait_for_timeout(300);print('text:\n'+E(pg,"window._clip||''")[:400])
    # the whole arrangement
    E(pg,"window._f=[]");pg.click('#expAll')
    for i in range(40):
        pg.wait_for_timeout(500)
        if E(pg,"window._f.length"):break
    for n,d in E(pg,"window._f"):open(D+'Sunday Lime - arrangement.pdf','wb').write(base64.b64decode(d.split(',',1)[1]));print('saved',n)
    E(pg,"openShare(false)")
    # edit the guitar part
    pg.click('#partPick button:nth-of-type(3)');pg.wait_for_timeout(300)
    pg.click('#sheet [data-ch=edit]');pg.wait_for_timeout(300)
    E(pg,"()=>{const t=$('chartIn');t.value=t.value.replace(/^(# [^\\n]*)$/m,'$1\\n[Strum on the and]');t.dispatchEvent(new Event('input'))}")
    pg.click('#sheet [data-ch=save]');pg.wait_for_timeout(600)
    print('guitar edited',E(pg,"STUDIO.song.tracks.find(t=>t.name==='Double Guitar').chartText.slice(0,60)"),'| mine still',E(pg,"JSON.stringify(S.chart)")==mine0[3])
    pg.screenshot(path=D+'parts-guitar-edited.png')
    pg.click('#partPick button:nth-of-type(1)');pg.wait_for_timeout(300)
    print('back to mine',E(pg,"PARTS.cur"),E(pg,"[S.title,S.panSet,S.cues.length]"))
    # backup keeps it
    E(pg,"window._f=[];showView('setup');$('expJson').click()");pg.wait_for_timeout(2500)
    j=json.loads(base64.b64decode(E(pg,"window._f[0][1]").split(',',1)[1]))
    print('backup',[(t['name'],t.get('chart'),bool(t.get('chartText'))) for t in j['studio']['tracks'] if t['type']=='pan'])
    print('errors',errs);b.close()
