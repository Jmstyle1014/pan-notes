import os,sys
from playwright.sync_api import sync_playwright
# Home, Play and Settings after the review: the Producer / Band switch, "Who's playing" showing the choice, pans whose
# skirts follow the look, lanes that step aside when a song has no notes, ▶ playing your part when there's no
# recording (never kept as one), and the Band sound / How you play rows in Settings.
D=os.environ['WORK']+'/tscreens/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
E=lambda pg,js,*a:pg.evaluate(js,*a)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
CUES="""()=>{const ids=['c','e-low','g-low','c','a','f-low','d-low','g-low'];S.cues=ids.map((p,i)=>({id:uid(),start:1+i*0.6,duration:0.5,steps:[p],mode:'together',note:''}));normalizeChords();renderAll();save();return S.cues.length}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=True).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1200);pg.add_style_tag(content='#status{visibility:hidden!important}')
    # band member on the Double Guitar first, then the switch on Home
    pg.click('[data-r=band]');pg.wait_for_timeout(200);pg.click('[data-r=section][data-v=back]');pg.wait_for_timeout(200);pg.click('[data-r=pan][data-v=guitar]');pg.wait_for_timeout(500)
    pg.click('#hmNew');pg.wait_for_timeout(300);pg.fill('#nsName','Rocksteady');pg.click('[data-r=create]');pg.wait_for_timeout(1200)
    E(pg,"showView('home')");pg.wait_for_timeout(400);pg.screenshot(path=D+'1-home-band.png')
    sw=E(pg,"[...document.querySelectorAll('#roleChip [data-rs]')].map(b=>b.textContent+':'+b.getAttribute('aria-pressed'))")
    check(len(sw)==2 and 'Double Guitar:true' in sw[1],f'Home has the Producer / your pan switch, on your pan {sw}')
    pg.click('#roleChip [data-rs=p]');pg.wait_for_timeout(400);check(not E(pg,"ROLE.band()"),'one tap: Producer')
    pg.click('#roleChip [data-rs=b]');pg.wait_for_timeout(400);check(E(pg,"ROLE.pan()")=='guitar','one tap back: band member on your Double Guitar again')
    E(pg,"ROLE.open('who')");pg.wait_for_timeout(300);pg.screenshot(path=D+'2-who.png')
    now=E(pg,"[...document.querySelectorAll('.role-card.role-cur')].map(c=>c.dataset.r)");check(now==['band'],f'"Who\'s playing" shows your choice ({now})')
    check('Studio and the other pans are hidden' in E(pg,"document.querySelector('[data-r=band]').textContent"),'and says what a band member doesn\'t see')
    E(pg,"ROLE.close()")
    # a song with no notes: no lanes, the pans move up
    E(pg,"showView('play')");pg.wait_for_timeout(500)
    h=pg.locator('#view-play button:has-text("Hide")')
    if h.count():h.first.click();pg.wait_for_timeout(300)
    check(E(pg,"document.body.classList.contains('nolanes')&&getComputedStyle($('lanes')).display==='none'"),'no notes yet: the lanes step aside')
    pg.screenshot(path=D+'3-play-empty.png')
    sk=E(pg,"getComputedStyle(document.querySelector('#playPans svg path[fill=\"url(#hgSkirt)\"]')).fill")
    check('thNightSkirt' in sk,f'Chrome Night: the skirts are chrome, not purple ({sk})')
    # notes but no recording: ▶ plays your part
    E(pg,CUES);pg.wait_for_timeout(400)
    check(not E(pg,"document.body.classList.contains('nolanes')"),'with notes the lanes are back')
    check(E(pg,"!$('playBtn').disabled")and 'Your part' in E(pg,"$('recName').textContent"),'no recording: ▶ is ready to play your part ('+E(pg,"$('recName').textContent")+')')
    check(E(pg,"$('loopPill').hidden"),'no loop pill with nothing to play')
    pg.click('#playBtn');pg.wait_for_timeout(3000)
    st=E(pg,"[MYPART.on(),!audio.paused,curName,Math.round(audio.duration)]")
    check(st[0] and st[1],f'▶ makes your part and plays it {st}')
    pg.screenshot(path=D+'4-play-part.png')
    E(pg,"audio.pause()")
    check(E(pg,"songNow().rec")==False,'the song list still says no recording')
    check(E(pg,"SETUP.val('rec')")=='None yet','Settings still says no recording')
    check(E(pg,"async()=>{const a=await idbGet('audio');return !a||!a.blob}"),'your part is not saved as the recording')
    # change a note: the next ▶ makes it again
    E(pg,"()=>{S.cues[0].steps=['d-low'];renderCues();save()}");pg.click('#playBtn');pg.wait_for_timeout(2500)
    check(E(pg,"MYPART.on()&&!audio.paused"),'after changing a note ▶ plays the new part');E(pg,"audio.pause()")
    # Settings: Band sound and How you play, App look short, Pan look follows the app look
    E(pg,"showView('setup')");pg.wait_for_timeout(300);E(pg,"SETUP.show(null)");pg.wait_for_timeout(300)
    rows=E(pg,"[...document.querySelectorAll('#setList [data-row]')].map(x=>x.dataset.row)")
    check('band' in rows and 'feel' in rows,f'Settings has Band sound and How you play {rows}')
    check(E(pg,"document.querySelector('#setList [data-row=photos] .sxval').textContent")=='App look','Pan look says it follows the app look')
    check(not E(pg,"!!document.querySelector('#setList [data-row=look] small')"),'App look shows just the look')
    pg.screenshot(path=D+'5-settings.png',full_page=True)
    pg.click('#setList [data-row=band]');pg.wait_for_timeout(900)
    check(E(pg,"TW.isOpen&&TW.tab==='sound'"),'Band sound opens Pan sounds on the Sound tab');pg.screenshot(path=D+'6-band-sound.png')
    E(pg,"TW.open(false)");E(pg,"showView('setup')");E(pg,"SETUP.show(null)");pg.wait_for_timeout(300)
    pg.click('#setList [data-row=feel]');pg.wait_for_timeout(900);check(E(pg,"TW.isOpen&&TW.tab==='sound'"),'How you play opens there too');E(pg,"TW.open(false)")
    # Trinidad & Tobago: the App look row names the background
    E(pg,"THEME.setLook('tt')");E(pg,"showView('setup')");E(pg,"SETUP.show(null)");pg.wait_for_timeout(300)
    check(E(pg,"(document.querySelector('#setList [data-row=look] small')||{}).textContent")=='Background: Silk flag','Trinidad & Tobago: App look names the background')
    # Chrome Day skirts
    E(pg,"THEME.setLook('cday')");E(pg,"showView('play')");pg.wait_for_timeout(500)
    sk=E(pg,"getComputedStyle(document.querySelector('#playPans svg path[fill=\"url(#hgSkirt)\"]')).fill");check('thDaySkirt' in sk,f'Chrome Day: light chrome skirts ({sk})')
    pg.screenshot(path=D+'7-play-day.png')
    E(pg,"THEME.setLook('cnight')");pg.wait_for_timeout(300);pg.screenshot(path=D+'8-play-night.png')
    # the Chart's Arrangement (the whole band, from Studio) is for a Producer only
    E(pg,"()=>{STUDIO.arrangementData=()=>({secs:[{},{}],tracks:[],bpm:100})}")
    E(pg,"ROLE.toProducer()");pg.wait_for_timeout(300);E(pg,"PARTS.refresh()");pg.wait_for_timeout(300)
    check(E(pg,"!!document.querySelector('[data-part=__arr]')"),'Producer: the Chart offers the Arrangement')
    E(pg,"PARTS.pick?PARTS.pick('__arr'):0");E(pg,"ROLE.toBand()");pg.wait_for_timeout(500)
    check(E(pg,"!document.querySelector('[data-part=__arr]')&&PARTS.cur!=='__arr'"),'Band member: no Arrangement on the Chart')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
