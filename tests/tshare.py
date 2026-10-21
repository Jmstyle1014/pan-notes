import os,sys,json
from playwright.sync_api import sync_playwright
# Share your pan sounds: the sounds file has the recorded notes and their tuning only (no song, cues or recording),
# and opening it on another phone adds them as new takes with a new sound profile, keeping that phone's own.
D=os.environ['WORK']+'/tshare/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
MAKE="""async ([ids,f])=>{const sr=44100;for(const id of ids){const d=new Float32Array(sr*0.6);for(let i=0;i<d.length;i++)d[i]=0.5*Math.sin(2*Math.PI*f*i/sr)*Math.exp(-i/sr*4);
  const w=encodeWav24(d,sr);SAMPLES.wav[id]=w;delete SAMPLES.buf[id];TAKES.add(id,w,'rec')}saveSamples();return Object.keys(SAMPLES.wav).length}"""
def page(b):
    pg=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=True,accept_downloads=True).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}));if(!localStorage.getItem('panyard-theme'))localStorage.setItem('panyard-theme','cnight')")
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300);pg.add_style_tag(content='#status{visibility:hidden!important}');pg.errs=errs
    pg.on('dialog',lambda d:d.accept('Ajamu tenor'if d.type=='prompt' else None))
    return pg
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    A=page(b)
    ids=A.evaluate("[...FIELDS.keys()].filter(k=>/^six:|^tenor:/.test(k)).slice(0,5).concat([...FIELDS.keys()].filter(k=>!k.includes(':')).slice(0,3))")
    A.evaluate(MAKE,[ids,440]);A.evaluate("ids=>{SAMPLES.tune[ids[0]]={db:3,cents:-12,ring:4,tone:-2,fade:.3};SAMPLES.tune[ids[1]]={start:.1,end:.4,db:0,fade:.15};saveTune()}",ids)
    A.evaluate("ids=>Promise.all(ids.map(i=>sampleBuf(i)))",ids)
    A.evaluate("()=>{S.title='Secret song';S.cues=[{id:uid(),start:1,duration:.5,steps:['c'],mode:'together',note:''}];save()}")
    A.evaluate("()=>{window._out=null;offerFile=async(n,d)=>{window._out={n,d}}}")
    A.evaluate("()=>{TW.open(true);TW.tabTo('sound')}");A.wait_for_timeout(600)
    check(A.locator('#shareBox').count()==1,'the Sound tab has Share your pan sounds')
    A.evaluate("$('shareBox').scrollIntoView({block:'center'})");A.wait_for_timeout(200);A.screenshot(path=D+'1-card.png')
    A.click('[data-share=save]');A.wait_for_timeout(1500)
    out=A.evaluate("window._out");check(out is not None,'Save my sounds file makes a file')
    f=json.loads(out['d']);print('file',out['n'],len(out['d'])//1024,'KB keys',sorted(f.keys()))
    check(f['format']=='panyard-sounds' and set(f['sounds'])==set(ids),f'it has all {len(ids)} recorded notes')
    check(not any(k in f for k in ['cues','title','audio','chart','grid','photos']) and 'Secret song' not in out['d'],'no song, notes or recording in it')
    check(f['tune'][ids[0]]['ring']==4 and f['tune'][ids[0]]['cents']==-12,'the tuning (ring, pitch fix) goes with it')
    t1=f['tune'][ids[1]];check(t1['start']==0 and 'end' not in t1 and len(f['sounds'][ids[1]])<len(f['sounds'][ids[2]])*0.7,'a trimmed note goes in trimmed (smaller file, plays the same)')
    check(f['name']=='Ajamu tenor' and 'Ajamu tenor' in out['n'],'named as you choose')
    open(D+'sounds.json','w').write(out['d']);check(not A.errs,f'no errors {A.errs[:2]}')
    # another phone, with its own recording on one of the same notes
    B=page(b);B.evaluate(MAKE,[[ids[0]],220]);B.evaluate("()=>{TW.open(true);TW.tabTo('sound')}");B.wait_for_timeout(500)
    profs0=B.evaluate("PROF.list.length")
    B.set_input_files('#shareIn',D+'sounds.json');B.wait_for_timeout(1500)
    st=B.evaluate("ids=>[ids.every(i=>SAMPLES.wav[i]),TAKES.count(ids[0]),PROF.list.length,profNow().name,SAMPLES.tune[ids[0]]&&SAMPLES.tune[ids[0]].ring,S.panVoice]",ids)
    print('B',st,'profiles before',profs0)
    check(st[0],'the other phone has every shared note');check(st[1]==2,'its own take is kept (2 takes on that note)')
    check(st[2]==profs0+1 and st[3]=='Ajamu tenor','a new sound profile named after the file, in use')
    check(st[4]==4,'with the sender\'s ring');check(st[5]=='mine','recorded sounds switched on')
    B.wait_for_timeout(600);dec=B.evaluate("ids=>ids.filter(i=>SAMPLES.buf[i]).length",ids);check(dec==len(ids),f'all decoded and ready to play ({dec})')
    # Open backup file takes a sounds file too
    C=page(b);C.set_input_files('#impJson',D+'sounds.json');C.wait_for_timeout(1500)
    check(C.evaluate("ids=>ids.every(i=>SAMPLES.wav[i])",ids),'Open backup file understands a sounds file')
    for x in (B,C):check(not x.errs,f'no errors {x.errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
