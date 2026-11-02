import os,sys,json
from playwright.sync_api import sync_playwright
# Panyard VR classroom, Level 2 (chords, keys and reading music): reading notes off the staff, rhythms in notation, chords
# answered with any two of their notes that keep the third (sevenths: the 3rd and 7th), ear questions answered on the pan,
# smooth changes measured, rolls (fast, even, both notes), band charts with repeats and endings and a backing band, the
# Mary Ann test, and Practise my songs (a chord per bar guessed from a saved song, changeable, comped along).
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=os.environ['WORK']+'/tvrclass2/';os.makedirs(D,exist_ok=True)
fails=[]
def check(ok,what):
    print(('ok   ' if ok else 'FAIL ')+what)
    if not ok:fails.append(what)
def route(r):
    u=r.request.url.split('?')[0].replace('https://pan.test/','')
    f=os.path.join(ROOT,'source','band-sounds',u.split('/')[-1]) if u.startswith('band/band-sounds/') else os.path.join(ROOT,u if not u.endswith('/') else u+'index.html')
    return r.fulfill(path=f) if os.path.exists(f) else r.fulfill(status=404,body='')
N=lambda i,b,v=.8:{'id':i,'v':v,'b':b}
mine={'bpm':100,'L':16,'loop':{'on':False,'s':0,'e':1},'sel':0,'click':False,'title':'My Tune','tracks':[
  {'id':'a','name':'Tenor','set':'tenor','vol':1,'pan':0,'mute':False,'solo':False,'col':'#f6ba45','notes':[N('tenor:60',0),N('tenor:64',1),N('tenor:67',2),N('tenor:65',4),N('tenor:69',5),N('tenor:72',6),N('tenor:67',8),N('tenor:71',9),N('tenor:74',10),N('tenor:69',12),N('tenor:72',13),N('tenor:76',14)]},
  {'id':'b','name':'Bass','set':'six','vol':1,'pan':0,'mute':False,'solo':False,'col':'#5ad1ff','notes':[N('six:36',0),N('six:41',4),N('six:43',8),N('six:45',12)]}]}
SAVED=[{'id':'s9','title':'My Tune','at':1730000000000,'song':mine}]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1000,'height':720});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script("if(!sessionStorage.getItem('s')){localStorage.setItem('panyard-vr-welcomed','1');localStorage.setItem('panyard-vr-songs',"+json.dumps(json.dumps(SAVED))+");sessionStorage.setItem('s','1')}")
    pg.route('https://pan.test/**',route)
    load=lambda:(pg.wait_for_function("window.VR&&VR.ready()>=79&&VR.drums()>0",timeout=90000),pg.evaluate("document.getElementById('hud').hidden=true"))
    pg.goto('https://pan.test/vr/');load()
    S=lambda:pg.evaluate("VR.cls.state()")
    import math
    def look():
        bd=pg.evaluate("VR.cls.boardAt()");pa=pg.evaluate("VR.studioAt()")['pans'];dx,dz=pa[0]-bd[0],pa[2]-bd[2];n=math.hypot(dx,dz)
        pg.evaluate(f"VR.camera.position.set({pa[0]+dx/n*.55},{bd[1]+.05},{pa[2]+dz/n*.55});VR.camera.lookAt({bd[0]},{bd[1]-.25},{bd[2]})");pg.wait_for_timeout(450)
    pg.evaluate("VR.cls.start();VR.cls.level(2)");s=S()
    check(s['lvl']==2 and len(s['lessons'])==11 and s['lessons'][-1][0].startswith('Level 2 test'),f'Level 2: 10 lessons and the test {[l[0] for l in s["lessons"]]}')
    pg.evaluate("VR.cls.open(1)");check(S()['page']=='home','its lessons open in order')
    look();pg.screenshot(path=D+'1-home.png')
    pg.evaluate("localStorage.setItem('panyard-vr-cls',JSON.stringify(Object.fromEntries([...Array(11).keys()].flatMap(i=>[['tenor:2:'+i,3],['dsec:2:'+i,3]]))))");pg.reload();load()
    pg.evaluate("VR.cls.start()");check(S()['lvl']==2,'the level is remembered')
    hit=lambda i,t=None:pg.evaluate(f"VR.cls.hitAt('{i}',{t if t is not None else 'VR.cls.now()'})")
    # 1 the staff
    pg.evaluate("VR.cls.open(0)");look();pg.screenshot(path=D+'2-staff.png')
    pg.evaluate("VR.cls.act('clsnext');VR.cls.act('clsnext')");s=S()
    check(s['t']=='play' and s['item']['ids']==['tenor:64'],'The staff: read the gold note (E, the bottom line)')
    hit('tenor:65');s=S();check('That\'s F' in s['msg'] and s['k']==0,f'a wrong note names what you played: "{s["msg"]}"')
    hit('tenor:64');check(S()['k']==1,'the right one moves on');look();pg.screenshot(path=D+'3-read.png')
    # 2 rhythm reading
    pg.evaluate("VR.cls.open(1)");pg.evaluate("VR.cls.act('clsnext')");pg.evaluate("VR.cls.act('clsbeat')");B=pg.evaluate("VR.cls.beatInfo()")
    T0=B[0]['t'];rel=[round((x['t']-T0)/(60/72),2) for x in B]
    check(rel==[0,1,2,4,5,6],f'"q q h | q q q Q" is read as notes on beats {rel}')
    for x in B:hit(x['ids'][0],x['t']+.03)
    pg.wait_for_timeout(300);look();pg.screenshot(path=D+'4-rhythm.png')
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=20000);check(S()['beat']['ok']==6,'all six in time')
    # 4 the third decides
    pg.evaluate("VR.cls.open(3)");pg.evaluate("VR.cls.act('clsnext')");s=S()
    check(s['t']=='play' and s['item']['chord']['name']=='C','Major or minor: play C as a chord')
    hit('tenor:62');s=S();check('C is C, E and G' in s['msg'],f'a note not in the chord: "{s["msg"]}"')
    t=pg.evaluate("VR.cls.now()");hit('tenor:60',t);hit('tenor:67',t+.05);s=S();check(s['k']==0 and 'keep the E' in s['msg'],f'C + G (no third) isn\'t enough: "{s["msg"]}"')
    t=pg.evaluate("VR.cls.now()");hit('tenor:64',t);hit('tenor:67',t+.05);s=S();check(s['k']==1,'E + G (with the third) is C')
    t=pg.evaluate("VR.cls.now()");hit('tenor:63',t);hit('tenor:67',t+.05);check(S()['k']==2,'E♭ + G is C minor')
    while S()['t']=='play' and S()['S']==1:
        it=S()['item'];pr=pg.evaluate(f"VR.cls.voice('{it['chord']['name']}')");t=pg.evaluate("VR.cls.now()");hit(f'tenor:{pr[0]}',t);hit(f'tenor:{pr[1]}',t+.05)
        if S()['done']:pg.wait_for_timeout(1800)
    s=S();check(s['S']==2 and s['item'].get('hear'),'then the ear test: the pan plays a chord')
    hit('tenor:63');s=S();check('minor third' in s['msg'],f'answering minor to a major chord: "{s["msg"]}"')
    hit('tenor:76');check(S()['k']==1,'E (any octave) answers "C major"')
    # 7 smooth changes
    pg.evaluate("VR.cls.open(6)");pg.evaluate("VR.cls.act('clsnext')");s=S()
    t=pg.evaluate("VR.cls.now()");hit('tenor:76',t);hit('tenor:79',t+.05)
    t=pg.evaluate("VR.cls.now()");hit('tenor:60',t);hit('tenor:64',t+.05);s=S()
    check(s['k']==2 and 'closer' in s['msg'] and 'cm' in s['msg'],f'a far jump is accepted, with the closer choice named: "{s["msg"]}"')
    pg.evaluate("VR.cls.open(6)");pg.evaluate("VR.cls.act('clsnext')")
    pv=pg.evaluate("VR.cls.voice('C')");t=pg.evaluate("VR.cls.now()");hit(f'tenor:{pv[0]}',t);hit(f'tenor:{pv[1]}',t+.05)
    nv=pg.evaluate(f"VR.cls.voice('Am',{json.dumps(pv)})");t=pg.evaluate("VR.cls.now()");hit(f'tenor:{nv[0]}',t);hit(f'tenor:{nv[1]}',t+.05);s=S()
    check('Smooth' in s['msg'] and sorted(x%12 for x in nv)!=sorted(x%12 for x in pv),f'the closest pair that still changes: "{s["msg"]}" (C {pv} → Am {nv})')
    pg.evaluate("VR.cls.open(6)");pg.evaluate("VR.cls.act('clsnext')");t=pg.evaluate("VR.cls.now()");hit('tenor:72',t);hit('tenor:76',t+.05);t=pg.evaluate("VR.cls.now()");hit('tenor:72',t);hit('tenor:76',t+.05);s=S()
    check(s['k']==1 and 'same two notes' in s['msg'] and ' A' in s['msg'],f'the same two notes again isn\'t a change: "{s["msg"]}"')
    # 8 sevenths
    pg.evaluate("VR.cls.open(7)");[pg.evaluate("VR.cls.act('clsnext')") for _ in range(2)];pg.evaluate("VR.cls.act('clsnext')") if S()['t']=='say' else None
    while S()['t']=='say':pg.evaluate("VR.cls.act('clsnext')")
    s=S();check(s['item']['chord']['name']=='Dm7' and s['item'].get('guide'),'Sevenths: Dm7 with its guide tones')
    pg.evaluate("VR.cls.open(7)");pg.evaluate("VR.cls.act('clsnext');VR.cls.act('clsnext')")
    pg.evaluate("VR.cls.hitAt('tenor:65',VR.cls.now());VR.cls.hitAt('tenor:72',VR.cls.now()+.05)")   # Dm7: F + C
    t=pg.evaluate("VR.cls.now()");hit('tenor:71',t);hit('tenor:74',t+.05);s=S()
    check(s['k']==1 and 'keep the B and the F' in s['msg'],f'G7 with B + D (no 7th) isn\'t its sound: "{s["msg"]}"')
    t=pg.evaluate("VR.cls.now()");hit('tenor:71',t);hit('tenor:77',t+.05);check(S()['k']==2,'B + F is G7')
    # 9 rolls
    pg.evaluate("VR.cls.open(8)");pg.evaluate("VR.cls.act('clsnext')");pg.evaluate("VR.cls.act('clsbeat')");B=pg.evaluate("VR.cls.beatInfo()")
    r1,r2=B[0],B[1];check(r1['roll'] and r2['roll'],'Rolls: two rolls of 4 beats')
    k=0;tt=r1['t']+.02
    while tt<r1['t2']:hit(r1['ids'][k%2],tt);tt+=.12;k+=1
    tt=r2['t']+.02
    while tt<r2['t2']:hit(r2['ids'][0],tt);tt+=.45
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=25000);B=pg.evaluate("VR.cls.beatInfo()");s=S()
    check(B[0]['ok'] and B[0]['even'] and not B[1]['ok'] and 'too slow' in s['msg'],f'a fast, even roll counts, a slow one doesn\'t ({B[0]["rate"]} vs {B[1]["rate"]} a second): "{s["msg"]}"')
    # 10 charts: repeats and endings, with the band
    pg.evaluate("VR.cls.open(9)");[pg.evaluate("VR.cls.act('clsnext')") for _ in range(3)];s=S()
    check(pg.evaluate("VR.cls.chartOrder({bars:['C','F','G','C'],rep:{from:0,to:2,end1:[2],end2:[3]}})")==[0,1,2,0,1,3],'1st and 2nd endings: C F G | C F C')
    pg.evaluate("VR.hits.length=0;VR.cls.act('clsbeat')");B=pg.evaluate("VR.cls.beatInfo()")
    check(len(B)==12 and [x['chord'] for x in B[::2]]==['C','F','G','C','F','C'],f'the chart is played in order, two chords a bar {[x["chord"] for x in B[::2]]}')
    for x in B:hit(f"tenor:{x['sug'][0]}",x['t']);hit(f"tenor:{x['sug'][1]}",x['t']+.04)
    pg.wait_for_timeout(2500);look();pg.screenshot(path=D+'5-chart.png')
    pg.wait_for_function("VR.cls.state().beat&&VR.cls.state().beat.over",timeout=30000)
    hs=pg.evaluate("VR.hits.map(h=>h.id)")
    check(S()['beat']['ok']==12 and any(h.startswith('six:') for h in hs) and 'drum:36' in hs and 'drum:42' in hs,'every chord counts, and the band plays along (bass, kick, hi-hat)')
    # the test
    pg.evaluate("VR.cls.open(10)");s=S();check(s['t']=='say' and pg.evaluate("VR.cls.chartOrder({bars:['C','C','G7','G7','G7','G7','C','C'],rep:{from:0,to:7}})")==[0,1,2,3,4,5,6,7]*2,'the Mary Ann chart: 8 bars, twice')
    # Practise my songs
    pg.evaluate("VR.cls.act('clssongs')");look();pg.screenshot(path=D+'6-songs.png')
    pg.evaluate("VR.cls.song('s9')");s=S();check(s['page']=='song' and s['song']==['C','F','G','Am'],f'Practise my songs: chords guessed per bar {s["song"]}')
    look();pg.screenshot(path=D+'7-mysong.png')
    pg.evaluate("VR.cls.bar(3)");s=S();check(s['song'][3]!='Am' and pg.evaluate("JSON.parse(localStorage.getItem('panyard-vr-cls-chords-s9'))[3]")==s['song'][3],f'tapping a bar tries the next guess ({s["song"][3]}) and keeps it')
    pg.evaluate("VR.cls.bar(3);VR.cls.bar(3);VR.cls.bar(3)")
    pg.evaluate("VR.hits.length=0;VR.cls.comp()");B=pg.evaluate("VR.cls.beatInfo()");pg.wait_for_timeout(5500)
    hs=pg.evaluate("VR.hits.map(h=>h.id)")
    check(len(B)==8 and any(h.startswith('six:') for h in hs) and not any(h.startswith('tenor:') for h in hs),'comping: 2 chords a bar while the song\'s bass plays (your tenor part stays quiet)')
    # double seconds
    pg.evaluate("VR.cls.set('dsec')");vs=pg.evaluate("['C','F','Dm','Am'].map(n=>VR.cls.voice(n,null,false))")
    side=pg.evaluate(f"{json.dumps(vs)}.map(v=>v.map(m=>[52,54,56,58,60,62,64,66,68,70,72,74,76,78,80].includes(m)?'C':'C#'))")
    check(all(len(set(x))==2 for x in side),f'double seconds chords: one note on each pan {vs}')
    check(not errs,'no errors '+str(errs[:3]))
    b.close()
print('FAILED: '+str(len(fails)) if fails else 'all passed')
sys.exit(1 if fails else 0)
