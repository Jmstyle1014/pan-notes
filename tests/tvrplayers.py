import os,sys,json,math
from playwright.sync_api import sync_playwright
# Panyard VR players: a section can have several players (copies of its pans side by side in the yard) without another track.
# Every copy plays the part when the song plays (a hair apart, a little softer), so 3 tenors sound fuller than 1; you can play
# any copy; set with the mixer strip's Players − / + or the sign over a section you point at; saved per song; capped for big
# sets; none for the drum kit; the copies never overlap the other sections.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrplayers/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
N=lambda i,b:{'id':i,'v':.8,'b':b}
song={'bpm':90,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'title':'Players','tracks':[
  {'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[N('tenor:72',0),N('tenor:76',1),N('tenor:79',2),N('tenor:72',4)]},
  {'id':'b','name':'Double Second','set':'dsec','vol':1,'pan':0,'mute':False,'solo':False,'col':'#5ad1ff','notes':[N('dsec:64',0)]}]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1280,'height':800});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-song',"+json.dumps(json.dumps(song))+");sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:(pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000),pg.evaluate("document.getElementById('hud').hidden=true"))
    pg.goto('https://pan.test/vr/');load()
    check(pg.evaluate("VR.players.of('tenor')")==1,'a section starts with one player')
    def loud():
        pg.evaluate("VR.lastBuf=null");pg.evaluate("VR.render()");pg.wait_for_function("VR.lastBuf",timeout=30000)
        return pg.evaluate("(()=>{const x=VR.lastBuf.getChannelData(0);let e=0;for(let i=0;i<x.length;i++)e+=x[i]*x[i];return e})()")
    pg.evaluate("VR.song().tracks[1].mute=true");e1=loud()
    tracks0=len(pg.evaluate("VR.song().tracks"))
    pg.evaluate("VR.players.set('tenor',3)");pg.wait_for_timeout(400)
    ds=pg.evaluate("VR.players.drums('tenor')")
    check(len(ds)==3 and sorted(d['copy'] for d in ds)==[0,1,2],f'three tenors stand in the yard {ds}')
    gaps=[math.dist((a['x'],a['z']),(c['x'],c['z'])) for i,a in enumerate(ds) for c in ds[i+1:]]
    check(min(gaps)>.6,f'side by side with room for a player between (closest {min(gaps):.2f} m)')
    check(len(pg.evaluate("VR.song().tracks"))==tracks0,'no extra track was added')
    st=pg.evaluate("VR.yfeel.st()");check(max(x['clash'] for x in st)<=0,f'the bigger section doesn\'t overlap any other (worst {max(x["clash"] for x in st)})')
    e3=loud();check(e3>e1*1.4,f'three tenors sound fuller than one (energy ×{e3/e1:.2f})')
    r=pg.evaluate("VR.players.hitCopy('tenor',2,'tenor:76',2.5)");check(r=='tenor:76','you can play any copy: the third tenor plays its E')
    pg.evaluate("VR.players.press('plp:0')");check(pg.evaluate("VR.players.of('tenor')")==4,'the mixer strip\'s + adds a player')
    pg.evaluate("VR.players.press('plm:0')");check(pg.evaluate("VR.players.of('tenor')")==3,'and − takes one away')
    pg.evaluate("VR.players.sign('dsec')");pg.evaluate("VR.players.press('psp')");check(pg.evaluate("VR.players.of('dsec')")==2,'the sign over the double seconds adds a player there')
    pg.evaluate("VR.players.press('psm')");check(pg.evaluate("VR.players.of('dsec')")==1,'and takes it away')
    for _ in range(9):pg.evaluate("VR.players.press('plp:0')")
    check(pg.evaluate("VR.players.of('tenor')")==6,'up to six tenors')
    mx=pg.evaluate("['six','seven','fcello','kit'].map(k=>VR.players.max(k))");check(mx==[2,2,3,1],f'big sets have fewer (six, seven, four cello, kit: {mx})')
    pg.evaluate("VR.players.set('tenor',3)");pg.wait_for_timeout(300)
    pg.evaluate("VR.camera.position.set(0,2.6,3.4);VR.camera.lookAt(0,.7,-1.5)");pg.wait_for_timeout(600);pg.screenshot(path=D+'three-tenors.png')
    pg.reload();load();pg.wait_for_timeout(500)
    check(pg.evaluate("VR.players.of('tenor')")==3 and len(pg.evaluate("VR.players.drums('tenor')"))==3,'the band size is saved with the song')
    check(not errs,f'no page errors {errs[:3]}')
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'ALL OK');sys.exit(1 if fails else 0)
