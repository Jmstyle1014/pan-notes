import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR: both hands on the rims lift the pans (moved, turned and tilted up to you; they still play right, stay
# put per set, and ↺ Pans back levels them); one hand on a rim still moves one pan. My songs: 💾 Save keeps the song on
# the headset, Save again updates it, Save as new adds one, Open brings it back (↶ Undo goes back), Delete asks first;
# a song file opens as a new song; it's all on the page off the headset too.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrlift/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
song={'bpm':120,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'tracks':[
  {'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[{'id':'tenor:60','v':.8,'b':0},{'id':'tenor:64','v':.8,'b':1.5}]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1100,'height':760});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");localStorage.setItem('panyard-vr-set','tenor');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=60000)
    # lifting with both hands
    pg.evaluate("VR.showTable(false)")
    w0=pg.evaluate("VR.drumWorld(0)")
    check(pg.evaluate("VR.liftPans(0,0,0,.25,.1,.6)"),'both hands on the tenor\'s rim lift it')
    w1=pg.evaluate("VR.drumWorld(0)")
    check(w1['p'][1]-w0['p'][1]>.15,f'it comes up with your hands {w0["p"]} → {w1["p"]}')
    check(w1['up'][2]-w0['up'][2]>.3,f'tilting your wrists tilts its face up towards you (up {w0["up"]} → {w1["up"]})')
    ids=pg.evaluate("VR.notes()");ok=all(pg.evaluate(f"VR.swing('{i}',2.5)")==i for i in ids[::4])
    check(ok,'every note still plays itself on the tilted pan')
    pg.evaluate("VR.camera.position.set(.0,1.55,.45);VR.camera.lookAt(0,1.1,-.5)");pg.evaluate("document.getElementById('hud').hidden=true");pg.wait_for_timeout(600);pg.screenshot(path=D+'1-lifted.png')
    pg.evaluate("VR.set('dsec')");w2=pg.evaluate("VR.drumWorld(0)")
    check(pg.evaluate("VR.liftPans(0,1,-.1,0,0,-.2)"),'on the Double Second, a hand on each pan\'s rim lifts both')
    pg.evaluate("VR.set('tenor')");check(pg.evaluate("VR.drumWorld(0)")==w1,'each set stays where you lifted it')
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=60000);check(pg.evaluate("VR.drumWorld(0)")==w1,'and after the page opens again')
    pg.evaluate("VR.pansBack()");check(pg.evaluate("VR.lifted()")=={'p':[0,0,0],'q':[0,0,0,1]} and pg.evaluate("VR.drumWorld(0)")==w0,'↺ Pans back levels them again')
    pg.evaluate("VR.set('six')");p0=pg.evaluate("VR.panPos(2)");check(pg.evaluate("VR.movePan(2,.2,0,.1)") and pg.evaluate("VR.panPos(2)")!=p0,'one hand on a rim still moves just that pan')
    pg.evaluate("VR.pansBack();VR.set('tenor')")
    # my songs
    check(pg.evaluate("VR.songs()")==[],'no saved songs to start with')
    e=pg.evaluate("VR.saveMine(false)");check(pg.evaluate("VR.songs()")==[{'id':e['id'],'title':'Song 1','tracks':1}],'💾 Save keeps the song as Song 1')
    pg.evaluate("VR.song().tracks[0].notes.push({id:'tenor:67',v:.8,b:3})");pg.evaluate("VR.saveMine(false)")
    check(len(pg.evaluate("VR.songs()"))==1,'Save again updates the same song')
    pg.evaluate("VR.saveMine(true)");ss=pg.evaluate("VR.songs()");check([s['title'] for s in ss]==['Song 2','Song 1'],f'＋ Save as new adds another {[s["title"] for s in ss]}')
    pg.evaluate("VR.act('newsong')");check(pg.evaluate("VR.saveMine(false)") is None and len(pg.evaluate("VR.songs()"))==2,'an empty new song isn\'t saved')
    pg.evaluate(f"VR.openMine('{e['id']}')");sg=pg.evaluate("VR.song()")
    check(sg['title']=='Song 1' and len(sg['tracks'][0]['notes'])==3,'Open brings Song 1 back with its notes')
    pg.evaluate("VR.undo()");check(pg.evaluate("VR.song().tracks.length")==0,'↶ Undo goes back to the song before')
    pg.evaluate(f"VR.openMine('{e['id']}')")
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=60000)
    check(len(pg.evaluate("VR.songs()"))==2 and pg.evaluate("VR.song().title")=='Song 1','they\'re kept after the page opens again')
    # the menu's songs page
    pg.evaluate("VR.showTable(false);VR.view('pans');VR.camera.position.set(0,1.6,.6);VR.camera.lookAt(0,1.5,-.2);VR.menu(true)")
    check('msongs' in pg.evaluate("VR.menuHits()") and 'mback' in pg.evaluate("VR.menuHits()"),'the menu has 💾 My songs and ↺ Pans back')
    pg.evaluate("VR.press('menu','msongs')");hs=pg.evaluate("VR.menuHits()")
    check(pg.evaluate("VR.menuPage()")=='songs' and 'msave' in hs and 'msavenew' in hs and sum(h.startswith('mopen:') for h in hs)==2,'My songs lists both songs, with Save and Save as new')
    pg.evaluate("document.getElementById('hud').hidden=true");pg.wait_for_timeout(600);pg.screenshot(path=D+'2-songs.png')
    sid=[s['id'] for s in pg.evaluate("VR.songs()") if s['title']=='Song 2'][0]
    pg.evaluate(f"VR.press('menu','mdel:{sid}')");check(len(pg.evaluate("VR.songs()"))==2,'🗑 asks first (Delete?)')
    pg.evaluate(f"VR.press('menu','mdel:{sid}')");check([s['title'] for s in pg.evaluate("VR.songs()")]==['Song 1'],'a second press deletes it')
    pg.evaluate("VR.press('menu','mmain')");check(pg.evaluate("VR.menuPage()")=='main','◀ Back goes to the menu')
    pg.evaluate("VR.press('menu','mclose')")
    # the page off the headset; files
    pg.evaluate("document.getElementById('hud').hidden=false");pg.evaluate("VR.renameMine(VR.songs()[0].id,'Pan Jam')")
    check(pg.locator('#mineBox .mrow b').first.text_content()=='Pan Jam' and pg.evaluate("VR.song().title")=='Pan Jam','renaming on the page renames it')
    with pg.expect_download() as dl:pg.locator('#mineBox [data-mf]').first.click()
    txt=open(dl.value.path(),encoding='utf-8').read();j=json.loads(txt)
    check(j['format']=='panyard-vr-song' and j['title']=='Pan Jam' and len(j['song']['tracks'][0]['notes'])==3,'⬇ saves it as a file')
    t=pg.evaluate(f"VR.openFile({json.dumps(txt)})")
    check(t=='Pan Jam 2' and len(pg.evaluate("VR.songs()"))==2 and pg.evaluate("VR.song().title")=='Pan Jam 2','opening the file adds it as a new song and opens it')
    pg.locator('#mineBox').scroll_into_view_if_needed();pg.wait_for_timeout(200);pg.screenshot(path=D+'3-page.png')
    check(not errs,'no page errors '+str(errs[:3]))
    b.close()
print('PASS' if not fails else 'FAILED: '+'; '.join(fails));sys.exit(1 if fails else 0)
