import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR studio editing: a note picked on its lane moves, steps up and down its pans, gets softer or louder and is
# deleted; the bars picked on the ruler are copied in after themselves, moved and taken out on every track; a track is
# transposed by a semitone or an octave; swing pushes the off-beats later; ¾ speed slows the clock, not the notes; Undo.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvredit/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
song={'bpm':120,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'tracks':[
  {'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[{'id':'tenor:60','v':.8,'b':0},{'id':'tenor:64','v':.8,'b':1.5},{'id':'tenor:67','v':.8,'b':4.5}]},
  {'id':'b','name':'Drums','set':'kit','vol':1,'pan':0,'mute':False,'solo':False,'col':'#5ad1ff','notes':[{'id':'drum:36','v':1,'b':0},{'id':'drum:38','v':.9,'b':5}]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1100,'height':760});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");localStorage.setItem('panyard-vr-set','tenor');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=60000)
    T=lambda i:[(n['id'],n['b'],n['v']) for n in pg.evaluate(f"VR.song().tracks[{i}].notes")]
    # a note
    pg.evaluate("VR.pickNote(0,1)");check(pg.evaluate("VR.nsel()")['id']=='tenor:64','pointing at a note picks it')
    pg.evaluate("VR.act('nright')");check(pg.evaluate("VR.nsel()")['b']==1.75,'▶ moves it a quarter beat later')
    pg.evaluate("VR.act('nup')");up=pg.evaluate("VR.nsel()")['id'];check(up=='tenor:65',f'▲ makes it the next note up on the tenor ({up})')
    pg.evaluate("VR.act('nsoft')");check(abs(pg.evaluate("VR.nsel()")['v']-.65)<1e-6,'Softer makes it softer')
    pg.evaluate("VR.view('table');document.getElementById('hud').hidden=true");pg.wait_for_timeout(500);pg.screenshot(path=D+'1-note.png')
    pg.evaluate("VR.act('ndel')");check([n[0] for n in T(0)]==['tenor:60','tenor:67'],'🗑 deletes it')
    pg.evaluate("VR.act('undo')");check(len(T(0))==3,'↶ Undo brings it back')
    # bars: bar 1 picked on the ruler (as a loop), copied in after itself
    pg.evaluate("VR.song().loop={on:true,s:0,e:1}")
    pg.evaluate("VR.act('bcopy')");sg=pg.evaluate("VR.song()")
    check(sg['L']==12 and [n['b'] for n in sg['tracks'][0]['notes']]==[0,1.75,4,5.75,8.5] and [n['b'] for n in sg['tracks'][1]['notes']]==[0,4,9],f'⧉ Copy bars plays bar 1 again straight after, on every track, and the rest moves later {[n["b"] for n in sg["tracks"][0]["notes"]]}')
    pg.evaluate("VR.act('undo')")
    pg.evaluate("VR.song().loop={on:true,s:0,e:1}");pg.evaluate("VR.act('bright')")
    check([n['b'] for n in pg.evaluate("VR.song().tracks[0].notes")]==[0.5,4,5.75],f'Move ▶ swaps bar 1 with bar 2 {[n["b"] for n in pg.evaluate("VR.song().tracks[0].notes")]}')
    pg.evaluate("VR.act('undo')")
    pg.evaluate("VR.song().loop={on:true,s:0,e:1}");pg.evaluate("VR.act('bdel')");sg=pg.evaluate("VR.song()")
    check(sg['L']==4 and [n['b'] for n in sg['tracks'][0]['notes']]==[0.5],f'✕ Bars takes bar 1 out and pulls the rest in (L {sg["L"]})')
    pg.evaluate("VR.act('undo')")
    # transpose the tenor
    pg.evaluate("VR.act('lane:0')");pg.evaluate("VR.act('tu1')");check([n[0] for n in T(0)]==['tenor:61','tenor:66','tenor:68'],f'+1 moves the tenor up a semitone {[n[0] for n in T(0)]}')
    pg.evaluate("VR.act('tuo')");ids=[n[0] for n in T(0)];check(ids==['tenor:73','tenor:78','tenor:80'],f'+8va moves it up an octave {ids}')
    pg.evaluate("VR.act('tuo')");check(len(T(0))==1,f'notes past the top of the pans are dropped, and it says so {T(0)}')
    pg.evaluate("VR.act('undo');VR.act('undo');VR.act('undo')");check([n[0] for n in T(0)]==['tenor:60','tenor:65','tenor:67'],'Undo goes back')
    # swing and speed: how it plays
    pg.evaluate("VR.act('swing')");check(pg.evaluate("VR.song().swing")==.58,'Swing: Light')
    pg.evaluate("VR.song().tracks[0].notes=[{id:'tenor:60',v:.8,b:0},{id:'tenor:62',v:.8,b:0.5}];VR.song().tracks[1].mute=true;VR.song().loop.on=false")
    pg.evaluate("VR.hits.length=0;VR.act('play')");pg.wait_for_timeout(1200);pg.evaluate("VR.act('play')")
    ts=pg.evaluate("VR._times||null")
    hs=[h['id'] for h in pg.evaluate("VR.hits") if h['p']]
    check('tenor:62' in hs,'with swing on the off-beat note still plays')
    pg.evaluate("VR.act('speed')");check(pg.evaluate("VR.song().speed")==.75 and pg.evaluate("VR.song().bpm")==120,'Speed ¾ slows the practice, the song stays at ♩ 120')
    pg.screenshot(path=D+'2-edit-rows.png')
    # + Track asks which pans; an empty track's pans can change, one with notes can't
    pg.evaluate("VR.act('add')");check(pg.evaluate("VR.press('screen','pick:six')") and pg.evaluate("VR.song().tracks[2].set")=='six' and pg.evaluate("VR.state().set")=='six','+ Track → Six Bass: a six bass track, and the basses come out')
    pg.evaluate("VR.act('setof:2')");pg.evaluate("VR.press('screen','pick:guitar')");check(pg.evaluate("VR.song().tracks[2].set")=='guitar' and pg.evaluate("VR.state().set")=='guitar','an empty track\'s pans can be changed from the desk')
    pg.evaluate("VR.act('setof:0')");check(not pg.evaluate("VR.press('screen','pick:six')") and pg.evaluate("VR.song().tracks[0].set")=='tenor','a track with notes keeps its pans')
    pg.evaluate("VR.act('add')");pg.evaluate("VR.view('table');document.getElementById('hud').hidden=true");pg.wait_for_timeout(500);pg.screenshot(path=D+'3-pick.png');pg.evaluate("VR.act('pickx');VR.act('del:2')")
    # a new song, then Undo; putting the table away stops the music, bringing it back
    pg.evaluate("VR.act('play')");pg.evaluate("VR.act('newsong')");sg=pg.evaluate("VR.song()")
    check(not sg['tracks'] and pg.evaluate("VR.tr().state")=='idle','🗋 New song stops and starts an empty song')
    pg.evaluate("VR.act('undo')");check(len(pg.evaluate("VR.song().tracks"))==2,'↶ Undo brings the old song back')
    pg.evaluate("VR.act('play');VR.act('hide')");check(not pg.evaluate("VR.tableOn()") and pg.evaluate("VR.tr().state")=='idle' and not pg.evaluate("VR.song().click"),'putting the table away stops the music and the click')
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=60000);check(not pg.evaluate("VR.tableOn()"),'it stays away next time')
    pg.click('#studioSeg [data-st=on]');check(pg.evaluate("VR.tableOn()"),'and comes back out')
    # the menu (a thumbstick press): pans, look, the two sound switches (on unless turned off), sticks, the table
    check(pg.evaluate("VR.opts()")=={'hum':True,'tone':True},'Drum body hum and bass & treble are on to start with')
    pg.evaluate("VR.menu(true)");check(pg.evaluate("VR.menuOn()"),'the menu opens')
    pg.evaluate("VR.view('pans')");pg.wait_for_timeout(400);pg.evaluate("VR.camera.position.set(0,1.6,.6);VR.camera.lookAt(0,1.5,-.2);VR.menu(true)");pg.wait_for_timeout(500);pg.screenshot(path=D+'4-menu.png')
    pg.evaluate("VR.press('menu','mhum');VR.press('menu','mtone')");check(pg.evaluate("VR.opts()")=={'hum':False,'tone':False},'both sound switches turn off from the menu')
    check(pg.evaluate("VR.strike('tenor:60',.9)"),'a note still plays with both off')
    pg.evaluate("VR.set('tenor');VR.menu(true);VR.press('menu','mset:1')");check(pg.evaluate("VR.state().set")=='dten','◀ ▶ in the menu change the pans')
    pg.evaluate("VR.press('menu','mclose')");check(not pg.evaluate("VR.menuOn()"),'✕ Close closes it')
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=60000);check(pg.evaluate("VR.opts()")=={'hum':False,'tone':False},'the switches are kept for next time')
    pg.click('#optSeg [data-opt=hum]');pg.click('#optSeg [data-opt=tone]');check(pg.evaluate("VR.opts()")=={'hum':True,'tone':True},'and the page\'s Sound switches turn them back on')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
