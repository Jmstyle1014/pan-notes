import os
from playwright.sync_api import sync_playwright
D=os.environ['WORK']+'/'
KD=os.environ['SRC']+'/drums/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
def serve(r):
    u=r.request.url.split('pan.test/',1)[1].split('?')[0]
    if u.startswith('drums/'):
        f=KD+u[6:];return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
    r.fulfill(body=html,content_type='text/html')
E=lambda pg,js,*a:pg.evaluate(js,*a)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']);errs=[]
    ctx=b.new_context(viewport={'width':390,'height':844},user_agent='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 wv')
    pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("try{if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))}catch(e){}")
    pg.route('https://pan.test/**',serve);pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1000);E(pg,"(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400)
    E(pg,"SETUP.show('save')");pg.set_input_files('#impJson',D+'rt/Sunday Lime - backup.json');pg.wait_for_timeout(2000)
    E(pg,"(()=>{window._conv=0;const o=BaseAudioContext.prototype.createConvolver;BaseAudioContext.prototype.createConvolver=function(){if(!(this instanceof OfflineAudioContext))window._conv++;return o.call(this)};return 1})()")
    E(pg,"showView('studio')");pg.wait_for_timeout(1500)
    pg.click('#stPlay');pg.wait_for_timeout(2500);pg.click('#stPlay')
    print('reverbs made while playing (all tracks):',E(pg,"window._conv"))
    # first recording on this phone: the timing check comes first
    E(pg,"STUDIO.song.sel=STUDIO.song.tracks.find(t=>t.name==='Six Bass').id")
    pg.click('#stRec');pg.wait_for_timeout(500)
    print('timing check shown',E(pg,"!q0('#stSheet').hidden".replace('q0','document.querySelector')),E(pg,"!!document.querySelector('.st-first')"))
    pg.screenshot(path=D+'lite-first.png')
    print('readout:',E(pg,"(document.querySelector('.st-diag')||{}).textContent"))
    pg.click('[data-st=recnow]');pg.wait_for_timeout(800)
    print('recording after skip',E(pg,"document.querySelector('#stRec').getAttribute('aria-pressed')||document.querySelector('#stRec').className"))
    pg.click('#stPlay');pg.wait_for_timeout(300);pg.click('#stRec');pg.wait_for_timeout(400)
    print('asked only once',E(pg,"document.querySelector('#stSheet').hidden"));pg.click('#stPlay');pg.wait_for_timeout(300)
    # smoother playback: the setting, a restart, then the bigger cushion
    E(pg,"STUDIO.timing&&0");E(pg,"document.querySelector('#gbMore')&&0")
    E(pg,"localStorage.setItem('panyard-smooth','1')");pg.reload();pg.wait_for_timeout(1200)
    print('after restart, latencyHint playback: baseLatency',E(pg,"(()=>{const c=panCtx();return [c.baseLatency,c.sampleRate]})()"))
    print('errors',errs);b.close()
