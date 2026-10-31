import os,sys,json,math
from playwright.sync_api import sync_playwright
# Panyard VR's pan yard: every pan in the song stands round a circle; you teleport (the arc snaps to a station's spot),
# snap turn or walk to them; the station you're at is yours (its sticks, its track to record on, the table beside you);
# each station's sound comes from where it stands (Even mix: far pans fade only a little); a new song asks which pans
# are in it; kids mode is the yard with a fixed band and no studio; One pan is the old way.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvryard/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
song={'bpm':120,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'tracks':[
  {'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[{'id':'tenor:60','v':.8,'b':0},{'id':'tenor:64','v':.8,'b':2}]},
  {'id':'b','name':'Double Guitar','set':'guitar','vol':1,'pan':0,'mute':False,'solo':False,'col':'#5ad1ff','notes':[]},
  {'id':'c','name':'Six Bass','set':'six','vol':1,'pan':0,'mute':False,'solo':False,'col':'#7ee08a','notes':[]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1100,'height':760});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");localStorage.setItem('panyard-vr-set','tenor');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000)
    ST=lambda:{s['k']:s for s in pg.evaluate("VR.stations()")}
    # the yard is the way it opens
    st=ST();check(pg.evaluate("VR.inYard()") and set(st)=={'tenor','guitar','six'},f'the song\'s pans all stand in the yard {sorted(st)}')
    r=[math.hypot(*s['at']) for s in st.values()];check(all(abs(x-4)<.05 for x in r),'round a circle')
    check(st['tenor']['at'][1]<-3 and st['six']['at'][1]>2.5,'tenors at the front, basses at the back')
    pl=pg.evaluate("VR.player()");check(pl['at']=='tenor' and abs(math.hypot(pl['x'],pl['z'])-4.5)<.05,f'you start at the tenor, behind it, facing in {pl}')
    pg.evaluate("document.getElementById('hud').hidden=true;VR.view('yard')");pg.wait_for_timeout(700);pg.screenshot(path=D+'1-yard.png')
    # teleport
    l=pg.evaluate("VR.land(1.37,3.76)");check(l['k']=='six' and l['ok'],'the arc landing on the basses snaps to their spot')
    l=pg.evaluate("VR.land(0,0)");check(l['k'] is None and l['ok'],'the middle of the yard is a free spot')
    l=pg.evaluate("VR.land(0,7.6)");check(not l['ok'],'past the floor isn\'t')
    # an arc thrown from the tenor spot towards the guitars
    pl=pg.evaluate("VR.player()");g=st['guitar']['at'];dx,dz=g[0]-pl['x'],g[1]-pl['z'];n=math.hypot(dx,dz)
    hit=None
    for up in [x/20 for x in range(-6,14)]:
        l=pg.evaluate(f"VR.aim({pl['x']},1.2,{pl['z']},{dx/n},{up},{dz/n},false)")
        if l and l['k']=='guitar':hit=up;break
    check(hit is not None,'an arc aimed at the guitars lands on them')
    pg.evaluate(f"VR.aim({pl['x']},1.2,{pl['z']},{dx/n},{hit},{dz/n},true)")
    check(pg.evaluate("VR.player()")['at']=='guitar' and pg.evaluate("VR.sticks()")==['guitar','guitar'],'letting go takes you there, with the guitar sticks')
    check(pg.evaluate("VR.song().sel")==1,'and its track is the one you record on')
    y0=pg.evaluate("VR.player()")['yaw'];pg.evaluate("VR.snapTurn(-1)");y1=pg.evaluate("VR.player()")['yaw']
    check(abs(abs(y1-y0)-math.pi/4)<.01,f'snap turn turns you 45° ({y0} → {y1})')
    pg.evaluate("VR.goTo('six')");pg.evaluate("VR.view('pans')");pg.wait_for_timeout(600);pg.screenshot(path=D+'2-at-the-basses.png')
    # walking
    sp=pg.evaluate("VR.goTo('tenor');VR.player()");pg.evaluate("VR.goTo('six')")
    pg.evaluate(f"VR.walk({sp['x']+.3},{sp['z']+.2})");check(pg.evaluate("VR.player()")['at']=='tenor','walking up to the tenor makes it yours')
    pg.evaluate("VR.walk(0,0)");check(pg.evaluate("VR.player()")['at']=='tenor','the middle of the yard leaves you where you were')
    # every note still plays itself, on every station
    ids=pg.evaluate("VR.notes()");bad=[i for i in ids[::3] if pg.evaluate(f"VR.swing('{i}',2.5)")!=i]
    check(not bad,f'notes on every station play themselves ({len(ids)} notes, bad {bad[:4]})')
    # surround
    sp=pg.evaluate("VR.spatial()")
    ok=all(t['spatial'] and abs(math.hypot(t['x'],t['z'])-4)<.05 for t in sp)
    check(ok,f'each track sounds from where its pans stand {sp}')
    check(all(t['roll']==.3 for t in sp),'Even mix is on: far pans fade only a little')
    pg.evaluate("VR.even(false)");check(all(t['roll']==1 for t in pg.evaluate("VR.spatial()")),'Even mix off: like real life');pg.evaluate("VR.even(true)")
    e=pg.evaluate("VR.goTo('six');VR.ear()");six=ST()['six']['at']
    check(math.hypot(e['x']-six[0],e['z']-six[1])<1 and e['fx']*(-six[0])+e['fz']*(-six[1])>0,f'your ears are at the basses, facing into the yard {e}')
    # recording goes to the pans you're at
    pg.evaluate("VR.goTo('six');VR.act('rec')");pg.wait_for_timeout(2600)
    six_id=[i for i in ids if i.startswith('six:')][0];ten_id='tenor:62'
    pg.evaluate(f"VR.swing('{six_id}',2.5)");pg.evaluate(f"VR.strike('{ten_id}',.8)");pg.wait_for_timeout(300);pg.evaluate("VR.act('rec')");pg.evaluate("VR.act('play')")
    tr=pg.evaluate("VR.song().tracks")
    check([n['id'] for n in tr[2]['notes']]==[six_id] and len(tr[0]['notes'])==2,f'● Rec at the basses records the bass track, and only the bass notes {[n["id"] for n in tr[2]["notes"]]}')
    # a new song asks which pans
    pg.evaluate("VR.act('newsong')");check(pg.evaluate("VR.pick()")=='song','🗋 New song asks which pans are in it')
    pg.evaluate("VR.act('pick:dsec');VR.act('pick:fcello');VR.act('pick:kit')")
    pg.evaluate("VR.view('table')");pg.wait_for_timeout(600);pg.screenshot(path=D+'3-new-song.png')
    pg.evaluate("VR.act('pickgo')");tr=[t['set'] for t in pg.evaluate("VR.song().tracks")]
    check(tr==['dsec','fcello','six','kit'],f'Put them out: a track each (the basses you were at were ticked already) {tr}')
    check(set(ST())==set(tr),f'and only those pans stand in the yard {sorted(ST())}')
    pg.evaluate("VR.undo()");check(set(ST())=={'tenor','guitar','six'},'↶ Undo brings the old song\'s pans back')
    # + Track brings new pans out and takes you there
    pg.evaluate("VR.act('add');VR.act('pick:seven')");check('seven' in ST() and pg.evaluate("VR.player()")['at']=='seven','+ Track: the new pans come out and you go to them')
    # kids mode
    pg.evaluate("VR.kids(true)");check(set(ST())=={'tenor','dsec','guitar','fcello','six','kit'} and not pg.evaluate("VR.tableOn()") or set(ST())=={'tenor','dsec','guitar','fcello','six','kit'},'kids mode: a band of pans out')
    check(pg.evaluate("VR.menuHits()").count('mkids')==1 and 'msongs' not in pg.evaluate("VR.menuHits()"),'its menu is the simple one')
    pg.evaluate("VR.goTo('kit');VR.view('yard');VR.menu(false)");pg.wait_for_timeout(700);pg.screenshot(path=D+'4-kids.png')
    pg.evaluate("VR.view('pans');VR.goTo('tenor');VR.camera.position.set(0,1.6,-4.6);VR.camera.lookAt(0,1.5,-3.2);VR.menu(true)");pg.wait_for_timeout(600);pg.screenshot(path=D+'5-kids-menu.png');pg.evaluate("VR.menu(false)")
    pg.evaluate("VR.kids(false)");check(set(ST())>={'tenor','guitar','six','seven'},'leaving kids mode brings the song\'s pans back')
    # one pan
    pg.evaluate("VR.yard(false)");st=ST();check(len(st)==1 and not pg.evaluate("VR.inYard()"),'One pan: just the pans in front of you')
    pg.evaluate("VR.yard(true)");check(len(ST())>=3,'and back to the yard')
    pg.evaluate("VR.camera.position.set(0,1.6,-4.6);VR.camera.lookAt(0,1.5,-3.2);VR.goTo('tenor');VR.menu(true)")
    pg.evaluate("VR.camera.position.set(0,1.62,-4.6);VR.camera.lookAt(0,1.5,-3.2)");pg.wait_for_timeout(600);pg.screenshot(path=D+'6-menu.png')
    check(not errs,'no page errors '+str(errs[:3]))
    b.close()
print('PASS' if not fails else 'FAILED: '+'; '.join(fails));sys.exit(1 if fails else 0)
