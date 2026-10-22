import os,sys,json
from playwright.sync_api import sync_playwright
# Open backup file is safe: a song backup opens as a song of its own (the open song keeps its notes and Studio
# tracks), the phone's own recorded pan sounds and sound profiles stay, and only notes this phone never recorded take
# the backup's sound. A song-only file brings back every Studio track. Notes left on an older take can go back to the newest.
W_=os.environ['WORK'];D=W_+'/tsafeopen/';os.makedirs(D,exist_ok=True)
html='<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>'+open(os.environ['APP']).read()+'</body></html>'
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
MAKE="""async ([ids,f,secs])=>{const sr=44100;for(const id of ids){const d=new Float32Array(Math.round(sr*secs));for(let i=0;i<d.length;i++)d[i]=0.5*Math.sin(2*Math.PI*f*i/sr)*Math.exp(-i/sr*4);
  const w=encodeWav24(d,sr);SAMPLES.wav[id]=w;delete SAMPLES.buf[id];TAKES.add(id,w,'rec')}saveSamples();return 1}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=b.new_context(viewport={'width':412,'height':892},device_scale_factor=2,has_touch=True).new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('https://pan.test/**',lambda r:r.fulfill(body=html,content_type='text/html'));pg.route('https://fonts.googleapis.com/**',lambda r:r.abort())
    pg.add_init_script("if(!localStorage.getItem('panyard-role'))localStorage.setItem('panyard-role',JSON.stringify({role:'producer'}));localStorage.setItem('panyard-guide',JSON.stringify({tips:0}))")
    pg.on('dialog',lambda d:d.accept())
    pg.goto('https://pan.test/');pg.wait_for_timeout(1300)
    # this phone: a song "Get ready" with notes and a Studio track, and its own recorded tenor notes
    pg.evaluate("(async()=>{ROLE.close();await ROLE.songNew0()})()");pg.wait_for_timeout(400)
    pg.evaluate("()=>{S.title='Get ready';S.panSet='tenor';applyPanSet();const ids=[...FIELDS.keys()].filter(k=>/^tenor:/.test(k));S.cues=ids.slice(0,12).map((id,i)=>({id:uid(),start:1+i*.5,duration:.4,steps:[id],mode:'together',note:''}));normalizeChords();renderAll();save()}")
    pg.evaluate("showView('studio')");pg.wait_for_timeout(1000)
    pg.evaluate("document.querySelector('[data-st=addsheet]').click()");pg.wait_for_timeout(250);pg.click('[data-st=addk][data-v=pan][data-set=tenor]');pg.wait_for_timeout(400)
    pg.evaluate("()=>{const t=STUDIO.song.tracks.at(-1);t.notes=[{t:0,d:.5,p:[...FIELDS.keys()].find(k=>/^tenor:/.test(k)),v:.9}];STUDIO.seek(0)}");pg.wait_for_timeout(800)
    tids=pg.evaluate("[...FIELDS.keys()].filter(k=>/^tenor:/.test(k)).slice(0,3)")
    pg.evaluate(MAKE,[tids,440,.5]);pg.evaluate("ids=>{SAMPLES.tune[ids[0]]={db:2,ring:3};saveTune()}",tids)
    mine=pg.evaluate("ids=>ids.map(i=>SAMPLES.wav[i].size)",tids);prof=pg.evaluate("JSON.stringify(PROF.list.map(x=>x.id))")
    songs0=pg.evaluate("SONGS.list.length");pg.evaluate("showView('home')");pg.wait_for_timeout(600)
    # an old backup of another song, carrying older recordings of the same notes, one new note, and its own profiles
    bk=pg.evaluate("""async ids=>{const sr=44100,mk=(f,s)=>{const d=new Float32Array(Math.round(sr*s));for(let i=0;i<d.length;i++)d[i]=.4*Math.sin(2*Math.PI*f*i/sr);return encodeWav24(d,sr)};
      const other=[...FIELDS.keys()].filter(k=>/^tenor:/.test(k))[5],sounds={};for(const id of ids.concat([other]))sounds[id]=await readData(mk(300,1.2));
      return JSON.stringify({format:'pan-notes',version:2,title:'Rocksteady',panSet:'tenor',cues:[{start:1,duration:.5,steps:[other],mode:'together',note:''}],grid:{bpm:97,offset:0,perBar:4},
        studio:{tracks:[{type:'practice',name:'Your recording'},{type:'pan',name:'Low C Tenor',panSet:'tenor',notes:[{t:0,d:.5,p:other,v:.9},{t:1,d:.5,p:other,v:.9}]}]},
        sounds,soundTune:{[ids[0]]:{db:-6,ring:-5}},soundProfiles:{active:'old',list:[{id:'old',name:'Old profile',fx:{},tune:{}}]},soundBorrow:{tenor:'*'}})}""",tids)
    open(D+'old.json','w').write(bk)
    pg.set_input_files('#impJson',D+'old.json');pg.wait_for_timeout(2500)
    st=pg.evaluate("[SONGS.list.length,S.title,S.cues.length]");check(st[0]==songs0+1 and st[1]=='Rocksteady',f'the backup opened as its own song {st}')
    now=pg.evaluate("ids=>ids.map(i=>SAMPLES.wav[i].size)",tids);check(now==mine,'this phone\'s own recordings stayed as they are')
    check(pg.evaluate("JSON.stringify(PROF.list.map(x=>x.id))")==prof,'its sound profiles stayed as they are')
    check(pg.evaluate("ids=>SAMPLES.tune[ids[0]].ring",tids)==3,'and its tuning (no older ring from the backup)')
    check(pg.evaluate("!!SAMPLES.wav[[...FIELDS.keys()].filter(k=>/^tenor:/.test(k))[5]]"),'a note this phone never recorded took the backup\'s sound')
    # the song that was open is untouched
    gid=pg.evaluate("SONGS.list.find(s=>s.title==='Get ready').id");pg.evaluate("id=>songOpen(id)",gid);pg.wait_for_timeout(800)
    check(pg.evaluate("[S.title,S.cues.length]")==['Get ready',12],'Get ready still has its 12 notes')
    pg.evaluate("showView('studio')");pg.wait_for_timeout(1200)
    check(pg.evaluate("STUDIO.song.tracks.filter(t=>t.type==='pan').length")==1,'and its own Studio track')
    # the song-only Rocksteady file brings back every track
    pg.evaluate("showView('home')");pg.wait_for_timeout(400)
    pg.set_input_files('#impJson',os.path.join(W_,'rocksteady-song-only.json'));pg.wait_for_timeout(2500)
    pg.evaluate("showView('studio')");pg.wait_for_timeout(1500)
    tr=pg.evaluate("[S.title,S.cues.length,STUDIO.song.tracks.map(t=>t.name+':'+((t.notes||[]).length))]");print(tr)
    check(tr[0]=='Rocksteady' and tr[1]==42 and len(tr[2])==15 and sum(int(x.split(':')[-1]) for x in tr[2])==1830,f'Rocksteady (song only) brings back 42 notes and all 15 Studio tracks')
    check(pg.evaluate("ids=>ids.map(i=>SAMPLES.wav[i].size)",tids)==mine,'and leaves the pan sounds alone')
    pg.evaluate("document.querySelector('#stViews [data-sv=tracks]').click()");pg.wait_for_timeout(500);pg.screenshot(path=D+'1-rocksteady-studio.png')
    # an old-style overwrite (an older take in use while a newer one exists) can be put right
    pg.evaluate("async ids=>{const sr=44100,d=new Float32Array(sr*2);SAMPLES.wav[ids[1]]=encodeWav24(d,sr);saveSamples()}",tids)
    check(pg.evaluate("SHARE.stale().length")==1,'a note on an older recording is spotted')
    pg.evaluate("()=>{TW.open(true);TW.tabTo('sound')}");pg.wait_for_timeout(500)
    check(pg.locator('[data-share=newest]').count()==1,'Pan sounds → Sound offers Use my newest recordings')
    pg.evaluate("$('shareBox').scrollIntoView({block:'center'})");pg.screenshot(path=D+'2-newest.png')
    pg.evaluate("document.querySelector('[data-share=newest]').click()");pg.wait_for_timeout(500)
    check(pg.evaluate("SHARE.stale().length")==0 and pg.evaluate("ids=>SAMPLES.wav[ids[1]].size",tids)==mine[1],'one tap puts it back on the newest recording')
    check(not errs,f'no errors {errs[:2]}')
    b.close()
print('FAILS',fails) if fails else print('all ok')
sys.exit(1 if fails else 0)
