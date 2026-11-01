import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR play along (🎓 Learn): the part for your pans goes quiet while the rest plays; its notes glow on the pans
# ahead of time; hits on time count (and flash green), notes let go by are missed; each pass gets a score; ■ ends it.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrlearn/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
N=lambda i,b:{'id':i,'v':.8,'b':b}
song={'bpm':120,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'tracks':[
  {'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[N('tenor:60',0),N('tenor:62',1),N('tenor:64',2),N('tenor:65',3)]},
  {'id':'b','name':'Double Guitar','set':'guitar','vol':1,'pan':0,'mute':False,'solo':False,'col':'#5ad1ff','notes':[N('guitar:48',0),N('guitar:52',2)]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");localStorage.setItem('panyard-vr-set','tenor');localStorage.setItem('panyard-vr-yard','0');sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79",timeout=90000)
    gid=pg.evaluate("VR.song().tracks[1].notes.map(n=>n.id)")
    # the hits' moments go straight to the scoring (this test browser draws a few frames a second, too slow to time real
    # strikes): 60 on time, 62 25 ms late, 64 let go by, 65 far too late (0.4 s)
    pg.evaluate("VR.hits.length=0;VR.act('learn');VR.learnAt('tenor:60',0);VR.learnAt('tenor:62',1.05);VR.learnAt('tenor:65',3.8)")
    L=pg.evaluate("VR.learning()");check(L['id']=='a','🎓 Learn picks the tenor part (the pans you\'re at)')
    pg.wait_for_function("VR.cues().some(c=>c.id==='tenor:60')",timeout=4000)
    pg.wait_for_function("VR.cues().some(c=>c.id==='tenor:60'&&c.a>=.4)",timeout=8000)
    check(True,'its first note glows on the tenor before it comes')
    pg.evaluate("document.getElementById('hud').hidden=true;VR.view('pans')");pg.screenshot(path=D+'1-cue.png')
    pg.wait_for_function("VR.tr().beat>4.6",timeout=15000)
    L=pg.evaluate("VR.learning()")
    check(L['ok']==2 and L['miss']>=2,f'two notes hit on time count; the one let go and the late one are missed ({L["ok"]} on time, {L["miss"]} missed)')
    hits=pg.evaluate("VR.hits")
    check(any(h['p']==1 and h['id'] in gid for h in hits) and not any(h['p']==1 and h['id'].startswith('tenor') for h in hits),'the guitar part plays round you; the tenor part is left for you')
    pg.wait_for_function("VR.toasts.some(t=>t.includes('This time'))",timeout=15000)
    tt=[t for t in pg.evaluate("VR.toasts") if 'This time' in t][0];check('2 of 4' in tt,'the first time round ends with its score: '+tt)
    pg.evaluate("VR.act('learn')");L=pg.evaluate("VR.learning()");check(L['id'] is None and pg.evaluate("VR.tr().state")=='idle','🎓 again stops playing along')
    check(not pg.evaluate("VR.cues()"),'and the glows go out')
    check(pg.evaluate("VR.song().tracks[0].notes.length")==4 and not pg.evaluate("VR.song().tracks[0].mute"),'the part itself is untouched')
    pg.evaluate("VR.view('table')");pg.wait_for_timeout(500);pg.screenshot(path=D+'2-screen.png')
    check(not errs,'no page errors '+str(errs[:3]))
    b.close()
print('PASS' if not fails else 'FAILED: '+'; '.join(fails));sys.exit(1 if fails else 0)
