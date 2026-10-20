import os
from playwright.sync_api import sync_playwright
import json, re, time, itertools
D=os.environ['WORK']+'/'
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
DRIVE={};IDS=itertools.count(1);LOG=[]
GIS="""window.google={accounts:{oauth2:{initTokenClient(o){return{requestAccessToken(p){window._authAsks=(window._authAsks||0)+1;setTimeout(()=>o.callback({access_token:'tok'+Date.now(),expires_in:3600}),50)}}}}}};"""
def drive(route):
  r=route.request;u=r.url;m=r.method;LOG.append(m+' '+u.split('?')[0].split('/v3/')[-1])
  H={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Location','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}
  if m=='OPTIONS':return route.fulfill(status=200,headers=H)
  js=lambda o,st=200,h={}:route.fulfill(status=st,body=json.dumps(o),content_type='application/json',headers={**H,**h})
  if '/about' in u:return js({'user':{'emailAddress':'player@example.com'}})
  if '/upload/drive/v3/files' in u and 'uploadType=multipart' in u:
    body=r.post_data_buffer;ct=r.headers['content-type'];b=ct.split('boundary=')[1].encode()
    parts=body.split(b'--'+b);meta=json.loads(parts[1].split(b'\r\n\r\n',1)[1].rsplit(b'\r\n',1)[0]);data=parts[2].split(b'\r\n\r\n',1)[1][:-2]
    mm=re.search(r'/files/([^?/]+)',u)
    if m=='PATCH' and mm:fid=mm.group(1);DRIVE[fid]['data']=data;DRIVE[fid]['t']=time.time()
    else:fid='f%d'%next(IDS);DRIVE[fid]={'name':meta['name'],'data':data,'t':time.time()}
    return js({'id':fid})
  if 'uploadType=resumable' in u:
    meta=json.loads(r.post_data or '{}');mm=re.search(r'/files/([^?/]+)',u)
    fid=mm.group(1) if (m=='PATCH' and mm) else 'f%d'%next(IDS)
    if fid not in DRIVE:DRIVE[fid]={'name':meta.get('name'),'data':b'','t':time.time()}
    return js({},200,{'Location':'https://www.googleapis.com/upload/session/'+fid})
  if '/upload/session/' in u:
    fid=u.rsplit('/',1)[1];DRIVE[fid]['data']=r.post_data_buffer;DRIVE[fid]['t']=time.time();return js({'id':fid})
  mm=re.search(r'/drive/v3/files/([^?/]+)',u)
  if mm and m=='DELETE':DRIVE.pop(mm.group(1),None);return route.fulfill(status=204,headers=H)
  if mm and 'alt=media' in u:return route.fulfill(status=200,body=DRIVE[mm.group(1)]['data'],headers=H)
  if u.split('?')[0].endswith('/drive/v3/files'):
    q=re.search(r"q=([^&]*)",u);import urllib.parse as up;q=up.unquote(q.group(1)) if q else ''
    fs=[{'id':k,'name':v['name'],'size':str(len(v['data'])),'modifiedTime':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(v['t']))} for k,v in DRIVE.items() if (not q or ("'%s'"%v['name']) in q)]
    return js({'files':fs})
  return js({'error':'?'},404)
errs=[]
def phone(b,init):
  pg=b.new_page(viewport={'width':390,'height':844});pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
  pg.add_init_script(init)
  pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  pg.route('https://accounts.google.com/**',lambda r:r.fulfill(body=GIS,content_type='text/javascript'));pg.route('https://www.googleapis.com/**',drive)
  pg.goto('https://pan.test/');pg.wait_for_timeout(1500);return pg
E=lambda pg,j:pg.evaluate(j)
with sync_playwright() as p:
  b=p.chromium.launch()
  base="localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));localStorage.setItem('panyard-gclient','test.apps.googleusercontent.com');"
  # ---- phone 1 ----
  c1=b.new_context(viewport={'width':390,'height':844});b1=c1;pg=None
  pg=c1.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
  pg.add_init_script("if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));if(!localStorage.getItem('panyard-studio'))localStorage.setItem('panyard-studio',JSON.stringify({cal:1,askTap:1,askMic:1}));"+base)
  pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  pg.route('https://accounts.google.com/**',lambda r:r.fulfill(body=GIS,content_type='text/javascript'));pg.route('https://www.googleapis.com/**',drive)
  pg.goto('https://pan.test/');pg.wait_for_timeout(1500)
  E(pg,"(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(500)
  E(pg,"SETUP.show('save')");pg.set_input_files('#impJson',D+'Panyard Sunrise - backup.json');pg.wait_for_timeout(2000)
  E(pg,"SETUP.show('rec')");pg.set_input_files('#audioFile',D+'Panyard Sunrise.wav');pg.wait_for_timeout(3000)
  E(pg,"showView('setup');SETUP.show('save')");pg.wait_for_timeout(400);pg.screenshot(path=D+'cl_card_off.png')
  print('before connect',E(pg,"[CLOUD.st.on,CLOUD.dirty,$('clCard').textContent.slice(0,80)]"))
  pg.click('#clOn');pg.wait_for_timeout(5000)
  st=E(pg,"[CLOUD.st.on,CLOUD.st.email,CLOUD.dirty,Object.keys(CLOUD.st.blobs).length,$('clStat').textContent]");print('after connect',st)
  print('drive files',len(DRIVE),sorted(v['name'][:22]+':'+str(len(v['data'])) for v in DRIVE.values()))
  songs1=E(pg,"JSON.parse(localStorage.getItem('pan-songs')).list.map(s=>s.title)");keys1=E(pg,"CLOUD.all().then(a=>a.map(x=>x[0]).sort())")
  print('phone1 cues',E(pg,'S.cues.length'),'phone1 songs',songs1,'idb keys',len(keys1))
  pg.screenshot(path=D+'cl_card_on.png')
  # a change: auto backup in 20 s
  n0=len(LOG);E(pg,"S.title='Sunday Lime (edited)';save()");pg.wait_for_timeout(500);print('dirty after edit',E(pg,"CLOUD.dirty"))
  pg.wait_for_timeout(22000);print('auto backup ran',E(pg,"CLOUD.dirty"),'requests',len(LOG)-n0,LOG[n0:][:6])
  # token runs out: chip on Home, one tap
  E(pg,"CLOUD.tok.exp=Date.now()-1;S.title='Sunday Lime v3';save()");E(pg,"showView('home')");pg.wait_for_timeout(800)
  print('chip shown',E(pg,"!$('hmCloud').hidden"));pg.screenshot(path=D+'cl_chip.png')
  pg.click('#hmCloud');pg.wait_for_timeout(4000);print('after chip',E(pg,"[CLOUD.dirty,!$('hmCloud').hidden,window._authAsks]"))
  man=[v for v in DRIVE.values() if v['name']=='panyard-backup.json'][0];mj=json.loads(man['data']);print('manifest songs',mj['songs'],'ls keys',len(mj['ls']),'skipped studio prefs',('panyard-studio' not in mj['ls']))
  # ---- phone 2: brand new ----
  c2=b.new_context(viewport={'width':390,'height':844});pg2=c2.new_page();pg2.on('pageerror',lambda e:errs.append(str(e)[:200]))
  pg2.add_init_script(base);pg2.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg2.route('https://fonts.googleapis.com/**',lambda r:r.abort())
  pg2.route('https://accounts.google.com/**',lambda r:r.fulfill(body=GIS,content_type='text/javascript'));pg2.route('https://www.googleapis.com/**',drive)
  pg2.goto('https://pan.test/');pg2.wait_for_timeout(1500)
  E(pg2,"ROLE.close&&ROLE.close()");E(pg2,"showView('setup');SETUP.show('save')");pg2.wait_for_timeout(400)
  pg2.click('#clOn');pg2.wait_for_timeout(2500);pg2.screenshot(path=D+'cl_restore_ask.png')
  print('phone2 asked',E(pg2,"!$('clSheet').hidden&&$('clSheet').textContent.slice(0,60)"))
  pg2.click('[data-cl=restore]');pg2.wait_for_timeout(9000)
  songs2=E(pg2,"JSON.parse(localStorage.getItem('pan-songs')).list.map(s=>s.title)");keys2=E(pg2,"CLOUD.all().then(a=>a.map(x=>x[0]).sort())")
  same=E(pg2,"(async()=>{const a=await idbGet('audio');return a&&a.blob&&a.blob.size})()")
  print('phone2 songs',songs2,'keys same',keys1==keys2,'recording bytes',same,'title',E(pg2,"S.title"),'cues',E(pg2,"S.cues.length"),'role',E(pg2,"localStorage.getItem('panyard-role')"))
  E(pg2,"showView('studio')");pg2.wait_for_timeout(1200);print('phone2 studio tracks',E(pg2,"STUDIO.song&&STUDIO.song.tracks.map(t=>t.name)"))
  b.close()
print('errors',errs)
