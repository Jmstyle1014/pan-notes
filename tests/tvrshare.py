import os,sys,json,io,wave,re
import numpy as np
from playwright.sync_api import sync_playwright
# Songs out of Panyard VR (Saved in VR → Share; a pretend Google and Drive here): 🎵 WAV and MP3 play the song into an
# audio file (every track, mute respected, nothing clipping); 📱 Send to Panyard puts it in panyard-vr-inbox.json in the
# hidden app folder (sending again updates it, never a second copy); 📁 Save to my Drive makes a visible "Panyard VR"
# folder with the song file and an MP3 (again: replaced, not doubled). Then Panyard on the phone sees the song (a chip on
# Home, Settings → Backup → Songs from VR) and Open makes it a new song with the pan and drum tracks in Studio.
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrshare/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
# a pretend Google: the token says which permission it was given; a pretend Drive keeps files in FILES
GIS="window.google={accounts:{oauth2:{initTokenClient:o=>({requestAccessToken(){(window._scopes=window._scopes||[]).push(o.scope);setTimeout(()=>o.callback({access_token:/appdata/.test(o.scope)?'tok-app':'tok-file',expires_in:3600}),10)}})}}};"
FILES={};NEXT=[0]
def drive(r):
    u=r.request.url;m=r.request.method;auth=(r.request.headers.get('authorization') or '').replace('Bearer ','')
    if auth not in('tok-app','tok-file'):return r.fulfill(status=401,body='')
    js=lambda o:r.fulfill(body=json.dumps(o),content_type='application/json')
    if '/upload/drive/v3/files' in u:
        body=r.request.post_data_buffer;b=re.search(r'boundary=(\S+)',r.request.headers['content-type']).group(1).encode()
        parts=[p for p in body.split(b'--'+b) if p.strip() not in (b'',b'--')]
        meta=json.loads(parts[0].split(b'\r\n\r\n',1)[1].strip() or b'{}');data=parts[1].split(b'\r\n\r\n',1)[1][:-2]
        fid=re.search(r'/files/([^?]+)',u)
        if fid:f=FILES[fid.group(1)];f['body']=data;f['n']+=1;return js({'id':fid.group(1)})
        NEXT[0]+=1;i='f%d'%NEXT[0];par=meta.get('parents',[])
        if 'appDataFolder' in par and auth!='tok-app':return r.fulfill(status=403,body='')
        FILES[i]={'name':meta['name'],'parents':par,'body':data,'n':1,'by':auth};return js({'id':i})
    fid=re.search(r'/drive/v3/files/([^?]+)',u)
    if fid:
        f=FILES.get(fid.group(1));return r.fulfill(body=f['body']) if f else r.fulfill(status=404,body='')
    if m=='POST':
        meta=json.loads(r.request.post_data);NEXT[0]+=1;i='f%d'%NEXT[0];FILES[i]={'name':meta['name'],'parents':[],'body':b'','n':1,'folder':True,'by':auth};return js({'id':i})
    from urllib.parse import urlparse,parse_qs
    qs=parse_qs(urlparse(u).query);q=qs.get('q',[''])[0];app='appDataFolder' in qs.get('spaces',[''])[0]
    nm=re.search(r"name='((?:[^'\\]|\\.)*)'",q);nm=nm and nm.group(1).replace("\\'","'");par=re.search(r"'([^']+)' in parents",q)
    out=[{'id':i,'name':f['name']} for i,f in FILES.items() if (not nm or f['name']==nm) and (('appDataFolder' in f['parents'])==app) and (not par or par.group(1) in f['parents']) and (app or f['by']==auth)]
    return js({'files':out})
def route(r):
    u=r.request.url
    if u.startswith('https://accounts.google.com/gsi/client'):return r.fulfill(body=GIS,content_type='text/javascript')
    if u.startswith('https://www.googleapis.com/'):return drive(r)
    u=u.split('?')[0].replace('https://pan.test/','')
    if u=='app/':return r.fulfill(body=PANYARD,content_type='text/html')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
PANYARD='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.path.join(ROOT,'source','pan-notes-panyard.html')).read()+'</body></html>'
# a saved VR song: double seconds, the kit, and a muted tenor track
song={'bpm':120,'L':8,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'title':'Yard Jam','tracks':[
  {'id':'t1','name':'Double Seconds','set':'dsec','vol':1,'pan':-.3,'mute':False,'solo':False,'col':'#f00','notes':[{'id':'dsec:60','v':.9,'b':0},{'id':'dsec:64','v':.7,'b':1},{'id':'dsec:67','v':.8,'b':2},{'id':'dsec:72','v':1,'b':4}]},
  {'id':'t2','name':'Drums','set':'kit','vol':.9,'pan':0,'mute':False,'solo':False,'col':'#0f0','notes':[{'id':'drum:36','v':1,'b':0},{'id':'drum:38','v':.9,'b':1},{'id':'drum:36','v':1,'b':2},{'id':'drum:38','v':.9,'b':3}]},
  {'id':'t3','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':True,'solo':False,'col':'#00f','notes':[{'id':'tenor:72','v':1,'b':.5}]}]}
SAVED=[{'id':'s1','title':'Yard Jam','at':1730000000000,'song':song}]
def wav_read(path):
    w=wave.open(path);n=w.getnframes();x=np.frombuffer(w.readframes(n),'<i2').reshape(-1,w.getnchannels())/32768;return x,w.getframerate()
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':900,'height':800},accept_downloads=True);ctx.route('**/*',route)
    ctx.add_init_script("try{localStorage.setItem('panyard-vr-yard','0');localStorage.setItem('panyard-vr-welcomed','1');if(!localStorage.getItem('panyard-vr-songs'))localStorage.setItem('panyard-vr-songs',"+json.dumps(json.dumps(SAVED))+")}catch(e){}")
    pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('https://pan.test/vr/');pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000)
    pg.click('#mineBox [data-ms]');pg.wait_for_selector('.mshare')
    check(pg.locator('.mshare [data-sh]').count()==4,'Share opens four ways out: Send to Panyard, MP3, WAV, Save to my Drive')
    pg.locator('#mineBox').scroll_into_view_if_needed();pg.wait_for_timeout(200);pg.screenshot(path=D+'1-share.png')
    # WAV
    with pg.expect_download(timeout=120000) as dl:pg.click('[data-sh=wav]')
    fp=D+'song.wav';dl.value.save_as(fp);x,sr=wav_read(fp);dur=len(x)/sr
    check(dl.value.suggested_filename=='Yard Jam.wav' and x.shape[1]==2 and sr==44100,f'🎵 WAV saves "Yard Jam.wav", stereo, 44.1 kHz ({dl.value.suggested_filename})')
    check(abs(dur-(8*.5+3.55))<.1,f'the whole song plus its ring ({dur:.2f} s for 8 beats at 120)')
    pk=float(abs(x).max());env=np.abs(x).mean(1);hit=lambda t:env[int(t*sr):int((t+.08)*sr)].max();quiet=env[int(.25*sr):int(.45*sr)].max()
    beats=[hit(.05+k*.5) for k in (0,1,2,3,4)]
    check(.05<pk<1 and min(beats)>.02,f'it sounds at every note and nothing clips (peak {pk:.2f}, at the beats {[round(v,2) for v in beats]})')
    L,R=np.abs(x[int(.05*sr):int(.4*sr),0]).sum(),np.abs(x[int(.05*sr):int(.4*sr),1]).sum()
    check(L>R,f'the double seconds track sits a little left as mixed (left {L:.0f} / right {R:.0f})')
    # MP3
    with pg.expect_download(timeout=180000) as dl:pg.click('[data-sh=mp3]')
    fp=D+'song.mp3';dl.value.save_as(fp);mb=open(fp,'rb').read()
    check(dl.value.suggested_filename=='Yard Jam.mp3' and len(mb)>20000 and (mb[:3]==b'ID3' or (mb[0]==0xFF and mb[1]&0xE0==0xE0)),f'🎵 MP3 saves "Yard Jam.mp3", a real MP3 ({len(mb)//1000} KB)')
    # Send to Panyard
    pg.click('[data-sh=panyard]');pg.wait_for_function("document.querySelector('.mshare p').textContent.startsWith('Sent')",timeout=30000)
    msg=pg.inner_text('.mshare p');inbox=[f for f in FILES.values() if f['name']=='panyard-vr-inbox.json']
    j=json.loads(inbox[0]['body']) if inbox else {}
    check(len(inbox)==1 and inbox[0]['parents']==['appDataFolder'] and j.get('format')=='panyard-vr-inbox' and j['songs'][0]['title']=='Yard Jam' and len(j['songs'][0]['song']['tracks'])==3,f'📱 Send to Panyard puts the song in Panyard\'s hidden Drive folder ("{msg[:60]}…")')
    pg.click('[data-sh=panyard]');pg.wait_for_timeout(1500);pg.wait_for_function("document.querySelector('.mshare p').textContent.startsWith('Sent')",timeout=30000)
    inbox=[f for f in FILES.values() if f['name']=='panyard-vr-inbox.json'];j=json.loads(inbox[0]['body'])
    check(len(inbox)==1 and len(j['songs'])==1 and inbox[0]['n']==2,'sending it again updates it: one file, one copy of the song')
    # Save to my Drive
    pg.click('[data-sh=drive]');pg.wait_for_function("document.querySelector('.mshare p').textContent.startsWith('In your Google Drive')",timeout=180000)
    fold=[i for i,f in FILES.items() if f.get('folder')];inf=sorted(f['name'] for f in FILES.values() if fold and fold[0] in f['parents'])
    check(len(fold)==1 and FILES[fold[0]]['name']=='Panyard VR' and inf==['Yard Jam - Panyard VR song.json','Yard Jam.mp3'],f'📁 Save to my Drive makes a "Panyard VR" folder with the song file and the MP3 {inf}')
    check(any('drive.file' in s for s in pg.evaluate("window._scopes")) and not any('drive.file' in s and 'appdata' in s for s in pg.evaluate("window._scopes")),'it asks Google only for the files it makes (drive.file), apart from Panyard\'s hidden folder')
    pg.click('[data-sh=drive]');pg.wait_for_timeout(1500);pg.wait_for_function("document.querySelector('.mshare p').textContent.startsWith('In your Google Drive')",timeout=180000)
    fold=[i for i,f in FILES.items() if f.get('folder')];inf=[f for f in FILES.values() if fold[0] in f['parents']]
    check(len(fold)==1 and len(inf)==2 and all(f['n']==2 for f in inf),'saving again replaces them: still one folder with two files')
    pg.screenshot(path=D+'2-done.png')
    check(not errs,'VR: no errors '+str(errs[:3]))
    # Panyard on the phone
    pc=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2);pc.route('**/*',route)
    pc.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-cloud-tok'))localStorage.setItem('panyard-cloud-tok',JSON.stringify({t:'tok-app',exp:Date.now()+3e6}))")
    pp=pc.new_page();perr=[];pp.on('pageerror',lambda e:perr.append(str(e)));pp.on('dialog',lambda d:d.accept())
    pp.goto('https://pan.test/app/');pp.wait_for_timeout(1500);pp.add_style_tag(content='#status{visibility:hidden!important}')
    pp.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pp.wait_for_timeout(400);pp.evaluate("showView('home')")
    before=pp.evaluate("SONGS.list.length")
    pp.wait_for_function("document.getElementById('hmVR')&&!document.getElementById('hmVR').hidden",timeout=20000)
    check('A song from VR' in pp.inner_text('#hmVR'),'Panyard: a chip on Home says a song from VR is waiting')
    pp.screenshot(path=D+'3-home.png')
    pp.click('#hmVR');pp.wait_for_selector('[data-vrin]')
    row=pp.inner_text('.vrin-r');check('Yard Jam' in row and '3 tracks' in row and '120 bpm' in row,f'its list shows the song ({row.strip()[:60]})')
    pp.screenshot(path=D+'4-list.png')
    pp.click('[data-vrin]');pp.wait_for_function("document.body.dataset.view==='studio'||(window.STUDIO&&STUDIO.song&&STUDIO.song.tracks.some(t=>t.type==='pan'&&t.panSet==='dsec'))",timeout=20000);pp.wait_for_timeout(1200)
    st=pp.evaluate("(()=>{const s=STUDIO.song;return s&&{bpm:s.bpm,tr:s.tracks.map(t=>[t.type,t.panSet||t.kit||'',(t.notes||[]).length,!!t.mute,+(+t.pan).toFixed(2)])}})()")
    print('  ',st)
    tr=st and st['tr'] or []
    check(st and st['bpm']==120 and ['pan','dsec',4,False,-.3] in tr and ['drums','real',4,False,0] in tr and ['pan','tenor',1,True,0] in tr,'Open makes it a song with each track in Studio, as mixed (♩ 120, double seconds left, drums, the muted tenor)')
    check(pp.evaluate("S.title")=='Yard Jam' and pp.evaluate("SONGS.list.length")==before+1 and pp.evaluate("SONGS.list[0].title")=='Yard Jam',f'it\'s a new song called Yard Jam (songs {before} → {pp.evaluate("SONGS.list.length")})')
    n=pp.evaluate("(()=>{const t=STUDIO.song.tracks.find(t=>t.panSet==='dsec');return t.notes.map(n=>[n.t,n.p])})()")
    check(n==[[0,'dsec:60'],[1,'dsec:64'],[2,'dsec:67'],[4,'dsec:72']],f'the notes land on their beats {n}')
    pp.screenshot(path=D+'5-studio.png')
    pp.evaluate("showView('home')");pp.wait_for_timeout(400)
    check(pp.evaluate("document.getElementById('hmVR').hidden"),'once opened, the chip goes away')
    pp.reload();pp.wait_for_timeout(6500)
    check(pp.evaluate("!document.getElementById('hmVR')||document.getElementById('hmVR').hidden"),'and stays away after reopening the app')
    pp.evaluate("showView('setup')");pp.wait_for_timeout(500)
    check(pp.locator('#vrinGo').count()==1,'Settings → Backup has 🥽 Songs from VR')
    check(not perr,'Panyard: no errors '+str(perr[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
