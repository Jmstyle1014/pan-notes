import os,sys,json,io,wave
import numpy as np
from playwright.sync_api import sync_playwright
# Panyard VR: your songs from Panyard's Google Drive backup (a pretend Google and Drive here). The list shows your songs;
# picking one brings its Studio pan and drum tracks, My part and its recording onto the studio table, in time with each
# other; a bass track plays on the band's bass sounds; beats tracks stay in Panyard; ↶ Undo goes back.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrdrive/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
sr=32000;x=(.2*np.sin(2*np.pi*220*np.arange(sr*6)/sr)).astype(np.float32);bio=io.BytesIO();w=wave.open(bio,'wb');w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((x*32767).astype('<i2').tobytes());w.close();WAV=bio.getvalue()
O=lambda d:{'$o':d}
man={'format':'panyard-cloud','version':1,'blobs':{'fpA':'file-rec'},
  'ls':{'pan-songs':json.dumps({'list':[{'id':'s1','title':'Pan Song','rec':True},{'id':'s2','title':'Other Song'}],'active':'s2'}),
        'pan-notes-v2':json.dumps({'title':'Other Song','panSet':'tenor','grid':{'bpm':120,'offset':.25},'cues':[{'start':.75,'duration':.3,'steps':['tenor:60']}]})},
  'idb':{'song:s1':O({'data':O({'title':'Pan Song','panSet':'guitar','grid':O({'bpm':100,'offset':.3,'perBar':4}),'cues':[O({'start':.9,'duration':.3,'steps':['c','e-low']})]}),'audio':O({'blob':{'$b':'fpA','t':'audio/wav'},'name':'song.wav'})}),
         'studio:s1':O({'tracks':[O({'type':'practice'}),O({'type':'pan','panSet':'dsec','name':'Strum','notes':[O({'t':0,'p':'dsec:60','v':.9,'d':.25}),O({'t':1,'p':'dsec:64','v':.8,'d':.25}),O({'t':2,'p':'dsec:67','v':.8,'d':.25})]}),
            O({'type':'drums','kit':'rusty','notes':[O({'t':0,'p':36,'v':1}),O({'t':1,'p':38,'v':.9}),O({'t':1.5,'p':42,'v':.6})]}),O({'type':'beats'}),
            O({'type':'pan','panSet':'six','name':'Bass','notes':[O({'t':0,'p':'six:36','v':.9,'d':1})]})]}),
         'audio':O({'blob':None,'name':''})}}
GIS="window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken(){setTimeout(()=>o.callback({access_token:'tok',expires_in:3600}),10)}})}}};"
def route(r):
    u=r.request.url
    if u.startswith('https://accounts.google.com/gsi/client'):return r.fulfill(body=GIS,content_type='text/javascript')
    if u.startswith('https://www.googleapis.com/drive/v3/files'):
        if r.request.headers.get('authorization')!='Bearer tok':return r.fulfill(status=401,body='')
        if '/files/man1' in u:return r.fulfill(body=json.dumps(man),content_type='application/json')
        if '/files/file-rec' in u:return r.fulfill(body=WAV,content_type='audio/wav')
        return r.fulfill(body=json.dumps({'files':[{'id':'man1','name':'panyard-backup.json'}]}),content_type='application/json')
    u=u.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':900,'height':700});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/*',route)
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=60000)
    pg.click('#gdGo');pg.wait_for_selector('[data-gd]',timeout=15000)
    names=pg.eval_on_selector_all('[data-gd]','b=>b.map(x=>x.textContent)')
    check(len(names)==2 and 'Pan Song' in names[0],f'☁ My songs lists the songs in the backup {names}')
    pg.screenshot(path=D+'1-list.png')
    pg.click('[data-gd=s1]');pg.wait_for_function("document.getElementById('gdBox').textContent.includes('Ready')",timeout=20000)
    msg=pg.inner_text('#gdBox');print('  ',msg.split('\n')[0])
    sg=pg.evaluate("VR.song()");names=[(t['name'],t['set'],len(t['notes'])) for t in sg['tracks']]
    check(sg['bpm']==100 and names[0][1]=='rec' and ('Strum','dsec',3) in names and ('Drums','kit',3) in names and ('Bass','six',1) in names and ('My part','guitar',2) in names,f'Pan Song comes in: its recording, the strum, drums, bass and My part at ♩ 100 {names}')
    check('1 beats' in msg or 'stay in Panyard' in msg,'a beats track is said to stay in Panyard')
    mp=[n for t in sg['tracks'] if t['name']=='My part' for n in t['notes']]
    rec=[t for t in sg['tracks'] if t['set']=='rec'][0]
    check(abs(mp[0]['b']-(.9-rec['rec']['origin'])/.6)<.01,f'My part lines up with the recording, as in Studio (beat {mp[0]["b"]}, origin {rec["rec"]["origin"]})')
    check(abs(pg.evaluate("VR.rec()")-6)<.05 and sg['L']>=8 and sg['L']%4==0,f'the recording (6 s) is ready and the song is long enough for it (L {sg["L"]} beats)')
    check(pg.evaluate("VR.state().set")=='dsec','the pans switch to the first track\'s pans')
    # play it: the tracks and the recording sound together
    pg.evaluate("VR.act('play')");pg.wait_for_timeout(3600)
    heard=set(h['id'] for h in pg.evaluate("VR.hits") if h['p'])
    check({'dsec:60','drum:36','drum:38','six:36','c'}<=heard,f'playing it plays every track {sorted(heard)[:10]}')
    check(pg.evaluate("VR.recPlaying()")>0,'and the recording plays with them')
    pg.evaluate("VR.act('play')");check(pg.evaluate("VR.recPlaying()")==0,'■ Stop stops the recording too')
    pg.evaluate("document.getElementById('hud').hidden=true;VR.view('table')");pg.wait_for_timeout(600);pg.screenshot(path=D+'2-table.png')
    # it's kept, and Undo goes back
    pg.reload();pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=60000)
    try:pg.wait_for_function("VR.rec()>5",timeout=8000)
    except Exception:print('   (tracks',pg.evaluate("VR.song().tracks.length"),'rec',pg.evaluate("VR.rec()"),')')
    check(pg.evaluate("VR.song().tracks.length")==5 and pg.evaluate("VR.rec()")>5,'after a reload the song and its recording are still there')
    pg.evaluate("VR.act('lane:0')")
    pg.click('#gdGo');pg.wait_for_selector('[data-gd]');pg.click('[data-gd=s2]');pg.wait_for_function("document.getElementById('gdBox').textContent.includes('Ready')",timeout=20000)
    sg=pg.evaluate("VR.song()");check(sg['bpm']==120 and [t['name'] for t in sg['tracks']]==['My part'],f'the open song in Panyard comes in from its own place {[t["name"] for t in sg["tracks"]]}')
    pg.evaluate("VR.undo()");check(pg.evaluate("VR.song().title")=='Pan Song','↶ Undo goes back to the song before')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
