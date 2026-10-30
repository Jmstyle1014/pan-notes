import os,sys
import numpy as np
from playwright.sync_api import sync_playwright
# Panyard VR: the band's tenor and double guitar in a headset's browser, in Chrome or a Vincy Mas look. Every note's place on the 3D pan finds that note, the band's
# recordings load (A 441), a stick swung down through a note plays it (harder swing = louder), a stick that stays
# down doesn't play again until it lifts, and off the headset a tap on a note plays it.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvr/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    if u.startswith('band/band-sounds/'):f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1])
    else:f=os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
REC="""(()=>{window._rec=[];const _c=AudioNode.prototype.connect;AudioNode.prototype.connect=function(d,...a){if(d instanceof AudioDestinationNode){if(!d._sp){const sp=d.context.createScriptProcessor(4096,1,1);sp.onaudioprocess=e=>{if(window._on)window._rec.push(Array.from(e.inputBuffer.getChannelData(0)))};const z=d.context.createGain();z.gain.value=0;_c.call(sp,z);_c.call(z,d);d._sp=sp}_c.call(this,d._sp)}return _c.call(this,d,...a)}})()"""
def grab(pg,js,ms=1200):
    pg.wait_for_timeout(900);pg.evaluate("()=>{window._rec=[];window._on=1}");r=pg.evaluate(js);pg.wait_for_timeout(ms);pg.evaluate("()=>window._on=0")
    n=pg.evaluate("window._rec.length");return r,(np.concatenate([np.array(x) for x in pg.evaluate("window._rec")]) if n else np.zeros(1))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':892,'height':600},device_scale_factor=1);ctx.add_init_script(REC)
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=60000)
    check(pg.evaluate("VR.ready()")==79,'the band\'s 29 tenor, 20 guitar and 30 double second notes are loaded')
    check('Ready' in pg.inner_text('#status'),'it says the sounds are ready: '+pg.inner_text('#status'))
    ids=pg.evaluate("VR.notes()");bad=[i for i in ids if pg.evaluate(f"VR.noteAt('{i}')")!=i]
    check(len(ids)==29 and not bad,f'every tenor note\'s place on the pan finds that note {bad}')
    pg.screenshot(path=D+'1-page.png')
    # the pans in 3D: a tenor's bowl sunk about 7½ in, a groove sunk round each note, the note domed a little
    sv=pg.evaluate("VR.surf('tenor:60')");check(abs(sv['depth']-.19)<1e-6,f'the tenor\'s bowl is sunk 19 cm {sv}')
    mid=pg.evaluate("VR.grooveAt('tenor:72',0)");edge=min(pg.evaluate(f"VR.grooveAt('tenor:72',{d})") for d in [.028,.03,.032,.034,.036,-.028,-.03,-.032,-.034,-.036])
    check(mid>.002 and edge<-.002,f'a note is domed in the middle ({mid*1000:.1f} mm) and the groove round it sinks ({edge*1000:.1f} mm)')
    r1,x1=grab(pg,"VR.swing('tenor:60',3.2)")
    check(r1=='tenor:60' and abs(x1).max()>.05,f'a full swing down through low C plays it (peak {abs(x1).max():.2f})')
    r2,x2=grab(pg,"VR.swing('tenor:76',.6)")
    check(r2=='tenor:76' and .005<abs(x2).max()<abs(x1).max(),f'a gentle swing plays E softer (peak {abs(x2).max():.2f})')
    check(abs(x1).max()<1,'no clipping')
    hv=pg.evaluate("VR.hits.slice(-2).map(h=>h.v)");check(hv[0]>hv[1],f'harder swing, harder hit {hv}')
    # the tip resting on the note doesn't keep playing; lifting it and hitting again does
    n0=pg.evaluate("VR.hits.length")
    k0=pg.evaluate("VR.hits.length");pg.evaluate("VR.swing('tenor:64',2.5)");check(pg.evaluate("VR.hits.length")==k0+1,'one swing through the steel is one hit (resting on it doesn\'t play again)')
    again=pg.evaluate("""(()=>{const out=[];const id='tenor:67';out.push(VR.swing(id,2));return out})()""")
    check(again==['tenor:67'],'another note plays')
    # a tap with the mouse (off the headset)
    pg.evaluate("document.getElementById('hud').hidden=true");xy=pg.evaluate("VR.screenOf('tenor:72')")
    pg.mouse.click(*xy);pg.wait_for_timeout(300)
    check(pg.evaluate("VR.hits.length")>n0+1,f'a tap on the pan plays a note {pg.evaluate("VR.hits.slice(-1)")}')
    # the Double Guitar: two pans, every note found, a swing on each pan plays
    pg.evaluate("VR.set('guitar')");pg.wait_for_timeout(300)
    gids=pg.evaluate("VR.notes()");gbad=[i for i in gids if pg.evaluate(f"VR.noteAt('{i}')")!=i]
    check(pg.evaluate("VR.state().drums")==2 and len(gids)==20 and not gbad,f'the Double Guitar has two pans, and every note\'s place finds that note {gbad}')
    r3,x3=grab(pg,"VR.swing('d-low',3)");r4,x4=grab(pg,"VR.swing('cs-inner',3)")
    check(r3=='d-low' and r4=='cs-inner' and abs(x3).max()>.05 and abs(x4).max()>.05,f'a swing plays the E/C pan\'s low D and the B/F pan\'s inner C# ({abs(x3).max():.2f}, {abs(x4).max():.2f})')
    # the Double Second: the C pan and the C♯ pan
    pg.evaluate("VR.set('dsec')");pg.wait_for_timeout(300)
    dids=pg.evaluate("VR.notes()");dbad=[i for i in dids if pg.evaluate(f"VR.noteAt('{i}')")!=i]
    check(pg.evaluate("VR.state().drums")==2 and len(dids)==30 and not dbad,f'the Double Second has two pans, and every note\'s place finds that note {dbad}')
    r5,x5=grab(pg,"VR.swing('dsec:60',3)");r6,x6=grab(pg,"VR.swing('dsec:61',3)")
    check(r5=='dsec:60' and r6=='dsec:61' and abs(x5).max()>.05 and abs(x6).max()>.05,f'a swing plays the C pan\'s C and the C♯ pan\'s C♯ ({abs(x5).max():.2f}, {abs(x6).max():.2f})')
    pg.screenshot(path=D+'2b-dsec.png')
    # the studio table: point and pull the trigger (here: the same press at a spot on the desk or the screen)
    pg.evaluate("VR.act('click')");pg.evaluate("VR.song().bpm=200");c0=pg.evaluate("VR.clicks");pg.wait_for_timeout(1300)
    check(pg.evaluate("VR.clicks")-c0>=3 and pg.evaluate("VR.song().click"),'Click on the screen starts the metronome')
    check(pg.evaluate("VR.press('screen','click')") and not pg.evaluate("VR.song().click"),'pressing Click on the screen again stops it')
    check(pg.evaluate("VR.press('screen','fast')") and pg.evaluate("VR.song().bpm")==204,'+ makes it faster');pg.evaluate("VR.song().bpm=200")
    # track 1 on the Double Second: a bar to count in, three notes, ● again
    pg.evaluate("VR.press('screen','rec')");pg.wait_for_timeout(1350)
    check(pg.evaluate("VR.tr().state")=='rec' and pg.evaluate("VR.song().tracks.length")==1,'● Rec makes a first track and counts in a bar, then records')
    for nid in ['dsec:60','dsec:64','dsec:67']:
        pg.evaluate(f"VR.swing('{nid}',2.5)");pg.wait_for_timeout(250)
    pg.evaluate("VR.press('screen','rec')");sg=pg.evaluate("VR.song()");t1=sg['tracks'][0]
    check([n['id'] for n in t1['notes']]==['dsec:60','dsec:64','dsec:67'] and sg['L']%4==0 and sg['L']>max(n['b'] for n in t1['notes']),f'track 1 has the three notes, rounded up to whole bars (L {sg["L"]})')
    h0=pg.evaluate("VR.hits.length");pg.wait_for_timeout(2600)
    back=[h['id'] for h in pg.evaluate("VR.hits")[h0:] if h['p']]
    check(back[:3]==['dsec:60','dsec:64','dsec:67'],f'● again stops recording and the track plays back on a loop {back[:6]}')
    pg.evaluate("VR.press('screen','play')");check(pg.evaluate("VR.tr().state")=='idle','■ Stop stops it')
    # track 2 on the tenor, while track 1 plays along
    check(pg.evaluate("VR.press('desk','add')") and pg.evaluate("VR.song().tracks.length")==2,'+ Track adds a second track')
    pg.evaluate("VR.set('tenor')");pg.evaluate("VR.song().tracks[1].set='tenor';VR.song().tracks[1].name='Tenor'")
    pg.evaluate("VR.press('screen','rec')");pg.wait_for_timeout(1300)
    h1=pg.evaluate("VR.hits.length")
    for nid in ['tenor:72','tenor:76']:
        pg.evaluate(f"VR.swing('{nid}',2.5)");pg.wait_for_timeout(300)
    pg.wait_for_timeout(500);pg.evaluate("VR.press('screen','rec')")
    sg=pg.evaluate("VR.song()");heard=[h['id'] for h in pg.evaluate("VR.hits")[h1:] if h['p']]
    check([n['id'] for n in sg['tracks'][1]['notes']]==['tenor:72','tenor:76'] and sg['tracks'][0]['notes'] and any(i.startswith('dsec') for i in heard),f'track 2 records the tenor while track 1 plays along {heard[:4]}')
    pg.screenshot(path=D+'3a-studio-play.png')
    # the desk: mute, solo, a fader, left / right
    pg.evaluate("VR.press('desk','m:0')");check(pg.evaluate("VR.song().tracks[0].mute"),'M mutes track 1')
    h2=pg.evaluate("VR.hits.length");pg.wait_for_timeout(2600);heard=[h['id'] for h in pg.evaluate("VR.hits")[h2:] if h['p']]
    check(heard and not any(i.startswith('dsec') for i in heard),f'a muted track isn\'t heard {heard[:4]}')
    pg.evaluate("VR.press('desk','m:0');VR.press('desk','s:0')");h3=pg.evaluate("VR.hits.length");pg.wait_for_timeout(2600);heard=[h['id'] for h in pg.evaluate("VR.hits")[h3:] if h['p']]
    check(heard and all(i.startswith('dsec') for i in heard),f'S (solo) plays only track 1 {heard[:4]}')
    pg.evaluate("VR.press('desk','s:0')")
    pg.evaluate("VR.drag('desk','vol:1',.5,.9,.5,.6)");v=pg.evaluate("VR.song().tracks[1].vol")
    check(.1<v<.95,f'dragging track 2\'s fader down turns it down ({v:.2f})')
    pg.evaluate("VR.drag('desk','pan:1',.5,.5,.1,.5)");pn=pg.evaluate("VR.song().tracks[1].pan")
    check(pn<-.5,f'dragging its left/right knob moves it left ({pn:.2f})')
    # snap to the beat, undo
    pg.evaluate("VR.press('screen','lane:1')");before=[n['b'] for n in pg.evaluate("VR.song().tracks[1].notes")]
    pg.evaluate("VR.press('screen','snap2')");after=[n['b'] for n in pg.evaluate("VR.song().tracks[1].notes")]
    check(all(abs(b*2-round(b*2))<1e-6 for b in after),f'Snap ½ puts track 2\'s notes on half beats {before} → {after}')
    pg.evaluate("VR.press('screen','undo')");check([n['b'] for n in pg.evaluate("VR.song().tracks[1].notes")]==before,'↶ Undo puts them back')
    # loop a bar: drag along the ruler
    L=pg.evaluate("VR.song().L")
    if L>=8:
        pg.evaluate(f"VR.drag('screen','ruler',{(4.5)/L},.5,{(4.5)/L},.5)")
        lp=pg.evaluate("VR.song().loop");check(lp['on'] and lp['s']==1 and lp['e']==2,f'dragging on the ruler loops bar 2 {lp}')
    else:
        pg.evaluate("VR.press('screen','loop')");lp=pg.evaluate("VR.song().loop");check(lp['on'],f'⟲ Loop turns on a loop {lp}')
    pg.evaluate("VR.view('table')");pg.wait_for_timeout(500);pg.screenshot(path=D+'3b-studio-table.png')
    pg.evaluate("VR.press('screen','play')")
    # delete a track, undo brings it back, ↻ records a track again
    pg.evaluate("VR.press('desk','del:1')");check(pg.evaluate("VR.song().tracks.length")==1,'✕ deletes track 2')
    pg.evaluate("VR.press('screen','undo')");check(pg.evaluate("VR.song().tracks.length")==2,'↶ Undo brings it back')
    pg.evaluate("VR.press('desk','re:1')");check(pg.evaluate("VR.tr().state")=='rec' and not pg.evaluate("VR.song().tracks[1].notes"),'↻ Rec empties track 2 and records it again')
    pg.evaluate("VR.press('screen','play')");check(pg.evaluate("VR.tr().state")=='idle','■ Stop')
    # the table: squeeze a grip on it and move it; it stays where you put it
    t0=pg.evaluate("VR.table()");check(pg.evaluate("VR.dragTable(.2,.05,-.15)"),'a grip squeezed on the table grabs it')
    t1=pg.evaluate("VR.table()");check(abs(t1[0]-t0[0]-.2)<.01 and abs(t1[2]-t0[2]+.15)<.01 and abs(t1[1]-t0[1]-.05)<.01,f'moving the hand moves the table with it {t0} → {t1}')
    # everything is kept for next time
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=60000)
    sg=pg.evaluate("VR.song()");check(len(sg['tracks'])==2 and sg['tracks'][0]['notes'],'the tracks are kept for next time')
    check(pg.evaluate("VR.table()")==t1,'the table stays where you put it')
    pg.evaluate("VR.tableReset()");check(pg.evaluate("VR.table()")==t0,'and it can go back to its place')
    # the beam: a real click on the screen's Click button (mouse off the headset) goes through the same pointer
    pg.evaluate("document.getElementById('hud').hidden=true;VR.view('table')");pg.wait_for_timeout(400)
    xy=pg.evaluate("VR.screenOfPanel('screen','click')");pg.mouse.click(*xy);pg.wait_for_timeout(200)
    check(pg.evaluate("VR.song().click"),'pointing at Click on the screen and pressing works')
    pg.evaluate("VR.act('click');VR.view('pans')")
    pg.evaluate("document.getElementById('hud').hidden=true")
    pg.evaluate("VR.look('gems')");pg.wait_for_timeout(300)
    check(pg.evaluate("VR.state().look")=='gems','the Vincy Mas look goes on')
    pg.set_viewport_size({'width':1200,'height':800});pg.wait_for_timeout(300);pg.evaluate("VR.demo()");pg.wait_for_timeout(600)
    pg.screenshot(path=D+'2-guitar-gems.png')
    pg.evaluate("VR.set('tenor');VR.look('gren')");pg.wait_for_timeout(500);pg.screenshot(path=D+'3-tenor-gren.png')
    pg.evaluate("VR.set('guitar');VR.look('flag')");pg.wait_for_timeout(500);pg.screenshot(path=D+'4-guitar-flag.png')
    pg.evaluate("VR.camera.position.set(0,1.75,1.3);VR.camera.lookAt(0,1.05,-1.2)");pg.wait_for_timeout(400);pg.screenshot(path=D+'4b-flag-wide.png')
    pg.evaluate("VR.camera.position.set(0,1.62,.12);VR.camera.lookAt(0,.86,-.5)")
    pg.evaluate("VR.set('tenor');VR.look('chrome')");pg.wait_for_timeout(500);pg.screenshot(path=D+'5-tenor-chrome.png')
    pg.evaluate("VR.nextSet();VR.nextLook()");check(pg.evaluate("[VR.state().set,VR.state().look]")==['guitar','gems'],'B / Y and a thumbstick press switch the pans and the look')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
